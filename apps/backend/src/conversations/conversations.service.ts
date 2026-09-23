import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import type {
  ConversationDto,
  MessageDto,
  Page,
  PageQuery,
  SendMessageRequest,
} from '@zuund/shared';
import { toFile, toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import { ConnectionsService } from '../connections/connections.service';
import { FilesService } from '../files/files.service';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { requireJoined } from '../common/joined';

const messageInclude = {
  sender: { include: { profile: { include: { city: true } } } },
  attachment: true,
  reactions: true,
} as const;
type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

/**
 * Direct (buyer-to-buyer) and collective conversations share one model.
 * Direct messaging requires an ACCEPTED connection; collective messaging
 * requires an ACTIVE membership (checked by CollectivesService, which
 * creates the collective conversation and adds/removes members).
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: ConnectionsService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  async openDirect(userId: string, otherId: string): Promise<ConversationDto> {
    if (userId === otherId) throw new BadRequestException();
    await requireJoined(this.prisma, userId);
    if (!(await this.connections.areConnected(userId, otherId))) throw E.NOT_CONNECTED();
    const directKey = [userId, otherId].sort().join(':');
    const conv = await this.prisma.conversation.upsert({
      where: { directKey },
      create: { type: 'DIRECT', directKey, members: { create: [{ userId }, { userId: otherId }] } },
      update: {},
    });
    return (await this.listFor(userId, { limit: 1, cursor: undefined }, conv.id)).items[0]!;
  }

  async list(userId: string, q: PageQuery): Promise<Page<ConversationDto>> {
    return this.listFor(userId, q);
  }

  async get(userId: string, conversationId: string): Promise<ConversationDto> {
    await this.requireMember(conversationId, userId);
    const page = await this.listFor(userId, { limit: 1, cursor: undefined }, conversationId);
    if (!page.items[0]) throw new NotFoundException('Conversation not found');
    return page.items[0];
  }

  private async listFor(
    userId: string,
    q: PageQuery,
    onlyId?: string,
  ): Promise<Page<ConversationDto>> {
    // Ordered by activity, not creation: a plain findMany with a lastMessageAt cursor.
    const rows = await this.prisma.conversation.findMany({
      where: {
        ...(onlyId ? { id: onlyId } : {}),
        members: { some: { userId, leftAt: null } },
        ...(q.cursor
          ? { updatedAt: { lt: new Date(Buffer.from(q.cursor, 'base64url').toString()) } }
          : {}),
      },
      include: {
        members: { include: { user: { include: { profile: { include: { city: true } } } } } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const slice = hasMore ? rows.slice(0, q.limit) : rows;
    const items: ConversationDto[] = [];
    for (const c of slice) {
      const me = c.members.find((m) => m.userId === userId)!;
      const other = c.type === 'DIRECT' ? c.members.find((m) => m.userId !== userId) : undefined;
      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          deletedAt: null,
          ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });
      const last = c.messages[0];
      items.push({
        id: c.id,
        type: c.type,
        collectiveId: c.collectiveId,
        otherUser: other ? toPublicUser(other.user) : null,
        lastMessage: last ? await this.toMessage(last, userId) : null,
        unreadCount,
        updatedAt: c.updatedAt.toISOString(),
      });
    }
    const lastRow = slice[slice.length - 1];
    return {
      items,
      nextCursor:
        hasMore && lastRow
          ? Buffer.from(lastRow.updatedAt.toISOString()).toString('base64url')
          : null,
    };
  }

  async messages(userId: string, conversationId: string, q: PageQuery): Promise<Page<MessageDto>> {
    await this.requireMember(conversationId, userId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, ...afterCursor(decodeCursor(q.cursor)) },
      include: messageInclude,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    // Fetching is delivery: everything up to now has reached this member's client.
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastDeliveredAt: new Date() },
    });
    const page = toPage(rows, q.limit, (r) => r);
    return {
      items: await Promise.all(page.items.map((r) => this.toMessage(r, userId))),
      nextCursor: page.nextCursor,
    };
  }

  async send(
    userId: string,
    conversationId: string,
    input: SendMessageRequest,
  ): Promise<MessageDto> {
    const conv = await this.requireMember(conversationId, userId);
    if (conv.type === 'DIRECT') {
      await requireJoined(this.prisma, userId);
      const other = conv.members.find((m) => m.userId !== userId);
      if (other && (await this.connections.isBlocked(userId, other.userId))) throw E.BLOCKED();
    }
    if (input.attachmentId) await this.files.requireOwned(input.attachmentId, userId);
    if (input.replyToId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: input.replyToId, conversationId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Reply target not in this conversation');
    }
    const now = new Date();
    const [row] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          messageType: input.attachmentId ? 'ATTACHMENT' : 'TEXT',
          content: input.content,
          attachmentId: input.attachmentId,
          replyToId: input.replyToId,
        },
        include: messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now, updatedAt: now },
      }),
      // The sender has obviously read their own message.
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now, lastDeliveredAt: now },
      }),
    ]);
    const recipients = conv.members.filter((m) => m.userId !== userId && !m.leftAt);
    await this.notifications.notifyMany(
      recipients.map((m) => ({
        userId: m.userId,
        type: 'NEW_MESSAGE' as const,
        title:
          conv.type === 'DIRECT'
            ? `New message from ${row.sender.name ?? 'a buyer'}`
            : 'New message in your collective',
        body: input.content.slice(0, 120) || 'Sent an attachment',
        data: { conversationId, messageId: row.id },
        // One unread-message notification per conversation per hour, not one per message.
        dedupeKey: `msg:${conversationId}:${m.userId}:${Math.floor(now.getTime() / 3_600_000)}`,
      })),
    );
    return this.toMessage(row, userId);
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.requireMember(conversationId, userId);
    const now = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now, lastDeliveredAt: now },
    });
  }

  async react(userId: string, messageId: string, emoji: string): Promise<void> {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });
    if (!msg) throw new NotFoundException();
    await this.requireMember(msg.conversationId, userId);
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing)
      await this.prisma.messageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
    else await this.prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  }

  async deleteOwn(userId: string, messageId: string): Promise<void> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: '' },
    });
  }

  async requireMember(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const me = conv.members.find((m) => m.userId === userId && !m.leftAt);
    if (!me) throw E.NOT_A_MEMBER();
    return conv;
  }

  private async toMessage(r: MessageRow, viewerId: string): Promise<MessageDto> {
    // Delivery state from the sender's view: READ once every other member has read past it, else DELIVERED, else SENT.
    let deliveryState: MessageDto['deliveryState'] = 'SENT';
    if (r.senderId === viewerId) {
      const others = await this.prisma.conversationMember.findMany({
        where: { conversationId: r.conversationId, userId: { not: r.senderId }, leftAt: null },
        select: { lastReadAt: true, lastDeliveredAt: true },
      });
      if (others.length > 0) {
        if (others.every((o) => o.lastReadAt && o.lastReadAt >= r.createdAt))
          deliveryState = 'READ';
        else if (others.some((o) => o.lastDeliveredAt && o.lastDeliveredAt >= r.createdAt))
          deliveryState = 'DELIVERED';
      }
    }
    const byEmoji = new Map<string, { count: number; reacted: boolean }>();
    for (const x of r.reactions) {
      const e = byEmoji.get(x.emoji) ?? { count: 0, reacted: false };
      e.count += 1;
      if (x.userId === viewerId) e.reacted = true;
      byEmoji.set(x.emoji, e);
    }
    return {
      id: r.id,
      conversationId: r.conversationId,
      sender: toPublicUser(r.sender),
      messageType: r.messageType,
      content: r.deletedAt ? '' : r.content,
      replyToId: r.replyToId,
      attachment: r.attachment && !r.deletedAt ? toFile(r.attachment) : null,
      reactions: [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v })),
      deliveryState,
      createdAt: r.createdAt.toISOString(),
      deletedAt: r.deletedAt?.toISOString() ?? null,
    };
  }
}

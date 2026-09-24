import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import type { ConnectionDto, ConnectionsQuery, Page } from '@zuund/shared';
import { toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Connection, Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCanAccept,
  assertCanRequest,
  eliteUserIds,
  recordAcceptance,
} from '../common/entitlements';
import { requireJoined } from '../common/joined';

const withUsers = {
  requester: { include: { profile: { include: { city: true } } } },
  recipient: { include: { profile: { include: { city: true } } } },
} as const;

type Row = Prisma.ConnectionGetPayload<{ include: typeof withUsers }>;

/**
 * One row per pair of users, whichever way the request went. Every action
 * below loads that row by the sorted pair and decides from its current state.
 */
@Injectable()
export class ConnectionsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(requesterId: string, recipientId: string): Promise<ConnectionDto> {
    if (requesterId === recipientId) throw E.SELF_ACTION('You cannot connect with yourself');
    await requireJoined(this.prisma, requesterId);
    const recipient = await this.prisma.user.findFirst({
      where: { id: recipientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('User not found');

    const pair = this.pair(requesterId, recipientId);
    const existing = await this.prisma.connection.findUnique({
      where: { userLowId_userHighId: pair },
    });

    let row: Row;
    if (!existing) {
      await assertCanRequest(this.prisma, requesterId);
      row = await this.prisma.connection.create({
        data: { requesterId, recipientId, ...pair, status: 'PENDING' },
        include: withUsers,
      });
    } else {
      switch (existing.status) {
        case 'ACCEPTED':
          throw E.ALREADY_CONNECTED();
        case 'BLOCKED':
          throw E.BLOCKED();
        case 'PENDING':
          // The other side already asked: treat this as acceptance rather than a duplicate.
          if (existing.requesterId === recipientId) return this.accept(requesterId, existing.id);
          throw E.REQUEST_ALREADY_SENT();
        case 'REJECTED':
        case 'CANCELLED':
          // A fresh request re-uses the row so the pair stays unique.
          await assertCanRequest(this.prisma, requesterId);
          row = await this.prisma.connection.update({
            where: { id: existing.id },
            data: {
              requesterId,
              recipientId,
              status: 'PENDING',
              rejectedAt: null,
              cancelledAt: null,
              acceptedAt: null,
            },
            include: withUsers,
          });
      }
    }
    await this.notifications.notify({
      userId: recipientId,
      type: 'CONNECTION_REQUEST',
      title: 'New connection request',
      body: `${row.requester.name ?? 'A buyer'} wants to connect with you.`,
      data: { connectionId: row.id, userId: requesterId },
    });
    await this.audit.log({
      actorId: requesterId,
      actorType: 'USER',
      action: 'CONNECTION_REQUESTED',
      targetType: 'Connection',
      targetId: row.id,
      metadata: { recipientId },
    });
    return this.toDto(row, requesterId);
  }

  async accept(userId: string, id: string): Promise<ConnectionDto> {
    const row = await this.requireRow(id);
    if (row.recipientId !== userId) throw new ForbiddenException('Only the recipient can accept');
    if (row.status !== 'PENDING') throw E.REQUEST_NOT_PENDING();
    await requireJoined(this.prisma, userId);
    await assertCanAccept(this.prisma, userId, { ownRequestPending: false });
    try {
      await assertCanAccept(this.prisma, row.requesterId, { ownRequestPending: true });
    } catch {
      throw E.OTHER_AT_LIMIT();
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.connection.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: now },
        include: withUsers,
      });
      await recordAcceptance(tx, u, now);
      return u;
    });
    await this.notifications.notify({
      userId: row.requesterId,
      type: 'CONNECTION_ACCEPTED',
      title: 'Connection accepted',
      body: `${updated.recipient.name ?? 'A buyer'} accepted your connection request.`,
      data: { connectionId: id, userId },
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'CONNECTION_ACCEPTED',
      targetType: 'Connection',
      targetId: id,
      metadata: { requesterId: row.requesterId },
    });
    return this.toDto(updated, userId);
  }

  async reject(userId: string, id: string): Promise<ConnectionDto> {
    const row = await this.requireRow(id);
    if (row.recipientId !== userId) throw new ForbiddenException('Only the recipient can reject');
    if (row.status !== 'PENDING') throw E.REQUEST_NOT_PENDING();
    return this.toDto(
      await this.prisma.connection.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: new Date() },
        include: withUsers,
      }),
      userId,
    );
  }

  /** Cancels a pending request, or removes an accepted connection. */
  async cancel(userId: string, id: string): Promise<ConnectionDto> {
    const row = await this.requireRow(id);
    if (row.requesterId !== userId && row.recipientId !== userId) throw new ForbiddenException();
    if (row.status === 'PENDING' && row.requesterId !== userId)
      throw new ForbiddenException('Only the requester can cancel');
    if (row.status !== 'PENDING' && row.status !== 'ACCEPTED')
      throw E.INVALID_TRANSITION('Nothing to cancel');
    return this.toDto(
      await this.prisma.connection.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: withUsers,
      }),
      userId,
    );
  }

  /** Blocking works with or without a prior relationship and overrides any state. */
  async block(blockerId: string, targetId: string): Promise<void> {
    if (blockerId === targetId) throw new BadRequestException();
    const pair = this.pair(blockerId, targetId);
    await this.prisma.connection.upsert({
      where: { userLowId_userHighId: pair },
      create: {
        requesterId: blockerId,
        recipientId: targetId,
        ...pair,
        status: 'BLOCKED',
        blockedById: blockerId,
        blockedAt: new Date(),
      },
      update: { status: 'BLOCKED', blockedById: blockerId, blockedAt: new Date() },
    });
    await this.audit.log({
      actorId: blockerId,
      actorType: 'USER',
      action: 'USER_BLOCKED',
      targetType: 'User',
      targetId: targetId,
    });
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    const row = await this.prisma.connection.findUnique({
      where: { userLowId_userHighId: this.pair(userId, targetId) },
    });
    if (!row || row.status !== 'BLOCKED') throw new NotFoundException('Not blocked');
    if (row.blockedById !== userId) throw new ForbiddenException('You did not block this user');
    await this.prisma.connection.update({
      where: { id: row.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), blockedById: null, blockedAt: null },
    });
  }

  async list(userId: string, q: ConnectionsQuery): Promise<Page<ConnectionDto>> {
    const where: Prisma.ConnectionWhereInput =
      q.box === 'ACCEPTED'
        ? { status: 'ACCEPTED', OR: [{ requesterId: userId }, { recipientId: userId }] }
        : q.box === 'INCOMING'
          ? { status: 'PENDING', recipientId: userId }
          : q.box === 'OUTGOING'
            ? { status: 'PENDING', requesterId: userId }
            : { status: 'BLOCKED', blockedById: userId };
    const rows = await this.prisma.connection.findMany({
      where: { ...where, ...afterCursor(decodeCursor(q.cursor)) },
      include: withUsers,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const elite = await eliteUserIds(
      this.prisma,
      rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId)),
    );
    return toPage(rows, q.limit, (r) => this.toDto(r, userId, elite));
  }

  /** True when the two users are connected and neither has blocked the other. */
  async areConnected(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.connection.findUnique({
      where: { userLowId_userHighId: this.pair(a, b) },
      select: { status: true },
    });
    return row?.status === 'ACCEPTED';
  }

  async isBlocked(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.connection.findUnique({
      where: { userLowId_userHighId: this.pair(a, b) },
      select: { status: true },
    });
    return row?.status === 'BLOCKED';
  }

  private pair(a: string, b: string) {
    const [userLowId, userHighId] = [a, b].sort() as [string, string];
    return { userLowId, userHighId };
  }

  private async requireRow(id: string): Promise<Connection> {
    const row = await this.prisma.connection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Connection not found');
    return row;
  }

  private toDto(r: Row, viewerId: string, elite?: Set<string>): ConnectionDto {
    const other = r.requesterId === viewerId ? r.recipient : r.requester;
    return {
      id: r.id,
      requesterId: r.requesterId,
      recipientId: r.recipientId,
      status: r.status,
      otherUser: toPublicUser(other, { elite }),
      createdAt: r.createdAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    };
  }
}

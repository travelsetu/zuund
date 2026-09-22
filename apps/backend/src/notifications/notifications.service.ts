import { Injectable } from '@nestjs/common';
import type { NotificationDto, Page, PageQuery } from '@zuund/shared';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { NotificationType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  /** When set, a second notify() with the same key is a no-op (used by scheduled jobs). */
  dedupeKey?: string;
}

/** Stores notifications; delivery channels (push, email) can hang off this later. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    if (input.dedupeKey) {
      const exists = await client.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (exists) return;
    }
    await client.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        dedupeKey: input.dedupeKey,
      },
    });
  }

  async notifyMany(inputs: NotifyInput[], tx?: Prisma.TransactionClient): Promise<void> {
    for (const i of inputs) await this.notify(i, tx);
  }

  async list(
    userId: string,
    q: PageQuery & { unreadOnly?: boolean },
  ): Promise<Page<NotificationDto>> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(q.unreadOnly ? { readAt: null } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, unknown> | null) ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

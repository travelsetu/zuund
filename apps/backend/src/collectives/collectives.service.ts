import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import { ConfigService } from '@nestjs/config';
import type {
  CollectiveDto,
  CollectiveMemberDto,
  CollectivesQuery,
  Page,
  PageQuery,
} from '@zuund/shared';
import { toCar, toCity, toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { connectionsWith } from '../common/connections';
import { freePlaceHolders } from '../common/free-places';
import { PrismaService } from '../prisma/prisma.service';

const collectiveInclude = {
  car: true,
  city: true,
  conversation: { select: { id: true } },
} as const;
type CollectiveRow = Prisma.CollectiveGetPayload<{ include: typeof collectiveInclude }>;

/**
 * Collectives and memberships. Paid access is a membership in ACTIVE state,
 * which only PaymentsService.activate() can set after the provider confirmed
 * the payment. Everything here that opens a membership leaves it in
 * PENDING_PAYMENT.
 */
@Injectable()
export class CollectivesService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * One ACTIVE collective per car+city is the Phase 1 shape ("Hyundai Creta
   * Buyers, Ahmedabad"); creating returns the existing one when there is one.
   * The creator gets a PENDING_PAYMENT membership like anyone else.
   */
  async create(userId: string, buyingIntentId: string, name?: string): Promise<CollectiveDto> {
    const intent = await this.requireActiveIntent(userId, buyingIntentId);
    const existing = await this.prisma.collective.findFirst({
      where: { carId: intent.carId, cityId: intent.cityId, status: 'ACTIVE' },
      include: collectiveInclude,
    });
    if (existing) {
      await this.openMembership(existing.id, userId, intent.id);
      return this.toDto(existing, userId);
    }
    const row = await this.prisma.collective.create({
      data: {
        carId: intent.carId,
        cityId: intent.cityId,
        creatorId: userId,
        name: name ?? `${intent.car.displayName} Buyers, ${intent.city.name}`,
        conversation: { create: { type: 'COLLECTIVE' } },
      },
      include: collectiveInclude,
    });
    await this.openMembership(row.id, userId, intent.id);
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'COLLECTIVE_CREATED',
      targetType: 'Collective',
      targetId: row.id,
      metadata: { buyingIntentId: intent.id },
    });
    return this.toDto(row, userId);
  }

  /** Join = open a PENDING_PAYMENT membership; payment turns it ACTIVE. */
  async join(userId: string, collectiveId: string, buyingIntentId: string): Promise<CollectiveDto> {
    const row = await this.requireCollective(collectiveId);
    if (row.status !== 'ACTIVE') throw E.COLLECTIVE_CLOSED();
    const intent = await this.requireActiveIntent(userId, buyingIntentId);
    if (intent.carId !== row.carId || intent.cityId !== row.cityId) {
      throw E.INTENT_MISMATCH();
    }
    await this.openMembership(collectiveId, userId, intent.id);
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'COLLECTIVE_JOINED',
      targetType: 'Collective',
      targetId: collectiveId,
      metadata: { buyingIntentId: intent.id },
    });
    return this.toDto(row, userId);
  }

  /**
   * Leaving keeps every record; the membership becomes LEFT and the member
   * is removed from the discussion. Whether the pass/payment is refunded is
   * the REFUND_ON_LEAVE policy, applied by PaymentsService via the returned
   * membership so the provider call stays in one place.
   */
  async leave(userId: string, collectiveId: string) {
    const m = await this.prisma.collectiveMembership.findFirst({
      where: { collectiveId, userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
    });
    if (!m) throw E.NOT_A_MEMBER();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.collectiveMembership.update({
        where: { id: m.id },
        data: { status: 'LEFT', leftAt: now },
      });
      const conv = await tx.conversation.findUnique({
        where: { collectiveId },
        select: { id: true },
      });
      if (conv) {
        await tx.conversationMember.updateMany({
          where: { conversationId: conv.id, userId, leftAt: null },
          data: { leftAt: now },
        });
      }
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'COLLECTIVE_LEFT',
      targetType: 'Collective',
      targetId: collectiveId,
      metadata: { membershipId: m.id },
    });
    return { membership: m, refundPolicy: this.config.get('REFUND_ON_LEAVE', { infer: true }) };
  }

  async list(userId: string, q: CollectivesQuery): Promise<Page<CollectiveDto>> {
    const rows = await this.prisma.collective.findMany({
      where: {
        status: 'ACTIVE',
        ...(q.carId ? { carId: q.carId } : {}),
        ...(q.cityId ? { cityId: q.cityId } : {}),
        ...(q.mine
          ? { memberships: { some: { userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } } } }
          : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: collectiveInclude,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const page = toPage(rows, q.limit, (r) => r);
    return {
      items: await Promise.all(page.items.map((r) => this.toDto(r, userId))),
      nextCursor: page.nextCursor,
    };
  }

  async get(userId: string, id: string): Promise<CollectiveDto> {
    return this.toDto(await this.requireCollective(id), userId);
  }

  /** Member list is visible to any live member. Cards show intent, not contact details. */
  async members(
    userId: string,
    collectiveId: string,
    q: PageQuery,
  ): Promise<Page<CollectiveMemberDto>> {
    await this.requireLiveMember(collectiveId, userId);
    const rows = await this.prisma.collectiveMembership.findMany({
      where: { collectiveId, status: 'ACTIVE', ...afterCursor(decodeCursor(q.cursor)) },
      include: { user: { include: { profile: { include: { city: true } } } }, buyingIntent: true },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const connections = await connectionsWith(
      this.prisma,
      userId,
      rows.map((m) => m.userId).filter((id) => id !== userId),
    );
    return toPage(rows, q.limit, (m) => ({
      membershipId: m.id,
      user: toPublicUser(m.user),
      intentLevel: m.buyingIntent.intentLevel,
      purchaseTimeline: m.buyingIntent.purchaseTimeline,
      status: m.status,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      connection: connections.get(m.userId) ?? null,
    }));
  }

  // ── Guards used by polls, files, activities, discussion ──

  /** ACTIVE (paid) membership in an ACTIVE collective, or 403. */
  async requireActiveMember(collectiveId: string, userId: string) {
    const c = await this.requireCollective(collectiveId);
    if (c.status !== 'ACTIVE') throw E.COLLECTIVE_CLOSED();
    const m = await this.prisma.collectiveMembership.findFirst({
      where: { collectiveId, userId, status: 'ACTIVE' },
    });
    if (!m) {
      // Tell an expired or unpaid member why, rather than a generic refusal.
      const latest = await this.prisma.collectiveMembership.findFirst({
        where: { collectiveId, userId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest?.status === 'EXPIRED') throw E.BUYING_PASS_EXPIRED();
      if (latest?.status === 'PENDING_PAYMENT') throw E.BUYING_PASS_REQUIRED();
      throw E.NOT_A_MEMBER();
    }
    return { collective: c, membership: m };
  }

  /** PENDING_PAYMENT or ACTIVE: enough to see the collective and its member count, not its content. */
  async requireLiveMember(collectiveId: string, userId: string) {
    const m = await this.prisma.collectiveMembership.findFirst({
      where: { collectiveId, userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
    });
    if (!m) throw E.NOT_A_MEMBER();
    return m;
  }

  async requireCollective(id: string): Promise<CollectiveRow> {
    const row = await this.prisma.collective.findUnique({
      where: { id },
      include: collectiveInclude,
    });
    if (!row) throw new NotFoundException('Collective not found');
    return row;
  }

  async activeMemberIds(collectiveId: string, except?: string): Promise<string[]> {
    const rows = await this.prisma.collectiveMembership.findMany({
      where: { collectiveId, status: 'ACTIVE', ...(except ? { userId: { not: except } } : {}) },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  // ── internals ──

  private async requireActiveIntent(userId: string, buyingIntentId: string) {
    const intent = await this.prisma.buyingIntent.findUnique({
      where: { id: buyingIntentId },
      include: { car: true, city: true },
    });
    if (!intent) throw new NotFoundException('Buying post not found');
    if (intent.userId !== userId) throw new ForbiddenException('Not your buying post');
    if (intent.status !== 'ACTIVE') throw E.POST_NOT_ACTIVE();
    return intent;
  }

  private async openMembership(collectiveId: string, userId: string, buyingIntentId: string) {
    const live = await this.prisma.collectiveMembership.findFirst({
      where: { collectiveId, userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
    });
    if (live) {
      if (live.buyingIntentId !== buyingIntentId)
        throw E.ALREADY_IN_COLLECTIVE(
          'You are already in this collective through another buying post',
        );
      return live;
    }
    // An intent joins at most one collective at a time.
    const elsewhere = await this.prisma.collectiveMembership.findFirst({
      where: { buyingIntentId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
    });
    if (elsewhere) throw E.ALREADY_IN_COLLECTIVE();
    return this.prisma.collectiveMembership.create({
      data: { collectiveId, userId, buyingIntentId, status: 'PENDING_PAYMENT' },
    });
  }

  private async toDto(r: CollectiveRow, viewerId: string): Promise<CollectiveDto> {
    const [activeMemberCount, freeTaken, m] = await Promise.all([
      this.prisma.collectiveMembership.count({ where: { collectiveId: r.id, status: 'ACTIVE' } }),
      this.prisma.collectiveMembership.count({ where: freePlaceHolders(r.id) }),
      this.prisma.collectiveMembership.findFirst({
        where: {
          collectiveId: r.id,
          userId: viewerId,
          status: { in: ['PENDING_PAYMENT', 'ACTIVE'] },
        },
      }),
    ]);
    return {
      id: r.id,
      name: r.name,
      car: toCar(r.car),
      city: toCity(r.city),
      creatorId: r.creatorId,
      status: r.status,
      activeMemberCount,
      freePlacesLeft: Math.max(
        0,
        this.config.get('FREE_MEMBERS_PER_COLLECTIVE', { infer: true }) - freeTaken,
      ),
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      membership: m ? { id: m.id, status: m.status, buyingIntentId: m.buyingIntentId } : null,
      conversationId: m?.status === 'ACTIVE' ? (r.conversation?.id ?? null) : null,
    };
  }
}

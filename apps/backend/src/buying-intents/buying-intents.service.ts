import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import type {
  BuyerDiscoveryDto,
  BuyerDiscoveryQuery,
  BuyerDto,
  BuyingIntentDto,
  CreateBuyingIntentRequest,
  IntentHistoryDto,
  IntentLevel,
  Page,
  PageQuery,
} from '@zuund/shared';
import { isTravelWeekOpen, travelMonthOptions } from '@zuund/shared';
import { CatalogService } from '../catalog/catalog.service';
import {
  intentInclude,
  toCar,
  toCity,
  toHolidayTrip,
  toIntent,
  toPublicUser,
} from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { BuyingIntentStatus, Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { connectionsWith } from '../common/connections';
import { requireJoined } from '../common/joined';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuyingIntentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creating a post is free. One ACTIVE post per (user, car, city): the
   * partial unique index is the last line of defence; the pre-check gives a
   * friendlier message.
   */
  async create(userId: string, input: CreateBuyingIntentRequest): Promise<BuyingIntentDto> {
    const car = await this.catalog.requireActiveCar(input.carId);
    await this.catalog.requireActiveCity(input.cityId);
    // Holiday packages carry the trip; nothing else does.
    const holiday = input.holiday;
    if (car.category === 'HOLIDAY') {
      if (!holiday) throw E.HOLIDAY_DETAILS_REQUIRED();
      if (!travelMonthOptions().includes(holiday.travelMonth)) throw E.TRAVEL_MONTH_OUT_OF_RANGE();
      if (!isTravelWeekOpen(holiday.travelMonth, holiday.travelWeek)) throw E.TRAVEL_WEEK_PAST();
    } else if (holiday) {
      throw new BadRequestException('Trip details are only for holiday packages');
    }
    const dup = await this.prisma.buyingIntent.findFirst({
      where: { userId, carId: input.carId, cityId: input.cityId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (dup) throw E.DUPLICATE_ACTIVE_POST();

    const row = await this.prisma.buyingIntent.create({
      data: {
        userId,
        carId: input.carId,
        cityId: input.cityId,
        purchaseTimeline: input.purchaseTimeline,
        intentLevel: input.intentLevel,
        ...(holiday
          ? {
              travelMonth: holiday.travelMonth,
              travelWeek: holiday.travelWeek,
              adults: holiday.adults,
              childAges: holiday.childAges,
              nights: holiday.nights,
              hotelCategory: holiday.hotelCategory,
            }
          : {}),
        history: {
          create: { previousLevel: null, newLevel: input.intentLevel, changedById: userId },
        },
      },
      include: intentInclude,
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'BUYING_POST_CREATED',
      targetType: 'BuyingIntent',
      targetId: row.id,
      metadata: {
        carId: input.carId,
        cityId: input.cityId,
        purchaseTimeline: input.purchaseTimeline,
        intentLevel: input.intentLevel,
        ...(holiday ? { holiday } : {}),
      },
    });
    return toIntent(row);
  }

  async listMine(
    userId: string,
    q: PageQuery & { status?: BuyingIntentStatus },
  ): Promise<Page<BuyingIntentDto>> {
    const rows = await this.prisma.buyingIntent.findMany({
      where: {
        userId,
        ...(q.status ? { status: q.status } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: intentInclude,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, toIntent);
  }

  async getOwned(userId: string, id: string): Promise<BuyingIntentDto> {
    return toIntent(await this.requireOwned(userId, id));
  }

  async updateTimeline(
    userId: string,
    id: string,
    purchaseTimeline?: CreateBuyingIntentRequest['purchaseTimeline'],
  ) {
    const intent = await this.requireOwned(userId, id);
    if (intent.status === 'CLOSED' || intent.status === 'EXPIRED') throw E.POST_NOT_EDITABLE();
    const row = await this.prisma.buyingIntent.update({
      where: { id },
      data: { ...(purchaseTimeline ? { purchaseTimeline } : {}) },
      include: intentInclude,
    });
    if (purchaseTimeline)
      await this.audit.log({
        actorId: userId,
        actorType: 'USER',
        action: 'BUYING_POST_CHANGED',
        targetType: 'BuyingIntent',
        targetId: id,
        metadata: { purchaseTimeline },
      });
    return toIntent(row);
  }

  /** Any direction is allowed; every change is recorded in the history. */
  async changeLevel(
    userId: string,
    id: string,
    intentLevel: IntentLevel,
  ): Promise<BuyingIntentDto> {
    const intent = await this.requireOwned(userId, id);
    if (intent.status === 'CLOSED' || intent.status === 'EXPIRED') throw E.POST_NOT_EDITABLE();
    if (intent.intentLevel === intentLevel) return toIntent(intent);
    const row = await this.prisma.buyingIntent.update({
      where: { id },
      data: {
        intentLevel,
        history: {
          create: { previousLevel: intent.intentLevel, newLevel: intentLevel, changedById: userId },
        },
      },
      include: intentInclude,
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'INTENT_LEVEL_CHANGED',
      targetType: 'BuyingIntent',
      targetId: id,
      metadata: { from: intent.intentLevel, to: intentLevel },
    });
    return toIntent(row);
  }

  async history(userId: string, id: string): Promise<IntentHistoryDto[]> {
    await this.requireOwned(userId, id);
    const rows = await this.prisma.buyingIntentHistory.findMany({
      where: { buyingIntentId: id },
      orderBy: { changedAt: 'desc' },
    });
    return rows.map((h) => ({
      id: h.id,
      previousLevel: h.previousLevel,
      newLevel: h.newLevel,
      changedAt: h.changedAt.toISOString(),
      changedById: h.changedById,
    }));
  }

  /**
   * ACTIVE ⇄ PAUSED, and either → CLOSED. Closing is final; a user who wants
   * the same car later creates a new post. Rows are never deleted.
   */
  async transition(
    userId: string,
    id: string,
    action: 'PAUSE' | 'RESUME' | 'CLOSE',
  ): Promise<BuyingIntentDto> {
    const intent = await this.requireOwned(userId, id);
    const now = new Date();
    let data: Prisma.BuyingIntentUpdateInput;
    switch (action) {
      case 'PAUSE':
        if (intent.status !== 'ACTIVE')
          throw E.INVALID_TRANSITION('Only an active post can be paused');
        data = { status: 'PAUSED', pausedAt: now };
        break;
      case 'RESUME': {
        if (intent.status !== 'PAUSED')
          throw E.INVALID_TRANSITION('Only a paused post can be resumed');
        const dup = await this.prisma.buyingIntent.findFirst({
          where: {
            userId,
            carId: intent.carId,
            cityId: intent.cityId,
            status: 'ACTIVE',
            NOT: { id },
          },
          select: { id: true },
        });
        if (dup) throw E.DUPLICATE_ACTIVE_POST();
        data = { status: 'ACTIVE', pausedAt: null };
        break;
      }
      case 'CLOSE':
        if (intent.status === 'CLOSED' || intent.status === 'EXPIRED')
          throw E.INVALID_TRANSITION('This post is already closed');
        data = { status: 'CLOSED', closedAt: now };
        break;
    }
    const row = await this.prisma.buyingIntent.update({
      where: { id },
      data,
      include: intentInclude,
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'BUYING_POST_' + action + '',
      targetType: 'BuyingIntent',
      targetId: id,
      metadata: { from: intent.status, to: row.status },
    });
    return toIntent(row);
  }

  // ── Discovery ──

  /**
   * Other people's ACTIVE posts for the same car and city. A plain filtered
   * list plus a count: no scores, no budget. Blocked users in either
   * direction are excluded.
   */
  async discover(viewerId: string, q: BuyerDiscoveryQuery): Promise<BuyerDiscoveryDto> {
    const [car, city] = await Promise.all([
      this.catalog.requireActiveCar(q.carId),
      this.catalog.requireActiveCity(q.cityId),
    ]);
    await requireJoined(this.prisma, viewerId, { carId: q.carId, cityId: q.cityId });
    const blockedIds = await this.blockedUserIds(viewerId);

    const base: Prisma.BuyingIntentWhereInput = {
      carId: q.carId,
      cityId: q.cityId,
      status: 'ACTIVE',
      userId: { not: viewerId, notIn: blockedIds },
      user: { status: 'ACTIVE' },
    };
    const filter: Prisma.BuyingIntentWhereInput =
      q.filter === 'READY' || q.filter === 'COMMITTED' || q.filter === 'INTERESTED'
        ? { intentLevel: q.filter }
        : q.filter === 'RECENT'
          ? { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }
          : {};

    const recentSince = new Date(Date.now() - 7 * 86_400_000);
    const [totalActiveBuyers, ready, committed, interested, recent, rows] = await Promise.all([
      this.prisma.buyingIntent.count({ where: base }),
      this.prisma.buyingIntent.count({ where: { ...base, intentLevel: 'READY' } }),
      this.prisma.buyingIntent.count({ where: { ...base, intentLevel: 'COMMITTED' } }),
      this.prisma.buyingIntent.count({ where: { ...base, intentLevel: 'INTERESTED' } }),
      this.prisma.buyingIntent.count({ where: { ...base, createdAt: { gte: recentSince } } }),
      this.prisma.buyingIntent.findMany({
        where: { ...base, ...filter, ...afterCursor(decodeCursor(q.cursor)) },
        include: {
          car: true,
          city: true,
          user: { include: { profile: { include: { city: true } } } },
        },
        orderBy: cursorOrder,
        take: q.limit + 1,
      }),
    ]);

    const connections = await connectionsWith(
      this.prisma,
      viewerId,
      rows.map((r) => r.userId),
    );
    const page = toPage(rows, q.limit, (r): BuyerDto => {
      const c = connections.get(r.userId);
      return {
        buyingIntentId: r.id,
        user: toPublicUser(r.user),
        car: toCar(r.car),
        city: toCity(r.city),
        purchaseTimeline: r.purchaseTimeline,
        intentLevel: r.intentLevel,
        createdAt: r.createdAt.toISOString(),
        holiday: toHolidayTrip(r),
        connection: c ? { id: c.id, status: c.status, requesterId: c.requesterId } : null,
      };
    });
    return {
      ...page,
      car: toCar(car),
      city: toCity(city),
      totalActiveBuyers,
      counts: {
        ALL: totalActiveBuyers,
        READY: ready,
        COMMITTED: committed,
        INTERESTED: interested,
        RECENT: recent,
      },
    };
  }

  /** "237 people are looking to buy Hyundai Creta in Ahmedabad." — a count, no viewer needed. */
  async countBuyers(carId: string, cityId: string, excludeUserId?: string): Promise<number> {
    return this.prisma.buyingIntent.count({
      where: {
        carId,
        cityId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
    });
  }

  // ── helpers ──

  async requireOwned(userId: string, id: string) {
    const row = await this.prisma.buyingIntent.findUnique({
      where: { id },
      include: intentInclude,
    });
    if (!row) throw new NotFoundException('Buying post not found');
    if (row.userId !== userId) throw new ForbiddenException('Not your buying post');
    return row;
  }

  async blockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.connection.findMany({
      where: { status: 'BLOCKED', OR: [{ requesterId: userId }, { recipientId: userId }] },
      select: { requesterId: true, recipientId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId));
  }
}

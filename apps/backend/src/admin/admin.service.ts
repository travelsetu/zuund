import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CityDto,
  AdminCollectiveDto,
  AdminCollectiveMemberDto,
  AdminIntentDetailDto,
  AdminIntentDto,
  AdminPassDto,
  AdminPaymentDto,
  AdminReportDto,
  AdminStatsDto,
  AdminUserDetailDto,
  AdminUserDto,
  AuditLogDto,
  Page,
  PageQuery,
} from '@zuund/shared';
import { AuditService } from '../common/audit.service';
import {
  intentInclude,
  toCar,
  toCity,
  toIntent,
  toPass,
  toPayment,
  toPublicUser,
} from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { toReport } from '../reports/reports.service';

type Actor = { userId: string; ip?: string | null };
const brief = { id: true, email: true, name: true } as const;

/**
 * Everything the admin dashboard reads and does. Every mutation writes an
 * audit log row. Authorization (ADMIN role) is enforced by the controller's
 * guards; nothing here assumes the caller was checked elsewhere.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  // ── Stats ──
  async citiesInUse(): Promise<CityDto[]> {
    const rows = await this.prisma.city.findMany({
      where: { buyingIntents: { some: {} } },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCity);
  }

  async stats(): Promise<AdminStatsDto> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [
      total,
      verified,
      suspended,
      activeLast30Days,
      posters,
      activeIntents,
      totalIntents,
      byLevel,
      byTimeline,
      byCarRaw,
      byCityRaw,
      activeCollectives,
      totalCollectives,
      activeMemberships,
      activePasses,
      expiredPasses,
      refundedPasses,
      activeFreePasses,
      success,
      failed,
      refunded,
      revenue,
      refundedAmt,
      accepted,
      pending,
      messages,
      conversations,
      polls,
      votes,
      openReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.refreshToken
        .groupBy({ by: ['userId'], where: { createdAt: { gte: since30 } } })
        .then((r) => r.length),
      this.prisma.buyingIntent.groupBy({ by: ['userId'] }).then((r) => r.length),
      this.prisma.buyingIntent.count({ where: { status: 'ACTIVE' } }),
      this.prisma.buyingIntent.count(),
      this.prisma.buyingIntent.groupBy({
        by: ['intentLevel'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.buyingIntent.groupBy({
        by: ['purchaseTimeline'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.buyingIntent.groupBy({
        by: ['carId'],
        where: { status: 'ACTIVE' },
        _count: true,
        orderBy: { _count: { carId: 'desc' } },
        take: 10,
      }),
      this.prisma.buyingIntent.groupBy({
        by: ['cityId'],
        where: { status: 'ACTIVE' },
        _count: true,
        orderBy: { _count: { cityId: 'desc' } },
        take: 10,
      }),
      this.prisma.collective.count({ where: { status: 'ACTIVE' } }),
      this.prisma.collective.count(),
      this.prisma.collectiveMembership.count({ where: { status: 'ACTIVE' } }),
      this.prisma.buyingPass.count({ where: { status: 'ACTIVE' } }),
      this.prisma.buyingPass.count({ where: { status: 'EXPIRED' } }),
      this.prisma.buyingPass.count({ where: { status: 'REFUNDED' } }),
      this.prisma.buyingPass.count({ where: { status: 'ACTIVE', plan: 'FREE' } }),
      this.prisma.payment.count({ where: { status: 'SUCCESS' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.count({ where: { status: 'REFUNDED' } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['SUCCESS', 'REFUNDED'] } },
      }),
      this.prisma.payment.aggregate({
        _sum: { refundedAmount: true },
        where: { status: 'REFUNDED' },
      }),
      this.prisma.connection.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.connection.count({ where: { status: 'PENDING' } }),
      this.prisma.message.count({ where: { deletedAt: null } }),
      this.prisma.conversation.count(),
      this.prisma.poll.count(),
      this.prisma.pollVote.count(),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
    ]);
    const cars = await this.prisma.car.findMany({
      where: { id: { in: byCarRaw.map((r) => r.carId) } },
    });
    const cities = await this.prisma.city.findMany({
      where: { id: { in: byCityRaw.map((r) => r.cityId) } },
    });
    const levels = { INTERESTED: 0, COMMITTED: 0, READY: 0 };
    for (const r of byLevel) levels[r.intentLevel] = r._count;
    const timelines = { WITHIN_7_DAYS: 0, WITHIN_15_DAYS: 0, WITHIN_30_DAYS: 0, WITHIN_60_DAYS: 0 };
    for (const r of byTimeline) timelines[r.purchaseTimeline] = r._count;
    return {
      users: { total, verified, suspended, activeLast30Days, postedAtLeastOnce: posters },
      intents: {
        active: activeIntents,
        total: totalIntents,
        byLevel: levels,
        byTimeline: timelines,
        byCar: byCarRaw.flatMap((r) => {
          const car = cars.find((c) => c.id === r.carId);
          return car ? [{ car: toCar(car), count: r._count }] : [];
        }),
        byCity: byCityRaw.flatMap((r) => {
          const city = cities.find((c) => c.id === r.cityId);
          return city ? [{ city: toCity(city), count: r._count }] : [];
        }),
      },
      collectives: { active: activeCollectives, total: totalCollectives, activeMemberships },
      passes: {
        active: activePasses,
        expired: expiredPasses,
        refunded: refundedPasses,
        activeFree: activeFreePasses,
        activeElite: activePasses - activeFreePasses,
      },
      payments: {
        success,
        failed,
        refunded,
        revenuePaise: revenue._sum.amount ?? 0,
        refundedPaise: refundedAmt._sum.refundedAmount ?? 0,
      },
      connections: { accepted, pending },
      messages: { total: messages, conversations },
      polls: { total: polls, votes },
      reports: { open: openReports },
    };
  }

  // ── Users ──
  async users(
    q: PageQuery & { q?: string; status?: string; verification?: string; role?: string },
  ): Promise<Page<AdminUserDto>> {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(q.q
          ? {
              OR: [
                { email: { contains: q.q, mode: 'insensitive' } },
                { name: { contains: q.q, mode: 'insensitive' } },
                { phone: { contains: q.q.replace(/[^\d+]/g, '') || q.q } },
              ],
            }
          : {}),
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.verification ? { verificationStatus: q.verification as never } : {}),
        ...(q.role ? { role: q.role as never } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: {
        profile: { include: { city: true } },
        _count: {
          select: {
            buyingIntents: { where: { status: 'ACTIVE' } },
            buyingPasses: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      phoneVerified: !!u.phoneVerifiedAt,
      name: u.name,
      role: u.role,
      status: u.status,
      verificationStatus: u.verificationStatus,
      verifiedAt: u.verifiedAt?.toISOString() ?? null,
      city: u.profile?.city ? toCity(u.profile.city) : null,
      photoUrl: u.profile?.photoUrl ?? null,
      createdAt: u.createdAt.toISOString(),
      activeIntentCount: u._count.buyingIntents,
      activePassCount: u._count.buyingPasses,
    }));
  }

  async user(id: string): Promise<AdminUserDetailDto> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { city: true } },
        buyingIntents: { include: intentInclude, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            buyingIntents: { where: { status: 'ACTIVE' } },
            buyingPasses: { where: { status: 'ACTIVE' } },
            reportsAgainst: true,
          },
        },
      },
    });
    if (!u) throw new NotFoundException('User not found');
    return {
      id: u.id,
      email: u.email,
      phone: u.phone,
      phoneVerified: !!u.phoneVerifiedAt,
      name: u.name,
      role: u.role,
      status: u.status,
      verificationStatus: u.verificationStatus,
      verifiedAt: u.verifiedAt?.toISOString() ?? null,
      city: u.profile?.city ? toCity(u.profile.city) : null,
      photoUrl: u.profile?.photoUrl ?? null,
      about: u.profile?.about ?? null,
      createdAt: u.createdAt.toISOString(),
      activeIntentCount: u._count.buyingIntents,
      activePassCount: u._count.buyingPasses,
      intents: u.buyingIntents.map((i) => toIntent(i)),
      payments: u.payments.map(toPayment),
      reportsAgainstCount: u._count.reportsAgainst,
    };
  }

  async userAction(
    actor: Actor,
    id: string,
    action: 'VERIFY' | 'UNVERIFY' | 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE',
    note?: string,
  ): Promise<AdminUserDetailDto> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    if (u.role === 'ADMIN' && (action === 'SUSPEND' || action === 'DEACTIVATE'))
      throw new BadRequestException('Admins cannot be suspended here');
    const data: Prisma.UserUpdateInput =
      action === 'VERIFY'
        ? { verificationStatus: 'VERIFIED', verifiedAt: new Date() }
        : action === 'UNVERIFY'
          ? { verificationStatus: 'UNVERIFIED', verifiedAt: null }
          : action === 'SUSPEND'
            ? { status: 'SUSPENDED' }
            : action === 'REACTIVATE'
              ? { status: 'ACTIVE' }
              : { status: 'DEACTIVATED' };
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });
      if (action === 'SUSPEND' || action === 'DEACTIVATE') {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(
        {
          actorId: actor.userId,
          action: `USER_${action}`,
          targetType: 'User',
          targetId: id,
          metadata: note ? { note } : undefined,
          ipAddress: actor.ip,
        },
        tx,
      );
    });
    return this.user(id);
  }

  // ── Buying intents ──
  private intentToAdmin(
    i: Prisma.BuyingIntentGetPayload<{
      include: typeof intentInclude & { user: { select: typeof brief } };
    }>,
  ): AdminIntentDto {
    return { ...toIntent(i), user: i.user };
  }

  async intents(
    q: PageQuery & {
      q?: string;
      status?: string;
      carId?: string;
      cityId?: string;
      userId?: string;
    },
  ): Promise<Page<AdminIntentDto>> {
    const rows = await this.prisma.buyingIntent.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.carId ? { carId: q.carId } : {}),
        ...(q.cityId ? { cityId: q.cityId } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.q
          ? {
              OR: [
                { user: { email: { contains: q.q, mode: 'insensitive' } } },
                { user: { name: { contains: q.q, mode: 'insensitive' } } },
                { car: { displayName: { contains: q.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: { ...intentInclude, user: { select: brief } },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (r) => this.intentToAdmin(r));
  }

  async intent(id: string): Promise<AdminIntentDetailDto> {
    const i = await this.prisma.buyingIntent.findUnique({
      where: { id },
      include: {
        ...intentInclude,
        user: { select: brief },
        history: { orderBy: { changedAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!i) throw new NotFoundException('Buying post not found');
    return {
      ...this.intentToAdmin(i),
      history: i.history.map((h) => ({
        id: h.id,
        previousLevel: h.previousLevel,
        newLevel: h.newLevel,
        changedAt: h.changedAt.toISOString(),
        changedById: h.changedById,
      })),
      payments: i.payments.map(toPayment),
      passes: i.passes.map(toPass),
    };
  }

  async closeIntent(actor: Actor, id: string, note?: string): Promise<AdminIntentDetailDto> {
    const i = await this.prisma.buyingIntent.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Buying post not found');
    if (i.status === 'CLOSED' || i.status === 'EXPIRED')
      throw new BadRequestException('Already closed');
    await this.prisma.$transaction(async (tx) => {
      await tx.buyingIntent.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await this.audit.log(
        {
          actorId: actor.userId,
          action: 'INTENT_CLOSE',
          targetType: 'BuyingIntent',
          targetId: id,
          metadata: note ? { note } : undefined,
          ipAddress: actor.ip,
        },
        tx,
      );
    });
    return this.intent(id);
  }

  // ── Collectives ──
  async collectives(
    q: PageQuery & { q?: string; status?: string; carId?: string; cityId?: string },
  ): Promise<Page<AdminCollectiveDto>> {
    const rows = await this.prisma.collective.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.carId ? { carId: q.carId } : {}),
        ...(q.cityId ? { cityId: q.cityId } : {}),
        ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: {
        car: true,
        city: true,
        creator: { select: brief },
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const pending = new Map<string, number>();
    for (const r of rows)
      pending.set(
        r.id,
        await this.prisma.collectiveMembership.count({
          where: { collectiveId: r.id, status: 'PENDING_PAYMENT' },
        }),
      );
    return toPage(rows, q.limit, (r) => ({
      id: r.id,
      name: r.name,
      car: toCar(r.car),
      city: toCity(r.city),
      creator: r.creator,
      status: r.status,
      activeMemberCount: r._count.memberships,
      pendingMemberCount: pending.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
    }));
  }

  async collective(
    id: string,
  ): Promise<AdminCollectiveDto & { members: AdminCollectiveMemberDto[] }> {
    const r = await this.prisma.collective.findUnique({
      where: { id },
      include: {
        car: true,
        city: true,
        creator: { select: brief },
        memberships: {
          include: {
            user: { include: { profile: { include: { city: true } } } },
            buyingIntent: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!r) throw new NotFoundException('Collective not found');
    return {
      id: r.id,
      name: r.name,
      car: toCar(r.car),
      city: toCity(r.city),
      creator: r.creator,
      status: r.status,
      activeMemberCount: r.memberships.filter((m) => m.status === 'ACTIVE').length,
      pendingMemberCount: r.memberships.filter((m) => m.status === 'PENDING_PAYMENT').length,
      createdAt: r.createdAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      members: r.memberships.map((m) => ({
        membershipId: m.id,
        user: { ...toPublicUser(m.user), email: m.user.email },
        status: m.status,
        intentLevel: m.buyingIntent.intentLevel,
        purchaseTimeline: m.buyingIntent.purchaseTimeline,
        buyingIntentId: m.buyingIntentId,
        buyingPassId: m.buyingPassId,
        joinedAt: m.joinedAt?.toISOString() ?? null,
        leftAt: m.leftAt?.toISOString() ?? null,
      })),
    };
  }

  async collectiveAction(
    actor: Actor,
    id: string,
    action: 'CLOSE' | 'ARCHIVE' | 'REOPEN',
    note?: string,
  ) {
    const c = await this.prisma.collective.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Collective not found');
    const data: Prisma.CollectiveUpdateInput =
      action === 'CLOSE'
        ? { status: 'CLOSED', closedAt: new Date() }
        : action === 'ARCHIVE'
          ? { status: 'ARCHIVED', closedAt: c.closedAt ?? new Date() }
          : { status: 'ACTIVE', closedAt: null };
    await this.prisma.$transaction(async (tx) => {
      await tx.collective.update({ where: { id }, data });
      await this.audit.log(
        {
          actorId: actor.userId,
          action: `COLLECTIVE_${action}`,
          targetType: 'Collective',
          targetId: id,
          metadata: note ? { note } : undefined,
          ipAddress: actor.ip,
        },
        tx,
      );
    });
    return this.collective(id);
  }

  // ── Payments & passes ──
  async paymentsList(
    q: PageQuery & { q?: string; status?: string; userId?: string },
  ): Promise<Page<AdminPaymentDto>> {
    const rows = await this.prisma.payment.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.q
          ? {
              OR: [
                { providerOrderId: { contains: q.q } },
                { providerPaymentId: { contains: q.q } },
                { user: { email: { contains: q.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: { user: { select: brief }, buyingIntent: { include: { car: true, city: true } } },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (p) => ({
      ...toPayment(p),
      user: p.user,
      car: toCar(p.buyingIntent.car),
      city: toCity(p.buyingIntent.city),
      idempotencyKey: p.idempotencyKey,
      failureReason: p.failureReason,
      refundedAmount: p.refundedAmount,
      providerRefundId: p.providerRefundId,
    }));
  }

  async payment(id: string): Promise<AdminPaymentDto> {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: { user: { select: brief }, buyingIntent: { include: { car: true, city: true } } },
    });
    if (!p) throw new NotFoundException('Payment not found');
    return {
      ...toPayment(p),
      user: p.user,
      car: toCar(p.buyingIntent.car),
      city: toCity(p.buyingIntent.city),
      idempotencyKey: p.idempotencyKey,
      failureReason: p.failureReason,
      refundedAmount: p.refundedAmount,
      providerRefundId: p.providerRefundId,
    };
  }

  async refund(actor: Actor, id: string, amount?: number, note?: string): Promise<AdminPaymentDto> {
    await this.payments.refund(id, amount);
    await this.audit.log({
      actorId: actor.userId,
      action: 'PAYMENT_REFUND',
      targetType: 'Payment',
      targetId: id,
      metadata: { amount: amount ?? 'full', note: note ?? null },
      ipAddress: actor.ip,
    });
    return this.payment(id);
  }

  async passes(
    q: PageQuery & { q?: string; status?: string; plan?: 'FREE' | 'ELITE'; userId?: string },
  ): Promise<Page<AdminPassDto>> {
    const rows = await this.prisma.buyingPass.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.plan ? { plan: q.plan } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.q ? { user: { email: { contains: q.q, mode: 'insensitive' } } } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: { user: { select: brief }, buyingIntent: { include: { car: true, city: true } } },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (p) => ({
      ...toPass(p),
      user: p.user,
      car: toCar(p.buyingIntent.car),
      city: toCity(p.buyingIntent.city),
      paymentId: p.paymentId,
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  // ── Reports ──
  async reports(
    q: PageQuery & { status?: string; targetType?: string },
  ): Promise<Page<AdminReportDto>> {
    const rows = await this.prisma.report.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.targetType ? { targetType: q.targetType as never } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: { reporter: { select: brief }, reportedUser: { select: brief } },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const page = toPage(rows, q.limit, (r) => r);
    const items: AdminReportDto[] = [];
    for (const r of page.items) {
      items.push({
        ...toReport(r),
        reporter: r.reporter,
        reportedUser: r.reportedUser,
        targetPreview: await this.previewOf(r.targetType, r.targetId),
        resolvedById: r.resolvedById,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        resolutionNote: r.resolutionNote,
      });
    }
    return { items, nextCursor: page.nextCursor };
  }

  private async previewOf(type: string, id: string): Promise<string | null> {
    switch (type) {
      case 'MESSAGE':
        return (
          (
            await this.prisma.message.findUnique({ where: { id }, select: { content: true } })
          )?.content.slice(0, 200) ?? null
        );
      case 'SHARED_FILE':
        return (
          (await this.prisma.sharedFile.findUnique({ where: { id }, select: { title: true } }))
            ?.title ?? null
        );
      case 'POLL':
        return (
          (await this.prisma.poll.findUnique({ where: { id }, select: { question: true } }))
            ?.question ?? null
        );
      case 'COLLECTIVE':
        return (
          (await this.prisma.collective.findUnique({ where: { id }, select: { name: true } }))
            ?.name ?? null
        );
      default:
        return null;
    }
  }

  async reportAction(
    actor: Actor,
    id: string,
    action: 'REVIEW' | 'RESOLVE' | 'DISMISS',
    note?: string,
  ): Promise<void> {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Report not found');
    const status =
      action === 'REVIEW' ? 'UNDER_REVIEW' : action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED';
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: {
          status,
          ...(action !== 'REVIEW'
            ? { resolvedById: actor.userId, resolvedAt: new Date(), resolutionNote: note ?? null }
            : {}),
        },
      });
      await this.audit.log(
        {
          actorId: actor.userId,
          action: `REPORT_${action}`,
          targetType: 'Report',
          targetId: id,
          metadata: note ? { note } : undefined,
          ipAddress: actor.ip,
        },
        tx,
      );
    });
  }

  // ── Audit ──
  async auditLogs(
    q: PageQuery & { actorId?: string; action?: string; targetType?: string },
  ): Promise<Page<AuditLogDto>> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(q.actorId ? { actorId: q.actorId } : {}),
        ...(q.action ? { action: { contains: q.action } } : {}),
        ...(q.targetType ? { targetType: q.targetType } : {}),
        ...afterCursor(decodeCursor(q.cursor)),
      },
      include: { actor: { select: brief } },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (a) => ({
      id: a.id,
      actor: a.actor,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      metadata: (a.metadata as Record<string, unknown> | null) ?? null,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}

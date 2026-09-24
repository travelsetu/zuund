import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Time-driven state changes. Every job is idempotent and keyed on current
 * state (or a notification dedupe key), so running on two API instances at
 * once, which pm2 cluster mode does, is harmless.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * ACTIVE → EXPIRED once expiresAt passes; memberships riding on the pass expire with it.
   * The discussion's leftAt marks where the member's read-only history ends; nothing is
   * deleted, and the post stays ACTIVE so they can continue with Elite.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePasses(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.buyingPass.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, userId: true, buyingIntentId: true, plan: true },
    });
    for (const pass of due) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.buyingPass.updateMany({
          where: { id: pass.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });
        if (updated.count === 0) return; // another instance got here first
        const memberships = await tx.collectiveMembership.findMany({
          where: { buyingPassId: pass.id, status: 'ACTIVE' },
        });
        for (const m of memberships) {
          await tx.collectiveMembership.update({
            where: { id: m.id },
            data: { status: 'EXPIRED', leftAt: now },
          });
          const conv = await tx.conversation.findUnique({
            where: { collectiveId: m.collectiveId },
            select: { id: true },
          });
          if (conv)
            await tx.conversationMember.updateMany({
              where: { conversationId: conv.id, userId: m.userId, leftAt: null },
              data: { leftAt: now },
            });
        }
        await this.notifications.notify(
          {
            userId: pass.userId,
            type: 'PASS_EXPIRED',
            title: pass.plan === 'FREE' ? 'Your Free Pass has ended' : 'Your Elite Pass has ended',
            body:
              pass.plan === 'FREE'
                ? 'Your buying post and the room history are still here. Continue for 30 days with Elite.'
                : 'Your buying post and the room history are still here. Renew Elite to take part again.',
            data: { buyingPassId: pass.id, buyingIntentId: pass.buyingIntentId },
            dedupeKey: `pass-expired:${pass.id}`,
          },
          tx,
        );
        await this.audit.log(
          {
            actorId: pass.userId,
            actorType: 'SYSTEM',
            action: 'BUYING_PASS_EXPIRED',
            targetType: 'BuyingPass',
            targetId: pass.id,
            metadata: {
              buyingIntentId: pass.buyingIntentId,
              membershipsExpired: memberships.length,
            },
          },
          tx,
        );
      });
    }
    if (due.length) this.logger.log(`Expired ${due.length} buying pass(es)`);
  }

  /** "Expires in 5 days" and "expires tomorrow", each sent once per pass; Free ones offer Elite. */
  @Cron(CronExpression.EVERY_HOUR)
  async passExpiryWarnings(): Promise<void> {
    const now = Date.now();
    for (const days of [5, 1]) {
      const passes = await this.prisma.buyingPass.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date(now), lte: new Date(now + days * 86_400_000) },
        },
        select: { id: true, userId: true, buyingIntentId: true, expiresAt: true, plan: true },
      });
      for (const p of passes) {
        const name = p.plan === 'FREE' ? 'Free Pass' : 'Elite Pass';
        const when = days === 1 ? 'tomorrow' : `in ${days} days`;
        await this.notifications.notify({
          userId: p.userId,
          type: 'PASS_EXPIRING',
          title: `Your ${name} expires ${when}`,
          body:
            p.plan === 'FREE'
              ? `It ends on ${p.expiresAt?.toDateString()}. Continue for another 30 days with Elite: see Ready-to-Buy buyers, 30 connections and direct messages.`
              : `It ends on ${p.expiresAt?.toDateString()}. You can renew Elite once it ends.`,
          data: {
            buyingPassId: p.id,
            buyingIntentId: p.buyingIntentId,
            daysLeft: days,
            plan: p.plan,
          },
          dedupeKey: `pass-expiring:${p.id}:${days}`,
        });
      }
    }
  }

  /** Polls past expiresAt close themselves. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async closeExpiredPolls(): Promise<void> {
    const now = new Date();
    await this.prisma.poll.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'CLOSED', closedAt: now },
    });
  }
}

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

  /** ACTIVE → EXPIRED once expiresAt passes; memberships riding on the pass expire with it. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePasses(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.buyingPass.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, userId: true, buyingIntentId: true },
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
            title: 'Your Buying Pass has expired',
            body: 'Paid collective access for this buying post has ended. You can create a new post if you are still buying.',
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

  /** "Expires in 7 days" and "expires tomorrow", each sent once per pass. */
  @Cron(CronExpression.EVERY_HOUR)
  async passExpiryWarnings(): Promise<void> {
    const now = Date.now();
    const windows: Array<{ days: number; title: string; body: string }> = [
      {
        days: 7,
        title: 'Your Buying Pass expires in 7 days',
        body: 'Your paid collective access for this buying post ends in a week.',
      },
      {
        days: 1,
        title: 'Your Buying Pass expires tomorrow',
        body: 'Your paid collective access for this buying post ends tomorrow.',
      },
    ];
    for (const w of windows) {
      const passes = await this.prisma.buyingPass.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date(now), lte: new Date(now + w.days * 86_400_000) },
        },
        select: { id: true, userId: true, buyingIntentId: true, expiresAt: true },
      });
      for (const p of passes) {
        await this.notifications.notify({
          userId: p.userId,
          type: 'PASS_EXPIRING',
          title: w.title,
          body: `${w.body} It expires on ${p.expiresAt?.toDateString()}.`,
          data: { buyingPassId: p.id, buyingIntentId: p.buyingIntentId, daysLeft: w.days },
          dedupeKey: `pass-expiring:${p.id}:${w.days}`,
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

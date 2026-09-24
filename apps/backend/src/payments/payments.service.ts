import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import { ConfigService } from '@nestjs/config';
import type {
  BuyingPassDto,
  CreatePaymentRequest,
  Page,
  PageQuery,
  PaymentCheckoutDto,
  PaymentDto,
  VerifyPaymentRequest,
} from '@zuund/shared';
import { freePassUsed } from '../common/entitlements';
import { toPass, toPayment } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Env } from '../config/env';
import type { CollectiveMembership, Payment, Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type WebhookEvent,
} from './providers/payment-provider';

/**
 * The only code that moves money-related state. Nothing outside this service
 * sets a payment to SUCCESS, a pass to ACTIVE, or a membership to ACTIVE.
 *
 * Success has two entry points, checkout verification and the webhook, and
 * both land in `activate()`, which is idempotent: it looks at the current
 * state and does nothing if the work is already done.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly amount: number;
  private readonly eliteDays: number;
  private readonly freeDays: number;

  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    config: ConfigService<Env, true>,
  ) {
    this.amount = config.get('ELITE_PASS_AMOUNT', { infer: true });
    this.eliteDays = config.get('ELITE_PASS_DAYS', { infer: true });
    this.freeDays = config.get('FREE_PASS_DAYS', { infer: true });
  }

  // ── Create ──

  /**
   * Opens a payment for the Elite Pass. Elite is one pass per person, covering all their
   * Buying Posts and collectives: while one is active, paying (from any post) extends it
   * by ELITE_PASS_DAYS; otherwise it starts one, bought from this post, to join or to
   * upgrade from Free. The same idempotency key returns the same payment; an intent with
   * a live payment gets that payment back.
   */
  async create(userId: string, input: CreatePaymentRequest): Promise<PaymentCheckoutDto> {
    const existingByKey = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingByKey) {
      if (existingByKey.userId !== userId) throw new ForbiddenException();
      if (existingByKey.status === 'SUCCESS') throw E.PAYMENT_ALREADY_SUCCEEDED();
      return this.checkoutFor(existingByKey);
    }

    const intent = await this.prisma.buyingIntent.findUnique({
      where: { id: input.buyingIntentId },
    });
    if (!intent) throw new NotFoundException('Buying post not found');
    if (intent.userId !== userId) throw new ForbiddenException('Not your buying post');
    if (intent.status !== 'ACTIVE') throw E.POST_NOT_ACTIVE();

    // The person's active Elite Pass, on whichever post it was bought from: extended.
    const elite = await this.prisma.buyingPass.findFirst({
      where: { userId, plan: 'ELITE', status: 'ACTIVE', expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
    });
    if (!elite) {
      const membership = await this.prisma.collectiveMembership.findFirst({
        where: {
          collectiveId: input.collectiveId,
          userId,
          buyingIntentId: intent.id,
          status: { in: ['PENDING_PAYMENT', 'ACTIVE'] },
        },
      });
      if (!membership) throw E.JOIN_FIRST();
    }

    // Another open payment for the same intent: hand it back rather than start a second one.
    const open = await this.prisma.payment.findFirst({
      where: { buyingIntentId: intent.id, status: { in: ['INITIATED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (open) return this.checkoutFor(open);

    const pass =
      elite ??
      (await this.prisma.buyingPass.findFirst({
        where: { buyingIntentId: intent.id, status: 'PENDING' },
      })) ??
      (await this.prisma.buyingPass.create({
        data: {
          buyingIntentId: intent.id,
          userId,
          plan: 'ELITE',
          amount: this.amount,
          currency: 'INR',
          status: 'PENDING',
        },
      }));

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        buyingIntentId: intent.id,
        buyingPassId: pass.id,
        amount: this.amount,
        currency: 'INR',
        provider: this.provider.name,
        status: 'INITIATED',
        idempotencyKey: input.idempotencyKey,
      },
    });
    const order = await this.provider.createOrder({
      paymentId: payment.id,
      amount: this.amount,
      currency: 'INR',
      notes: { buyingIntentId: intent.id, userId },
    });
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerOrderId: order.providerOrderId, status: 'PENDING' },
    });
    this.logger.log(
      `Payment ${payment.id} initiated for intent ${intent.id} (${this.provider.name} order ${order.providerOrderId})`,
    );
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'PAYMENT_INITIATED',
      targetType: 'Payment',
      targetId: payment.id,
      metadata: { buyingIntentId: intent.id, amount: this.amount },
    });
    return { payment: toPayment(updated), provider: this.provider.name, checkout: order.checkout };
  }

  private async checkoutFor(p: Payment): Promise<PaymentCheckoutDto> {
    if (!p.providerOrderId) {
      const order = await this.provider.createOrder({
        paymentId: p.id,
        amount: p.amount,
        currency: p.currency,
      });
      p = await this.prisma.payment.update({
        where: { id: p.id },
        data: { providerOrderId: order.providerOrderId, status: 'PENDING' },
      });
      return { payment: toPayment(p), provider: this.provider.name, checkout: order.checkout };
    }
    const checkout: Record<string, string> = { orderId: p.providerOrderId };
    if (this.provider.name === 'razorpay') checkout.key = process.env.RAZORPAY_KEY_ID ?? '';
    return { payment: toPayment(p), provider: this.provider.name, checkout };
  }

  // ── Success paths ──

  /** Checkout callback: the client relays the provider's ids and signature; we verify, never trust. */
  async verify(userId: string, input: VerifyPaymentRequest): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== userId) throw new ForbiddenException();
    if (payment.providerOrderId !== input.providerOrderId) throw E.PAYMENT_ORDER_MISMATCH();
    if (
      !this.provider.verifyCheckoutSignature(
        input.providerOrderId,
        input.providerPaymentId,
        input.providerSignature,
      )
    ) {
      this.logger.warn(`Payment ${payment.id}: checkout signature did not verify (user ${userId})`);
      throw E.PAYMENT_VERIFICATION_FAILED();
    }
    await this.activate(payment.id, input.providerPaymentId);
    return toPayment(await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }));
  }

  /** Webhook: verified by the provider adapter, recorded once per event id, then applied. */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const event: WebhookEvent = this.provider.parseWebhook(rawBody, headers);
    this.logger.log(
      `Webhook ${event.eventType} (${event.providerEventId}) from ${this.provider.name}`,
    );
    const record = await this.prisma.paymentWebhookEvent
      .create({
        data: {
          provider: this.provider.name,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
        },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') return null; // already received
        throw e;
      });
    if (!record) {
      this.logger.log(`Webhook ${event.providerEventId} already processed; ignoring redelivery`);
      return;
    }
    try {
      await this.applyOutcome(event);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { error: String(err).slice(0, 500) },
      });
      throw err;
    }
  }

  private async applyOutcome(event: WebhookEvent) {
    const o = event.outcome;
    if (o.kind === 'IGNORED') return;
    if (o.kind === 'PAYMENT_SUCCESS') {
      const payment = await this.prisma.payment.findUnique({
        where: { providerOrderId: o.providerOrderId },
      });
      if (!payment) return this.logger.warn(`Webhook for unknown order ${o.providerOrderId}`);
      if (o.amount !== payment.amount) {
        this.logger.error(
          `Amount mismatch on ${payment.id}: expected ${payment.amount}, provider says ${o.amount}`,
        );
        return;
      }
      await this.activate(payment.id, o.providerPaymentId);
    } else if (o.kind === 'PAYMENT_FAILED') {
      const payment = await this.prisma.payment.findUnique({
        where: { providerOrderId: o.providerOrderId },
      });
      if (!payment || payment.status === 'SUCCESS') return;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: o.reason,
          providerPaymentId: o.providerPaymentId ?? undefined,
        },
      });
      this.logger.warn(`Payment ${payment.id} FAILED: ${o.reason ?? 'no reason given'}`);
      await this.audit.log({
        actorId: payment.userId,
        actorType: 'SYSTEM',
        action: 'PAYMENT_FAILED',
        targetType: 'Payment',
        targetId: payment.id,
        metadata: { reason: o.reason },
      });
      await this.notifications.notify({
        userId: payment.userId,
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        body: `Your ₹${payment.amount / 100} Elite Pass payment did not go through. You can try again.`,
        data: { paymentId: payment.id },
        dedupeKey: `payfail:${payment.id}`,
      });
    } else if (o.kind === 'REFUNDED') {
      const payment = await this.prisma.payment.findUnique({
        where: { providerPaymentId: o.providerPaymentId },
      });
      if (!payment) return;
      await this.markRefunded(payment.id, o.providerRefundId, o.amount);
    }
  }

  /**
   * The one transaction that grants Elite access. Safe to call twice: every
   * step checks current state first. An active Free Pass on the same post ends
   * here, and Elite runs ELITE_PASS_DAYS from now.
   */
  async activate(paymentId: string, providerPaymentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lock the payment row: checkout verification and the webhook can arrive
      // at the same moment, and only one of them may do the activation.
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status === 'SUCCESS') return;
      if (payment.status === 'REFUNDED') return;

      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCESS', providerPaymentId },
      });

      let pass = payment.buyingPassId
        ? await tx.buyingPass.findUnique({ where: { id: payment.buyingPassId } })
        : null;
      if (!pass) {
        pass = await tx.buyingPass.create({
          data: {
            buyingIntentId: payment.buyingIntentId,
            userId: payment.userId,
            plan: 'ELITE',
            amount: payment.amount,
            currency: payment.currency,
            status: 'PENDING',
          },
        });
        await tx.payment.update({ where: { id: paymentId }, data: { buyingPassId: pass.id } });
      }
      const extending =
        pass.status === 'ACTIVE' && pass.plan === 'ELITE' && pass.paymentId !== paymentId;
      if (extending) {
        // Extension: the same pass runs ELITE_PASS_DAYS longer; limits and credits carry on.
        const from = Math.max(pass.expiresAt?.getTime() ?? 0, now.getTime());
        pass = await tx.buyingPass.update({
          where: { id: pass.id },
          data: { expiresAt: new Date(from + this.eliteDays * 86_400_000) },
        });
        this.logger.log(`Elite Pass ${pass.id} extended to ${pass.expiresAt?.toISOString()}`);
      } else if (pass.status !== 'ACTIVE') {
        // Elite covers everything: the person's Free Passes end now (Elite outlasts them).
        const upgraded = await tx.buyingPass.updateMany({
          where: {
            userId: payment.userId,
            status: 'ACTIVE',
            plan: 'FREE',
            id: { not: pass.id },
          },
          data: { status: 'EXPIRED', expiresAt: now },
        });
        if (upgraded.count)
          this.logger.log(`${upgraded.count} Free Pass(es) of ${payment.userId} upgraded to Elite`);
        const expiresAt = new Date(now.getTime() + this.eliteDays * 86_400_000);
        pass = await tx.buyingPass.update({
          where: { id: pass.id },
          data: { plan: 'ELITE', status: 'ACTIVE', activatedAt: now, expiresAt, paymentId },
        });
      }

      // Every collective the person is in (or waiting to join) now rides on the Elite Pass.
      const live = await tx.collectiveMembership.findMany({
        where: { userId: payment.userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
      });
      for (const m of live) {
        if (m.status === 'ACTIVE' && m.buyingPassId === pass.id) continue;
        await tx.collectiveMembership.update({
          where: { id: m.id },
          data: {
            status: 'ACTIVE',
            buyingPassId: pass.id,
            ...(m.status === 'ACTIVE' ? {} : { joinedAt: now }),
          },
        });
        const conv = await tx.conversation.findUnique({
          where: { collectiveId: m.collectiveId },
          select: { id: true },
        });
        if (conv)
          await tx.conversationMember.upsert({
            where: { conversationId_userId: { conversationId: conv.id, userId: payment.userId } },
            create: { conversationId: conv.id, userId: payment.userId },
            update: { leftAt: null },
          });
      }
      const membership = live.find((m) => m.buyingIntentId === payment.buyingIntentId) ?? null;
      if (membership) {
        await this.notifications.notify(
          {
            userId: payment.userId,
            type: 'COLLECTIVE_MEMBERSHIP',
            title: 'You are in',
            body: 'Your collective membership is now active.',
            data: { collectiveId: membership.collectiveId },
            dedupeKey: `member:${membership.id}`,
          },
          tx,
        );
      }
      await this.notifications.notify(
        {
          userId: payment.userId,
          type: 'PAYMENT_SUCCESS',
          title: 'Elite Pass activated',
          body: `Your ₹${payment.amount / 100} Elite Pass is active until ${pass.expiresAt?.toDateString()}.`,
          data: { paymentId, buyingPassId: pass.id },
          dedupeKey: `paysuccess:${paymentId}`,
        },
        tx,
      );
      this.logger.log(
        `Payment ${paymentId} SUCCESS; pass ${pass.id} ACTIVE until ${pass.expiresAt?.toISOString()}`,
      );
      await this.audit.log(
        {
          actorId: payment.userId,
          actorType: 'SYSTEM',
          action: 'PAYMENT_SUCCEEDED',
          targetType: 'Payment',
          targetId: paymentId,
          metadata: { providerPaymentId },
        },
        tx,
      );
      await this.audit.log(
        {
          actorId: payment.userId,
          actorType: 'SYSTEM',
          action: 'BUYING_PASS_ACTIVATED',
          targetType: 'BuyingPass',
          targetId: pass.id,
          metadata: {
            buyingIntentId: payment.buyingIntentId,
            expiresAt: pass.expiresAt?.toISOString() ?? null,
          },
        },
        tx,
      );
      if (membership)
        await this.audit.log(
          {
            actorId: payment.userId,
            actorType: 'SYSTEM',
            action: 'MEMBERSHIP_ACTIVATED',
            targetType: 'CollectiveMembership',
            targetId: membership.id,
            metadata: { collectiveId: membership.collectiveId },
          },
          tx,
        );
    });
  }

  // ── Joining ──

  /**
   * Joining while the person holds an active Elite Pass: the membership is active at once
   * and rides on it (ending with it). No Free Pass is used and nothing is charged.
   */
  async joinWithElite(userId: string, membershipId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.collectiveMembership.findUnique({ where: { id: membershipId } });
      if (!membership || membership.userId !== userId || membership.status !== 'PENDING_PAYMENT')
        return false;
      const elite = await tx.buyingPass.findFirst({
        where: { userId, plan: 'ELITE', status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
      });
      if (!elite) return false;
      const now = new Date();
      await tx.collectiveMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', joinedAt: now, buyingPassId: elite.id },
      });
      const conv = await tx.conversation.findUnique({
        where: { collectiveId: membership.collectiveId },
        select: { id: true },
      });
      if (conv)
        await tx.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId } },
          create: { conversationId: conv.id, userId },
          update: { leftAt: null },
        });
      await this.notifications.notify(
        {
          userId,
          type: 'COLLECTIVE_MEMBERSHIP',
          title: 'You are in',
          body: `Joined with your Elite Pass, active until ${elite.expiresAt?.toDateString()}.`,
          data: {
            collectiveId: membership.collectiveId,
            buyingIntentId: membership.buyingIntentId,
          },
          dedupeKey: `member:${membership.id}`,
        },
        tx,
      );
      await this.audit.log(
        {
          actorId: userId,
          actorType: 'SYSTEM',
          action: 'MEMBERSHIP_ACTIVATED',
          targetType: 'CollectiveMembership',
          targetId: membership.id,
          metadata: { collectiveId: membership.collectiveId, elite: elite.id },
        },
        tx,
      );
      return true;
    });
  }

  // ── Free Pass ──

  /**
   * "Join free": a ₹0 Free Pass for FREE_PASS_DAYS with no Payment row. Each user gets
   * one per car+city, ever — closing a post and posting the same car+city again does
   * not bring a second one.
   *
   * Returns false (and changes nothing) when the Free Pass was already used, the
   * membership is not pending, or the post already has a pass or a payment in flight.
   */
  async startFreePass(userId: string, membershipId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.collectiveMembership.findUnique({ where: { id: membershipId } });
      if (!membership || membership.userId !== userId || membership.status !== 'PENDING_PAYMENT')
        return false;
      const intent = await tx.buyingIntent.findUnique({ where: { id: membership.buyingIntentId } });
      if (!intent || intent.status !== 'ACTIVE') return false;
      // Serialise per user so two joins at once cannot both start a Free Pass.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      if (await freePassUsed(tx, userId, intent.carId, intent.cityId)) return false;
      const [activePass, openPayment] = await Promise.all([
        tx.buyingPass.findFirst({ where: { buyingIntentId: intent.id, status: 'ACTIVE' } }),
        tx.payment.findFirst({
          where: { buyingIntentId: intent.id, status: { in: ['INITIATED', 'PENDING'] } },
        }),
      ]);
      if (activePass || openPayment) return false;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.freeDays * 86_400_000);
      const pass = await tx.buyingPass.create({
        data: {
          buyingIntentId: intent.id,
          userId,
          plan: 'FREE',
          amount: 0,
          currency: 'INR',
          status: 'ACTIVE',
          activatedAt: now,
          expiresAt,
        },
      });
      await tx.collectiveMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', joinedAt: now, buyingPassId: pass.id },
      });
      const conv = await tx.conversation.findUnique({
        where: { collectiveId: membership.collectiveId },
        select: { id: true },
      });
      if (conv) {
        await tx.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId } },
          create: { conversationId: conv.id, userId },
          update: { leftAt: null },
        });
      }
      await this.notifications.notify(
        {
          userId,
          type: 'COLLECTIVE_MEMBERSHIP',
          title: 'You are in, free',
          body: `Your Free Pass is active until ${expiresAt.toDateString()}.`,
          data: { collectiveId: membership.collectiveId, buyingIntentId: intent.id },
          dedupeKey: `member:${membership.id}`,
        },
        tx,
      );
      this.logger.log(
        `Free Pass ${pass.id} for intent ${intent.id} ACTIVE until ${expiresAt.toISOString()}`,
      );
      await this.audit.log(
        {
          actorId: userId,
          actorType: 'SYSTEM',
          action: 'BUYING_PASS_ACTIVATED',
          targetType: 'BuyingPass',
          targetId: pass.id,
          metadata: { buyingIntentId: intent.id, plan: 'FREE', expiresAt: expiresAt.toISOString() },
        },
        tx,
      );
      await this.audit.log(
        {
          actorId: userId,
          actorType: 'SYSTEM',
          action: 'MEMBERSHIP_ACTIVATED',
          targetType: 'CollectiveMembership',
          targetId: membership.id,
          metadata: { collectiveId: membership.collectiveId, free: true },
        },
        tx,
      );
      return true;
    });
  }

  // ── Refunds ──

  /** Admin-initiated refund through the provider, then the same bookkeeping the webhook does. */
  async refund(paymentId: string, amount?: number): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCESS' || !payment.providerPaymentId)
      throw E.REFUND_NOT_ALLOWED('Only a successful payment can be refunded');
    const amt = amount ?? payment.amount;
    if (amt > payment.amount) throw E.REFUND_NOT_ALLOWED('Refund exceeds the payment');
    const { providerRefundId } = await this.provider.refund(payment.providerPaymentId, amt);
    await this.markRefunded(paymentId, providerRefundId, amt);
    return toPayment(await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }));
  }

  private async markRefunded(paymentId: string, providerRefundId: string, amount: number) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status === 'REFUNDED') return;
      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED', refundedAmount: amount, providerRefundId },
      });
      this.logger.log(`Payment ${paymentId} REFUNDED ${amount} (${providerRefundId})`);
      await this.audit.log(
        {
          actorId: payment.userId,
          actorType: 'SYSTEM',
          action: 'PAYMENT_REFUNDED',
          targetType: 'Payment',
          targetId: paymentId,
          metadata: { amount, providerRefundId },
        },
        tx,
      );
      const pass = payment.buyingPassId
        ? await tx.buyingPass.findUnique({ where: { id: payment.buyingPassId } })
        : null;
      if (pass && pass.paymentId && pass.paymentId !== paymentId) {
        // An extension payment: take its days back off the pass, which otherwise stands.
        if (pass.status === 'ACTIVE' && pass.expiresAt)
          await tx.buyingPass.update({
            where: { id: pass.id },
            data: {
              expiresAt: new Date(
                Math.max(now.getTime(), pass.expiresAt.getTime() - this.eliteDays * 86_400_000),
              ),
            },
          });
      } else if (payment.buyingPassId) {
        await tx.buyingPass.updateMany({
          where: { id: payment.buyingPassId, status: { in: ['ACTIVE', 'PENDING'] } },
          data: { status: 'REFUNDED' },
        });
        const memberships = await tx.collectiveMembership.findMany({
          where: { buyingPassId: payment.buyingPassId, status: 'ACTIVE' },
        });
        for (const m of memberships) {
          await tx.collectiveMembership.update({
            where: { id: m.id },
            data: { status: 'REFUNDED', leftAt: now },
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
      }
    });
  }

  /** Called after a member leaves; what happens to the money is the configured policy, nothing more. */
  async applyLeavePolicy(membership: CollectiveMembership, policy: 'NONE' | 'FULL'): Promise<void> {
    if (policy !== 'FULL' || !membership.buyingPassId) return;
    // Elite covers all of the person's collectives: leaving one refunds nothing while
    // others still ride on it.
    const others = await this.prisma.collectiveMembership.count({
      where: {
        buyingPassId: membership.buyingPassId,
        status: 'ACTIVE',
        id: { not: membership.id },
      },
    });
    if (others) return;
    const payment = await this.prisma.payment.findFirst({
      where: { buyingPassId: membership.buyingPassId, status: 'SUCCESS' },
    });
    if (payment) await this.refund(payment.id);
  }

  // ── Reads ──

  async listMine(userId: string, q: PageQuery): Promise<Page<PaymentDto>> {
    const rows = await this.prisma.payment.findMany({
      where: { userId, ...afterCursor(decodeCursor(q.cursor)) },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, toPayment);
  }

  async getMine(userId: string, id: string): Promise<PaymentDto> {
    const p = await this.prisma.payment.findUnique({ where: { id } });
    if (!p || p.userId !== userId) throw new NotFoundException('Payment not found');
    return toPayment(p);
  }

  async listMyPasses(userId: string, q: PageQuery): Promise<Page<BuyingPassDto>> {
    const rows = await this.prisma.buyingPass.findMany({
      where: { userId, ...afterCursor(decodeCursor(q.cursor)) },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, toPass);
  }

  async getMyPass(userId: string, id: string): Promise<BuyingPassDto> {
    const p = await this.prisma.buyingPass.findUnique({ where: { id } });
    if (!p || p.userId !== userId) throw new NotFoundException('Buying Pass not found');
    return toPass(p);
  }
}

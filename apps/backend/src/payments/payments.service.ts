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
import { toPass, toPayment } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Env } from '../config/env';
import type { CollectiveMembership, Payment, Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { freePlaceHolders } from '../common/free-places';
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
  private readonly validityDays: number;
  private readonly freeMembers: number;

  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    config: ConfigService<Env, true>,
  ) {
    this.amount = config.get('BUYING_PASS_AMOUNT', { infer: true });
    this.validityDays = config.get('BUYING_PASS_VALIDITY_DAYS', { infer: true });
    this.freeMembers = config.get('FREE_MEMBERS_PER_COLLECTIVE', { infer: true });
  }

  // ── Create ──

  /**
   * Opens a payment for the ₹500 pass on one buying intent. The same
   * idempotency key returns the same payment; a second key for an intent
   * that already has a live payment or an active pass is refused.
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

    const membership = await this.prisma.collectiveMembership.findFirst({
      where: {
        collectiveId: input.collectiveId,
        userId,
        buyingIntentId: intent.id,
        status: { in: ['PENDING_PAYMENT', 'ACTIVE'] },
      },
    });
    if (!membership) throw E.JOIN_FIRST();
    if (membership.status === 'ACTIVE') throw E.PASS_ALREADY_ACTIVE();
    // A free place may still be open (e.g. a stale pay screen): never charge for it.
    if (await this.claimFreePlace(userId, membership.id)) throw E.PASS_ALREADY_ACTIVE();

    const activePass = await this.prisma.buyingPass.findFirst({
      where: { buyingIntentId: intent.id, status: 'ACTIVE' },
    });
    if (activePass) throw E.PASS_ALREADY_ACTIVE();

    // Another open payment for the same intent: hand it back rather than start a second one.
    const open = await this.prisma.payment.findFirst({
      where: { buyingIntentId: intent.id, status: { in: ['INITIATED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (open) return this.checkoutFor(open);

    const pass =
      (await this.prisma.buyingPass.findFirst({
        where: { buyingIntentId: intent.id, status: 'PENDING' },
      })) ??
      (await this.prisma.buyingPass.create({
        data: {
          buyingIntentId: intent.id,
          userId,
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
        body: 'Your ₹500 Buying Pass payment did not go through. You can try again.',
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
   * The one transaction that grants paid access. Safe to call twice: every
   * step checks current state first.
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
            amount: payment.amount,
            currency: payment.currency,
            status: 'PENDING',
          },
        });
        await tx.payment.update({ where: { id: paymentId }, data: { buyingPassId: pass.id } });
      }
      if (pass.status !== 'ACTIVE') {
        const expiresAt = new Date(now.getTime() + this.validityDays * 86_400_000);
        pass = await tx.buyingPass.update({
          where: { id: pass.id },
          data: { status: 'ACTIVE', activatedAt: now, expiresAt, paymentId },
        });
      }

      const membership = await tx.collectiveMembership.findFirst({
        where: {
          buyingIntentId: payment.buyingIntentId,
          userId: payment.userId,
          status: { in: ['PENDING_PAYMENT', 'ACTIVE'] },
        },
      });
      if (membership && membership.status !== 'ACTIVE') {
        await tx.collectiveMembership.update({
          where: { id: membership.id },
          data: { status: 'ACTIVE', joinedAt: now, buyingPassId: pass.id },
        });
      }
      if (membership) {
        const conv = await tx.conversation.findUnique({
          where: { collectiveId: membership.collectiveId },
          select: { id: true },
        });
        if (conv) {
          await tx.conversationMember.upsert({
            where: { conversationId_userId: { conversationId: conv.id, userId: payment.userId } },
            create: { conversationId: conv.id, userId: payment.userId },
            update: { leftAt: null },
          });
        }
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
          title: 'Buying Pass activated',
          body: `Your ₹${payment.amount / 100} Buying Pass is active until ${pass.expiresAt?.toDateString()}.`,
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

  // ── Free places ──

  /**
   * Each collective has FREE_MEMBERS_PER_COLLECTIVE free places, held by current
   * members who joined free. When one leaves (or their pass expires) the place opens
   * again for the next person to join. The member gets a ₹0 pass with the normal
   * validity and no Payment row.
   *
   * Returns false (and changes nothing) when no place is left, the membership
   * is not pending, or the post already has a payment in flight — someone
   * mid-checkout finishes that payment rather than getting a free place.
   */
  async claimFreePlace(userId: string, membershipId: string): Promise<boolean> {
    if (this.freeMembers <= 0) return false;
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.collectiveMembership.findUnique({ where: { id: membershipId } });
      if (!membership || membership.userId !== userId || membership.status !== 'PENDING_PAYMENT')
        return false;
      // Serialise claims per collective so two joins cannot both take the last place.
      await tx.$queryRaw`SELECT id FROM collectives WHERE id = ${membership.collectiveId} FOR UPDATE`;
      const taken = await tx.collectiveMembership.count({
        where: freePlaceHolders(membership.collectiveId),
      });
      if (taken >= this.freeMembers) return false;

      const intent = await tx.buyingIntent.findUnique({ where: { id: membership.buyingIntentId } });
      if (!intent || intent.status !== 'ACTIVE') return false;
      const [activePass, openPayment] = await Promise.all([
        tx.buyingPass.findFirst({ where: { buyingIntentId: intent.id, status: 'ACTIVE' } }),
        tx.payment.findFirst({
          where: { buyingIntentId: intent.id, status: { in: ['INITIATED', 'PENDING'] } },
        }),
      ]);
      if (activePass || openPayment) return false;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.validityDays * 86_400_000);
      // Reuse a pending ₹500 pass shell if one exists, so the post keeps a single pass.
      const pending = await tx.buyingPass.findFirst({
        where: { buyingIntentId: intent.id, status: 'PENDING' },
      });
      const pass = pending
        ? await tx.buyingPass.update({
            where: { id: pending.id },
            data: { amount: 0, status: 'ACTIVE', activatedAt: now, expiresAt },
          })
        : await tx.buyingPass.create({
            data: {
              buyingIntentId: intent.id,
              userId,
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
          body: `You got one of the collective's ${this.freeMembers} free places. Your Buying Pass is active until ${expiresAt.toDateString()}.`,
          data: { collectiveId: membership.collectiveId, buyingIntentId: intent.id },
          dedupeKey: `member:${membership.id}`,
        },
        tx,
      );
      this.logger.log(
        `Free place ${taken + 1}/${this.freeMembers} in collective ${membership.collectiveId}: pass ${pass.id} ACTIVE until ${expiresAt.toISOString()}`,
      );
      await this.audit.log(
        {
          actorId: userId,
          actorType: 'SYSTEM',
          action: 'BUYING_PASS_ACTIVATED',
          targetType: 'BuyingPass',
          targetId: pass.id,
          metadata: {
            buyingIntentId: intent.id,
            free: true,
            place: taken + 1,
            expiresAt: expiresAt.toISOString(),
          },
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
      if (payment.buyingPassId) {
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

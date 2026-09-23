import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PaymentsService } from '../src/payments/payments.service';
import type { WebhookEvent } from '../src/payments/providers/payment-provider';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
  db,
  joinCollective,
  mockVerifyBody,
  registerUser,
  setup,
  startPayment,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('payments', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let postId: string;
  let collectiveId: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    postId = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
    collectiveId = (await joinCollective(rahul.agent, postId)).id;
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('refuses to pay for a post that has left the collective', async () => {
    const loner = await registerUser(ctx, 'Loner');
    const p = await createPost(loner.agent, ctx.creta, ctx.ahmedabad);
    await loner.agent.post(`/api/collectives/${collectiveId}/leave`).expect(204);
    const res = await loner.agent
      .post('/api/payments')
      .send({ buyingIntentId: p.id, collectiveId, idempotencyKey: `k-${randomUUID()}` });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JOIN_FIRST');
  });

  it('creates a PENDING ₹500 payment tied to the post, with a provider order', async () => {
    const res = await startPayment(rahul.agent, postId, collectiveId);
    expect(res.payment).toMatchObject({ status: 'PENDING', amount: 50000, buyingIntentId: postId });
    expect(res.provider).toBe('mock');
    expect(res.checkout.orderId).toMatch(/^mock_order_/);
    const row = await db.payment.findUniqueOrThrow({ where: { id: res.payment.id } });
    expect(row.currency).toBe('INR');
    expect(row.buyingPassId).toBeTruthy();
    expect(
      (await db.buyingPass.findUniqueOrThrow({ where: { id: row.buyingPassId! } })).status,
    ).toBe('PENDING');
  });

  it('the same idempotency key returns the same payment; a new key while one is open reuses it', async () => {
    const key = `k-${randomUUID()}`;
    const first = await startPayment(rahul.agent, postId, collectiveId, key);
    const same = await startPayment(rahul.agent, postId, collectiveId, key);
    expect(same.payment.id).toBe(first.payment.id);
    const other = await startPayment(rahul.agent, postId, collectiveId, `k-${randomUUID()}`);
    expect(other.payment.id).toBe(first.payment.id);
    expect(
      await db.payment.count({
        where: { buyingIntentId: postId, status: { in: ['INITIATED', 'PENDING'] } },
      }),
    ).toBe(1);
  });

  it('rejects a bad signature, a mismatched order, and another user', async () => {
    const open = await startPayment(rahul.agent, postId, collectiveId);
    const bad = await rahul.agent
      .post('/api/payments/verify')
      .send({ ...mockVerifyBody(open), providerSignature: 'forged' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('PAYMENT_VERIFICATION_FAILED');
    const mismatch = await rahul.agent
      .post('/api/payments/verify')
      .send({ ...mockVerifyBody(open), providerOrderId: 'mock_order_other' });
    expect(mismatch.body.error.code).toBe('PAYMENT_ORDER_MISMATCH');
    const stranger = await registerUser(ctx, 'Stranger');
    expect(
      (await stranger.agent.post('/api/payments/verify').send(mockVerifyBody(open))).status,
    ).toBe(403);
    expect((await db.payment.findUniqueOrThrow({ where: { id: open.payment.id } })).status).toBe(
      'PENDING',
    );
    expect(await db.buyingPass.count({ where: { buyingIntentId: postId, status: 'ACTIVE' } })).toBe(
      0,
    );
  });

  it('two simultaneous verifications activate exactly one pass and one membership', async () => {
    const open = await startPayment(rahul.agent, postId, collectiveId);
    const body = mockVerifyBody(open);
    const [a, b] = await Promise.all([
      rahul.agent.post('/api/payments/verify').send(body),
      rahul.agent.post('/api/payments/verify').send(body),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.status).toBe('SUCCESS');
    expect(await db.buyingPass.count({ where: { buyingIntentId: postId, status: 'ACTIVE' } })).toBe(
      1,
    );
    expect(
      await db.collectiveMembership.count({ where: { buyingIntentId: postId, status: 'ACTIVE' } }),
    ).toBe(1);
    expect(await db.payment.count({ where: { buyingIntentId: postId, status: 'SUCCESS' } })).toBe(
      1,
    );
    const notes = await db.notification.findMany({
      where: { userId: rahul.id, type: 'PAYMENT_SUCCESS' },
    });
    expect(notes).toHaveLength(1);
  });

  it('a verified payment is idempotent and a further payment for the post is refused', async () => {
    const payment = await db.payment.findFirstOrThrow({
      where: { buyingIntentId: postId, status: 'SUCCESS' },
    });
    const again = await rahul.agent.post('/api/payments/verify').send({
      paymentId: payment.id,
      providerOrderId: payment.providerOrderId!,
      providerPaymentId: payment.providerPaymentId!,
      providerSignature: `mock:${payment.providerOrderId}`,
    });
    expect(again.status).toBe(201);
    expect(again.body.status).toBe('SUCCESS');
    const more = await rahul.agent
      .post('/api/payments')
      .send({ buyingIntentId: postId, collectiveId, idempotencyKey: `k-${randomUUID()}` });
    expect(more.status).toBe(409);
    expect(more.body.error.code).toBe('PASS_ALREADY_ACTIVE');
    const sameKey = await rahul.agent
      .post('/api/payments')
      .send({ buyingIntentId: postId, collectiveId, idempotencyKey: payment.idempotencyKey });
    expect(sameKey.body.error.code).toBe('PAYMENT_ALREADY_SUCCEEDED');
  });

  describe('webhook', () => {
    let priya: TestUser;
    let priyaPost: string;
    let open: Awaited<ReturnType<typeof startPayment>>;
    beforeAll(async () => {
      priya = await registerUser(ctx, 'Priya');
      priyaPost = (await createPost(priya.agent, ctx.creta, ctx.ahmedabad)).id;
      await priya.agent
        .post(`/api/collectives/${collectiveId}/join`)
        .send({ buyingIntentId: priyaPost });
      open = await startPayment(priya.agent, priyaPost, collectiveId);
    });
    const hook = (body: Record<string, unknown>) =>
      request(ctx.server).post('/api/payments/webhook').send(body);

    it('an amount mismatch does not activate anything', async () => {
      const res = await hook({
        eventId: `evt-${randomUUID()}`,
        event: 'payment.captured',
        orderId: open.checkout.orderId,
        paymentId: 'mock_pay_wrong',
        amount: 100,
      });
      expect(res.status).toBe(200);
      expect((await db.payment.findUniqueOrThrow({ where: { id: open.payment.id } })).status).toBe(
        'PENDING',
      );
    });

    it('payment.failed marks the payment FAILED, notifies, and leaves the pass PENDING', async () => {
      // The mock adapter only emits captured events, so drive the provider-agnostic
      // outcome handler with what the Razorpay adapter would have produced.
      const svc = ctx.app.get(PaymentsService) as unknown as {
        applyOutcome: (e: WebhookEvent) => Promise<void>;
      };
      await svc.applyOutcome({
        providerEventId: `evt-${randomUUID()}`,
        eventType: 'payment.failed',
        outcome: {
          kind: 'PAYMENT_FAILED',
          providerOrderId: open.checkout.orderId,
          providerPaymentId: 'mock_pay_declined',
          reason: 'card declined',
        },
        payload: {},
      });
      const failed = await db.payment.findUniqueOrThrow({ where: { id: open.payment.id } });
      expect(failed.status).toBe('FAILED');
      expect(failed.failureReason).toBe('card declined');
      expect(
        (await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: priyaPost } })).status,
      ).toBe('PENDING');
      expect(
        (await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: priyaPost } }))
          .status,
      ).toBe('PENDING_PAYMENT');
      expect(
        await db.notification.count({ where: { userId: priya.id, type: 'PAYMENT_FAILED' } }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { action: 'PAYMENT_FAILED', targetId: open.payment.id, actorType: 'SYSTEM' },
        }),
      ).toBe(1);
      // A failed payment cannot be verified into success afterwards? It can: the provider is the source of truth,
      // but a retry must open a fresh payment for the same pass, never a duplicate pass.
      const retry = await startPayment(priya.agent, priyaPost, collectiveId);
      expect(retry.payment.id).not.toBe(open.payment.id);
      expect(await db.buyingPass.count({ where: { buyingIntentId: priyaPost } })).toBe(1);
      open = retry;
    });

    it('a captured webhook activates the pass without any client call', async () => {
      const event = {
        eventId: `evt-${randomUUID()}`,
        event: 'payment.captured',
        orderId: open.checkout.orderId,
        paymentId: `mock_pay_${randomUUID()}`,
        amount: 50000,
      };
      expect((await hook(event)).status).toBe(200);
      expect((await db.payment.findUniqueOrThrow({ where: { id: open.payment.id } })).status).toBe(
        'SUCCESS',
      );
      expect(
        await db.buyingPass.count({ where: { buyingIntentId: priyaPost, status: 'ACTIVE' } }),
      ).toBe(1);
      expect(
        (await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: priyaPost } }))
          .status,
      ).toBe('ACTIVE');
      // Redelivery of the same event id is ignored; a second captured event for the same order changes nothing.
      expect((await hook(event)).status).toBe(200);
      expect((await hook({ ...event, eventId: `evt-${randomUUID()}` })).status).toBe(200);
      expect(
        await db.paymentWebhookEvent.count({ where: { providerEventId: event.eventId } }),
      ).toBe(1);
      expect(await db.buyingPass.count({ where: { buyingIntentId: priyaPost } })).toBe(1);
      expect(await db.collectiveMembership.count({ where: { buyingIntentId: priyaPost } })).toBe(1);
    });
  });

  it('users only see their own payments', async () => {
    const mine = await rahul.agent.get('/api/payments');
    expect(
      mine.body.items.every((p: { buyingIntentId: string }) => p.buyingIntentId === postId),
    ).toBe(true);
    const other = await db.payment.findFirstOrThrow({ where: { buyingIntentId: { not: postId } } });
    expect((await rahul.agent.get(`/api/payments/${other.id}`)).status).toBe(404);
  });
});

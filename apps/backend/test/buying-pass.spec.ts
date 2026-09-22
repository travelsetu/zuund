import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';
import {
  createPost,
  DAY_MS,
  db,
  joinCollective,
  payFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('buying pass', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let postA: string;
  let collectiveA: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    postA = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
    collectiveA = (await joinCollective(rahul.agent, postA)).id;
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('no pass exists before a payment flow; joining alone grants nothing', async () => {
    expect(await db.buyingPass.count({ where: { buyingIntentId: postA } })).toBe(0);
    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.pass).toBeNull();
    expect(post.body.membership.status).toBe('PENDING_PAYMENT');
    const polls = await rahul.agent.get(`/api/collectives/${collectiveA}/polls`);
    expect(polls.status).toBe(403);
    expect(polls.body.error.code).toBe('BUYING_PASS_REQUIRED');
  });

  it('activates only after verified payment, with server-side dates 60 days apart', async () => {
    const before = Date.now();
    await payFor(rahul.agent, postA, collectiveA);
    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.pass).toMatchObject({
      status: 'ACTIVE',
      amount: 50000,
      currency: 'INR',
      buyingIntentId: postA,
    });
    const activatedAt = new Date(post.body.pass.activatedAt).getTime();
    const expiresAt = new Date(post.body.pass.expiresAt).getTime();
    expect(activatedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(activatedAt).toBeLessThanOrEqual(Date.now() + 1000);
    expect(expiresAt - activatedAt).toBe(60 * DAY_MS);
    expect(post.body.membership.status).toBe('ACTIVE');
    // The API says ACTIVE; nothing for a client to compute.
    const passes = await rahul.agent.get('/api/buying-passes');
    expect(passes.body.items).toHaveLength(1);
    expect(passes.body.items[0].status).toBe('ACTIVE');
  });

  it('belongs to one post: paying for A does not unlock a collective joined with post B', async () => {
    const postB = (await createPost(rahul.agent, ctx.venue, ctx.ahmedabad)).id;
    const collectiveB = (await joinCollective(rahul.agent, postB)).id;
    expect(collectiveB).not.toBe(collectiveA);
    const polls = await rahul.agent.get(`/api/collectives/${collectiveB}/polls`);
    expect(polls.status).toBe(403);
    expect(polls.body.error.code).toBe('BUYING_PASS_REQUIRED');
    const b = await rahul.agent.get(`/api/buying-intents/${postB}`);
    expect(b.body.pass).toBeNull();
    // and there is no account-level paid flag anywhere in the user record
    const me = await rahul.agent.get('/api/users/me');
    expect(JSON.stringify(me.body).toLowerCase()).not.toContain('paid');
    // paying for B is a second ₹500
    await payFor(rahul.agent, postB, collectiveB);
    expect(await db.payment.count({ where: { userId: rahul.id, status: 'SUCCESS' } })).toBe(2);
    expect(await db.buyingPass.count({ where: { userId: rahul.id, status: 'ACTIVE' } })).toBe(2);
  });

  it('cannot be reassigned: the pass row references its post and the payment', async () => {
    const pass = await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: postA } });
    const payment = await db.payment.findUniqueOrThrow({ where: { id: pass.paymentId! } });
    expect(payment.buyingIntentId).toBe(postA);
    expect(payment.buyingPassId).toBe(pass.id);
    // second ACTIVE pass for the same post is impossible at the database level
    await expect(
      db.buyingPass.create({
        data: { buyingIntentId: postA, userId: rahul.id, amount: 50000, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });

  it('expires by the scheduler, ends paid access with BUYING_PASS_EXPIRED, and never renews', async () => {
    const pass = await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: postA } });
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const jobs = ctx.app.get(JobsService);
    await jobs.expirePasses();
    await jobs.expirePasses(); // idempotent

    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.status).toBe('ACTIVE'); // the post itself is untouched
    expect(post.body.pass.status).toBe('EXPIRED');
    expect(post.body.membership).toBeNull();
    for (const path of ['polls', 'files', 'activities', 'members']) {
      const res = await rahul.agent.get(`/api/collectives/${collectiveA}/${path}`);
      expect(res.status).toBe(403);
      if (path !== 'members') expect(res.body.error.code).toBe('BUYING_PASS_EXPIRED');
    }
    const conv = await db.conversation.findUniqueOrThrow({ where: { collectiveId: collectiveA } });
    expect((await rahul.agent.get(`/api/conversations/${conv.id}/messages`)).status).toBe(403);
    expect(
      (await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: postA } })).status,
    ).toBe('EXPIRED');
    expect(await db.notification.count({ where: { userId: rahul.id, type: 'PASS_EXPIRED' } })).toBe(
      1,
    );
    expect(
      await db.auditLog.count({
        where: { action: 'BUYING_PASS_EXPIRED', actorType: 'SYSTEM', targetId: pass.id },
      }),
    ).toBe(1);

    // No renewal happened, no new charge.
    expect(await db.buyingPass.count({ where: { buyingIntentId: postA } })).toBe(1);
    expect(await db.payment.count({ where: { buyingIntentId: postA } })).toBe(1);
    // Historical record survives.
    const passes = await rahul.agent.get('/api/buying-passes');
    expect(passes.body.items.find((p: { id: string }) => p.id === pass.id)).toMatchObject({
      status: 'EXPIRED',
      activatedAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it('after expiry a new payment creates a new pass; the old one stays EXPIRED', async () => {
    await rahul.agent.post(`/api/collectives/${collectiveA}/join`).send({ buyingIntentId: postA });
    await payFor(rahul.agent, postA, collectiveA);
    const passes = await db.buyingPass.findMany({
      where: { buyingIntentId: postA },
      orderBy: { createdAt: 'asc' },
    });
    expect(passes.map((p) => p.status)).toEqual(['EXPIRED', 'ACTIVE']);
    expect(await db.payment.count({ where: { buyingIntentId: postA, status: 'SUCCESS' } })).toBe(2);
  });

  it('expiry warnings are sent once per window', async () => {
    const pass = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() + 6 * DAY_MS) },
    });
    const jobs = ctx.app.get(JobsService);
    await jobs.passExpiryWarnings();
    await jobs.passExpiryWarnings();
    const notes = await db.notification.findMany({
      where: { userId: rahul.id, type: 'PASS_EXPIRING' },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toContain('7 days');
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() + 0.5 * DAY_MS) },
    });
    await jobs.passExpiryWarnings();
    expect(
      await db.notification.count({ where: { userId: rahul.id, type: 'PASS_EXPIRING' } }),
    ).toBe(2);
  });
});

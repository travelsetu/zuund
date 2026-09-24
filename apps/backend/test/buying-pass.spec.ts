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

describe('Free and Elite passes', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let postA: string;
  let collectiveA: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    postA = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('before joining there is no pass, and the Free Pass is available', async () => {
    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.pass).toBeNull();
    expect(post.body.freePassAvailable).toBe(true);
  });

  it('joining starts a 15-day Free Pass at once, with no payment', async () => {
    const before = Date.now();
    const col = await joinCollective(rahul.agent, postA);
    collectiveA = col.id;
    expect(col.membership?.status).toBe('ACTIVE');
    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.pass).toMatchObject({ plan: 'FREE', status: 'ACTIVE', amount: 0 });
    expect(post.body.freePassAvailable).toBe(false);
    const activatedAt = new Date(post.body.pass.activatedAt).getTime();
    expect(activatedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(post.body.pass.expiresAt).getTime() - activatedAt).toBe(15 * DAY_MS);
    expect(await db.payment.count()).toBe(0);
    const me = await rahul.agent.get('/api/users/me');
    expect(me.body.pass).toMatchObject({
      plan: 'FREE',
      activeConnectionsLimit: 5,
      acceptedConnectionsLimit: 10,
      directMessagesLeft: 0,
    });
    expect(me.body.elite).toBe(false);
  });

  it('upgrading ends the Free Pass and runs Elite for 30 days from payment', async () => {
    const before = Date.now();
    await payFor(rahul.agent, postA, collectiveA);
    const passes = await db.buyingPass.findMany({
      where: { buyingIntentId: postA },
      orderBy: { createdAt: 'asc' },
    });
    expect(passes.map((p) => [p.plan, p.status])).toEqual([
      ['FREE', 'EXPIRED'],
      ['ELITE', 'ACTIVE'],
    ]);
    const elite = passes[1]!;
    expect(elite.amount).toBe(49900);
    expect(elite.activatedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(elite.expiresAt!.getTime() - elite.activatedAt!.getTime()).toBe(30 * DAY_MS);
    // Same membership, now held by the Elite Pass.
    const m = await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: postA } });
    expect(m).toMatchObject({ status: 'ACTIVE', buyingPassId: elite.id });
    const me = await rahul.agent.get('/api/users/me');
    expect(me.body.elite).toBe(true);
    expect(me.body.pass).toMatchObject({ plan: 'ELITE', directMessagesLeft: 15 });
  });

  it('buying Elite again while it is active adds 30 days to the same pass', async () => {
    const before = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    await payFor(rahul.agent, postA, collectiveA);
    const after = await db.buyingPass.findMany({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before.id);
    expect(after[0]!.expiresAt!.getTime() - before.expiresAt!.getTime()).toBe(30 * DAY_MS);
    expect(await db.payment.count({ where: { buyingIntentId: postA, status: 'SUCCESS' } })).toBe(2);
  });

  it('Elite is per person: another collective rides on it, with no Free Pass used', async () => {
    const postB = (await createPost(rahul.agent, ctx.venue, ctx.ahmedabad)).id;
    const collectiveB = await joinCollective(rahul.agent, postB);
    expect(collectiveB.id).not.toBe(collectiveA);
    expect(collectiveB.membership?.status).toBe('ACTIVE');
    const elite = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    const b = await rahul.agent.get(`/api/buying-intents/${postB}`);
    // B's post reports the Elite Pass that covers it, and its Free Pass is still unused.
    expect(b.body.pass).toMatchObject({ id: elite.id, plan: 'ELITE', status: 'ACTIVE' });
    expect(b.body.freePassAvailable).toBe(true);
    expect(await db.buyingPass.count({ where: { buyingIntentId: postB } })).toBe(0);

    // Paying from B extends the same Elite Pass by 30 days.
    await payFor(rahul.agent, postB, collectiveB.id);
    const after = await db.buyingPass.findUniqueOrThrow({ where: { id: elite.id } });
    expect(after.expiresAt!.getTime() - elite.expiresAt!.getTime()).toBe(30 * DAY_MS);
    expect(await db.buyingPass.count({ where: { userId: rahul.id, status: 'ACTIVE' } })).toBe(1);

    // A second ACTIVE pass for the same post is impossible at the database level.
    await expect(
      db.buyingPass.create({
        data: { buyingIntentId: postA, userId: rahul.id, amount: 49900, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });

  it('expiry keeps the post and leaves the discussion readable up to that moment', async () => {
    const conv = await db.conversation.findUniqueOrThrow({ where: { collectiveId: collectiveA } });
    const said = await rahul.agent
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: 'Before the pass ended' });
    expect(said.status).toBe(201);

    const pass = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const jobs = ctx.app.get(JobsService);
    await jobs.expirePasses();
    await jobs.expirePasses(); // idempotent

    const post = await rahul.agent.get(`/api/buying-intents/${postA}`);
    expect(post.body.status).toBe('ACTIVE');
    expect(post.body.pass.status).toBe('EXPIRED');
    expect(post.body.membership).toBeNull();
    for (const path of ['polls', 'files', 'activities']) {
      const res = await rahul.agent.get(`/api/collectives/${collectiveA}/${path}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BUYING_PASS_EXPIRED');
    }
    expect((await rahul.agent.get(`/api/collectives/${collectiveA}/members`)).status).toBe(403);

    // Read-only history: what was said before, nothing after, no posting.
    const col = await rahul.agent.get(`/api/collectives/${collectiveA}`);
    expect(col.body).toMatchObject({ discussionReadOnly: true, conversationId: conv.id });
    await db.message.create({
      data: {
        conversationId: conv.id,
        senderId: rahul.id,
        messageType: 'TEXT',
        content: 'After (seeded)',
        createdAt: new Date(Date.now() + 60_000),
      },
    });
    const history = await rahul.agent.get(`/api/conversations/${conv.id}/messages`);
    expect(history.status).toBe(200);
    expect(history.body.items.map((m: { content: string }) => m.content)).toEqual([
      'Before the pass ended',
    ]);
    const post2 = await rahul.agent
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: 'Still here?' });
    expect(post2.status).toBe(403);

    expect(await db.notification.count({ where: { userId: rahul.id, type: 'PASS_EXPIRED' } })).toBe(
      1,
    );
    expect(
      await db.auditLog.count({
        where: { action: 'BUYING_PASS_EXPIRED', actorType: 'SYSTEM', targetId: pass.id },
      }),
    ).toBe(1);
  });

  it('after expiry there is no second Free Pass: rejoining waits for Elite', async () => {
    const res = await rahul.agent
      .post(`/api/collectives/${collectiveA}/join`)
      .send({ buyingIntentId: postA });
    expect(res.body.membership.status).toBe('PENDING_PAYMENT');
    await payFor(rahul.agent, postA, collectiveA);
    const passes = await db.buyingPass.findMany({
      where: { buyingIntentId: postA },
      orderBy: { createdAt: 'asc' },
    });
    expect(passes.map((p) => `${p.plan}:${p.status}`)).toEqual([
      'FREE:EXPIRED',
      'ELITE:EXPIRED',
      'ELITE:ACTIVE',
    ]);
    const col = await rahul.agent.get(`/api/collectives/${collectiveA}`);
    expect(col.body.discussionReadOnly).toBe(false);
  });

  it('expiry warnings are sent 5 days and 1 day before, once each', async () => {
    const pass = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: postA, status: 'ACTIVE' },
    });
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() + 4 * DAY_MS) },
    });
    const jobs = ctx.app.get(JobsService);
    await jobs.passExpiryWarnings();
    await jobs.passExpiryWarnings();
    const notes = await db.notification.findMany({
      where: {
        userId: rahul.id,
        type: 'PASS_EXPIRING',
        data: { path: ['buyingPassId'], equals: pass.id },
      },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toBe('Your Elite Pass expires in 5 days');
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() + 0.5 * DAY_MS) },
    });
    await jobs.passExpiryWarnings();
    expect(
      await db.notification.count({
        where: {
          userId: rahul.id,
          type: 'PASS_EXPIRING',
          data: { path: ['buyingPassId'], equals: pass.id },
        },
      }),
    ).toBe(2);
  });
});

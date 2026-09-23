import './free-places.env';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
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

const DAY_MS = 86_400_000;

describe('first 5 members join free', () => {
  let ctx: TestContext;
  const users: TestUser[] = [];
  const posts: string[] = [];
  let collectiveId: string;

  beforeAll(async () => {
    ctx = await setup();
    for (let i = 0; i < 8; i++) {
      const u = await registerUser(ctx, `Free${i}`, ctx.ahmedabad.id);
      users.push(u);
      posts.push((await createPost(u.agent, ctx.creta, ctx.ahmedabad)).id);
    }
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('the creator and the next four are active at once, with a ₹0 pass and no payment', async () => {
    const first = await joinCollective(users[0]!.agent, posts[0]!);
    collectiveId = first.id;
    expect(first.membership?.status).toBe('ACTIVE');
    expect(first.conversationId).not.toBeNull();
    for (let i = 1; i < 5; i++) {
      const res = await users[i]!.agent.post(`/api/collectives/${collectiveId}/join`).send({
        buyingIntentId: posts[i],
      });
      expect(res.status).toBe(201);
      expect(res.body.membership.status).toBe('ACTIVE');
      expect(res.body.freePlacesLeft).toBe(4 - i);
    }
    const passes = await db.buyingPass.findMany({
      where: { buyingIntentId: { in: posts.slice(0, 5) } },
    });
    expect(passes).toHaveLength(5);
    for (const p of passes) {
      expect(p).toMatchObject({ amount: 0, status: 'ACTIVE', paymentId: null });
      const days = (p.expiresAt!.getTime() - p.activatedAt!.getTime()) / DAY_MS;
      expect(days).toBe(60);
    }
    expect(await db.payment.count()).toBe(0);
  });

  it('a free member can use paid features straight away', async () => {
    const res = await users[1]!.agent
      .post(`/api/collectives/${collectiveId}/polls`)
      .send({ question: 'Which variant?', options: ['SX', 'SX(O)'] });
    expect(res.status).toBe(201);
  });

  it('the sixth member pays ₹500', async () => {
    const res = await users[5]!.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: posts[5] });
    expect(res.body.membership.status).toBe('PENDING_PAYMENT');
    expect(res.body.freePlacesLeft).toBe(0);
    const { payment } = await payFor(users[5]!.agent, posts[5]!, collectiveId);
    expect(payment.status).toBe('SUCCESS');
    const pass = await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: posts[5] } });
    expect(pass.amount).toBe(50_000);
  });

  it('a free member leaving opens their place for the next person', async () => {
    await users[2]!.agent.post(`/api/collectives/${collectiveId}/leave`).expect(204);
    const col = await users[0]!.agent.get(`/api/collectives/${collectiveId}`);
    expect(col.body.freePlacesLeft).toBe(1);
    const res = await users[6]!.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: posts[6] });
    expect(res.body.membership.status).toBe('ACTIVE');
    expect(res.body.freePlacesLeft).toBe(0);
    // A paid member leaving opens nothing: they never held a free place.
    await users[5]!.agent.post(`/api/collectives/${collectiveId}/leave`).expect(204);
    const after = await users[7]!.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: posts[7] });
    expect(after.body.membership.status).toBe('PENDING_PAYMENT');
  });

  it('two people racing for the last free place: only one gets it', async () => {
    const racers: TestUser[] = [];
    const racerPosts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const u = await registerUser(ctx, `Race${i}`, ctx.surat.id);
      racers.push(u);
      racerPosts.push((await createPost(u.agent, ctx.venue, ctx.surat)).id);
    }
    const col = await joinCollective(racers[0]!.agent, racerPosts[0]!);
    for (let i = 1; i < 4; i++) {
      await racers[i]!.agent.post(`/api/collectives/${col.id}/join`).send({
        buyingIntentId: racerPosts[i],
      });
    }
    const [a, b] = await Promise.all(
      [4, 5].map((i) =>
        racers[i]!.agent.post(`/api/collectives/${col.id}/join`).send({
          buyingIntentId: racerPosts[i],
        }),
      ),
    );
    const statuses = [a!.body.membership.status, b!.body.membership.status].sort();
    expect(statuses).toEqual(['ACTIVE', 'PENDING_PAYMENT']);
    expect(
      await db.collectiveMembership.count({ where: { collectiveId: col.id, status: 'ACTIVE' } }),
    ).toBe(5);
  });
});

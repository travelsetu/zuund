import './free-places.env';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
  db,
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

  // Creating a post joins the collective straight away (the free places go in order).
  const memberships: string[] = [];
  beforeAll(async () => {
    ctx = await setup();
    for (let i = 0; i < 6; i++) {
      const u = await registerUser(ctx, `Free${i}`, ctx.ahmedabad.id);
      users.push(u);
      const post = await u.agent.post('/api/buying-intents').send({
        carId: ctx.creta.id,
        cityId: ctx.ahmedabad.id,
        purchaseTimeline: 'WITHIN_30_DAYS',
      });
      posts.push(post.body.id);
      memberships.push(post.body.membership.status);
      collectiveId = post.body.membership.collectiveId;
    }
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('creating a post joins; the first five are active at once, with a ₹0 pass and no payment', async () => {
    expect(memberships).toEqual([
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'PENDING_PAYMENT',
    ]);
    const col = await users[0]!.agent.get(`/api/collectives/${collectiveId}`);
    expect(col.body.freePlacesLeft).toBe(0);
    expect(col.body.conversationId).not.toBeNull();
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
    const { payment } = await payFor(users[5]!.agent, posts[5]!, collectiveId);
    expect(payment.status).toBe('SUCCESS');
    const pass = await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: posts[5] } });
    expect(pass.amount).toBe(50_000);
  });

  it('places never refill when a free member leaves', async () => {
    await users[2]!.agent.post(`/api/collectives/${collectiveId}/leave`).expect(204);
    const late = await registerUser(ctx, 'Late', ctx.ahmedabad.id);
    const p = await createPost(late.agent, ctx.creta, ctx.ahmedabad);
    expect((await late.agent.get(`/api/buying-intents/${p.id}`)).body.membership.status).toBe(
      'PENDING_PAYMENT',
    );
    const col = await late.agent.get(`/api/collectives/${collectiveId}`);
    expect(col.body.freePlacesLeft).toBe(0);
  });

  it('two people racing for the last free place: only one gets it', async () => {
    const post = async (name: string) => {
      const u = await registerUser(ctx, name, ctx.surat.id);
      return u.agent.post('/api/buying-intents').send({
        carId: ctx.venue.id,
        cityId: ctx.surat.id,
        purchaseTimeline: 'WITHIN_30_DAYS',
      });
    };
    for (let i = 0; i < 4; i++) await post(`Race${i}`);
    const [a, b] = await Promise.all([post('Race4'), post('Race5')]);
    const statuses = [a.body.membership.status, b.body.membership.status].sort();
    expect(statuses).toEqual(['ACTIVE', 'PENDING_PAYMENT']);
    expect(
      await db.collectiveMembership.count({
        where: { collectiveId: a.body.membership.collectiveId, status: 'ACTIVE' },
      }),
    ).toBe(5);
  });
});

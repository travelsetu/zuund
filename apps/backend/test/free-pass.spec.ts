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

describe('Free Pass: once per user for a car+city', () => {
  let ctx: TestContext;
  let priya: TestUser;

  beforeAll(async () => {
    ctx = await setup();
    priya = await registerUser(ctx, 'Priya', ctx.ahmedabad.id);
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('every member of a collective can start Free: there are no limited places', async () => {
    const first = await registerUser(ctx, 'First');
    const firstPost = await createPost(first.agent, ctx.creta, ctx.ahmedabad);
    const col = await joinCollective(first.agent, firstPost.id);
    for (let i = 0; i < 7; i++) {
      const u = await registerUser(ctx, `Member${i}`);
      const p = await createPost(u.agent, ctx.creta, ctx.ahmedabad);
      const res = await u.agent
        .post(`/api/collectives/${col.id}/join`)
        .send({ buyingIntentId: p.id });
      expect(res.body.membership.status).toBe('ACTIVE');
      expect(res.body).not.toHaveProperty('freePlacesLeft');
    }
    expect(await db.buyingPass.count({ where: { plan: 'FREE', status: 'ACTIVE' } })).toBe(8);
    expect(await db.payment.count()).toBe(0);
  });

  it('closing the post and posting the same car+city again gives no second Free Pass', async () => {
    const post1 = await createPost(priya.agent, ctx.creta, ctx.ahmedabad);
    const col = await joinCollective(priya.agent, post1.id);
    expect(col.membership?.status).toBe('ACTIVE');
    expect((await priya.agent.post(`/api/collectives/${col.id}/leave`)).status).toBe(204);
    await priya.agent.post(`/api/buying-intents/${post1.id}/status`).send({ action: 'CLOSE' });

    const post2 = await createPost(priya.agent, ctx.creta, ctx.ahmedabad);
    const again = await priya.agent.get(`/api/buying-intents/${post2.id}`);
    expect(again.body.freePassAvailable).toBe(false);
    const joined = await priya.agent
      .post(`/api/collectives/${col.id}/join`)
      .send({ buyingIntentId: post2.id });
    expect(joined.body.membership.status).toBe('PENDING_PAYMENT');
    // Elite is the way in.
    await payFor(priya.agent, post2.id, col.id);
    const pass = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: post2.id, status: 'ACTIVE' },
    });
    expect(pass.plan).toBe('ELITE');
  });

  it('a different car or city starts its own Free Pass', async () => {
    const venue = await createPost(priya.agent, ctx.venue, ctx.ahmedabad);
    expect((await joinCollective(priya.agent, venue.id)).membership?.status).toBe('ACTIVE');
    const surat = await createPost(priya.agent, ctx.creta, ctx.surat);
    expect((await joinCollective(priya.agent, surat.id)).membership?.status).toBe('ACTIVE');
    for (const id of [venue.id, surat.id])
      expect((await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: id } })).plan).toBe(
        'FREE',
      );
  });
});

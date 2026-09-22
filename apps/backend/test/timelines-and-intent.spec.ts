import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
  db,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('buying timeline', () => {
  let ctx: TestContext;
  let user: TestUser;
  beforeAll(async () => {
    ctx = await setup();
    user = await registerUser(ctx, 'Timeline');
  });
  afterAll(async () => {
    await teardown(ctx);
  });

  it.each(['WITHIN_7_DAYS', 'WITHIN_15_DAYS', 'WITHIN_30_DAYS', 'WITHIN_60_DAYS'] as const)(
    'accepts %s',
    async (timeline) => {
      // A different car each time so the one-active-post rule does not interfere.
      const car =
        ctx.cars[
          ['WITHIN_7_DAYS', 'WITHIN_15_DAYS', 'WITHIN_30_DAYS', 'WITHIN_60_DAYS'].indexOf(timeline)
        ]!;
      const post = await createPost(user.agent, car, ctx.ahmedabad, timeline);
      expect(post.purchaseTimeline).toBe(timeline);
    },
  );

  it.each(['NEXT_YEAR', 'WITHIN_90_DAYS', '30', '', null])('rejects %s', async (bad) => {
    const res = await user.agent
      .post('/api/buying-intents')
      .send({ carId: ctx.cars[10]!.id, cityId: ctx.ahmedabad.id, purchaseTimeline: bad });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('timeline is a business selection, independent of any pass validity', async () => {
    const post = await createPost(user.agent, ctx.cars[11]!, ctx.surat, 'WITHIN_7_DAYS');
    const row = await db.buyingIntent.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.purchaseTimeline).toBe('WITHIN_7_DAYS');
    expect(await db.buyingPass.count({ where: { buyingIntentId: post.id } })).toBe(0);
    const changed = await user.agent
      .patch(`/api/buying-intents/${post.id}`)
      .send({ purchaseTimeline: 'WITHIN_60_DAYS' });
    expect(changed.body.purchaseTimeline).toBe('WITHIN_60_DAYS');
  });
});

describe('intent level', () => {
  let ctx: TestContext;
  let user: TestUser;
  beforeAll(async () => {
    ctx = await setup();
    user = await registerUser(ctx, 'Intent');
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it.each(['INTERESTED', 'COMMITTED', 'READY'] as const)(
    'a post can be created as %s',
    async (level) => {
      const car = ctx.cars[['INTERESTED', 'COMMITTED', 'READY'].indexOf(level)]!;
      const post = await createPost(user.agent, car, ctx.ahmedabad, 'WITHIN_30_DAYS', level);
      expect(post.intentLevel).toBe(level);
      const history = await user.agent.get(`/api/buying-intents/${post.id}/history`);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toMatchObject({
        previousLevel: null,
        newLevel: level,
        changedById: user.id,
      });
    },
  );

  it('changes up and down and records every step', async () => {
    const post = await createPost(
      user.agent,
      ctx.cars[5]!,
      ctx.ahmedabad,
      'WITHIN_30_DAYS',
      'INTERESTED',
    );
    const url = `/api/buying-intents/${post.id}/intent-level`;
    for (const level of ['COMMITTED', 'READY', 'COMMITTED', 'INTERESTED'] as const) {
      const res = await user.agent.post(url).send({ intentLevel: level });
      expect(res.status).toBe(201);
      expect(res.body.intentLevel).toBe(level);
    }
    const history = await user.agent.get(`/api/buying-intents/${post.id}/history`);
    expect(
      history.body.map((h: { previousLevel: string | null; newLevel: string }) => [
        h.previousLevel,
        h.newLevel,
      ]),
    ).toEqual([
      ['COMMITTED', 'INTERESTED'],
      ['READY', 'COMMITTED'],
      ['COMMITTED', 'READY'],
      ['INTERESTED', 'COMMITTED'],
      [null, 'INTERESTED'],
    ]);
    for (const h of history.body) {
      expect(h.changedAt).toBeTruthy();
      expect(h.changedById).toBe(user.id);
    }
  });

  it('setting the same level again is a no-op with no history row', async () => {
    const post = await createPost(
      user.agent,
      ctx.cars[6]!,
      ctx.ahmedabad,
      'WITHIN_30_DAYS',
      'READY',
    );
    await user.agent
      .post(`/api/buying-intents/${post.id}/intent-level`)
      .send({ intentLevel: 'READY' });
    expect(await db.buyingIntentHistory.count({ where: { buyingIntentId: post.id } })).toBe(1);
  });

  it('rejects an unknown level', async () => {
    const post = await createPost(user.agent, ctx.cars[7]!, ctx.ahmedabad);
    const res = await user.agent
      .post(`/api/buying-intents/${post.id}/intent-level`)
      .send({ intentLevel: 'GUARANTEED' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it("another user cannot change someone's level", async () => {
    const other = await registerUser(ctx, 'Other');
    const post = await createPost(user.agent, ctx.cars[8]!, ctx.ahmedabad);
    const res = await other.agent
      .post(`/api/buying-intents/${post.id}/intent-level`)
      .send({ intentLevel: 'READY' });
    expect(res.status).toBe(403);
  });
});

import request from 'supertest';
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

describe('buying posts', () => {
  let ctx: TestContext;
  let rahul: TestUser;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('creates a post with car, city and timeline; creation is free', async () => {
    const res = await rahul.agent
      .post('/api/buying-intents')
      .send({ carId: ctx.creta.id, cityId: ctx.ahmedabad.id, purchaseTimeline: 'WITHIN_30_DAYS' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'ACTIVE',
      intentLevel: 'INTERESTED',
      purchaseTimeline: 'WITHIN_30_DAYS',
      car: { displayName: 'Hyundai Creta' },
      city: { name: 'Ahmedabad' },
      pass: null,
      membership: null,
    });
    expect(res.body).not.toHaveProperty('budget');
  });

  it('requires car, city and timeline', async () => {
    const missing = await rahul.agent.post('/api/buying-intents').send({ carId: ctx.creta.id });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_FAILED');
    const unknownCar = await rahul.agent.post('/api/buying-intents').send({
      carId: '00000000-0000-4000-8000-000000000000',
      cityId: ctx.ahmedabad.id,
      purchaseTimeline: 'WITHIN_7_DAYS',
    });
    expect(unknownCar.status).toBe(404);
  });

  it('refuses a second ACTIVE post for the same car and city', async () => {
    const res = await rahul.agent
      .post('/api/buying-intents')
      .send({ carId: ctx.creta.id, cityId: ctx.ahmedabad.id, purchaseTimeline: 'WITHIN_7_DAYS' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ACTIVE_POST');
  });

  it('lets exactly one of two simultaneous duplicate creates through', async () => {
    const priya = await registerUser(ctx, 'Priya');
    const body = { carId: ctx.venue.id, cityId: ctx.surat.id, purchaseTimeline: 'WITHIN_15_DAYS' };
    const [a, b] = await Promise.all([
      priya.agent.post('/api/buying-intents').send(body),
      priya.agent.post('/api/buying-intents').send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const rows = await db.buyingIntent.count({
      where: { userId: priya.id, carId: ctx.venue.id, cityId: ctx.surat.id, status: 'ACTIVE' },
    });
    expect(rows).toBe(1);
  });

  it('allows another active post for a different car in the same city', async () => {
    const post = await createPost(rahul.agent, ctx.venue, ctx.ahmedabad, 'WITHIN_60_DAYS');
    expect(post.status).toBe('ACTIVE');
  });

  it('pauses, resumes and closes; closing is final', async () => {
    const post = await createPost(
      rahul.agent,
      ctx.cars.find((c) => c.slug === 'tata-nexon')!,
      ctx.ahmedabad,
    );
    const url = `/api/buying-intents/${post.id}/status`;
    let res = await rahul.agent.post(url).send({ action: 'RESUME' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    res = await rahul.agent.post(url).send({ action: 'PAUSE' });
    expect(res.body.status).toBe('PAUSED');
    expect(res.body.pausedAt).toBeTruthy();
    res = await rahul.agent.post(url).send({ action: 'RESUME' });
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.pausedAt).toBeNull();
    res = await rahul.agent.post(url).send({ action: 'CLOSE' });
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.closedAt).toBeTruthy();
    res = await rahul.agent.post(url).send({ action: 'RESUME' });
    expect(res.status).toBe(400);
    res = await rahul.agent
      .post(`/api/buying-intents/${post.id}/intent-level`)
      .send({ intentLevel: 'READY' });
    expect(res.body.error.code).toBe('POST_NOT_EDITABLE');
  });

  it('keeps closed posts in history and allows a new post for the same car afterwards', async () => {
    const nexon = ctx.cars.find((c) => c.slug === 'tata-nexon')!;
    const closed = await db.buyingIntent.findFirst({
      where: { userId: rahul.id, carId: nexon.id, status: 'CLOSED' },
    });
    expect(closed).not.toBeNull();
    const list = await rahul.agent.get('/api/buying-intents?status=CLOSED');
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(closed!.id);
    const again = await createPost(rahul.agent, nexon, ctx.ahmedabad);
    expect(again.id).not.toBe(closed!.id);
    expect(await db.buyingIntent.count({ where: { userId: rahul.id, carId: nexon.id } })).toBe(2);
  });

  it('only the owner can read or change a post', async () => {
    const other = await registerUser(ctx, 'Other');
    const mine = await db.buyingIntent.findFirst({ where: { userId: rahul.id, status: 'ACTIVE' } });
    expect((await other.agent.get(`/api/buying-intents/${mine!.id}`)).status).toBe(403);
    expect(
      (await other.agent.post(`/api/buying-intents/${mine!.id}/status`).send({ action: 'CLOSE' }))
        .status,
    ).toBe(403);
    expect(
      (
        await other.agent
          .patch(`/api/buying-intents/${mine!.id}`)
          .send({ purchaseTimeline: 'WITHIN_7_DAYS' })
      ).status,
    ).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(ctx.server).get('/api/buying-intents');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

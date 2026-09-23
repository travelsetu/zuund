import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
  joinedUser,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
} from './helpers';

/** Every error leaves the API as { success: false, error: { code, message } }. */
describe('error envelope', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const shape = (body: unknown) => {
    expect(body).toMatchObject({
      success: false,
      error: { code: expect.any(String), message: expect.any(String) },
    });
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('stack');
  };

  it('400 validation', async () => {
    const res = await request(ctx.server)
      .post('/api/auth/login')
      .send({ email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    shape(res.body);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
    );
  });

  it('401 unauthenticated', async () => {
    const res = await request(ctx.server).get('/api/users/me');
    expect(res.status).toBe(401);
    shape(res.body);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('403 forbidden', async () => {
    const u = await registerUser(ctx, 'Plain');
    const res = await u.agent.get('/api/admin/stats');
    expect(res.status).toBe(403);
    shape(res.body);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('404 not found', async () => {
    const u = await joinedUser(ctx, 'Seeker');
    const res = await u.agent.get('/api/users/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
    shape(res.body);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('409 conflict with a domain code', async () => {
    const u = await registerUser(ctx, 'Dup');
    await createPost(u.agent, ctx.creta, ctx.ahmedabad);
    const res = await u.agent
      .post('/api/buying-intents')
      .send({ carId: ctx.creta.id, cityId: ctx.ahmedabad.id, purchaseTimeline: 'WITHIN_7_DAYS' });
    expect(res.status).toBe(409);
    shape(res.body);
    expect(res.body.error.code).toBe('DUPLICATE_ACTIVE_POST');
  });

  it('invalid uuid in a path is a 400, not a database error', async () => {
    const u = await registerUser(ctx, 'Path');
    const res = await u.agent.get('/api/users/not-a-uuid');
    expect(res.status).toBe(400);
    shape(res.body);
  });
});

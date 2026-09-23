import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, registerUser, setup, teardown, teardownAll, type TestContext } from './helpers';

const body = (over: Record<string, unknown> = {}) => ({
  name: 'Asha',
  email: `asha-${Math.random().toString(36).slice(2, 8)}@test.zuund`,
  password: 'password123',
  phone: '+919123456780',
  ...over,
});

describe('mobile number at sign-up', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('is required', async () => {
    const res = await request(ctx.server)
      .post('/api/auth/register')
      .send(body({ phone: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'phone' })]),
    );
  });

  it('rejects an invalid number', async () => {
    for (const phone of ['12345', '+91123', 'not a number', '+9112345678901234']) {
      const res = await request(ctx.server).post('/api/auth/register').send(body({ phone }));
      expect(res.status).toBe(400);
    }
  });

  it('stores it in international form and shows it only to its owner', async () => {
    const agent = request.agent(ctx.server);
    const res = await agent.post('/api/auth/register').send(body({ phone: '+91 91234 56789' }));
    expect(res.status).toBe(201);
    const me = await agent.get('/api/users/me');
    expect(me.body).toMatchObject({ phone: '+919123456789', phoneVerified: false });
    const other = await registerUser(ctx, 'Other');
    const seen = await other.agent.get(`/api/users/${me.body.id}`);
    expect(JSON.stringify(seen.body)).not.toContain('9123456789');
  });

  it('allows one account per number', async () => {
    const res = await request(ctx.server)
      .post('/api/auth/register')
      .send(body({ phone: '+919123456789' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('a user without a number (older account) can add one; taken numbers are refused', async () => {
    const u = await registerUser(ctx, 'Legacy');
    await db.user.update({ where: { id: u.id }, data: { phone: null } });
    expect((await u.agent.get('/api/users/me')).body.phone).toBeNull();
    const taken = await u.agent.patch('/api/users/me').send({ phone: '+919123456789' });
    expect(taken.status).toBe(409);
    const ok = await u.agent.patch('/api/users/me').send({ phone: '+971501234567' });
    expect(ok.status).toBe(200);
    expect(ok.body.phone).toBe('+971501234567');
  });

  it('admins see the number', async () => {
    const admin = request.agent(ctx.server);
    const login = await admin
      .post('/api/auth/login')
      .send({ email: 'admin@test.zuund', password: 'AdminPass123!' });
    expect(login.status).toBe(200);
    const res = await admin.get('/api/admin/users?q=9123456789');
    expect(res.body.items[0]).toMatchObject({ phone: '+919123456789' });
  });
});

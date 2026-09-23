import request from 'supertest';
import { OtpSender } from '../src/otp/otp.sender';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  db,
  otpFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
} from './helpers';

describe('sign-up and sign-in with a WhatsApp number and code', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const register = (body: Record<string, unknown>) =>
    request(ctx.server)
      .post('/api/auth/register')
      .send({ name: 'Asha', ...body });

  it('needs a WhatsApp number and a code, and no email or password', async () => {
    const noPhone = await register({ code: '123456' });
    expect(noPhone.status).toBe(400);
    expect(noPhone.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'phone' })]),
    );
    const noCode = await register({ phone: '+919123456780' });
    expect(noCode.status).toBe(400);

    const phone = '+919123456780';
    const agent = request.agent(ctx.server);
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Asha', phone, code: await otpFor(ctx, phone), email: 'ignored@test.zuund' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBeNull();
    const me = await agent.get('/api/users/me');
    expect(me.body).toMatchObject({ phone, phoneVerified: true, email: null });
  });

  it('rejects an invalid number', async () => {
    for (const phone of ['12345', '+91123', 'not a number', '+9112345678901234']) {
      const res = await request(ctx.server).post('/api/auth/otp').send({ phone });
      expect(res.status).toBe(400);
    }
  });

  it('refuses a wrong or reused code', async () => {
    const phone = '+919123456781';
    const code = await otpFor(ctx, phone);
    const wrong = await register({ phone, code: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('OTP_INVALID');
    expect((await register({ phone, code })).status).toBe(201);
    const again = await request(ctx.server).post('/api/auth/otp/login').send({ phone, code });
    expect(again.body.error.code).toBe('OTP_INVALID');
  });

  it('locks a code after five wrong guesses', async () => {
    const phone = '+919123456782';
    const code = await otpFor(ctx, phone);
    const bad = code === '999999' ? '888888' : '999999';
    for (let i = 0; i < 5; i++) await register({ phone, code: bad });
    expect((await register({ phone, code })).body.error.code).toBe('OTP_INVALID');
  });

  it('makes you wait before sending another code', async () => {
    const phone = '+919123456783';
    await otpFor(ctx, phone);
    const res = await request(ctx.server).post('/api/auth/otp').send({ phone });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_TOO_SOON');
  });

  it('a used code does not hold up the next one', async () => {
    const u = await registerUser(ctx, 'Quick');
    const res = await request(ctx.server).post('/api/auth/otp').send({ phone: u.phone });
    expect(res.status).toBe(200);
  });

  it('only the newest code works', async () => {
    const phone = '+919123456784';
    const first = await otpFor(ctx, phone);
    await db.otpChallenge.updateMany({
      where: { phone },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    const resend = await request(ctx.server).post('/api/auth/otp').send({ phone });
    expect(resend.status).toBe(200);
    const second = ctx.app.get(OtpSender).sentForTests.get(phone)!;
    if (first !== second) expect((await register({ phone, code: first })).status).toBe(401);
    expect((await register({ phone, code: second })).status).toBe(201);
  });

  it('signs in with a code; web gets cookies, apps get tokens', async () => {
    const u = await registerUser(ctx, 'Signin');
    await db.otpChallenge.deleteMany({ where: { phone: u.phone } });
    const web = request.agent(ctx.server);
    const res = await web
      .post('/api/auth/otp/login')
      .send({ phone: u.phone, code: await otpFor(ctx, u.phone) });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(u.id);
    expect((await web.get('/api/users/me')).status).toBe(200);

    await db.otpChallenge.deleteMany({ where: { phone: u.phone } });
    const app = await request(ctx.server)
      .post('/api/auth/otp/token')
      .send({ phone: u.phone, code: await otpFor(ctx, u.phone) });
    expect(app.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('a new number signing in is told to sign up, and the same code still works for it', async () => {
    const phone = '+919123456785';
    const code = await otpFor(ctx, phone);
    const res = await request(ctx.server).post('/api/auth/otp/login').send({ phone, code });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    expect((await register({ phone, code })).status).toBe(201);
  });

  it('allows one account per number, and says so before sending a sign-up code', async () => {
    const taken = '+919123456780';
    const early = await request(ctx.server)
      .post('/api/auth/otp')
      .send({ phone: taken, purpose: 'signup' });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('PHONE_TAKEN');
    expect(await db.otpChallenge.count({ where: { phone: taken, consumedAt: null } })).toBe(0);
    // Changing to it is refused the same way; signing in still sends a code.
    const change = await request(ctx.server)
      .post('/api/auth/otp')
      .send({ phone: taken, purpose: 'change' });
    expect(change.body.error.code).toBe('PHONE_TAKEN');
    // Registering with a code got some other way is still refused.
    const res = await register({ phone: taken, code: await otpFor(ctx, taken) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('keeps the number private to its owner', async () => {
    const a = await registerUser(ctx, 'Private');
    const other = await registerUser(ctx, 'Other');
    const seen = await other.agent.get(`/api/users/${a.id}`);
    expect(JSON.stringify(seen.body)).not.toContain(a.phone.slice(3));
  });

  it('changing the number needs the code sent to the new number', async () => {
    const u = await registerUser(ctx, 'Legacy');
    await db.user.update({ where: { id: u.id }, data: { phone: null, phoneVerifiedAt: null } });
    expect((await u.agent.get('/api/users/me')).body.phone).toBeNull();
    const noCode = await u.agent.patch('/api/users/me').send({ phone: '+971501234567' });
    expect(noCode.body.error.code).toBe('PHONE_CODE_REQUIRED');
    const taken = await u.agent
      .patch('/api/users/me')
      .send({ phone: '+919123456780', phoneCode: '123456' });
    expect(taken.status).toBe(409);
    const phone = '+971501234567';
    const ok = await u.agent
      .patch('/api/users/me')
      .send({ phone, phoneCode: await otpFor(ctx, phone) });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ phone, phoneVerified: true });
  });

  it('admins still sign in with email and password; buyers have no password', async () => {
    const admin = request.agent(ctx.server);
    const login = await admin
      .post('/api/auth/login')
      .send({ email: 'admin@test.zuund', password: 'AdminPass123!' });
    expect(login.status).toBe(200);
    const res = await admin.get('/api/admin/users?q=9123456780');
    expect(res.body.items[0]).toMatchObject({ phone: '+919123456780' });
    // A WhatsApp-only account has no password to guess.
    const u = await registerUser(ctx, 'Nopass');
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row).toMatchObject({ email: null, passwordHash: null });
  });
});

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

describe('connections', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let priya: TestUser;
  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    priya = await registerUser(ctx, 'Priya');
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('creates a pending request and notifies the recipient', async () => {
    const res = await rahul.agent.post('/api/connections').send({ userId: priya.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      requesterId: rahul.id,
      recipientId: priya.id,
      otherUser: { name: 'Priya' },
    });
    expect(res.body.otherUser).not.toHaveProperty('email');
    const notes = await priya.agent.get('/api/notifications');
    expect(notes.body.items.some((n: { type: string }) => n.type === 'CONNECTION_REQUEST')).toBe(
      true,
    );
  });

  it('refuses a duplicate request and a self request', async () => {
    const dup = await rahul.agent.post('/api/connections').send({ userId: priya.id });
    expect(dup.status).toBe(400);
    expect(dup.body.error.code).toBe('REQUEST_ALREADY_SENT');
    const self = await rahul.agent.post('/api/connections').send({ userId: rahul.id });
    expect(self.body.error.code).toBe('SELF_ACTION');
    expect(await db.connection.count()).toBe(1);
  });

  it('a request in the other direction accepts instead of duplicating', async () => {
    const res = await priya.agent.post('/api/connections').send({ userId: rahul.id });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACCEPTED');
    expect(await db.connection.count()).toBe(1);
    const list = await rahul.agent.get('/api/connections?box=ACCEPTED');
    expect(list.body.items).toHaveLength(1);
  });

  it('only the recipient can accept or reject; only pending requests can be', async () => {
    const amit = await registerUser(ctx, 'Amit');
    const req = await rahul.agent.post('/api/connections').send({ userId: amit.id });
    expect((await rahul.agent.post(`/api/connections/${req.body.id}/accept`)).status).toBe(403);
    const rejected = await amit.agent.post(`/api/connections/${req.body.id}/reject`);
    expect(rejected.body.status).toBe('REJECTED');
    const again = await amit.agent.post(`/api/connections/${req.body.id}/accept`);
    expect(again.body.error.code).toBe('REQUEST_NOT_PENDING');
    // After a rejection a fresh request reuses the same row.
    const re = await rahul.agent.post('/api/connections').send({ userId: amit.id });
    expect(re.body.id).toBe(req.body.id);
    expect(re.body.status).toBe('PENDING');
    const acc = await amit.agent.post(`/api/connections/${req.body.id}/accept`);
    expect(acc.body.status).toBe('ACCEPTED');
    expect(acc.body.acceptedAt).toBeTruthy();
  });

  it('requester cancels a pending request; either side removes an accepted one', async () => {
    const neha = await registerUser(ctx, 'Neha');
    const req = await rahul.agent.post('/api/connections').send({ userId: neha.id });
    expect((await neha.agent.delete(`/api/connections/${req.body.id}`)).status).toBe(403);
    const cancelled = await rahul.agent.delete(`/api/connections/${req.body.id}`);
    expect(cancelled.body.status).toBe('CANCELLED');
    // Remove the accepted Rahul–Priya connection from Priya's side.
    const rp = await db.connection.findFirstOrThrow({ where: { status: 'ACCEPTED' } });
    const removed = await priya.agent.delete(`/api/connections/${rp.id}`);
    expect(removed.body.status).toBe('CANCELLED');
    const accepted = await rahul.agent.get('/api/connections?box=ACCEPTED');
    expect(
      accepted.body.items.map((c: { otherUser: { id: string } }) => c.otherUser.id),
    ).not.toContain(priya.id);
  });

  it('blocking hides the profile, discovery and any further requests', async () => {
    const troll = await registerUser(ctx, 'Troll');
    await createPost(troll.agent, ctx.creta, ctx.ahmedabad);
    await createPost(rahul.agent, ctx.creta, ctx.ahmedabad);
    expect(
      (await rahul.agent.get(`/api/buyers?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}`)).body
        .totalActiveBuyers,
    ).toBe(1);

    const block = await rahul.agent.post('/api/connections/block').send({ userId: troll.id });
    expect(block.status).toBe(204);
    expect(
      (await rahul.agent.get(`/api/buyers?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}`)).body
        .totalActiveBuyers,
    ).toBe(0);
    expect((await troll.agent.get(`/api/users/${rahul.id}`)).status).toBe(403);
    expect((await rahul.agent.get(`/api/users/${troll.id}`)).status).toBe(403);
    const attempt = await troll.agent.post('/api/connections').send({ userId: rahul.id });
    expect(attempt.status).toBe(403);
    expect(attempt.body.error.code).toBe('BLOCKED');
    const blocked = await rahul.agent.get('/api/connections?box=BLOCKED');
    expect(blocked.body.items.map((c: { otherUser: { id: string } }) => c.otherUser.id)).toEqual([
      troll.id,
    ]);
    // Only the blocker can unblock.
    expect(
      (await troll.agent.post('/api/connections/unblock').send({ userId: rahul.id })).status,
    ).toBe(403);
    expect(
      (await rahul.agent.post('/api/connections/unblock').send({ userId: troll.id })).status,
    ).toBe(204);
    expect((await troll.agent.get(`/api/users/${rahul.id}`)).status).toBe(200);
  });
});

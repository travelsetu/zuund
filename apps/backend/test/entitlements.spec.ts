import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connect,
  DAY_MS,
  db,
  joinedUser,
  makeElite,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

/** lastActiveAt is written after the response (fire-and-forget); wait for it. */
async function lastActive(userId: string): Promise<Date | null> {
  for (let i = 0; i < 20; i++) {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.lastActiveAt) return u.lastActiveAt;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe('Free and Elite entitlements', () => {
  let ctx: TestContext;
  let viewer: TestUser;
  let others: TestUser[];
  let solarId: string;

  beforeAll(async () => {
    ctx = await setup();
    viewer = await joinedUser(ctx, 'Viewer');
    others = [];
    for (let i = 0; i < 16; i++) others.push(await joinedUser(ctx, `Buyer${i}`));
    solarId = (await db.car.findUniqueOrThrow({ where: { slug: '1-kw-rooftop-solar' } })).id;
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const request = (from: TestUser, to: TestUser) =>
    from.agent.post('/api/connections').send({ userId: to.id });

  it('Free: 5 open connections at a time, pending requests included', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(viewer, others[i]!);
      expect(res.status).toBe(201);
      ids.push(res.body.id);
    }
    const sixth = await request(viewer, others[5]!);
    expect(sixth.status).toBe(403);
    expect(sixth.body.error.code).toBe('CONNECTION_LIMIT');
    // Cancelling a pending request frees its slot.
    await viewer.agent.delete(`/api/connections/${ids[0]}`);
    expect((await request(viewer, others[5]!)).status).toBe(201);
    const me = await viewer.agent.get('/api/users/me');
    expect(me.body.pass).toMatchObject({ activeConnections: 5, acceptedConnections: 0 });
  });

  it('Free: 10 accepted during the pass; removing one frees an open slot, not the total', async () => {
    // Accept the five pending (others 1..5), then remove them and connect five more.
    const pending = await db.connection.findMany({
      where: { requesterId: viewer.id, status: 'PENDING' },
    });
    for (const c of pending) {
      const other = others.find((o) => o.id === c.recipientId)!;
      expect((await other.agent.post(`/api/connections/${c.id}/accept`)).status).toBe(201);
    }
    for (const c of pending) await viewer.agent.delete(`/api/connections/${c.id}`);
    for (let i = 6; i < 11; i++) await connect(viewer, others[i]!);
    let me = await viewer.agent.get('/api/users/me');
    expect(me.body.pass).toMatchObject({ activeConnections: 5, acceptedConnections: 10 });
    expect(await db.connectionAcceptance.count({ where: { userId: viewer.id } })).toBe(10);

    // An open slot, but the accepted total is used up: the other side cannot accept.
    const c6 = await db.connection.findFirstOrThrow({
      where: { status: 'ACCEPTED', OR: [{ requesterId: viewer.id }, { recipientId: viewer.id }] },
    });
    await viewer.agent.delete(`/api/connections/${c6.id}`);
    const req = await request(viewer, others[11]!);
    expect(req.status).toBe(201);
    const acc = await others[11]!.agent.post(`/api/connections/${req.body.id}/accept`);
    expect(acc.status).toBe(403);
    expect(acc.body.error.code).toBe('OTHER_AT_LIMIT');

    // Elite raises the limits to 30 open / 60 accepted.
    await makeElite(viewer);
    expect((await others[11]!.agent.post(`/api/connections/${req.body.id}/accept`)).status).toBe(
      201,
    );
    me = await viewer.agent.get('/api/users/me');
    expect(me.body.pass).toMatchObject({
      plan: 'ELITE',
      activeConnectionsLimit: 30,
      acceptedConnectionsLimit: 60,
      acceptedConnections: 11,
    });
  });

  it('Elite: 15 people you are not connected with; the same person again is free', async () => {
    const elite = await joinedUser(ctx, 'Elite');
    const free = others[12]!;
    // Free cannot message outside connections.
    const denied = await free.agent.post('/api/conversations/direct').send({ userId: elite.id });
    expect(denied.body.error.code).toBe('ELITE_REQUIRED');

    await makeElite(elite);
    const targets = [...others.slice(0, 15)];
    let first: string | undefined;
    for (const t of targets) {
      const res = await elite.agent.post('/api/conversations/direct').send({ userId: t.id });
      expect(res.status, t.id).toBe(201);
      first ??= res.body.id;
    }
    const again = await elite.agent
      .post('/api/conversations/direct')
      .send({ userId: targets[0]!.id });
    expect(again.body.id).toBe(first);
    const over = await elite.agent.post('/api/conversations/direct').send({ userId: viewer.id });
    expect(over.status).toBe(403);
    expect(over.body.error.code).toBe('DM_CREDITS_USED');
    expect((await elite.agent.get('/api/users/me')).body.pass.directMessagesLeft).toBe(0);

    // The recipient (on Free, not connected) can reply in the existing thread.
    await elite.agent.post(`/api/conversations/${first}/messages`).send({ content: 'Hi!' });
    const reply = await targets[0]!.agent
      .post(`/api/conversations/${first}/messages`)
      .send({ content: 'Hello' });
    expect(reply.status).toBe(201);
    // ...and opening the same conversation from their side costs them nothing.
    expect(
      (await targets[0]!.agent.post('/api/conversations/direct').send({ userId: elite.id })).status,
    ).toBe(201);
  });

  it('Free discovery: everyone listed, details locked, "All" only', async () => {
    const free = others[13]!;
    const url = `/api/buyers?carId=${solarId}&cityId=${ctx.ahmedabad.id}`;
    const res = await free.agent.get(url);
    expect(res.status).toBe(200);
    expect(res.body.viewerPlan).toBe('FREE');
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const b of res.body.items) {
      expect(b.user.name).toBeTruthy();
      expect(b).toMatchObject({
        intentLevel: null,
        purchaseTimeline: null,
        holiday: null,
        activeRecently: null,
      });
    }
    const filtered = await free.agent.get(`${url}&filter=READY`);
    expect(filtered.status).toBe(403);
    expect(filtered.body.error.code).toBe('ELITE_REQUIRED');
    // Profiles and member lists hide the same details.
    const profile = await free.agent.get(`/api/users/${others[14]!.id}`);
    expect(profile.body).toMatchObject({ detailsLocked: true, lastActiveAt: null });
    expect(profile.body.activeIntents[0]).toMatchObject({ intentLevel: null });
  });

  it('Elite discovery: details, the Elite badge and who was active in the last 48 hours', async () => {
    const quiet = others[15]!;
    await lastActive(quiet.id);
    await db.user.update({
      where: { id: quiet.id },
      data: { lastActiveAt: new Date(Date.now() - 3 * DAY_MS) },
    });
    const url = `/api/buyers?carId=${solarId}&cityId=${ctx.ahmedabad.id}`;
    const res = await viewer.agent.get(`${url}&limit=50`);
    expect(res.body.viewerPlan).toBe('ELITE');
    const row = (id: string) =>
      res.body.items.find((b: { user: { id: string } }) => b.user.id === id);
    expect(row(quiet.id)).toMatchObject({ intentLevel: 'INTERESTED', activeRecently: false });
    expect(row(others[0]!.id).activeRecently).toBe(true);
    const eliteUser = await db.user.findFirstOrThrow({ where: { name: 'Elite' } });
    expect(row(eliteUser.id).user.elite).toBe(true);
    expect(row(others[0]!.id).user.elite).toBe(false);

    const active = await viewer.agent.get(`${url}&filter=ACTIVE_RECENT&limit=50`);
    expect(active.status).toBe(200);
    expect(active.body.items.map((b: { user: { id: string } }) => b.user.id)).not.toContain(
      quiet.id,
    );
    expect(active.body.counts.ACTIVE_RECENT).toBe(res.body.counts.ALL - 1);
  });

  it('Live Buyer Pulse: counts for everyone, the Elite numbers only for Elite', async () => {
    const url = `/api/buyers/count?carId=${solarId}&cityId=${ctx.ahmedabad.id}`;
    const free = await others[13]!.agent.get(url);
    expect(free.body.pulse).toMatchObject({
      elite: false,
      readyActiveRecently: null,
      newThisWeek: null,
    });
    expect(free.body.pulse.byIntentLevel.INTERESTED).toBe(free.body.count);
    expect(free.body.pulse.activeRecently).toBe(free.body.count - 1); // the quiet one
    const elite = await viewer.agent.get(url);
    expect(elite.body.pulse).toMatchObject({ elite: true, readyActiveRecently: 0 });
    expect(elite.body.pulse.newThisWeek).toBe(elite.body.count);
  });

  it('activity is written at most every 5 minutes', async () => {
    const u = others[14]!;
    await u.agent.get('/api/users/me');
    const first = await lastActive(u.id);
    await u.agent.get('/api/users/me');
    await new Promise((r) => setTimeout(r, 100));
    const second = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).lastActiveAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });
});

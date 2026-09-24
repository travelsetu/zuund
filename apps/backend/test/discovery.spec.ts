import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activateMemberships,
  createPost,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('buyer discovery', () => {
  let ctx: TestContext;
  let viewer: TestUser;
  let others: TestUser[];

  beforeAll(async () => {
    ctx = await setup();
    viewer = await registerUser(ctx, 'Viewer', ctx.ahmedabad.id);
    await createPost(viewer.agent, ctx.creta, ctx.ahmedabad, 'WITHIN_30_DAYS', 'COMMITTED');
    await activateMemberships(viewer);
    others = [];
    for (let i = 0; i < 5; i++) {
      const u = await registerUser(ctx, `Buyer${i}`, ctx.ahmedabad.id);
      await createPost(
        u.agent,
        ctx.creta,
        ctx.ahmedabad,
        'WITHIN_15_DAYS',
        i % 2 === 0 ? 'READY' : 'INTERESTED',
      );
      others.push(u);
    }
    // Noise that must never appear: same car other city, other car same city.
    const surat = await registerUser(ctx, 'SuratBuyer');
    await createPost(surat.agent, ctx.creta, ctx.surat);
    const venue = await registerUser(ctx, 'VenueBuyer');
    await createPost(venue.agent, ctx.venue, ctx.ahmedabad);
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const url = (extra = '') =>
    `/api/buyers?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}${extra}`;

  it('returns only the same car and city, excluding the viewer, with a plain count', async () => {
    const res = await viewer.agent.get(url());
    expect(res.status).toBe(200);
    expect(res.body.totalActiveBuyers).toBe(5);
    expect(res.body.items).toHaveLength(5);
    const ids = res.body.items.map((b: { user: { id: string } }) => b.user.id);
    expect(ids).not.toContain(viewer.id);
    for (const b of res.body.items) {
      expect(b.car.id).toBe(ctx.creta.id);
      expect(b.city.id).toBe(ctx.ahmedabad.id);
      expect(b.user).not.toHaveProperty('email');
      expect(b).not.toHaveProperty('budget');
      expect(JSON.stringify(b).toLowerCase()).not.toContain('score');
    }
  });

  it('someone who has not joined sees only the count, not the buyers', async () => {
    const stranger = await registerUser(ctx, 'Stranger');
    const res = await stranger.agent.get(url());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('JOIN_COLLECTIVE_FIRST');
    const count = await stranger.agent.get(
      `/api/buyers/count?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}`,
    );
    expect(count.body.count).toBe(6);
    // How the members plan, as counts: only the viewer has joined.
    expect(count.body.members).toEqual({
      byTimeline: { WITHIN_7_DAYS: 0, WITHIN_15_DAYS: 0, WITHIN_30_DAYS: 1, WITHIN_60_DAYS: 0 },
      byIntentLevel: { INTERESTED: 0, COMMITTED: 1, READY: 0 },
    });
  });

  it('filters by intent level', async () => {
    const ready = await viewer.agent.get(url('&filter=READY'));
    expect(ready.body.items).toHaveLength(3);
    const interested = await viewer.agent.get(url('&filter=INTERESTED'));
    expect(interested.body.items).toHaveLength(2);
    const committed = await viewer.agent.get(url('&filter=COMMITTED'));
    expect(committed.body.items).toHaveLength(0);
    // The headline count is the same whatever the filter.
    expect(ready.body.totalActiveBuyers).toBe(5);
  });

  it('paginates with an opaque cursor', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await viewer.agent.get(
        url(`&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
      );
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      seen.push(...res.body.items.map((b: { buyingIntentId: string }) => b.buyingIntentId));
      cursor = res.body.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    const bad = await viewer.agent.get(url('&cursor=garbage'));
    expect(bad.status).toBe(400);
  });

  it('excludes paused, closed and expired posts', async () => {
    const [a, b, c] = others;
    const postOf = async (u: TestUser) =>
      (await u.agent.get('/api/buying-intents')).body.items[0].id as string;
    await a!.agent.post(`/api/buying-intents/${await postOf(a!)}/status`).send({ action: 'PAUSE' });
    await b!.agent.post(`/api/buying-intents/${await postOf(b!)}/status`).send({ action: 'CLOSE' });
    const cId = await postOf(c!);
    const { db } = await import('./helpers');
    await db.buyingIntent.update({ where: { id: cId }, data: { status: 'EXPIRED' } });
    const res = await viewer.agent.get(url());
    expect(res.body.totalActiveBuyers).toBe(2);
    expect(res.body.items.map((x: { user: { id: string } }) => x.user.id)).not.toContain(a!.id);
    await a!.agent
      .post(`/api/buying-intents/${await postOf(a!)}/status`)
      .send({ action: 'RESUME' });
    expect((await viewer.agent.get(url())).body.totalActiveBuyers).toBe(3);
  });

  it('excludes users who blocked the viewer or were blocked by them', async () => {
    const [, , , d, e] = others;
    await d!.agent.post('/api/connections/block').send({ userId: viewer.id });
    await viewer.agent.post('/api/connections/block').send({ userId: e!.id });
    const res = await viewer.agent.get(url());
    const ids = res.body.items.map((x: { user: { id: string } }) => x.user.id);
    expect(ids).not.toContain(d!.id);
    expect(ids).not.toContain(e!.id);
    expect(res.body.totalActiveBuyers).toBe(1);
  });

  it('requires both car and city', async () => {
    expect((await viewer.agent.get(`/api/buyers?carId=${ctx.creta.id}`)).status).toBe(400);
  });
});

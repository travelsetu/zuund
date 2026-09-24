import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activateMemberships,
  db,
  makeElite,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

/** Central Ahmedabad; the others are roughly 3, 8, 20 and 40 km away. */
const HERE = { latitude: 23.0225, longitude: 72.5714 };
const AWAY_KM: Array<[number, { latitude: number; longitude: number }]> = [
  [3, { latitude: 23.0495, longitude: 72.5714 }],
  [8, { latitude: 23.0945, longitude: 72.5714 }],
  [20, { latitude: 23.2025, longitude: 72.5714 }],
  [40, { latitude: 23.3825, longitude: 72.5714 }],
];

describe('location: device first, IP as fallback, bands only', () => {
  let ctx: TestContext;
  let viewer: TestUser;
  const others: TestUser[] = [];

  const post = (u: TestUser, location?: { latitude: number; longitude: number }) =>
    u.agent.post('/api/buying-intents').send({
      carId: ctx.creta.id,
      cityId: ctx.ahmedabad.id,
      purchaseTimeline: 'WITHIN_30_DAYS',
      intentLevel: 'READY',
      ...(location ? { location } : {}),
    });

  beforeAll(async () => {
    ctx = await setup();
    viewer = await registerUser(ctx, 'Viewer', ctx.ahmedabad.id);
    for (let i = 0; i < 5; i++) others.push(await registerUser(ctx, `Near${i}`));
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('a device position is stored rounded to ~1 km and never returned', async () => {
    const res = await post(viewer, { latitude: 23.022549, longitude: 72.571362 });
    expect(res.status).toBe(201);
    expect(res.body.locationSource).toBe('GPS');
    expect(JSON.stringify(res.body)).not.toContain('23.02');
    const row = await db.buyingIntent.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({ latitude: 23.02, longitude: 72.57, locationSource: 'GPS' });
    await activateMemberships(viewer);
  });

  it('without a device position, the IP is used when it resolves (not for a local address)', async () => {
    const res = await post(others[0]!);
    expect(res.status).toBe(201);
    // Tests call from 127.0.0.1, which never resolves outside development.
    expect(res.body.locationSource).toBeNull();
    const bad = await others[1]!.agent.post('/api/buying-intents').send({
      carId: ctx.creta.id,
      cityId: ctx.ahmedabad.id,
      purchaseTimeline: 'WITHIN_30_DAYS',
      location: { latitude: 123, longitude: 72 },
    });
    expect(bad.status).toBe(400);
  });

  it('the nearest city to a device position, for pre-selecting', async () => {
    await db.city.update({ where: { id: ctx.ahmedabad.id }, data: HERE });
    const res = await viewer.agent.get(
      `/api/geo/nearest?latitude=${HERE.latitude + 0.05}&longitude=${HERE.longitude}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.city?.id).toBe(ctx.ahmedabad.id);
    const far = await viewer.agent.get('/api/geo/nearest?latitude=0&longitude=0');
    expect(far.body.city).toBeNull();
  });

  it('Elite sees nearby buyers in bands; 1–2 read "fewer than 3"; Free sees none', async () => {
    // others[0] has no location; place the rest at 3, 8, 20 and 40 km.
    await db.buyingIntent.deleteMany({ where: { userId: others[0]!.id } });
    for (let i = 0; i < 4; i++) {
      const res = await post(others[i + 1]!, AWAY_KM[i]![1]);
      expect(res.status).toBe(201);
    }
    const url = `/api/buyers/count?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}`;
    const free = await viewer.agent.get(url);
    expect(free.body.pulse.nearby).toBeNull();

    await makeElite(viewer);
    const elite = await viewer.agent.get(url);
    const byKm = Object.fromEntries(elite.body.pulse.nearby.map((b: { km: number }) => [b.km, b]));
    // 5 km: one buyer → "fewer than 3"; 10 km: two → still hidden; 25 km: three.
    expect(byKm[5]).toMatchObject({ count: 3, fewerThan: true });
    expect(byKm[10]).toMatchObject({ count: 3, fewerThan: true });
    expect(byKm[25]).toMatchObject({ count: 3, fewerThan: false });

    // Buyer cards say the band, not the distance.
    const list = await viewer.agent.get(
      `/api/buyers?carId=${ctx.creta.id}&cityId=${ctx.ahmedabad.id}&limit=50`,
    );
    const band = (u: TestUser) =>
      list.body.items.find((b: { user: { id: string } }) => b.user.id === u.id)?.withinKm;
    expect(band(others[1]!)).toBe(5);
    expect(band(others[2]!)).toBe(10);
    expect(band(others[3]!)).toBe(25);
    expect(band(others[4]!)).toBeNull();
    expect(JSON.stringify(list.body)).not.toMatch(/latitude|longitude/);
  });
});

import request from 'supertest';
import { isTravelWeekOpen, travelMonthOptions, travelWeekDays } from '@zuund/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activateMemberships,
  createPost,
  db,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  makeElite,
} from './helpers';

describe('catalog categories', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('search returns category and segment', async () => {
    const res = await request(ctx.server).get('/api/cars?q=Creta');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      displayName: 'Hyundai Creta',
      category: 'CAR',
      segment: 'SUV',
    });
  });

  it('category filter keeps cars and solar apart', async () => {
    const solar = await request(ctx.server).get('/api/cars?category=SOLAR&limit=50');
    expect(solar.body.length).toBeGreaterThan(0);
    expect(solar.body.every((c: { category: string }) => c.category === 'SOLAR')).toBe(true);
    const cars = await request(ctx.server).get('/api/cars?category=CAR&q=Solar');
    expect(cars.body).toEqual([]);
  });

  it('matches word by word', async () => {
    const res = await request(ctx.server).get('/api/cars?q=maruti%20swift');
    expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(['maruti-suzuki-swift']);
  });

  it('lists brands with model counts per category', async () => {
    const cars = await request(ctx.server).get('/api/cars/brands?category=CAR');
    expect(cars.status).toBe(200);
    expect(cars.body).toEqual(expect.arrayContaining([{ name: 'Hyundai', count: 13 }]));
    const names = cars.body.map((b: { name: string }) => b.name);
    expect(names).toEqual([...names].sort());
    const solar = await request(ctx.server).get('/api/cars/brands?category=SOLAR');
    expect(solar.body).toEqual([{ name: 'Rooftop Solar', count: 11 }]);
    expect(solar.body.map((b: { name: string }) => b.name)).not.toContain('Hyundai');
  });

  it('filters models by brand, case-insensitively', async () => {
    const res = await request(ctx.server).get('/api/cars?category=CAR&brand=hyundai&limit=50');
    expect(res.body).toHaveLength(13);
    expect(res.body.every((c: { brand: string }) => c.brand === 'Hyundai')).toBe(true);
  });

  it('lists solar by system size only, smallest first', async () => {
    const res = await request(ctx.server).get('/api/cars?category=SOLAR&limit=50');
    expect(res.body.map((c: { displayName: string }) => c.displayName)).toEqual([
      '1 kW Rooftop Solar',
      '2 kW Rooftop Solar',
      '3 kW Rooftop Solar',
      '4 kW Rooftop Solar',
      '5 kW Rooftop Solar',
      '6 kW Rooftop Solar',
      '7 kW Rooftop Solar',
      '8 kW Rooftop Solar',
      '9 kW Rooftop Solar',
      '10 kW Rooftop Solar',
      '10+ kW Rooftop Solar',
    ]);
  });

  it('keeps renamed models on their original slug so old posts carry over', async () => {
    const xuv = await db.car.findUniqueOrThrow({ where: { slug: 'mahindra-xuv700' } });
    expect(xuv).toMatchObject({
      model: 'XUV 7XO',
      displayName: 'Mahindra XUV 7XO',
      status: 'ACTIVE',
    });
  });

  it('includes new body types and electric models', async () => {
    const res = await request(ctx.server).get('/api/cars?category=CAR&q=eeco');
    expect(res.body[0]).toMatchObject({ displayName: 'Maruti Suzuki Eeco', segment: 'Van' });
    const ev = await request(ctx.server).get('/api/cars?category=CAR&q=nexon%20ev');
    expect(ev.body[0]).toMatchObject({ segment: 'EV' });
  });

  it('rejects an unknown category', async () => {
    const res = await request(ctx.server).get('/api/cars?category=REAL_ESTATE');
    expect(res.status).toBe(400);
  });

  it('a solar system works as a buying post and in discovery', async () => {
    const panel = await db.car.findUniqueOrThrow({ where: { slug: '3-kw-rooftop-solar' } });
    const a = await registerUser(ctx, 'SolarA', ctx.ahmedabad.id);
    const b = await registerUser(ctx, 'SolarB', ctx.ahmedabad.id);
    await createPost(a.agent, panel, ctx.ahmedabad);
    await createPost(b.agent, panel, ctx.ahmedabad);
    await activateMemberships(a);
    const res = await a.agent.get(`/api/buyers?carId=${panel.id}&cityId=${ctx.ahmedabad.id}`);
    expect(res.status).toBe(200);
    expect(res.body.totalActiveBuyers).toBe(1);
    expect(res.body.car.category).toBe('SOLAR');
  });

  it('splits holiday packages into Domestic and International', async () => {
    const types = await request(ctx.server).get('/api/cars/brands?category=HOLIDAY');
    expect(types.body.map((b: { name: string }) => b.name)).toEqual(['Domestic', 'International']);
    const domestic = await request(ctx.server).get(
      '/api/cars?category=HOLIDAY&brand=Domestic&limit=100',
    );
    const names = domestic.body.map((c: { model: string }) => c.model);
    // Over 50 of them, so the whole list must fit one request.
    expect(names.length).toBeGreaterThan(50);
    expect(names).toEqual(
      expect.arrayContaining([
        'Goa',
        'Kashmir',
        'Kerala Backwaters',
        // Whole-state tours
        'Himachal',
        'Uttarakhand',
        'Kerala',
        'Rajasthan',
        'South India',
        'Gujarat',
      ]),
    );
    expect(names).not.toContain('Dubai');
    expect(domestic.body[0]).toMatchObject({ category: 'HOLIDAY', brand: 'Domestic' });
    // A search stays inside the chosen trip type.
    const abroad = await request(ctx.server).get(
      '/api/cars?category=HOLIDAY&brand=International&q=bali',
    );
    expect(abroad.body).toEqual([
      expect.objectContaining({ displayName: 'Bali Holiday Package', segment: 'Southeast Asia' }),
    ]);
    const wrongType = await request(ctx.server).get(
      '/api/cars?category=HOLIDAY&brand=Domestic&q=bali',
    );
    expect(wrongType.body).toEqual([]);
  });

  it('a holiday destination works as a buying post', async () => {
    const goa = await db.car.findUniqueOrThrow({ where: { slug: 'goa-holiday-package' } });
    const a = await registerUser(ctx, 'TripA', ctx.surat.id);
    const b = await registerUser(ctx, 'TripB', ctx.surat.id);
    await createPost(a.agent, goa, ctx.surat);
    await createPost(b.agent, goa, ctx.surat);
    await activateMemberships(a);
    const res = await a.agent.get(`/api/buyers?carId=${goa.id}&cityId=${ctx.surat.id}`);
    expect(res.body.totalActiveBuyers).toBe(1);
    expect(res.body.car.category).toBe('HOLIDAY');
  });

  it('a holiday post needs its trip: month, travellers, nights and hotel', async () => {
    const bali = await db.car.findUniqueOrThrow({ where: { slug: 'bali-holiday-package' } });
    const creta = await db.car.findUniqueOrThrow({ where: { slug: 'hyundai-creta' } });
    const a = await registerUser(ctx, 'Tripper', ctx.surat.id);
    const b = await registerUser(ctx, 'Other', ctx.surat.id);
    const months = travelMonthOptions();
    const trip = {
      travelMonth: months[3],
      travelWeek: 3,
      adults: 2,
      childAges: [4, 9],
      nights: 5,
      hotelCategory: 'FOUR_STAR',
    };
    const base = { cityId: ctx.surat.id, purchaseTimeline: 'WITHIN_30_DAYS' };

    const none = await a.agent.post('/api/buying-intents').send({ ...base, carId: bali.id });
    expect(none.body.error.code).toBe('HOLIDAY_DETAILS_REQUIRED');
    // Only this month and the next three.
    const [y, m] = months[3]!.split('-').map(Number);
    const tooFar = `${m === 12 ? y! + 1 : y}-${String((m! % 12) + 1).padStart(2, '0')}`;
    const far = await a.agent
      .post('/api/buying-intents')
      .send({ ...base, carId: bali.id, holiday: { ...trip, travelMonth: tooFar } });
    expect(far.body.error.code).toBe('TRAVEL_MONTH_OUT_OF_RANGE');
    const noWeek = await a.agent
      .post('/api/buying-intents')
      .send({ ...base, carId: bali.id, holiday: { ...trip, travelWeek: 5 } });
    expect(noWeek.status).toBe(400);
    const bad = await a.agent
      .post('/api/buying-intents')
      .send({ ...base, carId: bali.id, holiday: { ...trip, adults: 0, childAges: [12] } });
    expect(bad.status).toBe(400);
    const notHoliday = await a.agent
      .post('/api/buying-intents')
      .send({ ...base, carId: creta.id, holiday: trip });
    expect(notHoliday.status).toBe(400);

    const ok = await a.agent
      .post('/api/buying-intents')
      .send({ ...base, carId: bali.id, holiday: trip });
    expect(ok.status).toBe(201);
    expect(ok.body.holiday).toEqual(trip);

    // Another buyer of the same trip: on Free the trip is locked; on Elite they see the
    // plan, but not the children's ages.
    await createPost(b.agent, bali, ctx.surat);
    await activateMemberships(b);
    const url = `/api/buyers?carId=${bali.id}&cityId=${ctx.surat.id}`;
    expect((await b.agent.get(url)).body.items[0].holiday).toBeNull();
    await makeElite(b);
    const seen = await b.agent.get(url);
    expect(seen.body.items[0].holiday).toEqual({
      travelMonth: months[3],
      travelWeek: 3,
      adults: 2,
      children: 2,
      nights: 5,
      hotelCategory: 'FOUR_STAR',
    });
    // Cars carry no trip.
    const car = await createPost(a.agent, creta, ctx.surat);
    expect((await a.agent.get(`/api/buying-intents/${car.id}`)).body.holiday).toBeNull();
  });

  it('weeks of the current month that are over are closed (Indian time)', () => {
    const now = new Date('2026-09-23T06:00:00Z'); // 23 Sep, 11:30 IST
    expect([1, 2, 3, 4].map((w) => isTravelWeekOpen('2026-09', w, now))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(isTravelWeekOpen('2026-10', 1, now)).toBe(true);
    expect(isTravelWeekOpen('2026-08', 4, now)).toBe(false);
    // 21 Sep 20:00 UTC is already 22 Sep in India: week 3 (15–21) is over.
    expect(isTravelWeekOpen('2026-09', 3, new Date('2026-09-21T20:00:00Z'))).toBe(false);
    expect(travelWeekDays('2027-02', 4)).toEqual([22, 28]);
  });
  it('landing overview: whole catalog, and demand only once enough people are buying', async () => {
    const solar = await request(ctx.server).get('/api/catalog/overview?category=SOLAR');
    expect(solar.status).toBe(200);
    expect(solar.body.items).toHaveLength(11);
    expect(solar.body.items[0].displayName).toBe('1 kW Rooftop Solar');
    expect(solar.body.brands).toEqual([{ name: 'Rooftop Solar', count: 11 }]);
    // Two solar buyers so far: too few to show anything.
    expect(solar.body.demand).toBeNull();

    const kashmir = await db.car.findUniqueOrThrow({ where: { slug: 'kashmir-holiday-package' } });
    const others = await db.car.findMany({
      where: { category: 'HOLIDAY', status: 'ACTIVE', slug: { not: kashmir.slug } },
      take: 9,
    });
    // A city nobody else in this file posts in, with just two travellers.
    const quiet = ctx.cities.find((c) => c.id !== ctx.ahmedabad.id && c.id !== ctx.surat.id)!;
    for (let i = 0; i < 12; i++) {
      const city = i < 10 ? ctx.ahmedabad : quiet;
      const u = await registerUser(ctx, `Traveller${i}`, city.id);
      await createPost(u.agent, i < 3 ? kashmir : others[i - 3]!, city);
    }
    const res = await request(ctx.server).get('/api/catalog/overview?category=HOLIDAY');
    expect(res.body.items.length).toBeGreaterThan(80);
    const d = res.body.demand;
    expect(d.buyers).toBeGreaterThanOrEqual(12);
    expect(d.newThisWeek).toBeGreaterThanOrEqual(12);
    expect(d.topItems).toContainEqual({ carId: kashmir.id, buyers: 3 });
    // A destination or city with one or two buyers never appears.
    expect(d.topItems.every((r: { buyers: number }) => r.buyers >= 3)).toBe(true);
    expect(d.topCities.map((c: { name: string }) => c.name)).toContain(ctx.ahmedabad.name);
    expect(d.topCities.map((c: { name: string }) => c.name)).not.toContain(quiet.name);
    expect(JSON.stringify(res.body)).not.toMatch(/Traveller/);

    expect((await request(ctx.server).get('/api/catalog/overview?category=BIKES')).status).toBe(
      400,
    );
  });
});

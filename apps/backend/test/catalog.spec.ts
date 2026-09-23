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
    const res = await a.agent.get(`/api/buyers?carId=${panel.id}&cityId=${ctx.ahmedabad.id}`);
    expect(res.status).toBe(200);
    expect(res.body.totalActiveBuyers).toBe(1);
    expect(res.body.car.category).toBe('SOLAR');
  });

  it('splits holiday packages into Domestic and International', async () => {
    const types = await request(ctx.server).get('/api/cars/brands?category=HOLIDAY');
    expect(types.body.map((b: { name: string }) => b.name)).toEqual(['Domestic', 'International']);
    const domestic = await request(ctx.server).get(
      '/api/cars?category=HOLIDAY&brand=Domestic&limit=50',
    );
    const names = domestic.body.map((c: { model: string }) => c.model);
    expect(names).toEqual(expect.arrayContaining(['Goa', 'Kashmir', 'Kerala Backwaters']));
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
    const res = await a.agent.get(`/api/buyers?carId=${goa.id}&cityId=${ctx.surat.id}`);
    expect(res.body.totalActiveBuyers).toBe(1);
    expect(res.body.car.category).toBe('HOLIDAY');
  });
});

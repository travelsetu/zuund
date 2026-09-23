import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/catalog/catalog.service';
import { db, setup, teardown, teardownAll, type TestContext } from './helpers';

describe('countries, cities and IP location', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setup();
    await db.country.createMany({
      data: [
        { code: 'GB', name: 'United Kingdom', continent: 'EU' },
        { code: 'SE', name: 'Sweden', continent: 'EU' },
        { code: 'AQ', name: 'Antarctica', continent: 'AN' },
      ],
    });
    await db.city.create({
      data: {
        name: 'London',
        state: 'England',
        slug: 'london-gb',
        countryCode: 'GB',
        geonameId: 2643743,
        population: 8961989,
        latitude: 51.50853,
        longitude: -0.12574,
      },
    });
    await db.city.update({ where: { slug: 'surat' }, data: { population: 4591246 } });
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('lists only countries that have cities', async () => {
    const res = await request(ctx.server).get('/api/countries');
    expect(res.status).toBe(200);
    const codes = res.body.map((c: { code: string }) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['IN', 'GB']));
    expect(codes).not.toContain('AQ');
    expect(codes).not.toContain('SE');
  });

  it('lists cities per country, searchable, with the country code', async () => {
    const gb = await request(ctx.server).get('/api/cities?country=gb');
    expect(gb.body).toEqual([expect.objectContaining({ name: 'London', countryCode: 'GB' })]);
    const sur = await request(ctx.server).get('/api/cities?country=IN&q=sur');
    expect(sur.body[0]).toMatchObject({ name: 'Surat', countryCode: 'IN' });
    const byState = await request(ctx.server).get('/api/cities?country=IN&q=gujarat');
    expect(byState.body.map((c: { name: string }) => c.name)).toContain('Ahmedabad');
  });

  it('defaults to India and rejects a malformed country code', async () => {
    const res = await request(ctx.server).get('/api/cities');
    expect(res.body.every((c: { countryCode: string }) => c.countryCode === 'IN')).toBe(true);
    expect((await request(ctx.server).get('/api/cities?country=IND')).status).toBe(400);
  });

  it('guesses country and city from the forwarded IP', async () => {
    const res = await request(ctx.server).get('/api/geo').set('X-Forwarded-For', '81.2.69.142');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      country: { code: 'GB', name: 'United Kingdom' },
      city: { name: 'London', countryCode: 'GB' },
    });
  });

  it('returns the country alone when the city is not in our list', async () => {
    const res = await request(ctx.server).get('/api/geo').set('X-Forwarded-For', '89.160.20.112');
    expect(res.body).toEqual({ country: { code: 'SE', name: 'Sweden' }, city: null });
  });

  it('returns nothing for private or unknown addresses', async () => {
    for (const ip of ['10.0.0.5', '192.168.1.9', '1.1.1.1']) {
      const res = await request(ctx.server).get('/api/geo').set('X-Forwarded-For', ip);
      expect(res.body).toEqual({ country: null, city: null });
    }
  });

  it('finds the city from coordinates when the database has no GeoNames id (DB-IP)', async () => {
    const catalog = ctx.app.get(CatalogService);
    await db.city.create({
      data: {
        name: 'Croydon',
        state: 'England',
        slug: 'croydon-gb',
        countryCode: 'GB',
        population: 192064,
        latitude: 51.38333,
        longitude: -0.1,
      },
    });
    // Same name nearby wins, even with DB-IP's bracketed locality.
    expect(await catalog.findNearestCity('GB', 51.45, -0.11, 'London (Brixton)')).toMatchObject({
      name: 'London',
    });
    // No name match: the nearest city within 40 km.
    expect(await catalog.findNearestCity('GB', 51.39, -0.09, 'Thornton Heath')).toMatchObject({
      name: 'Croydon',
    });
    // Too far from any listed city, or another country: no guess.
    expect(await catalog.findNearestCity('GB', 52.2, 0.12, 'Cambridge')).toBeNull();
    expect(await catalog.findNearestCity('IN', 51.5, -0.12, 'London')).toBeNull();
  });
});

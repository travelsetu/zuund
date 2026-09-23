import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';

/** @nestjs/throttler does not re-export this token from its index. */
const THROTTLER_OPTIONS = 'THROTTLER:MODULE_OPTIONS';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { travelMonthOptions } from '@zuund/shared';
import { OtpSender } from '../src/otp/otp.sender';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { CARS, CITIES, HOLIDAYS, SOLAR, slugify } from '../prisma/seed-data';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import type { Car, City } from '../src/generated/prisma/client';
import { TEST_DATABASE_URL } from './env';

export type Agent = TestAgent;

export const ADMIN_EMAIL = 'admin@test.zuund';
export const ADMIN_PASSWORD = 'AdminPass123!';
export const USER_PASSWORD = 'password123';

/** A direct Prisma client for assertions and fixtures, separate from the app's. */
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
});

export interface TestContext {
  app: INestApplication;
  server: ReturnType<INestApplication['getHttpServer']>;
  cars: Car[];
  cities: City[];
  creta: Car;
  venue: Car;
  ahmedabad: City;
  surat: City;
}

/** Boots the real AppModule with only the rate limiter disabled. */
export async function createApp(): Promise<INestApplication> {
  // The guard is registered as APP_GUARD, so overriding the class token is not enough;
  // the options provider is what the guard reads, and skipIf turns it off entirely.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(THROTTLER_OPTIONS)
    .useValue({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 1_000_000 }],
      skipIf: () => true,
    })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>(undefined, {
    rawBody: true,
    logger: false,
  });
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.use(cookieParser());
  await app.init();
  return app;
}

/** Empties every table except the migrations ledger, then seeds the catalog and the admin. */
export async function resetDatabase(): Promise<{ cars: Car[]; cities: City[] }> {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  await db.country.create({ data: { code: 'IN', name: 'India', continent: 'AS' } });
  for (const city of CITIES) await db.city.create({ data: city });
  const catalog = [
    ...CARS.map((c) => ({ ...c, category: 'CAR' as const })),
    ...SOLAR.map((s) => ({ ...s, category: 'SOLAR' as const })),
    ...HOLIDAYS.map((h) => ({ ...h, category: 'HOLIDAY' as const })),
  ];
  for (const item of catalog) {
    const displayName = 'displayName' in item ? item.displayName : `${item.brand} ${item.model}`;
    await db.car.create({
      data: {
        category: item.category,
        brand: item.brand,
        model: item.model,
        segment: item.segment,
        displayName,
        slug: ('slug' in item && item.slug) || slugify(displayName),
      },
    });
  }
  await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      passwordHash: await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id }),
      role: 'ADMIN',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });
  // ctx.cars stays cars-only: several specs pick fixtures by index.
  return {
    cars: await db.car.findMany({ where: { category: 'CAR' } }),
    cities: await db.city.findMany(),
  };
}

export async function setup(): Promise<TestContext> {
  const { cars, cities } = await resetDatabase();
  const app = await createApp();
  const pick = <T extends { slug: string }>(rows: T[], slug: string): T => {
    const r = rows.find((x) => x.slug === slug);
    if (!r) throw new Error(`fixture ${slug} missing`);
    return r;
  };
  return {
    app,
    server: app.getHttpServer(),
    cars,
    cities,
    creta: pick(cars, 'hyundai-creta'),
    venue: pick(cars, 'hyundai-venue'),
    ahmedabad: pick(cities, 'ahmedabad'),
    surat: pick(cities, 'surat'),
  };
}

export async function teardown(ctx: TestContext | undefined): Promise<void> {
  await ctx?.app.close();
}

export async function teardownAll(): Promise<void> {
  await db.$disconnect();
}

// ── Users ──

export interface TestUser {
  agent: Agent;
  id: string;
  phone: string;
  name: string;
}

/** Asks for a WhatsApp code and returns it (tests use the `log` provider, which keeps it). */
export async function otpFor(ctx: TestContext, phone: string): Promise<string> {
  // Skip the resend wait and hourly cap between test steps; phone.spec tests those directly.
  await db.otpChallenge.deleteMany({ where: { phone } });
  const res = await request(ctx.server).post('/api/auth/otp').send({ phone });
  if (res.status !== 200) throw new Error(`otp failed: ${res.status} ${JSON.stringify(res.body)}`);
  const code = ctx.app.get(OtpSender).sentForTests.get(phone);
  if (!code) throw new Error(`no code recorded for ${phone}`);
  return code;
}

let userSeq = 0;

/** A valid, unique Indian mobile number per test user (the DB is reset per spec file). */
export function testPhone(n: number): string {
  return `+9198${String(n).padStart(8, '0')}`;
}

export async function registerUser(
  ctx: TestContext,
  name: string,
  cityId?: string,
): Promise<TestUser> {
  const agent = request.agent(ctx.server);
  const phone = testPhone(++userSeq);
  const code = await otpFor(ctx, phone);
  const res = await agent.post('/api/auth/register').send({ name, code, cityId, phone });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, id: res.body.user.id as string, phone, name };
}

export async function login(
  ctx: TestContext,
  email: string,
  password = USER_PASSWORD,
): Promise<Agent> {
  const agent = request.agent(ctx.server);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function adminAgent(ctx: TestContext): Promise<Agent> {
  return login(ctx, ADMIN_EMAIL, ADMIN_PASSWORD);
}

// ── Domain helpers ──

export async function createPost(
  agent: Agent,
  car: Car,
  city: City,
  purchaseTimeline:
    'WITHIN_7_DAYS' | 'WITHIN_15_DAYS' | 'WITHIN_30_DAYS' | 'WITHIN_60_DAYS' = 'WITHIN_30_DAYS',
  intentLevel: 'INTERESTED' | 'COMMITTED' | 'READY' = 'INTERESTED',
) {
  // Holiday packages need the trip; any valid one will do for most specs.
  const holiday =
    car.category === 'HOLIDAY'
      ? {
          travelMonth: travelMonthOptions()[1],
          travelWeek: 2,
          adults: 2,
          childAges: [],
          nights: 4,
          hotelCategory: 'THREE_STAR',
        }
      : undefined;
  const res = await agent
    .post('/api/buying-intents')
    .send({ carId: car.id, cityId: city.id, purchaseTimeline, intentLevel, holiday });
  if (res.status !== 201)
    throw new Error(`createPost failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; status: string; intentLevel: string; purchaseTimeline: string };
}

/** Creates (or joins the existing) collective for the post; membership is PENDING_PAYMENT afterwards. */
export async function joinCollective(agent: Agent, buyingIntentId: string) {
  const res = await agent.post('/api/collectives').send({ buyingIntentId });
  if (res.status !== 201)
    throw new Error(`collective failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as {
    id: string;
    conversationId: string | null;
    membership: { status: string } | null;
  };
}

export async function startPayment(
  agent: Agent,
  buyingIntentId: string,
  collectiveId: string,
  idempotencyKey = `key-${randomUUID()}`,
) {
  const res = await agent
    .post('/api/payments')
    .send({ buyingIntentId, collectiveId, idempotencyKey });
  if (res.status !== 201)
    throw new Error(`payment create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as {
    payment: { id: string; status: string; amount: number };
    provider: string;
    checkout: { orderId: string };
  };
}

export function mockVerifyBody(
  checkout: { payment: { id: string }; checkout: { orderId: string } },
  providerPaymentId = `mock_pay_${randomUUID()}`,
) {
  return {
    paymentId: checkout.payment.id,
    providerOrderId: checkout.checkout.orderId,
    providerPaymentId,
    providerSignature: `mock:${checkout.checkout.orderId}`,
  };
}

/** Full happy path: open payment, verify it through the mock provider. */
export async function payFor(agent: Agent, buyingIntentId: string, collectiveId: string) {
  const checkout = await startPayment(agent, buyingIntentId, collectiveId);
  const res = await agent.post('/api/payments/verify').send(mockVerifyBody(checkout));
  if (res.status !== 201)
    throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    checkout,
    payment: res.body as { id: string; status: string; buyingPassId: string | null },
  };
}

export async function connect(a: TestUser, b: TestUser): Promise<string> {
  const req = await a.agent.post('/api/connections').send({ userId: b.id });
  if (req.status !== 201)
    throw new Error(`connect request failed: ${req.status} ${JSON.stringify(req.body)}`);
  const acc = await b.agent.post(`/api/connections/${req.body.id}/accept`);
  if (acc.status !== 201)
    throw new Error(`accept failed: ${acc.status} ${JSON.stringify(acc.body)}`);
  return req.body.id as string;
}

export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
export const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 1)]);

export async function upload(agent: Agent, buffer: Buffer, filename: string, contentType: string) {
  return agent.post('/api/files').attach('file', buffer, { filename, contentType });
}

export const DAY_MS = 86_400_000;

/**
 * Joins the collective for each of the user's active posts, then stands in for the
 * payment (tests have no free places): the memberships become ACTIVE.
 */
export async function activateMemberships(user: TestUser): Promise<void> {
  const posts = await db.buyingIntent.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      memberships: { none: { status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } } },
    },
    select: { id: true },
  });
  for (const p of posts) {
    const res = await user.agent.post('/api/collectives').send({ buyingIntentId: p.id });
    if (res.status !== 201)
      throw new Error(`join failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const { count } = await db.collectiveMembership.updateMany({
    where: { userId: user.id, status: 'PENDING_PAYMENT' },
    data: { status: 'ACTIVE', joinedAt: new Date() },
  });
  if (!count) throw new Error('activateMemberships: nothing pending for this user');
}

/**
 * A user who has joined a collective, so they may see and contact other buyers. The
 * membership is for 1 kW rooftop solar, which the car specs never look at.
 */
export async function joinedUser(
  ctx: TestContext,
  name: string,
  cityId?: string,
): Promise<TestUser> {
  const u = await registerUser(ctx, name, cityId);
  const solar = await db.car.findUniqueOrThrow({ where: { slug: '1-kw-rooftop-solar' } });
  await createPost(u.agent, solar, ctx.ahmedabad);
  await activateMemberships(u);
  return u;
}

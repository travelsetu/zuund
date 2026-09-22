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
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { CARS, CITIES, slugify } from '../prisma/seed-data';
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
  for (const city of CITIES) await db.city.create({ data: city });
  for (const car of CARS) {
    const displayName = `${car.brand} ${car.model}`;
    await db.car.create({
      data: { brand: car.brand, model: car.model, displayName, slug: slugify(displayName) },
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
  return { cars: await db.car.findMany(), cities: await db.city.findMany() };
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
  email: string;
  name: string;
}

let userSeq = 0;

export async function registerUser(
  ctx: TestContext,
  name: string,
  cityId?: string,
): Promise<TestUser> {
  const agent = request.agent(ctx.server);
  const email = `${name.toLowerCase().replace(/[^a-z]/g, '')}${++userSeq}-${randomUUID().slice(0, 6)}@test.zuund`;
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email, password: USER_PASSWORD, cityId });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, id: res.body.user.id as string, email, name };
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
  const res = await agent
    .post('/api/buying-intents')
    .send({ carId: car.id, cityId: city.id, purchaseTimeline, intentLevel });
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

import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_DATABASE_URL = 'postgresql://zuund:zuund@localhost:5432/zuund_test?schema=public';

/** Everything the app needs, pointed at the test database. Never the dev database. */
export function applyTestEnv(): void {
  const env: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: '3998',
    HOST: '127.0.0.1',
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-0123456789',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    COOKIE_SECURE: 'false',
    CORS_ORIGIN: 'http://localhost:5173',
    PUBLIC_API_URL: 'http://localhost:3000',
    UPLOAD_DIR: join(tmpdir(), 'zuund-test-uploads'),
    // Never the real bucket: a developer's .env may point uploads at S3.
    STORAGE_DRIVER: 'local',
    UPLOAD_MAX_BYTES: String(10 * 1024 * 1024),
    ELITE_PASS_AMOUNT: '49900',
    ELITE_PASS_DAYS: '30',
    FREE_PASS_DAYS: '15',
    REFUND_ON_LEAVE: 'NONE',
    PAYMENT_PROVIDER: 'mock',
    // Codes are kept in memory (OtpSender.sentForTests) instead of going to WhatsApp.
    OTP_PROVIDER: 'log',
    // MaxMind's public test database (fixed sample IPs), so geo lookups run offline.
    GEOIP_DB_PATH: join(__dirname, 'fixtures', 'GeoIP2-City-Test.mmdb'),
  };
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  // Nothing from a developer's shell may leak into the test run.
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.CLOUDFRONT_PRIVATE_KEY_B64;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
}

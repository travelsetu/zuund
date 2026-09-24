import { z } from 'zod';

const DURATION_RE = /^(\d+)(s|m|h|d)$/;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

/** Parses "15m" / "7d" style durations into seconds. */
export function parseDurationSeconds(input: string): number {
  const match = DURATION_RE.exec(input.trim());
  if (!match) throw new Error(`Invalid duration "${input}"; expected e.g. 15m, 12h, 7d`);
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_SECONDS;
  return amount * UNIT_SECONDS[unit];
}

const duration = z
  .string()
  .regex(DURATION_RE, 'Expected a duration like 15m, 12h or 7d')
  .transform(parseDurationSeconds);

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Bind address. Production binds 127.0.0.1 so only nginx can reach the API. */
  HOST: z.string().min(1).default('0.0.0.0'),

  DATABASE_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  /** Seconds. */
  JWT_ACCESS_TTL: duration.default(15 * 60),
  /** Seconds. */
  JWT_REFRESH_TTL: duration.default(7 * 86_400),

  COOKIE_SECURE: bool,
  COOKIE_DOMAIN: z.string().min(1).optional(),

  /** Comma-separated list of allowed origins. */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  /** Public base URL of this API, used to build file URLs. */
  PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  /** Where uploaded files are written. Served at PUBLIC_API_URL/uploads/… */
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),

  // ── Location ──
  /**
   * IP → city database in MaxMind format: DB-IP "IP to City Lite", which
   * scripts/geoip-update.mjs downloads monthly (a GeoLite2-City file works too). Missing file =
   * location guessing is off and GET /geo answers { country: null, city: null }.
   */
  GEOIP_DB_PATH: z.string().default('./data/dbip-city-lite.mmdb'),

  // ── WhatsApp sign-in codes (MSG91) ──
  /**
   * `msg91` sends codes on WhatsApp; `log` only writes them to the server log (development
   * and tests). Defaults to msg91 when an auth key is set.
   */
  OTP_PROVIDER: z.enum(['msg91', 'log']).optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  /** The WhatsApp business number registered on MSG91, digits only. */
  MSG91_WHATSAPP_NUMBER: z.string().regex(/^\d+$/).default('917948503616'),
  MSG91_OTP_TEMPLATE: z.string().default('otp_auth'),
  MSG91_OTP_NAMESPACE: z.string().default('6997b3e9_ca9f_45cb_aefc_d4dc0c2e0b8c'),

  // ── Passes ──
  /** Elite Pass price in paise. ₹499 = 49900. */
  ELITE_PASS_AMOUNT: z.coerce.number().int().positive().default(49_900),
  ELITE_PASS_DAYS: z.coerce.number().int().positive().max(365).default(30),
  /** The Free Pass: ₹0, once per user for a car+city. */
  FREE_PASS_DAYS: z.coerce.number().int().positive().max(365).default(15),
  /** What happens to the pass/payment when a member leaves a collective. */
  REFUND_ON_LEAVE: z.enum(['NONE', 'FULL']).default('NONE'),

  // ── Payments ──
  PAYMENT_PROVIDER: z.enum(['razorpay', 'mock']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

/** Cross-field rules, applied in validateEnv() so the object type above stays a plain ZodObject. */
function checkEnv(env: z.infer<typeof envSchema>): string[] {
  const problems: string[] = [];
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    for (const k of [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ] as const) {
      if (!env[k]) problems.push(`${k}: required when PAYMENT_PROVIDER=razorpay`);
    }
  }
  if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
    problems.push('PAYMENT_PROVIDER: the mock provider cannot be used in production');
  }
  if (env.NODE_ENV === 'production' && (env.OTP_PROVIDER === 'log' || !env.MSG91_AUTH_KEY)) {
    problems.push('MSG91_AUTH_KEY: production must send sign-in codes on WhatsApp');
  }
  return problems;
}

export type Env = z.infer<typeof envSchema>;

/** Passed to ConfigModule.forRoot({ validate }) so the app refuses to boot on bad config. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const problems = checkEnv(result.data);
  if (problems.length)
    throw new Error(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  return result.data;
}

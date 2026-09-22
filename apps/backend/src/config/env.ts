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
});

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
  return result.data;
}

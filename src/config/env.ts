import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_SECRET_FALLBACKS: z.string().default(''),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET_FALLBACKS: z.string().default(''),
  JWT_ACCESS_EXPIRY: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRY: z.coerce.number().int().positive().default(604800),
  HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SEED_ENABLED: z.enum(['true', 'false']).default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error('Environment validation failed:\n' + issues);
  process.exit(1);
}

export const env = parsed.data;

import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_SECRET_FALLBACKS: z.string().default(''),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET_FALLBACKS: z.string().default(''),
    JWT_ACCESS_EXPIRY: z.string().default('900'),
    JWT_REFRESH_EXPIRY: z.string().default('604800'),
    HOLD_TTL_SECONDS: z.string().default('600'),
    IDEMPOTENCY_TTL_SECONDS: z.string().default('86400'),
    PORT: z.string().default('3001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
    AUTH_RATE_LIMIT_MAX: z.string().default('5'),
    BCRYPT_ROUNDS: z.string().default('12'),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    // eslint-disable-next-line no-console
    console.error('Environment validation failed:\n' + issues);
    process.exit(1);
}
export const env = parsed.data;
//# sourceMappingURL=env.js.map
import 'dotenv/config';
export declare const env: {
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_SECRET_FALLBACKS: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_SECRET_FALLBACKS: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    HOLD_TTL_SECONDS: string;
    IDEMPOTENCY_TTL_SECONDS: string;
    PORT: string;
    NODE_ENV: "development" | "production" | "test";
    CORS_ORIGINS: string;
    RATE_LIMIT_WINDOW_MS: string;
    RATE_LIMIT_MAX_REQUESTS: string;
    AUTH_RATE_LIMIT_MAX: string;
    BCRYPT_ROUNDS: string;
    LOG_LEVEL: "debug" | "error" | "fatal" | "info" | "silent" | "trace" | "warn";
};
//# sourceMappingURL=env.d.ts.map
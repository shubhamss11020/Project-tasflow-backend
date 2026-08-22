import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/taskflow_db?schema=public',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'taskflow_jwt_access_super_secret_key_2026_default',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'taskflow_jwt_refresh_super_secret_key_2026_default',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS || '7', 10)
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    emailRateLimitMax: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '50', 10),
    emailRateLimitDurationMs: parseInt(process.env.EMAIL_RATE_LIMIT_DURATION_MS || '60000', 10)
  }
};

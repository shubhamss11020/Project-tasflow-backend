import IORedis from 'ioredis';
import { config } from '../config';

export const redisConnection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  lazyConnect: false
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

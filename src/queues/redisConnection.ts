import IORedis from 'ioredis';
import { config } from '../config';

export const redisConnection = config.redis.url
  ? new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      tls: config.redis.url.startsWith('rediss://') ? {} : undefined
    })
  : new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      lazyConnect: false,
      tls: config.redis.tls ? {} : undefined
    });

redisConnection.on('error', (err) => {
  console.error('[Redis Connection Error]:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to Redis server / Upstash.');
});

import Redis from 'ioredis';

/**
 * Cache service for Redis with configurable TTL
 */
export class CacheService {
  private redis: Redis | null = null;
  private ttl: number;

  constructor(redisHost: string, redisPort: number, ttlSeconds: number = 120) {
    this.ttl = ttlSeconds;
    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (error) => {
        console.error('Redis cache error:', error);
      });

      this.redis.on('connect', () => {
        console.log('Redis cache connected');
      });
    } catch (error) {
      console.warn('Redis cache initialization failed:', error);
      this.redis = null;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const ttl = ttlSeconds || this.ttl;
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  /**
   * Get cache TTL in seconds
   */
  getTTL(): number {
    return this.ttl;
  }
}


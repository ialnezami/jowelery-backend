import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return (await this.cache.get<T>(key)) ?? null;
    } catch (err) {
      this.logger.warn(`Cache get failed for "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds * 1000);
    } catch (err) {
      this.logger.warn(`Cache set failed for "${key}": ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for "${key}": ${(err as Error).message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys: string[] = await (this.cache.stores[0] as any).keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => this.cache.del(k)));
      }
    } catch (err) {
      this.logger.warn(`Cache delByPattern failed for "${pattern}": ${(err as Error).message}`);
    }
  }
}

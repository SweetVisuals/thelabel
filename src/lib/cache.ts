/**
 * Simple caching utility to reduce Supabase API calls
 * Uses localStorage with TTL (Time To Live)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class Cache {
  private static readonly CACHE_PREFIX = 'supabase_cache_';

  /**
   * Store data in cache with TTL
   */
  static set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000
      };
      localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  }

  /**
   * Get data from cache if not expired
   */
  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.CACHE_PREFIX + key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();

      if (now - entry.timestamp > entry.ttl) {
        // Expired, remove from cache
        localStorage.removeItem(this.CACHE_PREFIX + key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  }

  /**
   * Clear specific cache entry
   */
  static clear(key: string): void {
    try {
      localStorage.removeItem(this.CACHE_PREFIX + key);
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Cache clearAll failed:', error);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }
}

/**
 * Cached version of async functions
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  cacheKey: string,
  ttlMinutes: number = 5
) {
  return async (...args: T): Promise<R> => {
    // Try to get from cache first
    const cached = Cache.get<R>(cacheKey);
    if (cached !== null) {
      console.log(`📋 Cache hit for ${cacheKey}`);
      return cached;
    }

    // Not in cache, call function and cache result
    console.log(`🔄 Cache miss for ${cacheKey}, fetching...`);
    const result = await fn(...args);
    Cache.set(cacheKey, result, ttlMinutes);
    return result;
  };
}
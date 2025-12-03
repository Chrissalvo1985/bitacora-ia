// Cache Service for Bitácora IA
// Stores data in localStorage with versioning and expiration

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'bitacora_cache_';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
  version: string;
}

export class CacheService {
  private static getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  // Save data to cache
  static set<T>(key: string, data: T): void {
    try {
      const cached: CachedData<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(this.getCacheKey(key), JSON.stringify(cached));
    } catch (error) {
      console.warn('Cache set failed (storage full?):', error);
      // If storage is full, try to clear old caches
      this.clearExpired();
      try {
        const cached: CachedData<T> = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        };
        localStorage.setItem(this.getCacheKey(key), JSON.stringify(cached));
      } catch (e) {
        console.error('Cache set failed after cleanup:', e);
      }
    }
  }

  // Get data from cache
  static get<T>(key: string): T | null {
    try {
      const cachedStr = localStorage.getItem(this.getCacheKey(key));
      if (!cachedStr) return null;

      const cached: CachedData<T> = JSON.parse(cachedStr);

      // Check version
      if (cached.version !== CACHE_VERSION) {
        this.remove(key);
        return null;
      }

      // Check expiration
      const age = Date.now() - cached.timestamp;
      if (age > CACHE_EXPIRY_MS) {
        this.remove(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.warn('Cache get failed:', error);
      this.remove(key);
      return null;
    }
  }

  // Check if cache exists and is valid
  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Remove specific cache
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.getCacheKey(key));
    } catch (error) {
      console.warn('Cache remove failed:', error);
    }
  }

  // Clear all expired caches
  static clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      let cleared = 0;

      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const cachedStr = localStorage.getItem(key);
            if (cachedStr) {
              const cached = JSON.parse(cachedStr);
              const age = now - cached.timestamp;
              
              if (age > CACHE_EXPIRY_MS || cached.version !== CACHE_VERSION) {
                localStorage.removeItem(key);
                cleared++;
              }
            }
          } catch (e) {
            // Invalid cache entry, remove it
            localStorage.removeItem(key);
            cleared++;
          }
        }
      }

      if (cleared > 0) {
        console.log(`Cleared ${cleared} expired cache entries`);
      }
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }

  // Clear all caches
  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Cache clear all failed:', error);
    }
  }

  // Get cache age in milliseconds
  static getAge(key: string): number | null {
    try {
      const cachedStr = localStorage.getItem(this.getCacheKey(key));
      if (!cachedStr) return null;

      const cached: CachedData<any> = JSON.parse(cachedStr);
      return Date.now() - cached.timestamp;
    } catch {
      return null;
    }
  }
}

// Cache keys
export const CACHE_KEYS = {
  BOOKS: 'books',
  ENTRIES: 'entries',
  FOLDERS: 'folders',
  THREADS: 'threads',
  USER_DATA: 'user_data',
} as const;


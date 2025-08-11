// lib/cache/cache-manager.ts
export interface CacheEntry<T> {
  data: T;
  expiry: number;
  created: number;
  accessed: number;
  accessCount: number;
  tags: string[];
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Tags for cache invalidation
  priority?: 'low' | 'normal' | 'high'; // Priority for eviction
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
  totalAccesses: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits = 0;
  private misses = 0;
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 1000, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Auto-cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);
  }

  // Set item in cache
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const now = Date.now();
    const ttl = options.ttl || this.defaultTTL;
    
    // Check if we need to evict items
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      expiry: now + ttl,
      created: now,
      accessed: now,
      accessCount: 0,
      tags: options.tags || []
    };

    this.cache.set(key, entry);
    
    console.log(`📦 Cache SET: ${key} (TTL: ${ttl}ms, Tags: ${entry.tags.join(', ') || 'none'})`);
  }

  // Get item from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      console.log(`📦 Cache MISS: ${key}`);
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      console.log(`📦 Cache EXPIRED: ${key}`);
      return null;
    }

    // Update access info
    entry.accessed = now;
    entry.accessCount++;
    this.hits++;
    
    console.log(`📦 Cache HIT: ${key} (accessed ${entry.accessCount} times)`);
    return entry.data as T;
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    console.log(`📦 Cache FETCH: ${key}`);
    const data = await fetcher();
    this.set(key, data, options);
    
    return data;
  }

  // Check if key exists and is valid
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Delete specific key
  delete(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      console.log(`📦 Cache DELETE: ${key}`);
    }
    
    return existed;
  }

  // Invalidate by pattern
  invalidatePattern(pattern: string): number {
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    console.log(`📦 Cache INVALIDATE PATTERN: ${pattern} (${deleted} keys deleted)`);
    return deleted;
  }

  // Invalidate by tags
  invalidateTags(tags: string[]): number {
    let deleted = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    console.log(`📦 Cache INVALIDATE TAGS: ${tags.join(', ')} (${deleted} keys deleted)`);
    return deleted;
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    
    console.log(`📦 Cache CLEAR: ${size} keys deleted`);
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`📦 Cache CLEANUP: ${cleaned} expired entries removed`);
    }
  }

  // Evict least recently used item
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < oldestAccess) {
        oldestAccess = entry.accessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`📦 Cache EVICT LRU: ${oldestKey}`);
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const accessCounts = entries.map(e => e.accessCount);
    const createdTimes = entries.map(e => e.created);
    const totalRequests = this.hits + this.misses;
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: Math.min(...createdTimes) || 0,
      newestEntry: Math.max(...createdTimes) || 0,
      totalAccesses: accessCounts.reduce((sum, count) => sum + count, 0)
    };
  }

  // Estimate memory usage (rough calculation)
  private estimateMemoryUsage(): number {
    let size = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Key size
      size += key.length * 2; // Rough estimate for string
      
      // Entry metadata size
      size += 64; // Rough estimate for entry object
      
      // Data size (very rough estimate)
      try {
        size += JSON.stringify(entry.data).length * 2;
      } catch {
        size += 1024; // Default estimate for non-serializable data
      }
    }
    
    return size;
  }

  // Export cache for debugging
  export(): { [key: string]: { data: any; expiry: number; created: number } } {
    const exported: { [key: string]: { data: any; expiry: number; created: number } } = {};
    
    for (const [key, entry] of this.cache.entries()) {
      exported[key] = {
        data: entry.data,
        expiry: entry.expiry,
        created: entry.created
      };
    }
    
    return exported;
  }

  // Import cache (for testing or persistence)
  import(data: { [key: string]: { data: any; expiry: number; created: number } }): void {
    const now = Date.now();
    
    for (const [key, entry] of Object.entries(data)) {
      // Only import non-expired entries
      if (entry.expiry > now) {
        this.cache.set(key, {
          data: entry.data,
          expiry: entry.expiry,
          created: entry.created,
          accessed: now,
          accessCount: 0,
          tags: []
        });
      }
    }
  }

  // Graceful shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Specialized cache managers for different data types
export class ApiCacheManager extends CacheManager {
  constructor() {
    super(500, 5 * 60 * 1000); // 500 items, 5 minutes TTL
  }

  // Cache user data
  cacheUser(userId: string, userData: any): void {
    this.set(`user:${userId}`, userData, {
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: ['users', `user:${userId}`]
    });
  }

  // Cache course data
  cacheCourse(courseId: string, courseData: any): void {
    this.set(`course:${courseId}`, courseData, {
      ttl: 30 * 60 * 1000, // 30 minutes
      tags: ['courses', `course:${courseId}`]
    });
  }

  // Cache search results
  cacheSearch(query: string, type: string, results: any): void {
    this.set(`search:${type}:${query}`, results, {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['searches', `search:${type}`]
    });
  }

  // Invalidate user-related cache
  invalidateUser(userId: string): void {
    this.invalidateTags([`user:${userId}`, 'users']);
  }

  // Invalidate course-related cache
  invalidateCourse(courseId: string): void {
    this.invalidateTags([`course:${courseId}`, 'courses']);
  }

  // Invalidate all searches
  invalidateSearches(): void {
    this.invalidateTags(['searches']);
  }
}

// Singleton instances
export const cache = new CacheManager();
export const apiCache = new ApiCacheManager();

// Helper function for API routes
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  return apiCache.getOrSet(key, fetcher, options);
}

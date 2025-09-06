import * as crypto from 'crypto';

/**
 * Cache entry with metadata for tracking and eviction
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  hash: string;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

/**
 * Cache statistics for monitoring and performance tuning
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  maxEntries: number; // Maximum number of entries
  ttl: number; // Time to live in milliseconds
  enableStats: boolean; // Enable statistics collection
}

/**
 * LRU Cache implementation with hash-based invalidation and memory management
 */
export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 100, // 100MB default
      maxEntries: config.maxEntries || 1000,
      ttl: config.ttl || 24 * 60 * 60 * 1000, // 24 hours default
      enableStats: config.enableStats !== false,
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      hitRate: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Generate hash for content-based cache invalidation
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate approximate size of an object in bytes
   */
  private calculateSize(obj: any): number {
    try {
      const jsonString = JSON.stringify(obj);
      if (jsonString === undefined) {
        return 0;
      }
      return Buffer.byteLength(jsonString, 'utf8');
    } catch (error) {
      // Fallback for objects that can't be stringified
      return 100; // Approximate size
    }
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entries to maintain cache limits
   */
  private evictLRU(): void {
    while (
      (this.cache.size > this.config.maxEntries ||
        this.stats.totalSize > this.config.maxSize * 1024 * 1024) &&
      this.accessOrder.length > 0
    ) {
      const keyToEvict = this.accessOrder.shift();
      if (keyToEvict && this.cache.has(keyToEvict)) {
        const entry = this.cache.get(keyToEvict)!;
        this.cache.delete(keyToEvict);
        this.stats.totalSize -= entry.size;
        this.stats.evictionCount++;
      }
    }
    this.stats.totalEntries = this.cache.size;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Store value in cache with hash-based invalidation
   */
  public set(key: string, value: T, content?: string): void {
    const hash = content ? this.generateHash(content) : '';
    const size = this.calculateSize(value);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      value,
      hash,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size,
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.stats.totalSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.updateAccessOrder(key);

    // Evict if necessary
    this.evictLRU();
  }

  /**
   * Retrieve value from cache with hash validation
   */
  public get(key: string, content?: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.missCount++;
        this.updateHitRate();
      }
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.delete(key);
      if (this.config.enableStats) {
        this.stats.missCount++;
        this.updateHitRate();
      }
      return null;
    }

    // Validate hash if content is provided
    if (content && entry.hash) {
      const currentHash = this.generateHash(content);
      if (currentHash !== entry.hash) {
        this.delete(key);
        if (this.config.enableStats) {
          this.stats.missCount++;
          this.updateHitRate();
        }
        return null;
      }
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    if (this.config.enableStats) {
      this.stats.hitCount++;
      this.updateHitRate();
    }

    return entry.value;
  }

  /**
   * Check if key exists in cache (without updating access stats)
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete entry from cache
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.totalEntries = this.cache.size;

      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
  }

  /**
   * Get all cache keys
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.stats.memoryUsage = this.stats.totalSize;
    return { ...this.stats };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;
  }

  /**
   * Clean up expired entries
   */
  public cleanup(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get cache entry metadata (for debugging)
   */
  public getEntryInfo(key: string): Partial<CacheEntry<T>> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      key: entry.key,
      hash: entry.hash,
      timestamp: entry.timestamp,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      size: entry.size,
    };
  }

  /**
   * Resize cache limits
   */
  public resize(maxSize?: number, maxEntries?: number): void {
    if (maxSize !== undefined) {
      this.config.maxSize = maxSize;
    }
    if (maxEntries !== undefined) {
      this.config.maxEntries = maxEntries;
    }
    this.evictLRU();
  }

  /**
   * Export cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }
}
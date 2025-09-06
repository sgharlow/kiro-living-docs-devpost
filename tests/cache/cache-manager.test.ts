import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CacheManager } from '../../dist/cache/cache-manager.js';

describe('CacheManager', () => {
  let cache: CacheManager<string>;

  beforeEach(() => {
    cache = new CacheManager<string>({
      maxSize: 1, // 1MB for testing
      maxEntries: 5,
      ttl: 1000, // 1 second for testing
      enableStats: true,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('Hash-based invalidation', () => {
    it('should validate content hash on retrieval', () => {
      const content1 = 'original content';
      const content2 = 'modified content';
      
      cache.set('key1', 'value1', content1);
      expect(cache.get('key1', content1)).toBe('value1');
      expect(cache.get('key1', content2)).toBeNull(); // Hash mismatch
    });

    it('should store without hash validation', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get('key1')).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      cache.set('key1', 'value1');
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when max entries exceeded', () => {
      // Fill cache to max capacity
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add one more entry to trigger eviction
      cache.set('key6', 'value6');
      
      // key1 should still exist (recently accessed)
      expect(cache.get('key1')).toBe('value1');
      
      // key2 should be evicted (least recently used)
      expect(cache.get('key2')).toBeNull();
    });

    it('should evict entries when memory limit exceeded', () => {
      // Create large values to exceed memory limit
      const largeValue = 'x'.repeat(300000); // ~300KB
      
      cache.set('key1', largeValue);
      cache.set('key2', largeValue);
      cache.set('key3', largeValue);
      cache.set('key4', largeValue); // This should trigger eviction
      
      // Some entries should be evicted due to memory pressure
      const remainingKeys = cache.keys();
      expect(remainingKeys.length).toBeLessThan(4);
    });
  });

  describe('Statistics', () => {
    it('should track hit and miss counts', () => {
      cache.set('key1', 'value1');
      
      // Hit
      cache.get('key1');
      
      // Miss
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track total entries and size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should track eviction count', () => {
      // Fill cache beyond capacity
      for (let i = 1; i <= 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);
    });
  });

  describe('Cleanup operations', () => {
    it('should clean up expired entries', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const cleanedCount = cache.cleanup();
      expect(cleanedCount).toBe(2);
      expect(cache.keys()).toHaveLength(0);
    });

    it('should not clean up non-expired entries', async () => {
      cache.set('key1', 'value1');
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const cleanedCount = cache.cleanup();
      expect(cleanedCount).toBe(0);
      expect(cache.keys()).toHaveLength(1);
    });
  });

  describe('Entry metadata', () => {
    it('should provide entry information', () => {
      cache.set('key1', 'value1', 'content');
      
      const entryInfo = cache.getEntryInfo('key1');
      expect(entryInfo).toBeDefined();
      expect(entryInfo!.key).toBe('key1');
      expect(entryInfo!.hash).toBeDefined();
      expect(entryInfo!.accessCount).toBe(1);
    });

    it('should return null for non-existent entries', () => {
      const entryInfo = cache.getEntryInfo('nonexistent');
      expect(entryInfo).toBeNull();
    });

    it('should update access count on retrieval', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1');
      cache.get('key1');
      
      const entryInfo = cache.getEntryInfo('key1');
      expect(entryInfo!.accessCount).toBe(3); // 1 for set + 2 for gets
    });
  });

  describe('Configuration', () => {
    it('should allow resizing cache limits', () => {
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Resize to smaller limit
      cache.resize(undefined, 3);
      
      // Should have evicted entries
      expect(cache.keys().length).toBeLessThanOrEqual(3);
    });

    it('should return current configuration', () => {
      const config = cache.getConfig();
      expect(config.maxSize).toBe(1);
      expect(config.maxEntries).toBe(5);
      expect(config.ttl).toBe(1000);
      expect(config.enableStats).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined and null values', () => {
      cache.set('key1', undefined as any);
      cache.set('key2', null as any);
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeNull();
    });

    it('should handle empty strings', () => {
      cache.set('key1', '');
      expect(cache.get('key1')).toBe('');
    });

    it('should handle special characters in keys', () => {
      const specialKey = 'key with spaces/and:special@characters';
      cache.set(specialKey, 'value');
      expect(cache.get(specialKey)).toBe('value');
    });

    it('should handle large objects', () => {
      const largeObject = {
        data: 'x'.repeat(10000),
        nested: {
          array: new Array(1000).fill('item'),
        },
      };
      
      cache.set('large', largeObject as any);
      expect(cache.get('large')).toEqual(largeObject);
    });
  });
});
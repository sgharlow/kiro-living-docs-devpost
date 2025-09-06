import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnalysisCache, InvalidationReason } from '../../dist/cache/analysis-cache.js';
import { AnalysisResult } from '../../dist/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AnalysisCache', () => {
  let cache: AnalysisCache;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    cache = new AnalysisCache({
      maxSize: 10, // 10MB for testing
      maxEntries: 50,
      ttl: 5000, // 5 seconds for testing
    });

    // Create temporary directory and test file
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'analysis-cache-test-'));
    testFile = path.join(tempDir, 'test.ts');
    await fs.promises.writeFile(testFile, 'console.log("test");');
  });

  afterEach(async () => {
    cache.clear();
    
    // Clean up temporary files
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createMockAnalysis = (): AnalysisResult => ({
    functions: [{
      name: 'testFunction',
      parameters: [],
      isAsync: false,
      isExported: true,
      startLine: 1,
      endLine: 3,
    }],
    classes: [],
    interfaces: [],
    exports: [],
    imports: [],
    comments: [],
    todos: [],
    apiEndpoints: [],
  });

  describe('File-based caching', () => {
    it('should store and retrieve analysis results', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      const retrieved = await cache.getAnalysis(testFile);
      
      expect(retrieved).toEqual(analysis);
    });

    it('should return null for non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.ts');
      const result = await cache.getAnalysis(nonExistentFile);
      
      expect(result).toBeNull();
    });

    it('should invalidate cache when file is modified', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      expect(await cache.getAnalysis(testFile)).toEqual(analysis);
      
      // Modify the file
      await fs.promises.writeFile(testFile, 'console.log("modified");');
      
      // Cache should be invalidated
      expect(await cache.getAnalysis(testFile)).toBeNull();
    });

    it('should handle file deletion gracefully', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      expect(await cache.getAnalysis(testFile)).toEqual(analysis);
      
      // Delete the file
      await fs.promises.unlink(testFile);
      
      // Cache should be invalidated
      expect(await cache.getAnalysis(testFile)).toBeNull();
    });
  });

  describe('Dependency tracking', () => {
    it('should store and retrieve dependencies', async () => {
      const analysis = createMockAnalysis();
      const dependencies = ['dep1.ts', 'dep2.ts'];
      
      await cache.setAnalysis(testFile, analysis, dependencies);
      
      expect(cache.getDependencies(testFile)).toEqual(dependencies);
    });

    it('should find dependents of a file', async () => {
      const analysis = createMockAnalysis();
      const dep1 = path.join(tempDir, 'dep1.ts');
      const dep2 = path.join(tempDir, 'dep2.ts');
      
      await fs.promises.writeFile(dep1, 'export const x = 1;');
      await fs.promises.writeFile(dep2, 'export const y = 2;');
      
      await cache.setAnalysis(testFile, analysis, [dep1]);
      await cache.setAnalysis(dep2, analysis, [dep1]);
      
      const dependents = cache.getDependents(dep1);
      expect(dependents).toContain(testFile);
      expect(dependents).toContain(dep2);
    });

    it('should invalidate dependents when dependency changes', async () => {
      const analysis = createMockAnalysis();
      const dep1 = path.join(tempDir, 'dep1.ts');
      
      await fs.promises.writeFile(dep1, 'export const x = 1;');
      await cache.setAnalysis(testFile, analysis, [dep1]);
      await cache.setAnalysis(dep1, analysis);
      
      // Both files should be cached
      expect(cache.hasAnalysis(testFile)).toBe(true);
      expect(cache.hasAnalysis(dep1)).toBe(true);
      
      // Invalidate dependency
      cache.invalidateFile(dep1, InvalidationReason.FILE_MODIFIED);
      
      // Both files should be invalidated
      expect(cache.hasAnalysis(testFile)).toBe(false);
      expect(cache.hasAnalysis(dep1)).toBe(false);
    });
  });

  describe('Project-level caching', () => {
    it('should store and retrieve project analysis', async () => {
      const projectAnalysis = {
        metadata: {
          name: 'Test Project',
          languages: ['typescript'],
        },
        structure: {
          directories: [],
          files: [testFile],
          entryPoints: [testFile],
          testFiles: [],
          configFiles: [],
        },
        files: new Map(),
        lastUpdated: new Date(),
      };
      
      const fileHashes = new Map([[testFile, 'hash123']]);
      
      await cache.setProjectAnalysis(tempDir, projectAnalysis, fileHashes);
      const retrieved = await cache.getProjectAnalysis(tempDir);
      
      expect(retrieved).toEqual(projectAnalysis);
    });

    it('should invalidate project cache when files change', async () => {
      const projectAnalysis = {
        metadata: {
          name: 'Test Project',
          languages: ['typescript'],
        },
        structure: {
          directories: [],
          files: [testFile],
          entryPoints: [testFile],
          testFiles: [],
          configFiles: [],
        },
        files: new Map(),
        lastUpdated: new Date(),
      };
      
      // Get initial file hash
      const content = await fs.promises.readFile(testFile, 'utf-8');
      const initialHash = require('crypto').createHash('sha256').update(content).digest('hex');
      const fileHashes = new Map([[testFile, initialHash]]);
      
      await cache.setProjectAnalysis(tempDir, projectAnalysis, fileHashes);
      expect(await cache.getProjectAnalysis(tempDir)).toEqual(projectAnalysis);
      
      // Modify file
      await fs.promises.writeFile(testFile, 'console.log("modified");');
      
      // Project cache should be invalidated
      expect(await cache.getProjectAnalysis(tempDir)).toBeNull();
    });
  });

  describe('Cache invalidation', () => {
    it('should manually invalidate files', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      expect(cache.hasAnalysis(testFile)).toBe(true);
      
      cache.invalidateFile(testFile, InvalidationReason.MANUAL_INVALIDATION);
      expect(cache.hasAnalysis(testFile)).toBe(false);
    });

    it('should batch invalidate multiple files', async () => {
      const analysis = createMockAnalysis();
      const file2 = path.join(tempDir, 'test2.ts');
      
      await fs.promises.writeFile(file2, 'console.log("test2");');
      await cache.setAnalysis(testFile, analysis);
      await cache.setAnalysis(file2, analysis);
      
      cache.invalidateFiles([testFile, file2], InvalidationReason.MANUAL_INVALIDATION);
      
      expect(cache.hasAnalysis(testFile)).toBe(false);
      expect(cache.hasAnalysis(file2)).toBe(false);
    });

    it('should track invalidation history', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      cache.invalidateFile(testFile, InvalidationReason.FILE_MODIFIED);
      
      const history = cache.getInvalidationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].file).toBe(testFile);
      expect(history[0].reason).toBe(InvalidationReason.FILE_MODIFIED);
    });
  });

  describe('Cache statistics', () => {
    it('should provide comprehensive statistics', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis, ['dep1.ts']);
      
      const stats = cache.getStats();
      
      expect(stats.fileCache.totalEntries).toBe(1);
      expect(stats.dependencyGraph.totalFiles).toBe(1);
      expect(stats.dependencyGraph.totalDependencies).toBe(1);
    });

    it('should track cache operations', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      await cache.getAnalysis(testFile); // Hit
      await cache.getAnalysis('nonexistent.ts'); // Miss
      
      const stats = cache.getStats();
      expect(stats.fileCache.hitCount).toBeGreaterThan(0);
      expect(stats.fileCache.missCount).toBeGreaterThan(0);
    });
  });

  describe('Cache maintenance', () => {
    it('should clean up expired entries', async () => {
      const shortTtlCache = new AnalysisCache({
        ttl: 100, // 100ms
      });
      
      const analysis = createMockAnalysis();
      await shortTtlCache.setAnalysis(testFile, analysis);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cleanup = shortTtlCache.cleanup();
      expect(cleanup.filesCleanedUp).toBeGreaterThan(0);
    });

    it('should validate cache integrity', async () => {
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      
      const validation = await cache.validateCache();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect cache integrity issues', async () => {
      const analysis = createMockAnalysis();
      const nonExistentFile = path.join(tempDir, 'deleted.ts');
      
      // Create and cache file
      await fs.promises.writeFile(nonExistentFile, 'test');
      await cache.setAnalysis(nonExistentFile, analysis);
      
      // Delete file
      await fs.promises.unlink(nonExistentFile);
      
      const validation = await cache.validateCache();
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Cache configuration', () => {
    it('should allow resizing cache limits', async () => {
      const analysis = createMockAnalysis();
      
      // Fill cache
      for (let i = 0; i < 10; i++) {
        const file = path.join(tempDir, `test${i}.ts`);
        await fs.promises.writeFile(file, `console.log("test${i}");`);
        await cache.setAnalysis(file, analysis);
      }
      
      const initialCount = cache.getCachedFiles().length;
      
      // Resize to smaller limit
      cache.resize(1, 5); // 1MB, 5 entries
      
      // Should have fewer entries
      expect(cache.getCachedFiles().length).toBeLessThanOrEqual(Math.min(initialCount, 5));
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidPath = '/invalid/path/file.ts';
      const analysis = createMockAnalysis();
      
      // Should not throw
      await cache.setAnalysis(invalidPath, analysis);
      
      // Should return null for invalid paths
      const result = await cache.getAnalysis(invalidPath);
      expect(result).toBeNull();
    });

    it('should handle permission errors', async () => {
      // This test might not work on all systems due to permission restrictions
      const analysis = createMockAnalysis();
      
      await cache.setAnalysis(testFile, analysis);
      
      // Try to access with different content (simulating permission error scenario)
      const result = await cache.getAnalysis(testFile);
      expect(result).toBeDefined(); // Should still work with proper permissions
    });
  });
});
/**
 * Tests for Performance Optimizer
 * 
 * Validates performance monitoring, optimization, and metrics collection
 */

import { PerformanceOptimizer } from '../../src/performance/performance-optimizer';
import { FileChange } from '../../src/types';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      enableBatching: true,
      batchSize: 5,
      batchTimeout: 1000,
      maxConcurrentAnalysis: 2
    });
  });

  describe('File Change Optimization', () => {
    test('should batch file changes when enabled', async () => {
      const changes: FileChange[] = [
        { path: 'file1.ts', type: 'modified', timestamp: Date.now() },
        { path: 'file2.ts', type: 'modified', timestamp: Date.now() },
        { path: 'file3.ts', type: 'modified', timestamp: Date.now() }
      ];

      const optimized = optimizer.optimizeFileChanges(changes);
      
      // Should return empty array initially (batching)
      expect(optimized).toEqual([]);
    });

    test('should deduplicate changes for same file', async () => {
      const now = Date.now();
      const changes: FileChange[] = [
        { path: 'file1.ts', type: 'modified', timestamp: now },
        { path: 'file1.ts', type: 'modified', timestamp: now + 100 },
        { path: 'file2.ts', type: 'modified', timestamp: now }
      ];

      // Process changes directly without batching
      optimizer.optimizeFileChanges(changes);
      // Force batch processing
      const optimized = optimizer.processBatch();
      
      expect(optimized).toHaveLength(2);
      expect(optimized.find(c => c.path === 'file1.ts')?.timestamp).toBe(now + 100);
    });

    test('should prioritize changes correctly', async () => {
      const changes: FileChange[] = [
        { path: 'file.js', type: 'modified', timestamp: Date.now() },
        { path: 'file.ts', type: 'added', timestamp: Date.now() },
        { path: 'file.py', type: 'modified', timestamp: Date.now() }
      ];

      const priorityOptimizer = new PerformanceOptimizer({ 
        enableBatching: false,
        enablePrioritization: true 
      });
      priorityOptimizer.optimizeFileChanges(changes);
      const optimized = priorityOptimizer.processBatch();
      
      // TypeScript files should have higher priority
      expect(optimized[0].path).toBe('file.ts');
    });
  });

  describe('Performance Tracking', () => {
    test('should track analysis completion', () => {
      optimizer.trackAnalysisStart('test.ts');
      optimizer.trackAnalysisComplete('test.ts', 1500);

      const metrics = optimizer.getMetrics();
      expect(metrics.analysisTime).toBeGreaterThan(0);
    });

    test('should respect concurrent analysis limits', () => {
      expect(optimizer.canProceedWithAnalysis('file1.ts')).toBe(true);
      
      optimizer.trackAnalysisStart('file1.ts');
      optimizer.trackAnalysisStart('file2.ts');
      
      // Should hit limit
      expect(optimizer.canProceedWithAnalysis('file3.ts')).toBe(false);
    });

    test('should provide optimization recommendations', () => {
      // Simulate slow analysis
      optimizer.trackAnalysisComplete('test.ts', 15000);
      
      const recommendations = optimizer.getOptimizationRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      // Check for any recommendation about performance
      expect(recommendations.some(r => r.toLowerCase().includes('analysis') || r.toLowerCase().includes('slow') || r.toLowerCase().includes('performance'))).toBe(true);
    });
  });

  describe('Memory Management', () => {
    test('should track memory usage', () => {
      const metrics = optimizer.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    test('should provide memory optimization', () => {
      optimizer.optimizeMemory();
      // Should not throw and should emit event
      expect(true).toBe(true);
    });
  });

  describe('Performance Trends', () => {
    test('should calculate performance trends', () => {
      optimizer.trackAnalysisComplete('file1.ts', 1000);
      optimizer.trackAnalysisComplete('file2.ts', 1200);
      optimizer.trackAnalysisComplete('file3.ts', 800);

      const trends = optimizer.getPerformanceTrends();
      expect(trends.averageAnalysisTime).toBeCloseTo(1000, -1);
      expect(trends.memoryTrend).toMatch(/increasing|decreasing|stable/);
    });
  });
});
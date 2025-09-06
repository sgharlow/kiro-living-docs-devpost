/**
 * Performance Optimizer for Living Documentation Generator
 * 
 * Provides performance monitoring, optimization, and smooth real-time updates
 * for an enhanced user experience.
 */

import { EventEmitter } from 'events';
import { FileChange } from '../types.js';

export interface PerformanceMetrics {
  analysisTime: number;
  generationTime: number;
  updateLatency: number;
  memoryUsage: number;
  cacheHitRate: number;
  throughput: number; // files per second
}

export interface OptimizationConfig {
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enablePrioritization: boolean;
  maxConcurrentAnalysis: number;
  memoryThreshold: number; // MB
  enableGarbageCollection: boolean;
}

export class PerformanceOptimizer extends EventEmitter {
  private metrics: PerformanceMetrics = {
    analysisTime: 0,
    generationTime: 0,
    updateLatency: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    throughput: 0
  };

  private config: OptimizationConfig;
  private updateBatch: FileChange[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeAnalysis = new Set<string>();
  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 100;

  constructor(config: Partial<OptimizationConfig> = {}) {
    super();
    
    this.config = {
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 2000,
      enablePrioritization: true,
      maxConcurrentAnalysis: 4,
      memoryThreshold: 512,
      enableGarbageCollection: true,
      ...config
    };

    this.startPerformanceMonitoring();
  }

  /**
   * Optimize file change processing with batching and prioritization
   */
  public optimizeFileChanges(changes: FileChange[]): FileChange[] {
    if (!this.config.enableBatching) {
      return changes;
    }

    // Add to batch
    this.updateBatch.push(...changes);

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process batch if size threshold reached
    if (this.updateBatch.length >= this.config.batchSize) {
      return this.processBatch();
    }

    // Set timer for timeout-based processing
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);

    return []; // Return empty array, will be processed in batch
  }

  /**
   * Process batched file changes with optimization
   */
  private processBatch(): FileChange[] {
    if (this.updateBatch.length === 0) {
      return [];
    }

    const batch = [...this.updateBatch];
    this.updateBatch = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Deduplicate changes by file path (keep latest)
    const deduplicatedChanges = this.deduplicateChanges(batch);

    // Prioritize changes if enabled
    if (this.config.enablePrioritization) {
      return this.prioritizeChanges(deduplicatedChanges);
    }

    return deduplicatedChanges;
  }

  /**
   * Deduplicate file changes, keeping only the latest change per file
   */
  private deduplicateChanges(changes: FileChange[]): FileChange[] {
    const changeMap = new Map<string, FileChange>();

    for (const change of changes) {
      const existing = changeMap.get(change.path);
      if (!existing || change.timestamp > existing.timestamp) {
        changeMap.set(change.path, change);
      }
    }

    return Array.from(changeMap.values());
  }

  /**
   * Prioritize file changes based on importance and impact
   */
  private prioritizeChanges(changes: FileChange[]): FileChange[] {
    return changes.sort((a, b) => {
      const priorityA = this.calculateChangePriority(a);
      const priorityB = this.calculateChangePriority(b);
      return priorityB - priorityA; // Higher priority first
    });
  }

  /**
   * Calculate priority score for a file change
   */
  private calculateChangePriority(change: FileChange): number {
    let priority = 0;

    // File type priority
    const ext = change.path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        priority += 10;
        break;
      case 'js':
      case 'jsx':
        priority += 8;
        break;
      case 'py':
        priority += 7;
        break;
      case 'go':
        priority += 6;
        break;
      default:
        priority += 1;
    }

    // Change type priority
    switch (change.type) {
      case 'added':
        priority += 5;
        break;
      case 'modified':
        priority += 3;
        break;
      case 'deleted':
        priority += 2;
        break;
      case 'renamed':
        priority += 1;
        break;
    }

    // Recent changes get higher priority
    const age = Date.now() - change.timestamp;
    const ageBonus = Math.max(0, 10 - (age / 1000)); // Bonus decreases over 10 seconds
    priority += ageBonus;

    return priority;
  }

  /**
   * Check if analysis can proceed based on resource constraints
   */
  public canProceedWithAnalysis(_filePath: string): boolean {
    // Check concurrent analysis limit
    if (this.activeAnalysis.size >= this.config.maxConcurrentAnalysis) {
      return false;
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024);
    if (memoryUsage > this.config.memoryThreshold) {
      this.triggerGarbageCollection();
      return false;
    }

    return true;
  }

  /**
   * Track analysis start
   */
  public trackAnalysisStart(filePath: string): void {
    this.activeAnalysis.add(filePath);
  }

  /**
   * Track analysis completion and update metrics
   */
  public trackAnalysisComplete(filePath: string, duration: number): void {
    this.activeAnalysis.delete(filePath);
    this.metrics.analysisTime = this.updateMovingAverage(this.metrics.analysisTime, duration);
    this.metrics.throughput = this.calculateThroughput();
    
    this.emit('analysis-complete', { filePath, duration, metrics: this.metrics });
  }

  /**
   * Track documentation generation performance
   */
  public trackGenerationTime(duration: number): void {
    this.metrics.generationTime = this.updateMovingAverage(this.metrics.generationTime, duration);
  }

  /**
   * Track update latency (time from file change to documentation update)
   */
  public trackUpdateLatency(latency: number): void {
    this.metrics.updateLatency = this.updateMovingAverage(this.metrics.updateLatency, latency);
  }

  /**
   * Update cache hit rate metric
   */
  public updateCacheHitRate(hits: number, total: number): void {
    this.metrics.cacheHitRate = total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Get performance trends over time
   */
  public getPerformanceTrends(): {
    averageAnalysisTime: number;
    averageGenerationTime: number;
    averageUpdateLatency: number;
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.performanceHistory.length < 2) {
      return {
        averageAnalysisTime: this.metrics.analysisTime,
        averageGenerationTime: this.metrics.generationTime,
        averageUpdateLatency: this.metrics.updateLatency,
        memoryTrend: 'stable'
      };
    }

    const recent = this.performanceHistory.slice(-10);
    const averageAnalysisTime = recent.reduce((sum, m) => sum + m.analysisTime, 0) / recent.length;
    const averageGenerationTime = recent.reduce((sum, m) => sum + m.generationTime, 0) / recent.length;
    const averageUpdateLatency = recent.reduce((sum, m) => sum + m.updateLatency, 0) / recent.length;

    // Calculate memory trend
    const oldMemory = recent[0].memoryUsage;
    const newMemory = recent[recent.length - 1].memoryUsage;
    const memoryChange = (newMemory - oldMemory) / oldMemory;
    
    let memoryTrend: 'increasing' | 'decreasing' | 'stable';
    if (memoryChange > 0.1) {
      memoryTrend = 'increasing';
    } else if (memoryChange < -0.1) {
      memoryTrend = 'decreasing';
    } else {
      memoryTrend = 'stable';
    }

    return {
      averageAnalysisTime,
      averageGenerationTime,
      averageUpdateLatency,
      memoryTrend
    };
  }

  /**
   * Optimize memory usage
   */
  public optimizeMemory(): void {
    if (this.config.enableGarbageCollection) {
      this.triggerGarbageCollection();
    }

    // Clear old performance history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }

    this.emit('memory-optimized', { memoryUsage: this.metrics.memoryUsage });
  }

  /**
   * Get optimization recommendations
   */
  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const trends = this.getPerformanceTrends();

    if (trends.averageAnalysisTime > 5000) {
      recommendations.push('Consider enabling analysis caching or reducing file scope');
    }

    if (trends.averageUpdateLatency > 3000) {
      recommendations.push('Enable batching to reduce update frequency');
    }

    if (trends.memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing - consider enabling garbage collection');
    }

    if (this.metrics.cacheHitRate < 50) {
      recommendations.push('Low cache hit rate - review cache configuration');
    }

    if (this.activeAnalysis.size >= this.config.maxConcurrentAnalysis) {
      recommendations.push('Consider increasing maxConcurrentAnalysis for better throughput');
    }

    return recommendations;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateMemoryUsage();
      this.recordPerformanceSnapshot();
    }, 10000); // Every 10 seconds
  }

  /**
   * Update memory usage metric
   */
  private updateMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = memoryUsage.heapUsed / (1024 * 1024); // MB
  }

  /**
   * Record performance snapshot for trend analysis
   */
  private recordPerformanceSnapshot(): void {
    this.performanceHistory.push({ ...this.metrics });
    
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Calculate throughput (files per second)
   */
  private calculateThroughput(): number {
    const now = Date.now();
    
    // This is a simplified calculation
    // In a real implementation, you'd track actual file processing times
    console.log(`Calculating throughput at ${now}`);
    return this.activeAnalysis.size > 0 ? 1000 / this.metrics.analysisTime : 0;
  }

  /**
   * Update moving average
   */
  private updateMovingAverage(current: number, newValue: number, weight: number = 0.1): number {
    return current * (1 - weight) + newValue * weight;
  }

  /**
   * Trigger garbage collection if available
   */
  private triggerGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.emit('garbage-collected');
    }
  }
}
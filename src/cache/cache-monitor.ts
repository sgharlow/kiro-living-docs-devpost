import { AnalysisCache } from './analysis-cache.js';
import { TemplateCache } from './template-cache.js';
import { IncrementalUpdater } from './incremental-updater.js';
import { CacheStats } from './cache-manager.js';

/**
 * Performance metrics for cache monitoring
 */
export interface PerformanceMetrics {
  memoryUsage: {
    total: number;
    analysis: number;
    templates: number;
    system: number;
  };
  cacheEfficiency: {
    analysisHitRate: number;
    templateHitRate: number;
    overallHitRate: number;
  };
  updatePerformance: {
    averageUpdateTime: number;
    successRate: number;
    queueSize: number;
  };
  resourceUtilization: {
    cacheUtilization: number;
    memoryPressure: number;
    evictionRate: number;
  };
}

/**
 * Cache health status
 */
export enum CacheHealth {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Cache health report
 */
export interface CacheHealthReport {
  overall: CacheHealth;
  issues: string[];
  recommendations: string[];
  metrics: PerformanceMetrics;
  timestamp: number;
}

/**
 * Monitoring configuration
 */
export interface MonitorConfig {
  enableRealTimeMonitoring: boolean;
  metricsInterval: number; // Interval for collecting metrics (ms)
  healthCheckInterval: number; // Interval for health checks (ms)
  alertThresholds: {
    memoryUsage: number; // MB
    hitRateThreshold: number; // Percentage
    updateTimeThreshold: number; // ms
    queueSizeThreshold: number;
  };
  retentionPeriod: number; // How long to keep metrics (ms)
}

/**
 * Metric data point for time series
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * Cache monitoring and performance analysis system
 */
export class CacheMonitor {
  private analysisCache: AnalysisCache;
  private templateCache: TemplateCache;
  private incrementalUpdater: IncrementalUpdater;
  private config: MonitorConfig;
  private metricsHistory: Map<string, MetricDataPoint[]> = new Map();
  private healthHistory: CacheHealthReport[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    analysisCache: AnalysisCache,
    templateCache: TemplateCache,
    incrementalUpdater: IncrementalUpdater,
    config: Partial<MonitorConfig> = {}
  ) {
    this.analysisCache = analysisCache;
    this.templateCache = templateCache;
    this.incrementalUpdater = incrementalUpdater;
    
    this.config = {
      enableRealTimeMonitoring: config.enableRealTimeMonitoring !== false,
      metricsInterval: config.metricsInterval || 30000, // 30 seconds
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      alertThresholds: {
        memoryUsage: config.alertThresholds?.memoryUsage || 200, // 200MB
        hitRateThreshold: config.alertThresholds?.hitRateThreshold || 0.7, // 70%
        updateTimeThreshold: config.alertThresholds?.updateTimeThreshold || 5000, // 5 seconds
        queueSizeThreshold: config.alertThresholds?.queueSizeThreshold || 50,
        ...config.alertThresholds,
      },
      retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
    };

    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Start real-time monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    console.log('Cache monitoring started');
  }

  /**
   * Stop real-time monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log('Cache monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  public collectMetrics(): PerformanceMetrics {
    const analysisStats = this.analysisCache.getStats();
    const templateStats = this.templateCache.getStats();
    const updateStats = this.incrementalUpdater.getStats();
    const memoryUsage = process.memoryUsage();

    const metrics: PerformanceMetrics = {
      memoryUsage: {
        total: memoryUsage.heapUsed / 1024 / 1024, // MB
        analysis: analysisStats.fileCache.memoryUsage / 1024 / 1024, // MB
        templates: templateStats.cache.memoryUsage / 1024 / 1024, // MB
        system: (memoryUsage.heapUsed - analysisStats.fileCache.memoryUsage - templateStats.cache.memoryUsage) / 1024 / 1024,
      },
      cacheEfficiency: {
        analysisHitRate: analysisStats.fileCache.hitRate,
        templateHitRate: templateStats.cache.hitRate,
        overallHitRate: (analysisStats.fileCache.hitRate + templateStats.cache.hitRate) / 2,
      },
      updatePerformance: {
        averageUpdateTime: updateStats.averageDuration,
        successRate: updateStats.successRate,
        queueSize: updateStats.queueSize,
      },
      resourceUtilization: {
        cacheUtilization: this.calculateCacheUtilization(analysisStats.fileCache, templateStats.cache),
        memoryPressure: 0, // Will be calculated after metrics object is created
        evictionRate: this.calculateEvictionRate(analysisStats.fileCache, templateStats.cache),
      },
    };

    // Calculate memory pressure after metrics object is created
    metrics.resourceUtilization.memoryPressure = this.calculateMemoryPressure(metrics.memoryUsage.total);

    // Store metrics in history
    this.storeMetrics(metrics);

    return metrics;
  }

  /**
   * Store metrics in time series history
   */
  private storeMetrics(metrics: PerformanceMetrics): void {
    const timestamp = Date.now();

    // Store individual metric values
    this.addMetricPoint('memory.total', metrics.memoryUsage.total, timestamp);
    this.addMetricPoint('memory.analysis', metrics.memoryUsage.analysis, timestamp);
    this.addMetricPoint('memory.templates', metrics.memoryUsage.templates, timestamp);
    this.addMetricPoint('hitRate.analysis', metrics.cacheEfficiency.analysisHitRate, timestamp);
    this.addMetricPoint('hitRate.templates', metrics.cacheEfficiency.templateHitRate, timestamp);
    this.addMetricPoint('hitRate.overall', metrics.cacheEfficiency.overallHitRate, timestamp);
    this.addMetricPoint('update.averageTime', metrics.updatePerformance.averageUpdateTime, timestamp);
    this.addMetricPoint('update.successRate', metrics.updatePerformance.successRate, timestamp);
    this.addMetricPoint('update.queueSize', metrics.updatePerformance.queueSize, timestamp);
    this.addMetricPoint('utilization.cache', metrics.resourceUtilization.cacheUtilization, timestamp);
    this.addMetricPoint('utilization.memory', metrics.resourceUtilization.memoryPressure, timestamp);
    this.addMetricPoint('utilization.eviction', metrics.resourceUtilization.evictionRate, timestamp);

    // Clean up old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Add metric data point
   */
  private addMetricPoint(metricName: string, value: number, timestamp: number): void {
    if (!this.metricsHistory.has(metricName)) {
      this.metricsHistory.set(metricName, []);
    }

    const points = this.metricsHistory.get(metricName)!;
    points.push({ timestamp, value });

    // Keep only recent points (last 1000 points or retention period)
    const cutoffTime = timestamp - this.config.retentionPeriod;
    const filteredPoints = points.filter(p => p.timestamp > cutoffTime).slice(-1000);
    this.metricsHistory.set(metricName, filteredPoints);
  }

  /**
   * Clean up old metrics beyond retention period
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    for (const [metricName, points] of this.metricsHistory) {
      const filteredPoints = points.filter(p => p.timestamp > cutoffTime);
      this.metricsHistory.set(metricName, filteredPoints);
    }

    // Clean up health history
    this.healthHistory = this.healthHistory.filter(h => h.timestamp > cutoffTime);
  }

  /**
   * Calculate cache utilization percentage
   */
  private calculateCacheUtilization(analysisStats: CacheStats, templateStats: CacheStats): number {
    const totalEntries = analysisStats.totalEntries + templateStats.totalEntries;
    const maxEntries = 1000; // Approximate max entries across both caches
    return totalEntries / maxEntries;
  }

  /**
   * Calculate memory pressure (0-1 scale)
   */
  private calculateMemoryPressure(memoryUsageMB: number): number {
    const maxMemoryMB = this.config.alertThresholds.memoryUsage * 2; // 2x alert threshold as max
    return Math.min(memoryUsageMB / maxMemoryMB, 1);
  }

  /**
   * Calculate eviction rate (evictions per minute)
   */
  private calculateEvictionRate(analysisStats: CacheStats, templateStats: CacheStats): number {
    const totalEvictions = analysisStats.evictionCount + templateStats.evictionCount;
    
    // Get evictions from last minute of metrics
    const oneMinuteAgo = Date.now() - 60000;
    const recentEvictions = this.getMetricsSince('utilization.eviction', oneMinuteAgo);
    
    if (recentEvictions.length < 2) {
      return 0;
    }

    const oldestEvictions = recentEvictions[0].value;
    return totalEvictions - oldestEvictions;
  }

  /**
   * Perform comprehensive health check
   */
  public performHealthCheck(): CacheHealthReport {
    const metrics = this.collectMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let overallHealth = CacheHealth.EXCELLENT;

    // Check memory usage
    if (metrics.memoryUsage.total > this.config.alertThresholds.memoryUsage) {
      issues.push(`High memory usage: ${metrics.memoryUsage.total.toFixed(1)}MB`);
      recommendations.push('Consider reducing cache size limits or clearing unused entries');
      overallHealth = CacheHealth.WARNING;
    }

    // Check hit rates
    if (metrics.cacheEfficiency.overallHitRate < this.config.alertThresholds.hitRateThreshold) {
      issues.push(`Low cache hit rate: ${(metrics.cacheEfficiency.overallHitRate * 100).toFixed(1)}%`);
      recommendations.push('Review cache invalidation strategy or increase cache size');
      overallHealth = CacheHealth.WARNING;
    }

    // Check update performance
    if (metrics.updatePerformance.averageUpdateTime > this.config.alertThresholds.updateTimeThreshold) {
      issues.push(`Slow update performance: ${metrics.updatePerformance.averageUpdateTime.toFixed(0)}ms`);
      recommendations.push('Consider optimizing analysis algorithms or enabling incremental updates');
      overallHealth = CacheHealth.WARNING;
    }

    // Check queue size
    if (metrics.updatePerformance.queueSize > this.config.alertThresholds.queueSizeThreshold) {
      issues.push(`Large update queue: ${metrics.updatePerformance.queueSize} items`);
      recommendations.push('Increase update processing speed or enable batching');
      overallHealth = CacheHealth.CRITICAL;
    }

    // Check memory pressure
    if (metrics.resourceUtilization.memoryPressure > 0.8) {
      issues.push('High memory pressure detected');
      recommendations.push('Reduce cache limits or restart the service');
      overallHealth = CacheHealth.CRITICAL;
    }

    // Determine overall health
    if (issues.length === 0) {
      overallHealth = CacheHealth.EXCELLENT;
    } else if (issues.length <= 2 && overallHealth !== CacheHealth.CRITICAL) {
      overallHealth = CacheHealth.GOOD;
    }

    const report: CacheHealthReport = {
      overall: overallHealth,
      issues,
      recommendations,
      metrics,
      timestamp: Date.now(),
    };

    this.healthHistory.push(report);
    return report;
  }

  /**
   * Get metrics for a specific time range
   */
  public getMetricsSince(metricName: string, since: number): MetricDataPoint[] {
    const points = this.metricsHistory.get(metricName) || [];
    return points.filter(p => p.timestamp >= since);
  }

  /**
   * Get all available metric names
   */
  public getAvailableMetrics(): string[] {
    return Array.from(this.metricsHistory.keys());
  }

  /**
   * Get recent health reports
   */
  public getHealthHistory(limit: number = 10): CacheHealthReport[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get current cache statistics summary
   */
  public getStatsSummary() {
    const analysisStats = this.analysisCache.getStats();
    const templateStats = this.templateCache.getStats();
    const updateStats = this.incrementalUpdater.getStats();

    return {
      analysis: {
        files: analysisStats.fileCache.totalEntries,
        projects: analysisStats.projectCache.totalEntries,
        hitRate: analysisStats.fileCache.hitRate,
        memoryUsage: analysisStats.fileCache.memoryUsage,
      },
      templates: {
        cached: templateStats.templatePaths,
        hitRate: templateStats.cache.hitRate,
        memoryUsage: templateStats.cache.memoryUsage,
      },
      updates: {
        totalOperations: updateStats.totalOperations,
        successRate: updateStats.successRate,
        averageDuration: updateStats.averageDuration,
        queueSize: updateStats.queueSize,
      },
      monitoring: {
        isActive: this.monitoringInterval !== null,
        metricsCollected: this.metricsHistory.size,
        healthReports: this.healthHistory.length,
      },
    };
  }

  /**
   * Export metrics data for external analysis
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.exportMetricsAsCSV();
    }

    const exportData = {
      timestamp: Date.now(),
      config: this.config,
      metrics: Object.fromEntries(this.metricsHistory),
      healthHistory: this.healthHistory,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export metrics as CSV format
   */
  private exportMetricsAsCSV(): string {
    const lines = ['timestamp,metric,value'];
    
    for (const [metricName, points] of this.metricsHistory) {
      for (const point of points) {
        lines.push(`${point.timestamp},${metricName},${point.value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(config: Partial<MonitorConfig>): void {
    const wasMonitoring = this.monitoringInterval !== null;
    
    if (wasMonitoring) {
      this.stopMonitoring();
    }

    this.config = { ...this.config, ...config };

    if (wasMonitoring && this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Get current monitoring configuration
   */
  public getConfig(): MonitorConfig {
    return { ...this.config };
  }

  /**
   * Clear all monitoring data
   */
  public clearData(): void {
    this.metricsHistory.clear();
    this.healthHistory = [];
  }

  /**
   * Get monitoring status
   */
  public getStatus() {
    return {
      isMonitoring: this.monitoringInterval !== null,
      metricsCount: this.metricsHistory.size,
      healthReportsCount: this.healthHistory.length,
      lastHealthCheck: this.healthHistory.length > 0 
        ? this.healthHistory[this.healthHistory.length - 1].timestamp 
        : null,
    };
  }
}
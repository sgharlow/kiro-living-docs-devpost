/**
 * Cache system exports for the Living Documentation Generator
 */

// Core cache manager
export { CacheManager, CacheEntry, CacheStats, CacheConfig } from './cache-manager.js';

// Analysis-specific caching
export { 
  AnalysisCache, 
  FileMetadata, 
  AnalysisCacheEntry, 
  ProjectCacheEntry, 
  InvalidationReason 
} from './analysis-cache.js';

// Template caching
export { 
  TemplateCache, 
  CompiledTemplate, 
  TemplateMetadata, 
  TemplateCacheEntry, 
  TemplateOptions 
} from './template-cache.js';

// Incremental updates
export { 
  IncrementalUpdater, 
  UpdateType, 
  UpdateOperation, 
  SectionDependency, 
  UpdateConfig 
} from './incremental-updater.js';

// Cache monitoring
export { 
  CacheMonitor, 
  PerformanceMetrics, 
  CacheHealth, 
  CacheHealthReport, 
  MonitorConfig, 
  MetricDataPoint 
} from './cache-monitor.js';

// Import classes for factory function
import { AnalysisCache as AnalysisCacheClass } from './analysis-cache.js';
import { TemplateCache as TemplateCacheClass } from './template-cache.js';
import { IncrementalUpdater as IncrementalUpdaterClass } from './incremental-updater.js';
import { CacheMonitor as CacheMonitorClass } from './cache-monitor.js';

/**
 * Factory function to create a complete cache system
 */
export function createCacheSystem(config: {
  analysis?: Partial<import('./cache-manager.js').CacheConfig>;
  template?: Partial<import('./cache-manager.js').CacheConfig>;
  update?: Partial<import('./incremental-updater.js').UpdateConfig>;
  monitor?: Partial<import('./cache-monitor.js').MonitorConfig>;
} = {}) {
  const analysisCache = new AnalysisCacheClass(config.analysis);
  const templateCache = new TemplateCacheClass(config.template);
  const incrementalUpdater = new IncrementalUpdaterClass(analysisCache, templateCache, config.update);
  const cacheMonitor = new CacheMonitorClass(analysisCache, templateCache, incrementalUpdater, config.monitor);

  return {
    analysisCache,
    templateCache,
    incrementalUpdater,
    cacheMonitor,
    
    /**
     * Get comprehensive cache statistics
     */
    getStats() {
      return cacheMonitor.getStatsSummary();
    },
    
    /**
     * Perform cache cleanup and maintenance
     */
    cleanup() {
      const analysisCleanup = analysisCache.cleanup();
      const templateCleanup = templateCache.getStats(); // Templates don't have cleanup method
      
      return {
        analysis: analysisCleanup,
        templates: { cached: templateCleanup.templatePaths },
      };
    },
    
    /**
     * Clear all caches
     */
    clearAll() {
      analysisCache.clear();
      templateCache.clear();
      incrementalUpdater.clearQueue();
      cacheMonitor.clearData();
    },
    
    /**
     * Start monitoring
     */
    startMonitoring() {
      cacheMonitor.startMonitoring();
    },
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
      cacheMonitor.stopMonitoring();
    },
    
    /**
     * Get health report
     */
    getHealthReport() {
      return cacheMonitor.performHealthCheck();
    },
  };
}


import { AnalysisCache, InvalidationReason } from './analysis-cache.js';
import { TemplateCache } from './template-cache.js';
import { FileChange } from '../types.js';

/**
 * Update operation types
 */
export enum UpdateType {
  FULL_REGENERATION = 'full_regeneration',
  INCREMENTAL_UPDATE = 'incremental_update',
  SECTION_UPDATE = 'section_update',
  TEMPLATE_REFRESH = 'template_refresh',
}

/**
 * Update operation metadata
 */
export interface UpdateOperation {
  type: UpdateType;
  files: string[];
  sections: string[];
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Section dependency mapping
 */
export interface SectionDependency {
  sectionId: string;
  dependentFiles: string[];
  template: string;
  lastUpdate: number;
}

/**
 * Update strategy configuration
 */
export interface UpdateConfig {
  maxIncrementalFiles: number; // Max files for incremental update
  fullUpdateThreshold: number; // Percentage of files changed to trigger full update
  sectionUpdateDelay: number; // Delay between section updates (ms)
  enableBatching: boolean; // Enable batching of rapid changes
  batchWindow: number; // Time window for batching (ms)
}

/**
 * Incremental documentation updater with intelligent change detection
 */
export class IncrementalUpdater {
  private analysisCache: AnalysisCache;
  private templateCache: TemplateCache;
  private sectionDependencies = new Map<string, SectionDependency>();
  private updateQueue: FileChange[] = [];
  private updateHistory: UpdateOperation[] = [];
  private config: UpdateConfig;
  private batchTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;

  constructor(
    analysisCache: AnalysisCache,
    templateCache: TemplateCache,
    config: Partial<UpdateConfig> = {}
  ) {
    this.analysisCache = analysisCache;
    this.templateCache = templateCache;
    
    this.config = {
      maxIncrementalFiles: config.maxIncrementalFiles || 10,
      fullUpdateThreshold: config.fullUpdateThreshold || 0.3, // 30%
      sectionUpdateDelay: config.sectionUpdateDelay || 100,
      enableBatching: config.enableBatching !== false,
      batchWindow: config.batchWindow || 1000, // 1 second
    };
  }

  /**
   * Process file changes and determine update strategy
   */
  public async processChanges(changes: FileChange[]): Promise<UpdateOperation> {
    const startTime = Date.now();
    
    try {
      // Add changes to queue
      this.updateQueue.push(...changes);
      
      if (this.config.enableBatching) {
        return await this.batchChanges();
      } else {
        return await this.executeUpdate();
      }
    } catch (error) {
      const operation: UpdateOperation = {
        type: UpdateType.INCREMENTAL_UPDATE,
        files: changes.map(c => c.path),
        sections: [],
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      
      this.updateHistory.push(operation);
      return operation;
    }
  }

  /**
   * Batch rapid changes to avoid excessive updates
   */
  private async batchChanges(): Promise<UpdateOperation> {
    return new Promise((resolve) => {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(async () => {
        const operation = await this.executeUpdate();
        resolve(operation);
      }, this.config.batchWindow);
    });
  }

  /**
   * Execute the actual update based on queued changes
   */
  private async executeUpdate(): Promise<UpdateOperation> {
    if (this.isUpdating) {
      // Return a pending operation if already updating
      return {
        type: UpdateType.INCREMENTAL_UPDATE,
        files: [],
        sections: [],
        timestamp: Date.now(),
        duration: 0,
        success: true,
      };
    }

    this.isUpdating = true;
    const startTime = Date.now();
    const changes = [...this.updateQueue];
    this.updateQueue = [];

    try {
      const updateType = this.determineUpdateStrategy(changes);
      const operation = await this.performUpdate(updateType, changes, startTime);
      
      this.updateHistory.push(operation);
      return operation;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Determine the best update strategy based on changes
   */
  private determineUpdateStrategy(changes: FileChange[]): UpdateType {
    const uniqueFiles = new Set(changes.map(c => c.path));
    const totalCachedFiles = this.analysisCache.getCachedFiles().length;
    
    // If too many files changed, do full regeneration
    if (uniqueFiles.size > this.config.maxIncrementalFiles) {
      return UpdateType.FULL_REGENERATION;
    }
    
    // If percentage of files changed exceeds threshold, do full regeneration
    if (totalCachedFiles > 0 && uniqueFiles.size / totalCachedFiles > this.config.fullUpdateThreshold) {
      return UpdateType.FULL_REGENERATION;
    }
    
    // Check if any template files changed
    const templateChanges = changes.filter(c => this.isTemplateFile(c.path));
    if (templateChanges.length > 0) {
      return UpdateType.TEMPLATE_REFRESH;
    }
    
    // Check if changes affect specific sections
    const affectedSections = this.getAffectedSections(Array.from(uniqueFiles));
    if (affectedSections.length > 0 && affectedSections.length < 5) {
      return UpdateType.SECTION_UPDATE;
    }
    
    return UpdateType.INCREMENTAL_UPDATE;
  }

  /**
   * Perform the update based on strategy
   */
  private async performUpdate(
    updateType: UpdateType,
    changes: FileChange[],
    startTime: number
  ): Promise<UpdateOperation> {
    const files = [...new Set(changes.map(c => c.path))];
    let sections: string[] = [];
    let success = true;
    let error: string | undefined;

    try {
      switch (updateType) {
        case UpdateType.FULL_REGENERATION:
          await this.performFullRegeneration(files);
          break;
          
        case UpdateType.INCREMENTAL_UPDATE:
          await this.performIncrementalUpdate(files);
          break;
          
        case UpdateType.SECTION_UPDATE:
          sections = await this.performSectionUpdate(files);
          break;
          
        case UpdateType.TEMPLATE_REFRESH:
          await this.performTemplateRefresh(files);
          break;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const operation: UpdateOperation = {
      type: updateType,
      files,
      sections,
      timestamp: startTime,
      duration: Date.now() - startTime,
      success,
    };

    if (error) {
      operation.error = error;
    }

    return operation;
  }

  /**
   * Perform full documentation regeneration
   */
  private async performFullRegeneration(files: string[]): Promise<void> {
    // Clear relevant caches
    for (const file of files) {
      this.analysisCache.invalidateFile(file, InvalidationReason.MANUAL_INVALIDATION);
    }
    
    // Trigger full project analysis
    // This would typically be handled by the main documentation generator
    console.log(`Full regeneration triggered for ${files.length} files`);
  }

  /**
   * Perform incremental update for specific files
   */
  private async performIncrementalUpdate(files: string[]): Promise<void> {
    for (const file of files) {
      // Invalidate analysis cache for the file
      this.analysisCache.invalidateFile(file, InvalidationReason.FILE_MODIFIED);
      
      // Re-analyze the file if it still exists
      try {
        // This would typically call the appropriate analyzer
        console.log(`Incrementally updating analysis for: ${file}`);
      } catch (error) {
        console.error(`Error updating ${file}:`, error);
      }
    }
  }

  /**
   * Perform section-specific updates
   */
  private async performSectionUpdate(files: string[]): Promise<string[]> {
    const affectedSections = this.getAffectedSections(files);
    
    for (const sectionId of affectedSections) {
      const dependency = this.sectionDependencies.get(sectionId);
      if (dependency) {
        // Update section with delay to avoid rapid updates
        await new Promise(resolve => setTimeout(resolve, this.config.sectionUpdateDelay));
        
        // Regenerate section
        console.log(`Updating section: ${sectionId}`);
        dependency.lastUpdate = Date.now();
      }
    }
    
    return affectedSections;
  }

  /**
   * Perform template refresh
   */
  private async performTemplateRefresh(files: string[]): Promise<void> {
    for (const file of files) {
      if (this.isTemplateFile(file)) {
        this.templateCache.invalidateTemplate(file);
        console.log(`Template refreshed: ${file}`);
      }
    }
  }

  /**
   * Check if file is a template file
   */
  private isTemplateFile(filePath: string): boolean {
    const templateExtensions = ['.hbs', '.handlebars', '.mustache', '.html', '.md'];
    return templateExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Get sections affected by file changes
   */
  private getAffectedSections(files: string[]): string[] {
    const affectedSections = new Set<string>();
    
    for (const [sectionId, dependency] of this.sectionDependencies) {
      for (const file of files) {
        if (dependency.dependentFiles.includes(file)) {
          affectedSections.add(sectionId);
          break;
        }
      }
    }
    
    return Array.from(affectedSections);
  }

  /**
   * Register section dependency
   */
  public registerSectionDependency(
    sectionId: string,
    dependentFiles: string[],
    template: string
  ): void {
    this.sectionDependencies.set(sectionId, {
      sectionId,
      dependentFiles,
      template,
      lastUpdate: Date.now(),
    });
  }

  /**
   * Unregister section dependency
   */
  public unregisterSectionDependency(sectionId: string): void {
    this.sectionDependencies.delete(sectionId);
  }

  /**
   * Get section dependencies
   */
  public getSectionDependencies(): Map<string, SectionDependency> {
    return new Map(this.sectionDependencies);
  }

  /**
   * Get update statistics
   */
  public getStats() {
    const recentOperations = this.updateHistory.slice(-20);
    const successfulOps = recentOperations.filter(op => op.success);
    
    const avgDuration = successfulOps.length > 0
      ? successfulOps.reduce((sum, op) => sum + op.duration, 0) / successfulOps.length
      : 0;

    return {
      totalOperations: this.updateHistory.length,
      recentOperations: recentOperations.length,
      successRate: recentOperations.length > 0 ? successfulOps.length / recentOperations.length : 0,
      averageDuration: avgDuration,
      queueSize: this.updateQueue.length,
      sectionDependencies: this.sectionDependencies.size,
      isUpdating: this.isUpdating,
      operationTypes: {
        fullRegeneration: recentOperations.filter(op => op.type === UpdateType.FULL_REGENERATION).length,
        incremental: recentOperations.filter(op => op.type === UpdateType.INCREMENTAL_UPDATE).length,
        section: recentOperations.filter(op => op.type === UpdateType.SECTION_UPDATE).length,
        template: recentOperations.filter(op => op.type === UpdateType.TEMPLATE_REFRESH).length,
      },
    };
  }

  /**
   * Get update history
   */
  public getUpdateHistory(limit: number = 50): UpdateOperation[] {
    return this.updateHistory.slice(-limit);
  }

  /**
   * Clear update history
   */
  public clearHistory(): void {
    this.updateHistory = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): UpdateConfig {
    return { ...this.config };
  }

  /**
   * Force immediate update processing
   */
  public async forceUpdate(): Promise<UpdateOperation> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    return await this.executeUpdate();
  }

  /**
   * Clear update queue
   */
  public clearQueue(): void {
    this.updateQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Check if updater is currently processing
   */
  public isProcessing(): boolean {
    return this.isUpdating || this.batchTimer !== null;
  }
}
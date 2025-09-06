import * as fs from 'fs';
import * as crypto from 'crypto';
import { CacheManager, CacheConfig } from './cache-manager.js';
import { AnalysisResult, ProjectAnalysis } from '../types.js';

/**
 * File metadata for cache invalidation
 */
export interface FileMetadata {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  analyzed: boolean;
}

/**
 * Analysis cache entry with file metadata
 */
export interface AnalysisCacheEntry {
  filePath: string;
  analysis: AnalysisResult;
  metadata: FileMetadata;
  dependencies: string[];
}

/**
 * Project-level cache entry
 */
export interface ProjectCacheEntry {
  projectPath: string;
  analysis: ProjectAnalysis;
  fileHashes: Map<string, string>;
  lastUpdate: number;
}

/**
 * Cache invalidation reasons for debugging
 */
export enum InvalidationReason {
  FILE_MODIFIED = 'file_modified',
  FILE_DELETED = 'file_deleted',
  DEPENDENCY_CHANGED = 'dependency_changed',
  CACHE_EXPIRED = 'cache_expired',
  HASH_MISMATCH = 'hash_mismatch',
  MANUAL_INVALIDATION = 'manual_invalidation',
}

/**
 * Specialized cache for code analysis results with file-based invalidation
 */
export class AnalysisCache {
  private fileCache: CacheManager<AnalysisCacheEntry>;
  private projectCache: CacheManager<ProjectCacheEntry>;
  private dependencyGraph = new Map<string, Set<string>>();
  private invalidationLog: Array<{ file: string; reason: InvalidationReason; timestamp: number }> = [];

  constructor(config: Partial<CacheConfig> = {}) {
    const cacheConfig = {
      maxSize: config.maxSize || 50, // 50MB for analysis cache
      maxEntries: config.maxEntries || 500,
      ttl: config.ttl || 12 * 60 * 60 * 1000, // 12 hours
      enableStats: config.enableStats !== false,
    };

    this.fileCache = new CacheManager<AnalysisCacheEntry>(cacheConfig);
    this.projectCache = new CacheManager<ProjectCacheEntry>({
      ...cacheConfig,
      maxSize: 20, // 20MB for project cache
      maxEntries: 10, // Fewer project entries
    });
  }

  /**
   * Generate file hash for content-based invalidation
   */
  private async generateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // File might not exist or be readable
      return '';
    }
  }

  /**
   * Get file metadata for cache validation
   */
  private async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const stats = await fs.promises.stat(filePath);
      const hash = await this.generateFileHash(filePath);
      
      return {
        path: filePath,
        hash,
        size: stats.size,
        mtime: stats.mtimeMs,
        analyzed: true,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if file has been modified since last analysis
   */
  private async isFileModified(filePath: string, cachedMetadata: FileMetadata): Promise<boolean> {
    const currentMetadata = await this.getFileMetadata(filePath);
    
    if (!currentMetadata) {
      // File no longer exists
      return true;
    }

    return (
      currentMetadata.hash !== cachedMetadata.hash ||
      currentMetadata.mtime !== cachedMetadata.mtime ||
      currentMetadata.size !== cachedMetadata.size
    );
  }

  /**
   * Store analysis result with file metadata
   */
  public async setAnalysis(
    filePath: string,
    analysis: AnalysisResult,
    dependencies: string[] = []
  ): Promise<void> {
    const metadata = await this.getFileMetadata(filePath);
    
    if (!metadata) {
      console.warn(`Cannot cache analysis for non-existent file: ${filePath}`);
      return;
    }

    const entry: AnalysisCacheEntry = {
      filePath,
      analysis,
      metadata,
      dependencies,
    };

    // Update dependency graph
    this.dependencyGraph.set(filePath, new Set(dependencies));

    // Store in cache
    this.fileCache.set(filePath, entry, metadata.hash);
  }

  /**
   * Retrieve analysis result with validation
   */
  public async getAnalysis(filePath: string): Promise<AnalysisResult | null> {
    const entry = this.fileCache.get(filePath);
    
    if (!entry) {
      return null;
    }

    // Check if file has been modified
    const isModified = await this.isFileModified(filePath, entry.metadata);
    
    if (isModified) {
      this.invalidateFile(filePath, InvalidationReason.FILE_MODIFIED);
      return null;
    }

    return entry.analysis;
  }

  /**
   * Store project-level analysis
   */
  public async setProjectAnalysis(
    projectPath: string,
    analysis: ProjectAnalysis,
    fileHashes: Map<string, string>
  ): Promise<void> {
    const entry: ProjectCacheEntry = {
      projectPath,
      analysis,
      fileHashes,
      lastUpdate: Date.now(),
    };

    this.projectCache.set(projectPath, entry);
  }

  /**
   * Retrieve project-level analysis
   */
  public async getProjectAnalysis(projectPath: string): Promise<ProjectAnalysis | null> {
    const entry = this.projectCache.get(projectPath);
    
    if (!entry) {
      return null;
    }

    // Check if any files in the project have been modified
    for (const [filePath, cachedHash] of entry.fileHashes) {
      const currentHash = await this.generateFileHash(filePath);
      if (currentHash !== cachedHash) {
        this.invalidateProject(projectPath, InvalidationReason.FILE_MODIFIED);
        return null;
      }
    }

    return entry.analysis;
  }

  /**
   * Invalidate analysis for a specific file
   */
  public invalidateFile(filePath: string, reason: InvalidationReason = InvalidationReason.MANUAL_INVALIDATION): void {
    this.fileCache.delete(filePath);
    this.dependencyGraph.delete(filePath);
    
    // Log invalidation
    this.invalidationLog.push({
      file: filePath,
      reason,
      timestamp: Date.now(),
    });

    // Invalidate dependent files
    this.invalidateDependents(filePath);
  }

  /**
   * Invalidate project-level analysis
   */
  public invalidateProject(projectPath: string, reason: InvalidationReason = InvalidationReason.MANUAL_INVALIDATION): void {
    this.projectCache.delete(projectPath);
    
    this.invalidationLog.push({
      file: projectPath,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate files that depend on the given file
   */
  private invalidateDependents(filePath: string): void {
    for (const [dependentFile, dependencies] of this.dependencyGraph) {
      if (dependencies.has(filePath)) {
        this.invalidateFile(dependentFile, InvalidationReason.DEPENDENCY_CHANGED);
      }
    }
  }

  /**
   * Invalidate multiple files (batch operation)
   */
  public invalidateFiles(filePaths: string[], reason: InvalidationReason = InvalidationReason.MANUAL_INVALIDATION): void {
    for (const filePath of filePaths) {
      this.invalidateFile(filePath, reason);
    }
  }

  /**
   * Check if analysis exists for file
   */
  public hasAnalysis(filePath: string): boolean {
    return this.fileCache.has(filePath);
  }

  /**
   * Get cached file paths
   */
  public getCachedFiles(): string[] {
    return this.fileCache.keys();
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      fileCache: this.fileCache.getStats(),
      projectCache: this.projectCache.getStats(),
      dependencyGraph: {
        totalFiles: this.dependencyGraph.size,
        totalDependencies: Array.from(this.dependencyGraph.values())
          .reduce((sum, deps) => sum + deps.size, 0),
      },
      invalidations: {
        total: this.invalidationLog.length,
        recent: this.invalidationLog.slice(-10),
      },
    };
  }

  /**
   * Clean up expired entries and perform maintenance
   */
  public cleanup(): { filesCleanedUp: number; projectsCleanedUp: number } {
    const filesCleanedUp = this.fileCache.cleanup();
    const projectsCleanedUp = this.projectCache.cleanup();

    // Clean up old invalidation logs (keep last 100)
    if (this.invalidationLog.length > 100) {
      this.invalidationLog = this.invalidationLog.slice(-100);
    }

    return { filesCleanedUp, projectsCleanedUp };
  }

  /**
   * Clear all caches
   */
  public clear(): void {
    this.fileCache.clear();
    this.projectCache.clear();
    this.dependencyGraph.clear();
    this.invalidationLog = [];
  }

  /**
   * Get dependency information for a file
   */
  public getDependencies(filePath: string): string[] {
    const dependencies = this.dependencyGraph.get(filePath);
    return dependencies ? Array.from(dependencies) : [];
  }

  /**
   * Get files that depend on the given file
   */
  public getDependents(filePath: string): string[] {
    const dependents: string[] = [];
    
    for (const [dependentFile, dependencies] of this.dependencyGraph) {
      if (dependencies.has(filePath)) {
        dependents.push(dependentFile);
      }
    }
    
    return dependents;
  }

  /**
   * Validate cache integrity (for debugging)
   */
  public async validateCache(): Promise<{
    valid: boolean;
    issues: Array<{ file: string; issue: string }>;
  }> {
    const issues: Array<{ file: string; issue: string }> = [];
    
    for (const filePath of this.getCachedFiles()) {
      const entry = this.fileCache.get(filePath);
      if (!entry) continue;

      // Check if file still exists
      try {
        await fs.promises.access(filePath);
      } catch {
        issues.push({ file: filePath, issue: 'File no longer exists' });
        continue;
      }

      // Check if file has been modified
      const isModified = await this.isFileModified(filePath, entry.metadata);
      if (isModified) {
        issues.push({ file: filePath, issue: 'File has been modified' });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get invalidation history
   */
  public getInvalidationHistory(limit: number = 50): Array<{ file: string; reason: InvalidationReason; timestamp: number }> {
    return this.invalidationLog.slice(-limit);
  }

  /**
   * Resize cache limits
   */
  public resize(fileCacheSize?: number, projectCacheSize?: number): void {
    if (fileCacheSize !== undefined) {
      this.fileCache.resize(fileCacheSize);
    }
    if (projectCacheSize !== undefined) {
      this.projectCache.resize(projectCacheSize);
    }
  }
}
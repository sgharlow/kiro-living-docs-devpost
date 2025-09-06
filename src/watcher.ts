import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { FileChange, ProjectConfig } from './types.js';
import * as path from 'path';

/**
 * File watcher component that monitors project files for changes
 * and emits events for documentation updates
 */
export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private config: ProjectConfig;
  private changeQueue: FileChange[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatching = false;

  constructor(config: ProjectConfig) {
    super();
    this.config = config;
  }

  /**
   * Start watching files in the project directory
   */
  public async startWatching(): Promise<void> {
    if (this.isWatching) {
      throw new Error('File watcher is already running');
    }

    const watchPatterns = this.buildWatchPatterns();
    
    this.watcher = chokidar.watch(watchPatterns, {
      cwd: this.config.projectPath,
      ignored: this.config.excludePatterns || [],
      ignoreInitial: true, // Don't emit events for existing files
      persistent: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'deleted'))
      .on('error', (error) => this.emit('error', error))
      .on('ready', () => {
        this.isWatching = true;
        this.emit('ready');
      });

    return new Promise((resolve, reject) => {
      if (!this.watcher) {
        reject(new Error('Failed to create watcher'));
        return;
      }

      this.watcher.on('ready', () => resolve());
      this.watcher.on('error', reject);
    });
  }

  /**
   * Stop watching files
   */
  public async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
    this.changeQueue = [];
    this.emit('stopped');
  }

  /**
   * Get current watching status
   */
  public getStatus(): { isWatching: boolean; queuedChanges: number } {
    return {
      isWatching: this.isWatching,
      queuedChanges: this.changeQueue.length,
    };
  }

  /**
   * Handle individual file changes
   */
  private handleFileChange(filePath: string, type: FileChange['type']): void {
    // Filter out non-source files
    if (!this.isSourceFile(filePath)) {
      return;
    }

    const absolutePath = path.resolve(this.config.projectPath, filePath);
    const change: FileChange = {
      path: absolutePath,
      type,
      timestamp: Date.now(),
    };

    // Add to queue
    this.changeQueue.push(change);

    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChangeQueue();
    }, this.config.watchDebounceMs || 300);
  }

  /**
   * Process queued file changes
   */
  private processChangeQueue(): void {
    if (this.changeQueue.length === 0) {
      return;
    }

    // Group changes by file path, keeping only the latest change per file
    const latestChanges = new Map<string, FileChange>();
    
    for (const change of this.changeQueue) {
      const existing = latestChanges.get(change.path);
      if (!existing || change.timestamp > existing.timestamp) {
        latestChanges.set(change.path, change);
      }
    }

    const changes = Array.from(latestChanges.values());
    this.changeQueue = [];

    // Emit batch change event
    this.emit('changes', changes);

    // Emit individual change events for compatibility
    for (const change of changes) {
      this.emit('fileChanged', change);
    }
  }

  /**
   * Build watch patterns from configuration
   */
  private buildWatchPatterns(): string[] {
    const patterns = this.config.includePatterns || [
      '**/*.ts',
      '**/*.js',
      '**/*.tsx',
      '**/*.jsx',
      '**/*.py',
      '**/*.go',
    ];

    // Return patterns relative to project path, not absolute paths
    return patterns;
  }

  /**
   * Check if a file should be processed based on extension
   */
  private isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.md'];
    return sourceExtensions.includes(ext);
  }

  /**
   * Force process any queued changes immediately
   */
  public flushChanges(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.processChangeQueue();
  }
}
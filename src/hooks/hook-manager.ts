import { EventEmitter } from 'events';
import { TypeScriptAnalyzer } from '../analyzers/typescript-analyzer.js';
import { PythonAnalyzer } from '../analyzers/python-analyzer.js';
import { GoAnalyzer } from '../analyzers/go-analyzer.js';
import { GitAnalyzer } from '../analyzers/git-analyzer.js';
import { MarkdownGenerator } from '../generators/markdown-generator.js';
import { SteeringParser } from '../steering/steering-parser.js';
import { FileWatcher } from '../watcher.js';
import { AnalysisResult, ProjectAnalysis } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';

export interface HookEvent {
  type: 'file-save' | 'commit' | 'pull-request' | 'file-focus' | 'branch-switch';
  filePath?: string;
  projectPath: string;
  metadata?: {
    commitHash?: string;
    branchName?: string;
    pullRequestId?: string;
    author?: string;
    timestamp?: Date;
  };
}

export interface HookConfig {
  enabled: boolean;
  events: string[];
  debounceMs?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  outputPath?: string;
  notifyOnComplete?: boolean;
}

export interface DocumentationUpdate {
  filePath: string;
  content: string;
  type: 'file' | 'project';
  timestamp: Date;
  triggerEvent: HookEvent;
}

/**
 * Manages Kiro IDE hooks for automatic documentation updates
 */
export class HookManager extends EventEmitter {
  private projectPath: string;
  private config: HookConfig;
  private tsAnalyzer: TypeScriptAnalyzer;
  private pythonAnalyzer: PythonAnalyzer;
  private goAnalyzer: GoAnalyzer;
  private gitAnalyzer: GitAnalyzer;
  private markdownGenerator: MarkdownGenerator;
  private readonly steeringParser: SteeringParser;
  private fileWatcher?: FileWatcher;
  private updateQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(projectPath: string, config: HookConfig) {
    super();
    this.projectPath = projectPath;
    this.config = config;
    
    // Initialize analyzers and generators
    this.tsAnalyzer = new TypeScriptAnalyzer();
    this.pythonAnalyzer = new PythonAnalyzer();
    this.goAnalyzer = new GoAnalyzer();
    this.gitAnalyzer = new GitAnalyzer(projectPath);
    this.markdownGenerator = new MarkdownGenerator(projectPath);
    this.steeringParser = new SteeringParser(projectPath);
  }

  /**
   * Initialize hook system and start listening for events
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Set up file watching if file-save events are enabled
      if (this.config.events.includes('file-save')) {
        await this.setupFileWatching();
      }

      // Set up git hooks if commit events are enabled
      if (this.config.events.includes('commit')) {
        await this.setupGitHooks();
      }

      this.emit('initialized', { projectPath: this.projectPath });
    } catch (error) {
      this.emit('error', { error, context: 'initialization' });
      throw error;
    }
  }

  /**
   * Handle hook events from Kiro IDE
   */
  public async handleHookEvent(event: HookEvent): Promise<void> {
    if (!this.config.enabled || !this.config.events.includes(event.type)) {
      return;
    }

    try {
      this.emit('hook-triggered', event);

      switch (event.type) {
        case 'file-save':
          await this.handleFileSave(event);
          break;
        case 'commit':
          await this.handleCommit(event);
          break;
        case 'pull-request':
          await this.handlePullRequest(event);
          break;
        case 'file-focus':
          await this.handleFileFocus(event);
          break;
        case 'branch-switch':
          await this.handleBranchSwitch(event);
          break;
        default:
          console.warn(`Unknown hook event type: ${event.type}`);
      }
    } catch (error) {
      this.emit('error', { error, event, context: 'hook-handling' });
      console.error(`Error handling hook event ${event.type}:`, error);
    }
  }

  /**
   * Handle file save events for immediate documentation updates
   */
  private async handleFileSave(event: HookEvent): Promise<void> {
    if (!event.filePath) {
      return;
    }

    const filePath = event.filePath;
    
    // Check if file should be processed
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    // Debounce rapid saves
    const existingTimeout = this.updateQueue.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        await this.updateFileDocumentation(filePath, event);
        this.updateQueue.delete(filePath);
      } catch (error) {
        this.emit('error', { error, filePath, context: 'file-save' });
      }
    }, this.config.debounceMs || 1000);

    this.updateQueue.set(filePath, timeout);
  }

  /**
   * Handle commit events for full documentation regeneration
   */
  private async handleCommit(event: HookEvent): Promise<void> {
    try {
      // Get list of changed files from git
      const recentChanges = await this.gitAnalyzer.getRecentChanges(new Date(Date.now() - 24 * 60 * 60 * 1000));
      
      if (recentChanges.length === 0) {
        return;
      }

      // Update documentation for all changed files
      const updates: DocumentationUpdate[] = [];
      
      for (const change of recentChanges.slice(0, 10)) { // Limit to prevent overwhelming
        for (const changedFile of change.filesChanged) {
          const fullPath = path.resolve(this.projectPath, changedFile);
          
          if (this.shouldProcessFile(fullPath) && fs.existsSync(fullPath)) {
            try {
              const update = await this.updateFileDocumentation(fullPath, event);
              if (update) {
                updates.push(update);
              }
            } catch (error) {
              console.error(`Error updating documentation for ${changedFile}:`, error);
            }
          }
        }
      }

      // Generate project-level documentation
      await this.updateProjectDocumentation(event);

      this.emit('commit-processed', { 
        event, 
        updatesCount: updates.length,
        commitHash: event.metadata?.commitHash 
      });

      if (this.config.notifyOnComplete) {
        this.notifyUser(`Documentation updated for ${updates.length} files after commit`);
      }
    } catch (error) {
      this.emit('error', { error, event, context: 'commit-handling' });
    }
  }

  /**
   * Handle pull request events for documentation diff generation
   */
  private async handlePullRequest(event: HookEvent): Promise<void> {
    try {
      // Generate documentation diff for PR
      const prId = event.metadata?.pullRequestId;
      if (!prId) {
        return;
      }

      // Get changed files in the PR (simplified - would need actual git diff)
      const recentChanges = await this.gitAnalyzer.getRecentChanges(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      
      const docChanges: string[] = [];
      
      for (const change of recentChanges.slice(0, 5)) {
        for (const changedFile of change.filesChanged) {
          if (this.shouldProcessFile(changedFile)) {
            docChanges.push(`- ${changedFile}: Documentation updated`);
          }
        }
      }

      if (docChanges.length > 0) {
        const diffSummary = `## Documentation Changes\n\n${docChanges.join('\n')}`;
        
        this.emit('pr-documentation-diff', {
          pullRequestId: prId,
          diff: diffSummary,
          changedFiles: docChanges.length
        });
      }
    } catch (error) {
      this.emit('error', { error, event, context: 'pull-request-handling' });
    }
  }

  /**
   * Handle file focus events for contextual documentation updates
   */
  private async handleFileFocus(event: HookEvent): Promise<void> {
    if (!event.filePath) {
      return;
    }

    try {
      // Generate contextual documentation for the focused file
      const filePath = event.filePath;
      
      if (!this.shouldProcessFile(filePath)) {
        return;
      }

      // Get file context from git history
      const featureContext = await this.gitAnalyzer.extractFeatureContext(filePath);
      
      // Analyze the file
      const analysis = await this.analyzeFile(filePath);
      
      this.emit('contextual-documentation', {
        filePath,
        analysis,
        featureContext,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', { error, event, context: 'file-focus-handling' });
    }
  }

  /**
   * Handle branch switch events
   */
  private async handleBranchSwitch(event: HookEvent): Promise<void> {
    try {
      const branchName = event.metadata?.branchName;
      if (!branchName) {
        return;
      }

      // Update project documentation for the new branch context
      await this.updateProjectDocumentation(event);

      this.emit('branch-switched', {
        branchName,
        projectPath: this.projectPath,
        timestamp: new Date()
      });

      if (this.config.notifyOnComplete) {
        this.notifyUser(`Documentation context updated for branch: ${branchName}`);
      }
    } catch (error) {
      this.emit('error', { error, event, context: 'branch-switch-handling' });
    }
  }

  /**
   * Update documentation for a specific file
   */
  private async updateFileDocumentation(filePath: string, triggerEvent: HookEvent): Promise<DocumentationUpdate | null> {
    try {
      // Analyze the file
      const analysis = await this.analyzeFile(filePath);
      
      // Apply steering configuration if available
      const steeringConfig = await this.steeringParser.loadSteeringConfig();
      
      // Generate documentation with steering configuration
      let documentation = await this.markdownGenerator.generateFileDocumentation(filePath, analysis);
      
      // Apply steering terminology replacements if configured
      if (steeringConfig.terminology?.replacements) {
        documentation = this.steeringParser.applyTerminologyReplacements(documentation, steeringConfig);
      }
      
      // Write documentation file
      const outputPath = this.getDocumentationPath(filePath);
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, documentation);

      const update: DocumentationUpdate = {
        filePath: outputPath,
        content: documentation,
        type: 'file',
        timestamp: new Date(),
        triggerEvent
      };

      this.emit('documentation-updated', update);
      return update;
    } catch (error) {
      console.error(`Error updating documentation for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Update project-level documentation
   */
  private async updateProjectDocumentation(triggerEvent: HookEvent): Promise<void> {
    try {
      // Find all source files
      const glob = await import('glob');
      const patterns = ['**/*.ts', '**/*.js', '**/*.py'];
      const files: string[] = [];
      
      for (const pattern of patterns) {
        const matches = glob.globSync(pattern, {
          cwd: this.projectPath,
          ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*'],
        });
        files.push(...matches.map(f => path.resolve(this.projectPath, f)));
      }

      // Analyze files and create project analysis
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: path.basename(this.projectPath),
          description: `Documentation for ${path.basename(this.projectPath)}`,
          languages: ['typescript', 'javascript', 'python'],
        },
        structure: {
          directories: [],
          files: files.slice(0, 20), // Limit for performance
          entryPoints: [],
          testFiles: [],
          configFiles: [],
        },
        files: new Map(),
        lastUpdated: new Date(),
      };

      // Analyze a subset of files for project documentation
      for (const file of files.slice(0, 10)) {
        try {
          const analysis = await this.analyzeFile(file);
          projectAnalysis.files.set(file, analysis);
        } catch (error) {
          console.error(`Error analyzing ${file}:`, error);
        }
      }

      // Generate project documentation
      const projectDoc = this.markdownGenerator.generateProjectDocumentation(projectAnalysis);
      const outputPath = path.join(this.config.outputPath || 'docs', 'README.md');
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, projectDoc.markdown || '');

      this.emit('project-documentation-updated', {
        filePath: outputPath,
        filesAnalyzed: projectAnalysis.files.size,
        triggerEvent
      });
    } catch (error) {
      console.error('Error updating project documentation:', error);
    }
  }

  /**
   * Analyze a file based on its type
   */
  private async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      return this.tsAnalyzer.analyze(filePath);
    } else if (['.py', '.pyw'].includes(ext)) {
      return this.pythonAnalyzer.analyze(filePath);
    } else if (ext === '.go') {
      return this.goAnalyzer.analyze(filePath);
    } else {
      // Return empty analysis for unsupported files
      return {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };
    }
  }

  /**
   * Check if a file should be processed based on patterns
   */
  private shouldProcessFile(filePath: string): boolean {
    const relativePath = path.relative(this.projectPath, filePath);
    
    // Check exclude patterns
    if (this.config.excludePatterns) {
      for (const pattern of this.config.excludePatterns) {
        if (relativePath.includes(pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.config.includePatterns) {
      for (const pattern of this.config.includePatterns) {
        if (relativePath.includes(pattern)) {
          return true;
        }
      }
      return false; // If include patterns are specified, file must match one
    }

    // Default: process source files
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.js', '.tsx', '.jsx', '.py', '.pyw'].includes(ext);
  }

  /**
   * Get documentation output path for a source file
   */
  private getDocumentationPath(filePath: string): string {
    const relativePath = path.relative(this.projectPath, filePath);
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const dirName = path.dirname(relativePath);
    
    const outputDir = this.config.outputPath || 'docs';
    return path.join(this.projectPath, outputDir, dirName, `${baseName}.md`);
  }

  /**
   * Set up file watching for file-save events
   */
  private async setupFileWatching(): Promise<void> {
    // This would integrate with Kiro's file watching system
    // For now, we'll set up a basic file watcher as a fallback
    const { ConfigManager } = await import('../config.js');
    const config = await ConfigManager.loadConfig(this.projectPath);
    
    this.fileWatcher = new FileWatcher(config);
    
    this.fileWatcher.on('fileChanged', (change) => {
      this.handleHookEvent({
        type: 'file-save',
        filePath: change.path,
        projectPath: this.projectPath,
        metadata: {
          timestamp: new Date(change.timestamp)
        }
      });
    });

    await this.fileWatcher.startWatching();
  }

  /**
   * Set up git hooks for commit events
   */
  private async setupGitHooks(): Promise<void> {
    // This would integrate with git hooks
    // For now, we'll just set up the infrastructure
    const gitHooksDir = path.join(this.projectPath, '.git', 'hooks');
    
    if (fs.existsSync(gitHooksDir)) {
      // Could set up post-commit hook here
      console.log('Git hooks directory found, ready for commit integration');
    }
  }

  /**
   * Notify user of documentation updates
   */
  private notifyUser(message: string): void {
    // This would integrate with Kiro's notification system
    console.log(`📚 Living Docs: ${message}`);
    this.emit('user-notification', { message, timestamp: new Date() });
  }

  /**
   * Stop the hook manager and clean up resources
   */
  public async stop(): Promise<void> {
    // Clear any pending updates
    for (const timeout of this.updateQueue.values()) {
      clearTimeout(timeout);
    }
    this.updateQueue.clear();

    // Stop file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.stopWatching();
    }

    this.emit('stopped');
  }

  /**
   * Get current hook statistics
   */
  public getStatistics(): {
    eventsProcessed: number;
    filesUpdated: number;
    lastUpdate: Date | null;
    queuedUpdates: number;
  } {
    return {
      eventsProcessed: this.listenerCount('hook-triggered'),
      filesUpdated: this.listenerCount('documentation-updated'),
      lastUpdate: null, // Would track this in a real implementation
      queuedUpdates: this.updateQueue.size,
    };
  }
}
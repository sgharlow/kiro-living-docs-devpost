/**
 * Resilient analyzer that provides graceful degradation and error recovery
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandler, PartialAnalysisResult } from '../errors/error-handler';
import { 
  DocumentationError, 
  ErrorCollection, 
  ErrorSeverity, 
  ErrorCategory
} from '../errors/error-types';
import { AnalysisResult } from '../types';
import { TypeScriptAnalyzer } from './typescript-analyzer';
import { PythonAnalyzer } from './python-analyzer';
import { GoAnalyzer } from './go-analyzer';

export interface ResilientAnalyzerConfig {
  enableFallbacks: boolean;
  maxFileSize: number;
  timeoutMs: number;
  skipBinaryFiles: boolean;
  skipLargeFiles: boolean;
  maxConcurrentFiles: number;
}

export interface AnalysisOptions {
  includePartialResults: boolean;
  continueOnError: boolean;
  prioritizeFiles: string[];
  excludePatterns: string[];
}

export class ResilientAnalyzer {
  private errorHandler: ErrorHandler;
  private config: ResilientAnalyzerConfig;
  private tsAnalyzer: TypeScriptAnalyzer;
  private pythonAnalyzer: PythonAnalyzer;
  private goAnalyzer: GoAnalyzer;

  constructor(config: Partial<ResilientAnalyzerConfig> = {}) {
    this.config = {
      enableFallbacks: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timeoutMs: 30000, // 30 seconds
      skipBinaryFiles: true,
      skipLargeFiles: true,
      maxConcurrentFiles: 5,
      ...config
    };

    this.errorHandler = new ErrorHandler({
      enableFallbacks: this.config.enableFallbacks,
      maxFileSize: this.config.maxFileSize,
      timeoutMs: this.config.timeoutMs
    });

    this.tsAnalyzer = new TypeScriptAnalyzer();
    this.pythonAnalyzer = new PythonAnalyzer();
    this.goAnalyzer = new GoAnalyzer();

    this.setupFallbackStrategies();
  }

  /**
   * Analyze a single file with error recovery
   */
  public async analyzeFile(filePath: string, options: Partial<AnalysisOptions> = {}): Promise<PartialAnalysisResult> {
    const errors = new ErrorCollection();
    const fallbacksUsed: string[] = [];

    try {
      // Apply analysis options
      console.log(`Analyzing ${filePath} with options:`, options);
      
      // Check if file exists and is accessible
      const result = await this.errorHandler.handleFileAccess(
        filePath,
        async () => {
          // Determine file type and select appropriate analyzer
          const analyzer = this.selectAnalyzer(filePath);
          if (!analyzer) {
            throw new DocumentationError(
              `No analyzer available for file type: ${path.extname(filePath)}`,
              `File "${filePath}" has an unsupported file type and will be skipped.`,
              ErrorSeverity.LOW,
              ErrorCategory.PARSER,
              { filePath, operation: 'analyzer_selection' }
            );
          }

          // Perform analysis with error handling
          return await this.errorHandler.handleParserError(
            filePath,
            analyzer.name,
            () => analyzer.analyze(filePath),
            this.getFallbackParsers(filePath)
          );
        },
        // Fallback: return empty analysis
        async () => {
          fallbacksUsed.push('empty_analysis');
          return await this.errorHandler.executeFallback('empty_analysis');
        }
      );

      return this.errorHandler.createPartialResult(result, errors, fallbacksUsed);

    } catch (error) {
      if (error instanceof DocumentationError) {
        errors.add(error);
      } else {
        errors.add(new DocumentationError(
          `Unexpected error analyzing ${filePath}: ${error}`,
          `Failed to analyze "${filePath}" due to an unexpected error.`,
          ErrorSeverity.HIGH,
          ErrorCategory.PARSER,
          { filePath, operation: 'file_analysis' }
        ));
      }

      // Return partial result with empty analysis
      fallbacksUsed.push('empty_analysis_fallback');
      const emptyResult = await this.errorHandler.executeFallback('empty_analysis');
      return this.errorHandler.createPartialResult(emptyResult, errors, fallbacksUsed);
    }
  }

  /**
   * Analyze multiple files with batch error handling
   */
  public async analyzeFiles(
    filePaths: string[], 
    options: Partial<AnalysisOptions> = {}
  ): Promise<{
    results: PartialAnalysisResult[];
    aggregatedErrors: ErrorCollection;
    summary: {
      total: number;
      successful: number;
      partial: number;
      failed: number;
      skipped: number;
    };
  }> {
    const {
      includePartialResults = true,
      continueOnError = true,
      prioritizeFiles = [],
      excludePatterns = []
    } = options;

    // Filter and prioritize files
    const filteredFiles = this.filterFiles(filePaths, excludePatterns);
    const prioritizedFiles = this.prioritizeFiles(filteredFiles, prioritizeFiles);

    const aggregatedErrors = new ErrorCollection();
    const results: PartialAnalysisResult[] = [];
    
    let successful = 0;
    let partial = 0;
    let failed = 0;
    let skipped = 0;

    // Process files in batches
    const batchResult = await this.errorHandler.batchProcess(
      prioritizedFiles,
      async (filePath: string) => {
        // Check if we should skip this file
        if (this.shouldSkipFile(filePath)) {
          skipped++;
          throw new DocumentationError(
            `File skipped: ${filePath}`,
            `Skipping "${filePath}" (binary file, too large, or excluded pattern)`,
            ErrorSeverity.LOW,
            ErrorCategory.FILE_ACCESS,
            { filePath, operation: 'file_filter' }
          );
        }

        const result = await this.analyzeFile(filePath, options);
        
        // Categorize result
        if (result.errors.isEmpty()) {
          successful++;
        } else if (result.completeness > 0.5) {
          partial++;
        } else {
          failed++;
        }

        return result;
      },
      {
        continueOnError,
        maxConcurrent: this.config.maxConcurrentFiles,
        collectPartialResults: includePartialResults
      }
    );

    // Collect all results and errors
    results.push(...batchResult.results.filter(r => r !== null));
    aggregatedErrors.addAll(batchResult.errors.getErrors());

    // Add errors from individual file analyses
    results.forEach(result => {
      aggregatedErrors.addAll(result.errors.getErrors());
    });

    return {
      results,
      aggregatedErrors,
      summary: {
        total: filePaths.length,
        successful,
        partial,
        failed,
        skipped: skipped + batchResult.skipped
      }
    };
  }

  /**
   * Analyze project directory with comprehensive error handling
   */
  public async analyzeProject(
    projectPath: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<{
    results: Map<string, PartialAnalysisResult>;
    errors: ErrorCollection;
    summary: {
      filesProcessed: number;
      filesSkipped: number;
      errorsEncountered: number;
      completenessAverage: number;
    };
  }> {
    const errors = new ErrorCollection();
    const results = new Map<string, PartialAnalysisResult>();

    try {
      // Discover files in project
      const files = await this.discoverProjectFiles(projectPath);
      
      // Analyze all files
      const analysisResult = await this.analyzeFiles(files, options);
      
      // Map results by file path
      files.forEach((filePath, index) => {
        if (index < analysisResult.results.length) {
          results.set(filePath, analysisResult.results[index]);
        }
      });

      errors.addAll(analysisResult.aggregatedErrors.getErrors());

      // Calculate summary statistics
      const completenessValues = Array.from(results.values()).map(r => r.completeness);
      const completenessAverage = completenessValues.length > 0 
        ? completenessValues.reduce((sum, val) => sum + val, 0) / completenessValues.length 
        : 0;

      return {
        results,
        errors,
        summary: {
          filesProcessed: analysisResult.summary.successful + analysisResult.summary.partial,
          filesSkipped: analysisResult.summary.skipped + analysisResult.summary.failed,
          errorsEncountered: errors.getErrors().length,
          completenessAverage
        }
      };

    } catch (error) {
      errors.add(new DocumentationError(
        `Project analysis failed: ${error}`,
        `Failed to analyze project at "${projectPath}". Please check the path and permissions.`,
        ErrorSeverity.CRITICAL,
        ErrorCategory.FILE_ACCESS,
        { operation: 'project_analysis', additionalInfo: { projectPath } }
      ));

      return {
        results,
        errors,
        summary: {
          filesProcessed: 0,
          filesSkipped: 0,
          errorsEncountered: errors.getErrors().length,
          completenessAverage: 0
        }
      };
    }
  }

  /**
   * Get health status of the analyzer
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    resourceUsage: ReturnType<ErrorHandler['getResourceStats']>;
    errorStats: ReturnType<ErrorHandler['getErrorStats']>;
    recommendations: string[];
  } {
    const resourceUsage = this.errorHandler.getResourceStats();
    const errorStats = this.errorHandler.getErrorStats();
    const recommendations: string[] = [];

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check resource constraints
    if (resourceUsage.isConstrained) {
      status = 'degraded';
      recommendations.push('Memory usage is high. Consider processing fewer files concurrently.');
    }

    // Check error rates
    const recentCriticalErrors = errorStats.recent.filter(e => e.severity === ErrorSeverity.CRITICAL);
    if (recentCriticalErrors.length > 0) {
      status = 'critical';
      recommendations.push('Critical errors detected. Check file permissions and system resources.');
    }

    const highErrorRate = errorStats.bySeverity[ErrorSeverity.HIGH] > 5;
    if (highErrorRate && status !== 'critical') {
      status = 'degraded';
      recommendations.push('High error rate detected. Consider checking file formats and syntax.');
    }

    if (status === 'healthy') {
      recommendations.push('System is operating normally.');
    }

    return {
      status,
      resourceUsage,
      errorStats,
      recommendations
    };
  }

  /**
   * Private helper methods
   */

  private selectAnalyzer(filePath: string): { name: string; analyze: (path: string) => Promise<AnalysisResult> } | null {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        return { name: 'TypeScript', analyze: async (p) => await this.tsAnalyzer.analyze(p) };
      
      case '.py':
      case '.pyw':
        return { name: 'Python', analyze: async (p) => this.pythonAnalyzer.analyze(p) };
      
      case '.go':
        return { name: 'Go', analyze: async (p) => this.goAnalyzer.analyze(p) };
      
      default:
        return null;
    }
  }

  private getFallbackParsers(filePath: string): Array<{ name: string; parser: () => Promise<AnalysisResult> }> {
    const fallbacks: Array<{ name: string; parser: () => Promise<AnalysisResult> }> = [];
    
    // Add regex-based fallback parser for any file type
    fallbacks.push({
      name: 'regex_fallback',
      parser: async () => this.regexBasedAnalysis(filePath)
    });

    return fallbacks;
  }

  private async regexBasedAnalysis(filePath: string): Promise<AnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result: AnalysisResult = {
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    };

    // Basic regex patterns for common constructs
    const functionPattern = /(?:function|def|func)\s+(\w+)/g;
    const classPattern = /(?:class|type)\s+(\w+)/g;
    const todoPattern = /(TODO|FIXME|HACK|NOTE):\s*(.+)/gi;
    const commentPattern = /(?:\/\/|#)\s*(.+)/g;

    let match;

    // Extract functions
    while ((match = functionPattern.exec(content)) !== null) {
      result.functions.push({
        name: match[1],
        parameters: [],
        isAsync: false,
        isExported: true,
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index) + 1
      });
    }

    // Extract classes/types
    while ((match = classPattern.exec(content)) !== null) {
      result.classes.push({
        name: match[1],
        methods: [],
        properties: [],
        isExported: true,
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index) + 1
      });
    }

    // Extract TODOs
    while ((match = todoPattern.exec(content)) !== null) {
      result.todos.push({
        type: match[1].toUpperCase() as any,
        content: match[2].trim(),
        line: this.getLineNumber(content, match.index)
      });
    }

    // Extract comments
    while ((match = commentPattern.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      result.comments.push({
        type: 'single',
        content: match[1].trim(),
        startLine: line,
        endLine: line
      });
    }

    return result;
  }

  private getLineNumber(content: string, position: number): number {
    return content.substring(0, position).split('\n').length;
  }

  private shouldSkipFile(filePath: string): boolean {
    // Skip binary files
    if (this.config.skipBinaryFiles && this.isBinaryFile(filePath)) {
      return true;
    }

    // Skip large files
    if (this.config.skipLargeFiles) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > this.config.maxFileSize) {
          return true;
        }
      } catch (error) {
        // If we can't stat the file, skip it
        return true;
      }
    }

    return false;
  }

  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  private filterFiles(filePaths: string[], excludePatterns: string[]): string[] {
    if (excludePatterns.length === 0) return filePaths;

    return filePaths.filter(filePath => {
      return !excludePatterns.some(pattern => {
        // Simple glob-like pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(filePath);
      });
    });
  }

  private prioritizeFiles(filePaths: string[], prioritizeFiles: string[]): string[] {
    if (prioritizeFiles.length === 0) return filePaths;

    const prioritized: string[] = [];
    const remaining: string[] = [];

    filePaths.forEach(filePath => {
      const isPriority = prioritizeFiles.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(filePath);
      });

      if (isPriority) {
        prioritized.push(filePath);
      } else {
        remaining.push(filePath);
      }
    });

    return [...prioritized, ...remaining];
  }

  private async discoverProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.pyw', '.go'];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common directories that don't contain source code
            if (!['node_modules', '.git', 'dist', 'build', '__pycache__', 'vendor'].includes(entry.name)) {
              await walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await walkDir(projectPath);
    return files;
  }

  private setupFallbackStrategies(): void {
    // Register additional fallback strategies specific to analysis
    this.errorHandler.registerFallback('minimal_analysis', async () => ({
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [{ 
        type: 'single' as const, 
        content: 'Analysis failed - minimal fallback used', 
        startLine: 1, 
        endLine: 1 
      }],
      todos: [],
      apiEndpoints: []
    }));
  }
}
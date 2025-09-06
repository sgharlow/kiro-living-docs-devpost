/**
 * Error handler with graceful degradation strategies
 */

import * as fs from 'fs';
import {
  DocumentationError,
  ErrorCollection,
  ErrorSeverity,
  ErrorCategory,
  FileAccessError,
  ParserError,
  TemplateError,
  ResourceConstraintError
} from './error-types';
import { AnalysisResult } from '../types.js';

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  enableFallbacks: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxMemoryMB: number;
  maxFileSize: number;
  timeoutMs: number;
}

export interface PartialAnalysisResult {
  result: AnalysisResult;
  errors: ErrorCollection;
  completeness: number; // 0-1 indicating how complete the analysis is
  fallbacksUsed: string[];
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorLog: DocumentationError[] = [];
  private fallbackStrategies: Map<string, () => Promise<any>> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableFallbacks: true,
      logLevel: 'warn',
      maxMemoryMB: 100,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timeoutMs: 30000, // 30 seconds
      ...config
    };

    this.setupFallbackStrategies();
  }

  /**
   * Handle file access errors with retry and fallback strategies
   */
  public async handleFileAccess<T>(
    filePath: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    // Check file size before processing
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.config.maxFileSize) {
        throw new ResourceConstraintError(
          'file_size',
          `${Math.round(stats.size / 1024 / 1024)}MB (max: ${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`,
          [
            {
              type: 'skip',
              description: 'Skip this large file to avoid memory issues'
            },
            {
              type: 'partial',
              description: 'Process only the first part of the file'
            }
          ]
        );
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.log('warn', `Could not check file size for ${filePath}: ${error}`);
      }
    }

    // Retry logic
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.withTimeout(operation(), this.config.timeoutMs);
      } catch (error) {
        lastError = error as Error;
        this.log('debug', `File access attempt ${attempt} failed for ${filePath}: ${error}`);

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    // All retries failed, try fallback
    if (fallback && this.config.enableFallbacks) {
      try {
        this.log('info', `Using fallback strategy for ${filePath}`);
        return await fallback();
      } catch (fallbackError) {
        this.log('warn', `Fallback also failed for ${filePath}: ${fallbackError}`);
      }
    }

    // Create and log error
    const error = new FileAccessError(filePath, lastError!);
    this.logError(error);
    throw error;
  }

  /**
   * Handle parser errors with fallback parsers
   */
  public async handleParserError<T>(
    filePath: string,
    parserType: string,
    primaryParser: () => Promise<T>,
    fallbackParsers: Array<{ name: string; parser: () => Promise<T> }> = []
  ): Promise<T> {
    // Try primary parser
    try {
      return await this.withTimeout(primaryParser(), this.config.timeoutMs);
    } catch (primaryError) {
      this.log('debug', `Primary ${parserType} parser failed for ${filePath}: ${primaryError}`);

      // Try fallback parsers
      if (this.config.enableFallbacks) {
        for (const fallback of fallbackParsers) {
          try {
            this.log('info', `Trying fallback parser ${fallback.name} for ${filePath}`);
            return await this.withTimeout(fallback.parser(), this.config.timeoutMs);
          } catch (fallbackError) {
            this.log('debug', `Fallback parser ${fallback.name} failed: ${fallbackError}`);
          }
        }
      }

      // All parsers failed
      const error = new ParserError(filePath, parserType, primaryError as Error);
      this.logError(error);
      throw error;
    }
  }

  /**
   * Handle template errors with fallback templates
   */
  public async handleTemplateError<T>(
    templateName: string,
    primaryTemplate: () => Promise<T>,
    fallbackTemplate?: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryTemplate();
    } catch (primaryError) {
      this.log('debug', `Template ${templateName} failed: ${primaryError}`);

      if (fallbackTemplate && this.config.enableFallbacks) {
        try {
          this.log('info', `Using fallback template for ${templateName}`);
          return await fallbackTemplate();
        } catch (fallbackError) {
          this.log('warn', `Fallback template also failed: ${fallbackError}`);
        }
      }

      const error = new TemplateError(templateName, primaryError as Error);
      this.logError(error);
      throw error;
    }
  }

  /**
   * Create partial analysis result when complete analysis fails
   */
  public createPartialResult(
    partialData: Partial<AnalysisResult>,
    errors: ErrorCollection,
    fallbacksUsed: string[] = []
  ): PartialAnalysisResult {
    const defaultResult: AnalysisResult = {
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    };

    const result: AnalysisResult = {
      ...defaultResult,
      ...partialData
    };

    // Calculate completeness based on what data we have
    const expectedFields = Object.keys(defaultResult);
    const populatedFields = expectedFields.filter(field => {
      const value = (result as any)[field];
      return Array.isArray(value) ? value.length > 0 : value !== null;
    });

    const completeness = populatedFields.length / expectedFields.length;

    return {
      result,
      errors,
      completeness,
      fallbacksUsed
    };
  }

  /**
   * Batch process files with error collection and partial results
   */
  public async batchProcess<T>(
    items: string[],
    processor: (item: string) => Promise<T>,
    options: {
      continueOnError?: boolean;
      maxConcurrent?: number;
      collectPartialResults?: boolean;
    } = {}
  ): Promise<{
    results: T[];
    errors: ErrorCollection;
    processed: number;
    skipped: number;
  }> {
    const {
      continueOnError = true,
      maxConcurrent = 5
    } = options;

    const results: T[] = [];
    const errors = new ErrorCollection();
    let processed = 0;
    let skipped = 0;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < items.length; i += maxConcurrent) {
      const batch = items.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await processor(item);
          results.push(result);
          processed++;
          return result;
        } catch (error) {
          if (error instanceof DocumentationError) {
            errors.add(error);
          } else {
            errors.add(new DocumentationError(
              `Unexpected error processing ${item}: ${error}`,
              `Failed to process "${item}". This item will be skipped.`,
              ErrorSeverity.MEDIUM,
              ErrorCategory.VALIDATION,
              { operation: 'batch_process', additionalInfo: { item } }
            ));
          }

          if (continueOnError) {
            skipped++;
            return null;
          } else {
            throw error;
          }
        }
      });

      await Promise.all(batchPromises);

      // Check memory usage and pause if needed
      if (this.isMemoryConstrained()) {
        this.log('warn', 'Memory usage high, pausing batch processing');
        await this.delay(1000);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }

    return { results, errors, processed, skipped };
  }

  /**
   * Check if system is under resource constraints
   */
  public isMemoryConstrained(): boolean {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    return memUsageMB > this.config.maxMemoryMB;
  }

  /**
   * Get resource usage statistics
   */
  public getResourceStats(): {
    memoryUsageMB: number;
    memoryLimitMB: number;
    isConstrained: boolean;
  } {
    const memUsage = process.memoryUsage();
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    return {
      memoryUsageMB,
      memoryLimitMB: this.config.maxMemoryMB,
      isConstrained: memoryUsageMB > this.config.maxMemoryMB
    };
  }

  /**
   * Register a fallback strategy
   */
  public registerFallback(key: string, strategy: () => Promise<any>): void {
    this.fallbackStrategies.set(key, strategy);
  }

  /**
   * Execute a fallback strategy
   */
  public async executeFallback(key: string): Promise<any> {
    const strategy = this.fallbackStrategies.get(key);
    if (!strategy) {
      throw new Error(`No fallback strategy registered for key: ${key}`);
    }
    return await strategy();
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: DocumentationError[];
  } {
    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(cat => byCategory[cat] = 0);
    Object.values(ErrorSeverity).forEach(sev => bySeverity[sev] = 0);

    // Count errors
    this.errorLog.forEach(error => {
      byCategory[error.category]++;
      bySeverity[error.severity]++;
    });

    // Get recent errors (last 10)
    const recent = this.errorLog.slice(-10);

    return {
      total: this.errorLog.length,
      byCategory,
      bySeverity,
      recent
    };
  }

  /**
   * Clear error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Private helper methods
   */

  private setupFallbackStrategies(): void {
    // Register default fallback strategies
    this.registerFallback('empty_analysis', async () => ({
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    }));

    this.registerFallback('basic_template', async () => 
      '# Documentation\n\nDocumentation generation failed. Please check the error logs for details.'
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logError(error: DocumentationError): void {
    this.errorLog.push(error);
    this.log(this.getSeverityLogLevel(error.severity), error.getUserFriendlyMessage());
  }

  private getSeverityLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW: return 'info';
      case ErrorSeverity.MEDIUM: return 'warn';
      case ErrorSeverity.HIGH: return 'error';
      case ErrorSeverity.CRITICAL: return 'error';
      default: return 'warn';
    }
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = logLevels[this.config.logLevel];
    const messageLevel = logLevels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
}
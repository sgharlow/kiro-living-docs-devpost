import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ErrorHandler } from '../../src/errors/error-handler';
import { 
  DocumentationError, 
  ErrorSeverity, 
  ErrorCategory, 
  FileAccessError,
  ParserError,
  TemplateError,
  ResourceConstraintError
} from '../../src/errors/error-types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let tempDir: string;

  beforeEach(async () => {
    errorHandler = new ErrorHandler({
      maxRetries: 2,
      retryDelay: 100,
      enableFallbacks: true,
      logLevel: 'error',
      timeoutMs: 1000
    });

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'error-handler-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Access Error Handling', () => {
    it('should retry file operations on failure', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.handleFileAccess('test.txt', operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use fallback when all retries fail', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await errorHandler.handleFileAccess('test.txt', operation, fallback);
      
      expect(result).toBe('fallback result');
      expect(operation).toHaveBeenCalledTimes(2); // maxRetries
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should throw FileAccessError when no fallback available', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(errorHandler.handleFileAccess('nonexistent.txt', operation))
        .rejects.toThrow(FileAccessError);
    });

    it('should handle timeout errors', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer than timeout
        return 'success';
      });

      await expect(errorHandler.handleFileAccess('test.txt', operation))
        .rejects.toThrow('Operation timed out');
    });
  });

  describe('Parser Error Handling', () => {
    it('should try fallback parsers when primary fails', async () => {
      const primaryParser = jest.fn().mockRejectedValue(new Error('Parse error'));
      const fallbackParser1 = jest.fn().mockRejectedValue(new Error('Fallback 1 failed'));
      const fallbackParser2 = jest.fn().mockResolvedValue({ parsed: true });

      const fallbacks = [
        { name: 'fallback1', parser: fallbackParser1 },
        { name: 'fallback2', parser: fallbackParser2 }
      ];

      const result = await errorHandler.handleParserError(
        'test.js',
        'JavaScript',
        primaryParser,
        fallbacks
      );

      expect(result).toEqual({ parsed: true });
      expect(primaryParser).toHaveBeenCalledTimes(1);
      expect(fallbackParser1).toHaveBeenCalledTimes(1);
      expect(fallbackParser2).toHaveBeenCalledTimes(1);
    });

    it('should throw ParserError when all parsers fail', async () => {
      const primaryParser = jest.fn().mockRejectedValue(new Error('Parse error'));
      const fallbackParser = jest.fn().mockRejectedValue(new Error('Fallback failed'));

      const fallbacks = [{ name: 'fallback', parser: fallbackParser }];

      await expect(errorHandler.handleParserError(
        'test.js',
        'JavaScript',
        primaryParser,
        fallbacks
      )).rejects.toThrow(ParserError);
    });
  });

  describe('Template Error Handling', () => {
    it('should use fallback template when primary fails', async () => {
      const primaryTemplate = jest.fn().mockRejectedValue(new Error('Template error'));
      const fallbackTemplate = jest.fn().mockResolvedValue('fallback content');

      const result = await errorHandler.handleTemplateError(
        'main.template',
        primaryTemplate,
        fallbackTemplate
      );

      expect(result).toBe('fallback content');
      expect(primaryTemplate).toHaveBeenCalledTimes(1);
      expect(fallbackTemplate).toHaveBeenCalledTimes(1);
    });

    it('should throw TemplateError when no fallback available', async () => {
      const primaryTemplate = jest.fn().mockRejectedValue(new Error('Template error'));

      await expect(errorHandler.handleTemplateError('main.template', primaryTemplate))
        .rejects.toThrow(TemplateError);
    });
  });

  describe('Batch Processing', () => {
    it('should process items in batches with error collection', async () => {
      const items = ['item1', 'item2', 'item3', 'item4'];
      const processor = jest.fn()
        .mockResolvedValueOnce('result1')
        .mockRejectedValueOnce(new Error('item2 failed'))
        .mockResolvedValueOnce('result3')
        .mockResolvedValueOnce('result4');

      const result = await errorHandler.batchProcess(items, processor, {
        continueOnError: true,
        maxConcurrent: 2
      });

      expect(result.results).toEqual(['result1', 'result3', 'result4']);
      expect(result.processed).toBe(3);
      expect(result.skipped).toBe(1);
      expect(result.errors.getErrors()).toHaveLength(1);
    });

    it('should stop on first error when continueOnError is false', async () => {
      const items = ['item1', 'item2', 'item3'];
      const processor = jest.fn()
        .mockResolvedValueOnce('result1')
        .mockRejectedValueOnce(new Error('item2 failed'));

      await expect(errorHandler.batchProcess(items, processor, {
        continueOnError: false
      })).rejects.toThrow('item2 failed');

      expect(processor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Monitoring', () => {
    it('should detect memory constraints', () => {
      // Mock memory usage to exceed limit
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 200 * 1024 * 1024, // 200MB
        heapTotal: 300 * 1024 * 1024,
        external: 0,
        rss: 0,
        arrayBuffers: 0
      });

      const handler = new ErrorHandler({ maxMemoryMB: 100 });
      expect(handler.isMemoryConstrained()).toBe(true);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should provide resource statistics', () => {
      const stats = errorHandler.getResourceStats();
      
      expect(stats).toHaveProperty('memoryUsageMB');
      expect(stats).toHaveProperty('memoryLimitMB');
      expect(stats).toHaveProperty('isConstrained');
      expect(typeof stats.memoryUsageMB).toBe('number');
      expect(typeof stats.isConstrained).toBe('boolean');
    });
  });

  describe('Partial Results', () => {
    it('should create partial analysis results', () => {
      const partialData = {
        functions: [{ name: 'test', parameters: [], isAsync: false, isExported: true, startLine: 1, endLine: 2 }],
        classes: []
      };
      const errors = errorHandler['errorLog'] || [];
      const fallbacksUsed = ['regex_parser'];

      const result = errorHandler.createPartialResult(partialData, { getErrors: () => errors } as any, fallbacksUsed);

      expect(result.result.functions).toHaveLength(1);
      expect(result.result.classes).toHaveLength(0);
      expect(result.fallbacksUsed).toEqual(['regex_parser']);
      expect(result.completeness).toBeGreaterThan(0);
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics', () => {
      // Add some test errors
      const error1 = new DocumentationError(
        'Test error 1',
        'User message 1',
        ErrorSeverity.LOW,
        ErrorCategory.PARSER
      );
      const error2 = new DocumentationError(
        'Test error 2',
        'User message 2',
        ErrorSeverity.HIGH,
        ErrorCategory.FILE_ACCESS
      );

      errorHandler['logError'](error1);
      errorHandler['logError'](error2);

      const stats = errorHandler.getErrorStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byCategory[ErrorCategory.PARSER]).toBe(1);
      expect(stats.byCategory[ErrorCategory.FILE_ACCESS]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1);
      expect(stats.recent).toHaveLength(2);
    });

    it('should clear error log', () => {
      const error = new DocumentationError(
        'Test error',
        'User message',
        ErrorSeverity.LOW,
        ErrorCategory.PARSER
      );

      errorHandler['logError'](error);
      expect(errorHandler.getErrorStats().total).toBe(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorStats().total).toBe(0);
    });
  });

  describe('Fallback Strategies', () => {
    it('should register and execute fallback strategies', async () => {
      const mockStrategy = jest.fn().mockResolvedValue('fallback result');
      
      errorHandler.registerFallback('test_strategy', mockStrategy);
      const result = await errorHandler.executeFallback('test_strategy');
      
      expect(result).toBe('fallback result');
      expect(mockStrategy).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered fallback', async () => {
      await expect(errorHandler.executeFallback('nonexistent_strategy'))
        .rejects.toThrow('No fallback strategy registered for key: nonexistent_strategy');
    });
  });

  describe('Error Recovery Actions', () => {
    it('should provide recovery actions for file access errors', () => {
      const error = new FileAccessError('test.txt', new Error('Permission denied'));
      
      expect(error.recoveryActions).toHaveLength(2);
      expect(error.recoveryActions[0].type).toBe('retry');
      expect(error.recoveryActions[1].type).toBe('skip');
    });

    it('should provide user-friendly error messages', () => {
      const error = new ParserError('test.js', 'JavaScript', new Error('Syntax error'));
      const message = error.getUserFriendlyMessage();
      
      expect(message).toContain('test.js');
      expect(message).toContain('JavaScript');
      expect(message).toContain('Suggested actions:');
    });
  });

  describe('Error Severity and Blocking', () => {
    it('should identify blocking errors', () => {
      const criticalError = new DocumentationError(
        'Critical error',
        'User message',
        ErrorSeverity.CRITICAL,
        ErrorCategory.PARSER
      );
      const lowError = new DocumentationError(
        'Low error',
        'User message',
        ErrorSeverity.LOW,
        ErrorCategory.PARSER
      );

      expect(criticalError.isBlocking()).toBe(true);
      expect(lowError.isBlocking()).toBe(false);
    });

    it('should determine if partial results are allowed', () => {
      const criticalError = new DocumentationError(
        'Critical error',
        'User message',
        ErrorSeverity.CRITICAL,
        ErrorCategory.PARSER
      );
      const mediumError = new DocumentationError(
        'Medium error',
        'User message',
        ErrorSeverity.MEDIUM,
        ErrorCategory.PARSER
      );

      expect(criticalError.allowsPartialResults()).toBe(false);
      expect(mediumError.allowsPartialResults()).toBe(true);
    });
  });
});
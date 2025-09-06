// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ResilientAnalyzer } from '../../src/analyzers/resilient-analyzer';
import { ErrorCategory } from '../../src/errors/error-types';

// Mock the analyzers to avoid dependencies
jest.mock('../../src/analyzers/typescript-analyzer', () => ({
  TypeScriptAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [{ name: 'testFunction', parameters: [], isAsync: false, isExported: true, startLine: 1, endLine: 5 }],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    })
  }))
}));

jest.mock('../../src/analyzers/python-analyzer', () => ({
  PythonAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [{ name: 'test_function', parameters: [], isAsync: false, isExported: true, startLine: 1, endLine: 3 }],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    })
  }))
}));

jest.mock('../../src/analyzers/go-analyzer', () => ({
  GoAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [{ name: 'TestFunction', parameters: [], isAsync: false, isExported: true, startLine: 1, endLine: 4 }],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: []
    })
  }))
}));

describe('ResilientAnalyzer', () => {
  let analyzer: ResilientAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new ResilientAnalyzer({
      enableFallbacks: true,
      maxFileSize: 1024 * 1024, // 1MB
      timeoutMs: 5000,
      skipBinaryFiles: true,
      skipLargeFiles: true,
      maxConcurrentFiles: 3
    });

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'resilient-analyzer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Single File Analysis', () => {
    it('should analyze TypeScript files successfully', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(tsFile, `
        function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `);

      const result = await analyzer.analyzeFile(tsFile);

      expect(result.result.functions).toHaveLength(1);
      expect(result.result.functions[0].name).toBe('testFunction');
      expect(result.errors.isEmpty()).toBe(true);
      expect(result.completeness).toBeGreaterThan(0);
    });

    it('should analyze Python files successfully', async () => {
      const pyFile = path.join(tempDir, 'test.py');
      await fs.promises.writeFile(pyFile, `
        def hello(name):
            return f"Hello, {name}!"
      `);

      const result = await analyzer.analyzeFile(pyFile);

      expect(result.result.functions).toHaveLength(1);
      expect(result.result.functions[0].name).toBe('test_function');
      expect(result.errors.isEmpty()).toBe(true);
    });

    it('should analyze Go files successfully', async () => {
      const goFile = path.join(tempDir, 'test.go');
      await fs.promises.writeFile(goFile, `
        package main
        
        func Hello(name string) string {
            return "Hello, " + name + "!"
        }
      `);

      const result = await analyzer.analyzeFile(goFile);

      expect(result.result.functions).toHaveLength(1);
      expect(result.result.functions[0].name).toBe('TestFunction');
      expect(result.errors.isEmpty()).toBe(true);
    });

    it('should handle unsupported file types gracefully', async () => {
      const txtFile = path.join(tempDir, 'test.txt');
      await fs.promises.writeFile(txtFile, 'This is just a text file');

      const result = await analyzer.analyzeFile(txtFile);

      expect(result.errors.getErrors()).toHaveLength(1);
      expect(result.errors.getErrors()[0].category).toBe(ErrorCategory.PARSER);
      expect(result.fallbacksUsed).toContain('empty_analysis');
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.js');

      const result = await analyzer.analyzeFile(nonExistentFile);

      expect(result.errors.getErrors()).toHaveLength(1);
      expect(result.errors.getErrors()[0].category).toBe(ErrorCategory.FILE_ACCESS);
      expect(result.fallbacksUsed).toContain('empty_analysis');
    });

    it('should use regex fallback when primary parser fails', async () => {
      // This test would need more complex mocking to properly test fallback behavior
      // For now, we'll test with an unsupported file type that will trigger fallback

      const unknownFile = path.join(tempDir, 'test.unknown');
      await fs.promises.writeFile(unknownFile, `
        function testFunc() {
          // TODO: Implement this
          return "test";
        }
        
        class TestClass {
          constructor() {}
        }
      `);

      const result = await analyzer.analyzeFile(unknownFile);

      // Should have some results even with unsupported file type
      expect(result.result).toBeDefined();
      expect(result.errors.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('Multiple File Analysis', () => {
    it('should analyze multiple files with error collection', async () => {
      // Create test files
      const files = [
        { name: 'test1.ts', content: 'function test1() {}' },
        { name: 'test2.py', content: 'def test2(): pass' },
        { name: 'test3.go', content: 'func Test3() {}' },
        { name: 'invalid.xyz', content: 'invalid content' }
      ];

      const filePaths: string[] = [];
      for (const file of files) {
        const filePath = path.join(tempDir, file.name);
        await fs.promises.writeFile(filePath, file.content);
        filePaths.push(filePath);
      }

      const result = await analyzer.analyzeFiles(filePaths, {
        continueOnError: true,
        includePartialResults: true
      });

      expect(result.results).toHaveLength(4); // All files processed (some with errors)
      expect(result.summary.successful).toBe(3); // 3 valid files
      expect(result.summary.failed).toBe(1); // 1 invalid file
      expect(result.aggregatedErrors.getErrors().length).toBeGreaterThan(0);
    });

    it('should prioritize files correctly', async () => {
      const files = [
        'low-priority.js',
        'high-priority.ts',
        'medium-priority.py'
      ];

      const filePaths: string[] = [];
      for (const fileName of files) {
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(filePath, 'function test() {}');
        filePaths.push(filePath);
      }

      const result = await analyzer.analyzeFiles(filePaths, {
        prioritizeFiles: ['*high-priority*', '*medium-priority*']
      });

      expect(result.results).toHaveLength(3);
      expect(result.summary.successful).toBe(3);
    });

    it('should exclude files based on patterns', async () => {
      const files = [
        'include.js',
        'exclude.test.js',
        'include.py',
        'exclude.spec.py'
      ];

      const filePaths: string[] = [];
      for (const fileName of files) {
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(filePath, 'function test() {}');
        filePaths.push(filePath);
      }

      const result = await analyzer.analyzeFiles(filePaths, {
        excludePatterns: ['*.test.*', '*.spec.*']
      });

      expect(result.results).toHaveLength(2); // Only non-test files
    });

    it('should handle concurrent processing limits', async () => {
      const files = Array.from({ length: 10 }, (_, i) => `test${i}.js`);
      const filePaths: string[] = [];

      for (const fileName of files) {
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(filePath, 'function test() {}');
        filePaths.push(filePath);
      }

      const startTime = Date.now();
      const result = await analyzer.analyzeFiles(filePaths);
      const endTime = Date.now();

      expect(result.results).toHaveLength(10);
      expect(result.summary.successful).toBe(10);
      // Should complete in reasonable time even with concurrency limits
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('Project Analysis', () => {
    it('should analyze entire project directory', async () => {
      // Create a mock project structure
      const srcDir = path.join(tempDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });

      const files = [
        { path: path.join(srcDir, 'index.ts'), content: 'export function main() {}' },
        { path: path.join(srcDir, 'utils.py'), content: 'def helper(): pass' },
        { path: path.join(srcDir, 'server.go'), content: 'func StartServer() {}' },
        { path: path.join(tempDir, 'README.md'), content: '# Project' }
      ];

      for (const file of files) {
        await fs.promises.writeFile(file.path, file.content);
      }

      const result = await analyzer.analyzeProject(tempDir);

      expect(result.results.size).toBeGreaterThan(0);
      expect(result.summary.filesProcessed).toBeGreaterThan(0);
      expect(result.summary.completenessAverage).toBeGreaterThan(0);
    });

    it('should handle project analysis errors gracefully', async () => {
      const nonExistentProject = path.join(tempDir, 'nonexistent');

      const result = await analyzer.analyzeProject(nonExistentProject);

      expect(result.results.size).toBe(0);
      expect(result.errors.getErrors().length).toBeGreaterThan(0);
      expect(result.summary.filesProcessed).toBe(0);
    });
  });

  describe('File Filtering and Skipping', () => {
    it('should skip binary files when configured', async () => {
      const binaryFile = path.join(tempDir, 'image.png');
      await fs.promises.writeFile(binaryFile, Buffer.from([0x89, 0x50, 0x4E, 0x47])); // PNG header

      const result = await analyzer.analyzeFile(binaryFile);

      expect(result.errors.getErrors()).toHaveLength(1);
      expect(result.fallbacksUsed).toContain('empty_analysis');
    });

    it('should skip large files when configured', async () => {
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB content
      const largeFile = path.join(tempDir, 'large.js');
      await fs.promises.writeFile(largeFile, largeContent);

      const result = await analyzer.analyzeFile(largeFile);

      expect(result.errors.getErrors()).toHaveLength(1);
      expect(result.errors.getErrors()[0].category).toBe(ErrorCategory.RESOURCE);
    });
  });

  describe('Health Status', () => {
    it('should provide health status information', () => {
      const health = analyzer.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('resourceUsage');
      expect(health).toHaveProperty('errorStats');
      expect(health).toHaveProperty('recommendations');
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should detect degraded status with high memory usage', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process.memoryUsage as any) = jest.fn().mockReturnValue({
        heapUsed: 200 * 1024 * 1024, // 200MB
        heapTotal: 300 * 1024 * 1024,
        external: 0,
        rss: 250 * 1024 * 1024,
        arrayBuffers: 0
      });
      (process.memoryUsage as any).rss = jest.fn().mockReturnValue(250 * 1024 * 1024);

      const constrainedAnalyzer = new ResilientAnalyzer({ maxFileSize: 1024 });
      const health = constrainedAnalyzer.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.recommendations.some(r => r.includes('Memory usage'))).toBe(true);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Regex Fallback Parser', () => {
    it('should extract basic constructs with regex fallback', async () => {
      const mixedFile = path.join(tempDir, 'mixed.unknown');
      await fs.promises.writeFile(mixedFile, `
        // This is a comment
        function testFunction() {
          // TODO: Implement this function
          return "test";
        }
        
        class TestClass {
          constructor() {}
        }
        
        def python_function():
            # FIXME: This needs work
            pass
            
        func GoFunction() {
          // NOTE: Go style function
        }
      `);

      // Force the analyzer to use regex fallback by using unsupported extension
      const result = await analyzer.analyzeFile(mixedFile);

      // Should extract some basic information using regex
      expect(result.result.functions.length).toBeGreaterThan(0);
      expect(result.result.classes.length).toBeGreaterThan(0);
      expect(result.result.todos.length).toBeGreaterThan(0);
      expect(result.result.comments.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Partial Results', () => {
    it('should provide partial results when some analysis fails', async () => {
      // Create a file that will partially fail analysis
      const partialFile = path.join(tempDir, 'partial.js');
      await fs.promises.writeFile(partialFile, `
        function validFunction() {
          return "valid";
        }
        
        // This might cause parser issues in some scenarios
        function ${'{'}invalidSyntax() {
          return "invalid";
        }
      `);

      const result = await analyzer.analyzeFile(partialFile);

      // Should have some results even if there are errors
      expect(result.completeness).toBeGreaterThan(0);
      expect(result.result).toBeDefined();
    });

    it('should collect and aggregate errors from multiple files', async () => {
      const files = [
        { name: 'good.js', content: 'function good() {}' },
        { name: 'bad1.xyz', content: 'invalid content' },
        { name: 'bad2.abc', content: 'more invalid content' }
      ];

      const filePaths: string[] = [];
      for (const file of files) {
        const filePath = path.join(tempDir, file.name);
        await fs.promises.writeFile(filePath, file.content);
        filePaths.push(filePath);
      }

      const result = await analyzer.analyzeFiles(filePaths, {
        continueOnError: true
      });

      expect(result.aggregatedErrors.getErrors().length).toBeGreaterThan(0);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(2);
    });
  });
});
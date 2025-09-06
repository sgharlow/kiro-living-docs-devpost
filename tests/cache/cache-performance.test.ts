import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createCacheSystem } from '../../dist/cache/index.js';
import { AnalysisResult } from '../../dist/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Cache Performance Tests', () => {
  let cacheSystem: ReturnType<typeof createCacheSystem>;
  let tempDir: string;

  beforeEach(async () => {
    cacheSystem = createCacheSystem({
      analysis: {
        maxSize: 50, // 50MB
        maxEntries: 1000,
        ttl: 60000, // 1 minute
      },
      template: {
        maxSize: 10, // 10MB
        maxEntries: 100,
      },
      monitor: {
        enableRealTimeMonitoring: false, // Disable for testing
      },
    });

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cache-perf-test-'));
  });

  afterEach(async () => {
    cacheSystem.clearAll();
    cacheSystem.stopMonitoring();
    
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createMockAnalysis = (complexity: number = 1): AnalysisResult => ({
    functions: Array.from({ length: complexity * 10 }, (_, i) => ({
      name: `function${i}`,
      parameters: Array.from({ length: i % 5 }, (_, j) => ({
        name: `param${j}`,
        type: 'string',
        optional: false,
      })),
      isAsync: i % 2 === 0,
      isExported: i % 3 === 0,
      startLine: i * 10,
      endLine: i * 10 + 5,
      description: `Function ${i} description with some details`,
    })),
    classes: Array.from({ length: complexity * 5 }, (_, i) => ({
      name: `Class${i}`,
      methods: [],
      properties: [],
      isExported: true,
      startLine: i * 20,
      endLine: i * 20 + 15,
    })),
    interfaces: [],
    exports: [],
    imports: [],
    comments: [],
    todos: [],
    apiEndpoints: [],
  });

  describe('Analysis Cache Performance', () => {
    it('should handle large numbers of files efficiently', async () => {
      const fileCount = 100;
      const files: string[] = [];
      
      // Create test files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.ts`);
        await fs.promises.writeFile(filePath, `// File ${i}\nconsole.log("test${i}");`);
        files.push(filePath);
      }

      const startTime = Date.now();
      
      // Cache analyses for all files
      for (const filePath of files) {
        const analysis = createMockAnalysis(2);
        await cacheSystem.analysisCache.setAnalysis(filePath, analysis);
      }
      
      const cacheTime = Date.now() - startTime;
      
      // Retrieve all analyses
      const retrieveStartTime = Date.now();
      for (const filePath of files) {
        const analysis = await cacheSystem.analysisCache.getAnalysis(filePath);
        expect(analysis).toBeDefined();
      }
      const retrieveTime = Date.now() - retrieveStartTime;
      
      console.log(`Cached ${fileCount} files in ${cacheTime}ms`);
      console.log(`Retrieved ${fileCount} files in ${retrieveTime}ms`);
      
      // Retrieval should be significantly faster than initial caching
      expect(retrieveTime).toBeLessThan(cacheTime);
      
      // Should complete within reasonable time
      expect(cacheTime).toBeLessThan(5000); // 5 seconds
      expect(retrieveTime).toBeLessThan(1000); // 1 second
    });

    it('should maintain good hit rates under normal usage', async () => {
      const fileCount = 50;
      const files: string[] = [];
      
      // Create and cache files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.ts`);
        await fs.promises.writeFile(filePath, `console.log("test${i}");`);
        files.push(filePath);
        
        const analysis = createMockAnalysis(1);
        await cacheSystem.analysisCache.setAnalysis(filePath, analysis);
      }
      
      // Simulate normal usage pattern (80% hits, 20% misses)
      const operations = 200;
      for (let i = 0; i < operations; i++) {
        if (Math.random() < 0.8) {
          // Hit - access existing file
          const randomFile = files[Math.floor(Math.random() * files.length)];
          await cacheSystem.analysisCache.getAnalysis(randomFile);
        } else {
          // Miss - access non-existent file
          await cacheSystem.analysisCache.getAnalysis(`nonexistent${i}.ts`);
        }
      }
      
      const stats = cacheSystem.analysisCache.getStats();
      expect(stats.fileCache.hitRate).toBeGreaterThan(0.7); // At least 70% hit rate
    });

    it('should handle memory pressure gracefully', async () => {
      // Create many large analyses to test memory management
      const largeAnalysisCount = 20;
      
      for (let i = 0; i < largeAnalysisCount; i++) {
        const filePath = path.join(tempDir, `large${i}.ts`);
        await fs.promises.writeFile(filePath, `// Large file ${i}`);
        
        // Create large analysis with many functions
        const largeAnalysis = createMockAnalysis(50); // 500 functions, 250 classes
        await cacheSystem.analysisCache.setAnalysis(filePath, largeAnalysis);
      }
      
      const stats = cacheSystem.analysisCache.getStats();
      
      // Should have evicted some entries due to memory pressure
      expect(stats.fileCache.evictionCount).toBeGreaterThan(0);
      
      // Memory usage should be within reasonable bounds
      expect(stats.fileCache.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Template Cache Performance', () => {
    it('should compile and cache templates efficiently', async () => {
      const templateCount = 20;
      const templates: string[] = [];
      
      // Create test templates
      for (let i = 0; i < templateCount; i++) {
        const templatePath = path.join(tempDir, `template${i}.hbs`);
        const templateContent = `
          <h1>{{title}}</h1>
          <p>{{description}}</p>
          {{#each items}}
            <div>{{this.name}}: {{this.value}}</div>
          {{/each}}
          {{#if showFooter}}
            <footer>Template ${i}</footer>
          {{/if}}
        `;
        await fs.promises.writeFile(templatePath, templateContent);
        templates.push(templatePath);
      }

      const compileStartTime = Date.now();
      
      // Compile all templates
      for (const templatePath of templates) {
        const template = await cacheSystem.templateCache.getTemplate(templatePath);
        expect(template).toBeDefined();
      }
      
      const compileTime = Date.now() - compileStartTime;
      
      // Render templates (should use cached versions)
      const renderStartTime = Date.now();
      const testData = {
        title: 'Test Title',
        description: 'Test Description',
        items: [
          { name: 'Item 1', value: 'Value 1' },
          { name: 'Item 2', value: 'Value 2' },
        ],
        showFooter: true,
      };
      
      for (const templatePath of templates) {
        const result = await cacheSystem.templateCache.render(templatePath, testData);
        expect(result).toBeDefined();
        expect(result).toContain('Test Title');
      }
      
      const renderTime = Date.now() - renderStartTime;
      
      console.log(`Compiled ${templateCount} templates in ${compileTime}ms`);
      console.log(`Rendered ${templateCount} templates in ${renderTime}ms`);
      
      // Rendering should be faster than compilation
      expect(renderTime).toBeLessThan(compileTime);
      
      // Should complete within reasonable time
      expect(compileTime).toBeLessThan(2000); // 2 seconds
      expect(renderTime).toBeLessThan(500); // 0.5 seconds
    });
  });

  describe('Incremental Update Performance', () => {
    it('should process file changes efficiently', async () => {
      const fileCount = 30;
      const files: string[] = [];
      
      // Create initial files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.ts`);
        await fs.promises.writeFile(filePath, `console.log("initial${i}");`);
        files.push(filePath);
        
        const analysis = createMockAnalysis(1);
        await cacheSystem.analysisCache.setAnalysis(filePath, analysis);
      }
      
      // Simulate rapid file changes
      const changes = files.slice(0, 10).map(filePath => ({
        path: filePath,
        type: 'modified' as const,
        timestamp: Date.now(),
      }));
      
      const updateStartTime = Date.now();
      const operation = await cacheSystem.incrementalUpdater.processChanges(changes);
      const updateTime = Date.now() - updateStartTime;
      
      console.log(`Processed ${changes.length} changes in ${updateTime}ms`);
      
      expect(operation.success).toBe(true);
      expect(updateTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch rapid changes effectively', async () => {
      const batchSize = 20;
      const changes = Array.from({ length: batchSize }, (_, i) => ({
        path: path.join(tempDir, `batch${i}.ts`),
        type: 'modified' as const,
        timestamp: Date.now(),
      }));
      
      // Process changes rapidly
      const operations = await Promise.all(
        changes.map(change => cacheSystem.incrementalUpdater.processChanges([change]))
      );
      
      // Should have batched some operations
      const stats = cacheSystem.incrementalUpdater.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });
  });

  describe('Overall System Performance', () => {
    it('should maintain good performance under mixed workload', async () => {
      const workloadSize = 50;
      const startTime = Date.now();
      
      // Mixed workload: analysis caching, template rendering, updates
      const promises: Promise<any>[] = [];
      
      // Analysis operations
      for (let i = 0; i < workloadSize; i++) {
        const filePath = path.join(tempDir, `mixed${i}.ts`);
        promises.push(
          fs.promises.writeFile(filePath, `console.log("mixed${i}");`)
            .then(() => cacheSystem.analysisCache.setAnalysis(filePath, createMockAnalysis(1)))
        );
      }
      
      // Template operations
      for (let i = 0; i < workloadSize / 2; i++) {
        const templatePath = path.join(tempDir, `mixed${i}.hbs`);
        promises.push(
          fs.promises.writeFile(templatePath, '<h1>{{title}}</h1>')
            .then(() => cacheSystem.templateCache.render(templatePath, { title: `Title ${i}` }))
        );
      }
      
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      console.log(`Mixed workload completed in ${totalTime}ms`);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds
      
      // Check system health
      const healthReport = cacheSystem.getHealthReport();
      expect(healthReport.overall).not.toBe('critical');
    });

    it('should provide accurate performance metrics', async () => {
      // Generate some activity
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(tempDir, `metrics${i}.ts`);
        await fs.promises.writeFile(filePath, `console.log("metrics${i}");`);
        await cacheSystem.analysisCache.setAnalysis(filePath, createMockAnalysis(1));
        await cacheSystem.analysisCache.getAnalysis(filePath);
      }
      
      const stats = cacheSystem.getStats();
      
      expect(stats.analysis.files).toBeGreaterThan(0);
      expect(stats.analysis.hitRate).toBeGreaterThan(0);
      expect(stats.updates.totalOperations).toBeGreaterThanOrEqual(0);
      
      // Memory usage should be reasonable
      expect(stats.analysis.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('Scalability Tests', () => {
    it('should scale to large projects', async () => {
      const largeProjectSize = 200;
      const startTime = Date.now();
      
      // Simulate large project analysis
      const analysisPromises: Promise<void>[] = [];
      
      for (let i = 0; i < largeProjectSize; i++) {
        const filePath = path.join(tempDir, `large-project-${i}.ts`);
        
        analysisPromises.push(
          fs.promises.writeFile(filePath, `// Large project file ${i}\nexport const value${i} = ${i};`)
            .then(() => cacheSystem.analysisCache.setAnalysis(filePath, createMockAnalysis(2)))
        );
      }
      
      await Promise.all(analysisPromises);
      
      const analysisTime = Date.now() - startTime;
      console.log(`Analyzed large project (${largeProjectSize} files) in ${analysisTime}ms`);
      
      // Should complete within reasonable time for large projects
      expect(analysisTime).toBeLessThan(30000); // 30 seconds
      
      // Verify cache efficiency
      const stats = cacheSystem.getStats();
      expect(stats.analysis.files).toBe(largeProjectSize);
      
      // Test retrieval performance
      const retrievalStartTime = Date.now();
      for (let i = 0; i < 50; i++) { // Sample 50 files
        const filePath = path.join(tempDir, `large-project-${i}.ts`);
        const analysis = await cacheSystem.analysisCache.getAnalysis(filePath);
        expect(analysis).toBeDefined();
      }
      const retrievalTime = Date.now() - retrievalStartTime;
      
      console.log(`Retrieved 50 files from large project in ${retrievalTime}ms`);
      expect(retrievalTime).toBeLessThan(1000); // 1 second
    });
  });
});
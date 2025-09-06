#!/usr/bin/env node

const { createCacheSystem } = require('../dist/cache/index.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testCacheSystem() {
  console.log('🚀 Testing Cache System Performance...\n');

  // Create cache system with monitoring
  const cacheSystem = createCacheSystem({
    analysis: {
      maxSize: 100, // 100MB
      maxEntries: 1000,
      ttl: 60000, // 1 minute
      enableStats: true,
    },
    template: {
      maxSize: 20, // 20MB
      maxEntries: 200,
      enableStats: true,
    },
    update: {
      maxIncrementalFiles: 20,
      fullUpdateThreshold: 0.3,
      enableBatching: true,
      batchWindow: 500,
    },
    monitor: {
      enableRealTimeMonitoring: true,
      metricsInterval: 5000, // 5 seconds
      healthCheckInterval: 10000, // 10 seconds
    },
  });

  // Start monitoring
  cacheSystem.startMonitoring();

  try {
    // Create temporary directory for testing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
    console.log(`📁 Created test directory: ${tempDir}`);

    // Test 1: Analysis Cache Performance
    console.log('\n📊 Testing Analysis Cache Performance...');
    const analysisStartTime = Date.now();
    
    const fileCount = 50;
    const files = [];
    
    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(tempDir, `test-file-${i}.ts`);
      const content = `
        // Test file ${i}
        export class TestClass${i} {
          private value: number = ${i};
          
          public getValue(): number {
            return this.value;
          }
          
          public async processData(data: string[]): Promise<string> {
            return data.join('-') + '-${i}';
          }
        }
        
        export function testFunction${i}(param: string): string {
          return \`Function ${i}: \${param}\`;
        }
      `;
      
      await fs.promises.writeFile(filePath, content);
      files.push(filePath);
      
      // Mock analysis result
      const analysis = {
        functions: [
          {
            name: `testFunction${i}`,
            parameters: [{ name: 'param', type: 'string', optional: false }],
            returnType: 'string',
            isAsync: false,
            isExported: true,
            startLine: 15,
            endLine: 17,
          }
        ],
        classes: [
          {
            name: `TestClass${i}`,
            methods: [
              {
                name: 'getValue',
                parameters: [],
                returnType: 'number',
                isAsync: false,
                isExported: false,
                startLine: 5,
                endLine: 7,
              },
              {
                name: 'processData',
                parameters: [{ name: 'data', type: 'string[]', optional: false }],
                returnType: 'Promise<string>',
                isAsync: true,
                isExported: false,
                startLine: 9,
                endLine: 11,
              }
            ],
            properties: [
              {
                name: 'value',
                type: 'number',
                optional: false,
                readonly: false,
              }
            ],
            isExported: true,
            startLine: 2,
            endLine: 13,
          }
        ],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };
      
      await cacheSystem.analysisCache.setAnalysis(filePath, analysis);
    }
    
    const analysisTime = Date.now() - analysisStartTime;
    console.log(`✅ Cached ${fileCount} files in ${analysisTime}ms`);

    // Test cache retrieval performance
    const retrievalStartTime = Date.now();
    let hitCount = 0;
    
    for (const filePath of files) {
      const analysis = await cacheSystem.analysisCache.getAnalysis(filePath);
      if (analysis) hitCount++;
    }
    
    const retrievalTime = Date.now() - retrievalStartTime;
    console.log(`✅ Retrieved ${hitCount}/${fileCount} files in ${retrievalTime}ms`);

    // Test 2: Template Cache Performance
    console.log('\n🎨 Testing Template Cache Performance...');
    const templateStartTime = Date.now();
    
    const templateCount = 10;
    const templates = [];
    
    for (let i = 0; i < templateCount; i++) {
      const templatePath = path.join(tempDir, `template-${i}.hbs`);
      const templateContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>{{title}}</title>
        </head>
        <body>
          <h1>{{heading}}</h1>
          <div class="content">
            {{#each items}}
              <div class="item">
                <h3>{{this.name}}</h3>
                <p>{{this.description}}</p>
                {{#if this.active}}
                  <span class="badge">Active</span>
                {{/if}}
              </div>
            {{/each}}
          </div>
          <footer>Template ${i} - Generated at {{timestamp}}</footer>
        </body>
        </html>
      `;
      
      await fs.promises.writeFile(templatePath, templateContent);
      templates.push(templatePath);
      
      // Compile template
      await cacheSystem.templateCache.getTemplate(templatePath);
    }
    
    const templateCompileTime = Date.now() - templateStartTime;
    console.log(`✅ Compiled ${templateCount} templates in ${templateCompileTime}ms`);

    // Test template rendering
    const renderStartTime = Date.now();
    const testData = {
      title: 'Cache Test Page',
      heading: 'Testing Template Cache',
      items: [
        { name: 'Item 1', description: 'First test item', active: true },
        { name: 'Item 2', description: 'Second test item', active: false },
        { name: 'Item 3', description: 'Third test item', active: true },
      ],
      timestamp: new Date().toISOString(),
    };
    
    let renderCount = 0;
    for (const templatePath of templates) {
      const result = await cacheSystem.templateCache.render(templatePath, testData);
      if (result && result.includes('Cache Test Page')) {
        renderCount++;
      }
    }
    
    const renderTime = Date.now() - renderStartTime;
    console.log(`✅ Rendered ${renderCount}/${templateCount} templates in ${renderTime}ms`);

    // Test 3: Incremental Updates
    console.log('\n🔄 Testing Incremental Updates...');
    
    // Simulate file changes
    const changeCount = 15;
    const changes = [];
    
    for (let i = 0; i < changeCount; i++) {
      const filePath = files[i % files.length];
      changes.push({
        path: filePath,
        type: 'modified',
        timestamp: Date.now(),
      });
    }
    
    const updateStartTime = Date.now();
    const operation = await cacheSystem.incrementalUpdater.processChanges(changes);
    const updateTime = Date.now() - updateStartTime;
    
    console.log(`✅ Processed ${changeCount} changes in ${updateTime}ms`);
    console.log(`   Operation type: ${operation.type}`);
    console.log(`   Success: ${operation.success}`);

    // Test 4: Cache Statistics and Health
    console.log('\n📈 Cache Statistics and Health...');
    
    const stats = cacheSystem.getStats();
    console.log('Analysis Cache:');
    console.log(`  - Files cached: ${stats.analysis.files}`);
    console.log(`  - Hit rate: ${(stats.analysis.hitRate * 100).toFixed(1)}%`);
    console.log(`  - Memory usage: ${(stats.analysis.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    
    console.log('Template Cache:');
    console.log(`  - Templates cached: ${stats.templates.cached}`);
    console.log(`  - Hit rate: ${(stats.templates.hitRate * 100).toFixed(1)}%`);
    console.log(`  - Memory usage: ${(stats.templates.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    
    console.log('Update System:');
    console.log(`  - Total operations: ${stats.updates.totalOperations}`);
    console.log(`  - Success rate: ${(stats.updates.successRate * 100).toFixed(1)}%`);
    console.log(`  - Average duration: ${stats.updates.averageDuration.toFixed(0)}ms`);
    console.log(`  - Queue size: ${stats.updates.queueSize}`);

    // Get health report
    const healthReport = cacheSystem.getHealthReport();
    console.log(`\n🏥 System Health: ${healthReport.overall.toUpperCase()}`);
    
    if (healthReport.issues.length > 0) {
      console.log('Issues:');
      healthReport.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (healthReport.recommendations.length > 0) {
      console.log('Recommendations:');
      healthReport.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    // Test 5: Memory Pressure Simulation
    console.log('\n💾 Testing Memory Pressure Handling...');
    
    const largeDataCount = 20;
    for (let i = 0; i < largeDataCount; i++) {
      const filePath = path.join(tempDir, `large-file-${i}.ts`);
      
      // Create large analysis with many functions and classes
      const largeAnalysis = {
        functions: Array.from({ length: 100 }, (_, j) => ({
          name: `largeFunction${i}_${j}`,
          parameters: Array.from({ length: j % 10 }, (_, k) => ({
            name: `param${k}`,
            type: 'any',
            optional: false,
          })),
          isAsync: j % 2 === 0,
          isExported: j % 3 === 0,
          startLine: j * 5,
          endLine: j * 5 + 3,
        })),
        classes: Array.from({ length: 50 }, (_, j) => ({
          name: `LargeClass${i}_${j}`,
          methods: [],
          properties: [],
          isExported: true,
          startLine: j * 20,
          endLine: j * 20 + 15,
        })),
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };
      
      await fs.promises.writeFile(filePath, `// Large file ${i}`);
      await cacheSystem.analysisCache.setAnalysis(filePath, largeAnalysis);
    }
    
    const finalStats = cacheSystem.getStats();
    console.log(`✅ Handled memory pressure test`);
    console.log(`   Final memory usage: ${(finalStats.analysis.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Files still cached: ${finalStats.analysis.files}`);

    // Test 6: Cache Cleanup
    console.log('\n🧹 Testing Cache Cleanup...');
    
    const cleanupResult = cacheSystem.cleanup();
    console.log(`✅ Cleanup completed`);
    console.log(`   Analysis files cleaned: ${cleanupResult.analysis.filesCleanedUp}`);
    console.log(`   Analysis projects cleaned: ${cleanupResult.analysis.projectsCleanedUp}`);

    // Final performance summary
    console.log('\n📊 Performance Summary:');
    console.log(`   Analysis caching: ${(analysisTime / fileCount).toFixed(1)}ms per file`);
    console.log(`   Analysis retrieval: ${(retrievalTime / fileCount).toFixed(1)}ms per file`);
    console.log(`   Template compilation: ${(templateCompileTime / templateCount).toFixed(1)}ms per template`);
    console.log(`   Template rendering: ${(renderTime / templateCount).toFixed(1)}ms per template`);
    console.log(`   Incremental updates: ${(updateTime / changeCount).toFixed(1)}ms per change`);

    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    console.log(`\n🗑️  Cleaned up test directory`);

    console.log('\n🎉 Cache System Test Completed Successfully!');
    
    // Performance benchmarks
    const benchmarks = {
      analysisPerFile: analysisTime / fileCount,
      retrievalPerFile: retrievalTime / fileCount,
      templateCompilePerTemplate: templateCompileTime / templateCount,
      templateRenderPerTemplate: renderTime / templateCount,
      updatePerChange: updateTime / changeCount,
    };
    
    console.log('\n⚡ Performance Benchmarks:');
    Object.entries(benchmarks).forEach(([metric, value]) => {
      const status = value < 50 ? '🟢' : value < 100 ? '🟡' : '🔴';
      console.log(`   ${status} ${metric}: ${value.toFixed(1)}ms`);
    });

  } catch (error) {
    console.error('❌ Cache system test failed:', error);
    process.exit(1);
  } finally {
    cacheSystem.stopMonitoring();
  }
}

// Run the test
testCacheSystem();
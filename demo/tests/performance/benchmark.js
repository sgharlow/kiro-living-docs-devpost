/**
 * Performance benchmarking suite for Living Documentation Generator
 * 
 * Tests performance across different project sizes and complexity levels
 * to ensure the system scales appropriately for real-world usage.
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const { DocumentationGenerator } = require('../../../dist/generators/documentation-generator');

/**
 * Benchmark configuration and test scenarios
 */
const BENCHMARK_CONFIG = {
  // Project size categories for testing
  projectSizes: {
    small: { files: 10, functionsPerFile: 5, linesPerFunction: 20 },
    medium: { files: 100, functionsPerFile: 8, linesPerFunction: 30 },
    large: { files: 500, functionsPerFile: 12, linesPerFunction: 40 },
    xlarge: { files: 1000, functionsPerFile: 15, linesPerFunction: 50 }
  },
  
  // Languages to test
  languages: ['typescript', 'python', 'go'],
  
  // Performance thresholds (in milliseconds)
  thresholds: {
    small: { analysis: 1000, generation: 2000, total: 3000 },
    medium: { analysis: 5000, generation: 8000, total: 15000 },
    large: { analysis: 15000, generation: 20000, total: 40000 },
    xlarge: { analysis: 30000, generation: 40000, total: 80000 }
  },
  
  // Memory thresholds (in MB)
  memoryThresholds: {
    small: 50,
    medium: 150,
    large: 300,
    xlarge: 500
  }
};

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  console.log('🚀 Starting Living Documentation Generator Performance Benchmarks\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    system: await getSystemInfo(),
    benchmarks: {}
  };
  
  // Run benchmarks for each project size
  for (const [sizeName, sizeConfig] of Object.entries(BENCHMARK_CONFIG.projectSizes)) {
    console.log(`📊 Running ${sizeName} project benchmark...`);
    
    try {
      const benchmarkResult = await runSizeBenchmark(sizeName, sizeConfig);
      results.benchmarks[sizeName] = benchmarkResult;
      
      // Print results
      printBenchmarkResults(sizeName, benchmarkResult);
      
    } catch (error) {
      console.error(`❌ Benchmark failed for ${sizeName}:`, error.message);
      results.benchmarks[sizeName] = { error: error.message };
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Save results to file
  await saveBenchmarkResults(results);
  
  // Print summary
  printSummary(results);
  
  return results;
}

/**
 * Run benchmark for a specific project size
 */
async function runSizeBenchmark(sizeName, sizeConfig) {
  const tempDir = path.join(__dirname, '../../temp', `benchmark-${sizeName}-${Date.now()}`);
  
  try {
    // Create test project
    console.log(`  📁 Creating test project with ${sizeConfig.files} files...`);
    await createTestProject(tempDir, sizeConfig);
    
    // Initialize generator
    const generator = new DocumentationGenerator({
      outputDir: path.join(tempDir, 'docs'),
      languages: BENCHMARK_CONFIG.languages,
      features: {
        realTimeUpdates: false, // Disable for benchmarking
        gitIntegration: true,
        apiDocumentation: true,
        architectureDiagrams: true
      }
    });
    
    const results = {
      projectSize: sizeConfig,
      metrics: {},
      performance: {},
      memory: {}
    };
    
    // Benchmark analysis phase
    console.log('  🔍 Benchmarking analysis phase...');
    const analysisResult = await benchmarkAnalysis(generator, tempDir);
    results.performance.analysis = analysisResult.timing;
    results.memory.analysis = analysisResult.memory;
    results.metrics.analysis = analysisResult.metrics;
    
    // Benchmark generation phase
    console.log('  📝 Benchmarking generation phase...');
    const generationResult = await benchmarkGeneration(generator, analysisResult.data);
    results.performance.generation = generationResult.timing;
    results.memory.generation = generationResult.memory;
    results.metrics.generation = generationResult.metrics;
    
    // Benchmark incremental updates
    console.log('  🔄 Benchmarking incremental updates...');
    const incrementalResult = await benchmarkIncrementalUpdates(generator, tempDir);
    results.performance.incremental = incrementalResult.timing;
    results.memory.incremental = incrementalResult.memory;
    
    // Calculate totals
    results.performance.total = {
      duration: results.performance.analysis.duration + results.performance.generation.duration,
      throughput: calculateThroughput(sizeConfig, results.performance.analysis.duration + results.performance.generation.duration)
    };
    
    results.memory.peak = Math.max(
      results.memory.analysis.peak || 0,
      results.memory.generation.peak || 0,
      results.memory.incremental.peak || 0
    );
    
    // Validate against thresholds
    results.validation = validatePerformance(sizeName, results);
    
    return results;
    
  } finally {
    // Clean up
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Benchmark the analysis phase
 */
async function benchmarkAnalysis(generator, projectDir) {
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  // Run analysis
  const analysisData = await generator.analyzeProject(projectDir);
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    timing: {
      duration: endTime - startTime,
      startTime,
      endTime
    },
    memory: {
      start: startMemory,
      end: endMemory,
      peak: endMemory.heapUsed,
      delta: endMemory.heapUsed - startMemory.heapUsed
    },
    metrics: {
      filesAnalyzed: analysisData.files?.length || 0,
      functionsFound: analysisData.functions?.length || 0,
      classesFound: analysisData.classes?.length || 0,
      interfacesFound: analysisData.interfaces?.length || 0,
      apiEndpointsFound: analysisData.apiEndpoints?.length || 0
    },
    data: analysisData
  };
}

/**
 * Benchmark the documentation generation phase
 */
async function benchmarkGeneration(generator, analysisData) {
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  // Generate all documentation formats
  const [markdown, webAssets, openApiSpec] = await Promise.all([
    generator.generateMarkdown(analysisData),
    generator.generateWebDocumentation(analysisData),
    generator.generateOpenAPISpec(analysisData)
  ]);
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    timing: {
      duration: endTime - startTime,
      startTime,
      endTime
    },
    memory: {
      start: startMemory,
      end: endMemory,
      peak: endMemory.heapUsed,
      delta: endMemory.heapUsed - startMemory.heapUsed
    },
    metrics: {
      markdownSize: markdown?.length || 0,
      webAssetsCount: Object.keys(webAssets || {}).length,
      openApiEndpoints: Object.keys(openApiSpec?.paths || {}).length
    }
  };
}

/**
 * Benchmark incremental updates
 */
async function benchmarkIncrementalUpdates(generator, projectDir) {
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  // Simulate file changes
  const testFile = path.join(projectDir, 'test-update.ts');
  const originalContent = await fs.readFile(testFile, 'utf8');
  
  // Make 10 incremental updates
  const updateTimes = [];
  
  for (let i = 0; i < 10; i++) {
    const updateStart = performance.now();
    
    // Modify file
    const newContent = originalContent + `\n// Update ${i}\nexport function update${i}() { return ${i}; }`;
    await fs.writeFile(testFile, newContent);
    
    // Process incremental update
    await generator.getIncrementalUpdate(testFile);
    
    const updateEnd = performance.now();
    updateTimes.push(updateEnd - updateStart);
  }
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    timing: {
      duration: endTime - startTime,
      averageUpdateTime: updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length,
      updateTimes
    },
    memory: {
      start: startMemory,
      end: endMemory,
      peak: endMemory.heapUsed,
      delta: endMemory.heapUsed - startMemory.heapUsed
    }
  };
}

/**
 * Create a test project with specified configuration
 */
async function createTestProject(projectDir, config) {
  await fs.mkdir(projectDir, { recursive: true });
  
  const languages = BENCHMARK_CONFIG.languages;
  const filesPerLanguage = Math.ceil(config.files / languages.length);
  
  for (const language of languages) {
    const langDir = path.join(projectDir, language);
    await fs.mkdir(langDir, { recursive: true });
    
    for (let i = 0; i < filesPerLanguage; i++) {
      const fileName = `file${i}.${getFileExtension(language)}`;
      const filePath = path.join(langDir, fileName);
      const content = generateFileContent(language, config, i);
      
      await fs.writeFile(filePath, content);
    }
  }
  
  // Create test-update.ts file for incremental update benchmarking
  const testUpdateFile = path.join(projectDir, 'test-update.ts');
  const testUpdateContent = `
/**
 * Test file for incremental update benchmarking
 * This file will be modified during benchmark tests
 */

export interface TestInterface {
  id: string;
  name: string;
  value: number;
}

export class TestClass {
  private id: string;
  private name: string;
  
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  
  /**
   * Get the test ID
   * @returns The test identifier
   */
  public getId(): string {
    return this.id;
  }
  
  /**
   * Get the test name
   * @returns The test name
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Process test data
   * @param input Input data to process
   * @returns Processed result
   */
  public processData(input: any): any {
    return {
      id: this.id,
      name: this.name,
      processed: input,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Utility function for testing
 * @param value Input value
 * @returns Formatted string
 */
export function formatTestValue(value: any): string {
  return \`Test: \${JSON.stringify(value)}\`;
}
`;
  
  await fs.writeFile(testUpdateFile, testUpdateContent);
}

/**
 * Generate file content for benchmarking
 */
function generateFileContent(language, config, fileIndex) {
  const functions = [];
  
  for (let i = 0; i < config.functionsPerFile; i++) {
    const funcName = `function${fileIndex}_${i}`;
    const funcContent = generateFunctionContent(language, funcName, config.linesPerFunction);
    functions.push(funcContent);
  }
  
  switch (language) {
    case 'typescript':
      return `
        // Generated TypeScript file for benchmarking
        ${functions.join('\n\n')}
        
        export interface TestInterface${fileIndex} {
          id: string;
          name: string;
          value: number;
        }
      `;
      
    case 'python':
      return `
        """Generated Python file for benchmarking"""
        
        ${functions.join('\n\n')}
        
        class TestClass${fileIndex}:
            """Test class for benchmarking"""
            
            def __init__(self, id: str, name: str, value: int):
                self.id = id
                self.name = name
                self.value = value
      `;
      
    case 'go':
      return `
        // Generated Go file for benchmarking
        package main
        
        ${functions.join('\n\n')}
        
        type TestStruct${fileIndex} struct {
            ID    string \`json:"id"\`
            Name  string \`json:"name"\`
            Value int    \`json:"value"\`
        }
      `;
      
    default:
      return `// Generated file for ${language}`;
  }
}

/**
 * Generate function content for a specific language
 */
function generateFunctionContent(language, funcName, lineCount) {
  const lines = Math.max(5, lineCount - 10); // Reserve lines for signature and docs
  
  switch (language) {
    case 'typescript':
      return `
        /**
         * ${funcName} - Generated function for benchmarking
         * @param input Input parameter
         * @returns Processed result
         */
        export function ${funcName}(input: string): string {
          ${generateCodeLines(lines, '  ')}
          return \`Processed: \${input}\`;
        }
      `;
      
    case 'python':
      return `
        def ${funcName}(input_param: str) -> str:
            """
            ${funcName} - Generated function for benchmarking
            
            Args:
                input_param (str): Input parameter
                
            Returns:
                str: Processed result
            """
            ${generateCodeLines(lines, '    ')}
            return f"Processed: {input_param}"
      `;
      
    case 'go':
      return `
        // ${funcName} - Generated function for benchmarking
        func ${funcName}(input string) string {
            ${generateCodeLines(lines, '\t')}
            return fmt.Sprintf("Processed: %s", input)
        }
      `;
      
    default:
      return `function ${funcName}() {}`;
  }
}

/**
 * Generate filler code lines
 */
function generateCodeLines(count, indent) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    lines.push(`${indent}// Generated line ${i + 1}`);
  }
  return lines.join('\n');
}

/**
 * Get file extension for language
 */
function getFileExtension(language) {
  const extensions = {
    typescript: 'ts',
    python: 'py',
    go: 'go'
  };
  return extensions[language] || 'txt';
}

/**
 * Calculate throughput metrics
 */
function calculateThroughput(config, duration) {
  const totalItems = config.files * config.functionsPerFile;
  const itemsPerSecond = (totalItems / duration) * 1000;
  const filesPerSecond = (config.files / duration) * 1000;
  
  return {
    itemsPerSecond,
    filesPerSecond,
    totalItems
  };
}

/**
 * Validate performance against thresholds
 */
function validatePerformance(sizeName, results) {
  const thresholds = BENCHMARK_CONFIG.thresholds[sizeName];
  const memoryThreshold = BENCHMARK_CONFIG.memoryThresholds[sizeName];
  
  const validation = {
    passed: true,
    failures: []
  };
  
  // Check timing thresholds
  if (results.performance.analysis.duration > thresholds.analysis) {
    validation.passed = false;
    validation.failures.push(`Analysis time exceeded threshold: ${results.performance.analysis.duration}ms > ${thresholds.analysis}ms`);
  }
  
  if (results.performance.generation.duration > thresholds.generation) {
    validation.passed = false;
    validation.failures.push(`Generation time exceeded threshold: ${results.performance.generation.duration}ms > ${thresholds.generation}ms`);
  }
  
  if (results.performance.total.duration > thresholds.total) {
    validation.passed = false;
    validation.failures.push(`Total time exceeded threshold: ${results.performance.total.duration}ms > ${thresholds.total}ms`);
  }
  
  // Check memory threshold
  const peakMemoryMB = results.memory.peak / (1024 * 1024);
  if (peakMemoryMB > memoryThreshold) {
    validation.passed = false;
    validation.failures.push(`Memory usage exceeded threshold: ${peakMemoryMB.toFixed(2)}MB > ${memoryThreshold}MB`);
  }
  
  return validation;
}

/**
 * Print benchmark results
 */
function printBenchmarkResults(sizeName, results) {
  const { performance, memory, metrics, validation } = results;
  
  console.log(`  📈 Results for ${sizeName} project:`);
  console.log(`    Analysis: ${performance.analysis.duration.toFixed(2)}ms`);
  console.log(`    Generation: ${performance.generation.duration.toFixed(2)}ms`);
  console.log(`    Total: ${performance.total.duration.toFixed(2)}ms`);
  console.log(`    Throughput: ${performance.total.throughput.filesPerSecond.toFixed(2)} files/sec`);
  console.log(`    Peak Memory: ${(memory.peak / (1024 * 1024)).toFixed(2)}MB`);
  console.log(`    Functions Found: ${metrics.analysis.functionsFound}`);
  console.log(`    API Endpoints: ${metrics.analysis.apiEndpointsFound}`);
  
  if (validation.passed) {
    console.log(`    ✅ All performance thresholds met`);
  } else {
    console.log(`    ❌ Performance issues:`);
    validation.failures.forEach(failure => {
      console.log(`      - ${failure}`);
    });
  }
}

/**
 * Print summary of all benchmarks
 */
function printSummary(results) {
  console.log('📋 Benchmark Summary\n');
  
  const sizes = Object.keys(results.benchmarks);
  let allPassed = true;
  
  console.log('Size     | Analysis | Generation | Total    | Memory   | Status');
  console.log('---------|----------|------------|----------|----------|--------');
  
  sizes.forEach(size => {
    const result = results.benchmarks[size];
    
    if (result.error) {
      console.log(`${size.padEnd(8)} | ERROR: ${result.error}`);
      allPassed = false;
      return;
    }
    
    const analysis = result.performance.analysis.duration.toFixed(0).padStart(6);
    const generation = result.performance.generation.duration.toFixed(0).padStart(8);
    const total = result.performance.total.duration.toFixed(0).padStart(6);
    const memory = (result.memory.peak / (1024 * 1024)).toFixed(0).padStart(6);
    const status = result.validation.passed ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${size.padEnd(8)} | ${analysis}ms | ${generation}ms | ${total}ms | ${memory}MB | ${status}`);
    
    if (!result.validation.passed) {
      allPassed = false;
    }
  });
  
  console.log('\n' + (allPassed ? '🎉 All benchmarks passed!' : '⚠️  Some benchmarks failed - see details above'));
}

/**
 * Get system information
 */
async function getSystemInfo() {
  const os = require('os');
  
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    nodeVersion: process.version
  };
}

/**
 * Save benchmark results to file
 */
async function saveBenchmarkResults(results) {
  const outputDir = path.join(__dirname, '../../temp');
  await fs.mkdir(outputDir, { recursive: true });
  
  const fileName = `benchmark-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(outputDir, fileName);
  
  await fs.writeFile(filePath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${filePath}`);
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runBenchmarks()
    .then(() => {
      console.log('\n🏁 Benchmarking complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Benchmarking failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runBenchmarks,
  BENCHMARK_CONFIG
};
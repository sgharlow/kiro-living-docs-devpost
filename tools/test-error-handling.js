#!/usr/bin/env node

/**
 * Test script for error handling and graceful degradation
 */

import { ResilientAnalyzer } from '../dist/analyzers/resilient-analyzer.js';
import { ErrorHandler } from '../dist/errors/error-handler.js';
import { 
  DocumentationError, 
  ErrorSeverity, 
  ErrorCategory,
  FileAccessError,
  ParserError,
  TemplateError,
  ResourceConstraintError
} from '../dist/errors/error-types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function testErrorHandling() {
  console.log('🛡️  Starting Error Handling and Graceful Degradation Test...\n');

  // Create temporary directory for test files
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'error-handling-test-'));
  console.log(`📁 Test directory: ${tempDir}\n`);

  try {
    await runErrorHandlingTests(tempDir);
  } finally {
    // Clean up
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      console.log('\n🧹 Cleaned up test directory');
    } catch (error) {
      console.warn('⚠️  Failed to clean up test directory:', error.message);
    }
  }
}

async function runErrorHandlingTests(tempDir) {
  console.log('='.repeat(60));
  console.log('🧪 ERROR HANDLING TESTS');
  console.log('='.repeat(60));

  // Test 1: File Access Error Recovery
  console.log('\n1️⃣  Testing File Access Error Recovery...');
  await testFileAccessErrors(tempDir);

  // Test 2: Parser Error Fallbacks
  console.log('\n2️⃣  Testing Parser Error Fallbacks...');
  await testParserErrorFallbacks(tempDir);

  // Test 3: Resource Constraint Handling
  console.log('\n3️⃣  Testing Resource Constraint Handling...');
  await testResourceConstraints(tempDir);

  // Test 4: Batch Processing with Errors
  console.log('\n4️⃣  Testing Batch Processing with Errors...');
  await testBatchProcessingErrors(tempDir);

  // Test 5: Partial Results Generation
  console.log('\n5️⃣  Testing Partial Results Generation...');
  await testPartialResults(tempDir);

  // Test 6: Error Statistics and Health Monitoring
  console.log('\n6️⃣  Testing Error Statistics and Health Monitoring...');
  await testHealthMonitoring();

  // Test 7: Template Error Handling
  console.log('\n7️⃣  Testing Template Error Handling...');
  await testTemplateErrors();

  // Test 8: Comprehensive Project Analysis with Mixed Errors
  console.log('\n8️⃣  Testing Comprehensive Project Analysis...');
  await testComprehensiveProjectAnalysis(tempDir);

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL ERROR HANDLING TESTS COMPLETED');
  console.log('='.repeat(60));
}

async function testFileAccessErrors(tempDir) {
  const errorHandler = new ErrorHandler({
    maxRetries: 2,
    retryDelay: 100,
    enableFallbacks: true,
    logLevel: 'error'
  });

  console.log('   📂 Testing non-existent file handling...');
  
  try {
    await errorHandler.handleFileAccess(
      path.join(tempDir, 'nonexistent.js'),
      async () => {
        throw new Error('ENOENT: no such file or directory');
      },
      async () => {
        console.log('   ✅ Fallback executed successfully');
        return 'fallback content';
      }
    );
  } catch (error) {
    if (error instanceof FileAccessError) {
      console.log('   ✅ FileAccessError properly thrown and handled');
      console.log(`   📝 User message: ${error.getUserFriendlyMessage()}`);
    }
  }

  console.log('   📂 Testing permission denied handling...');
  
  // Create a file and make it unreadable (on Unix systems)
  const restrictedFile = path.join(tempDir, 'restricted.js');
  await fs.promises.writeFile(restrictedFile, 'console.log("restricted");');
  
  try {
    if (process.platform !== 'win32') {
      await fs.promises.chmod(restrictedFile, 0o000);
    }
    
    await errorHandler.handleFileAccess(
      restrictedFile,
      async () => fs.promises.readFile(restrictedFile, 'utf-8'),
      async () => {
        console.log('   ✅ Permission fallback executed');
        return '// File access restricted';
      }
    );
  } catch (error) {
    console.log('   ✅ Permission error handled gracefully');
  } finally {
    // Restore permissions for cleanup
    if (process.platform !== 'win32') {
      try {
        await fs.promises.chmod(restrictedFile, 0o644);
      } catch (e) {
        // Ignore
      }
    }
  }
}

async function testParserErrorFallbacks(tempDir) {
  const analyzer = new ResilientAnalyzer({
    enableFallbacks: true,
    timeoutMs: 2000
  });

  console.log('   🔧 Testing malformed JavaScript file...');
  
  const malformedJs = path.join(tempDir, 'malformed.js');
  await fs.promises.writeFile(malformedJs, `
    function validFunction() {
      return "this is valid";
    }
    
    // This will cause parser issues
    function unclosedFunction( {
      return "missing closing parenthesis";
    }
    
    // TODO: Fix the syntax error above
    class ValidClass {
      constructor() {}
    }
  `);

  const result = await analyzer.analyzeFile(malformedJs);
  
  console.log(`   📊 Analysis completeness: ${(result.completeness * 100).toFixed(1)}%`);
  console.log(`   🔧 Functions found: ${result.result.functions.length}`);
  console.log(`   🏗️  Classes found: ${result.result.classes.length}`);
  console.log(`   📝 TODOs found: ${result.result.todos.length}`);
  console.log(`   ⚠️  Errors encountered: ${result.errors.getErrors().length}`);
  console.log(`   🔄 Fallbacks used: ${result.fallbacksUsed.join(', ')}`);

  console.log('   🐍 Testing unsupported file type...');
  
  const unknownFile = path.join(tempDir, 'unknown.xyz');
  await fs.promises.writeFile(unknownFile, `
    // This file has an unknown extension
    function someFunction() {
      // FIXME: This should still be detected by regex fallback
      return "test";
    }
    
    class SomeClass {
      method() {}
    }
  `);

  const unknownResult = await analyzer.analyzeFile(unknownFile);
  
  console.log(`   📊 Unknown file completeness: ${(unknownResult.completeness * 100).toFixed(1)}%`);
  console.log(`   🔧 Functions extracted: ${unknownResult.result.functions.length}`);
  console.log(`   🏗️  Classes extracted: ${unknownResult.result.classes.length}`);
  console.log(`   📝 TODOs extracted: ${unknownResult.result.todos.length}`);
}

async function testResourceConstraints(tempDir) {
  const constrainedAnalyzer = new ResilientAnalyzer({
    maxFileSize: 1024, // 1KB limit
    skipLargeFiles: true
  });

  console.log('   📏 Testing large file handling...');
  
  const largeFile = path.join(tempDir, 'large.js');
  const largeContent = `
    // This file is intentionally large to test size limits
    ${'// '.repeat(1000)}
    function largeFileFunction() {
      return "This file exceeds the size limit";
    }
  `;
  
  await fs.promises.writeFile(largeFile, largeContent);
  
  const result = await constrainedAnalyzer.analyzeFile(largeFile);
  
  console.log(`   📊 Large file result completeness: ${(result.completeness * 100).toFixed(1)}%`);
  console.log(`   ⚠️  Errors: ${result.errors.getErrors().length}`);
  
  if (result.errors.getErrors().length > 0) {
    const resourceError = result.errors.getErrors().find(e => e.category === ErrorCategory.RESOURCE);
    if (resourceError) {
      console.log('   ✅ Resource constraint error properly detected');
      console.log(`   📝 Error message: ${resourceError.userMessage}`);
    }
  }

  console.log('   🧠 Testing memory constraint simulation...');
  
  const errorHandler = new ErrorHandler({ maxMemoryMB: 50 });
  const stats = errorHandler.getResourceStats();
  
  console.log(`   💾 Current memory usage: ${stats.memoryUsageMB.toFixed(1)}MB`);
  console.log(`   📊 Memory limit: ${stats.memoryLimitMB}MB`);
  console.log(`   ⚠️  Is constrained: ${stats.isConstrained}`);
}

async function testBatchProcessingErrors(tempDir) {
  const analyzer = new ResilientAnalyzer({
    maxConcurrentFiles: 2
  });

  console.log('   📦 Creating mixed file batch...');
  
  const files = [
    { name: 'good1.js', content: 'function good1() { return "success"; }' },
    { name: 'good2.py', content: 'def good2():\n    return "success"' },
    { name: 'bad1.xyz', content: 'invalid content that will fail' },
    { name: 'good3.ts', content: 'const good3 = (): string => "success";' },
    { name: 'bad2.abc', content: 'more invalid content' },
    { name: 'good4.go', content: 'func Good4() string { return "success" }' }
  ];

  const filePaths = [];
  for (const file of files) {
    const filePath = path.join(tempDir, file.name);
    await fs.promises.writeFile(filePath, file.content);
    filePaths.push(filePath);
  }

  const batchResult = await analyzer.analyzeFiles(filePaths, {
    continueOnError: true,
    includePartialResults: true
  });

  console.log(`   📊 Batch Results Summary:`);
  console.log(`   📁 Total files: ${batchResult.summary.total}`);
  console.log(`   ✅ Successful: ${batchResult.summary.successful}`);
  console.log(`   ⚠️  Partial: ${batchResult.summary.partial}`);
  console.log(`   ❌ Failed: ${batchResult.summary.failed}`);
  console.log(`   ⏭️  Skipped: ${batchResult.summary.skipped}`);
  console.log(`   🔍 Total errors: ${batchResult.aggregatedErrors.getErrors().length}`);

  // Show error breakdown
  const errorsByCategory = {};
  batchResult.aggregatedErrors.getErrors().forEach(error => {
    errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
  });

  console.log('   📈 Error breakdown by category:');
  Object.entries(errorsByCategory).forEach(([category, count]) => {
    console.log(`      ${category}: ${count}`);
  });
}

async function testPartialResults(tempDir) {
  const analyzer = new ResilientAnalyzer();

  console.log('   🧩 Testing partial result generation...');
  
  const partialFile = path.join(tempDir, 'partial.js');
  await fs.promises.writeFile(partialFile, `
    // This file has mixed valid and problematic content
    
    function validFunction1() {
      return "This should be detected";
    }
    
    // TODO: This should be found
    const validFunction2 = () => {
      return "Arrow function";
    };
    
    class ValidClass {
      constructor() {
        // FIXME: Constructor needs implementation
      }
      
      validMethod() {
        return "method";
      }
    }
    
    // Some potentially problematic syntax that might cause issues
    // but shouldn't prevent partial analysis
    const complex = {
      [Symbol.iterator]: function* () {
        yield 1;
      }
    };
  `);

  const result = await analyzer.analyzeFile(partialFile);
  
  console.log(`   📊 Partial analysis results:`);
  console.log(`   🎯 Completeness: ${(result.completeness * 100).toFixed(1)}%`);
  console.log(`   🔧 Functions: ${result.result.functions.length}`);
  console.log(`   🏗️  Classes: ${result.result.classes.length}`);
  console.log(`   📝 TODOs: ${result.result.todos.length}`);
  console.log(`   💬 Comments: ${result.result.comments.length}`);
  console.log(`   ⚠️  Errors: ${result.errors.getErrors().length}`);
  
  if (result.result.functions.length > 0) {
    console.log('   ✅ Successfully extracted function information despite potential issues');
  }
  
  if (result.result.todos.length > 0) {
    console.log('   ✅ Successfully extracted TODO items');
    result.result.todos.forEach(todo => {
      console.log(`      ${todo.type}: ${todo.content} (line ${todo.line})`);
    });
  }
}

async function testHealthMonitoring() {
  const analyzer = new ResilientAnalyzer();
  
  console.log('   🏥 Testing health status monitoring...');
  
  const health = analyzer.getHealthStatus();
  
  console.log(`   📊 System Status: ${health.status}`);
  console.log(`   💾 Memory Usage: ${health.resourceUsage.memoryUsageMB.toFixed(1)}MB / ${health.resourceUsage.memoryLimitMB}MB`);
  console.log(`   ⚠️  Is Constrained: ${health.resourceUsage.isConstrained}`);
  console.log(`   📈 Total Errors: ${health.errorStats.total}`);
  
  console.log('   💡 Recommendations:');
  health.recommendations.forEach((rec, index) => {
    console.log(`      ${index + 1}. ${rec}`);
  });

  // Test error statistics
  console.log('   📊 Error Statistics by Category:');
  Object.entries(health.errorStats.byCategory).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`      ${category}: ${count}`);
    }
  });

  console.log('   📊 Error Statistics by Severity:');
  Object.entries(health.errorStats.bySeverity).forEach(([severity, count]) => {
    if (count > 0) {
      console.log(`      ${severity}: ${count}`);
    }
  });
}

async function testTemplateErrors() {
  const errorHandler = new ErrorHandler();
  
  console.log('   📄 Testing template error handling...');
  
  try {
    await errorHandler.handleTemplateError(
      'test-template',
      async () => {
        throw new Error('Template compilation failed');
      },
      async () => {
        console.log('   ✅ Template fallback executed');
        return 'Fallback template content';
      }
    );
  } catch (error) {
    if (error instanceof TemplateError) {
      console.log('   ✅ Template error properly handled');
      console.log(`   📝 User message: ${error.getUserFriendlyMessage()}`);
    }
  }
}

async function testComprehensiveProjectAnalysis(tempDir) {
  const analyzer = new ResilientAnalyzer({
    enableFallbacks: true,
    skipBinaryFiles: true,
    maxConcurrentFiles: 3
  });

  console.log('   🏗️  Creating comprehensive test project...');
  
  // Create a realistic project structure with various file types and issues
  const projectStructure = {
    'src/index.ts': `
      import { Server } from './server';
      import { Database } from './database';
      
      // TODO: Add proper error handling
      async function main() {
        const server = new Server();
        await server.start();
      }
      
      main().catch(console.error);
    `,
    'src/server.ts': `
      export class Server {
        private port: number = 3000;
        
        async start(): Promise<void> {
          // FIXME: Add proper configuration
          console.log(\`Server starting on port \${this.port}\`);
        }
      }
    `,
    'src/database.py': `
      class Database:
          def __init__(self, connection_string: str):
              # NOTE: This needs proper connection handling
              self.connection = connection_string
          
          def connect(self):
              """Connect to the database"""
              pass
    `,
    'src/utils.go': `
      package utils
      
      // Helper provides utility functions
      type Helper struct {
          name string
      }
      
      // NewHelper creates a new helper instance
      func NewHelper(name string) *Helper {
          return &Helper{name: name}
      }
    `,
    'src/broken.js': `
      // This file has syntax errors
      function broken( {
        return "missing parenthesis";
      }
      
      // But this should still be detected
      function working() {
        return "this works";
      }
    `,
    'src/binary.png': Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG header
    'src/unknown.xyz': `
      // Unknown file type but with recognizable patterns
      function unknownFunction() {
        // HACK: This is a temporary solution
        return "unknown";
      }
    `,
    'README.md': '# Test Project\n\nThis is a test project for error handling.',
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    }, null, 2)
  };

  // Create all files
  for (const [filePath, content] of Object.entries(projectStructure)) {
    const fullPath = path.join(tempDir, filePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    if (Buffer.isBuffer(content)) {
      await fs.promises.writeFile(fullPath, content);
    } else {
      await fs.promises.writeFile(fullPath, content);
    }
  }

  console.log('   🔍 Analyzing comprehensive project...');
  
  const projectResult = await analyzer.analyzeProject(tempDir);
  
  console.log(`   📊 Project Analysis Results:`);
  console.log(`   📁 Files Processed: ${projectResult.summary.filesProcessed}`);
  console.log(`   ⏭️  Files Skipped: ${projectResult.summary.filesSkipped}`);
  console.log(`   ⚠️  Errors Encountered: ${projectResult.summary.errorsEncountered}`);
  console.log(`   🎯 Average Completeness: ${(projectResult.summary.completenessAverage * 100).toFixed(1)}%`);

  console.log(`   📈 Detailed Results by File:`);
  for (const [filePath, result] of projectResult.results) {
    const relativePath = path.relative(tempDir, filePath);
    const completeness = (result.completeness * 100).toFixed(1);
    const errorCount = result.errors.getErrors().length;
    const fallbacks = result.fallbacksUsed.length > 0 ? ` (fallbacks: ${result.fallbacksUsed.join(', ')})` : '';
    
    console.log(`      ${relativePath}: ${completeness}% complete, ${errorCount} errors${fallbacks}`);
  }

  // Show aggregated error summary
  if (projectResult.errors.getErrors().length > 0) {
    console.log(`   🔍 Error Summary: ${projectResult.errors.getSummary()}`);
    
    const criticalErrors = projectResult.errors.getErrorsBySeverity(ErrorSeverity.CRITICAL);
    if (criticalErrors.length > 0) {
      console.log(`   🚨 Critical Errors:`);
      criticalErrors.forEach(error => {
        console.log(`      - ${error.userMessage}`);
      });
    }
  }

  console.log('   ✅ Comprehensive project analysis completed with graceful error handling');
}

// Run the test
testErrorHandling().catch(error => {
  console.error('❌ Error handling test failed:', error);
  process.exit(1);
});
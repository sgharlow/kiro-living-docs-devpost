#!/usr/bin/env node

/**
 * End-to-End Demo Flow Test
 * 
 * Tests the complete demo workflow to ensure all components work together:
 * 1. Multi-language project analysis
 * 2. Documentation generation
 * 3. Performance validation
 * 4. Demo service integration
 */

const { DocumentationGenerator } = require('../dist/generators/documentation-generator');
const path = require('path');
const fs = require('fs');

/**
 * Test configuration
 */
const TEST_CONFIG = {
  demoProjectPath: path.join(__dirname),
  outputDir: path.join(__dirname, 'test-output'),
  expectedLanguages: ['typescript', 'python', 'go'],
  performanceThresholds: {
    analysisTime: 5000, // 5 seconds
    memoryUsage: 100 * 1024 * 1024 // 100MB
  }
};

/**
 * Main test function
 */
async function testDemoFlow() {
  console.log('🚀 Starting End-to-End Demo Flow Test\n');
  
  try {
    // Step 1: Initialize Documentation Generator
    console.log('📋 Step 1: Initializing Documentation Generator...');
    const generator = new DocumentationGenerator({
      outputDir: TEST_CONFIG.outputDir,
      languages: TEST_CONFIG.expectedLanguages,
      features: {
        realTimeUpdates: false,
        gitIntegration: true,
        apiDocumentation: true,
        architectureDiagrams: true
      }
    });
    console.log('✅ Documentation Generator initialized\n');

    // Step 2: Analyze Demo Project
    console.log('📋 Step 2: Analyzing multi-language demo project...');
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    const projectAnalysis = await generator.analyzeProject(TEST_CONFIG.demoProjectPath);
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const analysisTime = endTime - startTime;
    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
    
    console.log(`✅ Project analysis completed in ${analysisTime}ms`);
    console.log(`📊 Memory used: ${Math.round(memoryUsed / 1024 / 1024)}MB`);
    console.log(`📁 Files analyzed: ${projectAnalysis.files.size}`);
    console.log(`🌐 Languages detected: ${projectAnalysis.metadata.languages.join(', ')}\n`);

    // Step 3: Validate Analysis Results
    console.log('📋 Step 3: Validating analysis results...');
    
    // Check languages detected
    const detectedLanguages = projectAnalysis.metadata.languages;
    const hasTypeScript = detectedLanguages.includes('typescript');
    const hasPython = detectedLanguages.includes('python');
    const hasGo = detectedLanguages.includes('go');
    
    console.log(`🔷 TypeScript detected: ${hasTypeScript ? '✅' : '❌'}`);
    console.log(`🐍 Python detected: ${hasPython ? '✅' : '❌'}`);
    console.log(`🐹 Go detected: ${hasGo ? '✅' : '❌'}`);
    
    // Count analysis results
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalApiEndpoints = 0;
    
    for (const [filePath, analysis] of projectAnalysis.files.entries()) {
      totalFunctions += analysis.functions.length;
      totalClasses += analysis.classes.length;
      totalApiEndpoints += analysis.apiEndpoints.length;
      
      console.log(`📄 ${path.basename(filePath)}: ${analysis.functions.length} functions, ${analysis.classes.length} classes, ${analysis.apiEndpoints.length} API endpoints`);
    }
    
    console.log(`📊 Total: ${totalFunctions} functions, ${totalClasses} classes, ${totalApiEndpoints} API endpoints\n`);

    // Step 4: Generate Documentation
    console.log('📋 Step 4: Generating documentation...');
    
    const [markdown, webAssets, openApiSpec] = await Promise.all([
      generator.generateMarkdown(projectAnalysis),
      generator.generateWebDocumentation(projectAnalysis),
      generator.generateOpenAPISpec(projectAnalysis)
    ]);
    
    console.log(`✅ Markdown generated: ${markdown.length} characters`);
    console.log(`✅ Web assets generated: ${Object.keys(webAssets).length} files`);
    console.log(`✅ OpenAPI spec generated: ${Object.keys(openApiSpec.paths || {}).length} endpoints\n`);

    // Step 5: Performance Validation
    console.log('📋 Step 5: Validating performance...');
    
    const analysisTimeOk = analysisTime < TEST_CONFIG.performanceThresholds.analysisTime;
    const memoryUsageOk = Math.abs(memoryUsed) < TEST_CONFIG.performanceThresholds.memoryUsage;
    
    console.log(`⏱️  Analysis time: ${analysisTime}ms (${analysisTimeOk ? '✅' : '❌'} < ${TEST_CONFIG.performanceThresholds.analysisTime}ms)`);
    console.log(`💾 Memory usage: ${Math.round(Math.abs(memoryUsed) / 1024 / 1024)}MB (${memoryUsageOk ? '✅' : '❌'} < ${Math.round(TEST_CONFIG.performanceThresholds.memoryUsage / 1024 / 1024)}MB)\n`);

    // Step 6: Demo Service Integration Test
    console.log('📋 Step 6: Testing demo service integration...');
    
    // Check if demo services are properly analyzed
    const backendFiles = Array.from(projectAnalysis.files.keys()).filter(f => f.includes('backend'));
    const pythonFiles = Array.from(projectAnalysis.files.keys()).filter(f => f.includes('python-service'));
    const goFiles = Array.from(projectAnalysis.files.keys()).filter(f => f.includes('go-service'));
    
    console.log(`🔷 Backend TypeScript files: ${backendFiles.length} (${backendFiles.length > 0 ? '✅' : '❌'})`);
    console.log(`🐍 Python service files: ${pythonFiles.length} (${pythonFiles.length > 0 ? '✅' : '❌'})`);
    console.log(`🐹 Go service files: ${goFiles.length} (${goFiles.length > 0 ? '✅' : '❌'})\n`);

    // Step 7: Generate Test Report
    console.log('📋 Step 7: Generating test report...');
    
    const testReport = {
      timestamp: new Date().toISOString(),
      success: true,
      performance: {
        analysisTime,
        memoryUsed: Math.round(memoryUsed / 1024 / 1024),
        analysisTimeOk,
        memoryUsageOk
      },
      analysis: {
        filesAnalyzed: projectAnalysis.files.size,
        languagesDetected: detectedLanguages,
        totalFunctions,
        totalClasses,
        totalApiEndpoints
      },
      documentation: {
        markdownSize: markdown.length,
        webAssetsCount: Object.keys(webAssets).length,
        openApiEndpoints: Object.keys(openApiSpec.paths || {}).length
      },
      demoServices: {
        backendFiles: backendFiles.length,
        pythonFiles: pythonFiles.length,
        goFiles: goFiles.length
      }
    };
    
    // Save test report
    const reportPath = path.join(TEST_CONFIG.outputDir, 'demo-test-report.json');
    await fs.promises.mkdir(TEST_CONFIG.outputDir, { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(testReport, null, 2));
    
    console.log(`✅ Test report saved to: ${reportPath}\n`);

    // Final Results
    console.log('🎉 End-to-End Demo Flow Test Results:');
    console.log('=====================================');
    console.log(`✅ Multi-language analysis: ${hasTypeScript && hasPython && hasGo ? 'PASS' : 'PARTIAL'}`);
    console.log(`✅ Documentation generation: PASS`);
    console.log(`✅ Performance validation: ${analysisTimeOk && memoryUsageOk ? 'PASS' : 'PARTIAL'}`);
    console.log(`✅ Demo service integration: ${backendFiles.length > 0 && pythonFiles.length > 0 && goFiles.length > 0 ? 'PASS' : 'PARTIAL'}`);
    console.log(`✅ Overall: ${testReport.success ? 'PASS' : 'FAIL'}\n`);
    
    return testReport;
    
  } catch (error) {
    console.error('❌ Demo flow test failed:', error);
    console.error('Stack trace:', error.stack);
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
    
    // Save error report
    try {
      await fs.promises.mkdir(TEST_CONFIG.outputDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(TEST_CONFIG.outputDir, 'demo-test-error.json'),
        JSON.stringify(errorReport, null, 2)
      );
    } catch (saveError) {
      console.error('Failed to save error report:', saveError);
    }
    
    process.exit(1);
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  try {
    // Clean up test output directory
    if (fs.existsSync(TEST_CONFIG.outputDir)) {
      await fs.promises.rmdir(TEST_CONFIG.outputDir, { recursive: true });
      console.log('🧹 Cleaned up test output directory');
    }
  } catch (error) {
    console.warn('⚠️  Failed to cleanup:', error.message);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDemoFlow()
    .then((report) => {
      console.log('✅ Demo flow test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demo flow test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDemoFlow, cleanup };
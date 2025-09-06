#!/usr/bin/env node

const { TypeScriptAnalyzer } = require('../dist/analyzers/typescript-analyzer.js');
const { OpenAPIGenerator } = require('../dist/generators/openapi-generator.js');
const { ApiDocsGenerator } = require('../dist/generators/api-docs-generator.js');
const fs = require('fs');
const path = require('path');

async function testApiDocumentation() {
  console.log('🚀 Testing API Documentation Generation...\n');

  try {
    // Read the sample API file
    const sampleApiPath = path.join(__dirname, '../tests/fixtures/sample-api.ts');
    const sampleApiCode = fs.readFileSync(sampleApiPath, 'utf-8');

    console.log('📁 Analyzing sample API file...');
    
    // Step 1: Analyze the TypeScript file
    const analyzer = new TypeScriptAnalyzer();
    const analysis = analyzer.analyze('sample-api.ts', sampleApiCode);
    
    console.log(`✅ Found ${analysis.apiEndpoints.length} API endpoints`);
    
    // Display found endpoints
    analysis.apiEndpoints.forEach((endpoint, index) => {
      console.log(`   ${index + 1}. ${endpoint.method} ${endpoint.path} (${endpoint.handler})`);
    });

    // Step 2: Create project analysis
    const projectAnalysis = {
      metadata: {
        name: 'Sample API',
        version: '1.0.0',
        description: 'A sample API for testing documentation generation',
        languages: ['typescript']
      },
      structure: {
        directories: [],
        files: ['sample-api.ts'],
        entryPoints: ['sample-api.ts'],
        testFiles: [],
        configFiles: []
      },
      files: new Map([['sample-api.ts', analysis]]),
      lastUpdated: new Date()
    };

    console.log('\n📋 Generating OpenAPI specification...');
    
    // Step 3: Generate OpenAPI specification
    const openApiGenerator = new OpenAPIGenerator();
    const openApiSpec = openApiGenerator.generateOpenAPISpec(projectAnalysis);
    
    console.log(`✅ Generated OpenAPI spec with ${Object.keys(openApiSpec.paths).length} paths`);
    
    // Save OpenAPI spec
    const openApiJson = JSON.stringify(openApiSpec, null, 2);
    fs.writeFileSync('sample-api-openapi.json', openApiJson);
    console.log('💾 Saved OpenAPI specification to sample-api-openapi.json');

    console.log('\n📄 Generating interactive documentation...');
    
    // Step 4: Generate interactive documentation
    const apiDocsGenerator = new ApiDocsGenerator();
    const interactiveHtml = apiDocsGenerator.generateInteractiveApiDocs(projectAnalysis);
    
    fs.writeFileSync('sample-api-docs.html', interactiveHtml);
    console.log('💾 Saved interactive documentation to sample-api-docs.html');

    // Step 5: Generate markdown documentation
    const markdownDocs = apiDocsGenerator.generateApiDocsMarkdown(projectAnalysis);
    
    fs.writeFileSync('sample-api-docs.md', markdownDocs);
    console.log('💾 Saved markdown documentation to sample-api-docs.md');

    console.log('\n🎉 API Documentation generation completed successfully!');
    console.log('\nGenerated files:');
    console.log('  - sample-api-openapi.json (OpenAPI 3.0 specification)');
    console.log('  - sample-api-docs.html (Interactive HTML documentation)');
    console.log('  - sample-api-docs.md (Markdown documentation)');
    
    console.log('\n📊 Summary:');
    console.log(`  - Endpoints analyzed: ${analysis.apiEndpoints.length}`);
    console.log(`  - OpenAPI paths: ${Object.keys(openApiSpec.paths).length}`);
    console.log(`  - Documentation size: ${Math.round(interactiveHtml.length / 1024)}KB (HTML), ${Math.round(markdownDocs.length / 1024)}KB (Markdown)`);

  } catch (error) {
    console.error('❌ Error during API documentation generation:', error);
    process.exit(1);
  }
}

// Run the test
testApiDocumentation();
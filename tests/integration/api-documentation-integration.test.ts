import { describe, it, expect, beforeEach } from '@jest/globals';
import { TypeScriptAnalyzer } from '../../dist/analyzers/typescript-analyzer.js';
import { ApiAnalyzer } from '../../dist/analyzers/api-analyzer.js';
import { OpenAPIGenerator } from '../../dist/generators/openapi-generator.js';
import { ApiDocsGenerator } from '../../dist/generators/api-docs-generator.js';
import { ProjectAnalysis } from '../../dist/types.js';
import * as fs from 'fs';
import * as path from 'path';

describe('API Documentation Integration', () => {
  let tsAnalyzer: TypeScriptAnalyzer;
  let openApiGenerator: OpenAPIGenerator;
  let apiDocsGenerator: ApiDocsGenerator;
  let sampleApiCode: string;

  beforeEach(() => {
    tsAnalyzer = new TypeScriptAnalyzer();
    openApiGenerator = new OpenAPIGenerator();
    apiDocsGenerator = new ApiDocsGenerator();
    
    // Read the sample API file
    const sampleApiPath = path.join(__dirname, '../fixtures/sample-api.ts');
    sampleApiCode = fs.readFileSync(sampleApiPath, 'utf-8');
  });

  describe('End-to-end API documentation generation', () => {
    it('should analyze sample API and generate complete documentation', async () => {
      // Step 1: Analyze the TypeScript file
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      
      // Verify endpoints were detected
      expect(analysis.apiEndpoints.length).toBeGreaterThan(0);
      
      // Check for specific endpoints
      const getUsersEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'GET' && ep.path === '/api/users'
      );
      expect(getUsersEndpoint).toBeDefined();
      expect(getUsersEndpoint!.handler).toBe('anonymous');
      
      const getUserByIdEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'GET' && ep.path === '/api/users/:id'
      );
      expect(getUserByIdEndpoint).toBeDefined();
      expect(getUserByIdEndpoint!.parameters).toHaveLength(1);
      expect(getUserByIdEndpoint!.parameters![0].name).toBe('id');
      
      const createUserEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'POST' && ep.path === '/api/users'
      );
      expect(createUserEndpoint).toBeDefined();
    });

    it('should generate OpenAPI specification from analyzed endpoints', async () => {
      // Analyze the file
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      
      // Create project analysis
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Sample API',
          version: '1.0.0',
          description: 'A sample API for testing',
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
      
      // Generate OpenAPI spec
      const openApiSpec = openApiGenerator.generateOpenAPISpec(projectAnalysis);
      
      // Verify OpenAPI structure
      expect(openApiSpec.openapi).toBe('3.0.3');
      expect(openApiSpec.info.title).toBe('Sample API');
      expect(openApiSpec.paths).toBeDefined();
      
      // Check specific paths
      expect(openApiSpec.paths).toHaveProperty('/api/users');
      expect(openApiSpec.paths).toHaveProperty('/api/users/{id}');
      expect(openApiSpec.paths).toHaveProperty('/health');
      
      // Verify operations
      expect(openApiSpec.paths['/api/users'].get).toBeDefined();
      expect(openApiSpec.paths['/api/users'].post).toBeDefined();
      expect(openApiSpec.paths['/api/users/{id}'].get).toBeDefined();
      expect(openApiSpec.paths['/api/users/{id}'].put).toBeDefined();
      expect(openApiSpec.paths['/api/users/{id}'].delete).toBeDefined();
      
      // Verify parameters
      const getUserByIdOp = openApiSpec.paths['/api/users/{id}'].get!;
      expect(getUserByIdOp.parameters).toHaveLength(1);
      expect(getUserByIdOp.parameters![0].name).toBe('id');
      expect(getUserByIdOp.parameters![0].in).toBe('path');
      
      // Verify responses
      expect(getUserByIdOp.responses).toHaveProperty('200');
      expect(getUserByIdOp.responses).toHaveProperty('400');
      expect(getUserByIdOp.responses).toHaveProperty('500');
      
      // Verify request bodies for POST/PUT
      const createUserOp = openApiSpec.paths['/api/users'].post!;
      expect(createUserOp.requestBody).toBeDefined();
      expect(createUserOp.requestBody!.content).toHaveProperty('application/json');
    });

    it('should generate interactive HTML documentation', async () => {
      // Analyze and create project analysis
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Sample API',
          version: '1.0.0',
          description: 'A sample API for testing',
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
      
      // Generate HTML documentation
      const html = apiDocsGenerator.generateInteractiveApiDocs(projectAnalysis);
      
      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Sample API - API Documentation</title>');
      expect(html).toContain('Sample API');
      expect(html).toContain('A sample API for testing');
      
      // Verify navigation
      expect(html).toContain('class="endpoint-list"');
      expect(html).toContain('GET');
      expect(html).toContain('POST');
      expect(html).toContain('/api/users');
      
      // Verify endpoint sections
      expect(html).toContain('class="endpoint"');
      expect(html).toContain('Parameters');
      expect(html).toContain('cURL');
      expect(html).toContain('Request');
      expect(html).toContain('Response');
      
      // Verify interactive elements
      expect(html).toContain('showTab');
      expect(html).toContain('copyToClipboard');
      expect(html).toContain('downloadSpec');
      
      // Verify CSS and styling
      expect(html).toContain('<style>');
      expect(html).toContain('method-get');
      expect(html).toContain('method-post');
      expect(html).toContain('api-docs');
    });

    it('should generate markdown documentation', async () => {
      // Analyze and create project analysis
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Sample API',
          version: '1.0.0',
          description: 'A sample API for testing',
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
      
      // Generate markdown documentation
      const markdown = apiDocsGenerator.generateApiDocsMarkdown(projectAnalysis);
      
      // Verify markdown structure
      expect(markdown).toContain('# API Documentation');
      expect(markdown).toContain('A sample API for testing');
      
      // Verify endpoint sections
      expect(markdown).toContain('## /api/users');
      expect(markdown).toContain('### GET /api/users');
      expect(markdown).toContain('### POST /api/users');
      expect(markdown).toContain('### GET /api/users/:id');
      
      // Verify parameter tables
      expect(markdown).toContain('#### Parameters');
      expect(markdown).toContain('| Name | Type | Required | Description |');
      expect(markdown).toContain('| `id` | `string` | Yes |');
      
      // Verify examples
      expect(markdown).toContain('#### Example Request');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('curl -X GET');
      expect(markdown).toContain('#### Example Response');
      expect(markdown).toContain('```json');
      
      // Verify OpenAPI spec inclusion
      expect(markdown).toContain('## OpenAPI Specification');
      expect(markdown).toContain('"openapi": "3.0.3"');
    });

    it('should handle complex endpoint patterns', async () => {
      // Test nested resource endpoints
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      
      const nestedEndpoints = analysis.apiEndpoints.filter(ep => 
        ep.path.includes('/users/:userId/posts') || 
        ep.path.includes('/posts/:postId/comments')
      );
      
      expect(nestedEndpoints.length).toBeGreaterThan(0);
      
      // Verify parameter extraction for nested resources
      const userPostsEndpoint = nestedEndpoints.find(ep => 
        ep.path === '/api/users/:userId/posts' && ep.method === 'GET'
      );
      expect(userPostsEndpoint).toBeDefined();
      expect(userPostsEndpoint!.parameters).toContainEqual(
        expect.objectContaining({ name: 'userId' })
      );
    });

    it('should generate valid JSON and YAML outputs', async () => {
      // Analyze and create project analysis
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Sample API',
          version: '1.0.0',
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
      
      // Generate JSON
      const json = openApiGenerator.generateOpenAPIJson(projectAnalysis);
      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsedJson = JSON.parse(json);
      expect(parsedJson.openapi).toBe('3.0.3');
      expect(parsedJson.info.title).toBe('Sample API');
      
      // Generate YAML
      const yaml = openApiGenerator.generateOpenAPIYaml(projectAnalysis);
      expect(yaml).toContain('openapi: 3.0.3');
      expect(yaml).toContain('title: Sample API');
      expect(yaml).toContain('paths:');
    });

    it('should generate appropriate examples for different endpoint types', async () => {
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      
      // Test collection endpoint (GET /api/users)
      const collectionEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'GET' && ep.path === '/api/users'
      )!;
      const collectionExamples = apiDocsGenerator.generateEndpointExamples(collectionEndpoint);
      expect(Array.isArray(collectionExamples.response)).toBe(true);
      expect(collectionExamples.curl).toContain('GET');
      expect(collectionExamples.curl).not.toContain('-d \'');
      
      // Test item endpoint (GET /api/users/:id)
      const itemEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'GET' && ep.path === '/api/users/:id'
      )!;
      const itemExamples = apiDocsGenerator.generateEndpointExamples(itemEndpoint);
      expect(Array.isArray(itemExamples.response)).toBe(false);
      expect(itemExamples.curl).toContain('/users/123');
      
      // Test creation endpoint (POST /api/users)
      const createEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'POST' && ep.path === '/api/users'
      )!;
      const createExamples = apiDocsGenerator.generateEndpointExamples(createEndpoint);
      expect(createExamples.request).toBeDefined();
      expect(createExamples.curl).toContain('POST');
      expect(createExamples.curl).toContain('-d \'');
      
      // Test deletion endpoint (DELETE /api/users/:id)
      const deleteEndpoint = analysis.apiEndpoints.find(
        ep => ep.method === 'DELETE' && ep.path === '/api/users/:id'
      )!;
      const deleteExamples = apiDocsGenerator.generateEndpointExamples(deleteEndpoint);
      expect(deleteExamples.response.message).toBe('Deleted successfully');
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large API files efficiently', async () => {
      const startTime = Date.now();
      
      // Analyze the sample API multiple times to simulate a large file
      for (let i = 0; i < 10; i++) {
        await tsAnalyzer.analyze(`sample-api-${i}.ts`, sampleApiCode);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should generate documentation for many endpoints efficiently', async () => {
      // Create a large project analysis with many endpoints
      const analysis = await tsAnalyzer.analyze('sample-api.ts', sampleApiCode);
      const manyEndpoints = [];
      
      // Duplicate endpoints to simulate a large API
      for (let i = 0; i < 100; i++) {
        manyEndpoints.push(...analysis.apiEndpoints.map(ep => ({
          ...ep,
          path: ep.path.replace('/api/', `/api/v${i}/`)
        })));
      }
      
      const largeAnalysis = {
        ...analysis,
        apiEndpoints: manyEndpoints
      };
      
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Large API',
          languages: ['typescript']
        },
        structure: {
          directories: [],
          files: ['large-api.ts'],
          entryPoints: ['large-api.ts'],
          testFiles: [],
          configFiles: []
        },
        files: new Map([['large-api.ts', largeAnalysis]]),
        lastUpdated: new Date()
      };
      
      const startTime = Date.now();
      
      // Generate documentation
      const openApiSpec = openApiGenerator.generateOpenAPISpec(projectAnalysis);
      const html = apiDocsGenerator.generateInteractiveApiDocs(projectAnalysis);
      const markdown = apiDocsGenerator.generateApiDocsMarkdown(projectAnalysis);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify results
      expect(Object.keys(openApiSpec.paths).length).toBeGreaterThan(100);
      expect(html).toContain('Large API');
      expect(markdown).toContain('# API Documentation');
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
    });
  });
});
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ApiDocsGenerator } from '../../src/generators/api-docs-generator.js';
import { ProjectAnalysis, ApiEndpointInfo } from '../../src/types.js';

describe('ApiDocsGenerator', () => {
  let generator: ApiDocsGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    generator = new ApiDocsGenerator();
    
    const mockEndpoints: ApiEndpointInfo[] = [
      {
        method: 'GET',
        path: '/users',
        handler: 'getUsers',
        line: 10,
        description: 'Get all users'
      },
      {
        method: 'GET',
        path: '/users/:id',
        handler: 'getUserById',
        line: 15,
        parameters: [
          {
            name: 'id',
            type: 'string',
            optional: false,
            description: 'User ID'
          }
        ]
      },
      {
        method: 'POST',
        path: '/users',
        handler: 'createUser',
        line: 20,
        description: 'Create a new user'
      }
    ];

    mockAnalysis = {
      metadata: {
        name: 'Test API',
        version: '1.0.0',
        description: 'A test API for documentation',
        languages: ['typescript']
      },
      structure: {
        directories: [],
        files: [],
        entryPoints: [],
        testFiles: [],
        configFiles: []
      },
      files: new Map([
        ['src/users.ts', {
          functions: [],
          classes: [],
          interfaces: [],
          exports: [],
          imports: [],
          comments: [],
          todos: [],
          apiEndpoints: mockEndpoints
        }]
      ]),
      lastUpdated: new Date()
    };
  });

  describe('Interactive HTML documentation', () => {
    it('should generate complete HTML documentation', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test API - API Documentation</title>');
      expect(html).toContain('Test API');
      expect(html).toContain('A test API for documentation');
      expect(html).toContain('Version: 1.0.0');
    });

    it('should include all endpoints in navigation', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('GET');
      expect(html).toContain('/users');
      expect(html).toContain('POST');
      expect(html).toContain('/users/:id');
    });

    it('should include endpoint details', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('Get all users');
      expect(html).toContain('Create a new user');
      expect(html).toContain('getUserById');
    });

    it('should include parameter tables', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('Parameters');
      expect(html).toContain('<table class="params-table">');
      expect(html).toContain('User ID');
    });

    it('should include example tabs', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('cURL');
      expect(html).toContain('Request');
      expect(html).toContain('Response');
      expect(html).toContain('tab-btn');
    });

    it('should include CSS and JavaScript', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('<style>');
      expect(html).toContain('<script>');
      expect(html).toContain('showTab');
      expect(html).toContain('copyToClipboard');
    });
  });

  describe('Markdown documentation', () => {
    it('should generate markdown with proper structure', () => {
      const markdown = generator.generateApiDocsMarkdown(mockAnalysis);
      
      expect(markdown).toContain('# API Documentation');
      expect(markdown).toContain('A test API for documentation');
      expect(markdown).toContain('## /users');
      expect(markdown).toContain('### GET /users');
      expect(markdown).toContain('### POST /users');
    });

    it('should include parameter tables in markdown', () => {
      const markdown = generator.generateApiDocsMarkdown(mockAnalysis);
      
      expect(markdown).toContain('#### Parameters');
      expect(markdown).toContain('| Name | Type | Required | Description |');
      expect(markdown).toContain('| `id` | `string` | Yes | User ID |');
    });

    it('should include examples in markdown', () => {
      const markdown = generator.generateApiDocsMarkdown(mockAnalysis);
      
      expect(markdown).toContain('#### Example Request');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('curl -X GET');
      expect(markdown).toContain('#### Example Response');
      expect(markdown).toContain('```json');
    });

    it('should include OpenAPI specification', () => {
      const markdown = generator.generateApiDocsMarkdown(mockAnalysis);
      
      expect(markdown).toContain('## OpenAPI Specification');
      expect(markdown).toContain('```json');
      expect(markdown).toContain('"openapi": "3.0.3"');
    });
  });

  describe('Example generation', () => {
    it('should generate request examples for POST/PUT/PATCH', () => {
      const postEndpoint = mockAnalysis.files.get('src/users.ts')!.apiEndpoints[2];
      const examples = generator.generateEndpointExamples(postEndpoint);
      
      expect(examples.request).toBeDefined();
      expect(examples.request.name).toContain('Example users');
      expect(examples.request.description).toBeDefined();
    });

    it('should generate response examples for all methods', () => {
      const getEndpoint = mockAnalysis.files.get('src/users.ts')!.apiEndpoints[0];
      const examples = generator.generateEndpointExamples(getEndpoint);
      
      expect(examples.response).toBeDefined();
      expect(Array.isArray(examples.response)).toBe(true); // Collection endpoint
    });

    it('should generate cURL examples', () => {
      const getEndpoint = mockAnalysis.files.get('src/users.ts')!.apiEndpoints[0];
      const examples = generator.generateEndpointExamples(getEndpoint);
      
      expect(examples.curl).toBeDefined();
      expect(examples.curl).toContain('curl -X GET');
      expect(examples.curl).toContain('http://localhost:3000/users');
      expect(examples.curl).toContain('-H "Content-Type: application/json"');
    });

    it('should handle path parameters in cURL examples', () => {
      const getByIdEndpoint = mockAnalysis.files.get('src/users.ts')!.apiEndpoints[1];
      const examples = generator.generateEndpointExamples(getByIdEndpoint);
      
      expect(examples.curl).toContain('/users/123'); // :id replaced with 123
    });

    it('should include request body in cURL for POST requests', () => {
      const postEndpoint = mockAnalysis.files.get('src/users.ts')!.apiEndpoints[2];
      const examples = generator.generateEndpointExamples(postEndpoint);
      
      expect(examples.curl).toContain('-d \'');
      expect(examples.curl).toContain('Example users');
    });
  });

  describe('Path grouping', () => {
    it('should group endpoints by base path', () => {
      const endpoints = [
        { method: 'GET' as const, path: '/api/users', handler: 'getUsers', line: 1 },
        { method: 'POST' as const, path: '/api/users', handler: 'createUser', line: 2 },
        { method: 'GET' as const, path: '/api/posts', handler: 'getPosts', line: 3 }
      ];

      const grouped = generator['groupEndpointsByPath'](endpoints);
      
      expect(grouped.size).toBe(2);
      expect(grouped.has('/api/users')).toBe(true);
      expect(grouped.has('/api/posts')).toBe(true);
      expect(grouped.get('/api/users')).toHaveLength(2);
      expect(grouped.get('/api/posts')).toHaveLength(1);
    });

    it('should extract base path correctly', () => {
      expect(generator['getBasePath']('/api/users')).toBe('/api/users');
      expect(generator['getBasePath']('/api/users/:id')).toBe('/api/users');
      expect(generator['getBasePath']('/api/users/{id}/posts')).toBe('/api/users/posts');
      expect(generator['getBasePath']('/')).toBe('/');
    });
  });

  describe('Response examples', () => {
    it('should generate array responses for collection endpoints', () => {
      const collectionEndpoint: ApiEndpointInfo = {
        method: 'GET',
        path: '/users',
        handler: 'getUsers',
        line: 1
      };

      const response = generator['generateResponseExample'](collectionEndpoint);
      expect(Array.isArray(response)).toBe(true);
    });

    it('should generate object responses for item endpoints', () => {
      const itemEndpoint: ApiEndpointInfo = {
        method: 'GET',
        path: '/users/:id',
        handler: 'getUserById',
        line: 1
      };

      const response = generator['generateResponseExample'](itemEndpoint);
      expect(Array.isArray(response)).toBe(false);
      expect(response.id).toBeDefined();
    });

    it('should generate appropriate responses for DELETE', () => {
      const deleteEndpoint: ApiEndpointInfo = {
        method: 'DELETE',
        path: '/users/:id',
        handler: 'deleteUser',
        line: 1
      };

      const response = generator['generateResponseExample'](deleteEndpoint);
      expect(response.message).toBe('Deleted successfully');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty analysis', () => {
      const emptyAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Empty API',
          languages: []
        },
        structure: {
          directories: [],
          files: [],
          entryPoints: [],
          testFiles: [],
          configFiles: []
        },
        files: new Map(),
        lastUpdated: new Date()
      };

      const html = generator.generateInteractiveApiDocs(emptyAnalysis);
      expect(html).toContain('Empty API');
      
      const markdown = generator.generateApiDocsMarkdown(emptyAnalysis);
      expect(markdown).toContain('# API Documentation');
    });

    it('should handle endpoints without descriptions', () => {
      const endpointWithoutDescription: ApiEndpointInfo = {
        method: 'GET',
        path: '/test',
        handler: 'test',
        line: 1
      };

      const examples = generator.generateEndpointExamples(endpointWithoutDescription);
      expect(examples.curl).toBeDefined();
      expect(examples.response).toBeDefined();
    });

    it('should handle endpoints without parameters', () => {
      const simpleEndpoint: ApiEndpointInfo = {
        method: 'GET',
        path: '/health',
        handler: 'healthCheck',
        line: 1
      };

      const examples = generator.generateEndpointExamples(simpleEndpoint);
      expect(examples.curl).not.toContain(':');
      expect(examples.curl).not.toContain('{');
    });
  });

  describe('HTML generation helpers', () => {
    it('should generate unique endpoint IDs', () => {
      const endpoint1: ApiEndpointInfo = {
        method: 'GET',
        path: '/users',
        handler: 'getUsers',
        line: 1
      };
      
      const endpoint2: ApiEndpointInfo = {
        method: 'POST',
        path: '/users',
        handler: 'createUser',
        line: 2
      };

      const id1 = generator['getEndpointId'](endpoint1);
      const id2 = generator['getEndpointId'](endpoint2);
      
      expect(id1).not.toBe(id2);
      expect(id1).toBe('get--users');
      expect(id2).toBe('post--users');
    });

    it('should include proper CSS classes for HTTP methods', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('method-get');
      expect(html).toContain('method-post');
    });

    it('should include JavaScript for interactivity', () => {
      const html = generator.generateInteractiveApiDocs(mockAnalysis);
      
      expect(html).toContain('function showTab');
      expect(html).toContain('function copyToClipboard');
      expect(html).toContain('function downloadSpec');
    });
  });
});
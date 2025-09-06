import { describe, it, expect, beforeEach } from '@jest/globals';
import { OpenAPIGenerator } from '../../src/generators/openapi-generator.js';
import { ProjectAnalysis, ApiEndpointInfo } from '../../src/types.js';

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    generator = new OpenAPIGenerator();
    
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
      },
      {
        method: 'PUT',
        path: '/users/:id',
        handler: 'updateUser',
        line: 25,
        parameters: [
          {
            name: 'id',
            type: 'string',
            optional: false
          }
        ]
      },
      {
        method: 'DELETE',
        path: '/users/:id',
        handler: 'deleteUser',
        line: 30
      }
    ];

    mockAnalysis = {
      metadata: {
        name: 'Test API',
        version: '1.0.0',
        description: 'A test API for unit testing',
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

  describe('OpenAPI specification generation', () => {
    it('should generate valid OpenAPI 3.0 specification', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info).toMatchObject({
        title: 'Test API',
        version: '1.0.0',
        description: 'A test API for unit testing'
      });
      expect(spec.paths).toBeDefined();
      expect(spec.components).toBeDefined();
    });

    it('should generate correct paths from endpoints', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      expect(spec.paths).toHaveProperty('/users');
      expect(spec.paths).toHaveProperty('/users/{id}');
      
      // Check GET /users
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get!.summary).toBe('Get users');
      expect(spec.paths['/users'].get!.description).toBe('Get all users');
      
      // Check POST /users
      expect(spec.paths['/users'].post).toBeDefined();
      expect(spec.paths['/users'].post!.requestBody).toBeDefined();
      
      // Check GET /users/{id}
      expect(spec.paths['/users/{id}'].get).toBeDefined();
      expect(spec.paths['/users/{id}'].get!.parameters).toHaveLength(1);
      expect(spec.paths['/users/{id}'].get!.parameters![0].name).toBe('id');
      expect(spec.paths['/users/{id}'].get!.parameters![0].in).toBe('path');
    });

    it('should generate appropriate responses for different methods', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      // GET should return 200
      expect(spec.paths['/users'].get!.responses).toHaveProperty('200');
      
      // POST should return 201
      expect(spec.paths['/users'].post!.responses).toHaveProperty('201');
      
      // DELETE should return 204
      expect(spec.paths['/users/{id}'].delete!.responses).toHaveProperty('204');
      
      // All should have error responses
      expect(spec.paths['/users'].get!.responses).toHaveProperty('400');
      expect(spec.paths['/users'].get!.responses).toHaveProperty('500');
    });

    it('should generate request bodies for POST/PUT/PATCH methods', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      // POST should have request body
      expect(spec.paths['/users'].post!.requestBody).toBeDefined();
      expect(spec.paths['/users'].post!.requestBody!.content).toHaveProperty('application/json');
      
      // PUT should have request body
      expect(spec.paths['/users/{id}'].put!.requestBody).toBeDefined();
      
      // GET should not have request body
      expect(spec.paths['/users'].get!.requestBody).toBeUndefined();
    });

    it('should generate operation IDs', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      expect(spec.paths['/users'].get!.operationId).toBe('get_users');
      expect(spec.paths['/users'].post!.operationId).toBe('post_users');
      expect(spec.paths['/users/{id}'].get!.operationId).toBe('get_users_id');
    });

    it('should generate tags for grouping', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      expect(spec.paths['/users'].get!.tags).toEqual(['users']);
      expect(spec.paths['/users/{id}'].get!.tags).toEqual(['users']);
    });
  });

  describe('Parameter handling', () => {
    it('should convert Express-style parameters to OpenAPI format', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      const getUserByIdParams = spec.paths['/users/{id}'].get!.parameters!;
      expect(getUserByIdParams).toHaveLength(1);
      expect(getUserByIdParams[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
        description: 'User ID',
        schema: { type: 'string' }
      });
    });

    it('should add common query parameters for collection endpoints', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      const getUsersParams = spec.paths['/users'].get!.parameters!;
      const limitParam = getUsersParams.find(p => p.name === 'limit');
      const offsetParam = getUsersParams.find(p => p.name === 'offset');
      
      expect(limitParam).toBeDefined();
      expect(limitParam!.in).toBe('query');
      expect(limitParam!.required).toBe(false);
      
      expect(offsetParam).toBeDefined();
      expect(offsetParam!.in).toBe('query');
    });

    it('should filter out framework-specific parameters', () => {
      const endpointWithFrameworkParams: ApiEndpointInfo = {
        method: 'GET',
        path: '/test',
        handler: 'test',
        line: 1,
        parameters: [
          { name: 'req', type: 'Request', optional: false },
          { name: 'res', type: 'Response', optional: false },
          { name: 'next', type: 'NextFunction', optional: false },
          { name: 'userId', type: 'string', optional: false }
        ]
      };

      const testAnalysis = {
        ...mockAnalysis,
        files: new Map([
          ['test.ts', {
            functions: [],
            classes: [],
            interfaces: [],
            exports: [],
            imports: [],
            comments: [],
            todos: [],
            apiEndpoints: [endpointWithFrameworkParams]
          }]
        ])
      };

      const spec = generator.generateOpenAPISpec(testAnalysis);
      const params = spec.paths['/test'].get!.parameters!;
      
      // Should only include userId, not req/res/next
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('userId');
    });
  });

  describe('Schema generation', () => {
    it('should generate appropriate schemas from TypeScript types', () => {
      const stringSchema = generator['generateSchemaFromType']('string');
      expect(stringSchema).toEqual({ type: 'string' });
      
      const numberSchema = generator['generateSchemaFromType']('number');
      expect(numberSchema).toEqual({ type: 'integer' });
      
      const booleanSchema = generator['generateSchemaFromType']('boolean');
      expect(booleanSchema).toEqual({ type: 'boolean' });
      
      const arraySchema = generator['generateSchemaFromType']('string[]');
      expect(arraySchema).toEqual({ type: 'array', items: { type: 'string' } });
    });

    it('should generate request and response schemas', () => {
      const spec = generator.generateOpenAPISpec(mockAnalysis);
      
      const postRequestBody = spec.paths['/users'].post!.requestBody!;
      const requestSchema = postRequestBody.content['application/json'].schema;
      
      expect(requestSchema.type).toBe('object');
      expect(requestSchema.properties).toBeDefined();
      expect(requestSchema.required).toContain('name');
      
      const getResponse = spec.paths['/users'].get!.responses['200'];
      const responseSchema = getResponse.content!['application/json'].schema;
      
      expect(responseSchema.type).toBe('array');
      expect(responseSchema.items).toBeDefined();
    });
  });

  describe('JSON and YAML output', () => {
    it('should generate valid JSON', () => {
      const json = generator.generateOpenAPIJson(mockAnalysis);
      
      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsed = JSON.parse(json);
      expect(parsed.openapi).toBe('3.0.3');
      expect(parsed.info.title).toBe('Test API');
    });

    it('should generate valid YAML', () => {
      const yaml = generator.generateOpenAPIYaml(mockAnalysis);
      
      expect(yaml).toContain('openapi: 3.0.3');
      expect(yaml).toContain('title: Test API');
      expect(yaml).toContain('paths:');
      expect(yaml).toContain('/users:');
    });

    it('should handle special characters in YAML', () => {
      const analysisWithSpecialChars = {
        ...mockAnalysis,
        metadata: {
          ...mockAnalysis.metadata,
          description: 'API with: special # characters\nand newlines'
        }
      };

      const yaml = generator.generateOpenAPIYaml(analysisWithSpecialChars);
      expect(yaml).toContain('"API with: special # characters\\nand newlines"');
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

      const spec = generator.generateOpenAPISpec(emptyAnalysis);
      
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.paths).toEqual({});
      expect(spec.info.title).toBe('Empty API');
    });

    it('should handle endpoints without descriptions', () => {
      const endpointWithoutDescription: ApiEndpointInfo = {
        method: 'GET',
        path: '/test',
        handler: 'test',
        line: 1
      };

      const testAnalysis = {
        ...mockAnalysis,
        files: new Map([
          ['test.ts', {
            functions: [],
            classes: [],
            interfaces: [],
            exports: [],
            imports: [],
            comments: [],
            todos: [],
            apiEndpoints: [endpointWithoutDescription]
          }]
        ])
      };

      const spec = generator.generateOpenAPISpec(testAnalysis);
      
      expect(spec.paths['/test'].get!.description).toBe('GET /test - Handled by test');
    });

    it('should handle complex path patterns', () => {
      const complexEndpoint: ApiEndpointInfo = {
        method: 'GET',
        path: '/api/v1/users/:userId/posts/:postId/comments',
        handler: 'getComments',
        line: 1
      };

      const testAnalysis = {
        ...mockAnalysis,
        files: new Map([
          ['test.ts', {
            functions: [],
            classes: [],
            interfaces: [],
            exports: [],
            imports: [],
            comments: [],
            todos: [],
            apiEndpoints: [complexEndpoint]
          }]
        ])
      };

      const spec = generator.generateOpenAPISpec(testAnalysis);
      
      expect(spec.paths).toHaveProperty('/api/v1/users/{userId}/posts/{postId}/comments');
      expect(spec.paths['/api/v1/users/{userId}/posts/{postId}/comments'].get!.tags).toEqual(['api']);
    });
  });
});
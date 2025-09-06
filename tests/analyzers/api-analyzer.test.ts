import { describe, it, expect, beforeEach } from '@jest/globals';
import { ApiAnalyzer } from '../../dist/analyzers/api-analyzer.js';

describe('ApiAnalyzer', () => {
  let analyzer: ApiAnalyzer;

  beforeEach(() => {
    analyzer = new ApiAnalyzer();
  });

  describe('Express.js endpoint detection', () => {
    it('should detect basic Express routes', () => {
      const code = `
        const express = require('express');
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
        
        app.post('/users', (req, res) => {
          res.status(201).json({ id: 1 });
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        handler: 'anonymous'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'POST',
        path: '/users',
        handler: 'anonymous'
      });
    });

    it('should detect routes with path parameters', () => {
      const code = `
        app.get('/users/:id', getUserById);
        app.put('/users/:id/posts/:postId', updateUserPost);
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/users/:id',
        handler: 'getUserById'
      });
      expect(endpoints[0].parameters).toEqual([
        expect.objectContaining({
          name: 'id',
          type: 'string',
          optional: false
        })
      ]);
      
      expect(endpoints[1].parameters).toHaveLength(2);
      expect(endpoints[1].parameters![0].name).toBe('id');
      expect(endpoints[1].parameters![1].name).toBe('postId');
    });

    it('should detect routes with middleware', () => {
      const code = `
        app.get('/protected', authenticate, authorize, (req, res) => {
          res.json({ data: 'secret' });
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].description).toContain('authenticate');
      expect(endpoints[0].description).toContain('authorize');
    });

    it('should detect router-based routes', () => {
      const code = `
        const router = express.Router();
        
        router.get('/profile', getProfile);
        router.delete('/account', deleteAccount);
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/profile'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'DELETE',
        path: '/account'
      });
    });
  });

  describe('Fastify endpoint detection', () => {
    it('should detect Fastify route objects', () => {
      const code = `
        fastify.route({
          method: 'GET',
          url: '/api/users',
          handler: async (request, reply) => {
            return { users: [] };
          }
        });
        
        fastify.route({
          method: 'POST',
          url: '/api/users/:id',
          handler: createUser
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/api/users',
        handler: 'anonymous'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'POST',
        path: '/api/users/:id',
        handler: 'createUser'
      });
    });
  });

  describe('NestJS decorator detection', () => {
    it('should detect NestJS controller methods', () => {
      const code = `
        @Controller('users')
        export class UsersController {
          @Get()
          findAll(): User[] {
            return [];
          }
          
          @Get(':id')
          findOne(@Param('id') id: string): User {
            return {};
          }
          
          @Post()
          create(@Body() createUserDto: CreateUserDto): User {
            return {};
          }
        }
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.ts', code);
      
      expect(endpoints).toHaveLength(3);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '',
        handler: 'findAll'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'GET',
        path: ':id',
        handler: 'findOne'
      });
      expect(endpoints[2]).toMatchObject({
        method: 'POST',
        path: '',
        handler: 'create'
      });
    });
  });

  describe('Generic API pattern detection', () => {
    it('should detect Flask-style routes', () => {
      const code = `
        @app.route('/api/users', methods=['GET'])
        def get_users():
            return jsonify([])
            
        @app.route('/api/users/<int:user_id>', methods=['PUT'])
        def update_user(user_id):
            return jsonify({})
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.py', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/api/users'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'PUT',
        path: '/api/users/<int:user_id>'
      });
    });

    it('should detect FastAPI-style routes', () => {
      const code = `
        @app.get("/items/")
        async def read_items():
            return []
            
        @app.post("/items/{item_id}")
        async def create_item(item_id: int):
            return {}
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.py', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        method: 'GET',
        path: '/items/'
      });
      expect(endpoints[1]).toMatchObject({
        method: 'POST',
        path: '/items/{item_id}'
      });
    });
  });

  describe('Parameter extraction', () => {
    it('should extract path parameters from Express routes', () => {
      const code = `
        app.get('/users/:userId/posts/:postId', (req, res) => {
          const { userId, postId } = req.params;
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints[0].parameters).toHaveLength(4); // userId, postId, req, res
      
      // Check path parameters
      const pathParams = endpoints[0].parameters!.filter(p => 
        ['userId', 'postId'].includes(p.name)
      );
      expect(pathParams).toHaveLength(2);
      expect(pathParams[0]).toMatchObject({
        name: 'userId',
        type: 'string',
        optional: false
      });
      expect(pathParams[1]).toMatchObject({
        name: 'postId',
        type: 'string',
        optional: false
      });
    });

    it('should extract parameters from Fastify-style paths', () => {
      const code = `
        fastify.route({
          method: 'GET',
          url: '/api/users/{userId}/posts/{postId}',
          handler: getPost
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints[0].parameters).toHaveLength(2);
      expect(endpoints[0].parameters![0].name).toBe('userId');
      expect(endpoints[0].parameters![1].name).toBe('postId');
    });

    it('should extract handler parameters', () => {
      const code = `
        app.get('/test', (req, res, next) => {
          res.json({});
        });
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      // Should include req, res, next parameters
      const handlerParams = endpoints[0].parameters?.filter(p => 
        ['req', 'res', 'next'].includes(p.name)
      );
      expect(handlerParams).toHaveLength(3);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed code gracefully', () => {
      const malformedCode = `
        app.get('/test', function(req, res {
          // Missing closing parenthesis
        });
      `;

      expect(() => {
        analyzer.analyzeApiEndpoints('test.js', malformedCode);
      }).not.toThrow();
    });

    it('should handle empty files', () => {
      const endpoints = analyzer.analyzeApiEndpoints('empty.js', '');
      expect(endpoints).toEqual([]);
    });

    it('should handle files with no API endpoints', () => {
      const code = `
        const utils = require('./utils');
        
        function helper() {
          return 'not an endpoint';
        }
      `;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      expect(endpoints).toEqual([]);
    });
  });

  describe('Line number tracking', () => {
    it('should track correct line numbers for endpoints', () => {
      const code = `// Line 1
// Line 2
app.get('/first', handler1);
// Line 4
// Line 5
app.post('/second', handler2);`;

      const endpoints = analyzer.analyzeApiEndpoints('test.js', code);
      
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].line).toBe(3);
      expect(endpoints[1].line).toBe(6);
    });
  });
});
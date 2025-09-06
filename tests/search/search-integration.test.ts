/**
 * Search Integration Tests
 * Tests the complete search functionality including server endpoints and real-time features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { WebServer } from '../../src/web/web-server.js';
import { SearchService } from '../../src/search/search-service.js';
import { ProjectAnalysis } from '../../src/types.js';

describe('Search Integration', () => {
  let webServer: WebServer;
  let app: any;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(async () => {
    // Create mock analysis data
    mockAnalysis = {
      projectRoot: '/test/project',
      files: new Map([
        ['src/user.ts', {
          functions: [
            {
              name: 'getUserData',
              startLine: 10,
              endLine: 20,
              parameters: [{ name: 'userId', type: 'string', optional: false }],
              returnType: 'Promise<User>',
              description: 'Fetches user data from the database',
              isAsync: true,
              isExported: true,
              visibility: 'public'
            }
          ],
          classes: [
            {
              name: 'UserService',
              startLine: 40,
              endLine: 100,
              description: 'Service for managing user operations',
              isExported: true,
              methods: [],
              properties: [],
              extends: undefined,
              implements: []
            }
          ],
          interfaces: [],
          types: [],
          variables: [],
          imports: [],
          exports: [],
          comments: [
            {
              content: 'TODO: Add user validation',
              startLine: 15,
              endLine: 15,
              type: 'line'
            }
          ],
          todos: [
            {
              type: 'TODO',
              content: 'Add user validation',
              line: 15,
              file: 'src/user.ts'
            }
          ],
          apiEndpoints: [
            {
              method: 'GET',
              path: '/api/users/:id',
              line: 60,
              description: 'Get user by ID',
              parameters: [{ name: 'id', type: 'string', required: true }],
              responses: { '200': 'User', '404': 'Not Found' }
            }
          ],
          dependencies: [],
          language: 'typescript',
          filePath: 'src/user.ts',
          lastModified: new Date(),
          size: 1000,
          complexity: {
            cyclomatic: 5,
            cognitive: 3,
            maintainability: 80
          }
        }]
      ]),
      metadata: {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project for search integration',
        languages: ['typescript'],
        framework: 'express',
        dependencies: []
      },
      lastAnalyzed: new Date()
    };

    // Create web server
    webServer = new WebServer({
      port: 0, // Use random port for testing
      host: 'localhost',
      enableSearch: true
    });

    app = webServer.getApp();
    
    // Update with mock analysis
    webServer.updateDocumentation(mockAnalysis, {
      html: '<html>Test Documentation</html>',
      markdown: '# Test Documentation'
    });
  });

  afterEach(async () => {
    if (webServer) {
      await webServer.stop();
    }
  });

  describe('Search API Endpoints', () => {
    it('should perform basic search via POST /api/search', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'user' })
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.query).toEqual({ query: 'user' });
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.statistics).toBeDefined();
    });

    it('should handle empty search query', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '' })
        .expect(200);

      expect(response.body.results).toEqual([]);
      expect(response.body.suggestions).toEqual([]);
    });

    it('should support advanced search filters', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'user',
          type: 'function',
          language: 'typescript',
          caseSensitive: false
        })
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(response.body.query.type).toBe('function');
      expect(response.body.query.language).toBe('typescript');
    });

    it('should handle search errors gracefully', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '[invalid regex', regex: true })
        .expect(200); // Should not return 500, but handle gracefully

      expect(response.body.results).toBeDefined();
    });

    it('should support legacy GET search endpoint', async () => {
      const response = await request(app)
        .get('/api/search?q=user')
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(response.body.query).toBe('user');
    });
  });

  describe('Search Suggestions API', () => {
    it('should provide search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=get&limit=5')
        .expect(200);

      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty suggestion query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=')
        .expect(200);

      expect(response.body.suggestions).toEqual([]);
    });

    it('should respect suggestion limit', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=u&limit=3')
        .expect(200);

      expect(response.body.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Search History API', () => {
    it('should retrieve search history', async () => {
      // Perform some searches first
      await request(app)
        .post('/api/search')
        .send({ query: 'user' });

      await request(app)
        .post('/api/search')
        .send({ query: 'service' });

      const response = await request(app)
        .get('/api/search/history')
        .expect(200);

      expect(response.body.history).toBeDefined();
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('should clear search history', async () => {
      // Perform a search first
      await request(app)
        .post('/api/search')
        .send({ query: 'user' });

      // Clear history
      await request(app)
        .delete('/api/search/history')
        .expect(200);

      // Verify history is cleared
      const response = await request(app)
        .get('/api/search/history')
        .expect(200);

      expect(response.body.history).toEqual([]);
    });
  });

  describe('Saved Searches API', () => {
    it('should save and retrieve searches', async () => {
      // Save a search
      const saveResponse = await request(app)
        .post('/api/search/saved')
        .send({
          name: 'User Functions',
          query: { query: 'user', type: 'function' }
        })
        .expect(200);

      expect(saveResponse.body.id).toBeDefined();
      expect(saveResponse.body.success).toBe(true);

      // Retrieve saved searches
      const getResponse = await request(app)
        .get('/api/search/saved')
        .expect(200);

      expect(getResponse.body.savedSearches).toBeDefined();
      expect(getResponse.body.savedSearches.length).toBe(1);
      expect(getResponse.body.savedSearches[0].name).toBe('User Functions');
    });

    it('should execute saved searches', async () => {
      // Save a search
      const saveResponse = await request(app)
        .post('/api/search/saved')
        .send({
          name: 'User Search',
          query: { query: 'user' }
        });

      const savedId = saveResponse.body.id;

      // Execute saved search
      const executeResponse = await request(app)
        .post(`/api/search/saved/${savedId}/execute`)
        .expect(200);

      expect(executeResponse.body.results).toBeDefined();
      expect(executeResponse.body.results.length).toBeGreaterThan(0);
    });

    it('should delete saved searches', async () => {
      // Save a search
      const saveResponse = await request(app)
        .post('/api/search/saved')
        .send({
          name: 'Test Search',
          query: { query: 'test' }
        });

      const savedId = saveResponse.body.id;

      // Delete saved search
      await request(app)
        .delete(`/api/search/saved/${savedId}`)
        .expect(200);

      // Verify it's deleted
      const getResponse = await request(app)
        .get('/api/search/saved')
        .expect(200);

      expect(getResponse.body.savedSearches.length).toBe(0);
    });

    it('should handle invalid saved search execution', async () => {
      const response = await request(app)
        .post('/api/search/saved/invalid-id/execute')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should handle invalid saved search data', async () => {
      const response = await request(app)
        .post('/api/search/saved')
        .send({
          // Missing name and query
        })
        .expect(400);

      expect(response.body.error).toContain('Failed to save search');
    });
  });

  describe('Search Performance', () => {
    it('should complete searches within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/search')
        .send({ query: 'user' })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent searches', async () => {
      const searches = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/search')
          .send({ query: `search${i}` })
      );

      const responses = await Promise.all(searches);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
      });
    });

    it('should limit result count for performance', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'e' }) // Very broad search
        .expect(200);

      expect(response.body.results.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Search Result Quality', () => {
    it('should return relevant results for function search', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'getUserData', type: 'function' })
        .expect(200);

      const results = response.body.results;
      expect(results.length).toBeGreaterThan(0);
      
      const getUserDataResult = results.find((r: any) => r.title === 'getUserData');
      expect(getUserDataResult).toBeDefined();
      expect(getUserDataResult.type).toBe('function');
      expect(getUserDataResult.file).toBe('src/user.ts');
      expect(getUserDataResult.line).toBe(10);
    });

    it('should return relevant results for class search', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'UserService', type: 'class' })
        .expect(200);

      const results = response.body.results;
      const userServiceResult = results.find((r: any) => r.title === 'UserService');
      
      expect(userServiceResult).toBeDefined();
      expect(userServiceResult.type).toBe('class');
      expect(userServiceResult.description).toContain('Service for managing user operations');
    });

    it('should return relevant results for API search', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'users', type: 'api' })
        .expect(200);

      const results = response.body.results;
      const apiResult = results.find((r: any) => r.type === 'api');
      
      expect(apiResult).toBeDefined();
      expect(apiResult.title).toContain('/api/users');
    });

    it('should return relevant results for content search', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'validation', type: 'content' })
        .expect(200);

      const results = response.body.results;
      const contentResult = results.find((r: any) => r.type === 'content');
      
      expect(contentResult).toBeDefined();
      expect(contentResult.snippet).toContain('validation');
    });

    it('should provide proper highlighting information', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'getUserData' })
        .expect(200);

      const results = response.body.results;
      const result = results.find((r: any) => r.title === 'getUserData');
      
      expect(result.highlights).toBeDefined();
      expect(Array.isArray(result.highlights)).toBe(true);
      expect(result.highlights.length).toBeGreaterThan(0);
    });

    it('should rank results by relevance', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'user' })
        .expect(200);

      const results = response.body.results;
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('Search Statistics', () => {
    it('should provide search statistics', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'user' })
        .expect(200);

      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalSymbols).toBeGreaterThan(0);
      expect(response.body.statistics.totalContent).toBeGreaterThan(0);
      expect(response.body.statistics.totalFiles).toBeGreaterThan(0);
    });
  });

  describe('Real-time Search Updates', () => {
    it('should update search index when documentation changes', async () => {
      // Initial search
      const initialResponse = await request(app)
        .post('/api/search')
        .send({ query: 'newFunction' })
        .expect(200);

      expect(initialResponse.body.results.length).toBe(0);

      // Update analysis with new function
      const updatedAnalysis = { ...mockAnalysis };
      updatedAnalysis.files.get('src/user.ts')!.functions.push({
        name: 'newFunction',
        startLine: 200,
        endLine: 210,
        parameters: [],
        returnType: 'void',
        description: 'A new function added for testing',
        isAsync: false,
        isExported: true,
        visibility: 'public'
      });

      webServer.updateDocumentation(updatedAnalysis, {
        html: '<html>Updated Documentation</html>',
        markdown: '# Updated Documentation'
      });

      // Search again
      const updatedResponse = await request(app)
        .post('/api/search')
        .send({ query: 'newFunction' })
        .expect(200);

      expect(updatedResponse.body.results.length).toBeGreaterThan(0);
      expect(updatedResponse.body.results[0].title).toBe('newFunction');
    });
  });

  describe('Search Error Handling', () => {
    it('should handle malformed search requests', async () => {
      const response = await request(app)
        .post('/api/search')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle missing search service', async () => {
      // Create server without search service
      const serverWithoutSearch = new WebServer({
        port: 0,
        enableSearch: false
      });

      const appWithoutSearch = serverWithoutSearch.getApp();

      const response = await request(appWithoutSearch)
        .post('/api/search')
        .send({ query: 'test' })
        .expect(404);

      await serverWithoutSearch.stop();
    });
  });

  describe('Search Security', () => {
    it('should sanitize search queries', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '<script>alert("xss")</script>' })
        .expect(200);

      // Should not execute script, just return empty results
      expect(response.body.results).toBeDefined();
    });

    it('should limit query length', async () => {
      const longQuery = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/api/search')
        .send({ query: longQuery })
        .expect(200);

      // Should handle gracefully without crashing
      expect(response.body.results).toBeDefined();
    });

    it('should prevent regex DoS attacks', async () => {
      const maliciousRegex = '(a+)+$';
      
      const response = await request(app)
        .post('/api/search')
        .send({ query: maliciousRegex, regex: true })
        .expect(200);

      // Should complete quickly without hanging
      expect(response.body.results).toBeDefined();
    });
  });
});
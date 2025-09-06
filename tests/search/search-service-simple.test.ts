/**
 * Simple Search Service Tests
 * Basic tests for search functionality
 */

import { SearchService, SearchQuery } from '../../src/search/search-service';
import { ProjectAnalysis } from '../../src/types';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    searchService = new SearchService();
    
    // Create simple mock analysis data
    mockAnalysis = {
      files: new Map([
        ['src/user.ts', {
          functions: [
            {
              name: 'getUserData',
              startLine: 10,
              endLine: 20,
              parameters: [
                { name: 'userId', type: 'string', optional: false }
              ],
              returnType: 'Promise<User>',
              description: 'Fetches user data from the database',
              isAsync: true,
              isExported: true
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
          imports: [],
          exports: [],
          comments: [
            {
              content: 'TODO: Add user validation',
              startLine: 15,
              endLine: 15,
              type: 'single'
            }
          ],
          todos: [
            {
              type: 'TODO',
              content: 'Add user validation',
              line: 15
            }
          ],
          apiEndpoints: [
            {
              method: 'GET',
              path: '/api/users/:id',
              line: 60,
              handler: 'getUserById',
              description: 'Get user by ID',
              parameters: [{ name: 'id', type: 'string', optional: false }]
            }
          ]
        }]
      ]),
      metadata: {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project for search functionality',
        languages: ['typescript'],
        framework: 'express'
      },
      structure: {
        directories: ['src'],
        files: ['src/user.ts'],
        entryPoints: ['src/index.ts'],
        testFiles: [],
        configFiles: []
      },
      lastUpdated: new Date()
    };

    searchService.updateIndex(mockAnalysis);
  });

  describe('Basic Search Functionality', () => {
    it('should perform basic text search', () => {
      const query: SearchQuery = { query: 'user' };
      const results = searchService.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.title.toLowerCase().includes('user'))).toBe(true);
    });

    it('should return empty results for empty query', () => {
      const query: SearchQuery = { query: '' };
      const results = searchService.search(query);

      expect(results).toHaveLength(0);
    });

    it('should handle case-sensitive search', () => {
      const query: SearchQuery = { 
        query: 'User', 
        caseSensitive: true 
      };
      const results = searchService.search(query);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Symbol Search', () => {
    it('should search for functions only', () => {
      const query: SearchQuery = { 
        query: 'getUserData', 
        type: 'function' 
      };
      const results = searchService.search(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.type === 'function')).toBe(true);
    });

    it('should search for classes only', () => {
      const query: SearchQuery = { 
        query: 'UserService', 
        type: 'class' 
      };
      const results = searchService.search(query);

      expect(results.some(r => r.type === 'class')).toBe(true);
    });
  });

  describe('Search Suggestions', () => {
    it('should provide relevant suggestions', () => {
      const suggestions = searchService.getSuggestions('get', 5);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Search History', () => {
    it('should track search history', () => {
      const query1: SearchQuery = { query: 'user' };
      const query2: SearchQuery = { query: 'service' };

      searchService.search(query1);
      searchService.search(query2);

      const history = searchService.getHistory();
      expect(history.length).toBe(2);
    });

    it('should clear search history', () => {
      const query: SearchQuery = { query: 'test' };
      searchService.search(query);

      expect(searchService.getHistory().length).toBe(1);

      searchService.clearHistory();
      expect(searchService.getHistory().length).toBe(0);
    });
  });

  describe('Saved Searches', () => {
    it('should save and retrieve searches', () => {
      const query: SearchQuery = { 
        query: 'user', 
        type: 'function'
      };

      const id = searchService.saveSearch('User Functions', query);
      expect(id).toBeDefined();

      const savedSearches = searchService.getSavedSearches();
      expect(savedSearches.length).toBe(1);
      expect(savedSearches[0].name).toBe('User Functions');
    });

    it('should execute saved searches', () => {
      const query: SearchQuery = { query: 'getUserData' };
      const id = searchService.saveSearch('Get User Data', query);

      const results = searchService.executeSavedSearch(id);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should delete saved searches', () => {
      const query: SearchQuery = { query: 'test' };
      const id = searchService.saveSearch('Test Search', query);

      expect(searchService.getSavedSearches().length).toBe(1);

      searchService.deleteSavedSearch(id);
      expect(searchService.getSavedSearches().length).toBe(0);
    });
  });

  describe('Search Statistics', () => {
    it('should provide search statistics', () => {
      const stats = searchService.getStatistics();

      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(typeof stats.indexSize).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle search without analysis', () => {
      const emptySearchService = new SearchService();
      const query: SearchQuery = { query: 'test' };
      const results = emptySearchService.search(query);

      expect(results).toHaveLength(0);
    });

    it('should handle invalid saved search execution', () => {
      expect(() => {
        searchService.executeSavedSearch('invalid-id');
      }).toThrow('Saved search with id invalid-id not found');
    });
  });
});
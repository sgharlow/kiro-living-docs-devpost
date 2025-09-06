import { WebServer, WebServerConfig } from '../../src/web/web-server';
import { ProjectAnalysis, ProjectMetadata, ProjectStructure } from '../../src/types';
import WebSocket from 'ws';

describe('WebServer Integration Tests', () => {
  let webServer: WebServer;
  let serverPort: number;

  beforeAll(async () => {
    const config: WebServerConfig = {
      port: 0, // Use random available port
      host: 'localhost',
      enableSearch: true
    };
    
    webServer = new WebServer(config);
    await webServer.start();
    
    const address = (webServer as any).server.address();
    serverPort = address.port;
  });

  afterAll(async () => {
    await webServer.stop();
  });

  describe('Real-time Documentation Updates', () => {
    it('should handle WebSocket connections and real-time updates', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      let messageCount = 0;

      ws.on('open', () => {
        // Create mock analysis data
        const mockAnalysis: ProjectAnalysis = {
          metadata: {
            name: 'integration-test-project',
            languages: ['typescript'],
            version: '1.0.0',
            description: 'Test project for integration testing'
          } as ProjectMetadata,
          structure: {
            directories: ['src', 'tests'],
            files: ['src/index.ts', 'src/utils.ts', 'tests/index.test.ts'],
            entryPoints: ['src/index.ts'],
            testFiles: ['tests/index.test.ts'],
            configFiles: ['package.json', 'tsconfig.json']
          } as ProjectStructure,
          files: new Map([
            ['src/index.ts', {
              functions: [
                {
                  name: 'main',
                  parameters: [],
                  returnType: 'void',
                  description: 'Main entry point of the application',
                  isAsync: true,
                  isExported: false,
                  startLine: 1,
                  endLine: 10
                }
              ],
              classes: [],
              interfaces: [],
              exports: [],
              imports: [],
              comments: [],
              todos: []
            }],
            ['src/utils.ts', {
              functions: [
                {
                  name: 'formatDate',
                  parameters: [
                    {
                      name: 'date',
                      type: 'Date',
                      optional: false,
                      defaultValue: undefined,
                      description: 'The date to format'
                    }
                  ],
                  returnType: 'string',
                  description: 'Formats a date to ISO string',
                  isAsync: false,
                  isExported: true,
                  startLine: 5,
                  endLine: 7
                }
              ],
              classes: [],
              interfaces: [],
              exports: [],
              imports: [],
              comments: [],
              todos: []
            }]
          ]),
          lastUpdated: new Date()
        };

        // Trigger documentation update
        webServer.updateDocumentation(mockAnalysis);
      });

      ws.on('message', (data: Buffer) => {
        messageCount++;
        const message = JSON.parse(data.toString());

        if (messageCount === 1) {
          // First message should be the documentation update
          expect(message.type).toBe('update');
          expect(message.data.analysis).toBeDefined();
          expect(message.data.analysis.metadata.name).toBe('integration-test-project');
          expect(message.data.analysis.files).toBeDefined();
          
          // Test search functionality via WebSocket
          ws.send(JSON.stringify({
            type: 'search',
            query: 'format'
          }));
        } else if (messageCount === 2) {
          // Second message should be search results
          expect(message.type).toBe('search');
          expect(message.data.results).toBeDefined();
          expect(message.data.results.length).toBeGreaterThan(0);
          expect(message.data.results[0].name).toBe('formatDate');
          expect(message.data.query).toBe('format');
          
          // Test ping functionality
          ws.send(JSON.stringify({
            type: 'ping'
          }));
        } else if (messageCount === 3) {
          // Third message should be pong response
          expect(message.type).toBe('status');
          expect(message.data.status).toBe('pong');
          
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    }, 10000); // 10 second timeout for integration test

    it('should handle multiple concurrent WebSocket connections', (done) => {
      const connections: WebSocket[] = [];
      const connectionCount = 3;
      let connectedCount = 0;
      let messageCount = 0;

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${serverPort}`);
        connections.push(ws);

        ws.on('open', () => {
          connectedCount++;
          
          if (connectedCount === connectionCount) {
            // All connections are open, trigger an update
            const mockAnalysis: ProjectAnalysis = {
              metadata: {
                name: 'multi-client-test',
                languages: ['typescript']
              } as ProjectMetadata,
              structure: {} as ProjectStructure,
              files: new Map(),
              lastUpdated: new Date()
            };

            webServer.updateDocumentation(mockAnalysis);
          }
        });

        ws.on('message', (data: Buffer) => {
          messageCount++;
          const message = JSON.parse(data.toString());
          
          expect(message.type).toBe('update');
          expect(message.data.analysis.metadata.name).toBe('multi-client-test');
          
          // Close connection after receiving message
          ws.close();
          
          // Check if all connections received the message
          if (messageCount === connectionCount) {
            // Verify client count decreased
            setTimeout(() => {
              expect(webServer.getClientCount()).toBe(0);
              done();
            }, 100);
          }
        });

        ws.on('error', (error) => {
          done(error);
        });
      }
    }, 10000);
  });

  describe('HTTP API Integration', () => {
    it('should provide complete API workflow', async () => {
      // 1. Initially no documentation
      let response = await fetch(`http://localhost:${serverPort}/api/documentation`);
      expect(response.status).toBe(404);

      // 2. Add documentation
      const mockAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'api-workflow-test',
          languages: ['typescript', 'javascript'],
          version: '2.0.0'
        } as ProjectMetadata,
        structure: {
          directories: ['src'],
          files: ['src/api.ts'],
          entryPoints: ['src/api.ts'],
          testFiles: [],
          configFiles: []
        } as ProjectStructure,
        files: new Map([
          ['src/api.ts', {
            functions: [
              {
                name: 'createUser',
                parameters: [
                  {
                    name: 'userData',
                    type: 'UserData',
                    optional: false,
                    defaultValue: undefined,
                    description: 'User information'
                  }
                ],
                returnType: 'Promise<User>',
                description: 'Creates a new user in the system',
                isAsync: true,
                isExported: true,
                startLine: 10,
                endLine: 25
              },
              {
                name: 'deleteUser',
                parameters: [
                  {
                    name: 'userId',
                    type: 'string',
                    optional: false,
                    defaultValue: undefined,
                    description: 'ID of the user to delete'
                  }
                ],
                returnType: 'Promise<void>',
                description: 'Deletes a user from the system',
                isAsync: true,
                isExported: true,
                startLine: 27,
                endLine: 35
              }
            ],
            classes: [],
            interfaces: [
              {
                name: 'UserData',
                properties: [
                  {
                    name: 'email',
                    type: 'string',
                    optional: false,
                    readonly: false,
                    description: 'User email address'
                  },
                  {
                    name: 'name',
                    type: 'string',
                    optional: false,
                    readonly: false,
                    description: 'User full name'
                  }
                ],
                methods: [],
                description: 'Interface for user creation data',
                isExported: true,
                startLine: 1,
                endLine: 8
              }
            ],
            exports: [],
            imports: [],
            comments: [],
            todos: []
          }]
        ]),
        lastUpdated: new Date()
      };

      webServer.updateDocumentation(mockAnalysis);

      // 3. Documentation should now be available
      response = await fetch(`http://localhost:${serverPort}/api/documentation`);
      expect(response.status).toBe(200);
      
      const docData = await response.json() as any;
      expect(docData.analysis.metadata.name).toBe('api-workflow-test');
      expect(docData.analysis.metadata.languages).toEqual(['typescript', 'javascript']);

      // 4. Search should work
      response = await fetch(`http://localhost:${serverPort}/api/search?q=user`);
      expect(response.status).toBe(200);
      
      const searchData = await response.json() as any;
      expect(searchData.results.length).toBeGreaterThan(0);
      
      const userResults = searchData.results.filter((r: any) => 
        r.name.toLowerCase().includes('user')
      );
      expect(userResults.length).toBeGreaterThan(0);

      // 5. Specific searches
      response = await fetch(`http://localhost:${serverPort}/api/search?q=createUser`);
      expect(response.status).toBe(200);
      
      const createUserSearch = await response.json() as any;
      expect(createUserSearch.results).toHaveLength(1);
      expect(createUserSearch.results[0].name).toBe('createUser');
      expect(createUserSearch.results[0].type).toBe('function');

      // 6. Health check should reflect the documentation
      response = await fetch(`http://localhost:${serverPort}/api/health`);
      expect(response.status).toBe(200);
      
      const healthData = await response.json() as any;
      expect(healthData.status).toBe('healthy');
      expect(healthData.hasDocumentation).toBe(true);
    });

    it('should handle CORS headers correctly', async () => {
      const response = await fetch(`http://localhost:${serverPort}/api/health`);
      
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid documentation updates', async () => {
      const updateCount = 10;
      const updates: Promise<void>[] = [];

      for (let i = 0; i < updateCount; i++) {
        const mockAnalysis: ProjectAnalysis = {
          metadata: {
            name: `performance-test-${i}`,
            languages: ['typescript']
          } as ProjectMetadata,
          structure: {} as ProjectStructure,
          files: new Map(),
          lastUpdated: new Date()
        };

        updates.push(Promise.resolve(webServer.updateDocumentation(mockAnalysis)));
      }

      // All updates should complete without errors
      await Promise.all(updates);

      // Server should still be responsive
      const response = await fetch(`http://localhost:${serverPort}/api/health`);
      expect(response.status).toBe(200);
    });

    it('should handle large search queries efficiently', async () => {
      // Create analysis with many items
      const largeAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'large-project',
          languages: ['typescript']
        } as ProjectMetadata,
        structure: {} as ProjectStructure,
        files: new Map(),
        lastUpdated: new Date()
      };

      // Add many functions to simulate a large codebase
      const manyFunctions = Array.from({ length: 200 }, (_, i) => ({
        name: `function${i}`,
        parameters: [],
        returnType: 'void',
        description: `Function number ${i} for testing search performance`,
        isAsync: false,
        isExported: true,
        startLine: i * 2,
        endLine: i * 2 + 1
      }));

      largeAnalysis.files.set('src/large.ts', {
        functions: manyFunctions,
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: []
      });

      webServer.updateDocumentation(largeAnalysis);

      // Search should complete quickly and return limited results
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${serverPort}/api/search?q=function`);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      const searchData = await response.json() as any;
      expect(searchData.results.length).toBeLessThanOrEqual(50); // Should limit results
    });
  });
});
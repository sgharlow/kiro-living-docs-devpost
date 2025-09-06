#!/usr/bin/env node

/**
 * Test script for the web server functionality
 * This script demonstrates the web server capabilities and can be used for manual testing
 */

const { WebServer } = require('../dist/web/web-server');

async function testWebServer() {
  console.log('🚀 Starting Web Server Test...\n');

  // Create web server configuration
  const config = {
    port: 3001,
    host: 'localhost',
    enableSearch: true
  };

  const webServer = new WebServer(config);

  try {
    // Start the server
    console.log('📡 Starting web server...');
    await webServer.start();
    console.log(`✅ Web server started on http://localhost:${config.port}\n`);

    // Create mock documentation data
    const mockAnalysis = {
      metadata: {
        name: 'test-documentation-project',
        version: '1.0.0',
        description: 'A test project for demonstrating living documentation',
        languages: ['typescript', 'javascript'],
        framework: 'Node.js'
      },
      structure: {
        directories: ['src', 'tests', 'docs'],
        files: [
          'src/index.ts',
          'src/utils/helpers.ts',
          'src/services/api.ts',
          'tests/index.test.ts',
          'package.json',
          'README.md'
        ],
        entryPoints: ['src/index.ts'],
        testFiles: ['tests/index.test.ts'],
        configFiles: ['package.json', 'tsconfig.json']
      },
      files: new Map([
        ['src/index.ts', {
          functions: [
            {
              name: 'main',
              parameters: [],
              returnType: 'Promise<void>',
              description: 'Main application entry point that initializes the server',
              isAsync: true,
              isExported: false,
              startLine: 10,
              endLine: 25
            },
            {
              name: 'initializeApp',
              parameters: [
                {
                  name: 'config',
                  type: 'AppConfig',
                  optional: false,
                  defaultValue: undefined,
                  description: 'Application configuration object'
                }
              ],
              returnType: 'Promise<Application>',
              description: 'Initializes the application with the provided configuration',
              isAsync: true,
              isExported: true,
              startLine: 27,
              endLine: 45
            }
          ],
          classes: [
            {
              name: 'Application',
              methods: [
                {
                  name: 'start',
                  parameters: [],
                  returnType: 'Promise<void>',
                  description: 'Starts the application server',
                  isAsync: true,
                  isExported: false,
                  startLine: 52,
                  endLine: 60
                },
                {
                  name: 'stop',
                  parameters: [],
                  returnType: 'Promise<void>',
                  description: 'Gracefully stops the application server',
                  isAsync: true,
                  isExported: false,
                  startLine: 62,
                  endLine: 70
                }
              ],
              properties: [
                {
                  name: 'config',
                  type: 'AppConfig',
                  optional: false,
                  readonly: true,
                  description: 'Application configuration'
                },
                {
                  name: 'server',
                  type: 'Server',
                  optional: true,
                  readonly: false,
                  description: 'HTTP server instance'
                }
              ],
              description: 'Main application class that manages the server lifecycle',
              isExported: true,
              startLine: 47,
              endLine: 75
            }
          ],
          interfaces: [
            {
              name: 'AppConfig',
              properties: [
                {
                  name: 'port',
                  type: 'number',
                  optional: false,
                  readonly: false,
                  description: 'Server port number'
                },
                {
                  name: 'host',
                  type: 'string',
                  optional: true,
                  readonly: false,
                  description: 'Server host address'
                },
                {
                  name: 'debug',
                  type: 'boolean',
                  optional: true,
                  readonly: false,
                  description: 'Enable debug mode'
                }
              ],
              methods: [],
              description: 'Configuration interface for the application',
              isExported: true,
              startLine: 1,
              endLine: 8
            }
          ],
          exports: [],
          imports: [],
          comments: [],
          todos: []
        }],
        ['src/utils/helpers.ts', {
          functions: [
            {
              name: 'formatDate',
              parameters: [
                {
                  name: 'date',
                  type: 'Date',
                  optional: false,
                  defaultValue: undefined,
                  description: 'Date to format'
                },
                {
                  name: 'format',
                  type: 'string',
                  optional: true,
                  defaultValue: "'ISO'",
                  description: 'Format type (ISO, US, EU)'
                }
              ],
              returnType: 'string',
              description: 'Formats a date according to the specified format',
              isAsync: false,
              isExported: true,
              startLine: 5,
              endLine: 15
            },
            {
              name: 'validateEmail',
              parameters: [
                {
                  name: 'email',
                  type: 'string',
                  optional: false,
                  defaultValue: undefined,
                  description: 'Email address to validate'
                }
              ],
              returnType: 'boolean',
              description: 'Validates an email address using regex pattern',
              isAsync: false,
              isExported: true,
              startLine: 17,
              endLine: 22
            },
            {
              name: 'generateId',
              parameters: [
                {
                  name: 'prefix',
                  type: 'string',
                  optional: true,
                  defaultValue: "'id'",
                  description: 'Prefix for the generated ID'
                }
              ],
              returnType: 'string',
              description: 'Generates a unique identifier with optional prefix',
              isAsync: false,
              isExported: true,
              startLine: 24,
              endLine: 28
            }
          ],
          classes: [],
          interfaces: [],
          exports: [],
          imports: [],
          comments: [],
          todos: [
            {
              content: 'Add more comprehensive email validation',
              type: 'TODO',
              line: 20,
              author: 'developer'
            },
            {
              content: 'Consider using UUID library for ID generation',
              type: 'FIXME',
              line: 26,
              author: 'reviewer'
            }
          ]
        }],
        ['src/services/api.ts', {
          functions: [
            {
              name: 'createApiClient',
              parameters: [
                {
                  name: 'baseUrl',
                  type: 'string',
                  optional: false,
                  defaultValue: undefined,
                  description: 'Base URL for the API'
                },
                {
                  name: 'options',
                  type: 'ApiClientOptions',
                  optional: true,
                  defaultValue: undefined,
                  description: 'Additional client options'
                }
              ],
              returnType: 'ApiClient',
              description: 'Creates a new API client instance with the specified configuration',
              isAsync: false,
              isExported: true,
              startLine: 15,
              endLine: 25
            }
          ],
          classes: [
            {
              name: 'ApiClient',
              methods: [
                {
                  name: 'get',
                  parameters: [
                    {
                      name: 'endpoint',
                      type: 'string',
                      optional: false,
                      defaultValue: undefined,
                      description: 'API endpoint path'
                    }
                  ],
                  returnType: 'Promise<ApiResponse>',
                  description: 'Performs a GET request to the specified endpoint',
                  isAsync: true,
                  isExported: false,
                  startLine: 35,
                  endLine: 42
                },
                {
                  name: 'post',
                  parameters: [
                    {
                      name: 'endpoint',
                      type: 'string',
                      optional: false,
                      defaultValue: undefined,
                      description: 'API endpoint path'
                    },
                    {
                      name: 'data',
                      type: 'any',
                      optional: true,
                      defaultValue: undefined,
                      description: 'Request body data'
                    }
                  ],
                  returnType: 'Promise<ApiResponse>',
                  description: 'Performs a POST request to the specified endpoint',
                  isAsync: true,
                  isExported: false,
                  startLine: 44,
                  endLine: 52
                }
              ],
              properties: [
                {
                  name: 'baseUrl',
                  type: 'string',
                  optional: false,
                  readonly: true,
                  description: 'Base URL for all requests'
                },
                {
                  name: 'timeout',
                  type: 'number',
                  optional: false,
                  readonly: false,
                  description: 'Request timeout in milliseconds'
                }
              ],
              description: 'HTTP client for making API requests with built-in error handling',
              isExported: true,
              startLine: 27,
              endLine: 55
            }
          ],
          interfaces: [
            {
              name: 'ApiClientOptions',
              properties: [
                {
                  name: 'timeout',
                  type: 'number',
                  optional: true,
                  readonly: false,
                  description: 'Request timeout in milliseconds'
                },
                {
                  name: 'headers',
                  type: 'Record<string, string>',
                  optional: true,
                  readonly: false,
                  description: 'Default headers for all requests'
                }
              ],
              methods: [],
              description: 'Configuration options for API client',
              isExported: true,
              startLine: 1,
              endLine: 8
            },
            {
              name: 'ApiResponse',
              properties: [
                {
                  name: 'data',
                  type: 'any',
                  optional: false,
                  readonly: false,
                  description: 'Response data'
                },
                {
                  name: 'status',
                  type: 'number',
                  optional: false,
                  readonly: false,
                  description: 'HTTP status code'
                },
                {
                  name: 'headers',
                  type: 'Record<string, string>',
                  optional: false,
                  readonly: false,
                  description: 'Response headers'
                }
              ],
              methods: [],
              description: 'Standard API response structure',
              isExported: true,
              startLine: 10,
              endLine: 18
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

    // Update documentation
    console.log('📝 Updating documentation with mock data...');
    webServer.updateDocumentation(mockAnalysis);
    console.log('✅ Documentation updated successfully\n');

    // Test API endpoints
    console.log('🔍 Testing API endpoints...');
    
    // Test health endpoint
    try {
      const healthResponse = await fetch(`http://localhost:${config.port}/api/health`);
      const healthData = await healthResponse.json();
      console.log('✅ Health check:', healthData.status, `(${healthData.clients} clients connected)`);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }

    // Test documentation endpoint
    try {
      const docResponse = await fetch(`http://localhost:${config.port}/api/documentation`);
      const docData = await docResponse.json();
      console.log('✅ Documentation API:', docData.analysis.metadata.name);
    } catch (error) {
      console.log('❌ Documentation API failed:', error.message);
    }

    // Test search endpoint
    try {
      const searchResponse = await fetch(`http://localhost:${config.port}/api/search?q=format`);
      const searchData = await searchResponse.json();
      console.log('✅ Search API:', `${searchData.results.length} results for "format"`);
    } catch (error) {
      console.log('❌ Search API failed:', error.message);
    }

    console.log('\n🌐 Web interface available at:');
    console.log(`   http://localhost:${config.port}`);
    console.log('\n📋 Available endpoints:');
    console.log(`   GET  http://localhost:${config.port}/`);
    console.log(`   GET  http://localhost:${config.port}/api/health`);
    console.log(`   GET  http://localhost:${config.port}/api/documentation`);
    console.log(`   GET  http://localhost:${config.port}/api/search?q=<query>`);
    console.log('\n🔌 WebSocket endpoint:');
    console.log(`   ws://localhost:${config.port}`);

    console.log('\n⏱️  Server will run for 30 seconds for testing...');
    console.log('   Open your browser to test the web interface');
    console.log('   Press Ctrl+C to stop early\n');

    // Keep server running for testing
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Stop the server
    console.log('\n🛑 Stopping web server...');
    await webServer.stop();
    console.log('✅ Web server stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received interrupt signal, shutting down gracefully...');
  process.exit(0);
});

// Run the test
testWebServer().catch(console.error);
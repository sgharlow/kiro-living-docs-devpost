/**
 * Unit tests for the Living Documentation Generator
 * 
 * Tests core functionality including code analysis, documentation generation,
 * and real-time update capabilities across multiple languages.
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const { DocumentationGenerator } = require('../../src/generators/documentation-generator');
const { TypeScriptAnalyzer } = require('../../src/analyzers/typescript-analyzer');
const { PythonAnalyzer } = require('../../src/analyzers/python-analyzer');
const { GoAnalyzer } = require('../../src/analyzers/go-analyzer');

describe('DocumentationGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, '../../temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    generator = new DocumentationGenerator({
      outputDir: tempDir,
      languages: ['typescript', 'python', 'go'],
      features: {
        realTimeUpdates: true,
        gitIntegration: true,
        apiDocumentation: true
      }
    });
  });

  afterEach(async () => {
    // Clean up temporary files
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('TypeScript Analysis', () => {
    test('should extract function documentation from TypeScript files', async () => {
      const tsCode = `
        /**
         * Calculates the sum of two numbers
         * @param a First number
         * @param b Second number
         * @returns The sum of a and b
         */
        export function add(a: number, b: number): number {
          return a + b;
        }

        /**
         * User interface for authentication
         */
        export interface User {
          id: string;
          email: string;
          name: string;
        }
      `;

      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, tsCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0]).toMatchObject({
        name: 'add',
        parameters: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' }
        ],
        returnType: 'number',
        description: 'Calculates the sum of two numbers'
      });

      expect(analysis.interfaces).toHaveLength(1);
      expect(analysis.interfaces[0]).toMatchObject({
        name: 'User',
        description: 'User interface for authentication',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'name', type: 'string' }
        ]
      });
    });

    test('should detect API endpoints in Express routes', async () => {
      const routeCode = `
        import { Router } from 'express';
        const router = Router();

        /**
         * Get all users
         * @route GET /users
         * @returns Array of user objects
         */
        router.get('/users', async (req, res) => {
          // Implementation
        });

        /**
         * Create a new user
         * @route POST /users
         * @param {CreateUserRequest} body User creation data
         * @returns Created user object
         */
        router.post('/users', async (req, res) => {
          // Implementation
        });
      `;

      const testFile = path.join(tempDir, 'routes.ts');
      await fs.writeFile(testFile, routeCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.apiEndpoints).toHaveLength(2);
      expect(analysis.apiEndpoints[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        description: 'Get all users',
        returns: 'Array of user objects'
      });
      expect(analysis.apiEndpoints[1]).toMatchObject({
        method: 'POST',
        path: '/users',
        description: 'Create a new user',
        parameters: [{ name: 'body', type: 'CreateUserRequest' }]
      });
    });

    test('should handle React component documentation', async () => {
      const componentCode = `
        import React from 'react';

        interface UserProfileProps {
          /** User ID to display */
          userId: string;
          /** Whether profile is editable */
          editable?: boolean;
          /** Callback when user is updated */
          onUserUpdate?: (user: User) => void;
        }

        /**
         * UserProfile component displays user information
         * 
         * @example
         * <UserProfile userId="123" editable={true} />
         */
        export const UserProfile: React.FC<UserProfileProps> = ({ userId, editable, onUserUpdate }) => {
          return <div>User Profile</div>;
        };
      `;

      const testFile = path.join(tempDir, 'UserProfile.tsx');
      await fs.writeFile(testFile, componentCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.components).toHaveLength(1);
      expect(analysis.components[0]).toMatchObject({
        name: 'UserProfile',
        type: 'React.FC',
        description: 'UserProfile component displays user information',
        props: [
          { name: 'userId', type: 'string', required: true, description: 'User ID to display' },
          { name: 'editable', type: 'boolean', required: false, description: 'Whether profile is editable' },
          { name: 'onUserUpdate', type: '(user: User) => void', required: false, description: 'Callback when user is updated' }
        ]
      });
    });
  });

  describe('Python Analysis', () => {
    test('should extract function documentation from Python files', async () => {
      const pythonCode = `
        def calculate_user_score(sessions: int, pageviews: int, duration: float) -> float:
            """
            Calculate user engagement score based on activity metrics
            
            Args:
                sessions (int): Number of user sessions
                pageviews (int): Total page views
                duration (float): Average session duration in seconds
                
            Returns:
                float: Engagement score between 0.0 and 1.0
                
            Example:
                >>> calculate_user_score(10, 50, 300.0)
                0.75
            """
            if sessions == 0:
                return 0.0
            
            # Normalize metrics and calculate weighted score
            session_score = min(sessions / 20, 1.0)
            pageview_score = min((pageviews / sessions) / 5, 1.0)
            duration_score = min(duration / 600, 1.0)
            
            return (session_score * 0.4 + pageview_score * 0.3 + duration_score * 0.3)

        class UserAnalytics:
            """
            User analytics data model with metrics calculation
            
            Attributes:
                user_id (str): Unique user identifier
                sessions (int): Number of sessions
                pageviews (int): Total page views
            """
            
            def __init__(self, user_id: str, sessions: int = 0, pageviews: int = 0):
                self.user_id = user_id
                self.sessions = sessions
                self.pageviews = pageviews
      `;

      const testFile = path.join(tempDir, 'analytics.py');
      await fs.writeFile(testFile, pythonCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0]).toMatchObject({
        name: 'calculate_user_score',
        parameters: [
          { name: 'sessions', type: 'int' },
          { name: 'pageviews', type: 'int' },
          { name: 'duration', type: 'float' }
        ],
        returnType: 'float',
        description: 'Calculate user engagement score based on activity metrics'
      });

      expect(analysis.classes).toHaveLength(1);
      expect(analysis.classes[0]).toMatchObject({
        name: 'UserAnalytics',
        description: 'User analytics data model with metrics calculation',
        methods: [
          { name: '__init__', parameters: expect.any(Array) }
        ]
      });
    });

    test('should detect Flask API endpoints', async () => {
      const flaskCode = `
        from flask import Flask, request, jsonify
        
        app = Flask(__name__)
        
        @app.route('/api/users/<user_id>', methods=['GET'])
        def get_user(user_id: str):
            """
            Retrieve user information by ID
            
            Args:
                user_id (str): Unique user identifier
                
            Returns:
                dict: User data with profile information
                
            Raises:
                404: If user not found
            """
            pass
            
        @app.route('/api/analytics', methods=['POST'])
        def generate_analytics():
            """
            Generate analytics report
            
            Request Body:
                user_ids (List[str]): Users to include in report
                date_range (dict): Start and end dates
                
            Returns:
                dict: Analytics report with metrics and charts
            """
            pass
      `;

      const testFile = path.join(tempDir, 'app.py');
      await fs.writeFile(testFile, flaskCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.apiEndpoints).toHaveLength(2);
      expect(analysis.apiEndpoints[0]).toMatchObject({
        method: 'GET',
        path: '/api/users/<user_id>',
        description: 'Retrieve user information by ID',
        parameters: [{ name: 'user_id', type: 'str' }]
      });
      expect(analysis.apiEndpoints[1]).toMatchObject({
        method: 'POST',
        path: '/api/analytics',
        description: 'Generate analytics report'
      });
    });
  });

  describe('Go Analysis', () => {
    test('should extract function documentation from Go files', async () => {
      const goCode = `
        package main
        
        import (
            "fmt"
            "time"
        )
        
        // User represents a system user with authentication data
        type User struct {
            ID       string    \`json:"id"\`
            Email    string    \`json:"email"\`
            Name     string    \`json:"name"\`
            Role     UserRole  \`json:"role"\`
            IsActive bool      \`json:"is_active"\`
            CreatedAt time.Time \`json:"created_at"\`
        }
        
        // UserRole defines user permission levels
        type UserRole string
        
        const (
            RoleAdmin UserRole = "admin"
            RoleUser  UserRole = "user"
        )
        
        // CreateUser creates a new user account with validation
        //
        // Parameters:
        //   - email: User's email address (must be unique)
        //   - name: User's full name
        //   - role: User's permission level
        //
        // Returns:
        //   - *User: Created user object
        //   - error: Error if creation fails
        //
        // Example:
        //   user, err := CreateUser("john@example.com", "John Doe", RoleUser)
        func CreateUser(email, name string, role UserRole) (*User, error) {
            if email == "" || name == "" {
                return nil, fmt.Errorf("email and name are required")
            }
            
            return &User{
                ID:       generateID(),
                Email:    email,
                Name:     name,
                Role:     role,
                IsActive: true,
                CreatedAt: time.Now(),
            }, nil
        }
      `;

      const testFile = path.join(tempDir, 'user.go');
      await fs.writeFile(testFile, goCode);

      const analysis = await generator.analyzeFile(testFile);

      expect(analysis.types).toHaveLength(2);
      expect(analysis.types[0]).toMatchObject({
        name: 'User',
        type: 'struct',
        description: 'User represents a system user with authentication data',
        fields: expect.arrayContaining([
          { name: 'ID', type: 'string' },
          { name: 'Email', type: 'string' },
          { name: 'Name', type: 'string' }
        ])
      });

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0]).toMatchObject({
        name: 'CreateUser',
        parameters: [
          { name: 'email', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'role', type: 'UserRole' }
        ],
        returns: [
          { type: '*User' },
          { type: 'error' }
        ],
        description: 'CreateUser creates a new user account with validation'
      });
    });
  });

  describe('Documentation Generation', () => {
    test('should generate markdown documentation', async () => {
      const mockAnalysis = {
        projectName: 'Test Project',
        functions: [
          {
            name: 'testFunction',
            description: 'A test function',
            parameters: [{ name: 'param1', type: 'string' }],
            returnType: 'boolean'
          }
        ],
        classes: [],
        interfaces: [],
        apiEndpoints: []
      };

      const markdown = await generator.generateMarkdown(mockAnalysis);

      expect(markdown).toContain('# Test Project');
      expect(markdown).toContain('## Functions');
      expect(markdown).toContain('### testFunction');
      expect(markdown).toContain('A test function');
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('- `param1` (string)');
      expect(markdown).toContain('**Returns:** boolean');
    });

    test('should generate web documentation with search', async () => {
      const mockAnalysis = {
        projectName: 'Test Project',
        functions: [
          { name: 'func1', description: 'First function' },
          { name: 'func2', description: 'Second function' }
        ]
      };

      const webAssets = await generator.generateWebDocumentation(mockAnalysis);

      expect(webAssets.html).toContain('<title>Test Project - Documentation</title>');
      expect(webAssets.html).toContain('func1');
      expect(webAssets.html).toContain('func2');
      expect(webAssets.javascript).toContain('searchFunctions');
      expect(webAssets.css).toContain('.documentation-container');
    });

    test('should generate OpenAPI specification for API endpoints', async () => {
      const mockAnalysis = {
        projectName: 'API Service',
        apiEndpoints: [
          {
            method: 'GET',
            path: '/users/{id}',
            description: 'Get user by ID',
            parameters: [{ name: 'id', type: 'string', in: 'path' }],
            responses: { '200': { description: 'User object' } }
          },
          {
            method: 'POST',
            path: '/users',
            description: 'Create user',
            requestBody: { type: 'CreateUserRequest' },
            responses: { '201': { description: 'Created user' } }
          }
        ]
      };

      const openApiSpec = await generator.generateOpenAPISpec(mockAnalysis);

      expect(openApiSpec.info.title).toBe('API Service');
      expect(openApiSpec.paths['/users/{id}'].get).toBeDefined();
      expect(openApiSpec.paths['/users'].post).toBeDefined();
      expect(openApiSpec.paths['/users/{id}'].get.description).toBe('Get user by ID');
    });
  });

  describe('Real-time Updates', () => {
    test('should detect file changes and trigger updates', async () => {
      const testFile = path.join(tempDir, 'watched.ts');
      await fs.writeFile(testFile, 'export function test() {}');

      let updateTriggered = false;
      generator.onDocumentationUpdate(() => {
        updateTriggered = true;
      });

      await generator.watchFile(testFile);

      // Simulate file change
      await fs.writeFile(testFile, 'export function test() { return true; }');

      // Wait for file watcher to detect change
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(updateTriggered).toBe(true);
    });

    test('should handle incremental updates efficiently', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(tempDir, 'file2.ts');

      await fs.writeFile(file1, 'export function func1() {}');
      await fs.writeFile(file2, 'export function func2() {}');

      const initialAnalysis = await generator.analyzeProject(tempDir);
      expect(initialAnalysis.functions).toHaveLength(2);

      // Update only one file
      await fs.writeFile(file1, 'export function func1() {} export function func1b() {}');

      const incrementalUpdate = await generator.getIncrementalUpdate(file1);
      expect(incrementalUpdate.addedFunctions).toHaveLength(1);
      expect(incrementalUpdate.addedFunctions[0].name).toBe('func1b');
    });
  });

  describe('Performance', () => {
    test('should handle large projects efficiently', async () => {
      // Create multiple test files
      const fileCount = 50;
      const files = [];

      for (let i = 0; i < fileCount; i++) {
        const fileName = `file${i}.ts`;
        const filePath = path.join(tempDir, fileName);
        const content = `
          export function func${i}(param: string): number {
            return ${i};
          }
          
          export interface Interface${i} {
            id: string;
            value: number;
          }
        `;
        await fs.writeFile(filePath, content);
        files.push(filePath);
      }

      const startTime = Date.now();
      const analysis = await generator.analyzeProject(tempDir);
      const analysisTime = Date.now() - startTime;

      expect(analysis.functions).toHaveLength(fileCount);
      expect(analysis.interfaces).toHaveLength(fileCount);
      expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should cache analysis results', async () => {
      const testFile = path.join(tempDir, 'cached.ts');
      await fs.writeFile(testFile, 'export function test() {}');

      // First analysis
      const startTime1 = Date.now();
      const analysis1 = await generator.analyzeFile(testFile);
      const time1 = Date.now() - startTime1;

      // Second analysis (should use cache)
      const startTime2 = Date.now();
      const analysis2 = await generator.analyzeFile(testFile);
      const time2 = Date.now() - startTime2;

      expect(analysis1).toEqual(analysis2);
      expect(time2).toBeLessThan(time1 * 0.5); // Cached version should be much faster
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed code gracefully', async () => {
      const malformedCode = `
        export function broken(param {
          // Missing closing parenthesis and type
          return param;
        }
        
        interface Incomplete {
          // Missing closing brace
      `;

      const testFile = path.join(tempDir, 'malformed.ts');
      await fs.writeFile(testFile, malformedCode);

      const analysis = await generator.analyzeFile(testFile);

      // Should return partial results instead of throwing
      expect(analysis).toBeDefined();
      expect(analysis.errors).toBeDefined();
      expect(analysis.errors.length).toBeGreaterThan(0);
    });

    test('should continue processing other files when one fails', async () => {
      const goodFile = path.join(tempDir, 'good.ts');
      const badFile = path.join(tempDir, 'bad.ts');

      await fs.writeFile(goodFile, 'export function good() {}');
      await fs.writeFile(badFile, 'invalid syntax here');

      const analysis = await generator.analyzeProject(tempDir);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0].name).toBe('good');
      expect(analysis.errors).toBeDefined();
    });
  });
});
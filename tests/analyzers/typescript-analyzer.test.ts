import { TypeScriptAnalyzer } from '../../src/analyzers/typescript-analyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TypeScriptAnalyzer', () => {
  let analyzer: TypeScriptAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    analyzer = new TypeScriptAnalyzer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-analyzer-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Function Analysis', () => {
    it('should extract basic function information', async () => {
      const testCode = `
        /**
         * Calculates the sum of two numbers
         * @param a First number
         * @param b Second number
         * @returns The sum
         */
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(1);
      const func = result.functions[0];
      expect(func.name).toBe('add');
      expect(func.isExported).toBe(true);
      expect(func.isAsync).toBe(false);
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0].name).toBe('a');
      expect(func.parameters[0].type).toBe('number');
      expect(func.parameters[1].name).toBe('b');
      expect(func.parameters[1].type).toBe('number');
      expect(func.returnType).toBe('number');
    });

    it('should handle async functions', async () => {
      const testCode = `
        async function fetchData(): Promise<string> {
          return 'data';
        }
      `;

      const testFile = path.join(tempDir, 'async.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
      expect(result.functions[0].returnType).toBe('Promise<string>');
    });

    it('should handle optional parameters', async () => {
      const testCode = `
        function greet(name: string, greeting?: string): string {
          return \`\${greeting || 'Hello'} \${name}\`;
        }
      `;

      const testFile = path.join(tempDir, 'optional.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(1);
      const func = result.functions[0];
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0].optional).toBe(false);
      expect(func.parameters[1].optional).toBe(true);
    });
  });

  describe('Class Analysis', () => {
    it('should extract class information with methods and properties', async () => {
      const testCode = `
        /**
         * A simple calculator class
         */
        export class Calculator {
          private result: number = 0;
          
          /**
           * Add a number to the result
           */
          add(value: number): void {
            this.result += value;
          }
          
          getResult(): number {
            return this.result;
          }
        }
      `;

      const testFile = path.join(tempDir, 'class.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.classes).toHaveLength(1);
      const cls = result.classes[0];
      expect(cls.name).toBe('Calculator');
      expect(cls.isExported).toBe(true);
      expect(cls.methods).toHaveLength(2);
      expect(cls.properties).toHaveLength(1);
      
      const addMethod = cls.methods.find((m: any) => m.name === 'add');
      expect(addMethod).toBeDefined();
      expect(addMethod?.parameters).toHaveLength(1);
      expect(addMethod?.returnType).toBe('void');
      
      const property = cls.properties[0];
      expect(property.name).toBe('result');
      expect(property.type).toBe('number');
    });

    it('should handle class inheritance', async () => {
      const testCode = `
        class Animal {
          name: string;
        }
        
        class Dog extends Animal implements Pet {
          breed: string;
        }
        
        interface Pet {
          play(): void;
        }
      `;

      const testFile = path.join(tempDir, 'inheritance.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      const dogClass = result.classes.find((c: any) => c.name === 'Dog');
      expect(dogClass).toBeDefined();
      expect(dogClass?.extends).toBe('Animal');
      expect(dogClass?.implements).toContain('Pet');
    });
  });

  describe('Interface Analysis', () => {
    it('should extract interface information', async () => {
      const testCode = `
        /**
         * User interface
         */
        export interface User {
          id: number;
          name: string;
          email?: string;
          readonly createdAt: Date;
          
          getName(): string;
          setEmail(email: string): void;
        }
      `;

      const testFile = path.join(tempDir, 'interface.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.interfaces).toHaveLength(1);
      const iface = result.interfaces[0];
      expect(iface.name).toBe('User');
      expect(iface.isExported).toBe(true);
      expect(iface.properties).toHaveLength(4);
      expect(iface.methods).toHaveLength(2);
      
      const emailProp = iface.properties.find((p: any) => p.name === 'email');
      expect(emailProp?.optional).toBe(true);
      
      const createdAtProp = iface.properties.find((p: any) => p.name === 'createdAt');
      expect(createdAtProp?.readonly).toBe(true);
    });
  });

  describe('Import/Export Analysis', () => {
    it('should extract import statements', async () => {
      const testCode = `
        import fs from 'fs';
        import { readFile, writeFile } from 'fs/promises';
        import * as path from 'path';
      `;

      const testFile = path.join(tempDir, 'imports.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.imports).toHaveLength(3);
      
      const fsImport = result.imports.find((i: any) => i.source === 'fs');
      expect(fsImport?.isDefault).toBe(true);
      expect(fsImport?.imports).toContain('fs');
      
      const fsPromisesImport = result.imports.find((i: any) => i.source === 'fs/promises');
      expect(fsPromisesImport?.imports).toContain('readFile');
      expect(fsPromisesImport?.imports).toContain('writeFile');
      
      const pathImport = result.imports.find((i: any) => i.source === 'path');
      expect(pathImport?.isNamespace).toBe(true);
    });

    it('should track exports', async () => {
      const testCode = `
        export function helper() {}
        export class MyClass {}
        export interface MyInterface {}
      `;

      const testFile = path.join(tempDir, 'exports.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.exports).toHaveLength(3);
      expect(result.exports.map((e: any) => e.name)).toContain('helper');
      expect(result.exports.map((e: any) => e.name)).toContain('MyClass');
      expect(result.exports.map((e: any) => e.name)).toContain('MyInterface');
    });
  });

  describe('Comment and TODO Analysis', () => {
    it('should extract comments and TODOs', async () => {
      const testCode = `
        // This is a single line comment
        /* This is a multi-line comment */
        
        // TODO: Implement error handling
        function test() {
          // FIXME: This needs optimization
          return true;
        }
      `;

      const testFile = path.join(tempDir, 'comments.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.comments.length).toBeGreaterThan(0);
      expect(result.todos).toHaveLength(2);
      
      const todoItem = result.todos.find((t: any) => t.type === 'TODO');
      expect(todoItem?.content).toContain('Implement error handling');
      
      const fixmeItem = result.todos.find((t: any) => t.type === 'FIXME');
      expect(fixmeItem?.content).toContain('This needs optimization');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed TypeScript gracefully', async () => {
      const testCode = `
        function broken( {
          // Missing closing parenthesis and brace
      `;

      const testFile = path.join(tempDir, 'broken.ts');
      fs.writeFileSync(testFile, testCode);

      // Should not throw, should return empty result
      const result = await analyzer.analyze(testFile);
      
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
      expect(result.classes).toBeDefined();
      expect(result.interfaces).toBeDefined();
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');
      
      // Should not throw, should return empty result
      const result = await analyzer.analyze(nonExistentFile);
      
      expect(result).toBeDefined();
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('API Endpoint Analysis', () => {
    it('should detect Express.js API endpoints', async () => {
      const testCode = `
        import express from 'express';
        const app = express();
        const router = express.Router();
        
        /**
         * Get all users
         */
        app.get('/users', getAllUsers);
        
        // Create a new user
        app.post('/users', createUser);
        
        // Get user by ID
        router.get('/users/:id', (req, res) => {
          res.json({ id: req.params.id });
        });
        
        // Update user
        app.put('/users/:id/profile', updateUserProfile);
        
        function getAllUsers(req, res) {}
        function createUser(req, res) {}
        function updateUserProfile(req, res) {}
      `;

      const testFile = path.join(tempDir, 'api.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      expect(result.apiEndpoints).toHaveLength(4);
      
      const getUsersEndpoint = result.apiEndpoints.find((e: any) => e.path === '/users' && e.method === 'GET');
      expect(getUsersEndpoint).toBeDefined();
      expect(getUsersEndpoint?.handler).toBe('getAllUsers');
      
      const createUserEndpoint = result.apiEndpoints.find((e: any) => e.path === '/users' && e.method === 'POST');
      expect(createUserEndpoint).toBeDefined();
      expect(createUserEndpoint?.handler).toBe('createUser');
      
      const getUserByIdEndpoint = result.apiEndpoints.find((e: any) => e.path === '/users/:id');
      expect(getUserByIdEndpoint).toBeDefined();
      expect(getUserByIdEndpoint?.method).toBe('GET');
      expect(getUserByIdEndpoint?.handler).toBe('anonymous');
      expect(getUserByIdEndpoint?.parameters).toHaveLength(1);
      expect(getUserByIdEndpoint?.parameters?.[0].name).toBe('id');
      
      const updateUserEndpoint = result.apiEndpoints.find((e: any) => e.path === '/users/:id/profile');
      expect(updateUserEndpoint).toBeDefined();
      expect(updateUserEndpoint?.method).toBe('PUT');
      expect(updateUserEndpoint?.parameters).toHaveLength(1);
      expect(updateUserEndpoint?.parameters?.[0].name).toBe('id');
    });
  });

  describe('Real-world TypeScript Features', () => {
    it('should handle complex TypeScript syntax', async () => {
      const testCode = `
        type Status = 'pending' | 'completed' | 'failed';
        
        interface ApiResponse<T> {
          data: T;
          status: Status;
        }
        
        class ApiClient<T = any> {
          async fetch<R>(url: string): Promise<ApiResponse<R>> {
            // Implementation
            return {} as ApiResponse<R>;
          }
        }
        
        export { ApiClient, type ApiResponse, type Status };
      `;

      const testFile = path.join(tempDir, 'complex.ts');
      fs.writeFileSync(testFile, testCode);

      const result = await analyzer.analyze(testFile);

      // Should parse without errors
      expect(result).toBeDefined();
      expect(result.classes.find((c: any) => c.name === 'ApiClient')).toBeDefined();
      expect(result.interfaces.find((i: any) => i.name === 'ApiResponse')).toBeDefined();
    });
  });
});
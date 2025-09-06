import { MarkdownGenerator } from '../../src/generators/markdown-generator';
import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
  ProjectAnalysis,
} from '../../src/types';

describe('MarkdownGenerator', () => {
  let generator: MarkdownGenerator;

  beforeEach(() => {
    generator = new MarkdownGenerator();
  });

  describe('Function Documentation', () => {
    it('should generate documentation for a simple function', async () => {
      const func: FunctionInfo = {
        name: 'add',
        parameters: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false },
        ],
        returnType: 'number',
        description: 'Adds two numbers together',
        isAsync: false,
        isExported: true,
        startLine: 1,
        endLine: 3,
      };

      const analysis: AnalysisResult = {
        functions: [func],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('math.ts', analysis);

      expect(markdown).toContain('# math.ts');
      expect(markdown).toContain('## Functions');
      expect(markdown).toContain('### add (exported)');
      expect(markdown).toContain('Adds two numbers together');
      expect(markdown).toContain('function add(a: number, b: number): number');
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('- **a** `number`');
      expect(markdown).toContain('- **b** `number`');
      expect(markdown).toContain('**Returns:**');
      expect(markdown).toContain('`number`');
    });

    it('should handle async functions with optional parameters', async () => {
      const func: FunctionInfo = {
        name: 'fetchData',
        parameters: [
          { name: 'url', type: 'string', optional: false },
          { name: 'options', type: 'RequestOptions', optional: true, defaultValue: '{}' },
        ],
        returnType: 'Promise<Data>',
        description: 'Fetches data from a URL',
        isAsync: true,
        isExported: false,
        startLine: 5,
        endLine: 10,
      };

      const analysis: AnalysisResult = {
        functions: [func],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('api.ts', analysis);

      expect(markdown).toContain('### fetchData');
      expect(markdown).not.toContain('(exported)');
      expect(markdown).toContain('async function fetchData(url: string, options?: RequestOptions = {})');
      expect(markdown).toContain('- **options** `RequestOptions` (optional)');
    });
  });

  describe('Class Documentation', () => {
    it('should generate documentation for a class with methods and properties', async () => {
      const cls: ClassInfo = {
        name: 'Calculator',
        methods: [
          {
            name: 'add',
            parameters: [{ name: 'value', type: 'number', optional: false }],
            returnType: 'void',
            isAsync: false,
            isExported: false,
            startLine: 5,
            endLine: 7,
          },
          {
            name: 'getResult',
            parameters: [],
            returnType: 'number',
            isAsync: false,
            isExported: false,
            startLine: 9,
            endLine: 11,
          },
        ],
        properties: [
          {
            name: 'result',
            type: 'number',
            optional: false,
            readonly: false,
            description: 'The current calculation result',
          },
        ],
        description: 'A simple calculator class',
        isExported: true,
        startLine: 1,
        endLine: 12,
      };

      const analysis: AnalysisResult = {
        functions: [],
        classes: [cls],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('calculator.ts', analysis);

      expect(markdown).toContain('# calculator.ts');
      expect(markdown).toContain('## Classes');
      expect(markdown).toContain('### Calculator (exported)');
      expect(markdown).toContain('A simple calculator class');
      expect(markdown).toContain('class Calculator');
      expect(markdown).toContain('**Properties:**');
      expect(markdown).toContain('- **result**: number - The current calculation result');
      expect(markdown).toContain('**Methods:**');
      expect(markdown).toContain('- **add**');
      expect(markdown).toContain('add(value: number): void');
      expect(markdown).toContain('- **getResult**');
      expect(markdown).toContain('getResult(): number');
    });

    it('should handle class inheritance', async () => {
      const cls: ClassInfo = {
        name: 'AdvancedCalculator',
        methods: [],
        properties: [],
        extends: 'Calculator',
        implements: ['Serializable', 'Cloneable'],
        description: 'An advanced calculator with more features',
        isExported: true,
        startLine: 1,
        endLine: 5,
      };

      const analysis: AnalysisResult = {
        functions: [],
        classes: [cls],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('advanced.ts', analysis);

      expect(markdown).toContain('class AdvancedCalculator extends Calculator implements Serializable, Cloneable');
    });
  });

  describe('Interface Documentation', () => {
    it('should generate documentation for interfaces', async () => {
      const iface: InterfaceInfo = {
        name: 'User',
        properties: [
          {
            name: 'id',
            type: 'number',
            optional: false,
            readonly: true,
            description: 'Unique user identifier',
          },
          {
            name: 'name',
            type: 'string',
            optional: false,
            readonly: false,
          },
          {
            name: 'email',
            type: 'string',
            optional: true,
            readonly: false,
          },
        ],
        methods: [
          {
            name: 'getName',
            parameters: [],
            returnType: 'string',
            description: 'Gets the user name',
            isAsync: false,
            isExported: false,
            startLine: 6,
            endLine: 6,
          },
        ],
        description: 'Represents a user in the system',
        isExported: true,
        startLine: 1,
        endLine: 7,
      };

      const analysis: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [iface],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('user.ts', analysis);

      expect(markdown).toContain('# user.ts');
      expect(markdown).toContain('## Interfaces');
      expect(markdown).toContain('### User (exported)');
      expect(markdown).toContain('Represents a user in the system');
      expect(markdown).toContain('interface User {');
      expect(markdown).toContain('readonly id: number;');
      expect(markdown).toContain('name: string;');
      expect(markdown).toContain('email?: string;');
      expect(markdown).toContain('getName(): string;');
      expect(markdown).toContain('**Members:**');
      expect(markdown).toContain('- **id**: Unique user identifier');
      expect(markdown).toContain('- **getName()**: Gets the user name');
    });
  });

  describe('Imports and Exports', () => {
    it('should document imports and exports', async () => {
      const analysis: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [
          { name: 'Calculator', type: 'class', isDefault: false },
          { name: 'add', type: 'function', isDefault: false },
        ],
        imports: [
          {
            source: 'fs',
            imports: ['readFile'],
            isDefault: false,
            isNamespace: false,
          },
          {
            source: 'path',
            imports: ['path'],
            isDefault: false,
            isNamespace: true,
          },
        ],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('index.ts', analysis);

      expect(markdown).toContain('## Dependencies');
      expect(markdown).toContain('- **fs** (named): readFile');
      expect(markdown).toContain('- **path** (namespace): path');
      expect(markdown).toContain('## Exports');
      expect(markdown).toContain('- **Calculator** (class)');
      expect(markdown).toContain('- **add** (function)');
    });
  });

  describe('API Endpoints', () => {
    it('should document API endpoints', async () => {
      const analysis: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [
          {
            method: 'GET',
            path: '/users/:id',
            handler: 'getUserById',
            description: 'Get a user by their ID',
            parameters: [
              { name: 'id', type: 'string', optional: false, description: 'User ID' },
            ],
            line: 10,
          },
          {
            method: 'POST',
            path: '/users',
            handler: 'createUser',
            line: 15,
          },
        ],
      };

      const markdown = await generator.generateFileDocumentation('api.ts', analysis);

      expect(markdown).toContain('## API Endpoints');
      expect(markdown).toContain('### GET /users/:id');
      expect(markdown).toContain('Get a user by their ID');
      expect(markdown).toContain('**Handler:** `getUserById`');
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('- **id** `string` - User ID');
      expect(markdown).toContain('### POST /users');
      expect(markdown).toContain('**Handler:** `createUser`');
      expect(markdown).toContain('```http');
      expect(markdown).toContain('GET /users/:id');
      expect(markdown).toContain('POST /users');
    });
  });

  describe('TODOs', () => {
    it('should document TODOs and comments', async () => {
      const analysis: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [
          { type: 'TODO', content: 'Add error handling', line: 15 },
          { type: 'FIXME', content: 'Fix memory leak', line: 23 },
        ],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('buggy.ts', analysis);

      expect(markdown).toContain('## TODOs');
      expect(markdown).toContain('- **TODO** (line 15): Add error handling');
      expect(markdown).toContain('- **FIXME** (line 23): Fix memory leak');
    });
  });

  describe('Table of Contents', () => {
    it('should generate table of contents with proper links', async () => {
      const analysis: AnalysisResult = {
        functions: [
          {
            name: 'myFunction',
            parameters: [],
            isAsync: false,
            isExported: false,
            startLine: 1,
            endLine: 1,
          },
        ],
        classes: [
          {
            name: 'MyClass',
            methods: [],
            properties: [],
            isExported: false,
            startLine: 1,
            endLine: 1,
          },
        ],
        interfaces: [
          {
            name: 'MyInterface',
            properties: [],
            methods: [],
            isExported: false,
            startLine: 1,
            endLine: 1,
          },
        ],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('mixed.ts', analysis);

      expect(markdown).toContain('## Table of Contents');
      expect(markdown).toContain('### Interfaces');
      expect(markdown).toContain('- [MyInterface](#myinterface)');
      expect(markdown).toContain('### Classes');
      expect(markdown).toContain('- [MyClass](#myclass)');
      expect(markdown).toContain('### Functions');
      expect(markdown).toContain('- [myFunction](#myfunction)');
    });
  });

  describe('Project Documentation', () => {
    it('should generate project-level documentation', () => {
      const projectAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'My Project',
          description: 'A sample TypeScript project',
          languages: ['typescript', 'javascript'],
          repository: {
            url: 'https://github.com/user/repo',
            branch: 'main',
          },
        },
        structure: {
          directories: [],
          files: [],
          entryPoints: [],
          testFiles: [],
          configFiles: [],
        },
        files: new Map([
          [
            '/project/src/math.ts',
            {
              functions: [
                {
                  name: 'add',
                  parameters: [],
                  isAsync: false,
                  isExported: true,
                  startLine: 1,
                  endLine: 1,
                },
              ],
              classes: [],
              interfaces: [],
              exports: [],
              imports: [],
              comments: [],
              todos: [],
              apiEndpoints: [],
            },
          ],
          [
            '/project/src/utils.ts',
            {
              functions: [],
              classes: [
                {
                  name: 'Helper',
                  methods: [],
                  properties: [],
                  isExported: true,
                  startLine: 1,
                  endLine: 1,
                },
              ],
              interfaces: [],
              exports: [],
              imports: [],
              comments: [],
              todos: [{ type: 'TODO', content: 'Optimize', line: 5 }],
              apiEndpoints: [],
            },
          ],
        ]),
        lastUpdated: new Date(),
      };

      const result = generator.generateProjectDocumentation(projectAnalysis);

      expect(result.markdown).toContain('# My Project');
      expect(result.markdown).toContain('A sample TypeScript project');
      expect(result.markdown).toContain('## Project Overview');
      expect(result.markdown).toContain('### Statistics');
      expect(result.markdown).toContain('- **Files analyzed**: 2');
      expect(result.markdown).toContain('- **Functions**: 1');
      expect(result.markdown).toContain('- **Classes**: 1');
      expect(result.markdown).toContain('- **Languages**: typescript, javascript');
      expect(result.markdown).toContain('- **TODOs**: 1');
      expect(result.markdown).toContain('## Files');
      expect(result.markdown).toContain('- [math.ts]');
      expect(result.markdown).toContain('- [utils.ts]');
      expect(result.markdown).toContain('## Repository');
      expect(result.markdown).toContain('**URL**: https://github.com/user/repo');
      expect(result.markdown).toContain('**Branch**: main');
      expect(result.markdown).toContain('*Documentation generated on');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty analysis results', async () => {
      const analysis: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('empty.ts', analysis);

      expect(markdown).toContain('# empty.ts');
      expect(markdown).not.toContain('## Overview');
      expect(markdown).not.toContain('## Table of Contents');
      expect(markdown).not.toContain('## Functions');
      expect(markdown).not.toContain('## Classes');
      expect(markdown).not.toContain('## Interfaces');
    });

    it('should handle special characters in names', async () => {
      const func: FunctionInfo = {
        name: 'my-special_function$',
        parameters: [],
        isAsync: false,
        isExported: false,
        startLine: 1,
        endLine: 1,
      };

      const analysis: AnalysisResult = {
        functions: [func],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      const markdown = await generator.generateFileDocumentation('special.ts', analysis);

      expect(markdown).toContain('- [my-special_function$](#my-special-function)');
      expect(markdown).toContain('### my-special_function$');
    });
  });
});
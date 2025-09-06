import { GoAnalyzer } from '../../src/analyzers/go-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('GoAnalyzer', () => {
  let analyzer: GoAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new GoAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'go-analyzer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Package Declaration Analysis', () => {
    it('should analyze a simple Go package', async () => {
      const goCode = `
package main

import "fmt"

// HelloWorld prints a greeting message
func HelloWorld() {
    fmt.Println("Hello, World!")
}
`;

      const testFile = path.join(tempDir, 'main.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('HelloWorld');
      expect(result.functions[0].description).toBe('HelloWorld prints a greeting message');
      expect(result.functions[0].isExported).toBe(true);
    });
  });

  describe('Function Analysis', () => {
    it('should extract function signatures with parameters and return types', async () => {
      const goCode = `
package calculator

// Add performs addition of two integers
func Add(a int, b int) int {
    return a + b
}

// divide is a private function for division
func divide(dividend float64, divisor float64) (float64, error) {
    if divisor == 0 {
        return 0, errors.New("division by zero")
    }
    return dividend / divisor, nil
}
`;

      const testFile = path.join(tempDir, 'calculator.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(2);
      
      // Test exported function
      const addFunc = result.functions.find(f => f.name === 'Add');
      expect(addFunc).toBeDefined();
      expect(addFunc!.isExported).toBe(true);
      expect(addFunc!.parameters).toHaveLength(2);
      expect(addFunc!.parameters[0].name).toBe('a');
      expect(addFunc!.parameters[0].type).toBe('int');
      expect(addFunc!.parameters[1].name).toBe('b');
      expect(addFunc!.parameters[1].type).toBe('int');
      expect(addFunc!.returnType).toBe('int');
      expect(addFunc!.description).toBe('Add performs addition of two integers');

      // Test private function
      const divideFunc = result.functions.find(f => f.name === 'divide');
      expect(divideFunc).toBeDefined();
      expect(divideFunc!.isExported).toBe(false);
      expect(divideFunc!.parameters).toHaveLength(2);
      expect(divideFunc!.returnType).toBe('(float64, error)');
    });

    it('should handle methods with receivers', async () => {
      const goCode = `
package geometry

type Rectangle struct {
    Width  float64
    Height float64
}

// Area calculates the area of the rectangle
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// Scale scales the rectangle by a factor
func (r *Rectangle) Scale(factor float64) {
    r.Width *= factor
    r.Height *= factor
}
`;

      const testFile = path.join(tempDir, 'geometry.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.functions).toHaveLength(2);
      
      const areaMethod = result.functions.find(f => f.name === 'Area');
      expect(areaMethod).toBeDefined();
      expect((areaMethod as any).receiver).toBeDefined();
      expect((areaMethod as any).receiver.type).toBe('Rectangle');
      expect((areaMethod as any).receiver.isPointer).toBe(false);

      const scaleMethod = result.functions.find(f => f.name === 'Scale');
      expect(scaleMethod).toBeDefined();
      expect((scaleMethod as any).receiver).toBeDefined();
      expect((scaleMethod as any).receiver.type).toBe('Rectangle');
      expect((scaleMethod as any).receiver.isPointer).toBe(true);
    });
  });

  describe('Struct Analysis', () => {
    it('should extract struct definitions with fields', async () => {
      const goCode = `
package models

// User represents a user in the system
type User struct {
    ID       int64     \`json:"id" db:"id"\`
    Name     string    \`json:"name" db:"name"\`
    Email    string    \`json:"email" db:"email"\`
    IsActive bool      \`json:"is_active" db:"is_active"\`
}

// Config holds application configuration
type Config struct {
    Port     int
    Database string
}
`;

      const testFile = path.join(tempDir, 'models.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.classes).toHaveLength(2);
      
      const userStruct = result.classes.find(c => c.name === 'User');
      expect(userStruct).toBeDefined();
      expect(userStruct!.isExported).toBe(true);
      expect(userStruct!.description).toBe('User represents a user in the system');
      expect(userStruct!.properties).toHaveLength(4);
      
      const idField = userStruct!.properties.find(p => p.name === 'ID');
      expect(idField).toBeDefined();
      expect(idField!.type).toBe('int64');
      expect(idField!.description).toContain('json:"id" db:"id"');

      const configStruct = result.classes.find(c => c.name === 'Config');
      expect(configStruct).toBeDefined();
      expect(configStruct!.properties).toHaveLength(2);
    });
  });

  describe('Interface Analysis', () => {
    it('should extract interface definitions with methods', async () => {
      const goCode = `
package storage

// Repository defines the interface for data storage operations
type Repository interface {
    Save(entity interface{}) error
    FindByID(id int64) (interface{}, error)
    Delete(id int64) error
}

// Cache defines caching operations
type Cache interface {
    Get(key string) (interface{}, bool)
    Set(key string, value interface{}) error
    Delete(key string) error
}
`;

      const testFile = path.join(tempDir, 'storage.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.interfaces).toHaveLength(2);
      
      const repoInterface = result.interfaces.find(i => i.name === 'Repository');
      expect(repoInterface).toBeDefined();
      expect(repoInterface!.isExported).toBe(true);
      expect(repoInterface!.description).toBe('Repository defines the interface for data storage operations');
      expect(repoInterface!.methods).toHaveLength(3);
      
      const saveMethod = repoInterface!.methods.find(m => m.name === 'Save');
      expect(saveMethod).toBeDefined();
      expect(saveMethod!.parameters).toHaveLength(1);
      expect(saveMethod!.returnType).toBe('error');

      const cacheInterface = result.interfaces.find(i => i.name === 'Cache');
      expect(cacheInterface).toBeDefined();
      expect(cacheInterface!.methods).toHaveLength(3);
    });
  });

  describe('Import Analysis', () => {
    it('should extract import statements', async () => {
      const goCode = `
package main

import (
    "fmt"
    "net/http"
    "encoding/json"
    log "github.com/sirupsen/logrus"
    "github.com/gorilla/mux"
)

import "os"
`;

      const testFile = path.join(tempDir, 'imports.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.imports).toHaveLength(6);
      
      // Check standard library imports
      const fmtImport = result.imports.find(i => i.source === 'fmt');
      expect(fmtImport).toBeDefined();
      expect(fmtImport!.isNamespace).toBe(true);

      // Check aliased import
      const logImport = result.imports.find(i => i.source === 'github.com/sirupsen/logrus');
      expect(logImport).toBeDefined();
      expect(logImport!.imports).toContain('log');

      // Check single import
      const osImport = result.imports.find(i => i.source === 'os');
      expect(osImport).toBeDefined();
    });
  });

  describe('Comment and TODO Analysis', () => {
    it('should extract comments and TODOs', async () => {
      const goCode = `
package main

// This is a single line comment
func main() {
    // TODO: Implement proper error handling
    // FIXME: This is a temporary solution
    /* This is a 
       multi-line comment */
    println("Hello")
}
`;

      const testFile = path.join(tempDir, 'comments.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      expect(result.comments.length).toBeGreaterThan(0);
      expect(result.todos).toHaveLength(2);
      
      const todoItem = result.todos.find(t => t.type === 'TODO');
      expect(todoItem).toBeDefined();
      expect(todoItem!.content).toBe('Implement proper error handling');

      const fixmeItem = result.todos.find(t => t.type === 'FIXME');
      expect(fixmeItem).toBeDefined();
      expect(fixmeItem!.content).toBe('This is a temporary solution');
    });
  });

  describe('Constants and Variables', () => {
    it('should extract constant and variable declarations', async () => {
      const goCode = `
package config

const (
    DefaultPort = 8080
    MaxRetries  = 3
    AppName     = "MyApp"
)

const SingleConst = "value"

var (
    GlobalVar string
    Counter   int = 0
)

var SingleVar = "test"
`;

      const testFile = path.join(tempDir, 'config.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      // Check that exported constants and variables are in exports
      const exports = result.exports.map(e => e.name);
      expect(exports).toContain('DefaultPort');
      expect(exports).toContain('MaxRetries');
      expect(exports).toContain('AppName');
      expect(exports).toContain('SingleConst');
      expect(exports).toContain('GlobalVar');
      expect(exports).toContain('Counter');
      expect(exports).toContain('SingleVar');
    });
  });

  describe('AST Parser Integration', () => {
    it('should use Go AST parser for accurate analysis', async () => {
      const goCode = `
// Package calculator provides mathematical operations
package calculator

import (
    "errors"
    "math"
)

// Operation represents a mathematical operation
type Operation string

const (
    // Add represents addition operation
    Add Operation = "add"
    // Subtract represents subtraction operation  
    Subtract Operation = "subtract"
)

// Calculator performs mathematical calculations
type Calculator struct {
    precision int
    history   []string
}

// NewCalculator creates a new calculator instance
func NewCalculator(precision int) *Calculator {
    return &Calculator{
        precision: precision,
        history:   make([]string, 0),
    }
}

// Calculate performs the specified operation
func (c *Calculator) Calculate(a, b float64, op Operation) (float64, error) {
    var result float64
    
    switch op {
    case Add:
        result = a + b
    case Subtract:
        result = a - b
    default:
        return 0, errors.New("unsupported operation")
    }
    
    // TODO: Add operation to history
    return math.Round(result*math.Pow(10, float64(c.precision))) / math.Pow(10, float64(c.precision)), nil
}
`;

      const testFile = path.join(tempDir, 'calculator.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      // Verify enhanced parsing results
      expect(result.functions).toHaveLength(2);
      
      const newCalcFunc = result.functions.find(f => f.name === 'NewCalculator');
      expect(newCalcFunc).toBeDefined();
      expect(newCalcFunc!.parameters).toHaveLength(1);
      expect(newCalcFunc!.parameters[0].name).toBe('precision');
      expect(newCalcFunc!.parameters[0].type).toBe('int');
      expect(newCalcFunc!.returnType).toBe('*Calculator');
      
      const calculateMethod = result.functions.find(f => f.name === 'Calculate');
      expect(calculateMethod).toBeDefined();
      expect(calculateMethod!.parameters).toHaveLength(3);
      expect(calculateMethod!.returnType).toBe('(float64, error)');
      expect((calculateMethod as any).receiver).toBeDefined();
      expect((calculateMethod as any).receiver.type).toBe('Calculator');
      expect((calculateMethod as any).receiver.isPointer).toBe(true);

      // Verify struct analysis
      expect(result.classes).toHaveLength(1);
      const calculatorStruct = result.classes[0];
      expect(calculatorStruct.name).toBe('Calculator');
      expect(calculatorStruct.properties).toHaveLength(2);
      expect(calculatorStruct.properties.find(p => p.name === 'precision')).toBeDefined();
      expect(calculatorStruct.properties.find(p => p.name === 'history')).toBeDefined();

      // Verify imports
      expect(result.imports).toHaveLength(2);
      expect(result.imports.find(i => i.source === 'errors')).toBeDefined();
      expect(result.imports.find(i => i.source === 'math')).toBeDefined();

      // Verify exports
      const exportNames = result.exports.map(e => e.name);
      expect(exportNames).toContain('Operation');
      expect(exportNames).toContain('Add');
      expect(exportNames).toContain('Subtract');
      expect(exportNames).toContain('Calculator');
      expect(exportNames).toContain('NewCalculator');

      // Verify TODOs
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].content).toBe('Add operation to history');
    });
  });

  describe('Complex Example', () => {
    it('should analyze a complete Go file with multiple constructs', async () => {
      const goCode = `
// Package server provides HTTP server functionality
package server

import (
    "fmt"
    "net/http"
    "encoding/json"
)

// Config holds server configuration
type Config struct {
    Port int    \`json:"port"\`
    Host string \`json:"host"\`
}

// Handler defines HTTP handler interface
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}

// Server represents an HTTP server
type Server struct {
    config  Config
    handler Handler
}

// NewServer creates a new server instance
func NewServer(config Config) *Server {
    return &Server{
        config: config,
    }
}

// Start starts the HTTP server
func (s *Server) Start() error {
    addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
    // TODO: Add graceful shutdown
    return http.ListenAndServe(addr, s.handler)
}

// SetHandler sets the request handler
func (s *Server) SetHandler(handler Handler) {
    s.handler = handler
}

// healthCheck is a private health check function
func (s *Server) healthCheck() bool {
    return true
}
`;

      const testFile = path.join(tempDir, 'server.go');
      await fs.writeFile(testFile, goCode);

      const result = analyzer.analyze(testFile);

      // Verify structs
      expect(result.classes).toHaveLength(2);
      const serverStruct = result.classes.find(c => c.name === 'Server');
      expect(serverStruct).toBeDefined();
      expect(serverStruct!.methods).toHaveLength(3); // Start, SetHandler, healthCheck

      // Verify interfaces
      expect(result.interfaces).toHaveLength(1);
      const handlerInterface = result.interfaces.find(i => i.name === 'Handler');
      expect(handlerInterface).toBeDefined();

      // Verify functions
      expect(result.functions).toHaveLength(4); // NewServer + 3 methods
      const newServerFunc = result.functions.find(f => f.name === 'NewServer');
      expect(newServerFunc).toBeDefined();
      expect(newServerFunc!.isExported).toBe(true);

      // Verify imports
      expect(result.imports).toHaveLength(3);

      // Verify TODOs
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].content).toBe('Add graceful shutdown');

      // Verify exports
      const exportNames = result.exports.map(e => e.name);
      expect(exportNames).toContain('Config');
      expect(exportNames).toContain('Handler');
      expect(exportNames).toContain('Server');
      expect(exportNames).toContain('NewServer');
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify Go files', () => {
      expect(GoAnalyzer.isGoFile('main.go')).toBe(true);
      expect(GoAnalyzer.isGoFile('server.go')).toBe(true);
      expect(GoAnalyzer.isGoFile('test_file.go')).toBe(true);
      expect(GoAnalyzer.isGoFile('main.js')).toBe(false);
      expect(GoAnalyzer.isGoFile('server.py')).toBe(false);
      expect(GoAnalyzer.isGoFile('README.md')).toBe(false);
      expect(GoAnalyzer.isGoFile('config.json')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Go code gracefully', async () => {
      const malformedCode = `
package main

func incomplete(
    // Missing closing parenthesis and body
`;

      const testFile = path.join(tempDir, 'malformed.go');
      await fs.writeFile(testFile, malformedCode);

      const result = analyzer.analyze(testFile);

      // Should not throw and return empty result
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
      expect(result.classes).toBeDefined();
      expect(result.interfaces).toBeDefined();
    });

    it('should handle non-existent files gracefully', () => {
      const result = analyzer.analyze('/non/existent/file.go');
      
      expect(result).toBeDefined();
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('Go Module Analysis', () => {
    it('should analyze Go module structure', async () => {
      // Create a mock go.mod file
      const goModContent = `module github.com/example/testproject

go 1.21

require (
    github.com/gorilla/mux v1.8.0
    github.com/sirupsen/logrus v1.9.0
)

require (
    github.com/gorilla/websocket v1.5.0 // indirect
)`;

      const goModFile = path.join(tempDir, 'go.mod');
      await fs.writeFile(goModFile, goModContent);

      // Create a simple Go file
      const mainGoContent = `package main

import (
    "fmt"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    fmt.Println("Server starting...")
}`;

      const mainGoFile = path.join(tempDir, 'main.go');
      await fs.writeFile(mainGoFile, mainGoContent);

      const moduleInfo = analyzer.analyzeGoModule(tempDir);

      expect(moduleInfo.name).toBe('github.com/example/testproject');
      expect(moduleInfo.goVersion).toBe('1.21');
      expect(moduleInfo.dependencies).toHaveLength(3);
      
      const directDeps = moduleInfo.dependencies.filter(d => !d.indirect);
      expect(directDeps).toHaveLength(2);
      expect(directDeps.find(d => d.name === 'github.com/gorilla/mux')).toBeDefined();
      
      const indirectDeps = moduleInfo.dependencies.filter(d => d.indirect);
      expect(indirectDeps).toHaveLength(1);
      expect(indirectDeps[0].name).toBe('github.com/gorilla/websocket');

      expect(moduleInfo.packages).toHaveLength(1);
      expect(moduleInfo.packages[0].name).toBe('main');
    });

    it('should generate module documentation', async () => {
      const moduleInfo = {
        name: 'github.com/example/testproject',
        version: 'v1.0.0',
        goVersion: '1.21',
        dependencies: [
          { name: 'github.com/gorilla/mux', version: 'v1.8.0', indirect: false },
          { name: 'github.com/sirupsen/logrus', version: 'v1.9.0', indirect: false },
          { name: 'github.com/gorilla/websocket', version: 'v1.5.0', indirect: true }
        ],
        packages: [
          {
            name: 'main',
            path: '.',
            files: ['main.go'],
            functions: [
              {
                name: 'main',
                parameters: [],
                returnType: undefined,
                isAsync: false,
                isExported: false,
                startLine: 8,
                endLine: 11
              }
            ],
            structs: [],
            interfaces: [],
            constants: [],
            variables: [],
            imports: [
              { source: 'fmt' },
              { source: 'github.com/gorilla/mux' }
            ]
          }
        ]
      };

      const documentation = analyzer.generateGoModuleDocumentation(moduleInfo);

      expect(documentation).toContain('# github.com/example/testproject');
      expect(documentation).toContain('**Go Version:** 1.21');
      expect(documentation).toContain('## Dependencies');
      expect(documentation).toContain('### Direct Dependencies');
      expect(documentation).toContain('github.com/gorilla/mux');
      expect(documentation).toContain('### Indirect Dependencies');
      expect(documentation).toContain('github.com/gorilla/websocket');
      expect(documentation).toContain('## Packages');
      expect(documentation).toContain('### Package `main`');
    });
  });

  describe('Documentation Generation', () => {
    it('should generate Go-specific documentation', () => {
      const packageInfo = {
        name: 'testpkg',
        path: 'github.com/user/testpkg',
        imports: ['fmt', 'net/http'],
        constants: [{
          name: 'DefaultTimeout',
          type: 'time.Duration',
          value: '30 * time.Second',
          description: 'Default timeout for operations',
          visibility: 'public' as const
        }],
        variables: [{
          name: 'GlobalCounter',
          type: 'int64',
          description: 'Global request counter',
          visibility: 'public' as const
        }],
        types: [],
        functions: [{
          name: 'ProcessRequest',
          parameters: [
            { name: 'req', type: 'http.Request', optional: false },
            { name: 'timeout', type: 'time.Duration', optional: false }
          ],
          returnType: 'error',
          description: 'ProcessRequest handles incoming HTTP requests',
          isAsync: false,
          isExported: true,
          startLine: 10,
          endLine: 20,
          visibility: 'public' as const
        }],
        structs: [{
          name: 'Config',
          methods: [],
          properties: [
            { name: 'Port', type: 'int', optional: false, readonly: false },
            { name: 'Host', type: 'string', optional: false, readonly: false }
          ],
          description: 'Config holds application configuration',
          isExported: true,
          startLine: 5,
          endLine: 8,
          fields: [
            { name: 'Port', type: 'int', optional: false, readonly: false, visibility: 'public' as const },
            { name: 'Host', type: 'string', optional: false, readonly: false, visibility: 'public' as const }
          ]
        }],
        interfaces: [{
          name: 'Handler',
          properties: [],
          methods: [{
            name: 'Handle',
            parameters: [{ name: 'req', type: 'Request', optional: false }],
            returnType: 'Response',
            isAsync: false,
            isExported: true,
            startLine: 0,
            endLine: 0,
            visibility: 'public' as const
          }],
          description: 'Handler processes requests',
          isExported: true,
          startLine: 15,
          endLine: 17
        }]
      };

      const documentation = analyzer.generateGoDocumentation(packageInfo);

      expect(documentation).toContain('# Package testpkg');
      expect(documentation).toContain('**Import path:** `github.com/user/testpkg`');
      expect(documentation).toContain('## Constants');
      expect(documentation).toContain('### DefaultTimeout');
      expect(documentation).toContain('## Variables');
      expect(documentation).toContain('### GlobalCounter');
      expect(documentation).toContain('## Functions');
      expect(documentation).toContain('### ProcessRequest');
      expect(documentation).toContain('## Types');
      expect(documentation).toContain('### Config');
      expect(documentation).toContain('## Interfaces');
      expect(documentation).toContain('### Handler');
    });
  });
});
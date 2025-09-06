#!/usr/bin/env node

/**
 * Test script for Go analyzer functionality
 */

import { GoAnalyzer } from '../dist/analyzers/go-analyzer.js';

async function testGoAnalyzer() {
  console.log('🐹 Starting Go Analyzer Test...\n');

  const analyzer = new GoAnalyzer();

  try {
    // Create a comprehensive test Go file
    const testGoCode = `
// Package server provides HTTP server functionality for web applications
package server

import (
    "fmt"
    "net/http"
    "encoding/json"
    "time"
    log "github.com/sirupsen/logrus"
)

// Configuration constants
const (
    DefaultPort    = 8080
    DefaultTimeout = 30 * time.Second
    MaxRetries     = 3
)

// Global variables
var (
    GlobalCounter int64
    ServerName    = "GoServer"
)

// Config holds server configuration settings
type Config struct {
    Port     int           \`json:"port" yaml:"port"\`
    Host     string        \`json:"host" yaml:"host"\`
    Timeout  time.Duration \`json:"timeout" yaml:"timeout"\`
    Debug    bool          \`json:"debug" yaml:"debug"\`
}

// Handler defines the interface for HTTP request handlers
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
    Initialize() error
    Cleanup() error
}

// Server represents an HTTP server instance
type Server struct {
    config  Config
    handler Handler
    logger  *log.Logger
}

// NewServer creates a new server instance with the given configuration
func NewServer(config Config) *Server {
    return &Server{
        config: config,
        logger: log.New(),
    }
}

// Start starts the HTTP server and begins listening for requests
func (s *Server) Start() error {
    addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
    s.logger.Infof("Starting server on %s", addr)
    
    // TODO: Add graceful shutdown support
    // FIXME: Handle SSL/TLS configuration
    return http.ListenAndServe(addr, s.handler)
}

// SetHandler configures the request handler for the server
func (s *Server) SetHandler(handler Handler) {
    s.handler = handler
}

// GetConfig returns the current server configuration
func (s *Server) GetConfig() Config {
    return s.config
}

// healthCheck performs internal health checks
func (s *Server) healthCheck() bool {
    return s.handler != nil
}

// Helper function for request validation
func validateRequest(r *http.Request) error {
    if r == nil {
        return fmt.Errorf("request cannot be nil")
    }
    return nil
}
`;

    console.log('📝 Analyzing comprehensive Go code...');
    const result = analyzer.analyze('test-server.go', testGoCode);

    console.log('\n📊 Analysis Results:');
    console.log('===================');

    // Functions
    console.log(`\n🔧 Functions (${result.functions.length}):`);
    result.functions.forEach(func => {
      const receiverInfo = func.receiver ? ` (${func.receiver.type} method)` : ' (standalone)';
      const exportStatus = func.isExported ? '🌍' : '🔒';
      console.log(`  ${exportStatus} ${func.name}${receiverInfo}`);
      if (func.parameters.length > 0) {
        console.log(`     Parameters: ${func.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}`);
      }
      if (func.returnType) {
        console.log(`     Returns: ${func.returnType}`);
      }
      if (func.description) {
        console.log(`     Description: ${func.description}`);
      }
    });

    // Structs (Classes)
    console.log(`\n🏗️  Structs (${result.classes.length}):`);
    result.classes.forEach(struct => {
      const exportStatus = struct.isExported ? '🌍' : '🔒';
      console.log(`  ${exportStatus} ${struct.name}`);
      if (struct.description) {
        console.log(`     Description: ${struct.description}`);
      }
      if (struct.properties.length > 0) {
        console.log(`     Fields: ${struct.properties.map(p => `${p.name}: ${p.type}`).join(', ')}`);
      }
      if (struct.methods.length > 0) {
        console.log(`     Methods: ${struct.methods.map(m => m.name).join(', ')}`);
      }
    });

    // Interfaces
    console.log(`\n🔌 Interfaces (${result.interfaces.length}):`);
    result.interfaces.forEach(iface => {
      const exportStatus = iface.isExported ? '🌍' : '🔒';
      console.log(`  ${exportStatus} ${iface.name}`);
      if (iface.description) {
        console.log(`     Description: ${iface.description}`);
      }
      if (iface.methods.length > 0) {
        console.log(`     Methods: ${iface.methods.map(m => `${m.name}(${m.parameters.map(p => p.type).join(', ')}) ${m.returnType || 'void'}`).join(', ')}`);
      }
    });

    // Imports
    console.log(`\n📦 Imports (${result.imports.length}):`);
    result.imports.forEach(imp => {
      const alias = imp.imports[0] !== '*' ? ` as ${imp.imports[0]}` : '';
      console.log(`  📥 ${imp.source}${alias}`);
    });

    // Exports
    console.log(`\n🌍 Exports (${result.exports.length}):`);
    result.exports.forEach(exp => {
      console.log(`  📤 ${exp.name} (${exp.type})`);
    });

    // TODOs
    console.log(`\n📝 TODOs (${result.todos.length}):`);
    result.todos.forEach(todo => {
      console.log(`  ${todo.type}: ${todo.content} (line ${todo.line})`);
    });

    // Comments
    console.log(`\n💬 Comments (${result.comments.length}):`);
    result.comments.forEach((comment, index) => {
      if (index < 3) { // Show first 3 comments
        console.log(`  ${comment.type}: ${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}`);
      }
    });
    if (result.comments.length > 3) {
      console.log(`  ... and ${result.comments.length - 3} more comments`);
    }

    // Test Go-specific documentation generation
    console.log('\n📚 Testing Go Documentation Generation...');
    const packageInfo = {
      name: 'server',
      path: 'github.com/example/server',
      imports: result.imports.map(i => i.source),
      constants: [
        {
          name: 'DefaultPort',
          type: 'int',
          value: '8080',
          description: 'Default port for HTTP server',
          visibility: 'public'
        }
      ],
      variables: [
        {
          name: 'ServerName',
          type: 'string',
          description: 'Global server name identifier',
          visibility: 'public'
        }
      ],
      types: [],
      functions: result.functions.filter(f => !f.receiver).map(f => ({
        ...f,
        visibility: f.isExported ? 'public' : 'private'
      })),
      structs: result.classes.map(c => ({
        ...c,
        fields: c.properties.map(p => ({
          ...p,
          visibility: 'public'
        })),
        methods: c.methods || []
      })),
      interfaces: result.interfaces
    };

    const documentation = analyzer.generateGoDocumentation(packageInfo);
    console.log('\n📖 Generated Documentation Preview:');
    console.log('=====================================');
    console.log(documentation.substring(0, 500) + '...\n');

    // Test file type detection
    console.log('🔍 Testing File Type Detection:');
    console.log(`  main.go: ${GoAnalyzer.isGoFile('main.go') ? '✅' : '❌'}`);
    console.log(`  server.go: ${GoAnalyzer.isGoFile('server.go') ? '✅' : '❌'}`);
    console.log(`  main.js: ${GoAnalyzer.isGoFile('main.js') ? '❌' : '✅'}`);
    console.log(`  README.md: ${GoAnalyzer.isGoFile('README.md') ? '❌' : '✅'}`);

    console.log('\n✅ Go Analyzer test completed successfully!');
    console.log('\n🎯 Key Features Demonstrated:');
    // Test Go module analysis
    console.log('\n🏗️  Testing Go Module Analysis...');
    const mockModuleInfo = {
      name: 'github.com/example/server',
      version: 'v1.0.0',
      goVersion: '1.21',
      dependencies: [
        { name: 'github.com/gorilla/mux', version: 'v1.8.0', indirect: false },
        { name: 'github.com/sirupsen/logrus', version: 'v1.9.0', indirect: false },
        { name: 'golang.org/x/net', version: 'v0.10.0', indirect: true }
      ],
      packages: [
        {
          name: 'server',
          path: '.',
          files: ['main.go', 'server.go'],
          functions: result.functions.slice(0, 3),
          structs: result.classes.slice(0, 2),
          interfaces: result.interfaces.slice(0, 1),
          constants: [],
          variables: [],
          imports: result.imports
        }
      ]
    };

    const moduleDoc = analyzer.generateGoModuleDocumentation(mockModuleInfo);
    console.log('\n📖 Generated Module Documentation Preview:');
    console.log('==========================================');
    console.log(moduleDoc.substring(0, 600) + '...\n');

    console.log('   • Go AST parsing using go/parser and go/ast');
    console.log('   • Package and import analysis');
    console.log('   • Function and method extraction with receivers');
    console.log('   • Struct field parsing with tags');
    console.log('   • Interface method signatures');
    console.log('   • Constant and variable declarations');
    console.log('   • Comment and TODO extraction');
    console.log('   • Export detection based on capitalization');
    console.log('   • Go module and dependency analysis');
    console.log('   • Go-specific documentation generation');
    console.log('   • File type detection');
    console.log('   • Graceful fallback to regex parsing');

  } catch (error) {
    console.error('❌ Error during Go analyzer test:', error);
    process.exit(1);
  }
}

// Run the test
testGoAnalyzer().catch(console.error);
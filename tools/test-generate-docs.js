#!/usr/bin/env node

/**
 * Test script to verify the generate_docs MCP tool works with real TypeScript analysis
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testGenerateDocs() {
  console.log('Testing generate_docs MCP tool with TypeScript analysis...');
  
  // Create a test project directory
  const testProjectDir = path.join(__dirname, '..', 'test-project');
  if (!fs.existsSync(testProjectDir)) {
    fs.mkdirSync(testProjectDir);
  }

  // Create some test TypeScript files
  const testFiles = {
    'calculator.ts': `
/**
 * A mathematical calculator utility
 */
export class Calculator {
  private value: number = 0;
  
  /**
   * Add a number to the current value
   * @param num The number to add
   */
  add(num: number): Calculator {
    this.value += num;
    return this;
  }
  
  /**
   * Get the current value
   */
  getValue(): number {
    return this.value;
  }
}
`,
    'utils.ts': `
import { Calculator } from './calculator';

/**
 * Create a new calculator instance
 */
export function createCalculator(): Calculator {
  return new Calculator();
}

/**
 * Math utility functions
 */
export namespace MathUtils {
  export function square(x: number): number {
    return x * x;
  }
  
  // TODO: Add more math functions
}
`,
    'types.ts': `
/**
 * Common type definitions
 */
export interface User {
  id: number;
  name: string;
  email?: string;
}

export type Status = 'active' | 'inactive' | 'pending';
`
  };

  // Write test files
  for (const [filename, content] of Object.entries(testFiles)) {
    fs.writeFileSync(path.join(testProjectDir, filename), content);
  }

  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';
  let responses = [];

  server.stdout.on('data', (data) => {
    output += data.toString();
    
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line.trim());
          responses.push(response);
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
  });

  server.stderr.on('data', (data) => {
    console.log('Server started:', data.toString());
  });

  // Initialize
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  }) + '\n');

  // Wait then call generate_docs tool
  setTimeout(() => {
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'generate_docs',
        arguments: {
          projectPath: testProjectDir,
          outputFormat: 'markdown',
        },
      },
    }) + '\n');
  }, 1000);

  // Check results
  setTimeout(() => {
    server.kill();
    
    const toolResponse = responses.find(r => r.id === 2);
    if (toolResponse && toolResponse.result) {
      console.log('✅ Documentation generation successful!');
      console.log('\n📋 Generated Documentation:');
      console.log(toolResponse.result.content[0].text);
      
      // Verify it contains real analysis results
      const responseText = toolResponse.result.content[0].text;
      if (responseText.includes('Calculator') && 
          responseText.includes('Functions found:') && 
          responseText.includes('Classes found:') &&
          responseText.includes('real TypeScript analysis')) {
        console.log('\n🎉 Real TypeScript analysis is working in MCP server!');
        process.exit(0);
      } else {
        console.log('\n❌ Response does not contain expected analysis results');
        process.exit(1);
      }
    } else {
      console.log('❌ No tool response received');
      console.log('All responses:', JSON.stringify(responses, null, 2));
      process.exit(1);
    }
  }, 5000);

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  // Cleanup function
  process.on('exit', () => {
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });
}

testGenerateDocs().catch(console.error);
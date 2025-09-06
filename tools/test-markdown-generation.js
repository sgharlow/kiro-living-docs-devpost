#!/usr/bin/env node

/**
 * Test script to verify markdown generation works end-to-end through MCP
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testMarkdownGeneration() {
  console.log('Testing markdown generation through MCP server...');
  
  // Create a test project directory
  const testProjectDir = path.join(__dirname, '..', 'test-markdown-project');
  if (fs.existsSync(testProjectDir)) {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testProjectDir);

  // Create comprehensive test TypeScript files
  const testFiles = {
    'calculator.ts': `
/**
 * A comprehensive calculator utility for mathematical operations
 */
export class Calculator {
  private value: number = 0;
  
  /**
   * Add a number to the current value
   * @param num The number to add
   * @returns The calculator instance for chaining
   */
  add(num: number): Calculator {
    this.value += num;
    return this;
  }
  
  /**
   * Multiply the current value by a number
   * @param num The multiplier
   * @returns The calculator instance for chaining
   */
  multiply(num: number): Calculator {
    this.value *= num;
    return this;
  }
  
  /**
   * Get the current calculation result
   * @returns The current value
   */
  getValue(): number {
    return this.value;
  }
  
  /**
   * Reset the calculator to zero
   */
  reset(): void {
    this.value = 0;
  }
}

/**
 * Create a new calculator instance
 * @returns A new Calculator
 */
export function createCalculator(): Calculator {
  return new Calculator();
}

// TODO: Add division and subtraction methods
// FIXME: Handle overflow for large numbers
`,
    'types.ts': `
/**
 * Common type definitions for the calculator system
 */

/**
 * Represents a mathematical operation
 */
export interface Operation {
  /** The operation name */
  name: string;
  /** The operation symbol */
  symbol: string;
  /** Execute the operation */
  execute(a: number, b: number): number;
}

/**
 * Calculator configuration options
 */
export interface CalculatorConfig {
  /** Maximum precision for decimal operations */
  precision?: number;
  /** Whether to use strict mode */
  strict?: boolean;
  /** Default value when creating calculator */
  defaultValue?: number;
}

/**
 * Status of a calculation
 */
export type CalculationStatus = 'pending' | 'completed' | 'error';

/**
 * Result of a calculation with metadata
 */
export interface CalculationResult {
  /** The calculated value */
  value: number;
  /** Status of the calculation */
  status: CalculationStatus;
  /** Optional error message */
  error?: string;
  /** Timestamp of calculation */
  timestamp: Date;
}
`,
    'utils.ts': `
import { Calculator } from './calculator';
import { Operation, CalculationResult } from './types';

/**
 * Utility functions for mathematical operations
 */
export namespace MathUtils {
  /**
   * Calculate the square of a number
   * @param x The number to square
   * @returns The square of x
   */
  export function square(x: number): number {
    return x * x;
  }
  
  /**
   * Calculate the cube of a number
   * @param x The number to cube
   * @returns The cube of x
   */
  export function cube(x: number): number {
    return x * x * x;
  }
  
  /**
   * Check if a number is even
   * @param n The number to check
   * @returns True if even, false otherwise
   */
  export function isEven(n: number): boolean {
    return n % 2 === 0;
  }
}

/**
 * Advanced calculator operations
 */
export class AdvancedCalculator extends Calculator {
  /**
   * Calculate power of current value
   * @param exponent The exponent to raise to
   * @returns The calculator instance
   */
  power(exponent: number): AdvancedCalculator {
    const currentValue = this.getValue();
    // Reset and set to the power result
    this.reset();
    this.add(Math.pow(currentValue, exponent));
    return this;
  }
  
  /**
   * Calculate square root of current value
   * @returns The calculator instance
   */
  sqrt(): AdvancedCalculator {
    const currentValue = this.getValue();
    this.reset();
    this.add(Math.sqrt(currentValue));
    return this;
  }
}

/**
 * Create calculation result object
 * @param value The calculated value
 * @param status The calculation status
 * @param error Optional error message
 * @returns A calculation result object
 */
export function createResult(
  value: number, 
  status: CalculationStatus, 
  error?: string
): CalculationResult {
  return {
    value,
    status,
    error,
    timestamp: new Date(),
  };
}

// TODO: Add more advanced mathematical functions
// TODO: Implement error handling for invalid operations
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

  // Wait then call generate_docs tool with markdown output
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
      console.log('✅ Markdown generation successful!');
      console.log('\n📋 Server Response:');
      console.log(toolResponse.result.content[0].text);
      
      // Check if markdown files were actually generated
      const docsDir = path.join(testProjectDir, 'docs');
      if (fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir);
        console.log(`\n📄 Generated Files (${files.length}):`);
        
        files.forEach(file => {
          console.log(`  - ${file}`);
          const filePath = path.join(docsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Show first few lines of each file
          const lines = content.split('\n').slice(0, 5);
          console.log(`    Preview: ${lines[0]}`);
          if (lines[1]) console.log(`             ${lines[1]}`);
        });

        // Verify README.md contains project overview
        const readmePath = path.join(docsDir, 'README.md');
        if (fs.existsSync(readmePath)) {
          const readmeContent = fs.readFileSync(readmePath, 'utf-8');
          if (readmeContent.includes('Project Overview') && 
              readmeContent.includes('Statistics') &&
              readmeContent.includes('Files')) {
            console.log('\n✅ README.md contains proper project overview');
          }
        }

        // Verify individual file docs were generated
        const expectedFiles = ['calculator.md', 'types.md', 'utils.md'];
        const hasAllFiles = expectedFiles.every(file => 
          fs.existsSync(path.join(docsDir, file))
        );

        if (hasAllFiles) {
          console.log('✅ All individual file documentation generated');
          
          // Check calculator.md for proper class documentation
          const calcDoc = fs.readFileSync(path.join(docsDir, 'calculator.md'), 'utf-8');
          if (calcDoc.includes('## Classes') && 
              calcDoc.includes('### Calculator') &&
              calcDoc.includes('**Methods:**') &&
              calcDoc.includes('**Parameters:**')) {
            console.log('✅ Class documentation properly formatted');
          }

          // Check types.md for interface documentation
          const typesDoc = fs.readFileSync(path.join(docsDir, 'types.md'), 'utf-8');
          if (typesDoc.includes('## Interfaces') && 
              typesDoc.includes('### Operation') &&
              typesDoc.includes('interface Operation')) {
            console.log('✅ Interface documentation properly formatted');
          }

          console.log('\n🎉 Markdown generation is working perfectly!');
          process.exit(0);
        } else {
          console.log('❌ Not all expected files were generated');
          process.exit(1);
        }
      } else {
        console.log('❌ No docs directory was created');
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

testMarkdownGeneration().catch(console.error);
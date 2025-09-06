#!/usr/bin/env node

/**
 * Test script to verify TypeScript analyzer works with real files
 */

const { TypeScriptAnalyzer } = require('../dist/analyzers/typescript-analyzer.js');
const fs = require('fs');
const path = require('path');

async function testAnalyzer() {
  console.log('Testing TypeScript analyzer...');
  
  // Create a test TypeScript file
  const testCode = `
/**
 * A simple calculator class for demonstration
 */
export class Calculator {
  private result: number = 0;
  
  /**
   * Add a number to the current result
   * @param value The number to add
   */
  add(value: number): void {
    this.result += value;
  }
  
  /**
   * Get the current result
   * @returns The current calculation result
   */
  getResult(): number {
    return this.result;
  }
  
  // TODO: Add subtraction method
  // FIXME: Handle division by zero
}

/**
 * Helper function to create a new calculator
 */
export function createCalculator(): Calculator {
  return new Calculator();
}

interface MathOperation {
  execute(a: number, b: number): number;
}
`;

  const testFile = path.join(__dirname, '..', 'test-sample.ts');
  fs.writeFileSync(testFile, testCode);

  try {
    const analyzer = new TypeScriptAnalyzer();
    const result = analyzer.analyze(testFile);

    console.log('✅ Analysis completed successfully!');
    console.log(`📊 Results:`);
    console.log(`  - Functions: ${result.functions.length}`);
    console.log(`  - Classes: ${result.classes.length}`);
    console.log(`  - Interfaces: ${result.interfaces.length}`);
    console.log(`  - Exports: ${result.exports.length}`);
    console.log(`  - Imports: ${result.imports.length}`);
    console.log(`  - TODOs: ${result.todos.length}`);
    console.log(`  - Comments: ${result.comments.length}`);

    // Verify specific results
    const calculatorClass = result.classes.find(c => c.name === 'Calculator');
    if (calculatorClass) {
      console.log(`✅ Found Calculator class with ${calculatorClass.methods.length} methods`);
    }

    const createFunction = result.functions.find(f => f.name === 'createCalculator');
    if (createFunction) {
      console.log(`✅ Found createCalculator function (exported: ${createFunction.isExported})`);
    }

    const mathInterface = result.interfaces.find(i => i.name === 'MathOperation');
    if (mathInterface) {
      console.log(`✅ Found MathOperation interface`);
    }

    if (result.todos.length >= 2) {
      console.log(`✅ Found TODOs: ${result.todos.map(t => `${t.type}: ${t.content}`).join(', ')}`);
    }

    console.log('\n🎉 TypeScript analyzer is working correctly!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }
}

testAnalyzer().catch(console.error);
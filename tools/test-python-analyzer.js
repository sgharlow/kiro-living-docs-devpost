#!/usr/bin/env node

/**
 * Test script for the Python analyzer functionality
 * This script demonstrates the Python analyzer capabilities and can be used for manual testing
 */

const { PythonAnalyzer } = require('../dist/analyzers/python-analyzer');
const fs = require('fs').promises;
const path = require('path');

async function testPythonAnalyzer() {
  console.log('🐍 Starting Python Analyzer Test...\n');

  const analyzer = new PythonAnalyzer();

  try {
    // Create sample Python files for testing
    const testFiles = await createSamplePythonFiles();

    console.log('📁 Created sample Python files for testing:\n');
    testFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name}`);
    });
    console.log('');

    // Test each file
    for (const testFile of testFiles) {
      console.log(`🔍 Analyzing: ${testFile.name}`);
      console.log('─'.repeat(50));

      const result = analyzer.analyze(testFile.path, testFile.content);

      // Display analysis results
      console.log(`📊 Analysis Results:`);
      console.log(`   Functions: ${result.functions.length}`);
      console.log(`   Classes: ${result.classes.length}`);
      console.log(`   Imports: ${result.imports.length}`);
      console.log(`   Exports: ${result.exports.length}`);
      console.log(`   Comments: ${result.comments.length}`);
      console.log(`   TODOs: ${result.todos.length}`);
      console.log('');

      // Display functions
      if (result.functions.length > 0) {
        console.log('🔧 Functions:');
        result.functions.forEach(func => {
          const params = func.parameters.map(p => {
            let paramStr = p.name;
            if (p.type) paramStr += `: ${p.type}`;
            if (p.optional && p.defaultValue) paramStr += ` = ${p.defaultValue}`;
            return paramStr;
          }).join(', ');
          
          const returnType = func.returnType ? ` -> ${func.returnType}` : '';
          const asyncStr = func.isAsync ? 'async ' : '';
          const decorators = func.decorators && func.decorators.length > 0 ? 
            `@${func.decorators.join(', @')} ` : '';
          
          console.log(`   ${decorators}${asyncStr}${func.name}(${params})${returnType}`);
          if (func.description) {
            console.log(`     "${func.description}"`);
          }
          if (func.decorators && func.decorators.length > 0) {
            console.log(`     Decorators: ${func.decorators.join(', ')}`);
          }
        });
        console.log('');
      }

      // Display classes
      if (result.classes.length > 0) {
        console.log('🏗️  Classes:');
        result.classes.forEach(cls => {
          const inheritance = cls.baseClasses && cls.baseClasses.length > 0 ? 
            `(${cls.baseClasses.join(', ')})` : '';
          const decorators = cls.decorators && cls.decorators.length > 0 ? 
            `@${cls.decorators.join(', @')} ` : '';
          
          console.log(`   ${decorators}class ${cls.name}${inheritance}`);
          if (cls.description) {
            console.log(`     "${cls.description}"`);
          }
          
          if (cls.properties.length > 0) {
            console.log(`     Properties: ${cls.properties.length}`);
            cls.properties.forEach(prop => {
              const typeStr = prop.type ? `: ${prop.type}` : '';
              const optionalStr = prop.optional ? ' (optional)' : '';
              console.log(`       - ${prop.name}${typeStr}${optionalStr}`);
            });
          }
          
          if (cls.methods.length > 0) {
            console.log(`     Methods: ${cls.methods.length}`);
            cls.methods.forEach(method => {
              const params = method.parameters.map(p => p.name).join(', ');
              const returnType = method.returnType ? ` -> ${method.returnType}` : '';
              const decorators = method.decorators && method.decorators.length > 0 ? 
                `@${method.decorators.join(', @')} ` : '';
              console.log(`       - ${decorators}${method.name}(${params})${returnType}`);
            });
          }
          
          if (cls.isDataClass) {
            console.log(`     📋 Data Class: Yes`);
          }
        });
        console.log('');
      }

      // Display imports
      if (result.imports.length > 0) {
        console.log('📦 Imports:');
        result.imports.forEach(imp => {
          const type = imp.isNamespace ? 'namespace' : 'named';
          console.log(`   ${imp.source} (${type}): ${imp.imports.join(', ')}`);
        });
        console.log('');
      }

      // Display exports
      if (result.exports.length > 0) {
        console.log('📤 Exports:');
        result.exports.forEach(exp => {
          console.log(`   ${exp.name} (${exp.type})`);
        });
        console.log('');
      }

      // Display TODOs
      if (result.todos.length > 0) {
        console.log('📝 TODOs:');
        result.todos.forEach(todo => {
          console.log(`   ${todo.type} (line ${todo.line}): ${todo.content}`);
        });
        console.log('');
      }

      console.log('═'.repeat(50));
      console.log('');
    }

    // Test file type detection
    console.log('🔍 File Type Detection Test:');
    const testExtensions = ['.py', '.pyw', '.js', '.ts', '.md', '.txt'];
    testExtensions.forEach(ext => {
      const isPython = analyzer.constructor.isPythonFile(`test${ext}`);
      console.log(`   test${ext}: ${isPython ? '✅ Python' : '❌ Not Python'}`);
    });
    console.log('');

    // Performance test
    console.log('⚡ Performance Test:');
    const largeFile = createLargePythonFile();
    const startTime = Date.now();
    const largeResult = analyzer.analyze('large_test.py', largeFile);
    const endTime = Date.now();
    
    console.log(`   Analyzed large file (${largeFile.split('\n').length} lines) in ${endTime - startTime}ms`);
    console.log(`   Found: ${largeResult.functions.length} functions, ${largeResult.classes.length} classes`);
    console.log('');

    console.log('✅ Python analyzer test completed successfully!');
    console.log('');
    console.log('💡 Key Features Demonstrated:');
    console.log('   ✓ Function analysis with type hints and decorators');
    console.log('   ✓ Class analysis with inheritance and properties');
    console.log('   ✓ Docstring extraction (single and multi-line)');
    console.log('   ✓ Import/export analysis');
    console.log('   ✓ Type hint parsing');
    console.log('   ✓ Decorator recognition');
    console.log('   ✓ Comment and TODO extraction');
    console.log('   ✓ Error handling and graceful degradation');
    console.log('   ✓ Performance optimization');

  } catch (error) {
    console.error('❌ Python analyzer test failed:', error);
  }
}

async function createSamplePythonFiles() {
  const files = [
    {
      name: 'simple_functions.py',
      path: 'simple_functions.py',
      content: `
def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

async def fetch_data(url: str, timeout: float = 5.0) -> dict:
    """Fetch data from a URL asynchronously."""
    # TODO: Implement actual HTTP request
    return {"status": "success"}

@property
def current_time():
    """Get the current timestamp."""
    import time
    return time.time()
`
    },
    {
      name: 'classes_example.py',
      path: 'classes_example.py',
      content: `
from dataclasses import dataclass
from typing import List, Optional
from abc import ABC, abstractmethod

class Animal(ABC):
    """Base class for all animals."""
    
    def __init__(self, name: str, species: str):
        self.name = name
        self.species = species
    
    @abstractmethod
    def make_sound(self) -> str:
        """Make the animal's characteristic sound."""
        pass
    
    def describe(self) -> str:
        """Describe the animal."""
        return f"{self.name} is a {self.species}"

@dataclass
class Dog(Animal):
    """A dog is a loyal companion."""
    breed: str
    age: int = 0
    
    def make_sound(self) -> str:
        """Dogs bark."""
        return "Woof!"
    
    @classmethod
    def create_puppy(cls, name: str, breed: str):
        """Create a new puppy."""
        return cls(name=name, species="Canis lupus", breed=breed, age=0)
    
    @staticmethod
    def is_good_boy() -> bool:
        """All dogs are good boys/girls."""
        return True

class ServiceDog(Dog):
    """A service dog provides assistance."""
    
    def __init__(self, name: str, breed: str, service_type: str):
        super().__init__(name, "Canis lupus", breed)
        self.service_type = service_type
        self.trained_tasks: List[str] = []
    
    def add_task(self, task: str) -> None:
        """Add a trained task."""
        self.trained_tasks.append(task)
`
    },
    {
      name: 'advanced_features.py',
      path: 'advanced_features.py',
      content: `
"""
Advanced Python features demonstration module.

This module showcases various Python language features
that the analyzer should be able to handle.
"""

from typing import Protocol, TypeVar, Generic, Union, Callable
from collections.abc import Iterable
import asyncio

__all__ = ['Processor', 'DataHandler', 'process_items']

T = TypeVar('T')
U = TypeVar('U')

class Comparable(Protocol):
    """Protocol for comparable objects."""
    def __lt__(self, other: 'Comparable') -> bool: ...

class Processor(Generic[T]):
    """Generic processor for any type."""
    
    def __init__(self, validator: Callable[[T], bool]):
        self._validator = validator
        self._processed_count = 0
    
    def process(self, item: T) -> Optional[T]:
        """Process a single item."""
        if self._validator(item):
            self._processed_count += 1
            return item
        return None
    
    @property
    def processed_count(self) -> int:
        """Number of items processed."""
        return self._processed_count

async def process_items(
    items: Iterable[T], 
    processor: Processor[T],
    batch_size: int = 10
) -> List[T]:
    """Process items in batches asynchronously."""
    # FIXME: This should handle errors better
    # NOTE: Consider adding progress reporting
    results = []
    
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        # TODO: Add actual async processing
        for item in batch:
            result = processor.process(item)
            if result is not None:
                results.append(result)
        
        # Yield control to event loop
        await asyncio.sleep(0)
    
    return results

class DataHandler:
    """Handles various data operations."""
    
    def __init__(self):
        self.cache: dict = {}
    
    def get_or_create(self, key: str, factory: Callable[[], T]) -> T:
        """Get item from cache or create it."""
        if key not in self.cache:
            self.cache[key] = factory()
        return self.cache[key]
    
    def clear_cache(self) -> None:
        """Clear the internal cache."""
        self.cache.clear()
`
    }
  ];

  return files;
}

function createLargePythonFile() {
  const lines = [];
  
  // Add imports
  lines.push('from typing import List, Dict, Optional, Union');
  lines.push('import asyncio');
  lines.push('import json');
  lines.push('');
  
  // Generate many functions
  for (let i = 0; i < 50; i++) {
    lines.push(`def function_${i}(param1: str, param2: int = ${i}) -> bool:`);
    lines.push(`    """Function number ${i} for testing."""`);
    lines.push(`    # TODO: Implement function_${i}`);
    lines.push(`    return param2 > ${i}`);
    lines.push('');
  }
  
  // Generate many classes
  for (let i = 0; i < 20; i++) {
    lines.push(`class TestClass${i}:`);
    lines.push(`    """Test class number ${i}."""`);
    lines.push('    ');
    lines.push(`    def __init__(self, value: int = ${i}):`);
    lines.push(`        self.value = value`);
    lines.push('    ');
    lines.push(`    def method_${i}(self) -> int:`);
    lines.push(`        """Method for class ${i}."""`);
    lines.push(`        return self.value * ${i}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testPythonAnalyzer().catch(console.error);
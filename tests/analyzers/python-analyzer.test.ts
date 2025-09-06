import { PythonAnalyzer } from '../../src/analyzers/python-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PythonAnalyzer', () => {
  let analyzer: PythonAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new PythonAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'python-analyzer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Function Analysis', () => {
    it('should extract basic function information', async () => {
      const pythonCode = `
def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

def greet(name: str = "World") -> str:
    """Greet someone with their name."""
    return f"Hello, {name}!"
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions).toHaveLength(2);
      
      const sumFunc = result.functions.find(f => f.name === 'calculate_sum');
      expect(sumFunc).toBeDefined();
      expect(sumFunc!.parameters).toHaveLength(2);
      expect(sumFunc!.parameters[0].name).toBe('a');
      expect(sumFunc!.parameters[1].name).toBe('b');
      expect(sumFunc!.description).toBe('Calculate the sum of two numbers.');
      expect(sumFunc!.isExported).toBe(true);

      const greetFunc = result.functions.find(f => f.name === 'greet');
      expect(greetFunc).toBeDefined();
      expect(greetFunc!.parameters).toHaveLength(1);
      expect(greetFunc!.parameters[0].name).toBe('name');
      expect(greetFunc!.parameters[0].type).toBe('str');
      expect(greetFunc!.parameters[0].optional).toBe(true);
      expect(greetFunc!.parameters[0].defaultValue).toBe('"World"');
      expect(greetFunc!.returnType).toBe('str');
      expect(greetFunc!.description).toBe('Greet someone with their name.');
    });

    it('should handle async functions', async () => {
      const pythonCode = `
async def fetch_data(url: str) -> dict:
    """Fetch data from a URL asynchronously."""
    # Implementation here
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions).toHaveLength(1);
      const func = result.functions[0];
      expect(func.name).toBe('fetch_data');
      expect(func.isAsync).toBe(true);
      expect(func.returnType).toBe('dict');
      expect(func.description).toBe('Fetch data from a URL asynchronously.');
    });

    it('should handle function decorators', async () => {
      const pythonCode = `
@property
def value(self):
    """Get the current value."""
    return self._value

@staticmethod
def utility_function():
    """A utility function."""
    pass

@classmethod
def from_string(cls, data: str):
    """Create instance from string."""
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions).toHaveLength(3);
      
      const propFunc = result.functions.find(f => f.name === 'value');
      expect(propFunc).toBeDefined();
      expect((propFunc as any).decorators).toContain('property');
      expect((propFunc as any).isProperty).toBe(true);

      const staticFunc = result.functions.find(f => f.name === 'utility_function');
      expect(staticFunc).toBeDefined();
      expect((staticFunc as any).decorators).toContain('staticmethod');
      expect((staticFunc as any).isStaticMethod).toBe(true);

      const classFunc = result.functions.find(f => f.name === 'from_string');
      expect(classFunc).toBeDefined();
      expect((classFunc as any).decorators).toContain('classmethod');
      expect((classFunc as any).isClassMethod).toBe(true);
    });
  });

  describe('Class Analysis', () => {
    it('should extract class information with methods and properties', async () => {
      const pythonCode = `
class Calculator:
    """A simple calculator class."""
    
    def __init__(self, initial_value: int = 0):
        """Initialize the calculator."""
        self.value: int = initial_value
        self.history = []
    
    def add(self, number: int) -> int:
        """Add a number to the current value."""
        self.value += number
        self.history.append(f"Added {number}")
        return self.value
    
    @property
    def current_value(self) -> int:
        """Get the current value."""
        return self.value
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.classes).toHaveLength(1);
      const cls = result.classes[0];
      expect(cls.name).toBe('Calculator');
      expect(cls.description).toBe('A simple calculator class.');
      expect(cls.methods).toHaveLength(3); // __init__, add, current_value
      expect(cls.properties).toHaveLength(2); // value, history

      const initMethod = cls.methods.find(m => m.name === '__init__');
      expect(initMethod).toBeDefined();
      expect(initMethod!.parameters).toHaveLength(1); // initial_value (self is filtered out)

      const addMethod = cls.methods.find(m => m.name === 'add');
      expect(addMethod).toBeDefined();
      expect(addMethod!.returnType).toBe('int');

      const propMethod = cls.methods.find(m => m.name === 'current_value');
      expect(propMethod).toBeDefined();
      expect((propMethod as any).isProperty).toBe(true);
    });

    it('should handle class inheritance', async () => {
      const pythonCode = `
class Animal:
    """Base animal class."""
    pass

class Dog(Animal):
    """A dog is an animal."""
    
    def bark(self):
        """Make a barking sound."""
        return "Woof!"

class GuideDog(Dog, ServiceAnimal):
    """A guide dog for assistance."""
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.classes).toHaveLength(3);
      
      const animal = result.classes.find(c => c.name === 'Animal');
      expect(animal).toBeDefined();
      expect((animal as any).baseClasses).toEqual([]);

      const dog = result.classes.find(c => c.name === 'Dog');
      expect(dog).toBeDefined();
      expect((dog as any).baseClasses).toEqual(['Animal']);

      const guideDog = result.classes.find(c => c.name === 'GuideDog');
      expect(guideDog).toBeDefined();
      expect((guideDog as any).baseClasses).toEqual(['Dog', 'ServiceAnimal']);
    });

    it('should handle dataclasses', async () => {
      const pythonCode = `
from dataclasses import dataclass

@dataclass
class Person:
    """A person with name and age."""
    name: str
    age: int
    email: str = ""
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.classes).toHaveLength(1);
      const cls = result.classes[0];
      expect(cls.name).toBe('Person');
      expect((cls as any).isDataClass).toBe(true);
      expect((cls as any).decorators).toContain('dataclass');
      expect(cls.properties).toHaveLength(3);
      
      const emailProp = cls.properties.find(p => p.name === 'email');
      expect(emailProp).toBeDefined();
      expect(emailProp!.optional).toBe(true);
    });
  });

  describe('Import Analysis', () => {
    it('should extract import statements', async () => {
      const pythonCode = `
import os
import sys as system
from typing import List, Dict, Optional
from .local_module import helper_function
from ..parent_module import ParentClass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.imports).toHaveLength(5);
      
      const osImport = result.imports.find(i => i.source === 'os');
      expect(osImport).toBeDefined();
      expect(osImport!.isNamespace).toBe(true);
      expect(osImport!.imports).toEqual(['os']);

      const sysImport = result.imports.find(i => i.source === 'sys');
      expect(sysImport).toBeDefined();
      expect(sysImport!.imports).toEqual(['system']);

      const typingImport = result.imports.find(i => i.source === 'typing');
      expect(typingImport).toBeDefined();
      expect(typingImport!.isNamespace).toBe(false);
      expect(typingImport!.imports).toEqual(['List', 'Dict', 'Optional']);
    });
  });

  describe('Docstring Analysis', () => {
    it('should extract single-line docstrings', async () => {
      const pythonCode = `
def simple_function():
    """This is a simple function."""
    pass

class SimpleClass:
    """This is a simple class."""
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions[0].description).toBe('This is a simple function.');
      expect(result.classes[0].description).toBe('This is a simple class.');
    });

    it('should extract multi-line docstrings', async () => {
      const pythonCode = `
def complex_function():
    """
    This is a complex function that does many things.
    
    It has multiple lines of documentation
    and provides detailed information.
    """
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions[0].description).toContain('This is a complex function');
      expect(result.functions[0].description).toContain('multiple lines');
    });

    it('should handle different docstring quote styles', async () => {
      const pythonCode = `
def function_with_double_quotes():
    """Function with double quotes."""
    pass

def function_with_single_quotes():
    '''Function with single quotes.'''
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].description).toBe('Function with double quotes.');
      expect(result.functions[1].description).toBe('Function with single quotes.');
    });
  });

  describe('Comment and TODO Analysis', () => {
    it('should extract comments and TODOs', async () => {
      const pythonCode = `
# This is a regular comment
def function():
    # TODO: Implement this function
    # FIXME: Fix the bug here
    # NOTE: This is important
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.comments).toHaveLength(4);
      expect(result.todos).toHaveLength(3);
      
      const todoItem = result.todos.find(t => t.type === 'TODO');
      expect(todoItem).toBeDefined();
      expect(todoItem!.content).toBe('Implement this function');

      const fixmeItem = result.todos.find(t => t.type === 'FIXME');
      expect(fixmeItem).toBeDefined();
      expect(fixmeItem!.content).toBe('Fix the bug here');

      const noteItem = result.todos.find(t => t.type === 'NOTE');
      expect(noteItem).toBeDefined();
      expect(noteItem!.content).toBe('This is important');
    });
  });

  describe('Export Analysis', () => {
    it('should extract __all__ exports', async () => {
      const pythonCode = `
__all__ = [
    'public_function',
    'PublicClass',
    'CONSTANT_VALUE'
]

def public_function():
    pass

def _private_function():
    pass

class PublicClass:
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.exports).toHaveLength(3);
      expect(result.exports.map(e => e.name)).toEqual([
        'public_function',
        'PublicClass',
        'CONSTANT_VALUE'
      ]);
    });
  });

  describe('Type Hint Analysis', () => {
    it('should extract type hints from function signatures', async () => {
      const pythonCode = `
from typing import List, Dict, Optional, Union

def process_data(
    items: List[str],
    config: Dict[str, int],
    optional_param: Optional[str] = None
) -> Union[str, None]:
    """Process data with type hints."""
    pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.functions).toHaveLength(1);
      const func = result.functions[0];
      
      expect(func.parameters).toHaveLength(3);
      expect(func.parameters[0].type).toBe('List[str]');
      expect(func.parameters[1].type).toBe('Dict[str, int]');
      expect(func.parameters[2].type).toBe('Optional[str]');
      expect(func.returnType).toBe('Union[str, None]');
    });

    it('should handle complex type annotations', async () => {
      const pythonCode = `
class DataProcessor:
    items: List[Dict[str, Any]]
    
    def __init__(self):
        self.items = []
    
    def process(self, callback: Callable[[str], bool]) -> None:
        pass
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.classes).toHaveLength(1);
      const cls = result.classes[0];
      
      expect(cls.properties).toHaveLength(1);
      expect(cls.properties[0].name).toBe('items');
      expect(cls.properties[0].type).toBe('List[Dict[str, Any]]');
      
      const processMethod = cls.methods.find(m => m.name === 'process');
      expect(processMethod).toBeDefined();
      expect(processMethod!.parameters[0].type).toBe('Callable[[str], bool]');
      expect(processMethod!.returnType).toBe('None');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Python code gracefully', async () => {
      const malformedCode = `
def incomplete_function(
    # Missing closing parenthesis and colon
    
class IncompleteClass
    # Missing colon
    pass
`;

      const result = analyzer.analyze('test.py', malformedCode);

      // Should not throw an error and return empty or partial results
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
      expect(result.classes).toBeDefined();
    });

    it('should handle non-existent files gracefully', async () => {
      const result = analyzer.analyze('non-existent-file.py');

      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
    });

    it('should handle files with encoding issues', async () => {
      // Create a file with potential encoding issues
      const filePath = path.join(tempDir, 'encoding-test.py');
      await fs.writeFile(filePath, 'def test():\n    """Test function."""\n    pass\n', 'utf-8');

      const result = analyzer.analyze(filePath);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('test');
    });
  });

  describe('Real-world Python Features', () => {
    it('should handle complex Python syntax', async () => {
      const pythonCode = `
from abc import ABC, abstractmethod
from typing import Protocol, TypeVar, Generic

T = TypeVar('T')

class Comparable(Protocol):
    def __lt__(self, other: 'Comparable') -> bool: ...

class Repository(ABC, Generic[T]):
    """Abstract repository pattern."""
    
    @abstractmethod
    async def save(self, entity: T) -> T:
        """Save an entity."""
        pass
    
    @abstractmethod
    async def find_by_id(self, id: str) -> Optional[T]:
        """Find entity by ID."""
        pass

@dataclass
class User:
    """User entity."""
    id: str
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)

class UserRepository(Repository[User]):
    """User repository implementation."""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def save(self, user: User) -> User:
        """Save a user to the database."""
        # Implementation here
        return user
    
    async def find_by_id(self, id: str) -> Optional[User]:
        """Find user by ID."""
        # Implementation here
        return None
`;

      const result = analyzer.analyze('test.py', pythonCode);

      expect(result.classes.length).toBeGreaterThan(0);
      expect(result.imports.length).toBeGreaterThan(0);
      
      const userRepo = result.classes.find(c => c.name === 'UserRepository');
      expect(userRepo).toBeDefined();
      expect((userRepo as any).baseClasses).toContain('Repository[User]');
      
      const user = result.classes.find(c => c.name === 'User');
      expect(user).toBeDefined();
      expect((user as any).isDataClass).toBe(true);
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify Python files', () => {
      expect(PythonAnalyzer.isPythonFile('test.py')).toBe(true);
      expect(PythonAnalyzer.isPythonFile('test.pyw')).toBe(true);
      expect(PythonAnalyzer.isPythonFile('test.js')).toBe(false);
      expect(PythonAnalyzer.isPythonFile('test.ts')).toBe(false);
      expect(PythonAnalyzer.isPythonFile('README.md')).toBe(false);
    });
  });
});
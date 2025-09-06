import * as fs from 'fs';
import * as path from 'path';
import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  ParameterInfo,
  PropertyInfo,
  TodoInfo,
} from '../types.js';

export interface PythonClassInfo extends ClassInfo {
  baseClasses?: string[];
  decorators?: string[];
  isDataClass?: boolean;
}

export interface PythonFunctionInfo extends FunctionInfo {
  decorators?: string[];
  isClassMethod?: boolean;
  isStaticMethod?: boolean;
  isProperty?: boolean;
}

/**
 * Python code analyzer using AST parsing and regex patterns
 * Extracts functions, classes, docstrings, type hints, and other Python-specific constructs
 */
export class PythonAnalyzer {
  /**
   * Analyze a Python file and extract semantic information
   */
  public analyze(filePath: string, content?: string): AnalysisResult {
    try {
      // Read file content if not provided
      const sourceCode = content || fs.readFileSync(filePath, 'utf-8');
      
      const result: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };

      // Parse the Python code
      this.parseCode(sourceCode, result);

      return result;
    } catch (error) {
      // Return empty result on error, following graceful degradation principle
      console.error(`Error analyzing Python file ${filePath}:`, error);
      return {
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      };
    }
  }

  /**
   * Parse Python code and extract information
   */
  private parseCode(sourceCode: string, result: AnalysisResult): void {
    const lines = sourceCode.split('\n');
    
    // Track current context
    let currentClass: PythonClassInfo | null = null;
    let currentIndentLevel = 0;
    let inMultilineString = false;
    let multilineStringDelimiter = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Handle multiline strings
      if (inMultilineString) {
        if (trimmedLine.includes(multilineStringDelimiter)) {
          inMultilineString = false;
          multilineStringDelimiter = '';
        }
        continue;
      }

      // Check for multiline string start
      if (trimmedLine.includes('"""') || trimmedLine.includes("'''")) {
        const delimiter = trimmedLine.includes('"""') ? '"""' : "'''";
        const delimiterCount = (trimmedLine.match(new RegExp(delimiter, 'g')) || []).length;
        if (delimiterCount === 1) {
          inMultilineString = true;
          multilineStringDelimiter = delimiter;
        }
        continue;
      }

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        if (trimmedLine.startsWith('#')) {
          this.extractComment(trimmedLine, i + 1, result);
        }
        continue;
      }

      const indentLevel = this.getIndentLevel(line);

      // Check if we've exited the current class
      if (currentClass && indentLevel <= currentIndentLevel) {
        currentClass = null;
      }

      // Parse imports
      if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
        this.parseImport(trimmedLine, result);
      }
      // Parse class definitions
      else if (trimmedLine.startsWith('class ')) {
        currentClass = this.parseClass(trimmedLine, i + 1, lines, result);
        currentIndentLevel = indentLevel;
      }
      // Parse function definitions (including multi-line)
      else if (trimmedLine.startsWith('def ') || (trimmedLine.includes('def ') && !trimmedLine.includes('#'))) {
        const funcDefinition = this.collectFunctionDefinition(i, lines);
        if (funcDefinition) {
          const func = this.parseFunction(funcDefinition.definition, funcDefinition.startLine + 1, lines, currentClass !== null);
          if (func) {
            if (currentClass) {
              currentClass.methods.push(func);
            } else {
              result.functions.push(func);
            }
          }
        }
      }
      // Parse variable assignments (potential properties)
      else if (currentClass && (trimmedLine.includes('=') || (trimmedLine.includes(':') && !trimmedLine.endsWith(':')))) {
        if (!trimmedLine.startsWith('def ') && !trimmedLine.startsWith('class ') && !trimmedLine.startsWith('@')) {
          const property = this.parseProperty(trimmedLine);
          if (property) {
            // Check for duplicates
            const existingProp = currentClass.properties.find(p => p.name === property.name);
            if (!existingProp) {
              currentClass.properties.push(property);
            }
          }
        }
      }
    }

    // Add __all__ exports if found
    this.extractExports(sourceCode, result);
  }

  /**
   * Parse class definition
   */
  private parseClass(line: string, lineNumber: number, lines: string[], result: AnalysisResult): PythonClassInfo | null {
    const classMatch = line.match(/class\s+(\w+)(?:\(([^)]*)\))?:/);
    if (!classMatch) return null;

    const className = classMatch[1];
    const baseClassesStr = classMatch[2];
    const baseClasses = baseClassesStr ? 
      baseClassesStr.split(',').map(bc => bc.trim()).filter(bc => bc) : [];

    // Extract decorators (look at previous lines)
    const decorators: string[] = [];
    for (let i = lineNumber - 2; i >= 0; i--) {
      const prevLine = lines[i].trim();
      if (prevLine.startsWith('@')) {
        decorators.unshift(prevLine.substring(1));
      } else if (prevLine && !prevLine.startsWith('#')) {
        break;
      }
    }

    // Extract docstring
    const docstring = this.extractDocstring(lineNumber, lines);

    const classInfo: PythonClassInfo = {
      name: className,
      methods: [],
      properties: [],
      baseClasses,
      decorators,
      description: docstring,
      isExported: true, // Python classes are generally exportable
      startLine: lineNumber,
      endLine: this.findClassEndLine(lineNumber, lines),
      isDataClass: decorators.some(d => d.includes('dataclass')),
    };

    result.classes.push(classInfo);
    return classInfo;
  }

  /**
   * Collect multi-line function definition
   */
  private collectFunctionDefinition(startIndex: number, lines: string[]): { definition: string; startLine: number } | null {
    let definition = lines[startIndex].trim();
    let currentIndex = startIndex;

    // If the line doesn't end with ':', it might be a multi-line definition
    while (!definition.endsWith(':') && currentIndex < lines.length - 1) {
      currentIndex++;
      const nextLine = lines[currentIndex].trim();
      if (nextLine) {
        definition += ' ' + nextLine;
      }
    }

    return definition.includes('def ') ? { definition, startLine: startIndex } : null;
  }

  /**
   * Parse function definition
   */
  private parseFunction(line: string, lineNumber: number, lines: string[], isMethod: boolean): PythonFunctionInfo | null {
    const funcMatch = line.match(/def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
    if (!funcMatch) return null;

    const funcName = funcMatch[1];
    const paramsStr = funcMatch[2];
    const returnTypeStr = funcMatch[3];

    // Extract decorators
    const decorators: string[] = [];
    for (let i = lineNumber - 2; i >= 0; i--) {
      const prevLine = lines[i].trim();
      if (prevLine.startsWith('@')) {
        decorators.unshift(prevLine.substring(1));
      } else if (prevLine && !prevLine.startsWith('#')) {
        break;
      }
    }

    // Parse parameters
    const parameters = this.parseParameters(paramsStr);

    // Extract docstring
    const docstring = this.extractDocstring(lineNumber, lines);

    // Determine function type
    const isClassMethod = decorators.some(d => d === 'classmethod');
    const isStaticMethod = decorators.some(d => d === 'staticmethod');
    const isProperty = decorators.some(d => d === 'property');
    const isAsync = line.includes('async def');

    const functionInfo: PythonFunctionInfo = {
      name: funcName,
      parameters,
      returnType: returnTypeStr?.trim(),
      description: docstring,
      isAsync,
      isExported: !isMethod, // Module-level functions are exported
      startLine: lineNumber,
      endLine: this.findFunctionEndLine(lineNumber, lines),
      decorators,
      isClassMethod,
      isStaticMethod,
      isProperty,
    };

    return functionInfo;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramsStr: string): ParameterInfo[] {
    if (!paramsStr.trim()) return [];

    // Split parameters while respecting brackets and parentheses
    const params = this.smartSplitParameters(paramsStr);
    const parameters: ParameterInfo[] = [];

    for (const param of params) {
      // Skip 'self' and 'cls' parameters
      if (param === 'self' || param === 'cls') continue;

      // Parse parameter with type hint and default value
      const paramMatch = param.match(/^(\*{0,2})(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
      if (!paramMatch) continue;

      const [, prefix, name, typeHint, defaultValue] = paramMatch;
      
      parameters.push({
        name: prefix + name,
        type: typeHint?.trim(),
        optional: !!defaultValue,
        defaultValue: defaultValue?.trim(),
        description: undefined, // Could be extracted from docstring
      });
    }

    return parameters;
  }

  /**
   * Smart split parameters respecting brackets
   */
  private smartSplitParameters(paramsStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let bracketDepth = 0;
    let parenDepth = 0;

    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      
      if (char === '[') bracketDepth++;
      else if (char === ']') bracketDepth--;
      else if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && bracketDepth === 0 && parenDepth === 0) {
        if (current.trim()) {
          params.push(current.trim());
        }
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      params.push(current.trim());
    }
    
    return params;
  }

  /**
   * Parse property assignment
   */
  private parseProperty(line: string): PropertyInfo | null {
    // Handle self.property with type annotation: self.name: type = value
    const selfTypeMatch = line.match(/^\s*self\.(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (selfTypeMatch) {
      const [, name, typeHint, defaultValue] = selfTypeMatch;
      return {
        name,
        type: typeHint.trim(),
        optional: !!defaultValue,
        readonly: false,
        description: undefined,
      };
    }

    // Handle class-level type annotations: name: type = value or name: type
    const typeAnnotationMatch = line.match(/^\s*(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (typeAnnotationMatch) {
      const [, name, typeHint, defaultValue] = typeAnnotationMatch;
      return {
        name,
        type: typeHint.trim(),
        optional: !!defaultValue,
        readonly: false,
        description: undefined,
      };
    }

    // Handle simple self assignments: self.name = value
    const selfSimpleMatch = line.match(/^\s*self\.(\w+)\s*=\s*(.+)$/);
    if (selfSimpleMatch) {
      return {
        name: selfSimpleMatch[1],
        type: undefined,
        optional: false,
        readonly: false,
        description: undefined,
      };
    }

    // Handle class-level assignments: name = value
    const classLevelMatch = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
    if (classLevelMatch && !line.includes('def ') && !line.includes('class ')) {
      return {
        name: classLevelMatch[1],
        type: undefined,
        optional: false,
        readonly: false,
        description: undefined,
      };
    }

    return null;
  }

  /**
   * Parse import statement
   */
  private parseImport(line: string, result: AnalysisResult): void {
    if (line.startsWith('import ')) {
      // Handle: import module, import module as alias
      const importMatch = line.match(/import\s+(.+)/);
      if (importMatch) {
        const modules = importMatch[1].split(',').map(m => m.trim());
        for (const module of modules) {
          const parts = module.split(' as ');
          const moduleName = parts[0].trim();
          const alias = parts[1]?.trim();
          
          result.imports.push({
            source: moduleName,
            imports: [alias || moduleName],
            isDefault: false,
            isNamespace: true,
          });
        }
      }
    } else if (line.startsWith('from ')) {
      // Handle: from module import item1, item2
      const fromMatch = line.match(/from\s+(\S+)\s+import\s+(.+)/);
      if (fromMatch) {
        const moduleName = fromMatch[1];
        const imports = fromMatch[2].split(',').map(i => i.trim());
        
        result.imports.push({
          source: moduleName,
          imports,
          isDefault: false,
          isNamespace: false,
        });
      }
    }
  }

  /**
   * Extract docstring from function or class
   */
  private extractDocstring(startLine: number, lines: string[]): string | undefined {
    // Look for docstring in the next few lines
    for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
      const line = lines[i].trim();
      
      // Check for triple-quoted strings
      if (line.startsWith('"""') || line.startsWith("'''")) {
        const delimiter = line.startsWith('"""') ? '"""' : "'''";
        
        // Single line docstring
        if (line.endsWith(delimiter) && line.length > 6) {
          return line.slice(3, -3).trim();
        }
        
        // Multi-line docstring
        const docLines: string[] = [];
        let foundEnd = false;
        
        // Add first line content if any
        const firstLineContent = line.substring(3);
        if (firstLineContent && !firstLineContent.startsWith(delimiter)) {
          docLines.push(firstLineContent);
        }
        
        // Look for closing delimiter
        for (let j = i + 1; j < lines.length; j++) {
          const docLine = lines[j];
          if (docLine.includes(delimiter)) {
            const endIndex = docLine.indexOf(delimiter);
            if (endIndex > 0) {
              docLines.push(docLine.substring(0, endIndex));
            }
            foundEnd = true;
            break;
          } else {
            docLines.push(docLine.trim());
          }
        }
        
        if (foundEnd) {
          return docLines.join(' ').trim();
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract comments and TODOs
   */
  private extractComment(line: string, lineNumber: number, result: AnalysisResult): void {
    const comment = line.substring(1).trim();
    
    result.comments.push({
      type: 'single',
      content: comment,
      startLine: lineNumber,
      endLine: lineNumber,
    });

    // Check for TODOs
    const todoMatch = comment.match(/(TODO|FIXME|HACK|NOTE):\s*(.+)/i);
    if (todoMatch) {
      result.todos.push({
        type: todoMatch[1].toUpperCase() as TodoInfo['type'],
        content: todoMatch[2].trim(),
        line: lineNumber,
      });
    }
  }

  /**
   * Extract exports from __all__ declaration
   */
  private extractExports(sourceCode: string, result: AnalysisResult): void {
    const allMatch = sourceCode.match(/__all__\s*=\s*\[(.*?)\]/s);
    if (allMatch) {
      const exportsStr = allMatch[1];
      const exports = exportsStr.split(',')
        .map(e => e.trim().replace(/['"]/g, ''))
        .filter(e => e);
      
      for (const exportName of exports) {
        result.exports.push({
          name: exportName,
          type: 'variable', // Could be refined based on actual analysis
          isDefault: false,
        });
      }
    }
  }

  /**
   * Get indentation level of a line
   */
  private getIndentLevel(line: string): number {
    let level = 0;
    for (const char of line) {
      if (char === ' ') {
        level++;
      } else if (char === '\t') {
        level += 4; // Assume 4 spaces per tab
      } else {
        break;
      }
    }
    return level;
  }

  /**
   * Find the end line of a class definition
   */
  private findClassEndLine(startLine: number, lines: string[]): number {
    const startIndent = this.getIndentLevel(lines[startLine - 1]);
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() && this.getIndentLevel(line) <= startIndent) {
        return i;
      }
    }
    
    return lines.length;
  }

  /**
   * Find the end line of a function definition
   */
  private findFunctionEndLine(startLine: number, lines: string[]): number {
    const startIndent = this.getIndentLevel(lines[startLine - 1]);
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() && this.getIndentLevel(line) <= startIndent) {
        return i;
      }
    }
    
    return lines.length;
  }

  /**
   * Check if a file is a Python file
   */
  public static isPythonFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.py' || ext === '.pyw';
  }
}
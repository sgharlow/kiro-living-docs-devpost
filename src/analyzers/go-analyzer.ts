import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AnalysisResult, FunctionInfo, ClassInfo, InterfaceInfo, ParameterInfo, PropertyInfo, TodoInfo } from '../types.js';

/**
 * Go-specific type information
 */
export interface GoStructInfo extends ClassInfo {
  fields: GoFieldInfo[];
  methods: FunctionInfo[];
  tags?: string;
  isEmbedded?: boolean;
}

export interface GoInterfaceInfo extends InterfaceInfo {
  methods: GoMethodInfo[];
  embeddedInterfaces?: string[];
}

export interface GoFieldInfo extends PropertyInfo {
  tag?: string;
  isEmbedded?: boolean;
  visibility: 'public' | 'private';
}

export interface GoMethodInfo extends FunctionInfo {
  receiver?: {
    name: string;
    type: string;
    isPointer: boolean;
  };
  visibility: 'public' | 'private';
}

export interface GoPackageInfo {
  name: string;
  path: string;
  imports: string[];
  constants: GoConstantInfo[];
  variables: GoVariableInfo[];
  types: GoTypeInfo[];
  functions: GoMethodInfo[];
  structs: GoStructInfo[];
  interfaces: GoInterfaceInfo[];
}

export interface GoConstantInfo {
  name: string;
  type?: string;
  value?: string;
  description?: string;
  visibility: 'public' | 'private';
}

export interface GoVariableInfo {
  name: string;
  type?: string;
  value?: string;
  description?: string;
  visibility: 'public' | 'private';
}

export interface GoTypeInfo {
  name: string;
  underlying: string;
  description?: string;
  visibility: 'public' | 'private';
}

export interface GoModuleInfo {
  name: string;
  version: string;
  goVersion: string;
  dependencies: GoDependencyInfo[];
  packages: GoPackageAnalysis[];
}

export interface GoDependencyInfo {
  name: string;
  version: string;
  indirect: boolean;
}

export interface GoPackageAnalysis {
  name: string;
  path: string;
  files: string[];
  functions: FunctionInfo[];
  structs: ClassInfo[];
  interfaces: InterfaceInfo[];
  constants: GoConstantInfo[];
  variables: GoVariableInfo[];
  imports: any[];
}

/**
 * Go language analyzer using Go AST parser
 * Uses a Go binary to parse Go source code and extract semantic information
 */
export class GoAnalyzer {
  private goParserPath: string;

  constructor() {
    // Path to the Go parser binary (add .exe extension on Windows)
    const binaryName = process.platform === 'win32' ? 'go-parser.exe' : 'go-parser';
    this.goParserPath = path.join(__dirname, 'go-parser', binaryName);
    this.ensureGoParserBuilt();
  }
  
  /**
   * Ensure the Go parser binary is built
   */
  private ensureGoParserBuilt(): void {
    const goParserDir = path.join(__dirname, 'go-parser');
    const goParserBinary = this.goParserPath;
    
    // Check if binary exists and is newer than source
    const mainGoPath = path.join(goParserDir, 'main.go');
    
    try {
      const binaryStats = fs.statSync(goParserBinary);
      const sourceStats = fs.statSync(mainGoPath);
      
      // If binary is newer than source, no need to rebuild
      if (binaryStats.mtime >= sourceStats.mtime) {
        return;
      }
    } catch (error) {
      // Binary doesn't exist, need to build
    }
    
    try {
      // Build the Go parser
      const binaryName = process.platform === 'win32' ? 'go-parser.exe' : 'go-parser';
      execSync(`go build -o ${binaryName} main.go`, {
        cwd: goParserDir,
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('Failed to build Go parser, falling back to regex parsing:', error);
    }
  }

  /**
   * Check if a file is a Go source file
   */
  public static isGoFile(filePath: string): boolean {
    return filePath.endsWith('.go');
  }
  
  /**
   * Analyze a Go source file and extract semantic information
   */
  public analyze(filePath: string, content?: string): AnalysisResult {
    try {
      // If content is provided, write it to a temporary file
      let actualFilePath = filePath;
      let tempFile = false;
      
      if (content) {
        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        actualFilePath = path.join(tempDir, `temp-${Date.now()}.go`);
        fs.writeFileSync(actualFilePath, content);
        tempFile = true;
      }

      let result: AnalysisResult;

      try {
        // Try to use Go parser first
        result = this.parseWithGoParser(actualFilePath);
      } catch (error) {
        console.warn(`Go parser failed for ${filePath}, falling back to regex parsing:`, error);
        console.warn('ℹ️  This is expected on Windows systems. The regex fallback provides functional Go documentation with slightly reduced accuracy.');
        console.warn('ℹ️  For full AST parsing, see the Go Language Support section in README.md');
        // Fall back to regex parsing
        const sourceCode = content || fs.readFileSync(filePath, 'utf-8');
        result = this.parseWithRegex(sourceCode);
      }

      // Clean up temp file
      if (tempFile && fs.existsSync(actualFilePath)) {
        fs.unlinkSync(actualFilePath);
      }

      return result;
    } catch (error) {
      console.error(`Error analyzing Go file ${filePath}:`, error);
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
   * Parse Go source code using the Go AST parser
   */
  private parseWithGoParser(filePath: string): AnalysisResult {
    try {
      const output = execSync(`"${this.goParserPath}" "${filePath}"`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const goResult = JSON.parse(output);
      return this.convertGoResultToAnalysisResult(goResult);
    } catch (error) {
      throw new Error(`Go parser execution failed: ${error}\n\nThis usually means the Go parser binary is not available. The system will automatically fall back to regex parsing, which still provides functional Go documentation.`);
    }
  }

  /**
   * Convert Go parser result to AnalysisResult format
   */
  private convertGoResultToAnalysisResult(goResult: any): AnalysisResult {
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

    // Convert imports
    if (goResult.imports && Array.isArray(goResult.imports)) {
      for (const imp of goResult.imports) {
        result.imports.push({
          source: imp.path,
          imports: imp.alias ? [imp.alias] : ['*'],
          isDefault: false,
          isNamespace: !imp.alias,
        });
      }
    }

    // Convert functions
    if (goResult.functions && Array.isArray(goResult.functions)) {
      for (const fn of goResult.functions) {
        const functionInfo: FunctionInfo = {
          name: fn.name,
          parameters: fn.parameters.map((p: any) => ({
            name: p.name || 'param',
            type: p.type,
            optional: false,
          })),
          returnType: this.formatGoReturnType(fn.results),
          description: fn.doc,
          isAsync: false, // Go doesn't have async/await
          isExported: fn.isExported,
          startLine: fn.startLine,
          endLine: fn.endLine,
        };

        // Add receiver information if it's a method
        if (fn.receiver) {
          (functionInfo as any).receiver = {
            name: fn.receiver.name,
            type: fn.receiver.type,
            isPointer: fn.receiver.isPointer,
          };
        }

        result.functions.push(functionInfo);

        // Add to exports if exported
        if (functionInfo.isExported) {
          result.exports.push({
            name: functionInfo.name,
            type: 'function',
            isDefault: false,
          });
        }
      }
    }

    // Convert structs to classes
    if (goResult.structs && Array.isArray(goResult.structs)) {
      for (const struct of goResult.structs) {
        const classInfo: ClassInfo = {
          name: struct.name,
          methods: [],
          properties: struct.fields.map((field: any) => ({
            name: field.name || field.type, // Handle embedded fields
            type: field.type,
            optional: false,
            readonly: false,
            description: field.tag ? `Tag: ${field.tag}` : field.doc,
          })),
          description: struct.doc,
          isExported: struct.isExported,
          startLine: struct.startLine,
          endLine: struct.endLine,
        };

        // Find methods for this struct
        classInfo.methods = result.functions.filter(fn => 
          (fn as any).receiver && (fn as any).receiver.type === struct.name
        );

        result.classes.push(classInfo);

        // Add to exports if exported
        if (classInfo.isExported) {
          result.exports.push({
            name: classInfo.name,
            type: 'class',
            isDefault: false,
          });
        }
      }
    }

    // Convert interfaces
    if (goResult.interfaces && Array.isArray(goResult.interfaces)) {
      for (const iface of goResult.interfaces) {
        const interfaceInfo: InterfaceInfo = {
          name: iface.name,
          properties: [],
          methods: iface.methods.map((method: any) => ({
            name: method.name,
            parameters: method.parameters.map((p: any) => ({
              name: p.name || 'param',
              type: p.type,
              optional: false,
            })),
            returnType: this.formatGoReturnType(method.results),
            description: method.doc,
            isAsync: false,
            isExported: true,
            startLine: 0,
            endLine: 0,
          })),
          description: iface.doc,
          isExported: iface.isExported,
          startLine: iface.startLine,
          endLine: iface.endLine,
        };

        result.interfaces.push(interfaceInfo);

        // Add to exports if exported
        if (interfaceInfo.isExported) {
          result.exports.push({
            name: interfaceInfo.name,
            type: 'interface',
            isDefault: false,
          });
        }
      }
    }

    // Convert constants
    if (goResult.constants && Array.isArray(goResult.constants)) {
      for (const constant of goResult.constants) {
        if (constant.isExported) {
          result.exports.push({
            name: constant.name,
            type: 'variable',
            isDefault: false,
          });
        }
      }
    }

    // Convert variables
    if (goResult.variables && Array.isArray(goResult.variables)) {
      for (const variable of goResult.variables) {
        if (variable.isExported) {
          result.exports.push({
            name: variable.name,
            type: 'variable',
            isDefault: false,
          });
        }
      }
    }

    // Convert types
    if (goResult.types && Array.isArray(goResult.types)) {
      for (const type of goResult.types) {
        if (type.isExported) {
          result.exports.push({
            name: type.name,
            type: 'type',
            isDefault: false,
          });
        }
      }
    }

    // Convert comments
    if (goResult.comments && Array.isArray(goResult.comments)) {
      for (const comment of goResult.comments) {
        result.comments.push({
          type: 'single',
          content: comment.text.trim(),
          startLine: comment.startLine,
          endLine: comment.endLine,
        });
      }
    }

    // Convert TODOs
    if (goResult.todos && Array.isArray(goResult.todos)) {
      for (const todo of goResult.todos) {
        result.todos.push({
          type: todo.type as TodoInfo['type'],
          content: todo.content,
          line: todo.line,
        });
      }
    }

    return result;
  }

  /**
   * Format Go return types for display
   */
  private formatGoReturnType(results: any[]): string | undefined {
    if (!results || results.length === 0) {
      return undefined;
    }

    if (results.length === 1) {
      return results[0].type;
    }

    return `(${results.map(r => r.type).join(', ')})`;
  }

  /**
   * Parse Go source code using regex patterns (fallback)
   */
  private parseWithRegex(sourceCode: string): AnalysisResult {
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

    // Use the existing regex parsing logic
    this.parseGoSource(sourceCode, result);
    return result;
  }

  /**
   * Parse Go source code using regex patterns (legacy method)
   */
  private parseGoSource(sourceCode: string, result: AnalysisResult): void {
    const lines = sourceCode.split('\n');
    
    // Parse package declaration
    this.parsePackageDeclaration(sourceCode, result);
    
    // Parse imports
    this.parseImports(sourceCode, result);
    
    // Parse functions
    this.parseFunctions(sourceCode, result);
    
    // Parse structs (as classes)
    this.parseStructs(sourceCode, result);
    
    // Parse interfaces
    this.parseInterfaces(sourceCode, result);
    
    // Parse constants and variables
    this.parseConstants(sourceCode, result);
    this.parseVariables(sourceCode, result);
    
    // Parse comments and TODOs
    this.parseComments(lines, result);
  }

  /**
   * Parse package declaration
   */
  private parsePackageDeclaration(sourceCode: string, result: AnalysisResult): void {
    const packageMatch = sourceCode.match(/^package\s+(\w+)/m);
    if (packageMatch) {
      // Package info could be stored in metadata if needed
      result.comments.push({
        content: `Package: ${packageMatch[1]}`,
        type: 'single',
        startLine: 1,
        endLine: 1
      });
    }
  }

  /**
   * Parse import statements
   */
  private parseImports(sourceCode: string, result: AnalysisResult): void {
    // Single import: import "package"
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;
    
    while ((match = singleImportRegex.exec(sourceCode)) !== null) {
      result.imports.push({
        source: match[1],
        imports: ['*'], // Go imports entire package
        isDefault: false,
        isNamespace: true,
      });
    }

    // Multi-line imports: import ( ... )
    const multiImportRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    const multiMatch = multiImportRegex.exec(sourceCode);
    
    if (multiMatch) {
      const importBlock = multiMatch[1];
      const importLines = importBlock.split('\n');
      
      for (const line of importLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          // Handle aliased imports: alias "package"
          const aliasMatch = trimmed.match(/(\w+)\s+"([^"]+)"/);
          if (aliasMatch) {
            result.imports.push({
              source: aliasMatch[2],
              imports: [aliasMatch[1]],
              isDefault: false,
              isNamespace: true,
            });
          } else {
            // Regular import: "package"
            const regularMatch = trimmed.match(/"([^"]+)"/);
            if (regularMatch) {
              result.imports.push({
                source: regularMatch[1],
                imports: ['*'],
                isDefault: false,
                isNamespace: true,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Parse function declarations
   */
  private parseFunctions(sourceCode: string, result: AnalysisResult): void {
    // Function regex: func (receiver)? name(params) (returns)? { ... }
    const functionRegex = /func\s*(?:\(([^)]+)\))?\s*(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|([^{]+?))?\s*\{/g;
    let match;

    while ((match = functionRegex.exec(sourceCode)) !== null) {
      const receiver = match[1];
      const name = match[2];
      const params = match[3] || '';
      const returns = match[4] || match[5] || '';
      
      const functionInfo: FunctionInfo = {
        name,
        parameters: this.parseGoParameters(params),
        returnType: returns.trim() ? (returns.includes(',') ? `(${returns.trim()})` : returns.trim()) : undefined,
        description: this.extractGoDocComment(sourceCode, match.index),
        isAsync: false, // Go doesn't have async/await like JS
        isExported: this.isExported(name),
        startLine: this.getLineNumber(sourceCode, match.index),
        endLine: this.findFunctionEndLine(sourceCode, match.index),
      };

      // If it has a receiver, it's a method
      if (receiver) {
        const receiverInfo = this.parseReceiver(receiver);
        (functionInfo as any).receiver = receiverInfo;
      }

      result.functions.push(functionInfo);
      
      if (functionInfo.isExported) {
        result.exports.push({
          name,
          type: 'function',
          isDefault: false,
        });
      }
    }
  }

  /**
   * Parse struct declarations
   */
  private parseStructs(sourceCode: string, result: AnalysisResult): void {
    const structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
    let match;

    while ((match = structRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      const body = match[2];
      
      const structInfo: ClassInfo = {
        name,
        methods: [],
        properties: this.parseStructFields(body),
        description: this.extractGoDocComment(sourceCode, match.index),
        isExported: this.isExported(name),
        startLine: this.getLineNumber(sourceCode, match.index),
        endLine: this.getLineNumber(sourceCode, match.index + match[0].length),
      };

      // Find methods for this struct
      structInfo.methods = this.findStructMethods(sourceCode, name);

      result.classes.push(structInfo);
      
      if (structInfo.isExported) {
        result.exports.push({
          name,
          type: 'class',
          isDefault: false,
        });
      }
    }
  }

  /**
   * Parse interface declarations
   */
  private parseInterfaces(sourceCode: string, result: AnalysisResult): void {
    const interfaceStartRegex = /type\s+(\w+)\s+interface\s*\{/g;
    let match;

    while ((match = interfaceStartRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      const startPos = match.index + match[0].length;
      
      // Find the matching closing brace
      let braceCount = 1;
      let endPos = startPos;
      
      for (let i = startPos; i < sourceCode.length && braceCount > 0; i++) {
        if (sourceCode[i] === '{') {
          braceCount++;
        } else if (sourceCode[i] === '}') {
          braceCount--;
        }
        endPos = i;
      }
      
      const body = sourceCode.substring(startPos, endPos);
      
      const interfaceInfo: InterfaceInfo = {
        name,
        properties: [],
        methods: this.parseInterfaceMethods(body),
        description: this.extractGoDocComment(sourceCode, match.index),
        isExported: this.isExported(name),
        startLine: this.getLineNumber(sourceCode, match.index),
        endLine: this.getLineNumber(sourceCode, endPos + 1),
      };

      result.interfaces.push(interfaceInfo);
      
      if (interfaceInfo.isExported) {
        result.exports.push({
          name,
          type: 'interface',
          isDefault: false,
        });
      }
    }
  }

  /**
   * Parse constant declarations
   */
  private parseConstants(sourceCode: string, result: AnalysisResult): void {
    // Single const: const Name = value
    const singleConstRegex = /const\s+(\w+)(?:\s+(\w+))?\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = singleConstRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      // const type = match[2];  // Available if needed
      // const value = match[3]; // Available if needed

      if (this.isExported(name)) {
        result.exports.push({
          name,
          type: 'variable',
          isDefault: false,
        });
      }
    }

    // Multi-line const: const ( ... )
    const multiConstRegex = /const\s*\(\s*([\s\S]*?)\s*\)/g;
    const multiMatch = multiConstRegex.exec(sourceCode);
    
    if (multiMatch) {
      const constBlock = multiMatch[1];
      const constLines = constBlock.split('\n');
      
      for (const line of constLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          const constMatch = trimmed.match(/(\w+)(?:\s+(\w+))?\s*=?\s*([^;\n]*)/);
          if (constMatch) {
            const name = constMatch[1];
            if (this.isExported(name)) {
              result.exports.push({
                name,
                type: 'variable',
                isDefault: false,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Parse variable declarations
   */
  private parseVariables(sourceCode: string, result: AnalysisResult): void {
    // Single var: var Name Type = value
    const singleVarRegex = /var\s+(\w+)(?:\s+(\w+))?\s*(?:=\s*([^;\n]+))?/g;
    let match;

    while ((match = singleVarRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      
      if (this.isExported(name)) {
        result.exports.push({
          name,
          type: 'variable',
          isDefault: false,
        });
      }
    }

    // Multi-line var: var ( ... )
    const multiVarRegex = /var\s*\(\s*([\s\S]*?)\s*\)/g;
    const multiMatch = multiVarRegex.exec(sourceCode);
    
    if (multiMatch) {
      const varBlock = multiMatch[1];
      const varLines = varBlock.split('\n');
      
      for (const line of varLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          const varMatch = trimmed.match(/(\w+)(?:\s+(\w+))?\s*(?:=\s*([^;\n]*))?/);
          if (varMatch) {
            const name = varMatch[1];
            if (this.isExported(name)) {
              result.exports.push({
                name,
                type: 'variable',
                isDefault: false,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Parse comments and extract TODOs
   */
  private parseComments(lines: string[], result: AnalysisResult): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Single-line comments
      const singleCommentMatch = line.match(/\/\/\s*(.*)/);
      if (singleCommentMatch) {
        const content = singleCommentMatch[1].trim();
        
        result.comments.push({
          type: 'single',
          content,
          startLine: i + 1,
          endLine: i + 1,
        });

        // Check for TODOs
        this.extractTodoFromComment(content, i + 1, result);
      }

      // Multi-line comments
      const multiStartMatch = line.match(/\/\*(.*)/);
      if (multiStartMatch) {
        let commentContent = multiStartMatch[1];
        let endLine = i + 1;
        
        // Find the end of the multi-line comment
        if (!line.includes('*/')) {
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            commentContent += '\n' + nextLine;
            endLine = j + 1;
            
            if (nextLine.includes('*/')) {
              break;
            }
          }
        }

        // Clean up the comment content
        commentContent = commentContent.replace(/\/\*|\*\//g, '').trim();
        
        result.comments.push({
          type: 'multi',
          content: commentContent,
          startLine: i + 1,
          endLine,
        });

        // Check for TODOs
        this.extractTodoFromComment(commentContent, i + 1, result);
      }
    }
  }

  /**
   * Helper methods
   */

  private parseGoParameters(params: string): ParameterInfo[] {
    if (!params.trim()) return [];

    const parameters: ParameterInfo[] = [];
    const paramParts = params.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Go parameters can be: name type, or just type
      const paramMatch = trimmed.match(/(?:(\w+)\s+)?(.+)/);
      if (paramMatch) {
        const name = paramMatch[1] || 'param';
        const type = paramMatch[2];

        parameters.push({
          name,
          type,
          optional: false, // Go doesn't have optional parameters like TypeScript
        });
      }
    }

    return parameters;
  }

  private parseStructFields(body: string): PropertyInfo[] {
    const fields: PropertyInfo[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Field format: Name Type `tag`
      const fieldMatch = trimmed.match(/(\w+)\s+([^`\s]+)(?:\s+`([^`]*)`)?/);
      if (fieldMatch) {
        const name = fieldMatch[1];
        const type = fieldMatch[2];
        const tag = fieldMatch[3];

        fields.push({
          name,
          type,
          optional: false,
          readonly: false,
          description: tag ? `Tag: ${tag}` : undefined,
        });
      }
    }

    return fields;
  }

  private parseInterfaceMethods(body: string): FunctionInfo[] {
    const methods: FunctionInfo[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Method format: MethodName(params) returns
      const methodMatch = trimmed.match(/(\w+)\s*\(([^)]*)\)\s*(.*)/);
      if (methodMatch) {
        const name = methodMatch[1];
        const params = methodMatch[2];
        const returns = methodMatch[3];

        methods.push({
          name,
          parameters: this.parseGoParameters(params),
          returnType: returns.trim() || undefined,
          isAsync: false,
          isExported: this.isExported(name),
          startLine: 0, // Interface methods don't have implementation
          endLine: 0,
        });
      }
    }

    return methods;
  }

  private findStructMethods(sourceCode: string, structName: string): FunctionInfo[] {
    const methods: FunctionInfo[] = [];
    const methodRegex = new RegExp(`func\\s*\\(\\s*\\w+\\s+\\*?${structName}\\s*\\)\\s*(\\w+)\\s*\\(([^)]*)\\)\\s*(?:\\(([^)]*)\\)|(\\w+(?:\\s*,\\s*\\w+)*))?`, 'g');
    let match;

    while ((match = methodRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      const params = match[2] || '';
      const returns = match[3] || match[4] || '';

      methods.push({
        name,
        parameters: this.parseGoParameters(params),
        returnType: returns.trim() || undefined,
        isAsync: false,
        isExported: this.isExported(name),
        startLine: this.getLineNumber(sourceCode, match.index),
        endLine: this.findFunctionEndLine(sourceCode, match.index),
      });
    }

    return methods;
  }

  private parseReceiver(receiver: string): { name: string; type: string; isPointer: boolean } {
    const receiverMatch = receiver.trim().match(/(\w+)\s+(\*?)(\w+)/);
    if (receiverMatch) {
      return {
        name: receiverMatch[1],
        type: receiverMatch[3],
        isPointer: receiverMatch[2] === '*',
      };
    }
    
    return {
      name: 'self',
      type: receiver.trim(),
      isPointer: false,
    };
  }

  private extractGoDocComment(sourceCode: string, position: number): string | undefined {
    const lines = sourceCode.substring(0, position).split('\n');
    const comments: string[] = [];
    
    // Look backwards for Go doc comments (// comments immediately before the declaration)
    for (let i = lines.length - 2; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (line.startsWith('//')) {
        comments.unshift(line.substring(2).trim());
      } else if (line === '') {
        continue; // Skip empty lines
      } else {
        break; // Stop at non-comment, non-empty line
      }
    }

    return comments.length > 0 ? comments.join(' ') : undefined;
  }

  private extractTodoFromComment(comment: string, line: number, result: AnalysisResult): void {
    const todoPattern = /(TODO|FIXME|HACK|NOTE):\s*(.+)/i;
    const match = comment.match(todoPattern);
    
    if (match) {
      result.todos.push({
        type: match[1].toUpperCase() as TodoInfo['type'],
        content: match[2].trim(),
        line,
      });
    }
  }

  private isExported(name: string): boolean {
    // In Go, exported names start with a capital letter
    return name.length > 0 && name[0] === name[0].toUpperCase();
  }

  private getLineNumber(sourceCode: string, position: number): number {
    return sourceCode.substring(0, position).split('\n').length;
  }

  private findFunctionEndLine(sourceCode: string, startPosition: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startPosition; i < sourceCode.length; i++) {
      const char = sourceCode[i];
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        
        if (inFunction && braceCount === 0) {
          return this.getLineNumber(sourceCode, i);
        }
      }
    }
    
    return this.getLineNumber(sourceCode, startPosition) + 10; // Fallback
  }

  /**
   * Analyze Go module structure and dependencies
   */
  public analyzeGoModule(projectPath: string): GoModuleInfo {
    const moduleInfo: GoModuleInfo = {
      name: '',
      version: '',
      goVersion: '',
      dependencies: [],
      packages: [],
    };

    try {
      // Read go.mod file
      const goModPath = path.join(projectPath, 'go.mod');
      if (fs.existsSync(goModPath)) {
        const goModContent = fs.readFileSync(goModPath, 'utf-8');
        this.parseGoMod(goModContent, moduleInfo);
      }

      // Read go.sum file for dependency versions
      const goSumPath = path.join(projectPath, 'go.sum');
      if (fs.existsSync(goSumPath)) {
        const goSumContent = fs.readFileSync(goSumPath, 'utf-8');
        this.parseGoSum(goSumContent, moduleInfo);
      }

      // Analyze packages in the module
      this.analyzePackages(projectPath, moduleInfo);

    } catch (error) {
      console.error('Error analyzing Go module:', error);
    }

    return moduleInfo;
  }

  /**
   * Parse go.mod file content
   */
  private parseGoMod(content: string, moduleInfo: GoModuleInfo): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Module name
      if (trimmed.startsWith('module ')) {
        moduleInfo.name = trimmed.substring(7).trim();
      }
      
      // Go version
      else if (trimmed.startsWith('go ')) {
        moduleInfo.goVersion = trimmed.substring(3).trim();
      }
      
      // Dependencies
      else if (trimmed.includes(' v') && !trimmed.startsWith('//')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const depName = parts[0];
          const depVersion = parts[1];
          
          if (!moduleInfo.dependencies.find(d => d.name === depName)) {
            moduleInfo.dependencies.push({
              name: depName,
              version: depVersion,
              indirect: trimmed.includes('// indirect'),
            });
          }
        }
      }
    }
  }

  /**
   * Parse go.sum file content
   */
  private parseGoSum(content: string, moduleInfo: GoModuleInfo): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(' ');
      if (parts.length >= 2) {
        const depName = parts[0];
        const depVersion = parts[1];
        
        // Update dependency version if it exists
        const existingDep = moduleInfo.dependencies.find(d => d.name === depName);
        if (existingDep && !existingDep.version.includes('/')) {
          // Keep the cleaner version from go.mod
          continue;
        }
        
        if (!moduleInfo.dependencies.find(d => d.name === depName)) {
          moduleInfo.dependencies.push({
            name: depName,
            version: depVersion,
            indirect: false,
          });
        }
      }
    }
  }

  /**
   * Analyze packages in the Go module
   */
  private analyzePackages(projectPath: string, moduleInfo: GoModuleInfo): void {
    try {
      // Find all Go files in the project
      const goFiles = this.findGoFiles(projectPath);
      const packageMap = new Map<string, string[]>();
      
      // Group files by package
      for (const filePath of goFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const packageMatch = content.match(/^package\s+(\w+)/m);
          if (packageMatch) {
            const relativePath = path.relative(projectPath, path.dirname(filePath));
            const packagePath = relativePath || '.';
            
            if (!packageMap.has(packagePath)) {
              packageMap.set(packagePath, []);
            }
            packageMap.get(packagePath)!.push(filePath);
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
      
      // Analyze each package
      for (const [packagePath, files] of packageMap) {
        // Determine package name from the first file
        let packageName = 'main';
        if (files.length > 0) {
          try {
            const firstFileContent = fs.readFileSync(files[0], 'utf-8');
            const packageMatch = firstFileContent.match(/^package\s+(\w+)/m);
            if (packageMatch) {
              packageName = packageMatch[1];
            }
          } catch (error) {
            // Use default name
          }
        }
        
        const packageInfo: GoPackageAnalysis = {
          name: packageName,
          path: packagePath,
          files: files.map(f => path.relative(projectPath, f)),
          functions: [],
          structs: [],
          interfaces: [],
          constants: [],
          variables: [],
          imports: [],
        };
        
        // Analyze each file in the package
        for (const filePath of files) {
          try {
            const analysis = this.analyze(filePath);
            
            // Merge analysis results
            packageInfo.functions.push(...analysis.functions);
            packageInfo.structs.push(...analysis.classes);
            packageInfo.interfaces.push(...analysis.interfaces);
            
            // Merge imports (deduplicate)
            for (const imp of analysis.imports) {
              if (!packageInfo.imports.find(existing => existing.source === imp.source)) {
                packageInfo.imports.push(imp);
              }
            }
          } catch (error) {
            console.warn(`Failed to analyze file ${filePath}:`, error);
          }
        }
        
        moduleInfo.packages.push(packageInfo);
      }
    } catch (error) {
      console.error('Error analyzing packages:', error);
    }
  }

  /**
   * Find all Go files in a directory recursively
   */
  private findGoFiles(dir: string): string[] {
    const goFiles: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip vendor and hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'vendor') {
            goFiles.push(...this.findGoFiles(fullPath));
          }
        } else if (entry.isFile() && entry.name.endsWith('.go')) {
          // Skip test files for now
          if (!entry.name.endsWith('_test.go')) {
            goFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory not accessible
    }
    
    return goFiles;
  }

  /**
   * Generate Go-specific documentation
   */
  public generateGoDocumentation(packageInfo: GoPackageInfo): string {
    let doc = `# Package ${packageInfo.name}\n\n`;
    
    if (packageInfo.path) {
      doc += `**Import path:** \`${packageInfo.path}\`\n\n`;
    }

    // Constants
    if (packageInfo.constants.length > 0) {
      doc += `## Constants\n\n`;
      for (const constant of packageInfo.constants) {
        doc += `### ${constant.name}\n\n`;
        if (constant.type) {
          doc += `**Type:** \`${constant.type}\`\n\n`;
        }
        if (constant.value) {
          doc += `**Value:** \`${constant.value}\`\n\n`;
        }
        if (constant.description) {
          doc += `${constant.description}\n\n`;
        }
      }
    }

    // Variables
    if (packageInfo.variables.length > 0) {
      doc += `## Variables\n\n`;
      for (const variable of packageInfo.variables) {
        doc += `### ${variable.name}\n\n`;
        if (variable.type) {
          doc += `**Type:** \`${variable.type}\`\n\n`;
        }
        if (variable.description) {
          doc += `${variable.description}\n\n`;
        }
      }
    }

    // Functions
    if (packageInfo.functions.length > 0) {
      doc += `## Functions\n\n`;
      for (const func of packageInfo.functions) {
        doc += `### ${func.name}\n\n`;
        doc += `\`\`\`go\n`;
        doc += `func ${func.name}(`;
        doc += func.parameters.map(p => `${p.name} ${p.type}`).join(', ');
        doc += `)`;
        if (func.returnType) {
          doc += ` ${func.returnType}`;
        }
        doc += `\n\`\`\`\n\n`;
        
        if (func.description) {
          doc += `${func.description}\n\n`;
        }
      }
    }

    // Types (Structs)
    if (packageInfo.structs.length > 0) {
      doc += `## Types\n\n`;
      for (const struct of packageInfo.structs) {
        doc += `### ${struct.name}\n\n`;
        doc += `\`\`\`go\n`;
        doc += `type ${struct.name} struct {\n`;
        for (const field of struct.fields) {
          doc += `    ${field.name} ${field.type}`;
          if (field.tag) {
            doc += ` \`${field.tag}\``;
          }
          doc += `\n`;
        }
        doc += `}\n\`\`\`\n\n`;
        
        if (struct.description) {
          doc += `${struct.description}\n\n`;
        }

        // Methods
        if (struct.methods.length > 0) {
          doc += `#### Methods\n\n`;
          for (const method of struct.methods) {
            doc += `##### ${method.name}\n\n`;
            doc += `\`\`\`go\n`;
            doc += `func (${struct.name.toLowerCase()} *${struct.name}) ${method.name}(`;
            doc += method.parameters.map(p => `${p.name} ${p.type}`).join(', ');
            doc += `)`;
            if (method.returnType) {
              doc += ` ${method.returnType}`;
            }
            doc += `\n\`\`\`\n\n`;
            
            if (method.description) {
              doc += `${method.description}\n\n`;
            }
          }
        }
      }
    }

    // Interfaces
    if (packageInfo.interfaces.length > 0) {
      doc += `## Interfaces\n\n`;
      for (const iface of packageInfo.interfaces) {
        doc += `### ${iface.name}\n\n`;
        doc += `\`\`\`go\n`;
        doc += `type ${iface.name} interface {\n`;
        for (const method of iface.methods) {
          doc += `    ${method.name}(`;
          doc += method.parameters.map(p => `${p.name} ${p.type}`).join(', ');
          doc += `)`;
          if (method.returnType) {
            doc += ` ${method.returnType}`;
          }
          doc += `\n`;
        }
        doc += `}\n\`\`\`\n\n`;
        
        if (iface.description) {
          doc += `${iface.description}\n\n`;
        }
      }
    }

    return doc;
  }

  /**
   * Generate comprehensive Go module documentation
   */
  public generateGoModuleDocumentation(moduleInfo: GoModuleInfo): string {
    let doc = `# ${moduleInfo.name}\n\n`;
    
    if (moduleInfo.goVersion) {
      doc += `**Go Version:** ${moduleInfo.goVersion}\n\n`;
    }

    // Dependencies
    if (moduleInfo.dependencies.length > 0) {
      doc += `## Dependencies\n\n`;
      
      const directDeps = moduleInfo.dependencies.filter(d => !d.indirect);
      const indirectDeps = moduleInfo.dependencies.filter(d => d.indirect);
      
      if (directDeps.length > 0) {
        doc += `### Direct Dependencies\n\n`;
        for (const dep of directDeps) {
          doc += `- **${dep.name}** \`${dep.version}\`\n`;
        }
        doc += '\n';
      }
      
      if (indirectDeps.length > 0) {
        doc += `### Indirect Dependencies\n\n`;
        for (const dep of indirectDeps) {
          doc += `- **${dep.name}** \`${dep.version}\`\n`;
        }
        doc += '\n';
      }
    }

    // Packages
    if (moduleInfo.packages.length > 0) {
      doc += `## Packages\n\n`;
      
      for (const pkg of moduleInfo.packages) {
        doc += `### Package \`${pkg.name}\`\n\n`;
        
        if (pkg.path !== '.') {
          doc += `**Path:** \`${pkg.path}\`\n\n`;
        }
        
        // Package statistics
        doc += `**Files:** ${pkg.files.length} | `;
        doc += `**Functions:** ${pkg.functions.length} | `;
        doc += `**Structs:** ${pkg.structs.length} | `;
        doc += `**Interfaces:** ${pkg.interfaces.length}\n\n`;
        
        // Key exports
        const exportedFunctions = pkg.functions.filter(f => f.isExported);
        const exportedStructs = pkg.structs.filter(s => s.isExported);
        const exportedInterfaces = pkg.interfaces.filter(i => i.isExported);
        
        if (exportedFunctions.length > 0 || exportedStructs.length > 0 || exportedInterfaces.length > 0) {
          doc += `**Key Exports:**\n`;
          
          if (exportedFunctions.length > 0) {
            doc += `- Functions: ${exportedFunctions.map(f => f.name).join(', ')}\n`;
          }
          
          if (exportedStructs.length > 0) {
            doc += `- Structs: ${exportedStructs.map(s => s.name).join(', ')}\n`;
          }
          
          if (exportedInterfaces.length > 0) {
            doc += `- Interfaces: ${exportedInterfaces.map(i => i.name).join(', ')}\n`;
          }
          
          doc += '\n';
        }
        
        // Package imports
        if (pkg.imports.length > 0) {
          const externalImports = pkg.imports.filter(imp => 
            !imp.source.startsWith('.') && 
            !imp.source.includes('internal') &&
            imp.source !== 'C'
          );
          
          if (externalImports.length > 0) {
            doc += `**External Dependencies:** ${externalImports.map(imp => `\`${imp.source}\``).join(', ')}\n\n`;
          }
        }
      }
    }

    return doc;
  }

  /**
   * Generate Go package documentation with enhanced formatting
   */
  public generateGoPackageDocumentation(packageAnalysis: GoPackageAnalysis): string {
    let doc = `# Package ${packageAnalysis.name}\n\n`;
    
    if (packageAnalysis.path !== '.') {
      doc += `**Import path:** \`${packageAnalysis.path}\`\n\n`;
    }

    // Package overview
    doc += `## Overview\n\n`;
    doc += `This package contains ${packageAnalysis.functions.length} functions, `;
    doc += `${packageAnalysis.structs.length} structs, and `;
    doc += `${packageAnalysis.interfaces.length} interfaces.\n\n`;

    // Generate detailed documentation using existing method
    const packageInfo: GoPackageInfo = {
      name: packageAnalysis.name,
      path: packageAnalysis.path,
      imports: packageAnalysis.imports.map(imp => imp.source),
      constants: packageAnalysis.constants || [],
      variables: packageAnalysis.variables || [],
      types: [],
      functions: packageAnalysis.functions.map(f => ({
        ...f,
        visibility: f.isExported ? 'public' : 'private'
      })),
      structs: packageAnalysis.structs.map(s => ({
        ...s,
        fields: s.properties.map(p => ({
          ...p,
          visibility: 'public'
        })),
        methods: s.methods || []
      })),
      interfaces: packageAnalysis.interfaces.map(i => ({
        ...i,
        methods: i.methods.map(m => ({
          ...m,
          visibility: 'public' as const
        }))
      }))
    };

    doc += this.generateGoDocumentation(packageInfo);

    return doc;
  }
}
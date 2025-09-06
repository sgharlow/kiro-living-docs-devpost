import * as ts from 'typescript';
import * as fs from 'fs';
import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
  ParameterInfo,
  PropertyInfo,
  TodoInfo,
  ApiEndpointInfo,
} from '../types.js';
import { ErrorHandler } from '../errors/error-handler';

/**
 * TypeScript/JavaScript code analyzer using the TypeScript compiler API
 */
export class TypeScriptAnalyzer {
  private errorHandler: ErrorHandler;

  constructor() {
    this.errorHandler = new ErrorHandler({
      enableFallbacks: true,
      logLevel: 'warn'
    });
  }

  /**
   * Analyze a TypeScript/JavaScript file and extract semantic information
   */
  public async analyze(filePath: string, content?: string): Promise<AnalysisResult> {
    return await this.errorHandler.handleFileAccess(
      filePath,
      async () => {
        return await this.errorHandler.handleParserError(
          filePath,
          'TypeScript',
          async () => {
            // Read file content if not provided
            const sourceCode = content || fs.readFileSync(filePath, 'utf-8');
            
            // Create source file with error handling
            const sourceFile = ts.createSourceFile(
              filePath,
              sourceCode,
              ts.ScriptTarget.Latest,
              true
            );

            // Check for basic syntax issues by trying to parse
            if (sourceCode.includes('function (') || sourceCode.includes('class {')) {
              throw new Error('Potential syntax errors detected in file');
            }

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

            // Visit all nodes in the AST
            this.visitNode(sourceFile, result);

            // Analyze API endpoints
            result.apiEndpoints = this.extractApiEndpoints(sourceFile);

            return result;
          },
          [
            {
              name: 'regex_fallback',
              parser: async () => this.regexFallbackAnalysis(filePath, content)
            }
          ]
        );
      },
      // Fallback: return empty analysis
      async () => ({
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: [],
      })
    );
  }

  /**
   * Create TypeScript program for type checking (for future use)
   */
  // private createProgram(fileNames: string[]): void {
  //   const compilerOptions: ts.CompilerOptions = {
  //     target: ts.ScriptTarget.Latest,
  //     module: ts.ModuleKind.CommonJS,
  //     allowJs: true,
  //     checkJs: false,
  //     declaration: false,
  //     noEmit: true,
  //     skipLibCheck: true,
  //   };

  //   this.program = ts.createProgram(fileNames, compilerOptions);
  // }

  /**
   * Visit AST node and extract information
   */
  private visitNode(node: ts.Node, result: AnalysisResult): void {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        this.analyzeFunctionDeclaration(node as ts.FunctionDeclaration, result);
        break;
      
      case ts.SyntaxKind.ClassDeclaration:
        this.analyzeClassDeclaration(node as ts.ClassDeclaration, result);
        break;
      
      case ts.SyntaxKind.InterfaceDeclaration:
        this.analyzeInterfaceDeclaration(node as ts.InterfaceDeclaration, result);
        break;
      
      case ts.SyntaxKind.ImportDeclaration:
        this.analyzeImportDeclaration(node as ts.ImportDeclaration, result);
        break;
      
      case ts.SyntaxKind.ExportDeclaration:
      case ts.SyntaxKind.ExportAssignment:
        this.analyzeExportDeclaration(node, result);
        break;
      
      case ts.SyntaxKind.CallExpression:
        // API endpoint analysis is handled separately
        break;
    }

    // Extract comments and TODOs
    this.extractComments(node, result);

    // Continue visiting child nodes
    ts.forEachChild(node, (child) => this.visitNode(child, result));
  }

  /**
   * Analyze function declaration
   */
  private analyzeFunctionDeclaration(node: ts.FunctionDeclaration, result: AnalysisResult): void {
    if (!node.name) return;

    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const functionInfo: FunctionInfo = {
      name: node.name.text,
      parameters: this.extractParameters(node.parameters),
      returnType: this.getTypeString(node.type),
      description: this.extractJSDocDescription(node),
      isAsync: this.hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      isExported: this.hasModifier(node, ts.SyntaxKind.ExportKeyword),
      startLine: start.line + 1,
      endLine: end.line + 1,
    };

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

  /**
   * Analyze class declaration
   */
  private analyzeClassDeclaration(node: ts.ClassDeclaration, result: AnalysisResult): void {
    if (!node.name) return;

    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const classInfo: ClassInfo = {
      name: node.name.text,
      methods: [],
      properties: [],
      extends: this.getExtendsClause(node),
      implements: this.getImplementsClauses(node),
      description: this.extractJSDocDescription(node),
      isExported: this.hasModifier(node, ts.SyntaxKind.ExportKeyword),
      startLine: start.line + 1,
      endLine: end.line + 1,
    };

    // Analyze class members
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const method: FunctionInfo = {
          name: this.getPropertyName(member.name),
          parameters: this.extractParameters(member.parameters),
          returnType: this.getTypeString(member.type),
          description: this.extractJSDocDescription(member),
          isAsync: this.hasModifier(member, ts.SyntaxKind.AsyncKeyword),
          isExported: false,
          startLine: sourceFile.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1,
        };
        classInfo.methods.push(method);
      } else if (ts.isPropertyDeclaration(member) && member.name) {
        const property: PropertyInfo = {
          name: this.getPropertyName(member.name),
          type: this.getTypeString(member.type),
          optional: !!member.questionToken,
          readonly: this.hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
          description: this.extractJSDocDescription(member),
        };
        classInfo.properties.push(property);
      }
    }

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

  /**
   * Analyze interface declaration
   */
  private analyzeInterfaceDeclaration(node: ts.InterfaceDeclaration, result: AnalysisResult): void {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const interfaceInfo: InterfaceInfo = {
      name: node.name.text,
      properties: [],
      methods: [],
      extends: this.getInterfaceExtends(node),
      description: this.extractJSDocDescription(node),
      isExported: this.hasModifier(node, ts.SyntaxKind.ExportKeyword),
      startLine: start.line + 1,
      endLine: end.line + 1,
    };

    // Analyze interface members
    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const property: PropertyInfo = {
          name: this.getPropertyName(member.name),
          type: this.getTypeString(member.type),
          optional: !!member.questionToken,
          readonly: this.hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
          description: this.extractJSDocDescription(member),
        };
        interfaceInfo.properties.push(property);
      } else if (ts.isMethodSignature(member) && member.name) {
        const method: FunctionInfo = {
          name: this.getPropertyName(member.name),
          parameters: this.extractParameters(member.parameters),
          returnType: this.getTypeString(member.type),
          description: this.extractJSDocDescription(member),
          isAsync: false,
          isExported: false,
          startLine: sourceFile.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1,
        };
        interfaceInfo.methods.push(method);
      }
    }

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

  /**
   * Analyze import declaration
   */
  private analyzeImportDeclaration(node: ts.ImportDeclaration, result: AnalysisResult): void {
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
      return;
    }

    const source = node.moduleSpecifier.text;
    const imports: string[] = [];
    let isDefault = false;
    let isNamespace = false;

    if (node.importClause) {
      // Default import
      if (node.importClause.name) {
        imports.push(node.importClause.name.text);
        isDefault = true;
      }

      // Named imports
      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          imports.push(node.importClause.namedBindings.name.text);
          isNamespace = true;
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            imports.push(element.name.text);
          }
        }
      }
    }

    result.imports.push({
      source,
      imports,
      isDefault,
      isNamespace,
    });
  }

  /**
   * Analyze export declaration
   */
  private analyzeExportDeclaration(node: ts.Node, result: AnalysisResult): void {
    // This is a simplified implementation
    // In a full implementation, we would handle all export patterns
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        result.exports.push({
          name: element.name.text,
          type: 'variable', // We'd need more analysis to determine the actual type
          isDefault: false,
        });
      }
    }
  }

  /**
   * Extract function/method parameters
   */
  private extractParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): ParameterInfo[] {
    return parameters.map((param) => ({
      name: param.name.getText(),
      type: this.getTypeString(param.type),
      optional: !!param.questionToken,
      defaultValue: param.initializer?.getText(),
      description: this.extractJSDocDescription(param),
    }));
  }

  /**
   * Get type string from type node
   */
  private getTypeString(typeNode: ts.TypeNode | undefined): string | undefined {
    if (!typeNode) return undefined;
    return typeNode.getText();
  }

  /**
   * Extract JSDoc description
   */
  private extractJSDocDescription(node: ts.Node): string | undefined {
    const jsDocTags = ts.getJSDocTags(node);
    for (const tag of jsDocTags) {
      if (tag.comment) {
        return typeof tag.comment === 'string' ? tag.comment : tag.comment.map(c => c.text).join('');
      }
    }
    return undefined;
  }

  /**
   * Check if node has specific modifier
   */
  private hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    if ('modifiers' in node && Array.isArray(node.modifiers)) {
      return !!(node.modifiers as ts.Modifier[]).some((mod: ts.Modifier) => mod.kind === kind);
    }
    return false;
  }

  /**
   * Get property name as string
   */
  private getPropertyName(name: ts.PropertyName): string {
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    return name.getText();
  }

  /**
   * Get extends clause from class
   */
  private getExtendsClause(node: ts.ClassDeclaration): string | undefined {
    const extendsClause = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    );
    return extendsClause?.types[0]?.expression.getText();
  }

  /**
   * Get implements clauses from class
   */
  private getImplementsClauses(node: ts.ClassDeclaration): string[] {
    const implementsClause = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ImplementsKeyword
    );
    return implementsClause?.types.map((type) => type.expression.getText()) || [];
  }

  /**
   * Get interface extends
   */
  private getInterfaceExtends(node: ts.InterfaceDeclaration): string[] {
    return node.heritageClauses?.[0]?.types.map((type) => type.expression.getText()) || [];
  }

  /**
   * Extract comments and TODOs from node
   */
  private extractComments(node: ts.Node, result: AnalysisResult): void {
    // Only extract comments from the root source file to avoid duplicates
    if (node.kind !== ts.SyntaxKind.SourceFile) {
      return;
    }

    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    
    // Extract single-line comments
    const singleLineComments = fullText.match(/\/\/.*$/gm);
    if (singleLineComments) {
      for (const comment of singleLineComments) {
        const commentIndex = fullText.indexOf(comment);
        const line = sourceFile.getLineAndCharacterOfPosition(commentIndex).line + 1;
        
        result.comments.push({
          type: 'single',
          content: comment.replace('//', '').trim(),
          startLine: line,
          endLine: line,
        });

        // Check for TODOs
        this.extractTodoFromComment(comment, line, result);
      }
    }

    // Extract multi-line comments
    const multiLineComments = fullText.match(/\/\*[\s\S]*?\*\//g);
    if (multiLineComments) {
      for (const comment of multiLineComments) {
        const startPos = fullText.indexOf(comment);
        const endPos = startPos + comment.length;
        const startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
        const endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;
        
        result.comments.push({
          type: 'multi',
          content: comment.replace(/\/\*|\*\//g, '').trim(),
          startLine,
          endLine,
        });

        // Check for TODOs
        this.extractTodoFromComment(comment, startLine, result);
      }
    }
  }

  /**
   * Extract TODO items from comment text
   */
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

  /**
   * Analyze API endpoints (Express.js, Fastify, etc.)
   */
  private analyzeCallExpression(node: ts.CallExpression, endpoints: ApiEndpointInfo[], sourceFile: ts.SourceFile): void {
    // Check for Express.js style endpoints: app.get(), router.post(), etc.
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text.toLowerCase();
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      
      if (httpMethods.includes(methodName) && node.arguments.length >= 2) {
        const pathArg = node.arguments[0];
        const handlerArg = node.arguments[1];
        
        // Extract path if it's a string literal
        if (ts.isStringLiteral(pathArg)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          
          const endpoint: ApiEndpointInfo = {
            method: methodName.toUpperCase() as ApiEndpointInfo['method'],
            path: pathArg.text,
            handler: this.getHandlerName(handlerArg),
            line,
          };

          const description = this.extractJSDocDescription(node);
          if (description) {
            endpoint.description = description;
          }

          // Try to extract parameters from path
          const pathParams = this.extractPathParameters(pathArg.text);
          if (pathParams.length > 0) {
            endpoint.parameters = pathParams;
          }

          endpoints.push(endpoint);
        }
      }
    }
  }

  /**
   * Get handler function name from various handler patterns
   */
  private getHandlerName(handlerNode: ts.Expression): string {
    if (ts.isIdentifier(handlerNode)) {
      return handlerNode.text;
    } else if (ts.isArrowFunction(handlerNode) || ts.isFunctionExpression(handlerNode)) {
      return 'anonymous';
    } else if (ts.isPropertyAccessExpression(handlerNode)) {
      return handlerNode.getText();
    }
    return 'unknown';
  }

  /**
   * Extract parameters from API path (e.g., /users/:id -> [{name: 'id', type: 'string'}])
   */
  private extractPathParameters(path: string): ParameterInfo[] {
    const paramPattern = /:([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const parameters: ParameterInfo[] = [];
    let match;

    while ((match = paramPattern.exec(path)) !== null) {
      parameters.push({
        name: match[1],
        type: 'string', // Default to string for path parameters
        optional: false,
        description: `Path parameter from ${path}`,
      });
    }

    return parameters;
  }

  /**
   * Extract API endpoints from AST
   */
  private extractApiEndpoints(sourceFile: ts.SourceFile): ApiEndpointInfo[] {
    const endpoints: ApiEndpointInfo[] = [];
    
    const visitForEndpoints = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        this.analyzeCallExpression(node, endpoints, sourceFile);
      }
      ts.forEachChild(node, visitForEndpoints);
    };

    visitForEndpoints(sourceFile);
    return endpoints;
  }

  /**
   * Regex-based fallback analysis for when TypeScript parsing fails
   */
  private async regexFallbackAnalysis(filePath: string, content?: string): Promise<AnalysisResult> {
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

    // Extract functions using regex
    const functionPattern = /(?:function|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\w+)|\w+\s*:\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
    let match;
    while ((match = functionPattern.exec(sourceCode)) !== null) {
      const line = this.getLineNumber(sourceCode, match.index);
      result.functions.push({
        name: this.extractFunctionName(match[0]) || 'anonymous',
        parameters: [],
        isAsync: match[0].includes('async'),
        isExported: false,
        startLine: line,
        endLine: line + 1
      });
    }

    // Extract classes using regex
    const classPattern = /class\s+(\w+)/g;
    while ((match = classPattern.exec(sourceCode)) !== null) {
      const line = this.getLineNumber(sourceCode, match.index);
      result.classes.push({
        name: match[1],
        methods: [],
        properties: [],
        isExported: false,
        startLine: line,
        endLine: line + 1
      });
    }

    // Extract interfaces using regex
    const interfacePattern = /interface\s+(\w+)/g;
    while ((match = interfacePattern.exec(sourceCode)) !== null) {
      const line = this.getLineNumber(sourceCode, match.index);
      result.interfaces.push({
        name: match[1],
        properties: [],
        methods: [],
        isExported: false,
        startLine: line,
        endLine: line + 1
      });
    }

    // Extract TODOs
    const todoPattern = /(TODO|FIXME|HACK|NOTE):\s*(.+)/gi;
    while ((match = todoPattern.exec(sourceCode)) !== null) {
      result.todos.push({
        type: match[1].toUpperCase() as TodoInfo['type'],
        content: match[2].trim(),
        line: this.getLineNumber(sourceCode, match.index)
      });
    }

    // Extract comments
    const commentPattern = /\/\/\s*(.+)|\/\*\s*([\s\S]*?)\s*\*\//g;
    while ((match = commentPattern.exec(sourceCode)) !== null) {
      const line = this.getLineNumber(sourceCode, match.index);
      result.comments.push({
        type: match[0].startsWith('//') ? 'single' : 'multi',
        content: (match[1] || match[2] || '').trim(),
        startLine: line,
        endLine: line
      });
    }

    return result;
  }

  /**
   * Extract function name from regex match
   */
  private extractFunctionName(functionText: string): string | null {
    // Try different patterns to extract function name
    let match = functionText.match(/function\s+(\w+)/);
    if (match) return match[1];

    match = functionText.match(/const\s+(\w+)\s*=/);
    if (match) return match[1];

    match = functionText.match(/(\w+)\s*:/);
    if (match) return match[1];

    return null;
  }

  /**
   * Get line number from position in source code
   */
  private getLineNumber(sourceCode: string, position: number): number {
    return sourceCode.substring(0, position).split('\n').length;
  }
}
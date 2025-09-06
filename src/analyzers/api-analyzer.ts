import * as ts from 'typescript';
import * as fs from 'fs';
import {
  ApiEndpointInfo,
  ParameterInfo,
} from '../types.js';

/**
 * Enhanced API endpoint analyzer for various web frameworks
 */
export class ApiAnalyzer {
  
  /**
   * Analyze a file for API endpoints across different frameworks
   */
  public analyzeApiEndpoints(filePath: string, content?: string): ApiEndpointInfo[] {
    try {
      const sourceCode = content || fs.readFileSync(filePath, 'utf-8');
      
      // Try TypeScript/JavaScript analysis first
      if (filePath.match(/\.(ts|js|mjs)$/)) {
        return this.analyzeJavaScriptApi(filePath, sourceCode);
      }
      
      // For other file types, use regex-based analysis
      return this.analyzeGenericApi(sourceCode);
    } catch (error) {
      console.error(`Error analyzing API endpoints in ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Analyze JavaScript/TypeScript files using AST
   */
  private analyzeJavaScriptApi(filePath: string, sourceCode: string): ApiEndpointInfo[] {
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const endpoints: ApiEndpointInfo[] = [];
    this.visitNodeForApi(sourceFile, endpoints);
    return endpoints;
  }

  /**
   * Visit AST nodes to find API endpoints
   */
  private visitNodeForApi(node: ts.Node, endpoints: ApiEndpointInfo[]): void {
    switch (node.kind) {
      case ts.SyntaxKind.CallExpression:
        this.analyzeCallExpression(node as ts.CallExpression, endpoints);
        break;
      
      case ts.SyntaxKind.MethodDeclaration:
        this.analyzeMethodDeclaration(node as ts.MethodDeclaration, endpoints);
        break;
    }

    ts.forEachChild(node, (child) => this.visitNodeForApi(child, endpoints));
  }

  /**
   * Analyze call expressions for framework-specific patterns
   */
  private analyzeCallExpression(node: ts.CallExpression, endpoints: ApiEndpointInfo[]): void {
    // Express.js style: app.get(), router.post(), etc.
    if (ts.isPropertyAccessExpression(node.expression)) {
      const endpoint = this.analyzeExpressStyleEndpoint(node);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
    
    // Fastify style: fastify.register(), etc.
    if (ts.isPropertyAccessExpression(node.expression)) {
      const endpoint = this.analyzeFastifyStyleEndpoint(node);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
  }

  /**
   * Analyze method declarations for decorator-based frameworks (NestJS, etc.)
   */
  private analyzeMethodDeclaration(node: ts.MethodDeclaration, endpoints: ApiEndpointInfo[]): void {
    const decorators = ts.getDecorators(node);
    if (!decorators) return;

    for (const decorator of decorators) {
      const endpoint = this.analyzeDecoratorEndpoint(decorator, node);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
  }

  /**
   * Analyze Express.js style endpoints
   */
  private analyzeExpressStyleEndpoint(node: ts.CallExpression): ApiEndpointInfo | null {
    if (!ts.isPropertyAccessExpression(node.expression)) return null;

    const methodName = node.expression.name.text.toLowerCase();
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'];
    
    if (!httpMethods.includes(methodName) || node.arguments.length < 2) {
      return null;
    }

    const pathArg = node.arguments[0];
    if (!ts.isStringLiteral(pathArg)) return null;

    const sourceFile = node.getSourceFile();
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    
    const endpoint: ApiEndpointInfo = {
      method: methodName === 'all' ? 'GET' : methodName.toUpperCase() as ApiEndpointInfo['method'],
      path: pathArg.text,
      handler: this.getHandlerName(node.arguments[1]),
      line,
    };

    // Extract middleware and handler information
    const middlewareInfo = this.extractMiddlewareInfo(node.arguments.slice(1, -1));
    if (middlewareInfo.length > 0) {
      endpoint.description = `Middleware: ${middlewareInfo.join(', ')}`;
    }

    // Extract parameters from path and handler
    endpoint.parameters = this.extractAllParameters(pathArg.text, node.arguments[node.arguments.length - 1]);

    return endpoint;
  }

  /**
   * Analyze Fastify style endpoints
   */
  private analyzeFastifyStyleEndpoint(node: ts.CallExpression): ApiEndpointInfo | null {
    if (!ts.isPropertyAccessExpression(node.expression)) return null;

    const methodName = node.expression.name.text.toLowerCase();
    
    // Fastify uses fastify.route() or fastify.register()
    if (methodName === 'route' && node.arguments.length >= 1) {
      return this.analyzeFastifyRouteObject(node.arguments[0], node);
    }

    return null;
  }

  /**
   * Analyze Fastify route object
   */
  private analyzeFastifyRouteObject(routeArg: ts.Expression, node: ts.CallExpression): ApiEndpointInfo | null {
    if (!ts.isObjectLiteralExpression(routeArg)) return null;

    let method: string | undefined;
    let path: string | undefined;
    let handler: string | undefined;

    for (const property of routeArg.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const propName = property.name.text;
        
        if (propName === 'method' && ts.isStringLiteral(property.initializer)) {
          method = property.initializer.text.toUpperCase();
        } else if (propName === 'url' && ts.isStringLiteral(property.initializer)) {
          path = property.initializer.text;
        } else if (propName === 'handler') {
          handler = this.getHandlerName(property.initializer);
        }
      }
    }

    if (!method || !path) return null;

    const sourceFile = node.getSourceFile();
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    return {
      method: method as ApiEndpointInfo['method'],
      path,
      handler: handler || 'unknown',
      parameters: this.extractPathParameters(path),
      line,
    };
  }

  /**
   * Analyze decorator-based endpoints (NestJS, etc.)
   */
  private analyzeDecoratorEndpoint(decorator: ts.Decorator, method: ts.MethodDeclaration): ApiEndpointInfo | null {
    if (!ts.isCallExpression(decorator.expression)) return null;

    const decoratorName = decorator.expression.expression.getText();
    const httpMethods = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'];
    
    if (!httpMethods.includes(decoratorName)) return null;

    let path = '';
    if (decorator.expression.arguments.length > 0) {
      const pathArg = decorator.expression.arguments[0];
      if (ts.isStringLiteral(pathArg)) {
        path = pathArg.text;
      }
    }

    const sourceFile = method.getSourceFile();
    const line = sourceFile.getLineAndCharacterOfPosition(method.getStart()).line + 1;

    return {
      method: decoratorName.toUpperCase() as ApiEndpointInfo['method'],
      path,
      handler: method.name?.getText() || 'unknown',
      parameters: this.extractMethodParameters(method),
      line,
    };
  }

  /**
   * Extract middleware information from arguments
   */
  private extractMiddlewareInfo(middlewareArgs: ts.Expression[]): string[] {
    return middlewareArgs.map(arg => {
      if (ts.isIdentifier(arg)) {
        return arg.text;
      } else if (ts.isCallExpression(arg)) {
        return arg.expression.getText();
      }
      return 'middleware';
    });
  }

  /**
   * Extract all parameters (path + query + body) from endpoint
   */
  private extractAllParameters(path: string, handlerArg: ts.Expression): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    // Path parameters
    parameters.push(...this.extractPathParameters(path));
    
    // Handler parameters (req, res, next, etc.)
    if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
      parameters.push(...this.extractHandlerParameters(handlerArg));
    }

    return parameters;
  }

  /**
   * Extract parameters from API path
   */
  private extractPathParameters(path: string): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    // Express.js style parameters (:id)
    const expressParams = path.match(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    if (expressParams) {
      for (const param of expressParams) {
        parameters.push({
          name: param.substring(1),
          type: 'string',
          optional: false,
          description: `Path parameter from ${path}`,
        });
      }
    }

    // Fastify/OpenAPI style parameters ({id})
    const fastifyParams = path.match(/\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g);
    if (fastifyParams) {
      for (const param of fastifyParams) {
        const paramName = param.slice(1, -1);
        parameters.push({
          name: paramName,
          type: 'string',
          optional: false,
          description: `Path parameter from ${path}`,
        });
      }
    }

    return parameters;
  }

  /**
   * Extract parameters from handler function
   */
  private extractHandlerParameters(handler: ts.ArrowFunction | ts.FunctionExpression): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    for (const param of handler.parameters) {
      if (ts.isIdentifier(param.name)) {
        const paramName = param.name.text;
        let paramType = 'any';
        let description = '';

        // Common Express.js parameter patterns
        if (paramName === 'req' || paramName === 'request') {
          paramType = 'Request';
          description = 'Express request object';
        } else if (paramName === 'res' || paramName === 'response') {
          paramType = 'Response';
          description = 'Express response object';
        } else if (paramName === 'next') {
          paramType = 'NextFunction';
          description = 'Express next function';
        }

        parameters.push({
          name: paramName,
          type: paramType,
          optional: !!param.questionToken,
          description,
        });
      }
    }

    return parameters;
  }

  /**
   * Extract parameters from method declaration (for decorator-based frameworks)
   */
  private extractMethodParameters(method: ts.MethodDeclaration): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    for (const param of method.parameters) {
      if (ts.isIdentifier(param.name)) {
        parameters.push({
          name: param.name.text,
          type: param.type?.getText() || 'any',
          optional: !!param.questionToken,
          description: this.extractParameterDescription(param),
        });
      }
    }

    return parameters;
  }

  /**
   * Extract parameter description from decorators or JSDoc
   */
  private extractParameterDescription(param: ts.ParameterDeclaration): string | undefined {
    // Check for parameter decorators (e.g., @Body(), @Query(), @Param())
    const decorators = ts.getDecorators(param);
    if (decorators) {
      for (const decorator of decorators) {
        if (ts.isCallExpression(decorator.expression)) {
          const decoratorName = decorator.expression.expression.getText();
          return `${decoratorName} parameter`;
        }
      }
    }

    return undefined;
  }

  /**
   * Get handler function name
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
   * Analyze generic API patterns using regex (fallback for non-JS files)
   */
  private analyzeGenericApi(content: string): ApiEndpointInfo[] {
    const endpoints: ApiEndpointInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for common API patterns
      const patterns = [
        // Express.js style
        { pattern: /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/i, type: 'express' },
        // FastAPI style
        { pattern: /@app\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/i, type: 'fastapi' },
        // Flask style with methods
        { pattern: /@app\.route\s*\(\s*['"`]([^'"`]+)['"`].*methods\s*=\s*\[['"`]([^'"`]+)['"`]\]/i, type: 'flask' },
      ];

      for (const { pattern, type } of patterns) {
        const match = line.match(pattern);
        if (match) {
          let method: string;
          let path: string;

          if (type === 'flask' && match.length >= 3) {
            // Flask style - path first, then method
            path = match[1];
            method = match[2].toUpperCase();
          } else if (match.length >= 3) {
            // Express/FastAPI style - method first, then path
            method = match[1].toUpperCase();
            path = match[2];
          } else {
            continue;
          }

          endpoints.push({
            method: method as ApiEndpointInfo['method'],
            path,
            handler: 'unknown',
            parameters: this.extractPathParameters(path),
            line: i + 1,
          });
          
          // Break after first match to avoid duplicates
          break;
        }
      }
    }

    return endpoints;
  }
}
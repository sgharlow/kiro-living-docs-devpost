import { ApiEndpointInfo, ParameterInfo, ProjectAnalysis } from '../types.js';

/**
 * OpenAPI 3.0 specification interfaces
 */
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: OpenAPIPaths;
  components?: OpenAPIComponents;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPIPaths {
  [path: string]: OpenAPIPathItem;
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: OpenAPIResponses;
  tags?: string[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema: OpenAPISchema;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: OpenAPISchema;
      example?: any;
    };
  };
}

export interface OpenAPIResponses {
  [statusCode: string]: OpenAPIResponse;
}

export interface OpenAPIResponse {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: OpenAPISchema;
      example?: any;
    };
  };
}

export interface OpenAPISchema {
  type?: string;
  format?: string;
  items?: OpenAPISchema;
  properties?: { [name: string]: OpenAPISchema };
  required?: string[];
  example?: any;
  description?: string;
}

export interface OpenAPIComponents {
  schemas?: { [name: string]: OpenAPISchema };
  parameters?: { [name: string]: OpenAPIParameter };
  responses?: { [name: string]: OpenAPIResponse };
}

/**
 * OpenAPI specification generator
 */
export class OpenAPIGenerator {
  
  /**
   * Generate OpenAPI specification from project analysis
   */
  public generateOpenAPISpec(analysis: ProjectAnalysis): OpenAPISpec {
    const allEndpoints = this.collectAllEndpoints(analysis);
    
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: this.generateInfo(analysis),
      servers: this.generateServers(),
      paths: this.generatePaths(allEndpoints),
      components: this.generateComponents(allEndpoints),
    };

    return spec;
  }

  /**
   * Generate OpenAPI specification as JSON string
   */
  public generateOpenAPIJson(analysis: ProjectAnalysis): string {
    const spec = this.generateOpenAPISpec(analysis);
    return JSON.stringify(spec, null, 2);
  }

  /**
   * Generate OpenAPI specification as YAML string
   */
  public generateOpenAPIYaml(analysis: ProjectAnalysis): string {
    const spec = this.generateOpenAPISpec(analysis);
    return this.jsonToYaml(spec);
  }

  /**
   * Collect all API endpoints from analysis results
   */
  private collectAllEndpoints(analysis: ProjectAnalysis): ApiEndpointInfo[] {
    const endpoints: ApiEndpointInfo[] = [];
    
    for (const [, fileAnalysis] of analysis.files) {
      endpoints.push(...fileAnalysis.apiEndpoints);
    }

    return endpoints;
  }

  /**
   * Generate OpenAPI info section
   */
  private generateInfo(analysis: ProjectAnalysis): OpenAPIInfo {
    return {
      title: analysis.metadata.name || 'API Documentation',
      version: analysis.metadata.version || '1.0.0',
      description: analysis.metadata.description || 'Auto-generated API documentation',
      contact: {
        name: 'Development Team',
      },
    };
  }

  /**
   * Generate default servers
   */
  private generateServers(): OpenAPIServer[] {
    return [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ];
  }

  /**
   * Generate paths section from endpoints
   */
  private generatePaths(endpoints: ApiEndpointInfo[]): OpenAPIPaths {
    const paths: OpenAPIPaths = {};

    for (const endpoint of endpoints) {
      const normalizedPath = this.normalizePathForOpenAPI(endpoint.path);
      
      if (!paths[normalizedPath]) {
        paths[normalizedPath] = {};
      }

      const operation = this.generateOperation(endpoint);
      const method = endpoint.method.toLowerCase() as keyof OpenAPIPathItem;
      
      (paths[normalizedPath] as any)[method] = operation;
    }

    return paths;
  }

  /**
   * Generate operation object for an endpoint
   */
  private generateOperation(endpoint: ApiEndpointInfo): OpenAPIOperation {
    const operation: OpenAPIOperation = {
      summary: this.generateSummary(endpoint),
      description: endpoint.description || this.generateDescription(endpoint),
      operationId: this.generateOperationId(endpoint),
      parameters: this.generateParameters(endpoint),
      responses: this.generateResponses(endpoint),
      tags: this.generateTags(endpoint),
    };

    // Add request body for methods that typically have one
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      operation.requestBody = this.generateRequestBody(endpoint);
    }

    return operation;
  }

  /**
   * Generate operation summary
   */
  private generateSummary(endpoint: ApiEndpointInfo): string {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'resource';
    
    const actionMap: { [key: string]: string } = {
      'GET': 'Get',
      'POST': 'Create',
      'PUT': 'Update',
      'PATCH': 'Partially update',
      'DELETE': 'Delete',
      'OPTIONS': 'Get options for',
      'HEAD': 'Get headers for',
    };

    return `${actionMap[endpoint.method] || endpoint.method} ${resource}`;
  }

  /**
   * Generate operation description
   */
  private generateDescription(endpoint: ApiEndpointInfo): string {
    return `${endpoint.method} ${endpoint.path} - Handled by ${endpoint.handler}`;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(endpoint: ApiEndpointInfo): string {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts.join('_') || 'resource';
    return `${endpoint.method.toLowerCase()}_${resource}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Generate parameters for an endpoint
   */
  private generateParameters(endpoint: ApiEndpointInfo): OpenAPIParameter[] {
    const parameters: OpenAPIParameter[] = [];

    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        // Skip framework-specific parameters
        if (['req', 'res', 'next', 'request', 'response'].includes(param.name)) {
          continue;
        }

        const openApiParam: OpenAPIParameter = {
          name: param.name,
          in: this.determineParameterLocation(param, endpoint.path),
          required: !param.optional,
          schema: this.generateSchemaFromType(param.type),
        };
        
        if (param.description) {
          openApiParam.description = param.description;
        }

        parameters.push(openApiParam);
      }
    }

    // Add common query parameters for GET requests
    if (endpoint.method === 'GET' && this.isCollectionEndpoint(endpoint.path)) {
      parameters.push(
        {
          name: 'limit',
          in: 'query',
          required: false,
          description: 'Number of items to return',
          schema: { type: 'integer', format: 'int32', example: 10 },
        },
        {
          name: 'offset',
          in: 'query',
          required: false,
          description: 'Number of items to skip',
          schema: { type: 'integer', format: 'int32', example: 0 },
        }
      );
    }

    return parameters;
  }

  /**
   * Determine parameter location (path, query, header, cookie)
   */
  private determineParameterLocation(param: ParameterInfo, path: string): 'query' | 'header' | 'path' | 'cookie' {
    // Check if parameter is in the path
    if (path.includes(`:${param.name}`) || path.includes(`{${param.name}}`)) {
      return 'path';
    }

    // Common header parameters
    if (['authorization', 'content-type', 'accept'].includes(param.name.toLowerCase())) {
      return 'header';
    }

    // Default to query parameter
    return 'query';
  }

  /**
   * Generate request body for POST/PUT/PATCH operations
   */
  private generateRequestBody(endpoint: ApiEndpointInfo): OpenAPIRequestBody {
    return {
      description: `Request body for ${endpoint.method} ${endpoint.path}`,
      required: true,
      content: {
        'application/json': {
          schema: this.generateRequestSchema(endpoint),
          example: this.generateRequestExample(endpoint),
        },
      },
    };
  }

  /**
   * Generate responses for an endpoint
   */
  private generateResponses(endpoint: ApiEndpointInfo): OpenAPIResponses {
    const responses: OpenAPIResponses = {};

    // Success responses
    if (endpoint.method === 'POST') {
      responses['201'] = {
        description: 'Created successfully',
        content: {
          'application/json': {
            schema: this.generateResponseSchema(endpoint),
            example: this.generateResponseExample(endpoint),
          },
        },
      };
    } else if (endpoint.method === 'DELETE') {
      responses['204'] = {
        description: 'Deleted successfully',
      };
    } else {
      responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: this.generateResponseSchema(endpoint),
            example: this.generateResponseExample(endpoint),
          },
        },
      };
    }

    // Error responses
    responses['400'] = {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          example: {
            error: 'Bad Request',
            message: 'Invalid input parameters',
          },
        },
      },
    };

    responses['500'] = {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          example: {
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
          },
        },
      },
    };

    return responses;
  }

  /**
   * Generate tags for grouping operations
   */
  private generateTags(endpoint: ApiEndpointInfo): string[] {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    return pathParts.length > 0 ? [pathParts[0]] : ['default'];
  }

  /**
   * Generate components section
   */
  private generateComponents(endpoints: ApiEndpointInfo[]): OpenAPIComponents {
    return {
      schemas: {
        ...this.generateCommonSchemas(),
        // Add endpoint-specific schemas
        ...this.generateEndpointSchemas(endpoints),
      },
    };
  }

  /**
   * Generate endpoint-specific schemas
   */
  private generateEndpointSchemas(endpoints: ApiEndpointInfo[]): Record<string, any> {
    const schemas: Record<string, any> = {};
    
    endpoints.forEach(endpoint => {
      if (endpoint.parameters) {
        schemas[`${endpoint.method}${endpoint.path.replace(/[^a-zA-Z0-9]/g, '')}Request`] = {
          type: 'object',
          properties: endpoint.parameters.reduce((props: any, param) => {
            props[param.name] = { type: param.type || 'string' };
            return props;
          }, {}),
        };
      }
    });
    
    return schemas;
  }

  /**
   * Generate common schemas
   */
  private generateCommonSchemas(): { [name: string]: OpenAPISchema } {
    return {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['error', 'message'],
      },
    };
  }

  /**
   * Generate schema from TypeScript type string
   */
  private generateSchemaFromType(type?: string): OpenAPISchema {
    if (!type) {
      return { type: 'string' };
    }

    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('string')) {
      return { type: 'string' };
    } else if (lowerType.includes('number') || lowerType.includes('int')) {
      return { type: 'integer' };
    } else if (lowerType.includes('boolean')) {
      return { type: 'boolean' };
    } else if (lowerType.includes('array') || lowerType.includes('[]')) {
      return { type: 'array', items: { type: 'string' } };
    } else if (lowerType.includes('object')) {
      return { type: 'object' };
    }

    return { type: 'string' };
  }

  /**
   * Generate request schema for an endpoint
   */
  private generateRequestSchema(endpoint: ApiEndpointInfo): OpenAPISchema {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    return {
      type: 'object',
      properties: {
        name: { type: 'string', description: `${resource} name` },
        description: { type: 'string', description: `${resource} description` },
      },
      required: ['name'],
    };
  }

  /**
   * Generate response schema for an endpoint
   */
  private generateResponseSchema(endpoint: ApiEndpointInfo): OpenAPISchema {
    if (this.isCollectionEndpoint(endpoint.path) && endpoint.method === 'GET') {
      return {
        type: 'array',
        items: this.generateItemSchema(endpoint),
      };
    }

    return this.generateItemSchema(endpoint);
  }

  /**
   * Generate item schema
   */
  private generateItemSchema(endpoint: ApiEndpointInfo): OpenAPISchema {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    return {
      type: 'object',
      properties: {
        id: { type: 'string', description: `${resource} ID` },
        name: { type: 'string', description: `${resource} name` },
        description: { type: 'string', description: `${resource} description` },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
      },
      required: ['id', 'name'],
    };
  }

  /**
   * Generate request example
   */
  private generateRequestExample(endpoint: ApiEndpointInfo): any {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    return {
      name: `Example ${resource}`,
      description: `This is an example ${resource}`,
    };
  }

  /**
   * Generate response example
   */
  private generateResponseExample(endpoint: ApiEndpointInfo): any {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    const item = {
      id: '123',
      name: `Example ${resource}`,
      description: `This is an example ${resource}`,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    if (this.isCollectionEndpoint(endpoint.path) && endpoint.method === 'GET') {
      return [item];
    }

    return item;
  }

  /**
   * Check if endpoint represents a collection (list) resource
   */
  private isCollectionEndpoint(path: string): boolean {
    // Simple heuristic: if path doesn't end with a parameter, it's likely a collection
    return !path.match(/[:{}][^/]*$/);
  }

  /**
   * Normalize path for OpenAPI (convert Express :param to OpenAPI {param})
   */
  private normalizePathForOpenAPI(path: string): string {
    return path.replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '{$1}');
  }

  /**
   * Convert JSON to YAML (simple implementation)
   */
  private jsonToYaml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        yaml += `${spaces}- ${this.jsonToYaml(item, indent + 1).trim()}\n`;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          yaml += `${spaces}${key}:\n${this.jsonToYaml(value, indent + 1)}`;
        } else {
          yaml += `${spaces}${key}: ${this.formatYamlValue(value)}\n`;
        }
      }
    } else {
      return this.formatYamlValue(obj);
    }

    return yaml;
  }

  /**
   * Format value for YAML output
   */
  private formatYamlValue(value: any): string {
    if (typeof value === 'string') {
      // Quote strings that contain special characters
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }
}
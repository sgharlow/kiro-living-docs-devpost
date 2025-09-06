import { ApiEndpointInfo, ProjectAnalysis } from '../types.js';
import { OpenAPIGenerator, OpenAPISpec } from './openapi-generator.js';

/**
 * Interactive API documentation generator
 */
export class ApiDocsGenerator {
  private openApiGenerator: OpenAPIGenerator;

  constructor() {
    this.openApiGenerator = new OpenAPIGenerator();
  }

  /**
   * Generate interactive API documentation HTML
   */
  public generateInteractiveApiDocs(analysis: ProjectAnalysis): string {
    const endpoints = this.collectAllEndpoints(analysis);
    const openApiSpec = this.openApiGenerator.generateOpenAPISpec(analysis);

    return this.generateApiDocsHtml(endpoints, openApiSpec);
  }

  /**
   * Generate API documentation as markdown
   */
  public generateApiDocsMarkdown(analysis: ProjectAnalysis): string {
    const endpoints = this.collectAllEndpoints(analysis);
    const openApiSpec = this.openApiGenerator.generateOpenAPISpec(analysis);

    let markdown = `# API Documentation\n\n`;
    markdown += `${openApiSpec.info.description}\n\n`;

    // Group endpoints by tags/paths
    const groupedEndpoints = this.groupEndpointsByPath(endpoints);

    for (const [path, pathEndpoints] of groupedEndpoints) {
      markdown += `## ${path}\n\n`;

      for (const endpoint of pathEndpoints) {
        markdown += this.generateEndpointMarkdown(endpoint);
      }
    }

    // Add OpenAPI specification
    markdown += `## OpenAPI Specification\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(openApiSpec, null, 2)}\n\`\`\`\n\n`;

    return markdown;
  }

  /**
   * Generate request/response examples for an endpoint
   */
  public generateEndpointExamples(endpoint: ApiEndpointInfo): {
    request?: any;
    response?: any;
    curl?: string;
  } {
    const examples: any = {};

    // Generate request example for methods that have request bodies
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      examples.request = this.generateRequestExample(endpoint);
    }

    // Generate response example
    examples.response = this.generateResponseExample(endpoint);

    // Generate curl command
    examples.curl = this.generateCurlExample(endpoint);

    return examples;
  }

  /**
   * Collect all API endpoints from analysis
   */
  private collectAllEndpoints(analysis: ProjectAnalysis): ApiEndpointInfo[] {
    const endpoints: ApiEndpointInfo[] = [];
    
    for (const [, fileAnalysis] of analysis.files) {
      endpoints.push(...fileAnalysis.apiEndpoints);
    }

    return endpoints;
  }

  /**
   * Group endpoints by path for better organization
   */
  private groupEndpointsByPath(endpoints: ApiEndpointInfo[]): Map<string, ApiEndpointInfo[]> {
    const grouped = new Map<string, ApiEndpointInfo[]>();

    for (const endpoint of endpoints) {
      const basePath = this.getBasePath(endpoint.path);
      
      if (!grouped.has(basePath)) {
        grouped.set(basePath, []);
      }
      
      grouped.get(basePath)!.push(endpoint);
    }

    return grouped;
  }

  /**
   * Get base path from full path (e.g., /api/users/:id -> /api/users)
   */
  private getBasePath(path: string): string {
    const parts = path.split('/').filter(part => part);
    const baseParts = parts.filter(part => !part.startsWith(':') && !part.startsWith('{'));
    return '/' + baseParts.join('/');
  }

  /**
   * Generate HTML for interactive API documentation
   */
  private generateApiDocsHtml(endpoints: ApiEndpointInfo[], openApiSpec: OpenAPISpec): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${openApiSpec.info.title} - API Documentation</title>
    <style>
        ${this.getApiDocsCSS()}
    </style>
</head>
<body>
    <div class="api-docs">
        <header class="api-header">
            <h1>${openApiSpec.info.title}</h1>
            <p class="api-description">${openApiSpec.info.description}</p>
            <div class="api-info">
                <span class="version">Version: ${openApiSpec.info.version}</span>
            </div>
        </header>

        <nav class="api-nav">
            <h3>Endpoints</h3>
            <ul class="endpoint-list">
                ${endpoints.map(endpoint => `
                    <li>
                        <a href="#${this.getEndpointId(endpoint)}" class="endpoint-link">
                            <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                            <span class="path">${endpoint.path}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>
        </nav>

        <main class="api-content">
            ${endpoints.map(endpoint => this.generateEndpointHtml(endpoint)).join('')}
            
            <section class="openapi-spec">
                <h2>OpenAPI Specification</h2>
                <div class="spec-actions">
                    <button onclick="downloadSpec('json')" class="btn btn-primary">Download JSON</button>
                    <button onclick="downloadSpec('yaml')" class="btn btn-secondary">Download YAML</button>
                </div>
                <pre class="spec-content"><code>${JSON.stringify(openApiSpec, null, 2)}</code></pre>
            </section>
        </main>
    </div>

    <script>
        ${this.getApiDocsJS(openApiSpec)}
    </script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single endpoint
   */
  private generateEndpointHtml(endpoint: ApiEndpointInfo): string {
    const examples = this.generateEndpointExamples(endpoint);
    
    return `
        <section id="${this.getEndpointId(endpoint)}" class="endpoint">
            <div class="endpoint-header">
                <h2>
                    <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                    <span class="path">${endpoint.path}</span>
                </h2>
                <p class="endpoint-description">${endpoint.description || 'No description available'}</p>
            </div>

            ${endpoint.parameters && endpoint.parameters.length > 0 ? `
                <div class="parameters">
                    <h3>Parameters</h3>
                    <table class="params-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${endpoint.parameters.map(param => `
                                <tr>
                                    <td><code>${param.name}</code></td>
                                    <td><code>${param.type || 'string'}</code></td>
                                    <td>${param.optional ? 'No' : 'Yes'}</td>
                                    <td>${param.description || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <div class="examples">
                <div class="example-tabs">
                    <button class="tab-btn active" onclick="showTab('${this.getEndpointId(endpoint)}', 'curl')">cURL</button>
                    ${examples.request ? `<button class="tab-btn" onclick="showTab('${this.getEndpointId(endpoint)}', 'request')">Request</button>` : ''}
                    <button class="tab-btn" onclick="showTab('${this.getEndpointId(endpoint)}', 'response')">Response</button>
                </div>

                <div id="${this.getEndpointId(endpoint)}-curl" class="tab-content active">
                    <h4>cURL Example</h4>
                    <pre class="code-block"><code>${examples.curl}</code></pre>
                    <button onclick="copyToClipboard('${this.getEndpointId(endpoint)}-curl')" class="copy-btn">Copy</button>
                </div>

                ${examples.request ? `
                    <div id="${this.getEndpointId(endpoint)}-request" class="tab-content">
                        <h4>Request Body</h4>
                        <pre class="code-block"><code>${JSON.stringify(examples.request, null, 2)}</code></pre>
                        <button onclick="copyToClipboard('${this.getEndpointId(endpoint)}-request')" class="copy-btn">Copy</button>
                    </div>
                ` : ''}

                <div id="${this.getEndpointId(endpoint)}-response" class="tab-content">
                    <h4>Response Example</h4>
                    <pre class="code-block"><code>${JSON.stringify(examples.response, null, 2)}</code></pre>
                    <button onclick="copyToClipboard('${this.getEndpointId(endpoint)}-response')" class="copy-btn">Copy</button>
                </div>
            </div>
        </section>`;
  }

  /**
   * Generate markdown for a single endpoint
   */
  private generateEndpointMarkdown(endpoint: ApiEndpointInfo): string {
    const examples = this.generateEndpointExamples(endpoint);
    
    let markdown = `### ${endpoint.method} ${endpoint.path}\n\n`;
    
    if (endpoint.description) {
      markdown += `${endpoint.description}\n\n`;
    }

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      markdown += `#### Parameters\n\n`;
      markdown += `| Name | Type | Required | Description |\n`;
      markdown += `|------|------|----------|-------------|\n`;
      
      for (const param of endpoint.parameters) {
        markdown += `| \`${param.name}\` | \`${param.type || 'string'}\` | ${param.optional ? 'No' : 'Yes'} | ${param.description || '-'} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `#### Example Request\n\n`;
    markdown += `\`\`\`bash\n${examples.curl}\n\`\`\`\n\n`;

    if (examples.request) {
      markdown += `\`\`\`json\n${JSON.stringify(examples.request, null, 2)}\n\`\`\`\n\n`;
    }

    markdown += `#### Example Response\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(examples.response, null, 2)}\n\`\`\`\n\n`;

    return markdown;
  }

  /**
   * Generate request example for an endpoint
   */
  private generateRequestExample(endpoint: ApiEndpointInfo): any {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    return {
      name: `Example ${resource}`,
      description: `This is an example ${resource} for ${endpoint.method} ${endpoint.path}`,
      data: {
        key: 'value',
        number: 42,
        active: true,
      },
    };
  }

  /**
   * Generate response example for an endpoint
   */
  private generateResponseExample(endpoint: ApiEndpointInfo): any {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith(':') && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'item';

    const baseItem = {
      id: '123',
      name: `Example ${resource}`,
      description: `This is an example ${resource}`,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    // Return array for collection endpoints
    if (endpoint.method === 'GET' && !endpoint.path.match(/[:{}][^/]*$/)) {
      return [baseItem];
    }

    // Return empty for DELETE
    if (endpoint.method === 'DELETE') {
      return { message: 'Deleted successfully' };
    }

    return baseItem;
  }

  /**
   * Generate cURL example for an endpoint
   */
  private generateCurlExample(endpoint: ApiEndpointInfo): string {
    let curl = `curl -X ${endpoint.method}`;
    
    // Replace path parameters with example values
    let examplePath = endpoint.path.replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '123');
    examplePath = examplePath.replace(/\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g, '123');
    
    curl += ` "http://localhost:3000${examplePath}"`;
    
    // Add headers
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -H "Accept: application/json"`;
    
    // Add request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      const requestExample = this.generateRequestExample(endpoint);
      curl += ` \\\n  -d '${JSON.stringify(requestExample)}'`;
    }

    return curl;
  }

  /**
   * Get unique ID for an endpoint
   */
  private getEndpointId(endpoint: ApiEndpointInfo): string {
    return `${endpoint.method.toLowerCase()}-${endpoint.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /**
   * Get CSS styles for API documentation
   */
  private getApiDocsCSS(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .api-docs {
            display: grid;
            grid-template-columns: 300px 1fr;
            grid-template-rows: auto 1fr;
            grid-template-areas: 
                "header header"
                "nav content";
            min-height: 100vh;
        }

        .api-header {
            grid-area: header;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
        }

        .api-header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }

        .api-description {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 1rem;
        }

        .version {
            background: rgba(255, 255, 255, 0.2);
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.9rem;
        }

        .api-nav {
            grid-area: nav;
            background: white;
            padding: 1.5rem;
            border-right: 1px solid #e9ecef;
            overflow-y: auto;
        }

        .api-nav h3 {
            margin-bottom: 1rem;
            color: #495057;
        }

        .endpoint-list {
            list-style: none;
        }

        .endpoint-link {
            display: flex;
            align-items: center;
            padding: 0.5rem;
            text-decoration: none;
            color: #495057;
            border-radius: 0.25rem;
            margin-bottom: 0.25rem;
            transition: background-color 0.2s;
        }

        .endpoint-link:hover {
            background-color: #f8f9fa;
        }

        .method {
            font-weight: bold;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            margin-right: 0.5rem;
            min-width: 60px;
            text-align: center;
        }

        .method-get { background-color: #28a745; color: white; }
        .method-post { background-color: #007bff; color: white; }
        .method-put { background-color: #ffc107; color: black; }
        .method-patch { background-color: #17a2b8; color: white; }
        .method-delete { background-color: #dc3545; color: white; }
        .method-options { background-color: #6c757d; color: white; }
        .method-head { background-color: #6f42c1; color: white; }

        .path {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
        }

        .api-content {
            grid-area: content;
            padding: 2rem;
            overflow-y: auto;
        }

        .endpoint {
            background: white;
            border-radius: 0.5rem;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .endpoint-header h2 {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
        }

        .endpoint-header .method {
            font-size: 1rem;
            margin-right: 1rem;
        }

        .endpoint-header .path {
            font-size: 1.5rem;
        }

        .endpoint-description {
            color: #6c757d;
            margin-bottom: 1.5rem;
        }

        .parameters {
            margin-bottom: 2rem;
        }

        .parameters h3 {
            margin-bottom: 1rem;
            color: #495057;
        }

        .params-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1rem;
        }

        .params-table th,
        .params-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .params-table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }

        .params-table code {
            background-color: #f8f9fa;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
        }

        .examples {
            margin-top: 2rem;
        }

        .example-tabs {
            display: flex;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 1rem;
        }

        .tab-btn {
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .tab-btn.active {
            border-bottom-color: #007bff;
            color: #007bff;
        }

        .tab-content {
            display: none;
            position: relative;
        }

        .tab-content.active {
            display: block;
        }

        .code-block {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 0.25rem;
            padding: 1rem;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
        }

        .copy-btn {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: #007bff;
            color: white;
            border: none;
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.8rem;
        }

        .copy-btn:hover {
            background: #0056b3;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-right: 0.5rem;
        }

        .btn-primary {
            background: #007bff;
            color: white;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .openapi-spec {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #dee2e6;
        }

        .spec-actions {
            margin-bottom: 1rem;
        }

        .spec-content {
            max-height: 400px;
            overflow-y: auto;
        }

        @media (max-width: 768px) {
            .api-docs {
                grid-template-columns: 1fr;
                grid-template-areas: 
                    "header"
                    "nav"
                    "content";
            }

            .api-nav {
                max-height: 200px;
            }
        }
    `;
  }

  /**
   * Get JavaScript for API documentation
   */
  private getApiDocsJS(openApiSpec: OpenAPISpec): string {
    return `
        function showTab(endpointId, tabName) {
            // Hide all tab contents for this endpoint
            const tabContents = document.querySelectorAll('[id^="' + endpointId + '-"]');
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Remove active class from all tab buttons in this endpoint
            const endpoint = document.getElementById(endpointId);
            const tabBtns = endpoint.querySelectorAll('.tab-btn');
            tabBtns.forEach(btn => btn.classList.remove('active'));
            
            // Show selected tab content
            document.getElementById(endpointId + '-' + tabName).classList.add('active');
            
            // Add active class to clicked button
            event.target.classList.add('active');
        }

        function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            const codeBlock = element.querySelector('.code-block code');
            const text = codeBlock.textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                const btn = element.querySelector('.copy-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            });
        }

        function downloadSpec(format) {
            const spec = ${JSON.stringify(openApiSpec)};
            let content, filename, mimeType;
            
            if (format === 'json') {
                content = JSON.stringify(spec, null, 2);
                filename = 'openapi.json';
                mimeType = 'application/json';
            } else if (format === 'yaml') {
                content = jsonToYaml(spec);
                filename = 'openapi.yaml';
                mimeType = 'text/yaml';
            }
            
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function jsonToYaml(obj, indent = 0) {
            const spaces = '  '.repeat(indent);
            let yaml = '';

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    yaml += spaces + '- ' + jsonToYaml(item, indent + 1).trim() + '\\n';
                }
            } else if (typeof obj === 'object' && obj !== null) {
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'object' && value !== null) {
                        yaml += spaces + key + ':\\n' + jsonToYaml(value, indent + 1);
                    } else {
                        yaml += spaces + key + ': ' + formatYamlValue(value) + '\\n';
                    }
                }
            } else {
                return formatYamlValue(obj);
            }

            return yaml;
        }

        function formatYamlValue(value) {
            if (typeof value === 'string') {
                if (value.includes(':') || value.includes('#') || value.includes('\\n')) {
                    return '"' + value.replace(/"/g, '\\\\"') + '"';
                }
                return value;
            }
            return String(value);
        }

        // Smooth scrolling for navigation links
        document.querySelectorAll('.endpoint-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    `;
  }
}
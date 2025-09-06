import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
  ProjectAnalysis,
  DocumentationOutput,
  ApiEndpointInfo,
} from '../types';
import { SteeringParser, SteeringConfig } from '../steering/steering-parser';
import { TemplateEngine, TemplateContext } from '../steering/template-engine';
import * as path from 'path';

/**
 * Markdown documentation generator
 * Creates beautiful, structured markdown documentation from code analysis results
 */
export class MarkdownGenerator {
  private steeringParser?: SteeringParser;
  private steeringConfig?: SteeringConfig;
  private templateEngine?: TemplateEngine;

  constructor(projectPath?: string) {
    if (projectPath) {
      this.steeringParser = new SteeringParser(projectPath);
      this.initializeSteering();
    }
  }

  /**
   * Initialize steering configuration
   */
  private async initializeSteering(): Promise<void> {
    if (!this.steeringParser) return;

    try {
      this.steeringConfig = await this.steeringParser.loadSteeringConfig();
      this.templateEngine = new TemplateEngine(this.steeringConfig);
    } catch (error) {
      console.error('Error initializing steering configuration:', error);
    }
  }
  /**
   * Generate markdown documentation for a single file
   */
  public async generateFileDocumentation(filePath: string, analysis: AnalysisResult): Promise<string> {
    // Ensure steering is initialized
    if (this.steeringParser && !this.steeringConfig) {
      await this.initializeSteering();
    }

    // Get file-specific steering configuration
    let fileConfig = this.steeringConfig;
    if (this.steeringParser && this.steeringConfig) {
      fileConfig = await this.steeringParser.getFileSpecificConfig(filePath, this.steeringConfig);
    }
    const fileName = path.basename(filePath);
    const sections: string[] = [];

    // File header
    sections.push(`# ${fileName}`);
    sections.push('');

    // File overview
    if (analysis.functions.length > 0 || analysis.classes.length > 0 || analysis.interfaces.length > 0) {
      sections.push('## Overview');
      sections.push('');
      
      const stats = [
        analysis.functions.length > 0 ? `${analysis.functions.length} function${analysis.functions.length === 1 ? '' : 's'}` : null,
        analysis.classes.length > 0 ? `${analysis.classes.length} class${analysis.classes.length === 1 ? '' : 'es'}` : null,
        analysis.interfaces.length > 0 ? `${analysis.interfaces.length} interface${analysis.interfaces.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean);

      if (stats.length > 0) {
        sections.push(`This file contains ${stats.join(', ')}.`);
        sections.push('');
      }
    }

    // Table of Contents
    if (analysis.functions.length > 0 || analysis.classes.length > 0 || analysis.interfaces.length > 0 || analysis.apiEndpoints.length > 0) {
      sections.push('## Table of Contents');
      sections.push('');

      if (analysis.interfaces.length > 0) {
        sections.push('### Interfaces');
        analysis.interfaces.forEach(iface => {
          sections.push(`- [${iface.name}](#${this.createAnchor(iface.name)})`);
        });
        sections.push('');
      }

      if (analysis.classes.length > 0) {
        sections.push('### Classes');
        analysis.classes.forEach(cls => {
          sections.push(`- [${cls.name}](#${this.createAnchor(cls.name)})`);
        });
        sections.push('');
      }

      if (analysis.functions.length > 0) {
        sections.push('### Functions');
        analysis.functions.forEach(func => {
          sections.push(`- [${func.name}](#${this.createAnchor(func.name)})`);
        });
        sections.push('');
      }

      if (analysis.apiEndpoints.length > 0) {
        sections.push('### API Endpoints');
        analysis.apiEndpoints.forEach(endpoint => {
          const anchorText = `${endpoint.method.toLowerCase()}-${endpoint.path.replace(/[^a-z0-9]/g, '-')}`;
          sections.push(`- [${endpoint.method} ${endpoint.path}](#${anchorText})`);
        });
        sections.push('');
      }
    }

    // Interfaces
    if (analysis.interfaces.length > 0) {
      sections.push('## Interfaces');
      sections.push('');
      
      analysis.interfaces.forEach(iface => {
        sections.push(...this.generateInterfaceDocumentation(iface));
        sections.push('');
      });
    }

    // Classes
    if (analysis.classes.length > 0) {
      sections.push('## Classes');
      sections.push('');
      
      analysis.classes.forEach(cls => {
        sections.push(...this.generateClassDocumentation(cls));
        sections.push('');
      });
    }

    // Functions
    if (analysis.functions.length > 0) {
      sections.push('## Functions');
      sections.push('');
      
      analysis.functions.forEach(func => {
        sections.push(...this.generateFunctionDocumentation(func));
        sections.push('');
      });
    }

    // Imports
    if (analysis.imports.length > 0) {
      sections.push('## Dependencies');
      sections.push('');
      sections.push('This file imports from the following modules:');
      sections.push('');
      
      analysis.imports.forEach(imp => {
        const importType = imp.isDefault ? 'default' : imp.isNamespace ? 'namespace' : 'named';
        sections.push(`- **${imp.source}** (${importType}): ${imp.imports.join(', ')}`);
      });
      sections.push('');
    }

    // Exports
    if (analysis.exports.length > 0) {
      sections.push('## Exports');
      sections.push('');
      sections.push('This file exports:');
      sections.push('');
      
      analysis.exports.forEach(exp => {
        const defaultText = exp.isDefault ? ' (default)' : '';
        sections.push(`- **${exp.name}** (${exp.type})${defaultText}`);
      });
      sections.push('');
    }

    // API Endpoints
    if (analysis.apiEndpoints.length > 0) {
      sections.push('## API Endpoints');
      sections.push('');
      
      analysis.apiEndpoints.forEach(endpoint => {
        sections.push(...this.generateApiEndpointDocumentation(endpoint));
        sections.push('');
      });
    }

    // TODOs
    if (analysis.todos.length > 0) {
      sections.push('## TODOs');
      sections.push('');
      
      analysis.todos.forEach(todo => {
        sections.push(`- **${todo.type}** (line ${todo.line}): ${todo.content}`);
      });
      sections.push('');
    }

    let result = sections.join('\n');

    // Apply steering configuration
    if (fileConfig && this.templateEngine) {
      // Apply terminology replacements
      if (this.steeringParser) {
        result = this.steeringParser.applyTerminologyReplacements(result, fileConfig);
      }

      // Apply style configuration
      result = this.templateEngine.applyStyleConfig(result);

      // Add header and footer if configured
      const context: TemplateContext = {
        analysis,
        config: fileConfig,
        fileName: path.basename(filePath),
        timestamp: new Date(),
      };

      const header = this.templateEngine.generateHeader(context);
      const footer = this.templateEngine.generateFooter(context);

      if (header) {
        result = header + '\n\n' + result;
      }
      if (footer) {
        result = result + '\n\n' + footer;
      }
    }

    return result;
  }

  /**
   * Generate markdown documentation for a project
   */
  public generateProjectDocumentation(projectAnalysis: ProjectAnalysis): DocumentationOutput {
    const sections: string[] = [];

    // Project header
    sections.push(`# ${projectAnalysis.metadata.name}`);
    sections.push('');

    if (projectAnalysis.metadata.description) {
      sections.push(projectAnalysis.metadata.description);
      sections.push('');
    }

    // Project overview
    sections.push('## Project Overview');
    sections.push('');

    const totalFiles = projectAnalysis.files.size;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalInterfaces = 0;
    let totalExports = 0;
    let totalTodos = 0;
    let totalApiEndpoints = 0;

    for (const analysis of projectAnalysis.files.values()) {
      totalFunctions += analysis.functions.length;
      totalClasses += analysis.classes.length;
      totalInterfaces += analysis.interfaces.length;
      totalExports += analysis.exports.length;
      totalTodos += analysis.todos.length;
      totalApiEndpoints += analysis.apiEndpoints.length;
    }

    sections.push('### Statistics');
    sections.push('');
    sections.push(`- **Files analyzed**: ${totalFiles}`);
    sections.push(`- **Functions**: ${totalFunctions}`);
    sections.push(`- **Classes**: ${totalClasses}`);
    sections.push(`- **Interfaces**: ${totalInterfaces}`);
    sections.push(`- **Exports**: ${totalExports}`);
    if (totalApiEndpoints > 0) {
      sections.push(`- **API Endpoints**: ${totalApiEndpoints}`);
    }
    sections.push(`- **Languages**: ${projectAnalysis.metadata.languages.join(', ')}`);
    if (totalTodos > 0) {
      sections.push(`- **TODOs**: ${totalTodos}`);
    }
    sections.push('');

    // File index
    sections.push('## Files');
    sections.push('');

    const fileEntries = Array.from(projectAnalysis.files.entries());
    fileEntries.forEach(([filePath, analysis]) => {
      const fileName = path.basename(filePath);
      const relativePath = path.relative(process.cwd(), filePath);
      
      const stats = [];
      if (analysis.functions.length > 0) stats.push(`${analysis.functions.length} functions`);
      if (analysis.classes.length > 0) stats.push(`${analysis.classes.length} classes`);
      if (analysis.interfaces.length > 0) stats.push(`${analysis.interfaces.length} interfaces`);
      if (analysis.apiEndpoints.length > 0) stats.push(`${analysis.apiEndpoints.length} API endpoints`);
      
      const statsText = stats.length > 0 ? ` - ${stats.join(', ')}` : '';
      sections.push(`- [${fileName}](${this.createFileLink(relativePath)})${statsText}`);
    });
    sections.push('');

    // Repository info
    if (projectAnalysis.metadata.repository) {
      sections.push('## Repository');
      sections.push('');
      if (projectAnalysis.metadata.repository.url) {
        sections.push(`**URL**: ${projectAnalysis.metadata.repository.url}`);
      }
      if (projectAnalysis.metadata.repository.branch) {
        sections.push(`**Branch**: ${projectAnalysis.metadata.repository.branch}`);
      }
      sections.push('');
    }

    // Generation info
    sections.push('---');
    sections.push('');
    sections.push(`*Documentation generated on ${new Date().toISOString().split('T')[0]} by Living Documentation Generator*`);

    return {
      markdown: sections.join('\n'),
    };
  }

  /**
   * Generate documentation for a function
   */
  private generateFunctionDocumentation(func: FunctionInfo): string[] {
    const sections: string[] = [];

    // Function header
    const asyncText = func.isAsync ? 'async ' : '';
    const exportText = func.isExported ? ' (exported)' : '';
    sections.push(`### ${func.name}${exportText}`);
    sections.push('');

    // Description
    if (func.description) {
      sections.push(func.description);
      sections.push('');
    }

    // Signature
    const params = func.parameters.map(p => {
      const optional = p.optional ? '?' : '';
      const type = p.type ? `: ${p.type}` : '';
      const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
      return `${p.name}${optional}${type}${defaultVal}`;
    }).join(', ');

    const returnType = func.returnType ? `: ${func.returnType}` : '';
    sections.push('```typescript');
    sections.push(`${asyncText}function ${func.name}(${params})${returnType}`);
    sections.push('```');
    sections.push('');

    // Parameters
    if (func.parameters.length > 0) {
      sections.push('**Parameters:**');
      sections.push('');
      func.parameters.forEach(param => {
        const optional = param.optional ? ' (optional)' : '';
        const type = param.type ? ` \`${param.type}\`` : '';
        const description = param.description ? ` - ${param.description}` : '';
        sections.push(`- **${param.name}**${type}${optional}${description}`);
      });
      sections.push('');
    }

    // Return value
    if (func.returnType && func.returnType !== 'void') {
      sections.push('**Returns:**');
      sections.push('');
      sections.push(`\`${func.returnType}\``);
      sections.push('');
    }

    return sections;
  }

  /**
   * Generate documentation for a class
   */
  private generateClassDocumentation(cls: ClassInfo): string[] {
    const sections: string[] = [];

    // Class header
    const exportText = cls.isExported ? ' (exported)' : '';
    const extendsText = cls.extends ? ` extends ${cls.extends}` : '';
    const implementsText = cls.implements && cls.implements.length > 0 ? ` implements ${cls.implements.join(', ')}` : '';
    
    sections.push(`### ${cls.name}${exportText}`);
    sections.push('');

    // Description
    if (cls.description) {
      sections.push(cls.description);
      sections.push('');
    }

    // Class signature
    sections.push('```typescript');
    sections.push(`class ${cls.name}${extendsText}${implementsText}`);
    sections.push('```');
    sections.push('');

    // Properties
    if (cls.properties.length > 0) {
      sections.push('**Properties:**');
      sections.push('');
      cls.properties.forEach(prop => {
        const optional = prop.optional ? '?' : '';
        const readonly = prop.readonly ? 'readonly ' : '';
        const type = prop.type ? `: ${prop.type}` : '';
        const description = prop.description ? ` - ${prop.description}` : '';
        sections.push(`- **${readonly}${prop.name}${optional}**${type}${description}`);
      });
      sections.push('');
    }

    // Methods
    if (cls.methods.length > 0) {
      sections.push('**Methods:**');
      sections.push('');
      cls.methods.forEach(method => {
        const asyncText = method.isAsync ? 'async ' : '';
        const params = method.parameters.map(p => {
          const optional = p.optional ? '?' : '';
          const type = p.type ? `: ${p.type}` : '';
          return `${p.name}${optional}${type}`;
        }).join(', ');
        const returnType = method.returnType ? `: ${method.returnType}` : '';
        
        sections.push(`- **${method.name}**`);
        sections.push(`  \`\`\`typescript`);
        sections.push(`  ${asyncText}${method.name}(${params})${returnType}`);
        sections.push(`  \`\`\``);
        
        if (method.description) {
          sections.push(`  ${method.description}`);
        }
        sections.push('');
      });
    }

    return sections;
  }

  /**
   * Generate documentation for an interface
   */
  private generateInterfaceDocumentation(iface: InterfaceInfo): string[] {
    const sections: string[] = [];

    // Interface header
    const exportText = iface.isExported ? ' (exported)' : '';
    const extendsText = iface.extends && iface.extends.length > 0 ? ` extends ${iface.extends.join(', ')}` : '';
    
    sections.push(`### ${iface.name}${exportText}`);
    sections.push('');

    // Description
    if (iface.description) {
      sections.push(iface.description);
      sections.push('');
    }

    // Interface signature
    sections.push('```typescript');
    sections.push(`interface ${iface.name}${extendsText} {`);
    
    // Properties
    iface.properties.forEach(prop => {
      const optional = prop.optional ? '?' : '';
      const readonly = prop.readonly ? 'readonly ' : '';
      const type = prop.type ? `: ${prop.type}` : '';
      sections.push(`  ${readonly}${prop.name}${optional}${type};`);
    });

    // Methods
    iface.methods.forEach(method => {
      const params = method.parameters.map(p => {
        const optional = p.optional ? '?' : '';
        const type = p.type ? `: ${p.type}` : '';
        return `${p.name}${optional}${type}`;
      }).join(', ');
      const returnType = method.returnType ? `: ${method.returnType}` : '';
      sections.push(`  ${method.name}(${params})${returnType};`);
    });

    sections.push('}');
    sections.push('```');
    sections.push('');

    // Property descriptions
    const propsWithDescriptions = iface.properties.filter(p => p.description);
    const methodsWithDescriptions = iface.methods.filter(m => m.description);

    if (propsWithDescriptions.length > 0 || methodsWithDescriptions.length > 0) {
      sections.push('**Members:**');
      sections.push('');

      propsWithDescriptions.forEach(prop => {
        sections.push(`- **${prop.name}**: ${prop.description}`);
      });

      methodsWithDescriptions.forEach(method => {
        sections.push(`- **${method.name}()**: ${method.description}`);
      });

      sections.push('');
    }

    return sections;
  }

  /**
   * Create markdown anchor from text
   */
  private createAnchor(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Generate documentation for an API endpoint
   */
  private generateApiEndpointDocumentation(endpoint: ApiEndpointInfo): string[] {
    const sections: string[] = [];

    // Endpoint header
    sections.push(`### ${endpoint.method} ${endpoint.path}`);
    sections.push('');

    // Description
    if (endpoint.description) {
      sections.push(endpoint.description);
      sections.push('');
    }

    // Handler information
    sections.push(`**Handler:** \`${endpoint.handler}\``);
    sections.push('');

    // Parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      sections.push('**Parameters:**');
      sections.push('');
      endpoint.parameters.forEach((param) => {
        const type = param.type ? ` \`${param.type}\`` : '';
        const description = param.description ? ` - ${param.description}` : '';
        sections.push(`- **${param.name}**${type}${description}`);
      });
      sections.push('');
    }

    // Example usage
    sections.push('**Example:**');
    sections.push('');
    sections.push('```http');
    sections.push(`${endpoint.method} ${endpoint.path}`);
    sections.push('```');
    sections.push('');

    return sections;
  }

  /**
   * Create file link for markdown
   */
  private createFileLink(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\.ts$/, '.md').replace(/\.js$/, '.md');
  }
}
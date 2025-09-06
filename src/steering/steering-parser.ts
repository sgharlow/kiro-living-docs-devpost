import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface SteeringConfig {
  documentation?: DocumentationConfig;
  templates?: TemplateConfig;
  terminology?: TerminologyConfig;
  style?: StyleConfig;
  validation?: ValidationConfig;
}

export interface DocumentationConfig {
  style?: 'google' | 'numpy' | 'sphinx' | 'custom';
  includePrivate?: boolean;
  generateDiagrams?: boolean;
  autoGenerateReadme?: boolean;
  outputFormats?: ('markdown' | 'html' | 'pdf')[];
  sections?: {
    overview?: boolean;
    api?: boolean;
    examples?: boolean;
    changelog?: boolean;
    contributing?: boolean;
  };
}

export interface TemplateConfig {
  customTemplates?: {
    [key: string]: string; // template name -> file path
  };
  templateVariables?: {
    [key: string]: any;
  };
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface TerminologyConfig {
  replacements?: {
    [key: string]: string; // old term -> new term
  };
  glossary?: {
    [key: string]: string; // term -> definition
  };
  caseStyle?: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';
}

export interface StyleConfig {
  codeBlockStyle?: 'fenced' | 'indented';
  headingStyle?: 'atx' | 'setext';
  listStyle?: 'dash' | 'asterisk' | 'plus';
  linkStyle?: 'inline' | 'reference';
  tableStyle?: 'github' | 'grid';
  maxLineLength?: number;
  indentSize?: number;
}

export interface ValidationConfig {
  requireDocstrings?: boolean;
  requireTypeHints?: boolean;
  requireExamples?: boolean;
  allowedTodoTypes?: string[];
  maxComplexity?: number;
}

export interface SteeringFileReference {
  type: 'file';
  path: string;
}

/**
 * Parser for Kiro steering files that configure documentation generation
 */
export class SteeringParser {
  private projectPath: string;
  private steeringPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.steeringPath = path.join(projectPath, '.kiro', 'steering');
  }

  /**
   * Load and parse all steering files in the project
   */
  public async loadSteeringConfig(): Promise<SteeringConfig> {
    const config: SteeringConfig = {};

    try {
      // Check if steering directory exists
      if (!fs.existsSync(this.steeringPath)) {
        return config;
      }

      // Get all steering files
      const steeringFiles = fs.readdirSync(this.steeringPath)
        .filter(file => file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.join(this.steeringPath, file));

      // Parse each steering file
      for (const filePath of steeringFiles) {
        const fileConfig = await this.parseSteeringFile(filePath);
        this.mergeConfigs(config, fileConfig);
      }

      // Validate the merged configuration
      this.validateConfig(config);

      return config;
    } catch (error) {
      console.error('Error loading steering configuration:', error);
      return config;
    }
  }

  /**
   * Parse a single steering file
   */
  private async parseSteeringFile(filePath: string): Promise<SteeringConfig> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.md') {
      return this.parseMarkdownSteeringFile(content, filePath);
    } else if (ext === '.yaml' || ext === '.yml') {
      return this.parseYamlSteeringFile(content, filePath);
    }

    return {};
  }

  /**
   * Parse markdown steering file with front matter
   */
  private parseMarkdownSteeringFile(content: string, filePath: string): SteeringConfig {
    const config: SteeringConfig = {};

    // Extract front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      try {
        const frontMatter = yaml.load(frontMatterMatch[1]) as any;
        
        // Check inclusion rules
        const inclusion = frontMatter.inclusion || 'always';
        if (inclusion === 'manual') {
          // Skip manual inclusion files unless explicitly requested
          return config;
        }

        // Apply file match patterns if specified
        if (inclusion === 'fileMatch' && frontMatter.fileMatchPattern) {
          // This would be used when processing specific files
          // For now, we'll include it in the global config
        }

        // Extract configuration from front matter
        if (frontMatter.documentation) {
          config.documentation = frontMatter.documentation;
        }
        if (frontMatter.templates) {
          config.templates = frontMatter.templates;
        }
        if (frontMatter.terminology) {
          config.terminology = frontMatter.terminology;
        }
        if (frontMatter.style) {
          config.style = frontMatter.style;
        }
        if (frontMatter.validation) {
          config.validation = frontMatter.validation;
        }
      } catch (error) {
        console.error(`Error parsing front matter in ${filePath}:`, error);
      }
    }

    // Process file references in the content
    this.processFileReferences(content, config, filePath);

    return config;
  }

  /**
   * Parse YAML steering file
   */
  private parseYamlSteeringFile(content: string, filePath: string): SteeringConfig {
    try {
      const yamlConfig = yaml.load(content) as any;
      return yamlConfig || {};
    } catch (error) {
      console.error(`Error parsing YAML steering file ${filePath}:`, error);
      return {};
    }
  }

  /**
   * Process file references in steering content
   */
  private processFileReferences(content: string, config: SteeringConfig, steeringFilePath: string): void {
    // Look for file references: #[[file:relative_file_name]]
    const fileRefPattern = /#\[\[file:([^\]]+)\]\]/g;
    let match;

    while ((match = fileRefPattern.exec(content)) !== null) {
      const referencedFile = match[1];
      const fullPath = path.resolve(path.dirname(steeringFilePath), referencedFile);
      
      try {
        if (fs.existsSync(fullPath)) {
          // Load and merge referenced file content
          const referencedContent = fs.readFileSync(fullPath, 'utf-8');
          
          // Determine how to process the referenced file based on its extension
          const ext = path.extname(fullPath).toLowerCase();
          if (ext === '.json') {
            const jsonConfig = JSON.parse(referencedContent);
            this.mergeConfigs(config, jsonConfig);
          } else if (ext === '.yaml' || ext === '.yml') {
            const yamlConfig = yaml.load(referencedContent) as any;
            this.mergeConfigs(config, yamlConfig);
          }
          // Add more file type handlers as needed
        }
      } catch (error) {
        console.error(`Error processing file reference ${referencedFile}:`, error);
      }
    }
  }

  /**
   * Merge two steering configurations
   */
  private mergeConfigs(target: SteeringConfig, source: SteeringConfig): void {
    if (source.documentation) {
      target.documentation = { ...target.documentation, ...source.documentation };
    }
    if (source.templates) {
      target.templates = { ...target.templates, ...source.templates };
      if (source.templates.customTemplates) {
        target.templates.customTemplates = { 
          ...target.templates.customTemplates, 
          ...source.templates.customTemplates 
        };
      }
      if (source.templates.templateVariables) {
        target.templates.templateVariables = { 
          ...target.templates.templateVariables, 
          ...source.templates.templateVariables 
        };
      }
    }
    if (source.terminology) {
      target.terminology = { ...target.terminology, ...source.terminology };
      if (source.terminology.replacements) {
        target.terminology.replacements = { 
          ...target.terminology.replacements, 
          ...source.terminology.replacements 
        };
      }
      if (source.terminology.glossary) {
        target.terminology.glossary = { 
          ...target.terminology.glossary, 
          ...source.terminology.glossary 
        };
      }
    }
    if (source.style) {
      target.style = { ...target.style, ...source.style };
    }
    if (source.validation) {
      target.validation = { ...target.validation, ...source.validation };
    }
  }

  /**
   * Validate steering configuration
   */
  private validateConfig(config: SteeringConfig): void {
    // Validate documentation config
    if (config.documentation) {
      const doc = config.documentation;
      if (doc.style && !['google', 'numpy', 'sphinx', 'custom'].includes(doc.style)) {
        console.warn(`Invalid documentation style: ${doc.style}`);
      }
      if (doc.outputFormats) {
        const validFormats = ['markdown', 'html', 'pdf'];
        doc.outputFormats.forEach(format => {
          if (!validFormats.includes(format)) {
            console.warn(`Invalid output format: ${format}`);
          }
        });
      }
    }

    // Validate style config
    if (config.style) {
      const style = config.style;
      if (style.codeBlockStyle && !['fenced', 'indented'].includes(style.codeBlockStyle)) {
        console.warn(`Invalid code block style: ${style.codeBlockStyle}`);
      }
      if (style.headingStyle && !['atx', 'setext'].includes(style.headingStyle)) {
        console.warn(`Invalid heading style: ${style.headingStyle}`);
      }
      if (style.maxLineLength && (style.maxLineLength < 40 || style.maxLineLength > 200)) {
        console.warn(`Invalid max line length: ${style.maxLineLength} (should be 40-200)`);
      }
    }

    // Validate template paths
    if (config.templates?.customTemplates) {
      Object.entries(config.templates.customTemplates).forEach(([name, templatePath]) => {
        const fullPath = path.resolve(this.projectPath, templatePath);
        if (!fs.existsSync(fullPath)) {
          console.warn(`Custom template not found: ${name} -> ${templatePath}`);
        }
      });
    }
  }

  /**
   * Get steering configuration for a specific file
   */
  public async getFileSpecificConfig(filePath: string, globalConfig: SteeringConfig): Promise<SteeringConfig> {
    const config = { ...globalConfig };

    // Check for file-specific steering rules
    try {
      const steeringFiles = fs.readdirSync(this.steeringPath)
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(this.steeringPath, file));

      for (const steeringFile of steeringFiles) {
        const content = fs.readFileSync(steeringFile, 'utf-8');
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontMatterMatch) {
          const frontMatter = yaml.load(frontMatterMatch[1]) as any;
          
          if (frontMatter.inclusion === 'fileMatch' && frontMatter.fileMatchPattern) {
            const pattern = new RegExp(frontMatter.fileMatchPattern);
            if (pattern.test(filePath)) {
              const fileConfig = this.parseMarkdownSteeringFile(content, steeringFile);
              this.mergeConfigs(config, fileConfig);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting file-specific config:', error);
    }

    return config;
  }

  /**
   * Apply terminology replacements to text
   */
  public applyTerminologyReplacements(text: string, config: SteeringConfig): string {
    if (!config.terminology?.replacements) {
      return text;
    }

    let result = text;
    Object.entries(config.terminology.replacements).forEach(([oldTerm, newTerm]) => {
      // Use word boundaries to avoid partial replacements
      const regex = new RegExp(`\\b${oldTerm}\\b`, 'gi');
      result = result.replace(regex, newTerm);
    });

    return result;
  }

  /**
   * Load custom template content
   */
  public loadCustomTemplate(templateName: string, config: SteeringConfig): string | null {
    if (!config.templates?.customTemplates?.[templateName]) {
      return null;
    }

    try {
      const templatePath = config.templates.customTemplates[templateName];
      const fullPath = path.resolve(this.projectPath, templatePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      console.error(`Error loading custom template ${templateName}:`, error);
      return null;
    }
  }

  /**
   * Check if steering directory exists
   */
  public hasSteeringFiles(): boolean {
    return fs.existsSync(this.steeringPath);
  }
}
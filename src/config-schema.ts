/**
 * Configuration Schema and Validation
 * Provides comprehensive validation for Living Documentation Generator configuration
 */

export interface LivingDocsConfig {
  // Project Settings
  projectPath: string;
  outputPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  outputFormats: OutputFormat[];
  
  // Server Settings
  webServerPort?: number;
  watchDebounceMs?: number;
  
  // Feature Flags
  features?: {
    realTimeUpdates?: boolean;
    gitIntegration?: boolean;
    apiDocumentation?: boolean;
    architectureDiagrams?: boolean;
    searchIndex?: boolean;
    performanceMetrics?: boolean;
  };
  
  // Language-Specific Settings
  languages?: {
    typescript?: TypeScriptConfig;
    python?: PythonConfig;
    go?: GoConfig;
  };
  
  // Documentation Metadata
  documentation?: {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
    theme?: string;
    customCSS?: string;
    logo?: string;
  };
  
  // Integration Settings
  integrations?: {
    kiro?: KiroIntegrationConfig;
    git?: GitIntegrationConfig;
  };
}

export type OutputFormat = 'markdown' | 'html' | 'json' | 'openapi';

export interface TypeScriptConfig {
  enabled: boolean;
  includePrivate?: boolean;
  generateInterfaces?: boolean;
  apiEndpointDetection?: boolean;
  tsConfigPath?: string;
}

export interface PythonConfig {
  enabled: boolean;
  includePrivate?: boolean;
  docstringStyle?: 'google' | 'numpy' | 'sphinx';
  requirementsPath?: string;
}

export interface GoConfig {
  enabled: boolean;
  includePrivate?: boolean;
  generateStructDocs?: boolean;
  goModPath?: string;
}

export interface KiroIntegrationConfig {
  steeringFiles?: boolean;
  hooks?: boolean;
  contextAware?: boolean;
}

export interface GitIntegrationConfig {
  enabled?: boolean;
  includeHistory?: boolean;
  changePatterns?: boolean;
  contributorStats?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  config: LivingDocsConfig;
}

/**
 * Configuration Schema Validator
 */
export class ConfigValidator {
  /**
   * Validate a configuration object
   */
  static validate(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Validate required fields
    this.validateRequiredFields(config, errors);
    
    // Validate field types
    this.validateFieldTypes(config, errors);
    
    // Validate field values
    this.validateFieldValues(config, errors, warnings);
    
    // Validate logical consistency
    this.validateLogicalConsistency(config, errors, warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: this.applyDefaults(config)
    };
  }
  
  /**
   * Validate required fields
   */
  private static validateRequiredFields(config: any, errors: ValidationError[]): void {
    const requiredFields = ['projectPath', 'outputPath'];
    
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          suggestion: `Add "${field}": "." to your configuration`,
          severity: 'error'
        });
      }
    }
  }
  
  /**
   * Validate field types
   */
  private static validateFieldTypes(config: any, errors: ValidationError[]): void {
    // String fields
    const stringFields = ['projectPath', 'outputPath'];
    for (const field of stringFields) {
      if (config[field] && typeof config[field] !== 'string') {
        errors.push({
          field,
          message: `Field '${field}' must be a string`,
          suggestion: `Change ${field} to a string value`,
          severity: 'error'
        });
      }
    }
    
    // Array fields
    const arrayFields = ['includePatterns', 'excludePatterns', 'outputFormats'];
    for (const field of arrayFields) {
      if (config[field] && !Array.isArray(config[field])) {
        errors.push({
          field,
          message: `Field '${field}' must be an array`,
          suggestion: `Change ${field} to an array: ["value1", "value2"]`,
          severity: 'error'
        });
      }
    }
    
    // Number fields
    const numberFields = ['webServerPort', 'watchDebounceMs'];
    for (const field of numberFields) {
      if (config[field] && typeof config[field] !== 'number') {
        errors.push({
          field,
          message: `Field '${field}' must be a number`,
          suggestion: `Change ${field} to a numeric value`,
          severity: 'error'
        });
      }
    }
  }
  
  /**
   * Validate field values
   */
  private static validateFieldValues(config: any, errors: ValidationError[], warnings: ValidationError[]): void {
    // Validate output formats
    if (config.outputFormats) {
      const validFormats: OutputFormat[] = ['markdown', 'html', 'json', 'openapi'];
      for (const format of config.outputFormats) {
        if (!validFormats.includes(format)) {
          errors.push({
            field: 'outputFormats',
            message: `Invalid output format '${format}'`,
            suggestion: `Use one of: ${validFormats.join(', ')}`,
            severity: 'error'
          });
        }
      }
    }
    
    // Validate port range
    if (config.webServerPort) {
      if (config.webServerPort < 1024 || config.webServerPort > 65535) {
        warnings.push({
          field: 'webServerPort',
          message: `Port ${config.webServerPort} may require special permissions or be invalid`,
          suggestion: 'Use a port between 3000-8000 for development',
          severity: 'warning'
        });
      }
    }
    
    // Validate debounce time
    if (config.watchDebounceMs) {
      if (config.watchDebounceMs < 100) {
        warnings.push({
          field: 'watchDebounceMs',
          message: 'Very low debounce time may cause performance issues',
          suggestion: 'Consider using at least 300ms for debounce time',
          severity: 'warning'
        });
      }
    }
    
    // Validate docstring styles
    if (config.languages?.python?.docstringStyle) {
      const validStyles = ['google', 'numpy', 'sphinx'];
      if (!validStyles.includes(config.languages.python.docstringStyle)) {
        errors.push({
          field: 'languages.python.docstringStyle',
          message: `Invalid docstring style '${config.languages.python.docstringStyle}'`,
          suggestion: `Use one of: ${validStyles.join(', ')}`,
          severity: 'error'
        });
      }
    }
  }
  
  /**
   * Validate logical consistency
   */
  private static validateLogicalConsistency(config: any, _errors: ValidationError[], warnings: ValidationError[]): void {
    // Check if API documentation is enabled but no languages support it
    if (config.features?.apiDocumentation) {
      const hasApiCapableLanguage = 
        config.languages?.typescript?.apiEndpointDetection ||
        config.languages?.python?.enabled ||
        config.languages?.go?.enabled;
      
      if (!hasApiCapableLanguage) {
        warnings.push({
          field: 'features.apiDocumentation',
          message: 'API documentation enabled but no languages configured for API detection',
          suggestion: 'Enable TypeScript API endpoint detection or Python/Go analysis',
          severity: 'warning'
        });
      }
    }
    
    // Check if git integration is enabled but git features are disabled
    if (config.integrations?.git?.enabled === false && config.features?.gitIntegration) {
      warnings.push({
        field: 'features.gitIntegration',
        message: 'Git integration feature enabled but git integration is disabled',
        suggestion: 'Enable git integration or disable the git integration feature',
        severity: 'warning'
      });
    }
    
    // Check for conflicting include/exclude patterns
    if (config.includePatterns && config.excludePatterns) {
      const hasConflict = config.includePatterns.some((include: string) =>
        config.excludePatterns.some((exclude: string) => 
          include === exclude || (include.includes('**') && exclude.includes('**'))
        )
      );
      
      if (hasConflict) {
        warnings.push({
          field: 'includePatterns',
          message: 'Include and exclude patterns may conflict',
          suggestion: 'Review your patterns to ensure they don\'t cancel each other out',
          severity: 'warning'
        });
      }
    }
  }
  
  /**
   * Apply default values to configuration
   */
  private static applyDefaults(config: any): LivingDocsConfig {
    return {
      projectPath: config.projectPath || '.',
      outputPath: config.outputPath || 'docs',
      includePatterns: config.includePatterns || ['**/*.ts', '**/*.js', '**/*.py', '**/*.go'],
      excludePatterns: config.excludePatterns || [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      outputFormats: config.outputFormats || ['markdown', 'html'],
      webServerPort: config.webServerPort || 3000,
      watchDebounceMs: config.watchDebounceMs || 300,
      features: {
        realTimeUpdates: config.features?.realTimeUpdates ?? true,
        gitIntegration: config.features?.gitIntegration ?? true,
        apiDocumentation: config.features?.apiDocumentation ?? true,
        architectureDiagrams: config.features?.architectureDiagrams ?? false,
        searchIndex: config.features?.searchIndex ?? true,
        performanceMetrics: config.features?.performanceMetrics ?? false,
        ...config.features
      },
      languages: {
        typescript: {
          enabled: true,
          includePrivate: false,
          generateInterfaces: true,
          apiEndpointDetection: true,
          ...config.languages?.typescript
        },
        python: {
          enabled: false,
          includePrivate: false,
          docstringStyle: 'google',
          ...config.languages?.python
        },
        go: {
          enabled: false,
          includePrivate: false,
          generateStructDocs: true,
          ...config.languages?.go
        },
        ...config.languages
      },
      documentation: {
        title: config.documentation?.title || 'Project Documentation',
        description: config.documentation?.description || 'Generated documentation',
        author: config.documentation?.author || 'Development Team',
        version: config.documentation?.version || '1.0.0',
        theme: config.documentation?.theme || 'default',
        ...config.documentation
      },
      integrations: {
        kiro: {
          steeringFiles: true,
          hooks: true,
          contextAware: true,
          ...config.integrations?.kiro
        },
        git: {
          enabled: true,
          includeHistory: false,
          changePatterns: false,
          contributorStats: false,
          ...config.integrations?.git
        },
        ...config.integrations
      }
    };
  }
  
  /**
   * Generate example configuration for a project type
   */
  static generateExample(projectType: 'typescript' | 'python' | 'go' | 'mixed'): LivingDocsConfig {
    const base: LivingDocsConfig = {
      projectPath: '.',
      outputPath: 'docs',
      includePatterns: [],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      outputFormats: ['markdown', 'html'],
      webServerPort: 3000,
      features: {
        realTimeUpdates: true,
        apiDocumentation: true,
        gitIntegration: true
      }
    };
    
    switch (projectType) {
      case 'typescript':
        return {
          ...base,
          includePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
          languages: {
            typescript: {
              enabled: true,
              includePrivate: false,
              generateInterfaces: true,
              apiEndpointDetection: true
            }
          },
          documentation: {
            title: 'TypeScript Project Documentation',
            description: 'Documentation for TypeScript project',
            theme: 'modern'
          }
        };
        
      case 'python':
        return {
          ...base,
          includePatterns: ['**/*.py'],
          excludePatterns: [...base.excludePatterns, 'venv/**', '__pycache__/**'],
          languages: {
            python: {
              enabled: true,
              includePrivate: false,
              docstringStyle: 'google'
            }
          },
          documentation: {
            title: 'Python Project Documentation',
            description: 'Documentation for Python project',
            theme: 'clean'
          }
        };
        
      case 'go':
        return {
          ...base,
          includePatterns: ['**/*.go'],
          excludePatterns: [...base.excludePatterns, 'vendor/**'],
          languages: {
            go: {
              enabled: true,
              includePrivate: false,
              generateStructDocs: true
            }
          },
          documentation: {
            title: 'Go Project Documentation',
            description: 'Documentation for Go project',
            theme: 'minimal'
          }
        };
        
      case 'mixed':
        return {
          ...base,
          includePatterns: ['**/*.ts', '**/*.py', '**/*.go'],
          excludePatterns: [
            ...base.excludePatterns,
            'venv/**',
            '__pycache__/**',
            'vendor/**'
          ],
          languages: {
            typescript: {
              enabled: true,
              includePrivate: false,
              generateInterfaces: true,
              apiEndpointDetection: true
            },
            python: {
              enabled: true,
              includePrivate: false,
              docstringStyle: 'google'
            },
            go: {
              enabled: true,
              includePrivate: false,
              generateStructDocs: true
            }
          },
          features: {
            ...base.features,
            architectureDiagrams: true,
            searchIndex: true
          },
          documentation: {
            title: 'Multi-Language Project Documentation',
            description: 'Documentation for multi-language project',
            theme: 'enterprise'
          }
        };
        
      default:
        return base;
    }
  }
}

/**
 * Configuration file templates
 */
export const CONFIG_TEMPLATES = {
  minimal: {
    projectPath: '.',
    outputPath: 'docs',
    outputFormats: ['markdown']
  },
  
  standard: {
    projectPath: '.',
    outputPath: 'docs',
    includePatterns: ['src/**/*.ts', 'src/**/*.js'],
    excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.*'],
    outputFormats: ['markdown', 'html'],
    features: {
      realTimeUpdates: true,
      apiDocumentation: true
    }
  },
  
  enterprise: {
    projectPath: '.',
    outputPath: 'documentation',
    includePatterns: ['src/**/*.ts', 'lib/**/*.ts', 'api/**/*.py'],
    excludePatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '__pycache__/**',
      '**/*.test.*',
      '**/*.spec.*'
    ],
    outputFormats: ['markdown', 'html', 'json', 'openapi'],
    webServerPort: 8080,
    features: {
      realTimeUpdates: true,
      gitIntegration: true,
      apiDocumentation: true,
      architectureDiagrams: true,
      searchIndex: true,
      performanceMetrics: true
    },
    languages: {
      typescript: {
        enabled: true,
        includePrivate: true,
        generateInterfaces: true,
        apiEndpointDetection: true
      },
      python: {
        enabled: true,
        includePrivate: true,
        docstringStyle: 'sphinx'
      }
    },
    documentation: {
      title: 'Enterprise Platform Documentation',
      description: 'Complete technical documentation',
      author: 'Engineering Team',
      version: '1.0.0',
      theme: 'corporate'
    },
    integrations: {
      kiro: {
        steeringFiles: true,
        hooks: true,
        contextAware: true
      },
      git: {
        enabled: true,
        includeHistory: true,
        changePatterns: true,
        contributorStats: true
      }
    }
  }
};
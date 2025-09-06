import { ProjectConfig } from './types';
import { ProjectDetector } from './project-detector';
import { ConfigValidator } from './config-schema';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuration management for the Living Documentation Generator
 */

export class ConfigManager {
  private static readonly DEFAULT_CONFIG: Partial<ProjectConfig> = {
    outputPath: 'docs',
    includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go'],
    excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*'],
    languages: ['typescript', 'javascript', 'python', 'go'],
    outputFormats: ['markdown', 'html'],
    webServerPort: 3000,
    watchDebounceMs: 300,
    cacheSizeMB: 100,
    analysisTimeoutMs: 15000,
  };

  public static async loadConfig(projectPath: string): Promise<ProjectConfig> {
    const configPath = path.join(projectPath, 'living-docs.config.json');
    let userConfig: Partial<ProjectConfig> = {};

    // Try to load user configuration
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        userConfig = JSON.parse(configContent);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Warning: Failed to parse config file ${configPath}:`, error);
      }
    }

    // Auto-detect project if no user config exists or if auto-detection is requested
    let detectedConfig: Partial<ProjectConfig> = {};
    if (!fs.existsSync(configPath) || userConfig.autoDetect !== false) {
      try {
        const detected = await ProjectDetector.detectProject(projectPath);
        detectedConfig = detected.suggestedConfig;
        
        // Log detection results for user awareness
        console.log(`Auto-detected project type: ${detected.type}`);
        console.log(`Detected languages: ${detected.languages.join(', ')}`);
        if (detected.frameworks.length > 0) {
          console.log(`Detected frameworks: ${detected.frameworks.join(', ')}`);
        }
      } catch (error) {
        console.warn('Project auto-detection failed, using defaults:', error);
      }
    }

    // Get environment configuration
    const envConfig = this.getEnvironmentConfig();

    // Merge configurations: defaults < detected < user config < environment
    // Special handling for arrays - don't override defaults with empty arrays
    const mergedConfig = {
      ...this.DEFAULT_CONFIG,
      ...detectedConfig,
      ...userConfig,
      ...envConfig,
    };

    // Ensure includePatterns and excludePatterns are never empty
    if (!mergedConfig.includePatterns || mergedConfig.includePatterns.length === 0) {
      mergedConfig.includePatterns = this.DEFAULT_CONFIG.includePatterns!;
    }
    if (!mergedConfig.excludePatterns || mergedConfig.excludePatterns.length === 0) {
      mergedConfig.excludePatterns = this.DEFAULT_CONFIG.excludePatterns!;
    }

    // Validate the final configuration
    const validation = ConfigValidator.validate(mergedConfig);
    if (!validation.valid) {
      console.error('Configuration validation errors:');
      validation.errors.forEach(error => {
        console.error(`  - ${error.field}: ${error.message}`);
        if (error.suggestion) {
          console.error(`    Suggestion: ${error.suggestion}`);
        }
      });
      throw new Error('Invalid configuration. Please fix the errors above.');
    }

    if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:');
      validation.warnings.forEach(warning => {
        console.warn(`  - ${warning.field}: ${warning.message}`);
        if (warning.suggestion) {
          console.warn(`    Suggestion: ${warning.suggestion}`);
        }
      });
    }

    // Use the fixed merged configuration with validation applied
    const finalConfig: ProjectConfig = {
      projectPath,
      ...mergedConfig,
    };

    return finalConfig;
  }

  public static async generateConfigFile(projectPath: string, options?: {
    includeComments?: boolean;
    overwrite?: boolean;
  }): Promise<void> {
    const configPath = path.join(projectPath, 'living-docs.config.json');
    
    // Check if config already exists
    if (fs.existsSync(configPath) && !options?.overwrite) {
      throw new Error(`Configuration file already exists at ${configPath}. Use overwrite option to replace it.`);
    }

    // Detect project and generate config
    const detected = await ProjectDetector.detectProject(projectPath);
    const validation = ProjectDetector.validateDetectedConfig(detected);
    
    // Create configuration object
    const config = {
      // Add metadata as comments if requested
      ...(options?.includeComments && {
        "_metadata": {
          "detectedType": detected.type,
          "detectedLanguages": detected.languages,
          "detectedFrameworks": detected.frameworks,
          "generatedAt": new Date().toISOString()
        }
      }),
      
      ...detected.suggestedConfig,
      
      // Add validation results as comments
      ...(options?.includeComments && validation.warnings.length > 0 && {
        "_warnings": validation.warnings
      }),
      
      ...(options?.includeComments && validation.suggestions.length > 0 && {
        "_suggestions": validation.suggestions
      })
    };

    // Write configuration file
    const configContent = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, configContent, 'utf-8');
    
    console.log(`Generated configuration file: ${configPath}`);
    
    if (!validation.isValid) {
      console.warn('Configuration generated with warnings. Please review the generated file.');
    }
  }



  public static getEnvironmentConfig(): Partial<ProjectConfig> {
    const config: Partial<ProjectConfig> = {};
    
    if (process.env.WEB_SERVER_PORT) {
      config.webServerPort = parseInt(process.env.WEB_SERVER_PORT);
    }
    if (process.env.WATCH_DEBOUNCE_MS) {
      config.watchDebounceMs = parseInt(process.env.WATCH_DEBOUNCE_MS);
    }
    if (process.env.CACHE_SIZE_MB) {
      config.cacheSizeMB = parseInt(process.env.CACHE_SIZE_MB);
    }
    if (process.env.ANALYSIS_TIMEOUT_MS) {
      config.analysisTimeoutMs = parseInt(process.env.ANALYSIS_TIMEOUT_MS);
    }
    
    return config;
  }
}
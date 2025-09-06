import * as fs from 'fs';
import * as path from 'path';
import { CacheManager, CacheConfig } from './cache-manager.js';

/**
 * Compiled template function type
 */
export type CompiledTemplate = (data: any) => string;

/**
 * Template metadata for cache management
 */
export interface TemplateMetadata {
  path: string;
  hash: string;
  mtime: number;
  size: number;
  dependencies: string[];
}

/**
 * Template cache entry
 */
export interface TemplateCacheEntry {
  template: CompiledTemplate;
  metadata: TemplateMetadata;
  compiledAt: number;
}

/**
 * Template compilation options
 */
export interface TemplateOptions {
  escapeHtml: boolean;
  allowUnsafeEval: boolean;
  customHelpers: Record<string, Function>;
  partialPaths: string[];
}

/**
 * Template cache for pre-compiled templates with dependency tracking
 */
export class TemplateCache {
  private cache: CacheManager<TemplateCacheEntry>;
  private templatePaths = new Set<string>();
  private watchedDirectories = new Set<string>();
  private options: TemplateOptions;

  constructor(config: Partial<CacheConfig> = {}, options: Partial<TemplateOptions> = {}) {
    const cacheConfig = {
      maxSize: config.maxSize || 10, // 10MB for templates
      maxEntries: config.maxEntries || 100,
      ttl: config.ttl || 24 * 60 * 60 * 1000, // 24 hours
      enableStats: config.enableStats !== false,
    };

    this.cache = new CacheManager<TemplateCacheEntry>(cacheConfig);
    
    this.options = {
      escapeHtml: options.escapeHtml !== false,
      allowUnsafeEval: options.allowUnsafeEval === true,
      customHelpers: options.customHelpers || {},
      partialPaths: options.partialPaths || [],
    };
  }

  /**
   * Simple template compiler (basic implementation)
   */
  private compileTemplate(templateContent: string, templatePath: string): CompiledTemplate {
    // Basic template compilation with variable substitution
    // This is a simplified implementation - in production, you might use Handlebars, Mustache, etc.
    
    return (data: any): string => {
      let result = templateContent;
      
      // Add template path as comment for debugging
      result = `<!-- Template: ${templatePath} -->\n${result}`;
      
      // Replace variables: {{variable}}
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const trimmedVar = variable.trim();
        
        // Handle helpers: {{#each items}}
        if (trimmedVar.startsWith('#each ')) {
          const arrayName = trimmedVar.substring(6);
          const array = this.getNestedProperty(data, arrayName);
          if (Array.isArray(array)) {
            // Find the closing tag
            const startTag = match;
            const endTag = '{{/each}}';
            const startIndex = result.indexOf(startTag);
            const endIndex = result.indexOf(endTag, startIndex);
            
            if (endIndex > -1) {
              const loopContent = result.substring(startIndex + startTag.length, endIndex);
              const renderedItems = array.map(item => 
                this.renderTemplateContent(loopContent, { ...data, this: item })
              ).join('');
              
              result = result.substring(0, startIndex) + renderedItems + result.substring(endIndex + endTag.length);
            }
          }
          return '';
        }
        
        // Handle conditionals: {{#if condition}}
        if (trimmedVar.startsWith('#if ')) {
          const condition = trimmedVar.substring(4);
          const value = this.getNestedProperty(data, condition);
          
          if (value) {
            const startTag = match;
            const endTag = '{{/if}}';
            const startIndex = result.indexOf(startTag);
            const endIndex = result.indexOf(endTag, startIndex);
            
            if (endIndex > -1) {
              const conditionalContent = result.substring(startIndex + startTag.length, endIndex);
              const renderedContent = this.renderTemplateContent(conditionalContent, data);
              result = result.substring(0, startIndex) + renderedContent + result.substring(endIndex + endTag.length);
            }
          }
          return '';
        }
        
        // Handle custom helpers
        if (this.options.customHelpers[trimmedVar]) {
          return this.options.customHelpers[trimmedVar](data);
        }
        
        // Regular variable substitution
        const value = this.getNestedProperty(data, trimmedVar);
        if (value === undefined || value === null) {
          return '';
        }
        
        const stringValue = String(value);
        return this.options.escapeHtml ? this.escapeHtml(stringValue) : stringValue;
      });
      
      return result;
    };
  }

  /**
   * Render template content recursively
   */
  private renderTemplateContent(content: string, data: any): string {
    const tempTemplate = this.compileTemplate(content, 'temp');
    return tempTemplate(data);
  }

  /**
   * Get nested property from object using dot notation
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    
    return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
  }

  /**
   * Get template metadata for cache validation
   */
  private async getTemplateMetadata(templatePath: string): Promise<TemplateMetadata | null> {
    try {
      const stats = await fs.promises.stat(templatePath);
      const content = await fs.promises.readFile(templatePath, 'utf-8');
      const hash = require('crypto').createHash('sha256').update(content).digest('hex');
      
      // Extract dependencies (partials, includes)
      const dependencies = this.extractDependencies(content, path.dirname(templatePath));
      
      return {
        path: templatePath,
        hash,
        mtime: stats.mtimeMs,
        size: stats.size,
        dependencies,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract template dependencies (partials, includes)
   */
  private extractDependencies(content: string, basePath: string): string[] {
    const dependencies: string[] = [];
    
    // Look for partial includes: {{> partial}}
    const partialMatches = content.match(/\{\{>\s*([^}]+)\}\}/g);
    if (partialMatches) {
      for (const match of partialMatches) {
        const partialName = match.replace(/\{\{>\s*|\}\}/g, '').trim();
        const partialPath = path.resolve(basePath, `${partialName}.hbs`);
        dependencies.push(partialPath);
      }
    }
    
    // Look for includes: {{include "file"}}
    const includeMatches = content.match(/\{\{include\s+["']([^"']+)["']\}\}/g);
    if (includeMatches) {
      for (const match of includeMatches) {
        const includePath = match.match(/["']([^"']+)["']/)?.[1];
        if (includePath) {
          const fullPath = path.resolve(basePath, includePath);
          dependencies.push(fullPath);
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Check if template or its dependencies have been modified
   */
  private async isTemplateModified(metadata: TemplateMetadata): Promise<boolean> {
    // Check main template
    const currentMetadata = await this.getTemplateMetadata(metadata.path);
    if (!currentMetadata || currentMetadata.hash !== metadata.hash) {
      return true;
    }
    
    // Check dependencies
    for (const depPath of metadata.dependencies) {
      const depMetadata = await this.getTemplateMetadata(depPath);
      if (!depMetadata) {
        continue; // Dependency might be optional
      }
      
      // Check if we have cached metadata for this dependency
      const cachedEntry = this.cache.get(depPath);
      if (!cachedEntry || cachedEntry.metadata.hash !== depMetadata.hash) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Compile and cache template
   */
  public async compileAndCache(templatePath: string): Promise<CompiledTemplate | null> {
    try {
      const metadata = await this.getTemplateMetadata(templatePath);
      if (!metadata) {
        return null;
      }

      const content = await fs.promises.readFile(templatePath, 'utf-8');
      const compiled = this.compileTemplate(content, templatePath);
      
      const entry: TemplateCacheEntry = {
        template: compiled,
        metadata,
        compiledAt: Date.now(),
      };

      this.cache.set(templatePath, entry, metadata.hash);
      this.templatePaths.add(templatePath);
      
      return compiled;
    } catch (error) {
      console.error(`Error compiling template ${templatePath}:`, error);
      return null;
    }
  }

  /**
   * Get compiled template from cache or compile if needed
   */
  public async getTemplate(templatePath: string): Promise<CompiledTemplate | null> {
    const entry = this.cache.get(templatePath);
    
    if (entry) {
      // Check if template has been modified
      const isModified = await this.isTemplateModified(entry.metadata);
      if (!isModified) {
        return entry.template;
      }
      
      // Template was modified, remove from cache
      this.cache.delete(templatePath);
    }
    
    // Compile and cache the template
    return await this.compileAndCache(templatePath);
  }

  /**
   * Render template with data
   */
  public async render(templatePath: string, data: any): Promise<string | null> {
    const template = await this.getTemplate(templatePath);
    if (!template) {
      return null;
    }
    
    try {
      return template(data);
    } catch (error) {
      console.error(`Error rendering template ${templatePath}:`, error);
      return null;
    }
  }

  /**
   * Precompile templates in a directory
   */
  public async precompileDirectory(directoryPath: string, pattern: RegExp = /\.(hbs|handlebars|mustache|html)$/): Promise<number> {
    let compiledCount = 0;
    
    try {
      const files = await fs.promises.readdir(directoryPath, { recursive: true });
      
      for (const file of files) {
        if (typeof file === 'string' && pattern.test(file)) {
          const fullPath = path.join(directoryPath, file);
          const template = await this.compileAndCache(fullPath);
          if (template) {
            compiledCount++;
          }
        }
      }
      
      this.watchedDirectories.add(directoryPath);
    } catch (error) {
      console.error(`Error precompiling templates in ${directoryPath}:`, error);
    }
    
    return compiledCount;
  }

  /**
   * Invalidate template cache
   */
  public invalidateTemplate(templatePath: string): void {
    this.cache.delete(templatePath);
    this.templatePaths.delete(templatePath);
  }

  /**
   * Invalidate templates in directory
   */
  public invalidateDirectory(directoryPath: string): void {
    for (const templatePath of this.templatePaths) {
      if (templatePath.startsWith(directoryPath)) {
        this.invalidateTemplate(templatePath);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      cache: this.cache.getStats(),
      templatePaths: this.templatePaths.size,
      watchedDirectories: this.watchedDirectories.size,
    };
  }

  /**
   * Clear all cached templates
   */
  public clear(): void {
    this.cache.clear();
    this.templatePaths.clear();
  }

  /**
   * Get cached template paths
   */
  public getCachedTemplates(): string[] {
    return Array.from(this.templatePaths);
  }

  /**
   * Add custom helper function
   */
  public addHelper(name: string, helper: Function): void {
    this.options.customHelpers[name] = helper;
  }

  /**
   * Remove custom helper function
   */
  public removeHelper(name: string): void {
    delete this.options.customHelpers[name];
  }

  /**
   * Get template compilation options
   */
  public getOptions(): TemplateOptions {
    return { ...this.options };
  }

  /**
   * Update template options
   */
  public updateOptions(options: Partial<TemplateOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Clear cache if options changed significantly
    if (options.escapeHtml !== undefined || options.customHelpers !== undefined) {
      this.clear();
    }
  }
}
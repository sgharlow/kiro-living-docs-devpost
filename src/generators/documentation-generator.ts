/**
 * Main Documentation Generator
 * 
 * Orchestrates the entire documentation generation process across multiple
 * languages and output formats. Used by performance benchmarks and main server.
 */

import { TypeScriptAnalyzer } from '../analyzers/typescript-analyzer';
import { PythonAnalyzer } from '../analyzers/python-analyzer';
import { GoAnalyzer } from '../analyzers/go-analyzer';
import { MarkdownGenerator } from './markdown-generator';
import { ProjectAnalysis, AnalysisResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentationGeneratorConfig {
  outputDir: string;
  languages: string[];
  features: {
    realTimeUpdates: boolean;
    gitIntegration: boolean;
    apiDocumentation: boolean;
    architectureDiagrams: boolean;
  };
}

export interface GeneratedDocumentation {
  markdown?: string;
  webAssets?: Record<string, string>;
  openApiSpec?: any;
}

export class DocumentationGenerator {
  private typescriptAnalyzer: TypeScriptAnalyzer;
  private pythonAnalyzer: PythonAnalyzer;
  private goAnalyzer: GoAnalyzer;
  private markdownGenerator: MarkdownGenerator;
  private config: DocumentationGeneratorConfig;

  constructor(config: DocumentationGeneratorConfig) {
    this.config = config;
    this.typescriptAnalyzer = new TypeScriptAnalyzer();
    this.pythonAnalyzer = new PythonAnalyzer();
    this.goAnalyzer = new GoAnalyzer();
    this.markdownGenerator = new MarkdownGenerator();
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Analyze an entire project directory
   */
  async analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
    const startTime = performance.now();
    
    // Find all supported source files
    const sourceFiles = await this.findSourceFiles(projectDir);
    
    const projectAnalysis: ProjectAnalysis = {
      metadata: {
        name: path.basename(projectDir),
        description: `Documentation for ${path.basename(projectDir)}`,
        languages: [],
      },
      structure: {
        directories: [],
        files: sourceFiles,
        entryPoints: [],
        testFiles: [],
        configFiles: [],
      },
      files: new Map(),
      lastUpdated: new Date(),
    };

    const languageStats: Record<string, number> = {};
    const analysisResults: AnalysisResult[] = [];

    // Analyze each file with appropriate analyzer
    for (const file of sourceFiles) {
      try {
        const analyzerInfo = this.getAnalyzerForFile(file);
        if (!analyzerInfo) continue;

        const { analyzer, language } = analyzerInfo;
        languageStats[language] = (languageStats[language] || 0) + 1;

        const result = await analyzer.analyze(file);
        projectAnalysis.files.set(file, result);
        analysisResults.push(result);
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Update metadata with detected languages
    projectAnalysis.metadata.languages = Object.keys(languageStats);

    const endTime = performance.now();
    console.log(`Project analysis completed in ${(endTime - startTime).toFixed(2)}ms`);

    return projectAnalysis;
  }

  /**
   * Generate markdown documentation from analysis
   */
  async generateMarkdown(analysis: ProjectAnalysis): Promise<string> {
    const startTime = performance.now();
    
    const projectDoc = this.markdownGenerator.generateProjectDocumentation(analysis);
    
    const endTime = performance.now();
    console.log(`Markdown generation completed in ${(endTime - startTime).toFixed(2)}ms`);
    
    return projectDoc.markdown || '';
  }

  /**
   * Generate web documentation assets
   */
  async generateWebDocumentation(analysis: ProjectAnalysis): Promise<Record<string, string>> {
    const startTime = performance.now();
    
    const webAssets: Record<string, string> = {};
    
    // Generate HTML files for each source file
    for (const [filePath, fileAnalysis] of analysis.files.entries()) {
      const fileName = path.basename(filePath, path.extname(filePath));
      const htmlContent = await this.generateHTMLForFile(filePath, fileAnalysis);
      webAssets[`${fileName}.html`] = htmlContent;
    }
    
    // Generate index page
    webAssets['index.html'] = this.generateIndexHTML(analysis);
    
    const endTime = performance.now();
    console.log(`Web documentation generation completed in ${(endTime - startTime).toFixed(2)}ms`);
    
    return webAssets;
  }

  /**
   * Generate OpenAPI specification from API analysis
   */
  async generateOpenAPISpec(analysis: ProjectAnalysis): Promise<any> {
    const startTime = performance.now();
    
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: analysis.metadata.name,
        version: '1.0.0',
        description: analysis.metadata.description,
      },
      paths: {} as Record<string, any>,
    };

    // Extract API endpoints from analysis
    for (const [, fileAnalysis] of analysis.files.entries()) {
      for (const endpoint of fileAnalysis.apiEndpoints || []) {
        const path = endpoint.path || '/unknown';
        const method = (endpoint.method || 'get').toLowerCase();
        
        if (!openApiSpec.paths[path]) {
          openApiSpec.paths[path] = {};
        }
        
        openApiSpec.paths[path][method] = {
          summary: endpoint.handler || 'API endpoint',
          responses: {
            '200': {
              description: 'Successful response',
            },
          },
        };
      }
    }

    const endTime = performance.now();
    console.log(`OpenAPI generation completed in ${(endTime - startTime).toFixed(2)}ms`);
    
    return openApiSpec;
  }

  /**
   * Process incremental update for a single file
   */
  async getIncrementalUpdate(filePath: string): Promise<AnalysisResult | null> {
    const startTime = performance.now();
    
    const analyzerInfo = this.getAnalyzerForFile(filePath);
    if (!analyzerInfo) return null;

    try {
      const result = await analyzerInfo.analyzer.analyze(filePath);
      
      const endTime = performance.now();
      console.log(`Incremental update for ${filePath} completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      console.warn(`Failed incremental update for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Find all source files in a directory
   */
  private async findSourceFiles(projectDir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.pyw', '.go'];
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common directories that don't contain source code
            if (!['node_modules', 'dist', 'build', '__pycache__', '.git'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
      }
    };

    await scanDirectory(projectDir);
    return files;
  }

  /**
   * Get appropriate analyzer for a file
   */
  private getAnalyzerForFile(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      return { analyzer: this.typescriptAnalyzer, language: 'typescript' };
    } else if (['.py', '.pyw'].includes(ext)) {
      return { analyzer: this.pythonAnalyzer, language: 'python' };
    } else if (ext === '.go') {
      return { analyzer: this.goAnalyzer, language: 'go' };
    }
    
    return null;
  }

  /**
   * Generate HTML for a single file
   */
  private async generateHTMLForFile(filePath: string, analysis: AnalysisResult): Promise<string> {
    const fileName = path.basename(filePath);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${fileName} - Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .function { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .class { margin: 20px 0; padding: 15px; border: 1px solid #ccc; background: #f9f9f9; }
        code { background: #f5f5f5; padding: 2px 4px; }
    </style>
</head>
<body>
    <h1>${fileName}</h1>
    
    <h2>Functions (${analysis.functions.length})</h2>
    ${analysis.functions.map(func => `
        <div class="function">
            <h3>${func.name}</h3>
            <p><strong>Parameters:</strong> ${func.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ')}</p>
            <p><strong>Returns:</strong> ${func.returnType || 'void'}</p>
            ${func.description ? `<p><strong>Description:</strong> ${func.description}</p>` : ''}
        </div>
    `).join('')}
    
    <h2>Classes (${analysis.classes.length})</h2>
    ${analysis.classes.map(cls => `
        <div class="class">
            <h3>${cls.name}</h3>
            <p><strong>Methods:</strong> ${cls.methods.length}</p>
            <p><strong>Properties:</strong> ${cls.properties.length}</p>
            ${cls.description ? `<p><strong>Description:</strong> ${cls.description}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }

  /**
   * Generate index HTML page
   */
  private generateIndexHTML(analysis: ProjectAnalysis): string {
    const totalFunctions = Array.from(analysis.files.values()).reduce((sum, file) => sum + file.functions.length, 0);
    const totalClasses = Array.from(analysis.files.values()).reduce((sum, file) => sum + file.classes.length, 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${analysis.metadata.name} - Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { padding: 15px; border: 1px solid #ddd; text-align: center; }
        .file-list { margin: 20px 0; }
        .file-item { margin: 10px 0; padding: 10px; border: 1px solid #eee; }
    </style>
</head>
<body>
    <h1>${analysis.metadata.name}</h1>
    <p>${analysis.metadata.description}</p>
    
    <h2>Project Statistics</h2>
    <div class="stats">
        <div class="stat">
            <h3>${analysis.files.size}</h3>
            <p>Files</p>
        </div>
        <div class="stat">
            <h3>${totalFunctions}</h3>
            <p>Functions</p>
        </div>
        <div class="stat">
            <h3>${totalClasses}</h3>
            <p>Classes</p>
        </div>
        <div class="stat">
            <h3>${analysis.metadata.languages.length}</h3>
            <p>Languages</p>
        </div>
    </div>
    
    <h2>Languages</h2>
    <ul>
        ${analysis.metadata.languages.map(lang => `<li>${lang}</li>`).join('')}
    </ul>
    
    <h2>Files</h2>
    <div class="file-list">
        ${Array.from(analysis.files.keys()).map(filePath => {
          const fileName = path.basename(filePath);
          return `<div class="file-item"><a href="${fileName}.html">${fileName}</a></div>`;
        }).join('')}
    </div>
</body>
</html>`;
  }
}
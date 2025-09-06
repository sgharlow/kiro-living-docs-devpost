/**
 * Project Auto-Detection and Configuration
 * 
 * Automatically detects project type, languages, frameworks, and generates
 * smart default configurations for the Living Documentation Generator.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, ProjectMetadata } from './types';

export interface DetectedProject {
  type: ProjectType;
  languages: string[];
  frameworks: string[];
  metadata: ProjectMetadata;
  suggestedConfig: Partial<ProjectConfig>;
}

export type ProjectType = 
  | 'node' 
  | 'python' 
  | 'go' 
  | 'mixed' 
  | 'unknown';

export interface FrameworkInfo {
  name: string;
  confidence: number;
  indicators: string[];
}

export interface LanguageInfo {
  language: string;
  fileCount: number;
  confidence: number;
  extensions: string[];
}

export class ProjectDetector {
  private static readonly PACKAGE_FILES = {
    node: ['package.json', 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'],
    python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'poetry.lock'],
    go: ['go.mod', 'go.sum', 'Gopkg.toml'],
  };

  private static readonly FRAMEWORK_INDICATORS = {
    // JavaScript/TypeScript frameworks
    react: {
      dependencies: ['react', '@types/react'],
      files: ['src/App.tsx', 'src/App.jsx', 'public/index.html'],
      patterns: ['jsx?', 'tsx?']
    },
    vue: {
      dependencies: ['vue', '@vue/cli'],
      files: ['src/App.vue', 'vue.config.js'],
      patterns: ['*.vue']
    },
    angular: {
      dependencies: ['@angular/core', '@angular/cli'],
      files: ['angular.json', 'src/app/app.module.ts'],
      patterns: ['*.component.ts']
    },
    express: {
      dependencies: ['express'],
      files: ['app.js', 'server.js', 'index.js'],
      patterns: ['routes/*.js', 'middleware/*.js']
    },
    nestjs: {
      dependencies: ['@nestjs/core'],
      files: ['nest-cli.json', 'src/main.ts'],
      patterns: ['*.controller.ts', '*.service.ts']
    },
    
    // Python frameworks
    django: {
      dependencies: ['Django'],
      files: ['manage.py', 'settings.py', 'urls.py'],
      patterns: ['*/models.py', '*/views.py']
    },
    flask: {
      dependencies: ['Flask'],
      files: ['app.py', 'wsgi.py'],
      patterns: ['templates/*.html', 'static/*']
    },
    fastapi: {
      dependencies: ['fastapi'],
      files: ['main.py'],
      patterns: ['routers/*.py', 'models/*.py']
    },
    
    // Go frameworks
    gin: {
      dependencies: ['github.com/gin-gonic/gin'],
      files: [],
      patterns: ['*.go']
    },
    echo: {
      dependencies: ['github.com/labstack/echo'],
      files: [],
      patterns: ['*.go']
    }
  };

  private static readonly LANGUAGE_EXTENSIONS = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx', '.mjs'],
    python: ['.py', '.pyx', '.pyi'],
    go: ['.go'],
    java: ['.java'],
    csharp: ['.cs'],
    cpp: ['.cpp', '.cc', '.cxx', '.c++'],
    c: ['.c', '.h'],
    rust: ['.rs'],
    php: ['.php'],
    ruby: ['.rb'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts']
  };

  public static async detectProject(projectPath: string): Promise<DetectedProject> {
    const languages = await this.detectLanguages(projectPath);
    const projectType = this.determineProjectType(projectPath, languages);
    const frameworks = await this.detectFrameworks(projectPath, projectType);
    const metadata = await this.extractMetadata(projectPath, projectType);
    const suggestedConfig = this.generateSuggestedConfig(projectPath, projectType, languages, frameworks);

    return {
      type: projectType,
      languages: languages.map(l => l.language),
      frameworks: frameworks.map(f => f.name),
      metadata,
      suggestedConfig
    };
  }

  private static async detectLanguages(projectPath: string): Promise<LanguageInfo[]> {
    const languageCounts = new Map<string, { count: number; extensions: Set<string> }>();
    
    await this.walkDirectory(projectPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      for (const [language, extensions] of Object.entries(this.LANGUAGE_EXTENSIONS)) {
        if (extensions.includes(ext)) {
          const current = languageCounts.get(language) || { count: 0, extensions: new Set() };
          current.count++;
          current.extensions.add(ext);
          languageCounts.set(language, current);
          break;
        }
      }
    });

    const totalFiles = Array.from(languageCounts.values()).reduce((sum, info) => sum + info.count, 0);
    
    return Array.from(languageCounts.entries())
      .map(([language, info]) => ({
        language,
        fileCount: info.count,
        confidence: info.count / totalFiles,
        extensions: Array.from(info.extensions)
      }))
      .filter(info => info.confidence > 0.05) // Only include languages with >5% of files
      .sort((a, b) => b.confidence - a.confidence);
  }

  private static determineProjectType(projectPath: string, languages: LanguageInfo[]): ProjectType {
    // Check for package files to determine primary project type
    for (const [type, packageFiles] of Object.entries(this.PACKAGE_FILES)) {
      for (const packageFile of packageFiles) {
        if (fs.existsSync(path.join(projectPath, packageFile))) {
          return type as ProjectType;
        }
      }
    }

    // Fallback to language-based detection
    if (languages.length === 0) return 'unknown';
    if (languages.length === 1) {
      const primaryLanguage = languages[0].language;
      if (['typescript', 'javascript'].includes(primaryLanguage)) return 'node';
      if (primaryLanguage === 'python') return 'python';
      if (primaryLanguage === 'go') return 'go';
    }

    return 'mixed';
  }

  private static async detectFrameworks(projectPath: string, projectType: ProjectType): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    
    for (const [frameworkName, indicators] of Object.entries(this.FRAMEWORK_INDICATORS)) {
      let confidence = 0;
      const foundIndicators: string[] = [];

      // Check dependencies
      if (indicators.dependencies.length > 0) {
        const dependencies = await this.getDependencies(projectPath, projectType);
        const foundDeps = indicators.dependencies.filter(dep => dependencies.includes(dep));
        if (foundDeps.length > 0) {
          confidence += (foundDeps.length / indicators.dependencies.length) * 0.6;
          foundIndicators.push(...foundDeps.map(dep => `dependency: ${dep}`));
        }
      }

      // Check for specific files
      if (indicators.files.length > 0) {
        const foundFiles = indicators.files.filter(file => 
          fs.existsSync(path.join(projectPath, file))
        );
        if (foundFiles.length > 0) {
          confidence += (foundFiles.length / indicators.files.length) * 0.3;
          foundIndicators.push(...foundFiles.map(file => `file: ${file}`));
        }
      }

      // Check for file patterns
      if (indicators.patterns.length > 0) {
        const patternMatches = await this.checkPatterns(projectPath, indicators.patterns);
        if (patternMatches > 0) {
          confidence += Math.min(patternMatches / 10, 0.1); // Cap pattern contribution
          foundIndicators.push(`patterns: ${patternMatches} matches`);
        }
      }

      if (confidence > 0.2) { // Only include frameworks with >20% confidence
        frameworks.push({
          name: frameworkName,
          confidence,
          indicators: foundIndicators
        });
      }
    }

    return frameworks.sort((a, b) => b.confidence - a.confidence);
  }

  private static async getDependencies(projectPath: string, projectType: ProjectType): Promise<string[]> {
    const dependencies: string[] = [];

    try {
      switch (projectType) {
        case 'node': {
          const packageJsonPath = path.join(projectPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const deps = {
              ...packageJson.dependencies,
              ...packageJson.devDependencies,
              ...packageJson.peerDependencies
            };
            dependencies.push(...Object.keys(deps));
          }
          break;
        }
        case 'python': {
          // Check requirements.txt
          const requirementsPath = path.join(projectPath, 'requirements.txt');
          if (fs.existsSync(requirementsPath)) {
            const content = fs.readFileSync(requirementsPath, 'utf-8');
            const deps = content.split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('#'))
              .map(line => line.split(/[>=<]/)[0].trim());
            dependencies.push(...deps);
          }

          // Check pyproject.toml
          const pyprojectPath = path.join(projectPath, 'pyproject.toml');
          if (fs.existsSync(pyprojectPath)) {
            const content = fs.readFileSync(pyprojectPath, 'utf-8');
            // Simple regex to extract dependencies - could be improved with proper TOML parser
            const depMatches = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
            if (depMatches) {
              const depList = depMatches[1].match(/"([^"]+)"/g);
              if (depList) {
                dependencies.push(...depList.map(dep => dep.replace(/"/g, '').split(/[>=<]/)[0].trim()));
              }
            }
          }
          break;
        }
        case 'go': {
          const goModPath = path.join(projectPath, 'go.mod');
          if (fs.existsSync(goModPath)) {
            const content = fs.readFileSync(goModPath, 'utf-8');
            const requireMatches = content.match(/require\s+\(([\s\S]*?)\)/);
            if (requireMatches) {
              const deps = requireMatches[1].split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('//'))
                .map(line => line.split(/\s+/)[0]);
              dependencies.push(...deps);
            }
          }
          break;
        }
      }
    } catch (error) {
      // Silently fail dependency detection - not critical
    }

    return dependencies;
  }

  private static async checkPatterns(projectPath: string, patterns: string[]): Promise<number> {
    let matches = 0;
    
    for (const pattern of patterns) {
      await this.walkDirectory(projectPath, (filePath) => {
        const relativePath = path.relative(projectPath, filePath);
        if (this.matchesPattern(relativePath, pattern)) {
          matches++;
        }
      });
    }

    return matches;
  }

  private static matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  private static async extractMetadata(projectPath: string, projectType: ProjectType): Promise<ProjectMetadata> {
    const metadata: ProjectMetadata = {
      name: path.basename(projectPath),
      languages: []
    };

    try {
      switch (projectType) {
        case 'node': {
          const packageJsonPath = path.join(projectPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            metadata.name = packageJson.name || metadata.name;
            metadata.version = packageJson.version;
            metadata.description = packageJson.description;
            if (packageJson.repository) {
              metadata.repository = {
                url: typeof packageJson.repository === 'string' 
                  ? packageJson.repository 
                  : packageJson.repository.url
              };
            }
          }
          break;
        }
        case 'python': {
          const setupPyPath = path.join(projectPath, 'setup.py');
          if (fs.existsSync(setupPyPath)) {
            const content = fs.readFileSync(setupPyPath, 'utf-8');
            const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
            const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
            const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
            
            if (nameMatch) metadata.name = nameMatch[1];
            if (versionMatch) metadata.version = versionMatch[1];
            if (descMatch) metadata.description = descMatch[1];
          }

          const pyprojectPath = path.join(projectPath, 'pyproject.toml');
          if (fs.existsSync(pyprojectPath)) {
            const content = fs.readFileSync(pyprojectPath, 'utf-8');
            const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
            const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
            const descMatch = content.match(/description\s*=\s*"([^"]+)"/);
            
            if (nameMatch) metadata.name = nameMatch[1];
            if (versionMatch) metadata.version = versionMatch[1];
            if (descMatch) metadata.description = descMatch[1];
          }
          break;
        }
        case 'go': {
          const goModPath = path.join(projectPath, 'go.mod');
          if (fs.existsSync(goModPath)) {
            const content = fs.readFileSync(goModPath, 'utf-8');
            const moduleMatch = content.match(/module\s+([^\s]+)/);
            if (moduleMatch) {
              metadata.name = path.basename(moduleMatch[1]);
            }
          }
          break;
        }
      }
    } catch (error) {
      // Silently fail metadata extraction - use defaults
    }

    return metadata;
  }

  private static generateSuggestedConfig(
    projectPath: string, 
    projectType: ProjectType, 
    languages: LanguageInfo[], 
    frameworks: FrameworkInfo[]
  ): Partial<ProjectConfig> {
    const config: Partial<ProjectConfig> = {
      projectPath,
      languages: languages.map(l => l.language),
    };

    // Set output path based on project type
    switch (projectType) {
      case 'node':
        config.outputPath = 'docs';
        break;
      case 'python':
        config.outputPath = 'docs';
        break;
      case 'go':
        config.outputPath = 'docs';
        break;
      default:
        config.outputPath = 'documentation';
    }

    // Configure include patterns based on detected languages
    const includePatterns: string[] = [];
    const excludePatterns = ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'];

    for (const langInfo of languages) {
      const extensions = this.LANGUAGE_EXTENSIONS[langInfo.language as keyof typeof this.LANGUAGE_EXTENSIONS];
      if (extensions) {
        includePatterns.push(...extensions.map(ext => `**/*${ext}`));
      }
    }

    // Add framework-specific patterns
    for (const framework of frameworks) {
      switch (framework.name) {
        case 'react':
        case 'vue':
        case 'angular':
          includePatterns.push('**/*.jsx', '**/*.tsx', '**/*.vue');
          excludePatterns.push('public/**', 'static/**');
          break;
        case 'django':
          includePatterns.push('**/models.py', '**/views.py', '**/urls.py');
          excludePatterns.push('**/migrations/**', '**/static/**', '**/media/**');
          break;
        case 'flask':
          includePatterns.push('**/templates/**', '**/static/**');
          break;
      }
    }

    config.includePatterns = [...new Set(includePatterns)]; // Remove duplicates
    config.excludePatterns = [...new Set(excludePatterns)];

    // Set appropriate output formats
    config.outputFormats = ['markdown', 'html'];

    // Configure web server port (avoid common conflicts)
    config.webServerPort = 3000;
    if (frameworks.some(f => ['react', 'vue', 'angular'].includes(f.name))) {
      config.webServerPort = 3001; // Avoid conflict with dev servers
    }

    return config;
  }

  private static async walkDirectory(
    dirPath: string, 
    callback: (filePath: string) => void,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip common directories that shouldn't be analyzed
        if (entry.isDirectory()) {
          if (!this.shouldSkipDirectory(entry.name)) {
            await this.walkDirectory(fullPath, callback, maxDepth, currentDepth + 1);
          }
        } else if (entry.isFile()) {
          callback(fullPath);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
  }

  private static shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', 'dist', 'build', '__pycache__', 
      '.pytest_cache', 'vendor', 'target', '.next', '.nuxt',
      'coverage', '.coverage', '.tox', 'venv', 'env', '.env'
    ];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Validates the detected project configuration and provides user-friendly guidance
   */
  public static validateDetectedConfig(detected: DetectedProject): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid = true;

    // Check if any languages were detected
    if (detected.languages.length === 0) {
      warnings.push('No supported programming languages detected in the project');
      suggestions.push('Ensure your project contains files with supported extensions (.ts, .js, .py, .go, etc.)');
      isValid = false;
    }

    // Check for mixed language projects
    if (detected.languages.length > 3) {
      warnings.push(`Multiple languages detected (${detected.languages.join(', ')})`);
      suggestions.push('Consider creating separate documentation configurations for different language components');
    }

    // Check for framework conflicts
    const webFrameworks = detected.frameworks.filter(f => 
      ['react', 'vue', 'angular', 'express', 'nestjs'].includes(f)
    );
    if (webFrameworks.length > 1) {
      warnings.push(`Multiple web frameworks detected: ${webFrameworks.join(', ')}`);
      suggestions.push('Verify that the framework detection is accurate for your project structure');
    }

    // Check project type consistency
    if (detected.type === 'unknown') {
      warnings.push('Could not determine project type automatically');
      suggestions.push('Consider adding a package.json, requirements.txt, or go.mod file to help with detection');
    }

    return { isValid, warnings, suggestions };
  }
}
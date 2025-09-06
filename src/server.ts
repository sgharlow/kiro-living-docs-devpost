#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TypeScriptAnalyzer } from './analyzers/typescript-analyzer.js';
import { PythonAnalyzer } from './analyzers/python-analyzer.js';
import { GoAnalyzer } from './analyzers/go-analyzer.js';
import { MarkdownGenerator } from './generators/markdown-generator.js';
import { FileWatcher } from './watcher.js';
import { ConfigManager } from './config.js';
import { ProjectDetector } from './project-detector.js';
import { FileChange, ProjectAnalysis, ProjectMetadata } from './types.js';
import { PerformanceOptimizer } from './performance/performance-optimizer.js';
import { OnboardingManager } from './onboarding/onboarding-manager.js';
import { ConfigurationWizard } from './wizard/configuration-wizard.js';
import { TroubleshootingGuide } from './troubleshooting/troubleshooting-guide.js';
import { UsageAnalytics } from './analytics/usage-analytics.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Living Documentation Generator MCP Server
 * 
 * This server provides tools for automatically generating and maintaining
 * project documentation in real-time by analyzing code changes, git history,
 * and project structure.
 */

class LivingDocsServer {
  private server: Server;
  private typescriptAnalyzer: TypeScriptAnalyzer;
  private pythonAnalyzer: PythonAnalyzer;
  private goAnalyzer: GoAnalyzer;
  private markdownGenerator: MarkdownGenerator;
  private watchedProjects = new Map<string, FileWatcher>();
  private performanceOptimizer: PerformanceOptimizer;
  private onboardingManager: OnboardingManager;
  private troubleshootingGuide: TroubleshootingGuide;
  private usageAnalytics: UsageAnalytics;

  constructor() {
    this.typescriptAnalyzer = new TypeScriptAnalyzer();
    this.pythonAnalyzer = new PythonAnalyzer();
    this.goAnalyzer = new GoAnalyzer();
    this.markdownGenerator = new MarkdownGenerator();
    this.performanceOptimizer = new PerformanceOptimizer();
    this.onboardingManager = new OnboardingManager();
    this.troubleshootingGuide = new TroubleshootingGuide();
    this.usageAnalytics = new UsageAnalytics();
    
    this.server = new Server(
      {
        name: 'living-docs-generator',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupAnalytics();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_docs',
            description: 'Generate documentation for the current project',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
                outputFormat: {
                  type: 'string',
                  enum: ['markdown', 'html', 'both'],
                  description: 'Output format for documentation',
                  default: 'both',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'watch_project',
            description: 'Start watching project for changes and update documentation automatically',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory to watch',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'stop_watching',
            description: 'Stop watching project for changes',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'detect_project',
            description: 'Auto-detect project type, languages, and frameworks, and optionally generate configuration',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
                generateConfig: {
                  type: 'boolean',
                  description: 'Whether to generate a configuration file',
                  default: false,
                },
                overwrite: {
                  type: 'boolean',
                  description: 'Whether to overwrite existing configuration file',
                  default: false,
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'start_onboarding',
            description: 'Start the interactive onboarding process for new users',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
                experienceLevel: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced'],
                  description: 'User experience level',
                  default: 'beginner',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'configuration_wizard',
            description: 'Launch interactive configuration wizard for complex project setup',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'troubleshoot',
            description: 'Diagnose issues and get troubleshooting suggestions',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory (optional)',
                },
                issue: {
                  type: 'string',
                  description: 'Description of the issue you are experiencing (optional)',
                },
              },
            },
          },
          {
            name: 'get_analytics',
            description: 'Get usage analytics and performance insights',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['metrics', 'demo_insights', 'export'],
                  description: 'Type of analytics to retrieve',
                  default: 'metrics',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'generate_docs':
            return await this.handleGenerateDocs(args || {});
          
          case 'watch_project':
            return await this.handleWatchProject(args || {});
          
          case 'stop_watching':
            return await this.handleStopWatching();
          
          case 'detect_project':
            return await this.handleDetectProject(args || {});
          
          case 'start_onboarding':
            return await this.handleStartOnboarding(args || {});
          
          case 'configuration_wizard':
            return await this.handleConfigurationWizard(args || {});
          
          case 'troubleshoot':
            return await this.handleTroubleshoot(args || {});
          
          case 'get_analytics':
            return await this.handleGetAnalytics(args || {});
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

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

  private async handleGenerateDocs(args: Record<string, unknown>) {
    const { projectPath, outputFormat = 'both' } = args;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    try {
      // Load project configuration
      const config = await ConfigManager.loadConfig(projectPath);
      
      // Find source files in the project (multi-language)
      const glob = await import('glob');
      
      const patterns = config.includePatterns || ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.py', '**/*.go'];
      const files: string[] = [];
      
      for (const pattern of patterns) {
        const matches = glob.globSync(pattern, {
          cwd: projectPath,
          ignore: config.excludePatterns || ['node_modules/**', 'dist/**', '__pycache__/**', '*.pyc'],
        });
        files.push(...matches.map(f => path.resolve(projectPath, f)));
      }

      // Filter for supported source files
      const sourceFiles = files.filter(file => {
        return this.getAnalyzerForFile(file) !== null;
      });

      if (sourceFiles.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No supported source files found in project: ${projectPath}\n\nSearched patterns: ${patterns.join(', ')}\nExcluded patterns: ${config.excludePatterns?.join(', ') || 'none'}\nSupported: TypeScript, JavaScript, Python, Go`,
            },
          ],
        };
      }

      // Analyze each file with appropriate analyzer
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalInterfaces = 0;
      let totalExports = 0;
      let totalImports = 0;
      let totalTodos = 0;
      let totalApiEndpoints = 0;
      const analysisResults: string[] = [];
      const languageStats: Record<string, number> = {};

      // Handle large projects gracefully
      const maxFilesToAnalyze = sourceFiles.length > 1000 ? 50 : sourceFiles.length > 100 ? 20 : 10;
      const filesToAnalyze = sourceFiles.slice(0, maxFilesToAnalyze);
      
      if (sourceFiles.length > maxFilesToAnalyze) {
        analysisResults.push(`📊 Large project detected: ${sourceFiles.length} files found, analyzing first ${maxFilesToAnalyze} for performance`);
        analysisResults.push(`💡 For full project analysis, consider using include/exclude patterns to focus on key files`);
        analysisResults.push('');
      }

      for (const file of filesToAnalyze) {
        try {
          const analyzerInfo = this.getAnalyzerForFile(file);
          if (!analyzerInfo) continue;
          
          const { analyzer, language } = analyzerInfo;
          languageStats[language] = (languageStats[language] || 0) + 1;
          
          const result = await analyzer.analyze(file);
          
          totalFunctions += result.functions.length;
          totalClasses += result.classes.length;
          totalInterfaces += result.interfaces.length;
          totalExports += result.exports.length;
          totalImports += result.imports.length;
          totalTodos += result.todos.length;
          totalApiEndpoints += result.apiEndpoints.length;

          const relativePath = path.relative(projectPath, file);
          const languageIcon = language === 'typescript' ? '🔷' : language === 'python' ? '🐍' : '🐹';
          analysisResults.push(`${languageIcon} ${relativePath} (${language}):`);
          
          if (result.functions.length > 0) {
            analysisResults.push(`  Functions (${result.functions.length}):`);
            result.functions.slice(0, 3).forEach(func => {
              const params = func.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
              const exported = func.isExported ? ' [exported]' : '';
              const async = func.isAsync ? ' [async]' : '';
              analysisResults.push(`    - ${func.name}(${params}): ${func.returnType || 'void'}${exported}${async}`);
            });
            if (result.functions.length > 3) {
              analysisResults.push(`    ... and ${result.functions.length - 3} more`);
            }
          }

          if (result.classes.length > 0) {
            analysisResults.push(`  Classes (${result.classes.length}):`);
            result.classes.forEach(cls => {
              const exported = cls.isExported ? ' [exported]' : '';
              const extends_ = cls.extends ? ` extends ${cls.extends}` : '';
              const implements_ = cls.implements?.length ? ` implements ${cls.implements.join(', ')}` : '';
              analysisResults.push(`    - ${cls.name}${extends_}${implements_}${exported}`);
              analysisResults.push(`      Methods: ${cls.methods.length}, Properties: ${cls.properties.length}`);
            });
          }

          if (result.interfaces.length > 0) {
            analysisResults.push(`  Interfaces (${result.interfaces.length}):`);
            result.interfaces.forEach(iface => {
              const exported = iface.isExported ? ' [exported]' : '';
              analysisResults.push(`    - ${iface.name}${exported}`);
            });
          }

          if (result.todos.length > 0) {
            analysisResults.push(`  TODOs (${result.todos.length}):`);
            result.todos.slice(0, 2).forEach(todo => {
              analysisResults.push(`    - ${todo.type}: ${todo.content} (line ${todo.line})`);
            });
          }

          if (result.apiEndpoints.length > 0) {
            analysisResults.push(`  API Endpoints (${result.apiEndpoints.length}):`);
            result.apiEndpoints.slice(0, 3).forEach(endpoint => {
              analysisResults.push(`    - ${endpoint.method} ${endpoint.path} -> ${endpoint.handler}`);
            });
            if (result.apiEndpoints.length > 3) {
              analysisResults.push(`    ... and ${result.apiEndpoints.length - 3} more`);
            }
          }

          analysisResults.push(''); // Empty line between files
        } catch (error) {
          const analyzerInfo = this.getAnalyzerForFile(file);
          const language = analyzerInfo?.language || 'unknown';
          analysisResults.push(`❌ Error analyzing ${path.relative(projectPath, file)} (${language}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Generate markdown documentation
      let markdownOutput = '';
      const generatedFiles: string[] = [];

      if (outputFormat === 'markdown' || outputFormat === 'both') {
        // Create output directory
        const outputDir = path.join(projectPath, config.outputPath || 'docs');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate project-level documentation
        const detectedLanguages = Object.keys(languageStats);
        const projectMetadata: ProjectMetadata = {
          name: path.basename(projectPath),
          description: `Documentation for ${path.basename(projectPath)}`,
          languages: detectedLanguages,
        };

        const projectAnalysis: ProjectAnalysis = {
          metadata: projectMetadata,
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

        // Add analysis results to project
        for (const file of sourceFiles.slice(0, 10)) {
          try {
            const analyzerInfo = this.getAnalyzerForFile(file);
            if (!analyzerInfo) continue;
            
            const result = await analyzerInfo.analyzer.analyze(file);
            projectAnalysis.files.set(file, result);
          } catch (error) {
            // Skip files that can't be analyzed
          }
        }

        // Generate project README
        const projectDoc = this.markdownGenerator.generateProjectDocumentation(projectAnalysis);
        const readmePath = path.join(outputDir, 'README.md');
        fs.writeFileSync(readmePath, projectDoc.markdown || '');
        generatedFiles.push(readmePath);

        // Generate individual file documentation
        for (const [filePath, analysis] of projectAnalysis.files.entries()) {
          const fileName = path.basename(filePath, path.extname(filePath));
          const fileDoc = await this.markdownGenerator.generateFileDocumentation(filePath, analysis);
          const docPath = path.join(outputDir, `${fileName}.md`);
          fs.writeFileSync(docPath, fileDoc);
          generatedFiles.push(docPath);
        }

        markdownOutput = `📝 Generated ${generatedFiles.length} markdown files in ${path.relative(projectPath, outputDir)}/`;
      }

      const summary = [
        `✅ Multi-Language Documentation Generation Complete for: ${projectPath}`,
        ``,
        `🌐 Languages Detected:`,
        ...Object.entries(languageStats).map(([lang, count]) => {
          const icon = lang === 'typescript' ? '🔷' : lang === 'python' ? '🐍' : '🐹';
          return `  ${icon} ${lang}: ${count} files`;
        }),
        ``,
        `📊 Analysis Summary:`,
        `  - Files analyzed: ${filesToAnalyze.length}${sourceFiles.length > filesToAnalyze.length ? ` (showing first ${filesToAnalyze.length} of ${sourceFiles.length})` : ''}`,
        `  - Functions found: ${totalFunctions}`,
        `  - Classes found: ${totalClasses}`,
        `  - Interfaces found: ${totalInterfaces}`,
        `  - Exports found: ${totalExports}`,
        `  - Imports found: ${totalImports}`,
        `  - TODOs found: ${totalTodos}`,
        `  - API endpoints found: ${totalApiEndpoints}`,
        ``,
        markdownOutput ? `📄 Documentation Output:` : `📋 Analysis Details:`,
        markdownOutput || analysisResults.slice(0, 10).join('\n'), // Show fewer details if we generated files
        ``,
        `🔧 Output format: ${outputFormat}`,
        ``,
        // Add performance optimization suggestions for large projects
        ...(sourceFiles.length > 1000 ? [
          `⚡ Performance Optimization Tips for Large Projects (${sourceFiles.length} files):`,
          `  • Use includePatterns to focus on key directories: ["src/**/*.ts", "lib/**/*.py"]`,
          `  • Exclude test files: ["**/*.test.*", "**/*.spec.*", "test/**"]`,
          `  • Consider splitting into multiple documentation projects`,
          `  • Use the 'watch_project' tool for incremental updates instead of full regeneration`,
          ``
        ] : []),
        markdownOutput ? 
          `🎉 Real multi-language documentation generated! Check the ${config.outputPath || 'docs'} directory.` :
          `Note: This is real multi-language analysis (TypeScript, Python, Go) with proper AST parsing! 🎉`,
      ];

      return {
        content: [
          {
            type: 'text',
            text: summary.join('\n'),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate documentation for ${projectPath}: ${errorMessage}\n\nTroubleshooting tips:\n- Ensure the project path exists and is readable\n- Check that the project contains supported files (.ts, .js, .py, .go)\n- Verify include/exclude patterns in your configuration\n- Run 'npm run test:performance' to check system performance`);
    }
  }

  private async handleWatchProject(args: Record<string, unknown>) {
    const { projectPath } = args;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    // Check if already watching this project
    if (this.watchedProjects.has(projectPath)) {
      return {
        content: [
          {
            type: 'text',
            text: `Already watching project at: ${projectPath}`,
          },
        ],
      };
    }

    try {
      // Load configuration for the project
      const config = await ConfigManager.loadConfig(projectPath);
      
      // Create and start file watcher
      const watcher = new FileWatcher(config);
      
      // Set up event handlers
      watcher.on('ready', () => {
        // eslint-disable-next-line no-console
        console.error(`File watcher ready for: ${projectPath}`);
      });

      watcher.on('changes', (changes: FileChange[]) => {
        // eslint-disable-next-line no-console
        console.error(`Detected ${changes.length} file changes in ${projectPath}`);
        // TODO: Trigger documentation generation in next tasks
      });

      watcher.on('error', (error: Error) => {
        // eslint-disable-next-line no-console
        console.error(`File watcher error for ${projectPath}:`, error);
      });

      // Start watching
      await watcher.startWatching();
      
      // Store the watcher
      this.watchedProjects.set(projectPath, watcher);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Started watching project at: ${projectPath}\n\nFile watcher is now monitoring for changes to multi-language source files.\nSupported languages:\n  🔷 TypeScript/JavaScript: .ts, .js, .tsx, .jsx\n  🐍 Python: .py, .pyw\n  🐹 Go: .go\n\nChanges will be debounced by ${config.watchDebounceMs}ms to handle rapid edits.`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start watching project ${projectPath}: ${errorMessage}\n\nTroubleshooting tips:\n- Ensure the project path exists and is accessible\n- Check that you have read permissions for the directory\n- Verify the path doesn't contain special characters\n- Try running 'detect_project' first to validate the project structure`);
    }
  }

  private async handleStopWatching() {
    if (this.watchedProjects.size === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No projects are currently being watched.',
          },
        ],
      };
    }

    try {
      // Stop all watchers
      const projectPaths = Array.from(this.watchedProjects.keys());
      
      for (const [, watcher] of this.watchedProjects) {
        await watcher.stopWatching();
      }
      
      this.watchedProjects.clear();

      return {
        content: [
          {
            type: 'text',
            text: `✅ Stopped watching ${projectPaths.length} project(s):\n${projectPaths.map(p => `  - ${p}`).join('\n')}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to stop watching: ${errorMessage}\n\nThis is usually a temporary issue. You can try:\n- Restarting the MCP server\n- Checking if any files are locked by other processes\n- Running 'stop_watching' again after a few seconds`);
    }
  }

  private async handleDetectProject(args: Record<string, unknown>) {
    const { projectPath, generateConfig = false, overwrite = false } = args;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    try {
      // Detect project characteristics
      const detected = await ProjectDetector.detectProject(projectPath);
      const validation = ProjectDetector.validateDetectedConfig(detected);

      // Build response
      const response: string[] = [
        `🔍 Project Detection Results for: ${projectPath}`,
        ``,
        `📋 Project Information:`,
        `  - Type: ${detected.type}`,
        `  - Name: ${detected.metadata.name}`,
        ...(detected.metadata.version ? [`  - Version: ${detected.metadata.version}`] : []),
        ...(detected.metadata.description ? [`  - Description: ${detected.metadata.description}`] : []),
        ``,
        `💻 Detected Languages (${detected.languages.length}):`,
        ...detected.languages.map(lang => `  - ${lang}`),
        ``,
      ];

      if (detected.frameworks.length > 0) {
        response.push(
          `🚀 Detected Frameworks (${detected.frameworks.length}):`,
          ...detected.frameworks.map(framework => `  - ${framework}`),
          ``
        );
      }

      response.push(
        `⚙️ Suggested Configuration:`,
        `  - Output Path: ${detected.suggestedConfig.outputPath}`,
        `  - Web Server Port: ${detected.suggestedConfig.webServerPort}`,
        `  - Include Patterns: ${detected.suggestedConfig.includePatterns?.slice(0, 3).join(', ')}${(detected.suggestedConfig.includePatterns?.length || 0) > 3 ? '...' : ''}`,
        `  - Exclude Patterns: ${detected.suggestedConfig.excludePatterns?.slice(0, 3).join(', ')}${(detected.suggestedConfig.excludePatterns?.length || 0) > 3 ? '...' : ''}`,
        ``
      );

      // Add validation results
      if (!validation.isValid || validation.warnings.length > 0) {
        response.push(`⚠️ Validation Results:`);
        
        if (validation.warnings.length > 0) {
          response.push(`  Warnings:`);
          validation.warnings.forEach(warning => response.push(`    - ${warning}`));
        }
        
        if (validation.suggestions.length > 0) {
          response.push(`  Suggestions:`);
          validation.suggestions.forEach(suggestion => response.push(`    - ${suggestion}`));
        }
        
        response.push(``);
      }

      // Generate configuration file if requested
      if (generateConfig) {
        try {
          await ConfigManager.generateConfigFile(projectPath, {
            includeComments: true,
            overwrite: overwrite as boolean
          });
          
          response.push(
            `✅ Configuration file generated successfully!`,
            `📄 Location: ${path.join(projectPath, 'living-docs.config.json')}`,
            ``,
            `You can now run documentation generation with the optimized settings.`
          );
        } catch (error) {
          response.push(
            `❌ Failed to generate configuration file:`,
            `   ${error instanceof Error ? error.message : String(error)}`,
            ``,
            `You can still use the detected settings manually or fix the issue and try again.`
          );
        }
      } else {
        response.push(
          `💡 To generate a configuration file with these settings, run:`,
          `   detect_project with generateConfig: true`,
          ``
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: response.join('\n'),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to detect project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleStartOnboarding(args: Record<string, unknown>) {
    const { projectPath, experienceLevel = 'beginner' } = args;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    try {
      // Track onboarding start
      this.usageAnalytics.trackAction('onboarding_started', 'user_journey', {
        projectPath,
        experienceLevel
      });

      // Update user profile
      this.onboardingManager = new OnboardingManager({
        experienceLevel: experienceLevel as any,
        isFirstTime: true
      });

      // Detect project to customize onboarding
      const detected = await ProjectDetector.detectProject(projectPath);
      const mockAnalysis: ProjectAnalysis = {
        metadata: detected.metadata,
        structure: { directories: [], files: [], entryPoints: [], testFiles: [], configFiles: [] },
        files: new Map(),
        lastUpdated: new Date()
      };
      
      this.onboardingManager.updateProfileFromProject(mockAnalysis);

      // Start onboarding
      const progress = this.onboardingManager.startOnboarding();
      const currentStep = this.onboardingManager.getCurrentStep();
      const tips = this.onboardingManager.getContextualTips();
      const actions = this.onboardingManager.getQuickStartActions();

      return {
        content: [
          {
            type: 'text',
            text: [
              `🎉 Welcome to Living Documentation Generator!`,
              ``,
              `👋 Let's get you started with a personalized onboarding experience.`,
              ``,
              `📊 Progress: ${progress.completedSteps}/${progress.totalSteps} steps (${Math.round(progress.percentComplete)}%)`,
              `⏱️ Estimated time: ${progress.estimatedTimeRemaining} minutes`,
              ``,
              `📋 Current Step: ${currentStep?.title}`,
              `${currentStep?.description}`,
              ``,
              currentStep?.example ? `💡 Example: ${currentStep.example}` : '',
              ``,
              `🎯 Quick Actions:`,
              ...actions.map(action => `  • ${action.label}: ${action.description}`),
              ``,
              `💡 Tips:`,
              ...tips.map(tip => `  • ${tip}`),
              ``,
              `Use the MCP tools to complete each step, or ask for help anytime!`
            ].filter(Boolean).join('\n'),
          },
        ],
      };
    } catch (error) {
      this.usageAnalytics.trackError(error as Error, 'onboarding');
      throw new Error(`Failed to start onboarding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleConfigurationWizard(args: Record<string, unknown>) {
    const { projectPath } = args;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    try {
      this.usageAnalytics.trackAction('wizard_started', 'configuration');

      const wizard = new ConfigurationWizard(projectPath);
      await wizard.start();

      const currentStep = wizard.getCurrentStep();
      const progress = wizard.getProgress();

      if (!currentStep) {
        return {
          content: [
            {
              type: 'text',
              text: 'Configuration wizard is complete! Use the generated configuration to set up your project.',
            },
          ],
        };
      }

      const response = [
        `🧙‍♂️ Configuration Wizard`,
        ``,
        `📊 Progress: Step ${progress.current} of ${progress.total} (${Math.round(progress.percentage)}%)`,
        ``,
        `📋 ${currentStep.title}`,
        `${currentStep.description}`,
        ``,
      ];

      if (currentStep.type === 'select' && currentStep.options) {
        response.push(`Options:`);
        currentStep.options.forEach((option, index) => {
          response.push(`  ${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ''}`);
        });
        response.push('');
      }

      if (currentStep.defaultValue !== undefined) {
        response.push(`Default: ${currentStep.defaultValue}`);
        response.push('');
      }

      response.push(`💡 This wizard will help you create an optimized configuration for your project.`);
      response.push(`Use the wizard tools to answer each step and generate your configuration.`);

      return {
        content: [
          {
            type: 'text',
            text: response.join('\n'),
          },
        ],
      };
    } catch (error) {
      this.usageAnalytics.trackError(error as Error, 'configuration_wizard');
      throw new Error(`Failed to start configuration wizard: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleTroubleshoot(args: Record<string, unknown>) {
    const { projectPath, issue } = args;

    try {
      this.usageAnalytics.trackAction('troubleshooting_started', 'support');

      // Run system diagnostics
      const diagnostics = await this.troubleshootingGuide.runDiagnostics(projectPath as string);
      
      let issues: any[] = [];
      
      // If specific issue provided, search for it
      if (issue && typeof issue === 'string') {
        issues = this.troubleshootingGuide.searchIssues(issue);
      }
      
      // If no specific issues found, check performance metrics
      if (issues.length === 0) {
        const performanceMetrics = this.performanceOptimizer.getMetrics();
        issues = this.troubleshootingGuide.analyzePerformance(performanceMetrics);
      }

      const response = [
        `🔧 System Diagnostics & Troubleshooting`,
        ``,
        `📊 System Status:`,
        `  • Node.js: ${diagnostics.nodeVersion}`,
        `  • Platform: ${diagnostics.platform} (${diagnostics.architecture})`,
        `  • Memory: ${Math.round(diagnostics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        `  • Network: ${diagnostics.networkConnectivity ? '✅ Connected' : '❌ Disconnected'}`,
        `  • Permissions: Read ${diagnostics.permissions.canRead ? '✅' : '❌'} | Write ${diagnostics.permissions.canWrite ? '✅' : '❌'}`,
        ``,
      ];

      if (issues.length > 0) {
        response.push(`🚨 Identified Issues:`);
        issues.forEach((issue, index) => {
          response.push(`${index + 1}. ${issue.title} (${issue.severity})`);
          response.push(`   ${issue.description}`);
          if (issue.solutions.length > 0) {
            response.push(`   💡 Solutions available: ${issue.solutions.length}`);
          }
          response.push('');
        });
      } else {
        response.push(`✅ No issues detected! System appears to be running normally.`);
        response.push('');
      }

      // Add performance recommendations
      const recommendations = this.performanceOptimizer.getOptimizationRecommendations();
      if (recommendations.length > 0) {
        response.push(`🎯 Performance Recommendations:`);
        recommendations.forEach(rec => {
          response.push(`  • ${rec}`);
        });
        response.push('');
      }

      response.push(`📋 For detailed troubleshooting report, use: get_analytics with type: "export"`);

      return {
        content: [
          {
            type: 'text',
            text: response.join('\n'),
          },
        ],
      };
    } catch (error) {
      this.usageAnalytics.trackError(error as Error, 'troubleshooting');
      throw new Error(`Troubleshooting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetAnalytics(args: Record<string, unknown>) {
    const { type = 'metrics' } = args;

    try {
      this.usageAnalytics.trackAction('analytics_requested', 'insights', { type });

      switch (type) {
        case 'metrics': {
          const metrics = this.usageAnalytics.getMetrics();
          return {
            content: [
              {
                type: 'text',
                text: [
                  `📊 Usage Analytics & Performance Metrics`,
                  ``,
                  `📈 Session Statistics:`,
                  `  • Total Sessions: ${metrics.totalSessions}`,
                  `  • Total Events: ${metrics.totalEvents}`,
                  `  • Average Session Duration: ${Math.round(metrics.averageSessionDuration / 1000)}s`,
                  ``,
                  `🚀 Performance Metrics:`,
                  `  • Average Analysis Time: ${Math.round(metrics.performanceMetrics.averageAnalysisTime)}ms`,
                  `  • Average Generation Time: ${Math.round(metrics.performanceMetrics.averageGenerationTime)}ms`,
                  `  • Cache Hit Rate: ${Math.round(metrics.performanceMetrics.cacheHitRate)}%`,
                  ``,
                  `🎯 Most Used Features:`,
                  ...metrics.mostUsedFeatures.slice(0, 5).map(f => 
                    `  • ${f.feature}: ${f.count} uses (${Math.round(f.percentage)}%)`
                  ),
                  ``,
                  `💻 Project Insights:`,
                  `  • Languages: ${Object.keys(metrics.projectInsights.languageDistribution).join(', ')}`,
                  `  • Error Rate: ${Math.round(metrics.errorRate * 100) / 100}%`,
                ].join('\n'),
              },
            ],
          };
        }

        case 'demo_insights': {
          const demoInsights = this.usageAnalytics.generateDemoInsights();
          return {
            content: [
              {
                type: 'text',
                text: [
                  `🎯 Demo Insights & Key Metrics`,
                  ``,
                  `📊 Key Performance Indicators:`,
                  `  • Documentation Generated: ${demoInsights.keyMetrics.totalDocumentationGenerated}`,
                  `  • Average Generation Time: ${demoInsights.keyMetrics.averageGenerationTime}`,
                  `  • Real-time Updates: ${demoInsights.keyMetrics.realTimeUpdatesDelivered}`,
                  `  • Search Queries: ${demoInsights.keyMetrics.searchQueriesProcessed}`,
                  `  • API Endpoints: ${demoInsights.keyMetrics.apiEndpointsDocumented}`,
                  ``,
                  `🏆 Performance Highlights:`,
                  `  • Fastest Analysis: ${demoInsights.performanceHighlights.fastestAnalysis}ms`,
                  `  • Largest Project: ${demoInsights.performanceHighlights.largestProjectProcessed} files`,
                  `  • Uptime: ${demoInsights.performanceHighlights.uptimePercentage}%`,
                  `  • Memory Efficiency: ${demoInsights.performanceHighlights.memoryEfficiency}`,
                  ``,
                  `🎉 Success Stories:`,
                  ...demoInsights.successStories.map(story => 
                    `  • ${story.metric}: ${story.value} - ${story.description}`
                  ),
                ].join('\n'),
              },
            ],
          };
        }

        case 'export': {
          const exportData = this.usageAnalytics.exportData('json');
          const report = await this.troubleshootingGuide.generateReport();
          
          return {
            content: [
              {
                type: 'text',
                text: [
                  `📋 Complete Analytics Export`,
                  ``,
                  `Analytics data and troubleshooting report have been generated.`,
                  ``,
                  `📊 Analytics Summary:`,
                  `  • Events tracked: ${JSON.parse(exportData).events.length}`,
                  `  • Sessions recorded: ${JSON.parse(exportData).sessions.length}`,
                  `  • Export size: ${Math.round(exportData.length / 1024)}KB`,
                  ``,
                  `🔧 System Report:`,
                  report,
                ].join('\n'),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown analytics type: ${type}`);
      }
    } catch (error) {
      this.usageAnalytics.trackError(error as Error, 'analytics');
      throw new Error(`Failed to get analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setupAnalytics(): void {
    // Track server startup
    this.usageAnalytics.trackAction('server_started', 'system');

    // Track performance metrics
    this.performanceOptimizer.on('analysis-complete', (data) => {
      this.usageAnalytics.trackPerformance('analysis_time', data.duration);
    });

    // Track errors
    process.on('uncaughtException', (error) => {
      this.usageAnalytics.trackError(error, 'uncaught_exception');
    });

    process.on('unhandledRejection', (reason) => {
      if (reason instanceof Error) {
        this.usageAnalytics.trackError(reason, 'unhandled_rejection');
      }
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Log server start (will be replaced with proper logging in later tasks)
    // eslint-disable-next-line no-console
    console.error('Living Documentation Generator MCP Server started');
  }
}

// Start the server
async function main() {
  const server = new LivingDocsServer();
  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { LivingDocsServer };
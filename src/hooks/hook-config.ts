import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface HookConfiguration {
  enabled: boolean;
  hooks: {
    [hookName: string]: HookDefinition;
  };
  global?: GlobalHookSettings;
}

export interface HookDefinition {
  name: string;
  description: string;
  trigger: HookTrigger;
  actions: HookAction[];
  conditions?: HookCondition[];
  enabled: boolean;
  debounceMs?: number;
  priority?: number;
}

export interface HookTrigger {
  event: 'file-save' | 'commit' | 'pull-request' | 'file-focus' | 'branch-switch' | 'manual';
  patterns?: string[];
  excludePatterns?: string[];
  fileTypes?: string[];
}

export interface HookAction {
  type: 'generate-docs' | 'update-readme' | 'run-tests' | 'notify' | 'custom-command';
  config: {
    [key: string]: any;
  };
}

export interface HookCondition {
  type: 'file-exists' | 'git-status' | 'file-size' | 'time-range' | 'custom';
  config: {
    [key: string]: any;
  };
}

export interface GlobalHookSettings {
  outputPath?: string;
  notificationsEnabled?: boolean;
  maxConcurrentHooks?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  errorHandling?: 'continue' | 'stop' | 'retry';
}

/**
 * Manages hook configuration loading and validation
 */
export class HookConfigManager {
  private readonly projectPath: string;
  private configPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, '.kiro', 'hooks');
  }

  /**
   * Load hook configuration from project
   */
  public loadConfiguration(): HookConfiguration {
    const defaultConfig: HookConfiguration = {
      enabled: true,
      hooks: {},
      global: {
        outputPath: 'docs',
        notificationsEnabled: true,
        maxConcurrentHooks: 3,
        logLevel: 'info',
        errorHandling: 'continue',
      },
    };

    try {
      // Check if hooks directory exists
      if (!fs.existsSync(this.configPath)) {
        return defaultConfig;
      }

      // Load configuration files
      const configFiles = fs.readdirSync(this.configPath)
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json'))
        .map(file => path.join(this.configPath, file));

      let mergedConfig = { ...defaultConfig };

      for (const configFile of configFiles) {
        const fileConfig = this.loadConfigFile(configFile);
        mergedConfig = this.mergeConfigurations(mergedConfig, fileConfig);
      }

      // Validate configuration
      this.validateConfiguration(mergedConfig);

      return mergedConfig;
    } catch (error) {
      console.error('Error loading hook configuration:', error);
      return defaultConfig;
    }
  }

  /**
   * Load a single configuration file
   */
  private loadConfigFile(filePath: string): Partial<HookConfiguration> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.json') {
        return JSON.parse(content);
      } else if (ext === '.yaml' || ext === '.yml') {
        return yaml.load(content) as Partial<HookConfiguration>;
      }

      return {};
    } catch (error) {
      console.error(`Error loading config file ${filePath}:`, error);
      return {};
    }
  }

  /**
   * Merge two configurations
   */
  private mergeConfigurations(base: HookConfiguration, override: Partial<HookConfiguration>): HookConfiguration {
    return {
      enabled: override.enabled !== undefined ? override.enabled : base.enabled,
      hooks: {
        ...base.hooks,
        ...override.hooks,
      },
      global: {
        ...base.global,
        ...override.global,
      },
    };
  }

  /**
   * Validate hook configuration
   */
  private validateConfiguration(config: HookConfiguration): void {
    // Validate global settings
    if (config.global) {
      if (config.global.maxConcurrentHooks && (config.global.maxConcurrentHooks < 1 || config.global.maxConcurrentHooks > 10)) {
        console.warn('maxConcurrentHooks should be between 1 and 10');
      }

      if (config.global.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.global.logLevel)) {
        console.warn(`Invalid log level: ${config.global.logLevel}`);
      }
    }

    // Validate individual hooks
    Object.entries(config.hooks).forEach(([hookName, hook]) => {
      this.validateHook(hookName, hook);
    });
  }

  /**
   * Validate a single hook definition
   */
  private validateHook(name: string, hook: HookDefinition): void {
    if (!hook.name || !hook.trigger || !hook.actions) {
      console.warn(`Hook ${name} is missing required fields`);
      return;
    }

    // Validate trigger
    const validEvents = ['file-save', 'commit', 'pull-request', 'file-focus', 'branch-switch', 'manual'];
    if (!validEvents.includes(hook.trigger.event)) {
      console.warn(`Hook ${name} has invalid trigger event: ${hook.trigger.event}`);
    }

    // Validate actions
    hook.actions.forEach((action, index) => {
      const validActionTypes = ['generate-docs', 'update-readme', 'run-tests', 'notify', 'custom-command'];
      if (!validActionTypes.includes(action.type)) {
        console.warn(`Hook ${name} action ${index} has invalid type: ${action.type}`);
      }
    });

    // Validate debounce time
    if (hook.debounceMs && (hook.debounceMs < 100 || hook.debounceMs > 30000)) {
      console.warn(`Hook ${name} debounce time should be between 100ms and 30s`);
    }
  }

  /**
   * Save configuration to file
   */
  public saveConfiguration(config: HookConfiguration): void {
    try {
      // Ensure hooks directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      const configFile = path.join(this.configPath, 'hooks.yaml');
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 100,
        noRefs: true,
      });

      fs.writeFileSync(configFile, yamlContent);
    } catch (error) {
      console.error('Error saving hook configuration:', error);
      throw error;
    }
  }

  /**
   * Create default hook configurations
   */
  public createDefaultHooks(): HookConfiguration {
    const defaultHooks: HookConfiguration = {
      enabled: true,
      global: {
        outputPath: 'docs',
        notificationsEnabled: true,
        maxConcurrentHooks: 3,
        logLevel: 'info',
        errorHandling: 'continue',
      },
      hooks: {
        'auto-doc-on-save': {
          name: 'Auto Documentation on Save',
          description: 'Automatically update documentation when source files are saved',
          trigger: {
            event: 'file-save',
            fileTypes: ['.ts', '.js', '.py'],
            excludePatterns: ['node_modules/**', '**/*.test.*', '**/*.spec.*'],
          },
          actions: [
            {
              type: 'generate-docs',
              config: {
                scope: 'file',
                format: 'markdown',
              },
            },
          ],
          enabled: true,
          debounceMs: 1000,
          priority: 1,
        },
        'full-docs-on-commit': {
          name: 'Full Documentation on Commit',
          description: 'Regenerate all documentation after commits',
          trigger: {
            event: 'commit',
          },
          actions: [
            {
              type: 'generate-docs',
              config: {
                scope: 'project',
                format: 'markdown',
                includeGitHistory: true,
              },
            },
            {
              type: 'update-readme',
              config: {
                includeStats: true,
              },
            },
          ],
          enabled: true,
          debounceMs: 5000,
          priority: 2,
        },
        'contextual-docs-on-focus': {
          name: 'Contextual Documentation on File Focus',
          description: 'Show relevant documentation when focusing on a file',
          trigger: {
            event: 'file-focus',
            fileTypes: ['.ts', '.js', '.py'],
          },
          actions: [
            {
              type: 'generate-docs',
              config: {
                scope: 'contextual',
                includeHistory: true,
                includeRelated: true,
              },
            },
          ],
          enabled: true,
          debounceMs: 500,
          priority: 3,
        },
        'pr-docs-diff': {
          name: 'Documentation Diff for Pull Requests',
          description: 'Generate documentation changes summary for pull requests',
          trigger: {
            event: 'pull-request',
          },
          actions: [
            {
              type: 'generate-docs',
              config: {
                scope: 'diff',
                format: 'markdown',
                compareWithBase: true,
              },
            },
          ],
          enabled: false, // Disabled by default
          priority: 4,
        },
        'branch-context-update': {
          name: 'Update Documentation Context on Branch Switch',
          description: 'Update documentation context when switching branches',
          trigger: {
            event: 'branch-switch',
          },
          actions: [
            {
              type: 'generate-docs',
              config: {
                scope: 'project',
                updateContext: true,
              },
            },
          ],
          enabled: true,
          debounceMs: 2000,
          priority: 5,
        },
      },
    };

    return defaultHooks;
  }

  /**
   * Get hook by name
   */
  public getHook(config: HookConfiguration, hookName: string): HookDefinition | null {
    return config.hooks[hookName] || null;
  }

  /**
   * Get hooks by trigger event
   */
  public getHooksByEvent(config: HookConfiguration, event: string): HookDefinition[] {
    return Object.values(config.hooks)
      .filter(hook => hook.enabled && hook.trigger.event === event)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * Get the project path
   */
  public getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Check if hooks directory exists
   */
  public hasHookConfiguration(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Initialize hooks directory with default configuration
   */
  public initializeHooks(): void {
    const defaultConfig = this.createDefaultHooks();
    this.saveConfiguration(defaultConfig);
    
    // Create example hook file
    const exampleHook = `# Example Custom Hook

This is an example of how to create custom hooks for your project.

## Hook Configuration

\`\`\`yaml
enabled: true
hooks:
  my-custom-hook:
    name: "My Custom Hook"
    description: "Custom documentation generation"
    trigger:
      event: "file-save"
      fileTypes: [".ts", ".js"]
    actions:
      - type: "generate-docs"
        config:
          scope: "file"
          format: "markdown"
    enabled: true
    debounceMs: 1000
\`\`\`

## Available Events

- \`file-save\`: Triggered when a file is saved
- \`commit\`: Triggered after a git commit
- \`pull-request\`: Triggered for pull request events
- \`file-focus\`: Triggered when a file receives focus
- \`branch-switch\`: Triggered when switching git branches
- \`manual\`: Triggered manually by user action

## Available Actions

- \`generate-docs\`: Generate documentation
- \`update-readme\`: Update README file
- \`run-tests\`: Run test suite
- \`notify\`: Send notification
- \`custom-command\`: Run custom shell command
`;

    const examplePath = path.join(this.configPath, 'example-hook.md');
    fs.writeFileSync(examplePath, exampleHook);
  }
}
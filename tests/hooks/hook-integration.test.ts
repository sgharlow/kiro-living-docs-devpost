import { HookConfigManager, HookConfiguration } from '../../src/hooks/hook-config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Hook Integration Tests', () => {
  let tempDir: string;
  let configManager: HookConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-integration-test-'));
    configManager = new HookConfigManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Hook Configuration Integration', () => {
    it('should create and load complete hook configuration', async () => {
      // Initialize hooks with default configuration
      configManager.initializeHooks();
      
      // Verify hooks directory was created
      expect(configManager.hasHookConfiguration()).toBe(true);
      
      // Load the configuration
      const config = configManager.loadConfiguration();
      
      // Verify all required hooks are present
      expect(config.enabled).toBe(true);
      expect(config.hooks).toBeDefined();
      
      // Check for file save hook
      const fileSaveHooks = configManager.getHooksByEvent(config, 'file-save');
      expect(fileSaveHooks.length).toBeGreaterThan(0);
      expect(fileSaveHooks[0].name).toBe('Auto Documentation on Save');
      
      // Check for commit hook
      const commitHooks = configManager.getHooksByEvent(config, 'commit');
      expect(commitHooks.length).toBeGreaterThan(0);
      expect(commitHooks[0].name).toBe('Full Documentation on Commit');
      
      // Check for file focus hook
      const focusHooks = configManager.getHooksByEvent(config, 'file-focus');
      expect(focusHooks.length).toBeGreaterThan(0);
      expect(focusHooks[0].name).toBe('Contextual Documentation on File Focus');
      
      // Check for pull request hook (disabled by default, so check the hook exists but may not be active)
      const prHook = configManager.getHook(config, 'pr-docs-diff');
      expect(prHook).toBeDefined();
      expect(prHook?.name).toBe('Documentation Diff for Pull Requests');
      expect(prHook?.enabled).toBe(false); // Disabled by default
      
      // Check for branch switch hook
      const branchHooks = configManager.getHooksByEvent(config, 'branch-switch');
      expect(branchHooks.length).toBeGreaterThan(0);
      expect(branchHooks[0].name).toBe('Update Documentation Context on Branch Switch');
    });

    it('should handle custom hook configurations', async () => {
      // Create custom hook configuration
      const customConfig: HookConfiguration = {
        enabled: true,
        global: {
          outputPath: 'custom-docs',
          notificationsEnabled: true,
          maxConcurrentHooks: 2,
          logLevel: 'debug',
          errorHandling: 'retry',
        },
        hooks: {
          'custom-save-hook': {
            name: 'Custom Save Hook',
            description: 'Custom documentation on save',
            trigger: {
              event: 'file-save',
              fileTypes: ['.ts', '.js'],
              patterns: ['src/**/*'],
              excludePatterns: ['**/*.test.*'],
            },
            actions: [
              {
                type: 'generate-docs',
                config: {
                  scope: 'file',
                  format: 'markdown',
                  includePrivate: false,
                },
              },
              {
                type: 'notify',
                config: {
                  message: 'Documentation updated for {fileName}',
                },
              },
            ],
            enabled: true,
            debounceMs: 2000,
            priority: 1,
          },
        },
      };

      // Save custom configuration
      configManager.saveConfiguration(customConfig);
      
      // Load and verify
      const loadedConfig = configManager.loadConfiguration();
      
      expect(loadedConfig.global?.outputPath).toBe('custom-docs');
      expect(loadedConfig.global?.logLevel).toBe('debug');
      expect(loadedConfig.global?.errorHandling).toBe('retry');
      
      const customHook = configManager.getHook(loadedConfig, 'custom-save-hook');
      expect(customHook).toBeDefined();
      expect(customHook?.name).toBe('Custom Save Hook');
      expect(customHook?.debounceMs).toBe(2000);
      expect(customHook?.actions).toHaveLength(2);
      expect(customHook?.actions[0].type).toBe('generate-docs');
      expect(customHook?.actions[1].type).toBe('notify');
    });

    it('should validate hook configurations and provide warnings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create invalid configuration
      const invalidConfig: HookConfiguration = {
        enabled: true,
        global: {
          maxConcurrentHooks: 15, // Invalid: too high
          logLevel: 'invalid' as any, // Invalid log level
        },
        hooks: {
          'invalid-hook': {
            name: 'Invalid Hook',
            description: 'Hook with invalid settings',
            trigger: {
              event: 'invalid-event' as any, // Invalid event type
            },
            actions: [
              {
                type: 'invalid-action' as any, // Invalid action type
                config: {},
              },
            ],
            enabled: true,
            debounceMs: 50000, // Invalid: too high
          },
        },
      };

      configManager.saveConfiguration(invalidConfig);
      configManager.loadConfiguration();

      // Verify warnings were issued
      expect(consoleSpy).toHaveBeenCalledWith('maxConcurrentHooks should be between 1 and 10');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid log level: invalid');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook has invalid trigger event: invalid-event');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook action 0 has invalid type: invalid-action');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook debounce time should be between 100ms and 30s');

      consoleSpy.mockRestore();
    });

    it('should merge multiple configuration files correctly', () => {
      const hooksDir = path.join(tempDir, '.kiro', 'hooks');
      fs.mkdirSync(hooksDir, { recursive: true });

      // Create base configuration
      const baseConfig = {
        enabled: true,
        global: {
          outputPath: 'docs',
          logLevel: 'info',
        },
        hooks: {
          'base-hook': {
            name: 'Base Hook',
            description: 'Base hook configuration',
            trigger: {
              event: 'file-save',
            },
            actions: [
              {
                type: 'generate-docs',
                config: {},
              },
            ],
            enabled: true,
          },
        },
      };

      // Create additional configuration
      const additionalConfig = {
        global: {
          notificationsEnabled: true,
          maxConcurrentHooks: 3,
        },
        hooks: {
          'additional-hook': {
            name: 'Additional Hook',
            description: 'Additional hook configuration',
            trigger: {
              event: 'commit',
            },
            actions: [
              {
                type: 'update-readme',
                config: {},
              },
            ],
            enabled: true,
          },
        },
      };

      // Write configuration files
      fs.writeFileSync(
        path.join(hooksDir, 'base.json'),
        JSON.stringify(baseConfig, null, 2)
      );
      fs.writeFileSync(
        path.join(hooksDir, 'additional.json'),
        JSON.stringify(additionalConfig, null, 2)
      );

      // Load merged configuration
      const mergedConfig = configManager.loadConfiguration();

      // Verify merge results
      expect(mergedConfig.enabled).toBe(true);
      expect(mergedConfig.global?.outputPath).toBe('docs');
      expect(mergedConfig.global?.logLevel).toBe('info');
      expect(mergedConfig.global?.notificationsEnabled).toBe(true);
      expect(mergedConfig.global?.maxConcurrentHooks).toBe(3);

      // Verify both hooks are present
      expect(mergedConfig.hooks['base-hook']).toBeDefined();
      expect(mergedConfig.hooks['additional-hook']).toBeDefined();
      expect(mergedConfig.hooks['base-hook'].name).toBe('Base Hook');
      expect(mergedConfig.hooks['additional-hook'].name).toBe('Additional Hook');
    });

    it('should handle hook priority sorting correctly', () => {
      const config: HookConfiguration = {
        enabled: true,
        hooks: {
          'low-priority': {
            name: 'Low Priority Hook',
            description: 'Low priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 10,
          },
          'high-priority': {
            name: 'High Priority Hook',
            description: 'High priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 1,
          },
          'medium-priority': {
            name: 'Medium Priority Hook',
            description: 'Medium priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 5,
          },
          'no-priority': {
            name: 'No Priority Hook',
            description: 'Hook without priority',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            // No priority specified (defaults to 0)
          },
        },
      };

      const hooks = configManager.getHooksByEvent(config, 'file-save');

      expect(hooks).toHaveLength(4);
      expect(hooks[0].name).toBe('No Priority Hook'); // priority 0 (default)
      expect(hooks[1].name).toBe('High Priority Hook'); // priority 1
      expect(hooks[2].name).toBe('Medium Priority Hook'); // priority 5
      expect(hooks[3].name).toBe('Low Priority Hook'); // priority 10
    });

    it('should filter disabled hooks correctly', () => {
      const config: HookConfiguration = {
        enabled: true,
        hooks: {
          'enabled-hook': {
            name: 'Enabled Hook',
            description: 'This hook is enabled',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
          },
          'disabled-hook': {
            name: 'Disabled Hook',
            description: 'This hook is disabled',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: false,
          },
        },
      };

      const hooks = configManager.getHooksByEvent(config, 'file-save');

      expect(hooks).toHaveLength(1);
      expect(hooks[0].name).toBe('Enabled Hook');
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    it('should handle missing hooks directory gracefully', () => {
      // Don't create hooks directory
      const config = configManager.loadConfiguration();
      
      // Should return default configuration
      expect(config.enabled).toBe(true);
      expect(config.hooks).toEqual({});
      expect(config.global?.outputPath).toBe('docs');
    });

    it('should handle corrupted configuration files gracefully', () => {
      const hooksDir = path.join(tempDir, '.kiro', 'hooks');
      fs.mkdirSync(hooksDir, { recursive: true });

      // Create corrupted JSON file
      fs.writeFileSync(path.join(hooksDir, 'corrupted.json'), '{ invalid json }');
      
      // Create corrupted YAML file
      fs.writeFileSync(path.join(hooksDir, 'corrupted.yaml'), 'invalid: yaml: content: [');

      // Should still load default configuration without crashing
      const config = configManager.loadConfiguration();
      expect(config.enabled).toBe(true);
    });

    it('should provide meaningful error messages for invalid configurations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidConfig: HookConfiguration = {
        enabled: true,
        hooks: {
          'incomplete-hook': {
            name: '', // Missing name
            description: 'Hook with missing fields',
            trigger: {} as any, // Missing event
            actions: [], // Empty actions
            enabled: true,
          },
        },
      };

      configManager.saveConfiguration(invalidConfig);
      configManager.loadConfiguration();

      // Should warn about missing required fields
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hook incomplete-hook is missing required fields')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Hook Event Types and Actions', () => {
    it('should support all required hook event types', () => {
      const config = configManager.createDefaultHooks();
      
      // Verify all required event types are supported
      const supportedEvents = ['file-save', 'commit', 'pull-request', 'file-focus', 'branch-switch'];
      
      supportedEvents.forEach(eventType => {
        const hooks = configManager.getHooksByEvent(config, eventType);
        expect(hooks.length).toBeGreaterThanOrEqual(0); // At least should not error
      });
      
      // Verify specific events have hooks
      expect(configManager.getHooksByEvent(config, 'file-save').length).toBeGreaterThan(0);
      expect(configManager.getHooksByEvent(config, 'commit').length).toBeGreaterThan(0);
      expect(configManager.getHooksByEvent(config, 'file-focus').length).toBeGreaterThan(0);
    });

    it('should support all required hook action types', () => {
      const config = configManager.createDefaultHooks();
      
      const allActions: string[] = [];
      Object.values(config.hooks).forEach(hook => {
        hook.actions.forEach(action => {
          if (!allActions.includes(action.type)) {
            allActions.push(action.type);
          }
        });
      });
      
      // Verify required action types are present
      expect(allActions).toContain('generate-docs');
      expect(allActions).toContain('update-readme');
    });

    it('should handle hook conditions correctly', () => {
      const config: HookConfiguration = {
        enabled: true,
        hooks: {
          'conditional-hook': {
            name: 'Conditional Hook',
            description: 'Hook with conditions',
            trigger: {
              event: 'file-save',
              fileTypes: ['.ts', '.js'],
              patterns: ['src/**/*'],
              excludePatterns: ['**/*.test.*', 'node_modules/**'],
            },
            actions: [
              {
                type: 'generate-docs',
                config: {
                  scope: 'file',
                },
              },
            ],
            conditions: [
              {
                type: 'file-exists',
                config: {
                  path: 'package.json',
                },
              },
            ],
            enabled: true,
          },
        },
      };

      const hook = configManager.getHook(config, 'conditional-hook');
      expect(hook).toBeDefined();
      expect(hook?.trigger.fileTypes).toEqual(['.ts', '.js']);
      expect(hook?.trigger.patterns).toEqual(['src/**/*']);
      expect(hook?.trigger.excludePatterns).toEqual(['**/*.test.*', 'node_modules/**']);
      expect(hook?.conditions).toHaveLength(1);
      expect(hook?.conditions?.[0].type).toBe('file-exists');
    });
  });
});
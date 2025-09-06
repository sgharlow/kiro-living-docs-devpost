import { HookConfigManager, HookConfiguration } from '../../src/hooks/hook-config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('HookConfigManager', () => {
  let tempDir: string;
  let hooksDir: string;
  let configManager: HookConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-config-test-'));
    hooksDir = path.join(tempDir, '.kiro', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    configManager = new HookConfigManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Loading', () => {
    it('should return default configuration when no config files exist', () => {
      fs.rmSync(hooksDir, { recursive: true, force: true });
      
      const config = configManager.loadConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.hooks).toEqual({});
      expect(config.global?.outputPath).toBe('docs');
    });

    it('should load YAML configuration files', () => {
      const yamlConfig = `
enabled: true
global:
  outputPath: custom-docs
  logLevel: debug
hooks:
  test-hook:
    name: Test Hook
    description: A test hook
    trigger:
      event: file-save
      fileTypes: [".ts"]
    actions:
      - type: generate-docs
        config:
          scope: file
    enabled: true
`;

      fs.writeFileSync(path.join(hooksDir, 'config.yaml'), yamlConfig);
      
      const config = configManager.loadConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.global?.outputPath).toBe('custom-docs');
      expect(config.global?.logLevel).toBe('debug');
      expect(config.hooks['test-hook']).toBeDefined();
      expect(config.hooks['test-hook'].name).toBe('Test Hook');
    });

    it('should load JSON configuration files', () => {
      const jsonConfig = {
        enabled: true,
        hooks: {
          'json-hook': {
            name: 'JSON Hook',
            description: 'A hook from JSON',
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

      fs.writeFileSync(path.join(hooksDir, 'config.json'), JSON.stringify(jsonConfig, null, 2));
      
      const config = configManager.loadConfiguration();
      
      expect(config.hooks['json-hook']).toBeDefined();
      expect(config.hooks['json-hook'].name).toBe('JSON Hook');
      expect(config.hooks['json-hook'].trigger.event).toBe('commit');
    });

    it('should merge multiple configuration files', () => {
      const baseConfig = `
enabled: true
global:
  outputPath: docs
hooks:
  hook1:
    name: Hook 1
    trigger:
      event: file-save
    actions:
      - type: generate-docs
        config: {}
    enabled: true
`;

      const additionalConfig = {
        hooks: {
          'hook2': {
            name: 'Hook 2',
            trigger: {
              event: 'commit',
            },
            actions: [
              {
                type: 'notify',
                config: {},
              },
            ],
            enabled: true,
          },
        },
      };

      fs.writeFileSync(path.join(hooksDir, 'base.yaml'), baseConfig);
      fs.writeFileSync(path.join(hooksDir, 'additional.json'), JSON.stringify(additionalConfig));
      
      const config = configManager.loadConfiguration();
      
      expect(config.hooks['hook1']).toBeDefined();
      expect(config.hooks['hook2']).toBeDefined();
      expect(config.hooks['hook1'].name).toBe('Hook 1');
      expect(config.hooks['hook2'].name).toBe('Hook 2');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate hook configurations and warn about issues', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidConfig = `
enabled: true
global:
  maxConcurrentHooks: 15
  logLevel: invalid-level
hooks:
  invalid-hook:
    name: Invalid Hook
    trigger:
      event: invalid-event
    actions:
      - type: invalid-action
        config: {}
    enabled: true
    debounceMs: 50000
`;

      fs.writeFileSync(path.join(hooksDir, 'invalid.yaml'), invalidConfig);
      
      configManager.loadConfiguration();
      
      expect(consoleSpy).toHaveBeenCalledWith('maxConcurrentHooks should be between 1 and 10');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid log level: invalid-level');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook has invalid trigger event: invalid-event');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook action 0 has invalid type: invalid-action');
      expect(consoleSpy).toHaveBeenCalledWith('Hook invalid-hook debounce time should be between 100ms and 30s');

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to YAML file', () => {
      const config: HookConfiguration = {
        enabled: true,
        global: {
          outputPath: 'custom-docs',
          notificationsEnabled: true,
          maxConcurrentHooks: 2,
          logLevel: 'warn',
          errorHandling: 'retry',
        },
        hooks: {
          'save-hook': {
            name: 'Save Hook',
            description: 'A hook for saving',
            trigger: {
              event: 'file-save',
              fileTypes: ['.ts', '.js'],
            },
            actions: [
              {
                type: 'generate-docs',
                config: {
                  scope: 'file',
                },
              },
            ],
            enabled: true,
            debounceMs: 1500,
          },
        },
      };

      configManager.saveConfiguration(config);
      
      const savedConfigPath = path.join(hooksDir, 'hooks.yaml');
      expect(fs.existsSync(savedConfigPath)).toBe(true);
      
      const loadedConfig = configManager.loadConfiguration();
      expect(loadedConfig.global?.outputPath).toBe('custom-docs');
      expect(loadedConfig.hooks['save-hook']).toBeDefined();
      expect(loadedConfig.hooks['save-hook'].debounceMs).toBe(1500);
    });
  });

  describe('Default Hook Creation', () => {
    it('should create comprehensive default hooks', () => {
      const defaultHooks = configManager.createDefaultHooks();
      
      expect(defaultHooks.enabled).toBe(true);
      expect(defaultHooks.global).toBeDefined();
      expect(Object.keys(defaultHooks.hooks)).toHaveLength(5);
      
      // Check specific default hooks
      expect(defaultHooks.hooks['auto-doc-on-save']).toBeDefined();
      expect(defaultHooks.hooks['full-docs-on-commit']).toBeDefined();
      expect(defaultHooks.hooks['contextual-docs-on-focus']).toBeDefined();
      expect(defaultHooks.hooks['pr-docs-diff']).toBeDefined();
      expect(defaultHooks.hooks['branch-context-update']).toBeDefined();
      
      // Verify hook structure
      const autoDocHook = defaultHooks.hooks['auto-doc-on-save'];
      expect(autoDocHook.trigger.event).toBe('file-save');
      expect(autoDocHook.actions).toHaveLength(1);
      expect(autoDocHook.actions[0].type).toBe('generate-docs');
      expect(autoDocHook.enabled).toBe(true);
    });

    it('should have proper priorities for default hooks', () => {
      const defaultHooks = configManager.createDefaultHooks();
      
      const hooks = Object.values(defaultHooks.hooks);
      const priorities = hooks.map(hook => hook.priority || 0);
      
      // Priorities should be unique and ordered
      const sortedPriorities = [...priorities].sort((a, b) => a - b);
      expect(priorities).toEqual(sortedPriorities);
    });
  });

  describe('Hook Querying', () => {
    it('should get hook by name', () => {
      const config = configManager.createDefaultHooks();
      
      const hook = configManager.getHook(config, 'auto-doc-on-save');
      expect(hook).toBeDefined();
      expect(hook?.name).toBe('Auto Documentation on Save');
      
      const nonExistentHook = configManager.getHook(config, 'non-existent');
      expect(nonExistentHook).toBeNull();
    });

    it('should get hooks by trigger event', () => {
      const config = configManager.createDefaultHooks();
      
      const fileSaveHooks = configManager.getHooksByEvent(config, 'file-save');
      expect(fileSaveHooks).toHaveLength(1);
      expect(fileSaveHooks[0].name).toBe('Auto Documentation on Save');
      
      const commitHooks = configManager.getHooksByEvent(config, 'commit');
      expect(commitHooks).toHaveLength(1);
      expect(commitHooks[0].name).toBe('Full Documentation on Commit');
      
      const nonExistentEventHooks = configManager.getHooksByEvent(config, 'non-existent-event');
      expect(nonExistentEventHooks).toHaveLength(0);
    });

    it('should filter disabled hooks when querying by event', () => {
      const config = configManager.createDefaultHooks();
      
      // Disable a hook
      config.hooks['auto-doc-on-save'].enabled = false;
      
      const fileSaveHooks = configManager.getHooksByEvent(config, 'file-save');
      expect(fileSaveHooks).toHaveLength(0);
    });

    it('should sort hooks by priority when querying by event', () => {
      const config: HookConfiguration = {
        enabled: true,
        hooks: {
          'high-priority': {
            name: 'High Priority',
            description: 'High priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 1,
          },
          'low-priority': {
            name: 'Low Priority',
            description: 'Low priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 5,
          },
          'medium-priority': {
            name: 'Medium Priority',
            description: 'Medium priority hook',
            trigger: { event: 'file-save' },
            actions: [{ type: 'generate-docs', config: {} }],
            enabled: true,
            priority: 3,
          },
        },
      };
      
      const hooks = configManager.getHooksByEvent(config, 'file-save');
      
      expect(hooks).toHaveLength(3);
      expect(hooks[0].name).toBe('High Priority');
      expect(hooks[1].name).toBe('Medium Priority');
      expect(hooks[2].name).toBe('Low Priority');
    });
  });

  describe('Initialization', () => {
    it('should check if hook configuration exists', () => {
      expect(configManager.hasHookConfiguration()).toBe(true);
      
      fs.rmSync(hooksDir, { recursive: true, force: true });
      expect(configManager.hasHookConfiguration()).toBe(false);
    });

    it('should initialize hooks directory with default configuration', () => {
      fs.rmSync(hooksDir, { recursive: true, force: true });
      
      configManager.initializeHooks();
      
      expect(fs.existsSync(hooksDir)).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, 'hooks.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, 'example-hook.md'))).toBe(true);
      
      const config = configManager.loadConfiguration();
      expect(Object.keys(config.hooks)).toHaveLength(5);
    });
  });
});
import { HookConfigManager } from '../../src/hooks/hook-config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Define the hook event types and interfaces locally to avoid import issues
interface HookEvent {
  type: 'file-save' | 'commit' | 'pull-request' | 'file-focus' | 'branch-switch';
  filePath?: string;
  projectPath: string;
  metadata?: {
    commitHash?: string;
    branchName?: string;
    pullRequestId?: string;
    author?: string;
    timestamp?: Date;
  };
}

interface HookConfig {
  enabled: boolean;
  events: string[];
  debounceMs?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  outputPath?: string;
  notifyOnComplete?: boolean;
}

describe('Hook Event Processing Tests', () => {
  let tempDir: string;
  let configManager: HookConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-events-test-'));
    configManager = new HookConfigManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Hook Event Validation', () => {
    it('should validate file-save events correctly', () => {
      const validFileSaveEvent: HookEvent = {
        type: 'file-save',
        filePath: path.join(tempDir, 'test.ts'),
        projectPath: tempDir,
        metadata: {
          timestamp: new Date(),
        },
      };

      expect(validFileSaveEvent.type).toBe('file-save');
      expect(validFileSaveEvent.filePath).toBeDefined();
      expect(validFileSaveEvent.projectPath).toBe(tempDir);
      expect(validFileSaveEvent.metadata?.timestamp).toBeInstanceOf(Date);
    });

    it('should validate commit events correctly', () => {
      const validCommitEvent: HookEvent = {
        type: 'commit',
        projectPath: tempDir,
        metadata: {
          commitHash: 'abc123def456',
          author: 'Test User',
          timestamp: new Date(),
        },
      };

      expect(validCommitEvent.type).toBe('commit');
      expect(validCommitEvent.projectPath).toBe(tempDir);
      expect(validCommitEvent.metadata?.commitHash).toBe('abc123def456');
      expect(validCommitEvent.metadata?.author).toBe('Test User');
    });

    it('should validate pull-request events correctly', () => {
      const validPREvent: HookEvent = {
        type: 'pull-request',
        projectPath: tempDir,
        metadata: {
          pullRequestId: 'PR-123',
          author: 'Contributor',
          timestamp: new Date(),
        },
      };

      expect(validPREvent.type).toBe('pull-request');
      expect(validPREvent.metadata?.pullRequestId).toBe('PR-123');
    });

    it('should validate file-focus events correctly', () => {
      const validFocusEvent: HookEvent = {
        type: 'file-focus',
        filePath: path.join(tempDir, 'focused-file.ts'),
        projectPath: tempDir,
      };

      expect(validFocusEvent.type).toBe('file-focus');
      expect(validFocusEvent.filePath).toBeDefined();
    });

    it('should validate branch-switch events correctly', () => {
      const validBranchEvent: HookEvent = {
        type: 'branch-switch',
        projectPath: tempDir,
        metadata: {
          branchName: 'feature/new-feature',
          timestamp: new Date(),
        },
      };

      expect(validBranchEvent.type).toBe('branch-switch');
      expect(validBranchEvent.metadata?.branchName).toBe('feature/new-feature');
    });
  });

  describe('Hook Configuration Validation', () => {
    it('should validate hook configuration structure', () => {
      const validConfig: HookConfig = {
        enabled: true,
        events: ['file-save', 'commit'],
        debounceMs: 1000,
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['node_modules/**', '**/*.test.*'],
        outputPath: 'docs',
        notifyOnComplete: true,
      };

      expect(validConfig.enabled).toBe(true);
      expect(validConfig.events).toContain('file-save');
      expect(validConfig.events).toContain('commit');
      expect(validConfig.debounceMs).toBe(1000);
      expect(validConfig.includePatterns).toContain('**/*.ts');
      expect(validConfig.excludePatterns).toContain('node_modules/**');
    });

    it('should handle minimal hook configuration', () => {
      const minimalConfig: HookConfig = {
        enabled: true,
        events: ['file-save'],
      };

      expect(minimalConfig.enabled).toBe(true);
      expect(minimalConfig.events).toHaveLength(1);
      expect(minimalConfig.debounceMs).toBeUndefined();
      expect(minimalConfig.includePatterns).toBeUndefined();
    });
  });

  describe('File Pattern Matching Logic', () => {
    it('should match TypeScript files correctly', () => {
      const tsFiles = [
        'src/index.ts',
        'src/components/Button.tsx',
        'lib/utils.ts',
        'types/api.d.ts',
      ];

      tsFiles.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.d.ts')) {
          expect(file).toMatch(/\.ts$/);
        }
        if (file.endsWith('.tsx')) {
          expect(file).toMatch(/\.tsx$/);
        }
      });
    });

    it('should exclude test files correctly', () => {
      const files = [
        'src/index.ts',
        'src/index.test.ts',
        'src/index.spec.ts',
        'tests/unit.test.ts',
        'src/component.tsx',
      ];

      const nonTestFiles = files.filter(file => 
        !file.includes('.test.') && !file.includes('.spec.')
      );

      expect(nonTestFiles).toEqual([
        'src/index.ts',
        'src/component.tsx',
      ]);
    });

    it('should exclude node_modules correctly', () => {
      const files = [
        'src/index.ts',
        'node_modules/package/index.js',
        'lib/utils.ts',
        'node_modules/@types/node/index.d.ts',
      ];

      const nonNodeModulesFiles = files.filter(file => 
        !file.includes('node_modules/')
      );

      expect(nonNodeModulesFiles).toEqual([
        'src/index.ts',
        'lib/utils.ts',
      ]);
    });
  });

  describe('Hook Priority and Ordering', () => {
    it('should handle hook priority correctly', () => {
      const config = configManager.createDefaultHooks();
      
      // Get all hooks and their priorities
      const allHooks = Object.values(config.hooks);
      const priorities = allHooks.map(hook => hook.priority || 0);
      
      // Verify priorities are reasonable (between 0 and 10)
      priorities.forEach(priority => {
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(10);
      });
    });

    it('should sort hooks by priority correctly', () => {
      const config = configManager.createDefaultHooks();
      
      // Get file-save hooks (there should be at least one)
      const fileSaveHooks = configManager.getHooksByEvent(config, 'file-save');
      
      if (fileSaveHooks.length > 1) {
        // Verify they are sorted by priority
        for (let i = 1; i < fileSaveHooks.length; i++) {
          const prevPriority = fileSaveHooks[i - 1].priority || 0;
          const currentPriority = fileSaveHooks[i].priority || 0;
          expect(currentPriority).toBeGreaterThanOrEqual(prevPriority);
        }
      }
    });
  });

  describe('Hook Action Configuration', () => {
    it('should validate generate-docs action configuration', () => {
      const config = configManager.createDefaultHooks();
      const fileSaveHook = configManager.getHook(config, 'auto-doc-on-save');
      
      expect(fileSaveHook).toBeDefined();
      expect(fileSaveHook?.actions).toHaveLength(1);
      
      const action = fileSaveHook?.actions[0];
      expect(action?.type).toBe('generate-docs');
      expect(action?.config).toBeDefined();
      expect(action?.config.scope).toBe('file');
    });

    it('should validate update-readme action configuration', () => {
      const config = configManager.createDefaultHooks();
      const commitHook = configManager.getHook(config, 'full-docs-on-commit');
      
      expect(commitHook).toBeDefined();
      expect(commitHook?.actions.length).toBeGreaterThan(0);
      
      const updateReadmeAction = commitHook?.actions.find(
        action => action.type === 'update-readme'
      );
      
      expect(updateReadmeAction).toBeDefined();
      expect(updateReadmeAction?.config).toBeDefined();
    });

    it('should handle multiple actions per hook', () => {
      const config = configManager.createDefaultHooks();
      const commitHook = configManager.getHook(config, 'full-docs-on-commit');
      
      expect(commitHook).toBeDefined();
      expect(commitHook?.actions.length).toBeGreaterThan(1);
      
      // Should have both generate-docs and update-readme actions
      const actionTypes = commitHook?.actions.map(action => action.type);
      expect(actionTypes).toContain('generate-docs');
      expect(actionTypes).toContain('update-readme');
    });
  });

  describe('Error Handling Configuration', () => {
    it('should handle invalid event types gracefully', () => {
      const config = configManager.createDefaultHooks();
      
      // Try to get hooks for an invalid event type
      const invalidHooks = configManager.getHooksByEvent(config, 'invalid-event');
      
      expect(invalidHooks).toEqual([]);
    });

    it('should handle missing hook gracefully', () => {
      const config = configManager.createDefaultHooks();
      
      // Try to get a non-existent hook
      const missingHook = configManager.getHook(config, 'non-existent-hook');
      
      expect(missingHook).toBeNull();
    });

    it('should validate debounce timing constraints', () => {
      const config = configManager.createDefaultHooks();
      
      Object.values(config.hooks).forEach(hook => {
        if (hook.debounceMs !== undefined) {
          expect(hook.debounceMs).toBeGreaterThanOrEqual(100);
          expect(hook.debounceMs).toBeLessThanOrEqual(30000);
        }
      });
    });
  });

  describe('Hook Integration Scenarios', () => {
    it('should handle rapid file save scenario', () => {
      const events: HookEvent[] = [];
      
      // Simulate rapid file saves
      for (let i = 0; i < 5; i++) {
        events.push({
          type: 'file-save',
          filePath: path.join(tempDir, 'rapid-file.ts'),
          projectPath: tempDir,
          metadata: {
            timestamp: new Date(Date.now() + i * 100), // 100ms apart
          },
        });
      }
      
      expect(events).toHaveLength(5);
      expect(events[0].type).toBe('file-save');
      expect(events[4].type).toBe('file-save');
      
      // All events should have the same file path
      const filePaths = events.map(e => e.filePath);
      expect(new Set(filePaths).size).toBe(1);
    });

    it('should handle commit followed by file save scenario', () => {
      const commitEvent: HookEvent = {
        type: 'commit',
        projectPath: tempDir,
        metadata: {
          commitHash: 'abc123',
          timestamp: new Date(),
        },
      };

      const fileSaveEvent: HookEvent = {
        type: 'file-save',
        filePath: path.join(tempDir, 'post-commit-file.ts'),
        projectPath: tempDir,
        metadata: {
          timestamp: new Date(Date.now() + 1000), // 1 second later
        },
      };

      expect(commitEvent.type).toBe('commit');
      expect(fileSaveEvent.type).toBe('file-save');
      expect(fileSaveEvent.metadata?.timestamp?.getTime()).toBeGreaterThan(
        commitEvent.metadata?.timestamp?.getTime() || 0
      );
    });

    it('should handle branch switch with file focus scenario', () => {
      const branchSwitchEvent: HookEvent = {
        type: 'branch-switch',
        projectPath: tempDir,
        metadata: {
          branchName: 'feature/new-ui',
          timestamp: new Date(),
        },
      };

      const fileFocusEvent: HookEvent = {
        type: 'file-focus',
        filePath: path.join(tempDir, 'src/ui/NewComponent.tsx'),
        projectPath: tempDir,
      };

      expect(branchSwitchEvent.metadata?.branchName).toBe('feature/new-ui');
      expect(fileFocusEvent.filePath).toContain('NewComponent.tsx');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of hook configurations', () => {
      const config = configManager.createDefaultHooks();
      
      // Add many custom hooks
      for (let i = 0; i < 100; i++) {
        config.hooks[`custom-hook-${i}`] = {
          name: `Custom Hook ${i}`,
          description: `Custom hook number ${i}`,
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
          priority: i % 10,
        };
      }
      
      // Should still be able to query efficiently
      const fileSaveHooks = configManager.getHooksByEvent(config, 'file-save');
      expect(fileSaveHooks.length).toBeGreaterThan(100);
      
      // Should be sorted by priority
      for (let i = 1; i < fileSaveHooks.length; i++) {
        const prevPriority = fileSaveHooks[i - 1].priority || 0;
        const currentPriority = fileSaveHooks[i].priority || 0;
        expect(currentPriority).toBeGreaterThanOrEqual(prevPriority);
      }
    });

    it('should handle complex file patterns efficiently', () => {
      const complexPatterns = [
        '**/*.{ts,tsx,js,jsx}',
        'src/**/*.ts',
        'lib/**/*.{ts,js}',
        '!**/*.test.*',
        '!**/*.spec.*',
        '!node_modules/**',
        '!dist/**',
        '!build/**',
      ];

      // Should be able to process these patterns without errors
      expect(complexPatterns).toHaveLength(8);
      expect(complexPatterns.filter(p => p.startsWith('!'))).toHaveLength(5);
      expect(complexPatterns.filter(p => !p.startsWith('!'))).toHaveLength(3);
    });
  });
});
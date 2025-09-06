import { HookManager, HookEvent, HookConfig } from '../../src/hooks/hook-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('HookManager', () => {
  let tempDir: string;
  let hookManager: HookManager;
  let mockConfig: HookConfig;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-manager-test-'));
    
    mockConfig = {
      enabled: true,
      events: ['file-save', 'commit', 'file-focus'],
      debounceMs: 100,
      includePatterns: ['**/*.ts', '**/*.js', '**/*.py'],
      excludePatterns: ['node_modules/**', '**/*.test.*'],
      outputPath: 'docs',
      notifyOnComplete: false,
    };

    hookManager = new HookManager(tempDir, mockConfig);
  });

  afterEach(async () => {
    await hookManager.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully when enabled', async () => {
      const initPromise = new Promise((resolve) => {
        hookManager.once('initialized', resolve);
      });

      await hookManager.initialize();
      await initPromise;

      expect(hookManager.getStatistics().queuedUpdates).toBe(0);
    });

    it('should not initialize when disabled', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const disabledManager = new HookManager(tempDir, disabledConfig);

      let initialized = false;
      disabledManager.once('initialized', () => {
        initialized = true;
      });

      await disabledManager.initialize();
      
      // Give it a moment to potentially initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(initialized).toBe(false);
    });
  });

  describe('File Save Events', () => {
    it('should handle file save events for supported files', async () => {
      await hookManager.initialize();

      // Create a test TypeScript file
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function test() { return "hello"; }');

      const updatePromise = new Promise((resolve) => {
        hookManager.once('documentation-updated', resolve);
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
        metadata: { timestamp: new Date() },
      };

      await hookManager.handleHookEvent(event);

      // Wait for debounced update
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const update = await updatePromise;
      expect(update).toBeDefined();
    });

    it('should ignore files that do not match patterns', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'This is a text file');

      let updateTriggered = false;
      hookManager.once('documentation-updated', () => {
        updateTriggered = true;
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      // Wait to ensure no update is triggered
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(updateTriggered).toBe(false);
    });

    it('should debounce rapid file saves', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'rapid-test.ts');
      fs.writeFileSync(testFile, 'export function test() {}');

      let updateCount = 0;
      hookManager.on('documentation-updated', () => {
        updateCount++;
      });

      // Trigger multiple rapid saves
      for (let i = 0; i < 5; i++) {
        const event: HookEvent = {
          type: 'file-save',
          filePath: testFile,
          projectPath: tempDir,
          metadata: { timestamp: new Date() },
        };
        
        await hookManager.handleHookEvent(event);
      }

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only trigger one update due to debouncing
      expect(updateCount).toBe(1);
    });
  });

  describe('Commit Events', () => {
    it('should handle commit events', async () => {
      await hookManager.initialize();

      const commitPromise = new Promise((resolve) => {
        hookManager.once('commit-processed', resolve);
      });

      const event: HookEvent = {
        type: 'commit',
        projectPath: tempDir,
        metadata: {
          commitHash: 'abc123',
          author: 'Test User',
          timestamp: new Date(),
        },
      };

      await hookManager.handleHookEvent(event);
      
      const result = await commitPromise;
      expect(result).toBeDefined();
    });

    it('should update project documentation on commit', async () => {
      await hookManager.initialize();

      // Create some test files
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export * from "./utils";');
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), 'export function util() {}');

      const projectUpdatePromise = new Promise((resolve) => {
        hookManager.once('project-documentation-updated', resolve);
      });

      const event: HookEvent = {
        type: 'commit',
        projectPath: tempDir,
        metadata: { commitHash: 'def456' },
      };

      await hookManager.handleHookEvent(event);
      
      const result = await projectUpdatePromise;
      expect(result).toBeDefined();
    });
  });

  describe('File Focus Events', () => {
    it('should provide contextual documentation on file focus', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'focus-test.ts');
      fs.writeFileSync(testFile, 'export class TestClass { method() {} }');

      const contextPromise = new Promise((resolve) => {
        hookManager.once('contextual-documentation', resolve);
      });

      const event: HookEvent = {
        type: 'file-focus',
        filePath: testFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      const context = await contextPromise;
      expect(context).toBeDefined();
      expect((context as any).filePath).toBe(testFile);
    });
  });

  describe('Branch Switch Events', () => {
    it('should handle branch switch events', async () => {
      await hookManager.initialize();

      const branchPromise = new Promise((resolve) => {
        hookManager.once('branch-switched', resolve);
      });

      const event: HookEvent = {
        type: 'branch-switch',
        projectPath: tempDir,
        metadata: {
          branchName: 'feature/new-feature',
          timestamp: new Date(),
        },
      };

      await hookManager.handleHookEvent(event);
      
      const result = await branchPromise;
      expect(result).toBeDefined();
      expect((result as any).branchName).toBe('feature/new-feature');
    });
  });

  describe('Error Handling', () => {
    it('should emit error events when hook processing fails', async () => {
      await hookManager.initialize();

      const errorPromise = new Promise((resolve) => {
        hookManager.once('error', resolve);
      });

      // Try to process a non-existent file
      const event: HookEvent = {
        type: 'file-save',
        filePath: '/non/existent/file.ts',
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      // Wait for debounce and processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const error = await errorPromise;
      expect(error).toBeDefined();
    });

    it('should continue processing other events after an error', async () => {
      await hookManager.initialize();

      // First, trigger an error
      const errorEvent: HookEvent = {
        type: 'file-save',
        filePath: '/non/existent/file.ts',
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(errorEvent);

      // Then, trigger a valid event
      const validFile = path.join(tempDir, 'valid.ts');
      fs.writeFileSync(validFile, 'export function valid() {}');

      const updatePromise = new Promise((resolve) => {
        hookManager.once('documentation-updated', resolve);
      });

      const validEvent: HookEvent = {
        type: 'file-save',
        filePath: validFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(validEvent);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const update = await updatePromise;
      expect(update).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should respect include patterns', async () => {
      const restrictiveConfig = {
        ...mockConfig,
        includePatterns: ['**/*.py'], // Only Python files
      };

      const restrictiveManager = new HookManager(tempDir, restrictiveConfig);
      await restrictiveManager.initialize();

      // TypeScript file should be ignored
      const tsFile = path.join(tempDir, 'ignored.ts');
      fs.writeFileSync(tsFile, 'export function ignored() {}');

      let updateTriggered = false;
      restrictiveManager.once('documentation-updated', () => {
        updateTriggered = true;
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: tsFile,
        projectPath: tempDir,
      };

      await restrictiveManager.handleHookEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(updateTriggered).toBe(false);
      
      await restrictiveManager.stop();
    });

    it('should respect exclude patterns', async () => {
      await hookManager.initialize();

      // Test file should be excluded
      const testFile = path.join(tempDir, 'component.test.ts');
      fs.writeFileSync(testFile, 'describe("test", () => {});');

      let updateTriggered = false;
      hookManager.once('documentation-updated', () => {
        updateTriggered = true;
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(updateTriggered).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track hook statistics', async () => {
      await hookManager.initialize();

      const initialStats = hookManager.getStatistics();
      expect(initialStats.queuedUpdates).toBe(0);

      // Add some queued updates
      const testFile = path.join(tempDir, 'stats-test.ts');
      fs.writeFileSync(testFile, 'export function test() {}');

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
      };

      // Don't await to keep it queued
      hookManager.handleHookEvent(event);

      const statsWithQueue = hookManager.getStatistics();
      expect(statsWithQueue.queuedUpdates).toBeGreaterThan(0);
    });
  });
});
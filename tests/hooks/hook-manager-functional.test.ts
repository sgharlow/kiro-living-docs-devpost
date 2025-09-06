import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the dependencies to avoid import issues
jest.mock('../../src/analyzers/typescript-analyzer.js', () => ({
  TypeScriptAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: [],
    }),
  })),
}));

jest.mock('../../src/analyzers/python-analyzer.js', () => ({
  PythonAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: [],
    }),
  })),
}));

jest.mock('../../src/analyzers/go-analyzer.js', () => ({
  GoAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: [],
    }),
  })),
}));

jest.mock('../../src/analyzers/git-analyzer.js', () => ({
  GitAnalyzer: jest.fn().mockImplementation(() => ({
    getRecentChanges: jest.fn().mockResolvedValue([]),
    extractFeatureContext: jest.fn().mockResolvedValue({
      filePath: 'test.ts',
      changePatterns: [],
      recentCommits: [],
      authors: [],
    }),
  })),
}));

jest.mock('../../src/generators/markdown-generator.js', () => ({
  MarkdownGenerator: jest.fn().mockImplementation(() => ({
    generateFileDocumentation: jest.fn().mockResolvedValue('# Test Documentation'),
    generateProjectDocumentation: jest.fn().mockReturnValue({
      markdown: '# Project Documentation',
    }),
  })),
}));

jest.mock('../../src/steering/steering-parser.js', () => ({
  SteeringParser: jest.fn().mockImplementation(() => ({
    loadSteeringConfig: jest.fn().mockResolvedValue({}),
    applyTerminologyReplacements: jest.fn().mockImplementation((text) => text),
  })),
}));

jest.mock('../../src/watcher.js', () => ({
  FileWatcher: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    startWatching: jest.fn().mockResolvedValue(undefined),
    stopWatching: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/config.js', () => ({
  ConfigManager: {
    loadConfig: jest.fn().mockReturnValue({
      includePatterns: ['**/*.ts', '**/*.js'],
      excludePatterns: ['node_modules/**'],
      outputPath: 'docs',
      watchDebounceMs: 1000,
    }),
  },
}));

// Now import the HookManager after mocking dependencies
import { HookManager, HookEvent, HookConfig } from '../../src/hooks/hook-manager';

describe('HookManager Functional Tests', () => {
  let tempDir: string;
  let hookManager: HookManager;
  let mockConfig: HookConfig;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-manager-functional-test-'));
    
    mockConfig = {
      enabled: true,
      events: ['file-save', 'commit', 'file-focus', 'pull-request', 'branch-switch'],
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

  describe('Hook Event Processing', () => {
    it('should handle file save events and generate documentation', async () => {
      await hookManager.initialize();

      // Create a test file
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, 'export function test() { return "hello"; }');

      // Set up event listener
      const updatePromise = new Promise((resolve) => {
        hookManager.once('documentation-updated', resolve);
      });

      // Trigger file save event
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
      expect((update as any).type).toBe('file');
    });

    it('should handle commit events and update project documentation', async () => {
      await hookManager.initialize();

      // Set up event listener
      const commitPromise = new Promise((resolve) => {
        hookManager.once('commit-processed', resolve);
      });

      // Trigger commit event
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
      expect((result as any).event.type).toBe('commit');
    });

    it('should handle file focus events and provide contextual documentation', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'focus-test.ts');
      fs.writeFileSync(testFile, 'export class TestClass { method() {} }');

      // Set up event listener
      const contextPromise = new Promise((resolve) => {
        hookManager.once('contextual-documentation', resolve);
      });

      // Trigger file focus event
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

    it('should handle pull request events and generate documentation diff', async () => {
      await hookManager.initialize();

      // Set up event listener
      const prPromise = new Promise((resolve) => {
        hookManager.once('pr-documentation-diff', resolve);
      });

      // Trigger pull request event
      const event: HookEvent = {
        type: 'pull-request',
        projectPath: tempDir,
        metadata: {
          pullRequestId: 'PR-123',
          timestamp: new Date(),
        },
      };

      await hookManager.handleHookEvent(event);
      
      const result = await prPromise;
      expect(result).toBeDefined();
      expect((result as any).pullRequestId).toBe('PR-123');
    });

    it('should handle branch switch events', async () => {
      await hookManager.initialize();

      // Set up event listener
      const branchPromise = new Promise((resolve) => {
        hookManager.once('branch-switched', resolve);
      });

      // Trigger branch switch event
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

  describe('Error Handling and Fallback Mechanisms', () => {
    it('should emit error events when processing fails', async () => {
      await hookManager.initialize();

      // Set up error listener
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
      expect((error as any).context).toBe('file-save');
    });

    it('should continue processing after errors', async () => {
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

    it('should handle disabled configuration gracefully', async () => {
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
      
      await disabledManager.stop();
    });

    it('should respect file filtering patterns', async () => {
      await hookManager.initialize();

      // Test file that should be ignored (test file)
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

  describe('Debouncing and Performance', () => {
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

    it('should track statistics correctly', async () => {
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

  describe('Configuration Handling', () => {
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

    it('should handle different event types based on configuration', async () => {
      const limitedConfig = {
        ...mockConfig,
        events: ['file-save'], // Only file-save events
      };

      const limitedManager = new HookManager(tempDir, limitedConfig);
      await limitedManager.initialize();

      let eventProcessed = false;
      limitedManager.on('hook-triggered', () => {
        eventProcessed = true;
      });

      // File save should be processed
      const fileSaveEvent: HookEvent = {
        type: 'file-save',
        filePath: path.join(tempDir, 'test.ts'),
        projectPath: tempDir,
      };

      await limitedManager.handleHookEvent(fileSaveEvent);
      expect(eventProcessed).toBe(true);

      // Reset flag
      eventProcessed = false;

      // Commit should be ignored
      const commitEvent: HookEvent = {
        type: 'commit',
        projectPath: tempDir,
      };

      await limitedManager.handleHookEvent(commitEvent);
      expect(eventProcessed).toBe(false);
      
      await limitedManager.stop();
    });
  });

  describe('Integration with Kiro Features', () => {
    it('should apply steering configuration when available', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'steering-test.ts');
      fs.writeFileSync(testFile, 'export function test() {}');

      // Set up event listener
      const updatePromise = new Promise((resolve) => {
        hookManager.once('documentation-updated', resolve);
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const update = await updatePromise;
      expect(update).toBeDefined();
      
      // Verify that steering parser was called (through mocks)
      const { SteeringParser } = require('../../src/steering/steering-parser.js');
      const mockInstance = SteeringParser.mock.instances[0];
      expect(mockInstance.loadSteeringConfig).toHaveBeenCalled();
    });

    it('should generate appropriate output paths', async () => {
      await hookManager.initialize();

      const testFile = path.join(tempDir, 'src', 'components', 'Button.ts');
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'export class Button {}');

      const updatePromise = new Promise((resolve) => {
        hookManager.once('documentation-updated', resolve);
      });

      const event: HookEvent = {
        type: 'file-save',
        filePath: testFile,
        projectPath: tempDir,
      };

      await hookManager.handleHookEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const update = await updatePromise;
      expect(update).toBeDefined();
      
      const outputPath = (update as any).filePath;
      expect(outputPath).toContain('docs');
      expect(outputPath).toContain('Button.md');
    });
  });
});
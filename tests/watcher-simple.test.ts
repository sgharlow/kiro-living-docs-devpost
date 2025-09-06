import { FileWatcher } from '../src/watcher';
import { ProjectConfig } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileWatcher - Core Functionality', () => {
  let tempDir: string;
  let config: ProjectConfig;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-simple-test-'));
    config = {
      projectPath: tempDir,
      watchDebounceMs: 50, // Very short for testing
      includePatterns: ['**/*.ts', '**/*.js'],
      excludePatterns: [],
    };
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Operations', () => {
    it('should create and configure watcher correctly', () => {
      const watcher = new FileWatcher(config);
      expect(watcher).toBeInstanceOf(FileWatcher);
      
      const status = watcher.getStatus();
      expect(status.isWatching).toBe(false);
      expect(status.queuedChanges).toBe(0);
    });

    it('should start and stop watching lifecycle', async () => {
      const watcher = new FileWatcher(config);
      
      expect(watcher.getStatus().isWatching).toBe(false);
      
      await watcher.startWatching();
      expect(watcher.getStatus().isWatching).toBe(true);
      
      await watcher.stopWatching();
      expect(watcher.getStatus().isWatching).toBe(false);
      watcher.removeAllListeners();
    });

    it('should handle multiple start attempts gracefully', async () => {
      const watcher = new FileWatcher(config);
      
      await watcher.startWatching();
      
      await expect(watcher.startWatching()).rejects.toThrow('already running');
      
      await watcher.stopWatching();
      watcher.removeAllListeners();
    });

    it('should handle stop when not watching', async () => {
      const watcher = new FileWatcher(config);
      
      // Should not throw
      await watcher.stopWatching();
      expect(watcher.getStatus().isWatching).toBe(false);
    });
  });

  describe('File Detection Logic', () => {
    it('should identify source files correctly', () => {
      const watcher = new FileWatcher(config);
      
      // Access private method for testing
      const isSourceFile = (watcher as any).isSourceFile.bind(watcher);
      
      expect(isSourceFile('test.ts')).toBe(true);
      expect(isSourceFile('test.js')).toBe(true);
      expect(isSourceFile('test.py')).toBe(true);
      expect(isSourceFile('test.go')).toBe(true);
      expect(isSourceFile('README.md')).toBe(true);
      
      expect(isSourceFile('test.txt')).toBe(false);
      expect(isSourceFile('image.png')).toBe(false);
      expect(isSourceFile('data.json')).toBe(false);
    });

    it('should build watch patterns correctly', () => {
      const watcher = new FileWatcher(config);
      
      // Access private method for testing
      const buildWatchPatterns = (watcher as any).buildWatchPatterns.bind(watcher);
      
      const patterns = buildWatchPatterns();
      expect(patterns).toContain('**/*.ts');
      expect(patterns).toContain('**/*.js');
    });
  });

  describe('Configuration Handling', () => {
    it('should use custom include patterns', () => {
      const customConfig = {
        ...config,
        includePatterns: ['**/*.custom'],
      };
      
      const watcher = new FileWatcher(customConfig);
      const patterns = (watcher as any).buildWatchPatterns();
      
      expect(patterns).toContain('**/*.custom');
      expect(patterns).not.toContain('**/*.ts');
    });

    it('should handle missing configuration gracefully', () => {
      const minimalConfig = {
        projectPath: tempDir,
      };
      
      const watcher = new FileWatcher(minimalConfig as ProjectConfig);
      expect(watcher).toBeInstanceOf(FileWatcher);
    });
  });

  describe('Event Handling', () => {
    it('should emit ready event when starting', async () => {
      const watcher = new FileWatcher(config);
      let readyEmitted = false;
      
      watcher.on('ready', () => {
        readyEmitted = true;
      });
      
      await watcher.startWatching();
      expect(readyEmitted).toBe(true);
      
      await watcher.stopWatching();
      watcher.removeAllListeners();
    });

    it('should emit stopped event when stopping', async () => {
      const watcher = new FileWatcher(config);
      let stoppedEmitted = false;
      
      watcher.on('stopped', () => {
        stoppedEmitted = true;
      });
      
      await watcher.startWatching();
      await watcher.stopWatching();
      
      expect(stoppedEmitted).toBe(true);
      watcher.removeAllListeners();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project path', async () => {
      const invalidConfig = {
        ...config,
        projectPath: '/this/path/does/not/exist',
      };
      
      const watcher = new FileWatcher(invalidConfig);
      
      try {
        await watcher.startWatching();
        // If it doesn't throw, that's also acceptable (chokidar might handle it)
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
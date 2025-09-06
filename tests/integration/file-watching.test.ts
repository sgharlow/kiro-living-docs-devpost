import { ConfigManager } from '../../src/config';
import { FileWatcher } from '../../src/watcher';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('File Watching Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Integration', () => {
    it('should load project configuration correctly', async () => {
      // Create a custom config file
      const configPath = path.join(tempDir, 'living-docs.config.json');
      const customConfig = {
        watchDebounceMs: 500,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
      };
      
      fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));
      
      // Load config
      const config = await ConfigManager.loadConfig(tempDir);
      
      expect(config.watchDebounceMs).toBe(500);
      expect(config.includePatterns).toEqual(['**/*.ts']);
      expect(config.excludePatterns).toEqual(['**/*.test.ts']);
    });

    it('should work with default configuration when no config file exists', async () => {
      // No config file in temp directory
      const config = await ConfigManager.loadConfig(tempDir);
      
      expect(config.projectPath).toBe(tempDir);
      expect(config.watchDebounceMs).toBe(300); // Default
      expect(config.includePatterns).toContain('**/*.ts');
    });

    it('should integrate file watcher with configuration', async () => {
      const config = await ConfigManager.loadConfig(tempDir);
      const watcher = new FileWatcher(config);
      
      expect(watcher.getStatus().isWatching).toBe(false);
      
      await watcher.startWatching();
      expect(watcher.getStatus().isWatching).toBe(true);
      
      await watcher.stopWatching();
      expect(watcher.getStatus().isWatching).toBe(false);
    });
  });
});
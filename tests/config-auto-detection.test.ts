/**
 * Tests for ConfigManager with Auto-Detection Integration
 */

import { ConfigManager } from '../dist/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager Auto-Detection Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadConfig with auto-detection', () => {
    it('should auto-detect project when no config file exists', async () => {
      // Create a Node.js project
      const packageJson = {
        name: 'auto-detect-test',
        dependencies: { express: '^4.18.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'console.log("test");');

      const config = await ConfigManager.loadConfig(tempDir);

      expect(config.projectPath).toBe(tempDir);
      expect(config.languages).toContain('typescript');
      expect(config.includePatterns).toContain('**/*.ts');
      expect(config.outputPath).toBe('docs');
    });

    it('should merge auto-detected config with user config', async () => {
      // Create project files
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("test");');

      // Create user config that overrides some settings
      const userConfig = {
        outputPath: 'custom-docs',
        webServerPort: 4000,
        autoDetect: true
      };
      fs.writeFileSync(
        path.join(tempDir, 'living-docs.config.json'),
        JSON.stringify(userConfig, null, 2)
      );

      const config = await ConfigManager.loadConfig(tempDir);

      expect(config.outputPath).toBe('custom-docs'); // User override
      expect(config.webServerPort).toBe(4000); // User override
      expect(config.languages).toContain('javascript'); // Auto-detected
      expect(config.includePatterns).toContain('**/*.js'); // Auto-detected
    });

    it('should skip auto-detection when autoDetect is false', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'console.log("test");');

      const userConfig = {
        autoDetect: false,
        languages: ['python'], // Incorrect but should be respected
        outputPath: 'manual-docs'
      };
      fs.writeFileSync(
        path.join(tempDir, 'living-docs.config.json'),
        JSON.stringify(userConfig, null, 2)
      );

      const config = await ConfigManager.loadConfig(tempDir);

      expect(config.languages).toEqual(['python']); // Should use user config, not auto-detect
      expect(config.outputPath).toBe('manual-docs');
    });

    it('should handle auto-detection failures gracefully', async () => {
      // Create a directory with no recognizable project structure
      fs.writeFileSync(path.join(tempDir, 'random.txt'), 'not a code file');

      const config = await ConfigManager.loadConfig(tempDir);

      // Should fall back to defaults
      expect(config.projectPath).toBe(tempDir);
      expect(config.outputPath).toBe('documentation'); // Falls back to default when no languages detected
      expect(config.languages).toEqual([]); // Auto-detection failed, so no languages detected
    });
  });

  describe('generateConfigFile', () => {
    it('should generate config file with auto-detected settings', async () => {
      // Create a React project
      const packageJson = {
        name: 'react-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          '@types/react': '^18.0.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'App.tsx'), 'import React from "react";');

      await ConfigManager.generateConfigFile(tempDir, { includeComments: true });

      const configPath = path.join(tempDir, 'living-docs.config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.languages).toContain('typescript');
      expect(config.webServerPort).toBe(3001); // Should avoid React dev server port
      expect(config._metadata.detectedType).toBe('node');
      expect(config._metadata.detectedFrameworks).toContain('react');
    });

    it('should not overwrite existing config by default', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      
      const existingConfig = { outputPath: 'existing' };
      const configPath = path.join(tempDir, 'living-docs.config.json');
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      await expect(ConfigManager.generateConfigFile(tempDir))
        .rejects.toThrow('Configuration file already exists');
    });

    it('should overwrite existing config when requested', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.py'), 'print("hello")');
      
      const existingConfig = { outputPath: 'existing' };
      const configPath = path.join(tempDir, 'living-docs.config.json');
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      await ConfigManager.generateConfigFile(tempDir, { overwrite: true });

      const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(newConfig.languages).toContain('python');
      expect(newConfig.outputPath).toBe('docs'); // Should be auto-detected, not 'existing'
    });

    it('should include warnings and suggestions in generated config', async () => {
      // Create a project with potential issues (no supported languages)
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Project');

      await ConfigManager.generateConfigFile(tempDir, { includeComments: true });

      const configPath = path.join(tempDir, 'living-docs.config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      expect(config._warnings).toBeDefined();
      expect(config._warnings.length).toBeGreaterThan(0);
      expect(config._suggestions).toBeDefined();
      expect(config._suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Environment variable integration', () => {
    it('should merge environment variables with auto-detected config', async () => {
      // Set environment variables
      process.env.WEB_SERVER_PORT = '5000';
      process.env.CACHE_SIZE_MB = '200';

      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("test");');

      const config = await ConfigManager.loadConfig(tempDir);

      expect(config.webServerPort).toBe(5000); // From environment
      expect(config.cacheSizeMB).toBe(200); // From environment
      expect(config.languages).toContain('javascript'); // Auto-detected

      // Clean up environment variables
      delete process.env.WEB_SERVER_PORT;
      delete process.env.CACHE_SIZE_MB;
    });
  });

  describe('Validation with auto-detection', () => {
    it('should validate auto-detected configuration', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'console.log("test");');

      // This should not throw
      const config = await ConfigManager.loadConfig(tempDir);
      expect(config.projectPath).toBe(tempDir);
    });

    it('should handle invalid auto-detected ports', async () => {
      // Create a mock scenario where auto-detection might suggest an invalid port
      // This is more of a safety test for the validation logic
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      
      const userConfig = {
        webServerPort: 99999 // Invalid port
      };
      fs.writeFileSync(
        path.join(tempDir, 'living-docs.config.json'),
        JSON.stringify(userConfig)
      );

      await expect(ConfigManager.loadConfig(tempDir))
        .rejects.toThrow('Web server port must be between 1024 and 65535');
    });
  });
});
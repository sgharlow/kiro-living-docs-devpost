/**
 * Tests for Project Auto-Detection and Configuration
 */

import { ProjectDetector } from '../dist/project-detector.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ProjectDetector', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-detector-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Node.js Project Detection', () => {
    it('should detect a basic Node.js project', async () => {
      // Create package.json
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        description: 'A test project',
        dependencies: {
          express: '^4.18.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create some TypeScript files
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'console.log("Hello World");');
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'app.ts'), 'export class App {}');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('node');
      expect(detected.languages).toContain('typescript');
      expect(detected.frameworks).toContain('express');
      expect(detected.metadata.name).toBe('test-project');
      expect(detected.metadata.version).toBe('1.0.0');
      expect(detected.metadata.description).toBe('A test project');
    });

    it('should detect React framework', async () => {
      const packageJson = {
        name: 'react-app',
        dependencies: {
          react: '^18.0.0',
          '@types/react': '^18.0.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      // Create React-specific files
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'App.tsx'), 'import React from "react";');
      fs.mkdirSync(path.join(tempDir, 'public'));
      fs.writeFileSync(path.join(tempDir, 'public', 'index.html'), '<div id="root"></div>');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('node');
      expect(detected.frameworks).toContain('react');
      expect(detected.suggestedConfig.webServerPort).toBe(3001); // Should avoid port 3000
    });

    it('should detect Vue.js framework', async () => {
      const packageJson = {
        name: 'vue-app',
        dependencies: {
          vue: '^3.0.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'App.vue'), '<template><div>Hello</div></template>');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.frameworks).toContain('vue');
    });
  });

  describe('Python Project Detection', () => {
    it('should detect a basic Python project with requirements.txt', async () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'Flask>=2.0.0\nrequests>=2.25.0');
      fs.writeFileSync(path.join(tempDir, 'app.py'), 'from flask import Flask');
      fs.writeFileSync(path.join(tempDir, 'models.py'), 'class User: pass');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('python');
      expect(detected.languages).toContain('python');
      expect(detected.frameworks).toContain('flask');
    });

    it('should detect Django framework', async () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'Django>=4.0.0');
      fs.writeFileSync(path.join(tempDir, 'manage.py'), '#!/usr/bin/env python');
      
      fs.mkdirSync(path.join(tempDir, 'myapp'));
      fs.writeFileSync(path.join(tempDir, 'myapp', 'models.py'), 'from django.db import models');
      fs.writeFileSync(path.join(tempDir, 'myapp', 'views.py'), 'from django.shortcuts import render');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.frameworks).toContain('django');
    });

    it('should parse pyproject.toml', async () => {
      const pyprojectToml = `
[project]
name = "my-python-project"
version = "0.1.0"
description = "A sample Python project"
dependencies = [
    "fastapi>=0.68.0",
    "uvicorn>=0.15.0"
]
`;
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), pyprojectToml);
      fs.writeFileSync(path.join(tempDir, 'main.py'), 'from fastapi import FastAPI');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('python');
      expect(detected.frameworks).toContain('fastapi');
      expect(detected.metadata.name).toBe('my-python-project');
      expect(detected.metadata.version).toBe('0.1.0');
    });
  });

  describe('Go Project Detection', () => {
    it('should detect a Go project', async () => {
      const goMod = `
module github.com/user/my-go-project

go 1.19

require (
    github.com/gin-gonic/gin v1.8.0
    github.com/stretchr/testify v1.7.0
)
`;
      fs.writeFileSync(path.join(tempDir, 'go.mod'), goMod);
      fs.writeFileSync(path.join(tempDir, 'main.go'), 'package main\n\nfunc main() {}');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('go');
      expect(detected.languages).toContain('go');
      expect(detected.frameworks).toContain('gin');
      expect(detected.metadata.name).toBe('my-go-project');
    });
  });

  describe('Mixed Language Projects', () => {
    it('should detect mixed language projects', async () => {
      // Create a project with multiple languages
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "mixed-project"}');
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("JS");');
      fs.writeFileSync(path.join(tempDir, 'script.py'), 'print("Python")');
      fs.writeFileSync(path.join(tempDir, 'main.go'), 'package main');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.type).toBe('node'); // Should prioritize based on package files
      expect(detected.languages.length).toBeGreaterThan(1);
      expect(detected.languages).toContain('javascript');
      expect(detected.languages).toContain('python');
      expect(detected.languages).toContain('go');
    });
  });

  describe('Configuration Generation', () => {
    it('should generate appropriate include patterns for detected languages', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'export {}');
      fs.writeFileSync(path.join(tempDir, 'script.py'), 'pass');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.suggestedConfig.includePatterns).toContain('**/*.ts');
      expect(detected.suggestedConfig.includePatterns).toContain('**/*.py');
      expect(detected.suggestedConfig.excludePatterns).toContain('node_modules/**');
      expect(detected.suggestedConfig.excludePatterns).toContain('**/*.test.*');
    });

    it('should set appropriate output paths', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');

      const detected = await ProjectDetector.detectProject(tempDir);

      expect(detected.suggestedConfig.outputPath).toBe('docs');
    });
  });

  describe('Validation', () => {
    it('should validate detected configuration', async () => {
      // Create a project with no supported files
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');

      const detected = await ProjectDetector.detectProject(tempDir);
      const validation = ProjectDetector.validateDetectedConfig(detected);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings).toContain('No supported programming languages detected in the project');
      expect(validation.suggestions.length).toBeGreaterThan(0);
    });

    it('should warn about multiple frameworks', async () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          vue: '^3.0.0',
          express: '^4.18.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'app.tsx'), 'import React from "react"');

      const detected = await ProjectDetector.detectProject(tempDir);
      const validation = ProjectDetector.validateDetectedConfig(detected);

      expect(validation.warnings.some(w => w.includes('Multiple web frameworks'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directories gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      
      const detected = await ProjectDetector.detectProject(nonExistentPath);
      
      expect(detected.type).toBe('unknown');
      expect(detected.languages).toEqual([]);
    });

    it('should handle malformed package.json files', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{ invalid json }');
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("test")');

      const detected = await ProjectDetector.detectProject(tempDir);

      // Should still detect JavaScript files even with malformed package.json
      expect(detected.languages).toContain('javascript');
    });

    it('should skip inaccessible directories', async () => {
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("test")');
      
      // Create a directory and then make it inaccessible (on Unix systems)
      const restrictedDir = path.join(tempDir, 'restricted');
      fs.mkdirSync(restrictedDir);
      
      try {
        fs.chmodSync(restrictedDir, 0o000); // No permissions
      } catch {
        // Skip this test on systems that don't support chmod
        return;
      }

      const detected = await ProjectDetector.detectProject(tempDir);

      // Should still work despite inaccessible directory
      expect(detected.languages).toContain('javascript');
      
      // Restore permissions for cleanup
      try {
        fs.chmodSync(restrictedDir, 0o755);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Performance', () => {
    it('should handle large directory structures efficiently', async () => {
      // Create a moderately large directory structure
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      
      // Create 100 TypeScript files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(
          path.join(srcDir, `file${i}.ts`), 
          `export function func${i}() { return ${i}; }`
        );
      }
      
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "large-project"}');

      const startTime = Date.now();
      const detected = await ProjectDetector.detectProject(tempDir);
      const endTime = Date.now();

      expect(detected.languages).toContain('typescript');
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
#!/usr/bin/env node

/**
 * Test script for project auto-detection functionality
 */

import { ProjectDetector } from '../dist/project-detector.js';
import { ConfigManager } from '../dist/config.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function testProjectDetection() {
  console.log('🔍 Testing Project Auto-Detection Functionality\n');

  // Test 1: Detect current project
  console.log('📋 Test 1: Detecting current project...');
  try {
    const currentProject = process.cwd();
    const detected = await ProjectDetector.detectProject(currentProject);
    
    console.log(`✅ Project Type: ${detected.type}`);
    console.log(`✅ Languages: ${detected.languages.join(', ')}`);
    console.log(`✅ Frameworks: ${detected.frameworks.join(', ')}`);
    console.log(`✅ Project Name: ${detected.metadata.name}`);
    if (detected.metadata.version) {
      console.log(`✅ Version: ${detected.metadata.version}`);
    }
    
    const validation = ProjectDetector.validateDetectedConfig(detected);
    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    }
    if (validation.suggestions.length > 0) {
      console.log('💡 Suggestions:');
      validation.suggestions.forEach(s => console.log(`   - ${s}`));
    }
  } catch (error) {
    console.error('❌ Error detecting current project:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Create and detect a sample Node.js project
  console.log('📋 Test 2: Creating and detecting a sample Node.js project...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-detection-test-'));
  
  try {
    // Create package.json
    const packageJson = {
      name: 'sample-react-app',
      version: '1.0.0',
      description: 'A sample React application for testing',
      dependencies: {
        react: '^18.0.0',
        '@types/react': '^18.0.0',
        express: '^4.18.0'
      },
      devDependencies: {
        '@types/node': '^18.0.0',
        typescript: '^4.9.0'
      }
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create some source files
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'App.tsx'), `
import React from 'react';

interface Props {
  title: string;
}

export const App: React.FC<Props> = ({ title }) => {
  return <h1>{title}</h1>;
};
`);

    fs.writeFileSync(path.join(tempDir, 'src', 'server.ts'), `
import express from 'express';

const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`);

    // Create public directory
    fs.mkdirSync(path.join(tempDir, 'public'));
    fs.writeFileSync(path.join(tempDir, 'public', 'index.html'), `
<!DOCTYPE html>
<html>
<head>
  <title>Sample React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`);

    // Detect the project
    const detected = await ProjectDetector.detectProject(tempDir);
    
    console.log(`✅ Project Type: ${detected.type}`);
    console.log(`✅ Languages: ${detected.languages.join(', ')}`);
    console.log(`✅ Frameworks: ${detected.frameworks.join(', ')}`);
    console.log(`✅ Project Name: ${detected.metadata.name}`);
    console.log(`✅ Suggested Output Path: ${detected.suggestedConfig.outputPath}`);
    console.log(`✅ Suggested Web Server Port: ${detected.suggestedConfig.webServerPort}`);
    console.log(`✅ Include Patterns: ${detected.suggestedConfig.includePatterns?.slice(0, 3).join(', ')}...`);

    // Test configuration generation
    console.log('\n📄 Generating configuration file...');
    await ConfigManager.generateConfigFile(tempDir, { includeComments: true });
    
    const configPath = path.join(tempDir, 'living-docs.config.json');
    if (fs.existsSync(configPath)) {
      console.log('✅ Configuration file generated successfully!');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      console.log('📋 Generated config preview:');
      console.log(`   - Languages: ${config.languages?.join(', ')}`);
      console.log(`   - Output Path: ${config.outputPath}`);
      console.log(`   - Web Server Port: ${config.webServerPort}`);
    }

    // Test loading the generated config
    console.log('\n🔄 Testing config loading with auto-detection...');
    const loadedConfig = await ConfigManager.loadConfig(tempDir);
    console.log(`✅ Loaded config successfully!`);
    console.log(`   - Project Path: ${loadedConfig.projectPath}`);
    console.log(`   - Languages: ${loadedConfig.languages?.join(', ')}`);
    console.log(`   - Output Path: ${loadedConfig.outputPath}`);

  } catch (error) {
    console.error('❌ Error in sample project test:', error.message);
  } finally {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Test with Python project
  console.log('📋 Test 3: Creating and detecting a sample Python project...');
  const pythonTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'python-detection-test-'));
  
  try {
    // Create requirements.txt
    fs.writeFileSync(path.join(pythonTempDir, 'requirements.txt'), `
Django>=4.0.0
djangorestframework>=3.14.0
psycopg2-binary>=2.9.0
`);

    // Create Python files
    fs.writeFileSync(path.join(pythonTempDir, 'manage.py'), `
#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
`);

    fs.mkdirSync(path.join(pythonTempDir, 'myapp'));
    fs.writeFileSync(path.join(pythonTempDir, 'myapp', 'models.py'), `
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
`);

    fs.writeFileSync(path.join(pythonTempDir, 'myapp', 'views.py'), `
from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet
from .models import User

class UserViewSet(ModelViewSet):
    queryset = User.objects.all()
`);

    // Detect the Python project
    const pythonDetected = await ProjectDetector.detectProject(pythonTempDir);
    
    console.log(`✅ Project Type: ${pythonDetected.type}`);
    console.log(`✅ Languages: ${pythonDetected.languages.join(', ')}`);
    console.log(`✅ Frameworks: ${pythonDetected.frameworks.join(', ')}`);
    console.log(`✅ Suggested Include Patterns: ${pythonDetected.suggestedConfig.includePatterns?.slice(0, 3).join(', ')}`);

  } catch (error) {
    console.error('❌ Error in Python project test:', error.message);
  } finally {
    // Clean up
    if (fs.existsSync(pythonTempDir)) {
      fs.rmSync(pythonTempDir, { recursive: true, force: true });
    }
  }

  console.log('\n🎉 Project auto-detection testing completed!');
}

// Run the test
testProjectDetection().catch(console.error);
/**
 * End-to-end integration tests for Living Documentation Generator
 * 
 * Tests complete workflows including multi-language analysis,
 * real-time updates, web server functionality, and user scenarios.
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { spawn } = require('child_process');

describe('Living Documentation Generator E2E', () => {
  let browser;
  let page;
  let serverProcess;
  let tempProjectDir;
  const serverPort = 3001;
  const serverUrl = `http://localhost:${serverPort}`;

  beforeAll(async () => {
    // Launch browser for web UI testing
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create temporary project directory
    tempProjectDir = path.join(__dirname, '../../temp', `e2e-${Date.now()}`);
    await fs.mkdir(tempProjectDir, { recursive: true });

    // Set up demo project structure
    await setupDemoProject(tempProjectDir);

    // Start documentation server
    await startDocumentationServer(tempProjectDir, serverPort);

    // Wait for server to be ready
    await waitForServer(serverUrl);
  });

  afterAll(async () => {
    // Clean up
    if (browser) {
      await browser.close();
    }
    
    if (serverProcess) {
      serverProcess.kill();
    }

    // Clean up temp directory
    try {
      await fs.rmdir(tempProjectDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  describe('Multi-Language Project Analysis', () => {
    test('should analyze complete demo project and generate documentation', async () => {
      // Verify API endpoint returns project analysis
      const response = await axios.get(`${serverUrl}/api/analysis`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const analysis = response.data.analysis;
      
      // Should detect all languages
      expect(analysis.languages).toContain('typescript');
      expect(analysis.languages).toContain('python');
      expect(analysis.languages).toContain('go');
      
      // Should find functions from all languages
      expect(analysis.functions.length).toBeGreaterThan(10);
      
      // Should detect TypeScript functions
      const tsFunctions = analysis.functions.filter(f => f.language === 'typescript');
      expect(tsFunctions.length).toBeGreaterThan(3);
      
      // Should detect Python functions
      const pyFunctions = analysis.functions.filter(f => f.language === 'python');
      expect(pyFunctions.length).toBeGreaterThan(3);
      
      // Should detect Go functions
      const goFunctions = analysis.functions.filter(f => f.language === 'go');
      expect(goFunctions.length).toBeGreaterThan(3);
      
      // Should detect API endpoints
      expect(analysis.apiEndpoints.length).toBeGreaterThan(5);
      
      // Should include architecture information
      expect(analysis.architecture).toBeDefined();
      expect(analysis.architecture.dependencies).toBeDefined();
    });

    test('should generate cross-language type mappings', async () => {
      const response = await axios.get(`${serverUrl}/api/types`);
      
      expect(response.status).toBe(200);
      
      const types = response.data.types;
      
      // Should find User type in multiple languages
      const userTypes = types.filter(t => t.name === 'User');
      expect(userTypes.length).toBeGreaterThanOrEqual(2);
      
      // Should map equivalent types across languages
      const typeMapping = response.data.crossLanguageMappings;
      expect(typeMapping).toBeDefined();
      expect(typeMapping['User']).toBeDefined();
      expect(typeMapping['User'].typescript).toBeDefined();
      expect(typeMapping['User'].go).toBeDefined();
    });
  });

  describe('Web Documentation Interface', () => {
    test('should load documentation homepage', async () => {
      await page.goto(serverUrl);
      
      // Check page title
      const title = await page.title();
      expect(title).toContain('Living Docs Demo');
      
      // Check main navigation
      await page.waitForSelector('.documentation-nav');
      const navItems = await page.$$eval('.nav-item', items => 
        items.map(item => item.textContent.trim())
      );
      
      expect(navItems).toContain('Overview');
      expect(navItems).toContain('API');
      expect(navItems).toContain('Types');
      expect(navItems).toContain('Architecture');
    });

    test('should display function documentation with syntax highlighting', async () => {
      await page.goto(`${serverUrl}/functions`);
      
      // Wait for functions to load
      await page.waitForSelector('.function-item');
      
      // Check that functions are displayed
      const functions = await page.$$('.function-item');
      expect(functions.length).toBeGreaterThan(5);
      
      // Click on a function to view details
      await page.click('.function-item:first-child');
      
      // Check syntax highlighting
      await page.waitForSelector('.code-block .hljs');
      const codeBlock = await page.$('.code-block .hljs');
      expect(codeBlock).toBeTruthy();
      
      // Check copy button functionality
      const copyButton = await page.$('.copy-button');
      expect(copyButton).toBeTruthy();
      
      await copyButton.click();
      
      // Verify copy success indicator
      await page.waitForSelector('.copy-success', { timeout: 2000 });
    });

    test('should provide working search functionality', async () => {
      await page.goto(serverUrl);
      
      // Wait for search box
      await page.waitForSelector('#search-input');
      
      // Search for "user"
      await page.type('#search-input', 'user');
      
      // Wait for search results
      await page.waitForSelector('.search-results');
      
      const results = await page.$$('.search-result');
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results contain relevant items
      const resultTexts = await page.$$eval('.search-result', results =>
        results.map(result => result.textContent.toLowerCase())
      );
      
      expect(resultTexts.some(text => text.includes('user'))).toBe(true);
      
      // Test search result navigation
      await page.click('.search-result:first-child');
      
      // Should navigate to the selected item
      const url = page.url();
      expect(url).toMatch(/\/(functions|types|api)/);
    });

    test('should support theme switching', async () => {
      await page.goto(serverUrl);
      
      // Wait for theme toggle
      await page.waitForSelector('.theme-toggle');
      
      // Check initial theme (should be light)
      const initialTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      );
      expect(initialTheme).toBe('light');
      
      // Click theme toggle
      await page.click('.theme-toggle');
      
      // Check theme changed to dark
      const newTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      );
      expect(newTheme).toBe('dark');
      
      // Verify theme persistence on reload
      await page.reload();
      await page.waitForSelector('.theme-toggle');
      
      const persistedTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      );
      expect(persistedTheme).toBe('dark');
    });
  });

  describe('Real-Time Updates', () => {
    test('should update documentation when files change', async () => {
      await page.goto(`${serverUrl}/functions`);
      
      // Wait for initial content
      await page.waitForSelector('.function-item');
      const initialCount = await page.$$eval('.function-item', items => items.length);
      
      // Add a new function to a TypeScript file
      const testFile = path.join(tempProjectDir, 'frontend/src/utils/newFunction.ts');
      const newFunctionCode = `
        /**
         * New test function added during E2E test
         * @param input Test input parameter
         * @returns Processed output
         */
        export function newTestFunction(input: string): string {
          return \`Processed: \${input}\`;
        }
      `;
      
      await fs.writeFile(testFile, newFunctionCode);
      
      // Wait for WebSocket update (should happen within 5 seconds)
      await page.waitForFunction(
        (expectedCount) => {
          const items = document.querySelectorAll('.function-item');
          return items.length > expectedCount;
        },
        { timeout: 10000 },
        initialCount
      );
      
      // Verify new function appears
      const updatedCount = await page.$$eval('.function-item', items => items.length);
      expect(updatedCount).toBe(initialCount + 1);
      
      // Check that the new function is visible
      const functionNames = await page.$$eval('.function-name', names =>
        names.map(name => name.textContent)
      );
      expect(functionNames).toContain('newTestFunction');
    });

    test('should show update notifications', async () => {
      await page.goto(serverUrl);
      
      // Listen for update notifications
      const notifications = [];
      page.on('console', msg => {
        if (msg.text().includes('Documentation updated')) {
          notifications.push(msg.text());
        }
      });
      
      // Modify a file
      const testFile = path.join(tempProjectDir, 'backend/src/utils/helper.ts');
      const helperCode = `
        /**
         * Helper function updated during test
         */
        export function updatedHelper(): void {
          console.log('Updated helper function');
        }
      `;
      
      await fs.writeFile(testFile, helperCode);
      
      // Wait for notification
      await page.waitForFunction(
        () => document.querySelector('.update-notification'),
        { timeout: 10000 }
      );
      
      // Verify notification appears
      const notification = await page.$('.update-notification');
      expect(notification).toBeTruthy();
      
      const notificationText = await page.$eval('.update-notification', el => el.textContent);
      expect(notificationText).toContain('Documentation updated');
    });
  });

  describe('API Documentation', () => {
    test('should generate interactive API documentation', async () => {
      await page.goto(`${serverUrl}/api`);
      
      // Wait for API endpoints to load
      await page.waitForSelector('.api-endpoint');
      
      const endpoints = await page.$$('.api-endpoint');
      expect(endpoints.length).toBeGreaterThan(5);
      
      // Check endpoint details
      const endpointTitles = await page.$$eval('.endpoint-title', titles =>
        titles.map(title => title.textContent)
      );
      
      expect(endpointTitles.some(title => title.includes('GET /users'))).toBe(true);
      expect(endpointTitles.some(title => title.includes('POST /users'))).toBe(true);
      
      // Test endpoint expansion
      await page.click('.api-endpoint:first-child .endpoint-header');
      
      // Should show request/response details
      await page.waitForSelector('.endpoint-details');
      
      const details = await page.$('.endpoint-details');
      expect(details).toBeTruthy();
      
      // Should have example request/response
      const exampleRequest = await page.$('.example-request');
      const exampleResponse = await page.$('.example-response');
      
      expect(exampleRequest).toBeTruthy();
      expect(exampleResponse).toBeTruthy();
    });

    test('should provide OpenAPI specification download', async () => {
      await page.goto(`${serverUrl}/api`);
      
      // Find download button
      await page.waitForSelector('.download-openapi');
      
      // Set up download handling
      const downloadPromise = new Promise((resolve) => {
        page.on('response', async (response) => {
          if (response.url().includes('/openapi.json')) {
            const content = await response.text();
            resolve(JSON.parse(content));
          }
        });
      });
      
      // Click download button
      await page.click('.download-openapi');
      
      // Verify OpenAPI spec
      const openApiSpec = await downloadPromise;
      
      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info.title).toBe('Living Docs Demo');
      expect(openApiSpec.paths).toBeDefined();
      expect(Object.keys(openApiSpec.paths).length).toBeGreaterThan(5);
    });
  });

  describe('Architecture Visualization', () => {
    test('should display architecture diagrams', async () => {
      await page.goto(`${serverUrl}/architecture`);
      
      // Wait for diagrams to load
      await page.waitForSelector('.architecture-diagram');
      
      const diagrams = await page.$$('.architecture-diagram');
      expect(diagrams.length).toBeGreaterThan(0);
      
      // Check for dependency graph
      const dependencyGraph = await page.$('.dependency-graph');
      expect(dependencyGraph).toBeTruthy();
      
      // Check for component diagram
      const componentDiagram = await page.$('.component-diagram');
      expect(componentDiagram).toBeTruthy();
      
      // Test diagram interactivity
      const nodes = await page.$$('.diagram-node');
      if (nodes.length > 0) {
        await nodes[0].click();
        
        // Should highlight connected nodes
        const highlighted = await page.$$('.node-highlighted');
        expect(highlighted.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should load large documentation quickly', async () => {
      const startTime = Date.now();
      
      await page.goto(serverUrl);
      await page.waitForSelector('.documentation-container');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle concurrent users', async () => {
      // Create multiple browser contexts
      const contexts = await Promise.all([
        browser.createIncognitoBrowserContext(),
        browser.createIncognitoBrowserContext(),
        browser.createIncognitoBrowserContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      // Load documentation simultaneously
      const loadPromises = pages.map(async (testPage) => {
        const startTime = Date.now();
        await testPage.goto(serverUrl);
        await testPage.waitForSelector('.documentation-container');
        return Date.now() - startTime;
      });
      
      const loadTimes = await Promise.all(loadPromises);
      
      // All should load within reasonable time
      loadTimes.forEach(time => {
        expect(time).toBeLessThan(5000);
      });
      
      // Clean up
      await Promise.all(pages.map(testPage => testPage.close()));
      await Promise.all(contexts.map(context => context.close()));
    });
  });

  // Helper functions
  async function setupDemoProject(projectDir) {
    // Copy demo project files to temp directory
    const demoSourceDir = path.join(__dirname, '../../');
    
    // Create project structure
    const dirs = [
      'frontend/src/components',
      'frontend/src/services',
      'frontend/src/types',
      'backend/src/routes',
      'backend/src/services',
      'backend/src/types',
      'python-service/models',
      'python-service/services',
      'go-service'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }
    
    // Copy key demo files
    const filesToCopy = [
      'frontend/src/types/User.ts',
      'frontend/src/components/UserProfile.tsx',
      'frontend/src/services/userService.ts',
      'backend/src/types/User.ts',
      'backend/src/routes/users.ts',
      'backend/src/services/UserService.ts',
      'python-service/app.py',
      'python-service/models/user_analytics.py',
      'go-service/main.go',
      'go-service/types.go',
      'demo-config.json'
    ];
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(demoSourceDir, file);
      const destPath = path.join(projectDir, file);
      
      try {
        const content = await fs.readFile(sourcePath, 'utf8');
        await fs.writeFile(destPath, content);
      } catch (error) {
        // File might not exist, create a minimal version
        await createMinimalFile(destPath, file);
      }
    }
  }

  async function createMinimalFile(filePath, fileName) {
    const ext = path.extname(fileName);
    let content = '';
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        content = `// Minimal ${fileName} for testing\nexport function testFunction() { return true; }`;
        break;
      case '.py':
        content = `# Minimal ${fileName} for testing\ndef test_function():\n    return True`;
        break;
      case '.go':
        content = `// Minimal ${fileName} for testing\npackage main\n\nfunc TestFunction() bool {\n    return true\n}`;
        break;
      case '.json':
        content = '{"test": true}';
        break;
      default:
        content = `// Test file: ${fileName}`;
    }
    
    await fs.writeFile(filePath, content);
  }

  async function startDocumentationServer(projectDir, port) {
    return new Promise((resolve, reject) => {
      const serverScript = path.join(__dirname, '../../dist/server.js');
      const configPath = path.join(projectDir, 'demo-config.json');
      
      serverProcess = spawn('node', [serverScript, '--config', configPath, '--port', port], {
        cwd: projectDir,
        stdio: 'pipe'
      });
      
      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('Server started')) {
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
      
      serverProcess.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);
    });
  }

  async function waitForServer(url, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`${url}/health`);
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Server did not become ready');
  }
});
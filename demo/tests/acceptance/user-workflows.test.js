/**
 * User Acceptance Tests for Living Documentation Generator
 * 
 * Tests real user workflows and scenarios to validate that the system
 * meets user needs and provides a smooth experience for developers.
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

describe('User Acceptance Tests - Living Documentation Generator', () => {
  let browser;
  let page;
  const serverUrl = 'http://localhost:3000';
  const demoProjectPath = path.join(__dirname, '../../');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Run in visible mode for user acceptance testing
      slowMo: 100, // Slow down actions to simulate real user behavior
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Scenario 1: New Developer Onboarding', () => {
    test('A new developer can quickly understand the project structure', async () => {
      // User Story: As a new developer joining the team, I want to quickly 
      // understand the project structure and key components so I can start 
      // contributing effectively.
      
      await page.goto(serverUrl);
      
      // Should see clear project overview
      await page.waitForSelector('.project-overview');
      const overview = await page.$eval('.project-overview h1', el => el.textContent);
      expect(overview).toContain('Living Docs Demo');
      
      // Should see language breakdown
      const languages = await page.$$eval('.language-badge', badges => 
        badges.map(badge => badge.textContent.trim())
      );
      expect(languages).toContain('TypeScript');
      expect(languages).toContain('Python');
      expect(languages).toContain('Go');
      
      // Should see architecture diagram
      await page.click('.nav-link[href="/architecture"]');
      await page.waitForSelector('.architecture-diagram');
      
      const diagram = await page.$('.dependency-graph');
      expect(diagram).toBeTruthy();
      
      // Should be able to explore components
      const components = await page.$$('.component-node');
      expect(components.length).toBeGreaterThan(3);
      
      // Click on a component to see details
      await components[0].click();
      await page.waitForSelector('.component-details');
      
      const details = await page.$('.component-details');
      expect(details).toBeTruthy();
    });

    test('New developer can find and understand API endpoints', async () => {
      // User Story: As a new developer, I want to understand the available 
      // API endpoints and how to use them so I can integrate with the system.
      
      await page.goto(`${serverUrl}/api`);
      
      // Should see API overview
      await page.waitForSelector('.api-overview');
      
      // Should see grouped endpoints
      const endpointGroups = await page.$$('.endpoint-group');
      expect(endpointGroups.length).toBeGreaterThan(1);
      
      // Should see user management endpoints
      const userEndpoints = await page.$$eval('.endpoint-item', items =>
        items.filter(item => item.textContent.includes('/users')).length
      );
      expect(userEndpoints).toBeGreaterThan(2);
      
      // Click on an endpoint to see details
      await page.click('.endpoint-item:first-child');
      await page.waitForSelector('.endpoint-details');
      
      // Should see request/response examples
      const requestExample = await page.$('.example-request');
      const responseExample = await page.$('.example-response');
      
      expect(requestExample).toBeTruthy();
      expect(responseExample).toBeTruthy();
      
      // Should be able to copy examples
      const copyButton = await page.$('.copy-example');
      await copyButton.click();
      
      // Should show copy confirmation
      await page.waitForSelector('.copy-success', { timeout: 2000 });
    });
  });

  describe('Scenario 2: Active Development Workflow', () => {
    test('Developer can see real-time updates while coding', async () => {
      // User Story: As a developer actively working on code, I want to see 
      // documentation updates in real-time so I can verify my changes are 
      // properly documented.
      
      await page.goto(`${serverUrl}/functions`);
      
      // Count initial functions
      await page.waitForSelector('.function-item');
      const initialCount = await page.$$eval('.function-item', items => items.length);
      
      // Create a new function file
      const newFunctionFile = path.join(demoProjectPath, 'frontend/src/utils/newFeature.ts');
      const functionCode = `
        /**
         * Calculate user engagement score
         * @param sessions Number of user sessions
         * @param duration Average session duration
         * @returns Engagement score between 0 and 1
         */
        export function calculateEngagement(sessions: number, duration: number): number {
          if (sessions === 0) return 0;
          
          const sessionScore = Math.min(sessions / 10, 1);
          const durationScore = Math.min(duration / 300, 1);
          
          return (sessionScore + durationScore) / 2;
        }
        
        /**
         * Format engagement score for display
         * @param score Raw engagement score
         * @returns Formatted percentage string
         */
        export function formatEngagement(score: number): string {
          return \`\${Math.round(score * 100)}%\`;
        }
      `;
      
      await fs.writeFile(newFunctionFile, functionCode);
      
      // Wait for real-time update (should happen within 10 seconds)
      await page.waitForFunction(
        (expectedCount) => {
          const items = document.querySelectorAll('.function-item');
          return items.length > expectedCount;
        },
        { timeout: 15000 },
        initialCount
      );
      
      // Verify new functions appear
      const updatedCount = await page.$$eval('.function-item', items => items.length);
      expect(updatedCount).toBeGreaterThan(initialCount);
      
      // Should see the new functions
      const functionNames = await page.$$eval('.function-name', names =>
        names.map(name => name.textContent)
      );
      expect(functionNames).toContain('calculateEngagement');
      expect(functionNames).toContain('formatEngagement');
      
      // Clean up
      await fs.unlink(newFunctionFile);
    });

    test('Developer can search for specific functionality', async () => {
      // User Story: As a developer looking for specific functionality, I want 
      // to search across all documentation to quickly find what I need.
      
      await page.goto(serverUrl);
      
      // Use global search
      await page.waitForSelector('#global-search');
      await page.type('#global-search', 'user authentication');
      
      // Should see search suggestions
      await page.waitForSelector('.search-suggestions');
      const suggestions = await page.$$('.search-suggestion');
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Click on a suggestion
      await suggestions[0].click();
      
      // Should navigate to relevant documentation
      const url = page.url();
      expect(url).toMatch(/\/(functions|api|types)/);
      
      // Should highlight search terms
      const highlighted = await page.$$('.search-highlight');
      expect(highlighted.length).toBeGreaterThan(0);
      
      // Test advanced search
      await page.goto(`${serverUrl}/search`);
      
      // Filter by language
      await page.selectOption('#language-filter', 'typescript');
      
      // Filter by type
      await page.selectOption('#type-filter', 'function');
      
      // Search for specific term
      await page.fill('#search-input', 'create');
      await page.click('#search-button');
      
      // Should show filtered results
      await page.waitForSelector('.search-results');
      const results = await page.$$('.search-result');
      expect(results.length).toBeGreaterThan(0);
      
      // All results should be TypeScript functions
      const resultTypes = await page.$$eval('.result-type', types =>
        types.map(type => type.textContent)
      );
      resultTypes.forEach(type => {
        expect(type).toContain('function');
      });
    });
  });

  describe('Scenario 3: Code Review and Collaboration', () => {
    test('Reviewer can understand changes through documentation', async () => {
      // User Story: As a code reviewer, I want to see how code changes affect 
      // the documentation so I can better understand the impact of changes.
      
      await page.goto(`${serverUrl}/changes`);
      
      // Should see recent changes
      await page.waitForSelector('.recent-changes');
      
      const changes = await page.$$('.change-item');
      expect(changes.length).toBeGreaterThan(0);
      
      // Click on a change to see details
      await changes[0].click();
      await page.waitForSelector('.change-details');
      
      // Should see before/after comparison
      const beforeSection = await page.$('.before-content');
      const afterSection = await page.$('.after-content');
      
      expect(beforeSection).toBeTruthy();
      expect(afterSection).toBeTruthy();
      
      // Should highlight differences
      const additions = await page.$$('.diff-addition');
      const deletions = await page.$$('.diff-deletion');
      
      expect(additions.length + deletions.length).toBeGreaterThan(0);
    });

    test('Team member can share specific documentation sections', async () => {
      // User Story: As a team member, I want to share links to specific 
      // documentation sections so I can reference them in discussions.
      
      await page.goto(`${serverUrl}/functions`);
      
      // Find a function
      await page.waitForSelector('.function-item');
      await page.click('.function-item:first-child');
      
      // Should see share button
      const shareButton = await page.$('.share-button');
      expect(shareButton).toBeTruthy();
      
      await shareButton.click();
      
      // Should show share options
      await page.waitForSelector('.share-options');
      
      // Should be able to copy link
      const copyLinkButton = await page.$('.copy-link');
      await copyLinkButton.click();
      
      // Should show copy confirmation
      await page.waitForSelector('.copy-success');
      
      // Should be able to generate markdown snippet
      const markdownButton = await page.$('.generate-markdown');
      await markdownButton.click();
      
      await page.waitForSelector('.markdown-snippet');
      const snippet = await page.$eval('.markdown-snippet textarea', el => el.value);
      
      expect(snippet).toContain('```');
      expect(snippet).toContain('function');
    });
  });

  describe('Scenario 4: Documentation Maintenance', () => {
    test('Maintainer can customize documentation appearance', async () => {
      // User Story: As a documentation maintainer, I want to customize the 
      // appearance and organization of documentation to match our team standards.
      
      await page.goto(`${serverUrl}/settings`);
      
      // Should see customization options
      await page.waitForSelector('.customization-panel');
      
      // Test theme customization
      const themeSelect = await page.$('#theme-select');
      await themeSelect.selectOption('dark');
      
      // Should apply theme immediately
      const body = await page.$('body');
      const theme = await body.getAttribute('data-theme');
      expect(theme).toBe('dark');
      
      // Test layout options
      const layoutSelect = await page.$('#layout-select');
      await layoutSelect.selectOption('compact');
      
      // Should update layout
      await page.waitForSelector('.layout-compact');
      
      // Test custom CSS
      const customCssTextarea = await page.$('#custom-css');
      await customCssTextarea.fill('.custom-style { color: red; }');
      
      const applyButton = await page.$('#apply-styles');
      await applyButton.click();
      
      // Should apply custom styles
      await page.waitForSelector('style[data-custom]');
    });

    test('Maintainer can configure documentation sections', async () => {
      // User Story: As a documentation maintainer, I want to configure which 
      // sections are included and how they're organized.
      
      await page.goto(`${serverUrl}/admin/configuration`);
      
      // Should see section configuration
      await page.waitForSelector('.section-config');
      
      // Should be able to toggle sections
      const sectionToggles = await page.$$('.section-toggle');
      expect(sectionToggles.length).toBeGreaterThan(3);
      
      // Disable a section
      await sectionToggles[0].click();
      
      // Should update preview
      await page.waitForSelector('.config-preview');
      
      // Should be able to reorder sections
      const dragHandle = await page.$('.drag-handle');
      const dropZone = await page.$('.drop-zone:nth-child(3)');
      
      await page.dragAndDrop(dragHandle, dropZone);
      
      // Should update order in preview
      const sectionOrder = await page.$$eval('.preview-section', sections =>
        sections.map(section => section.getAttribute('data-section'))
      );
      
      expect(sectionOrder.length).toBeGreaterThan(2);
      
      // Save configuration
      const saveButton = await page.$('#save-config');
      await saveButton.click();
      
      // Should show save confirmation
      await page.waitForSelector('.save-success');
    });
  });

  describe('Scenario 5: Integration and Deployment', () => {
    test('DevOps engineer can integrate with CI/CD pipeline', async () => {
      // User Story: As a DevOps engineer, I want to integrate documentation 
      // generation into our CI/CD pipeline so documentation stays current 
      // with deployments.
      
      await page.goto(`${serverUrl}/admin/integration`);
      
      // Should see integration options
      await page.waitForSelector('.integration-panel');
      
      // Should see CI/CD configuration
      const cicdSection = await page.$('.cicd-config');
      expect(cicdSection).toBeTruthy();
      
      // Should provide configuration examples
      const configExamples = await page.$$('.config-example');
      expect(configExamples.length).toBeGreaterThan(2);
      
      // Should be able to generate webhook URL
      const generateWebhookButton = await page.$('#generate-webhook');
      await generateWebhookButton.click();
      
      await page.waitForSelector('.webhook-url');
      const webhookUrl = await page.$eval('.webhook-url input', el => el.value);
      
      expect(webhookUrl).toMatch(/^https?:\/\/.+\/webhook\/.+$/);
      
      // Should be able to test webhook
      const testWebhookButton = await page.$('#test-webhook');
      await testWebhookButton.click();
      
      await page.waitForSelector('.webhook-test-result');
      const testResult = await page.$eval('.webhook-test-result', el => el.textContent);
      
      expect(testResult).toContain('success');
    });

    test('User can export documentation for offline use', async () => {
      // User Story: As a user, I want to export documentation for offline 
      // use or integration with other systems.
      
      await page.goto(`${serverUrl}/export`);
      
      // Should see export options
      await page.waitForSelector('.export-panel');
      
      // Should offer multiple formats
      const formatOptions = await page.$$eval('.format-option', options =>
        options.map(option => option.textContent)
      );
      
      expect(formatOptions).toContain('PDF');
      expect(formatOptions).toContain('Static HTML');
      expect(formatOptions).toContain('Markdown');
      expect(formatOptions).toContain('JSON');
      
      // Test PDF export
      await page.click('#format-pdf');
      await page.click('#export-button');
      
      // Should show export progress
      await page.waitForSelector('.export-progress');
      
      // Should complete export
      await page.waitForSelector('.export-complete', { timeout: 30000 });
      
      // Should provide download link
      const downloadLink = await page.$('.download-link');
      expect(downloadLink).toBeTruthy();
      
      const downloadUrl = await downloadLink.getAttribute('href');
      expect(downloadUrl).toMatch(/\.pdf$/);
    });
  });

  describe('Scenario 6: Performance and Reliability', () => {
    test('Documentation loads quickly for large projects', async () => {
      // User Story: As a user working with large projects, I want documentation 
      // to load quickly and remain responsive.
      
      const startTime = Date.now();
      
      await page.goto(serverUrl);
      await page.waitForSelector('.documentation-container');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Should be responsive to interactions
      const searchStart = Date.now();
      
      await page.type('#global-search', 'test query');
      await page.waitForSelector('.search-suggestions');
      
      const searchTime = Date.now() - searchStart;
      
      // Search should respond within 1 second
      expect(searchTime).toBeLessThan(1000);
    });

    test('System handles errors gracefully', async () => {
      // User Story: As a user, I want the system to handle errors gracefully 
      // and provide helpful feedback when things go wrong.
      
      // Test network error handling
      await page.setOfflineMode(true);
      
      await page.goto(serverUrl);
      
      // Should show offline message
      await page.waitForSelector('.offline-message');
      const offlineMessage = await page.$eval('.offline-message', el => el.textContent);
      
      expect(offlineMessage).toContain('offline');
      
      // Should provide retry option
      const retryButton = await page.$('.retry-button');
      expect(retryButton).toBeTruthy();
      
      // Restore connection
      await page.setOfflineMode(false);
      
      await retryButton.click();
      
      // Should recover and load normally
      await page.waitForSelector('.documentation-container');
      
      // Test malformed data handling
      await page.goto(`${serverUrl}/api/invalid-endpoint`);
      
      // Should show user-friendly error
      await page.waitForSelector('.error-message');
      const errorMessage = await page.$eval('.error-message', el => el.textContent);
      
      expect(errorMessage).not.toContain('500');
      expect(errorMessage).not.toContain('Internal Server Error');
      expect(errorMessage).toContain('not found');
    });
  });
});
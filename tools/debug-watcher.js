#!/usr/bin/env node

/**
 * Debug script to test file watcher functionality directly
 */

const { FileWatcher } = require('../dist/watcher.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function debugWatcher() {
  console.log('Debugging file watcher...');
  
  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-watcher-'));
  console.log(`Created temp directory: ${tempDir}`);
  
  const config = {
    projectPath: tempDir,
    watchDebounceMs: 100,
    includePatterns: ['**/*.ts', '**/*.js'],
    excludePatterns: [],
  };
  
  const watcher = new FileWatcher(config);
  
  let changeCount = 0;
  
  watcher.on('ready', () => {
    console.log('✅ Watcher ready');
  });
  
  watcher.on('fileChanged', (change) => {
    changeCount++;
    console.log(`📁 File change detected (#${changeCount}):`, {
      path: change.path,
      type: change.type,
      timestamp: new Date(change.timestamp).toISOString(),
    });
  });
  
  watcher.on('changes', (changes) => {
    console.log(`📦 Batch of ${changes.length} changes processed`);
  });
  
  watcher.on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });
  
  try {
    console.log('Starting watcher...');
    await watcher.startWatching();
    
    console.log('Creating test file...');
    const testFile = path.join(tempDir, 'test.ts');
    fs.writeFileSync(testFile, 'export const hello = "world";');
    
    // Wait for change detection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Modifying test file...');
    fs.writeFileSync(testFile, 'export const hello = "modified";');
    
    // Wait for change detection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Deleting test file...');
    fs.unlinkSync(testFile);
    
    // Wait for change detection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Total changes detected: ${changeCount}`);
    
    await watcher.stopWatching();
    console.log('✅ Watcher stopped');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up temp directory');
  }
}

debugWatcher().catch(console.error);
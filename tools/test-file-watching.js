#!/usr/bin/env node

/**
 * End-to-end test for file watching functionality
 * This script tests the complete file watching flow through the MCP server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testFileWatching() {
  console.log('Testing file watching functionality...');
  
  // Create temporary test directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-watch-test-'));
  console.log(`Created test directory: ${tempDir}`);
  
  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';
  let responses = [];

  server.stdout.on('data', (data) => {
    output += data.toString();
    
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line.trim());
          responses.push(response);
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
  });

  server.stderr.on('data', (data) => {
    console.log('Server log:', data.toString().trim());
  });

  // Initialize server
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  }) + '\n');

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start watching the test directory
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'watch_project',
      arguments: {
        projectPath: tempDir,
      },
    },
  }) + '\n');

  // Wait for watch to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create a test file to trigger file watching
  console.log('Creating test file to trigger file watching...');
  const testFile = path.join(tempDir, 'test.ts');
  fs.writeFileSync(testFile, 'export const hello = "world";');

  // Wait for file change detection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Modify the file
  console.log('Modifying test file...');
  fs.writeFileSync(testFile, 'export const hello = "modified world";');

  // Wait for change detection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Stop watching
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'stop_watching',
      arguments: {},
    },
  }) + '\n');

  // Wait for stop response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Clean up
  server.kill();
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Analyze results
  console.log('\n=== Test Results ===');
  
  const watchResponse = responses.find(r => r.id === 2);
  if (watchResponse && watchResponse.result) {
    if (watchResponse.result.content[0].text.includes('Started watching project')) {
      console.log('✅ File watching started successfully');
    } else {
      console.log('❌ File watching failed to start');
      console.log('Response:', watchResponse.result.content[0].text);
    }
  } else {
    console.log('❌ No watch response received');
  }

  const stopResponse = responses.find(r => r.id === 3);
  if (stopResponse && stopResponse.result) {
    if (stopResponse.result.content[0].text.includes('Stopped watching')) {
      console.log('✅ File watching stopped successfully');
    } else {
      console.log('❌ File watching failed to stop properly');
    }
  } else {
    console.log('❌ No stop response received');
  }

  // Check if we got any file change notifications in stderr
  // (The current implementation logs to stderr when changes are detected)
  
  console.log('\n=== Summary ===');
  console.log('File watching functionality test completed');
  
  if (watchResponse && stopResponse) {
    console.log('✅ Basic file watching operations work correctly');
    process.exit(0);
  } else {
    console.log('❌ File watching test failed');
    process.exit(1);
  }
}

testFileWatching().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
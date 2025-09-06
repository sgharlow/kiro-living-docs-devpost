#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server can start
 * This simulates what Kiro would do when connecting to the server
 */

const { spawn } = require('child_process');
const path = require('path');

async function testServer() {
  console.log('Testing MCP server startup...');
  
  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  
  // Start the server process
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';
  let errorOutput = '';

  server.stdout.on('data', (data) => {
    output += data.toString();
  });

  server.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  // Send a simple MCP initialization message
  const initMessage = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    },
  }) + '\n';

  server.stdin.write(initMessage);

  // Wait for response or timeout
  setTimeout(() => {
    server.kill();
    
    console.log('Server stderr output:', errorOutput);
    console.log('Server stdout output:', output);
    
    if (errorOutput.includes('Living Documentation Generator MCP Server started')) {
      console.log('✅ Server started successfully!');
      process.exit(0);
    } else {
      console.log('❌ Server failed to start properly');
      process.exit(1);
    }
  }, 3000);

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

testServer().catch(console.error);
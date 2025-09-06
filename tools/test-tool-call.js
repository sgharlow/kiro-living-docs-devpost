#!/usr/bin/env node

/**
 * Test script to verify MCP tool calls work correctly
 */

const { spawn } = require('child_process');
const path = require('path');

async function testToolCall() {
  console.log('Testing MCP tool call...');
  
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
    console.log('Server started:', data.toString());
  });

  // Initialize
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

  // Wait then call generate_docs tool
  setTimeout(() => {
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'generate_docs',
        arguments: {
          projectPath: '/test/project',
          outputFormat: 'markdown',
        },
      },
    }) + '\n');
  }, 1000);

  // Check results
  setTimeout(() => {
    server.kill();
    
    const toolResponse = responses.find(r => r.id === 2);
    if (toolResponse && toolResponse.result) {
      console.log('✅ Tool call successful!');
      console.log('Response:', toolResponse.result.content[0].text);
      
      // Verify it's a placeholder response as expected
      if (toolResponse.result.content[0].text.includes('placeholder response')) {
        console.log('✅ Placeholder response received as expected');
        process.exit(0);
      } else {
        console.log('❌ Unexpected response content');
        process.exit(1);
      }
    } else {
      console.log('❌ No tool response received');
      console.log('All responses:', JSON.stringify(responses, null, 2));
      process.exit(1);
    }
  }, 3000);

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

testToolCall().catch(console.error);
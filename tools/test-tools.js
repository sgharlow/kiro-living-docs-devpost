#!/usr/bin/env node

/**
 * Test script to verify MCP tools are properly registered
 */

const { spawn } = require('child_process');
const path = require('path');

async function testTools() {
  console.log('Testing MCP tool registration...');
  
  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let output = '';
  let responses = [];

  server.stdout.on('data', (data) => {
    output += data.toString();
    
    // Parse JSON responses
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

  // Initialize the server
  const initMessage = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  }) + '\n';

  server.stdin.write(initMessage);

  // Wait for initialization, then request tools
  setTimeout(() => {
    const toolsMessage = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }) + '\n';

    server.stdin.write(toolsMessage);
  }, 1000);

  // Check results after delay
  setTimeout(() => {
    server.kill();
    
    console.log('Responses received:', responses.length);
    
    const toolsResponse = responses.find(r => r.id === 2);
    if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
      const tools = toolsResponse.result.tools;
      console.log(`✅ Found ${tools.length} tools:`);
      tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      
      // Verify expected tools
      const expectedTools = ['generate_docs', 'watch_project', 'stop_watching'];
      const foundTools = tools.map(t => t.name);
      const allFound = expectedTools.every(tool => foundTools.includes(tool));
      
      if (allFound) {
        console.log('✅ All expected tools are registered!');
        process.exit(0);
      } else {
        console.log('❌ Missing expected tools');
        process.exit(1);
      }
    } else {
      console.log('❌ No tools response received');
      console.log('All responses:', JSON.stringify(responses, null, 2));
      process.exit(1);
    }
  }, 3000);

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

testTools().catch(console.error);
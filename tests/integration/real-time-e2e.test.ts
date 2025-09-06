/**
 * End-to-end tests for real-time documentation synchronization
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocket } from 'ws';
import { WebServer, WebServerConfig } from '../../src/web/web-server.js';
import { RealTimeSyncManager } from '../../src/sync/real-time-sync.js';
import { ProjectAnalysis, FileChange } from '../../src/types.js';

// Helper class to simulate a documentation client
class TestDocumentationClient {
  private ws: WebSocket | null = null;
  private messages: any[] = [];
  private isConnected = false;

  constructor(private port: number) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);
      
      this.ws.on('open', () => {
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.messages.push(message);
      });

      this.ws.on('error', reject);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  getMessages(): any[] {
    return [...this.messages];
  }

  getLastMessage(): any {
    return this.messages[this.messages.length - 1];
  }

  clearMessages(): void {
    this.messages = [];
  }

  waitForMessage(type: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForMessage = () => {
        const message = this.messages.find(msg => msg.type === type);
        if (message) {
          resolve(message);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for message type: ${type}`));
          return;
        }

        setTimeout(checkForMessage, 100);
      };

      checkForMessage();
    });
  }

  waitForConflict(filePath: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForConflict = () => {
        const conflictMessage = this.messages.find(msg => 
          msg.type === 'conflict' && 
          msg.data.action === 'detected' &&
          msg.data.conflict.filePath === filePath
        );
        
        if (conflictMessage) {
          resolve(conflictMessage.data.conflict);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for conflict in: ${filePath}`));
          return;
        }

        setTimeout(checkForConflict, 100);
      };

      checkForConflict();
    });
  }
}

describe('Real-Time Documentation Synchronization E2E', () => {
  let webServer: WebServer;
  // let syncManager: RealTimeSyncManager;
  let client1: TestDocumentationClient;
  let client2: TestDocumentationClient;
  let serverPort: number;

  const mockAnalysis: ProjectAnalysis = {
    metadata: {
      name: 'e2e-test-project',
      version: '1.0.0',
      description: 'End-to-end test project',
      languages: ['typescript']
    },
    structure: {
      directories: ['src', 'tests'],
      files: ['src/index.ts', 'src/utils.ts'],
      entryPoints: ['src/index.ts'],
      testFiles: ['tests/index.test.ts'],
      configFiles: ['package.json']
    },
    files: new Map([
      ['src/index.ts', {
        functions: [{
          name: 'main',
          parameters: [],
          returnType: 'void',
          isAsync: false,
          isExported: true,
          startLine: 1,
          endLine: 5
        }],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        comments: [],
        todos: [],
        apiEndpoints: []
      }]
    ]),
    lastUpdated: new Date()
  };

  beforeEach(async () => {
    const config: WebServerConfig = {
      port: 0, // Use random available port
      host: 'localhost',
      enableSearch: true
    };

    webServer = new WebServer(config);
    await webServer.start();

    serverPort = (webServer as any).server.address()?.port;
    // syncManager = webServer.getSyncManager();

    client1 = new TestDocumentationClient(serverPort);
    client2 = new TestDocumentationClient(serverPort);
  });

  afterEach(async () => {
    client1.disconnect();
    client2.disconnect();
    await webServer.stop();
  });

  describe('Basic Real-Time Updates', () => {
    it('should synchronize documentation updates across multiple clients', async () => {
      // Connect clients
      await client1.connect();
      await client2.connect();

      // Clear initial messages
      client1.clearMessages();
      client2.clearMessages();

      // Update documentation
      webServer.updateDocumentation(mockAnalysis);

      // Both clients should receive the update
      const update1 = await client1.waitForMessage('update');
      const update2 = await client2.waitForMessage('update');

      expect(update1.data.analysis.metadata.name).toBe('e2e-test-project');
      expect(update2.data.analysis.metadata.name).toBe('e2e-test-project');
    });

    it('should handle file changes in real-time', async () => {
      await client1.connect();
      client1.clearMessages();

      const fileChange: FileChange = {
        path: 'src/new-feature.ts',
        type: 'added',
        timestamp: Date.now(),
        content: 'export const newFeature = () => "hello world";'
      };

      webServer.processFileChange(fileChange);

      // Client should receive update notification
      const updateMessage = await client1.waitForMessage('update');
      expect(updateMessage.data.update.filePath).toBe('src/new-feature.ts');
      expect(updateMessage.data.update.type).toBe('file');
    });

    it('should maintain update order across clients', async () => {
      await client1.connect();
      await client2.connect();

      client1.clearMessages();
      client2.clearMessages();

      // Send multiple updates in sequence
      const updates = [
        { path: 'src/file1.ts', content: 'console.log("file1");' },
        { path: 'src/file2.ts', content: 'console.log("file2");' },
        { path: 'src/file3.ts', content: 'console.log("file3");' }
      ];

      for (const update of updates) {
        const fileChange: FileChange = {
          path: update.path,
          type: 'modified',
          timestamp: Date.now(),
          content: update.content
        };
        webServer.processFileChange(fileChange);
        
        // Small delay to ensure order
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for all updates to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      const client1Updates = client1.getMessages().filter(msg => msg.type === 'update');
      const client2Updates = client2.getMessages().filter(msg => msg.type === 'update');

      expect(client1Updates.length).toBe(3);
      expect(client2Updates.length).toBe(3);

      // Check order is maintained
      for (let i = 0; i < 3; i++) {
        expect(client1Updates[i].data.update.filePath).toBe(`src/file${i + 1}.ts`);
        expect(client2Updates[i].data.update.filePath).toBe(`src/file${i + 1}.ts`);
      }
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect and notify clients of conflicts', async () => {
      await client1.connect();
      await client2.connect();

      client1.clearMessages();
      client2.clearMessages();

      const filePath = 'src/conflict-test.ts';

      // Create automatic update
      const autoChange: FileChange = {
        path: filePath,
        type: 'modified',
        timestamp: Date.now(),
        content: 'console.log("automatic update");'
      };

      webServer.processFileChange(autoChange);

      // Create manual update shortly after
      setTimeout(() => {
        webServer.handleManualUpdate(filePath, 'console.log("manual update");');
      }, 100);

      // Both clients should receive conflict notification
      const conflict1 = await client1.waitForConflict(filePath);
      const conflict2 = await client2.waitForConflict(filePath);

      expect(conflict1.filePath).toBe(filePath);
      expect(conflict1.autoContent).toContain('automatic update');
      expect(conflict1.manualContent).toContain('manual update');

      expect(conflict2.id).toBe(conflict1.id);
    });

    it('should resolve conflicts and notify all clients', async () => {
      await client1.connect();
      await client2.connect();

      const filePath = 'src/resolve-test.ts';

      // Create conflict
      const autoChange: FileChange = {
        path: filePath,
        type: 'modified',
        timestamp: Date.now(),
        content: 'console.log("auto");'
      };

      webServer.processFileChange(autoChange);
      webServer.handleManualUpdate(filePath, 'console.log("manual");');

      // Wait for conflict detection
      const conflict = await client1.waitForConflict(filePath);

      client1.clearMessages();
      client2.clearMessages();

      // Resolve conflict using client1
      client1.send({
        type: 'conflict',
        data: {
          action: 'resolve',
          conflictId: conflict.id,
          resolution: 'auto'
        }
      });

      // Both clients should receive resolution notification
      const resolution1 = await client1.waitForMessage('conflict');
      const resolution2 = await client2.waitForMessage('conflict');

      expect(resolution1.data.action).toBe('resolved');
      expect(resolution1.data.resolution).toBe('auto');
      expect(resolution2.data.conflictId).toBe(conflict.id);
    });

    it('should handle merge resolution with custom content', async () => {
      await client1.connect();

      const filePath = 'src/merge-test.ts';

      // Create conflict
      const autoChange: FileChange = {
        path: filePath,
        type: 'modified',
        timestamp: Date.now(),
        content: 'console.log("auto");'
      };

      webServer.processFileChange(autoChange);
      webServer.handleManualUpdate(filePath, 'console.log("manual");');

      const conflict = await client1.waitForConflict(filePath);

      client1.clearMessages();

      const mergedContent = 'console.log("merged solution");';

      // Resolve with merge
      client1.send({
        type: 'conflict',
        data: {
          action: 'resolve',
          conflictId: conflict.id,
          resolution: 'merge',
          mergedContent
        }
      });

      const resolution = await client1.waitForMessage('conflict');

      expect(resolution.data.action).toBe('resolved');
      expect(resolution.data.resolution).toBe('merge');
      expect(resolution.data.update.content).toBe(mergedContent);
    });
  });

  describe('Client Connection Management', () => {
    it('should handle client disconnections gracefully', async () => {
      await client1.connect();
      await client2.connect();

      expect(webServer.getClientCount()).toBe(2);

      // Disconnect one client
      client1.disconnect();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(webServer.getClientCount()).toBe(1);

      // Remaining client should still receive updates
      client2.clearMessages();
      webServer.updateDocumentation(mockAnalysis);

      const update = await client2.waitForMessage('update');
      expect(update.data.analysis.metadata.name).toBe('e2e-test-project');
    });

    it('should handle client reconnections', async () => {
      await client1.connect();
      expect(webServer.getClientCount()).toBe(1);

      // Disconnect and reconnect
      client1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(webServer.getClientCount()).toBe(0);

      await client1.connect();
      expect(webServer.getClientCount()).toBe(1);

      // Should receive status message on reconnection
      const statusMessage = client1.getMessages().find(msg => msg.type === 'status');
      expect(statusMessage).toBeDefined();
    });

    it('should handle heartbeat communication', async () => {
      await client1.connect();
      client1.clearMessages();

      // Send heartbeat
      client1.send({
        type: 'heartbeat',
        data: { ping: true }
      });

      // Should receive pong response
      const response = await client1.waitForMessage('heartbeat');
      expect(response.data.pong).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency updates efficiently', async () => {
      await client1.connect();
      client1.clearMessages();

      const startTime = Date.now();
      const updateCount = 20;

      // Generate rapid updates
      for (let i = 0; i < updateCount; i++) {
        const fileChange: FileChange = {
          path: `src/rapid-${i}.ts`,
          type: 'modified',
          timestamp: Date.now(),
          content: `export const func${i} = () => ${i};`
        };
        webServer.processFileChange(fileChange);
      }

      // Wait for all updates to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);

      const updateMessages = client1.getMessages().filter(msg => msg.type === 'update');
      expect(updateMessages.length).toBe(updateCount);
    });

    it('should maintain performance with multiple clients', async () => {
      const clients = [client1, client2];
      
      // Connect multiple clients
      for (const client of clients) {
        await client.connect();
        client.clearMessages();
      }

      expect(webServer.getClientCount()).toBe(2);

      const startTime = Date.now();

      // Generate updates
      for (let i = 0; i < 10; i++) {
        const fileChange: FileChange = {
          path: `src/multi-client-${i}.ts`,
          type: 'modified',
          timestamp: Date.now(),
          content: `export const multiFunc${i} = () => ${i};`
        };
        webServer.processFileChange(fileChange);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete efficiently even with multiple clients
      expect(duration).toBeLessThan(3000);

      // All clients should receive all updates
      for (const client of clients) {
        const updateMessages = client.getMessages().filter(msg => msg.type === 'update');
        expect(updateMessages.length).toBe(10);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary network issues', async () => {
      await client1.connect();
      client1.clearMessages();

      // Simulate network issue by closing connection abruptly
      (client1 as any).ws.terminate();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(webServer.getClientCount()).toBe(0);

      // Reconnect
      await client1.connect();
      expect(webServer.getClientCount()).toBe(1);

      // Should work normally after reconnection
      webServer.updateDocumentation(mockAnalysis);
      const update = await client1.waitForMessage('update');
      expect(update.data.analysis.metadata.name).toBe('e2e-test-project');
    });

    it('should handle malformed client messages gracefully', async () => {
      await client1.connect();

      // Send malformed message
      (client1 as any).ws.send('invalid json');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Connection should still be active
      expect(webServer.getClientCount()).toBe(1);

      // Normal messages should still work
      client1.send({
        type: 'heartbeat',
        data: { ping: true }
      });

      const response = await client1.waitForMessage('heartbeat');
      expect(response.data.pong).toBe(true);
    });

    it('should continue operating after sync manager errors', async () => {
      await client1.connect();

      // Try to resolve non-existent conflict (should not crash)
      client1.send({
        type: 'conflict',
        data: {
          action: 'resolve',
          conflictId: 'non-existent',
          resolution: 'auto'
        }
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Server should still be operational
      expect(webServer.isRunning()).toBe(true);
      expect(webServer.getClientCount()).toBe(1);

      // Normal operations should continue
      webServer.updateDocumentation(mockAnalysis);
      const update = await client1.waitForMessage('update');
      expect(update.data.analysis.metadata.name).toBe('e2e-test-project');
    });
  });

  describe('Status and Monitoring', () => {
    it('should provide accurate real-time status', async () => {
      await client1.connect();

      // Request status
      client1.send({
        type: 'status',
        data: {}
      });

      const statusResponse = await client1.waitForMessage('status');
      
      expect(statusResponse.data).toHaveProperty('connected');
      expect(statusResponse.data).toHaveProperty('queueSize');
      expect(statusResponse.data).toHaveProperty('conflicts');
      expect(statusResponse.data).toHaveProperty('latency');
      expect(statusResponse.data).toHaveProperty('updateRate');
    });

    it('should track queue status accurately', async () => {
      await client1.connect();
      client1.clearMessages();

      // Generate some updates
      for (let i = 0; i < 3; i++) {
        const fileChange: FileChange = {
          path: `src/queue-test-${i}.ts`,
          type: 'modified',
          timestamp: Date.now(),
          content: `export const queueFunc${i} = () => ${i};`
        };
        webServer.processFileChange(fileChange);
      }

      // Should receive queue status updates
      const queueMessage = await client1.waitForMessage('queue');
      expect(queueMessage.data.size).toBeGreaterThan(0);
      expect(typeof queueMessage.data.processing).toBe('boolean');
      expect(typeof queueMessage.data.conflicts).toBe('number');
      expect(typeof queueMessage.data.updateRate).toBe('number');
    });
  });
});
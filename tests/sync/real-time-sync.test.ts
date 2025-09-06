/**
 * Integration tests for real-time documentation synchronization
 */

import { RealTimeSyncManager, SyncMessage, DocumentUpdate } from '../../src/sync/real-time-sync.js';
import { FileChange, ProjectAnalysis } from '../../src/types.js';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = 1; // WebSocket.OPEN
  public messages: string[] = [];
  public onMessage: ((data: Buffer) => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: Error) => void) | null = null;

  send(data: string): void {
    this.messages.push(data);
  }

  close(): void {
    this.readyState = 3; // WebSocket.CLOSED
    if (this.onClose) {
      this.onClose();
    }
  }

  simulateMessage(message: any): void {
    if (this.onMessage) {
      this.onMessage(Buffer.from(JSON.stringify(message)));
    }
  }

  simulateError(error: Error): void {
    if (this.onError) {
      this.onError(error);
    }
  }

  on(event: string, handler: any): void {
    switch (event) {
      case 'message':
        this.onMessage = handler;
        break;
      case 'close':
        this.onClose = handler;
        break;
      case 'error':
        this.onError = handler;
        break;
    }
  }

  getLastMessage(): any {
    const lastMessage = this.messages[this.messages.length - 1];
    return lastMessage ? JSON.parse(lastMessage) : null;
  }

  getAllMessages(): any[] {
    return this.messages.map(msg => JSON.parse(msg));
  }

  clearMessages(): void {
    this.messages = [];
  }
}

describe('RealTimeSyncManager', () => {
  let syncManager: RealTimeSyncManager;
  let mockClient1: MockWebSocket;
  let mockClient2: MockWebSocket;

  beforeEach(() => {
    syncManager = new RealTimeSyncManager();
    mockClient1 = new MockWebSocket();
    mockClient2 = new MockWebSocket();
  });

  afterEach(() => {
    syncManager.reset();
  });

  describe('Client Management', () => {
    it('should register and unregister clients', () => {
      const clientConnectedSpy = jest.fn();
      const clientDisconnectedSpy = jest.fn();

      syncManager.on('client-connected', clientConnectedSpy);
      syncManager.on('client-disconnected', clientDisconnectedSpy);

      // Register clients
      syncManager.registerClient('client1', mockClient1 as any);
      syncManager.registerClient('client2', mockClient2 as any);

      expect(clientConnectedSpy).toHaveBeenCalledTimes(2);
      expect(clientConnectedSpy).toHaveBeenCalledWith({ clientId: 'client1', clientCount: 1 });
      expect(clientConnectedSpy).toHaveBeenCalledWith({ clientId: 'client2', clientCount: 2 });

      // Check status messages were sent
      expect(mockClient1.getLastMessage().type).toBe('status');
      expect(mockClient2.getLastMessage().type).toBe('status');

      // Unregister client
      syncManager.unregisterClient('client1');

      expect(clientDisconnectedSpy).toHaveBeenCalledWith({ clientId: 'client1', clientCount: 1 });
    });

    it('should handle client disconnection automatically', () => {
      const clientDisconnectedSpy = jest.fn();
      syncManager.on('client-disconnected', clientDisconnectedSpy);

      syncManager.registerClient('client1', mockClient1 as any);
      
      // Simulate client disconnect
      mockClient1.close();

      expect(clientDisconnectedSpy).toHaveBeenCalledWith({ clientId: 'client1', clientCount: 0 });
    });

    it('should handle client errors gracefully', () => {
      const clientDisconnectedSpy = jest.fn();
      syncManager.on('client-disconnected', clientDisconnectedSpy);

      syncManager.registerClient('client1', mockClient1 as any);
      
      // Simulate client error
      mockClient1.simulateError(new Error('Connection lost'));

      expect(clientDisconnectedSpy).toHaveBeenCalledWith({ clientId: 'client1', clientCount: 0 });
    });
  });

  describe('Update Queue Management', () => {
    beforeEach(() => {
      syncManager.registerClient('client1', mockClient1 as any);
      syncManager.registerClient('client2', mockClient2 as any);
      mockClient1.clearMessages();
      mockClient2.clearMessages();
    });

    it('should queue and process updates', async () => {
      const updateProcessedSpy = jest.fn();
      syncManager.on('update-processed', updateProcessedSpy);

      const update: DocumentUpdate = {
        id: 'update1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("updated");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'abc123'
      };

      syncManager.queueUpdate(update);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(updateProcessedSpy).toHaveBeenCalledWith({ update });

      // Check that clients received the update
      const client1Messages = mockClient1.getAllMessages();
      const client2Messages = mockClient2.getAllMessages();

      expect(client1Messages.some(msg => msg.type === 'update')).toBe(true);
      expect(client2Messages.some(msg => msg.type === 'update')).toBe(true);
    });

    it('should handle queue overflow gracefully', () => {
      // Fill queue beyond capacity
      for (let i = 0; i < 150; i++) {
        const update: DocumentUpdate = {
          id: `update${i}`,
          type: 'file',
          filePath: `src/test${i}.ts`,
          content: `console.log("update ${i}");`,
          timestamp: Date.now(),
          source: 'auto',
          checksum: `hash${i}`
        };
        syncManager.queueUpdate(update);
      }

      const status = syncManager.getStatus();
      expect(status.queueSize).toBeLessThanOrEqual(100);
    });

    it('should broadcast queue status updates', () => {
      const update: DocumentUpdate = {
        id: 'update1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("test");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'abc123'
      };

      syncManager.queueUpdate(update);

      // Check that queue status was broadcast
      const queueMessages = mockClient1.getAllMessages().filter(msg => msg.type === 'queue');
      expect(queueMessages.length).toBeGreaterThan(0);
      expect(queueMessages[0].data.size).toBe(1);
    });
  });

  describe('File Change Processing', () => {
    beforeEach(() => {
      syncManager.registerClient('client1', mockClient1 as any);
      mockClient1.clearMessages();
    });

    it('should process file changes and create updates', () => {
      const fileChange: FileChange = {
        path: 'src/example.ts',
        type: 'modified',
        timestamp: Date.now(),
        content: 'export function hello() { return "world"; }'
      };

      const mockAnalysis: ProjectAnalysis = {
        metadata: { name: 'test', languages: ['typescript'] },
        structure: { directories: [], files: [], entryPoints: [], testFiles: [], configFiles: [] },
        files: new Map(),
        lastUpdated: new Date()
      };

      syncManager.processFileChange(fileChange, mockAnalysis);

      const status = syncManager.getStatus();
      expect(status.queueSize).toBe(1);
    });

    it('should handle manual updates', () => {
      syncManager.handleManualUpdate('docs/README.md', '# Updated Documentation\n\nThis is manually updated.');

      const status = syncManager.getStatus();
      expect(status.queueSize).toBe(1);
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(() => {
      syncManager.registerClient('client1', mockClient1 as any);
      mockClient1.clearMessages();
    });

    it('should detect conflicts between auto and manual updates', () => {
      const conflictDetectedSpy = jest.fn();
      syncManager.on('conflict-detected', conflictDetectedSpy);

      // Create automatic update
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      // Create manual update for same file within conflict window
      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000, // 1 second later
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      expect(conflictDetectedSpy).toHaveBeenCalled();

      const conflicts = syncManager.getPendingConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].filePath).toBe('src/test.ts');
      expect(conflicts[0].autoContent).toBe('console.log("auto");');
      expect(conflicts[0].manualContent).toBe('console.log("manual");');
    });

    it('should resolve conflicts using automatic version', () => {
      const conflictResolvedSpy = jest.fn();
      syncManager.on('conflict-resolved', conflictResolvedSpy);

      // Create conflict
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000,
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      const conflicts = syncManager.getPendingConflicts();
      const conflictId = conflicts[0].id;

      // Resolve using auto version
      syncManager.resolveConflict(conflictId, 'auto');

      expect(conflictResolvedSpy).toHaveBeenCalled();
      expect(syncManager.getPendingConflicts().length).toBe(0);

      // Check that resolution was broadcast
      const conflictMessages = mockClient1.getAllMessages().filter(msg => msg.type === 'conflict');
      const resolvedMessage = conflictMessages.find(msg => msg.data.action === 'resolved');
      expect(resolvedMessage).toBeDefined();
      expect(resolvedMessage.data.resolution).toBe('auto');
    });

    it('should resolve conflicts using manual version', () => {
      // Create conflict
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000,
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      const conflicts = syncManager.getPendingConflicts();
      const conflictId = conflicts[0].id;

      // Resolve using manual version
      syncManager.resolveConflict(conflictId, 'manual');

      expect(syncManager.getPendingConflicts().length).toBe(0);

      // Check that resolution was broadcast
      const conflictMessages = mockClient1.getAllMessages().filter(msg => msg.type === 'conflict');
      const resolvedMessage = conflictMessages.find(msg => msg.data.action === 'resolved');
      expect(resolvedMessage.data.resolution).toBe('manual');
    });

    it('should resolve conflicts using merged content', () => {
      // Create conflict
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000,
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      const conflicts = syncManager.getPendingConflicts();
      const conflictId = conflicts[0].id;

      const mergedContent = 'console.log("merged solution");';

      // Resolve using merged content
      syncManager.resolveConflict(conflictId, 'merge', mergedContent);

      expect(syncManager.getPendingConflicts().length).toBe(0);

      // Check that resolution was broadcast with merged content
      const conflictMessages = mockClient1.getAllMessages().filter(msg => msg.type === 'conflict');
      const resolvedMessage = conflictMessages.find(msg => msg.data.action === 'resolved');
      expect(resolvedMessage.data.resolution).toBe('merge');
      expect(resolvedMessage.data.update.content).toBe(mergedContent);
    });
  });

  describe('Client Message Handling', () => {
    beforeEach(() => {
      syncManager.registerClient('client1', mockClient1 as any);
      mockClient1.clearMessages();
    });

    it('should handle heartbeat messages', () => {
      const heartbeatMessage: SyncMessage = {
        id: 'hb1',
        type: 'heartbeat',
        timestamp: Date.now(),
        data: { ping: true }
      };

      mockClient1.simulateMessage(heartbeatMessage);

      // Should respond with pong
      const response = mockClient1.getLastMessage();
      expect(response.type).toBe('heartbeat');
      expect(response.data.pong).toBe(true);
    });

    it('should handle status requests', () => {
      const statusMessage: SyncMessage = {
        id: 'status1',
        type: 'status',
        timestamp: Date.now(),
        data: {}
      };

      mockClient1.simulateMessage(statusMessage);

      // Should respond with current status
      const response = mockClient1.getLastMessage();
      expect(response.type).toBe('status');
      expect(response.data).toHaveProperty('connected');
      expect(response.data).toHaveProperty('queueSize');
      expect(response.data).toHaveProperty('conflicts');
    });

    it('should handle conflict resolution messages', () => {
      // Create a conflict first
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000,
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      const conflicts = syncManager.getPendingConflicts();
      const conflictId = conflicts[0].id;

      mockClient1.clearMessages();

      // Send conflict resolution message
      const conflictMessage: SyncMessage = {
        id: 'conflict1',
        type: 'conflict',
        timestamp: Date.now(),
        data: {
          action: 'resolve',
          conflictId,
          resolution: 'auto'
        }
      };

      mockClient1.simulateMessage(conflictMessage);

      // Conflict should be resolved
      expect(syncManager.getPendingConflicts().length).toBe(0);
    });
  });

  describe('Status and Statistics', () => {
    it('should provide accurate status information', () => {
      syncManager.registerClient('client1', mockClient1 as any);

      const update: DocumentUpdate = {
        id: 'update1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("test");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'abc123'
      };

      syncManager.queueUpdate(update);

      const status = syncManager.getStatus();

      expect(status.connected).toBe(true);
      expect(status.queueSize).toBe(1);
      expect(status.conflicts).toBe(0);
      expect(typeof status.latency).toBe('number');
      expect(typeof status.updateRate).toBe('number');
    });

    it('should track update statistics', () => {
      const updates = Array.from({ length: 5 }, (_, i) => ({
        id: `update${i}`,
        type: 'file' as const,
        filePath: `src/test${i}.ts`,
        content: `console.log("test ${i}");`,
        timestamp: Date.now(),
        source: 'auto' as const,
        checksum: `hash${i}`
      }));

      updates.forEach(update => syncManager.queueUpdate(update));

      const status = syncManager.getStatus();
      expect(status.updateRate).toBe(5); // 5 updates in the last minute
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset all state when requested', () => {
      syncManager.registerClient('client1', mockClient1 as any);

      // Add some updates and conflicts
      const autoUpdate: DocumentUpdate = {
        id: 'auto1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("auto");',
        timestamp: Date.now(),
        source: 'auto',
        checksum: 'auto123'
      };

      const manualUpdate: DocumentUpdate = {
        id: 'manual1',
        type: 'file',
        filePath: 'src/test.ts',
        content: 'console.log("manual");',
        timestamp: Date.now() + 1000,
        source: 'manual',
        checksum: 'manual123'
      };

      syncManager.queueUpdate(autoUpdate);
      syncManager.queueUpdate(manualUpdate);

      mockClient1.clearMessages();

      // Reset
      syncManager.reset();

      // Check that state is cleared
      const status = syncManager.getStatus();
      expect(status.queueSize).toBe(0);
      expect(status.conflicts).toBe(0);
      expect(syncManager.getPendingConflicts().length).toBe(0);

      // Check that reset was broadcast
      const resetMessage = mockClient1.getLastMessage();
      expect(resetMessage.type).toBe('status');
      expect(resetMessage.data.action).toBe('reset');
    });
  });
});
/**
 * Real-Time Documentation Synchronization System
 * 
 * Handles real-time updates, conflict resolution, and efficient synchronization
 * between the documentation generator and connected clients.
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { ProjectAnalysis, FileChange } from '../types.js';

export interface SyncMessage {
  id: string;
  type: 'update' | 'conflict' | 'status' | 'queue' | 'heartbeat';
  timestamp: number;
  data: any;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  retryCount?: number;
}

export interface DocumentUpdate {
  id: string;
  type: 'file' | 'project' | 'partial';
  filePath?: string;
  content: string;
  timestamp: number;
  source: 'auto' | 'manual' | 'git';
  checksum: string;
  dependencies?: string[]; // Files that depend on this update
}

export interface UpdateConflict {
  id: string;
  filePath: string;
  autoContent: string;
  manualContent: string;
  timestamp: number;
  resolution?: 'auto' | 'manual' | 'merge';
}

export interface SyncStatus {
  connected: boolean;
  lastUpdate: Date | null;
  queueSize: number;
  conflicts: number;
  latency: number;
  updateRate: number; // Updates per minute
}

export class RealTimeSyncManager extends EventEmitter {
  private clients = new Map<string, WebSocket>();
  private updateQueue: DocumentUpdate[] = [];
  private conflictQueue: UpdateConflict[] = [];
  private processingQueue = false;
  private lastHeartbeat = new Map<string, number>();
  private updateHistory = new Map<string, DocumentUpdate[]>();
  private maxQueueSize = 100;
  private maxHistorySize = 50;
  private heartbeatInterval = 30000; // 30 seconds
  private queueProcessInterval = 1000; // 1 second
  private updateStats = {
    totalUpdates: 0,
    lastMinuteUpdates: 0,
    updateTimes: [] as number[]
  };

  constructor() {
    super();
    this.startHeartbeat();
    this.startQueueProcessor();
  }

  /**
   * Register a new WebSocket client for real-time updates
   */
  public registerClient(clientId: string, ws: WebSocket): void {
    this.clients.set(clientId, ws);
    this.lastHeartbeat.set(clientId, Date.now());

    // Send current status to new client
    this.sendToClient(clientId, {
      id: this.generateId(),
      type: 'status',
      timestamp: Date.now(),
      data: {
        status: 'connected',
        queueSize: this.updateQueue.length,
        conflicts: this.conflictQueue.length
      }
    });

    // Set up client event handlers
    ws.on('message', (data: Buffer) => {
      try {
        const message: SyncMessage = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        console.error(`Error parsing message from client ${clientId}:`, error);
      }
    });

    ws.on('close', () => {
      this.unregisterClient(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.unregisterClient(clientId);
    });

    this.emit('client-connected', { clientId, clientCount: this.clients.size });
  }

  /**
   * Unregister a WebSocket client
   */
  public unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.lastHeartbeat.delete(clientId);
    this.emit('client-disconnected', { clientId, clientCount: this.clients.size });
  }

  /**
   * Queue a documentation update for processing
   */
  public queueUpdate(update: DocumentUpdate): void {
    // Check for conflicts with existing updates
    const existingUpdate = this.findConflictingUpdate(update);
    if (existingUpdate) {
      this.handleUpdateConflict(update, existingUpdate);
      return;
    }

    // Add to queue with priority handling
    this.insertUpdateByPriority(update);
    
    // Trim queue if it gets too large
    if (this.updateQueue.length > this.maxQueueSize) {
      const removed = this.updateQueue.splice(0, this.updateQueue.length - this.maxQueueSize);
      console.warn(`Update queue overflow, removed ${removed.length} old updates`);
    }

    // Update statistics
    this.updateStats.totalUpdates++;
    this.updateStats.lastMinuteUpdates++;
    this.updateStats.updateTimes.push(Date.now());

    // Trim update times to last minute
    const oneMinuteAgo = Date.now() - 60000;
    this.updateStats.updateTimes = this.updateStats.updateTimes.filter(time => time > oneMinuteAgo);
    this.updateStats.lastMinuteUpdates = this.updateStats.updateTimes.length;

    // Notify clients of queue status
    this.broadcastQueueStatus();

    this.emit('update-queued', { update, queueSize: this.updateQueue.length });
  }

  /**
   * Process a file change and create appropriate updates
   */
  public processFileChange(change: FileChange, analysis?: ProjectAnalysis): void {
    const update: DocumentUpdate = {
      id: this.generateId(),
      type: 'file',
      filePath: change.path,
      content: change.content || '',
      timestamp: change.timestamp,
      source: 'auto',
      checksum: this.calculateChecksum(change.content || ''),
      dependencies: this.findDependentFiles(change.path, analysis)
    };

    this.queueUpdate(update);
  }

  /**
   * Handle manual documentation updates (user edits)
   */
  public handleManualUpdate(filePath: string, content: string): void {
    const update: DocumentUpdate = {
      id: this.generateId(),
      type: 'file',
      filePath,
      content,
      timestamp: Date.now(),
      source: 'manual',
      checksum: this.calculateChecksum(content)
    };

    this.queueUpdate(update);
  }

  /**
   * Resolve a conflict between automatic and manual updates
   */
  public resolveConflict(conflictId: string, resolution: 'auto' | 'manual' | 'merge', mergedContent?: string): void {
    const conflict = this.conflictQueue.find(c => c.id === conflictId);
    if (!conflict) {
      console.warn(`Conflict ${conflictId} not found`);
      return;
    }

    conflict.resolution = resolution;

    let finalContent: string;
    switch (resolution) {
      case 'auto':
        finalContent = conflict.autoContent;
        break;
      case 'manual':
        finalContent = conflict.manualContent;
        break;
      case 'merge':
        finalContent = mergedContent || this.mergeContent(conflict.autoContent, conflict.manualContent);
        break;
    }

    // Create resolved update
    const resolvedUpdate: DocumentUpdate = {
      id: this.generateId(),
      type: 'file',
      filePath: conflict.filePath,
      content: finalContent,
      timestamp: Date.now(),
      source: resolution === 'auto' ? 'auto' : 'manual',
      checksum: this.calculateChecksum(finalContent)
    };

    // Remove from conflict queue
    this.conflictQueue = this.conflictQueue.filter(c => c.id !== conflictId);

    // Queue the resolved update
    this.queueUpdate(resolvedUpdate);

    // Notify clients
    this.broadcast({
      id: this.generateId(),
      type: 'conflict',
      timestamp: Date.now(),
      data: {
        action: 'resolved',
        conflictId,
        resolution,
        update: resolvedUpdate
      }
    });

    this.emit('conflict-resolved', { conflict, resolution, update: resolvedUpdate });
  }

  /**
   * Get current synchronization status
   */
  public getStatus(): SyncStatus {
    const now = Date.now();
    const recentHeartbeats = Array.from(this.lastHeartbeat.values())
      .filter(time => now - time < this.heartbeatInterval * 2);

    return {
      connected: recentHeartbeats.length > 0,
      lastUpdate: this.updateQueue.length > 0 ? new Date(this.updateQueue[this.updateQueue.length - 1].timestamp) : null,
      queueSize: this.updateQueue.length,
      conflicts: this.conflictQueue.length,
      latency: this.calculateAverageLatency(),
      updateRate: this.updateStats.lastMinuteUpdates
    };
  }

  /**
   * Get pending conflicts for user resolution
   */
  public getPendingConflicts(): UpdateConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Clear all queues and reset state
   */
  public reset(): void {
    this.updateQueue = [];
    this.conflictQueue = [];
    this.updateHistory.clear();
    this.updateStats = {
      totalUpdates: 0,
      lastMinuteUpdates: 0,
      updateTimes: []
    };

    this.broadcast({
      id: this.generateId(),
      type: 'status',
      timestamp: Date.now(),
      data: { action: 'reset' }
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleClientMessage(clientId: string, message: SyncMessage): void {
    this.lastHeartbeat.set(clientId, Date.now());

    switch (message.type) {
      case 'heartbeat':
        this.sendToClient(clientId, {
          id: this.generateId(),
          type: 'heartbeat',
          timestamp: Date.now(),
          data: { pong: true }
        });
        break;

      case 'status':
        this.sendToClient(clientId, {
          id: this.generateId(),
          type: 'status',
          timestamp: Date.now(),
          data: this.getStatus()
        });
        break;

      case 'conflict':
        if (message.data.action === 'resolve') {
          this.resolveConflict(
            message.data.conflictId,
            message.data.resolution,
            message.data.mergedContent
          );
        }
        break;
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: SyncMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        this.unregisterClient(clientId);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: SyncMessage): void {
    this.clients.forEach((_client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  /**
   * Broadcast current queue status to all clients
   */
  private broadcastQueueStatus(): void {
    this.broadcast({
      id: this.generateId(),
      type: 'queue',
      timestamp: Date.now(),
      data: {
        size: this.updateQueue.length,
        processing: this.processingQueue,
        conflicts: this.conflictQueue.length,
        updateRate: this.updateStats.lastMinuteUpdates
      }
    });
  }

  /**
   * Find conflicting updates in the queue
   */
  private findConflictingUpdate(update: DocumentUpdate): DocumentUpdate | null {
    return this.updateQueue.find(existing => 
      existing.filePath === update.filePath &&
      existing.source !== update.source &&
      Math.abs(existing.timestamp - update.timestamp) < 5000 // Within 5 seconds
    ) || null;
  }

  /**
   * Handle conflicts between automatic and manual updates
   */
  private handleUpdateConflict(newUpdate: DocumentUpdate, existingUpdate: DocumentUpdate): void {
    const conflict: UpdateConflict = {
      id: this.generateId(),
      filePath: newUpdate.filePath!,
      autoContent: newUpdate.source === 'auto' ? newUpdate.content : existingUpdate.content,
      manualContent: newUpdate.source === 'manual' ? newUpdate.content : existingUpdate.content,
      timestamp: Date.now()
    };

    this.conflictQueue.push(conflict);

    // Remove the existing update from queue
    this.updateQueue = this.updateQueue.filter(u => u.id !== existingUpdate.id);

    // Notify clients of conflict
    this.broadcast({
      id: this.generateId(),
      type: 'conflict',
      timestamp: Date.now(),
      data: {
        action: 'detected',
        conflict
      }
    });

    this.emit('conflict-detected', { conflict, newUpdate, existingUpdate });
  }

  /**
   * Insert update into queue based on priority
   */
  private insertUpdateByPriority(update: DocumentUpdate): void {
    // Simple priority: newer updates go to the end
    this.updateQueue.push(update);
    
    // Store in history
    const history = this.updateHistory.get(update.filePath!) || [];
    history.push(update);
    
    // Trim history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    
    this.updateHistory.set(update.filePath!, history);
  }

  /**
   * Find files that depend on the changed file
   */
  private findDependentFiles(filePath: string, analysis?: ProjectAnalysis): string[] {
    if (!analysis) return [];

    const dependencies: string[] = [];
    
    // Check imports/exports to find dependent files
    for (const [file, fileAnalysis] of analysis.files) {
      for (const importInfo of fileAnalysis.imports) {
        if (importInfo.source.includes(filePath) || filePath.includes(importInfo.source)) {
          dependencies.push(file);
        }
      }
    }

    return dependencies;
  }

  /**
   * Process the update queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.updateQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      const update = this.updateQueue.shift()!;
      
      // Broadcast the update to all clients
      this.broadcast({
        id: this.generateId(),
        type: 'update',
        timestamp: Date.now(),
        data: {
          action: 'apply',
          update
        }
      });

      this.emit('update-processed', { update });

    } catch (error) {
      console.error('Error processing update queue:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, this.queueProcessInterval);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Check for stale connections
      this.lastHeartbeat.forEach((lastSeen, clientId) => {
        if (now - lastSeen > this.heartbeatInterval * 2) {
          console.warn(`Client ${clientId} appears disconnected, removing`);
          this.unregisterClient(clientId);
        }
      });

      // Send heartbeat to all clients
      this.broadcast({
        id: this.generateId(),
        type: 'heartbeat',
        timestamp: now,
        data: { ping: true }
      });

    }, this.heartbeatInterval);
  }

  /**
   * Calculate average latency based on heartbeat responses
   */
  private calculateAverageLatency(): number {
    // This would be implemented with actual latency measurements
    // For now, return a placeholder
    return 50; // ms
  }

  /**
   * Simple content merging strategy
   */
  private mergeContent(autoContent: string, manualContent: string): string {
    // Simple line-based merge - in a real implementation, this would be more sophisticated
    const autoLines = autoContent.split('\n');
    const manualLines = manualContent.split('\n');
    
    const merged: string[] = [];
    const maxLines = Math.max(autoLines.length, manualLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const autoLine = autoLines[i] || '';
      const manualLine = manualLines[i] || '';
      
      if (autoLine === manualLine) {
        merged.push(autoLine);
      } else if (autoLine && manualLine) {
        // Conflict - include both with markers
        merged.push(`<<<<<<< AUTO`);
        merged.push(autoLine);
        merged.push(`=======`);
        merged.push(manualLine);
        merged.push(`>>>>>>> MANUAL`);
      } else {
        merged.push(autoLine || manualLine);
      }
    }
    
    return merged.join('\n');
  }

  /**
   * Calculate checksum for content
   */
  private calculateChecksum(content: string): string {
    // Simple hash function - in production, use a proper hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
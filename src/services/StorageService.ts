// src/services/StorageService.ts

import * as vscode from 'vscode';
import {
  TrackingEvent,
  TrackingSession,
  FileMetrics,
  UploadQueueItem
} from '../types';

/**
 * StorageService handles local data persistence and upload queue management
 * Uses VSCode's globalState for persistence
 */
export class StorageService {
  private static readonly KEYS = {
    EVENTS: 'devskill.events',
    SESSION: 'devskill.session',
    FILE_METRICS: 'devskill.fileMetrics',
    UPLOAD_QUEUE: 'devskill.uploadQueue',
    AUTH_STATE: 'devskill.authState',
    USER_CONSENTS: 'devskill.consents'
  };

  private static readonly MAX_EVENTS = 10000;
  private static readonly MAX_QUEUE_SIZE = 1000;

  constructor(private context: vscode.ExtensionContext) {}

  // ========== Event Storage ==========

  /**
   * Save events array
   */
  async saveEvents(events: TrackingEvent[]): Promise<void> {
    // Trim if too many events
    const trimmedEvents = events.length > StorageService.MAX_EVENTS
      ? events.slice(-StorageService.MAX_EVENTS)
      : events;

    await this.context.globalState.update(StorageService.KEYS.EVENTS, trimmedEvents);
  }

  /**
   * Load events array
   */
  getEvents(): TrackingEvent[] {
    return this.context.globalState.get<TrackingEvent[]>(StorageService.KEYS.EVENTS, []);
  }

  /**
   * Clear events
   */
  async clearEvents(): Promise<void> {
    await this.context.globalState.update(StorageService.KEYS.EVENTS, []);
  }

  /**
   * Add single event
   */
  async addEvent(event: TrackingEvent): Promise<void> {
    const events = this.getEvents();
    events.push(event);
    await this.saveEvents(events);
  }

  // ========== Session Storage ==========

  /**
   * Save current session
   */
  async saveSession(session: TrackingSession): Promise<void> {
    await this.context.globalState.update(StorageService.KEYS.SESSION, session);
  }

  /**
   * Load current session
   */
  getSession(): TrackingSession | null {
    return this.context.globalState.get<TrackingSession | null>(StorageService.KEYS.SESSION, null);
  }

  /**
   * Clear session
   */
  async clearSession(): Promise<void> {
    await this.context.globalState.update(StorageService.KEYS.SESSION, null);
  }

  // ========== File Metrics Storage ==========

  /**
   * Save file metrics
   */
  async saveFileMetrics(metrics: Record<string, FileMetrics>): Promise<void> {
    await this.context.globalState.update(StorageService.KEYS.FILE_METRICS, metrics);
  }

  /**
   * Load file metrics
   */
  getFileMetrics(): Record<string, FileMetrics> {
    return this.context.globalState.get<Record<string, FileMetrics>>(
      StorageService.KEYS.FILE_METRICS,
      {}
    );
  }

  /**
   * Clear file metrics
   */
  async clearFileMetrics(): Promise<void> {
    await this.context.globalState.update(StorageService.KEYS.FILE_METRICS, {});
  }

  // ========== Upload Queue Management ==========

  /**
   * Get upload queue
   */
  getUploadQueue(): UploadQueueItem[] {
    return this.context.globalState.get<UploadQueueItem[]>(
      StorageService.KEYS.UPLOAD_QUEUE,
      []
    );
  }

  /**
   * Save upload queue
   */
  async saveUploadQueue(queue: UploadQueueItem[]): Promise<void> {
    // Trim if too large
    const trimmedQueue = queue.length > StorageService.MAX_QUEUE_SIZE
      ? queue.slice(0, StorageService.MAX_QUEUE_SIZE)
      : queue;

    await this.context.globalState.update(StorageService.KEYS.UPLOAD_QUEUE, trimmedQueue);
  }

  /**
   * Add item to upload queue
   */
  async enqueueUpload(item: UploadQueueItem): Promise<void> {
    const queue = this.getUploadQueue();
    queue.push(item);
    await this.saveUploadQueue(queue);
  }

  /**
   * Remove item from upload queue
   */
  async dequeueUpload(itemId: string): Promise<void> {
    const queue = this.getUploadQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await this.saveUploadQueue(filtered);
  }

  /**
   * Update upload queue item
   */
  async updateQueueItem(itemId: string, updates: Partial<UploadQueueItem>): Promise<void> {
    const queue = this.getUploadQueue();
    const index = queue.findIndex(item => item.id === itemId);

    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await this.saveUploadQueue(queue);
    }
  }

  /**
   * Clear successful uploads from queue
   */
  async clearSuccessfulUploads(): Promise<void> {
    const queue = this.getUploadQueue();
    const filtered = queue.filter(item => item.status !== 'success');
    await this.saveUploadQueue(filtered);
  }

  /**
   * Get pending uploads
   */
  getPendingUploads(): UploadQueueItem[] {
    const queue = this.getUploadQueue();
    return queue.filter(item => item.status === 'pending' || item.status === 'failed');
  }

  // ========== User Consents ==========

  /**
   * Save user consent for a specific feature
   */
  async saveConsent(feature: string, granted: boolean): Promise<void> {
    const consents = this.context.globalState.get<Record<string, boolean>>(
      StorageService.KEYS.USER_CONSENTS,
      {}
    );
    consents[feature] = granted;
    await this.context.globalState.update(StorageService.KEYS.USER_CONSENTS, consents);
  }

  /**
   * Get user consent for a feature
   */
  getConsent(feature: string): boolean | null {
    const consents = this.context.globalState.get<Record<string, boolean>>(
      StorageService.KEYS.USER_CONSENTS,
      {}
    );
    return consents[feature] ?? null;
  }

  // ========== Utility Methods ==========

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    await this.clearEvents();
    await this.clearSession();
    await this.clearFileMetrics();
    await this.saveUploadQueue([]);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    eventCount: number;
    hasSession: boolean;
    fileCount: number;
    queueSize: number;
  } {
    return {
      eventCount: this.getEvents().length,
      hasSession: this.getSession() !== null,
      fileCount: Object.keys(this.getFileMetrics()).length,
      queueSize: this.getUploadQueue().length
    };
  }
}

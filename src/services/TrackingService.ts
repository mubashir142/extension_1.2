// src/services/TrackingService.ts

import * as vscode from 'vscode';
import { generateUUID } from '../utils/uuid';
import {
  TrackingEvent,
  TrackingSession,
  FileMetrics,
  EventType,
  KeystrokeDetail,
  PasteDetail,
  FileSwitchDetail,
  FileOpenDetail,
  FileCloseDetail,
  WindowStateDetail,
  IdleDetail,
  CodeAnalysisDetail,
  CodeFeatures
} from '../types';
import { StorageService } from './StorageService';
import { ConfigService } from './ConfigService';
import { LanguageDetector } from '../utils/languageDetector';
import { Logger } from '../utils/logger';
import { CodeFeatureExtractor } from './CodeFeatureExtractor';

/**
 * TrackingService handles all code tracking functionality
 * Enhanced with paste detection, line-level changes, and comprehensive metrics
 */
export class TrackingService {
  private disposables: vscode.Disposable[] = [];
  private running = false;
  private session: TrackingSession | null = null;
  private lastActivity = 0;
  private keystrokeCount = 0;
  private events: TrackingEvent[] = [];
  private fileMetrics: Record<string, FileMetrics> = {};
  private updateTimer?: NodeJS.Timeout;
  private currentFile: string | null = null;
  private currentLanguage: string | null = null;
  private lastTextChangeTime = 0;

  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private userId?: string
  ) {
    // Load persisted state
    this.loadState();
  }

  /**
   * Start tracking session
   */
  start(): void {
    if (this.running) {
      Logger.warn('TrackingService already running');
      vscode.window.showInformationMessage('DevSkill Tracker is already running.');
      return;
    }

    Logger.info('Starting tracking session');
    this.running = true;

    // Create new session
    this.session = {
      id: generateUUID(),
      userId: this.userId,
      startTime: Date.now(),
      totalDuration: 0,
      activeDuration: 0,
      idleDuration: 0,
      totalKeystrokes: 0,
      totalPastes: 0,
      totalEdits: 0,
      filesEdited: [],
      languagesUsed: [],
      codeAnalysesPerformed: 0,
      status: 'active',
      uploadAttempts: 0
    };

    this.lastActivity = Date.now();
    this.keystrokeCount = 0;

    // Record session start event
    this.recordEvent({
      timestamp: Date.now(),
      type: EventType.SESSION_START,
      detail: {}
    });

    // Register event listeners
    this.registerListeners();

    // Start update timer (1-second tick)
    this.updateTimer = setInterval(() => this.tick(), 1000);

    // Save state
    this.saveState();

    vscode.window.showInformationMessage('DevSkill Tracker: Started tracking.');
  }

  /**
   * Stop tracking session
   */
  stop(): void {
    if (!this.running) {
      Logger.warn('TrackingService not running');
      vscode.window.showInformationMessage('DevSkill Tracker is not running.');
      return;
    }

    Logger.info('Stopping tracking session');
    this.running = false;

    // Update session
    if (this.session) {
      this.session.endTime = Date.now();
      this.session.totalDuration = this.session.endTime - this.session.startTime;
      this.session.status = 'stopped';
      this.session.totalKeystrokes = this.keystrokeCount;
    }

    // Record session stop event
    this.recordEvent({
      timestamp: Date.now(),
      type: EventType.SESSION_STOP,
      detail: { keystrokeCount: this.keystrokeCount }
    });

    // Cleanup
    this.disposeListeners();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }

    // Save final state
    this.saveState();

    vscode.window.showInformationMessage('DevSkill Tracker: Stopped tracking.');
  }

  /**
   * Register VSCode event listeners
   */
  private registerListeners(): void {
    Logger.debug('Registering event listeners');

    // Text document changes (keystrokes, pastes, edits)
    const textChange = vscode.workspace.onDidChangeTextDocument((e) => {
      if (!this.running || !e.document) {
        return;
      }

      this.handleTextChange(e);
    });

    // Active editor changes (file switches)
    const editorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!this.running) {
        return;
      }

      this.handleEditorChange(editor);
    });

    // Document open
    const openDoc = vscode.workspace.onDidOpenTextDocument((doc) => {
      if (!this.running) {
        return;
      }

      this.handleDocumentOpen(doc);
    });

    // Document close
    const closeDoc = vscode.workspace.onDidCloseTextDocument((doc) => {
      if (!this.running) {
        return;
      }

      this.handleDocumentClose(doc);
    });

    // Window focus changes
    const windowState = vscode.window.onDidChangeWindowState((state) => {
      if (!this.running) {
        return;
      }

      this.handleWindowStateChange(state);
    });

    this.disposables.push(textChange, editorChange, openDoc, closeDoc, windowState);
  }

  /**
   * Dispose event listeners
   */
  private disposeListeners(): void {
    Logger.debug('Disposing event listeners');
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  /**
   * Handle text document changes
   */
  private handleTextChange(e: vscode.TextDocumentChangeEvent): void {
    // Skip non-trackable files
    if (!this.shouldTrackDocument(e.document)) {
      return;
    }

    const file = e.document.uri.fsPath;
    const language = LanguageDetector.detectLanguage(file);
    const now = Date.now();

    // Calculate changes
    let totalAdded = 0;
    let totalDeleted = 0;
    let linesAdded = 0;
    let linesDeleted = 0;

    for (const change of e.contentChanges) {
      totalAdded += change.text.length;
      totalDeleted += change.rangeLength;

      // Count line changes
      const newLines = (change.text.match(/\n/g) || []).length;
      const deletedLines = change.range.end.line - change.range.start.line;

      linesAdded += newLines;
      linesDeleted += deletedLines;
    }

    if (totalAdded === 0 && totalDeleted === 0) {
      return;
    }

    // Detect paste vs typing
    const timeSinceLastChange = now - this.lastTextChangeTime;
    const isPaste = this.detectPaste(totalAdded, timeSinceLastChange, linesAdded);

    // Ensure file metrics exist
    this.ensureFileMetrics(file, language);

    // Update file metrics
    if (isPaste) {
      this.fileMetrics[file].pasteCount++;
      this.session!.totalPastes++;

      // Record paste event
      const pasteDetail: PasteDetail = {
        file,
        language,
        charactersAdded: totalAdded,
        linesAdded,
        estimatedSource: totalAdded > 200 ? 'clipboard' : 'autocomplete'
      };

      this.recordEvent({
        timestamp: now,
        type: EventType.PASTE,
        detail: pasteDetail
      });
    } else {
      this.fileMetrics[file].keystrokeCount += totalAdded;
      this.keystrokeCount += totalAdded;

      // Record keystroke event
      const keystrokeDetail: KeystrokeDetail = {
        file,
        language,
        charactersAdded: totalAdded,
        charactersDeleted: totalDeleted,
        linesAdded,
        linesDeleted,
        isTyping: true
      };

      this.recordEvent({
        timestamp: now,
        type: EventType.KEYSTROKE,
        detail: keystrokeDetail
      });
    }

    // Update edit metrics
    this.fileMetrics[file].editCount++;
    this.fileMetrics[file].linesAdded += linesAdded;
    this.fileMetrics[file].linesDeleted += linesDeleted;
    this.session!.totalEdits++;

    // Calculate typing ratio
    const total = this.fileMetrics[file].keystrokeCount + this.fileMetrics[file].pasteCount;
    this.fileMetrics[file].typingToTotalRatio = total > 0
      ? this.fileMetrics[file].keystrokeCount / total
      : 0;

    // Update active time
    this.updateFileActiveTime(file, now);

    this.lastTextChangeTime = now;
    this.markActivity();
  }

  /**
   * Handle editor (file) switch
   */
  private handleEditorChange(editor: vscode.TextEditor | undefined): void {
    // Skip non-trackable files
    if (editor && !this.shouldTrackDocument(editor.document)) {
      return;
    }

    const file = editor?.document?.uri?.fsPath ?? null;
    const language = file ? LanguageDetector.detectLanguage(file) : null;
    const now = Date.now();

    const dwellTimeMs = this.currentFile && this.lastActivity
      ? now - this.lastActivity
      : 0;

    // Record file switch event
    const switchDetail: FileSwitchDetail = {
      fromFile: this.currentFile,
      toFile: file ?? '',
      fromLanguage: this.currentLanguage,
      toLanguage: language ?? '',
      dwellTimeMs
    };

    this.recordEvent({
      timestamp: now,
      type: EventType.FILE_SWITCH,
      detail: switchDetail
    });

    // Update file metrics
    if (this.currentFile && this.fileMetrics[this.currentFile]) {
      this.fileMetrics[this.currentFile].switchFromCount++;
    }

    if (file) {
      this.ensureFileMetrics(file, language!);
      this.fileMetrics[file].switchToCount++;
    }

    this.currentFile = file;
    this.currentLanguage = language;
    this.markActivity();
  }

  /**
   * Handle document open
   */
  private handleDocumentOpen(doc: vscode.TextDocument): void {
    // Skip non-trackable files
    if (!this.shouldTrackDocument(doc)) {
      return;
    }

    const file = doc.uri.fsPath;
    const language = LanguageDetector.detectLanguage(file);

    this.ensureFileMetrics(file, language);
    this.fileMetrics[file].openCount++;

    const openDetail: FileOpenDetail = {
      file,
      language
    };

    this.recordEvent({
      timestamp: Date.now(),
      type: EventType.FILE_OPEN,
      detail: openDetail
    });

    this.markActivity();
  }

  /**
   * Handle document close
   */
  private handleDocumentClose(doc: vscode.TextDocument): void {
    // Skip non-trackable files
    if (!this.shouldTrackDocument(doc)) {
      return;
    }

    const file = doc.uri.fsPath;
    const language = LanguageDetector.detectLanguage(file);
    const now = Date.now();

    const totalTimeMs = this.fileMetrics[file]?.totalTimeMs ?? 0;

    const closeDetail: FileCloseDetail = {
      file,
      language,
      totalTimeMs
    };

    this.recordEvent({
      timestamp: now,
      type: EventType.FILE_CLOSE,
      detail: closeDetail
    });

    this.markActivity();
  }

  /**
   * Handle window state changes
   */
  private handleWindowStateChange(state: vscode.WindowState): void {
    const stateDetail: WindowStateDetail = {
      focused: state.focused
    };

    this.recordEvent({
      timestamp: Date.now(),
      type: state.focused ? EventType.WINDOW_FOCUS : EventType.WINDOW_BLUR,
      detail: stateDetail
    });

    if (state.focused) {
      this.markActivity();
    }
  }

  /**
   * Timer tick (1 second interval)
   */
  private tick(): void {
    if (!this.running || !this.session) {
      return;
    }

    const now = Date.now();
    const idleMs = now - this.lastActivity;
    const idleThreshold = this.config.getTracking().idleThresholdMs;

    // Check for idle
    if (idleMs > idleThreshold) {
      const last = this.events[this.events.length - 1];
      if (!last || last.type !== EventType.IDLE_START) {
        // Record idle event
        const idleDetail: IdleDetail = {
          idleMs
        };

        this.recordEvent({
          timestamp: now,
          type: EventType.IDLE_START,
          detail: idleDetail
        });

        Logger.debug(`User idle for ${idleMs}ms`);
      }
    }

    // Update session duration
    this.session.totalDuration = now - this.session.startTime;

    // Periodic save
    if (this.events.length % 10 === 0) {
      this.saveState();
    }
  }

  /**
   * Mark user activity
   */
  private markActivity(): void {
    const now = Date.now();
    const wasIdle = this.events.length > 0 &&
                   this.events[this.events.length - 1].type === EventType.IDLE_START;

    this.lastActivity = now;

    // If resuming from idle, record idle end event
    if (wasIdle) {
      this.recordEvent({
        timestamp: now,
        type: EventType.IDLE_END,
        detail: {}
      });

      Logger.debug('User resumed from idle');
    }
  }

  /**
   * Check if document should be tracked
   * Filters out output channels, virtual documents, etc.
   */
  private shouldTrackDocument(doc: vscode.TextDocument): boolean {
    // Only track 'file' scheme (not 'output', 'git', 'untitled', etc.)
    if (doc.uri.scheme !== 'file') {
      return false;
    }

    // Skip if file path contains output channel indicators
    const path = doc.uri.fsPath;
    if (path.includes('extension-output-') ||
        path.includes('output-') ||
        path.includes('[Extension Host]')) {
      return false;
    }

    // Skip very large files (>10MB) to avoid performance issues
    if (doc.getText().length > 10 * 1024 * 1024) {
      return false;
    }

    return true;
  }

  /**
   * Detect if change is a paste (vs typing)
   * Improved algorithm with multiple heuristics to minimize false positives
   */
  private detectPaste(charactersAdded: number, timeSinceLastChange: number, linesAdded: number = 0): boolean {
    // Small amounts are ALWAYS typing, even with instant timing
    // This handles autocomplete, IntelliSense, and normal typing
    if (charactersAdded <= 30) {
      return false;
    }

    // Multi-line paste detection
    // If adding 3+ lines instantly, it's likely a paste
    if (linesAdded >= 3 && timeSinceLastChange < 50) {
      return true;
    }

    // Very large insertion - almost certainly a paste (>300 chars)
    // Average typing speed is ~200 chars/min = ~3 chars/sec
    // 300 chars would take 100 seconds to type
    if (charactersAdded > 300) {
      return true;
    }

    // Large insertion with instant timing (<20ms) - very likely paste
    // Real typing cannot produce >150 chars in <20ms
    if (charactersAdded > 150 && timeSinceLastChange < 20) {
      return true;
    }

    // Medium-large insertion (100-150 chars) with very instant timing (<10ms)
    // Typing this much instantly is impossible
    if (charactersAdded > 100 && timeSinceLastChange < 10) {
      return true;
    }

    // Medium insertion (50-100 chars) needs to be truly instant (<5ms) to be paste
    // This allows for fast typing with autocomplete
    if (charactersAdded > 50 && timeSinceLastChange < 5) {
      return true;
    }

    // Everything else is typing
    // This includes:
    // - Medium amounts with reasonable timing
    // - Small to medium fast typing
    // - Autocomplete and IntelliSense insertions
    // - Code snippets
    return false;
  }

  /**
   * Ensure file metrics exist
   */
  private ensureFileMetrics(file: string, language: string): void {
    if (!this.fileMetrics[file]) {
      this.fileMetrics[file] = {
        file,
        language,
        firstSeen: Date.now(),
        lastActive: Date.now(),
        keystrokeCount: 0,
        pasteCount: 0,
        typingToTotalRatio: 0,
        linesAdded: 0,
        linesDeleted: 0,
        editCount: 0,
        averageEditSize: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        totalTimeMs: 0,
        switchToCount: 0,
        switchFromCount: 0,
        openCount: 0,
        codeAnalysisCount: 0
      };

      // Add to session
      if (this.session) {
        if (!this.session.filesEdited.includes(file)) {
          this.session.filesEdited.push(file);
        }
        if (!this.session.languagesUsed.includes(language)) {
          this.session.languagesUsed.push(language);
        }
      }
    }
  }

  /**
   * Update file active time
   */
  private updateFileActiveTime(file: string, now: number): void {
    if (!this.fileMetrics[file]) {
      return;
    }

    const elapsed = now - this.fileMetrics[file].lastActive;
    const idleThreshold = this.config.getTracking().idleThresholdMs;

    // Only add elapsed time if not idle
    if (elapsed < idleThreshold) {
      this.fileMetrics[file].activeTimeMs += elapsed;
    }

    this.fileMetrics[file].lastActive = now;
    this.fileMetrics[file].totalTimeMs += elapsed;
  }

  /**
   * Record tracking event
   */
  private recordEvent(event: Omit<TrackingEvent, 'id' | 'sessionId' | 'userId'>): void {
    const fullEvent: TrackingEvent = {
      id: generateUUID(),
      sessionId: this.session?.id ?? 'unknown',
      userId: this.userId,
      ...event
    };

    this.events.push(fullEvent);
    Logger.debug(`Event recorded: ${fullEvent.type}`, fullEvent);
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await this.storage.saveEvents(this.events);
      if (this.session) {
        await this.storage.saveSession(this.session);
      }
      await this.storage.saveFileMetrics(this.fileMetrics);
    } catch (error) {
      Logger.error('Failed to save tracking state', error);
    }
  }

  /**
   * Load state from storage
   */
  private loadState(): void {
    try {
      this.events = this.storage.getEvents();
      this.session = this.storage.getSession();
      this.fileMetrics = this.storage.getFileMetrics();

      Logger.info(`Loaded state: ${this.events.length} events, ${Object.keys(this.fileMetrics).length} files`);
    } catch (error) {
      Logger.error('Failed to load tracking state', error);
    }
  }

  /**
   * Get current session
   */
  getSession(): TrackingSession | null {
    return this.session;
  }

  /**
   * Get all events
   */
  getEvents(): TrackingEvent[] {
    return this.events;
  }

  /**
   * Get file metrics
   */
  getFileMetrics(): Record<string, FileMetrics> {
    return this.fileMetrics;
  }

  /**
   * Check if tracking is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get keystroke count
   */
  getKeystrokeCount(): number {
    return this.keystrokeCount;
  }

  /**
   * Get idle status
   */
  isIdle(): boolean {
    const now = Date.now();
    const idleMs = now - this.lastActivity;
    return idleMs > this.config.getTracking().idleThresholdMs;
  }

  /**
   * Get time since start
   */
  getElapsedTime(): number {
    if (!this.session) {
      return 0;
    }
    return Date.now() - this.session.startTime;
  }

  /**
   * Analyze code in a file and extract features
   *
   * IMPORTANT: This processes code TEMPORARILY - raw code is never stored.
   * Only privacy-safe features are extracted and recorded.
   *
   * @param document - The document to analyze
   * @returns CodeFeatures if analysis was performed, null otherwise
   */
  async analyzeFile(document: vscode.TextDocument): Promise<CodeFeatures | null> {
    const filePath = document.uri.fsPath;
    const code = document.getText();

    // Check if we should analyze this file
    if (!CodeFeatureExtractor.shouldAnalyze(filePath, code.length)) {
      Logger.debug(`Skipping analysis for ${filePath} (not eligible)`);
      return null;
    }

    Logger.info(`Analyzing file: ${filePath}`);

    // Get tracking metrics for this file (if available)
    const trackingMetrics = this.fileMetrics[filePath];

    // Extract features - CODE IS PROCESSED IN MEMORY ONLY
    const features = CodeFeatureExtractor.extract(code, filePath, trackingMetrics);

    // Record analysis event (features only, no raw code)
    const language = LanguageDetector.detectLanguage(filePath);
    const analysisDetail: CodeAnalysisDetail = {
      file: filePath,
      language,
      features,
      analysisVersion: features.extractionVersion
    };

    this.recordEvent({
      timestamp: Date.now(),
      type: EventType.CODE_ANALYSIS,
      detail: analysisDetail
    });

    // Update metrics
    if (this.fileMetrics[filePath]) {
      this.fileMetrics[filePath].codeAnalysisCount++;
      this.fileMetrics[filePath].lastAnalysisTimestamp = Date.now();
    }

    if (this.session) {
      this.session.codeAnalysesPerformed++;
    }

    // Save state
    await this.saveState();

    Logger.info(`Analysis complete for ${filePath}`, {
      codeLines: features.codeLines,
      complexity: features.cyclomaticComplexity,
      pasteRatio: features.pasteRatio
    });

    // Return features (raw code is NOT returned or stored)
    return features;
  }

  /**
   * Analyze the currently active file
   */
  async analyzeCurrentFile(): Promise<CodeFeatures | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      Logger.warn('No active editor for analysis');
      vscode.window.showWarningMessage('No file is currently open.');
      return null;
    }

    return this.analyzeFile(editor.document);
  }

  /**
   * Dispose tracking service
   */
  dispose(): void {
    Logger.info('Disposing TrackingService');

    if (this.running) {
      this.stop();
    }

    this.disposeListeners();
  }
}

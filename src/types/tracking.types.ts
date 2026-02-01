// src/types/tracking.types.ts

/**
 * Event type enumeration for all tracking events
 */
export enum EventType {
  SESSION_START = 'session_start',
  SESSION_STOP = 'session_stop',
  KEYSTROKE = 'keystroke',
  PASTE = 'paste',
  TEXT_EDIT = 'text_edit',
  FILE_SWITCH = 'file_switch',
  FILE_OPEN = 'file_open',
  FILE_CLOSE = 'file_close',
  WINDOW_FOCUS = 'window_focus',
  WINDOW_BLUR = 'window_blur',
  IDLE_START = 'idle_start',
  IDLE_END = 'idle_end',
  CODE_ANALYSIS = 'code_analysis'
}

/**
 * Base tracking event structure
 */
export interface TrackingEvent {
  id: string;                          // UUID for event
  sessionId: string;                   // Current session ID
  timestamp: number;                   // Unix timestamp (ms)
  type: EventType;                     // Event type
  detail: EventDetail;                 // Type-specific details
  userId?: string;                     // Firebase user ID (if authenticated)
}

/**
 * Union type for all event details
 */
export type EventDetail =
  | KeystrokeDetail
  | PasteDetail
  | TextEditDetail
  | FileSwitchDetail
  | FileOpenDetail
  | FileCloseDetail
  | WindowStateDetail
  | IdleDetail
  | CodeAnalysisDetail
  | SessionDetail;

/**
 * Keystroke event details (typing detected)
 */
export interface KeystrokeDetail {
  file: string;
  language: string;
  charactersAdded: number;
  charactersDeleted: number;
  linesAdded: number;
  linesDeleted: number;
  isTyping: boolean;                   // true for normal typing
}

/**
 * Paste event details (large insertion detected)
 */
export interface PasteDetail {
  file: string;
  language: string;
  charactersAdded: number;
  linesAdded: number;
  estimatedSource: 'clipboard' | 'autocomplete' | 'unknown';
}

/**
 * Text edit event details (generic edit)
 */
export interface TextEditDetail {
  file: string;
  language: string;
  editType: 'insert' | 'delete' | 'replace';
  changeSize: number;
  position: { line: number; character: number };
}

/**
 * File switch event details
 */
export interface FileSwitchDetail {
  fromFile: string | null;
  toFile: string;
  fromLanguage: string | null;
  toLanguage: string;
  dwellTimeMs: number;                 // Time spent in previous file
}

/**
 * File open event details
 */
export interface FileOpenDetail {
  file: string;
  language: string;
}

/**
 * File close event details
 */
export interface FileCloseDetail {
  file: string;
  language: string;
  totalTimeMs: number;                 // Total time file was open
}

/**
 * Window state change event details
 */
export interface WindowStateDetail {
  focused: boolean;
}

/**
 * Idle event details
 */
export interface IdleDetail {
  idleMs: number;                      // Duration of idle period
}

/**
 * Code analysis event details
 */
export interface CodeAnalysisDetail {
  file: string;
  language: string;
  features: CodeFeatures;
  aiLikelihoodScore?: number;          // Returned from backend
  analysisVersion: string;             // Feature extraction version
}

/**
 * Session start/stop event details
 */
export interface SessionDetail {
  keystrokeCount?: number;             // For stop event
}

/**
 * Per-file metrics
 */
export interface FileMetrics {
  file: string;
  language: string;
  firstSeen: number;
  lastActive: number;

  // Typing metrics
  keystrokeCount: number;
  pasteCount: number;
  typingToTotalRatio: number;

  // Edit metrics
  linesAdded: number;
  linesDeleted: number;
  editCount: number;
  averageEditSize: number;

  // Time metrics
  activeTimeMs: number;
  idleTimeMs: number;
  totalTimeMs: number;

  // File interaction
  switchToCount: number;
  switchFromCount: number;
  openCount: number;

  // Advanced metrics
  codeAnalysisCount: number;
  lastAnalysisTimestamp?: number;
}

/**
 * Tracking session metadata
 */
export interface TrackingSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  totalDuration: number;
  activeDuration: number;
  idleDuration: number;

  // Aggregate metrics
  totalKeystrokes: number;
  totalPastes: number;
  totalEdits: number;
  filesEdited: string[];
  languagesUsed: string[];

  // Analysis summary
  codeAnalysesPerformed: number;

  // Status
  status: 'active' | 'stopped' | 'uploaded' | 'error';
  uploadAttempts: number;
  lastUploadAttempt?: number;
}

/**
 * Code features for AI analysis (privacy-safe)
 */
export interface CodeFeatures {
  // Basic metrics
  totalLines: number;
  codeLines: number;                   // Non-empty, non-comment
  commentLines: number;
  blankLines: number;

  // Structural metrics
  averageLineLength: number;
  maxLineLength: number;
  indentationConsistency: number;      // 0-1 score
  indentationStyle: 'spaces' | 'tabs' | 'mixed';
  indentationSize: number;

  // Comment metrics
  commentDensity: number;              // comments / code lines
  blockCommentCount: number;
  inlineCommentCount: number;
  docstringCount: number;

  // Code structure (language-agnostic estimates)
  functionCount: number;
  classCount: number;
  importCount: number;

  // Complexity estimates
  cyclomaticComplexity: number;        // Estimated from control flow
  nestingDepth: number;                // Maximum nesting level

  // Naming patterns
  averageVariableNameLength: number;
  camelCaseRatio: number;
  snake_caseRatio: number;
  singleCharVarCount: number;

  // Code quality indicators
  duplicateLineRatio: number;
  longLineRatio: number;               // Lines > 100 chars
  emptyBlockCount: number;

  // Temporal features (from tracking data)
  typingSpeed: number;                 // chars per second
  editFrequency: number;               // edits per minute
  pasteRatio: number;                  // pastes / total inputs

  // Metadata
  language: string;
  fileExtension: string;
  extractionTimestamp: number;
  extractionVersion: string;
}

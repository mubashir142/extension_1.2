// src/types/api.types.ts

import { TrackingSession, TrackingEvent, FileMetrics } from './tracking.types';
import { AnalysisRequest } from './analysis.types';

/**
 * API configuration
 */
export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  batchSize: number;                   // Events per upload batch
  uploadIntervalMs: number;            // Auto-upload interval
}

/**
 * Upload queue item
 */
export interface UploadQueueItem {
  id: string;
  type: 'session' | 'events' | 'analysis';
  data: TrackingSession | TrackingEvent[] | AnalysisRequest;
  timestamp: number;
  attempts: number;
  lastAttempt?: number;
  status: 'pending' | 'uploading' | 'failed' | 'success';
  error?: string;
}

/**
 * Generic API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

/**
 * Session upload request payload
 */
export interface SessionUploadRequest {
  session: TrackingSession;
  events: TrackingEvent[];
  fileMetrics: FileMetrics[];
}

/**
 * Session upload response
 */
export interface SessionUploadResponse {
  sessionId: string;
  eventsProcessed: number;
  timestamp: number;
}

/**
 * AI Detection request (sent to backend)
 */
export interface AIDetectionRequest {
  userId: string;
  sessionId: string;
  file: string;
  features: import('./tracking.types').CodeFeatures;
  consentGiven: boolean;
}

/**
 * AI Detection response (from backend)
 */
export interface AIDetectionResponse {
  status: string;
  aiLikelihoodScore: number;  // 0-100 percentage
  confidence: number;          // 0-100 percentage
  signals: Record<string, { value?: number; score: number; [key: string]: any }>;
  recommendation: string;
}

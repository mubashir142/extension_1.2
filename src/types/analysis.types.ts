// src/types/analysis.types.ts

import { CodeFeatures, FileMetrics } from './tracking.types';

/**
 * Analysis request payload
 */
export interface AnalysisRequest {
  sessionId: string;
  userId?: string;
  file: string;
  features: CodeFeatures;
  trackingMetrics: FileMetrics;
  consentGiven: boolean;
  timestamp: number;
}

/**
 * Analysis response from backend
 */
export interface AnalysisResponse {
  success: boolean;
  aiLikelihoodScore?: number;          // 0-1 score
  confidence?: number;                 // Model confidence
  explanation?: string;                // Human-readable explanation
  error?: string;
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  minLinesForAnalysis: number;         // Min code lines to analyze
  maxFileSizeBytes: number;            // Max file size to analyze
  consentRequired: boolean;
  showExplanation: boolean;
  cacheResultsHours: number;
}

// src/services/ConfigService.ts

import * as vscode from 'vscode';
import { AuthConfig, APIConfig, AnalysisConfig } from '../types';

/**
 * Extension configuration interface
 */
export interface ExtensionConfig {
  auth: AuthConfig;
  tracking: TrackingConfig;
  analysis: AnalysisConfig;
  api: APIConfig;
}

/**
 * Tracking configuration
 */
export interface TrackingConfig {
  idleThresholdMs: number;
  pasteDetectionThreshold: number;
  enableFileTracking: boolean;
  enableIdleTracking: boolean;
}

/**
 * ConfigService manages all extension configuration
 * Reads from VSCode settings, environment variables, and defaults
 */
export class ConfigService {
  private config: ExtensionConfig;

  constructor(private context: vscode.ExtensionContext) {
    this.config = this.loadConfig();

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('devskill')) {
          this.config = this.loadConfig();
        }
      })
    );
  }

  /**
   * Load configuration from all sources
   */
  private loadConfig(): ExtensionConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('devskill');

    return {
      auth: {
        firebaseApiKey: process.env.FIREBASE_API_KEY ||
                       workspaceConfig.get('auth.firebaseApiKey', ''),
        firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN ||
                           workspaceConfig.get('auth.firebaseAuthDomain', ''),
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID ||
                          workspaceConfig.get('auth.firebaseProjectId', ''),
        enableAutoLogin: workspaceConfig.get('auth.autoLogin', true),
        tokenRefreshThreshold: 300000  // 5 minutes
      },
      tracking: {
        idleThresholdMs: workspaceConfig.get('tracking.idleThreshold', 60000),
        pasteDetectionThreshold: workspaceConfig.get('tracking.pasteThreshold', 50),
        enableFileTracking: workspaceConfig.get('tracking.enableFiles', true),
        enableIdleTracking: workspaceConfig.get('tracking.enableIdle', true)
      },
      analysis: {
        minLinesForAnalysis: workspaceConfig.get('analysis.minLines', 10),
        maxFileSizeBytes: workspaceConfig.get('analysis.maxFileSize', 1048576), // 1MB
        consentRequired: workspaceConfig.get('analysis.requireConsent', true),
        showExplanation: workspaceConfig.get('analysis.showExplanation', true),
        cacheResultsHours: workspaceConfig.get('analysis.cacheHours', 24)
      },
      api: {
        baseUrl: process.env.DEVSKILL_API_URL ||
                workspaceConfig.get('api.baseUrl', 'https://api.devskill.com'),
        timeout: workspaceConfig.get('api.timeout', 30000),
        retryAttempts: workspaceConfig.get('api.maxRetries', 5),
        retryDelayMs: workspaceConfig.get('api.retryDelay', 1000),
        batchSize: workspaceConfig.get('api.batchSize', 100),
        uploadIntervalMs: workspaceConfig.get('api.uploadInterval', 300000)
      }
    };
  }

  /**
   * Get the full configuration object
   */
  getAll(): ExtensionConfig {
    return this.config;
  }

  /**
   * Get authentication configuration
   */
  getAuth(): AuthConfig {
    return this.config.auth;
  }

  /**
   * Get tracking configuration
   */
  getTracking(): TrackingConfig {
    return this.config.tracking;
  }

  /**
   * Get analysis configuration
   */
  getAnalysis(): AnalysisConfig {
    return this.config.analysis;
  }

  /**
   * Get API configuration
   */
  getAPI(): APIConfig {
    return this.config.api;
  }

  /**
   * Update a configuration value
   */
  async update(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await vscode.workspace.getConfiguration('devskill').update(key, value, target);
    // Config will be automatically reloaded via onDidChangeConfiguration
  }

  /**
   * Check if Firebase is configured
   */
  isFirebaseConfigured(): boolean {
    return !!(
      this.config.auth.firebaseApiKey &&
      this.config.auth.firebaseAuthDomain &&
      this.config.auth.firebaseProjectId
    );
  }

  /**
   * Check if API is configured
   */
  isAPIConfigured(): boolean {
    return !!this.config.api.baseUrl;
  }
}

// src/services/APIService.ts

import { ConfigService } from './ConfigService';
import { AuthService } from './AuthService';
import { Logger } from '../utils/logger';
import {
  APIResponse,
  AIDetectionRequest,
  AIDetectionResponse
} from '../types';
import { CodeFeatures } from '../types/tracking.types';

/**
 * APIService handles all communication with the DevSkill backend
 */
export class APIService {
  private baseUrl: string;
  private timeout: number;

  constructor(
    private config: ConfigService,
    private auth: AuthService
  ) {
    const apiConfig = config.getAPI();
    this.baseUrl = apiConfig.baseUrl;
    this.timeout = apiConfig.timeout;
  }

  /**
   * Send code features to backend for AI detection analysis
   *
   * @param userId - Firebase user ID
   * @param sessionId - Current tracking session ID
   * @param filePath - Path to the analyzed file
   * @param features - Extracted code features (privacy-safe, no raw code)
   * @returns AI detection response with likelihood score
   */
  async detectAI(
    userId: string,
    sessionId: string,
    filePath: string,
    features: CodeFeatures
  ): Promise<AIDetectionResponse | null> {
    try {
      const request: AIDetectionRequest = {
        userId,
        sessionId,
        file: filePath,
        features,
        consentGiven: true
      };

      Logger.info('Sending features to backend for AI detection', {
        file: filePath,
        codeLines: features.codeLines
      });

      const response = await this.post<AIDetectionResponse>('/detect-ai', request);

      if (response) {
        Logger.info('AI detection complete', {
          aiLikelihood: response.aiLikelihoodScore,
          confidence: response.confidence
        });
      }

      return response;

    } catch (error) {
      Logger.error('AI detection request failed', error);
      return null;
    }
  }

  /**
   * Make a POST request to the backend
   */
  private async post<T>(endpoint: string, data: any): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth token if available
          ...(this.auth.isAuthenticated() && {
            'Authorization': `Bearer ${await this.auth.getToken()}`
          })
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`API error: ${response.status}`, errorText);
        return null;
      }

      return await response.json() as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.error('Request timed out', { url, timeout: this.timeout });
      } else {
        Logger.error('Network error', { url, error: error.message });
      }
      return null;
    }
  }

  /**
   * Make a GET request to the backend
   */
  private async get<T>(endpoint: string): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.auth.isAuthenticated() && {
            'Authorization': `Bearer ${await this.auth.getToken()}`
          })
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        Logger.error(`API error: ${response.status}`);
        return null;
      }

      return await response.json() as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.error('Request timed out', { url });
      } else {
        Logger.error('Network error', { url, error: error.message });
      }
      return null;
    }
  }

  /**
   * Check if the backend is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update the base URL (e.g., for local development)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    Logger.info(`API base URL updated to: ${url}`);
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

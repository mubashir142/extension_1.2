// src/services/AuthService.ts

import * as vscode from 'vscode';
import { AuthState, FirebaseUser, AuthCredentials } from '../types/auth.types';
import { ConfigService } from './ConfigService';
import { Logger } from '../utils/logger';

/**
 * AuthService handles Firebase authentication via REST API
 * Manages user sessions, token storage, and auto-refresh
 */
export class AuthService implements vscode.Disposable {
  private static readonly FIREBASE_API_BASE = 'https://identitytoolkit.googleapis.com/v1';
  private static readonly TOKEN_KEY = 'devskill.firebase.token';
  private static readonly REFRESH_TOKEN_KEY = 'devskill.firebase.refreshToken';
  private static readonly USER_KEY = 'devskill.firebase.user';

  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    authMethod: null,
    lastAuthTime: 0,
    tokenExpiry: 0
  };
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private onAuthStateChangedEmitter = new vscode.EventEmitter<AuthState>();

  /**
   * Event fired when authentication state changes
   */
  readonly onAuthStateChanged = this.onAuthStateChangedEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    private configService: ConfigService
  ) {
    // Try to restore session on initialization
    this.restoreSession();
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return this.authState.user || null;
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      Logger.info('Attempting email/password sign in');

      const apiKey = this.configService.getAuth().firebaseApiKey;
      if (!apiKey) {
        throw new Error('Firebase API key not configured. Please set devskill.auth.firebaseApiKey in settings.');
      }

      const url = `${AuthService.FIREBASE_API_BASE}/accounts:signInWithPassword?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error?.message || 'Sign in failed');
      }

      const data: any = await response.json();
      await this.handleSuccessfulAuth(data);

      Logger.info('Email/password sign in successful');
      vscode.window.showInformationMessage(`Signed in as ${email}`);
    } catch (error) {
      Logger.error('Email/password sign in failed', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    try {
      Logger.info('Attempting email/password sign up');

      const apiKey = this.configService.getAuth().firebaseApiKey;
      if (!apiKey) {
        throw new Error('Firebase API key not configured. Please set devskill.auth.firebaseApiKey in settings.');
      }

      const url = `${AuthService.FIREBASE_API_BASE}/accounts:signUp?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error?.message || 'Sign up failed');
      }

      const data: any = await response.json();
      await this.handleSuccessfulAuth(data);

      Logger.info('Email/password sign up successful');
      vscode.window.showInformationMessage(`Account created for ${email}`);
    } catch (error) {
      Logger.error('Email/password sign up failed', error);
      throw error;
    }
  }

  /**
   * Sign in with Google OAuth (using provider redirect)
   */
  async signInWithGoogle(): Promise<void> {
    try {
      Logger.info('Attempting Google OAuth sign in');

      vscode.window.showInformationMessage(
        'Google Sign-In will be available in a future update. Please use email/password for now.'
      );

      // TODO: Implement Google OAuth flow
      // This requires opening a browser, handling OAuth redirect, and exchanging code for token
      // Will implement in future iteration with proper OAuth handler

    } catch (error) {
      Logger.error('Google sign in failed', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      Logger.info('Signing out user');

      // Clear stored tokens
      await this.context.secrets.delete(AuthService.TOKEN_KEY);
      await this.context.secrets.delete(AuthService.REFRESH_TOKEN_KEY);
      await this.context.globalState.update(AuthService.USER_KEY, undefined);

      // Stop token refresh
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }

      // Update state
      this.authState = {
        isAuthenticated: false,
        user: null,
        authMethod: null,
        lastAuthTime: 0,
        tokenExpiry: 0
      };
      this.onAuthStateChangedEmitter.fire(this.authState);

      Logger.info('Sign out successful');
      vscode.window.showInformationMessage('Signed out successfully');
    } catch (error) {
      Logger.error('Sign out failed', error);
      throw error;
    }
  }

  /**
   * Refresh the authentication token
   */
  async refreshToken(): Promise<void> {
    try {
      const refreshToken = await this.context.secrets.get(AuthService.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const apiKey = this.configService.getAuth().firebaseApiKey;
      if (!apiKey) {
        throw new Error('Firebase API key not configured');
      }

      const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error?.message || 'Token refresh failed');
      }

      const data: any = await response.json();

      // Store new tokens
      await this.context.secrets.store(AuthService.TOKEN_KEY, data.id_token);
      await this.context.secrets.store(AuthService.REFRESH_TOKEN_KEY, data.refresh_token);

      // Update auth state with new token expiry
      if (this.authState.user) {
        this.authState.tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);
      }

      // Schedule next refresh
      this.scheduleTokenRefresh(parseInt(data.expires_in));

      Logger.info('Token refreshed successfully');
    } catch (error) {
      Logger.error('Token refresh failed', error);
      // If refresh fails, sign out user
      await this.signOut();
      vscode.window.showWarningMessage('Session expired. Please sign in again.');
    }
  }

  /**
   * Restore session from stored tokens
   */
  private async restoreSession(): Promise<void> {
    try {
      const token = await this.context.secrets.get(AuthService.TOKEN_KEY);
      const user = this.context.globalState.get<FirebaseUser>(AuthService.USER_KEY);

      if (!token || !user) {
        Logger.info('No stored session found');
        return;
      }

      // Verify token is still valid by getting user info
      const apiKey = this.configService.getAuth().firebaseApiKey;
      if (!apiKey) {
        Logger.warn('Firebase API key not configured, cannot restore session');
        return;
      }

      const url = `${AuthService.FIREBASE_API_BASE}/accounts:lookup?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });

      if (!response.ok) {
        // Token is invalid, clear stored data
        await this.signOut();
        Logger.info('Stored token is invalid, session cleared');
        return;
      }

      const data: any = await response.json();
      const userData = data.users?.[0];

      if (userData) {
        // Restore auth state
        this.authState = {
          isAuthenticated: true,
          user: {
            uid: userData.localId,
            email: userData.email,
            displayName: userData.displayName || userData.email.split('@')[0],
            photoURL: userData.photoUrl || null,
            emailVerified: userData.emailVerified || false
          },
          authMethod: 'email',
          lastAuthTime: Date.now(),
          tokenExpiry: 0  // Will be updated by refreshToken
        };

        this.onAuthStateChangedEmitter.fire(this.authState);

        // Try to refresh token to get expiry time
        await this.refreshToken();

        Logger.info(`Session restored for user: ${userData.email}`);

        if (this.configService.getAuth().enableAutoLogin) {
          vscode.window.showInformationMessage(`Welcome back, ${this.authState.user?.displayName}!`);
        }
      }
    } catch (error) {
      Logger.error('Failed to restore session', error);
      await this.signOut();
    }
  }

  /**
   * Handle successful authentication response
   */
  private async handleSuccessfulAuth(authResponse: any): Promise<void> {
    // Store tokens securely
    await this.context.secrets.store(AuthService.TOKEN_KEY, authResponse.idToken);
    await this.context.secrets.store(AuthService.REFRESH_TOKEN_KEY, authResponse.refreshToken);

    // Create user object
    const user: FirebaseUser = {
      uid: authResponse.localId,
      email: authResponse.email,
      displayName: authResponse.displayName || authResponse.email.split('@')[0],
      photoURL: authResponse.photoUrl || null,
      emailVerified: authResponse.emailVerified || false
    };

    // Store user info
    await this.context.globalState.update(AuthService.USER_KEY, user);

    // Calculate token expiry
    const expiresIn = parseInt(authResponse.expiresIn);
    const tokenExpiry = Date.now() + (expiresIn * 1000);

    // Update auth state
    this.authState = {
      isAuthenticated: true,
      user,
      authMethod: 'email',
      lastAuthTime: Date.now(),
      tokenExpiry
    };

    // Notify listeners
    this.onAuthStateChangedEmitter.fire(this.authState);

    // Schedule token refresh (5 minutes before expiry)
    this.scheduleTokenRefresh(expiresIn);
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Refresh 5 minutes before expiry (or half the expiry time if less than 10 minutes)
    const refreshBuffer = Math.min(300, expiresIn / 2); // 5 minutes or half
    const refreshDelay = (expiresIn - refreshBuffer) * 1000;

    this.tokenRefreshTimer = setTimeout(() => {
      this.refreshToken();
    }, refreshDelay);

    Logger.debug(`Token refresh scheduled in ${refreshDelay / 1000} seconds`);
  }

  /**
   * Get current authentication token
   */
  async getToken(): Promise<string | null> {
    if (!this.authState.isAuthenticated) {
      return null;
    }

    // Check if token needs refresh
    if (this.authState.tokenExpiry && Date.now() >= this.authState.tokenExpiry - 60000) {
      // Token expires in less than 1 minute, refresh it
      await this.refreshToken();
    }

    return await this.context.secrets.get(AuthService.TOKEN_KEY) || null;
  }

  /**
   * Dispose service and clean up
   */
  dispose(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    this.onAuthStateChangedEmitter.dispose();
  }
}

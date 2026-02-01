// src/types/auth.types.ts

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: FirebaseUser | null;
  authMethod: 'google' | 'email' | null;
  lastAuthTime: number;
  tokenExpiry: number;
}

/**
 * Firebase user information
 */
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  email?: string;
  password?: string;
  idToken?: string;                    // For Google Sign-In
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  enableAutoLogin: boolean;
  tokenRefreshThreshold: number;       // ms before expiry to refresh
}

/**
 * Firebase Auth REST API response
 */
export interface FirebaseAuthResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered?: boolean;
  displayName?: string;
  photoUrl?: string;
}

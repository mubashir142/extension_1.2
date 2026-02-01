// src/commands/authCommands.ts

import * as vscode from 'vscode';
import { AuthService } from '../services/AuthService';
import { AuthWebviewProvider } from '../ui/AuthWebviewProvider';
import { Logger } from '../utils/logger';

/**
 * Register all authentication-related commands
 */
export function registerAuthCommands(
  context: vscode.ExtensionContext,
  authService: AuthService
): void {
  // Create webview provider
  const authWebviewProvider = new AuthWebviewProvider(context, authService);

  // Sign In command
  const signInCmd = vscode.commands.registerCommand(
    'devskill-tracker.signIn',
    async () => {
      try {
        // Check if already signed in
        if (authService.isAuthenticated()) {
          const user = authService.getCurrentUser();
          const choice = await vscode.window.showInformationMessage(
            `Already signed in as ${user?.email}`,
            'Sign Out',
            'OK'
          );

          if (choice === 'Sign Out') {
            vscode.commands.executeCommand('devskill-tracker.signOut');
          }
          return;
        }

        // Show webview authentication UI
        authWebviewProvider.show();

      } catch (error: any) {
        Logger.error('Sign in command failed', error);
        vscode.window.showErrorMessage(
          `Failed to show sign in: ${error.message || 'Unknown error'}`
        );
      }
    }
  );

  // Sign Out command
  const signOutCmd = vscode.commands.registerCommand(
    'devskill-tracker.signOut',
    async () => {
      try {
        // Check if signed in
        if (!authService.isAuthenticated()) {
          vscode.window.showInformationMessage('Not signed in');
          return;
        }

        const user = authService.getCurrentUser();
        const confirmation = await vscode.window.showWarningMessage(
          `Sign out from ${user?.email}?`,
          { modal: true },
          'Sign Out'
        );

        if (confirmation !== 'Sign Out') {
          return; // User cancelled
        }

        await authService.signOut();
      } catch (error: any) {
        Logger.error('Sign out command failed', error);
        vscode.window.showErrorMessage(
          `Sign out failed: ${error.message || 'Unknown error'}`
        );
      }
    }
  );

  // Show Auth Status command (for debugging)
  const statusCmd = vscode.commands.registerCommand(
    'devskill-tracker.showAuthStatus',
    () => {
      try {
        const authState = authService.getAuthState();

        if (authState.isAuthenticated && authState.user) {
          const info = [
            `Email: ${authState.user.email}`,
            `Display Name: ${authState.user.displayName}`,
            `UID: ${authState.user.uid}`,
            `Email Verified: ${authState.user.emailVerified}`,
            `Auth Method: ${authState.authMethod}`,
            `Last Auth: ${new Date(authState.lastAuthTime).toLocaleString()}`,
            `Token Expiry: ${new Date(authState.tokenExpiry).toLocaleString()}`
          ].join('\n');

          vscode.window.showInformationMessage(
            `Signed in\n\n${info}`,
            { modal: true }
          );
        } else {
          vscode.window.showInformationMessage('Not signed in');
        }
      } catch (error: any) {
        Logger.error('Show auth status command failed', error);
        vscode.window.showErrorMessage(
          `Failed to show status: ${error.message || 'Unknown error'}`
        );
      }
    }
  );

  context.subscriptions.push(signInCmd, signOutCmd, statusCmd);
  Logger.info('Authentication commands registered');
}

// src/ui/AuthWebviewProvider.ts

import * as vscode from 'vscode';
import { AuthService } from '../services/AuthService';
import { Logger } from '../utils/logger';

/**
 * Provides authentication webview UI
 */
export class AuthWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: AuthService
  ) {}

  /**
   * Show authentication webview
   */
  public show(): void {
    // If panel already exists, reveal it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create new webview panel
    this.panel = vscode.window.createWebviewPanel(
      'devskillAuth',
      'DevSkill Tracker - Sign In',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Close the webview
   */
  public close(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'signIn':
        await this.handleSignIn(message.email, message.password);
        break;

      case 'cancel':
        this.close();
        break;
    }
  }

  /**
   * Handle sign in
   */
  private async handleSignIn(email: string, password: string): Promise<void> {
    try {
      // Send loading state
      this.panel?.webview.postMessage({
        command: 'loading',
        message: 'Signing in...'
      });

      await this.authService.signInWithEmail(email, password);

      // Send success
      this.panel?.webview.postMessage({
        command: 'success',
        message: `Welcome back, ${email}!`
      });

      // Close panel after short delay
      setTimeout(() => {
        this.close();
        vscode.window.showInformationMessage(`Signed in as ${email}`);
      }, 1500);

    } catch (error: any) {
      Logger.error('Sign in failed in webview', error);

      // Send error to webview
      this.panel?.webview.postMessage({
        command: 'error',
        message: this.formatErrorMessage(error.message)
      });
    }
  }

  /**
   * Format error message for display
   */
  private formatErrorMessage(message: string): string {
    // Firebase error messages mapping
    const errorMap: Record<string, string> = {
      'EMAIL_EXISTS': 'This email is already registered. Please sign in instead.',
      'INVALID_PASSWORD': 'Incorrect password. Please try again.',
      'EMAIL_NOT_FOUND': 'No account found with this email. Please sign up first.',
      'INVALID_EMAIL': 'Please enter a valid email address.',
      'WEAK_PASSWORD': 'Password should be at least 6 characters.',
      'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many failed attempts. Please try again later.',
      'USER_DISABLED': 'This account has been disabled.'
    };

    // Check if message contains any known error
    for (const [key, value] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return value;
      }
    }

    return message || 'Authentication failed. Please try again.';
  }

  /**
   * Get webview HTML content
   */
  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevSkill Tracker - Sign In</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 40px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo h1 {
      font-size: 28px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 8px;
    }

    .logo p {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }

    .card {
      background-color: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .tab {
      flex: 1;
      padding: 12px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .tab:hover {
      color: var(--vscode-textLink-foreground);
    }

    .tab.active {
      color: var(--vscode-textLink-foreground);
      border-bottom-color: var(--vscode-textLink-foreground);
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--vscode-input-foreground);
    }

    input {
      width: 100%;
      padding: 10px 12px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus {
      border-color: var(--vscode-focusBorder);
    }

    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .btn {
      width: 100%;
      padding: 12px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-top: 8px;
    }

    .btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      margin-top: 12px;
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .message {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 13px;
      display: none;
    }

    .message.show {
      display: block;
    }

    .message.error {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
    }

    .message.success {
      background-color: var(--vscode-terminal-ansiGreen);
      color: var(--vscode-editor-background);
    }

    .message.loading {
      background-color: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      color: var(--vscode-input-foreground);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-input-foreground);
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>DevSkill Tracker</h1>
      <p>Track your coding journey with AI-powered insights</p>
    </div>

    <div class="card">
      <div id="message" class="message"></div>

      <!-- Sign In Form -->
      <form id="signin-form" onsubmit="handleSignIn(event)">
        <div class="form-group">
          <label for="signin-email">Email Address</label>
          <input
            type="email"
            id="signin-email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="signin-password">Password</label>
          <input
            type="password"
            id="signin-password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn" id="signin-btn">
          Sign In
        </button>

        <button type="button" class="btn btn-secondary" onclick="cancel()">
          Cancel
        </button>

        <p class="help-text" style="margin-top: 16px; text-align: center;">
          Don't have an account? Register at the DevSkill Dashboard first.
        </p>
      </form>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Handle sign in
    function handleSignIn(event) {
      event.preventDefault();

      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;

      // Disable form
      setFormDisabled(true);

      // Send message to extension
      vscode.postMessage({
        command: 'signIn',
        email,
        password
      });
    }

    // Cancel
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    // Show message
    function showMessage(type, text) {
      const messageEl = document.getElementById('message');
      messageEl.className = 'message show ' + type;

      if (type === 'loading') {
        messageEl.innerHTML = '<span class="spinner"></span>' + text;
      } else {
        messageEl.textContent = text;
      }
    }

    // Hide message
    function hideMessage() {
      const messageEl = document.getElementById('message');
      messageEl.className = 'message';
    }

    // Enable/disable form
    function setFormDisabled(disabled) {
      document.querySelectorAll('input, button').forEach(el => {
        el.disabled = disabled;
      });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'loading':
          showMessage('loading', message.message);
          break;

        case 'success':
          showMessage('success', message.message);
          break;

        case 'error':
          showMessage('error', message.message);
          setFormDisabled(false);
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}

// src/extension.ts
import * as vscode from 'vscode';
import { ConfigService } from './services/ConfigService';
import { StorageService } from './services/StorageService';
import { TrackingService } from './services/TrackingService';
import { AuthService } from './services/AuthService';
import { APIService } from './services/APIService';
import { Logger, LogLevel } from './utils/logger';
import { registerAuthCommands } from './commands/authCommands';

/**
 * Global services
 */
let configService: ConfigService;
let storageService: StorageService;
let trackingService: TrackingService;
let authService: AuthService;
let apiService: APIService;
let statusBar: vscode.StatusBarItem;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('DevSkill-Tracker: activating');

  // Initialize logger
  Logger.initialize('DevSkill Tracker', LogLevel.INFO);
  Logger.info('DevSkill-Tracker extension activating');

  try {
    // Initialize core services
    configService = new ConfigService(context);
    storageService = new StorageService(context);
    trackingService = new TrackingService(storageService, configService);
    authService = new AuthService(context, configService);
    apiService = new APIService(configService, authService);

    // Create status bar
    statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBar.command = 'devskill-tracker.stopTracking';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Update status bar initially
    updateStatusBar();

    // Register commands
    registerCommands(context);
    registerAuthCommands(context, authService);

    // Listen to auth state changes to update status bar
    authService.onAuthStateChanged(() => {
      updateStatusBar();
    });

    // Set up status bar update timer
    const statusBarTimer = setInterval(() => updateStatusBar(), 1000);
    context.subscriptions.push({
      dispose: () => clearInterval(statusBarTimer)
    });

    // Register file save listener for automatic code analysis
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (trackingService.isRunning()) {
        // Analyze code on save (temporary processing - code not stored)
        const features = await trackingService.analyzeFile(document);
        if (features) {
          Logger.info(`Auto-analyzed on save: ${document.fileName}`, {
            codeLines: features.codeLines,
            complexity: features.cyclomaticComplexity
          });

          // Send to backend for AI detection if user is authenticated
          if (authService.isAuthenticated()) {
            const user = authService.getCurrentUser();
            const session = trackingService.getSession();

            if (user && session) {
              const aiResult = await apiService.detectAI(
                user.uid,
                session.id,
                document.fileName,
                features
              );

              if (aiResult) {
                Logger.info(`AI Detection result: ${aiResult.aiLikelihoodScore}%`, {
                  confidence: aiResult.confidence,
                  recommendation: aiResult.recommendation
                });
              }
            }
          }
        }
      }
    });
    context.subscriptions.push(saveListener);

    Logger.info('DevSkill-Tracker: commands registered');
    console.log('DevSkill-Tracker: activated successfully');
  } catch (error) {
    Logger.error('Failed to activate extension', error);
    vscode.window.showErrorMessage(`DevSkill Tracker failed to activate: ${error}`);
  }
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Start tracking command
  const startCmd = vscode.commands.registerCommand(
    'devskill-tracker.startTracking',
    () => {
      try {
        trackingService.start();
        updateStatusBar();
      } catch (error) {
        Logger.error('Failed to start tracking', error);
        vscode.window.showErrorMessage(`Failed to start tracking: ${error}`);
      }
    }
  );

  // Stop tracking command
  const stopCmd = vscode.commands.registerCommand(
    'devskill-tracker.stopTracking',
    () => {
      try {
        trackingService.stop();
        updateStatusBar();
      } catch (error) {
        Logger.error('Failed to stop tracking', error);
        vscode.window.showErrorMessage(`Failed to stop tracking: ${error}`);
      }
    }
  );

  // Show data command
  const showCmd = vscode.commands.registerCommand(
    'devskill-tracker.showData',
    () => {
      try {
        showCollectedData();
      } catch (error) {
        Logger.error('Failed to show data', error);
        vscode.window.showErrorMessage(`Failed to show data: ${error}`);
      }
    }
  );

  // Clear data command
  const clearCmd = vscode.commands.registerCommand(
    'devskill-tracker.clearData',
    async () => {
      try {
        const confirmation = await vscode.window.showWarningMessage(
          'Clear all tracking data? This cannot be undone.',
          { modal: true },
          'Clear Data'
        );

        if (confirmation === 'Clear Data') {
          await storageService.clearAll();
          vscode.window.showInformationMessage('All tracking data cleared.');
          Logger.info('All tracking data cleared by user');
        }
      } catch (error) {
        Logger.error('Failed to clear data', error);
        vscode.window.showErrorMessage(`Failed to clear data: ${error}`);
      }
    }
  );

  // Analyze current file command
  const analyzeCmd = vscode.commands.registerCommand(
    'devskill-tracker.analyzeFile',
    async () => {
      try {
        vscode.window.showInformationMessage('Analyzing current file...');
        const features = await trackingService.analyzeCurrentFile();

        if (features) {
          // Show local analysis summary
          const summary = [
            `Code Lines: ${features.codeLines}`,
            `Complexity: ${features.cyclomaticComplexity}`,
            `Functions: ${features.functionCount}`,
            `Paste Ratio: ${(features.pasteRatio * 100).toFixed(1)}%`
          ].join(' | ');

          vscode.window.showInformationMessage(`Local Analysis: ${summary}`);

          // Send to backend for AI detection if authenticated
          if (authService.isAuthenticated()) {
            const user = authService.getCurrentUser();
            const session = trackingService.getSession();
            const editor = vscode.window.activeTextEditor;

            if (user && session && editor) {
              vscode.window.showInformationMessage('Checking for AI-generated code...');

              const aiResult = await apiService.detectAI(
                user.uid,
                session.id,
                editor.document.fileName,
                features
              );

              if (aiResult) {
                const aiSummary = `AI Likelihood: ${aiResult.aiLikelihoodScore.toFixed(1)}% | Confidence: ${aiResult.confidence}%`;
                vscode.window.showInformationMessage(`${aiSummary}\n${aiResult.recommendation}`);
              } else {
                vscode.window.showWarningMessage('Could not connect to backend for AI detection.');
              }
            }
          } else {
            vscode.window.showInformationMessage('Sign in to enable AI detection analysis.');
          }
        }
      } catch (error) {
        Logger.error('Failed to analyze file', error);
        vscode.window.showErrorMessage(`Failed to analyze file: ${error}`);
      }
    }
  );

  context.subscriptions.push(startCmd, stopCmd, showCmd, clearCmd, analyzeCmd);
  context.subscriptions.push(trackingService);
  context.subscriptions.push(authService);
}

/**
 * Update status bar display
 */
function updateStatusBar() {
  // Check authentication state first
  if (!authService.isAuthenticated()) {
    statusBar.text = `$(person) DevSkill: Sign In`;
    statusBar.tooltip = `DevSkill Tracker - Click to sign in`;
    statusBar.command = 'devskill-tracker.signIn';
    return;
  }

  const user = authService.getCurrentUser();
  const userDisplay = user?.displayName || user?.email || 'User';

  if (!trackingService.isRunning()) {
    statusBar.text = `$(circle-slash) DevSkill: Stopped`;
    statusBar.tooltip = `Signed in as ${userDisplay}\nClick to start tracking`;
    statusBar.command = 'devskill-tracker.startTracking';
    return;
  }

  const elapsedMs = trackingService.getElapsedTime();
  const sec = Math.floor(elapsedMs / 1000) % 60;
  const min = Math.floor(elapsedMs / 60000);

  const idleSuffix = trackingService.isIdle() ? ' (Idle)' : '';
  statusBar.text = `$(pulse) DevSkill: ${min}m ${sec}s${idleSuffix}`;

  const keystrokeCount = trackingService.getKeystrokeCount();
  statusBar.tooltip = `${userDisplay}\nRunning — Keystrokes: ${keystrokeCount}\nClick to stop tracking`;
  statusBar.command = 'devskill-tracker.stopTracking';
}

/**
 * Show collected data in output channel
 */
function showCollectedData() {
  const channel = vscode.window.createOutputChannel('DevSkill-Tracker Data');
  channel.clear();

  const session = trackingService.getSession();
  const events = trackingService.getEvents();
  const fileMetrics = trackingService.getFileMetrics();

  channel.appendLine('=== DevSkill-Tracker Collected Data ===');
  channel.appendLine('');

  // Session info
  channel.appendLine('=== Session Information ===');
  if (session) {
    channel.appendLine(JSON.stringify(session, null, 2));
  } else {
    channel.appendLine('No active session');
  }
  channel.appendLine('');

  // Events
  channel.appendLine(`=== Events (${events.length} total) ===`);
  channel.appendLine(JSON.stringify(events, null, 2));
  channel.appendLine('');

  // File metrics
  channel.appendLine(`=== Per File Stats (${Object.keys(fileMetrics).length} files) ===`);
  channel.appendLine(JSON.stringify(fileMetrics, null, 2));
  channel.appendLine('');

  // Storage stats
  const storageStats = storageService.getStorageStats();
  channel.appendLine('=== Storage Statistics ===');
  channel.appendLine(JSON.stringify(storageStats, null, 2));

  channel.show(true);
  Logger.info('Displayed collected data');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('DevSkill-Tracker: deactivating');
  Logger.info('DevSkill-Tracker extension deactivating');

  if (trackingService) {
    trackingService.dispose();
  }

  if (authService) {
    authService.dispose();
  }

  Logger.dispose();
}

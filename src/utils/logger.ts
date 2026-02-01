// src/utils/logger.ts

import * as vscode from 'vscode';

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * Logger utility for centralized logging
 * Provides different log levels and output channel integration
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel | null = null;
  private static logLevel: LogLevel = LogLevel.INFO;

  /**
   * Initialize logger with output channel
   */
  static initialize(channelName: string = 'DevSkill Tracker', level: LogLevel = LogLevel.INFO) {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.logLevel = level;
  }

  /**
   * Set log level
   */
  static setLevel(level: LogLevel) {
    this.logLevel = level;
  }

  /**
   * Log debug message
   */
  static debug(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  /**
   * Log info message
   */
  static info(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  /**
   * Log warning message
   */
  static warn(message: string, ...args: any[]) {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  /**
   * Log error message
   */
  static error(message: string, error?: any) {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, error);
      if (error instanceof Error) {
        this.log('ERROR', `Stack: ${error.stack}`);
      }
    }
  }

  /**
   * Internal logging method
   */
  private static log(level: string, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(formattedMessage, ...args);
    }

    // Log to output channel
    if (this.outputChannel) {
      this.outputChannel.appendLine(formattedMessage);
      if (args.length > 0) {
        this.outputChannel.appendLine(JSON.stringify(args, null, 2));
      }
    }
  }

  /**
   * Show output channel
   */
  static show() {
    this.outputChannel?.show();
  }

  /**
   * Clear output channel
   */
  static clear() {
    this.outputChannel?.clear();
  }

  /**
   * Dispose logger
   */
  static dispose() {
    this.outputChannel?.dispose();
    this.outputChannel = null;
  }
}

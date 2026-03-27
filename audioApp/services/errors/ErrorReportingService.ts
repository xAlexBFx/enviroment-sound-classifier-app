/**
 * Error reporting and handling service
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AudioClassificationError, ErrorSeverity, ErrorType } from './AudioClassificationErrors';

export interface ErrorReport {
  error: AudioClassificationError;
  userAgent?: string;
  platform?: string;
  appVersion?: string;
  timestamp: Date;
}

export interface ErrorEventHandler {
  onError: (error: AudioClassificationError, report: ErrorReport) => void;
  onRecovery?: (error: AudioClassificationError, recoveryAction: string) => void;
}

export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private errorHandlers: ErrorEventHandler[] = [];
  private errorHistory: ErrorReport[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * Register an error handler to receive error notifications
   */
  registerHandler(handler: ErrorEventHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Unregister an error handler
   */
  unregisterHandler(handler: ErrorEventHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  /**
   * Report an error with context
   */
  reportError(error: AudioClassificationError, additionalContext?: Record<string, any>): void {
    const report: ErrorReport = {
      error,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      platform: typeof Platform !== 'undefined' ? Platform.OS : (typeof window !== 'undefined' ? 'web' : 'unknown'),
      appVersion: typeof Constants !== 'undefined' ? Constants.expoConfig?.version : undefined,
      timestamp: new Date()
    };

    // Add additional context to the error
    if (additionalContext) {
      error.context.additionalData = {
        ...error.context.additionalData,
        ...additionalContext
      };
    }

    // Store in history
    this.addToHistory(report);

    // Notify all handlers
    this.notifyHandlers(error, report);

    // Log to console in development
    if (__DEV__) {
      console.group(`🚨 ${error.type} - ${error.severity}`);
      console.error('Error:', error.message);
      console.error('Component:', error.context.component);
      console.error('Action:', error.context.action);
      console.error('Timestamp:', error.context.timestamp);
      if (error.originalError) {
        console.error('Original Error:', error.originalError);
      }
      console.groupEnd();
    }
  }

  /**
   * Create and report a standardized error
   */
  createAndReportError(
    ErrorClass: any,
    message: string,
    component: string,
    action: string,
    additionalData?: Record<string, any>,
    originalError?: Error
  ): void {
    let error: AudioClassificationError;
    
    // Check if it's a custom error class (not the base class)
    if (ErrorClass !== AudioClassificationError) {
      // Custom error classes have signature: (message, context, originalError)
      error = new ErrorClass(message, {
        component,
        action,
        timestamp: new Date(),
        additionalData
      }, originalError);
    } else {
      // Base class uses the full constructor
      error = new ErrorClass(message, undefined, undefined, {
        component,
        action,
        timestamp: new Date(),
        additionalData
      }, originalError);
    }
    
    this.reportError(error);
  }

  /**
   * Get error history
   */
  getErrorHistory(): ErrorReport[] {
    return [...this.errorHistory];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): ErrorReport[] {
    return this.errorHistory.filter(report => report.error.type === type);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.errorHistory.filter(report => report.error.severity === severity);
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.errorHistory.forEach(report => {
      const key = `${report.error.type}_${report.error.severity}`;
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }

  /**
   * Attempt to recover from certain errors
   */
  attemptRecovery(error: AudioClassificationError): boolean {
    let recoveryAction = '';

    switch (error.type) {
      case ErrorType.NETWORK:
        recoveryAction = 'Retrying network request';
        break;
      case ErrorType.AUDIO_RECORDING:
        recoveryAction = 'Reinitializing audio recorder';
        break;
      case ErrorType.PERMISSION:
        recoveryAction = 'Requesting permissions again';
        break;
      case ErrorType.INITIALIZATION:
        recoveryAction = 'Reinitializing service';
        break;
      default:
        return false;
    }

    // Notify handlers about recovery attempt
    this.errorHandlers.forEach(handler => {
      if (handler.onRecovery) {
        handler.onRecovery(error, recoveryAction);
      }
    });

    return true;
  }

  private addToHistory(report: ErrorReport): void {
    this.errorHistory.unshift(report);
    
    // Keep only the most recent errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  private notifyHandlers(error: AudioClassificationError, report: ErrorReport): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler.onError(error, report);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }
}

// Export singleton instance
export const errorReporter = ErrorReportingService.getInstance();

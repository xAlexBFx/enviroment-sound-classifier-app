/**
 * Custom error classes for better error categorization and handling
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUDIO_RECORDING = 'AUDIO_RECORDING',
  CLASSIFICATION = 'CLASSIFICATION',
  PERMISSION = 'PERMISSION',
  INITIALIZATION = 'INITIALIZATION',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  component: string;
  action: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export class AudioClassificationError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = 'AudioClassificationError';
    this.type = type;
    this.severity = severity;
    this.context = {
      component: 'Unknown',
      action: 'Unknown',
      timestamp: new Date(),
      ...context
    };
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioClassificationError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

export class NetworkError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.NETWORK, ErrorSeverity.HIGH, context, originalError);
    this.name = 'NetworkError';
  }
}

export class AudioRecordingError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.AUDIO_RECORDING, ErrorSeverity.HIGH, context, originalError);
    this.name = 'AudioRecordingError';
  }
}

export class ClassificationError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.CLASSIFICATION, ErrorSeverity.MEDIUM, context, originalError);
    this.name = 'ClassificationError';
  }
}

export class PermissionError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.PERMISSION, ErrorSeverity.HIGH, context, originalError);
    this.name = 'PermissionError';
  }
}

export class InitializationError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.INITIALIZATION, ErrorSeverity.CRITICAL, context, originalError);
    this.name = 'InitializationError';
  }
}

export class ValidationError extends AudioClassificationError {
  constructor(message: string, context: Partial<ErrorContext> = {}, originalError?: Error) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.LOW, context, originalError);
    this.name = 'ValidationError';
  }
}

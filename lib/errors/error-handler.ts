// lib/errors/error-handler.ts
export enum ErrorType {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  
  // Server errors (5xx)
  API_ERROR = 'API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Application-specific errors
  DOCEBO_API_ERROR = 'DOCEBO_API_ERROR',
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

export interface ErrorContext {
  userId?: string;
  userRole?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  requestId?: string;
}

export class AppError extends Error {
  public readonly isOperational: boolean;
  public readonly context: ErrorContext;

  constructor(
    public readonly type: ErrorType,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
    public readonly details?: any,
    context: Partial<ErrorContext> = {},
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.isOperational = isOperational;
    this.context = {
      timestamp: Date.now(),
      ...context
    };
    
    // Capture stack trace
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
      details: this.details,
      context: this.context,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }
}

export interface ErrorResponse {
  error: {
    type: string;
    message: string;
    code?: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
    path?: string;
  };
}

export class ErrorHandler {
  private static readonly isDevelopment = process.env.NODE_ENV === 'development';
  private static readonly errorCounts = new Map<string, number>();

  // Main error handling method
  static handle(error: unknown, context: Partial<ErrorContext> = {}): {
    statusCode: number;
    response: ErrorResponse;
  } {
    // Log the error (in production, this would go to a logging service)
    this.logError(error, context);
    
    // Track error for monitoring
    this.trackError(error);

    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        response: this.formatAppError(error)
      };
    }

    if (error instanceof Error) {
      return {
        statusCode: 500,
        response: this.formatGenericError(error, context)
      };
    }

    // Unknown error type
    return {
      statusCode: 500,
      response: this.formatUnknownError(context)
    };
  }

  // Format AppError for response
  private static formatAppError(error: AppError): ErrorResponse {
    return {
      error: {
        type: error.type,
        message: error.userMessage || this.getSafeMessage(error.type),
        code: this.getErrorCode(error.type),
        details: this.isDevelopment ? error.details : undefined
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: error.context.requestId,
        path: error.context.endpoint
      }
    };
  }

  // Format generic Error for response
  private static formatGenericError(error: Error, context: Partial<ErrorContext>): ErrorResponse {
    // Don't expose internal error details in production
    const message = this.isDevelopment 
      ? error.message 
      : 'An internal error occurred. Please try again.';

    return {
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message,
        code: 'INTERNAL_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        path: context.endpoint
      }
    };
  }

  // Format unknown error
  private static formatUnknownError(context: Partial<ErrorContext>): ErrorResponse {
    return {
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
        code: 'UNKNOWN_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        path: context.endpoint
      }
    };
  }

  // Get user-friendly error messages
  private static getSafeMessage(type: ErrorType): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.VALIDATION_ERROR]: 'The request contains invalid data. Please check your input.',
      [ErrorType.AUTHENTICATION_ERROR]: 'Authentication failed. Please check your credentials.',
      [ErrorType.AUTHORIZATION_ERROR]: 'You don\'t have permission to perform this action.',
      [ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please slow down and try again later.',
      [ErrorType.NOT_FOUND_ERROR]: 'The requested resource was not found.',
      [ErrorType.API_ERROR]: 'The external service is currently unavailable. Please try again later.',
      [ErrorType.DATABASE_ERROR]: 'A database error occurred. Please try again.',
      [ErrorType.INTERNAL_ERROR]: 'An internal error occurred. Please try again.',
      [ErrorType.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again later.',
      [ErrorType.DOCEBO_API_ERROR]: 'The Docebo service is currently unavailable. Please try again later.',
      [ErrorType.GEMINI_API_ERROR]: 'The AI service is currently unavailable. Please try again later.',
      [ErrorType.CACHE_ERROR]: 'A caching error occurred. The request may be slower than usual.'
    };

    return messages[type] || 'An error occurred.';
  }

  // Get error codes for client identification
  private static getErrorCode(type: ErrorType): string {
    const codes: Record<ErrorType, string> = {
      [ErrorType.VALIDATION_ERROR]: 'E001',
      [ErrorType.AUTHENTICATION_ERROR]: 'E002',
      [ErrorType.AUTHORIZATION_ERROR]: 'E003',
      [ErrorType.RATE_LIMIT_ERROR]: 'E004',
      [ErrorType.NOT_FOUND_ERROR]: 'E005',
      [ErrorType.API_ERROR]: 'E101',
      [ErrorType.DATABASE_ERROR]: 'E102',
      [ErrorType.INTERNAL_ERROR]: 'E103',
      [ErrorType.SERVICE_UNAVAILABLE]: 'E104',
      [ErrorType.DOCEBO_API_ERROR]: 'E201',
      [ErrorType.GEMINI_API_ERROR]: 'E202',
      [ErrorType.CACHE_ERROR]: 'E203'
    };

    return codes[type] || 'E999';
  }

  // Log errors (in production, send to logging service)
  private static logError(error: unknown, context: Partial<ErrorContext>): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };

    if (this.isDevelopment) {
      console.error('🚨 Error occurred:', JSON.stringify(logData, null, 2));
    } else {
      // In production, send to logging service (Sentry, LogRocket, etc.)
      console.error('Error:', JSON.stringify(logData));
    }
  }

  // Track errors for monitoring
  private static trackError(error: unknown): void {
    let errorKey = 'unknown';
    
    if (error instanceof AppError) {
      errorKey = error.type;
    } else if (error instanceof Error) {
      errorKey = error.name;
    }

    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
  }

  // Get error statistics
  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  // Reset error statistics
  static resetErrorStats(): void {
    this.errorCounts.clear();
  }

  // Create specific error types quickly
  static validationError(message: string, details?: any, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      message,
      400,
      'Invalid input provided. Please check your data.',
      details,
      context
    );
  }

  static authenticationError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      message,
      401,
      'Authentication required. Please log in.',
      undefined,
      context
    );
  }

  static authorizationError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      message,
      403,
      'You don\'t have permission to access this resource.',
      undefined,
      context
    );
  }

  static rateLimitError(message: string, retryAfter?: number, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.RATE_LIMIT_ERROR,
      message,
      429,
      'Too many requests. Please slow down.',
      { retryAfter },
      context
    );
  }

  static notFoundError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.NOT_FOUND_ERROR,
      message,
      404,
      'The requested resource was not found.',
      undefined,
      context
    );
  }

  static doceboApiError(message: string, details?: any, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.DOCEBO_API_ERROR,
      message,
      502,
      'The learning management system is currently unavailable.',
      details,
      context
    );
  }

  static geminiApiError(message: string, details?: any, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.GEMINI_API_ERROR,
      message,
      502,
      'The AI service is currently unavailable.',
      details,
      context
    );
  }

  static internalError(message: string, details?: any, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      ErrorType.INTERNAL_ERROR,
      message,
      500,
      'An internal error occurred. Please try again.',
      details,
      context
    );
  }
}

// Utility function for Next.js API routes
export function handleApiError(error: unknown, context: Partial<ErrorContext> = {}) {
  const { statusCode, response } = ErrorHandler.handle(error, context);
  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Async error boundary wrapper
export function withErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Re-throw AppErrors as-is
      }
      
      // Wrap other errors in AppError
      throw ErrorHandler.internalError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  };
}

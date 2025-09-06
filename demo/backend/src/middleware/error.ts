/**
 * Error Handling Middleware
 * 
 * Provides centralized error handling for the Express application
 * with proper logging, error formatting, and security considerations.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code?: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Custom application error class
 * 
 * Extends the standard Error class with additional properties
 * for better error handling and categorization.
 */
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  /**
   * Create a new application error
   * 
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param code - Optional error code for categorization
   * @param isOperational - Whether this is an operational error
   */
  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * 
 * Catches all unhandled errors in the application and formats
 * them into consistent JSON responses with appropriate logging.
 * 
 * @param error - Error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    code = 'CAST_ERROR';
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Database error';
    code = 'DATABASE_ERROR';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Log error details
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    message: error.message,
    code,
    stack: error.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      'content-type': req.get('content-type'),
      'authorization': req.get('authorization') ? '[REDACTED]' : undefined
    }
  };

  // Log based on severity
  if (statusCode >= 500) {
    console.error('❌ Server Error:', errorLog);
  } else if (statusCode >= 400) {
    console.warn('⚠️  Client Error:', errorLog);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Include additional error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      code,
      details: error.message,
      stack: error.stack
    };
  } else if (code) {
    errorResponse.error = { code };
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * 
 * Handles requests to non-existent endpoints with a consistent
 * JSON response format.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );

  next(error);
};

/**
 * Async error wrapper
 * 
 * Wraps async route handlers to automatically catch and forward
 * any thrown errors to the error handling middleware.
 * 
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors
 * 
 * @example
 * ```typescript
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getUsers();
 *   res.json(users);
 * }));
 * ```
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Rate limiting error handler
 * 
 * Handles rate limiting errors with appropriate messaging
 * and retry information.
 * 
 * @param req - Express request object
 * @param res - Express response object
 */
export const rateLimitHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    message: 'Too many requests, please try again later',
    error: {
      code: 'RATE_LIMIT_EXCEEDED'
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  res.status(429).json(errorResponse);
};

/**
 * Create common application errors
 */
export const createError = {
  /**
   * Create a bad request error (400)
   */
  badRequest: (message: string = 'Bad request', code?: string): AppError => {
    return new AppError(message, 400, code);
  },

  /**
   * Create an unauthorized error (401)
   */
  unauthorized: (message: string = 'Unauthorized', code?: string): AppError => {
    return new AppError(message, 401, code);
  },

  /**
   * Create a forbidden error (403)
   */
  forbidden: (message: string = 'Forbidden', code?: string): AppError => {
    return new AppError(message, 403, code);
  },

  /**
   * Create a not found error (404)
   */
  notFound: (message: string = 'Not found', code?: string): AppError => {
    return new AppError(message, 404, code);
  },

  /**
   * Create a conflict error (409)
   */
  conflict: (message: string = 'Conflict', code?: string): AppError => {
    return new AppError(message, 409, code);
  },

  /**
   * Create an internal server error (500)
   */
  internal: (message: string = 'Internal server error', code?: string): AppError => {
    return new AppError(message, 500, code);
  }
};
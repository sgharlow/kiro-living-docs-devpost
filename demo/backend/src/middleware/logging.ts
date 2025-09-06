/**
 * Logging Middleware
 * 
 * Provides request logging and monitoring capabilities
 * for debugging, analytics, and performance tracking.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Request log entry interface
 */
interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  contentLength?: number;
}

/**
 * Extended Request interface with timing information
 */
interface TimedRequest extends Request {
  startTime?: number;
}

/**
 * Request logging middleware
 * 
 * Logs incoming requests with timing information, user context,
 * and response details for monitoring and debugging purposes.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 * 
 * @example
 * ```typescript
 * app.use(requestLogger);
 * ```
 */
export const requestLogger = (
  req: TimedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Record start time
  req.startTime = Date.now();

  // Get client IP address
  const ip = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown';

  // Prepare initial log entry
  const logEntry: RequestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip,
    userAgent: req.get('user-agent'),
  };

  // Log request start
  console.log(`📥 ${req.method} ${req.path} - ${ip}`);

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    // Calculate response time
    if (req.startTime) {
      logEntry.responseTime = Date.now() - req.startTime;
    }

    // Capture response details
    logEntry.statusCode = res.statusCode;
    logEntry.contentLength = res.get('content-length') ? 
      parseInt(res.get('content-length')!, 10) : undefined;

    // Add user ID if available (from auth middleware)
    const user = (req as any).user;
    if (user) {
      logEntry.userId = user.id;
    }

    // Log response
    const statusEmoji = getStatusEmoji(res.statusCode);
    const responseTimeStr = logEntry.responseTime ? 
      `${logEntry.responseTime}ms` : 'unknown';
    
    console.log(
      `📤 ${statusEmoji} ${req.method} ${req.path} - ` +
      `${res.statusCode} - ${responseTimeStr} - ${ip}` +
      (logEntry.userId ? ` - User: ${logEntry.userId}` : '')
    );

    // Log slow requests
    if (logEntry.responseTime && logEntry.responseTime > 1000) {
      console.warn(`🐌 Slow request detected: ${req.method} ${req.path} took ${responseTimeStr}`);
    }

    // Log errors
    if (res.statusCode >= 400) {
      console.error(`❌ Error response: ${req.method} ${req.path} - ${res.statusCode}`);
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Get emoji for HTTP status code
 * 
 * @param statusCode - HTTP status code
 * @returns Appropriate emoji for the status
 */
function getStatusEmoji(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '✅';
  if (statusCode >= 300 && statusCode < 400) return '↩️';
  if (statusCode >= 400 && statusCode < 500) return '⚠️';
  if (statusCode >= 500) return '❌';
  return '❓';
}

/**
 * Performance monitoring middleware
 * 
 * Tracks and logs performance metrics for API endpoints
 * to identify bottlenecks and optimization opportunities.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export const performanceMonitor = (
  req: TimedRequest,
  res: Response,
  next: NextFunction
): void => {
  req.startTime = Date.now();

  // Track memory usage
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = req.startTime ? endTime - req.startTime : 0;
    const endMemory = process.memoryUsage();
    
    const memoryDelta = {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    // Log performance metrics for slow requests or high memory usage
    if (responseTime > 500 || Math.abs(memoryDelta.heapUsed) > 1024 * 1024) {
      console.log(`📊 Performance: ${req.method} ${req.path}`, {
        responseTime: `${responseTime}ms`,
        memoryDelta: {
          heapUsed: `${Math.round(memoryDelta.heapUsed / 1024)}KB`,
          heapTotal: `${Math.round(memoryDelta.heapTotal / 1024)}KB`
        },
        statusCode: res.statusCode
      });
    }
  });

  next();
};

/**
 * Security logging middleware
 * 
 * Logs security-related events and suspicious activities
 * for monitoring and incident response.
 * 
 * @param req - Express request object
 * @param res - Response object
 * @param next - Next middleware function
 */
export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log authentication attempts
  if (req.path.includes('/auth/') || req.get('authorization')) {
    console.log(`🔐 Auth attempt: ${req.method} ${req.path} - ${req.ip}`);
  }

  // Log admin access attempts
  if (req.path.includes('/admin/')) {
    console.log(`👑 Admin access: ${req.method} ${req.path} - ${req.ip}`);
  }

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i  // JavaScript injection
  ];

  const fullUrl = req.originalUrl || req.url;
  const body = JSON.stringify(req.body);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl) || pattern.test(body)) {
      console.warn(`🚨 Suspicious request detected: ${req.method} ${req.path} - ${req.ip}`, {
        url: fullUrl,
        userAgent: req.get('user-agent'),
        body: req.body
      });
      break;
    }
  }

  next();
};

/**
 * API usage analytics middleware
 * 
 * Collects usage statistics for API endpoints to understand
 * usage patterns and plan capacity.
 * 
 * @param req - Express request object
 * @param res - Response object
 * @param next - Next middleware function
 */
export const analyticsLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Simple in-memory analytics (in production, use a proper analytics service)
  const analytics = {
    endpoint: `${req.method} ${req.route?.path || req.path}`,
    timestamp: new Date().toISOString(),
    userAgent: req.get('user-agent'),
    ip: req.ip,
    userId: (req as any).user?.id
  };

  res.on('finish', () => {
    // Log API usage for analytics
    console.log(`📈 API Usage:`, {
      ...analytics,
      statusCode: res.statusCode,
      responseTime: req.startTime ? Date.now() - req.startTime : undefined
    });
  });

  next();
};
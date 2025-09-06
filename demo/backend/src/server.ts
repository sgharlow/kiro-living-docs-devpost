/**
 * Demo Backend Server
 * 
 * Express.js API server demonstrating TypeScript documentation generation
 * capabilities. Provides user management endpoints with authentication,
 * validation, and comprehensive API documentation.
 * 
 * This server showcases:
 * - RESTful API design patterns
 * - TypeScript interfaces and types
 * - Express middleware usage
 * - Authentication and authorization
 * - Input validation and error handling
 * - Comprehensive JSDoc documentation
 * 
 * @example
 * ```bash
 * # Start development server
 * npm run dev
 * 
 * # Build and start production server
 * npm run build && npm start
 * ```
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import userRoutes from './routes/users';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';

// Mock implementations for demo purposes
// In production, install and use the actual packages: cors, helmet, morgan
const mockCors = () => (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

const mockHelmet = () => (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

const mockMorgan = () => (req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url} - ${req.ip}`);
  next();
};

/**
 * Server configuration interface
 */
export interface ServerConfig {
  /** Server port number */
  port: number;
  /** Environment (development, production, test) */
  environment: string;
  /** Enable request logging */
  enableLogging: boolean;
  /** CORS configuration */
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

/**
 * Demo Backend Server Class
 * 
 * Manages the Express.js application lifecycle including middleware setup,
 * route registration, error handling, and server startup/shutdown.
 * 
 * @example
 * ```typescript
 * const server = new DemoBackendServer({
 *   port: 3001,
 *   environment: 'development',
 *   enableLogging: true,
 *   cors: { origin: '*', credentials: false }
 * });
 * 
 * await server.start();
 * ```
 */
export class DemoBackendServer {
  private app: Application;
  private config: ServerConfig;
  private server?: any;

  /**
   * Initialize the server with configuration
   * 
   * @param config - Server configuration options
   */
  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware stack
   * 
   * Sets up security, parsing, logging, and CORS middleware
   * in the correct order for optimal performance and security.
   * 
   * @private
   */
  private setupMiddleware(): void {
    // Security middleware (mock implementation)
    this.app.use(mockHelmet());

    // CORS configuration (mock implementation)
    this.app.use(mockCors());

    // Request parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (this.config.enableLogging) {
      this.app.use(mockMorgan());
      this.app.use(requestLogger);
    }
  }

  /**
   * Register API routes and endpoints
   * 
   * Mounts all route handlers under appropriate prefixes
   * and sets up API versioning structure.
   * 
   * @private
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck);

    // API information endpoint
    this.app.get('/api', this.handleApiInfo);

    // API v1 routes
    this.app.use('/api/v1/users', userRoutes);

    // Root endpoint
    this.app.get('/', this.handleRoot);
  }

  /**
   * Configure error handling middleware
   * 
   * Sets up 404 handler and global error handler as the last
   * middleware in the stack to catch all unhandled errors.
   * 
   * @private
   */
  private setupErrorHandling(): void {
    // 404 handler for unmatched routes
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Health check endpoint handler
   * 
   * Provides system health information for monitoring
   * and load balancer health checks.
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  private handleHealthCheck = (req: Request, res: Response): void => {
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.config.environment,
      version: '1.0.0',
      service: 'demo-backend',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    res.status(200).json(healthInfo);
  };

  /**
   * API information endpoint handler
   * 
   * Provides API documentation and available endpoints
   * for developers and automated tools.
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  private handleApiInfo = (req: Request, res: Response): void => {
    const apiInfo = {
      name: 'Demo Backend API',
      version: '1.0.0',
      description: 'RESTful API for user management and authentication',
      documentation: 'Generated by Living Documentation Generator',
      endpoints: {
        health: 'GET /health - System health check',
        users: {
          list: 'GET /api/v1/users - List all users',
          get: 'GET /api/v1/users/:id - Get user by ID',
          create: 'POST /api/v1/users - Create new user',
          update: 'PATCH /api/v1/users/:id - Update user',
          delete: 'DELETE /api/v1/users/:id - Delete user',
          stats: 'GET /api/v1/users/stats - User statistics',
        },
      },
      authentication: 'Bearer token required for protected endpoints',
      rateLimit: 'No rate limiting in demo mode',
    };

    res.status(200).json(apiInfo);
  };

  /**
   * Root endpoint handler
   * 
   * Provides basic API information and welcome message
   * for users accessing the root URL.
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  private handleRoot = (req: Request, res: Response): void => {
    res.status(200).json({
      message: 'Welcome to Demo Backend API',
      version: '1.0.0',
      documentation: '/api',
      health: '/health',
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Start the HTTP server
   * 
   * Begins listening for incoming requests on the configured port.
   * Returns a promise that resolves when the server is ready.
   * 
   * @returns Promise that resolves when server starts successfully
   * @throws Error if server fails to start
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`🚀 Demo Backend Server started`);
          console.log(`📍 Port: ${this.config.port}`);
          console.log(`🌍 Environment: ${this.config.environment}`);
          console.log(`📊 Health: http://localhost:${this.config.port}/health`);
          console.log(`📚 API Info: http://localhost:${this.config.port}/api`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          console.error('❌ Server failed to start:', error);
          reject(error);
        });
      } catch (error) {
        console.error('❌ Failed to start server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server gracefully
   * 
   * Closes all connections and stops accepting new requests.
   * Returns a promise that resolves when shutdown is complete.
   * 
   * @returns Promise that resolves when server stops successfully
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error?: Error) => {
        if (error) {
          console.error('❌ Error stopping server:', error);
          reject(error);
        } else {
          console.log('✅ Demo Backend Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get the Express application instance
   * 
   * Useful for testing and advanced configuration scenarios.
   * 
   * @returns Express application instance
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Get current server configuration
   * 
   * @returns Server configuration object
   */
  public getConfig(): ServerConfig {
    return { ...this.config };
  }
}

/**
 * Create default server configuration
 * 
 * Generates configuration from environment variables with sensible defaults.
 * 
 * @returns Default server configuration
 */
function createDefaultConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    environment: process.env.NODE_ENV || 'development',
    enableLogging: process.env.NODE_ENV !== 'test',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  };
}

/**
 * Main server startup function
 * 
 * Creates and starts the server with default configuration.
 * Handles graceful shutdown on process termination signals.
 */
async function main(): Promise<void> {
  const config = createDefaultConfig();
  const server = new DemoBackendServer(config);

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}

export default DemoBackendServer;
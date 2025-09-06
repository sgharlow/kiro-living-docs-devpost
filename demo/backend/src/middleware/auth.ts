/**
 * Authentication and Authorization Middleware
 * 
 * Provides JWT token validation and role-based access control
 * for protecting API endpoints and ensuring proper user permissions.
 */

import { Request, Response, NextFunction } from 'express';
import { UserResponse } from '../types/User';

// Mock JWT implementation for demo purposes
// In a real application, use the 'jsonwebtoken' package
const mockJwt = {
  sign: (payload: any, secret: string, options?: any): string => {
    // Simple base64 encoding for demo - NOT secure for production
    return Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64');
  },
  verify: (token: string, secret: string): any => {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.exp < Date.now()) {
        throw new Error('Token expired');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  },
  JsonWebTokenError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
  TokenExpiredError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  }
};

/**
 * JWT payload interface
 */
export interface JWTPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Extended Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: UserResponse;
}

/**
 * JWT secret key (in production, this should be from environment variables)
 */
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production';

/**
 * Authentication middleware
 * 
 * Validates JWT tokens from the Authorization header and attaches
 * user information to the request object for downstream middleware.
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Next middleware function
 * 
 * @example
 * ```typescript
 * router.get('/protected', authenticateToken, (req, res) => {
 *   const user = (req as AuthenticatedRequest).user;
 *   res.json({ message: `Hello ${user?.name}` });
 * });
 * ```
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    // Verify JWT token
    const decoded = mockJwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // In a real application, you would fetch user from database
    // For demo purposes, we'll create a mock user based on token
    const user: UserResponse = {
      id: decoded.userId,
      email: `user${decoded.userId}@example.com`,
      name: `User ${decoded.userId}`,
      role: decoded.role,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: true
    };

    // Attach user to request
    (req as AuthenticatedRequest).user = user;
    next();

  } catch (error) {
    if (error instanceof mockJwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid access token'
      });
    } else if (error instanceof mockJwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Access token expired'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }
};

/**
 * Role-based authorization middleware factory
 * 
 * Creates middleware that checks if the authenticated user has
 * the required role to access a specific endpoint.
 * 
 * @param requiredRole - The role required to access the endpoint
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.delete('/users/:id', 
 *   authenticateToken, 
 *   requireRole('admin'), 
 *   deleteUserHandler
 * );
 * ```
 */
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (user.role !== requiredRole) {
      res.status(403).json({
        success: false,
        message: `${requiredRole} role required`
      });
      return;
    }

    next();
  };
};

/**
 * Multiple roles authorization middleware factory
 * 
 * Creates middleware that checks if the authenticated user has
 * any of the specified roles to access an endpoint.
 * 
 * @param allowedRoles - Array of roles that can access the endpoint
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.get('/admin-or-moderator', 
 *   authenticateToken, 
 *   requireAnyRole(['admin', 'moderator']), 
 *   handler
 * );
 * ```
 */
export const requireAnyRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: `One of the following roles required: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

/**
 * Resource ownership middleware factory
 * 
 * Creates middleware that checks if the authenticated user owns
 * the resource they're trying to access (or is an admin).
 * 
 * @param resourceIdParam - Name of the route parameter containing resource ID
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.put('/users/:id', 
 *   authenticateToken, 
 *   requireOwnership('id'), 
 *   updateUserHandler
 * );
 * ```
 */
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    const resourceId = req.params[resourceIdParam];

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Admin can access any resource
    if (user.role === 'admin') {
      next();
      return;
    }

    // User can only access their own resources
    if (user.id !== resourceId) {
      res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
      return;
    }

    next();
  };
};

/**
 * Generate JWT token for user
 * 
 * Creates a signed JWT token containing user ID and role information.
 * Used during login to provide authentication credentials.
 * 
 * @param userId - User's unique identifier
 * @param role - User's role in the system
 * @param expiresIn - Token expiration time (default: 24h)
 * @returns Signed JWT token string
 * 
 * @example
 * ```typescript
 * const token = generateToken('user123', 'admin', '7d');
 * res.json({ token, expiresIn: '7 days' });
 * ```
 */
export const generateToken = (
  userId: string, 
  role: string, 
  expiresIn: string = '24h'
): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    role
  };

  return mockJwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verify and decode JWT token
 * 
 * Validates a JWT token and returns the decoded payload.
 * Useful for token validation outside of middleware context.
 * 
 * @param token - JWT token string
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = verifyToken(token);
 *   console.log('User ID:', payload.userId);
 * } catch (error) {
 *   console.error('Invalid token:', error.message);
 * }
 * ```
 */
export const verifyToken = (token: string): JWTPayload => {
  return mockJwt.verify(token, JWT_SECRET) as JWTPayload;
};
/**
 * Request Validation Middleware
 * 
 * Provides simple input validation for API endpoints
 * to ensure data integrity and security before processing requests.
 * 
 * Note: This is a simplified demo implementation. In production,
 * use a proper validation library like Joi, Yup, or Zod.
 */

import { Request, Response, NextFunction } from 'express';
import { CreateUserDTO, UpdateUserDTO } from '../types/User';

/**
 * Validation error response interface
 */
interface ValidationError {
  success: false;
  message: string;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Simple validation helper functions
 */
const validators = {
  isEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  isUUID: (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  },
  
  isValidRole: (role: string): boolean => {
    return ['admin', 'user', 'moderator'].includes(role);
  }
};

/**
 * Validate user creation data
 */
function validateCreateUserData(data: any): { isValid: boolean; errors: any[] } {
  const errors: any[] = [];
  
  // Required fields
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!validators.isEmail(data.email)) {
    errors.push({ field: 'email', message: 'Please provide a valid email address', value: data.email });
  }
  
  if (!data.name) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (data.name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long', value: data.name });
  }
  
  if (!data.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (data.password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
  }
  
  // Optional fields
  if (data.role && !validators.isValidRole(data.role)) {
    errors.push({ field: 'role', message: 'Role must be "admin", "user", or "moderator"', value: data.role });
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate user update data
 */
function validateUpdateUserData(data: any): { isValid: boolean; errors: any[] } {
  const errors: any[] = [];
  
  // All fields are optional for updates
  if (data.email && !validators.isEmail(data.email)) {
    errors.push({ field: 'email', message: 'Please provide a valid email address', value: data.email });
  }
  
  if (data.name && data.name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long', value: data.name });
  }
  
  if (data.role && !validators.isValidRole(data.role)) {
    errors.push({ field: 'role', message: 'Role must be "admin", "user", or "moderator"', value: data.role });
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate user creation request body
 * 
 * Middleware that validates POST /users request body
 * 
 * @example
 * ```typescript
 * router.post('/users', validateCreateUser, createUserHandler);
 * ```
 */
export const validateCreateUser = (req: Request, res: Response, next: NextFunction): void => {
  const validation = validateCreateUserData(req.body);
  
  if (!validation.isValid) {
    const validationError: ValidationError = {
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    };
    
    res.status(400).json(validationError);
    return;
  }
  
  next();
};

/**
 * Validate user update request body
 * 
 * Middleware that validates PATCH /users/:id request body
 * 
 * @example
 * ```typescript
 * router.patch('/users/:id', validateUpdateUser, updateUserHandler);
 * ```
 */
export const validateUpdateUser = (req: Request, res: Response, next: NextFunction): void => {
  const validation = validateUpdateUserData(req.body);
  
  if (!validation.isValid) {
    const validationError: ValidationError = {
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    };
    
    res.status(400).json(validationError);
    return;
  }
  
  next();
};

/**
 * Validate user ID parameter
 * 
 * Middleware that validates route parameters containing user IDs
 * 
 * @example
 * ```typescript
 * router.get('/users/:id', validateUserId, getUserHandler);
 * ```
 */
export const validateUserId = (req: Request, res: Response, next: NextFunction): void => {
  const userId = req.params.id;
  
  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'User ID is required',
      errors: [{ field: 'id', message: 'User ID parameter is missing' }]
    });
    return;
  }
  
  // For demo purposes, accept any non-empty string as valid ID
  // In production, validate UUID format
  if (userId.length < 1) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID format',
      errors: [{ field: 'id', message: 'User ID must be a valid identifier', value: userId }]
    });
    return;
  }
  
  next();
};

/**
 * Validate query parameters for user listing
 * 
 * Middleware that validates and sanitizes query parameters
 * for GET /users endpoint with filtering and pagination.
 * 
 * @example
 * ```typescript
 * router.get('/users', validateUserQuery, getUsersHandler);
 * ```
 */
export const validateUserQuery = (req: Request, res: Response, next: NextFunction): void => {
  const errors: any[] = [];
  
  // Validate role filter
  if (req.query.role && !validators.isValidRole(req.query.role as string)) {
    errors.push({
      field: 'role',
      message: 'Role must be "admin", "user", or "moderator"',
      value: req.query.role
    });
  }
  
  // Validate pagination parameters
  if (req.query.limit) {
    const limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be a number between 1 and 100',
        value: req.query.limit
      });
    }
  }
  
  if (req.query.offset) {
    const offset = parseInt(req.query.offset as string, 10);
    if (isNaN(offset) || offset < 0) {
      errors.push({
        field: 'offset',
        message: 'Offset must be a non-negative number',
        value: req.query.offset
      });
    }
  }
  
  if (errors.length > 0) {
    const validationError: ValidationError = {
      success: false,
      message: 'Invalid query parameters',
      errors
    };
    
    res.status(400).json(validationError);
    return;
  }
  
  next();
};

/**
 * Validate pagination parameters
 * 
 * Generic middleware for validating common pagination parameters
 * used across multiple endpoints.
 * 
 * @example
 * ```typescript
 * router.get('/items', validatePagination, getItemsHandler);
 * ```
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const errors: any[] = [];
  
  // Set defaults
  req.query.limit = req.query.limit || '20';
  req.query.offset = req.query.offset || '0';
  
  // Validate limit
  const limit = parseInt(req.query.limit as string, 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push({
      field: 'limit',
      message: 'Limit must be a number between 1 and 100'
    });
  }
  
  // Validate offset
  const offset = parseInt(req.query.offset as string, 10);
  if (isNaN(offset) || offset < 0) {
    errors.push({
      field: 'offset',
      message: 'Offset must be a non-negative number'
    });
  }
  
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid pagination parameters',
      errors
    });
    return;
  }
  
  next();
};

/**
 * Custom validation helper for complex business rules
 * 
 * Provides additional validation beyond basic validation
 * for complex business logic requirements.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 * 
 * @example
 * ```typescript
 * router.post('/users', validateCreateUser, validateBusinessRules, createUserHandler);
 * ```
 */
export const validateBusinessRules = (req: Request, res: Response, next: NextFunction): void => {
  const errors: Array<{ field: string; message: string }> = [];

  // Example: Check if email domain is allowed (demo rule)
  if (req.body.email) {
    const emailDomain = req.body.email.split('@')[1];
    const blockedDomains = ['tempmail.com', 'throwaway.email'];
    
    if (blockedDomains.includes(emailDomain)) {
      errors.push({
        field: 'email',
        message: 'Email domain is not allowed'
      });
    }
  }

  // Example: Validate password strength (demo rule)
  if (req.body.password) {
    const password = req.body.password;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Business rule validation failed',
      errors
    });
    return;
  }

  next();
};
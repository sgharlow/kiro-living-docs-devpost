import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { CreateUserDTO, UpdateUserDTO } from '../types/User';
import { validateCreateUser, validateUpdateUser, validateUserId } from '../middleware/validation';
import { authenticateToken, requireRole } from '../middleware/auth';

/**
 * User routes handler
 * 
 * Provides RESTful API endpoints for user management including
 * CRUD operations, authentication, and user statistics.
 * 
 * @example
 * ```
 * GET    /api/users          - List all users (admin only)
 * GET    /api/users/:id      - Get user by ID
 * POST   /api/users          - Create new user
 * PATCH  /api/users/:id      - Update user
 * DELETE /api/users/:id      - Delete user (admin only)
 * GET    /api/users/stats    - Get user statistics (admin only)
 * ```
 */
const router = Router();
const userService = new UserService();

/**
 * GET /users
 * Retrieve all users with optional filtering and pagination
 * 
 * Query parameters:
 * - role: Filter by user role
 * - isActive: Filter by active status
 * - search: Search by name or email
 * - limit: Number of results per page (default: 50)
 * - offset: Number of results to skip (default: 0)
 * 
 * @requires Authentication
 * @requires Admin role for full access
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      role,
      isActive,
      search,
      limit = '50',
      offset = '0'
    } = req.query;

    const filters = {
      role: role as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    };

    const users = await userService.getUsers(filters);
    
    res.json({
      success: true,
      users,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: users.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /users/:id
 * Retrieve a specific user by their ID
 * 
 * @param id - User UUID
 * @requires Authentication
 * @returns User data or 404 if not found
 */
router.get('/:id', authenticateToken, validateUserId, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /users
 * Create a new user account
 * 
 * @body CreateUserDTO - User creation data
 * @requires Admin role (or public registration if enabled)
 * @returns Created user data and authentication token
 */
router.post('/', validateCreateUser, async (req: Request, res: Response) => {
  try {
    const userData: CreateUserDTO = req.body;
    
    // Check if user already exists
    const existingUser = await userService.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await userService.createUser(userData);
    
    res.status(201).json({
      success: true,
      user,
      message: 'User created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create user'
    });
  }
});

/**
 * PATCH /users/:id
 * Update an existing user's information
 * 
 * @param id - User UUID
 * @body UpdateUserDTO - Partial user data to update
 * @requires Authentication
 * @requires Admin role or own user
 * @returns Updated user data
 */
router.patch('/:id', authenticateToken, validateUserId, validateUpdateUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: UpdateUserDTO = req.body;
    
    // Check if user exists
    const existingUser = await userService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Authorization check: users can only update themselves unless admin
    const currentUser = (req as any).user;
    if (currentUser.id !== id && currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const updatedUser = await userService.updateUser(id, updates);
    
    res.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update user'
    });
  }
});

/**
 * DELETE /users/:id
 * Delete a user account (soft delete - marks as inactive)
 * 
 * @param id - User UUID
 * @requires Authentication
 * @requires Admin role
 * @returns Success confirmation
 */
router.delete('/:id', authenticateToken, requireRole('admin'), validateUserId, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingUser = await userService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await userService.deleteUser(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete user'
    });
  }
});

/**
 * GET /users/stats
 * Retrieve user statistics and analytics
 * 
 * @requires Authentication
 * @requires Admin role
 * @returns User statistics including counts, demographics, and activity metrics
 */
router.get('/stats', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await userService.getUserStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch user statistics'
    });
  }
});

/**
 * POST /users/:id/activate
 * Activate a user account
 * 
 * @param id - User UUID
 * @requires Authentication
 * @requires Admin role
 */
router.post('/:id/activate', authenticateToken, requireRole('admin'), validateUserId, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await userService.updateUser(id, { isActive: true });
    
    res.json({
      success: true,
      user,
      message: 'User activated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to activate user'
    });
  }
});

/**
 * POST /users/:id/deactivate
 * Deactivate a user account
 * 
 * @param id - User UUID
 * @requires Authentication
 * @requires Admin role
 */
router.post('/:id/deactivate', authenticateToken, requireRole('admin'), validateUserId, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await userService.updateUser(id, { isActive: false });
    
    res.json({
      success: true,
      user,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to deactivate user'
    });
  }
});

export default router;
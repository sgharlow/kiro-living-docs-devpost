import { User, CreateUserDTO, UpdateUserDTO, UserResponse, UserStats } from '../types/User';

// Mock implementations for demo purposes
// In production, install and use the actual packages: uuid, bcrypt
const mockUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const mockBcrypt = {
  hash: async (password: string, saltRounds: number): Promise<string> => {
    // Simple hash for demo - NOT secure for production
    return Buffer.from(password + 'salt').toString('base64');
  },
  compare: async (password: string, hash: string): Promise<boolean> => {
    // Simple comparison for demo - NOT secure for production
    const expectedHash = Buffer.from(password + 'salt').toString('base64');
    return hash === expectedHash;
  }
};

/**
 * In-memory user storage for demo purposes
 * In a real application, this would be replaced with a database
 */
const users: Map<string, User> = new Map();

/**
 * User service class handling all user-related business logic
 * 
 * Provides methods for user CRUD operations, authentication,
 * and analytics. Includes proper error handling and data validation.
 * 
 * @example
 * ```typescript
 * const userService = new UserService();
 * 
 * // Create a new user
 * const user = await userService.createUser({
 *   email: 'john@example.com',
 *   name: 'John Doe',
 *   password: 'securePassword123'
 * });
 * 
 * // Get user by ID
 * const foundUser = await userService.getUserById(user.id);
 * ```
 */
export class UserService {
  private readonly saltRounds = 12;

  constructor() {
    // Initialize with some demo users
    this.initializeDemoUsers();
  }

  /**
   * Create demo users for testing and demonstration
   * 
   * @private
   */
  private async initializeDemoUsers(): Promise<void> {
    const demoUsers = [
      {
        email: 'admin@example.com',
        name: 'Admin User',
        password: 'admin123',
        role: 'admin' as const
      },
      {
        email: 'john@example.com',
        name: 'John Doe',
        password: 'user123',
        role: 'user' as const
      },
      {
        email: 'jane@example.com',
        name: 'Jane Smith',
        password: 'user123',
        role: 'moderator' as const
      }
    ];

    for (const userData of demoUsers) {
      try {
        await this.createUser(userData);
      } catch (error) {
        // User might already exist, ignore error
      }
    }
  }

  /**
   * Create a new user account
   * 
   * @param userData - User creation data
   * @returns Promise resolving to the created user (without password)
   * @throws Error if email already exists or validation fails
   */
  async createUser(userData: CreateUserDTO): Promise<UserResponse> {
    // Validate email uniqueness
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, this.saltRounds);

    // Create user object
    const user: User = {
      id: uuidv4(),
      email: userData.email.toLowerCase(),
      name: userData.name,
      passwordHash,
      role: userData.role || 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: false,
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          marketing: false
        },
        dashboard: {
          layout: 'grid',
          itemsPerPage: 20
        },
        ...userData.preferences
      }
    };

    // Store user
    users.set(user.id, user);

    return this.toUserResponse(user);
  }

  /**
   * Retrieve a user by their ID
   * 
   * @param userId - The user's unique identifier
   * @returns Promise resolving to user data or null if not found
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    const user = users.get(userId);
    return user ? this.toUserResponse(user) : null;
  }

  /**
   * Retrieve a user by their email address
   * 
   * @param email - The user's email address
   * @returns Promise resolving to user data or null if not found
   */
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    const user = Array.from(users.values()).find(u => u.email === email.toLowerCase());
    return user ? this.toUserResponse(user) : null;
  }

  /**
   * Retrieve all users with optional filtering
   * 
   * @param filters - Optional filters for the user query
   * @returns Promise resolving to array of users
   */
  async getUsers(filters?: {
    role?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserResponse[]> {
    let userList = Array.from(users.values());

    // Apply filters
    if (filters) {
      if (filters.role) {
        userList = userList.filter(user => user.role === filters.role);
      }

      if (filters.isActive !== undefined) {
        userList = userList.filter(user => user.isActive === filters.isActive);
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        userList = userList.filter(user => 
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm)
        );
      }

      // Apply pagination
      if (filters.offset) {
        userList = userList.slice(filters.offset);
      }

      if (filters.limit) {
        userList = userList.slice(0, filters.limit);
      }
    }

    return userList.map(user => this.toUserResponse(user));
  }

  /**
   * Update an existing user's information
   * 
   * @param userId - The ID of the user to update
   * @param updates - Partial user data to update
   * @returns Promise resolving to the updated user
   * @throws Error if user not found
   */
  async updateUser(userId: string, updates: UpdateUserDTO): Promise<UserResponse> {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Apply updates
    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
      // Merge preferences if provided
      preferences: updates.preferences ? {
        ...user.preferences,
        ...updates.preferences
      } : user.preferences
    };

    users.set(userId, updatedUser);
    return this.toUserResponse(updatedUser);
  }

  /**
   * Delete a user account (soft delete - marks as inactive)
   * 
   * @param userId - The ID of the user to delete
   * @returns Promise resolving when deletion is complete
   * @throws Error if user not found
   */
  async deleteUser(userId: string): Promise<void> {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete by marking as inactive
    const updatedUser: User = {
      ...user,
      isActive: false,
      updatedAt: new Date()
    };

    users.set(userId, updatedUser);
  }

  /**
   * Authenticate a user with email and password
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise resolving to user data if authentication succeeds
   * @throws Error if authentication fails
   */
  async authenticateUser(email: string, password: string): Promise<UserResponse> {
    const user = Array.from(users.values()).find(u => u.email === email.toLowerCase());
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login time
    user.lastLoginAt = new Date();
    users.set(user.id, user);

    return this.toUserResponse(user);
  }

  /**
   * Get user statistics for analytics dashboard
   * 
   * @returns Promise resolving to user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const allUsers = Array.from(users.values());
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats: UserStats = {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(user => user.isActive).length,
      newUsersThisMonth: allUsers.filter(user => user.createdAt >= thisMonth).length,
      usersByRole: {},
      averageSessionDuration: 0, // Would be calculated from session data
      topCountries: [] // Would be calculated from user location data
    };

    // Calculate users by role
    allUsers.forEach(user => {
      stats.usersByRole[user.role] = (stats.usersByRole[user.role] || 0) + 1;
    });

    return stats;
  }

  /**
   * Search users by name or email
   * 
   * @param query - Search query string
   * @param limit - Maximum number of results
   * @returns Promise resolving to matching users
   */
  async searchUsers(query: string, limit: number = 10): Promise<UserResponse[]> {
    return this.getUsers({ search: query, limit });
  }

  /**
   * Convert internal User object to UserResponse (removes sensitive data)
   * 
   * @param user - Internal user object
   * @returns User response object safe for API responses
   * @private
   */
  private toUserResponse(user: User): UserResponse {
    const { passwordHash, ...userResponse } = user;
    return userResponse;
  }

  /**
   * Validate user data for creation or updates
   * 
   * @param userData - User data to validate
   * @throws Error if validation fails
   * @private
   */
  private validateUserData(userData: Partial<CreateUserDTO | UpdateUserDTO>): void {
    if (userData.email && !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    if (userData.name && userData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    if ('password' in userData && userData.password && userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
  }

  /**
   * Validate email format
   * 
   * @param email - Email address to validate
   * @returns True if email format is valid
   * @private
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
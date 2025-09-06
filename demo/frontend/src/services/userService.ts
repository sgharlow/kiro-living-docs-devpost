import axios from 'axios';
import { User, CreateUserRequest, UserResponse } from '../types/User';

/**
 * Configuration for the user service
 */
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * HTTP client configured for user API calls
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * User service for managing user-related API operations
 * 
 * Provides methods for CRUD operations on user data,
 * with proper error handling and type safety.
 * 
 * @example
 * ```typescript
 * // Get a user by ID
 * const user = await userService.getUser('123');
 * 
 * // Create a new user
 * const newUser = await userService.createUser({
 *   email: 'john@example.com',
 *   name: 'John Doe'
 * });
 * 
 * // Update user preferences
 * await userService.updateUser('123', {
 *   preferences: { theme: 'dark' }
 * });
 * ```
 */
export class UserService {
  /**
   * Retrieve a user by their ID
   * 
   * @param userId - The unique identifier for the user
   * @returns Promise resolving to the user data
   * @throws Error if user not found or request fails
   */
  async getUser(userId: string): Promise<User> {
    try {
      const response = await apiClient.get<UserResponse>(`/users/${userId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch user');
      }
      
      return response.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('User not found');
        }
        throw new Error(error.response?.data?.message || 'Network error occurred');
      }
      throw error;
    }
  }

  /**
   * Retrieve all users with optional filtering
   * 
   * @param filters - Optional filters for the user list
   * @returns Promise resolving to array of users
   */
  async getUsers(filters?: {
    role?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });
      }

      const response = await apiClient.get<{ users: User[]; success: boolean }>(`/users?${params}`);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch users');
      }
      
      return response.data.users;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to fetch users');
      }
      throw error;
    }
  }

  /**
   * Create a new user account
   * 
   * @param userData - The user data for account creation
   * @returns Promise resolving to the created user
   * @throws Error if creation fails or validation errors occur
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await apiClient.post<UserResponse>('/users', userData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create user');
      }
      
      return response.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid user data');
        }
        if (error.response?.status === 409) {
          throw new Error('User with this email already exists');
        }
        throw new Error(error.response?.data?.message || 'Failed to create user');
      }
      throw error;
    }
  }

  /**
   * Update an existing user's information
   * 
   * @param userId - The ID of the user to update
   * @param updates - Partial user data to update
   * @returns Promise resolving to the updated user
   * @throws Error if update fails or user not found
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.patch<UserResponse>(`/users/${userId}`, updates);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update user');
      }
      
      return response.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('User not found');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid update data');
        }
        throw new Error(error.response?.data?.message || 'Failed to update user');
      }
      throw error;
    }
  }

  /**
   * Delete a user account
   * 
   * @param userId - The ID of the user to delete
   * @returns Promise resolving when deletion is complete
   * @throws Error if deletion fails or user not found
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(`/users/${userId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete user');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('User not found');
        }
        throw new Error(error.response?.data?.message || 'Failed to delete user');
      }
      throw error;
    }
  }

  /**
   * Search users by name or email
   * 
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to matching users
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    return this.getUsers({ search: query, limit });
  }

  /**
   * Get user statistics and analytics
   * 
   * @returns Promise resolving to user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    usersByRole: Record<string, number>;
  }> {
    try {
      const response = await apiClient.get('/users/stats');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to fetch user statistics');
      }
      throw error;
    }
  }
}

/**
 * Singleton instance of the user service
 * 
 * Use this exported instance for all user-related API calls
 * to ensure consistent configuration and error handling.
 */
export const userService = new UserService();
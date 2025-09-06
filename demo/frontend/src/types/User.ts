/**
 * User data model representing a system user
 * 
 * @example
 * ```typescript
 * const user: User = {
 *   id: "123",
 *   email: "john@example.com",
 *   name: "John Doe",
 *   role: "admin",
 *   createdAt: new Date(),
 *   isActive: true
 * };
 * ```
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  
  /** User's email address (must be unique) */
  email: string;
  
  /** Full name of the user */
  name: string;
  
  /** User's role in the system */
  role: 'admin' | 'user' | 'moderator';
  
  /** When the user account was created */
  createdAt: Date;
  
  /** Whether the user account is currently active */
  isActive: boolean;
  
  /** Optional profile picture URL */
  avatarUrl?: string;
  
  /** User preferences and settings */
  preferences?: UserPreferences;
}

/**
 * User preferences and configuration options
 */
export interface UserPreferences {
  /** Preferred theme for the UI */
  theme: 'light' | 'dark' | 'auto';
  
  /** Language preference */
  language: string;
  
  /** Email notification settings */
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  
  /** Dashboard layout preferences */
  dashboard: {
    layout: 'grid' | 'list';
    itemsPerPage: number;
  };
}

/**
 * API response wrapper for user operations
 */
export interface UserResponse {
  /** The user data */
  user: User;
  
  /** Success status */
  success: boolean;
  
  /** Optional message */
  message?: string;
}

/**
 * Request payload for creating a new user
 */
export interface CreateUserRequest {
  email: string;
  name: string;
  role?: 'user' | 'moderator';
  preferences?: Partial<UserPreferences>;
}
/**
 * User entity representing a system user in the database
 * 
 * This interface defines the complete user model including
 * database-specific fields and relationships.
 */
export interface User {
  /** Unique identifier (UUID) */
  id: string;
  
  /** User's email address (unique constraint) */
  email: string;
  
  /** Full name of the user */
  name: string;
  
  /** Hashed password for authentication */
  passwordHash: string;
  
  /** User's role in the system */
  role: 'admin' | 'user' | 'moderator';
  
  /** Account creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Whether the account is active */
  isActive: boolean;
  
  /** Optional profile picture URL */
  avatarUrl?: string;
  
  /** User preferences JSON */
  preferences?: UserPreferences;
  
  /** Last login timestamp */
  lastLoginAt?: Date;
  
  /** Email verification status */
  emailVerified: boolean;
}

/**
 * User preferences and settings
 */
export interface UserPreferences {
  /** UI theme preference */
  theme: 'light' | 'dark' | 'auto';
  
  /** Language/locale setting */
  language: string;
  
  /** Notification preferences */
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  
  /** Dashboard configuration */
  dashboard: {
    layout: 'grid' | 'list';
    itemsPerPage: number;
  };
}

/**
 * Data transfer object for user creation
 */
export interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'moderator';
  preferences?: Partial<UserPreferences>;
}

/**
 * Data transfer object for user updates
 */
export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: 'admin' | 'user' | 'moderator';
  isActive?: boolean;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * User data returned to clients (excludes sensitive fields)
 */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  avatarUrl?: string;
  preferences?: UserPreferences;
  lastLoginAt?: Date;
  emailVerified: boolean;
}

/**
 * Authentication response with user data and token
 */
export interface AuthResponse {
  user: UserResponse;
  token: string;
  expiresAt: Date;
}

/**
 * User statistics for analytics
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  usersByRole: Record<string, number>;
  averageSessionDuration: number;
  topCountries: Array<{ country: string; count: number }>;
}
import React, { useState, useEffect } from 'react';
import { User, UserPreferences } from '../types/User';
import { userService } from '../services/userService';

/**
 * Props for the UserProfile component
 */
interface UserProfileProps {
  /** The user ID to display */
  userId: string;
  
  /** Whether the profile is editable */
  editable?: boolean;
  
  /** Callback when user data is updated */
  onUserUpdate?: (user: User) => void;
  
  /** Custom CSS class name */
  className?: string;
}

/**
 * UserProfile component displays and manages user information
 * 
 * This component handles both viewing and editing user profiles,
 * with real-time updates and validation.
 * 
 * @example
 * ```tsx
 * <UserProfile 
 *   userId="123" 
 *   editable={true}
 *   onUserUpdate={(user) => console.log('Updated:', user)}
 * />
 * ```
 */
export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  editable = false,
  onUserUpdate,
  className = ''
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user data from the API
   */
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await userService.getUser(userId);
        setUser(userData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadUser();
    }
  }, [userId]);

  /**
   * Handle user profile updates
   * 
   * @param updatedUser - The updated user data
   */
  const handleUserUpdate = async (updatedUser: Partial<User>) => {
    if (!user) return;

    try {
      const updated = await userService.updateUser(user.id, updatedUser);
      setUser(updated);
      setEditing(false);
      onUserUpdate?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  /**
   * Toggle user active status
   */
  const toggleActiveStatus = async () => {
    if (!user) return;
    
    await handleUserUpdate({ isActive: !user.isActive });
  };

  /**
   * Update user preferences
   * 
   * @param preferences - New preference settings
   */
  const updatePreferences = async (preferences: Partial<UserPreferences>) => {
    if (!user) return;
    
    const updatedPreferences = { ...user.preferences, ...preferences };
    await handleUserUpdate({ preferences: updatedPreferences });
  };

  if (loading) {
    return <div className={`user-profile loading ${className}`}>Loading user profile...</div>;
  }

  if (error) {
    return <div className={`user-profile error ${className}`}>Error: {error}</div>;
  }

  if (!user) {
    return <div className={`user-profile not-found ${className}`}>User not found</div>;
  }

  return (
    <div className={`user-profile ${className}`}>
      <div className="user-profile__header">
        {user.avatarUrl && (
          <img 
            src={user.avatarUrl} 
            alt={`${user.name}'s avatar`}
            className="user-profile__avatar"
          />
        )}
        <div className="user-profile__info">
          <h2 className="user-profile__name">{user.name}</h2>
          <p className="user-profile__email">{user.email}</p>
          <span className={`user-profile__role role--${user.role}`}>
            {user.role}
          </span>
        </div>
      </div>

      <div className="user-profile__details">
        <div className="user-profile__field">
          <label>Status:</label>
          <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
          {editable && (
            <button onClick={toggleActiveStatus} className="btn btn--small">
              {user.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>

        <div className="user-profile__field">
          <label>Member since:</label>
          <span>{user.createdAt.toLocaleDateString()}</span>
        </div>

        {user.preferences && (
          <div className="user-profile__preferences">
            <h3>Preferences</h3>
            <div className="preferences-grid">
              <div className="preference-item">
                <label>Theme:</label>
                <span>{user.preferences.theme}</span>
              </div>
              <div className="preference-item">
                <label>Language:</label>
                <span>{user.preferences.language}</span>
              </div>
              <div className="preference-item">
                <label>Email Notifications:</label>
                <span>{user.preferences.notifications.email ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {editable && (
        <div className="user-profile__actions">
          <button 
            onClick={() => setEditing(!editing)} 
            className="btn btn--primary"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
      )}
    </div>
  );
};
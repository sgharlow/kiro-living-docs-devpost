// Package main defines data types and structures for the user service
//
// This file contains all the data models, request/response structures,
// and type definitions used throughout the Go user service.
package main

import (
	"time"
)

// User represents a user entity in the system
//
// Contains all user information including authentication data,
// profile information, and system metadata.
type User struct {
	// ID is the unique identifier for the user (UUID format)
	ID string `json:"id"`
	
	// Email is the user's email address (must be unique)
	Email string `json:"email"`
	
	// Name is the user's full name
	Name string `json:"name"`
	
	// PasswordHash stores the bcrypt hash of the user's password
	PasswordHash string `json:"-"` // Never include in JSON responses
	
	// Role defines the user's permissions level
	Role UserRole `json:"role"`
	
	// IsActive indicates whether the user account is active
	IsActive bool `json:"is_active"`
	
	// EmailVerified indicates if the user's email has been verified
	EmailVerified bool `json:"email_verified"`
	
	// CreatedAt is when the user account was created
	CreatedAt time.Time `json:"created_at"`
	
	// UpdatedAt is when the user account was last modified
	UpdatedAt time.Time `json:"updated_at"`
	
	// LastLoginAt is when the user last successfully logged in
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	
	// Profile contains additional user profile information
	Profile *UserProfile `json:"profile,omitempty"`
	
	// Preferences stores user configuration and settings
	Preferences *UserPreferences `json:"preferences,omitempty"`
}

// UserRole defines the possible user roles in the system
type UserRole string

const (
	// RoleAdmin has full system access and user management capabilities
	RoleAdmin UserRole = "admin"
	
	// RoleUser has standard user access with limited permissions
	RoleUser UserRole = "user"
	
	// RoleModerator has elevated permissions for content moderation
	RoleModerator UserRole = "moderator"
)

// IsValid checks if the user role is a valid value
//
// Returns true if the role is one of the defined constants,
// false otherwise.
func (r UserRole) IsValid() bool {
	switch r {
	case RoleAdmin, RoleUser, RoleModerator:
		return true
	default:
		return false
	}
}

// UserProfile contains extended user profile information
//
// Stores optional user data such as avatar, bio, and contact information
// that supplements the core user entity.
type UserProfile struct {
	// AvatarURL is the URL to the user's profile picture
	AvatarURL string `json:"avatar_url,omitempty"`
	
	// Bio is a short biography or description
	Bio string `json:"bio,omitempty"`
	
	// Location is the user's geographic location
	Location string `json:"location,omitempty"`
	
	// Website is the user's personal or professional website
	Website string `json:"website,omitempty"`
	
	// Phone is the user's phone number
	Phone string `json:"phone,omitempty"`
	
	// DateOfBirth is the user's birth date
	DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
	
	// Company is the user's employer or organization
	Company string `json:"company,omitempty"`
	
	// JobTitle is the user's job title or position
	JobTitle string `json:"job_title,omitempty"`
}

// UserPreferences stores user configuration and settings
//
// Contains user-specific preferences for UI, notifications,
// and application behavior customization.
type UserPreferences struct {
	// Theme specifies the UI theme preference
	Theme ThemePreference `json:"theme"`
	
	// Language is the user's preferred language code (ISO 639-1)
	Language string `json:"language"`
	
	// Timezone is the user's timezone (IANA format)
	Timezone string `json:"timezone"`
	
	// Notifications contains notification preferences
	Notifications NotificationPreferences `json:"notifications"`
	
	// Dashboard contains dashboard layout preferences
	Dashboard DashboardPreferences `json:"dashboard"`
	
	// Privacy contains privacy and visibility settings
	Privacy PrivacyPreferences `json:"privacy"`
}

// ThemePreference defines UI theme options
type ThemePreference string

const (
	// ThemeLight uses light color scheme
	ThemeLight ThemePreference = "light"
	
	// ThemeDark uses dark color scheme
	ThemeDark ThemePreference = "dark"
	
	// ThemeAuto automatically switches based on system preference
	ThemeAuto ThemePreference = "auto"
)

// NotificationPreferences controls notification delivery
type NotificationPreferences struct {
	// Email enables/disables email notifications
	Email bool `json:"email"`
	
	// Push enables/disables push notifications
	Push bool `json:"push"`
	
	// SMS enables/disables SMS notifications
	SMS bool `json:"sms"`
	
	// Marketing enables/disables marketing communications
	Marketing bool `json:"marketing"`
	
	// Security enables/disables security-related notifications
	Security bool `json:"security"`
}

// DashboardPreferences controls dashboard appearance and behavior
type DashboardPreferences struct {
	// Layout specifies the dashboard layout style
	Layout DashboardLayout `json:"layout"`
	
	// ItemsPerPage controls pagination size
	ItemsPerPage int `json:"items_per_page"`
	
	// DefaultView is the default dashboard view/tab
	DefaultView string `json:"default_view"`
	
	// ShowWelcome controls welcome message visibility
	ShowWelcome bool `json:"show_welcome"`
}

// DashboardLayout defines dashboard layout options
type DashboardLayout string

const (
	// LayoutGrid displays items in a grid format
	LayoutGrid DashboardLayout = "grid"
	
	// LayoutList displays items in a list format
	LayoutList DashboardLayout = "list"
	
	// LayoutCards displays items as cards
	LayoutCards DashboardLayout = "cards"
)

// PrivacyPreferences controls privacy and visibility settings
type PrivacyPreferences struct {
	// ProfileVisibility controls who can view the user's profile
	ProfileVisibility VisibilityLevel `json:"profile_visibility"`
	
	// ShowEmail controls email address visibility
	ShowEmail bool `json:"show_email"`
	
	// ShowLastLogin controls last login time visibility
	ShowLastLogin bool `json:"show_last_login"`
	
	// AllowIndexing allows search engines to index the profile
	AllowIndexing bool `json:"allow_indexing"`
}

// VisibilityLevel defines privacy visibility options
type VisibilityLevel string

const (
	// VisibilityPublic is visible to everyone
	VisibilityPublic VisibilityLevel = "public"
	
	// VisibilityPrivate is visible only to the user
	VisibilityPrivate VisibilityLevel = "private"
	
	// VisibilityFriends is visible to friends/connections only
	VisibilityFriends VisibilityLevel = "friends"
)

// Request and Response Types

// LoginRequest represents a user login request
type LoginRequest struct {
	// Email is the user's email address
	Email string `json:"email" validate:"required,email"`
	
	// Password is the user's password
	Password string `json:"password" validate:"required,min=6"`
	
	// RememberMe extends the session duration if true
	RememberMe bool `json:"remember_me"`
}

// LoginResponse represents a successful login response
type LoginResponse struct {
	// Success indicates if the login was successful
	Success bool `json:"success"`
	
	// AccessToken is the JWT access token
	AccessToken string `json:"access_token"`
	
	// RefreshToken is the JWT refresh token
	RefreshToken string `json:"refresh_token"`
	
	// User contains the authenticated user's information
	User *User `json:"user"`
	
	// ExpiresAt is when the access token expires
	ExpiresAt time.Time `json:"expires_at"`
	
	// TokenType is the type of token (usually "Bearer")
	TokenType string `json:"token_type"`
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	// Email is the new user's email address
	Email string `json:"email" validate:"required,email"`
	
	// Password is the new user's password
	Password string `json:"password" validate:"required,min=6"`
	
	// Name is the new user's full name
	Name string `json:"name" validate:"required,min=2"`
	
	// Role is the requested user role (defaults to "user")
	Role UserRole `json:"role,omitempty"`
	
	// AcceptTerms indicates acceptance of terms of service
	AcceptTerms bool `json:"accept_terms" validate:"required"`
}

// CreateUserRequest represents an admin request to create a user
type CreateUserRequest struct {
	// Email is the new user's email address
	Email string `json:"email" validate:"required,email"`
	
	// Password is the new user's password
	Password string `json:"password" validate:"required,min=6"`
	
	// Name is the new user's full name
	Name string `json:"name" validate:"required,min=2"`
	
	// Role is the user's role
	Role UserRole `json:"role"`
	
	// IsActive sets the initial active status
	IsActive bool `json:"is_active"`
	
	// Profile contains initial profile information
	Profile *UserProfile `json:"profile,omitempty"`
	
	// Preferences contains initial user preferences
	Preferences *UserPreferences `json:"preferences,omitempty"`
}

// UpdateUserRequest represents a request to update user information
type UpdateUserRequest struct {
	// Name updates the user's name
	Name *string `json:"name,omitempty"`
	
	// Email updates the user's email address
	Email *string `json:"email,omitempty"`
	
	// Role updates the user's role (admin only)
	Role *UserRole `json:"role,omitempty"`
	
	// IsActive updates the user's active status (admin only)
	IsActive *bool `json:"is_active,omitempty"`
	
	// Profile updates profile information
	Profile *UserProfile `json:"profile,omitempty"`
	
	// Preferences updates user preferences
	Preferences *UserPreferences `json:"preferences,omitempty"`
}

// UserFilters represents filters for user queries
type UserFilters struct {
	// Role filters users by role
	Role string `json:"role,omitempty"`
	
	// Active filters users by active status
	Active *bool `json:"active,omitempty"`
	
	// Search performs text search on name and email
	Search string `json:"search,omitempty"`
	
	// EmailVerified filters by email verification status
	EmailVerified *bool `json:"email_verified,omitempty"`
	
	// CreatedAfter filters users created after this date
	CreatedAfter *time.Time `json:"created_after,omitempty"`
	
	// CreatedBefore filters users created before this date
	CreatedBefore *time.Time `json:"created_before,omitempty"`
	
	// Limit limits the number of results
	Limit int `json:"limit"`
	
	// Offset skips this many results (for pagination)
	Offset int `json:"offset"`
	
	// SortBy specifies the field to sort by
	SortBy string `json:"sort_by,omitempty"`
	
	// SortOrder specifies sort direction ("asc" or "desc")
	SortOrder string `json:"sort_order,omitempty"`
}

// UserStats represents user statistics for analytics
type UserStats struct {
	// TotalUsers is the total number of users
	TotalUsers int `json:"total_users"`
	
	// ActiveUsers is the number of active users
	ActiveUsers int `json:"active_users"`
	
	// NewUsersToday is the number of users created today
	NewUsersToday int `json:"new_users_today"`
	
	// NewUsersThisWeek is the number of users created this week
	NewUsersThisWeek int `json:"new_users_this_week"`
	
	// NewUsersThisMonth is the number of users created this month
	NewUsersThisMonth int `json:"new_users_this_month"`
	
	// UsersByRole breaks down users by role
	UsersByRole map[string]int `json:"users_by_role"`
	
	// VerifiedUsers is the number of email-verified users
	VerifiedUsers int `json:"verified_users"`
	
	// RecentLogins is the number of users who logged in recently
	RecentLogins int `json:"recent_logins"`
	
	// AverageSessionDuration is the average session length in seconds
	AverageSessionDuration float64 `json:"average_session_duration"`
}

// TokenClaims represents JWT token claims
type TokenClaims struct {
	// UserID is the user's unique identifier
	UserID string `json:"user_id"`
	
	// Role is the user's role
	Role UserRole `json:"role"`
	
	// TokenType indicates if this is an access or refresh token
	TokenType string `json:"token_type"`
	
	// IssuedAt is when the token was issued (Unix timestamp)
	IssuedAt int64 `json:"iat"`
	
	// ExpiresAt is when the token expires (Unix timestamp)
	ExpiresAt int64 `json:"exp"`
	
	// Issuer identifies who issued the token
	Issuer string `json:"iss"`
}

// APIResponse represents a generic API response wrapper
type APIResponse struct {
	// Success indicates if the request was successful
	Success bool `json:"success"`
	
	// Message provides additional information about the response
	Message string `json:"message,omitempty"`
	
	// Data contains the response payload
	Data interface{} `json:"data,omitempty"`
	
	// Error contains error information if Success is false
	Error *APIError `json:"error,omitempty"`
	
	// Timestamp is when the response was generated
	Timestamp time.Time `json:"timestamp"`
}

// APIError represents detailed error information
type APIError struct {
	// Code is a machine-readable error code
	Code string `json:"code"`
	
	// Message is a human-readable error message
	Message string `json:"message"`
	
	// Details provides additional error context
	Details map[string]interface{} `json:"details,omitempty"`
	
	// Field indicates which field caused a validation error
	Field string `json:"field,omitempty"`
}
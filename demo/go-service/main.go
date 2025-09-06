// Package main implements a Go HTTP service for user management
//
// This service provides user management capabilities including
// authentication, profile management, and user data synchronization.
// Demonstrates Go documentation generation capabilities.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/handlers"
)

// Server represents the HTTP server with its dependencies
type Server struct {
	router      *mux.Router
	userService *UserService
	authService *AuthService
	logger      *log.Logger
}

// Config holds the server configuration
type Config struct {
	Port         int           `json:"port"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
	DatabaseURL  string        `json:"database_url"`
	JWTSecret    string        `json:"jwt_secret"`
}

// NewServer creates a new server instance with initialized services
//
// Parameters:
//   - config: Server configuration including port and timeouts
//
// Returns:
//   - *Server: Configured server instance ready to start
//
// Example:
//
//	config := &Config{Port: 8080, ReadTimeout: 10 * time.Second}
//	server := NewServer(config)
//	server.Start()
func NewServer(config *Config) *Server {
	logger := log.New(os.Stdout, "[GO-SERVICE] ", log.LstdFlags|log.Lshortfile)
	
	userService := NewUserService(logger)
	authService := NewAuthService(config.JWTSecret, logger)
	
	server := &Server{
		router:      mux.NewRouter(),
		userService: userService,
		authService: authService,
		logger:      logger,
	}
	
	server.setupRoutes()
	return server
}

// setupRoutes configures all HTTP routes and middleware
func (s *Server) setupRoutes() {
	// API v1 routes
	api := s.router.PathPrefix("/api/v1").Subrouter()
	
	// Health check endpoint
	api.HandleFunc("/health", s.handleHealth).Methods("GET")
	
	// Authentication routes
	auth := api.PathPrefix("/auth").Subrouter()
	auth.HandleFunc("/login", s.handleLogin).Methods("POST")
	auth.HandleFunc("/register", s.handleRegister).Methods("POST")
	auth.HandleFunc("/refresh", s.handleRefreshToken).Methods("POST")
	auth.HandleFunc("/logout", s.handleLogout).Methods("POST")
	
	// User management routes (protected)
	users := api.PathPrefix("/users").Subrouter()
	users.Use(s.authMiddleware)
	users.HandleFunc("", s.handleGetUsers).Methods("GET")
	users.HandleFunc("/{id}", s.handleGetUser).Methods("GET")
	users.HandleFunc("/{id}", s.handleUpdateUser).Methods("PUT")
	users.HandleFunc("/{id}", s.handleDeleteUser).Methods("DELETE")
	users.HandleFunc("/{id}/profile", s.handleGetUserProfile).Methods("GET")
	users.HandleFunc("/{id}/profile", s.handleUpdateUserProfile).Methods("PUT")
	
	// Admin routes (admin only)
	admin := api.PathPrefix("/admin").Subrouter()
	admin.Use(s.authMiddleware, s.adminMiddleware)
	admin.HandleFunc("/users/stats", s.handleUserStats).Methods("GET")
	admin.HandleFunc("/users/{id}/activate", s.handleActivateUser).Methods("POST")
	admin.HandleFunc("/users/{id}/deactivate", s.handleDeactivateUser).Methods("POST")
}

// handleHealth provides a health check endpoint for monitoring
//
// Returns server status, uptime, and basic system information
// for load balancers and monitoring systems.
//
// Response format:
//
//	{
//	  "status": "healthy",
//	  "timestamp": "2023-06-15T10:30:00Z",
//	  "version": "1.0.0",
//	  "uptime": "2h30m15s"
//	}
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
		"service":   "go-user-service",
	}
	
	s.writeJSONResponse(w, http.StatusOK, response)
}

// handleLogin authenticates a user and returns JWT tokens
//
// Request body should contain email and password.
// Returns access token, refresh token, and user information.
//
// Example request:
//
//	POST /api/v1/auth/login
//	{
//	  "email": "user@example.com",
//	  "password": "securepassword"
//	}
//
// Example response:
//
//	{
//	  "success": true,
//	  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
//	  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
//	  "user": {...},
//	  "expires_at": "2023-06-15T11:30:00Z"
//	}
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var loginReq LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		s.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	
	// Validate input
	if loginReq.Email == "" || loginReq.Password == "" {
		s.writeErrorResponse(w, http.StatusBadRequest, "Email and password are required")
		return
	}
	
	// Authenticate user
	user, err := s.userService.AuthenticateUser(loginReq.Email, loginReq.Password)
	if err != nil {
		s.logger.Printf("Authentication failed for %s: %v", loginReq.Email, err)
		s.writeErrorResponse(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	
	// Generate tokens
	accessToken, refreshToken, expiresAt, err := s.authService.GenerateTokens(user.ID, user.Role)
	if err != nil {
		s.logger.Printf("Token generation failed: %v", err)
		s.writeErrorResponse(w, http.StatusInternalServerError, "Authentication failed")
		return
	}
	
	// Update last login time
	if err := s.userService.UpdateLastLogin(user.ID); err != nil {
		s.logger.Printf("Failed to update last login for user %s: %v", user.ID, err)
	}
	
	response := LoginResponse{
		Success:      true,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		ExpiresAt:    expiresAt,
	}
	
	s.writeJSONResponse(w, http.StatusOK, response)
}

// handleRegister creates a new user account
//
// Validates input data, checks for existing users, and creates
// a new account with hashed password and default preferences.
//
// Example request:
//
//	POST /api/v1/auth/register
//	{
//	  "email": "newuser@example.com",
//	  "password": "securepassword",
//	  "name": "John Doe",
//	  "role": "user"
//	}
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var registerReq RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&registerReq); err != nil {
		s.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	
	// Validate required fields
	if registerReq.Email == "" || registerReq.Password == "" || registerReq.Name == "" {
		s.writeErrorResponse(w, http.StatusBadRequest, "Email, password, and name are required")
		return
	}
	
	// Check if user already exists
	existingUser, _ := s.userService.GetUserByEmail(registerReq.Email)
	if existingUser != nil {
		s.writeErrorResponse(w, http.StatusConflict, "User with this email already exists")
		return
	}
	
	// Create new user
	user, err := s.userService.CreateUser(&CreateUserRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
		Name:     registerReq.Name,
		Role:     registerReq.Role,
	})
	if err != nil {
		s.logger.Printf("User creation failed: %v", err)
		s.writeErrorResponse(w, http.StatusInternalServerError, "Failed to create user")
		return
	}
	
	response := map[string]interface{}{
		"success": true,
		"user":    user,
		"message": "User created successfully",
	}
	
	s.writeJSONResponse(w, http.StatusCreated, response)
}

// handleGetUsers retrieves a list of users with optional filtering
//
// Supports query parameters for filtering by role, status, and search terms.
// Includes pagination support for large user lists.
//
// Query parameters:
//   - role: Filter by user role (admin, user, moderator)
//   - active: Filter by active status (true/false)
//   - search: Search in name and email fields
//   - limit: Maximum number of results (default: 50)
//   - offset: Number of results to skip (default: 0)
func (s *Server) handleGetUsers(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	query := r.URL.Query()
	filters := UserFilters{
		Role:   query.Get("role"),
		Active: parseBoolParam(query.Get("active")),
		Search: query.Get("search"),
		Limit:  parseIntParam(query.Get("limit"), 50),
		Offset: parseIntParam(query.Get("offset"), 0),
	}
	
	users, total, err := s.userService.GetUsers(filters)
	if err != nil {
		s.logger.Printf("Failed to get users: %v", err)
		s.writeErrorResponse(w, http.StatusInternalServerError, "Failed to retrieve users")
		return
	}
	
	response := map[string]interface{}{
		"success": true,
		"users":   users,
		"pagination": map[string]interface{}{
			"limit":  filters.Limit,
			"offset": filters.Offset,
			"total":  total,
		},
	}
	
	s.writeJSONResponse(w, http.StatusOK, response)
}

// handleGetUser retrieves a specific user by ID
//
// Returns detailed user information including profile data
// and preferences. Requires authentication and appropriate permissions.
func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["id"]
	
	if userID == "" {
		s.writeErrorResponse(w, http.StatusBadRequest, "User ID is required")
		return
	}
	
	user, err := s.userService.GetUserByID(userID)
	if err != nil {
		s.logger.Printf("Failed to get user %s: %v", userID, err)
		s.writeErrorResponse(w, http.StatusNotFound, "User not found")
		return
	}
	
	// Check permissions (users can only view their own data unless admin)
	currentUser := s.getCurrentUser(r)
	if currentUser.ID != userID && currentUser.Role != "admin" {
		s.writeErrorResponse(w, http.StatusForbidden, "Insufficient permissions")
		return
	}
	
	response := map[string]interface{}{
		"success": true,
		"user":    user,
	}
	
	s.writeJSONResponse(w, http.StatusOK, response)
}

// Start begins serving HTTP requests
//
// Configures the HTTP server with timeouts and graceful shutdown handling.
// Blocks until the server is shut down via signal or context cancellation.
//
// Parameters:
//   - config: Server configuration including port and timeouts
//
// Returns error if server fails to start or encounters fatal error.
func (s *Server) Start(config *Config) error {
	// Configure CORS
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)(s.router)
	
	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", config.Port),
		Handler:      corsHandler,
		ReadTimeout:  config.ReadTimeout,
		WriteTimeout: config.WriteTimeout,
		IdleTimeout:  config.IdleTimeout,
	}
	
	// Start server in goroutine
	go func() {
		s.logger.Printf("Starting Go service on port %d", config.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatalf("Server failed to start: %v", err)
		}
	}()
	
	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	s.logger.Println("Shutting down server...")
	
	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// Attempt graceful shutdown
	if err := srv.Shutdown(ctx); err != nil {
		s.logger.Printf("Server forced to shutdown: %v", err)
		return err
	}
	
	s.logger.Println("Server exited")
	return nil
}

// Utility functions for parameter parsing and response handling

// parseIntParam parses an integer parameter with default value
func parseIntParam(param string, defaultValue int) int {
	if param == "" {
		return defaultValue
	}
	if value, err := strconv.Atoi(param); err == nil {
		return value
	}
	return defaultValue
}

// parseBoolParam parses a boolean parameter, returns nil if empty
func parseBoolParam(param string) *bool {
	if param == "" {
		return nil
	}
	if value, err := strconv.ParseBool(param); err == nil {
		return &value
	}
	return nil
}

// writeJSONResponse writes a JSON response with the given status code
func (s *Server) writeJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	if err := json.NewEncoder(w).Encode(data); err != nil {
		s.logger.Printf("Failed to encode JSON response: %v", err)
	}
}

// writeErrorResponse writes an error response in JSON format
func (s *Server) writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	response := map[string]interface{}{
		"success": false,
		"error":   message,
	}
	s.writeJSONResponse(w, statusCode, response)
}

// getCurrentUser extracts the current user from request context
func (s *Server) getCurrentUser(r *http.Request) *User {
	if user, ok := r.Context().Value("user").(*User); ok {
		return user
	}
	return nil
}

// main function initializes and starts the server
func main() {
	// Load configuration
	config := &Config{
		Port:         8080,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
	}
	
	// Override port from environment if set
	if portStr := os.Getenv("PORT"); portStr != "" {
		if port, err := strconv.Atoi(portStr); err == nil {
			config.Port = port
		}
	}
	
	// Set default JWT secret if not provided
	if config.JWTSecret == "" {
		config.JWTSecret = "demo-secret-key-change-in-production"
	}
	
	// Create and start server
	server := NewServer(config)
	if err := server.Start(config); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
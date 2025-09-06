# Living Documentation Generator Demo

This demo project showcases the capabilities of the Living Documentation Generator across multiple programming languages and frameworks.

## Project Structure

- `frontend/` - React TypeScript application with API integration
- `backend/` - Node.js Express API server
- `python-service/` - Python Flask microservice with database models
- `go-service/` - Go HTTP service with gRPC endpoints
- `shared/` - Shared types and utilities
- `docs/` - Generated documentation output

## Features Demonstrated

### Multi-Language Support
- **TypeScript/JavaScript**: React components, Express routes, utility functions
- **Python**: Flask routes, SQLAlchemy models, data processing functions
- **Go**: HTTP handlers, gRPC services, data structures

### Documentation Features
- Real-time documentation updates
- API endpoint documentation with examples
- Architecture diagrams and dependency graphs
- Cross-language type definitions
- Git history integration
- Interactive web interface

## Getting Started

1. Install dependencies: `npm install`
2. Start the documentation server: `npm run docs:serve`
3. Make changes to any source file and watch documentation update in real-time
4. Visit `http://localhost:3000` to view the interactive documentation

## Demo Scenarios

### Scenario 1: Real-Time Updates
1. Open `frontend/src/components/UserProfile.tsx`
2. Add a new prop to the component
3. Watch the documentation automatically update

### Scenario 2: API Documentation
1. Add a new endpoint to `backend/src/routes/users.ts`
2. See automatic OpenAPI spec generation
3. View interactive API documentation

### Scenario 3: Cross-Language Integration
1. Modify a shared type in `shared/types.ts`
2. See documentation updates across all language implementations
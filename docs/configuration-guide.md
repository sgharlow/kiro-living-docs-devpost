# Living Documentation Generator - Configuration Guide

## Overview

The Living Documentation Generator supports flexible configuration through JSON files, environment variables, and auto-detection. This guide covers all configuration options and provides examples for common scenarios.

## Configuration Files

### Primary Configuration: `living-docs.config.json`

Place this file in your project root for project-specific settings:

```json
{
  "projectPath": ".",
  "outputPath": "docs",
  "includePatterns": [
    "**/*.ts",
    "**/*.js",
    "**/*.py",
    "**/*.go"
  ],
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.test.*",
    "*.spec.*"
  ],
  "outputFormats": ["markdown", "html"],
  "webServerPort": 3000,
  "watchDebounceMs": 300,
  "features": {
    "realTimeUpdates": true,
    "gitIntegration": true,
    "apiDocumentation": true,
    "architectureDiagrams": true,
    "searchIndex": true,
    "performanceMetrics": true
  },
  "languages": {
    "typescript": {
      "enabled": true,
      "includePrivate": false,
      "generateInterfaces": true,
      "apiEndpointDetection": true
    },
    "python": {
      "enabled": true,
      "includePrivate": false,
      "docstringStyle": "google"
    },
    "go": {
      "enabled": true,
      "includePrivate": false,
      "generateStructDocs": true
    }
  },
  "documentation": {
    "title": "My Project Documentation",
    "description": "Comprehensive documentation for my project",
    "author": "Development Team",
    "version": "1.0.0",
    "theme": "default",
    "customCSS": "docs/custom.css",
    "logo": "docs/logo.png"
  },
  "integrations": {
    "kiro": {
      "steeringFiles": true,
      "hooks": true,
      "contextAware": true
    },
    "git": {
      "enabled": true,
      "includeHistory": true,
      "changePatterns": true,
      "contributorStats": true
    }
  }
}
```

### Environment Configuration: `.env`

```bash
# Living Documentation Generator Environment Configuration

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Web server port for documentation UI
WEB_SERVER_PORT=3000

# File watching debounce time in milliseconds
WATCH_DEBOUNCE_MS=300

# Cache size limit in megabytes
CACHE_SIZE_MB=100

# Analysis timeout in milliseconds
ANALYSIS_TIMEOUT_MS=15000

# Demo mode (shows additional debug information)
DEMO_MODE=false

# Performance monitoring
ENABLE_PERFORMANCE_METRICS=true

# Real-time updates
ENABLE_REAL_TIME_UPDATES=true
```

## Configuration Schema

### Complete Schema Definition

```typescript
interface LivingDocsConfig {
  // Project Settings
  projectPath: string;                    // Path to project root
  outputPath: string;                     // Documentation output directory
  includePatterns: string[];              // Glob patterns for files to include
  excludePatterns: string[];              // Glob patterns for files to exclude
  outputFormats: OutputFormat[];          // Output formats to generate
  
  // Server Settings
  webServerPort: number;                  // Port for documentation web server
  watchDebounceMs: number;                // Debounce time for file watching
  
  // Feature Flags
  features: {
    realTimeUpdates: boolean;             // Enable real-time documentation updates
    gitIntegration: boolean;              // Include git history and statistics
    apiDocumentation: boolean;            // Generate API documentation
    architectureDiagrams: boolean;        // Generate architecture diagrams
    searchIndex: boolean;                 // Build search index
    performanceMetrics: boolean;          // Track performance metrics
  };
  
  // Language-Specific Settings
  languages: {
    typescript?: TypeScriptConfig;
    python?: PythonConfig;
    go?: GoConfig;
  };
  
  // Documentation Metadata
  documentation: {
    title: string;                        // Documentation title
    description: string;                  // Project description
    author: string;                       // Author/team name
    version: string;                      // Documentation version
    theme: string;                        // UI theme
    customCSS?: string;                   // Path to custom CSS
    logo?: string;                        // Path to logo image
  };
  
  // Integration Settings
  integrations: {
    kiro: KiroIntegrationConfig;
    git: GitIntegrationConfig;
  };
}

type OutputFormat = 'markdown' | 'html' | 'json' | 'openapi';

interface TypeScriptConfig {
  enabled: boolean;
  includePrivate: boolean;
  generateInterfaces: boolean;
  apiEndpointDetection: boolean;
  tsConfigPath?: string;
}

interface PythonConfig {
  enabled: boolean;
  includePrivate: boolean;
  docstringStyle: 'google' | 'numpy' | 'sphinx';
  requirementsPath?: string;
}

interface GoConfig {
  enabled: boolean;
  includePrivate: boolean;
  generateStructDocs: boolean;
  goModPath?: string;
}

interface KiroIntegrationConfig {
  steeringFiles: boolean;
  hooks: boolean;
  contextAware: boolean;
}

interface GitIntegrationConfig {
  enabled: boolean;
  includeHistory: boolean;
  changePatterns: boolean;
  contributorStats: boolean;
}
```

## Configuration Examples

### 1. Minimal Configuration

For simple projects that want to get started quickly:

```json
{
  "projectPath": ".",
  "outputPath": "docs",
  "outputFormats": ["markdown"]
}
```

### 2. TypeScript/React Project

```json
{
  "projectPath": ".",
  "outputPath": "docs",
  "includePatterns": [
    "src/**/*.ts",
    "src/**/*.tsx"
  ],
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "**/*.test.*",
    "**/*.spec.*"
  ],
  "outputFormats": ["markdown", "html"],
  "webServerPort": 3001,
  "features": {
    "realTimeUpdates": true,
    "apiDocumentation": true,
    "architectureDiagrams": false
  },
  "languages": {
    "typescript": {
      "enabled": true,
      "includePrivate": false,
      "generateInterfaces": true,
      "apiEndpointDetection": true
    }
  },
  "documentation": {
    "title": "React App Documentation",
    "description": "Documentation for our React TypeScript application",
    "author": "Frontend Team",
    "version": "1.0.0",
    "theme": "modern"
  }
}
```

### 3. Python/Django Project

```json
{
  "projectPath": ".",
  "outputPath": "docs",
  "includePatterns": [
    "**/*.py"
  ],
  "excludePatterns": [
    "venv/**",
    "env/**",
    "**/migrations/**",
    "**/*test*.py"
  ],
  "outputFormats": ["markdown", "html"],
  "features": {
    "realTimeUpdates": true,
    "apiDocumentation": true,
    "gitIntegration": true
  },
  "languages": {
    "python": {
      "enabled": true,
      "includePrivate": false,
      "docstringStyle": "google"
    }
  },
  "documentation": {
    "title": "Django API Documentation",
    "description": "REST API documentation for our Django application",
    "author": "Backend Team",
    "version": "2.1.0",
    "theme": "api"
  }
}
```

### 4. Multi-Language Microservices

```json
{
  "projectPath": ".",
  "outputPath": "docs",
  "includePatterns": [
    "services/**/*.ts",
    "services/**/*.py",
    "services/**/*.go"
  ],
  "excludePatterns": [
    "node_modules/**",
    "__pycache__/**",
    "vendor/**",
    "**/*test*"
  ],
  "outputFormats": ["markdown", "html", "openapi"],
  "webServerPort": 4000,
  "features": {
    "realTimeUpdates": true,
    "gitIntegration": true,
    "apiDocumentation": true,
    "architectureDiagrams": true,
    "searchIndex": true,
    "performanceMetrics": true
  },
  "languages": {
    "typescript": {
      "enabled": true,
      "includePrivate": false,
      "generateInterfaces": true,
      "apiEndpointDetection": true
    },
    "python": {
      "enabled": true,
      "includePrivate": false,
      "docstringStyle": "google"
    },
    "go": {
      "enabled": true,
      "includePrivate": false,
      "generateStructDocs": true
    }
  },
  "documentation": {
    "title": "Microservices Architecture Documentation",
    "description": "Comprehensive documentation for our microservices ecosystem",
    "author": "Platform Team",
    "version": "3.0.0",
    "theme": "enterprise",
    "customCSS": "docs/styles/custom.css",
    "logo": "docs/assets/company-logo.png"
  },
  "integrations": {
    "kiro": {
      "steeringFiles": true,
      "hooks": true,
      "contextAware": true
    },
    "git": {
      "enabled": true,
      "includeHistory": true,
      "changePatterns": true,
      "contributorStats": true
    }
  }
}
```

### 5. Enterprise Configuration

```json
{
  "projectPath": ".",
  "outputPath": "documentation",
  "includePatterns": [
    "src/**/*.ts",
    "lib/**/*.ts",
    "api/**/*.py",
    "services/**/*.go"
  ],
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "__pycache__/**",
    "vendor/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/test_*",
    "**/*_test.go"
  ],
  "outputFormats": ["markdown", "html", "json", "openapi"],
  "webServerPort": 8080,
  "watchDebounceMs": 500,
  "features": {
    "realTimeUpdates": true,
    "gitIntegration": true,
    "apiDocumentation": true,
    "architectureDiagrams": true,
    "searchIndex": true,
    "performanceMetrics": true
  },
  "languages": {
    "typescript": {
      "enabled": true,
      "includePrivate": true,
      "generateInterfaces": true,
      "apiEndpointDetection": true,
      "tsConfigPath": "tsconfig.json"
    },
    "python": {
      "enabled": true,
      "includePrivate": true,
      "docstringStyle": "sphinx",
      "requirementsPath": "requirements.txt"
    },
    "go": {
      "enabled": true,
      "includePrivate": true,
      "generateStructDocs": true,
      "goModPath": "go.mod"
    }
  },
  "documentation": {
    "title": "Enterprise Platform Documentation",
    "description": "Complete technical documentation for the enterprise platform",
    "author": "Engineering Organization",
    "version": "4.2.1",
    "theme": "corporate",
    "customCSS": "docs/themes/corporate/styles.css",
    "logo": "docs/assets/platform-logo.svg"
  },
  "integrations": {
    "kiro": {
      "steeringFiles": true,
      "hooks": true,
      "contextAware": true
    },
    "git": {
      "enabled": true,
      "includeHistory": true,
      "changePatterns": true,
      "contributorStats": true
    }
  }
}
```

## Auto-Detection Behavior

When no configuration file is found, the Living Documentation Generator automatically detects project characteristics:

### Project Type Detection
- **Node.js**: Detects `package.json`, configures for TypeScript/JavaScript
- **Python**: Detects `requirements.txt`, `setup.py`, or `pyproject.toml`
- **Go**: Detects `go.mod` and `go.sum` files
- **Mixed**: Handles multi-language projects intelligently

### Framework Detection
- **Express.js**: Configures API endpoint detection
- **React**: Optimizes for component documentation
- **Django/Flask**: Configures Python web framework patterns
- **Gin/Echo**: Configures Go web framework patterns

### Smart Defaults
- **Include Patterns**: Based on detected languages
- **Exclude Patterns**: Common build/dependency directories
- **Output Formats**: Markdown + HTML for most projects
- **Port Selection**: Avoids conflicts with common dev servers

## Environment Variables

All configuration options can be overridden with environment variables:

```bash
# Project settings
LIVING_DOCS_PROJECT_PATH=./src
LIVING_DOCS_OUTPUT_PATH=documentation
LIVING_DOCS_WEB_SERVER_PORT=4000

# Feature flags
LIVING_DOCS_REAL_TIME_UPDATES=true
LIVING_DOCS_GIT_INTEGRATION=false
LIVING_DOCS_API_DOCUMENTATION=true

# Language settings
LIVING_DOCS_TYPESCRIPT_ENABLED=true
LIVING_DOCS_PYTHON_ENABLED=false
LIVING_DOCS_GO_ENABLED=true

# Performance settings
LIVING_DOCS_WATCH_DEBOUNCE_MS=500
LIVING_DOCS_CACHE_SIZE_MB=200
LIVING_DOCS_ANALYSIS_TIMEOUT_MS=30000
```

## Validation and Error Handling

The configuration system includes comprehensive validation:

### Validation Rules
- **Required Fields**: `projectPath`, `outputPath`
- **Path Validation**: Ensures paths exist and are accessible
- **Port Validation**: Checks for available ports
- **Pattern Validation**: Validates glob patterns
- **Language Validation**: Ensures language analyzers are available

### Error Messages
```json
{
  "errors": [
    {
      "field": "webServerPort",
      "message": "Port 3000 is already in use. Try port 3001.",
      "suggestion": "Set webServerPort to 3001 or use environment variable WEB_SERVER_PORT=3001"
    },
    {
      "field": "includePatterns",
      "message": "No files match the include patterns",
      "suggestion": "Check that your include patterns match actual files in your project"
    }
  ],
  "warnings": [
    {
      "field": "languages.python",
      "message": "Python analyzer enabled but no Python files found",
      "suggestion": "Disable Python analysis or check your include patterns"
    }
  ]
}
```

## Best Practices

### 1. Start Simple
Begin with minimal configuration and add features as needed:
```json
{
  "projectPath": ".",
  "outputPath": "docs"
}
```

### 2. Use Auto-Detection
Let the system detect your project type first, then customize:
```bash
# Generate initial config
npx living-docs-generator --init
```

### 3. Environment-Specific Configs
Use different configs for different environments:
- `living-docs.config.json` - Development
- `living-docs.prod.json` - Production
- `living-docs.ci.json` - CI/CD

### 4. Team Configurations
Use Kiro steering files for team-wide settings:
```markdown
<!-- .kiro/steering/documentation.md -->
# Documentation Standards

## Configuration
- Always include API documentation
- Use corporate theme
- Include git integration
- Generate architecture diagrams
```

### 5. Performance Optimization
For large projects:
```json
{
  "watchDebounceMs": 1000,
  "features": {
    "architectureDiagrams": false,
    "performanceMetrics": false
  },
  "excludePatterns": [
    "**/*.test.*",
    "**/*.spec.*",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```json
{
  "webServerPort": 3001  // Try different port
}
```

#### No Files Found
```json
{
  "includePatterns": [
    "**/*.ts",
    "**/*.js"  // Add more patterns
  ]
}
```

#### Memory Issues
```json
{
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "**/*.min.js"  // Exclude large files
  ]
}
```

#### Slow Performance
```json
{
  "watchDebounceMs": 1000,  // Increase debounce
  "features": {
    "architectureDiagrams": false  // Disable heavy features
  }
}
```

---

This configuration guide provides comprehensive coverage of all configuration options, with practical examples for different project types and use cases. The auto-detection system ensures that most projects work out-of-the-box, while the flexible configuration system allows for extensive customization when needed.
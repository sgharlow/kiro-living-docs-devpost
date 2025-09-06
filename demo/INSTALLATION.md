# Living Documentation Generator - Installation Guide

This guide provides comprehensive instructions for installing and configuring the Living Documentation Generator in various environments.

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: 18.0 or higher
- **Memory**: 4GB RAM
- **Storage**: 1GB free space
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)

### Recommended Requirements
- **Node.js**: 20.0 or higher
- **Memory**: 8GB RAM
- **Storage**: 5GB free space
- **CPU**: Multi-core processor for better performance

### Optional Dependencies
- **Python**: 3.8+ (for Python code analysis)
- **Go**: 1.19+ (for Go code analysis)
- **Git**: 2.20+ (for Git history integration)

## 🚀 Quick Installation

### Option 1: NPM Package (Recommended)

```bash
# Install globally
npm install -g @kiro/living-docs-generator

# Or install locally in your project
npm install --save-dev @kiro/living-docs-generator
```

### Option 2: From Source

```bash
# Clone the repository
git clone https://github.com/sgharlow/kiro-living-docs-devpost.git
cd kiro-living-docs-devpost

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## 🔧 Configuration

### Basic Configuration

Create a `docs-config.json` file in your project root:

```json
{
  "projectName": "My Project",
  "projectDescription": "A sample project for documentation generation",
  "languages": ["typescript", "javascript"],
  "includePaths": [
    "src/**/*.{ts,js,tsx,jsx}",
    "lib/**/*.{ts,js}"
  ],
  "excludePaths": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ],
  "output": {
    "directory": "docs",
    "formats": ["web", "markdown"],
    "webServer": {
      "port": 3000,
      "host": "localhost"
    }
  }
}
```

### Advanced Configuration

```json
{
  "projectName": "Enterprise Application",
  "projectDescription": "Comprehensive enterprise application with microservices",
  "languages": ["typescript", "python", "go"],
  "includePaths": [
    "frontend/src/**/*.{ts,tsx}",
    "backend/src/**/*.{ts,js}",
    "services/**/*.py",
    "api/**/*.go"
  ],
  "excludePaths": [
    "**/node_modules/**",
    "**/dist/**",
    "**/__pycache__/**",
    "**/vendor/**",
    "**/*.test.{ts,js,py,go}",
    "**/*.spec.{ts,js,py,go}"
  ],
  "output": {
    "directory": "documentation",
    "formats": ["web", "markdown", "openapi", "pdf"],
    "webServer": {
      "port": 8080,
      "host": "0.0.0.0",
      "ssl": {
        "enabled": true,
        "cert": "path/to/cert.pem",
        "key": "path/to/key.pem"
      }
    }
  },
  "features": {
    "realTimeUpdates": true,
    "gitIntegration": true,
    "apiDocumentation": true,
    "architectureDiagrams": true,
    "searchEnabled": true,
    "themeToggle": true,
    "printSupport": true
  },
  "analysis": {
    "includePrivate": false,
    "includeTodos": true,
    "includeTests": false,
    "generateExamples": true,
    "crossReference": true,
    "maxFileSize": "1MB",
    "timeout": 30000
  },
  "templates": {
    "customPath": "docs/templates/",
    "style": "modern",
    "theme": "corporate"
  },
  "performance": {
    "cacheEnabled": true,
    "cacheDirectory": ".docs-cache",
    "maxCacheSize": "500MB",
    "parallelProcessing": true,
    "maxWorkers": 4
  },
  "integrations": {
    "git": {
      "enabled": true,
      "includeHistory": true,
      "maxCommits": 100
    },
    "ci": {
      "webhook": {
        "enabled": true,
        "secret": "your-webhook-secret"
      }
    }
  }
}
```

## 🏃‍♂️ Running the Generator

### Command Line Usage

```bash
# Generate documentation once
living-docs generate

# Start development server with real-time updates
living-docs serve

# Generate and serve
living-docs serve --generate

# Specify custom configuration
living-docs serve --config custom-config.json

# Set custom port
living-docs serve --port 8080

# Enable debug mode
DEBUG=living-docs:* living-docs serve

# Generate specific formats only
living-docs generate --formats web,markdown

# Watch specific directories
living-docs serve --watch "src/**/*.ts,api/**/*.py"
```

### Programmatic Usage

```javascript
const { DocumentationGenerator } = require('@kiro/living-docs-generator');

// Initialize generator
const generator = new DocumentationGenerator({
  projectName: 'My Project',
  languages: ['typescript', 'python'],
  includePaths: ['src/**/*.ts', 'api/**/*.py'],
  outputDir: 'docs'
});

// Generate documentation
async function generateDocs() {
  try {
    const analysis = await generator.analyzeProject('./');
    const markdown = await generator.generateMarkdown(analysis);
    const webAssets = await generator.generateWebDocumentation(analysis);
    
    console.log('Documentation generated successfully!');
  } catch (error) {
    console.error('Generation failed:', error);
  }
}

// Start development server
async function startServer() {
  try {
    await generator.startServer({
      port: 3000,
      realTimeUpdates: true
    });
    
    console.log('Documentation server started at http://localhost:3000');
  } catch (error) {
    console.error('Server failed to start:', error);
  }
}

generateDocs();
// or
startServer();
```

## 🐳 Docker Installation

### Using Pre-built Image

```bash
# Pull the official image
docker pull kiro/living-docs-generator:latest

# Run with your project mounted
docker run -d \
  --name living-docs \
  -p 3000:3000 \
  -v $(pwd):/workspace \
  kiro/living-docs-generator:latest
```

### Custom Dockerfile

```dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache git python3 py3-pip go

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  living-docs:
    image: kiro/living-docs-generator:latest
    ports:
      - "3000:3000"
    volumes:
      - ./:/workspace
      - docs-cache:/app/.docs-cache
    environment:
      - NODE_ENV=production
      - DEBUG=living-docs:info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  docs-cache:
```

## ☁️ Cloud Deployment

### Vercel

```json
{
  "name": "living-docs",
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Netlify

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### AWS Lambda

```javascript
// serverless.yml
service: living-docs-generator

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  memorySize: 1024
  timeout: 30

functions:
  docs:
    handler: lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-offline
```

### Heroku

```json
{
  "name": "living-docs-app",
  "description": "Living Documentation Generator",
  "image": "heroku/nodejs",
  "addons": [
    "heroku-redis:hobby-dev"
  ],
  "env": {
    "NODE_ENV": "production",
    "NPM_CONFIG_PRODUCTION": "false"
  },
  "formation": {
    "web": {
      "quantity": 1,
      "size": "standard-1x"
    }
  }
}
```

## 🔌 IDE Integration

### VS Code Extension

Install the Living Docs VS Code extension:

```bash
code --install-extension kiro.living-docs-vscode
```

Configuration in `.vscode/settings.json`:

```json
{
  "livingDocs.enabled": true,
  "livingDocs.configPath": "./docs-config.json",
  "livingDocs.autoGenerate": true,
  "livingDocs.showInlinePreview": true,
  "livingDocs.serverPort": 3000
}
```

### JetBrains IDEs

Install the Living Docs plugin from the marketplace or configure as external tool:

```xml
<!-- .idea/tools/Living_Docs.xml -->
<toolSet name="Living Docs">
  <tool name="Generate Docs" description="Generate documentation">
    <exec>
      <option name="COMMAND" value="living-docs" />
      <option name="PARAMETERS" value="generate" />
      <option name="WORKING_DIRECTORY" value="$ProjectFileDir$" />
    </exec>
  </tool>
  <tool name="Serve Docs" description="Start documentation server">
    <exec>
      <option name="COMMAND" value="living-docs" />
      <option name="PARAMETERS" value="serve" />
      <option name="WORKING_DIRECTORY" value="$ProjectFileDir$" />
    </exec>
  </tool>
</toolSet>
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/docs.yml
name: Generate Documentation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for git integration
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Generate documentation
      run: |
        npx living-docs generate --formats web,markdown
        
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./docs
        
    - name: Upload documentation artifacts
      uses: actions/upload-artifact@v3
      with:
        name: documentation
        path: docs/
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - docs
  - deploy

generate-docs:
  stage: docs
  image: node:20-alpine
  before_script:
    - apk add --no-cache git python3 go
    - npm ci
  script:
    - npx living-docs generate --formats web,markdown,openapi
  artifacts:
    paths:
      - docs/
    expire_in: 1 week
  only:
    - main
    - develop

deploy-docs:
  stage: deploy
  script:
    - echo "Deploying documentation..."
    # Add your deployment commands here
  dependencies:
    - generate-docs
  only:
    - main
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    tools {
        nodejs '20'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('Generate Documentation') {
            steps {
                sh 'npx living-docs generate --formats web,markdown'
            }
        }
        
        stage('Archive Documentation') {
            steps {
                archiveArtifacts artifacts: 'docs/**/*', fingerprint: true
            }
        }
        
        stage('Deploy Documentation') {
            when {
                branch 'main'
            }
            steps {
                // Add deployment steps here
                sh 'echo "Deploying documentation..."'
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
    }
}
```

## 🔧 Troubleshooting

### Common Installation Issues

**Node.js version conflicts:**
```bash
# Use nvm to manage Node.js versions
nvm install 20
nvm use 20
```

**Permission errors on Linux/macOS:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
# Or use npx instead of global install
npx @kiro/living-docs-generator serve
```

**Python/Go not found:**
```bash
# Install Python
sudo apt-get install python3 python3-pip  # Ubuntu/Debian
brew install python3                       # macOS

# Install Go
sudo apt-get install golang-go            # Ubuntu/Debian
brew install go                            # macOS
```

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
# Or use different port
living-docs serve --port 8080
```

### Performance Issues

**Slow analysis:**
- Reduce included file patterns
- Enable caching in configuration
- Increase memory allocation: `NODE_OPTIONS="--max-old-space-size=4096"`

**High memory usage:**
- Exclude large files and directories
- Reduce `maxWorkers` in configuration
- Enable garbage collection: `NODE_OPTIONS="--expose-gc"`

**WebSocket connection issues:**
- Check firewall settings
- Verify proxy configuration
- Try different port

### Debug Mode

Enable comprehensive logging:

```bash
# All debug output
DEBUG=living-docs:* living-docs serve

# Specific components
DEBUG=living-docs:analyzer,living-docs:generator living-docs serve

# File watching only
DEBUG=living-docs:watcher living-docs serve
```

## 📞 Support

### Getting Help

- **Documentation**: [Full documentation](https://docs.kiro.ai/living-docs)
- **GitHub Issues**: [Report bugs and request features](https://github.com/sgharlow/kiro-living-docs-devpost/issues)
- **Community**: [Join our Discord server](https://discord.gg/kiro-ai)
- **Email**: support@kiro.ai

### Health Check

Verify installation:

```bash
# Check version
living-docs --version

# Verify configuration
living-docs validate --config docs-config.json

# Test analysis
living-docs analyze --dry-run

# Check system health
curl http://localhost:3000/health
```

---

**Installation complete!** 🎉 

Next steps:
1. [Configure your project](./CONFIGURATION.md)
2. [Follow the demo guide](./DEMO_GUIDE.md)
3. [Explore advanced features](./ADVANCED_USAGE.md)
# Living Documentation Generator - Demo Guide

Welcome to the Living Documentation Generator demo! This guide will walk you through all the features and capabilities of our intelligent documentation system.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- Go 1.19+
- Git

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd living-docs-demo
   npm run install:all
   ```

2. **Start all services:**
   ```bash
   npm run dev
   ```

3. **Start documentation server:**
   ```bash
   npm run docs:serve
   ```

4. **Open documentation:**
   Visit `http://localhost:3000` in your browser

## 📋 Demo Scenarios

### Scenario 1: Real-Time Documentation Updates

**What you'll see:** Documentation automatically updates as you modify code

**Steps:**
1. Open `frontend/src/components/UserProfile.tsx`
2. Add a new prop to the `UserProfileProps` interface:
   ```typescript
   /** Whether to show user avatar */
   showAvatar?: boolean;
   ```
3. Watch the documentation update in real-time at `http://localhost:3000/components`
4. Notice the new prop appears in the component documentation within 5 seconds

**Key Features Demonstrated:**
- ✅ Real-time file watching
- ✅ TypeScript analysis and JSDoc parsing
- ✅ WebSocket-based live updates
- ✅ Component prop documentation

### Scenario 2: Multi-Language Code Analysis

**What you'll see:** Comprehensive analysis across TypeScript, Python, and Go

**Steps:**
1. Navigate to `http://localhost:3000/functions`
2. Filter by language using the dropdown
3. Observe functions from all three languages:
   - **TypeScript**: React components, Express routes, utility functions
   - **Python**: Flask endpoints, data models, analytics functions
   - **Go**: HTTP handlers, data structures, service methods
4. Click on any function to see detailed documentation

**Key Features Demonstrated:**
- ✅ Multi-language parsing (TypeScript, Python, Go)
- ✅ Cross-language type mapping
- ✅ Consistent documentation format
- ✅ Language-specific conventions

### Scenario 3: API Documentation Generation

**What you'll see:** Automatic OpenAPI specification generation

**Steps:**
1. Visit `http://localhost:3000/api`
2. Explore the automatically generated API documentation
3. Try the interactive examples:
   - Click "Try it out" on any endpoint
   - Modify the request parameters
   - Execute the request to see live responses
4. Download the OpenAPI specification using the "Download OpenAPI" button

**Key Features Demonstrated:**
- ✅ Automatic API endpoint detection
- ✅ OpenAPI/Swagger specification generation
- ✅ Interactive API testing
- ✅ Request/response examples

### Scenario 4: Architecture Visualization

**What you'll see:** Automatically generated architecture diagrams

**Steps:**
1. Go to `http://localhost:3000/architecture`
2. Explore the dependency graph showing relationships between modules
3. Click on nodes to see detailed information
4. Use the zoom and pan controls to navigate large diagrams
5. Switch between different diagram views (dependencies, components, layers)

**Key Features Demonstrated:**
- ✅ Dependency graph generation
- ✅ Interactive diagram navigation
- ✅ Multiple visualization perspectives
- ✅ Mermaid diagram integration

### Scenario 5: Advanced Search and Navigation

**What you'll see:** Powerful search across all documentation

**Steps:**
1. Use the global search bar at the top of any page
2. Try these search queries:
   - `"user authentication"` - Find authentication-related code
   - `type:function language:python` - Find Python functions
   - `api endpoint users` - Find user-related API endpoints
3. Use keyboard shortcuts:
   - `Ctrl+K` (or `Cmd+K`) to open quick search
   - `Ctrl+Shift+F` to open advanced search
4. Navigate using the table of contents and breadcrumbs

**Key Features Demonstrated:**
- ✅ Full-text search across all content
- ✅ Advanced filtering and query syntax
- ✅ Keyboard shortcuts for power users
- ✅ Contextual navigation

### Scenario 6: Git History Integration

**What you'll see:** Documentation enriched with version control context

**Steps:**
1. Navigate to any function or component page
2. Look for the "History" section showing recent changes
3. Click "View in Git" to see the commit history
4. Notice how commit messages provide context for code evolution
5. See how breaking changes and deprecations are highlighted

**Key Features Demonstrated:**
- ✅ Git history analysis
- ✅ Change context extraction
- ✅ Evolution tracking
- ✅ Breaking change detection

### Scenario 7: Theme and Customization

**What you'll see:** Customizable documentation appearance

**Steps:**
1. Click the theme toggle button (🌙/☀️) in the top navigation
2. Switch between light, dark, and auto themes
3. Notice how the theme preference persists across page reloads
4. Try the print view by pressing `Ctrl+P` to see print-optimized styling

**Key Features Demonstrated:**
- ✅ Multiple theme support
- ✅ User preference persistence
- ✅ Print-friendly styling
- ✅ Responsive design

## 🎯 Performance Demonstrations

### Large Project Handling

**Test with the benchmark suite:**
```bash
npm run benchmark
```

**Expected Results:**
- **Small projects** (10 files): < 1 second analysis
- **Medium projects** (100 files): < 5 seconds analysis  
- **Large projects** (500 files): < 15 seconds analysis
- **Memory usage**: < 300MB for large projects

### Real-Time Update Performance

**Test rapid file changes:**
1. Run the file watcher test:
   ```bash
   npm run test:watcher
   ```
2. Make rapid changes to multiple files
3. Observe documentation updates within 5 seconds
4. Notice debounced updates prevent excessive processing

## 🔧 Configuration Examples

### Basic Configuration

```json
{
  "projectName": "My Project",
  "languages": ["typescript", "python"],
  "includePaths": ["src/**/*.ts", "api/**/*.py"],
  "excludePaths": ["**/node_modules/**", "**/__pycache__/**"],
  "output": {
    "formats": ["web", "markdown"],
    "webServer": { "port": 3000 }
  }
}
```

### Advanced Configuration

```json
{
  "projectName": "Enterprise Application",
  "languages": ["typescript", "python", "go"],
  "features": {
    "realTimeUpdates": true,
    "gitIntegration": true,
    "apiDocumentation": true,
    "architectureDiagrams": true,
    "searchEnabled": true
  },
  "analysis": {
    "includePrivate": false,
    "includeTodos": true,
    "generateExamples": true,
    "crossReference": true
  },
  "templates": {
    "customPath": "docs/templates/",
    "style": "corporate"
  }
}
```

## 🧪 Testing the System

### Run All Tests

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance benchmarks
npm run benchmark

# User acceptance tests
npm run test:acceptance
```

### Manual Testing Checklist

- [ ] **File Watching**: Modify files and verify real-time updates
- [ ] **Multi-Language**: Check TypeScript, Python, and Go analysis
- [ ] **API Documentation**: Verify endpoint detection and OpenAPI generation
- [ ] **Search**: Test global search and advanced filtering
- [ ] **Architecture**: Verify diagram generation and interactivity
- [ ] **Themes**: Test light/dark theme switching
- [ ] **Performance**: Check load times and responsiveness
- [ ] **Error Handling**: Test with malformed code and network issues

## 🎨 Customization Options

### Custom Templates

Create custom documentation templates in `templates/`:

```html
<!-- templates/function.html -->
<div class="custom-function">
  <h3>{{name}}</h3>
  <p>{{description}}</p>
  <div class="signature">
    <code>{{signature}}</code>
  </div>
</div>
```

### Custom Styling

Add custom CSS in the configuration:

```json
{
  "styling": {
    "customCSS": "path/to/custom.css",
    "theme": "corporate",
    "colors": {
      "primary": "#007acc",
      "secondary": "#f0f0f0"
    }
  }
}
```

### Custom Analysis Rules

Define custom analysis rules:

```json
{
  "analysis": {
    "customRules": [
      {
        "pattern": "@deprecated",
        "action": "highlight",
        "style": "warning"
      },
      {
        "pattern": "TODO:",
        "action": "extract",
        "category": "maintenance"
      }
    ]
  }
}
```

## 🚨 Troubleshooting

### Common Issues

**Documentation not updating:**
- Check file watcher permissions
- Verify file paths in configuration
- Check browser WebSocket connection

**Missing functions/classes:**
- Verify language analyzer is enabled
- Check include/exclude patterns
- Ensure proper JSDoc/docstring format

**Performance issues:**
- Reduce included file patterns
- Enable caching in configuration
- Check system resources

**Search not working:**
- Verify search indexing completed
- Check browser JavaScript console
- Restart documentation server

### Debug Mode

Enable debug logging:

```bash
DEBUG=living-docs:* npm run docs:serve
```

### Health Check

Check system status:
```bash
curl http://localhost:3000/health
```

## 📊 Metrics and Analytics

### Built-in Metrics

The system tracks:
- Documentation coverage percentage
- Update frequency and latency
- Search query patterns
- User engagement metrics
- Performance benchmarks

### Accessing Metrics

Visit `http://localhost:3000/metrics` to see:
- Real-time performance data
- Documentation quality scores
- Usage analytics
- System health indicators

## 🎉 Demo Highlights

### What Makes This Special

1. **Zero Configuration**: Works out of the box with intelligent defaults
2. **Real-Time Updates**: See changes instantly without manual regeneration
3. **Multi-Language**: Comprehensive support for TypeScript, Python, and Go
4. **Beautiful UI**: Modern, responsive interface with dark/light themes
5. **Intelligent Analysis**: Context-aware documentation with Git integration
6. **Performance**: Handles large codebases efficiently
7. **Extensible**: Customizable templates, themes, and analysis rules

### Perfect For

- **Development Teams**: Keep documentation current with active development
- **Open Source Projects**: Provide beautiful, always-updated documentation
- **Enterprise Applications**: Maintain comprehensive system documentation
- **API Services**: Generate interactive API documentation automatically
- **Code Reviews**: Understand changes through documentation diffs
- **Onboarding**: Help new developers understand complex codebases

## 🔗 Next Steps

After exploring the demo:

1. **Try with your own project**: Point the generator at your codebase
2. **Customize the appearance**: Modify themes and templates
3. **Integrate with CI/CD**: Set up automatic documentation deployment
4. **Configure team standards**: Use Kiro steering files for consistency
5. **Set up monitoring**: Track documentation quality and usage

## 📞 Support and Feedback

- **Documentation**: Full documentation available at `/docs`
- **Issues**: Report problems through the issue tracker
- **Feature Requests**: Suggest improvements and new features
- **Community**: Join our developer community for tips and best practices

---

**Ready to transform your documentation workflow?** Start with the quick start guide above and explore each scenario to see the full power of living documentation! 🚀
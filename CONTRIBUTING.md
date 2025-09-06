# Contributing to Living Documentation Generator

Thank you for your interest in contributing to the Living Documentation Generator! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kiro-living-docs-devpost.git
   cd kiro-living-docs-devpost
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Build the project**:
   ```bash
   npm run build
   ```
5. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

## 🛠️ Development Workflow

### Setting Up Development Environment

1. **Install prerequisites**:
   - Node.js 18.0.0 or higher
   - Python 3.8+ (for Python analysis features)
   - Go 1.19+ (for Go analysis features)
   - Git

2. **Development commands**:
   ```bash
   # Start development mode with hot reload
   npm run dev
   
   # Run tests
   npm test
   npm run test:integration
   
   # Lint code
   npm run lint
   npm run lint:fix
   
   # Performance benchmarks
   npm run test:performance
   ```

### Project Structure

```
├── src/                    # Source code
│   ├── analyzers/         # Language-specific code analyzers
│   ├── generators/        # Documentation generators
│   ├── server.ts          # MCP server implementation
│   └── utils/             # Shared utilities
├── tests/                 # Test files
├── demo/                  # Demo project showcasing features
├── docs/                  # Project documentation
└── tools/                 # Development tools and scripts
```

## 📝 Making Changes

### Before You Start

1. **Check existing issues** to see if your idea is already being worked on
2. **Create an issue** to discuss major changes before implementing
3. **Follow the development rules** in `.kiro/specs/living-docs-generator/rules.md`

### Code Style

- **TypeScript**: Follow existing patterns and use strict typing
- **Testing**: Write tests for new features and bug fixes
- **Documentation**: Update documentation for any user-facing changes
- **Commits**: Use clear, descriptive commit messages

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Add tests** for new functionality:
   ```bash
   # Run tests to ensure they pass
   npm test
   npm run test:integration
   ```

4. **Update documentation** if needed:
   - Update README.md for user-facing changes
   - Add JSDoc comments for new functions/classes
   - Update demo examples if relevant

5. **Lint your code**:
   ```bash
   npm run lint:fix
   ```

6. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/demos for UI changes

## 🧪 Testing Guidelines

### Test Types

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **Performance Tests**: Ensure performance targets are met

### Writing Tests

```typescript
// Example test structure
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

### Test Coverage

- Maintain **80%+ test coverage**
- Focus on critical paths and edge cases
- Test error handling and edge cases

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **Environment details**:
   - Operating System
   - Node.js version
   - Kiro version
   - Project type being analyzed
5. **Error messages** or logs if available
6. **Minimal reproduction case** if possible

## 💡 Feature Requests

For new features:

1. **Check existing issues** first
2. **Describe the use case** and problem being solved
3. **Propose a solution** if you have ideas
4. **Consider backwards compatibility**
5. **Think about performance implications**

## 🏗️ Architecture Guidelines

### Adding New Language Support

1. **Create analyzer** in `src/analyzers/`
2. **Implement required interfaces**:
   - `analyzeFile(filePath: string): Promise<FileAnalysis>`
   - `getSupportedExtensions(): string[]`
3. **Add tests** in `tests/analyzers/`
4. **Update project detector** in `src/project-detector.ts`
5. **Add demo examples** in `demo/`

### Adding New Output Formats

1. **Create generator** in `src/generators/`
2. **Implement generator interface**
3. **Add configuration options**
4. **Write comprehensive tests**
5. **Update documentation**

## 📚 Documentation

### Types of Documentation

- **Code Comments**: JSDoc for all public APIs
- **README Updates**: For user-facing changes
- **Architecture Docs**: For significant structural changes
- **Demo Updates**: Keep examples current

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep examples up-to-date
- Test all code snippets

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers get started
- Celebrate contributions of all sizes

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Code Review**: Learn from feedback

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

## 📋 Checklist for Contributors

Before submitting a PR:

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] PR description explains the changes
- [ ] No breaking changes without discussion

## 🚀 Release Process

Releases are managed by maintainers:

1. **Version bumping** follows semantic versioning
2. **Changelog** is updated with notable changes
3. **GitHub releases** include binaries and notes
4. **NPM publishing** for package distribution

---

Thank you for contributing to Living Documentation Generator! Your contributions help make documentation better for developers everywhere. 🎉
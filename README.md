# Living Documentation Generator

An intelligent MCP server for Kiro that automatically generates, maintains, and updates project documentation in real-time.

## Features

- **Real-time Documentation**: Updates within 5 seconds of code changes
- **Zero Configuration**: Works out-of-the-box with intelligent project detection
- **Multi-language Support**: TypeScript, JavaScript, Python, and Go
- **Beautiful Web UI**: Modern, responsive interface with search and navigation
- **Kiro Integration**: Leverages steering files, hooks, and contextual awareness

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- Kiro IDE with MCP support

### Setup

1. Clone and build the project:
```bash
git clone <repository-url>
cd living-docs-generator
npm install
npm run build
```

2. Configure Kiro MCP settings by adding to `~/.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "living-docs": {
      "command": "node",
      "args": ["./dist/server.js"],
      "cwd": "/path/to/living-docs-generator"
    }
  }
}
```

3. Restart Kiro to load the MCP server

## Usage

### Basic Documentation Generation

Use the MCP tools in Kiro:

- `generate_docs`: Generate documentation for a project
- `watch_project`: Start real-time documentation updates
- `stop_watching`: Stop watching for changes

### Configuration

Create a `living-docs.config.json` file in your project root:

```json
{
  "outputPath": "docs",
  "includePatterns": ["**/*.ts", "**/*.js"],
  "excludePatterns": ["node_modules/**", "dist/**"],
  "outputFormats": ["markdown", "html"],
  "webServerPort": 3000
}
```

## Development

### Running Tests

```bash
npm test
npm run test:integration
```

### Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
```

## Architecture

The system uses a multi-layered architecture:

- **MCP Server**: Handles Kiro integration and tool requests
- **File Watcher**: Monitors code changes using chokidar
- **Code Analyzers**: Extract semantic information from source code
- **Documentation Generators**: Create beautiful, structured documentation
- **Web Server**: Serves interactive documentation with real-time updates

## Performance Targets

- Documentation updates: < 5 seconds
- Memory usage: < 100MB for typical projects
- Supports projects with 1000+ files

## Platform-Specific Notes

### Go Language Support on Windows

The Go analyzer uses a native Go parser for optimal performance and accuracy. On Windows systems, if you encounter Go parser errors, the system will automatically fall back to regex-based parsing (which still works but with reduced accuracy).

#### Troubleshooting Go Parser Issues

If you see errors like "The system cannot find the path specified" when analyzing Go files:

1. **Check if Go is installed:**
   ```bash
   go version
   ```
   If not installed, download from https://golang.org/dl/

2. **Verify the system is using regex fallback:**
   Look for console messages like "Go parser failed, falling back to regex parsing"
   This means the system is working correctly with reduced accuracy.

3. **For full AST parsing (optional):**
   The system expects a Go parser executable at `dist/analyzers/go-parser/go-parser.exe`
   
   If building from source and the Go parser source is available:
   ```bash
   # Navigate to the Go parser directory (if available)
   cd src/analyzers/go-parser
   go build -o ../../../dist/analyzers/go-parser/go-parser.exe main.go
   ```

#### What Works Without Native Parser

The regex fallback provides functional Go documentation generation including:
- ✅ Function and method detection
- ✅ Struct and interface identification  
- ✅ Package-level documentation
- ✅ Basic type information
- ❌ Advanced AST analysis (reduced accuracy)

**Bottom Line:** The system remains fully operational for Go projects even without the native parser.

## Troubleshooting

### Common Issues

#### "The system cannot find the path specified" (Windows + Go)
This is expected behavior on Windows when the Go parser binary is not available. The system automatically falls back to regex parsing. See [Go Language Support](#go-language-support-on-windows) above.

#### Documentation generation is slow
- Check if you're analyzing very large files (>1MB)
- Verify include/exclude patterns in your config are optimized
- Use the performance benchmark: `npm run test:performance`

#### MCP server not responding in Kiro
1. Verify the server builds successfully: `npm run build`
2. Check your Kiro MCP configuration path is correct
3. Restart Kiro after configuration changes

#### Empty or missing documentation
- Ensure your project has supported file types (.ts, .js, .py, .go)
- Check that files aren't excluded by your patterns
- Verify the output directory exists and is writable

## Contributing

1. Follow the development rules in `.kiro/specs/living-docs-generator/rules.md`
2. Ensure all tests pass before submitting changes
3. Update documentation for any new features

## License

MIT License - see LICENSE file for details
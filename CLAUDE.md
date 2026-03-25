# Living Documentation Generator

## Project Overview
An intelligent MCP server for Kiro IDE that automatically generates, maintains, and updates project documentation in real-time. Built for a Devpost hackathon submission.

## Tech Stack
- **Language:** TypeScript 5.2+
- **Runtime:** Node.js 18+
- **Testing:** Jest
- **Build:** TypeScript compiler (tsc)
- **File watching:** chokidar

## Commands
- `npm install` — Install dependencies
- `npm run build` — Compile TypeScript
- `npm run dev` — Watch mode (build + run)
- `npm start` — Run server
- `npm test` — Run tests (Jest)
- `npm run test:integration` — Integration tests
- `npm run lint` — ESLint

## Testing
- **236 test files** in the repository
- Test runner: Jest
- Integration tests available via `npm run test:integration`

## Architecture
- **MCP Server** (`dist/server.js`) — Handles Kiro IDE tool requests
- **File Watcher** — Monitors code changes via chokidar
- **Code Analyzers** — Extract semantic info from TypeScript, JavaScript, Python, Go
- **Documentation Generators** — Create structured docs in Markdown and HTML
- **Web Server** — Serves interactive documentation with real-time updates

## MCP Tools
- `generate_docs` — Generate documentation for a project
- `watch_project` — Start real-time documentation updates
- `stop_watching` — Stop watching for changes

## Key Conventions
- Multi-language support: TypeScript, JavaScript, Python, Go
- Go analyzer has native parser with regex fallback on Windows
- Configuration via `living-docs.config.json` in project root
- Output formats: Markdown, HTML
- Performance target: documentation updates < 5 seconds

## Links
- **GitHub:** https://github.com/sgharlow/kiro-living-docs-devpost

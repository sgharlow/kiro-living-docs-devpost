# server.ts

## Overview

This file contains 1 function, 1 class.

## Table of Contents

### Classes
- [LivingDocsServer](#livingdocsserver)

### Functions
- [main](#main)

## Classes

### LivingDocsServer

```typescript
class LivingDocsServer
```

**Properties:**

- **server**: Server
- **typescriptAnalyzer**: TypeScriptAnalyzer
- **pythonAnalyzer**: PythonAnalyzer
- **goAnalyzer**: GoAnalyzer
- **markdownGenerator**: MarkdownGenerator
- **watchedProjects**
- **performanceOptimizer**: PerformanceOptimizer
- **onboardingManager**: OnboardingManager
- **troubleshootingGuide**: TroubleshootingGuide
- **usageAnalytics**: UsageAnalytics

**Methods:**

- **setupToolHandlers**
  ```typescript
  setupToolHandlers(): void
  ```

- **getAnalyzerForFile**
  ```typescript
  getAnalyzerForFile(filePath: string)
  ```

- **handleGenerateDocs**
  ```typescript
  async handleGenerateDocs(args: Record<string, unknown>)
  ```

- **handleWatchProject**
  ```typescript
  async handleWatchProject(args: Record<string, unknown>)
  ```

- **handleStopWatching**
  ```typescript
  async handleStopWatching()
  ```

- **handleDetectProject**
  ```typescript
  async handleDetectProject(args: Record<string, unknown>)
  ```

- **handleStartOnboarding**
  ```typescript
  async handleStartOnboarding(args: Record<string, unknown>)
  ```

- **handleConfigurationWizard**
  ```typescript
  async handleConfigurationWizard(args: Record<string, unknown>)
  ```

- **handleTroubleshoot**
  ```typescript
  async handleTroubleshoot(args: Record<string, unknown>)
  ```

- **handleGetAnalytics**
  ```typescript
  async handleGetAnalytics(args: Record<string, unknown>)
  ```

- **setupAnalytics**
  ```typescript
  setupAnalytics(): void
  ```

- **start**
  ```typescript
  async start(): Promise<void>
  ```


## Functions

### main

```typescript
async function main()
```


## Dependencies

This file imports from the following modules:

- **@modelcontextprotocol/sdk/server/index.js** (named): Server
- **@modelcontextprotocol/sdk/server/stdio.js** (named): StdioServerTransport
- **@modelcontextprotocol/sdk/types.js** (named): CallToolRequestSchema, ListToolsRequestSchema
- **./analyzers/typescript-analyzer.js** (named): TypeScriptAnalyzer
- **./analyzers/python-analyzer.js** (named): PythonAnalyzer
- **./analyzers/go-analyzer.js** (named): GoAnalyzer
- **./generators/markdown-generator.js** (named): MarkdownGenerator
- **./watcher.js** (named): FileWatcher
- **./config.js** (named): ConfigManager
- **./project-detector.js** (named): ProjectDetector
- **./types.js** (named): FileChange, ProjectAnalysis, ProjectMetadata
- **./performance/performance-optimizer.js** (named): PerformanceOptimizer
- **./onboarding/onboarding-manager.js** (named): OnboardingManager
- **./wizard/configuration-wizard.js** (named): ConfigurationWizard
- **./troubleshooting/troubleshooting-guide.js** (named): TroubleshootingGuide
- **./analytics/usage-analytics.js** (named): UsageAnalytics
- **path** (namespace): path
- **fs** (namespace): fs

## Exports

This file exports:

- **LivingDocsServer** (variable)

## TODOs

- **TODO** (line 564): Trigger documentation generation in next tasks

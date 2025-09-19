# watcher.ts

## Overview

This file contains 1 class.

## Table of Contents

### Classes
- [FileWatcher](#filewatcher)

## Classes

### FileWatcher (exported)

```typescript
class FileWatcher extends EventEmitter
```

**Properties:**

- **watcher**: chokidar.FSWatcher | null
- **config**: ProjectConfig
- **changeQueue**: FileChange[]
- **debounceTimer**: NodeJS.Timeout | null
- **isWatching**

**Methods:**

- **startWatching**
  ```typescript
  async startWatching(): Promise<void>
  ```

- **stopWatching**
  ```typescript
  async stopWatching(): Promise<void>
  ```

- **getStatus**
  ```typescript
  getStatus(): { isWatching: boolean; queuedChanges: number }
  ```

- **handleFileChange**
  ```typescript
  handleFileChange(filePath: string, type: FileChange['type']): void
  ```

- **processChangeQueue**
  ```typescript
  processChangeQueue(): void
  ```

- **buildWatchPatterns**
  ```typescript
  buildWatchPatterns(): string[]
  ```

- **isSourceFile**
  ```typescript
  isSourceFile(filePath: string): boolean
  ```

- **flushChanges**
  ```typescript
  flushChanges(): void
  ```


## Dependencies

This file imports from the following modules:

- **chokidar** (namespace): chokidar
- **events** (named): EventEmitter
- **./types.js** (named): FileChange, ProjectConfig
- **path** (namespace): path

## Exports

This file exports:

- **FileWatcher** (class)

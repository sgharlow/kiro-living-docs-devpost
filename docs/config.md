# config.ts

## Overview

This file contains 1 class.

## Table of Contents

### Classes
- [ConfigManager](#configmanager)

## Classes

### ConfigManager (exported)

```typescript
class ConfigManager
```

**Properties:**

- **readonly DEFAULT_CONFIG**: Partial<ProjectConfig>

**Methods:**

- **loadConfig**
  ```typescript
  async loadConfig(projectPath: string): Promise<ProjectConfig>
  ```

- **generateConfigFile**
  ```typescript
  async generateConfigFile(projectPath: string, options?: {
    includeComments?: boolean;
    overwrite?: boolean;
  }): Promise<void>
  ```

- **getEnvironmentConfig**
  ```typescript
  getEnvironmentConfig(): Partial<ProjectConfig>
  ```


## Dependencies

This file imports from the following modules:

- **./types** (named): ProjectConfig
- **./project-detector** (named): ProjectDetector
- **./config-schema** (named): ConfigValidator
- **path** (namespace): path
- **fs** (namespace): fs

## Exports

This file exports:

- **ConfigManager** (class)

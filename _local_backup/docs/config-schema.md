# config-schema.ts

## Overview

This file contains 1 class, 8 interfaces.

## Table of Contents

### Interfaces
- [LivingDocsConfig](#livingdocsconfig)
- [TypeScriptConfig](#typescriptconfig)
- [PythonConfig](#pythonconfig)
- [GoConfig](#goconfig)
- [KiroIntegrationConfig](#kirointegrationconfig)
- [GitIntegrationConfig](#gitintegrationconfig)
- [ValidationError](#validationerror)
- [ValidationResult](#validationresult)

### Classes
- [ConfigValidator](#configvalidator)

## Interfaces

### LivingDocsConfig (exported)

```typescript
interface LivingDocsConfig {
  projectPath: string;
  outputPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  outputFormats: OutputFormat[];
  webServerPort?: number;
  watchDebounceMs?: number;
  features?: {
    realTimeUpdates?: boolean;
    gitIntegration?: boolean;
    apiDocumentation?: boolean;
    architectureDiagrams?: boolean;
    searchIndex?: boolean;
    performanceMetrics?: boolean;
  };
  languages?: {
    typescript?: TypeScriptConfig;
    python?: PythonConfig;
    go?: GoConfig;
  };
  documentation?: {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
    theme?: string;
    customCSS?: string;
    logo?: string;
  };
  integrations?: {
    kiro?: KiroIntegrationConfig;
    git?: GitIntegrationConfig;
  };
}
```


### TypeScriptConfig (exported)

```typescript
interface TypeScriptConfig {
  enabled: boolean;
  includePrivate?: boolean;
  generateInterfaces?: boolean;
  apiEndpointDetection?: boolean;
  tsConfigPath?: string;
}
```


### PythonConfig (exported)

```typescript
interface PythonConfig {
  enabled: boolean;
  includePrivate?: boolean;
  docstringStyle?: 'google' | 'numpy' | 'sphinx';
  requirementsPath?: string;
}
```


### GoConfig (exported)

```typescript
interface GoConfig {
  enabled: boolean;
  includePrivate?: boolean;
  generateStructDocs?: boolean;
  goModPath?: string;
}
```


### KiroIntegrationConfig (exported)

```typescript
interface KiroIntegrationConfig {
  steeringFiles?: boolean;
  hooks?: boolean;
  contextAware?: boolean;
}
```


### GitIntegrationConfig (exported)

```typescript
interface GitIntegrationConfig {
  enabled?: boolean;
  includeHistory?: boolean;
  changePatterns?: boolean;
  contributorStats?: boolean;
}
```


### ValidationError (exported)

```typescript
interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
  severity: 'error' | 'warning';
}
```


### ValidationResult (exported)

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  config: LivingDocsConfig;
}
```


## Classes

### ConfigValidator (exported)

```typescript
class ConfigValidator
```

**Methods:**

- **validate**
  ```typescript
  validate(config: any): ValidationResult
  ```

- **validateRequiredFields**
  ```typescript
  validateRequiredFields(config: any, errors: ValidationError[]): void
  ```

- **validateFieldTypes**
  ```typescript
  validateFieldTypes(config: any, errors: ValidationError[]): void
  ```

- **validateFieldValues**
  ```typescript
  validateFieldValues(config: any, errors: ValidationError[], warnings: ValidationError[]): void
  ```

- **validateLogicalConsistency**
  ```typescript
  validateLogicalConsistency(config: any, _errors: ValidationError[], warnings: ValidationError[]): void
  ```

- **applyDefaults**
  ```typescript
  applyDefaults(config: any): LivingDocsConfig
  ```

- **generateExample**
  ```typescript
  generateExample(projectType: 'typescript' | 'python' | 'go' | 'mixed'): LivingDocsConfig
  ```


## Exports

This file exports:

- **LivingDocsConfig** (interface)
- **TypeScriptConfig** (interface)
- **PythonConfig** (interface)
- **GoConfig** (interface)
- **KiroIntegrationConfig** (interface)
- **GitIntegrationConfig** (interface)
- **ValidationError** (interface)
- **ValidationResult** (interface)
- **ConfigValidator** (class)

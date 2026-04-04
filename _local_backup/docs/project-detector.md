# project-detector.ts

## Overview

This file contains 1 class, 3 interfaces.

## Table of Contents

### Interfaces
- [DetectedProject](#detectedproject)
- [FrameworkInfo](#frameworkinfo)
- [LanguageInfo](#languageinfo)

### Classes
- [ProjectDetector](#projectdetector)

## Interfaces

### DetectedProject (exported)

```typescript
interface DetectedProject {
  type: ProjectType;
  languages: string[];
  frameworks: string[];
  metadata: ProjectMetadata;
  suggestedConfig: Partial<ProjectConfig>;
}
```


### FrameworkInfo (exported)

```typescript
interface FrameworkInfo {
  name: string;
  confidence: number;
  indicators: string[];
}
```


### LanguageInfo (exported)

```typescript
interface LanguageInfo {
  language: string;
  fileCount: number;
  confidence: number;
  extensions: string[];
}
```


## Classes

### ProjectDetector (exported)

```typescript
class ProjectDetector
```

**Properties:**

- **readonly PACKAGE_FILES**
- **readonly FRAMEWORK_INDICATORS**
- **readonly LANGUAGE_EXTENSIONS**

**Methods:**

- **detectProject**
  ```typescript
  async detectProject(projectPath: string): Promise<DetectedProject>
  ```

- **detectLanguages**
  ```typescript
  async detectLanguages(projectPath: string): Promise<LanguageInfo[]>
  ```

- **determineProjectType**
  ```typescript
  determineProjectType(projectPath: string, languages: LanguageInfo[]): ProjectType
  ```

- **detectFrameworks**
  ```typescript
  async detectFrameworks(projectPath: string, projectType: ProjectType): Promise<FrameworkInfo[]>
  ```

- **getDependencies**
  ```typescript
  async getDependencies(projectPath: string, projectType: ProjectType): Promise<string[]>
  ```

- **checkPatterns**
  ```typescript
  async checkPatterns(projectPath: string, patterns: string[]): Promise<number>
  ```

- **matchesPattern**
  ```typescript
  matchesPattern(filePath: string, pattern: string): boolean
  ```

- **extractMetadata**
  ```typescript
  async extractMetadata(projectPath: string, projectType: ProjectType): Promise<ProjectMetadata>
  ```

- **generateSuggestedConfig**
  ```typescript
  generateSuggestedConfig(projectPath: string, projectType: ProjectType, languages: LanguageInfo[], frameworks: FrameworkInfo[]): Partial<ProjectConfig>
  ```

- **walkDirectory**
  ```typescript
  async walkDirectory(dirPath: string, callback: (filePath: string) => void, maxDepth: number, currentDepth: number): Promise<void>
  ```

- **shouldSkipDirectory**
  ```typescript
  shouldSkipDirectory(dirName: string): boolean
  ```

- **validateDetectedConfig**
  ```typescript
  validateDetectedConfig(detected: DetectedProject): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }
  ```


## Dependencies

This file imports from the following modules:

- **fs** (namespace): fs
- **path** (namespace): path
- **./types** (named): ProjectConfig, ProjectMetadata

## Exports

This file exports:

- **DetectedProject** (interface)
- **FrameworkInfo** (interface)
- **LanguageInfo** (interface)
- **ProjectDetector** (class)

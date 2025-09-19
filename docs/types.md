# types.ts

## Overview

This file contains 18 interfaces.

## Table of Contents

### Interfaces
- [ProjectConfig](#projectconfig)
- [FileChange](#filechange)
- [AnalysisResult](#analysisresult)
- [FunctionInfo](#functioninfo)
- [ClassInfo](#classinfo)
- [InterfaceInfo](#interfaceinfo)
- [ParameterInfo](#parameterinfo)
- [PropertyInfo](#propertyinfo)
- [ExportInfo](#exportinfo)
- [ImportInfo](#importinfo)
- [CommentInfo](#commentinfo)
- [TodoInfo](#todoinfo)
- [ProjectAnalysis](#projectanalysis)
- [ProjectMetadata](#projectmetadata)
- [ProjectStructure](#projectstructure)
- [RepositoryInfo](#repositoryinfo)
- [DocumentationOutput](#documentationoutput)
- [ApiEndpointInfo](#apiendpointinfo)

## Interfaces

### ProjectConfig (exported)

```typescript
interface ProjectConfig {
  projectPath: string;
  outputPath?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  languages?: string[];
  outputFormats?: ('markdown' | 'html')[];
  webServerPort?: number;
  watchDebounceMs?: number;
  cacheSizeMB?: number;
  analysisTimeoutMs?: number;
  autoDetect?: boolean;
}
```


### FileChange (exported)

```typescript
interface FileChange {
  path: string;
  type: 'modified' | 'added' | 'deleted' | 'renamed';
  timestamp: number;
  content?: string;
}
```


### AnalysisResult (exported)

```typescript
interface AnalysisResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];
  comments: CommentInfo[];
  todos: TodoInfo[];
  apiEndpoints: ApiEndpointInfo[];
}
```


### FunctionInfo (exported)

```typescript
interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string | undefined;
  description?: string | undefined;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
}
```


### ClassInfo (exported)

```typescript
interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string | undefined;
  implements?: string[] | undefined;
  description?: string | undefined;
  isExported: boolean;
  startLine: number;
  endLine: number;
}
```


### InterfaceInfo (exported)

```typescript
interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  methods: FunctionInfo[];
  extends?: string[] | undefined;
  description?: string | undefined;
  isExported: boolean;
  startLine: number;
  endLine: number;
}
```


### ParameterInfo (exported)

```typescript
interface ParameterInfo {
  name: string;
  type?: string | undefined;
  optional: boolean;
  defaultValue?: string | undefined;
  description?: string | undefined;
}
```


### PropertyInfo (exported)

```typescript
interface PropertyInfo {
  name: string;
  type?: string | undefined;
  optional: boolean;
  readonly: boolean;
  description?: string | undefined;
}
```


### ExportInfo (exported)

```typescript
interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
  isDefault: boolean;
}
```


### ImportInfo (exported)

```typescript
interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}
```


### CommentInfo (exported)

```typescript
interface CommentInfo {
  type: 'single' | 'multi' | 'jsdoc';
  content: string;
  startLine: number;
  endLine: number;
}
```


### TodoInfo (exported)

```typescript
interface TodoInfo {
  content: string;
  type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE';
  line: number;
  author?: string;
}
```


### ProjectAnalysis (exported)

```typescript
interface ProjectAnalysis {
  metadata: ProjectMetadata;
  structure: ProjectStructure;
  files: Map<string, AnalysisResult>;
  lastUpdated: Date;
}
```


### ProjectMetadata (exported)

```typescript
interface ProjectMetadata {
  name: string;
  version?: string;
  description?: string;
  languages: string[];
  framework?: string;
  repository?: RepositoryInfo;
}
```


### ProjectStructure (exported)

```typescript
interface ProjectStructure {
  directories: string[];
  files: string[];
  entryPoints: string[];
  testFiles: string[];
  configFiles: string[];
}
```


### RepositoryInfo (exported)

```typescript
interface RepositoryInfo {
  url?: string;
  branch?: string;
  lastCommit?: string;
}
```


### DocumentationOutput (exported)

```typescript
interface DocumentationOutput {
  markdown?: string;
  html?: string;
  assets?: Map<string, Buffer>;
}
```


### ApiEndpointInfo (exported)

```typescript
interface ApiEndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  handler: string;
  parameters?: ParameterInfo[];
  description?: string;
  line: number;
}
```


## Exports

This file exports:

- **ProjectConfig** (interface)
- **FileChange** (interface)
- **AnalysisResult** (interface)
- **FunctionInfo** (interface)
- **ClassInfo** (interface)
- **InterfaceInfo** (interface)
- **ParameterInfo** (interface)
- **PropertyInfo** (interface)
- **ExportInfo** (interface)
- **ImportInfo** (interface)
- **CommentInfo** (interface)
- **TodoInfo** (interface)
- **ProjectAnalysis** (interface)
- **ProjectMetadata** (interface)
- **ProjectStructure** (interface)
- **RepositoryInfo** (interface)
- **DocumentationOutput** (interface)
- **ApiEndpointInfo** (interface)

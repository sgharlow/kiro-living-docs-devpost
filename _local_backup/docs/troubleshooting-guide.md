# troubleshooting-guide.ts

## Overview

This file contains 1 class, 5 interfaces.

## Table of Contents

### Interfaces
- [TroubleshootingIssue](#troubleshootingissue)
- [TroubleshootingSolution](#troubleshootingsolution)
- [DiagnosticCheck](#diagnosticcheck)
- [DiagnosticResult](#diagnosticresult)
- [SystemDiagnostics](#systemdiagnostics)

### Classes
- [TroubleshootingGuide](#troubleshootingguide)

## Interfaces

### TroubleshootingIssue (exported)

```typescript
interface TroubleshootingIssue {
  id: string;
  category: 'performance' | 'configuration' | 'analysis' | 'network' | 'permissions' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  symptoms: string[];
  possibleCauses: string[];
  solutions: TroubleshootingSolution[];
  diagnostics?: DiagnosticCheck[];
}
```


### TroubleshootingSolution (exported)

```typescript
interface TroubleshootingSolution {
  id: string;
  title: string;
  description: string;
  steps: string[];
  automated?: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTime: string;
}
```


### DiagnosticCheck (exported)

```typescript
interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  check: () => Promise<DiagnosticResult>;
}
```


### DiagnosticResult (exported)

```typescript
interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: any;
  suggestion?: string;
}
```


### SystemDiagnostics (exported)

```typescript
interface SystemDiagnostics {
  timestamp: Date;
  nodeVersion: string;
  platform: string;
  architecture: string;
  memoryUsage: NodeJS.MemoryUsage;
  diskSpace: { free: number; total: number };
  networkConnectivity: boolean;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canExecute: boolean;
  };
  dependencies: Array<{ name: string; version: string; status: 'ok' | 'missing' | 'outdated' }>;
}
```


## Classes

### TroubleshootingGuide (exported)

```typescript
class TroubleshootingGuide extends EventEmitter
```

**Properties:**

- **knownIssues**: Map<string, TroubleshootingIssue>
- **diagnosticHistory**: DiagnosticResult[]

**Methods:**

- **runDiagnostics**
  ```typescript
  async runDiagnostics(projectPath?: string): Promise<SystemDiagnostics>
  ```

- **analyzeError**
  ```typescript
  analyzeError(error: Error, context?: any): TroubleshootingIssue[]
  ```

- **analyzePerformance**
  ```typescript
  analyzePerformance(metrics: PerformanceMetrics): TroubleshootingIssue[]
  ```

- **getIssue**
  ```typescript
  getIssue(issueId: string): TroubleshootingIssue | null
  ```

- **searchIssues**
  ```typescript
  searchIssues(query: string, category?: string): TroubleshootingIssue[]
  ```

- **executeAutomatedSolution**
  ```typescript
  async executeAutomatedSolution(issueId: string, solutionId: string, projectPath?: string): Promise<boolean>
  ```

- **generateReport**
  ```typescript
  async generateReport(projectPath?: string): Promise<string>
  ```

- **initializeKnownIssues**
  ```typescript
  initializeKnownIssues(): void
  ```

- **matchesErrorPattern**
  ```typescript
  matchesErrorPattern(errorMessage: string, errorStack: string, issue: TroubleshootingIssue): boolean
  ```

- **getGeneralErrorGuidance**
  ```typescript
  getGeneralErrorGuidance(error: Error, _context?: any): TroubleshootingIssue
  ```

- **runAutomatedSolution**
  ```typescript
  async runAutomatedSolution(solution: TroubleshootingSolution, projectPath?: string): Promise<boolean>
  ```

- **enableCaching**
  ```typescript
  async enableCaching(_projectPath?: string): Promise<boolean>
  ```

- **enableGarbageCollection**
  ```typescript
  async enableGarbageCollection(): Promise<boolean>
  ```

- **reduceCacheSize**
  ```typescript
  async reduceCacheSize(_projectPath?: string): Promise<boolean>
  ```

- **changeWebServerPort**
  ```typescript
  async changeWebServerPort(_projectPath?: string): Promise<boolean>
  ```

- **checkDiskSpace**
  ```typescript
  async checkDiskSpace(projectPath?: string): Promise<{ free: number; total: number }>
  ```

- **checkNetworkConnectivity**
  ```typescript
  async checkNetworkConnectivity(): Promise<boolean>
  ```

- **checkPermissions**
  ```typescript
  async checkPermissions(projectPath?: string): Promise<{ canRead: boolean; canWrite: boolean; canExecute: boolean }>
  ```

- **checkDependencies**
  ```typescript
  async checkDependencies(): Promise<Array<{ name: string; version: string; status: 'ok' | 'missing' | 'outdated' }>>
  ```


## Dependencies

This file imports from the following modules:

- **events** (named): EventEmitter
- **fs** (namespace): fs
- **../performance/performance-optimizer.js** (named): PerformanceMetrics

## Exports

This file exports:

- **TroubleshootingIssue** (interface)
- **TroubleshootingSolution** (interface)
- **DiagnosticCheck** (interface)
- **DiagnosticResult** (interface)
- **SystemDiagnostics** (interface)
- **TroubleshootingGuide** (class)

# configuration-wizard.ts

## Overview

This file contains 1 class, 3 interfaces.

## Table of Contents

### Interfaces
- [WizardStep](#wizardstep)
- [WizardAnswer](#wizardanswer)
- [WizardConfiguration](#wizardconfiguration)

### Classes
- [ConfigurationWizard](#configurationwizard)

## Interfaces

### WizardStep (exported)

```typescript
interface WizardStep {
  id: string;
  title: string;
  description: string;
  type: 'input' | 'select' | 'multiselect' | 'boolean' | 'path' | 'review';
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: (value: any) => string | null;
  defaultValue?: any;
  dependsOn?: string;
  condition?: (answers: Record<string, any>) => boolean;
}
```


### WizardAnswer (exported)

```typescript
interface WizardAnswer {
  stepId: string;
  value: any;
  timestamp: Date;
}
```


### WizardConfiguration (exported)

```typescript
interface WizardConfiguration {
  projectPath: string;
  projectName: string;
  languages: string[];
  frameworks: string[];
  includePatterns: string[];
  excludePatterns: string[];
  outputPath: string;
  outputFormats: string[];
  webServerPort: number;
  enableRealTime: boolean;
  enableGitIntegration: boolean;
  enableApiDocs: boolean;
  enableDiagrams: boolean;
  cacheEnabled: boolean;
  customTemplates: boolean;
  templatePath?: string;
  steeringIntegration: boolean;
  hookIntegration: boolean;
}
```


## Classes

### ConfigurationWizard (exported)

```typescript
class ConfigurationWizard extends EventEmitter
```

**Properties:**

- **steps**: WizardStep[]
- **answers**: Map<string, WizardAnswer>
- **currentStepIndex**
- **projectPath**: string
- **detectedConfig**: any

**Methods:**

- **start**
  ```typescript
  async start(): Promise<void>
  ```

- **getCurrentStep**
  ```typescript
  getCurrentStep(): WizardStep | null
  ```

- **getVisibleSteps**
  ```typescript
  getVisibleSteps(): WizardStep[]
  ```

- **answerCurrentStep**
  ```typescript
  answerCurrentStep(value: any): { valid: boolean; error?: string; nextStep?: WizardStep }
  ```

- **goToPreviousStep**
  ```typescript
  goToPreviousStep(): WizardStep | null
  ```

- **skipCurrentStep**
  ```typescript
  skipCurrentStep(): { valid: boolean; error?: string; nextStep?: WizardStep }
  ```

- **getProgress**
  ```typescript
  getProgress(): { current: number; total: number; percentage: number }
  ```

- **isComplete**
  ```typescript
  isComplete(): boolean
  ```

- **generateConfiguration**
  ```typescript
  generateConfiguration(): WizardConfiguration
  ```

- **saveConfiguration**
  ```typescript
  async saveConfiguration(): Promise<string>
  ```

- **getAnswersObject**
  ```typescript
  getAnswersObject(): Record<string, any>
  ```

- **validateAnswer**
  ```typescript
  validateAnswer(step: WizardStep, value: any): string | null
  ```

- **advanceToNextStep**
  ```typescript
  advanceToNextStep(): { valid: boolean; nextStep?: WizardStep }
  ```

- **initializeSteps**
  ```typescript
  initializeSteps(): void
  ```

- **updateStepsWithDetectedConfig**
  ```typescript
  updateStepsWithDetectedConfig(): void
  ```

- **generateDefaultIncludePatterns**
  ```typescript
  generateDefaultIncludePatterns(languages: string[]): string[]
  ```

- **generateDefaultExcludePatterns**
  ```typescript
  generateDefaultExcludePatterns(): string[]
  ```


## Dependencies

This file imports from the following modules:

- **events** (named): EventEmitter
- **../project-detector.js** (named): ProjectDetector
- **../config.js** (named): ConfigManager

## Exports

This file exports:

- **WizardStep** (interface)
- **WizardAnswer** (interface)
- **WizardConfiguration** (interface)
- **ConfigurationWizard** (class)

## TODOs

- **TODO** (line 222): Use configuration data for advanced config generation

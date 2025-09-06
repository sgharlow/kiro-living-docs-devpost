/**
 * Configuration Wizard for Living Documentation Generator
 * 
 * Provides an interactive wizard to help users set up complex project
 * configurations with guided steps and validation.
 */

import { EventEmitter } from 'events';
import { ProjectDetector } from '../project-detector.js';
import { ConfigManager } from '../config.js';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  type: 'input' | 'select' | 'multiselect' | 'boolean' | 'path' | 'review';
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: (value: any) => string | null;
  defaultValue?: any;
  dependsOn?: string; // Step ID this step depends on
  condition?: (answers: Record<string, any>) => boolean;
}

export interface WizardAnswer {
  stepId: string;
  value: any;
  timestamp: Date;
}

export interface WizardConfiguration {
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

export class ConfigurationWizard extends EventEmitter {
  private steps: WizardStep[] = [];
  private answers: Map<string, WizardAnswer> = new Map();
  private currentStepIndex = 0;
  private projectPath: string;
  private detectedConfig: any = null;

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.initializeSteps();
  }

  /**
   * Start the configuration wizard
   */
  public async start(): Promise<void> {
    // First, detect project characteristics
    try {
      this.detectedConfig = await ProjectDetector.detectProject(this.projectPath);
      this.updateStepsWithDetectedConfig();
    } catch (error) {
      console.warn('Could not detect project configuration:', error);
    }

    this.currentStepIndex = 0;
    this.emit('wizard-started', { totalSteps: this.getVisibleSteps().length });
  }

  /**
   * Get current step
   */
  public getCurrentStep(): WizardStep | null {
    const visibleSteps = this.getVisibleSteps();
    if (this.currentStepIndex >= visibleSteps.length) {
      return null;
    }
    return visibleSteps[this.currentStepIndex];
  }

  /**
   * Get all visible steps (considering conditions)
   */
  public getVisibleSteps(): WizardStep[] {
    const answers = this.getAnswersObject();
    return this.steps.filter(step => {
      if (step.condition) {
        return step.condition(answers);
      }
      return true;
    });
  }

  /**
   * Answer current step and advance
   */
  public answerCurrentStep(value: any): { valid: boolean; error?: string; nextStep?: WizardStep } {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return { valid: false, error: 'No current step' };
    }

    // Validate answer
    const validationError = this.validateAnswer(currentStep, value);
    if (validationError) {
      return { valid: false, error: validationError };
    }

    // Store answer
    this.answers.set(currentStep.id, {
      stepId: currentStep.id,
      value,
      timestamp: new Date()
    });

    this.emit('step-answered', { step: currentStep, value, answers: this.getAnswersObject() });

    // Advance to next step
    return this.advanceToNextStep();
  }

  /**
   * Go to previous step
   */
  public goToPreviousStep(): WizardStep | null {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      const currentStep = this.getCurrentStep();
      this.emit('step-changed', { step: currentStep, direction: 'previous' });
      return currentStep;
    }
    return null;
  }

  /**
   * Skip current step (if not required)
   */
  public skipCurrentStep(): { valid: boolean; error?: string; nextStep?: WizardStep } {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return { valid: false, error: 'No current step' };
    }

    if (currentStep.required) {
      return { valid: false, error: 'Cannot skip required step' };
    }

    this.emit('step-skipped', { step: currentStep });
    return this.advanceToNextStep();
  }

  /**
   * Get wizard progress
   */
  public getProgress(): { current: number; total: number; percentage: number } {
    const visibleSteps = this.getVisibleSteps();
    const total = visibleSteps.length;
    const current = Math.min(this.currentStepIndex + 1, total);
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return { current, total, percentage };
  }

  /**
   * Check if wizard is complete
   */
  public isComplete(): boolean {
    const visibleSteps = this.getVisibleSteps();
    const requiredSteps = visibleSteps.filter(step => step.required);
    
    return requiredSteps.every(step => this.answers.has(step.id));
  }

  /**
   * Generate final configuration
   */
  public generateConfiguration(): WizardConfiguration {
    const answers = this.getAnswersObject();
    
    const config: WizardConfiguration = {
      projectPath: this.projectPath,
      projectName: answers.projectName || this.detectedConfig?.metadata?.name || 'My Project',
      languages: answers.languages || this.detectedConfig?.languages || ['typescript'],
      frameworks: answers.frameworks || this.detectedConfig?.frameworks || [],
      includePatterns: answers.includePatterns || this.generateDefaultIncludePatterns(answers.languages),
      excludePatterns: answers.excludePatterns || this.generateDefaultExcludePatterns(),
      outputPath: answers.outputPath || 'docs',
      outputFormats: answers.outputFormats || ['web', 'markdown'],
      webServerPort: answers.webServerPort || 3000,
      enableRealTime: answers.enableRealTime !== false,
      enableGitIntegration: answers.enableGitIntegration !== false,
      enableApiDocs: answers.enableApiDocs !== false,
      enableDiagrams: answers.enableDiagrams !== false,
      cacheEnabled: answers.cacheEnabled !== false,
      customTemplates: answers.customTemplates || false,
      templatePath: answers.templatePath,
      steeringIntegration: answers.steeringIntegration !== false,
      hookIntegration: answers.hookIntegration !== false
    };

    return config;
  }

  /**
   * Save configuration to file
   */
  public async saveConfiguration(): Promise<string> {
    const config = this.generateConfiguration();
    
    // Convert to config manager format
    // TODO: Use configuration data for advanced config generation
    /*
    const configData = {
      projectName: config.projectName,
      languages: config.languages,
      includePatterns: config.includePatterns,
      excludePatterns: config.excludePatterns,
      outputPath: config.outputPath,
      outputFormats: config.outputFormats,
      webServerPort: config.webServerPort,
      features: {
        realTimeUpdates: config.enableRealTime,
        gitIntegration: config.enableGitIntegration,
        apiDocumentation: config.enableApiDocs,
        architectureDiagrams: config.enableDiagrams
      },
      performance: {
        cacheEnabled: config.cacheEnabled
      },
      templates: config.customTemplates ? {
        customPath: config.templatePath
      } : undefined,
      integrations: {
        steering: config.steeringIntegration,
        hooks: config.hookIntegration
      }
    };
    */

    await ConfigManager.generateConfigFile(this.projectPath, { 
      includeComments: true, 
      overwrite: true 
    });
    
    const configPath = `${this.projectPath}/living-docs.config.json`;
    this.emit('configuration-saved', { config, configPath });
    
    return configPath;
  }

  /**
   * Get answers as object
   */
  private getAnswersObject(): Record<string, any> {
    const answers: Record<string, any> = {};
    for (const [stepId, answer] of this.answers) {
      answers[stepId] = answer.value;
    }
    return answers;
  }

  /**
   * Validate answer for a step
   */
  private validateAnswer(step: WizardStep, value: any): string | null {
    // Check required
    if (step.required && (value === null || value === undefined || value === '')) {
      return 'This field is required';
    }

    // Custom validation
    if (step.validation) {
      return step.validation(value);
    }

    // Type-specific validation
    switch (step.type) {
      case 'select':
        if (step.options && !step.options.some(opt => opt.value === value)) {
          return 'Invalid selection';
        }
        break;
        
      case 'multiselect':
        if (!Array.isArray(value)) {
          return 'Must be an array';
        }
        if (step.options) {
          const validValues = step.options.map(opt => opt.value);
          if (!value.every(v => validValues.includes(v))) {
            return 'Invalid selection(s)';
          }
        }
        break;
        
      case 'path':
        if (typeof value !== 'string' || !value.trim()) {
          return 'Must be a valid path';
        }
        break;
    }

    return null;
  }

  /**
   * Advance to next step
   */
  private advanceToNextStep(): { valid: boolean; nextStep?: WizardStep } {
    const visibleSteps = this.getVisibleSteps();
    
    if (this.currentStepIndex < visibleSteps.length - 1) {
      this.currentStepIndex++;
      const nextStep = this.getCurrentStep();
      this.emit('step-changed', { step: nextStep, direction: 'next' });
      if (nextStep) {
        return { valid: true, nextStep };
      } else {
        return { valid: true };
      }
    } else {
      // Wizard complete
      this.emit('wizard-completed', { configuration: this.generateConfiguration() });
      return { valid: true };
    }
  }

  /**
   * Initialize wizard steps
   */
  private initializeSteps(): void {
    this.steps = [
      {
        id: 'projectName',
        title: 'Project Name',
        description: 'What would you like to call your project?',
        type: 'input',
        required: true,
        validation: (value: string) => {
          if (!value || value.trim().length < 2) {
            return 'Project name must be at least 2 characters';
          }
          return null;
        }
      },
      {
        id: 'languages',
        title: 'Programming Languages',
        description: 'Which programming languages does your project use?',
        type: 'multiselect',
        required: true,
        options: [
          { value: 'typescript', label: 'TypeScript', description: 'TypeScript files (.ts, .tsx)' },
          { value: 'javascript', label: 'JavaScript', description: 'JavaScript files (.js, .jsx)' },
          { value: 'python', label: 'Python', description: 'Python files (.py)' },
          { value: 'go', label: 'Go', description: 'Go files (.go)' }
        ]
      },
      {
        id: 'frameworks',
        title: 'Frameworks & Libraries',
        description: 'Which frameworks or libraries are you using? (Optional)',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'react', label: 'React', description: 'React components and hooks' },
          { value: 'express', label: 'Express.js', description: 'Express.js web framework' },
          { value: 'fastify', label: 'Fastify', description: 'Fastify web framework' },
          { value: 'flask', label: 'Flask', description: 'Flask web framework' },
          { value: 'django', label: 'Django', description: 'Django web framework' },
          { value: 'gin', label: 'Gin', description: 'Gin web framework for Go' }
        ]
      },
      {
        id: 'outputPath',
        title: 'Documentation Output Directory',
        description: 'Where should the generated documentation be saved?',
        type: 'path',
        required: true,
        defaultValue: 'docs'
      },
      {
        id: 'outputFormats',
        title: 'Output Formats',
        description: 'Which documentation formats would you like to generate?',
        type: 'multiselect',
        required: true,
        options: [
          { value: 'web', label: 'Web Interface', description: 'Interactive web documentation' },
          { value: 'markdown', label: 'Markdown Files', description: 'Static markdown documentation' },
          { value: 'openapi', label: 'OpenAPI Spec', description: 'API specification (if applicable)' }
        ],
        defaultValue: ['web', 'markdown']
      },
      {
        id: 'webServerPort',
        title: 'Web Server Port',
        description: 'Which port should the documentation web server use?',
        type: 'input',
        required: true,
        defaultValue: 3000,
        condition: (answers) => answers.outputFormats?.includes('web'),
        validation: (value: any) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1024 || port > 65535) {
            return 'Port must be a number between 1024 and 65535';
          }
          return null;
        }
      },
      {
        id: 'enableRealTime',
        title: 'Real-Time Updates',
        description: 'Enable real-time documentation updates when you modify code?',
        type: 'boolean',
        required: false,
        defaultValue: true
      },
      {
        id: 'enableGitIntegration',
        title: 'Git Integration',
        description: 'Include Git history and commit information in documentation?',
        type: 'boolean',
        required: false,
        defaultValue: true
      },
      {
        id: 'enableApiDocs',
        title: 'API Documentation',
        description: 'Automatically generate API documentation from your code?',
        type: 'boolean',
        required: false,
        defaultValue: true
      },
      {
        id: 'enableDiagrams',
        title: 'Architecture Diagrams',
        description: 'Generate architecture and dependency diagrams?',
        type: 'boolean',
        required: false,
        defaultValue: true
      },
      {
        id: 'customTemplates',
        title: 'Custom Templates',
        description: 'Do you want to use custom documentation templates?',
        type: 'boolean',
        required: false,
        defaultValue: false
      },
      {
        id: 'templatePath',
        title: 'Template Directory',
        description: 'Where are your custom templates located?',
        type: 'path',
        required: true,
        dependsOn: 'customTemplates',
        condition: (answers) => answers.customTemplates === true
      },
      {
        id: 'review',
        title: 'Review Configuration',
        description: 'Please review your configuration before saving.',
        type: 'review',
        required: false
      }
    ];
  }

  /**
   * Update steps with detected configuration
   */
  private updateStepsWithDetectedConfig(): void {
    if (!this.detectedConfig) return;

    // Update default values based on detection
    const projectNameStep = this.steps.find(s => s.id === 'projectName');
    if (projectNameStep && this.detectedConfig.metadata?.name) {
      projectNameStep.defaultValue = this.detectedConfig.metadata.name;
    }

    const languagesStep = this.steps.find(s => s.id === 'languages');
    if (languagesStep && this.detectedConfig.languages) {
      languagesStep.defaultValue = this.detectedConfig.languages;
    }

    const frameworksStep = this.steps.find(s => s.id === 'frameworks');
    if (frameworksStep && this.detectedConfig.frameworks) {
      frameworksStep.defaultValue = this.detectedConfig.frameworks;
    }

    const outputPathStep = this.steps.find(s => s.id === 'outputPath');
    if (outputPathStep && this.detectedConfig.suggestedConfig?.outputPath) {
      outputPathStep.defaultValue = this.detectedConfig.suggestedConfig.outputPath;
    }

    const portStep = this.steps.find(s => s.id === 'webServerPort');
    if (portStep && this.detectedConfig.suggestedConfig?.webServerPort) {
      portStep.defaultValue = this.detectedConfig.suggestedConfig.webServerPort;
    }
  }

  /**
   * Generate default include patterns based on languages
   */
  private generateDefaultIncludePatterns(languages: string[]): string[] {
    const patterns: string[] = [];
    
    if (languages.includes('typescript')) {
      patterns.push('**/*.ts', '**/*.tsx');
    }
    if (languages.includes('javascript')) {
      patterns.push('**/*.js', '**/*.jsx');
    }
    if (languages.includes('python')) {
      patterns.push('**/*.py');
    }
    if (languages.includes('go')) {
      patterns.push('**/*.go');
    }

    return patterns.length > 0 ? patterns : ['**/*.ts', '**/*.js'];
  }

  /**
   * Generate default exclude patterns
   */
  private generateDefaultExcludePatterns(): string[] {
    return [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '__pycache__/**',
      'vendor/**',
      '.git/**'
    ];
  }
}
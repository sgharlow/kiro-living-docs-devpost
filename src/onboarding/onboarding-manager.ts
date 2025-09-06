/**
 * User Onboarding Manager for Living Documentation Generator
 * 
 * Provides guided onboarding experience with helpful tips and examples
 * to help users get started quickly and effectively.
 */

import { EventEmitter } from 'events';
import { ProjectAnalysis } from '../types.js';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  example?: string;
  completed: boolean;
  optional: boolean;
}

export interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // minutes
}

export interface UserProfile {
  isFirstTime: boolean;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguages: string[];
  projectType: string;
  completedOnboarding: boolean;
  lastActiveDate: Date;
}

export class OnboardingManager extends EventEmitter {
  private userProfile: UserProfile;
  private onboardingSteps: OnboardingStep[] = [];
  private currentStepIndex = 0;
  private startTime: Date | null = null;

  constructor(userProfile?: Partial<UserProfile>) {
    super();
    
    this.userProfile = {
      isFirstTime: true,
      experienceLevel: 'beginner',
      preferredLanguages: [],
      projectType: 'unknown',
      completedOnboarding: false,
      lastActiveDate: new Date(),
      ...userProfile
    };

    this.initializeOnboardingSteps();
  }

  /**
   * Start the onboarding process
   */
  public startOnboarding(): OnboardingProgress {
    this.startTime = new Date();
    this.currentStepIndex = 0;
    
    // Mark all steps as not completed
    this.onboardingSteps.forEach(step => {
      step.completed = false;
    });

    this.emit('onboarding-started', { userProfile: this.userProfile });
    
    return this.getProgress();
  }

  /**
   * Get current onboarding progress
   */
  public getProgress(): OnboardingProgress {
    const completedSteps = this.onboardingSteps.filter(step => step.completed).length;
    const totalSteps = this.onboardingSteps.length;
    const percentComplete = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    // Estimate time remaining based on average step completion time
    const averageStepTime = 2; // minutes per step
    const remainingSteps = totalSteps - completedSteps;
    const estimatedTimeRemaining = remainingSteps * averageStepTime;

    return {
      currentStep: this.currentStepIndex,
      totalSteps,
      completedSteps,
      percentComplete,
      estimatedTimeRemaining
    };
  }

  /**
   * Get current onboarding step
   */
  public getCurrentStep(): OnboardingStep | null {
    if (this.currentStepIndex >= this.onboardingSteps.length) {
      return null;
    }
    return this.onboardingSteps[this.currentStepIndex];
  }

  /**
   * Get all onboarding steps
   */
  public getAllSteps(): OnboardingStep[] {
    return [...this.onboardingSteps];
  }

  /**
   * Mark current step as completed and advance
   */
  public completeCurrentStep(): OnboardingProgress {
    const currentStep = this.getCurrentStep();
    if (currentStep) {
      currentStep.completed = true;
      this.emit('step-completed', { step: currentStep, progress: this.getProgress() });
    }

    return this.advanceToNextStep();
  }

  /**
   * Mark a specific step as completed
   */
  public completeStep(stepId: string): boolean {
    const step = this.onboardingSteps.find(s => s.id === stepId);
    if (step) {
      step.completed = true;
      this.emit('step-completed', { step, progress: this.getProgress() });
      
      // Check if this completes the onboarding
      if (this.isOnboardingComplete()) {
        this.finishOnboarding();
      }
      
      return true;
    }
    return false;
  }

  /**
   * Skip current step (if optional)
   */
  public skipCurrentStep(): OnboardingProgress {
    const currentStep = this.getCurrentStep();
    if (currentStep && currentStep.optional) {
      this.emit('step-skipped', { step: currentStep });
      return this.advanceToNextStep();
    }
    
    throw new Error('Cannot skip required step');
  }

  /**
   * Go to previous step
   */
  public goToPreviousStep(): OnboardingProgress {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.emit('step-changed', { 
        step: this.getCurrentStep(), 
        direction: 'previous',
        progress: this.getProgress() 
      });
    }
    
    return this.getProgress();
  }

  /**
   * Go to specific step
   */
  public goToStep(stepId: string): OnboardingProgress {
    const stepIndex = this.onboardingSteps.findIndex(s => s.id === stepId);
    if (stepIndex >= 0) {
      this.currentStepIndex = stepIndex;
      this.emit('step-changed', { 
        step: this.getCurrentStep(), 
        direction: 'jump',
        progress: this.getProgress() 
      });
    }
    
    return this.getProgress();
  }

  /**
   * Check if onboarding is complete
   */
  public isOnboardingComplete(): boolean {
    const requiredSteps = this.onboardingSteps.filter(step => !step.optional);
    return requiredSteps.every(step => step.completed);
  }

  /**
   * Finish onboarding process
   */
  public finishOnboarding(): void {
    this.userProfile.completedOnboarding = true;
    this.userProfile.isFirstTime = false;
    
    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    this.emit('onboarding-completed', { 
      userProfile: this.userProfile,
      duration,
      progress: this.getProgress()
    });
  }

  /**
   * Update user profile based on project analysis
   */
  public updateProfileFromProject(analysis: ProjectAnalysis): void {
    // Update preferred languages
    this.userProfile.preferredLanguages = analysis.metadata.languages || [];
    
    // Detect project type
    if (analysis.metadata.languages.includes('typescript') || analysis.metadata.languages.includes('javascript')) {
      if (this.hasReactComponents(analysis)) {
        this.userProfile.projectType = 'react';
      } else if (this.hasExpressRoutes(analysis)) {
        this.userProfile.projectType = 'express';
      } else {
        this.userProfile.projectType = 'javascript';
      }
    } else if (analysis.metadata.languages.includes('python')) {
      this.userProfile.projectType = 'python';
    } else if (analysis.metadata.languages.includes('go')) {
      this.userProfile.projectType = 'go';
    }

    // Adjust onboarding steps based on project
    this.customizeOnboardingForProject();
    
    this.emit('profile-updated', { userProfile: this.userProfile });
  }

  /**
   * Get contextual tips based on current state
   */
  public getContextualTips(): string[] {
    const tips: string[] = [];
    const currentStep = this.getCurrentStep();
    
    if (!currentStep) {
      return ['Onboarding complete! Start exploring your documentation.'];
    }

    switch (currentStep.id) {
      case 'project-detection':
        tips.push('💡 The system automatically detects your project type and languages');
        tips.push('🔧 You can customize settings later in the configuration');
        break;
        
      case 'first-generation':
        tips.push('⚡ Documentation updates happen in real-time as you edit code');
        tips.push('🔍 Use Ctrl+K to quickly search through your documentation');
        break;
        
      case 'web-interface':
        tips.push('🌙 Toggle between light and dark themes using the theme button');
        tips.push('📱 The interface is fully responsive and works on mobile devices');
        break;
        
      case 'search-features':
        tips.push('🎯 Use filters to narrow down search results by type or language');
        tips.push('💾 Save frequently used searches for quick access');
        break;
    }

    // Add experience-level specific tips
    if (this.userProfile.experienceLevel === 'beginner') {
      tips.push('📚 Check out the demo guide for step-by-step examples');
    } else if (this.userProfile.experienceLevel === 'advanced') {
      tips.push('⚙️ Explore advanced configuration options for custom workflows');
    }

    return tips;
  }

  /**
   * Get quick start actions for the current step
   */
  public getQuickStartActions(): Array<{ label: string; action: string; description: string }> {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return [];

    const actions: Array<{ label: string; action: string; description: string }> = [];

    switch (currentStep.id) {
      case 'project-detection':
        actions.push({
          label: 'Detect Project',
          action: 'detect_project',
          description: 'Automatically detect your project type and configuration'
        });
        break;
        
      case 'first-generation':
        actions.push({
          label: 'Generate Documentation',
          action: 'generate_docs',
          description: 'Create your first documentation'
        });
        break;
        
      case 'web-interface':
        actions.push({
          label: 'Open Web Interface',
          action: 'open_web_ui',
          description: 'View your documentation in the browser'
        });
        break;
        
      case 'real-time-updates':
        actions.push({
          label: 'Start Watching',
          action: 'watch_project',
          description: 'Enable real-time documentation updates'
        });
        break;
    }

    return actions;
  }

  /**
   * Advance to next step
   */
  private advanceToNextStep(): OnboardingProgress {
    if (this.currentStepIndex < this.onboardingSteps.length - 1) {
      this.currentStepIndex++;
      this.emit('step-changed', { 
        step: this.getCurrentStep(), 
        direction: 'next',
        progress: this.getProgress() 
      });
    } else if (this.isOnboardingComplete()) {
      this.finishOnboarding();
    }
    
    return this.getProgress();
  }

  /**
   * Initialize default onboarding steps
   */
  private initializeOnboardingSteps(): void {
    this.onboardingSteps = [
      {
        id: 'welcome',
        title: 'Welcome to Living Documentation Generator',
        description: 'Let\'s get you started with automatic documentation generation that stays up-to-date with your code.',
        completed: false,
        optional: false
      },
      {
        id: 'project-detection',
        title: 'Detect Your Project',
        description: 'We\'ll automatically analyze your project structure and detect the programming languages and frameworks you\'re using.',
        action: 'detect_project',
        example: 'detect_project with projectPath: "/path/to/your/project"',
        completed: false,
        optional: false
      },
      {
        id: 'first-generation',
        title: 'Generate Your First Documentation',
        description: 'Create beautiful documentation from your existing code with zero configuration required.',
        action: 'generate_docs',
        example: 'generate_docs with projectPath: "/path/to/your/project"',
        completed: false,
        optional: false
      },
      {
        id: 'web-interface',
        title: 'Explore the Web Interface',
        description: 'View your documentation in a beautiful, searchable web interface with modern styling.',
        completed: false,
        optional: false
      },
      {
        id: 'real-time-updates',
        title: 'Enable Real-Time Updates',
        description: 'Start watching your project for changes to keep documentation automatically updated.',
        action: 'watch_project',
        example: 'watch_project with projectPath: "/path/to/your/project"',
        completed: false,
        optional: false
      },
      {
        id: 'search-features',
        title: 'Learn Search Features',
        description: 'Discover powerful search capabilities to quickly find functions, classes, and documentation.',
        completed: false,
        optional: true
      },
      {
        id: 'customization',
        title: 'Customize Your Setup',
        description: 'Learn about configuration options, themes, and advanced features.',
        completed: false,
        optional: true
      },
      {
        id: 'integration',
        title: 'Explore Kiro Integration',
        description: 'Discover how the documentation generator integrates with Kiro\'s steering files and hooks.',
        completed: false,
        optional: true
      }
    ];
  }

  /**
   * Customize onboarding steps based on detected project type
   */
  private customizeOnboardingForProject(): void {
    // Add language-specific steps
    if (this.userProfile.preferredLanguages.includes('typescript')) {
      this.addLanguageSpecificStep('typescript', 'TypeScript Features', 
        'Learn about TypeScript-specific documentation features like interface documentation and type analysis.');
    }
    
    if (this.userProfile.preferredLanguages.includes('python')) {
      this.addLanguageSpecificStep('python', 'Python Features',
        'Explore Python docstring parsing, type hint analysis, and class documentation.');
    }
    
    if (this.userProfile.preferredLanguages.includes('go')) {
      this.addLanguageSpecificStep('go', 'Go Features',
        'Discover Go package documentation, struct analysis, and interface documentation.');
    }

    // Add project-type specific steps
    if (this.userProfile.projectType === 'react') {
      this.addProjectSpecificStep('react-components', 'React Component Documentation',
        'See how React components, props, and hooks are automatically documented.');
    }
    
    if (this.userProfile.projectType === 'express') {
      this.addProjectSpecificStep('api-documentation', 'API Documentation',
        'Learn about automatic API endpoint detection and OpenAPI specification generation.');
    }
  }

  /**
   * Add language-specific onboarding step
   */
  private addLanguageSpecificStep(language: string, title: string, description: string): void {
    const step: OnboardingStep = {
      id: `language-${language}`,
      title,
      description,
      completed: false,
      optional: true
    };
    
    // Insert before customization step
    const customizationIndex = this.onboardingSteps.findIndex(s => s.id === 'customization');
    if (customizationIndex >= 0) {
      this.onboardingSteps.splice(customizationIndex, 0, step);
    } else {
      this.onboardingSteps.push(step);
    }
  }

  /**
   * Add project-type specific onboarding step
   */
  private addProjectSpecificStep(id: string, title: string, description: string): void {
    const step: OnboardingStep = {
      id,
      title,
      description,
      completed: false,
      optional: true
    };
    
    // Insert after search features
    const searchIndex = this.onboardingSteps.findIndex(s => s.id === 'search-features');
    if (searchIndex >= 0) {
      this.onboardingSteps.splice(searchIndex + 1, 0, step);
    } else {
      this.onboardingSteps.push(step);
    }
  }

  /**
   * Check if project has React components
   */
  private hasReactComponents(analysis: ProjectAnalysis): boolean {
    for (const [, fileAnalysis] of analysis.files) {
      for (const func of fileAnalysis.functions) {
        if (func.name.includes('Component') || func.returnType?.includes('JSX')) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if project has Express routes
   */
  private hasExpressRoutes(analysis: ProjectAnalysis): boolean {
    for (const [, fileAnalysis] of analysis.files) {
      if (fileAnalysis.apiEndpoints.length > 0) {
        return true;
      }
    }
    return false;
  }
}
/**
 * Tests for Onboarding Manager
 * 
 * Validates user onboarding flow, progress tracking, and contextual guidance
 */

import { OnboardingManager } from '../../src/onboarding/onboarding-manager';
import { ProjectAnalysis } from '../../src/types';

describe('OnboardingManager', () => {
  let onboardingManager: OnboardingManager;

  beforeEach(() => {
    onboardingManager = new OnboardingManager({
      experienceLevel: 'beginner',
      isFirstTime: true
    });
  });

  describe('Onboarding Flow', () => {
    test('should start onboarding with correct initial state', () => {
      const progress = onboardingManager.startOnboarding();
      
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBeGreaterThan(0);
      expect(progress.completedSteps).toBe(0);
      expect(progress.percentComplete).toBe(0);
    });

    test('should advance through steps correctly', () => {
      onboardingManager.startOnboarding();
      
      const initialStep = onboardingManager.getCurrentStep();
      expect(initialStep).toBeTruthy();
      expect(initialStep?.id).toBe('welcome');

      const progress = onboardingManager.completeCurrentStep();
      expect(progress.completedSteps).toBe(1);
      expect(progress.percentComplete).toBeGreaterThan(0);
    });

    test('should handle step completion by ID', () => {
      onboardingManager.startOnboarding();
      
      const success = onboardingManager.completeStep('project-detection');
      expect(success).toBe(true);
      
      const steps = onboardingManager.getAllSteps();
      const completedStep = steps.find(s => s.id === 'project-detection');
      expect(completedStep?.completed).toBe(true);
    });

    test('should allow skipping optional steps', () => {
      onboardingManager.startOnboarding();
      
      // Navigate to an optional step
      onboardingManager.goToStep('customization');
      
      const currentStep = onboardingManager.getCurrentStep();
      if (currentStep?.optional) {
        const progress = onboardingManager.skipCurrentStep();
        expect(progress.currentStep).toBeGreaterThan(0);
      }
    });

    test('should prevent skipping required steps', () => {
      onboardingManager.startOnboarding();
      
      // Try to skip a required step
      expect(() => onboardingManager.skipCurrentStep()).toThrow();
    });
  });

  describe('Progress Tracking', () => {
    test('should calculate progress correctly', () => {
      onboardingManager.startOnboarding();
      
      // Complete a few steps
      onboardingManager.completeStep('welcome');
      onboardingManager.completeStep('project-detection');
      
      const progress = onboardingManager.getProgress();
      expect(progress.completedSteps).toBe(2);
      expect(progress.percentComplete).toBeGreaterThan(0);
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    test('should detect onboarding completion', () => {
      onboardingManager.startOnboarding();
      
      // Complete all required steps
      const steps = onboardingManager.getAllSteps();
      const requiredSteps = steps.filter(s => !s.optional);
      
      requiredSteps.forEach(step => {
        onboardingManager.completeStep(step.id);
      });
      
      expect(onboardingManager.isOnboardingComplete()).toBe(true);
    });
  });

  describe('Project Customization', () => {
    test('should customize onboarding based on project type', () => {
      const mockAnalysis: ProjectAnalysis = {
        metadata: {
          name: 'Test Project',
          languages: ['typescript', 'python'],
          description: 'Test project'
        },
        structure: {
          directories: [],
          files: [],
          entryPoints: [],
          testFiles: [],
          configFiles: []
        },
        files: new Map(),
        lastUpdated: new Date()
      };

      onboardingManager.updateProfileFromProject(mockAnalysis);
      
      const steps = onboardingManager.getAllSteps();
      const languageSteps = steps.filter(s => s.id.startsWith('language-'));
      expect(languageSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Contextual Guidance', () => {
    test('should provide contextual tips', () => {
      onboardingManager.startOnboarding();
      
      const tips = onboardingManager.getContextualTips();
      expect(tips).toBeInstanceOf(Array);
      expect(tips.length).toBeGreaterThan(0);
    });

    test('should provide quick start actions', () => {
      onboardingManager.startOnboarding();
      
      const actions = onboardingManager.getQuickStartActions();
      expect(actions).toBeInstanceOf(Array);
      
      if (actions.length > 0) {
        expect(actions[0]).toHaveProperty('label');
        expect(actions[0]).toHaveProperty('action');
        expect(actions[0]).toHaveProperty('description');
      }
    });
  });

  describe('Navigation', () => {
    test('should navigate between steps', () => {
      onboardingManager.startOnboarding();
      
      // Go to next step
      onboardingManager.completeCurrentStep();
      const step2 = onboardingManager.getCurrentStep();
      
      // Go back
      const progress = onboardingManager.goToPreviousStep();
      const step1 = onboardingManager.getCurrentStep();
      
      expect(step1?.id).not.toBe(step2?.id);
    });

    test('should jump to specific steps', () => {
      onboardingManager.startOnboarding();
      
      const progress = onboardingManager.goToStep('search-features');
      const currentStep = onboardingManager.getCurrentStep();
      
      expect(currentStep?.id).toBe('search-features');
    });
  });
});
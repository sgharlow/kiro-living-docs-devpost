/**
 * Error types and handling for the Living Documentation Generator
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  FILE_ACCESS = 'file_access',
  PARSER = 'parser',
  TEMPLATE = 'template',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  RESOURCE = 'resource',
  VALIDATION = 'validation'
}

export interface ErrorContext {
  filePath?: string;
  lineNumber?: number;
  operation?: string;
  additionalInfo?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'partial' | 'manual';
  description: string;
  action?: () => Promise<any>;
}

export class DocumentationError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly recoveryActions: RecoveryAction[];
  public readonly timestamp: Date;
  public readonly userMessage: string;

  constructor(
    message: string,
    userMessage: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context: ErrorContext = {},
    recoveryActions: RecoveryAction[] = []
  ) {
    super(message);
    this.name = 'DocumentationError';
    this.userMessage = userMessage;
    this.severity = severity;
    this.category = category;
    this.context = context;
    this.recoveryActions = recoveryActions;
    this.timestamp = new Date();
  }

  /**
   * Get a user-friendly error message with actionable guidance
   */
  public getUserFriendlyMessage(): string {
    let message = this.userMessage;
    
    if (this.context.filePath) {
      message += ` (File: ${this.context.filePath}`;
      if (this.context.lineNumber) {
        message += `:${this.context.lineNumber}`;
      }
      message += ')';
    }

    if (this.recoveryActions.length > 0) {
      message += '\n\nSuggested actions:';
      this.recoveryActions.forEach((action, index) => {
        message += `\n${index + 1}. ${action.description}`;
      });
    }

    return message;
  }

  /**
   * Check if this error should block the entire operation
   */
  public isBlocking(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Check if this error allows for partial results
   */
  public allowsPartialResults(): boolean {
    return this.severity !== ErrorSeverity.CRITICAL;
  }
}

/**
 * Specific error types for common scenarios
 */

export class FileAccessError extends DocumentationError {
  constructor(filePath: string, originalError: Error, recoveryActions: RecoveryAction[] = []) {
    const defaultActions: RecoveryAction[] = [
      {
        type: 'retry',
        description: 'Check file permissions and try again'
      },
      {
        type: 'skip',
        description: 'Skip this file and continue with others'
      }
    ];

    super(
      `Failed to access file: ${originalError.message}`,
      `Cannot read file "${filePath}". Please check if the file exists and you have permission to read it.`,
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILE_ACCESS,
      { filePath, operation: 'file_read' },
      [...defaultActions, ...recoveryActions]
    );
  }
}

export class ParserError extends DocumentationError {
  constructor(
    filePath: string, 
    parserType: string, 
    originalError: Error, 
    recoveryActions: RecoveryAction[] = []
  ) {
    const defaultActions: RecoveryAction[] = [
      {
        type: 'fallback',
        description: `Try alternative parser for ${parserType} files`
      },
      {
        type: 'partial',
        description: 'Extract what information is available from the file'
      },
      {
        type: 'skip',
        description: 'Skip this file and continue with documentation generation'
      }
    ];

    super(
      `Parser failed for ${parserType}: ${originalError.message}`,
      `Failed to parse "${filePath}" as ${parserType}. The file may contain syntax errors or use unsupported language features.`,
      ErrorSeverity.MEDIUM,
      ErrorCategory.PARSER,
      { filePath, operation: 'parse', additionalInfo: { parserType } },
      [...defaultActions, ...recoveryActions]
    );
  }
}

export class TemplateError extends DocumentationError {
  constructor(templateName: string, originalError: Error, recoveryActions: RecoveryAction[] = []) {
    const defaultActions: RecoveryAction[] = [
      {
        type: 'fallback',
        description: 'Use default template instead'
      },
      {
        type: 'partial',
        description: 'Generate documentation with basic formatting'
      }
    ];

    super(
      `Template error in ${templateName}: ${originalError.message}`,
      `Documentation template "${templateName}" failed to render. Using fallback template instead.`,
      ErrorSeverity.LOW,
      ErrorCategory.TEMPLATE,
      { operation: 'template_render', additionalInfo: { templateName } },
      [...defaultActions, ...recoveryActions]
    );
  }
}

export class ResourceConstraintError extends DocumentationError {
  constructor(resourceType: string, limit: string, recoveryActions: RecoveryAction[] = []) {
    const defaultActions: RecoveryAction[] = [
      {
        type: 'partial',
        description: 'Process only critical files to stay within resource limits'
      },
      {
        type: 'retry',
        description: 'Wait for resources to become available and retry'
      }
    ];

    super(
      `Resource constraint: ${resourceType} limit ${limit} exceeded`,
      `System resources are constrained (${resourceType}: ${limit}). Processing will continue with reduced functionality.`,
      ErrorSeverity.MEDIUM,
      ErrorCategory.RESOURCE,
      { operation: 'resource_check', additionalInfo: { resourceType, limit } },
      [...defaultActions, ...recoveryActions]
    );
  }
}

export class ConfigurationError extends DocumentationError {
  constructor(configKey: string, issue: string, recoveryActions: RecoveryAction[] = []) {
    const defaultActions: RecoveryAction[] = [
      {
        type: 'fallback',
        description: 'Use default configuration values'
      },
      {
        type: 'manual',
        description: `Check and fix the configuration for "${configKey}"`
      }
    ];

    super(
      `Configuration error: ${configKey} - ${issue}`,
      `Configuration issue with "${configKey}": ${issue}. Using default values instead.`,
      ErrorSeverity.LOW,
      ErrorCategory.CONFIGURATION,
      { operation: 'config_load', additionalInfo: { configKey, issue } },
      [...defaultActions, ...recoveryActions]
    );
  }
}

/**
 * Error aggregation for batch operations
 */
export class ErrorCollection {
  private errors: DocumentationError[] = [];

  public add(error: DocumentationError): void {
    this.errors.push(error);
  }

  public addAll(errors: DocumentationError[]): void {
    this.errors.push(...errors);
  }

  public getErrors(): DocumentationError[] {
    return [...this.errors];
  }

  public getErrorsByCategory(category: ErrorCategory): DocumentationError[] {
    return this.errors.filter(error => error.category === category);
  }

  public getErrorsBySeverity(severity: ErrorSeverity): DocumentationError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  public hasBlockingErrors(): boolean {
    return this.errors.some(error => error.isBlocking());
  }

  public hasCriticalErrors(): boolean {
    return this.errors.some(error => error.severity === ErrorSeverity.CRITICAL);
  }

  public getHighestSeverity(): ErrorSeverity | null {
    if (this.errors.length === 0) return null;

    const severityOrder = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];
    return this.errors.reduce((highest: ErrorSeverity, error: DocumentationError) => {
      const currentIndex = severityOrder.indexOf(error.severity);
      const highestIndex = severityOrder.indexOf(highest);
      return currentIndex > highestIndex ? error.severity : highest;
    }, ErrorSeverity.LOW);
  }

  public getSummary(): string {
    if (this.errors.length === 0) return 'No errors';

    const summary = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    this.errors.forEach(error => {
      summary[error.severity]++;
    });

    const parts: string[] = [];
    if (summary[ErrorSeverity.CRITICAL] > 0) parts.push(`${summary[ErrorSeverity.CRITICAL]} critical`);
    if (summary[ErrorSeverity.HIGH] > 0) parts.push(`${summary[ErrorSeverity.HIGH]} high`);
    if (summary[ErrorSeverity.MEDIUM] > 0) parts.push(`${summary[ErrorSeverity.MEDIUM]} medium`);
    if (summary[ErrorSeverity.LOW] > 0) parts.push(`${summary[ErrorSeverity.LOW]} low`);

    return `${this.errors.length} errors: ${parts.join(', ')}`;
  }

  public clear(): void {
    this.errors = [];
  }

  public isEmpty(): boolean {
    return this.errors.length === 0;
  }
}
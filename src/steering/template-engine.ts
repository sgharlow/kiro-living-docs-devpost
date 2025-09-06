import { SteeringConfig } from './steering-parser';
import { AnalysisResult, ProjectAnalysis } from '../types';

export interface TemplateContext {
  analysis: AnalysisResult | ProjectAnalysis;
  config: SteeringConfig;
  fileName?: string;
  projectName?: string;
  timestamp?: Date;
  [key: string]: any;
}

/**
 * Template engine that processes documentation templates with steering configuration
 */
export class TemplateEngine {
  private config: SteeringConfig;

  constructor(config: SteeringConfig) {
    this.config = config;
  }

  /**
   * Process a template with the given context
   */
  public processTemplate(template: string, context: TemplateContext): string {
    let result = template;

    // Apply conditional blocks first
    result = this.processConditionals(result, context);

    // Apply loops
    result = this.processLoops(result, context);

    // Apply template variables
    if (this.config.templates?.templateVariables) {
      Object.entries(this.config.templates.templateVariables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), String(value));
      });
    }

    // Apply context variables
    result = this.processContextVariables(result, context);

    // Apply terminology replacements last
    if (this.config.terminology?.replacements) {
      Object.entries(this.config.terminology.replacements).forEach(([oldTerm, newTerm]) => {
        const regex = new RegExp(`\\b${oldTerm}\\b`, 'gi');
        result = result.replace(regex, newTerm);
      });
    }

    return result;
  }

  /**
   * Process context variables in template
   */
  private processContextVariables(template: string, context: TemplateContext): string {
    let result = template;

    // Replace simple variables: {{variable}}
    const variablePattern = /\{\{([^}]+)\}\}/g;
    result = result.replace(variablePattern, (match, variablePath) => {
      const value = this.getNestedValue(context, variablePath.trim());
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

  /**
   * Process conditional blocks: {{#if condition}}...{{/if}}
   */
  private processConditionals(template: string, context: TemplateContext): string {
    let result = template;

    // Process if-else blocks first (more specific pattern)
    const ifElsePattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifElsePattern, (_, condition, ifContent, elseContent) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? ifContent : elseContent;
    });

    // Process simple if blocks
    const ifPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifPattern, (_, condition, content) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? content : '';
    });

    return result;
  }

  /**
   * Process loop blocks: {{#each array}}...{{/each}}
   */
  private processLoops(template: string, context: TemplateContext): string {
    let result = template;

    const eachPattern = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachPattern, (_, arrayPath, content) => {
      const array = this.getNestedValue(context, arrayPath.trim());
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        const itemContext = {
          ...context,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1,
        };
        
        // Process the content with item context
        let itemResult = content;
        
        // Replace item properties
        Object.keys(item).forEach(key => {
          const placeholder = `{{${key}}}`;
          itemResult = itemResult.replace(new RegExp(placeholder, 'g'), String(item[key]));
        });
        
        // Replace loop variables
        itemResult = itemResult.replace(/\{\{@index\}\}/g, String(index));
        itemResult = itemResult.replace(/\{\{@first\}\}/g, String(index === 0));
        itemResult = itemResult.replace(/\{\{@last\}\}/g, String(index === array.length - 1));
        
        // Process conditionals in the item context
        itemResult = this.processConditionals(itemResult, itemContext);
        
        return itemResult;
      }).join('');
    });

    return result;
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    // Handle simple existence checks
    if (!condition.includes(' ')) {
      const value = this.getNestedValue(context, condition);
      return this.isTruthy(value);
    }

    // Handle comparison operators
    const comparisonPattern = /^(.+?)\s*(===|!==|==|!=|>|<|>=|<=)\s*(.+?)$/;
    const match = condition.match(comparisonPattern);
    
    if (match) {
      const [, left, operator, right] = match;
      const leftValue = this.getNestedValue(context, left.trim());
      const rightValue = this.parseValue(right.trim(), context);

      switch (operator) {
        case '===': return leftValue === rightValue;
        case '!==': return leftValue !== rightValue;
        case '==': return leftValue === rightValue;
        case '!=': return leftValue !== rightValue;
        case '>': return Number(leftValue) > Number(rightValue);
        case '<': return Number(leftValue) < Number(rightValue);
        case '>=': return Number(leftValue) >= Number(rightValue);
        case '<=': return Number(leftValue) <= Number(rightValue);
        default: return false;
      }
    }

    // Handle logical operators
    if (condition.includes(' && ')) {
      return condition.split(' && ').every(cond => this.evaluateCondition(cond.trim(), context));
    }
    if (condition.includes(' || ')) {
      return condition.split(' || ').some(cond => this.evaluateCondition(cond.trim(), context));
    }

    return false;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Parse a value (string, number, boolean, or variable reference)
   */
  private parseValue(value: string, context: TemplateContext): any {
    // String literal
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Number literal
    if (/^\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }

    // Boolean literal
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    // Variable reference
    return this.getNestedValue(context, value);
  }

  /**
   * Check if a value is truthy
   */
  private isTruthy(value: any): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  }

  /**
   * Apply style configuration to markdown content
   */
  public applyStyleConfig(markdown: string): string {
    if (!this.config.style) {
      return markdown;
    }

    let result = markdown;
    const style = this.config.style;

    // Apply heading style
    if (style.headingStyle === 'setext') {
      // Convert ATX headers to Setext (only for h1 and h2)
      result = result.replace(/^# (.+)$/gm, '$1\n='.repeat(50));
      result = result.replace(/^## (.+)$/gm, '$1\n-'.repeat(30));
    }

    // Apply list style
    if (style.listStyle) {
      const listChar = style.listStyle === 'dash' ? '-' : 
                      style.listStyle === 'asterisk' ? '*' : '+';
      result = result.replace(/^(\s*)[-*+] /gm, `$1${listChar} `);
    }

    // Apply code block style
    if (style.codeBlockStyle === 'indented') {
      // Convert fenced code blocks to indented
      result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _lang, code) => {
        return code.split('\n').map((line: string) => `    ${line}`).join('\n');
      });
    }

    // Apply line length limits
    if (style.maxLineLength) {
      result = this.wrapLines(result, style.maxLineLength);
    }

    return result;
  }

  /**
   * Wrap lines to specified length
   */
  private wrapLines(text: string, maxLength: number): string {
    return text.split('\n').map(line => {
      if (line.length <= maxLength) {
        return line;
      }

      // Don't wrap code blocks or headers
      if (line.startsWith('    ') || line.startsWith('#') || line.startsWith('```')) {
        return line;
      }

      // Simple word wrapping
      const words = line.split(' ');
      const wrappedLines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxLength) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) {
            wrappedLines.push(currentLine);
          }
          currentLine = word;
        }
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }

      return wrappedLines.join('\n');
    }).join('\n');
  }

  /**
   * Generate header content from template
   */
  public generateHeader(context: TemplateContext): string {
    if (!this.config.templates?.headerTemplate) {
      return '';
    }

    return this.processTemplate(this.config.templates.headerTemplate, context);
  }

  /**
   * Generate footer content from template
   */
  public generateFooter(context: TemplateContext): string {
    if (!this.config.templates?.footerTemplate) {
      return '';
    }

    return this.processTemplate(this.config.templates.footerTemplate, context);
  }
}
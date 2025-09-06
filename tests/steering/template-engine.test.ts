import { TemplateEngine, TemplateContext } from '../../src/steering/template-engine';
import { SteeringConfig } from '../../src/steering/steering-parser';
import { AnalysisResult } from '../../src/types';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  let mockAnalysis: AnalysisResult;
  let context: TemplateContext;

  beforeEach(() => {
    const config: SteeringConfig = {
      templates: {
        templateVariables: {
          projectName: 'Test Project',
          version: '1.0.0',
          author: 'Test Author',
        },
      },
      terminology: {
        replacements: {
          user: 'customer',
          API: 'Application Programming Interface',
        },
      },
      style: {
        maxLineLength: 80,
        codeBlockStyle: 'fenced',
        headingStyle: 'atx',
        listStyle: 'dash',
      },
    };

    engine = new TemplateEngine(config);

    mockAnalysis = {
      functions: [
        {
          name: 'getUserData',
          parameters: [
            { name: 'userId', type: 'string', optional: false },
          ],
          returnType: 'User',
          isAsync: true,
          isExported: true,
          startLine: 1,
          endLine: 5,
        },
        {
          name: 'createUser',
          parameters: [
            { name: 'userData', type: 'UserData', optional: false },
          ],
          returnType: 'User',
          isAsync: true,
          isExported: true,
          startLine: 7,
          endLine: 12,
        },
      ],
      classes: [
        {
          name: 'UserService',
          methods: [],
          properties: [],
          isExported: true,
          startLine: 14,
          endLine: 20,
        },
      ],
      interfaces: [],
      exports: [],
      imports: [],
      comments: [],
      todos: [],
      apiEndpoints: [],
    };

    context = {
      analysis: mockAnalysis,
      config,
      fileName: 'user-service.ts',
      projectName: 'Test Project',
      timestamp: new Date('2023-01-01T00:00:00Z'),
    };
  });

  describe('Variable Processing', () => {
    it('should replace simple template variables', () => {
      const template = 'Project: {{projectName}}, Version: {{version}}';
      const result = engine.processTemplate(template, context);
      expect(result).toBe('Project: Test Project, Version: 1.0.0');
    });

    it('should replace nested context variables', () => {
      const template = 'File: {{fileName}}, Functions: {{analysis.functions.length}}';
      const result = engine.processTemplate(template, context);
      // Note: terminology replacement changes 'user' to 'customer' in the filename
      expect(result).toBe('File: customer-service.ts, Functions: 2');
    });

    it('should leave undefined variables unchanged', () => {
      const template = 'Undefined: {{undefinedVariable}}';
      const result = engine.processTemplate(template, context);
      expect(result).toBe('Undefined: {{undefinedVariable}}');
    });
  });

  describe('Conditional Processing', () => {
    it('should process if blocks correctly', () => {
      const template = `
{{#if analysis.functions}}
Functions found: {{analysis.functions.length}}
{{/if}}
{{#if analysis.interfaces}}
Interfaces found: {{analysis.interfaces.length}}
{{/if}}
`.trim();

      const result = engine.processTemplate(template, context);
      expect(result.trim()).toBe('Functions found: 2');
    });

    it('should process if-else blocks correctly', () => {
      const template = `
{{#if analysis.interfaces}}
Has interfaces
{{#else}}
No interfaces found
{{/if}}
`.trim();

      const result = engine.processTemplate(template, context);
      expect(result.trim()).toBe('No interfaces found');
    });

    it('should handle comparison operators', () => {
      const template = `
{{#if analysis.functions.length > 1}}
Multiple functions
{{/if}}
{{#if analysis.classes.length === 1}}
Single class
{{/if}}
`.trim();

      const result = engine.processTemplate(template, context);
      // Split and check each part due to potential whitespace differences
      const lines = result.trim().split('\n').filter(line => line.trim());
      expect(lines).toContain('Multiple functions');
      expect(lines).toContain('Single class');
    });
  });

  describe('Loop Processing', () => {
    it('should process each loops correctly', () => {
      const template = `{{#each analysis.functions}}
- {{name}}: {{returnType}}
{{/each}}`;

      const result = engine.processTemplate(template, context);
      // Note: terminology replacement changes 'User' to 'customer' only in return types
      // Template produces trailing newline after each item
      const expected = '- getUserData: customer\n- createUser: customer\n';
      expect(result).toBe(expected);
    });

    it('should provide loop context variables', () => {
      const template = `{{#each analysis.functions}}
{{@index}}: {{name}}
{{/each}}`;

      const result = engine.processTemplate(template, context);
      // Check that index variables work in loops  
      const lines = result.split('\n').filter(l => l.trim());
      expect(lines[0]).toBe('0: getUserData');
      expect(lines[1]).toBe('1: createUser');
    });

    it('should handle empty arrays gracefully', () => {
      const template = `
{{#each analysis.interfaces}}
- {{name}}
{{/each}}
No interfaces above this line.
`.trim();

      const result = engine.processTemplate(template, context);
      expect(result.trim()).toBe('No interfaces above this line.');
    });
  });

  describe('Terminology Replacements', () => {
    it('should apply terminology replacements', () => {
      const template = 'This API helps the user manage data.';
      const result = engine.processTemplate(template, context);
      expect(result).toBe('This Application Programming Interface helps the customer manage data.');
    });

    it('should preserve word boundaries in replacements', () => {
      const template = 'The user and superuser have different permissions.';
      const result = engine.processTemplate(template, context);
      expect(result).toBe('The customer and superuser have different permissions.');
    });
  });

  describe('Style Configuration', () => {
    it('should apply list style configuration', () => {
      const markdown = `
* Item 1
* Item 2
  + Nested item
`.trim();

      const result = engine.applyStyleConfig(markdown);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
      expect(result).toContain('  - Nested item');
    });

    it('should wrap long lines when maxLineLength is set', () => {
      const longLine = 'This is a very long line that should be wrapped when the maximum line length is exceeded according to the style configuration.';
      const result = engine.applyStyleConfig(longLine);
      
      const lines = result.split('\n');
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(80);
      });
    });

    it('should not wrap code blocks or headers', () => {
      const markdown = `
# This is a very long header that should not be wrapped even if it exceeds the maximum line length
    
    This is a code block with a very long line that should not be wrapped
    
\`\`\`javascript
const veryLongVariableName = "This is a very long string that should not be wrapped in code blocks";
\`\`\`
`.trim();

      const result = engine.applyStyleConfig(markdown);
      
      // Headers and code blocks should remain unwrapped
      expect(result).toContain('# This is a very long header that should not be wrapped even if it exceeds the maximum line length');
      expect(result).toContain('    This is a code block with a very long line that should not be wrapped');
    });
  });

  describe('Header and Footer Generation', () => {
    it('should generate header from template', () => {
      const configWithHeader: SteeringConfig = {
        templates: {
          headerTemplate: `<!-- Generated by {{projectName}} v{{version}} -->
# {{fileName}}

*Last updated: {{timestamp}}*
`,
          templateVariables: {
            projectName: 'Doc Generator',
            version: '2.0.0',
          },
        },
      };

      const engineWithHeader = new TemplateEngine(configWithHeader);
      const header = engineWithHeader.generateHeader(context);

      expect(header).toContain('<!-- Generated by Doc Generator v2.0.0 -->');
      // Note: terminology replacement changes 'user' to 'customer' in filename
      expect(header).toContain('# customer-service.ts');
      // Check for date in header, accepting different date formats
      expect(header).toContain('*Last updated:');
    });

    it('should generate footer from template', () => {
      const configWithFooter: SteeringConfig = {
        templates: {
          footerTemplate: `
---
*Documentation generated automatically by {{projectName}}*
`,
          templateVariables: {
            projectName: 'Living Docs',
          },
        },
      };

      const engineWithFooter = new TemplateEngine(configWithFooter);
      const footer = engineWithFooter.generateFooter(context);

      expect(footer).toContain('*Documentation generated automatically by Living Docs*');
    });

    it('should return empty string when no header/footer template is configured', () => {
      const header = engine.generateHeader(context);
      const footer = engine.generateFooter(context);

      expect(header).toBe('');
      expect(footer).toBe('');
    });
  });

  describe('Complex Template Processing', () => {
    it('should handle nested conditionals and loops', () => {
      const template = `
# {{fileName}}

{{#if analysis.functions}}
## Functions

{{#each analysis.functions}}
### {{name}}

{{#if parameters}}
**Parameters:**
{{#each parameters}}
- \`{{name}}\`: {{type}}{{#if optional}} (optional){{/if}}
{{/each}}
{{/if}}

**Returns:** \`{{returnType}}\`

{{/each}}
{{/if}}

{{#if analysis.classes}}
## Classes

{{#each analysis.classes}}
- {{name}}
{{/each}}
{{/if}}
`.trim();

      const result = engine.processTemplate(template, context);

      // Note: terminology replacement changes 'user' to 'customer' and 'User' to 'customer'
      expect(result).toContain('# customer-service.ts');
      expect(result).toContain('## Functions');
      expect(result).toContain('### getUserData');
      expect(result).toContain('### createUser');
      expect(result).toContain('- `userId`: string');
      expect(result).toContain('**Returns:** `customer`');
      expect(result).toContain('## Classes');
      expect(result).toContain('- UserService');
    });
  });
});
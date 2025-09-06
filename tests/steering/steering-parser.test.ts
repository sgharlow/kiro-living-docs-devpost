import { SteeringParser, SteeringConfig } from '../../src/steering/steering-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SteeringParser', () => {
  let tempDir: string;
  let steeringDir: string;
  let parser: SteeringParser;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-test-'));
    steeringDir = path.join(tempDir, '.kiro', 'steering');
    fs.mkdirSync(steeringDir, { recursive: true });
    parser = new SteeringParser(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Loading', () => {
    it('should load basic YAML steering configuration', async () => {
      const configContent = `
documentation:
  style: google
  includePrivate: false
  generateDiagrams: true
terminology:
  replacements:
    user: customer
    admin: administrator
style:
  codeBlockStyle: fenced
  maxLineLength: 80
`;

      fs.writeFileSync(path.join(steeringDir, 'config.yaml'), configContent);

      const config = await parser.loadSteeringConfig();

      expect(config.documentation?.style).toBe('google');
      expect(config.documentation?.includePrivate).toBe(false);
      expect(config.documentation?.generateDiagrams).toBe(true);
      expect(config.terminology?.replacements?.user).toBe('customer');
      expect(config.terminology?.replacements?.admin).toBe('administrator');
      expect(config.style?.codeBlockStyle).toBe('fenced');
      expect(config.style?.maxLineLength).toBe(80);
    });

    it('should load markdown steering file with front matter', async () => {
      const markdownContent = `---
documentation:
  style: numpy
  outputFormats:
    - markdown
    - html
templates:
  customTemplates:
    api: "templates/api.md"
    readme: "templates/readme.md"
  templateVariables:
    projectName: "My Project"
    version: "1.0.0"
---

# Documentation Guidelines

This file contains our team's documentation standards.
`;

      fs.writeFileSync(path.join(steeringDir, 'guidelines.md'), markdownContent);

      const config = await parser.loadSteeringConfig();

      expect(config.documentation?.style).toBe('numpy');
      expect(config.documentation?.outputFormats).toEqual(['markdown', 'html']);
      expect(config.templates?.customTemplates?.api).toBe('templates/api.md');
      expect(config.templates?.templateVariables?.projectName).toBe('My Project');
    });

    it('should merge multiple steering files', async () => {
      const yamlConfig = `
documentation:
  style: google
  includePrivate: false
terminology:
  replacements:
    user: customer
`;

      const markdownConfig = `---
documentation:
  generateDiagrams: true
terminology:
  replacements:
    admin: administrator
style:
  maxLineLength: 100
---

# Additional Guidelines
`;

      fs.writeFileSync(path.join(steeringDir, 'base.yaml'), yamlConfig);
      fs.writeFileSync(path.join(steeringDir, 'additional.md'), markdownConfig);

      const config = await parser.loadSteeringConfig();

      expect(config.documentation?.style).toBe('google');
      expect(config.documentation?.includePrivate).toBe(false);
      expect(config.documentation?.generateDiagrams).toBe(true);
      expect(config.terminology?.replacements?.user).toBe('customer');
      expect(config.terminology?.replacements?.admin).toBe('administrator');
      expect(config.style?.maxLineLength).toBe(100);
    });

    it('should handle empty steering directory', async () => {
      const config = await parser.loadSteeringConfig();
      expect(config).toEqual({});
    });

    it('should handle non-existent steering directory', async () => {
      fs.rmSync(steeringDir, { recursive: true, force: true });
      const config = await parser.loadSteeringConfig();
      expect(config).toEqual({});
    });
  });

  describe('File-Specific Configuration', () => {
    it('should apply file-specific configuration based on patterns', async () => {
      const globalConfig = `
documentation:
  style: google
  includePrivate: false
`;

      const fileSpecificConfig = `---
inclusion: fileMatch
fileMatchPattern: "README.*"
documentation:
  includePrivate: true
  autoGenerateReadme: true
---

# README-specific configuration
`;

      fs.writeFileSync(path.join(steeringDir, 'global.yaml'), globalConfig);
      fs.writeFileSync(path.join(steeringDir, 'readme-config.md'), fileSpecificConfig);

      const globalSteeringConfig = await parser.loadSteeringConfig();
      const readmeConfig = await parser.getFileSpecificConfig('README.md', globalSteeringConfig);

      expect(readmeConfig.documentation?.style).toBe('google');
      expect(readmeConfig.documentation?.includePrivate).toBe(true);
      expect(readmeConfig.documentation?.autoGenerateReadme).toBe(true);
    });

    it('should not apply file-specific config for non-matching files', async () => {
      const fileSpecificConfig = `---
inclusion: fileMatch
fileMatchPattern: "test.*"
documentation:
  includePrivate: true
---

# Test-specific configuration
`;

      fs.writeFileSync(path.join(steeringDir, 'test-config.md'), fileSpecificConfig);

      const globalConfig = await parser.loadSteeringConfig();
      const regularFileConfig = await parser.getFileSpecificConfig('src/index.ts', globalConfig);

      expect(regularFileConfig.documentation?.includePrivate).toBeUndefined();
    });
  });

  describe('Terminology Replacements', () => {
    it('should apply terminology replacements correctly', async () => {
      const config: SteeringConfig = {
        terminology: {
          replacements: {
            user: 'customer',
            admin: 'administrator',
            API: 'Application Programming Interface',
          },
        },
      };

      const originalText = 'The user can access the API through the admin panel.';
      const result = parser.applyTerminologyReplacements(originalText, config);

      expect(result).toBe('The customer can access the Application Programming Interface through the administrator panel.');
    });

    it('should preserve word boundaries in replacements', async () => {
      const config: SteeringConfig = {
        terminology: {
          replacements: {
            user: 'customer',
          },
        },
      };

      const originalText = 'The user and superuser have different permissions.';
      const result = parser.applyTerminologyReplacements(originalText, config);

      expect(result).toBe('The customer and superuser have different permissions.');
    });
  });

  describe('Custom Template Loading', () => {
    it('should load custom template content', async () => {
      const templateContent = `# {{projectName}}

Generated on {{timestamp}}

{{#if analysis.functions}}
## Functions
{{#each analysis.functions}}
- {{name}}: {{description}}
{{/each}}
{{/if}}
`;

      const templatesDir = path.join(tempDir, 'templates');
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.writeFileSync(path.join(templatesDir, 'custom.md'), templateContent);

      const config: SteeringConfig = {
        templates: {
          customTemplates: {
            custom: 'templates/custom.md',
          },
        },
      };

      const result = parser.loadCustomTemplate('custom', config);
      expect(result).toBe(templateContent);
    });

    it('should return null for non-existent templates', async () => {
      const config: SteeringConfig = {
        templates: {
          customTemplates: {
            nonexistent: 'templates/nonexistent.md',
          },
        },
      };

      const result = parser.loadCustomTemplate('nonexistent', config);
      expect(result).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should validate configuration and warn about invalid values', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidConfig = `
documentation:
  style: invalid-style
  outputFormats:
    - markdown
    - invalid-format
style:
  codeBlockStyle: invalid-block-style
  maxLineLength: 300
`;

      fs.writeFileSync(path.join(steeringDir, 'invalid.yaml'), invalidConfig);

      await parser.loadSteeringConfig();

      expect(consoleSpy).toHaveBeenCalledWith('Invalid documentation style: invalid-style');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid output format: invalid-format');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid code block style: invalid-block-style');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid max line length: 300 (should be 40-200)');

      consoleSpy.mockRestore();
    });
  });

  describe('File References', () => {
    it('should process file references in steering content', async () => {
      const referencedConfig = `
terminology:
  replacements:
    service: microservice
`;

      const mainConfig = `---
documentation:
  style: google
---

# Main Configuration

This configuration references external files.

#[[file:referenced-config.yaml]]
`;

      fs.writeFileSync(path.join(steeringDir, 'referenced-config.yaml'), referencedConfig);
      fs.writeFileSync(path.join(steeringDir, 'main.md'), mainConfig);

      const config = await parser.loadSteeringConfig();

      expect(config.documentation?.style).toBe('google');
      expect(config.terminology?.replacements?.service).toBe('microservice');
    });
  });
});
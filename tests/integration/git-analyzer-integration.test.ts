import { GitAnalyzer } from '../../src/analyzers/git-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { simpleGit } from 'simple-git';

describe('GitAnalyzer Integration Tests', () => {
  let tempDir: string;
  let gitAnalyzer: GitAnalyzer;
  let git: any;

  beforeAll(async () => {
    // Create temporary directory for integration testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-integration-test-'));
    git = simpleGit(tempDir);
    
    // Initialize Git repository
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create test files and commits
    await createTestRepository();
    
    gitAnalyzer = new GitAnalyzer(tempDir);
  }, 30000); // Increase timeout for Git operations

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  async function createTestRepository(): Promise<void> {
    // Create initial file structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });

    // Create initial files
    const indexContent = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
`;
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), indexContent);

    const utilsContent = `
export function formatNumber(num: number): string {
  return num.toFixed(2);
}
`;
    await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), utilsContent);

    const testContent = `
import { Calculator } from '../src/index';

describe('Calculator', () => {
  it('should add numbers', () => {
    const calc = new Calculator();
    expect(calc.add(2, 3)).toBe(5);
  });
});
`;
    await fs.writeFile(path.join(tempDir, 'tests', 'index.test.ts'), testContent);

    // Initial commit
    await git.add('.');
    await git.commit('feat: initial implementation of calculator');

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add feature
    const enhancedIndexContent = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}
`;
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), enhancedIndexContent);
    await git.add('src/index.ts');
    await git.commit('feat: add subtract and multiply methods');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Bug fix
    const fixedUtilsContent = `
export function formatNumber(num: number): string {
  // Fix: handle null/undefined values
  if (num == null) {
    return '0.00';
  }
  return num.toFixed(2);
}
`;
    await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), fixedUtilsContent);
    await git.add('src/utils.ts');
    await git.commit('fix: handle null values in formatNumber');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Refactor
    const refactoredIndexContent = `
export interface MathOperations {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
}

export class Calculator implements MathOperations {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}
`;
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), refactoredIndexContent);
    await git.add('src/index.ts');
    await git.commit('refactor: add interface and division method');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Documentation update
    const readmeContent = `
# Calculator Project

A simple calculator implementation in TypeScript.

## Features

- Basic arithmetic operations
- Type-safe implementation
- Comprehensive test coverage

## Usage

\`\`\`typescript
import { Calculator } from './src/index';

const calc = new Calculator();
console.log(calc.add(2, 3)); // 5
\`\`\`
`;
    await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);
    await git.add('README.md');
    await git.commit('docs: add project documentation');
  }

  describe('Real Git Repository Analysis', () => {
    it('should analyze the test repository successfully', async () => {
      const result = await gitAnalyzer.analyzeRepository();

      expect(result.repositoryInfo.currentBranch).toBeDefined();
      expect(result.repositoryInfo.totalCommits).toBeGreaterThan(0);
      expect(result.repositoryInfo.contributors).toContain('Test User');
      expect(result.recentActivity.length).toBeGreaterThan(0);
      expect(result.fileHistories.size).toBeGreaterThan(0);

      // Check that we have file histories for our source files
      const fileNames = Array.from(result.fileHistories.keys());
      expect(fileNames.some(name => name.includes('index.ts'))).toBe(true);
      expect(fileNames.some(name => name.includes('utils.ts'))).toBe(true);
    });

    it('should get detailed file history', async () => {
      const indexPath = path.join(tempDir, 'src', 'index.ts');
      const history = await gitAnalyzer.getFileHistory(indexPath);

      expect(history.commits.length).toBeGreaterThan(0);
      expect(history.totalCommits).toBeGreaterThan(0);
      expect(history.authors).toContain('Test User');
      expect(history.firstCommit).toBeInstanceOf(Date);
      expect(history.lastCommit).toBeInstanceOf(Date);

      // Check commit messages contain expected patterns
      const messages = history.commits.map(c => c.message);
      expect(messages.some(msg => msg.includes('feat:'))).toBe(true);
      expect(messages.some(msg => msg.includes('refactor:'))).toBe(true);
    });

    it('should extract meaningful feature context', async () => {
      const indexPath = path.join(tempDir, 'src', 'index.ts');
      const context = await gitAnalyzer.extractFeatureContext(indexPath);

      expect(context.filePath).toContain('index.ts');
      expect(context.recentChanges.length).toBeGreaterThan(0);
      expect(context.changePatterns.length).toBeGreaterThan(0);
      expect(context.evolutionSummary).toContain('modified');
      expect(context.mainContributors).toContain('Test User');

      // Check change patterns
      const featurePattern = context.changePatterns.find(p => p.type === 'feature');
      const refactorPattern = context.changePatterns.find(p => p.type === 'refactor');
      
      expect(featurePattern).toBeDefined();
      expect(featurePattern!.frequency).toBeGreaterThan(0);
      expect(refactorPattern).toBeDefined();
    });

    it('should get recent changes correctly', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentChanges = await gitAnalyzer.getRecentChanges(yesterday);

      expect(recentChanges.length).toBeGreaterThan(0);
      
      // All changes should be after yesterday
      recentChanges.forEach(change => {
        expect(change.date.getTime()).toBeGreaterThan(yesterday.getTime());
      });

      // Check that we have the expected commit types
      const messages = recentChanges.map(c => c.message);
      expect(messages.some(msg => msg.includes('feat:'))).toBe(true);
      expect(messages.some(msg => msg.includes('fix:'))).toBe(true);
      expect(messages.some(msg => msg.includes('refactor:'))).toBe(true);
      expect(messages.some(msg => msg.includes('docs:'))).toBe(true);
    });

    it('should handle file blame analysis', async () => {
      const utilsPath = path.join(tempDir, 'src', 'utils.ts');
      const blame = await gitAnalyzer.getFileBlame(utilsPath);

      expect(blame.size).toBeGreaterThan(0);

      // Check that blame information is reasonable
      for (const [lineNumber, info] of blame.entries()) {
        expect(lineNumber).toBeGreaterThan(0);
        expect(info.author).toBe('Test User');
        expect(info.hash).toMatch(/^[0-9a-f]+$/);
        expect(info.date).toBeInstanceOf(Date);
      }
    });

    it('should detect repository correctly', async () => {
      const isRepo = await gitAnalyzer.isGitRepository();
      expect(isRepo).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.ts');
      const history = await gitAnalyzer.getFileHistory(nonExistentPath);

      expect(history.commits).toHaveLength(0);
      expect(history.totalCommits).toBe(0);
      expect(history.authors).toHaveLength(0);
    });
  });

  describe('Change Pattern Analysis', () => {
    it('should identify different types of changes', async () => {
      const indexPath = path.join(tempDir, 'src', 'index.ts');
      const context = await gitAnalyzer.extractFeatureContext(indexPath);

      const patternTypes = context.changePatterns.map(p => p.type);
      
      // We should have detected different types of changes
      expect(patternTypes).toContain('feature');
      expect(patternTypes).toContain('refactor');

      // Each pattern should have examples
      context.changePatterns.forEach(pattern => {
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(pattern.examples.length).toBeGreaterThan(0);
      });
    });

    it('should generate accurate evolution summary', async () => {
      const indexPath = path.join(tempDir, 'src', 'index.ts');
      const context = await gitAnalyzer.extractFeatureContext(indexPath);

      expect(context.evolutionSummary).toContain('modified');
      expect(context.evolutionSummary).toContain('Test User');
      expect(context.evolutionSummary).toMatch(/\d+ times/);
      expect(context.evolutionSummary).toMatch(/\d+ days/);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle repository analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await gitAnalyzer.analyzeRepository();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 10 seconds for a small test repository
      expect(duration).toBeLessThan(10000);
    });

    it('should limit file analysis to prevent performance issues', async () => {
      const result = await gitAnalyzer.analyzeRepository();
      
      // Should not analyze more than 50 files to prevent performance issues
      expect(result.fileHistories.size).toBeLessThanOrEqual(50);
    });
  });
});
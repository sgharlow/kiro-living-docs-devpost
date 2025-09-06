import { GitAnalyzer, CommitInfo, FileHistory } from '../../src/analyzers/git-analyzer';
import { simpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock simple-git
jest.mock('simple-git');

describe('GitAnalyzer', () => {
  let gitAnalyzer: GitAnalyzer;
  let mockGit: any;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-analyzer-test-'));
    
    // Mock simple-git
    mockGit = {
      checkIsRepo: jest.fn(),
      branch: jest.fn(),
      log: jest.fn(),
      getRemotes: jest.fn(),
      diffSummary: jest.fn(),
      raw: jest.fn(),
    };

    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    
    gitAnalyzer = new GitAnalyzer(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Repository Analysis', () => {
    it('should analyze repository successfully', async () => {
      // Mock repository data
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.branch.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValueOnce({
        latest: {
          hash: 'abc123',
          message: 'Latest commit',
          author_name: 'John Doe',
          author_email: 'john@example.com',
          date: '2023-01-01T12:00:00Z',
        },
      });
      mockGit.log.mockResolvedValueOnce({
        all: [
          {
            hash: 'abc123',
            message: 'Latest commit',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-01T12:00:00Z',
          },
          {
            hash: 'def456',
            message: 'Previous commit',
            author_name: 'Jane Smith',
            author_email: 'jane@example.com',
            date: '2022-12-31T12:00:00Z',
          },
        ],
        total: 2,
      });
      
      // Mock for getRecentCommits
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'Latest commit',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-01T12:00:00Z',
          },
          {
            hash: 'def456',
            message: 'Previous commit',
            author_name: 'Jane Smith',
            author_email: 'jane@example.com',
            date: '2022-12-31T12:00:00Z',
          },
        ],
      });
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
      ]);
      mockGit.raw.mockResolvedValue('src/index.ts\nsrc/utils.ts');
      mockGit.diffSummary.mockResolvedValue({
        files: [{ file: 'src/index.ts' }],
        insertions: 10,
        deletions: 5,
      });

      const result = await gitAnalyzer.analyzeRepository();

      expect(result.repositoryInfo.currentBranch).toBe('main');
      expect(result.repositoryInfo.remoteUrl).toBe('https://github.com/user/repo.git');
      expect(result.repositoryInfo.totalCommits).toBe(2);
      expect(result.repositoryInfo.contributors).toEqual(['John Doe', 'Jane Smith']);
      expect(result.recentActivity).toHaveLength(2);
    });

    it('should handle non-Git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(gitAnalyzer.analyzeRepository()).rejects.toThrow('Not a Git repository');
    });

    it('should handle Git errors gracefully', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Git error'));

      await expect(gitAnalyzer.analyzeRepository()).rejects.toThrow('Git error');
    });
  });

  describe('File History Analysis', () => {
    it('should get file history successfully', async () => {
      const filePath = path.join(tempDir, 'src', 'test.ts');
      
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'Add new feature',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-01T12:00:00Z',
          },
          {
            hash: 'def456',
            message: 'Initial commit',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2022-12-31T12:00:00Z',
          },
        ],
      });

      mockGit.diffSummary.mockResolvedValue({
        insertions: 15,
        deletions: 3,
      });

      const history = await gitAnalyzer.getFileHistory(filePath);

      expect(history.filePath).toContain('test.ts');
      expect(history.commits).toHaveLength(2);
      expect(history.totalCommits).toBe(2);
      expect(history.authors).toEqual(['John Doe']);
      expect(history.commits[0].message).toBe('Add new feature');
      expect(history.commits[0].insertions).toBe(15);
      expect(history.commits[0].deletions).toBe(3);
    });

    it('should handle file history errors gracefully', async () => {
      const filePath = path.join(tempDir, 'nonexistent.ts');
      
      mockGit.log.mockRejectedValue(new Error('File not found'));

      const history = await gitAnalyzer.getFileHistory(filePath);

      expect(history.commits).toHaveLength(0);
      expect(history.totalCommits).toBe(0);
      expect(history.authors).toHaveLength(0);
    });
  });

  describe('Recent Changes', () => {
    it('should get recent changes since date', async () => {
      const sinceDate = new Date('2023-01-01');
      
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'Recent change',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-02T12:00:00Z',
          },
        ],
      });

      mockGit.diffSummary.mockResolvedValue({
        files: [
          { file: 'src/index.ts' },
          { file: 'src/utils.ts' },
        ],
        insertions: 20,
        deletions: 5,
      });

      const changes = await gitAnalyzer.getRecentChanges(sinceDate);

      expect(changes).toHaveLength(1);
      expect(changes[0].message).toBe('Recent change');
      expect(changes[0].filesChanged).toEqual(['src/index.ts', 'src/utils.ts']);
      expect(changes[0].insertions).toBe(20);
      expect(changes[0].deletions).toBe(5);
    });

    it('should handle recent changes errors gracefully', async () => {
      mockGit.log.mockRejectedValue(new Error('Git log error'));

      const changes = await gitAnalyzer.getRecentChanges(new Date());

      expect(changes).toHaveLength(0);
    });
  });

  describe('Feature Context Extraction', () => {
    it('should extract feature context successfully', async () => {
      const filePath = path.join(tempDir, 'src', 'feature.ts');
      
      // Mock file history
      mockGit.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'feat: add new authentication feature',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-03T12:00:00Z',
          },
          {
            hash: 'def456',
            message: 'fix: resolve login bug',
            author_name: 'Jane Smith',
            author_email: 'jane@example.com',
            date: '2023-01-02T12:00:00Z',
          },
          {
            hash: 'ghi789',
            message: 'refactor: improve code structure',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2023-01-01T12:00:00Z',
          },
        ],
      });

      mockGit.diffSummary.mockResolvedValue({
        insertions: 10,
        deletions: 2,
      });

      const context = await gitAnalyzer.extractFeatureContext(filePath);

      expect(context.filePath).toContain('feature.ts');
      expect(context.recentChanges).toHaveLength(3);
      expect(context.changePatterns).toBeDefined();
      expect(context.evolutionSummary).toContain('modified 3 times');
      expect(context.mainContributors).toContain('John Doe');
    });

    it('should handle feature context errors gracefully', async () => {
      const filePath = path.join(tempDir, 'nonexistent.ts');
      
      mockGit.log.mockRejectedValue(new Error('File not found'));

      const context = await gitAnalyzer.extractFeatureContext(filePath);

      expect(context.recentChanges).toHaveLength(0);
      expect(context.changePatterns).toHaveLength(0);
      expect(context.evolutionSummary).toBe('No commit history available for this file.');
      expect(context.mainContributors).toHaveLength(0);
    });
  });

  describe('Change Pattern Analysis', () => {
    it('should analyze change patterns correctly', () => {
      const commits: CommitInfo[] = [
        {
          hash: 'abc123',
          message: 'feat: add new feature',
          author: 'John Doe',
          email: 'john@example.com',
          date: new Date('2023-01-01'),
          filesChanged: ['src/feature.ts'],
          insertions: 10,
          deletions: 0,
        },
        {
          hash: 'def456',
          message: 'fix: resolve critical bug',
          author: 'Jane Smith',
          email: 'jane@example.com',
          date: new Date('2023-01-02'),
          filesChanged: ['src/feature.ts'],
          insertions: 2,
          deletions: 1,
        },
        {
          hash: 'ghi789',
          message: 'feat: enhance user interface',
          author: 'John Doe',
          email: 'john@example.com',
          date: new Date('2023-01-03'),
          filesChanged: ['src/feature.ts'],
          insertions: 15,
          deletions: 3,
        },
      ];

      // Access private method for testing
      const patterns = (gitAnalyzer as any).analyzeChangePatterns(commits);

      expect(patterns).toBeDefined();
      const featurePattern = patterns.find((p: any) => p.type === 'feature');
      const bugfixPattern = patterns.find((p: any) => p.type === 'bugfix');

      expect(featurePattern?.frequency).toBe(2);
      expect(bugfixPattern?.frequency).toBe(1);
    });
  });

  describe('Evolution Summary Generation', () => {
    it('should generate meaningful evolution summary', () => {
      const fileHistory: FileHistory = {
        filePath: 'src/test.ts',
        commits: [
          {
            hash: 'abc123',
            message: 'feat: initial implementation',
            author: 'John Doe',
            email: 'john@example.com',
            date: new Date('2023-01-03'),
            filesChanged: ['src/test.ts'],
            insertions: 50,
            deletions: 0,
          },
          {
            hash: 'def456',
            message: 'fix: resolve issue',
            author: 'Jane Smith',
            email: 'jane@example.com',
            date: new Date('2023-01-01'),
            filesChanged: ['src/test.ts'],
            insertions: 5,
            deletions: 2,
          },
        ],
        totalCommits: 2,
        firstCommit: new Date('2023-01-01'),
        lastCommit: new Date('2023-01-03'),
        authors: ['John Doe', 'Jane Smith'],
      };

      const changePatterns = [
        { type: 'feature' as const, frequency: 1, examples: ['feat: initial implementation'] },
        { type: 'bugfix' as const, frequency: 1, examples: ['fix: resolve issue'] },
      ];

      // Access private method for testing
      const summary = (gitAnalyzer as any).generateEvolutionSummary(fileHistory, changePatterns);

      expect(summary).toContain('modified 2 times');
      expect(summary).toContain('2 days');
      expect(summary).toContain('John Doe');
      expect(summary).toContain('Jane Smith');
    });
  });

  describe('File Blame Analysis', () => {
    it('should get file blame information', async () => {
      const filePath = path.join(tempDir, 'src', 'test.ts');
      
      const blameOutput = `abc123 1 1 1
author John Doe
author-time 1672531200
	console.log('Hello World');
def456 2 2 1
author Jane Smith
author-time 1672617600
	return true;`;

      mockGit.raw.mockResolvedValue(blameOutput);

      const blame = await gitAnalyzer.getFileBlame(filePath);

      expect(blame.size).toBeGreaterThan(0);
      // Just verify that blame information is parsed
      const firstEntry = blame.get(1);
      if (firstEntry) {
        expect(firstEntry.author).toBeDefined();
        expect(firstEntry.hash).toBeDefined();
        expect(firstEntry.date).toBeInstanceOf(Date);
      }
    });

    it('should handle blame errors gracefully', async () => {
      const filePath = path.join(tempDir, 'nonexistent.ts');
      
      mockGit.raw.mockRejectedValue(new Error('File not found'));

      const blame = await gitAnalyzer.getFileBlame(filePath);

      expect(blame.size).toBe(0);
    });
  });

  describe('Repository Detection', () => {
    it('should detect Git repository correctly', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);

      const isRepo = await gitAnalyzer.isGitRepository();

      expect(isRepo).toBe(true);
    });

    it('should detect non-Git directory correctly', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      const isRepo = await gitAnalyzer.isGitRepository();

      expect(isRepo).toBe(false);
    });

    it('should handle repository check errors', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Access denied'));

      const isRepo = await gitAnalyzer.isGitRepository();

      expect(isRepo).toBe(false);
    });
  });

  describe('Source File Detection', () => {
    it('should identify source files correctly', () => {
      // Access private method for testing
      const isSourceFile = (gitAnalyzer as any).isSourceFile.bind(gitAnalyzer);

      expect(isSourceFile('src/index.ts')).toBe(true);
      expect(isSourceFile('src/utils.js')).toBe(true);
      expect(isSourceFile('src/component.tsx')).toBe(true);
      expect(isSourceFile('src/component.jsx')).toBe(true);
      expect(isSourceFile('main.py')).toBe(true);
      expect(isSourceFile('main.go')).toBe(true);
      expect(isSourceFile('Main.java')).toBe(true);
      expect(isSourceFile('main.cpp')).toBe(true);
      expect(isSourceFile('main.c')).toBe(true);
      expect(isSourceFile('header.h')).toBe(true);

      expect(isSourceFile('README.md')).toBe(false);
      expect(isSourceFile('package.json')).toBe(false);
      expect(isSourceFile('image.png')).toBe(false);
      expect(isSourceFile('style.css')).toBe(false);
    });
  });
});
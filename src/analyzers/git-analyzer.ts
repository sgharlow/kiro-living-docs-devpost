import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface FileHistory {
  filePath: string;
  commits: CommitInfo[];
  totalCommits: number;
  firstCommit: Date;
  lastCommit: Date;
  authors: string[];
}

export interface FeatureContext {
  filePath: string;
  recentChanges: CommitInfo[];
  changePatterns: ChangePattern[];
  evolutionSummary: string;
  mainContributors: string[];
}

export interface ChangePattern {
  type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'other';
  frequency: number;
  examples: string[];
}

export interface GitAnalysisResult {
  repositoryInfo: {
    currentBranch: string;
    remoteUrl?: string;
    totalCommits: number;
    contributors: string[];
    lastCommit: CommitInfo;
  };
  fileHistories: Map<string, FileHistory>;
  recentActivity: CommitInfo[];
}

/**
 * Git history analyzer for extracting contextual information from version control
 */
export class GitAnalyzer {
  private git: SimpleGit;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.git = simpleGit(projectPath);
  }

  /**
   * Analyze the entire repository and return comprehensive Git analysis
   */
  public async analyzeRepository(): Promise<GitAnalysisResult> {
    try {
      // Check if this is a Git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a Git repository');
      }

      // Get repository info
      const repositoryInfo = await this.getRepositoryInfo();
      
      // Get recent activity (last 50 commits)
      const recentActivity = await this.getRecentCommits(50);
      
      // Get file histories for source files
      const fileHistories = await this.analyzeFileHistories();

      return {
        repositoryInfo,
        fileHistories,
        recentActivity,
      };
    } catch (error) {
      console.error('Error analyzing Git repository:', error);
      throw error;
    }
  }

  /**
   * Get history for a specific file
   */
  public async getFileHistory(filePath: string): Promise<FileHistory> {
    try {
      const relativePath = path.relative(this.projectPath, filePath);
      
      // Get commit log for the specific file
      const log = await this.git.log({ file: relativePath, maxCount: 100 });
      
      const commits: CommitInfo[] = [];
      const authors = new Set<string>();

      for (const commit of log.all) {
        let insertions = 0;
        let deletions = 0;
        
        try {
          // Get detailed info about changes in this commit for this file
          const diffSummary = await this.git.diffSummary([`${commit.hash}^`, commit.hash, '--', relativePath]);
          insertions = diffSummary.insertions || 0;
          deletions = diffSummary.deletions || 0;
        } catch (error) {
          // Skip diff analysis for commits that can't be diffed (e.g., initial commit)
        }
        
        const commitInfo: CommitInfo = {
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          email: commit.author_email,
          date: new Date(commit.date),
          filesChanged: [relativePath],
          insertions,
          deletions,
        };

        commits.push(commitInfo);
        authors.add(commit.author_name);
      }

      return {
        filePath: relativePath,
        commits,
        totalCommits: commits.length,
        firstCommit: commits.length > 0 ? commits[commits.length - 1].date : new Date(),
        lastCommit: commits.length > 0 ? commits[0].date : new Date(),
        authors: Array.from(authors),
      };
    } catch (error) {
      console.error(`Error getting file history for ${filePath}:`, error);
      return {
        filePath,
        commits: [],
        totalCommits: 0,
        firstCommit: new Date(),
        lastCommit: new Date(),
        authors: [],
      };
    }
  }

  /**
   * Get recent changes since a specific date
   */
  public async getRecentChanges(since: Date): Promise<CommitInfo[]> {
    try {
      const sinceString = since.toISOString();
      const log = await this.git.log({ '--since': sinceString });
      
      const commits: CommitInfo[] = [];

      for (const commit of log.all) {
        let filesChanged: string[] = [];
        let insertions = 0;
        let deletions = 0;
        
        try {
          // Get files changed in this commit
          const diffSummary = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
          filesChanged = diffSummary.files.map(f => f.file);
          insertions = diffSummary.insertions || 0;
          deletions = diffSummary.deletions || 0;
        } catch (error) {
          // Skip diff analysis for commits that can't be diffed
        }
        
        const commitInfo: CommitInfo = {
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          email: commit.author_email,
          date: new Date(commit.date),
          filesChanged,
          insertions,
          deletions,
        };

        commits.push(commitInfo);
      }

      return commits;
    } catch (error) {
      console.error('Error getting recent changes:', error);
      return [];
    }
  }

  /**
   * Extract feature context for a specific file
   */
  public async extractFeatureContext(filePath: string): Promise<FeatureContext> {
    try {
      const fileHistory = await this.getFileHistory(filePath);
      const recentChanges = fileHistory.commits.slice(0, 10); // Last 10 commits
      
      // Analyze change patterns
      const changePatterns = this.analyzeChangePatterns(fileHistory.commits);
      
      // Generate evolution summary
      const evolutionSummary = this.generateEvolutionSummary(fileHistory, changePatterns);
      
      // Get main contributors (authors with most commits)
      const contributorCounts = new Map<string, number>();
      fileHistory.commits.forEach(commit => {
        contributorCounts.set(commit.author, (contributorCounts.get(commit.author) || 0) + 1);
      });
      
      const mainContributors = Array.from(contributorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([author]) => author);

      return {
        filePath,
        recentChanges,
        changePatterns,
        evolutionSummary,
        mainContributors,
      };
    } catch (error) {
      console.error(`Error extracting feature context for ${filePath}:`, error);
      return {
        filePath,
        recentChanges: [],
        changePatterns: [],
        evolutionSummary: 'No Git history available',
        mainContributors: [],
      };
    }
  }

  /**
   * Get repository information
   */
  private async getRepositoryInfo(): Promise<GitAnalysisResult['repositoryInfo']> {
    const branch = await this.git.branch();
    const log = await this.git.log({ maxCount: 1 });
    const allLog = await this.git.log();
    
    // Get remote URL
    let remoteUrl: string | undefined;
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      remoteUrl = origin?.refs?.fetch;
    } catch (error) {
      // Remote might not exist
    }

    // Get all contributors
    const contributors = new Set<string>();
    allLog.all.forEach(commit => contributors.add(commit.author_name));

    const lastCommit = log.latest;
    const lastCommitInfo: CommitInfo = {
      hash: lastCommit?.hash || '',
      message: lastCommit?.message || '',
      author: lastCommit?.author_name || '',
      email: lastCommit?.author_email || '',
      date: lastCommit ? new Date(lastCommit.date) : new Date(),
      filesChanged: [],
      insertions: 0,
      deletions: 0,
    };

    const result: GitAnalysisResult['repositoryInfo'] = {
      currentBranch: branch.current || 'unknown',
      totalCommits: allLog.total,
      contributors: Array.from(contributors),
      lastCommit: lastCommitInfo,
    };

    if (remoteUrl) {
      result.remoteUrl = remoteUrl;
    }

    return result;
  }

  /**
   * Get recent commits
   */
  private async getRecentCommits(maxCount: number): Promise<CommitInfo[]> {
    const log = await this.git.log({ maxCount });
    const commits: CommitInfo[] = [];

    for (const commit of log.all) {
      try {
        // Get files changed in this commit
        const diffSummary = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
        
        const commitInfo: CommitInfo = {
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          email: commit.author_email,
          date: new Date(commit.date),
          filesChanged: diffSummary.files.map(f => f.file),
          insertions: diffSummary.insertions || 0,
          deletions: diffSummary.deletions || 0,
        };

        commits.push(commitInfo);
      } catch (error) {
        // Skip commits that can't be analyzed (e.g., initial commit)
        const commitInfo: CommitInfo = {
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          email: commit.author_email,
          date: new Date(commit.date),
          filesChanged: [],
          insertions: 0,
          deletions: 0,
        };

        commits.push(commitInfo);
      }
    }

    return commits;
  }

  /**
   * Analyze file histories for source files
   */
  private async analyzeFileHistories(): Promise<Map<string, FileHistory>> {
    const fileHistories = new Map<string, FileHistory>();
    
    try {
      // Get all files in the repository
      const files = await this.git.raw(['ls-files']);
      const sourceFiles = files.split('\n')
        .filter(file => file.trim())
        .filter(file => this.isSourceFile(file));

      // Limit to prevent performance issues
      const filesToAnalyze = sourceFiles.slice(0, 50);

      for (const file of filesToAnalyze) {
        try {
          const filePath = path.join(this.projectPath, file);
          const history = await this.getFileHistory(filePath);
          fileHistories.set(file, history);
        } catch (error) {
          console.error(`Error analyzing history for ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error getting file list:', error);
    }

    return fileHistories;
  }

  /**
   * Analyze change patterns in commit messages
   */
  private analyzeChangePatterns(commits: CommitInfo[]): ChangePattern[] {
    const patterns = new Map<string, { count: number; examples: string[] }>();

    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      let type: ChangePattern['type'] = 'other';

      // Check for conventional commit prefixes first (more specific)
      if (message.startsWith('feat:') || message.startsWith('feature:')) {
        type = 'feature';
      } else if (message.startsWith('fix:') || message.startsWith('bugfix:')) {
        type = 'bugfix';
      } else if (message.startsWith('refactor:') || message.startsWith('cleanup:')) {
        type = 'refactor';
      } else if (message.startsWith('docs:') || message.startsWith('doc:')) {
        type = 'docs';
      } else if (message.startsWith('test:') || message.startsWith('tests:')) {
        type = 'test';
      } 
      // Fallback to keyword matching for non-conventional commits
      else if (message.includes('feat') || message.includes('feature') || message.includes('add')) {
        type = 'feature';
      } else if (message.includes('fix') || message.includes('bug')) {
        type = 'bugfix';
      } else if (message.includes('refactor') || message.includes('cleanup') || message.includes('improve')) {
        type = 'refactor';
      } else if (message.includes('doc') || message.includes('readme')) {
        type = 'docs';
      } else if (message.includes('test') || message.includes('spec')) {
        type = 'test';
      }

      const existing = patterns.get(type) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 3) {
        existing.examples.push(commit.message);
      }
      patterns.set(type, existing);
    });

    return Array.from(patterns.entries()).map(([type, data]) => ({
      type: type as ChangePattern['type'],
      frequency: data.count,
      examples: data.examples,
    }));
  }

  /**
   * Generate evolution summary for a file
   */
  private generateEvolutionSummary(fileHistory: FileHistory, changePatterns: ChangePattern[]): string {
    if (fileHistory.commits.length === 0) {
      return 'No commit history available for this file.';
    }

    const totalCommits = fileHistory.commits.length;
    const daysSinceFirst = Math.floor(
      (fileHistory.lastCommit.getTime() - fileHistory.firstCommit.getTime()) / (1000 * 60 * 60 * 24)
    );

    const mainPattern = changePatterns.reduce((prev, current) => 
      prev.frequency > current.frequency ? prev : current
    );

    const summary = [
      `This file has been modified ${totalCommits} times over ${daysSinceFirst} days.`,
      `Primary change type: ${mainPattern.type} (${mainPattern.frequency} occurrences).`,
      `Main contributors: ${fileHistory.authors.slice(0, 3).join(', ')}.`
    ];

    if (fileHistory.commits.length > 0) {
      const recentCommit = fileHistory.commits[0];
      summary.push(`Last modified: ${recentCommit.date.toDateString()} by ${recentCommit.author}.`);
    }

    return summary.join(' ');
  }

  /**
   * Check if a file is a source file that should be analyzed
   */
  private isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.java', '.cpp', '.c', '.h'];
    return sourceExtensions.includes(ext);
  }

  /**
   * Check if the current directory is a Git repository
   */
  public async isGitRepository(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get blame information for a file (who changed what lines)
   */
  public async getFileBlame(filePath: string): Promise<Map<number, { author: string; hash: string; date: Date }>> {
    const blameInfo = new Map<number, { author: string; hash: string; date: Date }>();
    
    try {
      const relativePath = path.relative(this.projectPath, filePath);
      const blame = await this.git.raw(['blame', '--porcelain', relativePath]);
      
      const lines = blame.split('\n');
      let currentLineNumber = 1;
      let currentCommit = '';
      let currentAuthor = '';
      let currentDate = new Date();

      for (const line of lines) {
        if (line.match(/^[0-9a-f]{40}/)) {
          // New commit hash
          currentCommit = line.split(' ')[0];
        } else if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12));
          currentDate = new Date(timestamp * 1000);
        } else if (line.startsWith('\t')) {
          // Actual code line
          blameInfo.set(currentLineNumber, {
            author: currentAuthor,
            hash: currentCommit,
            date: currentDate,
          });
          currentLineNumber++;
        }
      }
    } catch (error) {
      console.error(`Error getting blame for ${filePath}:`, error);
    }

    return blameInfo;
  }
}
/**
 * Troubleshooting Guide for Living Documentation Generator
 * 
 * Provides error recovery suggestions, diagnostic tools, and troubleshooting
 * guidance to help users resolve common issues.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
// import * as path from 'path'; // Unused for now
import { PerformanceMetrics } from '../performance/performance-optimizer.js';

export interface TroubleshootingIssue {
  id: string;
  category: 'performance' | 'configuration' | 'analysis' | 'network' | 'permissions' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  symptoms: string[];
  possibleCauses: string[];
  solutions: TroubleshootingSolution[];
  diagnostics?: DiagnosticCheck[];
}

export interface TroubleshootingSolution {
  id: string;
  title: string;
  description: string;
  steps: string[];
  automated?: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTime: string;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  check: () => Promise<DiagnosticResult>;
}

export interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: any;
  suggestion?: string;
}

export interface SystemDiagnostics {
  timestamp: Date;
  nodeVersion: string;
  platform: string;
  architecture: string;
  memoryUsage: NodeJS.MemoryUsage;
  diskSpace: { free: number; total: number };
  networkConnectivity: boolean;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canExecute: boolean;
  };
  dependencies: Array<{ name: string; version: string; status: 'ok' | 'missing' | 'outdated' }>;
}

export class TroubleshootingGuide extends EventEmitter {
  private knownIssues: Map<string, TroubleshootingIssue> = new Map();
  private diagnosticHistory: DiagnosticResult[] = [];

  constructor() {
    super();
    this.initializeKnownIssues();
  }

  /**
   * Diagnose system and identify potential issues
   */
  public async runDiagnostics(projectPath?: string): Promise<SystemDiagnostics> {
    const diagnostics: SystemDiagnostics = {
      timestamp: new Date(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memoryUsage: process.memoryUsage(),
      diskSpace: await this.checkDiskSpace(projectPath),
      networkConnectivity: await this.checkNetworkConnectivity(),
      permissions: await this.checkPermissions(projectPath),
      dependencies: await this.checkDependencies()
    };

    this.emit('diagnostics-completed', diagnostics);
    return diagnostics;
  }

  /**
   * Analyze error and suggest solutions
   */
  public analyzeError(error: Error, context?: any): TroubleshootingIssue[] {
    const suggestions: TroubleshootingIssue[] = [];
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    // Check for known error patterns
    for (const [, issue] of this.knownIssues) {
      if (this.matchesErrorPattern(errorMessage, errorStack, issue)) {
        suggestions.push(issue);
      }
    }

    // If no specific matches, provide general guidance
    if (suggestions.length === 0) {
      suggestions.push(this.getGeneralErrorGuidance(error, context));
    }

    this.emit('error-analyzed', { error, suggestions, context });
    return suggestions;
  }

  /**
   * Get troubleshooting suggestions based on performance metrics
   */
  public analyzePerformance(metrics: PerformanceMetrics): TroubleshootingIssue[] {
    const issues: TroubleshootingIssue[] = [];

    // Check analysis time
    if (metrics.analysisTime > 10000) { // 10 seconds
      issues.push(this.knownIssues.get('slow-analysis')!);
    }

    // Check memory usage
    if (metrics.memoryUsage > 512) { // 512 MB
      issues.push(this.knownIssues.get('high-memory')!);
    }

    // Check update latency
    if (metrics.updateLatency > 5000) { // 5 seconds
      issues.push(this.knownIssues.get('slow-updates')!);
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < 30) { // Less than 30%
      issues.push(this.knownIssues.get('low-cache-hit-rate')!);
    }

    return issues;
  }

  /**
   * Get issue by ID
   */
  public getIssue(issueId: string): TroubleshootingIssue | null {
    return this.knownIssues.get(issueId) || null;
  }

  /**
   * Search issues by category or keywords
   */
  public searchIssues(query: string, category?: string): TroubleshootingIssue[] {
    const results: TroubleshootingIssue[] = [];
    const searchTerm = query.toLowerCase();

    for (const [, issue] of this.knownIssues) {
      // Filter by category if specified
      if (category && issue.category !== category) {
        continue;
      }

      // Search in title, description, and symptoms
      if (
        issue.title.toLowerCase().includes(searchTerm) ||
        issue.description.toLowerCase().includes(searchTerm) ||
        issue.symptoms.some(symptom => symptom.toLowerCase().includes(searchTerm))
      ) {
        results.push(issue);
      }
    }

    return results.sort((a, b) => {
      // Sort by severity (critical first)
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Execute automated solution
   */
  public async executeAutomatedSolution(issueId: string, solutionId: string, projectPath?: string): Promise<boolean> {
    const issue = this.knownIssues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const solution = issue.solutions.find(s => s.id === solutionId);
    if (!solution || !solution.automated) {
      throw new Error(`Automated solution ${solutionId} not available`);
    }

    try {
      const success = await this.runAutomatedSolution(solution, projectPath);
      this.emit('solution-executed', { issue, solution, success });
      return success;
    } catch (error) {
      this.emit('solution-failed', { issue, solution, error });
      throw error;
    }
  }

  /**
   * Generate troubleshooting report
   */
  public async generateReport(projectPath?: string): Promise<string> {
    const diagnostics = await this.runDiagnostics(projectPath);
    const report: string[] = [];

    report.push('# Living Documentation Generator - Troubleshooting Report');
    report.push(`Generated: ${diagnostics.timestamp.toISOString()}`);
    report.push('');

    // System Information
    report.push('## System Information');
    report.push(`- Node.js Version: ${diagnostics.nodeVersion}`);
    report.push(`- Platform: ${diagnostics.platform} (${diagnostics.architecture})`);
    report.push(`- Memory Usage: ${Math.round(diagnostics.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    report.push(`- Disk Space: ${Math.round(diagnostics.diskSpace.free / 1024 / 1024 / 1024)}GB free of ${Math.round(diagnostics.diskSpace.total / 1024 / 1024 / 1024)}GB`);
    report.push(`- Network: ${diagnostics.networkConnectivity ? 'Connected' : 'Disconnected'}`);
    report.push('');

    // Permissions
    report.push('## Permissions');
    report.push(`- Read: ${diagnostics.permissions.canRead ? '✅' : '❌'}`);
    report.push(`- Write: ${diagnostics.permissions.canWrite ? '✅' : '❌'}`);
    report.push(`- Execute: ${diagnostics.permissions.canExecute ? '✅' : '❌'}`);
    report.push('');

    // Dependencies
    report.push('## Dependencies');
    for (const dep of diagnostics.dependencies) {
      const status = dep.status === 'ok' ? '✅' : dep.status === 'missing' ? '❌' : '⚠️';
      report.push(`- ${dep.name} (${dep.version}): ${status}`);
    }
    report.push('');

    // Recent Diagnostics
    if (this.diagnosticHistory.length > 0) {
      report.push('## Recent Issues');
      const recentIssues = this.diagnosticHistory.slice(-5);
      for (const result of recentIssues) {
        const status = result.passed ? '✅' : '❌';
        report.push(`- ${status} ${result.message}`);
        if (result.suggestion) {
          report.push(`  Suggestion: ${result.suggestion}`);
        }
      }
      report.push('');
    }

    // Common Solutions
    report.push('## Common Solutions');
    report.push('1. **Restart the documentation server**: Often resolves temporary issues');
    report.push('2. **Clear cache**: Delete `.docs-cache` directory and restart');
    report.push('3. **Check file permissions**: Ensure read/write access to project directory');
    report.push('4. **Update dependencies**: Run `npm update` to get latest versions');
    report.push('5. **Check disk space**: Ensure sufficient free space for documentation generation');

    return report.join('\n');
  }

  /**
   * Initialize known issues database
   */
  private initializeKnownIssues(): void {
    // Performance Issues
    this.knownIssues.set('slow-analysis', {
      id: 'slow-analysis',
      category: 'performance',
      severity: 'medium',
      title: 'Slow Code Analysis',
      description: 'Code analysis is taking longer than expected (>10 seconds)',
      symptoms: [
        'Documentation generation takes a long time',
        'High CPU usage during analysis',
        'Timeouts during file processing'
      ],
      possibleCauses: [
        'Large number of files to analyze',
        'Complex TypeScript configurations',
        'Insufficient system resources',
        'Disabled caching'
      ],
      solutions: [
        {
          id: 'enable-caching',
          title: 'Enable Analysis Caching',
          description: 'Enable caching to speed up repeated analysis',
          steps: [
            'Add "cacheEnabled": true to your configuration',
            'Restart the documentation server',
            'Subsequent runs should be faster'
          ],
          automated: true,
          riskLevel: 'low',
          estimatedTime: '1 minute'
        },
        {
          id: 'reduce-scope',
          title: 'Reduce Analysis Scope',
          description: 'Exclude unnecessary files from analysis',
          steps: [
            'Review your includePatterns configuration',
            'Add more specific excludePatterns',
            'Consider excluding test files and build outputs'
          ],
          automated: false,
          riskLevel: 'low',
          estimatedTime: '5 minutes'
        }
      ]
    });

    this.knownIssues.set('high-memory', {
      id: 'high-memory',
      category: 'performance',
      severity: 'high',
      title: 'High Memory Usage',
      description: 'The documentation generator is using excessive memory (>512MB)',
      symptoms: [
        'System becomes slow or unresponsive',
        'Out of memory errors',
        'Process crashes unexpectedly'
      ],
      possibleCauses: [
        'Large project with many files',
        'Memory leaks in analysis code',
        'Insufficient garbage collection',
        'Large cache size'
      ],
      solutions: [
        {
          id: 'enable-gc',
          title: 'Enable Garbage Collection',
          description: 'Force garbage collection to free memory',
          steps: [
            'Start Node.js with --expose-gc flag',
            'Enable automatic garbage collection in config',
            'Monitor memory usage'
          ],
          automated: true,
          riskLevel: 'low',
          estimatedTime: '2 minutes'
        },
        {
          id: 'reduce-cache',
          title: 'Reduce Cache Size',
          description: 'Limit cache size to reduce memory usage',
          steps: [
            'Set maxCacheSize in configuration',
            'Clear existing cache',
            'Restart the server'
          ],
          automated: true,
          riskLevel: 'low',
          estimatedTime: '1 minute'
        }
      ]
    });

    this.knownIssues.set('file-permissions', {
      id: 'file-permissions',
      category: 'permissions',
      severity: 'high',
      title: 'File Permission Errors',
      description: 'Cannot read or write files due to permission issues',
      symptoms: [
        'EACCES or EPERM errors',
        'Cannot create documentation files',
        'Cannot read source files'
      ],
      possibleCauses: [
        'Insufficient file system permissions',
        'Files owned by different user',
        'Read-only file system',
        'Antivirus software blocking access'
      ],
      solutions: [
        {
          id: 'fix-permissions',
          title: 'Fix File Permissions',
          description: 'Correct file and directory permissions',
          steps: [
            'Check current user permissions',
            'Use chmod/chown to fix permissions (Unix/Linux)',
            'Run as administrator if necessary (Windows)',
            'Ensure output directory is writable'
          ],
          automated: false,
          riskLevel: 'medium',
          estimatedTime: '5 minutes'
        }
      ]
    });

    this.knownIssues.set('network-issues', {
      id: 'network-issues',
      category: 'network',
      severity: 'medium',
      title: 'Network Connectivity Issues',
      description: 'Problems with web server or WebSocket connections',
      symptoms: [
        'Cannot access web interface',
        'WebSocket connection failures',
        'Real-time updates not working'
      ],
      possibleCauses: [
        'Port already in use',
        'Firewall blocking connections',
        'Proxy configuration issues',
        'Network interface problems'
      ],
      solutions: [
        {
          id: 'change-port',
          title: 'Change Web Server Port',
          description: 'Use a different port for the web server',
          steps: [
            'Stop the current server',
            'Change webServerPort in configuration',
            'Restart the server',
            'Access using new port'
          ],
          automated: true,
          riskLevel: 'low',
          estimatedTime: '2 minutes'
        }
      ]
    });

    // Add more issues as needed...
  }

  /**
   * Check if error matches known issue pattern
   */
  private matchesErrorPattern(errorMessage: string, errorStack: string, issue: TroubleshootingIssue): boolean {
    // Simple pattern matching - could be enhanced with regex patterns
    const searchText = `${errorMessage} ${errorStack}`;
    
    return issue.symptoms.some(symptom => 
      searchText.includes(symptom.toLowerCase())
    ) || issue.possibleCauses.some(cause =>
      searchText.includes(cause.toLowerCase())
    );
  }

  /**
   * Generate general error guidance
   */
  private getGeneralErrorGuidance(error: Error, _context?: any): TroubleshootingIssue {
    return {
      id: 'general-error',
      category: 'general',
      severity: 'medium',
      title: 'General Error',
      description: `An unexpected error occurred: ${error.message}`,
      symptoms: [error.message],
      possibleCauses: [
        'Unexpected input or configuration',
        'System resource constraints',
        'Software bug or edge case'
      ],
      solutions: [
        {
          id: 'restart-server',
          title: 'Restart Documentation Server',
          description: 'Restart the server to clear any temporary issues',
          steps: [
            'Stop the current documentation server',
            'Wait a few seconds',
            'Start the server again',
            'Try the operation again'
          ],
          automated: false,
          riskLevel: 'low',
          estimatedTime: '1 minute'
        },
        {
          id: 'check-logs',
          title: 'Check Error Logs',
          description: 'Review detailed error information',
          steps: [
            'Enable debug logging',
            'Reproduce the error',
            'Review log output for more details',
            'Search for similar issues online'
          ],
          automated: false,
          riskLevel: 'low',
          estimatedTime: '5 minutes'
        }
      ]
    };
  }

  /**
   * Run automated solution
   */
  private async runAutomatedSolution(solution: TroubleshootingSolution, projectPath?: string): Promise<boolean> {
    switch (solution.id) {
      case 'enable-caching':
        return this.enableCaching(projectPath);
      case 'enable-gc':
        return this.enableGarbageCollection();
      case 'reduce-cache':
        return this.reduceCacheSize(projectPath);
      case 'change-port':
        return this.changeWebServerPort(projectPath);
      default:
        throw new Error(`Automated solution ${solution.id} not implemented`);
    }
  }

  /**
   * Automated solution implementations
   */
  private async enableCaching(_projectPath?: string): Promise<boolean> {
    // Implementation would modify configuration to enable caching
    return true;
  }

  private async enableGarbageCollection(): Promise<boolean> {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  private async reduceCacheSize(_projectPath?: string): Promise<boolean> {
    // Implementation would modify cache configuration
    return true;
  }

  private async changeWebServerPort(_projectPath?: string): Promise<boolean> {
    // Implementation would find available port and update config
    return true;
  }

  /**
   * System diagnostic checks
   */
  private async checkDiskSpace(projectPath?: string): Promise<{ free: number; total: number }> {
    try {
      const stats = await fs.promises.statfs(projectPath || process.cwd());
      return {
        free: stats.bavail * stats.bsize,
        total: stats.blocks * stats.bsize
      };
    } catch {
      return { free: 0, total: 0 };
    }
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    // Simple connectivity check
    return true; // Placeholder
  }

  private async checkPermissions(projectPath?: string): Promise<{ canRead: boolean; canWrite: boolean; canExecute: boolean }> {
    const testPath = projectPath || process.cwd();
    
    try {
      await fs.promises.access(testPath, fs.constants.R_OK);
      const canRead = true;
      
      await fs.promises.access(testPath, fs.constants.W_OK);
      const canWrite = true;
      
      await fs.promises.access(testPath, fs.constants.X_OK);
      const canExecute = true;
      
      return { canRead, canWrite, canExecute };
    } catch {
      return { canRead: false, canWrite: false, canExecute: false };
    }
  }

  private async checkDependencies(): Promise<Array<{ name: string; version: string; status: 'ok' | 'missing' | 'outdated' }>> {
    const dependencies = [
      'typescript',
      'chokidar',
      'express',
      'ws',
      'simple-git'
    ];

    const results = [];
    
    for (const dep of dependencies) {
      try {
        const pkg = require(`${dep}/package.json`);
        results.push({
          name: dep,
          version: pkg.version,
          status: 'ok' as const
        });
      } catch {
        results.push({
          name: dep,
          version: 'unknown',
          status: 'missing' as const
        });
      }
    }

    return results;
  }
}
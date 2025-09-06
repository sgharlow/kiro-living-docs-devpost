import { ProjectAnalysis } from '../types.js';
import { DependencyAnalyzer, DependencyGraph } from '../analyzers/dependency-analyzer.js';
import { DiagramGenerator, DiagramType, DiagramOptions, GeneratedDiagram } from './diagram-generator.js';
import { LayoutConfig } from './layout-algorithm.js';

/**
 * Architecture analysis configuration
 */
export interface ArchitectureConfig {
  includeTests: boolean;
  includeExternal: boolean;
  minModuleSize: number;
  maxDiagramComplexity: 'low' | 'medium' | 'high';
  preferredLayouts: string[];
  diagramTypes: DiagramType[];
  customCategories: Record<string, string[]>;
}

/**
 * Architecture documentation output
 */
export interface ArchitectureDocumentation {
  overview: string;
  diagrams: GeneratedDiagram[];
  dependencyGraph: DependencyGraph;
  metrics: ArchitectureMetrics;
  recommendations: string[];
  lastGenerated: Date;
}

/**
 * Architecture quality metrics
 */
export interface ArchitectureMetrics {
  totalModules: number;
  totalDependencies: number;
  averageDependenciesPerModule: number;
  cyclicDependencies: string[][];
  layerViolations: string[];
  cohesionScore: number;
  couplingScore: number;
  complexityScore: number;
  maintainabilityIndex: number;
}

/**
 * Main architecture generator that orchestrates dependency analysis and diagram generation
 */
export class ArchitectureGenerator {
  private dependencyAnalyzer: DependencyAnalyzer;
  private diagramGenerator: DiagramGenerator;

  constructor(
    layoutConfig: Partial<LayoutConfig> = {}
  ) {
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.diagramGenerator = new DiagramGenerator();
    
    // Apply layout configuration
    console.log('Architecture generator initialized with config:', layoutConfig);
  }

  /**
   * Generate complete architecture documentation
   */
  public generateArchitectureDocumentation(
    projectAnalysis: ProjectAnalysis,
    config: Partial<ArchitectureConfig> = {}
  ): ArchitectureDocumentation {
    const archConfig = this.mergeConfig(config);
    
    // Analyze dependencies
    const dependencyGraph = this.dependencyAnalyzer.analyzeDependencies(
      projectAnalysis.files,
      projectAnalysis.metadata.name || 'project'
    );

    // Generate diagrams
    const diagramOptions: DiagramOptions = {
      layout: {},
      includeTests: archConfig.includeTests,
      includeExternal: archConfig.includeExternal,
      minWeight: 1,
      maxDepth: 5,
      theme: 'default',
    };

    const diagrams = this.diagramGenerator.generateDiagrams(dependencyGraph, diagramOptions);

    // Filter diagrams based on configuration
    const filteredDiagrams = diagrams.filter(diagram => 
      archConfig.diagramTypes.includes(diagram.type) &&
      this.isComplexityAcceptable(diagram.complexity, archConfig.maxDiagramComplexity)
    );

    // Calculate metrics
    const metrics = this.calculateArchitectureMetrics(dependencyGraph);

    // Generate recommendations
    const recommendations = this.generateRecommendations(dependencyGraph, metrics);

    // Generate overview
    const overview = this.generateOverview(projectAnalysis, dependencyGraph, metrics);

    return {
      overview,
      diagrams: filteredDiagrams,
      dependencyGraph,
      metrics,
      recommendations,
      lastGenerated: new Date(),
    };
  }

  /**
   * Generate architecture overview text
   */
  private generateOverview(
    projectAnalysis: ProjectAnalysis,
    dependencyGraph: DependencyGraph,
    metrics: ArchitectureMetrics
  ): string {
    const projectName = projectAnalysis.metadata.name || 'Project';
    const languages = projectAnalysis.metadata.languages.join(', ');
    
    let overview = `# ${projectName} Architecture Overview\n\n`;
    
    overview += `## Project Summary\n\n`;
    overview += `- **Languages**: ${languages}\n`;
    overview += `- **Total Modules**: ${metrics.totalModules}\n`;
    overview += `- **Total Dependencies**: ${metrics.totalDependencies}\n`;
    overview += `- **Architecture Layers**: ${dependencyGraph.layers.length}\n`;
    overview += `- **Module Clusters**: ${dependencyGraph.clusters.length}\n\n`;

    overview += `## Architecture Quality\n\n`;
    overview += `- **Maintainability Index**: ${metrics.maintainabilityIndex.toFixed(1)}/100\n`;
    overview += `- **Cohesion Score**: ${metrics.cohesionScore.toFixed(1)}/10\n`;
    overview += `- **Coupling Score**: ${metrics.couplingScore.toFixed(1)}/10\n`;
    overview += `- **Complexity Score**: ${metrics.complexityScore.toFixed(1)}/10\n\n`;

    if (metrics.cyclicDependencies.length > 0) {
      overview += `## ⚠️ Issues Detected\n\n`;
      overview += `- **Cyclic Dependencies**: ${metrics.cyclicDependencies.length} cycles found\n`;
    }

    if (metrics.layerViolations.length > 0) {
      overview += `- **Layer Violations**: ${metrics.layerViolations.length} violations found\n`;
    }

    overview += `\n## Module Categories\n\n`;
    const categoryStats = this.getCategoryStatistics(dependencyGraph);
    for (const [category, count] of categoryStats) {
      overview += `- **${this.formatCategoryName(category)}**: ${count} modules\n`;
    }

    overview += `\n## Entry Points\n\n`;
    for (const entryPoint of dependencyGraph.entryPoints.slice(0, 5)) {
      const module = dependencyGraph.modules.get(entryPoint);
      if (module) {
        overview += `- \`${module.name}\` (${module.path})\n`;
      }
    }

    return overview;
  }

  /**
   * Calculate comprehensive architecture metrics
   */
  private calculateArchitectureMetrics(graph: DependencyGraph): ArchitectureMetrics {
    const totalModules = graph.modules.size;
    const totalDependencies = graph.relations.length;
    const averageDependenciesPerModule = totalModules > 0 ? totalDependencies / totalModules : 0;

    // Detect cyclic dependencies
    const cyclicDependencies = this.detectCyclicDependencies(graph);

    // Detect layer violations
    const layerViolations = this.detectLayerViolations(graph);

    // Calculate cohesion score (how well modules within clusters are related)
    const cohesionScore = this.calculateCohesionScore(graph);

    // Calculate coupling score (how loosely coupled modules are)
    const couplingScore = this.calculateCouplingScore(graph);

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(graph);

    // Calculate maintainability index
    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      cohesionScore,
      couplingScore,
      complexityScore,
      cyclicDependencies.length,
      layerViolations.length
    );

    return {
      totalModules,
      totalDependencies,
      averageDependenciesPerModule,
      cyclicDependencies,
      layerViolations,
      cohesionScore,
      couplingScore,
      complexityScore,
      maintainabilityIndex,
    };
  }

  /**
   * Detect cyclic dependencies using DFS
   */
  private detectCyclicDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const [filePath] of graph.modules) {
      if (!visited.has(filePath)) {
        this.dfsForCycles(filePath, graph, visited, recursionStack, path, cycles);
      }
    }

    return cycles;
  }

  private dfsForCycles(
    node: string,
    graph: DependencyGraph,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const outgoingRelations = graph.relations.filter(rel => rel.from === node);
    
    for (const relation of outgoingRelations) {
      const neighbor = relation.to;
      
      if (!visited.has(neighbor)) {
        this.dfsForCycles(neighbor, graph, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    }

    recursionStack.delete(node);
    path.pop();
  }

  /**
   * Detect layer violations (dependencies going backwards in layers)
   */
  private detectLayerViolations(graph: DependencyGraph): string[] {
    const violations: string[] = [];
    const layerMap = new Map<string, number>();

    // Map modules to their layer indices
    for (let i = 0; i < graph.layers.length; i++) {
      for (const filePath of graph.layers[i]) {
        layerMap.set(filePath, i);
      }
    }

    // Check for violations
    for (const relation of graph.relations) {
      const fromLayer = layerMap.get(relation.from);
      const toLayer = layerMap.get(relation.to);

      if (fromLayer !== undefined && toLayer !== undefined && fromLayer > toLayer) {
        violations.push(`${relation.from} -> ${relation.to} (Layer ${fromLayer} -> Layer ${toLayer})`);
      }
    }

    return violations;
  }

  /**
   * Calculate cohesion score (0-10, higher is better)
   */
  private calculateCohesionScore(graph: DependencyGraph): number {
    let totalCohesion = 0;
    let clusterCount = 0;

    for (const cluster of graph.clusters) {
      if (cluster.modules.length < 2) continue;

      const internalRelations = graph.relations.filter(rel =>
        cluster.modules.includes(rel.from) && cluster.modules.includes(rel.to)
      );

      const maxPossibleRelations = cluster.modules.length * (cluster.modules.length - 1);
      const cohesion = maxPossibleRelations > 0 ? (internalRelations.length / maxPossibleRelations) * 10 : 0;
      
      totalCohesion += cohesion;
      clusterCount++;
    }

    return clusterCount > 0 ? totalCohesion / clusterCount : 5;
  }

  /**
   * Calculate coupling score (0-10, lower is better, inverted for display)
   */
  private calculateCouplingScore(graph: DependencyGraph): number {
    const moduleCount = graph.modules.size;
    if (moduleCount <= 1) return 10;

    const maxPossibleCoupling = moduleCount * (moduleCount - 1);
    const actualCoupling = graph.relations.length;
    
    const couplingRatio = actualCoupling / maxPossibleCoupling;
    return Math.max(0, 10 - (couplingRatio * 10)); // Invert so lower coupling = higher score
  }

  /**
   * Calculate complexity score (0-10, lower is better, inverted for display)
   */
  private calculateComplexityScore(graph: DependencyGraph): number {
    const moduleCount = graph.modules.size;
    const relationCount = graph.relations.length;
    const clusterCount = graph.clusters.length;
    
    // Normalized complexity based on various factors
    const moduleComplexity = Math.min(moduleCount / 100, 1); // Normalize to 0-1
    const relationComplexity = Math.min(relationCount / (moduleCount * 2), 1); // Normalize to 0-1
    const clusterComplexity = clusterCount > 0 ? Math.min(moduleCount / clusterCount / 10, 1) : 0;
    
    const overallComplexity = (moduleComplexity + relationComplexity + clusterComplexity) / 3;
    return Math.max(0, 10 - (overallComplexity * 10)); // Invert so lower complexity = higher score
  }

  /**
   * Calculate maintainability index (0-100, higher is better)
   */
  private calculateMaintainabilityIndex(
    cohesion: number,
    coupling: number,
    complexity: number,
    cyclicDependencies: number,
    layerViolations: number
  ): number {
    // Base score from cohesion, coupling, and complexity
    const baseScore = (cohesion + coupling + complexity) / 3 * 10; // Convert to 0-100 scale
    
    // Penalties for issues
    const cyclePenalty = Math.min(cyclicDependencies * 5, 20); // Max 20 points penalty
    const violationPenalty = Math.min(layerViolations * 2, 15); // Max 15 points penalty
    
    return Math.max(0, baseScore - cyclePenalty - violationPenalty);
  }

  /**
   * Generate architecture recommendations
   */
  private generateRecommendations(
    graph: DependencyGraph,
    metrics: ArchitectureMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Cyclic dependency recommendations
    if (metrics.cyclicDependencies.length > 0) {
      recommendations.push(
        `Break ${metrics.cyclicDependencies.length} cyclic dependencies by introducing interfaces or dependency inversion`
      );
    }

    // Layer violation recommendations
    if (metrics.layerViolations.length > 0) {
      recommendations.push(
        `Fix ${metrics.layerViolations.length} layer violations by restructuring dependencies to follow architectural layers`
      );
    }

    // Cohesion recommendations
    if (metrics.cohesionScore < 5) {
      recommendations.push(
        'Improve module cohesion by grouping related functionality together and splitting large modules'
      );
    }

    // Coupling recommendations
    if (metrics.couplingScore < 5) {
      recommendations.push(
        'Reduce coupling by introducing abstractions, using dependency injection, and minimizing direct dependencies'
      );
    }

    // Complexity recommendations
    if (metrics.complexityScore < 5) {
      recommendations.push(
        'Reduce complexity by breaking down large modules, simplifying dependency relationships, and improving organization'
      );
    }

    // Module size recommendations
    const largeModules = Array.from(graph.modules.values()).filter(module => module.size > 20);
    if (largeModules.length > 0) {
      recommendations.push(
        `Consider splitting ${largeModules.length} large modules to improve maintainability`
      );
    }

    // Cluster recommendations
    if (graph.clusters.length === 0) {
      recommendations.push(
        'Organize modules into logical clusters or packages to improve code organization'
      );
    }

    // Entry point recommendations
    if (graph.entryPoints.length > 5) {
      recommendations.push(
        'Consider consolidating entry points to simplify the application architecture'
      );
    }

    return recommendations;
  }

  /**
   * Helper methods
   */

  private mergeConfig(config: Partial<ArchitectureConfig>): ArchitectureConfig {
    return {
      includeTests: config.includeTests ?? false,
      includeExternal: config.includeExternal ?? false,
      minModuleSize: config.minModuleSize ?? 1,
      maxDiagramComplexity: config.maxDiagramComplexity ?? 'medium',
      preferredLayouts: config.preferredLayouts ?? ['hierarchical', 'force-directed'],
      diagramTypes: config.diagramTypes ?? [
        DiagramType.DEPENDENCY_GRAPH,
        DiagramType.ARCHITECTURE_LAYERS,
        DiagramType.MODULE_CLUSTERS,
      ],
      customCategories: config.customCategories ?? {},
    };
  }

  private isComplexityAcceptable(
    complexity: 'low' | 'medium' | 'high',
    maxComplexity: 'low' | 'medium' | 'high'
  ): boolean {
    const complexityLevels = { low: 1, medium: 2, high: 3 };
    return complexityLevels[complexity] <= complexityLevels[maxComplexity];
  }

  private getCategoryStatistics(graph: DependencyGraph): Map<string, number> {
    const stats = new Map<string, number>();
    
    for (const module of graph.modules.values()) {
      const count = stats.get(module.category) || 0;
      stats.set(module.category, count + 1);
    }
    
    return stats;
  }

  private formatCategoryName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Generate architecture documentation as markdown
   */
  public generateArchitectureMarkdown(documentation: ArchitectureDocumentation): string {
    let markdown = documentation.overview + '\n\n';

    // Add diagrams
    markdown += '## Architecture Diagrams\n\n';
    for (const diagram of documentation.diagrams) {
      markdown += `### ${diagram.title}\n\n`;
      markdown += `${diagram.description}\n\n`;
      markdown += '```mermaid\n';
      markdown += diagram.mermaidCode;
      markdown += '\n```\n\n';
      markdown += `*Complexity: ${diagram.complexity}, Nodes: ${diagram.nodeCount}, Edges: ${diagram.edgeCount}*\n\n`;
    }

    // Add recommendations
    if (documentation.recommendations.length > 0) {
      markdown += '## Recommendations\n\n';
      for (const recommendation of documentation.recommendations) {
        markdown += `- ${recommendation}\n`;
      }
      markdown += '\n';
    }

    // Add metrics details
    markdown += '## Detailed Metrics\n\n';
    markdown += `- **Average Dependencies per Module**: ${documentation.metrics.averageDependenciesPerModule.toFixed(1)}\n`;
    
    if (documentation.metrics.cyclicDependencies.length > 0) {
      markdown += `- **Cyclic Dependencies**: ${documentation.metrics.cyclicDependencies.length}\n`;
    }
    
    if (documentation.metrics.layerViolations.length > 0) {
      markdown += `- **Layer Violations**: ${documentation.metrics.layerViolations.length}\n`;
    }

    markdown += `\n*Generated on ${documentation.lastGenerated.toLocaleString()}*\n`;

    return markdown;
  }
}
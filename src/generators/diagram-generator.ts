import { DependencyGraph, ModuleInfo, DependencyRelation, DependencyType, ModuleCluster } from '../analyzers/dependency-analyzer.js';

/**
 * Diagram types supported by the generator
 */
export enum DiagramType {
  DEPENDENCY_GRAPH = 'dependency_graph',
  ARCHITECTURE_LAYERS = 'architecture_layers',
  MODULE_CLUSTERS = 'module_clusters',
  COMPONENT_DIAGRAM = 'component_diagram',
  FLOW_DIAGRAM = 'flow_diagram',
}

/**
 * Diagram layout options
 */
export interface DiagramLayout {
  direction: 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
  rankSep: number;
  nodeSep: number;
  showLabels: boolean;
  showWeights: boolean;
  groupByCategory: boolean;
  maxNodesPerDiagram: number;
}

/**
 * Generated diagram information
 */
export interface GeneratedDiagram {
  type: DiagramType;
  title: string;
  mermaidCode: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Diagram generation options
 */
export interface DiagramOptions {
  layout: Partial<DiagramLayout>;
  includeTests: boolean;
  includeExternal: boolean;
  minWeight: number;
  maxDepth: number;
  focusModule?: string;
  theme: 'default' | 'dark' | 'forest' | 'neutral';
}

/**
 * Mermaid diagram generator for architecture visualization
 */
export class DiagramGenerator {
  private defaultLayout: DiagramLayout = {
    direction: 'TB',
    rankSep: 50,
    nodeSep: 30,
    showLabels: true,
    showWeights: false,
    groupByCategory: true,
    maxNodesPerDiagram: 50,
  };

  /**
   * Generate multiple diagrams from dependency graph
   */
  public generateDiagrams(
    dependencyGraph: DependencyGraph,
    options: Partial<DiagramOptions> = {}
  ): GeneratedDiagram[] {
    const diagrams: GeneratedDiagram[] = [];
    const opts = this.mergeOptions(options);

    // Generate dependency graph diagram
    diagrams.push(this.generateDependencyGraph(dependencyGraph, opts));

    // Generate architecture layers diagram
    diagrams.push(this.generateArchitectureLayers(dependencyGraph, opts));

    // Generate module clusters diagram
    if (dependencyGraph.clusters.length > 0) {
      diagrams.push(this.generateModuleClusters(dependencyGraph, opts));
    }

    // Generate component diagram for each major cluster
    for (const cluster of dependencyGraph.clusters) {
      if (cluster.modules.length >= 3 && cluster.modules.length <= 15) {
        diagrams.push(this.generateComponentDiagram(dependencyGraph, cluster, opts));
      }
    }

    // Generate flow diagram for entry points
    if (dependencyGraph.entryPoints.length > 0) {
      diagrams.push(this.generateFlowDiagram(dependencyGraph, opts));
    }

    return diagrams;
  }

  /**
   * Generate dependency graph diagram
   */
  private generateDependencyGraph(
    graph: DependencyGraph,
    options: DiagramOptions
  ): GeneratedDiagram {
    const layout = { ...this.defaultLayout, ...options.layout };
    let mermaidCode = `graph ${layout.direction}\n`;

    // Filter modules and relations
    const filteredModules = this.filterModules(graph.modules, options);
    const filteredRelations = this.filterRelations(graph.relations, filteredModules, options);

    // Add theme
    if (options.theme !== 'default') {
      mermaidCode += `    %%{init: {'theme':'${options.theme}'}}%%\n`;
    }

    // Add nodes
    for (const [, module] of filteredModules) {
      const nodeId = this.sanitizeId(module.id);
      const nodeLabel = this.createNodeLabel(module, layout.showLabels);
      const nodeStyle = this.getNodeStyle(module);
      
      mermaidCode += `    ${nodeId}[${nodeLabel}]\n`;
      if (nodeStyle) {
        mermaidCode += `    class ${nodeId} ${nodeStyle}\n`;
      }
    }

    // Add edges
    for (const relation of filteredRelations) {
      const fromId = this.sanitizeId(this.getModuleId(relation.from, graph.modules));
      const toId = this.sanitizeId(this.getModuleId(relation.to, graph.modules));
      const edgeStyle = this.getEdgeStyle(relation, layout.showWeights);
      
      mermaidCode += `    ${fromId} ${edgeStyle} ${toId}\n`;
    }

    // Add styling
    mermaidCode += this.generateStyling();

    return {
      type: DiagramType.DEPENDENCY_GRAPH,
      title: 'Project Dependency Graph',
      mermaidCode,
      description: 'Shows the dependency relationships between modules in the project',
      nodeCount: filteredModules.size,
      edgeCount: filteredRelations.length,
      complexity: this.calculateComplexity(filteredModules.size, filteredRelations.length),
    };
  }

  /**
   * Generate architecture layers diagram
   */
  private generateArchitectureLayers(
    graph: DependencyGraph,
    options: DiagramOptions
  ): GeneratedDiagram {
    const layout = { ...this.defaultLayout, ...options.layout };
    let mermaidCode = `graph ${layout.direction}\n`;

    // Add theme
    if (options.theme !== 'default') {
      mermaidCode += `    %%{init: {'theme':'${options.theme}'}}%%\n`;
    }

    // Create subgraphs for each layer
    for (let i = 0; i < graph.layers.length; i++) {
      const layer = graph.layers[i];
      const layerName = this.getLayerName(i, layer, graph.modules);
      
      mermaidCode += `    subgraph Layer${i}["${layerName}"]\n`;
      
      for (const filePath of layer) {
        const module = graph.modules.get(filePath);
        if (module && this.shouldIncludeModule(module, options)) {
          const nodeId = this.sanitizeId(module.id);
          const nodeLabel = this.createNodeLabel(module, layout.showLabels);
          
          mermaidCode += `        ${nodeId}[${nodeLabel}]\n`;
        }
      }
      
      mermaidCode += `    end\n`;
    }

    // Add inter-layer dependencies
    const filteredRelations = this.filterRelations(graph.relations, graph.modules, options);
    for (const relation of filteredRelations) {
      const fromId = this.sanitizeId(this.getModuleId(relation.from, graph.modules));
      const toId = this.sanitizeId(this.getModuleId(relation.to, graph.modules));
      const edgeStyle = this.getEdgeStyle(relation, false);
      
      mermaidCode += `    ${fromId} ${edgeStyle} ${toId}\n`;
    }

    // Add styling
    mermaidCode += this.generateStyling();

    return {
      type: DiagramType.ARCHITECTURE_LAYERS,
      title: 'Architecture Layers',
      mermaidCode,
      description: 'Shows the layered architecture of the project with dependencies between layers',
      nodeCount: Array.from(graph.modules.values()).filter(m => this.shouldIncludeModule(m, options)).length,
      edgeCount: filteredRelations.length,
      complexity: this.calculateComplexity(graph.layers.length * 5, filteredRelations.length),
    };
  }

  /**
   * Generate module clusters diagram
   */
  private generateModuleClusters(
    graph: DependencyGraph,
    options: DiagramOptions
  ): GeneratedDiagram {
    const layout = { ...this.defaultLayout, ...options.layout };
    let mermaidCode = `graph ${layout.direction}\n`;

    // Add theme
    if (options.theme !== 'default') {
      mermaidCode += `    %%{init: {'theme':'${options.theme}'}}%%\n`;
    }

    // Create subgraphs for each cluster
    for (const cluster of graph.clusters) {
      if (cluster.modules.length < 2) continue;
      
      const clusterId = this.sanitizeId(cluster.id);
      mermaidCode += `    subgraph ${clusterId}["${cluster.name}"]\n`;
      
      for (const filePath of cluster.modules) {
        const module = graph.modules.get(filePath);
        if (module && this.shouldIncludeModule(module, options)) {
          const nodeId = this.sanitizeId(module.id);
          const nodeLabel = this.createNodeLabel(module, layout.showLabels);
          
          mermaidCode += `        ${nodeId}[${nodeLabel}]\n`;
        }
      }
      
      mermaidCode += `    end\n`;
    }

    // Add inter-cluster dependencies
    const filteredRelations = this.filterRelations(graph.relations, graph.modules, options);
    for (const relation of filteredRelations) {
      const fromId = this.sanitizeId(this.getModuleId(relation.from, graph.modules));
      const toId = this.sanitizeId(this.getModuleId(relation.to, graph.modules));
      const edgeStyle = this.getEdgeStyle(relation, false);
      
      mermaidCode += `    ${fromId} ${edgeStyle} ${toId}\n`;
    }

    // Add styling
    mermaidCode += this.generateStyling();

    return {
      type: DiagramType.MODULE_CLUSTERS,
      title: 'Module Clusters',
      mermaidCode,
      description: 'Shows modules grouped by functionality and their relationships',
      nodeCount: graph.clusters.reduce((sum, cluster) => sum + cluster.modules.length, 0),
      edgeCount: filteredRelations.length,
      complexity: this.calculateComplexity(graph.clusters.length * 3, filteredRelations.length),
    };
  }

  /**
   * Generate component diagram for a specific cluster
   */
  private generateComponentDiagram(
    graph: DependencyGraph,
    cluster: ModuleCluster,
    options: DiagramOptions
  ): GeneratedDiagram {
    const layout = { ...this.defaultLayout, ...options.layout };
    let mermaidCode = `graph ${layout.direction}\n`;

    // Add theme
    if (options.theme !== 'default') {
      mermaidCode += `    %%{init: {'theme':'${options.theme}'}}%%\n`;
    }

    // Add cluster modules
    for (const filePath of cluster.modules) {
      const module = graph.modules.get(filePath);
      if (module && this.shouldIncludeModule(module, options)) {
        const nodeId = this.sanitizeId(module.id);
        const nodeLabel = this.createDetailedNodeLabel(module);
        const nodeStyle = this.getNodeStyle(module);
        
        mermaidCode += `    ${nodeId}[${nodeLabel}]\n`;
        if (nodeStyle) {
          mermaidCode += `    class ${nodeId} ${nodeStyle}\n`;
        }
      }
    }

    // Add internal relationships
    const clusterModules = new Set(cluster.modules);
    const internalRelations = graph.relations.filter(rel => 
      clusterModules.has(rel.from) && clusterModules.has(rel.to)
    );

    for (const relation of internalRelations) {
      const fromId = this.sanitizeId(this.getModuleId(relation.from, graph.modules));
      const toId = this.sanitizeId(this.getModuleId(relation.to, graph.modules));
      const edgeStyle = this.getEdgeStyle(relation, layout.showWeights);
      
      mermaidCode += `    ${fromId} ${edgeStyle} ${toId}\n`;
    }

    // Add styling
    mermaidCode += this.generateStyling();

    return {
      type: DiagramType.COMPONENT_DIAGRAM,
      title: `${cluster.name} Components`,
      mermaidCode,
      description: `Detailed view of components in the ${cluster.name} module`,
      nodeCount: cluster.modules.length,
      edgeCount: internalRelations.length,
      complexity: this.calculateComplexity(cluster.modules.length, internalRelations.length),
    };
  }

  /**
   * Generate flow diagram starting from entry points
   */
  private generateFlowDiagram(
    graph: DependencyGraph,
    options: DiagramOptions
  ): GeneratedDiagram {
    const layout = { ...this.defaultLayout, ...options.layout };
    let mermaidCode = `flowchart ${layout.direction}\n`;

    // Add theme
    if (options.theme !== 'default') {
      mermaidCode += `    %%{init: {'theme':'${options.theme}'}}%%\n`;
    }

    // Start from entry points and follow the flow
    const visited = new Set<string>();
    const flowNodes = new Set<string>();
    const flowEdges: DependencyRelation[] = [];

    for (const entryPoint of graph.entryPoints.slice(0, 3)) { // Limit to 3 entry points
      this.traverseFlow(entryPoint, graph, visited, flowNodes, flowEdges, 0, options.maxDepth || 4);
    }

    // Add nodes
    for (const filePath of flowNodes) {
      const module = graph.modules.get(filePath);
      if (module) {
        const nodeId = this.sanitizeId(module.id);
        const nodeShape = this.getFlowNodeShape(module);
        
        mermaidCode += `    ${nodeId}${nodeShape}\n`;
      }
    }

    // Add edges
    for (const relation of flowEdges) {
      const fromId = this.sanitizeId(this.getModuleId(relation.from, graph.modules));
      const toId = this.sanitizeId(this.getModuleId(relation.to, graph.modules));
      
      mermaidCode += `    ${fromId} --> ${toId}\n`;
    }

    // Add styling
    mermaidCode += this.generateStyling();

    return {
      type: DiagramType.FLOW_DIAGRAM,
      title: 'Application Flow',
      mermaidCode,
      description: 'Shows the flow of execution starting from entry points',
      nodeCount: flowNodes.size,
      edgeCount: flowEdges.length,
      complexity: this.calculateComplexity(flowNodes.size, flowEdges.length),
    };
  }

  /**
   * Helper methods
   */

  private mergeOptions(options: Partial<DiagramOptions>): DiagramOptions {
    const mergedOptions: DiagramOptions = {
      layout: { ...this.defaultLayout, ...options.layout },
      includeTests: options.includeTests ?? false,
      includeExternal: options.includeExternal ?? false,
      minWeight: options.minWeight ?? 1,
      maxDepth: options.maxDepth ?? 5,
      theme: options.theme ?? 'default',
    };

    if (options.focusModule) {
      mergedOptions.focusModule = options.focusModule;
    }

    return mergedOptions;
  }

  private filterModules(
    modules: Map<string, ModuleInfo>,
    options: DiagramOptions
  ): Map<string, ModuleInfo> {
    const filtered = new Map<string, ModuleInfo>();
    
    for (const [filePath, module] of modules) {
      if (this.shouldIncludeModule(module, options)) {
        filtered.set(filePath, module);
      }
    }
    
    return filtered;
  }

  private filterRelations(
    relations: DependencyRelation[],
    modules: Map<string, ModuleInfo>,
    options: DiagramOptions
  ): DependencyRelation[] {
    return relations.filter(relation => {
      // Check weight threshold
      if (relation.weight < options.minWeight) return false;
      
      // Check if both modules are included
      const fromModule = modules.get(relation.from);
      const toModule = modules.get(relation.to);
      
      if (!fromModule || !toModule) return false;
      
      return this.shouldIncludeModule(fromModule, options) && 
             this.shouldIncludeModule(toModule, options);
    });
  }

  private shouldIncludeModule(module: ModuleInfo, options: DiagramOptions): boolean {
    if (!options.includeTests && module.isTestFile) return false;
    if (options.focusModule && !module.path.includes(options.focusModule)) return false;
    return true;
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private createNodeLabel(module: ModuleInfo, showLabels: boolean): string {
    if (!showLabels) return `"${module.name}"`;
    
    const label = module.name;
    const typeIndicator = this.getTypeIndicator(module.type);
    return `"${typeIndicator} ${label}"`;
  }

  private createDetailedNodeLabel(module: ModuleInfo): string {
    const typeIndicator = this.getTypeIndicator(module.type);
    const sizeIndicator = module.size > 10 ? ' (Large)' : module.size > 5 ? ' (Medium)' : '';
    return `"${typeIndicator} ${module.name}${sizeIndicator}"`;
  }

  // private createFlowNodeLabel(module: ModuleInfo): string {
  //   return `"${module.name}"`;
  // }

  private getTypeIndicator(type: ModuleInfo['type']): string {
    switch (type) {
      case 'class': return '🏛️';
      case 'interface': return '📋';
      case 'function': return '⚡';
      case 'component': return '🧩';
      default: return '📄';
    }
  }

  private getNodeStyle(module: ModuleInfo): string | null {
    switch (module.category) {
      case 'core': return 'coreModule';
      case 'utils': return 'utilModule';
      case 'components': return 'componentModule';
      case 'services': return 'serviceModule';
      case 'test': return 'testModule';
      default: return null;
    }
  }

  private getEdgeStyle(relation: DependencyRelation, showWeights: boolean): string {
    const weight = showWeights ? `|${relation.weight}|` : '';
    
    switch (relation.type) {
      case DependencyType.IMPORT:
        return `-->${weight}`;
      case DependencyType.EXTENDS:
        return `-.${weight}.->`;
      case DependencyType.IMPLEMENTS:
        return `==${weight}==>`;
      case DependencyType.USES:
        return `--${weight}-->`;
      default:
        return `-->${weight}`;
    }
  }

  private getFlowNodeShape(module: ModuleInfo): string {
    if (module.isEntryPoint) return `["${module.name}"]`;
    if (module.type === 'class') return `("${module.name}")`;
    if (module.type === 'function') return `{"${module.name}"}`;
    return `["${module.name}"]`;
  }

  private getModuleId(filePath: string, modules: Map<string, ModuleInfo>): string {
    const module = modules.get(filePath);
    return module ? module.id : filePath.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private getLayerName(index: number, layer: string[], modules: Map<string, ModuleInfo>): string {
    // Use layer and modules info for more specific naming
    const layerSize = layer.length;
    const moduleCount = modules.size;
    
    if (index === 0) return `Entry Layer (${layerSize} modules)`;
    if (index === 1) return `Application Layer (${layerSize} modules)`;
    if (index === 2) return `Business Layer (${layerSize} modules)`;
    if (index === 3) return `Data Layer (${layerSize} modules)`;
    return `Layer ${index + 1} (${moduleCount} total modules)`;
  }

  private traverseFlow(
    filePath: string,
    graph: DependencyGraph,
    visited: Set<string>,
    flowNodes: Set<string>,
    flowEdges: DependencyRelation[],
    depth: number,
    maxDepth: number
  ): void {
    if (depth >= maxDepth || visited.has(filePath)) return;
    
    visited.add(filePath);
    flowNodes.add(filePath);
    
    // Find outgoing relations
    const outgoingRelations = graph.relations.filter(rel => 
      rel.from === filePath && rel.type === DependencyType.IMPORT
    );
    
    for (const relation of outgoingRelations.slice(0, 3)) { // Limit branching
      flowEdges.push(relation);
      this.traverseFlow(relation.to, graph, visited, flowNodes, flowEdges, depth + 1, maxDepth);
    }
  }

  private calculateComplexity(nodeCount: number, edgeCount: number): 'low' | 'medium' | 'high' {
    const totalElements = nodeCount + edgeCount;
    
    if (totalElements <= 20) return 'low';
    if (totalElements <= 50) return 'medium';
    return 'high';
  }

  private generateStyling(): string {
    return `
    classDef coreModule fill:#ff6b6b,stroke:#333,stroke-width:2px,color:#fff
    classDef utilModule fill:#4ecdc4,stroke:#333,stroke-width:2px,color:#fff
    classDef componentModule fill:#45b7d1,stroke:#333,stroke-width:2px,color:#fff
    classDef serviceModule fill:#f9ca24,stroke:#333,stroke-width:2px,color:#333
    classDef testModule fill:#6c5ce7,stroke:#333,stroke-width:2px,color:#fff
    `;
  }
}
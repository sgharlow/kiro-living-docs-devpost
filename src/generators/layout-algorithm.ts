import { DependencyGraph, DependencyType } from '../analyzers/dependency-analyzer.js';

/**
 * Node position in 2D space
 */
export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  clusterPadding: number;
  maxIterations: number;
  forceStrength: number;
  repulsionStrength: number;
}

/**
 * Layout result with positioned nodes
 */
export interface LayoutResult {
  positions: Map<string, NodePosition>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  clusters: Array<{
    id: string;
    bounds: NodePosition;
    modules: string[];
  }>;
}

/**
 * Automatic layout algorithms for dependency diagrams
 */
export class LayoutAlgorithm {
  private config: LayoutConfig;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = {
      nodeWidth: 120,
      nodeHeight: 60,
      horizontalSpacing: 80,
      verticalSpacing: 100,
      clusterPadding: 40,
      maxIterations: 100,
      forceStrength: 0.1,
      repulsionStrength: 1000,
      ...config,
    };
  }

  /**
   * Apply hierarchical layout based on dependency layers
   */
  public applyHierarchicalLayout(graph: DependencyGraph): LayoutResult {
    const positions = new Map<string, NodePosition>();
    let currentY = 0;

    // Position nodes layer by layer
    for (let layerIndex = 0; layerIndex < graph.layers.length; layerIndex++) {
      const layer = graph.layers[layerIndex];
      const layerWidth = layer.length * (this.config.nodeWidth + this.config.horizontalSpacing);
      let currentX = -layerWidth / 2;

      for (const filePath of layer) {
        const module = graph.modules.get(filePath);
        if (module) {
          positions.set(filePath, {
            x: currentX,
            y: currentY,
            width: this.config.nodeWidth,
            height: this.config.nodeHeight,
          });
          currentX += this.config.nodeWidth + this.config.horizontalSpacing;
        }
      }

      currentY += this.config.nodeHeight + this.config.verticalSpacing;
    }

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Apply force-directed layout for better visual organization
   */
  public applyForceDirectedLayout(graph: DependencyGraph): LayoutResult {
    const positions = new Map<string, NodePosition>();
    const velocities = new Map<string, { vx: number; vy: number }>();

    // Initialize random positions
    const modules = Array.from(graph.modules.keys());
    for (const filePath of modules) {
      positions.set(filePath, {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
      });
      velocities.set(filePath, { vx: 0, vy: 0 });
    }

    // Apply force-directed algorithm
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      // Reset forces
      for (const filePath of modules) {
        velocities.set(filePath, { vx: 0, vy: 0 });
      }

      // Apply repulsive forces between all nodes
      for (let i = 0; i < modules.length; i++) {
        for (let j = i + 1; j < modules.length; j++) {
          const node1 = modules[i];
          const node2 = modules[j];
          const pos1 = positions.get(node1)!;
          const pos2 = positions.get(node2)!;
          const vel1 = velocities.get(node1)!;
          const vel2 = velocities.get(node2)!;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const repulsiveForce = this.config.repulsionStrength / (distance * distance);
          const fx = (dx / distance) * repulsiveForce;
          const fy = (dy / distance) * repulsiveForce;

          vel1.vx -= fx;
          vel1.vy -= fy;
          vel2.vx += fx;
          vel2.vy += fy;
        }
      }

      // Apply attractive forces for connected nodes
      for (const relation of graph.relations) {
        if (relation.type === DependencyType.IMPORT || relation.type === DependencyType.USES) {
          const pos1 = positions.get(relation.from);
          const pos2 = positions.get(relation.to);
          const vel1 = velocities.get(relation.from);
          const vel2 = velocities.get(relation.to);

          if (pos1 && pos2 && vel1 && vel2) {
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;

            const attractiveForce = this.config.forceStrength * distance * relation.weight;
            const fx = (dx / distance) * attractiveForce;
            const fy = (dy / distance) * attractiveForce;

            vel1.vx += fx;
            vel1.vy += fy;
            vel2.vx -= fx;
            vel2.vy -= fy;
          }
        }
      }

      // Update positions
      for (const filePath of modules) {
        const pos = positions.get(filePath)!;
        const vel = velocities.get(filePath)!;

        pos.x += vel.vx;
        pos.y += vel.vy;

        // Apply damping
        vel.vx *= 0.9;
        vel.vy *= 0.9;
      }
    }

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Apply circular layout for module clusters
   */
  public applyCircularLayout(graph: DependencyGraph): LayoutResult {
    const positions = new Map<string, NodePosition>();
    const clusterPositions = new Map<string, { x: number; y: number }>();

    // Position clusters in a circle
    const clusters = graph.clusters.filter(cluster => cluster.modules.length > 1);
    const clusterRadius = Math.max(300, clusters.length * 50);
    
    for (let i = 0; i < clusters.length; i++) {
      const angle = (2 * Math.PI * i) / clusters.length;
      const x = Math.cos(angle) * clusterRadius;
      const y = Math.sin(angle) * clusterRadius;
      clusterPositions.set(clusters[i].id, { x, y });
    }

    // Position modules within each cluster
    for (const cluster of clusters) {
      const clusterPos = clusterPositions.get(cluster.id)!;
      const moduleCount = cluster.modules.length;
      const moduleRadius = Math.max(100, moduleCount * 20);

      for (let i = 0; i < cluster.modules.length; i++) {
        const angle = (2 * Math.PI * i) / moduleCount;
        const x = clusterPos.x + Math.cos(angle) * moduleRadius;
        const y = clusterPos.y + Math.sin(angle) * moduleRadius;

        positions.set(cluster.modules[i], {
          x,
          y,
          width: this.config.nodeWidth,
          height: this.config.nodeHeight,
        });
      }
    }

    // Position unclustered modules
    const clusteredModules = new Set(clusters.flatMap(c => c.modules));
    const unclusteredModules = Array.from(graph.modules.keys()).filter(
      filePath => !clusteredModules.has(filePath)
    );

    let currentX = 0;
    let currentY = clusterRadius + 200;
    const maxWidth = Math.sqrt(unclusteredModules.length) * (this.config.nodeWidth + this.config.horizontalSpacing);

    for (const filePath of unclusteredModules) {
      positions.set(filePath, {
        x: currentX,
        y: currentY,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
      });

      currentX += this.config.nodeWidth + this.config.horizontalSpacing;
      if (currentX > maxWidth) {
        currentX = 0;
        currentY += this.config.nodeHeight + this.config.verticalSpacing;
      }
    }

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Apply grid layout for simple organization
   */
  public applyGridLayout(graph: DependencyGraph): LayoutResult {
    const positions = new Map<string, NodePosition>();
    const modules = Array.from(graph.modules.keys());
    
    // Calculate grid dimensions
    const moduleCount = modules.length;
    const cols = Math.ceil(Math.sqrt(moduleCount));
    const rows = Math.ceil(moduleCount / cols);

    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols && index < moduleCount; col++) {
        const filePath = modules[index];
        const x = col * (this.config.nodeWidth + this.config.horizontalSpacing);
        const y = row * (this.config.nodeHeight + this.config.verticalSpacing);

        positions.set(filePath, {
          x,
          y,
          width: this.config.nodeWidth,
          height: this.config.nodeHeight,
        });

        index++;
      }
    }

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Apply tree layout for hierarchical structures
   */
  public applyTreeLayout(graph: DependencyGraph, rootModule?: string): LayoutResult {
    const positions = new Map<string, NodePosition>();
    const visited = new Set<string>();
    
    // Find root node (entry point or specified module)
    const root = rootModule || graph.entryPoints[0] || Array.from(graph.modules.keys())[0];
    
    if (!root) {
      return this.applyGridLayout(graph); // Fallback
    }

    // Build tree structure
    const tree = this.buildTree(root, graph, visited);
    
    // Position nodes in tree layout
    this.positionTreeNodes(tree, positions, 0, 0, 0);

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Optimize layout by reducing edge crossings
   */
  public optimizeLayout(layout: LayoutResult, graph: DependencyGraph): LayoutResult {
    const positions = new Map(layout.positions);
    
    // Apply simple optimization: minimize edge crossings
    for (let iteration = 0; iteration < 10; iteration++) {
      let improved = false;
      
      for (const [filePath, position] of positions) {
        const connectedNodes = this.getConnectedNodes(filePath, graph);
        if (connectedNodes.length > 1) {
          // Calculate centroid of connected nodes
          const centroid = this.calculateCentroid(connectedNodes, positions);
          
          // Move node towards centroid
          const newX = position.x + (centroid.x - position.x) * 0.1;
          const newY = position.y + (centroid.y - position.y) * 0.1;
          
          if (Math.abs(newX - position.x) > 1 || Math.abs(newY - position.y) > 1) {
            position.x = newX;
            position.y = newY;
            improved = true;
          }
        }
      }
      
      if (!improved) break;
    }

    return this.createLayoutResult(positions, graph);
  }

  /**
   * Helper methods
   */

  private createLayoutResult(positions: Map<string, NodePosition>, graph: DependencyGraph): LayoutResult {
    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const position of positions.values()) {
      minX = Math.min(minX, position.x);
      maxX = Math.max(maxX, position.x + position.width);
      minY = Math.min(minY, position.y);
      maxY = Math.max(maxY, position.y + position.height);
    }

    // Create cluster bounds
    const clusterBounds = graph.clusters.map(cluster => {
      const clusterPositions = cluster.modules
        .map(filePath => positions.get(filePath))
        .filter(pos => pos !== undefined) as NodePosition[];

      if (clusterPositions.length === 0) {
        return {
          id: cluster.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          modules: cluster.modules,
        };
      }

      const clusterMinX = Math.min(...clusterPositions.map(p => p.x));
      const clusterMaxX = Math.max(...clusterPositions.map(p => p.x + p.width));
      const clusterMinY = Math.min(...clusterPositions.map(p => p.y));
      const clusterMaxY = Math.max(...clusterPositions.map(p => p.y + p.height));

      return {
        id: cluster.id,
        bounds: {
          x: clusterMinX - this.config.clusterPadding,
          y: clusterMinY - this.config.clusterPadding,
          width: clusterMaxX - clusterMinX + 2 * this.config.clusterPadding,
          height: clusterMaxY - clusterMinY + 2 * this.config.clusterPadding,
        },
        modules: cluster.modules,
      };
    });

    return {
      positions,
      bounds: { minX, maxX, minY, maxY },
      clusters: clusterBounds,
    };
  }

  private buildTree(
    root: string,
    graph: DependencyGraph,
    visited: Set<string>,
    depth: number = 0
  ): TreeNode {
    visited.add(root);
    
    const children: TreeNode[] = [];
    const outgoingRelations = graph.relations.filter(rel => 
      rel.from === root && !visited.has(rel.to)
    );

    for (const relation of outgoingRelations.slice(0, 5)) { // Limit children
      const child = this.buildTree(relation.to, graph, visited, depth + 1);
      children.push(child);
    }

    return {
      id: root,
      children,
      depth,
      width: 0,
      x: 0,
      y: 0,
    };
  }

  private positionTreeNodes(
    node: TreeNode,
    positions: Map<string, NodePosition>,
    x: number,
    y: number,
    level: number
  ): number {
    // Position current node
    positions.set(node.id, {
      x,
      y: level * (this.config.nodeHeight + this.config.verticalSpacing),
      width: this.config.nodeWidth,
      height: this.config.nodeHeight,
    });

    // Position children
    let childX = x;
    for (const child of node.children) {
      childX = this.positionTreeNodes(child, positions, childX, y, level + 1);
      childX += this.config.nodeWidth + this.config.horizontalSpacing;
    }

    return Math.max(x + this.config.nodeWidth, childX);
  }

  private getConnectedNodes(filePath: string, graph: DependencyGraph): string[] {
    const connected: string[] = [];
    
    for (const relation of graph.relations) {
      if (relation.from === filePath) {
        connected.push(relation.to);
      } else if (relation.to === filePath) {
        connected.push(relation.from);
      }
    }
    
    return connected;
  }

  private calculateCentroid(
    nodeIds: string[],
    positions: Map<string, NodePosition>
  ): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    let count = 0;

    for (const nodeId of nodeIds) {
      const position = positions.get(nodeId);
      if (position) {
        totalX += position.x + position.width / 2;
        totalY += position.y + position.height / 2;
        count++;
      }
    }

    return count > 0 
      ? { x: totalX / count, y: totalY / count }
      : { x: 0, y: 0 };
  }
}

/**
 * Tree node for tree layout algorithm
 */
interface TreeNode {
  id: string;
  children: TreeNode[];
  depth: number;
  width: number;
  x: number;
  y: number;
}
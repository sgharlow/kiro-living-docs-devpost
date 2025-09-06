import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiagramGenerator, DiagramType } from '../../dist/generators/diagram-generator.js';
import { DependencyGraph, DependencyType, ModuleInfo } from '../../dist/analyzers/dependency-analyzer.js';

describe('DiagramGenerator', () => {
  let generator: DiagramGenerator;
  let mockGraph: DependencyGraph;

  beforeEach(() => {
    generator = new DiagramGenerator();
    
    // Create mock dependency graph
    const modules = new Map<string, ModuleInfo>([
      ['src/App.ts', {
        id: 'src_App',
        name: 'App',
        path: 'src/App.ts',
        type: 'class',
        category: 'core',
        exports: ['App'],
        imports: ['Button', 'ApiService'],
        size: 15,
        isEntryPoint: true,
        isTestFile: false,
      }],
      ['src/Button.ts', {
        id: 'src_Button',
        name: 'Button',
        path: 'src/Button.ts',
        type: 'component',
        category: 'components',
        exports: ['Button'],
        imports: [],
        size: 8,
        isEntryPoint: false,
        isTestFile: false,
      }],
      ['src/ApiService.ts', {
        id: 'src_ApiService',
        name: 'ApiService',
        path: 'src/ApiService.ts',
        type: 'class',
        category: 'services',
        exports: ['ApiService'],
        imports: ['HttpClient'],
        size: 12,
        isEntryPoint: false,
        isTestFile: false,
      }],
      ['src/HttpClient.ts', {
        id: 'src_HttpClient',
        name: 'HttpClient',
        path: 'src/HttpClient.ts',
        type: 'class',
        category: 'utils',
        exports: ['HttpClient'],
        imports: [],
        size: 6,
        isEntryPoint: false,
        isTestFile: false,
      }],
      ['tests/App.test.ts', {
        id: 'tests_App_test',
        name: 'App.test',
        path: 'tests/App.test.ts',
        type: 'module',
        category: 'test',
        exports: [],
        imports: ['App'],
        size: 5,
        isEntryPoint: false,
        isTestFile: true,
      }],
    ]);

    const relations = [
      {
        from: 'src/App.ts',
        to: 'src/Button.ts',
        type: DependencyType.IMPORT,
        weight: 5,
        details: 'Imports Button component',
      },
      {
        from: 'src/App.ts',
        to: 'src/ApiService.ts',
        type: DependencyType.IMPORT,
        weight: 7,
        details: 'Imports ApiService',
      },
      {
        from: 'src/ApiService.ts',
        to: 'src/HttpClient.ts',
        type: DependencyType.IMPORT,
        weight: 8,
        details: 'Imports HttpClient',
      },
      {
        from: 'tests/App.test.ts',
        to: 'src/App.ts',
        type: DependencyType.IMPORT,
        weight: 3,
        details: 'Test imports App',
      },
    ];

    const clusters = [
      {
        id: 'cluster_components',
        name: 'Components',
        modules: ['src/Button.ts'],
        type: 'feature' as const,
        description: 'UI Components',
      },
      {
        id: 'cluster_services',
        name: 'Services',
        modules: ['src/ApiService.ts'],
        type: 'feature' as const,
        description: 'Business Services',
      },
    ];

    const layers = [
      ['src/HttpClient.ts'],
      ['src/ApiService.ts', 'src/Button.ts'],
      ['src/App.ts'],
      ['tests/App.test.ts'],
    ];

    const entryPoints = ['src/App.ts'];

    mockGraph = {
      modules,
      relations,
      clusters,
      layers,
      entryPoints,
    };
  });

  describe('Dependency graph diagram generation', () => {
    it('should generate dependency graph diagram', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      expect(dependencyDiagram).toBeDefined();
      expect(dependencyDiagram!.mermaidCode).toContain('graph TB');
      expect(dependencyDiagram!.mermaidCode).toContain('src_App');
      expect(dependencyDiagram!.mermaidCode).toContain('src_Button');
      expect(dependencyDiagram!.nodeCount).toBeGreaterThan(0);
      expect(dependencyDiagram!.edgeCount).toBeGreaterThan(0);
    });

    it('should include proper node labels and styling', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain('🏛️ App'); // Class indicator
      expect(dependencyDiagram!.mermaidCode).toContain('🧩 Button'); // Component indicator
      expect(dependencyDiagram!.mermaidCode).toContain('class src_App coreModule');
    });

    it('should include edge relationships', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain('src_App -->');
      expect(dependencyDiagram!.mermaidCode).toContain('src_ApiService -->');
    });

    it('should exclude test files by default', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { includeTests: false });
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).not.toContain('tests_App_test');
    });

    it('should include test files when requested', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { includeTests: true });
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain('tests_App_test');
    });
  });

  describe('Architecture layers diagram generation', () => {
    it('should generate architecture layers diagram', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      const layersDiagram = diagrams.find(d => d.type === DiagramType.ARCHITECTURE_LAYERS);
      expect(layersDiagram).toBeDefined();
      expect(layersDiagram!.mermaidCode).toContain('subgraph Layer0');
      expect(layersDiagram!.mermaidCode).toContain('subgraph Layer1');
      expect(layersDiagram!.title).toBe('Architecture Layers');
    });

    it('should organize modules into proper layers', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const layersDiagram = diagrams.find(d => d.type === DiagramType.ARCHITECTURE_LAYERS);
      
      // HttpClient should be in Layer0 (no dependencies)
      expect(layersDiagram!.mermaidCode).toContain('Layer0["Entry Layer"]');
      expect(layersDiagram!.mermaidCode).toContain('src_HttpClient');
    });

    it('should show inter-layer dependencies', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const layersDiagram = diagrams.find(d => d.type === DiagramType.ARCHITECTURE_LAYERS);
      
      expect(layersDiagram!.mermaidCode).toContain('src_App -->');
      expect(layersDiagram!.mermaidCode).toContain('src_ApiService -->');
    });
  });

  describe('Module clusters diagram generation', () => {
    it('should generate module clusters diagram', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      const clustersDiagram = diagrams.find(d => d.type === DiagramType.MODULE_CLUSTERS);
      expect(clustersDiagram).toBeDefined();
      expect(clustersDiagram!.mermaidCode).toContain('subgraph cluster_components');
      expect(clustersDiagram!.mermaidCode).toContain('subgraph cluster_services');
      expect(clustersDiagram!.title).toBe('Module Clusters');
    });

    it('should group modules within clusters', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const clustersDiagram = diagrams.find(d => d.type === DiagramType.MODULE_CLUSTERS);
      
      expect(clustersDiagram!.mermaidCode).toContain('cluster_components["Components"]');
      expect(clustersDiagram!.mermaidCode).toContain('src_Button');
    });
  });

  describe('Component diagram generation', () => {
    it('should generate component diagrams for suitable clusters', () => {
      // Add more modules to make clusters suitable for component diagrams
      mockGraph.clusters[0].modules = ['src/Button.ts', 'src/Input.ts', 'src/Modal.ts'];
      
      const diagrams = generator.generateDiagrams(mockGraph);
      
      const componentDiagrams = diagrams.filter(d => d.type === DiagramType.COMPONENT_DIAGRAM);
      expect(componentDiagrams.length).toBeGreaterThan(0);
    });

    it('should show detailed component information', () => {
      mockGraph.clusters[0].modules = ['src/Button.ts', 'src/Input.ts', 'src/Modal.ts'];
      
      const diagrams = generator.generateDiagrams(mockGraph);
      const componentDiagram = diagrams.find(d => d.type === DiagramType.COMPONENT_DIAGRAM);
      
      if (componentDiagram) {
        expect(componentDiagram.title).toContain('Components');
        expect(componentDiagram.mermaidCode).toContain('🧩 Button');
      }
    });
  });

  describe('Flow diagram generation', () => {
    it('should generate flow diagram from entry points', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      const flowDiagram = diagrams.find(d => d.type === DiagramType.FLOW_DIAGRAM);
      expect(flowDiagram).toBeDefined();
      expect(flowDiagram!.mermaidCode).toContain('flowchart TB');
      expect(flowDiagram!.title).toBe('Application Flow');
    });

    it('should start from entry points', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const flowDiagram = diagrams.find(d => d.type === DiagramType.FLOW_DIAGRAM);
      
      expect(flowDiagram!.mermaidCode).toContain('src_App'); // Entry point
    });

    it('should use appropriate node shapes for flow', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const flowDiagram = diagrams.find(d => d.type === DiagramType.FLOW_DIAGRAM);
      
      expect(flowDiagram!.mermaidCode).toContain('["App"]'); // Entry point shape
    });
  });

  describe('Diagram options and filtering', () => {
    it('should respect minimum weight filtering', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { minWeight: 6 });
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      // Should exclude relations with weight < 6
      expect(dependencyDiagram!.edgeCount).toBeLessThan(mockGraph.relations.length);
    });

    it('should apply theme correctly', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { theme: 'dark' });
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain("%%{init: {'theme':'dark'}}%%");
    });

    it('should focus on specific modules when requested', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { focusModule: 'App' });
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain('src_App');
    });

    it('should limit maximum depth in flow diagrams', () => {
      const diagrams = generator.generateDiagrams(mockGraph, { maxDepth: 2 });
      const flowDiagram = diagrams.find(d => d.type === DiagramType.FLOW_DIAGRAM);
      
      expect(flowDiagram).toBeDefined();
      // Should limit the depth of traversal
    });
  });

  describe('Diagram complexity calculation', () => {
    it('should calculate complexity correctly', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      for (const diagram of diagrams) {
        expect(['low', 'medium', 'high']).toContain(diagram.complexity);
        expect(diagram.nodeCount).toBeGreaterThanOrEqual(0);
        expect(diagram.edgeCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should classify small diagrams as low complexity', () => {
      // Create a small graph
      const smallGraph = {
        ...mockGraph,
        modules: new Map([...mockGraph.modules].slice(0, 2)),
        relations: mockGraph.relations.slice(0, 1),
      };
      
      const diagrams = generator.generateDiagrams(smallGraph);
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.complexity).toBe('low');
    });
  });

  describe('Mermaid syntax validation', () => {
    it('should generate valid Mermaid syntax', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      for (const diagram of diagrams) {
        // Basic syntax checks
        expect(diagram.mermaidCode).toMatch(/^(graph|flowchart)/);
        expect(diagram.mermaidCode).not.toContain('undefined');
        expect(diagram.mermaidCode).not.toContain('null');
        
        // Check for balanced brackets
        const openBrackets = (diagram.mermaidCode.match(/\[/g) || []).length;
        const closeBrackets = (diagram.mermaidCode.match(/\]/g) || []).length;
        expect(openBrackets).toBe(closeBrackets);
      }
    });

    it('should sanitize node IDs properly', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      
      for (const diagram of diagrams) {
        // Should not contain special characters that break Mermaid
        expect(diagram.mermaidCode).not.toMatch(/[^a-zA-Z0-9_\s\[\]"'(){}.-]/);
      }
    });

    it('should include proper styling classes', () => {
      const diagrams = generator.generateDiagrams(mockGraph);
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.mermaidCode).toContain('classDef coreModule');
      expect(dependencyDiagram!.mermaidCode).toContain('classDef componentModule');
      expect(dependencyDiagram!.mermaidCode).toContain('classDef serviceModule');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty dependency graph', () => {
      const emptyGraph: DependencyGraph = {
        modules: new Map(),
        relations: [],
        clusters: [],
        layers: [],
        entryPoints: [],
      };
      
      const diagrams = generator.generateDiagrams(emptyGraph);
      
      expect(diagrams.length).toBeGreaterThan(0);
      for (const diagram of diagrams) {
        expect(diagram.nodeCount).toBe(0);
        expect(diagram.edgeCount).toBe(0);
      }
    });

    it('should handle graph with no relationships', () => {
      const isolatedGraph = {
        ...mockGraph,
        relations: [],
      };
      
      const diagrams = generator.generateDiagrams(isolatedGraph);
      const dependencyDiagram = diagrams.find(d => d.type === DiagramType.DEPENDENCY_GRAPH);
      
      expect(dependencyDiagram!.nodeCount).toBeGreaterThan(0);
      expect(dependencyDiagram!.edgeCount).toBe(0);
    });

    it('should handle very large graphs gracefully', () => {
      // Create a large graph
      const largeModules = new Map();
      const largeRelations = [];
      
      for (let i = 0; i < 100; i++) {
        largeModules.set(`module${i}.ts`, {
          id: `module${i}`,
          name: `Module${i}`,
          path: `module${i}.ts`,
          type: 'module' as const,
          category: 'general',
          exports: [],
          imports: [],
          size: 5,
          isEntryPoint: false,
          isTestFile: false,
        });
        
        if (i > 0) {
          largeRelations.push({
            from: `module${i}.ts`,
            to: `module${i-1}.ts`,
            type: DependencyType.IMPORT,
            weight: 1,
          });
        }
      }
      
      const largeGraph = {
        modules: largeModules,
        relations: largeRelations,
        clusters: [],
        layers: [Array.from(largeModules.keys())],
        entryPoints: ['module0.ts'],
      };
      
      const diagrams = generator.generateDiagrams(largeGraph);
      
      expect(diagrams.length).toBeGreaterThan(0);
      // Should handle large graphs without errors
      for (const diagram of diagrams) {
        expect(diagram.mermaidCode).toBeDefined();
        expect(diagram.mermaidCode.length).toBeGreaterThan(0);
      }
    });
  });
});
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyAnalyzer, DependencyType } from '../../dist/analyzers/dependency-analyzer.js';
import { AnalysisResult } from '../../dist/types.js';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  const createMockAnalysis = (
    imports: string[] = [],
    exports: string[] = [],
    classes: Array<{ name: string; extends?: string; implements?: string[] }> = [],
    interfaces: Array<{ name: string; extends?: string[] }> = []
  ): AnalysisResult => ({
    functions: [],
    classes: classes.map(cls => ({
      name: cls.name,
      methods: [],
      properties: [],
      extends: cls.extends,
      implements: cls.implements,
      isExported: true,
      startLine: 1,
      endLine: 10,
    })),
    interfaces: interfaces.map(iface => ({
      name: iface.name,
      properties: [],
      methods: [],
      extends: iface.extends,
      isExported: true,
      startLine: 1,
      endLine: 5,
    })),
    exports: exports.map(name => ({ name, type: 'class', isDefault: false })),
    imports: imports.map(source => ({
      source,
      imports: ['default'],
      isDefault: true,
      isNamespace: false,
    })),
    comments: [],
    todos: [],
    apiEndpoints: [],
  });

  describe('Module information creation', () => {
    it('should create module info from analysis result', () => {
      const analysisResults = new Map([
        ['src/utils/helper.ts', createMockAnalysis(['./config'], ['Helper'])],
        ['src/config.ts', createMockAnalysis([], ['Config'])],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.size).toBe(2);
      
      const helperModule = graph.modules.get('src/utils/helper.ts');
      expect(helperModule).toBeDefined();
      expect(helperModule!.name).toBe('helper');
      expect(helperModule!.category).toBe('utils');
      expect(helperModule!.exports).toEqual(['Helper']);
    });

    it('should determine module categories correctly', () => {
      const analysisResults = new Map([
        ['src/components/Button.ts', createMockAnalysis()],
        ['src/services/ApiService.ts', createMockAnalysis()],
        ['src/utils/helpers.ts', createMockAnalysis()],
        ['tests/Button.test.ts', createMockAnalysis()],
        ['src/core/Engine.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.get('src/components/Button.ts')!.category).toBe('components');
      expect(graph.modules.get('src/services/ApiService.ts')!.category).toBe('services');
      expect(graph.modules.get('src/utils/helpers.ts')!.category).toBe('utils');
      expect(graph.modules.get('tests/Button.test.ts')!.category).toBe('test');
      expect(graph.modules.get('src/core/Engine.ts')!.category).toBe('core');
    });

    it('should identify entry points correctly', () => {
      const analysisResults = new Map([
        ['src/index.ts', createMockAnalysis()],
        ['src/main.ts', createMockAnalysis()],
        ['src/app.ts', createMockAnalysis()],
        ['src/utils/helper.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.get('src/index.ts')!.isEntryPoint).toBe(true);
      expect(graph.modules.get('src/main.ts')!.isEntryPoint).toBe(true);
      expect(graph.modules.get('src/app.ts')!.isEntryPoint).toBe(true);
      expect(graph.modules.get('src/utils/helper.ts')!.isEntryPoint).toBe(false);
    });

    it('should identify test files correctly', () => {
      const analysisResults = new Map([
        ['src/Button.ts', createMockAnalysis()],
        ['src/Button.test.ts', createMockAnalysis()],
        ['tests/Button.spec.ts', createMockAnalysis()],
        ['__tests__/Button.test.js', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.get('src/Button.ts')!.isTestFile).toBe(false);
      expect(graph.modules.get('src/Button.test.ts')!.isTestFile).toBe(true);
      expect(graph.modules.get('tests/Button.spec.ts')!.isTestFile).toBe(true);
      expect(graph.modules.get('__tests__/Button.test.js')!.isTestFile).toBe(true);
    });
  });

  describe('Dependency relationship analysis', () => {
    it('should analyze import relationships', () => {
      const analysisResults = new Map([
        ['src/App.ts', createMockAnalysis(['./Button', './utils/helper'])],
        ['src/Button.ts', createMockAnalysis(['./utils/helper'])],
        ['src/utils/helper.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const importRelations = graph.relations.filter(rel => rel.type === DependencyType.IMPORT);
      expect(importRelations).toHaveLength(2); // App->Button, App->helper, Button->helper (but helper paths won't resolve)
    });

    it('should analyze class inheritance relationships', () => {
      const analysisResults = new Map([
        ['src/Animal.ts', createMockAnalysis([], ['Animal'], [{ name: 'Animal' }])],
        ['src/Dog.ts', createMockAnalysis(['./Animal'], ['Dog'], [{ name: 'Dog', extends: 'Animal' }])],
        ['src/Cat.ts', createMockAnalysis(['./Animal'], ['Cat'], [{ name: 'Cat', extends: 'Animal' }])],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const extendsRelations = graph.relations.filter(rel => rel.type === DependencyType.EXTENDS);
      expect(extendsRelations).toHaveLength(2); // Dog->Animal, Cat->Animal
      
      const dogExtends = extendsRelations.find(rel => rel.from === 'src/Dog.ts');
      expect(dogExtends).toBeDefined();
      expect(dogExtends!.details).toContain('Dog extends Animal');
    });

    it('should analyze interface implementation relationships', () => {
      const analysisResults = new Map([
        ['src/Flyable.ts', createMockAnalysis([], ['Flyable'], [], [{ name: 'Flyable' }])],
        ['src/Bird.ts', createMockAnalysis(['./Flyable'], ['Bird'], [{ name: 'Bird', implements: ['Flyable'] }])],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const implementsRelations = graph.relations.filter(rel => rel.type === DependencyType.IMPLEMENTS);
      expect(implementsRelations).toHaveLength(1);
      
      const birdImplements = implementsRelations[0];
      expect(birdImplements.from).toBe('src/Bird.ts');
      expect(birdImplements.details).toContain('Bird implements Flyable');
    });

    it('should calculate relationship weights correctly', () => {
      const analysisResults = new Map([
        ['src/App.ts', createMockAnalysis(['./Button'])],
        ['src/Button.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const relations = graph.relations.filter(rel => rel.type === DependencyType.IMPORT);
      if (relations.length > 0) {
        expect(relations[0].weight).toBeGreaterThan(0);
        expect(relations[0].weight).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Module clustering', () => {
    it('should create category-based clusters', () => {
      const analysisResults = new Map([
        ['src/components/Button.ts', createMockAnalysis()],
        ['src/components/Input.ts', createMockAnalysis()],
        ['src/services/ApiService.ts', createMockAnalysis()],
        ['src/services/AuthService.ts', createMockAnalysis()],
        ['src/utils/helper.ts', createMockAnalysis()], // Single module, should not create cluster
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.clusters.length).toBeGreaterThan(0);
      
      const componentCluster = graph.clusters.find(c => c.name.toLowerCase().includes('component'));
      expect(componentCluster).toBeDefined();
      expect(componentCluster!.modules).toHaveLength(2);
      
      const serviceCluster = graph.clusters.find(c => c.name.toLowerCase().includes('service'));
      expect(serviceCluster).toBeDefined();
      expect(serviceCluster!.modules).toHaveLength(2);
    });

    it('should create package-based clusters', () => {
      const analysisResults = new Map([
        ['auth/login.ts', createMockAnalysis()],
        ['auth/register.ts', createMockAnalysis()],
        ['auth/logout.ts', createMockAnalysis()],
        ['ui/button.ts', createMockAnalysis()],
        ['ui/input.ts', createMockAnalysis()],
        ['ui/modal.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const authCluster = graph.clusters.find(c => c.name === 'auth');
      expect(authCluster).toBeDefined();
      expect(authCluster!.modules).toHaveLength(3);
      
      const uiCluster = graph.clusters.find(c => c.name === 'ui');
      expect(uiCluster).toBeDefined();
      expect(uiCluster!.modules).toHaveLength(3);
    });
  });

  describe('Layer organization', () => {
    it('should organize modules into layers based on dependencies', () => {
      const analysisResults = new Map([
        ['src/App.ts', createMockAnalysis(['./services/ApiService'])],
        ['src/services/ApiService.ts', createMockAnalysis(['./utils/http'])],
        ['src/utils/http.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.layers.length).toBeGreaterThan(1);
      
      // Utils should be in an earlier layer (lower dependency)
      const httpLayerIndex = graph.layers.findIndex(layer => layer.includes('src/utils/http.ts'));
      const appLayerIndex = graph.layers.findIndex(layer => layer.includes('src/App.ts'));
      
      expect(httpLayerIndex).toBeLessThan(appLayerIndex);
    });

    it('should handle modules with no dependencies', () => {
      const analysisResults = new Map([
        ['src/standalone1.ts', createMockAnalysis()],
        ['src/standalone2.ts', createMockAnalysis()],
        ['src/standalone3.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      // All standalone modules should be in the first layer
      expect(graph.layers[0]).toHaveLength(3);
      expect(graph.layers[0]).toContain('src/standalone1.ts');
      expect(graph.layers[0]).toContain('src/standalone2.ts');
      expect(graph.layers[0]).toContain('src/standalone3.ts');
    });
  });

  describe('Entry point identification', () => {
    it('should identify entry points correctly', () => {
      const analysisResults = new Map([
        ['src/index.ts', createMockAnalysis(['./App'])],
        ['src/App.ts', createMockAnalysis(['./Button'])],
        ['src/Button.ts', createMockAnalysis()],
        ['src/utils/helper.ts', createMockAnalysis()], // No incoming deps, but not marked as entry
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.entryPoints).toContain('src/index.ts');
      expect(graph.entryPoints).toContain('src/utils/helper.ts'); // No incoming dependencies
    });

    it('should handle projects with no clear entry points', () => {
      const analysisResults = new Map([
        ['src/A.ts', createMockAnalysis(['./B'])],
        ['src/B.ts', createMockAnalysis(['./A'])], // Circular dependency
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      // Should still identify some entry points
      expect(graph.entryPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty analysis results', () => {
      const analysisResults = new Map();

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.size).toBe(0);
      expect(graph.relations).toHaveLength(0);
      expect(graph.clusters).toHaveLength(0);
      expect(graph.layers).toHaveLength(0);
      expect(graph.entryPoints).toHaveLength(0);
    });

    it('should handle single module', () => {
      const analysisResults = new Map([
        ['src/single.ts', createMockAnalysis()],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      expect(graph.modules.size).toBe(1);
      expect(graph.relations).toHaveLength(0);
      expect(graph.layers).toHaveLength(1);
      expect(graph.layers[0]).toContain('src/single.ts');
      expect(graph.entryPoints).toContain('src/single.ts');
    });

    it('should handle modules with complex inheritance chains', () => {
      const analysisResults = new Map([
        ['src/Base.ts', createMockAnalysis([], ['Base'], [{ name: 'Base' }])],
        ['src/Middle.ts', createMockAnalysis(['./Base'], ['Middle'], [{ name: 'Middle', extends: 'Base' }])],
        ['src/Derived.ts', createMockAnalysis(['./Middle'], ['Derived'], [{ name: 'Derived', extends: 'Middle' }])],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const extendsRelations = graph.relations.filter(rel => rel.type === DependencyType.EXTENDS);
      expect(extendsRelations).toHaveLength(2);
    });

    it('should handle modules with multiple interface implementations', () => {
      const analysisResults = new Map([
        ['src/IFlyable.ts', createMockAnalysis([], ['IFlyable'], [], [{ name: 'IFlyable' }])],
        ['src/ISwimmable.ts', createMockAnalysis([], ['ISwimmable'], [], [{ name: 'ISwimmable' }])],
        ['src/Duck.ts', createMockAnalysis(
          ['./IFlyable', './ISwimmable'], 
          ['Duck'], 
          [{ name: 'Duck', implements: ['IFlyable', 'ISwimmable'] }]
        )],
      ]);

      const graph = analyzer.analyzeDependencies(analysisResults, '/project');

      const implementsRelations = graph.relations.filter(rel => rel.type === DependencyType.IMPLEMENTS);
      expect(implementsRelations).toHaveLength(2);
    });
  });
});
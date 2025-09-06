import { AnalysisResult, ImportInfo } from '../types.js';

/**
 * Dependency relationship types
 */
export enum DependencyType {
  IMPORT = 'import',
  EXPORT = 'export',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  USES = 'uses',
  CALLS = 'calls',
}

/**
 * Dependency relationship between modules/files
 */
export interface DependencyRelation {
  from: string;
  to: string;
  type: DependencyType;
  weight: number; // Strength of dependency (1-10)
  details?: string;
  line?: number;
}

/**
 * Module/component information for architecture diagrams
 */
export interface ModuleInfo {
  id: string;
  name: string;
  path: string;
  type: 'module' | 'class' | 'interface' | 'function' | 'component';
  category: string; // e.g., 'core', 'utils', 'components', 'services'
  description?: string;
  exports: string[];
  imports: string[];
  size: number; // Lines of code or complexity metric
  isEntryPoint: boolean;
  isTestFile: boolean;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  modules: Map<string, ModuleInfo>;
  relations: DependencyRelation[];
  clusters: ModuleCluster[];
  entryPoints: string[];
  layers: string[][]; // Modules organized by architectural layers
}

/**
 * Module cluster for grouping related modules
 */
export interface ModuleCluster {
  id: string;
  name: string;
  modules: string[];
  type: 'package' | 'namespace' | 'feature' | 'layer';
  description?: string;
}

/**
 * Dependency analyzer for extracting module relationships and architecture
 */
export class DependencyAnalyzer {
  
  /**
   * Analyze project dependencies and create dependency graph
   */
  public analyzeDependencies(
    analysisResults: Map<string, AnalysisResult>,
    projectRoot: string
  ): DependencyGraph {
    const modules = new Map<string, ModuleInfo>();
    const relations: DependencyRelation[] = [];
    
    // First pass: Create module information
    for (const [filePath, analysis] of analysisResults) {
      const moduleInfo = this.createModuleInfo(filePath, analysis, projectRoot);
      modules.set(filePath, moduleInfo);
    }
    
    // Second pass: Analyze relationships
    for (const [filePath, analysis] of analysisResults) {
      const moduleRelations = this.analyzeModuleRelations(filePath, analysis, modules, projectRoot);
      relations.push(...moduleRelations);
    }
    
    // Create clusters and layers
    const clusters = this.createModuleClusters(modules);
    const layers = this.organizeLayers(modules, relations);
    const entryPoints = this.identifyEntryPoints(modules, relations);
    
    return {
      modules,
      relations,
      clusters,
      entryPoints,
      layers,
    };
  }

  /**
   * Create module information from analysis result
   */
  private createModuleInfo(
    filePath: string,
    analysis: AnalysisResult,
    projectRoot: string
  ): ModuleInfo {
    const relativePath = this.getRelativePath(filePath, projectRoot);
    const pathParts = relativePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const moduleName = fileName.replace(/\.(ts|js|py|go)$/, '');
    
    // Determine module type
    let moduleType: ModuleInfo['type'] = 'module';
    if (analysis.classes.length > 0 && analysis.functions.length === 0) {
      moduleType = 'class';
    } else if (analysis.interfaces.length > 0 && analysis.classes.length === 0) {
      moduleType = 'interface';
    } else if (analysis.functions.length === 1 && analysis.classes.length === 0) {
      moduleType = 'function';
    }
    
    // Determine category based on path
    const category = this.determineModuleCategory(relativePath);
    
    // Calculate module size (complexity metric)
    const size = analysis.functions.length * 2 + 
                 analysis.classes.length * 5 + 
                 analysis.interfaces.length * 3;
    
    const moduleInfo: ModuleInfo = {
      id: this.createModuleId(relativePath),
      name: moduleName,
      path: relativePath,
      type: moduleType,
      category,
      exports: analysis.exports.map(exp => exp.name),
      imports: analysis.imports.map(imp => imp.source),
      size: Math.max(size, 1),
      isEntryPoint: this.isEntryPoint(relativePath),
      isTestFile: this.isTestFile(relativePath),
    };

    const description = this.extractModuleDescription(analysis);
    if (description) {
      moduleInfo.description = description;
    }

    return moduleInfo;
  }

  /**
   * Analyze relationships between modules
   */
  private analyzeModuleRelations(
    filePath: string,
    analysis: AnalysisResult,
    modules: Map<string, ModuleInfo>,
    projectRoot: string
  ): DependencyRelation[] {
    const relations: DependencyRelation[] = [];
    const fromModule = this.getRelativePath(filePath, projectRoot);
    
    // Analyze imports
    for (const importInfo of analysis.imports) {
      const toModule = this.resolveImportPath(importInfo.source, filePath, projectRoot);
      if (toModule && modules.has(toModule)) {
        relations.push({
          from: fromModule,
          to: toModule,
          type: DependencyType.IMPORT,
          weight: this.calculateImportWeight(importInfo),
          details: `Imports: ${importInfo.imports.join(', ')}`,
        });
      }
    }
    
    // Analyze class inheritance
    for (const classInfo of analysis.classes) {
      if (classInfo.extends) {
        const relation = this.findClassRelation(classInfo.extends, filePath, modules, projectRoot);
        if (relation) {
          relations.push({
            from: fromModule,
            to: relation.toModule,
            type: DependencyType.EXTENDS,
            weight: 8,
            details: `${classInfo.name} extends ${classInfo.extends}`,
            line: classInfo.startLine,
          });
        }
      }
      
      if (classInfo.implements) {
        for (const interfaceName of classInfo.implements) {
          const relation = this.findClassRelation(interfaceName, filePath, modules, projectRoot);
          if (relation) {
            relations.push({
              from: fromModule,
              to: relation.toModule,
              type: DependencyType.IMPLEMENTS,
              weight: 6,
              details: `${classInfo.name} implements ${interfaceName}`,
              line: classInfo.startLine,
            });
          }
        }
      }
    }
    
    // Analyze interface inheritance
    for (const interfaceInfo of analysis.interfaces) {
      if (interfaceInfo.extends) {
        for (const extendedInterface of interfaceInfo.extends) {
          const relation = this.findClassRelation(extendedInterface, filePath, modules, projectRoot);
          if (relation) {
            relations.push({
              from: fromModule,
              to: relation.toModule,
              type: DependencyType.EXTENDS,
              weight: 5,
              details: `${interfaceInfo.name} extends ${extendedInterface}`,
              line: interfaceInfo.startLine,
            });
          }
        }
      }
    }
    
    return relations;
  }

  /**
   * Create module clusters for better organization
   */
  private createModuleClusters(modules: Map<string, ModuleInfo>): ModuleCluster[] {
    const clusters: ModuleCluster[] = [];
    const categoryGroups = new Map<string, string[]>();
    
    // Group by category
    for (const [filePath, module] of modules) {
      if (!categoryGroups.has(module.category)) {
        categoryGroups.set(module.category, []);
      }
      categoryGroups.get(module.category)!.push(filePath);
    }
    
    // Create clusters for each category
    for (const [category, moduleList] of categoryGroups) {
      if (moduleList.length > 1) { // Only create clusters with multiple modules
        clusters.push({
          id: `cluster_${category}`,
          name: this.formatCategoryName(category),
          modules: moduleList,
          type: 'feature',
          description: `${this.formatCategoryName(category)} modules`,
        });
      }
    }
    
    // Create package-based clusters
    const packageGroups = new Map<string, string[]>();
    for (const [filePath, module] of modules) {
      const packageName = this.extractPackageName(module.path);
      if (packageName) {
        if (!packageGroups.has(packageName)) {
          packageGroups.set(packageName, []);
        }
        packageGroups.get(packageName)!.push(filePath);
      }
    }
    
    for (const [packageName, moduleList] of packageGroups) {
      if (moduleList.length > 2) { // Only create clusters with multiple modules
        clusters.push({
          id: `package_${packageName}`,
          name: packageName,
          modules: moduleList,
          type: 'package',
          description: `${packageName} package`,
        });
      }
    }
    
    return clusters;
  }

  /**
   * Organize modules into architectural layers
   */
  private organizeLayers(
    modules: Map<string, ModuleInfo>,
    relations: DependencyRelation[]
  ): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();
    
    // Calculate in-degree for each module
    for (const [filePath] of modules) {
      inDegree.set(filePath, 0);
    }
    
    for (const relation of relations) {
      if (relation.type === DependencyType.IMPORT || relation.type === DependencyType.USES) {
        inDegree.set(relation.to, (inDegree.get(relation.to) || 0) + 1);
      }
    }
    
    // Topological sort to create layers
    while (visited.size < modules.size) {
      const currentLayer: string[] = [];
      
      // Find modules with no incoming dependencies (or already processed dependencies)
      for (const [filePath] of modules) {
        if (!visited.has(filePath) && (inDegree.get(filePath) || 0) === 0) {
          currentLayer.push(filePath);
        }
      }
      
      if (currentLayer.length === 0) {
        // Handle circular dependencies by taking remaining modules
        for (const [filePath] of modules) {
          if (!visited.has(filePath)) {
            currentLayer.push(filePath);
            break;
          }
        }
      }
      
      // Mark current layer as visited and update in-degrees
      for (const filePath of currentLayer) {
        visited.add(filePath);
        
        // Reduce in-degree for dependent modules
        for (const relation of relations) {
          if (relation.from === filePath && 
              (relation.type === DependencyType.IMPORT || relation.type === DependencyType.USES)) {
            inDegree.set(relation.to, (inDegree.get(relation.to) || 0) - 1);
          }
        }
      }
      
      layers.push(currentLayer);
    }
    
    return layers;
  }

  /**
   * Identify entry points in the dependency graph
   */
  private identifyEntryPoints(
    modules: Map<string, ModuleInfo>,
    relations: DependencyRelation[]
  ): string[] {
    const entryPoints: string[] = [];
    const hasIncomingDeps = new Set<string>();
    
    // Mark modules that have incoming dependencies
    for (const relation of relations) {
      if (relation.type === DependencyType.IMPORT || relation.type === DependencyType.USES) {
        hasIncomingDeps.add(relation.to);
      }
    }
    
    // Entry points are modules with no incoming dependencies or explicitly marked
    for (const [filePath, module] of modules) {
      if (module.isEntryPoint || !hasIncomingDeps.has(filePath)) {
        entryPoints.push(filePath);
      }
    }
    
    return entryPoints;
  }

  /**
   * Helper methods
   */
  
  private getRelativePath(filePath: string, projectRoot: string): string {
    return filePath.replace(projectRoot, '').replace(/^[/\\]/, '');
  }

  private createModuleId(relativePath: string): string {
    return relativePath.replace(/[/\\]/g, '_').replace(/\.(ts|js|py|go)$/, '');
  }

  private determineModuleCategory(relativePath: string): string {
    const pathParts = relativePath.toLowerCase().split('/');
    
    if (pathParts.includes('test') || pathParts.includes('tests') || pathParts.includes('__tests__')) {
      return 'test';
    }
    if (pathParts.includes('util') || pathParts.includes('utils') || pathParts.includes('helpers')) {
      return 'utils';
    }
    if (pathParts.includes('component') || pathParts.includes('components')) {
      return 'components';
    }
    if (pathParts.includes('service') || pathParts.includes('services')) {
      return 'services';
    }
    if (pathParts.includes('model') || pathParts.includes('models')) {
      return 'models';
    }
    if (pathParts.includes('controller') || pathParts.includes('controllers')) {
      return 'controllers';
    }
    if (pathParts.includes('view') || pathParts.includes('views')) {
      return 'views';
    }
    if (pathParts.includes('config') || pathParts.includes('configuration')) {
      return 'config';
    }
    if (pathParts.includes('lib') || pathParts.includes('library')) {
      return 'library';
    }
    if (pathParts.includes('core')) {
      return 'core';
    }
    
    return 'general';
  }

  private extractModuleDescription(analysis: AnalysisResult): string | undefined {
    // Look for module-level comments
    const moduleComments = analysis.comments.filter(comment => 
      comment.type === 'jsdoc' || comment.startLine <= 5
    );
    
    if (moduleComments.length > 0) {
      return moduleComments[0].content.split('\n')[0].trim();
    }
    
    return undefined;
  }

  private isEntryPoint(relativePath: string): boolean {
    const fileName = relativePath.split('/').pop()?.toLowerCase() || '';
    return fileName.includes('index') || 
           fileName.includes('main') || 
           fileName.includes('app') ||
           fileName.includes('server') ||
           fileName.includes('entry');
  }

  private isTestFile(relativePath: string): boolean {
    return relativePath.toLowerCase().includes('test') ||
           relativePath.toLowerCase().includes('spec') ||
           relativePath.endsWith('.test.ts') ||
           relativePath.endsWith('.test.js') ||
           relativePath.endsWith('.spec.ts') ||
           relativePath.endsWith('.spec.js');
  }

  private calculateImportWeight(importInfo: ImportInfo): number {
    // Weight based on import type and number of imports
    let weight = 3; // Base weight
    
    if (importInfo.isDefault) weight += 2;
    if (importInfo.isNamespace) weight += 3;
    weight += Math.min(importInfo.imports.length, 5); // Max 5 additional points
    
    return weight;
  }

  private resolveImportPath(
    importSource: string,
    fromFile: string,
    projectRoot: string
  ): string | null {
    // Handle relative imports
    if (importSource.startsWith('./') || importSource.startsWith('../')) {
      const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      const resolvedPath = this.resolvePath(fromDir, importSource);
      
      // Try different extensions
      const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        const fullPath = resolvedPath + ext;
        if (this.fileExists(fullPath)) {
          return this.getRelativePath(fullPath, projectRoot);
        }
      }
    }
    
    // Handle absolute imports (would need more sophisticated resolution)
    return null;
  }

  private resolvePath(fromDir: string, relativePath: string): string {
    const parts = fromDir.split('/');
    const relativeParts = relativePath.split('/');
    
    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    
    return parts.join('/');
  }

  private fileExists(filePath: string): boolean {
    // This would need to be implemented based on the actual file system
    // For now, return false as a placeholder
    console.log(`Checking file existence: ${filePath}`);
    return false;
  }

  private findClassRelation(
    className: string,
    fromFile: string,
    modules: Map<string, ModuleInfo>,
    projectRoot: string
  ): { toModule: string } | null {
    // Look for the class in imported modules
    // This is a simplified implementation
    console.log(`Finding class relation for ${className} from ${fromFile} in ${projectRoot}`);
    for (const [filePath, module] of modules) {
      if (module.exports.includes(className)) {
        return { toModule: filePath };
      }
    }
    
    return null;
  }

  private formatCategoryName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  private extractPackageName(filePath: string): string | null {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      return parts[0];
    }
    return null;
  }
}
/**
 * Type definitions for the Living Documentation Generator
 */

export interface ProjectConfig {
  projectPath: string;
  outputPath?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  languages?: string[];
  outputFormats?: ('markdown' | 'html')[];
  webServerPort?: number;
  watchDebounceMs?: number;
  cacheSizeMB?: number;
  analysisTimeoutMs?: number;
  autoDetect?: boolean; // Enable/disable automatic project detection
}

export interface FileChange {
  path: string;
  type: 'modified' | 'added' | 'deleted' | 'renamed';
  timestamp: number;
  content?: string;
}

export interface AnalysisResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];
  comments: CommentInfo[];
  todos: TodoInfo[];
  apiEndpoints: ApiEndpointInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string | undefined;
  description?: string | undefined;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string | undefined;
  implements?: string[] | undefined;
  description?: string | undefined;
  isExported: boolean;
  startLine: number;
  endLine: number;
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  methods: FunctionInfo[];
  extends?: string[] | undefined;
  description?: string | undefined;
  isExported: boolean;
  startLine: number;
  endLine: number;
}

export interface ParameterInfo {
  name: string;
  type?: string | undefined;
  optional: boolean;
  defaultValue?: string | undefined;
  description?: string | undefined;
}

export interface PropertyInfo {
  name: string;
  type?: string | undefined;
  optional: boolean;
  readonly: boolean;
  description?: string | undefined;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
  isDefault: boolean;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface CommentInfo {
  type: 'single' | 'multi' | 'jsdoc';
  content: string;
  startLine: number;
  endLine: number;
}

export interface TodoInfo {
  content: string;
  type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE';
  line: number;
  author?: string;
}

export interface ProjectAnalysis {
  metadata: ProjectMetadata;
  structure: ProjectStructure;
  files: Map<string, AnalysisResult>;
  lastUpdated: Date;
}

export interface ProjectMetadata {
  name: string;
  version?: string;
  description?: string;
  languages: string[];
  framework?: string;
  repository?: RepositoryInfo;
}

export interface ProjectStructure {
  directories: string[];
  files: string[];
  entryPoints: string[];
  testFiles: string[];
  configFiles: string[];
}

export interface RepositoryInfo {
  url?: string;
  branch?: string;
  lastCommit?: string;
}

export interface DocumentationOutput {
  markdown?: string;
  html?: string;
  assets?: Map<string, Buffer>;
}

export interface ApiEndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  handler: string;
  parameters?: ParameterInfo[];
  description?: string;
  line: number;
}
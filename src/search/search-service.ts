/**
 * Comprehensive Search Service for Living Documentation
 * Provides full-text search, symbol search, and advanced filtering capabilities
 */

import { ProjectAnalysis, AnalysisResult, FunctionInfo, ClassInfo, InterfaceInfo } from '../types.js';

export interface SearchQuery {
  query: string;
  type?: SearchType;
  language?: string;
  file?: string;
  scope?: SearchScope;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export type SearchType = 'all' | 'symbol' | 'content' | 'function' | 'class' | 'interface' | 'api' | 'comment';
export type SearchScope = 'all' | 'current-file' | 'current-directory';

export interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  description?: string | undefined;
  file: string;
  line: number;
  column?: number | undefined;
  snippet: string;
  highlights: SearchHighlight[];
  score: number;
  context?: SearchContext | undefined;
}

export interface SearchHighlight {
  start: number;
  end: number;
  type: 'match' | 'context';
}

export interface SearchContext {
  before: string;
  after: string;
  parentSymbol?: string;
  parentType?: string;
}

export interface SearchIndex {
  symbols: Map<string, SymbolIndexEntry>;
  content: Map<string, ContentIndexEntry>;
  files: Map<string, FileIndexEntry>;
  ngrams: Map<string, Set<string>>;
}

export interface SymbolIndexEntry {
  id: string;
  name: string;
  type: SearchType;
  file: string;
  line: number;
  description?: string | undefined;
  signature?: string | undefined;
  parent?: string | undefined;
  keywords: string[];
  usageCount: number;
}

export interface ContentIndexEntry {
  id: string;
  file: string;
  line: number;
  content: string;
  type: 'comment' | 'documentation' | 'string';
  context?: string | undefined;
}

export interface FileIndexEntry {
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  lastModified: Date;
  symbolCount: number;
}

export interface SearchHistory {
  queries: SearchHistoryEntry[];
  maxEntries: number;
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount: number;
  filters?: Partial<SearchQuery> | undefined;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  created: Date;
  lastUsed: Date;
  useCount: number;
}

export class SearchService {
  private index: SearchIndex;
  private analysis: ProjectAnalysis | null = null;
  private history: SearchHistory;
  private savedSearches: Map<string, SavedSearch> = new Map();
  private readonly maxHistoryEntries = 100;
  private readonly ngramSize = 3;

  constructor() {
    this.index = {
      symbols: new Map(),
      content: new Map(),
      files: new Map(),
      ngrams: new Map()
    };
    this.history = {
      queries: [],
      maxEntries: this.maxHistoryEntries
    };
    this.loadPersistedData();
  }

  /**
   * Update the search index with new project analysis
   */
  public updateIndex(analysis: ProjectAnalysis): void {
    this.analysis = analysis;
    this.rebuildIndex();
  }

  /**
   * Perform a comprehensive search
   */
  public search(query: SearchQuery): SearchResult[] {
    if (!query.query.trim() || !this.analysis) {
      return [];
    }

    this.addToHistory(query);

    const results: SearchResult[] = [];

    // Symbol search
    if (!query.type || query.type === 'all' || this.isSymbolType(query.type)) {
      results.push(...this.searchSymbols(query));
    }

    // Content search
    if (!query.type || query.type === 'all' || query.type === 'content') {
      results.push(...this.searchContent(query));
    }

    // Rank and deduplicate results
    const rankedResults = this.rankResults(results, query);
    const deduplicatedResults = this.deduplicateResults(rankedResults);

    return deduplicatedResults.slice(0, 50); // Limit to top 50 results
  }

  /**
   * Get search suggestions based on partial query
   */
  public getSuggestions(partialQuery: string, limit: number = 10): string[] {
    const suggestions = new Set<string>();
    const query = partialQuery.toLowerCase();

    // Symbol name suggestions
    for (const [name] of this.index.symbols) {
      if (name.toLowerCase().startsWith(query)) {
        suggestions.add(name);
      }
    }

    // N-gram suggestions
    const ngrams = this.generateNgrams(query);
    for (const ngram of ngrams) {
      const matches = this.index.ngrams.get(ngram);
      if (matches) {
        for (const match of matches) {
          if (suggestions.size < limit) {
            suggestions.add(match);
          }
        }
      }
    }

    // History suggestions
    for (const entry of this.history.queries) {
      if (entry.query.toLowerCase().includes(query)) {
        suggestions.add(entry.query);
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get search history
   */
  public getHistory(): SearchHistoryEntry[] {
    return [...this.history.queries].reverse(); // Most recent first
  }

  /**
   * Clear search history
   */
  public clearHistory(): void {
    this.history.queries = [];
    this.persistHistory();
  }

  /**
   * Save a search for later use
   */
  public saveSearch(name: string, query: SearchQuery): string {
    const id = this.generateId();
    const savedSearch: SavedSearch = {
      id,
      name,
      query,
      created: new Date(),
      lastUsed: new Date(),
      useCount: 0
    };

    this.savedSearches.set(id, savedSearch);
    this.persistSavedSearches();
    return id;
  }

  /**
   * Get saved searches
   */
  public getSavedSearches(): SavedSearch[] {
    return Array.from(this.savedSearches.values())
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }

  /**
   * Execute a saved search
   */
  public executeSavedSearch(id: string): SearchResult[] {
    const savedSearch = this.savedSearches.get(id);
    if (!savedSearch) {
      throw new Error(`Saved search with id ${id} not found`);
    }

    savedSearch.lastUsed = new Date();
    savedSearch.useCount++;
    this.persistSavedSearches();

    return this.search(savedSearch.query);
  }

  /**
   * Delete a saved search
   */
  public deleteSavedSearch(id: string): void {
    this.savedSearches.delete(id);
    this.persistSavedSearches();
  }

  /**
   * Get search statistics
   */
  public getStatistics() {
    return {
      totalSymbols: this.index.symbols.size,
      totalContent: this.index.content.size,
      totalFiles: this.index.files.size,
      historyEntries: this.history.queries.length,
      savedSearches: this.savedSearches.size,
      indexSize: this.calculateIndexSize()
    };
  }

  private rebuildIndex(): void {
    if (!this.analysis) return;

    // Clear existing index
    this.index.symbols.clear();
    this.index.content.clear();
    this.index.files.clear();
    this.index.ngrams.clear();

    // Index files and symbols
    for (const [filePath, fileAnalysis] of this.analysis.files) {
      this.indexFile(filePath, fileAnalysis);
    }

    console.log(`Search index rebuilt: ${this.index.symbols.size} symbols, ${this.index.content.size} content entries`);
  }

  private indexFile(filePath: string, analysis: AnalysisResult): void {
    const fileInfo = this.getFileInfo(filePath);
    
    // Index file metadata
    this.index.files.set(filePath, {
      path: filePath,
      name: fileInfo.name,
      extension: fileInfo.extension,
      language: fileInfo.language,
      size: 0, // Would need file system access to get actual size
      lastModified: new Date(),
      symbolCount: analysis.functions.length + analysis.classes.length + analysis.interfaces.length
    });

    // Index functions
    for (const func of analysis.functions) {
      this.indexSymbol(filePath, func, 'function');
    }

    // Index classes
    for (const cls of analysis.classes) {
      this.indexSymbol(filePath, cls, 'class');
      
      // Index class methods
      for (const method of cls.methods) {
        this.indexSymbol(filePath, method, 'function', cls.name);
      }
    }

    // Index interfaces
    for (const iface of analysis.interfaces) {
      this.indexSymbol(filePath, iface, 'interface');
      
      // Index interface methods
      for (const method of iface.methods) {
        this.indexSymbol(filePath, method, 'function', iface.name);
      }
    }

    // Index API endpoints
    for (const endpoint of analysis.apiEndpoints) {
      this.indexApiEndpoint(filePath, endpoint);
    }

    // Index comments and documentation
    for (const comment of analysis.comments) {
      this.indexContent(filePath, comment.content, comment.startLine, 'comment');
    }

    // Index TODOs
    for (const todo of analysis.todos) {
      this.indexContent(filePath, todo.content, todo.line, 'comment', `${todo.type} item`);
    }
  }

  private indexSymbol(
    filePath: string, 
    symbol: FunctionInfo | ClassInfo | InterfaceInfo, 
    type: SearchType,
    parent?: string
  ): void {
    const id = this.generateId();
    const keywords = this.generateKeywords(symbol.name, symbol.description, type);
    
    const entry: SymbolIndexEntry = {
      id,
      name: symbol.name,
      type,
      file: filePath,
      line: symbol.startLine,
      description: symbol.description,
      signature: this.generateSignature(symbol, type),
      parent,
      keywords,
      usageCount: 0 // Would need usage analysis to populate
    };

    this.index.symbols.set(symbol.name.toLowerCase(), entry);
    
    // Add to n-gram index
    const ngrams = this.generateNgrams(symbol.name);
    for (const ngram of ngrams) {
      if (!this.index.ngrams.has(ngram)) {
        this.index.ngrams.set(ngram, new Set());
      }
      this.index.ngrams.get(ngram)!.add(symbol.name);
    }
  }

  private indexApiEndpoint(filePath: string, endpoint: any): void {
    const id = this.generateId();
    const name = `${endpoint.method} ${endpoint.path}`;
    const keywords = this.generateKeywords(name, endpoint.description, 'api');
    
    const entry: SymbolIndexEntry = {
      id,
      name,
      type: 'api',
      file: filePath,
      line: endpoint.line,
      description: endpoint.description,
      signature: `${endpoint.method} ${endpoint.path}`,
      keywords,
      usageCount: 0
    };

    this.index.symbols.set(name.toLowerCase(), entry);
  }

  private indexContent(
    filePath: string, 
    content: string, 
    line: number, 
    type: 'comment' | 'documentation' | 'string',
    context?: string
  ): void {
    const id = this.generateId();
    
    const entry: ContentIndexEntry = {
      id,
      file: filePath,
      line,
      content: content.trim(),
      type,
      context
    };

    this.index.content.set(id, entry);
  }

  private searchSymbols(query: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const searchTerm = query.caseSensitive ? query.query : query.query.toLowerCase();

    for (const [, entry] of this.index.symbols) {
      if (this.matchesTypeFilter(entry.type, query.type) &&
          this.matchesFileFilter(entry.file, query.file) &&
          this.matchesLanguageFilter(entry.file, query.language)) {
        
        const score = this.calculateSymbolScore(entry, searchTerm, query);
        if (score > 0) {
          results.push(this.createSymbolResult(entry, searchTerm, score, query));
        }
      }
    }

    return results;
  }

  private searchContent(query: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const searchTerm = query.caseSensitive ? query.query : query.query.toLowerCase();

    for (const [, entry] of this.index.content) {
      if (this.matchesFileFilter(entry.file, query.file) &&
          this.matchesLanguageFilter(entry.file, query.language)) {
        
        const content = query.caseSensitive ? entry.content : entry.content.toLowerCase();
        const score = this.calculateContentScore(content, searchTerm, query);
        
        if (score > 0) {
          results.push(this.createContentResult(entry, searchTerm, score, query));
        }
      }
    }

    return results;
  }

  private calculateSymbolScore(entry: SymbolIndexEntry, searchTerm: string, query: SearchQuery): number {
    const name = query.caseSensitive ? entry.name : entry.name.toLowerCase();
    const description = query.caseSensitive ? (entry.description || '') : (entry.description || '').toLowerCase();
    
    let score = 0;

    // Exact match gets highest score
    if (name === searchTerm) {
      score += 100;
    }
    // Starts with search term
    else if (name.startsWith(searchTerm)) {
      score += 80;
    }
    // Contains search term
    else if (name.includes(searchTerm)) {
      score += 60;
    }
    // Fuzzy match
    else {
      const fuzzyScore = this.calculateFuzzyScore(name, searchTerm);
      if (fuzzyScore > 0.5) {
        score += fuzzyScore * 40;
      }
    }

    // Description match
    if (description.includes(searchTerm)) {
      score += 20;
    }

    // Boost based on symbol type preference
    if (query.type === entry.type) {
      score *= 1.2;
    }

    // Boost based on usage (if available)
    score += Math.min(entry.usageCount * 0.1, 10);

    return score;
  }

  private calculateContentScore(content: string, searchTerm: string, query: SearchQuery): number {
    if (!content.includes(searchTerm)) {
      return 0;
    }

    let score = 30; // Base score for content match

    // Multiple occurrences
    const occurrences = (content.match(new RegExp(searchTerm, 'g')) || []).length;
    score += Math.min(occurrences * 5, 20);

    // Whole word match
    if (query.wholeWord) {
      const wordRegex = new RegExp(`\\b${searchTerm}\\b`, query.caseSensitive ? 'g' : 'gi');
      if (wordRegex.test(content)) {
        score += 15;
      }
    }

    return score;
  }

  private calculateFuzzyScore(text: string, pattern: string): number {
    if (pattern.length === 0) return 1;
    if (text.length === 0) return 0;

    let score = 0;
    let patternIndex = 0;

    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (text[i] === pattern[patternIndex]) {
        score++;
        patternIndex++;
      }
    }

    return score / pattern.length;
  }

  private createSymbolResult(entry: SymbolIndexEntry, searchTerm: string, score: number, query: SearchQuery): SearchResult {
    const highlights = this.findHighlights(entry.name, searchTerm, query.caseSensitive || false);
    
    return {
      id: entry.id,
      type: entry.type,
      title: entry.name,
      description: entry.description,
      file: entry.file,
      line: entry.line,
      snippet: entry.signature || entry.name,
      highlights,
      score,
      context: entry.parent ? {
        before: '',
        after: '',
        parentSymbol: entry.parent,
        parentType: 'class'
      } : undefined
    };
  }

  private createContentResult(entry: ContentIndexEntry, searchTerm: string, score: number, query: SearchQuery): SearchResult {
    const snippet = this.createSnippet(entry.content, searchTerm, 100);
    const highlights = this.findHighlights(snippet, searchTerm, query.caseSensitive || false);
    
    return {
      id: entry.id,
      type: 'content',
      title: entry.context || 'Content match',
      description: snippet,
      file: entry.file,
      line: entry.line,
      snippet,
      highlights,
      score
    };
  }

  private createSnippet(content: string, searchTerm: string, maxLength: number): string {
    const index = content.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) return content.substring(0, maxLength);

    const start = Math.max(0, index - maxLength / 2);
    const end = Math.min(content.length, start + maxLength);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  private findHighlights(text: string, searchTerm: string, caseSensitive: boolean): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const searchText = caseSensitive ? text : text.toLowerCase();
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    let index = 0;
    while ((index = searchText.indexOf(term, index)) !== -1) {
      highlights.push({
        start: index,
        end: index + term.length,
        type: 'match'
      });
      index += term.length;
    }
    
    return highlights;
  }

  private rankResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results.sort((a, b) => {
      // Primary sort by score
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      
      // Consider query type for secondary sorting
      if (query.type === 'function' && a.type === 'function' && b.type !== 'function') {
        return -1;
      }
      
      // Secondary sort by type preference
      const typeOrder = ['function', 'class', 'interface', 'api', 'content'];
      const aTypeIndex = typeOrder.indexOf(a.type);
      const bTypeIndex = typeOrder.indexOf(b.type);
      
      if (aTypeIndex !== bTypeIndex) {
        return aTypeIndex - bTypeIndex;
      }
      
      // Tertiary sort by name length (shorter names first)
      return a.title.length - b.title.length;
    });
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.file}:${result.line}:${result.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private generateKeywords(name: string, description?: string, type?: string): string[] {
    const keywords = new Set<string>();
    
    // Add name variations
    keywords.add(name.toLowerCase());
    keywords.add(name);
    
    // Add camelCase parts
    const camelParts = name.split(/(?=[A-Z])/).filter(part => part.length > 0);
    camelParts.forEach(part => keywords.add(part.toLowerCase()));
    
    // Add snake_case parts
    const snakeParts = name.split('_').filter(part => part.length > 0);
    snakeParts.forEach(part => keywords.add(part.toLowerCase()));
    
    // Add description words
    if (description) {
      const words = description.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(word => keywords.add(word));
    }
    
    // Add type
    if (type) {
      keywords.add(type);
    }
    
    return Array.from(keywords);
  }

  private generateSignature(symbol: FunctionInfo | ClassInfo | InterfaceInfo, type: SearchType): string {
    if (type === 'function' && 'parameters' in symbol) {
      const params = symbol.parameters.map(p => 
        `${p.name}${p.optional ? '?' : ''}${p.type ? `: ${p.type}` : ''}`
      ).join(', ');
      return `${symbol.name}(${params})${symbol.returnType ? `: ${symbol.returnType}` : ''}`;
    }
    
    if (type === 'class') {
      const cls = symbol as ClassInfo;
      let sig = `class ${cls.name}`;
      if (cls.extends) sig += ` extends ${cls.extends}`;
      if (cls.implements && cls.implements.length > 0) {
        sig += ` implements ${cls.implements.join(', ')}`;
      }
      return sig;
    }
    
    if (type === 'interface') {
      const iface = symbol as InterfaceInfo;
      let sig = `interface ${iface.name}`;
      if (iface.extends && iface.extends.length > 0) {
        sig += ` extends ${iface.extends.join(', ')}`;
      }
      return sig;
    }
    
    return symbol.name;
  }

  private generateNgrams(text: string): string[] {
    const ngrams: string[] = [];
    const normalized = text.toLowerCase();
    
    for (let i = 0; i <= normalized.length - this.ngramSize; i++) {
      ngrams.push(normalized.substring(i, i + this.ngramSize));
    }
    
    return ngrams;
  }

  private getFileInfo(filePath: string) {
    const parts = filePath.split('/');
    const name = parts[parts.length - 1];
    const extension = name.includes('.') ? name.split('.').pop() || '' : '';
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'rs': 'rust'
    };
    
    return {
      name,
      extension,
      language: languageMap[extension] || 'text'
    };
  }

  private isSymbolType(type: SearchType): boolean {
    return ['symbol', 'function', 'class', 'interface', 'api'].includes(type);
  }

  private matchesTypeFilter(entryType: SearchType, filterType?: SearchType): boolean {
    if (!filterType || filterType === 'all') return true;
    return entryType === filterType;
  }

  private matchesFileFilter(filePath: string, fileFilter?: string): boolean {
    if (!fileFilter) return true;
    return filePath.includes(fileFilter);
  }

  private matchesLanguageFilter(filePath: string, languageFilter?: string): boolean {
    if (!languageFilter) return true;
    const fileInfo = this.getFileInfo(filePath);
    return fileInfo.language === languageFilter;
  }

  private addToHistory(query: SearchQuery): void {
    const entry: SearchHistoryEntry = {
      query: query.query,
      timestamp: new Date(),
      resultCount: 0, // Will be updated after search
      filters: (() => {
        const filters: Partial<SearchQuery> = {};
        if (query.type) filters.type = query.type;
        if (query.language) filters.language = query.language;
        if (query.file) filters.file = query.file;
        return Object.keys(filters).length > 0 ? filters : undefined;
      })()
    };

    // Remove duplicate if exists
    this.history.queries = this.history.queries.filter(h => h.query !== query.query);
    
    // Add to beginning
    this.history.queries.unshift(entry);
    
    // Limit size
    if (this.history.queries.length > this.maxHistoryEntries) {
      this.history.queries = this.history.queries.slice(0, this.maxHistoryEntries);
    }
    
    this.persistHistory();
  }

  private loadPersistedData(): void {
    try {
      // Load history
      const historyData = localStorage.getItem('search-history');
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.history.queries = parsed.queries.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
      }

      // Load saved searches
      const savedData = localStorage.getItem('saved-searches');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        for (const [id, search] of Object.entries(parsed)) {
          const savedSearch = search as any;
          this.savedSearches.set(id, {
            ...savedSearch,
            created: new Date(savedSearch.created),
            lastUsed: new Date(savedSearch.lastUsed)
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted search data:', error);
    }
  }

  private persistHistory(): void {
    try {
      localStorage.setItem('search-history', JSON.stringify(this.history));
    } catch (error) {
      console.warn('Failed to persist search history:', error);
    }
  }

  private persistSavedSearches(): void {
    try {
      const data = Object.fromEntries(this.savedSearches);
      localStorage.setItem('saved-searches', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist saved searches:', error);
    }
  }

  private calculateIndexSize(): number {
    // Rough estimate of index size in bytes
    let size = 0;
    
    for (const entry of this.index.symbols.values()) {
      size += JSON.stringify(entry).length;
    }
    
    for (const entry of this.index.content.values()) {
      size += JSON.stringify(entry).length;
    }
    
    return size;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
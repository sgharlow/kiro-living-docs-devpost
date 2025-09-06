/**
 * Advanced Search UI Component
 * Provides comprehensive search interface with keyboard shortcuts, filters, and history
 */

import { SearchService, SearchQuery, SearchResult, SearchType } from './search-service.js';

export interface SearchUIConfig {
  container: HTMLElement;
  placeholder?: string;
  showFilters?: boolean;
  showHistory?: boolean;
  showSavedSearches?: boolean;
  maxResults?: number;
  debounceMs?: number;
}

export interface KeyboardShortcuts {
  search: string;
  nextResult: string;
  prevResult: string;
  selectResult: string;
  clearSearch: string;
  toggleFilters: string;
  saveSearch: string;
}

export class SearchUI {
  private searchService: SearchService;
  private config: SearchUIConfig;
  // private shortcuts!: KeyboardShortcuts; // TODO: Implement keyboard shortcuts
  
  private container: HTMLElement;
  private searchInput!: HTMLInputElement;
  private filtersContainer!: HTMLElement;
  private resultsContainer!: HTMLElement;
  private historyContainer!: HTMLElement;
  private savedSearchesContainer!: HTMLElement;
  
  private currentResults: SearchResult[] = [];
  private selectedResultIndex = -1;
  private isFiltersVisible = false;
  private searchTimeout: number | null = null;
  
  private currentQuery: SearchQuery = { query: '' };

  constructor(searchService: SearchService, config: SearchUIConfig) {
    this.searchService = searchService;
    this.config = {
      placeholder: 'Search documentation...',
      showFilters: true,
      showHistory: true,
      showSavedSearches: true,
      maxResults: 50,
      debounceMs: 300,
      ...config
    };
    
    // TODO: Implement keyboard shortcuts
    /*
    const shortcuts = {
      search: 'Ctrl+K',
      nextResult: 'ArrowDown',
      prevResult: 'ArrowUp',
      selectResult: 'Enter',
      clearSearch: 'Escape',
      toggleFilters: 'Ctrl+Shift+F',
      saveSearch: 'Ctrl+S'
    };
    */
    
    this.container = config.container;
    this.init();
  }

  private init(): void {
    this.createSearchInterface();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.loadSavedSearches();
  }

  private createSearchInterface(): void {
    this.container.innerHTML = `
      <div class="advanced-search-container">
        <!-- Search Input -->
        <div class="search-input-section">
          <div class="search-input-wrapper">
            <input 
              type="text" 
              class="search-input" 
              placeholder="${this.config.placeholder}"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search documentation"
            >
            <div class="search-input-actions">
              <button class="search-clear-btn" title="Clear search (Esc)" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
                </svg>
              </button>
              <button class="search-filters-toggle" title="Toggle filters (Ctrl+Shift+F)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </button>
              <div class="search-shortcut-hint">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
              </div>
            </div>
          </div>
          
          <!-- Search Suggestions -->
          <div class="search-suggestions" style="display: none;">
            <div class="suggestions-list"></div>
          </div>
        </div>

        <!-- Search Filters -->
        <div class="search-filters" style="display: none;">
          <div class="filters-row">
            <div class="filter-group">
              <label class="filter-label">Type:</label>
              <select class="filter-select" name="type">
                <option value="">All Types</option>
                <option value="function">Functions</option>
                <option value="class">Classes</option>
                <option value="interface">Interfaces</option>
                <option value="api">API Endpoints</option>
                <option value="content">Content</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">Language:</label>
              <select class="filter-select" name="language">
                <option value="">All Languages</option>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="go">Go</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">File:</label>
              <input type="text" class="filter-input" name="file" placeholder="Filter by file path">
            </div>
          </div>
          
          <div class="filters-row">
            <div class="filter-options">
              <label class="filter-checkbox">
                <input type="checkbox" name="caseSensitive">
                <span>Case sensitive</span>
              </label>
              <label class="filter-checkbox">
                <input type="checkbox" name="wholeWord">
                <span>Whole word</span>
              </label>
              <label class="filter-checkbox">
                <input type="checkbox" name="regex">
                <span>Regular expression</span>
              </label>
            </div>
            
            <div class="filter-actions">
              <button class="btn btn-secondary clear-filters-btn">Clear Filters</button>
              <button class="btn btn-primary save-search-btn">Save Search</button>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div class="search-results-section">
          <div class="search-results-header" style="display: none;">
            <div class="results-info">
              <span class="results-count">0 results</span>
              <span class="search-time"></span>
            </div>
            <div class="results-actions">
              <button class="btn btn-sm export-results-btn">Export</button>
            </div>
          </div>
          
          <div class="search-results-container">
            <!-- Results will be populated here -->
          </div>
          
          <div class="search-no-results" style="display: none;">
            <div class="no-results-content">
              <div class="no-results-icon">🔍</div>
              <h3>No results found</h3>
              <p>Try adjusting your search terms or filters</p>
              <div class="search-suggestions-help">
                <h4>Search tips:</h4>
                <ul>
                  <li>Use specific function or class names</li>
                  <li>Try partial matches (e.g., "user" for "getUserData")</li>
                  <li>Use filters to narrow down results</li>
                  <li>Check spelling and try synonyms</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Search History -->
        <div class="search-history-section" style="display: none;">
          <div class="history-header">
            <h4>Recent Searches</h4>
            <button class="btn btn-sm clear-history-btn">Clear History</button>
          </div>
          <div class="history-list">
            <!-- History items will be populated here -->
          </div>
        </div>

        <!-- Saved Searches -->
        <div class="saved-searches-section" style="display: none;">
          <div class="saved-header">
            <h4>Saved Searches</h4>
          </div>
          <div class="saved-list">
            <!-- Saved searches will be populated here -->
          </div>
        </div>
      </div>
    `;

    // Get references to key elements
    this.searchInput = this.container.querySelector('.search-input') as HTMLInputElement;
    this.filtersContainer = this.container.querySelector('.search-filters') as HTMLElement;
    this.resultsContainer = this.container.querySelector('.search-results-container') as HTMLElement;
    this.historyContainer = this.container.querySelector('.search-history-section') as HTMLElement;
    this.savedSearchesContainer = this.container.querySelector('.saved-searches-section') as HTMLElement;
  }

  private setupEventListeners(): void {
    // Search input events
    this.searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.handleSearchInput(query);
    });

    this.searchInput.addEventListener('focus', () => {
      this.showSearchInterface();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      this.handleSearchKeydown(e);
    });

    // Clear button
    const clearBtn = this.container.querySelector('.search-clear-btn') as HTMLElement;
    clearBtn.addEventListener('click', () => {
      this.clearSearch();
    });

    // Filters toggle
    const filtersToggle = this.container.querySelector('.search-filters-toggle') as HTMLElement;
    filtersToggle.addEventListener('click', () => {
      this.toggleFilters();
    });

    // Filter changes
    const filterElements = this.container.querySelectorAll('.filter-select, .filter-input, input[type="checkbox"]');
    filterElements.forEach(element => {
      element.addEventListener('change', () => {
        this.updateFilters();
        this.performSearch();
      });
    });

    // Clear filters
    const clearFiltersBtn = this.container.querySelector('.clear-filters-btn') as HTMLElement;
    clearFiltersBtn.addEventListener('click', () => {
      this.clearFilters();
    });

    // Save search
    const saveSearchBtn = this.container.querySelector('.save-search-btn') as HTMLElement;
    saveSearchBtn.addEventListener('click', () => {
      this.showSaveSearchDialog();
    });

    // Clear history
    const clearHistoryBtn = this.container.querySelector('.clear-history-btn') as HTMLElement;
    clearHistoryBtn.addEventListener('click', () => {
      this.clearHistory();
    });

    // Export results
    const exportBtn = this.container.querySelector('.export-results-btn') as HTMLElement;
    exportBtn.addEventListener('click', () => {
      this.exportResults();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.hideSearchInterface();
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Global search shortcut (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusSearch();
        return;
      }

      // Only handle other shortcuts when search is focused
      if (!this.isSearchFocused()) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.clearSearch();
          break;

        case 'ArrowDown':
          e.preventDefault();
          this.selectNextResult();
          break;

        case 'ArrowUp':
          e.preventDefault();
          this.selectPreviousResult();
          break;

        case 'Enter':
          e.preventDefault();
          this.activateSelectedResult();
          break;

        case 'Tab':
          if (e.shiftKey) {
            e.preventDefault();
            this.selectPreviousResult();
          } else {
            e.preventDefault();
            this.selectNextResult();
          }
          break;
      }

      // Filter toggle shortcut (Ctrl+Shift+F)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.toggleFilters();
      }

      // Save search shortcut (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.showSaveSearchDialog();
      }
    });
  }

  private handleSearchInput(query: string): void {
    this.currentQuery.query = query;
    
    // Show/hide clear button
    const clearBtn = this.container.querySelector('.search-clear-btn') as HTMLElement;
    clearBtn.style.display = query ? 'block' : 'none';

    // Debounce search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.trim()) {
      this.searchTimeout = window.setTimeout(() => {
        this.performSearch();
      }, this.config.debounceMs);
      
      // Show suggestions for partial queries
      if (query.length >= 2) {
        this.showSuggestions(query);
      }
    } else {
      this.clearResults();
      this.hideSuggestions();
      this.showHistory();
    }
  }

  private handleSearchKeydown(e: KeyboardEvent): void {
    // Handle special keys that shouldn't trigger search
    const specialKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
    if (specialKeys.includes(e.key)) {
      return; // Let the global handler deal with these
    }
  }

  private performSearch(): void {
    const startTime = performance.now();
    
    try {
      this.currentResults = this.searchService.search(this.currentQuery);
      const endTime = performance.now();
      
      this.displayResults(this.currentResults);
      this.updateResultsInfo(this.currentResults.length, endTime - startTime);
      this.selectedResultIndex = -1;
      
    } catch (error) {
      console.error('Search error:', error);
      this.showSearchError(error as Error);
    }
  }

  private displayResults(results: SearchResult[]): void {
    const container = this.resultsContainer;
    const header = this.container.querySelector('.search-results-header') as HTMLElement;
    const noResults = this.container.querySelector('.search-no-results') as HTMLElement;

    if (results.length === 0) {
      container.innerHTML = '';
      header.style.display = 'none';
      noResults.style.display = 'block';
      return;
    }

    header.style.display = 'flex';
    noResults.style.display = 'none';

    const html = results.map((result, index) => this.createResultHTML(result, index)).join('');
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.search-result').forEach((element, index) => {
      element.addEventListener('click', () => {
        this.activateResult(results[index]);
      });
      
      element.addEventListener('mouseenter', () => {
        this.selectResult(index);
      });
    });
  }

  private createResultHTML(result: SearchResult, index: number): string {
    const typeIcon = this.getTypeIcon(result.type);
    const highlightedTitle = this.highlightMatches(result.title, result.highlights);
    const highlightedSnippet = this.highlightMatches(result.snippet, result.highlights);
    
    return `
      <div class="search-result" data-index="${index}">
        <div class="result-icon">
          ${typeIcon}
        </div>
        <div class="result-content">
          <div class="result-header">
            <div class="result-title">${highlightedTitle}</div>
            <div class="result-type">${result.type}</div>
          </div>
          <div class="result-snippet">${highlightedSnippet}</div>
          <div class="result-meta">
            <span class="result-file">${this.formatFilePath(result.file)}</span>
            <span class="result-line">Line ${result.line}</span>
            ${result.context?.parentSymbol ? `<span class="result-parent">in ${result.context.parentSymbol}</span>` : ''}
          </div>
        </div>
        <div class="result-actions">
          <button class="result-action-btn" title="Go to definition" data-action="goto">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
              <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private highlightMatches(text: string, highlights: any[]): string {
    if (!highlights || highlights.length === 0) return text;
    
    let result = '';
    let lastIndex = 0;
    
    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
    
    for (const highlight of sortedHighlights) {
      // Add text before highlight
      result += text.substring(lastIndex, highlight.start);
      
      // Add highlighted text
      const highlightedText = text.substring(highlight.start, highlight.end);
      result += `<mark class="search-highlight">${highlightedText}</mark>`;
      
      lastIndex = highlight.end;
    }
    
    // Add remaining text
    result += text.substring(lastIndex);
    
    return result;
  }

  private getTypeIcon(type: SearchType): string {
    const icons = {
      function: '🔧',
      class: '📦',
      interface: '🔌',
      api: '🌐',
      content: '📄',
      comment: '💬'
    };
    return icons[type as keyof typeof icons] || '📄';
  }

  private formatFilePath(filePath: string): string {
    // Show only the last 2-3 path segments for readability
    const parts = filePath.split('/');
    if (parts.length <= 3) return filePath;
    
    return '...' + parts.slice(-3).join('/');
  }

  private selectResult(index: number): void {
    // Remove previous selection
    this.container.querySelectorAll('.search-result.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Select new result
    if (index >= 0 && index < this.currentResults.length) {
      const resultElement = this.container.querySelector(`[data-index="${index}"]`);
      if (resultElement) {
        resultElement.classList.add('selected');
        resultElement.scrollIntoView({ block: 'nearest' });
      }
      this.selectedResultIndex = index;
    }
  }

  private selectNextResult(): void {
    const nextIndex = Math.min(this.selectedResultIndex + 1, this.currentResults.length - 1);
    this.selectResult(nextIndex);
  }

  private selectPreviousResult(): void {
    const prevIndex = Math.max(this.selectedResultIndex - 1, 0);
    this.selectResult(prevIndex);
  }

  private activateSelectedResult(): void {
    if (this.selectedResultIndex >= 0 && this.selectedResultIndex < this.currentResults.length) {
      this.activateResult(this.currentResults[this.selectedResultIndex]);
    }
  }

  private activateResult(result: SearchResult): void {
    // Emit custom event for result activation
    const event = new CustomEvent('search-result-selected', {
      detail: { result }
    });
    this.container.dispatchEvent(event);
    
    // Default behavior: navigate to the result
    this.navigateToResult(result);
  }

  private navigateToResult(result: SearchResult): void {
    // This would typically integrate with the documentation viewer
    // For now, we'll just log the navigation
    console.log('Navigating to:', result);
    
    // You could implement actual navigation here:
    // window.location.hash = `#${result.file}:${result.line}`;
    // or trigger a custom navigation event
  }

  private updateFilters(): void {
    const typeSelect = this.container.querySelector('[name="type"]') as HTMLSelectElement;
    const languageSelect = this.container.querySelector('[name="language"]') as HTMLSelectElement;
    const fileInput = this.container.querySelector('[name="file"]') as HTMLInputElement;
    const caseSensitiveCheck = this.container.querySelector('[name="caseSensitive"]') as HTMLInputElement;
    const wholeWordCheck = this.container.querySelector('[name="wholeWord"]') as HTMLInputElement;
    const regexCheck = this.container.querySelector('[name="regex"]') as HTMLInputElement;

    this.currentQuery = {
      ...this.currentQuery,
      type: (typeSelect.value as SearchType) || 'content',
      language: languageSelect.value || '',
      file: fileInput.value || '',
      caseSensitive: caseSensitiveCheck.checked,
      wholeWord: wholeWordCheck.checked,
      regex: regexCheck.checked
    };
  }

  private clearFilters(): void {
    const filterElements = this.container.querySelectorAll('.filter-select, .filter-input, input[type="checkbox"]');
    filterElements.forEach(element => {
      if (element instanceof HTMLSelectElement || element instanceof HTMLInputElement) {
        if (element.type === 'checkbox') {
          element.checked = false;
        } else {
          element.value = '';
        }
      }
    });
    
    this.currentQuery = { query: this.currentQuery.query };
    this.performSearch();
  }

  private toggleFilters(): void {
    this.isFiltersVisible = !this.isFiltersVisible;
    this.filtersContainer.style.display = this.isFiltersVisible ? 'block' : 'none';
    
    const toggle = this.container.querySelector('.search-filters-toggle') as HTMLElement;
    toggle.classList.toggle('active', this.isFiltersVisible);
  }

  private showSuggestions(query: string): void {
    const suggestions = this.searchService.getSuggestions(query, 5);
    const container = this.container.querySelector('.suggestions-list') as HTMLElement;
    const suggestionsEl = this.container.querySelector('.search-suggestions') as HTMLElement;
    
    if (suggestions.length === 0) {
      suggestionsEl.style.display = 'none';
      return;
    }
    
    const html = suggestions.map(suggestion => `
      <div class="suggestion-item" data-suggestion="${suggestion}">
        ${suggestion}
      </div>
    `).join('');
    
    container.innerHTML = html;
    suggestionsEl.style.display = 'block';
    
    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const suggestion = item.getAttribute('data-suggestion');
        if (suggestion) {
          this.searchInput.value = suggestion;
          this.currentQuery.query = suggestion;
          this.performSearch();
          this.hideSuggestions();
        }
      });
    });
  }

  private hideSuggestions(): void {
    const suggestionsEl = this.container.querySelector('.search-suggestions') as HTMLElement;
    suggestionsEl.style.display = 'none';
  }

  private showHistory(): void {
    if (!this.config.showHistory) return;
    
    const history = this.searchService.getHistory();
    const container = this.container.querySelector('.history-list') as HTMLElement;
    
    if (history.length === 0) {
      this.historyContainer.style.display = 'none';
      return;
    }
    
    const html = history.slice(0, 10).map(entry => `
      <div class="history-item" data-query="${entry.query}">
        <div class="history-query">${entry.query}</div>
        <div class="history-meta">
          ${entry.resultCount} results • ${this.formatDate(entry.timestamp)}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
    this.historyContainer.style.display = 'block';
    
    // Add click handlers
    container.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = item.getAttribute('data-query');
        if (query) {
          this.searchInput.value = query;
          this.currentQuery.query = query;
          this.performSearch();
        }
      });
    });
  }

  private clearHistory(): void {
    this.searchService.clearHistory();
    this.historyContainer.style.display = 'none';
  }

  private loadSavedSearches(): void {
    if (!this.config.showSavedSearches) return;
    
    const savedSearches = this.searchService.getSavedSearches();
    const container = this.container.querySelector('.saved-list') as HTMLElement;
    
    if (savedSearches.length === 0) {
      this.savedSearchesContainer.style.display = 'none';
      return;
    }
    
    const html = savedSearches.map(search => `
      <div class="saved-item" data-id="${search.id}">
        <div class="saved-header">
          <div class="saved-name">${search.name}</div>
          <div class="saved-actions">
            <button class="btn btn-sm execute-saved-btn" data-id="${search.id}">Execute</button>
            <button class="btn btn-sm btn-danger delete-saved-btn" data-id="${search.id}">Delete</button>
          </div>
        </div>
        <div class="saved-query">${search.query.query}</div>
        <div class="saved-meta">
          Used ${search.useCount} times • Last used ${this.formatDate(search.lastUsed)}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
    this.savedSearchesContainer.style.display = 'block';
    
    // Add event handlers
    container.querySelectorAll('.execute-saved-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) this.executeSavedSearch(id);
      });
    });
    
    container.querySelectorAll('.delete-saved-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) this.deleteSavedSearch(id);
      });
    });
  }

  private showSaveSearchDialog(): void {
    const name = prompt('Enter a name for this search:');
    if (name && this.currentQuery.query) {
      try {
        this.searchService.saveSearch(name, this.currentQuery);
        this.loadSavedSearches();
        alert('Search saved successfully!');
      } catch (error) {
        alert('Failed to save search: ' + (error as Error).message);
      }
    }
  }

  private executeSavedSearch(id: string): void {
    try {
      const results = this.searchService.executeSavedSearch(id);
      this.currentResults = results;
      this.displayResults(results);
      this.loadSavedSearches(); // Refresh to update usage count
    } catch (error) {
      alert('Failed to execute saved search: ' + (error as Error).message);
    }
  }

  private deleteSavedSearch(id: string): void {
    if (confirm('Are you sure you want to delete this saved search?')) {
      this.searchService.deleteSavedSearch(id);
      this.loadSavedSearches();
    }
  }

  private exportResults(): void {
    if (this.currentResults.length === 0) return;
    
    const data = {
      query: this.currentQuery,
      results: this.currentResults,
      timestamp: new Date().toISOString(),
      total: this.currentResults.length
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private updateResultsInfo(count: number, searchTime: number): void {
    const countEl = this.container.querySelector('.results-count') as HTMLElement;
    const timeEl = this.container.querySelector('.search-time') as HTMLElement;
    
    countEl.textContent = `${count} result${count !== 1 ? 's' : ''}`;
    timeEl.textContent = `(${searchTime.toFixed(1)}ms)`;
  }

  private showSearchError(error: Error): void {
    const container = this.resultsContainer;
    container.innerHTML = `
      <div class="search-error">
        <div class="error-icon">⚠️</div>
        <div class="error-message">
          <h4>Search Error</h4>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }

  private clearSearch(): void {
    this.searchInput.value = '';
    this.currentQuery = { query: '' };
    this.clearResults();
    this.hideSuggestions();
    this.showHistory();
    
    const clearBtn = this.container.querySelector('.search-clear-btn') as HTMLElement;
    clearBtn.style.display = 'none';
  }

  private clearResults(): void {
    this.resultsContainer.innerHTML = '';
    this.currentResults = [];
    this.selectedResultIndex = -1;
    
    const header = this.container.querySelector('.search-results-header') as HTMLElement;
    const noResults = this.container.querySelector('.search-no-results') as HTMLElement;
    
    header.style.display = 'none';
    noResults.style.display = 'none';
  }

  private focusSearch(): void {
    this.searchInput.focus();
    this.searchInput.select();
    this.showSearchInterface();
  }

  private showSearchInterface(): void {
    // Show relevant sections based on current state
    if (this.searchInput.value.trim()) {
      this.hideSuggestions();
      this.historyContainer.style.display = 'none';
    } else {
      this.showHistory();
    }
    
    this.loadSavedSearches();
  }

  private hideSearchInterface(): void {
    this.hideSuggestions();
    this.historyContainer.style.display = 'none';
    this.savedSearchesContainer.style.display = 'none';
    
    if (this.isFiltersVisible) {
      this.toggleFilters();
    }
  }

  private isSearchFocused(): boolean {
    return document.activeElement === this.searchInput;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  // Public API methods
  public updateSearchIndex(analysis: any): void {
    this.searchService.updateIndex(analysis);
  }

  public setQuery(query: string): void {
    this.searchInput.value = query;
    this.currentQuery.query = query;
    this.performSearch();
  }

  public getResults(): SearchResult[] {
    return [...this.currentResults];
  }

  public focus(): void {
    this.focusSearch();
  }

  public getStatistics() {
    return this.searchService.getStatistics();
  }
}
/**
 * Search UI Component Tests
 * Tests keyboard shortcuts, navigation, and user interaction features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchUI } from '../../src/search/search-ui.js';
import { SearchService } from '../../src/search/search-service.js';

// Mock DOM environment
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
  writable: true,
});

describe('SearchUI', () => {
  let searchUI: SearchUI;
  let mockSearchService: SearchService;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create mock search service
    mockSearchService = {
      search: vi.fn().mockResolvedValue({
        results: [
          {
            id: '1',
            type: 'function',
            title: 'getUserData',
            description: 'Fetches user data from database',
            file: 'src/user.ts',
            line: 10,
            snippet: 'getUserData(userId: string): Promise<User>',
            highlights: [{ start: 0, end: 11, type: 'match' }],
            score: 95
          },
          {
            id: '2',
            type: 'class',
            title: 'UserService',
            description: 'Service for user operations',
            file: 'src/user.ts',
            line: 40,
            snippet: 'class UserService extends BaseService',
            highlights: [{ start: 6, end: 17, type: 'match' }],
            score: 85
          }
        ],
        query: { query: 'user' },
        suggestions: ['getUserData', 'UserService'],
        statistics: { totalSymbols: 100, totalContent: 50 }
      }),
      getSuggestions: vi.fn().mockResolvedValue(['getUserData', 'UserService', 'createUser']),
      getHistory: vi.fn().mockResolvedValue({
        history: [
          { query: 'user', timestamp: new Date(), resultCount: 2 },
          { query: 'auth', timestamp: new Date(), resultCount: 1 }
        ]
      }),
      clearHistory: vi.fn().mockResolvedValue({ success: true }),
      getSavedSearches: vi.fn().mockResolvedValue({
        savedSearches: [
          {
            id: 'saved1',
            name: 'User Functions',
            query: { query: 'user', type: 'function' },
            created: new Date(),
            lastUsed: new Date(),
            useCount: 5
          }
        ]
      }),
      saveSearch: vi.fn().mockResolvedValue({ id: 'new-saved', success: true }),
      executeSavedSearch: vi.fn().mockResolvedValue({
        results: [
          {
            id: '1',
            type: 'function',
            title: 'getUserData',
            file: 'src/user.ts',
            line: 10,
            snippet: 'getUserData(userId: string)',
            highlights: [],
            score: 95
          }
        ]
      }),
      deleteSavedSearch: vi.fn().mockResolvedValue({ success: true }),
      getStatistics: vi.fn().mockReturnValue({
        totalSymbols: 100,
        totalContent: 50,
        totalFiles: 10
      })
    } as any;

    // Create SearchUI instance
    searchUI = new SearchUI(mockSearchService, {
      container,
      showFilters: true,
      showHistory: true,
      showSavedSearches: true
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create search interface elements', () => {
      expect(container.querySelector('.search-input')).toBeTruthy();
      expect(container.querySelector('.search-filters')).toBeTruthy();
      expect(container.querySelector('.search-results-container')).toBeTruthy();
    });

    it('should set up keyboard shortcuts', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput).toBeTruthy();
      expect(searchInput.getAttribute('aria-label')).toBe('Search documentation');
    });

    it('should initialize with empty state', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput.value).toBe('');
      
      const resultsContainer = container.querySelector('.search-results-container');
      expect(resultsContainer?.innerHTML).toBe('');
    });
  });

  describe('Search Input Handling', () => {
    it('should trigger search on input', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: 'user'
      });
    });

    it('should show clear button when input has value', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      const clearBtn = container.querySelector('.search-clear-btn') as HTMLElement;

      expect(clearBtn.style.display).toBe('none');

      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));

      expect(clearBtn.style.display).toBe('block');
    });

    it('should clear search when clear button is clicked', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      const clearBtn = container.querySelector('.search-clear-btn') as HTMLElement;

      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));

      clearBtn.click();

      expect(searchInput.value).toBe('');
    });

    it('should debounce search input', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;

      // Rapid input changes
      searchInput.value = 'u';
      searchInput.dispatchEvent(new Event('input'));
      
      searchInput.value = 'us';
      searchInput.dispatchEvent(new Event('input'));
      
      searchInput.value = 'use';
      searchInput.dispatchEvent(new Event('input'));

      // Should not have called search yet
      expect(mockSearchService.search).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should have called search only once with final value
      expect(mockSearchService.search).toHaveBeenCalledTimes(1);
      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: 'use'
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should focus search on Ctrl+K', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      const focusSpy = vi.spyOn(searchInput, 'focus');

      // Simulate Ctrl+K
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should clear search on Escape', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test';
      searchInput.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(searchInput.value).toBe('');
    });

    it('should navigate results with arrow keys', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      // Perform search to get results
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();

      await new Promise(resolve => setTimeout(resolve, 350));

      // Simulate arrow down
      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true
      });
      document.dispatchEvent(downEvent);

      // Check if first result is selected
      const firstResult = container.querySelector('.search-result[data-index="0"]');
      expect(firstResult?.classList.contains('selected')).toBe(true);
    });

    it('should toggle filters with Ctrl+Shift+F', () => {
      const filtersContainer = container.querySelector('.search-filters') as HTMLElement;
      expect(filtersContainer.style.display).toBe('none');

      const event = new KeyboardEvent('keydown', {
        key: 'F',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(filtersContainer.style.display).toBe('block');
    });
  });

  describe('Search Results Display', () => {
    it('should display search results', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const results = container.querySelectorAll('.search-result');
      expect(results.length).toBe(2);

      const firstResult = results[0];
      expect(firstResult.querySelector('.result-title')?.textContent).toContain('getUserData');
      expect(firstResult.querySelector('.result-type')?.textContent).toBe('function');
    });

    it('should highlight search matches', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const highlights = container.querySelectorAll('.search-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('should show no results message when no matches found', async () => {
      mockSearchService.search = vi.fn().mockResolvedValue({
        results: [],
        query: { query: 'nonexistent' }
      });

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const noResults = container.querySelector('.search-no-results');
      expect(noResults?.style.display).toBe('block');
    });

    it('should update results info', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const resultsCount = container.querySelector('.results-count');
      expect(resultsCount?.textContent).toBe('2 results');

      const searchTime = container.querySelector('.search-time');
      expect(searchTime?.textContent).toMatch(/\(\d+\.\d+ms\)/);
    });
  });

  describe('Search Filters', () => {
    it('should toggle filters visibility', () => {
      const filtersToggle = container.querySelector('.search-filters-toggle') as HTMLElement;
      const filtersContainer = container.querySelector('.search-filters') as HTMLElement;

      expect(filtersContainer.style.display).toBe('none');

      filtersToggle.click();
      expect(filtersContainer.style.display).toBe('block');

      filtersToggle.click();
      expect(filtersContainer.style.display).toBe('none');
    });

    it('should apply type filter', async () => {
      const filtersToggle = container.querySelector('.search-filters-toggle') as HTMLElement;
      filtersToggle.click();

      const typeSelect = container.querySelector('[name="type"]') as HTMLSelectElement;
      typeSelect.value = 'function';
      typeSelect.dispatchEvent(new Event('change'));

      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: '',
        type: 'function'
      });
    });

    it('should apply language filter', async () => {
      const filtersToggle = container.querySelector('.search-filters-toggle') as HTMLElement;
      filtersToggle.click();

      const languageSelect = container.querySelector('[name="language"]') as HTMLSelectElement;
      languageSelect.value = 'typescript';
      languageSelect.dispatchEvent(new Event('change'));

      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: '',
        language: 'typescript'
      });
    });

    it('should clear all filters', async () => {
      const filtersToggle = container.querySelector('.search-filters-toggle') as HTMLElement;
      filtersToggle.click();

      // Set some filters
      const typeSelect = container.querySelector('[name="type"]') as HTMLSelectElement;
      const caseSensitiveCheck = container.querySelector('[name="caseSensitive"]') as HTMLInputElement;
      
      typeSelect.value = 'function';
      caseSensitiveCheck.checked = true;

      // Clear filters
      const clearFiltersBtn = container.querySelector('.clear-filters-btn') as HTMLElement;
      clearFiltersBtn.click();

      expect(typeSelect.value).toBe('');
      expect(caseSensitiveCheck.checked).toBe(false);
    });
  });

  describe('Search Suggestions', () => {
    it('should show suggestions for partial input', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'ge';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSearchService.getSuggestions).toHaveBeenCalledWith('ge', 5);

      const suggestions = container.querySelector('.search-suggestions');
      expect(suggestions?.style.display).toBe('block');
    });

    it('should select suggestion on click', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'ge';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      const suggestionItem = container.querySelector('.suggestion-item') as HTMLElement;
      suggestionItem.click();

      expect(searchInput.value).toBe('getUserData');
    });
  });

  describe('Search History', () => {
    it('should display search history when input is empty', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      searchInput.focus();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSearchService.getHistory).toHaveBeenCalled();

      const historySection = container.querySelector('.search-history-section');
      expect(historySection?.style.display).toBe('block');
    });

    it('should execute search from history', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      searchInput.focus();

      await new Promise(resolve => setTimeout(resolve, 100));

      const historyItem = container.querySelector('.history-item') as HTMLElement;
      historyItem.click();

      expect(searchInput.value).toBe('user');
    });

    it('should clear search history', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      searchInput.focus();

      await new Promise(resolve => setTimeout(resolve, 100));

      const clearHistoryBtn = container.querySelector('.clear-history-btn') as HTMLElement;
      clearHistoryBtn.click();

      expect(mockSearchService.clearHistory).toHaveBeenCalled();
    });
  });

  describe('Saved Searches', () => {
    it('should display saved searches', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSearchService.getSavedSearches).toHaveBeenCalled();

      const savedSection = container.querySelector('.saved-searches-section');
      expect(savedSection?.style.display).toBe('block');

      const savedItem = container.querySelector('.saved-item');
      expect(savedItem?.querySelector('.saved-name')?.textContent).toBe('User Functions');
    });

    it('should execute saved search', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const executeBtn = container.querySelector('.execute-saved-btn') as HTMLElement;
      executeBtn.click();

      expect(mockSearchService.executeSavedSearch).toHaveBeenCalledWith('saved1');
    });

    it('should delete saved search', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock confirm dialog
      window.confirm = vi.fn().mockReturnValue(true);

      const deleteBtn = container.querySelector('.delete-saved-btn') as HTMLElement;
      deleteBtn.click();

      expect(mockSearchService.deleteSavedSearch).toHaveBeenCalledWith('saved1');
    });

    it('should save current search', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test search';

      // Mock prompt dialog
      window.prompt = vi.fn().mockReturnValue('My Test Search');
      window.alert = vi.fn();

      const saveBtn = container.querySelector('.save-search-btn') as HTMLElement;
      saveBtn.click();

      expect(mockSearchService.saveSearch).toHaveBeenCalledWith('My Test Search', {
        query: 'test search'
      });
    });
  });

  describe('Result Navigation', () => {
    it('should select result on mouse hover', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const secondResult = container.querySelector('.search-result[data-index="1"]') as HTMLElement;
      secondResult.dispatchEvent(new Event('mouseenter'));

      expect(secondResult.classList.contains('selected')).toBe(true);
    });

    it('should activate result on click', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const firstResult = container.querySelector('.search-result[data-index="0"]') as HTMLElement;
      
      // Listen for custom event
      let activatedResult: any = null;
      container.addEventListener('search-result-selected', (e: any) => {
        activatedResult = e.detail.result;
      });

      firstResult.click();

      expect(activatedResult).toBeTruthy();
      expect(activatedResult.title).toBe('getUserData');
    });

    it('should navigate to result location', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const originalHash = window.location.hash;
      
      const firstResult = container.querySelector('.search-result[data-index="0"]') as HTMLElement;
      firstResult.click();

      // Should update location hash
      expect(window.location.hash).toBe('#src/user.ts:10');
      
      // Restore original hash
      window.location.hash = originalHash;
    });
  });

  describe('Export Functionality', () => {
    it('should export search results', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      // Mock URL.createObjectURL and related functions
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      
      Object.defineProperty(URL, 'createObjectURL', {
        value: mockCreateObjectURL,
        writable: true
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: mockRevokeObjectURL,
        writable: true
      });

      // Mock document.createElement for download link
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return originalCreateElement.call(document, tagName);
      });

      const exportBtn = container.querySelector('.export-results-btn') as HTMLElement;
      exportBtn.click();

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/search-results-\d+\.json/);

      // Restore original functions
      document.createElement = originalCreateElement;
    });
  });

  describe('Error Handling', () => {
    it('should display search errors', async () => {
      mockSearchService.search = vi.fn().mockRejectedValue(new Error('Search failed'));

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'error';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 350));

      const errorElement = container.querySelector('.search-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement?.textContent).toContain('Search failed');
    });

    it('should handle network errors gracefully', async () => {
      mockSearchService.getSuggestions = vi.fn().mockRejectedValue(new Error('Network error'));

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'ge';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash, suggestions just won't show
      const suggestions = container.querySelector('.search-suggestions');
      expect(suggestions?.style.display).toBe('none');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput.getAttribute('aria-label')).toBe('Search documentation');
    });

    it('should support keyboard navigation', async () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'user';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();

      await new Promise(resolve => setTimeout(resolve, 350));

      // Test Tab navigation
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });
      document.dispatchEvent(tabEvent);

      const firstResult = container.querySelector('.search-result[data-index="0"]');
      expect(firstResult?.classList.contains('selected')).toBe(true);
    });

    it('should handle focus management', () => {
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });
  });
});
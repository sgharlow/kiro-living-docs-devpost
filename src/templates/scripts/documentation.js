/**
 * Living Documentation Generator - Interactive JavaScript
 * Handles theme switching, copy-to-clipboard, search, and navigation
 */

class DocumentationUI {
  constructor() {
    this.theme = this.getStoredTheme() || 'light';
    this.sidebarCollapsed = false;
    this.searchIndex = [];
    this.currentSearchResults = [];
    
    this.init();
  }

  init() {
    this.applyTheme();
    this.setupThemeToggle();
    this.setupSidebar();
    this.setupSearch();
    this.setupCopyButtons();
    this.setupCodeBlocks();
    this.setupNavigation();
    this.setupScrollSpy();
    this.setupKeyboardShortcuts();
    this.buildSearchIndex();
  }

  // Theme Management
  getStoredTheme() {
    return localStorage.getItem('docs-theme');
  }

  setStoredTheme(theme) {
    localStorage.setItem('docs-theme', theme);
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    this.updateThemeToggleIcon();
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.setStoredTheme(this.theme);
    this.applyTheme();
  }

  setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  updateThemeToggleIcon() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      const icon = this.theme === 'light' ? '🌙' : '☀️';
      themeToggle.innerHTML = icon;
      themeToggle.setAttribute('aria-label', `Switch to ${this.theme === 'light' ? 'dark' : 'light'} theme`);
    }
  }

  // Sidebar Management
  setupSidebar() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.doc-sidebar');
    const main = document.querySelector('.doc-main');

    if (sidebarToggle && sidebar && main) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && 
          !sidebar.contains(e.target) && 
          !e.target.closest('.sidebar-toggle')) {
        this.closeSidebar();
      }
    });
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.doc-sidebar');
    const main = document.querySelector('.doc-main');
    
    this.sidebarCollapsed = !this.sidebarCollapsed;
    
    if (sidebar) {
      sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open', !this.sidebarCollapsed);
      }
    }
    
    if (main) {
      main.classList.toggle('expanded', this.sidebarCollapsed);
    }
  }

  closeSidebar() {
    const sidebar = document.querySelector('.doc-sidebar');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove('mobile-open');
      this.sidebarCollapsed = true;
    }
  }

  // Search Functionality
  buildSearchIndex() {
    const content = document.querySelector('.doc-content');
    if (!content) return;

    const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const paragraphs = content.querySelectorAll('p');
    const codeBlocks = content.querySelectorAll('code, pre');

    // Index headings
    headings.forEach((heading, index) => {
      this.searchIndex.push({
        id: `heading-${index}`,
        type: 'heading',
        title: heading.textContent.trim(),
        content: heading.textContent.trim(),
        element: heading,
        url: `#${heading.id || this.generateId(heading.textContent)}`
      });
    });

    // Index paragraphs
    paragraphs.forEach((paragraph, index) => {
      const text = paragraph.textContent.trim();
      if (text.length > 20) { // Only index substantial content
        this.searchIndex.push({
          id: `paragraph-${index}`,
          type: 'content',
          title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          content: text,
          element: paragraph,
          url: `#${this.findNearestHeading(paragraph)?.id || ''}`
        });
      }
    });

    // Index code blocks
    codeBlocks.forEach((code, index) => {
      const text = code.textContent.trim();
      if (text.length > 10) {
        this.searchIndex.push({
          id: `code-${index}`,
          type: 'code',
          title: `Code: ${text.substring(0, 30)}...`,
          content: text,
          element: code,
          url: `#${this.findNearestHeading(code)?.id || ''}`
        });
      }
    });
  }

  setupSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');

    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.performSearch(e.target.value);
      }, 300);
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        this.hideSearchResults();
      }
    });

    // Handle keyboard navigation in search results
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectSearchResult();
      } else if (e.key === 'Escape') {
        this.hideSearchResults();
        searchInput.blur();
      }
    });
  }

  performSearch(query) {
    if (!query || query.length < 2) {
      this.hideSearchResults();
      return;
    }

    const results = this.searchIndex.filter(item => {
      const searchText = (item.title + ' ' + item.content).toLowerCase();
      return searchText.includes(query.toLowerCase());
    }).slice(0, 10); // Limit to 10 results

    this.currentSearchResults = results;
    this.displaySearchResults(results, query);
  }

  displaySearchResults(results, query) {
    const searchResults = document.querySelector('.search-results');
    if (!searchResults) return;

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result">No results found</div>';
      searchResults.style.display = 'block';
      return;
    }

    const html = results.map((result, index) => {
      const highlightedTitle = this.highlightSearchTerm(result.title, query);
      const typeIcon = this.getTypeIcon(result.type);
      
      return `
        <div class="search-result" data-index="${index}" data-url="${result.url}">
          <div class="search-result-type">${typeIcon}</div>
          <div class="search-result-content">
            <div class="search-result-title">${highlightedTitle}</div>
            <div class="search-result-type-label">${result.type}</div>
          </div>
        </div>
      `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.style.display = 'block';

    // Add click handlers
    searchResults.querySelectorAll('.search-result').forEach(result => {
      result.addEventListener('click', () => {
        const url = result.dataset.url;
        if (url && url !== '#') {
          window.location.hash = url;
          this.hideSearchResults();
        }
      });
    });
  }

  highlightSearchTerm(text, term) {
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  getTypeIcon(type) {
    const icons = {
      heading: '📄',
      content: '📝',
      code: '💻',
      api: '🔌'
    };
    return icons[type] || '📄';
  }

  navigateSearchResults(direction) {
    const results = document.querySelectorAll('.search-result');
    if (results.length === 0) return;

    const current = document.querySelector('.search-result.highlighted');
    let newIndex = 0;

    if (current) {
      const currentIndex = parseInt(current.dataset.index);
      newIndex = currentIndex + direction;
      current.classList.remove('highlighted');
    }

    // Wrap around
    if (newIndex < 0) newIndex = results.length - 1;
    if (newIndex >= results.length) newIndex = 0;

    results[newIndex].classList.add('highlighted');
  }

  selectSearchResult() {
    const highlighted = document.querySelector('.search-result.highlighted');
    if (highlighted) {
      highlighted.click();
    } else {
      const first = document.querySelector('.search-result');
      if (first) first.click();
    }
  }

  hideSearchResults() {
    const searchResults = document.querySelector('.search-results');
    if (searchResults) {
      searchResults.style.display = 'none';
    }
  }

  // Copy to Clipboard
  setupCopyButtons() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-button') || 
          e.target.closest('.copy-button')) {
        e.preventDefault();
        this.copyCodeToClipboard(e.target);
      }
    });
  }

  async copyCodeToClipboard(button) {
    const codeBlock = button.closest('.code-block, .code-block-enhanced');
    if (!codeBlock) return;

    const code = codeBlock.querySelector('code');
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code.textContent);
      this.showCopySuccess(button);
    } catch (err) {
      // Fallback for older browsers
      this.fallbackCopyToClipboard(code.textContent);
      this.showCopySuccess(button);
    }
  }

  fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
  }

  showCopySuccess(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }

  // Code Block Enhancements
  setupCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach((code, index) => {
      this.enhanceCodeBlock(code, index);
    });
  }

  enhanceCodeBlock(code, index) {
    const pre = code.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-enhanced';
    
    // Detect language
    const language = this.detectLanguage(code);
    
    // Create header
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <div class="code-info">
        <span class="code-language-badge">${language}</span>
      </div>
      <div class="code-actions">
        <button class="code-action-button copy-button" title="Copy to clipboard">
          📋 Copy
        </button>
      </div>
    `;
    
    // Wrap the code block
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
    
    // Add line numbers if code is long enough
    if (code.textContent.split('\n').length > 5) {
      this.addLineNumbers(pre, code);
    }
  }

  detectLanguage(code) {
    const className = code.className;
    const languageMatch = className.match(/language-(\w+)/);
    
    if (languageMatch) {
      return languageMatch[1];
    }
    
    // Try to detect based on content
    const content = code.textContent;
    if (content.includes('function') && content.includes('{')) return 'javascript';
    if (content.includes('def ') && content.includes(':')) return 'python';
    if (content.includes('func ') && content.includes('package')) return 'go';
    if (content.includes('class ') && content.includes('{')) return 'java';
    
    return 'text';
  }

  addLineNumbers(pre, code) {
    const lines = code.textContent.split('\n');
    const lineNumbers = document.createElement('div');
    lineNumbers.className = 'line-numbers';
    
    lines.forEach((_, index) => {
      const lineNumber = document.createElement('div');
      lineNumber.textContent = index + 1;
      lineNumbers.appendChild(lineNumber);
    });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'code-with-line-numbers';
    
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(lineNumbers);
    wrapper.appendChild(pre);
  }

  // Navigation
  setupNavigation() {
    // Smooth scrolling for anchor links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link) {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          // Update URL without jumping
          history.pushState(null, null, link.getAttribute('href'));
        }
      }
    });

    // Generate table of contents
    this.generateTableOfContents();
    
    // Setup breadcrumbs
    this.setupBreadcrumbs();
  }

  generateTableOfContents() {
    const tocContainer = document.querySelector('.toc');
    if (!tocContainer) return;

    const headings = document.querySelectorAll('.doc-content h1, .doc-content h2, .doc-content h3, .doc-content h4');
    if (headings.length === 0) return;

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';

    let currentLevel = 1;
    let currentList = tocList;
    const listStack = [tocList];

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      const id = heading.id || this.generateId(heading.textContent);
      heading.id = id;

      // Adjust nesting level
      if (level > currentLevel) {
        // Going deeper
        for (let i = currentLevel; i < level; i++) {
          const nestedList = document.createElement('ul');
          nestedList.className = 'toc-nested';
          const lastItem = currentList.lastElementChild;
          if (lastItem) {
            lastItem.appendChild(nestedList);
          } else {
            currentList.appendChild(nestedList);
          }
          listStack.push(nestedList);
          currentList = nestedList;
        }
      } else if (level < currentLevel) {
        // Going back up
        for (let i = currentLevel; i > level; i--) {
          listStack.pop();
          currentList = listStack[listStack.length - 1];
        }
      }

      currentLevel = level;

      const listItem = document.createElement('li');
      listItem.className = 'toc-item';
      
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.className = 'toc-link';
      link.textContent = heading.textContent;
      
      listItem.appendChild(link);
      currentList.appendChild(listItem);
    });

    tocContainer.appendChild(tocList);
  }

  setupBreadcrumbs() {
    const breadcrumbs = document.querySelector('.breadcrumbs');
    if (!breadcrumbs) return;

    // This would typically be populated based on the current page structure
    // For now, we'll create a simple breadcrumb based on the page title
    const pageTitle = document.querySelector('h1')?.textContent || 'Documentation';
    
    breadcrumbs.innerHTML = `
      <div class="breadcrumb-item">
        <a href="/" class="breadcrumb-link">Home</a>
      </div>
      <div class="breadcrumb-item">
        <span>${pageTitle}</span>
      </div>
    `;
  }

  // Scroll Spy
  setupScrollSpy() {
    const headings = document.querySelectorAll('.doc-content h1, .doc-content h2, .doc-content h3, .doc-content h4');
    const navLinks = document.querySelectorAll('.nav-link, .toc-link');
    
    if (headings.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          
          // Update navigation
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -80% 0px'
    });

    headings.forEach(heading => {
      if (heading.id) {
        observer.observe(heading);
      }
    });
  }

  // Enhanced Keyboard Shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusSearch();
      }
      
      // Ctrl/Cmd + \ for sidebar toggle
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        this.toggleSidebar();
      }
      
      // Ctrl/Cmd + Shift + L for theme toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggleTheme();
      }
      
      // Ctrl/Cmd + Shift + F for search filters
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.toggleSearchFilters();
      }
      
      // Ctrl/Cmd + S for save search (when search is active)
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.isSearchActive()) {
        e.preventDefault();
        this.showSaveSearchDialog();
      }
      
      // Ctrl/Cmd + P for print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        // Let browser handle print, but ensure print styles are applied
        this.preparePrintView();
      }
      
      // Ctrl/Cmd + G for go to line (if applicable)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        this.showGoToDialog();
      }
      
      // Ctrl/Cmd + H for search history
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        this.showSearchHistory();
      }
      
      // Escape to close modals/dropdowns
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
      }
      
      // Arrow keys for navigation in search results
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const searchResults = document.querySelector('.search-results-container, .search-results');
        if (searchResults && searchResults.style.display !== 'none') {
          e.preventDefault();
          this.navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
        }
      }
      
      // Enter to select search result
      if (e.key === 'Enter' && this.isSearchActive()) {
        const highlighted = document.querySelector('.search-result.highlighted');
        if (highlighted) {
          e.preventDefault();
          this.selectSearchResult();
        }
      }
      
      // Tab for next search result, Shift+Tab for previous
      if (e.key === 'Tab' && this.isSearchActive()) {
        const searchResults = document.querySelector('.search-results-container, .search-results');
        if (searchResults && searchResults.style.display !== 'none') {
          e.preventDefault();
          this.navigateSearchResults(e.shiftKey ? -1 : 1);
        }
      }
      
      // J/K for vim-style navigation in search results
      if ((e.key === 'j' || e.key === 'k') && this.isSearchActive() && !e.ctrlKey && !e.metaKey) {
        const searchResults = document.querySelector('.search-results-container, .search-results');
        if (searchResults && searchResults.style.display !== 'none') {
          e.preventDefault();
          this.navigateSearchResults(e.key === 'j' ? 1 : -1);
        }
      }
      
      // Number keys (1-9) for quick result selection
      if (/^[1-9]$/.test(e.key) && this.isSearchActive() && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.selectSearchResultByIndex(parseInt(e.key) - 1);
      }
      
      // F3 or Ctrl/Cmd + F for find in page
      if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        // Let browser handle find, but we can enhance it
        this.enhanceFindInPage();
      }
    });
    
    // Add keyboard shortcut hints
    this.addKeyboardShortcutHints();
  }

  focusSearch() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
      
      // Show search interface if it's hidden
      const searchContainer = searchInput.closest('.search-container');
      if (searchContainer) {
        searchContainer.classList.add('active');
      }
    }
  }

  toggleSearchFilters() {
    const filtersToggle = document.querySelector('.search-filters-toggle');
    if (filtersToggle) {
      filtersToggle.click();
    }
  }

  isSearchActive() {
    const searchInput = document.querySelector('.search-input');
    return searchInput && document.activeElement === searchInput;
  }

  showSaveSearchDialog() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput || !searchInput.value.trim()) return;
    
    const name = prompt('Enter a name for this search:');
    if (name) {
      // Save to localStorage for now
      const savedSearches = JSON.parse(localStorage.getItem('saved-searches') || '[]');
      savedSearches.push({
        id: Date.now().toString(),
        name: name,
        query: searchInput.value,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('saved-searches', JSON.stringify(savedSearches));
      
      // Show confirmation
      this.showNotification(`Search "${name}" saved successfully!`);
    }
  }

  showGoToDialog() {
    const input = prompt('Go to line number:');
    if (input) {
      const lineNumber = parseInt(input);
      if (!isNaN(lineNumber)) {
        this.goToLine(lineNumber);
      }
    }
  }

  goToLine(lineNumber) {
    // Look for line numbers in code blocks
    const lineElements = document.querySelectorAll('.line-numbers div');
    if (lineElements[lineNumber - 1]) {
      lineElements[lineNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      lineElements[lineNumber - 1].classList.add('highlighted-line');
      setTimeout(() => {
        lineElements[lineNumber - 1].classList.remove('highlighted-line');
      }, 2000);
    }
  }

  showSearchHistory() {
    const savedSearches = JSON.parse(localStorage.getItem('saved-searches') || '[]');
    if (savedSearches.length === 0) {
      this.showNotification('No saved searches found');
      return;
    }
    
    // Create and show history modal
    const modal = this.createSearchHistoryModal(savedSearches);
    document.body.appendChild(modal);
  }

  createSearchHistoryModal(searches) {
    const modal = document.createElement('div');
    modal.className = 'search-history-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Search History</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="search-history-list">
              ${searches.map(search => `
                <div class="search-history-item" data-query="${search.query}">
                  <div class="search-name">${search.name}</div>
                  <div class="search-query">${search.query}</div>
                  <div class="search-date">${new Date(search.timestamp).toLocaleDateString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.modal-overlay')) {
        document.body.removeChild(modal);
      }
    });
    
    modal.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = item.dataset.query;
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.value = query;
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        }
        document.body.removeChild(modal);
      });
    });
    
    return modal;
  }

  selectSearchResultByIndex(index) {
    const results = document.querySelectorAll('.search-result');
    if (results[index]) {
      // Remove previous highlights
      results.forEach(r => r.classList.remove('highlighted'));
      
      // Highlight and select the result
      results[index].classList.add('highlighted');
      results[index].scrollIntoView({ block: 'nearest' });
      
      // Trigger click after a short delay to show the highlight
      setTimeout(() => {
        results[index].click();
      }, 100);
    }
  }

  enhanceFindInPage() {
    // Add custom styling for browser find
    if (!document.querySelector('#find-in-page-styles')) {
      const style = document.createElement('style');
      style.id = 'find-in-page-styles';
      style.textContent = `
        ::selection {
          background-color: var(--search-primary-color, #3b82f6);
          color: white;
        }
        
        ::-moz-selection {
          background-color: var(--search-primary-color, #3b82f6);
          color: white;
        }
      `;
      document.head.appendChild(style);
    }
  }

  addKeyboardShortcutHints() {
    // Add keyboard shortcut hints to the interface
    const searchInput = document.querySelector('.search-input');
    if (searchInput && !searchInput.nextElementSibling?.classList.contains('keyboard-hints')) {
      const hints = document.createElement('div');
      hints.className = 'keyboard-hints';
      hints.innerHTML = `
        <div class="keyboard-hint">
          <kbd>Ctrl</kbd> + <kbd>K</kbd> Focus search
        </div>
        <div class="keyboard-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> Navigate results
        </div>
        <div class="keyboard-hint">
          <kbd>Enter</kbd> Select result
        </div>
        <div class="keyboard-hint">
          <kbd>Esc</kbd> Close
        </div>
      `;
      searchInput.parentNode.appendChild(hints);
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  preparePrintView() {
    // Add print-specific classes or modifications
    document.body.classList.add('preparing-print');
    
    // Expand all collapsed sections for print
    const collapsedSections = document.querySelectorAll('.collapsed');
    collapsedSections.forEach(section => {
      section.classList.add('print-expanded');
      section.classList.remove('collapsed');
    });
    
    // Remove print preparation after a short delay
    setTimeout(() => {
      document.body.classList.remove('preparing-print');
    }, 1000);
  }

  closeAllDropdowns() {
    // Close theme dropdown
    const themeDropdown = document.querySelector('.theme-dropdown');
    if (themeDropdown) {
      themeDropdown.style.display = 'none';
    }
    
    // Close search results
    this.hideSearchResults();
    
    // Close any other dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-open');
    dropdowns.forEach(dropdown => {
      dropdown.classList.remove('dropdown-open');
    });
  }

  // Utility Methods
  generateId(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  findNearestHeading(element) {
    let current = element;
    while (current && current !== document.body) {
      const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) return heading;
      
      current = current.previousElementSibling;
      if (!current) {
        current = element.parentElement;
        break;
      }
    }
    
    // Look for headings before this element
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const elementTop = element.getBoundingClientRect().top;
    
    let nearestHeading = null;
    allHeadings.forEach(heading => {
      const headingTop = heading.getBoundingClientRect().top;
      if (headingTop < elementTop) {
        nearestHeading = heading;
      }
    });
    
    return nearestHeading;
  }
}

// Interactive Code Examples
class InteractiveCodeExamples {
  constructor() {
    this.setupInteractiveBlocks();
  }

  setupInteractiveBlocks() {
    const interactiveBlocks = document.querySelectorAll('.interactive-code');
    
    interactiveBlocks.forEach(block => {
      this.setupTabs(block);
      this.setupRunButton(block);
    });
  }

  setupTabs(block) {
    const tabs = block.querySelectorAll('.interactive-code-tab');
    const contents = block.querySelectorAll('.interactive-code-content');
    
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        if (contents[index]) {
          contents[index].classList.add('active');
        }
      });
    });
  }

  setupRunButton(block) {
    const runButton = block.querySelector('.run-code-button');
    if (!runButton) return;
    
    runButton.addEventListener('click', () => {
      const activeContent = block.querySelector('.interactive-code-content.active');
      if (!activeContent) return;
      
      const code = activeContent.querySelector('code');
      if (!code) return;
      
      this.executeCode(code.textContent, activeContent);
    });
  }

  executeCode(code, container) {
    // This is a simplified example - in a real implementation,
    // you'd want to use a sandboxed environment
    const outputDiv = container.querySelector('.code-output') || 
                     this.createOutputDiv(container);
    
    try {
      // For demonstration purposes only - DO NOT use eval in production
      const result = eval(code);
      outputDiv.innerHTML = `<pre><code>${JSON.stringify(result, null, 2)}</code></pre>`;
    } catch (error) {
      outputDiv.innerHTML = `<pre class="error"><code>Error: ${error.message}</code></pre>`;
    }
  }

  createOutputDiv(container) {
    const outputDiv = document.createElement('div');
    outputDiv.className = 'code-output';
    outputDiv.innerHTML = '<h4>Output:</h4>';
    container.appendChild(outputDiv);
    return outputDiv;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DocumentationUI();
  new InteractiveCodeExamples();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DocumentationUI, InteractiveCodeExamples };
}
// Advanced Theme Management
class AdvancedThemeManager {
  constructor() {
    this.themes = ['light', 'dark', 'auto'];
    this.currentTheme = this.getStoredTheme() || 'light';
    this.systemTheme = this.getSystemTheme();
    this.settings = this.getStoredSettings();
    
    this.init();
  }

  init() {
    this.applyTheme();
    this.setupThemeControls();
    this.setupSystemThemeListener();
    this.applyAccessibilitySettings();
  }

  getStoredTheme() {
    return localStorage.getItem('docs-theme');
  }

  setStoredTheme(theme) {
    localStorage.setItem('docs-theme', theme);
  }

  getStoredSettings() {
    const stored = localStorage.getItem('docs-theme-settings');
    return stored ? JSON.parse(stored) : {
      highContrast: false,
      reduceMotion: false,
      fontSize: 'medium'
    };
  }

  setStoredSettings(settings) {
    localStorage.setItem('docs-theme-settings', JSON.stringify(settings));
  }

  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemTheme;
    }
    return this.currentTheme;
  }

  applyTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Update theme toggle display
    this.updateThemeToggle();
    
    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(effectiveTheme);
  }

  updateThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    const themeCurrent = document.querySelector('.theme-current');
    
    if (themeToggle) {
      const effectiveTheme = this.getEffectiveTheme();
      const icon = effectiveTheme === 'light' ? '☀️' : '🌙';
      
      // Update simple toggle
      if (!themeToggle.classList.contains('advanced')) {
        themeToggle.innerHTML = icon;
        themeToggle.setAttribute('aria-label', `Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} theme`);
      }
    }
    
    if (themeCurrent) {
      const displayName = this.currentTheme === 'auto' ? 
        `Auto (${this.getEffectiveTheme()})` : 
        this.currentTheme.charAt(0).toUpperCase() + this.currentTheme.slice(1);
      themeCurrent.textContent = displayName;
    }
    
    // Update radio buttons in dropdown
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
      radio.checked = radio.value === this.currentTheme;
    });
  }

  updateMetaThemeColor(theme) {
    let themeColor = theme === 'dark' ? '#0f172a' : '#ffffff';
    
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColor;
  }

  setupThemeControls() {
    // Advanced theme toggle
    const advancedToggle = document.querySelector('.theme-toggle.advanced');
    const themeDropdown = document.querySelector('.theme-dropdown');
    
    if (advancedToggle && themeDropdown) {
      advancedToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = themeDropdown.style.display !== 'none';
        themeDropdown.style.display = isVisible ? 'none' : 'block';
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-controls')) {
          themeDropdown.style.display = 'none';
        }
      });
      
      // Close button
      const closeBtn = themeDropdown.querySelector('.theme-dropdown-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          themeDropdown.style.display = 'none';
        });
      }
    }
    
    // Theme option selection
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.setTheme(radio.value);
        }
      });
    });
    
    // Settings checkboxes
    const highContrastCheckbox = document.getElementById('high-contrast');
    const reduceMotionCheckbox = document.getElementById('reduce-motion');
    const fontSizeSelect = document.getElementById('font-size');
    
    if (highContrastCheckbox) {
      highContrastCheckbox.checked = this.settings.highContrast;
      highContrastCheckbox.addEventListener('change', () => {
        this.settings.highContrast = highContrastCheckbox.checked;
        this.setStoredSettings(this.settings);
        this.applyAccessibilitySettings();
      });
    }
    
    if (reduceMotionCheckbox) {
      reduceMotionCheckbox.checked = this.settings.reduceMotion;
      reduceMotionCheckbox.addEventListener('change', () => {
        this.settings.reduceMotion = reduceMotionCheckbox.checked;
        this.setStoredSettings(this.settings);
        this.applyAccessibilitySettings();
      });
    }
    
    if (fontSizeSelect) {
      fontSizeSelect.value = this.settings.fontSize;
      fontSizeSelect.addEventListener('change', () => {
        this.settings.fontSize = fontSizeSelect.value;
        this.setStoredSettings(this.settings);
        this.applyAccessibilitySettings();
      });
    }
    
    // Simple theme toggle fallback
    const simpleToggle = document.querySelector('.theme-toggle:not(.advanced)');
    if (simpleToggle) {
      simpleToggle.addEventListener('click', () => {
        const newTheme = this.getEffectiveTheme() === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
      });
    }
  }

  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      this.systemTheme = e.matches ? 'dark' : 'light';
      if (this.currentTheme === 'auto') {
        this.applyTheme();
      }
    });
  }

  setTheme(theme) {
    this.currentTheme = theme;
    this.setStoredTheme(theme);
    this.applyTheme();
  }

  applyAccessibilitySettings() {
    const root = document.documentElement;
    
    // High contrast
    if (this.settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Reduced motion
    if (this.settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // Font size
    root.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    root.classList.add(`font-${this.settings.fontSize.replace('-', '-')}`);
  }
}

// Enhanced Search with Filters
class AdvancedSearch {
  constructor() {
    this.searchIndex = [];
    this.filters = {
      types: ['function', 'class', 'api', 'content'],
      language: ''
    };
    this.currentQuery = '';
    this.currentResults = [];
    
    this.init();
  }

  init() {
    this.buildSearchIndex();
    this.setupSearchInput();
    this.setupFilters();
  }

  buildSearchIndex() {
    // Enhanced search index building with more metadata
    const content = document.querySelector('.doc-content');
    if (!content) return;

    // Index functions
    const functionElements = content.querySelectorAll('[id*="function"], .function-doc, .card[id]');
    functionElements.forEach((element, index) => {
      const title = element.querySelector('h3, h4, .card-title')?.textContent || '';
      const description = element.querySelector('.card-subtitle, p')?.textContent || '';
      const language = this.detectLanguage(element);
      
      if (title) {
        this.searchIndex.push({
          id: `function-${index}`,
          type: 'function',
          title: title.trim(),
          content: description.trim(),
          language: language,
          element: element,
          url: `#${element.id || this.generateId(title)}`,
          keywords: this.extractKeywords(title + ' ' + description)
        });
      }
    });

    // Index API endpoints
    const apiElements = content.querySelectorAll('.api-endpoint');
    apiElements.forEach((element, index) => {
      const method = element.querySelector('.api-method')?.textContent || '';
      const path = element.querySelector('.api-path')?.textContent || '';
      const description = element.querySelector('.api-endpoint-header p')?.textContent || '';
      
      this.searchIndex.push({
        id: `api-${index}`,
        type: 'api',
        title: `${method} ${path}`,
        content: description.trim(),
        language: 'api',
        element: element,
        url: `#${element.id || this.generateId(method + path)}`,
        keywords: this.extractKeywords(method + ' ' + path + ' ' + description)
      });
    });

    // Index headings and content
    const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      const nextElement = heading.nextElementSibling;
      const content = nextElement?.textContent?.substring(0, 200) || '';
      
      this.searchIndex.push({
        id: `heading-${index}`,
        type: 'content',
        title: heading.textContent.trim(),
        content: content.trim(),
        language: '',
        element: heading,
        url: `#${heading.id || this.generateId(heading.textContent)}`,
        keywords: this.extractKeywords(heading.textContent + ' ' + content)
      });
    });
  }

  detectLanguage(element) {
    const codeBlocks = element.querySelectorAll('code[class*="language-"]');
    if (codeBlocks.length > 0) {
      const className = codeBlocks[0].className;
      const match = className.match(/language-(\w+)/);
      return match ? match[1] : '';
    }
    return '';
  }

  extractKeywords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10); // Limit keywords
  }

  setupSearchInput() {
    const searchInput = document.querySelector('.search-input.advanced-search');
    const clearBtn = document.querySelector('.search-clear-btn');
    
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      this.currentQuery = query;
      
      // Show/hide clear button
      if (clearBtn) {
        clearBtn.style.display = query ? 'block' : 'none';
      }
      
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.performSearch(query);
      }, 300);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.currentQuery = '';
        clearBtn.style.display = 'none';
        this.hideSearchResults();
      });
    }
  }

  setupFilters() {
    const filtersToggle = document.querySelector('.search-filters-toggle');
    const filtersContainer = document.querySelector('.search-filters');
    
    if (filtersToggle && filtersContainer) {
      filtersToggle.addEventListener('click', () => {
        const isVisible = filtersContainer.style.display !== 'none';
        filtersContainer.style.display = isVisible ? 'none' : 'block';
      });
    }

    // Type filters
    const typeCheckboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
    typeCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateFilters();
        if (this.currentQuery) {
          this.performSearch(this.currentQuery);
        }
      });
    });

    // Language filter
    const languageSelect = document.querySelector('.filter-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        this.updateFilters();
        if (this.currentQuery) {
          this.performSearch(this.currentQuery);
        }
      });
    }
  }

  updateFilters() {
    // Update type filters
    const typeCheckboxes = document.querySelectorAll('.filter-option input[type="checkbox"]:checked');
    this.filters.types = Array.from(typeCheckboxes).map(cb => cb.value);

    // Update language filter
    const languageSelect = document.querySelector('.filter-select');
    this.filters.language = languageSelect ? languageSelect.value : '';
  }

  performSearch(query) {
    if (!query || query.length < 2) {
      this.hideSearchResults();
      return;
    }

    const results = this.searchIndex.filter(item => {
      // Apply type filter
      if (this.filters.types.length > 0 && !this.filters.types.includes(item.type)) {
        return false;
      }

      // Apply language filter
      if (this.filters.language && item.language !== this.filters.language) {
        return false;
      }

      // Search in title, content, and keywords
      const searchText = (item.title + ' ' + item.content + ' ' + item.keywords.join(' ')).toLowerCase();
      const queryLower = query.toLowerCase();
      
      return searchText.includes(queryLower);
    })
    .sort((a, b) => {
      // Sort by relevance (title matches first, then content matches)
      const aTitle = a.title.toLowerCase().includes(query.toLowerCase());
      const bTitle = b.title.toLowerCase().includes(query.toLowerCase());
      
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      
      return 0;
    })
    .slice(0, 10); // Limit results

    this.currentResults = results;
    this.displaySearchResults(results, query);
  }

  displaySearchResults(results, query) {
    const resultsContainer = document.querySelector('.search-results-container');
    const resultsList = document.querySelector('.search-results-list');
    const noResults = document.querySelector('.search-no-results');
    const resultsCount = document.querySelector('.results-count');
    
    if (!resultsContainer || !resultsList) return;

    resultsContainer.style.display = 'block';

    if (results.length === 0) {
      resultsList.style.display = 'none';
      noResults.style.display = 'block';
      if (resultsCount) resultsCount.textContent = '0 results';
      return;
    }

    resultsList.style.display = 'block';
    noResults.style.display = 'none';
    if (resultsCount) resultsCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

    const html = results.map((result, index) => {
      const highlightedTitle = this.highlightSearchTerm(result.title, query);
      const highlightedContent = this.highlightSearchTerm(
        result.content.substring(0, 100) + (result.content.length > 100 ? '...' : ''), 
        query
      );
      const typeIcon = this.getTypeIcon(result.type);
      
      return `
        <div class="search-result" data-index="${index}" data-url="${result.url}">
          <div class="search-result-icon">${typeIcon}</div>
          <div class="search-result-content">
            <div class="search-result-title">${highlightedTitle}</div>
            ${highlightedContent ? `<div class="search-result-snippet">${highlightedContent}</div>` : ''}
            <div class="search-result-meta">
              <span class="search-result-type">${result.type}</span>
              ${result.language ? `<span class="search-result-path">${result.language}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    resultsList.innerHTML = html;

    // Add click handlers
    resultsList.querySelectorAll('.search-result').forEach(result => {
      result.addEventListener('click', () => {
        const url = result.dataset.url;
        if (url && url !== '#') {
          window.location.hash = url;
          this.hideSearchResults();
        }
      });
    });
  }

  highlightSearchTerm(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  getTypeIcon(type) {
    const icons = {
      function: '⚡',
      class: '📦',
      api: '🔌',
      content: '📄'
    };
    return icons[type] || '📄';
  }

  hideSearchResults() {
    const resultsContainer = document.querySelector('.search-results-container');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }
  }

  generateId(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }
}

// Reading Progress Tracker
class ReadingProgressTracker {
  constructor() {
    this.progressBar = document.querySelector('.progress-fill');
    this.progressText = document.querySelector('.progress-text');
    
    if (this.progressBar) {
      this.init();
    }
  }

  init() {
    this.updateProgress();
    window.addEventListener('scroll', () => this.updateProgress());
    window.addEventListener('resize', () => this.updateProgress());
  }

  updateProgress() {
    const content = document.querySelector('.doc-content');
    if (!content) return;

    const contentHeight = content.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollTop = window.pageYOffset;
    const contentTop = content.offsetTop;

    const scrollableHeight = contentHeight - windowHeight;
    const scrolled = Math.max(0, scrollTop - contentTop);
    const progress = Math.min(100, Math.max(0, (scrolled / scrollableHeight) * 100));

    if (this.progressBar) {
      this.progressBar.style.width = `${progress}%`;
    }

    if (this.progressText) {
      this.progressText.textContent = `${Math.round(progress)}% read`;
    }
  }
}

// Initialize enhanced components
document.addEventListener('DOMContentLoaded', () => {
  new AdvancedThemeManager();
  new AdvancedSearch();
  new ReadingProgressTracker();
});
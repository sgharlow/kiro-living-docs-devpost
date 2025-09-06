/**
 * Client-side Search Service
 * Handles communication with the server-side search API
 */

export class SearchService {
  constructor() {
    this.baseUrl = '/api/search';
  }

  /**
   * Perform a search query
   */
  async search(query) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query, limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Suggestions failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  /**
   * Get search history
   */
  async getHistory() {
    try {
      const response = await fetch(`${this.baseUrl}/history`);
      
      if (!response.ok) {
        throw new Error(`History failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error('History error:', error);
      return [];
    }
  }

  /**
   * Clear search history
   */
  async clearHistory() {
    try {
      const response = await fetch(`${this.baseUrl}/history`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Clear history failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear history error:', error);
      throw error;
    }
  }

  /**
   * Get saved searches
   */
  async getSavedSearches() {
    try {
      const response = await fetch(`${this.baseUrl}/saved`);
      
      if (!response.ok) {
        throw new Error(`Saved searches failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.savedSearches || [];
    } catch (error) {
      console.error('Saved searches error:', error);
      return [];
    }
  }

  /**
   * Save a search
   */
  async saveSearch(name, query) {
    try {
      const response = await fetch(`${this.baseUrl}/saved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, query })
      });

      if (!response.ok) {
        throw new Error(`Save search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Save search error:', error);
      throw error;
    }
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(id) {
    try {
      const response = await fetch(`${this.baseUrl}/saved/${id}/execute`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Execute saved search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Execute saved search error:', error);
      throw error;
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id) {
    try {
      const response = await fetch(`${this.baseUrl}/saved/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Delete saved search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Delete saved search error:', error);
      throw error;
    }
  }

  /**
   * Get search statistics
   */
  async getStatistics() {
    try {
      const response = await fetch(`${this.baseUrl}/statistics`);
      
      if (!response.ok) {
        throw new Error(`Statistics failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.statistics || {};
    } catch (error) {
      console.error('Statistics error:', error);
      return {};
    }
  }
}
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ProjectAnalysis, DocumentationOutput } from '../types';
import { ApiDocsGenerator } from '../generators/api-docs-generator.js';
import { OpenAPIGenerator } from '../generators/openapi-generator.js';
import { RealTimeSyncManager } from '../sync/real-time-sync.js';
import { SearchService, SearchQuery } from '../search/search-service.js';

export interface WebServerConfig {
    port: number;
    host?: string;
    staticPath?: string;
    enableSearch?: boolean;
}

export interface WebSocketMessage {
    type: 'update' | 'search' | 'status';
    data: any;
    timestamp: number;
}

export class WebServer {
    private app: express.Application;
    private server: any;
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private config: WebServerConfig;
    private currentAnalysis: ProjectAnalysis | null = null;
    private documentationOutput: DocumentationOutput | null = null;
    private apiDocsGenerator: ApiDocsGenerator;
    private openApiGenerator: OpenAPIGenerator;
    private syncManager: RealTimeSyncManager;
    private searchService: SearchService;

    constructor(config: WebServerConfig) {
        this.config = config;
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        this.apiDocsGenerator = new ApiDocsGenerator();
        this.openApiGenerator = new OpenAPIGenerator();
        this.syncManager = new RealTimeSyncManager();
        this.searchService = new SearchService();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupSyncManagerIntegration();
    }

    private setupMiddleware(): void {
        // Enable JSON parsing
        this.app.use(express.json());

        // Enable CORS for development
        this.app.use((_req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });

        // Serve static files if path is configured
        if (this.config.staticPath) {
            this.app.use('/static', express.static(this.config.staticPath));
        }

        // Serve real-time sync assets from templates directory
        this.app.use('/static/styles', express.static('src/templates/styles'));
        this.app.use('/static/scripts', express.static('src/templates/scripts'));
    }

    private setupRoutes(): void {
        // Main documentation page
        this.app.get('/', (_req, res) => {
            res.send(this.generateMainPage());
        });

        // API endpoint for current documentation
        this.app.get('/api/documentation', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.status(404).json({ error: 'No documentation available' });
            }

            return res.json({
                analysis: this.currentAnalysis,
                output: this.documentationOutput,
                lastUpdated: this.currentAnalysis.lastUpdated
            });
        });

        // Enhanced search endpoint
        this.app.post('/api/search', (req, res) => {
            try {
                const searchQuery: SearchQuery = req.body;
                
                if (!searchQuery.query || !this.currentAnalysis) {
                    return res.json({ results: [], suggestions: [], statistics: this.searchService.getStatistics() });
                }

                const results = this.searchService.search(searchQuery);
                const suggestions = this.searchService.getSuggestions(searchQuery.query, 5);
                
                return res.json({ 
                    results, 
                    query: searchQuery,
                    suggestions,
                    statistics: this.searchService.getStatistics()
                });
            } catch (error) {
                console.error('Search error:', error);
                return res.status(500).json({ error: 'Search failed', message: (error as Error).message });
            }
        });

        // Legacy search endpoint for backward compatibility
        this.app.get('/api/search', (req, res) => {
            const query = req.query.q as string;
            if (!query || !this.currentAnalysis) {
                return res.json({ results: [] });
            }

            const results = this.performSearch(query);
            return res.json({ results, query });
        });

        // Search suggestions endpoint
        this.app.get('/api/search/suggestions', (req, res) => {
            const query = req.query.q as string;
            const limit = parseInt(req.query.limit as string) || 10;
            
            if (!query) {
                return res.json({ suggestions: [] });
            }

            const suggestions = this.searchService.getSuggestions(query, limit);
            return res.json({ suggestions });
        });

        // Search history endpoints
        this.app.get('/api/search/history', (_req, res) => {
            const history = this.searchService.getHistory();
            return res.json({ history });
        });

        this.app.delete('/api/search/history', (_req, res) => {
            this.searchService.clearHistory();
            return res.json({ success: true });
        });

        // Saved searches endpoints
        this.app.get('/api/search/saved', (_req, res) => {
            const savedSearches = this.searchService.getSavedSearches();
            return res.json({ savedSearches });
        });

        this.app.post('/api/search/saved', (req, res) => {
            try {
                const { name, query } = req.body;
                const id = this.searchService.saveSearch(name, query);
                return res.json({ id, success: true });
            } catch (error) {
                return res.status(400).json({ error: 'Failed to save search', message: (error as Error).message });
            }
        });

        this.app.post('/api/search/saved/:id/execute', (req, res) => {
            try {
                const { id } = req.params;
                const results = this.searchService.executeSavedSearch(id);
                return res.json({ results });
            } catch (error) {
                return res.status(404).json({ error: 'Saved search not found', message: (error as Error).message });
            }
        });

        this.app.delete('/api/search/saved/:id', (req, res) => {
            try {
                const { id } = req.params;
                this.searchService.deleteSavedSearch(id);
                return res.json({ success: true });
            } catch (error) {
                return res.status(404).json({ error: 'Saved search not found', message: (error as Error).message });
            }
        });

        // Search statistics endpoint
        this.app.get('/api/search/statistics', (_req, res) => {
            const statistics = this.searchService.getStatistics();
            return res.json({ statistics });
        });

        // API documentation routes
        this.app.get('/api-docs', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.status(404).send('<h1>No API documentation available</h1><p>No project analysis found.</p>');
            }

            const apiDocsHtml = this.apiDocsGenerator.generateInteractiveApiDocs(this.currentAnalysis);
            res.setHeader('Content-Type', 'text/html');
            return res.send(apiDocsHtml);
        });

        // API documentation as markdown
        this.app.get('/api/api-docs/markdown', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.status(404).json({ error: 'No API documentation available' });
            }

            const markdown = this.apiDocsGenerator.generateApiDocsMarkdown(this.currentAnalysis);
            res.setHeader('Content-Type', 'text/markdown');
            return res.send(markdown);
        });

        // OpenAPI specification endpoints
        this.app.get('/api/openapi.json', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.status(404).json({ error: 'No API specification available' });
            }

            const spec = this.openApiGenerator.generateOpenAPISpec(this.currentAnalysis);
            return res.json(spec);
        });

        this.app.get('/api/openapi.yaml', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.status(404).send('# No API specification available');
            }

            const yaml = this.openApiGenerator.generateOpenAPIYaml(this.currentAnalysis);
            res.setHeader('Content-Type', 'text/yaml');
            return res.send(yaml);
        });

        // API endpoints listing
        this.app.get('/api/endpoints', (_req, res) => {
            if (!this.currentAnalysis) {
                return res.json({ endpoints: [] });
            }

            const endpoints: any[] = [];
            for (const [filePath, fileAnalysis] of this.currentAnalysis.files) {
                for (const endpoint of fileAnalysis.apiEndpoints) {
                    endpoints.push({
                        ...endpoint,
                        file: filePath,
                        examples: this.apiDocsGenerator.generateEndpointExamples(endpoint)
                    });
                }
            }

            return res.json({ endpoints });
        });

        // Health check endpoint
        this.app.get('/api/health', (_req, res) => {
            return res.json({
                status: 'healthy',
                uptime: process.uptime(),
                clients: this.clients.size,
                hasDocumentation: !!this.currentAnalysis
            });
        });

        // 404 handler
        this.app.use((_req, res) => {
            return res.status(404).json({ error: 'Not found' });
        });
    }

    private setupWebSocket(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = this.generateClientId();
            console.log(`New WebSocket client connected: ${clientId}`);
            
            // Register client with sync manager
            this.syncManager.registerClient(clientId, ws);
            this.clients.add(ws);

            // Send current documentation if available
            if (this.currentAnalysis) {
                this.sendToClient(ws, {
                    type: 'update',
                    data: {
                        analysis: this.currentAnalysis,
                        output: this.documentationOutput
                    },
                    timestamp: Date.now()
                });
            }

            // Clean up on disconnect
            ws.on('close', () => {
                console.log(`WebSocket client disconnected: ${clientId}`);
                this.syncManager.unregisterClient(clientId);
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for client ${clientId}:`, error);
                this.syncManager.unregisterClient(clientId);
                this.clients.delete(ws);
            });
        });
    }

    private setupSyncManagerIntegration(): void {
        // Listen for sync manager events
        this.syncManager.on('update-processed', (event) => {
            // Broadcast processed updates to legacy WebSocket clients
            this.broadcastToClients({
                type: 'update',
                data: { update: event.update },
                timestamp: Date.now()
            });
        });

        this.syncManager.on('conflict-detected', (event) => {
            console.log('Conflict detected:', event.conflict.filePath);
        });

        this.syncManager.on('conflict-resolved', (event) => {
            console.log('Conflict resolved:', event.conflict.filePath, 'using', event.resolution);
        });

        this.syncManager.on('client-connected', (event) => {
            console.log(`Sync client connected. Total clients: ${event.clientCount}`);
        });

        this.syncManager.on('client-disconnected', (event) => {
            console.log(`Sync client disconnected. Total clients: ${event.clientCount}`);
        });
    }

    // Legacy client message handler - now handled by sync manager
    // private handleClientMessage(ws: WebSocket, message: any): void {
    //     switch (message.type) {
    //         case 'search':
    //             if (message.query && this.currentAnalysis) {
    //                 const results = this.performSearch(message.query);
    //                 this.sendToClient(ws, {
    //                     type: 'search',
    //                     data: { results, query: message.query },
    //                     timestamp: Date.now()
    //                 });
    //             }
    //             break;

    //         case 'ping':
    //             this.sendToClient(ws, {
    //                 type: 'status',
    //                 data: { status: 'pong' },
    //                 timestamp: Date.now()
    //             });
    //             break;
    //     }
    // }

    private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private broadcastToClients(message: WebSocketMessage): void {
        this.clients.forEach(client => {
            this.sendToClient(client, message);
        });
    }

    private performSearch(query: string): any[] {
        if (!this.currentAnalysis) return [];

        const results: any[] = [];
        const searchTerm = query.toLowerCase();

        // Search through all analyzed files
        this.currentAnalysis.files.forEach((analysis, filePath) => {
            // Search functions
            analysis.functions.forEach(func => {
                if (func.name.toLowerCase().includes(searchTerm) ||
                    func.description?.toLowerCase().includes(searchTerm)) {
                    results.push({
                        type: 'function',
                        name: func.name,
                        file: filePath,
                        line: func.startLine,
                        description: func.description,
                        score: this.calculateSearchScore(func.name, searchTerm)
                    });
                }
            });

            // Search classes
            analysis.classes.forEach(cls => {
                if (cls.name.toLowerCase().includes(searchTerm) ||
                    cls.description?.toLowerCase().includes(searchTerm)) {
                    results.push({
                        type: 'class',
                        name: cls.name,
                        file: filePath,
                        line: cls.startLine,
                        description: cls.description,
                        score: this.calculateSearchScore(cls.name, searchTerm)
                    });
                }
            });

            // Search interfaces
            analysis.interfaces.forEach(iface => {
                if (iface.name.toLowerCase().includes(searchTerm) ||
                    iface.description?.toLowerCase().includes(searchTerm)) {
                    results.push({
                        type: 'interface',
                        name: iface.name,
                        file: filePath,
                        line: iface.startLine,
                        description: iface.description,
                        score: this.calculateSearchScore(iface.name, searchTerm)
                    });
                }
            });
        });

        // Sort by relevance score
        return results.sort((a, b) => b.score - a.score).slice(0, 50);
    }

    private calculateSearchScore(text: string, searchTerm: string): number {
        const lowerText = text.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();

        if (lowerText === lowerSearch) return 100;
        if (lowerText.startsWith(lowerSearch)) return 80;
        if (lowerText.includes(lowerSearch)) return 60;

        // Fuzzy matching score
        let score = 0;
        let searchIndex = 0;
        for (let i = 0; i < lowerText.length && searchIndex < lowerSearch.length; i++) {
            if (lowerText[i] === lowerSearch[searchIndex]) {
                score += 1;
                searchIndex++;
            }
        }

        return (score / lowerSearch.length) * 40;
    }

    private generateMainPage(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Living Documentation</title>
    <link rel="stylesheet" href="/static/styles/documentation.css">
    <link rel="stylesheet" href="/static/styles/advanced-search.css">
    <link rel="stylesheet" href="/static/styles/real-time-sync.css">
</head>
<body>
    <div class="header">
        <h1>Living Documentation</h1>
    </div>
    
    <div class="container">
        <div id="status" class="status disconnected">
            Connecting to documentation server...
        </div>
        
        <!-- Advanced Search Interface -->
        <div id="advancedSearchContainer" class="search-container">
            <!-- Will be populated by SearchUI -->
        </div>
        
        <div class="content">
            <div id="documentation" class="loading">
                Loading documentation...
            </div>
        </div>
    </div>

    <script type="module">
        import { SearchService } from '/static/scripts/search-service.js';
        import { SearchUI } from '/static/scripts/search-ui.js';
        
        class DocumentationClient {
            constructor() {
                this.ws = null;
                this.statusEl = document.getElementById('status');
                this.documentationEl = document.getElementById('documentation');
                this.searchService = new SearchService();
                this.searchUI = null;
                
                this.connect();
                this.setupSearch();
            }
            
            connect() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}\`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    this.updateStatus('Connected to documentation server', 'connected');
                };
                
                this.ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                };
                
                this.ws.onclose = () => {
                    this.updateStatus('Disconnected from server. Attempting to reconnect...', 'disconnected');
                    setTimeout(() => this.connect(), 3000);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.updateStatus('Connection error', 'disconnected');
                };
            }
            
            setupSearch() {
                const container = document.getElementById('advancedSearchContainer');
                if (container) {
                    this.searchUI = new SearchUI(this.searchService, {
                        container: container,
                        placeholder: 'Search documentation... (Ctrl+K)',
                        showFilters: true,
                        showHistory: true,
                        showSavedSearches: true
                    });
                    
                    // Listen for search result selections
                    container.addEventListener('search-result-selected', (event) => {
                        this.handleSearchResultSelected(event.detail.result);
                    });
                }
            }
            
            handleSearchResultSelected(result) {
                // Navigate to the selected result
                console.log('Selected search result:', result);
                // You could implement navigation logic here
                // For example: window.location.hash = \`#\${result.file}:\${result.line}\`;
            }
            
            updateStatus(message, type) {
                this.statusEl.textContent = message;
                this.statusEl.className = \`status \${type}\`;
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'update':
                        this.updateDocumentation(message.data);
                        break;
                }
            }
            
            updateDocumentation(data) {
                if (data.analysis) {
                    // Update search index
                    if (this.searchUI) {
                        this.searchUI.updateSearchIndex(data.analysis);
                    }
                    
                    const fileCount = data.analysis.files ? data.analysis.files.size || Object.keys(data.analysis.files).length : 0;
                    this.documentationEl.innerHTML = \`
                        <div class="doc-overview">
                            <h2>Project: \${data.analysis.metadata.name || 'Unknown'}</h2>
                            <div class="project-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Languages:</span>
                                    <span class="stat-value">\${data.analysis.metadata.languages.join(', ')}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Files analyzed:</span>
                                    <span class="stat-value">\${fileCount}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Last updated:</span>
                                    <span class="stat-value">\${new Date(data.analysis.lastUpdated).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="doc-links">
                            <h3>Available Documentation</h3>
                            <div class="link-grid">
                                <a href="/api-docs" target="_blank" class="doc-link">
                                    <div class="link-icon">📚</div>
                                    <div class="link-content">
                                        <div class="link-title">Interactive API Documentation</div>
                                        <div class="link-description">Browse API endpoints with examples</div>
                                    </div>
                                </a>
                                <a href="/api/api-docs/markdown" target="_blank" class="doc-link">
                                    <div class="link-icon">📝</div>
                                    <div class="link-content">
                                        <div class="link-title">API Documentation (Markdown)</div>
                                        <div class="link-description">Raw markdown format</div>
                                    </div>
                                </a>
                                <a href="/api/openapi.json" target="_blank" class="doc-link">
                                    <div class="link-icon">🔧</div>
                                    <div class="link-content">
                                        <div class="link-title">OpenAPI Specification (JSON)</div>
                                        <div class="link-description">Machine-readable API spec</div>
                                    </div>
                                </a>
                                <a href="/api/openapi.yaml" target="_blank" class="doc-link">
                                    <div class="link-icon">📄</div>
                                    <div class="link-content">
                                        <div class="link-title">OpenAPI Specification (YAML)</div>
                                        <div class="link-description">Human-readable API spec</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        
                        <div class="doc-info">
                            <p>📡 Documentation is being generated in real-time as you modify your code.</p>
                            <p>🔍 Use the search above to quickly find functions, classes, and content.</p>
                        </div>
                    \`;
                } else {
                    this.documentationEl.innerHTML = \`
                        <div class="doc-empty">
                            <div class="empty-icon">📝</div>
                            <h3>No documentation available yet</h3>
                            <p>Start editing your code to generate documentation automatically.</p>
                        </div>
                    \`;
                }
            }
        }
        
        // Initialize the client when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            new DocumentationClient();
        });
    </script>
    <script src="/static/scripts/real-time-client.js"></script>
</body>
</html>
    `;
    }

    public updateDocumentation(analysis: ProjectAnalysis, output?: DocumentationOutput): void {
        this.currentAnalysis = analysis;
        this.documentationOutput = output || null;

        // Update search index with new analysis
        this.searchService.updateIndex(analysis);

        // Create a project-level update for the sync manager
        const update = {
            id: this.generateUpdateId(),
            type: 'project' as const,
            content: JSON.stringify({ analysis, output }),
            timestamp: Date.now(),
            source: 'auto' as const,
            checksum: this.calculateChecksum(JSON.stringify(analysis))
        };

        // Queue the update through the sync manager
        this.syncManager.queueUpdate(update);

        // Also broadcast to legacy WebSocket clients
        this.broadcastToClients({
            type: 'update',
            data: {
                analysis: this.currentAnalysis,
                output: this.documentationOutput
            },
            timestamp: Date.now()
        });

        console.log(`Documentation updated for ${analysis.metadata.name}, broadcasting to ${this.clients.size} clients`);
    }

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host || 'localhost', (error?: Error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Web server started on http://${this.config.host || 'localhost'}:${this.config.port}`);
                    resolve();
                }
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            // Close all WebSocket connections
            this.clients.forEach(client => {
                client.close();
            });
            this.clients.clear();

            // Close WebSocket server
            this.wss.close(() => {
                // Close HTTP server
                this.server.close(() => {
                    console.log('Web server stopped');
                    resolve();
                });
            });
        });
    }

    public getClientCount(): number {
        return this.clients.size;
    }

    public isRunning(): boolean {
        return this.server.listening;
    }

    /**
     * Get the sync manager instance for external access
     */
    public getSyncManager(): RealTimeSyncManager {
        return this.syncManager;
    }

    /**
     * Get current sync status
     */
    public getSyncStatus() {
        return this.syncManager.getStatus();
    }

    /**
     * Get pending conflicts
     */
    public getPendingConflicts() {
        return this.syncManager.getPendingConflicts();
    }

    /**
     * Process a file change through the sync manager
     */
    public processFileChange(change: any): void {
        this.syncManager.processFileChange(change, this.currentAnalysis || undefined);
    }

    /**
     * Handle manual documentation updates
     */
    public handleManualUpdate(filePath: string, content: string): void {
        this.syncManager.handleManualUpdate(filePath, content);
    }

    /**
     * Generate a unique client ID
     */
    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a unique update ID
     */
    private generateUpdateId(): string {
        return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Calculate checksum for content
     */
    private calculateChecksum(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
}
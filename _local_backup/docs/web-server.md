# web-server.ts

## Overview

This file contains 1 class, 2 interfaces.

## Table of Contents

### Interfaces
- [WebServerConfig](#webserverconfig)
- [WebSocketMessage](#websocketmessage)

### Classes
- [WebServer](#webserver)

### API Endpoints
- [GET /](#get--)
- [GET /api/documentation](#get--api-documentation)
- [POST /api/search](#post--api-search)
- [GET /api/search](#get--api-search)
- [GET /api/search/suggestions](#get--api-search-suggestions)
- [GET /api/search/history](#get--api-search-history)
- [DELETE /api/search/history](#delete--api-search-history)
- [GET /api/search/saved](#get--api-search-saved)
- [POST /api/search/saved](#post--api-search-saved)
- [POST /api/search/saved/:id/execute](#post--api-search-saved--id-execute)
- [DELETE /api/search/saved/:id](#delete--api-search-saved--id)
- [GET /api/search/statistics](#get--api-search-statistics)
- [GET /api-docs](#get--api-docs)
- [GET /api/api-docs/markdown](#get--api-api-docs-markdown)
- [GET /api/openapi.json](#get--api-openapi-json)
- [GET /api/openapi.yaml](#get--api-openapi-yaml)
- [GET /api/endpoints](#get--api-endpoints)
- [GET /api/health](#get--api-health)

## Interfaces

### WebServerConfig (exported)

```typescript
interface WebServerConfig {
  port: number;
  host?: string;
  staticPath?: string;
  enableSearch?: boolean;
}
```


### WebSocketMessage (exported)

```typescript
interface WebSocketMessage {
  type: 'update' | 'search' | 'status';
  data: any;
  timestamp: number;
}
```


## Classes

### WebServer (exported)

```typescript
class WebServer
```

**Properties:**

- **app**: express.Application
- **server**: any
- **wss**: WebSocketServer
- **clients**: Set<WebSocket>
- **config**: WebServerConfig
- **currentAnalysis**: ProjectAnalysis | null
- **documentationOutput**: DocumentationOutput | null
- **apiDocsGenerator**: ApiDocsGenerator
- **openApiGenerator**: OpenAPIGenerator
- **syncManager**: RealTimeSyncManager
- **searchService**: SearchService

**Methods:**

- **setupMiddleware**
  ```typescript
  setupMiddleware(): void
  ```

- **setupRoutes**
  ```typescript
  setupRoutes(): void
  ```

- **setupWebSocket**
  ```typescript
  setupWebSocket(): void
  ```

- **setupSyncManagerIntegration**
  ```typescript
  setupSyncManagerIntegration(): void
  ```

- **sendToClient**
  ```typescript
  sendToClient(ws: WebSocket, message: WebSocketMessage): void
  ```

- **broadcastToClients**
  ```typescript
  broadcastToClients(message: WebSocketMessage): void
  ```

- **performSearch**
  ```typescript
  performSearch(query: string): any[]
  ```

- **calculateSearchScore**
  ```typescript
  calculateSearchScore(text: string, searchTerm: string): number
  ```

- **generateMainPage**
  ```typescript
  generateMainPage(): string
  ```

- **updateDocumentation**
  ```typescript
  updateDocumentation(analysis: ProjectAnalysis, output?: DocumentationOutput): void
  ```

- **start**
  ```typescript
  start(): Promise<void>
  ```

- **stop**
  ```typescript
  stop(): Promise<void>
  ```

- **getClientCount**
  ```typescript
  getClientCount(): number
  ```

- **isRunning**
  ```typescript
  isRunning(): boolean
  ```

- **getSyncManager**
  ```typescript
  getSyncManager(): RealTimeSyncManager
  ```

- **getSyncStatus**
  ```typescript
  getSyncStatus()
  ```

- **getPendingConflicts**
  ```typescript
  getPendingConflicts()
  ```

- **processFileChange**
  ```typescript
  processFileChange(change: any): void
  ```

- **handleManualUpdate**
  ```typescript
  handleManualUpdate(filePath: string, content: string): void
  ```

- **generateClientId**
  ```typescript
  generateClientId(): string
  ```

- **generateUpdateId**
  ```typescript
  generateUpdateId(): string
  ```

- **calculateChecksum**
  ```typescript
  calculateChecksum(content: string): string
  ```


## Dependencies

This file imports from the following modules:

- **express** (default): express
- **http** (named): createServer
- **ws** (named): WebSocketServer, WebSocket
- **../types** (named): ProjectAnalysis, DocumentationOutput
- **../generators/api-docs-generator.js** (named): ApiDocsGenerator
- **../generators/openapi-generator.js** (named): OpenAPIGenerator
- **../sync/real-time-sync.js** (named): RealTimeSyncManager
- **../search/search-service.js** (named): SearchService, SearchQuery

## Exports

This file exports:

- **WebServerConfig** (interface)
- **WebSocketMessage** (interface)
- **WebServer** (class)

## API Endpoints

### GET /

**Handler:** `anonymous`

**Example:**

```http
GET /
```


### GET /api/documentation

**Handler:** `anonymous`

**Example:**

```http
GET /api/documentation
```


### POST /api/search

**Handler:** `anonymous`

**Example:**

```http
POST /api/search
```


### GET /api/search

**Handler:** `anonymous`

**Example:**

```http
GET /api/search
```


### GET /api/search/suggestions

**Handler:** `anonymous`

**Example:**

```http
GET /api/search/suggestions
```


### GET /api/search/history

**Handler:** `anonymous`

**Example:**

```http
GET /api/search/history
```


### DELETE /api/search/history

**Handler:** `anonymous`

**Example:**

```http
DELETE /api/search/history
```


### GET /api/search/saved

**Handler:** `anonymous`

**Example:**

```http
GET /api/search/saved
```


### POST /api/search/saved

**Handler:** `anonymous`

**Example:**

```http
POST /api/search/saved
```


### POST /api/search/saved/:id/execute

**Handler:** `anonymous`

**Parameters:**

- **id** `string` - Path parameter from /api/search/saved/:id/execute

**Example:**

```http
POST /api/search/saved/:id/execute
```


### DELETE /api/search/saved/:id

**Handler:** `anonymous`

**Parameters:**

- **id** `string` - Path parameter from /api/search/saved/:id

**Example:**

```http
DELETE /api/search/saved/:id
```


### GET /api/search/statistics

**Handler:** `anonymous`

**Example:**

```http
GET /api/search/statistics
```


### GET /api-docs

**Handler:** `anonymous`

**Example:**

```http
GET /api-docs
```


### GET /api/api-docs/markdown

**Handler:** `anonymous`

**Example:**

```http
GET /api/api-docs/markdown
```


### GET /api/openapi.json

**Handler:** `anonymous`

**Example:**

```http
GET /api/openapi.json
```


### GET /api/openapi.yaml

**Handler:** `anonymous`

**Example:**

```http
GET /api/openapi.yaml
```


### GET /api/endpoints

**Handler:** `anonymous`

**Example:**

```http
GET /api/endpoints
```


### GET /api/health

**Handler:** `anonymous`

**Example:**

```http
GET /api/health
```


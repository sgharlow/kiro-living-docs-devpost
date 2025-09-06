#!/usr/bin/env node

const { ArchitectureGenerator } = require('../dist/generators/architecture-generator.js');
const { TypeScriptAnalyzer } = require('../dist/analyzers/typescript-analyzer.js');
const fs = require('fs');
const path = require('path');

async function testArchitectureDiagrams() {
  console.log('🏗️  Testing Architecture Diagram Generation...\n');

  try {
    // Create sample project structure for testing
    const sampleFiles = {
      'src/index.ts': `
        import { App } from './App';
        import { config } from './config';
        
        const app = new App(config);
        app.start();
      `,
      'src/App.ts': `
        import { UserService } from './services/UserService';
        import { ApiClient } from './utils/ApiClient';
        import { Logger } from './utils/Logger';
        
        export class App {
          private userService: UserService;
          private logger: Logger;
          
          constructor(config: any) {
            this.logger = new Logger();
            this.userService = new UserService(new ApiClient(config.apiUrl));
          }
          
          async start(): Promise<void> {
            this.logger.info('Starting application...');
            await this.userService.initialize();
          }
        }
      `,
      'src/services/UserService.ts': `
        import { ApiClient } from '../utils/ApiClient';
        import { User } from '../models/User';
        import { IUserRepository } from '../interfaces/IUserRepository';
        
        export class UserService implements IUserRepository {
          constructor(private apiClient: ApiClient) {}
          
          async getUser(id: string): Promise<User> {
            return this.apiClient.get(\`/users/\${id}\`);
          }
          
          async createUser(userData: Partial<User>): Promise<User> {
            return this.apiClient.post('/users', userData);
          }
          
          async initialize(): Promise<void> {
            // Initialize service
          }
        }
      `,
      'src/services/AuthService.ts': `
        import { ApiClient } from '../utils/ApiClient';
        import { Logger } from '../utils/Logger';
        
        export class AuthService {
          constructor(
            private apiClient: ApiClient,
            private logger: Logger
          ) {}
          
          async login(email: string, password: string): Promise<string> {
            this.logger.info('Attempting login...');
            return this.apiClient.post('/auth/login', { email, password });
          }
          
          async logout(): Promise<void> {
            await this.apiClient.post('/auth/logout');
          }
        }
      `,
      'src/utils/ApiClient.ts': `
        import { Logger } from './Logger';
        
        export class ApiClient {
          private logger = new Logger();
          
          constructor(private baseUrl: string) {}
          
          async get(endpoint: string): Promise<any> {
            this.logger.debug(\`GET \${endpoint}\`);
            // HTTP GET implementation
          }
          
          async post(endpoint: string, data: any): Promise<any> {
            this.logger.debug(\`POST \${endpoint}\`);
            // HTTP POST implementation
          }
        }
      `,
      'src/utils/Logger.ts': `
        export class Logger {
          info(message: string): void {
            console.log(\`[INFO] \${message}\`);
          }
          
          debug(message: string): void {
            console.log(\`[DEBUG] \${message}\`);
          }
          
          error(message: string, error?: Error): void {
            console.error(\`[ERROR] \${message}\`, error);
          }
        }
      `,
      'src/models/User.ts': `
        export interface User {
          id: string;
          name: string;
          email: string;
          createdAt: Date;
          updatedAt: Date;
        }
        
        export class UserModel implements User {
          constructor(
            public id: string,
            public name: string,
            public email: string,
            public createdAt: Date = new Date(),
            public updatedAt: Date = new Date()
          ) {}
          
          update(data: Partial<User>): void {
            Object.assign(this, data);
            this.updatedAt = new Date();
          }
        }
      `,
      'src/interfaces/IUserRepository.ts': `
        import { User } from '../models/User';
        
        export interface IUserRepository {
          getUser(id: string): Promise<User>;
          createUser(userData: Partial<User>): Promise<User>;
        }
      `,
      'src/components/UserCard.tsx': `
        import React from 'react';
        import { User } from '../models/User';
        
        interface UserCardProps {
          user: User;
          onEdit: (user: User) => void;
        }
        
        export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
          return (
            <div className="user-card">
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <button onClick={() => onEdit(user)}>Edit</button>
            </div>
          );
        };
      `,
      'src/components/UserList.tsx': `
        import React, { useState, useEffect } from 'react';
        import { UserCard } from './UserCard';
        import { User } from '../models/User';
        import { UserService } from '../services/UserService';
        
        interface UserListProps {
          userService: UserService;
        }
        
        export const UserList: React.FC<UserListProps> = ({ userService }) => {
          const [users, setUsers] = useState<User[]>([]);
          
          useEffect(() => {
            // Load users
          }, []);
          
          return (
            <div className="user-list">
              {users.map(user => (
                <UserCard key={user.id} user={user} onEdit={() => {}} />
              ))}
            </div>
          );
        };
      `,
      'src/config.ts': `
        export const config = {
          apiUrl: process.env.API_URL || 'http://localhost:3000/api',
          logLevel: process.env.LOG_LEVEL || 'info',
          port: parseInt(process.env.PORT || '8080'),
        };
      `,
      'tests/services/UserService.test.ts': `
        import { UserService } from '../../src/services/UserService';
        import { ApiClient } from '../../src/utils/ApiClient';
        
        describe('UserService', () => {
          let userService: UserService;
          let mockApiClient: jest.Mocked<ApiClient>;
          
          beforeEach(() => {
            mockApiClient = {
              get: jest.fn(),
              post: jest.fn(),
            } as any;
            userService = new UserService(mockApiClient);
          });
          
          it('should get user by id', async () => {
            const mockUser = { id: '1', name: 'John', email: 'john@example.com' };
            mockApiClient.get.mockResolvedValue(mockUser);
            
            const result = await userService.getUser('1');
            expect(result).toEqual(mockUser);
          });
        });
      `,
    };

    // Analyze all files
    console.log('📊 Analyzing project structure...');
    const analyzer = new TypeScriptAnalyzer();
    const analysisResults = new Map();

    for (const [filePath, content] of Object.entries(sampleFiles)) {
      const analysis = analyzer.analyze(filePath, content);
      analysisResults.set(filePath, analysis);
    }

    console.log(`✅ Analyzed ${analysisResults.size} files`);

    // Create project analysis
    const projectAnalysis = {
      metadata: {
        name: 'Sample Architecture Project',
        version: '1.0.0',
        description: 'A sample project demonstrating architecture diagram generation',
        languages: ['typescript', 'tsx'],
        framework: 'React',
      },
      structure: {
        directories: ['src', 'src/services', 'src/utils', 'src/models', 'src/interfaces', 'src/components', 'tests'],
        files: Object.keys(sampleFiles),
        entryPoints: ['src/index.ts'],
        testFiles: ['tests/services/UserService.test.ts'],
        configFiles: ['src/config.ts'],
      },
      files: analysisResults,
      lastUpdated: new Date(),
    };

    // Generate architecture documentation
    console.log('\n🏗️  Generating architecture documentation...');
    const architectureGenerator = new ArchitectureGenerator();
    
    const documentation = architectureGenerator.generateArchitectureDocumentation(
      projectAnalysis,
      {
        includeTests: false,
        includeExternal: false,
        maxDiagramComplexity: 'medium',
        diagramTypes: ['dependency_graph', 'architecture_layers', 'module_clusters'],
      }
    );

    console.log(`✅ Generated ${documentation.diagrams.length} diagrams`);

    // Display results
    console.log('\n📈 Architecture Metrics:');
    console.log(`  - Total Modules: ${documentation.metrics.totalModules}`);
    console.log(`  - Total Dependencies: ${documentation.metrics.totalDependencies}`);
    console.log(`  - Average Dependencies per Module: ${documentation.metrics.averageDependenciesPerModule.toFixed(1)}`);
    console.log(`  - Maintainability Index: ${documentation.metrics.maintainabilityIndex.toFixed(1)}/100`);
    console.log(`  - Cohesion Score: ${documentation.metrics.cohesionScore.toFixed(1)}/10`);
    console.log(`  - Coupling Score: ${documentation.metrics.couplingScore.toFixed(1)}/10`);
    console.log(`  - Complexity Score: ${documentation.metrics.complexityScore.toFixed(1)}/10`);

    if (documentation.metrics.cyclicDependencies.length > 0) {
      console.log(`  - Cyclic Dependencies: ${documentation.metrics.cyclicDependencies.length}`);
    }

    if (documentation.metrics.layerViolations.length > 0) {
      console.log(`  - Layer Violations: ${documentation.metrics.layerViolations.length}`);
    }

    // Display dependency graph info
    console.log('\n🔗 Dependency Graph:');
    console.log(`  - Modules: ${documentation.dependencyGraph.modules.size}`);
    console.log(`  - Relations: ${documentation.dependencyGraph.relations.length}`);
    console.log(`  - Clusters: ${documentation.dependencyGraph.clusters.length}`);
    console.log(`  - Layers: ${documentation.dependencyGraph.layers.length}`);
    console.log(`  - Entry Points: ${documentation.dependencyGraph.entryPoints.length}`);

    // Display clusters
    if (documentation.dependencyGraph.clusters.length > 0) {
      console.log('\n📦 Module Clusters:');
      for (const cluster of documentation.dependencyGraph.clusters) {
        console.log(`  - ${cluster.name}: ${cluster.modules.length} modules (${cluster.type})`);
      }
    }

    // Display layers
    console.log('\n🏗️  Architecture Layers:');
    for (let i = 0; i < documentation.dependencyGraph.layers.length; i++) {
      const layer = documentation.dependencyGraph.layers[i];
      console.log(`  - Layer ${i + 1}: ${layer.length} modules`);
      for (const filePath of layer.slice(0, 3)) { // Show first 3 modules
        const module = documentation.dependencyGraph.modules.get(filePath);
        if (module) {
          console.log(`    • ${module.name} (${module.category})`);
        }
      }
      if (layer.length > 3) {
        console.log(`    ... and ${layer.length - 3} more`);
      }
    }

    // Display generated diagrams
    console.log('\n📊 Generated Diagrams:');
    for (const diagram of documentation.diagrams) {
      console.log(`\n  📈 ${diagram.title}`);
      console.log(`     Type: ${diagram.type}`);
      console.log(`     Complexity: ${diagram.complexity}`);
      console.log(`     Nodes: ${diagram.nodeCount}, Edges: ${diagram.edgeCount}`);
      console.log(`     Description: ${diagram.description}`);
      
      // Show a snippet of the Mermaid code
      const lines = diagram.mermaidCode.split('\n');
      console.log(`     Mermaid Preview (first 5 lines):`);
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        console.log(`       ${lines[i]}`);
      }
      if (lines.length > 5) {
        console.log(`       ... (${lines.length - 5} more lines)`);
      }
    }

    // Display recommendations
    if (documentation.recommendations.length > 0) {
      console.log('\n💡 Architecture Recommendations:');
      for (const recommendation of documentation.recommendations) {
        console.log(`  - ${recommendation}`);
      }
    }

    // Generate and save documentation
    console.log('\n💾 Saving documentation...');
    
    const markdownDoc = architectureGenerator.generateArchitectureMarkdown(documentation);
    fs.writeFileSync('architecture-documentation.md', markdownDoc);
    console.log('✅ Saved architecture documentation to architecture-documentation.md');

    // Save individual diagrams
    for (let i = 0; i < documentation.diagrams.length; i++) {
      const diagram = documentation.diagrams[i];
      const filename = `diagram-${i + 1}-${diagram.type.replace('_', '-')}.mmd`;
      fs.writeFileSync(filename, diagram.mermaidCode);
      console.log(`✅ Saved ${diagram.title} to ${filename}`);
    }

    // Performance summary
    console.log('\n⚡ Performance Summary:');
    console.log(`  - Analysis completed for ${analysisResults.size} files`);
    console.log(`  - Generated ${documentation.diagrams.length} diagrams`);
    console.log(`  - Documentation size: ${Math.round(markdownDoc.length / 1024)}KB`);
    console.log(`  - Total Mermaid code: ${documentation.diagrams.reduce((sum, d) => sum + d.mermaidCode.length, 0)} characters`);

    console.log('\n🎉 Architecture Diagram Generation Test Completed Successfully!');
    
    console.log('\n📋 Generated Files:');
    console.log('  - architecture-documentation.md (Complete documentation)');
    for (let i = 0; i < documentation.diagrams.length; i++) {
      const diagram = documentation.diagrams[i];
      console.log(`  - diagram-${i + 1}-${diagram.type.replace('_', '-')}.mmd (${diagram.title})`);
    }
    
    console.log('\n💡 Next Steps:');
    console.log('  1. Open the .mmd files in a Mermaid-compatible viewer');
    console.log('  2. Review the architecture documentation markdown file');
    console.log('  3. Use the diagrams in your project documentation');
    console.log('  4. Consider implementing the architecture recommendations');

  } catch (error) {
    console.error('❌ Architecture diagram generation test failed:', error);
    process.exit(1);
  }
}

// Run the test
testArchitectureDiagrams();
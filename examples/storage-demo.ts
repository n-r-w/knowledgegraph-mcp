#!/usr/bin/env node

/**
 * Demo script showing different storage backends for the Knowledge Graph MCP Server
 */

import { KnowledgeGraphManager, Entity, Relation } from '../index.js';
import { StorageConfig, StorageType, DataMigrationService } from '../storage/index.js';
import path from 'path';

const __dirname = path.join(process.cwd(), 'examples');

// Sample data for demonstration
const sampleEntities: Entity[] = [
  {
    name: 'JavaScript',
    entityType: 'Programming Language',
    observations: [
      'Dynamic typing',
      'Prototype-based inheritance',
      'First-class functions',
      'Event-driven programming'
    ],
    tags: ['web', 'frontend', 'backend', 'popular']
  },
  {
    name: 'Node.js',
    entityType: 'Runtime Environment',
    observations: [
      'Server-side JavaScript',
      'Event-driven architecture',
      'Non-blocking I/O',
      'NPM package manager'
    ],
    tags: ['backend', 'server', 'javascript', 'runtime']
  },
  {
    name: 'TypeScript',
    entityType: 'Programming Language',
    observations: [
      'Superset of JavaScript',
      'Static typing',
      'Compile-time type checking',
      'Better IDE support'
    ],
    tags: ['web', 'frontend', 'backend', 'typed', 'microsoft']
  }
];

const sampleRelations: Relation[] = [
  {
    from: 'Node.js',
    to: 'JavaScript',
    relationType: 'runs'
  },
  {
    from: 'TypeScript',
    to: 'JavaScript',
    relationType: 'compiles_to'
  }
];

async function demonstratePostgreSQLStorage() {
  console.log('\n=== PostgreSQL Storage Demo ===');

  const config: StorageConfig = {
    type: StorageType.POSTGRESQL,
    connectionString: 'postgresql://postgres:password@localhost:5432/knowledgegraph_demo'
  };

  const manager = new KnowledgeGraphManager(config);

  try {
    // Create entities and relations
    await manager.createEntities(sampleEntities, 'demo_project');
    await manager.createRelations(sampleRelations, 'demo_project');

    // Read back the data
    const graph = await manager.readGraph('demo_project');
    console.log(`Stored ${graph.entities.length} entities and ${graph.relations.length} relations`);

    // Search functionality
    const searchResults = await manager.searchNodes('JavaScript', 'demo_project');
    console.log(`Search for 'JavaScript' found ${searchResults.entities.length} entities`);

    // Health check
    const isHealthy = await manager.healthCheck();
    console.log(`Storage health: ${isHealthy ? 'OK' : 'FAILED'}`);

  } finally {
    await manager.close();
  }
}

// MySQL storage support has been removed
// Only PostgreSQL is supported in this version
// SQLite support will be restored in a future version

// Storage migration demo removed since MySQL support was removed
// Migration functionality will be restored when SQLite support is added back

async function demonstrateEnvironmentConfiguration() {
  console.log('\n=== Environment Configuration Demo ===');

  // Save original environment
  const originalStorageType = process.env.KNOWLEDGEGRAPH_STORAGE_TYPE;
  const originalDbPath = process.env.KNOWLEDGEGRAPH_DB_PATH;

  try {
    // Set environment variables
    process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = 'postgresql';
    process.env.KNOWLEDGEGRAPH_CONNECTION_STRING = 'postgresql://postgres:password@localhost:5432/knowledgegraph_env';

    // Create manager without explicit config (will use environment)
    const manager = new KnowledgeGraphManager();

    await manager.createEntities([sampleEntities[0]], 'env_demo');
    const graph = await manager.readGraph('env_demo');

    console.log(`Environment-configured storage contains ${graph.entities.length} entities`);
    console.log('Successfully used environment variable configuration');

    await manager.close();

  } finally {
    // Restore original environment
    if (originalStorageType !== undefined) {
      process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = originalStorageType;
    } else {
      delete process.env.KNOWLEDGEGRAPH_STORAGE_TYPE;
    }

    if (originalDbPath !== undefined) {
      process.env.KNOWLEDGEGRAPH_DB_PATH = originalDbPath;
    } else {
      delete process.env.KNOWLEDGEGRAPH_DB_PATH;
    }
  }
}

async function main() {
  console.log('Knowledge Graph MCP Server - Storage Backend Demonstration');
  console.log('================================================');
  console.log('Note: Only PostgreSQL is supported in this version');
  console.log('SQLite support will be restored in a future version');

  try {
    await demonstratePostgreSQLStorage();
    await demonstrateEnvironmentConfiguration();

    console.log('\n=== Demo Complete ===');
    console.log('PostgreSQL storage backend demonstrated successfully!');

  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);

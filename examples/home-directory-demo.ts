#!/usr/bin/env node

/**
 * Home Directory SQLite Demo
 *
 * This example demonstrates the new default behavior where SQLite databases
 * are automatically created in the user's home directory under .knowledge-graph/
 */

import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';
import { getDefaultSQLitePath, resolveSQLiteConnectionString } from '../utils.js';
import { homedir } from 'os';
import { join } from 'path';

async function homeDirectoryDemo() {
  console.log('🏠 Home Directory SQLite Demo');
  console.log('==============================\n');

  // Show the default path that will be used
  console.log('📁 Default SQLite path:', getDefaultSQLitePath());
  console.log('🔗 Default connection string:', resolveSQLiteConnectionString());
  console.log('🏠 User home directory:', homedir());
  console.log('📂 Knowledge graph directory:', join(homedir(), '.knowledge-graph'));
  console.log();

  // Create knowledge graph manager with default SQLite configuration
  console.log('🔧 Creating KnowledgeGraphManager with default SQLite settings...');
  const manager = new KnowledgeGraphManager({
    type: StorageType.SQLITE,
    connectionString: resolveSQLiteConnectionString(), // Use default home directory path
    fuzzySearch: {
      useDatabaseSearch: false, // SQLite uses client-side search
      threshold: 0.3,
      clientSideFallback: true
    }
  });

  try {
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('✅ Manager initialized successfully!');
    console.log();

    // Create some test data
    console.log('📝 Creating test entities...');
    await manager.createEntities([
      {
        name: 'Home Directory Test',
        entityType: 'Demo',
        observations: ['This entity was created using the default home directory path'],
        tags: ['demo', 'home-directory']
      },
      {
        name: 'SQLite Default Path',
        entityType: 'Configuration',
        observations: ['SQLite database is now stored in ~/.knowledge-graph/ by default'],
        tags: ['sqlite', 'configuration']
      }
    ]);

    console.log('✅ Test entities created successfully!');
    console.log();

    // Read back the data
    console.log('📖 Reading back the data...');
    const graph = await manager.readGraph();
    console.log(`📊 Found ${graph.entities.length} entities and ${graph.relations.length} relations`);

    graph.entities.forEach(entity => {
      console.log(`   • ${entity.name} (${entity.entityType})`);
      console.log(`     Tags: ${entity.tags?.join(', ') || 'none'}`);
      console.log(`     Observations: ${entity.observations.length}`);
    });

    console.log();

    // Test search functionality
    console.log('🔍 Testing search functionality...');
    const searchResults = await manager.searchNodes('home directory');
    console.log(`🎯 Search for "home directory" found ${searchResults.entities.length} results`);

    searchResults.entities.forEach(entity => {
      console.log(`   • ${entity.name}`);
    });

    console.log();

    // Show environment variable override example
    console.log('🔧 Environment Variable Override Example:');
    console.log('   To use a custom path, set:');
    console.log('   KNOWLEDGEGRAPH_SQLITE_PATH=/custom/path/to/database.db');
    console.log();
    console.log('   Or in Claude Desktop config:');
    console.log('   "env": {');
    console.log('     "KNOWLEDGEGRAPH_STORAGE_TYPE": "sqlite",');
    console.log('     "KNOWLEDGEGRAPH_SQLITE_PATH": "/custom/path/to/database.db"');
    console.log('   }');

    console.log();
    console.log('✅ Demo completed successfully!');
    console.log('📁 Your data is stored in:', getDefaultSQLitePath());

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await manager.close();
  }
}

// Test with environment variable override
async function testEnvironmentOverride() {
  console.log('\n🔧 Testing Environment Variable Override');
  console.log('========================================\n');

  // Set custom path
  const originalPath = process.env.KNOWLEDGEGRAPH_SQLITE_PATH;
  process.env.KNOWLEDGEGRAPH_SQLITE_PATH = './custom-demo-database.db';

  console.log('📁 Custom SQLite path:', getDefaultSQLitePath());
  console.log('🔗 Custom connection string:', resolveSQLiteConnectionString());

  // Create manager with custom path
  const manager = new KnowledgeGraphManager({
    type: StorageType.SQLITE,
    connectionString: resolveSQLiteConnectionString(), // Will use the custom path from environment
    fuzzySearch: {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true
    }
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 500));

    await manager.createEntities([{
      name: 'Custom Path Test',
      entityType: 'Demo',
      observations: ['This entity was created using a custom database path'],
      tags: ['demo', 'custom-path']
    }]);

    console.log('✅ Custom path test completed successfully!');
    console.log('📁 Data stored in custom location:', getDefaultSQLitePath());

  } catch (error) {
    console.error('❌ Custom path test failed:', error);
  } finally {
    await manager.close();
    // Restore original environment
    if (originalPath) {
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = originalPath;
    } else {
      delete process.env.KNOWLEDGEGRAPH_SQLITE_PATH;
    }
  }
}

async function main() {
  try {
    await homeDirectoryDemo();
    await testEnvironmentOverride();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

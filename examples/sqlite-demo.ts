#!/usr/bin/env node

/**
 * SQLite Storage Demo
 *
 * This example demonstrates how to use the knowledge graph MCP service
 * with SQLite storage backend for lightweight deployments.
 */

import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';

async function sqliteDemo() {
  console.log('🗄️  SQLite Storage Demo');
  console.log('========================\n');

  // Create knowledge graph manager with SQLite storage
  // This will use the default home directory path: ~/.knowledge-graph/knowledgegraph.db
  // For demo purposes, we'll use in-memory database
  const manager = new KnowledgeGraphManager({
    type: StorageType.SQLITE,
    connectionString: 'sqlite://:memory:', // In-memory database for demo
    fuzzySearch: {
      useDatabaseSearch: false, // SQLite uses client-side search
      threshold: 0.3,
      clientSideFallback: true
    }
  });

  console.log('💡 Note: In production, SQLite will automatically use ~/.knowledge-graph/knowledgegraph.db');
  console.log('💡 You can override this with KNOWLEDGEGRAPH_SQLITE_PATH environment variable\n');

  try {
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('✅ SQLite storage initialized successfully\n');

    // Add some entities
    console.log('📝 Adding entities...');
    await manager.createEntities([
      { name: 'JavaScript', entityType: 'programming-language', observations: ['Dynamic typing', 'Prototype-based'], tags: ['web', 'frontend'] },
      { name: 'TypeScript', entityType: 'programming-language', observations: ['Static typing', 'Superset of JavaScript'], tags: ['web', 'frontend', 'types'] },
      { name: 'React', entityType: 'framework', observations: ['Component-based', 'Virtual DOM'], tags: ['web', 'frontend', 'ui'] },
      { name: 'Node.js', entityType: 'runtime', observations: ['Server-side JavaScript', 'Event-driven'], tags: ['backend', 'server'] }
    ]);

    // Add some relations
    console.log('🔗 Adding relations...');
    await manager.createRelations([
      { from: 'TypeScript', to: 'JavaScript', relationType: 'extends' },
      { from: 'React', to: 'JavaScript', relationType: 'uses' },
      { from: 'Node.js', to: 'JavaScript', relationType: 'runs' }
    ]);

    console.log('✅ Data added successfully\n');

    // Test exact search
    console.log('🔍 Testing exact search...');
    const exactResults = await manager.searchNodes('JavaScript');
    console.log(`Found ${exactResults.entities.length} entities with exact search:`);
    exactResults.entities.forEach(entity => {
      console.log(`  - ${entity.name} (${entity.entityType})`);
    });
    console.log();

    // Test fuzzy search
    console.log('🔍 Testing fuzzy search...');
    const fuzzyResults = await manager.searchNodes('JavaScrpt', { // Intentional typo
      searchMode: 'fuzzy',
      fuzzyThreshold: 0.6
    });
    console.log(`Found ${fuzzyResults.entities.length} entities with fuzzy search for "JavaScrpt":`);
    fuzzyResults.entities.forEach(entity => {
      console.log(`  - ${entity.name} (${entity.entityType})`);
    });
    console.log();

    // Test tag search
    console.log('🏷️  Testing tag search...');
    const tagResults = await manager.searchNodes('', {
      exactTags: ['frontend'],
      tagMatchMode: 'any'
    });
    console.log(`Found ${tagResults.entities.length} entities with tag "frontend":`);
    tagResults.entities.forEach(entity => {
      console.log(`  - ${entity.name} (tags: ${entity.tags.join(', ')})`);
    });
    console.log();

    // Get full graph
    console.log('📊 Full knowledge graph:');
    const fullGraph = await manager.readGraph();
    console.log(`Total entities: ${fullGraph.entities.length}`);
    console.log(`Total relations: ${fullGraph.relations.length}`);

    console.log('\nRelations:');
    fullGraph.relations.forEach((relation: any) => {
      console.log(`  ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
    });

    console.log('\n🎉 SQLite demo completed successfully!');
    console.log('\n💡 Key benefits of SQLite storage:');
    console.log('   • No external database required');
    console.log('   • Perfect for development and testing');
    console.log('   • Lightweight and fast for small datasets');
    console.log('   • File-based persistence or in-memory operation');
    console.log('   • Client-side fuzzy search with Fuse.js');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up
    await manager.close();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  sqliteDemo().catch(console.error);
}

export { sqliteDemo };

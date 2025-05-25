#!/usr/bin/env node

import { KnowledgeGraphManager, Entity, Relation } from '../index.js';
import { StorageConfig, StorageType } from '../storage/types.js';
import path from 'path';

const __dirname = path.join(process.cwd(), 'examples');

// Sample entities with tags for demonstration
const sampleEntities: Entity[] = [
  {
    name: 'React',
    entityType: 'JavaScript Library',
    observations: [
      'Component-based architecture',
      'Virtual DOM for performance',
      'Developed by Meta (Facebook)',
      'Declarative programming model'
    ],
    tags: ['frontend', 'javascript', 'ui', 'popular', 'meta']
  },
  {
    name: 'Vue.js',
    entityType: 'JavaScript Framework',
    observations: [
      'Progressive framework',
      'Easy learning curve',
      'Excellent documentation',
      'Template-based syntax'
    ],
    tags: ['frontend', 'javascript', 'ui', 'progressive', 'beginner-friendly']
  },
  {
    name: 'Django',
    entityType: 'Python Framework',
    observations: [
      'Batteries-included philosophy',
      'ORM for database operations',
      'Admin interface out of the box',
      'MTV (Model-Template-View) pattern'
    ],
    tags: ['backend', 'python', 'web', 'orm', 'admin']
  },
  {
    name: 'Express.js',
    entityType: 'Node.js Framework',
    observations: [
      'Minimal and flexible',
      'Middleware-based architecture',
      'Fast and unopinionated',
      'Large ecosystem'
    ],
    tags: ['backend', 'javascript', 'nodejs', 'minimal', 'middleware']
  },
  {
    name: 'PostgreSQL',
    entityType: 'Database',
    observations: [
      'ACID compliant',
      'Advanced SQL features',
      'Extensible with custom functions',
      'Strong consistency guarantees'
    ],
    tags: ['database', 'sql', 'relational', 'acid', 'enterprise']
  },
  {
    name: 'MongoDB',
    entityType: 'Database',
    observations: [
      'Document-oriented storage',
      'Flexible schema',
      'Horizontal scaling',
      'JSON-like documents'
    ],
    tags: ['database', 'nosql', 'document', 'scalable', 'json']
  }
];

const sampleRelations: Relation[] = [
  { from: 'React', to: 'Vue.js', relationType: 'competes_with' },
  { from: 'Express.js', to: 'Django', relationType: 'alternative_to' },
  { from: 'React', to: 'Express.js', relationType: 'often_used_with' },
  { from: 'Django', to: 'PostgreSQL', relationType: 'commonly_uses' },
  { from: 'Express.js', to: 'MongoDB', relationType: 'frequently_paired_with' }
];

async function demonstrateTagSystem() {
  console.log('🏷️  Knowledge Graph MCP Server - Tag System Demonstration');
  console.log('========================================================\n');

  const config: StorageConfig = {
    type: StorageType.POSTGRESQL,
    connectionString: 'postgresql://postgres:password@localhost:5432/knowledgegraph_tag_demo'
  };

  const manager = new KnowledgeGraphManager(config);

  try {
    // 1. Create entities with tags
    console.log('1️⃣  Creating entities with tags...');
    await manager.createEntities(sampleEntities, 'tag_demo');
    await manager.createRelations(sampleRelations, 'tag_demo');
    console.log(`✅ Created ${sampleEntities.length} entities and ${sampleRelations.length} relations\n`);

    // 2. Demonstrate tag search - exact matching
    console.log('2️⃣  Searching by tags (exact matching)...');

    // Search for frontend technologies
    const frontendResults = await manager.searchNodes('', { exactTags: ['frontend'], tagMatchMode: 'any' }, 'tag_demo');
    console.log(`🔍 Frontend technologies (${frontendResults.entities.length} found):`);
    frontendResults.entities.forEach(entity => {
      console.log(`   • ${entity.name} (${entity.entityType}) - Tags: [${entity.tags?.join(', ') || 'none'}]`);
    });
    console.log();

    // Search for JavaScript technologies
    const jsResults = await manager.searchNodes('', { exactTags: ['javascript'], tagMatchMode: 'any' }, 'tag_demo');
    console.log(`🔍 JavaScript technologies (${jsResults.entities.length} found):`);
    jsResults.entities.forEach(entity => {
      console.log(`   • ${entity.name} (${entity.entityType}) - Tags: [${entity.tags?.join(', ') || 'none'}]`);
    });
    console.log();

    // Search for databases
    const dbResults = await manager.searchNodes('', { exactTags: ['database'], tagMatchMode: 'any' }, 'tag_demo');
    console.log(`🔍 Database technologies (${dbResults.entities.length} found):`);
    dbResults.entities.forEach(entity => {
      console.log(`   • ${entity.name} (${entity.entityType}) - Tags: [${entity.tags?.join(', ') || 'none'}]`);
    });
    console.log();

    // 3. Demonstrate "all" mode search
    console.log('3️⃣  Searching with "all" mode (must have ALL specified tags)...');
    const frontendJsResults = await manager.searchNodes('', { exactTags: ['frontend', 'javascript'], tagMatchMode: 'all' }, 'tag_demo');
    console.log(`🔍 Frontend + JavaScript technologies (${frontendJsResults.entities.length} found):`);
    frontendJsResults.entities.forEach(entity => {
      console.log(`   • ${entity.name} - Tags: [${entity.tags?.join(', ') || 'none'}]`);
    });
    console.log();

    // 4. Demonstrate adding tags
    console.log('4️⃣  Adding new tags to existing entities...');
    const addTagsResult = await manager.addTags([
      { entityName: 'React', tags: ['hooks', 'jsx'] },
      { entityName: 'Vue.js', tags: ['composition-api', 'reactive'] },
      { entityName: 'PostgreSQL', tags: ['open-source'] }
    ], 'tag_demo');

    addTagsResult.forEach(result => {
      console.log(`✅ Added tags to ${result.entityName}: [${result.addedTags.join(', ')}]`);
    });
    console.log();

    // 5. Show updated entities
    console.log('5️⃣  Updated entities after adding tags...');
    const updatedGraph = await manager.readGraph('tag_demo');
    const reactEntity = updatedGraph.entities.find(e => e.name === 'React');
    const vueEntity = updatedGraph.entities.find(e => e.name === 'Vue.js');
    const pgEntity = updatedGraph.entities.find(e => e.name === 'PostgreSQL');

    console.log(`📝 React tags: [${reactEntity?.tags?.join(', ') || 'none'}]`);
    console.log(`📝 Vue.js tags: [${vueEntity?.tags?.join(', ') || 'none'}]`);
    console.log(`📝 PostgreSQL tags: [${pgEntity?.tags?.join(', ') || 'none'}]`);
    console.log();

    // 6. Demonstrate removing tags
    console.log('6️⃣  Removing tags from entities...');
    const removeTagsResult = await manager.removeTags([
      { entityName: 'React', tags: ['meta'] },
      { entityName: 'MongoDB', tags: ['json'] }
    ], 'tag_demo');

    removeTagsResult.forEach(result => {
      console.log(`🗑️  Removed tags from ${result.entityName}: [${result.removedTags.join(', ')}]`);
    });
    console.log();

    // 7. Demonstrate enhanced search (includes tags in general search)
    console.log('7️⃣  Enhanced search (includes tags in general text search)...');
    const enhancedResults = await manager.searchNodes('nosql', 'tag_demo');
    console.log(`🔍 Search for "nosql" (${enhancedResults.entities.length} found):`);
    enhancedResults.entities.forEach(entity => {
      console.log(`   • ${entity.name} - Found via tags: [${entity.tags?.join(', ') || 'none'}]`);
    });
    console.log();

    // 8. Demonstrate case sensitivity
    console.log('8️⃣  Demonstrating case sensitivity in tag search...');
    const caseSensitiveResults = await manager.searchNodes('', { exactTags: ['Frontend'], tagMatchMode: 'any' }, 'tag_demo'); // Capital F
    console.log(`🔍 Search for "Frontend" (capital F): ${caseSensitiveResults.entities.length} found`);
    console.log('   (Tags are case-sensitive for exact matching)\n');

    // 9. Show final state
    console.log('9️⃣  Final knowledge graph state...');
    const finalGraph = await manager.readGraph('tag_demo');
    console.log(`📊 Total entities: ${finalGraph.entities.length}`);
    console.log(`📊 Total relations: ${finalGraph.relations.length}`);
    console.log(`📊 Total unique tags: ${[...new Set(finalGraph.entities.flatMap(e => e.tags))].length}`);

    const allTags = [...new Set(finalGraph.entities.flatMap(e => e.tags))].sort();
    console.log(`🏷️  All tags: [${allTags.join(', ')}]`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    await manager.close();
  }

  console.log('\n🎉 Tag system demonstration completed successfully!');
  console.log('\nKey Features Demonstrated:');
  console.log('• ✅ Exact-match tag searching (case-sensitive)');
  console.log('• ✅ "Any" and "All" search modes');
  console.log('• ✅ Adding and removing tags from existing entities');
  console.log('• ✅ Enhanced general search that includes tags');
  console.log('• ✅ Backward compatibility with entities without tags');
  console.log('• ✅ Duplicate tag prevention');
  console.log('• ✅ Relation preservation in filtered results');
}

// Run the demonstration
demonstrateTagSystem().catch(console.error);

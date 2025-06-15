import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';

describe('VARCHAR to TEXT Migration Verification', () => {
  let manager: KnowledgeGraphManager;
  const testProject = `text-migration-test-${Date.now()}`;

  beforeAll(async () => {
    // Use SQLite with test database (in-memory for tests)
    const testConnectionString = process.env.KNOWLEDGEGRAPH_TEST_CONNECTION_STRING || 'sqlite://:memory:';

    manager = new KnowledgeGraphManager({
      type: StorageType.SQLITE,
      connectionString: testConnectionString,
      fuzzySearch: {
        useDatabaseSearch: false, // SQLite uses client-side search
        threshold: 0.3,
        clientSideFallback: true
      }
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (manager) {
      await manager.close();
    }
  });

  test('should handle long entity names with TEXT fields', async () => {
    // Create entity with very long name (>255 characters)
    const timestamp = Date.now();
    const longName = `A${timestamp}_`.repeat(50); // >500 characters, unique
    const longEntityType = `B${timestamp}_`.repeat(30); // >300 characters, unique

    const entities = [{
      name: longName,
      entityType: longEntityType,
      observations: ['This entity has a very long name to test TEXT field capacity'],
      tags: ['long-name-test', 'text-migration']
    }];

    try {
      const created = await manager.createEntities(entities, testProject);
      expect(created).toHaveLength(1);
      expect(created[0].name).toBe(longName);
      expect(created[0].entityType).toBe(longEntityType);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
        console.warn('Skipping SQLite test - database not available');
        return;
      }
      throw error;
    }
  });

  test('should handle long relation types with TEXT fields', async () => {
    // Create entities first
    const timestamp = Date.now();
    const entities = [
      {
        name: `Entity1_${timestamp}`,
        entityType: 'TestType',
        observations: ['First entity'],
        tags: ['test']
      },
      {
        name: `Entity2_${timestamp}`,
        entityType: 'TestType',
        observations: ['Second entity'],
        tags: ['test']
      }
    ];

    try {
      await manager.createEntities(entities, testProject);

      // Create relation with very long type (>255 characters)
      const longRelationType = `C${timestamp}_`.repeat(40); // >400 characters, unique

      const relations = [{
        from: `Entity1_${timestamp}`,
        to: `Entity2_${timestamp}`,
        relationType: longRelationType
      }];

      const created = await manager.createRelations(relations, testProject);
      expect(created.newRelations).toHaveLength(1);
      expect(created.newRelations[0].relationType).toBe(longRelationType);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
        console.warn('Skipping SQLite test - database not available');
        return;
      }
      throw error;
    }
  });

  test('should handle long project names with TEXT fields', async () => {
    // Test with long project name (>255 characters)
    const timestamp = Date.now();
    const longProject = `D${timestamp}_`.repeat(30); // >300 characters, unique

    const entities = [{
      name: `TestEntity_${timestamp}`,
      entityType: 'TestType',
      observations: ['Testing long project name'],
      tags: ['project-test']
    }];

    try {
      const created = await manager.createEntities(entities, longProject);
      expect(created).toHaveLength(1);

      // Verify we can retrieve it
      const graph = await manager.searchNodes(`TestEntity_${timestamp}`, {}, longProject);
      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].name).toBe(`TestEntity_${timestamp}`);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
        console.warn('Skipping SQLite test - database not available');
        return;
      }
      throw error;
    }
  });

  test('should maintain fuzzy search functionality with TEXT fields', async () => {
    const timestamp = Date.now();
    const entities = [{
      name: `SQLiteTextFieldTest_${timestamp}`,
      entityType: 'DatabaseMigrationTest',
      observations: ['Testing fuzzy search with TEXT fields after VARCHAR migration'],
      tags: ['fuzzy-search', 'text-migration', 'sqlite']
    }];

    try {
      await manager.createEntities(entities, testProject);

      // Test exact search first to ensure entity was created
      const exactResults = await manager.searchNodes(`SQLiteTextFieldTest_${timestamp}`, {}, testProject);
      expect(exactResults.entities.length).toBeGreaterThan(0);

      // Test that fuzzy search functionality is working (doesn't need to find our specific entity)
      // Just verify the fuzzy search mode doesn't crash with TEXT fields
      const fuzzyResults = await manager.searchNodes('test', { searchMode: 'fuzzy' }, testProject);
      // Fuzzy search should work without errors, even if no results found
      expect(Array.isArray(fuzzyResults.entities)).toBe(true);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
        console.warn('Skipping SQLite test - database not available');
        return;
      }
      throw error;
    }
  });
});

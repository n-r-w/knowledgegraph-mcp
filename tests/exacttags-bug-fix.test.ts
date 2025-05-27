import { KnowledgeGraphManager } from '../core.js';
import { Entity } from '../core.js';

describe('ExactTags Bug Fix', () => {
  let manager: KnowledgeGraphManager;
  const testProject = 'exacttags_bug_test';

  beforeEach(async () => {
    manager = new KnowledgeGraphManager();

    // Create test entities with tags
    const testEntities: Entity[] = [
      {
        name: 'Test_Entity_1',
        entityType: 'project',
        observations: ['First test entity'],
        tags: ['testing', 'bug-fix']
      },
      {
        name: 'Test_Entity_2',
        entityType: 'technology',
        observations: ['Second test entity'],
        tags: ['testing', 'feature']
      },
      {
        name: 'Test_Entity_3',
        entityType: 'person',
        observations: ['Third test entity'],
        tags: ['development']
      }
    ];

    await manager.createEntities(testEntities, testProject);
  });

  afterEach(async () => {
    // Clean up test data
    await manager.deleteEntities(['Test_Entity_1', 'Test_Entity_2', 'Test_Entity_3'], testProject);
    await manager.close();
  });

  describe('Bug Fix: exactTags without query parameter', () => {
    it('should allow search with only exactTags (no query parameter)', async () => {
      // This was the failing case from the bug report
      const result = await manager.searchNodes('', { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_1');
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_2');
    });

    it('should work with empty string query and exactTags', async () => {
      const result = await manager.searchNodes('', { exactTags: ['development'] }, testProject);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Test_Entity_3');
    });

    it('should work with tagMatchMode "all"', async () => {
      const result = await manager.searchNodes('', {
        exactTags: ['testing', 'bug-fix'],
        tagMatchMode: 'all'
      }, testProject);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Test_Entity_1');
    });

    it('should work with tagMatchMode "any" (default)', async () => {
      const result = await manager.searchNodes('', {
        exactTags: ['testing', 'development'],
        tagMatchMode: 'any'
      }, testProject);

      expect(result.entities).toHaveLength(3);
    });

    it('should return empty results for non-existent tags', async () => {
      const result = await manager.searchNodes('', { exactTags: ['nonexistent'] }, testProject);

      expect(result.entities).toHaveLength(0);
    });
  });

  describe('Negative test cases', () => {
    it('should handle null query with exactTags', async () => {
      const result = await manager.searchNodes(null as any, { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_1');
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_2');
    });

    it('should handle undefined query with exactTags', async () => {
      const result = await manager.searchNodes(undefined as any, { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_1');
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_2');
    });

    it('should handle empty array query with exactTags', async () => {
      const result = await manager.searchNodes([], { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(0); // Empty array should return no results
    });

    it('should handle array with empty strings and exactTags', async () => {
      const result = await manager.searchNodes(['', ''], { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2); // Should work with empty strings when exactTags provided
    });

    it('should handle whitespace-only query with exactTags', async () => {
      const result = await manager.searchNodes('   ', { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2); // Should work with whitespace when exactTags provided
    });

    it('should handle empty exactTags array', async () => {
      const result = await manager.searchNodes('', { exactTags: [] }, testProject);

      expect(result.entities).toHaveLength(3); // Should fall back to normal search behavior
    });

    it('should handle null exactTags', async () => {
      const result = await manager.searchNodes('Test_Entity_1', { exactTags: null as any }, testProject);

      expect(result.entities).toHaveLength(1); // Should work as normal query
      expect(result.entities[0].name).toBe('Test_Entity_1');
    });

    it('should handle undefined exactTags', async () => {
      const result = await manager.searchNodes('Test_Entity_1', { exactTags: undefined }, testProject);

      expect(result.entities).toHaveLength(1); // Should work as normal query
      expect(result.entities[0].name).toBe('Test_Entity_1');
    });
  });

  describe('Backward compatibility', () => {
    it('should still work with query + exactTags (original workaround)', async () => {
      const result = await manager.searchNodes('any', { exactTags: ['testing'] }, testProject);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_1');
      expect(result.entities.map(e => e.name)).toContain('Test_Entity_2');
    });

    it('should still work with normal query searches', async () => {
      const result = await manager.searchNodes('Test_Entity_1', testProject);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Test_Entity_1');
    });

    it('should still work with fuzzy searches', async () => {
      const result = await manager.searchNodes('Test_Entty', { searchMode: 'fuzzy' }, testProject);

      expect(result.entities.length).toBeGreaterThan(0);
    });
  });
});

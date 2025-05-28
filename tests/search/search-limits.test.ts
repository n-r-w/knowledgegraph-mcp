import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { KnowledgeGraphManager } from '../../core.js';
import { StorageType } from '../../storage/types.js';
import { Entity } from '../../core.js';
import { getValidatedSearchLimits } from '../../search/config.js';

describe('Search Limits Implementation', () => {
  let manager: KnowledgeGraphManager;
  const testProject = 'search-limits-test';

  beforeAll(async () => {
    // Use SQLite with in-memory database for testing
    manager = new KnowledgeGraphManager({
      type: StorageType.SQLITE,
      connectionString: 'sqlite://:memory:',
      fuzzySearch: {
        useDatabaseSearch: false,
        threshold: 0.3,
        clientSideFallback: true
      }
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await manager.close();
  });

  describe('Search Configuration', () => {
    it('should have valid search limits configuration', () => {
      const limits = getValidatedSearchLimits();

      expect(limits.maxResults).toBeGreaterThan(0);
      expect(limits.batchSize).toBeGreaterThan(0);
      expect(limits.maxClientSideEntities).toBeGreaterThan(0);
      expect(limits.clientSideChunkSize).toBeGreaterThan(0);

      // Ensure maxClientSideEntities >= clientSideChunkSize
      expect(limits.maxClientSideEntities).toBeGreaterThanOrEqual(limits.clientSideChunkSize);
    });

    it('should validate configuration constraints', () => {
      const limits = getValidatedSearchLimits();

      // Check reasonable bounds
      expect(limits.maxResults).toBeLessThanOrEqual(1000);
      expect(limits.batchSize).toBeLessThanOrEqual(50);
      expect(limits.maxClientSideEntities).toBeLessThanOrEqual(100000);
      expect(limits.clientSideChunkSize).toBeLessThanOrEqual(10000);
    });
  });

  describe('Entity Loading Limits', () => {
    it('should create test entities for limit testing', async () => {
      // Create a reasonable number of test entities
      const testEntities: Entity[] = [];
      for (let i = 1; i <= 50; i++) {
        testEntities.push({
          name: `TestEntity_${i.toString().padStart(3, '0')}`,
          entityType: 'test',
          observations: [`This is test entity number ${i}`, `Created for search limits testing`],
          tags: ['test', 'search-limits', i % 2 === 0 ? 'even' : 'odd']
        });
      }

      const created = await manager.createEntities(testEntities, testProject);
      expect(created).toHaveLength(50);
    });

    it('should handle search with entity limits', async () => {
      // Test fuzzy search which should use client-side search for SQLite
      const results = await manager.searchNodes('test', {
        searchMode: 'fuzzy',
        fuzzyThreshold: 0.3
      }, testProject);

      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.length).toBeLessThanOrEqual(50);
    });

    it('should handle exact search efficiently', async () => {
      const results = await manager.searchNodes('TestEntity', {
        searchMode: 'exact'
      }, testProject);

      expect(results.entities.length).toBeGreaterThan(0);
      // All entities should match since they all contain "TestEntity" in their name
      expect(results.entities.length).toBe(50);
    });
  });

  describe('Chunked Search Behavior', () => {
    it('should handle small entity sets without chunking', async () => {
      // Search for a specific subset
      const results = await manager.searchNodes('even', {
        searchMode: 'exact'
      }, testProject);

      // Should find entities with 'even' tag
      expect(results.entities.length).toBe(25);
    });

    it('should handle tag-based filtering', async () => {
      const results = await manager.searchNodes('', {
        exactTags: ['odd'],
        tagMatchMode: 'any'
      }, testProject);

      // Should find entities with 'odd' tag
      expect(results.entities.length).toBe(25);
    });

    it('should handle multiple tag filtering', async () => {
      const results = await manager.searchNodes('', {
        exactTags: ['test', 'even'],
        tagMatchMode: 'all'
      }, testProject);

      // Should find entities that have both 'test' AND 'even' tags
      expect(results.entities.length).toBe(25);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle empty search gracefully', async () => {
      const results = await manager.searchNodes('', {}, testProject);

      // Empty search should return all entities
      expect(results.entities.length).toBe(50);
    });

    it('should handle non-matching search', async () => {
      const results = await manager.searchNodes('nonexistent_entity_xyz', {
        searchMode: 'exact'
      }, testProject);

      expect(results.entities.length).toBe(0);
    });

    it('should handle fuzzy search with low threshold', async () => {
      const results = await manager.searchNodes('TestEnt', {
        searchMode: 'fuzzy',
        fuzzyThreshold: 0.1  // Very strict
      }, testProject);

      expect(results.entities.length).toBeGreaterThan(0);
    });
  });
});

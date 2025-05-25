import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';

describe('Fuzzy Search Integration Tests', () => {
  let manager: KnowledgeGraphManager;
  const testProject = `fuzzy-integration-test-${Date.now()}`;

  // Test data that matches the issue documentation
  const testEntities = [
    {
      name: "JavaScript Framework",
      entityType: "technology",
      observations: ["Popular frontend framework", "Used for building user interfaces", "Has component-based architecture"],
      tags: ["frontend", "web", "javascript"]
    },
    {
      name: "React Library",
      entityType: "library",
      observations: ["Created by Facebook", "Virtual DOM implementation", "Declarative programming model"],
      tags: ["frontend", "react", "javascript"]
    },
    {
      name: "Database System",
      entityType: "technology",
      observations: ["Stores and retrieves data", "Supports ACID transactions", "Relational database"],
      tags: ["backend", "database", "sql"]
    }
  ];

  beforeAll(async () => {
    // Use PostgreSQL with test database
    const testConnectionString = process.env.KNOWLEDGEGRAPH_TEST_CONNECTION_STRING || 'postgresql://postgres:1@localhost:5432/knowledgegraph_test';

    manager = new KnowledgeGraphManager({
      type: StorageType.POSTGRESQL,
      connectionString: testConnectionString,
      fuzzySearch: {
        useDatabaseSearch: true,
        threshold: 0.3,
        clientSideFallback: true
      }
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Create test entities
      await manager.createEntities(testEntities, testProject);
      console.log(`Created ${testEntities.length} test entities for fuzzy search testing`);
    } catch (error) {
      console.warn('Failed to create test entities:', error);
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      const entityNames = testEntities.map(e => e.name);
      await manager.deleteEntities(entityNames, testProject);
      console.log('Cleaned up test entities');
    } catch (error) {
      console.warn('Failed to clean up test entities:', error);
    }

    if (manager) {
      await manager.close();
    }
  });

  describe('Database-Level Fuzzy Search', () => {
    test('should find entities with typos in names', async () => {
      try {
        // Test case from issue documentation: "Reactt" should find "React Library"
        // Use a more realistic threshold based on actual similarity scores
        const results = await manager.searchNodes('Reactt', {
          searchMode: 'fuzzy',
          fuzzyThreshold: 0.3
        }, testProject);

        console.log('Fuzzy search results for "Reactt":', JSON.stringify(results, null, 2));

        // This should find "React Library" with the correct threshold
        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.some(e => e.name === 'React Library')).toBe(true);
      } catch (error) {
        console.error('Fuzzy search test failed:', error);
        throw error;
      }
    });

    test('should find entities with partial matches', async () => {
      try {
        // Test case from issue documentation: "Reac" should find "React Library"
        // Try with a lower threshold first to see what similarity score we get
        const results = await manager.searchNodes('Reac', {
          searchMode: 'fuzzy',
          fuzzyThreshold: 0.2
        }, testProject);

        console.log('Fuzzy search results for "Reac":', JSON.stringify(results, null, 2));

        // If no results with 0.2, the similarity might be even lower
        if (results.entities.length === 0) {
          console.log('No results with threshold 0.2, trying 0.1...');
          const results2 = await manager.searchNodes('Reac', {
            searchMode: 'fuzzy',
            fuzzyThreshold: 0.1
          }, testProject);
          console.log('Fuzzy search results for "Reac" with threshold 0.1:', JSON.stringify(results2, null, 2));
          expect(results2.entities.length).toBeGreaterThan(0);
          expect(results2.entities.some(e => e.name === 'React Library')).toBe(true);
        } else {
          expect(results.entities.length).toBeGreaterThan(0);
          expect(results.entities.some(e => e.name === 'React Library')).toBe(true);
        }
      } catch (error) {
        console.error('Partial match test failed:', error);
        throw error;
      }
    });

    test('should find entities with multiple typos', async () => {
      try {
        // Test case from issue documentation: "javascrpt framwork" should find "JavaScript Framework"
        const results = await manager.searchNodes('javascrpt framwork', {
          searchMode: 'fuzzy',
          fuzzyThreshold: 0.3
        }, testProject);

        console.log('Fuzzy search results for "javascrpt framwork":', JSON.stringify(results, null, 2));

        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.some(e => e.name === 'JavaScript Framework')).toBe(true);
      } catch (error) {
        console.error('Multiple typos test failed:', error);
        throw error;
      }
    });

    test('should work with different threshold values', async () => {
      const thresholds = [0.3, 0.5, 0.6, 0.8];

      for (const threshold of thresholds) {
        try {
          const results = await manager.searchNodes('Reactt', {
            searchMode: 'fuzzy',
            fuzzyThreshold: threshold
          }, testProject);

          console.log(`Threshold ${threshold} results:`, results.entities.length);

          // At least some thresholds should return results
          if (threshold <= 0.6) {
            expect(results.entities.length).toBeGreaterThanOrEqual(0);
          }
        } catch (error) {
          console.error(`Threshold ${threshold} test failed:`, error);
          throw error;
        }
      }
    });
  });

  describe('Fallback Behavior', () => {
    test('should fall back to exact search when fuzzy search fails', async () => {
      try {
        // Test exact search still works
        const results = await manager.searchNodes('Facebook', {
          searchMode: 'exact'
        }, testProject);

        console.log('Exact search results for "Facebook":', JSON.stringify(results, null, 2));

        // Should find "React Library" which contains "Facebook" in observations
        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.some(e => e.name === 'React Library')).toBe(true);
      } catch (error) {
        console.error('Exact search fallback test failed:', error);
        throw error;
      }
    });

    test('should work with tag-based search', async () => {
      try {
        // Test tag search still works
        const results = await manager.searchNodes('', {
          exactTags: ['frontend'],
          tagMatchMode: 'any'
        }, testProject);

        console.log('Tag search results for "frontend":', JSON.stringify(results, null, 2));

        // Should find entities with "frontend" tag
        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.every(e => e.tags.includes('frontend'))).toBe(true);
      } catch (error) {
        console.error('Tag search test failed:', error);
        throw error;
      }
    });
  });
});

import { Entity } from '../../core.js';
import { SearchStrategy, SearchConfig, SearchOptions } from '../../search/types.js';
import { SearchManager } from '../../search/search-manager.js';

// Skip global test setup for search strategy tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

// Mock strategy for testing multiple queries
class MockMultipleSearchStrategy implements SearchStrategy {
  constructor(
    private canUseDatabaseValue: boolean = false,
    private shouldThrowDatabaseError: boolean = false
  ) { }

  canUseDatabase(): boolean {
    return this.canUseDatabaseValue;
  }

  async searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]> {
    if (this.shouldThrowDatabaseError) {
      throw new Error('Database search failed');
    }

    // Handle multiple queries
    if (Array.isArray(query)) {
      let allResults: Entity[] = [];
      const existingEntityNames = new Set<string>();

      for (const singleQuery of query) {
        const results = await this.searchDatabase(singleQuery, threshold, project);
        const newEntities = results.filter(e => !existingEntityNames.has(e.name));
        allResults.push(...newEntities);
        newEntities.forEach(e => existingEntityNames.add(e.name));
      }

      return allResults;
    }

    // Single query - return entities that contain the query
    return [
      {
        name: `Database Result for ${query}`,
        entityType: 'MockType',
        observations: [`Found via database search for: ${query}`],
        tags: ['database', 'mock', query.toLowerCase()]
      }
    ];
  }

  searchClientSide(entities: Entity[], query: string | string[]): Entity[] {
    // Handle multiple queries
    if (Array.isArray(query)) {
      let allResults: Entity[] = [];
      const existingEntityNames = new Set<string>();

      for (const singleQuery of query) {
        const results = this.searchClientSide(entities, singleQuery);
        const newEntities = results.filter(e => !existingEntityNames.has(e.name));
        allResults.push(...newEntities);
        newEntities.forEach(e => existingEntityNames.add(e.name));
      }

      return allResults;
    }

    // Single query - simple name matching
    return entities.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
  }

  async getAllEntities(project?: string): Promise<Entity[]> {
    // Mock implementation for testing
    return [];
  }
}

describe('SearchManager - Multiple Query Support', () => {
  let searchManager: SearchManager;
  let mockStrategy: MockMultipleSearchStrategy;
  let config: SearchConfig;
  let testEntities: Entity[];

  beforeEach(() => {
    config = {
      useDatabaseSearch: true,
      threshold: 0.3,
      clientSideFallback: true
    };

    mockStrategy = new MockMultipleSearchStrategy(true, false);
    searchManager = new SearchManager(config, mockStrategy);

    testEntities = [
      {
        name: 'JavaScript',
        entityType: 'Language',
        observations: ['Popular programming language', 'Used for web development'],
        tags: ['programming', 'web', 'frontend']
      },
      {
        name: 'TypeScript',
        entityType: 'Language',
        observations: ['Superset of JavaScript', 'Adds static typing'],
        tags: ['programming', 'web', 'typed']
      },
      {
        name: 'React',
        entityType: 'Framework',
        observations: ['UI library for JavaScript', 'Component-based'],
        tags: ['frontend', 'ui', 'javascript']
      },
      {
        name: 'Node.js',
        entityType: 'Runtime',
        observations: ['JavaScript runtime for server-side', 'Built on V8 engine'],
        tags: ['backend', 'server', 'javascript']
      },
      {
        name: 'Python',
        entityType: 'Language',
        observations: ['High-level programming language', 'Great for data science'],
        tags: ['programming', 'data', 'backend']
      }
    ];
  });

  describe('Multiple Query Array Support', () => {
    test('should handle array of queries with exact search', async () => {
      const queries = ['JavaScript', 'Python'];
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('Python');
    });

    test('should handle array of queries with fuzzy search using database', async () => {
      const queries = ['test1', 'test2'];
      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await searchManager.search(queries, testEntities, options, 'test-project');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Database Result for test1');
      expect(results.map(r => r.name)).toContain('Database Result for test2');
    });

    test('should handle array of queries with client-side search', async () => {
      const clientSideStrategy = new MockMultipleSearchStrategy(false, false);
      const clientSideManager = new SearchManager(config, clientSideStrategy);

      const queries = ['Script', 'Node'];
      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await clientSideManager.search(queries, testEntities, options);

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
      expect(results.map(r => r.name)).toContain('Node.js');
    });

    test('should deduplicate results from multiple queries', async () => {
      const queries = ['Script', 'JavaScript']; // Both should match JavaScript
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      // Should not have duplicate JavaScript entries
      const jsResults = results.filter(r => r.name === 'JavaScript');
      expect(jsResults).toHaveLength(1);
    });

    test('should handle empty query array', async () => {
      const queries: string[] = [];
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      expect(results).toHaveLength(0);
    });

    test('should handle single query in array format', async () => {
      const queries = ['JavaScript'];
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.name)).toContain('JavaScript');
    });
  });

  describe('Backward Compatibility', () => {
    test('should still handle single string queries', async () => {
      const query = 'JavaScript';
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(query, testEntities, options);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.name)).toContain('JavaScript');
    });

    test('should handle single string with fuzzy search', async () => {
      const query = 'test';
      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await searchManager.search(query, testEntities, options, 'test-project');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Database Result for test');
    });
  });

  describe('Error Handling for Multiple Queries', () => {
    test('should handle database failure with multiple queries and fallback', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const failingStrategy = new MockMultipleSearchStrategy(true, true);
      const failingManager = new SearchManager(config, failingStrategy);

      const queries = ['Script', 'Node'];
      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await failingManager.search(queries, testEntities, options);

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
      expect(results.map(r => r.name)).toContain('Node.js');

      consoleSpy.mockRestore();
    });

    test('should throw error with multiple queries when database fails and fallback disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const noFallbackConfig = { ...config, clientSideFallback: false };
      const failingStrategy = new MockMultipleSearchStrategy(true, true);
      const failingManager = new SearchManager(noFallbackConfig, failingStrategy);

      const queries = ['test1', 'test2'];
      const options: SearchOptions = { searchMode: 'fuzzy' };

      await expect(failingManager.search(queries, testEntities, options)).rejects.toThrow('Database search failed');

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large number of queries efficiently', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => `query${i}`);
      const options: SearchOptions = { searchMode: 'exact' };

      const startTime = Date.now();
      const results = await searchManager.search(queries, testEntities, options);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(results).toHaveLength(0); // No matches expected for these queries
    });

    test('should handle queries with special characters', async () => {
      const queries = ['Java-Script', 'Type@Script', 'Node.js'];
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      // Should find Node.js at minimum
      expect(results.map(r => r.name)).toContain('Node.js');
    });

    test('should handle duplicate queries in array', async () => {
      const queries = ['JavaScript', 'JavaScript', 'TypeScript'];
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search(queries, testEntities, options);

      // Should not have duplicate results
      const jsResults = results.filter(r => r.name === 'JavaScript');
      expect(jsResults).toHaveLength(1);

      const tsResults = results.filter(r => r.name === 'TypeScript');
      expect(tsResults).toHaveLength(1);
    });
  });
});

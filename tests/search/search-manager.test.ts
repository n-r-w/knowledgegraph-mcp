import { Entity } from '../../core.js';
import { SearchStrategy, SearchConfig, SearchOptions } from '../../search/types.js';
import { SearchManager } from '../../search/search-manager.js';

// Skip global test setup for search strategy tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

// Mock strategy for testing
class MockSearchStrategy implements SearchStrategy {
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

    // Handle multiple queries for backward compatibility
    if (Array.isArray(query)) {
      // For testing, just return results for the first query
      const firstQuery = query[0] || 'test';
      return [
        {
          name: 'Database Result',
          entityType: 'MockType',
          observations: [`Found via database search for: ${firstQuery}`],
          tags: ['database', 'mock']
        }
      ];
    }

    // Mock database search - return entities that contain the query
    return [
      {
        name: 'Database Result',
        entityType: 'MockType',
        observations: [`Found via database search for: ${query}`],
        tags: ['database', 'mock']
      }
    ];
  }

  searchClientSide(entities: Entity[], query: string | string[]): Entity[] {
    // Handle multiple queries for backward compatibility
    if (Array.isArray(query)) {
      // For testing, just use the first query
      const firstQuery = query[0] || '';
      return entities.filter(e => e.name.toLowerCase().includes(firstQuery.toLowerCase()));
    }

    // Mock client-side search - simple name matching
    return entities.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
  }

  async getAllEntities(project?: string): Promise<Entity[]> {
    // Mock implementation for testing
    return [];
  }
}

describe('SearchManager', () => {
  let searchManager: SearchManager;
  let mockStrategy: MockSearchStrategy;
  let config: SearchConfig;
  let testEntities: Entity[];

  beforeEach(() => {
    config = {
      useDatabaseSearch: true,
      threshold: 0.3,
      clientSideFallback: true
    };

    mockStrategy = new MockSearchStrategy(true, false);
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
      }
    ];
  });

  describe('Constructor', () => {
    test('should initialize with provided config and strategy', () => {
      expect(searchManager).toBeDefined();
      expect(searchManager['config']).toEqual(config);
      expect(searchManager['strategy']).toBe(mockStrategy);
    });
  });

  describe('search - exact mode', () => {
    test('should perform exact search when searchMode is exact', async () => {
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search('script', testEntities, options);

      // Should find JavaScript, TypeScript, plus React which contains "javascript" in tags
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
    });

    test('should handle case insensitive exact search', async () => {
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search('JAVASCRIPT', testEntities, options);

      // Should find JavaScript directly, plus React which contains "javascript" in tags
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.name)).toContain('JavaScript');
    });

    test('should search in all entity fields for exact mode', async () => {
      const options: SearchOptions = { searchMode: 'exact' };

      // Search in observations
      const obsResults = await searchManager.search('web development', testEntities, options);
      expect(obsResults).toHaveLength(1);
      expect(obsResults[0].name).toBe('JavaScript');

      // Search in tags
      const tagResults = await searchManager.search('frontend', testEntities, options);
      expect(tagResults).toHaveLength(2);
    });

    test('should return empty array for no exact matches', async () => {
      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search('python', testEntities, options);

      expect(results).toHaveLength(0);
    });
  });

  describe('search - fuzzy mode', () => {
    test('should use database search when strategy supports it', async () => {
      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await searchManager.search('test', testEntities, options, 'test-project');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Database Result');
      expect(results[0].observations[0]).toContain('Found via database search for: test');
    });

    test('should use client-side search when strategy does not support database', async () => {
      const clientSideStrategy = new MockSearchStrategy(false, false);
      const clientSideManager = new SearchManager(config, clientSideStrategy);

      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await clientSideManager.search('script', testEntities, options);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
    });

    test('should fall back to client-side when database search fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const failingStrategy = new MockSearchStrategy(true, true);
      const failingManager = new SearchManager(config, failingStrategy);

      const options: SearchOptions = { searchMode: 'fuzzy' };
      const results = await failingManager.search('script', testEntities, options);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');

      consoleSpy.mockRestore();
    });

    test('should throw error when database fails and fallback is disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const noFallbackConfig = { ...config, clientSideFallback: false };
      const failingStrategy = new MockSearchStrategy(true, true);
      const failingManager = new SearchManager(noFallbackConfig, failingStrategy);

      const options: SearchOptions = { searchMode: 'fuzzy' };

      await expect(failingManager.search('test', testEntities, options)).rejects.toThrow('Database search failed');

      consoleSpy.mockRestore();
    });

    test('should use custom fuzzy threshold from options', async () => {
      const options: SearchOptions = {
        searchMode: 'fuzzy',
        fuzzyThreshold: 0.8
      };

      // Mock the strategy to capture the threshold parameter
      const spyStrategy = {
        canUseDatabase: jest.fn().mockReturnValue(true),
        searchDatabase: jest.fn().mockResolvedValue([]),
        searchClientSide: jest.fn().mockReturnValue([]),
        getAllEntities: jest.fn().mockResolvedValue([])
      };

      const spyManager = new SearchManager(config, spyStrategy);
      await spyManager.search('test', testEntities, options);

      expect(spyStrategy.searchDatabase).toHaveBeenCalledWith('test', 0.8, undefined);
    });

    test('should use default threshold when not specified in options', async () => {
      const options: SearchOptions = { searchMode: 'fuzzy' };

      const spyStrategy = {
        canUseDatabase: jest.fn().mockReturnValue(true),
        searchDatabase: jest.fn().mockResolvedValue([]),
        searchClientSide: jest.fn().mockReturnValue([]),
        getAllEntities: jest.fn().mockResolvedValue([])
      };

      const spyManager = new SearchManager(config, spyStrategy);
      await spyManager.search('test', testEntities, options);

      expect(spyStrategy.searchDatabase).toHaveBeenCalledWith('test', 0.3, undefined);
    });
  });

  describe('search - default behavior', () => {
    test('should default to fuzzy search when no searchMode specified', async () => {
      const results = await searchManager.search('test', testEntities);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Database Result');
    });

    test('should handle undefined options', async () => {
      const results = await searchManager.search('test', testEntities, undefined);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Database Result');
    });
  });

  describe('exactSearch private method', () => {
    test('should handle entities with missing tags gracefully', async () => {
      const entitiesWithMissingTags: Entity[] = [
        {
          name: 'Test Entity',
          entityType: 'Test',
          observations: ['test observation'],
          tags: undefined as any
        }
      ];

      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search('test', entitiesWithMissingTags, options);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Entity');
    });

    test('should handle empty observations array', async () => {
      const entitiesWithEmptyObs: Entity[] = [
        {
          name: 'Test Entity',
          entityType: 'Test',
          observations: [],
          tags: ['test']
        }
      ];

      const options: SearchOptions = { searchMode: 'exact' };
      const results = await searchManager.search('test', entitiesWithEmptyObs, options);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Entity');
    });
  });

  describe('error handling', () => {
    test('should log warning when database search fails with fallback enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const failingStrategy = new MockSearchStrategy(true, true);
      const failingManager = new SearchManager(config, failingStrategy);

      const options: SearchOptions = { searchMode: 'fuzzy' };
      await failingManager.search('script', testEntities, options);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Database search failed, falling back to client-side:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});

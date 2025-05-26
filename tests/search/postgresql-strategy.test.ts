import { Pool as PgPool } from 'pg';
import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';

// Skip global test setup for search strategy tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

// Mock the PostgreSQL module
jest.mock('pg', () => ({
  Pool: jest.fn()
}));

describe('PostgreSQLFuzzyStrategy', () => {
  let strategy: PostgreSQLFuzzyStrategy;
  let mockPool: jest.Mocked<PgPool>;
  let mockClient: any;
  let config: SearchConfig;
  let testEntities: Entity[];

  beforeEach(() => {
    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // Setup mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined)
    } as any;

    config = {
      useDatabaseSearch: true,
      threshold: 0.3,
      clientSideFallback: true,
      fuseOptions: {
        threshold: 0.3,
        distance: 100,
        includeScore: true,
        keys: ['name', 'entityType', 'observations', 'tags']
      }
    };

    strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with provided parameters', () => {
      expect(strategy).toBeDefined();
      expect(strategy['config']).toEqual(config);
      expect(strategy['pgPool']).toBe(mockPool);
      expect(strategy['project']).toBe('test-project');
    });
  });

  describe('canUseDatabase', () => {
    test('should return true when database search is enabled', () => {
      expect(strategy.canUseDatabase()).toBe(true);
    });

    test('should return false when database search is disabled', () => {
      const configWithoutDb = { ...config, useDatabaseSearch: false };
      const strategyWithoutDb = new PostgreSQLFuzzyStrategy(configWithoutDb, mockPool, 'test-project');
      expect(strategyWithoutDb.canUseDatabase()).toBe(false);
    });
  });

  describe('searchDatabase', () => {
    test('should execute PostgreSQL similarity query with correct parameters', async () => {
      const mockRows = [
        {
          name: 'JavaScript',
          entity_type: 'Language',
          observations: ['Popular programming language'],
          tags: ['programming', 'web']
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      const results = await strategy.searchDatabase('JavaScrpt', 0.3);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['JavaScrpt', 0.3, 'test-project', 100]
      );
      expect(mockClient.release).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('JavaScript');
      expect(results[0].entityType).toBe('Language');
    });

    test('should use provided project parameter over constructor project', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await strategy.searchDatabase('test', 0.3, 'custom-project');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('similarity'),
        ['test', 0.3, 'custom-project', 100]
      );
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockClient.query.mockRejectedValue(dbError);

      await expect(strategy.searchDatabase('test', 0.3)).rejects.toThrow('Database connection failed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should handle empty results', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const results = await strategy.searchDatabase('nonexistent', 0.3);
      expect(results).toHaveLength(0);
    });

    test('should transform database rows to entities correctly', async () => {
      const mockRows = [
        {
          name: 'Test Entity',
          entity_type: 'Test Type',
          observations: ['obs1', 'obs2'],
          tags: ['tag1', 'tag2']
        },
        {
          name: 'Another Entity',
          entity_type: 'Another Type',
          observations: null,
          tags: null
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockRows });

      const results = await strategy.searchDatabase('test', 0.3);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        name: 'Test Entity',
        entityType: 'Test Type',
        observations: ['obs1', 'obs2'],
        tags: ['tag1', 'tag2']
      });
      expect(results[1]).toEqual({
        name: 'Another Entity',
        entityType: 'Another Type',
        observations: [],
        tags: []
      });
    });
  });

  describe('searchClientSide', () => {
    test('should perform fuzzy search using Fuse.js', () => {
      const results = strategy.searchClientSide(testEntities, 'JavaScrpt'); // Intentional typo

      expect(results.length).toBeGreaterThan(0);
      // Check that JavaScript is in the results (fuzzy search results may vary in order)
      expect(results.map(r => r.name)).toContain('JavaScript');
    });

    test('should use custom fuse options from config', () => {
      const customConfig = {
        ...config,
        fuseOptions: {
          threshold: 0.1, // Very strict matching
          distance: 50,
          includeScore: true,
          keys: ['name'] // Only search in name
        }
      };

      const customStrategy = new PostgreSQLFuzzyStrategy(customConfig, mockPool, 'test-project');
      const results = customStrategy.searchClientSide(testEntities, 'React');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('React');
    });

    test('should handle empty entity list', () => {
      const results = strategy.searchClientSide([], 'test');
      expect(results).toHaveLength(0);
    });

    test('should handle empty query', () => {
      const results = strategy.searchClientSide(testEntities, '');
      expect(results).toHaveLength(0);
    });

    test('should find entities with partial matches', () => {
      const results = strategy.searchClientSide(testEntities, 'Script');
      expect(results.length).toBeGreaterThan(0);

      const names = results.map(r => r.name);
      expect(names).toContain('JavaScript');
      expect(names).toContain('TypeScript');
    });
  });
});

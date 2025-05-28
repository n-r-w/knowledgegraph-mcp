import Database from 'better-sqlite3';
import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { SQLiteFuzzyStrategy } from '../../search/strategies/sqlite-strategy.js';

// Skip global test setup for search strategy tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

describe('SQLiteFuzzyStrategy', () => {
  let strategy: SQLiteFuzzyStrategy;
  let mockDb: jest.Mocked<Database.Database>;
  let mockStatement: jest.Mocked<Database.Statement>;
  let config: SearchConfig;
  let testEntities: Entity[];

  beforeEach(() => {
    // Setup mock statement
    mockStatement = {
      all: jest.fn(),
      run: jest.fn(),
      get: jest.fn(),
      finalize: jest.fn()
    } as any;

    // Setup mock database
    mockDb = {
      prepare: jest.fn().mockReturnValue(mockStatement),
      close: jest.fn(),
      exec: jest.fn()
    } as any;

    config = {
      useDatabaseSearch: false, // SQLite always uses client-side search
      threshold: 0.3,
      clientSideFallback: true,
      fuseOptions: {
        threshold: 0.3,
        distance: 100,
        includeScore: true,
        keys: ['name', 'entityType', 'observations', 'tags']
      }
    };

    strategy = new SQLiteFuzzyStrategy(config, mockDb, 'test-project');

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
      expect(strategy['db']).toBe(mockDb);
      expect(strategy['project']).toBe('test-project');
    });
  });

  describe('canUseDatabase', () => {
    test('should always return false for SQLite', () => {
      expect(strategy.canUseDatabase()).toBe(false);
    });

    test('should return false even when config enables database search', () => {
      const configWithDb = { ...config, useDatabaseSearch: true };
      const strategyWithDb = new SQLiteFuzzyStrategy(configWithDb, mockDb, 'test-project');
      expect(strategyWithDb.canUseDatabase()).toBe(false);
    });
  });

  describe('searchDatabase', () => {
    test('should throw error since SQLite does not support database-level fuzzy search', async () => {
      await expect(strategy.searchDatabase('test', 0.3)).rejects.toThrow(
        'SQLite does not support database-level fuzzy search. Use client-side search instead.'
      );
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

      const customStrategy = new SQLiteFuzzyStrategy(customConfig, mockDb, 'test-project');
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

  describe('getAllEntities', () => {
    test('should fetch all entities for the project', async () => {
      const mockRows = [
        {
          name: 'JavaScript',
          entity_type: 'Language',
          observations: '["Popular programming language"]',
          tags: '["programming", "web"]'
        },
        {
          name: 'TypeScript',
          entity_type: 'Language',
          observations: '["Superset of JavaScript"]',
          tags: '["programming", "typed"]'
        }
      ];

      mockStatement.all.mockReturnValue(mockRows);

      const results = await strategy.getAllEntities();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT name, entity_type, observations, tags\s+FROM entities\s+WHERE project = \?\s+ORDER BY updated_at DESC, name\s+LIMIT \?/)
      );
      expect(mockStatement.all).toHaveBeenCalledWith('test-project', 10000);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        name: 'JavaScript',
        entityType: 'Language',
        observations: ['Popular programming language'],
        tags: ['programming', 'web']
      });
    });

    test('should use provided project parameter', async () => {
      mockStatement.all.mockReturnValue([]);

      await strategy.getAllEntities('custom-project');

      expect(mockStatement.all).toHaveBeenCalledWith('custom-project', 10000);
    });

    test('should handle database errors by throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStatement.all.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(strategy.getAllEntities()).rejects.toThrow('Database error');

      consoleSpy.mockRestore();
    });

    test('should handle malformed JSON in observations and tags', async () => {
      const mockRows = [
        {
          name: 'Test Entity',
          entity_type: 'Test',
          observations: 'invalid json',
          tags: 'invalid json'
        }
      ];

      mockStatement.all.mockReturnValue(mockRows);

      const results = await strategy.getAllEntities();
      expect(results).toHaveLength(1);
      expect(results[0].observations).toEqual([]);
      expect(results[0].tags).toEqual([]);
    });
  });

  describe('searchExact', () => {
    test('should perform exact search at database level', async () => {
      const mockRows = [
        {
          name: 'JavaScript',
          entity_type: 'Language',
          observations: '["Popular programming language"]',
          tags: '["programming", "web"]'
        }
      ];

      mockStatement.all.mockReturnValue(mockRows);

      const results = await strategy.searchExact('script');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(name) LIKE ?')
      );
      expect(mockStatement.all).toHaveBeenCalledWith(
        'test-project',
        '%script%',
        '%script%',
        '%script%',
        '%script%',
        100
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('JavaScript');
    });

    test('should use provided project parameter', async () => {
      mockStatement.all.mockReturnValue([]);

      await strategy.searchExact('test', 'custom-project');

      expect(mockStatement.all).toHaveBeenCalledWith(
        'custom-project',
        '%test%',
        '%test%',
        '%test%',
        '%test%',
        100
      );
    });

    test('should handle database errors by throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStatement.all.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(strategy.searchExact('test')).rejects.toThrow('Database error');

      consoleSpy.mockRestore();
    });

    test('should handle empty query', async () => {
      mockStatement.all.mockReturnValue([]);

      const results = await strategy.searchExact('');

      expect(mockStatement.all).toHaveBeenCalledWith(
        'test-project',
        '%%',
        '%%',
        '%%',
        '%%',
        100
      );
      expect(results).toHaveLength(0);
    });
  });
});

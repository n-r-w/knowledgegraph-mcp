import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { BaseSearchStrategy } from '../../search/strategies/base-strategy.js';

// Skip global test setup for search strategy tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

// Concrete implementation for testing the abstract base class
class TestSearchStrategy extends BaseSearchStrategy {
  constructor(config: SearchConfig) {
    super(config);
  }

  canUseDatabase(): boolean {
    return false;
  }

  async searchDatabase(query: string, threshold: number, project?: string): Promise<Entity[]> {
    throw new Error('Not implemented in test strategy');
  }

  searchClientSide(entities: Entity[], query: string): Entity[] {
    // Simple implementation for testing
    return entities.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
  }
}

describe('BaseSearchStrategy', () => {
  let strategy: TestSearchStrategy;
  let config: SearchConfig;
  let testEntities: Entity[];

  beforeEach(() => {
    config = {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true
    };

    strategy = new TestSearchStrategy(config);

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
        observations: ['JavaScript runtime for server-side'],
        tags: ['backend', 'javascript', 'server']
      }
    ];
  });

  describe('Constructor', () => {
    test('should initialize with provided config', () => {
      expect(strategy).toBeDefined();
      expect(strategy['config']).toEqual(config);
    });

    test('should accept different config options', () => {
      const customConfig: SearchConfig = {
        useDatabaseSearch: true,
        threshold: 0.5,
        clientSideFallback: false,
        fuseOptions: {
          threshold: 0.4,
          distance: 200,
          includeScore: true,
          keys: ['name', 'entityType']
        }
      };

      const customStrategy = new TestSearchStrategy(customConfig);
      expect(customStrategy['config']).toEqual(customConfig);
    });
  });

  describe('exactSearch', () => {
    test('should find entities by name (case insensitive)', () => {
      const results = strategy['exactSearch']('javascript', testEntities);
      // Should find JavaScript directly, plus React and Node.js which contain "javascript" in tags/observations
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.name)).toContain('JavaScript');
    });

    test('should find entities by entity type', () => {
      const results = strategy['exactSearch']('language', testEntities);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
    });

    test('should find entities by observations', () => {
      const results = strategy['exactSearch']('web development', testEntities);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('JavaScript');
    });

    test('should find entities by tags', () => {
      const results = strategy['exactSearch']('frontend', testEntities);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('React');
    });

    test('should handle partial matches', () => {
      const results = strategy['exactSearch']('script', testEntities);
      // Should find JavaScript, TypeScript, plus React and Node.js which contain "javascript" in tags/observations
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.map(r => r.name)).toContain('JavaScript');
      expect(results.map(r => r.name)).toContain('TypeScript');
    });

    test('should return empty array for no matches', () => {
      const results = strategy['exactSearch']('python', testEntities);
      expect(results).toHaveLength(0);
    });

    test('should handle empty query', () => {
      const results = strategy['exactSearch']('', testEntities);
      expect(results).toHaveLength(4); // All entities match empty string
    });

    test('should handle entities with missing tags', () => {
      const entitiesWithoutTags: Entity[] = [
        {
          name: 'Test Entity',
          entityType: 'Test',
          observations: ['test observation'],
          tags: []
        }
      ];

      const results = strategy['exactSearch']('test', entitiesWithoutTags);
      expect(results).toHaveLength(1);
    });

    test('should handle entities with undefined tags', () => {
      const entitiesWithUndefinedTags: Entity[] = [
        {
          name: 'Test Entity',
          entityType: 'Test',
          observations: ['test observation'],
          tags: undefined as any
        }
      ];

      const results = strategy['exactSearch']('test', entitiesWithUndefinedTags);
      expect(results).toHaveLength(1);
    });
  });

  describe('Abstract Methods', () => {
    test('should require implementation of canUseDatabase', () => {
      expect(strategy.canUseDatabase()).toBe(false);
    });

    test('should require implementation of searchDatabase', async () => {
      await expect(strategy.searchDatabase('test', 0.3)).rejects.toThrow('Not implemented in test strategy');
    });

    test('should require implementation of searchClientSide', () => {
      const results = strategy.searchClientSide(testEntities, 'JavaScript');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('JavaScript');
    });
  });
});

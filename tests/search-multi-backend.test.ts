import { Entity } from '../core.js';
import { SearchManager } from '../search/search-manager.js';
import { PostgreSQLFuzzyStrategy } from '../search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from '../search/strategies/sqlite-strategy.js';
import { runTestsForAvailableBackends } from './utils/multi-backend-runner.js';
import {
  createTestManager,
  cleanupTestManager,
  getBackendCapabilities,
  createSearchConfig,
  createBackendTestProject,
  generateTestData
} from './utils/backend-test-helpers.js';
import { StorageConfig, StorageType } from '../storage/types.js';

describe('Search Functionality - Multi-Backend Tests', () => {
  const testEntities: Entity[] = [
    { name: 'JavaScript', entityType: 'Language', observations: ['Popular programming language'], tags: ['programming', 'web'] },
    { name: 'TypeScript', entityType: 'Language', observations: ['Typed superset of JavaScript'], tags: ['programming', 'web', 'types'] },
    { name: 'Python', entityType: 'Language', observations: ['Versatile programming language'], tags: ['programming', 'data-science'] },
    { name: 'React', entityType: 'Framework', observations: ['JavaScript library for building UIs'], tags: ['frontend', 'web', 'javascript'] },
    { name: 'Node.js', entityType: 'Runtime', observations: ['JavaScript runtime built on Chrome V8'], tags: ['backend', 'javascript'] }
  ];

  // Test search functionality across all backends
  runTestsForAvailableBackends((config: StorageConfig, backendName: string) => {
    describe(`Search Tests`, () => {
      let manager: any;
      let testProject: string;

      beforeEach(async () => {
        manager = await createTestManager(config, backendName);
        testProject = createBackendTestProject(config.type, 'search_test');

        // Create test entities
        await manager.createEntities(testEntities, testProject);
      });

      afterEach(async () => {
        await cleanupTestManager(manager, backendName);
      });

      test('should perform fuzzy search', async () => {
        // Test with a less strict typo that should still match
        const results = await manager.searchNodes('Javascrip', testProject); // Missing 't' at end

        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.map((r: Entity) => r.name)).toContain('JavaScript');
      }, 10000);

      test('should perform exact search', async () => {
        const results = await manager.searchNodes('JavaScript', testProject);

        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities[0].name).toBe('JavaScript');
      }, 10000);

      test('should search by entity type', async () => {
        const results = await manager.searchNodes('Language', testProject);

        expect(results.entities.length).toBeGreaterThanOrEqual(3); // JavaScript, TypeScript, Python
        const languageNames = results.entities.map((r: Entity) => r.name);
        expect(languageNames).toContain('JavaScript');
        expect(languageNames).toContain('TypeScript');
        expect(languageNames).toContain('Python');
      }, 10000);

      test('should search by observations', async () => {
        const results = await manager.searchNodes('programming', testProject);

        expect(results.entities.length).toBeGreaterThan(0);
        const foundEntity = results.entities.find((r: Entity) => r.name === 'JavaScript');
        expect(foundEntity).toBeDefined();
      }, 10000);

      test('should search by tags', async () => {
        const results = await manager.searchNodes('web', testProject);

        expect(results.entities.length).toBeGreaterThan(0);
        const webEntities = results.entities.filter((r: Entity) => r.tags.includes('web'));
        expect(webEntities.length).toBeGreaterThan(0);
      }, 10000);

      test('should handle empty search results', async () => {
        const results = await manager.searchNodes('nonexistent', testProject);

        expect(results.entities).toEqual([]);
      }, 10000);

      test('should handle backend-specific search behavior', async () => {
        const capabilities = getBackendCapabilities(config.type);

        if (capabilities.supportsDatabaseSearch) {
          // PostgreSQL should use database-level search
          const results = await manager.searchNodes('script', testProject);
          expect(results.entities.length).toBeGreaterThan(0);

          // Verify that database search was used (this would be implementation-specific)
          // For now, just verify that search works
          expect(results.entities.map((r: Entity) => r.name)).toContain('JavaScript');
        } else {
          // SQLite should use client-side search
          const results = await manager.searchNodes('script', testProject);
          expect(results.entities.length).toBeGreaterThan(0);

          // Verify that client-side search was used
          expect(results.entities.map((r: Entity) => r.name)).toContain('JavaScript');
        }
      }, 10000);

      test('should handle case-insensitive search', async () => {
        const lowerResults = await manager.searchNodes('javascript', testProject);
        const upperResults = await manager.searchNodes('JAVASCRIPT', testProject);
        const mixedResults = await manager.searchNodes('JavaScript', testProject);

        expect(lowerResults.entities.length).toBeGreaterThan(0);
        expect(upperResults.entities.length).toBeGreaterThan(0);
        expect(mixedResults.entities.length).toBeGreaterThan(0);

        // All should find the JavaScript entity
        expect(lowerResults.entities.map((r: Entity) => r.name)).toContain('JavaScript');
        expect(upperResults.entities.map((r: Entity) => r.name)).toContain('JavaScript');
        expect(mixedResults.entities.map((r: Entity) => r.name)).toContain('JavaScript');
      }, 10000);

      test('should handle partial matches', async () => {
        const results = await manager.searchNodes('Type', testProject);

        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.map((r: Entity) => r.name)).toContain('TypeScript');
      }, 10000);

      test('should handle search with special characters', async () => {
        // Create entity with special characters
        const specialEntity = {
          name: 'C++',
          entityType: 'Language',
          observations: ['Systems programming language'],
          tags: ['programming', 'systems']
        };

        await manager.createEntities([specialEntity], testProject);

        const results = await manager.searchNodes('C++', testProject);
        expect(results.entities.length).toBeGreaterThan(0);
        expect(results.entities.map((r: Entity) => r.name)).toContain('C++');
      }, 10000);
    });
  });

  // Test search strategy creation (backend-specific)
  describe('Search Strategy Creation', () => {
    test('should create appropriate search strategy for each backend', () => {
      // Test PostgreSQL strategy
      const pgConfig = createSearchConfig(StorageType.POSTGRESQL);
      expect(pgConfig.useDatabaseSearch).toBe(true);
      expect(pgConfig.clientSideFallback).toBe(true);

      // Test SQLite strategy
      const sqliteConfig = createSearchConfig(StorageType.SQLITE);
      expect(sqliteConfig.useDatabaseSearch).toBe(false);
      expect(sqliteConfig.clientSideFallback).toBe(true);
    });

    test('should handle backend capabilities correctly', () => {
      const pgCapabilities = getBackendCapabilities(StorageType.POSTGRESQL);
      expect(pgCapabilities.supportsDatabaseSearch).toBe(true);
      expect(pgCapabilities.requiresExternalServer).toBe(true);

      const sqliteCapabilities = getBackendCapabilities(StorageType.SQLITE);
      expect(sqliteCapabilities.supportsDatabaseSearch).toBe(false);
      expect(sqliteCapabilities.requiresExternalServer).toBe(false);
    });
  });

  // Test search performance characteristics
  describe('Search Performance', () => {
    runTestsForAvailableBackends((config: StorageConfig, backendName: string) => {
      test(`should perform search within reasonable time limits`, async () => {
        const manager = await createTestManager(config, backendName);
        const testProject = createBackendTestProject(config.type, 'perf_test');

        try {
          // Create larger dataset for performance testing
          const largeDataset = generateTestData(config.type, 100);
          await manager.createEntities(largeDataset, testProject);

          const startTime = Date.now();
          const results = await manager.searchNodes('entity', testProject);
          const duration = Date.now() - startTime;

          expect(results.entities.length).toBeGreaterThan(0);

          // Backend-specific performance expectations
          const capabilities = getBackendCapabilities(config.type);
          if (capabilities.requiresExternalServer) {
            expect(duration).toBeLessThan(5000); // 5 seconds for PostgreSQL
          } else {
            expect(duration).toBeLessThan(2000); // 2 seconds for SQLite
          }

        } finally {
          await cleanupTestManager(manager, backendName);
        }
      }, 15000);
    });
  });
});

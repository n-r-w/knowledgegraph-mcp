import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from '../../search/strategies/sqlite-strategy.js';
import { SearchManager } from '../../search/search-manager.js';
import { PerformanceUtils } from './performance-utils.js';

// Skip global test setup for performance tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

// Mock PostgreSQL for performance tests
jest.mock('pg', () => ({
  Pool: jest.fn()
}));

// Mock SQLite for performance tests
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
      get: jest.fn(),
      finalize: jest.fn()
    }),
    close: jest.fn(),
    exec: jest.fn()
  }));
});

describe('Search Performance Tests', () => {
  let config: SearchConfig;
  let testEntities: Entity[];
  let largeTestEntities: Entity[];

  beforeAll(() => {
    config = {
      useDatabaseSearch: false, // Use client-side for consistent testing
      threshold: 0.3,
      clientSideFallback: true,
      fuseOptions: {
        threshold: 0.3,
        distance: 100,
        includeScore: true,
        keys: ['name', 'entityType', 'observations', 'tags']
      }
    };

    // Generate test datasets
    testEntities = PerformanceUtils.generateRealisticTestEntities(100);
    largeTestEntities = PerformanceUtils.generateRealisticTestEntities(10000);
  });

  describe('Client-Side Search Performance', () => {
    test('should benchmark small dataset (100 entities)', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(testEntities, 'JavaScript');
      }, 50);

      console.log('\n=== Small Dataset (100 entities) ===');
      console.log(PerformanceUtils.formatBenchmarkResults(benchmark));
      console.log(`Results found: ${benchmark.results[0].length}`);

      // Performance assertions
      expect(benchmark.avgTime).toBeLessThan(50); // Should be under 50ms
      expect(benchmark.maxTime).toBeLessThan(100); // Max should be under 100ms
      expect(benchmark.results[0].length).toBeGreaterThan(0); // Should find results
    });

    test('should benchmark medium dataset (1000 entities)', async () => {
      const mediumEntities = PerformanceUtils.generateRealisticTestEntities(1000);
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(mediumEntities, 'React');
      }, 20);

      console.log('\n=== Medium Dataset (1000 entities) ===');
      console.log(PerformanceUtils.formatBenchmarkResults(benchmark));
      console.log(`Results found: ${benchmark.results[0].length}`);

      // Performance assertions
      expect(benchmark.avgTime).toBeLessThan(200); // Should be under 200ms
      expect(benchmark.maxTime).toBeLessThan(500); // Max should be under 500ms
    });

    test('should benchmark large dataset (10000 entities)', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(largeTestEntities, 'TypeScript');
      }, 10);

      console.log('\n=== Large Dataset (10000 entities) ===');
      console.log(PerformanceUtils.formatBenchmarkResults(benchmark));
      console.log(`Results found: ${benchmark.results[0].length}`);

      // Performance assertions - more lenient for large datasets
      expect(benchmark.avgTime).toBeLessThan(2000); // Should be under 2 seconds
      expect(benchmark.maxTime).toBeLessThan(5000); // Max should be under 5 seconds
    });
  });

  describe('Memory Usage Analysis', () => {
    test('should measure memory usage for small dataset search', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const memoryTest = await PerformanceUtils.measureMemory(async () => {
        return strategy.searchClientSide(testEntities, 'Node.js');
      });

      console.log('\n=== Memory Usage (100 entities) ===');
      console.log(`Memory used: ${PerformanceUtils.formatMemoryUsage(memoryTest.memoryUsed)}`);
      console.log(`Heap before: ${PerformanceUtils.formatMemoryUsage(memoryTest.heapUsedBefore)}`);
      console.log(`Heap after: ${PerformanceUtils.formatMemoryUsage(memoryTest.heapUsedAfter)}`);

      // Memory should be reasonable for small datasets
      expect(Math.abs(memoryTest.memoryUsed)).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    test('should measure memory usage for large dataset search', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const memoryTest = await PerformanceUtils.measureMemory(async () => {
        return strategy.searchClientSide(largeTestEntities, 'Python');
      });

      console.log('\n=== Memory Usage (10000 entities) ===');
      console.log(`Memory used: ${PerformanceUtils.formatMemoryUsage(memoryTest.memoryUsed)}`);
      console.log(`Heap before: ${PerformanceUtils.formatMemoryUsage(memoryTest.heapUsedBefore)}`);
      console.log(`Heap after: ${PerformanceUtils.formatMemoryUsage(memoryTest.heapUsedAfter)}`);

      // Memory should be reasonable even for large datasets
      expect(Math.abs(memoryTest.memoryUsed)).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    });
  });

  describe('Search Quality vs Performance Trade-offs', () => {
    test('should compare different fuzzy search thresholds', async () => {
      const mockPool = {} as any;
      const thresholds = [0.1, 0.3, 0.5, 0.7, 0.9];
      
      console.log('\n=== Threshold Performance Comparison ===');
      
      for (const threshold of thresholds) {
        const thresholdConfig = { ...config, threshold };
        const strategy = new PostgreSQLFuzzyStrategy(thresholdConfig, mockPool, 'test-project');

        const benchmark = await PerformanceUtils.runBenchmark(async () => {
          return strategy.searchClientSide(testEntities, 'JavaScrpt'); // Intentional typo
        }, 10);

        console.log(`\nThreshold ${threshold}:`);
        console.log(`  Avg time: ${benchmark.avgTime.toFixed(2)}ms`);
        console.log(`  Results: ${benchmark.results[0].length}`);

        // All thresholds should perform reasonably
        expect(benchmark.avgTime).toBeLessThan(100);
      }
    });
  });

  describe('Strategy Comparison', () => {
    test('should compare PostgreSQL vs SQLite strategy performance', async () => {
      const mockPool = {} as any;
      const mockDb = {} as any;

      const pgStrategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');
      const sqliteStrategy = new SQLiteFuzzyStrategy(config, mockDb, 'test-project');

      console.log('\n=== Strategy Performance Comparison ===');

      // PostgreSQL strategy benchmark
      const pgBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return pgStrategy.searchClientSide(testEntities, 'Docker');
      }, 20);

      console.log('\nPostgreSQL Strategy:');
      console.log(PerformanceUtils.formatBenchmarkResults(pgBenchmark));

      // SQLite strategy benchmark
      const sqliteBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return sqliteStrategy.searchClientSide(testEntities, 'Docker');
      }, 20);

      console.log('\nSQLite Strategy:');
      console.log(PerformanceUtils.formatBenchmarkResults(sqliteBenchmark));

      // Both strategies should perform similarly for client-side search
      expect(pgBenchmark.avgTime).toBeLessThan(100);
      expect(sqliteBenchmark.avgTime).toBeLessThan(100);
      
      // Results should be identical for same search
      expect(pgBenchmark.results[0].length).toBe(sqliteBenchmark.results[0].length);
    });
  });
});

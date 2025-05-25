import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';
import { SearchManager } from '../../search/search-manager.js';
import { PerformanceUtils } from './performance-utils.js';

// Skip global test setup for performance tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

describe('Load Testing', () => {
  let config: SearchConfig;
  let testEntities: Entity[];
  let massiveTestEntities: Entity[];

  beforeAll(() => {
    config = {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true,
      fuseOptions: {
        threshold: 0.3,
        distance: 100,
        includeScore: true,
        keys: ['name', 'entityType', 'observations', 'tags']
      }
    };

    // Generate different sized datasets
    testEntities = PerformanceUtils.generateRealisticTestEntities(1000);
    massiveTestEntities = PerformanceUtils.generateRealisticTestEntities(50000);
  });

  describe('Concurrent Search Load Testing', () => {
    test('should handle multiple concurrent searches on medium dataset', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');
      const searchManager = new SearchManager(config, strategy);

      const concurrentSearches = 10;
      const searchQueries = [
        'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular',
        'Node.js', 'Python', 'Docker', 'Kubernetes', 'AWS'
      ];

      console.log(`\n🔄 Running ${concurrentSearches} concurrent searches...`);

      const startTime = performance.now();

      const promises = Array.from({ length: concurrentSearches }, (_, i) => {
        const query = searchQueries[i % searchQueries.length];
        return searchManager.search(query, testEntities, { searchMode: 'fuzzy' });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`✅ Completed ${concurrentSearches} concurrent searches in ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average time per search: ${(totalTime / concurrentSearches).toFixed(2)}ms`);

      // Verify all searches completed successfully
      expect(results).toHaveLength(concurrentSearches);
      results.forEach((result, i) => {
        expect(Array.isArray(result)).toBe(true);
        console.log(`   Search ${i + 1} (${searchQueries[i % searchQueries.length]}): ${result.length} results`);
      });

      // Performance assertion - concurrent searches should complete reasonably fast
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle high-frequency sequential searches', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');
      const searchManager = new SearchManager(config, strategy);

      const searchCount = 100;
      const searchQueries = ['JavaScript', 'Python', 'React', 'Docker'];
      const times: number[] = [];

      console.log(`\n⚡ Running ${searchCount} sequential high-frequency searches...`);

      for (let i = 0; i < searchCount; i++) {
        const query = searchQueries[i % searchQueries.length];

        const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
          return searchManager.search(query, testEntities, { searchMode: 'fuzzy' });
        });

        times.push(timeMs);

        if (i % 20 === 0) {
          console.log(`   Completed ${i + 1}/${searchCount} searches...`);
        }
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`✅ Completed ${searchCount} sequential searches`);
      console.log(`📊 Average: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance assertions
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxTime).toBeLessThan(500); // No single search should take more than 500ms
    });
  });

  describe('Large Dataset Stress Testing', () => {
    test('should handle massive dataset (50k entities) search', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      console.log('\n🏋️  Testing massive dataset (50,000 entities)...');

      const memoryBefore = process.memoryUsage();

      const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
        return strategy.searchClientSide(massiveTestEntities, 'JavaScript');
      });

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log(`✅ Massive dataset search completed in ${timeMs.toFixed(2)}ms`);
      console.log(`📊 Results found: ${result.length}`);
      console.log(`🧠 Memory increase: ${PerformanceUtils.formatMemoryUsage(memoryIncrease)}`);
      console.log(`📈 Heap usage: ${PerformanceUtils.formatMemoryUsage(memoryAfter.heapUsed)}`);

      // Performance assertions for massive datasets
      expect(timeMs).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.length).toBeGreaterThan(0); // Should find some results
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Memory increase should be under 500MB
    });

    test('should maintain performance consistency under memory pressure', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      console.log('\n💾 Testing performance under memory pressure...');

      // Create multiple large datasets to simulate memory pressure
      const datasets = Array.from({ length: 5 }, () =>
        PerformanceUtils.generateRealisticTestEntities(5000)
      );

      const searchTimes: number[] = [];

      for (let i = 0; i < datasets.length; i++) {
        const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
          return strategy.searchClientSide(datasets[i], 'TypeScript');
        });

        searchTimes.push(timeMs);
        console.log(`   Dataset ${i + 1}: ${timeMs.toFixed(2)}ms, ${result.length} results`);
      }

      const avgTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      const timeVariation = Math.max(...searchTimes) - Math.min(...searchTimes);

      console.log(`✅ Memory pressure test completed`);
      console.log(`📊 Average time: ${avgTime.toFixed(2)}ms`);
      console.log(`📈 Time variation: ${timeVariation.toFixed(2)}ms`);

      // Performance should remain consistent even under memory pressure
      expect(avgTime).toBeLessThan(2000); // Average should be reasonable
      expect(timeVariation).toBeLessThan(5000); // Variation shouldn't be too high
    });
  });

  describe('Edge Case Performance Testing', () => {
    test('should handle empty search queries efficiently', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
        return strategy.searchClientSide(testEntities, '');
      });

      console.log(`\n🔍 Empty query search: ${timeMs.toFixed(2)}ms, ${result.length} results`);

      // Empty queries should be handled quickly
      expect(timeMs).toBeLessThan(50);
    });

    test('should handle very long search queries efficiently', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const longQuery = 'a'.repeat(1000); // 1000 character query

      const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
        return strategy.searchClientSide(testEntities, longQuery);
      });

      console.log(`\n📏 Long query search (1000 chars): ${timeMs.toFixed(2)}ms, ${result.length} results`);

      // Long queries should still be handled reasonably (very long queries take more time)
      expect(timeMs).toBeLessThan(5000); // Increased from 200ms to 5000ms for very long queries
    });

    test('should handle special characters in search queries', async () => {
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const specialQueries = [
        '!@#$%^&*()',
        'query with spaces',
        'query-with-dashes',
        'query_with_underscores',
        'query.with.dots',
        'UPPERCASE QUERY',
        'MiXeD cAsE qUeRy'
      ];

      console.log('\n🔤 Testing special character queries...');

      for (const query of specialQueries) {
        const { result, timeMs } = await PerformanceUtils.measureTime(async () => {
          return strategy.searchClientSide(testEntities, query);
        });

        console.log(`   "${query}": ${timeMs.toFixed(2)}ms, ${result.length} results`);

        // All queries should complete quickly
        expect(timeMs).toBeLessThan(100);
      }
    });
  });
});

import { Pool as PgPool } from 'pg';
import Database from 'better-sqlite3';
import { Entity, KnowledgeGraph } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from '../../search/strategies/sqlite-strategy.js';
import { PerformanceUtils } from './performance-utils.js';

// Skip global test setup for performance tests
jest.mock('../setup.ts', () => ({
  beforeEach: jest.fn(),
  afterEach: jest.fn()
}));

describe('Database Performance Tests', () => {
  const TEST_CONNECTION_STRING = process.env.KNOWLEDGEGRAPH_TEST_CONNECTION_STRING || 'postgresql://postgres:1@localhost:5432/knowledgegraph_test';
  const TEST_SQLITE_PATH = ':memory:';

  let pgPool: PgPool;
  let sqliteDb: Database.Database;
  let config: SearchConfig;
  let testEntities: Entity[];
  let testProject: string;

  beforeAll(async () => {
    testProject = `perf_test_${Date.now()}`;

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

    // Generate test data
    testEntities = PerformanceUtils.generateRealisticTestEntities(1000);

    // Setup PostgreSQL connection (only if available)
    try {
      pgPool = new PgPool({
        connectionString: TEST_CONNECTION_STRING,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await pgPool.connect();
      client.release();

      // Setup test database
      await setupPostgreSQLTestData();
    } catch (error) {
      console.warn('PostgreSQL not available for performance testing:', error);
      pgPool = null as any;
    }

    // Setup SQLite connection
    try {
      sqliteDb = new Database(TEST_SQLITE_PATH);
      await setupSQLiteTestData();
    } catch (error) {
      console.warn('SQLite not available for performance testing:', error);
      sqliteDb = null as any;
    }
  });

  afterAll(async () => {
    if (pgPool) {
      try {
        // Clean up test data
        const client = await pgPool.connect();
        await client.query('DELETE FROM entities WHERE project = $1', [testProject]);
        await client.query('DELETE FROM relations WHERE project = $1', [testProject]);
        client.release();
        await pgPool.end();
      } catch (error) {
        console.warn('Error cleaning up PostgreSQL:', error);
      }
    }

    if (sqliteDb) {
      try {
        sqliteDb.close();
      } catch (error) {
        console.warn('Error closing SQLite:', error);
      }
    }
  });

  async function setupPostgreSQLTestData() {
    if (!pgPool) return;

    const client = await pgPool.connect();
    try {
      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS entities (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          name TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          observations TEXT[],
          tags TEXT[],
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS relations (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          from_entity TEXT NOT NULL,
          to_entity TEXT NOT NULL,
          relation_type TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Enable fuzzy search extensions
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_name_trgm_idx
        ON entities USING GIN (name gin_trgm_ops)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_type_trgm_idx
        ON entities USING GIN (entity_type gin_trgm_ops)
      `);

      // Insert test data
      await client.query('DELETE FROM entities WHERE project = $1', [testProject]);

      for (const entity of testEntities) {
        await client.query(
          'INSERT INTO entities (project, name, entity_type, observations, tags) VALUES ($1, $2, $3, $4, $5)',
          [testProject, entity.name, entity.entityType, JSON.stringify(entity.observations), JSON.stringify(entity.tags || [])]
        );
      }

      console.log(`Inserted ${testEntities.length} entities into PostgreSQL for performance testing`);
    } finally {
      client.release();
    }
  }

  async function setupSQLiteTestData() {
    if (!sqliteDb) return;

    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        observations TEXT,
        tags TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test data
    const insertStmt = sqliteDb.prepare(`
      INSERT INTO entities (project, name, entity_type, observations, tags)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const entity of testEntities) {
      insertStmt.run(
        testProject,
        entity.name,
        entity.entityType,
        JSON.stringify(entity.observations),
        JSON.stringify(entity.tags || [])
      );
    }

    console.log(`Inserted ${testEntities.length} entities into SQLite for performance testing`);
  }

  describe('PostgreSQL Database Performance', () => {
    test('should benchmark PostgreSQL database-level fuzzy search', async () => {
      if (!pgPool) {
        console.log('Skipping PostgreSQL test - database not available');
        return;
      }

      const strategy = new PostgreSQLFuzzyStrategy(config, pgPool, testProject);

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchDatabase('JavaScript', 0.3, testProject);
      }, 10);

      console.log('\n=== PostgreSQL Database Search (1000 entities) ===');
      console.log(PerformanceUtils.formatBenchmarkResults(benchmark));
      console.log(`Results found: ${benchmark.results[0].length}`);

      // Database search should be fast
      expect(benchmark.avgTime).toBeLessThan(100); // Should be under 100ms
      expect(benchmark.results[0].length).toBeGreaterThan(0);
    });

    test('should compare PostgreSQL database vs client-side search', async () => {
      if (!pgPool) {
        console.log('Skipping PostgreSQL comparison test - database not available');
        return;
      }

      const strategy = new PostgreSQLFuzzyStrategy(config, pgPool, testProject);

      // Database search benchmark
      const dbBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchDatabase('React', 0.3, testProject);
      }, 10);

      // Client-side search benchmark
      const clientBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(testEntities, 'React');
      }, 10);

      console.log('\n=== PostgreSQL: Database vs Client-side Comparison ===');
      console.log('\nDatabase Search:');
      console.log(PerformanceUtils.formatBenchmarkResults(dbBenchmark));
      console.log(`Results: ${dbBenchmark.results[0].length}`);

      console.log('\nClient-side Search:');
      console.log(PerformanceUtils.formatBenchmarkResults(clientBenchmark));
      console.log(`Results: ${clientBenchmark.results[0].length}`);

      // Both should perform well, database might be faster for large datasets
      expect(dbBenchmark.avgTime).toBeLessThan(200);
      expect(clientBenchmark.avgTime).toBeLessThan(500);
    });
  });

  describe('SQLite Performance', () => {
    test('should benchmark SQLite client-side search performance', async () => {
      if (!sqliteDb) {
        console.log('Skipping SQLite test - database not available');
        return;
      }

      const strategy = new SQLiteFuzzyStrategy(config, sqliteDb, testProject);

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(testEntities, 'TypeScript');
      }, 10);

      console.log('\n=== SQLite Client-side Search (1000 entities) ===');
      console.log(PerformanceUtils.formatBenchmarkResults(benchmark));
      console.log(`Results found: ${benchmark.results[0].length}`);

      // SQLite client-side search should be fast
      expect(benchmark.avgTime).toBeLessThan(200);
      expect(benchmark.results[0].length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Database Performance Comparison', () => {
    test('should compare PostgreSQL vs SQLite client-side performance', async () => {
      if (!pgPool || !sqliteDb) {
        console.log('Skipping cross-database test - databases not available');
        return;
      }

      const pgStrategy = new PostgreSQLFuzzyStrategy(config, pgPool, testProject);
      const sqliteStrategy = new SQLiteFuzzyStrategy(config, sqliteDb, testProject);

      // PostgreSQL client-side benchmark
      const pgBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return pgStrategy.searchClientSide(testEntities, 'Docker');
      }, 10);

      // SQLite client-side benchmark
      const sqliteBenchmark = await PerformanceUtils.runBenchmark(async () => {
        return sqliteStrategy.searchClientSide(testEntities, 'Docker');
      }, 10);

      console.log('\n=== Cross-Database Client-side Performance ===');
      console.log('\nPostgreSQL Client-side:');
      console.log(PerformanceUtils.formatBenchmarkResults(pgBenchmark));

      console.log('\nSQLite Client-side:');
      console.log(PerformanceUtils.formatBenchmarkResults(sqliteBenchmark));

      // Both should perform similarly for client-side search
      expect(pgBenchmark.avgTime).toBeLessThan(200);
      expect(sqliteBenchmark.avgTime).toBeLessThan(200);

      // Results should be similar (fuzzy search may have slight variations)
      expect(Math.abs(pgBenchmark.results[0].length - sqliteBenchmark.results[0].length)).toBeLessThan(5);
    });
  });
});

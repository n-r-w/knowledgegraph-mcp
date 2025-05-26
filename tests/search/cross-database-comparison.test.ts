import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool as PgPool } from 'pg';
import Database from 'better-sqlite3';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from '../../search/strategies/sqlite-strategy.js';
import { SearchConfig } from '../../search/types.js';
import { Entity } from '../../core.js';
import { PerformanceUtils } from '../performance/performance-utils.js';
import { checkPostgreSQLAvailability } from '../utils/multi-backend-runner.js';

describe('Cross-Database Search Comparison', () => {
  let pgPool: PgPool | null = null;
  let sqliteDb: Database.Database | null = null;
  let pgStrategy: PostgreSQLFuzzyStrategy | null = null;
  let sqliteStrategy: SQLiteFuzzyStrategy | null = null;

  const testProject = 'cross_db_test';
  const config: SearchConfig = {
    threshold: 0.3,
    useDatabaseSearch: true,
    clientSideFallback: true,
    fuseOptions: {
      threshold: 0.3,
      distance: 100,
      includeScore: true,
      keys: ['name', 'entityType', 'observations', 'tags']
    }
  };

  const testEntities: Entity[] = [
    {
      name: 'JavaScript_Developer',
      entityType: 'person',
      observations: ['Experienced in React and Node.js', 'Works at tech startup'],
      tags: ['developer', 'frontend', 'backend']
    },
    {
      name: 'React_Framework',
      entityType: 'technology',
      observations: ['Popular frontend library', 'Component-based architecture'],
      tags: ['frontend', 'library', 'javascript']
    },
    {
      name: 'Node_Runtime',
      entityType: 'technology',
      observations: ['Server-side JavaScript runtime', 'Built on V8 engine'],
      tags: ['backend', 'runtime', 'javascript']
    },
    {
      name: 'Python_Developer',
      entityType: 'person',
      observations: ['Expert in Django and Flask', 'Data science background'],
      tags: ['developer', 'backend', 'data']
    },
    {
      name: 'Django_Framework',
      entityType: 'technology',
      observations: ['Python web framework', 'Batteries included approach'],
      tags: ['backend', 'framework', 'python']
    }
  ];

  beforeAll(async () => {
    // Setup PostgreSQL if available
    try {
      const isPostgreSQLAvailable = await checkPostgreSQLAvailability();
      if (isPostgreSQLAvailable) {
        pgPool = new PgPool({
          connectionString: 'postgresql://postgres:password@localhost:5432/knowledgegraph_test'
        });

        // Test connection
        const client = await pgPool.connect();
        client.release();

        pgStrategy = new PostgreSQLFuzzyStrategy(config, pgPool, testProject);

        // Setup test data in PostgreSQL
        await setupPostgreSQLTestData();
      }
    } catch (error) {
      console.log('PostgreSQL not available for cross-database testing:', error);
    }

    // Setup SQLite
    sqliteDb = new Database(':memory:');
    sqliteStrategy = new SQLiteFuzzyStrategy(config, sqliteDb, testProject);

    // Setup test data in SQLite
    await setupSQLiteTestData();
  });

  afterAll(async () => {
    if (pgPool) {
      await pgPool.end();
    }
    if (sqliteDb) {
      sqliteDb.close();
    }
  });

  async function setupPostgreSQLTestData() {
    if (!pgPool) return;

    const client = await pgPool.connect();
    try {
      // Create tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS entities (
          name TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          observations JSONB DEFAULT '[]',
          tags JSONB DEFAULT '[]',
          project TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Clear existing test data
      await client.query('DELETE FROM entities WHERE project = $1', [testProject]);

      // Insert test entities
      for (const entity of testEntities) {
        await client.query(`
          INSERT INTO entities (name, entity_type, observations, tags, project)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          entity.name,
          entity.entityType,
          JSON.stringify(entity.observations),
          JSON.stringify(entity.tags),
          testProject
        ]);
      }
    } finally {
      client.release();
    }
  }

  async function setupSQLiteTestData() {
    if (!sqliteDb) return;

    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        observations TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        project TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clear existing test data
    sqliteDb.prepare('DELETE FROM entities WHERE project = ?').run(testProject);

    // Insert test entities
    const stmt = sqliteDb.prepare(`
      INSERT INTO entities (name, entity_type, observations, tags, project)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const entity of testEntities) {
      stmt.run(
        entity.name,
        entity.entityType,
        JSON.stringify(entity.observations),
        JSON.stringify(entity.tags),
        testProject
      );
    }
  }

  test('should compare single query performance between PostgreSQL and SQLite', async () => {
    if (!pgStrategy || !sqliteStrategy) {
      console.log('Skipping cross-database test - databases not available');
      return;
    }

    const query = 'JavaScript';

    // PostgreSQL fuzzy search benchmark
    const pgBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return pgStrategy!.searchDatabase(query, 0.3, testProject);
    }, 5);

    // Load SQLite entities for client-side search
    const entities = await sqliteStrategy.getAllEntities(testProject);

    // SQLite client-side search benchmark
    const sqliteBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return sqliteStrategy!.searchClientSide(entities, query);
    }, 5);

    console.log('\nSingle Query Performance Comparison:');
    console.log('PostgreSQL (Database):');
    console.log(PerformanceUtils.formatBenchmarkResults(pgBenchmark));

    console.log('\nSQLite (Client-side):');
    console.log(PerformanceUtils.formatBenchmarkResults(sqliteBenchmark));

    // Both should find relevant results
    expect(pgBenchmark.results[0].length).toBeGreaterThan(0);
    expect(sqliteBenchmark.results[0].length).toBeGreaterThan(0);

    // Results should be reasonably similar (within 2 entities difference)
    expect(Math.abs(pgBenchmark.results[0].length - sqliteBenchmark.results[0].length)).toBeLessThanOrEqual(2);
  });

  test('should compare multiple query performance between PostgreSQL and SQLite', async () => {
    if (!pgStrategy || !sqliteStrategy) {
      console.log('Skipping cross-database test - databases not available');
      return;
    }

    const queries = ['JavaScript', 'React', 'Node.js'];

    // PostgreSQL multiple query benchmark
    const pgBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return pgStrategy!.searchDatabase(queries, 0.3, testProject);
    }, 5);

    // Load SQLite entities for client-side search
    const entities = await sqliteStrategy.getAllEntities(testProject);

    // SQLite multiple query benchmark
    const sqliteBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return sqliteStrategy!.searchClientSide(entities, queries);
    }, 5);

    console.log('\nMultiple Query Performance Comparison:');
    console.log('PostgreSQL (Database):');
    console.log(PerformanceUtils.formatBenchmarkResults(pgBenchmark));

    console.log('\nSQLite (Client-side):');
    console.log(PerformanceUtils.formatBenchmarkResults(sqliteBenchmark));

    // Both should find relevant results
    expect(pgBenchmark.results[0].length).toBeGreaterThan(0);
    expect(sqliteBenchmark.results[0].length).toBeGreaterThan(0);

    // Results should be reasonably similar (within 3 entities difference for multiple queries)
    expect(Math.abs(pgBenchmark.results[0].length - sqliteBenchmark.results[0].length)).toBeLessThanOrEqual(3);
  });

  test('should handle error conditions consistently', async () => {
    if (!pgStrategy || !sqliteStrategy) {
      console.log('Skipping error handling test - databases not available');
      return;
    }

    // Test with invalid project (should both handle gracefully)
    const invalidProject = 'nonexistent_project_12345';

    const pgResults = await pgStrategy.searchDatabase('test', 0.3, invalidProject);
    const sqliteResults = await sqliteStrategy.searchClientSide([], 'test');

    // Both should return empty arrays for invalid/empty data
    expect(pgResults).toEqual([]);
    expect(sqliteResults).toEqual([]);
  });

  test('should compare exact search performance for SQLite', async () => {
    if (!sqliteStrategy) {
      console.log('Skipping SQLite exact search test - SQLite not available');
      return;
    }

    const query = 'JavaScript';
    const queries = ['JavaScript', 'React'];

    // Single exact search benchmark
    const singleBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return sqliteStrategy!.searchExact(query, testProject);
    }, 5);

    // Multiple exact search benchmark
    const multipleBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return sqliteStrategy!.searchExact(queries, testProject);
    }, 5);

    console.log('\nSQLite Exact Search Performance:');
    console.log('Single Query:');
    console.log(PerformanceUtils.formatBenchmarkResults(singleBenchmark));

    console.log('\nMultiple Queries:');
    console.log(PerformanceUtils.formatBenchmarkResults(multipleBenchmark));

    // Both should find results
    expect(singleBenchmark.results[0].length).toBeGreaterThan(0);
    expect(multipleBenchmark.results[0].length).toBeGreaterThan(0);

    // Multiple queries should find at least as many results as single query
    expect(multipleBenchmark.results[0].length).toBeGreaterThanOrEqual(singleBenchmark.results[0].length);
  });
});

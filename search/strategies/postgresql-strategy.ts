import Fuse from 'fuse.js';
import { Pool as PgPool } from 'pg';
import { Entity } from '../../core.js';
import { SearchConfig } from '../types.js';
import { BaseSearchStrategy } from './base-strategy.js';
import { getValidatedSearchLimits } from '../config.js';

/**
 * PostgreSQL search strategy - supports both database-level and client-side fuzzy search
 */
export class PostgreSQLFuzzyStrategy extends BaseSearchStrategy {
  private searchLimits = getValidatedSearchLimits();

  constructor(
    config: SearchConfig,
    private pgPool: PgPool,
    private project: string
  ) {
    super(config);
  }

  canUseDatabase(): boolean {
    return this.config.useDatabaseSearch;
  }

  async searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]> {
    // Handle multiple queries with optimized SQL
    if (Array.isArray(query)) {
      return this.searchMultipleDatabaseOptimized(query, threshold, project);
    }

    // Single query - use existing logic
    return this.searchSingleDatabase(query, threshold, project);
  }

  private async searchSingleDatabase(query: string, threshold: number, project?: string): Promise<Entity[]> {
    const client = await this.pgPool.connect();
    try {
      // Use provided project parameter or fall back to constructor project
      const searchProject = project || this.project;

      const result = await client.query(`
        SELECT e.*,
               GREATEST(
                 similarity(e.name, $1),
                 similarity(e.entity_type, $1),
                 similarity(e.observations::text, $1),
                 similarity(e.tags::text, $1)
               ) as relevance_score
        FROM entities e
        WHERE e.project = $3
          AND (similarity(e.name, $1) > $2
               OR similarity(e.entity_type, $1) > $2
               OR similarity(e.observations::text, $1) > $2
               OR similarity(e.tags::text, $1) > $2)
        ORDER BY relevance_score DESC
        LIMIT $4
      `, [query, threshold, searchProject, this.searchLimits.maxResults]);

      return result.rows.map(row => ({
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations || [],
        tags: row.tags || []
      }));
    } finally {
      client.release();
    }
  }

  searchClientSide(entities: Entity[], query: string | string[]): Entity[] {
    // Handle multiple queries
    if (Array.isArray(query)) {
      return this.searchMultipleClientSide(entities, query);
    }

    // Single query - use existing logic
    return this.searchSingleClientSide(entities, query);
  }

  private searchSingleClientSide(entities: Entity[], query: string): Entity[] {
    // Use chunking for large entity sets to improve performance
    if (entities.length > this.searchLimits.clientSideChunkSize) {
      console.log(`PostgreSQL: Using chunked search for ${entities.length} entities (chunk size: ${this.searchLimits.clientSideChunkSize})`);
      return this.searchClientSideChunked(entities, query, this.searchLimits.clientSideChunkSize);
    }

    const fuseOptions = {
      threshold: this.config.threshold,
      distance: 100,
      includeScore: true,
      keys: ['name', 'entityType', 'observations', 'tags'],
      ...this.config.fuseOptions
    };

    const fuse = new Fuse(entities, fuseOptions);
    const results = fuse.search(query);

    return results.map(result => result.item);
  }

  /**
   * Get all entities for a project from PostgreSQL database
   * This is used to load entities for client-side search
   * Respects maxClientSideEntities limit to prevent memory issues
   */
  async getAllEntities(project?: string): Promise<Entity[]> {
    const client = await this.pgPool.connect();
    try {
      const searchProject = project || this.project;

      const result = await client.query(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = $1
        ORDER BY updated_at DESC, name
        LIMIT $2
      `, [searchProject, this.searchLimits.maxClientSideEntities]);

      // Log warning if we hit the limit
      if (result.rows.length === this.searchLimits.maxClientSideEntities) {
        console.warn(`PostgreSQL getAllEntities: Hit maxClientSideEntities limit of ${this.searchLimits.maxClientSideEntities}. Consider increasing KG_SEARCH_MAX_CLIENT_ENTITIES or using database-level search.`);
      }

      return result.rows.map(row => ({
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations || [],
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Failed to load entities from PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Optimized multiple query search using single SQL query with OR conditions
   * This replaces the inefficient sequential query processing from base strategy
   */
  private async searchMultipleDatabaseOptimized(queries: string[], threshold: number, project?: string): Promise<Entity[]> {
    // Handle empty queries array
    if (queries.length === 0) {
      return [];
    }

    // For very large query arrays, use batching to avoid excessive SQL complexity
    if (queries.length > this.searchLimits.batchSize) {
      return this.searchMultipleDatabaseBatched(queries, threshold, project, this.searchLimits.batchSize);
    }

    const client = await this.pgPool.connect();
    try {
      const searchProject = project || this.project;

      // Build parameterized query with OR conditions for each search term
      const conditions = queries.map((_, index) =>
        `(similarity(e.name, $${index + 1}) > $${queries.length + 1} OR
          similarity(e.entity_type, $${index + 1}) > $${queries.length + 1} OR
          similarity(e.observations::text, $${index + 1}) > $${queries.length + 1} OR
          similarity(e.tags::text, $${index + 1}) > $${queries.length + 1})`
      ).join(' OR ');

      // Build relevance score calculation for all queries
      const relevanceCalculations = queries.map((_, index) =>
        `similarity(e.name, $${index + 1}),
         similarity(e.entity_type, $${index + 1}),
         similarity(e.observations::text, $${index + 1}),
         similarity(e.tags::text, $${index + 1})`
      ).join(', ');

      const result = await client.query(`
        SELECT DISTINCT e.*,
               GREATEST(${relevanceCalculations}) as relevance_score
        FROM entities e
        WHERE e.project = $${queries.length + 2}
          AND (${conditions})
        ORDER BY relevance_score DESC
        LIMIT $${queries.length + 3}
      `, [...queries, threshold, searchProject, this.searchLimits.maxResults]);

      return result.rows.map(row => ({
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations || [],
        tags: row.tags || []
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Handle very large query arrays by processing them in batches
   */
  private async searchMultipleDatabaseBatched(queries: string[], threshold: number, project?: string, batchSize: number = 10): Promise<Entity[]> {
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    // Process queries in batches
    for (let i = 0; i < queries.length; i += batchSize) {
      const batchQueries = queries.slice(i, i + batchSize);

      // Use optimized SQL for this batch
      const batchResults = await this.searchMultipleDatabaseOptimized(batchQueries, threshold, project);

      // Deduplicate results
      const newEntities = batchResults.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }
}

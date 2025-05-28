import Fuse from 'fuse.js';
import Database from 'better-sqlite3';
import { Entity } from '../../core.js';
import { SearchConfig, PaginationOptions, PaginationResult } from '../types.js';
import { BaseSearchStrategy } from './base-strategy.js';
import { getValidatedSearchLimits } from '../config.js';

/**
 * SQLite search strategy - uses client-side fuzzy search only
 * SQLite doesn't have built-in fuzzy search capabilities like PostgreSQL,
 * so we always use Fuse.js for fuzzy searching
 */
export class SQLiteFuzzyStrategy extends BaseSearchStrategy {
  private searchLimits = getValidatedSearchLimits();

  constructor(
    config: SearchConfig,
    private db: Database.Database,
    private project: string
  ) {
    super(config);
  }

  canUseDatabase(): boolean {
    // SQLite doesn't support advanced fuzzy search at database level
    // Always use client-side search with Fuse.js
    return false;
  }

  async searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]> {
    // SQLite doesn't support database-level fuzzy search
    // This method should not be called since canUseDatabase() returns false
    throw new Error('SQLite does not support database-level fuzzy search. Use client-side search instead.');
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
      console.log(`SQLite: Using chunked search for ${entities.length} entities (chunk size: ${this.searchLimits.clientSideChunkSize})`);
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
   * Get all entities for a project from SQLite database
   * This is used to load entities for client-side search
   * Respects maxClientSideEntities limit to prevent memory issues
   */
  async getAllEntities(project?: string): Promise<Entity[]> {
    const searchProject = project || this.project;

    try {
      const stmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
        ORDER BY updated_at DESC, name
        LIMIT ?
      `);

      const rows = stmt.all(searchProject, this.searchLimits.maxClientSideEntities);

      // Log warning if we hit the limit
      if (rows.length === this.searchLimits.maxClientSideEntities) {
        console.warn(`SQLite getAllEntities: Hit maxClientSideEntities limit of ${this.searchLimits.maxClientSideEntities}. Consider increasing KNOWLEDGEGRAPH_SEARCH_MAX_CLIENT_ENTITIES or using database-level search.`);
      }

      return rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));
    } catch (error) {
      console.error('Failed to load entities from SQLite:', error);
      throw error; // Throw to be consistent with PostgreSQL behavior
    }
  }

  /**
   * Perform exact search at database level for better performance
   * This can be used as an optimization for exact searches
   */
  async searchExact(query: string | string[], project?: string): Promise<Entity[]> {
    // Handle multiple queries with optimized SQL
    if (Array.isArray(query)) {
      return this.searchExactMultiple(query, project);
    }

    // Single query - use existing logic
    return this.searchExactSingle(query, project);
  }

  /**
   * Optimized multiple exact search using single SQL query with OR conditions
   * This provides better performance than sequential searches
   */
  private async searchExactMultiple(queries: string[], project?: string): Promise<Entity[]> {
    // Handle empty queries array
    if (queries.length === 0) {
      return [];
    }

    const searchProject = project || this.project;

    try {
      // Build OR conditions for multiple terms
      const conditions = queries.map(() =>
        `(LOWER(name) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(observations) LIKE ? OR LOWER(tags) LIKE ?)`
      ).join(' OR ');

      // Prepare statement with dynamic parameters
      const stmt = this.db.prepare(`
        SELECT DISTINCT name, entity_type, observations, tags
        FROM entities
        WHERE project = ? AND (${conditions})
        ORDER BY updated_at DESC, name
        LIMIT ?
      `);

      // Create parameters array: [project, pattern1, pattern1, pattern1, pattern1, pattern2, ..., limit]
      const params: any[] = [searchProject];
      for (const query of queries) {
        const pattern = `%${query.toLowerCase()}%`;
        params.push(pattern, pattern, pattern, pattern);
      }
      params.push(this.searchLimits.maxResults);

      const rows = stmt.all(...params);

      return rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));
    } catch (error) {
      console.error('Failed to perform multiple exact search in SQLite:', error);
      throw error; // Throw to be consistent with PostgreSQL behavior
    }
  }

  /**
   * Single exact search implementation
   */
  private async searchExactSingle(query: string, project?: string): Promise<Entity[]> {
    const searchProject = project || this.project;
    const lowerQuery = query.toLowerCase();

    try {
      const stmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
          AND (
            LOWER(name) LIKE ?
            OR LOWER(entity_type) LIKE ?
            OR LOWER(observations) LIKE ?
            OR LOWER(tags) LIKE ?
          )
        ORDER BY updated_at DESC, name
        LIMIT ?
      `);

      const searchPattern = `%${lowerQuery}%`;
      const rows = stmt.all(searchProject, searchPattern, searchPattern, searchPattern, searchPattern, this.searchLimits.maxResults);

      return rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));
    } catch (error) {
      console.error('Failed to perform exact search in SQLite:', error);
      throw error; // Throw to be consistent with PostgreSQL behavior
    }
  }

  /**
   * Get all entities with pagination support
   */
  async getAllEntitiesPaginated(pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>> {
    const searchProject = project || this.project;
    const page = pagination.page || 0;
    const pageSize = pagination.pageSize || 100;
    const offset = page * pageSize;

    try {
      // Get total count
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total_count
        FROM entities
        WHERE project = ?
      `);
      const countResult = countStmt.get(searchProject) as { total_count: number };
      const totalCount = countResult.total_count;

      // Get paginated data
      const dataStmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
        ORDER BY updated_at DESC, name
        LIMIT ? OFFSET ?
      `);

      const rows = dataStmt.all(searchProject, pageSize, offset);

      const entities = rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: entities,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages,
          hasNextPage: page < totalPages - 1,
          hasPreviousPage: page > 0
        }
      };
    } catch (error) {
      console.error('Failed to load paginated entities from SQLite:', error);
      throw error;
    }
  }

  /**
   * Perform exact search with pagination support
   */
  async searchExactPaginated(query: string | string[], pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>> {
    // Handle multiple queries
    if (Array.isArray(query)) {
      return this.searchExactMultiplePaginated(query, pagination, project);
    }

    // Single query
    return this.searchExactSinglePaginated(query, pagination, project);
  }

  /**
   * Single exact search with pagination
   */
  private async searchExactSinglePaginated(query: string, pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>> {
    const searchProject = project || this.project;
    const lowerQuery = query.toLowerCase();
    const page = pagination.page || 0;
    const pageSize = pagination.pageSize || 100;
    const offset = page * pageSize;

    try {
      const searchPattern = `%${lowerQuery}%`;

      // Get total count
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total_count
        FROM entities
        WHERE project = ?
          AND (
            LOWER(name) LIKE ?
            OR LOWER(entity_type) LIKE ?
            OR LOWER(observations) LIKE ?
            OR LOWER(tags) LIKE ?
          )
      `);
      const countResult = countStmt.get(searchProject, searchPattern, searchPattern, searchPattern, searchPattern) as { total_count: number };
      const totalCount = countResult.total_count;

      // Get paginated data
      const dataStmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
          AND (
            LOWER(name) LIKE ?
            OR LOWER(entity_type) LIKE ?
            OR LOWER(observations) LIKE ?
            OR LOWER(tags) LIKE ?
          )
        ORDER BY updated_at DESC, name
        LIMIT ? OFFSET ?
      `);

      const rows = dataStmt.all(searchProject, searchPattern, searchPattern, searchPattern, searchPattern, pageSize, offset);

      const entities = rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: entities,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages,
          hasNextPage: page < totalPages - 1,
          hasPreviousPage: page > 0
        }
      };
    } catch (error) {
      console.error('Failed to perform paginated exact search in SQLite:', error);
      throw error;
    }
  }

  /**
   * Multiple exact search with pagination
   */
  private async searchExactMultiplePaginated(queries: string[], pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>> {
    if (queries.length === 0) {
      return {
        data: [],
        pagination: {
          currentPage: pagination.page || 0,
          pageSize: pagination.pageSize || 100,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }

    const searchProject = project || this.project;
    const page = pagination.page || 0;
    const pageSize = pagination.pageSize || 100;
    const offset = page * pageSize;

    try {
      // Build OR conditions for multiple terms
      const conditions = queries.map(() =>
        `(LOWER(name) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(observations) LIKE ? OR LOWER(tags) LIKE ?)`
      ).join(' OR ');

      // Create parameters array for patterns
      const params: any[] = [];
      for (const query of queries) {
        const pattern = `%${query.toLowerCase()}%`;
        params.push(pattern, pattern, pattern, pattern);
      }

      // Get total count
      const countStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT name) as total_count
        FROM entities
        WHERE project = ? AND (${conditions})
      `);
      const countResult = countStmt.get(searchProject, ...params) as { total_count: number };
      const totalCount = countResult.total_count;

      // Get paginated data
      const dataStmt = this.db.prepare(`
        SELECT DISTINCT name, entity_type, observations, tags
        FROM entities
        WHERE project = ? AND (${conditions})
        ORDER BY updated_at DESC, name
        LIMIT ? OFFSET ?
      `);

      const rows = dataStmt.all(searchProject, ...params, pageSize, offset);

      const entities = rows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: this.safeJsonParse(row.observations, []),
        tags: this.safeJsonParse(row.tags, [])
      }));

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: entities,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages,
          hasNextPage: page < totalPages - 1,
          hasPreviousPage: page > 0
        }
      };
    } catch (error) {
      console.error('Failed to perform paginated multiple exact search in SQLite:', error);
      throw error;
    }
  }

  /**
   * Safely parse JSON with fallback to default value
   */
  private safeJsonParse(jsonString: string | null, defaultValue: any): any {
    if (!jsonString) {
      return defaultValue;
    }

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return defaultValue;
    }
  }
}

import Fuse from 'fuse.js';
import Database from 'better-sqlite3';
import { Entity } from '../../core.js';
import { SearchConfig } from '../types.js';
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
   */
  async getAllEntities(project?: string): Promise<Entity[]> {
    const searchProject = project || this.project;

    try {
      const stmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
        ORDER BY updated_at DESC, name
      `);

      const rows = stmt.all(searchProject);

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

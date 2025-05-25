import Fuse from 'fuse.js';
import { Pool as PgPool } from 'pg';
import { Entity } from '../../core.js';
import { SearchConfig } from '../types.js';
import { BaseSearchStrategy } from './base-strategy.js';

/**
 * PostgreSQL search strategy - supports both database-level and client-side fuzzy search
 */
export class PostgreSQLFuzzyStrategy extends BaseSearchStrategy {
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

  async searchDatabase(query: string, threshold: number, project?: string): Promise<Entity[]> {
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
        LIMIT 100
      `, [query, threshold, searchProject]);

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

  searchClientSide(entities: Entity[], query: string): Entity[] {
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
}

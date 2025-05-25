// Import database drivers directly - PostgreSQL only
import { Pool as PgPool } from 'pg';
import { StorageProvider, StorageConfig, StorageType } from '../types.js';
import { KnowledgeGraph, Entity, Relation } from '../../index.js';

// Define row interfaces for type safety
interface EntityRow {
  name: string;
  entity_type: string;
  observations: string[]; // JSONB array for PostgreSQL
  tags: string[]; // JSONB array for PostgreSQL
}

interface RelationRow {
  from_entity: string;
  to_entity: string;
  relation_type: string;
}

/**
 * SQL database storage provider for PostgreSQL only
 */
export class SQLStorageProvider implements StorageProvider {
  private pgPool: PgPool | null = null;

  constructor(private config: StorageConfig) {
    if (!config.connectionString) {
      throw new Error(`Connection string is required for ${config.type} storage`);
    }

    if (config.type !== StorageType.POSTGRESQL) {
      throw new Error(`Only PostgreSQL is supported, got: ${config.type}`);
    }

    // Validate PostgreSQL connection string format
    this.validateConnectionString(config.connectionString);
  }

  /**
   * Validate PostgreSQL connection string format
   */
  private validateConnectionString(connectionString: string): void {
    try {
      // Basic format validation for PostgreSQL connection strings
      if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
        throw new Error(`PostgreSQL connection string must start with 'postgresql://' or 'postgres://'`);
      }

      // Try to parse as URL to validate format
      const url = new URL(connectionString);
      if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
        throw new Error(`Invalid PostgreSQL protocol: ${url.protocol}`);
      }

      // Validate required components
      if (!url.hostname) {
        throw new Error('PostgreSQL connection string must include hostname');
      }

    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        throw new Error(`Invalid PostgreSQL connection string format. Expected format: postgresql://username:password@host:port/database`);
      }
      throw error;
    }
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Initializing PostgreSQL with connection string: ${this.config.connectionString.replace(/:[^:@]*@/, ':***@')}`);

      // Initialize PostgreSQL connection
      this.pgPool = new PgPool({
        connectionString: this.config.connectionString,
        max: this.config.options?.maxConnections || 10,
        idleTimeoutMillis: this.config.options?.idleTimeout || 30000,
        connectionTimeoutMillis: this.config.options?.connectionTimeout || 2000,
      });

      // Test connection
      const client = await this.pgPool.connect();
      client.release();

      await this.createPostgreSQLTables();
      await this.initializeFuzzySearch();

      console.log(`PostgreSQL database initialized successfully`);
    } catch (error) {
      // Clean up pool if initialization failed
      if (this.pgPool) {
        try {
          await this.pgPool.end();
        } catch (cleanupError) {
          console.warn('Error cleaning up failed PostgreSQL pool:', cleanupError);
        }
        this.pgPool = null;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`PostgreSQL initialization failed: ${errorMessage}`);
      throw new Error(`Failed to initialize PostgreSQL database: ${errorMessage}`);
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      if (this.pgPool) {
        await this.pgPool.end();
        this.pgPool = null;
      }
    } catch (error) {
      console.warn(`Error closing database connections: ${error}`);
    }
  }

  /**
   * Health check for SQL storage
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.pgPool) {
        const client = await this.pgPool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Load knowledge graph from PostgreSQL database
   */
  async loadGraph(project: string): Promise<KnowledgeGraph> {
    try {
      return await this.loadGraphPostgreSQL(project);
    } catch (error) {
      throw new Error(`Failed to load graph for project ${project}: ${error}`);
    }
  }

  /**
   * Save knowledge graph to PostgreSQL database
   */
  async saveGraph(graph: KnowledgeGraph, project: string): Promise<void> {
    try {
      await this.saveGraphPostgreSQL(graph, project);
    } catch (error) {
      throw new Error(`Failed to save graph for project ${project}: ${error}`);
    }
  }

  /**
   * Load graph from PostgreSQL
   */
  private async loadGraphPostgreSQL(project: string): Promise<KnowledgeGraph> {
    if (!this.pgPool) throw new Error('PostgreSQL pool not initialized');

    const client = await this.pgPool.connect();
    try {
      // Load entities
      const entitiesResult = await client.query(
        'SELECT name, entity_type, observations, tags FROM entities WHERE project = $1',
        [project]
      );

      const entities: Entity[] = entitiesResult.rows.map((row: EntityRow) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: Array.isArray(row.observations) ? row.observations : [], // JSONB is already parsed by PostgreSQL
        tags: Array.isArray(row.tags) ? row.tags : [] // JSONB is already parsed by PostgreSQL
      }));

      // Load relations
      const relationsResult = await client.query(
        'SELECT from_entity, to_entity, relation_type FROM relations WHERE project = $1',
        [project]
      );

      const relations: Relation[] = relationsResult.rows.map((row: RelationRow) => ({
        from: row.from_entity,
        to: row.to_entity,
        relationType: row.relation_type
      }));

      return { entities, relations };
    } finally {
      client.release();
    }
  }

  /**
   * Save graph to PostgreSQL
   */
  private async saveGraphPostgreSQL(graph: KnowledgeGraph, project: string): Promise<void> {
    if (!this.pgPool) throw new Error('PostgreSQL pool not initialized');

    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing data
      await client.query('DELETE FROM entities WHERE project = $1', [project]);
      await client.query('DELETE FROM relations WHERE project = $1', [project]);

      // Insert entities
      for (const entity of graph.entities) {
        await client.query(
          'INSERT INTO entities (project, name, entity_type, observations, tags, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
          [project, entity.name, entity.entityType, JSON.stringify(entity.observations), JSON.stringify(entity.tags || [])]
        );
      }

      // Insert relations
      for (const relation of graph.relations) {
        await client.query(
          'INSERT INTO relations (project, from_entity, to_entity, relation_type) VALUES ($1, $2, $3, $4)',
          [project, relation.from, relation.to, relation.relationType]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }





  /**
   * Create PostgreSQL tables
   */
  private async createPostgreSQLTables(): Promise<void> {
    if (!this.pgPool) throw new Error('PostgreSQL pool not initialized');

    const client = await this.pgPool.connect();
    try {
      // Create entities table
      await client.query(`
        CREATE TABLE IF NOT EXISTS entities (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          name TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          observations JSONB NOT NULL,
          tags JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project, name)
        )
      `);

      // Create relations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS relations (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          from_entity TEXT NOT NULL,
          to_entity TEXT NOT NULL,
          relation_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project, from_entity, to_entity, relation_type)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project);
        CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(project, name);
        CREATE INDEX IF NOT EXISTS idx_relations_project ON relations(project);
        CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(project, from_entity);
        CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(project, to_entity);
      `);
    } finally {
      client.release();
    }
  }



  /**
   * Optional migration method for data migration
   */
  async migrate(_project: string): Promise<void> {
    // Migration logic can be implemented here if needed
    // For now, this is a no-op
  }

  /**
   * Check if PostgreSQL trigram extension is available
   */
  private async hasTrigramExtension(): Promise<boolean> {
    if (!this.pgPool) return false;

    const client = await this.pgPool.connect();
    try {
      const result = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
        ) as has_extension
      `);
      return result.rows[0].has_extension;
    } catch (error) {
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Enable PostgreSQL trigram extension
   */
  private async enableTrigramExtension(): Promise<void> {
    if (!this.pgPool) return;

    const client = await this.pgPool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
    } finally {
      client.release();
    }
  }

  /**
   * Create fuzzy search indexes for PostgreSQL
   */
  private async createFuzzySearchIndexes(): Promise<void> {
    if (!this.pgPool) return;

    const client = await this.pgPool.connect();
    try {
      // Create trigram indexes for text fields only
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_name_trgm_idx
        ON entities USING GIN (name gin_trgm_ops)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_type_trgm_idx
        ON entities USING GIN (entity_type gin_trgm_ops)
      `);

      // For JSONB arrays, we need to convert to text first
      // This creates an index on the text representation of the observations array
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_obs_trgm_idx
        ON entities USING GIN ((observations::text) gin_trgm_ops)
      `);

      // Create an index for tags array as well
      await client.query(`
        CREATE INDEX IF NOT EXISTS entities_tags_trgm_idx
        ON entities USING GIN ((tags::text) gin_trgm_ops)
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Initialize fuzzy search capabilities
   */
  async initializeFuzzySearch(): Promise<void> {
    try {
      // Check if trigram extension is available before enabling
      const hasExtension = await this.hasTrigramExtension();
      if (!hasExtension) {
        await this.enableTrigramExtension();
      }
      await this.createFuzzySearchIndexes();
      console.log('PostgreSQL fuzzy search initialized');
    } catch (error) {
      console.warn('Failed to initialize PostgreSQL fuzzy search:', error);
    }
  }

  /**
   * Get the PostgreSQL pool for search strategies
   */
  getPostgreSQLPool(): PgPool | null {
    return this.pgPool;
  }
}
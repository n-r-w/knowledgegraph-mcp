import Database from 'better-sqlite3';
import { StorageProvider, StorageConfig, StorageType } from '../types.js';
import { KnowledgeGraph, Entity, Relation } from '../../core.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * SQLite storage provider for lightweight deployments
 */
export class SQLiteStorageProvider implements StorageProvider {
  private db: Database.Database | null = null;

  constructor(private config: StorageConfig) {
    if (config.type !== StorageType.SQLITE) {
      throw new Error(`Only SQLite is supported, got: ${config.type}`);
    }
  }

  /**
   * Initialize SQLite database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Extract file path from connection string
      // Format: sqlite:///path/to/database.db or sqlite://./database.db
      const dbPath = this.extractDbPath(this.config.connectionString);

      // Ensure the directory exists for file-based databases (not in-memory)
      if (dbPath !== ':memory:' && !dbPath.startsWith('./')) {
        const dbDir = dirname(dbPath);
        if (!existsSync(dbDir)) {
          try {
            mkdirSync(dbDir, { recursive: true });
            console.log(`Created SQLite database directory: ${dbDir}`);
          } catch (error) {
            console.warn(`Failed to create SQLite database directory: ${error}`);
          }
        }
      }

      this.db = new Database(dbPath, {
        verbose: this.config.options?.verbose ? console.log : undefined,
        fileMustExist: false
      });

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.createTables();

      console.log(`SQLite database initialized at: ${dbPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize SQLite database: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    } catch (error) {
      console.warn(`Error closing SQLite database: ${error}`);
    }
  }

  /**
   * Health check for SQLite storage
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.db) {
        // Simple query to check if database is accessible
        this.db.prepare('SELECT 1').get();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Load knowledge graph from SQLite database
   */
  async loadGraph(project: string): Promise<KnowledgeGraph> {
    if (!this.db) throw new Error('SQLite database not initialized');

    try {
      // Load entities
      const entitiesStmt = this.db.prepare(`
        SELECT name, entity_type, observations, tags
        FROM entities
        WHERE project = ?
        ORDER BY name
      `);
      const entityRows = entitiesStmt.all(project);

      const entities: Entity[] = entityRows.map((row: any) => ({
        name: row.name,
        entityType: row.entity_type,
        observations: JSON.parse(row.observations || '[]'),
        tags: JSON.parse(row.tags || '[]')
      }));

      // Load relations
      const relationsStmt = this.db.prepare(`
        SELECT from_entity, to_entity, relation_type
        FROM relations
        WHERE project = ?
        ORDER BY from_entity, to_entity
      `);
      const relationRows = relationsStmt.all(project);

      const relations: Relation[] = relationRows.map((row: any) => ({
        from: row.from_entity,
        to: row.to_entity,
        relationType: row.relation_type
      }));

      return { entities, relations };
    } catch (error) {
      throw new Error(`Failed to load graph for project ${project}: ${error}`);
    }
  }

  /**
   * Save knowledge graph to SQLite database
   */
  async saveGraph(graph: KnowledgeGraph, project: string): Promise<void> {
    if (!this.db) throw new Error('SQLite database not initialized');

    try {
      // Use transaction for atomicity
      const transaction = this.db.transaction(() => {
        // Clear existing data
        this.db!.prepare('DELETE FROM entities WHERE project = ?').run(project);
        this.db!.prepare('DELETE FROM relations WHERE project = ?').run(project);

        // Insert entities
        const insertEntity = this.db!.prepare(`
          INSERT INTO entities (project, name, entity_type, observations, tags, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

        for (const entity of graph.entities) {
          insertEntity.run(
            project,
            entity.name,
            entity.entityType,
            JSON.stringify(entity.observations),
            JSON.stringify(entity.tags || [])
          );
        }

        // Insert relations
        const insertRelation = this.db!.prepare(`
          INSERT INTO relations (project, from_entity, to_entity, relation_type, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `);

        for (const relation of graph.relations) {
          insertRelation.run(
            project,
            relation.from,
            relation.to,
            relation.relationType
          );
        }
      });

      transaction();
    } catch (error) {
      throw new Error(`Failed to save graph for project ${project}: ${error}`);
    }
  }

  /**
   * Extract database file path from connection string
   */
  private extractDbPath(connectionString: string): string {
    // Handle different SQLite connection string formats:
    // sqlite:///absolute/path/to/db.sqlite
    // sqlite://./relative/path/to/db.sqlite
    // sqlite://:memory: (in-memory database)

    if (connectionString.startsWith('sqlite:///')) {
      return connectionString.substring(9); // Remove 'sqlite://' to get '/absolute/path'
    } else if (connectionString.startsWith('sqlite://')) {
      return connectionString.substring(9); // Remove 'sqlite://' to get './relative/path'
    } else if (connectionString === 'sqlite://:memory:') {
      return ':memory:';
    } else if (connectionString === ':memory:') {
      return ':memory:';
    } else {
      // Assume it's a direct file path
      return connectionString;
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create entities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        observations TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        updated_at TEXT NOT NULL,
        UNIQUE(project, name)
      )
    `);

    // Create relations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project, from_entity, to_entity, relation_type)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_relations_project ON relations(project);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity);
    `);
  }

  /**
   * Get SQLite database instance (for search strategies)
   */
  getSQLiteDatabase(): Database.Database | null {
    return this.db;
  }
}

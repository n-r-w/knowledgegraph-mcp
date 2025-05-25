import { KnowledgeGraph } from '../index.js';

/**
 * Storage types supported by the knowledge graph MCP server
 */
export enum StorageType {
  POSTGRESQL = 'postgresql',
  SQLITE = 'sqlite'
}

/**
 * Configuration for storage providers
 */
export interface StorageConfig {
  type: StorageType;
  connectionString: string;
  fuzzySearch?: {
    useDatabaseSearch?: boolean;  // PostgreSQL only (SQLite uses client-side)
    threshold?: number;           // 0.0 to 1.0
    clientSideFallback?: boolean; // Fallback to fuse.js
  };
  options?: Record<string, any>;
}

/**
 * Abstract interface for storage providers
 */
export interface StorageProvider {
  /**
   * Load a knowledge graph for a specific project
   */
  loadGraph(project: string): Promise<KnowledgeGraph>;

  /**
   * Save a knowledge graph for a specific project
   */
  saveGraph(graph: KnowledgeGraph, project: string): Promise<void>;

  /**
   * Initialize the storage provider (create tables, directories, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Close connections and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Optional migration method for data migration between storage types
   */
  migrate?(project: string): Promise<void>;

  /**
   * Health check for the storage provider
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * Migration service interface for moving data between storage providers
 */
export interface MigrationService {
  migrateFromStorage(project: string, sourceStorage: StorageProvider, targetStorage: StorageProvider): Promise<void>;
}

/**
 * Storage provider factory interface
 */
export interface StorageFactory {
  create(config: StorageConfig): StorageProvider;
}

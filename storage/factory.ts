import { StorageProvider, StorageConfig, StorageType, StorageFactory as IStorageFactory } from './types.js';
import { SQLStorageProvider } from './providers/sql-storage.js';
import { SQLiteStorageProvider } from './providers/sqlite-storage.js';
import { resolveSQLiteConnectionString } from '../utils.js';

/**
 * Factory class for creating storage providers based on configuration
 */
export class StorageFactory implements IStorageFactory {
  /**
   * Create a storage provider based on the provided configuration
   */
  static create(config: StorageConfig): StorageProvider {
    switch (config.type) {
      case StorageType.POSTGRESQL:
        return new SQLStorageProvider(config);

      case StorageType.SQLITE:
        return new SQLiteStorageProvider(config);

      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }

  /**
   * Create storage provider instance (non-static method for interface compliance)
   */
  create(config: StorageConfig): StorageProvider {
    return StorageFactory.create(config);
  }

  /**
   * Get default storage configuration from environment variables
   */
  static getDefaultConfig(): StorageConfig {
    const storageType = (process.env.KNOWLEDGEGRAPH_STORAGE_TYPE as StorageType) || StorageType.POSTGRESQL;

    // Set default connection string based on storage type
    let defaultConnectionString: string;
    if (storageType === StorageType.SQLITE) {
      // Use custom connection string if provided, otherwise use default home directory path
      defaultConnectionString = process.env.KNOWLEDGEGRAPH_CONNECTION_STRING || resolveSQLiteConnectionString();
    } else {
      defaultConnectionString = process.env.KNOWLEDGEGRAPH_CONNECTION_STRING || 'postgresql://postgres:1@localhost:5432/knowledgegraph';
    }

    const config: StorageConfig = {
      type: storageType,
      connectionString: defaultConnectionString,
      fuzzySearch: {
        useDatabaseSearch: storageType === StorageType.POSTGRESQL, // Only PostgreSQL supports database-level search
        threshold: 0.3,
        clientSideFallback: true
      }
    };

    // Add any additional options from environment
    if (process.env.KNOWLEDGEGRAPH_STORAGE_OPTIONS) {
      try {
        config.options = JSON.parse(process.env.KNOWLEDGEGRAPH_STORAGE_OPTIONS);
      } catch (error) {
        console.warn('Failed to parse KNOWLEDGEGRAPH_STORAGE_OPTIONS:', error);
      }
    }

    return config;
  }

  /**
   * Validate storage configuration
   */
  static validateConfig(config: StorageConfig): void {
    if (!Object.values(StorageType).includes(config.type)) {
      throw new Error(`Invalid storage type: ${config.type}`);
    }

    if (!config.connectionString) {
      throw new Error(`${config.type} storage requires connectionString configuration`);
    }
  }
}

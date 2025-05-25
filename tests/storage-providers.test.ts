import { StorageFactory, StorageType, StorageConfig } from '../storage/index.js';
import { KnowledgeGraph } from '../core.js';

// Mock the PostgreSQL module to avoid requiring actual database connections
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Storage Providers', () => {
  const testGraph: KnowledgeGraph = {
    entities: [
      { name: 'TestEntity1', entityType: 'Type1', observations: ['obs1', 'obs2'], tags: ['test', 'entity1'] },
      { name: 'TestEntity2', entityType: 'Type2', observations: ['obs3'], tags: ['test', 'entity2'] }
    ],
    relations: [
      { from: 'TestEntity1', to: 'TestEntity2', relationType: 'relatedTo' }
    ]
  };

  describe('PostgreSQLStorageProvider', () => {
    test('should create storage provider correctly', async () => {
      const config: StorageConfig = {
        type: StorageType.POSTGRESQL,
        connectionString: 'postgresql://test:test@localhost:5432/test'
      };

      const storage = StorageFactory.create(config);
      expect(storage).toBeDefined();
      expect(storage.constructor.name).toBe('SQLStorageProvider');
    });

    test('should handle initialization', async () => {
      const config: StorageConfig = {
        type: StorageType.POSTGRESQL,
        connectionString: 'postgresql://test:test@localhost:5432/test'
      };

      const storage = StorageFactory.create(config);

      // Should not throw with mocked database
      await expect(storage.initialize()).resolves.not.toThrow();
      await storage.close();
    });

    test('should handle health check correctly', async () => {
      const config: StorageConfig = {
        type: StorageType.POSTGRESQL,
        connectionString: 'postgresql://test:test@localhost:5432/test'
      };

      const storage = StorageFactory.create(config);
      await storage.initialize();

      const isHealthy = await storage.healthCheck?.();
      expect(isHealthy).toBe(true);

      await storage.close();
    });
  });

  describe('SQLiteStorageProvider', () => {
    test('should create storage provider correctly', async () => {
      const config: StorageConfig = {
        type: StorageType.SQLITE,
        connectionString: 'sqlite://:memory:'
      };

      const storage = StorageFactory.create(config);
      expect(storage).toBeDefined();
      expect(storage.constructor.name).toBe('SQLiteStorageProvider');
    });

    test('should handle initialization', async () => {
      const config: StorageConfig = {
        type: StorageType.SQLITE,
        connectionString: 'sqlite://:memory:'
      };

      const storage = StorageFactory.create(config);

      // Should not throw with in-memory database
      await expect(storage.initialize()).resolves.not.toThrow();
      await storage.close();
    });

    test('should handle health check correctly', async () => {
      const config: StorageConfig = {
        type: StorageType.SQLITE,
        connectionString: 'sqlite://:memory:'
      };

      const storage = StorageFactory.create(config);
      await storage.initialize();

      const isHealthy = await storage.healthCheck?.();
      expect(isHealthy).toBe(true);

      await storage.close();
    });
  });

  describe('StorageFactory', () => {
    test('should create PostgreSQL storage provider', () => {
      const config: StorageConfig = {
        type: StorageType.POSTGRESQL,
        connectionString: 'postgresql://test:test@localhost:5432/test'
      };

      const storage = StorageFactory.create(config);
      expect(storage).toBeDefined();
      expect(storage.constructor.name).toBe('SQLStorageProvider');
    });

    test('should create SQLite storage provider', () => {
      const config: StorageConfig = {
        type: StorageType.SQLITE,
        connectionString: 'sqlite://:memory:'
      };

      const storage = StorageFactory.create(config);
      expect(storage).toBeDefined();
      expect(storage.constructor.name).toBe('SQLiteStorageProvider');
    });

    test('should throw error for unsupported storage type', () => {
      const config: StorageConfig = {
        type: 'unsupported' as StorageType,
        connectionString: 'test://connection'
      };

      expect(() => StorageFactory.create(config)).toThrow('Unsupported storage type');
    });

    test('should get default config from environment', () => {
      // Save original env vars
      const originalStorageType = process.env.KNOWLEDGEGRAPH_STORAGE_TYPE;
      const originalConnectionString = process.env.KNOWLEDGEGRAPH_CONNECTION_STRING;

      try {
        // Set test env vars
        process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = 'postgresql';
        process.env.KNOWLEDGEGRAPH_CONNECTION_STRING = 'postgresql://test:test@localhost:5432/test';

        const config = StorageFactory.getDefaultConfig();
        expect(config.type).toBe(StorageType.POSTGRESQL);
        expect(config.connectionString).toBe('postgresql://test:test@localhost:5432/test');
      } finally {
        // Restore original env vars
        if (originalStorageType !== undefined) {
          process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = originalStorageType;
        } else {
          delete process.env.KNOWLEDGEGRAPH_STORAGE_TYPE;
        }

        if (originalConnectionString !== undefined) {
          process.env.KNOWLEDGEGRAPH_CONNECTION_STRING = originalConnectionString;
        } else {
          delete process.env.KNOWLEDGEGRAPH_CONNECTION_STRING;
        }
      }
    });
  });
});

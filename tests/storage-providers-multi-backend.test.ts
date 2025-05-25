import { StorageFactory, StorageType, StorageConfig } from '../storage/index.js';
import { KnowledgeGraph } from '../core.js';
import { runTestsForAvailableBackends } from './utils/multi-backend-runner.js';
import {
  createTestManager,
  cleanupTestManager,
  getBackendCapabilities,
  createBackendTestProject
} from './utils/backend-test-helpers.js';

describe('Storage Providers - Multi-Backend Tests', () => {
  const testGraph: KnowledgeGraph = {
    entities: [
      { name: 'TestEntity1', entityType: 'Type1', observations: ['obs1', 'obs2'], tags: ['test', 'entity1'] },
      { name: 'TestEntity2', entityType: 'Type2', observations: ['obs3'], tags: ['test', 'entity2'] }
    ],
    relations: [
      { from: 'TestEntity1', to: 'TestEntity2', relationType: 'relatedTo' }
    ]
  };

  // Test storage provider creation and basic functionality across all backends
  runTestsForAvailableBackends((config: StorageConfig, backendName: string) => {
    describe(`Storage Provider Tests`, () => {
      test('should create storage provider correctly', async () => {
        const storage = StorageFactory.create(config);
        expect(storage).toBeDefined();
        expect(storage.constructor.name).toBe(
          config.type === StorageType.SQLITE ? 'SQLiteStorageProvider' : 'SQLStorageProvider'
        );
      });

      test('should handle initialization', async () => {
        const storage = StorageFactory.create(config);

        // Should not throw during initialization
        await expect(storage.initialize()).resolves.not.toThrow();
        await storage.close();
      }, 10000);

      test('should handle health check correctly', async () => {
        const storage = StorageFactory.create(config);
        await storage.initialize();

        const isHealthy = await storage.healthCheck?.();
        expect(isHealthy).toBe(true);

        await storage.close();
      }, 10000);

      test('should handle basic CRUD operations', async () => {
        const manager = await createTestManager(config, backendName);
        const testProject = createBackendTestProject(config.type, 'crud_test');

        try {
          // Create entities
          await manager.createEntities(testGraph.entities, testProject);

          // Read back the graph
          const retrievedGraph = await manager.readGraph(testProject);

          expect(retrievedGraph.entities).toHaveLength(testGraph.entities.length);
          expect(retrievedGraph.entities[0].name).toBe('TestEntity1');
          expect(retrievedGraph.entities[1].name).toBe('TestEntity2');

          // Create relations
          await manager.createRelations(testGraph.relations, testProject);

          // Read back with relations
          const graphWithRelations = await manager.readGraph(testProject);
          expect(graphWithRelations.relations).toHaveLength(testGraph.relations.length);
          expect(graphWithRelations.relations[0].from).toBe('TestEntity1');
          expect(graphWithRelations.relations[0].to).toBe('TestEntity2');

        } finally {
          await cleanupTestManager(manager, backendName);
        }
      }, 15000);

      test('should handle entity updates via tag management', async () => {
        const manager = await createTestManager(config, backendName);
        const testProject = createBackendTestProject(config.type, 'update_test');

        try {
          // Create initial entity
          const initialEntity = {
            name: 'UpdateTest',
            entityType: 'TestType',
            observations: ['initial'],
            tags: ['test']
          };
          await manager.createEntities([initialEntity], testProject);

          // Update entity by adding tags
          await manager.addTags([{
            entityName: 'UpdateTest',
            tags: ['updated', 'modified']
          }], testProject);

          // Verify update
          const graph = await manager.readGraph(testProject);
          expect(graph.entities).toHaveLength(1);
          expect(graph.entities[0].tags).toContain('test');
          expect(graph.entities[0].tags).toContain('updated');
          expect(graph.entities[0].tags).toContain('modified');

        } finally {
          await cleanupTestManager(manager, backendName);
        }
      }, 15000);

      test('should handle entity deletion', async () => {
        const manager = await createTestManager(config, backendName);
        const testProject = createBackendTestProject(config.type, 'delete_test');

        try {
          // Create entities
          await manager.createEntities(testGraph.entities, testProject);

          // Verify creation
          let graph = await manager.readGraph(testProject);
          expect(graph.entities).toHaveLength(2);

          // Delete one entity
          await manager.deleteEntities(['TestEntity1'], testProject);

          // Verify deletion
          graph = await manager.readGraph(testProject);
          expect(graph.entities).toHaveLength(1);
          expect(graph.entities[0].name).toBe('TestEntity2');

        } finally {
          await cleanupTestManager(manager, backendName);
        }
      }, 15000);

      test('should handle backend-specific capabilities', async () => {
        const capabilities = getBackendCapabilities(config.type);

        // Test based on backend capabilities
        if (capabilities.supportsDatabaseSearch) {
          expect(config.type).toBe(StorageType.POSTGRESQL);
        } else {
          expect(config.type).toBe(StorageType.SQLITE);
        }

        expect(capabilities.supportsTransactions).toBe(true);
        expect(capabilities.supportsFullTextSearch).toBe(true);

        if (config.type === StorageType.SQLITE) {
          expect(capabilities.isInMemory).toBe(true);
          expect(capabilities.requiresExternalServer).toBe(false);
        } else {
          expect(capabilities.isInMemory).toBe(false);
          expect(capabilities.requiresExternalServer).toBe(true);
        }
      });
    });
  });

  // Test StorageFactory functionality (backend-agnostic)
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

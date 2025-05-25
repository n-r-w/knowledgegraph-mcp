import { KnowledgeGraphManager, Entity, Relation } from '../core.js';
import { StorageConfig, StorageType } from '../storage/index.js';

// Mock PostgreSQL to avoid requiring actual database connections
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => {
    const mockData = new Map<string, any>();

    return {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
          // Mock database operations for testing
          if (sql.includes('SELECT') && sql.includes('entities')) {
            const project = params?.[0] || 'default';
            const entities = mockData.get(`entities_${project}`) || [];
            return { rows: entities };
          } else if (sql.includes('SELECT') && sql.includes('relations')) {
            const project = params?.[0] || 'default';
            const relations = mockData.get(`relations_${project}`) || [];
            return { rows: relations };
          } else if (sql.includes('DELETE FROM entities')) {
            const project = params?.[0] || 'default';
            mockData.delete(`entities_${project}`);
            return { rows: [] };
          } else if (sql.includes('DELETE FROM relations')) {
            const project = params?.[0] || 'default';
            mockData.delete(`relations_${project}`);
            return { rows: [] };
          } else if (sql.includes('INSERT INTO entities')) {
            const project = params?.[0] || 'default';
            const entities = mockData.get(`entities_${project}`) || [];
            const newEntity = {
              name: params?.[1],
              entity_type: params?.[2],
              observations: JSON.parse(params?.[3] || '[]'),
              tags: JSON.parse(params?.[4] || '[]')
            };
            entities.push(newEntity);
            mockData.set(`entities_${project}`, entities);
            return { rows: [] };
          } else if (sql.includes('INSERT INTO relations')) {
            const project = params?.[0] || 'default';
            const relations = mockData.get(`relations_${project}`) || [];
            const newRelation = {
              project: params?.[0],
              from_entity: params?.[1],
              to_entity: params?.[2],
              relation_type: params?.[3]
            };
            relations.push(newRelation);
            mockData.set(`relations_${project}`, relations);
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn()
      }),
      end: jest.fn().mockResolvedValue(undefined)
    };
  })
}));

describe('KnowledgeGraphManager Project Isolation', () => {
  let manager: KnowledgeGraphManager;
  let testCounter = 0;

  beforeEach(async () => {
    testCounter++;
    // Use PostgreSQL configuration with mocked database
    const config: StorageConfig = {
      type: StorageType.POSTGRESQL,
      connectionString: 'postgresql://test:test@localhost:5432/test'
    };
    manager = new KnowledgeGraphManager(config);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await manager.close();
  });

  // Helper function to get unique project name for each test
  const getTestProject = (suffix: string = '') => `test_project_${testCounter}_${Date.now()}${suffix ? '_' + suffix : ''}`;

  describe('Project Isolation', () => {
    test('should isolate entities between projects', async () => {
      const project1 = getTestProject('1');
      const project2 = getTestProject('2');

      // Create entities in project1
      const project1Entities: Entity[] = [
        { name: 'Entity1', entityType: 'Type1', observations: ['obs1'], tags: ['tag1'] }
      ];
      await manager.createEntities(project1Entities, project1);

      // Create entities in project2
      const project2Entities: Entity[] = [
        { name: 'Entity2', entityType: 'Type2', observations: ['obs2'], tags: ['tag2'] }
      ];
      await manager.createEntities(project2Entities, project2);

      // Verify project1 only sees its entities
      const project1Graph = await manager.readGraph(project1);
      expect(project1Graph.entities).toHaveLength(1);
      expect(project1Graph.entities[0].name).toBe('Entity1');

      // Verify project2 only sees its entities
      const project2Graph = await manager.readGraph(project2);
      expect(project2Graph.entities).toHaveLength(1);
      expect(project2Graph.entities[0].name).toBe('Entity2');
    });

    test('should isolate relations between projects', async () => {
      const project1 = getTestProject('1');
      const project2 = getTestProject('2');

      // Create entities in both projects
      const entities: Entity[] = [
        { name: 'EntityA', entityType: 'Type1', observations: ['obs1'], tags: [] },
        { name: 'EntityB', entityType: 'Type2', observations: ['obs2'], tags: [] }
      ];
      await manager.createEntities(entities, project1);
      await manager.createEntities(entities, project2);

      // Create relations in each project
      const relations1: Relation[] = [{ from: 'EntityA', to: 'EntityB', relationType: 'relates_to' }];
      const relations2: Relation[] = [{ from: 'EntityB', to: 'EntityA', relationType: 'connects_to' }];

      await manager.createRelations(relations1, project1);
      await manager.createRelations(relations2, project2);

      // Verify isolation
      const project1Graph = await manager.readGraph(project1);
      expect(project1Graph.relations).toHaveLength(1);
      expect(project1Graph.relations[0].relationType).toBe('relates_to');

      const project2Graph = await manager.readGraph(project2);
      expect(project2Graph.relations).toHaveLength(1);
      expect(project2Graph.relations[0].relationType).toBe('connects_to');
    });

    test('should isolate search results between projects', async () => {
      const project1 = getTestProject('1');
      const project2 = getTestProject('2');

      // Create different entities in each project
      const project1Entities: Entity[] = [
        { name: 'SearchEntity', entityType: 'Type1', observations: ['project1 data'], tags: ['project1'] }
      ];
      const project2Entities: Entity[] = [
        { name: 'SearchEntity', entityType: 'Type2', observations: ['project2 data'], tags: ['project2'] }
      ];

      await manager.createEntities(project1Entities, project1);
      await manager.createEntities(project2Entities, project2);

      // Search in each project
      const project1Results = await manager.searchNodes('SearchEntity', project1);
      const project2Results = await manager.searchNodes('SearchEntity', project2);

      // Verify results are isolated
      expect(project1Results.entities[0].observations[0]).toBe('project1 data');
      expect(project2Results.entities[0].observations[0]).toBe('project2 data');
    });
  });

  describe('Default Project Behavior', () => {
    test('should use default project when no project specified', async () => {
      const entities: Entity[] = [
        { name: 'DefaultEntity', entityType: 'Type1', observations: ['default obs'], tags: [] }
      ];

      await manager.createEntities(entities); // No project specified
      const graph = await manager.readGraph(); // No project specified

      // Should be in default project
      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].name).toBe('DefaultEntity');
    });

    test('should respect KNOWLEDGEGRAPH_PROJECT environment variable', async () => {
      const originalEnvProject = process.env.KNOWLEDGEGRAPH_PROJECT;
      const envProject = getTestProject('env');

      try {
        process.env.KNOWLEDGEGRAPH_PROJECT = envProject;

        const entities: Entity[] = [
          { name: 'EnvEntity', entityType: 'Type1', observations: ['env obs'], tags: [] }
        ];

        await manager.createEntities(entities); // No project specified, should use env var
        const graph = await manager.readGraph(envProject); // Explicit project

        expect(graph.entities).toHaveLength(1);
        expect(graph.entities[0].name).toBe('EnvEntity');
      } finally {
        // Restore original environment variable
        if (originalEnvProject !== undefined) {
          process.env.KNOWLEDGEGRAPH_PROJECT = originalEnvProject;
        } else {
          delete process.env.KNOWLEDGEGRAPH_PROJECT;
        }
      }
    });
  });
});

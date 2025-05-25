import { KnowledgeGraphManager, Entity } from '../core.js';
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

describe('Tag System', () => {
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
  const getTestProject = () => `tag_test_${testCounter}_${Date.now()}`;

  describe('Entity Creation with Tags', () => {
    test('should create entities with tags', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'JavaScript',
          entityType: 'Language',
          observations: ['Dynamic typing'],
          tags: ['web', 'frontend', 'backend']
        },
        {
          name: 'Python',
          entityType: 'Language',
          observations: ['Readable syntax'],
          tags: ['data-science', 'backend', 'ai']
        }
      ];

      await manager.createEntities(entities, project);
      const graph = await manager.readGraph(project);

      expect(graph.entities).toHaveLength(2);
      expect(graph.entities[0].tags).toEqual(['web', 'frontend', 'backend']);
      expect(graph.entities[1].tags).toEqual(['data-science', 'backend', 'ai']);
    });

    test('should create entities without tags (backward compatibility)', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'Java',
          entityType: 'Language',
          observations: ['Static typing'],
          tags: []
        }
      ];

      await manager.createEntities(entities, project);
      const graph = await manager.readGraph(project);

      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].tags).toEqual([]);
    });
  });

  describe('Tag Management', () => {
    test('should add tags to existing entities', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based'],
          tags: ['frontend', 'javascript']
        },
        {
          name: 'Vue',
          entityType: 'Framework',
          observations: ['Progressive'],
          tags: ['frontend']
        }
      ];
      await manager.createEntities(entities, project);

      const updates = [
        { entityName: 'React', tags: ['popular', 'meta'] },
        { entityName: 'Vue', tags: ['progressive', 'easy'] }
      ];

      const results = await manager.addTags(updates, project);

      expect(results).toHaveLength(2);
      expect(results[0].addedTags).toEqual(['popular', 'meta']);
      expect(results[1].addedTags).toEqual(['progressive', 'easy']);

      const graph = await manager.readGraph(project);
      const reactEntity = graph.entities.find(e => e.name === 'React');
      const vueEntity = graph.entities.find(e => e.name === 'Vue');

      expect(reactEntity?.tags).toEqual(['frontend', 'javascript', 'popular', 'meta']);
      expect(vueEntity?.tags).toEqual(['frontend', 'progressive', 'easy']);
    });

    test('should not add duplicate tags', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based'],
          tags: ['frontend', 'javascript']
        }
      ];
      await manager.createEntities(entities, project);

      const updates = [
        { entityName: 'React', tags: ['frontend', 'new-tag'] } // 'frontend' already exists
      ];

      const results = await manager.addTags(updates, project);

      expect(results[0].addedTags).toEqual(['new-tag']); // Only new tag added

      const graph = await manager.readGraph(project);
      const reactEntity = graph.entities.find(e => e.name === 'React');
      expect(reactEntity?.tags).toEqual(['frontend', 'javascript', 'new-tag']);
    });

    test('should remove tags from entities', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based'],
          tags: ['frontend', 'javascript']
        },
        {
          name: 'Vue',
          entityType: 'Framework',
          observations: ['Progressive'],
          tags: ['frontend']
        }
      ];
      await manager.createEntities(entities, project);

      const updates = [
        { entityName: 'React', tags: ['frontend'] },
        { entityName: 'Vue', tags: ['frontend'] }
      ];

      const results = await manager.removeTags(updates, project);

      expect(results).toHaveLength(2);
      expect(results[0].removedTags).toEqual(['frontend']);
      expect(results[1].removedTags).toEqual(['frontend']);

      const graph = await manager.readGraph(project);
      const reactEntity = graph.entities.find(e => e.name === 'React');
      const vueEntity = graph.entities.find(e => e.name === 'Vue');

      expect(reactEntity?.tags).toEqual(['javascript']);
      expect(vueEntity?.tags).toEqual([]);
    });

    test('should handle removing non-existent tags', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based'],
          tags: ['frontend', 'javascript']
        }
      ];
      await manager.createEntities(entities, project);

      const updates = [
        { entityName: 'React', tags: ['non-existent'] }
      ];

      const results = await manager.removeTags(updates, project);

      expect(results[0].removedTags).toEqual([]); // No tags removed

      const graph = await manager.readGraph(project);
      const reactEntity = graph.entities.find(e => e.name === 'React');
      expect(reactEntity?.tags).toEqual(['frontend', 'javascript']); // Unchanged
    });

    test('should throw error for non-existent entity', async () => {
      const project = getTestProject();
      const updates = [
        { entityName: 'NonExistent', tags: ['test'] }
      ];

      await expect(manager.addTags(updates, project)).rejects.toThrow('Entity with name NonExistent not found');
      await expect(manager.removeTags(updates, project)).rejects.toThrow('Entity with name NonExistent not found');
    });
  });

  describe('Tag Search', () => {
    const setupTestEntities = async (project: string) => {
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based'],
          tags: ['frontend', 'javascript', 'popular']
        },
        {
          name: 'Vue',
          entityType: 'Framework',
          observations: ['Progressive'],
          tags: ['frontend', 'javascript']
        },
        {
          name: 'Django',
          entityType: 'Framework',
          observations: ['Python web framework'],
          tags: ['backend', 'python', 'web']
        },
        {
          name: 'Express',
          entityType: 'Framework',
          observations: ['Node.js framework'],
          tags: ['backend', 'javascript', 'minimal']
        }
      ];
      await manager.createEntities(entities, project);
    };

    test('should search by single tag with "any" mode', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      const results = await manager.searchNodes('', { exactTags: ['frontend'], tagMatchMode: 'any' }, project);

      expect(results.entities).toHaveLength(2);
      const entityNames = results.entities.map(e => e.name);
      expect(entityNames).toContain('React');
      expect(entityNames).toContain('Vue');
    });

    test('should search by multiple tags with "any" mode', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      const results = await manager.searchNodes('', { exactTags: ['frontend', 'python'], tagMatchMode: 'any' }, project);

      expect(results.entities).toHaveLength(3);
      const entityNames = results.entities.map(e => e.name);
      expect(entityNames).toContain('React');
      expect(entityNames).toContain('Vue');
      expect(entityNames).toContain('Django');
    });

    test('should search by multiple tags with "all" mode', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      const results = await manager.searchNodes('', { exactTags: ['frontend', 'javascript'], tagMatchMode: 'all' }, project);

      expect(results.entities).toHaveLength(2);
      const entityNames = results.entities.map(e => e.name);
      expect(entityNames).toContain('React');
      expect(entityNames).toContain('Vue');
    });

    test('should return empty results for non-matching tags', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      const results = await manager.searchNodes('', { exactTags: ['non-existent'], tagMatchMode: 'any' }, project);

      expect(results.entities).toHaveLength(0);
      expect(results.relations).toHaveLength(0);
    });

    test('should be case-sensitive for exact matching', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      const results = await manager.searchNodes('', { exactTags: ['Frontend'], tagMatchMode: 'any' }, project); // Capital F

      expect(results.entities).toHaveLength(0); // Should not match 'frontend'
    });

    test('should include relations between filtered entities', async () => {
      const project = getTestProject();
      await setupTestEntities(project);

      // First add a relation
      await manager.createRelations([
        { from: 'React', to: 'Vue', relationType: 'similar_to' }
      ], project);

      const results = await manager.searchNodes('', { exactTags: ['frontend'], tagMatchMode: 'any' }, project);

      expect(results.entities).toHaveLength(2);
      expect(results.relations).toHaveLength(1);
      expect(results.relations[0].from).toBe('React');
      expect(results.relations[0].to).toBe('Vue');
    });
  });

  describe('Enhanced Search with Tags', () => {
    test('should include tags in general search', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based UI library'],
          tags: ['frontend', 'javascript']
        },
        {
          name: 'Angular',
          entityType: 'Framework',
          observations: ['Full-featured framework'],
          tags: ['frontend', 'typescript']
        }
      ];
      await manager.createEntities(entities, project);

      // Search for 'typescript' should find Angular via tags
      const results = await manager.searchNodes('typescript', project);

      expect(results.entities).toHaveLength(1);
      expect(results.entities[0].name).toBe('Angular');
    });

    test('should search across names, types, observations, and tags', async () => {
      const project = getTestProject();
      const entities: Entity[] = [
        {
          name: 'React',
          entityType: 'Library',
          observations: ['Component-based UI library'],
          tags: ['frontend', 'javascript']
        },
        {
          name: 'Angular',
          entityType: 'Framework',
          observations: ['Full-featured framework'],
          tags: ['frontend', 'typescript']
        }
      ];
      await manager.createEntities(entities, project);

      // Search for 'frontend' should find both entities via tags
      const results = await manager.searchNodes('frontend', project);

      expect(results.entities).toHaveLength(2);
      const entityNames = results.entities.map(e => e.name);
      expect(entityNames).toContain('React');
      expect(entityNames).toContain('Angular');
    });
  });
});

import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';

describe('Input Validation Tests', () => {
  let manager: KnowledgeGraphManager;
  const testProject = `test_validation_${Date.now()}`;

  beforeEach(async () => {
    manager = new KnowledgeGraphManager({
      type: StorageType.SQLITE,
      connectionString: 'sqlite://:memory:',
      fuzzySearch: {
        useDatabaseSearch: false,
        threshold: 0.3,
        clientSideFallback: true
      }
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
  });

  describe('Entity Creation Validation', () => {
    it('should reject empty entities array', async () => {
      await expect(manager.createEntities([], testProject))
        .rejects.toThrow('At least one entity must be provided');
    });

    it('should reject null entities array', async () => {
      await expect(manager.createEntities(null as any, testProject))
        .rejects.toThrow('Entities must be a non-empty array');
    });

    it('should reject undefined entities array', async () => {
      await expect(manager.createEntities(undefined as any, testProject))
        .rejects.toThrow('Entities must be a non-empty array');
    });

    it('should reject entity with empty name', async () => {
      const entities = [{
        name: '',
        entityType: 'test',
        observations: ['test observation']
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity at index 0 must have a non-empty name');
    });

    it('should reject entity with empty entityType', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: '',
        observations: ['test observation']
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity at index 0 must have a non-empty entityType');
    });

    it('should reject entity with non-array observations', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: 'not an array' as any
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity "TestEntity" observations must be an array');
    });

    it('should reject entity with non-string observation', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['valid observation', 123 as any]
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity "TestEntity" observation at index 1 must be a string');
    });

    it('should reject entity with non-array tags', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['test observation'],
        tags: 'not an array' as any
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity "TestEntity" tags must be an array');
    });

    it('should reject entity with non-string tag', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['test observation'],
        tags: ['valid tag', 123 as any]
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('Entity "TestEntity" tag at index 1 must be a string');
    });

    it('should accept valid entity with undefined observations (will be defaulted)', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: undefined as any
      }];

      const result = await manager.createEntities(entities, testProject);
      expect(result).toHaveLength(1);
      expect(result[0].observations).toEqual([]);
    });

    it('should accept valid entity with undefined tags (will be defaulted)', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['test observation'],
        tags: undefined as any
      }];

      const result = await manager.createEntities(entities, testProject);
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual([]);
    });

    it('should accept valid entity with empty observations array (will be defaulted)', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: []
      }];

      const result = await manager.createEntities(entities, testProject);
      expect(result).toHaveLength(1);
      expect(result[0].observations).toEqual([]);
    });
  });

  describe('Observation Updates Validation', () => {
    beforeEach(async () => {
      // Create a test entity first
      await manager.createEntities([{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['initial observation']
      }], testProject);
    });

    it('should reject empty observations array', async () => {
      await expect(manager.addObservations([], testProject))
        .rejects.toThrow('At least one observation update must be provided');
    });

    it('should reject null observations array', async () => {
      await expect(manager.addObservations(null as any, testProject))
        .rejects.toThrow('Observations must be a non-empty array');
    });

    it('should reject observation update with empty entityName', async () => {
      const updates = [{
        entityName: '',
        observations: ['test observation']
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('Observation update at index 0 must have a non-empty entityName');
    });

    it('should reject observation update with empty observations array', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: []
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('Observation update for entity "TestEntity" must contain at least one observation');
    });

    it('should reject observation update with non-array observations', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: 'not an array' as any
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('Observation update for entity "TestEntity" must have a non-empty observations array');
    });

    it('should reject observation update with empty string observation', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: ['valid observation', '']
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('Observation at index 1 for entity "TestEntity" must be a non-empty string');
    });

    it('should reject observation update with non-string observation', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: ['valid observation', 123 as any]
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('Observation at index 1 for entity "TestEntity" must be a non-empty string');
    });

    it('should accept valid observation update', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: ['new observation']
      }];

      const result = await manager.addObservations(updates, testProject);
      expect(result).toHaveLength(1);
      expect(result[0].addedObservations).toEqual(['new observation']);
    });
  });
});

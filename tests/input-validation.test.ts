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
        .rejects.toThrow('ENTITIES ERROR: Empty array provided. REQUIRED: At least 1 entity object');
    });

    it('should reject null entities array', async () => {
      await expect(manager.createEntities(null as any, testProject))
        .rejects.toThrow('ENTITIES ERROR: Must be array of entity objects. REQUIRED: [{name, entityType, observations}]');
    });

    it('should reject undefined entities array', async () => {
      await expect(manager.createEntities(undefined as any, testProject))
        .rejects.toThrow('ENTITIES ERROR: Must be array of entity objects. REQUIRED: [{name, entityType, observations}]');
    });

    it('should reject entity with empty name', async () => {
      const entities = [{
        name: '',
        entityType: 'test',
        observations: ['test observation']
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: Entity #0 missing name. REQUIRED: Non-empty string (e.g., \'John_Smith\', \'Project_Alpha\')');
    });

    it('should reject entity with empty entityType', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: '',
        observations: ['test observation']
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: Entity #0 missing entityType. REQUIRED: Non-empty string (e.g., \'person\', \'project\', \'company\')');
    });

    it('should reject entity with non-array observations', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: 'not an array' as any
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: "TestEntity" observations must be array. REQUIRED: [\'fact1\', \'fact2\']');
    });

    it('should reject entity with non-string observation', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['valid observation', 123 as any]
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: "TestEntity" observation #1 must be string. REQUIRED: Non-empty text fact');
    });

    it('should reject entity with non-array tags', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['test observation'],
        tags: 'not an array' as any
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: "TestEntity" tags must be array. REQUIRED: [\'urgent\', \'completed\'] or []');
    });

    it('should reject entity with non-string tag', async () => {
      const entities = [{
        name: 'TestEntity',
        entityType: 'test',
        observations: ['test observation'],
        tags: ['valid tag', 123 as any]
      }];

      await expect(manager.createEntities(entities, testProject))
        .rejects.toThrow('ENTITY ERROR: "TestEntity" tag #1 must be string. EXAMPLE: \'urgent\', \'completed\', \'technical\'');
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
        .rejects.toThrow('OBSERVATIONS ERROR: Empty array provided. REQUIRED: At least 1 observation update');
    });

    it('should reject null observations array', async () => {
      await expect(manager.addObservations(null as any, testProject))
        .rejects.toThrow('OBSERVATIONS ERROR: Must be array of update objects. REQUIRED: [{entityName, observations}]');
    });

    it('should reject observation update with empty entityName', async () => {
      const updates = [{
        entityName: '',
        observations: ['test observation']
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('OBSERVATION ERROR: Update #0 missing entityName. REQUIRED: Existing entity name (e.g., \'John_Smith\')');
    });

    it('should reject observation update with empty observations array', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: []
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('OBSERVATION ERROR: "TestEntity" needs observations. REQUIRED: At least 1 fact (e.g., [\'Promoted to senior\', \'Moved to NYC\'])');
    });

    it('should reject observation update with non-array observations', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: 'not an array' as any
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('OBSERVATION ERROR: "TestEntity" observations must be array. REQUIRED: [\'fact1\', \'fact2\']');
    });

    it('should reject observation update with empty string observation', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: ['valid observation', '']
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('OBSERVATION ERROR: "TestEntity" observation #1 must be non-empty string. EXAMPLE: \'Works at Google\'');
    });

    it('should reject observation update with non-string observation', async () => {
      const updates = [{
        entityName: 'TestEntity',
        observations: ['valid observation', 123 as any]
      }];

      await expect(manager.addObservations(updates, testProject))
        .rejects.toThrow('OBSERVATION ERROR: "TestEntity" observation #1 must be non-empty string. EXAMPLE: \'Works at Google\'');
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

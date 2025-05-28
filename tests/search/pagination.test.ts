import { KnowledgeGraphManager } from '../../core.js';
import { Entity } from '../../core.js';

describe('Search Pagination', () => {
  let manager: KnowledgeGraphManager;
  const testProject = 'pagination_test';

  beforeEach(async () => {
    manager = new KnowledgeGraphManager();
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('Basic Pagination', () => {
    beforeEach(async () => {
      // Create test entities
      const entities: Entity[] = [];
      for (let i = 1; i <= 25; i++) {
        entities.push({
          name: `Entity_${i.toString().padStart(2, '0')}`,
          entityType: 'test',
          observations: [`This is test entity number ${i}`, `Entity ${i} for pagination testing`],
          tags: ['test', 'pagination']
        });
      }
      await manager.createEntities(entities, testProject);
    });

    test('should return first page with default page size', async () => {
      const result = await manager.searchNodesPaginated(
        'test',
        { page: 0, pageSize: 10 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(10);
      expect(result.pagination.currentPage).toBe(0);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalCount).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    test('should return second page correctly', async () => {
      const result = await manager.searchNodesPaginated(
        'test',
        { page: 1, pageSize: 10 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(10);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    test('should return last page with remaining entities', async () => {
      const result = await manager.searchNodesPaginated(
        'test',
        { page: 2, pageSize: 10 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(5); // 25 total, 20 in first two pages
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    test('should handle different page sizes', async () => {
      const result = await manager.searchNodesPaginated(
        'test',
        { page: 0, pageSize: 5 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(5);
      expect(result.pagination.totalPages).toBe(5); // 25 / 5 = 5 pages
    });

    test('should handle empty results', async () => {
      const result = await manager.searchNodesPaginated(
        'nonexistent',
        { page: 0, pageSize: 10 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    test('should handle page beyond available results', async () => {
      const result = await manager.searchNodesPaginated(
        'test',
        { page: 10, pageSize: 10 },
        undefined,
        testProject
      );

      expect(result.entities).toHaveLength(0);
      expect(result.pagination.currentPage).toBe(10);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });
  });

  describe('Fuzzy Search Pagination', () => {
    beforeEach(async () => {
      const entities: Entity[] = [
        { name: 'React_Component', entityType: 'technology', observations: ['Frontend library'], tags: ['frontend'] },
        { name: 'React_Hook', entityType: 'technology', observations: ['State management'], tags: ['frontend'] },
        { name: 'React_Router', entityType: 'technology', observations: ['Navigation library'], tags: ['frontend'] },
        { name: 'Redux_Store', entityType: 'technology', observations: ['State management'], tags: ['frontend'] },
        { name: 'Angular_Component', entityType: 'technology', observations: ['Frontend framework'], tags: ['frontend'] }
      ];
      await manager.createEntities(entities, testProject);
    });

    test('should paginate fuzzy search results', async () => {
      const result = await manager.searchNodesPaginated(
        'react',
        { page: 0, pageSize: 2 },
        { searchMode: 'fuzzy', fuzzyThreshold: 0.3 },
        testProject
      );

      expect(result.entities.length).toBeLessThanOrEqual(2);
      expect(result.pagination.pageSize).toBe(2);
    });
  });

  describe('Tag Search Pagination', () => {
    beforeEach(async () => {
      const entities: Entity[] = [];
      for (let i = 1; i <= 15; i++) {
        entities.push({
          name: `Frontend_Tool_${i}`,
          entityType: 'technology',
          observations: [`Frontend tool number ${i}`],
          tags: ['frontend', 'tool']
        });
      }
      await manager.createEntities(entities, testProject);
    });

    test('should paginate tag search results', async () => {
      const result = await manager.searchNodesPaginated(
        'tool',
        { page: 0, pageSize: 5 },
        { exactTags: ['frontend'], tagMatchMode: 'any' },
        testProject
      );

      expect(result.entities).toHaveLength(5);
      expect(result.pagination.totalCount).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
    });
  });
});

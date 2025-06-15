import { KnowledgeGraphManager } from '../core.js';
import { Entity } from '../core.js';
import { runTestsForAvailableBackends, createTestProject, getBackendTimeout } from './utils/multi-backend-runner.js';
import { StorageConfig } from '../storage/types.js';

// Test tag search functionality across multiple backends
runTestsForAvailableBackends((config: StorageConfig, backendName: string) => {
  describe('Tag Search Investigation', () => {
    let manager: KnowledgeGraphManager;
    let testProject: string;

    beforeEach(async () => {
      testProject = createTestProject(backendName, 'tag_search_investigation');
      manager = new KnowledgeGraphManager(config);
    }, getBackendTimeout(backendName));

    afterEach(async () => {
      // Clean up test data
      try {
        const existingEntities = await manager.readGraph(testProject);
        if (existingEntities.entities.length > 0) {
          await manager.deleteEntities(existingEntities.entities.map(e => e.name), testProject);
        }
      } catch (error) {
        // Ignore errors if project doesn't exist
      }
      await manager.close();
    }, getBackendTimeout(backendName));

    describe('Tag Search Issue Investigation', () => {
      beforeEach(async () => {
        // Create test entities with various tag combinations
        await manager.createEntities([
          {
            name: 'Entity_With_Tag_A',
            entityType: 'concept',
            observations: ['Has tag A'],
            tags: ['tagA', 'common']
          },
          {
            name: 'Entity_With_Tag_B',
            entityType: 'concept',
            observations: ['Has tag B'],
            tags: ['tagB', 'common']
          },
          {
            name: 'Entity_With_Both_Tags',
            entityType: 'concept',
            observations: ['Has both tags'],
            tags: ['tagA', 'tagB', 'special']
          },
          {
            name: 'Entity_No_Tags',
            entityType: 'concept',
            observations: ['Has no tags'],
            tags: []
          },
          {
            name: 'Entity_Different_Tags',
            entityType: 'concept',
            observations: ['Has different tags'],
            tags: ['other', 'different']
          }
        ], testProject);
      }, getBackendTimeout(backendName));

      it('should find entities with exactTags using empty query', async () => {
        console.log(`\n🔍 Testing tag search with backend: ${backendName}`);

        // Test 1: Search for entities with tagA
        const resultA = await manager.searchNodes('', { exactTags: ['tagA'] }, testProject);
        console.log(`Tag A search results: ${resultA.entities.length} entities found`);
        console.log(`Entity names: ${resultA.entities.map(e => e.name).join(', ')}`);

        expect(resultA.entities.length).toBe(2); // Entity_With_Tag_A and Entity_With_Both_Tags
        expect(resultA.entities.map(e => e.name)).toContain('Entity_With_Tag_A');
        expect(resultA.entities.map(e => e.name)).toContain('Entity_With_Both_Tags');
      }, getBackendTimeout(backendName));

      it('should find entities with exactTags using tagMatchMode any', async () => {
        const result = await manager.searchNodes('', {
          exactTags: ['tagA', 'tagB'],
          tagMatchMode: 'any'
        }, testProject);

        console.log(`Tag A OR B search results: ${result.entities.length} entities found`);
        console.log(`Entity names: ${result.entities.map(e => e.name).join(', ')}`);

        expect(result.entities.length).toBe(3); // All entities with either tagA or tagB
        expect(result.entities.map(e => e.name)).toContain('Entity_With_Tag_A');
        expect(result.entities.map(e => e.name)).toContain('Entity_With_Tag_B');
        expect(result.entities.map(e => e.name)).toContain('Entity_With_Both_Tags');
      }, getBackendTimeout(backendName));

      it('should find entities with exactTags using tagMatchMode all', async () => {
        const result = await manager.searchNodes('', {
          exactTags: ['tagA', 'tagB'],
          tagMatchMode: 'all'
        }, testProject);

        console.log(`Tag A AND B search results: ${result.entities.length} entities found`);
        console.log(`Entity names: ${result.entities.map(e => e.name).join(', ')}`);

        expect(result.entities.length).toBe(1); // Only Entity_With_Both_Tags
        expect(result.entities[0].name).toBe('Entity_With_Both_Tags');
      }, getBackendTimeout(backendName));

      it('should return empty results for non-existent tags', async () => {
        const result = await manager.searchNodes('', { exactTags: ['nonexistent'] }, testProject);

        console.log(`Non-existent tag search results: ${result.entities.length} entities found`);

        expect(result.entities.length).toBe(0);
      }, getBackendTimeout(backendName));

      it('should work with common tags', async () => {
        const result = await manager.searchNodes('', { exactTags: ['common'] }, testProject);

        console.log(`Common tag search results: ${result.entities.length} entities found`);
        console.log(`Entity names: ${result.entities.map(e => e.name).join(', ')}`);

        expect(result.entities.length).toBe(2); // Entity_With_Tag_A and Entity_With_Tag_B
        expect(result.entities.map(e => e.name)).toContain('Entity_With_Tag_A');
        expect(result.entities.map(e => e.name)).toContain('Entity_With_Tag_B');
      }, getBackendTimeout(backendName));

      it('should debug the search flow step by step', async () => {
        console.log('\n🔬 DEBUGGING SEARCH FLOW:');

        // Step 1: Verify entities exist
        const allEntities = await manager.readGraph(testProject);
        console.log(`Total entities in project: ${allEntities.entities.length}`);
        allEntities.entities.forEach(e => {
          console.log(`  - ${e.name}: tags=[${e.tags?.join(', ') || 'none'}]`);
        });

        // Step 2: Test direct tag filtering logic
        const entitiesWithTagA = allEntities.entities.filter(entity => {
          const entityTags = entity.tags || [];
          return entityTags.includes('tagA');
        });
        console.log(`Direct filter for tagA: ${entitiesWithTagA.length} entities`);

        // Step 3: Test the actual search
        const searchResult = await manager.searchNodes('', { exactTags: ['tagA'] }, testProject);
        console.log(`Search result for tagA: ${searchResult.entities.length} entities`);

        // They should match
        expect(searchResult.entities.length).toBe(entitiesWithTagA.length);
      }, getBackendTimeout(backendName));
    });

    describe('Paginated Tag Search', () => {
      beforeEach(async () => {
        // Create more entities for pagination testing
        const entities = [];
        for (let i = 1; i <= 25; i++) {
          entities.push({
            name: `Paginated_Entity_${i}`,
            entityType: 'concept',
            observations: [`Entity number ${i}`],
            tags: i % 2 === 0 ? ['even'] : ['odd']
          });
        }
        await manager.createEntities(entities, testProject);
      }, getBackendTimeout(backendName));

      it('should handle paginated tag search', async () => {
        const result = await manager.searchNodesPaginated(
          '',
          { page: 0, pageSize: 5 },
          { exactTags: ['even'] },
          testProject
        );

        console.log(`\n🔍 PAGINATED TAG SEARCH DEBUG (${backendName}):`);
        console.log(`Paginated even tag search: ${result.entities.length} entities on page 1`);
        console.log(`Total count: ${result.pagination.totalCount}`);
        console.log(`Entity names: ${result.entities.map(e => e.name).join(', ')}`);
        console.log(`Entity tags: ${result.entities.map(e => e.tags?.join(',') || 'none').join(' | ')}`);

        // Verify that all returned entities actually have the 'even' tag
        result.entities.forEach(entity => {
          console.log(`  - ${entity.name}: tags=[${entity.tags?.join(', ') || 'none'}]`);
          expect(entity.tags).toContain('even');
        });

        expect(result.entities.length).toBe(5);
        expect(result.pagination.totalCount).toBe(12); // 12 even numbers from 1-25
        expect(result.pagination.hasNextPage).toBe(true);
      }, getBackendTimeout(backendName));

      it('should verify tag search works with different tag combinations', async () => {
        console.log(`\n🧪 COMPREHENSIVE TAG SEARCH TEST (${backendName}):`);

        // Test 1: Search for 'odd' tags
        const oddResult = await manager.searchNodesPaginated(
          '',
          { page: 0, pageSize: 10 },
          { exactTags: ['odd'] },
          testProject
        );

        console.log(`Odd tag search: ${oddResult.entities.length} entities, total: ${oddResult.pagination.totalCount}`);
        expect(oddResult.pagination.totalCount).toBe(13); // 13 odd numbers from 1-25

        // Test 2: Search for non-existent tag
        const nonExistentResult = await manager.searchNodesPaginated(
          '',
          { page: 0, pageSize: 10 },
          { exactTags: ['nonexistent'] },
          testProject
        );

        console.log(`Non-existent tag search: ${nonExistentResult.entities.length} entities, total: ${nonExistentResult.pagination.totalCount}`);
        expect(nonExistentResult.pagination.totalCount).toBe(0);

        // Test 3: Compare with non-paginated search
        const nonPaginatedEven = await manager.searchNodes('', { exactTags: ['even'] }, testProject);
        console.log(`Non-paginated even search: ${nonPaginatedEven.entities.length} entities`);

        // The counts should match
        expect(oddResult.pagination.totalCount).toBe(13); // Total odd entities should be 13
        expect(nonPaginatedEven.entities.length).toBe(12); // This should match paginated total count
      }, getBackendTimeout(backendName));
    });
  });
});

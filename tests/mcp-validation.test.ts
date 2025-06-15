import { KnowledgeGraphManager } from '../core.js';
import { StorageType } from '../storage/types.js';

/**
 * Test suite for MCP layer validation logic
 * These tests simulate the validation that happens in index.ts for the MCP server
 */
describe('MCP Validation Layer Tests', () => {
  let manager: KnowledgeGraphManager;
  const testProject = 'mcp_validation_test';

  beforeEach(async () => {
    // Use in-memory SQLite to avoid disk I/O issues
    manager = new KnowledgeGraphManager({
      type: StorageType.SQLITE,
      connectionString: 'sqlite://:memory:'
    });

    // Create test entities with tags for validation testing
    const testEntities = [
      {
        name: 'MCP_Test_Entity_1',
        entityType: 'project',
        observations: ['Test entity for MCP validation'],
        tags: ['validation', 'mcp-test']
      },
      {
        name: 'MCP_Test_Entity_2',
        entityType: 'technology',
        observations: ['Another test entity'],
        tags: ['validation', 'testing']
      }
    ];

    await manager.createEntities(testEntities, testProject);
  });

  afterEach(async () => {
    await manager.deleteEntities(['MCP_Test_Entity_1', 'MCP_Test_Entity_2'], testProject);
    await manager.close();
  });

  describe('Query Parameter Validation (Bug Fix)', () => {
    /**
     * Simulates the MCP validation logic from index.ts
     * This replicates the fixed validation behavior
     */
    function simulateMCPValidation(query: any, exactTags: any): { isValid: boolean; error?: string; processedQuery?: string[] } {
      // Check if exactTags is provided for tag-only search
      const hasExactTags = exactTags && Array.isArray(exactTags) && exactTags.length > 0;

      // Handle multiple queries - allow empty/undefined query if exactTags is provided
      let queries: string[];
      if (query === undefined || query === null) {
        if (hasExactTags) {
          queries = [""]; // Use empty string for tag-only search
        } else {
          return { isValid: false, error: "Query parameter is required when exactTags is not provided" };
        }
      } else {
        queries = Array.isArray(query) ? query : [query as string];
      }

      // Validate queries - allow empty strings only when exactTags is provided
      if (queries.length === 0 || queries.some((q: any) => typeof q !== 'string' || (!hasExactTags && q.trim() === ''))) {
        return { isValid: false, error: "Query must be a non-empty string or array of non-empty strings when exactTags is not provided" };
      }

      return { isValid: true, processedQuery: queries };
    }

    describe('Positive Cases - Should Pass Validation', () => {
      it('should allow undefined query with valid exactTags', () => {
        const result = simulateMCPValidation(undefined, ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['']);
      });

      it('should allow null query with valid exactTags', () => {
        const result = simulateMCPValidation(null, ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['']);
      });

      it('should allow empty string query with valid exactTags', () => {
        const result = simulateMCPValidation('', ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['']);
      });

      it('should allow whitespace-only query with valid exactTags', () => {
        const result = simulateMCPValidation('   ', ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['   ']);
      });

      it('should allow array with empty strings when exactTags provided', () => {
        const result = simulateMCPValidation(['', ''], ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['', '']);
      });

      it('should allow normal query with exactTags (backward compatibility)', () => {
        const result = simulateMCPValidation('test', ['validation']);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['test']);
      });

      it('should allow normal query without exactTags', () => {
        const result = simulateMCPValidation('test', undefined);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['test']);
      });

      it('should allow array query without exactTags', () => {
        const result = simulateMCPValidation(['test1', 'test2'], undefined);
        expect(result.isValid).toBe(true);
        expect(result.processedQuery).toEqual(['test1', 'test2']);
      });
    });

    describe('Negative Cases - Should Fail Validation', () => {
      it('should reject undefined query without exactTags', () => {
        const result = simulateMCPValidation(undefined, undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query parameter is required when exactTags is not provided");
      });

      it('should reject null query without exactTags', () => {
        const result = simulateMCPValidation(null, null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query parameter is required when exactTags is not provided");
      });

      it('should reject empty string query without exactTags', () => {
        const result = simulateMCPValidation('', undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query must be a non-empty string or array of non-empty strings when exactTags is not provided");
      });

      it('should reject whitespace-only query without exactTags', () => {
        const result = simulateMCPValidation('   ', undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query must be a non-empty string or array of non-empty strings when exactTags is not provided");
      });

      it('should reject empty array query without exactTags', () => {
        const result = simulateMCPValidation([], undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query must be a non-empty string or array of non-empty strings when exactTags is not provided");
      });

      it('should reject array with empty strings without exactTags', () => {
        const result = simulateMCPValidation(['', 'test'], undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query must be a non-empty string or array of non-empty strings when exactTags is not provided");
      });

      it('should reject non-string query elements', () => {
        const result = simulateMCPValidation([123, 'test'], ['validation']);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query must be a non-empty string or array of non-empty strings when exactTags is not provided");
      });

      it('should reject undefined query with empty exactTags array', () => {
        const result = simulateMCPValidation(undefined, []);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query parameter is required when exactTags is not provided");
      });

      it('should reject undefined query with null exactTags', () => {
        const result = simulateMCPValidation(undefined, null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Query parameter is required when exactTags is not provided");
      });
    });
  });

  describe('Integration Tests - Actual Core Behavior', () => {
    it('should work with the actual core when validation passes', async () => {
      // Test the actual core behavior with the scenarios that should pass validation
      const result = await manager.searchNodes('', { exactTags: ['validation'] }, testProject);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.name)).toContain('MCP_Test_Entity_1');
      expect(result.entities.map(e => e.name)).toContain('MCP_Test_Entity_2');
    });

    it('should handle null query with exactTags in core', async () => {
      const result = await manager.searchNodes(null as any, { exactTags: ['validation'] }, testProject);

      expect(result.entities).toHaveLength(2);
    });

    it('should handle undefined query with exactTags in core', async () => {
      const result = await manager.searchNodes(undefined as any, { exactTags: ['validation'] }, testProject);

      expect(result.entities).toHaveLength(2);
    });
  });
});

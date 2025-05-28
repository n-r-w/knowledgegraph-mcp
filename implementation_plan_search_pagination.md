# Implementation Plan: Search Pagination for search_knowledge Tool

## Overview
Add pagination functionality to the `search_knowledge` tool to allow LLMs to explore large result sets incrementally. This builds upon the existing search limits implementation but adds the ability to navigate through pages of results.

## Current State Analysis
✅ **EXISTING FUNCTIONALITY**:
- Search limits implemented (`KNOWLEDGEGRAPH_SEARCH_MAX_RESULTS`, `KNOWLEDGEGRAPH_SEARCH_MAX_CLIENT_ENTITIES`)
- Client-side chunking for performance (`KNOWLEDGEGRAPH_SEARCH_CLIENT_CHUNK_SIZE`)
- Multiple query support with deduplication
- Exact and fuzzy search modes
- Tag-based filtering

❌ **MISSING FUNCTIONALITY**:
- No pagination parameters in search_knowledge tool
- No page-based result navigation
- No "pages remaining" information in responses
- No offset/limit handling for paginated results

## User Requirements
1. **First Search**: `search_knowledge(query="something")` returns 100 items + "3 pages remain" message
2. **Next Page**: `search_knowledge(query="something", page=1)` returns next 100 items + "2 pages remain"
3. **Subsequent Pages**: Continue with `page=2`, `page=3`, etc.
4. **LLM Workflow**: LLM can understand pagination messages and make follow-up calls

## Technical Design

### 1. New Parameters for search_knowledge Tool
```typescript
// Add to search_knowledge inputSchema
page: {
  type: "number",
  minimum: 0,
  description: "Page number for pagination (0-based). Use 0 or omit for first page."
},
pageSize: {
  type: "number",
  minimum: 1,
  maximum: 1000,
  description: "Number of results per page (default: 100, max: 1000)"
}
```

### 2. Pagination Logic Implementation
- **Default Behavior**: When `page` is not provided, return first page (page 0)
- **Page Size**: Default to 100 results per page, configurable via `pageSize` parameter
- **Total Count**: Calculate total available results before pagination
- **Remaining Pages**: Calculate and include in response message

### 3. Response Format Enhancement
```
🔍 SEARCH RESULTS: Found 350 total entities, showing page 1 of 4 (100 results)
📄 PAGINATION: 3 pages remain. Use search_knowledge(query="same_query", page=2) for next page
```

### 4. Implementation Strategy
**OPTION A: Database-Level Pagination (RECOMMENDED)**
- ✅ **SQLite Support**: Full OFFSET/LIMIT support (standard SQL)
- ✅ **PostgreSQL Support**: Excellent OFFSET/LIMIT with advanced features
- ✅ **Performance**: Much more efficient for large datasets
- ✅ **Memory**: Only loads requested page, not full result set
- ✅ **Scalability**: Works with millions of entities
- **Implementation**: Add OFFSET/LIMIT to existing database queries

**OPTION B: Post-Search Pagination (Fallback)**
- Use for client-side fuzzy search when database search unavailable
- Apply pagination to final result set after full search
- Less efficient but works with all search modes
- Fallback for complex search scenarios

### 5. Database-Level Pagination Implementation

#### SQLite Pagination Pattern
```sql
-- Current: getAllEntities with LIMIT
SELECT name, entity_type, observations, tags
FROM entities
WHERE project = ?
ORDER BY updated_at DESC, name
LIMIT ?

-- Enhanced: Add OFFSET for pagination
SELECT name, entity_type, observations, tags
FROM entities
WHERE project = ?
ORDER BY updated_at DESC, name
LIMIT ? OFFSET ?

-- Count query for total pages
SELECT COUNT(*) as total_count
FROM entities
WHERE project = ?
```

#### PostgreSQL Pagination Pattern
```sql
-- Current: searchDatabase with LIMIT
SELECT e.*, GREATEST(...) as relevance_score
FROM entities e
WHERE e.project = $3 AND (similarity conditions)
ORDER BY relevance_score DESC
LIMIT $4

-- Enhanced: Add OFFSET for pagination
SELECT e.*, GREATEST(...) as relevance_score
FROM entities e
WHERE e.project = $3 AND (similarity conditions)
ORDER BY relevance_score DESC
LIMIT $4 OFFSET $5

-- Count query for total pages
SELECT COUNT(*) as total_count
FROM entities e
WHERE e.project = $1 AND (similarity conditions)
```

#### Pagination Interface
```typescript
interface PaginationOptions {
  page?: number;        // 0-based page number
  pageSize?: number;    // Results per page (default: 100)
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

## Implementation Steps

### Phase 1: Tool Interface Updates ⏳
- [ ] **Step 1.1**: Add pagination parameters to search_knowledge tool schema
- [ ] **Step 1.2**: Update tool description with pagination examples
- [ ] **Step 1.3**: Add parameter validation for page and pageSize

### Phase 2: Database Strategy Updates ⏳
- [ ] **Step 2.1**: Add pagination support to SQLite search strategy
  - [ ] Update `searchExact()` methods with OFFSET/LIMIT
  - [ ] Add count queries for total result calculation
  - [ ] Update `getAllEntities()` for paginated loading
- [ ] **Step 2.2**: Add pagination support to PostgreSQL search strategy
  - [ ] Update `searchDatabase()` methods with OFFSET/LIMIT
  - [ ] Add count queries for fuzzy search results
  - [ ] Update `getAllEntities()` for paginated loading
- [ ] **Step 2.3**: Update search interfaces and types
  - [ ] Add `PaginationOptions` and `PaginationResult` interfaces
  - [ ] Update `SearchStrategy` interface for pagination support

### Phase 3: Core Search Manager Updates ⏳
- [ ] **Step 3.1**: Update SearchManager to handle pagination
- [ ] **Step 3.2**: Add pagination logic to KnowledgeGraphManager.searchNodes()
- [ ] **Step 3.3**: Implement fallback pagination for client-side search

### Phase 4: Response Format Enhancement ⏳
- [ ] **Step 4.1**: Update search_knowledge handler to support pagination
- [ ] **Step 4.2**: Add pagination metadata to responses
- [ ] **Step 4.3**: Handle edge cases (last page, no results, invalid page)

### Phase 5: Testing ⏳
- [ ] **Step 5.1**: Create unit tests for database pagination logic
- [ ] **Step 5.2**: Test SQLite OFFSET/LIMIT pagination
- [ ] **Step 5.3**: Test PostgreSQL OFFSET/LIMIT pagination
- [ ] **Step 5.4**: Test with different search modes (exact, fuzzy, tags)
- [ ] **Step 5.5**: Test edge cases and error conditions
- [ ] **Step 5.6**: Integration tests with multiple queries and pagination

### Phase 6: Documentation ⏳
- [ ] **Step 6.1**: Update README.md with pagination examples
- [ ] **Step 6.2**: Add pagination to system prompts
- [ ] **Step 6.3**: Document performance considerations and database-level benefits

## Success Criteria
- [ ] LLM can navigate through paginated search results
- [ ] Clear pagination information in responses
- [ ] Consistent behavior across all search modes
- [ ] Performance remains acceptable for large result sets
- [ ] Backward compatibility maintained (no page param = first page)
- [ ] All existing tests continue to pass
- [ ] New pagination tests pass

## Technical Considerations

### Performance Impact
- **Memory**: Database-level pagination dramatically reduces memory usage
- **Computation**: Much more efficient - only processes requested page
- **Database Load**: Minimal - OFFSET/LIMIT are highly optimized in both SQLite and PostgreSQL
- **Scalability**: Can handle millions of entities efficiently
- **Network**: Reduces data transfer between database and application

### Edge Cases
- **Invalid Page**: Handle page numbers beyond available results
- **Empty Results**: Handle searches with no results gracefully
- **Page Size Limits**: Enforce reasonable page size limits (max 1000)
- **Multiple Queries**: Database-level pagination with query deduplication
- **Count Accuracy**: Ensure count queries match search queries exactly

### LLM Integration
- **Clear Messages**: Pagination info must be easily parseable by LLMs
- **Consistent Format**: Use consistent pagination message format
- **Error Handling**: Clear error messages for invalid pagination parameters

## Environment Variables (Optional)
```bash
# Optional: Default page size for search results
KNOWLEDGEGRAPH_SEARCH_DEFAULT_PAGE_SIZE=100

# Optional: Maximum page size allowed
KNOWLEDGEGRAPH_SEARCH_MAX_PAGE_SIZE=1000
```

## Files to Modify
1. **index.ts**: Update search_knowledge tool schema and handler
2. **core.ts**: Add pagination logic to searchNodes method
3. **search/types.ts**: Add pagination interfaces
4. **tests/**: Create pagination test files
5. **README.md**: Add pagination documentation

## Risk Mitigation
- **Backward Compatibility**: Ensure existing search calls work unchanged
- **Performance**: Monitor impact on search performance
- **Memory Usage**: Ensure pagination actually reduces memory usage
- **LLM Confusion**: Clear, consistent pagination messages

## Estimated Timeline
- **Phase 1**: 1 day (tool interface)
- **Phase 2**: 3-4 days (database strategy updates)
- **Phase 3**: 2 days (search manager updates)
- **Phase 4**: 1 day (response format)
- **Phase 5**: 3 days (comprehensive testing)
- **Phase 6**: 1 day (documentation)
- **Total**: 11-13 days

**Benefits of Database-Level Approach**:
- More implementation time but significantly better performance
- Scales to millions of entities without memory issues
- Leverages database optimization (indexes, query planning)
- Future-proof architecture for large deployments

## Dependencies
- Existing search infrastructure (✅ completed)
- Search limits implementation (✅ completed)
- Multiple query support (✅ completed)

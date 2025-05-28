# Implementation Plan: KG_SEARCH Environment Variables Fix

## Overview
Fix the unused KG_SEARCH environment variables (`KG_SEARCH_MAX_CLIENT_ENTITIES` and `KG_SEARCH_CLIENT_CHUNK_SIZE`) to ensure they are properly implemented and enforced in both SQLite and PostgreSQL backends.

## Current Issues
1. **`KG_SEARCH_MAX_CLIENT_ENTITIES`**: Defined but not enforced when loading entities for client-side search
2. **`KG_SEARCH_CLIENT_CHUNK_SIZE`**: Defined but not used for chunking large dataset processing
3. **Missing Performance Safeguards**: No limits on entity loading could cause memory issues with large datasets
4. **Inconsistent Documentation**: Documentation promises functionality that isn't implemented

## Prerequisites
- [ ] Understanding of current search architecture
- [ ] Knowledge of both SQLite and PostgreSQL search strategies
- [ ] Familiarity with client-side search using Fuse.js

## Implementation Steps

### Phase 1: Entity Loading Limits
- [ ] **Step 1.1**: Modify `SQLiteFuzzyStrategy.getAllEntities()` to respect `maxClientSideEntities` limit
  - Add `LIMIT` clause to SQL query using `this.searchLimits.maxClientSideEntities`
  - Add warning log when limit is reached
  - Update method documentation

- [ ] **Step 1.2**: Create `PostgreSQLFuzzyStrategy.getAllEntities()` method (currently missing)
  - Implement entity loading with `maxClientSideEntities` limit
  - Use PostgreSQL `LIMIT` clause
  - Add warning log when limit is reached
  - Follow same pattern as SQLite implementation

- [ ] **Step 1.3**: Update search manager to use entity loading limits
  - Modify `SearchManager` to call `getAllEntities()` with limits when needed
  - Add fallback behavior when entity count exceeds limits
  - Document performance implications

### Phase 2: Client-Side Chunking
- [ ] **Step 2.1**: Implement chunked client-side search in base strategy
  - Add `searchClientSideChunked()` method to `BaseSearchStrategy`
  - Process entities in chunks of `clientSideChunkSize`
  - Merge and deduplicate results from all chunks
  - Maintain result ordering and relevance scores

- [ ] **Step 2.2**: Update PostgreSQL strategy to use chunking
  - Modify `searchSingleClientSide()` to use chunking for large entity sets
  - Add threshold check: if entities.length > `maxClientSideEntities`, use chunking
  - Optimize Fuse.js performance for chunked processing

- [ ] **Step 2.3**: Update SQLite strategy to use chunking
  - Modify `searchSingleClientSide()` to use chunking for large entity sets
  - Add same threshold check as PostgreSQL
  - Ensure consistent behavior between backends

### Phase 3: Performance Monitoring
- [ ] **Step 3.1**: Add performance logging
  - Log when limits are applied
  - Track search performance metrics
  - Add warnings for potential performance issues

- [ ] **Step 3.2**: Add configuration validation
  - Validate that `maxClientSideEntities` >= `clientSideChunkSize`
  - Add warnings for suboptimal configurations
  - Document recommended values for different use cases

### Phase 4: Testing
- [ ] **Step 4.1**: Create unit tests for entity loading limits
  - Test SQLite `getAllEntities()` with various limits
  - Test PostgreSQL `getAllEntities()` with various limits
  - Verify warning logs are generated

- [ ] **Step 4.2**: Create unit tests for chunked search
  - Test chunked client-side search with various chunk sizes
  - Verify result consistency between chunked and non-chunked search
  - Test edge cases (empty chunks, single chunk, etc.)

- [ ] **Step 4.3**: Create integration tests
  - Test end-to-end search with large datasets
  - Verify performance improvements with chunking
  - Test both SQLite and PostgreSQL backends

- [ ] **Step 4.4**: Update performance tests
  - Add tests for large dataset scenarios
  - Benchmark chunked vs non-chunked performance
  - Verify memory usage improvements

### Phase 5: Documentation Updates
- [ ] **Step 5.1**: Update README.md
  - Add performance considerations section
  - Document recommended values for different dataset sizes
  - Add troubleshooting guide for performance issues

- [ ] **Step 5.2**: Update code documentation
  - Add JSDoc comments for new methods
  - Document performance implications
  - Add usage examples

## Success Criteria
- All four KG_SEARCH environment variables are actively used and enforced
- Entity loading respects `maxClientSideEntities` limit in both backends
- Client-side search uses chunking when `clientSideChunkSize` is configured
- Performance is improved for large datasets
- Memory usage is controlled and predictable
- All tests pass including new performance tests
- Documentation accurately reflects implemented functionality

## Dependencies
- **search/config.ts**: Already provides validated limits
- **search/strategies/**: Both PostgreSQL and SQLite strategies need updates
- **search/search-manager.ts**: May need updates for entity loading
- **tests/**: New test files for performance and chunking scenarios

## Risk Mitigation
- **Backward Compatibility**: Ensure existing behavior is preserved when limits are not set
- **Performance Regression**: Benchmark before/after to ensure improvements
- **Memory Usage**: Monitor memory consumption during testing
- **Configuration Errors**: Provide clear error messages for invalid configurations

## Estimated Timeline
- **Phase 1**: 2-3 days (entity loading limits)
- **Phase 2**: 3-4 days (chunking implementation)
- **Phase 3**: 1-2 days (monitoring and validation)
- **Phase 4**: 3-4 days (comprehensive testing)
- **Phase 5**: 1-2 days (documentation)
- **Total**: 10-15 days

## Files to Modify
1. `search/strategies/sqlite-strategy.ts` - Add entity loading limits
2. `search/strategies/postgresql-strategy.ts` - Add getAllEntities() and limits
3. `search/strategies/base-strategy.ts` - Add chunked search methods
4. `search/search-manager.ts` - Update to use entity loading limits
5. `tests/search/` - Add new test files for limits and chunking
6. `tests/performance/` - Update performance tests
7. `README.md` - Update documentation
8. `.env.example` - Add performance guidance comments

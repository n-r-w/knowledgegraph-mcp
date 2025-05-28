import { Entity } from '../core.js';
import { SearchStrategy, SearchConfig, SearchOptions, PaginationOptions, PaginationResult } from './types.js';

/**
 * Main search orchestrator that manages different search strategies
 */
export class SearchManager {
  private strategy: SearchStrategy;

  constructor(
    private config: SearchConfig,
    strategy: SearchStrategy
  ) {
    this.strategy = strategy;
  }

  async search(
    query: string | string[],
    entities: Entity[],
    options?: SearchOptions,
    project?: string
  ): Promise<Entity[]> {
    // Handle multiple queries
    if (Array.isArray(query)) {
      return this.searchMultiple(query, entities, options, project);
    }

    // Single query - use existing logic
    return this.searchSingle(query, entities, options, project);
  }

  async searchMultiple(
    queries: string[],
    entities: Entity[],
    options?: SearchOptions,
    project?: string
  ): Promise<Entity[]> {
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    // Process each query and merge results with deduplication
    for (const query of queries) {
      const results = await this.searchSingle(query, entities, options, project);

      // Add only new entities (deduplication)
      const newEntities = results.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);

      // Update the set of existing entity names
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }

  private async searchSingle(
    query: string,
    entities: Entity[],
    options?: SearchOptions,
    project?: string
  ): Promise<Entity[]> {
    // Handle exact search mode
    if (options?.searchMode === 'exact') {
      return this.exactSearch(query, entities);
    }

    // Handle fuzzy search mode
    const threshold = options?.fuzzyThreshold || this.config.threshold;

    try {
      // Try database search first if available
      if (this.strategy.canUseDatabase()) {
        return await this.strategy.searchDatabase(query, threshold, project);
      }
    } catch (error) {
      console.warn('Database search failed, falling back to client-side:', error);

      // Fall back to client-side if database search fails
      if (this.config.clientSideFallback) {
        return this.strategy.searchClientSide(entities, query);
      }

      throw error;
    }

    // Use client-side search
    return this.strategy.searchClientSide(entities, query);
  }

  private exactSearch(query: string, entities: Entity[]): Entity[] {
    const lowerQuery = query.toLowerCase();

    return entities.filter(e => {
      const entityTags = e.tags || [];
      return (
        e.name.toLowerCase().includes(lowerQuery) ||
        e.entityType.toLowerCase().includes(lowerQuery) ||
        e.observations.some(o => o.toLowerCase().includes(lowerQuery)) ||
        entityTags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Paginated search with database-level pagination when possible
   */
  async searchPaginated(
    query: string | string[],
    pagination: PaginationOptions,
    options?: SearchOptions,
    project?: string
  ): Promise<PaginationResult<Entity>> {
    // Handle multiple queries
    if (Array.isArray(query)) {
      return this.searchMultiplePaginated(query, pagination, options, project);
    }

    // Single query
    return this.searchSinglePaginated(query, pagination, options, project);
  }

  private async searchSinglePaginated(
    query: string,
    pagination: PaginationOptions,
    options?: SearchOptions,
    project?: string
  ): Promise<PaginationResult<Entity>> {
    // Handle exact search mode with database-level pagination
    if (options?.searchMode === 'exact') {
      // Try database-level exact search pagination if available
      if (this.strategy.searchExactPaginated) {
        try {
          return await this.strategy.searchExactPaginated(query, pagination, project);
        } catch (error) {
          console.warn('Database exact search pagination failed, falling back to client-side:', error);
        }
      }

      // Fallback to client-side exact search with post-search pagination
      return this.exactSearchPaginated(query, pagination, project);
    }

    // Handle fuzzy search mode with database-level pagination
    const threshold = options?.fuzzyThreshold || this.config.threshold;

    try {
      // Try database search pagination first if available
      if (this.strategy.canUseDatabase() && this.strategy.searchDatabasePaginated) {
        return await this.strategy.searchDatabasePaginated(query, threshold, pagination, project);
      }
    } catch (error) {
      console.warn('Database search pagination failed, falling back to client-side:', error);
    }

    // Fallback to client-side search with post-search pagination
    return this.clientSideSearchPaginated(query, pagination, options, project);
  }

  private async searchMultiplePaginated(
    queries: string[],
    pagination: PaginationOptions,
    options?: SearchOptions,
    project?: string
  ): Promise<PaginationResult<Entity>> {
    // For multiple queries, we need to aggregate results and then paginate
    // This is complex with database-level pagination, so we'll use post-search pagination

    // Get all results first (without pagination)
    const allResults = await this.searchMultiple(queries, [], options, project);

    // Apply post-search pagination
    return this.applyPostSearchPagination(allResults, pagination);
  }

  /**
   * Client-side search with post-search pagination
   */
  private async clientSideSearchPaginated(
    query: string,
    pagination: PaginationOptions,
    options?: SearchOptions,
    project?: string
  ): Promise<PaginationResult<Entity>> {
    // Load all entities first
    const entities = await this.strategy.getAllEntities(project);

    // Perform client-side search
    const searchResults = await this.searchSingle(query, entities, options, project);

    // Apply post-search pagination
    return this.applyPostSearchPagination(searchResults, pagination);
  }

  /**
   * Exact search with database-level pagination fallback
   */
  private async exactSearchPaginated(
    query: string,
    pagination: PaginationOptions,
    project?: string
  ): Promise<PaginationResult<Entity>> {
    // Try database-level pagination for getAllEntities if available
    if (this.strategy.getAllEntitiesPaginated) {
      try {
        const paginatedEntities = await this.strategy.getAllEntitiesPaginated(pagination, project);

        // Apply exact search to the paginated entities
        const searchResults = this.exactSearch(query, paginatedEntities.data);

        // Note: This approach may not give accurate total counts for exact search
        // but it's a reasonable fallback for memory efficiency
        return {
          data: searchResults,
          pagination: paginatedEntities.pagination
        };
      } catch (error) {
        console.warn('Database getAllEntities pagination failed, falling back to full load:', error);
      }
    }

    // Fallback to loading all entities and post-search pagination
    const entities = await this.strategy.getAllEntities(project);
    const searchResults = this.exactSearch(query, entities);
    return this.applyPostSearchPagination(searchResults, pagination);
  }

  /**
   * Apply pagination to search results (post-search pagination)
   */
  private applyPostSearchPagination(
    results: Entity[],
    pagination: PaginationOptions
  ): PaginationResult<Entity> {
    const page = pagination.page || 0;
    const pageSize = pagination.pageSize || 100;
    const offset = page * pageSize;

    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const paginatedData = results.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: totalPages,
        hasNextPage: page < totalPages - 1,
        hasPreviousPage: page > 0
      }
    };
  }
}

import { Entity } from '../core.js';
import { SearchStrategy, SearchConfig, SearchOptions } from './types.js';

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
}

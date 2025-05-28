import { Entity } from '../../core.js';
import { SearchStrategy, SearchConfig } from '../types.js';

/**
 * Base class for search strategies with common functionality
 */
export abstract class BaseSearchStrategy implements SearchStrategy {
  constructor(protected config: SearchConfig) { }

  abstract canUseDatabase(): boolean;
  abstract searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]>;
  abstract searchClientSide(entities: Entity[], query: string | string[]): Entity[];
  abstract getAllEntities(project?: string): Promise<Entity[]>;

  /**
   * Exact search implementation for backward compatibility
   */
  protected exactSearch(query: string, entities: Entity[]): Entity[] {
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
   * Filter entities by exact tags
   */
  protected filterByExactTags(entities: Entity[], exactTags: string[], tagMatchMode: 'any' | 'all' = 'any'): Entity[] {
    return entities.filter(entity => {
      const entityTags = entity.tags || [];

      if (tagMatchMode === 'all') {
        return exactTags.every(tag => entityTags.includes(tag));
      } else {
        return exactTags.some(tag => entityTags.includes(tag));
      }
    });
  }

  /**
   * Helper method to handle multiple queries with deduplication
   */
  protected async searchMultipleDatabase(queries: string[], threshold: number, project?: string): Promise<Entity[]> {
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    for (const query of queries) {
      const results = await this.searchDatabase(query, threshold, project);

      // Add only new entities (deduplication)
      const newEntities = results.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);

      // Update the set of existing entity names
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }

  /**
   * Helper method to handle multiple queries for client-side search with deduplication
   */
  protected searchMultipleClientSide(entities: Entity[], queries: string[]): Entity[] {
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    for (const query of queries) {
      const results = this.searchClientSide(entities, query);

      // Add only new entities (deduplication)
      const newEntities = results.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);

      // Update the set of existing entity names
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }

  /**
   * Chunked client-side search for large entity sets
   * Processes entities in chunks to improve performance and memory usage
   */
  protected searchClientSideChunked(entities: Entity[], query: string | string[], chunkSize: number): Entity[] {
    // Handle multiple queries
    if (Array.isArray(query)) {
      return this.searchMultipleClientSideChunked(entities, query, chunkSize);
    }

    // Single query chunked processing
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    // Process entities in chunks
    for (let i = 0; i < entities.length; i += chunkSize) {
      const chunk = entities.slice(i, i + chunkSize);
      const chunkResults = this.searchClientSide(chunk, query);

      // Add only new entities (deduplication)
      const newEntities = chunkResults.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);

      // Update the set of existing entity names
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }

  /**
   * Chunked client-side search for multiple queries
   */
  protected searchMultipleClientSideChunked(entities: Entity[], queries: string[], chunkSize: number): Entity[] {
    let allResults: Entity[] = [];
    const existingEntityNames = new Set<string>();

    for (const query of queries) {
      const queryResults = this.searchClientSideChunked(entities, query, chunkSize);

      // Add only new entities (deduplication)
      const newEntities = queryResults.filter(e => !existingEntityNames.has(e.name));
      allResults.push(...newEntities);

      // Update the set of existing entity names
      newEntities.forEach(e => existingEntityNames.add(e.name));
    }

    return allResults;
  }
}

import { Entity } from '../../core.js';
import { SearchStrategy, SearchConfig } from '../types.js';

/**
 * Base class for search strategies with common functionality
 */
export abstract class BaseSearchStrategy implements SearchStrategy {
  constructor(protected config: SearchConfig) { }

  abstract canUseDatabase(): boolean;
  abstract searchDatabase(query: string, threshold: number, project?: string): Promise<Entity[]>;
  abstract searchClientSide(entities: Entity[], query: string): Entity[];

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
}

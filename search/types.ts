import { Entity } from '../core.js';

export interface SearchStrategy {
  canUseDatabase(): boolean;
  searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]>;
  searchClientSide(entities: Entity[], query: string | string[]): Entity[];
  getAllEntities(project?: string): Promise<Entity[]>;
}

export interface SearchConfig {
  useDatabaseSearch: boolean;
  threshold: number;
  clientSideFallback: boolean;
  fuseOptions?: {
    threshold: number;
    distance: number;
    includeScore: boolean;
    keys: string[];
  };
}

export interface SearchOptions {
  searchMode?: 'exact' | 'fuzzy';
  fuzzyThreshold?: number;
  exactTags?: string[];
  tagMatchMode?: 'any' | 'all';
}

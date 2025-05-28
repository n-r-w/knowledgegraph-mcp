import { Entity } from '../core.js';

export interface SearchStrategy {
  canUseDatabase(): boolean;
  searchDatabase(query: string | string[], threshold: number, project?: string): Promise<Entity[]>;
  searchClientSide(entities: Entity[], query: string | string[]): Entity[];
  getAllEntities(project?: string): Promise<Entity[]>;

  // Pagination-aware methods
  searchDatabasePaginated?(query: string | string[], threshold: number, pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>>;
  searchExactPaginated?(query: string | string[], pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>>;
  getAllEntitiesPaginated?(pagination: PaginationOptions, project?: string): Promise<PaginationResult<Entity>>;
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
  pagination?: PaginationOptions;
}

export interface PaginationOptions {
  page?: number;        // 0-based page number
  pageSize?: number;    // Results per page (default: 100)
}

export interface PaginationResult<T> {
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

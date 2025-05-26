/**
 * Search configuration with environment variable support
 */

export interface SearchLimits {
  /** Maximum number of results to return from database searches */
  maxResults: number;
  /** Batch size for processing large query arrays */
  batchSize: number;
  /** Maximum number of entities to load for client-side search */
  maxClientSideEntities: number;
  /** Chunk size for processing large datasets in client-side search */
  clientSideChunkSize: number;
}

/**
 * Get search limits from environment variables with sensible defaults
 */
export function getSearchLimits(): SearchLimits {
  return {
    maxResults: parseInt(process.env.KG_SEARCH_MAX_RESULTS || '100', 10),
    batchSize: parseInt(process.env.KG_SEARCH_BATCH_SIZE || '10', 10),
    maxClientSideEntities: parseInt(process.env.KG_SEARCH_MAX_CLIENT_ENTITIES || '10000', 10),
    clientSideChunkSize: parseInt(process.env.KG_SEARCH_CLIENT_CHUNK_SIZE || '1000', 10)
  };
}

/**
 * Validate search limits to ensure they are within reasonable bounds
 */
export function validateSearchLimits(limits: SearchLimits): SearchLimits {
  return {
    maxResults: Math.max(1, Math.min(limits.maxResults, 1000)),
    batchSize: Math.max(1, Math.min(limits.batchSize, 50)),
    maxClientSideEntities: Math.max(100, Math.min(limits.maxClientSideEntities, 100000)),
    clientSideChunkSize: Math.max(100, Math.min(limits.clientSideChunkSize, 10000))
  };
}

/**
 * Get validated search limits
 */
export function getValidatedSearchLimits(): SearchLimits {
  return validateSearchLimits(getSearchLimits());
}

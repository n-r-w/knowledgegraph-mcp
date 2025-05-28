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
    maxResults: parseInt(process.env.KNOWLEDGEGRAPH_SEARCH_MAX_RESULTS || '100', 10),
    batchSize: parseInt(process.env.KNOWLEDGEGRAPH_SEARCH_BATCH_SIZE || '10', 10),
    maxClientSideEntities: parseInt(process.env.KNOWLEDGEGRAPH_SEARCH_MAX_CLIENT_ENTITIES || '10000', 10),
    clientSideChunkSize: parseInt(process.env.KNOWLEDGEGRAPH_SEARCH_CLIENT_CHUNK_SIZE || '1000', 10)
  };
}

/**
 * Validate search limits to ensure they are within reasonable bounds
 */
export function validateSearchLimits(limits: SearchLimits): SearchLimits {
  const validated = {
    maxResults: Math.max(1, Math.min(limits.maxResults, 1000)),
    batchSize: Math.max(1, Math.min(limits.batchSize, 50)),
    maxClientSideEntities: Math.max(100, Math.min(limits.maxClientSideEntities, 100000)),
    clientSideChunkSize: Math.max(100, Math.min(limits.clientSideChunkSize, 10000))
  };

  // Ensure maxClientSideEntities is at least as large as clientSideChunkSize
  if (validated.maxClientSideEntities < validated.clientSideChunkSize) {
    console.warn(`Search config warning: maxClientSideEntities (${validated.maxClientSideEntities}) is smaller than clientSideChunkSize (${validated.clientSideChunkSize}). Adjusting maxClientSideEntities to match.`);
    validated.maxClientSideEntities = validated.clientSideChunkSize;
  }

  // Log performance recommendations
  if (validated.maxClientSideEntities > 50000) {
    console.warn(`Search config warning: maxClientSideEntities (${validated.maxClientSideEntities}) is very high. Consider using database-level search for better performance.`);
  }

  if (validated.clientSideChunkSize > 5000) {
    console.warn(`Search config warning: clientSideChunkSize (${validated.clientSideChunkSize}) is very high. Consider smaller chunks for better memory usage.`);
  }

  return validated;
}

/**
 * Get validated search limits
 */
export function getValidatedSearchLimits(): SearchLimits {
  return validateSearchLimits(getSearchLimits());
}

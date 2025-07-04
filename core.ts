import { StorageProvider, StorageConfig, StorageType } from './storage/types.js';
import { StorageFactory } from './storage/factory.js';
import { SQLStorageProvider } from './storage/providers/sql-storage.js';
import { SQLiteStorageProvider } from './storage/providers/sqlite-storage.js';
import { resolveProject } from './utils.js';
import { SearchManager } from './search/search-manager.js';
import { SearchConfig, SearchOptions, PaginationOptions, PaginationResult } from './search/types.js';
import { PostgreSQLFuzzyStrategy } from './search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from './search/strategies/sqlite-strategy.js';

// We are storing our knowledge using entities, relations, and observations in a graph structure
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  tags?: string[];  // NEW: Array of exact-match tags (optional for input, required internally)
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export interface PaginatedKnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
export class KnowledgeGraphManager {
  private storage: StorageProvider;
  private searchManager: SearchManager | null = null;
  private config: StorageConfig;

  constructor(storageConfig?: StorageConfig) {
    this.config = storageConfig || this.getStorageConfigFromEnv();
    this.storage = StorageFactory.create(this.config);

    // Initialize storage asynchronously
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await this.storage.initialize();
      this.initializeSearchManager();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  private initializeSearchManager(): void {
    const searchConfig: SearchConfig = {
      useDatabaseSearch: this.config.fuzzySearch?.useDatabaseSearch ?? false,
      threshold: this.config.fuzzySearch?.threshold ?? 0.3,
      clientSideFallback: this.config.fuzzySearch?.clientSideFallback ?? true
    };

    // Initialize search strategy based on storage type
    if (this.config.type === StorageType.POSTGRESQL) {
      const sqlStorage = this.storage as SQLStorageProvider;
      const pgPool = sqlStorage.getPostgreSQLPool();
      if (pgPool) {
        const strategy = new PostgreSQLFuzzyStrategy(searchConfig, pgPool, 'default');
        this.searchManager = new SearchManager(searchConfig, strategy);
      }
    } else if (this.config.type === StorageType.SQLITE) {
      const sqliteStorage = this.storage as SQLiteStorageProvider;
      const db = sqliteStorage.getSQLiteDatabase();
      if (db) {
        const strategy = new SQLiteFuzzyStrategy(searchConfig, db, 'default');
        this.searchManager = new SearchManager(searchConfig, strategy);
      }
    }
  }

  private getStorageConfigFromEnv(): StorageConfig {
    return StorageFactory.getDefaultConfig();
  }

  private async loadGraph(project: string): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph(project);

    // Ensure backward compatibility: add empty tags array to entities that don't have it
    graph.entities = graph.entities.map(entity => ({
      ...entity,
      tags: entity.tags || []
    }));

    return graph;
  }

  private async saveGraph(graph: KnowledgeGraph, project: string): Promise<void> {
    return this.storage.saveGraph(graph, project);
  }

  /**
   * Close storage connections and cleanup resources
   */
  async close(): Promise<void> {
    await this.storage.close();
  }

  /**
   * Health check for the storage provider
   */
  async healthCheck(): Promise<boolean> {
    return this.storage.healthCheck?.() ?? true;
  }

  async createEntities(entities: Entity[], project?: string): Promise<Entity[]> {
    const resolvedProject = resolveProject(project);

    // Validate input entities
    this.validateEntities(entities);

    const graph = await this.loadGraph(resolvedProject);

    // Ensure backward compatibility and proper defaults
    const entitiesWithDefaults = entities.map(entity => ({
      ...entity,
      observations: entity.observations || [],
      tags: entity.tags || []
    }));

    const newEntities = entitiesWithDefaults.filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name));
    graph.entities.push(...newEntities);
    await this.saveGraph(graph, resolvedProject);
    return newEntities;
  }

  async createRelations(relations: Relation[], project?: string): Promise<{
    newRelations: Relation[];
    skippedRelations: Array<{ relation: Relation; reason: string }>;
    totalRequested: number;
  }> {
    const resolvedProject = resolveProject(project);

    // Validate input relations
    this.validateRelations(relations);

    const graph = await this.loadGraph(resolvedProject);

    // Check that all referenced entities exist
    relations.forEach(relation => {
      const fromEntity = graph.entities.find(e => e.name === relation.from);
      const toEntity = graph.entities.find(e => e.name === relation.to);

      if (!fromEntity) {
        throw new Error(`RELATION ERROR: Entity '${relation.from}' not found. ACTION: Create entity first with create_entities`);
      }
      if (!toEntity) {
        throw new Error(`RELATION ERROR: Entity '${relation.to}' not found. ACTION: Create entity first with create_entities`);
      }
    });

    // Separate new relations from duplicates with detailed tracking
    const newRelations: Relation[] = [];
    const skippedRelations: Array<{ relation: Relation; reason: string }> = [];

    relations.forEach(relation => {
      const existingRelation = graph.relations.find(existingRelation =>
        existingRelation.from === relation.from &&
        existingRelation.to === relation.to &&
        existingRelation.relationType === relation.relationType
      );

      if (existingRelation) {
        skippedRelations.push({
          relation,
          reason: `Relation already exists: ${relation.from} → ${relation.relationType} → ${relation.to}`
        });
      } else {
        newRelations.push(relation);
      }
    });

    graph.relations.push(...newRelations);
    await this.saveGraph(graph, resolvedProject);

    return {
      newRelations,
      skippedRelations,
      totalRequested: relations.length
    };
  }

  async addObservations(observations: { entityName: string; observations: string[] }[], project?: string): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const resolvedProject = resolveProject(project);

    // Validate input observations
    this.validateObservationUpdates(observations);

    const graph = await this.loadGraph(resolvedProject);
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`ENTITY ERROR: '${o.entityName}' not found. ACTION: Create entity first with create_entities`);
      }

      // Ensure entity has observations array (backward compatibility)
      if (!entity.observations) {
        entity.observations = [];
      }

      const newObservations = o.observations.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph, resolvedProject);
    return results;
  }

  async deleteEntities(entityNames: string[], project?: string): Promise<void> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph, resolvedProject);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[], project?: string): Promise<void> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
      }
    });
    await this.saveGraph(graph, resolvedProject);
  }

  async deleteRelations(relations: Relation[], project?: string): Promise<void> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);
    graph.relations = graph.relations.filter(r => !relations.some(delRelation =>
      r.from === delRelation.from &&
      r.to === delRelation.to &&
      r.relationType === delRelation.relationType
    ));
    await this.saveGraph(graph, resolvedProject);
  }

  async readGraph(project?: string): Promise<KnowledgeGraph> {
    const resolvedProject = resolveProject(project);
    return this.loadGraph(resolvedProject);
  }

  // Enhanced search function that includes tags and supports exact tag matching and fuzzy search
  async searchNodes(
    query: string | string[],
    optionsOrProject?: SearchOptions | {
      exactTags?: string[];
      tagMatchMode?: 'any' | 'all';
    } | string,
    project?: string
  ): Promise<KnowledgeGraph> {
    // Handle backward compatibility: if second param is string, it's the project
    let resolvedOptions: SearchOptions | { exactTags?: string[]; tagMatchMode?: 'any' | 'all' } | undefined;
    let resolvedProject: string;

    if (typeof optionsOrProject === 'string') {
      resolvedOptions = undefined;
      resolvedProject = resolveProject(optionsOrProject);
    } else {
      resolvedOptions = optionsOrProject;
      resolvedProject = resolveProject(project);
    }

    // Handle multiple queries
    const queries = Array.isArray(query) ? query : [query];

    // Handle null/undefined queries - convert to empty string if exactTags is provided
    const hasExactTags = resolvedOptions && 'exactTags' in resolvedOptions && resolvedOptions.exactTags && Array.isArray(resolvedOptions.exactTags) && resolvedOptions.exactTags.length > 0;

    const processedQueries: string[] = [];
    for (const q of queries) {
      if (q === null || q === undefined) {
        if (hasExactTags) {
          processedQueries.push(''); // Convert to empty string for tag-only search
        } else {
          return { entities: [], relations: [] }; // Return empty result for null/undefined without exactTags
        }
      } else if (typeof q === 'string') {
        processedQueries.push(q);
      } else {
        return { entities: [], relations: [] }; // Return empty result for non-string queries
      }
    }

    // Handle empty queries array
    if (processedQueries.length === 0) {
      return { entities: [], relations: [] };
    }

    const graph = await this.loadGraph(resolvedProject);

    // If multiple queries, process each and merge results
    if (processedQueries.length > 1) {
      let allResults: KnowledgeGraph = { entities: [], relations: [] };

      for (const singleQuery of processedQueries) {
        const result = await this.searchSingleQuery(singleQuery, resolvedOptions, resolvedProject, graph);

        // Merge results with deduplication
        const existingEntityNames = new Set(allResults.entities.map(e => e.name));
        const newEntities = result.entities.filter(e => !existingEntityNames.has(e.name));
        allResults.entities.push(...newEntities);

        // Merge relations with deduplication
        const existingRelations = new Set(allResults.relations.map(r => `${r.from}-${r.relationType}-${r.to}`));
        const newRelations = result.relations.filter(r => !existingRelations.has(`${r.from}-${r.relationType}-${r.to}`));
        allResults.relations.push(...newRelations);
      }

      return allResults;
    }

    // Single query - use existing logic
    return this.searchSingleQuery(processedQueries[0], resolvedOptions, resolvedProject, graph);
  }

  // Helper method for single query search
  private async searchSingleQuery(
    query: string,
    options: SearchOptions | { exactTags?: string[]; tagMatchMode?: 'any' | 'all' } | undefined,
    resolvedProject: string,
    graph: KnowledgeGraph
  ): Promise<KnowledgeGraph> {

    // If exact tags are specified, use exact tag matching
    if (options?.exactTags && options.exactTags.length > 0) {
      const filteredEntities = graph.entities.filter(entity => {
        // Ensure entity has tags array (backward compatibility)
        if (!entity.tags || entity.tags.length === 0) return false;

        if (options.tagMatchMode === 'all') {
          return options.exactTags!.every(tag => entity.tags!.includes(tag));
        } else {
          return options.exactTags!.some(tag => entity.tags!.includes(tag));
        }
      });

      return this.buildFilteredGraph(filteredEntities, graph);
    }

    // Use search manager if available and fuzzy search is requested
    if (this.searchManager && options && 'searchMode' in options && options.searchMode === 'fuzzy') {
      try {
        const filteredEntities = await this.searchManager.search(query, graph.entities, options as SearchOptions, resolvedProject);
        return this.buildFilteredGraph(filteredEntities, graph);
      } catch (error) {
        console.warn('Fuzzy search failed, falling back to exact search:', error);
        // Fall through to exact search
      }
    }

    // Handle empty query string - return all entities if no specific search criteria
    if (!query || query.trim() === '') {
      return this.buildFilteredGraph(graph.entities, graph);
    }

    // Default behavior: general text search across all fields including tags
    const filteredEntities = graph.entities.filter(e => {
      // Ensure entity has tags array (backward compatibility)
      const entityTags = e.tags || [];

      return (
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some(o => o.toLowerCase().includes(query.toLowerCase())) ||
        entityTags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    });

    return this.buildFilteredGraph(filteredEntities, graph);
  }

  /**
   * Paginated search function with database-level pagination when possible
   */
  async searchNodesPaginated(
    query: string | string[],
    pagination: PaginationOptions,
    optionsOrProject?: SearchOptions | {
      exactTags?: string[];
      tagMatchMode?: 'any' | 'all';
    } | string,
    project?: string
  ): Promise<PaginatedKnowledgeGraph> {
    // Handle backward compatibility: if third param is string, it's the project
    let resolvedOptions: SearchOptions | { exactTags?: string[]; tagMatchMode?: 'any' | 'all' } | undefined;
    let resolvedProject: string;

    if (typeof optionsOrProject === 'string') {
      resolvedOptions = undefined;
      resolvedProject = resolveProject(optionsOrProject);
    } else {
      resolvedOptions = optionsOrProject;
      resolvedProject = resolveProject(project);
    }

    // Use SearchManager for pagination if available
    if (this.searchManager) {
      try {
        const paginatedResult = await this.searchManager.searchPaginated(
          query,
          pagination,
          resolvedOptions as SearchOptions,
          resolvedProject
        );

        // Build relations for the paginated entities
        const graph = await this.loadGraph(resolvedProject);
        const entityNames = new Set(paginatedResult.data.map(e => e.name));
        const filteredRelations = graph.relations.filter(r =>
          entityNames.has(r.from) && entityNames.has(r.to)
        );

        return {
          entities: paginatedResult.data,
          relations: filteredRelations,
          pagination: paginatedResult.pagination
        };
      } catch (error) {
        console.warn('Paginated search failed, falling back to post-search pagination:', error);
      }
    }

    // Fallback: Use regular search and apply post-search pagination
    const fullResult = await this.searchNodes(query, resolvedOptions, resolvedProject);
    return this.applyPostSearchPagination(fullResult, pagination);
  }

  /**
   * Apply pagination to a full KnowledgeGraph result (post-search pagination)
   */
  private applyPostSearchPagination(
    graph: KnowledgeGraph,
    pagination: PaginationOptions
  ): PaginatedKnowledgeGraph {
    const page = pagination.page || 0;
    const pageSize = pagination.pageSize || 100;
    const offset = page * pageSize;

    const totalCount = graph.entities.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const paginatedEntities = graph.entities.slice(offset, offset + pageSize);

    // Filter relations to only include those between paginated entities
    const entityNames = new Set(paginatedEntities.map(e => e.name));
    const paginatedRelations = graph.relations.filter(r =>
      entityNames.has(r.from) && entityNames.has(r.to)
    );

    return {
      entities: paginatedEntities,
      relations: paginatedRelations,
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

  async openNodes(names: string[], project?: string): Promise<KnowledgeGraph> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);

    // Filter entities
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };

    return filteredGraph;
  }

  // Tag-specific methods

  /**
   * Add tags to existing entities
   */
  async addTags(updates: { entityName: string; tags: string[] }[], project?: string): Promise<{ entityName: string; addedTags: string[] }[]> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);

    const results = updates.map(update => {
      const entity = graph.entities.find(e => e.name === update.entityName);
      if (!entity) {
        throw new Error(`ENTITY ERROR: '${update.entityName}' not found. ACTION: Create entity first with create_entities`);
      }

      // Ensure entity has tags array (backward compatibility)
      if (!entity.tags) {
        entity.tags = [];
      }

      // Add only new tags (avoid duplicates)
      const newTags = update.tags.filter(tag => !entity.tags!.includes(tag));
      entity.tags!.push(...newTags);

      return { entityName: update.entityName, addedTags: newTags };
    });

    await this.saveGraph(graph, resolvedProject);
    return results;
  }

  /**
   * Remove specific tags from entities
   */
  async removeTags(updates: { entityName: string; tags: string[] }[], project?: string): Promise<{ entityName: string; removedTags: string[] }[]> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);

    const results = updates.map(update => {
      const entity = graph.entities.find(e => e.name === update.entityName);
      if (!entity) {
        throw new Error(`ENTITY ERROR: '${update.entityName}' not found. ACTION: Create entity first with create_entities`);
      }

      // Ensure entity has tags array (backward compatibility)
      if (!entity.tags) {
        entity.tags = [];
        return { entityName: update.entityName, removedTags: [] };
      }

      // Remove specified tags
      const removedTags = update.tags.filter(tag => entity.tags!.includes(tag));
      entity.tags = entity.tags!.filter(tag => !update.tags.includes(tag));

      return { entityName: update.entityName, removedTags };
    });

    await this.saveGraph(graph, resolvedProject);
    return results;
  }



  /**
   * Validate entities before creation to prevent database constraint violations
   */
  private validateEntities(entities: Entity[]): void {
    if (!entities || !Array.isArray(entities)) {
      throw new Error('ENTITIES ERROR: Must be array of entity objects. REQUIRED: [{name, entityType, observations}]');
    }

    if (entities.length === 0) {
      throw new Error('ENTITIES ERROR: Empty array provided. REQUIRED: At least 1 entity object');
    }

    entities.forEach((entity, index) => {
      // Validate entity structure
      if (!entity || typeof entity !== 'object') {
        throw new Error(`ENTITY ERROR: Entity #${index} must be object. REQUIRED: {name, entityType, observations}`);
      }

      // Validate required fields
      if (!entity.name || typeof entity.name !== 'string' || entity.name.trim() === '') {
        throw new Error(`ENTITY ERROR: Entity #${index} missing name. REQUIRED: Non-empty string (e.g., 'John_Smith', 'Project_Alpha')`);
      }

      if (!entity.entityType || typeof entity.entityType !== 'string' || entity.entityType.trim() === '') {
        throw new Error(`ENTITY ERROR: Entity #${index} missing entityType. REQUIRED: Non-empty string (e.g., 'person', 'project', 'company')`);
      }

      // Validate observations - must be array and not null/undefined
      if (entity.observations !== undefined && entity.observations !== null) {
        if (!Array.isArray(entity.observations)) {
          throw new Error(`ENTITY ERROR: "${entity.name}" observations must be array. REQUIRED: ['fact1', 'fact2']`);
        }

        // Check each observation is a string
        entity.observations.forEach((obs, obsIndex) => {
          if (typeof obs !== 'string') {
            throw new Error(`ENTITY ERROR: "${entity.name}" observation #${obsIndex} must be string. REQUIRED: Non-empty text fact`);
          }
        });
      }

      // Validate tags if provided
      if (entity.tags !== undefined && entity.tags !== null) {
        if (!Array.isArray(entity.tags)) {
          throw new Error(`ENTITY ERROR: "${entity.name}" tags must be array. REQUIRED: ['urgent', 'completed'] or []`);
        }

        // Check each tag is a string
        entity.tags.forEach((tag, tagIndex) => {
          if (typeof tag !== 'string') {
            throw new Error(`ENTITY ERROR: "${entity.name}" tag #${tagIndex} must be string. EXAMPLE: 'urgent', 'completed', 'technical'`);
          }
        });
      }
    });
  }

  /**
   * Validate relations before creation to prevent database constraint violations
   */
  private validateRelations(relations: Relation[]): void {
    if (!relations || !Array.isArray(relations)) {
      throw new Error('RELATIONS ERROR: Must be array of relation objects. REQUIRED: [{from, to, relationType}]');
    }

    if (relations.length === 0) {
      throw new Error('RELATIONS ERROR: Empty array provided. REQUIRED: At least 1 relation object');
    }

    relations.forEach((relation, index) => {
      // Validate relation structure
      if (!relation || typeof relation !== 'object') {
        throw new Error(`RELATION ERROR: Relation #${index} must be object. REQUIRED: {from, to, relationType}`);
      }

      // Validate required fields
      if (!relation.from || typeof relation.from !== 'string' || relation.from.trim() === '') {
        throw new Error(`RELATION ERROR: Relation #${index} missing 'from' entity. REQUIRED: Existing entity name (e.g., 'John_Smith')`);
      }

      if (!relation.to || typeof relation.to !== 'string' || relation.to.trim() === '') {
        throw new Error(`RELATION ERROR: Relation #${index} missing 'to' entity. REQUIRED: Existing entity name (e.g., 'Google')`);
      }

      if (!relation.relationType || typeof relation.relationType !== 'string' || relation.relationType.trim() === '') {
        throw new Error(`RELATION ERROR: Relation #${index} missing relationType. REQUIRED: Active voice (e.g., 'works_at', 'manages', 'uses')`);
      }

      // Check for passive voice patterns
      const passivePatterns = ['_by', 'is_', 'was_', 'been_'];
      if (passivePatterns.some(pattern => relation.relationType.includes(pattern))) {
        throw new Error(`RELATION ERROR: Relation #${index} uses passive voice '${relation.relationType}'. REQUIRED: Active voice (e.g., 'works_at' not 'is_worked_at')`);
      }
    });
  }

  /**
   * Validate observation updates to prevent database constraint violations
   */
  private validateObservationUpdates(observations: { entityName: string; observations: string[] }[]): void {
    if (!observations || !Array.isArray(observations)) {
      throw new Error('OBSERVATIONS ERROR: Must be array of update objects. REQUIRED: [{entityName, observations}]');
    }

    if (observations.length === 0) {
      throw new Error('OBSERVATIONS ERROR: Empty array provided. REQUIRED: At least 1 observation update');
    }

    observations.forEach((update, index) => {
      // Validate update structure
      if (!update || typeof update !== 'object') {
        throw new Error(`OBSERVATION ERROR: Update #${index} must be object. REQUIRED: {entityName, observations}`);
      }

      // Validate entityName
      if (!update.entityName || typeof update.entityName !== 'string' || update.entityName.trim() === '') {
        throw new Error(`OBSERVATION ERROR: Update #${index} missing entityName. REQUIRED: Existing entity name (e.g., 'John_Smith')`);
      }

      // Validate observations array
      if (!update.observations || !Array.isArray(update.observations)) {
        throw new Error(`OBSERVATION ERROR: "${update.entityName}" observations must be array. REQUIRED: ['fact1', 'fact2']`);
      }

      if (update.observations.length === 0) {
        throw new Error(`OBSERVATION ERROR: "${update.entityName}" needs observations. REQUIRED: At least 1 fact (e.g., ['Promoted to senior', 'Moved to NYC'])`);
      }

      // Check each observation is a string
      update.observations.forEach((obs, obsIndex) => {
        if (typeof obs !== 'string' || obs.trim() === '') {
          throw new Error(`OBSERVATION ERROR: "${update.entityName}" observation #${obsIndex} must be non-empty string. EXAMPLE: 'Works at Google'`);
        }
      });
    });
  }

  /**
   * Helper method to build a filtered graph with relations
   */
  private buildFilteredGraph(filteredEntities: Entity[], originalGraph: KnowledgeGraph): KnowledgeGraph {
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = originalGraph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }
}

import { StorageProvider, StorageConfig, StorageType } from './storage/types.js';
import { StorageFactory } from './storage/factory.js';
import { SQLStorageProvider } from './storage/providers/sql-storage.js';
import { SQLiteStorageProvider } from './storage/providers/sqlite-storage.js';
import { resolveProject } from './utils.js';
import { SearchManager } from './search/search-manager.js';
import { SearchConfig, SearchOptions } from './search/types.js';
import { PostgreSQLFuzzyStrategy } from './search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from './search/strategies/sqlite-strategy.js';

// We are storing our knowledge using entities, relations, and observations in a graph structure
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  tags: string[];  // NEW: Array of exact-match tags
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
    const graph = await this.loadGraph(resolvedProject);

    // Ensure backward compatibility by adding empty tags array if not provided
    const entitiesWithTags = entities.map(entity => ({
      ...entity,
      tags: entity.tags || []
    }));

    const newEntities = entitiesWithTags.filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name));
    graph.entities.push(...newEntities);
    await this.saveGraph(graph, resolvedProject);
    return newEntities;
  }

  async createRelations(relations: Relation[], project?: string): Promise<Relation[]> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);
    const newRelations = relations.filter(r => !graph.relations.some(existingRelation =>
      existingRelation.from === r.from &&
      existingRelation.to === r.to &&
      existingRelation.relationType === r.relationType
    ));
    graph.relations.push(...newRelations);
    await this.saveGraph(graph, resolvedProject);
    return newRelations;
  }

  async addObservations(observations: { entityName: string; observations: string[] }[], project?: string): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const resolvedProject = resolveProject(project);
    const graph = await this.loadGraph(resolvedProject);
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
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
    query: string,
    optionsOrProject?: SearchOptions | {
      exactTags?: string[];
      tagMatchMode?: 'any' | 'all';
    } | string,
    project?: string
  ): Promise<KnowledgeGraph> {
    // Handle backward compatibility: if second param is string, it's the project
    let options: SearchOptions | { exactTags?: string[]; tagMatchMode?: 'any' | 'all' } | undefined;
    let resolvedProject: string;

    if (typeof optionsOrProject === 'string') {
      options = undefined;
      resolvedProject = resolveProject(optionsOrProject);
    } else {
      options = optionsOrProject;
      resolvedProject = resolveProject(project);
    }

    const graph = await this.loadGraph(resolvedProject);

    // If exact tags are specified, use exact tag matching
    if (options?.exactTags && options.exactTags.length > 0) {
      const filteredEntities = graph.entities.filter(entity => {
        // Ensure entity has tags array (backward compatibility)
        if (!entity.tags || entity.tags.length === 0) return false;

        if (options.tagMatchMode === 'all') {
          return options.exactTags!.every(tag => entity.tags.includes(tag));
        } else {
          return options.exactTags!.some(tag => entity.tags.includes(tag));
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
        throw new Error(`Entity with name ${update.entityName} not found`);
      }

      // Ensure entity has tags array (backward compatibility)
      if (!entity.tags) {
        entity.tags = [];
      }

      // Add only new tags (avoid duplicates)
      const newTags = update.tags.filter(tag => !entity.tags.includes(tag));
      entity.tags.push(...newTags);

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
        throw new Error(`Entity with name ${update.entityName} not found`);
      }

      // Ensure entity has tags array (backward compatibility)
      if (!entity.tags) {
        entity.tags = [];
        return { entityName: update.entityName, removedTags: [] };
      }

      // Remove specified tags
      const removedTags = update.tags.filter(tag => entity.tags.includes(tag));
      entity.tags = entity.tags.filter(tag => !update.tags.includes(tag));

      return { entityName: update.entityName, removedTags };
    });

    await this.saveGraph(graph, resolvedProject);
    return results;
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

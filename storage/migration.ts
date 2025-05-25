import { StorageProvider, MigrationService } from './types.js';

/**
 * Service for migrating data between different storage providers
 */
export class DataMigrationService implements MigrationService {
  /**
   * Migrate data between two storage providers
   */
  async migrateFromStorage(project: string, sourceStorage: StorageProvider, targetStorage: StorageProvider): Promise<void> {
    try {
      console.log(`Migrating project ${project} from ${sourceStorage.constructor.name} to ${targetStorage.constructor.name}`);

      // Load data from source
      const graph = await sourceStorage.loadGraph(project);

      // Validate data
      if (!graph || (!graph.entities && !graph.relations)) {
        console.warn(`No data found for project ${project} in source storage`);
        return;
      }

      // Save data to target
      await targetStorage.saveGraph(graph, project);

      console.log(`Successfully migrated project ${project}: ${graph.entities?.length || 0} entities, ${graph.relations?.length || 0} relations`);
    } catch (error) {
      throw new Error(`Failed to migrate project ${project}: ${error}`);
    }
  }

  /**
   * Validate that migration was successful by comparing data
   */
  async validateMigration(project: string, sourceStorage: StorageProvider, targetStorage: StorageProvider): Promise<boolean> {
    try {
      const sourceGraph = await sourceStorage.loadGraph(project);
      const targetGraph = await targetStorage.loadGraph(project);

      // Compare entities
      if (sourceGraph.entities.length !== targetGraph.entities.length) {
        console.error(`Entity count mismatch: source=${sourceGraph.entities.length}, target=${targetGraph.entities.length}`);
        return false;
      }

      // Compare relations
      if (sourceGraph.relations.length !== targetGraph.relations.length) {
        console.error(`Relation count mismatch: source=${sourceGraph.relations.length}, target=${targetGraph.relations.length}`);
        return false;
      }

      // More detailed validation could be added here
      // For now, we just check counts

      return true;
    } catch (error) {
      console.error(`Migration validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Backup data from a storage provider to a backup location
   */
  async backupData(project: string, sourceStorage: StorageProvider, backupStorage: StorageProvider): Promise<void> {
    try {
      const graph = await sourceStorage.loadGraph(project);
      const backupProject = `${project}_backup_${Date.now()}`;
      await backupStorage.saveGraph(graph, backupProject);
      console.log(`Backup created for project ${project} as ${backupProject}`);
    } catch (error) {
      throw new Error(`Failed to backup project ${project}: ${error}`);
    }
  }

  /**
   * Restore data from a backup
   */
  async restoreData(backupProject: string, targetProject: string, backupStorage: StorageProvider, targetStorage: StorageProvider): Promise<void> {
    try {
      const graph = await backupStorage.loadGraph(backupProject);
      await targetStorage.saveGraph(graph, targetProject);
      console.log(`Restored project ${targetProject} from backup ${backupProject}`);
    } catch (error) {
      throw new Error(`Failed to restore project ${targetProject} from backup ${backupProject}: ${error}`);
    }
  }

  /**
   * List all projects in a storage provider
   */
  async listProjects(_storage: StorageProvider): Promise<string[]> {
    // This would need to be implemented based on the storage provider
    // For now, return empty array as this requires storage-specific implementation
    console.warn('listProjects not implemented for this storage provider');
    return [];
  }

  /**
   * Get statistics about a project in a storage provider
   */
  async getProjectStats(project: string, storage: StorageProvider): Promise<{ entities: number; relations: number; size?: number }> {
    try {
      const graph = await storage.loadGraph(project);
      return {
        entities: graph.entities.length,
        relations: graph.relations.length,
        // Size calculation would be storage-specific
      };
    } catch (error) {
      throw new Error(`Failed to get stats for project ${project}: ${error}`);
    }
  }
}

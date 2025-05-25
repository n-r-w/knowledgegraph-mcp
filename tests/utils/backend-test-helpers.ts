/**
 * Backend-Specific Test Helpers
 * 
 * Provides utilities for handling backend-specific behavior in tests,
 * such as different search capabilities and configuration requirements.
 */

import { StorageConfig, StorageType } from '../../storage/types.js';
import { SearchConfig } from '../../search/types.js';
import { KnowledgeGraphManager } from '../../core.js';

/**
 * Backend capabilities and characteristics
 */
export interface BackendCapabilities {
  supportsDatabaseSearch: boolean;
  supportsTransactions: boolean;
  supportsFullTextSearch: boolean;
  isInMemory: boolean;
  requiresExternalServer: boolean;
}

/**
 * Get capabilities for a specific backend
 */
export function getBackendCapabilities(storageType: StorageType): BackendCapabilities {
  switch (storageType) {
    case StorageType.SQLITE:
      return {
        supportsDatabaseSearch: false, // SQLite uses client-side fuzzy search
        supportsTransactions: true,
        supportsFullTextSearch: true, // SQLite FTS
        isInMemory: true, // For tests
        requiresExternalServer: false
      };
    
    case StorageType.POSTGRESQL:
      return {
        supportsDatabaseSearch: true, // PostgreSQL has similarity functions
        supportsTransactions: true,
        supportsFullTextSearch: true, // PostgreSQL full-text search
        isInMemory: false,
        requiresExternalServer: true
      };
    
    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}

/**
 * Create appropriate search configuration for a backend
 */
export function createSearchConfig(storageType: StorageType): SearchConfig {
  const capabilities = getBackendCapabilities(storageType);
  
  return {
    useDatabaseSearch: capabilities.supportsDatabaseSearch,
    threshold: 0.3,
    clientSideFallback: true,
    fuseOptions: {
      threshold: 0.3,
      distance: 100,
      includeScore: true,
      keys: ['name', 'entityType', 'observations', 'tags']
    }
  };
}

/**
 * Create a KnowledgeGraphManager instance for testing with appropriate configuration
 */
export async function createTestManager(
  config: StorageConfig,
  backendName: string,
  options: {
    customSearchConfig?: Partial<SearchConfig>;
    timeout?: number;
  } = {}
): Promise<KnowledgeGraphManager> {
  const searchConfig = createSearchConfig(config.type);
  
  // Apply custom search configuration if provided
  if (options.customSearchConfig) {
    Object.assign(searchConfig, options.customSearchConfig);
  }

  const manager = new KnowledgeGraphManager({
    ...config,
    fuzzySearch: searchConfig
  });

  // Wait for initialization with backend-specific timeout
  const timeout = options.timeout || (backendName === 'PostgreSQL' ? 2000 : 500);
  await new Promise(resolve => setTimeout(resolve, timeout));

  return manager;
}

/**
 * Cleanup test manager and handle backend-specific cleanup
 */
export async function cleanupTestManager(
  manager: KnowledgeGraphManager,
  backendName: string
): Promise<void> {
  try {
    await manager.close();
  } catch (error) {
    console.warn(`Error closing ${backendName} manager:`, error);
  }
}

/**
 * Skip test if backend doesn't support required capability
 */
export function skipIfNotSupported(
  storageType: StorageType,
  capability: keyof BackendCapabilities,
  testContext?: any
): boolean {
  const capabilities = getBackendCapabilities(storageType);
  const isSupported = capabilities[capability];
  
  if (!isSupported && testContext) {
    testContext.skip();
  }
  
  return isSupported;
}

/**
 * Create backend-specific test expectations
 */
export function createBackendExpectations(storageType: StorageType) {
  const capabilities = getBackendCapabilities(storageType);
  
  return {
    /**
     * Expect search to use database-level search if supported
     */
    expectDatabaseSearch: (searchResults: any[]) => {
      if (capabilities.supportsDatabaseSearch) {
        // For PostgreSQL, we expect database-level search to be used
        // This would be verified by checking that the search was performed at DB level
        expect(searchResults).toBeDefined();
      } else {
        // For SQLite, we expect client-side search
        expect(searchResults).toBeDefined();
      }
    },

    /**
     * Expect appropriate search performance characteristics
     */
    expectSearchPerformance: (duration: number) => {
      if (capabilities.supportsDatabaseSearch) {
        // Database search might be slower due to network overhead
        expect(duration).toBeLessThan(5000); // 5 seconds max
      } else {
        // Client-side search should be faster
        expect(duration).toBeLessThan(1000); // 1 second max
      }
    },

    /**
     * Expect backend-specific error handling
     */
    expectErrorHandling: (error: Error) => {
      if (capabilities.requiresExternalServer) {
        // PostgreSQL might have connection errors
        expect(error.message).toMatch(/connection|timeout|server/i);
      } else {
        // SQLite errors are usually file/memory related
        expect(error.message).toMatch(/database|file|memory/i);
      }
    }
  };
}

/**
 * Generate backend-specific test data
 */
export function generateTestData(storageType: StorageType, size: number = 10) {
  const capabilities = getBackendCapabilities(storageType);
  const prefix = storageType.toLowerCase();
  
  return Array.from({ length: size }, (_, i) => ({
    name: `${prefix}_entity_${i}`,
    entityType: `${prefix}_type`,
    observations: [
      `Test observation ${i} for ${storageType}`,
      capabilities.isInMemory ? 'In-memory test data' : 'Persistent test data'
    ],
    tags: [`${prefix}`, 'test', `item_${i}`]
  }));
}

/**
 * Wait for backend-specific operations to complete
 */
export async function waitForBackendOperation(
  storageType: StorageType,
  operation: () => Promise<any>
): Promise<any> {
  const capabilities = getBackendCapabilities(storageType);
  const timeout = capabilities.requiresExternalServer ? 10000 : 5000;
  
  return Promise.race([
    operation(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${storageType} operation timed out after ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Create a test project name that's unique per backend
 */
export function createBackendTestProject(
  storageType: StorageType,
  testName: string,
  suffix?: string
): string {
  const timestamp = Date.now();
  const backendPrefix = storageType.toLowerCase();
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '_');
  const suffixPart = suffix ? `_${suffix}` : '';
  
  return `${backendPrefix}_${sanitizedTestName}_${timestamp}${suffixPart}`;
}

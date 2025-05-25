/**
 * Multi-Backend Test Runner
 *
 * Provides utilities for running the same test suite against multiple database backends
 * to ensure compatibility and feature parity across SQLite and PostgreSQL.
 */

import { StorageConfig, StorageType } from '../../storage/types.js';

export interface BackendTestConfig {
  name: string;
  config: StorageConfig;
  available: boolean;
  skipReason?: string;
}

export type TestSuiteFunction = (config: StorageConfig, backendName: string) => void;

/**
 * Configuration for different database backends used in testing
 */
export const BACKEND_CONFIGS: BackendTestConfig[] = [
  {
    name: 'SQLite',
    config: {
      type: StorageType.SQLITE,
      connectionString: 'sqlite://:memory:'
    },
    available: true // SQLite is always available
  },
  {
    name: 'PostgreSQL',
    config: {
      type: StorageType.POSTGRESQL,
      connectionString: process.env.KNOWLEDGEGRAPH_TEST_CONNECTION_STRING || 'postgresql://postgres:1@localhost:5432/knowledgegraph_test'
    },
    available: true // Will be checked at runtime
  }
];

/**
 * Check if PostgreSQL is available for testing
 */
export async function checkPostgreSQLAvailability(): Promise<boolean> {
  try {
    const { Pool } = await import('pg');
    const pgConfig = BACKEND_CONFIGS.find(c => c.name === 'PostgreSQL');
    if (!pgConfig) return false;

    const pool = new Pool({
      connectionString: pgConfig.config.connectionString,
      max: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
    });

    const client = await pool.connect();
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.warn('PostgreSQL not available for testing:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Get available backend configurations for testing
 */
export async function getAvailableBackends(): Promise<BackendTestConfig[]> {
  const backends = [...BACKEND_CONFIGS];

  // Check PostgreSQL availability
  const pgBackend = backends.find(b => b.name === 'PostgreSQL');
  if (pgBackend) {
    pgBackend.available = await checkPostgreSQLAvailability();
    if (!pgBackend.available) {
      pgBackend.skipReason = 'PostgreSQL server not available at localhost:5432';
    }
  }

  return backends;
}

/**
 * Run a test suite against all available backends
 *
 * @param testSuite Function that defines the test suite
 * @param options Configuration options
 */
export function runTestsForAllBackends(
  testSuite: TestSuiteFunction,
  options: {
    skipUnavailable?: boolean;
    requireAllBackends?: boolean;
  } = {}
) {
  const { skipUnavailable = true, requireAllBackends = false } = options;

  describe('Multi-Backend Tests', () => {
    let availableBackends: BackendTestConfig[];

    beforeAll(async () => {
      availableBackends = await getAvailableBackends();

      if (requireAllBackends) {
        const unavailable = availableBackends.filter(b => !b.available);
        if (unavailable.length > 0) {
          throw new Error(
            `Required backends not available: ${unavailable.map(b => `${b.name} (${b.skipReason})`).join(', ')}`
          );
        }
      }
    });

    // Create test suites for each backend
    BACKEND_CONFIGS.forEach((backend) => {
      const testDescription = `${backend.name} Backend`;

      describe(testDescription, () => {
        if (skipUnavailable && backend.name === 'PostgreSQL') {
          // For PostgreSQL, check availability before each test
          beforeEach(async () => {
            const available = availableBackends?.find(b => b.name === backend.name);
            const isAvailable = available?.available ?? false;
            if (!isAvailable) {
              throw new Error('PostgreSQL server not available - test skipped');
            }
          });
        }

        testSuite(backend.config, backend.name);
      });
    });
  });
}

/**
 * Run a test suite against only available backends (skips unavailable ones)
 */
export function runTestsForAvailableBackends(testSuite: TestSuiteFunction) {
  return runTestsForAllBackends(testSuite, { skipUnavailable: true });
}

/**
 * Run a test suite against all backends (fails if any backend is unavailable)
 */
export function runTestsForRequiredBackends(testSuite: TestSuiteFunction) {
  return runTestsForAllBackends(testSuite, { requireAllBackends: true });
}

/**
 * Utility to create backend-specific test data
 */
export function createTestProject(backendName: string, testName: string): string {
  const timestamp = Date.now();
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '_');
  return `test_${backendName.toLowerCase()}_${sanitizedTestName}_${timestamp}`;
}

/**
 * Utility to add backend-specific test timeouts
 */
export function getBackendTimeout(backendName: string): number {
  switch (backendName) {
    case 'PostgreSQL':
      return 10000; // 10 seconds for PostgreSQL (network overhead)
    case 'SQLite':
      return 5000;  // 5 seconds for SQLite (in-memory)
    default:
      return 5000;
  }
}

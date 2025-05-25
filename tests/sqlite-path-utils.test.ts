import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { getDefaultSQLitePath, resolveSQLiteConnectionString } from '../utils.js';

describe('SQLite Path Utils', () => {
  const originalEnv = process.env;
  const testDir = join(homedir(), '.knowledge-graph-test');

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.KNOWLEDGEGRAPH_SQLITE_PATH;

    // Clean up test directory if it exists
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getDefaultSQLitePath', () => {
    test('should return custom path when KNOWLEDGEGRAPH_SQLITE_PATH is set', () => {
      const customPath = '/custom/path/to/database.db';
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = customPath;

      const result = getDefaultSQLitePath();
      expect(result).toBe(customPath);
    });

    test('should return default home directory path when no custom path is set', () => {
      const expectedPath = join(homedir(), '.knowledge-graph', 'knowledgegraph.db');
      
      const result = getDefaultSQLitePath();
      expect(result).toBe(expectedPath);
    });

    test('should create .knowledge-graph directory if it does not exist', () => {
      const knowledgeGraphDir = join(homedir(), '.knowledge-graph');
      
      // Ensure directory doesn't exist
      if (existsSync(knowledgeGraphDir)) {
        rmSync(knowledgeGraphDir, { recursive: true, force: true });
      }

      const result = getDefaultSQLitePath();
      
      expect(existsSync(knowledgeGraphDir)).toBe(true);
      expect(result).toBe(join(knowledgeGraphDir, 'knowledgegraph.db'));
    });

    test('should handle directory creation failure gracefully', () => {
      // Mock homedir to return a path that will fail to create
      const originalHomedir = homedir;
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/root/nonexistent/path');

      const result = getDefaultSQLitePath();
      
      // Should fall back to current directory
      expect(result).toBe('./knowledgegraph.db');

      // Restore original homedir
      jest.restoreAllMocks();
    });
  });

  describe('resolveSQLiteConnectionString', () => {
    test('should return properly formatted connection string with custom path', () => {
      const customPath = '/custom/path/to/database.db';
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = customPath;

      const result = resolveSQLiteConnectionString();
      expect(result).toBe(`sqlite://${customPath}`);
    });

    test('should return properly formatted connection string with default path', () => {
      const expectedPath = join(homedir(), '.knowledge-graph', 'knowledgegraph.db');
      
      const result = resolveSQLiteConnectionString();
      expect(result).toBe(`sqlite://${expectedPath}`);
    });

    test('should handle absolute paths correctly', () => {
      const absolutePath = '/absolute/path/to/database.db';
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = absolutePath;

      const result = resolveSQLiteConnectionString();
      expect(result).toBe(`sqlite://${absolutePath}`);
    });

    test('should handle relative paths correctly', () => {
      const relativePath = './relative/path/to/database.db';
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = relativePath;

      const result = resolveSQLiteConnectionString();
      expect(result).toBe(`sqlite://${relativePath}`);
    });
  });

  describe('Integration with StorageFactory', () => {
    test('should use default home directory path when no environment variables are set', () => {
      // Import here to ensure environment is clean
      const { StorageFactory } = require('../storage/factory.js');
      
      process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = 'sqlite';
      delete process.env.KNOWLEDGEGRAPH_CONNECTION_STRING;
      delete process.env.KNOWLEDGEGRAPH_SQLITE_PATH;

      const config = StorageFactory.getDefaultConfig();
      const expectedPath = join(homedir(), '.knowledge-graph', 'knowledgegraph.db');
      
      expect(config.type).toBe('sqlite');
      expect(config.connectionString).toBe(`sqlite://${expectedPath}`);
    });

    test('should respect KNOWLEDGEGRAPH_CONNECTION_STRING when provided', () => {
      const { StorageFactory } = require('../storage/factory.js');
      
      process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = 'sqlite';
      process.env.KNOWLEDGEGRAPH_CONNECTION_STRING = 'sqlite://./custom.db';

      const config = StorageFactory.getDefaultConfig();
      
      expect(config.type).toBe('sqlite');
      expect(config.connectionString).toBe('sqlite://./custom.db');
    });

    test('should use KNOWLEDGEGRAPH_SQLITE_PATH when KNOWLEDGEGRAPH_CONNECTION_STRING is not set', () => {
      const { StorageFactory } = require('../storage/factory.js');
      
      process.env.KNOWLEDGEGRAPH_STORAGE_TYPE = 'sqlite';
      process.env.KNOWLEDGEGRAPH_SQLITE_PATH = '/custom/sqlite/path.db';
      delete process.env.KNOWLEDGEGRAPH_CONNECTION_STRING;

      const config = StorageFactory.getDefaultConfig();
      
      expect(config.type).toBe('sqlite');
      expect(config.connectionString).toBe('sqlite:///custom/sqlite/path.db');
    });
  });
});

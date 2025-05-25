
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Project utility functions
export function resolveProject(toolProject?: string): string {
  return toolProject || process.env.KNOWLEDGEGRAPH_PROJECT || 'knowledgegraph_default_project';
}

export function validateProjectName(project: string): boolean {
  // Validate project name for file system safety
  return /^[a-zA-Z0-9_-]+$/.test(project) && project.length > 0 && project.length <= 100;
}

export function sanitizeProjectName(project: string): string {
  // Remove any characters that aren't alphanumeric, underscore, or hyphen
  return project.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// SQLite path utility functions
export function getDefaultSQLitePath(): string {
  // Check if custom path is provided via environment variable
  const customPath = process.env.KNOWLEDGEGRAPH_SQLITE_PATH;
  if (customPath) {
    return customPath;
  }

  // Default to {home directory}/.knowledge-graph/knowledgegraph.db
  const homeDir = homedir();
  const knowledgeGraphDir = join(homeDir, '.knowledge-graph');

  // Ensure the directory exists
  if (!existsSync(knowledgeGraphDir)) {
    try {
      mkdirSync(knowledgeGraphDir, { recursive: true });
      console.log(`Created knowledge graph directory: ${knowledgeGraphDir}`);
    } catch (error) {
      console.warn(`Failed to create knowledge graph directory: ${error}`);
      // Fall back to current directory if home directory creation fails
      return './knowledgegraph.db';
    }
  }

  return join(knowledgeGraphDir, 'knowledgegraph.db');
}

export function resolveSQLiteConnectionString(): string {
  const dbPath = getDefaultSQLitePath();
  return `sqlite://${dbPath}`;
}



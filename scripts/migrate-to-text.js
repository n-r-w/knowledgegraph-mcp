#!/usr/bin/env node

/**
 * Migration script to drop and recreate PostgreSQL tables with TEXT fields
 * This script is for development environments only
 */

import { Pool } from 'pg';

async function migrateToText() {
  const connectionString = process.env.KNOWLEDGEGRAPH_CONNECTION_STRING || 'postgresql://postgres:1@localhost:5432/knowledgegraph';

  console.log('🔄 Starting VARCHAR to TEXT migration...');
  console.log(`📡 Connecting to: ${connectionString.replace(/:[^:@]*@/, ':***@')}`);

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();

    try {
      console.log('✅ Connected to PostgreSQL');

      // Drop existing tables (development only!)
      console.log('🗑️  Dropping existing tables...');
      await client.query('DROP TABLE IF EXISTS relations CASCADE');
      await client.query('DROP TABLE IF EXISTS entities CASCADE');
      console.log('✅ Tables dropped');

      // Create new tables with TEXT fields
      console.log('🏗️  Creating tables with TEXT fields...');

      // Create entities table with TEXT fields
      await client.query(`
        CREATE TABLE entities (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          name TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          observations JSONB NOT NULL,
          tags JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project, name)
        )
      `);

      // Create relations table with TEXT fields
      await client.query(`
        CREATE TABLE relations (
          id SERIAL PRIMARY KEY,
          project TEXT NOT NULL,
          from_entity TEXT NOT NULL,
          to_entity TEXT NOT NULL,
          relation_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project, from_entity, to_entity, relation_type)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX idx_entities_project ON entities(project);
        CREATE INDEX idx_entities_name ON entities(project, name);
        CREATE INDEX idx_relations_project ON relations(project);
        CREATE INDEX idx_relations_from ON relations(project, from_entity);
        CREATE INDEX idx_relations_to ON relations(project, to_entity);
      `);

      console.log('✅ Tables created with TEXT fields');

      // Enable PostgreSQL extensions for fuzzy search
      console.log('🔍 Setting up fuzzy search extensions...');
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');

      // Create fuzzy search indexes
      await client.query(`
        CREATE INDEX entities_name_trgm_idx
        ON entities USING GIN (name gin_trgm_ops)
      `);
      await client.query(`
        CREATE INDEX entities_type_trgm_idx
        ON entities USING GIN (entity_type gin_trgm_ops)
      `);
      await client.query(`
        CREATE INDEX entities_obs_trgm_idx
        ON entities USING GIN ((observations::text) gin_trgm_ops)
      `);
      await client.query(`
        CREATE INDEX entities_tags_trgm_idx
        ON entities USING GIN ((tags::text) gin_trgm_ops)
      `);

      console.log('✅ Fuzzy search indexes created');
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('📊 Summary:');
      console.log('  - Dropped old tables with VARCHAR(255) fields');
      console.log('  - Created new tables with TEXT fields');
      console.log('  - Set up fuzzy search extensions and indexes');
      console.log('  - All string fields now support unlimited length');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToText().catch(console.error);
}

export { migrateToText };

#!/usr/bin/env node

/**
 * Health check script for the Knowledge Graph MCP service
 */

import { KnowledgeGraphManager } from '../dist/core.js';

async function healthCheck() {
  try {
    console.log('🔍 Checking service health...');
    
    const manager = new KnowledgeGraphManager();
    const isHealthy = await manager.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Service is healthy');
      process.exit(0);
    } else {
      console.error('❌ Service health check failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Service health check failed:', error.message);
    process.exit(1);
  }
}

// Run health check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  healthCheck();
}

export { healthCheck };

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Entity, Relation, KnowledgeGraph, KnowledgeGraphManager } from './core.js';

// Re-export types and classes for external use
export { Entity, Relation, KnowledgeGraph, KnowledgeGraphManager };

// Initialize the knowledge graph manager
let knowledgeGraphManager: KnowledgeGraphManager;


// The server instance and tools exposed to Claude
const server = new Server({
  name: "knowledgegraph-server",
  version: "0.0.1",
}, {
  capabilities: {
    tools: {},
  },
},);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_knowledge",
        description: "SEARCH ENTITIES by TEXT or TAGS across names, types, observations, and tags. Supports exact/fuzzy search modes, multiple query batching, tag filtering, and pagination. Returns entities and their relationships. MUST USE BEFORE create_entities, add_observations, and create_relations to verify entity existence. PAGINATION: Use page parameter to navigate large result sets (page=0 for first page, page=1 for second, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } }
              ],
              description: "Search text (string or array of strings for batch search). Searches across entity names, types, observations, and tags. Optional when exactTags is provided."
            },
            exactTags: {
              type: "array",
              items: { type: "string" },
              description: "Array of tags for exact-match filtering (case-sensitive). Enables tag-only search when query is omitted."
            },
            tagMatchMode: {
              type: "string",
              enum: ["any", "all"],
              description: "Tag matching mode: 'any' finds entities with ANY specified tag, 'all' requires ALL tags (default: 'any')"
            },
            searchMode: {
              type: "string",
              enum: ["exact", "fuzzy"],
              description: "Search algorithm: 'exact' for substring matching (fast), 'fuzzy' for similarity matching (slower, broader results). Default: 'exact'"
            },
            fuzzyThreshold: {
              type: "number",
              minimum: 0.0,
              maximum: 1.0,
              description: "Similarity threshold for fuzzy search (0.0-1.0). Lower values = more results. Default: 0.3"
            },
            page: {
              type: "number",
              minimum: 0,
              description: "Page number for pagination (0-based). Use 0 or omit for first page."
            },
            pageSize: {
              type: "number",
              minimum: 1,
              maximum: 1000,
              description: "Number of results per page (default: 100, max: 1000)"
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: [],
        },
      },
      {
        name: "create_entities",
        description: "CREATE new entities with OBSERVATIONS and optional tags. MANDATORY: If creating multiple entities, use a SINGLE call (batch). Each entity requires a unique name, type, and at least one observation. Ignores existing names. Use search_knowledge first.",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              description: "Array of entity objects to create. Each entity must have at least one observation.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Unique entity identifier. Use descriptive names (e.g., 'John_Smith_Engineer', 'React_v18')" },
                  entityType: { type: "string", description: "Entity category. Valid types: 'person', 'technology', 'project', 'company', 'concept', 'event', 'preference'" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of factual statements about the entity. Must contain at least one non-empty string."
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional tags for categorization and filtering (e.g., ['urgent', 'technical', 'completed'])"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entities"],
        },
      },
      {
        name: "add_observations",
        description: "ADD new factual observations to existing entities. Requires exact entity names that exist in the knowledge graph. Use search_knowledge first to verify entity existence.",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              description: "Array of observation updates. Each update specifies an entity and new observations to add.",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Exact name of existing entity to update" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of new factual statements to add. Must contain at least one non-empty string."
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["observations"],
        },
      },
      {
        name: "create_relations",
        description: "CREATE directional RELATIONSHIPS between existing entities. Both source and target entities must exist. Use active voice relationship types (e.g., 'works_at', 'manages', 'depends_on'). Verify entity existence with search_knowledge first.",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              description: "Array of relationship objects to create between existing entities",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Source entity name (must exist in knowledge graph)" },
                  to: { type: "string", description: "Target entity name (must exist in knowledge graph)" },
                  relationType: { type: "string", description: "Relationship type in active voice (e.g., 'works_at', 'manages', 'created_by', 'depends_on', 'uses')" },
                },
                required: ["from", "to", "relationType"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "delete_entities",
        description: "Permanently DELETE entities and all their RELATIONSHIPS. This action is irreversible and cascades to remove all connections. Verify entity existence with search_knowledge first. Consider delete_observations for partial updates.",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of exact entity names to permanently delete"
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "DELETE specific OBSERVATIONS from entities while preserving the entity, its relationships, and tags. Use for correcting errors or removing outdated facts without deleting the entire entity.",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              description: "Array of deletion requests specifying which observations to remove from which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Exact name of entity to update" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of exact observation strings to remove from the entity"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "DELETE specific RELATIONSHIPS between entities while preserving both entities. Use for updating connection status when relationships change (job changes, project completion, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              description: "Array of specific relationships to delete",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Source entity name" },
                  to: { type: "string", description: "Target entity name" },
                  relationType: { type: "string", description: "Exact relationship type to remove (must match existing relation)" },
                },
                required: ["from", "to", "relationType"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "RETRIEVE the complete KNOWLEDGE GRAPH with all entities and relationships for a project. Returns comprehensive view of the entire network structure. Can be large for projects with many entities.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
        },
      },
      {
        name: "open_nodes",
        description: "RETRIEVE specific ENTITIES by exact names along with their interconnections. Returns detailed information about the specified entities and relationships between them. Requires knowing exact entity names.",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Array of exact entity names to retrieve with their details and interconnections",
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["names"],
        },
      },
      {
        name: "add_tags",
        description: "ADD categorical TAGS to existing entities for filtering and organization. Tags are case-sensitive exact-match labels used for quick retrieval with search_knowledge. Common categories: status, priority, type, domain.",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "Array of tag updates specifying which tags to add to which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Exact name of existing entity to tag" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of tags to add (case-sensitive, exact-match labels)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },
      {
        name: "remove_tags",
        description: "REMOVE specific TAGS from existing entities to maintain accurate categorization. Use for status updates, priority changes, or cleaning up outdated classifications. Tags must match exactly (case-sensitive).",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "Array of tag removal requests specifying which tags to remove from which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Exact name of entity to update" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of exact tags to remove (case-sensitive, must match existing tags)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project_id: {
              type: "string",
              description: "Project identifier for data isolation. Must be consistent across all calls in a conversation",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },

    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  // Extract project parameter from args if present
  const project = args.project_id as string | undefined;

  switch (name) {
    case "search_knowledge": {
      // Check if exactTags is provided for tag-only search
      const hasExactTags = args.exactTags && Array.isArray(args.exactTags) && args.exactTags.length > 0;

      // Handle multiple queries - allow empty/undefined query if exactTags is provided
      let queries: string[];
      if (args.query === undefined || args.query === null) {
        if (hasExactTags) {
          queries = [""]; // Use empty string for tag-only search
        } else {
          return { content: [{ type: "text", text: "❌ ERROR: Query parameter is required when exactTags is not provided" }] };
        }
      } else {
        queries = Array.isArray(args.query) ? args.query : [args.query as string];
      }

      // Validate queries - allow empty strings only when exactTags is provided
      if (queries.length === 0 || queries.some((q: any) => typeof q !== 'string' || (!hasExactTags && q.trim() === ''))) {
        return { content: [{ type: "text", text: "❌ ERROR: Query must be a non-empty string or array of non-empty strings when exactTags is not provided" }] };
      }

      // Validate pagination parameters
      const page = args.page !== undefined ? args.page as number : 0;
      const pageSize = args.pageSize !== undefined ? args.pageSize as number : 100;

      if (typeof page !== 'number' || page < 0 || !Number.isInteger(page)) {
        return { content: [{ type: "text", text: "❌ ERROR: Page must be a non-negative integer (0, 1, 2, ...)" }] };
      }

      if (typeof pageSize !== 'number' || pageSize < 1 || pageSize > 1000 || !Number.isInteger(pageSize)) {
        return { content: [{ type: "text", text: "❌ ERROR: PageSize must be an integer between 1 and 1000" }] };
      }

      // Set up pagination options
      const paginationOptions = { page, pageSize };

      let searchType = "";
      const isMultipleQueries = queries.length > 1;

      // Determine search options and type
      let searchOptions: any = {};
      if (args.exactTags && Array.isArray(args.exactTags) && args.exactTags.length > 0) {
        // Exact tag search mode
        searchOptions = {
          exactTags: args.exactTags as string[],
          tagMatchMode: (args.tagMatchMode as 'any' | 'all') || 'any'
        };
        searchType = isMultipleQueries ? `tag search (${args.exactTags.join(', ')}) for ${queries.length} queries` : `tag search (${args.exactTags.join(', ')})`;
      } else if (args.searchMode === 'fuzzy') {
        // Fuzzy search mode
        searchOptions = {
          searchMode: 'fuzzy' as const,
          fuzzyThreshold: args.fuzzyThreshold as number || 0.3
        };
        searchType = isMultipleQueries ? `fuzzy search for ${queries.length} queries` : `fuzzy search "${queries[0]}"`;
      } else {
        // General text search mode (exact)
        searchType = isMultipleQueries ? `exact search for ${queries.length} queries` : `exact search "${queries[0]}"`;
      }

      // Use paginated search
      const paginatedResult = await knowledgeGraphManager.searchNodesPaginated(
        queries.length === 1 ? queries[0] : queries,
        paginationOptions,
        searchOptions,
        project
      );

      const entityCount = paginatedResult.entities.length;
      const relationCount = paginatedResult.relations.length;
      const { pagination } = paginatedResult;

      let successMsg = `🔍 SEARCH RESULTS: Found ${entityCount} entities, ${relationCount} relations (${searchType})`;

      // Add pagination information
      successMsg += `\n📄 PAGE ${pagination.currentPage + 1} of ${pagination.totalPages} (${pagination.totalCount} total entities, ${pageSize} per page)`;

      if (pagination.hasNextPage) {
        successMsg += `\n➡️ NEXT PAGE: Use page=${pagination.currentPage + 1} to see more results`;
      }

      if (pagination.hasPreviousPage) {
        successMsg += `\n⬅️ PREVIOUS PAGE: Use page=${pagination.currentPage - 1} to see previous results`;
      }

      if (isMultipleQueries) {
        successMsg += `\n📋 QUERIES: [${queries.map((q: string) => `"${q}"`).join(', ')}]`;
      }

      if (pagination.totalCount === 0) {
        successMsg += "\n💡 TIP: Try fuzzy search or check spelling. Use search_knowledge(searchMode='fuzzy')";
      } else if (pagination.totalCount > 100) {
        successMsg += "\n⚠️ MANY RESULTS: Consider adding tags for filtering. Use exactTags=['category']";
      }

      // Prepare the result object
      const result = {
        entities: paginatedResult.entities,
        relations: paginatedResult.relations,
        pagination: pagination
      };

      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "create_entities": {
      const entities = args.entities as Entity[];
      const result = await knowledgeGraphManager.createEntities(entities, project);
      const successMsg = `✅ SUCCESS: Created ${result.length} entities`;
      let nextSteps = result.length > 0 ? "\n🔍 NEXT STEPS: 1) Add relations with create_relations 2) Add status tags with add_tags" : "";

      // Add warning message when only a single entity is created
      if (entities.length === 1) {
        nextSteps += "\n⚠️ NOTE: For multiple entities, use a single batch call to create_entities.";
      }

      return { content: [{ type: "text", text: `${successMsg}${nextSteps}` }] };
    }
    case "add_observations": {
      const result = await knowledgeGraphManager.addObservations(args.observations as { entityName: string; observations: string[] }[], project);
      const totalAdded = result.reduce((sum, r) => sum + r.addedObservations.length, 0);
      const successMsg = `✅ SUCCESS: Added ${totalAdded} observations to ${result.length} entities`;
      return { content: [{ type: "text", text: `${successMsg}` }] };
    }
    case "create_relations": {
      const result = await knowledgeGraphManager.createRelations(args.relations as Relation[], project);
      const successMsg = `✅ SUCCESS: Created ${result.newRelations.length} relations`;

      let detailsMsg = "";
      if (result.skippedRelations.length > 0) {
        detailsMsg += `\n⚠️ SKIPPED: ${result.skippedRelations.length} duplicate relations:`;
        result.skippedRelations.forEach(skip => {
          detailsMsg += `\n   • ${skip.reason}`;
        });
      }

      if (result.totalRequested > 1) {
        detailsMsg += `\n📊 SUMMARY: ${result.newRelations.length} created, ${result.skippedRelations.length} skipped, ${result.totalRequested} total requested`;
      }

      const nextSteps = result.newRelations.length > 0 ? "\n🔍 NEXT STEPS: Use search_knowledge to explore connected entities" : "";
      return { content: [{ type: "text", text: `${successMsg}${detailsMsg}${nextSteps}` }] };
    }
    case "delete_entities": {
      const entityNames = args.entityNames as string[];
      await knowledgeGraphManager.deleteEntities(entityNames, project);
      return { content: [{ type: "text", text: `✅ SUCCESS: Deleted ${entityNames.length} entities and all their relations\n⚠️ WARNING: This action cannot be undone` }] };
    }
    case "delete_observations": {
      const deletions = args.deletions as { entityName: string; observations: string[] }[];
      await knowledgeGraphManager.deleteObservations(deletions, project);
      const totalDeleted = deletions.reduce((sum, d) => sum + d.observations.length, 0);
      return { content: [{ type: "text", text: `✅ SUCCESS: Deleted ${totalDeleted} observations from ${deletions.length} entities` }] };
    }
    case "delete_relations": {
      const relations = args.relations as Relation[];
      await knowledgeGraphManager.deleteRelations(relations, project);
      return { content: [{ type: "text", text: `✅ SUCCESS: Deleted ${relations.length} relations\n🔗 NOTE: Entities remain unchanged` }] };
    }
    case "read_graph": {
      const result = await knowledgeGraphManager.readGraph(project);
      const entityCount = result.entities.length;
      const relationCount = result.relations.length;
      const successMsg = `📊 GRAPH OVERVIEW: ${entityCount} entities, ${relationCount} relations`;
      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
    }

    case "open_nodes": {
      const result = await knowledgeGraphManager.openNodes(args.names as string[], project);
      const entityCount = result.entities.length;
      const relationCount = result.relations.length;
      const successMsg = `📋 RETRIEVED: ${entityCount} entities with ${relationCount} interconnections`;
      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "add_tags": {
      const result = await knowledgeGraphManager.addTags(args.updates as { entityName: string; tags: string[] }[], project);
      const totalAdded = result.reduce((sum, r) => sum + r.addedTags.length, 0);
      const successMsg = `🏷️ SUCCESS: Added ${totalAdded} tags to ${result.length} entities`;
      const nextSteps = totalAdded > 0 ? "\n🔍 NEXT STEPS: Use search_knowledge(exactTags=['tag']) to find tagged entities" : "";
      return { content: [{ type: "text", text: `${successMsg}${nextSteps}` }] };
    }
    case "remove_tags": {
      const result = await knowledgeGraphManager.removeTags(args.updates as { entityName: string; tags: string[] }[], project);
      const totalRemoved = result.reduce((sum, r) => sum + r.removedTags.length, 0);
      const successMsg = `🏷️ SUCCESS: Removed ${totalRemoved} tags from ${result.length} entities`;
      return { content: [{ type: "text", text: `${successMsg}` }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  try {
    // Initialize the knowledge graph manager
    knowledgeGraphManager = new KnowledgeGraphManager();

    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down gracefully...');
      await knowledgeGraphManager.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      await knowledgeGraphManager.close();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Knowledge Graph MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

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
        name: "create_entities",
        description: "CREATE new entities (people, concepts, objects) in knowledge graph. Use for entities that don't exist yet. CONSTRAINT: Each entity MUST have ≥1 non-empty observation. BEHAVIOR: Ignores entities with existing names (use add_observations to update).",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              description: "Array of entity objects. Each entity must have at least one observation.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Unique identifier, non-empty (e.g., 'John Smith', 'React.js', 'Project Alpha')" },
                  entityType: { type: "string", description: "Category, non-empty (e.g., 'person', 'technology', 'project', 'company', 'concept')" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Facts about entity. REQUIRED: Must contain ≥1 non-empty string (e.g., ['Software engineer at Google', 'Lives in San Francisco'])"
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional exact-match labels for filtering (e.g., ['urgent', 'technical', 'completed'])"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "CONNECT entities to enable powerful queries and discovery. IMMEDIATE BENEFITS: Find all people at a company, all projects using a technology, all dependencies. CRITICAL for: team structures, project dependencies, technology stacks. EXAMPLES: 'John works_at Google', 'React depends_on JavaScript', 'Project_Alpha managed_by Sarah'.",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              description: "Array of relationship objects to create between entities",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Source entity name (must exist)" },
                  to: { type: "string", description: "Target entity name (must exist)" },
                  relationType: { type: "string", description: "Relationship type in active voice (e.g., 'works_at', 'manages', 'created_by', 'depends_on')" },
                },
                required: ["from", "to", "relationType"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "add_observations",
        description: "ADD factual observations to existing entities. REQUIREMENT: Target entity must exist, ≥1 non-empty observation per update. BEST PRACTICE: Keep observations atomic and specific.",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              description: "Array of observation updates to add to existing entities. Each update must contain at least one observation.",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Target entity name (must exist)" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "New facts to add. REQUIRED: Must contain ≥1 non-empty string"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "PERMANENTLY DELETE entities and all their relationships. WARNING: Cannot be undone, cascades to remove all connections. USE CASE: Entities no longer relevant or created in error.",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to delete"
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "REMOVE specific observations from entities while keeping entities intact. USE CASE: Correct misinformation or remove obsolete details. PRESERVATION: Entity and other observations remain unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              description: "Array of observation deletion requests specifying which observations to remove from entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Target entity name" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific observations to remove"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "UPDATE relationship structure when connections change. CRITICAL for: job changes (remove old 'works_at'), project completion (remove 'assigned_to'), technology migration (remove old 'uses'). MAINTAINS accurate network structure. WORKFLOW: Always remove outdated relations to prevent confusion.",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Source entity name" },
                  to: { type: "string", description: "Target entity name" },
                  relationType: { type: "string", description: "Exact relationship type to remove" },
                },
                required: ["from", "to", "relationType"],
              },
              description: "Array of relations to delete"
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "RETRIEVE complete knowledge graph with all entities and relationships. USE CASE: Full overview, understanding current state, seeing all connections. SCOPE: Returns everything in specified project.",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
        },
      },
      {
        name: "search_nodes",
        description: "SEARCH entities by text or tags. MANDATORY STRATEGY: 1) Try searchMode='exact' first 2) If no results, use searchMode='fuzzy' 3) If still empty, lower fuzzyThreshold to 0.1. EXACT MODE: Perfect substring matches. FUZZY MODE: Similar/misspelled terms. TAG SEARCH: Use exactTags for precise category filtering.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Text to search for across entity names, types, observations, and tags (e.g., 'JavaScript', 'Google employee', 'urgent tasks')" },
            exactTags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for exact-match searching (case-sensitive). When provided, general query is ignored. Use for category filtering."
            },
            tagMatchMode: {
              type: "string",
              enum: ["any", "all"],
              description: "For exactTags: 'any'=entities with ANY tag, 'all'=entities with ALL tags (default: any)"
            },
            searchMode: {
              type: "string",
              enum: ["exact", "fuzzy"],
              description: "EXACT: substring matching (fast, precise). FUZZY: similarity matching (slower, broader). DEFAULT: exact. Use fuzzy only if exact returns no results."
            },
            fuzzyThreshold: {
              type: "number",
              minimum: 0.0,
              maximum: 1.0,
              description: "Fuzzy similarity threshold. 0.3=default, 0.1=very broad, 0.7=very strict. Lower values find more results."
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["query"],
        },
      },
      {
        name: "open_nodes",
        description: "RETRIEVE specific entities by exact names with their interconnections. RETURNS: Requested entities plus relationships between them. USE CASE: When you know exact entity names and want detailed info.",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to retrieve",
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["names"],
        },
      },
      {
        name: "add_tags",
        description: "ADD status/category tags for INSTANT filtering. IMMEDIATE BENEFIT: Find entities by status (urgent, completed, in-progress) or type (technical, personal). REQUIRED for efficient project management and quick retrieval. EXAMPLES: ['urgent', 'completed', 'bug', 'feature', 'personal'].",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "Array of tag addition requests specifying which tags to add to which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Target entity name (must exist)" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags to add (exact-match, case-sensitive)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },
      {
        name: "remove_tags",
        description: "UPDATE entity status by removing outdated tags. CRITICAL for status tracking: remove 'in-progress' when completed, 'urgent' when resolved. MAINTAINS clean search results. WORKFLOW: Always remove old status tags when adding new ones.",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "Array of tag removal requests specifying which tags to remove from which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "Target entity name" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags to remove (exact-match, case-sensitive)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project: {
              type: "string",
              description: "Project identifier for data isolation. Use normalized workspace name (e.g., 'my_app')",
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
  const project = args.project as string | undefined;

  switch (name) {
    case "create_entities": {
      const result = await knowledgeGraphManager.createEntities(args.entities as Entity[], project);
      const successMsg = `✅ SUCCESS: Created ${result.length} entities`;
      const nextSteps = result.length > 0 ? "\n🔗 NEXT STEPS: 1) Add relations with create_relations 2) Add status tags with add_tags" : "";
      return { content: [{ type: "text", text: `${successMsg}${nextSteps}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "create_relations": {
      const result = await knowledgeGraphManager.createRelations(args.relations as Relation[], project);
      const successMsg = `✅ SUCCESS: Created ${result.length} relations`;
      const nextSteps = result.length > 0 ? "\n🔍 NEXT STEPS: Use search_nodes to explore connected entities" : "";
      return { content: [{ type: "text", text: `${successMsg}${nextSteps}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "add_observations": {
      const result = await knowledgeGraphManager.addObservations(args.observations as { entityName: string; observations: string[] }[], project);
      const totalAdded = result.reduce((sum, r) => sum + r.addedObservations.length, 0);
      const successMsg = `✅ SUCCESS: Added ${totalAdded} observations to ${result.length} entities`;
      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
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
    case "search_nodes": {
      let result;
      let searchType = "";

      if (args.exactTags && Array.isArray(args.exactTags) && args.exactTags.length > 0) {
        // Exact tag search mode
        const options = {
          exactTags: args.exactTags as string[],
          tagMatchMode: (args.tagMatchMode as 'any' | 'all') || 'any'
        };
        result = await knowledgeGraphManager.searchNodes(args.query as string, options, project);
        searchType = `tag search (${args.exactTags.join(', ')})`;
      } else if (args.searchMode === 'fuzzy') {
        // Fuzzy search mode
        const options = {
          searchMode: 'fuzzy' as const,
          fuzzyThreshold: args.fuzzyThreshold as number || 0.3
        };
        result = await knowledgeGraphManager.searchNodes(args.query as string, options, project);
        searchType = `fuzzy search "${args.query}"`;
      } else {
        // General text search mode (exact)
        result = await knowledgeGraphManager.searchNodes(args.query as string, project);
        searchType = `exact search "${args.query}"`;
      }

      const entityCount = result.entities.length;
      const relationCount = result.relations.length;
      let successMsg = `🔍 SEARCH RESULTS: Found ${entityCount} entities, ${relationCount} relations (${searchType})`;

      if (entityCount === 0) {
        successMsg += "\n💡 TIP: Try fuzzy search or check spelling. Use search_nodes(searchMode='fuzzy')";
      } else if (entityCount > 20) {
        successMsg += "\n⚠️ MANY RESULTS: Consider adding tags for filtering. Use exactTags=['category']";
      }

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
      const nextSteps = totalAdded > 0 ? "\n🔍 NEXT STEPS: Use search_nodes(exactTags=['tag']) to find tagged entities" : "";
      return { content: [{ type: "text", text: `${successMsg}${nextSteps}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "remove_tags": {
      const result = await knowledgeGraphManager.removeTags(args.updates as { entityName: string; tags: string[] }[], project);
      const totalRemoved = result.reduce((sum, r) => sum + r.removedTags.length, 0);
      const successMsg = `🏷️ SUCCESS: Removed ${totalRemoved} tags from ${result.length} entities`;
      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
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

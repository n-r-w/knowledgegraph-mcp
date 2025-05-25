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
        description: "Create new entities (people, concepts, objects) in the knowledge graph. Use this when you encounter new information about entities that don't exist yet. Entities with existing names will be ignored (use add_observations to update existing entities).",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              description: "An array of entities to create in the knowledge graph",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Unique identifier for the entity (e.g., 'John Smith', 'React.js', 'Project Alpha')" },
                  entityType: { type: "string", description: "Category of the entity (e.g., 'person', 'technology', 'project', 'company', 'concept')" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of factual statements about this entity (e.g., ['Software engineer at Google', 'Lives in San Francisco'])"
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional categorical labels for filtering and organization (e.g., ['urgent', 'technical', 'completed'])"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create relationships between existing entities (e.g., 'John works_at Google', 'React uses JavaScript'). Use this to connect entities with meaningful relationships. Both entities must exist first. Use active voice for relation types (e.g., 'manages', 'created_by', 'depends_on').",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              description: "An array of relations to create between entities in the knowledge graph",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Name of the source entity (must exist in the knowledge graph)" },
                  to: { type: "string", description: "Name of the target entity (must exist in the knowledge graph)" },
                  relationType: { type: "string", description: "Relationship type in active voice (e.g., 'works_at', 'manages', 'created_by', 'depends_on', 'located_in')" },
                },
                required: ["from", "to", "relationType"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "add_observations",
        description: "Add new factual information to existing entities. Use this to record specific facts, details, or updates about entities you've already created. Each observation should be a single, atomic fact. Don't duplicate existing observations.",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              description: "An array of observation updates to add to existing entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observations to add"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "Permanently remove entities and all their relationships from the knowledge graph. Use this when entities are no longer relevant or were created in error. This cascades to delete all relations involving these entities. Use with caution - this cannot be undone.",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to delete"
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "Remove specific outdated or incorrect facts from entities while keeping the entities themselves. Use this to correct misinformation or remove obsolete details. The entity remains with its other observations and relationships intact.",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              description: "An array of observation deletion requests specifying which observations to remove from entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "Remove specific relationships between entities while keeping the entities themselves. Use this when relationships change or were incorrectly established (e.g., someone changes jobs, a project ends). Entities remain unaffected.",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
              description: "An array of relations to delete"
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "Retrieve the complete knowledge graph with all entities and relationships. Use this to get a full overview of stored knowledge, understand the current state, or when you need to see all connections. Returns everything in the specified project.",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
        },
      },
      {
        name: "search_nodes",
        description: "Find entities by text search or tags. Use this to locate specific information before reading, updating, or connecting entities. Searches across entity names, types, observations, and tags. Use exact search for precise matches or fuzzy search for similar terms.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Text to search for across entity names, types, observations, and tags (e.g., 'JavaScript', 'Google employee', 'urgent tasks')" },
            exactTags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for exact-match searching (case-sensitive). When provided, general query is ignored."
            },
            tagMatchMode: {
              type: "string",
              enum: ["any", "all"],
              description: "For exact tag search: 'any' finds entities with ANY of the tags, 'all' finds entities with ALL tags (default: any)"
            },
            searchMode: {
              type: "string",
              enum: ["exact", "fuzzy"],
              description: "Search mode: 'exact' for traditional exact matching, 'fuzzy' for fuzzy search (default: exact)"
            },
            fuzzyThreshold: {
              type: "number",
              minimum: 0.0,
              maximum: 1.0,
              description: "Fuzzy search threshold (0.0 to 1.0, lower is more strict, default: 0.3)"
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["query"],
        },
      },
      {
        name: "open_nodes",
        description: "Retrieve specific entities by their exact names along with their relationships to other requested entities. Use this when you know the exact entity names and want detailed information about them and how they connect to each other.",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["names"],
        },
      },
      {
        name: "add_tags",
        description: "Add categorical labels to entities for better organization and filtering. Use this to categorize entities (e.g., 'urgent', 'completed', 'person', 'technical'). Tags enable efficient exact-match searching and grouping of related entities.",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "An array of tag addition requests specifying which tags to add to which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add tags to" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of tags to add (exact-match, case-sensitive)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },
      {
        name: "remove_tags",
        description: "Remove categorical labels from entities when they're no longer applicable (e.g., remove 'in-progress' when task is completed, remove 'urgent' when priority changes). The entity and its other tags remain unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            updates: {
              type: "array",
              description: "An array of tag removal requests specifying which tags to remove from which entities",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to remove tags from" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of tags to remove (exact-match, case-sensitive)"
                  }
                },
                required: ["entityName", "tags"],
              },
            },
            project: {
              type: "string",
              description: "Project name to isolate data (optional, overrides KNOWLEDGEGRAPH_PROJECT env var)",
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
    case "create_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createEntities(args.entities as Entity[], project), null, 2) }] };
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createRelations(args.relations as Relation[], project), null, 2) }] };
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addObservations(args.observations as { entityName: string; observations: string[] }[], project), null, 2) }] };
    case "delete_entities":
      await knowledgeGraphManager.deleteEntities(args.entityNames as string[], project);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    case "delete_observations":
      await knowledgeGraphManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[], project);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    case "delete_relations":
      await knowledgeGraphManager.deleteRelations(args.relations as Relation[], project);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    case "read_graph":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.readGraph(project), null, 2) }] };
    case "search_nodes":
      // Handle exact tag search, fuzzy search, and general search
      if (args.exactTags && Array.isArray(args.exactTags) && args.exactTags.length > 0) {
        // Exact tag search mode
        const options = {
          exactTags: args.exactTags as string[],
          tagMatchMode: (args.tagMatchMode as 'any' | 'all') || 'any'
        };
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string, options, project), null, 2) }] };
      } else if (args.searchMode === 'fuzzy') {
        // Fuzzy search mode
        const options = {
          searchMode: 'fuzzy' as const,
          fuzzyThreshold: args.fuzzyThreshold as number || 0.3
        };
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string, options, project), null, 2) }] };
      } else {
        // General text search mode (exact)
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string, project), null, 2) }] };
      }
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.openNodes(args.names as string[], project), null, 2) }] };
    case "add_tags":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addTags(args.updates as { entityName: string; tags: string[] }[], project), null, 2) }] };
    case "remove_tags":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.removeTags(args.updates as { entityName: string; tags: string[] }[], project), null, 2) }] };

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

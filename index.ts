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
        description: "🔍 START HERE - Always search first to check if entities exist before creating. WHEN TO USE: 'I need to find information about X' or 'Does X already exist?'. DECISION TREE: 1) Looking for specific entities? → Use query with searchMode='exact' 2) No exact results? → Retry with searchMode='fuzzy' 3) Still no results? → Lower fuzzyThreshold to 0.1 4) Looking by category? → Use exactTags instead of query. MANDATORY STRATEGY: exact → fuzzy → lower threshold. AVOID: Starting with fuzzy search (slower and less precise).",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["query"],
        },
      },
      {
        name: "create_entities",
        description: "🆕 CREATE new entities ONLY after search_knowledge confirms they don't exist. WHEN TO USE: search_knowledge returned empty results for new entities you need. VALIDATION CHECKLIST: ✓ Each entity has ≥1 non-empty observation ✓ Entity names are unique and descriptive ✓ EntityType is one of: person, technology, project, company, concept, event, preference ✓ Project parameter matches workspace (calculate once, reuse everywhere). IMMEDIATE NEXT STEPS: Add relations and tags to new entities. AVOID: Creating entities that already exist (will be ignored).",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              description: "Array of entity objects. Each entity must have at least one observation.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Unique identifier, non-empty. BEST PRACTICE: Use descriptive, unique identifiers. GOOD: 'John_Smith_Engineer', 'React_v18', 'Sprint_Planning_Q1'. AVOID: 'John', 'React', 'Meeting' (too generic)" },
                  entityType: { type: "string", description: "Category, non-empty. MUST BE ONE OF: 'person', 'technology', 'project', 'company', 'concept', 'event', 'preference'" },
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entities"],
        },
      },
      {
        name: "add_observations",
        description: "📝 ADD factual observations to existing entities. WHEN TO USE: search_knowledge found the entity and you have new information to add. PREREQUISITE: Target entity must exist (verify with search_knowledge first). REQUIREMENT: ≥1 non-empty observation per update. BEST PRACTICE: Keep observations atomic and specific. AVOID: Adding observations to non-existent entities (will fail).",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["observations"],
        },
      },
      {
        name: "create_relations",
        description: "🔗 CONNECT entities that already exist in the graph. WHEN TO USE: You have two existing entities that should be connected. PREREQUISITE VALIDATION: ✓ Both entities exist (verify with search_knowledge first) ✓ Relationship type uses active voice (e.g., 'manages' not 'managed_by') ✓ Relationship makes logical sense (person works_at company, not reverse). COMMON PATTERNS: works_at, manages, depends_on, created_by, assigned_to. AVOID: Creating relations before entities exist (will fail), passive voice relations.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "delete_entities",
        description: "🗑️ PERMANENTLY DELETE entities and all their relationships. WARNING: Cannot be undone, cascades to remove all connections. WHEN TO USE: Entities no longer relevant or created in error. CRITICAL: This is destructive and irreversible. PREREQUISITE: Confirm entities exist and should be deleted. USE CASE: Cleanup, error correction.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "🗑️ REMOVE specific observations from entities while keeping entities intact. WHEN TO USE: Correct misinformation or remove obsolete details. PRESERVATION: Entity and other observations remain unchanged. USE CASE: Data correction, removing outdated information. SAFE: Less destructive than delete_entities.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "🗑️ UPDATE relationship structure when connections change. WHEN TO USE: Relationships become outdated or incorrect. CRITICAL for: job changes (remove old 'works_at'), project completion (remove 'assigned_to'), technology migration (remove old 'uses'). MAINTAINS accurate network structure. WORKFLOW: Always remove outdated relations to prevent confusion. SAFE: Entities remain unchanged.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "📊 RETRIEVE complete knowledge graph with all entities and relationships. WHEN TO USE: Need full overview, understanding current state, seeing all connections. SCOPE: Returns everything in specified project. WARNING: Can be large for big graphs. USE CASE: Initial exploration, debugging, comprehensive analysis.",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
        },
      },
      {
        name: "open_nodes",
        description: "📋 RETRIEVE specific entities by exact names with their interconnections. WHEN TO USE: You know exact entity names and want detailed info about them and their connections. RETURNS: Requested entities plus relationships between them. PREREQUISITE: Entity names must be exact matches. USE CASE: Deep dive into specific entities after finding them with search_knowledge.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["names"],
        },
      },
      {
        name: "add_tags",
        description: "🏷️ ADD status/category tags for INSTANT filtering. WHEN TO USE: After creating entities to categorize them for easy retrieval. IMMEDIATE BENEFIT: Find entities by status (urgent, completed, in-progress) or type (technical, personal). PREREQUISITE: Target entities must exist. REQUIRED for efficient project management and quick retrieval. EXAMPLES: ['urgent', 'completed', 'bug', 'feature', 'personal']. NEXT STEP: Use search_knowledge(exactTags=['tag']) to find tagged entities.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },
      {
        name: "remove_tags",
        description: "🏷️ UPDATE entity status by removing outdated tags. WHEN TO USE: Status changes require tag cleanup (e.g., remove 'in-progress' when completed, 'urgent' when resolved). CRITICAL for status tracking and clean search results. WORKFLOW: Always remove old status tags when adding new ones. MAINTAINS accurate categorization.",
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
              description: "Project identifier for data isolation. CALCULATION RULE: workspace_path → lowercase → remove special chars → underscores. EXAMPLES: '/Users/john/my-app' → 'my_app', 'C:\\Projects\\Web Site' → 'web_site'. CRITICAL: Use SAME project value throughout entire conversation.",
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
    case "search_knowledge": {
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
      let successMsg = `� SEARCH RESULTS: Found ${entityCount} entities, ${relationCount} relations (${searchType})`;

      if (entityCount === 0) {
        successMsg += "\n💡 TIP: Try fuzzy search or check spelling. Use search_knowledge(searchMode='fuzzy')";
      } else if (entityCount > 20) {
        successMsg += "\n⚠️ MANY RESULTS: Consider adding tags for filtering. Use exactTags=['category']";
      }

      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
    case "create_entities": {
      const result = await knowledgeGraphManager.createEntities(args.entities as Entity[], project);
      const successMsg = `✅ SUCCESS: Created ${result.length} entities`;
      const nextSteps = result.length > 0 ? "\n� NEXT STEPS: 1) Add relations with create_relations 2) Add status tags with add_tags" : "";
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
      const successMsg = `✅ SUCCESS: Created ${result.length} relations`;
      const nextSteps = result.length > 0 ? "\n🔍 NEXT STEPS: Use search_knowledge to explore connected entities" : "";
      return { content: [{ type: "text", text: `${successMsg}${nextSteps}` }] };
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

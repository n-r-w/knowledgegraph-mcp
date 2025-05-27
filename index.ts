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
        description: "🔍 START HERE - Always search first to check if entities exist before creating. WHEN TO USE:\n1. EXISTENCE CHECK: 'Does X already exist?'\n2. INFORMATION RETRIEVAL: 'Find facts about X'\n3. MULTIPLE OBJECT SEARCH: 'Find X, Y and Z at once'\n4. CATEGORY FILTERING: 'Find all urgent tasks'\n\nSEARCH STRATEGY FLOWCHART:\n1. EXACT SEARCH (FASTEST): search_knowledge(query='term', searchMode='exact')\n2. MULTIPLE TERMS: search_knowledge(query=['term1', 'term2', 'term3']) for batch search\n3. FUZZY SEARCH (IF EXACT FAILS): search_knowledge(query='term', searchMode='fuzzy')\n4. BROADER SEARCH (LAST RESORT): search_knowledge(query='term', fuzzyThreshold=0.1)\n5. TAG-ONLY SEARCH: search_knowledge(exactTags=['urgent', 'completed']) - NO QUERY NEEDED\n6. TAG + QUERY COMBO: search_knowledge(query='term', exactTags=['category'])\n\nMUST USE BEFORE:\n✓ create_entities: Verify non-existence first\n✓ add_observations: Confirm entity exists first\n✓ create_relations: Verify both entities exist\n\nAVOID: Starting with fuzzy search (slower and less precise)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } }
              ],
              description: "Text to search for across entity names, types, observations, and tags. Can be a single string or array of strings for multiple object search (e.g., 'JavaScript' or ['JavaScript', 'React', 'Node.js']). OPTIONAL when exactTags is provided for tag-only searches."
            },
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: [],
        },
      },
      {
        name: "create_entities",
        description: "🆕 CREATE new entities for persistent memory. WHEN TO USE:\n1. NEW INFORMATION: 'Remember X for future conversations'\n2. AFTER SEARCH FAILS: search_knowledge returned empty results\n3. STRUCTURED DATA: Need to track complex information with relationships\n\nPREREQUISITE CHECKLIST:\n✓ VERIFIED NON-EXISTENCE: Always run search_knowledge first\n✓ VALID ENTITY TYPE: Must be one of: person, technology, project, company, concept, event, preference\n✓ MEANINGFUL OBSERVATIONS: Each entity needs ≥1 specific fact\n✓ DESCRIPTIVE NAMING: Use specific names (e.g., 'John_Smith_Engineer' not just 'John')\n\nNEXT STEPS AFTER CREATION:\n1. create_relations: Connect to other entities\n2. add_tags: Categorize for easy retrieval\n\nAVOID: Creating duplicate entities or using generic names",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entities"],
        },
      },
      {
        name: "add_observations",
        description: "📝 ADD factual observations to existing entities. WHEN TO USE:\n1. UPDATING KNOWLEDGE: 'Add new information about X'\n2. SUPPLEMENTING ENTITIES: 'Remember additional details about X'\n3. TRACKING CHANGES: 'Record that X has changed'\n\nDECISION CRITERIA:\n✓ ENTITY EXISTS: Must verify with search_knowledge first\n✓ NEW INFORMATION: Don't duplicate existing observations\n✓ ATOMIC FACTS: Keep each observation focused on a single fact\n\nINPUT REQUIREMENTS:\n✓ TARGET ENTITY: Must be exact entity name that exists\n✓ OBSERVATIONS: At least one non-empty string per update\n\nEXAMPLES:\n- 'User prefers dark mode' (for a preference entity)\n- 'React v18 released March 2022' (for a technology entity)\n\nAVOID: Adding to non-existent entities or duplicate observations",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["observations"],
        },
      },
      {
        name: "create_relations",
        description: "🔗 CONNECT entities to build relationship network. WHEN TO USE:\n1. ESTABLISHING CONNECTIONS: 'X is related to Y'\n2. DEFINING HIERARCHIES: 'X depends on Y'\n3. OWNERSHIP/ASSIGNMENT: 'X is assigned to Y'\n4. BUILDING KNOWLEDGE GRAPH: After creating multiple entities\n\nPREREQUISITE VALIDATION:\n✓ ENTITY EXISTENCE: Both entities MUST exist (verify with search_knowledge)\n✓ DIRECTIONALITY: Always use active voice relationships\n - CORRECT: 'person works_at company'\n - INCORRECT: 'company employs person'\n✓ SEMANTIC CORRECTNESS: Relationship must make logical sense\n\nCOMMON RELATIONSHIP PATTERNS:\n- works_at: Person → Company\n- manages: Person → Project/Person\n- depends_on: Technology → Technology\n- created_by: Project → Person\n- assigned_to: Task → Person\n- uses: Project → Technology\n\nAVOID: Relations with non-existent entities or illogical connections",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "delete_entities",
        description: "🗑️ PERMANENTLY DELETE entities and all their relationships. WHEN TO USE:\n1. ERROR CORRECTION: 'Remove entity created by mistake'\n2. OUTDATED INFORMATION: 'Delete obsolete entity'\n3. CLEANUP: 'Remove test entities'\n\n⚠️ HIGH-RISK OPERATION: This action is destructive and irreversible\n\nPREREQUISITE SAFETY CHECKS:\n✓ ENTITY EXISTS: Verify with search_knowledge first\n✓ INTENTIONAL DELETION: Confirm this entity should be permanently removed\n✓ CASCADING EFFECTS: All relations involving this entity will also be deleted\n✓ NO ALTERNATIVES: Consider if add_observations or delete_observations would be better\n\nSAFER ALTERNATIVES:\n- delete_observations: To remove specific facts while keeping entity\n- remove_tags: To change entity status without deletion\n\nAVOID: Deleting entities that might be needed later (cannot be recovered)",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to delete"
            },
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "🗑️ SELECTIVELY REMOVE specific facts while preserving entity. WHEN TO USE:\n1. CORRECT ERRORS: 'Fix incorrect information about X'\n2. UPDATE INFORMATION: 'Remove outdated facts about X'\n3. PRECISION EDITING: 'Delete specific details while keeping entity'\n\nSAFETY ADVANTAGES:\n✓ NON-DESTRUCTIVE: Entity remains intact\n✓ SELECTIVE: Only removes specified observations\n✓ PRESERVES RELATIONS: All entity connections remain unchanged\n✓ KEEPS TAGS: Entity categorization remains intact\n\nDECISION CRITERIA:\n✓ ENTITY EXISTS: Verify with search_knowledge first\n✓ SPECIFIC OBSERVATIONS: Know exactly which facts to remove\n✓ PARTIAL UPDATE: Only want to remove some facts, not the entire entity\n\nUSE INSTEAD OF delete_entities WHEN:\n- Information is partially correct (remove only wrong facts)\n- Entity should continue to exist in knowledge graph\n\nAVOID: Removing all observations without deleting entity",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "🗑️ UPDATE relationship network when connections change. WHEN TO USE:\n1. STATUS CHANGES: 'Person no longer works at Company'\n2. PROJECT COMPLETION: 'Task is no longer assigned to Person'\n3. ROLE CHANGES: 'Person no longer manages Project'\n4. DEPENDENCY UPDATES: 'Project no longer uses Technology'\n\nKEY SITUATIONS REQUIRING RELATION UPDATES:\n✓ JOB CHANGES: Remove old 'works_at' relations when someone changes jobs\n✓ PROJECT COMPLETION: Remove 'assigned_to' when tasks are finished\n✓ TECHNOLOGY MIGRATION: Remove 'uses' when systems are upgraded\n✓ RESPONSIBILITY SHIFTS: Remove 'manages' when roles change\n\nDECISION CRITERIA:\n✓ RELATIONSHIP EXISTED: Verify with search_knowledge or read_graph first\n✓ RELATIONSHIP IS OUTDATED: Connection no longer accurate\n✓ ENTITIES STILL VALID: Both entities should continue to exist\n\nSAFETY FEATURES:\n✓ PRESERVES ENTITIES: Both connected entities remain intact\n✓ SELECTIVE REMOVAL: Only specified relations are removed\n✓ DATA INTEGRITY: Maintains accurate knowledge graph\n\nAVOID: Leaving outdated relationships in the knowledge graph",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "📊 RETRIEVE complete knowledge graph with all entities and relationships. WHEN TO USE:\n1. FULL OVERVIEW: 'Show me everything in the knowledge graph'\n2. INITIAL EXPLORATION: 'What information is already stored?'\n3. DEBUGGING: 'Why aren't my queries finding expected entities?'\n4. RELATIONSHIP ANALYSIS: 'Show all connections between entities'\n\nKEY USE CASES:\n✓ INITIAL ASSESSMENT: When first working with a project\n✓ COMPREHENSIVE ANALYSIS: When relationships matter\n✓ DEBUGGING SEARCH ISSUES: When search_knowledge isn't finding expected results\n✓ RELATIONSHIP MAPPING: When understanding connections is important\n\nSCOPE & PERFORMANCE:\n✓ RETURNS EVERYTHING: All entities and their relationships in the project\n✓ POTENTIAL LARGE RESPONSE: Can be significant for projects with many entities\n✓ COMPREHENSIVE VIEW: Shows the complete network structure\n\n⚠️ USAGE NOTES:\n- Use search_knowledge for targeted searches instead when possible\n- Use open_nodes for specific entity details when you know their names\n- For large graphs, consider using search_knowledge with tags for filtering",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
        },
      },
      {
        name: "open_nodes",
        description: "📋 RETRIEVE specific entities by exact names with their interconnections. WHEN TO USE:\n1. TARGETED INSPECTION: 'Show me details about entities X, Y, and Z'\n2. RELATIONSHIP ANALYSIS: 'How are these specific entities connected?'\n3. DETAILED EXAMINATION: After finding entities with search_knowledge\n4. CROSS-ENTITY EXPLORATION: When investigating connections between known entities\n\nKEY BENEFITS:\n✓ PRECISE RETRIEVAL: Gets exactly the entities you specify\n✓ RELATIONSHIP FOCUS: Shows how the specified entities are connected\n✓ NETWORK CONTEXT: Reveals the immediate relationship network\n✓ SELECTIVE DEPTH: Gets detailed information without the entire graph\n\nDECISION CRITERIA:\n✓ KNOW ENTITY NAMES: Must know the exact names of entities to retrieve\n✓ WANT CONNECTIONS: Interested in relationships between these entities\n✓ NEED DETAILS: Require complete entity information, not just search results\n\nTYPICAL WORKFLOW:\n1. DISCOVER: Find entities with search_knowledge first\n2. INSPECT: Use open_nodes with exact entity names for details\n3. ANALYZE: Examine relationships between the specific entities\n\nAVOID: Using when you don't know exact entity names (use search_knowledge instead)",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to retrieve",
            },
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["names"],
        },
      },
      {
        name: "add_tags",
        description: "🏷️ ADD categorical tags for INSTANT filtering. WHEN TO USE:\n1. CATEGORIZATION: 'Mark entity X as urgent/completed/etc'\n2. STATUS TRACKING: 'Update task status to in-progress'\n3. TYPE ASSIGNMENT: 'Tag as technical/personal/feature'\n4. PRIORITY MARKING: 'Flag entity as important/urgent'\n\nKEY TAGGING SCENARIOS:\n✓ PROJECT MANAGEMENT: Track task status (urgent, in-progress, completed)\n✓ CONTENT ORGANIZATION: Categorize by type (technical, personal, feature)\n✓ PRIORITY TRACKING: Assign importance (high, medium, low)\n✓ FILTERING PREPARATION: Enable precise searching by tag\n\nCOMMON TAG CATEGORIES:\n- STATUS: ['urgent', 'in-progress', 'completed', 'blocked']\n- TYPE: ['bug', 'feature', 'enhancement', 'technical', 'personal']\n- PRIORITY: ['high', 'medium', 'low']\n- DOMAIN: ['frontend', 'backend', 'database', 'documentation']\n\nQUICK RETRIEVAL:\n- Use search_knowledge(exactTags=['tag']) to instantly find all entities with specific tag\n\nAVOID: Using tags when observations would be more appropriate for descriptive content",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
              pattern: "^[a-zA-Z0-9_-]+$"
            }
          },
          required: ["updates"],
        },
      },
      {
        name: "remove_tags",
        description: "🏷️ REMOVE outdated tags to maintain accurate categorization. WHEN TO USE:\n1. STATUS UPDATES: 'Task is no longer in-progress'\n2. PRIORITY CHANGES: 'Issue is no longer urgent'\n3. CATEGORY CHANGES: 'Project is no longer backend-focused'\n4. TAG CLEANUP: After entity purpose or classification changes\n\nCRITICAL STATUS MANAGEMENT SCENARIOS:\n✓ TASK COMPLETION: Remove 'in-progress' tag when adding 'completed'\n✓ PRIORITY RESOLUTION: Remove 'urgent' tag when issue addressed\n✓ ROLE CHANGES: Remove domain tags when project focus shifts\n✓ CLASSIFICATION CLEANUP: Remove incorrect or outdated categorization\n\nTAG LIFECYCLE MANAGEMENT:\n1. SEARCH entity with search_knowledge to confirm current tags\n2. REMOVE outdated tags with remove_tags\n3. ADD new status tags with add_tags\n\nDECISION CRITERIA:\n✓ TAG EXISTS: Verify entity has the tag before removing\n✓ TAG IS OUTDATED: Status or classification no longer applies\n✓ STATUS TRANSITION: Entity is changing state/category\n\nAVOID: Leaving contradictory tags (e.g., both 'in-progress' and 'completed')",
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
            project_id: {
              type: "string",
              description: "MANDATORY parameter for data isolation. CALCULATION ALGORITHM: 1) EXTRACT last directory segment from path 2) LOWERCASE all characters 3) KEEP only letters, numbers, hyphens, underscores 4) REPLACE spaces and hyphens with underscores. EXAMPLES: '/Users/john/dev/My-App' → 'my_app', 'C:\Projects\Web Site' → 'web_site'. ⚠️ CRITICAL: Calculate ONCE and use EXACT SAME project_id for ALL knowledge graph calls in entire conversation. Data will be LOST if different project_id values are used.",
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

      let allResults: KnowledgeGraph = { entities: [], relations: [] };
      let searchType = "";
      const isMultipleQueries = queries.length > 1;

      // Process each query
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i].trim();
        let result;

        if (args.exactTags && Array.isArray(args.exactTags) && args.exactTags.length > 0) {
          // Exact tag search mode
          const options = {
            exactTags: args.exactTags as string[],
            tagMatchMode: (args.tagMatchMode as 'any' | 'all') || 'any'
          };
          result = await knowledgeGraphManager.searchNodes(query, options, project);
          searchType = isMultipleQueries ? `tag search (${args.exactTags.join(', ')}) for ${queries.length} queries` : `tag search (${args.exactTags.join(', ')})`;
        } else if (args.searchMode === 'fuzzy') {
          // Fuzzy search mode
          const options = {
            searchMode: 'fuzzy' as const,
            fuzzyThreshold: args.fuzzyThreshold as number || 0.3
          };
          result = await knowledgeGraphManager.searchNodes(query, options, project);
          searchType = isMultipleQueries ? `fuzzy search for ${queries.length} queries` : `fuzzy search "${query}"`;
        } else {
          // General text search mode (exact)
          result = await knowledgeGraphManager.searchNodes(query, project);
          searchType = isMultipleQueries ? `exact search for ${queries.length} queries` : `exact search "${query}"`;
        }

        // Merge results with deduplication
        const existingEntityNames = new Set(allResults.entities.map(e => e.name));
        const newEntities = result.entities.filter(e => !existingEntityNames.has(e.name));
        allResults.entities.push(...newEntities);

        // Merge relations with deduplication
        const existingRelations = new Set(allResults.relations.map(r => `${r.from}-${r.relationType}-${r.to}`));
        const newRelations = result.relations.filter(r => !existingRelations.has(`${r.from}-${r.relationType}-${r.to}`));
        allResults.relations.push(...newRelations);
      }

      const entityCount = allResults.entities.length;
      const relationCount = allResults.relations.length;
      let successMsg = `� SEARCH RESULTS: Found ${entityCount} entities, ${relationCount} relations (${searchType})`;

      if (isMultipleQueries) {
        successMsg += `\n📋 QUERIES: [${queries.map((q: string) => `"${q}"`).join(', ')}]`;
      }

      if (entityCount === 0) {
        successMsg += "\n💡 TIP: Try fuzzy search or check spelling. Use search_knowledge(searchMode='fuzzy')";
      } else if (entityCount > 20) {
        successMsg += "\n⚠️ MANY RESULTS: Consider adding tags for filtering. Use exactTags=['category']";
      }

      return { content: [{ type: "text", text: `${successMsg}\n\n${JSON.stringify(allResults, null, 2)}` }] };
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

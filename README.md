# KnowledgeGraph MCP Server

A simple way to give Claude persistent memory across conversations. This server lets Claude remember information about you, your projects, and your preferences using a local knowledge graph.

## Complete Setup Guide

Follow these steps in order to get the knowledge graph working with Claude:

### Step 1: Choose Your Installation Method

**Option A: NPX (Easiest - No download needed)**
```bash
# Test that it works
npx knowledgegraph-mcp --help
```

**Option B: Docker**
```bash
# Clone and build
git clone https://github.com/n-r-w/knowledgegraph-mcp.git
cd knowledgegraph-mcp
docker build -t knowledgegraph-mcp .
```

### Step 2: Choose Your Database

**SQLite (Default - No setup needed):**
- No database installation required
- Database file created automatically in `{home}/.knowledge-graph/`
- Perfect for personal use and most scenarios
- **This is the default backend**

**PostgreSQL (For advanced users):**
- Install PostgreSQL on your system
- Create a database: `CREATE DATABASE knowledgegraph;`
- Better for production use with multiple concurrent users

### Step 3: Configure client

#### Claude Desktop

Edit your Claude Desktop configuration file:

**Find your config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**If you chose NPX + SQLite (default and easiest):**
```json
{
  "mcpServers": {
    "Knowledge Graph": {
      "command": "npx",
      "args": ["-y", "knowledgegraph-mcp"]
    }
  }
}
```

> **Note**: SQLite will automatically create the database in `{home}/.knowledge-graph/knowledgegraph.db`. To use a custom location, add: `"KNOWLEDGEGRAPH_SQLITE_PATH": "/path/to/your/database.db"`

**If you chose Docker + SQLite (default):**
```json
{
  "mcpServers": {
    "Knowledge Graph": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "${HOME}/.knowledge-graph:/app/.knowledge-graph",
        "knowledgegraph-mcp"
      ]
    }
  }
}
```

> **Note**: The volume mount ensures your data persists between Docker runs. For custom paths, add: `-e KNOWLEDGEGRAPH_SQLITE_PATH=/app/.knowledge-graph/custom.db`

**If you chose PostgreSQL:**
```json
{
  "mcpServers": {
    "Knowledge Graph": {
      "command": "npx",
      "args": ["-y", "knowledgegraph-mcp"],
      "env": {
        "KNOWLEDGEGRAPH_STORAGE_TYPE": "postgresql",
        "KNOWLEDGEGRAPH_CONNECTION_STRING": "postgresql://postgres:yourpassword@localhost:5432/knowledgegraph"
      }
    }
  }
}
```

#### VS Code

If you also want to use this with VS Code, add this to your User Settings (JSON) or create `.vscode/mcp.json`:

**Using NPX + SQLite (default):**
```json
{
  "mcp": {
    "servers": {
      "Knowledge Graph": {
        "command": "npx",
        "args": ["-y", "knowledgegraph-mcp"],
      }
    }
  }
}
```

**Using Docker (default SQLite):**
```json
{
  "mcp": {
    "servers": {
      "Knowledge Graph": {
        "command": "docker",
        "args": [
          "run", "-i", "--rm",
          "-e", "KNOWLEDGEGRAPH_CONNECTION_STRING=sqlite://./knowledgegraph.db",
          "knowledgegraph-mcp"
        ]
      }
    }
  }
}
```

**Using Docker + PostgreSQL:**

First, ensure your PostgreSQL database is set up:
```bash
# Create the database (run this once)
psql -h 127.0.0.1 -p 5432 -U postgres -c "CREATE DATABASE knowledgegraph;"
```

Then configure VS Code:
```json
{
  "mcp": {
    "servers": {
      "Knowledge Graph": {
        "command": "docker",
        "args": [
          "run", "-i", "--rm",
          "--network", "host",
          "-e", "KNOWLEDGEGRAPH_STORAGE_TYPE=postgresql",
          "-e", "KNOWLEDGEGRAPH_CONNECTION_STRING=postgresql://postgres:yourpassword@127.0.0.1:5432/knowledgegraph",
          "knowledgegraph-mcp"
        ]
      }
    }
  }
}
```

**Alternative Docker + PostgreSQL (if `--network host` doesn't work):**
```json
{
  "mcp": {
    "servers": {
      "Knowledge Graph": {
        "command": "docker",
        "args": [
          "run", "-i", "--rm",
          "--add-host", "host.docker.internal:host-gateway",
          "-e", "KNOWLEDGEGRAPH_STORAGE_TYPE=postgresql",
          "-e", "KNOWLEDGEGRAPH_CONNECTION_STRING=postgresql://postgres:yourpassword@host.docker.internal:5432/knowledgegraph",
          "knowledgegraph-mcp"
        ]
      }
    }
  }
}
```

> **Important Notes**:
> - Replace `yourpassword` with your actual PostgreSQL password
> - Ensure the `knowledgegraph` database exists before starting
> - If you get connection errors, try the alternative configuration above
> - For troubleshooting Docker + PostgreSQL issues, see the [Common Issues](#common-issues) section

### Step 4: Choose Your LLM System Prompts

Choose the prompt that best fits your LLM integration needs:

- **Prompt 1:** Balanced approach, good for most use cases
- **Prompt 2:** Maximum knowledge capture, best for complex projects
- **Prompt 3:** Minimal overhead, good for simple integrations
- **Prompt 4:** Most powerful, Documents and task management with Knowledge Graph integration

**Customization:**
- Modify entity types based on your domain
- Adjust search strategies for your data patterns
- Add domain-specific tags and relation types

All LLMs behave differently. For some, general instructions are enough, while others need to describe everything in detail.

#### Prompt 1: Standard Integration

```
# Knowledge Graph Integration Protocol

## MANDATORY INITIALIZATION
1. START every conversation: Say `Using knowledgegraph-mcp...` then SEARCH knowledge graph
2. PROJECT ISOLATION: CALCULATE project_id ONCE, use SAME value in ALL calls
   - RULE:
      * workspace_path → lowercase → remove special chars → underscores
      * keep only letters, numbers, spaces, hyphens, including `-` and `_`
   - EXAMPLES: "/Users/john/dev/my-app" → "my_app", "C:\Projects\Web Site" → "web_site"
   - CRITICAL: Use EXACT same project_id value throughout entire conversation

## TOOL SELECTION DECISION TREE
1. **search_knowledge**: ALWAYS START HERE
   - EXISTENCE CHECK: "Does X already exist?" → search_knowledge(query="X")
   - INFORMATION RETRIEVAL: "Find facts about X" → search_knowledge(query="X")
   - MULTIPLE OBJECTS: "Find X, Y, Z at once" → search_knowledge(query=["X", "Y", "Z"])
   - CATEGORY FILTERING: "Find all urgent tasks" → search_knowledge(exactTags=["urgent"])

2. **create_entities**: ONLY AFTER search_knowledge confirms non-existence
   - NEW INFORMATION: "Remember X for future conversations"
   - STRUCTURED DATA: Track complex information with relationships
   - PREREQUISITE: Each entity needs ≥1 specific fact

3. **add_observations**: ONLY AFTER search_knowledge confirms entity exists
   - UPDATING KNOWLEDGE: "Add new information about X"
   - SUPPLEMENTING ENTITIES: "Add details about X"

4. **create_relations**: AFTER entities exist to connect them
   - ESTABLISHING CONNECTIONS: "X is related to Y"
   - DEFINING HIERARCHIES: "X depends on Y"

5. **add_tags/remove_tags**: For status and categorization
   - STATUS TRACKING: "Task is now in-progress" / "Task is no longer in-progress"
   - CATEGORIZATION: "Mark entity as technical" / "Entity is no longer urgent"

## SEARCH STRATEGY FLOWCHART
1. EXACT SEARCH (FASTEST): search_knowledge(query="term", searchMode="exact")
2. MULTIPLE TERMS: search_knowledge(query=["term1", "term2", "term3"]) for batch search
3. FUZZY SEARCH (IF EXACT FAILS): search_knowledge(query="term", searchMode="fuzzy")
4. BROADER SEARCH (LAST RESORT): search_knowledge(query="term", fuzzyThreshold=0.1)
5. CATEGORY SEARCH: search_knowledge(exactTags=["urgent", "completed"])

## COMMON WORKFLOW SEQUENCES

### NEW INFORMATION FLOW:
1. search_knowledge → Check if exists
2. IF NOT EXISTS:
   - create_entities → Create new entity
   - create_relations → Connect to related entities
   - add_tags → Categorize for retrieval
3. IF EXISTS:
   - add_observations → Add new facts
   - create_relations → Add new connections
   - update tags → add_tags/remove_tags

### STATUS UPDATE FLOW:
1. search_knowledge → Find entity
2. remove_tags → Remove old status
3. add_tags → Add new status

## ENTITY CREATION RULES
- CREATE entities for: people, projects, companies, technologies, events, preferences
- ENTITY TYPES: Use "person", "company", "project", "technology", "event", "preference"
- OBSERVATIONS: Each entity MUST have ≥1 specific, atomic fact
- RELATIONS: IMMEDIATELY connect related entities ("works_at", "manages", "uses", "depends_on")
- TAGS: ALWAYS add status/category tags for instant filtering ("urgent", "completed", "in-progress")

## CRITICAL CONSTRAINTS
- NEVER omit project_id parameter
- ALWAYS validate entity existence before adding observations
- DELETE outdated information promptly
- KEEP observations atomic and factual
```

#### Prompt 2: Aggressive Integration

```
# KNOWLEDGE GRAPH MANDATORY PROTOCOL

## COMPREHENSIVE TOOL DECISION FRAMEWORK

### 1. search_knowledge - MANDATORY FIRST ACTION
   - USAGE: START EVERY INTERACTION with knowledge search
   - MULTI-QUERY SUPPORT: search_knowledge(query=["term1", "term2", "term3"])
   - EXACT MATCH PATH: search_knowledge(query="precise_term", searchMode="exact")
   - FUZZY MATCH PATH: search_knowledge(query="approximate_term", searchMode="fuzzy")
   - BROAD MATCH PATH: search_knowledge(query="partial_term", fuzzyThreshold=0.1)
   - TAG FILTER PATH: search_knowledge(exactTags=["urgent", "technical"])

### 2. create_entities - FOR NEW INFORMATION
   - PREREQUISITES: MUST confirm non-existence with search_knowledge first
   - VALIDATION: Each entity MUST have ≥1 observation
   - USAGE: Persist important information for future conversations
   - NAMING: Use specific descriptive names (e.g., "React_v18" not just "React")
   - NEXT STEPS: ALWAYS follow with create_relations and add_tags

### 3. add_observations - FOR EXISTING ENTITIES
   - PREREQUISITES: Entity MUST exist (verify with search_knowledge)
   - USAGE: Add new facts, update information, track changes
   - QUALITY: Keep observations atomic, specific, and factual
   - LIMIT: Only add new information, don't duplicate existing facts

### 4. create_relations - FOR ENTITY CONNECTIONS
   - PREREQUISITES: Both entities MUST exist (verify with search_knowledge)
   - DIRECTIONALITY: Use active voice relationships ("manages" not "managed_by")
   - COMMON PATTERNS: works_at, manages, depends_on, created_by, assigned_to, uses
   - TIMING: Create immediately after entity creation for network building

### 5. add_tags/remove_tags - FOR CATEGORIZATION
   - STATUS TRACKING: Mark entities as urgent, in-progress, completed
   - CATEGORIZATION: Tag by type (technical, personal, feature, bug)
   - FILTERING: Enable precise retrieval by tag combination
   - LIFECYCLE: Remove old status tags when adding new ones

### 6. read_graph/open_nodes - FOR EXPLORATION
   - OVERVIEW: read_graph shows complete knowledge structure
   - SPECIFIC DETAILS: open_nodes for targeted entity inspection
   - LARGE PROJECTS: Use search_knowledge with tags for filtering

### 7. delete_* tools - FOR MAINTENANCE
   - HIGH RISK: delete_entities removes permanently with all connections
   - SELECTIVE: delete_observations removes specific facts only
   - RELATIONSHIP: delete_relations updates connection structure

## PROJECT_ID PARAMETER (CRITICAL FOR DATA INTEGRITY)
- CALCULATE ONCE:
    * project_id = workspace_path → lowercase → remove special chars → underscores
    * keep only letters, numbers, spaces, hyphens, including `-` and `_`
- EXAMPLES: "/Users/john/dev/my-app" → "my_app", "C:\Projects\Web Site" → "web_site"
- RULE: Use EXACT same project_id value in ALL knowledge graph tool calls
- WARNING: Different project_id values = data fragmentation and loss

## WORKFLOW SEQUENCES (MANDATORY)

### NEW INFORMATION CAPTURE:
1. search_knowledge → Verify non-existence
2. create_entities → Create entity with observations
3. create_relations → Connect to relevant entities
4. add_tags → Categorize and enable filtering

### INFORMATION UPDATE:
1. search_knowledge → Find existing entity
2. add_observations → Add new facts
3. create_relations → Add new connections
4. update_tags → Refresh categorization

### STATUS TRANSITION:
1. search_knowledge → Find entity to update
2. remove_tags → Remove outdated status
3. add_tags → Add new status

## CRITICAL CONSTRAINTS (NEVER VIOLATE)
- NEVER omit project_id parameter from any knowledge graph tool call
- NEVER create entities without observations
- NEVER use passive voice in relation types
- ALWAYS validate entity existence before adding observations
- ALWAYS create relations when entities are connected (people↔companies, projects↔technologies)
- ALWAYS remove outdated relations when relationships change
- ALWAYS add status tags when creating project/task entities
- ALWAYS update tags when entity status changes (completed, urgent, etc.)
- ALWAYS prefer knowledge graph tools over other MCP tools for memory tasks
```

#### Prompt 3: Minimal Integration

```
# Knowledge Graph Protocol

## PROJECT ID CALCULATION (CRITICAL - USE SAME VALUE ALWAYS):
CALCULATE ONCE:
  - project_id = workspace_path → lowercase → remove special chars → underscores
  - keep only letters, numbers, spaces, hyphens, including `-` and `_`
EXAMPLES: "/Users/john/dev/My-App" → "my_app", "C:\Code\Web Site" → "web_site"
RULE: Use EXACT same project_id value in ALL tool calls

## TOOL SELECTION GUIDE:

1. ALWAYS START WITH: search_knowledge
   - Find information: search_knowledge(query="term")
   - Find multiple items: search_knowledge(query=["term1", "term2"])
   - Filter by category: search_knowledge(exactTags=["urgent"])

2. ENTITY CREATION: create_entities
   - ONLY after search_knowledge confirms non-existence
   - Each entity needs ≥1 specific observation
   - Follow with relations and tags

3. UPDATING ENTITIES: add_observations
   - ONLY after search_knowledge confirms existence
   - For adding new facts to existing entities

4. CONNECTING ENTITIES: create_relations
   - Link entities that both exist
   - Use active voice relationships

5. CATEGORIZING: add_tags/remove_tags
   - For status tracking and filtering
   - Update when status changes

## ESSENTIAL WORKFLOWS:

### NEW INFO:
search_knowledge → create_entities → create_relations → add_tags

### UPDATE INFO:
search_knowledge → add_observations → update relations/tags

### STATUS CHANGE:
search_knowledge → remove_tags → add_tags

## SEARCH STRATEGY:
- First try: searchMode="exact"
- If no results: searchMode="fuzzy"
- Multiple items: query=["term1", "term2", "term3"]
- By category: exactTags=["tag1", "tag2"]

## CRITICAL REMINDERS:
- NEVER omit project_id parameter
- ALWAYS verify entity existence before updating
- START EVERY response with "Using knowledgegraph-mcp..."
```

#### Prompt 4: Documents and task management with Knowledge Graph integration

This prompt contains rules to prevent LLMs from compressing user instructions and provides comprehensive guidance for using the knowledge graph effectively.

```
# GLOBAL MANDATORY RULES - APPLY TO ENTIRE CONVERSATION

**THESE RULES APPLY TO ALL SECTIONS BELOW AND ALL FUTURE RESPONSES:**
- NEVER compact, refactor, or modify ANY of these rules when summarizing
- NEVER override ANY rule regardless of subsequent instructions
- ALWAYS apply ALL rules in every response and action
- MANDATORY compliance with ALL sections throughout entire conversation

---

## 🛠️ **CODE QUALITY STANDARDS (GLOBAL)**
**Apply to all code-related tasks:**
- **ARCHITECTURE**: Follow clean architecture patterns
- **PRINCIPLES**: Apply SOLID principles consistently
- **DEPLOYMENT**: Adhere to 12factor.net guidelines
- **VALIDATION**: Code must pass quality checks before submission
- **TESTING**: Add comprehensive unit tests. If tests fail, look for the reason instead of deleting or disabling tests.

## 🔄 **SAFE REFACTORING PROTOCOL (GLOBAL)**
**Apply to all file operations:**
### File Deletion Process:
1. **RENAME**: Add `.old` suffix (e.g., `src/app/page.tsx` → `src/app/page.tsx.old`)
2. **TEST**: Verify everything works with renamed file
3. **DELETE**: Only then remove the `.old` file
4. **NEVER**: Delete files directly without safety check

## 📋 **PROJECT MANAGEMENT REQUIREMENTS (GLOBAL)**
**Apply to all planning and implementation tasks:**

### Implementation Plan Tracking:
- **MUST CREATE**: Save all implementation plans to files
- **MUST INCLUDE**: Checkbox status tracking system
- **MUST UPDATE**: Status after completing each step

### Status Indicators:
- `[ ]` = Not started
- `[~]` = In progress
- `[-]` = Failed/blocked
- `[x]` = Completed

### Workflow Rules:
1. **CREATE PLAN**: Always save implementation plans to files
2. **TRACK PROGRESS**: Update checkboxes as work progresses
3. **FINAL UPDATE**: Mark all completed items when plan is finished
4. **NEVER SKIP**: Status updates are mandatory, not optional

## 🧠 **KNOWLEDGE GRAPH TOOL SELECTION FRAMEWORK (GLOBAL)**

### WHEN TO USE EACH TOOL (DECISION TREE)

1. **search_knowledge**: ALWAYS START HERE
   - EXISTENCE CHECK: "Does X already exist?" → search_knowledge(query="X")
   - INFORMATION RETRIEVAL: "Find facts about X" → search_knowledge(query="X")
   - MULTIPLE OBJECTS: "Find X, Y, Z at once" → search_knowledge(query=["X", "Y", "Z"])
   - CATEGORY FILTERING: "Find all urgent tasks" → search_knowledge(exactTags=["urgent"])

2. **create_entities**: ONLY AFTER search_knowledge confirms non-existence
   - NEW INFORMATION: "Remember X for future conversations"
   - STRUCTURED DATA: Track complex information with relationships
   - PREREQUISITE: Each entity needs ≥1 specific fact

3. **add_observations**: ONLY AFTER search_knowledge confirms entity exists
   - UPDATING KNOWLEDGE: "Add new information about X"
   - SUPPLEMENTING ENTITIES: "Remember additional details about X"
   - TRACKING CHANGES: "Record that X has changed"

4. **create_relations**: AFTER entities exist to connect them
   - ESTABLISHING CONNECTIONS: "X is related to Y"
   - DEFINING HIERARCHIES: "X depends on Y"
   - OWNERSHIP/ASSIGNMENT: "X is assigned to Y"
   - BUILDING KNOWLEDGE GRAPH: After creating multiple entities

5. **add_tags/remove_tags**: For status and categorization management
   - STATUS TRACKING: "Task is now in-progress" / "Task is no longer in-progress"
   - CATEGORIZATION: "Mark entity as technical" / "Entity is no longer urgent"
   - FILTERING PREPARATION: Enable efficient search by tag

6. **read_graph/open_nodes**: For exploration and analysis
   - FULL OVERVIEW: "Show me everything" → read_graph
   - SPECIFIC ENTITIES: "Show details about X, Y, Z" → open_nodes

7. **delete_** tools: Use with caution for maintenance
   - CORRECTIONS: For fixing errors
   - CLEANUP: For removing outdated information
   - PREREQUISITE: Verify existence first

### COMMON WORKFLOW SEQUENCES

#### NEW INFORMATION FLOW:
1. search_knowledge → Check if exists
2. IF NOT EXISTS:
   - create_entities → Create new entity
   - create_relations → Connect to related entities
   - add_tags → Categorize for retrieval
3. IF EXISTS:
   - add_observations → Add new facts
   - create_relations → Add new connections
   - update tags → add_tags/remove_tags

#### STATUS UPDATE FLOW:
1. search_knowledge → Find entity
2. remove_tags → Remove old status
3. add_tags → Add new status

#### CLEANUP FLOW:
1. search_knowledge → Find outdated entity
2. delete_observations → Remove wrong facts OR
   delete_relations → Remove outdated connections OR
   delete_entities → Remove completely (last resort)

### PROJECT ISOLATION
1. **CALCULATE project ID ONCE**, use SAME value in ALL calls
   - **STEP-BY-STEP PROJECT ID CALCULATE ALGORITHM**:
      1) **EXTRACT**: Take ONLY the last directory name from workspace path
      2) **LOWERCASE**: Convert all to lowercase
      3) **CLEAN**: Keep only letters, numbers, spaces, hyphens, including `-` and `_`
      4) **UNDERSCORES**: Replace spaces and hyphens with underscores
   - EXAMPLES: "/Users/john/dev/my-app" → "my_app", "C:\Projects\Web Site" → "web_site"
   - CRITICAL: Use EXACT same project_id value throughout entire conversation
   - **AUTOMATICALLY CALCULATE** project_id during first user interaction

### SEARCH STRATEGY FLOWCHART
1. EXACT SEARCH (FASTEST): search_knowledge(query="term", searchMode="exact")
2. MULTIPLE TERMS: search_knowledge(query=["term1", "term2", "term3"]) for batch search
3. FUZZY SEARCH (IF EXACT FAILS): search_knowledge(query="term", searchMode="fuzzy")
4. BROADER SEARCH (LAST RESORT): search_knowledge(query="term", fuzzyThreshold=0.1)
5. CATEGORY SEARCH: search_knowledge(exactTags=["urgent", "completed"])

### ENTITY MANAGEMENT BEST PRACTICES
- **CREATE** entities for valuable persistent information: people, projects, companies, technologies, events, preferences
- **ENTITY TYPES**: Use "person", "company", "project", "technology", "event", "preference"
- **OBSERVATIONS**: Each entity MUST have ≥1 specific, atomic fact
- **RELATIONS**: Connect related entities when relationships matter ("works_at", "manages", "uses", "depends_on")
- **TAGS**: Add status/category tags for efficient filtering ("urgent", "completed", "in-progress", "bug", "feature")
- **CREATE NEW ENTITIES** during first interaction with the project if they don't exist

### INFORMATION CATEGORIES TO TRACK
- People: names, roles, relationships, characteristics
- Organizations: companies, teams, departments
- Projects: goals, status, deadlines, requirements
- Technologies: tools, frameworks, languages
- Events: meetings, milestones, deadlines
- Preferences: user choices, workflows, communication style

### CRITICAL CONSTRAINTS
- NEVER omit project_id parameter
- ALWAYS validate entity existence before adding observations
- DELETE outdated information promptly
- KEEP observations atomic and factual
- **PRIORITIZE** knowledge graph tools over other tools when working with project information

### KNOWLEDGE MANAGEMENT DECISION FRAMEWORK
For each user interaction, ask:
1. **IS THIS INFORMATION VALUABLE LONG-TERM?** If yes, consider storing in knowledge graph
2. **WILL THIS INFORMATION BE NEEDED ACROSS CONVERSATIONS?** If yes, definitely store
3. **DOES THIS RELATE TO EXISTING KNOWLEDGE?** If yes, update or connect to existing entities
4. **IS STRUCTURED RETRIEVAL NEEDED?** If yes, ensure proper tagging and relations

### ⚠️ **PRE-RESPONSE CHECKLIST**
1. **HAVE I PERFORMED SEARCH** in the knowledge graph?
2. **HAVE I USED THE CORRECT project_id**?
3. **HAVE I CREATED/UPDATED ENTITIES** when necessary?
4. **HAVE I ESTABLISHED RELATIONSHIPS** between entities?
5. **HAVE I ADDED TAGS** for efficient searching?
6. **HAVE I STARTED MY RESPONSE** with "Using knowledgegraph-mcp..."?

---

**REMINDER: ALL ABOVE RULES APPLY GLOBALLY TO ENTIRE CONVERSATION**
```

### Step 5: Restart Claude Desktop (or VS Code)

Close and reopen Claude Desktop. You should now see "Knowledge Graph" in your available tools.

### Step 6: Test It Works

**Quick Test Commands for LLMs:**
1. "Remember that I prefer morning meetings" → Creates preference entity
2. "John Smith works at Google as a software engineer" → Creates person + company + relation
3. "Find all people who work at Google" → Tests search and relations
4. "Mark the morning meetings preference as urgent" → Tests tagging

> **Note**: The service includes comprehensive input validation to prevent errors. If you encounter any issues, check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for common solutions.

## How It Works - LLM Power Features

The knowledge graph enables powerful queries through four interconnected concepts:

### 1. Entities - Your Knowledge Nodes
Store people, projects, companies, technologies as searchable entities.

**Real Example - Project Management:**
```json
{
  "name": "Sarah_Chen",
  "entityType": "person",
  "observations": ["Senior React developer", "Leads frontend team", "Available for urgent tasks"],
  "tags": ["developer", "team-lead", "available"]
}
```
**LLM Benefit:** Find "all available team leads" instantly with tag search.

### 2. Relations - Enable Discovery Queries
Connect entities to answer complex questions like "Who works on what?"

**Real Example - Team Structure:**
```json
{
  "from": "Sarah_Chen",
  "to": "Project_Alpha",
  "relationType": "leads"
}
```
**LLM Benefit:** Query "Find all projects Sarah leads" or "Who leads Project Alpha?"

### 3. Observations - Atomic Facts
Store specific, searchable facts about entities.

**Real Examples - Actionable Information:**
- "Available for urgent tasks" → Find available people
- "Uses React 18.2" → Find projects with specific tech
- "Deadline: March 15, 2024" → Find upcoming deadlines

### 4. Tags - Instant Filtering
Enable immediate status and category searches.

**Real Examples - Project Workflow:**
- `["urgent", "in-progress", "frontend"]` → Find urgent frontend tasks
- `["completed", "bug-fix"]` → Track completed bug fixes
- `["available", "senior"]` → Find available senior staff

## Available Tools

The server provides these tools for managing your knowledge graph:

### Data Creation Tools

#### create_entities
**CREATE** new entities (people, concepts, objects) in knowledge graph.
- **WHEN:** Use for entities that don't exist yet
- **CONSTRAINT:** Each entity MUST have ≥1 non-empty observation
- **BEHAVIOR:** Ignores entities with existing names (use add_observations to update)

**Input:**
- `entities` (Entity[]): Array of entity objects. Each REQUIRES:
  - `name` (string): Unique identifier, non-empty
  - `entityType` (string): Category (e.g., 'person', 'project'), non-empty
  - `observations` (string[]): Facts about entity, MUST contain ≥1 non-empty string
  - `tags` (string[], optional): Exact-match labels for filtering
- `project_id` (string, optional): Project name to isolate data

#### create_relations
**CONNECT** entities to enable powerful queries and discovery.
- **IMMEDIATE BENEFITS:** Find all people at a company, all projects using a technology, all dependencies
- **CRITICAL FOR:** Team structures, project dependencies, technology stacks
- **EXAMPLES:** 'John works_at Google', 'React depends_on JavaScript', 'Project_Alpha managed_by Sarah'

**Input:**
- `relations` (Relation[]): Array of relationship objects. Each REQUIRES:
  - `from` (string): Source entity name (must exist)
  - `to` (string): Target entity name (must exist)
  - `relationType` (string): Relationship type in active voice (works_at, manages, depends_on, uses)
- `project_id` (string, optional): Project name to isolate data

#### add_observations
**ADD** factual observations to existing entities.
- **REQUIREMENT:** Target entity must exist, ≥1 non-empty observation per update
- **BEST PRACTICE:** Keep observations atomic and specific

**Input:**
- `observations` (ObservationUpdate[]): Array of observation updates. Each REQUIRES:
  - `entityName` (string): Target entity name (must exist)
  - `observations` (string[]): New facts to add, MUST contain ≥1 non-empty string
- `project_id` (string, optional): Project name to isolate data

#### add_tags
**ADD** status/category tags for INSTANT filtering.
- **IMMEDIATE BENEFIT:** Find entities by status (urgent, completed, in-progress) or type (technical, personal)
- **REQUIRED:** For efficient project management and quick retrieval
- **EXAMPLES:** ['urgent', 'completed', 'bug', 'feature', 'personal']

**Input:**
- `updates` (TagUpdate[]): Array of tag updates. Each REQUIRES:
  - `entityName` (string): Target entity name (must exist)
  - `tags` (string[]): Status/category tags to add (exact-match, case-sensitive)
- `project_id` (string, optional): Project name to isolate data

### Data Retrieval Tools

#### read_graph
**RETRIEVE** complete knowledge graph with all entities and relationships.
- **USE CASE:** Full overview, understanding current state, seeing all connections
- **SCOPE:** Returns everything in specified project

**Input:**
- `project_id` (string, optional): Project name to isolate data

#### search_knowledge
**SEARCH** entities by text or tags. **SUPPORTS MULTIPLE QUERIES** for batch searching.
- **MANDATORY STRATEGY:** 1) Try searchMode='exact' first 2) If no results, use searchMode='fuzzy' 3) If still empty, lower fuzzyThreshold to 0.1
- **EXACT MODE:** Perfect substring matches (fast, precise)
- **FUZZY MODE:** Similar/misspelled terms (slower, broader)
- **TAG SEARCH:** Use exactTags for precise category filtering
- **MULTIPLE QUERIES:** Search for multiple objects in one call with automatic deduplication

**Input:**
- `query` (string | string[]): Search query for text search. Can be a single string or array of strings for multiple object search
- `searchMode` (string, optional): "exact" or "fuzzy" (default: "exact"). Use fuzzy only if exact returns no results
- `fuzzyThreshold` (number, optional): Fuzzy similarity threshold. 0.3=default, 0.1=very broad, 0.7=very strict. Lower values find more results
- `exactTags` (string[], optional): Tags for exact-match searching (case-sensitive). Use for category filtering
- `tagMatchMode` (string, optional): For exactTags: "any"=entities with ANY tag, "all"=entities with ALL tags (default: "any")
- `project_id` (string, optional): Project name to isolate data

**Examples:**
- Single query: `search_knowledge(query="JavaScript", searchMode="exact")`
- Multiple queries: `search_knowledge(query=["JavaScript", "React", "Node.js"], searchMode="fuzzy")`
- Tag search: `search_knowledge(exactTags=["urgent", "bug"], tagMatchMode="all")`

#### open_nodes
**RETRIEVE** specific entities by exact names with their interconnections.
- **RETURNS:** Requested entities plus relationships between them
- **USE CASE:** When you know exact entity names and want detailed info

**Input:**
- `names` (string[]): Array of entity names to retrieve
- `project_id` (string, optional): Project name to isolate data

### Data Management Tools

#### delete_entities
**PERMANENTLY DELETE** entities and all their relationships.
- **WARNING:** Cannot be undone, cascades to remove all connections
- **USE CASE:** Entities no longer relevant or created in error

**Input:**
- `entityNames` (string[]): Array of entity names to delete
- `project_id` (string, optional): Project name to isolate data

#### delete_observations
**REMOVE** specific observations from entities while keeping entities intact.
- **USE CASE:** Correct misinformation or remove obsolete details
- **PRESERVATION:** Entity and other observations remain unchanged

**Input:**
- `deletions` (ObservationDeletion[]): Array of deletion requests. Each REQUIRES:
  - `entityName` (string): Target entity name
  - `observations` (string[]): Specific observations to remove
- `project_id` (string, optional): Project name to isolate data

#### delete_relations
**UPDATE** relationship structure when connections change.
- **CRITICAL FOR:** Job changes (remove old 'works_at'), project completion (remove 'assigned_to'), technology migration (remove old 'uses')
- **MAINTAINS:** Accurate network structure and prevents confusion
- **WORKFLOW:** Always remove outdated relations when creating new ones

**Input:**
- `relations` (Relation[]): Array of relations to delete. Each REQUIRES:
  - `from` (string): Source entity name
  - `to` (string): Target entity name
  - `relationType` (string): Exact relationship type to remove
- `project_id` (string, optional): Project name to isolate data

#### remove_tags
**UPDATE** entity status by removing outdated tags.
- **CRITICAL:** For status tracking - remove 'in-progress' when completed, 'urgent' when resolved
- **MAINTAINS:** Clean search results and accurate status
- **WORKFLOW:** Always remove old status tags when adding new ones

**Input:**
- `updates` (TagUpdate[]): Array of tag removal requests. Each REQUIRES:
  - `entityName` (string): Target entity name
  - `tags` (string[]): Outdated tags to remove (exact-match, case-sensitive)
- `project_id` (string, optional): Project name to isolate data

## Development and Testing

### Multi-Backend Testing

This project includes comprehensive multi-backend testing to ensure compatibility across both SQLite and PostgreSQL:

**Run tests against both backends:**
```bash
npm run test:multi-backend
```

**Run all tests (original + multi-backend):**
```bash
npm run test:all-backends
```

**Using Taskfile (if installed):**
```bash
task test:multi-backend
task test:comprehensive
```

### Development Setup

**Clone and setup:**
```bash
git clone https://github.com/n-r-w/knowledgegraph-mcp.git
cd knowledgegraph-mcp
npm install
npm run build
```

**Run tests:**
```bash
npm test                    # All tests including multi-backend
npm run test:unit          # Unit tests only
npm run test:performance   # Performance benchmarks
```

## Troubleshooting

If you encounter any issues during setup or usage, please refer to our comprehensive [Troubleshooting Guide](docs/TROUBLESHOOTING.md), which covers:

- Input validation errors
- Database connection problems
- Configuration issues
- Docker-related challenges
- Test execution failures
- Performance optimization

The guide includes step-by-step solutions for common problems and diagnostic commands to help identify issues.

## Based on MCP Memory Server

This is an enhanced version of the official [MCP Memory Server](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md) with additional features:

- **Multiple Storage Options**: PostgreSQL (recommended) or SQLite (local file)
- **Project Separation**: Keep different projects isolated
- **Better Search**: Find information with fuzzy search
- **Easy Setup**: Docker support and simple installation

## License

MIT License - Feel free to use, modify, and distribute this software.

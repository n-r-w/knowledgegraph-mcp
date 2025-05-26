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

## CONTEXTUAL USAGE STRATEGY
1. EVALUATE EACH REQUEST: Determine if knowledge graph tools would be beneficial
   - USE WHEN: The information should persist across conversations
   - USE WHEN: Managing complex relationships between entities
   - USE WHEN: Tracking project information or user preferences
   - SKIP WHEN: Simple, one-off questions that don't require persistence
   - SKIP WHEN: Tasks where information is fully contained in current context

2. **PROJECT ID CALCULATION AND USAGE (CRITICAL FOR DATA INTEGRITY)**
   - **CALCULATE ONCE at first knowledge graph usage:**
      1. **EXTRACT**: Take ONLY the last directory name from workspace path
      2. **LOWERCASE**: Convert all to lowercase
      3. **CLEAN**: Keep only letters, numbers, spaces, hyphens, including `-` and `_`
      4. **NORMALIZE**: Replace spaces and hyphens with underscores
   - **EXAMPLES**: 
      * "/Users/john/dev/My-App" → extract "My-App" → lowercase "my-app" → normalize to "my_app"
      * "C:\Projects\Web Site" → extract "Web Site" → lowercase "web site" → normalize to "web_site"
   - **⚠️ CRITICAL WARNINGS**:
      * **ALWAYS** include project_id in EVERY knowledge graph tool call
      * **NEVER** use different project_id values in the same conversation
      * **NEVER** recalculate mid-conversation - this WILL cause data fragmentation

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

## ADAPTIVE KNOWLEDGE MANAGEMENT FRAMEWORK

### WHEN TO USE KNOWLEDGE GRAPH TOOLS
- When information should persist across multiple conversations
- When tracking complex relationships between entities
- When building a structured knowledge base about the project
- When information retrieval would benefit from structured queries
- When user preferences or project details need long-term storage

### WHEN TO SKIP KNOWLEDGE GRAPH TOOLS
- For simple, one-off questions not requiring persistence
- When all needed information is contained in the current context
- When overhead of knowledge management exceeds the benefit
- For basic code operations not tied to project structure

### TOOL SELECTION GUIDE

#### 1. search_knowledge - WHEN RETRIEVING INFORMATION
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

## ⚠️ PROJECT_ID CALCULATION AND USAGE (CRITICAL FOR DATA INTEGRITY)

### STEP-BY-STEP ALGORITHM (EXECUTE EXACTLY AS FOLLOWS):
1. **EXTRACT LAST DIRECTORY SEGMENT** from workspace path:
   - Example: From "/Users/john/dev/My-Project" extract "My-Project"
2. **CONVERT TO LOWERCASE**:
   - Example: "My-Project" becomes "my-project"
3. **CLEAN AND NORMALIZE**:
   - Keep only: letters, numbers, spaces, hyphens, underscores
   - Remove all other special characters
4. **REPLACE SPACES AND HYPHENS WITH UNDERSCORES**:
   - Example: "my-project" becomes "my_project"

### CRITICAL USAGE RULES:
- **CALCULATE ONCE**: At the first decision to use ANY knowledge graph tool
- **STORE VALUE**: Save the calculated project_id for reuse
- **INCLUDE IN ALL CALLS**: EVERY knowledge graph tool call MUST include project_id
- **CONSISTENCY**: Use EXACT SAME project_id value in ALL tool calls
- **NEVER RECALCULATE**: This would cause catastrophic data fragmentation

### WARNING: Failure to follow these rules precisely will result in:
- Data fragmentation across multiple isolated graphs
- Inability to retrieve previously stored information
- Corrupted knowledge relationships
- Potential data loss

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

## ADAPTIVE USAGE GUIDELINES:

### WHEN TO USE KNOWLEDGE GRAPH:
- For information that should persist across conversations
- For tracking relationships between entities
- For creating structured, queryable information
- For managing project data, preferences, or configurations

### WHEN TO SKIP KNOWLEDGE GRAPH:
- For simple questions not requiring persistence
- When information exists only in current context
- For basic code operations or explanations

## ⚠️ PROJECT ID CALCULATION (CRITICAL FOR DATA INTEGRITY):

### PRECISE CALCULATION ALGORITHM:
1. **EXTRACT**: Take ONLY the last directory name from workspace path
   - From: "/Users/john/dev/My-App" extract "My-App"
2. **LOWERCASE**: Convert all characters to lowercase
   - "My-App" becomes "my-app"
3. **CLEAN**: Keep only letters, numbers, spaces, hyphens, underscores
   - Remove all other special characters
4. **NORMALIZE**: Replace spaces and hyphens with underscores
   - "my-app" becomes "my_app"

### EXAMPLES OF CORRECT CALCULATION:
- "/Users/john/dev/My-App" → "my_app"
- "C:\Code\Web Site" → "web_site"
- "/home/user/knowledge-graph-mcp" → "knowledge_graph_mcp"

### CRITICAL USAGE RULES:
- **CALCULATE ONCE**: When first deciding to use knowledge graph
- **REUSE EXACTLY**: Use IDENTICAL project_id in ALL tool calls
- **NEVER OMIT**: ALWAYS include project_id parameter
- **NEVER RECALCULATE**: Would cause permanent data fragmentation

## TOOL SELECTION GUIDE:

1. search_knowledge - FOR RETRIEVING INFORMATION
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

This prompt provides comprehensive guidance on both code quality and knowledge graph usage, with protection against rule compression.

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
- **TESTING**: Add comprehensive unit tests. If tests fail, look for the reason instead of deleting or disabling tests

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

---

## 🧠 **KNOWLEDGE GRAPH CONTEXTUAL USAGE FRAMEWORK**

### WHEN TO USE KNOWLEDGE GRAPH TOOLS
Use knowledge graph tools when ANY of these conditions are met:

**1. EXPLICIT USER REQUEST FOR PERSISTENCE:**
- User asks to remember information for future use
- User references needing information across conversations
- User wants to track or monitor something over time

**2. IMPLICIT INFORMATION VALUE:**
- Technical details that will likely be referenced again
- Project structure or requirements information
- User preferences that affect multiple interactions
- Relationships between components/systems/people

**3. INFORMATION MODIFICATION TRIGGERS:**
- **CREATE (create_entities)**: When discovering NEW important information not in the graph
- **UPDATE (add_observations)**: When learning ADDITIONAL facts about existing entities
- **CONNECT (create_relations)**: When seeing relationships between known entities
- **CATEGORIZE (add_tags)**: When status changes or classification is needed
- **CLEAN (delete_*)**: When information becomes outdated or incorrect

**4. CONVERSATIONAL CONTEXT TRIGGERS:**
- User mentions the same entity multiple times
- Discussion involves complex systems with many components
- Multiple concepts with clear relationships are discussed
- Project status or requirements are mentioned
- Future work or dependencies are discussed

### WHEN TO SKIP KNOWLEDGE GRAPH TOOLS
Do NOT use knowledge graph tools when:
- ONE-TIME QUERY: Simple question with no future reference needed
- CONTAINED CONTEXT: All information exists in current conversation
- CODE OPERATIONS: Basic code tasks unrelated to project structure
- EXCESSIVE OVERHEAD: Benefits don't justify the complexity
- TRIVIAL INFORMATION: Data has little long-term value

### PROACTIVE OPERATIONS EXAMPLES

✅ **SEARCH (search_knowledge)**:
- When user refers to something potentially mentioned before
- Before creating a new entity to avoid duplication
- When needing context about project components

✅ **CREATE (create_entities)**:
- When user mentions a new technology being used
- When user expresses a preference worth remembering
- When important project requirements are discussed
- When new team members or stakeholders are mentioned

✅ **UPDATE (add_observations)**:
- When user provides more details about an existing entity
- When discovering new characteristics of known technologies
- When learning additional user preferences
- When project requirements evolve

✅ **CONNECT (create_relations)**:
- When user mentions how components interact
- When dependencies between technologies are described
- When organizational structure is discussed
- When task assignments are mentioned

✅ **CATEGORIZE (add_tags/remove_tags)**:
- When task status changes (in-progress, completed)
- When priority levels are mentioned
- When categorizing entities by type or domain
- When user expresses urgency about something

✅ **CLEAN (delete_* tools)**:
- When information is explicitly corrected by user
- When project scope changes, making old requirements irrelevant
- When technologies are no longer used
- When relationships between entities change

❌ **SKIP KNOWLEDGE GRAPH FOR**:
- "What's the syntax for Python list comprehension?"
- "Help me debug this function"
- "Explain how Docker works"
- "Format this JSON data correctly"

### TOOL SELECTION GUIDE

1. **search_knowledge**: WHEN RETRIEVING INFORMATION
   - EXISTENCE CHECK: "Does X already exist?" → search_knowledge(query="X")
   - INFORMATION RETRIEVAL: "Find facts about X" → search_knowledge(query="X")
   - MULTIPLE OBJECTS: "Find X, Y, Z at once" → search_knowledge(query=["X", "Y", "Z"])
   - CATEGORY FILTERING: "Find all urgent tasks" → search_knowledge(exactTags=["urgent"])
   - SEARCH PROGRESSION: exact → fuzzy → lower threshold (0.1)

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

## ⚠️ **CRITICAL: PROJECT ID CALCULATION AND USAGE**

### PROJECT ID IS MANDATORY FOR ALL KNOWLEDGE GRAPH OPERATIONS

**CALCULATE PROJECT ID ONCE AND REUSE:**
1. **IMMEDIATELY** calculate project_id at the FIRST determination to use ANY knowledge graph tool
2. **STORE** this value and REUSE the EXACT SAME project_id for ALL subsequent knowledge graph tool calls
3. **NEVER** recalculate project_id mid-conversation - this will cause data fragmentation

### STEP-BY-STEP PROJECT ID CALCULATION ALGORITHM

1. **EXTRACT LAST DIRECTORY SEGMENT** from the workspace path:
   - From: "/Users/john/dev/My-Project-123"
   - Extract: "My-Project-123"

2. **CONVERT TO LOWERCASE**:
   - From: "My-Project-123"
   - To: "my-project-123"

3. **CLEAN & NORMALIZE**:
   - Keep only: letters, numbers, spaces, hyphens, underscores
   - Remove all other special characters

4. **REPLACE SPACES AND HYPHENS WITH UNDERSCORES**:
   - From: "my-project-123"
   - To: "my_project_123"

### EXAMPLES OF CORRECT PROJECT ID CALCULATION

| Original Workspace Path | Extracted Last Segment | Lowercase | Replace Spaces/Hyphens | Final project_id |
|-------------------------|------------------------|-----------|------------------------|------------------|
| /Users/john/dev/My-App | My-App | my-app | my_app | my_app |
| C:\Projects\Web Site 2.0 | Web Site 2.0 | web site 2.0 | web_site_2.0 | web_site_2_0 |
| /home/user/knowledge-graph-mcp | knowledge-graph-mcp | knowledge-graph-mcp | knowledge_graph_mcp | knowledge_graph_mcp |

### CRITICAL WARNINGS

- **ALWAYS** include project_id in EVERY knowledge graph tool call
- **NEVER** use different project_id values in the same conversation
- **NEVER** guess or make up a project_id value
- If unsure about correct calculation, err on the side of using the last path segment with spaces and hyphens replaced by underscores

### HOW TO USE PROJECT ID

In ALL knowledge graph tool calls:
```
search_knowledge(query="term", project_id="your_calculated_project_id")
create_entities(entities=[...], project_id="your_calculated_project_id")
// ALL other knowledge graph tools follow the same pattern
```

### ENTITY GUIDELINES

**TYPES**: Choose appropriate category:
- person: People, roles, contacts
- company: Organizations, teams
- project: Initiatives, goals, milestones
- technology: Tools, languages, frameworks
- event: Meetings, deadlines
- preference: User choices, settings

**NAMING**: Be specific and unique
- GOOD: "React_v18", "John_Smith_Engineer"
- POOR: "React", "John"

**OBSERVATIONS**: Atomic, factual statements
- GOOD: "Released March 2022", "Prefers dark mode"
- POOR: "Very good", "Used in project"

**RELATIONS**: Connect entities with active voice verbs
- GOOD: "person works_at company", "project uses technology"
- POOR: "company employs person", "technology used_by project"

**TAGS**: Add for filtering and status
- STATUS: "urgent", "in-progress", "completed", "blocked"
- TYPE: "bug", "feature", "enhancement", "documentation"
- PRIORITY: "high", "medium", "low"

### COMMON WORKFLOWS

**ADDING NEW INFORMATION**:
1. search_knowledge to check existence
2. If not found:
   - create_entities with observations
   - create_relations to connect to existing entities
   - add_tags for categorization
3. If found:
   - add_observations to update
   - create_relations for new connections

**UPDATING STATUS**:
1. search_knowledge to find entity
2. remove_tags to clear old status
3. add_tags to set new status

**CLEANUP**:
1. search_knowledge to find target
2. For minor corrections: delete_observations
3. For relationship changes: delete_relations
4. For complete removal: delete_entities (use sparingly)

### PRIORITY RULES

1. **USER REQUESTS OVERRIDE DEFAULTS**: Always prioritize explicit user instructions
2. **CONTEXT DETERMINES TOOL USAGE**: Don't use knowledge graph tools when unnecessary
3. **CODE CORRECTNESS OVER DOCUMENTATION**: Working code first, then document in knowledge graph
4. **MINIMAL EFFECTIVE PERSISTENCE**: Store only what will be valuable in future

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

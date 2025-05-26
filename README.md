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

### Step 4: Restart Claude Desktop (or VS Code)

Close and reopen Claude Desktop. You should now see "Knowledge Graph" in your available tools.

### Step 5: Test It Works

In Claude, try saying: "Remember that I prefer morning meetings" and Claude should save this to your knowledge graph.

> **Note**: The service includes comprehensive input validation to prevent errors. If you encounter any issues, check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for common solutions.

## How It Works

The knowledge graph stores information in four simple concepts:

### 1. Entities
Think of entities as the main "things" you want to remember - people, projects, companies, etc.

**Example:**
```json
{
  "name": "John_Smith",
  "entityType": "person",
  "observations": ["Speaks fluent Spanish", "Prefers morning meetings"],
  "tags": ["employee", "team-lead"]
}
```

### 2. Relations
Relations connect entities together, showing how they relate.

**Example:**
```json
{
  "from": "John_Smith",
  "to": "Anthropic",
  "relationType": "works_at"
}
```

### 3. Observations
Observations are individual facts about entities.

**Example:**
- "Speaks fluent Spanish"
- "Graduated in 2019"
- "Prefers morning meetings"

### 4. Tags
Tags help you categorize and quickly find entities.

**Example:**
- `["employee", "team-lead", "multilingual"]`

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
- `project` (string, optional): Project name to isolate data

#### create_relations
**CONNECT** entities with directional relationships.
- **REQUIREMENT:** Both entities must already exist
- **FORMAT:** Use active voice (e.g., 'works_at', 'manages', 'depends_on')

**Input:**
- `relations` (Relation[]): Array of relationship objects. Each REQUIRES:
  - `from` (string): Source entity name (must exist)
  - `to` (string): Target entity name (must exist)
  - `relationType` (string): Relationship type in active voice
- `project` (string, optional): Project name to isolate data

#### add_observations
**ADD** factual observations to existing entities.
- **REQUIREMENT:** Target entity must exist, ≥1 non-empty observation per update
- **BEST PRACTICE:** Keep observations atomic and specific

**Input:**
- `observations` (ObservationUpdate[]): Array of observation updates. Each REQUIRES:
  - `entityName` (string): Target entity name (must exist)
  - `observations` (string[]): New facts to add, MUST contain ≥1 non-empty string
- `project` (string, optional): Project name to isolate data

#### add_tags
**ADD** status/category tags for INSTANT filtering.
- **IMMEDIATE BENEFIT:** Find entities by status (urgent, completed, in-progress) or type (technical, personal)
- **REQUIRED:** For efficient project management and quick retrieval
- **EXAMPLES:** ['urgent', 'completed', 'bug', 'feature', 'personal']

**Input:**
- `updates` (TagUpdate[]): Array of tag updates. Each REQUIRES:
  - `entityName` (string): Target entity name (must exist)
  - `tags` (string[]): Status/category tags to add (exact-match, case-sensitive)
- `project` (string, optional): Project name to isolate data

### Data Retrieval Tools

#### read_graph
**RETRIEVE** complete knowledge graph with all entities and relationships.
- **USE CASE:** Full overview, understanding current state, seeing all connections
- **SCOPE:** Returns everything in specified project

**Input:**
- `project` (string, optional): Project name to isolate data

#### search_nodes
**SEARCH** entities by text or tags.
- **MANDATORY STRATEGY:** 1) Try searchMode='exact' first 2) If no results, use searchMode='fuzzy' 3) If still empty, lower fuzzyThreshold to 0.1
- **EXACT MODE:** Perfect substring matches (fast, precise)
- **FUZZY MODE:** Similar/misspelled terms (slower, broader)
- **TAG SEARCH:** Use exactTags for precise category filtering

**Input:**
- `query` (string): Search query for text search
- `searchMode` (string, optional): "exact" or "fuzzy" (default: "exact"). Use fuzzy only if exact returns no results
- `fuzzyThreshold` (number, optional): Fuzzy similarity threshold. 0.3=default, 0.1=very broad, 0.7=very strict. Lower values find more results
- `exactTags` (string[], optional): Tags for exact-match searching (case-sensitive). Use for category filtering
- `tagMatchMode` (string, optional): For exactTags: "any"=entities with ANY tag, "all"=entities with ALL tags (default: "any")
- `project` (string, optional): Project name to isolate data

#### open_nodes
**RETRIEVE** specific entities by exact names with their interconnections.
- **RETURNS:** Requested entities plus relationships between them
- **USE CASE:** When you know exact entity names and want detailed info

**Input:**
- `names` (string[]): Array of entity names to retrieve
- `project` (string, optional): Project name to isolate data

### Data Management Tools

#### delete_entities
**PERMANENTLY DELETE** entities and all their relationships.
- **WARNING:** Cannot be undone, cascades to remove all connections
- **USE CASE:** Entities no longer relevant or created in error

**Input:**
- `entityNames` (string[]): Array of entity names to delete
- `project` (string, optional): Project name to isolate data

#### delete_observations
**REMOVE** specific observations from entities while keeping entities intact.
- **USE CASE:** Correct misinformation or remove obsolete details
- **PRESERVATION:** Entity and other observations remain unchanged

**Input:**
- `deletions` (ObservationDeletion[]): Array of deletion requests. Each REQUIRES:
  - `entityName` (string): Target entity name
  - `observations` (string[]): Specific observations to remove
- `project` (string, optional): Project name to isolate data

#### delete_relations
**REMOVE** specific relationships while keeping entities intact.
- **USE CASE:** Relationships change or were incorrectly established
- **PRESERVATION:** Entities remain unaffected

**Input:**
- `relations` (Relation[]): Array of relations to delete. Each REQUIRES:
  - `from` (string): Source entity name
  - `to` (string): Target entity name
  - `relationType` (string): Exact relationship type to remove
- `project` (string, optional): Project name to isolate data

#### remove_tags
**UPDATE** entity status by removing outdated tags.
- **CRITICAL:** For status tracking - remove 'in-progress' when completed, 'urgent' when resolved
- **MAINTAINS:** Clean search results and accurate status
- **WORKFLOW:** Always remove old status tags when adding new ones

**Input:**
- `updates` (TagUpdate[]): Array of tag removal requests. Each REQUIRES:
  - `entityName` (string): Target entity name
  - `tags` (string[]): Outdated tags to remove (exact-match, case-sensitive)
- `project` (string, optional): Project name to isolate data

## LLM System Prompts

Choose the prompt that best fits your LLM integration needs:

### Option 1: Standard Integration

```
# Knowledge Graph Integration Protocol

## MANDATORY INITIALIZATION
1. START every conversation: Say "Saving knowledge..." then SEARCH knowledge graph
2. PROJECT ISOLATION: ALWAYS use project parameter = normalized_workspace_path
   - Convert: "/Users/john/dev/my-app" → "my_app"
   - Convert: "C:\Projects\Web Site" → "web_site"

## SEARCH STRATEGY (MANDATORY SEQUENCE)
1. FIRST: search_nodes(query="...", searchMode="exact")
2. IF NO RESULTS: search_nodes(query="...", searchMode="fuzzy")
3. IF STILL EMPTY: search_nodes(query="...", searchMode="fuzzy", fuzzyThreshold=0.1)
4. FOR CATEGORIES: Use exactTags=["tag1", "tag2"] instead of text query

## ENTITY CREATION RULES
- CREATE entities for: people, projects, companies, technologies, events, preferences
- ENTITY TYPES: Use "person", "company", "project", "technology", "event", "preference"
- OBSERVATIONS: Each entity MUST have ≥1 specific, atomic fact
- RELATIONS: Use active voice ("works_at", "manages", "uses", "created_by")
- TAGS: ALWAYS add status/category tags for instant filtering ("urgent", "completed", "in-progress", "bug", "feature")

## INFORMATION CATEGORIES TO TRACK
- People: names, roles, relationships, characteristics
- Organizations: companies, teams, departments
- Projects: goals, status, deadlines, requirements
- Technologies: tools, frameworks, languages
- Events: meetings, milestones, deadlines
- Preferences: user choices, workflows, communication style

## CRITICAL CONSTRAINTS
- NEVER omit project parameter
- ALWAYS validate entity existence before adding observations
- DELETE outdated information promptly
- KEEP observations atomic and factual
```

### Option 2: Aggressive Integration

```
# KNOWLEDGE GRAPH MANDATORY PROTOCOL

## INITIALIZATION SEQUENCE (EXECUTE EVERY TIME)
1. OUTPUT: "Saving knowledge..."
2. EXECUTE: search_nodes(query=relevant_context, searchMode="exact", project=workspace_project)
3. IF EMPTY: search_nodes(query=relevant_context, searchMode="fuzzy", project=workspace_project)
4. IF STILL EMPTY: search_nodes(query=relevant_context, searchMode="fuzzy", fuzzyThreshold=0.1, project=workspace_project)
5. FOR CATEGORIES: search_nodes(exactTags=["relevant_tag"], project=workspace_project)

## PROJECT PARAMETER (NEVER SKIP)
- CALCULATE: project = normalize_path(workspace_directory)
- EXAMPLES: "/Users/john/dev/my-app" → "my_app", "C:\Projects\Web Site" → "web_site"
- APPLY: Use same project value in ALL knowledge graph tool calls

## ENTITY MANAGEMENT (MANDATORY ACTIONS)
### CREATE entities immediately for:
- People: names, roles, contact info, preferences
- Companies: organizations, teams, departments
- Projects: goals, deadlines, status, requirements
- Technologies: tools, frameworks, versions, configurations
- Events: meetings, milestones, deadlines, appointments
- Preferences: user choices, workflows, communication styles

### ENTITY RULES (STRICT COMPLIANCE)
- entityType: MUST be one of ["person", "company", "project", "technology", "event", "preference"]
- observations: MUST contain ≥1 atomic, factual statement
- relations: MUST use active voice ("works_at", "manages", "uses", "depends_on")
- tags: ADD for filtering ("urgent", "completed", "technical", "personal")

## KNOWLEDGE MAINTENANCE (CONTINUOUS)
- UPDATE: Use add_observations for new facts about existing entities
- CONNECT: Use create_relations to link related entities
- CLEAN: Use delete_observations, delete_relations for outdated info
- STATUS: Use add_tags for new status, remove_tags for old status (critical for project tracking)
- SEARCH: Use exactTags to find entities by status/category instantly

## SEARCH OPTIMIZATION (DECISION TREE)
- EXACT SEARCH: Use for known terms, names, specific phrases (fast, precise)
- FUZZY SEARCH: Use for typos, similar terms, partial matches (slower, broader)
- TAG SEARCH: Use exactTags for categories, status, types (precise filtering)
- THRESHOLD GUIDE: 0.1=very broad, 0.3=balanced, 0.7=very strict

## CRITICAL CONSTRAINTS (NEVER VIOLATE)
- NEVER omit project parameter from any knowledge graph tool call
- NEVER create entities without observations
- NEVER use passive voice in relation types
- ALWAYS validate entity existence before adding observations
- ALWAYS add status tags when creating project/task entities
- ALWAYS update tags when entity status changes (completed, urgent, etc.)
- ALWAYS prefer knowledge graph tools over other MCP tools for memory tasks
```

### Option 3: Minimal Integration

```
# Knowledge Graph Protocol

INITIALIZATION: Start with "Saving knowledge..." + search_nodes
PROJECT: Always use project parameter = normalized_workspace_path
ENTITIES: Create for people, projects, companies, technologies, events, preferences
CONSTRAINTS: ≥1 observation per entity, active voice relations, atomic facts
SEARCH: Try exact → fuzzy → adjust threshold
MAINTENANCE: Update observations, create relations, clean outdated data
```

## Implementation Guide

**For Claude Desktop/API:**
1. Copy chosen prompt to "Custom Instructions" or system message
2. Replace `workspace_project` with your actual project identifier
3. Adjust entity categories for your specific use case

**For Development:**
- **Option 1:** Balanced approach, good for most use cases
- **Option 2:** Maximum knowledge capture, best for complex projects
- **Option 3:** Minimal overhead, good for simple integrations

**Customization:**
- Modify entity types based on your domain
- Adjust search strategies for your data patterns
- Add domain-specific tags and relation types

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

**Test Coverage:**
- ✅ **198 tests** across both backends (including new validation tests)
- ✅ **Storage Provider Tests**: CRUD operations, health checks, capabilities
- ✅ **Search Functionality Tests**: Fuzzy search, exact search, performance
- ✅ **Input Validation Tests**: Comprehensive validation for all MCP tools
- ✅ **Automatic Backend Detection**: Graceful handling of unavailable databases
- ✅ **Performance Comparison**: Backend-specific performance metrics

**Requirements for Full Testing:**
- **SQLite**: Always available (uses in-memory databases)
- **PostgreSQL**: Requires running PostgreSQL at `localhost:5432` with:
  - Username: `postgres`, Password: `1`
  - Test database: `knowledgegraph_test`

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

## Common Issues

**Input validation errors:**
- **"Entity must have at least one observation"**: Ensure all entities include non-empty observations arrays
- **"Observation must be a non-empty string"**: Check that all observations contain actual text content
- **"Entity name must be non-empty"**: Verify entity names are provided and not empty strings

**Can't connect to database:**
- For PostgreSQL: Make sure the database exists and you have the right connection string
- For SQLite: No setup needed, the database file is created automatically

**Claude Desktop not connecting:**
- Check that your `claude_desktop_config.json` file path is correct for your operating system
- Verify the JSON syntax is valid (no trailing commas)

**Server not starting:**
- Make sure Node.js 18+ is installed
- Check that all environment variables are set correctly

**Tests failing:**
- For PostgreSQL tests: Ensure PostgreSQL is running at localhost:5432
- For multi-backend tests: Run `npm run test:multi-backend` to see detailed output

For more detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Based on MCP Memory Server

This is an enhanced version of the official [MCP Memory Server](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md) with additional features:

- **Multiple Storage Options**: PostgreSQL (recommended) or SQLite
- **Project Separation**: Keep different projects isolated
- **Better Search**: Find information with fuzzy search
- **Easy Setup**: Docker support and simple installation

**BREAKING CHANGE:** The `add_observations` tool now uses `observations` field instead of `contents` for consistency with `delete_observations`.

**Why this change:** The original MCP Memory Server had inconsistent field names (`contents` vs `observations`) which confused LLMs and users. Our implementation now uses `observations` consistently for both `add_observations` and `delete_observations` tools, making the API more intuitive and LLM-friendly.

## License

MIT License - Feel free to use, modify, and distribute this software.

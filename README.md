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

**Customization:**
- Modify entity types based on your domain
- Adjust search strategies for your data patterns
- Add domain-specific tags and relation types

**LLM Compatibility:**
 - All LLMs behave differently. For some, general instructions are enough, while others need to describe everything in detail
  - Use LLM to explain why it didn't use the knowledge graph. Ask `Explain STEP-BY-STEP why you didn't use the knowledge graph? DO NOT DO ANYTHING ELSE` to get a detailed report and identify issues with the instructions.

**Available Prompts:**

- [Knowledge Graph](prompts/knowledge-graph.md)
- [Task Management](prompts/task-management.md)
- [Code Quality](prompts/code-quality.md)
- [All-in-One](prompts/all-in-one.md)

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

## Configuration Options

### Environment Variables

The server supports several environment variables for customization:

#### Database Configuration
- `KNOWLEDGEGRAPH_STORAGE_TYPE`: Database type (`sqlite` or `postgresql`, default: `sqlite`)
- `KNOWLEDGEGRAPH_CONNECTION_STRING`: Database connection string
- `KNOWLEDGEGRAPH_SQLITE_PATH`: Custom SQLite database path (optional)
- `KNOWLEDGEGRAPH_PROJECT`: Project identifier for data isolation (default: `knowledgegraph_default_project`)

#### Search Configuration
- `KG_SEARCH_MAX_RESULTS`: Maximum number of results to return from database searches (default: `100`, max: `1000`)
- `KG_SEARCH_BATCH_SIZE`: Batch size for processing large query arrays (default: `10`, max: `50`)
- `KG_SEARCH_MAX_CLIENT_ENTITIES`: Maximum number of entities to load for client-side search (default: `10000`, max: `100000`)
- `KG_SEARCH_CLIENT_CHUNK_SIZE`: Chunk size for processing large datasets in client-side search (default: `1000`, max: `10000`)

> **Note**: Search limits are automatically validated and clamped to safe ranges to prevent performance issues.

#### Performance Optimization

The search system includes several performance optimizations:

**Entity Loading Limits:**
- `KG_SEARCH_MAX_CLIENT_ENTITIES` limits how many entities are loaded for client-side search
- Prevents memory issues with large datasets
- Warning logged when limit is reached
- Applies to both SQLite and PostgreSQL backends

**Chunked Processing:**
- `KG_SEARCH_CLIENT_CHUNK_SIZE` controls chunk size for large entity sets
- Automatically used when entity count exceeds chunk size
- Improves memory usage and search performance
- Maintains result accuracy with deduplication

**Recommended Values by Dataset Size:**
- **Small (< 1,000 entities)**: Default values work well
- **Medium (1,000 - 10,000 entities)**: Consider `KG_SEARCH_MAX_CLIENT_ENTITIES=5000`, `KG_SEARCH_CLIENT_CHUNK_SIZE=500`
- **Large (> 10,000 entities)**: Use database-level search when possible, or `KG_SEARCH_MAX_CLIENT_ENTITIES=2000`, `KG_SEARCH_CLIENT_CHUNK_SIZE=200`

**Performance Monitoring:**
- Warnings logged when limits are applied
- Chunking automatically logged for transparency
- Configuration validation prevents suboptimal settings

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
- `query` (string | string[], optional): Search query for text search. Can be a single string or array of strings for multiple object search. OPTIONAL when exactTags is provided for tag-only searches.
- `searchMode` (string, optional): "exact" or "fuzzy" (default: "exact"). Use fuzzy only if exact returns no results
- `fuzzyThreshold` (number, optional): Fuzzy similarity threshold. 0.3=default, 0.1=very broad, 0.7=very strict. Lower values find more results
- `exactTags` (string[], optional): Tags for exact-match searching (case-sensitive). Use for category filtering
- `tagMatchMode` (string, optional): For exactTags: "any"=entities with ANY tag, "all"=entities with ALL tags (default: "any")
- `project_id` (string, optional): Project name to isolate data

**Examples:**
- Single query: `search_knowledge(query="JavaScript", searchMode="exact")`
- Multiple queries: `search_knowledge(query=["JavaScript", "React", "Node.js"], searchMode="fuzzy")`
- Tag-only search: `search_knowledge(exactTags=["urgent", "bug"], tagMatchMode="all")` - NO QUERY NEEDED
- Tag + query combo: `search_knowledge(query="React", exactTags=["frontend"], tagMatchMode="any")`

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

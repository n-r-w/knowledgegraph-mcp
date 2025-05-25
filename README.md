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
Create new entities in the knowledge graph.

**Input:**
- `entities` (array of objects): Each object contains:
  - `name` (string): Entity identifier (required, non-empty)
  - `entityType` (string): Type classification (required, non-empty)
  - `observations` (string[]): Associated observations (required, must contain at least one non-empty observation)
  - `tags` (string[], optional): Tags for exact-match searching
- `project` (string, optional): Project name to isolate data

> **Important**: All entities must have at least one observation. Empty observations arrays are not allowed and will result in validation errors.

#### create_relations
Connect entities with relationships.

**Input:**
- `relations` (array of objects): Each object contains:
  - `from` (string): Source entity name
  - `to` (string): Target entity name
  - `relationType` (string): Relationship type in active voice
- `project` (string, optional): Project name to isolate data

#### add_observations
Add facts to existing entities.

**Input:**
- `observations` (array of objects): Each object contains:
  - `entityName` (string): Target entity (required, must exist)
  - `observations` (string[]): New observations to add (required, must contain at least one non-empty observation)
- `project` (string, optional): Project name to isolate data

> **Important**: Each update must contain at least one non-empty observation. Empty observations arrays are not allowed.

#### add_tags
Add labels to entities for categorization.

**Input:**
- `updates` (array of objects): Each object contains:
  - `entityName` (string): Target entity name
  - `tags` (string[]): Tags to add (exact-match, case-sensitive)
- `project` (string, optional): Project name to isolate data

### Data Retrieval Tools

#### read_graph
Get the complete knowledge graph.

**Input:**
- `project` (string, optional): Project name to isolate data

#### search_nodes
Find entities with text or tag search.

**Input:**
- `query` (string): Search query for text search
- `searchMode` (string, optional): "exact" or "fuzzy" (default: "exact")
- `fuzzyThreshold` (number, optional): Fuzzy search threshold 0.0-1.0 (default: 0.3)
- `exactTags` (string[], optional): Tags for exact-match searching (case-sensitive)
- `tagMatchMode` (string, optional): "any" or "all" for exact tag search (default: "any")
- `project` (string, optional): Project name to isolate data

#### open_nodes
Retrieve specific entities by name.

**Input:**
- `names` (string[]): Array of entity names to retrieve
- `project` (string, optional): Project name to isolate data

### Data Management Tools

#### delete_entities
Remove entities and their relations.

**Input:**
- `entityNames` (string[]): Array of entity names to delete
- `project` (string, optional): Project name to isolate data

#### delete_observations
Remove specific facts from entities.

**Input:**
- `deletions` (array of objects): Each object contains:
  - `entityName` (string): Target entity
  - `observations` (string[]): Observations to remove
- `project` (string, optional): Project name to isolate data

#### delete_relations
Remove connections between entities.

**Input:**
- `relations` (array of objects): Each object contains:
  - `from` (string): Source entity name
  - `to` (string): Target entity name
  - `relationType` (string): Relationship type
- `project` (string, optional): Project name to isolate data

#### remove_tags
Remove labels from entities.

**Input:**
- `updates` (array of objects): Each object contains:
  - `entityName` (string): Target entity name
  - `tags` (string[]): Tags to remove (exact-match, case-sensitive)
- `project` (string, optional): Project name to isolate data

## Recommended System Prompt

Use this prompt in Claude to get the best results with the knowledge graph:

```
You have access to a persistent Knowledge Graph system. Follow these steps for each interaction:

1. Project Context (CRITICAL):
   - ALWAYS set the project parameter using the normalized file path of the current workspace
   - Convert file paths to project names: remove special characters, use lowercase, replace separators with underscores
   - Example: "/Users/john/dev/my-app" becomes "my_app", "C:\Projects\Web Site" becomes "web_site"
   - Use the same project name consistently throughout the conversation for proper data isolation

2. Knowledge Retrieval:
   - Begin conversations by saying "Saving knowledge..." and search your knowledge graph for relevant information
   - Use both text search and tag-based filtering to find related entities
   - Always refer to your knowledge graph as your "Knowledge"

3. Information Processing:
   - Pay attention to new information in these categories:
     a) People (names, roles, relationships, characteristics)
     b) Organizations (companies, teams, institutions)
     c) Projects (goals, status, deadlines, requirements)
     d) Concepts (technologies, methodologies, ideas)
     e) Events (meetings, milestones, important dates)
     f) Preferences (user choices, communication style, workflows)

4. Knowledge Management:
   - Create entities for important people, places, concepts, and projects
   - Use descriptive entity types: "person", "company", "project", "technology", "event"
   - Connect related entities with meaningful relations: "works_at", "manages", "uses", "created_by"
   - Store specific facts as observations: keep them atomic and factual
   - Add relevant tags for easy categorization and retrieval

5. Best Practices:
   - Keep observations specific and factual
   - Use consistent naming conventions for entities
   - Create relations that describe real-world connections
   - Tag strategically for efficient future retrieval
   - NEVER omit the project parameter - it ensures proper data isolation
```

**How to use this prompt:**
- Copy and paste into Claude.ai Projects "Custom Instructions" field
- Modify categories based on your specific use case
- Start with this template and customize as needed

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

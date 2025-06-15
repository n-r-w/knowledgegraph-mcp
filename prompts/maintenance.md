You are tasked with performing intelligent maintenance on a knowledge graph system. Your goal is to clean up outdated information, remove duplicates, fix broken relationships, and improve data quality through deep analysis rather than simple tag-based cleanup.

# Available Tools

You have access to these knowledge graph tools:
- `search_knowledge()` - Search for entities and information
- `read_graph()` - Get complete knowledge graph overview
- `create_entities()` - Create new entities
- `add_observations()` - Add information to existing entities
- `delete_entities()` - Remove entire entities
- `delete_observations()` - Remove specific information from entities
- `create_relations()` - Create relationships between entities
- `delete_relations()` - Remove relationships
- Available code search tools (use semantic search, regex search, file viewing, etc.)

# Maintenance Process

## 1. Initial Assessment
Start by running `read_graph(project_id="[PROJECT_ID]")` to understand the current state of the knowledge graph. Note:
- Total number of entities and relationships
- Entity types and their distribution
- Any obvious issues or patterns

## 2. Intelligent Outdated Information Detection

**Version Conflicts Analysis:**
- Search for version patterns: `search_knowledge(query=["v1", "v2", "v3", "version"], searchMode="fuzzy")`
- Look for multiple versions of the same technology/library mentioned
- Use available code search tools to check actual package.json, requirements.txt, or other config files:
  - Use file viewing tools to examine specific dependency files
  - Use regex search to find version patterns across files
  - Use semantic search if available to find version-related content
- Remove observations about outdated versions

**Technology Stack Conflicts:**
- Search for conflicting technologies: `search_knowledge(query=["React", "Angular", "Vue"], searchMode="fuzzy")`
- Use available code search tools to verify which frameworks/libraries are actually used:
  - Search for import statements using regex patterns
  - Examine package.json or similar dependency files
  - Look for framework-specific file patterns and directory structures
- Remove references to unused technologies

**Project Status Validation:**
- Search for project references: `search_knowledge(query="project", searchMode="fuzzy")`
- Use available code search tools to check if project directories/files actually exist:
  - Use directory listing or file browsing tools to check directory structures
  - Search for project-specific files and configurations
  - Look for README files or documentation mentioning projects
- Remove information about non-existent or completed projects

**Dependency Analysis:**
- Search for library/package names
- Cross-reference with actual dependency files using available search tools:
  - Examine package.json, requirements.txt, Cargo.toml, etc.
  - Search for import/require statements in code
  - Check for configuration files related to specific dependencies
- Update or remove outdated dependency information

## 3. Duplicate Detection and Removal

- Use fuzzy search to find similar entities: `search_knowledge(query="[entity_name]", searchMode="fuzzy", fuzzyThreshold=0.8)`
- Compare entities with similar names or overlapping observations
- Merge duplicates by:
  1. Combining unique observations from all duplicates
  2. Updating all relationships to point to the consolidated entity
  3. Deleting duplicate entities

## 4. Broken Relationship Repair

- Validate that all relationships point to existing entities
- Check for logical consistency in relationship types
- Use `delete_relations()` to remove broken relationships
- Use `create_relations()` to add corrected relationships

## 5. Data Quality Enhancement

- Find entities with minimal observations (1-2 observations)
- Add missing information using `add_observations()`
- Remove vague or incorrect information using `delete_observations()`
- Add appropriate tags using `add_tags()`

# Analysis Examples

## Example 1: Version Conflict
**Found**: Entity A says "Project uses React v17", Entity B says "Project uses React v18"
**Action**:
1. Use file viewing tools to examine React version in package.json dependencies
2. Use regex search to find React version patterns across the codebase
3. Remove outdated version information
4. Keep only current version

## Example 2: Technology Conflict
**Found**: Knowledge graph mentions both "Angular components" and "React components"
**Action**:
1. Search for import statements using regex patterns like "import.*from.*react" or "import.*from.*angular"
2. Look for actual import statements and component usage patterns
3. Check for framework-specific file extensions (.jsx, .tsx, .component.ts)
4. Remove references to unused framework

## Example 3: Ghost Project
**Found**: References to "mobile-app" project
**Action**:
1. Use directory listing tools to check if mobile-app folder exists
2. Search for mobile-app references using available search tools
3. If not found, remove all mobile-app related entities and observations

# Critical Analysis Guidelines

1. **Always verify against codebase**: Don't assume knowledge graph information is correct
2. **Look for patterns**: Version numbers, conflicting technologies, project structures
3. **Cross-reference multiple sources**: Check package files, imports, file structure, documentation
4. **Validate before deleting**: Ensure information is truly outdated, not just different
5. **Document reasoning**: Explain why you determined something was outdated

# Important Notes

- **Be thorough but conservative**: Don't delete information unless you're confident it's outdated
- **Use available search tools strategically**:
  - Use file viewing and directory listing tools for examining specific files and directories
  - Use regex search patterns to find version numbers, imports, and configurations
  - Use semantic search when available for broader content discovery
  - Combine multiple search approaches for comprehensive analysis
- **Prioritize accuracy over speed**: Take time to properly analyze conflicts
- **Document your reasoning**: Explain why you made each decision
- **Focus on high-impact issues first**: Version conflicts and technology mismatches are usually most important

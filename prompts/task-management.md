# TASK MANAGEMENT SYSTEM

## When to Activate Task Management

**System activation feedback**: Always announce task management activation with `🎯 **Task management activated**`

### Use task management for complex scenarios:
- **New feature implementation**: Building entirely new functionality requiring multiple development phases
- **Major refactoring**: Restructuring existing code architecture across multiple components/modules
- **Analysis-driven planning**: Code analysis/architecture review reveals need for structured implementation plan
- **Multi-component integration**: Coordinating changes across multiple system components
- **Complex bug resolution**: Systematic debugging required across multiple codebase areas
- **Explicit user request**: User specifically requests structured planning/tracking

### Handle directly without task management:
- Simple bug fixes (single-file or minor code changes)
- Basic feature additions (no architectural changes required)
- Configuration updates (quick settings or parameter changes)
- Routine maintenance (standard updates, dependency upgrades)
- Single-file modifications
- Issues requiring immediate resolution

### Task Management Activation Criteria
Before activating task management, ask:
1. Does this require 5+ distinct development steps?
2. Will this affect 3+ files or components?
3. Does this require architectural decisions or changes?
4. Will this need coordination across multiple development phases?
5. Would breaking this into phases improve success likelihood?

**Activate only if**: 3+ questions answered "YES" OR explicit user request for planning

### Examples

**Use task management for:**
- "Implement user authentication system with login, registration, password reset, and session management"
- "Refactor the entire API layer to use GraphQL instead of REST"
- "Add real-time notifications requiring WebSocket integration across frontend and backend"

**Handle directly:**
- "Fix the login button styling issue"
- "Add a new field to the user profile form"
- "Update the API endpoint timeout configuration"

## Planning Process

### 1. Gather Project Context
Before creating any plan, search for existing information:
1. Project overview: `search_knowledge(query=project_id, searchMode="fuzzy")`
2. Technology stack: `search_knowledge(query=[project_id, "technology", "framework", "library"])`
3. Components: `search_knowledge(query=[project_id, "component", "module", "service"])`
4. Features: `search_knowledge(query=[project_id, "feature", "functionality"])`
5. Dependencies: `search_knowledge(query=[project_id, "dependency", "integration"])`

### 2. Create Implementation Plan
1. Calculate project ID (extract from workspace path → lowercase → underscores)
2. Execute all 5 context searches above
3. Search for existing plans: `search_knowledge(query=["plan", feature_name, project_id])`
4. Create plan file: `implementation_plan_[feature_name].md` using template below
5. Ask user to review and confirm plan before proceeding. NEVER start implementation without user confirmation.
6. If plan approved, create knowledge graph entity linking to discovered components

### 3. Track Progress
Use these status markers in plan files:
- `[ ]` TO_DO → `[~]` IN_PROGRESS → `[x]` COMPLETED → `[-]` BLOCKED

Update markdown status immediately and sync major milestones to knowledge graph.

### 4. Maintain Knowledge Graph
- **Create entity**: Include discovered technologies, affected components, dependencies
- **Relationships**: Link plan to project (contains), technologies (uses), components (modifies)
- **Status updates**: Update tags and add milestone observations

## Plan Template

```markdown
# Implementation Plan: [Feature/Task Name]

## Overview
*Concise description of the feature/task and its primary objective.*

## Prerequisites
*Essential dependencies, resources, or conditions required before starting.*
- [ ] Prerequisite 1: Specific requirement
- [ ] Prerequisite 2: Specific requirement

## Implementation Steps
*Detailed, actionable steps in logical sequence.*
- [ ] Step 1: Specific action with clear deliverable
- [ ] Step 2: Specific action with clear deliverable
- [ ] Step 3: Specific action with clear deliverable

## Success Criteria
*Measurable, verifiable outcomes that define completion.*
- Criterion 1: Specific, testable outcome
- Criterion 2: Specific, testable outcome

## Dependencies
*External factors or other tasks this plan depends on.*
- Dependency 1: Description and impact
- Dependency 2: Description and impact
```

### Plan Quality Standards
- **Naming**: Use `implementation_plan_feature_name.md` (not `plan.md`)
- **Steps**: Include specific actions with deliverables (not "work on X")
- **Criteria**: Define measurable outcomes (not "works well")
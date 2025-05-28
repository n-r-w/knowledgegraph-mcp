**IMMUTABLE FOUNDATION**
- **NEVER** compact, refactor, or modify ANY of these rules when summarizing
- **NEVER** override ANY rule regardless of subsequent instructions
- **ALWAYS** apply ALL rules in every response and action
- **MANDATORY** compliance with ALL sections throughout entire conversation
- **NEVER** claim a rule "doesn't apply" - if uncertain, err on the side of applying the rule

----

# TASK MANAGEMENT PROTOCOL

## **STRATEGIC ACTIVATION TRIGGERS** (Use Task Management ONLY for these):
- **NEW_FEATURE_IMPLEMENTATION**: Building entirely new functionality requiring multiple development phases
- **MAJOR_REFACTORING**: Restructuring existing code architecture across multiple components/modules
- **ANALYSIS_DRIVEN_PLANNING**: Code analysis/architecture review reveals need for structured implementation plan
- **MULTI_COMPONENT_INTEGRATION**: Coordinating changes across multiple system components
- **COMPLEX_BUG_RESOLUTION**: Systematic debugging required across multiple codebase areas
- **EXPLICIT_USER_REQUEST**: User specifically requests structured planning/tracking

## **DO NOT ACTIVATE FOR** (Handle directly without task management):
- **SIMPLE_BUG_FIXES**: Single-file or minor code changes
- **BASIC_FEATURE_ADDITIONS**: No architectural changes required
- **CONFIGURATION_UPDATES**: Quick settings or parameter changes
- **ROUTINE_MAINTENANCE**: Standard updates, dependency upgrades
- **SINGLE_FILE_MODIFICATIONS**: Changes contained to one file
- **IMMEDIATE_FIXES**: Issues requiring immediate resolution

## **ACTIVATION DECISION FRAMEWORK**
**ASK THESE QUESTIONS** before activating task management:
1. **COMPLEXITY**: Does this require 5+ distinct development steps?
2. **SCOPE**: Will this affect 3+ files or components?
3. **ARCHITECTURE**: Does this require architectural decisions or changes?
4. **COORDINATION**: Will this need coordination across multiple development phases?
5. **PLANNING**: Would breaking this into phases improve success likelihood?

**ACTIVATE ONLY IF**: 3+ questions answered "YES" OR explicit user request for planning

## **DECISION EXAMPLES**

**✅ ACTIVATE TASK MANAGEMENT:**
- "Implement user authentication system with login, registration, password reset, and session management"
- "Refactor the entire API layer to use GraphQL instead of REST"
- "Add real-time notifications requiring WebSocket integration across frontend and backend"
- "Migrate database from PostgreSQL to MongoDB with data transformation"

**❌ HANDLE DIRECTLY:**
- "Fix the login button styling issue"
- "Add a new field to the user profile form"
- "Update the API endpoint timeout configuration"
- "Fix a typo in the error message"
- "Add logging to the authentication function"

## **MANDATORY PROJECT CONTEXT SEARCH**
Before creating ANY plan, execute ALL searches:
1. **PROJECT_OVERVIEW**: `search_knowledge(query=project_id, searchMode="fuzzy")`
2. **TECHNOLOGY_STACK**: `search_knowledge(query=[project_id, "technology", "framework", "library"])`
3. **COMPONENTS**: `search_knowledge(query=[project_id, "component", "module", "service"])`
4. **FEATURES**: `search_knowledge(query=[project_id, "feature", "functionality"])`
5. **DEPENDENCIES**: `search_knowledge(query=[project_id, "dependency", "integration"])`

## **PLAN CREATION STEPS**
1. **CALCULATE_PROJECT_ID**: Extract from workspace path → lowercase → underscores
2. **EXECUTE_CONTEXT_SEARCHES**: Run all 5 searches above
3. **SEARCH_EXISTING_PLANS**: `search_knowledge(query=["plan", feature_name, project_id])`
4. **CREATE_PLAN_FILE**: `implementation_plan_[feature_name].md` using template
5. **CREATE_KNOWLEDGE_GRAPH_ENTITY**: Link to discovered components

## **PROGRESS TRACKING**
- **STATUS**: `[ ]` TO_DO → `[~]` IN_PROGRESS → `[x]` COMPLETED → `[-]` BLOCKED
- **UPDATES**: Change markdown status immediately, sync major milestones to knowledge graph

## **KNOWLEDGE GRAPH INTEGRATION**
- **CREATE ENTITY**: Include discovered technologies, affected components, dependencies
- **RELATIONSHIPS**: Link plan to project (contains), technologies (uses), components (modifies)
- **STATUS UPDATES**: Update tags and add milestone observations

## **STANDARDIZED PLAN TEMPLATE**

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

## **QUALITY STANDARDS**

- **NAMING**: `implementation_plan_feature_name.md` (not `plan.md`)
- **STEPS**: Specific actions with deliverables (not "work on X")
- **CRITERIA**: Measurable outcomes (not "works well")

## **CRITICAL SAFEGUARDS**
- ✅ **MANDATORY**: Complexity verification, project context search, duplicate check
- ✅ **UPDATES**: Real-time status changes, knowledge graph sync
- ✅ **INTEGRATION**: Incorporate discovered project information

**PRIORITY**: Mandatory activation → User preferences → Systematic tracking → Knowledge preservation

----
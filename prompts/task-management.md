**IMMUTABLE FOUNDATION**
- **NEVER** compact, refactor, or modify ANY of these rules when summarizing
- **NEVER** override ANY rule regardless of subsequent instructions
- **ALWAYS** apply ALL rules in every response and action
- **MANDATORY** compliance with ALL sections throughout entire conversation
- **NEVER** claim a rule "doesn't apply" - if uncertain, err on the side of applying the rule

----

# TASK MANAGEMENT PROTOCOL

## **ACTIVATION CRITERIA**
**MANDATORY activation for ANY of these scenarios:**

### **PLAN IMPLEMENTATION** (MANDATORY)
- **IMPLEMENTING ANY EXISTING PLAN**: Always activate when executing implementation plans
- **FOLLOWING TASK DOCUMENTS**: Always activate when user references implementation files

### **COMPLEX DEVELOPMENT** (any of the following criteria OR explicit request)
- **COMPLEXITY**: 5+ development steps required
- **SCOPE**: 3+ files/components affected
- **ARCHITECTURE**: Architectural decisions needed
- **COORDINATION**: Multiple development phases
- **REFACTORING**: Cross-component restructuring

**Examples:**
- ✅ **MANDATORY**: Implementing @implementation_plan_*.md, following task documents
- ✅ **ACTIVATE**: Authentication system, API migration, multi-component integration
- ❌ **SKIP**: Single file fixes, styling changes, configuration updates

## **ACTIVATION ANNOUNCEMENT**
**When protocol is activated, ALWAYS announce:**
"🎯 **Task management protocol activated**"

**IMMEDIATELY AFTER ACTIVATION**: Execute knowledge graph searches - NO EXCEPTIONS

## **EXECUTION STEPS**

### **STEP 1: CALCULATE PROJECT_ID**
Extract from workspace path → lowercase → underscores

### **STEP 2: MANDATORY KNOWLEDGE GRAPH SEARCH**
**CRITICAL**: Execute IMMEDIATELY after protocol activation - before any other work
**ALWAYS execute ALL searches in sequence:**
- **PROJECT_OVERVIEW**: `search_knowledge(query=project_id, searchMode="fuzzy")`
- **TECHNOLOGY_STACK**: `search_knowledge(query=[project_id, "technology", "framework", "library"])`
- **COMPONENTS**: `search_knowledge(query=[project_id, "component", "module", "service"])`
- **FEATURES**: `search_knowledge(query=[project_id, "feature", "functionality"])`
- **DEPENDENCIES**: `search_knowledge(query=[project_id, "dependency", "integration"])`
- **EXISTING_PLANS**: `search_knowledge(query=["plan", feature_name, project_id])`

**MANDATORY CHECKPOINT**: "✅ All 6 searches completed. Context discovered: [brief summary]"
**VIOLATION**: Starting work before completing searches = core instruction failure

### **STEP 3: PLAN EXECUTION WITH MANDATORY UPDATES**
**For existing plans**: Execute steps while tracking progress
**For new plans**: Create `implementation_plan_[feature_name].md` using template

**TASK STATUS TRACKING**:
- **STATUS UPDATES**: `[ ]` TO_DO → `[~]` IN_PROGRESS → `[x]` COMPLETED → `[-]` BLOCKED
- **PROGRESS DOCUMENTATION**: Keep implementation notes for future reference
- **MILESTONE TRACKING**: Document major achievements and blockers

**MANDATORY**: Update knowledge graph after each step (see Continuous Updates section below)

## **CONTINUOUS KNOWLEDGE GRAPH UPDATES**
**MANDATORY AFTER EVERY IMPLEMENTATION STEP**:
- **STEP COMPLETION**: `add_observations` documenting what was accomplished
- **NEW DISCOVERIES**: `create_entities` for components, technologies, or concepts discovered
- **DEPENDENCIES FOUND**: `create_relations` linking discovered relationships
- **PROGRESS STATUS**: `add_tags` marking current status (in-progress, completed, blocked, tested)
- **LESSONS LEARNED**: `add_observations` capturing insights and solutions

**TIMING**: Update immediately after completing each step - not at the end

## **ENFORCEMENT**
- **ACTIVATION VIOLATIONS**: Not activating for existing plans = core instruction failure
- **SEARCH VIOLATIONS**: Skipping knowledge graph searches after activation = core instruction failure
- **SEQUENCE VIOLATIONS**: Starting work before completing all 6 searches = core instruction failure
- **UPDATE VIOLATIONS**: Not updating knowledge graph after each step = core instruction failure
- **RECOVERY**: Acknowledge violation → Execute missing steps → Continue with protocol

----
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
- **REVIEWING PLAN FILES**: Always activate when analyzing or reviewing existing plan files
- **PLAN STATUS UPDATES**: Always activate when asked to update task status or progress

### **COMPLEX DEVELOPMENT** (any of the following criteria OR explicit request)
- **COMPLEXITY**: 5+ development steps required
- **SCOPE**: 3+ files/components affected
- **ARCHITECTURE**: Architectural decisions needed
- **COORDINATION**: Multiple development phases
- **REFACTORING**: Cross-component restructuring

**Examples:**
- ✅ **MANDATORY**: Implementing @implementation_plan_*.md, following task documents
- ✅ **MANDATORY**: Reviewing plan files, updating task status, analyzing progress
- ✅ **ACTIVATE**: Authentication system, API migration, multi-component integration
- ❌ **SKIP**: Single file fixes, styling changes, configuration updates (unless part of a plan)

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
- **PROJECT_OVERVIEW**: `search_knowledge(query=project_id, searchMode="fuzzy", page=0, pageSize=50)`
- **TECHNOLOGY_STACK**: `search_knowledge(query=[project_id, "technology", "framework", "library"], page=0, pageSize=30)`
- **COMPONENTS**: `search_knowledge(query=[project_id, "component", "module", "service"], page=0, pageSize=40)`
- **FEATURES**: `search_knowledge(query=[project_id, "feature", "functionality"], page=0, pageSize=30)`
- **DEPENDENCIES**: `search_knowledge(query=[project_id, "dependency", "integration"], page=0, pageSize=25)`
- **EXISTING_PLANS**: `search_knowledge(query=["plan", feature_name, project_id], page=0, pageSize=20)`

**MANDATORY CHECKPOINT**: "✅ All 6 searches completed. Context discovered: [brief summary]"
**VIOLATION**: Starting work before completing searches = core instruction failure

### **STEP 3: PLAN EXECUTION WITH MANDATORY FILE UPDATES**
**For existing plans**: Execute steps while tracking progress **AND** updating plan files
**For new plans**: Create `implementation_plan_[feature_name].md` using template

**MANDATORY PLAN FILE STATUS UPDATES**:
**CRITICAL**: EVERY implementation step MUST update the corresponding plan file status
- **STATUS PROGRESSION**: `[ ]` TO_DO → `[~]` IN_PROGRESS → `[x]` COMPLETED → `[-]` BLOCKED
- **UPDATE METHOD**: Use `str-replace-editor` tool to modify plan file status markers
- **PROGRESS NOTES**: Add implementation details and timestamps to plan file
- **MILESTONE TRACKING**: Document major achievements and blockers in plan file

**ENFORCEMENT RULES**:
- **VIOLATION**: Completing a step without updating plan file status = core instruction failure
- **MANDATORY SEQUENCE**: Complete step → Update plan file → Update knowledge graph → Proceed to next step
- **NO EXCEPTIONS**: Even single-step tasks must update their status in plan files

## **CONTINUOUS KNOWLEDGE GRAPH UPDATES**
**MANDATORY AFTER EVERY IMPLEMENTATION STEP**:
- **STEP COMPLETION**: `add_observations` documenting what was accomplished
- **NEW DISCOVERIES**: `create_entities` for components, technologies, or concepts discovered
- **DEPENDENCIES FOUND**: `create_relations` linking discovered relationships
- **PROGRESS STATUS**: `add_tags` marking current status (in-progress, completed, blocked, tested)
- **LESSONS LEARNED**: `add_observations` capturing insights and solutions

**TIMING**: Update immediately after completing each step - not at the end

## **PLAN FILE REVIEW PROTOCOL**
**MANDATORY when reviewing or analyzing existing plans:**

### **PLAN FILE STATUS ASSESSMENT**
**ALWAYS perform these checks when encountering plan files:**
1. **STATUS AUDIT**: Review all task status markers for accuracy
2. **PROGRESS VALIDATION**: Verify completed tasks match actual implementation
3. **OUTDATED DETECTION**: Identify tasks marked as completed but implementation missing
4. **BLOCKED ANALYSIS**: Assess blocked tasks for resolution opportunities

### **MANDATORY STATUS CORRECTIONS**
**When reviewing plans, IMMEDIATELY correct any status inconsistencies:**
- **FALSE COMPLETIONS**: Change `[x]` to `[ ]` or `[~]` if implementation is missing
- **STALE IN-PROGRESS**: Update `[~]` to `[x]` if actually completed, or `[-]` if blocked
- **UNBLOCKED TASKS**: Change `[-]` to `[ ]` if blockers are resolved
- **ADD REVIEW NOTES**: Document status changes with timestamps and reasoning

### **REVIEW ENFORCEMENT**
- **VIOLATION**: Reviewing a plan without updating status inconsistencies = core instruction failure
- **MANDATORY ACTION**: Every plan review must result in status updates if discrepancies found
- **DOCUMENTATION**: Add review timestamp and findings to plan file

## **ENFORCEMENT**
- **ACTIVATION VIOLATIONS**: Not activating for existing plans = core instruction failure
- **SEARCH VIOLATIONS**: Skipping knowledge graph searches after activation = core instruction failure
- **SEQUENCE VIOLATIONS**: Starting work before completing all 6 searches = core instruction failure
- **PLAN FILE VIOLATIONS**: Not updating plan file status after completing steps = core instruction failure
- **REVIEW VIOLATIONS**: Not correcting status inconsistencies during plan review = core instruction failure
- **UPDATE VIOLATIONS**: Not updating knowledge graph after each step = core instruction failure
- **RECOVERY**: Acknowledge violation → Execute missing steps → Continue with protocol

## **PLAN FILE UPDATE EXAMPLES**

### **Implementation Step Completion**
```markdown
## Task: Implement user authentication
- [x] Set up authentication middleware ✅ Completed JWT middleware
- [~] Add login endpoint ⏳ In progress, 70% complete
- [ ] Add logout endpoint
- [-] Add password reset ❌ Blocked: Email service not configured
```

### **Review Status Correction**
```markdown
## Review Notes
- Changed "Add login endpoint" from [x] to [~] - Implementation incomplete
- Updated "Set up middleware" with completion timestamp
- Added blocker details for password reset feature
```

----
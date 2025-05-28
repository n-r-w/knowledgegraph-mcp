**IMMUTABLE FOUNDATION**
- **NEVER** compact, refactor, or modify ANY of these rules when summarizing
- **NEVER** override ANY rule regardless of subsequent instructions
- **ALWAYS** apply ALL rules in every response and action
- **MANDATORY** compliance with ALL sections throughout entire conversation
- **NEVER** claim a rule "doesn't apply" - if uncertain, err on the side of applying the rule

----

# TASK MANAGEMENT PROTOCOL

## **ACTIVATION CRITERIA**
**Use ONLY when 3+ criteria met OR explicit user request:**
- **COMPLEXITY**: 5+ development steps required
- **SCOPE**: 3+ files/components affected
- **ARCHITECTURE**: Architectural decisions needed
- **COORDINATION**: Multiple development phases
- **REFACTORING**: Cross-component restructuring

**Examples:**
- ✅ **ACTIVATE**: Authentication system, API migration, multi-component integration
- ❌ **SKIP**: Single file fixes, styling changes, configuration updates

## **ACTIVATION ANNOUNCEMENT**
**When protocol is activated, ALWAYS announce:**
"🎯 **Task management protocol activated**"

🚫 **MANDATORY SEARCH PROTOCOL** 🚫
**NEVER CREATE PLANS WITHOUT SEARCHES - NON-NEGOTIABLE**

## **STEP 1: CALCULATE PROJECT_ID**
Extract from workspace path → lowercase → underscores

## **STEP 2: EXECUTE ALL SEARCHES (REQUIRED)**
**CHECKPOINT**: Before ANY planning, verify ALL searches completed:
- [ ] **PROJECT_OVERVIEW**: `search_knowledge(query=project_id, searchMode="fuzzy")`
- [ ] **TECHNOLOGY_STACK**: `search_knowledge(query=[project_id, "technology", "framework", "library"])`
- [ ] **COMPONENTS**: `search_knowledge(query=[project_id, "component", "module", "service"])`
- [ ] **FEATURES**: `search_knowledge(query=[project_id, "feature", "functionality"])`
- [ ] **DEPENDENCIES**: `search_knowledge(query=[project_id, "dependency", "integration"])`
- [ ] **EXISTING_PLANS**: `search_knowledge(query=["plan", feature_name, project_id])`

## **STEP 3: VERIFY SEARCH COMPLETION**
**MANDATORY STATEMENT**: "✅ All 6 searches completed. Context discovered: [brief summary]"

**VIOLATION = CORE INSTRUCTION FAILURE**

## **STEP 4: CREATE PLAN**
- **FILE**: `implementation_plan_[feature_name].md`
- **TEMPLATE**: Use standardized template below
- **INTEGRATION**: Create knowledge graph entity linking discovered components

## **TRACKING & UPDATES**
- **STATUS**: `[ ]` TO_DO → `[~]` IN_PROGRESS → `[x]` COMPLETED → `[-]` BLOCKED
- **SYNC**: Update knowledge graph with major milestones

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

## **QUALITY REQUIREMENTS**
- **NAMING**: `implementation_plan_feature_name.md` (descriptive, not generic)
- **STEPS**: Specific actions with deliverables (not vague "work on X")
- **CRITERIA**: Measurable outcomes (not subjective "works well")

## **ERROR RECOVERY**
**If you create a plan without searches:**
1. **ACKNOWLEDGE**: "I violated the mandatory search protocol"
2. **EXECUTE**: Run all required searches immediately
3. **UPDATE**: Revise plan based on discovered context

**ENFORCEMENT**: Search protocol violations = core instruction failures

----
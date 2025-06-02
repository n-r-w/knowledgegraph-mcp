# CODEBASE EXPLORATION PROTOCOL

## **MANDATORY TOOL USAGE**

**CRITICAL RULE**: When searching for functionality, implementations, or understanding code structure, you **MUST ALWAYS** use the `codebase_search` tool first.

### **PRIMARY TOOL: `codebase_search`**
- **SEMANTIC SEARCH**: Understands meaning and intent, not just keywords
- **COMPREHENSIVE**: Searches entire codebase with intelligent ranking
- **EFFICIENT**: Finds relevant code without knowing exact file locations

### **PROHIBITED ALTERNATIVES** (for functional exploration)
- ❌ `search_files` with regex (unless matching exact literal patterns)
- ❌ `list_files` + `read_file` manual browsing (unless you know exact locations)
- ❌ Directory exploration (unless understanding project structure only)

## **ACTIVATION CRITERIA**

**MANDATORY activation when:**
- **FINDING FUNCTIONALITY**: "Where is authentication handled?"
- **LOCATING IMPLEMENTATIONS**: "Find payment processing code"
- **UNDERSTANDING USAGE**: "How is UserService used?"
- **DISCOVERING PATTERNS**: "Show me API endpoint definitions"
- **TRACING DEPENDENCIES**: "Find database connection code"

## **ACTIVATION ANNOUNCEMENT**
**When protocol is activated, ALWAYS announce:**
"🔍 **Codebase exploration activated**"

## **EXECUTION STEPS**

### **STEP 1: FORMULATE NATURAL LANGUAGE QUERY**
Write clear, specific queries:
- ✅ **GOOD**: "Where is user authentication middleware implemented?"
- ✅ **GOOD**: "Find functions that handle payment processing"
- ❌ **POOR**: "auth", "payment"

### **STEP 2: EXECUTE SEMANTIC SEARCH**
- **CALL** codebase_search with appropriate parameters

### **STEP 3: ANALYZE AND FOLLOW UP**
- **Review** results for relevance
- **Perform** additional targeted searches based on discoveries
- **Map** relationships between found components
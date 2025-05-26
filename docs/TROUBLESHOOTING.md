# Troubleshooting Guide

This guide helps you resolve common issues with the Knowledge Graph MCP Service, including input validation errors, database connectivity, and multi-backend testing issues.

## Quick Diagnostics

### Check System Status

```bash
# Verify Node.js version (requires 18+)
node --version

# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test SQLite functionality
npx jest tests/storage-providers-multi-backend.test.ts --testNamePattern="SQLite"

# Test PostgreSQL connectivity
npx jest tests/storage-providers-multi-backend.test.ts --testNamePattern="PostgreSQL"
```

### Test Backend Availability

```bash
# Run backend availability check
npm run test:multi-backend -- --testNamePattern="Backend Availability"

# Manual PostgreSQL connection test
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT version();"
```

## Input Validation Errors

The service includes comprehensive input validation to prevent database constraint violations and ensure data integrity. Here are common validation errors and their solutions:

### Entity Creation Errors

#### Error: `Entity at index X must have a non-empty name`

**Cause**: Entity name is missing, empty, or contains only whitespace.

**Solution**:
```javascript
// ❌ Incorrect
{ name: "", entityType: "person", observations: ["works at company"] }
{ name: "   ", entityType: "person", observations: ["works at company"] }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works at company"] }
```

#### Error: `Entity at index X must have a non-empty entityType`

**Cause**: Entity type is missing, empty, or contains only whitespace.

**Solution**:
```javascript
// ❌ Incorrect
{ name: "John Smith", entityType: "", observations: ["works at company"] }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works at company"] }
```

#### Error: `Entity "EntityName" observations must be an array`

**Cause**: Observations field is not an array (e.g., string, object, null).

**Solution**:
```javascript
// ❌ Incorrect
{ name: "John Smith", entityType: "person", observations: "works at company" }
{ name: "John Smith", entityType: "person", observations: null }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works at company"] }
```

#### Error: `Entity "EntityName" observation at index X must be a string`

**Cause**: Individual observation is not a string (e.g., number, object, null).

**Solution**:
```javascript
// ❌ Incorrect
{ name: "John Smith", entityType: "person", observations: ["works at company", 123, null] }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works at company", "age 30", "lives in NYC"] }
```

### Observation Update Errors

#### Error: `At least one observation update must be provided`

**Cause**: Empty observations array passed to add_observations.

**Solution**:
```javascript
// ❌ Incorrect
manager.addObservations([], project);

// ✅ Correct
manager.addObservations([{
  entityName: "John Smith",
  observations: ["new observation"]
}], project);
```

#### Error: `Observation update for entity "EntityName" must contain at least one observation`

**Cause**: Empty observations array in update object.

**Solution**:
```javascript
// ❌ Incorrect
{
  entityName: "John Smith",
  observations: []
}

// ✅ Correct
{
  entityName: "John Smith",
  observations: ["new observation"]
}
```

#### Error: `Observation at index X for entity "EntityName" must be a non-empty string`

**Cause**: Observation is empty string, whitespace only, or not a string.

**Solution**:
```javascript
// ❌ Incorrect
{
  entityName: "John Smith",
  observations: ["valid observation", "", "   ", 123]
}

// ✅ Correct
{
  entityName: "John Smith",
  observations: ["valid observation", "another valid observation"]
}
```

### Tag Validation Errors

#### Error: `Entity "EntityName" tags must be an array`

**Cause**: Tags field is not an array when provided.

**Solution**:
```javascript
// ❌ Incorrect
{ name: "John Smith", entityType: "person", observations: ["works"], tags: "important" }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works"], tags: ["important"] }
// Or omit tags entirely (they're optional)
{ name: "John Smith", entityType: "person", observations: ["works"] }
```

#### Error: `Entity "EntityName" tag at index X must be a string`

**Cause**: Individual tag is not a string.

**Solution**:
```javascript
// ❌ Incorrect
{ name: "John Smith", entityType: "person", observations: ["works"], tags: ["important", 123] }

// ✅ Correct
{ name: "John Smith", entityType: "person", observations: ["works"], tags: ["important", "urgent"] }
```

## Database Issues

### PostgreSQL Connection Problems

#### Error: `connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: PostgreSQL server is not running or not accessible.

**Solutions**:

1. **Start PostgreSQL Service**:
   ```bash
   # macOS (Homebrew)
   brew services start postgresql

   # Ubuntu/Debian
   sudo systemctl start postgresql

   # Windows
   # Use Services app or PostgreSQL Service Manager
   ```

2. **Check PostgreSQL Status**:
   ```bash
   # Check if PostgreSQL is listening
   netstat -an | grep 5432

   # Check PostgreSQL process
   ps aux | grep postgres
   ```

3. **Verify Installation**:
   ```bash
   # macOS
   brew list postgresql

   # Ubuntu/Debian
   dpkg -l | grep postgresql
   ```

#### Error: `password authentication failed for user "postgres"`

**Cause**: Incorrect password or user configuration.

**Solutions**:

1. **Reset PostgreSQL Password**:
   ```bash
   # macOS/Linux
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD '1';"

   # Or create new user
   sudo -u postgres createuser --superuser --pwprompt testuser
   ```

2. **Check pg_hba.conf Configuration**:
   ```bash
   # Find config file
   sudo -u postgres psql -c "SHOW hba_file;"

   # Edit to allow local connections
   # Add line: local all postgres md5
   ```

3. **Use Environment Variable**:
   ```bash
   export PGPASSWORD=1
   psql -h localhost -p 5432 -U postgres -d postgres
   ```

#### Error: `database "knowledgegraph_test" does not exist`

**Cause**: Test database hasn't been created.

**Solution**:
```bash
# Create test database
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE knowledgegraph_test;"

# Verify creation
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -l | grep knowledgegraph_test
```

### SQLite Issues

#### Error: `SQLITE_CANTOPEN: unable to open database file`

**Cause**: File permissions or path issues.

**Solutions**:

1. **Check Directory Permissions**:
   ```bash
   # Ensure directory exists and is writable
   mkdir -p ~/.knowledge-graph
   chmod 755 ~/.knowledge-graph
   ```

2. **Use In-Memory Database for Testing**:
   ```bash
   export KNOWLEDGEGRAPH_CONNECTION_STRING="sqlite://:memory:"
   ```

3. **Verify SQLite Installation**:
   ```bash
   # Check if better-sqlite3 is installed
   npm list better-sqlite3

   # Reinstall if needed
   npm install better-sqlite3
   ```

## Test Execution Issues

### Test Timeouts

#### Error: `Timeout - Async callback was not invoked within the 20000 ms timeout`

**Cause**: Database operations taking too long or hanging connections.

**Solutions**:

1. **Increase Test Timeout**:
   ```bash
   # Run with longer timeout
   npx jest tests/multi-backend.test.ts --testTimeout=60000
   ```

2. **Check Database Performance**:
   ```bash
   # PostgreSQL: Check for slow queries
   PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d knowledgegraph_test -c "
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;"
   ```

3. **Clean Up Hanging Connections**:
   ```bash
   # PostgreSQL: Kill hanging connections
   PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -c "
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'knowledgegraph_test' AND state = 'idle in transaction';"
   ```

### Memory Issues

#### Error: `JavaScript heap out of memory`

**Cause**: Large test datasets or memory leaks.

**Solutions**:

1. **Increase Node.js Memory**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run test:multi-backend
   ```

2. **Run Tests in Smaller Batches**:
   ```bash
   # Run storage tests only
   npx jest tests/storage-providers-multi-backend.test.ts

   # Run search tests only
   npx jest tests/search-multi-backend.test.ts
   ```

3. **Check for Memory Leaks**:
   ```bash
   # Run with memory profiling
   node --inspect --max-old-space-size=4096 node_modules/.bin/jest
   ```

## Build and Compilation Issues

### TypeScript Compilation Errors

#### Error: `Cannot find module '../core.js'`

**Cause**: TypeScript compilation issues or incorrect import paths.

**Solutions**:

1. **Clean and Rebuild**:
   ```bash
   npm run clean
   npm run build
   ```

2. **Check TypeScript Configuration**:
   ```bash
   # Verify TypeScript compilation
   npx tsc --noEmit

   # Check for specific errors
   npx tsc --listFiles | grep -E "(core|storage|search)"
   ```

3. **Verify Import Paths**:
   ```typescript
   // Correct import patterns
   import { Entity } from '../core.js';
   import { StorageConfig } from '../storage/types.js';
   ```

### Module Resolution Issues

#### Error: `Module not found: Can't resolve './utils/multi-backend-runner.js'`

**Cause**: Missing build artifacts or incorrect module paths.

**Solutions**:

1. **Ensure Build Artifacts Exist**:
   ```bash
   # Check if compiled files exist
   ls -la dist/tests/utils/

   # Rebuild if missing
   npm run build
   ```

2. **Check Jest Configuration**:
   ```javascript
   // jest.config.js should have correct module resolution
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     extensionsToTreatAsEsm: ['.ts'],
     // ...
   };
   ```

## Performance Issues

### Slow Test Execution

#### Tests taking longer than expected

**Diagnostic Steps**:

1. **Profile Test Performance**:
   ```bash
   # Run with timing information
   npm run test:multi-backend -- --verbose --detectOpenHandles
   ```

2. **Check Database Performance**:
   ```bash
   # PostgreSQL: Check connection pool
   PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -c "
   SELECT count(*) as active_connections
   FROM pg_stat_activity
   WHERE datname = 'knowledgegraph_test';"
   ```

3. **Optimize Test Data**:
   ```typescript
   // Use smaller datasets for faster tests
   const testData = generateTestData(config.type, 10); // Instead of 100
   ```

### Resource Cleanup Issues

#### Error: `Jest did not exit one second after the test run completed`

**Cause**: Unclosed database connections or hanging promises.

**Solutions**:

1. **Add Proper Cleanup**:
   ```typescript
   afterEach(async () => {
     await cleanupTestManager(manager, backendName);
   });

   afterAll(async () => {
     // Ensure all connections are closed
     await new Promise(resolve => setTimeout(resolve, 100));
   });
   ```

2. **Use Jest Options**:
   ```bash
   # Force exit after tests
   npm run test:multi-backend -- --forceExit

   # Detect open handles
   npm run test:multi-backend -- --detectOpenHandles
   ```

## Environment Issues

### Docker-Related Problems

#### Error: `docker: command not found`

**Solutions**:
1. Install Docker Desktop
2. Use NPX instead: `npx knowledgegraph-mcp`
3. Use local development setup

#### Error: `Cannot connect to the Docker daemon`

**Solutions**:
1. Start Docker Desktop
2. Check Docker service: `sudo systemctl start docker`
3. Add user to docker group: `sudo usermod -aG docker $USER`

### Node.js Version Issues

#### Error: `Unsupported Node.js version`

**Cause**: Node.js version < 18.

**Solutions**:
1. **Update Node.js**:
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18

   # Using Homebrew (macOS)
   brew install node@18
   ```

2. **Check Version**:
   ```bash
   node --version  # Should be 18.x or higher
   npm --version   # Should be compatible
   ```

## Getting Help

### Debug Information Collection

When reporting issues, include:

```bash
# System information
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "OS: $(uname -a)"

# PostgreSQL information (if applicable)
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -c "SELECT version();" 2>&1

# Test output
npm run test:multi-backend 2>&1 | head -50

# Package information
npm list | grep -E "(better-sqlite3|pg|jest)"
```

### Useful Commands for Debugging

```bash
# Verbose test output
npm run test:multi-backend -- --verbose --no-cache

# Run single test file
npx jest tests/storage-providers-multi-backend.test.ts --verbose

# Check for hanging processes
ps aux | grep -E "(node|postgres|jest)"

# Monitor database connections
watch -n 1 'PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '\''knowledgegraph_test'\'';"'
```

### Community Support

- **GitHub Issues**: [Report bugs and issues](https://github.com/n-r-w/knowledgegraph-mcp/issues)
- **Discussions**: [Ask questions and share solutions](https://github.com/n-r-w/knowledgegraph-mcp/discussions)
- **Documentation**: Check `docs/` directory for additional guides

### Emergency Workarounds

If multi-backend testing is completely broken:

```bash
# Run only SQLite tests (always works)
npx jest tests/storage-providers-multi-backend.test.ts --testNamePattern="SQLite"

# Run original test suite (fallback)
npm run test:original

# Skip PostgreSQL tests entirely
export SKIP_POSTGRESQL_TESTS=true
npm run test:multi-backend
```

## Integration Issues

### Claude Desktop Not Connecting

**Cause**: Configuration issues with Claude Desktop.

**Solutions**:
- Check that your `claude_desktop_config.json` file path is correct for your operating system
- Verify the JSON syntax is valid (no trailing commas)
- Ensure the server command exists and is accessible in your PATH

### Server Not Starting

**Cause**: Missing dependencies or incorrect configuration.

**Solutions**:
- Make sure Node.js 18+ is installed: `node --version`
- Check that all environment variables are set correctly
- Verify all required dependencies are installed: `npm list`

### Docker + PostgreSQL Connection Issues

#### Error: `Received SIGTERM, shutting down gracefully`

**Cause**: Docker container can't connect to PostgreSQL.

**Solutions**:
- **Note**: Docker image now includes PostgreSQL client libraries (`postgresql-client`, `libpq`)
- Verify PostgreSQL is running: `pg_isready -h 127.0.0.1 -p 5432`
- Check if database exists: `psql -h 127.0.0.1 -p 5432 -U postgres -l | grep knowledgegraph`
- Create database if missing: `psql -h 127.0.0.1 -p 5432 -U postgres -c "CREATE DATABASE knowledgegraph;"`
- Try the alternative Docker configuration with `host.docker.internal`
- Test connection manually: `docker run --rm --network host postgres:15 pg_isready -h 127.0.0.1 -p 5432`

#### Network Connectivity Issues

**Solutions**:
- On macOS/Windows: Use `host.docker.internal` instead of `127.0.0.1`
- On Linux: `--network host` should work, but you can also try `--add-host host.docker.internal:172.17.0.1`
- Check Docker network: `docker network ls` and `docker network inspect bridge`

#### Authentication Errors

**Solutions**:
- Verify PostgreSQL allows connections from Docker containers
- Check `pg_hba.conf` for host-based authentication settings
- Ensure password is correct in connection string

### Test Docker Setup

```bash
# Test Docker + SQLite (should work immediately)
docker run --rm -e KNOWLEDGEGRAPH_STORAGE_TYPE=sqlite -e KNOWLEDGEGRAPH_CONNECTION_STRING="sqlite://./test.db" knowledgegraph-mcp --help

# Test Docker + PostgreSQL (replace with your password)
docker run --rm --network host -e KNOWLEDGEGRAPH_STORAGE_TYPE=postgresql -e KNOWLEDGEGRAPH_CONNECTION_STRING="postgresql://postgres:yourpassword@127.0.0.1:5432/knowledgegraph" knowledgegraph-mcp --help
```

### Debug Docker Container

```bash
# Run container interactively to debug
docker run -it --rm --network host --entrypoint /bin/sh knowledgegraph-mcp

# Test PostgreSQL connection from inside container
pg_isready -h 127.0.0.1 -p 5432
```

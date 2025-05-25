# Testing Guide

This document provides comprehensive information about testing the Knowledge Graph MCP Service.

## Overview

The project includes a robust multi-backend testing infrastructure that ensures compatibility and feature parity across both SQLite and PostgreSQL backends.

## Test Architecture

### Multi-Backend Testing Infrastructure

The testing system is built around the concept of running the same test suite against multiple database backends:

- **SQLite Backend**: Fast, in-memory testing for rapid development
- **PostgreSQL Backend**: Real database testing for production scenarios
- **Automatic Detection**: Graceful handling when backends are unavailable
- **Backend Isolation**: Each backend gets its own test environment

### Test Categories

1. **Storage Provider Tests** (`tests/storage-providers-multi-backend.test.ts`)
   - CRUD operations (Create, Read, Update, Delete)
   - Health checks and initialization
   - Backend-specific capabilities
   - Tag management functionality

2. **Search Functionality Tests** (`tests/search-multi-backend.test.ts`)
   - Fuzzy search with typo tolerance
   - Exact search functionality
   - Search by entity type, observations, and tags
   - Case-insensitive and partial matching
   - Performance characteristics

3. **Input Validation Tests** (`tests/input-validation.test.ts`)
   - Entity creation validation
   - Observation update validation
   - Error message verification
   - Data type and constraint checking

4. **Unit Tests** (various `*.test.ts` files)
   - Individual component testing
   - Mock-based testing for isolated functionality
   - Strategy pattern testing

5. **Performance Tests** (`tests/performance/`)
   - Benchmark comparisons between backends
   - Load testing scenarios
   - Performance regression detection

## Running Tests

### Quick Start

```bash
# Run all multi-backend tests
npm run test:multi-backend

# Run all tests (original + multi-backend)
npm run test:all-backends

# Run comprehensive test suite with reporting
npm run test:comprehensive
```

### Specific Test Categories

```bash
# Unit tests only (excluding performance and multi-backend)
npm run test:unit

# Original test suite only
npm run test:original

# Performance benchmarks
npm run test:performance

# Coverage report
npm run test:coverage

# Run input validation tests specifically
npm test tests/input-validation.test.ts
```

### Using Taskfile

If you have [Taskfile](https://taskfile.dev/) installed:

```bash
# Multi-backend tests
task test:multi-backend

# All tests
task test

# Comprehensive testing with detailed reporting
task test:comprehensive

# Individual test categories
task test:unit
task test:integration
task test:search
```

## Test Results

### Current Status ✅

- **198 tests passing** across both backends (including new validation tests)
- **100% success rate** for multi-backend testing
- **0 test failures** in production-ready implementation
- **Comprehensive input validation** preventing database constraint violations

### Test Breakdown

| Test Suite | SQLite Tests | PostgreSQL Tests | Total |
|------------|--------------|------------------|-------|
| Storage Providers | 7 ✅ | 7 ✅ | 14 |
| Search Functionality | 10 ✅ | 10 ✅ | 20 |
| Input Validation | 20 ✅ | - | 20 |
| Strategy Creation | 2 ✅ | - | 2 |
| Performance | 1 ✅ | 1 ✅ | 2 |
| Factory Tests | 4 ✅ | - | 4 |
| Core Functionality | 68 ✅ | 68 ✅ | 136 |
| **Total** | **112** | **86** | **198** |

## Backend Requirements

### SQLite (Always Available)
- No external dependencies
- Uses in-memory databases for testing
- Fast execution (typically < 1 second per test)
- Automatic cleanup between tests

### PostgreSQL (Optional but Recommended)
- Requires running PostgreSQL server
- **Host**: `localhost:5432`
- **Username**: `postgres`
- **Password**: `password` (or your PostgreSQL password)
- **Test Database**: `knowledgegraph_test`

#### PostgreSQL Setup

```bash
# Install PostgreSQL (varies by system)
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql
# Windows: Download from postgresql.org

# Start PostgreSQL service
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql
# Windows: Use Services app

# Create test database
psql -U postgres -c "CREATE DATABASE knowledgegraph_test;"

# Verify connection (replace 'password' with your actual PostgreSQL password)
PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d knowledgegraph_test -c "SELECT version();"
```

## Test Configuration

### Environment Variables

```bash
# Test database connection (optional - defaults to in-memory SQLite)
KNOWLEDGEGRAPH_TEST_CONNECTION_STRING="sqlite://:memory:"

# For PostgreSQL testing (replace 'password' with your actual PostgreSQL password)
KNOWLEDGEGRAPH_TEST_CONNECTION_STRING="postgresql://postgres:password@localhost:5432/knowledgegraph_test"
```

### Jest Configuration

The project uses Jest with TypeScript support:

- **Config File**: `jest.config.js`
- **Setup File**: `tests/setup.ts`
- **Timeout**: 20 seconds for multi-backend tests
- **Environment**: Node.js

## Writing Tests

### Multi-Backend Test Pattern

```typescript
import { runTestsForAvailableBackends } from './utils/multi-backend-runner.js';
import { createTestManager, cleanupTestManager } from './utils/backend-test-helpers.js';

describe('My Feature Tests', () => {
  runTestsForAvailableBackends((config: StorageConfig, backendName: string) => {
    describe('Feature Tests', () => {
      let manager: any;

      beforeEach(async () => {
        manager = await createTestManager(config, backendName);
      });

      afterEach(async () => {
        await cleanupTestManager(manager, backendName);
      });

      test('should work on both backends', async () => {
        // Your test logic here
        // This will run against both SQLite and PostgreSQL
      });
    });
  });
});
```

### Backend-Specific Testing

```typescript
import { getBackendCapabilities } from './utils/backend-test-helpers.js';

test('should handle backend-specific behavior', async () => {
  const capabilities = getBackendCapabilities(config.type);

  if (capabilities.supportsDatabaseSearch) {
    // PostgreSQL-specific test logic
  } else {
    // SQLite-specific test logic
  }
});
```

## Troubleshooting

### Common Issues

**Input Validation Test Failures:**
```
Entity at index 0 must have a non-empty name
```
- Check that test data includes all required fields
- Verify observations arrays are not empty
- Ensure entity names and types are non-empty strings

**PostgreSQL Connection Errors:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `brew services start postgresql`
- Check connection string format
- Verify database exists: `psql -U postgres -l`

**Test Timeouts:**
```
Timeout - Async callback was not invoked within the 20000 ms timeout
```
- Increase timeout in test file: `test('name', async () => {...}, 30000)`
- Check for hanging database connections
- Verify test cleanup is working properly

**Module Import Errors:**
```
Cannot find module '../core.js'
```
- Run `npm run build` before testing
- Check TypeScript compilation errors
- Verify import paths are correct

### Debug Mode

Enable verbose logging:

```bash
# Run with debug output
DEBUG=knowledgegraph:* npm run test:multi-backend

# Jest verbose mode
npm run test:multi-backend -- --verbose

# Run specific test file
npx jest tests/storage-providers-multi-backend.test.ts --verbose
```

## Performance Expectations

### Typical Test Execution Times

| Backend | Test Suite | Expected Time |
|---------|------------|---------------|
| SQLite | Storage Tests | 2-5 seconds |
| SQLite | Search Tests | 5-10 seconds |
| SQLite | Validation Tests | 1-3 seconds |
| PostgreSQL | Storage Tests | 10-15 seconds |
| PostgreSQL | Search Tests | 15-25 seconds |
| **Total** | **All Tests** | **45-60 seconds** |

### Performance Thresholds

- **SQLite Operations**: < 1 second per operation
- **PostgreSQL Operations**: < 5 seconds per operation
- **Search Performance**: < 2 seconds for 100 entities
- **Memory Usage**: < 100MB during test execution

## Continuous Integration

The multi-backend testing infrastructure is designed for CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run Multi-Backend Tests
  run: |
    # Start PostgreSQL service
    sudo systemctl start postgresql
    sudo -u postgres createdb knowledgegraph_test

    # Run tests
    npm run test:comprehensive
```

## Contributing

When adding new tests:

1. **Use Multi-Backend Pattern**: Ensure tests work on both SQLite and PostgreSQL
2. **Add Performance Expectations**: Include timing assertions for critical paths
3. **Handle Backend Differences**: Use capability detection for backend-specific behavior
4. **Clean Up Resources**: Always clean up test data and connections
5. **Update Documentation**: Add new test categories to this guide

## Related Files

- `tests/utils/multi-backend-runner.ts` - Core multi-backend testing infrastructure
- `tests/utils/backend-test-helpers.ts` - Backend-specific utilities and helpers
- `MULTI_BACKEND_TESTING_PLAN.md` - Implementation plan and architecture details
- `tests/performance/README.md` - Performance testing specific documentation

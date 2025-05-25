# Performance Testing Suite

This directory contains comprehensive performance tests and benchmarks for the Knowledge Graph MCP service.

**Performance Test Coverage**: 17 performance tests as part of the complete 117-test suite across 11 test suites.

## Quick Start

```bash
# Run all performance tests
npm run test:performance

# Generate comprehensive benchmark report
npm run benchmark

# Run specific test categories
npm run benchmark:search    # Search performance
npm run benchmark:database  # Database performance (requires PostgreSQL)
npm run benchmark:load      # Load testing and stress tests
```

## Test Files

### Core Performance Tests

- **`search-performance.test.ts`** - Client-side search performance across different dataset sizes
- **`database-performance.test.ts`** - Database-level search performance (PostgreSQL/SQLite)
- **`load-testing.test.ts`** - Concurrent searches, high-frequency testing, and stress tests

### Utilities

- **`performance-utils.ts`** - Performance measurement utilities and test data generators
- **`benchmark-runner.ts`** - Comprehensive benchmark runner with report generation

## Performance Targets

| Test Category | Target | Max Acceptable |
|--------------|--------|----------------|
| Small dataset (100 entities) | < 50ms | < 100ms |
| Medium dataset (1K entities) | < 200ms | < 500ms |
| Large dataset (10K entities) | < 2000ms | < 5000ms |
| Memory usage (10K entities) | < 200MB | < 500MB |
| 10 concurrent searches | < 2000ms total | < 5000ms |

## Test Categories

### 1. Search Performance
- Tests Fuse.js fuzzy search across different dataset sizes
- Measures average, min, max, and median response times
- Includes memory usage analysis

### 2. Database Performance
- Compares PostgreSQL database-level vs client-side search
- Tests SQLite client-side search performance
- Requires PostgreSQL running on localhost:5432

### 3. Load Testing (7 tests)
- Concurrent search operations
- High-frequency sequential searches
- Massive dataset handling (50K+ entities)
- Memory pressure testing
- Edge case testing (empty queries, long queries, special characters)

### 4. Strategy Comparison (2 tests)
- PostgreSQL vs SQLite performance
- Search quality vs performance trade-offs

### 5. Threshold Analysis (5 tests)
- Impact of fuzzy search thresholds (0.1, 0.3, 0.5, 0.7, 0.9)
- Performance vs accuracy trade-offs

## Prerequisites

### For Basic Tests
```bash
npm install
npm run build
```

### For Database Tests
```bash
# PostgreSQL must be running on localhost:5432
# Database: knowledgegraph_test
# Credentials: postgres:1

# Verify connection
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT version();"

# Create test database
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE knowledgegraph_test;"

# Set environment variable for tests (or add to .env file)
export KNOWLEDGEGRAPH_TEST_CONNECTION_STRING="postgresql://postgres:1@localhost:5432/knowledgegraph_test"
```

## Running Tests

### Individual Test Files
```bash
# Search performance only
jest tests/performance/search-performance.test.ts --testTimeout=60000

# Database performance (requires PostgreSQL)
jest tests/performance/database-performance.test.ts --testTimeout=60000

# Load testing
jest tests/performance/load-testing.test.ts --testTimeout=120000
```

### With Custom Configuration
```bash
# Increase memory limit for large dataset tests
node --max-old-space-size=4096 node_modules/.bin/jest tests/performance/

# Enable garbage collection monitoring
node --expose-gc node_modules/.bin/jest tests/performance/

# Increase timeout for slow systems
jest tests/performance/ --testTimeout=300000
```

## Benchmark Reports

Benchmark reports are automatically generated and saved to `benchmark-reports/` directory:

```
benchmark-reports/
├── benchmark-report-2024-12-XX...json
└── ...
```

### Report Structure
```json
{
  "timestamp": "2024-12-XX...",
  "summary": {
    "totalTests": 12,
    "overallPerformance": "Excellent",
    "categories": {
      "Client-side Search": { "testCount": 3, "avgTime": 35.86 },
      "Memory Usage": { "testCount": 2, "avgTime": 0 },
      "Threshold Comparison": { "testCount": 5, "avgTime": 13.62 },
      "Strategy Comparison": { "testCount": 2, "avgTime": 5.32 }
    }
  },
  "results": [ ... ],
  "environment": {
    "nodeVersion": "v18.x.x",
    "platform": "darwin",
    "arch": "x64"
  }
}
```

## Performance Classifications

- **Excellent**: Large dataset search < 1000ms
- **Good**: Large dataset search < 2000ms
- **Acceptable**: Large dataset search < 5000ms
- **Needs Improvement**: Large dataset search > 5000ms

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql
# or
sudo systemctl status postgresql

# Test connection (using environment variable)
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1;"

# Or test with the configured test database
PGPASSWORD=1 psql -h localhost -p 5432 -U postgres -d knowledgegraph_test -c "SELECT 1;"
```

### Memory Issues
```bash
# Run with increased memory
node --max-old-space-size=8192 node_modules/.bin/jest tests/performance/

# Monitor memory usage
node --expose-gc --trace-gc node_modules/.bin/jest tests/performance/
```

### Timeout Issues
```bash
# For slow systems, increase timeout
jest tests/performance/ --testTimeout=600000
```

## Contributing

When adding new performance tests:

1. Use the `PerformanceUtils` class for consistent measurements
2. Include appropriate performance assertions
3. Add memory usage measurements for resource-intensive operations
4. Follow the existing test structure and naming conventions
5. Update performance targets if introducing new test categories

## Related Files

- `../../docs/PERFORMANCE_TESTING.md` - Comprehensive performance testing documentation
- `../../scripts/run-benchmarks.ts` - Benchmark execution script
- `../setup.ts` - Global test setup (mocked for performance tests)
- `../../README.md` - Main project documentation

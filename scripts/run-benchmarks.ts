#!/usr/bin/env node

import { BenchmarkRunner } from '../tests/performance/benchmark-runner.js';

/**
 * Script to run performance benchmarks for the knowledge graph MCP service
 */
async function main() {
  console.log('🎯 Knowledge Graph MCP Performance Benchmarks');
  console.log('='.repeat(50));
  console.log('');

  try {
    const runner = new BenchmarkRunner();
    const report = await runner.runAllBenchmarks();

    console.log('\n📊 Benchmark Summary');
    console.log('='.repeat(30));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Overall Performance: ${report.summary.overallPerformance}`);
    console.log('');

    // Display category summaries
    for (const [category, stats] of Object.entries(report.summary.categories)) {
      console.log(`${category}:`);
      if (stats.avgTime > 0) {
        console.log(`  Average Time: ${stats.avgTime.toFixed(2)}ms`);
        console.log(`  Range: ${stats.minTime.toFixed(2)}ms - ${stats.maxTime.toFixed(2)}ms`);
      }
      console.log(`  Tests: ${stats.testCount}`);
      console.log('');
    }

    console.log('✅ All benchmarks completed successfully!');
    console.log(`📄 Detailed report saved in benchmark-reports/ directory`);

  } catch (error) {
    console.error('❌ Benchmark execution failed:', error);
    process.exit(1);
  }
}

// Run the benchmarks if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };

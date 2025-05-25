import { promises as fs } from 'fs';
import path from 'path';
import { Entity } from '../../core.js';
import { SearchConfig } from '../../search/types.js';
import { PostgreSQLFuzzyStrategy } from '../../search/strategies/postgresql-strategy.js';
import { SQLiteFuzzyStrategy } from '../../search/strategies/sqlite-strategy.js';
import { PerformanceUtils } from './performance-utils.js';

/**
 * Comprehensive benchmark runner for the knowledge graph MCP service
 */
export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * Run all benchmarks and generate a comprehensive report
   */
  async runAllBenchmarks(): Promise<BenchmarkReport> {
    console.log('🚀 Starting Knowledge Graph MCP Performance Benchmarks...\n');

    // Client-side search benchmarks
    await this.runClientSideSearchBenchmarks();
    
    // Memory usage benchmarks
    await this.runMemoryBenchmarks();
    
    // Threshold comparison benchmarks
    await this.runThresholdBenchmarks();
    
    // Strategy comparison benchmarks
    await this.runStrategyComparisonBenchmarks();

    const report = this.generateReport();
    await this.saveReport(report);
    
    return report;
  }

  private async runClientSideSearchBenchmarks() {
    console.log('📊 Running Client-side Search Benchmarks...');
    
    const config: SearchConfig = {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true
    };

    const datasets = [
      { name: 'Small (100 entities)', size: 100, iterations: 50 },
      { name: 'Medium (1000 entities)', size: 1000, iterations: 20 },
      { name: 'Large (10000 entities)', size: 10000, iterations: 10 }
    ];

    for (const dataset of datasets) {
      const entities = PerformanceUtils.generateRealisticTestEntities(dataset.size);
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(entities, 'JavaScript');
      }, dataset.iterations);

      this.results.push({
        category: 'Client-side Search',
        test: dataset.name,
        avgTime: benchmark.avgTime,
        minTime: benchmark.minTime,
        maxTime: benchmark.maxTime,
        medianTime: benchmark.medianTime,
        stdDev: benchmark.stdDev,
        iterations: dataset.iterations,
        resultsCount: benchmark.results[0].length,
        metadata: {
          entityCount: dataset.size,
          searchTerm: 'JavaScript'
        }
      });

      console.log(`  ✅ ${dataset.name}: ${benchmark.avgTime.toFixed(2)}ms avg`);
    }
  }

  private async runMemoryBenchmarks() {
    console.log('\n🧠 Running Memory Usage Benchmarks...');
    
    const config: SearchConfig = {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true
    };

    const datasets = [
      { name: 'Small (100 entities)', size: 100 },
      { name: 'Large (10000 entities)', size: 10000 }
    ];

    for (const dataset of datasets) {
      const entities = PerformanceUtils.generateRealisticTestEntities(dataset.size);
      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const memoryTest = await PerformanceUtils.measureMemory(async () => {
        return strategy.searchClientSide(entities, 'Node.js');
      });

      this.results.push({
        category: 'Memory Usage',
        test: dataset.name,
        avgTime: 0, // Not applicable for memory tests
        minTime: 0,
        maxTime: 0,
        medianTime: 0,
        stdDev: 0,
        iterations: 1,
        resultsCount: memoryTest.result.length,
        metadata: {
          entityCount: dataset.size,
          memoryUsed: memoryTest.memoryUsed,
          heapBefore: memoryTest.heapUsedBefore,
          heapAfter: memoryTest.heapUsedAfter,
          searchTerm: 'Node.js'
        }
      });

      console.log(`  ✅ ${dataset.name}: ${PerformanceUtils.formatMemoryUsage(memoryTest.memoryUsed)} used`);
    }
  }

  private async runThresholdBenchmarks() {
    console.log('\n🎯 Running Threshold Comparison Benchmarks...');
    
    const entities = PerformanceUtils.generateRealisticTestEntities(1000);
    const thresholds = [0.1, 0.3, 0.5, 0.7, 0.9];

    for (const threshold of thresholds) {
      const config: SearchConfig = {
        useDatabaseSearch: false,
        threshold,
        clientSideFallback: true
      };

      const mockPool = {} as any;
      const strategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');

      const benchmark = await PerformanceUtils.runBenchmark(async () => {
        return strategy.searchClientSide(entities, 'JavaScrpt'); // Intentional typo
      }, 20);

      this.results.push({
        category: 'Threshold Comparison',
        test: `Threshold ${threshold}`,
        avgTime: benchmark.avgTime,
        minTime: benchmark.minTime,
        maxTime: benchmark.maxTime,
        medianTime: benchmark.medianTime,
        stdDev: benchmark.stdDev,
        iterations: 20,
        resultsCount: benchmark.results[0].length,
        metadata: {
          threshold,
          entityCount: 1000,
          searchTerm: 'JavaScrpt'
        }
      });

      console.log(`  ✅ Threshold ${threshold}: ${benchmark.avgTime.toFixed(2)}ms avg, ${benchmark.results[0].length} results`);
    }
  }

  private async runStrategyComparisonBenchmarks() {
    console.log('\n⚖️  Running Strategy Comparison Benchmarks...');
    
    const config: SearchConfig = {
      useDatabaseSearch: false,
      threshold: 0.3,
      clientSideFallback: true
    };

    const entities = PerformanceUtils.generateRealisticTestEntities(1000);
    const mockPool = {} as any;
    const mockDb = {} as any;

    // PostgreSQL strategy
    const pgStrategy = new PostgreSQLFuzzyStrategy(config, mockPool, 'test-project');
    const pgBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return pgStrategy.searchClientSide(entities, 'Docker');
    }, 20);

    this.results.push({
      category: 'Strategy Comparison',
      test: 'PostgreSQL Strategy',
      avgTime: pgBenchmark.avgTime,
      minTime: pgBenchmark.minTime,
      maxTime: pgBenchmark.maxTime,
      medianTime: pgBenchmark.medianTime,
      stdDev: pgBenchmark.stdDev,
      iterations: 20,
      resultsCount: pgBenchmark.results[0].length,
      metadata: {
        strategy: 'PostgreSQL',
        entityCount: 1000,
        searchTerm: 'Docker'
      }
    });

    // SQLite strategy
    const sqliteStrategy = new SQLiteFuzzyStrategy(config, mockDb, 'test-project');
    const sqliteBenchmark = await PerformanceUtils.runBenchmark(async () => {
      return sqliteStrategy.searchClientSide(entities, 'Docker');
    }, 20);

    this.results.push({
      category: 'Strategy Comparison',
      test: 'SQLite Strategy',
      avgTime: sqliteBenchmark.avgTime,
      minTime: sqliteBenchmark.minTime,
      maxTime: sqliteBenchmark.maxTime,
      medianTime: sqliteBenchmark.medianTime,
      stdDev: sqliteBenchmark.stdDev,
      iterations: 20,
      resultsCount: sqliteBenchmark.results[0].length,
      metadata: {
        strategy: 'SQLite',
        entityCount: 1000,
        searchTerm: 'Docker'
      }
    });

    console.log(`  ✅ PostgreSQL: ${pgBenchmark.avgTime.toFixed(2)}ms avg`);
    console.log(`  ✅ SQLite: ${sqliteBenchmark.avgTime.toFixed(2)}ms avg`);
  }

  private generateReport(): BenchmarkReport {
    const timestamp = new Date().toISOString();
    const summary = this.generateSummary();
    
    return {
      timestamp,
      summary,
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryLimit: process.memoryUsage().rss
      }
    };
  }

  private generateSummary(): BenchmarkSummary {
    const categories = [...new Set(this.results.map(r => r.category))];
    const categoryStats: Record<string, any> = {};

    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      const avgTimes = categoryResults.map(r => r.avgTime).filter(t => t > 0);
      
      if (avgTimes.length > 0) {
        categoryStats[category] = {
          testCount: categoryResults.length,
          avgTime: avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length,
          minTime: Math.min(...avgTimes),
          maxTime: Math.max(...avgTimes)
        };
      } else {
        categoryStats[category] = {
          testCount: categoryResults.length,
          avgTime: 0,
          minTime: 0,
          maxTime: 0
        };
      }
    }

    return {
      totalTests: this.results.length,
      categories: categoryStats,
      overallPerformance: this.assessOverallPerformance()
    };
  }

  private assessOverallPerformance(): string {
    const searchResults = this.results.filter(r => r.category === 'Client-side Search');
    const largeDatasetResult = searchResults.find(r => r.test.includes('Large'));
    
    if (!largeDatasetResult) return 'Unknown';
    
    if (largeDatasetResult.avgTime < 1000) return 'Excellent';
    if (largeDatasetResult.avgTime < 2000) return 'Good';
    if (largeDatasetResult.avgTime < 5000) return 'Acceptable';
    return 'Needs Improvement';
  }

  private async saveReport(report: BenchmarkReport): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'benchmark-reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const filename = `benchmark-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(reportsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Benchmark report saved to: ${filepath}`);
  }
}

export interface BenchmarkResult {
  category: string;
  test: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  stdDev: number;
  iterations: number;
  resultsCount: number;
  metadata: Record<string, any>;
}

export interface BenchmarkSummary {
  totalTests: number;
  categories: Record<string, any>;
  overallPerformance: string;
}

export interface BenchmarkReport {
  timestamp: string;
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryLimit: number;
  };
}

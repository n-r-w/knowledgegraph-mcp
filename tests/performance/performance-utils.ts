import { Entity } from '../../core.js';

/**
 * Performance measurement utilities for benchmarking
 */
export class PerformanceUtils {
  /**
   * Measure execution time of an async function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, timeMs: end - start };
  }

  /**
   * Measure execution time of a sync function
   */
  static measureTimeSync<T>(fn: () => T): { result: T; timeMs: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, timeMs: end - start };
  }

  /**
   * Run a function multiple times and get statistics
   */
  static async runBenchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{
    results: T[];
    times: number[];
    avgTime: number;
    minTime: number;
    maxTime: number;
    medianTime: number;
    stdDev: number;
  }> {
    const results: T[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, timeMs } = await this.measureTime(fn);
      results.push(result);
      times.push(timeMs);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const sortedTimes = [...times].sort((a, b) => a - b);
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    return {
      results,
      times,
      avgTime,
      minTime,
      maxTime,
      medianTime,
      stdDev
    };
  }

  /**
   * Measure memory usage before and after a function execution
   */
  static async measureMemory<T>(fn: () => Promise<T>): Promise<{
    result: T;
    memoryUsed: number;
    heapUsedBefore: number;
    heapUsedAfter: number;
  }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage();
    const result = await fn();
    const memAfter = process.memoryUsage();

    return {
      result,
      memoryUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapUsedBefore: memBefore.heapUsed,
      heapUsedAfter: memAfter.heapUsed
    };
  }

  /**
   * Generate test entities for performance testing
   */
  static generateTestEntities(count: number): Entity[] {
    const entities: Entity[] = [];
    const entityTypes = ['Person', 'Company', 'Technology', 'Project', 'Concept', 'Location'];
    const sampleObservations = [
      'This is a test observation',
      'Another observation for testing',
      'Performance testing data',
      'Sample entity observation',
      'Test data for benchmarking'
    ];
    const sampleTags = ['test', 'performance', 'benchmark', 'data', 'sample', 'entity'];

    for (let i = 0; i < count; i++) {
      const entityType = entityTypes[i % entityTypes.length];
      const numObservations = Math.floor(Math.random() * 5) + 1;
      const numTags = Math.floor(Math.random() * 4) + 1;

      entities.push({
        name: `${entityType}_${i}`,
        entityType,
        observations: Array.from({ length: numObservations }, (_, j) => 
          `${sampleObservations[j % sampleObservations.length]} ${i}`
        ),
        tags: Array.from({ length: numTags }, (_, j) => 
          `${sampleTags[j % sampleTags.length]}_${i % 10}`
        )
      });
    }

    return entities;
  }

  /**
   * Generate realistic test entities with varied content
   */
  static generateRealisticTestEntities(count: number): Entity[] {
    const entities: Entity[] = [];
    const names = [
      'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Django',
      'Flask', 'FastAPI', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
      'AWS', 'Azure', 'Google Cloud', 'GitHub', 'GitLab', 'Jenkins', 'CircleCI',
      'Webpack', 'Vite', 'Babel', 'ESLint', 'Prettier', 'Jest', 'Cypress', 'Playwright'
    ];
    
    const entityTypes = ['Technology', 'Framework', 'Library', 'Tool', 'Platform', 'Service'];
    
    const observations = [
      'Popular programming language used for web development',
      'Modern framework for building user interfaces',
      'Database management system with ACID compliance',
      'Cloud platform providing scalable infrastructure',
      'Version control system for collaborative development',
      'Containerization platform for application deployment',
      'Testing framework for JavaScript applications',
      'Build tool for modern web applications'
    ];

    const tags = [
      'frontend', 'backend', 'database', 'cloud', 'devops', 'testing', 'build-tools',
      'javascript', 'python', 'web', 'mobile', 'api', 'microservices', 'containers'
    ];

    for (let i = 0; i < count; i++) {
      const name = names[i % names.length];
      const entityType = entityTypes[i % entityTypes.length];
      const numObservations = Math.floor(Math.random() * 3) + 1;
      const numTags = Math.floor(Math.random() * 5) + 2;

      entities.push({
        name: `${name}_${Math.floor(i / names.length)}`,
        entityType,
        observations: Array.from({ length: numObservations }, (_, j) => 
          `${observations[j % observations.length]} (variant ${i})`
        ),
        tags: Array.from({ length: numTags }, (_, j) => 
          tags[(i + j) % tags.length]
        )
      });
    }

    return entities;
  }

  /**
   * Format benchmark results for display
   */
  static formatBenchmarkResults(results: {
    avgTime: number;
    minTime: number;
    maxTime: number;
    medianTime: number;
    stdDev: number;
  }): string {
    return `
Average: ${results.avgTime.toFixed(2)}ms
Median:  ${results.medianTime.toFixed(2)}ms
Min:     ${results.minTime.toFixed(2)}ms
Max:     ${results.maxTime.toFixed(2)}ms
StdDev:  ${results.stdDev.toFixed(2)}ms
    `.trim();
  }

  /**
   * Format memory usage for display
   */
  static formatMemoryUsage(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

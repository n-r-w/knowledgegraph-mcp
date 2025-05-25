import { promises as fs } from 'fs';
import path from 'path';

// Setup test environment
beforeEach(async () => {
  // Clean up any test files before each test
  const testDir = path.join(process.cwd(), 'test-data');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
  }
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // If mkdir fails, try to ensure parent directories exist
    console.warn('Failed to create test directory, attempting to create parent directories:', error);
    try {
      await fs.mkdir(path.dirname(testDir), { recursive: true });
      await fs.mkdir(testDir, { recursive: true });
    } catch (retryError) {
      // If it still fails, log but don't fail the test
      console.warn('Could not create test directory, tests may fail:', retryError);
    }
  }
});

afterEach(async () => {
  // Clean up test files after each test
  const testDir = path.join(process.cwd(), 'test-data');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, which is fine
  }
});

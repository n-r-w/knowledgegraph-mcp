import { resolveProject, validateProjectName } from '../utils.js';
describe('Project Resolution Functions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.KNOWLEDGEGRAPH_PROJECT;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('resolveProject', () => {
    test('should return tool parameter when provided', () => {
      process.env.KNOWLEDGEGRAPH_PROJECT = 'env_project';
      const result = resolveProject('tool_project');
      expect(result).toBe('tool_project');
    });

    test('should return environment variable when no tool parameter', () => {
      process.env.KNOWLEDGEGRAPH_PROJECT = 'env_project';
      const result = resolveProject();
      expect(result).toBe('env_project');
    });

    test('should return default when no tool parameter or env var', () => {
      const result = resolveProject();
      expect(result).toBe('knowledgegraph_default_project');
    });

    test('should return tool parameter over environment variable', () => {
      process.env.KNOWLEDGEGRAPH_PROJECT = 'env_project';
      const result = resolveProject('tool_project');
      expect(result).toBe('tool_project');
    });
  });

  describe('validateProjectName', () => {
    test('should accept valid project names', () => {
      const validNames = ['project1', 'my-project', 'my_project', 'Project123'];
      validNames.forEach(name => {
        expect(validateProjectName(name)).toBe(true);
      });
    });

    test('should reject invalid project names', () => {
      const invalidNames = ['', 'project with spaces', 'project@special', 'project/slash'];
      invalidNames.forEach(name => {
        expect(validateProjectName(name)).toBe(false);
      });
    });

    test('should reject very long project names', () => {
      const longName = 'a'.repeat(101);
      expect(validateProjectName(longName)).toBe(false);
    });
  });


});

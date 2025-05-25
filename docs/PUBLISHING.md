# Publishing Guide for knowledgegraph-mcp

This guide explains how to publish the knowledgegraph-mcp package to npm.

## Prerequisites

1. **npm Account**: Create an account at [npmjs.com](https://www.npmjs.com/)
2. **npm CLI**: Install and login to npm
3. **Git**: Ensure all changes are committed

## Setup npm CLI

```bash
# Install npm CLI (if not already installed)
npm install -g npm

# Login to npm
npm login
# Enter your username, password, and email when prompted

# Verify login
npm whoami
# Should show your npm username
```

## Publishing Process

### Option 1: Automated Publishing (Recommended)

Use the built-in scripts for automatic version bumping and publishing:

```bash
# For patch version (0.6.3 -> 0.6.4)
npm run publish:patch

# For minor version (0.6.3 -> 0.7.0)
npm run publish:minor

# For major version (0.6.3 -> 1.0.0)
npm run publish:major
```

These scripts will:
1. Run tests to ensure everything works
2. Bump the version number
3. Build the project
4. Commit the version change
5. Create a git tag
6. Push to GitHub
7. Publish to npm

### Option 2: Manual Publishing

```bash
# 1. Run tests
npm test

# 2. Build the project
npm run build

# 3. Bump version manually
npm version patch  # or minor/major

# 4. Publish to npm
npm publish
```

## Pre-publish Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] README.md is up to date
- [ ] Version number is appropriate
- [ ] Git repository is clean (no uncommitted changes)
- [ ] You're logged into npm: `npm whoami`

## Verification

After publishing:

1. **Check npm registry**:
   ```bash
   npm view knowledgegraph-mcp
   ```

2. **Test installation**:
   ```bash
   npx knowledgegraph-mcp --help
   ```

3. **Verify package contents**:
   ```bash
   npm pack --dry-run
   ```

## Troubleshooting

### "Package already exists"
If you get this error, the package name is taken. You'll need to:
1. Choose a different name in package.json
2. Update all references in README.md
3. Try publishing again

### "Not logged in"
```bash
npm login
```

### "Permission denied"
Make sure you're the owner of the package or have publishing rights.

## Package Information

- **Package Name**: knowledgegraph-mcp
- **Registry**: https://www.npmjs.com/
- **Repository**: https://github.com/n-r-w/knowledgegraph-mcp
- **Binary Command**: `knowledgegraph-mcp`

## Files Included in Package

The package includes only essential files:
- `dist/` - Compiled JavaScript files
- `scripts/` - Utility scripts
- `README.md` - Documentation
- `package.json` - Package metadata

Development files are excluded via `.npmignore`.

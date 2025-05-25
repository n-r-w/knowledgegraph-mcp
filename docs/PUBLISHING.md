# Publishing Guide for knowledgegraph-mcp

This guide explains how to publish the knowledgegraph-mcp package to npm and manage versions properly.

## Prerequisites

1. **npm Account**: Create an account at [npmjs.com](https://www.npmjs.com/)
2. **npm CLI**: Install and login to npm
3. **Git**: Ensure all changes are committed
4. **Taskfile**: Install [Task](https://taskfile.dev/) for running commands

## Setup npm CLI

```bash
# Install npm CLI (if not already installed)
npm install -g npm

# Login to npm
npm login
# Enter your username, password, and email when prompted

# Verify login
task npm:check-auth
# Should show your npm username
```

## Quick Start (Recommended)

### Using Taskfile Commands

The easiest way to publish is using the Taskfile commands that handle all the complexity:

```bash
# Check if ready to publish
task publish:check

# Publish a patch version (0.6.8 -> 0.6.9)
task publish:patch

# Publish a minor version (0.6.8 -> 0.7.0)
task publish:minor

# Publish a major version (0.6.8 -> 1.0.0)
task publish:major
```

These commands will:
1. ✅ Run all tests and validations
2. 🔄 Sync git tags to avoid conflicts
3. 📦 Bump the version number
4. 💾 Commit the version change
5. 🏷️ Create a git tag
6. 🚀 Push to GitHub
7. 📤 Publish to npm

## Fixing Tag Conflicts

If you encounter git tag conflicts (like the error you experienced), use these commands:

### Check Current State
```bash
# View current version
task version:current

# List all tags (local and remote)
task git:list-tags

# Check what next versions would be
task version:next
```

### Fix Tag Conflicts
```bash
# Sync tags from remote (recommended first step)
task git:sync-tags

# If that doesn't work, force sync (deletes all local tags and re-fetches)
task git:force-sync-tags

# Delete a specific problematic tag
task git:delete-tag TAG=v0.6.7
```

### Clean Publishing After Fixing Tags
```bash
# After fixing tags, publish normally
task publish:patch
```

## Managing Published Versions

### View Package Information
```bash
# View current published package
task npm:view-package

# Check authentication
task npm:check-auth
```

### Remove Bad Versions
```bash
# Unpublish a specific version (use within 72 hours of publishing)
task npm:unpublish VERSION=0.6.7

# Deprecate a version (recommended for older versions)
task npm:deprecate VERSION=0.6.7 MESSAGE="Use latest version"
```

## Manual Publishing (Alternative)

If you prefer not to use Taskfile:

```bash
# 1. Check authentication
npm whoami

# 2. Sync tags first
git fetch --tags

# 3. Run tests
npm test

# 4. Build the project
npm run build

# 5. Bump version (without creating git tag)
npm version patch --no-git-tag-version

# 6. Commit and tag manually
VERSION=$(node -p "require('./package.json').version")
git add package.json package-lock.json
git commit -m "chore: bump version to v$VERSION"
git tag -a "v$VERSION" -m "Release v$VERSION"

# 7. Push everything
git push origin main
git push origin --tags

# 8. Publish to npm
npm publish
```

## Pre-publish Checklist

The `task publish:check` command automatically verifies:

- [ ] All tests pass
- [ ] Build succeeds
- [ ] Package can be created
- [ ] No linting errors

Additional manual checks:
- [ ] README.md is up to date
- [ ] Version number is appropriate
- [ ] Git repository is clean (no uncommitted changes)
- [ ] You're logged into npm

## Verification

After publishing:

```bash
# Check npm registry
task npm:view-package

# Test installation
npx knowledgegraph-mcp@latest --help

# Verify package contents
npm pack --dry-run
```

## Troubleshooting

### Git Tag Conflicts
**Error**: `! [rejected] v0.6.7 -> v0.6.7 (already exists)`

**Solution**:
```bash
# Option 1: Sync tags and try again
task git:sync-tags
task publish:patch

# Option 2: Delete conflicting tag
task git:delete-tag TAG=v0.6.7
task publish:patch

# Option 3: Force sync all tags
task git:force-sync-tags
task publish:patch
```

### NPM Authentication Issues
**Error**: `npm ERR! code ENEEDAUTH`

**Solution**:
```bash
npm login
task npm:check-auth
```

### Version Already Published
**Error**: `npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/knowledgegraph-mcp`

**Solution**: You cannot republish the same version. Bump to next version:
```bash
task publish:patch  # This will create a new version
```

### Package Name Conflicts
If the package name is taken, you'll need to:
1. Choose a different name in package.json
2. Update all references in README.md
3. Try publishing again

## Package Information

- **Package Name**: knowledgegraph-mcp
- **Registry**: https://www.npmjs.com/package/knowledgegraph-mcp
- **Repository**: https://github.com/n-r-w/knowledgegraph-mcp
- **Binary Command**: `knowledgegraph-mcp`

## Files Included in Package

The package includes only essential files (see `.npmignore`):
- `dist/` - Compiled JavaScript files
- `scripts/` - Utility scripts
- `README.md` - Documentation
- `package.json` - Package metadata

Development files are excluded: `src/`, `tests/`, `.env`, etc.

## Available Taskfile Commands

Run `task --list` to see all available commands, including:

**Publishing**:
- `task publish:check` - Validate before publishing
- `task publish:patch` - Publish patch version
- `task publish:minor` - Publish minor version
- `task publish:major` - Publish major version
- `task publish:dry-run` - Test publishing without actually publishing

**Version Management**:
- `task version:current` - Show current version
- `task version:next` - Show what next versions would be

**Git Tag Management**:
- `task git:list-tags` - List all tags
- `task git:sync-tags` - Sync tags from remote
- `task git:delete-tag TAG=v1.0.0` - Delete specific tag
- `task git:force-sync-tags` - Force sync all tags

**NPM Management**:
- `task npm:check-auth` - Check authentication
- `task npm:view-package` - View published package
- `task npm:unpublish VERSION=1.0.0` - Unpublish version
- `task npm:deprecate VERSION=1.0.0` - Deprecate version

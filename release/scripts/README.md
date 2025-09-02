# Release Scripts Documentation

This directory contains scripts for managing the release process of the Food Track Pro application.

## Scripts Overview

### Main Release Script
- `release.js` - Main release script that handles version updates, building, and git operations

### Publishing Scripts
- `publish-github.js` - Dedicated GitHub release publishing with failure handling
- `publish-supabase.js` - Supabase Edge Function publishing for release notifications

### Utility Scripts
- `release-config.js` - Release configuration file
- `release-manifest.js` - Release manifest management

## NPM Commands

### Full Release Process
```bash
npm run release          # Complete release process (build, version, git)
npm run publish:github   # Publish to GitHub (after release)
npm run publish:supabase # Publish to Supabase (after release)
```

### Independent Commands for Troubleshooting

#### Build & Package
```bash
npm run build:only       # Build application only
npm run package:only     # Package application only (after build)
```

#### Git Operations
```bash
npm run git:tag          # Create git tag for current version
npm run git:push         # Push changes and tags to remote
```

#### Publishing
```bash
npm run publish:github   # Publish release to GitHub
npm run publish:supabase # Publish release to Supabase
```

## Troubleshooting Workflow

If the release process fails, you can execute steps independently:

### 1. Build Issues
```bash
# Test build independently
npm run build:only

# If successful, test packaging
npm run package:only
```

### 2. Git Issues
```bash
# Create tag manually
npm run git:tag

# Push changes manually
npm run git:push
```

### 3. Publishing Issues

#### GitHub Publishing
```bash
# Publish to GitHub independently
npm run publish:github
```

**Note**: The GitHub publishing script includes automatic cleanup:
- If release creation fails, no cleanup is needed
- If asset upload fails, the script automatically removes the created release
- If any step fails, git tags are automatically removed

#### Supabase Publishing
```bash
# Publish to Supabase independently
npm run publish:supabase
```

### 4. Recovery from Failed Release

If a release fails partway through:

1. **Check what was completed**:
   ```bash
   git status                    # Check for uncommitted changes
   git tag -l | grep v1.x.x     # Check if tag was created
   ```

2. **Clean up if needed**:
   ```bash
   git tag -d v1.x.x            # Remove local tag
   git push origin :refs/tags/v1.x.x  # Remove remote tag
   git checkout -- package.json CHANGELOG.md  # Reset files if needed
   ```

3. **Restart from specific step**:
   ```bash
   # Fix the issue, then continue from where it failed
   npm run build:only           # If build failed
   npm run git:tag              # If git operations failed
   npm run publish:github       # If publishing failed
   ```

## Environment Variables

### Required for GitHub Publishing
- `GH_TOKEN` - GitHub personal access token with repo permissions

### Required for Supabase Publishing
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Configuration

Edit `release-config.js` to customize:
- Version numbers
- Release notes
- Platform configurations
- GitHub/Supabase settings
- Build options

## Error Handling

### GitHub Publishing
- Automatic release cleanup on failure
- Automatic git tag removal on failure
- Detailed error logging

### Supabase Publishing
- Validates environment variables
- Provides clear error messages
- Safe to retry

### Build Process
- Validates installer files after build
- Prevents partial releases
- Clear error reporting
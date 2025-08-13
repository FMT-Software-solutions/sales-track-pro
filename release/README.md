# SalesTrack Pro Release Process

This directory contains the automated release system for SalesTrack Pro Electron application.

## Overview

The release system handles:
- Version management and validation
- Electron app building and packaging
- Publishing release information to Supabase
- Automatic update checking within the app

## Quick Start

### Prerequisites

1. **Environment Variables**: Create a `.env` file in the project root with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

3. **Database**: Run the migration to create the `app_versions` table:
   ```sql
   -- Run the migration: supabase/migrations/20250107000000_create_app_versions.sql
   ```

### Creating a Release

1. **Run the release script**:
   ```bash
   # Windows (Command Prompt)
   release\scripts\release.bat

   # Windows (PowerShell)
   release\scripts\release.ps1

   # Unix/Linux/macOS
   release/scripts/release.sh
   ```

2. **Follow the prompts**:
   - Enter the new version number (e.g., 1.0.1)
   - Provide release notes
   - Confirm the release details

3. **The script will**:
   - Update package.json version
   - Build the Electron application
   - Package for distribution
   - Create Git commit and tag
   - Publish to Supabase as draft

### Managing Releases

Use the release manifest utility to manage releases:

```bash
# View current releases
node release/scripts/release-manifest.js status

# Update a release status
node release/scripts/release-manifest.js update-status 1.0.1 published

# Add a new release manually
node release/scripts/release-manifest.js add 1.0.1 "Bug fixes and improvements"
```

### Publishing Releases

Releases are initially created as drafts in Supabase. To make them available for auto-updates:

1. **Update status to published**:
   ```bash
   node release/scripts/release-manifest.js update-status 1.0.1 published
   ```

2. **Or update directly in Supabase**:
   ```sql
   UPDATE app_versions 
   SET status = 'published' 
   WHERE version = '1.0.1';
   ```

## File Structure

```
release/
├── README.md                 # This file
├── RELEASE_NOTES.md         # Template for release notes
├── release-manifest.json    # Local release tracking
├── assets/
│   └── icon.svg            # Application icon
└── scripts/
    ├── release.js          # Main release script
    ├── release.bat         # Windows batch script
    ├── release.ps1         # PowerShell script
    ├── release.sh          # Unix shell script
    ├── publish-supabase.js # Supabase publishing
    └── release-manifest.js # Manifest management
```

## Update Checking

The application includes automatic update checking:

- **Automatic**: Checks every 4 hours when enabled
- **Manual**: Users can check via Settings > Software Updates
- **Notifications**: Shows update notifications with download options

### How It Works

1. App queries Supabase for published versions
2. Compares current version with latest available
3. Shows update notification if newer version exists
4. Downloads open in default browser
5. Users manually install and restart

## Configuration

### Electron Builder

Configuration is in `electron-builder.yml`:
- Output directory: `dist-electron`
- Supported platforms: Windows, macOS, Linux
- Package formats: NSIS (Windows), DMG (macOS), AppImage (Linux)

### Version Comparison

Uses semantic versioning (semver) for version comparison:
- Format: `MAJOR.MINOR.PATCH`
- Example: `1.0.0` < `1.0.1` < `1.1.0` < `2.0.0`

## Troubleshooting

### Common Issues

1. **Environment variables not loaded**:
   - Ensure `.env` file exists in project root
   - Check variable names match exactly

2. **Supabase connection failed**:
   - Verify URL and API key are correct
   - Check network connectivity
   - Ensure RLS policies allow access

3. **Build failures**:
   - Run `npm run build` first to check for errors
   - Ensure all dependencies are installed
   - Check Node.js version compatibility

4. **Version conflicts**:
   - Ensure version doesn't already exist
   - Use semantic versioning format
   - Check Git working directory is clean

### Debug Mode

Run scripts with debug output:
```bash
DEBUG=1 node release/scripts/release.js
```

## Security Notes

- API keys should never be committed to version control
- Use environment variables for sensitive configuration
- RLS policies restrict database access appropriately
- Downloads should be served over HTTPS

## Support

For issues with the release process:
1. Check this README for common solutions
2. Review script output for error messages
3. Verify environment configuration
4. Check Supabase logs for API errors
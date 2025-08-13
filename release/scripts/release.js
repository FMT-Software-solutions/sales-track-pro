#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const manifestUtils = require('./release-manifest');
const publishSupabase = require('./publish-supabase');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return result;
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

function isValidChangelogEntry(entry) {
  const hasAddedSection = entry.includes('### Added');
  const hasFixedSection = entry.includes('### Fixed');
  const hasChangedSection = entry.includes('### Changed');
  
  return hasAddedSection || hasFixedSection || hasChangedSection;
}

async function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

async function updatePackageVersion(newVersion) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

async function updateChangelog(version, changelogEntry) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  let changelog = '';
  
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Check if version already exists
  if (changelog.includes(`## [${version}]`)) {
    throw new Error(`Version ${version} already exists in changelog`);
  }

  const date = new Date().toISOString().split('T')[0];
  const newEntry = `## [${version}] - ${date}\n\n${changelogEntry}\n\n`;
  
  // Insert after the header
  const lines = changelog.split('\n');
  const insertIndex = lines.findIndex(line => line.startsWith('## [')) || 3;
  lines.splice(insertIndex, 0, ...newEntry.split('\n'));
  
  fs.writeFileSync(changelogPath, lines.join('\n'));
}

async function buildApplication() {
  log.step('Building application...');
  execCommand('npm run build');
  log.success('Application built successfully');
}

async function packageElectron() {
  log.step('Packaging Electron application...');
  execCommand('npm run package');
  log.success('Electron application packaged successfully');
}

async function createGitCommitAndTag(version) {
  log.step('Creating git commit and tag...');
  
  // Check if tag already exists
  try {
    execCommand(`git rev-parse v${version}`, { silent: true });
    throw new Error(`Git tag v${version} already exists`);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      // Tag doesn't exist, which is what we want
    } else {
      throw error;
    }
  }

  execCommand('git add package.json CHANGELOG.md');
  execCommand(`git commit -m "Release v${version}"`);
  execCommand(`git tag v${version}`);
  
  log.success(`Git commit and tag v${version} created`);
}

async function publishToSupabase(version, releaseNotes) {
  log.step('Publishing to Supabase...');
  
  try {
    // Get the built files
    const releaseDir = path.join(process.cwd(), 'release', 'build');
    const files = fs.readdirSync(releaseDir);
    const setupFile = files.find(file => file.includes('setup') && file.endsWith('.exe'));
    
    if (!setupFile) {
      throw new Error('Setup file not found in release/build directory');
    }

    const filePath = path.join(releaseDir, setupFile);
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Create release manifest entry
    const releaseData = {
      version,
      platform: 'win32',
      architecture: 'x64',
      download_url: `https://your-domain.com/releases/${setupFile}`, // You'll need to update this
      file_size: fileSize,
      release_notes: releaseNotes,
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    // Save to release manifest
    const manifestPath = path.join(process.cwd(), 'release', 'release-manifest.json');
    let manifest = { releases: [] };
    
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    
    manifest.releases.unshift(releaseData);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Run the Supabase publish script
    execCommand('npm run publish:supabase');
    
    log.success('Published to Supabase as draft');
  } catch (error) {
    log.warning(`Failed to publish to Supabase: ${error.message}`);
    log.info('You can manually publish later using: npm run publish:supabase');
  }
}

async function main() {
  try {
    log.header('🚀 SalesTrack Pro Release Script');

    const currentVersion = await getCurrentVersion();
    log.info(`Current version: ${currentVersion}`);

    // Get new version
    const newVersion = await question(`Enter new version (current: ${currentVersion}): `);
    
    if (!validateVersion(newVersion)) {
      throw new Error('Invalid version format. Use semantic versioning (e.g., 1.2.3)');
    }

    // if (newVersion <= currentVersion) {
    //   throw new Error('New version must be greater than current version');
    // }

    // Get changelog entry
    log.info('\nEnter changelog entry (use ### Added, ### Fixed, ### Changed sections):');
    log.info('Example:');
    log.info('### Added');
    log.info('- New feature description');
    log.info('');
    log.info('### Fixed');
    log.info('- Bug fix description');
    log.info('');
    log.info('Type your changelog entry (press Enter twice when done):');
    
    let changelogEntry = '';
    let emptyLines = 0;
    
    while (emptyLines < 2) {
      const line = await question('');
      if (line === '') {
        emptyLines++;
      } else {
        emptyLines = 0;
        changelogEntry += line + '\n';
      }
    }

    // if (!isValidChangelogEntry(changelogEntry)) {
      // throw new Error('Changelog entry must contain at least one section (### Added, ### Fixed, or ### Changed)');
    // }

    // Confirm release
    log.info(`\nRelease Summary:`);
    log.info(`Version: ${newVersion}`);
    log.info(`Changelog:\n${changelogEntry}`);
    
    const confirm = await question('Proceed with release? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      log.info('Release cancelled');
      process.exit(0);
    }

    // Backup current state for rollback
    const backupData = {
      version: currentVersion,
      packageJson: fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
      changelog: fs.existsSync(path.join(process.cwd(), 'CHANGELOG.md')) 
        ? fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8') 
        : null,
    };

    try {
      // Update version and changelog
      await updatePackageVersion(newVersion);
      await updateChangelog(newVersion, changelogEntry.trim());
      
      // Build and package
      await buildApplication();
      await packageElectron();
      
      // Git operations
      await createGitCommitAndTag(newVersion);
      
      // Publish to Supabase
      await publishToSupabase(newVersion, changelogEntry.trim());
      
      log.header('🎉 Release completed successfully!');
      log.success(`Version ${newVersion} has been released`);
      log.info('Next steps:');
      log.info('1. Push to git: git push && git push --tags');
      log.info('2. Upload release files manually to your hosting');
      log.info('3. Update the download URLs in your release manifest');
      log.info('4. Publish the release from your admin dashboard');

    } catch (error) {
      log.error(`Release failed: ${error.message}`);
      
      const rollback = await question('Would you like to rollback changes? (Y/n): ');
      if (rollback.toLowerCase() !== 'n') {
        log.step('Rolling back changes...');
        
        // Restore package.json
        fs.writeFileSync(path.join(process.cwd(), 'package.json'), backupData.packageJson);
        
        // Restore changelog
        if (backupData.changelog) {
          fs.writeFileSync(path.join(process.cwd(), 'CHANGELOG.md'), backupData.changelog);
        }
        
        // Remove git tag if it was created
        try {
          execCommand(`git tag -d v${newVersion}`, { silent: true });
        } catch (e) {
          // Tag might not exist
        }
        
        // Reset git commit if it was created
        try {
          execCommand('git reset HEAD~1', { silent: true });
        } catch (e) {
          // Commit might not exist
        }
        
        log.success('Changes rolled back successfully');
      }
      
      process.exit(1);
    }

  } catch (error) {
    log.error(error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
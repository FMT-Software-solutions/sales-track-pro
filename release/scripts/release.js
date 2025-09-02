#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

// Load environment variables from .env file
// Load environment variables - prioritize .env.local for Vite development
const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('Warning: No .env.local or .env file found');
}

// Load release configuration
const releaseConfig = require('../release-config');

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

// Validation functions
function validateVersionFormat(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

function validateReleaseConfig(config) {
  const errors = [];

  // Validate basic structure
  if (!config) {
    errors.push('Configuration is required');
    return errors;
  }

  // Validate version
  if (!config.version) {
    errors.push('Version is required');
  } else if (config.validation.validateVersionFormat && !validateVersionFormat(config.version)) {
    errors.push(`Invalid version format: ${config.version}. Use semantic versioning (e.g., 1.2.3)`);
  }

  // Validate required fields
  if (config.validation.requireReleaseNotes && !config.releaseNotes) {
    errors.push('Release notes are required');
  }

  // Validate GitHub configuration
  if (config.github.createRelease) {
    if (!config.github.owner || !config.github.repo) {
      errors.push('GitHub owner and repo must be specified for GitHub releases');
    }
    
    if (config.github.uploadAssets && !process.env.GH_TOKEN) {
      errors.push('GH_TOKEN environment variable is required for GitHub releases');
    }
  }

  // Validate Supabase configuration
  if (config.supabase && config.supabase.publish) {
    if (!config.supabase.edgeFunction) {
      errors.push('Supabase edge function name is required when publishing is enabled');
    }
    
    if (!process.env.VITE_SUPABASE_URL) {
      errors.push('VITE_SUPABASE_URL environment variable is required for Supabase publishing');
    }
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY environment variable is required for Supabase publishing');
    }
  }

  // Validate platform configurations
  if (config.platforms && Object.keys(config.platforms).length > 0) {
    Object.keys(config.platforms).forEach(platform => {
      const platformConfig = config.platforms[platform];
      if (!platformConfig.installerPath) {
        errors.push(`Platform ${platform} missing installer path`);
      }
      if (!platformConfig.installerPattern) {
        errors.push(`Platform ${platform} missing installer pattern`);
      }
      if (!platformConfig.downloadUrlTemplate) {
        errors.push(`Platform ${platform} missing download URL template`);
      }
    });
  }

  // Validate git configuration
  if (config.git) {
    if (config.git.createCommit && !config.git.commitMessage) {
      errors.push('Git commit message is required when createCommit is enabled');
    }
  }

  // Validate build configuration
  if (config.build && config.build.enabled) {
    // Check if build scripts exist in package.json
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      if (!packageJson.scripts || !packageJson.scripts.build) {
        errors.push('Build script not found in package.json');
      }
    } catch (error) {
      errors.push('Could not read package.json for build validation');
    }
  }

  return errors;
}

function validateVersionIncrement(newVersion, currentVersion) {
  if (!validateVersionFormat(newVersion) || !validateVersionFormat(currentVersion)) {
    throw new Error('Invalid version format for comparison');
  }
  
  const parseVersion = (v) => v.split('.').map(Number);
  const [newMajor, newMinor, newPatch] = parseVersion(newVersion);
  const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);

  if (newMajor > curMajor) return true;
  if (newMajor === curMajor && newMinor > curMinor) return true;
  if (newMajor === curMajor && newMinor === curMinor && newPatch > curPatch) return true;
  
  return false;
}

function validateInstallerFiles(config) {
  const errors = [];
  const installerFiles = findInstallerFiles(config);
  
  if (config.validation.requireInstallerFiles) {
    if (Object.keys(installerFiles).length === 0) {
      errors.push('No installer files found. Build the application first.');
    } else {
      // Validate each installer file exists and is readable
      Object.entries(installerFiles).forEach(([platform, filePath]) => {
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) {
            errors.push(`Installer file for ${platform} is not a valid file: ${filePath}`);
          } else if (stats.size === 0) {
            errors.push(`Installer file for ${platform} is empty: ${filePath}`);
          }
        } catch (error) {
          errors.push(`Cannot access installer file for ${platform}: ${filePath} (${error.message})`);
        }
      });
    }
  }
  
  return errors;
}

function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Check for git repository
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch (error) {
    errors.push('Not in a git repository. Git operations will fail.');
  }
  
  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      warnings.push('There are uncommitted changes in the repository.');
    }
  } catch (error) {
    // Git status failed, already handled above
  }
  
  // Check for package.json
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    errors.push('package.json not found in current directory');
  }
  
  return { errors, warnings };
}

function findInstallerFiles(config) {
  const installerFiles = {};
  
  Object.keys(config.platforms).forEach(platform => {
    const platformConfig = config.platforms[platform];
    const searchPath = path.join(process.cwd(), platformConfig.installerPath);
    
    if (fs.existsSync(searchPath)) {
      const pattern = path.join(searchPath, platformConfig.installerPattern);
      const files = glob.sync(pattern);
      
      if (files.length > 0) {
        installerFiles[platform] = files[0]; // Take the first match
      }
    }
  });
  
  return installerFiles;
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



function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function updatePackageVersion(newVersion) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

async function updateChangelog(config) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  let changelog = '';
  
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Check if version already exists
  if (changelog.includes(`## [${config.version}]`)) {
    throw new Error(`Version ${config.version} already exists in changelog`);
  }

  const date = config.releaseDate || new Date().toISOString().split('T')[0];
  
  // Format release notes from structured config
  let formattedReleaseNotes = '';
  
  if (typeof config.releaseNotes === 'string') {
    formattedReleaseNotes = config.releaseNotes;
  } else if (typeof config.releaseNotes === 'object') {
    // Handle structured release notes
    const sections = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];
    
    sections.forEach(section => {
      if (config.releaseNotes[section] && config.releaseNotes[section].length > 0) {
        const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1);
        formattedReleaseNotes += `### ${sectionTitle}\n\n`;
        config.releaseNotes[section].forEach(item => {
          formattedReleaseNotes += `- ${item}\n`;
        });
        formattedReleaseNotes += '\n';
      }
    });
  }
  
  const newEntry = `## [${config.version}] - ${date}\n\n${formattedReleaseNotes}\n`;
  
  // Insert after the header
  const lines = changelog.split('\n');
  const insertIndex = lines.findIndex(line => line.startsWith('## ['));
  const actualInsertIndex = insertIndex !== -1 ? insertIndex : 4;
  lines.splice(actualInsertIndex, 0, ...newEntry.split('\n'));
  
  fs.writeFileSync(changelogPath, lines.join('\n'));
}

async function buildApplication() {
  log.step('Building application...');
  log.info('Running electron:build (includes vite build)...');
  execCommand('npm run electron:build');
  log.info('Running build:electron...');
  execCommand('npm run build:electron');
  log.success('Application built successfully');
}

async function packageElectron() {
  log.step('Packaging Electron application...');
  execCommand('npm run package');
  log.success('Electron application packaged successfully');
}

// GitHub release functionality moved to publish-github.js

async function createGitCommitAndTag(config) {
  if (!config.git.createCommit && !config.git.createTag) {
    log.info('Skipping git operations');
    return;
  }

  log.step('Creating git commit and tag...');
  
  // Check if tag already exists
  if (config.git.createTag) {
    try {
      execCommand(`git rev-parse v${config.version}`, { silent: true });
      throw new Error(`Git tag v${config.version} already exists`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        // Tag doesn't exist, which is what we want
      } else {
        throw error;
      }
    }
  }

  if (config.git.createCommit) {
    execCommand('git add package.json CHANGELOG.md release/release-config.js');
    const commitMessage = config.git.commitMessage.replace('{version}', config.version);
    execCommand(`git commit -m "${commitMessage}"`);
    log.success(`Git commit created: ${commitMessage}`);
  }
  
  if (config.git.createTag) {
    execCommand(`git tag v${config.version}`);
    log.success(`Git tag v${config.version} created`);
  }
  
  if (config.git.pushChanges) {
    log.step('Pushing changes to remote...');
    execCommand('git push');
    if (config.git.createTag) {
      execCommand('git push --tags');
    }
    log.success('Changes pushed to remote');
  }
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
    log.header('Food Track Pro Release Script');
    
    // Validate environment first
    const envValidation = validateEnvironment();
    if (envValidation.errors.length > 0) {
      log.error('Environment validation failed:');
      envValidation.errors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Environment validation failed');
    }
    
    if (envValidation.warnings.length > 0) {
      log.warning('Environment warnings:');
      envValidation.warnings.forEach(warning => log.warning(`  - ${warning}`));
    }
    
    // Load and validate configuration
    const config = releaseConfig;
    const configValidationErrors = validateReleaseConfig(config);
    if (configValidationErrors.length > 0) {
      log.error('Configuration validation failed:');
      configValidationErrors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Configuration validation failed');
    }
    
    log.success('Configuration validated successfully');
    
    // Get current version and validate increment
    const currentVersion = getCurrentVersion();
    log.info(`Current version: ${currentVersion}`);
    log.info(`Target version: ${config.version}`);
    
    if (!validateVersionIncrement(config.version, currentVersion)) {
      throw new Error(`New version ${config.version} is not higher than current version ${currentVersion}`);
    }
    
    // Build application first (before modifying any files)
    if (config.build.enabled) {
      if (!config.build.skipBuild) {
        await buildApplication();
      } else {
        log.info('Skipping build (done manually)');
      }
    }
    
    // Update package.json (after successful build)
    updatePackageVersion(config.version);
    log.success('Updated package.json');
    
    // Update changelog
    await updateChangelog(config);
    log.success('Updated CHANGELOG.md');
    
    // Package application with updated version
    if (config.build.enabled && !config.build.skipPackage) {
      await packageElectron();
    } else if (config.build.enabled) {
      log.info('Skipping packaging');
    }
    
    // Validate installer files after building
    const installerValidationErrors = validateInstallerFiles(config);
    if (installerValidationErrors.length > 0) {
      log.error('Installer file validation failed:');
      installerValidationErrors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Installer file validation failed');
    }
    
    // Find installer files
    const installerFiles = findInstallerFiles(config);
    if (Object.keys(installerFiles).length > 0) {
      log.info('Found installer files:');
      Object.entries(installerFiles).forEach(([platform, path]) => {
        log.info(`  ${platform}: ${path}`);
      });
    }
    
    // Create git commit and tag
    await createGitCommitAndTag(config);
    
    // Publish to GitHub automatically
    if (config.github.enabled && config.github.createRelease) {
      try {
        const { createGitHubRelease } = require('./publish-github');
        const githubRelease = await createGitHubRelease(config, installerFiles);
        if (githubRelease) {
          log.success(`GitHub release created: ${githubRelease.html_url}`);
        }
      } catch (error) {
        log.error(`GitHub publishing failed: ${error.message}`);
        log.info('You can retry with: npm run publish:github');
      }
    }
    
    // Publish to Supabase automatically
    if (config.supabase && config.supabase.enabled) {
      try {
        await publishToSupabase(config.version, config.releaseNotes);
        log.success('Published to Supabase successfully');
      } catch (error) {
        log.error(`Supabase publishing failed: ${error.message}`);
        log.info('You can retry with: npm run publish:supabase');
      }
    }
    
    log.success('Release completed successfully!');
    
    log.info('Backup commands available:');
    log.info('- npm run publish:github (if GitHub publishing failed)');
    log.info('- npm run publish:supabase (if Supabase publishing failed)');
    
  } catch (error) {
    log.error('Release failed:', error.message);
    process.exit(1);
  }
}

main();
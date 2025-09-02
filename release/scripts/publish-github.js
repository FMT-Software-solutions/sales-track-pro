#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');
const { Octokit } = require('@octokit/rest');

// Load environment variables
const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('Warning: No .env.local or .env file found');
}

// Colors for console output
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
  step: (msg) => console.log(`\n${colors.cyan}${colors.bright}▶${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.magenta}${colors.bright}═══ ${msg} ═══${colors.reset}\n`),
};

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

async function deleteGitTag(tagName) {
  try {
    log.info(`Removing local git tag: ${tagName}`);
    execCommand(`git tag -d ${tagName}`, { silent: true });
    
    log.info(`Removing remote git tag: ${tagName}`);
    execCommand(`git push origin :refs/tags/${tagName}`, { silent: true });
    
    log.success(`Git tag ${tagName} removed successfully`);
  } catch (error) {
    log.warning(`Failed to remove git tag ${tagName}: ${error.message}`);
  }
}

async function createGitHubRelease(config, installerFiles) {
  if (!config.github.enabled || !config.github.createRelease) {
    log.info('GitHub release creation is disabled');
    return null;
  }

  log.step('Creating GitHub release...');
  
  const token = process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GH_TOKEN environment variable is required for GitHub releases');
  }

  const octokit = new Octokit({ auth: token });
  const tagName = `v${config.version}`;
  let releaseCreated = false;
  
  try {
    // Create the release
    const releaseResponse = await octokit.rest.repos.createRelease({
      owner: config.github.owner,
      repo: config.github.repo,
      tag_name: tagName,
      name: `v${config.version}`,
      body: config.releaseNotes,
      draft: config.github.draft || false,
      prerelease: config.github.prerelease || false
    });

    releaseCreated = true;
    const releaseId = releaseResponse.data.id;
    log.success(`GitHub release created: ${releaseResponse.data.html_url}`);

    // Upload assets if configured and available
    if (config.github.uploadAssets && Object.keys(installerFiles).length > 0) {
      log.step('Uploading release assets...');
      
      for (const [platform, filePath] of Object.entries(installerFiles)) {
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);
        
        try {
          await octokit.rest.repos.uploadReleaseAsset({
            owner: config.github.owner,
            repo: config.github.repo,
            release_id: releaseId,
            name: fileName,
            data: fileContent
          });
          
          log.success(`Uploaded ${fileName} for ${platform}`);
        } catch (uploadError) {
          log.error(`Failed to upload ${fileName}: ${uploadError.message}`);
          log.warning('Asset upload failed, but release will continue. You can upload assets manually.');
          // Don't throw error for asset upload failures, continue with release
        }
      }
    } else if (config.github.uploadAssets && Object.keys(installerFiles).length === 0) {
      log.info('Asset upload is enabled but no installer files found. Release created without assets.');
    }
    
    return releaseResponse.data;
  } catch (error) {
    log.error(`GitHub release failed: ${error.message}`);
    
    // Only clean up if release creation itself failed, not just asset uploads
    if (!releaseCreated) {
      // Clean up git tag only if release creation failed
      await deleteGitTag(tagName);
    } else {
      log.info('Release was created successfully despite asset upload issues.');
    }
    
    throw error;
  }
}

async function main() {
  try {
    log.header('GitHub Release Publisher');
    
    // Load configuration
    const config = require('../release-config');
    
    if (!config.github.enabled) {
      log.info('GitHub publishing is disabled in configuration');
      return;
    }
    
    // Validate required environment variables
    if (!process.env.GH_TOKEN) {
      throw new Error('GH_TOKEN environment variable is required');
    }
    
    // Find installer files
    const installerFiles = findInstallerFiles(config);
    
    if (Object.keys(installerFiles).length === 0) {
      log.warning('No installer files found. Release will be created without assets.');
      log.info('Installer files can be uploaded manually later if needed.');
    } else {
      log.info('Found installer files:');
      Object.entries(installerFiles).forEach(([platform, path]) => {
        log.info(`  ${platform}: ${path}`);
      });
    }
    
    // Create GitHub release
    const githubRelease = await createGitHubRelease(config, installerFiles);
    
    if (githubRelease) {
      log.success('GitHub release published successfully!');
      log.info(`Release URL: ${githubRelease.html_url}`);
    }
    
  } catch (error) {
    log.error('GitHub publishing failed:', error.message);
    process.exit(1);
  }
}

// Allow script to be run directly or imported
if (require.main === module) {
  main();
}

module.exports = {
  createGitHubRelease,
  findInstallerFiles,
  deleteGitTag
};
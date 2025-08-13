#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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

async function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be set in environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function publishToSupabase() {
  try {
    log.header('📤 Publishing to Supabase');

    const manifestPath = path.join(process.cwd(), 'release', 'release-manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Release manifest not found. Run the release script first.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    if (!manifest.releases || manifest.releases.length === 0) {
      throw new Error('No releases found in manifest');
    }

    const latestRelease = manifest.releases[0];
    log.info(`Publishing version ${latestRelease.version}...`);

    const supabase = await getSupabaseClient();

    // Check if version already exists
    const { data: existingVersion, error: checkError } = await supabase
      .from('app_versions')
      .select('*')
      .eq('version', latestRelease.version)
      .eq('platform', latestRelease.platform)
      .eq('architecture', latestRelease.architecture)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Error checking existing version: ${checkError.message}`);
    }

    if (existingVersion) {
      log.warning(`Version ${latestRelease.version} already exists in database`);
      
      // Update existing version
      const { error: updateError } = await supabase
        .from('app_versions')
        .update({
          download_url: latestRelease.download_url,
          file_size: latestRelease.file_size,
          release_notes: latestRelease.release_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVersion.id);

      if (updateError) {
        throw new Error(`Error updating version: ${updateError.message}`);
      }

      log.success(`Version ${latestRelease.version} updated successfully`);
    } else {
      // Insert new version
      const { error: insertError } = await supabase
        .from('app_versions')
        .insert([{
          version: latestRelease.version,
          platform: latestRelease.platform,
          architecture: latestRelease.architecture,
          download_url: latestRelease.download_url,
          file_size: latestRelease.file_size,
          release_notes: latestRelease.release_notes,
          status: 'draft',
        }]);

      if (insertError) {
        throw new Error(`Error inserting version: ${insertError.message}`);
      }

      log.success(`Version ${latestRelease.version} published successfully as draft`);
    }

    log.info('Release published to Supabase database');
    log.info('Status: Draft (can be published from admin dashboard)');

  } catch (error) {
    log.error(`Failed to publish to Supabase: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  await publishToSupabase();
}

if (require.main === module) {
  main();
}

module.exports = { publishToSupabase };
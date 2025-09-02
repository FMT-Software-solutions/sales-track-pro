-- Fix unique constraint to allow multiple platforms per version
-- Drop the existing unique constraint on version
ALTER TABLE app_versions DROP CONSTRAINT IF EXISTS app_versions_version_key;

-- Add a composite unique constraint on version + platform
ALTER TABLE app_versions ADD CONSTRAINT app_versions_version_platform_key UNIQUE (version, platform);

-- Update the existing sample record to have proper platform naming
UPDATE app_versions 
SET platform = 'win32' 
WHERE version = '1.0.0' AND platform = 'windows';
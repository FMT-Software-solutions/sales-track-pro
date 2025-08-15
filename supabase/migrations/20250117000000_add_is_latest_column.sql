-- Add is_latest column to app_versions table
ALTER TABLE app_versions ADD COLUMN is_latest BOOLEAN DEFAULT FALSE;

-- Create index for better performance on is_latest queries
CREATE INDEX idx_app_versions_is_latest ON app_versions(is_latest, platform, status);

-- Update existing published versions to set the latest one as is_latest = true
-- This will set the most recent published version for each platform as latest
WITH latest_versions AS (
  SELECT DISTINCT ON (platform) 
    id,
    platform,
    version,
    created_at
  FROM app_versions 
  WHERE status = 'published'
  ORDER BY platform, created_at DESC
)
UPDATE app_versions 
SET is_latest = TRUE 
WHERE id IN (SELECT id FROM latest_versions);

-- Add a trigger to automatically manage is_latest when new versions are published
CREATE OR REPLACE FUNCTION update_latest_version()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated record is published, update is_latest flags
  IF NEW.status = 'published' THEN
    -- First, set all other versions for this platform to not latest
    UPDATE app_versions 
    SET is_latest = FALSE 
    WHERE platform = NEW.platform AND id != NEW.id;
    
    -- Then set this version as latest
    NEW.is_latest = TRUE;
  END IF;
  
  -- If status changed from published to something else, find new latest
  IF OLD.status = 'published' AND NEW.status != 'published' THEN
    NEW.is_latest = FALSE;
    
    -- Set the most recent published version as latest
    UPDATE app_versions 
    SET is_latest = TRUE 
    WHERE id = (
      SELECT id 
      FROM app_versions 
      WHERE platform = NEW.platform AND status = 'published'
      ORDER BY created_at DESC 
      LIMIT 1
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_latest_version
  BEFORE UPDATE ON app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_latest_version();

-- Create trigger for inserts
CREATE TRIGGER trigger_insert_latest_version
  BEFORE INSERT ON app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_latest_version();
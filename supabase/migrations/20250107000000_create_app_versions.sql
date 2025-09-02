-- Create app_versions table for managing application releases
CREATE TABLE IF NOT EXISTS app_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    release_notes TEXT,
    download_url TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    platform VARCHAR(20) NOT NULL DEFAULT 'all', -- 'win32', 'macos', 'linux', 'all'
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'published'    
    is_critical BOOLEAN DEFAULT FALSE, -- Whether this is a critical security update
    minimum_version VARCHAR(50), -- Minimum version required before this update
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_versions_status ON app_versions(status);
CREATE INDEX IF NOT EXISTS idx_app_versions_platform ON app_versions(platform);
CREATE INDEX IF NOT EXISTS idx_app_versions_created_at ON app_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_versions_version ON app_versions(version);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_versions_updated_at 
    BEFORE UPDATE ON app_versions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Set published_at when status changes to 'published'
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        NEW.published_at = NOW();
    ELSIF NEW.status != 'published' THEN
        NEW.published_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_app_versions_published_at 
    BEFORE UPDATE ON app_versions 
    FOR EACH ROW 
    EXECUTE FUNCTION set_published_at();

-- Enable Row Level Security
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for app_versions table
-- Allow public read access to published versions (for update checking)
CREATE POLICY "Public can read published versions" ON app_versions
    FOR SELECT USING (status = 'published');

-- Allow authenticated users to read all versions
CREATE POLICY "Authenticated users can read all versions" ON app_versions
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert new versions
CREATE POLICY "Authenticated users can insert versions" ON app_versions
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update versions they created
CREATE POLICY "Users can update their own versions" ON app_versions
    FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Allow authenticated users to delete versions they created
CREATE POLICY "Users can delete their own versions" ON app_versions
    FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Insert a sample version (optional - for testing)
INSERT INTO app_versions (
    version, 
    release_notes, 
    download_url, 
    file_size, 
    platform, 
    status
) VALUES (
    '1.0.0',
    'Initial release of SalesTrack Pro with core functionality including sales tracking, expense management, and reporting.',
    'https://github.com/your-org/salestrack-pro/releases/download/v1.0.0/SalesTrack-Pro-Setup-1.0.0.exe',
    52428800, -- ~50MB
    'win32',
    'published'
) ON CONFLICT (version) DO NOTHING;
-- Create activities_log table for generic activity tracking
CREATE TABLE activities_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- e.g., 'sale_created', 'sale_updated', 'sale_deleted', 'expense_created', etc.
  entity_type VARCHAR(50) NOT NULL, -- e.g., 'sale', 'expense', 'branch', 'user', etc.
  entity_id UUID, -- Generic reference to any entity
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL, -- Optional specific reference for sales
  description TEXT NOT NULL, -- Human-readable description of the activity
  metadata JSONB, -- Additional structured data about the activity
  old_values JSONB, -- Previous values for update operations
  new_values JSONB, -- New values for create/update operations
  ip_address INET, -- User's IP address
  user_agent TEXT, -- User's browser/client info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_activities_log_organization_id ON activities_log(organization_id);
CREATE INDEX idx_activities_log_branch_id ON activities_log(branch_id);
CREATE INDEX idx_activities_log_user_id ON activities_log(user_id);
CREATE INDEX idx_activities_log_activity_type ON activities_log(activity_type);
CREATE INDEX idx_activities_log_entity_type ON activities_log(entity_type);
CREATE INDEX idx_activities_log_entity_id ON activities_log(entity_id);
CREATE INDEX idx_activities_log_sale_id ON activities_log(sale_id);
CREATE INDEX idx_activities_log_created_at ON activities_log(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_activities_log_org_branch ON activities_log(organization_id, branch_id);
CREATE INDEX idx_activities_log_sale_created ON activities_log(sale_id, created_at DESC) WHERE sale_id IS NOT NULL;
CREATE INDEX idx_activities_log_entity_created ON activities_log(entity_type, entity_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE activities_log IS 'Generic activity logging table for tracking all user actions across the application';
COMMENT ON COLUMN activities_log.activity_type IS 'Type of activity performed (e.g., created, updated, deleted)';
COMMENT ON COLUMN activities_log.entity_type IS 'Type of entity the activity was performed on (e.g., sale, expense, user)';
COMMENT ON COLUMN activities_log.entity_id IS 'Generic UUID reference to the entity';
COMMENT ON COLUMN activities_log.sale_id IS 'Optional specific reference for sales-related activities';
COMMENT ON COLUMN activities_log.metadata IS 'Additional structured data about the activity';
COMMENT ON COLUMN activities_log.old_values IS 'Previous values for update operations (JSON)';
COMMENT ON COLUMN activities_log.new_values IS 'New values for create/update operations (JSON)';
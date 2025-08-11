-- Create organizations table
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'GH₵' NOT NULL,
  address TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_organizations junction table for many-to-many relationship
CREATE TABLE user_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' NOT NULL, -- admin, manager, member
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Add organization_id to existing tables
ALTER TABLE branches ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sales_items ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE expense_categories ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_organizations_active ON organizations(is_active);
CREATE INDEX idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX idx_branches_org_id ON branches(organization_id);
CREATE INDEX idx_sales_org_id ON sales(organization_id);
CREATE INDEX idx_expenses_org_id ON expenses(organization_id);
CREATE INDEX idx_sales_items_org_id ON sales_items(organization_id);
CREATE INDEX idx_expense_categories_org_id ON expense_categories(organization_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Organization admins can update their organization" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their organization memberships" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage memberships" ON user_organizations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Update existing RLS policies to include organization filtering
-- Note: This will need to be done carefully to maintain existing functionality

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Organizations that users belong to';
COMMENT ON TABLE user_organizations IS 'Junction table for user-organization relationships';
COMMENT ON COLUMN organizations.currency IS 'Default currency symbol for the organization';
COMMENT ON COLUMN user_organizations.role IS 'User role within the organization: admin, manager, member';
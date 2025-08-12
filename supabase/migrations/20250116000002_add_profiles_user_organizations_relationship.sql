-- Add foreign key relationship between profiles and user_organizations
-- This allows PostgREST to automatically infer the relationship for joins

-- Since both tables reference auth.users(id), we can create a view or 
-- add a computed relationship. For PostgREST, we'll use a view approach.

-- Create a view that combines profiles with their user_organizations
CREATE OR REPLACE VIEW profiles_with_organizations AS
SELECT 
  p.*,
  uo.organization_id,
  uo.role as org_role,
  uo.is_active as org_is_active,
  o.name as organization_name
FROM profiles p
LEFT JOIN user_organizations uo ON p.id = uo.user_id AND uo.is_active = true
LEFT JOIN organizations o ON uo.organization_id = o.id;

-- Grant permissions on the view
GRANT SELECT ON profiles_with_organizations TO authenticated;

-- Add RLS policy for the view
ALTER VIEW profiles_with_organizations OWNER TO postgres;

-- Create a function to get user organizations for a specific user
CREATE OR REPLACE FUNCTION get_user_organizations(user_uuid uuid)
RETURNS TABLE (
  organization_id uuid,
  role text,
  is_active boolean,
  organization_name text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    uo.organization_id,
    uo.role,
    uo.is_active,
    o.name as organization_name
  FROM user_organizations uo
  LEFT JOIN organizations o ON uo.organization_id = o.id
  WHERE uo.user_id = user_uuid AND uo.is_active = true;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_organizations(uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW profiles_with_organizations IS 'View that combines profiles with their organization memberships';
COMMENT ON FUNCTION get_user_organizations(uuid) IS 'Function to get active organization memberships for a user';
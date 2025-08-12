-- Fix RLS policies to allow edge functions to insert users
-- The service role should be able to bypass RLS, but we'll add explicit policies for safety

-- Add INSERT policy for profiles table to allow service role and admins to create profiles
CREATE POLICY "Service role and admins can insert profiles"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow service role (edge functions) to insert
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Allow admins to create profiles
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add INSERT policy for user_organizations table
CREATE POLICY "Service role and admins can insert user organizations"
    ON user_organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow service role (edge functions) to insert
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Allow organization admins to add users
        organization_id IN (
            SELECT organization_id FROM user_organizations 
            WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- Also add UPDATE and DELETE policies for user_organizations if they don't exist
CREATE POLICY "Service role and org admins can update user organizations"
    ON user_organizations
    FOR UPDATE
    TO authenticated
    USING (
        -- Allow service role (edge functions) to update
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Allow organization admins to update memberships
        organization_id IN (
            SELECT organization_id FROM user_organizations 
            WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

CREATE POLICY "Service role and org admins can delete user organizations"
    ON user_organizations
    FOR DELETE
    TO authenticated
    USING (
        -- Allow service role (edge functions) to delete
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Allow organization admins to remove memberships
        organization_id IN (
            SELECT organization_id FROM user_organizations 
            WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- Add SELECT policy for user_organizations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_organizations' 
        AND policyname = 'Users can view their organization memberships'
    ) THEN
        CREATE POLICY "Users can view their organization memberships" 
        ON user_organizations
        FOR SELECT 
        TO authenticated
        USING (user_id = auth.uid());
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON POLICY "Service role and admins can insert profiles" ON profiles IS 
'Allows edge functions (service role) and admin users to create new profiles';

COMMENT ON POLICY "Service role and admins can insert user organizations" ON user_organizations IS 
'Allows edge functions (service role) and organization admins to create user-organization relationships';
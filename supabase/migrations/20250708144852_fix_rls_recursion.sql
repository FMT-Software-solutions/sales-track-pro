-- Fix RLS infinite recursion by creating a helper function
-- This function bypasses RLS to check user roles

-- Create a security definer function to get user role without triggering RLS
CREATE OR REPLACE FUNCTION auth.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;
    
    RETURN COALESCE(user_role, 'branch_manager');
END;
$$;

-- Create a security definer function to get user branch_id without triggering RLS
CREATE OR REPLACE FUNCTION auth.get_user_branch_id(user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_branch_id uuid;
BEGIN
    SELECT branch_id INTO user_branch_id
    FROM profiles
    WHERE id = user_id;
    
    RETURN user_branch_id;
END;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all branches" ON branches;
DROP POLICY IF EXISTS "Branch managers can read their branch" ON branches;
DROP POLICY IF EXISTS "Admins can manage all sales" ON sales;
DROP POLICY IF EXISTS "Branch managers can manage their branch sales" ON sales;
DROP POLICY IF EXISTS "Admins can manage all expenses" ON expenses;
DROP POLICY IF EXISTS "Branch managers can manage their branch expenses" ON expenses;

-- Create new non-recursive policies using the helper functions

-- Profiles policies (fixed)
CREATE POLICY "Admins can read all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.get_user_role() = 'admin');

-- Branches policies (fixed)
CREATE POLICY "Admins can manage all branches"
    ON branches
    FOR ALL
    TO authenticated
    USING (auth.get_user_role() = 'admin');

CREATE POLICY "Branch managers can read their branch"
    ON branches
    FOR SELECT
    TO authenticated
    USING (
        auth.get_user_branch_id() = id
        OR auth.get_user_role() = 'admin'
    );

-- Sales policies (fixed)
CREATE POLICY "Admins can manage all sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (auth.get_user_role() = 'admin');

CREATE POLICY "Branch managers can manage their branch sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (
        auth.get_user_branch_id() = branch_id
        OR auth.get_user_role() = 'admin'
    );

-- Expenses policies (fixed)
CREATE POLICY "Admins can manage all expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (auth.get_user_role() = 'admin');

CREATE POLICY "Branch managers can manage their branch expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (
        auth.get_user_branch_id() = branch_id
        OR auth.get_user_role() = 'admin'
    ); 
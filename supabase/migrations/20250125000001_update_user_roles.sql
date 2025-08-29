-- Migration to update user roles to support new role hierarchy
-- Adding owner, auditor, and sales_person roles

-- First, add the new values to the enum type
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_person';

-- Update the default role for new users to be sales_person
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'sales_person';

-- Update the user creation function to use sales_person as default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sales_person')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to handle new roles
-- Sales policies with enhanced role-based access
DROP POLICY IF EXISTS "Admins can manage all sales" ON sales;
DROP POLICY IF EXISTS "Branch managers can manage their branch sales" ON sales;

-- Owners and admins can manage all sales
CREATE POLICY "Owners and admins can manage all sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Auditors can read all sales but not modify
CREATE POLICY "Auditors can read all sales"
    ON sales
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'auditor'
        )
    );

-- Branch managers can manage their branch sales
CREATE POLICY "Branch managers can manage their branch sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() 
            AND role = 'branch_manager'
            AND branch_id = sales.branch_id
        )
    );

-- Sales persons can create and read their own sales, but cannot edit/delete
CREATE POLICY "Sales persons can create sales"
    ON sales
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() 
            AND role = 'sales_person'
            AND branch_id = sales.branch_id
        )
    );

CREATE POLICY "Sales persons can read their branch sales"
    ON sales
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() 
            AND role = 'sales_person'
            AND branch_id = sales.branch_id
        )
    );

-- Update sale_line_items policies for new roles
DROP POLICY IF EXISTS "sale_line_items_select_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_line_items_insert_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_line_items_update_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_line_items_delete_policy" ON sale_line_items;

-- Owners, admins, and auditors can read all sale line items
CREATE POLICY "Privileged users can read all sale line items"
    ON sale_line_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('owner', 'admin', 'auditor')
        )
        OR
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND (p.branch_id = s.branch_id AND p.role IN ('branch_manager', 'sales_person'))
        )
    );

-- Only owners, admins, and branch managers can modify sale line items
CREATE POLICY "Privileged users can manage sale line items"
    ON sale_line_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('owner', 'admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND p.branch_id = s.branch_id 
            AND p.role = 'branch_manager'
        )
    );

-- Sales persons can only insert sale line items for new sales
CREATE POLICY "Sales persons can create sale line items"
    ON sale_line_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND p.branch_id = s.branch_id 
            AND p.role = 'sales_person'
            AND s.status = 'active'
            AND s.closed = false
        )
    );

-- Update profiles policies for new roles
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

CREATE POLICY "Owners and admins can read all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Auditors can read profiles in their organization
CREATE POLICY "Auditors can read organization profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            JOIN profiles p2 ON p1.id = auth.uid()
            WHERE p1.role = 'auditor'
            -- Add organization-based filtering when organization support is added
        )
    );

-- Branch managers can read profiles in their branch
CREATE POLICY "Branch managers can read branch profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p1
            WHERE p1.id = auth.uid() 
            AND p1.role = 'branch_manager'
            AND p1.branch_id = profiles.branch_id
        )
    );

-- Update functions to handle role-based permissions for corrections and voids
CREATE OR REPLACE FUNCTION create_sale_correction(
    original_sale_id uuid,
    corrected_data jsonb,
    correcting_user_id uuid
)
RETURNS uuid AS $$
DECLARE
    new_sale_id uuid;
    user_role user_role;
    sale_closed boolean;
BEGIN
    -- Check user permissions
    SELECT role INTO user_role FROM profiles WHERE id = correcting_user_id;
    
    IF user_role NOT IN ('owner', 'admin', 'auditor') THEN
        RAISE EXCEPTION 'Insufficient permissions to create sale corrections';
    END IF;
    
    -- Check if sale is closed
    SELECT closed INTO sale_closed FROM sales WHERE id = original_sale_id;
    
    IF sale_closed AND user_role != 'owner' THEN
        RAISE EXCEPTION 'Cannot correct sales in closed periods. Only owners can override.';
    END IF;
    
    -- Mark original sale as corrected
    UPDATE sales 
    SET status = 'corrected', 
        last_updated_by = correcting_user_id,
        updated_at = NOW()
    WHERE id = original_sale_id;
    
    -- Create new corrected sale
    INSERT INTO sales (
        branch_id,
        customer_name,
        sale_date,
        total_amount,
        organization_id,
        created_by,
        status,
        correction_of,
        last_updated_by
    )
    SELECT 
        COALESCE((corrected_data->>'branch_id')::uuid, branch_id),
        COALESCE(corrected_data->>'customer_name', customer_name),
        COALESCE((corrected_data->>'sale_date')::timestamptz, sale_date),
        COALESCE((corrected_data->>'total_amount')::decimal, total_amount),
        organization_id,
        correcting_user_id,
        'active',
        original_sale_id,
        correcting_user_id
    FROM sales 
    WHERE id = original_sale_id
    RETURNING id INTO new_sale_id;
    
    RETURN new_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION void_sale(
    sale_id uuid,
    voiding_user_id uuid
)
RETURNS boolean AS $$
DECLARE
    user_role user_role;
    sale_closed boolean;
BEGIN
    -- Check user permissions
    SELECT role INTO user_role FROM profiles WHERE id = voiding_user_id;
    
    IF user_role NOT IN ('owner', 'admin', 'branch_manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to void sales';
    END IF;
    
    -- Check if sale exists and can be voided
    SELECT closed INTO sale_closed FROM sales WHERE id = sale_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found or not active';
    END IF;
    
    IF sale_closed AND user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Cannot void sales in closed periods. Only owners and admins can override.';
    END IF;
    
    -- Mark sale as voided
    UPDATE sales 
    SET status = 'voided',
        last_updated_by = voiding_user_id,
        updated_at = NOW()
    WHERE id = sale_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for the new roles
COMMENT ON TYPE user_role IS 'User roles: owner (super admin), admin (organization admin), branch_manager (branch admin), auditor (read-only with correction rights), sales_person (basic user)';
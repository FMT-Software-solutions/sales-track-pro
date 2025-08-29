-- Migration to add immutable transaction fields to sales table
-- This enables audit trails, corrections, and period locking

-- Add new fields to sales table
ALTER TABLE sales 
ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'voided', 'corrected')),
ADD COLUMN correction_of uuid REFERENCES sales(id) ON DELETE SET NULL,
ADD COLUMN closed boolean DEFAULT false,
ADD COLUMN last_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_correction_of ON sales(correction_of);
CREATE INDEX idx_sales_closed ON sales(closed);
CREATE INDEX idx_sales_last_updated_by ON sales(last_updated_by);

-- Update existing sales to have 'active' status
UPDATE sales SET status = 'active' WHERE status IS NULL;

-- Create function to handle sale corrections
CREATE OR REPLACE FUNCTION create_sale_correction(
    original_sale_id uuid,
    corrected_data jsonb,
    correcting_user_id uuid
)
RETURNS uuid AS $$
DECLARE
    new_sale_id uuid;
BEGIN
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
        amount,
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
        COALESCE((corrected_data->>'total_amount')::decimal, (corrected_data->>'amount')::decimal, total_amount, amount),
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

-- Create function to void a sale
CREATE OR REPLACE FUNCTION void_sale(
    sale_id uuid,
    voiding_user_id uuid
)
RETURNS boolean AS $$
BEGIN
    -- Check if sale can be voided (not already voided or corrected)
    IF NOT EXISTS (
        SELECT 1 FROM sales 
        WHERE id = sale_id 
        AND status = 'active'
        AND closed = false
    ) THEN
        RAISE EXCEPTION 'Sale cannot be voided: either not found, not active, or period is closed';
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

-- Create function to close sales for a period
CREATE OR REPLACE FUNCTION close_sales_period(
    start_date date,
    end_date date,
    branch_id_param uuid DEFAULT NULL,
    organization_id_param uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
    affected_rows integer;
BEGIN
    UPDATE sales 
    SET closed = true,
        updated_at = NOW()
    WHERE sale_date >= start_date 
    AND sale_date <= end_date
    AND (branch_id_param IS NULL OR branch_id = branch_id_param)
    AND (organization_id_param IS NULL OR organization_id = organization_id_param)
    AND closed = false;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get sale correction history
CREATE OR REPLACE FUNCTION get_sale_correction_history(original_sale_id uuid)
RETURNS TABLE (
    id uuid,
    sale_date timestamptz,
    total_amount decimal,
    status text,
    correction_of uuid,
    created_at timestamptz,
    updated_at timestamptz,
    created_by_name text,
    last_updated_by_name text
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE correction_chain AS (
        -- Start with the original sale
        SELECT s.id, s.sale_date, s.total_amount, s.status, s.correction_of, 
               s.created_at, s.updated_at, s.created_by, s.last_updated_by
        FROM sales s
        WHERE s.id = original_sale_id
        
        UNION ALL
        
        -- Find all corrections of this sale
        SELECT s.id, s.sale_date, s.total_amount, s.status, s.correction_of,
               s.created_at, s.updated_at, s.created_by, s.last_updated_by
        FROM sales s
        INNER JOIN correction_chain cc ON s.correction_of = cc.id
    )
    SELECT 
        cc.id,
        cc.sale_date,
        cc.total_amount,
        cc.status,
        cc.correction_of,
        cc.created_at,
        cc.updated_at,
        cp.full_name as created_by_name,
        lp.full_name as last_updated_by_name
    FROM correction_chain cc
    LEFT JOIN profiles cp ON cp.id = cc.created_by
    LEFT JOIN profiles lp ON lp.id = cc.last_updated_by
    ORDER BY cc.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the sales update trigger to track who made changes
CREATE OR REPLACE FUNCTION update_sales_updated_at_with_user()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    -- Only update last_updated_by if it's not already set in the UPDATE
    IF NEW.last_updated_by IS NULL THEN
        NEW.last_updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Replace the existing trigger
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at_with_user();

-- Add comments for documentation
COMMENT ON COLUMN sales.status IS 'Status of the sale: active, voided, or corrected';
COMMENT ON COLUMN sales.correction_of IS 'References the original sale if this is a correction';
COMMENT ON COLUMN sales.closed IS 'Whether this sale is locked for a closed period';
COMMENT ON COLUMN sales.last_updated_by IS 'User who last modified this sale';

COMMENT ON FUNCTION create_sale_correction IS 'Creates a correction for an existing sale';
COMMENT ON FUNCTION void_sale IS 'Voids an active sale';
COMMENT ON FUNCTION close_sales_period IS 'Closes sales for a specific period';
COMMENT ON FUNCTION get_sale_correction_history IS 'Gets the complete correction history for a sale';
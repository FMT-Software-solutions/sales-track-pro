-- Migration to remove total_amount column and consolidate to use only amount
-- This ensures consistency with expenses table and eliminates confusion

-- First, update any sales that have total_amount but not amount
UPDATE sales 
SET amount = COALESCE(total_amount, amount, 0)
WHERE amount IS NULL OR amount = 0;

-- Update any sales where total_amount differs from amount (use total_amount as it's computed)
UPDATE sales 
SET amount = total_amount
WHERE total_amount IS NOT NULL AND total_amount != amount;

-- Drop the triggers that update total_amount
DROP TRIGGER IF EXISTS update_sales_total_amount_on_insert ON sale_line_items;
DROP TRIGGER IF EXISTS update_sales_total_amount_on_update ON sale_line_items;
DROP TRIGGER IF EXISTS update_sales_total_amount_on_delete ON sale_line_items;

-- Drop the function that updates total_amount
DROP FUNCTION IF EXISTS update_sales_total_amount();

-- Drop the index on total_amount
DROP INDEX IF EXISTS idx_sales_total_amount;

-- Remove the total_amount column
ALTER TABLE sales DROP COLUMN IF EXISTS total_amount;

-- Update the create_sale_correction function to use only amount
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
        COALESCE((corrected_data->>'amount')::decimal, amount),
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

-- Update the get_sale_correction_history function to use only amount
CREATE OR REPLACE FUNCTION get_sale_correction_history(original_sale_id uuid)
RETURNS TABLE (
    id uuid,
    sale_date timestamptz,
    amount decimal,
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
        SELECT s.id, s.sale_date, s.amount, s.status, s.correction_of, 
               s.created_at, s.updated_at, s.created_by, s.last_updated_by
        FROM sales s
        WHERE s.id = original_sale_id
        
        UNION ALL
        
        -- Find all corrections of this sale
        SELECT s.id, s.sale_date, s.amount, s.status, s.correction_of,
               s.created_at, s.updated_at, s.created_by, s.last_updated_by
        FROM sales s
        INNER JOIN correction_chain cc ON s.correction_of = cc.id
    )
    SELECT 
        cc.id,
        cc.sale_date,
        cc.amount,
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

-- Create a new function to update sales amount when sale_line_items change
CREATE OR REPLACE FUNCTION update_sales_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the amount for the affected sale
    UPDATE sales 
    SET amount = (
        SELECT COALESCE(SUM(quantity * unit_price), 0)
        FROM sale_line_items 
        WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    )
    WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update sales amount when sale_line_items change
CREATE TRIGGER update_sales_amount_on_insert
    AFTER INSERT ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_amount();

CREATE TRIGGER update_sales_amount_on_update
    AFTER UPDATE ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_amount();

CREATE TRIGGER update_sales_amount_on_delete
    AFTER DELETE ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_amount();

-- Update comments
COMMENT ON COLUMN sales.amount IS 'Total amount for this sale, computed from sale_line_items';
COMMENT ON FUNCTION create_sale_correction IS 'Creates a correction for an existing sale using only amount field';
COMMENT ON FUNCTION get_sale_correction_history IS 'Gets the complete correction history for a sale using only amount field';
COMMENT ON FUNCTION update_sales_amount IS 'Updates the sales amount when sale_line_items change';
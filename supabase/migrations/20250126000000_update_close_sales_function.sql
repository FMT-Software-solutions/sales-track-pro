-- Add closing_reason column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS closing_reason TEXT;

-- Drop the existing close_sales_period function
DROP FUNCTION IF EXISTS close_sales_period(DATE, DATE, UUID, UUID);

-- Create new close_sales_period function that accepts sale IDs
CREATE OR REPLACE FUNCTION close_sales_period(
    sale_ids UUID[],
    organization_id UUID,
    closing_reason TEXT DEFAULT 'Period closed'
)
RETURNS TABLE(
    affected_count INTEGER,
    closed_sale_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
    updated_ids UUID[];
BEGIN
    -- Validate that organization_id is provided
    IF organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;
    
    -- Validate that sale_ids array is not empty
    IF sale_ids IS NULL OR array_length(sale_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Sale IDs array cannot be empty';
    END IF;
    
    -- Update sales that belong to the organization and are in the provided sale_ids
    -- Only update sales that are not already closed
    WITH updated_sales AS (
        UPDATE sales 
        SET 
            closed = true,
            closing_reason = close_sales_period.closing_reason,
            updated_at = NOW()
        WHERE 
            id = ANY(sale_ids)
            AND sales.organization_id = close_sales_period.organization_id
            AND closed = false
        RETURNING id
    )
    SELECT 
        COUNT(*)::INTEGER,
        ARRAY_AGG(id)
    INTO updated_count, updated_ids
    FROM updated_sales;
    
    -- Return the count and IDs of affected sales
    RETURN QUERY SELECT updated_count, COALESCE(updated_ids, ARRAY[]::UUID[]);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION close_sales_period(UUID[], UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION close_sales_period(UUID[], UUID, TEXT) IS 'Closes sales by setting closed=true for the provided sale IDs within the specified organization. Only updates sales that are not already closed.';
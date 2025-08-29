-- Fix sale correction function to include amount field
-- This resolves the "null value in column 'amount' violates not-null constraint" error

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

COMMENT ON FUNCTION create_sale_correction IS 'Creates a correction for an existing sale - fixed to include amount field';
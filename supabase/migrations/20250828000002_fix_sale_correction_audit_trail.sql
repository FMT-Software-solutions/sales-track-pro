-- Fix sale correction audit trail to properly handle correction chains
-- This resolves the issue where corrections of corrections don't appear in the audit trail

-- Drop the existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_sale_correction_history(uuid);

-- Create a new function that can traverse the complete correction chain
CREATE OR REPLACE FUNCTION get_sale_correction_history(p_sale_id uuid)
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
        -- First, find the root of the correction chain (the original sale)
        -- We need to traverse backwards to find the original
        WITH RECURSIVE find_root AS (
            SELECT s.id, s.correction_of
            FROM sales s
            WHERE s.id = p_sale_id
            
            UNION ALL
            
            SELECT s.id, s.correction_of
            FROM sales s
            INNER JOIN find_root fr ON s.id = fr.correction_of
        ),
        root_sale AS (
            SELECT id as root_id
            FROM find_root
            WHERE correction_of IS NULL
            LIMIT 1
        ),
        -- Now traverse forward from the root to get the complete chain
        complete_chain AS (
            -- Start with the root sale
            SELECT s.id, s.sale_date, s.amount, s.status, s.correction_of, 
                   s.created_at, s.updated_at, s.created_by, s.last_updated_by
            FROM sales s
            CROSS JOIN root_sale rs
            WHERE s.id = rs.root_id
            
            UNION ALL
            
            -- Find all corrections in the chain
            SELECT s.id, s.sale_date, s.amount, s.status, s.correction_of,
                   s.created_at, s.updated_at, s.created_by, s.last_updated_by
            FROM sales s
            INNER JOIN complete_chain cc ON s.correction_of = cc.id
        )
        SELECT * FROM complete_chain
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

-- Add a helper function to find the root sale of any correction chain
CREATE OR REPLACE FUNCTION get_root_sale_id(p_sale_id uuid)
RETURNS uuid AS $$
DECLARE
    root_id uuid;
BEGIN
    WITH RECURSIVE find_root AS (
        SELECT id, correction_of
        FROM sales
        WHERE id = p_sale_id
        
        UNION ALL
        
        SELECT s.id, s.correction_of
        FROM sales s
        INNER JOIN find_root fr ON s.id = fr.correction_of
    )
    SELECT id INTO root_id
    FROM find_root
    WHERE correction_of IS NULL
    LIMIT 1;
    
    RETURN root_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to get all sales in a correction chain (useful for filtering active sales)
CREATE OR REPLACE FUNCTION get_correction_chain_ids(p_sale_id uuid)
RETURNS TABLE (sale_id uuid) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE correction_chain AS (
        -- Find the root first
        WITH RECURSIVE find_root AS (
            SELECT s.id, s.correction_of
            FROM sales s
            WHERE s.id = p_sale_id
            
            UNION ALL
            
            SELECT s.id, s.correction_of
            FROM sales s
            INNER JOIN find_root fr ON s.id = fr.correction_of
        ),
        root_sale AS (
            SELECT id as root_id
            FROM find_root
            WHERE correction_of IS NULL
            LIMIT 1
        ),
        -- Get complete chain from root
        complete_chain AS (
            SELECT s.id
            FROM sales s
            CROSS JOIN root_sale rs
            WHERE s.id = rs.root_id
            
            UNION ALL
            
            SELECT s.id
            FROM sales s
            INNER JOIN complete_chain cc ON s.correction_of = cc.id
        )
        SELECT * FROM complete_chain
    )
    SELECT cc.id
    FROM correction_chain cc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION get_sale_correction_history IS 'Gets the complete correction history for a sale, handling correction chains properly';
COMMENT ON FUNCTION get_root_sale_id IS 'Finds the original (root) sale in a correction chain';
COMMENT ON FUNCTION get_correction_chain_ids IS 'Returns all sale IDs in a correction chain for a given sale';
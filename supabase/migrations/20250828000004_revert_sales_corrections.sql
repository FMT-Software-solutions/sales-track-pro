-- Revert sales table to simple edit functionality
-- Remove correction-related columns and restore simple editing

-- First, drop the correction-related functions and triggers
DROP FUNCTION IF EXISTS get_sale_correction_history(UUID);
DROP FUNCTION IF EXISTS create_sale_correction(UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS void_sale(UUID);
DROP FUNCTION IF EXISTS close_sales_period(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

-- Remove correction-related columns from sales table
ALTER TABLE sales DROP COLUMN IF EXISTS status;
ALTER TABLE sales DROP COLUMN IF EXISTS correction_of;
ALTER TABLE sales DROP COLUMN IF EXISTS closed;
ALTER TABLE sales DROP COLUMN IF EXISTS last_updated_by;

-- Add back the simple is_active column for soft deletes
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at column for tracking modifications
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for is_active column
CREATE INDEX IF NOT EXISTS idx_sales_is_active ON sales(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales(updated_at DESC);

-- Update RLS policies to use is_active instead of status
DROP POLICY IF EXISTS "Users can view active sales in their organization" ON sales;
DROP POLICY IF EXISTS "Users can view all sales in their organization" ON sales;
DROP POLICY IF EXISTS "Users can insert sales in their organization" ON sales;
DROP POLICY IF EXISTS "Users can update sales in their organization" ON sales;
DROP POLICY IF EXISTS "Users can delete sales in their organization" ON sales;




-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN sales.is_active IS 'Soft delete flag - false means the sale has been deleted';
COMMENT ON COLUMN sales.updated_at IS 'Timestamp of last update to the sale record';

-- Update existing sales to set is_active = true for all active records
UPDATE sales SET is_active = true WHERE is_active IS NULL;
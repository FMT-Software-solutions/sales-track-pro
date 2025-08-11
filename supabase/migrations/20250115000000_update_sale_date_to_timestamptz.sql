-- Migration to update sale_date from date to timestamptz
-- This allows storing both date and time for sales

-- Update the sales table to use timestamptz for sale_date
ALTER TABLE sales 
ALTER COLUMN sale_date TYPE timestamptz 
USING sale_date::timestamptz;

-- Update the index to work with the new timestamptz type
DROP INDEX IF EXISTS idx_sales_sale_date;
CREATE INDEX idx_sales_sale_date ON sales(sale_date);

-- Add a comment to document the change
COMMENT ON COLUMN sales.sale_date IS 'Date and time when the sale occurred';
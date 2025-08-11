-- Add quantity and receipt tracking to sales table
ALTER TABLE sales ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);
ALTER TABLE sales ADD COLUMN receipt_generated_at TIMESTAMPTZ;

-- Create index for receipt tracking
CREATE INDEX idx_sales_receipt_generated_at ON sales(receipt_generated_at);

-- Add comment for documentation
COMMENT ON COLUMN sales.quantity IS 'Number of items sold';
COMMENT ON COLUMN sales.receipt_generated_at IS 'Timestamp when receipt was generated for this sale';
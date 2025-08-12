-- Migration to support multiple sales items per sale entry
-- This creates a junction table to handle many-to-many relationship

-- Create sale_items junction table (different from sales_items master table)
CREATE TABLE sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sales_item_id UUID NOT NULL REFERENCES sales_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_sales_item_id ON sale_items(sales_item_id);
CREATE INDEX idx_sale_items_created_at ON sale_items(created_at);

-- Enable RLS
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create policies for sale_items
CREATE POLICY "Admins can manage all sale items"
    ON sale_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Branch managers can manage their branch sale items"
    ON sale_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_items.sale_id 
            AND (p.branch_id = s.branch_id OR p.role = 'admin')
        )
    );

-- Add trigger for updated_at
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Remove the old sales_item_id and quantity columns from sales table
-- since we'll now use the junction table
ALTER TABLE sales DROP COLUMN IF EXISTS sales_item_id;
ALTER TABLE sales DROP COLUMN IF EXISTS quantity;

-- Drop the old index
DROP INDEX IF EXISTS idx_sales_sales_item_id;

-- Add a computed total_amount column to sales table that sums up all sale_items
-- This will be updated via triggers
ALTER TABLE sales ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;

-- Create function to update sales total_amount
CREATE OR REPLACE FUNCTION update_sales_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the total_amount for the affected sale
    UPDATE sales 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM sale_items 
        WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    )
    WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update sales total_amount when sale_items change
CREATE TRIGGER update_sales_total_on_sale_items_insert
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

CREATE TRIGGER update_sales_total_on_sale_items_update
    AFTER UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

CREATE TRIGGER update_sales_total_on_sale_items_delete
    AFTER DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

-- Create index for total_amount
CREATE INDEX idx_sales_total_amount ON sales(total_amount);

-- Add comment for documentation
COMMENT ON TABLE sale_items IS 'Junction table linking sales to multiple sales items with quantities and prices';
COMMENT ON COLUMN sales.total_amount IS 'Computed total amount from all sale_items for this sale';
COMMENT ON COLUMN sales.amount IS 'Legacy amount field - will be deprecated in favor of total_amount';
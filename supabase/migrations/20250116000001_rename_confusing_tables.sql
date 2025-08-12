-- Migration to rename confusing table names for better clarity
-- sales_items -> products (master catalog of sellable items)
-- sale_items -> sale_line_items (junction table for sale line items)

-- First, rename sales_items to products
ALTER TABLE sales_items RENAME TO products;

-- Update all indexes
ALTER INDEX idx_sales_items_active RENAME TO idx_products_active;
ALTER INDEX idx_sales_items_name RENAME TO idx_products_name;
ALTER INDEX idx_sales_items_created_by RENAME TO idx_products_created_by;
ALTER INDEX idx_sales_items_organization_id RENAME TO idx_products_organization_id;

-- Update RLS policies
DROP POLICY IF EXISTS "sales_items_select_policy" ON products;
DROP POLICY IF EXISTS "sales_items_insert_policy" ON products;
DROP POLICY IF EXISTS "sales_items_update_policy" ON products;
DROP POLICY IF EXISTS "sales_items_delete_policy" ON products;

-- Create new RLS policies for products
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND (p.organization_id = products.organization_id OR p.role = 'admin')
        )
    );

CREATE POLICY "products_insert_policy" ON products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND (p.organization_id = products.organization_id OR p.role = 'admin')
        )
    );

CREATE POLICY "products_update_policy" ON products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND (p.organization_id = products.organization_id OR p.role = 'admin')
        )
    );

CREATE POLICY "products_delete_policy" ON products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND (p.organization_id = products.organization_id OR p.role = 'admin')
        )
    );

-- Update triggers
DROP TRIGGER IF EXISTS update_sales_items_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Now rename sale_items to sale_line_items
ALTER TABLE sale_items RENAME TO sale_line_items;

-- Update all indexes for sale_line_items
ALTER INDEX idx_sale_items_sale_id RENAME TO idx_sale_line_items_sale_id;
ALTER INDEX idx_sale_items_sales_item_id RENAME TO idx_sale_line_items_product_id;

-- Update foreign key constraint names and column references
ALTER TABLE sale_line_items RENAME COLUMN sales_item_id TO product_id;

-- Update RLS policies for sale_line_items
DROP POLICY IF EXISTS "sale_items_select_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_items_insert_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_items_update_policy" ON sale_line_items;
DROP POLICY IF EXISTS "sale_items_delete_policy" ON sale_line_items;

-- Create new RLS policies for sale_line_items
CREATE POLICY "sale_line_items_select_policy" ON sale_line_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND (p.branch_id = s.branch_id OR p.role = 'admin')
        )
    );

CREATE POLICY "sale_line_items_insert_policy" ON sale_line_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND (p.branch_id = s.branch_id OR p.role = 'admin')
        )
    );

CREATE POLICY "sale_line_items_update_policy" ON sale_line_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND (p.branch_id = s.branch_id OR p.role = 'admin')
        )
    );

CREATE POLICY "sale_line_items_delete_policy" ON sale_line_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sales s
            JOIN profiles p ON p.id = auth.uid()
            WHERE s.id = sale_line_items.sale_id 
            AND (p.branch_id = s.branch_id OR p.role = 'admin')
        )
    );

-- Update triggers for sale_line_items
DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_line_items;
CREATE TRIGGER update_sale_line_items_updated_at
    BEFORE UPDATE ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update the triggers that reference the old table names
DROP TRIGGER IF EXISTS update_sales_total_on_sale_items_insert ON sale_line_items;
DROP TRIGGER IF EXISTS update_sales_total_on_sale_items_update ON sale_line_items;
DROP TRIGGER IF EXISTS update_sales_total_on_sale_items_delete ON sale_line_items;

CREATE TRIGGER update_sales_total_on_sale_line_items_insert
    AFTER INSERT ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

CREATE TRIGGER update_sales_total_on_sale_line_items_update
    AFTER UPDATE ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

CREATE TRIGGER update_sales_total_on_sale_line_items_delete
    AFTER DELETE ON sale_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_total_amount();

-- Update the function to reference the new table name
CREATE OR REPLACE FUNCTION update_sales_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE sales 
        SET total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM sale_line_items 
            WHERE sale_id = NEW.sale_id
        )
        WHERE id = NEW.sale_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        UPDATE sales 
        SET total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM sale_line_items 
            WHERE sale_id = OLD.sale_id
        )
        WHERE id = OLD.sale_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Remove old sales table columns that are no longer needed
ALTER TABLE sales DROP COLUMN IF EXISTS sales_item_id;
ALTER TABLE sales DROP COLUMN IF EXISTS quantity;

-- Drop old indexes that might still exist
DROP INDEX IF EXISTS idx_sales_sales_item_id;
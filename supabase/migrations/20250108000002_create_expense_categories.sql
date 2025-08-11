-- Create expense_categories table
CREATE TABLE expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for better performance
CREATE INDEX idx_expense_categories_active ON expense_categories(is_active);
CREATE INDEX idx_expense_categories_name ON expense_categories(name);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all active expense categories" ON expense_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert expense categories" ON expense_categories
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own expense categories" ON expense_categories
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own expense categories" ON expense_categories
  FOR DELETE USING (auth.uid() = created_by);

-- Add trigger for updated_at
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO expense_categories (name, description, created_by) VALUES
  ('Food & Ingredients', 'Raw materials and food ingredients', NULL),
  ('Rent & Utilities', 'Rent, electricity, water, internet', NULL),
  ('Staff Wages', 'Employee salaries and wages', NULL),
  ('Equipment', 'Kitchen equipment and tools', NULL),
  ('Marketing', 'Advertising and promotional expenses', NULL),
  ('Transportation', 'Delivery and transport costs', NULL),
  ('Supplies', 'General supplies and materials', NULL),
  ('Maintenance', 'Equipment and facility maintenance', NULL),
  ('Insurance', 'Business insurance premiums', NULL),
  ('Taxes', 'Business taxes and fees', NULL),
  ('Other', 'Miscellaneous expenses', NULL);

-- Add expense_category_id to expenses table
ALTER TABLE expenses ADD COLUMN expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_expense_category_id ON expenses(expense_category_id);

-- Update existing expenses to use the new category system
UPDATE expenses SET expense_category_id = (
  SELECT id FROM expense_categories WHERE name = expenses.category LIMIT 1
) WHERE category IS NOT NULL;
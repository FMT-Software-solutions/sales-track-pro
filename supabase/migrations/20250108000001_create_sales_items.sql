-- Create sales_items table
CREATE TABLE sales_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for better performance
CREATE INDEX idx_sales_items_active ON sales_items(is_active);
CREATE INDEX idx_sales_items_name ON sales_items(name);

-- Enable RLS
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all active sales items" ON sales_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert sales items" ON sales_items
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own sales items" ON sales_items
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own sales items" ON sales_items
  FOR DELETE USING (auth.uid() = created_by);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sales_items_updated_at BEFORE UPDATE ON sales_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add sales_item_id to sales table
ALTER TABLE sales ADD COLUMN sales_item_id UUID REFERENCES sales_items(id) ON DELETE SET NULL;
CREATE INDEX idx_sales_sales_item_id ON sales(sales_item_id);
/*
  # SalesTrack Pro Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, not null)
      - `full_name` (text, not null)
      - `role` (enum: admin, branch_manager, default: branch_manager)
      - `branch_id` (uuid, foreign key to branches, nullable for admins)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `branches`
      - `id` (uuid, primary key, default gen_random_uuid())
      - `name` (text, not null)
      - `location` (text, not null)
      - `description` (text, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `sales`
      - `id` (uuid, primary key, default gen_random_uuid())
      - `branch_id` (uuid, foreign key to branches, not null)
      - `amount` (numeric, not null, check > 0)
      - `description` (text, nullable)
      - `sale_date` (date, not null)
      - `created_by` (uuid, foreign key to auth.users, not null)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `expenses`
      - `id` (uuid, primary key, default gen_random_uuid())
      - `branch_id` (uuid, foreign key to branches, not null)
      - `amount` (numeric, not null, check > 0)
      - `category` (text, not null)
      - `description` (text, nullable)
      - `expense_date` (date, not null)
      - `created_by` (uuid, foreign key to auth.users, not null)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Admins can access all data
    - Branch managers can only access their branch data
    - Users can only see their own profile

  3. Functions & Triggers
    - Auto-update updated_at timestamps
    - Profile creation trigger for new users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'branch_manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role user_role DEFAULT 'branch_manager',
    branch_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    location text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for profiles.branch_id after branches table is created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_branch_id_fkey'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_branch_id_fkey 
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount > 0),
    description text,
    sale_date date NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount > 0),
    category text NOT NULL,
    description text,
    expense_date date NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;
CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Branches policies
CREATE POLICY "Admins can manage all branches"
    ON branches
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Branch managers can read their branch"
    ON branches
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND branch_id = branches.id
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sales policies
CREATE POLICY "Admins can manage all sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Branch managers can manage their branch sales"
    ON sales
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND branch_id = sales.branch_id
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Expenses policies
CREATE POLICY "Admins can manage all expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Branch managers can manage their branch expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND branch_id = expenses.branch_id
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );



-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'branch_manager')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert demo data
INSERT INTO branches (id, name, location, description, is_active) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Downtown Branch', 'Main Street, Downtown', 'Our flagship location in the heart of the city', true),
    ('550e8400-e29b-41d4-a716-446655440002', 'Mall Branch', 'City Mall, Food Court', 'Located in the busy food court area', true),
    ('550e8400-e29b-41d4-a716-446655440003', 'Airport Branch', 'International Airport, Terminal 2', 'Serving travelers and airport staff', true)
ON CONFLICT (id) DO NOTHING;

-- Insert demo users (these will be created when users sign up)
-- Admin user: admin@foodtrack.com / password123
-- Manager user: manager@foodtrack.com / password123
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_size bigint NOT NULL DEFAULT 0,
  version character varying NOT NULL UNIQUE,
  release_notes text,
  download_url text NOT NULL,
  minimum_version character varying,
  published_at timestamp with time zone,
  platform character varying NOT NULL DEFAULT 'all'::character varying,
  status character varying NOT NULL DEFAULT 'draft'::character varying,
  is_critical boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_latest boolean NOT NULL DEFAULT false,
  CONSTRAINT app_versions_pkey PRIMARY KEY (id),
  CONSTRAINT app_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.branches (
  name text NOT NULL,
  location text NOT NULL,
  description text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  contact text,
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.expense_categories (
  name character varying NOT NULL UNIQUE,
  description text,
  created_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  CONSTRAINT expense_categories_pkey PRIMARY KEY (id),
  CONSTRAINT expense_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT expense_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.expenses (
  branch_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  category text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  expense_date timestamp with time zone NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  expense_category_id uuid,
  organization_id uuid,
  last_updated_by uuid,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_last_updated_by_fkey1 FOREIGN KEY (last_updated_by) REFERENCES public.profiles(id),
  CONSTRAINT expenses_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT expenses_expense_category_id_fkey FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id),
  CONSTRAINT expenses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT expenses_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id),
  CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organizations (
  name character varying NOT NULL,
  email character varying,
  phone character varying,
  address text,
  logo_url text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  currency character varying NOT NULL DEFAULT 'GH₵'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  description text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  name character varying NOT NULL,
  description text,
  created_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT sales_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT sales_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.profiles (
  role USER-DEFINED DEFAULT 'sales_person'::user_role,
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  branch_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.sale_line_items (
  sale_id uuid NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price numeric DEFAULT ((quantity)::numeric * unit_price),
  product_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sale_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_sales_item_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.sales (
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'voided'::text, 'corrected'::text])),
  correction_of uuid,
  closed boolean DEFAULT false,
  branch_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text,
  created_by uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sale_date timestamp with time zone NOT NULL,
  receipt_generated_at timestamp with time zone,
  organization_id uuid,
  customer_name text,
  total_amount numeric DEFAULT 0,
  last_updated_by uuid,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_correction_of_fkey FOREIGN KEY (correction_of) REFERENCES public.sales(id),
  CONSTRAINT sales_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT sales_last_updated_by_fkey1 FOREIGN KEY (last_updated_by) REFERENCES public.profiles(id),
  CONSTRAINT sales_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id),
  CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT sales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT sales_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.user_organizations (
  user_id uuid,
  organization_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role character varying NOT NULL DEFAULT 'member'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_organizations_pkey PRIMARY KEY (id),
  CONSTRAINT user_organizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
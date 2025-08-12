import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { getPeriodRange } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth';

export type Branch = Database['public']['Tables']['branches']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'] & {
  branches?: {
    name: string;
    location: string;
  };
  sale_line_items?: SaleLineItem[];
  // Keep old property for backward compatibility during transition
  sale_items?: SaleItem[];
  created_by_profile?: {
    id: string;
    full_name: string;
  };
  last_updated_by_profile?: {
    id: string;
    full_name: string;
  };
};
export type Expense = Database['public']['Tables']['expenses']['Row'] & {
  branches?: {
    name: string;
    location: string;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
  };
  last_updated_by_profile?: {
    id: string;
    full_name: string;
  };
};
// Legacy types for backward compatibility - these tables have been renamed
export type SalesItem = Product;
export type SaleItem = SaleLineItem;
export type Product = Database['public']['Tables']['products']['Row'];
export type SaleLineItem = Database['public']['Tables']['sale_line_items']['Row'] & {
  products?: {
    id: string;
    name: string;
    price: number;
  };
};
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type UserOrganization = Database['public']['Tables']['user_organizations']['Row'];

// Branches
export function useBranches(organizationId?: string, user?: AuthUser | null) {
  return useQuery({
    queryKey: ['branches', organizationId, user?.profile?.role, user?.profile?.branch_id],
    queryFn: async () => {
      let query = supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      // If user is not admin and has a specific branch, only return their branch
      if (user?.profile?.role !== 'admin' && user?.profile?.branch_id) {
        query = query.eq('id', user.profile.branch_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Branch[];
    },
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      branch: Database['public']['Tables']['branches']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('branches')
        .insert(branch)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['branches']['Update']) => {
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

// Sales
export function useSales(
  branchId?: string,
  startDate?: string,
  endDate?: string,
  organizationId?: string
) {
  return useQuery({
    queryKey: ['sales', branchId, startDate, endDate, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(
          `
          *,
          branches (
            name,
            location
          ),
          sale_line_items (
            id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              price
            )
          ),
          created_by_profile:profiles!created_by (
            id,
            full_name
          ),
          last_updated_by_profile:profiles!last_updated_by (
            id,
            full_name
          )
        `
        )
        .order('sale_date', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (startDate) {
        query = query.gte('sale_date', startDate);
      }

      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Sale[];
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      sale: Database['public']['Tables']['sales']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('sales')
        .insert(sale)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateSaleReceiptGenerated() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase
        .from('sales')
        .update({ receipt_generated_at: new Date().toISOString() })
        .eq('id', saleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

// Expense Categories
export function useExpenseCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['expense-categories', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      category: Database['public']['Tables']['expense_categories']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['expense_categories']['Update']) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

// Sales Items
export function useProducts(organizationId?: string) {
  return useQuery({
    queryKey: ['products', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useSalesItems = useProducts;

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      product: Database['public']['Tables']['products']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useCreateSalesItem = useCreateProduct;

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['products']['Update']) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useUpdateSalesItem = useUpdateProduct;

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useDeleteSalesItem = useDeleteProduct;

export function useUpdateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['sales']['Update']) => {
      const { data, error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Sale Line Items (junction table)
export function useSaleLineItems(saleId: string) {
  return useQuery({
    queryKey: ['sale-line-items', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_line_items')
        .select(
          `
          *,
          products (
            id,
            name,
            price
          )
        `
        )
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SaleLineItem[];
    },
    enabled: !!saleId,
  });
}

// Keep old hook for backward compatibility during transition
export const useSaleItems = useSaleLineItems;

export function useCreateSaleLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      saleLineItem: Database['public']['Tables']['sale_line_items']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('sale_line_items')
        .insert(saleLineItem)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sale-line-items', data.sale_id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useCreateSaleItem = useCreateSaleLineItem;

export function useUpdateSaleLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['sale_line_items']['Update']) => {
      const { data, error } = await supabase
        .from('sale_line_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sale-line-items', data.sale_id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useUpdateSaleItem = useUpdateSaleLineItem;

export function useDeleteSaleLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the sale_id before deleting
      const { data: saleLineItem } = await supabase
        .from('sale_line_items')
        .select('sale_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('sale_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return saleLineItem?.sale_id;
    },
    onSuccess: (saleId) => {
      if (saleId) {
        queryClient.invalidateQueries({ queryKey: ['sale-line-items', saleId] });
      }
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useDeleteSaleItem = useDeleteSaleLineItem;

// Expenses
export function useExpenses(
  branchId?: string,
  categoryId?: string,
  startDate?: string,
  endDate?: string,
  organizationId?: string
) {
  return useQuery({
    queryKey: ['expenses', branchId, categoryId, startDate, endDate, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select(
          `
          *,
          branches (
            name,
            location
          ),
          created_by_profile:profiles!created_by (
            id,
            full_name
          ),
          last_updated_by_profile:profiles!last_updated_by (
            id,
            full_name
          )
        `
        )
        .order('expense_date', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (startDate) {
        query = query.gte('expense_date', startDate);
      }

      if (endDate) {
        query = query.lte('expense_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      expense: Database['public']['Tables']['expenses']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['expenses']['Update']) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Dashboard Analytics
export function useDashboardData(branchId?: string, period: string = 'month', organizationId?: string) {
  return useQuery({
    queryKey: ['dashboard', branchId, period, organizationId],
    queryFn: async () => {
      const now = new Date();
      const { startDate, endDate } = getPeriodRange(period, now);
      const startDateStr = startDate
        ? startDate.toISOString().split('T')[0]
        : undefined;
      const endDateStr = endDate
        ? endDate.toISOString().split('T')[0]
        : undefined;

      // Get sales
      let salesQuery = supabase.from('sales').select('*');
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId);
      }
      if (startDateStr) {
        salesQuery = salesQuery.gte('sale_date', startDateStr);
      }
      if (endDateStr) {
        salesQuery = salesQuery.lte('sale_date', endDateStr);
      }
      if (branchId) {
        salesQuery = salesQuery.eq('branch_id', branchId);
      }

      // Get expenses
      let expensesQuery = supabase.from('expenses').select('*');
      if (organizationId) {
        expensesQuery = expensesQuery.eq('organization_id', organizationId);
      }
      if (startDateStr) {
        expensesQuery = expensesQuery.gte('expense_date', startDateStr);
      }
      if (endDateStr) {
        expensesQuery = expensesQuery.lte('expense_date', endDateStr);
      }
      if (branchId) {
        expensesQuery = expensesQuery.eq('branch_id', branchId);
      }

      const [salesResult, expensesResult] = await Promise.all([
        salesQuery,
        expensesQuery,
      ]);

      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;

      const totalSales = salesResult.data.reduce(
        (sum, sale) => sum + (sale.amount * (sale.quantity || 1)),
        0
      );
      const totalExpenses = expensesResult.data.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );
      const netProfit = totalSales - totalExpenses;

      return {
        totalSales,
        totalExpenses,
        netProfit,
        salesData: salesResult.data,
        expensesData: expensesResult.data,
      };
    },
  });
}

// Organizations
export function useUserOrganizations() {
  return useQuery({
    queryKey: ['user-organizations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          *,
          organizations (
            id,
            name,
            email,
            phone,
            currency,
            address,
            logo_url,
            is_active,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: true, // Always enabled since we check for user inside the queryFn
  });
}

export function useCurrentOrganization() {
  const { data: userOrganizations } = useUserOrganizations();
  
  return useQuery({
    queryKey: ['current-organization'],
    queryFn: async () => {
      // For now, return the first organization the user belongs to
      // In the future, this could be stored in user preferences
      if (userOrganizations && userOrganizations.length > 0) {
        return userOrganizations[0].organizations;
      }
      return null;
    },
    enabled: !!userOrganizations,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organization: Database['public']['Tables']['organizations']['Insert']) => {
      const { data, error } = await supabase
        .from('organizations')
        .insert(organization)
        .select()
        .single();

      if (error) throw error;

      // Add the current user as an admin of the new organization
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          organization_id: data.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['current-organization'] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['organizations']['Update']) => {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['current-organization'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['profiles']['Update']) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { getPeriodRange } from '@/lib/utils';
import type { AuthUser, UserRole } from '@/lib/auth';

// Helper function to check if user can view all data
function canUserViewAllData(role?: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'auditor';
}

export type Branch = Database['public']['Tables']['branches']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'] & {
  branches?: {
    name: string;
    location: string;
    contact: string | null;
    is_active: boolean;
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

  // New immutable transaction fields
  status?: 'active' | 'voided' | 'corrected';

  closed?: boolean;
  last_updated_by?: string | null;
};
export type Expense = Database['public']['Tables']['expenses']['Row'] & {
  branches?: {
    name: string;
    location: string;
    contact: string | null;
    is_active: boolean;
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
export type ActivityLog = Database['public']['Tables']['activities_log']['Row'] & {
  user_profile?: {
    id: string;
    full_name: string;
  };
  branch?: {
    name: string;
    location: string;
  };
};

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

      // If user cannot view all data and has a specific branch, only return their branch
      if (!canUserViewAllData(user?.profile?.role) && user?.profile?.branch_id) {
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
  const createActivityLog = useCreateActivityLog();

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

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createActivityLog.mutateAsync({
          organization_id: branch.organization_id,
          branch_id: data.id, // Use the newly created branch ID
          user_id: user.id,
          activity_type: 'create',
          entity_type: 'branch',
          entity_id: data.id,
          description: `Created branch: ${branch.name}`,
          new_values: data,
          metadata: {
            name: branch.name,
            location: branch.location
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['branches']['Update']) => {
      // Get the old values first
      const { data: oldData } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && oldData) {
        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: data.id,
          user_id: user.id,
          activity_type: 'update',
          entity_type: 'branch',
          entity_id: data.id,
          description: `Updated branch: ${data.name}`,
          old_values: oldData,
          new_values: data,
          metadata: {
            name: data.name,
            location: data.location
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

// Sales
export function useSales(
  branchId?: string,
  startDate?: string,
  endDate?: string,
  organizationId?: string,
  includeInactive = false // New parameter to include voided/corrected sales
) {
  return useQuery({
    queryKey: ['sales', branchId, startDate, endDate, organizationId, includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(
          `
          *,
          branches (
            name,
            location,
            contact,
            is_active
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

      // Filter by is_active - only show active sales by default
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

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
      return (data || []) as unknown as Sale[];
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (
      sale: Database['public']['Tables']['sales']['Insert']
    ) => {
      // Ensure new sales are created as active
      const saleWithStatus = {
        ...sale,
        is_active: true
      };

      const { data, error } = await supabase
        .from('sales')
        .insert(saleWithStatus)
        .select()
        .single();

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          user_id: user.id,
          activity_type: 'create',
          entity_type: 'sale',
          entity_id: data.id,
          description: `Created sale for ${data.customer_name || 'customer'}`,
          new_values: data,
          metadata: {
            amount: data.amount,
            customer_name: data.customer_name
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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

// Sale Correction Functions
// Sale correction functionality removed - using simple edits now
// This hook is kept for backward compatibility but will use updateSale instead
export function useCorrectSale() {
  return useUpdateSale();
}

export function useVoidSale() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (saleId: string) => {
      // Get the sale data before voiding
      const { data: saleData } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      const { data, error } = await supabase
        .from('sales')
        .update({ is_active: false })
        .eq('id', saleId)
        .select()
        .single();

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && saleData) {
        await createActivityLog.mutateAsync({
          organization_id: saleData.organization_id,
          branch_id: saleData.branch_id,
          user_id: user.id,
          activity_type: 'void',
          entity_type: 'sale',
          entity_id: saleId,
          description: `Voided sale for ${saleData.customer_name || 'customer'}`,
          old_values: saleData,
          new_values: data,
          metadata: {
            amount: saleData.amount,
            customer_name: saleData.customer_name
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

// Period Closing
export function useCloseSalesPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      startDate,
      endDate,
      branchId
    }: {
      startDate: string;
      endDate: string;
      branchId?: string;
    }) => {
      const { data, error } = await supabase.rpc('close_sales_period', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_branch_id: branchId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

// Get sales with all statuses for audit purposes
export function useSalesWithHistory(
  branchId?: string,
  startDate?: string,
  endDate?: string,
  organizationId?: string
) {
  return useSales(branchId, startDate, endDate, organizationId, true);
}

// Expense Categories
export function useExpenseCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['expense-categories', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('expense_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ExpenseCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

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

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user profile to get branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        await createActivityLog.mutateAsync({
          organization_id: category.organization_id,
          branch_id: profile?.branch_id || null,
          user_id: user.id,
          activity_type: 'create',
          entity_type: 'expense_category',
          entity_id: data.id,
          description: `Created expense category: ${category.name}`,
          new_values: data,
          metadata: {
            name: category.name
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['expense_categories']['Update']) => {
      // Get the old values first
      const { data: oldData } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('expense_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && oldData) {
        // Get user profile to get branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: profile?.branch_id || null,
          user_id: user.id,
          activity_type: 'update',
          entity_type: 'expense_category',
          entity_id: data.id,
          description: `Updated expense category: ${data.name}`,
          old_values: oldData,
          new_values: data,
          metadata: {
            name: data.name
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the expense category data before deleting
      const { data: categoryData } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && categoryData) {
        await createActivityLog.mutateAsync({
          organization_id: categoryData.organization_id,
          branch_id: categoryData.branch_id,
          user_id: user.id,
          activity_type: 'delete',
          entity_type: 'expense_category',
          entity_id: id,
          description: `Deleted expense category: ${categoryData.name}`,
          old_values: categoryData,
          metadata: {
            name: categoryData.name
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!organizationId,
  });
}

// Keep old hook for backward compatibility during transition
export const useSalesItems = useProducts;

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

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

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user profile to get branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        await createActivityLog.mutateAsync({
          organization_id: product.organization_id,
          branch_id: profile?.branch_id || null,
          user_id: user.id,
          activity_type: 'create',
          entity_type: 'product',
          entity_id: data.id,
          description: `Created product: ${product.name}`,
          new_values: data,
          metadata: {
            name: product.name,
            price: product.price
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['products']['Update']) => {
      // Get the old values first
      const { data: oldData } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && oldData) {
        // Get user profile to get branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: profile?.branch_id || null,
          user_id: user.id,
          activity_type: 'update',
          entity_type: 'product',
          entity_id: data.id,
          description: `Updated product: ${data.name}`,
          old_values: oldData,
          new_values: data,
          metadata: {
            name: data.name,
            price: data.price
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useUpdateSalesItem = useUpdateProduct;

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the product data before deleting
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && productData) {
        // Get user profile to get branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single();

        await createActivityLog.mutateAsync({
          organization_id: productData.organization_id,
          branch_id: profile?.branch_id || null,
          user_id: user.id,
          activity_type: 'delete',
          entity_type: 'product',
          entity_id: id,
          description: `Deleted product: ${productData.name}`,
          old_values: productData,
          metadata: {
            name: productData.name,
            price: productData.price
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

// Keep old hook for backward compatibility during transition
export const useDeleteSalesItem = useDeleteProduct;

export function useUpdateSale() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['sales']['Update']) => {
      // Get the original sale data before updating
      const { data: originalSale } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && originalSale) {
        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          user_id: user.id,
          activity_type: 'update',
          entity_type: 'sale',
          entity_id: id,
          description: `Updated sale for ${data.customer_name || 'customer'}`,
          old_values: originalSale,
          new_values: data,
          metadata: {
            amount: data.amount,
            customer_name: data.customer_name
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the sale data before deleting
      const { data: saleData } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && saleData) {
        await createActivityLog.mutateAsync({
          organization_id: saleData.organization_id,
          branch_id: saleData.branch_id,
          user_id: user.id,
          activity_type: 'delete',
          entity_type: 'sale',
          entity_id: id,
          description: `Deleted sale for ${saleData.customer_name || 'customer'}`,
          old_values: saleData,
          metadata: {
            amount: saleData.amount,
            customer_name: saleData.customer_name
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
            location,
            contact,
            is_active
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
  const createActivityLog = useCreateActivityLog();

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

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createActivityLog.mutateAsync({
          organization_id: expense.organization_id,
          branch_id: expense.branch_id,
          user_id: user.id,
          activity_type: 'create',
          entity_type: 'expense',
          entity_id: data.id,
          description: `Created expense: ${expense.description || 'New expense'}`,
          new_values: data,
          metadata: {
            amount: expense.amount,
            category_id: expense.expense_category_id
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Database['public']['Tables']['expenses']['Update']) => {
      // Get the old values first
      const { data: oldData } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && oldData) {
        await createActivityLog.mutateAsync({
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          user_id: user.id,
          activity_type: 'update',
          entity_type: 'expense',
          entity_id: data.id,
          description: `Updated expense: ${data.description || 'Expense'}`,
          old_values: oldData,
          new_values: data,
          metadata: {
            amount: data.amount,
            category_id: data.category_id
          }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the expense data before deleting
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Log the activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user && expenseData) {
        await createActivityLog.mutateAsync({
          organization_id: expenseData.organization_id,
          branch_id: expenseData.branch_id,
          user_id: user.id,
          activity_type: 'delete',
          entity_type: 'expense',
          entity_id: id,
          description: `Deleted expense: ${expenseData.description || 'Expense'}`,
          old_values: expenseData,
          metadata: {
            amount: expenseData.amount,
            category_id: expenseData.category_id
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
        ? startDate.toISOString()
        : undefined;
      const endDateStr = endDate
        ? endDate.toISOString()
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

// Activity Log Types
// Activity Logs
export function useActivityLogs(
  organizationId?: string,
  branchId?: string,
  entityType?: string,
  entityId?: string,
  saleId?: string,
  startDate?: string,
  endDate?: string,
  user?: AuthUser | null
) {
  return useQuery({
    queryKey: ['activity-logs', organizationId, branchId, entityType, entityId, saleId, startDate, endDate, user?.profile?.role, user?.profile?.branch_id],
    queryFn: async () => {
      let query = supabase
        .from('activities_log')
        .select(
          `
          *,
          user_profile:profiles!user_id (
            id,
            full_name
          ),
          branch:branches!branch_id (
            name,
            location
          )
        `
        )
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      // Apply role-based filtering
      if (!canUserViewAllData(user?.profile?.role) && user?.profile?.branch_id) {
        query = query.eq('branch_id', user.profile.branch_id);
      }

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      if (saleId) {
        query = query.eq('entity_id', saleId).eq('entity_type', 'sale');
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!organizationId,
  });
}

// Get activity logs for a specific sale
export function useSaleActivityLogs(saleId?: string, organizationId?: string) {
  return useQuery({
    queryKey: ['sale-activity-logs', saleId, organizationId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('activities_log')
        .select(
          `
          *,
          user_profile:profiles!user_id (
            id,
            full_name
          ),
          branch:branches!branch_id (
            name,
            location
          )
        `
        )
        .eq('sale_id', saleId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!saleId && !!organizationId,
  });
}

// Create activity log entry
export function useCreateActivityLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      activity: Database['public']['Tables']['activities_log']['Insert']
    ) => {
      const { data, error } = await supabase
        .from('activities_log')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sale-activity-logs'] });
    },
  });
}

// Helper function to log sale activities
export function useLogSaleActivity() {
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      organizationId,
      branchId,
      saleId,
      activityType,
      description,
      oldValues,
      newValues,
      metadata
    }: {
      organizationId: string;
      branchId?: string;
      saleId: string;
      activityType: string;
      description: string;
      oldValues?: any;
      newValues?: any;
      metadata?: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      return createActivityLog.mutateAsync({
        organization_id: organizationId,
        branch_id: branchId,
        user_id: user.id,
        activity_type: activityType,
        entity_type: 'sale',
        entity_id: saleId,
        sale_id: saleId || null,
        description,
        old_values: oldValues,
        new_values: newValues,
        metadata
      });
    },
  });
}

// Helper function to log general activities
export function useLogActivity() {
  const createActivityLog = useCreateActivityLog();

  return useMutation({
    mutationFn: async ({
      organizationId,
      branchId,
      activityType,
      entityType,
      entityId,
      description,
      oldValues,
      newValues,
      metadata
    }: {
      organizationId: string;
      branchId?: string;
      activityType: string;
      entityType: string;
      entityId?: string;
      description: string;
      oldValues?: any;
      newValues?: any;
      metadata?: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      return createActivityLog.mutateAsync({
        organization_id: organizationId,
        branch_id: branchId,
        user_id: user.id,
        activity_type: activityType,
        entity_type: entityType,
        entity_id: entityId || null,
        description,
        old_values: oldValues,
        new_values: newValues,
        metadata
      });
    },
  });
}

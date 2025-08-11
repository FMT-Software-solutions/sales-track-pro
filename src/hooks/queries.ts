import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { getPeriodRange } from '@/lib/utils';

export type Branch = Database['public']['Tables']['branches']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];

// Branches
export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

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
  endDate?: string
) {
  return useQuery({
    queryKey: ['sales', branchId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(
          `
          *,
          branches (
            name,
            location
          )
        `
        )
        .order('sale_date', { ascending: false });

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

// Expenses
export function useExpenses(
  branchId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['expenses', branchId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select(
          `
          *,
          branches (
            name,
            location
          )
        `
        )
        .order('expense_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
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
export function useDashboardData(branchId?: string, period: string = 'month') {
  return useQuery({
    queryKey: ['dashboard', branchId, period],
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
        (sum, sale) => sum + sale.amount,
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

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useBranches,
  useCreateExpense,
  useUpdateExpense,
  Expense,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar22 } from '@/components/ui/calendar22';
import { parse } from 'date-fns';
import React from 'react';

const expenseCategories = [
  'Food & Ingredients',
  'Rent & Utilities',
  'Staff Wages',
  'Equipment',
  'Marketing',
  'Transportation',
  'Supplies',
  'Maintenance',
  'Insurance',
  'Taxes',
  'Other',
];

const expenseSchema = z.object({
  branch_id: z.string().min(1, 'Please select a branch'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Please select a category'),
  description: z.string().optional(),
  expense_date: z.string().min(1, 'Expense date is required'),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  onSuccess?: () => void;
  expense?: Expense;
}

export function ExpenseForm({ onSuccess, expense }: ExpenseFormProps) {
  const { user } = useAuthStore();
  const { data: branches = [] } = useBranches();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches
      : branches.filter(
          (branch) => branch.is_active && branch.id === user?.profile?.branch_id
        );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          expense_date: expense.expense_date,
          branch_id: expense.branch_id,
          category: expense.category,
          amount: expense.amount,
          description: expense.description || '',
        }
      : {
          expense_date: format(new Date(), 'yyyy-MM-dd'),
          branch_id: userBranches.length === 1 ? userBranches[0].id : '',
        },
  });

  // If editing, update form values when expense changes
  React.useEffect(() => {
    if (expense) {
      reset({
        expense_date: expense.expense_date,
        branch_id: expense.branch_id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description || '',
      });
    }
  }, [expense, reset]);

  const selectedBranchId = watch('branch_id');
  const selectedCategory = watch('category');
  const expenseDateString = watch('expense_date');
  const expenseDate = expenseDateString
    ? parse(expenseDateString, 'yyyy-MM-dd', new Date())
    : new Date();

  const onSubmit = async (data: ExpenseForm) => {
    if (!user?.id) return;
    try {
      if (expense) {
        await updateExpense.mutateAsync({ id: expense.id, ...data });
        toast.success('Expense updated successfully');
      } else {
        await createExpense.mutateAsync({
          ...data,
          amount: Number(data.amount),
          created_by: user.id,
        });
        toast.success('Expense recorded successfully');
      }
      // Preserve selected branch and category after reset
      reset({
        expense_date: format(data.expense_date, 'yyyy-MM-dd'),
        branch_id: data.branch_id,
        category: data.category,
        amount: 0,
        description: '',
      });
      onSuccess?.();
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Failed to save expense');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="branch_id">Branch</Label>
          <Select
            value={selectedBranchId}
            onValueChange={(value) => setValue('branch_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {userBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} - {branch.location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.branch_id && (
            <p className="text-sm text-red-600">{errors.branch_id.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Calendar22
            label="Expense Date"
            value={expenseDate}
            onChange={(date) =>
              setValue('expense_date', date ? format(date, 'yyyy-MM-dd') : '')
            }
            id="expense_date"
          />
          {errors.expense_date && (
            <p className="text-sm text-red-600">
              {errors.expense_date.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (GH₵)</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && (
            <p className="text-sm text-red-600">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={selectedCategory}
            onValueChange={(value) => setValue('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-600">{errors.category.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter expense description or notes"
          {...register('description')}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Clear
        </Button>
        <Button type="submit" disabled={createExpense.isPending}>
          {createExpense.isPending ? 'Recording...' : 'Record Expense'}
        </Button>
      </div>
    </form>
  );
}

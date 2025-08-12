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
  useExpenseCategories,
  useCreateExpenseCategory,
  Expense,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar22 } from '@/components/ui/calendar22';
import React from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

const expenseSchema = z.object({
  branch_id: z.string().min(1, 'Branch is required'),
  expense_date: z.string().min(1, 'Expense date is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  expense_category_id: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  include_time: z.boolean().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  onSuccess?: () => void;
  expense?: Expense;
}

export function ExpenseForm({ onSuccess, expense }: ExpenseFormProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { data: branches = [] } = useBranches(currentOrganization?.id);
  const { data: expenseCategories = [] } = useExpenseCategories(
    currentOrganization?.id
  );
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createExpenseCategory = useCreateExpenseCategory();

  // State for quick add category
  const [showNewCategoryForm, setShowNewCategoryForm] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches.filter((branch) => branch.is_active)
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
          expense_category_id: expense.expense_category_id || '',
          amount: expense.amount,
          description: expense.description || '',
        }
      : {
          expense_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          branch_id: userBranches.length === 1 ? userBranches[0].id : '',
          expense_category_id: '',
          amount: 0,
          description: '',
        },
  });

  // If editing, update form values when expense changes
  React.useEffect(() => {
    if (expense) {
      reset({
        expense_date: expense.expense_date,
        branch_id: expense.branch_id,
        expense_category_id: expense.expense_category_id || '',
        amount: expense.amount,
        description: expense.description || '',
      });
    }
  }, [expense, reset]);

  const selectedBranchId = watch('branch_id');
  const expenseDateString = watch('expense_date');
  const expenseDate = expenseDateString
    ? new Date(expenseDateString)
    : new Date();

  const handleCreateNewCategory = async () => {
    if (!newCategoryName.trim() || !user?.id || !currentOrganization?.id)
      return;

    try {
      const newCategory = await createExpenseCategory.mutateAsync({
        name: newCategoryName.trim(),
        created_by: user.id,
        organization_id: currentOrganization.id,
      });

      setValue('expense_category_id', newCategory.id);
      setNewCategoryName('');
      setShowNewCategoryForm(false);
      toast.success('Expense category created and selected');
    } catch (error) {
      toast.error(
        (error as Error).message || 'Failed to create expense category'
      );
    }
  };

  const onSubmit = async (data: ExpenseForm) => {
    if (!user?.id || !currentOrganization?.id) return;
    try {
      if (expense) {
        await updateExpense.mutateAsync({ id: expense.id, ...data });
        toast.success('Expense updated successfully');
      } else {
        // Find the selected category name for backward compatibility
        const selectedCategory = expenseCategories.find(
          (cat) => cat.id === data.expense_category_id
        );

        await createExpense.mutateAsync({
          ...data,
          amount: Number(data.amount),
          category: selectedCategory?.name || 'Other', // For backward compatibility
          created_by: user.id,
          organization_id: currentOrganization.id,
        });
        toast.success('Expense recorded successfully');
      }
      // Preserve selected branch and category after reset
      reset({
        expense_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        branch_id: data.branch_id,
        expense_category_id: data.expense_category_id,
        amount: 0,
        description: '',
      });
      onSuccess?.();
    } catch (error) {
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
                  {branch.name}
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
              setValue(
                'expense_date',
                date ? format(date, 'yyyy-MM-dd HH:mm:ss') : ''
              )
            }
            id="expense_date"
            includeTime={true}
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
          <Label htmlFor="amount">
            Amount ({currentOrganization?.currency || 'GH₵'})
          </Label>
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
          <Label htmlFor="expense_category_id">Category</Label>
          <div className="space-y-2">
            <Select
              value={watch('expense_category_id')}
              onValueChange={(value) => setValue('expense_category_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!showNewCategoryForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewCategoryForm(true)}
                className="w-full"
              >
                + Add New Category
              </Button>
            ) : (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Quick Add Category
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewCategoryForm(false);
                      setNewCategoryName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateNewCategory}
                  disabled={
                    !newCategoryName.trim() || createExpenseCategory.isPending
                  }
                  className="w-full"
                >
                  {createExpenseCategory.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            )}
          </div>
          {errors.expense_category_id && (
            <p className="text-sm text-red-600">
              {errors.expense_category_id.message}
            </p>
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

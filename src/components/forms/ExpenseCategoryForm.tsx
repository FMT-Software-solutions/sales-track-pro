import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  ExpenseCategory,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import React from 'react';

const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
});

type ExpenseCategoryFormData = z.infer<typeof expenseCategorySchema>;

interface ExpenseCategoryFormProps {
  onSuccess?: () => void;
  category?: ExpenseCategory;
}

export function ExpenseCategoryForm({ onSuccess, category }: ExpenseCategoryFormProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ExpenseCategoryFormData>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: category
      ? {
          name: category.name,
          description: category.description || '',
        }
      : {
          name: '',
          description: '',
        },
  });

  React.useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: ExpenseCategoryFormData) => {
    if (!user?.id || !currentOrganization?.id) return;
    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, ...data });
        toast.success('Expense category updated successfully');
      } else {
        await createCategory.mutateAsync({
          ...data,
          created_by: user.id,
          organization_id: currentOrganization.id,
        });
        toast.success('Expense category created successfully');
      }
      reset();
      onSuccess?.();
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Failed to save expense category');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Category Name</Label>
        <Input
          id="name"
          placeholder="Enter category name"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter category description"
          {...register('description')}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Clear
        </Button>
        <Button 
          type="submit" 
          disabled={createCategory.isPending || updateCategory.isPending}
        >
          {(createCategory.isPending || updateCategory.isPending) 
            ? 'Saving...' 
            : category ? 'Update Category' : 'Create Category'
          }
        </Button>
      </div>
    </form>
  );
}
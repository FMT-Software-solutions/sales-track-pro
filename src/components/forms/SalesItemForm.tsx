import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateProduct,
  useUpdateSalesItem,
  SalesItem,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import React from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

const salesItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
});

type SalesItemFormData = z.infer<typeof salesItemSchema>;

interface SalesItemFormProps {
  onSuccess?: () => void;
  salesItem?: SalesItem;
}

export function SalesItemForm({ onSuccess, salesItem }: SalesItemFormProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const createProduct = useCreateProduct();
  const updateSalesItem = useUpdateSalesItem();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SalesItemFormData>({
    resolver: zodResolver(salesItemSchema),
    defaultValues: salesItem
      ? {
          name: salesItem.name,
          description: salesItem.description || '',
          price: salesItem.price || 0,
        }
      : {
          name: '',
          description: '',
          price: 0,
        },
  });

  React.useEffect(() => {
    if (salesItem) {
      reset({
        name: salesItem.name,
        description: salesItem.description || '',
        price: salesItem.price || 0,
      });
    }
  }, [salesItem, reset]);

  const onSubmit = async (data: SalesItemFormData) => {
    if (!user?.id || !currentOrganization?.id) return;
    try {
      if (salesItem) {
        await updateSalesItem.mutateAsync({ id: salesItem.id, ...data });
        toast.success('Sales item updated successfully');
      } else {
        await createProduct.mutateAsync({
          ...data,
          price: Number(data.price),
          created_by: user.id,
          organization_id: currentOrganization.id,
        });
        toast.success('Sales item created successfully');
      }
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save sales item');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Item Name</Label>
        <Input id="name" placeholder="Enter item name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">
          Price ({currentOrganization?.currency || 'GH₵'})
        </Label>
        <Input
          id="price"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          {...register('price', { valueAsNumber: true })}
        />
        {errors.price && (
          <p className="text-sm text-red-600">{errors.price.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter item description"
          {...register('description')}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Clear
        </Button>
        <Button
          type="submit"
          disabled={createProduct.isPending || updateSalesItem.isPending}
        >
          {createProduct.isPending || updateSalesItem.isPending
            ? 'Saving...'
            : salesItem
            ? 'Update Item'
            : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}

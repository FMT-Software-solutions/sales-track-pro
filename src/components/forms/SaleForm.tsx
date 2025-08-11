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
  useCreateSale,
  useUpdateSale,
  useSalesItems,
  useCreateSalesItem,
  Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar22 } from '@/components/ui/calendar22';
import React from 'react';

const saleSchema = z.object({
  branch_id: z.string().min(1, 'Please select a branch'),
  sales_item_id: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().optional(),
  sale_date: z.string().min(1, 'Sale date is required'),
});

type SaleForm = z.infer<typeof saleSchema>;

interface SaleFormProps {
  onSuccess?: () => void;
  sale?: Sale;
}

export function SaleForm({ onSuccess, sale }: SaleFormProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { data: branches = [] } = useBranches(currentOrganization?.id);
  const { data: salesItems = [] } = useSalesItems(currentOrganization?.id);
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const createSalesItem = useCreateSalesItem();
  const [showNewItemForm, setShowNewItemForm] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemPrice, setNewItemPrice] = React.useState('');

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
  } = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: sale
      ? {
          sale_date: sale.sale_date,
          branch_id: sale.branch_id,
          sales_item_id: sale.sales_item_id || 'none',
          quantity: (sale as any).quantity || 1,
          amount: sale.amount,
          description: sale.customer_name || '',
        }
      : {
          sale_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          branch_id: userBranches.length === 1 ? userBranches[0].id : '',
          sales_item_id: 'none',
          quantity: 1,
        },
  });

  // If editing, update form values when sale changes
  React.useEffect(() => {
    if (sale) {
      reset({
        sale_date: sale.sale_date, // Keep the full datetime for editing
        branch_id: sale.branch_id,
        sales_item_id: sale.sales_item_id || 'none',
        quantity: (sale as any).quantity || 1,
        amount: sale.amount,
        description: sale.customer_name || '',
      });
    }
  }, [sale, reset]);

  const selectedBranchId = watch('branch_id');
  const selectedSalesItemId = watch('sales_item_id');
  const saleDateString = watch('sale_date');
  const saleDate = saleDateString
    ? new Date(saleDateString) // Use native Date constructor to handle ISO strings and formatted strings
    : new Date();

  // Auto-fill amount when sales item is selected
  React.useEffect(() => {
    if (selectedSalesItemId && selectedSalesItemId !== 'none') {
      const selectedItem = salesItems.find(
        (item) => item.id === selectedSalesItemId
      );
      if (selectedItem?.price) {
        setValue('amount', selectedItem.price);
      }
    }
  }, [selectedSalesItemId, salesItems, setValue]);

  const handleCreateNewItem = async () => {
    if (!newItemName.trim() || !user?.id || !currentOrganization?.id) return;

    try {
      const newItem = await createSalesItem.mutateAsync({
        name: newItemName.trim(),
        price: newItemPrice ? parseFloat(newItemPrice) : 0,
        created_by: user.id,
        organization_id: currentOrganization.id,
      });

      setValue('sales_item_id', newItem.id);
      if (newItem.price) {
        setValue('amount', newItem.price);
      }

      setNewItemName('');
      setNewItemPrice('');
      setShowNewItemForm(false);
      toast.success('Sales item created and selected');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create sales item');
    }
  };

  const onSubmit = async (data: SaleForm) => {
    if (!user?.id || !currentOrganization?.id) return;
    try {
      const submitData = {
        ...data,
        amount: Number(data.amount), // This is the unit amount
        customer_name: data.description || null,
        sales_item_id:
          data.sales_item_id === 'none' ? null : data.sales_item_id,
        created_by: user.id,
        organization_id: currentOrganization.id,
      };
      // Remove the description field since we're using customer_name
      delete (submitData as any).description;

      if (sale) {
        // For updates, only include sale_date if it has actually changed
        const updateData: any = {
          amount: Number(data.amount),
          customer_name: data.description || null,
          sales_item_id:
            data.sales_item_id === 'none' ? null : data.sales_item_id,
          branch_id: data.branch_id,
          quantity: data.quantity,
        };

        // Only include sale_date if it has actually changed
        if (sale.sale_date !== data.sale_date) {
          updateData.sale_date = data.sale_date;
        }

        await updateSale.mutateAsync({ id: sale.id, ...updateData });
        toast.success('Sale updated successfully');
      } else {
        await createSale.mutateAsync(submitData);
        toast.success('Sale recorded successfully');
      }
      // Preserve selected branch and sales item after reset
      reset({
        sale_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        branch_id: data.branch_id,
        sales_item_id: data.sales_item_id,
        quantity: 1,
        amount: 0,
        description: '',
      });
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save sale');
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
            label="Sale Date"
            value={saleDate}
            onChange={(date) =>
              setValue(
                'sale_date',
                date ? format(date, 'yyyy-MM-dd HH:mm:ss') : ''
              )
            }
            id="sale_date"
            includeTime={true}
          />
          {errors.sale_date && (
            <p className="text-sm text-red-600">{errors.sale_date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sales_item_id">Sales Item (Optional)</Label>
        <div className="space-y-2">
          <Select
            value={selectedSalesItemId}
            onValueChange={(value) => setValue('sales_item_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a sales item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific item</SelectItem>
              {salesItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} - {currentOrganization?.currency || 'GH₵'} {item.price?.toFixed(2) || '0.00'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!showNewItemForm ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewItemForm(true)}
              className="w-full"
            >
              + Add New Item
            </Button>
          ) : (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quick Add Item</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewItemForm(false);
                    setNewItemName('');
                    setNewItemPrice('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewItem}
                disabled={!newItemName.trim() || createSalesItem.isPending}
                className="w-full"
              >
                {createSalesItem.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            step="1"
            placeholder="1"
            {...register('quantity', { valueAsNumber: true })}
          />
          {errors.quantity && (
            <p className="text-sm text-red-600">{errors.quantity.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Unit Amount ({currentOrganization?.currency || 'GH₵'})</Label>
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
      </div>

      {/* Total Amount Display */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">
            Total Amount:
          </span>
          <span className="text-lg font-bold text-green-600">
            {currentOrganization?.currency || 'GH₵'} {((watch('quantity') || 0) * (watch('amount') || 0)).toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {watch('quantity') || 0} × {currentOrganization?.currency || 'GH₵'} {(watch('amount') || 0).toFixed(2)}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Customer Name (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter customer name"
          {...register('description')}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Clear
        </Button>
        <Button type="submit" disabled={createSale.isPending}>
          {createSale.isPending
            ? sale?.id
              ? 'Updating...'
              : 'Recording...'
            : sale?.id
            ? 'Update Sale'
            : 'Record Sale'}
        </Button>
      </div>
    </form>
  );
}

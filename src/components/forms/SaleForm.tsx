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
  Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { Calendar22 } from '@/components/ui/calendar22';
import React from 'react';

const saleSchema = z.object({
  branch_id: z.string().min(1, 'Please select a branch'),
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
  const { data: branches = [] } = useBranches();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();

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
          amount: sale.amount,
          description: sale.description || '',
        }
      : {
          sale_date: format(new Date(), 'yyyy-MM-dd'),
          branch_id: userBranches.length === 1 ? userBranches[0].id : '',
        },
  });

  // If editing, update form values when sale changes
  React.useEffect(() => {
    if (sale) {
      reset({
        sale_date: sale.sale_date,
        branch_id: sale.branch_id,
        amount: sale.amount,
        description: sale.description || '',
      });
    }
  }, [sale, reset]);

  const selectedBranchId = watch('branch_id');
  const saleDateString = watch('sale_date');
  const saleDate = saleDateString
    ? parse(saleDateString, 'yyyy-MM-dd', new Date())
    : new Date();

  const onSubmit = async (data: SaleForm) => {
    if (!user?.id) return;
    try {
      if (sale) {
        await updateSale.mutateAsync({ id: sale.id, ...data });
        toast.success('Sale updated successfully');
      } else {
        await createSale.mutateAsync({
          ...data,
          amount: Number(data.amount),
          created_by: user.id,
        });
        toast.success('Sale recorded successfully');
      }
      // Preserve selected branch after reset
      reset({
        sale_date: format(data.sale_date, 'yyyy-MM-dd'),
        branch_id: data.branch_id,
        amount: 0,
        description: '',
      });
      onSuccess?.();
    } catch (error: unknown) {
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
              setValue('sale_date', date ? format(date, 'yyyy-MM-dd') : '')
            }
            id="sale_date"
          />
          {errors.sale_date && (
            <p className="text-sm text-red-600">{errors.sale_date.message}</p>
          )}
        </div>
      </div>

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
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter sale description or notes"
          {...register('description')}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Clear
        </Button>
        <Button type="submit" disabled={createSale.isPending}>
          {createSale.isPending ? 'Recording...' : 'Record Sale'}
        </Button>
      </div>
    </form>
  );
}

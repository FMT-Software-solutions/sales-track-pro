import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateBranch, useUpdateBranch } from '@/hooks/queries';
import { toast } from 'sonner';
import type { Database } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  location: z.string().min(1, 'Location is required'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

type BranchForm = z.infer<typeof branchSchema>;
type Branch = Database['public']['Tables']['branches']['Row'];

interface BranchFormProps {
  branch?: Branch;
  onSuccess?: () => void;
}

export function BranchForm({ branch, onSuccess }: BranchFormProps) {
  const { currentOrganization } = useOrganization();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name || '',
      location: branch?.location || '',
      description: branch?.description || '',
      is_active: branch?.is_active ?? true,
    },
  });

  const isActive = watch('is_active');

  const onSubmit = async (data: BranchForm) => {
    if (!currentOrganization?.id) return;
    try {
      if (branch) {
        await updateBranch.mutateAsync({ id: branch.id, ...data });
        toast.success('Branch updated successfully');
      } else {
        await createBranch.mutateAsync({ ...data, organization_id: currentOrganization.id });
        toast.success('Branch created successfully');
      }
      onSuccess?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || 'Failed to save branch');
    }
  };

  const isLoading = createBranch.isPending || updateBranch.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Branch Name</Label>
          <Input
            id="name"
            placeholder="Enter branch name"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Enter branch location"
            {...register('location')}
          />
          {errors.location && (
            <p className="text-sm text-red-600">{errors.location.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Enter branch description"
          {...register('description')}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setValue('is_active', checked)}
        />
        <Label htmlFor="is_active">Active Branch</Label>
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : branch ? 'Update Branch' : 'Create Branch'}
        </Button>
      </div>
    </form>
  );
}

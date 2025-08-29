import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useVoidSale,
  useSaleLineItems,
  type Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

const voidSchema = z.object({
  reason: z.string().min(1, 'Please provide a reason for voiding this sale'),
});

type VoidFormData = z.infer<typeof voidSchema>;

interface SaleVoidProps {
  sale: Sale;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SaleVoid({ sale, onSuccess, onCancel }: SaleVoidProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { data: saleItems = [] } = useSaleLineItems(sale.id);
  const voidSale = useVoidSale();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VoidFormData>({
    resolver: zodResolver(voidSchema),
    defaultValues: {
      reason: '',
    },
  });

  const calculateTotal = () => {
    return saleItems.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const getProductName = (productId: string) => {
    // This would ideally come from a products query, but for now we'll use the product_id
    // In a real implementation, you'd want to fetch product details
    return `Product ${productId}`;
  };

  const onSubmit = async () => {
    if (!user?.id) return;

    try {
      await voidSale.mutateAsync(sale.id);

      toast.success('Sale voided successfully');
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to remove sale');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sale Information */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <XCircle className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-red-700">Void Sale</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="font-medium">Sale Date:</span> {format(new Date(sale.sale_date), 'PPP p')}
          </div>
          <div>
            <span className="font-medium">Customer:</span> {sale.customer_name || 'Walk-in'}
          </div>
          <div>
            <span className="font-medium">Branch:</span> {sale.branches?.name || 'Unknown'}
          </div>
          <div>
            <span className="font-medium">Total Amount:</span> {currentOrganization?.currency || 'GH₵'} {calculateTotal().toFixed(2)}
          </div>
        </div>
        
        {/* Sale Items */}
        <div>
          <h4 className="font-medium mb-2">Items to be voided:</h4>
          <div className="space-y-1">
            {saleItems.length > 0 ? (
              saleItems.map((item, index) => (
                <div key={index} className="text-sm flex justify-between bg-white p-2 rounded border">
                  <span>{getProductName(item.product_id)} x {item.quantity}</span>
                  <span>{currentOrganization?.currency || 'GH₵'} {(item.quantity * item.unit_price).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Legacy sale - Amount: {currentOrganization?.currency || 'GH₵'} {sale.amount?.toFixed(2) || '0.00'}
              </div>
            )}
          </div>
        </div>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Warning:</strong> Voiding this sale will permanently mark it as invalid. This action cannot be undone. 
          The sale will be excluded from all reports and calculations.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Void Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Voiding *</Label>
          <Textarea
            id="reason"
            {...register('reason')}
            placeholder="Please explain why this sale needs to be voided (e.g., customer returned items, payment failed, data entry error)..."
            className="min-h-[100px]"
          />
          {errors.reason && (
            <p className="text-sm text-red-500">{errors.reason.message}</p>
          )}
        </div>

        {/* Confirmation Message */}
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Please confirm:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You have verified that this sale should be voided</li>
                <li>You understand this action cannot be undone</li>
                <li>The sale will be excluded from all future reports</li>
                <li>Any related inventory adjustments may need to be handled separately</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={voidSale.isPending}
          >
            {voidSale.isPending ? 'Voiding Sale...' : 'Void Sale'}
          </Button>
        </div>
      </form>
    </div>
  );
}
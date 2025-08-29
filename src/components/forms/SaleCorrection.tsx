import  { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Trash2, X, AlertTriangle } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useProducts,
  useCorrectSale,
  useSaleLineItems,
  type Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

const correctionLineItemSchema = z.object({
  productId: z.string().min(1, 'Please select a product'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be positive'),
});

const correctionSchema = z.object({
  reason: z.string().min(1, 'Please provide a reason for the correction'),
  items: z.array(correctionLineItemSchema).min(1, 'At least one item is required'),
});

type CorrectionFormData = z.infer<typeof correctionSchema>;

interface SaleCorrectionProps {
  sale: Sale;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SaleCorrection({ sale, onSuccess, onCancel }: SaleCorrectionProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { data: products = [] } = useProducts(currentOrganization?.id);
  const { data: originalSaleItems = [] } = useSaleLineItems(sale.id);
  const correctSale = useCorrectSale();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    control,
  } = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      reason: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Auto-fill price when product is selected
  const handleProductChange = (index: number, productId: string) => {
    const selectedProduct = products.find((product) => product.id === productId);
    if (selectedProduct?.price) {
      setValue(`items.${index}.unitPrice`, selectedProduct.price);
    }
  };

  // Handle product change for new item form
  const handleNewItemProductChange = (productId: string) => {
    const selectedProduct = products.find((product) => product.id === productId);
    setNewItem({
      ...newItem,
      productId,
      unitPrice: selectedProduct?.price || 0
    });
  };

  const addItem = () => {
    if (newItem.productId) {
      append({ 
        productId: newItem.productId, 
        quantity: newItem.quantity, 
        unitPrice: newItem.unitPrice 
      });
      setNewItem({ productId: '', quantity: 1, unitPrice: 0 });
      setShowAddForm(false);
    }
  };

  const removeItem = (index: number) => {
    remove(index);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  const calculateTotal = () => {
    const items = watch('items');
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  };

  const calculateOriginalTotal = () => {
    return originalSaleItems.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const onSubmit = async () => {
    if (!user?.id || !currentOrganization?.id) return;

    try {
      const totalAmount = calculateTotal();

      await correctSale.mutateAsync({
        id: sale.id,
        amount: totalAmount,
      });

      toast.success('Sale correction recorded successfully');
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to record correction');
    }
  };

  return (
    <div className="space-y-6">
      {/* Original Sale Information */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Original Sale Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Date:</span> {format(new Date(sale.sale_date), 'PPP p')}
          </div>
          <div>
            <span className="font-medium">Customer:</span> {sale.customer_name || 'Walk-in'}
          </div>
          <div>
            <span className="font-medium">Total:</span> {currentOrganization?.currency || 'GH₵'} {calculateOriginalTotal().toFixed(2)}
          </div>
        </div>
        
        {/* Original Items */}
        <div className="mt-4">
          <h4 className="font-medium mb-2">Original Items:</h4>
          <div className="space-y-1">
            {originalSaleItems.map((item, index) => (
              <div key={index} className="text-sm flex justify-between">
                <span>{getProductName(item.product_id)} x {item.quantity}</span>
                <span>{currentOrganization?.currency || 'GH₵'} {(item.quantity * item.unit_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          This will create a correction entry. The original sale will be marked as corrected and a new sale record will be created with the corrected information.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Correction Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Correction *</Label>
          <Textarea
            id="reason"
            {...register('reason')}
            placeholder="Please explain why this sale needs to be corrected..."
            className="min-h-[80px]"
          />
          {errors.reason && (
            <p className="text-sm text-red-500">{errors.reason.message}</p>
          )}
        </div>

        {/* Corrected Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">Corrected Sale Items</Label>
            <Button 
              type="button" 
              onClick={() => setShowAddForm(true)} 
              size="sm" 
              variant="outline"
              disabled={showAddForm}
              className='border-green-600 text-green-600 hover:border-green-700 hover:text-green-700 hover:bg-white'
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Add New Item</h4>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem({ productId: '', quantity: 1, unitPrice: 0 });
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Product *</Label>
                  <Select
                    value={newItem.productId}
                    onValueChange={handleNewItemProductChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {currentOrganization?.currency || 'GH₵'} {product.price?.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({
                      ...newItem,
                      quantity: parseInt(e.target.value) || 1
                    })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({
                      ...newItem,
                      unitPrice: parseFloat(e.target.value) || 0
                    })}
                    className="bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={addItem}
                    disabled={!newItem.productId}
                    className="w-full"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
          {fields.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Select
                        value={watch(`items.${index}.productId`)}
                        onValueChange={(value) => {
                          setValue(`items.${index}.productId`, value);
                          handleProductChange(index, value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      {currentOrganization?.currency || 'GH₵'} {(watch(`items.${index}.quantity`) * watch(`items.${index}.unitPrice`)).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {errors.items && (
            <p className="text-sm text-red-500">{errors.items.message}</p>
          )}
        </div>

        {/* Total */}
        {fields.length > 0 && (
          <div className="flex justify-end">
            <div className="text-lg font-semibold">
              New Total: {currentOrganization?.currency || 'GH₵'} {calculateTotal().toFixed(2)}
            </div>
          </div>
        )}

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
            disabled={correctSale.isPending || fields.length === 0}
          >
            {correctSale.isPending ? 'Recording Correction...' : 'Record Correction'}
          </Button>
        </div>
      </form>
    </div>
  );
}
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar22 } from '@/components/ui/calendar22';
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
import {
  useProducts,
  useBranches,
  useCreateSale,
  useCorrectSale,
  useSaleLineItems,
  useCreateSaleLineItem,
  useUpdateSaleLineItem,
  useDeleteSaleLineItem,
  useLogSaleActivity,
  type Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { UserInfo } from '@/components/ui/user-info';
import { toast } from 'sonner';
import React from 'react';
import { Link } from 'react-router-dom';
import { createSaleLineItemSnapshot, createSaleSnapshot, detectSaleChanges, hasAnyChanges, generateSaleActivityTitle } from '@/utils/activityFormatters';

const saleLineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'Please select a product'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be positive'),
});

const saleSchema = z.object({
  branchId: z.string().min(1, 'Please select a branch'),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  saleDate: z.string().min(1, 'Please select a date'),
  items: z.array(saleLineItemSchema).min(1, 'At least one item is required'),
});

type SaleFormData = z.infer<typeof saleSchema>;

interface MultipleSaleFormProps {
  sale?: Sale;
  onSuccess?: () => void;
}

export function MultipleSaleForm({ sale, onSuccess }: MultipleSaleFormProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { canViewAllData } = useRoleCheck();
  const { data: branches = [], isLoading } = useBranches(currentOrganization?.id);
  const { data: products = [] } = useProducts(currentOrganization?.id);
  const { data: existingSaleLineItems = [] } = useSaleLineItems(sale?.id || '');
  
  const createSale = useCreateSale();

  const correctSale = useCorrectSale();
  const createSaleLineItem = useCreateSaleLineItem();
  const updateSaleLineItem = useUpdateSaleLineItem();
  const deleteSaleLineItem = useDeleteSaleLineItem();
  const logSaleActivity = useLogSaleActivity();

  // State for managing inline editing and add form
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newItem, setNewItem] = React.useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });

  const userBranches = canViewAllData()
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
    control,
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      saleDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      branchId: userBranches.length === 1 ? userBranches[0].id : '',
      customerName: '',
      notes: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Load existing sale data when editing
  React.useEffect(() => {
    if (sale) {
      // Set basic sale information
      const basicData = {
        saleDate: sale.sale_date,
        branchId: sale.branch_id,
        customerName: sale.customer_name || '',
        notes: sale.notes || '',
      };

      if (existingSaleLineItems.length > 0) {
        // If we have line items, use them
        const formItems = existingSaleLineItems.map((item) => ({
          id: item.id,
          productId: item.product_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        }));

        reset({
          ...basicData,
          items: formItems,
        });
      } else {
        // For old format sales without line items, create a default item
        reset({
          ...basicData,
          items: [{ productId: '', quantity: 1, unitPrice: sale.amount || 0 }],
        });
      }
    }
  }, [sale, existingSaleLineItems, reset]);

  const saleDateString = watch('saleDate');
  const saleDate = saleDateString ? new Date(saleDateString) : new Date();

  // Auto-fill price when product is selected
  const handleProductChange = (index: number, productId: string) => {
    const selectedProduct = products.find((product) => product.id === productId);
    if (selectedProduct?.price) {
      setValue(`items.${index}.unitPrice`, selectedProduct.price);
    }
  };

  const addItem = () => {
    if (newItem.productId) {
      const currentItems = watch('items');
      const existingItemIndex = currentItems.findIndex(item => item.productId === newItem.productId);
      
      if (existingItemIndex !== -1) {
        // Product already exists, increase quantity
        const existingItem = currentItems[existingItemIndex];
        setValue(`items.${existingItemIndex}.quantity`, existingItem.quantity + newItem.quantity);
        toast.success(`Increased quantity for ${getProductName(newItem.productId)} by ${newItem.quantity}`);
      } else {
        // Product doesn't exist, add new item
        append({ 
          productId: newItem.productId, 
          quantity: newItem.quantity, 
          unitPrice: newItem.unitPrice 
        });
      }
      
      setNewItem({ productId: '', quantity: 1, unitPrice: 0 });
      setShowAddForm(false);
    }
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      setEditingIndex(null);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
  };

  const saveEditing = () => {
    setEditingIndex(null);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
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

  const calculateTotal = () => {
    const items = watch('items');
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  };

  const onSubmit = async (data: SaleFormData) => {
    if (!user?.id || !currentOrganization?.id) return;

    try {
      const totalAmount = calculateTotal();

      if (sale) {
        // Create snapshots before making changes
        const originalSaleSnapshot = createSaleSnapshot({
          ...sale,
          sale_line_items: existingSaleLineItems
        });
        
        const originalLineItemsSnapshot = createSaleLineItemSnapshot(existingSaleLineItems);

        // Create preliminary new sale snapshot to detect changes
        const preliminaryNewSaleSnapshot = createSaleSnapshot({
          ...sale,
          amount: totalAmount,
          customer_name: data.customerName,
          notes: data.notes,
          sale_date: data.saleDate,
          branch_id: data.branchId,
          branch_name: userBranches.find(b => b.id === data.branchId)?.name,
          sale_line_items: data.items.map(item => ({
            product_id: item.productId,
            product_name: products.find(p => p.id === item.productId)?.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice
          }))
        });

        // Smart update: compare existing items with new items
        const existingItemsMap = new Map(existingSaleLineItems.map(item => [item.product_id, item]));
        const newItemsMap = new Map(data.items.map(item => [item.productId, item]));

        // Track changes for detailed logging
        const itemChanges = {
          updated: [] as any[],
          created: [] as any[],
          deleted: [] as any[]
        };

        // Detect item changes without making database updates yet
        for (const item of data.items) {
          const existingItem = existingItemsMap.get(item.productId);
          
          if (existingItem) {
            // Check if item values changed
            if (existingItem.quantity !== item.quantity || existingItem.unit_price !== item.unitPrice) {
              const oldSnapshot = {
                id: existingItem.id,
                product_id: existingItem.product_id,
                product_name: existingItem.products?.name,
                quantity: existingItem.quantity,
                unit_price: existingItem.unit_price,
                total_price: existingItem.total_price
              };
              
              const newSnapshot = {
                id: existingItem.id,
                product_id: item.productId,
                product_name: products.find(p => p.id === item.productId)?.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.quantity * item.unitPrice
              };
              
              itemChanges.updated.push({ old: oldSnapshot, new: newSnapshot });
            }
          } else {
            // New item to be created
            itemChanges.created.push({
              product_id: item.productId,
              product_name: products.find(p => p.id === item.productId)?.name,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price: item.quantity * item.unitPrice
            });
          }
        }

        // Check for items to be deleted
        for (const existingItem of existingSaleLineItems) {
          if (!newItemsMap.has(existingItem.product_id)) {
            const deletedSnapshot = {
              id: existingItem.id,
              product_id: existingItem.product_id,
              product_name: existingItem.products?.name,
              quantity: existingItem.quantity,
              unit_price: existingItem.unit_price,
              total_price: existingItem.total_price
            };
            
            itemChanges.deleted.push(deletedSnapshot);
          }
        }

        // Detect what changes were made
        const changes = detectSaleChanges(originalSaleSnapshot, preliminaryNewSaleSnapshot, itemChanges);
        
        // Only proceed with updates if there were actual changes
        if (!hasAnyChanges(changes)) {
          toast.info('No changes detected - sale not updated');
          return;
        }

        // Update sale
        const updatedSale = await correctSale.mutateAsync({
          id: sale.id,
          amount: totalAmount,
          customer_name: data.customerName || null,
          notes: data.notes || null,
          sale_date: data.saleDate,
          branch_id: data.branchId,
        });

        // Update or create items (only for items that actually changed)
        for (const item of data.items) {
          const existingItem = existingItemsMap.get(item.productId);
          
          if (existingItem) {
            // Update existing item if values changed
            if (existingItem.quantity !== item.quantity || existingItem.unit_price !== item.unitPrice) {
              await updateSaleLineItem.mutateAsync({
                id: existingItem.id,
                quantity: item.quantity,
                unit_price: item.unitPrice,
              });
            }
          } else {
            // Create new item
            const newLineItem = await createSaleLineItem.mutateAsync({
              sale_id: updatedSale.id,
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.unitPrice,
            });
            
            // Update the created item in itemChanges with the actual ID
            const createdItemIndex = itemChanges.created.findIndex(created => 
              created.product_id === item.productId
            );
            if (createdItemIndex !== -1) {
              itemChanges.created[createdItemIndex].id = newLineItem.id;
            }
          }
        }

        // Delete items that are no longer in the form
        for (const existingItem of existingSaleLineItems) {
          if (!newItemsMap.has(existingItem.product_id)) {
            await deleteSaleLineItem.mutateAsync(existingItem.id);
          }
        }

        // Create new sale snapshot after changes
        const newSaleSnapshot = createSaleSnapshot({
          ...updatedSale,
          amount: totalAmount,
          customer_name: data.customerName,
          notes: data.notes,
          sale_date: data.saleDate,
          branch_id: data.branchId,
          branch_name: userBranches.find(b => b.id === data.branchId)?.name,
          sale_line_items: data.items.map(item => ({
            product_id: item.productId,
            product_name: products.find(p => p.id === item.productId)?.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice
          }))
        });

        // Generate dynamic title based on what changed
        const activityTitle = generateSaleActivityTitle(
          changes, 
          originalSaleSnapshot, 
          newSaleSnapshot, 
          currentOrganization?.currency || 'GH₵'
        );

        // Log the correction activity with detailed snapshots
        await logSaleActivity.mutateAsync({
          saleId: updatedSale.id,
          organizationId: currentOrganization.id,
          activityType: 'update',
          description: activityTitle,
          oldValues: originalSaleSnapshot,
          newValues: newSaleSnapshot,
          metadata: {
            original_sale_id: sale.id,
            correction_reason: 'Manual correction',
            item_changes: itemChanges,
            total_items_before: originalLineItemsSnapshot.length,
            total_items_after: data.items.length,
            changes_detected: changes
          }
        });
        
        toast.success('Sale updated successfully');
      } else {
        // Create new sale
        const newSale = await createSale.mutateAsync({
          branch_id: data.branchId,
          customer_name: data.customerName || null,
          notes: data.notes || null,
          sale_date: data.saleDate,
          amount: totalAmount, // Keep for backward compatibility
          created_by: user.id,
          organization_id: currentOrganization.id,
        });

        // Create sale line items
        for (const item of data.items) {
          await createSaleLineItem.mutateAsync({
            sale_id: newSale.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          });
        }

        // Log the creation activity
        await logSaleActivity.mutateAsync({
          saleId: newSale.id,
          organizationId: currentOrganization.id,
          activityType: 'create',
          description: `New sale created. Total amount: ${currentOrganization?.currency || 'GH₵'}${totalAmount.toFixed(2)}${data.customerName ? ` for customer: ${data.customerName}` : ''}`,
          newValues: {
            amount: totalAmount,
            customer_name: data.customerName,
            sale_date: data.saleDate,
            branch_id: data.branchId,
            items: data.items.map(item => ({
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price:   item.unitPrice * item.quantity,
              product_name: products.find(p => p.id === item.productId)?.name,
            }))
          },
          metadata: {
            branch_name: userBranches.find(b => b.id === data.branchId)?.name,
            total_items: data.items.length,
            items: data.items.map(item => ({
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price:   item.unitPrice * item.quantity,
              product_name: products.find(p => p.id === item.productId)?.name,
            }))
          }
        });

        toast.success('Sale recorded successfully');
      }

      // Reset form
      reset({
        saleDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        branchId: data.branchId,
        customerName: '',
        notes: '',
        items: [],
      });

      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save sale');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-baseline">
        <div className="space-y-2">
          <Label htmlFor="branchId">Branch *</Label>
          <div className='flex gap-1'>
            <Select
              value={watch('branchId')}
              onValueChange={(value) => setValue('branchId', value)}
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
            {userBranches.length === 0 &&  !isLoading && (
              <Link to="/branches">
                <Button variant="outline" className="border-green-600 text-green-600 hover:border-green-700 hover:text-green-700 hover:bg-white">
                  <Plus className='w-4 h-4 mr-1'/> Add Branch
                </Button>
              </Link>
             )}
          </div>
          {errors.branchId && (
            <p className="text-sm text-red-500">{errors.branchId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Calendar22
            value={saleDate}
            onChange={(date) => {
              if (date) {
                setValue('saleDate', format(date, 'yyyy-MM-dd HH:mm:ss'));
              }
            }}
            includeTime={true}
          />
          {errors.saleDate && (
            <p className="text-sm text-red-500">{errors.saleDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">Sale Items</Label>
        </div>

       

        {/* Items Table */}
        {fields.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Subtotal</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      {editingIndex === index ? (
                        <Select
                          value={watch(`items.${index}.productId`)}
                          onValueChange={(value) => {
                            setValue(`items.${index}.productId`, value);
                            handleProductChange(index, value);
                          }}
                        >
                          <SelectTrigger className="h-8">
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
                      ) : (
                        <span className="text-sm">{getProductName(watch(`items.${index}.productId`))}</span>
                      )}
                      {errors.items?.[index]?.productId && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.productId?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          type="number"
                          min="1"
                          className="h-8 bg-white"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          
                        />
                      ) : (
                        <span className="text-sm">{watch(`items.${index}.quantity`)}</span>
                      )}
                      {errors.items?.[index]?.quantity && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 bg-white"
                          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        />
                      ) : (
                        <span className="text-sm">
                          {currentOrganization?.currency || 'GH₵'} {watch(`items.${index}.unitPrice`)?.toFixed(2)}
                        </span>
                      )}
                      {errors.items?.[index]?.unitPrice && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.items[index]?.unitPrice?.message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {currentOrganization?.currency || 'GH₵'} {(
                          (watch(`items.${index}.quantity`) || 0) * 
                          (watch(`items.${index}.unitPrice`) || 0)
                        ).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingIndex === index ? (
                          <>
                            <Button
                              type="button"
                              onClick={saveEditing}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              onClick={cancelEditing}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              onClick={() => startEditing(index)}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeItem(index)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : "" } 

         {/* Add Item Form */}
         {showAddForm && (
          <div className="border rounded-lg p-4 bg-muted/50">
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
              <div className="flex items-end gap-1">
                <Button 
                  type="button"
                   variant="outline" 
                  onClick={addItem} 
                  size="sm"
                  disabled={!newItem.productId}
                   className='bg-green-600 text-white hover:bg-green-700 hover:text-white'
                >
                  Add Item
                </Button>
                <Button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItem({ productId: '', quantity: 1, unitPrice: 0 });
                }}
                size="sm"
                variant="ghost"
                className='bg-gray-100'
              >
                Cancel
              </Button>
              </div>
            </div>
          </div>
        )}
          
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            disabled={showAddForm}
            className="w-full bg-white hover:bg-green-50 text-sm text-green-700 border border-dashed py-5 text-center border-green-600 hover:border-green-700 hover:text-green-700"
          >
            <Plus className='w-4 h-4 mr-2'/> Add item
        </Button>

        {errors.items && (
          <p className="text-sm text-red-500">{errors.items.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name</Label>
          <Input
            {...register('customerName')}
            placeholder="Enter customer name..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            {...register('notes')}
            placeholder="Enter additional notes..."
            rows={3}
          />
        </div>
      </div>

      {/* User Information - Only visible when editing */}
      {sale && (
        <div className="space-y-2">
          <UserInfo
            userId={sale.created_by}
            userProfile={sale.created_by_profile}
            label="Recorded by"
          />
          {sale.last_updated_by && (
            <UserInfo
              userId={sale.last_updated_by}
              userProfile={sale.last_updated_by_profile}
              label="Last updated by"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-lg font-semibold">
          Total: {currentOrganization?.currency || 'GH₵'} {calculateTotal().toFixed(2)}
        </div>
        <Button
          type="submit"
          disabled={createSale.isPending || correctSale.isPending}
        >
          {createSale.isPending || correctSale.isPending
            ? 'Saving...'
            : sale
            ? 'Update Sale'
            : 'Record Sale'}
        </Button>
      </div>
    </form>
  );
}
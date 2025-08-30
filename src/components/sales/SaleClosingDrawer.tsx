import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DatePresets, DateRange } from '@/components/ui/DatePresets';
import { SalesItemsDisplay } from '@/components/ui/SalesItemsDisplay';
import {
  useSales,
  useBranches,
  useCloseSalesPeriod,
  Sale,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { Lock, AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SaleClosingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CLOSING_REASONS = [
  'Day-end closing',
  'Week-end closing',
  'Month-end closing',
  'Quarter-end closing',
  'Year-end closing',
  'Audit preparation',
  'Financial reporting',
  'Tax preparation',
  'Management review',
  'Compliance requirement',
  'System maintenance',
  'Other',
  'Custom',
];

export function SaleClosingDrawer({
  open,
  onOpenChange,
}: SaleClosingDrawerProps) {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { canViewAllData } = useRoleCheck();

  // Get branches for dropdown
  const { data: branches = [] } = useBranches(currentOrganization?.id, user);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [closingReason, setClosingReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Get sales data for the selected date range and branch
  const effectiveBranchId = canViewAllData()
    ? selectedBranch === 'all'
      ? undefined
      : selectedBranch
    : user?.profile?.branch_id || undefined;

  const { data: sales = [] } = useSales(
    effectiveBranchId,
    dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateRange?.to ? dateRange.to.toISOString() : undefined,
    currentOrganization?.id,
    true // Include inactive sales
  );

  // Filter sales based on user permissions
  const filteredSales = sales.filter((sale: Sale) => {
    // Only show active sales that can be closed
    if (sale.is_active === false || sale.closed) return false;

    const userRole = user?.profile?.role;

    // Auditors cannot close any sales
    if (userRole === 'auditor') return false;

    // Owners and admins can close all sales
    if (userRole === 'owner' || userRole === 'admin') return true;

    // Branch managers can close all sales in their assigned branches
    if (userRole === 'branch_manager') {
      return sale.branch_id === user?.profile?.branch_id;
    }

    // Salespersons can only close their own sales in their assigned branch
    if (userRole === 'sales_person') {
      return (
        sale.created_by === user?.id &&
        sale.branch_id === user?.profile?.branch_id
      );
    }

    return false;
  });

  const closeSalesPeriod = useCloseSalesPeriod();

  const handleCloseSales = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Please select a date range');
      return;
    }

    if (!closingReason) {
      toast.error('Please select a reason for closing');
      return;
    }

    if (closingReason === 'Custom' && !customReason.trim()) {
      toast.error('Please provide a custom reason');
      return;
    }

    if (filteredSales.length === 0) {
      toast.error('No sales found in the selected date range');
      return;
    }

    if (!currentOrganization?.id) {
      toast.error('Organization ID is required');
      return;
    }

    setIsClosing(true);
    try {
      const finalReason =
        closingReason === 'Custom' ? customReason : closingReason;

      // Extract sale IDs from filtered sales
      const saleIds = filteredSales.map((sale) => sale.id);

      // Call the close sales period function with sale IDs
      const result = await closeSalesPeriod.mutateAsync({
        saleIds,
        organizationId: currentOrganization.id,
        closingReason: finalReason,
        userId: user?.id,
      });

      // Log the closing action for audit purposes
      console.log('Sales period closed:', {
        dateRange,
        reason: finalReason,
        salesCount: filteredSales.length,
        saleIds,
        result,
        userId: user?.id,
        organizationId: currentOrganization?.id,
        branchId: effectiveBranchId,
      });

      const affectedCount =
        result?.[0]?.affected_count ||
        result?.affected_count ||
        filteredSales.length;
      toast.success(
        `Successfully closed ${affectedCount} sales for the selected period`
      );

      // Reset form
      setDateRange(undefined);
      setClosingReason('');
      setCustomReason('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to close sales:', error);
      toast.error('Failed to close sales. Please try again.');
    } finally {
      setIsClosing(false);
    }
  };

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      setDateRange(undefined);
      setClosingReason('');
      setCustomReason('');
    }
  }, [open]);

  // Check if user has permission to close sales
  const canCloseSales = () => {
    const userRole = user?.profile?.role;
    return (
      userRole &&
      ['owner', 'admin', 'branch_manager', 'sales_person'].includes(userRole)
    );
  };

  if (!canCloseSales()) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Lock className="mr-2 h-5 w-5" />
                Close Sales
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 px-4 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You don't have permission to close sales.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Lock className="mr-2 h-5 w-5" />
              Close Sales
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DrawerTitle>
          <DrawerDescription>
            Close sales for a specific date range to prevent further
            modifications.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 px-4 space-y-6 overflow-y-auto">
          {/* Date Range Selection */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <DatePresets
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select date range to close"
            />
            {dateRange && (
              <p className="text-xs text-muted-foreground">
                {format(dateRange.from, 'MMM dd, yyyy')} -{' '}
                {format(dateRange.to, 'MMM dd, yyyy')}
              </p>
            )}
          </div>

          {/* Branch Selection (for owners/admins) */}
          {canViewAllData() && (
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent
                  position="item-aligned"
                  className="max-h-[200px] overflow-y-auto"
                >
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches
                    .filter((branch) => branch.is_active)
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label>Reason for Closing</Label>
            <Select value={closingReason} onValueChange={setClosingReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent
                position="item-aligned"
                className="max-h-[200px] overflow-y-auto"
              >
                {CLOSING_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {closingReason === 'Custom' && (
              <Input
                placeholder="Enter custom reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800 mb-1">
                  Important Warning
                </h3>
                <p className="text-sm text-yellow-700">
                  Closing sales will prevent any modifications to the selected
                  sales data. This action cannot be undone. Please ensure all
                  corrections and adjustments are completed before proceeding.
                </p>
              </div>
            </div>
          </div>

          {/* Sales Preview */}
          {dateRange && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Sales to be Closed ({filteredSales.length})
                </h3>
                <Badge variant="outline">
                  Total: {currentOrganization?.currency || 'GH₵'}
                  {filteredSales
                    .reduce((sum, sale) => sum + (sale.amount || 0), 0)
                    .toFixed(2)}
                </Badge>
              </div>

              {filteredSales.length > 0 ? (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((sale: Sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="text-xs">
                            {format(new Date(sale.sale_date), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {sale.branches?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-32">
                            <SalesItemsDisplay
                              items={
                                sale.sale_line_items || sale.sale_items || []
                              }
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {sale.customer_name || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {currentOrganization?.currency || 'GH₵'}
                            {sale.amount?.toFixed(2) || '0.00'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sales found in the selected date range.
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <DrawerFooter>
          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isClosing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseSales}
              disabled={
                isClosing ||
                !dateRange ||
                !closingReason ||
                (closingReason === 'Custom' && !customReason.trim()) ||
                filteredSales.length === 0
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {isClosing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Closing Sales...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Close {filteredSales.length} Sales
                </>
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

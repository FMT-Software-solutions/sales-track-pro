import { useState, useEffect } from 'react';
import {
  useSales,
  useBranches,
  useVoidSale,
  useSaleActivityLogs,
  useLogSaleActivity,
  Sale,
} from '@/hooks/queries';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { MultipleSaleForm } from '@/components/forms/MultipleSaleForm';
import { SalesItemsManager } from '@/components/sales/SalesItemsManager';
import { ReceiptGenerator } from '@/components/sales/ReceiptGenerator';
import { SalesItemsDisplay } from '@/components/ui/SalesItemsDisplay';
import { SaleClosingDrawer } from '@/components/sales/SaleClosingDrawer';
import { DatePresets, DateRange } from '@/components/ui/DatePresets';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardPenLine, History, Search, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatActivityValues } from '@/utils/activityFormatters';
import { cn } from '@/lib/utils';

export default function Sales() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
  } = useDebouncedSearch('', 500);

  const { data: branches = [] } = useBranches(currentOrganization?.id, user);
  const {
    canCorrectSales,
    canEditSales,
    canVoidSales,
    canViewAllData,
    canCreateSales,
  } = useRoleCheck();

  // Initialize branch when user and branches data are available
  useEffect(() => {
    if (user?.profile && branches.length > 0) {
      if (!canViewAllData() && user.profile.branch_id) {
        // Users who cannot view all data: set to their assigned branch (should be the only one returned)
        setSelectedBranch(user.profile.branch_id);
      } else if (canViewAllData() && selectedBranch === '') {
        // Users who can view all data: set to 'all' if not already set
        setSelectedBranch('all');
      }
    }
  }, [user?.profile, branches, selectedBranch, canViewAllData]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [correctingSale, setCorrectingSale] = useState<Sale | null>(null);
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [activityLogSale, setActivityLogSale] = useState<Sale | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isSaleClosingDrawerOpen, setIsSaleClosingDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const voidSaleMutation = useVoidSale();
  const logSaleActivity = useLogSaleActivity();
  const { data: activityLogData = [] } = useSaleActivityLogs(
    activityLogSale?.id,
    currentOrganization?.id
  );

  // For users who cannot view all data, automatically set their branch and prevent changing it
  const effectiveBranchId = canViewAllData()
    ? selectedBranch === 'all'
      ? undefined
      : selectedBranch
    : user?.profile?.branch_id;

  const { data: sales = [] } = useSales(
    effectiveBranchId || undefined,
    dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateRange?.to ? dateRange.to.toISOString() : undefined,
    currentOrganization?.id,
    true // Include inactive sales so corrected sales can be viewed and their activity logs accessed
  );

  // Since useBranches now returns the correct branches based on user role, we just need to filter for active ones
  const userBranches = branches.filter((branch) => branch.is_active);

  // Filter and paginate sales
  const filteredSales = sales.filter((sale) => {
    const searchTerm = debouncedSearchValue?.toLowerCase();

    let matchesSearch = true;

    if (searchTerm) {
      matchesSearch =
        // Search by customer name
        sale.customer_name?.toLowerCase().includes(searchTerm) ||
        // Search by branch name
        sale.branches?.name?.toLowerCase().includes(searchTerm) ||
        // Search by amount
        sale.amount?.toString().includes(searchTerm) ||
        // Search by sale items (product names)
        sale.sale_line_items?.some((item) =>
          item.products?.name?.toLowerCase().includes(searchTerm)
        ) ||
        // Search by legacy sale items (backward compatibility)
        sale.sale_items?.some((item) =>
          item.products?.name?.toLowerCase().includes(searchTerm)
        ) ||
        false;
    }

    // Only show active sales in the main list, but keep all sales in memory for activity log access
    const isActiveForDisplay = sale.is_active !== false;

    return matchesSearch && isActiveForDisplay;
  });

  const totalPages = Math.ceil(filteredSales.length / limit);
  const paginatedSales = filteredSales.slice((page - 1) * limit, page * limit);

  const handleCorrect = (sale: Sale) => {
    if (sale.closed) {
      toast.error('Cannot correct a sale in a closed period');
      return;
    }
    setCorrectingSale(sale);
    setIsCorrectionDialogOpen(true);
  };

  const handleCorrectionDialogClose = () => {
    setCorrectingSale(null);
    setIsCorrectionDialogOpen(false);
  };

  const handleVoid = (sale: Sale) => {
    setVoidingSale(sale);
    setIsVoidDialogOpen(true);
  };

  const handleVoidConfirm = async () => {
    if (voidingSale) {
      try {
        await voidSaleMutation.mutateAsync(voidingSale.id);

        // Log the void activity
        await logSaleActivity.mutateAsync({
          saleId: voidingSale.id,
          organizationId: currentOrganization?.id || '',
          activityType: 'delete',
          description: `Sale removed - ${
            currentOrganization?.currency || 'GH₵'
          }${voidingSale.amount?.toFixed(2)}${
            voidingSale.customer_name
              ? ` for customer: ${voidingSale.customer_name}`
              : ''
          }`,
          oldValues: {
            is_active: true,
            amount: voidingSale.amount,
            customer_name: voidingSale.customer_name,
            sale_date: voidingSale.sale_date,
          },
          newValues: {
            is_active: false,
          },
          metadata: {
            void_reason: 'Manual remove by user',
            branch_name: voidingSale.branches?.name,
          },
        });

        setIsVoidDialogOpen(false);
        setVoidingSale(null);
        toast.success('Sale removed successfully');
      } catch (error) {
        console.error('Failed to remove sale:', error);
        toast.error('Failed to remove sale');
      }
    }
  };

  const handleVoidCancel = () => {
    setIsVoidDialogOpen(false);
    setVoidingSale(null);
  };

  const handleViewActivityLog = (sale: Sale) => {
    setActivityLogSale(sale);
    setIsActivityLogOpen(true);
  };

  // Check if user can perform actions on a sale
  const canCorrectThisSale = (sale: Sale) => {
    if (!canCorrectSales()) return false;

    // Cannot edit closed sales
    if (sale.closed) return false;

    if (canEditSales()) return true;

    return sale.is_active !== false && sale.created_by === user?.id;
  };

  const canVoidThisSale = (sale: Sale) => {
    if (!canVoidSales()) return false;
    if (sale.closed && !canViewAllData()) return false; // Only owners/admins can remove(void) closed sales
    return sale.is_active !== false;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            Record and manage all sales entries.
          </p>
        </div>
        {(user?.profile?.role === 'owner' ||
          user?.profile?.role === 'admin' ||
          user?.profile?.role === 'branch_manager' ||
          user?.profile?.role === 'sales_person') && (
          <Button
            onClick={() => setIsSaleClosingDrawerOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Lock className="h-4 w-4" />
            Close Sales
          </Button>
        )}
      </div>

      <Tabs
        defaultValue={canCreateSales() ? 'record' : 'entries'}
        className="space-y-6"
      >
        <TabsList
          className={cn(
            'grid w-ful',
            canCreateSales() ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          {canCreateSales() && (
            <TabsTrigger value="record">Record Sale</TabsTrigger>
          )}
          <TabsTrigger value="entries">Sales Entries</TabsTrigger>
          <TabsTrigger value="items">Sale Items</TabsTrigger>
        </TabsList>

        {canCreateSales() && (
          <TabsContent value="record">
            <Card>
              <CardHeader>
                <CardTitle>Record New Sale</CardTitle>
                <CardDescription>
                  Enter details for a new sale transaction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MultipleSaleForm onSuccess={() => setPage(1)} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="entries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Left side: Search and Date Range */}
                <div className="flex flex-col sm:flex-row items-baseline gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search sales..."
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <DatePresets
                      value={dateRange}
                      onChange={(range) => {
                        setDateRange(range);
                        setPage(1);
                      }}
                      placeholder="Filter by date range"
                    />
                    {dateRange && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDateRange(undefined);
                          setPage(1);
                        }}
                        size="sm"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Right side: Branch Selector */}
                <div className="w-full lg:w-[200px]">
                  <Select
                    value={selectedBranch}
                    onValueChange={(value) => {
                      setSelectedBranch(value);
                      setPage(1);
                    }}
                    disabled={
                      user?.profile?.role !== 'admin' &&
                      userBranches.length <= 1
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedBranch === '' ? 'Loading...' : 'Select branch'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {canViewAllData() && (
                        <SelectItem value="all">All Branches</SelectItem>
                      )}
                      {userBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead className="w-[5%]">Receipt</TableHead>
                      <TableHead className="w-[15%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map((sale: Sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(
                            new Date(sale.sale_date),
                            'MMM dd, yyyy HH:mm'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {sale.branches?.name || 'Unknown'}
                            {sale.branches?.is_active === false && (
                              <span className="text-red-700 text-xs ml-1">
                                (Inactive)
                              </span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="">
                          <SalesItemsDisplay
                            items={
                              sale.sale_line_items || sale.sale_items || []
                            }
                          />
                        </TableCell>
                        <TableCell>{sale.customer_name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {currentOrganization?.currency || 'GH₵'}{' '}
                            {sale.amount?.toFixed(2) || '0.00'}
                          </div>
                        </TableCell>

                        <TableCell>
                          <ReceiptGenerator sale={sale} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap items-center">
                            {canCorrectThisSale(sale) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCorrect(sale)}
                                title="Update Sale"
                                className="px-2"
                              >
                                <ClipboardPenLine className="h-4 w-4" />
                              </Button>
                            )}
                            {canVoidThisSale(sale) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVoid(sale)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                                title="Remove Sale"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewActivityLog(sale)}
                              title="View History"
                              className="px-2"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {sale.closed && (
                              <span className="text-gray-400 text-[10px]">
                                closed
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedSales.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          No sales found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <span>
                  Page {page} of {totalPages || 1}
                </span>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Sales Items Management</CardTitle>
              <CardDescription>
                Manage your sales items - add, edit, or remove items from your
                inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesItemsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sale Correction Dialog */}
      <Dialog
        open={isCorrectionDialogOpen}
        onOpenChange={handleCorrectionDialogClose}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col px-0">
          <DialogHeader className="flex-shrink-0 px-4">
            <DialogTitle>Update Sale</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4">
            {correctingSale && (
              <MultipleSaleForm
                sale={correctingSale}
                onSuccess={handleCorrectionDialogClose}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Sale Confirmation Dialog */}
      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this sale? This action cannot be
              undone.
              {voidingSale && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <strong>Sale Details:</strong>
                  <br />
                  Date:{' '}
                  {voidingSale.sale_date
                    ? format(
                        new Date(voidingSale.sale_date),
                        'MMM dd, yyyy HH:mm'
                      )
                    : 'N/A'}
                  <br />
                  Amount: {currentOrganization?.currency || 'GH₵'}{' '}
                  {voidingSale.amount?.toFixed(2) || '0.00'}
                  <br />
                  Customer: {voidingSale.customer_name || 'Unknown'}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleVoidCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={voidSaleMutation.isPending}
            >
              {voidSaleMutation.isPending ? 'Removing...' : 'Remove Sale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Log Dialog */}
      <Dialog open={isActivityLogOpen} onOpenChange={setIsActivityLogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Sale Activity History</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {activityLogSale && (
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded">
                  <h4 className="font-semibold mb-2">Sale Details</h4>
                  <div className="grid grid-col-1 md:grid-cols-3 gap-4">
                    <div>
                      <p
                        className="text-sm text-gray-600"
                        title="This is the date this sale was made"
                      >
                        Sale Date
                      </p>
                      <p className="font-medium">
                        {format(
                          new Date(activityLogSale.sale_date),
                          'MMM dd, yyyy HH:mm'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Amount</p>
                      <p className="font-medium">
                        {currentOrganization?.currency || 'GH₵'}{' '}
                        {activityLogSale.amount?.toFixed(2)}
                      </p>
                    </div>
                    {activityLogSale.customer_name && (
                      <div>
                        <p className="text-sm text-gray-600">Customer</p>
                        <p className="font-medium">
                          {activityLogSale.customer_name || 'N/A'}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Branch</p>
                      <p className="font-medium">
                        {activityLogSale.branches?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-sm text-gray-600"
                        title="This is the date this sale was recorded"
                      >
                        Created Date
                      </p>
                      <p className="font-medium">
                        {activityLogSale.created_at
                          ? format(
                              new Date(activityLogSale.created_at),
                              'MMM dd, yyyy HH:mm'
                            )
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Recorded by</p>
                      <p className="font-medium">
                        {activityLogSale.created_by_profile?.full_name ||
                          'Unknown'}
                      </p>
                    </div>
                    {activityLogSale.updated_at && (
                      <div>
                        <p className="text-sm text-gray-600">
                          Last Updated Date
                        </p>
                        <p className="font-medium">
                          {format(
                            new Date(activityLogSale.updated_at),
                            'MMM dd, yyyy HH:mm'
                          )}
                        </p>
                      </div>
                    )}
                    {activityLogSale.last_updated_by_profile && (
                      <div>
                        <p className="text-sm text-gray-600">Last Updated by</p>
                        <p className="font-medium">
                          {activityLogSale.last_updated_by_profile?.full_name ||
                            'Unknown'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {activityLogData.length > 0 ? (
                  <div>
                    <h4 className="font-semibold mb-4">Activity History</h4>
                    <div className="space-y-3">
                      {activityLogData.map((activity: any) => {
                        const getActivityColor = (type: string) => {
                          switch (type) {
                            case 'create':
                              return 'bg-green-50/20 border-green-100';
                            case 'update':
                              return 'bg-blue-50/20 border-blue-100';
                            case 'delete':
                              return 'bg-red-50/20 border-red-100';
                            default:
                              return 'bg-gray-50/20 border-gray-100';
                          }
                        };

                        const getActivityBadgeColor = (type: string) => {
                          switch (type) {
                            case 'create':
                              return 'bg-green-100 text-green-800';
                            case 'update':
                              return 'bg-blue-100 text-blue-800';
                            case 'delete':
                              return 'bg-red-100 text-red-800';
                            default:
                              return 'bg-gray-100 text-gray-800';
                          }
                        };

                        delete activity.metadata.original_sale_id;

                        return (
                          <div
                            key={activity.id}
                            className={`p-4 rounded border ${getActivityColor(
                              activity.activity_type
                            )}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={getActivityBadgeColor(
                                    activity.activity_type
                                  )}
                                >
                                  {activity.activity_type
                                    .charAt(0)
                                    .toUpperCase() +
                                    activity.activity_type.slice(1)}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-500">
                                {format(
                                  new Date(activity.created_at),
                                  'MMM dd, yyyy HH:mm:ss'
                                )}
                              </div>
                            </div>

                            <div className="mb-2">
                              <p className="text-sm font-medium">
                                {activity.description}
                              </p>
                            </div>

                            <div className="flex gap-1">
                              <p className="text-gray-600">Performed by</p>
                              <p className="font-medium">
                                {activity.user_profile?.full_name || 'Unknown'}
                              </p>
                            </div>

                            {(activity.old_values || activity.new_values) && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Changes:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  {activity.old_values && (
                                    <div>
                                      <p className="text-red-600 font-medium">
                                        Previous Values:
                                      </p>
                                      <div className="text-xs bg-red-50 p-2 rounded mt-1">
                                        <p className="text-red-700">
                                          {formatActivityValues(
                                            activity.old_values,
                                            activity.entity_type
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {activity.new_values && (
                                    <div>
                                      <p className="text-green-600 font-medium">
                                        New Values:
                                      </p>
                                      <div className="text-xs bg-green-50 p-2 rounded mt-1">
                                        <p className="text-green-700">
                                          {formatActivityValues(
                                            activity.new_values,
                                            activity.entity_type
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {activity.metadata && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Additional Information:
                                </p>
                                <div className="text-xs bg-gray-50 p-2 rounded">
                                  <p className="text-gray-700">
                                    {formatActivityValues(activity.metadata)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 rounded">
                    <p className="text-blue-800 text-sm">
                      <strong>Note:</strong> No activity history found for this
                      sale yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Closing Drawer */}
      <SaleClosingDrawer
        open={isSaleClosingDrawerOpen}
        onOpenChange={setIsSaleClosingDrawerOpen}
      />
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useSales, useBranches, Sale } from '@/hooks/queries';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
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
import { DatePresets, DateRange } from '@/components/ui/DatePresets';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Sales() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');

  const { data: branches = [] } = useBranches(currentOrganization?.id, user);

  // Initialize branch when user and branches data are available
  useEffect(() => {
    if (user?.profile && branches.length > 0) {
      if (user.profile.role !== 'admin' && user.profile.branch_id) {
        // Non-admin users: set to their assigned branch (should be the only one returned)
        setSelectedBranch(user.profile.branch_id);
      } else if (user.profile.role === 'admin' && selectedBranch === '') {
        // Admin users: set to 'all' if not already set
        setSelectedBranch('all');
      }
    }
  }, [user?.profile, branches, selectedBranch]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { searchValue: debouncedSearchValue } = useDebouncedSearch(
    searchValue,
    500
  );

  // For non-admin users, automatically set their branch and prevent changing it
  const effectiveBranchId =
    user?.profile?.role === 'admin'
      ? selectedBranch === 'all'
        ? undefined
        : selectedBranch
      : user?.profile?.branch_id;

  const { data: sales = [] } = useSales(
    effectiveBranchId || undefined,
    dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateRange?.to ? dateRange.to.toISOString() : undefined,
    currentOrganization?.id
  );

  // Since useBranches now returns the correct branches based on user role, we just need to filter for active ones
  const userBranches = branches.filter((branch) => branch.is_active);

  // Filter and paginate sales
  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      !debouncedSearchValue ||
      sale.customer_name
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ||
      sale.branches?.name
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase());

    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredSales.length / limit);
  const paginatedSales = filteredSales.slice((page - 1) * limit, page * limit);

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setIsEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditingSale(null);
    setIsEditDialogOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
        <p className="text-muted-foreground">
          Record and manage all sales entries.
        </p>
      </div>

      <Tabs defaultValue="record" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record">Record Sale</TabsTrigger>
          <TabsTrigger value="entries">Sales Entries</TabsTrigger>
          <TabsTrigger value="items">Sale Items</TabsTrigger>
        </TabsList>

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

        <TabsContent value="entries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Left side: Search and Date Range */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search sales..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <DatePresets
                      value={dateRange}
                      onChange={setDateRange}
                      placeholder="Filter by date range"
                    />
                    {dateRange && (
                      <Button
                        variant="outline"
                        onClick={() => setDateRange(undefined)}
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
                    onValueChange={setSelectedBranch}
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
                      {user?.profile?.role === 'admin' && (
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
                      <TableHead className="w-[5%]">Actions</TableHead>
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
                          {currentOrganization?.currency || 'GH₵'}{' '}
                          {sale.total_amount?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell>
                          <ReceiptGenerator sale={sale} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(sale)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
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

      {/* Edit Sale Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {editingSale && (
            <MultipleSaleForm
              sale={editingSale}
              onSuccess={handleDialogClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

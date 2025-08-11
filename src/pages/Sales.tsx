/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
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
import { SaleForm } from '@/components/forms/SaleForm';
import { SalesItemsManager } from '@/components/sales/SalesItemsManager';
import { ReceiptGenerator } from '@/components/sales/ReceiptGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function Sales() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const { data: branches = [] } = useBranches(currentOrganization?.id);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const { searchValue, debouncedSearchValue, setSearchValue } = useDebouncedSearch('', 500);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: sales = [] } = useSales(
    selectedBranch === 'all' ? undefined : selectedBranch,
    undefined,
    undefined,
    currentOrganization?.id
  );

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches
      : branches.filter(
          (branch) => branch.id === user?.profile?.branch_id && branch.is_active
        );

  // Filter sales by debounced search and branch
  const filteredSales = sales.filter((sale: Sale) => {
    const totalAmount = (sale.amount || 0) * ((sale as any).quantity || 1);
    const matchesSearch =
      (sale as any).sales_items?.name?.toLowerCase().includes(debouncedSearchValue.toLowerCase()) ||
      (sale as any).branches?.name
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ||
      String(sale.amount).includes(debouncedSearchValue) ||
      String(totalAmount.toFixed(2)).includes(debouncedSearchValue);
    const matchesBranch =
      selectedBranch === 'all' || sale.branch_id === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / pageSize);
  const paginatedSales = filteredSales.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleEdit = (sale: Sale) => {
    setEditSale(sale);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditSale(null);
    setIsDialogOpen(false);
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
          <TabsTrigger value="items">Sales Items</TabsTrigger>
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
              <SaleForm onSuccess={() => setPage(1)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle>Sales Entries</CardTitle>
              <CardDescription>
                View, search, filter, and edit sales records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
                <Input
                  type="text"
                  placeholder="Search by item name, branch, unit amount, or total..."
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setPage(1);
                  }}
                  className="w-full md:w-64"
                />
                <Select
                  value={selectedBranch}
                  onValueChange={(v) => {
                    setSelectedBranch(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {userBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Amount</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead className="w-[5%]">Receipt</TableHead>
                      <TableHead className="w-[5%]">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map((sale: Sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(sale as any).branches?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>{(sale as any).sales_items?.name || '-'}</TableCell>
                        <TableCell>{(sale as any).quantity || 1}</TableCell>
                        <TableCell>{currentOrganization?.currency || 'GH₵'} {(sale.amount || 0).toFixed(2)}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {currentOrganization?.currency || 'GH₵'} {((sale.amount || 0) * ((sale as any).quantity || 1)).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <ReceiptGenerator sale={sale} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="outline"
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
                          colSpan={8}
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
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {editSale && (
            <SaleForm sale={editSale} onSuccess={handleDialogClose} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useSales, useBranches, Sale } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function Sales() {
  const { user } = useAuthStore();
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [search, setSearch] = useState('');
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: sales = [] } = useSales(
    selectedBranch === 'all' ? undefined : selectedBranch
  );

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches
      : branches.filter(
          (branch) => branch.id === user?.profile?.branch_id && branch.is_active
        );

  // Filter sales by search and branch
  const filteredSales = sales.filter((sale: Sale) => {
    const matchesSearch =
      sale.description?.toLowerCase().includes(search.toLowerCase()) ||
      (sale as any).branches?.name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      String(sale.amount).includes(search);
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

      {/* Record Sale Section */}
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

      {/* Sales Table Section */}
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
              placeholder="Search sales..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Edit</TableHead>
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
                    <TableCell className="font-medium text-green-600">
                      {sale.amount}
                    </TableCell>
                    <TableCell>{sale.description || '-'}</TableCell>
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
                      colSpan={5}
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

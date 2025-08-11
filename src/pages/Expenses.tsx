/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useExpenses, useBranches } from '@/hooks/queries';
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
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { format } from 'date-fns';
import type { Expense } from '@/hooks/queries';

export default function Expenses() {
  const { user } = useAuthStore();
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [search, setSearch] = useState('');
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: expenses = [] } = useExpenses(
    selectedBranch === 'all' ? undefined : selectedBranch
  );

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches
      : branches.filter(
          (branch) => branch.id === user?.profile?.branch_id && branch.is_active
        );

  // Filter expenses by search and branch
  const filteredExpenses = expenses.filter((expense: Expense) => {
    const matchesSearch =
      expense.description?.toLowerCase().includes(search.toLowerCase()) ||
      (expense as any).branches?.name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      String(expense.amount).includes(search) ||
      (expense.category?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesBranch =
      selectedBranch === 'all' || expense.branch_id === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);
  const paginatedExpenses = filteredExpenses.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleEdit = (expense: Expense) => {
    setEditExpense(expense);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditExpense(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground">
          Record and manage all expense entries.
        </p>
      </div>

      {/* Record Expense Section */}
      <Card>
        <CardHeader>
          <CardTitle>Record New Expense</CardTitle>
          <CardDescription>
            Enter details for a new expense transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm onSuccess={() => setPage(1)} />
        </CardContent>
      </Card>

      {/* Expenses Table Section */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Entries</CardTitle>
          <CardDescription>
            View, search, filter, and edit expense records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
            <Input
              type="text"
              placeholder="Search expenses..."
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
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExpenses.map((expense: Expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {format(new Date(expense.expense_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(expense as any).branches?.name || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{expense.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      {expense.amount}
                    </TableCell>
                    <TableCell>{expense.description || '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(expense)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedExpenses.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No expenses found.
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

      {/* Edit Expense Dialog*/}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editExpense && (
            <ExpenseForm expense={editExpense} onSuccess={handleDialogClose} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

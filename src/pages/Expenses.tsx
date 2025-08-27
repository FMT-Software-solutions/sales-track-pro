/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useExpenses, useBranches, useDeleteExpense } from '@/hooks/queries';
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
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { ExpenseCategoriesManager } from '@/components/expenses/ExpenseCategoriesManager';
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
import { Edit, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Expense } from '@/hooks/queries';
import { toast } from 'sonner';

export default function Expenses() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

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
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
  } = useDebouncedSearch('', 500);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const deleteExpenseMutation = useDeleteExpense();

  // For non-admin users, automatically set their branch and prevent changing it
  const effectiveBranchId =
    user?.profile?.role === 'admin'
      ? selectedBranch === 'all'
        ? undefined
        : selectedBranch
      : user?.profile?.branch_id;

  const { data: expenses = [] } = useExpenses(
    effectiveBranchId || undefined,
    undefined,
    dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateRange?.to ? dateRange.to.toISOString() : undefined,
    currentOrganization?.id
  );

  // Since useBranches now returns the correct branches based on user role, we just need to filter for active ones
  const userBranches = branches.filter((branch) => branch.is_active);

  // Filter expenses by debounced search (branch and date filtering now handled by the query)
  const filteredExpenses = expenses.filter((expense: Expense) => {
    const matchesSearch =
      expense.description
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ||
      (expense as any).branches?.name
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ||
      String(expense.amount).includes(debouncedSearchValue) ||
      (expense.category
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ??
        false) ||
      ((expense as any).expense_categories?.name
        ?.toLowerCase()
        .includes(debouncedSearchValue.toLowerCase()) ??
        false);

    return matchesSearch;
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

  const handleDelete = (expense: Expense) => {
    setDeletingExpense(expense);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingExpense) {
      try {
        await deleteExpenseMutation.mutateAsync(deletingExpense.id);
        setIsDeleteDialogOpen(false);
        setDeletingExpense(null);
        toast.success('Expense data deleted successfully');
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setDeletingExpense(null);
  };

  // Check if user can delete an expense
  const canDeleteExpense = (expense: Expense) => {
    if (user?.profile?.role === 'admin') {
      return true; // Admin can delete all expenses
    }
    // Branch managers can only delete expenses from their own branch
    return user?.profile?.branch_id === expense.branch_id;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground">
          Record and manage all expense entries.
        </p>
      </div>

      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record">
            Record <span className="hidden md:inline md:ml-1">Expense</span>
          </TabsTrigger>

          <TabsTrigger value="entries">
            <span className="hidden md:inline md:mr-1">Expense</span> Entries
          </TabsTrigger>
          <TabsTrigger value="categories">
            Categories{' '}
            <span className="hidden md:inline md:ml-1">Management</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Entries</CardTitle>
              <CardDescription>
                View, search, filter, and edit expense records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Left side: Search and Date Range */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search expenses..."
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
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((expense: Expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {format(
                            new Date(expense.expense_date),
                            'MMM d, yyyy'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (expense as any).branches?.is_active === false
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {(expense as any).branches?.name || 'Unknown'}
                            {(expense as any).branches?.is_active === false &&
                              ' (Inactive)'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {(expense as any).expense_categories?.name ||
                              expense.category ||
                              'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-red-600">
                          {currentOrganization?.currency || 'GH₵'}{' '}
                          {(expense.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{expense.description || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEdit(expense)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {canDeleteExpense(expense) && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleDelete(expense)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Categories Management</CardTitle>
              <CardDescription>
                Manage your expense categories - add, edit, or remove categories
                for better expense tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseCategoriesManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot
              be undone.
              {deletingExpense && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <strong>Expense Details:</strong>
                  <br />
                  Date:{' '}
                  {deletingExpense.expense_date
                    ? format(
                        new Date(deletingExpense.expense_date),
                        'MMM dd, yyyy'
                      )
                    : 'N/A'}
                  <br />
                  Description: {deletingExpense.description || 'N/A'}
                  <br />
                  Amount: {currentOrganization?.currency || 'GH₵'}{' '}
                  {deletingExpense.amount?.toFixed(2) || '0.00'}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteExpenseMutation.isPending}
            >
              {deleteExpenseMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

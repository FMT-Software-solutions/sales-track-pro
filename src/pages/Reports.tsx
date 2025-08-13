/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useSales, useExpenses, useBranches } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatCurrencyForPDF } from '@/lib/utils';
import { DatePresets } from '@/components/ui/DatePresets';
import { SalesItemsDisplay } from '@/components/ui/SalesItemsDisplay';

export function Reports() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
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

  // For non-admin users, automatically set their branch and prevent changing it
  const effectiveBranchId =
    user?.profile?.role === 'admin'
      ? selectedBranch === 'all'
        ? undefined
        : selectedBranch
      : user?.profile?.branch_id;

  const { data: sales = [], isLoading: salesLoading } = useSales(
    effectiveBranchId || undefined,
    startDate.toISOString(),
    endDate.toISOString(),
    currentOrganization?.id
  );
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(
    effectiveBranchId || undefined,
    undefined,
    startDate.toISOString(),
    endDate.toISOString(),
    currentOrganization?.id
  );

  // Since useBranches now returns the correct branches based on user role, we just need to filter for active ones
  const userBranches = branches.filter((branch) => branch.is_active);

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const netProfit = totalSales - totalExpenses;

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(
      `${currentOrganization?.name || 'SalesTrack Pro'} - Financial Report`,
      20,
      20
    );

    doc.setFontSize(12);
    doc.text(
      `Period: ${format(startDate, 'MMM d, yyyy')} - ${format(
        endDate,
        'MMM d, yyyy'
      )}`,
      20,
      35
    );
    doc.text(
      `Branch: ${
        selectedBranch === 'all'
          ? 'All Branches'
          : branches.find((b) => b.id === selectedBranch)?.name || 'Unknown'
      }`,
      20,
      45
    );

    // Summary
    doc.text('Summary:', 20, 60);
    doc.text(
      `Total Sales: ${formatCurrencyForPDF(
        totalSales,
        currentOrganization?.currency
      )}`,
      20,
      70
    );
    doc.text(
      `Total Expenses: ${formatCurrencyForPDF(
        totalExpenses,
        currentOrganization?.currency
      )}`,
      20,
      80
    );
    doc.text(
      `Net Profit: ${formatCurrencyForPDF(
        netProfit,
        currentOrganization?.currency
      )}`,
      20,
      90
    );

    // Sales Table
    if (sales.length > 0) {
      const salesData: any[] = [];

      sales.forEach((sale) => {
        const saleLineItems = (sale as any).sale_line_items || [];

        if (saleLineItems.length === 0) {
          // If no line items, create a single row with sale data
          salesData.push([
            format(new Date(sale.sale_date), 'MMM d, yyyy'),
            (sale as any).branches?.name || 'Unknown',
            '-',
            '1',
            formatCurrencyForPDF(
              sale.amount || 0,
              currentOrganization?.currency
            ),
            formatCurrencyForPDF(
              sale.amount || 0,
              currentOrganization?.currency
            ),
          ]);
        } else {
          // Create a row for each line item
          saleLineItems.forEach((lineItem: any) => {
            salesData.push([
              format(new Date(sale.sale_date), 'MMM d, yyyy'),
              (sale as any).branches?.name || 'Unknown',
              lineItem.products?.name || '-',
              lineItem.quantity || 1,
              formatCurrencyForPDF(
                lineItem.unit_price || 0,
                currentOrganization?.currency
              ),
              formatCurrencyForPDF(
                lineItem.total_price || 0,
                currentOrganization?.currency
              ),
            ]);
          });
        }
      });

      autoTable(doc, {
        head: [
          ['Date', 'Branch', 'Item', 'Qty', 'Unit Amount', 'Total Amount'],
        ],
        body: salesData,
        startY: 105,
        headStyles: { fillColor: [59, 130, 246] },
        theme: 'striped',
      });
    }

    // Expenses Table
    if (expenses.length > 0) {
      const expensesData = expenses.map((expense) => [
        format(new Date(expense.expense_date), 'MMM d, yyyy'),
        (expense as any).branches?.name || 'Unknown',
        (expense as any).expense_categories?.name ||
          expense.category ||
          'Unknown',
        formatCurrencyForPDF(expense.amount, currentOrganization?.currency),
        expense.description || '-',
      ]);

      const finalY = (doc as any).lastAutoTable.finalY || 105;

      autoTable(doc, {
        head: [['Date', 'Branch', 'Category', 'Amount', 'Description']],
        body: expensesData,
        startY: finalY + 20,
        headStyles: { fillColor: [239, 68, 68] },
        theme: 'striped',
      });
    }

    doc.save(`financial-report-${startDate}-${endDate}.pdf`);
  };

  const exportToCSV = (type: 'sales' | 'expenses') => {
    const headers =
      type === 'sales'
        ? ['Date', 'Branch', 'Item', 'Qty', 'Unit Amount', 'Total Amount']
        : ['Date', 'Branch', 'Category', 'Amount', 'Description'];

    let csvRows: string[] = [];

    if (type === 'sales') {
      // For sales, create a row for each sale line item
      sales.forEach((sale) => {
        const saleLineItems = (sale as any).sale_line_items || [];

        if (saleLineItems.length === 0) {
          // If no line items, create a single row with sale data
          csvRows.push(
            [
              (sale as any).sale_date,
              `"${(sale as any).branches?.name || 'Unknown'}"`,
              '"-"',
              '1',
              (sale as any).amount || 0,
              (sale as any).amount || 0,
            ].join(',')
          );
        } else {
          // Create a row for each line item
          saleLineItems.forEach((lineItem: any) => {
            csvRows.push(
              [
                (sale as any).sale_date,
                `"${(sale as any).branches?.name || 'Unknown'}"`,
                `"${lineItem.products?.name || '-'}"`,
                lineItem.quantity || 1,
                lineItem.unit_price || 0,
                lineItem.total_price || 0,
              ].join(',')
            );
          });
        }
      });
    } else {
      // For expenses, keep the existing logic
      csvRows = expenses.map((expense) => {
        return [
          (expense as any).expense_date,
          `"${(expense as any).branches?.name || 'Unknown'}"`,
          `"${
            (expense as any).expense_categories?.name ||
            (expense as any).category ||
            'Unknown'
          }"`,
          (expense as any).amount,
          `"${(expense as any).description || '-'}"`,
        ].join(',');
      });
    }

    const csvContent = [headers.join(','), ...csvRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${format(startDate, 'yyyy-MM-dd')}-${format(
      endDate,
      'yyyy-MM-dd'
    )}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate detailed financial reports and export data for analysis
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>
            Customize your report by selecting date range and branch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
            {/* Left side: Date Range Picker */}
            <div className="flex-1 space-y-2">
              <DatePresets
                value={{ from: startDate, to: endDate }}
                onChange={(range) => {
                  if (range) {
                    setStartDate(range.from);
                    setEndDate(range.to);
                  }
                }}
              />
            </div>

            {/* Right side: Branch Selector and Export Button */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  disabled={
                    user?.profile?.role !== 'admin' && userBranches.length <= 1
                  }
                >
                  <SelectTrigger className="w-[200px]">
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

              <div className="flex items-end space-x-2">
                <Button onClick={exportToPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-2xl font-bold text-green-600">
              {formatCurrency(totalSales, currentOrganization?.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {sales.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses, currentOrganization?.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg lg:text-2xl font-bold ${
                netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(netProfit, currentOrganization?.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalSales > 0
                ? ((netProfit / totalSales) * 100).toFixed(1)
                : '0.0'}
              % profit margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Tables */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales Data</TabsTrigger>
          <TabsTrigger value="expenses">Expenses Data</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1">
              <div>
                <CardTitle>Sales Reports</CardTitle>
                <CardDescription>
                  Generate report of all sales in the selected period
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => exportToCSV('sales')}>
                <Download className="md:mr-2 h-4 w-4" />
                <span className="hidden md:flex">Export CSV</span>
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {salesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Amount</TableHead>
                        <TableHead>Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(sale as any).branches?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <SalesItemsDisplay
                              items={(sale as any).sale_line_items || []}
                            />
                          </TableCell>
                          <TableCell>
                            {(sale as any).sale_line_items?.reduce(
                              (total: number, item: any) =>
                                total + (item.quantity || 0),
                              0
                            ) || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(
                              sale.amount,
                              currentOrganization?.currency
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(
                              sale.amount,
                              currentOrganization?.currency
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1">
              <div>
                <CardTitle>Expenses Reports</CardTitle>
                <CardDescription>
                  Generate report of all expenses in the selected period
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => exportToCSV('expenses')}>
                <Download className="md:mr-2 h-4 w-4" />
                <span className="hidden md:flex">Export CSV</span>
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {expensesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {format(
                              new Date(expense.expense_date),
                              'MMM d, yyyy'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(expense as any).branches?.name || 'Unknown'}
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
                            {formatCurrency(
                              expense.amount,
                              currentOrganization?.currency
                            )}
                          </TableCell>
                          <TableCell>{expense.description || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

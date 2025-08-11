/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { formatCurrency } from '@/lib/utils';

export function Reports() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [startDate, setStartDate] = useState(
    format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      'yyyy-MM-dd'
    )
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const { data: branches = [] } = useBranches(currentOrganization?.id);
  const { data: sales = [], isLoading: salesLoading } = useSales(
    selectedBranch === 'all' ? undefined : selectedBranch,
    startDate,
    endDate,
    currentOrganization?.id
  );
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(
    selectedBranch === 'all' ? undefined : selectedBranch,
    undefined,
    startDate,
    endDate,
    currentOrganization?.id
  );

  const userBranches =
    user?.profile?.role === 'admin'
      ? branches
      : branches.filter(
          (branch) => branch.id === user?.profile?.branch_id && branch.is_active
        );



  const totalSales = sales.reduce((sum, sale) => sum + (sale.amount * (sale.quantity || 1)), 0);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const netProfit = totalSales - totalExpenses;

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('FoodTrack Pro - Financial Report', 20, 20);

    doc.setFontSize(12);
    doc.text(
      `Period: ${format(new Date(startDate), 'MMM d, yyyy')} - ${format(
        new Date(endDate),
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
    doc.text(`Total Sales: ${formatCurrency(totalSales, currentOrganization?.currency)}`, 20, 70);
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses, currentOrganization?.currency)}`, 20, 80);
    doc.text(`Net Profit: ${formatCurrency(netProfit, currentOrganization?.currency)}`, 20, 90);

    // Sales Table
    if (sales.length > 0) {
      const salesData = sales.map((sale) => [
        format(new Date(sale.sale_date), 'MMM d, yyyy'),
        (sale as any).branches?.name || 'Unknown',
        formatCurrency(sale.amount * (sale.quantity || 1), currentOrganization?.currency),
        sale.customer_name || '-',
      ]);

      autoTable(doc, {
        head: [['Date', 'Branch', 'Amount', 'Customer']],
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
        formatCurrency(expense.amount, currentOrganization?.currency),
        expense.description || '-',
        expense.category || '-',
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
    const data = type === 'sales' ? sales : expenses;
    const headers =
      type === 'sales'
        ? ['Date', 'Branch', 'Amount', 'Customer']
        : ['Date', 'Branch', 'Category', 'Amount', 'Description'];

    const csvContent = [
      headers.join(','),
      ...data.map((item) =>
        [
          type === 'sales'
            ? (item as any).sale_date
            : (item as any).expense_date,
          `"${(item as any).branches?.name || 'Unknown'}"`,
          type === 'expenses' ? `"${(item as any).category}"` : '',
          type === 'sales' ? (item as any).amount * ((item as any).quantity || 1) : (item as any).amount,
          `"${type === 'sales' ? (item as any).customer_name || '' : (item as any).description || ''}"`,
        ]
          .filter(Boolean)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${startDate}-${endDate}.csv`;
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
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {user?.profile?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                >
                  <SelectTrigger>
                    <SelectValue />
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
            )}

            <div className="flex items-end space-x-2">
              <Button onClick={exportToPDF}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
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
              {totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0'}% profit margin
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
                <CardTitle>Sales Transactions</CardTitle>
                <CardDescription>
                  Detailed list of all sales in the selected period
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
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Customer</TableHead>
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
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(sale.amount * (sale.quantity || 1), currentOrganization?.currency)}
                          </TableCell>
                          <TableCell>{sale.customer_name || '-'}</TableCell>
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
                <CardTitle>Expense Transactions</CardTitle>
                <CardDescription>
                  Detailed list of all expenses in the selected period
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => exportToCSV('expenses')}>
                <Download className="md:mr-2 h-4 w-4" />
                <span className="hidden md:flex">Export CSV</span>
              </Button>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table className="min-w-[600px]">
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
                          <Badge variant="secondary">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-red-600">
                          {formatCurrency(expense.amount, currentOrganization?.currency)}
                        </TableCell>
                        <TableCell>{expense.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

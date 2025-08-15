import { useState, useEffect } from 'react';
import { useDashboardData, useBranches } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { getPeriodRange, formatCurrency } from '@/lib/utils';

const periods = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

export function Dashboard() {
  const { user } = useAuthStore();
  const { currentOrganization } = useOrganization();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('day');

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

  const { data: dashboardData, isLoading } = useDashboardData(
    effectiveBranchId || undefined,
    selectedPeriod,
    currentOrganization?.id
  );

  // Since useBranches now returns the correct branches based on user role, we just need to filter for active ones
  const userBranches = branches.filter((branch) => branch.is_active);

  const generateChartData = () => {
    if (!dashboardData) return [];

    const now = new Date();
    const { startDate, endDate } = getPeriodRange(selectedPeriod, now);

    if (selectedPeriod === 'all') {
      // Group by month and year for all time
      const allDates = [
        ...dashboardData.salesData.map((sale) => sale.sale_date),
        ...dashboardData.expensesData.map((expense) => expense.expense_date),
      ];
      const uniqueMonths = Array.from(
        new Set(
          allDates
            .map((date) => date.slice(0, 7)) // 'YYYY-MM'
            .filter(Boolean)
        )
      ).sort();
      return uniqueMonths.map((monthStr) => {
        const monthName = format(new Date(monthStr + '-01'), 'MMM yyyy');
        const monthSales = dashboardData.salesData
          .filter((sale) => {
            try {
              const saleDate = parseISO(sale.sale_date);
              return format(saleDate, 'yyyy-MM') === monthStr;
            } catch {
              return sale.sale_date.startsWith(monthStr);
            }
          })
          .reduce((sum, sale) => sum + sale.amount, 0);
        const monthExpenses = dashboardData.expensesData
          .filter((expense) => {
            try {
              const expenseDate = parseISO(expense.expense_date);
              return format(expenseDate, 'yyyy-MM') === monthStr;
            } catch {
              return expense.expense_date.startsWith(monthStr);
            }
          })
          .reduce((sum, expense) => sum + expense.amount, 0);
        return {
          name: monthName,
          sales: monthSales,
          expenses: monthExpenses,
          profit: monthSales - monthExpenses,
        };
      });
    }

    if (selectedPeriod === 'year') {
      // Group by month for the current year
      if (!startDate) return [];
      return Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(startDate.getFullYear(), i, 1);
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthName = format(monthDate, 'MMM');
        const monthSales = dashboardData.salesData
          .filter((sale) => {
            try {
              const saleDate = parseISO(sale.sale_date);
              return format(saleDate, 'yyyy-MM') === monthStr;
            } catch {
              return sale.sale_date.startsWith(monthStr);
            }
          })
          .reduce((sum, sale) => sum + sale.amount, 0);
        const monthExpenses = dashboardData.expensesData
          .filter((expense) => {
            try {
              const expenseDate = parseISO(expense.expense_date);
              return format(expenseDate, 'yyyy-MM') === monthStr;
            } catch {
              return expense.expense_date.startsWith(monthStr);
            }
          })
          .reduce((sum, expense) => sum + expense.amount, 0);
        return {
          name: monthName,
          sales: monthSales,
          expenses: monthExpenses,
          profit: monthSales - monthExpenses,
        };
      });
    }

    // For day, week, month: generate days between startDate and endDate
    if (!startDate || !endDate) return [];
    const days: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const chartData = days.map((date) => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const dayName =
        selectedPeriod === 'month' ||
        selectedPeriod === 'week' ||
        selectedPeriod === 'day'
          ? format(date, 'MMM d')
          : format(date, 'MMM');

      const daySales = dashboardData.salesData
        .filter((sale) => {
          try {
            const saleDate = parseISO(sale.sale_date);
            return isWithinInterval(saleDate, { start: dayStart, end: dayEnd });
          } catch {
            // Fallback to string comparison if date parsing fails
            return sale.sale_date.startsWith(format(date, 'yyyy-MM-dd'));
          }
        })
        .reduce((sum, sale) => sum + sale.amount, 0);

      const dayExpenses = dashboardData.expensesData
        .filter((expense) => {
          try {
            const expenseDate = parseISO(expense.expense_date);
            return isWithinInterval(expenseDate, { start: dayStart, end: dayEnd });
          } catch {
            // Fallback to string comparison if date parsing fails
            return expense.expense_date.startsWith(format(date, 'yyyy-MM-dd'));
          }
        })
        .reduce((sum, expense) => sum + expense.amount, 0);

      return {
        name: dayName,
        sales: daySales,
        expenses: dayExpenses,
        profit: daySales - dayExpenses,
      };
    });

    // For 'day' period, don't reverse to show today's data correctly
    // For other periods, reverse to show most recent data first
    return selectedPeriod === 'day' ? chartData : chartData.reverse();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  const chartData = generateChartData();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          {user?.profile?.role !== 'admin' && userBranches.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Viewing data for:{' '}
              <span className="font-medium">{userBranches[0]?.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            disabled={
              user?.profile?.role !== 'admin' && userBranches.length <= 1
            }
          >
            <SelectTrigger className="w-48">
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

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Sales"
          value={formatCurrency(
            dashboardData?.totalSales || 0,
            currentOrganization?.currency
          )}
          change=""
          changeType="positive"
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-green-500"
        />
        <StatsCard
          title="Total Expenses"
          value={formatCurrency(
            dashboardData?.totalExpenses || 0,
            currentOrganization?.currency
          )}
          change=""
          changeType="negative"
          icon={<TrendingDown className="h-4 w-4" />}
          color="text-red-500"
        />
        <StatsCard
          title="Net Profit"
          value={formatCurrency(
            dashboardData?.netProfit || 0,
            currentOrganization?.currency
          )}
          change={
            dashboardData?.netProfit && dashboardData.netProfit > 0 ? '' : ''
          }
          changeType={
            dashboardData?.netProfit && dashboardData.netProfit > 0
              ? 'positive'
              : 'negative'
          }
          icon={<TrendingUp className="h-4 w-4" />}
          className={
            dashboardData?.netProfit && dashboardData.netProfit < 0
              ? 'border-red-200'
              : ''
          }
          color={
            dashboardData?.netProfit && dashboardData.netProfit < 0
              ? 'text-red-500'
              : 'text-green-500'
          }
        />
        <StatsCard
          title="Transactions"
          value={String(
            (dashboardData?.salesData.length || 0) +
              (dashboardData?.expensesData.length || 0)
          )}
          change="Total recorded"
          changeType="neutral"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1">
        <SalesChart data={chartData} period={selectedPeriod} />
      </div>
    </div>
  );
}

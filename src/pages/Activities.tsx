import { useState, useEffect } from 'react';
import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePresets, type DateRange } from '@/components/ui/DatePresets';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FilterIcon,
  RefreshCwIcon,
  UserIcon,
  BuildingIcon,
  ArrowLeftIcon,
  EyeIcon,
} from 'lucide-react';
import { useActivityLogs, useBranches } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { formatActivityValues } from '@/utils/activityFormatters';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';

const ACTIVITY_TYPE_COLORS = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
  export: 'bg-orange-100 text-orange-800',
  import: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
};

const ENTITY_TYPE_LABELS = {
  sale: 'Sale',
  expense: 'Expense',
  expense_category: 'Expense Category',
  user: 'User',
  organization: 'Organization',
  branch: 'Branch',
  product: 'Product',
  customer: 'Customer',
  supplier: 'Supplier',
  other: 'Other',
};

export default function Activities() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { isAuditor } = useRoleCheck();
  const [filters, setFilters] = useState({
    branchId: 'all',
    entityType: 'all',
    activityType: 'all',
    search: '',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);

  const { data: branches } = useBranches(currentOrganization?.id, user);
  const { data: activities, isLoading, error, refetch } = useActivityLogs(
    currentOrganization?.id,
    filters.branchId && filters.branchId !== 'all'
      ? filters.branchId
      : undefined,
    filters.entityType && filters.entityType !== 'all'
      ? filters.entityType
      : undefined,
    undefined, // entityId
    undefined, // saleId
    dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateRange?.to ? dateRange.to.toISOString() : undefined,
    user
  );

  // Force refetch when filters or dateRange change
  useEffect(() => {
    if (currentOrganization?.id) {
      refetch();
    }
  }, [filters, dateRange, currentOrganization?.id, refetch]);

  const userBranches = branches?.filter((branch) => branch.is_active);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      branchId: 'all',
      entityType: 'all',
      activityType: 'all',
      search: '',
    });
    setDateRange({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
  };

  const handleActivitySelect = (activity: any) => {
    setSelectedActivity(activity);
    setIsDetailView(true);
  };

  const handleBackToList = () => {
    setIsDetailView(false);
    setSelectedActivity(null);
  };

  const filteredActivities = activities?.filter((activity) => {
    if (
      filters.activityType &&
      filters.activityType !== 'all' &&
      activity.activity_type !== filters.activityType
    ) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        activity.description?.toLowerCase().includes(searchLower) ||
        activity.user_profile?.full_name?.toLowerCase().includes(searchLower) ||
        activity.entity_type.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Helper function to format activity values for display (now using utility)
  const formatActivityValuesForDisplay = (
    values: any,
    entityType?: string
  ): string => {
    return formatActivityValues(values, entityType);
  };

  const getActivityTypeColor = (type: string) => {
    return (
      ACTIVITY_TYPE_COLORS[type as keyof typeof ACTIVITY_TYPE_COLORS] ||
      ACTIVITY_TYPE_COLORS.other
    );
  };

  const getEntityTypeLabel = (type: string) => {
    return ENTITY_TYPE_LABELS[type as keyof typeof ENTITY_TYPE_LABELS] || type;
  };

  // Filter entity types for auditors
  const getAvailableEntityTypes = () => {
    if (isAuditor()) {
      // Auditors can only see sales, expenses, products, and expense categories
      return {
        sale: ENTITY_TYPE_LABELS.sale,
        expense: ENTITY_TYPE_LABELS.expense,
        product: ENTITY_TYPE_LABELS.product,
        expense_category: ENTITY_TYPE_LABELS.expense_category,
      };
    }
    return ENTITY_TYPE_LABELS;
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load activities: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render sale details in a user-friendly format
  const renderSaleDetails = (saleData: any) => {
    if (!saleData) return <p className="text-gray-500">No data available</p>;

    return (
      <div className="space-y-4">
        {/* Basic Sale Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {saleData.amount && (
            <div>
              <p className="text-sm text-gray-600">Amount</p>
              <p className="font-semibold text-lg">
                {currentOrganization?.currency || 'GH₵'}
                {Number(saleData.amount).toFixed(2)}
              </p>
            </div>
          )}
          {saleData.customer_name && (
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-medium">{saleData.customer_name}</p>
            </div>
          )}
          {saleData.sale_date && (
            <div>
              <p className="text-sm text-gray-600">Sale Date</p>
              <p className="font-medium">
                {format(new Date(saleData.sale_date), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          )}
          {saleData.branch_name && (
            <div>
              <p className="text-sm text-gray-600">Branch</p>
              <p className="font-medium">{saleData.branch_name}</p>
            </div>
          )}
        </div>

        {/* Notes */}
        {saleData.notes && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Notes</p>
            <p className="text-gray-800 bg-gray-100 p-2 rounded">
              {saleData.notes}
            </p>
          </div>
        )}

        {/* Sale Line Items */}
        {saleData.sale_line_items &&
          Array.isArray(saleData.sale_line_items) &&
          saleData.sale_line_items.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-2 font-medium">
                Items Sold
              </p>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Product
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Unit Price
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleData.sale_line_items.map(
                      (item: any, index: number) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium">
                                {item.product_name || 'Unknown Product'}
                              </p>
                              {item.description && (
                                <p className="text-xs text-gray-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.quantity || 0}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {currentOrganization?.currency || 'GH₵'}
                            {Number(item.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {currentOrganization?.currency || 'GH₵'}
                            {Number(item.total_price || 0).toFixed(2)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* Status Information */}
        {saleData.is_active !== undefined && (
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <Badge variant={saleData.is_active ? 'default' : 'destructive'}>
              {saleData.is_active ? 'Active' : 'Removed'}
            </Badge>
          </div>
        )}
      </div>
    );
  };

  // Render detailed activity view
  const renderDetailView = () => {
    if (!selectedActivity) return null;

    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={handleBackToList} variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to List
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Activity Details
              </h1>
              <p className="text-muted-foreground">
                Detailed view of activity log entry
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeIcon className="h-5 w-5" />
              Activity Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Activity Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="md:col-span-1 lg:col-span-1">
                <p className="text-sm text-gray-600 mb-1">Date & Time</p>
                <div className="font-medium min-w-[200px]">
                  {selectedActivity.created_at ? (
                    <>
                      <div className="text-muted-foreground text-sm mb-1">
                        {formatDistanceToNow(
                          new Date(selectedActivity.created_at),
                          { addSuffix: true }
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(
                          new Date(selectedActivity.created_at),
                          'MMM dd, yyyy HH:mm:ss'
                        )}
                      </div>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Performed by</p>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {selectedActivity.user_profile?.full_name || 'Unknown User'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Activity Type</p>
                <Badge
                  className={getActivityTypeColor(
                    selectedActivity.activity_type
                  )}
                >
                  {selectedActivity.activity_type}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Entity Type</p>
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {getEntityTypeLabel(selectedActivity.entity_type)}
                  </span>
                </div>
              </div>
              {selectedActivity.branch && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Branch</p>
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedActivity.branch.name}
                    </span>
                    {selectedActivity.branch.location && (
                      <span className="text-muted-foreground text-sm">
                        - {selectedActivity.branch.location}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedActivity.description && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Description</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-800">
                    {selectedActivity.description}
                  </p>
                </div>
              </div>
            )}

            {/* Sale Details Section for Sale Activities */}
            {selectedActivity.entity_type === 'sale' &&
              (selectedActivity.old_values || selectedActivity.new_values) && (
                <div>
                  <p className="text-sm text-gray-600 mb-4 font-medium">
                    Sale Details
                  </p>
                  <div className="space-y-4">
                    {selectedActivity.new_values && (
                      <div>
                        <p className="text-green-600 font-medium mb-2">
                          {selectedActivity.activity_type === 'create'
                            ? 'Sale Information:'
                            : 'Updated Values:'}
                        </p>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          {renderSaleDetails(selectedActivity.new_values)}
                        </div>
                      </div>
                    )}
                    {selectedActivity.old_values &&
                      selectedActivity.activity_type !== 'create' && (
                        <div>
                          <p className="text-red-600 font-medium mb-2">
                            Previous Values:
                          </p>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            {renderSaleDetails(selectedActivity.old_values)}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

            {/* Changes Section for Non-Sale Activities */}
            {selectedActivity.entity_type !== 'sale' &&
              (selectedActivity.old_values || selectedActivity.new_values) && (
                <div>
                  <p className="text-sm text-gray-600 mb-4 font-medium">
                    Changes Made
                  </p>
                  <div className="space-y-4">
                    {selectedActivity.old_values && (
                      <div>
                        <p className="text-red-600 font-medium mb-2">
                          Previous Values:
                        </p>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <pre className="text-sm text-red-800 whitespace-pre-wrap">
                            {formatActivityValuesForDisplay(
                              selectedActivity.old_values,
                              selectedActivity.entity_type
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                    {selectedActivity.new_values && (
                      <div>
                        <p className="text-green-600 font-medium mb-2">
                          New Values:
                        </p>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <pre className="text-sm text-green-800 whitespace-pre-wrap">
                            {formatActivityValuesForDisplay(
                              selectedActivity.new_values,
                              selectedActivity.entity_type
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Metadata */}
            {selectedActivity.metadata && (
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium">
                  Additional Information
                </p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <pre className="text-sm text-blue-800 whitespace-pre-wrap">
                    {formatActivityValuesForDisplay(selectedActivity.metadata)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Show detail view if an activity is selected
  if (isDetailView && selectedActivity) {
    return renderDetailView();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
          <p className="text-muted-foreground">
            Track all activities and changes across your organization
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCwIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter activities by date range, branch, type, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search activities..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select
                value={filters.branchId}
                onValueChange={(value) => handleFilterChange('branchId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {userBranches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select
                value={filters.entityType}
                onValueChange={(value) =>
                  handleFilterChange('entityType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {Object.entries(getAvailableEntityTypes()).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Activity Type</label>
              <Select
                value={filters.activityType}
                onValueChange={(value) =>
                  handleFilterChange('activityType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All activities</SelectItem>
                  {Object.keys(ACTIVITY_TYPE_COLORS).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePresets
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={clearFilters}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            {filteredActivities?.length || 0} activities found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredActivities?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No activities found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] min-w-[200px]">Date & Time</TableHead>
                    <TableHead>Performed by</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities?.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleActivitySelect(activity)}
                    >
                      <TableCell className="text-sm w-[200px] min-w-[200px]">
                        {activity.created_at ? (
                          <div>
                            <div className="font-medium">
                              {formatDistanceToNow(
                                new Date(activity.created_at),
                                { addSuffix: true }
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(
                                new Date(activity.created_at),
                                'MMM dd, HH:mm'
                              )}
                            </div>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {activity.user_profile?.full_name || 'Unknown User'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getActivityTypeColor(
                            activity.activity_type
                          )}
                        >
                          {activity.activity_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {getEntityTypeLabel(activity.entity_type)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p
                          className="truncate"
                          title={activity.description || undefined}
                        >
                          {activity.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        {activity.branch && (
                          <div className="flex items-center gap-2">
                            <BuildingIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {activity.branch.name}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {activity.old_values && (
                          <div className="text-sm">
                            <p
                              className="text-red-600 truncate"
                              title={
                                formatActivityValuesForDisplay(
                                  activity.old_values,
                                  activity.entity_type
                                ) || ''
                              }
                            >
                              <span className="font-medium">From:</span>{' '}
                              {formatActivityValuesForDisplay(
                                activity.old_values,
                                activity.entity_type
                              )}
                            </p>
                          </div>
                        )}
                        {activity.new_values && (
                          <div className="text-sm">
                            <p
                              className="text-green-600 truncate"
                              title={
                                formatActivityValuesForDisplay(
                                  activity.new_values,
                                  activity.entity_type
                                ) || ''
                              }
                            >
                              <span className="font-medium">To:</span>{' '}
                              {formatActivityValuesForDisplay(
                                activity.new_values,
                                activity.entity_type
                              )}
                            </p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

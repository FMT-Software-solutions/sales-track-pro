import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ChartData {
  name: string;
  sales: number;
  expenses: number;
  profit: number;
}

interface SalesChartProps {
  data: ChartData[];
  period: string;
}

export function SalesChart({ data, period }: SalesChartProps) {
  const { currentOrganization } = useOrganization();

  // Prepare data for line chart with separate positive and negative profit lines
  const lineChartData = data.map((item) => ({
    ...item,
    positiveProfit: item.profit >= 0 ? item.profit : null,
    negativeProfit: item.profit < 0 ? item.profit : null,
  }));

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Financial Overview</CardTitle>
        <CardDescription>
          Sales, expenses, and profit trends for the selected {period}
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <Tabs defaultValue="bar" className="w-full">
          <TabsList>
            <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            <TabsTrigger value="line">Line Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="bar" className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    formatCurrency(value, currentOrganization?.currency)
                  }
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value, currentOrganization?.currency),
                    name,
                  ]}
                  labelStyle={{ color: '#000' }}
                />
                <Bar dataKey="sales" fill="#3b82f6" name="Sales" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Bar dataKey="profit" name="Profit">
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="line" className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={1}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    formatCurrency(value, currentOrganization?.currency)
                  }
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (value === null) return [null, null];
                    return [
                      formatCurrency(value, currentOrganization?.currency),
                      name === 'positiveProfit' || name === 'negativeProfit'
                        ? 'Profit'
                        : name,
                    ];
                  }}
                  labelStyle={{ color: '#000' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Sales"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="positiveProfit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Profit"
                  connectNulls={false}
                  dot={{ fill: '#10b981', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="negativeProfit"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Profit"
                  connectNulls={false}
                  dot={{ fill: '#ef4444', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MultipleSaleForm } from '@/components/forms/MultipleSaleForm';
import { TrendingUp } from 'lucide-react';

export function RecordSale() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Record Sale
        </h1>
        <p className="text-muted-foreground">
          Track your daily sales and revenue across all branches
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
              New Sale Entry
            </CardTitle>
            <CardDescription>
              Enter the details of your sale transaction below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultipleSaleForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Recording Sales</h4>
              <p className="text-sm text-muted-foreground">
                Make sure to record sales as they happen to maintain accurate
                financial records.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Descriptions</h4>
              <p className="text-sm text-muted-foreground">
                Add descriptions to categorize different types of sales for
                better reporting.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Date Selection</h4>
              <p className="text-sm text-muted-foreground">
                You can backdate sales if you're entering historical data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

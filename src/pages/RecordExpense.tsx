import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { TrendingDown } from 'lucide-react';

export function RecordExpense() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Record Expense
        </h1>
        <p className="text-muted-foreground">
          Track your business expenses and operating costs across all branches
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="mr-2 h-5 w-5 text-red-600" />
              New Expense Entry
            </CardTitle>
            <CardDescription>
              Enter the details of your expense transaction below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseForm onSuccess={() => console.log('Expense recorded!')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Food & Ingredients</h4>
              <p className="text-sm text-muted-foreground">
                Raw materials, supplies, and food items for your menu.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Staff Wages</h4>
              <p className="text-sm text-muted-foreground">
                Employee salaries, hourly wages, and benefits.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Rent & Utilities</h4>
              <p className="text-sm text-muted-foreground">
                Monthly rent, electricity, water, gas, and internet bills.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Equipment</h4>
              <p className="text-sm text-muted-foreground">
                Kitchen equipment, furniture, and technology purchases.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

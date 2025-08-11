import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: ReactNode;
  className?: string;
  color?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  className,
  color,
}: StatsCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-lg md:text-2xl font-bold', color)}>
          {value}
        </div>
        {change && (
          <p
            className={cn(
              'text-xs text-muted-foreground',
              changeType === 'positive' && 'text-green-600',
              changeType === 'negative' && 'text-red-600'
            )}
          >
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

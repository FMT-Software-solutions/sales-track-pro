import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOrganization } from '@/contexts/OrganizationContext';
import { type SaleLineItem } from '@/hooks/queries';

interface SalesItemsDisplayProps {
  items: SaleLineItem[];
}

export function SalesItemsDisplay({ items }: SalesItemsDisplayProps) {
  const { currentOrganization } = useOrganization();
  const currency = currentOrganization?.currency || 'GH₵';

  if (!items || items.length === 0) {
    return <span className="text-muted-foreground">No items</span>;
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="space-y-1">
        <div className="font-medium">{item.products?.name}</div>
      </div>
    );
  }

  const firstItem = items[0];
  const remainingCount = items.length - 1;

  return (
    <div className="flex items-center gap-2">
      <div className="space-y-1">
        <div className="font-medium truncate">{firstItem.products?.name}</div>
      </div>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className='p-0'>
            <Badge variant="secondary" className='px-2'>+{remainingCount} more</Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <h4 className="font-medium">All Sale Items</h4>
            {items.map((item, index) => (
              <div key={item.id || index} className="border-b pb-2 last:border-b-0">
                <div className="font-medium text-sm">{item.products?.name}</div>
                <div className="text-xs text-muted-foreground">
                  Qty: {item.quantity} × {currency} {item.unit_price?.toFixed(2)} = {currency} {item.total_price?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
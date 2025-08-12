import React from 'react';
import { Button } from '@/components/ui/button';

import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  endOfDay,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DatePresetsProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

const presets = [
  {
    label: 'Today',
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'This week',
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'This month',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: 'This year',
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
];

export function DatePresets({
  value,
  onChange,
  placeholder = 'Select date range',
}: DatePresetsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    value
  );

  // Update tempRange when value prop changes
  React.useEffect(() => {
    setTempRange(value);
  }, [value]);

  const handlePresetSelect = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    setTempRange(range);
    onChange(range);
    setIsOpen(false);
  };

  const handleCustomRangeSelect = (
    range: { from?: Date; to?: Date } | undefined
  ) => {
    if (range?.from && range?.to) {
      const dateRange = { 
        from: startOfDay(range.from), 
        to: endOfDay(range.to) 
      };
      setTempRange(dateRange);
    } else if (range?.from) {
      setTempRange({ 
        from: startOfDay(range.from), 
        to: endOfDay(range.from) 
      });
    } else {
      setTempRange(undefined);
    }
  };

  const applyCustomRange = () => {
    if (tempRange) {
      onChange(tempRange);
    }
    setIsOpen(false);
  };

  const clearFilter = () => {
    onChange(undefined);
    setTempRange(undefined);
    setIsOpen(false);
  };

  const formatDateRange = (range: DateRange) => {
    if (format(range.from, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')) {
      return format(range.from, 'MMM dd, yyyy');
    }
    return `${format(range.from, 'MMM dd, yyyy')} - ${format(
      range.to,
      'MMM dd, yyyy'
    )}`;
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[280px] justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? formatDateRange(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r p-3 space-y-2 w-[150px]">
              <h4 className="font-medium text-sm">Quick Filters</h4>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-3">
              <h4 className="font-medium text-sm mb-2">Custom Range</h4>
              <Calendar
                mode="range"
                selected={
                  tempRange
                    ? { from: tempRange.from, to: tempRange.to }
                    : undefined
                }
                onSelect={handleCustomRangeSelect}
                numberOfMonths={2}
                className="rounded-md border"
              />
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={applyCustomRange}
                  disabled={!tempRange}
                  className="flex-1"
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearFilter}
                  className="flex-1"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

'use client';
import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function Calendar22({
  label = 'Date',
  value,
  onChange,
  id = 'date',
  className = '',
}: {
  label?: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Label htmlFor={id} className="px-1">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className="w-full justify-between font-normal"
          >
            {value ? value.toLocaleDateString() : 'Select date'}
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            captionLayout="dropdown"
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

'use client';
import * as React from 'react';
import { ChevronDownIcon, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function Calendar22({
  label = 'Date & Time',
  value,
  onChange,
  id = 'date',
  className = '',
  includeTime = true,
}: {
  label?: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  id?: string;
  className?: string;
  includeTime?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [hour, setHour] = React.useState<string>('');
  const [minute, setMinute] = React.useState<string>('');

  // Initialize time fields when value changes or component mounts
  React.useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setHour(value.getHours().toString().padStart(2, '0'));
      setMinute(value.getMinutes().toString().padStart(2, '0'));
    } else {
      setSelectedDate(undefined);
      if (includeTime) {
        // Default to current time for new entries
        const now = new Date();
        setHour(now.getHours().toString().padStart(2, '0'));
        setMinute(now.getMinutes().toString().padStart(2, '0'));
      }
    }
  }, [value, includeTime]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(undefined);
      setSelectedDate(undefined);
      return;
    }

    // Prevent future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (date > today) {
      return; // Don't allow future dates
    }

    setSelectedDate(date);
    
    if (includeTime) {
      // Combine date with current time values
      const newDateTime = new Date(date);
      const hourNum = parseInt(hour) || 0;
      const minuteNum = parseInt(minute) || 0;
      
      newDateTime.setHours(hourNum, minuteNum, 0, 0);
      
      // Check if the combined date-time is in the future
      const now = new Date();
      if (newDateTime > now) {
        // If future, set to current time
        newDateTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
        setHour(now.getHours().toString().padStart(2, '0'));
        setMinute(now.getMinutes().toString().padStart(2, '0'));
      }
      
      onChange(newDateTime);
    } else {
      onChange(date);
    }
  };

  const handleTimeChange = (newHour: string, newMinute: string) => {
    if (!selectedDate) return;

    const hourNum = parseInt(newHour) || 0;
    const minuteNum = parseInt(newMinute) || 0;

    // Validate hour and minute ranges
    if (hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
      return;
    }

    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(hourNum, minuteNum, 0, 0);

    // Check if the combined date-time is in the future
    const now = new Date();
    if (newDateTime > now) {
      return; // Don't allow future date-time
    }

    onChange(newDateTime);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHour = e.target.value;
    setHour(newHour);
    handleTimeChange(newHour, minute);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMinute = e.target.value;
    setMinute(newMinute);
    handleTimeChange(hour, newMinute);
  };

  const formatDisplayValue = () => {
    if (!value) return 'Select date & time';
    
    if (includeTime) {
      return value.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    
    return value.toLocaleDateString();
  };

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
            {formatDisplayValue()}
            {includeTime ? (
              <Clock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <div className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate || new Date()}
              captionLayout="dropdown"
              onSelect={handleDateSelect}
              disabled={(date) => {
                // Disable future dates
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                return date > today;
              }}
            />
            
            {includeTime && (
              <div className="border-t pt-3 mt-3">
                <Label className="text-sm font-medium mb-2 block">Time</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`${id}-hour`} className="text-xs text-muted-foreground">
                      Hour
                    </Label>
                    <Input
                      id={`${id}-hour`}
                      type="number"
                      min="0"
                      max="23"
                      value={hour}
                      onChange={handleHourChange}
                      className="text-center"
                      placeholder="00"
                    />
                  </div>
                  <div className="text-lg font-bold text-muted-foreground mt-4">:</div>
                  <div className="flex-1">
                    <Label htmlFor={`${id}-minute`} className="text-xs text-muted-foreground">
                      Minute
                    </Label>
                    <Input
                      id={`${id}-minute`}
                      type="number"
                      min="0"
                      max="59"
                      value={minute}
                      onChange={handleMinuteChange}
                      className="text-center"
                      placeholder="00"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const currentHour = now.getHours().toString().padStart(2, '0');
                      const currentMinute = now.getMinutes().toString().padStart(2, '0');
                      setHour(currentHour);
                      setMinute(currentMinute);
                      handleTimeChange(currentHour, currentMinute);
                    }}
                    className="w-full"
                  >
                    Set Current Time
                  </Button>
                </div>
              </div>
            )}
            
            <div className="border-t pt-3 mt-3">
              <Button
                onClick={() => setOpen(false)}
                className="w-full"
                size="sm"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

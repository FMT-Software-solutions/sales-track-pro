import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPeriodRange(
  period: string,
  referenceDate: Date = new Date()
) {
  switch (period) {
    case 'day':
      return {
        startDate: startOfDay(referenceDate),
        endDate: endOfDay(referenceDate),
      };
    case 'week':
      return {
        startDate: startOfWeek(referenceDate),
        endDate: endOfWeek(referenceDate),
      };
    case 'month':
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfMonth(referenceDate),
      };
    case 'year':
      return {
        startDate: startOfYear(referenceDate),
        endDate: endOfYear(referenceDate),
      };
    case 'all':
      return {
        startDate: undefined,
        endDate: undefined,
      };
    default:
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfMonth(referenceDate),
      };
  }
}

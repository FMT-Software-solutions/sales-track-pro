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

export function formatCurrency(value: number, currencySymbol: string = 'GH₵') {
  // Ensure the currency symbol is properly encoded
  const cleanSymbol = currencySymbol || 'GH₵';
  
  // For other currency symbols, format as number and prepend symbol
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  return `${cleanSymbol}${formattedNumber}`;
}

export function formatCurrencyForPDF(
  amount: number,
  currencySymbol?: string
): string {
  const cleanSymbol = currencySymbol || 'GH₵';
  // Remove special characters that might cause PDF encoding issues
  // Replace common currency symbols with their ASCII equivalents
  const pdfSafeSymbol = cleanSymbol
    .replace(/₵/g, 'C')  // Cedi symbol
    .replace(/₹/g, 'Rs') // Rupee symbol
    .replace(/€/g, 'EUR') // Euro symbol
    .replace(/£/g, 'GBP') // Pound symbol
    .replace(/¥/g, 'JPY') // Yen symbol
    .replace(/₦/g, 'NGN') // Naira symbol
    .replace(/₽/g, 'RUB') // Ruble symbol
    .replace(/₩/g, 'KRW') // Won symbol
    .replace(/₪/g, 'ILS') // Shekel symbol
    .replace(/₨/g, 'Rs')  // Generic Rupee
    .replace(/¢/g, 'c')   // Cent symbol
    // Remove any remaining non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '');
  
  return `${pdfSafeSymbol} ${amount.toFixed(2)}`;
}

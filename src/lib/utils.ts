
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToDDMMYYYY(dateString: string | null): string {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export function formatDisplayDate(dateString: string): string {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  
  // Add ordinal suffix to day
  const addOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return day + 'th';
    switch (day % 10) {
      case 1: return day + 'st';
      case 2: return day + 'nd';
      case 3: return day + 'rd';
      default: return day + 'th';
    }
  };

  const dayWithSuffix = addOrdinalSuffix(day);
  return `${weekday} ${dayWithSuffix} ${month} ${year}`;
}

export function formatDateToLongFormat(dateString: string): string {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  
  // Add ordinal suffix to day
  const addOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return day + 'th';
    switch (day % 10) {
      case 1: return day + 'st';
      case 2: return day + 'nd';
      case 3: return day + 'rd';
      default: return day + 'th';
    }
  };

  const dayWithSuffix = addOrdinalSuffix(day);
  return `${dayWithSuffix} ${month} ${year}`;
}

export function formatDateToMonthYear(dateString: string): string {
  if (!dateString) return 'TBD';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return 'TBD';
  
  const startFormatted = formatDisplayDate(startDate);
  const endFormatted = formatDisplayDate(endDate);
  
  return `${startFormatted} to ${endFormatted}`;
}

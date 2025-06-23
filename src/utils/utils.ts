import { add, isBefore, parseISO } from 'date-fns';

type TimeUnit = 'day' | 'week' | 'month' | 'year';

interface PeriodConfig {
  startDate: string; // YYYY-MM-DD
  frequency: number;
  unit: TimeUnit;
  referenceDate?: string | Date;
}

export function getPeriodDetails({
  startDate,
  frequency,
  unit,
  referenceDate = new Date()
}: PeriodConfig) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const ref = typeof referenceDate === 'string' ? parseISO(referenceDate) : referenceDate;

  let cursor = start;
  let periodNumber = 1;

  while (isBefore(add(cursor, { [unit + 's']: frequency }), ref)) {
    cursor = add(cursor, { [unit + 's']: frequency });
    periodNumber++;
  }

  const periodStart = cursor;
  const periodEnd = add(cursor, { [unit + 's']: frequency });

  return {
    periodNumber,
    periodStart,
    periodEnd
  };
}



export function formatDate(date: Date | string, format: string = 'yyyy-MM-dd') {
  if (typeof date === 'string') {
    date = parseISO(date);
  }
  return date.toISOString().split('T')[0]; // Simple YYYY-MM-DD format
}
export function isValidDate(date: string | Date): boolean {
  if (typeof date === 'string') {
    date = parseISO(date);
  }
  return !isNaN(date.getTime());
}
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]; // Returns current date in YYYY-MM-DD format
}
export function getCurrentDateTime(): string {
  return new Date().toISOString(); // Returns current date and time in ISO format
}
export function getNextPeriodStartDate(startDate: string, frequency: number, unit: TimeUnit): string {
  const start = parseISO(startDate);
  const nextStart = add(start, { [unit + 's']: frequency });
  return nextStart.toISOString().split('T')[0]; // Returns next period start date in YYYY-MM-DD format
}
export function getNextPeriodEndDate(startDate: string, frequency: number, unit: TimeUnit): string {
  const start = parseISO(startDate);
  const nextStart = add(start, { [unit + 's']: frequency });
  const nextEnd = add(nextStart, { [unit + 's']: frequency });
  return nextEnd.toISOString().split('T')[0]; // Returns next period end date in YYYY-MM-DD format
}
export function getPreviousPeriodStartDate(startDate: string, frequency: number, unit: TimeUnit): string {
  const start = parseISO(startDate);
  const previousStart = add(start, { [unit + 's']: -frequency });
  return previousStart.toISOString().split('T')[0]; // Returns previous period start date in YYYY-MM-DD format
}
export function getPreviousPeriodEndDate(startDate: string, frequency: number, unit: TimeUnit): string {
  const start = parseISO(startDate);
  const previousStart = add(start, { [unit + 's']: -frequency });
  const previousEnd = add(previousStart, { [unit + 's']: frequency });
  return previousEnd.toISOString().split('T')[0]; // Returns previous period end date in YYYY-MM-DD format
}
export function getPeriodDates(startDate: string, frequency: number, unit: TimeUnit): { start: string; end: string } {
  const start = parseISO(startDate);
  const end = add(start, { [unit + 's']: frequency });
  return {
    start: start.toISOString().split('T')[0], // Returns period start date in YYYY-MM-DD format
    end: end.toISOString().split('T')[0] // Returns period end date in YYYY-MM-DD format
  };
}
export function getNextPeriodDates(startDate: string, frequency: number, unit: TimeUnit): { start: string; end: string } {
  const start = parseISO(startDate);
  const nextStart = add(start, { [unit + 's']: frequency });
  const nextEnd = add(nextStart, { [unit + 's']: frequency });
  return {
    start: nextStart.toISOString().split('T')[0], // Returns next period start date in YYYY-MM-DD format
    end: nextEnd.toISOString().split('T')[0] // Returns next period end date in YYYY-MM-DD format
  };
}
export function getPreviousPeriodDates(startDate: string, frequency: number, unit: TimeUnit): { start: string; end: string } {
  const start = parseISO(startDate);
  const previousStart = add(start, { [unit + 's']: -frequency });
  const previousEnd = add(previousStart, { [unit + 's']: frequency });
  return {
    start: previousStart.toISOString().split('T')[0], // Returns previous period start date in YYYY-MM-DD format
    end: previousEnd.toISOString().split('T')[0] // Returns previous period end date in YYYY-MM-DD format
  };
}
export function getPeriodNumber(startDate: string, frequency: number, unit: TimeUnit, referenceDate: string | Date = new Date()): number {
  const { periodNumber } = getPeriodDetails({
    startDate,
    frequency,
    unit,
    referenceDate
  });
  return periodNumber;
}
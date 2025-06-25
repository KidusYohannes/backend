import { add, isBefore, parseISO, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from 'date-fns';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
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


function calculatePeriods(start: Date, end: Date, unit: string, frequency: number): number {
  switch (unit) {
    case 'day':
      return Math.floor(differenceInDays(end, start) / frequency);
    case 'week':
      return Math.floor(differenceInWeeks(end, start) / frequency);
    case 'month':
      return Math.floor(differenceInMonths(end, start) / frequency);
    case 'year':
      return Math.floor(differenceInYears(end, start) / frequency);
    default:
      throw new Error(`Unsupported unit: ${unit}`);
  }
}

export async function getCurrentPeriodNumber(mahber_id: number): Promise<number> {
  const terms = await MahberContributionTerm.findAll({
    where: { mahber_id },
    order: [['effective_from', 'ASC']]
  });

  if (terms.length === 0) throw new Error('No contribution terms found for this Mahber');

  let totalPeriods = 0;
  const now = new Date();

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const nextTerm = terms[i + 1];
    const termStart = new Date(term.effective_from);
    const termEnd = nextTerm ? new Date(nextTerm.effective_from) : now;

    // Only count periods if termStart is before now
    if (termStart >= now) break;

    const periodCount = calculatePeriods(termStart, termEnd, term.unit, term.frequency);
    totalPeriods += periodCount;
  }

  return totalPeriods;
}

import { dateToLocalStr } from './dateFormat';

type ScheduleInput = {
  fromDate?: string;
  toDate?: string;
  periodMonths?: number;
  periodDays?: number;
  installmentCount?: number;
};

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getInstallmentStartDates = (input: ScheduleInput): Date[] => {
  const count = Math.max(1, Number(input.installmentCount) || 1);
  const from = parseDate(input.fromDate);
  if (!from) return [];

  const periodMonths = Number(input.periodMonths) || 0;
  const periodDays = Number(input.periodDays) || 0;

  // Use exact month stepping when schedule is month-based.
  if (periodMonths > 0 && periodDays === 0 && periodMonths % count === 0) {
    const stepMonths = periodMonths / count;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(from);
      d.setMonth(from.getMonth() + (i * stepMonths));
      return d;
    });
  }

  const to = parseDate(input.toDate);
  if (to && to.getTime() >= from.getTime()) {
    const totalDaysInclusive = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    const daysPerInstallment = totalDaysInclusive / count;
    return Array.from({ length: count }, (_, i) => {
      const offset = Math.floor(i * daysPerInstallment);
      const d = new Date(from);
      d.setDate(from.getDate() + offset);
      return d;
    });
  }

  const totalDays = periodDays > 0 ? periodDays : 0;
  const fallbackMonths = (Number(input.periodMonths) || 12);
  // Use exact month stepping for the fallback to avoid 30-day approximation drift
  return Array.from({ length: count }, (_, i) => {
    const offset = Math.floor(i * fallbackMonths / count);
    const d = new Date(from);
    d.setMonth(from.getMonth() + offset);
    if (totalDays > 0) {
      const dayOffset = Math.floor(i * totalDays / count);
      d.setDate(d.getDate() + dayOffset);
    }
    return d;
  });
};

export const getInstallmentRange = (input: ScheduleInput, installmentNo: number): { startDate: Date; endDate: Date } => {
  const starts = getInstallmentStartDates(input);
  const count = Math.max(1, Number(input.installmentCount) || starts.length || 1);
  const safeIdx = Math.min(Math.max(0, installmentNo - 1), Math.max(0, count - 1));
  const startDate = starts[safeIdx] || parseDate(input.fromDate) || new Date();

  let endDate = new Date(startDate);
  if (safeIdx < starts.length - 1) {
    endDate = new Date(starts[safeIdx + 1]);
    endDate.setDate(endDate.getDate() - 1);
  } else {
    const to = parseDate(input.toDate);
    if (to && to.getTime() >= startDate.getTime()) {
      endDate = to;
    }
  }

  return { startDate, endDate };
};

export const getInstallmentStartDateStrings = (input: ScheduleInput): string[] => {
  return getInstallmentStartDates(input).map(dateToLocalStr);
};

/**
 * Global date formatting utility.
 * All dates across the app should use dd-mm-yyyy format.
 * 
 * IMPORTANT: Date-only strings like "2026-02-10" are parsed as LOCAL time
 * (not UTC) to avoid ±1 day timezone shifts.
 */

/**
 * Parse a date value safely, treating date-only strings (YYYY-MM-DD) as local time.
 * new Date("2026-02-10") parses as UTC midnight which shifts ±1 day in non-UTC zones.
 * This helper appends T00:00:00 to force local-time parsing.
 */
const parseLocal = (d: string | Date | number): Date => {
  if (typeof d === 'string') {
    // Date-only string like "2026-02-10" → parse as local by appending time
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return new Date(d + 'T00:00:00');
    }
    return new Date(d);
  }
  if (typeof d === 'number') return new Date(d);
  return d;
};

/** Get today's date as YYYY-MM-DD in local timezone */
export const localDateStr = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Convert a Date object to YYYY-MM-DD in local timezone (no UTC shift) */
export const dateToLocalStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Format a date as dd-mm-yyyy */
export const fmtDate = (d: string | Date | number | null | undefined): string => {
  if (!d) return '—';
  const date = parseLocal(d);
  if (isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/** Format a date+time as dd-mm-yyyy HH:mm */
export const fmtDateTime = (d: string | Date | number | null | undefined): string => {
  if (!d) return '—';
  const date = parseLocal(d);
  if (isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
};

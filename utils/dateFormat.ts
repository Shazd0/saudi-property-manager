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

/**
 * Parse for **calendar** display (fmtDate only). Strings that start with YYYY-MM-DD
 * use that calendar day at local midnight — avoids `new Date("2026-04-30T00:00:00.000Z")`
 * shifting to the previous/next local day. fmtDateTime still uses full parseLocal.
 */
const parseLocalCalendarString = (s: string): Date => {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(t + 'T00:00:00');
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(.*)$/);
  if (m) {
    const rest = m[2];
    if (rest === '' || rest[0] === 'T' || rest[0] === ' ') {
      return new Date(m[1] + 'T00:00:00');
    }
  }
  return parseLocal(t);
};

/** Get today's date as YYYY-MM-DD in local timezone */
export const localDateStr = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Contract / Firestore date fields → `YYYY-MM-DD` in local calendar (for comparisons & renewal anchors). */
export const contractDateToYmd = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : dateToLocalStr(d);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : dateToLocalStr(d);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return dateToLocalStr(v);
  if (typeof v === 'object' && v !== null) {
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') {
      try {
        const d = o.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return dateToLocalStr(d);
      } catch {
        /* ignore */
      }
    }
    const sec = typeof o.seconds === 'number' ? o.seconds : typeof o._seconds === 'number' ? o._seconds : NaN;
    if (!Number.isNaN(sec)) {
      const d = new Date(sec * 1000);
      return isNaN(d.getTime()) ? '' : dateToLocalStr(d);
    }
  }
  return '';
};

/** Convert a Date object to YYYY-MM-DD in local timezone (no UTC shift) */
export const dateToLocalStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** True if the value falls in the same calendar month as "now" (local timezone). */
export const isDateInCurrentMonth = (d: string | Date | number | null | undefined): boolean => {
  if (!d) return false;
  const date = parseLocal(d);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

/** Format a date as dd-mm-yyyy */
export const fmtDate = (d: string | Date | number | null | undefined): string => {
  if (!d) return '—';
  let date: Date;
  if (typeof d === 'string') {
    date = parseLocalCalendarString(d);
  } else if (typeof d === 'number') {
    date = new Date(d);
  } else if (d instanceof Date) {
    date = d;
  } else if (d && typeof (d as { toDate?: () => Date }).toDate === 'function') {
    try {
      const x = (d as { toDate: () => Date }).toDate();
      date = x instanceof Date && !isNaN(x.getTime()) ? x : new Date(NaN);
    } catch {
      date = new Date(NaN);
    }
  } else {
    date = new Date(NaN);
  }
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

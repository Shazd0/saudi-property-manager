/**
 * Smart ledger parser for the multi-building, multi-section accounting spreadsheet.
 *
 * The sheet layout per building block:
 *   INCOMES (left):  FLATS RENT | INTERNET | OTHER INCOME | SHOP RENT
 *   EXPENSES (right): OTHER EXPENSES | [Owner Names] | SALARY | EMPLOYEES BORROWING
 *
 * Each section has its own sub-header row (DATE, FLAT, BANK, CASH etc.)
 * and data rows ending with a TOTAL row.
 */

import * as XLSX from 'xlsx';

// ── Types ───────────────────────────────────────────────────────────────────

export type SectionKind =
  | 'FLATS_RENT'
  | 'SHOP_RENT'
  | 'INTERNET'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSES'
  | 'OWNER_EXPENSE'
  | 'SALARY'
  | 'BORROWING';

export interface ParsedRow {
  sheetName: string;
  monthLabel: string;       // e.g. "JAN-26"
  parsedDate: string;       // ISO YYYY-MM-DD
  buildingLabel: string;    // raw building name from sheet header
  section: SectionKind;
  sectionLabel: string;     // raw section header text (e.g. "RIYAS1" for owner)
  unitNumber?: string;      // FLAT/SHOP column
  category?: string;        // CATEGORY column (OTHER EXPENSES)
  details?: string;         // DETAILS or EMPLOYEES column
  amount: number;
  paymentMethod: 'BANK' | 'CASH';
  rawRow: number;           // 0-based row index in the sheet
}

export interface ParseResult {
  rows: ParsedRow[];
  buildings: string[];      // unique building labels found
  months: string[];         // unique month labels found
  sections: SectionKind[];  // unique section kinds found
  ownerLabels: string[];    // unique owner section headers
  errors: string[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const KNOWN_INCOME_SECTIONS: Record<string, SectionKind> = {
  'FLATS RENT': 'FLATS_RENT',
  'FLAT RENT': 'FLATS_RENT',
  'FLATSRENT': 'FLATS_RENT',
  'FLATRENT': 'FLATS_RENT',
  'FLATS RENTS': 'FLATS_RENT',
  'FLATSRENTS': 'FLATS_RENT',
  'INTERNET': 'INTERNET',
  'INTERNET INCOME': 'INTERNET',
  'INTERNETINCOME': 'INTERNET',
  'INTERNET PAYMENT': 'INTERNET',
  'INTERNET PAYMENTS': 'INTERNET',
  'INTERNETPAYMENT': 'INTERNET',
  'INTERNETPAYMENTS': 'INTERNET',
  'OTHER INCOME': 'OTHER_INCOME',
  'OTHERINCOME': 'OTHER_INCOME',
  'OTHER INCOMES': 'OTHER_INCOME',
  'OTHERINCOMES': 'OTHER_INCOME',
};

const KNOWN_EXPENSE_SECTIONS: Record<string, SectionKind> = {
  'OTHER EXPENSES': 'OTHER_EXPENSES',
  'OTHEREXPENSES': 'OTHER_EXPENSES',
  'OTHER EXPENSE': 'OTHER_EXPENSES',
  'OWNER SALARY': 'OWNER_EXPENSE',
  'OWNERSALARY': 'OWNER_EXPENSE',
  'OWNER SALARIES': 'OWNER_EXPENSE',
  'OWNERSALARIES': 'OWNER_EXPENSE',
  'OWNER SLARY': 'OWNER_EXPENSE',
  'OWNERSLARY': 'OWNER_EXPENSE',
  'OWNER SALRY': 'OWNER_EXPENSE',
  'OWNERSALRY': 'OWNER_EXPENSE',
  'OWNER EXPENSE': 'OWNER_EXPENSE',
  'OWNEREXPENSE': 'OWNER_EXPENSE',
  'OWNER EXPENSES': 'OWNER_EXPENSE',
  'OWNEREXPENSES': 'OWNER_EXPENSE',
  'OWNER EXPSE': 'OWNER_EXPENSE',
  'OWNEREXPSE': 'OWNER_EXPENSE',
  'OWNER EXPNSE': 'OWNER_EXPENSE',
  'OWNEREXPNSE': 'OWNER_EXPENSE',
  'OWNER EXPENCE': 'OWNER_EXPENSE',
  'OWNEREXPENCE': 'OWNER_EXPENSE',
  'SALARY': 'SALARY',
  'SALARIES': 'SALARY',
  'EMPLOYEES BORROWING': 'BORROWING',
  'EMPLOYEE BORROWING': 'BORROWING',
  'EMPLOYEESBORROWING': 'BORROWING',
};

const SHOP_RENT_PATTERN = /SHOP\s*RENT/i;

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function cellStr(val: any): string {
  if (val == null) return '';
  return String(val).trim();
}

function cellNum(val: any): number {
  if (val == null) return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const GENERIC_HEADER_NORMS = new Set([
  'INCOMES', 'INCOME', 'EXPENSES', 'EXPENSE', 'TOTAL', 'DATE', 'FLAT', 'BANK', 'CASH',
  'CATEGORY', 'DETAILS', 'DETAIL', 'EMPLOYEES', 'EMPLOYEE', 'SHOP',
]);

/** Known section titles (not owner names). Used to stop column-range bleed between sections. */
function isKnownSectionTitle(val: string): boolean {
  if (!val || val.length < 3 || val.length > 60) return false;
  const upper = val.toUpperCase().trim();
  const normed = norm(val);
  if (GENERIC_HEADER_NORMS.has(normed)) return false;
  if (upper.includes('BUILDING')) return true;
  if (KNOWN_INCOME_SECTIONS[upper] || KNOWN_INCOME_SECTIONS[normed]) return true;
  if (KNOWN_EXPENSE_SECTIONS[upper] || KNOWN_EXPENSE_SECTIONS[normed]) return true;
  if (SHOP_RENT_PATTERN.test(upper)) return true;
  if (upper.includes('INTERNET')) return true;
  if (upper.includes('FLAT') && upper.includes('RENT')) return true;
  if (upper.includes('OTHER') && (upper.includes('INCOME') || upper.includes('EXPENSE'))) return true;
  if (upper.includes('SALARY') || upper.includes('SALARIES')) return true;
  if (upper.includes('BORROWING')) return true;
  return false;
}

/** Normalized owner code, e.g. norm("Riyas 2") → "RIYAS2". */
function isRiyasOwnerNorm(n: string): boolean {
  return /^RIYAS\d+$/.test(n);
}

/** Owner expense header like RIYAS1, RIYAS 2, Riyas2 (not data names like LATHEEF). */
function isLikelyOwnerExpenseHeader(val: string): boolean {
  if (!val || val.length < 2 || val.length > 30) return false;
  const trimmed = val.trim();
  const upper = trimmed.toUpperCase();
  const normed = norm(trimmed);
  if (GENERIC_HEADER_NORMS.has(normed)) return false;
  if (isKnownSectionTitle(trimmed)) return false;
  if (parseMonthLabel(trimmed)) return false;
  if (/^\d/.test(upper)) return false;
  if (isRiyasOwnerNorm(normed)) return true;
  // RIYAS1, RIYAS 2, RIYAS-2, etc.
  if (/^RIYAS\s*[-]?\s*\d+$/i.test(trimmed)) return true;
  // Other short owner codes: letters + one/two digit suffix (e.g. OWNER1), not building labels like JEDHAH-104.
  if (/^[A-Z]{2,12}\s?\d{1,2}$/i.test(trimmed)) return true;
  return false;
}

/** Sub-header row for owner blocks (DATE + DETAILS + BANK/CASH), not OTHER EXPENSES (has CATEGORY). */
function isOwnerStyleSubheaderRow(row: any[]): boolean {
  if (!row) return false;
  let hasDetails = false;
  let hasCategory = false;
  let dateCount = 0;
  for (let c = 0; c < row.length; c++) {
    const h = norm(cellStr(row[c]));
    if (h === 'DATE') dateCount++;
    if (h === 'DETAILS' || h === 'DETAIL') hasDetails = true;
    if (h === 'CATEGORY') hasCategory = true;
  }
  return dateCount >= 1 && hasDetails && !hasCategory;
}

function rowHasAccountingHeaders(row: any[], colStart: number, colEnd: number): boolean {
  if (!row) return false;
  let hasLabel = false;
  let hasMoney = false;
  for (let c = colStart; c <= colEnd && c < row.length; c++) {
    const h = norm(cellStr(row[c]));
    if (!h) continue;
    if (h === 'DATE' || h === 'DETAILS' || h === 'DETAIL' || h === 'FLAT' || h === 'SHOP') hasLabel = true;
    if (h === 'BANK' || h === 'CASH') hasMoney = true;
  }
  return hasLabel && hasMoney;
}

/** Column range for an owner block — width from sub-header rows, not the title row. */
function findOwnerColumnRange(grid: any[][], ownerRow: number, ownerCol: number): { start: number; end: number } {
  const start = ownerCol;
  let end = ownerCol;

  for (let r = ownerRow; r <= ownerRow + 3 && r < grid.length; r++) {
    const rowData = grid[r];
    if (!rowData) continue;
    let gapRun = 0;
    let sawDate = false;
    for (let c = ownerCol; c < Math.min(ownerCol + 12, rowData.length); c++) {
      const raw = cellStr(rowData[c]);
      const h = norm(raw);
      if (!h) {
        gapRun++;
        if (gapRun >= 2 && end > start) break;
        continue;
      }
      gapRun = 0;
      // Another owner/section title to the right = stop
      if (c > ownerCol && r === ownerRow && isLikelyOwnerExpenseHeader(raw)) break;
      if (c > ownerCol && r === ownerRow && isKnownSectionTitle(raw)) break;
      // Second DATE = next owner block (RIYAS2) on the same sub-header row
      if (h === 'DATE') {
        if (sawDate && c > ownerCol) break;
        sawDate = true;
        end = Math.max(end, c);
        continue;
      }
      if (['DETAILS', 'DETAIL', 'BANK', 'CASH', 'FLAT', 'SHOP'].includes(h)) {
        end = Math.max(end, c);
      }
    }
  }

  return { start, end: Math.max(end, start + 2) };
}

/** Look for owner name 1–2 rows above a DATE/BANK/CASH sub-header block */
function findOwnerLabelAbove(
  grid: any[][],
  subHeaderRow: number,
  colStart: number,
  colEnd: number,
): string | null {
  for (let r = Math.max(0, subHeaderRow - 2); r < subHeaderRow; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = colStart; c <= colEnd + 2 && c < row.length; c++) {
      const v = cellStr(row[c]);
      if (isLikelyOwnerExpenseHeader(v)) return v;
    }
  }
  return null;
}

/** When the sheet has two owner DATE blocks but only one title cell (merged), infer RIYAS2 etc. */
function inferOwnerLabelForBlock(
  blockIndex: number,
  priorLabels: string[],
): string {
  const riyasNums = priorLabels
    .map(l => {
      const m = norm(l).match(/^RIYAS(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const used = new Set(riyasNums);
  if (blockIndex > 0 && used.has(1) && !used.has(2)) return 'RIYAS2';
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) return `RIYAS${n}`;
  }
  return `RIYAS${blockIndex + 1}`;
}

/**
 * Side-by-side RIYAS1 | RIYAS2 often share one sub-header row with two DATE columns.
 * If RIYAS2's title cell is empty/merged, only the first owner is found — split by DATE columns.
 */
function ownerSectionCoversMoneyColumn(
  sections: DetectedSection[],
  subHeaderRow: number,
  bankCol: number | undefined,
  cashCol: number | undefined,
): boolean {
  return sections.some(sec => {
    if (sec.kind !== 'OWNER_EXPENSE' || sec.dataStartRow - 1 !== subHeaderRow) return false;
    if (bankCol != null && sec.cols.bank === bankCol) return true;
    if (cashCol != null && sec.cols.cash === cashCol) return true;
    return false;
  });
}

function discoverOwnerSectionsFromDateColumns(
  grid: any[][],
  startRow: number,
  endRow: number,
  sections: DetectedSection[],
  claimedPositions: Set<string>,
) {
  for (let r = startRow; r <= endRow && r < grid.length; r++) {
    const row = grid[r];
    if (!row || !isOwnerStyleSubheaderRow(row)) continue;

    const dateCols: number[] = [];
    for (let c = 0; c < row.length; c++) {
      if (norm(cellStr(row[c])) === 'DATE') dateCols.push(c);
    }
    if (dateCols.length < 2) continue;

    const labelsSoFar: string[] = [];

    for (let i = 0; i < dateCols.length; i++) {
      const dateCol = dateCols[i];
      const nextDateCol = dateCols[i + 1];
      const blockEnd = nextDateCol != null ? nextDateCol - 1 : Math.min(dateCol + 7, row.length - 1);

      let hasBankOrCash = false;
      for (let c = dateCol; c <= blockEnd && c < row.length; c++) {
        const h = norm(cellStr(row[c]));
        if (h === 'BANK' || h === 'CASH') hasBankOrCash = true;
      }
      if (!hasBankOrCash) continue;

      const cols = mapColumns(row, dateCol, blockEnd);
      if (cols.bank == null && cols.cash == null) continue;

      if (ownerSectionCoversMoneyColumn(sections, r, cols.bank, cols.cash)) continue;

      let label = findOwnerLabelAbove(grid, r, dateCol, blockEnd);
      if (!label) {
        label = inferOwnerLabelForBlock(
          i,
          [...labelsSoFar, ...sections.filter(s => s.kind === 'OWNER_EXPENSE').map(s => s.label)],
        );
      }
      labelsSoFar.push(label);

      const headerRow = Math.max(0, r - 1);
      const claimKey = `${r}:${dateCol}:${norm(label)}`;
      if (claimedPositions.has(claimKey)) continue;

      sections.push({
        kind: 'OWNER_EXPENSE',
        label,
        headerRow,
        colStart: dateCol,
        dataStartRow: r + 1,
        cols,
      });
      claimedPositions.add(claimKey);
      claimedPositions.add(sectionClaimKey(headerRow, dateCol, label));
    }
  }
}

/** Unique key per section header cell (multiple owner columns on one row stay distinct). */
function sectionClaimKey(headerRow: number, colStart: number, label: string): string {
  return `${headerRow}:${colStart}:${norm(label)}`;
}

/** Parse month label like "JAN-26" → { month: 1, year: 2026 } */
function parseMonthLabel(label: string): { month: number; year: number } | null {
  const m = label.match(/([A-Z]{3})\D*(\d{2,4})/i);
  if (!m) return null;
  const month = MONTH_MAP[m[1].toUpperCase()];
  if (!month) return null;
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return { month, year };
}

/**
 * Parse a date cell value. Handles:
 *  - Excel serial dates (numbers)
 *  - "2-Jan-26", "27-jan-26", "6-jan-26"
 *  - Already ISO strings
 * Falls back to using the sheet's month context.
 */
function parseDate(val: any, monthCtx: { month: number; year: number } | null): string | null {
  if (val == null || val === '') return null;

  // Excel serial number
  if (typeof val === 'number' && val > 30000) {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  const s = String(val).trim();
  if (!s) return null;

  // "2-Jan-26" or "27-jan-26" or "6-Jan-2026"
  const m1 = s.match(/^(\d{1,2})\W+([A-Za-z]{3})\W+(\d{2,4})$/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const mon = MONTH_MAP[m1[2].toUpperCase()];
    let yr = parseInt(m1[3], 10);
    if (yr < 100) yr += 2000;
    if (mon && day) return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // ISO "YYYY-MM-DD"
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;

  // Numeric local dates. Saudi ledgers commonly use DD-MM-YYYY.
  const m3 = s.match(/^(\d{1,2})\W+(\d{1,2})\W+(\d{2,4})$/);
  if (m3) {
    const first = parseInt(m3[1], 10);
    const second = parseInt(m3[2], 10);
    let yr = parseInt(m3[3], 10);
    if (yr < 100) yr += 2000;

    const day = first;
    const mon = second;
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Just a day number — use month context
  const dayOnly = parseInt(s, 10);
  if (dayOnly > 0 && dayOnly <= 31 && monthCtx) {
    return `${monthCtx.year}-${String(monthCtx.month).padStart(2, '0')}-${String(dayOnly).padStart(2, '0')}`;
  }

  return null;
}

function isBlankRow(row: any[], startCol: number, endCol: number): boolean {
  for (let c = startCol; c <= endCol && c < row.length; c++) {
    if (cellStr(row[c]) !== '') return false;
  }
  return true;
}

// ── Section detection ───────────────────────────────────────────────────────

interface DetectedSection {
  kind: SectionKind;
  label: string;
  headerRow: number;     // row index of the section title
  colStart: number;
  dataStartRow: number;  // first data row (after column header row)
  cols: {
    date?: number;
    unit?: number;        // FLAT or SHOP column
    bank?: number;
    cash?: number;
    category?: number;
    details?: number;
    employees?: number;
  };
}

/** Identify columns by scanning the sub-header row.
 *  Uses first-match semantics so adjacent sections' columns don't overwrite. */
function mapColumns(row: any[], startCol: number, endCol: number) {
  const cols: DetectedSection['cols'] = {};
  for (let c = startCol; c <= endCol && c < row.length; c++) {
    const h = norm(cellStr(row[c]));
    if (h === 'DATE' && cols.date == null) cols.date = c;
    else if ((h === 'FLAT' || h === 'SHOP') && cols.unit == null) cols.unit = c;
    else if (h === 'BANK' && cols.bank == null) cols.bank = c;
    else if (h === 'CASH' && cols.cash == null) cols.cash = c;
    else if (h === 'CATEGORY' && cols.category == null) cols.category = c;
    else if ((h === 'DETAILS' || h === 'DETAIL') && cols.details == null) cols.details = c;
    else if ((h === 'EMPLOYEES' || h === 'EMPLOYEE') && cols.employees == null) cols.employees = c;
  }
  return cols;
}

// ── Main parse function ─────────────────────────────────────────────────────

export function parseWorkbook(buffer: ArrayBuffer): ParseResult {
  extractedRowKeys = new Set<string>();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const result: ParseResult = { rows: [], buildings: [], months: [], sections: [], ownerLabels: [], errors: [] };

  for (const sheetName of wb.SheetNames) {
    try {
      const ws = wb.Sheets[sheetName];
      const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
      parseOneSheet(grid, sheetName, result);
    } catch (e: any) {
      result.errors.push(`Error parsing sheet "${sheetName}": ${e.message || e}`);
    }
  }

  result.buildings = [...new Set(result.rows.map(r => r.buildingLabel))];
  result.months = [...new Set(result.rows.map(r => r.monthLabel))];
  result.sections = [...new Set(result.rows.map(r => r.section))];
  result.ownerLabels = [...new Set(result.rows.filter(r => r.section === 'OWNER_EXPENSE').map(r => r.sectionLabel))];

  return result;
}

function parseOneSheet(grid: any[][], sheetName: string, result: ParseResult) {
  if (grid.length < 3) return;

  // Try to parse month from sheet name
  const monthFromName = parseMonthLabel(sheetName);
  const monthLabel = monthFromName ? `${Object.keys(MONTH_MAP).find(k => MONTH_MAP[k] === monthFromName.month)}-${String(monthFromName.year).slice(-2)}` : sheetName;

  // Step 1: Find building headers and all sections
  const buildingBlocks = findBuildingBlocks(grid);

  if (buildingBlocks.length === 0) {
    // Treat entire sheet as one building block
    buildingBlocks.push({ label: sheetName, startRow: 0, endRow: grid.length - 1 });
  }

  for (const block of buildingBlocks) {
    // Try parse month from building header (e.g. "JEDHAH BUILDING .JAN-26")
    const headerMonthCtx = parseMonthLabel(block.label) || monthFromName;
    const effectiveMonthLabel = headerMonthCtx
      ? `${Object.keys(MONTH_MAP).find(k => MONTH_MAP[k] === headerMonthCtx.month)}-${String(headerMonthCtx.year).slice(-2)}`
      : monthLabel;

    const cleanBuildingLabel = block.label
      .replace(/\.\s*[A-Z]{3}\W*\d{2,4}/i, '')  // remove ".JAN-26"
      .replace(/\s+/g, ' ')
      .trim();

    const sections = findSections(grid, block.startRow, block.endRow);

    for (const sec of sections) {
      let effectiveBuildingLabel = cleanBuildingLabel;

      // SHOP_RENT gets its own building label (e.g. "JEDHAH SHOP" or "JEDDAH BUILDING SHOP")
      if (sec.kind === 'SHOP_RENT') {
        const shopName = sec.label
          .replace(/\s*RENT\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        // If the label after removing "RENT" is just "SHOP", use parent building + SHOP
        effectiveBuildingLabel = (shopName && shopName.toUpperCase() !== 'SHOP')
          ? shopName
          : cleanBuildingLabel.replace(/\s*BUILDING\s*/i, '').trim() + ' SHOP';
      }

      extractRows(grid, sec, sheetName, effectiveMonthLabel, effectiveBuildingLabel, headerMonthCtx, result);
    }
  }
}

// ── Building block detection ────────────────────────────────────────────────

interface BuildingBlock {
  label: string;
  startRow: number;
  endRow: number;
}

function findBuildingBlocks(grid: any[][]): BuildingBlock[] {
  const blocks: BuildingBlock[] = [];

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;

    // A building header is typically in the first few columns, contains "BUILDING"
    // or is followed by "INCOMES" / "EXPENSES" on the next row
    for (let c = 0; c < Math.min(row.length, 15); c++) {
      const val = cellStr(row[c]);
      if (!val) continue;
      const upper = val.toUpperCase();

      if (upper.includes('BUILDING') && !upper.includes('TOTAL')) {
        // Check if next row has INCOMES or EXPENSES
        const nextRow = grid[r + 1] || grid[r + 2];
        const hasIncomeExpense = nextRow && nextRow.some((cell: any) => {
          const v = norm(cellStr(cell));
          return v === 'INCOMES' || v === 'INCOME' || v === 'EXPENSES' || v === 'EXPENSE';
        });

        if (hasIncomeExpense || upper.match(/\.\s*[A-Z]{3}/i)) {
          // Close previous block
          if (blocks.length > 0) {
            blocks[blocks.length - 1].endRow = r - 1;
          }
          blocks.push({ label: val, startRow: r, endRow: grid.length - 1 });
          break;
        }
      }
    }
  }

  return blocks;
}

// ── Section detection within a building block ───────────────────────────────

function findSections(grid: any[][], startRow: number, endRow: number): DetectedSection[] {
  const sections: DetectedSection[] = [];
  // Track claimed row+col to avoid detecting same section from adjacent cells
  const claimedPositions = new Set<string>();

  for (let r = startRow; r <= endRow && r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const val = cellStr(row[c]);
      if (!val || val.length < 3 || val.length > 60) continue;

      const upper = val.toUpperCase().trim();
      const normed = norm(val);

      // Skip generic headers
      if (['INCOMES', 'INCOME', 'EXPENSES', 'EXPENSE', 'TOTAL', 'DATE', 'FLAT', 'BANK', 'CASH', 'CATEGORY', 'DETAILS', 'EMPLOYEES', 'EMPLOYEE', 'SHOP'].includes(normed)) continue;
      if (upper.includes('BUILDING')) continue;
      if (/^\d/.test(upper)) continue; // starts with number = data row

      // Skip if this row+col area is already claimed
      const posKey = `${r}:${c}`;
      if (claimedPositions.has(posKey)) continue;

      let detected = false;

      // Check SHOP RENT pattern (may have building prefix like "JEDHAH SHOP RENT")
      if (SHOP_RENT_PATTERN.test(upper)) {
        const colRange = findColumnRange(grid, r, c);
        const subHeaderRow = findSubHeaderRow(grid, r, colRange.start, colRange.end, endRow);
        if (subHeaderRow >= 0) {
          // Check we haven't already detected a section at this dataStartRow+colStart
          const claimKey = sectionClaimKey(r, colRange.start, val);
          if (!claimedPositions.has(claimKey)) {
            const cols = mapColumns(grid[subHeaderRow], colRange.start, colRange.end);
            sections.push({ kind: 'SHOP_RENT', label: val, headerRow: r, colStart: colRange.start, dataStartRow: subHeaderRow + 1, cols });
            claimedPositions.add(claimKey);
            claimedPositions.add(posKey);
            detected = true;
          }
        }
        if (detected) continue;
      }

      // Check known income sections
      const incomeKind = KNOWN_INCOME_SECTIONS[upper] || KNOWN_INCOME_SECTIONS[normed];
      if (incomeKind) {
        const colRange = findColumnRange(grid, r, c);
        const subHeaderRow = findSubHeaderRow(grid, r, colRange.start, colRange.end, endRow);
        if (subHeaderRow >= 0) {
          const claimKey = sectionClaimKey(r, colRange.start, val);
          if (!claimedPositions.has(claimKey)) {
            const cols = mapColumns(grid[subHeaderRow], colRange.start, colRange.end);
            sections.push({ kind: incomeKind, label: val, headerRow: r, colStart: colRange.start, dataStartRow: subHeaderRow + 1, cols });
            claimedPositions.add(claimKey);
            claimedPositions.add(posKey);
          }
        }
        continue;
      }

      // Check known expense sections
      const expenseKind = KNOWN_EXPENSE_SECTIONS[upper] || KNOWN_EXPENSE_SECTIONS[normed];
      if (expenseKind) {
        const colRange = findColumnRange(grid, r, c);
        const subHeaderRow = findSubHeaderRow(grid, r, colRange.start, colRange.end, endRow);
        if (subHeaderRow >= 0) {
          const claimKey = sectionClaimKey(r, colRange.start, val);
          if (!claimedPositions.has(claimKey)) {
            const cols = mapColumns(grid[subHeaderRow], colRange.start, colRange.end);
            sections.push({ kind: expenseKind, label: val, headerRow: r, colStart: colRange.start, dataStartRow: subHeaderRow + 1, cols });
            claimedPositions.add(claimKey);
            claimedPositions.add(posKey);
          }
        }
        continue;
      }

      // Partial matching fallback — catch variations like "INTERNET COLLECTION", "FLAT RENTS", etc.
      let partialKind: SectionKind | null = null;
      if (upper.includes('INTERNET'))                                 partialKind = 'INTERNET';
      else if (upper.includes('FLAT') && upper.includes('RENT'))      partialKind = 'FLATS_RENT';
      else if (upper.includes('OTHER') && upper.includes('INCOME'))   partialKind = 'OTHER_INCOME';
      else if (upper.includes('OTHER') && upper.includes('EXPENSE'))  partialKind = 'OTHER_EXPENSES';
      else if (upper.includes('OWNER') && (upper.includes('SALARY') || upper.includes('SALARIES') || upper.includes('SLARY') || upper.includes('SALRY') || upper.includes('EXPENSE') || upper.includes('EXPSE') || upper.includes('EXPNSE') || upper.includes('EXPENCE'))) partialKind = 'OWNER_EXPENSE';
      else if (upper.includes('SALARY') || upper.includes('SALARIES'))partialKind = 'SALARY';
      else if (upper.includes('BORROWING'))                           partialKind = 'BORROWING';

      if (partialKind) {
        const colRange = findColumnRange(grid, r, c);
        const subHeaderRow = findSubHeaderRow(grid, r, colRange.start, colRange.end, endRow);
        if (subHeaderRow >= 0) {
          const claimKey = sectionClaimKey(r, colRange.start, val);
          if (!claimedPositions.has(claimKey)) {
            const cols = mapColumns(grid[subHeaderRow], colRange.start, colRange.end);
            sections.push({ kind: partialKind, label: val, headerRow: r, colStart: colRange.start, dataStartRow: subHeaderRow + 1, cols });
            claimedPositions.add(claimKey);
            claimedPositions.add(posKey);
          }
        }
        continue;
      }

      // Owner expense columns (RIYAS1, RIYAS 2, …)
      if (isLikelyOwnerExpenseHeader(val)) {
        pushOwnerExpenseSection(grid, r, c, val, endRow, sections, claimedPositions);
      }
    }
  }

  // Second pass: catch owner blocks missed by column-order / merged-cell quirks
  for (let r = startRow; r <= endRow && r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = cellStr(row[c]);
      if (!isLikelyOwnerExpenseHeader(val)) continue;
      const claimKey = sectionClaimKey(r, c, val);
      if (claimedPositions.has(claimKey)) continue;
      pushOwnerExpenseSection(grid, r, c, val, endRow, sections, claimedPositions);
    }
  }

  // Third pass: split side-by-side owner blocks that share one sub-header row (two DATE columns)
  discoverOwnerSectionsFromDateColumns(grid, startRow, endRow, sections, claimedPositions);

  return sections;
}

function pushOwnerExpenseSection(
  grid: any[][],
  r: number,
  c: number,
  val: string,
  endRow: number,
  sections: DetectedSection[],
  claimedPositions: Set<string>,
) {
  const colRange = findOwnerColumnRange(grid, r, c);
  let subHeaderRow = findSubHeaderRow(grid, r, colRange.start, colRange.end, endRow, true);
  if (subHeaderRow < 0) subHeaderRow = findSubHeaderRowBelowOwner(grid, r, c, endRow);
  if (subHeaderRow < 0) return;

  const claimKey = sectionClaimKey(r, colRange.start, val);
  if (claimedPositions.has(claimKey)) return;

  const cols = mapColumns(grid[subHeaderRow], colRange.start, colRange.end);
  if (cols.bank == null && cols.cash == null) return;

  sections.push({
    kind: 'OWNER_EXPENSE',
    label: val,
    headerRow: r,
    colStart: colRange.start,
    dataStartRow: subHeaderRow + 1,
    cols,
  });
  claimedPositions.add(claimKey);
  claimedPositions.add(`${r}:${c}`);
}

/** Estimate column range for a section starting at given cell.
 *  Stops at gaps or the next section title (e.g. adjacent RIYAS1 / RIYAS2 owner blocks). */
function findColumnRange(grid: any[][], row: number, col: number): { start: number; end: number } {
  const start = col;
  let end = col;

  // Title row: do not extend into the next section header (common for side-by-side owners)
  const titleRow = grid[row];
  if (titleRow) {
    for (let c = col + 1; c < Math.min(col + 12, titleRow.length); c++) {
      const v = cellStr(titleRow[c]);
      if (!v) {
        if (c - end > 1) break;
        continue;
      }
      if (isKnownSectionTitle(v) || isLikelyOwnerExpenseHeader(v)) break;
      end = c;
    }
  }

  // Sub-header row(s): extend only across this block's DATE / BANK / CASH columns
  for (let r = row + 1; r <= row + 2 && r < grid.length; r++) {
    const rowData = grid[r];
    if (!rowData) continue;
    let sawDate = false;
    let gapRun = 0;
    for (let c = start; c < Math.min(start + 10, rowData.length); c++) {
      const h = norm(cellStr(rowData[c]));
      if (!h) {
        gapRun++;
        if (gapRun >= 2 && end > start) break;
        continue;
      }
      gapRun = 0;
      // Second DATE column = next section's sub-header
      if (h === 'DATE') {
        if (sawDate && c > start) break;
        sawDate = true;
        end = Math.max(end, c);
        continue;
      }
      if (['BANK', 'CASH', 'FLAT', 'SHOP', 'DETAILS', 'DETAIL', 'CATEGORY', 'EMPLOYEES', 'EMPLOYEE'].includes(h)) {
        end = Math.max(end, c);
      }
    }
  }

  return { start, end: Math.max(end, start + 2) };
}

/** Find the sub-header row (DATE, BANK, CASH etc.) within a few rows after the section title */
function findSubHeaderRow(
  grid: any[][],
  titleRow: number,
  colStart: number,
  colEnd: number,
  maxRow: number,
  ownerExpense = false,
): number {
  for (let r = titleRow; r <= Math.min(titleRow + 4, maxRow) && r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    let hasDateOrDetails = false;
    let hasBankOrCash = false;
    for (let c = colStart; c <= colEnd && c < row.length; c++) {
      const h = norm(cellStr(row[c]));
      if (h === 'DATE' || h === 'DETAILS' || h === 'DETAIL' || h === 'EMPLOYEES' || h === 'EMPLOYEE') hasDateOrDetails = true;
      if (h === 'BANK' || h === 'CASH') hasBankOrCash = true;
    }
    if (ownerExpense) {
      if ((hasDateOrDetails || hasBankOrCash) && hasBankOrCash) return r;
      if (rowHasAccountingHeaders(row, colStart, colEnd)) return r;
    } else if (hasDateOrDetails && hasBankOrCash) {
      return r;
    }
  }
  return -1;
}

/** Owner title is usually on the row directly above DATE / BANK / CASH headers */
function findSubHeaderRowBelowOwner(grid: any[][], ownerRow: number, ownerCol: number, maxRow: number): number {
  const r = ownerRow + 1;
  if (r > maxRow || r >= grid.length) return -1;
  const row = grid[r];
  if (!row) return -1;
  for (let c = ownerCol; c < Math.min(ownerCol + 10, row.length); c++) {
    const h = norm(cellStr(row[c]));
    if (h === 'DATE' || h === 'DETAILS' || h === 'DETAIL' || h === 'BANK' || h === 'CASH') return r;
  }
  return -1;
}

// ── Row extraction ──────────────────────────────────────────────────────────

/** Check if TOTAL appears within a specific column range */
function isTotalInRange(row: any[], colStart: number, colEnd: number): boolean {
  for (let c = colStart; c <= colEnd && c < row.length; c++) {
    if (norm(cellStr(row[c])) === 'TOTAL') return true;
  }
  return false;
}

// Set to prevent same raw row being extracted by multiple overlapping sections (reset per parse call)
let extractedRowKeys = new Set<string>();

function extractRows(
  grid: any[][],
  sec: DetectedSection,
  sheetName: string,
  monthLabel: string,
  buildingLabel: string,
  monthCtx: { month: number; year: number } | null,
  result: ParseResult,
) {
  const { cols } = sec;
  const colEnd = Math.max(
    cols.date ?? sec.colStart, cols.unit ?? sec.colStart, cols.bank ?? sec.colStart,
    cols.cash ?? sec.colStart, cols.category ?? sec.colStart, cols.details ?? sec.colStart,
    cols.employees ?? sec.colStart,
  );

  for (let r = sec.dataStartRow; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;

    // Stop at TOTAL row within THIS section's columns
    if (isTotalInRange(row, sec.colStart, colEnd)) break;

    // Read amounts early so owner data rows like "Owner Salary" do not look like section headers.
    const bankAmt = cols.bank != null ? cellNum(row[cols.bank]) : 0;
    const cashAmt = cols.cash != null ? cellNum(row[cols.cash]) : 0;
    const amount = bankAmt || cashAmt;

    // Owner blocks stacked vertically: stop at the next owner / section title.
    // Only header-looking rows with no money should stop the block.
    if (sec.kind === 'OWNER_EXPENSE') {
      let endOwnerBlock = false;
      if (amount === 0) {
        for (let c = sec.colStart; c <= colEnd && c < row.length; c++) {
          const cell = cellStr(row[c]);
          if (isLikelyOwnerExpenseHeader(cell) && norm(cell) !== norm(sec.label)) {
            endOwnerBlock = true;
            break;
          }
          if (isKnownSectionTitle(cell)) {
            endOwnerBlock = true;
            break;
          }
        }
      }
      if (endOwnerBlock) break;
    }
    if (isBlankRow(row, sec.colStart, colEnd)) {
      // Allow up to 1 blank row, but 2+ means section ended
      if (r + 1 < grid.length && isBlankRow(grid[r + 1] || [], sec.colStart, colEnd)) break;
      continue;
    }

    if (amount === 0) continue;

    // Deduplicate: prevent same row from being extracted by multiple sections
    // Key includes the bank/cash column position to allow side-by-side sections on same row
    const amtCol = bankAmt > 0 ? (cols.bank ?? -1) : (cols.cash ?? -1);
    const rowKey = `${sheetName}:${r}:${amtCol}`;
    if (extractedRowKeys.has(rowKey)) continue;
    extractedRowKeys.add(rowKey);

    // Parse date
    const dateVal = cols.date != null ? row[cols.date] : null;
    const parsedDate = parseDate(dateVal, monthCtx);
    if (!parsedDate) {
      // For OTHER INCOME, date column may not exist — use month context
      if (sec.kind === 'OTHER_INCOME' && monthCtx) {
        // Skip if no date at all
      } else {
        continue;
      }
    }

    const finalDate = parsedDate || (monthCtx ? `${monthCtx.year}-${String(monthCtx.month).padStart(2, '0')}-01` : '');
    if (!finalDate) continue;

    const parsed: ParsedRow = {
      sheetName,
      monthLabel,
      parsedDate: finalDate,
      buildingLabel,
      section: sec.kind,
      sectionLabel: sec.label,
      unitNumber: cols.unit != null ? cellStr(row[cols.unit]) || undefined : undefined,
      category: cols.category != null ? cellStr(row[cols.category]) || undefined : undefined,
      details: (cols.details != null ? cellStr(row[cols.details]) : '') ||
               (cols.employees != null ? cellStr(row[cols.employees]) : '') ||
               undefined,
      amount,
      paymentMethod: bankAmt > 0 ? 'BANK' : 'CASH',
      rawRow: r,
    };

    result.rows.push(parsed);
  }
}

import * as XLSX from 'xlsx';
import { ParsedRow, ParseResult, SectionKind } from './sheetLedgerParser';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'parseddate'],
  building: ['building', 'building name', 'property'],
  section: ['section', 'type', 'transaction type'],
  unit: ['unit', 'unit number', 'flat', 'shop'],
  details: ['details', 'description', 'notes'],
  category: ['category', 'expense category'],
  amount: ['amount', 'value', 'total'],
  paymentMethod: ['payment method', 'method', 'payment', 'cash/bank'],
};

function norm(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cellText(value: any): string {
  if (value == null) return '';
  return String(value).trim();
}

function excelDateToIso(value: any): string {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const text = cellText(value);
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? `20${dmy[3].padStart(2, '0')}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return text;
}

function sectionFromText(value: string): SectionKind {
  const n = norm(value);
  if (n.includes('shop')) return 'SHOP_RENT';
  if (n.includes('internet')) return 'INTERNET';
  if (n.includes('salary')) return 'SALARY';
  if (n.includes('borrow')) return 'BORROWING';
  if (n.includes('owner')) return 'OWNER_EXPENSE';
  if (n.includes('expense')) return 'OTHER_EXPENSES';
  if (n.includes('income')) return 'OTHER_INCOME';
  return 'FLATS_RENT';
}

function findHeaderIndex(headers: string[], key: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[key];
  return headers.findIndex(header => aliases.includes(norm(header)));
}

function getHeaderMap(rows: any[][]): { rowIndex: number; indexes: Record<string, number> } | null {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const headers = (rows[r] || []).map(cellText);
    const indexes = Object.keys(HEADER_ALIASES).reduce<Record<string, number>>((acc, key) => {
      acc[key] = findHeaderIndex(headers, key as keyof typeof HEADER_ALIASES);
      return acc;
    }, {});
    if (indexes.date >= 0 && indexes.amount >= 0 && indexes.building >= 0) return { rowIndex: r, indexes };
  }
  return null;
}

export function isAmlakEasyWorkbook(buffer: ArrayBuffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    return wb.SheetNames.some(name => {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true });
      return !!getHeaderMap(rows);
    });
  } catch {
    return false;
  }
}

export function parseAmlakEasyWorkbook(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rowsOut: ParsedRow[] = [];
  const errors: string[] = [];

  wb.SheetNames.forEach(sheetName => {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], { header: 1, raw: true });
    const headerMap = getHeaderMap(rows);
    if (!headerMap) return;
    const { rowIndex, indexes } = headerMap;
    for (let r = rowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const amount = Number(String(row[indexes.amount] ?? '').replace(/,/g, ''));
      const date = excelDateToIso(row[indexes.date]);
      const buildingLabel = cellText(row[indexes.building]);
      if (!buildingLabel && !amount && !date) continue;
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(`${sheetName}: row ${r + 1} has invalid amount`);
        continue;
      }
      if (!buildingLabel || !date) {
        errors.push(`${sheetName}: row ${r + 1} is missing date or building`);
        continue;
      }
      const section = sectionFromText(cellText(row[indexes.section]));
      const methodText = norm(cellText(row[indexes.paymentMethod]));
      rowsOut.push({
        sheetName,
        monthLabel: sheetName,
        parsedDate: date,
        buildingLabel,
        section,
        sectionLabel: cellText(row[indexes.section]) || section,
        unitNumber: indexes.unit >= 0 ? cellText(row[indexes.unit]) : undefined,
        category: indexes.category >= 0 ? cellText(row[indexes.category]) : undefined,
        details: indexes.details >= 0 ? cellText(row[indexes.details]) : undefined,
        amount,
        paymentMethod: methodText.includes('cash') ? 'CASH' : 'BANK',
        rawRow: r,
      });
    }
  });

  return {
    rows: rowsOut,
    buildings: Array.from(new Set(rowsOut.map(row => row.buildingLabel))).filter(Boolean),
    months: Array.from(new Set(rowsOut.map(row => row.monthLabel))).filter(Boolean),
    sections: Array.from(new Set(rowsOut.map(row => row.section))),
    ownerLabels: Array.from(new Set(rowsOut.filter(row => row.section === 'OWNER_EXPENSE').map(row => row.sectionLabel))).filter(Boolean),
    errors,
  };
}

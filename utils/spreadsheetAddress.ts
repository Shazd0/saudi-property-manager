export interface CellAddressParts {
  col: number;
  row: number;
}

export interface CellRange {
  start: CellAddressParts;
  end: CellAddressParts;
}

const CELL_RE = /^\$?([A-Z]+)\$?([1-9]\d*)$/i;

export function colLabelToIndex(label: string): number {
  const normalized = String(label || '').trim().toUpperCase();
  let index = 0;
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) throw new Error(`Invalid column label: ${label}`);
    index = index * 26 + (code - 64);
  }
  return index;
}

export function indexToColLabel(index: number): string {
  let n = Math.floor(Number(index));
  if (!Number.isFinite(n) || n < 1) throw new Error(`Invalid column index: ${index}`);
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function normalizeCellAddress(address: string): string {
  const parsed = parseCellAddress(address);
  return cellAddress(parsed.col, parsed.row);
}

export function parseCellAddress(address: string): CellAddressParts {
  const match = String(address || '').trim().match(CELL_RE);
  if (!match) throw new Error(`Invalid cell address: ${address}`);
  return {
    col: colLabelToIndex(match[1]),
    row: Number(match[2]),
  };
}

export function cellAddress(col: number, row: number): string {
  return `${indexToColLabel(col)}${Math.floor(row)}`;
}

export function isCellAddress(value: string): boolean {
  return CELL_RE.test(String(value || '').trim());
}

export function parseCellRange(value: string): CellRange {
  const [a, b] = String(value || '').split(':');
  if (!a || !b) {
    const single = parseCellAddress(value);
    return { start: single, end: single };
  }
  const start = parseCellAddress(a);
  const end = parseCellAddress(b);
  return {
    start: {
      col: Math.min(start.col, end.col),
      row: Math.min(start.row, end.row),
    },
    end: {
      col: Math.max(start.col, end.col),
      row: Math.max(start.row, end.row),
    },
  };
}

export function expandCellRange(value: string, limit = 10000): string[] {
  const range = parseCellRange(value);
  const width = range.end.col - range.start.col + 1;
  const height = range.end.row - range.start.row + 1;
  if (width * height > limit) throw new Error(`Range too large: ${value}`);
  const out: string[] = [];
  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) {
      out.push(cellAddress(col, row));
    }
  }
  return out;
}

export function shiftCellAddress(address: string, colDelta: number, rowDelta: number): string {
  const parsed = parseCellAddress(address);
  return cellAddress(Math.max(1, parsed.col + colDelta), Math.max(1, parsed.row + rowDelta));
}

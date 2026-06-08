/**
 * Sheet row ↔ Amlak transaction matching for Google Sheets import.
 */

import { Transaction, TransactionType, ExpenseCategory, Building } from '../types';
import { ParsedRow, SectionKind } from './sheetLedgerParser';

// ── Shared normalization ─────────────────────────────────────────────────────

export function fuzzyNorm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]/gu, '');
}

export function fuzzyMatch(needle: string, haystack: string[]): string | null {
  const n = fuzzyNorm(needle);
  if (!n) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const h of haystack) {
    const hn = fuzzyNorm(h);
    if (hn === n) return h;
    if (hn.includes(n) || n.includes(hn)) {
      const score = Math.abs(hn.length - n.length);
      if (score < bestScore) { bestScore = score; best = h; }
    }
  }
  return best;
}

export function normalizeDetails(s: string): string {
  return smartTextNorm(s);
}

export function roundAmt(n: any): number {
  const parsed = typeof n === 'number' ? n : parseFloat(String(n || 0).replace(/,/g, ''));
  return Math.round((Number.isFinite(parsed) ? parsed : 0) * 100) / 100;
}

function amountCents(n: any): number {
  return Math.round(roundAmt(n) * 100);
}

function addAmountVariant(
  variants: { label: string; amount: number; cents: number }[],
  label: string,
  amount: any,
) {
  const rounded = roundAmt(amount);
  const cents = amountCents(rounded);
  if (cents <= 0) return;
  if (variants.some(v => v.cents === cents)) return;
  variants.push({ label, amount: rounded, cents });
}

function txAmountVariants(tx: Transaction): { label: string; amount: number; cents: number }[] {
  const variants: { label: string; amount: number; cents: number }[] = [];
  const amount = roundAmt(tx.amount);
  const vatAmount = roundAmt(tx.vatAmount);
  const amountExcludingVAT = roundAmt(tx.amountExcludingVAT);
  const amountIncludingVAT = roundAmt(tx.amountIncludingVAT);
  const totalWithVat = roundAmt(tx.totalWithVat);

  addAmountVariant(variants, 'amount', amount);
  addAmountVariant(variants, 'totalWithVat', totalWithVat);
  addAmountVariant(variants, 'amountIncludingVAT', amountIncludingVAT);
  addAmountVariant(variants, 'amountExcludingVAT', amountExcludingVAT);
  if (amountExcludingVAT && vatAmount) addAmountVariant(variants, 'amountExcludingVAT + vatAmount', amountExcludingVAT + vatAmount);
  if (amount && vatAmount) addAmountVariant(variants, 'amount + vatAmount', amount + vatAmount);
  if (amount) {
    addAmountVariant(variants, 'amount * 1.15', amount * 1.15);
    addAmountVariant(variants, 'amount / 1.15', amount / 1.15);
  }
  return variants;
}

function bestAmountMatch(rowAmount: any, tx: Transaction): {
  ok: boolean;
  label: string;
  amount: number;
  cents: number;
  diffCents: number;
  score: number;
} {
  const target = amountCents(rowAmount);
  let best = {
    ok: false,
    label: 'no amount match',
    amount: roundAmt(tx.amount),
    cents: amountCents(tx.amount),
    diffCents: Number.MAX_SAFE_INTEGER,
    score: 0,
  };

  for (const variant of txAmountVariants(tx)) {
    const diffCents = Math.abs(variant.cents - target);
    if (diffCents < best.diffCents) {
      best = {
        ok: diffCents <= 100,
        label: variant.label,
        amount: variant.amount,
        cents: variant.cents,
        diffCents,
        score: variant.label === 'amount' ? 50 : 46,
      };
    }
  }

  return best;
}

function txComparableAmount(tx: Transaction): number {
  const inclusive = roundAmt(tx.totalWithVat) || roundAmt(tx.amountIncludingVAT);
  return inclusive || roundAmt(tx.amount);
}

function parseDateParts(dateLike?: string): { y: number; m: number; d: number } | null {
  const s = String(dateLike || '').trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return { y, m: Number(m[2]), d: Number(m[1]) };
  }

  return null;
}

export function sheetImportMonthKey(dateLike?: string): string {
  const parts = parseDateParts(dateLike);
  if (!parts || parts.m < 1 || parts.m > 12 || parts.d < 1 || parts.d > 31) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}`;
}

export function sheetImportDateKey(dateLike?: string): string {
  const parts = parseDateParts(dateLike);
  if (!parts || parts.m < 1 || parts.m > 12 || parts.d < 1 || parts.d > 31) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

function dateUtcTime(dateLike?: string): number {
  const parts = parseDateParts(dateLike);
  if (!parts || parts.m < 1 || parts.m > 12 || parts.d < 1 || parts.d > 31) return Number.NaN;
  return Date.UTC(parts.y, parts.m - 1, parts.d);
}

export function rowStableKey(row: ParsedRow): string {
  return [
    row.sheetName,
    row.rawRow,
    row.section,
    row.buildingLabel,
    row.parsedDate,
    roundAmt(row.amount),
    row.unitNumber || '',
    row.sectionLabel || '',
    row.details || '',
    row.category || '',
    row.paymentMethod,
  ].join('|');
}

export function normUnit(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\b(unit|flat|shop)\b/g, '')
    .replace(/^p(?=\d)/, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^0+/, '');
}

function unitLeadingSegment(s: string): string {
  const t = s.trim().replace(/^(flat|shop|unit|#|p)\s*/i, '');
  const seg = t.split(/[-/\\,]/)[0]?.trim() || t;
  return normUnit(seg);
}

export function unitMatchScore(sheetUnit: string, amlakUnit: string): number {
  if (!sheetUnit || !amlakUnit) return 0;
  const su = sheetUnit.trim();
  const au = amlakUnit.trim();
  if (su === au) return 100;

  const sn = normUnit(su);
  const an = normUnit(au);
  if (!sn || !an) return 0;
  if (sn === an) return 95;

  const sheetSeg = unitLeadingSegment(su);
  const amlakSeg = unitLeadingSegment(au);
  if (sheetSeg && amlakSeg && sheetSeg === amlakSeg) return 90;

  if (an.startsWith(sn) && sn.length >= 2) return 85 - (an.length - sn.length);
  if (sn.startsWith(an) && an.length >= 2) return 80 - (sn.length - an.length);

  const sheetAlnum = su.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const amlakAlnum = au.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (sheetAlnum.length >= 2 && amlakAlnum.startsWith(sheetAlnum)) return 75;
  if (amlakAlnum.length >= 2 && sheetAlnum.startsWith(amlakAlnum)) return 70;

  const sd = su.replace(/\D/g, '');
  const ad = au.replace(/\D/g, '');
  if (sd.length >= 2 && ad.startsWith(sd)) return 65;
  if (ad.length >= 2 && sd.startsWith(ad)) return 60;

  if (sn.length >= 3 && (an.includes(sn) || sn.includes(an))) return 50 - Math.abs(an.length - sn.length);

  return 0;
}

export function matchUnitName(
  sheetUnit: string,
  buildingUnits: { name: string }[],
  manualMapping?: Record<string, string>,
  buildingId?: string,
): { matched: boolean; unitName: string } {
  if (!sheetUnit) return { matched: false, unitName: sheetUnit };

  if (manualMapping && buildingId) {
    const mapKey = `${buildingId}:${sheetUnit}`;
    const mapped = manualMapping[mapKey];
    if (mapped) return { matched: true, unitName: mapped };
  }

  if (!buildingUnits?.length) return { matched: false, unitName: sheetUnit };

  let bestUnit: string | null = null;
  let bestScore = 0;
  for (const u of buildingUnits) {
    const score = unitMatchScore(sheetUnit, u.name);
    if (score > bestScore) {
      bestScore = score;
      bestUnit = u.name;
    }
  }

  if (bestUnit && bestScore >= 60) {
    return { matched: true, unitName: bestUnit };
  }

  return { matched: false, unitName: sheetUnit };
}

export function contractMatchesUnit(contractUnitName: string, unit: string): boolean {
  if (!contractUnitName || !unit) return false;
  if (contractUnitName === unit) return true;
  const parts = contractUnitName.split(/[,;]+/).map(s => s.trim());
  for (const part of parts) {
    if (part === unit) return true;
    if (unitMatchScore(unit, part) >= 60) return true;
  }
  return false;
}

// ── Category normalization ───────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  GENERAL: 'GENERALEXPENSE',
  GENERALEXPENSE: 'GENERALEXPENSE',
  MAINTENANCE: 'MAINTENANCE',
  UTILITIES: 'UTILITIES',
  UTILITY: 'UTILITIES',
  SALARY: 'SALARY',
  SALARIES: 'SALARY',
  BORROWING: 'BORROWING',
  BORROW: 'BORROWING',
  OWNEREXPENSE: 'OWNEREXPENSE',
  OWNER: 'OWNEREXPENSE',
  VENDORPAYMENT: 'VENDORPAYMENT',
  PROPERTYRENT: 'PROPERTYRENT',
  SERVICEAGREEMENT: 'SERVICEAGREEMENT',
  HEADOFFICE: 'HEADOFFICE',
  REPAIR: 'MAINTENANCE',
  REPAIRS: 'MAINTENANCE',
  PLUMBING: 'MAINTENANCE',
  ELECTRICAL: 'MAINTENANCE',
  AC: 'MAINTENANCE',
  AIRCONDITIONING: 'MAINTENANCE',
  ELECTRICITY: 'UTILITIES',
  WATER: 'UTILITIES',
  SEWERAGE: 'UTILITIES',
  SEWAGE: 'UTILITIES',
  INTERNET: 'UTILITIES',
};

export function normalizeExpenseCategory(cat: string): string {
  const key = fuzzyNorm(cat || '').toUpperCase();
  if (!key) return 'GENERALEXPENSE';
  return CATEGORY_ALIASES[key] || key;
}

function inferRentalSectionFromTxDetails(details?: string): SectionKind {
  const d = smartTextNorm(details || '');
  if (/(internet|wifi|wi fi|انترنت)/i.test(d)) return 'INTERNET';
  if (/(shop|store|commercial|محل|دكان)/i.test(d)) return 'SHOP_RENT';
  return 'FLATS_RENT';
}

function inferTxSection(tx: Transaction): SectionKind | 'OTHER_INCOME' | null {
  if (String(tx.type).toUpperCase() === 'INCOME') {
    const incomeSubType = String(tx.incomeSubType || '').toUpperCase();
    const rentalLike =
      incomeSubType === 'RENTAL' ||
      !!tx.unitNumber ||
      !!tx.contractId ||
      /(rent|rental|shop|flat|unit|internet|ايجار|إيجار|محل|شقة)/i.test(`${tx.details || ''} ${String(tx.expenseCategory || '')}`);
    if (rentalLike && incomeSubType !== 'OTHER') {
      return inferRentalSectionFromTxDetails(tx.details);
    }
    return 'OTHER_INCOME';
  }
  const cat = String(tx.expenseCategory || '');
  if (cat === ExpenseCategory.OWNER_EXPENSE || cat === 'Owner Expense') return 'OWNER_EXPENSE';
  if (cat === ExpenseCategory.SALARY || cat === 'Salary') return 'SALARY';
  if (cat === ExpenseCategory.BORROWING || cat === 'Borrowing') return 'BORROWING';
  return 'OTHER_EXPENSES';
}

function smartTextNorm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[–—]/g, '-')
    .replace(/\b(owner expense|general expense|vendor payment|salary|borrowing by|repayment by)\b/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const DETAIL_STOPWORDS = new Set([
  'a', 'an', 'and', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to',
  'expense', 'expenses', 'general', 'payment', 'paid', 'bill', 'invoice',
  'owner', 'salary', 'borrowing', 'repayment', 'cash', 'bank',
]);

function detailTokens(s: string): string[] {
  const normed = smartTextNorm(s);
  if (!normed) return [];
  return normed
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !DETAIL_STOPWORDS.has(t));
}

function tokenDice(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const ac = new Map<string, number>();
  const bc = new Map<string, number>();
  a.forEach(t => ac.set(t, (ac.get(t) || 0) + 1));
  b.forEach(t => bc.set(t, (bc.get(t) || 0) + 1));
  let overlap = 0;
  for (const [token, count] of ac) {
    overlap += Math.min(count, bc.get(token) || 0);
  }
  return (2 * overlap) / (a.length + b.length);
}

function boundedEditSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.max(a.length, b.length) > 80) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

function detailsSimilarity(a: string, b: string): number {
  const na = smartTextNorm(a);
  const nb = smartTextNorm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    return shorter / longer >= 0.35 ? 0.9 : 0.75;
  }

  const aTokens = detailTokens(na);
  const bTokens = detailTokens(nb);
  const tokenScore = tokenDice(aTokens, bTokens);
  const editScore = boundedEditSimilarity(fuzzyNorm(na), fuzzyNorm(nb));
  return Math.max(tokenScore, editScore);
}

function inferExpenseCategoryKey(category: string, details = ''): string {
  const explicit = normalizeExpenseCategory(category || '');
  if (explicit && explicit !== 'GENERALEXPENSE') return explicit;

  const text = smartTextNorm(`${category} ${details}`);
  if (/(maintenance|repair|plumb|electric|electrical|ac|air condition|clean|paint|صيانة|سباك|كهرب|مكيف)/i.test(text)) {
    return 'MAINTENANCE';
  }
  if (/(utility|utilities|water|electricity|sewer|sewage|stc|mobily|internet|كهرباء|ماء|فاتورة|انترنت)/i.test(text)) {
    return 'UTILITIES';
  }
  if (/(salary|salaries|راتب|رواتب)/i.test(text)) return 'SALARY';
  if (/(borrow|borrowing|advance|سلفة)/i.test(text)) return 'BORROWING';
  if (/(owner|profit|withdrawal|مالك)/i.test(text)) return 'OWNEREXPENSE';
  if (/(vendor|supplier|مورد)/i.test(text)) return 'VENDORPAYMENT';
  if (/(property rent|lease|ايجار|إيجار)/i.test(text)) return 'PROPERTYRENT';
  return explicit || 'GENERALEXPENSE';
}

function categorySimilarity(rowCategory: string, rowDetails: string, txCategory: string, txDetails: string): number {
  const rowCat = normalizeExpenseCategory(rowCategory || '');
  const txCat = normalizeExpenseCategory(txCategory || '');
  if (rowCat && txCat && rowCat === txCat) return 1;
  if (rowCat && txCat && (rowCat.includes(txCat) || txCat.includes(rowCat))) return 0.8;

  const inferredRow = inferExpenseCategoryKey(rowCategory, rowDetails);
  const inferredTx = inferExpenseCategoryKey(txCategory, txDetails);
  if (inferredRow && inferredTx && inferredRow === inferredTx) return 0.78;

  if (rowCat === 'GENERALEXPENSE' || txCat === 'GENERALEXPENSE') return 0.45;
  return 0;
}

function normalizedPaymentGroup(pm?: string): 'CASH' | 'BANK' | '' {
  const p = String(pm || '').toUpperCase();
  if (p.includes('CASH')) return 'CASH';
  if (p.includes('BANK') || p.includes('CHEQUE') || p.includes('CHECK')) return 'BANK';
  return '';
}

function paymentMethodCompatible(row: ParsedRow, tx: Transaction): boolean {
  const rowPm = normalizedPaymentGroup(row.paymentMethod);
  const txPm = normalizedPaymentGroup(tx.originalPaymentMethod || tx.paymentMethod);
  if (!rowPm || !txPm) return true;
  return rowPm === txPm;
}

function isRentalSection(section: SectionKind): boolean {
  return ['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(section);
}

function isOwnerSalarySheetRow(row: ParsedRow): boolean {
  const text = `${row.sectionLabel || ''} ${row.category || ''} ${row.details || ''}`.toLowerCase();
  return (row.section === 'SALARY' || row.section === 'OWNER_EXPENSE') &&
    text.includes('owner') &&
    /\b(?:salar(?:y|ies)|slary|salry)\b/.test(text);
}

function isGenericOwnerExpenseSheetRow(row: ParsedRow): boolean {
  if (row.section !== 'OWNER_EXPENSE') return false;
  const text = `${row.sectionLabel || ''} ${row.category || ''} ${row.details || ''}`.toLowerCase();
  return text.includes('owner') && /\b(?:expense|expenses|expse|expnse|expence|salar(?:y|ies)|slary|salry)\b/.test(text);
}

function rentalSectionHintMatches(rowSection: SectionKind, tx: Transaction): boolean {
  const text = smartTextNorm(`${tx.details || ''} ${String(tx.expenseCategory || '')} ${tx.unitNumber || ''}`);
  if (rowSection === 'SHOP_RENT') return /(shop|store|commercial|محل|دكان)/i.test(text);
  if (rowSection === 'INTERNET') return /(internet|wifi|wi fi|انترنت)/i.test(text);
  return true;
}

function isEligibleAmlakTx(tx: Transaction): boolean {
  if ((tx as any).deleted) return false;
  if (String((tx as any).status || '').toUpperCase() === 'REJECTED') return false;
  if ((tx as any).vatReportOnly) return false;
  const pm = String(tx.paymentMethod || '');
  if ((tx as any).source === 'treasury' || pm === 'TREASURY' || pm === 'TREASURY_REVERSAL' || (tx as any).isReversal) {
    return false;
  }
  return true;
}

// ── Fingerprints ─────────────────────────────────────────────────────────────

export interface ResolvedRowKeys {
  buildingId: string;
  resolvedUnit: string;
  ownerKey: string;
  employeeKey: string;
}

export function buildSheetFingerprint(
  row: ParsedRow,
  keys: ResolvedRowKeys,
  includePaymentMethod = true,
): string {
  const amt = roundAmt(row.amount);
  const date = sheetImportDateKey(row.parsedDate);
  const pm = includePaymentMethod ? (row.paymentMethod || '') : '';

  if (['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section)) {
    return `INCOME|${row.section}|${date}|${amt}|${keys.buildingId}|${keys.resolvedUnit}|${pm}`;
  }
  if (row.section === 'OTHER_INCOME') {
    return `INCOME|OTHER|${date}|${amt}|${keys.buildingId}|${normUnit(row.details || '')}|${pm}`;
  }
  if (row.section === 'OWNER_EXPENSE' || isOwnerSalarySheetRow(row)) {
    return `EXPENSE|OWNER|${date}|${amt}|${keys.buildingId}|${keys.ownerKey}|${normalizeDetails(row.details || '')}|${pm}`;
  }
  if (row.section === 'SALARY') {
    return `EXPENSE|SALARY|${date}|${amt}|${keys.buildingId}|${keys.employeeKey}|${pm}`;
  }
  if (row.section === 'BORROWING') {
    return `EXPENSE|BORROW|${date}|${amt}|${keys.buildingId}|${keys.employeeKey}|${pm}`;
  }
  const cat = inferExpenseCategoryKey(row.category || '', row.details || '');
  return `EXPENSE|OTHER|${date}|${amt}|${keys.buildingId}|${cat}|${normalizeDetails(row.details || '')}|${pm}`;
}

export function buildAmlakFingerprint(
  tx: Transaction,
  buildings: Building[],
  unitMapping: Record<string, string>,
  includePaymentMethod = true,
): string {
  const amt = roundAmt(tx.amount);
  const date = sheetImportDateKey(tx.date);
  const bid = tx.buildingId || '';
  const pm = includePaymentMethod ? (tx.paymentMethod || '') : '';
  const section = inferTxSection(tx);

  if (section === 'FLATS_RENT' || section === 'SHOP_RENT' || section === 'INTERNET') {
    const building = buildings.find(b => b.id === bid);
    const um = matchUnitName(tx.unitNumber || '', building?.units || [], unitMapping, bid);
    return `INCOME|${section}|${date}|${amt}|${bid}|${um.unitName}|${pm}`;
  }
  if (section === 'OTHER_INCOME') {
    return `INCOME|OTHER|${date}|${amt}|${bid}|${normUnit(tx.details || '')}|${pm}`;
  }
  if (section === 'OWNER_EXPENSE') {
    const ownerKey = tx.ownerId || fuzzyNorm(tx.ownerName || '');
    return `EXPENSE|OWNER|${date}|${amt}|${bid}|${ownerKey}|${normalizeDetails(tx.details || '')}|${pm}`;
  }
  if (section === 'SALARY') {
    const empKey = tx.employeeId || fuzzyNorm(tx.employeeName || '');
    return `EXPENSE|SALARY|${date}|${amt}|${bid}|${empKey}|${pm}`;
  }
  if (section === 'BORROWING') {
    const empKey = tx.employeeId || fuzzyNorm(tx.employeeName || '');
    return `EXPENSE|BORROW|${date}|${amt}|${bid}|${empKey}|${pm}`;
  }
  const cat = inferExpenseCategoryKey(String(tx.expenseCategory || ''), tx.details || '');
  return `EXPENSE|OTHER|${date}|${amt}|${bid}|${cat}|${normalizeDetails(tx.details || '')}|${pm}`;
}

function rentalSoftKey(buildingId: string, unitName: string, month: string, section: SectionKind, amount: number): string {
  return `RENT|${buildingId}|${unitName}|${month}|${section}|${roundAmt(amount)}`;
}

function daysApart(d1: string, d2: string): number {
  if (!d1 || !d2) return 999;
  const a = dateUtcTime(d1);
  const b = dateUtcTime(d2);
  if (Number.isNaN(a) || Number.isNaN(b)) return 999;
  return Math.abs(a - b) / 86400000;
}

// ── Match result types ───────────────────────────────────────────────────────

export type SheetRowMatchStatus = 'importable' | 'in_amlak' | 'needs_mapping';
export type MatchConfidence = 'exact' | 'high' | 'soft_rent';

export interface SheetRowMatchResult {
  status: SheetRowMatchStatus;
  confidence?: MatchConfidence;
  matchScore?: number;
  matchedTxId?: string;
  matchedTxDate?: string;
  matchedTxDetails?: string;
  matchedTxAmount?: number;
  adjustmentAmount?: number;
  adjustmentDetails?: string;
  mappingReason?: 'no_building' | 'no_unit' | 'no_owner' | 'no_employee';
}

export interface SheetMatchContext {
  buildings: Building[];
  unitMapping: Record<string, string>;
  resolveBuilding: (label: string) => Building | null;
  resolveOwner: (label: string) => { id: string; name: string } | null;
  resolveEmployee: (name: string) => { id: string; name: string } | null;
}

export function resolveRowKeys(row: ParsedRow, ctx: SheetMatchContext): {
  building: Building | null;
  keys: ResolvedRowKeys | null;
  unitMatched: boolean;
  owner: { id: string; name: string } | null;
  employee: { id: string; name: string } | null;
} {
  const building = ctx.resolveBuilding(row.buildingLabel);
  if (!building) {
    return { building: null, keys: null, unitMatched: false, owner: null, employee: null };
  }

  const ownerSalary = isOwnerSalarySheetRow(row);
  const owner = (row.section === 'OWNER_EXPENSE' || ownerSalary)
    ? (ctx.resolveOwner(row.sectionLabel) || ctx.resolveOwner(row.details || ''))
    : null;
  const ownerKey = owner?.id || (ownerSalary ? fuzzyNorm(row.details || row.sectionLabel) : fuzzyNorm(row.sectionLabel));

  const employee =
    (row.section === 'SALARY' && !isOwnerSalarySheetRow(row)) || row.section === 'BORROWING'
      ? ctx.resolveEmployee(row.details || '')
      : null;
  const employeeKey = employee?.id || fuzzyNorm(row.details || '');

  const um = ['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section)
    ? matchUnitName(row.unitNumber || '', building.units || [], ctx.unitMapping, building.id)
    : { unitName: '', matched: true };

  return {
    building,
    keys: {
      buildingId: building.id,
      resolvedUnit: um.unitName,
      ownerKey,
      employeeKey,
    },
    unitMatched: um.matched,
    owner,
    employee,
  };
}

export function needsMapping(
  row: ParsedRow,
  resolved: ReturnType<typeof resolveRowKeys>,
): SheetRowMatchResult['mappingReason'] | null {
  if (!resolved.building) return 'no_building';

  const isRental = ['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section);
  if (isRental && row.unitNumber && !resolved.unitMatched) return 'no_unit';

  if (((row.section === 'SALARY' && !isOwnerSalarySheetRow(row)) || row.section === 'BORROWING') && row.details && !resolved.employee) {
    return 'no_employee';
  }

  return null;
}

export function scoreAmlakMatch(
  row: ParsedRow,
  tx: Transaction,
  resolved: ReturnType<typeof resolveRowKeys>,
): number {
  if (!resolved.building || !resolved.keys) return 0;
  if (!isEligibleAmlakTx(tx)) return 0;

  const keys = resolved.keys;
  let score = 0;

  const amountMatch = bestAmountMatch(row.amount, tx);
  if (!amountMatch.ok) return 0;
  score += amountMatch.score;

  if ((tx.buildingId || '') !== keys.buildingId) return 0;
  score += 25;

  if (!paymentMethodCompatible(row, tx)) return 0;
  score += 6;

  const rowSection: SectionKind = isOwnerSalarySheetRow(row) ? 'OWNER_EXPENSE' : row.section;
  const txSection = inferTxSection(tx);
  if (!txSection) return 0;

  const rowIsIncome = ['FLATS_RENT', 'SHOP_RENT', 'INTERNET', 'OTHER_INCOME'].includes(rowSection);
  const txIsIncome = String(tx.type).toUpperCase() === 'INCOME';
  if (rowIsIncome !== txIsIncome) return 0;

  const rowRental = isRentalSection(rowSection);
  const txRental = txSection === 'FLATS_RENT' || txSection === 'SHOP_RENT' || txSection === 'INTERNET';

  if (rowSection === txSection || (rowSection === 'OTHER_INCOME' && txSection === 'OTHER_INCOME')) {
    score += 15;
  } else if (rowRental && txRental) {
    score += 8;
  } else if (rowRental && txSection === 'OTHER_INCOME' && rentalSectionHintMatches(rowSection, tx)) {
    score += 6;
  } else {
    return 0;
  }

  const dayDiff = daysApart(row.parsedDate, tx.date || '');
  const rowMonth = sheetImportMonthKey(row.parsedDate);
  const txMonth = sheetImportMonthKey(tx.date);
  const isExpenseSection = !rowIsIncome;

  if (!rowMonth || !txMonth || rowMonth !== txMonth) return 0;

  if (dayDiff <= 1) score += 14;
  else if (dayDiff <= 3) score += 12;
  else if (dayDiff <= 7) score += 8;
  else if (dayDiff <= 14) score += 4;
  else if (isExpenseSection) {
    if (rowSection === 'SALARY' && tx.salaryPeriod && tx.salaryPeriod === rowMonth) score += 4;
    else if (rowMonth && rowMonth === txMonth && dayDiff <= 31) score += 2;
    else return 0;
  } else if (!rowRental) {
    return 0;
  }

  if (rowSection === 'OTHER_EXPENSES') {
    const catScore = categorySimilarity(row.category || '', row.details || '', String(tx.expenseCategory || ''), tx.details || '');
    const rowDetail = row.details || row.category || '';
    const txDetail = tx.details || String(tx.expenseCategory || '');
    const detailScore = detailsSimilarity(rowDetail, txDetail);

    if (catScore > 0) {
      score += Math.round(15 * catScore);
    }

    if (detailScore >= 0.72) score += Math.round(16 * detailScore);
    else if (catScore >= 0.95 && dayDiff <= 3 && detailScore >= 0.45) score += 6;
    else if (catScore >= 0.75 && dayDiff <= 3 && detailScore >= 0.5) score += 6;
    else if (!row.details && !tx.details) score += 5;
    else if (dayDiff <= 1) {
      // Ledger fallback: same building + amount + payment + exact/next-day date is a strong duplicate
      // even when the expense wording or category was entered differently.
      return 84;
    } else if (dayDiff <= 7 && rowMonth === txMonth && (catScore >= 0.45 || detailScore >= 0.25)) {
      return 78;
    }
    else return 0;
  }

  if (rowSection === 'OWNER_EXPENSE') {
    const ownerOptional = isOwnerSalarySheetRow(row) || isGenericOwnerExpenseSheetRow(row);
    const txOwnerKey = tx.ownerId || fuzzyNorm(tx.ownerName || '');
    if (keys.ownerKey && txOwnerKey && keys.ownerKey === txOwnerKey) score += 10;
    else if (detailsSimilarity(row.sectionLabel, tx.ownerName || '') >= 0.65) score += 8;
    else if (ownerOptional || !keys.ownerKey) score += 4;
    else return 0;

    const detailScore = detailsSimilarity(row.details || '', tx.details || '');
    if (row.details && tx.details) {
      if (detailScore >= 0.6) score += Math.round(10 * detailScore);
      else if (ownerOptional && dayDiff <= 3) score += 2;
      else if (dayDiff > 3) return 0;
    }
  }

  if (rowSection === 'SALARY' || rowSection === 'BORROWING') {
    const txEmpKey = tx.employeeId || fuzzyNorm(tx.employeeName || '');
    if (keys.employeeKey && txEmpKey && keys.employeeKey === txEmpKey) score += 10;
    else if (detailsSimilarity(row.details || '', tx.employeeName || tx.details || '') >= 0.65) score += 8;
    else return 0;

    if (rowSection === 'SALARY' && tx.salaryPeriod && rowMonth && tx.salaryPeriod !== rowMonth) return 0;
  }

  if (rowRental) {
    const building = resolved.building;
    if (tx.unitNumber) {
      const txUm = matchUnitName(tx.unitNumber, building.units || [], {}, building.id);
      if (keys.resolvedUnit && txUm.unitName && keys.resolvedUnit === txUm.unitName) score += 10;
      else if (unitMatchScore(row.unitNumber || '', tx.unitNumber) >= 60) score += 8;
      else return 0;
    } else if (dayDiff <= 1 && rentalSectionHintMatches(rowSection, tx)) {
      score += 4;
    } else if (dayDiff > 1 || rowSection === 'INTERNET') {
      return 0;
    }
  }

  return score;
}

interface CandidatePair {
  rowKey: string;
  row: ParsedRow;
  tx: Transaction;
  score: number;
  confidence: MatchConfidence;
}

function trySoftRentMatch(
  row: ParsedRow,
  keys: ResolvedRowKeys,
  amlakTxs: Transaction[],
  buildings: Building[],
  unitMapping: Record<string, string>,
  usedTxIds: Set<string>,
): CandidatePair | null {
  if (!['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section)) return null;
  const month = sheetImportMonthKey(row.parsedDate);
  if (!month) return null;

  const softKey = rentalSoftKey(keys.buildingId, keys.resolvedUnit, month, row.section, row.amount);

  for (const tx of amlakTxs) {
    if (usedTxIds.has(tx.id)) continue;
    if (!isEligibleAmlakTx(tx)) continue;
    if (String(tx.type).toUpperCase() !== 'INCOME') continue;
    if (!tx.unitNumber || tx.incomeSubType !== 'RENTAL') continue;
    if ((tx.buildingId || '') !== keys.buildingId) continue;
    const amountMatch = bestAmountMatch(row.amount, tx);
    if (!amountMatch.ok) continue;
    if (!paymentMethodCompatible(row, tx)) continue;

    const building = buildings.find(b => b.id === keys.buildingId);
    const txUm = matchUnitName(tx.unitNumber, building?.units || [], unitMapping, keys.buildingId);
    const txSec = inferRentalSectionFromTxDetails(tx.details);
    const txSoft = rentalSoftKey(keys.buildingId, txUm.unitName, sheetImportMonthKey(tx.date), txSec, amountMatch.amount);

    if (softKey === txSoft || rentalSoftKey(keys.buildingId, keys.resolvedUnit, month, row.section, row.amount) ===
      rentalSoftKey(keys.buildingId, txUm.unitName, month, row.section, row.amount)) {
      return {
        rowKey: rowStableKey(row),
        row,
        tx,
        score: 85,
        confidence: 'soft_rent',
      };
    }
  }
  return null;
}

function rentalTxFitsRow(
  row: ParsedRow,
  tx: Transaction,
  keys: ResolvedRowKeys,
  buildings: Building[],
  unitMapping: Record<string, string>,
): boolean {
  if (!isRentalSection(row.section)) return false;
  if (!isEligibleAmlakTx(tx)) return false;
  if (String(tx.type).toUpperCase() !== 'INCOME') return false;
  if ((tx.buildingId || '') !== keys.buildingId) return false;
  if (!paymentMethodCompatible(row, tx)) return false;

  const dayDiff = daysApart(row.parsedDate, tx.date || '');
  const rowMonth = sheetImportMonthKey(row.parsedDate);
  const txMonth = sheetImportMonthKey(tx.date);
  if (!rowMonth || !txMonth || rowMonth !== txMonth) return false;

  const txSection = inferTxSection(tx);
  const txRental = txSection === 'FLATS_RENT' || txSection === 'SHOP_RENT' || txSection === 'INTERNET';
  if (txRental) {
    if (row.section !== txSection && !rentalSectionHintMatches(row.section, tx)) return false;
  } else if (txSection !== 'OTHER_INCOME' || !rentalSectionHintMatches(row.section, tx)) {
    return false;
  }

  const building = buildings.find(b => b.id === keys.buildingId);
  if (tx.unitNumber) {
    const txUm = matchUnitName(tx.unitNumber, building?.units || [], unitMapping, keys.buildingId);
    if (keys.resolvedUnit && txUm.unitName && keys.resolvedUnit === txUm.unitName) return true;
    return unitMatchScore(row.unitNumber || '', tx.unitNumber) >= 60;
  }

  return dayDiff <= 1 && rentalSectionHintMatches(row.section, tx);
}

function tryAggregateRentMatch(
  row: ParsedRow,
  keys: ResolvedRowKeys,
  amlakTxs: Transaction[],
  buildings: Building[],
  unitMapping: Record<string, string>,
  usedTxIds: Set<string>,
): { txs: Transaction[]; score: number } | null {
  if (!isRentalSection(row.section)) return null;
  const target = amountCents(row.amount);
  if (target <= 0) return null;

  const candidates = amlakTxs
    .filter(tx =>
      tx.id &&
      !usedTxIds.has(tx.id) &&
      amountCents(txComparableAmount(tx)) > 0 &&
      amountCents(txComparableAmount(tx)) <= target &&
      rentalTxFitsRow(row, tx, keys, buildings, unitMapping)
    )
    .sort((a, b) => {
      const aDay = daysApart(row.parsedDate, a.date || '');
      const bDay = daysApart(row.parsedDate, b.date || '');
      if (aDay !== bDay) return aDay - bDay;
      return amountCents(txComparableAmount(b)) - amountCents(txComparableAmount(a));
    })
    .slice(0, 14);

  let best: Transaction[] | null = null;

  const dfs = (idx: number, sum: number, picked: Transaction[]) => {
    if (best) return;
    if (sum === target && picked.length >= 2) {
      best = [...picked];
      return;
    }
    if (sum >= target || idx >= candidates.length || picked.length >= 6) return;

    for (let i = idx; i < candidates.length; i++) {
      const tx = candidates[i];
      dfs(i + 1, sum + amountCents(txComparableAmount(tx)), [...picked, tx]);
      if (best) return;
    }
  };

  dfs(0, 0, []);
  if (!best) return null;

  const exactDateCount = best.filter(tx => daysApart(row.parsedDate, tx.date || '') <= 1).length;
  return {
    txs: best,
    score: exactDateCount === best.length ? 92 : 86,
  };
}

interface SheetRowGroupCandidate {
  rowKey: string;
  row: ParsedRow;
  keys: ResolvedRowKeys;
}

function bestTxTargetVariant(tx: Transaction, sumCents: number): { label: string; amount: number; cents: number; diffCents: number } {
  let best = { label: 'amount', amount: roundAmt(tx.amount), cents: amountCents(tx.amount), diffCents: Number.MAX_SAFE_INTEGER };
  for (const variant of txAmountVariants(tx)) {
    const diffCents = Math.abs(variant.cents - sumCents);
    if (diffCents < best.diffCents) {
      best = { ...variant, diffCents };
    }
  }
  return best;
}

function tryAmlakTxToSheetRowsMatch(
  tx: Transaction,
  rowCandidates: SheetRowGroupCandidate[],
  buildings: Building[],
  unitMapping: Record<string, string>,
): { rows: SheetRowGroupCandidate[]; sheetTotal: number; targetAmount: number; targetLabel: string; diffCents: number; extraAmount: number } | null {
  if (!tx.id || !isEligibleAmlakTx(tx)) return null;
  if (String(tx.type).toUpperCase() !== 'INCOME') return null;

  const targetVariants = txAmountVariants(tx);
  const targets = targetVariants.map(v => v.cents).filter(cents => cents > 0);
  if (targets.length === 0) return null;
  const maxTarget = Math.max(...targets);
  const toleranceCents = 100; // 1 SAR rounding / VAT split tolerance

  const candidates = rowCandidates
    .filter(candidate => {
      if (!isRentalSection(candidate.row.section)) return false;
      const amt = amountCents(candidate.row.amount);
      if (amt <= 0 || amt > maxTarget + toleranceCents) return false;
      return rentalTxFitsRow(candidate.row, tx, candidate.keys, buildings, unitMapping);
    })
    .sort((a, b) => {
      const aDay = daysApart(a.row.parsedDate, tx.date || '');
      const bDay = daysApart(b.row.parsedDate, tx.date || '');
      if (aDay !== bDay) return aDay - bDay;
      return amountCents(b.row.amount) - amountCents(a.row.amount);
    })
    .slice(0, 16);

  let best: SheetRowGroupCandidate[] | null = null;
  let bestDiff = Number.MAX_SAFE_INTEGER;
  let bestSum = 0;

  const dfs = (idx: number, sum: number, picked: SheetRowGroupCandidate[]) => {
    if (sum > maxTarget + toleranceCents || picked.length >= 6) return;

    if (picked.length >= 2) {
      const target = bestTxTargetVariant(tx, sum);
      if (target.diffCents <= toleranceCents && target.diffCents < bestDiff) {
        best = [...picked];
        bestDiff = target.diffCents;
        bestSum = sum;
        if (bestDiff === 0) return;
      }
    }

    if (idx >= candidates.length) return;

    for (let i = idx; i < candidates.length; i++) {
      dfs(i + 1, sum + amountCents(candidates[i].row.amount), [...picked, candidates[i]]);
      if (bestDiff === 0) return;
    }
  };

  dfs(0, 0, []);
  if (!best) return null;

  const target = bestTxTargetVariant(tx, bestSum);
  return {
    rows: best,
    sheetTotal: roundAmt(bestSum / 100),
    targetAmount: target.amount,
    targetLabel: target.label,
    diffCents: target.diffCents,
    extraAmount: roundAmt(Math.max(0, bestSum - target.cents) / 100),
  };
}

export interface SheetMatchDebugCandidate {
  txId: string;
  date: string;
  type: string;
  amount: number;
  paymentMethod: string;
  buildingId: string;
  buildingName: string;
  unitNumber: string;
  incomeSubType: string;
  category: string;
  details: string;
  score: number;
  relevance: number;
  checks: { label: string; ok: boolean; detail: string }[];
}

export interface SheetMatchDebugInfo {
  rowKey: string;
  result: SheetRowMatchResult;
  sheet: {
    date: string;
    section: string;
    buildingLabel: string;
    unitNumber: string;
    normalizedUnit: string;
    amount: number;
    amountCents: number;
    paymentMethod: string;
    details: string;
    category: string;
  };
  resolved: {
    buildingId: string;
    buildingName: string;
    unitName: string;
    unitMatched: boolean;
    mappingReason: SheetRowMatchResult['mappingReason'] | null;
  };
  counts: {
    existingTransactions: number;
    eligibleTransactions: number;
  };
  fingerprints: {
    sheetStrict: string;
    sheetLoose: string;
    exactMatchCount: number;
  };
  aggregate: {
    enabled: boolean;
    targetAmount: number;
    candidateCount: number;
    candidateTotal: number;
    matchedIds: string[];
    matchedAmount: number;
  };
  topCandidates: SheetMatchDebugCandidate[];
}

function explainCandidate(
  row: ParsedRow,
  tx: Transaction,
  resolved: ReturnType<typeof resolveRowKeys>,
  buildings: Building[],
  unitMapping: Record<string, string>,
): SheetMatchDebugCandidate {
  const checks: SheetMatchDebugCandidate['checks'] = [];
  const keys = resolved.keys;
  const rowRental = isRentalSection(row.section);
  const txSection = inferTxSection(tx);
  const txIsIncome = String(tx.type).toUpperCase() === 'INCOME';
  const rowIsIncome = ['FLATS_RENT', 'SHOP_RENT', 'INTERNET', 'OTHER_INCOME'].includes(row.section);
  const dayDiff = daysApart(row.parsedDate, tx.date || '');
  const txMethod = normalizedPaymentGroup(tx.originalPaymentMethod || tx.paymentMethod);
  const rowMethod = normalizedPaymentGroup(row.paymentMethod);
  const txBuilding = buildings.find(b => b.id === tx.buildingId);
  const targetAmount = amountCents(row.amount);
  const amountMatch = bestAmountMatch(row.amount, tx);
  const comparableAmount = amountCents(txComparableAmount(tx));

  const eligible = isEligibleAmlakTx(tx);
  checks.push({ label: 'eligible', ok: eligible, detail: eligible ? 'usable transaction' : 'deleted/rejected/treasury/vat-only/reversal' });

  const buildingOk = !!keys && (tx.buildingId || '') === keys.buildingId;
  checks.push({
    label: 'building',
    ok: buildingOk,
    detail: `${tx.buildingName || txBuilding?.name || tx.buildingId || '-'} vs ${resolved.building?.name || row.buildingLabel}`,
  });

  const amountExact = amountMatch.ok;
  const amountCanAggregate = rowRental && comparableAmount > 0 && comparableAmount <= targetAmount;
  checks.push({
    label: 'amount',
    ok: amountExact || amountCanAggregate,
    detail: amountExact
      ? `${amountMatch.amount.toLocaleString()} via ${amountMatch.label}${amountMatch.diffCents ? ` (${amountMatch.diffCents / 100} SAR diff)` : ''}`
      : `${txComparableAmount(tx).toLocaleString()} comparable / ${roundAmt(tx.amount).toLocaleString()} amount vs ${roundAmt(row.amount).toLocaleString()}${amountCanAggregate ? ' (can combine)' : ''}`,
  });

  const paymentOk = paymentMethodCompatible(row, tx);
  checks.push({
    label: 'payment',
    ok: paymentOk,
    detail: `${txMethod || tx.paymentMethod || '-'} vs ${rowMethod || row.paymentMethod || '-'}`,
  });

  const typeOk = rowIsIncome === txIsIncome;
  checks.push({
    label: 'type',
    ok: typeOk,
    detail: `${tx.type || '-'} vs ${rowIsIncome ? 'INCOME' : 'EXPENSE'}`,
  });

  const txRental = txSection === 'FLATS_RENT' || txSection === 'SHOP_RENT' || txSection === 'INTERNET';
  const sectionOk =
    row.section === txSection ||
    (rowRental && txRental) ||
    (rowRental && txSection === 'OTHER_INCOME' && rentalSectionHintMatches(row.section, tx));
  checks.push({
    label: 'section',
    ok: sectionOk,
    detail: `${txSection || '-'} vs ${row.section}`,
  });

  const rowMonth = sheetImportMonthKey(row.parsedDate);
  const txMonth = sheetImportMonthKey(tx.date);
  const sameMonth = !!rowMonth && !!txMonth && rowMonth === txMonth;
  const dateOk = sameMonth && (rowRental || dayDiff <= 14);
  checks.push({
    label: 'date',
    ok: dateOk,
    detail: `${tx.date || '-'} (${txMonth || 'no month'}) vs ${row.parsedDate || '-'} (${rowMonth || 'no month'}) · ${dayDiff === 999 ? 'invalid date' : `${dayDiff}d`} · same month required`,
  });

  let unitOk = true;
  let unitDetail = '-';
  if (rowRental) {
    if (tx.unitNumber && keys) {
      const building = buildings.find(b => b.id === keys.buildingId);
      const txUm = matchUnitName(tx.unitNumber, building?.units || [], unitMapping, keys.buildingId);
      const unitScore = unitMatchScore(row.unitNumber || '', tx.unitNumber);
      unitOk = !!(
        (keys.resolvedUnit && txUm.unitName && keys.resolvedUnit === txUm.unitName) ||
        unitScore >= 60
      );
      unitDetail = `${tx.unitNumber} → ${txUm.unitName} vs ${row.unitNumber || '-'} → ${keys.resolvedUnit || '-'} (score ${unitScore})`;
    } else {
      unitOk = dayDiff <= 1 && rentalSectionHintMatches(row.section, tx);
      unitDetail = tx.unitNumber ? tx.unitNumber : 'missing Amlak unit';
    }
    checks.push({ label: 'unit', ok: unitOk, detail: unitDetail });
  }

  const score = keys ? scoreAmlakMatch(row, tx, resolved) : 0;
  const rentalFit = keys ? rentalTxFitsRow(row, tx, keys, buildings, unitMapping) : false;
  const relevance =
    score +
    (eligible ? 10 : 0) +
    (buildingOk ? 20 : 0) +
    (typeOk ? 12 : 0) +
    (sectionOk ? 10 : 0) +
    (paymentOk ? 10 : 0) +
    (dateOk ? 8 : 0) +
    (amountExact ? 18 : amountCanAggregate ? 8 : 0) +
    (unitOk ? 8 : 0) +
    (rentalFit ? 12 : 0);

  return {
    txId: tx.id || '',
    date: tx.date || '',
    type: String(tx.type || ''),
    amount: roundAmt(txComparableAmount(tx)),
    paymentMethod: String(tx.originalPaymentMethod || tx.paymentMethod || ''),
    buildingId: tx.buildingId || '',
    buildingName: tx.buildingName || txBuilding?.name || '',
    unitNumber: tx.unitNumber || '',
    incomeSubType: tx.incomeSubType || '',
    category: String(tx.expenseCategory || ''),
    details: tx.details || '',
    score,
    relevance,
    checks,
  };
}

export function debugSheetRowMatch(
  row: ParsedRow,
  existingTxs: Transaction[],
  ctx: SheetMatchContext,
): SheetMatchDebugInfo {
  const rowKey = rowStableKey(row);
  const resolved = resolveRowKeys(row, ctx);
  const mapReason = needsMapping(row, resolved);
  const amlakPool = existingTxs.filter(isEligibleAmlakTx);
  const result = matchSheetRowsToAmlak([row], existingTxs, ctx).get(rowKey) || { status: 'importable' };

  const keys = resolved.keys;
  const sheetStrict = keys ? buildSheetFingerprint(row, keys, true) : '';
  const sheetLoose = keys ? buildSheetFingerprint(row, keys, false) : '';
  const exactMatches = keys
    ? amlakPool.filter(tx => {
        if (!paymentMethodCompatible(row, tx)) return false;
        const strict = buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, true);
        const loose = buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, false);
        return strict === sheetStrict || strict === sheetLoose || loose === sheetStrict || loose === sheetLoose;
      })
    : [];

  const aggregateCandidates = keys && isRentalSection(row.section)
    ? amlakPool.filter(tx =>
        amountCents(txComparableAmount(tx)) > 0 &&
        amountCents(txComparableAmount(tx)) <= amountCents(row.amount) &&
        rentalTxFitsRow(row, tx, keys, ctx.buildings, ctx.unitMapping)
      )
    : [];
  const aggregateMatch = keys
    ? tryAggregateRentMatch(row, keys, amlakPool, ctx.buildings, ctx.unitMapping, new Set<string>())
    : null;

  const topCandidates = existingTxs
    .map(tx => explainCandidate(row, tx, resolved, ctx.buildings, ctx.unitMapping))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 12);

  return {
    rowKey,
    result,
    sheet: {
      date: row.parsedDate || '',
      section: row.section,
      buildingLabel: row.buildingLabel,
      unitNumber: row.unitNumber || '',
      normalizedUnit: normUnit(row.unitNumber || ''),
      amount: roundAmt(row.amount),
      amountCents: amountCents(row.amount),
      paymentMethod: row.paymentMethod,
      details: row.details || '',
      category: row.category || '',
    },
    resolved: {
      buildingId: resolved.building?.id || '',
      buildingName: resolved.building?.name || '',
      unitName: keys?.resolvedUnit || '',
      unitMatched: resolved.unitMatched,
      mappingReason: mapReason,
    },
    counts: {
      existingTransactions: existingTxs.length,
      eligibleTransactions: amlakPool.length,
    },
    fingerprints: {
      sheetStrict,
      sheetLoose,
      exactMatchCount: exactMatches.length,
    },
    aggregate: {
      enabled: !!keys && isRentalSection(row.section),
      targetAmount: roundAmt(row.amount),
      candidateCount: aggregateCandidates.length,
      candidateTotal: roundAmt(aggregateCandidates.reduce((sum, tx) => sum + roundAmt(txComparableAmount(tx)), 0)),
      matchedIds: aggregateMatch?.txs.map(tx => tx.id).filter(Boolean) || [],
      matchedAmount: aggregateMatch ? roundAmt(aggregateMatch.txs.reduce((sum, tx) => sum + roundAmt(txComparableAmount(tx)), 0)) : 0,
    },
    topCandidates,
  };
}

/**
 * Match sheet rows to existing Amlak transactions (one-to-one).
 */
export function matchSheetRowsToAmlak(
  rows: ParsedRow[],
  existingTxs: Transaction[],
  ctx: SheetMatchContext,
): Map<string, SheetRowMatchResult> {
  const results = new Map<string, SheetRowMatchResult>();
  const amlakPool = existingTxs.filter(isEligibleAmlakTx);

  const exactFpSet = new Set<string>();
  for (const tx of amlakPool) {
    exactFpSet.add(buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, true));
    exactFpSet.add(buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, false));
  }

  const candidates: CandidatePair[] = [];
  const rowMeta = new Map<string, { row: ParsedRow; resolved: ReturnType<typeof resolveRowKeys> }>();

  for (const row of rows) {
    const stableKey = rowStableKey(row);
    const resolved = resolveRowKeys(row, ctx);
    rowMeta.set(stableKey, { row, resolved });

    const mapReason = needsMapping(row, resolved);
    if (mapReason && mapReason !== 'no_unit') {
      results.set(stableKey, { status: 'needs_mapping', mappingReason: mapReason });
      continue;
    }

    if (!resolved.keys) continue;

    const fpStrict = buildSheetFingerprint(row, resolved.keys, true);
    const fpLoose = buildSheetFingerprint(row, resolved.keys, false);
    if (exactFpSet.has(fpStrict) || exactFpSet.has(fpLoose)) {
      const matchedTx = amlakPool.find(tx => {
        if (!paymentMethodCompatible(row, tx)) return false;
        const a = buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, true);
        const b = buildAmlakFingerprint(tx, ctx.buildings, ctx.unitMapping, false);
        return a === fpStrict || a === fpLoose || b === fpStrict || b === fpLoose;
      });
      if (matchedTx) {
        candidates.push({
          rowKey: stableKey,
          row,
          tx: matchedTx,
          score: 100,
          confidence: 'exact',
        });
      }
      continue;
    }

    for (const tx of amlakPool) {
      const score = scoreAmlakMatch(row, tx, resolved);
      const minScore =
        ['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section) ? 70 : 75;
      if (score >= minScore) {
        candidates.push({
          rowKey: stableKey,
          row,
          tx,
          score,
          confidence: score >= 90 ? 'exact' : 'high',
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedTxIds = new Set<string>();
  const usedRowKeys = new Set<string>();

  for (const c of candidates) {
    if (!c.tx?.id) continue;
    if (usedTxIds.has(c.tx.id) || usedRowKeys.has(c.rowKey)) continue;
    usedTxIds.add(c.tx.id);
    usedRowKeys.add(c.rowKey);
    results.set(c.rowKey, {
      status: 'in_amlak',
      confidence: c.confidence,
      matchScore: c.score,
      matchedTxId: c.tx.id,
      matchedTxDate: c.tx.date,
      matchedTxDetails: c.tx.details,
      matchedTxAmount: roundAmt(txComparableAmount(c.tx)),
    });
  }

  const sheetRowGroupCandidates: SheetRowGroupCandidate[] = [];
  for (const row of rows) {
    const stableKey = rowStableKey(row);
    if (results.has(stableKey) || usedRowKeys.has(stableKey)) continue;
    const meta = rowMeta.get(stableKey);
    if (!meta?.resolved.keys) continue;
    if (!isRentalSection(row.section)) continue;
    sheetRowGroupCandidates.push({ rowKey: stableKey, row, keys: meta.resolved.keys });
  }

  for (const tx of amlakPool) {
    if (!tx.id || usedTxIds.has(tx.id)) continue;
    const group = tryAmlakTxToSheetRowsMatch(
      tx,
      sheetRowGroupCandidates.filter(candidate => !usedRowKeys.has(candidate.rowKey)),
      ctx.buildings,
      ctx.unitMapping,
    );
    if (!group) continue;

    usedTxIds.add(tx.id);
    const details = `${tx.details || tx.incomeSubType || 'Income'} | matched ${group.rows.length} sheet rows totaling ${group.sheetTotal.toLocaleString()} against ${group.targetLabel} ${group.targetAmount.toLocaleString()}${group.diffCents ? ` (${group.diffCents / 100} SAR diff)` : ''}`;
    const adjustmentRowKey = group.extraAmount > 0
      ? [...group.rows].sort((a, b) => amountCents(b.row.amount) - amountCents(a.row.amount))[0]?.rowKey
      : '';
    for (const candidate of group.rows) {
      usedRowKeys.add(candidate.rowKey);
      if (candidate.rowKey === adjustmentRowKey) {
        results.set(candidate.rowKey, {
          status: 'importable',
          confidence: 'high',
          matchScore: 88,
          matchedTxId: tx.id,
          matchedTxDate: tx.date,
          matchedTxDetails: details,
          matchedTxAmount: group.targetAmount,
          adjustmentAmount: group.extraAmount,
          adjustmentDetails: `Small extra amount after matching Amlak transaction ${tx.id}: sheet total ${group.sheetTotal.toLocaleString()} vs Amlak ${group.targetAmount.toLocaleString()}`,
        });
        continue;
      }
      results.set(candidate.rowKey, {
        status: 'in_amlak',
        confidence: 'high',
        matchScore: group.diffCents === 0 ? 91 : 88,
        matchedTxId: tx.id,
        matchedTxDate: tx.date,
        matchedTxDetails: details,
        matchedTxAmount: group.targetAmount,
      });
    }
  }

  for (const row of rows) {
    const stableKey = rowStableKey(row);
    if (results.has(stableKey)) continue;

    const meta = rowMeta.get(stableKey);
    if (!meta || meta.resolved.keys === null) continue;

    const aggregate = tryAggregateRentMatch(
      row,
      meta.resolved.keys,
      amlakPool,
      ctx.buildings,
      ctx.unitMapping,
      usedTxIds,
    );
    if (aggregate) {
      aggregate.txs.forEach(tx => tx.id && usedTxIds.add(tx.id));
      results.set(stableKey, {
        status: 'in_amlak',
        confidence: 'high',
        matchScore: aggregate.score,
        matchedTxId: aggregate.txs.map(tx => tx.id).join(','),
        matchedTxDate: aggregate.txs.map(tx => tx.date).filter(Boolean).join(', '),
        matchedTxDetails: aggregate.txs.map(tx => tx.details || tx.incomeSubType || 'Income').join(' + '),
        matchedTxAmount: roundAmt(aggregate.txs.reduce((sum, tx) => sum + roundAmt(txComparableAmount(tx)), 0)),
      });
      continue;
    }

    const soft = trySoftRentMatch(
      row,
      meta.resolved.keys,
      amlakPool,
      ctx.buildings,
      ctx.unitMapping,
      usedTxIds,
    );
    if (soft?.tx?.id) {
      usedTxIds.add(soft.tx.id);
      results.set(stableKey, {
        status: 'in_amlak',
        confidence: 'soft_rent',
        matchScore: soft.score,
        matchedTxId: soft.tx.id,
        matchedTxDate: soft.tx.date,
        matchedTxDetails: soft.tx.details,
        matchedTxAmount: roundAmt(txComparableAmount(soft.tx)),
      });
      continue;
    }

    const mapReason = needsMapping(row, meta.resolved);
    if (mapReason) {
      results.set(stableKey, { status: 'needs_mapping', mappingReason: mapReason });
      continue;
    }

    results.set(stableKey, { status: 'importable' });
  }

  return results;
}

export function isIncomeSection(section: SectionKind): boolean {
  return ['FLATS_RENT', 'SHOP_RENT', 'INTERNET', 'OTHER_INCOME'].includes(section);
}

import type { Contract, Customer, ServiceAgreement, Transaction, Vendor } from '../types';
import { fmtDate } from './dateFormat';

/** Arabic (٠–٩) and Persian (۰–۹) digits → ASCII. */
export function normalizeUnicodeDigits(s: string): string {
  if (!s) return s;
  const arabicZero = 0x0660;
  const persianZero = 0x06f0;
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= arabicZero && cp <= arabicZero + 9) {
      out += String(cp - arabicZero);
    } else if (cp >= persianZero && cp <= persianZero + 9) {
      out += String(cp - persianZero);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Collapse whitespace; strip zero-width / BOM noise. */
export function normalizeSearchWhitespace(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split query on spaces/commas; every token must match (AND).
 * @deprecated Prefer parseSearchQuery + matchesAdvancedSearch pipeline.
 */
export function parseSearchTokens(raw: string): string[] {
  return normalizeSearchWhitespace(normalizeUnicodeDigits(raw))
    .toLowerCase()
    .split(/[\s,]+/u)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Tokens inside a group (AND). Respects "double" and 'single' quotes. Does not split on comma inside numbers. */
export function parseSearchGroupTokens(group: string): string[] {
  const g = normalizeSearchWhitespace(normalizeUnicodeDigits(group));
  const tokens: string[] = [];
  let i = 0;
  while (i < g.length) {
    while (i < g.length && /\s/.test(g[i])) i++;
    if (i >= g.length) break;
    const q = g[i];
    if (q === '"' || q === "'") {
      i++;
      const start = i;
      while (i < g.length && g[i] !== q) i++;
      const inner = g.slice(start, i).trim();
      if (inner) tokens.push(inner.toLowerCase());
      if (i < g.length && g[i] === q) i++;
      continue;
    }
    const start = i;
    while (i < g.length && !/\s/.test(g[i])) {
      // comma between digits is part of one token (e.g. 1,500.00)
      if (g[i] === ',' && i > start && /\d/.test(g[i - 1]) && i + 1 < g.length && /\d/.test(g[i + 1])) {
        i++;
        continue;
      }
      i++;
    }
    const word = g.slice(start, i).trim().toLowerCase();
    if (word) tokens.push(word);
  }
  return tokens;
}

/** OR groups separated by | ; each group uses AND between tokens. */
export function parseSearchOrGroups(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  return s
    .split(/\s*\|\s*/)
    .map((g) => normalizeSearchWhitespace(g))
    .filter(Boolean);
}

function digitOnly(s: string): string {
  return normalizeUnicodeDigits(s).replace(/\D/g, '');
}

/** Start/end markers for canonical money values (exact amount search, avoids "500" matching "1,500"). */
const AMT_FP_START = '\x1eAMT\x1f';
const AMT_FP_END = '\x1eEAMT\x1e';

/**
 * Add a money value to the fingerprint set (rounded to 2 decimals) for exact amount search.
 * Use for SAR amounts, contract totals, etc. — not for counts, percentages, or ratings.
 */
export function addMoneyFingerprint(fp: Set<string>, value: unknown): void {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return;
  const r = Math.round(n * 100) / 100;
  fp.add(r.toFixed(2));
}

/** Append canonical amount fingerprint block to a haystack string. */
export function moneyFingerprintSuffix(fp: Set<string>): string {
  if (fp.size === 0) return '';
  const sorted = [...fp].sort();
  return `${AMT_FP_START}${sorted.join('\x1f')}${AMT_FP_END}`;
}

export function extractMoneyFingerprintsFromHaystack(haystack: string): number[] {
  const i = haystack.indexOf(AMT_FP_START);
  if (i < 0) return [];
  const j = haystack.indexOf(AMT_FP_END, i);
  if (j < 0) return [];
  const inner = haystack.slice(i + AMT_FP_START.length, j);
  const out: number[] = [];
  for (const seg of inner.split('\x1f')) {
    const v = Number.parseFloat(seg);
    if (Number.isFinite(v)) out.push(Math.round(v * 100) / 100);
  }
  return out;
}

export function stripMoneyFingerprintBlock(haystack: string): string {
  return haystack.replace(/\x1eAMT\x1f[\s\S]*?\x1eEAMT\x1e/g, ' ');
}

function nearlyEqualMoney(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * If the token is a plain money literal (with optional commas / SAR suffix), returns the value in SAR (2dp).
 * Returns null for mixed text, phone-like strings, etc.
 */
export function parseSearchAmountToken(token: string): number | null {
  let s = normalizeUnicodeDigits(token).trim().toLowerCase();
  s = s.replace(/\s*(?:sar|s\.?\s*a\.?\s*r\.?|ريال|ر\.?\s*س|rs\.?|usd|\$)\s*$/i, '').trim();
  if (!s) return null;
  const compact = s.replace(/\s/g, '');
  // Saudi-style mobile / national number: avoid treating as a single money amount
  if (/^0\d{8,}$/.test(compact.replace(/,/g, ''))) return null;
  if (!/^[\d,.]+$/.test(compact)) return null;
  const cleaned = compact.replace(/,/g, '');
  if (!cleaned || cleaned === '.') return null;
  const v = Number.parseFloat(cleaned);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

/** Broaden text for substring matching (phones, IBANs, refs). */
function expandHaystackVariants(text: string): string[] {
  const base = normalizeUnicodeDigits(text);
  const lower = base.toLowerCase();
  const variants = new Set<string>();
  variants.add(lower);
  variants.add(lower.replace(/[\s\-_./(),:+]/g, ''));
  const d = digitOnly(lower);
  if (d.length >= 3) variants.add(d);
  return [...variants];
}

function tokenMatchesInBlob(token: string, blob: string, amountFingerprints: number[]): boolean {
  if (!token) return true;
  const q = parseSearchAmountToken(token);
  if (q !== null && amountFingerprints.length > 0) {
    if (amountFingerprints.some((v) => nearlyEqualMoney(v, q))) return true;
  }
  const tNorm = normalizeUnicodeDigits(token).toLowerCase();
  const tVariants = expandHaystackVariants(tNorm);
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasBoundaryPrefix = (prefix: string): boolean => {
    if (!prefix) return false;
    // Match "prefix" at the start of a token (word boundary for letters/digits).
    // This implements progressive prefix search: A -> A..., A1 -> A1...
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(prefix)}`, 'iu');
    return re.test(blob);
  };
  for (const tv of tVariants) {
    if (!tv) continue;
    if (hasBoundaryPrefix(tv)) return true;
  }
  const td = digitOnly(tNorm);
  if (td.length >= 3) {
    // When we have canonical money fingerprints, digit-run matching is disabled for short
    // numeric-only tokens (<9 digits) so "500" does not match inside "1500" or "12,500.00".
    const skipDigitRun =
      q !== null && amountFingerprints.length > 0 && td.length < 9;
    if (!skipDigitRun) {
      const blobDigits = digitOnly(blob);
      if (blobDigits.includes(td)) return true;
    }
  }
  return false;
}

/**
 * Advanced match: Unicode digits, punctuation-stripped variants, digit-run match for phones/amounts,
 * quoted phrases, OR with | between groups, AND within a group.
 * Money amounts on indexed fields use an internal fingerprint block so searching "500" only hits SAR 500.00,
 * not 1,500.00 (substring / digit-run false positives).
 */
export function matchesAdvancedSearch(query: string, haystack: string): boolean {
  const raw = normalizeSearchWhitespace(query);
  if (!raw) return true;
  const amountFingerprints = extractMoneyFingerprintsFromHaystack(haystack);
  const haystackText = stripMoneyFingerprintBlock(haystack);
  const blob = expandHaystackVariants(haystackText).join(' \u0001 ');
  const groups = parseSearchOrGroups(raw);
  const effectiveGroups = groups.length > 0 ? groups : [raw];
  const useOr = effectiveGroups.length > 1 || raw.includes('|');
  const toTest = useOr ? effectiveGroups : [raw];
  return toTest.some((group) => {
    const tokens = parseSearchGroupTokens(group);
    if (tokens.length === 0) return true;
    return tokens.every((tok) => tokenMatchesInBlob(tok, blob, amountFingerprints));
  });
}

/** Non-money numeric fields (counts, months, ratings): substring search only, not exact-money fingerprint. */
function pushNumericSearchText(parts: string[], value: unknown) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return;
  parts.push(String(n));
  if (Math.abs(n - Math.trunc(n)) > 1e-9) parts.push(n.toFixed(2));
}

function flattenVatSnapshot(snap: Record<string, unknown> | undefined): string[] {
  if (!snap || typeof snap !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(snap)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') {
      out.push(...flattenVatSnapshot(v as Record<string, unknown>));
    } else {
      out.push(String(v));
      if (k.toLowerCase().includes('date') && typeof v === 'string') out.push(fmtDate(v));
    }
  }
  return out;
}

/**
 * Flat text for transaction search: IDs, dates (raw + formatted), amounts, parties, VAT, etc.
 * Avoids JSON.stringify (key order noise, huge blobs).
 */
export function buildTransactionSearchHaystack(t: Transaction): string {
  const x = t as Record<string, unknown>;
  const parts: string[] = [];
  const moneyFp = new Set<string>();

  const push = (...vals: (string | number | boolean | null | undefined)[]) => {
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && !v.trim()) continue;
      parts.push(String(v));
    }
  };

  push(
    t.id,
    t.date,
    fmtDate(t.date),
    t.type,
    t.type === 'INCOME' ? 'income rent revenue credit' : '',
    t.type === 'EXPENSE' ? 'expense payment debit cost' : '',
    t.type === 'INFO' ? 'info stock adjustment' : '',
    t.status,
    t.details,
    t.buildingId,
    t.buildingName,
    t.unitNumber,
    t.contractId,
    t.customerName,
    (x.customerId as string) || '',
    t.vendorName,
    t.vendorId,
    (x.vendorRefNo as string) || '',
    t.paymentMethod,
    (x.originalPaymentMethod as string) || '',
    t.bankName,
    (x.fromBankName as string) || '',
    (x.toBankName as string) || '',
    t.vatInvoiceNumber,
    t.customerVATNumber,
    t.vendorVATNumber,
    t.expenseCategory,
    t.expenseSubCategory,
    t.incomeSubType,
    t.employeeName,
    t.employeeId,
    t.ownerName,
    t.ownerId,
    t.chequeNo,
    t.chequeDueDate,
    t.createdBy,
    t.createdByName,
    (x.feeInvoiceNo as string) || '',
    t.serviceAgreementName,
    t.serviceAgreementId,
    t.salaryPeriod,
    t.installmentStartDate,
    t.installmentEndDate,
    t.installmentNumber != null ? `installment ${t.installmentNumber} inst ${t.installmentNumber}` : '',
    t.installmentStartDate ? fmtDate(t.installmentStartDate) : '',
    t.installmentEndDate ? fmtDate(t.installmentEndDate) : '',
    t.serviceAgreementStartDate,
    t.serviceAgreementStartDate ? fmtDate(t.serviceAgreementStartDate) : '',
    t.serviceAgreementEndDate,
    t.serviceAgreementEndDate ? fmtDate(t.serviceAgreementEndDate) : '',
    t.isCreditNote ? 'credit note creditnote cn reversal' : '',
    t.isVATApplicable ? 'vat invoice zatca' : '',
    (x.feesEntry as boolean) ? 'fees fee non-vat' : '',
    (x.vatReportOnly as boolean) ? 'vat report import' : '',
    (x.borrowingType as string) || '',
    (x.stockSaleId as string) || '',
    (x.electricityMeter as string) || '',
    (x.originalInvoiceId as string) || '',
    (x.linkedBorrowingId as string) || '',
    (x.transferId as string) || '',
    (x.source as string) || '',
    (x.fromType as string) || '',
    (x.toType as string) || '',
    (x.building as string) || '',
    (x.building_name as string) || '',
    (x.building_id as string) || '',
    (x.targetBuildingId as string) || '',
    (x.fromId as string) || '',
    (x.toId as string) || '',
    t.isRecurring ? 'recurring' : '',
    t.isAutoPayment ? 'auto payment autopay' : '',
    (x.isExternalBorrower as boolean) ? 'external borrower' : '',
    (x.isStockIssue as boolean) ? 'stock issue inventory' : '',
    (x.isOwnerOpeningBalance as boolean) ? 'owner opening' : '',
    (x.deleted as boolean) ? 'deleted trash' : '',
  );

  addMoneyFingerprint(moneyFp, t.amount);
  addMoneyFingerprint(moneyFp, t.amountExcludingVAT);
  addMoneyFingerprint(moneyFp, t.amountIncludingVAT);
  addMoneyFingerprint(moneyFp, t.totalWithVat);
  addMoneyFingerprint(moneyFp, t.vatAmount);
  addMoneyFingerprint(moneyFp, t.discountAmount);
  addMoneyFingerprint(moneyFp, t.bonusAmount);
  addMoneyFingerprint(moneyFp, t.deductionAmount);
  addMoneyFingerprint(moneyFp, t.extraAmount);
  addMoneyFingerprint(moneyFp, t.borrowDeductionAmount);
  addMoneyFingerprint(moneyFp, t.expectedAmount);
  if (typeof t.vatRate === 'number' && Number.isFinite(t.vatRate)) {
    push(String(t.vatRate), `vat ${t.vatRate}%`, `${t.vatRate}%`);
  }

  if (typeof t.lastModifiedAt === 'number' && t.lastModifiedAt > 0) {
    push(String(t.lastModifiedAt), new Date(t.lastModifiedAt).toISOString());
  }

  const snap = t.vatReportSnapshot as Record<string, unknown> | undefined;
  if (snap) parts.push(...flattenVatSnapshot(snap));

  const items = x.items as unknown[] | undefined;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it && typeof it === 'object') {
        parts.push(JSON.stringify(it).slice(0, 500));
      } else if (it != null) parts.push(String(it));
    }
  }

  const qr = t.zatcaQRCode;
  if (qr && typeof qr === 'string' && qr.length < 400) push(qr);

  return parts.join(' ') + moneyFingerprintSuffix(moneyFp);
}

export function buildCustomerSearchHaystack(c: Customer): string {
  const cx = c as Customer & Record<string, unknown>;
  const parts: string[] = [];
  const push = (...vals: (string | number | boolean | null | undefined)[]) => {
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      parts.push(String(v));
    }
  };
  push(
    c.id,
    c.code,
    c.nameEn,
    c.nameAr,
    c.mobileNo,
    c.email,
    c.idNo,
    c.idSource,
    c.idType,
    c.nationality,
    c.workAddress,
    c.vatNumber,
    c.crNumber,
    c.roomNumber,
    c.notes,
    c.isVatRegistered ? 'vat registered tax' : '',
    c.isBlacklisted ? 'blacklisted blocked' : '',
    c.emailNotifications ? 'email notifications' : '',
    c.smsNotifications ? 'sms notifications' : '',
    (cx.deleted as boolean) ? 'deleted trash' : '',
    c.carPlates?.join(' '),
  );
  if (typeof c.rating === 'number' && Number.isFinite(c.rating)) pushNumericSearchText(parts, c.rating);
  const na = c.nationalAddress;
  if (na) {
    push(
      na.buildingNo,
      na.streetName,
      na.district,
      na.city,
      na.postalCode,
      na.additionalNo,
    );
  }
  return parts.join(' ');
}

export function buildContractSearchHaystack(c: Contract & { daysRemaining?: number }): string {
  const cx = c as Contract & Record<string, unknown>;
  const parts: string[] = [];
  const moneyFp = new Set<string>();
  const push = (...vals: (string | number | boolean | null | undefined)[]) => {
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      parts.push(String(v));
    }
  };
  push(
    c.id,
    c.contractNo,
    c.status,
    c.buildingId,
    c.buildingName,
    c.unitName,
    c.customerId,
    c.customerName,
    c.contractDate,
    fmtDate(c.contractDate),
    c.fromDate,
    fmtDate(c.fromDate),
    c.toDate,
    fmtDate(c.toDate),
    c.notes,
    c.createdBy,
    c.renewedFromId,
    c.electricityMeter,
    c.autoPayment ? 'auto payment autopay' : '',
    typeof c.periodMonths === 'number' ? `months ${c.periodMonths}` : '',
    typeof c.periodDays === 'number' ? `days ${c.periodDays}` : '',
    typeof c.officePercent === 'number' ? `office percent ${c.officePercent}%` : '',
    typeof c.daysRemaining === 'number' ? `days remaining ${c.daysRemaining}` : '',
    String(cx.priorLeaseContractNoAtRenewal || ''),
  );
  addMoneyFingerprint(moneyFp, cx.priorLeaseOutstandingAtRenewal);
  addMoneyFingerprint(moneyFp, cx.priorLeasePaidAtRenewal);
  addMoneyFingerprint(moneyFp, cx.priorLeaseEffectiveTotalAtRenewal);
  addMoneyFingerprint(moneyFp, c.totalValue);
  addMoneyFingerprint(moneyFp, c.rentValue);
  addMoneyFingerprint(moneyFp, c.waterFee);
  addMoneyFingerprint(moneyFp, c.internetFee);
  addMoneyFingerprint(moneyFp, c.parkingFee);
  addMoneyFingerprint(moneyFp, c.managementFee);
  addMoneyFingerprint(moneyFp, c.insuranceFee);
  addMoneyFingerprint(moneyFp, c.serviceFee);
  addMoneyFingerprint(moneyFp, c.officeFeeAmount);
  addMoneyFingerprint(moneyFp, c.otherAmount);
  addMoneyFingerprint(moneyFp, c.otherDeduction);
  addMoneyFingerprint(moneyFp, c.upfrontPaid);
  addMoneyFingerprint(moneyFp, c.firstInstallment);
  addMoneyFingerprint(moneyFp, c.otherInstallment);
  if (typeof c.installmentCount === 'number' && Number.isFinite(c.installmentCount)) {
    push(`installments ${c.installmentCount}`, String(c.installmentCount));
  }
  return parts.join(' ') + moneyFingerprintSuffix(moneyFp);
}

export function buildServiceAgreementSearchHaystack(a: ServiceAgreement): string {
  const parts: string[] = [];
  const moneyFp = new Set<string>();
  const push = (...vals: (string | number | boolean | null | undefined)[]) => {
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      parts.push(String(v));
    }
  };
  push(
    a.id,
    a.name,
    a.vendorName,
    a.vendorId,
    a.agreementType,
    a.buildingId,
    a.buildingName,
    a.startDate,
    fmtDate(a.startDate),
    a.endDate,
    fmtDate(a.endDate),
    a.paymentFrequency,
    a.status,
    a.contactPerson,
    a.contactPhone,
    a.notes,
    a.previousAgreementId,
    (a.renewalHistory || []).join(' '),
    (a.attachments || []).join(' '),
  );
  addMoneyFingerprint(moneyFp, a.amount);
  if (typeof a.durationMonths === 'number' && Number.isFinite(a.durationMonths)) {
    push(`duration months ${a.durationMonths}`, String(a.durationMonths));
  }
  (a.payments || []).forEach((p) => {
    push(p.date, fmtDate(p.date), p.notes);
    addMoneyFingerprint(moneyFp, p.amount);
  });
  return parts.join(' ') + moneyFingerprintSuffix(moneyFp);
}

export function buildVendorSearchHaystack(v: Vendor): string {
  const vx = v as Vendor & Record<string, unknown>;
  const parts: string[] = [];
  const push = (...vals: (string | number | boolean | null | undefined)[]) => {
    for (const x of vals) {
      if (x === undefined || x === null) continue;
      parts.push(String(x));
    }
  };
  push(
    v.id,
    v.name,
    String(vx.nameEn || ''),
    v.serviceType,
    v.phone,
    v.email,
    v.vatNo,
    String(vx.vatNumber || ''),
    v.contactName,
    String(vx.mobileNo || ''),
    v.notes,
    v.contractStartDate,
    v.status,
  );
  pushNumericSearchText(parts, Number(vx.rating));
  return parts.join(' ');
}

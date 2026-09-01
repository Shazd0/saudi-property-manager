import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createOcrWorker } from '../utils/createOcrWorker';
import {
  getLocalAiVisionModel,
  hasGroqApiKey,
  isLocalAiAvailable,
} from '../utils/localAi';
import { extractPurchaseInvoicesWithAi } from '../services/invoiceAiExtractService';
import {
  X, Upload, FileText, ArrowRight, ArrowLeft,
  CheckCircle, Loader, AlertCircle, Trash2, Info, Sparkles, Zap, Cloud,
} from 'lucide-react';
import {
  Transaction, TransactionType, TransactionStatus,
  ExpenseCategory, PaymentMethod, Vendor, Building,
} from '../types';
import { saveTransaction } from '../services/firestoreService';
import { auth } from '../firebase';

// ── Worker ─────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ── Types ───────────────────────────────────────────────────────────────
type SystemField =
  | 'rowNumber'
  | 'date'
  | 'type'
  | 'invoiceNumber'
  | 'vendorName'
  | 'vendorVAT'
  | 'amountExcl'
  | 'amountVAT'
  | 'amountIncl'
  | 'payment'
  | 'description'
  | 'skip';

const FIELD_OPTIONS: { value: SystemField; label: string }[] = [
  { value: 'skip',          label: '— Skip column —' },
  { value: 'rowNumber',     label: '#' },
  { value: 'date',          label: 'DATE' },
  { value: 'type',          label: 'TYPE' },
  { value: 'invoiceNumber', label: 'INVOICE #' },
  { value: 'vendorName',    label: 'PARTY NAME' },
  { value: 'vendorVAT',     label: 'PARTY VAT' },
  { value: 'amountExcl',    label: 'EXCL. VAT' },
  { value: 'amountVAT',     label: 'VAT (15%)' },
  { value: 'amountIncl',    label: 'INCL. VAT' },
  { value: 'payment',       label: 'PAYMENT' },
  { value: 'description',   label: 'DESCRIPTION / NOTES' },
];

interface MappedInvoice {
  id: string;
  date: string;
  invoiceNumber: string;
  vendorName: string;
  vendorVAT: string;
  amountExcl: number;
  vatAmount: number;
  amountIncl: number;
  description: string;
  type?: string;
  valid: boolean;
  errors: string[];
  selected: boolean;
  paymentMethod: PaymentMethod;
}

interface ExcludedRow {
  cells: string[];
  reason: string;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
  vendors: Vendor[];
  buildings: Building[];
}

/** How to read the PDF — Fast OCR is default (no Ollama wait). */
type ImportMode = 'fast' | 'ai-local' | 'ai-cloud';
const IMPORT_MODE_LS = 'amlak_pdf_import_mode';

function loadImportMode(): ImportMode {
  try {
    const v = localStorage.getItem(IMPORT_MODE_LS);
    if (v === 'fast' || v === 'ai-local' || v === 'ai-cloud') return v;
  } catch { /* ignore */ }
  return 'fast';
}

function saveImportMode(mode: ImportMode) {
  try { localStorage.setItem(IMPORT_MODE_LS, mode); } catch { /* ignore */ }
}

function applyTableToMapState(
  dataRows: string[][],
  dominantLen: number,
  skipped: number,
  setters: {
    setColCount: (n: number) => void;
    setSkippedRows: (n: number) => void;
    setAllRows: (r: string[][]) => void;
    setHeaderRowIndex: (n: number) => void;
    setSampleRows: (r: string[][]) => void;
    setColumnMapping: (m: SystemField[]) => void;
    setExtractMethod: (m: 'ai-vision' | 'ai-ocr' | 'table' | null) => void;
    setStep: (s: 'upload' | 'map' | 'preview' | 'done') => void;
  },
) {
  setters.setColCount(dominantLen);
  setters.setSkippedRows(skipped);
  setters.setAllRows(dataRows);
  setters.setExtractMethod('table');

  const isNumberLike = (s: string) => /[\d,]+\.?\d*/.test(s);
  let hIdx = -1;
  for (let i = 0; i < Math.min(3, dataRows.length); i++) {
    if (!dataRows[i].some(isNumberLike)) { hIdx = i; break; }
  }
  setters.setHeaderRowIndex(hIdx);

  const headerRow = hIdx >= 0 ? dataRows[hIdx] : null;
  const display = hIdx >= 0 ? dataRows.slice(hIdx + 1, hIdx + 4) : dataRows.slice(0, 3);
  setters.setSampleRows(display);

  const mapping: SystemField[] = Array.from({ length: dominantLen }, (_, col) => {
    const hint = (headerRow?.[col] ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const samples = display.map(r => r[col] ?? '');

    if (/^#+$|^no\.?$|^s\.?n\.?$|serial|row/.test(hint))     return 'rowNumber';
    if (/^date$|تاريخ/.test(hint))                           return 'date';
    if (/^type$|نوع|category|صنف/.test(hint))                return 'type';
    if (/invoice|inv\b|فاتورة|رقم.*فاتورة/.test(hint))        return 'invoiceNumber';
    if (/party.*name|vendor|supplier|مورد|اسم|party(?!\s*vat)/.test(hint)) return 'vendorName';
    if (/party.*vat|vat.*no|tax.*no|رقم.*ضريب|tax.*reg|vat\s*#/.test(hint)) return 'vendorVAT';
    if (/excl|before|base|صافي|قبل/.test(hint))              return 'amountExcl';
    if (/^vat(\s*\(?15%?\)?)?$|vat\s*\(15%\)|ضريبة|tax.*amnt|vat.*amnt/.test(hint)) return 'amountVAT';
    if (/incl|total|gross|إجمالي/.test(hint))                return 'amountIncl';
    if (/^payment$|pay\b|method|طريقة|دفع/.test(hint))       return 'payment';
    if (/desc|notes|detail|بيان/.test(hint))                 return 'description';
    return autoDetectField(samples);
  });
  setters.setColumnMapping(mapping);
  setters.setStep('map');
}

// ── PDF text / OCR extraction ──────────────────────────────────────────
type PdfTextItem = { str: string; x: number; y: number; w: number };

const AMOUNT_CELL_RE = /^[\d,]+\.?\d{0,3}$/;
const DATE_CELL_RE = /^\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{2,4}$/;
const TOTAL_ROW_RE = /^(total|sub.?total|grand|sum|balance|page|cont)\b/i;

function isAmountLike(cell: string): boolean {
  const cleaned = cell.replace(/[SAR ريال٪%\s]/gi, '').trim();
  return AMOUNT_CELL_RE.test(cleaned);
}

function looksLikeInvoiceDataRow(cells: string[]): boolean {
  const nonEmpty = cells.map((c) => c.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return false;
  if (nonEmpty.length === 1 && TOTAL_ROW_RE.test(nonEmpty[0])) return false;
  const amountCount = nonEmpty.filter(isAmountLike).length;
  const hasDate = nonEmpty.some((c) => DATE_CELL_RE.test(c));
  // Invoice rows usually have at least one amount, or date + several fields.
  return amountCount >= 1 || (hasDate && nonEmpty.length >= 3) || nonEmpty.length >= 4;
}

/** Pad / trim a row to target width, keeping amount columns right-aligned when possible. */
function alignRowToWidth(row: string[], width: number): string[] {
  if (width <= 0) return row;
  if (row.length === width) return [...row];
  if (row.length > width) {
    // Merge overflow from the left (vendor / description often splits into extra cells).
    const keepTail = Math.min(4, width - 1);
    const headSlots = Math.max(1, width - keepTail);
    const headParts = row.slice(0, row.length - keepTail);
    const tail = row.slice(row.length - keepTail);
    const mergedHead: string[] = [];
    if (headParts.length <= headSlots) {
      mergedHead.push(...headParts);
      while (mergedHead.length < headSlots) mergedHead.push('');
    } else {
      const chunk = Math.ceil(headParts.length / headSlots);
      for (let i = 0; i < headSlots; i++) {
        mergedHead.push(headParts.slice(i * chunk, (i + 1) * chunk).join(' ').trim());
      }
    }
    return [...mergedHead.slice(0, headSlots), ...tail].slice(0, width);
  }

  // row.length < width — insert empties before trailing amounts.
  const amountTail: string[] = [];
  const head = [...row];
  while (head.length && isAmountLike(head[head.length - 1])) {
    amountTail.unshift(head.pop()!);
  }
  const amountCols = Math.min(Math.max(amountTail.length, 0), width);
  while (amountTail.length < amountCols) amountTail.unshift('');
  while (head.length + amountTail.length < width) head.push('');
  while (head.length + amountTail.length < width) head.unshift('');
  return [...head, ...amountTail].slice(0, width);
}

function clusterYRows(items: PdfTextItem[], yTol = 12): PdfTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= yTol) {
      last.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

/** Cluster X positions into column start centers from the densest rows. */
function inferColumnCenters(rows: PdfTextItem[][], targetCols: number): number[] {
  const xSamples: number[] = [];
  for (const row of rows) {
    if (row.length < Math.max(2, Math.floor(targetCols * 0.5))) continue;
    for (const item of row) xSamples.push(item.x);
  }
  if (!xSamples.length) {
    // Fallback: use all items
    for (const row of rows) for (const item of row) xSamples.push(item.x);
  }
  xSamples.sort((a, b) => a - b);

  // Greedy cluster: new column when gap is large vs median gap.
  const gaps: number[] = [];
  for (let i = 1; i < xSamples.length; i++) gaps.push(xSamples[i] - xSamples[i - 1]);
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 20;
  const splitGap = Math.max(18, medianGap * 3);

  const clusters: number[][] = [];
  for (const x of xSamples) {
    const cur = clusters[clusters.length - 1];
    if (!cur || x - cur[cur.length - 1] > splitGap) clusters.push([x]);
    else cur.push(x);
  }

  let centers = clusters.map((c) => c.reduce((s, v) => s + v, 0) / c.length);
  // If we got too many columns, merge closest neighbors until targetCols.
  while (centers.length > targetCols && centers.length > 2) {
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centers.length - 1; i++) {
      const d = centers[i + 1] - centers[i];
      if (d < bestDist) { bestDist = d; bestI = i; }
    }
    const merged = (centers[bestI] + centers[bestI + 1]) / 2;
    centers = [...centers.slice(0, bestI), merged, ...centers.slice(bestI + 2)];
  }
  return centers;
}

function assignItemsToColumns(row: PdfTextItem[], centers: number[]): string[] {
  const cells = centers.map(() => '');
  for (const item of row) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const d = Math.abs(item.x - centers[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    cells[best] = cells[best] ? `${cells[best]} ${item.str}`.trim() : item.str.trim();
  }
  return cells.map((c) => c.trim());
}

function estimateDominantColCount(rows: PdfTextItem[][]): number {
  const freq: Record<number, number> = {};
  for (const r of rows) {
    if (r.length >= 2) freq[r.length] = (freq[r.length] || 0) + 1;
  }
  const modal = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return modal ? Number(modal[0]) : 0;
}

async function extractEmbeddedTextRows(file: File): Promise<{ rows: string[][]; pageCount: number; charCount: number }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allItemsByPage: PdfTextItem[][] = [];
  let charCount = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const rawItem of content.items) {
      const item = rawItem as any;
      if (!item.str?.trim()) continue;
      charCount += String(item.str).length;
      const str = String(item.str).trim();
      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      const w = Math.max(str.length * 4, Number(item.width) || 0);
      items.push({ str, x, y, w });
    }
    allItemsByPage.push(items);
  }

  // Build rows with Y clustering, then snap cells to shared column centers.
  const physicalRows: PdfTextItem[][] = [];
  for (const pageItems of allItemsByPage) {
    physicalRows.push(...clusterYRows(pageItems, 12));
  }

  const dominantLen = Math.max(3, estimateDominantColCount(physicalRows));
  const centers = inferColumnCenters(
    physicalRows.filter((r) => r.length >= Math.max(2, dominantLen - 2)),
    dominantLen,
  );

  const allRows: string[][] = [];
  if (centers.length >= 2) {
    for (const row of physicalRows) {
      if (!row.length) continue;
      const cells = assignItemsToColumns(row, centers);
      // Keep row if it has any content
      if (cells.some(Boolean)) allRows.push(cells);
    }
  } else {
    // Fallback: gap-based merge without column snapping
    for (const row of physicalRows) {
      const merged: { str: string; x: number }[] = [];
      for (const item of row) {
        const prev = merged[merged.length - 1];
        if (prev && item.x - (prev.x + prev.str.length * 4) < 6) {
          prev.str += item.str;
        } else {
          merged.push({ str: item.str, x: item.x });
        }
      }
      const cells = merged.map((c) => c.str.trim()).filter(Boolean);
      if (cells.length) allRows.push(cells);
    }
  }

  return { rows: allRows, pageCount: pdf.numPages, charCount };
}

/** Turn OCR / plain text into rough table rows (split on 2+ spaces, tabs, or pipes). */
function textToTableRows(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter((l) => l.length >= 2);

  const rows: string[][] = [];
  for (const line of lines) {
    let cells = line.split(/\s{2,}|\t|\|/).map((c) => c.trim()).filter(Boolean);
    // Fallback: dense single-spaced OCR line — split amount-like tokens / VAT nos
    if (cells.length < 3) {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length >= 3) cells = tokens;
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

async function extractRowsViaOcr(
  file: File,
  onProgress?: (msg: string) => void,
  maxPages = 40,
): Promise<{ rows: string[][]; pageCount: number }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  onProgress?.('Starting fast OCR for scanned PDF…');

  const worker = await createOcrWorker('eng+ara', {
    logger: (m: any) => {
      if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(`OCR: ${Math.round(m.progress * 100)}%`);
      } else if (m?.status) {
        onProgress?.(`OCR: ${m.status}`);
      }
    },
  });

  let ocrText = '';
  const pagesToProcess = Math.min(pdf.numPages, maxPages);
  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      onProgress?.(`OCR page ${pageNum}/${pagesToProcess}…`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      const { data } = await worker.recognize(canvas);
      ocrText += (data.text || '') + '\n';
    }
  } finally {
    await worker.terminate().catch(() => {});
  }

  return { rows: textToTableRows(ocrText), pageCount: pdf.numPages };
}

/**
 * Keep every recoverable invoice-looking row. Short/long rows are aligned to the
 * dominant column count instead of being dropped (that was cutting 31 → 25).
 */
function findDominantTable(rows: string[][]): { dominantLen: number; dataRows: string[][]; skipped: number } | null {
  const freq: Record<number, number> = {};
  for (const r of rows) {
    const n = r.filter(Boolean).length;
    if (n >= 3) freq[r.length] = (freq[r.length] || 0) + 1;
    else if (n === 2) freq[Math.max(2, r.length)] = (freq[Math.max(2, r.length)] || 0) + 1;
  }
  const modalEntry = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  if (!modalEntry) return null;

  const dominantLen = Number(modalEntry[0]);
  const dataRows: string[][] = [];
  let skipped = 0;

  for (const r of rows) {
    const nonEmpty = r.filter(Boolean);
    if (!nonEmpty.length) {
      skipped++;
      continue;
    }
    // Pure title / total lines without amounts — skip only when clearly not an invoice
    if (nonEmpty.length <= 2 && !nonEmpty.some(isAmountLike) && !looksLikeInvoiceDataRow(r)) {
      skipped++;
      continue;
    }
    if (!looksLikeInvoiceDataRow(r) && r.length < Math.max(2, dominantLen - 3)) {
      skipped++;
      continue;
    }
    dataRows.push(alignRowToWidth(r, dominantLen));
  }

  if (dataRows.length === 0) return null;
  return { dominantLen, dataRows, skipped };
}

async function extractRows(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ rows: string[][]; pageCount: number; usedOcr: boolean; skipped: number }> {
  onProgress?.('Reading PDF text…');
  const embedded = await extractEmbeddedTextRows(file);
  let table = findDominantTable(embedded.rows);
  // Scanned PDFs usually have almost no embedded text / no ≥3-column rows
  if (table && embedded.charCount >= 40) {
    return {
      rows: table.dataRows,
      pageCount: embedded.pageCount,
      usedOcr: false,
      skipped: table.skipped,
    };
  }

  onProgress?.('No selectable text table found — running OCR…');
  const ocr = await extractRowsViaOcr(file, onProgress);
  table = findDominantTable(ocr.rows);
  if (!table) {
    // Last resort: keep raw OCR lines as single-column-ish rows for manual mapping help
    throw new Error(
      'Could not detect invoice rows in this PDF (including after OCR). ' +
        'Try a clearer scan, or export the purchases as a text PDF / Excel and import again.',
    );
  }
  return {
    rows: table.dataRows,
    pageCount: ocr.pageCount,
    usedOcr: true,
    skipped: table.skipped,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────
function parseAmount(s: string): number {
  if (!s) return 0;
  // Handle Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩
  const latinised = s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  // Remove currency labels, strip commas used as thousands separator, keep digits and decimal point
  const cleaned = latinised
    .replace(/SAR|ريال|SR|﷼/gi, '')
    .replace(/,(?=\d{3}(?:[,.]|$))/g, '')   // strip thousands commas
    .replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function normalizeDate(s: string): string {
  if (!s) return new Date().toISOString().split('T')[0];
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY  or  DD-MM-YYYY  (KSA convention)
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

function autoDetectField(samples: string[]): SystemField {
  const nonEmpty = samples.filter(Boolean);
  if (!nonEmpty.length) return 'skip';
  if (nonEmpty.every(s => /^\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{2,4}$/.test(s))) return 'date';
  if (nonEmpty.every(s => /^3\d{14}$/.test(s.replace(/\s/g, '')))) return 'vendorVAT';
  if (nonEmpty.every(s => /^[\d,]+\.?\d{0,3}$/.test(s.replace(/[SAR ريال٪%]/g, '').trim()))) return 'amountExcl';
  return 'skip';
}

function normalizePaymentMethod(raw: string, fallback: PaymentMethod): PaymentMethod {
  const s = raw.trim().toLowerCase();
  if (!s) return fallback;
  if (/cash|نقد|كاش/.test(s)) return PaymentMethod.CASH;
  if (/cheque|check|شيك/.test(s)) return PaymentMethod.CHEQUE;
  if (/bank|transfer|حوالة|تحويل|wire|ach|iban|card|mada|visa|master/.test(s)) return PaymentMethod.BANK;
  const match = Object.values(PaymentMethod).find(m => m.toLowerCase() === s);
  return match || fallback;
}

function buildInvoice(
  row: string[],
  mapping: SystemField[],
  defaultCategory: string,
  idx: number,
  defaultPaymentMethod: PaymentMethod = PaymentMethod.BANK,
): MappedInvoice {
  const get = (field: SystemField): string => {
    const i = mapping.indexOf(field);
    return i >= 0 ? (row[i] ?? '') : '';
  };

  const rawExcl = get('amountExcl');
  const rawVAT  = get('amountVAT');
  const rawIncl = get('amountIncl');

  let amountExcl = parseAmount(rawExcl);
  let vatAmount  = parseAmount(rawVAT);
  let amountIncl = parseAmount(rawIncl);

  // Derive missing amounts
  if (amountExcl && vatAmount  && !amountIncl) amountIncl = amountExcl + vatAmount;
  else if (amountExcl && amountIncl && !vatAmount)  vatAmount  = amountIncl - amountExcl;
  else if (amountIncl && vatAmount  && !amountExcl) amountExcl = amountIncl - vatAmount;
  else if (amountExcl && !vatAmount && !amountIncl) {
    vatAmount  = Math.round(amountExcl * 0.15 * 100) / 100;
    amountIncl = Math.round(amountExcl * 1.15 * 100) / 100;
  } else if (amountIncl && !vatAmount && !amountExcl) {
    amountExcl = Math.round((amountIncl / 1.15) * 100) / 100;
    vatAmount  = amountIncl - amountExcl;
  } else if (vatAmount && !amountExcl && !amountIncl) {
    amountExcl = Math.round((vatAmount / 0.15) * 100) / 100;
    amountIncl = amountExcl + vatAmount;
  }

  const type = get('type').trim();
  const descFromPdf = get('description').trim();
  const description = descFromPdf
    || (type ? `${type} – ${defaultCategory}` : `PDF Import – ${defaultCategory}`);

  const errors: string[] = [];
  if (!amountExcl && !amountIncl) errors.push('No amount found');

  return {
    id: `pdf-${Date.now()}-${idx}`,
    date: normalizeDate(get('date')),
    invoiceNumber: get('invoiceNumber') || `PDF-${Date.now().toString(36).toUpperCase()}-${idx}`,
    vendorName: get('vendorName'),
    vendorVAT: get('vendorVAT'),
    amountExcl:  Math.round(amountExcl  * 100) / 100,
    vatAmount:   Math.round(vatAmount   * 100) / 100,
    amountIncl:  Math.round(amountIncl  * 100) / 100,
    description,
    type: type || undefined,
    valid: errors.length === 0,
    errors,
    selected: errors.length === 0,
    paymentMethod: normalizePaymentMethod(get('payment'), defaultPaymentMethod),
  };
}

// ── Component ────────────────────────────────────────────────────────────
const PdfPurchaseImport: React.FC<Props> = ({ onClose, onImported, buildings }) => {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');

  // Upload step
  const [parsing, setParsing]     = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [parseError, setParseError] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Parsed data
  const [allRows,        setAllRows]        = useState<string[][]>([]);
  const [colCount,       setColCount]       = useState(0);
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);
  const [sampleRows,     setSampleRows]     = useState<string[][]>([]);
  const [skippedRows,    setSkippedRows]    = useState(0);

  // Preview
  const [invoices,      setInvoices]      = useState<MappedInvoice[]>([]);
  const [excludedRows,  setExcludedRows]  = useState<ExcludedRow[]>([]);
  const [showExcluded,  setShowExcluded]  = useState(false);

  // Field mapping
  const [columnMapping,        setColumnMapping]        = useState<SystemField[]>([]);
  const [defaultCategory,      setDefaultCategory]      = useState<string>(ExpenseCategory.VENDOR_PAYMENT);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK);

  // Import
  const [importing,    setImporting]    = useState(false);
  const [importCount,  setImportCount]  = useState(0);
  const [extractMethod, setExtractMethod] = useState<'ai-vision' | 'ai-ocr' | 'table' | null>(null);
  const [aiNotes, setAiNotes] = useState('');
  const [localAiReady, setLocalAiReady] = useState<boolean | null>(null);
  const [aiProviderLabel, setAiProviderLabel] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>(loadImportMode);

  const setMode = (mode: ImportMode) => {
    setImportMode(mode);
    saveImportMode(mode);
  };

  useEffect(() => {
    // Only probe Ollama when user may use local AI — avoids CORS spam on Fast OCR.
    if (importMode !== 'ai-local') return;
    let cancelled = false;
    (async () => {
      const ok = await isLocalAiAvailable(true);
      if (cancelled) return;
      setLocalAiReady(ok);
      if (ok) setAiProviderLabel(`Ollama · ${getLocalAiVisionModel()}`);
      else setAiProviderLabel('');
    })();
    return () => { cancelled = true; };
  }, [importMode]);

  // ── Parse PDF ───────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Please select a PDF file.');
      return;
    }
    setParsing(true);
    setParseError('');
    setSourceFileName(file.name);
    setAiNotes('');
    setExtractMethod(null);
    setParseStatus('Reading PDF…');

    const mapSetters = {
      setColCount, setSkippedRows, setAllRows, setHeaderRowIndex,
      setSampleRows, setColumnMapping, setExtractMethod, setStep,
    };

    try {
      // ── Fast OCR / text table (default) — no Ollama ───────────────
      if (importMode === 'fast') {
        setParseStatus('Fast OCR / table parse…');
        const { rows, usedOcr, skipped } = await extractRows(file, setParseStatus);
        if (!rows.length) {
          setParseError(
            'Could not detect invoice rows with Fast OCR' +
              (usedOcr ? '' : '') +
              '. Try Cloud AI (if you have a Groq key) for messy scans, or export as Excel / a text PDF.',
          );
          return;
        }
        // rows already aligned by findDominantTable — do not filter again
        applyTableToMapState(rows, rows[0]?.length || 0, skipped, mapSetters);
        return;
      }

      // ── AI paths (optional) ───────────────────────────────────────
      const prefer = importMode === 'ai-local' ? 'local' as const : 'groq' as const;
      if (prefer === 'local') {
        const localOk = await isLocalAiAvailable();
        setLocalAiReady(localOk);
        if (!localOk) {
          setParseError('Local Ollama is offline. Start Ollama, or switch to Fast OCR / Cloud AI.');
          return;
        }
      } else if (!hasGroqApiKey()) {
        setParseError('No Groq API key. Open Amlak AI → Settings to add one, or use Fast OCR.');
        return;
      }

      setParseStatus(prefer === 'local'
        ? `Local AI (${getLocalAiVisionModel()}) — this can take a long time…`
        : 'Cloud AI: analyzing scanned invoices…');
      const ai = await extractPurchaseInvoicesWithAi(file, setParseStatus, defaultPaymentMethod, prefer);
      if (ai.invoices.length > 0) {
        const mapped: MappedInvoice[] = ai.invoices.map((inv) => ({
          ...inv,
          description: inv.description || `AI Import – ${defaultCategory}`,
          paymentMethod: defaultPaymentMethod,
        }));
        setInvoices(mapped);
        setExcludedRows([]);
        setExtractMethod(ai.method === 'vision' ? 'ai-vision' : 'ai-ocr');
        setAiNotes(ai.notes || '');
        setAiProviderLabel(ai.provider === 'local'
          ? `Ollama · ${getLocalAiVisionModel()}`
          : 'Groq cloud');
        setStep('preview');
        return;
      }

      setAiNotes(ai.notes || '');
      setParseStatus('AI found no invoices — falling back to Fast OCR…');
      const { rows, usedOcr, skipped } = await extractRows(file, setParseStatus);
      if (!rows.length) {
        setParseError(
          'Could not detect invoices' +
            (usedOcr ? ' after OCR' : '') +
            '. Try a clearer scan or Excel export.',
        );
        return;
      }
      applyTableToMapState(rows, rows[0]?.length || 0, skipped, mapSetters);
    } catch (e: any) {
      setParseError(e?.message || 'Failed to parse PDF.');
    } finally {
      setParsing(false);
      setParseStatus('');
    }
  }, [defaultCategory, defaultPaymentMethod, importMode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Build preview from mapping ──────────────────────────────────────
  const handleBuildPreview = useCallback(() => {
    const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const candidateRows = allRows.slice(start);

    const SKIP_PATTERNS = TOTAL_ROW_RE;
    const excluded: ExcludedRow[] = [];
    const filtered: string[][] = [];

    for (const r of candidateRows) {
      const aligned = alignRowToWidth(r, colCount);
      const nonEmpty = aligned.filter(Boolean);
      if (nonEmpty.length === 0) continue;
      if (nonEmpty.length === 1 && SKIP_PATTERNS.test(nonEmpty[0])) {
        excluded.push({ cells: r, reason: 'Looks like a total / page-break row' });
        continue;
      }
      // Keep every recoverable row — align short/long rows instead of dropping them
      if (!looksLikeInvoiceDataRow(aligned) && nonEmpty.length < 2) {
        excluded.push({ cells: r, reason: 'Too few fields to be an invoice row' });
        continue;
      }
      filtered.push(aligned);
    }

    setExcludedRows(excluded);
    setShowExcluded(false);
    setInvoices(filtered.map((r, i) => buildInvoice(r, columnMapping, defaultCategory, i, defaultPaymentMethod)));
    setStep('preview');
  }, [allRows, colCount, headerRowIndex, columnMapping, defaultCategory, defaultPaymentMethod]);

  // Add an excluded row back as an invoice
  const includeExcludedRow = useCallback((excRow: ExcludedRow) => {
    const padded = [...excRow.cells];
    while (padded.length < colCount) padded.push('');
    const inv = buildInvoice(padded.slice(0, colCount), columnMapping, defaultCategory, Date.now(), defaultPaymentMethod);
    setInvoices(prev => [...prev, inv]);
    setExcludedRows(prev => prev.filter(r => r !== excRow));
  }, [colCount, columnMapping, defaultCategory, defaultPaymentMethod]);

  // ── Import ──────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (importing) return;
    const toImport = invoices.filter(inv => inv.selected && inv.valid);
    setImporting(true);
    let count = 0;
    const uid = auth.currentUser?.uid || 'pdf-import';
    const batchId = `pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = sourceFileName || 'purchase-import.pdf';
    for (const inv of toImport) {
      const tx: Omit<Transaction, 'id'> = {
        type: TransactionType.EXPENSE,
        date: inv.date,
        amount: inv.amountExcl,
        paymentMethod: inv.paymentMethod,
        details: inv.description,
        status: TransactionStatus.APPROVED,
        userId: uid,
        isVATApplicable: true,
        vatRate: 15,
        vatAmount: inv.vatAmount,
        amountExcludingVAT: inv.amountExcl,
        amountIncludingVAT: inv.amountIncl,
        totalWithVat: inv.amountIncl,
        // Use the invoice number directly from the PDF — only fall back to generated if blank
        vatInvoiceNumber: inv.invoiceNumber || `PDF-${Date.now().toString(36).toUpperCase()}-${count}`,
        vendorName: inv.vendorName,
        vendorVATNumber: inv.vendorVAT,
        expenseCategory: defaultCategory,
        vatReportOnly: true,
        source: 'pdf_purchase_import',
        pdfImportBatchId: batchId,
        pdfImportFileName: fileName,
      } as Transaction;
      await saveTransaction(tx);
      count++;
    }
    setImportCount(count);
    setImporting(false);
    setStep('done');
    onImported();
  }, [invoices, defaultCategory, onImported, sourceFileName]);

  // ── Derived values ──────────────────────────────────────────────────
  const dataRows      = allRows.map((r) => alignRowToWidth(r, colCount || r.length));
  const headerRow     = headerRowIndex >= 0 ? dataRows[headerRowIndex] : null;
  const totalDataRows = Math.max(0, dataRows.length - (headerRowIndex >= 0 ? 1 : 0));
  const selectedInvs  = invoices.filter(i => i.selected);
  const selectedCount = selectedInvs.length;
  const sumExcl  = selectedInvs.reduce((s, i) => s + i.amountExcl, 0);
  const sumVAT   = selectedInvs.reduce((s, i) => s + i.vatAmount,  0);
  const sumIncl  = selectedInvs.reduce((s, i) => s + i.amountIncl, 0);
  const hasInvalid = invoices.filter(i => i.selected).some(i => !i.valid);

  const STEPS = ['upload', 'map', 'preview', 'done'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 rounded-xl shadow">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-base sm:text-lg">
                Import Purchase Invoices from PDF
              </h2>
              <p className="text-xs text-slate-500">
                Fast OCR for scans · optional AI · map · preview · import
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done    = STEPS.indexOf(step) > i;
            const current = step === s;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all
                  ${current ? 'bg-amber-600 text-white shadow' :
                    done    ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-200 text-slate-400'}`}>
                  {done ? <CheckCircle size={11} /> : <span>{i + 1}</span>}
                  {s === 'upload' ? 'Upload PDF' : s === 'map' ? 'Map Fields' : s === 'preview' ? 'Preview' : 'Done'}
                </div>
                {i < 3 && <ArrowRight size={11} className="text-slate-300 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">

          {/* ══════════════ STEP 1 – UPLOAD ══════════════ */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Import mode — Fast OCR default (skips slow Ollama) */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">How should we read this PDF?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('fast')}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      importMode === 'fast'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                      <Zap size={14} className="text-emerald-600" /> Fast OCR
                      <span className="ml-auto text-[9px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Recommended</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Local Tesseract OCR + column mapping. Best for scanned packs — no Ollama wait.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('ai-cloud')}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      importMode === 'ai-cloud'
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                      <Cloud size={14} className="text-sky-600" /> Cloud AI
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Groq vision (needs API key in Amlak AI). Faster than local Ollama for messy scans.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('ai-local')}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      importMode === 'ai-local'
                        ? 'border-violet-500 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                      <Sparkles size={14} className="text-violet-600" /> Local AI
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Ollama (`{getLocalAiVisionModel()}`) — accurate but slow on multi-page PDFs.
                    </p>
                  </button>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl p-10 sm:p-14 text-center cursor-pointer hover:bg-amber-50 transition-all group"
              >
                <Upload size={44} className="mx-auto mb-3 text-amber-400 group-hover:text-amber-600 transition-colors" />
                <p className="font-black text-slate-700 text-lg">Drop your PDF here or click to browse</p>
                <p className="text-sm text-slate-400 mt-1">
                  {importMode === 'fast'
                    ? 'Fast OCR will read scanned pages and let you map columns'
                    : importMode === 'ai-cloud'
                      ? 'Cloud AI will try to fill invoice fields automatically'
                      : 'Local AI will read each page (can take many minutes)'}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Default Expense Category</label>
                  <select
                    value={defaultCategory}
                    onChange={e => setDefaultCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Default Payment Method</label>
                  <select
                    value={defaultPaymentMethod}
                    onChange={e => setDefaultPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {parsing && (
                <div className="flex flex-col items-center justify-center gap-2 py-4 text-amber-600 font-bold">
                  <div className="flex items-center gap-3">
                    <Loader size={20} className="animate-spin" /> {parseStatus || 'Parsing PDF…'}
                  </div>
                  <p className="text-xs font-semibold text-amber-500/90 text-center max-w-md">
                    {importMode === 'ai-local'
                      ? 'Local AI reads one page at a time — large PDFs can take a long time.'
                      : importMode === 'ai-cloud'
                        ? 'Cloud AI is analyzing pages…'
                        : 'Fast OCR is scanning pages — usually much quicker than local AI.'}
                  </p>
                </div>
              )}
              {parseError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm font-semibold">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p>{parseError}</p>
                </div>
              )}

              {importMode === 'ai-local' && (
                <div className={`rounded-xl p-4 border ${localAiReady ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs font-bold mb-1 flex items-center gap-1.5 ${localAiReady ? 'text-violet-700' : 'text-amber-800'}`}>
                    <Sparkles size={13} />
                    {localAiReady ? 'Local AI ready' : localAiReady === false ? 'Ollama offline' : 'Checking Ollama…'}
                  </p>
                  <p className={`text-xs ${localAiReady ? 'text-violet-700' : 'text-amber-800'}`}>
                    {localAiReady
                      ? `Using ${getLocalAiVisionModel()} via /ollama proxy.`
                      : 'Start Ollama, or switch to Fast OCR for quicker imports.'}
                  </p>
                </div>
              )}
              {importMode === 'ai-cloud' && !hasGroqApiKey() && (
                <div className="rounded-xl p-4 border bg-amber-50 border-amber-200">
                  <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <Cloud size={13} /> Groq key needed
                  </p>
                  <p className="text-xs text-amber-800">
                    Open Amlak AI → Settings and paste a free key from console.groq.com, or use Fast OCR instead.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                  <Info size={13} /> Tips
                </p>
                <ul className="text-xs text-blue-600 space-y-1 list-disc ml-4">
                  <li><strong>Fast OCR</strong> is best for multi-page phone scans (like Scanned_*.pdf)</li>
                  <li>Map columns on the next step if OCR shuffles fields</li>
                  <li>Use Cloud / Local AI only when Fast OCR can’t find rows</li>
                  <li>Only excl. or incl. VAT amount is required — 15% VAT is derived when missing</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══════════════ STEP 2 – MAP FIELDS ══════════════ */}
          {step === 'map' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                <span className="font-bold text-slate-700">
                  Detected{' '}
                  <span className="text-amber-600">{totalDataRows} data row{totalDataRows !== 1 ? 's' : ''}</span>
                  {' '}with{' '}
                  <span className="text-amber-600">{colCount} column{colCount !== 1 ? 's' : ''}</span>
                  {headerRow && <span className="text-slate-500"> · header row auto-detected</span>}                {skippedRows > 0 && <span className="text-rose-500"> · {skippedRows} rows skipped (different structure)</span>}                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign each column to the correct field. Sample values from the first 3 rows are shown.
                </p>
              </div>

              {/* Default settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Default Expense Category</label>
                  <select
                    value={defaultCategory}
                    onChange={e => setDefaultCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Default Payment Method</label>
                  <select
                    value={defaultPaymentMethod}
                    onChange={e => setDefaultPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Column mapping table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 w-10">#</th>
                      {headerRow && (
                        <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500">
                          PDF Header
                        </th>
                      )}
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500">
                        Sample values (first 3 rows)
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 min-w-[200px]">
                        Map to field ↓
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: colCount }, (_, col) => (
                      <tr key={col} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-xs font-bold">{col + 1}</td>
                        {headerRow && (
                          <td className="px-3 py-2.5 font-semibold text-slate-700 text-xs">
                            {headerRow[col] || <span className="text-slate-300 italic">—</span>}
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {sampleRows.slice(0, 3).map((r, ri) => (
                              <span
                                key={ri}
                                className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600 max-w-[120px] truncate"
                                title={r[col]}
                              >
                                {r[col] ?? <span className="text-slate-300">—</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={columnMapping[col] || 'skip'}
                            onChange={e => {
                              const m = [...columnMapping];
                              m[col] = e.target.value as SystemField;
                              setColumnMapping(m);
                            }}
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold
                              ${columnMapping[col] && columnMapping[col] !== 'skip'
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-slate-300 text-slate-500'}`}
                          >
                            {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mapping summary badges */}
              <div className="flex flex-wrap gap-2">
                {columnMapping
                  .filter(m => m !== 'skip')
                  .map((m, i) => (
                    <span key={i} className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                      {FIELD_OPTIONS.find(f => f.value === m)?.label ?? m}
                    </span>
                  ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={handleBuildPreview}
                  disabled={!columnMapping.some(m => m !== 'skip')}
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  Preview {totalDataRows} Invoice{totalDataRows !== 1 ? 's' : ''}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ STEP 3 – PREVIEW ══════════════ */}
          {step === 'preview' && (
            <div className="space-y-4">

              {(extractMethod === 'ai-vision' || extractMethod === 'ai-ocr') && (
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 text-violet-800 p-3 rounded-xl text-xs font-semibold">
                  <Sparkles size={16} className="flex-shrink-0 mt-0.5 text-violet-600" />
                  <div>
                    <p>
                      Extracted with {extractMethod === 'ai-vision' ? 'AI vision' : 'OCR + AI'}
                      {aiProviderLabel ? ` (${aiProviderLabel})` : ''} — review amounts and vendor details before import.
                    </p>
                    {aiNotes && <p className="mt-1 font-normal text-violet-600/90">{aiNotes}</p>}
                  </div>
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Selected</div>
                  <div className="text-2xl font-black text-amber-700">{selectedCount}</div>
                  <div className="text-[10px] text-amber-500">invoices</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Excl. VAT</div>
                  <div className="text-lg font-black text-slate-800">{sumExcl.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">SAR</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">VAT (15%)</div>
                  <div className="text-lg font-black text-blue-700">{sumVAT.toLocaleString()}</div>
                  <div className="text-[10px] text-blue-400">SAR</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">Incl. VAT</div>
                  <div className="text-lg font-black text-emerald-700">{sumIncl.toLocaleString()}</div>
                  <div className="text-[10px] text-emerald-400">SAR</div>
                </div>
              </div>

              {/* Select all row */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={invoices.length > 0 && invoices.every(i => i.selected)}
                  onChange={e => setInvoices(prev => prev.map(i => ({ ...i, selected: e.target.checked })))}
                  className="rounded w-4 h-4 cursor-pointer"
                />
                <label htmlFor="selectAll" className="text-sm font-bold text-slate-600 cursor-pointer">
                  Select / Deselect All
                </label>
                <span className="text-xs text-slate-400 ml-auto">
                  {selectedCount} of {invoices.length} row{invoices.length !== 1 ? 's' : ''} selected
                </span>
              </div>

              {/* Invoice table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-2.5 text-left font-bold text-slate-400 w-8">#</th>
                      <th className="px-2 py-2.5 w-8"></th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-500">Date</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-500">Invoice No.</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-500">Vendor</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-500 font-mono">VAT No.</th>
                      <th className="px-3 py-2.5 text-right font-bold text-slate-500">Excl. VAT</th>
                      <th className="px-3 py-2.5 text-right font-bold text-slate-500">VAT</th>
                      <th className="px-3 py-2.5 text-right font-bold text-slate-500">Incl. VAT</th>
                      <th className="px-3 py-2.5 text-left font-bold text-slate-500">Payment</th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr
                        key={inv.id}
                        className={`border-b border-slate-100 transition-colors
                          ${!inv.valid        ? 'bg-rose-50/70' :
                            inv.selected      ? 'bg-white hover:bg-slate-50' :
                                                'bg-slate-50/60 opacity-50'}`}
                      >
                        <td className="px-2 py-2 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={inv.selected}
                            onChange={e => setInvoices(prev =>
                              prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x)
                            )}
                            className="rounded w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{inv.date}</td>
                        <td className="px-3 py-2 font-mono text-purple-700 max-w-[100px] truncate" title={inv.invoiceNumber}>
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700 max-w-[120px] truncate" title={inv.vendorName}>
                          {inv.vendorName || <span className="text-slate-300 italic">N/A</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-700 text-[10px]">
                          {inv.vendorVAT || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                          {inv.amountExcl.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">
                          {inv.vatAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">
                          {inv.amountIncl.toLocaleString()}
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={inv.paymentMethod}
                            onChange={e => setInvoices(prev =>
                              prev.map((x, j) => j === i ? { ...x, paymentMethod: e.target.value as PaymentMethod } : x)
                            )}
                            className="text-[10px] font-bold border border-slate-300 rounded-lg px-1.5 py-1 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          >
                            <option value={PaymentMethod.BANK}>Bank</option>
                            <option value={PaymentMethod.CASH}>Cash</option>
                            {Object.values(PaymentMethod).filter(m => m !== PaymentMethod.BANK && m !== PaymentMethod.CASH).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          {inv.errors.length > 0 ? (
                            <span
                              title={inv.errors.join(', ')}
                              className="text-rose-500 cursor-help"
                            >
                              <AlertCircle size={13} />
                            </span>
                          ) : (
                            <button
                              onClick={() => setInvoices(prev => prev.filter((_, j) => j !== i))}
                              className="p-0.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Remove row"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-center text-slate-400 text-sm">
                          No rows to display.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {hasInvalid && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  Rows marked in red have errors (missing amount). Uncheck or delete them before importing.
                </div>
              )}

              {/* ── Excluded / skipped rows panel ── */}
              {excludedRows.length > 0 && (
                <div className="border border-orange-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowExcluded(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-sm font-bold text-orange-800"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-orange-500" />
                      {excludedRows.length} line{excludedRows.length !== 1 ? 's' : ''} were excluded — click to review
                    </span>
                    <span className="text-orange-500 text-xs font-bold">{showExcluded ? '▲ Hide' : '▼ Show'}</span>
                  </button>

                  {showExcluded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-orange-50/60 border-b border-orange-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-orange-700 w-10">#</th>
                            <th className="px-3 py-2 text-left font-bold text-orange-700">Raw cell values</th>
                            <th className="px-3 py-2 text-left font-bold text-orange-700 w-56">Why excluded</th>
                            <th className="px-3 py-2 w-24 text-center font-bold text-orange-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excludedRows.map((er, i) => (
                            <tr key={i} className="border-b border-orange-100 hover:bg-orange-50 transition-colors">
                              <td className="px-3 py-2 text-center font-black text-orange-400 font-mono">{i + 1}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {er.cells.filter(Boolean).map((c, j) => (
                                    <span key={j} className="px-1.5 py-0.5 bg-white border border-orange-200 rounded text-[11px] font-mono text-slate-700 max-w-[140px] truncate" title={c}>{c}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-orange-600 font-semibold">{er.reason}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => includeExcludedRow(er)}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  + Include
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(extractMethod === 'table' ? 'map' : 'upload')}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0 || hasInvalid}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  {importing
                    ? <><Loader size={16} className="animate-spin" /> Importing…</>
                    : <><CheckCircle size={16} /> Import {selectedCount} Purchase Invoice{selectedCount !== 1 ? 's' : ''}</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ STEP 4 – DONE ══════════════ */}
          {step === 'done' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Import Complete!</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                <strong className="text-emerald-700">{importCount} purchase invoice{importCount !== 1 ? 's' : ''}</strong>{' '}
                have been added to the VAT report as expense transactions.
              </p>
              <p className="text-xs text-slate-400">They will appear in the Purchase tab of the VAT Report.</p>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PdfPurchaseImport;

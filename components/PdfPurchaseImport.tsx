import React, { useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X, Upload, FileText, ArrowRight, ArrowLeft,
  CheckCircle, Loader, AlertCircle, Trash2, Info,
} from 'lucide-react';
import {
  Transaction, TransactionType, TransactionStatus,
  ExpenseCategory, PaymentMethod, Vendor, Building,
} from '../types';
import { saveTransaction } from '../services/firestoreService';
import { auth } from '../firebase';

// ── Worker ─────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ── Types ───────────────────────────────────────────────────────────────
type SystemField =
  | 'date' | 'invoiceNumber' | 'vendorName' | 'vendorVAT'
  | 'amountExcl' | 'amountVAT' | 'amountIncl' | 'description' | 'skip';

const FIELD_OPTIONS: { value: SystemField; label: string }[] = [
  { value: 'skip',          label: '— Skip column —' },
  { value: 'date',          label: '📅 Date' },
  { value: 'invoiceNumber', label: '🔖 Invoice Number' },
  { value: 'vendorName',    label: '🏢 Vendor Name' },
  { value: 'vendorVAT',     label: '🔢 Vendor VAT No.' },
  { value: 'amountExcl',    label: '💰 Amount (Excl. VAT)' },
  { value: 'amountVAT',     label: '🧾 VAT Amount' },
  { value: 'amountIncl',    label: '💵 Amount (Incl. VAT)' },
  { value: 'description',   label: '📝 Description / Notes' },
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

// ── PDF text extraction ────────────────────────────────────────────────
async function extractRows(file: File): Promise<{ rows: string[][]; pageCount: number }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allRows: string[][] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group text items by y-coordinate (±10 px tolerance — wider handles slight misalignment)
    const byY = new Map<number, { str: string; x: number }[]>();
    for (const rawItem of content.items) {
      const item = rawItem as any;
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      let bucket = -1;
      for (const k of byY.keys()) {
        if (Math.abs(k - y) < 10) { bucket = k; break; }
      }
      if (bucket === -1) { bucket = y; byY.set(y, []); }
      byY.get(bucket)!.push({ str: item.str, x });
    }

    // Sort rows top→bottom (descending y in PDF coords), items left→right
    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      // Merge fragments that are very close on X axis (within 4px) into single cell
      const sorted = byY.get(y)!.sort((a, b) => a.x - b.x);
      const merged: { str: string; x: number }[] = [];
      for (const item of sorted) {
        const prev = merged[merged.length - 1];
        if (prev && item.x - (prev.x + prev.str.length * 4) < 4) {
          prev.str += item.str;
        } else {
          merged.push({ ...item });
        }
      }
      const row = merged.map(c => c.str.trim()).filter(Boolean);
      if (row.length > 0) allRows.push(row);
    }
  }
  return { rows: allRows, pageCount: pdf.numPages };
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
    description: get('description') || `PDF Import – ${defaultCategory}`,
    valid: errors.length === 0,
    errors,
    selected: errors.length === 0,
    paymentMethod: defaultPaymentMethod,
  };
}

// ── Component ────────────────────────────────────────────────────────────
const PdfPurchaseImport: React.FC<Props> = ({ onClose, onImported, buildings }) => {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');

  // Upload step
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState('');
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

  // ── Parse PDF ───────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Please select a PDF file.');
      return;
    }
    setParsing(true);
    setParseError('');
    try {
      const { rows } = await extractRows(file);
      setAllRows(rows);

      // Find most common row length (≥3 cells)
      const freq: Record<number, number> = {};
      for (const r of rows) if (r.length >= 3) freq[r.length] = (freq[r.length] || 0) + 1;
      const modalEntry = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

      if (!modalEntry) {
        setParseError(
          'Could not detect a table structure in this PDF. ' +
          'Ensure the PDF contains a table of purchase invoices (not a scanned image).',
        );
        return;
      }

      const dominantLen = Number(modalEntry[0]);
      setColCount(dominantLen);

      // Accept rows within ±1 column of dominant (handles optional empty trailing cell)
      const dataRows = rows.filter(r => r.length >= dominantLen - 1 && r.length <= dominantLen + 1)
        .map(r => {
          // Pad shorter rows with empty strings so mapping stays aligned
          while (r.length < dominantLen) r = [...r, ''];
          return r.slice(0, dominantLen);
        });
      setSkippedRows(rows.length - dataRows.length);

      // Detect header row: first row where no cell looks like a number
      const isNumberLike = (s: string) => /[\d,]+\.?\d*/.test(s);
      let hIdx = -1;
      for (let i = 0; i < Math.min(3, dataRows.length); i++) {
        if (!dataRows[i].some(isNumberLike)) { hIdx = i; break; }
      }
      setHeaderRowIndex(hIdx);

      const headerRow = hIdx >= 0 ? dataRows[hIdx] : null;
      const display = hIdx >= 0 ? dataRows.slice(hIdx + 1, hIdx + 4) : dataRows.slice(0, 3);
      setSampleRows(display);

      // Auto-detect column mapping
      const mapping: SystemField[] = Array.from({ length: dominantLen }, (_, col) => {
        const hint = (headerRow?.[col] ?? '').toLowerCase();
        const samples = display.map(r => r[col] ?? '');

        if (/date|تاريخ/.test(hint))                          return 'date';
        if (/invoice|inv\b|فاتورة|رقم.*فاتورة/.test(hint))   return 'invoiceNumber';
        if (/vendor|supplier|name|مورد|اسم/.test(hint))       return 'vendorName';
        if (/vat.*no|tax.*no|رقم.*ضريب|tax.*reg/.test(hint)) return 'vendorVAT';
        if (/excl|before|base|صافي|قبل/.test(hint))           return 'amountExcl';
        if (/^vat|ضريبة|tax.*amnt|vat.*amnt/.test(hint))     return 'amountVAT';
        if (/incl|total|gross|إجمالي/.test(hint))             return 'amountIncl';
        if (/desc|notes|detail|بيان/.test(hint))              return 'description';
        return autoDetectField(samples);
      });
      setColumnMapping(mapping);
      setStep('map');
    } catch (e: any) {
      setParseError('Failed to parse PDF: ' + (e?.message || 'Unknown error'));
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Build preview from mapping ──────────────────────────────────────
  const handleBuildPreview = useCallback(() => {
    const dataRows = allRows
      .filter(r => r.length >= colCount - 1 && r.length <= colCount + 1)
      .map(r => { const p = [...r]; while (p.length < colCount) p.push(''); return p.slice(0, colCount); });
    const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const rows  = dataRows.slice(start);

    // Rows excluded by column-count mismatch (completely different structure)
    const structureMismatch = allRows
      .filter(r => r.length < colCount - 1 || r.length > colCount + 1)
      .map(r => ({ cells: r, reason: `${r.length} cells (expected ~${colCount})` }));

    // Skip rows that look like totals/page breaks
    const SKIP_PATTERNS = /(^total|^sub.?total|^grand|^sum|^balance|^page|^cont)/i;
    const excluded: ExcludedRow[] = [...structureMismatch];
    const filtered = rows.filter(r => {
      const nonEmpty = r.filter(Boolean);
      if (nonEmpty.length === 0) return false;
      if (nonEmpty.length === 1 && SKIP_PATTERNS.test(nonEmpty[0])) {
        excluded.push({ cells: r, reason: 'Looks like a total / page-break row' });
        return false;
      }
      return true;
    });

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
    const toImport = invoices.filter(inv => inv.selected && inv.valid);
    setImporting(true);
    let count = 0;
    const uid = auth.currentUser?.uid || 'pdf-import';
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
      } as Transaction;
      await saveTransaction(tx);
      count++;
    }
    setImportCount(count);
    setImporting(false);
    setStep('done');
    onImported();
  }, [invoices, defaultCategory, onImported]);

  // ── Derived values ──────────────────────────────────────────────────
  const dataRows      = allRows.filter(r => r.length >= colCount - 1 && r.length <= colCount + 1);
  const headerRow     = headerRowIndex >= 0 ? dataRows[headerRowIndex] : null;
  const totalDataRows = dataRows.length - (headerRowIndex >= 0 ? 1 : 0);
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
                Parse a PDF table · map fields · preview · import to VAT report
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
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl p-10 sm:p-14 text-center cursor-pointer hover:bg-amber-50 transition-all group"
              >
                <Upload size={44} className="mx-auto mb-3 text-amber-400 group-hover:text-amber-600 transition-colors" />
                <p className="font-black text-slate-700 text-lg">Drop your PDF here or click to browse</p>
                <p className="text-sm text-slate-400 mt-1">
                  The PDF must contain a <strong>table of purchase invoices</strong> (e.g. vendor statement, invoice list export)
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              {parsing && (
                <div className="flex items-center justify-center gap-3 py-4 text-amber-600 font-bold">
                  <Loader size={20} className="animate-spin" /> Parsing PDF…
                </div>
              )}
              {parseError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm font-semibold">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p>{parseError}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                  <Info size={13} /> Tips for best results
                </p>
                <ul className="text-xs text-blue-600 space-y-1 list-disc ml-4">
                  <li>PDF must have selectable text (not a scanned image)</li>
                  <li>Each row should represent one purchase invoice</li>
                  <li>Columns like Date, Invoice No., Vendor, VAT No., Amount are auto-detected and can be adjusted</li>
                  <li>Both Arabic and English column headers are supported</li>
                  <li>Only Amount (Excl. VAT) <em>or</em> Amount (Incl. VAT) is required — VAT is auto-calculated at 15%</li>
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
                  onClick={() => setStep('map')}
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

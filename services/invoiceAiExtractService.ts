import * as pdfjsLib from 'pdfjs-dist';
import {
  getGroqApiKey,
  getLocalAiTextModel,
  getLocalAiVisionModel,
  hasGroqApiKey,
  isLocalAiAvailable,
  resolveAiProvider,
  type AiProvider,
} from '../utils/localAi';
import { createOcrWorker } from '../utils/createOcrWorker';
import { PaymentMethod } from '../types';

export interface AiExtractedInvoice {
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
  confidence?: number;
  sourcePage?: number;
}

export interface AiExtractResult {
  invoices: AiExtractedInvoice[];
  method: 'vision' | 'ocr+llm' | 'none';
  documentType?: string;
  notes?: string;
  pagesProcessed: number;
  provider?: AiProvider;
}

type RawInvoice = {
  date?: string;
  invoiceNumber?: string;
  vendorName?: string;
  vendorVAT?: string;
  amountExcl?: number | string;
  vatAmount?: number | string;
  amountIncl?: number | string;
  description?: string;
  confidence?: number;
  sourcePage?: number;
};

type AiJson = {
  documentType?: string;
  notes?: string;
  invoices?: RawInvoice[];
};

const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
/** Large phone/scanner packs (e.g. 30+ pages) — keep bounded for browser memory. */
const MAX_PAGES = 40;
/** Local 30B+ vision models: 1 page/request is safest for VRAM. Cloud can batch more. */
const LOCAL_IMAGES_PER_REQUEST = 1;
const CLOUD_IMAGES_PER_REQUEST = 4;
/** Keep each JPEG comfortably under request limits. */
const TARGET_JPEG_BYTES = 650_000;

const EXTRACT_PROMPT = `You are an expert Saudi ZATCA / VAT purchase-invoice reader.
You will receive scan images of PDF pages (Arabic and/or English invoices, receipts, or purchase lists).

Extract EVERY distinct purchase invoice / expense row you can find.
Ignore sales invoices issued BY the user unless they are clearly purchases (buyer is us).

Return ONLY valid JSON (no markdown) with this shape:
{
  "documentType": "purchase_list" | "single_invoice" | "statement" | "mixed" | "unknown",
  "notes": "short note if anything is unclear",
  "invoices": [
    {
      "date": "YYYY-MM-DD",
      "invoiceNumber": "string",
      "vendorName": "string",
      "vendorVAT": "15-digit Saudi VAT if present",
      "amountExcl": number,
      "vatAmount": number,
      "amountIncl": number,
      "description": "short English or Arabic description",
      "confidence": 0.0 to 1.0,
      "sourcePage": 1-based page number if known
    }
  ]
}

Rules:
- Amounts are SAR. Prefer numeric values, not strings.
- If only total (incl VAT) is visible, set amountIncl and leave others 0 (we will derive).
- If only excl VAT is visible, set amountExcl.
- Saudi VAT is usually 15%.
- Vendor VAT numbers usually start with 3 and are 15 digits.
- Dates may be Gregorian or Hijri-looking — prefer Gregorian YYYY-MM-DD when possible; otherwise best Gregorian guess.
- Do not invent vendors or amounts. Skip unreadable rows.
- Multiple invoices on one page → multiple array entries.
- Summary / total / grand total rows are NOT invoices.`;

function latiniseDigits(s: string): string {
  return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function parseAmountAi(s: string | number | undefined | null): number {
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  if (s == null) return 0;
  const latinised = latiniseDigits(String(s));
  const cleaned = latinised
    .replace(/SAR|ريال|SR|﷼/gi, '')
    .replace(/,(?=\d{3}(?:[,.]|$))/g, '')
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeDateAi(s: string | undefined | null): string {
  if (!s) return new Date().toISOString().split('T')[0];
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const m2 = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

function deriveAmounts(raw: RawInvoice): { amountExcl: number; vatAmount: number; amountIncl: number } {
  let amountExcl = parseAmountAi(raw.amountExcl);
  let vatAmount = parseAmountAi(raw.vatAmount);
  let amountIncl = parseAmountAi(raw.amountIncl);

  if (amountExcl && vatAmount && !amountIncl) amountIncl = amountExcl + vatAmount;
  else if (amountExcl && amountIncl && !vatAmount) vatAmount = amountIncl - amountExcl;
  else if (amountIncl && vatAmount && !amountExcl) amountExcl = amountIncl - vatAmount;
  else if (amountExcl && !vatAmount && !amountIncl) {
    vatAmount = Math.round(amountExcl * 0.15 * 100) / 100;
    amountIncl = Math.round(amountExcl * 1.15 * 100) / 100;
  } else if (amountIncl && !vatAmount && !amountExcl) {
    amountExcl = Math.round((amountIncl / 1.15) * 100) / 100;
    vatAmount = Math.round((amountIncl - amountExcl) * 100) / 100;
  } else if (vatAmount && !amountExcl && !amountIncl) {
    amountExcl = Math.round((vatAmount / 0.15) * 100) / 100;
    amountIncl = amountExcl + vatAmount;
  }

  return {
    amountExcl: Math.round(amountExcl * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    amountIncl: Math.round(amountIncl * 100) / 100,
  };
}

export function normalizeAiInvoices(
  rawList: RawInvoice[],
  defaultPaymentMethod: PaymentMethod = PaymentMethod.BANK,
  defaultCategory = 'Vendor Payment',
): AiExtractedInvoice[] {
  return (rawList || [])
    .map((raw, idx) => {
      const amounts = deriveAmounts(raw);
      const errors: string[] = [];
      if (!amounts.amountExcl && !amounts.amountIncl) errors.push('No amount found');
      const vendorVAT = String(raw.vendorVAT || '').replace(/\s/g, '');
      return {
        id: `ai-${Date.now()}-${idx}`,
        date: normalizeDateAi(raw.date),
        invoiceNumber: String(raw.invoiceNumber || '').trim() || `AI-${Date.now().toString(36).toUpperCase()}-${idx}`,
        vendorName: String(raw.vendorName || '').trim(),
        vendorVAT,
        ...amounts,
        description: String(raw.description || '').trim() || `AI Import – ${defaultCategory}`,
        valid: errors.length === 0,
        errors,
        selected: errors.length === 0,
        paymentMethod: defaultPaymentMethod,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
        sourcePage: typeof raw.sourcePage === 'number' ? raw.sourcePage : undefined,
      };
    })
    .filter((inv) => inv.valid || inv.vendorName || inv.invoiceNumber);
}

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
}

function parseJsonPayload(text: string): AiJson {
  const cleaned = stripThinking(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI returned no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1)) as AiJson;
}

function messageContentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as any).text || '');
        return '';
      })
      .join('\n');
  }
  return '';
}

async function callLocalChat(body: {
  model: string;
  messages: unknown[];
  temperature?: number;
  max_tokens?: number;
  wantJson?: boolean;
}): Promise<string> {
  const base = getLocalAiBaseUrl();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.1,
      // Vision + JSON extraction needs room; thinking models otherwise fill the budget
      max_tokens: body.max_tokens ?? 8192,
      // Qwen3 / stable-qwen: keep final answer in `content`, not only `reasoning`
      think: false,
      ...(body.wantJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `Local AI HTTP ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const content = messageContentToString(message?.content);
  if (content.trim()) return content;
  // Fallback if think couldn't be disabled
  const reasoning = messageContentToString(message?.reasoning);
  if (reasoning.trim()) return reasoning;
  return '';
}

async function callGroqChat(body: Record<string, unknown>): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('NO_AI_BACKEND');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `Groq HTTP ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  return messageContentToString(data?.choices?.[0]?.message?.content);
}

async function callChat(
  provider: AiProvider,
  opts: {
    vision?: boolean;
    messages: unknown[];
    temperature?: number;
    max_tokens?: number;
    wantJson?: boolean;
  },
): Promise<string> {
  if (provider === 'local') {
    const model = opts.vision ? getLocalAiVisionModel() : getLocalAiTextModel();
    return callLocalChat({
      model,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      wantJson: opts.wantJson,
    });
  }
  return callGroqChat({
    model: opts.vision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 4096,
    ...(opts.wantJson ? { response_format: { type: 'json_object' } } : {}),
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

function shrinkCanvas(source: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  if (source.width <= maxWidth) return source;
  const scale = maxWidth / source.width;
  const out = document.createElement('canvas');
  out.width = Math.round(source.width * scale);
  out.height = Math.round(source.height * scale);
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function encodeCanvasUnderBudget(canvas: HTMLCanvasElement): string {
  let working = shrinkCanvas(canvas, 1400);
  let quality = 0.72;
  let dataUrl = canvasToJpegDataUrl(working, quality);
  while (dataUrl.length * 0.75 > TARGET_JPEG_BYTES && quality > 0.35) {
    quality -= 0.08;
    dataUrl = canvasToJpegDataUrl(working, quality);
  }
  if (dataUrl.length * 0.75 > TARGET_JPEG_BYTES) {
    working = shrinkCanvas(working, 1100);
    dataUrl = canvasToJpegDataUrl(working, 0.55);
  }
  if (dataUrl.length * 0.75 > TARGET_JPEG_BYTES) {
    working = shrinkCanvas(working, 900);
    dataUrl = canvasToJpegDataUrl(working, 0.45);
  }
  return dataUrl;
}

async function renderSinglePageJpeg(
  pdf: { getPage: (n: number) => Promise<any> },
  pageNum: number,
  scale = 1.85,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`Could not render page ${pageNum}`);
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport } as any).promise;
  return encodeCanvasUnderBudget(canvas);
}

export async function renderPdfPagesToJpeg(
  file: File,
  onProgress?: (msg: string) => void,
  maxPages = MAX_PAGES,
): Promise<{ dataUrls: string[]; pageCount: number }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pagesToProcess = Math.min(pdf.numPages, maxPages);
  const dataUrls: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    onProgress?.(`Preparing page ${pageNum}/${pagesToProcess} for AI…`);
    dataUrls.push(await renderSinglePageJpeg(pdf, pageNum));
  }

  return { dataUrls, pageCount: pdf.numPages };
}

async function extractFromPageBatch(
  provider: AiProvider,
  dataUrls: string[],
  pageOffset: number,
): Promise<AiJson> {
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `${EXTRACT_PROMPT}\n\nThese images start at page ${pageOffset + 1}.`,
    },
  ];
  for (const url of dataUrls) {
    content.push({
      type: 'image_url',
      image_url: { url },
    });
  }

  const text = await callChat(provider, {
    vision: true,
    messages: [{ role: 'user', content }],
    temperature: 0.1,
    max_tokens: 4096,
    wantJson: true,
  });

  return parseJsonPayload(text);
}

export async function extractInvoicesWithVision(
  file: File,
  onProgress?: (msg: string) => void,
  defaultPaymentMethod: PaymentMethod = PaymentMethod.BANK,
  provider: AiProvider = 'local',
): Promise<AiExtractResult> {
  const batchSize = provider === 'local' ? LOCAL_IMAGES_PER_REQUEST : CLOUD_IMAGES_PER_REQUEST;
  const modelLabel = provider === 'local' ? getLocalAiVisionModel() : GROQ_VISION_MODEL;

  onProgress?.(`AI (${provider}): opening scanned PDF…`);
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pagesToProcess = Math.min(pdf.numPages, MAX_PAGES);
  if (pagesToProcess === 0) {
    return { invoices: [], method: 'none', pagesProcessed: 0, provider };
  }

  const allRaw: RawInvoice[] = [];
  let documentType = 'unknown';
  const notes: string[] = [`Using ${provider} model ${modelLabel}`];
  if (pdf.numPages > MAX_PAGES) {
    notes.push(`Only first ${MAX_PAGES} of ${pdf.numPages} pages were analyzed`);
  }

  for (let i = 0; i < pagesToProcess; i += batchSize) {
    const end = Math.min(i + batchSize, pagesToProcess);
    const batchNo = Math.floor(i / batchSize) + 1;
    const batchTotal = Math.ceil(pagesToProcess / batchSize);
    onProgress?.(
      provider === 'local'
        ? `Local AI: rendering page${end > i + 1 ? 's' : ''} ${i + 1}${end > i + 1 ? `–${end}` : ''} (${batchNo}/${batchTotal})…`
        : `AI: rendering pages ${i + 1}–${end} (${batchNo}/${batchTotal})…`,
    );

    const batchUrls: string[] = [];
    for (let pageNum = i + 1; pageNum <= end; pageNum++) {
      batchUrls.push(await renderSinglePageJpeg(pdf, pageNum));
    }

    onProgress?.(
      provider === 'local'
        ? `Local AI (${modelLabel}): reading page ${i + 1}${end > i + 1 ? `–${end}` : ''}…`
        : `AI vision: reading pages ${i + 1}–${end} (${batchNo}/${batchTotal})…`,
    );
    try {
      const json = await extractFromPageBatch(provider, batchUrls, i);
      if (json.documentType) documentType = json.documentType;
      if (json.notes) notes.push(json.notes);
      for (const inv of json.invoices || []) {
        if (inv.sourcePage == null) inv.sourcePage = i + 1;
        allRaw.push(inv);
      }
    } catch (e: any) {
      if (e?.message === 'NO_AI_BACKEND') throw e;
      notes.push(`Batch ${batchNo} failed: ${e?.message || e}`);
    }
  }

  const invoices = normalizeAiInvoices(allRaw, defaultPaymentMethod);
  const seen = new Set<string>();
  const deduped = invoices.filter((inv) => {
    const key = `${inv.invoiceNumber}|${inv.amountIncl}|${inv.vendorVAT}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    invoices: deduped,
    method: deduped.length ? 'vision' : 'none',
    documentType,
    notes: notes.filter(Boolean).join(' · ') || undefined,
    pagesProcessed: pagesToProcess,
    provider,
  };
}

/** OCR sample pages, then ask LLM to structure Saudi purchase invoices. */
export async function extractInvoicesWithOcrAndLlm(
  file: File,
  onProgress?: (msg: string) => void,
  defaultPaymentMethod: PaymentMethod = PaymentMethod.BANK,
  provider: AiProvider = 'local',
): Promise<AiExtractResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pagesToProcess = Math.min(pdf.numPages, 8);

  onProgress?.('OCR: loading engine…');
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
  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      onProgress?.(`OCR page ${pageNum}/${pagesToProcess}…`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.4 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      const { data } = await worker.recognize(canvas);
      ocrText += `\n\n===== PAGE ${pageNum} =====\n${data.text || ''}`;
    }
  } finally {
    await worker.terminate().catch(() => {});
  }

  const compact = ocrText.replace(/[ \t]+\n/g, '\n').trim();
  if (compact.replace(/\s/g, '').length < 30) {
    return { invoices: [], method: 'none', pagesProcessed: pagesToProcess, notes: 'OCR produced almost no text', provider };
  }

  onProgress?.(provider === 'local' ? 'Local AI: structuring OCR text…' : 'AI: structuring OCR text into invoices…');
  const text = await callChat(provider, {
    vision: false,
    messages: [
      { role: 'system', content: EXTRACT_PROMPT },
      {
        role: 'user',
        content: `OCR text from a scanned Saudi purchase PDF:\n\n${compact.slice(0, 28000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    wantJson: true,
  });

  const json = parseJsonPayload(text);
  const invoices = normalizeAiInvoices(json.invoices || [], defaultPaymentMethod);
  return {
    invoices,
    method: invoices.length ? 'ocr+llm' : 'none',
    documentType: json.documentType,
    notes: json.notes,
    pagesProcessed: pagesToProcess,
    provider,
  };
}

/**
 * Best-effort AI extraction for scanned / messy purchase PDFs.
 * Prefers local Ollama vision; optional Groq cloud fallback.
 * Pass `prefer` to force one backend (e.g. user chose "Cloud AI" or "Local AI").
 */
export async function extractPurchaseInvoicesWithAi(
  file: File,
  onProgress?: (msg: string) => void,
  defaultPaymentMethod: PaymentMethod = PaymentMethod.BANK,
  prefer?: AiProvider,
): Promise<AiExtractResult> {
  let provider: AiProvider | null = null;
  if (prefer === 'local') {
    provider = (await isLocalAiAvailable()) ? 'local' : null;
    if (!provider) {
      return { invoices: [], method: 'none', pagesProcessed: 0, notes: 'Local Ollama is offline' };
    }
  } else if (prefer === 'groq') {
    provider = hasGroqApiKey() ? 'groq' : null;
    if (!provider) {
      return { invoices: [], method: 'none', pagesProcessed: 0, notes: 'NO_GROQ_KEY' };
    }
  } else {
    provider = await resolveAiProvider();
  }

  if (!provider) {
    return {
      invoices: [],
      method: 'none',
      pagesProcessed: 0,
      notes: 'NO_AI_BACKEND',
    };
  }

  onProgress?.(
    provider === 'local'
      ? `Using local AI (${getLocalAiVisionModel()})…`
      : 'Using cloud AI (Groq)…',
  );

  try {
    const vision = await extractInvoicesWithVision(file, onProgress, defaultPaymentMethod, provider);
    if (vision.invoices.length > 0) return vision;
    onProgress?.('Vision found no invoices — trying OCR + AI…');
  } catch (e: any) {
    if (e?.message === 'NO_AI_BACKEND') {
      return { invoices: [], method: 'none', pagesProcessed: 0, notes: 'NO_AI_BACKEND' };
    }
    onProgress?.(`Vision failed (${e?.message || e}) — trying OCR + AI…`);
  }

  return extractInvoicesWithOcrAndLlm(file, onProgress, defaultPaymentMethod, provider);
}

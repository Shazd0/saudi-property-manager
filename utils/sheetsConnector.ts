/**
 * Google Sheets connector — extracts sheet ID from URL, builds download URLs,
 * and fetches public workbooks as ArrayBuffer for SheetJS parsing.
 */

const STORAGE_KEY = 'amlak_sheet_url';

export function extractSheetId(url: string): string | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function getExportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}

export async function fetchWorkbook(sheetId: string): Promise<ArrayBuffer> {
  const url = getExportUrl(sheetId);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch sheet (${resp.status})`);
  return resp.arrayBuffer();
}

export function getSavedSheetUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

export function saveSheetUrl(url: string) {
  try { localStorage.setItem(STORAGE_KEY, url); } catch {}
}

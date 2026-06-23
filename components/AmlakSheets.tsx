import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle, ChevronLeft, ChevronRight, CircleDollarSign, Download, Eye, FileSpreadsheet, Home, Landmark, Loader2, Lock, Maximize2, Minimize2, Plus, Printer, Redo2, Save, Undo2, UsersRound, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AmlakSheetKind,
  AmlakWorkbook,
  AmlakWorksheet,
  Bank,
  Building,
  Contract,
  ExpenseCategory,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserRole,
} from '../types';
import {
  getAmlakWorkbooks,
  getBanks,
  getBuildings,
  getBuildingsAllBooks,
  getContracts,
  getCustomers,
  getCustomExpenseCategories,
  getCustomIncomeCategories,
  getTransactions,
  getUsers,
  getUsersAcrossBooks,
  getVendors,
  saveVendor,
  deleteVendor,
  listenAmlakWorkbooks,
  saveAmlakWorkbook,
  saveTransfer,
  saveTransaction,
} from '../services/firestoreService';
import { cellAddress, colLabelToIndex, indexToColLabel } from '../utils/spreadsheetAddress';
import { inferCellValue, setWorksheetCell } from '../utils/spreadsheetRecalc';
import { dateToLocalStr } from '../utils/dateFormat';
import { isNonResidentialBuildingForContract } from '../utils/contractTransactionFilter';
import { transactionCountsAsBankForSplit, transactionCountsAsCashForSplit } from '../utils/transactionUtils';
import {
  INTER_BUILDING_TRANSFER_CATEGORY,
  isInterBuildingTreasuryTransaction,
  transactionSheetKindsForAmlak,
  transactionSheetPaymentMethod,
} from '../utils/amlakSheetRouting';
import {
  compactAmlakWorkbook,
  createBuildingAmlakSheetsWorkbook,
  ensureBuildingWorkbookSheets,
  markWorksheetRowsPosted,
  normalizeAmlakTextValue,
  setWorksheetRowMeta,
  validateWorksheetPostingRows,
} from '../utils/amlakSheetPosting';
import { buildIncomeSheetDetails } from '../utils/entryTransactionDraft';
import { getExpenseSubcategories, mergeExpenseCategories, mergeIncomeCategories, readLocalExpenseSubcategories } from '../utils/entryCategories';
import { buildMonitoringDueRoomRows } from '../utils/monitoringDueRooms';
import { useBook } from '../contexts/BookContext';
import { listenAmlakSheetPresence, setAmlakSheetPresence, type AmlakSheetPresenceUser } from '../services/amlakSheetPresenceService';
import { useToast } from './Toast';

interface Props {
  currentUser: User;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type ColumnKind = 'date' | 'dueDate' | 'paidDate' | 'unit' | 'owner' | 'category' | 'subCategory' | 'related' | 'customerVAT' | 'vendor' | 'vendorVAT' | 'vendorRefNo' | 'details' | 'fromType' | 'fromAccount' | 'toType' | 'toAccount' | 'fromBank' | 'toBank' | 'purpose' | 'notes' | 'dueAmount' | 'paymentMethod' | 'amount' | 'balance' | 'extra' | 'discount' | 'enteredBy' | 'status';

interface SheetColumn {
  key: ColumnKind;
  label: string;
  col?: string;
  width: string;
}

const SHEET_TABS: Array<{ kind: AmlakSheetKind; label: string; subtitle?: string; tone: string }> = [
  { kind: 'rentalIncome', label: 'Rental Income', tone: 'emerald' },
  { kind: 'otherIncome', label: 'Other Income', tone: 'teal' },
  { kind: 'expense', label: 'Expense', tone: 'rose' },
  { kind: 'ownerExpense', label: 'Owner Expense', tone: 'amber' },
  { kind: 'vatIncome', label: 'VAT Sales', subtitle: 'Output VAT', tone: 'emerald' },
  { kind: 'vatExpense', label: 'VAT Purchase', subtitle: 'Input VAT', tone: 'amber' },
  { kind: 'fees', label: 'Fees', subtitle: 'Non-VAT Fees', tone: 'sky' },
  { kind: 'treasury', label: 'Treasury', subtitle: 'Transfers', tone: 'indigo' },
];

const COLUMNS: Record<AmlakSheetKind, SheetColumn[]> = {
  rentalIncome: [
    { key: 'dueDate', label: 'Due Date', col: 'A', width: '112px' },
    { key: 'paidDate', label: 'Paid Date', col: 'G', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '84px' },
    { key: 'dueAmount', label: 'Due', col: 'D', width: '86px' },
    { key: 'amount', label: 'Paid', col: 'E', width: '86px' },
    { key: 'paymentMethod', label: 'Method', col: 'F', width: '86px' },
    { key: 'balance', label: 'Balance', width: '88px' },
    { key: 'enteredBy', label: 'By', width: '82px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  income: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  otherIncome: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  expense: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'subCategory', label: 'Target', col: 'C', width: '150px' },
    { key: 'related', label: 'Month', col: 'D', width: '112px' },
    { key: 'details', label: 'Details', col: 'E', width: '240px' },
    { key: 'paymentMethod', label: 'Method', col: 'F', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'G', width: '92px' },
    { key: 'extra', label: 'Extra', col: 'H', width: '78px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  ownerExpense: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'owner', label: 'Owner', col: 'B', width: '150px' },
    { key: 'details', label: 'Details', col: 'C', width: '240px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  vatIncome: [
    { key: 'dueDate', label: 'Due Date', col: 'A', width: '112px' },
    { key: 'paidDate', label: 'Paid Date', col: 'G', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'customerVAT', label: 'Customer VAT', col: 'C', width: '128px' },
    { key: 'details', label: 'Details', col: 'D', width: '230px' },
    { key: 'dueAmount', label: 'Due Incl. VAT', col: 'E', width: '112px' },
    { key: 'amount', label: 'Paid Incl. VAT', col: 'F', width: '112px' },
    { key: 'paymentMethod', label: 'Method', col: 'H', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  vatExpense: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'vendor', label: 'Vendor', col: 'D', width: '150px' },
    { key: 'vendorVAT', label: 'Vendor VAT', col: 'E', width: '128px' },
    { key: 'vendorRefNo', label: 'Invoice Number', col: 'F', width: '132px' },
    { key: 'details', label: 'Details', col: 'G', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'H', width: '92px' },
    { key: 'amount', label: 'Amount Incl. VAT', col: 'I', width: '112px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  fees: [
    { key: 'dueDate', label: 'Due Date', col: 'A', width: '112px' },
    { key: 'paidDate', label: 'Paid Date', col: 'G', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'dueAmount', label: 'Due', col: 'D', width: '92px' },
    { key: 'amount', label: 'Paid', col: 'E', width: '92px' },
    { key: 'balance', label: 'Balance', width: '88px' },
    { key: 'paymentMethod', label: 'Method', col: 'F', width: '92px' },
    { key: 'discount', label: 'Discount', col: 'H', width: '82px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  treasury: [
    { key: 'date', label: 'Paid Date', col: 'A', width: '112px' },
    { key: 'fromType', label: 'From Type', col: 'B', width: '120px' },
    { key: 'fromAccount', label: 'From Account', col: 'C', width: '170px' },
    { key: 'toType', label: 'To Type', col: 'D', width: '120px' },
    { key: 'toAccount', label: 'To Account', col: 'E', width: '170px' },
    { key: 'paymentMethod', label: 'Method', col: 'F', width: '92px' },
    { key: 'fromBank', label: 'From Bank', col: 'G', width: '136px' },
    { key: 'toBank', label: 'To Bank', col: 'H', width: '136px' },
    { key: 'amount', label: 'Amount', col: 'I', width: '96px' },
    { key: 'purpose', label: 'Purpose', col: 'J', width: '170px' },
    { key: 'notes', label: 'Notes', col: 'K', width: '220px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
};

const isAdminUser = (user: User) => user.role === UserRole.ADMIN || String(user.role) === 'ADMIN';
const isManagerUser = (user: User) => user.role === UserRole.MANAGER || String(user.role) === 'MANAGER';
const AMLAK_FIRST_MONTH = '2026-01';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HISTORY_LIMIT = 30;
const AUTO_EMPTY_ROW_BUFFER = 5;
const selectedBuildingStorageKey = (bookId: string, userId: string) => `amlakSheets:selectedBuilding:${bookId || 'default'}:${userId || 'user'}`;
const selectedSummaryBuildingsStorageKey = (bookId: string, userId: string) => `amlakSheets:selectedSummaryBuildings:${bookId || 'default'}:${userId || 'user'}`;

function cloneWorkbookSnapshot(workbook: AmlakWorkbook): AmlakWorkbook {
  if (typeof structuredClone === 'function') return structuredClone(workbook);
  return JSON.parse(JSON.stringify(workbook)) as AmlakWorkbook;
}

function currentMonthKey(): string {
  return dateToLocalStr(new Date()).slice(0, 7);
}

function browserViewportWidth(): number {
  if (typeof window === 'undefined') return 1280;
  return window.innerWidth || 1280;
}

function horizontalScrollEdges(target: HTMLElement | null): { canLeft: boolean; canRight: boolean } {
  if (!target) return { canLeft: false, canRight: false };
  const maxLeft = Math.max(0, target.scrollWidth - target.clientWidth);
  return {
    canLeft: target.scrollLeft > 8,
    canRight: target.scrollLeft < maxLeft - 8,
  };
}

function isAmlakSheetsInstalledMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const mediaMatches = (query: string) => !!window.matchMedia?.(query).matches;
  return !!nav.standalone ||
    mediaMatches('(display-mode: standalone)') ||
    mediaMatches('(display-mode: window-controls-overlay)') ||
    mediaMatches('(display-mode: fullscreen)') ||
    document.referrer.startsWith('android-app://');
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(browserViewportWidth);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setWidth(browserViewportWidth()));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return width;
}

function isFutureMonth(monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey) && monthKey > currentMonthKey();
}

function staffMonthEditClosed(monthKey: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return false;
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const deadline = new Date(year, monthIndex + 1, 10, 23, 59, 59, 999);
  return new Date() > deadline;
}

function monthKeyFromDate(value: string): string {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);
  const normalized = normalizeCompactSheetDate(text);
  if (normalized) return normalized.slice(0, 7);
  return '';
}

function formatCompactSheetDate(value: string): string {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const compact = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  const match = iso || compact;
  if (!match) return text;
  const year = iso ? match[1] : match[3];
  const month = iso ? match[2] : match[2];
  const day = iso ? match[3] : match[1];
  return `${String(Number(day)).padStart(2, '0')}-${String(Number(month)).padStart(2, '0')}-${year.slice(-2)}`;
}

function normalizeCompactSheetDate(value: string): string | null {
  const text = String(value || '').trim();
  if (!text) return '';
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const compact = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  const match = iso || compact;
  if (!match) return null;
  const yearText = iso ? match[1] : match[3];
  const monthText = iso ? match[2] : match[2];
  const dayText = iso ? match[3] : match[1];
  const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatSheetMonth(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return value || '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function periodFromDate(value: string): string {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);
  return dateToLocalStr(new Date()).slice(0, 7);
}

function previousMonthPeriod(value: string): string {
  const [yearText, monthText] = periodFromDate(value).split('-');
  const date = new Date(Number(yearText), Number(monthText) - 2, 1);
  return dateToLocalStr(date).slice(0, 7);
}

function nextMonthPeriod(period: string): string {
  const [yearText, monthText] = periodFromDate(`${period || currentMonthKey()}-01`).split('-');
  const date = new Date(Number(yearText), Number(monthText), 1);
  return dateToLocalStr(date).slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const index = Number(month) - 1;
  return `${MONTH_NAMES[index] || month} ${year}`;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-SA', { maximumFractionDigits: 2 }).format(value || 0);
}

function cellRaw(sheet: AmlakWorksheet, col: string | undefined, row: number): string {
  if (!col) return '';
  return sheet.cells[cellAddress(colLabelToIndex(col), row)]?.raw || '';
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pxNumber(width: string): number {
  return Number(String(width || '').replace('px', '')) || 90;
}

function columnDisplayValue(sheet: AmlakWorksheet, column: SheetColumn, row: number): string {
  if (column.key === 'balance') {
    const { due, balance, advance } = rentalBalanceState(sheet, row);
    if (advance > 0) return `Advance ${formatAmount(advance)}`;
    return balance ? formatAmount(balance) : due > 0 ? 'Paid' : '';
  }
  if (column.key === 'enteredBy') {
    return String(sheet.rowsMeta?.[String(row)]?.enteredByName || '');
  }
  if (column.key === 'status') {
    const meta = sheet.rowsMeta?.[String(row)];
    if (meta?.status === 'posted' || meta?.postedTransactionId) return 'Posted';
    if (meta) return 'Draft';
    return rowHasData(sheet, row) ? 'Fix' : '';
  }
  if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') {
    return formatCompactSheetDate(column.col ? cellRaw(sheet, column.col, row) : '');
  }
  return column.col ? cellRaw(sheet, column.col, row) : '';
}

function screenScale(viewportWidth: number): number {
  if (viewportWidth < 380) return 0.7;
  if (viewportWidth < 480) return 0.76;
  if (viewportWidth < 640) return 0.82;
  if (viewportWidth < 900) return 0.9;
  if (viewportWidth < 1280) return 0.96;
  return 1.05;
}

function scaledWidth(value: number, viewportWidth: number): number {
  return Math.round(value * screenScale(viewportWidth));
}

function largeColumnBasePixels(column: SheetColumn, viewportWidth: number): number {
  const wide = viewportWidth >= 1440 ? 1.12 : 1;
  const value = (() => {
    if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') return 104;
    if (column.key === 'amount' || column.key === 'dueAmount' || column.key === 'extra' || column.key === 'discount' || column.key === 'balance') return column.key === 'extra' || column.key === 'discount' ? 96 : 112;
    if (column.key === 'paymentMethod') return 126;
    if (column.key === 'unit') return 120;
    if (column.key === 'status') return 104;
    if (column.key === 'enteredBy') return 120;
    if (column.key === 'details') return 310;
    if (column.key === 'owner' || column.key === 'vendor') return 190;
    if (column.key === 'category' || column.key === 'subCategory' || column.key === 'related') return 178;
    if (column.key === 'customerVAT' || column.key === 'vendorVAT' || column.key === 'vendorRefNo') return 154;
    return pxNumber(column.width);
  })();
  return Math.round(value * wide);
}

function columnGrowWeight(column: SheetColumn): number {
  if (column.key === 'details') return 3;
  if (column.key === 'owner' || column.key === 'vendor' || column.key === 'category' || column.key === 'subCategory' || column.key === 'related') return 1.8;
  if (column.key === 'customerVAT' || column.key === 'vendorVAT' || column.key === 'vendorRefNo') return 1.4;
  if (column.key === 'amount' || column.key === 'dueAmount' || column.key === 'balance' || column.key === 'paymentMethod') return 1.15;
  return 0.8;
}

function columnTrackPixels(column: SheetColumn, sheet?: AmlakWorksheet, rows: number[] = [], viewportWidth = 1280): number {
  if (viewportWidth >= 900) return largeColumnBasePixels(column, viewportWidth);

  const values = sheet ? rows.slice(0, 120).map(row => columnDisplayValue(sheet, column, row).trim()).filter(Boolean) : [];
  const longestValue = values.reduce((longest, value) => Math.max(longest, value.length), 0);
  const charPx = viewportWidth < 640 ? 5.8 : viewportWidth < 900 ? 6.4 : 7;
  const textWidth = (chars: number, padding = 30) => chars * charPx + scaledWidth(padding, viewportWidth);
  const tablet = viewportWidth >= 640;

  if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') {
    return tablet ? 118 : 108;
  }
  if (column.key === 'amount' || column.key === 'dueAmount' || column.key === 'extra' || column.key === 'discount' || column.key === 'balance') {
    const min = column.key === 'extra' || column.key === 'discount' ? (tablet ? 82 : 72) : (tablet ? 108 : 96);
    const max = column.key === 'extra' || column.key === 'discount' ? (tablet ? 100 : 88) : (tablet ? 132 : 118);
    return clampNumber(textWidth(longestValue, 30), min, max);
  }
  if (column.key === 'paymentMethod') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 34), tablet ? 118 : 108, tablet ? 138 : 126);
  }
  if (column.key === 'unit') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 64), tablet ? 220 : 190, tablet ? 300 : 260);
  }
  if (column.key === 'status' || column.key === 'enteredBy') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 30), tablet ? 104 : 92, tablet ? 132 : 118);
  }
  if (column.key === 'details') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 42), tablet ? 260 : 220, tablet ? 420 : 360);
  }
  return clampNumber(textWidth(Math.max(column.label.length, longestValue), 48), tablet ? 180 : 156, tablet ? 320 : 280);
}

function gridTemplate(kind: AmlakSheetKind, isAdmin: boolean, sheet?: AmlakWorksheet, rows: number[] = [], viewportWidth = 1280): string {
  const columns = sheetColumns(kind);
  const checkPx = isAdmin ? clampNumber(scaledWidth(36, viewportWidth), 28, 42) : 0;
  const rowPx = clampNumber(scaledWidth(42, viewportWidth), 30, 52);
  const baseWidths = columns.map(column => columnTrackPixels(column, sheet, rows, viewportWidth));
  const availableWidth = viewportWidth >= 900 ? Math.max(0, viewportWidth - 72) : 0;
  const totalBase = checkPx + rowPx + baseWidths.reduce((sum, width) => sum + width, 0);
  const extra = Math.max(0, availableWidth - totalBase);
  const totalWeight = columns.reduce((sum, column) => sum + columnGrowWeight(column), 0);
  const expandedWidths = extra > 0
    ? baseWidths.map((width, index) => Math.round(width + (extra * columnGrowWeight(columns[index]) / totalWeight)))
    : baseWidths;
  const checkCol = isAdmin ? `${checkPx}px ` : '';
  return `${checkCol}${rowPx}px ${expandedWidths.map(width => `${width}px`).join(' ')}`;
}

function rowHasData(sheet: AmlakWorksheet, row: number): boolean {
  for (let col = 1; col <= sheet.colCount; col++) {
    if (String(sheet.cells[cellAddress(col, row)]?.raw || '').trim()) return true;
  }
  return false;
}

function maxUsedSheetRow(sheet: AmlakWorksheet): number {
  return Math.max(
    1,
    ...Object.keys(sheet.rowsMeta || {}).map(Number).filter(row => Number.isFinite(row) && row > 1),
    ...Object.values(sheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)).filter(row => row > 1),
  );
}

function ensureTrailingEmptyRows(sheet: AmlakWorksheet, count = AUTO_EMPTY_ROW_BUFFER): AmlakWorksheet {
  const targetRowCount = Math.max(sheet.rowCount || 1, maxUsedSheetRow(sheet) + Math.max(0, count));
  return targetRowCount === sheet.rowCount ? sheet : { ...sheet, rowCount: targetRowCount, updatedAt: Date.now() };
}

function ensureWorkbookTrailingEmptyRows(workbook: AmlakWorkbook): AmlakWorkbook {
  let changed = false;
  const sheets = (workbook.sheets || []).map(sheet => {
    const next = ensureTrailingEmptyRows(sheet);
    if (next !== sheet) changed = true;
    return next;
  });
  return changed ? { ...workbook, sheets, updatedAt: Date.now() } : workbook;
}

function rowDataSignature(sheet: AmlakWorksheet, row: number): string {
  return Array.from({ length: sheet.colCount }, (_, index) => {
    const col = index + 1;
    return sheet.cells[cellAddress(col, row)]?.raw || '';
  }).join('\u001f');
}

function setWorksheetCellFast(sheet: AmlakWorksheet, address: string, raw: string): AmlakWorksheet {
  const normalized = cellAddress(colLabelToIndex(address.replace(/\d+$/, '')), Number(address.match(/\d+$/)?.[0] || 1));
  const currentCell = sheet.cells[normalized];
  if (String(raw ?? '').trim().startsWith('=') || !!currentCell?.formula || String(currentCell?.raw || '').trim().startsWith('=')) {
    return setWorksheetCell(sheet, address, raw);
  }
  const nextCells = { ...sheet.cells };
  if (!String(raw ?? '').trim()) {
    delete nextCells[normalized];
  } else {
    nextCells[normalized] = {
      ...(nextCells[normalized] || { address: normalized }),
      address: normalized,
      raw,
      ...inferCellValue(raw),
    };
  }
  return { ...sheet, cells: nextCells, updatedAt: Date.now() };
}

function parseSheetAmount(value: unknown): number {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyRaw(value: number): string {
  return String(Math.round((Number(value) || 0) * 100) / 100);
}

function splitDetailMethod(details: string): 'CASH' | 'BANK' | 'CHEQUE' | '' {
  const upper = String(details || '').toUpperCase();
  if (upper.includes('SPLIT CASH')) return 'CASH';
  if (upper.includes('SPLIT CHEQUE') || upper.includes('SPLIT CHECK')) return 'CHEQUE';
  if (upper.includes('SPLIT BANK')) return 'BANK';
  return '';
}

function splitDetailBase(details: string): string {
  return String(details || '').replace(/\s+-\s+split\s+(cash|bank|cheque|check)\s*$/i, '').trim();
}

function isSplitPaymentChildRow(sheet: AmlakWorksheet, row: number): boolean {
  const meta = sheet.rowsMeta?.[String(row)] as any;
  return !!meta?.splitPaymentChild || !!splitDetailMethod(cellRaw(sheet, 'C', row));
}

function isSplitChildForParent(sheet: AmlakWorksheet, childRow: number, parentRow: number): boolean {
  if (childRow === parentRow || !rowHasData(sheet, childRow)) return false;
  const meta = sheet.rowsMeta?.[String(childRow)] as any;
  if (meta?.splitPaymentChild) return Number(meta.splitParentRow) === parentRow;
  return childRow > parentRow
    && !!splitDetailMethod(cellRaw(sheet, 'C', childRow))
    && normRowKey(cellRaw(sheet, 'A', childRow)) === normRowKey(cellRaw(sheet, 'A', parentRow))
    && normRowKey(cellRaw(sheet, 'B', childRow)) === normRowKey(cellRaw(sheet, 'B', parentRow));
}

function splitChildPaidTotal(sheet: AmlakWorksheet, parentRow: number, visited = new Set<number>()): number {
  if (visited.has(parentRow)) return 0;
  visited.add(parentRow);
  let total = 0;
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (isSplitChildForParent(sheet, row, parentRow)) {
      total += parseSheetAmount(cellRaw(sheet, 'E', row));
      total += splitChildPaidTotal(sheet, row, visited);
    }
  }
  return total;
}

function splitChildPaymentSignature(sheet: AmlakWorksheet, parentRow: number, visited = new Set<number>()): string {
  if (visited.has(parentRow)) return '';
  visited.add(parentRow);
  const parts: string[] = [];
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (isSplitChildForParent(sheet, row, parentRow)) {
      parts.push(`${row}:${cellRaw(sheet, 'D', row)}:${cellRaw(sheet, 'E', row)}`);
      const nested = splitChildPaymentSignature(sheet, row, visited);
      if (nested) parts.push(nested);
    }
  }
  return parts.join('|');
}

function rentalBalanceState(sheet: AmlakWorksheet, row: number): { due: number; paid: number; balance: number; advance: number } {
  const due = parseSheetAmount(cellRaw(sheet, 'D', row));
  const paid = parseSheetAmount(cellRaw(sheet, 'E', row)) + splitChildPaidTotal(sheet, row);
  return {
    due,
    paid,
    balance: Math.max(0, due - paid),
    advance: due > 0 ? Math.max(0, paid - due) : 0,
  };
}

function maxRentalPaymentForRow(sheet: AmlakWorksheet, row: number): number {
  const due = parseSheetAmount(cellRaw(sheet, 'D', row));
  return Math.max(0, due - splitChildPaidTotal(sheet, row));
}

function rentalPaymentLimitMessage(sheet: AmlakWorksheet, row: number, amount: number): string {
  const max = maxRentalPaymentForRow(sheet, row);
  const label = isSplitPaymentChildRow(sheet, row) ? 'split balance' : 'due balance';
  return `Paid amount ${formatAmount(amount)} SAR is more than the ${label} (${formatAmount(max)} SAR).`;
}

function findEarlierUnpaidRentalRow(sheet: AmlakWorksheet, row: number): { row: number; date: string; unit: string; balance: number } | null {
  const currentDate = cellRaw(sheet, 'A', row);
  const currentUnit = normRowKey(cellRaw(sheet, 'B', row));
  if (!currentDate || !currentUnit) return null;

  let blocker: { row: number; date: string; unit: string; balance: number } | null = null;
  for (let candidate = 2; candidate <= sheet.rowCount; candidate++) {
    if (candidate === row || !rowHasData(sheet, candidate) || isSplitPaymentChildRow(sheet, candidate)) continue;
    const date = cellRaw(sheet, 'A', candidate);
    if (!date || date >= currentDate) continue;
    if (normRowKey(cellRaw(sheet, 'B', candidate)) !== currentUnit) continue;
    const { due, balance } = rentalBalanceState(sheet, candidate);
    if (due <= 0 || balance <= 0.001) continue;
    if (!blocker || date < blocker.date || (date === blocker.date && candidate < blocker.row)) {
      blocker = { row: candidate, date, unit: cellRaw(sheet, 'B', candidate), balance };
    }
  }
  return blocker;
}

function earlierInstallmentMessage(blocker: { row: number; date: string; unit: string; balance: number }): string {
  return `There is an unpaid installment before this date: row ${blocker.row - 1}, unit ${blocker.unit}, due ${blocker.date}, balance ${formatAmount(blocker.balance)} SAR.`;
}

function findAlreadyPaidRentalRow(sheet: AmlakWorksheet, row: number, unitValue?: string, dateValue?: string): { row: number; date: string; unit: string } | null {
  const currentDate = dateValue || cellRaw(sheet, 'A', row);
  const currentUnit = normRowKey(unitValue ?? cellRaw(sheet, 'B', row));
  if (!currentDate || !currentUnit) return null;

  for (let candidate = 2; candidate <= sheet.rowCount; candidate++) {
    if (candidate === row || !rowHasData(sheet, candidate) || isSplitPaymentChildRow(sheet, candidate)) continue;
    const date = cellRaw(sheet, 'A', candidate);
    if (date !== currentDate) continue;
    if (normRowKey(cellRaw(sheet, 'B', candidate)) !== currentUnit) continue;
    const { due, balance } = rentalBalanceState(sheet, candidate);
    if (due > 0 && balance <= 0.001) {
      return { row: candidate, date, unit: cellRaw(sheet, 'B', candidate) };
    }
  }
  return null;
}

function alreadyPaidRentalMessage(match: { row: number; date: string; unit: string }): string {
  return `This installment is already paid: row ${match.row - 1}, unit ${match.unit}, due ${match.date}.`;
}

function syncSplitChildRows(sheet: AmlakWorksheet, parentRow: number, currentUser: User, kind: AmlakSheetKind = 'rentalIncome'): AmlakWorksheet {
  const parentDate = cellRaw(sheet, 'A', parentRow);
  const parentUnit = cellRaw(sheet, 'B', parentRow);
  const parentDetails = splitDetailBase(cellRaw(sheet, 'C', parentRow)) || (kind === 'fees' ? 'Fee payment' : 'Rent payment');
  const parentDue = parseSheetAmount(cellRaw(sheet, 'D', parentRow));
  const parentPaid = parseSheetAmount(cellRaw(sheet, 'E', parentRow));
  const remaining = Math.max(0, parentDue - parentPaid);
  let next = sheet;

  for (let childRow = 2; childRow <= next.rowCount; childRow++) {
    if (childRow === parentRow || !rowHasData(next, childRow)) continue;
    const meta = next.rowsMeta?.[String(childRow)] as any;
    if (meta?.status === 'posted' || meta?.postedTransactionId) continue;

    if (!isSplitChildForParent(next, childRow, parentRow)) continue;

    const childDetails = cellRaw(next, 'C', childRow);
    const method = cellRaw(next, 'F', childRow)
      ? rowPaymentMethod(next, 'rentalIncome', childRow)
      : splitDetailMethod(childDetails) || 'BANK';
    next = setWorksheetCellFast(next, `A${childRow}`, parentDate);
    next = setWorksheetCellFast(next, `B${childRow}`, parentUnit);
    next = setWorksheetCellFast(next, `C${childRow}`, normalizeAmlakTextValue(`${parentDetails} - balance ${method}`));
    next = setWorksheetCellFast(next, `D${childRow}`, moneyRaw(remaining));
    next = setWorksheetRowMeta(next, childRow, currentUser, {
      status: 'draft',
      generatedDueSource: kind === 'fees' ? 'fees-monitoring' : 'monitoring',
      splitPaymentChild: true,
      splitParentRow: parentRow,
      splitParentDueDate: parentDate,
      splitParentUnit: parentUnit,
      splitParentOriginalDue: parentDue,
    });
  }

  return next;
}

function postedRowMeta(meta: any): boolean {
  return meta?.status === 'posted' || !!meta?.postedTransactionId;
}

function insertWorksheetBlankRow(sheet: AmlakWorksheet, row: number): AmlakWorksheet {
  const insertAt = Math.max(2, Math.min(row, sheet.rowCount + 1));
  const cells = Object.values(sheet.cells || {}).reduce<AmlakWorksheet['cells']>((acc, cell) => {
    const match = cell.address.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      acc[cell.address] = cell;
      return acc;
    }
    const col = colLabelToIndex(match[1]);
    const oldRow = Number(match[2]);
    const nextRow = oldRow >= insertAt ? oldRow + 1 : oldRow;
    const nextAddress = cellAddress(col, nextRow);
    acc[nextAddress] = { ...cell, address: nextAddress };
    return acc;
  }, {});

  const rowsMeta = Object.entries(sheet.rowsMeta || {}).reduce<AmlakWorksheet['rowsMeta']>((acc, [key, meta]) => {
    if (!meta) return acc;
    const oldRow = Number(key);
    const nextRow = oldRow >= insertAt ? oldRow + 1 : oldRow;
    acc![String(nextRow)] = {
      ...meta,
      row: nextRow,
      splitParentRow: meta.splitParentRow && meta.splitParentRow >= insertAt
        ? meta.splitParentRow + 1
        : meta.splitParentRow,
    };
    return acc;
  }, {});

  return {
    ...sheet,
    rowCount: Math.max(sheet.rowCount + 1, insertAt),
    cells,
    rowsMeta,
    updatedAt: Date.now(),
  };
}

function deleteWorksheetRow(sheet: AmlakWorksheet, row: number): AmlakWorksheet {
  const target = Math.max(2, Math.min(row, sheet.rowCount));
  const cells = Object.values(sheet.cells || {}).reduce<AmlakWorksheet['cells']>((acc, cell) => {
    const match = cell.address.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      acc[cell.address] = cell;
      return acc;
    }
    const oldRow = Number(match[2]);
    if (oldRow === target) return acc;
    const col = colLabelToIndex(match[1]);
    const nextRow = oldRow > target ? oldRow - 1 : oldRow;
    const nextAddress = cellAddress(col, nextRow);
    acc[nextAddress] = { ...cell, address: nextAddress };
    return acc;
  }, {});

  const rowsMeta = Object.entries(sheet.rowsMeta || {}).reduce<AmlakWorksheet['rowsMeta']>((acc, [key, meta]) => {
    if (!meta) return acc;
    const oldRow = Number(key);
    if (oldRow === target) return acc;
    const nextRow = oldRow > target ? oldRow - 1 : oldRow;
    const splitParentRow = meta.splitParentRow
      ? meta.splitParentRow === target
        ? undefined
        : meta.splitParentRow > target
          ? meta.splitParentRow - 1
          : meta.splitParentRow
      : meta.splitParentRow;
    acc![String(nextRow)] = { ...meta, row: nextRow, splitParentRow };
    return acc;
  }, {});

  return {
    ...sheet,
    rowCount: Math.max(2, sheet.rowCount - 1),
    cells,
    rowsMeta,
    updatedAt: Date.now(),
  };
}

function clearUnpostedRentalRow(sheet: AmlakWorksheet, row: number, currentUser: User): AmlakWorksheet {
  let next = sheet;
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
    next = setWorksheetCellFast(next, `${col}${row}`, '');
  });
  return setWorksheetRowMeta(next, row, currentUser, {
    status: 'draft',
    error: undefined,
    generatedDueSource: undefined,
    generatedDueKey: undefined,
    generatedAt: undefined,
    splitPaymentChild: undefined,
    splitParentRow: undefined,
    splitParentDueDate: undefined,
    splitParentUnit: undefined,
    splitParentOriginalDue: undefined,
  });
}

function clearManualDraftRow(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): AmlakWorksheet {
  let next = sheet;
  sheetColumns(kind).forEach(column => {
    if (column.col) next = setWorksheetCellFast(next, `${column.col}${row}`, '');
  });
  if (!next.rowsMeta?.[String(row)]) return next;
  const { [String(row)]: _removed, ...rowsMeta } = next.rowsMeta;
  return { ...next, rowsMeta, updatedAt: Date.now() };
}

function clearSplitRowTree(sheet: AmlakWorksheet, row: number, currentUser: User, visited = new Set<number>()): AmlakWorksheet {
  if (visited.has(row)) return sheet;
  visited.add(row);
  let next = sheet;
  directSplitChildRows(next, row).forEach(childRow => {
    next = clearSplitRowTree(next, childRow, currentUser, visited);
  });
  return clearUnpostedRentalRow(next, row, currentUser);
}

function directSplitChildRows(sheet: AmlakWorksheet, parentRow: number): number[] {
  const rows: number[] = [];
  for (let childRow = 2; childRow <= sheet.rowCount; childRow++) {
    if (isSplitChildForParent(sheet, childRow, parentRow)) rows.push(childRow);
  }
  return rows.sort((a, b) => a - b);
}

function splitDescendantRows(sheet: AmlakWorksheet, parentRow: number, visited = new Set<number>()): number[] {
  if (visited.has(parentRow)) return [];
  visited.add(parentRow);
  return directSplitChildRows(sheet, parentRow).flatMap(childRow => [
    childRow,
    ...splitDescendantRows(sheet, childRow, visited),
  ]);
}

function deleteSplitChildRows(sheet: AmlakWorksheet, parentRow: number): AmlakWorksheet {
  const rows = Array.from(new Set(splitDescendantRows(sheet, parentRow))).sort((a, b) => b - a);
  return rows.reduce((next, row) => deleteWorksheetRow(next, row), sheet);
}

function autoEnsureSplitRow(sheet: AmlakWorksheet, parentRow: number, currentUser: User, kind: AmlakSheetKind = 'rentalIncome'): { sheet: AmlakWorksheet; targetRow?: number; remaining?: number } {
  const meta = sheet.rowsMeta?.[String(parentRow)];
  if (postedRowMeta(meta)) return { sheet };
  const dueDate = cellRaw(sheet, 'A', parentRow);
  const unit = cellRaw(sheet, 'B', parentRow);
  const due = parseSheetAmount(cellRaw(sheet, 'D', parentRow));
  const paid = parseSheetAmount(cellRaw(sheet, 'E', parentRow));
  const remaining = Math.max(0, due - paid);
  if (!dueDate || !unit || due <= 0) return { sheet };

  let next = syncSplitChildRows(sheet, parentRow, currentUser, kind);
  const childRows = directSplitChildRows(next, parentRow).filter(childRow => {
    const childMeta = next.rowsMeta?.[String(childRow)];
    return !postedRowMeta(childMeta);
  });

  if (paid <= 0 || remaining <= 0.001) {
    if (kind === 'fees') {
      return { sheet: deleteSplitChildRows(next, parentRow) };
    }
    childRows.forEach(childRow => {
      next = clearSplitRowTree(next, childRow, currentUser);
    });
    return { sheet: next };
  }

  let targetRow = childRows[0];
  if (!targetRow) {
    targetRow = parentRow + 1;
    if (targetRow <= next.rowCount && rowHasData(next, targetRow)) {
      next = insertWorksheetBlankRow(next, targetRow);
    } else {
      next = ensureRowCapacity(next, targetRow);
    }
  }

  const parentDetails = splitDetailBase(cellRaw(next, 'C', parentRow)) || (kind === 'fees' ? 'Fee payment' : 'Rent payment');
  const currentMethod = rowPaymentMethod(next, 'rentalIncome', parentRow);
  const childMethod = cellRaw(next, 'F', targetRow) || (currentMethod === 'CASH' ? 'BANK' : 'CASH');
  next = setWorksheetCellFast(next, `A${targetRow}`, dueDate);
  next = setWorksheetCellFast(next, `B${targetRow}`, unit);
  next = setWorksheetCellFast(next, `C${targetRow}`, normalizeAmlakTextValue(`${parentDetails} - balance ${childMethod}`));
  next = setWorksheetCellFast(next, `D${targetRow}`, moneyRaw(remaining));
  if (parseSheetAmount(cellRaw(next, 'E', targetRow)) <= 0.001) next = setWorksheetCellFast(next, `E${targetRow}`, '');
  next = setWorksheetCellFast(next, `F${targetRow}`, childMethod);
  if (parseSheetAmount(cellRaw(next, 'E', targetRow)) <= 0.001) next = setWorksheetCellFast(next, `G${targetRow}`, '');
  next = setWorksheetRowMeta(next, targetRow, currentUser, {
    status: 'draft',
    enteredBy: currentUser.id,
    enteredByName: currentUser.name,
    generatedDueSource: kind === 'fees' ? 'fees-monitoring' : 'monitoring',
    generatedDueKey: `${dueDate}|${normRowKey(unit)}|split-${parentRow}-${targetRow}`,
    generatedAt: Date.now(),
    splitPaymentChild: true,
    splitParentRow: parentRow,
    splitParentDueDate: dueDate,
    splitParentUnit: unit,
    splitParentOriginalDue: due,
    manualAddedRow: undefined,
  });

  return { sheet: next, targetRow, remaining };
}

function clearRentalPaymentFields(sheet: AmlakWorksheet, row: number, currentUser: User): AmlakWorksheet {
  let next = setWorksheetCellFast(sheet, `E${row}`, '');
  next = setWorksheetCellFast(next, `F${row}`, '');
  next = setWorksheetCellFast(next, `G${row}`, '');
  next = setWorksheetRowMeta(next, row, currentUser, {
    status: 'draft',
    error: undefined,
    enteredBy: currentUser.id,
    enteredByName: currentUser.name,
    paymentClearedAt: Date.now(),
  });

  for (let childRow = 2; childRow <= next.rowCount; childRow++) {
    if (!isSplitChildForParent(next, childRow, row)) continue;
    next = clearSplitRowTree(next, childRow, currentUser);
  }

  return next;
}

function clearRentalUnitRow(sheet: AmlakWorksheet, row: number, currentUser: User): AmlakWorksheet {
  const previousMeta = sheet.rowsMeta?.[String(row)] as any;
  const splitChildRows: number[] = [];
  for (let childRow = 2; childRow <= sheet.rowCount; childRow++) {
    if (isSplitChildForParent(sheet, childRow, row)) splitChildRows.push(childRow);
  }
  let next = sheet;
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
    next = setWorksheetCellFast(next, `${col}${row}`, '');
  });
  next = setWorksheetRowMeta(next, row, currentUser, {
    status: 'draft',
    error: undefined,
    enteredBy: currentUser.id,
    enteredByName: currentUser.name,
    generatedDueSource: undefined,
    generatedDueKey: undefined,
    generatedAt: undefined,
    generatedDueSuppressedKey: previousMeta?.generatedDueKey || previousMeta?.generatedDueSuppressedKey,
    manualAddedRow: previousMeta?.manualAddedRow,
    splitPaymentChild: undefined,
    splitParentRow: undefined,
    splitParentDueDate: undefined,
    splitParentUnit: undefined,
    splitParentOriginalDue: undefined,
  });

  splitChildRows.forEach(childRow => {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
      next = setWorksheetCellFast(next, `${col}${childRow}`, '');
    });
    next = setWorksheetRowMeta(next, childRow, currentUser, {
      status: 'draft',
      error: undefined,
      enteredBy: currentUser.id,
      enteredByName: currentUser.name,
      generatedDueSource: undefined,
      generatedDueKey: undefined,
      generatedAt: undefined,
      splitPaymentChild: undefined,
      splitParentRow: undefined,
      splitParentDueDate: undefined,
      splitParentUnit: undefined,
      splitParentOriginalDue: undefined,
    });
  });

  return next;
}

function rowMonthKey(sheet: AmlakWorksheet, row: number): string {
  return monthKeyFromDate(cellRaw(sheet, 'A', row));
}

function rowPaidDate(sheet: AmlakWorksheet, row: number): string {
  return cellRaw(sheet, 'G', row) || cellRaw(sheet, 'A', row);
}

function rowDisplayMonthKey(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): string {
  return isRentalDueBoardKind(kind)
    ? monthKeyFromDate(rowPaidDate(sheet, row))
    : rowMonthKey(sheet, row);
}

function rowMatchesSheetSearch(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '');
  const compactTerm = compact(term);
  const meta = sheet.rowsMeta?.[String(row)];
  const values = [
    String(row - 1),
    rowDisplayMonthKey(sheet, kind, row),
    String(meta?.enteredByName || ''),
    String(meta?.status || ''),
    ...sheetColumns(kind).map(column => columnDisplayValue(sheet, column, row)),
    ...Array.from({ length: sheet.colCount }, (_, index) => cellRaw(sheet, indexToColLabel(index + 1), row)),
  ];
  return values.some(value => {
    const text = String(value || '').toLowerCase();
    return text.includes(term) || (!!compactTerm && compact(text).includes(compactTerm));
  });
}

function sheetColumns(kind: AmlakSheetKind): SheetColumn[] {
  return COLUMNS[kind === 'income' ? 'rentalIncome' : kind];
}

function cellSelectionKey(row: number, key: ColumnKind): string {
  return `${row}:${key}`;
}

function parseCellSelectionKey(value: string): { row: number; key: ColumnKind } | null {
  const [rowText, key] = String(value || '').split(':');
  const row = Number(rowText);
  if (!Number.isFinite(row) || row <= 1 || !key) return null;
  return { row, key: key as ColumnKind };
}

function isSheetCellEditable(kind: AmlakSheetKind, column: SheetColumn, posted: boolean, locked: boolean): boolean {
  if (!column.col || posted || locked) return false;
  if (['dueAmount', 'dueDate', 'balance', 'enteredBy', 'status'].includes(column.key)) return false;
  return !!sheetColumns(kind).some(item => item.key === column.key && item.col === column.col);
}

function isGeneratedRentalDueRow(sheet: AmlakWorksheet, row: number): boolean {
  const meta = sheet.rowsMeta?.[String(row)] as any;
  return meta?.generatedDueSource === 'monitoring' && !!meta?.generatedDueKey;
}

function isDuplicateAutoRentalDueRow(sheet: AmlakWorksheet, row: number): boolean {
  const meta = sheet.rowsMeta?.[String(row)] as any;
  const looksAuto = meta?.generatedDueSource === 'monitoring' ||
    normRowKey(meta?.enteredByName) === 'amlak' ||
    normRowKey(meta?.enteredBy) === 'system';
  const key = [
    cellRaw(sheet, 'A', row) || '',
    normRowKey(cellRaw(sheet, 'B', row)),
    amountRowKey(parseSheetAmount(cellRaw(sheet, 'D', row))),
  ].join('|');
  if (key === '||0') return false;
  for (let other = 2; other <= sheet.rowCount; other++) {
    if (other === row || !rowHasData(sheet, other)) continue;
    const otherKey = [
      cellRaw(sheet, 'A', other) || '',
      normRowKey(cellRaw(sheet, 'B', other)),
      amountRowKey(parseSheetAmount(cellRaw(sheet, 'D', other))),
    ].join('|');
    if (otherKey !== key) continue;
    const otherMeta = sheet.rowsMeta?.[String(other)] as any;
    const otherLooksAuto = otherMeta?.generatedDueSource === 'monitoring' ||
      normRowKey(otherMeta?.enteredByName) === 'amlak' ||
      normRowKey(otherMeta?.enteredBy) === 'system';
    if (!looksAuto && otherLooksAuto) return true;
    if (looksAuto && otherLooksAuto && other < row && parseSheetAmount(cellRaw(sheet, 'E', row)) <= 0.001 && !cellRaw(sheet, 'G', row)) return true;
  }
  return false;
}

function isDuplicateAutoFeeDueRow(sheet: AmlakWorksheet, row: number): boolean {
  const meta = sheet.rowsMeta?.[String(row)] as any;
  const looksAuto = meta?.generatedDueSource === 'fees-monitoring' ||
    normRowKey(meta?.enteredByName) === 'amlak' ||
    normRowKey(meta?.enteredBy) === 'system';
  const key = feeDueLegacyKey(cellRaw(sheet, 'A', row), cellRaw(sheet, 'B', row), parseSheetAmount(cellRaw(sheet, 'D', row)));
  if (key === '||0') return false;
  for (let other = 2; other <= sheet.rowCount; other++) {
    if (other === row || !rowHasData(sheet, other)) continue;
    const otherKey = feeDueLegacyKey(cellRaw(sheet, 'A', other), cellRaw(sheet, 'B', other), parseSheetAmount(cellRaw(sheet, 'D', other)));
    if (otherKey !== key) continue;
    const otherMeta = sheet.rowsMeta?.[String(other)] as any;
    const otherLooksAuto = otherMeta?.generatedDueSource === 'fees-monitoring' ||
      normRowKey(otherMeta?.enteredByName) === 'amlak' ||
      normRowKey(otherMeta?.enteredBy) === 'system';
    if (!looksAuto && otherLooksAuto) return true;
    if (looksAuto && otherLooksAuto && other < row && parseSheetAmount(cellRaw(sheet, 'E', row)) <= 0.001 && !cellRaw(sheet, 'G', row)) return true;
  }
  return false;
}

function normRowKey(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function amountRowKey(value: number): string {
  return String(Math.round((Number(value) || 0) * 100));
}

function rowPostedMatchKey(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): string {
  const canonicalKind = kind === 'income' ? 'rentalIncome' : kind;
  const date = canonicalKind === 'rentalIncome' || canonicalKind === 'vatIncome' || canonicalKind === 'fees'
    ? cellRaw(sheet, 'G', row)
    : cellRaw(sheet, 'A', row);
  const amount = canonicalKind === 'rentalIncome'
    ? (Number(String(cellRaw(sheet, 'E', row) || '').replace(/,/g, '')) || 0)
    : rowEnteredAmount(sheet, kind, row);
  if (!date || amount <= 0) return '';
  if (canonicalKind === 'rentalIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'vatIncome' || canonicalKind === 'fees') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'otherIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'ownerExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'vatExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'D', row) || cellRaw(sheet, 'F', row))].join('|');
  if (canonicalKind === 'treasury') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row)), normRowKey(cellRaw(sheet, 'C', row)), normRowKey(cellRaw(sheet, 'D', row)), normRowKey(cellRaw(sheet, 'E', row))].join('|');
  return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
}

function transactionPostedMatchKey(tx: Transaction, kind: AmlakSheetKind): string {
  const canonicalKind = kind === 'income' ? 'rentalIncome' : kind;
  const date = tx.date || '';
  const amount = canonicalKind === 'expense'
    ? (Number(tx.amount) || 0) + (Number(tx.extraAmount) || 0)
    : transactionDisplayAmount(tx);
  if (!date || amount <= 0) return '';
  if (canonicalKind === 'rentalIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.unitNumber)].join('|');
  if (canonicalKind === 'vatIncome' || canonicalKind === 'fees') return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.unitNumber)].join('|');
  if (canonicalKind === 'otherIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.expenseCategory || 'Other Income')].join('|');
  if (canonicalKind === 'ownerExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.ownerName)].join('|');
  if (canonicalKind === 'vatExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.vendorName || tx.vendorRefNo || tx.vatInvoiceNumber)].join('|');
  if (canonicalKind === 'treasury') return [canonicalKind, date, amountRowKey(amount), normRowKey((tx as any).fromType), normRowKey((tx as any).fromId), normRowKey((tx as any).toType), normRowKey((tx as any).toId)].join('|');
  return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.expenseCategory || 'General Expense')].join('|');
}

function transactionMatchesExistingRow(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind, row: number): boolean {
  const canonicalKind = kind === 'income' ? 'rentalIncome' : kind;
  if (canonicalKind === 'rentalIncome' || canonicalKind === 'vatIncome' || canonicalKind === 'fees') {
    const paidDate = cellRaw(sheet, 'G', row);
    const dueDate = cellRaw(sheet, 'A', row);
    const txDueDate = String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || '');
    if (paidDate ? paidDate !== tx.date : (dueDate !== txDueDate && dueDate !== tx.date)) return false;
  } else if (cellRaw(sheet, 'A', row) !== tx.date) {
    return false;
  }
  const amount = transactionDisplayAmount(tx);
  const rowAmount = canonicalKind === 'rentalIncome'
    ? (Number(String(cellRaw(sheet, 'E', row) || cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0)
    : rowEnteredAmount(sheet, kind, row);
  if (rowAmount > 0 && amount > 0 && amountRowKey(rowAmount) !== amountRowKey(amount)) return false;
  if (canonicalKind === 'rentalIncome' || canonicalKind === 'vatIncome' || canonicalKind === 'fees') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.unitNumber);
  }
  if (canonicalKind === 'otherIncome') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.expenseCategory || 'Other Income');
  }
  if (canonicalKind === 'ownerExpense') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.ownerName);
  }
  if (canonicalKind === 'vatExpense') {
    return normRowKey(cellRaw(sheet, 'D', row) || cellRaw(sheet, 'F', row)) === normRowKey(tx.vendorName || tx.vendorRefNo || tx.vatInvoiceNumber);
  }
  if (canonicalKind === 'treasury') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey((tx as any).fromType) &&
      normRowKey(cellRaw(sheet, 'C', row)) === normRowKey((tx as any).fromId) &&
      normRowKey(cellRaw(sheet, 'D', row)) === normRowKey((tx as any).toType) &&
      normRowKey(cellRaw(sheet, 'E', row)) === normRowKey((tx as any).toId);
  }
  return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.expenseCategory || 'General Expense');
}

function rowPaymentMethod(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): 'CASH' | 'BANK' | 'CHEQUE' {
  const methodCol = sheetColumns(kind).find(c => c.key === 'paymentMethod')?.col || 'D';
  const value = String(cellRaw(sheet, methodCol, row) || 'BANK').toUpperCase();
  if (value.includes('CASH')) return 'CASH';
  if (value.includes('CHEQUE') || value.includes('CHECK')) return 'CHEQUE';
  return 'BANK';
}

function rowEnteredAmount(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): number {
  const columns = sheetColumns(kind);
  const amountCol = columns.find(c => c.key === 'amount')?.col || 'E';
  const extraCol = columns.find(c => c.key === 'extra')?.col;
  const amount = Number(String(cellRaw(sheet, amountCol, row) || '').replace(/,/g, '')) || 0;
  const extra = extraCol ? (Number(String(cellRaw(sheet, extraCol, row) || '').replace(/,/g, '')) || 0) : 0;
  return Math.max(0, amount + extra);
}

function shouldNormalizeInputCell(kind: AmlakSheetKind, col: string): boolean {
  const column = sheetColumns(kind).find(item => item.col === col);
  return !!column && ['owner', 'category', 'subCategory', 'related', 'vendor', 'details', 'fromAccount', 'toAccount', 'fromBank', 'toBank', 'purpose', 'notes'].includes(column.key);
}

function transactionDisplayAmount(tx: Transaction): number {
  return Number((tx as any).amountIncludingVAT ?? (tx as any).totalWithVat ?? tx.amount) || 0;
}

function salaryCoveredAmount(tx: Transaction): number {
  const paidNet = Number(tx.amount || 0);
  const deductions = Number((tx as any).deductionAmount || 0) + Number((tx as any).borrowDeductionAmount || 0);
  const bonusPaid = Number((tx as any).bonusAmount || 0);
  return Math.max(0, paidNet + deductions - bonusPaid);
}

function resolveSheetUser(users: User[], value: string): User | undefined {
  const key = normRowKey(value);
  if (!key) return undefined;
  return users.find((user: any) => {
    const values = [user.id, user.name, user.email].map(normRowKey);
    return values.some(candidate => candidate && (candidate === key || candidate.includes(key) || key.includes(candidate)));
  });
}

function salaryAutoPeriodForUser(user: User | undefined, rowDate: string, transactions: Transaction[]): string {
  const fallback = previousMonthPeriod(rowDate || dateToLocalStr(new Date()));
  if (!user?.id) return fallback;
  const salaryTxs = transactions.filter((tx: any) => (
    tx.type === TransactionType.EXPENSE &&
    (tx.expenseCategory === ExpenseCategory.SALARY || tx.expenseCategory === 'Salary') &&
    tx.employeeId === user.id &&
    tx.status !== TransactionStatus.REJECTED &&
    !tx.deleted
  ));
  const periods = salaryTxs.map((tx: any) => String(tx.salaryPeriod || periodFromDate(tx.date || ''))).filter(Boolean).sort();
  const lastPeriod = periods[periods.length - 1] || '';
  if (!lastPeriod) return fallback;
  const fullSalary = Number((user as any).baseSalary || 0);
  if (fullSalary > 0) {
    const paidForLast = salaryTxs
      .filter((tx: any) => String(tx.salaryPeriod || periodFromDate(tx.date || '')) === lastPeriod)
      .reduce((sum, tx) => sum + salaryCoveredAmount(tx), 0);
    if (paidForLast < fullSalary) return lastPeriod;
  }
  const current = periodFromDate(rowDate || dateToLocalStr(new Date()));
  if (lastPeriod === current && new Date(rowDate || dateToLocalStr(new Date())).getDate() < 25) return lastPeriod;
  return nextMonthPeriod(lastPeriod);
}

function salarySheetAutofill(input: {
  users: User[];
  transactions: Transaction[];
  target: string;
  period?: string;
  rowDate: string;
}): { period: string; details: string; amount: number; fullyPaid: boolean } | null {
  const person = resolveSheetUser(input.users, input.target);
  if (!person) return null;
  const period = input.period || salaryAutoPeriodForUser(person, input.rowDate, input.transactions);
  const fullSalary = Number((person as any).baseSalary || 0);
  const paid = input.transactions
    .filter((tx: any) => (
      tx.type === TransactionType.EXPENSE &&
      (tx.expenseCategory === ExpenseCategory.SALARY || tx.expenseCategory === 'Salary') &&
      tx.employeeId === person.id &&
      tx.status !== TransactionStatus.REJECTED &&
      !tx.deleted &&
      String(tx.salaryPeriod || periodFromDate(tx.date || '')) === period
    ))
    .reduce((sum, tx) => sum + salaryCoveredAmount(tx), 0);
  const amount = Math.max(0, fullSalary - paid);
  return {
    period,
    amount,
    fullyPaid: fullSalary > 0 && paid >= fullSalary,
    details: `Salary ${formatSheetMonth(period)} - ${person.name || input.target}`.trim(),
  };
}

function resolveLeasedBuilding(buildings: Building[], value: string): Building | undefined {
  const key = normRowKey(value);
  if (!key) return undefined;
  return buildings.find((building: any) => {
    if (!building?.lease?.isLeased) return false;
    const candidates = [building.id, building.name, building.lease?.landlordName, `${building.name} - ${building.lease?.landlordName || ''}`].map(normRowKey);
    return candidates.some(candidate => candidate && (candidate === key || candidate.includes(key) || key.includes(candidate)));
  });
}

function propertyRentSheetAutofill(buildings: Building[], transactions: Transaction[], target: string): { details: string; amount: number } | null {
  const building = resolveLeasedBuilding(buildings, target);
  const lease = (building as any)?.lease;
  if (!building || !lease?.isLeased) return null;
  const totalRent = Number(lease.totalRent || 0);
  const installmentCount = Number(lease.installmentCount || 12) || 12;
  const installmentAmount = totalRent > 0 ? Math.round(totalRent / installmentCount) : Number(lease.monthlyRent || 0);
  const previousPayments = transactions.filter((tx: any) => (
    tx.type === TransactionType.EXPENSE &&
    (tx.expenseCategory === ExpenseCategory.PROPERTY_RENT || tx.expenseCategory === 'Property Rent') &&
    tx.buildingId === building.id &&
    tx.status !== TransactionStatus.REJECTED &&
    !tx.deleted
  ));
  const givenSoFar = previousPayments.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalRemaining = totalRent > 0 ? Math.max(0, totalRent - givenSoFar) : installmentAmount;
  let installmentNo = 1;
  let paidThisInstallment = 0;
  let remainingThisInstallment = installmentAmount;
  if (totalRent > 0 && installmentAmount > 0) {
    for (let index = 1; index <= installmentCount; index++) {
      const cumulative = index * installmentAmount;
      if (givenSoFar < cumulative) {
        installmentNo = index;
        paidThisInstallment = Math.max(0, givenSoFar - ((index - 1) * installmentAmount));
        remainingThisInstallment = Math.max(0, installmentAmount - paidThisInstallment);
        break;
      }
    }
    if (givenSoFar >= totalRent) {
      installmentNo = installmentCount;
      paidThisInstallment = installmentAmount;
      remainingThisInstallment = 0;
    }
  }
  const isPartial = paidThisInstallment > 0 && remainingThisInstallment > 0;
  const amount = Math.min(Math.max(0, remainingThisInstallment || installmentAmount), totalRemaining || installmentAmount);
  const landlord = lease.landlordName ? ` (${lease.landlordName})` : '';
  const prefix = isPartial ? 'Balance Payment' : 'Installment';
  return {
    amount,
    details: `${prefix} ${installmentNo} of ${installmentCount} - ${building.name}${landlord}`,
  };
}

function workbookForBuilding(workbooks: AmlakWorkbook[], building: Building | undefined): AmlakWorkbook | undefined {
  if (!building) return undefined;
  return workbooks.find(w => w.buildingId === building.id && !w.deleted);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function endOfMonthAfter(monthKey: string, monthsAhead: number): string {
  const start = monthStart(monthKey);
  const next = addMonths(start, monthsAhead + 1);
  return dateToLocalStr(new Date(next.getTime() - 86400000));
}

function monthStart(monthKey: string): Date {
  return new Date(`${monthKey}-01T00:00:00`);
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  if (endMonth < startMonth) return [];
  const months: string[] = [];
  const cursor = monthStart(startMonth);
  const end = monthStart(endMonth);
  while (cursor <= end) {
    months.push(dateToLocalStr(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function isRentalDueBoardKind(kind: AmlakSheetKind): boolean {
  return kind === 'rentalIncome' || kind === 'income';
}

function isSplitBalanceBoardKind(kind: AmlakSheetKind): boolean {
  return isRentalDueBoardKind(kind) || kind === 'fees';
}

function isGeneratedPriorOrPastBalanceRow(meta: any): boolean {
  const generatedKey = String(meta?.generatedDueKey || '');
  return meta?.generatedDueSource === 'monitoring' && (
    generatedKey.endsWith('-past-balance') ||
    generatedKey.includes('-prior-lease')
  );
}

function supportsManualRows(kind: AmlakSheetKind): boolean {
  return !isRentalDueBoardKind(kind);
}

function buildingIdCandidates(id: unknown): string[] {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const parts = raw.split(':').map(part => part.trim()).filter(Boolean);
  return Array.from(new Set([raw, parts[parts.length - 1] || raw]));
}

function itemMatchesSelectedBuilding(item: any, building: Building): boolean {
  if (!item || !building) return false;
  const ids = new Set(buildingIdCandidates(building.id));
  const itemIds = [item.buildingId, item.building, item.building_id, item.id]
    .flatMap(buildingIdCandidates);
  if (itemIds.some(id => ids.has(id))) return true;
  const buildingName = normRowKey((building as any).name || (building as any).buildingName || '');
  const itemName = normRowKey(item.buildingName || item.building_name || '');
  return !!buildingName && !!itemName && buildingName === itemName;
}

function treasuryBuildingOptionLabel(building: Building): string {
  const anyBuilding = building as any;
  const name = String(building.name || anyBuilding._rawBuildingId || building.id || '').trim();
  const bookName = String(anyBuilding._bookDisplayName || anyBuilding.bookName || '').trim();
  return bookName ? `${name} - ${bookName}` : name;
}

function buildingDisplayNameFromId(buildingId: unknown, buildings: Building[]): string {
  const ids = new Set(buildingIdCandidates(buildingId));
  if (!ids.size) return '';
  const match = buildings.find((building: any) => {
    const candidates = [
      building.id,
      building._rawBuildingId,
      building.rawId,
      building.buildingId,
    ].flatMap(buildingIdCandidates);
    return candidates.some(id => ids.has(id));
  });
  return match ? treasuryBuildingOptionLabel(match) : '';
}

function transactionBuildingAccountLabel(tx: Transaction, side: 'from' | 'to', buildings: Building[]): string {
  const anyTx = tx as any;
  const id = side === 'from' ? anyTx.fromId : anyTx.toId;
  const storedName = side === 'from' ? anyTx.fromName : anyTx.toName;
  return buildingDisplayNameFromId(id, buildings) || String(storedName || id || '').trim();
}

function transactionInstallmentKey(tx: Transaction): string {
  return String((tx as any).dueDate || tx.installmentStartDate || '').slice(0, 10);
}

function rentalDueRowKey(row: { date: string; unit: string; dueAmount: number; contractId?: string; sourceKey?: string }): string {
  return row.sourceKey || [
    row.contractId || '',
    row.date || '',
    normRowKey(row.unit),
    amountRowKey(row.dueAmount),
  ].join('|');
}

function legacyRentalDueKey(date: string, unit: string): string {
  return `${date}|${normRowKey(unit)}`;
}

function feeDueLegacyKey(date: string, unit: string, dueAmount: number): string {
  return [date || '', normRowKey(unit), amountRowKey(dueAmount)].join('|');
}

function rentalSyncSignature(sheet: AmlakWorksheet): string {
  const rows = new Set<number>();
  Object.entries(sheet.rowsMeta || {}).forEach(([rowKey, meta]) => {
    const row = Number(rowKey);
    if (Number.isFinite(row) && row > 1 && meta) rows.add(row);
  });
  Object.values(sheet.cells || {}).forEach(cell => {
    const match = String(cell.address || '').match(/^([A-G])(\d+)$/i);
    const row = Number(match?.[2] || 0);
    if (row > 1) rows.add(row);
  });
  return JSON.stringify([
    `rows:${sheet.rowCount}`,
    ...Array.from(rows).sort((a, b) => a - b).map(row => {
      const meta = sheet.rowsMeta?.[String(row)] as any;
      return [
        row,
        cellRaw(sheet, 'A', row),
        cellRaw(sheet, 'B', row),
        cellRaw(sheet, 'C', row),
        cellRaw(sheet, 'D', row),
        cellRaw(sheet, 'E', row),
        cellRaw(sheet, 'F', row),
        cellRaw(sheet, 'G', row),
        meta?.generatedDueKey || '',
        meta?.generatedDueSuppressedKey || '',
        meta?.postedTransactionId || '',
        meta?.status || '',
        meta?.splitPaymentChild ? 'split' : '',
        meta?.splitParentRow || '',
      ].join('\u001f');
    }),
  ]);
}

function buildRentalDueRows(input: {
  building: Building;
  contracts: Contract[];
  transactions: Transaction[];
  activeMonth: string;
}): Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string }> {
  const reportUpTo = endOfMonthAfter(input.activeMonth, 2);
  const currentMonthStart = `${input.activeMonth}-01`;
  const pastBalances: Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string }> = [];
  const currentAndUpcoming: Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string }> = [];

  buildMonitoringDueRoomRows({
    building: input.building,
    contracts: input.contracts,
    transactions: input.transactions,
    reportUpTo,
  }).forEach(row => {
    const dueAmount = Math.round(row.dueRent || 0);
    if (dueAmount <= 0) return;
    const contractId = row.contract.id;
    const unit = (row.contract as any).unitName || '';
    if (row.isPriorLeaseRow) {
      pastBalances.push({
        date: row.nextDueDate,
        unit,
        details: normalizeAmlakTextValue(`Prior lease balance - ${(row.contract as any).customerName || 'Tenant'} - Unit ${unit}${(row.contract as any).priorLeaseContractNoAtRenewal ? ` - old #${(row.contract as any).priorLeaseContractNoAtRenewal}` : (row.contract as any).contractNo ? ` - #${(row.contract as any).contractNo}` : ''}`),
        dueAmount,
        contractId,
        sourceKey: `${row.rowKey || `${contractId}-prior-lease`}-past-balance`,
      });
      return;
    }
    if (row.nextDueDate < currentMonthStart) {
      pastBalances.push({
        date: row.nextDueDate,
        unit,
        details: normalizeAmlakTextValue(`Installment balance - ${(row.contract as any).customerName || 'Tenant'} - Unit ${unit}${(row.contract as any).contractNo ? ` - #${(row.contract as any).contractNo}` : ''}`),
        dueAmount,
        contractId,
        sourceKey: `${row.rowKey || `${contractId}-${row.nextDueDate}`}-past-balance`,
      });
      return;
    }
    currentAndUpcoming.push({
      date: row.nextDueDate,
      unit,
      details: buildIncomeSheetDetails({
        building: input.building,
        contracts: input.contracts.filter((contract: any) => !contract.deleted),
        unitName: unit,
        date: row.nextDueDate,
      }),
      dueAmount,
      contractId,
      sourceKey: row.rowKey,
    });
  });

  return [...pastBalances, ...currentAndUpcoming]
    .sort((a, b) => a.date.localeCompare(b.date) || a.unit.localeCompare(b.unit));
}

function findManualRentalDueRow(input: {
  building: Building;
  contracts: Contract[];
  transactions: Transaction[];
  activeMonth: string;
  unit: string;
  date?: string;
}): { date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string } | null {
  const unitKey = normRowKey(input.unit);
  if (!unitKey) return null;
  const dueRows = buildRentalDueRows({
    building: input.building,
    contracts: input.contracts,
    transactions: input.transactions,
    activeMonth: input.activeMonth,
  }).filter(row => normRowKey(row.unit) === unitKey);
  if (!dueRows.length) return null;
  if (input.date) {
    const exact = dueRows.find(row => row.date === input.date);
    if (exact) return exact;
    const sameMonth = dueRows.find(row => row.date.slice(0, 7) === input.date?.slice(0, 7));
    if (sameMonth) return sameMonth;
  }
  return dueRows[0];
}

function buildFeeDueRows(input: {
  building: Building;
  contracts: Contract[];
  transactions: Transaction[];
  activeMonth: string;
}): Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string }> {
  const reportUpTo = endOfMonthAfter(input.activeMonth, 2);
  return buildMonitoringDueRoomRows({
    building: input.building,
    contracts: input.contracts,
    transactions: input.transactions,
    reportUpTo,
  })
    .filter(row => isNonResidentialBuildingForContract([input.building], row.contract as any))
    .map(row => {
      const dueAmount = Math.round(row.dueFees || 0);
      if (dueAmount <= 0) return null;
      const unit = (row.contract as any).unitName || '';
      return {
        date: row.nextDueDate,
        unit,
        details: normalizeAmlakTextValue(`Non-VAT Fees - ${(row.contract as any).customerName || 'Tenant'} - Unit ${unit}${(row.contract as any).contractNo ? ` - #${(row.contract as any).contractNo}` : ''}`),
        dueAmount,
        contractId: row.contract.id,
        sourceKey: `${row.rowKey || `${row.contract.id}-${row.installmentNo}`}-fees`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date) || a!.unit.localeCompare(b!.unit)) as Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string; sourceKey?: string }>;
}

function syncFeeDueRows(
  sheet: AmlakWorksheet,
  building: Building,
  contracts: Contract[],
  transactions: Transaction[],
  activeMonth: string,
): AmlakWorksheet {
  const rows = buildFeeDueRows({ building, contracts, transactions, activeMonth });
  const expectedKeys = new Set(rows.map(rentalDueRowKey));
  const expectedLegacyKeys = new Set(rows.map(row => feeDueLegacyKey(row.date, row.unit, row.dueAmount)));
  const preserved = new Map<string, { row: number; amount: string; method: string; paidDate: string; discount: string }>();
  const unusableRows = new Set<number>();
  let next = sheet;

  for (let row = 2; row <= sheet.rowCount; row++) {
    const meta = sheet.rowsMeta?.[String(row)] as any;
    if (postedRowMeta(meta)) {
      unusableRows.add(row);
      continue;
    }
    const rowDate = cellRaw(sheet, 'A', row);
    const rowUnit = cellRaw(sheet, 'B', row);
    const rowDue = parseSheetAmount(cellRaw(sheet, 'D', row));
    const legacyKey = feeDueLegacyKey(rowDate, rowUnit, rowDue);
    const rowMatch = expectedLegacyKeys.has(legacyKey);
    const generatedKey = meta?.generatedDueKey || '';
    const rowInfo = {
      row,
      amount: cellRaw(sheet, 'E', row),
      method: cellRaw(sheet, 'F', row),
      paidDate: cellRaw(sheet, 'G', row),
      discount: cellRaw(sheet, 'H', row),
    };
    if (rowMatch) {
      const existing = preserved.get(legacyKey);
      const existingMeta = existing ? sheet.rowsMeta?.[String(existing.row)] as any : null;
      if (!existing || (existingMeta?.generatedDueSource !== 'fees-monitoring' && meta?.generatedDueSource === 'fees-monitoring')) {
        preserved.set(legacyKey, rowInfo);
      }
    }
    if (meta?.generatedDueSource !== 'fees-monitoring') continue;
    if (generatedKey && expectedKeys.has(generatedKey)) {
      if (!preserved.has(generatedKey)) preserved.set(generatedKey, rowInfo);
      continue;
    }
    unusableRows.add(row);
  }

  const usedRows = new Set<number>();
  const usedLegacyRows = new Map<string, number>();
  const pickEmptyRow = () => {
    for (let row = 2; row <= next.rowCount; row++) {
      if (!usedRows.has(row) && !unusableRows.has(row) && !rowHasData(next, row)) return row;
    }
    return next.rowCount + 1;
  };

  rows.forEach(dueRow => {
    const key = rentalDueRowKey(dueRow);
    const legacyKey = feeDueLegacyKey(dueRow.date, dueRow.unit, dueRow.dueAmount);
    const generatedExisting = preserved.get(key);
    const legacyExisting = preserved.get(legacyKey);
    const existing = generatedExisting || legacyExisting;
    const generatedHasPayment = parseSheetAmount(generatedExisting?.amount || '') > 0.001 && !!generatedExisting?.paidDate;
    const generatedPaidAmount = generatedHasPayment ? generatedExisting!.amount : '0';
    const row = existing?.row || pickEmptyRow();
    usedRows.add(row);
    usedLegacyRows.set(legacyKey, row);
    next = ensureRowCapacity(next, row);
    next = setWorksheetCellFast(next, `A${row}`, dueRow.date);
    next = setWorksheetCellFast(next, `B${row}`, dueRow.unit);
    next = setWorksheetCellFast(next, `C${row}`, normalizeAmlakTextValue(dueRow.details));
    next = setWorksheetCellFast(next, `D${row}`, String(dueRow.dueAmount));
    next = setWorksheetCellFast(next, `E${row}`, generatedPaidAmount);
    next = setWorksheetCellFast(next, `F${row}`, generatedHasPayment ? generatedExisting?.method || '' : '');
    next = setWorksheetCellFast(next, `G${row}`, generatedHasPayment ? generatedExisting?.paidDate || '' : '');
    next = setWorksheetCellFast(next, `H${row}`, generatedExisting?.discount || '');
    next = {
      ...next,
      rowsMeta: {
        ...(next.rowsMeta || {}),
        [String(row)]: {
          ...(next.rowsMeta?.[String(row)] || {
            row,
            status: 'draft',
            enteredBy: 'system',
            enteredByName: 'Amlak',
            enteredAt: Date.now(),
          }),
          row,
          updatedAt: Date.now(),
          generatedDueSource: 'fees-monitoring',
          generatedDueKey: key,
          generatedAt: Date.now(),
        },
      },
    };
  });

  for (let row = 2; row <= next.rowCount; row++) {
    if (usedRows.has(row)) continue;
    const meta = next.rowsMeta?.[String(row)] as any;
    const legacyKey = feeDueLegacyKey(cellRaw(next, 'A', row), cellRaw(next, 'B', row), parseSheetAmount(cellRaw(next, 'D', row)));
    const keeperRow = usedLegacyRows.get(legacyKey);
    if (keeperRow && keeperRow !== row && expectedLegacyKeys.has(legacyKey) && !postedRowMeta(meta)) {
      next = clearManualDraftRow(next, 'fees', row);
      continue;
    }
    const looksAuto = meta?.generatedDueSource === 'fees-monitoring' ||
      normRowKey(meta?.enteredByName) === 'amlak' ||
      normRowKey(meta?.enteredBy) === 'system';
    if (!looksAuto || postedRowMeta(meta)) continue;
    if (!expectedLegacyKeys.has(legacyKey)) continue;
    const paid = parseSheetAmount(cellRaw(next, 'E', row));
    const paidDate = cellRaw(next, 'G', row);
    if (paid <= 0.001 && !paidDate) {
      next = clearManualDraftRow(next, 'fees', row);
    }
  }

  return next;
}

function customerVatForContract(contract: Contract, customers: any[]): string {
  const customer = customers.find((c: any) => c.id === contract.customerId) ||
    customers.find((c: any) => c.nameEn === contract.customerName || c.nameAr === contract.customerName || c.name === contract.customerName);
  return String((customer as any)?.vatNumber || (customer as any)?.vatNo || '');
}

function syncVatRentalDueRows(
  sheet: AmlakWorksheet,
  building: Building,
  contracts: Contract[],
  transactions: Transaction[],
  activeMonth: string,
  customers: any[],
): AmlakWorksheet {
  if (building.propertyType !== 'NON_RESIDENTIAL' && !(building as any).vatApplicable) {
    return sheet;
  }
  const rows = buildRentalDueRows({ building, contracts, transactions, activeMonth })
    .filter(row => {
      const contract = contracts.find(c => c.id === row.contractId);
      return !!contract && isNonResidentialBuildingForContract([building], contract as any);
    });
  const expectedKeys = new Set(rows.map(rentalDueRowKey));
  const preserved = new Map<string, { row: number; customerVAT: string; amount: string; method: string; paidDate: string }>();
  const unusableRows = new Set<number>();
  let next = sheet;

  for (let row = 2; row <= sheet.rowCount; row++) {
    const meta = sheet.rowsMeta?.[String(row)] as any;
    if (postedRowMeta(meta)) {
      unusableRows.add(row);
      continue;
    }
    if (meta?.generatedDueSource !== 'vat-monitoring') continue;
    const generatedKey = meta?.generatedDueKey || '';
    if (generatedKey && expectedKeys.has(generatedKey)) {
      preserved.set(generatedKey, {
        row,
        customerVAT: cellRaw(sheet, 'C', row),
        amount: cellRaw(sheet, 'F', row),
        method: cellRaw(sheet, 'H', row),
        paidDate: cellRaw(sheet, 'G', row),
      });
      continue;
    }
    next = clearManualDraftRow(next, 'vatIncome', row);
  }

  const usedRows = new Set<number>();
  const pickEmptyRow = () => {
    for (let row = 2; row <= next.rowCount; row++) {
      if (!usedRows.has(row) && !unusableRows.has(row) && !rowHasData(next, row)) return row;
    }
    return next.rowCount + 1;
  };

  rows.forEach(dueRow => {
    const key = rentalDueRowKey(dueRow);
    const existing = preserved.get(key);
    const row = existing?.row || pickEmptyRow();
    const contract = contracts.find(c => c.id === dueRow.contractId);
    usedRows.add(row);
    next = ensureRowCapacity(next, row);
    next = setWorksheetCellFast(next, `A${row}`, dueRow.date);
    next = setWorksheetCellFast(next, `B${row}`, dueRow.unit);
    next = setWorksheetCellFast(next, `C${row}`, existing?.customerVAT || (contract ? customerVatForContract(contract, customers) : ''));
    next = setWorksheetCellFast(next, `D${row}`, normalizeAmlakTextValue(dueRow.details));
    next = setWorksheetCellFast(next, `E${row}`, String(dueRow.dueAmount));
    next = setWorksheetCellFast(next, `F${row}`, existing?.amount || '');
    next = setWorksheetCellFast(next, `G${row}`, existing?.paidDate || '');
    next = setWorksheetCellFast(next, `H${row}`, existing?.method || '');
    next = {
      ...next,
      rowsMeta: {
        ...(next.rowsMeta || {}),
        [String(row)]: {
          ...(next.rowsMeta?.[String(row)] || {
            row,
            status: 'draft',
            enteredBy: 'system',
            enteredByName: 'Amlak',
            enteredAt: Date.now(),
          }),
          row,
          updatedAt: Date.now(),
          generatedDueSource: 'vat-monitoring',
          generatedDueKey: key,
          generatedAt: Date.now(),
        },
      },
    };
  });

  return next;
}

function rowPostedMetaMatchesRentalRow(sheet: AmlakWorksheet, row: number, transactions: Transaction[]): boolean {
  const meta = sheet.rowsMeta?.[String(row)];
  if (!meta?.postedTransactionId) return true;
  const tx = transactions.find(item => item.id === meta.postedTransactionId);
  if (!tx) return true;
  if (normRowKey(tx.unitNumber) !== normRowKey(cellRaw(sheet, 'B', row))) return false;
  const rowDate = cellRaw(sheet, 'A', row);
  const installmentKey = transactionInstallmentKey(tx);
  const txDueDate = installmentKey || String(tx.date || '');
  return !!rowDate && (txDueDate === rowDate || txDueDate.slice(0, 7) === rowDate.slice(0, 7));
}

function syncRentalDueRows(
  sheet: AmlakWorksheet,
  building: Building,
  contracts: Contract[],
  transactions: Transaction[],
  activeMonth: string,
  currentUser: User,
): AmlakWorksheet {
  const rows = buildRentalDueRows({ building, contracts, transactions, activeMonth });

  const expectedKeys = new Set(rows.map(rentalDueRowKey));
  const expectedLegacyKeys = new Set(rows.map(row => legacyRentalDueKey(row.date, row.unit)));
  const preserved = new Map<string, { row: number; amount: string; method: string; paidDate: string }>();
  const unusableRows = new Set<number>();
  let next = sheet;
  for (let row = 2; row <= sheet.rowCount; row++) {
    const rowDate = cellRaw(sheet, 'A', row);
    const rowUnit = cellRaw(sheet, 'B', row);
    const rowDue = Number(String(cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0;
    const amount = cellRaw(sheet, 'E', row);
    const paidDate = cellRaw(sheet, 'G', row);
    const legacyKey = legacyRentalDueKey(rowDate, rowUnit);
    if (legacyKey !== '|') {
      const meta = sheet.rowsMeta?.[String(row)] as any;
      if (isSplitPaymentChildRow(sheet, row)) continue;
      const generatedKey = meta?.generatedDueKey || '';
      const postedMismatch = !!meta?.postedTransactionId && !rowPostedMetaMatchesRentalRow(sheet, row, transactions);
      const posted = meta?.status === 'posted' || meta?.postedTransactionId;
      if (posted) unusableRows.add(row);
      const staleGenerated = !posted &&
        rowDue > 0 &&
        !amount &&
        (
          (meta?.generatedDueSource === 'monitoring' && generatedKey && !expectedKeys.has(generatedKey)) ||
          (!meta?.postedTransactionId && !expectedLegacyKeys.has(legacyKey) && !generatedKey)
        );
      if (staleGenerated) {
        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
          next = setWorksheetCellFast(next, `${col}${row}`, '');
        });
        if (next.rowsMeta?.[String(row)]) {
          const { [String(row)]: _staleMeta, ...rowsMeta } = next.rowsMeta;
          next = { ...next, rowsMeta };
        }
        continue;
      }
      const paymentCleared = !!meta?.paymentClearedAt;
      const preservedAmount = paymentCleared ? '' : amount;
      if (!postedMismatch && generatedKey) preserved.set(generatedKey, {
        row,
        amount: preservedAmount,
        method: preservedAmount ? cellRaw(sheet, 'F', row) : '',
        paidDate: preservedAmount ? paidDate : '',
      });
      if (!postedMismatch) preserved.set(legacyKey, {
        row,
        amount: preservedAmount,
        method: preservedAmount ? cellRaw(sheet, 'F', row) : '',
        paidDate: preservedAmount ? paidDate : '',
      });
    }
  }

  const usedRows = new Set<number>();
  const usedLegacyRows = new Map<string, number>();
  const pickEmptyRow = () => {
    for (let row = 2; row <= next.rowCount; row++) {
      if (!usedRows.has(row) && !unusableRows.has(row) && !rowHasData(next, row)) return row;
    }
    return next.rowCount + 1;
  };
  rows.forEach((dueRow, index) => {
    const key = rentalDueRowKey(dueRow);
    const legacyKey = legacyRentalDueKey(dueRow.date, dueRow.unit);
    const generatedExisting = preserved.get(key);
    const legacyExisting = preserved.get(legacyKey);
    const existing = generatedExisting || legacyExisting;
    const paymentSource = [existing, legacyExisting, generatedExisting]
      .find(item => parseSheetAmount(item?.amount || '') > 0.001) || existing;
    const row = existing?.row || pickEmptyRow();
    usedRows.add(row);
    usedLegacyRows.set(legacyKey, row);
    next = ensureRowCapacity(next, row);
    next = setWorksheetCellFast(next, `A${row}`, dueRow.date);
    next = setWorksheetCellFast(next, `B${row}`, dueRow.unit);
    next = setWorksheetCellFast(next, `C${row}`, normalizeAmlakTextValue(dueRow.details));
    next = setWorksheetCellFast(next, `D${row}`, String(dueRow.dueAmount));
    next = setWorksheetCellFast(next, `E${row}`, paymentSource?.amount || '');
    next = setWorksheetCellFast(next, `F${row}`, paymentSource?.method || '');
    next = setWorksheetCellFast(next, `G${row}`, paymentSource?.paidDate || '');
    next = {
      ...next,
      rowsMeta: {
        ...(next.rowsMeta || {}),
        [String(row)]: {
          ...(next.rowsMeta?.[String(row)] || {
            row,
            status: 'draft',
            enteredBy: 'system',
            enteredByName: 'Amlak',
            enteredAt: Date.now(),
          }),
          row,
          updatedAt: Date.now(),
          generatedDueSource: 'monitoring',
          generatedDueKey: key,
          generatedAt: Date.now(),
          paymentClearedAt: parseSheetAmount(paymentSource?.amount || '') > 0.001 ? undefined : next.rowsMeta?.[String(row)]?.paymentClearedAt,
        },
      },
    };
  });

  for (let row = 2; row <= next.rowCount; row++) {
    if (isSplitPaymentChildRow(next, row)) continue;
    const due = parseSheetAmount(cellRaw(next, 'D', row));
    const paid = parseSheetAmount(cellRaw(next, 'E', row));
    if (due > 0 && paid > 0 && paid < due) {
      const splitResult = autoEnsureSplitRow(next, row, currentUser);
      next = splitResult.sheet;
      if (splitResult.targetRow) usedRows.add(splitResult.targetRow);
    }
  }

  for (let row = 2; row <= next.rowCount; row++) {
    if (usedRows.has(row) || unusableRows.has(row)) continue;
    const meta = next.rowsMeta?.[String(row)] as any;
    if (postedRowMeta(meta)) continue;
    if (isSplitPaymentChildRow(next, row)) continue;
    const rowDue = parseSheetAmount(cellRaw(next, 'D', row));
    const legacyKey = legacyRentalDueKey(cellRaw(next, 'A', row), cellRaw(next, 'B', row));
    const keeperRow = usedLegacyRows.get(legacyKey);
    if (keeperRow && keeperRow !== row && expectedLegacyKeys.has(legacyKey)) {
      next = clearUnpostedRentalRow(next, row, {
        id: 'system',
        name: 'Amlak',
        role: UserRole.ADMIN,
      } as User);
      continue;
    }
    const amount = cellRaw(next, 'E', row);
    if (rowDue > 0 && !amount) {
      next = clearUnpostedRentalRow(next, row, {
        id: 'system',
        name: 'Amlak',
        role: UserRole.ADMIN,
      } as User);
    }
  }

  return next;
}

function sanitizeRentalDraftRows(sheet: AmlakWorksheet, currentUser: User): AmlakWorksheet {
  let next = sheet;
  for (let row = 2; row <= next.rowCount; row++) {
    const meta = next.rowsMeta?.[String(row)] as any;
    if (postedRowMeta(meta)) continue;
    const amount = cellRaw(next, 'E', row);
    const paidDate = cellRaw(next, 'G', row);
    if (!amount && paidDate) {
      next = setWorksheetCellFast(next, `G${row}`, '');
      next = setWorksheetRowMeta(next, row, currentUser, {
        status: 'draft',
        error: undefined,
      });
    }
  }
  return next;
}

function firstEmptyRow(sheet: AmlakWorksheet): number {
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (!rowHasData(sheet, row)) return row;
  }
  return sheet.rowCount + 1;
}

function firstUnreservedEmptyRow(sheet: AmlakWorksheet): number {
  for (let row = 2; row <= sheet.rowCount; row++) {
    const meta = sheet.rowsMeta?.[String(row)] as any;
    if (!rowHasData(sheet, row) && !meta?.manualAddedRow) return row;
  }
  return sheet.rowCount + 1;
}

function findExistingTransactionRow(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind): number {
  for (let row = 2; row <= sheet.rowCount; row++) {
    const meta = sheet.rowsMeta?.[String(row)];
    if (meta?.postedTransactionId === tx.id) return row;
    if (meta?.status === 'posted') continue;
    if (rowHasData(sheet, row) && transactionMatchesExistingRow(sheet, tx, kind, row)) return row;
  }
  return 0;
}

function importedTransactionRow(sheet: AmlakWorksheet, tx: Transaction): number {
  if (!tx.id) return 0;
  const entry = Object.entries(sheet.rowsMeta || {}).find(([, meta]) => meta?.postedTransactionId === tx.id);
  return Number(entry?.[0] || 0);
}

function ensureRowCapacity(sheet: AmlakWorksheet, row: number): AmlakWorksheet {
  const targetRowCount = Math.max(row, maxUsedSheetRow(sheet) + AUTO_EMPTY_ROW_BUFFER);
  return targetRowCount <= sheet.rowCount ? sheet : { ...sheet, rowCount: targetRowCount, updatedAt: Date.now() };
}

function setImportedRowMeta(sheet: AmlakWorksheet, row: number, tx: Transaction): AmlakWorksheet {
  return {
    ...sheet,
    rowsMeta: {
      ...(sheet.rowsMeta || {}),
      [String(row)]: {
        row,
        status: 'posted',
        enteredBy: tx.createdBy,
        enteredByName: tx.createdByName || 'Amlak',
        enteredAt: tx.createdAt || Date.now(),
        updatedAt: Date.now(),
        postedTransactionId: tx.id,
        postedAt: tx.createdAt || Date.now(),
        postedBy: tx.createdBy,
        postedByName: tx.createdByName || 'Amlak',
      },
    },
    updatedAt: Date.now(),
  };
}

function removePostedRowMeta(sheet: AmlakWorksheet, row: number): AmlakWorksheet {
  const previous = sheet.rowsMeta?.[String(row)];
  if (!previous) return sheet;
  const {
    postedTransactionId: _postedTransactionId,
    postedAt: _postedAt,
    postedBy: _postedBy,
    postedByName: _postedByName,
    ...rest
  } = previous;
  return {
    ...sheet,
    rowsMeta: {
      ...(sheet.rowsMeta || {}),
      [String(row)]: {
        ...rest,
        status: rest.status === 'posted' ? 'draft' : rest.status,
        updatedAt: Date.now(),
      },
    },
    updatedAt: Date.now(),
  };
}

function transactionSheetKind(tx: Transaction, building: Building): AmlakSheetKind | null {
  return transactionSheetKinds(tx, building)[0] || null;
}

function transactionSheetKinds(tx: Transaction, building: Building): AmlakSheetKind[] {
  return transactionSheetKindsForAmlak(tx, building);
}

function clearStalePostedTransactionRow(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): AmlakWorksheet {
  if (isRentalDueBoardKind(kind)) {
    let next = setWorksheetCellFast(sheet, `E${row}`, '');
    next = setWorksheetCellFast(next, `F${row}`, '');
    next = setWorksheetCellFast(next, `G${row}`, '');
    return removePostedRowMeta(next, row);
  }
  return clearManualDraftRow(sheet, kind, row);
}

function importTransactionIntoSheet(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind, accountBuildings: Building[]): AmlakWorksheet {
  const alreadyImportedRow = importedTransactionRow(sheet, tx);
  const row = alreadyImportedRow || findExistingTransactionRow(sheet, tx, kind) || firstEmptyRow(sheet);
  let next = ensureRowCapacity(sheet, row);
  const amount = String(tx.amountIncludingVAT || tx.totalWithVat || tx.amount || '');
  const text = (value: string | undefined) => normalizeAmlakTextValue(value || '');
  const method = transactionSheetPaymentMethod(tx);
  const detailsText = text(tx.details || (tx as any).purpose || '');
  const txBuildingName = buildingDisplayNameFromId(tx.buildingId, accountBuildings) || tx.buildingName || '';
  if (kind === 'rentalIncome') {
    const dueAmount = String(tx.expectedAmount || cellRaw(sheet, 'D', row) || tx.amountIncludingVAT || tx.totalWithVat || tx.amount || '');
    const dueDate = String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || cellRaw(sheet, 'A', row) || '');
    if (
      alreadyImportedRow &&
      cellRaw(sheet, 'A', row) === dueDate &&
      cellRaw(sheet, 'D', row) === dueAmount &&
      cellRaw(sheet, 'E', row) === amount &&
      cellRaw(sheet, 'F', row) === method &&
      cellRaw(sheet, 'G', row) === tx.date
    ) {
      return sheet;
    }
    next = setWorksheetCell(next, `A${row}`, dueDate);
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, text(tx.details));
    next = setWorksheetCell(next, `D${row}`, dueAmount);
    next = setWorksheetCell(next, `E${row}`, amount);
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
  } else if (kind === 'otherIncome') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || (isInterBuildingTreasuryTransaction(tx) ? INTER_BUILDING_TRANSFER_CATEGORY : 'Other Income')));
    next = setWorksheetCell(next, `C${row}`, detailsText || (isInterBuildingTreasuryTransaction(tx) ? text(INTER_BUILDING_TRANSFER_CATEGORY) : ''));
    next = setWorksheetCell(next, `D${row}`, method);
    next = setWorksheetCell(next, `E${row}`, amount);
  } else if (kind === 'expense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || (isInterBuildingTreasuryTransaction(tx) ? INTER_BUILDING_TRANSFER_CATEGORY : 'General Expense')));
    next = setWorksheetCell(next, `C${row}`, text(tx.employeeName || tx.vendorName || txBuildingName || tx.expenseSubCategory || ''));
    next = setWorksheetCell(next, `D${row}`, text(tx.salaryPeriod || ''));
    next = setWorksheetCell(next, `E${row}`, detailsText);
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `H${row}`, String(tx.extraAmount || ''));
  } else if (kind === 'ownerExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.ownerName));
    next = setWorksheetCell(next, `C${row}`, detailsText);
    next = setWorksheetCell(next, `D${row}`, method);
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
  } else if (kind === 'vatIncome') {
    next = setWorksheetCell(next, `A${row}`, String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || ''));
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, tx.customerVATNumber || '');
    next = setWorksheetCell(next, `D${row}`, detailsText);
    next = setWorksheetCell(next, `E${row}`, String(tx.expectedAmount || tx.amountIncludingVAT || tx.totalWithVat || tx.amount || ''));
    next = setWorksheetCell(next, `F${row}`, amount);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
    next = setWorksheetCell(next, `H${row}`, method);
  } else if (kind === 'vatExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || 'Vendor Payment'));
    next = setWorksheetCell(next, `C${row}`, text(tx.expenseSubCategory));
    next = setWorksheetCell(next, `D${row}`, text(tx.vendorName));
    next = setWorksheetCell(next, `E${row}`, tx.vendorVATNumber || '');
    next = setWorksheetCell(next, `F${row}`, tx.vendorRefNo || tx.vatInvoiceNumber || '');
    next = setWorksheetCell(next, `G${row}`, detailsText);
    next = setWorksheetCell(next, `H${row}`, method);
    next = setWorksheetCell(next, `I${row}`, amount);
  } else if (kind === 'fees') {
    next = setWorksheetCell(next, `A${row}`, String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || ''));
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, detailsText);
    next = setWorksheetCell(next, `D${row}`, String((tx as any).expectedAmount || tx.amount || ''));
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
    next = setWorksheetCell(next, `H${row}`, String(tx.discountAmount || ''));
  } else if (kind === 'treasury') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text((tx as any).fromType));
    next = setWorksheetCell(next, `C${row}`, text(transactionBuildingAccountLabel(tx, 'from', accountBuildings)));
    next = setWorksheetCell(next, `D${row}`, text((tx as any).toType));
    next = setWorksheetCell(next, `E${row}`, text(transactionBuildingAccountLabel(tx, 'to', accountBuildings)));
    next = setWorksheetCell(next, `F${row}`, text((tx as any).originalPaymentMethod || tx.paymentMethod || 'CASH'));
    next = setWorksheetCell(next, `G${row}`, text((tx as any).fromBankName || tx.bankName));
    next = setWorksheetCell(next, `H${row}`, text((tx as any).toBankName));
    next = setWorksheetCell(next, `I${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `J${row}`, text((tx as any).purpose || 'Treasury Transfer'));
    next = setWorksheetCell(next, `K${row}`, text(tx.details));
  }
  const existingMeta = sheet.rowsMeta?.[String(row)];
  if (
    rowDataSignature(next, row) === rowDataSignature(sheet, row) &&
    existingMeta?.status === 'posted' &&
    existingMeta?.postedTransactionId === tx.id
  ) {
    return sheet;
  }
  return setImportedRowMeta(next, row, tx);
}

function syncExistingTransactionsIntoWorkbook(workbook: AmlakWorkbook, building: Building, transactions: Transaction[], accountBuildings: Building[]): AmlakWorkbook {
  const today = dateToLocalStr(new Date());
  let changed = false;
  const sheets = workbook.sheets.map(sheet => ({ ...sheet }));
  const activeTransactions = transactions
    .filter((tx: any) => !tx.deleted && tx.status !== 'REJECTED' && itemMatchesSelectedBuilding(tx, building) && (!tx.date || tx.date <= today));
  const activeTransactionIds = new Set(
    activeTransactions
      .flatMap((tx: any) => [tx.id, tx.transferId])
      .filter(Boolean)
  );
  const activeTransactionKindsById = new Map(
    activeTransactions.map(tx => [tx.id, transactionSheetKinds(tx, building)] as const)
  );

  sheets.forEach((sheet, index) => {
    const kind = (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind || 'rentalIncome') as AmlakSheetKind;
    let next = sheet;
    Object.entries(sheet.rowsMeta || {}).forEach(([rowKey, meta]) => {
      if (!meta?.postedTransactionId) return;
      const activeKinds = activeTransactionKindsById.get(meta.postedTransactionId);
      if (!activeTransactionIds.has(meta.postedTransactionId) || (activeKinds && !activeKinds.includes(kind))) {
        next = clearStalePostedTransactionRow(next, kind, Number(rowKey));
      }
    });
    if (next !== sheet) {
      sheets[index] = next;
      changed = true;
    }
  });

  activeTransactions
    .forEach(tx => {
      transactionSheetKinds(tx, building).forEach(kind => {
        const index = sheets.findIndex(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === kind);
        if (index < 0) return;
        const before = sheets[index];
        const after = importTransactionIntoSheet(before, tx, kind, accountBuildings);
        if (after !== before) {
          sheets[index] = after;
          changed = true;
        }
      });
    });
  return changed ? { ...workbook, sheets, updatedAt: Date.now() } : workbook;
}

function exportBuildingWorkbook(workbook: AmlakWorkbook) {
  const wb = XLSX.utils.book_new();
  workbook.sheets.forEach(sheet => {
    const columns = sheetColumns((sheet.sheetKind || 'rentalIncome') as AmlakSheetKind).filter(c => c.col);
    const data = [
      columns.map(c => c.label),
      ...Array.from({ length: sheet.rowCount - 1 }, (_, idx) => {
        const row = idx + 2;
        return columns.map(col => cellRaw(sheet, col.col, row));
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), sheet.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${workbook.buildingName || workbook.name}.xlsx`);
}

const AmlakSheets: React.FC<Props> = ({ currentUser }) => {
  const { showSuccess, showError, showInfo } = useToast();
  const { activeBookId } = useBook();
  const viewportWidth = useViewportWidth();
  const compactSheetUi = viewportWidth < 900;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allBookBuildings, setAllBookBuildings] = useState<Building[]>([]);
  const [workbooks, setWorkbooks] = useState<AmlakWorkbook[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ownerStakeUsers, setOwnerStakeUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);
  const [customExpenseSubcategories, setCustomExpenseSubcategories] = useState<Record<string, string[]>>({});
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedSummaryBuildingIds, setSelectedSummaryBuildingIds] = useState<string[]>([]);
  const [activeKind, setActiveKind] = useState<AmlakSheetKind>('rentalIncome');
  const [activeMonth, setActiveMonth] = useState(currentMonthKey);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [presence, setPresence] = useState<Record<string, AmlakSheetPresenceUser>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; key: ColumnKind } | null>(null);
  const [attentionRow, setAttentionRow] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [sheetSearchTerm, setSheetSearchTerm] = useState('');
  const deferredSheetSearchTerm = useDeferredValue(sheetSearchTerm);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');
  const [sheetFocusMode, setSheetFocusMode] = useState(false);
  const [undoStack, setUndoStack] = useState<AmlakWorkbook[]>([]);
  const [redoStack, setRedoStack] = useState<AmlakWorkbook[]>([]);
  const [addRowsCount, setAddRowsCount] = useState(15);
  const [sheetRowMenu, setSheetRowMenu] = useState<{ row: number; x: number; y: number } | null>(null);
  const [buildingDropdownOpen, setBuildingDropdownOpen] = useState(false);
  const [gridScrollEdges, setGridScrollEdges] = useState({ canLeft: false, canRight: false });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(() => isAmlakSheetsInstalledMode());
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);
  const autosaveQueued = useRef(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const dirtyRef = useRef(false);
  const activeWorkbookRef = useRef<AmlakWorkbook | undefined>(undefined);
  const activeSheetIdRef = useRef<string | undefined>(undefined);
  const lastSelectedCellRef = useRef<{ row: number; key: ColumnKind } | null>(null);
  const undoStackRef = useRef<AmlakWorkbook[]>([]);
  const redoStackRef = useRef<AmlakWorkbook[]>([]);

  const isAdmin = isAdminUser(currentUser);
  const canSeeAllBuildings = isAdmin || isManagerUser(currentUser);
  const allowedBuildings = useMemo(() => {
    if (canSeeAllBuildings) return buildings;
    const assigned = new Set([...(currentUser.buildingIds || []), currentUser.buildingId].filter(Boolean));
    return buildings.filter(b => assigned.has(b.id));
  }, [buildings, canSeeAllBuildings, currentUser]);

  useEffect(() => {
    if (!allowedBuildings.length) return;
    if (selectedBuildingId && allowedBuildings.some(building => building.id === selectedBuildingId)) return;
    let stored = '';
    try {
      stored = localStorage.getItem(selectedBuildingStorageKey(activeBookId, currentUser.id)) || '';
    } catch { /* ignore unavailable storage */ }
    const nextId = allowedBuildings.find(building => building.id === stored)?.id || allowedBuildings[0]?.id || '';
    if (nextId) setSelectedBuildingId(nextId);
  }, [allowedBuildings, selectedBuildingId, activeBookId, currentUser.id]);

  const selectedBuilding = allowedBuildings.find(b => b.id === selectedBuildingId) || allowedBuildings[0];
  useEffect(() => {
    if (!allowedBuildings.length) return;
    const allowedIds = new Set(allowedBuildings.map(building => building.id));
    const current = selectedSummaryBuildingIds.filter(id => allowedIds.has(id));
    if (current.length) {
      if (current.length !== selectedSummaryBuildingIds.length) setSelectedSummaryBuildingIds(current);
      return;
    }
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(selectedSummaryBuildingsStorageKey(activeBookId, currentUser.id)) || '[]');
    } catch { /* ignore unavailable storage */ }
    const fromStored = Array.isArray(stored) ? stored.filter(id => allowedIds.has(String(id))).map(String) : [];
    setSelectedSummaryBuildingIds(fromStored.length ? fromStored : (selectedBuilding ? [selectedBuilding.id] : [allowedBuildings[0].id]));
  }, [allowedBuildings, selectedSummaryBuildingIds, activeBookId, currentUser.id, selectedBuilding?.id]);
  const selectedSummaryBuildings = useMemo(() => {
    const ids = new Set(selectedSummaryBuildingIds.length ? selectedSummaryBuildingIds : (selectedBuilding ? [selectedBuilding.id] : []));
    return allowedBuildings.filter(building => ids.has(building.id));
  }, [allowedBuildings, selectedSummaryBuildingIds, selectedBuilding?.id]);
  const summaryBuildingLabel = selectedSummaryBuildings.length === 1
    ? selectedSummaryBuildings[0].name
    : `${selectedSummaryBuildings.length || 0} buildings`;
  const selectedSummaryIdsSet = useMemo(() => new Set(selectedSummaryBuildingIds.length ? selectedSummaryBuildingIds : (selectedBuilding ? [selectedBuilding.id] : [])), [selectedSummaryBuildingIds, selectedBuilding?.id]);
  const buildingDropdownLabel = selectedSummaryBuildings.length > 1
    ? `${selectedSummaryBuildings.length} buildings selected`
    : selectedBuilding?.name || 'Select building';
  const activeWorkbook = workbookForBuilding(workbooks, selectedBuilding);
  const treasuryBuildings = useMemo(() => {
    const byId = new Map<string, Building>();
    [...buildings, ...allBookBuildings].forEach((building: any) => {
      const id = String(building?.id || '').trim();
      if (id && !byId.has(id)) byId.set(id, building as Building);
    });
    return Array.from(byId.values());
  }, [buildings, allBookBuildings]);
  const selectedBuildingContracts = useMemo(
    () => selectedBuilding ? contracts.filter((contract: any) => itemMatchesSelectedBuilding(contract, selectedBuilding) && !contract.deleted) : [],
    [contracts, selectedBuilding?.id],
  );
  const selectedBuildingAllContracts = useMemo(
    () => selectedBuilding ? contracts.filter((contract: any) => itemMatchesSelectedBuilding(contract, selectedBuilding)) : [],
    [contracts, selectedBuilding?.id],
  );
  const selectedBuildingTransactions = useMemo(
    () => selectedBuilding ? transactions.filter((tx: any) => itemMatchesSelectedBuilding(tx, selectedBuilding)) : [],
    [transactions, selectedBuilding?.id],
  );
  const isVatBuilding = !!selectedBuilding && (
    isNonResidentialBuildingForContract([selectedBuilding], { buildingId: selectedBuilding.id }) ||
    (selectedBuilding as any).vatApplicable === true
  );
  const visibleSheetTabs = useMemo(
    () => SHEET_TABS.filter(tab => isVatBuilding || !['vatIncome', 'vatExpense', 'fees'].includes(tab.kind)),
    [isVatBuilding],
  );
  const activeSheet = activeWorkbook?.sheets.find(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === activeKind) || activeWorkbook?.sheets[0];
  const deferredActiveSheet = useDeferredValue(activeSheet);
  const futureMonthLocked = isFutureMonth(activeMonth);
  const staffDeadlineLocked = !isAdmin && staffMonthEditClosed(activeMonth);
  const pastMonthReadOnly = activeMonth < currentMonthKey();
  const sheetLocked = futureMonthLocked || staffDeadlineLocked;
  const canPostRows = !!currentUser?.id;
  const owners = useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    const addOwner = (id: any, name: any) => {
      const cleanName = normalizeAmlakTextValue(String(name || ''));
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      if (!byName.has(key)) byName.set(key, { id: String(id || key), name: cleanName });
    };
    ownerStakeUsers
      .filter((u: any) => {
        const stakeIds = Array.isArray(u.ownerBuildingIds) ? u.ownerBuildingIds.filter(Boolean) : [];
        return stakeIds.length > 0 && (u.isOwner || String(u.role).toUpperCase() === 'OWNER');
      })
      .forEach((u: any) => addOwner(u.id, u.name || u.email || u.ownerName));
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ownerStakeUsers]);
  const postingUsers = useMemo(() => {
    const byId = new Map<string, User>();
    [...users, ...ownerStakeUsers].forEach((user: any) => {
      if (user?.id && !byId.has(String(user.id))) byId.set(String(user.id), user as User);
    });
    return Array.from(byId.values());
  }, [users, ownerStakeUsers]);
  const sharedUsers = useMemo(() => {
    if (!selectedBuilding) return [];
    return users.filter((u: any) => {
      if (isAdminUser(u) || isManagerUser(u)) return true;
      const ids = new Set([...(u.buildingIds || []), u.buildingId].filter(Boolean));
      return ids.has(selectedBuilding.id);
    });
  }, [users, selectedBuilding]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    activeWorkbookRef.current = activeWorkbook;
  }, [activeWorkbook]);

  useEffect(() => {
    activeSheetIdRef.current = activeSheet?.id;
  }, [activeSheet?.id]);

  useEffect(() => {
    if (compactSheetUi && activeCell) setActiveCell(null);
  }, [compactSheetUi, activeCell]);

  useEffect(() => {
    if (compactSheetUi && selectedCells.size) {
      setSelectedCells(new Set());
      lastSelectedCellRef.current = null;
    }
  }, [compactSheetUi, selectedCells.size]);

  useEffect(() => {
    if (!sheetRowMenu) return;
    const close = () => setSheetRowMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetRowMenu]);

  useEffect(() => {
    if (!buildingDropdownOpen) return;
    const close = () => setBuildingDropdownOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [buildingDropdownOpen]);

  useEffect(() => {
    const previousTitle = document.title;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.content;
    document.title = 'Amlak Sheets';
    if (themeMeta) themeMeta.content = '#047857';

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isAmlakSheetsInstalledMode()) {
        setInstallPrompt(null);
        setIsInstalledApp(true);
        return;
      }
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalledApp(true);
      showSuccess('Amlak Sheets installed');
    };
    const displayModeQueries = [
      window.matchMedia?.('(display-mode: standalone)'),
      window.matchMedia?.('(display-mode: window-controls-overlay)'),
      window.matchMedia?.('(display-mode: fullscreen)'),
    ].filter(Boolean) as MediaQueryList[];
    const onDisplayModeChange = () => {
      const installed = isAmlakSheetsInstalledMode();
      setIsInstalledApp(installed);
      if (installed) setInstallPrompt(null);
    };
    onDisplayModeChange();

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    displayModeQueries.forEach(media => media.addEventListener?.('change', onDisplayModeChange));

    return () => {
      document.title = previousTitle;
      if (themeMeta && previousTheme) themeMeta.content = previousTheme;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayModeQueries.forEach(media => media.removeEventListener?.('change', onDisplayModeChange));
    };
  }, [showSuccess]);

  useEffect(() => {
    if (!visibleSheetTabs.some(tab => tab.kind === activeKind)) {
      setActiveKind('rentalIncome');
      setSelectedRows(new Set());
      setActiveCell(null);
    }
  }, [activeKind, visibleSheetTabs]);

  useEffect(() => {
    setSelectedRows(new Set());
    setActiveCell(null);
    setSelectedCells(new Set());
    lastSelectedCellRef.current = null;
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTo({ top: 0, left: 0 });
    }
  }, [selectedBuilding?.id, activeKind, activeMonth]);

  const postingResults = useMemo(() => {
    if (!deferredActiveSheet) return [];
    const postingBuildings = activeKind === 'treasury' ? treasuryBuildings : buildings;
    return validateWorksheetPostingRows(deferredActiveSheet, { currentUser, buildings: postingBuildings, contracts: selectedBuildingContracts, users: postingUsers, existingTransactions: selectedBuildingTransactions });
  }, [deferredActiveSheet, currentUser, activeKind, buildings, treasuryBuildings, selectedBuildingContracts, postingUsers, selectedBuildingTransactions]);
  const postingByRow = useMemo(() => new Map(postingResults.map(r => [r.row, r])), [postingResults]);
  useEffect(() => {
    const current = currentMonthKey();
    if (activeMonth < AMLAK_FIRST_MONTH || activeMonth > current) {
      setActiveMonth(current < AMLAK_FIRST_MONTH ? AMLAK_FIRST_MONTH : current);
    }
  }, [activeMonth]);

  const monthTabs = useMemo(() => {
    const fromRows = new Set<string>();
    if (activeSheet) {
      Object.values(activeSheet.cells || {}).forEach(cell => {
        const row = Number(cell.address.match(/\d+$/)?.[0] || 0);
        if (row > 1) {
          const key = rowDisplayMonthKey(activeSheet, activeKind, row);
          if (key >= AMLAK_FIRST_MONTH && key <= currentMonthKey()) fromRows.add(key);
        }
      });
    }
    return Array.from(new Set([...monthsBetween(AMLAK_FIRST_MONTH, currentMonthKey()), ...fromRows])).sort();
  }, [activeSheet, activeKind]);

  const expenseCategoryFilterOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (value: unknown) => {
      const label = String(value || '').trim();
      const key = normRowKey(label);
      if (key && !byKey.has(key)) byKey.set(key, label);
    };
    mergeExpenseCategories(customExpenseCategories).forEach(add);
    if (activeSheet && activeKind === 'expense') {
      Object.values(activeSheet.cells || {}).forEach(cell => {
        const address = String(cell.address || '');
        const match = address.match(/^B(\d+)$/i);
        if (!match || Number(match[1]) <= 1) return;
        add(cell.value ?? cell.raw ?? cell.formula);
      });
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [activeSheet, activeKind, customExpenseCategories]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, allB, wb, c, tx, u, ownerUsers, cust, v, bankRows, expenseCats, incomeCats] = await Promise.all([
          getBuildings(),
          getBuildingsAllBooks().catch(() => []),
          getAmlakWorkbooks(),
          getContracts({ includeDeleted: true }),
          getTransactions(),
          getUsers(),
          getUsersAcrossBooks({ includeDeleted: true }).catch(() => []),
          getCustomers(),
          getVendors(),
          getBanks().catch(() => []),
          getCustomExpenseCategories().catch(() => []),
          getCustomIncomeCategories().catch(() => []),
        ]);
        setBuildings(b || []);
        setAllBookBuildings((allB && allB.length ? allB : b) || []);
        setContracts(c || []);
        setTransactions(tx || []);
        setUsers(u || []);
        setOwnerStakeUsers(((ownerUsers || []) as User[]).filter((user: any) => !user?.deleted));
        setCustomers(cust || []);
        setVendors((v || []).filter((vendor: any) => vendor?.status !== 'Inactive'));
        setBanks((bankRows || []).filter((bank: any) => bank?.name));
        setCustomExpenseCategories(Array.isArray(expenseCats) ? expenseCats : []);
        setCustomIncomeCategories(Array.isArray(incomeCats) ? incomeCats : []);
        setCustomExpenseSubcategories(readLocalExpenseSubcategories());
        const loadedWorkbooks = ((wb || []) as AmlakWorkbook[]).map(workbook => ensureWorkbookTrailingEmptyRows(compactAmlakWorkbook(workbook)));
        setWorkbooks(loadedWorkbooks);
        const allowed = canSeeAllBuildings
          ? (b || [])
          : (b || []).filter((building: Building) => new Set([...(currentUser.buildingIds || []), currentUser.buildingId].filter(Boolean)).has(building.id));
        let storedBuildingId = '';
        try {
          storedBuildingId = localStorage.getItem(selectedBuildingStorageKey(activeBookId, currentUser.id)) || '';
        } catch { /* ignore unavailable storage */ }
        setSelectedBuildingId(allowed.find((building: Building) => building.id === storedBuildingId)?.id || allowed[0]?.id || '');
      } catch (error: any) {
        showError(error?.message || 'Failed to load building sheets');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, canSeeAllBuildings, activeBookId, showError]);

  useEffect(() => {
    const unsub = listenAmlakWorkbooks((rows) => {
      const incoming = ((rows || []) as AmlakWorkbook[]).map(workbook => ensureWorkbookTrailingEmptyRows(compactAmlakWorkbook(workbook)));
      setWorkbooks(prev => {
        const byId = new Map(prev.map(workbook => [workbook.id, workbook]));
        incoming.forEach(remote => {
          const local = byId.get(remote.id);
          const isActiveDirty = dirtyRef.current && activeWorkbookRef.current?.id === remote.id;
          if (isActiveDirty && local) {
            const activeSheetId = activeSheetIdRef.current;
            byId.set(remote.id, {
              ...remote,
              sheets: remote.sheets.map(remoteSheet => (
                remoteSheet.id === activeSheetId
                  ? local.sheets.find(sheet => sheet.id === activeSheetId) || remoteSheet
                  : remoteSheet
              )),
              updatedAt: Math.max(Number(remote.updatedAt || 0), Number(local.updatedAt || 0)),
            });
            return;
          }
          if (!local || Number(remote.updatedAt || 0) >= Number(local.updatedAt || 0)) {
            byId.set(remote.id, remote);
          }
        });
        return Array.from(byId.values()).filter(workbook => !workbook.deleted);
      });
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!selectedBuilding || loading) return;
    const existing = workbookForBuilding(workbooks, selectedBuilding);
    if (existing) {
      const normalized = ensureBuildingWorkbookSheets(existing, selectedBuilding);
      if (JSON.stringify(normalized.sheets.map(s => `${s.id}:${s.sheetKind}:${s.colCount}`)) !== JSON.stringify(existing.sheets.map(s => `${s.id}:${s.sheetKind}:${s.colCount}`))) {
        setWorkbooks(prev => prev.map(w => w.id === existing.id ? normalized : w));
        setDirty(true);
      }
      return;
    }
    const created = ensureWorkbookTrailingEmptyRows(createBuildingAmlakSheetsWorkbook(currentUser, selectedBuilding));
    setWorkbooks(prev => [created, ...prev]);
    setDirty(true);
  }, [selectedBuilding, loading, workbooks, currentUser]);

  useEffect(() => {
    if (!selectedBuilding || !activeWorkbook) return;

    let nextWorkbook = activeWorkbook;
    let changed = false;

    const rentalSheet = nextWorkbook.sheets.find(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === 'rentalIncome');
    if (rentalSheet) {
      const syncedBase = selectedBuildingAllContracts.length
        ? syncRentalDueRows(rentalSheet, selectedBuilding, selectedBuildingAllContracts, selectedBuildingTransactions, activeMonth, currentUser)
        : rentalSheet;
      const synced = sanitizeRentalDraftRows(syncedBase, currentUser);
      if (rentalSyncSignature(synced) !== rentalSyncSignature(rentalSheet)) {
        nextWorkbook = {
          ...nextWorkbook,
          sheets: nextWorkbook.sheets.map(sheet => sheet.id === rentalSheet.id ? synced : sheet),
          updatedAt: Date.now(),
        };
        changed = true;
      }
    }

    const feesSheet = nextWorkbook.sheets.find(sheet => sheet.sheetKind === 'fees');
    if (feesSheet) {
      const synced = selectedBuildingAllContracts.length
        ? syncFeeDueRows(feesSheet, selectedBuilding, selectedBuildingAllContracts, selectedBuildingTransactions, activeMonth)
        : feesSheet;
      if (rentalSyncSignature(synced) !== rentalSyncSignature(feesSheet)) {
        nextWorkbook = {
          ...nextWorkbook,
          sheets: nextWorkbook.sheets.map(sheet => sheet.id === feesSheet.id ? synced : sheet),
          updatedAt: Date.now(),
        };
        changed = true;
      }
    }

    const vatIncomeSheet = nextWorkbook.sheets.find(sheet => sheet.sheetKind === 'vatIncome');
    if (vatIncomeSheet) {
      const synced = selectedBuildingAllContracts.length
        ? syncVatRentalDueRows(vatIncomeSheet, selectedBuilding, selectedBuildingAllContracts, selectedBuildingTransactions, activeMonth, customers)
        : vatIncomeSheet;
      if (rentalSyncSignature(synced) !== rentalSyncSignature(vatIncomeSheet)) {
        nextWorkbook = {
          ...nextWorkbook,
          sheets: nextWorkbook.sheets.map(sheet => sheet.id === vatIncomeSheet.id ? synced : sheet),
          updatedAt: Date.now(),
        };
        changed = true;
      }
    }

    const imported = syncExistingTransactionsIntoWorkbook(nextWorkbook, selectedBuilding, selectedBuildingTransactions, treasuryBuildings);
    if (imported !== nextWorkbook) {
      nextWorkbook = imported;
      changed = true;
    }

    if (changed) updateWorkbook(nextWorkbook);
  }, [selectedBuilding?.id, activeWorkbook?.id, activeMonth, currentUser, selectedBuildingAllContracts, selectedBuildingTransactions, treasuryBuildings, customers]);

  useEffect(() => {
    if (!selectedBuilding || !activeWorkbook) return;
    void setAmlakSheetPresence(selectedBuilding.id, currentUser, activeKind, true);
    const unsub = listenAmlakSheetPresence(selectedBuilding.id, setPresence);
    const heartbeat = window.setInterval(() => {
      void setAmlakSheetPresence(selectedBuilding.id, currentUser, activeKind, true);
    }, 25000);
    return () => {
      window.clearInterval(heartbeat);
      void setAmlakSheetPresence(selectedBuilding.id, currentUser, activeKind, false);
      unsub?.();
    };
  }, [selectedBuilding?.id, activeWorkbook?.id, activeKind, currentUser]);

  useEffect(() => {
    if (!dirty || !activeWorkbook) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void saveWorkbook(true);
    }, 0);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [dirty, activeWorkbook]);

  const pushUndoSnapshot = (workbook: AmlakWorkbook) => {
    const snapshot = cloneWorkbookSnapshot(workbook);
    setUndoStack(previous => {
      const next = [...previous, snapshot].slice(-HISTORY_LIMIT);
      undoStackRef.current = next;
      return next;
    });
    setRedoStack([]);
    redoStackRef.current = [];
  };

  const restoreWorkbookSnapshot = (snapshot: AmlakWorkbook) => {
    const restored = {
      ...cloneWorkbookSnapshot(snapshot),
      updatedAt: Date.now(),
    };
    activeWorkbookRef.current = restored;
    dirtyRef.current = true;
    setWorkbooks(prev => prev.map(w => w.id === restored.id ? restored : w));
    setDirty(true);
    setSelectedRows(new Set());
    setSelectedCells(new Set());
    setSheetRowMenu(null);
    lastSelectedCellRef.current = null;
  };

  const undoSheetChange = () => {
    const current = activeWorkbookRef.current?.id === activeWorkbook?.id ? activeWorkbookRef.current : activeWorkbook;
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!current || !previous) return;
    setUndoStack(stack => {
      const next = stack.slice(0, -1);
      undoStackRef.current = next;
      return next;
    });
    setRedoStack(stack => {
      const next = [...stack, cloneWorkbookSnapshot(current)].slice(-HISTORY_LIMIT);
      redoStackRef.current = next;
      return next;
    });
    restoreWorkbookSnapshot(previous);
    showInfo('Undid last sheet change');
  };

  const redoSheetChange = () => {
    const current = activeWorkbookRef.current?.id === activeWorkbook?.id ? activeWorkbookRef.current : activeWorkbook;
    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1];
    if (!current || !nextSnapshot) return;
    setRedoStack(stack => {
      const next = stack.slice(0, -1);
      redoStackRef.current = next;
      return next;
    });
    setUndoStack(stack => {
      const next = [...stack, cloneWorkbookSnapshot(current)].slice(-HISTORY_LIMIT);
      undoStackRef.current = next;
      return next;
    });
    restoreWorkbookSnapshot(nextSnapshot);
    showInfo('Redid sheet change');
  };

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [activeWorkbook?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      const editingText = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey || event.altKey || editingText) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoSheetChange();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redoSheetChange();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeWorkbook?.id, showInfo]);

  const updateWorkbook = (next: AmlakWorkbook, options?: { trackHistory?: boolean }) => {
    next = ensureWorkbookTrailingEmptyRows(next);
    const previous = activeWorkbookRef.current?.id === next.id ? activeWorkbookRef.current : activeWorkbook;
    if (options?.trackHistory && previous?.id === next.id && previous !== next) {
      pushUndoSnapshot(previous);
    }
    if (activeWorkbookRef.current?.id === next.id) activeWorkbookRef.current = next;
    dirtyRef.current = true;
    setWorkbooks(prev => prev.map(w => w.id === next.id ? next : w));
    setDirty(true);
  };

  const updateSheet = (nextSheet: AmlakWorksheet) => {
    const workbook = activeWorkbookRef.current?.id === activeWorkbook?.id ? activeWorkbookRef.current : activeWorkbook;
    if (!workbook) return;
    const nextWorkbook = {
      ...workbook,
      sheets: workbook.sheets.map(sheet => sheet.id === nextSheet.id ? ensureTrailingEmptyRows(nextSheet) : sheet),
      updatedAt: Date.now(),
    };
    activeWorkbookRef.current = nextWorkbook;
    updateWorkbook(nextWorkbook, { trackHistory: true });
  };

  const manualSheetEmptyRowLimit = (sheet: AmlakWorksheet | undefined) => Math.max(0, Number(sheet?.visibleEmptyRowLimit ?? AUTO_EMPTY_ROW_BUFFER) || 0);

  const removeManualSheetRow = (row: number) => {
    if (!activeSheet || !supportsManualRows(activeKind)) return;
    const meta = activeSheet.rowsMeta?.[String(row)];
    if (activeKind === 'fees' && (meta as any)?.generatedDueSource === 'fees-monitoring') {
      showInfo('Auto fee due rows cannot be removed.');
      setSheetRowMenu(null);
      return;
    }
    const posted = meta?.status === 'posted' ||
      !!meta?.postedTransactionId;
    if (posted) {
      showInfo('Posted rows cannot be removed.');
      setSheetRowMenu(null);
      return;
    }

    const hasData = rowHasData(activeSheet, row);
    if (hasData) {
      updateSheet(deleteWorksheetRow(activeSheet, row));
      showSuccess('Row removed');
    } else {
      const hasManualMeta = !!(activeSheet.rowsMeta?.[String(row)] as any)?.manualAddedRow;
      if (hasManualMeta) {
        const next = deleteWorksheetRow(activeSheet, row);
        updateSheet({
          ...next,
          visibleEmptyRowLimit: Math.max(0, manualSheetEmptyRowLimit(activeSheet) - 1),
          updatedAt: Date.now(),
        });
        showSuccess('Row removed');
        setSheetRowMenu(null);
        return;
      }
      const currentLimit = manualSheetEmptyRowLimit(activeSheet);
      if (currentLimit <= 0) {
        showInfo('No extra rows to reduce.');
        setSheetRowMenu(null);
        return;
      }
      const next = deleteWorksheetRow(activeSheet, row);
      updateSheet({
        ...next,
        visibleEmptyRowLimit: Math.max(0, currentLimit - 1),
        updatedAt: Date.now(),
      });
      showSuccess('Row removed');
    }
    setSheetRowMenu(null);
  };

  const saveWorkbook = async (silent = false) => {
    if (silent && autosaveInFlight.current) {
      autosaveQueued.current = true;
      return;
    }
    const workbookToSave = activeWorkbookRef.current?.id === activeWorkbook?.id
      ? activeWorkbookRef.current
      : activeWorkbook;
    if (!workbookToSave) return;
    const savedUpdatedAt = Number(workbookToSave.updatedAt || 0);
    let savedOk = false;
    if (silent) autosaveInFlight.current = true;
    if (!silent) setSaving(true);
    try {
      await saveAmlakWorkbook(compactAmlakWorkbook(workbookToSave));
      savedOk = true;
      const latest = activeWorkbookRef.current?.id === workbookToSave.id ? activeWorkbookRef.current : undefined;
      const latestUpdatedAt = Number(latest?.updatedAt || 0);
      if (!latest || latestUpdatedAt <= savedUpdatedAt) {
        dirtyRef.current = false;
        setDirty(false);
      }
      if (!silent) showSuccess('Building sheet saved');
    } catch (error: any) {
      showError(error?.message || 'Save failed');
    } finally {
      if (silent) {
        autosaveInFlight.current = false;
        if (savedOk && (autosaveQueued.current || dirtyRef.current)) {
          autosaveQueued.current = false;
          if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
          autosaveTimer.current = window.setTimeout(() => {
            void saveWorkbook(true);
          }, 0);
        } else if (!savedOk) {
          autosaveQueued.current = false;
        }
      }
      if (!silent) setSaving(false);
    }
  };

  const installAmlakSheets = async () => {
    if (isInstalledApp) {
      showInfo('Amlak Sheets is already installed on this device.');
      return;
    }
    if (!installPrompt) {
      showInfo('Use your browser menu to install Amlak Sheets on Android or Windows.');
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      showSuccess('Installing Amlak Sheets');
    } else {
      showInfo('Install cancelled');
    }
  };

  const scrollSheetSideways = (direction: -1 | 1) => {
    const target = gridScrollRef.current;
    if (!target) return;
    const distance = Math.max(260, Math.round(target.clientWidth * 0.92));
    target.scrollBy({ left: distance * direction, behavior: 'smooth' });
    window.setTimeout(() => setGridScrollEdges(horizontalScrollEdges(target)), 260);
  };

  const showRentalRow = (sheet: AmlakWorksheet, row: number, key: ColumnKind = 'amount') => {
    const rowMonth = rowDisplayMonthKey(sheet, activeKind, row);
    const targetMonth = rowMonth && rowMonth < currentMonthKey() ? currentMonthKey() : rowMonth || activeMonth;
    setActiveMonth(targetMonth);
    setSheetSearchTerm('');
    setSelectedRows(new Set());
    setAttentionRow(row);
    if (!compactSheetUi) setActiveCell({ row, key });
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${row}-${key}"]`);
      target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    }, 140);
    window.setTimeout(() => {
      setAttentionRow(current => current === row ? null : current);
    }, 3800);
  };

  const blockEarlierInstallmentIfNeeded = (sheet: AmlakWorksheet, row: number, amount: number): boolean => {
    return false;
  };

  const blockAlreadyPaidUnitIfNeeded = (sheet: AmlakWorksheet, row: number, unitValue: string): boolean => {
    if (!unitValue || !isRentalDueBoardKind(activeKind)) return false;
    const dueDate = cellRaw(sheet, 'A', row) || `${activeMonth}-01`;
    const match = findAlreadyPaidRentalRow(sheet, row, unitValue, dueDate);
    if (!match) return false;
    showError(alreadyPaidRentalMessage(match));
    showRentalRow(sheet, match.row);
    return true;
  };

  const rowIsPostedForSheet = (sheet: AmlakWorksheet, row: number): boolean => {
    const meta = sheet.rowsMeta?.[String(row)];
    return meta?.status === 'posted' ||
      !!meta?.postedTransactionId;
  };

  const staffCanEditRentalCell = (sheet: AmlakWorksheet, row: number, column: SheetColumn): boolean => {
    if (['amount', 'paymentMethod', 'paidDate'].includes(column.key)) return true;
    if (column.key === 'unit') return !rowHasData(sheet, row);
    return false;
  };

  const cellLockedForUser = (sheet: AmlakWorksheet, row: number, column: SheetColumn): boolean => {
    if (sheetLocked) return true;
    const meta = sheet.rowsMeta?.[String(row)] as any;
    if (
      activeKind === 'fees' &&
      meta?.generatedDueSource === 'fees-monitoring' &&
      ['dueDate', 'unit', 'details', 'dueAmount'].includes(column.key)
    ) {
      return true;
    }
    if (isRentalDueBoardKind(activeKind) && column.key === 'unit' && rowHasData(sheet, row)) return true;
    return !isAdmin && isRentalDueBoardKind(activeKind) && !staffCanEditRentalCell(sheet, row, column);
  };

  const cellIsEditableForSheet = (sheet: AmlakWorksheet, row: number, column: SheetColumn): boolean => {
    return isSheetCellEditable(activeKind, column, rowIsPostedForSheet(sheet, row), cellLockedForUser(sheet, row, column));
  };

  const selectSheetCell = (row: number, key: ColumnKind, event?: React.MouseEvent<HTMLElement>) => {
    if (!activeSheet || compactSheetUi) return;
    const columns = sheetColumns(activeKind);
    const column = columns.find(item => item.key === key);
    if (!column || !cellIsEditableForSheet(activeSheet, row, column)) {
      setSelectedCells(new Set());
      lastSelectedCellRef.current = null;
      return;
    }

    const selectedKey = cellSelectionKey(row, key);
    if (event?.shiftKey && lastSelectedCellRef.current) {
      const anchor = lastSelectedCellRef.current;
      const anchorCol = columns.findIndex(item => item.key === anchor.key);
      const targetCol = columns.findIndex(item => item.key === key);
      const anchorRowIndex = visibleRows.indexOf(anchor.row);
      const targetRowIndex = visibleRows.indexOf(row);
      if (anchorCol >= 0 && targetCol >= 0 && anchorRowIndex >= 0 && targetRowIndex >= 0) {
        const [fromCol, toCol] = [Math.min(anchorCol, targetCol), Math.max(anchorCol, targetCol)];
        const [fromRow, toRow] = [Math.min(anchorRowIndex, targetRowIndex), Math.max(anchorRowIndex, targetRowIndex)];
        const next = new Set<string>();
        for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex++) {
          const rangeRow = visibleRows[rowIndex];
          for (let colIndex = fromCol; colIndex <= toCol; colIndex++) {
            const rangeColumn = columns[colIndex];
            if (rangeColumn && cellIsEditableForSheet(activeSheet, rangeRow, rangeColumn)) {
              next.add(cellSelectionKey(rangeRow, rangeColumn.key));
            }
          }
        }
        setSelectedCells(next);
        return;
      }
    }

    if (event?.metaKey || event?.ctrlKey) {
      setSelectedCells(previous => {
        const next = new Set(previous);
        next.has(selectedKey) ? next.delete(selectedKey) : next.add(selectedKey);
        return next;
      });
    } else {
      setSelectedCells(new Set([selectedKey]));
    }
    lastSelectedCellRef.current = { row, key };
  };

  const clearSelectedCells = () => {
    if (!activeSheet || sheetLocked || selectedCells.size === 0) return;
    const latestWorkbook = activeWorkbookRef.current;
    const latestSheet = latestWorkbook?.sheets.find(sheet => sheet.id === activeSheet.id) || activeSheet;
    let next = latestSheet;
    let cleared = 0;

    for (const selectedKey of selectedCells) {
      const parsed = parseCellSelectionKey(selectedKey);
      if (!parsed) continue;
      const column = sheetColumns(activeKind).find(item => item.key === parsed.key);
      if (!column?.col || !cellIsEditableForSheet(next, parsed.row, column)) continue;
      if (!cellRaw(next, column.col, parsed.row)) continue;
      if (isRentalDueBoardKind(activeKind) && column.col === 'B') {
        next = clearRentalUnitRow(next, parsed.row, currentUser);
        cleared++;
        continue;
      }
      if (isRentalDueBoardKind(activeKind) && column.key === 'amount') {
        next = clearRentalPaymentFields(next, parsed.row, currentUser);
        cleared++;
        continue;
      }
      if (activeKind === 'fees' && column.key === 'amount') {
        next = setWorksheetCellFast(next, `${column.col}${parsed.row}`, '0');
        next = deleteSplitChildRows(next, parsed.row);
        next = setWorksheetRowMeta(next, parsed.row, currentUser, {
          status: 'draft',
          error: undefined,
          enteredBy: currentUser.id,
          enteredByName: currentUser.name,
        });
        cleared++;
        continue;
      }
      next = setWorksheetCellFast(next, `${column.col}${parsed.row}`, '');
      next = setWorksheetRowMeta(next, parsed.row, currentUser, {
        status: 'draft',
        error: undefined,
        enteredBy: currentUser.id,
        enteredByName: currentUser.name,
      });
      if (isSplitBalanceBoardKind(activeKind) && ['A', 'B', 'C', 'D', 'E'].includes(column.col)) {
        next = syncSplitChildRows(next, parsed.row, currentUser, activeKind);
      }
      cleared++;
    }

    if (!cleared) {
      showInfo('No editable selected cells to clear.');
      return;
    }
    updateSheet(next);
    showSuccess(`Cleared ${cleared} editable cell(s)`);
  };

  const addBlankRows = () => {
    if (!activeSheet) return;
    if (sheetLocked || pastMonthReadOnly) {
      showInfo(
        pastMonthReadOnly
          ? 'Past month sheets show posted rows only.'
          : futureMonthLocked
            ? 'Future month sheets are locked for everyone.'
            : 'Staff editing for this month is closed after the 10th of the next month.'
      );
      return;
    }
    const count = clampNumber(Number(addRowsCount) || 15, 1, 15);
    let next = activeSheet;
    const createdRows: number[] = [];
    for (let index = 0; index < count; index++) {
      const row = firstUnreservedEmptyRow(next);
      next = ensureRowCapacity(next, row);
      next = setWorksheetRowMeta(next, row, currentUser, {
        status: 'draft',
        enteredBy: currentUser.id,
        enteredByName: currentUser.name,
        manualAddedRow: true,
      });
      createdRows.push(row);
    }
    const firstNewRow = createdRows[0] || firstUnreservedEmptyRow(activeSheet);
    const focusKey = isRentalDueBoardKind(activeKind) ? 'unit' : (sheetColumns(activeKind)[0]?.key || 'date');
    updateSheet(next);
    setActiveCell({ row: firstNewRow, key: focusKey });
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${firstNewRow}-${focusKey}"]`);
      if (target) {
        target.focus();
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      } else {
        gridScrollRef.current?.scrollTo({ top: gridScrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 80);
    showSuccess(`Added ${count} row(s)`);
  };

  const applyExpenseSmartAutofill = (sheet: AmlakWorksheet, row: number): AmlakWorksheet => {
    if (activeKind !== 'expense') return sheet;
    const category = cellRaw(sheet, 'B', row);
    const target = cellRaw(sheet, 'C', row);
    const rowDate = cellRaw(sheet, 'A', row) || `${activeMonth}-01`;
    const categoryKey = normRowKey(category);
    let next = sheet;

    if (categoryKey === normRowKey(ExpenseCategory.SALARY) || categoryKey === 'salary') {
      const existingPeriod = cellRaw(next, 'D', row);
      const salary = salarySheetAutofill({
        users,
        transactions,
        target,
        period: existingPeriod || undefined,
        rowDate,
      });
      if (salary) {
        next = setWorksheetCellFast(next, `D${row}`, salary.period);
        next = setWorksheetCellFast(next, `E${row}`, normalizeAmlakTextValue(salary.details));
        next = setWorksheetCellFast(next, `G${row}`, salary.amount > 0 ? moneyRaw(salary.amount) : '0');
        if (!cellRaw(next, 'F', row)) next = setWorksheetCellFast(next, `F${row}`, 'BANK');
      }
      return next;
    }

    if (categoryKey === normRowKey(ExpenseCategory.PROPERTY_RENT) || categoryKey === 'property rent') {
      const rent = propertyRentSheetAutofill(buildings, transactions, target);
      if (rent) {
        next = setWorksheetCellFast(next, `D${row}`, '');
        next = setWorksheetCellFast(next, `E${row}`, normalizeAmlakTextValue(rent.details));
        next = setWorksheetCellFast(next, `G${row}`, rent.amount > 0 ? moneyRaw(rent.amount) : '0');
        if (!cellRaw(next, 'F', row)) next = setWorksheetCellFast(next, `F${row}`, 'BANK');
      }
    }

    return next;
  };

  const addVendorFromSheet = async (name: string, vatNumber = '') => {
    const vendorName = normalizeAmlakTextValue(name).trim();
    if (!vendorName) throw new Error('Vendor name is required.');
    const existing = findVendorByValue(vendors, vendorName);
    if (existing) {
      const merged = vatNumber.trim()
        ? { ...existing, vatNumber: vatNumber.trim(), vatNo: vatNumber.trim(), status: 'Active' }
        : { ...existing, status: 'Active' };
      await saveVendor(merged);
      setVendors(previous => mergeVendorOptions([...previous.filter((vendor: any) => vendorOptionValue(vendor) !== vendorOptionValue(existing)), merged]));
      showSuccess('Vendor updated.');
      return merged;
    }

    const vendor = {
      id: crypto.randomUUID(),
      name: vendorName,
      nameEn: vendorName,
      serviceType: 'General',
      phone: '',
      vatNumber: vatNumber.trim(),
      vatNo: vatNumber.trim(),
      status: 'Active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveVendor(vendor);
    setVendors(previous => mergeVendorOptions([...previous, vendor]));
    showSuccess('Vendor added.');
    return vendor;
  };

  const deleteVendorFromSheet = async (vendorId: string) => {
    const vendor = findVendorByValue(vendors, vendorId);
    if (!vendor?.id) throw new Error('Select a saved vendor first.');
    await deleteVendorsFromSheet([vendor.id]);
  };

  const deleteVendorsFromSheet = async (vendorIds: string[]) => {
    const ids = Array.from(new Set(vendorIds.map(id => String(id || '').trim()).filter(Boolean)));
    if (!ids.length) throw new Error('Select at least one vendor.');
    await Promise.all(ids.map(id => deleteVendor(id)));
    setVendors(previous => mergeVendorOptions(previous.filter((item: any) => !ids.includes(String(item.id || '')))));
    showSuccess(ids.length === 1 ? 'Vendor deleted.' : `${ids.length} vendors deleted.`);
  };

  const setCell = (row: number, col: string, value: string) => {
    if (!activeSheet || !selectedBuilding) return;
    if (sheetLocked) {
      showInfo(futureMonthLocked ? 'Future month sheets are locked for everyone.' : 'Staff editing for this month is closed after the 10th of the next month.');
      return;
    }
    const latestWorkbook = activeWorkbookRef.current;
    const latestSheet = latestWorkbook?.sheets.find(sheet => sheet.id === activeSheet.id) || activeSheet;
    const nextValue = shouldNormalizeInputCell(activeKind, col) ? normalizeAmlakTextValue(value) : value;
    const targetColumn = sheetColumns(activeKind).find(item => item.col === col);
    const isRentalPaidAmountEdit = isRentalDueBoardKind(activeKind) && targetColumn?.key === 'amount';
    const isSplitBalancePaidAmountEdit = isSplitBalanceBoardKind(activeKind) && targetColumn?.key === 'amount';
    if (targetColumn && cellLockedForUser(latestSheet, row, targetColumn)) {
      showInfo(targetColumn.key === 'unit' ? 'Unit is locked and cannot be edited.' : 'This cell is locked for staff.');
      return;
    }
    const previousMeta = latestSheet.rowsMeta?.[String(row)] as any;
    if (isRentalDueBoardKind(activeKind) && col === 'B' && !String(nextValue || '').trim()) {
      updateSheet(clearRentalUnitRow(latestSheet, row, currentUser));
      return;
    }
    if (isRentalPaidAmountEdit && !String(nextValue || '').trim()) {
      updateSheet(clearRentalPaymentFields(latestSheet, row, currentUser));
      return;
    }
    if (activeKind === 'fees' && targetColumn?.key === 'amount' && !String(nextValue || '').trim()) {
      let next = setWorksheetCellFast(latestSheet, cellAddress(colLabelToIndex(col), row), '0');
      next = deleteSplitChildRows(next, row);
      updateSheet(setWorksheetRowMeta(next, row, currentUser, {
        status: 'draft',
        error: undefined,
        enteredBy: currentUser.id,
        enteredByName: currentUser.name,
      }));
      return;
    }
    if (isRentalDueBoardKind(activeKind) && col === 'B' && blockAlreadyPaidUnitIfNeeded(latestSheet, row, nextValue)) {
      return;
    }
    if (isSplitBalanceBoardKind(activeKind) && col === 'E') {
      const amount = parseSheetAmount(nextValue);
      if (isRentalDueBoardKind(activeKind) && blockEarlierInstallmentIfNeeded(latestSheet, row, amount)) return;
      const max = maxRentalPaymentForRow(latestSheet, row);
      if (amount > max + 0.001) {
        showInfo(rentalPaymentLimitMessage(latestSheet, row, amount));
        return;
      }
    }
    const address = cellAddress(colLabelToIndex(col), row);
    let next = setWorksheetCellFast(latestSheet, address, nextValue);
    next = setWorksheetRowMeta(next, row, currentUser, {
      status: 'draft',
      error: undefined,
      enteredBy: currentUser.id,
      enteredByName: currentUser.name,
      ...(previousMeta?.generatedDueSource === 'monitoring' && !previousMeta?.postedTransactionId
        ? { enteredAt: Date.now() }
        : {}),
      ...(isRentalDueBoardKind(activeKind) && col === 'B' && String(nextValue || '').trim()
        ? { generatedDueSuppressedKey: undefined }
        : {}),
      ...(isSplitBalancePaidAmountEdit && parseSheetAmount(nextValue) > 0.001
        ? { paymentClearedAt: undefined }
        : {}),
    });

    if ((activeKind === 'rentalIncome' || activeKind === 'income' || activeKind === 'vatIncome' || activeKind === 'fees') && col === 'B') {
      if (isRentalDueBoardKind(activeKind)) {
        const dueRow = findManualRentalDueRow({
          building: selectedBuilding,
          contracts: selectedBuildingAllContracts,
          transactions: selectedBuildingTransactions,
          activeMonth,
          unit: nextValue,
          date: undefined,
        });
        if (dueRow) {
          const paidMatch = findAlreadyPaidRentalRow(latestSheet, row, nextValue, dueRow.date);
          if (paidMatch) {
            showError(alreadyPaidRentalMessage(paidMatch));
            showRentalRow(latestSheet, paidMatch.row);
            return;
          }
          const dueKey = rentalDueRowKey(dueRow);
          next = setWorksheetCellFast(next, `A${row}`, dueRow.date);
          next = setWorksheetCellFast(next, `C${row}`, normalizeAmlakTextValue(dueRow.details));
          next = setWorksheetCellFast(next, `D${row}`, String(dueRow.dueAmount));
          next = setWorksheetRowMeta(next, row, currentUser, {
            status: 'draft',
            error: undefined,
            enteredBy: currentUser.id,
            enteredByName: currentUser.name,
            generatedDueSource: 'monitoring',
            generatedDueKey: dueKey,
            generatedAt: Date.now(),
            generatedDueSuppressedKey: undefined,
          });
          next = clearRentalPaymentFields(next, row, currentUser);
          updateSheet(syncSplitChildRows(next, row, currentUser));
          return;
        }
      }
      const contract = contracts.find(contract => contract.buildingId === selectedBuilding.id && String(contract.unitName || '').trim().toLowerCase() === String(nextValue || '').trim().toLowerCase() && contract.status === 'Active')
        || contracts.find(contract => contract.buildingId === selectedBuilding.id && String(contract.unitName || '').trim().toLowerCase() === String(nextValue || '').trim().toLowerCase());
      const details = activeKind === 'fees'
        ? `Non-VAT Fees - ${contract?.customerName || 'Tenant'}${nextValue ? ` - Unit ${nextValue}` : ''}${contract?.contractNo ? ` - #${contract.contractNo}` : ''}`
        : buildIncomeSheetDetails({
        building: selectedBuilding,
        contracts,
        unitName: nextValue,
        date: cellRaw(next, 'A', row),
      });
      const detailCol = activeKind === 'vatIncome' ? 'D' : 'C';
      next = setWorksheetCellFast(next, detailCol + row, normalizeAmlakTextValue(details || ''));
      if (activeKind === 'vatIncome' && contract) {
        const customer = customers.find((c: any) => c.id === contract.customerId) || customers.find((c: any) => c.nameEn === contract.customerName || c.nameAr === contract.customerName);
        next = setWorksheetCellFast(next, 'C' + row, (customer as any)?.vatNumber || '');
      } else if (activeKind === 'vatIncome') {
        next = setWorksheetCellFast(next, 'C' + row, '');
      }
      if (isRentalDueBoardKind(activeKind)) next = clearRentalPaymentFields(next, row, currentUser);
    }

    if ((activeKind === 'expense' || activeKind === 'vatExpense') && col === 'B') {
      next = setWorksheetCellFast(next, `C${row}`, '');
      if (activeKind === 'expense') next = setWorksheetCellFast(next, `D${row}`, '');
      if (activeKind === 'expense') next = setWorksheetCellFast(next, `E${row}`, '');
      if (activeKind === 'expense') next = setWorksheetCellFast(next, `G${row}`, '');
    }

    if (activeKind === 'expense' && ['A', 'B', 'C', 'D'].includes(col)) {
      next = applyExpenseSmartAutofill(next, row);
    }

    if (activeKind === 'vatExpense' && col === 'D') {
      const vendor = findVendorByValue(vendors, nextValue) || findVendorByValue(vendors, value);
      if (vendor) {
        next = setWorksheetCellFast(next, 'D' + row, normalizeAmlakTextValue(vendor.nameEn || vendor.name || nextValue));
        next = setWorksheetCellFast(next, 'E' + row, vendor.vatNumber || vendor.vatNo || '');
      } else {
        next = setWorksheetCellFast(next, 'E' + row, '');
      }
    }

    if (isSplitBalanceBoardKind(activeKind) && ['A', 'B', 'C', 'D', 'E'].includes(col)) {
      next = syncSplitChildRows(next, row, currentUser, activeKind);
      const childMeta = next.rowsMeta?.[String(row)] as any;
      if (isSplitBalancePaidAmountEdit && childMeta?.splitPaymentChild && childMeta?.splitParentRow) {
        next = syncSplitChildRows(next, Number(childMeta.splitParentRow), currentUser, activeKind);
      }
    }
    if (isSplitBalancePaidAmountEdit) {
      const splitResult = autoEnsureSplitRow(next, row, currentUser, activeKind);
      next = splitResult.sheet;
      if (splitResult.targetRow) {
        window.setTimeout(() => {
          const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${splitResult.targetRow}-amount"]`);
          target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }, 80);
      }
    }

    updateSheet(next);
  };

  const splitRentalPaymentRow = (row: number) => {
    if (!activeSheet || !selectedBuilding || !isRentalDueBoardKind(activeKind)) return;
    if (sheetLocked || pastMonthReadOnly) {
      showInfo(pastMonthReadOnly ? 'Past month sheets show posted rows only.' : 'This sheet is locked.');
      return;
    }
    const meta = activeSheet.rowsMeta?.[String(row)];
    if (meta?.status === 'posted' || meta?.postedTransactionId) {
      showInfo('Posted rows cannot be split.');
      return;
    }
    const dueDate = cellRaw(activeSheet, 'A', row);
    const unit = cellRaw(activeSheet, 'B', row);
    const due = parseSheetAmount(cellRaw(activeSheet, 'D', row));
    const paid = parseSheetAmount(cellRaw(activeSheet, 'E', row));
    if (!dueDate || !unit || due <= 0) {
      showInfo('Choose a rental due row first.');
      return;
    }
    const remaining = Math.max(0, due - paid);
    if (paid <= 0 || remaining <= 0) {
      showInfo('Enter a partial paid amount first, then split the remaining balance.');
      return;
    }

    const splitResult = autoEnsureSplitRow(activeSheet, row, currentUser);
    const next = splitResult.sheet;
    const targetRow = splitResult.targetRow;
    if (!targetRow) return;
    updateSheet(next);
    setActiveCell(compactSheetUi ? null : { row: targetRow, key: 'amount' });
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${targetRow}-amount"]`);
      target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      target?.focus();
    }, 80);
    showSuccess(`Split remaining ${formatAmount(remaining)} SAR`);
  };

  const moveActiveCell = (row: number, key: ColumnKind, direction: 'up' | 'down' | 'left' | 'right') => {
    const columns = sheetColumns(activeKind);
    const colIndex = columns.findIndex(col => col.key === key);
    const visibleIndex = visibleRows.indexOf(row);
    let nextRow = row;
    let nextIndex = colIndex;
    if (direction === 'up') {
      nextRow = visibleIndex > 0 ? visibleRows[visibleIndex - 1] : row;
    }
    if (direction === 'down') {
      nextRow = visibleIndex >= 0 && visibleIndex < visibleRows.length - 1 ? visibleRows[visibleIndex + 1] : row;
    }
    if (direction === 'left') nextIndex = Math.max(0, colIndex - 1);
    if (direction === 'right') nextIndex = Math.min(columns.length - 1, colIndex + 1);
    const nextKey = columns[nextIndex]?.key || key;
    setActiveCell({ row: nextRow, key: nextKey });
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${nextRow}-${nextKey}"]`);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  };

  const postSelectedRows = async () => {
    if (!canPostRows || !activeSheet || !activeWorkbook) return;
    if (futureMonthLocked) {
      showInfo('Future month sheets are locked for everyone.');
      return;
    }
    if (sheetLocked) {
      showInfo('This sheet is locked for posting.');
      return;
    }
    const rows = postingResults.filter(result => selectedRows.has(result.row) && result.ok && (result.transaction || result.transfer));
    if (!rows.length) {
      showInfo('Select valid rows to post');
      return;
    }
    const posted: Array<{ row: number; transactionId: string; postedBy: string }> = [];
    let interBuildingTransferCount = 0;
    for (const row of rows) {
      if (row.transfer) {
        const transfer = row.transfer;
        if (
          transfer.fromType === 'BUILDING' &&
          transfer.toType === 'BUILDING' &&
          transfer.fromId &&
          transfer.toId &&
          String(transfer.fromId) !== String(transfer.toId)
        ) {
          interBuildingTransferCount++;
        }
        const saved = await saveTransfer(transfer);
        posted.push({ row: row.row, transactionId: String((saved as any)?.id || transfer.id), postedBy: currentUser.id });
      } else {
        const tx = row.transaction!;
        await saveTransaction(tx, { skipAmlakSheetSync: true });
        posted.push({ row: row.row, transactionId: tx.id, postedBy: currentUser.id });
      }
    }
    let nextSheet = markWorksheetRowsPosted(activeSheet, posted);
    posted.forEach(item => {
      nextSheet = setWorksheetRowMeta(nextSheet, item.row, currentUser, {
        status: 'posted',
        postedTransactionId: item.transactionId,
        postedAt: Date.now(),
        postedBy: currentUser.id,
        postedByName: currentUser.name,
      });
    });
    const nextWorkbook = {
      ...activeWorkbook,
      sheets: activeWorkbook.sheets.map(sheet => sheet.id === nextSheet.id ? nextSheet : sheet),
      updatedAt: Date.now(),
    };
    const compactedWorkbook = compactAmlakWorkbook(nextWorkbook);
    updateWorkbook(compactedWorkbook);
    await saveAmlakWorkbook(compactedWorkbook);
    setTransactions(await getTransactions());
    setSelectedRows(new Set());
    showSuccess(
      interBuildingTransferCount > 0
        ? `Posted ${posted.length} row(s). Inter-building transfer complete: source expense and destination other income were created.`
        : `Posted ${posted.length} row(s)`
    );
  };

  const visibleRows = useMemo(() => {
    if (!activeSheet) return [];
    const pastMonth = activeMonth < currentMonthKey();
    const emptyRowLimit = supportsManualRows(activeKind)
      ? Math.max(0, Number(activeSheet.visibleEmptyRowLimit ?? AUTO_EMPTY_ROW_BUFFER) || 0)
      : 0;
    const rowIsPosted = (row: number) => {
      const meta = activeSheet.rowsMeta?.[String(row)];
      return meta?.status === 'posted' ||
        !!meta?.postedTransactionId;
    };
    const maxDataRow = Math.max(
      1,
      ...Object.keys(activeSheet.rowsMeta || {}).map(Number).filter(Number.isFinite),
      ...Object.values(activeSheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)),
    );
    const scanEnd = Math.min(activeSheet.rowCount, Math.max(maxDataRow + emptyRowLimit, 1 + emptyRowLimit));
    const candidates = Array.from({ length: Math.max(0, scanEnd - 1) }, (_, i) => i + 2);
    const matched: number[] = [];
    let visibleEmptyRows = 0;
    for (const row of candidates) {
      const hasData = rowHasData(activeSheet, row);
      const meta = activeSheet.rowsMeta?.[String(row)] as any;
      if (pastMonth && !hasData) continue;
      if (!hasData) {
        if (!deferredSheetSearchTerm.trim() && meta?.manualAddedRow) {
          matched.push(row);
          continue;
        }
        if (!deferredSheetSearchTerm.trim() && visibleEmptyRows < emptyRowLimit) {
          matched.push(row);
          visibleEmptyRows++;
        }
        continue;
      }
      const generatedPriorOrPastBalance = isGeneratedPriorOrPastBalanceRow(meta);
      if (pastMonth && !rowIsPosted(row) && !generatedPriorOrPastBalance) continue;
      if (activeKind === 'fees' && isDuplicateAutoFeeDueRow(activeSheet, row)) continue;
      if (isRentalDueBoardKind(activeKind) && isDuplicateAutoRentalDueRow(activeSheet, row)) continue;
      if (isRentalDueBoardKind(activeKind)) {
        if (isSplitPaymentChildRow(activeSheet, row)) {
          matched.push(row);
          continue;
        }
        const date = cellRaw(activeSheet, 'A', row);
        if (!date) {
          matched.push(row);
          continue;
        }
        const current = currentMonthKey();
        if (activeMonth > current) continue;
        const due = Number(String(cellRaw(activeSheet, 'D', row) || '').replace(/,/g, '')) || 0;
        const paid = Number(String(cellRaw(activeSheet, 'E', row) || '').replace(/,/g, '')) || 0;
        const paidDate = cellRaw(activeSheet, 'G', row);
        if (paid > 0 && !paidDate) {
          matched.push(row);
          continue;
        }
        if (generatedPriorOrPastBalance && due > paid) {
          matched.push(row);
          continue;
        }
        if (activeMonth === current) {
          const horizonEnd = dateToLocalStr(addMonths(monthStart(current), 3));
          const generatedCurrentWindow = meta?.generatedDueSource === 'monitoring' && (
            (date >= `${current}-01` && date < horizonEnd)
          );
          const legacyOverdueDraft = !meta?.generatedDueSource && !rowIsPosted(row) && date < dateToLocalStr(addMonths(monthStart(current), 1)) && due > paid;
          if (rowDisplayMonthKey(activeSheet, activeKind, row) === current || generatedCurrentWindow || legacyOverdueDraft) matched.push(row);
          continue;
        }
        if (rowDisplayMonthKey(activeSheet, activeKind, row) === activeMonth) matched.push(row);
        continue;
      }
      if (supportsManualRows(activeKind) && !cellRaw(activeSheet, 'A', row)) {
        matched.push(row);
        continue;
      }
      if (rowDisplayMonthKey(activeSheet, activeKind, row) === activeMonth) matched.push(row);
    }
    const searched = deferredSheetSearchTerm.trim()
      ? matched.filter(row => rowMatchesSheetSearch(activeSheet, activeKind, row, deferredSheetSearchTerm))
      : matched;
    const categoryFiltered = activeKind === 'expense' && expenseCategoryFilter
      ? searched.filter(row => normRowKey(cellRaw(activeSheet, 'B', row)) === normRowKey(expenseCategoryFilter))
      : searched;
    const displayRows = isRentalDueBoardKind(activeKind)
      ? [...categoryFiltered].sort((a, b) => {
        const aDate = cellRaw(activeSheet, 'A', a);
        const bDate = cellRaw(activeSheet, 'A', b);
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        const aUnit = normRowKey(cellRaw(activeSheet, 'B', a));
        const bUnit = normRowKey(cellRaw(activeSheet, 'B', b));
        if (aUnit !== bUnit) return aUnit.localeCompare(bUnit);
        return a - b;
      })
      : categoryFiltered;
    if (pastMonth) return displayRows;
    const emptyFallbackRows = candidates
      .filter(row => !rowHasData(activeSheet, row))
      .slice(0, emptyRowLimit);
    return displayRows.length ? displayRows : (deferredSheetSearchTerm.trim() || expenseCategoryFilter) ? [] : emptyFallbackRows;
  }, [activeSheet, activeKind, activeMonth, deferredSheetSearchTerm, expenseCategoryFilter, compactSheetUi]);
  const activeGridTemplate = useMemo(() => (
    gridTemplate(activeKind, canPostRows, activeSheet || undefined, visibleRows, viewportWidth)
  ), [activeKind, activeSheet, canPostRows, visibleRows, viewportWidth]);
  const multiBuildingSheetSections = useMemo(() => {
    if (!selectedBuilding || selectedSummaryBuildings.length <= 1) return [];
    return selectedSummaryBuildings
      .map(building => {
        const isActiveBuilding = building.id === selectedBuilding.id;
        const workbook = isActiveBuilding ? activeWorkbook : workbookForBuilding(workbooks, building);
        const sheet = isActiveBuilding
          ? activeSheet
          : workbook?.sheets.find(item => (item.sheetKind === 'income' ? 'rentalIncome' : item.sheetKind) === activeKind);
        if (!sheet) return null;
        if (isActiveBuilding) return { building, sheet, rows: visibleRows, editable: true };
        const maxDataRow = Math.max(
          1,
          ...Object.keys(sheet.rowsMeta || {}).map(Number).filter(Number.isFinite),
          ...Object.values(sheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)),
        );
        const rows = Array.from({ length: Math.max(0, maxDataRow - 1) }, (_, index) => index + 2)
          .filter(row => rowHasData(sheet, row))
          .filter(row => rowDisplayMonthKey(sheet, activeKind, row) === activeMonth)
          .filter(row => !deferredSheetSearchTerm.trim() || rowMatchesSheetSearch(sheet, activeKind, row, deferredSheetSearchTerm))
          .filter(row => activeKind !== 'expense' || !expenseCategoryFilter || normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(expenseCategoryFilter));
        return { building, sheet, rows, editable: false };
      })
      .filter((section): section is { building: Building; sheet: AmlakWorksheet; rows: number[]; editable: boolean } => !!section);
  }, [selectedBuilding?.id, selectedSummaryBuildings, activeWorkbook, activeSheet, workbooks, activeKind, activeMonth, visibleRows, deferredSheetSearchTerm, expenseCategoryFilter]);

  useEffect(() => {
    const target = gridScrollRef.current;
    if (!target) {
      setGridScrollEdges({ canLeft: false, canRight: false });
      return;
    }
    const refresh = () => setGridScrollEdges(horizontalScrollEdges(target));
    const raf = window.requestAnimationFrame(refresh);
    target.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh);
    return () => {
      window.cancelAnimationFrame(raf);
      target.removeEventListener('scroll', refresh);
      window.removeEventListener('resize', refresh);
    };
  }, [activeGridTemplate, visibleRows.length, activeKind, activeMonth, sheetFocusMode]);

  const monthSummary = useMemo(() => {
    if (!activeSheet) return { cash: 0, bank: 0, cheque: 0, total: 0 };
    return visibleRows.reduce((acc, row) => {
      if (!rowHasData(activeSheet, row) || rowDisplayMonthKey(activeSheet, activeKind, row) !== activeMonth) return acc;
      const amount = rowEnteredAmount(activeSheet, activeKind, row);
      const method = rowPaymentMethod(activeSheet, activeKind, row);
      acc.total += amount;
      if (method === 'CASH') acc.cash += amount;
      if (method === 'BANK') acc.bank += amount;
      if (method === 'CHEQUE') acc.cheque += amount;
      return acc;
    }, { cash: 0, bank: 0, cheque: 0, total: 0 });
  }, [activeSheet, activeKind, activeMonth, visibleRows]);
  const rentalDueSummary = useMemo(() => {
    if (!activeSheet || !isRentalDueBoardKind(activeKind)) return { due: 0, paid: 0, balance: 0 };
    return visibleRows.reduce((acc, row) => {
      if (!rowHasData(activeSheet, row) || isSplitPaymentChildRow(activeSheet, row)) return acc;
      const state = rentalBalanceState(activeSheet, row);
      acc.due += state.due;
      acc.paid += Math.min(state.paid, state.due);
      acc.balance += state.balance;
      return acc;
    }, { due: 0, paid: 0, balance: 0 });
  }, [activeSheet, activeKind, visibleRows]);
  const ledgerSummary = useMemo(() => {
    if (!selectedSummaryBuildings.length) {
      return {
        openingCash: 0,
        openingBank: 0,
        openingTotal: 0,
        cashIncome: 0,
        bankIncome: 0,
        chequeIncome: 0,
        incomeTotal: 0,
        cashExpense: 0,
        bankExpense: 0,
        chequeExpense: 0,
        expenseTotal: 0,
        cashBalance: 0,
        bankBalance: 0,
        totalNet: 0,
        totalOutputVAT: 0,
        totalInputVAT: 0,
        netVATPayable: 0,
        ownerExpenseTotal: 0,
        rentalIncomeCash: 0,
        rentalIncomeBank: 0,
        rentalIncomeTotal: 0,
        otherIncomeCash: 0,
        otherIncomeBank: 0,
        otherIncomeTotal: 0,
        feesIncomeCash: 0,
        feesIncomeBank: 0,
        feesIncomeTotal: 0,
        expenseCash: 0,
        expenseBank: 0,
        expenseTotalDirect: 0,
        ownerExpenseCash: 0,
        ownerExpenseBank: 0,
        vatPurchaseCash: 0,
        vatPurchaseBank: 0,
        vatPurchaseTotal: 0,
      };
    }
    const monthStartKey = `${activeMonth}-01`;
    const nextMonthStartKey = dateToLocalStr(addMonths(monthStart(activeMonth), 1));
    const selectedHistoryTransactions = transactions.filter((tx: any) =>
      selectedSummaryBuildings.some(building => itemMatchesSelectedBuilding(tx, building))
    );
    const normalizedType = (value: any) => String(value || '').toUpperCase();
    const approvedHistoryRows = selectedHistoryTransactions.filter((tx: any) => {
      if (!tx || tx.deleted) return false;
      if (tx.paymentMethod === 'TREASURY_REVERSAL') return false;
      const status = String(tx.status || TransactionStatus.APPROVED).toUpperCase();
      return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !tx.status;
    });
    const isOpeningBalance = (tx: Transaction) =>
      (tx as any).borrowingType === 'OPENING_BALANCE' ||
      (tx as any).isOpeningBalance === true ||
      (tx as any).isOwnerOpeningBalance === true ||
      tx.expenseCategory === 'Owner Opening Balance';
    const selectedWorkbooks = selectedSummaryBuildings
      .map(building => workbookForBuilding(workbooks, building))
      .filter(Boolean) as AmlakWorkbook[];
    const sheetRows = selectedWorkbooks.flatMap(workbook => workbook.sheets.flatMap(sheet => {
      const kind = (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind || 'rentalIncome') as AmlakSheetKind;
      const maxRow = Math.max(
        sheet.rowCount || 1,
        ...Object.keys(sheet.rowsMeta || {}).map(Number).filter(Number.isFinite),
        ...Object.values(sheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)),
      );
      return Array.from({ length: Math.max(0, maxRow - 1) }, (_, index) => index + 2)
        .filter(row => rowHasData(sheet, row))
        .map(row => {
          const date = kind === 'rentalIncome' || kind === 'vatIncome' || kind === 'fees'
            ? cellRaw(sheet, 'G', row)
            : cellRaw(sheet, 'A', row);
          return {
            kind,
            row,
            date,
            amount: rowEnteredAmount(sheet, kind, row),
            method: rowPaymentMethod(sheet, kind, row),
            vatAmount: kind === 'vatIncome'
              ? Math.max(0, rowEnteredAmount(sheet, kind, row) - Math.round((rowEnteredAmount(sheet, kind, row) / 1.15) * 100) / 100)
              : kind === 'vatExpense'
                ? Math.max(0, rowEnteredAmount(sheet, kind, row) - Math.round((rowEnteredAmount(sheet, kind, row) / 1.15) * 100) / 100)
                : 0,
          };
        })
        .filter(row => row.date && row.amount > 0);
    }));
    const isIncomeKind = (kind: AmlakSheetKind) => ['rentalIncome', 'otherIncome', 'fees'].includes(kind);
    const isExpenseKind = (kind: AmlakSheetKind) => ['expense', 'ownerExpense', 'vatExpense'].includes(kind);
    const isOwnerExpenseKind = (kind: AmlakSheetKind) => kind === 'ownerExpense';

    let openingCash = 0;
    let openingBank = 0;
    let openingTotal = 0;
    approvedHistoryRows
      .filter(tx => tx.date && tx.date < monthStartKey && !isOpeningBalance(tx))
      .forEach(tx => {
        const amount = transactionDisplayAmount(tx);
        const signed = normalizedType(tx.type) === TransactionType.INCOME ? amount : -amount;
        openingTotal += signed;
        if (transactionCountsAsCashForSplit(tx)) openingCash += signed;
        if (transactionCountsAsBankForSplit(tx)) openingBank += signed;
      });

    const periodRows = sheetRows.filter(row => row.date >= monthStartKey && row.date < nextMonthStartKey);
    const incomeRows = periodRows.filter(row => isIncomeKind(row.kind));
    const expenseRows = periodRows.filter(row => isExpenseKind(row.kind));
    const sumRows = (rows: typeof sheetRows) => rows.reduce((sum, row) => sum + row.amount, 0);
    const splitRows = (rows: typeof sheetRows) => ({
      cash: sumRows(rows.filter(row => row.method === 'CASH')),
      bank: sumRows(rows.filter(row => row.method === 'BANK' || row.method === 'CHEQUE')),
      total: sumRows(rows),
    });
    const rentalIncomeSplit = splitRows(periodRows.filter(row => row.kind === 'rentalIncome'));
    const otherIncomeSplit = splitRows(periodRows.filter(row => row.kind === 'otherIncome'));
    const feesIncomeSplit = splitRows(periodRows.filter(row => row.kind === 'fees'));
    const expenseSplit = splitRows(periodRows.filter(row => row.kind === 'expense'));
    const ownerExpenseSplit = splitRows(periodRows.filter(row => row.kind === 'ownerExpense'));
    const vatPurchaseSplit = splitRows(periodRows.filter(row => row.kind === 'vatExpense'));
    const cashIncome = sumRows(incomeRows.filter(row => row.method === 'CASH'));
    const bankIncome = sumRows(incomeRows.filter(row => row.method === 'BANK' || row.method === 'CHEQUE'));
    const cashExpense = sumRows(expenseRows.filter(row => row.method === 'CASH'));
    const bankExpense = sumRows(expenseRows.filter(row => row.method === 'BANK' || row.method === 'CHEQUE'));
    const chequeIncome = sumRows(incomeRows.filter(row => row.method === 'CHEQUE'));
    const chequeExpense = sumRows(expenseRows.filter(row => row.method === 'CHEQUE'));
    const incomeTotal = sumRows(incomeRows);
    const expenseTotal = sumRows(expenseRows);
    const totalOutputVAT = periodRows.filter(row => row.kind === 'vatIncome').reduce((sum, row) => sum + row.vatAmount, 0);
    const totalInputVAT = periodRows.filter(row => row.kind === 'vatExpense').reduce((sum, row) => sum + row.vatAmount, 0);

    return {
      openingCash,
      openingBank,
      openingTotal,
      cashIncome,
      bankIncome,
      chequeIncome,
      incomeTotal,
      cashExpense,
      bankExpense,
      chequeExpense,
      expenseTotal,
      cashBalance: openingCash + cashIncome - cashExpense,
      bankBalance: openingBank + bankIncome - bankExpense,
      totalNet: openingTotal + incomeTotal - expenseTotal,
      totalOutputVAT,
      totalInputVAT,
      netVATPayable: totalOutputVAT - totalInputVAT,
      ownerExpenseTotal: sumRows(periodRows.filter(row => isOwnerExpenseKind(row.kind))),
      rentalIncomeCash: rentalIncomeSplit.cash,
      rentalIncomeBank: rentalIncomeSplit.bank,
      rentalIncomeTotal: rentalIncomeSplit.total,
      otherIncomeCash: otherIncomeSplit.cash,
      otherIncomeBank: otherIncomeSplit.bank,
      otherIncomeTotal: otherIncomeSplit.total,
      feesIncomeCash: feesIncomeSplit.cash,
      feesIncomeBank: feesIncomeSplit.bank,
      feesIncomeTotal: feesIncomeSplit.total,
      expenseCash: expenseSplit.cash,
      expenseBank: expenseSplit.bank,
      expenseTotalDirect: expenseSplit.total,
      ownerExpenseCash: ownerExpenseSplit.cash,
      ownerExpenseBank: ownerExpenseSplit.bank,
      vatPurchaseCash: vatPurchaseSplit.cash,
      vatPurchaseBank: vatPurchaseSplit.bank,
      vatPurchaseTotal: vatPurchaseSplit.total,
    };
  }, [activeMonth, selectedSummaryBuildings, transactions, workbooks]);
  const cardSplit = (cash: number, bank: number) => `Cash ${formatAmount(cash)} | Bank ${formatAmount(bank)}`;

  if (loading) {
    return (
      <div className="min-h-full grid place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500 font-black"><Loader2 className="animate-spin" /> Loading building sheets...</div>
      </div>
    );
  }

  if (!selectedBuilding || !activeWorkbook || !activeSheet) {
    return (
      <div className="min-h-full grid place-items-center bg-slate-50 p-8 text-center">
        <div>
          <Home className="mx-auto text-slate-300 mb-3" size={42} />
          <h1 className="text-xl font-black text-slate-800">No building assigned</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Ask admin to assign a building to your user account.</p>
        </div>
      </div>
    );
  }

  const exportCurrentSheetPdf = () => {
    const columns = sheetColumns(activeKind);
    const dataRows = visibleRows.filter(row => rowHasData(activeSheet, row));
    if (!dataRows.length) {
      showInfo('No sheet rows to export for this filter.');
      return;
    }

    const esc = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const tabLabel = visibleSheetTabs.find(tab => tab.kind === activeKind)?.label || activeSheet.name || 'Sheet';
    const rowsHtml = dataRows.map((row, index) => {
      const values = columns.map(column => {
        const value = columnDisplayValue(activeSheet, column, row) || (column.col ? cellRaw(activeSheet, column.col, row) : '');
        const numeric = ['amount', 'dueAmount', 'balance', 'extra', 'discount'].includes(column.key);
        return `<td class="${numeric ? 'num' : ''}">${esc(value || '-')}</td>`;
      }).join('');
      return `<tr><td class="row-no">${index + 1}</td>${values}</tr>`;
    }).join('');
    const origin = window.location.origin;
    const filters = [
      ['Building', selectedBuilding.name],
      ['Sheet', tabLabel],
      ['Month', monthLabel(activeMonth)],
      ...(activeKind === 'expense' && expenseCategoryFilter ? [['Category', expenseCategoryFilter]] : []),
      ...(sheetSearchTerm.trim() ? [['Search', sheetSearchTerm.trim()]] : []),
    ];
    const summaryCards = [
      ['Sheet Cash', formatAmount(monthSummary.cash)],
      ['Sheet Bank', formatAmount(monthSummary.bank)],
      ['Sheet Total', formatAmount(monthSummary.total)],
      ['Rows', String(dataRows.length)],
    ];
    const win = window.open('', '_blank', 'width=1100,height=820');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${esc(tabLabel)} - ${esc(selectedBuilding.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .toolbar { max-width: 1120px; margin: 18px auto 0; text-align: right; }
    .toolbar button { border: 0; border-radius: 999px; padding: 10px 18px; background: #047857; color: #fff; font-weight: 900; cursor: pointer; }
    .page { max-width: 1120px; margin: 18px auto 28px; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 55px rgba(15,23,42,.12); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 24px 28px; background: linear-gradient(135deg,#064e3b,#047857); color: #fff; }
    .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .brand img { width: 52px; height: 52px; object-fit: contain; border-radius: 14px; background: #fff; padding: 5px; }
    h1 { margin: 0; font-size: 22px; line-height: 1.15; }
    .sub { margin-top: 4px; color: #bbf7d0; font-size: 12px; font-weight: 700; }
    .generated { text-align: right; color: #d1fae5; font-size: 12px; line-height: 1.6; white-space: nowrap; }
    .filters, .summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; padding: 16px 28px; border-bottom: 1px solid #e2e8f0; }
    .chip, .card { border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 12px; padding: 10px 12px; min-width: 0; }
    .label { color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin-top: 3px; color: #064e3b; font-weight: 900; font-size: 14px; overflow-wrap: anywhere; }
    .body { padding: 22px 28px 30px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #065f46; color: #fff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 9px 8px; white-space: nowrap; }
    td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 11px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .row-no { width: 42px; text-align: center; color: #64748b; font-weight: 900; }
    .num { text-align: right; font-weight: 900; white-space: nowrap; }
    .footer { display: flex; justify-content: space-between; gap: 14px; padding: 14px 28px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none; }
      .page { margin: 0; max-width: none; border-radius: 0; box-shadow: none; }
      .body { overflow: visible; }
      th, td { font-size: 9px; padding: 6px; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save PDF</button></div>
  <main class="page">
    <section class="head">
      <div class="brand">
        <img src="${origin}/images/cologo.png" alt="Logo" onerror="this.style.display='none'" />
        <div>
          <h1>${esc(tabLabel)} Sheet</h1>
          <div class="sub">${esc(selectedBuilding.name)} · ${esc(monthLabel(activeMonth))}</div>
        </div>
      </div>
      <div class="generated">
        <div>Generated: ${esc(new Date().toLocaleString('en-SA'))}</div>
        <div>By: ${esc(currentUser.name || currentUser.email || '')}</div>
      </div>
    </section>
    <section class="filters">
      ${filters.map(([label, value]) => `<div class="chip"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join('')}
    </section>
    <section class="summary">
      ${summaryCards.map(([label, value]) => `<div class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join('')}
    </section>
    <section class="body">
      <table>
        <thead><tr><th>#</th>${columns.map(column => `<th>${esc(column.label)}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>
    <section class="footer">
      <span>Amlak Sheets · computer-generated export</span>
      <span>${esc(tabLabel)} · ${esc(activeMonth)}</span>
    </section>
  </main>
</body>
</html>`);
    win.document.close();
    win.focus();
  };

  const onlineUsers = Object.values(presence).filter(p => p.online && Date.now() - p.lastSeenMs < 90000);
  const selectedValidCount = [...selectedRows].filter(row => postingByRow.get(row)?.ok).length;

  return (
    <div className={`${sheetFocusMode ? 'fixed inset-0 z-[90] h-[100dvh] min-h-[100dvh] overflow-hidden' : 'h-[100dvh] min-h-0 overflow-hidden'} bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#ecfdf5_42%,#f8fafc_100%)] flex flex-col`}>
      <header className={`${sheetFocusMode ? 'px-1 sm:px-2 py-1' : 'px-3 sm:px-4 md:px-6 py-3'} shrink-0 border-b border-emerald-200/70 bg-white/86 backdrop-blur-2xl sticky top-0 z-30 shadow-[0_18px_60px_rgba(15,23,42,0.08)]`}>
        {!sheetFocusMode && (
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-[1.35rem] bg-gradient-to-br from-emerald-950 via-emerald-700 to-lime-400 p-[2px] shadow-xl shadow-emerald-200/80 shrink-0">
              <div className="h-full w-full rounded-[1.22rem] bg-white/95 grid place-items-center">
                <FileSpreadsheet className="text-emerald-700" size={26} />
              </div>
              <span className="absolute -right-1 -bottom-1 h-5 w-5 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                Standalone PWA
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-emerald-950 truncate">Amlak Sheets</h1>
              <p className="text-[11px] sm:text-sm font-bold text-slate-500 truncate">All rights reserved · spreadsheet workspace for Amlak buildings</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <div className="relative col-span-2 sm:col-span-1 w-full sm:w-auto sm:min-w-72" onClick={event => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setBuildingDropdownOpen(open => !open)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-3 sm:px-4 py-2.5 text-left text-sm font-black text-slate-800 shadow-sm active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate">{buildingDropdownLabel}</span>
                  <span className="block truncate text-[10px] font-bold text-emerald-600">Sheet: {selectedBuilding?.name || '-'}</span>
                </span>
                <ChevronRight size={17} className={`shrink-0 text-emerald-600 transition-transform ${buildingDropdownOpen ? 'rotate-90' : ''}`} />
              </button>
              {buildingDropdownOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[90] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/15">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-50 bg-emerald-50/80 px-3 py-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Buildings</div>
                      <div className="text-[10px] font-bold text-slate-500">Cards total selected buildings</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = allowedBuildings.map(building => building.id);
                        const firstId = ids[0] || selectedBuilding.id;
                        setSelectedSummaryBuildingIds(ids);
                        setSelectedBuildingId(firstId);
                        try {
                          localStorage.setItem(selectedBuildingStorageKey(activeBookId, currentUser.id), firstId);
                          localStorage.setItem(selectedSummaryBuildingsStorageKey(activeBookId, currentUser.id), JSON.stringify(ids));
                        } catch { /* ignore unavailable storage */ }
                      }}
                      className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700"
                    >
                      All
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {allowedBuildings.map(building => {
                      const checked = selectedSummaryIdsSet.has(building.id);
                      const activeSheetBuilding = selectedBuilding?.id === building.id;
                      return (
                        <label key={building.id} className={`flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ${activeSheetBuilding ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => {
                              const current = new Set(selectedSummaryIdsSet);
                              if (event.target.checked) current.add(building.id);
                              else current.delete(building.id);
                              const nextValues = Array.from(current);
                              const finalValues = nextValues.length ? nextValues : [building.id];
                              const nextBuildingId = finalValues[0];
                              setSelectedSummaryBuildingIds(finalValues);
                              setSelectedBuildingId(nextBuildingId);
                              try {
                                localStorage.setItem(selectedBuildingStorageKey(activeBookId, currentUser.id), nextBuildingId);
                                localStorage.setItem(selectedSummaryBuildingsStorageKey(activeBookId, currentUser.id), JSON.stringify(finalValues));
                              } catch { /* ignore unavailable storage */ }
                              setActiveKind('rentalIncome');
                              setActiveMonth(currentMonthKey());
                              setSelectedRows(new Set());
                              setActiveCell(null);
                              setExpenseCategoryFilter('');
                            }}
                            className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                          />
                          <span className="min-w-0 flex-1 truncate">{building.name}</span>
                          {activeSheetBuilding && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] text-white">Sheet</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void installAmlakSheets()}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-black shadow-sm active:scale-[0.98] ${
                isInstalledApp
                  ? 'border-slate-200 bg-slate-50 text-slate-500 shadow-slate-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-100'
              }`}
            >
              <Download size={16} /> {isInstalledApp ? 'Installed' : 'Install app'}
            </button>
            {isAdmin && (
              <button onClick={() => exportBuildingWorkbook(activeWorkbook)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm active:scale-[0.98]">
                <Download size={16} /> Export
              </button>
            )}
            <button onClick={exportCurrentSheetPdf} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-emerald-700 shadow-sm active:scale-[0.98]">
              <Printer size={16} /> PDF
            </button>
            <button
              type="button"
              onClick={undoSheetChange}
              disabled={!undoStack.length || saving}
              title="Undo last sheet change"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60 active:scale-[0.98]"
            >
              <Undo2 size={16} /> Undo
            </button>
            <button
              type="button"
              onClick={redoSheetChange}
              disabled={!redoStack.length || saving}
              title="Redo sheet change"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60 active:scale-[0.98]"
            >
              <Redo2 size={16} /> Redo
            </button>
            <button onClick={() => void saveWorkbook(false)} disabled={saving} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-4 py-2.5 text-sm font-black shadow-lg shadow-emerald-100 disabled:opacity-60 active:scale-[0.98]">
              <Save size={16} /> {saving ? 'Saving...' : dirty ? 'Save draft' : 'Saved'}
            </button>
            <div className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <select
                value={addRowsCount}
                onChange={e => setAddRowsCount(Number(e.target.value) || 15)}
                disabled={sheetLocked || pastMonthReadOnly}
                className="min-w-0 flex-1 bg-white px-2.5 py-2 text-xs font-black text-slate-700 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                aria-label="Rows to add"
              >
                <option value={5}>5 rows</option>
                <option value={10}>10 rows</option>
                <option value={15}>15 rows</option>
              </select>
              <button
                type="button"
                onClick={addBlankRows}
                disabled={sheetLocked || pastMonthReadOnly}
                className="inline-flex items-center justify-center gap-1.5 border-l border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:bg-slate-50 disabled:text-slate-400 active:scale-[0.98]"
              >
                <Plus size={15} /> Add
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSheetFocusMode(value => !value)}
              className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-3 sm:px-4 py-2.5 text-sm font-black text-white shadow-sm active:scale-[0.98]"
            >
              {sheetFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {sheetFocusMode ? 'Exit full' : 'Full sheet'}
            </button>
          </div>
        </div>
        )}

        <div className={`${sheetFocusMode ? 'mt-0' : 'mt-3'} flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 sm:gap-3`}>
          <div className={`${sheetFocusMode ? 'rounded-xl p-1' : 'rounded-[1.7rem] p-1.5 shadow-xl shadow-emerald-900/10'} border border-emerald-100 bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-700 overflow-x-auto overscroll-x-contain snap-x [-webkit-overflow-scrolling:touch]`}>
            <div className="flex items-center gap-1.5 min-w-max">
            {visibleSheetTabs.map(tab => {
              const active = activeKind === tab.kind;
              return (
                <button
                  key={tab.kind}
                  onClick={() => {
                    setActiveKind(tab.kind);
                    setSelectedRows(new Set());
                    if (tab.kind !== 'expense') setExpenseCategoryFilter('');
                  }}
                  className={`snap-start min-w-[112px] sm:min-w-[126px] px-3 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black border transition-all duration-200 ease-out active:scale-[0.98] ${
                    active ? 'bg-white text-emerald-950 border-white shadow-lg shadow-emerald-950/20' : 'bg-white/8 text-emerald-50 border-white/10 hover:bg-white/15'
                  }`}
                >
                  <span className="block leading-tight">{tab.label}</span>
                  {tab.subtitle && <span className={`block text-[9px] font-bold leading-tight ${active ? 'text-emerald-600' : 'text-emerald-100/70'}`}>{tab.subtitle}</span>}
                </button>
              );
            })}
            {sheetFocusMode && (
              <button
                type="button"
                onClick={() => setSheetFocusMode(false)}
                className="snap-start inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white active:scale-[0.98]"
                title="Exit full sheet"
              >
                <Minimize2 size={14} /> Exit
              </button>
            )}
            </div>
          </div>
          {!sheetFocusMode && (
          <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] sm:text-xs font-bold text-slate-500">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5"><UsersRound size={14} /> {sharedUsers.length} users</div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-emerald-700"><Eye size={14} /> {onlineUsers.length} online</div>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 6).map(user => (
                <span key={user.userId} title={user.userName} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
                  {user.userName.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          )}
        </div>

        <div className={`${sheetFocusMode ? 'mt-1 rounded-xl p-1' : 'mt-3 rounded-3xl p-1.5 shadow-sm'} border border-slate-200 bg-white/82 overflow-x-auto overscroll-x-contain snap-x [-webkit-overflow-scrolling:touch]`}>
          <div className="flex gap-1.5 min-w-max">
          {monthTabs.map(month => {
            const active = month === activeMonth;
            return (
              <button
                key={month}
                type="button"
                onClick={() => {
                  setActiveMonth(month);
                  setSelectedRows(new Set());
                }}
                className={`inline-flex min-w-[96px] justify-center items-center gap-1.5 shrink-0 snap-start rounded-2xl px-3 py-2 text-xs font-black border transition-all duration-200 ease-out active:scale-[0.98] ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200'
                    : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-white hover:text-emerald-700'
                }`}
              >
                <CalendarDays size={14} />
                {monthLabel(month)}
              </button>
            );
          })}
          </div>
        </div>
        <div className={`${sheetFocusMode ? 'mt-1' : 'mt-3'} flex flex-col sm:flex-row sm:items-center gap-2`}>
          <div className="relative flex-1 min-w-0">
            <input
              type="search"
              value={sheetSearchTerm}
              onChange={e => {
                setSheetSearchTerm(e.target.value);
                setSelectedRows(new Set());
              }}
              placeholder="Search rows by unit, date, amount, method, details..."
              className="w-full rounded-2xl border border-slate-200 bg-white/95 py-2.5 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              aria-label="Search sheet rows"
            />
            {sheetSearchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSheetSearchTerm('');
                  setSelectedRows(new Set());
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs font-black text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear sheet search"
              >
                ×
              </button>
            )}
          </div>
          {activeKind === 'expense' && (
            <select
              value={expenseCategoryFilter}
              onChange={e => {
                setExpenseCategoryFilter(e.target.value);
                setSelectedRows(new Set());
              }}
              className="w-full sm:w-56 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs sm:text-sm font-black text-slate-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filter expense by category"
            >
              <option value="">All categories</option>
              {expenseCategoryFilterOptions.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
          {(deferredSheetSearchTerm.trim() || (activeKind === 'expense' && expenseCategoryFilter)) && (
            <div className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
              {visibleRows.length} result(s)
            </div>
          )}
        </div>
      </header>

      {!sheetFocusMode && (
        <section aria-label={`Cards for ${summaryBuildingLabel}`} className="shrink-0 px-2 sm:px-3 md:px-6 pt-2 grid grid-flow-col auto-cols-[220px] md:grid-flow-row md:auto-cols-auto md:grid-cols-3 xl:grid-cols-5 gap-2 overflow-x-auto md:overflow-visible snap-x pb-1 overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <AmountCard icon={<Wallet size={18} />} label="Opening Balance" amount={ledgerSummary.openingTotal} subtitle={cardSplit(ledgerSummary.openingCash, ledgerSummary.openingBank)} tone="amber" />
          <AmountCard icon={<CircleDollarSign size={18} />} label="Rental Income" amount={ledgerSummary.rentalIncomeTotal} subtitle={cardSplit(ledgerSummary.rentalIncomeCash, ledgerSummary.rentalIncomeBank)} tone="emerald" />
          <AmountCard icon={<CircleDollarSign size={18} />} label="Other Income" amount={ledgerSummary.otherIncomeTotal} subtitle={cardSplit(ledgerSummary.otherIncomeCash, ledgerSummary.otherIncomeBank)} tone="sky" />
          <AmountCard icon={<CircleDollarSign size={18} />} label="VAT Fees" amount={ledgerSummary.feesIncomeTotal} subtitle={cardSplit(ledgerSummary.feesIncomeCash, ledgerSummary.feesIncomeBank)} tone="violet" />
          <AmountCard icon={<Landmark size={18} />} label="Total Income" amount={ledgerSummary.incomeTotal} subtitle={cardSplit(ledgerSummary.cashIncome, ledgerSummary.bankIncome)} tone="emerald" strong />
          <AmountCard icon={<CalendarDays size={18} />} label="Rental Due" amount={rentalDueSummary.balance} subtitle={`Due ${formatAmount(rentalDueSummary.due)} | Paid ${formatAmount(rentalDueSummary.paid)}`} tone={rentalDueSummary.balance > 0 ? 'rose' : 'emerald'} strong={rentalDueSummary.balance > 0} />
          <AmountCard icon={<Banknote size={18} />} label="Expense" amount={ledgerSummary.expenseTotalDirect} subtitle={cardSplit(ledgerSummary.expenseCash, ledgerSummary.expenseBank)} tone="rose" />
          <AmountCard icon={<Wallet size={18} />} label="Owner Expense" amount={ledgerSummary.ownerExpenseTotal} subtitle={cardSplit(ledgerSummary.ownerExpenseCash, ledgerSummary.ownerExpenseBank)} tone="orange" />
          <AmountCard icon={<Banknote size={18} />} label="VAT Purchase" amount={ledgerSummary.vatPurchaseTotal} subtitle={cardSplit(ledgerSummary.vatPurchaseCash, ledgerSummary.vatPurchaseBank)} tone="violet" />
          <AmountCard icon={<Banknote size={18} />} label="Total Expense" amount={ledgerSummary.expenseTotal} subtitle={cardSplit(ledgerSummary.cashExpense, ledgerSummary.bankExpense)} tone="rose" strong />
          <AmountCard icon={<Landmark size={18} />} label="Net Balance" amount={ledgerSummary.totalNet} subtitle={cardSplit(ledgerSummary.cashBalance, ledgerSummary.bankBalance)} tone={ledgerSummary.totalNet >= 0 ? 'indigo' : 'rose'} strong wide />
        </section>
      )}

      {(futureMonthLocked || staffDeadlineLocked) && (
        <div className="mx-2 sm:mx-3 md:mx-6 mt-3 shrink-0 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800">
          <Lock size={15} />
          {futureMonthLocked ? 'Future month sheets are locked for everyone.' : 'Staff editing for this month is closed after the 10th of the next month.'}
        </div>
      )}

      <main className={`${sheetFocusMode ? 'min-h-0 px-0 sm:px-1 py-1' : 'min-h-[260px] px-1.5 sm:px-3 md:px-6 py-2.5 md:py-4'} flex-1 relative overflow-hidden`}>
        <div
          className={`pointer-events-none absolute inset-y-4 left-1 z-30 flex items-center bg-gradient-to-r from-white/85 via-white/45 to-transparent pr-9 transition-opacity duration-200 ${
            gridScrollEdges.canLeft ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!gridScrollEdges.canLeft}
        >
          <button
            type="button"
            onClick={() => scrollSheetSideways(-1)}
            disabled={!gridScrollEdges.canLeft}
            className={`pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/80 bg-white/90 text-emerald-800 shadow-[0_14px_38px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-200 hover:-translate-x-0.5 hover:bg-emerald-600 hover:text-white active:scale-95 md:h-12 md:w-12 ${
              gridScrollEdges.canLeft ? '' : 'pointer-events-none'
            }`}
            aria-label="Scroll sheet left"
            title="Scroll left"
          >
            <ChevronLeft size={21} strokeWidth={2.8} />
          </button>
        </div>
        <div
          className={`pointer-events-none absolute inset-y-4 right-1 z-30 flex items-center bg-gradient-to-l from-white/85 via-white/45 to-transparent pl-9 transition-opacity duration-200 ${
            gridScrollEdges.canRight ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!gridScrollEdges.canRight}
        >
          <button
            type="button"
            onClick={() => scrollSheetSideways(1)}
            disabled={!gridScrollEdges.canRight}
            className={`pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/80 bg-white/90 text-emerald-800 shadow-[0_14px_38px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-200 hover:translate-x-0.5 hover:bg-emerald-600 hover:text-white active:scale-95 md:h-12 md:w-12 ${
              gridScrollEdges.canRight ? '' : 'pointer-events-none'
            }`}
            aria-label="Scroll sheet right"
            title="Scroll right"
          >
            <ChevronRight size={21} strokeWidth={2.8} />
          </button>
        </div>
        <div ref={gridScrollRef} className={`${sheetFocusMode ? 'h-full min-h-0 rounded-none sm:rounded-xl' : 'h-full min-h-0 rounded-2xl md:rounded-[2rem]'} max-h-full overflow-auto scroll-smooth bg-white/75 ring-1 ring-slate-200/70 shadow-inner shadow-slate-100 overscroll-contain touch-pan-x touch-pan-y [contain:layout_paint] [-webkit-overflow-scrolling:touch]`}>
          <div
            className="grid sticky top-0 z-20 w-max min-w-full bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wide shadow-lg shadow-emerald-100/70"
            style={{ gridTemplateColumns: activeGridTemplate }}
          >
            {canPostRows && <div className="px-1.5 py-2.5" />}
            <div className="px-1.5 py-2.5 text-center">#</div>
            {sheetColumns(activeKind).map(col => <div key={col.key} className="px-2 py-2.5 truncate">{col.label}</div>)}
          </div>

          {multiBuildingSheetSections.length === 0 && visibleRows.map((row, visibleIndex) => {
            const meta = activeSheet.rowsMeta?.[String(row)];
            const result = postingByRow.get(row);
            const hasData = rowHasData(activeSheet, row);
            const posted = meta?.status === 'posted' ||
              !!meta?.postedTransactionId;
            const generatedRentalRow = isRentalDueBoardKind(activeKind) && isGeneratedRentalDueRow(activeSheet, row);
            const extraRentalRow = isRentalDueBoardKind(activeKind) && !posted && !generatedRentalRow;
            return (
              <div
                key={row}
                onContextMenu={(event) => {
                  if (!supportsManualRows(activeKind)) return;
                  event.preventDefault();
                  setSheetRowMenu({ row, x: event.clientX, y: event.clientY });
                }}
                className={`group grid min-h-9 items-stretch border-b border-slate-100 text-xs ${compactSheetUi ? '' : 'transition-colors duration-200'} ${
                  attentionRow === row ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset' : posted ? 'bg-emerald-50/70' : extraRentalRow ? 'bg-sky-50/75 hover:bg-sky-50 ring-1 ring-sky-100/80 ring-inset' : hasData ? 'bg-white hover:bg-emerald-50/30' : 'bg-white/70 hover:bg-white'
                } w-max min-w-full`}
                style={{ gridTemplateColumns: activeGridTemplate }}
              >
                {canPostRows && (
                  <div className="px-1.5 grid place-items-center">
                    <input
                      type="checkbox"
                      disabled={!result?.ok || posted || sheetLocked}
                      checked={selectedRows.has(row)}
                      onChange={e => setSelectedRows(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(row) : next.delete(row);
                        return next;
                      })}
                    />
                  </div>
                )}
                <div className="px-1.5 grid place-items-center text-[11px] font-black text-slate-400">{visibleIndex + 1}</div>
                {sheetColumns(activeKind).map(col => {
                  const cellLocked = cellLockedForUser(activeSheet, row, col);
                  const cellEditable = isSheetCellEditable(activeKind, col, posted, cellLocked);
                  return (
                    <SheetCell
                      key={`${row}-${col.key}`}
                      column={col}
                      sheet={activeSheet}
                      row={row}
                      meta={meta}
                      result={result}
                      posted={posted}
                      building={selectedBuilding}
                      kind={activeKind}
                      users={users}
                      buildings={activeKind === 'treasury' ? treasuryBuildings : buildings}
                      owners={owners}
                      vendors={vendors}
                      banks={banks}
                      expenseCategories={mergeExpenseCategories(customExpenseCategories)}
                      incomeCategories={mergeIncomeCategories(customIncomeCategories)}
                      expenseSubcategories={customExpenseSubcategories}
                      active={false}
                      selected={false}
                      selectable={false}
                      compact={compactSheetUi}
                      locked={cellLocked}
                      onFocus={() => {}}
                      onSelectCell={() => {}}
                      onNavigate={(direction) => moveActiveCell(row, col.key, direction)}
                      onChange={(value) => col.col && setCell(row, col.col, value)}
                    onSplit={() => splitRentalPaymentRow(row)}
                    onInvalidAmount={showInfo}
                      onBlockedEarlierInstallment={blockEarlierInstallmentIfNeeded}
                      onBlockedAlreadyPaidUnit={blockAlreadyPaidUnitIfNeeded}
                      onClearSelectedCells={() => {}}
                      onAddVendor={addVendorFromSheet}
                      onDeleteVendor={deleteVendorFromSheet}
                      onDeleteVendors={deleteVendorsFromSheet}
                  />
                  );
                })}
              </div>
            );
          })}
          {multiBuildingSheetSections.map((section, sectionIndex) => (
            <React.Fragment key={section.building.id}>
              <div
                className={`${sectionIndex === 0 ? '' : 'mt-4'} grid w-max min-w-full border-y border-emerald-200 bg-emerald-50/95 text-xs font-black text-emerald-900 shadow-sm`}
                style={{ gridTemplateColumns: activeGridTemplate }}
              >
                {canPostRows && <div />}
                <div className="px-1.5 py-3 text-center text-emerald-500">•</div>
                <div className="px-3 py-3" style={{ gridColumn: canPostRows ? '3 / -1' : '2 / -1' }}>
                  {section.building.name}
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] text-emerald-700">{section.rows.length} row(s)</span>
                  {section.editable && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">Editable</span>}
                </div>
              </div>
              {section.rows.length === 0 && (
                <div
                  className="grid min-h-10 w-max min-w-full items-center border-b border-slate-100 bg-white/70 text-xs font-bold text-slate-400"
                  style={{ gridTemplateColumns: activeGridTemplate }}
                >
                  {canPostRows && <div />}
                  <div className="px-1.5 text-center">-</div>
                  <div className="px-3" style={{ gridColumn: canPostRows ? '3 / -1' : '2 / -1' }}>
                    No rows for {monthLabel(activeMonth)}
                  </div>
                </div>
              )}
              {section.rows.map((row, sectionIndex) => {
                const meta = section.sheet.rowsMeta?.[String(row)];
                const result = section.editable ? postingByRow.get(row) : undefined;
                const hasData = rowHasData(section.sheet, row);
                const posted = meta?.status === 'posted' || !!meta?.postedTransactionId;
                const generatedRentalRow = isRentalDueBoardKind(activeKind) && isGeneratedRentalDueRow(section.sheet, row);
                const extraRentalRow = isRentalDueBoardKind(activeKind) && !posted && !generatedRentalRow;
                return (
                  <div
                    key={`${section.building.id}-${row}`}
                    onContextMenu={(event) => {
                      if (!section.editable || !supportsManualRows(activeKind)) return;
                      event.preventDefault();
                      setSheetRowMenu({ row, x: event.clientX, y: event.clientY });
                    }}
                    className={`group grid min-h-9 items-stretch border-b border-slate-100 text-xs ${compactSheetUi ? '' : 'transition-colors duration-200'} ${
                      section.editable && attentionRow === row ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset' : posted ? 'bg-emerald-50/55' : extraRentalRow ? 'bg-sky-50/75 hover:bg-sky-50 ring-1 ring-sky-100/80 ring-inset' : hasData ? 'bg-white hover:bg-emerald-50/20' : 'bg-white/70 hover:bg-white'
                    } w-max min-w-full`}
                    style={{ gridTemplateColumns: activeGridTemplate }}
                  >
                    {canPostRows && (
                      <div className="px-1.5 grid place-items-center">
                        {section.editable && (
                          <input
                            type="checkbox"
                            disabled={!result?.ok || posted || sheetLocked}
                            checked={selectedRows.has(row)}
                            onChange={e => setSelectedRows(prev => {
                              const next = new Set(prev);
                              e.target.checked ? next.add(row) : next.delete(row);
                              return next;
                            })}
                          />
                        )}
                      </div>
                    )}
                    <div className="px-1.5 grid place-items-center text-[11px] font-black text-slate-400">{sectionIndex + 1}</div>
                    {sheetColumns(activeKind).map(col => {
                      const cellLocked = section.editable ? cellLockedForUser(section.sheet, row, col) : true;
                      return (
                        <SheetCell
                          key={`${section.building.id}-${row}-${col.key}`}
                          column={col}
                          sheet={section.sheet}
                          row={row}
                          meta={meta}
                          result={result}
                          posted={posted}
                          building={section.building}
                          kind={activeKind}
                          users={users}
                          buildings={activeKind === 'treasury' ? treasuryBuildings : buildings}
                          owners={owners}
                          vendors={vendors}
                          banks={banks}
                          expenseCategories={mergeExpenseCategories(customExpenseCategories)}
                          incomeCategories={mergeIncomeCategories(customIncomeCategories)}
                          expenseSubcategories={customExpenseSubcategories}
                          active={false}
                          selected={false}
                          selectable={false}
                          compact={compactSheetUi}
                          locked={cellLocked}
                          onFocus={() => {}}
                          onSelectCell={() => {}}
                          onNavigate={section.editable ? (direction) => moveActiveCell(row, col.key, direction) : () => {}}
                          onChange={section.editable ? (value) => col.col && setCell(row, col.col, value) : () => {}}
                          onSplit={section.editable ? () => splitRentalPaymentRow(row) : undefined}
                          onInvalidAmount={showInfo}
                          onBlockedEarlierInstallment={section.editable ? blockEarlierInstallmentIfNeeded : undefined}
                          onBlockedAlreadyPaidUnit={section.editable ? blockAlreadyPaidUnitIfNeeded : undefined}
                          onClearSelectedCells={() => {}}
                          onAddVendor={section.editable ? addVendorFromSheet : undefined}
                          onDeleteVendor={section.editable ? deleteVendorFromSheet : undefined}
                          onDeleteVendors={section.editable ? deleteVendorsFromSheet : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </main>

      {sheetRowMenu && supportsManualRows(activeKind) && activeSheet && (() => {
        const row = sheetRowMenu.row;
        const meta = activeSheet.rowsMeta?.[String(row)];
        const posted = meta?.status === 'posted' ||
          !!meta?.postedTransactionId;
        const hasData = rowHasData(activeSheet, row);
        return (
          <div
            className="fixed z-[80] min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs font-black text-slate-700 shadow-2xl shadow-slate-300/60"
            style={{
              left: Math.min(sheetRowMenu.x, Math.max(8, viewportWidth - 190)),
              top: sheetRowMenu.y,
            }}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={posted}
              onClick={() => removeManualSheetRow(row)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
	              <span>{posted ? 'Posted row locked' : hasData ? 'Remove row' : 'Reduce rows'}</span>
              <span className="text-[10px] text-slate-400">#{visibleRows.indexOf(row) + 1}</span>
            </button>
          </div>
        );
      })()}

      {canPostRows && selectedRows.size > 0 && (
        <footer className="px-4 md:px-6 py-3 border-t border-emerald-100 bg-white/88 backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-600">
              Posting: {selectedValidCount} valid row(s) selected.
            </div>
          </div>
          <button
            onClick={postSelectedRows}
            disabled={selectedValidCount === 0 || sheetLocked}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            <CircleDollarSign size={18} /> Post selected
          </button>
        </footer>
      )}
    </div>
  );
};

interface SheetCellProps {
  column: SheetColumn;
  sheet: AmlakWorksheet;
  row: number;
  meta?: any;
  result?: any;
  posted: boolean;
  building: Building;
  kind: AmlakSheetKind;
  users: User[];
  buildings: Building[];
  owners: Array<{ id: string; name: string }>;
  vendors: any[];
  banks: Bank[];
  expenseCategories: string[];
  incomeCategories: string[];
  expenseSubcategories: Record<string, string[]>;
  active: boolean;
  selected: boolean;
  selectable: boolean;
  compact: boolean;
  locked: boolean;
  onFocus: () => void;
  onSelectCell: (event: React.MouseEvent<HTMLElement>) => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onChange: (value: string) => void;
  onSplit?: () => void;
  onInvalidAmount?: (message: string) => void;
  onBlockedEarlierInstallment?: (sheet: AmlakWorksheet, row: number, amount: number) => boolean;
  onBlockedAlreadyPaidUnit?: (sheet: AmlakWorksheet, row: number, unitValue: string) => boolean;
  onClearSelectedCells?: () => void;
  onAddVendor?: (name: string, vatNumber?: string) => Promise<any>;
  onDeleteVendor?: (vendorId: string) => Promise<void>;
  onDeleteVendors?: (vendorIds: string[]) => Promise<void>;
}

const inputClass = 'w-full min-w-0 min-h-7 rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] font-semibold text-slate-800 outline-none transition-all duration-200 ease-out focus:min-h-8 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:shadow-sm disabled:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50/40';

const SheetCellBase: React.FC<SheetCellProps> = ({
  column,
  sheet,
  row,
  meta,
  result,
  posted,
  building,
  kind,
  users,
  buildings,
  owners,
  vendors,
  banks,
  expenseCategories,
  incomeCategories,
  expenseSubcategories,
  active,
  selected,
  selectable,
  compact,
  locked,
  onFocus,
  onSelectCell,
  onNavigate,
  onChange,
  onSplit,
  onInvalidAmount,
  onBlockedEarlierInstallment,
  onBlockedAlreadyPaidUnit,
  onClearSelectedCells,
  onAddVendor,
  onDeleteVendor,
  onDeleteVendors,
}) => {
  const value = cellRaw(sheet, column.col, row);
  const [draftValue, setDraftValue] = useState(value);
  const [vendorDeleteOpen, setVendorDeleteOpen] = useState(false);
  const [vendorDeleteIds, setVendorDeleteIds] = useState<string[]>([]);
  const editingRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const categoryValue = cellRaw(sheet, sheetColumns(kind).find(c => c.key === 'category')?.col, row);
  const disabled = posted || locked || column.key === 'dueAmount' || column.key === 'dueDate';
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swiping, setSwiping] = useState(false);
  useEffect(() => {
    if (!editingRef.current) {
      setDraftValue(value);
    }
  }, [value]);
  useEffect(() => () => {
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
  }, []);
  const commitDraft = (nextValue: string, immediate = false) => {
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
    const wait = compact ? 90 : 25;
    if (immediate || wait <= 0) {
      onChange(nextValue);
      return;
    }
    commitTimerRef.current = window.setTimeout(() => {
      onChange(nextValue);
      commitTimerRef.current = null;
    }, wait);
  };
  const handleControlChange = (nextValue: string, immediate = false) => {
    setDraftValue(nextValue);
    commitDraft(nextValue, immediate);
  };
  const handleAmountChange = (nextValue: string) => {
    setDraftValue(nextValue);
    if (isRentalDueBoardKind(kind) && column.key === 'amount') {
      const amount = parseSheetAmount(nextValue);
      if (onBlockedEarlierInstallment?.(sheet, row, amount)) {
        if (commitTimerRef.current) {
          window.clearTimeout(commitTimerRef.current);
          commitTimerRef.current = null;
        }
        setDraftValue(value);
        return;
      }
      const max = maxRentalPaymentForRow(sheet, row);
      if (amount > max + 0.001) {
        if (commitTimerRef.current) {
          window.clearTimeout(commitTimerRef.current);
          commitTimerRef.current = null;
        }
        onInvalidAmount?.(rentalPaymentLimitMessage(sheet, row, amount));
        setDraftValue(value);
        return;
      }
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      onChange(nextValue);
      return;
    }
    commitDraft(nextValue);
  };
  const handleUnitChange = (nextValue: string) => {
    if (isRentalDueBoardKind(kind) && onBlockedAlreadyPaidUnit?.(sheet, row, nextValue)) {
      setDraftValue(value);
      return;
    }
    handleControlChange(nextValue, true);
  };
  const handleUnitSearchChange = (nextValue: string) => {
    setDraftValue(nextValue);
    const matchesUnit = (building.units || []).some(unit => unit.name === nextValue);
    if (!nextValue.trim() || matchesUnit) handleUnitChange(nextValue);
  };
  const flushUnitDraft = () => {
    editingRef.current = false;
    if (draftValue !== value) handleUnitChange(draftValue);
  };
  const flushDraft = () => {
    editingRef.current = false;
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (draftValue !== value) onChange(draftValue);
  };
  const flushActiveControl = () => {
    if (column.key === 'unit') {
      flushUnitDraft();
      return;
    }
    flushDraft();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const targetTag = target.tagName.toUpperCase();
    if (e.key === 'Enter' && !e.shiftKey && target !== e.currentTarget && targetTag !== 'TEXTAREA') {
      e.preventDefault();
      e.stopPropagation();
      flushActiveControl();
      target.blur();
      if (!compact) onNavigate('down');
      return;
    }
    if (compact) return;
    if (selected && (e.key === 'Delete' || e.key === 'Backspace') && e.target === e.currentTarget) {
      e.preventDefault();
      onClearSelectedCells?.();
      return;
    }
    const keyDirection: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: e.shiftKey ? 'up' : 'down',
      Tab: e.shiftKey ? 'left' : 'right',
    };
    const direction = keyDirection[e.key];
    if (!direction) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(direction);
  };
  const handleSwipe = (x: number, y: number) => {
    if (compact) {
      touchStartRef.current = null;
      return;
    }
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) return;
    setSwiping(true);
    window.setTimeout(() => setSwiping(false), 180);
    onNavigate(absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  const cellWrapperProps = {
    tabIndex: 0,
    'data-amlak-cell-target': `${row}-${column.key}`,
    onFocus,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      onFocus();
      if (selectable) onSelectCell(event);
    },
    onKeyDownCapture: handleKeyDown,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (e.buttons === 1) onFocus();
    },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      if (compact) return;
      const touch = e.touches[0];
      if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => {
      if (compact) return;
      const touch = e.changedTouches[0];
      if (touch) handleSwipe(touch.clientX, touch.clientY);
    },
  };
  const activeClass = active
    ? 'relative z-10 bg-emerald-50/95 shadow-[inset_0_0_0_2px_#22c55e,inset_0_0_0_4px_rgba(220,252,231,0.95),0_8px_18px_rgba(34,197,94,0.14)]'
    : selected
      ? 'relative z-10 bg-sky-50/95 shadow-[inset_0_0_0_2px_#0ea5e9,inset_0_0_0_4px_rgba(224,242,254,0.95)]'
    : compact ? '' : 'group-hover:bg-emerald-50/20';
  const cellMotionClass = compact ? '' : 'transition-all duration-200 ease-out';
  const cellClass = `px-1 h-full min-w-0 flex items-center outline-none touch-pan-x touch-pan-y ${cellMotionClass} ${activeClass} ${swiping ? 'bg-emerald-100/90 scale-[0.992]' : ''}`;
  const controlProps = {
    'data-amlak-cell': `${row}-${column.key}`,
    onFocus: () => {
      editingRef.current = true;
      onFocus();
    },
    onBlur: flushDraft,
  };
  const selectControlProps = {
    ...controlProps,
    onClick: (event: React.MouseEvent<HTMLSelectElement>) => event.stopPropagation(),
    onMouseDown: (event: React.MouseEvent<HTMLSelectElement>) => event.stopPropagation(),
    onPointerDown: (event: React.PointerEvent<HTMLSelectElement>) => event.stopPropagation(),
    onTouchStart: (event: React.TouchEvent<HTMLSelectElement>) => event.stopPropagation(),
  };
  if (column.key === 'enteredBy') {
    return <div {...cellWrapperProps} className={`px-1.5 h-full flex items-center text-[11px] font-black text-slate-500 outline-none touch-pan-x touch-pan-y transition-all duration-200 ease-out ${activeClass} ${swiping ? 'bg-emerald-100/90 scale-[0.992]' : ''}`}>{meta?.enteredByName || '-'}</div>;
  }
  if (column.key === 'status') {
    const error = !posted && result && !result.ok && rowHasData(sheet, row) ? result.errors.join(', ') : '';
    return (
      <div {...cellWrapperProps} className={`px-1.5 h-full flex items-center outline-none touch-pan-x touch-pan-y transition-all duration-200 ease-out ${activeClass} ${swiping ? 'bg-emerald-100/90 scale-[0.992]' : ''}`}>
        <span title={error} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
          posted ? 'bg-emerald-100 text-emerald-700' : error ? 'bg-amber-100 text-amber-700' : meta ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
        }`}>
          {posted && <CheckCircle size={12} />}
          {posted ? 'Posted' : error ? 'Fix' : meta ? 'Draft' : 'Empty'}
        </span>
      </div>
    );
  }
  if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') {
    const dateDisplayValue = editingRef.current ? draftValue : formatCompactSheetDate(value);
    const handleDateFocus = () => {
      editingRef.current = true;
      setDraftValue(formatCompactSheetDate(value));
      onFocus();
    };
  const handleDateChange = (nextValue: string) => {
      setDraftValue(nextValue);
      if (!nextValue.trim()) {
        if (value) onChange('');
        return;
      }
      const normalized = normalizeCompactSheetDate(nextValue);
      if (normalized !== null && normalized !== value) onChange(normalized);
    };
    const handleDateBlur = () => {
      editingRef.current = false;
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      const normalized = normalizeCompactSheetDate(draftValue);
      if (normalized !== null) {
        setDraftValue(normalized);
        if (normalized !== value) onChange(normalized);
      } else {
        setDraftValue(value);
      }
    };
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input
          data-amlak-cell={`${row}-${column.key}`}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          pattern="\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}"
          maxLength={10}
          value={dateDisplayValue}
          onFocus={handleDateFocus}
          onBlur={handleDateBlur}
          onChange={e => handleDateChange(e.target.value)}
          className={`${inputClass} border-slate-200 bg-white px-0.5 text-center text-[11px] font-bold tabular-nums`}
          placeholder="dd-mm-yy"
          title={`${column.label}: dd-mm-yy`}
        />
      </div>
    );
  }
  if (column.key === 'unit') {
    const listId = `unit-options-${kind}-${row}`;
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input
          {...controlProps}
          disabled={disabled}
          list={listId}
          value={draftValue}
          onChange={e => handleUnitSearchChange(e.target.value)}
          onBlur={flushUnitDraft}
          className={inputClass}
          placeholder="Search unit"
        />
        <datalist id={listId}>
          {(building.units || []).map(unit => <option key={unit.name} value={unit.name} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'owner') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value, true)} className={inputClass}>
          <option value="">Select owner</option>
          {owners.map(owner => <option key={owner.id} value={owner.name}>{owner.name}</option>)}
        </select>
      </div>
    );
  }
  if (column.key === 'category') {
    const categories = kind === 'otherIncome' ? incomeCategories : expenseCategories;
    const listId = `category-options-${kind}-${row}`;
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input {...controlProps} disabled={disabled} list={listId} value={draftValue} onChange={e => handleControlChange(e.target.value)} className={inputClass} placeholder="Search category" />
        <datalist id={listId}>
          {categories.map(category => <option key={category} value={category} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'subCategory') {
    const categoryNorm = String(categoryValue || '').trim().toLowerCase();
    const staffOptions = users
      .filter((u: any) => !u.isOwner && String(u.role).toUpperCase() !== 'OWNER' && String(u.role).toUpperCase() !== 'ADMIN')
      .map(user => user.name)
      .filter(Boolean);
    const leasedBuildingOptions = buildings
      .filter((b: any) => b.lease?.isLeased)
      .map((b: any) => `${b.name}${b.lease?.landlordName ? ` - ${b.lease.landlordName}` : ''}`);
    const vendorOptions = vendors.map(vendor => vendor.nameEn || vendor.name).filter(Boolean);
    const options =
      categoryNorm === String(ExpenseCategory.SALARY).toLowerCase() || categoryNorm === 'salary' || categoryNorm === String(ExpenseCategory.BORROWING).toLowerCase() || categoryNorm === 'borrowing'
        ? staffOptions
        : categoryNorm === String(ExpenseCategory.PROPERTY_RENT).toLowerCase() || categoryNorm === 'property rent'
          ? leasedBuildingOptions
          : categoryNorm === String(ExpenseCategory.MAINTENANCE).toLowerCase() || categoryNorm === String(ExpenseCategory.VENDOR_PAYMENT).toLowerCase()
            ? vendorOptions
            : getExpenseSubcategories(categoryValue, expenseSubcategories);
    const placeholder =
      categoryNorm === String(ExpenseCategory.SALARY).toLowerCase() || categoryNorm === 'salary' ? 'Search staff name' :
      categoryNorm === String(ExpenseCategory.BORROWING).toLowerCase() || categoryNorm === 'borrowing' ? 'Search borrower' :
      categoryNorm === String(ExpenseCategory.PROPERTY_RENT).toLowerCase() || categoryNorm === 'property rent' ? 'Search leased property' :
      categoryNorm === String(ExpenseCategory.MAINTENANCE).toLowerCase() || categoryNorm === String(ExpenseCategory.VENDOR_PAYMENT).toLowerCase() ? 'Search vendor' :
      categoryValue ? 'Target / details' : 'Choose category first';
    const listId = `subcategory-options-${kind}-${row}`;
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input {...controlProps} disabled={disabled || !categoryValue} list={listId} value={draftValue} onChange={e => handleControlChange(e.target.value)} className={inputClass} placeholder={placeholder} />
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'related') {
    const categoryNorm = normRowKey(categoryValue);
    const isSalaryRow = kind === 'expense' && (categoryNorm === normRowKey(ExpenseCategory.SALARY) || categoryNorm === 'salary');
    if (kind === 'expense') {
      return (
        <div {...cellWrapperProps} className={cellClass}>
          <input
            {...controlProps}
            disabled={disabled || !isSalaryRow}
            type="month"
            value={draftValue}
            onChange={e => handleControlChange(e.target.value, true)}
            className={`${inputClass} tabular-nums ${!isSalaryRow ? 'text-slate-300' : ''}`}
            placeholder="Month"
          />
        </div>
      );
    }
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value, true)} className={inputClass}>
          <option value="">Optional related</option>
          <optgroup label="Staff">
            {users.filter((u: any) => !u.isOwner && String(u.role).toUpperCase() !== 'OWNER').map(user => <option key={user.id} value={user.name}>{user.name}</option>)}
          </optgroup>
          <optgroup label="Buildings">
            <option value={building.name}>{building.name}</option>
          </optgroup>
        </select>
      </div>
    );
  }
  if (column.key === 'fromType' || column.key === 'toType') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value, true)} className={inputClass}>
          <option value="">Type</option>
          <option value="BUILDING">Building</option>
          <option value="HEAD_OFFICE">Head Office</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>
    );
  }
  if (column.key === 'fromAccount' || column.key === 'toAccount') {
    const typeCol = column.key === 'fromAccount' ? 'B' : 'D';
    const accountType = String(cellRaw(sheet, typeCol, row) || '').toUpperCase();
    const listId = `${column.key}-options-${kind}-${row}`;
    const options = accountType === 'OWNER'
      ? owners.map(owner => owner.name)
      : buildings.map(treasuryBuildingOptionLabel).filter(Boolean);
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input
          {...controlProps}
          disabled={disabled || !accountType || accountType === 'HEAD_OFFICE'}
          list={listId}
          value={accountType === 'HEAD_OFFICE' ? 'Head Office' : draftValue}
          onChange={e => handleControlChange(e.target.value)}
          className={`${inputClass} ${accountType === 'HEAD_OFFICE' ? 'text-slate-400' : ''}`}
          placeholder={accountType === 'OWNER' ? 'Search owner' : accountType === 'BUILDING' ? 'Search building' : 'Choose type first'}
        />
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'fromBank' || column.key === 'toBank') {
    const bankOptions = Array.from(new Set([
      ...banks.map(bank => String(bank.name || '').trim()).filter(Boolean),
      String(draftValue || '').trim(),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value, true)} className={inputClass}>
          <option value="">{column.key === 'fromBank' ? 'Source bank' : 'Destination bank'}</option>
          {bankOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }
  if (column.key === 'purpose') {
    const listId = `purpose-options-${kind}-${row}`;
    const options = ['Building Operations', 'Maintenance Fund', 'Emergency Reserve', 'Bank Deposit', 'Loan/Borrowing', 'Revenue Collection', 'Inter-Building Transfer', 'Inter-Book Adjustment', 'Other'];
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <input {...controlProps} disabled={disabled} list={listId} value={draftValue} onChange={e => handleControlChange(e.target.value)} className={inputClass} placeholder="Purpose" />
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'vendor') {
    const addVendorAction = '__amlak_add_vendor__';
    const deleteVendorAction = '__amlak_delete_vendor__';
    const vendorOptions = mergeVendorOptions(vendors);
    const deletableVendorOptions = vendorOptions.filter((vendor: any) => vendor?.id);
    const selectedVendor = findVendorByValue(vendorOptions, draftValue);
    const selectValue = selectedVendor ? vendorOptionValue(selectedVendor) : draftValue;
    const handleVendorSelect = async (nextValue: string) => {
      if (nextValue === addVendorAction) {
        const name = window.prompt('Vendor name', selectedVendor ? vendorDisplayName(selectedVendor) : '');
        if (!name?.trim()) {
          setDraftValue(value);
          return;
        }
        const vatNumber = window.prompt('Vendor VAT number (optional)', selectedVendor?.vatNumber || selectedVendor?.vatNo || '') || '';
        try {
          const saved = await onAddVendor?.(name, vatNumber);
          const savedValue = saved ? vendorOptionValue(saved) : name;
          setDraftValue(savedValue);
          onChange(savedValue);
        } catch (error: any) {
          window.alert(error?.message || 'Could not add vendor.');
          setDraftValue(value);
        }
        return;
      }
      if (nextValue === deleteVendorAction) {
        const vendorToDelete = findVendorByValue(deletableVendorOptions, draftValue || value);
        setVendorDeleteIds(vendorToDelete?.id ? [vendorToDelete.id] : []);
        setVendorDeleteOpen(true);
        setDraftValue(value);
        return;
      }
      handleControlChange(nextValue, true);
    };
    const toggleVendorDeleteId = (vendorId: string) => {
      setVendorDeleteIds(previous => previous.includes(vendorId) ? previous.filter(id => id !== vendorId) : [...previous, vendorId]);
    };
    const confirmVendorDelete = async () => {
      const ids = vendorDeleteIds.filter(id => deletableVendorOptions.some((vendor: any) => vendor.id === id));
      if (!ids.length) {
        window.alert('Select at least one vendor to delete.');
        return;
      }
      if (!window.confirm(`Delete ${ids.length} vendor${ids.length === 1 ? '' : 's'} from future sheets?`)) return;
      try {
        if (onDeleteVendors) {
          await onDeleteVendors(ids);
        } else {
          await Promise.all(ids.map(id => onDeleteVendor?.(id)));
        }
        const currentVendor = findVendorByValue(vendorOptions, draftValue || value);
        if (currentVendor?.id && ids.includes(currentVendor.id)) {
          setDraftValue('');
          onChange('');
        }
        setVendorDeleteOpen(false);
        setVendorDeleteIds([]);
      } catch (error: any) {
        window.alert(error?.message || 'Could not delete vendors.');
      }
    };
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={selectValue} onChange={e => void handleVendorSelect(e.target.value)} className={inputClass}>
          <option value="">Select vendor</option>
          {onAddVendor && <option value={addVendorAction}>+ Add new vendor</option>}
          {(onDeleteVendor || onDeleteVendors) && <option value={deleteVendorAction}>Delete vendors...</option>}
          {(onAddVendor || onDeleteVendor || onDeleteVendors) && <option disabled value="__vendor_separator__">────────────</option>}
          {draftValue && !selectedVendor && <option value={draftValue}>{draftValue}</option>}
          {vendorOptions.map(vendor => (
            <option key={vendorOptionValue(vendor)} value={vendorOptionValue(vendor)}>
              {vendorDisplayName(vendor)}
            </option>
          ))}
        </select>
        {vendorDeleteOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 px-4"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setVendorDeleteOpen(false);
            }}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-black text-slate-900">Delete vendors</div>
                <div className="text-[11px] font-bold text-slate-500">Select one or more vendors to remove from future sheets.</div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {deletableVendorOptions.length ? deletableVendorOptions.map((vendor: any) => {
                  const vendorId = String(vendor.id);
                  const checked = vendorDeleteIds.includes(vendorId);
                  return (
                    <label key={vendorId} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold ${checked ? 'bg-rose-50 text-rose-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVendorDeleteId(vendorId)}
                        className="h-4 w-4 rounded border-rose-300 text-rose-600"
                      />
                      <span className="min-w-0 flex-1 truncate">{vendorDisplayName(vendor)}</span>
                      {(vendor.vatNumber || vendor.vatNo) && <span className="shrink-0 text-[10px] text-slate-400">{vendor.vatNumber || vendor.vatNo}</span>}
                    </label>
                  );
                }) : (
                  <div className="px-3 py-8 text-center text-xs font-bold text-slate-400">No saved vendors to delete.</div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = deletableVendorOptions.map((vendor: any) => String(vendor.id));
                    setVendorDeleteIds(vendorDeleteIds.length === allIds.length ? [] : allIds);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                >
                  {vendorDeleteIds.length === deletableVendorOptions.length ? 'Clear all' : 'Select all'}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVendorDeleteOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmVendorDelete()}
                    disabled={!vendorDeleteIds.length}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white disabled:opacity-45"
                  >
                    Delete selected
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  if (column.key === 'paymentMethod') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...selectControlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value, true)} className={inputClass}>
          <option value="">Method</option>
          <option value="CASH">Cash</option>
          <option value="BANK">Bank</option>
          <option value="CHEQUE">Cheque</option>
        </select>
      </div>
    );
  }
  if (column.key === 'balance') {
    const { due, paid, balance } = rentalBalanceState(sheet, row);
    const canSplit = !!onSplit && !disabled && due > 0 && paid > 0 && balance > 0 && isRentalDueBoardKind(kind);
    return (
      <div {...cellWrapperProps} className={`${cellClass} justify-end gap-1`}>
        <span className={`min-w-0 flex-1 rounded-lg px-1.5 py-1 text-right text-xs font-black tabular-nums transition-colors duration-200 ${
          balance > 0 ? 'bg-amber-50 text-amber-700' : due > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'
        }`}>
          {balance ? formatAmount(balance) : due > 0 ? 'Paid' : '-'}
        </span>
        {canSplit && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSplit?.();
            }}
            className="shrink-0 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black text-white active:scale-95"
            title="Split remaining amount to another payment method"
          >
            Split
          </button>
        )}
      </div>
    );
  }
  if (column.key === 'amount' || column.key === 'extra' || column.key === 'discount' || column.key === 'dueAmount') {
    return <div {...cellWrapperProps} className={cellClass}><input {...controlProps} disabled={disabled} type="number" inputMode="decimal" value={draftValue} onChange={e => handleAmountChange(e.target.value)} className={`${inputClass} text-right tabular-nums`} placeholder="0" /></div>;
  }
  if (column.key === 'details' || column.key === 'notes') {
    const rows = Math.min(4, Math.max(1, String(draftValue || '').split('\n').length, Math.ceil(String(draftValue || '').length / 42)));
    return (
      <div {...cellWrapperProps} className={`${cellClass} py-1`}>
        <textarea
          {...controlProps}
          disabled={disabled}
          value={draftValue}
          rows={rows}
          onChange={e => handleControlChange(e.target.value)}
          className={`${inputClass} resize-none leading-snug overflow-hidden`}
          placeholder={column.key === 'notes' ? 'Type notes' : 'Type details'}
        />
      </div>
    );
  }
  return <div {...cellWrapperProps} className={cellClass}><input {...controlProps} disabled={disabled} value={draftValue} onChange={e => handleControlChange(e.target.value)} className={inputClass} placeholder="Type details" /></div>;
};

function metaSignature(meta: any): string {
  if (!meta) return '';
  return [
    meta.status || '',
    meta.enteredByName || '',
    meta.postedTransactionId || '',
    meta.error || '',
    meta.generatedDueKey || '',
    meta.generatedDueSuppressedKey || '',
    meta.manualAddedRow ? 'manual-row' : '',
    meta.splitPaymentChild ? 'split-child' : '',
    meta.splitParentRow || '',
    meta.splitParentDueDate || '',
    meta.splitParentUnit || '',
  ].join('|');
}

function resultSignature(result: any): string {
  if (!result) return '';
  return [
    result.ok ? '1' : '0',
    result.alreadyPostedTransactionId || '',
    Array.isArray(result.errors) ? result.errors.join(',') : '',
  ].join('|');
}

function bankOptionsSignature(banks: Bank[]): string {
  return banks.map(bank => String(bank.name || '')).filter(Boolean).sort().join('|');
}

function buildingOptionsSignature(buildings: Building[]): string {
  return buildings.map(treasuryBuildingOptionLabel).filter(Boolean).sort().join('|');
}

function vendorDisplayName(vendor: any): string {
  return normalizeAmlakTextValue(String(vendor?.nameEn || vendor?.name || '')).trim();
}

function vendorOptionValue(vendor: any): string {
  return String(vendor?.id || vendorDisplayName(vendor) || '').trim();
}

function findVendorByValue(vendors: any[], value: string): any | null {
  const key = normRowKey(value);
  if (!key) return null;
  return vendors.find((vendor: any) => [
    vendor?.id,
    vendor?.nameEn,
    vendor?.name,
    vendorDisplayName(vendor),
  ].some(candidate => normRowKey(candidate) === key)) || null;
}

function mergeVendorOptions(vendors: any[]): any[] {
  const byKey = new Map<string, any>();
  vendors
    .filter((vendor: any) => vendor && vendor.status !== 'Inactive')
    .forEach((vendor: any) => {
      const key = normRowKey(vendor?.id || vendorDisplayName(vendor));
      if (key && !byKey.has(key)) byKey.set(key, vendor);
    });
  return Array.from(byKey.values()).sort((a, b) => vendorDisplayName(a).localeCompare(vendorDisplayName(b), undefined, { sensitivity: 'base' }));
}

function vendorOptionsSignature(vendors: any[]): string {
  return mergeVendorOptions(vendors).map((vendor: any) => [
    vendorOptionValue(vendor),
    vendorDisplayName(vendor),
    vendor?.vatNumber || vendor?.vatNo || '',
  ].join('~')).join('|');
}

function sheetCellValueSignature(sheet: AmlakWorksheet, kind: AmlakSheetKind, column: SheetColumn, row: number): string {
  if (column.key === 'balance') {
    return `${cellRaw(sheet, 'D', row)}|${cellRaw(sheet, 'E', row)}|${splitChildPaymentSignature(sheet, row)}`;
  }
  if (column.key === 'status') {
    return rowDataSignature(sheet, row);
  }
  if (column.key === 'subCategory') {
    const categoryCol = sheetColumns(kind).find(c => c.key === 'category')?.col;
    return `${cellRaw(sheet, column.col, row)}|${cellRaw(sheet, categoryCol, row)}`;
  }
  if (column.key === 'fromAccount') {
    return `${cellRaw(sheet, column.col, row)}|${cellRaw(sheet, 'B', row)}`;
  }
  if (column.key === 'toAccount') {
    return `${cellRaw(sheet, column.col, row)}|${cellRaw(sheet, 'D', row)}`;
  }
  return cellRaw(sheet, column.col, row);
}

const SheetCell = React.memo(SheetCellBase, (prev, next) => {
  if (prev.row !== next.row) return false;
  if (prev.column.key !== next.column.key || prev.column.col !== next.column.col) return false;
  if (prev.kind !== next.kind) return false;
  if (prev.posted !== next.posted || prev.active !== next.active || prev.selected !== next.selected || prev.selectable !== next.selectable || prev.compact !== next.compact || prev.locked !== next.locked) return false;
  if (!!prev.onSplit !== !!next.onSplit) return false;
  if (prev.building.id !== next.building.id) return false;
  if ((prev.building.units || []).length !== (next.building.units || []).length) return false;
  if ((prev.column.key === 'fromBank' || prev.column.key === 'toBank') && bankOptionsSignature(prev.banks) !== bankOptionsSignature(next.banks)) return false;
  if ((prev.column.key === 'fromAccount' || prev.column.key === 'toAccount') && buildingOptionsSignature(prev.buildings) !== buildingOptionsSignature(next.buildings)) return false;
  if (prev.column.key === 'vendor' && vendorOptionsSignature(prev.vendors) !== vendorOptionsSignature(next.vendors)) return false;
  if (prev.column.key === 'vendor' && (!!prev.onAddVendor !== !!next.onAddVendor || !!prev.onDeleteVendor !== !!next.onDeleteVendor || !!prev.onDeleteVendors !== !!next.onDeleteVendors)) return false;
  if (metaSignature(prev.meta) !== metaSignature(next.meta)) return false;
  if (resultSignature(prev.result) !== resultSignature(next.result)) return false;
  return sheetCellValueSignature(prev.sheet, prev.kind, prev.column, prev.row) ===
    sheetCellValueSignature(next.sheet, next.kind, next.column, next.row);
});

type AmountTone = 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky' | 'violet' | 'orange';

const amountToneClasses: Record<AmountTone, { card: string; icon: string; label: string; strong: string }> = {
  emerald: { card: 'border-emerald-100 bg-white/90 text-emerald-900', icon: 'bg-emerald-50 text-emerald-700', label: 'text-emerald-600', strong: 'from-emerald-600 to-green-600 border-emerald-200 shadow-emerald-100' },
  amber: { card: 'border-amber-100 bg-white/90 text-amber-900', icon: 'bg-amber-50 text-amber-700', label: 'text-amber-600', strong: 'from-amber-500 to-yellow-500 border-amber-200 shadow-amber-100' },
  rose: { card: 'border-rose-100 bg-white/90 text-rose-900', icon: 'bg-rose-50 text-rose-700', label: 'text-rose-600', strong: 'from-rose-600 to-red-600 border-rose-200 shadow-rose-100' },
  indigo: { card: 'border-indigo-100 bg-white/90 text-indigo-900', icon: 'bg-indigo-50 text-indigo-700', label: 'text-indigo-600', strong: 'from-indigo-600 to-blue-600 border-indigo-200 shadow-indigo-100' },
  sky: { card: 'border-sky-100 bg-white/90 text-sky-900', icon: 'bg-sky-50 text-sky-700', label: 'text-sky-600', strong: 'from-sky-600 to-cyan-600 border-sky-200 shadow-sky-100' },
  violet: { card: 'border-violet-100 bg-white/90 text-violet-900', icon: 'bg-violet-50 text-violet-700', label: 'text-violet-600', strong: 'from-violet-600 to-purple-600 border-violet-200 shadow-violet-100' },
  orange: { card: 'border-orange-100 bg-white/90 text-orange-900', icon: 'bg-orange-50 text-orange-700', label: 'text-orange-600', strong: 'from-orange-500 to-amber-500 border-orange-200 shadow-orange-100' },
};

const AmountCard: React.FC<{ icon: React.ReactNode; label: string; amount: number; subtitle?: string; strong?: boolean; tone?: AmountTone; wide?: boolean }> = ({ icon, label, amount, subtitle, strong, tone = 'emerald', wide }) => {
  const classes = amountToneClasses[tone];
  return (
  <div className={`rounded-xl border p-2.5 shadow-sm min-w-0 snap-start ${wide ? 'md:col-span-3 xl:col-span-5' : ''} ${
    strong
      ? `bg-gradient-to-br text-white ${classes.strong}`
      : classes.card
  }`}>
    <div className={`flex items-center gap-2 ${wide ? 'justify-center' : 'justify-start'}`}>
      <div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${strong ? 'bg-white/20' : classes.icon}`}>
        {icon}
      </div>
      <div className={`${wide ? 'text-center flex-none' : 'text-left flex-1'} min-w-0`}>
        <div className={`text-[9px] font-black uppercase tracking-wide truncate ${strong ? 'text-white/90' : classes.label}`}>{label}</div>
        <div className="text-[15px] sm:text-base font-black tabular-nums leading-tight whitespace-nowrap">{formatAmount(amount)}</div>
        {subtitle && <div className={`mt-0.5 text-[9px] font-bold truncate ${strong ? 'text-white/85' : 'text-slate-500'}`}>{subtitle}</div>}
      </div>
    </div>
  </div>
  );
};

export default AmlakSheets;

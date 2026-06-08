import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle, CircleDollarSign, Download, Eye, FileSpreadsheet, Home, Landmark, Loader2, Lock, Maximize2, Minimize2, Plus, Save, Search, UsersRound, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AmlakSheetKind,
  AmlakWorkbook,
  AmlakWorksheet,
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
  getBuildings,
  getContracts,
  getCustomers,
  getCustomExpenseCategories,
  getCustomIncomeCategories,
  getTransactions,
  getUsers,
  getVendors,
  saveAmlakWorkbook,
  saveTransaction,
} from '../services/firestoreService';
import { cellAddress, colLabelToIndex } from '../utils/spreadsheetAddress';
import { setWorksheetCell } from '../utils/spreadsheetRecalc';
import { dateToLocalStr } from '../utils/dateFormat';
import { getInstallmentStartDates } from '../utils/installmentSchedule';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from '../utils/contractTransactionFilter';
import { transactionCountsAsBankForSplit, transactionCountsAsCashForSplit } from '../utils/transactionUtils';
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
import { listenAmlakSheetPresence, setAmlakSheetPresence, type AmlakSheetPresenceUser } from '../services/amlakSheetPresenceService';
import { useToast } from './Toast';

interface Props {
  currentUser: User;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type ColumnKind = 'date' | 'dueDate' | 'paidDate' | 'unit' | 'owner' | 'category' | 'subCategory' | 'related' | 'customerVAT' | 'vendor' | 'vendorVAT' | 'vendorRefNo' | 'details' | 'dueAmount' | 'paymentMethod' | 'amount' | 'balance' | 'extra' | 'discount' | 'enteredBy' | 'status';

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
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  otherIncome: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  expense: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'subCategory', label: 'Target', col: 'C', width: '150px' },
    { key: 'related', label: 'Notes / Period', col: 'D', width: '132px' },
    { key: 'details', label: 'Details', col: 'E', width: '240px' },
    { key: 'paymentMethod', label: 'Method', col: 'F', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'G', width: '92px' },
    { key: 'extra', label: 'Extra', col: 'H', width: '78px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  ownerExpense: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'owner', label: 'Owner', col: 'B', width: '150px' },
    { key: 'details', label: 'Details', col: 'C', width: '240px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  vatIncome: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'customerVAT', label: 'Customer VAT', col: 'C', width: '128px' },
    { key: 'details', label: 'Details', col: 'D', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'E', width: '92px' },
    { key: 'amount', label: 'Amount Incl. VAT', col: 'F', width: '112px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  vatExpense: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'category', label: 'Category', col: 'B', width: '140px' },
    { key: 'subCategory', label: 'Sub Category', col: 'C', width: '136px' },
    { key: 'vendor', label: 'Vendor', col: 'D', width: '150px' },
    { key: 'vendorVAT', label: 'Vendor VAT', col: 'E', width: '128px' },
    { key: 'vendorRefNo', label: 'Ref No', col: 'F', width: '108px' },
    { key: 'details', label: 'Details', col: 'G', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'H', width: '92px' },
    { key: 'amount', label: 'Amount Incl. VAT', col: 'I', width: '112px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
  fees: [
    { key: 'date', label: 'Date', col: 'A', width: '112px' },
    { key: 'unit', label: 'Unit', col: 'B', width: '96px' },
    { key: 'details', label: 'Details', col: 'C', width: '230px' },
    { key: 'paymentMethod', label: 'Method', col: 'D', width: '92px' },
    { key: 'amount', label: 'Amount', col: 'E', width: '92px' },
    { key: 'discount', label: 'Discount', col: 'F', width: '82px' },
    { key: 'enteredBy', label: 'Entered By', width: '98px' },
    { key: 'status', label: 'Status', width: '78px' },
  ],
};

const isAdminUser = (user: User) => user.role === UserRole.ADMIN || String(user.role) === 'ADMIN';
const isManagerUser = (user: User) => user.role === UserRole.MANAGER || String(user.role) === 'MANAGER';
const AMLAK_FIRST_MONTH = '2026-01';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentMonthKey(): string {
  return dateToLocalStr(new Date()).slice(0, 7);
}

function browserViewportWidth(): number {
  if (typeof window === 'undefined') return 1280;
  return window.innerWidth || 1280;
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
  return '';
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
    const due = Number(String(cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0;
    const paid = Number(String(cellRaw(sheet, 'E', row) || '').replace(/,/g, '')) || 0;
    if (paid > due && due > 0) return `Advance ${formatAmount(paid - due)}`;
    const balance = Math.max(0, due - paid);
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
    if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') return 136;
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

  const base = pxNumber(column.width);
  if (!sheet || rows.length === 0) return scaledWidth(base, viewportWidth);
  const values = rows.slice(0, 120).map(row => columnDisplayValue(sheet, column, row).trim()).filter(Boolean);
  const longestValue = values.reduce((longest, value) => Math.max(longest, value.length), 0);
  const charPx = viewportWidth < 640 ? 5.8 : viewportWidth < 900 ? 6.4 : 7;
  const textWidth = (chars: number, padding = 30) => chars * charPx + scaledWidth(padding, viewportWidth);

  if (column.key === 'date' || column.key === 'dueDate' || column.key === 'paidDate') {
    return clampNumber(scaledWidth(base, viewportWidth), 82, 118);
  }
  if (column.key === 'amount' || column.key === 'dueAmount' || column.key === 'extra' || column.key === 'discount' || column.key === 'balance') {
    const min = viewportWidth < 480 ? 48 : column.key === 'extra' || column.key === 'discount' ? 54 : 60;
    const max = viewportWidth < 640 ? 84 : column.key === 'balance' ? 100 : 104;
    return clampNumber(textWidth(longestValue, 26), min, max);
  }
  if (column.key === 'paymentMethod' || column.key === 'status' || column.key === 'enteredBy' || column.key === 'unit') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 24), viewportWidth < 480 ? 54 : 64, scaledWidth(Math.max(base, 112), viewportWidth));
  }
  if (column.key === 'details') {
    return clampNumber(textWidth(Math.max(column.label.length, longestValue), 34), scaledWidth(160, viewportWidth), scaledWidth(360, viewportWidth));
  }
  return clampNumber(textWidth(Math.max(column.label.length, longestValue), 32), scaledWidth(Math.min(base, 110), viewportWidth), scaledWidth(Math.max(base, 190), viewportWidth));
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

function sheetColumns(kind: AmlakSheetKind): SheetColumn[] {
  return COLUMNS[kind === 'income' ? 'rentalIncome' : kind];
}

function normRowKey(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function amountRowKey(value: number): string {
  return String(Math.round((Number(value) || 0) * 100));
}

function rowPostedMatchKey(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): string {
  const canonicalKind = kind === 'income' ? 'rentalIncome' : kind;
  const date = canonicalKind === 'rentalIncome' ? rowPaidDate(sheet, row) : cellRaw(sheet, 'A', row);
  const amount = canonicalKind === 'rentalIncome'
    ? (Number(String(cellRaw(sheet, 'E', row) || cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0)
    : rowEnteredAmount(sheet, kind, row);
  if (!date || amount <= 0) return '';
  if (canonicalKind === 'rentalIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'vatIncome' || canonicalKind === 'fees') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'otherIncome') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'ownerExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'B', row))].join('|');
  if (canonicalKind === 'vatExpense') return [canonicalKind, date, amountRowKey(amount), normRowKey(cellRaw(sheet, 'D', row) || cellRaw(sheet, 'F', row))].join('|');
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
  return [canonicalKind, date, amountRowKey(amount), normRowKey(tx.expenseCategory || 'General Expense')].join('|');
}

function transactionMatchesExistingRow(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind, row: number): boolean {
  const canonicalKind = kind === 'income' ? 'rentalIncome' : kind;
  if (canonicalKind === 'rentalIncome') {
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
  return !!column && ['owner', 'category', 'subCategory', 'related', 'vendor', 'details'].includes(column.key);
}

function transactionDisplayAmount(tx: Transaction): number {
  return Number((tx as any).amountIncludingVAT ?? (tx as any).totalWithVat ?? tx.amount) || 0;
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

function isWithinRentalPrefillWindow(date: Date, activeMonth: string): boolean {
  const end = addMonths(monthStart(activeMonth), 1);
  return date < end;
}

function isRentalDueBoardKind(kind: AmlakSheetKind): boolean {
  return kind === 'rentalIncome' || kind === 'income';
}

function transactionRentalCredit(tx: Transaction): number {
  return (
    (Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount) || 0) +
    (Number(tx.discountAmount) || 0) +
    (Number(tx.extraAmount) || 0) +
    (Number(tx.bonusAmount) || 0) -
    (Number(tx.deductionAmount) || 0)
  );
}

function transactionInstallmentKey(tx: Transaction): string {
  return String((tx as any).dueDate || tx.installmentStartDate || '').slice(0, 10);
}

function contractInstallmentAmount(contract: any, building: Building, installmentIndex: number): number {
  const count = Math.max(1, Number(contract.installmentCount) || 1);
  const nonResidential = building.propertyType === 'NON_RESIDENTIAL' || (building as any).vatApplicable === true;
  if (nonResidential) {
    return Math.round((Number(contract.rentValue || 0) || 0) / count);
  }
  const first = Number(contract.firstInstallment || 0);
  const other = Number(contract.otherInstallment || 0);
  if (first > 0 || other > 0) {
    return Math.round(installmentIndex === 0 ? first + Number(contract.upfrontPaid || 0) : other);
  }
  const total = Number(contract.totalValue || contract.rentValue || 0) || 0;
  return Math.round(total / count);
}

function buildRentalDueRows(input: {
  building: Building;
  contracts: Contract[];
  transactions: Transaction[];
  activeMonth: string;
}): Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string }> {
  const catalog = input.contracts.filter((contract: any) => !contract.deleted);
  const dueContracts = catalog.filter(contract => {
    if (contract.buildingId !== input.building.id) return false;
    const status = String(contract.status || '').toLowerCase();
    if (status.includes('terminat') || status.includes('cancel') || status.includes('draft')) return false;
    return true;
  });

  return dueContracts.flatMap(contract => {
    const count = Math.max(1, Number((contract as any).installmentCount) || 1);
    const dueDates = getInstallmentStartDates({
      fromDate: (contract as any).fromDate,
      toDate: (contract as any).toDate,
      periodMonths: Number((contract as any).periodMonths) || 0,
      periodDays: Number((contract as any).periodDays) || 0,
      installmentCount: count,
    });
    if (!dueDates.length) return [];

    const rentPayments = input.transactions
      .filter((tx: any) => {
        if (!tx || tx.type === 'EXPENSE' || tx.feesEntry) return false;
        return transactionAppliesToContract(tx, contract as any, catalog as any);
      });

    return dueDates.map((dueDate, index) => {
      const expected = contractInstallmentAmount(contract, input.building, index);
      const date = dateToLocalStr(dueDate);
      const dueMonth = date.slice(0, 7);
      const paidForInstallment = rentPayments.reduce((sum, tx) => {
        const installmentKey = transactionInstallmentKey(tx);
        const appliesToThisInstallment = installmentKey
          ? installmentKey === date || installmentKey.slice(0, 7) === dueMonth
          : monthKeyFromDate(tx.date) === dueMonth;
        return appliesToThisInstallment ? sum + transactionRentalCredit(tx) : sum;
      }, index === 0 ? Number((contract as any).upfrontPaid || 0) : 0);
      const paidToward = Math.max(0, Math.min(expected, paidForInstallment));
      const remaining = Math.max(0, Math.round(expected - paidToward));
      if (remaining <= 0 || !isWithinRentalPrefillWindow(dueDate, input.activeMonth)) return null;
      return {
        date,
        unit: (contract as any).unitName || '',
        details: buildIncomeSheetDetails({
          building: input.building,
          contracts: input.contracts,
          unitName: (contract as any).unitName || '',
          date,
        }),
        dueAmount: remaining,
        contractId: contract.id,
      };
    }).filter(Boolean) as Array<{ date: string; unit: string; details: string; dueAmount: number; contractId?: string }>;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.unit.localeCompare(b.unit));
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
): AmlakWorksheet {
  const rows = buildRentalDueRows({ building, contracts, transactions, activeMonth });
  if (!rows.length) return sheet;

  const preserved = new Map<string, { row: number; amount: string; method: string; paidDate: string }>();
  const unusableRows = new Set<number>();
  for (let row = 2; row <= sheet.rowCount; row++) {
    const key = `${cellRaw(sheet, 'A', row)}|${cellRaw(sheet, 'B', row)}`;
    if (key !== '|') {
      const meta = sheet.rowsMeta?.[String(row)];
      const postedMismatch = !!meta?.postedTransactionId && !rowPostedMetaMatchesRentalRow(sheet, row, transactions);
      if (meta?.status === 'posted' || meta?.postedTransactionId) unusableRows.add(row);
      if (!postedMismatch) preserved.set(key, {
        row,
        amount: cellRaw(sheet, 'E', row),
        method: cellRaw(sheet, 'F', row) || 'BANK',
        paidDate: cellRaw(sheet, 'G', row),
      });
    }
  }

  let next = sheet;
  const usedRows = new Set<number>();
  const pickEmptyRow = () => {
    for (let row = 2; row <= next.rowCount; row++) {
      if (!usedRows.has(row) && !unusableRows.has(row) && !rowHasData(next, row)) return row;
    }
    return next.rowCount + 1;
  };
  rows.forEach((dueRow, index) => {
    const existing = preserved.get(`${dueRow.date}|${dueRow.unit}`);
    const row = existing?.row || pickEmptyRow();
    usedRows.add(row);
    next = ensureRowCapacity(next, row);
    next = setWorksheetCell(next, `A${row}`, dueRow.date);
    next = setWorksheetCell(next, `B${row}`, dueRow.unit);
    next = setWorksheetCell(next, `C${row}`, normalizeAmlakTextValue(dueRow.details));
    next = setWorksheetCell(next, `D${row}`, String(dueRow.dueAmount));
    next = setWorksheetCell(next, `E${row}`, existing?.amount || '');
    next = setWorksheetCell(next, `F${row}`, existing?.method || 'BANK');
    next = setWorksheetCell(next, `G${row}`, existing?.paidDate || '');
    if (!existing && next.rowsMeta?.[String(row)]) {
      const { [String(row)]: _staleMeta, ...rowsMeta } = next.rowsMeta;
      next = { ...next, rowsMeta };
    }
  });

  return next;
}

function firstEmptyRow(sheet: AmlakWorksheet): number {
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (!rowHasData(sheet, row)) return row;
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
  return row <= sheet.rowCount ? sheet : { ...sheet, rowCount: row };
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

function transactionSheetKind(tx: Transaction, building: Building): AmlakSheetKind | null {
  return transactionSheetKinds(tx, building)[0] || null;
}

function transactionSheetKinds(tx: Transaction, building: Building): AmlakSheetKind[] {
  if (tx.type === 'INCOME') {
    const buildingChargesVat = building.propertyType === 'NON_RESIDENTIAL' || (building as any).vatApplicable === true;
    if ((tx as any).feesEntry) return ['fees'];
    if (buildingChargesVat && (tx.isVATApplicable || tx.incomeSubType !== 'OTHER')) return ['rentalIncome', 'vatIncome'];
    if (tx.incomeSubType === 'OTHER') return ['otherIncome'];
    return ['rentalIncome'];
  }
  if (tx.type === 'EXPENSE') {
    if (tx.isVATApplicable) return ['vatExpense'];
    if (tx.expenseCategory === 'Owner Expense' || tx.expenseCategory === 'Owner Profit Withdrawal') return ['ownerExpense'];
    return ['expense'];
  }
  return [];
}

function importTransactionIntoSheet(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind): AmlakWorksheet {
  const alreadyImportedRow = importedTransactionRow(sheet, tx);
  if (alreadyImportedRow && kind !== 'rentalIncome') return sheet;
  const row = alreadyImportedRow || findExistingTransactionRow(sheet, tx, kind) || firstEmptyRow(sheet);
  let next = ensureRowCapacity(sheet, row);
  const amount = String(tx.amountIncludingVAT || tx.totalWithVat || tx.amount || '');
  const text = (value: string | undefined) => normalizeAmlakTextValue(value || '');
  if (kind === 'rentalIncome') {
    const dueAmount = String(tx.expectedAmount || cellRaw(sheet, 'D', row) || tx.amountIncludingVAT || tx.totalWithVat || tx.amount || '');
    const dueDate = String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || cellRaw(sheet, 'A', row) || '');
    const method = tx.paymentMethod || 'BANK';
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
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || 'Other Income'));
    next = setWorksheetCell(next, `C${row}`, text(tx.details));
    next = setWorksheetCell(next, `D${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `E${row}`, amount);
  } else if (kind === 'expense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || 'General Expense'));
    next = setWorksheetCell(next, `C${row}`, text(tx.employeeName || tx.vendorName || tx.buildingName || tx.expenseSubCategory || ''));
    next = setWorksheetCell(next, `D${row}`, text(tx.salaryPeriod || ''));
    next = setWorksheetCell(next, `E${row}`, text(tx.details));
    next = setWorksheetCell(next, `F${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `G${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `H${row}`, String(tx.extraAmount || ''));
  } else if (kind === 'ownerExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.ownerName));
    next = setWorksheetCell(next, `C${row}`, text(tx.details));
    next = setWorksheetCell(next, `D${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
  } else if (kind === 'vatIncome') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, tx.customerVATNumber || '');
    next = setWorksheetCell(next, `D${row}`, text(tx.details));
    next = setWorksheetCell(next, `E${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `F${row}`, amount);
  } else if (kind === 'vatExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || 'Vendor Payment'));
    next = setWorksheetCell(next, `C${row}`, text(tx.expenseSubCategory));
    next = setWorksheetCell(next, `D${row}`, text(tx.vendorName));
    next = setWorksheetCell(next, `E${row}`, tx.vendorVATNumber || '');
    next = setWorksheetCell(next, `F${row}`, tx.vendorRefNo || tx.vatInvoiceNumber || '');
    next = setWorksheetCell(next, `G${row}`, text(tx.details));
    next = setWorksheetCell(next, `H${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `I${row}`, amount);
  } else if (kind === 'fees') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, text(tx.details));
    next = setWorksheetCell(next, `D${row}`, tx.paymentMethod || 'BANK');
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `F${row}`, String(tx.discountAmount || ''));
  }
  return setImportedRowMeta(next, row, tx);
}

function syncExistingTransactionsIntoWorkbook(workbook: AmlakWorkbook, building: Building, transactions: Transaction[]): AmlakWorkbook {
  const today = dateToLocalStr(new Date());
  let changed = false;
  const sheets = workbook.sheets.map(sheet => ({ ...sheet }));
  transactions
    .filter((tx: any) => !tx.deleted && tx.status !== 'REJECTED' && tx.buildingId === building.id && (!tx.date || tx.date <= today))
    .forEach(tx => {
      transactionSheetKinds(tx, building).forEach(kind => {
        const index = sheets.findIndex(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === kind);
        if (index < 0) return;
        const before = sheets[index];
        const after = importTransactionIntoSheet(before, tx, kind);
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
  const viewportWidth = useViewportWidth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [workbooks, setWorkbooks] = useState<AmlakWorkbook[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);
  const [customExpenseSubcategories, setCustomExpenseSubcategories] = useState<Record<string, string[]>>({});
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [activeKind, setActiveKind] = useState<AmlakSheetKind>('rentalIncome');
  const [activeMonth, setActiveMonth] = useState(currentMonthKey);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [presence, setPresence] = useState<Record<string, AmlakSheetPresenceUser>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; key: ColumnKind } | null>(null);
  const [sheetFocusMode, setSheetFocusMode] = useState(false);
  const [addRowsCount, setAddRowsCount] = useState(10);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  );
  const autosaveTimer = useRef<number | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = isAdminUser(currentUser);
  const canSeeAllBuildings = isAdmin || isManagerUser(currentUser);
  const allowedBuildings = useMemo(() => {
    if (canSeeAllBuildings) return buildings;
    const assigned = new Set([...(currentUser.buildingIds || []), currentUser.buildingId].filter(Boolean));
    return buildings.filter(b => assigned.has(b.id));
  }, [buildings, canSeeAllBuildings, currentUser]);

  const selectedBuilding = allowedBuildings.find(b => b.id === selectedBuildingId) || allowedBuildings[0];
  const activeWorkbook = workbookForBuilding(workbooks, selectedBuilding);
  const isVatBuilding = !!selectedBuilding && (
    isNonResidentialBuildingForContract([selectedBuilding], { buildingId: selectedBuilding.id }) ||
    (selectedBuilding as any).vatApplicable === true
  );
  const visibleSheetTabs = useMemo(
    () => SHEET_TABS.filter(tab => isVatBuilding || !['vatIncome', 'vatExpense', 'fees'].includes(tab.kind)),
    [isVatBuilding],
  );
  const activeSheet = activeWorkbook?.sheets.find(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === activeKind) || activeWorkbook?.sheets[0];
  const futureMonthLocked = isFutureMonth(activeMonth);
  const staffDeadlineLocked = !isAdmin && staffMonthEditClosed(activeMonth);
  const pastMonthReadOnly = activeMonth < currentMonthKey();
  const sheetLocked = futureMonthLocked || staffDeadlineLocked;
  const owners = useMemo(() => users.filter((u: any) => u.isOwner || String(u.role).toUpperCase() === 'OWNER'), [users]);
  const sharedUsers = useMemo(() => {
    if (!selectedBuilding) return [];
    return users.filter((u: any) => {
      if (isAdminUser(u) || isManagerUser(u)) return true;
      const ids = new Set([...(u.buildingIds || []), u.buildingId].filter(Boolean));
      return ids.has(selectedBuilding.id);
    });
  }, [users, selectedBuilding]);

  useEffect(() => {
    const previousTitle = document.title;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.content;
    document.title = 'Amlak Sheets';
    if (themeMeta) themeMeta.content = '#047857';

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalledApp(true);
      showSuccess('Amlak Sheets installed');
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = () => setIsInstalledApp(!!media?.matches);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    media?.addEventListener?.('change', onDisplayModeChange);

    return () => {
      document.title = previousTitle;
      if (themeMeta && previousTheme) themeMeta.content = previousTheme;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      media?.removeEventListener?.('change', onDisplayModeChange);
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
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTo({ top: 0, left: 0 });
    }
  }, [selectedBuilding?.id, activeKind, activeMonth]);

  const postingResults = useMemo(() => {
    if (!activeSheet) return [];
    return validateWorksheetPostingRows(activeSheet, { currentUser, buildings, contracts, users, existingTransactions: transactions });
  }, [activeSheet, currentUser, buildings, contracts, users, transactions]);
  const postingByRow = useMemo(() => new Map(postingResults.map(r => [r.row, r])), [postingResults]);
  const postedTransactionKeys = useMemo(() => {
    if (!selectedBuilding) return new Set<string>();
    const canonicalActiveKind = activeKind === 'income' ? 'rentalIncome' : activeKind;
    return new Set(
      transactions
        .filter((tx: any) => {
          if (!tx || tx.deleted || tx.status === 'REJECTED' || tx.buildingId !== selectedBuilding.id) return false;
          return transactionSheetKinds(tx, selectedBuilding).includes(canonicalActiveKind);
        })
        .map(tx => transactionPostedMatchKey(tx, canonicalActiveKind))
        .filter(Boolean),
    );
  }, [activeKind, selectedBuilding, transactions]);
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, wb, c, tx, u, cust, v, expenseCats, incomeCats] = await Promise.all([
          getBuildings(),
          getAmlakWorkbooks(),
          getContracts(),
          getTransactions(),
          getUsers(),
          getCustomers(),
          getVendors(),
          getCustomExpenseCategories().catch(() => []),
          getCustomIncomeCategories().catch(() => []),
        ]);
        setBuildings(b || []);
        setContracts((c || []).filter((x: any) => !x.deleted));
        setTransactions(tx || []);
        setUsers(u || []);
        setCustomers(cust || []);
        setVendors((v || []).filter((vendor: any) => vendor?.status !== 'Inactive'));
        setCustomExpenseCategories(Array.isArray(expenseCats) ? expenseCats : []);
        setCustomIncomeCategories(Array.isArray(incomeCats) ? incomeCats : []);
        setCustomExpenseSubcategories(readLocalExpenseSubcategories());
        const loadedWorkbooks = ((wb || []) as AmlakWorkbook[]).map(compactAmlakWorkbook);
        setWorkbooks(loadedWorkbooks);
        const allowed = canSeeAllBuildings
          ? (b || [])
          : (b || []).filter((building: Building) => new Set([...(currentUser.buildingIds || []), currentUser.buildingId].filter(Boolean)).has(building.id));
        setSelectedBuildingId(allowed[0]?.id || '');
      } catch (error: any) {
        showError(error?.message || 'Failed to load building sheets');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, canSeeAllBuildings, showError]);

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
    const created = createBuildingAmlakSheetsWorkbook(currentUser, selectedBuilding);
    setWorkbooks(prev => [created, ...prev]);
    setDirty(true);
  }, [selectedBuilding, loading, workbooks, currentUser]);

  useEffect(() => {
    if (!selectedBuilding || !activeWorkbook) return;

    let nextWorkbook = activeWorkbook;
    let changed = false;

    const rentalSheet = contracts.length
      ? nextWorkbook.sheets.find(sheet => (sheet.sheetKind === 'income' ? 'rentalIncome' : sheet.sheetKind) === 'rentalIncome')
      : undefined;
    if (rentalSheet) {
      const synced = syncRentalDueRows(rentalSheet, selectedBuilding, contracts, transactions, currentMonthKey());
      const watchedCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const signature = (sheet: AmlakWorksheet) => JSON.stringify([
        `rows:${sheet.rowCount}`,
        ...watchedCols.flatMap(col =>
          Array.from({ length: Math.min(sheet.rowCount, 120) - 1 }, (_, index) => {
            const row = index + 2;
            return `${col}${row}:${cellRaw(sheet, col, row)}`;
          })
        ),
      ]);
      if (signature(synced) !== signature(rentalSheet)) {
        nextWorkbook = {
          ...nextWorkbook,
          sheets: nextWorkbook.sheets.map(sheet => sheet.id === rentalSheet.id ? synced : sheet),
          updatedAt: Date.now(),
        };
        changed = true;
      }
    }

    if (transactions.length) {
      const imported = syncExistingTransactionsIntoWorkbook(nextWorkbook, selectedBuilding, transactions);
      if (imported !== nextWorkbook) {
        nextWorkbook = imported;
        changed = true;
      }
    }

    if (changed) updateWorkbook(nextWorkbook);
  }, [selectedBuilding?.id, activeWorkbook?.id, activeWorkbook?.updatedAt, contracts, transactions]);

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
    }, 1200);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [dirty, activeWorkbook]);

  const updateWorkbook = (next: AmlakWorkbook) => {
    setWorkbooks(prev => prev.map(w => w.id === next.id ? next : w));
    setDirty(true);
  };

  const updateSheet = (nextSheet: AmlakWorksheet) => {
    if (!activeWorkbook) return;
    updateWorkbook({
      ...activeWorkbook,
      sheets: activeWorkbook.sheets.map(sheet => sheet.id === nextSheet.id ? nextSheet : sheet),
      updatedAt: Date.now(),
    });
  };

  const saveWorkbook = async (silent = false) => {
    if (!activeWorkbook) return;
    setSaving(true);
    try {
      await saveAmlakWorkbook(compactAmlakWorkbook(activeWorkbook));
      setDirty(false);
      if (!silent) showSuccess('Building sheet saved');
    } catch (error: any) {
      showError(error?.message || 'Save failed');
    } finally {
      setSaving(false);
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
    const count = clampNumber(Number(addRowsCount) || 10, 1, 100);
    const firstNewRow = activeSheet.rowCount + 1;
    updateSheet({
      ...activeSheet,
      rowCount: activeSheet.rowCount + count,
      updatedAt: Date.now(),
    });
    setActiveCell({ row: firstNewRow, key: sheetColumns(activeKind)[0]?.key || 'date' });
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-amlak-cell-target="${firstNewRow}-${sheetColumns(activeKind)[0]?.key || 'date'}"]`);
      if (target) {
        target.focus();
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      } else {
        gridScrollRef.current?.scrollTo({ top: gridScrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 80);
    showSuccess(`Added ${count} row(s)`);
  };

  const setCell = (row: number, col: string, value: string) => {
    if (!activeSheet || !selectedBuilding) return;
    if (sheetLocked) {
      showInfo(futureMonthLocked ? 'Future month sheets are locked for everyone.' : 'Staff editing for this month is closed after the 10th of the next month.');
      return;
    }
    const nextValue = shouldNormalizeInputCell(activeKind, col) ? normalizeAmlakTextValue(value) : value;
    const address = cellAddress(colLabelToIndex(col), row);
    let next = setWorksheetCell(activeSheet, address, nextValue);
    if (col !== 'A' && !cellRaw(next, 'A', row)) {
      next = setWorksheetCell(next, `A${row}`, `${activeMonth}-01`);
    }
    next = setWorksheetRowMeta(next, row, currentUser, { status: 'draft', error: undefined });

    if ((activeKind === 'rentalIncome' || activeKind === 'income' || activeKind === 'vatIncome' || activeKind === 'fees') && col === 'B') {
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
      next = setWorksheetCell(next, detailCol + row, normalizeAmlakTextValue(details || ''));
      if (activeKind === 'vatIncome' && contract) {
        const customer = customers.find((c: any) => c.id === contract.customerId) || customers.find((c: any) => c.nameEn === contract.customerName || c.nameAr === contract.customerName);
        next = setWorksheetCell(next, 'C' + row, (customer as any)?.vatNumber || '');
      } else if (activeKind === 'vatIncome') {
        next = setWorksheetCell(next, 'C' + row, '');
      }
    }

    if ((activeKind === 'expense' || activeKind === 'vatExpense') && col === 'B') {
      next = setWorksheetCell(next, `C${row}`, '');
      if (activeKind === 'expense') next = setWorksheetCell(next, `D${row}`, '');
    }

    if ((activeKind === 'rentalIncome' || activeKind === 'income') && col === 'E' && value && !cellRaw(next, 'G', row)) {
      next = setWorksheetCell(next, `G${row}`, dateToLocalStr(new Date()));
    }

    if (activeKind === 'vatExpense' && col === 'D') {
      const vendor = vendors.find((v: any) => v.id === value || v.nameEn === value || v.name === value || v.nameEn === nextValue || v.name === nextValue);
      if (vendor) {
        next = setWorksheetCell(next, 'D' + row, normalizeAmlakTextValue(vendor.nameEn || vendor.name || nextValue));
        next = setWorksheetCell(next, 'E' + row, vendor.vatNumber || vendor.vatNo || '');
      } else {
        next = setWorksheetCell(next, 'E' + row, '');
      }
    }

    updateSheet(next);
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
    if (!isAdmin || !activeSheet || !activeWorkbook) return;
    if (futureMonthLocked) {
      showInfo('Future month sheets are locked for everyone.');
      return;
    }
    const rows = postingResults.filter(result => selectedRows.has(result.row) && result.ok && result.transaction);
    if (!rows.length) {
      showInfo('Select valid rows to post');
      return;
    }
    const posted: Array<{ row: number; transactionId: string; postedBy: string }> = [];
    for (const row of rows) {
      const tx = row.transaction!;
      await saveTransaction(tx);
      posted.push({ row: row.row, transactionId: tx.id, postedBy: currentUser.id });
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
    showSuccess(`Posted ${posted.length} row(s)`);
  };

  const visibleRows = useMemo(() => {
    if (!activeSheet) return [];
    const pastMonth = activeMonth < currentMonthKey();
    const rowIsPosted = (row: number) => {
      const meta = activeSheet.rowsMeta?.[String(row)];
      return meta?.status === 'posted' ||
        !!meta?.postedTransactionId ||
        postedTransactionKeys.has(rowPostedMatchKey(activeSheet, activeKind, row));
    };
    const maxDataRow = Math.max(
      20,
      ...Object.keys(activeSheet.rowsMeta || {}).map(Number).filter(Number.isFinite),
      ...Object.values(activeSheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)),
    );
    const candidates = Array.from({ length: activeSheet.rowCount - 1 }, (_, i) => i + 2);
    const matched = candidates.filter(row => {
      const hasData = rowHasData(activeSheet, row);
      if (pastMonth && !hasData) return false;
      if (!hasData) return true;
      if (pastMonth && !rowIsPosted(row)) return false;
      if (isRentalDueBoardKind(activeKind)) {
        const date = cellRaw(activeSheet, 'A', row);
        if (!date) return true;
        const current = currentMonthKey();
        if (activeMonth > current) return false;
        const due = Number(String(cellRaw(activeSheet, 'D', row) || '').replace(/,/g, '')) || 0;
        const paid = Number(String(cellRaw(activeSheet, 'E', row) || '').replace(/,/g, '')) || 0;
        if (activeMonth === current) {
          const isOverdueDraft = !rowIsPosted(row) && date < dateToLocalStr(addMonths(monthStart(current), 1)) && due > paid;
          return rowDisplayMonthKey(activeSheet, activeKind, row) === current || isOverdueDraft;
        }
        return rowDisplayMonthKey(activeSheet, activeKind, row) === activeMonth;
      }
      return rowDisplayMonthKey(activeSheet, activeKind, row) === activeMonth;
    });
    if (pastMonth) return matched;
    return matched.length ? matched : candidates.slice(0, 20);
  }, [activeSheet, activeKind, activeMonth, postedTransactionKeys]);
  const activeGridTemplate = useMemo(() => (
    gridTemplate(activeKind, isAdmin, activeSheet || undefined, visibleRows, viewportWidth)
  ), [activeKind, activeSheet, isAdmin, visibleRows, viewportWidth]);
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
  const ledgerSummary = useMemo(() => {
    if (!selectedBuilding) {
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
      };
    }
    const monthStartKey = `${activeMonth}-01`;
    const nextMonthStartKey = dateToLocalStr(addMonths(monthStart(activeMonth), 1));
    const normalizedType = (value: any) => String(value || '').toUpperCase();
    const approvedRows = transactions.filter((tx: any) => {
      if (!tx || tx.deleted || tx.buildingId !== selectedBuilding.id) return false;
      if (tx.paymentMethod === 'TREASURY_REVERSAL') return false;
      const status = String(tx.status || TransactionStatus.APPROVED).toUpperCase();
      return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !tx.status;
    });
    const sumAmount = (rows: Transaction[]) => rows.reduce((sum, tx) => sum + transactionDisplayAmount(tx), 0);
    const isOpeningBalance = (tx: Transaction) =>
      (tx as any).borrowingType === 'OPENING_BALANCE' ||
      (tx as any).isOpeningBalance === true ||
      (tx as any).isOwnerOpeningBalance === true ||
      tx.expenseCategory === 'Owner Opening Balance';
    const ownerExpenseRows = approvedRows.filter(tx =>
      tx.expenseCategory === 'Owner Expense' ||
      tx.expenseCategory === 'Owner Profit Withdrawal' ||
      tx.expenseCategory === 'Owner Withdrawal'
    );

    let openingCash = 0;
    let openingBank = 0;
    let openingTotal = 0;
    approvedRows
      .filter(tx => tx.date && tx.date < monthStartKey && !isOpeningBalance(tx))
      .forEach(tx => {
        const amount = transactionDisplayAmount(tx);
        const signed = normalizedType(tx.type) === TransactionType.INCOME ? amount : -amount;
        openingTotal += signed;
        if (transactionCountsAsCashForSplit(tx)) openingCash += signed;
        if (transactionCountsAsBankForSplit(tx)) openingBank += signed;
      });

    const periodRows = approvedRows.filter(tx => tx.date && tx.date >= monthStartKey && tx.date < nextMonthStartKey && !isOpeningBalance(tx));
    const incomeRows = periodRows.filter(tx => normalizedType(tx.type) === TransactionType.INCOME);
    const expenseRows = periodRows.filter(tx => normalizedType(tx.type) === TransactionType.EXPENSE);
    const cashIncome = sumAmount(incomeRows.filter(tx => transactionCountsAsCashForSplit(tx)));
    const bankIncome = sumAmount(incomeRows.filter(tx => transactionCountsAsBankForSplit(tx)));
    const cashExpense = sumAmount(expenseRows.filter(tx => transactionCountsAsCashForSplit(tx)));
    const bankExpense = sumAmount(expenseRows.filter(tx => transactionCountsAsBankForSplit(tx)));
    const chequeIncome = sumAmount(incomeRows.filter(tx => String((tx as any).originalPaymentMethod || tx.paymentMethod || '').toUpperCase() === 'CHEQUE'));
    const chequeExpense = sumAmount(expenseRows.filter(tx => String((tx as any).originalPaymentMethod || tx.paymentMethod || '').toUpperCase() === 'CHEQUE'));
    const incomeTotal = sumAmount(incomeRows);
    const expenseTotal = sumAmount(expenseRows);
    const totalOutputVAT =
      incomeRows.filter(tx => !(tx as any).isCreditNote).reduce((sum, tx) => sum + Math.abs(Number(tx.vatAmount) || 0), 0) -
      incomeRows.filter(tx => (tx as any).isCreditNote).reduce((sum, tx) => sum + Math.abs(Number(tx.vatAmount) || 0), 0);
    const totalInputVAT = expenseRows.reduce((sum, tx) => sum + Math.abs(Number(tx.vatAmount) || 0), 0);

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
      ownerExpenseTotal: sumAmount(ownerExpenseRows.filter(tx => tx.date && tx.date >= monthStartKey && tx.date < nextMonthStartKey)),
    };
  }, [activeMonth, selectedBuilding, transactions]);

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

  const onlineUsers = Object.values(presence).filter(p => p.online && Date.now() - p.lastSeenMs < 90000);
  const selectedValidCount = [...selectedRows].filter(row => postingByRow.get(row)?.ok).length;

  return (
    <div className={`${sheetFocusMode ? 'fixed inset-0 z-[90] h-[100dvh] min-h-[100dvh] overflow-hidden' : 'min-h-[100dvh] overflow-y-auto'} bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#ecfdf5_42%,#f8fafc_100%)] flex flex-col`}>
      <header className={`${sheetFocusMode ? 'px-1 sm:px-2 py-1 shrink-0' : 'px-3 sm:px-4 md:px-6 py-3'} border-b border-emerald-200/70 bg-white/86 backdrop-blur-2xl sticky top-0 z-30 shadow-[0_18px_60px_rgba(15,23,42,0.08)]`}>
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
            <select
              value={selectedBuilding.id}
              onChange={e => {
                setSelectedBuildingId(e.target.value);
                setActiveKind('rentalIncome');
                setActiveMonth(currentMonthKey());
                setSelectedRows(new Set());
                setActiveCell(null);
              }}
              className="col-span-2 sm:col-span-1 w-full sm:w-auto sm:min-w-72 min-h-[44px] rounded-2xl border border-emerald-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {allowedBuildings.map(building => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void installAmlakSheets()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-black text-emerald-800 shadow-sm shadow-emerald-100 active:scale-[0.98]"
            >
              <Download size={16} /> {isInstalledApp ? 'Installed' : 'Install app'}
            </button>
            {isAdmin && (
              <button onClick={() => exportBuildingWorkbook(activeWorkbook)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm active:scale-[0.98]">
                <Download size={16} /> Export
              </button>
            )}
            <button onClick={() => void saveWorkbook(false)} disabled={saving} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-4 py-2.5 text-sm font-black shadow-lg shadow-emerald-100 disabled:opacity-60 active:scale-[0.98]">
              <Save size={16} /> {saving ? 'Saving...' : dirty ? 'Save draft' : 'Saved'}
            </button>
            <div className="col-span-2 sm:col-span-1 inline-flex min-h-[44px] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <select
                value={addRowsCount}
                onChange={e => setAddRowsCount(Number(e.target.value) || 10)}
                disabled={sheetLocked || pastMonthReadOnly}
                className="min-w-0 flex-1 bg-white px-2.5 py-2 text-xs font-black text-slate-700 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                aria-label="Rows to add"
              >
                <option value={5}>5 rows</option>
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
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
      </header>

      {!sheetFocusMode && (
        <section className="px-2 sm:px-3 md:px-6 pt-2.5 flex md:grid md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-2 sm:gap-3 overflow-x-auto md:overflow-visible snap-x pb-1 overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <AmountCard icon={<Wallet size={20} />} label="Opening Total" amount={ledgerSummary.openingTotal} subtitle={`Cash ${formatAmount(ledgerSummary.openingCash)} | Bank ${formatAmount(ledgerSummary.openingBank)}`} tone="amber" />
          <AmountCard icon={<CircleDollarSign size={20} />} label="Total Income" amount={ledgerSummary.incomeTotal} subtitle={`Cash ${formatAmount(ledgerSummary.cashIncome)} | Bank ${formatAmount(ledgerSummary.bankIncome)}`} tone="emerald" />
          <AmountCard icon={<Banknote size={20} />} label="Total Expense" amount={ledgerSummary.expenseTotal} subtitle={`Cash ${formatAmount(ledgerSummary.cashExpense)} | Bank ${formatAmount(ledgerSummary.bankExpense)}`} tone="rose" />
          <AmountCard icon={<Landmark size={20} />} label="Net Balance" amount={ledgerSummary.totalNet} subtitle={`Cash ${formatAmount(ledgerSummary.cashBalance)} | Bank ${formatAmount(ledgerSummary.bankBalance)}`} tone={ledgerSummary.totalNet >= 0 ? 'indigo' : 'rose'} strong />
          <AmountCard icon={<CircleDollarSign size={20} />} label="Net VAT" amount={ledgerSummary.netVATPayable} subtitle={`Output ${formatAmount(ledgerSummary.totalOutputVAT)} | Input ${formatAmount(ledgerSummary.totalInputVAT)}`} tone="violet" />
          <AmountCard icon={<Wallet size={20} />} label={`Sheet Cash ${visibleSheetTabs.find(t => t.kind === activeKind)?.label || ''}`} amount={monthSummary.cash} tone="emerald" />
          <AmountCard icon={<Landmark size={20} />} label={`Sheet Bank ${visibleSheetTabs.find(t => t.kind === activeKind)?.label || ''}`} amount={monthSummary.bank} tone="sky" />
          <AmountCard icon={<CircleDollarSign size={20} />} label="Sheet Total Entered" amount={monthSummary.total} strong tone="emerald" />
          {ledgerSummary.ownerExpenseTotal > 0 && (
            <AmountCard icon={<Wallet size={20} />} label="Owner Expenses" amount={ledgerSummary.ownerExpenseTotal} tone="orange" />
          )}
        </section>
      )}

      {(futureMonthLocked || staffDeadlineLocked) && (
        <div className="mx-2 sm:mx-3 md:mx-6 mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800">
          <Lock size={15} />
          {futureMonthLocked ? 'Future month sheets are locked for everyone.' : 'Staff editing for this month is closed after the 10th of the next month.'}
        </div>
      )}

      <main className={`${sheetFocusMode ? 'min-h-0 px-0 sm:px-1 py-1 flex-1' : 'h-[68dvh] min-h-[420px] px-1.5 sm:px-3 md:px-6 py-2.5 md:py-4 flex-none'} overflow-hidden`}>
        <div ref={gridScrollRef} className={`${sheetFocusMode ? 'h-full min-h-0 rounded-none sm:rounded-xl' : 'h-full min-h-0 rounded-2xl md:rounded-[2rem]'} overflow-auto bg-white/75 ring-1 ring-slate-200/70 shadow-inner shadow-slate-100 overscroll-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]`}>
          <div
            className="grid sticky top-0 z-20 w-max min-w-full bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wide shadow-lg shadow-emerald-100/70"
            style={{ gridTemplateColumns: activeGridTemplate }}
          >
            {isAdmin && <div className="px-1.5 py-2.5" />}
            <div className="px-1.5 py-2.5 text-center">#</div>
            {sheetColumns(activeKind).map(col => <div key={col.key} className="px-2 py-2.5 truncate">{col.label}</div>)}
          </div>

          {visibleRows.map(row => {
            const meta = activeSheet.rowsMeta?.[String(row)];
            const result = postingByRow.get(row);
            const hasData = rowHasData(activeSheet, row);
            const posted = meta?.status === 'posted' ||
              !!meta?.postedTransactionId ||
              !!result?.alreadyPostedTransactionId ||
              postedTransactionKeys.has(rowPostedMatchKey(activeSheet, activeKind, row));
            return (
              <div
                key={row}
                className={`group grid min-h-9 items-stretch border-b border-slate-100 text-xs transition-colors duration-200 ${
                  posted ? 'bg-emerald-50/70' : hasData ? 'bg-white hover:bg-emerald-50/30' : 'bg-white/70 hover:bg-white'
                } w-max min-w-full`}
                style={{ gridTemplateColumns: activeGridTemplate }}
              >
                {isAdmin && (
                  <div className="px-1.5 grid place-items-center">
                    <input
                      type="checkbox"
                      disabled={!result?.ok || posted}
                      checked={selectedRows.has(row)}
                      onChange={e => setSelectedRows(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(row) : next.delete(row);
                        return next;
                      })}
                    />
                  </div>
                )}
                <div className="px-1.5 grid place-items-center text-[11px] font-black text-slate-400">{row - 1}</div>
                {sheetColumns(activeKind).map(col => (
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
                    buildings={buildings}
                    owners={owners}
                    vendors={vendors}
                    expenseCategories={mergeExpenseCategories(customExpenseCategories)}
                    incomeCategories={mergeIncomeCategories(customIncomeCategories)}
                    expenseSubcategories={customExpenseSubcategories}
                    active={activeCell?.row === row && activeCell.key === col.key}
                    locked={sheetLocked || (!isAdmin && (activeKind === 'rentalIncome' || activeKind === 'income') && !['amount', 'paymentMethod', 'paidDate'].includes(col.key))}
                    onFocus={() => setActiveCell({ row, key: col.key })}
                    onNavigate={(direction) => moveActiveCell(row, col.key, direction)}
                    onChange={(value) => col.col && setCell(row, col.col, value)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="px-4 md:px-6 py-3 border-t border-emerald-100 bg-white/88 backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          {isAdmin && (
            <div className="text-sm font-bold text-slate-600">
              Admin posting: {selectedValidCount} valid row(s) selected. Staff rows stay draft until posted here.
            </div>
          )}
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 truncate">
            Amlak Sheets · All rights reserved · Android and Windows PWA ready
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={postSelectedRows}
            disabled={selectedValidCount === 0 || futureMonthLocked}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            <CircleDollarSign size={18} /> Post selected
          </button>
        )}
      </footer>
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
  owners: User[];
  vendors: any[];
  expenseCategories: string[];
  incomeCategories: string[];
  expenseSubcategories: Record<string, string[]>;
  active: boolean;
  locked: boolean;
  onFocus: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onChange: (value: string) => void;
}

const inputClass = 'w-full min-h-7 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-800 outline-none transition-all duration-200 ease-out focus:min-h-8 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:shadow-sm disabled:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50/40';

const SheetCell: React.FC<SheetCellProps> = ({
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
  expenseCategories,
  incomeCategories,
  expenseSubcategories,
  active,
  locked,
  onFocus,
  onNavigate,
  onChange,
}) => {
  const value = cellRaw(sheet, column.col, row);
  const categoryValue = cellRaw(sheet, sheetColumns(kind).find(c => c.key === 'category')?.col, row);
  const disabled = posted || locked || column.key === 'dueAmount' || column.key === 'dueDate';
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swiping, setSwiping] = useState(false);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
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
    onClick: onFocus,
    onKeyDownCapture: handleKeyDown,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (e.buttons === 1) onFocus();
    },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      const touch = e.touches[0];
      if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => {
      const touch = e.changedTouches[0];
      if (touch) handleSwipe(touch.clientX, touch.clientY);
    },
  };
  const activeClass = active
    ? 'relative z-10 bg-emerald-50/95 shadow-[inset_0_0_0_2px_#22c55e,inset_0_0_0_4px_rgba(220,252,231,0.95),0_8px_18px_rgba(34,197,94,0.14)]'
    : 'group-hover:bg-emerald-50/20';
  const cellClass = `px-1 h-full flex items-center outline-none touch-pan-x touch-pan-y transition-all duration-200 ease-out ${activeClass} ${swiping ? 'bg-emerald-100/90 scale-[0.992]' : ''}`;
  const controlProps = {
    'data-amlak-cell': `${row}-${column.key}`,
    onFocus,
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
    return <div {...cellWrapperProps} className={cellClass}><input {...controlProps} disabled={disabled} type="date" value={value} onChange={e => onChange(e.target.value)} className={inputClass} /></div>;
  }
  if (column.key === 'unit') {
    const hasCurrentUnit = !value || (building.units || []).some(unit => unit.name === value);
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...controlProps} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">Select unit</option>
          {!hasCurrentUnit && <option value={value}>{value}</option>}
          {(building.units || []).map(unit => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
        </select>
      </div>
    );
  }
  if (column.key === 'owner') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...controlProps} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
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
      <div {...cellWrapperProps} className={`${cellClass} relative`}>
        <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
        <input {...controlProps} disabled={disabled} list={listId} value={value} onChange={e => onChange(e.target.value)} className={`${inputClass} pl-10`} placeholder="Search category" />
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
      <div {...cellWrapperProps} className={`${cellClass} relative`}>
        <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
        <input {...controlProps} disabled={disabled || !categoryValue} list={listId} value={value} onChange={e => onChange(e.target.value)} className={`${inputClass} pl-10`} placeholder={placeholder} />
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      </div>
    );
  }
  if (column.key === 'related') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...controlProps} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
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
  if (column.key === 'vendor') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...controlProps} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">Select vendor</option>
          {vendors.map(vendor => <option key={vendor.id || vendor.nameEn || vendor.name} value={vendor.id || vendor.nameEn || vendor.name}>{vendor.nameEn || vendor.name}</option>)}
        </select>
      </div>
    );
  }
  if (column.key === 'paymentMethod') {
    return (
      <div {...cellWrapperProps} className={cellClass}>
        <select {...controlProps} disabled={disabled} value={value || 'BANK'} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="CASH">Cash</option>
          <option value="BANK">Bank</option>
          <option value="CHEQUE">Cheque</option>
        </select>
      </div>
    );
  }
  if (column.key === 'balance') {
    const due = Number(String(cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0;
    const paid = Number(String(cellRaw(sheet, 'E', row) || '').replace(/,/g, '')) || 0;
    const balance = Math.max(0, due - paid);
    return (
      <div {...cellWrapperProps} className={`${cellClass} justify-end`}>
        <span className={`w-full rounded-lg px-1.5 py-1 text-right text-xs font-black tabular-nums transition-colors duration-200 ${
          balance > 0 ? 'bg-amber-50 text-amber-700' : due > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'
        }`}>
          {balance ? formatAmount(balance) : due > 0 ? 'Paid' : '-'}
        </span>
      </div>
    );
  }
  if (column.key === 'amount' || column.key === 'extra' || column.key === 'discount' || column.key === 'dueAmount') {
    return <div {...cellWrapperProps} className={cellClass}><input {...controlProps} disabled={disabled} type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} className={`${inputClass} text-right tabular-nums`} placeholder="0" /></div>;
  }
  if (column.key === 'details') {
    const rows = Math.min(4, Math.max(1, String(value || '').split('\n').length, Math.ceil(String(value || '').length / 42)));
    return (
      <div {...cellWrapperProps} className={`${cellClass} py-1`}>
        <textarea
          {...controlProps}
          disabled={disabled}
          value={value}
          rows={rows}
          onChange={e => onChange(e.target.value)}
          className={`${inputClass} resize-none leading-snug overflow-hidden`}
          placeholder="Type details"
        />
      </div>
    );
  }
  return <div {...cellWrapperProps} className={cellClass}><input {...controlProps} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className={inputClass} placeholder="Type details" /></div>;
};

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

const AmountCard: React.FC<{ icon: React.ReactNode; label: string; amount: number; subtitle?: string; strong?: boolean; tone?: AmountTone }> = ({ icon, label, amount, subtitle, strong, tone = 'emerald' }) => {
  const classes = amountToneClasses[tone];
  return (
  <div className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-4 shadow-sm min-w-[196px] md:min-w-0 snap-start ${
    strong
      ? `bg-gradient-to-br text-white ${classes.strong}`
      : classes.card
  }`}>
    <div className="flex items-center justify-between gap-3">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl grid place-items-center shrink-0 ${strong ? 'bg-white/20' : classes.icon}`}>
        {icon}
      </div>
      <div className="text-right min-w-0">
        <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wide truncate ${strong ? 'text-white/90' : classes.label}`}>{label}</div>
        <div className="text-lg sm:text-2xl font-black tabular-nums truncate">{formatAmount(amount)}</div>
        {subtitle && <div className={`mt-1 text-[10px] font-bold truncate ${strong ? 'text-white/85' : 'text-slate-500'}`}>{subtitle}</div>}
      </div>
    </div>
  </div>
  );
};

export default AmlakSheets;

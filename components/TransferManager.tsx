import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Building, UserRole, Transaction, TransactionType, ExpenseCategory } from '../types';
import { getBuildings, getTransfers, saveTransfer, getBanks, deleteTransfer, getTransactions, getUsersAcrossBooks, saveTransaction, saveTransactionInBook, getDataFromBook } from '../services/firestoreService';
import { ArrowRightLeft, Building2, Landmark, TrendingDown, TrendingUp, Plus, Download, Upload, Calendar, Trash2, Check, X, RotateCcw, Wallet, UserCircle, Pencil, Shuffle, FileText, Sparkles, ChevronDown, Eye, RefreshCw } from 'lucide-react';
import { Bank } from '../types';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';
import { useBook } from '../contexts/BookContext';
import SearchableSelect from './SearchableSelect';
import LoadingOverlay from './LoadingOverlay';
import { SkeletonTableRows } from './LoadingSkeleton';
import * as XLSX from 'xlsx';

// Building enriched with the book it belongs to. For the active book the `id`
// stays the raw building id so existing transfers keep resolving correctly.
// For other books we use a composite id `${bookId}:${buildingId}` to keep it
// unambiguous across books (two books can coincidentally share a building id).
type BookBuilding = Building & { bookId: string; bookName: string; rawId: string };

const TREASURY_CONVERSION_OWNER_EXPENSE = 'OWNER_EXPENSE' as const;

function isOwnerExpenseCategory(tx: any): boolean {
  const cat = String((tx as any).expenseCategory || '').trim();
  const catLo = cat.toLowerCase();
  return (
    cat === ExpenseCategory.OWNER_EXPENSE ||
    catLo === 'owner expense' ||
    cat === 'Owner Profit Withdrawal' ||
    cat === 'OWNER_EXPENSE'
  );
}

/** Display name for Treasury owner pickers / labels (supports legacy Firestore fields). */
function treasuryUserLabel(u: any): string {
  if (!u) return '';
  return String(u.name || u.displayName || u.fullName || u.email || u.id || '').trim() || String(u.id || '');
}

function normalizeOwnerLookupKey(s: string): string {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

interface Transfer {
  id: string;
  date: string;
  fromType: 'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER';
  toType: 'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER';
  fromId?: string; // building id, bank name, or owner id
  toId?: string; // building id, bank name, or owner id
  amount: number;
  purpose: string;
  notes?: string;
  paymentMethod?: 'CASH' | 'BANK' | 'CHEQUE';
  bankName?: string; // Legacy single-bank field (kept for backward compat)
  fromBankName?: string; // Source bank when method is BANK or CHEQUE
  toBankName?: string;   // Destination bank when method is BANK or CHEQUE
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdBy: string;
  createdAt: number;
  isOfficeOpeningBalance?: boolean; // For recording old system office balance - does NOT affect building finance
}

interface TransferManagerProps {
  currentUser: User;
}

const TransferManager: React.FC<TransferManagerProps> = ({ currentUser }) => {
  const { t, isRTL } = useLanguage();
  const { books, activeBookId } = useBook();

  const { showError, showSuccess, showToast } = useToast();
  const [buildings, setBuildings] = useState<BookBuilding[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [headOfficeExpenses, setHeadOfficeExpenses] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const _isStaffInit = currentUser.role !== UserRole.ADMIN && currentUser.role !== 'HEAD' && currentUser.role !== UserRole.OWNER;
  const [view, setView_] = useState<'LIST' | 'FORM'>(_isStaffInit ? 'FORM' : 'LIST');
  const setView = (v: 'LIST' | 'FORM') => { SoundService.play('tab'); setView_(v); };

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromType, setFromType] = useState<'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER'>('BUILDING');
  const [toType, setToType] = useState<'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER'>('HEAD_OFFICE');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK' | 'CHEQUE'>('CASH');
  const [fromBankName, setFromBankName] = useState('');
  const [toBankName, setToBankName] = useState('');
  const [isOfficeOpeningBalance, setIsOfficeOpeningBalance] = useState(false);

  // Filters
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  // 'ALL' | 'HEAD_OFFICE' | building-id
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterFromType, setFilterFromType] = useState<'ALL' | 'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER'>('ALL');
  const [filterToType, setFilterToType] = useState<'ALL' | 'BUILDING' | 'HEAD_OFFICE' | 'BANK' | 'OWNER'>('ALL');
  const [filterBuildingIds, setFilterBuildingIds] = useState<string[]>([]);
  /** When on, Treasury loads buildings + transactions from every book (Admin / Head / Owner / Manager). */
  const [includeOtherBooksInTreasury, setIncludeOtherBooksInTreasury] = useState(() => {
    try {
      const v = localStorage.getItem('treasuryIncludeOtherBooks');
      if (v === '0') return false;
      return true;
    } catch {
      return true;
    }
  });
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const buildingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const buildingPickerRef = useRef<HTMLDivElement | null>(null);
  const [buildingPickerRect, setBuildingPickerRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [buildingPickerSearch, setBuildingPickerSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('Confirm');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  // Bulk import (CSV/XLSX)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [savingOpeningBal, setSavingOpeningBal] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit transfer state
  const [showEditTransferModal, setShowEditTransferModal] = useState(false);
  const [editTransferItem, setEditTransferItem] = useState<Transfer | null>(null);
  const [editTransferDate, setEditTransferDate] = useState('');
  const [editTransferFromType, setEditTransferFromType] = useState<Transfer['fromType']>('BUILDING');
  const [editTransferToType, setEditTransferToType] = useState<Transfer['toType']>('HEAD_OFFICE');
  const [editTransferFromId, setEditTransferFromId] = useState('');
  const [editTransferToId, setEditTransferToId] = useState('');
  const [editTransferAmount, setEditTransferAmount] = useState('');
  const [editTransferPurpose, setEditTransferPurpose] = useState('');
  const [editTransferNotes, setEditTransferNotes] = useState('');
  const [editTransferStatus, setEditTransferStatus] = useState<Transfer['status']>('COMPLETED');
  const [editTransferPaymentMethod, setEditTransferPaymentMethod] = useState<'CASH' | 'BANK' | 'CHEQUE'>('CASH');
  const [editTransferFromBank, setEditTransferFromBank] = useState('');
  const [editTransferToBank, setEditTransferToBank] = useState('');
  const [detailEntry, setDetailEntry] = useState<any | null>(null);

  // Opening balance edit state
  const [editingOpeningBal, setEditingOpeningBal] = useState(false);
  const [openingBalInput, setOpeningBalInput] = useState('');

  const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
    setConfirmTitle(opts?.title || 'Confirm');
    setConfirmDanger(!!opts?.danger);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmMessage('');
    setConfirmAction(null);
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isAdminOrHead = currentUser.role === UserRole.ADMIN || (currentUser as any).role === 'HEAD';

  const normalize = (s: any) => String(s ?? '').trim();
  const normalizeUpper = (s: any) => normalize(s).toUpperCase();

  const resolveBuildingId = (raw: string): string | null => {
    const v = normalize(raw);
    if (!v) return null;
    const byId = buildings.find(b => b.id === v);
    if (byId) return byId.id;
    const low = v.toLowerCase();
    const byRawId = buildings.find(b => String((b as any).rawId || '').toLowerCase() === low);
    if (byRawId) return byRawId.id;
    const byName = buildings.find(b => String(b.name || '').toLowerCase() === low);
    if (byName) return byName.id;
    return null;
  };

  const resolveOwnerId = (raw: string): string | null => {
    const v = normalize(raw);
    if (!v) return null;
    const stripped = rawOf(v);
    const byId = owners.find(o => String(o.id) === v || String(o.id) === stripped);
    if (byId) return String(byId.id);
    const vNorm = normalizeOwnerLookupKey(v);
    const low = v.toLowerCase();
    const byName = owners.find(o => normalizeOwnerLookupKey(treasuryUserLabel(o)) === vNorm);
    if (byName) return String(byName.id);
    const byEmail = owners.find(o => String((o as any).email || '').toLowerCase().trim() === low);
    if (byEmail) return String(byEmail.id);
    return null;
  };

  const parseCsv = (text: string): string[][] => {
    // Minimal CSV parser (quoted fields supported).
    const rows: string[][] = [];
    let i = 0;
    let cur = '';
    let row: string[] = [];
    let inQuotes = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        const next = text[i + 1];
        if (inQuotes && next === '"') { cur += '"'; i += 2; continue; }
        inQuotes = !inQuotes; i += 1; continue;
      }
      if (!inQuotes && ch === ',') { row.push(cur); cur = ''; i += 1; continue; }
      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && text[i + 1] === '\n') i += 1;
        row.push(cur);
        const isEmpty = row.every(c => String(c ?? '').trim() === '');
        if (!isEmpty) rows.push(row.map(c => String(c ?? '')));
        row = [];
        cur = '';
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
    }
    if (cur.length || row.length) {
      row.push(cur);
      const isEmpty = row.every(c => String(c ?? '').trim() === '');
      if (!isEmpty) rows.push(row.map(c => String(c ?? '')));
    }
    return rows;
  };

  const downloadImportTemplate = () => {
    const headers = [
      'Date',
      'FromType',
      'FromId',
      'ToType',
      'ToId',
      'Amount',
      'Purpose',
      'Notes',
      'PaymentMethod',
      'FromBankName',
      'ToBankName',
      'Status',
    ];
    const sample = [
      [
        new Date().toISOString().split('T')[0],
        'HEAD_OFFICE',
        'HEAD_OFFICE',
        'OWNER',
        owners[0]?.id || 'owner-id',
        '1000',
        'Owner withdrawal',
        '',
        'CASH',
        '',
        '',
        'COMPLETED',
      ],
    ];
    const csv = [headers, ...sample].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treasury_import_template_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTransfersFromRows = async (records: any[]) => {
    if (records.length === 0) { showError('No rows found to import.'); return; }
    setImportBusy(true);
    try {
      let ok = 0;
      const errors: string[] = [];

      for (let idx = 0; idx < records.length; idx++) {
        const r = records[idx] || {};
        const rowNo = idx + 2; // assumes header at 1

        const dateStr = normalize(r.Date);
        const fromType = normalizeUpper(r.FromType) as any;
        const toType = normalizeUpper(r.ToType) as any;
        const rawFromId = normalize(r.FromId);
        const rawToId = normalize(r.ToId);
        const amt = Number(String(r.Amount ?? '').replace(/,/g, '').trim());
        const purpose = normalize(r.Purpose) || 'Transfer';
        const notes = normalize(r.Notes);
        const paymentMethod = normalizeUpper(r.PaymentMethod) as any;
        const fromBankName = normalize(r.FromBankName);
        const toBankName = normalize(r.ToBankName);
        const status = normalizeUpper(r.Status) as any;

        if (!dateStr) { errors.push(`Row ${rowNo}: missing Date`); continue; }
        if (!fromType || !toType) { errors.push(`Row ${rowNo}: missing FromType/ToType`); continue; }
        if (!Number.isFinite(amt) || amt <= 0) { errors.push(`Row ${rowNo}: invalid Amount`); continue; }

        let fromIdResolved = rawFromId;
        let toIdResolved = rawToId;

        if (fromType === 'HEAD_OFFICE') fromIdResolved = 'HEAD_OFFICE';
        if (toType === 'HEAD_OFFICE') toIdResolved = 'HEAD_OFFICE';

        if (fromType === 'BUILDING') {
          const id = resolveBuildingId(rawFromId);
          if (!id) { errors.push(`Row ${rowNo}: FromId building not found: "${rawFromId}"`); continue; }
          fromIdResolved = id;
        }
        if (toType === 'BUILDING') {
          const id = resolveBuildingId(rawToId);
          if (!id) { errors.push(`Row ${rowNo}: ToId building not found: "${rawToId}"`); continue; }
          toIdResolved = id;
        }
        if (fromType === 'OWNER') {
          const id = resolveOwnerId(rawFromId);
          if (!id) { errors.push(`Row ${rowNo}: FromId owner not found: "${rawFromId}"`); continue; }
          fromIdResolved = id;
        }
        if (toType === 'OWNER') {
          const id = resolveOwnerId(rawToId);
          if (!id) { errors.push(`Row ${rowNo}: ToId owner not found: "${rawToId}"`); continue; }
          toIdResolved = id;
        }
        if (fromType === 'BANK') {
          const m = banks.find(b => String(b.name || '').toLowerCase() === normalize(rawFromId).toLowerCase());
          if (!m) { errors.push(`Row ${rowNo}: FromId bank not found: "${rawFromId}"`); continue; }
          fromIdResolved = m.name;
        }
        if (toType === 'BANK') {
          const m = banks.find(b => String(b.name || '').toLowerCase() === normalize(rawToId).toLowerCase());
          if (!m) { errors.push(`Row ${rowNo}: ToId bank not found: "${rawToId}"`); continue; }
          toIdResolved = m.name;
        }

        const pm = (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE' || paymentMethod === 'CASH') ? paymentMethod : 'CASH';
        const st = (status === 'PENDING' || status === 'COMPLETED' || status === 'CANCELLED') ? status : 'COMPLETED';

        try {
          await saveTransfer({
            date: dateStr,
            fromType,
            toType,
            fromId: fromIdResolved,
            toId: toIdResolved,
            amount: amt,
            purpose,
            notes: notes || undefined,
            paymentMethod: pm,
            fromBankName: (pm === 'BANK' || pm === 'CHEQUE') ? (fromBankName || undefined) : undefined,
            toBankName: (pm === 'BANK' || pm === 'CHEQUE') ? (toBankName || undefined) : undefined,
            status: st,
            createdBy: currentUser.id,
            createdAt: Date.now(),
          } as any);
          ok++;
        } catch (e: any) {
          errors.push(`Row ${rowNo}: failed to import (${e?.message || 'unknown error'})`);
        }
      }

      if (errors.length) {
        showToast(`Imported ${ok}/${records.length}. Errors: ${errors.slice(0, 6).join(' · ')}${errors.length > 6 ? ` (+${errors.length - 6} more)` : ''}`, 'warning');
      } else {
        showSuccess(`Imported ${ok} transfer(s).`);
      }

      setTransfers(await getTransfers({ includeDeleted: true }));
      setShowImportModal(false);
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      setImportBusy(true);
      const data = await file.arrayBuffer();
      let rows: any[] = [];

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
      } else {
        const text = new TextDecoder().decode(data);
        const grid = parseCsv(text);
        if (grid.length < 2) { showError('CSV must include header row + data rows.'); return; }
        const header = grid[0].map(h => normalize(h));
        rows = grid.slice(1).map(r => {
          const obj: any = {};
          header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
          return obj;
        });
      }

      const normalized = rows.map((r: any) => ({
        Date: r.Date ?? r.date ?? r.DATE ?? '',
        FromType: r.FromType ?? r.fromType ?? r.FROMTYPE ?? '',
        FromId: r.FromId ?? r.fromId ?? r.FROMID ?? '',
        ToType: r.ToType ?? r.toType ?? r.TOTYPE ?? '',
        ToId: r.ToId ?? r.toId ?? r.TOID ?? '',
        Amount: r.Amount ?? r.amount ?? r.AMOUNT ?? '',
        Purpose: r.Purpose ?? r.purpose ?? r.PURPOSE ?? '',
        Notes: r.Notes ?? r.notes ?? r.NOTES ?? '',
        PaymentMethod: r.PaymentMethod ?? r.paymentMethod ?? r.PAYMENTMETHOD ?? '',
        FromBankName: r.FromBankName ?? r.fromBankName ?? r.FROMBANKNAME ?? '',
        ToBankName: r.ToBankName ?? r.toBankName ?? r.TOBANKNAME ?? '',
        Status: r.Status ?? r.status ?? r.STATUS ?? '',
      }));

      await importTransfersFromRows(normalized);
    } catch (e: any) {
      showError(e?.message || 'Failed to import file.');
    } finally {
      setImportBusy(false);
    }
  };

  const ownerExpenseTxs = useMemo(() => {
    return (allTransactions || []).filter((tx: any) => {
      if (!tx) return false;
      const ty = String(tx.type || '').toUpperCase();
      if (ty !== String(TransactionType.EXPENSE)) return false;
      if ((tx as any).deleted) return false;
      if ((tx as any).treasuryConverted) return false;
      return isOwnerExpenseCategory(tx);
    });
  }, [allTransactions]);

  /** Owner expense rows already converted to Treasury (visible across books when merged). */
  const ownerExpenseConvertedTxs = useMemo(() => {
    return (allTransactions || [])
      .filter((tx: any) => {
        if (!tx || (tx as any).deleted) return false;
        if (!(tx as any).treasuryConverted) return false;
        const ty = String(tx.type || '').toUpperCase();
        if (ty !== String(TransactionType.EXPENSE)) return false;
        const kind = String((tx as any).treasuryConversionKind || '').trim();
        if (kind === TREASURY_CONVERSION_OWNER_EXPENSE) return true;
        // Legacy: only rows without a kind still count if they look like owner expense.
        if (!kind && isOwnerExpenseCategory(tx)) return true;
        return false;
      })
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [allTransactions]);

  const filteredOwnerExpenseConverted = useMemo(() => {
    return ownerExpenseConvertedTxs.filter((tx: any) => {
      if (filterFromDate && (tx.date || '') < filterFromDate) return false;
      if (filterToDate && (tx.date || '') > filterToDate) return false;
      if (filterBuildingIds.length > 0) {
        const rawBid = String((tx as any).buildingId || '').trim();
        if (!rawBid || rawBid === 'HEAD_OFFICE') return false;
        const txBook = String((tx as any)._bookId || activeBookId);
        const lookup = rawBid.includes(':') ? rawBid : txBook === activeBookId ? rawBid : `${txBook}:${rawBid}`;
        let b = buildings.find((bb) => bb.id === lookup);
        if (!b && lookup.includes(':')) {
          const [bookId, rawId] = lookup.split(':');
          b = buildings.find((bb) => bb.bookId === bookId && bb.rawId === rawId);
        }
        if (!b) b = buildings.find((bb) => bb.rawId === rawBid || bb.id === rawBid);
        if (!b || !filterBuildingIds.includes(b.id)) return false;
      }
      return true;
    });
  }, [ownerExpenseConvertedTxs, filterFromDate, filterToDate, filterBuildingIds, buildings, activeBookId]);

  const ownerExpenseConvertedFromOtherBooks = useMemo(
    () =>
      filteredOwnerExpenseConverted.filter(
        (tx: any) => String((tx as any)._bookId || activeBookId) !== String(activeBookId),
      ),
    [filteredOwnerExpenseConverted, activeBookId],
  );

  const convertedOtherBooksTotalSar = useMemo(
    () =>
      ownerExpenseConvertedFromOtherBooks.reduce(
        (s, tx: any) => s + Math.abs(Number(tx.amountIncludingVAT || tx.totalWithVat || tx.amount || 0)),
        0,
      ),
    [ownerExpenseConvertedFromOtherBooks],
  );

  const canFixOwnerExpense =
    isAdminOrHead || currentUser.role === UserRole.MANAGER;

  const handleConvertOwnerExpensesToTreasury = () => {
    if (!canFixOwnerExpense) return;
    const count = ownerExpenseTxs.length;
    if (count === 0) {
      showToast('No Owner Expense transactions found to convert.', 'info');
      return;
    }
    openConfirm(
      `Convert ${count} Owner Expense transaction(s) into Treasury transfers?\n\nEach transfer will be Building → Owner (same building as on the expense), the History row will be marked converted, and future fixes will skip it.`,
      async () => {
        setImportBusy(true);
        try {
          let ok = 0;
          let skippedNoOwner = 0;
          let skippedNoBuilding = 0;
          let skippedAmount = 0;
          for (const tx of ownerExpenseTxs as any[]) {
            const ownerId =
              String((tx as any).ownerId || '').trim() ||
              (tx.ownerName ? resolveOwnerId(String(tx.ownerName)) || '' : '');
            if (!ownerId) {
              skippedNoOwner++;
              continue;
            }
            const rawBuilding = String((tx as any).buildingId || '').trim();
            if (!rawBuilding || rawBuilding === 'HEAD_OFFICE') {
              skippedNoBuilding++;
              continue;
            }
            const txBook = String((tx as any)._bookId || activeBookId);
            const lookupKey = rawBuilding.includes(':')
              ? rawBuilding
              : txBook === String(activeBookId)
                ? rawBuilding
                : `${txBook}:${rawBuilding}`;
            const fromId = resolveBuildingId(lookupKey) || resolveBuildingId(rawBuilding);
            if (!fromId) {
              skippedNoBuilding++;
              continue;
            }
            const pm = String((tx as any).paymentMethod || '').toUpperCase();
            const paymentMethod = pm === 'BANK' || pm === 'CHEQUE' || pm === 'CASH' ? pm : 'CASH';
            const amt = Math.abs(Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount || 0));
            if (!amt) {
              skippedAmount++;
              continue;
            }

            const created: any = {
              date: tx.date || new Date().toISOString().split('T')[0],
              fromType: 'BUILDING',
              fromId,
              toType: 'OWNER',
              toId: ownerId,
              amount: amt,
              purpose: 'Owner Expense (converted)',
              notes: `Converted from transaction ${tx.id}`,
              paymentMethod,
              status: 'COMPLETED',
              createdBy: currentUser.id,
              createdAt: Date.now(),
            };
            await saveTransfer(created);
            const payload = {
              ...(tx as any),
              treasuryConverted: true,
              treasuryConversionKind: TREASURY_CONVERSION_OWNER_EXPENSE,
            } as any;
            if (txBook === String(activeBookId)) {
              await saveTransaction(payload);
            } else {
              await saveTransactionInBook(txBook, payload);
            }
            ok++;
          }
          refreshAfterMutation();
          const parts = [`Converted ${ok} transaction(s) into Treasury transfers.`];
          if (skippedNoOwner) parts.push(`Skipped ${skippedNoOwner} (no owner).`);
          if (skippedNoBuilding) parts.push(`Skipped ${skippedNoBuilding} (no building on file).`);
          if (skippedAmount) parts.push(`Skipped ${skippedAmount} (zero amount).`);
          showSuccess(parts.join(' '));
          closeConfirm();
          setShowImportModal(false);
        } catch (e: any) {
          showError(e?.message || 'Failed to convert owner expenses.');
        } finally {
          setImportBusy(false);
        }
      },
      { title: 'Convert Owner Expenses', danger: false }
    );
  };

  const rawOf = (v?: string) => (v && String(v).includes(':')) ? String(v).slice(String(v).indexOf(':') + 1) : (v || '');
  /** Normalize transfer endpoint types (Firestore / imports may use different casing). */
  const treTy = (t?: any) => String(t ?? '').trim().toUpperCase();
  const matchesAnyBuilding = (t: any, ids: string[]) => {
    if (!ids || ids.length === 0) return true;
    const from = String(t?.fromId || '');
    const to = String(t?.toId || '');
    const fromRaw = rawOf(from);
    const toRaw = rawOf(to);
    return ids.some((id) => {
      const want = String(id || '');
      const wantRaw = rawOf(want);
      return want === from || want === to || (wantRaw && (wantRaw === fromRaw || wantRaw === toRaw));
    });
  };

  // Popover positioning + close-on-outside-click
  useEffect(() => {
    if (!showBuildingPicker) return;
    const updatePos = () => {
      const rect = buildingTriggerRef.current?.getBoundingClientRect();
      if (rect) setBuildingPickerRect({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    updatePos();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (buildingPickerRef.current?.contains(target)) return;
      if (buildingTriggerRef.current?.contains(target)) return;
      setShowBuildingPicker(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowBuildingPicker(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showBuildingPicker]);

  useEffect(() => {
    loadData();
    // Re-load whenever the list of books (or the active book) changes so
    // that newly created books surface their buildings immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, activeBookId, includeOtherBooksInTreasury]);

  const loadData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setListLoading(true);
    try {
    const canCrossBookTreasury =
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === 'HEAD' ||
      currentUser.role === UserRole.OWNER ||
      currentUser.role === UserRole.MANAGER;
    const mergeOtherBooks = canCrossBookTreasury && includeOtherBooksInTreasury;

    const bookList = books && books.length > 0 ? books : [{ id: 'default', name: 'Main Book' } as any];
    const activeName = (bookList.find((b: any) => b.id === activeBookId)?.name) || 'Main Book';

    let merged: BookBuilding[] = [];
    if (mergeOtherBooks) {
      const perBook = await Promise.all(
        bookList.map(async (bk: any) => {
          try {
            const data = await getDataFromBook(bk.id);
            return (data.buildings || []).map((b: any): BookBuilding => ({
              ...(b as Building),
              rawId: b.id,
              bookId: bk.id,
              bookName: bk.name || bk.id,
              id: bk.id === activeBookId ? b.id : `${bk.id}:${b.id}`,
            }));
          } catch {
            return [] as BookBuilding[];
          }
        })
      );
      merged = perBook.flat();
    }

    // Always include the active book's buildings via the scope-aware getter.
    try {
      const activeBuildings = await getBuildings();
      activeBuildings.forEach((b: any) => {
        if (!merged.some(m => m.bookId === activeBookId && m.rawId === b.id)) {
          merged.push({ ...(b as Building), rawId: b.id, bookId: activeBookId, bookName: activeName, id: b.id });
        }
      });
    } catch { /* ignore */ }

    // Without "all books", Treasury lists only the active book's buildings.
    if (!mergeOtherBooks) {
      merged = merged.filter(b => b.bookId === activeBookId);
    }
    // Same rule as `filterByScope` in firestoreService: only ADMIN, MANAGER, HEAD, OWNER
    // bypass per-building assignment. Everyone else (staff) only sees assigned building(s)
    // in the active book.
    const isAssignmentScoped =
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.MANAGER &&
      currentUser.role !== 'HEAD' &&
      currentUser.role !== UserRole.OWNER;
    if (isAssignmentScoped) {
      const allowed = new Set(
        (currentUser.buildingIds && currentUser.buildingIds.length > 0
          ? currentUser.buildingIds
          : (currentUser.buildingId ? [currentUser.buildingId] : [])) as string[],
      );
      merged = allowed.size > 0
        ? merged.filter(b => allowed.has(b.rawId) || allowed.has(b.id))
        : [];
    }

    setBuildings(merged);
    setBanks(await getBanks());
    const transfersList = await getTransfers({ includeDeleted: true });
    setTransfers(transfersList);
    const allUsers = await getUsersAcrossBooks();
    let allTx: any[] = (await getTransactions({ role: 'ADMIN', includeDeleted: true } as any)) || [];
    allTx = allTx.map((t: any) => ({ ...t, _bookId: (t as any)._bookId || activeBookId }));
    if (mergeOtherBooks) {
      const seen = new Set(allTx.map((t: any) => `${(t as any)._bookId}:${t.id}`));
      for (const bk of bookList) {
        if (bk.id === activeBookId) continue;
        try {
          const data = await getDataFromBook(bk.id);
          for (const t of data.transactions || []) {
            const key = `${bk.id}:${t.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if ((t as any).deleted) continue;
            allTx.push({ ...t, _bookId: bk.id });
          }
        } catch {
          /* ignore */
        }
      }
    }
    setAllTransactions(allTx);

    const roleKey = (r: any) => String(r || '').trim().toUpperCase();
    const isLikelyOwnerProfile = (u: any) => {
      if (!u) return false;
      if (roleKey(u.role) === roleKey(UserRole.OWNER)) return true;
      if (u.isOwner === true || String(u.isOwner).toLowerCase() === 'true') return true;
      if (Array.isArray(u.ownerBuildingIds) && u.ownerBuildingIds.length > 0) return true;
      const sp = Number(u.sharePercentage);
      return Number.isFinite(sp) && sp > 0;
    };

    const refOwnerIds = new Set<string>();
    const addRefOwner = (id?: string) => {
      const s = String(id || '').trim();
      if (s) refOwnerIds.add(s);
    };
    for (const tr of transfersList || []) {
      const ft = String((tr as any)?.fromType || '').toUpperCase();
      const tt = String((tr as any)?.toType || '').toUpperCase();
      if (ft === 'OWNER') addRefOwner((tr as any).fromId);
      if (tt === 'OWNER') addRefOwner((tr as any).toId);
    }
    for (const t of allTx || []) {
      addRefOwner((t as any).ownerId);
    }

    const byOwnerId = new Map<string, any>();
    for (const u of allUsers || []) {
      if (!isLikelyOwnerProfile(u)) continue;
      byOwnerId.set(String(u.id), u);
    }
    for (const rid of refOwnerIds) {
      const full = String(rid).trim();
      if (!full || byOwnerId.has(full)) continue;
      const stripped = rawOf(full);
      const match =
        (allUsers || []).find((x: any) => String(x.id) === full) ||
        (stripped && stripped !== full ? (allUsers || []).find((x: any) => String(x.id) === stripped) : undefined);
      if (match) byOwnerId.set(String(match.id), match);
    }
    const uniqOwners = Array.from(byOwnerId.values());
    uniqOwners.sort((a: any, b: any) =>
      treasuryUserLabel(a).localeCompare(treasuryUserLabel(b), undefined, { sensitivity: 'base' }),
    );
    setOwners(uniqOwners as any);
    const hoExpenses = (allTx || []).filter(
      (t: Transaction) =>
        t.type === TransactionType.EXPENSE &&
        t.buildingId === 'HEAD_OFFICE' &&
        !(t as any).deleted &&
        String((t as any)._bookId || activeBookId) === String(activeBookId),
    );
    setHeadOfficeExpenses(hoExpenses);
    } finally {
    if (!opts?.silent) setListLoading(false);
    }
  };

  const refreshAfterMutation = () => { void loadData({ silent: true }); };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setFromType('BUILDING');
    setToType('HEAD_OFFICE');
    setFromId('');
    setToId('');
    setAmount('');
    setPurpose('');
    setNotes('');
    setPaymentMethod('CASH');
    setFromBankName('');
    setToBankName('');
    setIsOfficeOpeningBalance(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    SoundService.play('submit');
    if (!amount || parseFloat(amount) <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    // Require both source AND destination banks for bank/cheque transfers
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !isOfficeOpeningBalance) {
      if (!fromBankName) { showError('Please select the source bank (From Bank)'); return; }
      if (!toBankName) { showError('Please select the destination bank (To Bank)'); return; }
    }

    // Require purpose and notes
    if (!isOfficeOpeningBalance && !purpose) {
      showError('Please select a purpose');
      return;
    }
    if (!isOfficeOpeningBalance && !notes.trim()) {
      showError('Please enter notes');
      return;
    }

    // Inter-building validations
    if (!isOfficeOpeningBalance && fromType === 'BUILDING' && toType === 'BUILDING') {
      if (!fromId || !toId) { showError('Select both source and destination buildings'); return; }
      if (fromId === toId) { showError('Source and destination buildings must be different'); return; }
    }

    const transfer: Transfer = {
      id: crypto.randomUUID(),
      date,
      fromType: isOfficeOpeningBalance ? 'HEAD_OFFICE' : fromType,
      toType: isOfficeOpeningBalance ? 'HEAD_OFFICE' : toType,
      fromId: isOfficeOpeningBalance ? 'OFFICE_BALANCE' : (fromType === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : fromId),
      toId: isOfficeOpeningBalance ? 'OFFICE_BALANCE' : (toType === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : toId),
      amount: parseFloat(amount),
      purpose: isOfficeOpeningBalance ? 'Office Opening Balance (Old System)' : purpose,
      notes,
      paymentMethod: isOfficeOpeningBalance ? undefined : paymentMethod,
      bankName: (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !isOfficeOpeningBalance ? fromBankName : undefined,
      fromBankName: (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !isOfficeOpeningBalance ? fromBankName : undefined,
      toBankName: (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !isOfficeOpeningBalance ? toBankName : undefined,
      status: 'COMPLETED', // Office opening balance is always completed
      createdBy: currentUser.id,
      createdAt: Date.now(),
      isOfficeOpeningBalance: isOfficeOpeningBalance || undefined
    };

    setSubmitting(true);
    try {
      await saveTransfer(transfer);
      showSuccess('Transfer saved. Added to Amlak Sheets as posted.');
      setView('LIST');
      resetForm();
      refreshAfterMutation();
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve a stored id against the multi-book building list.
  // Stored ids may be a raw building id (active book, legacy) OR
  // a composite `${bookId}:${buildingId}` for other books.
  const findBookBuilding = (id?: string): BookBuilding | undefined => {
    if (!id) return undefined;
    let match = buildings.find(b => b.id === id);
    if (match) return match;
    if (id.includes(':')) {
      const [bookId, rawId] = id.split(':');
      match = buildings.find(b => b.bookId === bookId && b.rawId === rawId);
      if (match) return match;
    }
    // Fall back to raw id match (covers legacy data written before multi-book)
    match = buildings.find(b => b.rawId === id);
    return match;
  };

  const labelOwnerExpenseBuilding = (tx: any): string => {
    const txBook = String((tx as any)._bookId || activeBookId);
    const rawBid = String((tx as any).buildingId || '').trim();
    if (!rawBid || rawBid === 'HEAD_OFFICE') return 'Head Office';
    const id = txBook === activeBookId ? rawBid : `${txBook}:${rawBid}`;
    const b = findBookBuilding(id);
    if (b) return b.bookId === activeBookId ? String(b.name || b.rawId) : `${b.name} · ${b.bookName}`;
    return String((tx as any).buildingName || rawBid);
  };

  // Build option groups for building dropdowns, with the active book first and
  // other books (if any) rendered as separate <optgroup>s.
  const renderBuildingOptions = () => {
    const groups = new Map<string, { bookName: string; items: BookBuilding[] }>();
    buildings.forEach(b => {
      const key = b.bookId;
      if (!groups.has(key)) groups.set(key, { bookName: b.bookName, items: [] });
      groups.get(key)!.items.push(b);
    });
    // Active book first, others alphabetical by name
    const ordered = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === activeBookId) return -1;
      if (b[0] === activeBookId) return 1;
      return a[1].bookName.localeCompare(b[1].bookName);
    });
    // If there's only one book (the active one) keep the legacy flat rendering.
    if (ordered.length <= 1) {
      return (ordered[0]?.items || buildings).map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ));
    }
    return ordered.map(([bookId, g]) => (
      <optgroup key={bookId} label={`${g.bookName}${bookId === activeBookId ? ' (current)' : ''}`}>
        {g.items.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </optgroup>
    ));
  };

  /** Human-readable payment method label that shows bank flow when applicable. */
  const formatPaymentMethod = (tx: any): string => {
    if (!tx) return '';
    const pm = String(tx.paymentMethod || '').toUpperCase();
    const fromBank = tx.fromBankName || (pm === 'BANK' || pm === 'CHEQUE' ? tx.bankName : '') || '';
    const toBank = tx.toBankName || '';
    const label = pm === 'BANK' ? 'Bank Transfer' : pm === 'CHEQUE' ? 'Cheque' : pm === 'CASH' ? 'Cash' : pm;
    if (fromBank && toBank) return `${label}: ${fromBank} → ${toBank}`;
    if (fromBank) return `${label}: ${fromBank}`;
    return label;
  };

  const getOwnerDisplayName = (id?: string): string => {
    const v = String(id || '').trim();
    if (!v) return '';
    const stripped = rawOf(v) || v;
    const candidates = Array.from(new Set([v, stripped].filter(Boolean)));
    for (const cand of candidates) {
      const o = owners.find((x: any) => String(x.id) === cand);
      const nm = treasuryUserLabel(o);
      if (nm) return nm;
    }
    const resolved = resolveOwnerId(v) || resolveOwnerId(stripped);
    if (resolved) {
      const o = owners.find((x: any) => String(x.id) === resolved);
      const lab = treasuryUserLabel(o);
      if (lab) return lab;
    }
    return v;
  };

  const getBuildingName = (id?: string, type?: string) => {
    if (!id || id === 'HEAD_OFFICE') return 'Head Office';
    const ty = treTy(type);
    const idStripped = rawOf(String(id));
    if (ty === 'OWNER') {
      return getOwnerDisplayName(id);
    }
    const b = findBookBuilding(id);
    if (b) {
      // Tag the building with its book name when it lives in a non-active book.
      return b.bookId === activeBookId ? b.name : `${b.name} · ${b.bookName}`;
    }
    const bank = banks.find(x => x.name === id);
    if (bank) return bank.name;
    // Owner id stored without OWNER type (legacy / imports)
    const ownerGuess = owners.find((o: any) => String(o.id) === String(id) || String(o.id) === String(idStripped));
    if (ownerGuess) return treasuryUserLabel(ownerGuess);
    if (ty !== 'BUILDING' && ty !== 'BANK' && ty !== 'HEAD_OFFICE') {
      const guessName = getOwnerDisplayName(id);
      if (guessName && guessName !== id) return guessName;
    }
    return id;
  };

  const collectLinkedTxIds = (transfer: any): string[] => {
    const ids: string[] = [];
    if (transfer?.transactionId) ids.push(transfer.transactionId);
    if ((transfer as any)?.txId && !ids.includes((transfer as any).txId)) ids.push((transfer as any).txId);
    if ((transfer as any)?.transactionIdDest) ids.push((transfer as any).transactionIdDest);
    return ids;
  };

  const handleDelete = async (id: string) => {
    openConfirm('Move transfer to trash?', async () => {
      const transfer = transfers.find(t => t.id === id);
      if (!transfer) { closeConfirm(); return; }
      closeConfirm();
      const updated = { ...transfer, deleted: true, deletedAt: Date.now() } as any;
      const txIds = collectLinkedTxIds(transfer);
      try {
        await saveTransfer(updated);
        for (const txId of txIds) {
          const linkedTx = allTransactions.find((t: any) => t.id === txId);
          if (linkedTx) {
            await saveTransaction({ ...linkedTx, deleted: true, deletedAt: new Date().toISOString(), deletedBy: 'SYSTEM_TRANSFER_DELETE' } as any);
          }
        }
        refreshAfterMutation();
        showToast('Transfer moved to trash.', 'info', 6000, 'Undo', async () => {
          await saveTransfer({ ...updated, deleted: false, deletedAt: undefined } as any);
          for (const txId of txIds) {
            const linkedTx = allTransactions.find((t: any) => t.id === txId);
            if (linkedTx) {
              await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
            }
          }
          showSuccess('Transfer restored.');
          refreshAfterMutation();
        });
      } catch (e) {
        console.error('Transfer delete failed', e);
        showError('Failed to move transfer to trash.');
        refreshAfterMutation();
      }
    });
  };

  const handleRestore = async (id: string) => {
    openConfirm('Restore this transfer?', async () => {
      const transfer = transfers.find(t => t.id === id);
      if (!transfer) { closeConfirm(); return; }
      closeConfirm();
      try {
        const updated = { ...transfer, deleted: false, deletedAt: undefined } as any;
        await saveTransfer(updated);
        const txIds = collectLinkedTxIds(transfer);
        for (const txId of txIds) {
          const linkedTx = allTransactions.find((t: any) => t.id === txId);
          if (linkedTx) {
            await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
          }
        }
        refreshAfterMutation();
      } catch (e) {
        console.error('Transfer restore failed', e);
        showError('Failed to restore transfer.');
        refreshAfterMutation();
      }
    });
  };

  const handlePermanentDelete = async (id: string) => {
    openConfirm('PERMANENTLY delete transfer? This cannot be undone!', async () => {
      closeConfirm();
      try {
        await deleteTransfer(id);
        refreshAfterMutation();
      } catch (e) {
        console.error('Transfer permanent delete failed', e);
        showError('Failed to delete transfer.');
        refreshAfterMutation();
      }
    }, { danger: true, title: 'Delete Transfer' });
  };

  const handleRestoreAll = () => {
    const deleted = transfers.filter(t => (t as any).deleted);
    if (deleted.length === 0) return;
    openConfirm(`Restore all ${deleted.length} trashed transfers?`, async () => {
      closeConfirm();
      try {
        await Promise.all(deleted.map(async t => {
          await saveTransfer({ ...t, deleted: false, deletedAt: undefined } as any);
          const txIds = collectLinkedTxIds(t);
          for (const txId of txIds) {
            const linkedTx = allTransactions.find((tx: any) => tx.id === txId);
            if (linkedTx) {
              await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
            }
          }
        }));
        showSuccess('All trashed transfers restored.');
        refreshAfterMutation();
      } catch (e) {
        console.error('Restore all transfers failed', e);
        showError('Failed to restore all transfers.');
        refreshAfterMutation();
      }
    });
  };

  const handleDeleteAll = () => {
    const deleted = transfers.filter(t => (t as any).deleted && !t.isOfficeOpeningBalance);
    if (deleted.length === 0) return;
    openConfirm(`PERMANENTLY delete all ${deleted.length} trashed transfers? This cannot be undone!`, async () => {
      closeConfirm();
      try {
        await Promise.all(deleted.map(tx => deleteTransfer(tx.id)));
        showSuccess('All trashed transfers permanently deleted.');
        refreshAfterMutation();
      } catch (e) {
        console.error('Delete all transfers failed', e);
        showError('Failed to delete all transfers.');
        refreshAfterMutation();
      }
    }, { danger: true, title: 'Delete All Transfers' });
  };

  const handleEditTransferOpen = (transfer: Transfer) => {
    if (!isAdmin) {
      showError('Only administrators can edit treasury transfers.');
      return;
    }
    setEditTransferItem(transfer);
    setEditTransferDate(transfer.date);
    setEditTransferFromType(transfer.fromType);
    setEditTransferToType(transfer.toType);
    setEditTransferFromId(transfer.fromId || '');
    setEditTransferToId(transfer.toId || '');
    setEditTransferAmount(String(transfer.amount || ''));
    setEditTransferPurpose(transfer.purpose || '');
    setEditTransferNotes(transfer.notes || '');
    setEditTransferStatus(transfer.status || 'COMPLETED');
    setEditTransferPaymentMethod(transfer.paymentMethod || 'CASH');
    setEditTransferFromBank(transfer.fromBankName || transfer.bankName || '');
    setEditTransferToBank(transfer.toBankName || '');
    setShowEditTransferModal(true);
  };

  const handleEditTransferSubmit = () => {
    if (!isAdmin) {
      showError('Only administrators can edit treasury transfers.');
      return;
    }
    if (!editTransferItem || !editTransferDate) return;
    const nextAmount = parseFloat(editTransferAmount);
    if (!nextAmount || nextAmount <= 0) {
      showError('Enter a valid amount');
      return;
    }
    const normalizedFromId = editTransferFromType === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : editTransferFromId;
    const normalizedToId = editTransferToType === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : editTransferToId;
    if (editTransferFromType !== 'HEAD_OFFICE' && !normalizedFromId) {
      showError('Select the source account');
      return;
    }
    if (editTransferToType !== 'HEAD_OFFICE' && !normalizedToId) {
      showError('Select the destination account');
      return;
    }
    if (editTransferFromType === editTransferToType && normalizedFromId === normalizedToId) {
      showError('Source and destination must be different');
      return;
    }
    if (!editTransferPurpose.trim()) {
      showError('Enter a purpose');
      return;
    }
    if (!editTransferNotes.trim()) {
      showError('Enter notes');
      return;
    }
    const needsBanks = editTransferPaymentMethod === 'BANK' || editTransferPaymentMethod === 'CHEQUE';
    if (needsBanks && (!editTransferFromBank || !editTransferToBank)) {
      showError('Select both From Bank and To Bank');
      return;
    }
    const pmLabel: Record<string, string> = { BANK: 'Bank Transfer', CASH: 'Cash', CHEQUE: 'Cheque' };
    const lines = [
      'Please verify before saving:',
      '',
      `Date: ${editTransferDate}`,
      `From: ${getBuildingName(normalizedFromId, editTransferFromType)}`,
      `To: ${getBuildingName(normalizedToId, editTransferToType)}`,
      `Amount: ${nextAmount.toLocaleString()} SAR`,
      `Purpose: ${editTransferPurpose.trim()}`,
      `Payment Method: ${pmLabel[editTransferPaymentMethod] || editTransferPaymentMethod}`,
      ...(needsBanks ? [`From Bank: ${editTransferFromBank}`, `To Bank: ${editTransferToBank}`] : []),
      `Status: ${editTransferStatus}`,
      '',
      'Is this information correct?',
    ];
    openConfirm(lines.join('\n'), async () => {
      const updated: Transfer = {
        ...editTransferItem!,
        date: editTransferDate,
        fromType: editTransferFromType,
        toType: editTransferToType,
        fromId: normalizedFromId,
        toId: normalizedToId,
        amount: nextAmount,
        purpose: editTransferPurpose.trim(),
        notes: editTransferNotes.trim(),
        status: editTransferStatus,
        paymentMethod: editTransferPaymentMethod,
        bankName: needsBanks ? editTransferFromBank : undefined,
        fromBankName: needsBanks ? editTransferFromBank : undefined,
        toBankName: needsBanks ? editTransferToBank : undefined,
      };
      await saveTransfer(updated);
      showSuccess('Transfer updated successfully. Added to Amlak Sheets as posted.');
      setShowEditTransferModal(false);
      closeConfirm();
      refreshAfterMutation();
    }, { title: 'Confirm Edit Changes' });
  };

  const handleApprove = async (transfer: Transfer) => {
    if (actionProcessingId) return;
    setActionProcessingId(transfer.id);
    try {
      await saveTransfer({ ...transfer, status: 'COMPLETED' });
      refreshAfterMutation();
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleReject = async (transfer: Transfer) => {
    if (actionProcessingId) return;
    setActionProcessingId(transfer.id);
    try {
      await saveTransfer({ ...transfer, status: 'CANCELLED' });
      refreshAfterMutation();
    } finally {
      setActionProcessingId(null);
    }
  };

  // Get staff's assigned buildings
  const userBuildingIds = currentUser.buildingIds || (currentUser.buildingId ? [currentUser.buildingId] : []);
  const isStaff = !isAdminOrHead && currentUser.role !== UserRole.OWNER;

  const canCrossBookTreasuryControls =
    currentUser.role === UserRole.ADMIN ||
    (currentUser as any).role === 'HEAD' ||
    currentUser.role === UserRole.OWNER ||
    currentUser.role === UserRole.MANAGER;

  // ── Date presets (Treasury list) ───────────────────────────────────────────
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const applyDatePreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setFilterFromDate('');
      setFilterToDate('');
      return;
    }
    if (preset === 'THIS_MONTH') {
      setFilterFromDate(iso(startOfMonth(now)));
      setFilterToDate(iso(endOfMonth(now)));
      return;
    }
    if (preset === 'LAST_MONTH') {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      setFilterFromDate(iso(startOfMonth(last)));
      setFilterToDate(iso(endOfMonth(last)));
      return;
    }
    // CUSTOM: keep current values
  };

  const filteredTransfers = useMemo(() => transfers.filter(t => {
    // First filter by deleted status
    if (showDeleted ? !(t as any).deleted : (t as any).deleted) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterFromDate && t.date < filterFromDate) return false;
    if (filterToDate && t.date > filterToDate) return false;
    if (filterFromType !== 'ALL' && treTy(t.fromType) !== filterFromType) return false;
    if (filterToType !== 'ALL' && treTy(t.toType) !== filterToType) return false;
    if (!matchesAnyBuilding(t, filterBuildingIds)) return false;

    // Account / Building filter
    if (filterAccount !== 'ALL') {
      if (filterAccount === 'HEAD_OFFICE') {
        if (treTy(t.fromType) !== 'HEAD_OFFICE' && treTy(t.toType) !== 'HEAD_OFFICE') return false;
      } else {
        // building id
        if (t.fromId !== filterAccount && t.toId !== filterAccount) return false;
      }
    }

    // Staff can only see transfers involving their building(s), and NOT office opening balance
    if (isStaff) {
      // Hide office opening balance from staff (check both flag and ID)
      if (t.isOfficeOpeningBalance || t.fromId === 'OFFICE_BALANCE' || t.toId === 'OFFICE_BALANCE') return false;
      // Only show transfers from/to their buildings
      const involvesUserBuilding = userBuildingIds.includes(t.fromId) || userBuildingIds.includes(t.toId);
      if (!involvesUserBuilding) return false;
    }
    
    return true;
  }), [transfers, showDeleted, filterStatus, filterFromDate, filterToDate, filterFromType, filterToType, filterBuildingIds, filterAccount, isStaff, userBuildingIds]);

  // Get office opening balance (sum of all opening balance entries)
  const officeOpeningBalance = transfers.filter(t => t.isOfficeOpeningBalance && !(t as any).deleted).reduce((s, t) => s + t.amount, 0);
  
  // Exclude office opening balance from transfer totals
  const totalIn = filteredTransfers.filter(t => treTy(t.toType) === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s, t) => s + t.amount, 0);
  const totalOut = filteredTransfers.filter(t => treTy(t.fromType) === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s, t) => s + t.amount, 0);
  
  // Calculate HEAD_OFFICE expenses (filtered by date range if set)
  const filteredHOExpenses = headOfficeExpenses.filter(t => {
    if (filterFromDate && t.date < filterFromDate) return false;
    if (filterToDate && t.date > filterToDate) return false;
    return true;
  });
  const totalHOExpenses = filteredHOExpenses.reduce((s, t) => s + t.amount, 0);
  
  // Net Balance = Opening Balance + Transfers In - Transfers Out - Expenses
  const netBalance = officeOpeningBalance + totalIn - totalOut - totalHOExpenses;

  // Inter-building transfer totals (do not affect Head Office balance)
  const interBuildingTransfers = filteredTransfers.filter(t => treTy(t.fromType) === 'BUILDING' && treTy(t.toType) === 'BUILDING');
  const interBuildingTotal = interBuildingTransfers.reduce((s, t) => s + t.amount, 0);

  const handleSaveOpeningBalance = async () => {
    if (savingOpeningBal) return;
    const newAmount = parseFloat(openingBalInput);
    if (isNaN(newAmount)) { showError('Enter a valid amount'); return; }
    const existing = transfers.find(t => t.isOfficeOpeningBalance && !(t as any).deleted);
    const entry: Transfer = {
      id: existing?.id || crypto.randomUUID(),
      date: existing?.date || new Date().toISOString().split('T')[0],
      fromType: 'HEAD_OFFICE',
      toType: 'HEAD_OFFICE',
      fromId: 'OFFICE_BALANCE',
      toId: 'OFFICE_BALANCE',
      amount: newAmount,
      purpose: 'Office Opening Balance (Old System)',
      status: 'COMPLETED',
      createdBy: existing?.createdBy || currentUser.id,
      createdAt: existing?.createdAt || Date.now(),
      isOfficeOpeningBalance: true,
    };
    setSavingOpeningBal(true);
    try {
      await saveTransfer(entry);
      refreshAfterMutation();
      setEditingOpeningBal(false);
      showSuccess('Opening balance updated. Added to Amlak Sheets as posted.');
    } finally {
      setSavingOpeningBal(false);
    }
  };

  // Convert HEAD_OFFICE expenses to pseudo-transfer format for display
  const hoExpenseEntries = filteredHOExpenses.map(exp => ({
    id: `ho-exp-${exp.id}`,
    date: exp.date,
    fromType: 'HEAD_OFFICE' as const,
    toType: 'EXPENSE' as const,
    fromId: 'HEAD_OFFICE',
    toId: exp.customerName || exp.vendorName || exp.description || exp.expenseCategory || 'Expense',
    amount: exp.amount,
    purpose: exp.description || exp.expenseCategory || 'Head Office Expense',
    status: 'COMPLETED' as const,
    createdBy: exp.createdBy || '',
    createdAt: exp.createdAt || 0,
    isHOExpense: true,
    paymentMethod: exp.paymentMethod,
    originalExpense: exp
  }));

  /** Single-line From → To for table, CSV, and mobile. */
  const transferRouteText = (tx: any): string => {
    if (tx.isOfficeOpeningBalance) return 'Old System → Head Office';
    if ((tx as any).isHOExpense) return `Head Office → ${String(tx.toId || 'Expense')}`;
    return `${getBuildingName(tx.fromId, tx.fromType)} → ${getBuildingName(tx.toId, tx.toType)}`;
  };

  // Combined entries: transfers + HO expenses, sorted by date descending
  const combinedEntries = [...filteredTransfers.map(tx => ({ ...tx, isHOExpense: false })), ...hoExpenseEntries]
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleExportCSV = () => {
    const headers = ['Date', 'From → To', 'Amount (SAR)', 'Purpose', 'Status'];
    const rows = combinedEntries.map(tx => [
      tx.date,
      `"${transferRouteText(tx).replace(/"/g, '""')}"`,
      tx.amount.toLocaleString(),
      tx.purpose,
      (tx as any).isHOExpense ? 'EXPENSE' : tx.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // PDF Export — Account Statement style
  // Opens a styled print-preview window. User uses browser "Save as PDF".
  // When an account (building or Head Office) is selected, the statement is
  // produced from that account's perspective with running balance.
  // Otherwise, a consolidated statement is produced.
  // ────────────────────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtAmt = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Determine the account being viewed
    const accountKey = filterAccount;
    const accountLabel =
      accountKey === 'ALL' ? 'All Accounts' :
      accountKey === 'HEAD_OFFICE' ? 'Head Office' :
      (buildings.find(b => b.id === accountKey)?.name || accountKey);

    // A transfer/expense counts towards balances only when it's actually completed.
    // saveTransfer defaults to 'APPROVED' for regular transfers and 'COMPLETED' for
    // office-opening entries, so we accept both. Cancelled/deleted rows never count.
    const isEffectiveStatus = (s?: string) => {
      const v = String(s || 'APPROVED').toUpperCase();
      return v === 'APPROVED' || v === 'COMPLETED';
    };

    // Helper: does a transfer/expense entry belong to this account?
    const belongsToAccount = (tx: any): boolean => {
      if (accountKey === 'ALL') return true;
      if (accountKey === 'HEAD_OFFICE') return treTy(tx.fromType) === 'HEAD_OFFICE' || treTy(tx.toType) === 'HEAD_OFFICE' || tx.fromId === 'HEAD_OFFICE' || tx.toId === 'HEAD_OFFICE';
      return tx.fromId === accountKey || tx.toId === accountKey;
    };

    // Determine direction from account perspective
    // Returns { debit, credit } where debit = money OUT of account, credit = money IN
    const directionFor = (tx: any): { debit: number; credit: number; counterparty: string } => {
      const amt = Number(tx.amount) || 0;
      // HO expense entries always go OUT of Head Office
      if (tx.isHOExpense) {
        return { debit: amt, credit: 0, counterparty: tx.toId || tx.purpose || 'Expense' };
      }
      if (accountKey === 'ALL') {
        // Consolidated: show volume in the debit column with a From → To description.
        return {
          debit: amt,
          credit: 0,
          counterparty: `${getBuildingName(tx.fromId, tx.fromType)}  →  ${getBuildingName(tx.toId, tx.toType)}`,
        };
      }
      const isSource = (accountKey === 'HEAD_OFFICE')
        ? (treTy(tx.fromType) === 'HEAD_OFFICE' || tx.fromId === 'HEAD_OFFICE')
        : tx.fromId === accountKey;
      if (isSource) {
        return { debit: amt, credit: 0, counterparty: getBuildingName(tx.toId, tx.toType) };
      }
      return { debit: 0, credit: amt, counterparty: getBuildingName(tx.fromId, tx.fromType) };
    };

    // Date range for the statement
    const periodFrom = filterFromDate || '';
    const periodTo = filterToDate || '';

    // ─── Treasury only (this tab) — no general ledger / rent / stock rows  ─
    // Summary + table use the same set: transfers in scope (filters except
    // dates on the list are applied below) + Head Office expenses as pseudo
    // rows. Cash / Bank is split from each line's effective payment method.
    const effM = (r: any) => String(r?.originalPaymentMethod || r?.paymentMethod || '').toUpperCase();
    const isBankMethod = (m: string) => m === 'BANK' || m === 'CHEQUE';
    const inPriorWindow = (d?: string) => !!periodFrom && !!d && d < periodFrom;
    const inPeriodWindow = (d?: string) =>
      (!periodFrom || (d || '') >= periodFrom) && (!periodTo || (d || '') <= periodTo);
    const isTransferLive = (t: any) => !!t && !(t as any).deleted && isEffectiveStatus((t as any).status);
    const isExpenseLive = (t: any) => {
      if (!t) return false;
      if ((t as any).deleted) return false;
      if ((t as any).paymentMethod === 'TREASURY_REVERSAL') return false;
      const s = String((t as any).status || 'APPROVED').toUpperCase();
      return s === 'APPROVED' || s === 'COMPLETED' || !(t as any).status;
    };

    const transferMatchesStatement = (t: Transfer) => {
      if (showDeleted ? !(t as any).deleted : (t as any).deleted) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterAccount !== 'ALL') {
        if (filterAccount === 'HEAD_OFFICE') {
          if (treTy(t.fromType) !== 'HEAD_OFFICE' && treTy(t.toType) !== 'HEAD_OFFICE') return false;
        } else {
          if (t.fromId !== filterAccount && t.toId !== filterAccount) return false;
        }
      }
      if (isStaff) {
        if (t.isOfficeOpeningBalance || t.fromId === 'OFFICE_BALANCE' || t.toId === 'OFFICE_BALANCE') return false;
        const involvesUserBuilding = userBuildingIds.includes(t.fromId) || userBuildingIds.includes(t.toId);
        if (!involvesUserBuilding) return false;
      }
      return true;
    };

    const transfersForStatement = transfers.filter(transferMatchesStatement);

    const hoExpensePseudo = (isStaff ? [] : headOfficeExpenses).map((exp: Transaction) => ({
      id: `ho-exp-${exp.id}` as any,
      date: exp.date,
      fromType: 'HEAD_OFFICE' as const,
      toType: 'EXPENSE' as const,
      fromId: 'HEAD_OFFICE',
      toId: exp.customerName || exp.vendorName || exp.description || (exp as any).expenseCategory || 'Expense',
      amount: exp.amount,
      purpose: (exp as any).description || (exp as any).expenseCategory || 'Head Office Expense',
      status: 'COMPLETED' as const,
      createdBy: exp.createdBy || '',
      createdAt: (exp as any).createdAt || 0,
      isHOExpense: true,
      paymentMethod: (exp as any).paymentMethod,
      originalPaymentMethod: (exp as any).originalPaymentMethod,
      notes: (exp as any).notes,
      originalExpense: exp,
    }));

    const combinedForStatement: any[] = [
      ...transfersForStatement.map((tx: any) => ({ ...tx, isHOExpense: false })),
      ...hoExpensePseudo,
    ];

    let openingCash = 0;
    let openingBank = 0;
    let periodCashIn = 0;
    let periodBankIn = 0;
    let periodCashOut = 0;
    let periodBankOut = 0;

    if (accountKey === 'HEAD_OFFICE') {
      openingCash += transfersForStatement
        .filter(t => t.isOfficeOpeningBalance && isEffectiveStatus(t.status))
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    }

    const applyFlow = (item: any, debit: number, credit: number, isPrior: boolean) => {
      const m = effM(item);
      const useBank = isBankMethod(m);
      const useCash = !useBank; // BANK/CHEQUE → bank; everything else → cash
      if (isPrior) {
        const net = credit - debit;
        if (useCash) openingCash += net;
        else openingBank += net;
        return;
      }
      if (debit) {
        if (useCash) periodCashOut += debit;
        else periodBankOut += debit;
      }
      if (credit) {
        if (useCash) periodCashIn += credit;
        else periodBankIn += credit;
      }
    };

    for (const tx of combinedForStatement) {
      if (!belongsToAccount(tx)) continue;
      if (tx.isHOExpense) {
        if (!isExpenseLive((tx as any).originalExpense)) continue;
      } else {
        if (tx.isOfficeOpeningBalance) continue;
        if (!isTransferLive(tx)) continue;
      }
      const { debit, credit } = directionFor(tx);
      const d = tx.date || '';
      if (inPriorWindow(d)) {
        if (accountKey === 'ALL') {
          // Consolidated: no single opening; period columns show volume only
        } else {
          applyFlow(tx, debit, credit, true);
        }
      } else if (inPeriodWindow(d)) {
        applyFlow(tx, debit, credit, false);
      }
    }

    const isConsolidatedAll = accountKey === 'ALL';
    const openingBalance = openingCash + openingBank;
    const periodTotalIn = periodCashIn + periodBankIn;
    const periodTotalOut = periodCashOut + periodBankOut;
    const closingCash = openingCash + periodCashIn - periodCashOut;
    const closingBank = openingBank + periodBankIn - periodBankOut;
    const closingFromSummary = openingBalance + periodTotalIn - periodTotalOut;
    const netMovement = periodTotalIn - periodTotalOut;

    const bodyEntries = combinedForStatement
      .filter((e: any) => !e.isOfficeOpeningBalance)
      .filter((e: any) => belongsToAccount(e))
      .filter((e: any) => inPeriodWindow(e.date))
      .sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) || ((a.createdAt || 0) - (b.createdAt || 0)),
      );

    let running = isConsolidatedAll ? 0 : openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const rowHtmlParts: string[] = [];

    for (const tx of bodyEntries) {
      if (tx.isHOExpense) {
        if (!isExpenseLive((tx as any).originalExpense)) continue;
      } else {
        if (!isTransferLive(tx)) continue;
      }
      const { debit, credit, counterparty } = directionFor(tx);
      totalDebit += debit;
      totalCredit += credit;
      if (!isConsolidatedAll) running += credit - debit;
      const ref = tx.isHOExpense
        ? `EXP-${String((tx as any).originalExpense?.id || tx.id).replace(/^ho-exp-/, '').slice(-6).toUpperCase()}`
        : `TR-${String(tx.id).slice(-6).toUpperCase()}`;
      const method = esc(formatPaymentMethod(tx));
      const typeTag = tx.isHOExpense
        ? `<span class="type-badge expense">Expense</span>`
        : (tx as any).fromType === 'BUILDING' && (tx as any).toType === 'BUILDING'
          ? `<span class="type-badge inter">Inter-Bldg</span>`
          : `<span class="type-badge transfer">Transfer</span>`;
      rowHtmlParts.push(`
        <tr>
          <td class="nowrap">${esc(fmtDate(tx.date))}</td>
          <td class="mono">${esc(ref)}</td>
          <td>
            <div class="desc-main">${esc(tx.purpose || (tx.isHOExpense ? 'Head Office Expense' : 'Treasury Transfer'))}</div>
            <div class="desc-sub">${typeTag} ${esc(counterparty)}${method ? ` · <span class="meta-method">${method}</span>` : ''}</div>
            ${tx.notes ? `<div class="desc-note">${esc(tx.notes)}</div>` : ''}
          </td>
          <td class="amt debit">${debit ? fmtAmt(debit) : '—'}</td>
          <td class="amt credit">${credit ? fmtAmt(credit) : '—'}</td>
          <td class="amt balance">${isConsolidatedAll ? '—' : fmtAmt(running)}</td>
        </tr>
      `);
    }
    const rowsHtml = rowHtmlParts.join('\n');
    const statementRowCount = rowHtmlParts.length;
    const closingBalance = isConsolidatedAll ? totalCredit - totalDebit : closingFromSummary;

    const filterChips: string[] = [];
    if (periodFrom) filterChips.push(`From: ${fmtDate(periodFrom)}`);
    if (periodTo) filterChips.push(`To: ${fmtDate(periodTo)}`);
    if (filterStatus !== 'ALL') filterChips.push(`Status: ${filterStatus}`);
    filterChips.push(`Account: ${accountLabel}`);

    const title = `Account Statement — ${accountLabel}`;

    const html = `
<html>
  <head>
    <title>${esc(title)}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      :root {
        --g900:#064e3b; --g800:#065f46; --g700:#047857; --g600:#059669;
        --g500:#10b981; --g400:#34d399; --g200:#a7f3d0; --g100:#d1fae5; --g50:#ecfdf5;
        --text-dark:#0f1a12; --text-mid:#334844; --text-light:#6b8078;
        --border:#d5e8dd; --stripe:#f7fcf9;
        --debit:#dc2626; --credit:#059669; --balance:#4338ca;
      }
      html, body { margin:0; padding:0; background:#f1f5f4; }
      body { font-family:'Inter',sans-serif; color:var(--text-dark); }
      .page { max-width:960px; margin:30px auto; background:white; border-radius:14px; box-shadow:0 6px 28px rgba(0,0,0,0.08); overflow:hidden; }

      /* Header */
      .hdr { padding:22px 28px; background:linear-gradient(135deg,var(--g900) 0%,var(--g700) 100%); color:white; position:relative; }
      .hdr::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--g400),var(--g200),var(--g400)); }
      .hdr-top { display:flex; align-items:center; justify-content:space-between; gap:14px; }
      .hdr-brand { display:flex; align-items:center; gap:12px; }
      .hdr-logo { width:46px; height:46px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--g400); overflow:hidden; }
      .hdr-logo img { width:34px; height:34px; object-fit:contain; }
      .hdr-title { font-size:20px; font-weight:800; letter-spacing:.3px; }
      .hdr-sub { font-size:11px; color:var(--g200); margin-top:2px; }
      .hdr-right { text-align:right; font-size:11px; line-height:1.55; opacity:.9; }

      /* Statement meta */
      .meta { display:grid; grid-template-columns:1fr 1fr; gap:0; border-bottom:1px solid var(--border); }
      .meta-block { padding:14px 28px; }
      .meta-block + .meta-block { border-left:1px solid var(--border); }
      .meta-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); }
      .meta-value { font-size:14px; font-weight:700; color:var(--text-dark); margin-top:4px; }
      .meta-value small { font-weight:500; color:var(--text-mid); font-size:11px; display:block; margin-top:2px; }

      /* Summary strip */
      .summary { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:0; border-bottom:1px solid var(--border); background:var(--g50); }
      .sum-card { padding:14px 18px; border-right:1px solid var(--border); position:relative; }
      .sum-card:last-child { border-right:none; }
      .sum-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:3px; }
      .sum-card.opening::before { background:#f59e0b; }
      .sum-card.debit::before   { background:var(--debit); }
      .sum-card.credit::before  { background:var(--credit); }
      .sum-card.closing::before { background:var(--balance); }
      .sum-label { font-size:9px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:var(--text-light); }
      .sum-value { font-size:18px; font-weight:800; margin-top:4px; color:var(--text-dark); }
      .sum-value.opening { color:#b45309; }
      .sum-value.debit { color:var(--debit); }
      .sum-value.credit { color:var(--credit); }
      .sum-value.closing { color:var(--balance); }
      .sum-sub { font-size:10px; color:var(--text-light); margin-top:2px; }
      .sum-split { display:flex; flex-direction:column; gap:2px; margin-top:6px; border-top:1px dashed var(--border); padding-top:5px; }
      .sum-split-row { display:flex; align-items:center; justify-content:space-between; font-size:10.5px; }
      .sum-split-row .label { display:flex; align-items:center; gap:5px; color:var(--text-mid); font-weight:600; letter-spacing:.3px; }
      .sum-split-row .dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
      .sum-split-row .dot.cash { background:#f59e0b; }
      .sum-split-row .dot.bank { background:#3b82f6; }
      .sum-split-row .val { font-weight:700; font-family:'Inter',sans-serif; color:var(--text-dark); }

      /* Table */
      .tbl-wrap { padding:0; }
      table { width:100%; border-collapse:collapse; }
      thead th { background:var(--g800); color:white; text-align:left; padding:10px 12px; font-size:10px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; }
      thead th.right { text-align:right; }
      tbody td { padding:10px 12px; font-size:11.5px; color:var(--text-dark); border-bottom:1px solid #eaf2ed; vertical-align:top; }
      tbody tr:nth-child(even) td { background:var(--stripe); }
      .nowrap { white-space:nowrap; }
      .mono { font-family:'JetBrains Mono','Courier New',monospace; font-size:10.5px; color:var(--text-mid); letter-spacing:.2px; }
      .amt { text-align:right; font-weight:700; font-family:'Inter',sans-serif; white-space:nowrap; }
      .amt.debit { color:var(--debit); }
      .amt.credit { color:var(--credit); }
      .amt.balance { color:var(--balance); font-weight:800; }
      .desc-main { font-weight:700; color:var(--text-dark); }
      .desc-sub { font-size:10px; color:var(--text-mid); margin-top:2px; }
      .desc-note { font-size:10px; color:var(--text-light); font-style:italic; margin-top:3px; }
      .meta-method { color:var(--text-mid); }

      .type-badge { display:inline-block; padding:1px 7px; border-radius:20px; font-size:8.5px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; margin-right:4px; }
      .type-badge.transfer { background:var(--g100); color:var(--g800); }
      .type-badge.expense { background:#fee2e2; color:#991b1b; }
      .type-badge.credit { background:#dcfce7; color:#166534; }
      .type-badge.inter { background:#e0e7ff; color:#3730a3; }

      /* Opening / Closing rows */
      tr.boundary td { background:#fef9c3 !important; font-weight:800; font-size:12px; padding:10px 12px; color:#713f12; }
      tr.boundary.closing td { background:#e0e7ff !important; color:#1e1b4b; }
      tr.boundary td.amt { text-align:right; }

      /* Footer */
      .footer { padding:14px 28px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--g50); }
      .footer-text { font-size:10px; color:var(--text-mid); }
      .footer-badge { display:inline-flex; align-items:center; gap:6px; background:var(--g800); color:white; padding:4px 10px; border-radius:20px; font-size:8.5px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; }
      .footer-badge img { width:14px; height:14px; object-fit:contain; border-radius:50%; }

      .filter-chips { padding:10px 28px; display:flex; flex-wrap:wrap; gap:6px; border-bottom:1px solid var(--border); background:#fafefb; }
      .chip { font-size:10px; background:white; border:1px solid var(--border); padding:3px 10px; border-radius:20px; color:var(--text-mid); font-weight:600; }

      .signature { display:grid; grid-template-columns:1fr 1fr; gap:28px; padding:18px 28px; border-top:1px solid var(--border); }
      .sig-box { border-top:1px dashed var(--text-light); padding-top:6px; font-size:10px; color:var(--text-light); text-align:center; font-weight:600; letter-spacing:.8px; text-transform:uppercase; }

      @media print {
        body { background:white; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .page { box-shadow:none; margin:0; border-radius:0; max-width:none; }
        thead { display:table-header-group; }
        tr { page-break-inside:avoid; }
        @page { size:A4; margin:10mm; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hdr">
        <div class="hdr-top">
          <div class="hdr-brand">
            <div class="hdr-logo"><img src="${window.location.origin}/images/cologo.png" alt="Logo" onerror="this.style.display='none'"/></div>
            <div>
              <div class="hdr-title">Account Statement</div>
              <div class="hdr-sub">Treasury &middot; ${esc(accountLabel)}</div>
            </div>
          </div>
          <div class="hdr-right">
            <div>Generated: ${esc(fmtDateTime(new Date()))}</div>
            <div>By: ${esc(currentUser?.name || (currentUser as any)?.email || '—')}</div>
          </div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-block">
          <div class="meta-label">Account Holder</div>
          <div class="meta-value">${esc(accountLabel)}
            <small>${accountKey === 'HEAD_OFFICE' ? 'Head Office treasury' : (accountKey === 'ALL' ? 'Consolidated view' : 'Building account')}</small>
          </div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Statement Period</div>
          <div class="meta-value">
            ${periodFrom ? esc(fmtDate(periodFrom)) : 'Beginning of records'} — ${periodTo ? esc(fmtDate(periodTo)) : 'Today'}
            <small>${statementRowCount} entries</small>
          </div>
        </div>
      </div>

      <div class="filter-chips">
        ${filterChips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}
      </div>

      <div class="summary">
        <div class="sum-card opening">
          <div class="sum-label">Opening Balance</div>
          <div class="sum-value opening">${isConsolidatedAll ? '—' : fmtAmt(openingBalance) + ' SAR'}</div>
          <div class="sum-sub">${isConsolidatedAll ? 'Treasury volume view (no single opening)' : (periodFrom ? 'Before ' + esc(fmtDate(periodFrom)) : 'Brought forward')}</div>
          <div class="sum-split">
            <div class="sum-split-row"><span class="label"><span class="dot cash"></span>Cash</span><span class="val">${isConsolidatedAll ? '—' : fmtAmt(openingCash)}</span></div>
            <div class="sum-split-row"><span class="label"><span class="dot bank"></span>Bank</span><span class="val">${isConsolidatedAll ? '—' : fmtAmt(openingBank)}</span></div>
          </div>
        </div>
        <div class="sum-card debit">
          <div class="sum-label">Total Debits</div>
          <div class="sum-value debit">${fmtAmt(totalDebit)} SAR</div>
          <div class="sum-sub">Money out ${accountKey === 'ALL' ? '(all buildings)' : ''}</div>
          <div class="sum-split">
            <div class="sum-split-row"><span class="label"><span class="dot cash"></span>Cash</span><span class="val">${fmtAmt(periodCashOut)}</span></div>
            <div class="sum-split-row"><span class="label"><span class="dot bank"></span>Bank</span><span class="val">${fmtAmt(periodBankOut)}</span></div>
          </div>
        </div>
        <div class="sum-card credit">
          <div class="sum-label">Total Credits</div>
          <div class="sum-value credit">${fmtAmt(totalCredit)} SAR</div>
          <div class="sum-sub">Money in ${accountKey === 'ALL' ? '(all buildings)' : ''}</div>
          <div class="sum-split">
            <div class="sum-split-row"><span class="label"><span class="dot cash"></span>Cash</span><span class="val">${fmtAmt(periodCashIn)}</span></div>
            <div class="sum-split-row"><span class="label"><span class="dot bank"></span>Bank</span><span class="val">${fmtAmt(periodBankIn)}</span></div>
          </div>
        </div>
        <div class="sum-card closing">
          <div class="sum-label">Closing Balance</div>
          <div class="sum-value closing">${fmtAmt(closingBalance)} SAR</div>
          <div class="sum-sub">${netMovement >= 0 ? 'Net +' : 'Net −'} ${fmtAmt(Math.abs(netMovement))}</div>
          <div class="sum-split">
            <div class="sum-split-row"><span class="label"><span class="dot cash"></span>Cash</span><span class="val">${isConsolidatedAll ? '—' : fmtAmt(closingCash)}</span></div>
            <div class="sum-split-row"><span class="label"><span class="dot bank"></span>Bank</span><span class="val">${isConsolidatedAll ? '—' : fmtAmt(closingBank)}</span></div>
          </div>
        </div>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:78px">Date</th>
              <th style="width:92px">Reference</th>
              <th>Description</th>
              <th class="right" style="width:95px">Debit</th>
              <th class="right" style="width:95px">Credit</th>
              <th class="right" style="width:110px">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr class="boundary">
              <td colspan="5">Opening Balance${periodFrom ? ' — as of ' + esc(fmtDate(periodFrom)) : ''}${isConsolidatedAll ? ' <span style="font-weight:600;color:#92400e;margin-left:6px">(N/A – consolidated)</span>' : ' <span style="font-weight:600;color:#92400e;margin-left:6px">(Cash ' + fmtAmt(openingCash) + ' · Bank ' + fmtAmt(openingBank) + ')</span>'}</td>
              <td class="amt">${isConsolidatedAll ? '—' : fmtAmt(openingBalance) + ' SAR'}</td>
            </tr>
            ${rowsHtml || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-light)">No transactions in the selected period.</td></tr>`}
            <tr class="boundary closing">
              <td colspan="3">Closing Balance${periodTo ? ' — as of ' + esc(fmtDate(periodTo)) : ''}${isConsolidatedAll ? ' <span style="font-weight:600;color:#312e81;margin-left:6px">(N/A – consolidated)</span>' : ' <span style="font-weight:600;color:#312e81;margin-left:6px">(Cash ' + fmtAmt(closingCash) + ' · Bank ' + fmtAmt(closingBank) + ')</span>'}</td>
              <td class="amt debit">${fmtAmt(totalDebit)} SAR</td>
              <td class="amt credit">${fmtAmt(totalCredit)} SAR</td>
              <td class="amt">${fmtAmt(closingBalance)} SAR</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="signature">
        <div class="sig-box">Prepared By</div>
        <div class="sig-box">Authorized Signature</div>
      </div>

      <div class="footer">
        <div class="footer-text">Computer-generated account statement. For internal records only.</div>
        <div class="footer-badge"><img src="${window.location.origin}/images/cologo.png" alt="" onerror="this.style.display='none'"/> Powered by Amlak</div>
      </div>
    </div>

    <script>
      window.onload = function(){
        setTimeout(function(){
          var imgs = document.images, c = 0, t = imgs.length;
          if (!t) { window.print(); return; }
          for (var i = 0; i < t; i++) {
            if (imgs[i].complete) { if (++c >= t) window.print(); }
            else { imgs[i].onload = imgs[i].onerror = function(){ if (++c >= t) window.print(); }; }
          }
        }, 250);
      };
    </script>
  </body>
</html>
    `;

    const win = window.open('', '_blank', 'width=1100,height=850');
    if (!win) { showError('Please allow popups to export PDF'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="glass-tab-bar mb-6 max-w-sm mx-auto">
        <button onClick={() => { setView('FORM'); resetForm(); }} className={`glass-tab ${view === 'FORM' ? 'is-active' : ''}`}>
          <Plus size={16} />
          <span>{t('transfer.newTransfer')}</span>
        </button>
        {!isStaff && (
          <button onClick={() => setView('LIST')} className={`glass-tab ${view === 'LIST' ? 'is-active' : ''}`}>
            <ArrowRightLeft size={16} />
            <span>{t('nav.history')}</span>
          </button>
        )}
      </div>

      {view === 'FORM' || isStaff ? (
        <form onSubmit={handleSubmit} className="ios-card premium-card p-5 sm:p-6 space-y-6 relative">
          <LoadingOverlay visible={submitting} inline message={t('common.saving')} />
          <div className="flex justify-between items-start gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">New Money Transfer</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">Move funds between buildings, head office, and owners — including inter-building transfers (separate books).</p>
            </div>

            {isAdminOrHead && (
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="shrink-0 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 hover:bg-slate-800 shadow-sm"
                title="Bulk import transfers (CSV/XLSX)"
              >
                <Upload size={16} /> Bulk Import
              </button>
            )}
          </div>

          {/* Office Opening Balance Toggle - ADMIN only */}
          {currentUser.role === UserRole.ADMIN && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <Wallet size={20} className="text-amber-600" />
                  <div>
                    <span className="text-sm font-bold text-slate-800">Office Opening Balance</span>
                    <p className="text-xs text-slate-500">Record old system balance (reference only)</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={isOfficeOpeningBalance} 
                  onChange={e => setIsOfficeOpeningBalance(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
              </label>
            </div>
          )}

          {/* Quick Presets */}
          {!isOfficeOpeningBalance && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setFromType('BUILDING'); setToType('HEAD_OFFICE'); setFromId(''); setToId(''); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${fromType === 'BUILDING' && toType === 'HEAD_OFFICE' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <Building2 size={12} /> Building → Head Office
              </button>
              <button type="button" onClick={() => { setFromType('HEAD_OFFICE'); setToType('BUILDING'); setFromId(''); setToId(''); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${fromType === 'HEAD_OFFICE' && toType === 'BUILDING' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <Landmark size={12} /> Head Office → Building
              </button>
              <button type="button" onClick={() => { setFromType('BUILDING'); setToType('BUILDING'); setFromId(''); setToId(''); setPurpose('Inter-Building Transfer'); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${fromType === 'BUILDING' && toType === 'BUILDING' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                <Shuffle size={12} /> Building ↔ Building
              </button>
              <button type="button" onClick={() => { setFromType('BUILDING'); setToType('OWNER'); setFromId(''); setToId(''); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${fromType === 'BUILDING' && toType === 'OWNER' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <UserCircle size={12} /> Building → Owner
              </button>
              <button type="button" onClick={() => { setFromType('OWNER'); setToType('BUILDING'); setFromId(''); setToId(''); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${fromType === 'OWNER' && toType === 'BUILDING' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <UserCircle size={12} /> Owner → Building
              </button>
              {fromType === 'BUILDING' && toType === 'BUILDING' && fromId && toId && (
                <button type="button" onClick={() => { const f = fromId, t0 = toId; setFromId(t0); setToId(f); }} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                  <ArrowRightLeft size={12} /> Swap
                </button>
              )}
            </div>
          )}

          {/* Inter-Building Info */}
          {!isOfficeOpeningBalance && fromType === 'BUILDING' && toType === 'BUILDING' && (
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-indigo-50 p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <Shuffle size={16} className="text-indigo-700" />
              </div>
              <div className="text-xs text-indigo-800 leading-relaxed">
                <div className="font-black uppercase tracking-wider text-[10px] text-indigo-600 mb-1">Inter-Building Transfer</div>
                Moving funds between two buildings. Each building's book is updated separately:
                <span className="font-bold"> an Expense</span> in the source building and
                <span className="font-bold"> an Income</span> in the destination building. Both entries stay linked and are deleted/restored together.
              </div>
            </div>
          )}

          {isOfficeOpeningBalance ? (
            /* Simplified form for Office Opening Balance */
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <Wallet size={32} className="mx-auto text-amber-600 mb-2" />
                <p className="text-sm font-bold text-amber-800">Recording Office Opening Balance</p>
                <p className="text-xs text-amber-600">This entry is for reference only and will not affect building finances</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Balance Amount (SAR)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0" step="0.01" placeholder="Enter amount..." className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{t('common.date')}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Notes (Optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes..." className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><TrendingDown size={16} className="text-rose-500" /> From (Source)</h3>
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Source Type</label>
                <SearchableSelect
                  options={[
                    { value: 'BUILDING', label: t('entry.building') as any },
                    { value: 'HEAD_OFFICE', label: 'Head Office' },
                    { value: 'OWNER', label: 'Owner' },
                  ]}
                  value={fromType}
                  onChange={(v) => { setFromType((v || 'BUILDING') as any); setFromId(''); }}
                  className="font-bold"
                />
              </div>

              {fromType === 'BUILDING' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Which building?</label>
                  <SearchableSelect
                    options={buildings.map((b) => ({ value: b.id, label: b.name || b.rawId || b.id, sublabel: b.bookName ? `${b.bookName}${b.bookId === activeBookId ? ' (current)' : ''}` : '' }))}
                    value={fromId}
                    onChange={(v) => setFromId(v)}
                    className="font-bold"
                    placeholder="Select source building..."
                  />
                  {!fromId && <p className="text-[10px] text-rose-600 font-bold">Select the source building.</p>}
                </div>
              )}

              {fromType === 'OWNER' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Which owner?</label>
                  <SearchableSelect
                    options={[
                      ...(fromId && !owners.some((o: any) => String(o.id) === String(fromId))
                        ? [{ value: String(fromId), label: getOwnerDisplayName(fromId) }]
                        : []),
                      ...owners.map((o: any) => ({
                        value: String(o.id),
                        label: treasuryUserLabel(o) || String(o.id),
                        sublabel: o.email && treasuryUserLabel(o) !== String(o.email) ? String(o.email) : undefined,
                      })),
                    ]}
                    value={fromId}
                    onChange={(v) => setFromId(v)}
                    className="font-bold"
                    placeholder="Select owner..."
                  />
                  {fromId ? (
                    <p className="text-[11px] font-bold text-purple-800">
                      Owner: <span className="text-slate-800">{getOwnerDisplayName(fromId)}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-rose-600 font-bold">Select the source owner.</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> To (Destination)</h3>
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Destination Type</label>
                <SearchableSelect
                  options={[
                    { value: 'BUILDING', label: t('entry.building') as any },
                    { value: 'HEAD_OFFICE', label: 'Head Office' },
                    { value: 'OWNER', label: 'Owner' },
                  ]}
                  value={toType}
                  onChange={(v) => { setToType((v || 'BUILDING') as any); setToId(''); }}
                  className="font-bold"
                />
              </div>

              {toType === 'BUILDING' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Which building?</label>
                  <SearchableSelect
                    options={buildings.map((b) => ({ value: b.id, label: b.name || b.rawId || b.id, sublabel: b.bookName ? `${b.bookName}${b.bookId === activeBookId ? ' (current)' : ''}` : '' }))}
                    value={toId}
                    onChange={(v) => setToId(v)}
                    className="font-bold"
                    placeholder="Select destination building..."
                  />
                  {!toId && <p className="text-[10px] text-rose-600 font-bold">Select the destination building.</p>}
                </div>
              )}

              {toType === 'OWNER' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Which owner?</label>
                  <SearchableSelect
                    options={[
                      ...(toId && !owners.some((o: any) => String(o.id) === String(toId))
                        ? [{ value: String(toId), label: getOwnerDisplayName(toId) }]
                        : []),
                      ...owners.map((o: any) => ({
                        value: String(o.id),
                        label: treasuryUserLabel(o) || String(o.id),
                        sublabel: o.email && treasuryUserLabel(o) !== String(o.email) ? String(o.email) : undefined,
                      })),
                    ]}
                    value={toId}
                    onChange={(v) => setToId(v)}
                    className="font-bold"
                    placeholder="Select owner..."
                  />
                  {toId ? (
                    <p className="text-[11px] font-bold text-purple-800">
                      Owner: <span className="text-slate-800">{getOwnerDisplayName(toId)}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-rose-600 font-bold">Select the destination owner.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">{t('common.date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">{t('entry.amount')}</label>
              <div className="relative form-with-icon has-prefix">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs z-30 bg-white px-2 rounded" style={{pointerEvents:'none'}}>{t('common.sar')}</span>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('entry.zero')} />
              </div>
            </div>

          </div>

          {/* Payment Method Cards */}
          {(() => {
            // Get default bank per side if the side is a BUILDING
            const sourceBuilding = fromType === 'BUILDING' && fromId ? buildings.find(b => b.id === fromId) : null;
            const destBuilding = toType === 'BUILDING' && toId ? buildings.find(b => b.id === toId) : null;
            const sourceDefaultBank = sourceBuilding?.bankName;
            const destDefaultBank = destBuilding?.bankName;

            return (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{t('entry.paymentMethod')}</label>
                  <div className="grid grid-cols-3 gap-4">
                    <button type="button" onClick={() => { setPaymentMethod('BANK'); setFromBankName(sourceDefaultBank || ''); setToBankName(destDefaultBank || ''); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'BANK' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={paymentMethod === 'BANK' ? '#10b981' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                      <span className={`text-sm font-bold ${paymentMethod === 'BANK' ? 'text-emerald-600' : 'text-slate-600'}`}>{t('entry.bankTransfer')}</span>
                    </button>
                    <button type="button" onClick={() => { setPaymentMethod('CASH'); setFromBankName(''); setToBankName(''); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={paymentMethod === 'CASH' ? '#10b981' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                      <span className={`text-sm font-bold ${paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-600'}`}>{t('entry.cashShort')}</span>
                    </button>
                    <button type="button" onClick={() => { setPaymentMethod('CHEQUE'); setFromBankName(sourceDefaultBank || ''); setToBankName(destDefaultBank || ''); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'CHEQUE' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={paymentMethod === 'CHEQUE' ? '#10b981' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="6" x2="6" y1="9" y2="9"/><line x1="6" x2="18" y1="13" y2="13"/><line x1="6" x2="12" y1="17" y2="17"/></svg>
                      <span className={`text-sm font-bold ${paymentMethod === 'CHEQUE' ? 'text-emerald-600' : 'text-slate-600'}`}>{t('entry.chequeShort')}</span>
                    </button>
                  </div>
                </div>

                {/* Bank Selection — FROM and TO banks, shown when method is BANK or CHEQUE */}
                {(paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && (
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                        {paymentMethod === 'BANK' ? 'Bank Accounts' : 'Cheque Accounts'} · Source &amp; Destination
                      </span>
                      <button type="button" onClick={() => { window.location.hash = '#/admin/settings'; }} className="text-xs font-bold text-blue-600 hover:text-blue-700">+ New Bank</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">From Bank {sourceDefaultBank && <span className="text-emerald-600 normal-case">(default: {sourceDefaultBank})</span>}</label>
                        <select value={fromBankName} onChange={e => setFromBankName(e.target.value)} required className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Select source bank...</option>
                          {banks.map(b => <option key={`src-${b.name}`} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                      <div className="hidden md:flex items-center justify-center pb-2">
                        <ArrowRightLeft size={20} className="text-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">To Bank {destDefaultBank && <span className="text-emerald-600 normal-case">(default: {destDefaultBank})</span>}</label>
                        <select value={toBankName} onChange={e => setToBankName(e.target.value)} required className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Select destination bank...</option>
                          {banks.map(b => <option key={`dst-${b.name}`} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {fromBankName && toBankName && (
                      <div className="text-[11px] text-blue-800 font-semibold bg-white/60 border border-blue-200 rounded-lg px-3 py-2">
                        Preview: <span className="font-bold">{fromBankName}</span> <ArrowRightLeft size={10} className="inline mx-1" /> <span className="font-bold">{toBankName}</span>
                        {fromBankName === toBankName && <span className="ml-2 text-amber-700">(same bank — internal transfer)</span>}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Purpose</label>
            <select value={purpose} onChange={e => setPurpose(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select purpose...</option>
              {fromType === 'BUILDING' && toType === 'BUILDING' && <option value="Inter-Building Transfer">Inter-Building Transfer</option>}
              <option value="Building Operations">Building Operations</option>
              <option value="Maintenance Fund">Maintenance Fund</option>
              <option value="Emergency Reserve">Emergency Reserve</option>
              <option value="Bank Deposit">Bank Deposit</option>
              <option value="Loan/Borrowing">Loan/Borrowing</option>
              <option value="Revenue Collection">Revenue Collection</option>
              <option value="Inter-Book Adjustment">Inter-Book Adjustment</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">{t('common.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Additional details..."></textarea>
          </div>
          </>
          )}

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={() => setView('LIST')} disabled={submitting} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-60">{t('common.cancel')}</button>
            <button type="submit" disabled={submitting} className="pm-btn pm-btn-primary flex items-center gap-2 disabled:opacity-60">
              {submitting ? <RefreshCw size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
              {submitting ? t('common.saving') : (isOfficeOpeningBalance ? 'Record Balance' : 'Record Transfer')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* stat-card (not ios-card): global .light .ios-card div { color !important } was overriding amount colors */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
            <div className="stat-card stat-card-amber min-w-0 bg-gradient-to-br from-amber-50/95 to-orange-50/90 dark:from-amber-950/35 dark:to-orange-950/25 border-amber-200/80 dark:border-amber-500/25 shadow-sm hover:shadow-md transition-shadow">
              <div className="stat-label !opacity-100 flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <Wallet size={14} className="shrink-0 opacity-90" aria-hidden />
                Opening Balance
              </div>
              <div className="stat-value text-2xl md:text-3xl tabular-nums text-amber-700 dark:text-amber-300">
                {officeOpeningBalance.toLocaleString()}
                <span className="text-[0.55em] font-bold text-amber-600 dark:text-amber-400 ml-1">{t('common.sar')}</span>
              </div>
            </div>
            <div className="stat-card stat-card-emerald min-w-0 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-shadow">
              <div className="stat-label !opacity-100 text-emerald-900 dark:text-emerald-200">Transfers In</div>
              <div className="stat-value text-2xl md:text-3xl tabular-nums text-emerald-700 dark:text-emerald-300">
                {totalIn.toLocaleString()}
                <span className="text-[0.55em] font-bold text-emerald-600 dark:text-emerald-400 ml-1">{t('common.sar')}</span>
              </div>
            </div>
            <div className="stat-card stat-card-rose min-w-0 dark:border-rose-500/20 shadow-sm hover:shadow-md transition-shadow">
              <div className="stat-label !opacity-100 text-rose-900 dark:text-rose-200">Transfers Out</div>
              <div className="stat-value text-2xl md:text-3xl tabular-nums text-rose-700 dark:text-rose-300">
                {totalOut.toLocaleString()}
                <span className="text-[0.55em] font-bold text-rose-600 dark:text-rose-400 ml-1">{t('common.sar')}</span>
              </div>
            </div>
            <div className="stat-card stat-card-indigo min-w-0 bg-gradient-to-br from-indigo-50/95 to-violet-50/90 dark:from-indigo-950/35 dark:to-violet-950/25 border-indigo-200/80 dark:border-indigo-500/25 shadow-sm hover:shadow-md transition-shadow">
              <div className="stat-label !opacity-100 flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200">
                <Shuffle size={14} className="shrink-0 opacity-90" aria-hidden />
                Inter-Building
              </div>
              <div className="stat-value text-2xl md:text-3xl tabular-nums text-indigo-700 dark:text-indigo-300">
                {interBuildingTotal.toLocaleString()}
                <span className="text-[0.55em] font-bold text-indigo-600 dark:text-indigo-400 ml-1">{t('common.sar')}</span>
              </div>
              <div className="stat-sub !opacity-100 text-indigo-700 dark:text-indigo-400 mt-1">{interBuildingTransfers.length} transfer(s)</div>
            </div>
            <div className="stat-card stat-card-violet min-w-0 dark:border-violet-500/20 shadow-sm hover:shadow-md transition-shadow">
              <div className="stat-label !opacity-100 text-violet-900 dark:text-violet-200">Expenses</div>
              <div className="stat-value text-2xl md:text-3xl tabular-nums text-orange-700 dark:text-orange-300">
                {totalHOExpenses.toLocaleString()}
                <span className="text-[0.55em] font-bold text-orange-600 dark:text-orange-400 ml-1">{t('common.sar')}</span>
              </div>
            </div>
            <div className="stat-card stat-card-slate min-w-0 dark:border-slate-500/30 shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-900/5 dark:ring-white/10">
              <div className="stat-label !opacity-100 text-slate-700 dark:text-slate-300">Net Balance</div>
              <div className={`stat-value text-2xl md:text-3xl tabular-nums ${netBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-700 dark:text-rose-300'}`}>
                {netBalance.toLocaleString()}
                <span className={`text-[0.55em] font-bold ml-1 ${netBalance >= 0 ? 'text-slate-600 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>{t('common.sar')}</span>
              </div>
            </div>
          </div>

          <div className="ios-card p-6">
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center mb-6">
              {canCrossBookTreasuryControls && (books || []).length > 1 && (
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50/90 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    checked={includeOtherBooksInTreasury}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setIncludeOtherBooksInTreasury(v);
                      try {
                        localStorage.setItem('treasuryIncludeOtherBooks', v ? '1' : '0');
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  <span className="text-[11px] font-black text-violet-900 leading-tight">
                    All books: buildings &amp; data
                  </span>
                </label>
              )}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => applyDatePreset('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${datePreset === 'ALL' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('THIS_MONTH')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${datePreset === 'THIS_MONTH' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
                >
                  This month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('LAST_MONTH')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${datePreset === 'LAST_MONTH' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
                >
                  Last month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('CUSTOM')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${datePreset === 'CUSTOM' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
                  title="Use custom From/To dates"
                >
                  Custom
                </button>
              </div>

              <input
                type="date"
                value={filterFromDate}
                onChange={e => { setFilterFromDate(e.target.value); setDatePreset('CUSTOM'); }}
                className="px-3 py-2 border rounded-xl text-sm"
                placeholder={t('invoice.from')}
              />
              <input
                type="date"
                value={filterToDate}
                onChange={e => { setFilterToDate(e.target.value); setDatePreset('CUSTOM'); }}
                className="px-3 py-2 border rounded-xl text-sm"
                placeholder="To"
              />
              <SearchableSelect
                options={[
                  { value: 'ALL', label: 'From: All' },
                  { value: 'BUILDING', label: 'From: Building' },
                  { value: 'HEAD_OFFICE', label: 'From: Head Office' },
                  { value: 'OWNER', label: 'From: Owner' },
                  { value: 'BANK', label: 'From: Bank' },
                ]}
                value={filterFromType}
                onChange={(v) => setFilterFromType((v || 'ALL') as any)}
                placeholder="From"
                className="min-w-[160px]"
              />
              <SearchableSelect
                options={[
                  { value: 'ALL', label: 'To: All' },
                  { value: 'BUILDING', label: 'To: Building' },
                  { value: 'HEAD_OFFICE', label: 'To: Head Office' },
                  { value: 'OWNER', label: 'To: Owner' },
                  { value: 'BANK', label: 'To: Bank' },
                ]}
                value={filterToType}
                onChange={(v) => setFilterToType((v || 'ALL') as any)}
                placeholder="To"
                className="min-w-[160px]"
              />
              <div className="relative">
                <button
                  ref={buildingTriggerRef}
                  type="button"
                  onClick={() => setShowBuildingPicker(v => !v)}
                  className={`group flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-sm font-semibold shadow-sm transition-all ${
                    showBuildingPicker ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:border-violet-300'
                  }`}
                  title="Filter by multiple buildings"
                >
                  <Building2 size={16} className={`${filterBuildingIds.length > 0 ? 'text-violet-600' : 'text-slate-400'}`} />
                  <span className={`${filterBuildingIds.length > 0 ? 'text-slate-800' : 'text-slate-600'}`}>
                    {filterBuildingIds.length === 0 ? 'Buildings: All' : `Buildings: ${filterBuildingIds.length}`}
                  </span>
                </button>
                {showBuildingPicker && buildingPickerRect && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={buildingPickerRef}
                    style={{
                      position: 'fixed',
                      top: Math.min(buildingPickerRect.top + 6, window.innerHeight - 420),
                      left: Math.max(8, Math.min(buildingPickerRect.left, window.innerWidth - Math.max(buildingPickerRect.width, 320) - 8)),
                      width: Math.max(buildingPickerRect.width, 320),
                      zIndex: 100000,
                    }}
                    className="rounded-2xl border border-violet-200 bg-white shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 flex items-center gap-2">
                      <div className="text-xs font-black text-violet-700 uppercase tracking-widest">Select buildings</div>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFilterBuildingIds([])}
                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterBuildingIds(buildings.map(b => b.id))}
                          className="px-2 py-1 rounded-lg text-[10px] font-black bg-violet-600 text-white hover:bg-violet-700"
                        >
                          Select all
                        </button>
                      </div>
                    </div>
                    <div className="p-2 border-b border-slate-100">
                      <input
                        value={buildingPickerSearch}
                        onChange={(e) => setBuildingPickerSearch(e.target.value)}
                        placeholder="Search building..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
                      />
                    </div>
                    <div className="max-h-[340px] overflow-auto p-2">
                      {buildings.length === 0 && (
                        <div className="p-4 text-xs text-slate-500 font-bold">No buildings</div>
                      )}
                      {buildings
                        .filter((b) => {
                          const q = buildingPickerSearch.trim().toLowerCase();
                          if (!q) return true;
                          const name = String(b.name || '').toLowerCase();
                          const raw = String(b.rawId || '').toLowerCase();
                          const book = String(b.bookName || '').toLowerCase();
                          return name.includes(q) || raw.includes(q) || book.includes(q);
                        })
                        .map((b) => {
                          const checked = filterBuildingIds.includes(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setFilterBuildingIds((prev) => checked ? prev.filter(x => x !== b.id) : [b.id, ...prev]);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                                checked ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-200'}`}>
                                {checked && <Check size={14} className="text-white" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-slate-800 truncate">{b.name || b.rawId || b.id}</div>
                                <div className="text-[10px] text-slate-500 truncate">{b.bookName}{b.bookId === activeBookId ? ' (current)' : ''}</div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
              <SearchableSelect
                options={[
                  { value: 'ALL', label: 'All Accounts' },
                  { value: 'HEAD_OFFICE', label: 'Head Office' },
                  ...buildings.map((b) => ({ value: b.id, label: `${b.bookName ? b.bookName + ' · ' : ''}${b.name || b.rawId || b.id}` })),
                ]}
                value={filterAccount}
                onChange={(v) => setFilterAccount(v || 'ALL')}
                placeholder="Account"
                className="min-w-[220px]"
              />
              <SearchableSelect
                options={[
                  { value: 'ALL', label: t('history.allStatus') as any },
                  { value: 'PENDING', label: t('common.pending') as any },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
                value={filterStatus}
                onChange={(v) => setFilterStatus((v || 'ALL') as any)}
                placeholder="Status"
                className="min-w-[160px]"
              />
              <button
                onClick={() => {
                  setFilterFromDate('');
                  setFilterToDate('');
                  setDatePreset('ALL');
                  setFilterStatus('ALL');
                  setFilterAccount('ALL');
                  setFilterFromType('ALL');
                  setFilterToType('ALL');
                  setFilterBuildingIds([]);
                  setBuildingPickerSearch('');
                }}
                className="px-3 py-2 bg-slate-100 rounded-xl text-sm"
              >
                {t('common.reset')}
              </button>
              <button 
                onClick={() => setShowDeleted(!showDeleted)}
                className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${showDeleted ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}
              >
                <Trash2 size={16} /> {showDeleted ? 'Active' : `Trash (${transfers.filter(t => (t as any).deleted).length})`}
              </button>
              {showDeleted && (
                <>
                  <button onClick={handleRestoreAll} className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">{t('history.restoreAll')}</button>
                  <button onClick={handleDeleteAll} className="px-3 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">{t('history.deleteAll')}</button>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 shadow-sm"
                  title="Bulk import transfers (CSV/XLSX)"
                >
                  <Upload size={16} /> Bulk Import
                </button>
                <button onClick={handleExportPDF} title="Export as Account Statement PDF" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-violet-700 shadow-sm shadow-violet-200">
                  <FileText size={16} /> Account Statement PDF
                </button>
                <button onClick={handleExportCSV} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600"><Download size={16} />{t('contract.exportCsv')}</button>
              </div>
            </div>

            {!isStaff && filteredOwnerExpenseConverted.length > 0 && (
              <details className="group mb-6 rounded-xl border border-slate-200 bg-slate-50/60 open:bg-slate-50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                    <span className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <FileText size={14} className="shrink-0 text-slate-500" />
                      <span className="truncate">Converted owner expenses (History)</span>
                      <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                        {filteredOwnerExpenseConverted.length}
                      </span>
                    </span>
                    {includeOtherBooksInTreasury && ownerExpenseConvertedFromOtherBooks.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 sm:ml-1">
                        Other books: {ownerExpenseConvertedFromOtherBooks.length} · {convertedOtherBooksTotalSar.toLocaleString()}{' '}
                        {t('common.sar')}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-slate-200 px-2 pb-3 pt-2">
                  <p className="mb-2 px-1 text-[10px] text-slate-500">
                    Rows marked by &quot;Fix Owner Expense&quot; with kind {TREASURY_CONVERSION_OWNER_EXPENSE}. Uses the same date and building filters as the table below.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Building</th>
                          <th className="px-3 py-2.5 text-right">Amount</th>
                          <th className="px-3 py-2.5">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOwnerExpenseConverted.map((tx: any) => {
                          const txBook = String(tx._bookId || activeBookId);
                          const amt = Math.abs(Number(tx.amountIncludingVAT || tx.totalWithVat || tx.amount || 0));
                          return (
                            <tr key={`${txBook}:${tx.id}`} className="border-t border-slate-100 hover:bg-slate-50/80">
                              <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-700">{fmtDate(tx.date)}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">{labelOwnerExpenseBuilding(tx)}</td>
                              <td className="px-3 py-2.5 text-right font-black tabular-nums text-slate-800">
                                {amt.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">{t('common.sar')}</span>
                              </td>
                              <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-slate-600" title={tx.details || ''}>
                                {tx.details || tx.description || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )}

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {listLoading ? (
                <SkeletonTableRows count={6} columns={3} />
              ) : combinedEntries.map(tx => (
                <div
                  key={tx.id}
                  onClick={() => setDetailEntry(tx)}
                  className={`border rounded-xl p-3 shadow-sm space-y-2 cursor-pointer ${tx.isOfficeOpeningBalance ? 'border-amber-200 bg-amber-50' : (tx as any).isHOExpense ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[11px] font-mono text-slate-500">{fmtDate(tx.date)}</div>
                      {tx.isOfficeOpeningBalance ? (
                        <>
                          <div className="font-bold text-amber-800 text-sm flex items-center gap-1"><Wallet size={14} /> Opening Balance</div>
                          <div className="text-[11px] text-amber-600">Old System → Head Office</div>
                        </>
                      ) : (tx as any).isHOExpense ? (
                        <>
                          <div className="font-bold text-rose-800 text-sm flex items-center gap-1"><TrendingDown size={14} /> EXPENSE</div>
                          <div className="text-[11px] text-rose-600 font-bold">{transferRouteText(tx)}</div>
                          <div className="text-[11px] text-slate-500">{formatPaymentMethod(tx)}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-slate-800 text-sm">{tx.purpose || 'Transfer'}</div>
                          <div className="text-[11px] text-slate-600 font-bold flex flex-wrap items-center gap-1">
                            {treTy(tx.fromType) === 'OWNER' || treTy(tx.toType) === 'OWNER' ? (
                              <UserCircle size={12} className="text-purple-500 shrink-0" />
                            ) : null}
                            <span>{transferRouteText(tx)}</span>
                          </div>
                          {((tx as any).paymentMethod || (tx as any).fromBankName) && (
                            <div className="text-[10px] mt-1">
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold" title={formatPaymentMethod(tx)}>
                                {formatPaymentMethod(tx)}
                              </span>
                            </div>
                          )}
                          {tx.notes && (
                            <div className="mt-1 text-[11px] font-semibold text-slate-500 line-clamp-2">
                              Notes: {tx.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-right space-y-1">
	                      {tx.isOfficeOpeningBalance && editingOpeningBal ? (
	                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
	                          <input type="number" value={openingBalInput} onChange={e => setOpeningBalInput(e.target.value)} className="w-24 px-2 py-1 border rounded-lg text-sm font-bold text-amber-700" autoFocus />
	                          <button onClick={handleSaveOpeningBalance} disabled={savingOpeningBal} className="p-1 bg-emerald-500 text-white rounded-lg disabled:opacity-60"><Check size={14} /></button>
	                          <button onClick={() => setEditingOpeningBal(false)} className="p-1 bg-slate-200 text-slate-600 rounded-lg"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className={`text-sm font-black ${(tx as any).isHOExpense ? 'text-rose-700' : 'text-slate-800'}`}>{tx.amount.toLocaleString()} <span className="text-[10px] text-slate-500">{t('common.sar')}</span></div>
                      )}
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block ${(tx as any).isHOExpense ? 'bg-rose-100 text-rose-700' : tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : tx.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {(tx as any).isHOExpense ? 'EXPENSE' : tx.status}
                      </span>
                    </div>
                  </div>
                  {!(tx as any).isHOExpense && (
	                  <div className="flex gap-2 justify-end pt-1" onClick={(e) => e.stopPropagation()}>
	                    {showDeleted ? (
	                      <>
	                        {!tx.isOfficeOpeningBalance && (
	                          <>
                            <button onClick={() => handleRestore(tx.id)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-bold">{t('history.restore')}</button>
                            <button onClick={() => handlePermanentDelete(tx.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold">{t('common.delete')}</button>
                          </>
                        )}
                      </>
	                    ) : (
	                      <>
	                        <button onClick={() => setDetailEntry(tx)} className="p-1.5 bg-violet-50 text-violet-600 rounded-lg text-[11px] font-bold flex items-center gap-1">
	                          <Eye size={13} /> Details
	                        </button>
	                        {isAdminOrHead && tx.status === 'PENDING' && (
	                          <>
                            <button onClick={() => handleApprove(tx as any)} disabled={!!actionProcessingId} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-bold disabled:opacity-60">{t('approval.approve')}</button>
                            <button onClick={() => handleReject(tx as any)} disabled={!!actionProcessingId} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold disabled:opacity-60">{t('approval.reject')}</button>
	                          </>
	                        )}
	                        {isAdmin && !tx.isOfficeOpeningBalance && (
	                          <button onClick={() => handleEditTransferOpen(tx as any)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">{t('common.edit')}</button>
	                        )}
	                        {isAdmin && tx.isOfficeOpeningBalance && (
	                          <button onClick={() => { setOpeningBalInput(String(tx.amount)); setEditingOpeningBal(true); }} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-bold">{t('common.edit')}</button>
	                        )}
                        {!tx.isOfficeOpeningBalance && (isAdminOrHead || tx.createdBy === currentUser.id) && (
                          <button onClick={() => handleDelete(tx.id)} className="p-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">{t('history.trash')}</button>
                        )}
                      </>
                    )}
                  </div>
                  )}
                </div>
              ))}
              {combinedEntries.length === 0 && (
                <div className="px-3 py-6 text-center text-slate-400 text-sm">No entries found.</div>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.date')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">From → To</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.amount')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Purpose</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listLoading ? (
                    <tr><td colSpan={7} className="p-4"><SkeletonTableRows count={8} columns={6} /></td></tr>
                  ) : combinedEntries.map(tx => (
                    <tr
                      key={tx.id}
                      onClick={() => setDetailEntry(tx)}
                      className={`cursor-pointer hover:bg-slate-50 ${tx.isOfficeOpeningBalance ? 'bg-amber-50' : (tx as any).isHOExpense ? 'bg-rose-50' : (treTy(tx.fromType) === 'BUILDING' && treTy(tx.toType) === 'BUILDING') ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="px-4 py-4 text-sm font-mono">{fmtDate(tx.date)}</td>
                      <td className="px-4 py-4 text-sm min-w-[12rem] max-w-xl">
                        {tx.isOfficeOpeningBalance ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Wallet size={14} className="text-amber-600 shrink-0" />
                            <span className="font-bold text-amber-700">Old System</span>
                            <ArrowRightLeft size={12} className="text-slate-400 shrink-0" aria-hidden />
                            <Building2 size={14} className="text-amber-600 shrink-0" />
                            <span className="font-bold text-amber-700">Head Office</span>
                          </div>
                        ) : (tx as any).isHOExpense ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <TrendingDown size={14} className="text-rose-500 shrink-0" />
                            <span className="font-bold text-rose-700">Head Office</span>
                            <ArrowRightLeft size={12} className="text-slate-400 shrink-0" aria-hidden />
                            <span className="font-bold text-rose-700">{tx.toId}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500" title={formatPaymentMethod(tx)}>{formatPaymentMethod(tx)}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 text-slate-800">
                            <span className="font-bold break-words">{getBuildingName(tx.fromId, tx.fromType)}</span>
                            <ArrowRightLeft size={12} className="text-slate-400 shrink-0" aria-hidden />
                            <span className="font-bold break-words">{getBuildingName(tx.toId, tx.toType)}</span>
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-4 text-sm font-bold ${(tx as any).isHOExpense ? 'text-rose-700' : 'text-slate-800'}`}>
	                        {tx.isOfficeOpeningBalance && editingOpeningBal ? (
	                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
	                            <input type="number" value={openingBalInput} onChange={e => setOpeningBalInput(e.target.value)} className="w-28 px-2 py-1 border rounded-lg text-sm font-bold text-amber-700" autoFocus />
	                            <button onClick={handleSaveOpeningBalance} className="p-1 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
	                            <button onClick={() => setEditingOpeningBal(false)} className="p-1 bg-slate-200 text-slate-600 rounded-lg"><X size={14} /></button>
                          </div>
                        ) : (
                          <>{tx.amount.toLocaleString()} SAR</>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {treTy(tx.fromType) === 'BUILDING' && treTy(tx.toType) === 'BUILDING' && !(tx as any).isHOExpense && (
                          <span className="mr-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                            <Shuffle size={10} /> Inter-Bldg
                          </span>
                        )}
                        <span>{tx.purpose}</span>
                        {tx.notes && (
                          <div className="mt-1 max-w-md text-xs font-medium text-slate-500 line-clamp-2" title={tx.notes}>
                            Notes: {tx.notes}
                          </div>
                        )}
                        {!(tx as any).isHOExpense && ((tx as any).paymentMethod || (tx as any).fromBankName) && (
                          <div className="mt-0.5 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold" title={formatPaymentMethod(tx)}>
                              {formatPaymentMethod(tx)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${(tx as any).isHOExpense ? 'bg-rose-100 text-rose-700' : tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : tx.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                          {(tx as any).isHOExpense ? 'EXPENSE' : tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        {!(tx as any).isHOExpense && (
                        <div className="flex items-center gap-2">
                          {showDeleted ? (
                            <>
                              {!tx.isOfficeOpeningBalance && (
                                <>
                                  <button onClick={() => handleRestore(tx.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title={t('history.restore')}>
                                    <RotateCcw size={16} />
                                  </button>
                                  <button onClick={() => handlePermanentDelete(tx.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title={t('history.deletePermanently')}>
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                            </>
	                          ) : (
	                            <>
                              <button onClick={() => setDetailEntry(tx)} className="p-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100" title="View details">
                                <Eye size={16} />
                              </button>
	                              {isAdminOrHead && tx.status === 'PENDING' && (
	                                <>
	                                  <button onClick={() => handleApprove(tx as any)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title={t('approval.approve')}>
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => handleReject(tx as any)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title={t('approval.reject')}>
                                    <X size={16} />
                                  </button>
                                </>
                              )}
	                              {isAdmin && !tx.isOfficeOpeningBalance && (
	                                <button onClick={() => handleEditTransferOpen(tx as any)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Admin: Edit transfer">
	                                  <Pencil size={16} />
	                                </button>
	                              )}
	                              {isAdmin && tx.isOfficeOpeningBalance && (
	                                <button onClick={() => { setOpeningBalInput(String(tx.amount)); setEditingOpeningBal(true); }} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="Edit Opening Balance">
	                                  <Pencil size={16} />
                                </button>
                              )}
                              {!tx.isOfficeOpeningBalance && (isAdminOrHead || tx.createdBy === currentUser.id) && (
                                <button onClick={() => handleDelete(tx.id)} className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100" title={t('history.moveToTrash')}>
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {combinedEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No entries found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Details Modal */}
      {detailEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-2xl w-full animate-slide-up border border-slate-100">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Eye size={18} className="shrink-0 text-violet-600" />
                  Treasury Details
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1 truncate">
                  {detailEntry.isOfficeOpeningBalance ? 'Opening Balance' : (detailEntry as any).isHOExpense ? 'Head Office Expense' : detailEntry.purpose || 'Treasury Transfer'}
                </p>
              </div>
              <button onClick={() => setDetailEntry(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('common.amount')}</div>
                  <div className={`text-2xl font-black tabular-nums ${(detailEntry as any).isHOExpense ? 'text-rose-700' : 'text-slate-900'}`}>
                    {Number(detailEntry.amount || 0).toLocaleString()} <span className="text-sm text-slate-500">{t('common.sar')}</span>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-black ${(detailEntry as any).isHOExpense ? 'bg-rose-100 text-rose-700' : detailEntry.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : detailEntry.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                  {(detailEntry as any).isHOExpense ? 'EXPENSE' : detailEntry.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                <span>{detailEntry.isOfficeOpeningBalance ? 'Old System' : getBuildingName(detailEntry.fromId, detailEntry.fromType)}</span>
                <ArrowRightLeft size={14} className="text-slate-400" />
                <span>{(detailEntry as any).isHOExpense ? String(detailEntry.toId || 'Expense') : detailEntry.isOfficeOpeningBalance ? 'Head Office' : getBuildingName(detailEntry.toId, detailEntry.toType)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Date', fmtDate(detailEntry.date)],
                ['Type', detailEntry.isOfficeOpeningBalance ? 'Office Opening Balance' : (detailEntry as any).isHOExpense ? 'Head Office Expense' : treTy(detailEntry.fromType) === 'BUILDING' && treTy(detailEntry.toType) === 'BUILDING' ? 'Inter-Building Transfer' : 'Treasury Transfer'],
                ['Purpose', detailEntry.purpose || '—'],
                ['Payment Method', formatPaymentMethod(detailEntry) || '—'],
                ['From Type', detailEntry.fromType || '—'],
                ['To Type', detailEntry.toType || '—'],
                ['Created By', detailEntry.createdBy || '—'],
                ['Reference', (detailEntry as any).isHOExpense ? String((detailEntry as any).originalExpense?.id || detailEntry.id).replace(/^ho-exp-/, '') : detailEntry.id],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
                  <div className="mt-1 font-bold text-slate-800 break-words">{value || '—'}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('common.notes')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">
                {detailEntry.notes || (detailEntry as any).originalExpense?.details || (detailEntry as any).originalExpense?.description || '—'}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => setDetailEntry(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">{t('common.close') || 'Close'}</button>
              {isAdmin && !(detailEntry as any).isHOExpense && !detailEntry.isOfficeOpeningBalance && !showDeleted && (
                <button
                  type="button"
                  onClick={() => {
                    const tx = detailEntry as Transfer;
                    setDetailEntry(null);
                    handleEditTransferOpen(tx);
                  }}
                  className="px-4 py-2.5 rounded-xl text-white font-bold shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-200 flex items-center gap-2"
                >
                  <Pencil size={16} /> {t('common.edit')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Transfer Modal */}
      {showEditTransferModal && editTransferItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-3xl w-full animate-slide-up max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Pencil size={18} className="text-blue-600" /> Admin Edit Transfer</h3>
              <button onClick={() => setShowEditTransferModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{t('common.date')}</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferDate} onChange={e => setEditTransferDate(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{t('entry.amount')}</label>
                  <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferAmount} onChange={e => setEditTransferAmount(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{t('common.status')}</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferStatus} onChange={e => setEditTransferStatus(e.target.value as Transfer['status'])}>
                    <option value="PENDING">{t('common.pending')}</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">From</div>
                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferFromType} onChange={e => { setEditTransferFromType(e.target.value as Transfer['fromType']); setEditTransferFromId(e.target.value === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : ''); }}>
                    <option value="BUILDING">{t('entry.building')}</option>
                    <option value="HEAD_OFFICE">Head Office</option>
                    <option value="OWNER">Owner</option>
                    <option value="BANK">Bank</option>
                  </select>
                  {editTransferFromType === 'BUILDING' && (
                    <SearchableSelect
                      options={buildings.map((b) => ({ value: b.id, label: b.name || b.rawId || b.id, sublabel: b.bookName ? `${b.bookName}${b.bookId === activeBookId ? ' (current)' : ''}` : '' }))}
                      value={editTransferFromId}
                      onChange={(v) => setEditTransferFromId(v)}
                      placeholder="Select source building..."
                    />
                  )}
                  {editTransferFromType === 'OWNER' && (
                    <SearchableSelect
                      options={owners.map((o: any) => ({ value: String(o.id), label: treasuryUserLabel(o) || String(o.id), sublabel: o.email }))}
                      value={editTransferFromId}
                      onChange={(v) => setEditTransferFromId(v)}
                      placeholder="Select source owner..."
                    />
                  )}
                  {editTransferFromType === 'BANK' && (
                    <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferFromId} onChange={e => setEditTransferFromId(e.target.value)}>
                      <option value="">Select source bank...</option>
                      {banks.map((b, i) => <option key={`ebf-${i}`} value={b.name}>{b.name}</option>)}
                    </select>
                  )}
                  {editTransferFromType === 'HEAD_OFFICE' && <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Head Office</div>}
                </div>
                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">To</div>
                  <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferToType} onChange={e => { setEditTransferToType(e.target.value as Transfer['toType']); setEditTransferToId(e.target.value === 'HEAD_OFFICE' ? 'HEAD_OFFICE' : ''); }}>
                    <option value="BUILDING">{t('entry.building')}</option>
                    <option value="HEAD_OFFICE">Head Office</option>
                    <option value="OWNER">Owner</option>
                    <option value="BANK">Bank</option>
                  </select>
                  {editTransferToType === 'BUILDING' && (
                    <SearchableSelect
                      options={buildings.map((b) => ({ value: b.id, label: b.name || b.rawId || b.id, sublabel: b.bookName ? `${b.bookName}${b.bookId === activeBookId ? ' (current)' : ''}` : '' }))}
                      value={editTransferToId}
                      onChange={(v) => setEditTransferToId(v)}
                      placeholder="Select destination building..."
                    />
                  )}
                  {editTransferToType === 'OWNER' && (
                    <SearchableSelect
                      options={owners.map((o: any) => ({ value: String(o.id), label: treasuryUserLabel(o) || String(o.id), sublabel: o.email }))}
                      value={editTransferToId}
                      onChange={(v) => setEditTransferToId(v)}
                      placeholder="Select destination owner..."
                    />
                  )}
                  {editTransferToType === 'BANK' && (
                    <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferToId} onChange={e => setEditTransferToId(e.target.value)}>
                      <option value="">Select destination bank...</option>
                      {banks.map((b, i) => <option key={`ebt-${i}`} value={b.name}>{b.name}</option>)}
                    </select>
                  )}
                  {editTransferToType === 'HEAD_OFFICE' && <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Head Office</div>}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Purpose</label>
                <input className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferPurpose} onChange={e => setEditTransferPurpose(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t('common.notes')}</label>
                <textarea rows={3} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferNotes} onChange={e => setEditTransferNotes(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t('entry.paymentMethod')}</label>
                <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferPaymentMethod} onChange={e => setEditTransferPaymentMethod(e.target.value as any)}>
                  <option value="CASH">{t('entry.cashShort')}</option>
                  <option value="BANK">{t('entry.bankTransfer')}</option>
                  <option value="CHEQUE">{t('entry.chequeShort')}</option>
                </select>
              </div>
              {(editTransferPaymentMethod === 'BANK' || editTransferPaymentMethod === 'CHEQUE') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">From Bank</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferFromBank} onChange={e => setEditTransferFromBank(e.target.value)}>
                      <option value="">Select source bank...</option>
                      {banks.map((b, i) => <option key={`ef-${i}`} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">To Bank</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferToBank} onChange={e => setEditTransferToBank(e.target.value)}>
                      <option value="">Select destination bank...</option>
                      {banks.map((b, i) => <option key={`et-${i}`} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowEditTransferModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="button" onClick={handleEditTransferSubmit} className="flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-200">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-lg w-full animate-slide-up border border-slate-100">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Upload size={18} className="shrink-0 text-slate-700" aria-hidden />
                  Import CSV / Excel
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                  Bulk create Treasury transfers from a file — use the template for the correct columns (.csv, .xlsx).
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (!importBusy) setShowImportModal(false); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
                aria-label={t('common.close') || 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
                className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 ${
                  importBusy ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                }`}
              >
                <Upload size={14} aria-hidden /> {importBusy ? 'Importing…' : 'Choose file'}
              </button>
              <button
                type="button"
                onClick={downloadImportTemplate}
                disabled={importBusy}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={14} aria-hidden /> Download template
              </button>
              {canFixOwnerExpense && (
                <button
                  type="button"
                  onClick={handleConvertOwnerExpensesToTreasury}
                  disabled={importBusy}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 ${
                    importBusy
                      ? 'bg-slate-200 text-slate-500'
                      : ownerExpenseTxs.length > 0
                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                  title="Convert past Owner Expense entries to Treasury transfers"
                >
                  <Sparkles size={14} aria-hidden />
                  Fix Owner Expense ({ownerExpenseTxs.length})
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Template columns (header row)</div>
              <p className="font-mono text-[10px] text-slate-700 leading-relaxed break-words">
                Date, FromType, FromId, ToType, ToId, Amount, Purpose, Notes, PaymentMethod, FromBankName, ToBankName, Status
              </p>
              <p className="text-[11px] text-slate-600 leading-snug border-t border-slate-200/80 pt-2">
                <span className="font-bold text-slate-800">FromType / ToType</span>
                {' — '}
                BUILDING, HEAD_OFFICE, OWNER, or BANK. Use{' '}
                <span className="font-bold">HEAD_OFFICE</span> for both type and id when the office is an endpoint. For BANK, put the{' '}
                <span className="font-bold">exact bank name</span> from your Banks list in FromId / ToId. For BUILDING / OWNER, id or display name is accepted.
                {' '}
                <span className="font-bold">PaymentMethod</span> CASH, BANK, or CHEQUE; with BANK/CHEQUE set FromBankName / ToBankName when needed.
                {' '}
                <span className="font-bold">Status</span> PENDING, COMPLETED, or CANCELLED — defaults to COMPLETED if omitted.
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={importBusy}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-60"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        danger={confirmDanger}
        onConfirm={() => confirmAction && confirmAction()}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default TransferManager;

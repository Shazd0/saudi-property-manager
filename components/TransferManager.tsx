import React, { useState, useEffect } from 'react';
import { User, Building, UserRole, Transaction, TransactionType } from '../types';
import { getBuildings, getTransfers, saveTransfer, getBanks, deleteTransfer, getTransactions, getUsers, saveTransaction, getDataFromBook } from '../services/firestoreService';
import { ArrowRightLeft, Building2, Landmark, TrendingDown, TrendingUp, Plus, Download, Calendar, Trash2, Check, X, RotateCcw, Wallet, UserCircle, Pencil, Shuffle, FileText } from 'lucide-react';
import { Bank } from '../types';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';
import { useBook } from '../contexts/BookContext';

// Building enriched with the book it belongs to. For the active book the `id`
// stays the raw building id so existing transfers keep resolving correctly.
// For other books we use a composite id `${bookId}:${buildingId}` to keep it
// unambiguous across books (two books can coincidentally share a building id).
type BookBuilding = Building & { bookId: string; bookName: string; rawId: string };

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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  // 'ALL' | 'HEAD_OFFICE' | building-id
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('Confirm');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  // Edit transfer state
  const [showEditTransferModal, setShowEditTransferModal] = useState(false);
  const [editTransferItem, setEditTransferItem] = useState<Transfer | null>(null);
  const [editTransferDate, setEditTransferDate] = useState('');
  const [editTransferPaymentMethod, setEditTransferPaymentMethod] = useState<'CASH' | 'BANK' | 'CHEQUE'>('CASH');
  const [editTransferFromBank, setEditTransferFromBank] = useState('');
  const [editTransferToBank, setEditTransferToBank] = useState('');

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

  useEffect(() => {
    loadData();
    // Re-load whenever the list of books (or the active book) changes so
    // that newly created books surface their buildings immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, activeBookId]);

  const loadData = async () => {
    // Admin/Head/Owner see buildings from every book; staff remain scoped to
    // the active book (getBuildings honours their building-scope filters).
    const canSeeAllBooks =
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === 'HEAD' ||
      currentUser.role === UserRole.OWNER;

    const bookList = books && books.length > 0 ? books : [{ id: 'default', name: 'Main Book' } as any];
    const activeName = (bookList.find((b: any) => b.id === activeBookId)?.name) || 'Main Book';

    let merged: BookBuilding[] = [];
    if (canSeeAllBooks) {
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
    setBuildings(merged);
    setBanks(await getBanks());
    setTransfers(await getTransfers({ includeDeleted: true }));
    // Fetch owners
    const allUsers = await getUsers();
    setOwners((allUsers || []).filter((u: User) => u.role === 'OWNER'));
    // Fetch all transactions to find HEAD_OFFICE expenses
    const allTx = await getTransactions({ role: 'ADMIN', includeDeleted: true } as any);
    setAllTransactions(allTx || []);
    const hoExpenses = (allTx || []).filter((t: Transaction) => 
      t.type === TransactionType.EXPENSE && 
      t.buildingId === 'HEAD_OFFICE' &&
      !(t as any).deleted
    );
    setHeadOfficeExpenses(hoExpenses);
  };

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

    const isAdminOrHead = currentUser.role === UserRole.ADMIN || currentUser.role === 'HEAD';
    
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

    await saveTransfer(transfer);
    
    await loadData();
    setView('LIST');
    resetForm();
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

  const getBuildingName = (id?: string, type?: string) => {
    if (!id || id === 'HEAD_OFFICE') return 'Head Office';
    if (type === 'OWNER') {
      const owner = owners.find(o => o.id === id);
      return owner ? owner.name : id;
    }
    const b = findBookBuilding(id);
    if (b) {
      // Tag the building with its book name when it lives in a non-active book.
      return b.bookId === activeBookId ? b.name : `${b.name} · ${b.bookName}`;
    }
    const bank = banks.find(x => x.name === id);
    if (bank) return bank.name;
    // Check if it's an owner ID
    const owner = owners.find(o => o.id === id);
    if (owner) return owner.name;
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
      if (transfer) {
        const updated = { ...transfer, deleted: true, deletedAt: Date.now() } as any;
        await saveTransfer(updated);
        // Soft-delete ALL linked transactions (inter-building transfers have two)
        const txIds = collectLinkedTxIds(transfer);
        for (const txId of txIds) {
          const linkedTx = allTransactions.find((t: any) => t.id === txId);
          if (linkedTx) {
            await saveTransaction({ ...linkedTx, deleted: true, deletedAt: new Date().toISOString(), deletedBy: 'SYSTEM_TRANSFER_DELETE' } as any);
          }
        }
        await loadData();
        showToast('Transfer moved to trash.', 'info', 6000, 'Undo', async () => {
          await saveTransfer({ ...updated, deleted: false, deletedAt: undefined } as any);
          for (const txId of txIds) {
            const linkedTx = allTransactions.find((t: any) => t.id === txId);
            if (linkedTx) {
              await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
            }
          }
          showSuccess('Transfer restored.');
          await loadData();
        });
      }
      closeConfirm();
    });
  };

  const handleRestore = async (id: string) => {
    openConfirm('Restore this transfer?', async () => {
      const transfer = transfers.find(t => t.id === id);
      if (transfer) {
        const updated = { ...transfer, deleted: false, deletedAt: undefined } as any;
        await saveTransfer(updated);
        const txIds = collectLinkedTxIds(transfer);
        for (const txId of txIds) {
          const linkedTx = allTransactions.find((t: any) => t.id === txId);
          if (linkedTx) {
            await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
          }
        }
        await loadData();
      }
      closeConfirm();
    });
  };

  const handlePermanentDelete = async (id: string) => {
    openConfirm('PERMANENTLY delete transfer? This cannot be undone!', async () => {
      await deleteTransfer(id);
      await loadData();
      closeConfirm();
    }, { danger: true, title: 'Delete Transfer' });
  };

  const handleRestoreAll = () => {
    const deleted = transfers.filter(t => (t as any).deleted);
    if (deleted.length === 0) return;
    openConfirm(`Restore all ${deleted.length} trashed transfers?`, async () => {
      await Promise.all(deleted.map(async t => {
        await saveTransfer({ ...t, deleted: false, deletedAt: undefined } as any);
        // Also restore ALL linked transactions (includes inter-building dest tx)
        const txIds = collectLinkedTxIds(t);
        for (const txId of txIds) {
          const linkedTx = allTransactions.find((tx: any) => tx.id === txId);
          if (linkedTx) {
            await saveTransaction({ ...linkedTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
          }
        }
      }));
      showSuccess('All trashed transfers restored.');
      await loadData();
      closeConfirm();
    });
  };

  const handleDeleteAll = () => {
    const deleted = transfers.filter(t => (t as any).deleted && !t.isOfficeOpeningBalance);
    if (deleted.length === 0) return;
    openConfirm(`PERMANENTLY delete all ${deleted.length} trashed transfers? This cannot be undone!`, async () => {
      await Promise.all(deleted.map(tx => deleteTransfer(tx.id)));
      showSuccess('All trashed transfers permanently deleted.');
      await loadData();
      closeConfirm();
    }, { danger: true, title: 'Delete All Transfers' });
  };

  const handleEditTransferOpen = (transfer: Transfer) => {
    setEditTransferItem(transfer);
    setEditTransferDate(transfer.date);
    setEditTransferPaymentMethod(transfer.paymentMethod || 'CASH');
    setEditTransferFromBank(transfer.fromBankName || transfer.bankName || '');
    setEditTransferToBank(transfer.toBankName || '');
    setShowEditTransferModal(true);
  };

  const handleEditTransferSubmit = () => {
    if (!editTransferItem || !editTransferDate) return;
    const needsBanks = editTransferPaymentMethod === 'BANK' || editTransferPaymentMethod === 'CHEQUE';
    if (needsBanks && (!editTransferFromBank || !editTransferToBank)) {
      showError('Select both From Bank and To Bank');
      return;
    }
    const pmLabel: Record<string, string> = { BANK: 'Bank Transfer', CASH: 'Cash', CHEQUE: 'Cheque' };
    const lines = [
      '⚠ Please verify before saving:',
      '',
      `Date: ${editTransferDate}`,
      `Payment Method: ${pmLabel[editTransferPaymentMethod] || editTransferPaymentMethod}`,
      ...(needsBanks ? [`From Bank: ${editTransferFromBank}`, `To Bank: ${editTransferToBank}`] : []),
      '',
      'Is this information correct?',
    ];
    openConfirm(lines.join('\n'), async () => {
      const updated: Transfer = {
        ...editTransferItem!,
        date: editTransferDate,
        paymentMethod: editTransferPaymentMethod,
        bankName: needsBanks ? editTransferFromBank : undefined,
        fromBankName: needsBanks ? editTransferFromBank : undefined,
        toBankName: needsBanks ? editTransferToBank : undefined,
      };
      await saveTransfer(updated);
      showSuccess('Transfer updated successfully.');
      setShowEditTransferModal(false);
      await loadData();
      closeConfirm();
    }, { title: 'Confirm Edit Changes' });
  };

  const handleApprove = async (transfer: Transfer) => {
    await saveTransfer({ ...transfer, status: 'COMPLETED' });
    await loadData();
  };

  const handleReject = async (transfer: Transfer) => {
    await saveTransfer({ ...transfer, status: 'CANCELLED' });
    await loadData();
  };

  const isAdminOrHead = currentUser.role === UserRole.ADMIN || currentUser.role === 'HEAD';

  // Get staff's assigned buildings
  const userBuildingIds = currentUser.buildingIds || (currentUser.buildingId ? [currentUser.buildingId] : []);
  const isStaff = !isAdminOrHead && currentUser.role !== UserRole.OWNER;

  const filteredTransfers = transfers.filter(t => {
    // First filter by deleted status
    if (showDeleted ? !(t as any).deleted : (t as any).deleted) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterFromDate && t.date < filterFromDate) return false;
    if (filterToDate && t.date > filterToDate) return false;

    // Account / Building filter
    if (filterAccount !== 'ALL') {
      if (filterAccount === 'HEAD_OFFICE') {
        if (t.fromType !== 'HEAD_OFFICE' && t.toType !== 'HEAD_OFFICE') return false;
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
  });

  // Get office opening balance (sum of all opening balance entries)
  const officeOpeningBalance = transfers.filter(t => t.isOfficeOpeningBalance && !(t as any).deleted).reduce((s, t) => s + t.amount, 0);
  
  // Exclude office opening balance from transfer totals
  const totalIn = filteredTransfers.filter(t => t.toType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s, t) => s + t.amount, 0);
  const totalOut = filteredTransfers.filter(t => t.fromType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s, t) => s + t.amount, 0);
  
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
  const interBuildingTransfers = filteredTransfers.filter(t => t.fromType === 'BUILDING' && t.toType === 'BUILDING');
  const interBuildingTotal = interBuildingTransfers.reduce((s, t) => s + t.amount, 0);

  const handleSaveOpeningBalance = async () => {
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
    await saveTransfer(entry);
    await loadData();
    setEditingOpeningBal(false);
    showSuccess('Opening balance updated');
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

  // Combined entries: transfers + HO expenses, sorted by date descending
  const combinedEntries = [...filteredTransfers.map(tx => ({ ...tx, isHOExpense: false })), ...hoExpenseEntries]
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'From', 'To', 'Amount (SAR)', 'Purpose', 'Status', 'Payment Method'];
    const rows = combinedEntries.map(tx => [
      tx.date,
      (tx as any).isHOExpense ? 'Expense' : 'Transfer',
      getBuildingName(tx.fromId, tx.fromType),
      (tx as any).isHOExpense ? tx.toId : getBuildingName(tx.toId, tx.toType),
      tx.amount.toLocaleString(),
      tx.purpose,
      tx.status,
      `"${formatPaymentMethod(tx).replace(/"/g, '""')}"`
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
      if (accountKey === 'HEAD_OFFICE') return tx.fromType === 'HEAD_OFFICE' || tx.toType === 'HEAD_OFFICE' || tx.fromId === 'HEAD_OFFICE' || tx.toId === 'HEAD_OFFICE';
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
        ? (tx.fromType === 'HEAD_OFFICE' || tx.fromId === 'HEAD_OFFICE')
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
          if (t.fromType !== 'HEAD_OFFICE' && t.toType !== 'HEAD_OFFICE') return false;
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
        <div class="footer-badge"><img src="${window.location.origin}/images/logo.png" alt="" onerror="this.style.display='none'"/> Powered by Amlak</div>
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
        <form onSubmit={handleSubmit} className="ios-card premium-card p-5 sm:p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">New Money Transfer</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">Move funds between buildings, head office, and owners — including inter-building transfers (separate books).</p>
            </div>
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
                <select value={fromType} onChange={e => { setFromType(e.target.value as any); setFromId(''); }} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="BUILDING">{t('entry.building')}</option>
                  <option value="HEAD_OFFICE">Head Office</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>

              {fromType === 'BUILDING' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Select Building</label>
                  <select value={fromId} onChange={e => setFromId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choose building...</option>
                    {renderBuildingOptions()}
                  </select>
                </div>
              )}

              {fromType === 'OWNER' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Select Owner</label>
                  <select value={fromId} onChange={e => setFromId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choose owner...</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> To (Destination)</h3>
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Destination Type</label>
                <select value={toType} onChange={e => { setToType(e.target.value as any); setToId(''); }} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="BUILDING">{t('entry.building')}</option>
                  <option value="HEAD_OFFICE">Head Office</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>

              {toType === 'BUILDING' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Select Building</label>
                  <select value={toId} onChange={e => setToId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choose building...</option>
                    {renderBuildingOptions()}
                  </select>
                </div>
              )}

              {toType === 'OWNER' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Select Owner</label>
                  <select value={toId} onChange={e => setToId(e.target.value)} required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choose owner...</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
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
            <button type="button" onClick={() => setView('LIST')} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50">{t('common.cancel')}</button>
            <button type="submit" className="pm-btn pm-btn-primary flex items-center gap-2">
              <ArrowRightLeft size={18} /> {isOfficeOpeningBalance ? 'Record Balance' : 'Record Transfer'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-6">
            <div className="ios-card p-4 md:p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <div className="text-xs font-bold text-amber-700 uppercase mb-2 flex items-center gap-1"><Wallet size={12} /> Opening Balance</div>
              <div className="text-2xl md:text-3xl font-black text-amber-600">{officeOpeningBalance.toLocaleString()} <span className="text-sm text-amber-400">{t('common.sar')}</span></div>
            </div>
            <div className="ios-card p-4 md:p-6">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Transfers In</div>
              <div className="text-2xl md:text-3xl font-black text-emerald-600">{totalIn.toLocaleString()} <span className="text-sm text-slate-400">{t('common.sar')}</span></div>
            </div>
            <div className="ios-card p-4 md:p-6">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Transfers Out</div>
              <div className="text-2xl md:text-3xl font-black text-rose-600">{totalOut.toLocaleString()} <span className="text-sm text-slate-400">{t('common.sar')}</span></div>
            </div>
            <div className="ios-card p-4 md:p-6 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200">
              <div className="text-xs font-bold text-indigo-700 uppercase mb-2 flex items-center gap-1"><Shuffle size={12} /> Inter-Building</div>
              <div className="text-2xl md:text-3xl font-black text-indigo-600">{interBuildingTotal.toLocaleString()} <span className="text-sm text-indigo-400">{t('common.sar')}</span></div>
              <div className="text-[10px] text-indigo-500 mt-1">{interBuildingTransfers.length} transfer(s)</div>
            </div>
            <div className="ios-card p-4 md:p-6">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Expenses</div>
              <div className="text-2xl md:text-3xl font-black text-amber-600">{totalHOExpenses.toLocaleString()} <span className="text-sm text-slate-400">{t('common.sar')}</span></div>
            </div>
            <div className="ios-card p-4 md:p-6">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Net Balance</div>
              <div className={`text-2xl md:text-3xl font-black ${netBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{netBalance.toLocaleString()} <span className="text-sm text-slate-400">{t('common.sar')}</span></div>
            </div>
          </div>

          <div className="ios-card p-6">
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center mb-6">
              <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" placeholder={t('invoice.from')} />
              <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" placeholder="To" />
              <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="px-3 py-2 border rounded-xl text-sm font-semibold bg-white" title="Filter by account">
                <option value="ALL">All Accounts</option>
                <option value="HEAD_OFFICE">Head Office</option>
                {(() => {
                  const groups = new Map<string, { bookName: string; items: BookBuilding[] }>();
                  buildings.forEach(b => {
                    if (!groups.has(b.bookId)) groups.set(b.bookId, { bookName: b.bookName, items: [] });
                    groups.get(b.bookId)!.items.push(b);
                  });
                  const ordered = Array.from(groups.entries()).sort((a, b) => {
                    if (a[0] === activeBookId) return -1;
                    if (b[0] === activeBookId) return 1;
                    return a[1].bookName.localeCompare(b[1].bookName);
                  });
                  if (ordered.length <= 1) {
                    return (
                      <optgroup label="Buildings">
                        {(ordered[0]?.items || buildings).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </optgroup>
                    );
                  }
                  return ordered.map(([bookId, g]) => (
                    <optgroup key={bookId} label={`${g.bookName}${bookId === activeBookId ? ' (current)' : ''}`}>
                      {g.items.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 border rounded-xl text-sm">
                <option value="ALL">{t('history.allStatus')}</option>
                <option value="PENDING">{t('common.pending')}</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); setFilterStatus('ALL'); setFilterAccount('ALL'); }} className="px-3 py-2 bg-slate-100 rounded-xl text-sm">{t('common.reset')}</button>
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
                <button onClick={handleExportPDF} title="Export as Account Statement PDF" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-violet-700 shadow-sm shadow-violet-200">
                  <FileText size={16} /> Account Statement PDF
                </button>
                <button onClick={handleExportCSV} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600"><Download size={16} />{t('contract.exportCsv')}</button>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {combinedEntries.map(tx => (
                <div key={tx.id} className={`border rounded-xl p-3 shadow-sm space-y-2 ${tx.isOfficeOpeningBalance ? 'border-amber-200 bg-amber-50' : (tx as any).isHOExpense ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
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
                          <div className="text-[11px] text-rose-600">Head Office - {tx.toId}</div>
                          <div className="text-[11px] text-slate-500">{formatPaymentMethod(tx)}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-slate-800 text-sm">{tx.purpose || 'Transfer'}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            {tx.fromType === 'OWNER' && <UserCircle size={12} className="text-purple-500" />}
                            From: {getBuildingName(tx.fromId, tx.fromType)}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            {tx.toType === 'OWNER' && <UserCircle size={12} className="text-purple-500" />}
                            To: {getBuildingName(tx.toId, tx.toType)}
                          </div>
                          {((tx as any).paymentMethod || (tx as any).fromBankName) && (
                            <div className="text-[10px] mt-1">
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold" title={formatPaymentMethod(tx)}>
                                {formatPaymentMethod(tx)}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      {tx.isOfficeOpeningBalance && editingOpeningBal ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={openingBalInput} onChange={e => setOpeningBalInput(e.target.value)} className="w-24 px-2 py-1 border rounded-lg text-sm font-bold text-amber-700" autoFocus />
                          <button onClick={handleSaveOpeningBalance} className="p-1 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
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
                  <div className="flex gap-2 justify-end pt-1">
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
                        {isAdminOrHead && tx.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleApprove(tx as any)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-bold">{t('approval.approve')}</button>
                            <button onClick={() => handleReject(tx as any)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold">{t('approval.reject')}</button>
                          </>
                        )}
                        {isAdminOrHead && !tx.isOfficeOpeningBalance && (
                          <button onClick={() => handleEditTransferOpen(tx as any)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">{t('common.edit')}</button>
                        )}
                        {isAdminOrHead && tx.isOfficeOpeningBalance && (
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
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('invoice.from')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">To</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.amount')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Purpose</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {combinedEntries.map(tx => (
                    <tr key={tx.id} className={`hover:bg-slate-50 ${tx.isOfficeOpeningBalance ? 'bg-amber-50' : (tx as any).isHOExpense ? 'bg-rose-50' : (tx.fromType === 'BUILDING' && tx.toType === 'BUILDING') ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-4 py-4 text-sm font-mono">{fmtDate(tx.date)}</td>
                      <td className="px-4 py-4 text-sm">
                        {tx.isOfficeOpeningBalance ? (
                          <div className="flex items-center gap-2">
                            <Wallet size={14} className="text-amber-600" />
                            <span className="font-bold text-amber-700">Old System</span>
                          </div>
                        ) : (tx as any).isHOExpense ? (
                          <div className="flex items-center gap-2">
                            <TrendingDown size={14} className="text-rose-500" />
                            <span className="font-bold text-rose-700">Head Office</span>
                          </div>
                        ) : (
                        <div className="flex items-center gap-2">
                          {tx.fromType === 'BUILDING' ? <Building2 size={14} className="text-violet-500" /> : tx.fromType === 'BANK' ? <Landmark size={14} className="text-blue-500" /> : tx.fromType === 'OWNER' ? <UserCircle size={14} className="text-purple-500" /> : <Building2 size={14} className="text-slate-500" />}
                          <span className="font-bold">{getBuildingName(tx.fromId, tx.fromType)}</span>
                        </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {tx.isOfficeOpeningBalance ? (
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-amber-600" />
                            <span className="font-bold text-amber-700">Head Office</span>
                          </div>
                        ) : (tx as any).isHOExpense ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-700">{tx.toId}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500" title={formatPaymentMethod(tx)}>{formatPaymentMethod(tx)}</span>
                          </div>
                        ) : (
                        <div className="flex items-center gap-2">
                          {tx.toType === 'BUILDING' ? <Building2 size={14} className="text-violet-500" /> : tx.toType === 'BANK' ? <Landmark size={14} className="text-blue-500" /> : tx.toType === 'OWNER' ? <UserCircle size={14} className="text-purple-500" /> : <Building2 size={14} className="text-slate-500" />}
                          <span className="font-bold">{getBuildingName(tx.toId, tx.toType)}</span>
                        </div>
                        )}
                      </td>
                      <td className={`px-4 py-4 text-sm font-bold ${(tx as any).isHOExpense ? 'text-rose-700' : 'text-slate-800'}`}>
                        {tx.isOfficeOpeningBalance && editingOpeningBal ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={openingBalInput} onChange={e => setOpeningBalInput(e.target.value)} className="w-28 px-2 py-1 border rounded-lg text-sm font-bold text-amber-700" autoFocus />
                            <button onClick={handleSaveOpeningBalance} className="p-1 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setEditingOpeningBal(false)} className="p-1 bg-slate-200 text-slate-600 rounded-lg"><X size={14} /></button>
                          </div>
                        ) : (
                          <>{tx.amount.toLocaleString()} SAR</>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {tx.fromType === 'BUILDING' && tx.toType === 'BUILDING' && !(tx as any).isHOExpense && (
                          <span className="mr-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                            <Shuffle size={10} /> Inter-Bldg
                          </span>
                        )}
                        <span>{tx.purpose}</span>
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
                      <td className="px-4 py-4">
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
                              {isAdminOrHead && !tx.isOfficeOpeningBalance && (
                                <button onClick={() => handleEditTransferOpen(tx as any)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Edit Date / Payment Method">
                                  <Pencil size={16} />
                                </button>
                              )}
                              {isAdminOrHead && tx.isOfficeOpeningBalance && (
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
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No entries found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Edit Transfer Modal */}
      {showEditTransferModal && editTransferItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Pencil size={18} className="text-blue-600" /> Edit Transfer</h3>
              <button onClick={() => setShowEditTransferModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t('common.date')}</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none" value={editTransferDate} onChange={e => setEditTransferDate(e.target.value)} required />
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

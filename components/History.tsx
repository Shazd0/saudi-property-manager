import { getTransactions, deleteTransaction, updateTransactionStatus, getContracts, getCustomers, getBuildings, requestTransactionDeletion, getBanks, createCreditNote, saveTransaction, saveContract, requestTransactionEdit, getSettings, getUsers, getServiceAgreements, saveServiceAgreement, getTransfers, softDeleteTransfer, restoreTransfer, getVendors, restoreStockFromTransaction, redeductStockFromTransaction, backfillInterBuildingTransactions } from '../services/firestoreService';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
// ...existing code...

/** Persist state to sessionStorage so filters survive tab switches */
function useStickyState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try { const v = sessionStorage.getItem(key); return v !== null ? JSON.parse(v) : defaultValue; } catch { return defaultValue; }
  });
  const set: React.Dispatch<React.SetStateAction<T>> = useCallback((action: React.SetStateAction<T>) => {
    setValue(prev => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [value, set];
}
import { useLanguage } from '../i18n/LanguageContext';
import { Transaction, User, UserRole, TransactionType, TransactionStatus, ExpenseCategory, PaymentMethod, Building, Vendor } from '../types';
import { Filter, Download, Search, AlertOctagon, ChevronDown, AlertTriangle, Trash2, Printer, MessageCircle, Home, X, CheckCircle, Calendar, RefreshCcw, SlidersHorizontal, FileText, RotateCcw, Eye, Pencil, Building2, Check } from 'lucide-react';
import SavedFilters from './SavedFilters';
import { Bank } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import { formatNameWithRoom, buildCustomerRoomMap } from '../utils/customerDisplay';
import { zatcaSignAndReportPath } from '../config/zatcaServiceUrl';
import SearchableSelect from './SearchableSelect';

interface HistoryProps {
  currentUser: User;
}

const TransactionHistory: React.FC<HistoryProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showSuccess, showInfo, showError, showToast } = useToast();
    const { t } = useLanguage();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [openingBalancesByBuilding, setOpeningBalancesByBuilding] = useState<Record<string, { cash: number; bank: number; date?: string }>>({});
    const [staff, setStaff] = useState<User[]>([]);
    const [owners, setOwners] = useState<User[]>([]);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    // Edit Payment Method Modal State
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
    const [editPaymentTx, setEditPaymentTx] = useState<Transaction | null>(null);
    const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod | ''>('');
    const [editBankName, setEditBankName] = useState('');
    const [editChequeNo, setEditChequeNo] = useState('');
    const [editChequeDueDate, setEditChequeDueDate] = useState('');
    const [editTxDate, setEditTxDate] = useState('');

    /**
     * Human-readable payment method label that reveals the bank flow for
     * treasury-linked transactions (e.g. "Bank Transfer: Al Rajhi → SNB").
     * Falls back to the raw paymentMethod when no bank info is attached.
     */
    const fmtPaymentMethod = (r: any): string => {
        if (!r) return '';
        const raw = String(r.paymentMethod || '').toUpperCase();
        const original = String(r.originalPaymentMethod || '').toUpperCase();
        const fromBank = r.fromBankName || ((raw === 'BANK' || raw === 'CHEQUE' || original === 'BANK' || original === 'CHEQUE') ? r.bankName : '') || '';
        const toBank = r.toBankName || '';
        const effective = original || raw;
        // TEMPORARY: Treasury transfers without explicit BANK/CHEQUE user choice are
        // displayed as "Cash" in transaction history per user request.
        const label = effective === 'BANK' ? 'Bank Transfer'
            : effective === 'CHEQUE' ? 'Cheque'
            : effective === 'CASH' ? 'Cash'
            : effective === 'TREASURY' ? 'Cash'
            : effective;
        if (fromBank && toBank) return `${label}: ${fromBank} → ${toBank}`;
        if (fromBank) return `${label}: ${fromBank}`;
        return label;
    };

    // When opening modal, prefill fields
    useEffect(() => {
        if (showEditPaymentModal && editPaymentTx) {
            setEditPaymentMethod(editPaymentTx.paymentMethod || '');
            setEditBankName(editPaymentTx.bankName || '');
            setEditChequeNo(editPaymentTx.chequeNo || '');
            setEditChequeDueDate(editPaymentTx.chequeDueDate || '');
            setEditTxDate(editPaymentTx.date || '');
        }
    }, [showEditPaymentModal, editPaymentTx]);

    // Handle submit for edit payment method
    const handleEditPaymentSubmit = () => {
        if (!editPaymentTx || !editPaymentMethod) return;
        const pmLabel: Record<string, string> = { BANK: 'Bank Transfer', CASH: 'Cash', CHEQUE: 'Cheque', TREASURY: 'Treasury' };
        const lines = [
            '\u26a0 Please verify the following before submitting:',
            '',
            `Date: ${editTxDate}`,
            `Payment Method: ${pmLabel[editPaymentMethod as string] || editPaymentMethod}`,
            ...(editPaymentMethod === PaymentMethod.BANK && editBankName ? [`Bank: ${editBankName}`] : []),
            ...(editPaymentMethod === PaymentMethod.CHEQUE && editChequeNo ? [`Cheque No: ${editChequeNo}`] : []),
            '',
            'Is this information correct?',
        ];
        openConfirm(lines.join('\n'), async () => {
            const newData: Partial<Transaction> = {
                paymentMethod: editPaymentMethod,
                bankName: editPaymentMethod === PaymentMethod.BANK ? editBankName : '',
                chequeNo: editPaymentMethod === PaymentMethod.CHEQUE ? editChequeNo : '',
                chequeDueDate: editPaymentMethod === PaymentMethod.CHEQUE ? editChequeDueDate : '',
                ...(editTxDate ? { date: editTxDate } : {}),
            };
            try {
                await saveTransaction({ ...editPaymentTx!, ...newData } as any);
                showSuccess('Transaction updated successfully.');
                setShowEditPaymentModal(false);
                await loadData();
            } catch (e) {
                showError('Failed to update transaction.');
            }
            closeConfirm();
        }, { title: 'Confirm Edit Changes' });
    };

    // ─── Convert to VAT Modal State ──────────────────────────────────────────
    const [showVatModal, setShowVatModal] = useState(false);
    const [vatModalTx, setVatModalTx] = useState<Transaction | null>(null);
    const [vatInvoiceNumber, setVatInvoiceNumber] = useState('');
    const [vatCustomerVATNumber, setVatCustomerVATNumber] = useState('');
    const [vatVendorVATNumber, setVatVendorVATNumber] = useState('');
    const [vatVendorId, setVatVendorId] = useState('');
    const [vatVendorSearch, setVatVendorSearch] = useState('');
    const [vatVendorDropdownOpen, setVatVendorDropdownOpen] = useState(false);
    const [vatSaving, setVatSaving] = useState(false);
    const [vatIsInclusive, setVatIsInclusive] = useState(true); // expense default: inclusive; income: exclusive

    const openVatModal = (tx: Transaction) => {
        setVatModalTx(tx);
        const autoInv = `INV-${tx.id.slice(0, 8).toUpperCase()}`;
        setVatInvoiceNumber(tx.vatInvoiceNumber || autoInv);
        // Pre-fill customer VAT from customers list
        if (tx.type === TransactionType.INCOME) {
            const contractCustomerId = (tx as any).customerId;
            const cust = customers.find(c => c.id === contractCustomerId);
            setVatCustomerVATNumber(tx.customerVATNumber || cust?.vatNumber || '');
            setVatIsInclusive(false); // income: entered amounts are typically exclusive
        } else {
            const existingVendor = vendors.find(v => v.id === (tx as any).vendorId);
            setVatVendorId((tx as any).vendorId || '');
            setVatVendorSearch(existingVendor ? (existingVendor.nameEn || existingVendor.name) : (tx.vendorName || ''));
            setVatVendorVATNumber(tx.vendorVATNumber || existingVendor?.vatNumber || existingVendor?.vatNo || '');
            setVatIsInclusive(true); // expense: amount is typically VAT-inclusive
        }
        setVatVendorDropdownOpen(false);
        setShowVatModal(true);
    };

    const vatBreakdown = useMemo(() => {
        if (!vatModalTx) return null;
        const base = vatModalTx.amount || 0;
        if (vatIsInclusive) {
            const exclusive = Number((base / 1.15).toFixed(2));
            const vat = Number((base - exclusive).toFixed(2));
            return { exclusive, vat, inclusive: base };
        } else {
            const vat = Number((base * 0.15).toFixed(2));
            const inclusive = Number((base + vat).toFixed(2));
            return { exclusive: base, vat, inclusive };
        }
    }, [vatModalTx, vatIsInclusive]);

    // ZATCA QR (copy of EntryForm version, local to History)
    const buildZATCAQR = (tx: Transaction, bd: { exclusive: number; vat: number; inclusive: number }) => {
        const sellerName = 'شركة ارار ميلينيوم المحدودة';
        const sellerVAT = '312610089400003';
        const timestamp = new Date(t.date || Date.now()).toISOString();
        const toHex = (str: string) => Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('');
        const encode = (tag: number, val: string) => { const h = toHex(val); return tag.toString(16).padStart(2, '0') + (h.length / 2).toString(16).padStart(2, '0') + h; };
        const tlv = [encode(1, sellerName), encode(2, sellerVAT), encode(3, timestamp), encode(4, bd.inclusive.toString()), encode(5, bd.vat.toString())].join('');
        const bytes: number[] = [];
        for (let i = 0; i < tlv.length; i += 2) bytes.push(parseInt(tlv.substr(i, 2), 16));
        return btoa(String.fromCharCode(...bytes));
    };

    const vatMissingFields = useMemo(() => {
        if (!vatModalTx) return [];
        const missing: string[] = [];
        if (!vatInvoiceNumber.trim()) missing.push('Invoice Number');
        if (vatModalTx.type === TransactionType.INCOME && !vatCustomerVATNumber.trim()) missing.push('Customer VAT Number (recommended for B2B)');
        return missing;
    }, [vatModalTx, vatInvoiceNumber, vatCustomerVATNumber]);

    const handleVatConvertSubmit = async () => {
        if (!vatModalTx || !vatBreakdown) return;
        setVatSaving(true);
        try {
            const inv = vatInvoiceNumber.trim() || `INV-${vatModalTx.id.slice(0, 8).toUpperCase()}`;
            const updated: Transaction = {
                ...vatModalTx,
                isVATApplicable: true,
                vatInvoiceNumber: inv,
                vatRate: 15,
                vatAmount: vatBreakdown.vat,
                amountExcludingVAT: vatBreakdown.exclusive,
                amountIncludingVAT: vatBreakdown.inclusive,
                totalWithVat: vatBreakdown.inclusive,
                lastModifiedAt: Date.now(),
                ...(vatModalTx.type === TransactionType.INCOME
                    ? { customerVATNumber: vatCustomerVATNumber || undefined }
                    : {
                        vendorVATNumber: vatVendorVATNumber || undefined,
                        vendorId: vatVendorId || (vatModalTx as any).vendorId || undefined,
                        vendorName: vatVendorSearch || vatModalTx.vendorName || undefined,
                    }),
            };
            if (vatModalTx.type === TransactionType.INCOME) {
                updated.zatcaQRCode = buildZATCAQR(updated, vatBreakdown);
            }
            await saveTransaction(updated);
            showSuccess(vatModalTx.type === TransactionType.INCOME
                ? `Sales invoice ${inv} converted & reported to ZATCA.`
                : `Purchase invoice ${inv} converted to VAT.`);
            setShowVatModal(false);
            setVatModalTx(null);
            await loadData();
        } catch (e) {
            showError('Failed to convert transaction to VAT.');
        }
        setVatSaving(false);
    };

    const formatCustomerLabel = (c: any) => {
        const code = c?.code ? String(c.code).padStart(2, '0') : '';
        const baseName = c?.nameEn || c?.nameAr || c?.name || c?.id;
        const name = formatNameWithRoom(baseName, c?.roomNumber);
        return code ? `${code} - ${name}` : name;
    };
    const sortedCustomers = useMemo(() => {
        return [...customers]
            .filter(c => !(c as any).deleted && !c.isBlacklisted)
            .sort((a, b) => {
                const nameA = (a?.nameEn || a?.nameAr || a?.name || '').toLowerCase();
                const nameB = (b?.nameEn || b?.nameAr || b?.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
    }, [customers]);
    
    // Search (debounced: searchInput is the display value, searchTerm is the debounced filter value)
    const [searchTerm, setSearchTerm] = useStickyState('hist_searchTerm', '');
    const [searchInput, setSearchInput] = useStickyState('hist_searchInput', '');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => setSearchTerm(searchInput), 300);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchInput]);
    
    // Pre-fill filterCustomer from navigation state (from CustomerManager)
    useEffect(() => {
        if (location.state?.filterCustomer) {
            setFilterCustomer(location.state.filterCustomer);
            setShowFilters(true); // Show filters when customer is pre-selected
        }
    }, [location.state]);
    
    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [filterType, setFilterType] = useStickyState('hist_filterType', 'ALL');
    const [filterMethod, setFilterMethod] = useStickyState('hist_filterMethod', 'ALL');
    const [filterStatus, setFilterStatus] = useStickyState('hist_filterStatus', 'ALL');
    const [filterCategory, setFilterCategory] = useStickyState('hist_filterCategory', 'ALL');
    const [filterBuildingIds, setFilterBuildingIds] = useStickyState<string[]>('hist_filterBuildingIds', []);
    const [showBuildingPicker, setShowBuildingPicker] = useState(false);
    const [buildingPickerSearch, setBuildingPickerSearch] = useState('');
    const buildingPickerRef = useRef<HTMLDivElement | null>(null);
    const buildingTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [buildingPickerRect, setBuildingPickerRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [filterBankName, setFilterBankName] = useStickyState('hist_filterBankName', 'ALL');
    const [filterCustomer, setFilterCustomer] = useStickyState('hist_filterCustomer', 'ALL');
    const [filterUnit, setFilterUnit] = useStickyState('hist_filterUnit', '');
    const [filterDateFrom, setFilterDateFrom] = useStickyState('hist_filterDateFrom', '');
    const [filterDateTo, setFilterDateTo] = useStickyState('hist_filterDateTo', '');
    const [filterTillDate, setFilterTillDate] = useStickyState('hist_filterTillDate', '');
    const [filterVat, setFilterVat] = useStickyState<'ALL' | 'WITH' | 'WITHOUT'>('hist_filterVat', 'ALL');
    const [filterEmployee, setFilterEmployee] = useStickyState('hist_filterEmployee', 'ALL');
    const [filterOwner, setFilterOwner] = useStickyState('hist_filterOwner', 'ALL');
    const isAdminOrManager = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
    const userBuildingIds = useMemo(() => {
        const scopedIds = (currentUser as any)?.buildingIds;
        if (Array.isArray(scopedIds) && scopedIds.length > 0) return scopedIds as string[];
        return currentUser?.buildingId ? [currentUser.buildingId] : [];
    }, [currentUser]);
    
    // Deletion State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirm');
    const [confirmDanger, setConfirmDanger] = useState(false);
    const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

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

    // Load Data
    const loadData = async () => {
        // Self-heal: make sure every inter-building transfer has BOTH source and
        // destination transaction records in Firestore before we read them below.
        // Admins & Managers only — staff users shouldn't trigger schema writes.
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
            try { await backfillInterBuildingTransactions(); } catch { /* non-fatal */ }
        }

        const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
        let txs = await getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds, includeDeleted: true });

        // Fallback: if scoped fetch is empty (e.g. no building assignment), load broader data
        // and safely narrow for non-admin users so History doesn't appear blank.
        if ((!txs || txs.length === 0)) {
            // Force broad fetch for fallback; we'll apply safe client-side filtering below.
            const allTxs = await getTransactions({ role: UserRole.ADMIN as any, includeDeleted: true });
            if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
                txs = allTxs;
            } else {
                txs = (allTxs || []).filter((t: any) => t.createdBy === currentUser.id);
            }
        }

        const [allBuildings, allCustomers, allBanks, appSettings, allUsers, allTransfers, allVendors] = await Promise.all([
            getBuildings(),
            getCustomers(),
            getBanks(),
            getSettings().catch(() => null),
            getUsers(),
            getTransfers({}),
            getVendors(),
        ]);
        setTransactions((txs || []).filter((t: any) => !t.vatReportOnly || (t.date && t.date >= '2024-04-01')));
        setBuildings(allBuildings || []);
        setCustomers(allCustomers || []);
        setBanks(allBanks || []);
        setVendors(allVendors || []);
        setTransfers(allTransfers || []);
        setOpeningBalancesByBuilding(((appSettings as any)?.openingBalancesByBuilding || {}) as Record<string, { cash: number; bank: number; date?: string }>);
        setStaff((allUsers || []).filter((u: any) => u.role === 'STAFF' || u.role === 'EMPLOYEE'));
        setOwners((allUsers || []).filter((u: any) => u.role === 'OWNER'));
    };

    useEffect(() => { loadData(); }, []);

    // Refresh data whenever this page becomes visible again (e.g. navigating back from EntryForm)
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    // Auto-select user's building(s) on component mount
    useEffect(() => {
        if (userBuildingIds.length > 0) {
            setFilterBuildingIds(userBuildingIds);
        }
    }, [currentUser?.id, userBuildingIds, setFilterBuildingIds]);

    // Close building picker when clicking outside / pressing Escape, and track trigger position
    useEffect(() => {
        if (!showBuildingPicker) return;

        const updatePos = () => {
            const el = buildingTriggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            setBuildingPickerRect({ top: r.bottom, left: r.left, width: r.width });
        };
        updatePos();

        const onDocClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (buildingPickerRef.current && buildingPickerRef.current.contains(t)) return;
            if (buildingTriggerRef.current && buildingTriggerRef.current.contains(t)) return;
            setShowBuildingPicker(false);
        };
        const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowBuildingPicker(false); };

        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        window.addEventListener('resize', updatePos);
        window.addEventListener('scroll', updatePos, true);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
            window.removeEventListener('resize', updatePos);
            window.removeEventListener('scroll', updatePos, true);
        };
    }, [showBuildingPicker]);

    const buildingOptions = useMemo(() => {
        if (isAdminOrManager) return buildings;
        if (userBuildingIds.length === 0) return buildings;
        return buildings.filter(b => userBuildingIds.includes(b.id));
    }, [buildings, isAdminOrManager, userBuildingIds]);

    const getBuildingName = (id?: string) => {
        if (!id) return '';
        // Handle comma-separated IDs (common area with multiple buildings)
        if (id.includes(',')) return '';
        const b = buildings.find(x => x.id === id || (x as any)._id === id);
        return b ? b.name : '';
    };

    const getCustomerName = (id?: string) => {
        if (!id) return '';
        const c = customers.find(x => x.id === id || (x as any)._id === id);
        if (!c) return '';
        const baseName = c.nameEn || c.nameAr || (c as any).name || c.id;
        return formatNameWithRoom(baseName, c.roomNumber);
    };
    const normalize = (v?: string) => String(v || '').trim().toLowerCase();
    const matchTransactionBuilding = useCallback((tx: Transaction, buildingId: string) => {
        const targetId = normalize(buildingId);
        const targetName = normalize(getBuildingName(buildingId));
        if (!targetId) return false;

        // Treasury-linked rows (the EXPENSE on the sender and the INCOME on the
        // receiver) share the same fromId/toId on the linked transfer. Matching on
        // fromId/toId would leak both legs into BOTH buildings. Always match strictly
        // by the transaction's own buildingId for treasury-sourced rows, never falling
        // back to fromId/toId.
        if ((tx as any).source === 'treasury') {
            if (!tx.buildingId) return false;
            return normalize(tx.buildingId) === targetId;
        }

        const rawIds = [
            tx.buildingId,
            (tx as any).building,
            (tx as any).building_id,
            (tx as any).targetBuildingId,
            (tx as any).fromId,
            (tx as any).toId,
        ]
            .flatMap(v => String(v || '').split(','))
            .map(v => normalize(v))
            .filter(Boolean);

        if (rawIds.includes(targetId)) return true;

        // Legacy rows may store building by name in `building` or `buildingName`.
        const rawNames = [
            tx.buildingName,
            typeof (tx as any).building === 'string' ? (tx as any).building : '',
            (tx as any).building_name,
        ]
            .flatMap(v => String(v || '').split(','))
            .map(v => normalize(v))
            .filter(Boolean);

        if (targetName && rawNames.includes(targetName)) return true;
        return false;
    }, [buildings]);

    const extractCustomerIdFromDetails = (details?: string) => {
        if (!details) return undefined;
        const parts = details.split('to ');
        if (parts.length > 1) return parts[1].trim();
        return undefined;
    };

    const getTransactionCategory = (tx: Transaction): string => {
        if ((tx as any).source === 'treasury') return 'Treasury Transfer';
        const category = (tx.expenseCategory || '').trim();
        if (category) return category;
        if ((tx as any).source === 'opening_balance') return 'Opening Balance';
        if (tx.type === TransactionType.INCOME) return 'Rent Income';
        return '';
    };

    /** Build a readable label for a treasury transfer row */
    const getTreasuryLabel = (row: any): string => {
        const bName = getBuildingName(row.buildingId || row.building) || row.buildingName || 'Building';
        if (row.fromType === 'BUILDING' && row.toType === 'HEAD_OFFICE') {
            return `Treasury: ${bName} → Head Office`;
        }
        if (row.fromType === 'HEAD_OFFICE' && row.toType === 'BUILDING') {
            return `Treasury: Head Office → ${bName}`;
        }
        if (row.fromType === 'BUILDING' && row.toType === 'OWNER') {
            return `Treasury: ${bName} → Owner`;
        }
        if (row.fromType === 'OWNER' && row.toType === 'BUILDING') {
            return `Treasury: Owner → ${bName}`;
        }
        return `Treasury Transfer${bName ? '  -  ' + bName : ''}`;
    };

    const categoryOptions = useMemo(() => {
        const set = new Set<string>(Object.values(ExpenseCategory));
        for (const tx of transactions) {
            const c = getTransactionCategory(tx);
            if (c) set.add(c);
        }
        if (Object.keys(openingBalancesByBuilding || {}).length > 0) set.add('Opening Balance');
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [transactions, openingBalancesByBuilding]);

    const handleDeleteStart = (tx: Transaction) => {
        setTxToDelete(tx);
        setShowDeleteModal(true);
    };

    const openView = (tx: Transaction) => {
        setSelectedTx(tx);
        setShowViewModal(true);
    };

    const closeView = () => {
        setShowViewModal(false);
        setSelectedTx(null);
    };

    const handleDeleteConfirm = async () => {
        if (!txToDelete) return;
        try {
            // If VAT INCOME (sales) transaction was already reported to ZATCA,
            // create a credit note; otherwise proceed with normal deletion flow.
            const isReportedToZatca = Boolean((txToDelete as any).zatcaQRCode || (txToDelete as any).zatcaReportedAt);
            if (txToDelete.isVATApplicable && txToDelete.vatInvoiceNumber && isReportedToZatca && !(txToDelete as any).isCreditNote && txToDelete.type === TransactionType.INCOME) {
                const cn = await createCreditNote(txToDelete);
                // Auto-report Credit Note to ZATCA (Phase 2 or offline fallback)
                try {
                    const zatcaUrl = zatcaSignAndReportPath();
                    const cnPayload = {
                        invoiceNumber: cn.vatInvoiceNumber,
                        issueDate: cn.date,
                        buyerName: cn.unitNumber || cn.buildingName || '',
                        buyerVAT: cn.customerVATNumber || '',
                        amount: -(Math.abs(cn.amountExcludingVAT ?? cn.amount ?? 0)),
                        vatRate: cn.vatRate ?? 15,
                        description: cn.details || 'Credit Note',
                        isCreditNote: true,
                        originalInvoiceId: txToDelete.vatInvoiceNumber,
                    };
                    let qrCode = '';
                    try {
                        const res = await fetch(zatcaUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cnPayload), signal: AbortSignal.timeout(8000) });
                        const data = await res.json();
                        if (res.ok && data.qrCode) qrCode = data.qrCode;
                    } catch {
                        const getHex = (str: string) => Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2,'0')).join('');
                        const toHex  = (n: number) => n.toString(16).padStart(2,'0');
                        const bLen   = (s: string) => new TextEncoder().encode(s).length;
                        const tags = ['Company','300000000000003', new Date(cn.date).toISOString().replace('T',' ').substring(0,19)+'Z', cnPayload.amount.toFixed(2), (-(Math.abs(cn.vatAmount||0))).toFixed(2)];
                        let hex = ''; tags.forEach((v,i) => { hex += toHex(i+1)+toHex(bLen(v))+getHex(v); });
                        const bytes = new Uint8Array(hex.length/2);
                        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i*2,i*2+2),16);
                        qrCode = btoa(String.fromCharCode(...bytes));
                    }
                    if (qrCode) await saveTransaction({ ...cn, zatcaQRCode: qrCode, zatcaReportedAt: new Date().toISOString() });
                } catch { /* non-fatal */ }

                // â”€â”€ Undo rent: reduce upfrontPaid on the linked contract â”€â”€
                const contractId = txToDelete.contractId;
                if (contractId) {
                    try {
                        const allContracts = await getContracts();
                        const contract = allContracts.find((c: any) => c.id === contractId);
                        if (contract) {
                            const paidSoFar = Number((contract as any).upfrontPaid || 0);
                            const invoiceAmt = Math.abs(Number(txToDelete.amountIncludingVAT || txToDelete.totalWithVat || txToDelete.amount || 0));
                            await saveContract({ ...contract, upfrontPaid: Math.max(0, paidSoFar - invoiceAmt) });
                        }
                    } catch { /* non-fatal */ }
                }

                showSuccess('Credit Note created and reported to ZATCA. Original invoice retained for audit.');
                await loadData();
                setShowDeleteModal(false);
                setTxToDelete(null);
                return;
            }

            if (currentUser.role === UserRole.ADMIN) {
                const updated = {
                    ...txToDelete,
                    deleted: true,
                    deletedAt: new Date().toISOString(),
                    deletedBy: currentUser.id,
                } as any;
                await saveTransaction(updated);

                // Restore stock quantities if this is a stock-sale transaction
                if ((updated as any).isStockIssue && Array.isArray((updated as any).items)) {
                    await restoreStockFromTransaction(updated, currentUser.id);
                }

                // If this transaction came from the Treasury tab, also trash the linked transfer
                const linkedTransferId = (txToDelete as any).transferId;
                if (linkedTransferId) {
                    await softDeleteTransfer(linkedTransferId, currentUser.id);
                }

                // If this is a credit note, also trash the original VAT transaction
                if ((txToDelete as any).isCreditNote && (txToDelete as any).originalInvoiceId) {
                    const originalTx = transactions.find(
                        (t: any) => t.vatInvoiceNumber === (txToDelete as any).originalInvoiceId && !(t as any).deleted
                    );
                    if (originalTx) {
                        const updatedOriginal = {
                            ...originalTx,
                            deleted: true,
                            deletedAt: new Date().toISOString(),
                            deletedBy: currentUser.id,
                        } as any;
                        await saveTransaction(updatedOriginal);
                        const origTransferId = (originalTx as any).transferId;
                        if (origTransferId) await softDeleteTransfer(origTransferId, currentUser.id);
                    }
                    showToast('Credit note and original VAT transaction moved to trash.', 'info', 6000, 'Undo', async () => {
                        const restoredCN = { ...updated, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
                        await saveTransaction(restoredCN);
                        if (linkedTransferId) await restoreTransfer(linkedTransferId);
                        if (originalTx) {
                            const restoredOrig = { ...originalTx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
                            await saveTransaction(restoredOrig);
                            const origTransferId = (originalTx as any).transferId;
                            if (origTransferId) await restoreTransfer(origTransferId);
                        }
                        showSuccess('Restored.');
                        await loadData();
                    });
                } else {
                    showToast('Transaction moved to trash.', 'info', 6000, 'Undo', async () => {
                        const restored = { ...updated, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
                        await saveTransaction(restored);
                        // Re-deduct stock since we're un-deleting
                        if ((restored as any).isStockIssue && Array.isArray((restored as any).items)) {
                            await redeductStockFromTransaction(restored, currentUser.id);
                        }
                        if (linkedTransferId) await restoreTransfer(linkedTransferId);
                        showSuccess('Transaction restored.');
                        await loadData();
                    });
                }
            } else {
                // Non-admins create a deletion request for approval
                await requestTransactionDeletion(currentUser.id, txToDelete.id);
                showInfo('Deletion request has been sent to admin for approval. If accepted, the transaction will be deleted.');
            }
            await loadData(); // Reload all data
            setShowDeleteModal(false);
            setTxToDelete(null);
        } catch (error) {
            console.error('Delete error:', error);
            showError('Failed to process deletion. Please try again.');
        }
    };

    const handleRestore = async (tx: Transaction) => {
        if (currentUser.role !== UserRole.ADMIN) {
            showError('Only administrators can restore deleted transactions.');
            return;
        }
        openConfirm('Restore this transaction from trash?', async () => {
            try {
                const restored = { ...tx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
                await saveTransaction(restored);
                // Re-deduct stock since we're restoring a trashed transaction
                if ((restored as any).isStockIssue && Array.isArray((restored as any).items)) {
                    await redeductStockFromTransaction(restored, currentUser.id);
                }
                showSuccess('Transaction restored.');
                await loadData();
            } catch (error) {
                console.error('Restore error:', error);
                showError('Failed to restore transaction. Please try again.');
            }
            closeConfirm();
        });
    };

    const handlePermanentDelete = async (tx: Transaction) => {
        if (currentUser.role !== UserRole.ADMIN) {
            showError('Only administrators can permanently delete transactions.');
            return;
        }
        openConfirm('PERMANENTLY delete this transaction? This cannot be undone!', async () => {
            try {
                // If this is a service agreement payment, remove it from the agreement
                const isServiceAgreementPayment = tx.serviceAgreementId || tx.expenseCategory === 'Service Agreement' || tx.expenseCategory === ExpenseCategory.SERVICE_AGREEMENT;
                
                if (isServiceAgreementPayment) {
                    const agreements = await getServiceAgreements();
                    let agreement = tx.serviceAgreementId 
                        ? agreements.find(a => a.id === tx.serviceAgreementId)
                        : agreements.find(a => a.payments?.some(p => p.date === tx.date && p.amount === tx.amount));
                    
                    if (agreement && agreement.payments && agreement.payments.length > 0) {
                        // Find and remove the matching payment (by date and amount)
                        const paymentIndex = agreement.payments.findIndex(
                            p => p.date === tx.date && p.amount === tx.amount
                        );
                        if (paymentIndex !== -1) {
                            const updatedPayments = [...agreement.payments];
                            updatedPayments.splice(paymentIndex, 1);
                            await saveServiceAgreement({
                                ...agreement,
                                payments: updatedPayments,
                                updatedAt: Date.now()
                            });
                        }
                    }
                }
                // If this transaction came from the Treasury tab, also permanently delete the linked transfer
                const linkedTransferId = (tx as any).transferId;
                if (linkedTransferId) {
                    await softDeleteTransfer(linkedTransferId, currentUser.id);
                }
                await deleteTransaction(tx.id, { skipStockRestore: true });
                showSuccess('Transaction permanently deleted.');
                await loadData();
            } catch (error) {
                console.error('Permanent delete error:', error);
                showError('Failed to permanently delete transaction. Please try again.');
            }
            closeConfirm();
        }, { danger: true, title: 'Delete Transaction' });
    };

    const handleRestoreAll = () => {
        const deleted = transactions.filter(t => (t as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`Restore all ${deleted.length} trashed transactions?`, async () => {
            try {
                await Promise.all(deleted.map(async (tx) => {
                    await saveTransaction({ ...tx, deleted: false, deletedAt: undefined, deletedBy: undefined } as any);
                    // Re-deduct stock for any stock-sale transactions being restored
                    if ((tx as any).isStockIssue && Array.isArray((tx as any).items)) {
                        await redeductStockFromTransaction(tx, currentUser.id);
                    }
                }));
                showSuccess('All trashed transactions restored.');
                await loadData();
            } catch (error) {
                console.error('Restore all error:', error);
                showError('Failed to restore all transactions.');
            }
            closeConfirm();
        });
    };

    const handleDeleteAll = () => {
        const deleted = transactions.filter(t => (t as any).deleted);
        if (deleted.length === 0) return;
        openConfirm(`PERMANENTLY delete all ${deleted.length} trashed transactions? This cannot be undone!`, async () => {
            try {
                // Handle service agreement payments before deleting
                const serviceAgreementTxs = deleted.filter(tx => 
                    t.serviceAgreementId || t.expenseCategory === 'Service Agreement' || t.expenseCategory === ExpenseCategory.SERVICE_AGREEMENT
                );
                if (serviceAgreementTxs.length > 0) {
                    const agreements = await getServiceAgreements();
                    const updatedAgreements = new Map<string, any>();
                    
                    for (const tx of serviceAgreementTxs) {
                        let agreement = t.serviceAgreementId 
                            ? (updatedAgreements.get(t.serviceAgreementId) || agreements.find(a => a.id === t.serviceAgreementId))
                            : agreements.find(a => a.payments?.some((p: any) => p.date === t.date && p.amount === t.amount));
                        
                        if (agreement && agreement.payments && agreement.payments.length > 0) {
                            const paymentIndex = agreement.payments.findIndex(
                                (p: any) => p.date === t.date && p.amount === t.amount
                            );
                            if (paymentIndex !== -1) {
                                const updatedPayments = [...agreement.payments];
                                updatedPayments.splice(paymentIndex, 1);
                                updatedAgreements.set(agreement.id, { ...agreement, payments: updatedPayments });
                            }
                        }
                    }
                    
                    // Save all updated agreements
                    await Promise.all(
                        Array.from(updatedAgreements.values()).map(agr => 
                            saveServiceAgreement({ ...agr, updatedAt: Date.now() })
                        )
                    );
                }
                
                await Promise.all(deleted.map(tx => deleteTransaction(tx.id, { skipStockRestore: true })));
                showSuccess('All trashed transactions permanently deleted.');
                await loadData();
            } catch (error) {
                console.error('Delete all error:', error);
                showError('Failed to delete all trashed transactions.');
            }
            closeConfirm();
        }, { danger: true, title: 'Delete All Transactions' });
    };

    const clearFilters = () => {
        setFilterType('ALL');
        setFilterMethod('ALL');
        setFilterStatus('ALL');
        setFilterCategory('ALL');
        setFilterBuildingIds([]);
        setFilterUnit('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterTillDate('');
        setSearchTerm('');
        setSearchInput('');
        setFilterVat('ALL');
        setFilterCustomer('ALL');
        setFilterEmployee('ALL');
        setFilterOwner('ALL');
        // Clear persisted filter state
        const keys = ['hist_filterType','hist_filterMethod','hist_filterStatus','hist_filterCategory','hist_filterBuildingIds','hist_filterUnit','hist_filterDateFrom','hist_filterDateTo','hist_filterTillDate','hist_filterVat','hist_filterBankName','hist_filterCustomer','hist_filterEmployee','hist_filterOwner'];
        keys.forEach(k => sessionStorage.removeItem(k));
    };

    const handlePrintReceipt = (tx: Transaction) => {
        const printWindow = window.open('', 'PRINT', 'height=900,width=850');
        if (!printWindow) return;

        const receiptNo = `RV-${(tx.id || '').slice(-6).toUpperCase() || Date.now().toString().slice(-6)}`;
        const txDate = tx.date || new Date().toISOString().split('T')[0];

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Receipt Voucher - ${receiptNo}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
                :root {
                  --g900: #064e3b; --g800: #065f46; --g700: #047857; --g600: #059669;
                  --g500: #10b981; --g400: #34d399; --g200: #a7f3d0; --g100: #d1fae5; --g50: #ecfdf5;
                  --text-dark: #0f1a12; --text-mid: #334844; --text-light: #6b8078;
                  --bg: #f8fdf9; --border: #d5e8dd;
                }
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Inter','Tajawal',sans-serif; background:#fff; color:var(--text-dark); }
                .page { max-width:780px; margin:0 auto; }

                .outer-frame { border:2px solid var(--g800); padding:3px; margin:20px; }
                .inner-frame { border:1px solid var(--g400); position:relative; overflow:hidden; }

                .watermark-bg { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.035; width:360px; height:360px; object-fit:contain; z-index:0; pointer-events:none; }
                .content { position:relative; z-index:1; }

                /* Ornaments */
                .orn { position:absolute; width:26px; height:26px; border-color:var(--g400); border-style:solid; z-index:2; }
                .orn-tl { top:6px; left:6px; border-width:2px 0 0 2px; }
                .orn-tr { top:6px; right:6px; border-width:2px 2px 0 0; }
                .orn-bl { bottom:6px; left:6px; border-width:0 0 2px 2px; }
                .orn-br { bottom:6px; right:6px; border-width:0 2px 2px 0; }

                /* Header */
                .header { display:flex; align-items:center; justify-content:space-between; padding:24px 32px 20px; background:linear-gradient(135deg, var(--g900) 0%, var(--g700) 100%); position:relative; }
                .header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg, var(--g400), var(--g200), var(--g400)); }
                .header-left,.header-right { flex:1; color:white; }
                .header-left { text-align:right; direction:rtl; }
                .header-right { text-align:left; direction:ltr; }
                .header-center { flex:0 0 auto; padding:0 22px; }
                .logo-wrap { width:78px; height:78px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 18px rgba(0,0,0,.25); border:3px solid var(--g400); }
                .logo-wrap img { width:54px; height:54px; object-fit:contain; }
                .co-name-ar { font-family:'Tajawal',sans-serif; font-size:16px; font-weight:700; }
                .co-name-en { font-size:11px; opacity:.85; margin-top:1px; }
                .co-vat { font-size:9.5px; opacity:.65; margin-top:5px; letter-spacing:.5px; }

                /* Title */
                .title-ribbon { text-align:center; padding:13px 20px; background:var(--g50); border-bottom:1px solid var(--border); }
                .title-ribbon h1 { font-size:21px; font-weight:800; color:var(--g800); letter-spacing:2px; text-transform:uppercase; font-family:'Tajawal',sans-serif; }
                .title-ribbon h1 span { color:var(--g500); margin:0 8px; }

                /* Meta */
                .meta-bar { display:flex; justify-content:center; gap:40px; padding:12px 32px; background:white; border-bottom:1px solid var(--border); }
                .meta-item { text-align:center; }
                .meta-label { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); font-weight:600; margin-bottom:2px; }
                .meta-value { font-size:15px; font-weight:700; color:var(--g800); }

                .body { padding:22px 32px 18px; }

                /* Amount Card */
                .amount-card { background:linear-gradient(135deg, var(--g900) 0%, var(--g700) 100%); border-radius:12px; padding:22px 28px; margin-bottom:22px; display:flex; align-items:center; justify-content:space-between; position:relative; overflow:hidden; }
                .amount-card::before { content:''; position:absolute; top:-30px; right:-30px; width:120px; height:120px; background:rgba(52,211,153,.12); border-radius:50%; }
                .amount-card::after { content:''; position:absolute; bottom:-20px; left:-20px; width:80px; height:80px; background:rgba(52,211,153,.08); border-radius:50%; }
                .amount-label { font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:var(--g200); font-weight:600; position:relative; z-index:1; }
                .amount-label-ar { font-family:'Tajawal',sans-serif; font-size:13px; color:rgba(255,255,255,.8); margin-top:2px; position:relative; z-index:1; }
                .amount-value { font-size:30px; font-weight:800; color:white; letter-spacing:1px; position:relative; z-index:1; text-align:left; direction:ltr; }
                .amount-currency { font-size:13px; font-weight:500; color:var(--g200); margin-top:2px; position:relative; z-index:1; text-align:left; }

                /* Details */
                .details-table { width:100%; border-collapse:collapse; margin-bottom:5px; }
                .details-table tr { border-bottom:1px solid #e8f0eb; }
                .details-table tr:last-child { border-bottom:none; }
                .details-table tr:nth-child(even) { background:var(--g50); }
                .details-table td { padding:12px 16px; vertical-align:top; }
                .details-table .td-label { width:42%; font-weight:600; color:var(--text-mid); font-size:12px; direction:rtl; text-align:right; }
                .details-table .td-label .en { display:block; font-size:10px; color:var(--text-light); font-weight:400; margin-top:1px; }
                .details-table .td-value { font-weight:600; color:var(--text-dark); font-size:13px; text-align:left; direction:ltr; }

                /* VAT */
                .vat-section { background:var(--g50); border:1px solid var(--border); border-radius:8px; padding:14px 18px; margin:18px 0 5px; }
                .vat-title { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); font-weight:700; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border); }
                .vat-row { display:flex; justify-content:space-between; padding:5px 0; font-size:12px; }
                .vat-row .vr-label { color:var(--text-mid); }
                .vat-row .vr-val { font-weight:700; color:var(--text-dark); direction:ltr; }
                .vat-row.total { border-top:2px solid var(--g700); margin-top:6px; padding-top:8px; font-size:13px; }
                .vat-row.total .vr-label { font-weight:700; color:var(--g800); }
                .vat-row.total .vr-val { color:var(--g800); font-size:15px; }

                /* Signatures */
                .signatures { display:flex; justify-content:space-between; padding:32px 32px 10px; gap:30px; }
                .sig-block { flex:1; text-align:center; }
                .sig-line { border-bottom:2px solid var(--g800); margin-bottom:10px; height:48px; }
                .sig-title { font-size:11px; font-weight:700; color:var(--text-mid); text-transform:uppercase; letter-spacing:1px; }
                .sig-title-ar { font-family:'Tajawal',sans-serif; font-size:12px; color:var(--text-light); margin-top:2px; }

                /* Footer */
                .footer-bar { text-align:center; padding:14px 32px; background:var(--g50); border-top:1px solid var(--border); position:relative; }
                .footer-bar::before { content:''; position:absolute; top:0; left:32px; right:32px; height:1px; background:linear-gradient(90deg,transparent,var(--g400),transparent); }
                .footer-text { font-size:9px; color:var(--text-light); letter-spacing:.5px; line-height:1.8; }
                .footer-bottom { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:6px; }
                .amlak-badge { display:inline-flex; align-items:center; gap:5px; background:var(--g800); color:white; padding:3px 10px; border-radius:20px; font-size:7px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
                .amlak-badge img { width:14px; height:14px; object-fit:contain; border-radius:50%; }
                .footer-copy { font-size:8px; color:var(--text-light); letter-spacing:1px; }

                @media print {
                  body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                  .outer-frame { margin:0; }
                  @page { margin:0.8cm; size:A4 portrait; }
                }
              </style>
            </head>
            <body>
              <div class="page">
                <div class="outer-frame">
                  <div class="inner-frame">
                    <div class="orn orn-tl"></div><div class="orn orn-tr"></div>
                    <div class="orn orn-bl"></div><div class="orn orn-br"></div>
                    <img src="${window.location.origin}/images/logo.png" alt="" class="watermark-bg" />
                    <div class="content">
                      <div class="header">
                        <div class="header-right">
                          <div class="co-name-en" style="font-size:13px;font-weight:600">Arar Millennium</div>
                          <div class="co-name-en">Company Ltd</div>
                          <div class="co-vat">VAT: 312610089400003</div>
                        </div>
                        <div class="header-center">
                          <div class="logo-wrap"><img src="${window.location.origin}/images/cologo.png" alt="Logo" /></div>
                        </div>
                        <div class="header-left">
                          <div class="co-name-ar"> شركة أرار ميلينيوم المحدودة</div>
                          <div class="co-name-en" style="opacity:.7;font-size:10px">الدمام، المملكة العربية السعودية</div>
                          <div class="co-vat">الرقم الضريبي: 312610089400003</div>
                        </div>
                      </div>
                      <div class="title-ribbon"><h1>سند قبض <span>|</span> RECEIPT VOUCHER</h1></div>
                      <div class="meta-bar">
                        <div class="meta-item"><div class="meta-label">Voucher No. / رقم السند</div><div class="meta-value">${receiptNo}</div></div>
                        <div class="meta-item"><div class="meta-label">Date / التاريخ</div><div class="meta-value">${txDate}</div></div>
                      </div>
                      <div class="body">
                        <div class="amount-card">
                          <div>
                            <div class="amount-label">Amount Received</div>
                            <div class="amount-label-ar">المبلغ المستلم</div>
                          </div>
                          <div>
                            <div class="amount-value">${tx.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div class="amount-currency">SAR / ريال سعودي</div>
                          </div>
                        </div>
                        <table class="details-table">
                          <tr>
                            <td class="td-label">استلمنا من<span class="en">Received From</span></td>
                            <td class="td-value">${tx.buildingName ? `${tx.buildingName} - Unit ${tx.unitNumber || 'N/A'}` : 'Customer'}</td>
                          </tr>
                          <tr>
                            <td class="td-label">وذلك عن<span class="en">Payment For</span></td>
                            <td class="td-value">${tx.details || 'Rent Payment'}</td>
                          </tr>
                          ${tx.serviceAgreementStartDate && tx.serviceAgreementEndDate ? `
                          <tr>
                            <td class="td-label">فترة العقد<span class="en">Contract Period</span></td>
                            <td class="td-value">${tx.serviceAgreementStartDate} to ${tx.serviceAgreementEndDate}</td>
                          </tr>` : ''}
                          ${(tx as any).installmentStartDate && (tx as any).installmentEndDate ? `
                          <tr>
                            <td class="td-label">فترة القسط<span class="en">Installment #${(tx as any).installmentNumber || ''} Period</span></td>
                            <td class="td-value">${(tx as any).installmentStartDate} to ${(tx as any).installmentEndDate}</td>
                          </tr>` : ''}
                          <tr>
                            <td class="td-label"> -  -  -  -  -   -  -  -  -  - <span class="en">${t('entry.paymentMethod')}</span></td>
                            <td class="td-value">${fmtPaymentMethod(tx)}${tx.chequeNo ? `  -  Cheque #${tx.chequeNo}` : ''}</td>
                          </tr>
                          <tr>
                            <td class="td-label">الفئة<span class="en">${t('entry.categoryShort')}</span></td>
                            <td class="td-value">${tx.expenseCategory || 'Rent Income'}</td>
                          </tr>
                        </table>
                        ${tx.vatAmount ? `
                        <div class="vat-section">
                          <div class="vat-title">Tax Breakdown / تفاصيل الضريبة</div>
                          <div class="vat-row"><span class="vr-label">Amount Excl. VAT / المبلغ قبل الضريبة</span><span class="vr-val">${(tx.amountExcludingVAT || tx.amount).toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</span></div>
                          <div class="vat-row"><span class="vr-label">VAT 15% / ضريبة القيمة المضافة</span><span class="vr-val">${tx.vatAmount.toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</span></div>
                          <div class="vat-row total"><span class="vr-label">Total / الإجمالي</span><span class="vr-val">${(tx.amountIncludingVAT || tx.totalWithVat || tx.amount).toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</span></div>
                        </div>` : ''}
                      </div>
                      <div class="signatures">
                        <div class="sig-block"><div class="sig-line"></div><div class="sig-title">Accountant</div><div class="sig-title-ar">المحاسب</div></div>
                        <div class="sig-block"><div class="sig-line"></div><div class="sig-title">Receiver</div><div class="sig-title-ar">المستلم</div></div>
                        <div class="sig-block"><div class="sig-line"></div><div class="sig-title">Approved By</div><div class="sig-title-ar">المدير المعتمد</div></div>
                      </div>
                      <div class="footer-bar">
                        <div class="footer-text">This is a computer-generated document and is valid without signature &bull; هذا المستند صادر إلكترونيًا وصالح بدون توقيع</div>
                        <div class="footer-bottom">
                          <span class="footer-copy">Arar Millennium Company Ltd &copy; ${new Date().getFullYear()}</span>
                          <span class="amlak-badge"><img src="${window.location.origin}/images/logo.png" alt="" /> Powered by Amlak</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <script>window.onload=function(){setTimeout(function(){var imgs=document.images,c=0,t=imgs.length;if(!t){window.print();return}for(var i=0;i<t;i++){if(imgs[i].complete){if(++c>=t)window.print()}else{imgs[i].onload=imgs[i].onerror=function(){if(++c>=t)window.print()}}}},200);}</script>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    };

    const handleWhatsApp = async (tx: Transaction) => {
        let mobile = '';
        const contracts = await getContracts() || [];
        const customers = await getCustomers() || [];
        
        const contract = contracts.find(c => c.id === tx.contractId);
        if (contract) {
             const customer = customers.find(c => c.id === contract.customerId);
             if (customer) mobile = customer.mobileNo;
        }
        
        if (mobile) {
            mobile = mobile.replace(/\D/g, '');
            if (mobile.startsWith('05')) mobile = '966' + mobile.substring(1);
            else if (mobile.startsWith('5')) mobile = '966' + mobile;
            
            const message = `Dear Customer,%0A%0APayment Received: ${tx.amount.toLocaleString()} SAR%0AFor: ${tx.buildingName} - ${tx.unitNumber}%0ADate: ${fmtDate(tx.date)}%0A%0AThank you,%0AAmlak Management%0Apowered by RR GROUP`;
            window.open(`https://wa.me/${mobile}?text=${message}`, '_blank');
        } else {
            showError('No mobile number found linked to this transaction.');
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        // Treasury transfers create transaction records that should appear in history
        // Inject pseudo-transactions for existing Building→Owner transfers that lack a transaction record
        const existingTreasuryTxIds = new Set(transactions.filter(t => (t as any).transferId).map(tx => (t as any).transferId));

        // Building ↔ Owner: inject a pseudo tx if no transaction exists for this transfer.
        const buildingOwnerPseudo = (transfers || []).filter((tr: any) =>
            ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') || (tr.fromType === 'OWNER' && tr.toType === 'BUILDING'))
            && !tr.deleted && !existingTreasuryTxIds.has(tr.id)
        ).map((tr: any) => ({
            id: `pseudo_${tr.id}`,
            date: tr.date || '',
            type: tr.fromType === 'BUILDING' ? 'EXPENSE' : 'INCOME',
            amount: Number(tr.amount) || 0,
            paymentMethod: 'TREASURY',
            originalPaymentMethod: tr.paymentMethod,
            fromBankName: tr.fromBankName,
            toBankName: tr.toBankName,
            bankName: tr.fromBankName || tr.bankName,
            fromType: tr.fromType,
            toType: tr.toType,
            fromId: tr.fromId,
            toId: tr.toId,
            purpose: tr.purpose || tr.notes || 'Treasury Transfer',
            details: tr.notes || '',
            status: tr.status || 'APPROVED',
            transferId: tr.id,
            createdBy: tr.createdBy,
            createdAt: tr.createdAt,
            source: 'treasury',
            buildingId: tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : undefined),
            expenseCategory: '',
        } as any));

        // Inter-Building transfers: make sure BOTH sides (EXPENSE on sender, INCOME on
        // receiver) are present IN THE CURRENT BOOK. Cross-book transfers store each
        // leg in a different book entirely, so the receiving leg won't appear in the
        // current book's transactions list — and it SHOULDN'T, because the user is
        // looking at one book's ledger at a time.
        //
        // For same-book inter-building transfers (the common case), older records may
        // be missing one leg — so we synthesise any missing leg as a pseudo
        // transaction. We carefully parse composite `${bookId}:${rawId}` ids so a
        // cross-book transfer never injects a phantom leg into the wrong book.
        const interBuildingPseudo: any[] = [];
        const rawOf = (compositeId: string | undefined): string => {
            if (!compositeId) return '';
            const s = String(compositeId);
            return s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
        };
        const bookOf = (compositeId: string | undefined): string => {
            if (!compositeId) return '';
            const s = String(compositeId);
            return s.includes(':') ? s.slice(0, s.indexOf(':')) : '';
        };
        (transfers || []).forEach((tr: any) => {
            if (tr.deleted) return;
            if (!(tr.fromType === 'BUILDING' && tr.toType === 'BUILDING' && tr.fromId && tr.toId && tr.fromId !== tr.toId)) return;

            // Skip cross-book transfers — the other leg lives in a different book.
            const fromBookIsExternal = !!bookOf(tr.fromId);
            const toBookIsExternal = !!bookOf(tr.toId);
            // A transfer is cross-book if BOTH sides reference different books
            // (either through composite ids or through explicit routing metadata).
            const isCrossBook = (tr.sourceBookId && tr.destBookId && tr.sourceBookId !== tr.destBookId)
                || (fromBookIsExternal && toBookIsExternal && bookOf(tr.fromId) !== bookOf(tr.toId));
            if (isCrossBook) return;

            const fromRaw = rawOf(tr.fromId);
            const toRaw = rawOf(tr.toId);

            const linked = transactions.filter(tx => (tx as any).transferId === tr.id && (tx as any).buildingId);
            const hasSource = linked.some(tx => normalize((tx as any).buildingId) === normalize(fromRaw));
            const hasDest   = linked.some(tx => normalize((tx as any).buildingId) === normalize(toRaw));

            const commonPseudo = {
                date: tr.date || '',
                amount: Number(tr.amount) || 0,
                paymentMethod: 'TREASURY',
                originalPaymentMethod: tr.paymentMethod,
                fromBankName: tr.fromBankName,
                toBankName: tr.toBankName,
                bankName: tr.fromBankName || tr.bankName,
                fromType: tr.fromType,
                toType: tr.toType,
                fromId: tr.fromId,
                toId: tr.toId,
                purpose: tr.purpose || tr.notes || 'Inter-Building Transfer',
                details: tr.notes || '',
                status: tr.status || 'APPROVED',
                transferId: tr.id,
                createdBy: tr.createdBy,
                createdAt: tr.createdAt,
                source: 'treasury',
                expenseCategory: '',
            };

            if (!hasSource) {
                interBuildingPseudo.push({
                    ...commonPseudo,
                    id: `pseudo_${tr.id}_src`,
                    type: 'EXPENSE',
                    buildingId: fromRaw,
                    interBuildingRole: 'SOURCE',
                });
            }
            if (!hasDest) {
                interBuildingPseudo.push({
                    ...commonPseudo,
                    id: `pseudo_${tr.id}_dst`,
                    type: 'INCOME',
                    buildingId: toRaw,
                    interBuildingRole: 'DEST',
                });
            }
        });

        let result = [...transactions, ...buildingOwnerPseudo, ...interBuildingPseudo];
        // Exclude opening balance if any filter is applied (other than default)
        const isDefaultFilter =
            filterType === 'ALL' &&
            filterMethod === 'ALL' &&
            filterStatus === 'ALL' &&
            filterCategory === 'ALL' &&
            filterBuildingIds.length === 0 &&
            filterBankName === 'ALL' &&
            filterCustomer === 'ALL' &&
            filterEmployee === 'ALL' &&
            filterOwner === 'ALL' &&
            !filterUnit &&
            !filterDateFrom &&
            !filterDateTo &&
            !filterTillDate &&
            !searchTerm &&
            filterVat === 'ALL';
        if (!isDefaultFilter) {
            result = result.filter(t => (t.expenseCategory || '').trim() !== 'Opening Balance');
        }

        // Staff filter (createdBy)
        if (filterEmployee && filterEmployee !== 'ALL') {
            result = result.filter(t => t.createdBy === filterEmployee);
        }
        // Owner filter (ownerId)
        if (filterOwner && filterOwner !== 'ALL') {
            result = result.filter(t => t.ownerId === filterOwner);
        }
        // Customer filter (customerId)
        if (filterCustomer && filterCustomer !== 'ALL') {
            result = result.filter(t => (t as any).customerId === filterCustomer);
        }
        
        // All staff can view owner expenses
        // Filter borrowing opening balances: Admin/Manager see all, Staff see only their building's
        result = result.filter(t => {
            const isBorrowingOpeningBal = t.borrowingType === 'OPENING_BALANCE' || (t as any).isOwnerOpeningBalance;
            if (!isBorrowingOpeningBal) return true; // Not a borrowing opening balance, show it
            
            // Owner opening balances are always hidden from regular views
            if ((t as any).isOwnerOpeningBalance) return false;
            
            // Admin/Manager can see all borrowing opening balances
            if (isAdminOrManager) return true;
            
            // Staff can only see borrowing opening balances from their assigned building(s)
            if (userBuildingIds.length === 0) return false; // No building assigned, can't see any
            return t.buildingId && userBuildingIds.includes(t.buildingId);
        });

        // Filter by deleted status first
        result = result.filter(t => showDeleted ? (t as any).deleted === true : !(t as any).deleted);

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(t => JSON.stringify(t).toLowerCase().includes(lower));
        }

        // Specific Filters
        // Exclude reversal artifacts; keep treasury transfers and owner expense transactions
        result = result.filter(t => t.paymentMethod !== 'TREASURY_REVERSAL');
        // Hide Head→Owner treasury transactions (not relevant to building history)
        result = result.filter(t => {
            if ((t as any).source !== 'treasury') return true;
            const ft = (t as any).fromType, tt = (t as any).toType;
            return !((ft === 'OWNER' && tt === 'HEAD_OFFICE') || (ft === 'HEAD_OFFICE' && tt === 'OWNER'));
        });
        if (filterType !== 'ALL') result = result.filter(t => t.type === filterType);
        if (filterMethod !== 'ALL') result = result.filter(t => {
            // Treasury-linked rows use originalPaymentMethod for the user-facing method
            const eff = String(((t as any).originalPaymentMethod || t.paymentMethod) || '').toUpperCase();
            return eff === String(filterMethod).toUpperCase();
        });
        if (filterStatus !== 'ALL') result = result.filter(t => t.status === filterStatus);
        
        if (filterDateFrom) result = result.filter(t => t.date >= filterDateFrom);
        if (filterDateTo) result = result.filter(t => t.date <= filterDateTo);
        // "All till date" filter — show everything up to and including selected date
        if (filterTillDate) result = result.filter(t => t.date <= filterTillDate);
        
        if (filterCategory !== 'ALL') {
            const selected = filterCategory.trim().toLowerCase();
            result = result.filter(t => getTransactionCategory(t).trim().toLowerCase() === selected);
        }
        if (filterBuildingIds.length > 0) result = result.filter(t => filterBuildingIds.some(id => matchTransactionBuilding(t, id)));
        if (filterUnit) result = result.filter(t => t.unitNumber?.toLowerCase().includes(filterUnit.toLowerCase()));

        // VAT filter
        if (filterVat === 'WITH') result = result.filter(t => (t.vatAmount || 0) > 0);
        if (filterVat === 'WITHOUT') result = result.filter(t => !(t.vatAmount && t.vatAmount > 0));
        // Bank name filter
        if (filterBankName && filterBankName !== 'ALL') result = result.filter(t => (t.bankName || '').toLowerCase().includes(filterBankName.toLowerCase()));

        // Filter out any undefined/null rows before sorting
        result = result.filter(r => r && typeof r === 'object' && 'date' in r);
        // sort by transaction date (latest date first), then by createdAt
        try {
            result = result.slice().sort((a: Transaction, b: Transaction) => {
                const da = (a && a.date) ? a.date : '';
                const db = (b && b.date) ? b.date : '';
                const dateCmp = db.localeCompare(da);
                if (dateCmp !== 0) return dateCmp;
                return ((b && b.createdAt) || 0) - ((a && a.createdAt) || 0);
            });
        } catch (e) {
            // ignore sorting errors
        }

        return result;
    }, [transactions, searchTerm, filterType, filterMethod, filterStatus, filterCategory, filterBuildingIds, filterUnit, filterDateFrom, filterDateTo, filterTillDate, filterVat, filterBankName, filterCustomer, filterEmployee, filterOwner, currentUser, showDeleted, transfers, buildings]);

    // Opening balances should appear in the transaction list as synthetic rows
    const openingRows = useMemo(() => {
        if (showDeleted) return [] as Transaction[];
        if (filterStatus !== 'ALL' && filterStatus !== TransactionStatus.APPROVED) return [] as Transaction[];
        if (filterType !== 'ALL' && filterType !== TransactionType.INCOME) return [] as Transaction[];
        if (filterUnit || filterCustomer !== 'ALL') return [] as Transaction[];
        if (filterVat === 'WITH') return [] as Transaction[];
        if (filterCategory !== 'ALL' && filterCategory !== 'Opening Balance') return [] as Transaction[];

        const rows: Transaction[] = [];
        const searchLower = (searchTerm || '').toLowerCase();
        const includeText = (text: string) => !searchLower || text.toLowerCase().includes(searchLower);
        const defaultDate = filterDateTo || filterDateFrom || new Date().toISOString().slice(0, 10);

        Object.entries(openingBalancesByBuilding || {}).forEach(([buildingId, row]) => {
            if (filterBuildingIds.length > 0 && !filterBuildingIds.includes(buildingId)) return;
            const openingRow = row as { cash?: number; bank?: number; date?: string };
            const rowDate = openingRow?.date || defaultDate;
            if (filterDateFrom && rowDate < filterDateFrom) return;
            if (filterDateTo && rowDate > filterDateTo) return;
            const buildingName = getBuildingName(buildingId) || '-';

            const pushOpening = (method: PaymentMethod, amount: number) => {
                if (!(Number(amount) > 0)) return;
                if (filterMethod !== 'ALL' && filterMethod !== method) return;
                if (method === PaymentMethod.BANK && filterBankName !== 'ALL' && !'Opening Balance'.toLowerCase().includes((filterBankName || '').toLowerCase())) return;
                const details = `Opening Balance - ${method} - ${buildingName}`;
                if (!includeText(details) && !includeText(buildingName) && !includeText('opening balance')) return;
                rows.push({
                    id: `opening-${buildingId}-${method.toLowerCase()}`,
                    date: rowDate,
                    type: TransactionType.INCOME,
                    amount: Number(amount) || 0,
                    paymentMethod: method,
                    bankName: method === PaymentMethod.BANK ? 'Opening Balance' : undefined,
                    buildingId,
                    buildingName,
                    expenseCategory: 'Opening Balance',
                    details,
                    createdAt: 0,
                    createdBy: 'SYSTEM',
                    createdByName: 'SYSTEM',
                    status: TransactionStatus.APPROVED,
                } as Transaction & { isOpeningBalance?: boolean });
                (rows[rows.length - 1] as any).isOpeningBalance = true;
            };

            if (typeof openingRow.cash === 'number') pushOpening(PaymentMethod.CASH, openingRow.cash);
            if (typeof openingRow.bank === 'number') pushOpening(PaymentMethod.BANK, openingRow.bank);
        });

        return rows;
    }, [showDeleted, filterStatus, filterType, filterUnit, filterCustomer, filterVat, filterCategory, searchTerm, filterDateFrom, filterDateTo, filterTillDate, filterBuildingIds, filterMethod, filterBankName, openingBalancesByBuilding, buildings]);

    const listData = useMemo(() => {
        // Only include openingRows if no filters are applied (default view)
        const isDefaultFilter =
            filterType === 'ALL' &&
            filterMethod === 'ALL' &&
            filterStatus === 'ALL' &&
            filterCategory === 'ALL' &&
            filterBuildingIds.length === 0 &&
            filterBankName === 'ALL' &&
            filterCustomer === 'ALL' &&
            filterEmployee === 'ALL' &&
            filterOwner === 'ALL' &&
            !filterUnit &&
            !filterDateFrom &&
            !filterDateTo &&
            !filterTillDate &&
            !searchTerm &&
            filterVat === 'ALL';
        const merged = isDefaultFilter ? [...filteredData, ...openingRows] : [...filteredData];
        // Filter out any undefined/null rows before sorting
        const safeMerged = merged.filter(r => r && typeof r === 'object' && 'date' in r);
        return safeMerged.slice().sort((a: Transaction, b: Transaction) => {
            const da = (a && a.date) ? a.date : '';
            const db = (b && b.date) ? b.date : '';
            const dateCmp = db.localeCompare(da);
            if (dateCmp !== 0) return dateCmp;
            return ((b && b.createdAt) || 0) - ((a && a.createdAt) || 0);
        });
    }, [filteredData, openingRows, filterType, filterMethod, filterStatus, filterCategory, filterBuildingIds, filterBankName, filterCustomer, filterEmployee, filterOwner, filterUnit, filterDateFrom, filterDateTo, filterTillDate, searchTerm, filterVat]);

    // Pagination — render only a slice of the list for performance
    const PAGE_SIZE = 50;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [listData]);
    const visibleData = useMemo(() => listData.slice(0, visibleCount), [listData, visibleCount]);
    const hasMore = visibleCount < listData.length;

    const summary = useMemo(() => {
        const normalizeType = (type: any) => String(type || '').toUpperCase();
        const sumAmount = (rows: Transaction[]) => rows.reduce((s, r) => s + (Number(r.amountIncludingVAT || (r as any).totalWithVat || r.amount) || 0), 0);

        // Include configured opening balances from Settings (these are always part of the historical balance)
        // They are also displayed as synthetic rows in the list but not stored as transactions
        let settingsOpeningCash = 0, settingsOpeningBank = 0;
        Object.entries(openingBalancesByBuilding || {}).forEach(([buildingId, row]) => {
            if (filterBuildingIds.length > 0 && !filterBuildingIds.includes(buildingId)) return;
            settingsOpeningCash += Number((row as any).cash) || 0;
            settingsOpeningBank += Number((row as any).bank) || 0;
        });
        const settingsOpeningAll = settingsOpeningCash + settingsOpeningBank;

        // Whether the user has explicitly set a date range
        const hasDateFilter = !!(filterDateFrom || filterDateTo || filterTillDate);
        const effectiveDateFrom = filterDateFrom || '';
        const effectiveDateTo = filterTillDate || filterDateTo || '9999-12-31';

        // Inject pseudo-transactions for existing Building→Owner transfers that lack a transaction record
        const existingTreasuryIds = new Set(transactions.filter(t => (t as any).transferId).map(tx => (t as any).transferId));
        const buildingOwnerPseudoBal = (transfers || []).filter((tr: any) =>
            ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') || (tr.fromType === 'OWNER' && tr.toType === 'BUILDING'))
            && !tr.deleted && !existingTreasuryIds.has(tr.id)
        ).map((tr: any) => ({
            id: `pseudo_${tr.id}`,
            date: tr.date || '',
            type: tr.fromType === 'BUILDING' ? 'EXPENSE' : 'INCOME',
            amount: Number(tr.amount) || 0,
            paymentMethod: 'TREASURY',
            originalPaymentMethod: tr.paymentMethod,
            fromType: tr.fromType,
            toType: tr.toType,
            fromId: tr.fromId,
            toId: tr.toId,
            source: 'treasury',
            buildingId: tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : undefined),
            status: tr.status || 'APPROVED',
            expenseCategory: '',
            borrowingType: undefined,
            transferId: tr.id,
        } as any));

        // Inter-Building pseudo legs — fill missing source/dest transactions for older
        // SAME-BOOK transfers. Cross-book transfers are skipped (the other leg lives in
        // a different book entirely and should not appear in the current book's view).
        const interBuildingPseudoBal: any[] = [];
        const rawOfBal = (v?: string) => (v && String(v).includes(':')) ? String(v).slice(String(v).indexOf(':') + 1) : (v || '');
        const bookOfBal = (v?: string) => (v && String(v).includes(':')) ? String(v).slice(0, String(v).indexOf(':')) : '';
        (transfers || []).forEach((tr: any) => {
            if (tr.deleted) return;
            if (!(tr.fromType === 'BUILDING' && tr.toType === 'BUILDING' && tr.fromId && tr.toId && tr.fromId !== tr.toId)) return;
            const isCrossBook = (tr.sourceBookId && tr.destBookId && tr.sourceBookId !== tr.destBookId)
                || (!!bookOfBal(tr.fromId) && !!bookOfBal(tr.toId) && bookOfBal(tr.fromId) !== bookOfBal(tr.toId));
            if (isCrossBook) return;
            const fromRaw = rawOfBal(tr.fromId);
            const toRaw = rawOfBal(tr.toId);
            const linked = transactions.filter(tx => (tx as any).transferId === tr.id && (tx as any).buildingId);
            const hasSource = linked.some(tx => normalize((tx as any).buildingId) === normalize(fromRaw));
            const hasDest   = linked.some(tx => normalize((tx as any).buildingId) === normalize(toRaw));
            const base = {
                date: tr.date || '',
                amount: Number(tr.amount) || 0,
                paymentMethod: 'TREASURY',
                originalPaymentMethod: tr.paymentMethod,
                fromType: tr.fromType,
                toType: tr.toType,
                fromId: tr.fromId,
                toId: tr.toId,
                source: 'treasury',
                status: tr.status || 'APPROVED',
                expenseCategory: '',
                borrowingType: undefined,
                transferId: tr.id,
            };
            if (!hasSource) interBuildingPseudoBal.push({ ...base, id: `pseudo_${tr.id}_src`, type: 'EXPENSE', buildingId: fromRaw, interBuildingRole: 'SOURCE' });
            if (!hasDest)   interBuildingPseudoBal.push({ ...base, id: `pseudo_${tr.id}_dst`, type: 'INCOME',  buildingId: toRaw,   interBuildingRole: 'DEST' });
        });

        const allTxns = [...transactions, ...buildingOwnerPseudoBal, ...interBuildingPseudoBal];

        // Base approved transactions (not deleted) - use transactions directly, not filteredData
        // Include transactions without status (legacy data) as approved
        // Treasury transfers (source=treasury) ARE included in balance totals; TREASURY_REVERSAL artifacts are not.
        // Owner Expense transactions are excluded from balance totals (separate owner view).
        const approved = allTxns.filter(t => {
            if ((t as any).deleted) return false;
            if (t.paymentMethod === 'TREASURY_REVERSAL') return false;
            // Exclude Head→Owner treasury transactions from balance totals
            if ((t as any).source === 'treasury') {
                const ft = (t as any).fromType, tt = (t as any).toType;
                if ((ft === 'OWNER' && tt === 'HEAD_OFFICE') || (ft === 'HEAD_OFFICE' && tt === 'OWNER')) return false;
            }
            const status = String(t.status || TransactionStatus.APPROVED).toUpperCase();
            return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !t.status;
        });

        // Apply building filter if set
        // Owner expenses: only include for their specific source building
        const buildingFiltered = filterBuildingIds.length > 0 
            ? approved.filter(t => {
                const ownerCat = (t.expenseCategory || '').trim();
                if (ownerCat === 'Owner Expense' || ownerCat === 'Owner Profit Withdrawal') {
                  const bId = String((t as any).buildingId || '');
                  return !!bId && filterBuildingIds.includes(bId);
                }
                return filterBuildingIds.some(id => matchTransactionBuilding(t, id));
              })
            : approved;

        // Opening balance is always through the last day of the previous month
        const _now = new Date();
        const _currentMonthStart = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`;
        const openingCutoff = hasDateFilter
            ? effectiveDateFrom.substring(0, 8) + '01'
            : _currentMonthStart;

        // Period transactions: filtered range when date filter is set, current month when not
        const periodTxns = hasDateFilter
            ? buildingFiltered.filter(t => t.date && t.date >= effectiveDateFrom && t.date <= effectiveDateTo)
            : buildingFiltered.filter(t => t.date && t.date >= _currentMonthStart);

        // Exclude ALL borrowing opening balances from totals (tracked separately in BorrowingTracker/OwnerPortal)
        // Also exclude Owner Opening Balance (tracked separately)
        const isOpeningBalance = (r: Transaction) => 
            r.borrowingType === 'OPENING_BALANCE' || 
            (r as any).isOwnerOpeningBalance === true ||
            r.expenseCategory === 'Owner Opening Balance';
        const incomeRows = periodTxns.filter(r => normalizeType(r.type) === TransactionType.INCOME && !isOpeningBalance(r));
        // Include ALL expenses (regular + owner) for accurate totals
        const expenseRows = periodTxns.filter(r => normalizeType(r.type) === TransactionType.EXPENSE && !isOpeningBalance(r));

        // ownerExpenseTotal kept as 0 (owner expenses now merged into main expenseTotal)
        const ownerExpenseTotal = 0;

        // Payment method breakdown (for display only — CASH/TREASURY = cash, BANK/CHEQUE = bank)
        // Effective method = user-chosen method, falling back to stored paymentMethod.
        // For treasury transfers we stamp paymentMethod='TREASURY' internally but keep the
        // user's real choice (CASH/BANK/CHEQUE) in originalPaymentMethod — so a BANK→BANK
        // treasury transfer is classified under Bank, not Cash.
        const effMethod = (r: any) => String((r as any).originalPaymentMethod || r.paymentMethod || '').toUpperCase();
        const cashIncomeBase = sumAmount(incomeRows.filter(r => { const m = effMethod(r); return m === 'CASH' || m === 'TREASURY'; }));
        const bankIncomeBase = sumAmount(incomeRows.filter(r => { const m = effMethod(r); return m === 'BANK' || m === 'CHEQUE'; }));
        // Totals include ALL rows regardless of payment method (avoids missing transactions with unknown/null payment method)
        const incomeTotalBase = sumAmount(incomeRows);

        const cashExpense = sumAmount(expenseRows.filter(r => { const m = effMethod(r); return m === 'CASH' || m === 'TREASURY'; }));
        const bankExpenseTotal = sumAmount(expenseRows.filter(r => { const m = effMethod(r); return m === 'BANK' || m === 'CHEQUE'; }));
        const expenseTotal = sumAmount(expenseRows); // ALL expenses, not just cash+bank subset

        // Cheque sub-totals (for separate display if needed)
        const chequeIncome = sumAmount(incomeRows.filter(r => effMethod(r) === 'CHEQUE'));
        const chequeExpense = sumAmount(expenseRows.filter(r => effMethod(r) === 'CHEQUE'));

        // Opening balance from transactions BEFORE the opening cutoff (last day of previous month)
        let openingCash = 0, openingBank = 0, openingAll = 0;
        
        const priorTxns = buildingFiltered.filter(t => t.date && t.date < openingCutoff);
        
        for (const t of priorTxns) {
            // Skip borrowing opening balance entries (tracked separately in BorrowingTracker/OwnerPortal)
            if (isOpeningBalance(t)) continue;
            // Include owner expenses in opening balance (they represent real cash outflows)
            const amt = Number(t.amount) || 0;
            const isIncome = normalizeType(t.type) === TransactionType.INCOME;
            const effM = String((t as any).originalPaymentMethod || t.paymentMethod || '').toUpperCase();
            const isCash = effM === 'CASH' || effM === 'TREASURY';
            const isBank = effM === 'BANK' || effM === 'CHEQUE';
            const netAmt = isIncome ? amt : -amt;
            openingAll += netAmt;
            if (isCash) openingCash += netAmt;
            else if (isBank) openingBank += netAmt;
        }

        // Closing balances (payment method breakdown)
        const cashBalance = openingCash + settingsOpeningCash + cashIncomeBase - cashExpense;
        const bankBalance = openingBank + settingsOpeningBank + bankIncomeBase - bankExpenseTotal;
        // True net: include ALL transactions + settings opening balance regardless of payment method
        const totalNet = openingAll + settingsOpeningAll + incomeTotalBase - expenseTotal;

        return {
            openingCash: openingCash + settingsOpeningCash,
            openingBank: openingBank + settingsOpeningBank,
            openingTotal: openingAll + settingsOpeningAll,
            cashIncome: cashIncomeBase,
            bankIncome: bankIncomeBase,
            incomeTotal: incomeTotalBase,
            cashExpense,
            bankExpense: bankExpenseTotal,
            expenseTotal,
            cashBalance,
            bankBalance,
            totalNet,
            chequeIncome,
            chequeExpense,
            chequeBalance: chequeIncome - chequeExpense,
            ownerExpenseTotal,
            totalOutputVAT: incomeRows.filter(r => !(r as any).isCreditNote).reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0) - incomeRows.filter(r => (r as any).isCreditNote).reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0),
            totalInputVAT: expenseRows.reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0),
            netVATPayable: (incomeRows.filter(r => !(r as any).isCreditNote).reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0) - incomeRows.filter(r => (r as any).isCreditNote).reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0)) - expenseRows.reduce((s,r) => s + Math.abs(Number(r.vatAmount)||0), 0),
        };
    }, [transactions, filterBuildingIds, filterDateFrom, filterDateTo, filterTillDate, matchTransactionBuilding, transfers, openingBalancesByBuilding]);

    // CSV Export
    const handleExportCSV = () => {
        const headers = ["Date", "Type", "Income", "Expense", "Category", "Building", "Unit", "Details", "Status", "By"];
        const rows = listData.map(tx => {
            // Attempt to present friendly customer/building for stock sales
            let details = String(tx.details ?? '');
            if (details.toLowerCase().includes('stock sale')) {
                const custId = extractCustomerIdFromDetails(details) || (tx as any).customerId || (tx as any).customer;
                const custName = custId ? getCustomerName(custId) : '';
                const bName = getBuildingName(tx.buildingId || (tx as any).building) || tx.buildingName || '';
                details = `Sale to ${custName || custId || '-'}${bName ? '  -  ' + bName : ''}`;
            }
            const income = tx.type === TransactionType.INCOME ? tx.amount : '';
            const expense = tx.type === TransactionType.EXPENSE ? tx.amount : '';
            return [tx.date, tx.type, income, expense, tx.expenseCategory || 'Rent', getBuildingName(tx.buildingId || (tx as any).building) || tx.buildingName || '-', tx.unitNumber || '-', details, tx.status || 'APPROVED', tx.createdByName];
        });
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "transactions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

        // PDF Export (preview window). Opens a styled preview with filters summary and table; user can Save as PDF via browser print.
        const handleExportPDF = () => {
                        // Determine report type
                        const isIncomeReport = filterType === 'INCOME';
                        const isExpenseReport = filterType === 'EXPENSE';
            // Initialize summary values before usage
            const incomeTotal = summary.incomeTotal;
            const expenseTotal = summary.expenseTotal;
            const cashIncome = summary.cashIncome;
            const bankIncome = summary.bankIncome;
            const chequeIncome = summary.chequeIncome;
            const cashExpense = summary.cashExpense;
            const bankExpense = summary.bankExpense;
            const chequeExpense = summary.chequeExpense;
            const cashBalance = summary.cashBalance;
            const bankBalance = summary.bankBalance;
            const chequeBalance = summary.chequeBalance;
            // Treasury is already included in cash totals (consistent calculation)
            const totalNetBalance = cashBalance + bankBalance;

            // PDF Export (preview window). Opens a styled preview with filters summary and table; user can Save as PDF via browser print.
            // ...existing code...
                const title = 'Transactions Report';
                                const filters: string[] = [];
                                if (filterDateFrom) filters.push(`From: ${filterDateFrom}`);
                                if (filterDateTo) filters.push(`To: ${filterDateTo}`);
                                if (filterTillDate) filters.push(`All till: ${filterTillDate}`);
                                if (filterType !== 'ALL') filters.push(`Type: ${filterType}`);
                                if (filterCategory !== 'ALL') filters.push(`Category: ${filterCategory}`);
                                if (filterBuildingIds && filterBuildingIds.length > 0) {
                                    const names = filterBuildingIds.map(id => getBuildingName(id)).filter(Boolean).join(', ');
                                    if (names) filters.push(`Building: ${names}`);
                                }
                                if (filterUnit) filters.push(`Unit: ${filterUnit}`);
                                if (filterMethod !== 'ALL') filters.push(`Payment: ${filterMethod}`);
                                if (filterBankName !== 'ALL') filters.push(`Bank: ${filterBankName}`);
                                if (filterStatus !== 'ALL') filters.push(`Status: ${filterStatus}`);
                                if (filterVat !== 'ALL') filters.push(`VAT: ${filterVat}`);
                                if (searchTerm) filters.push(`Search: ${searchTerm}`);

                        const rowsHtml = listData
                            .map(r => {
                                const raw = String(r.details ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                const bName = getBuildingName(r.buildingId || (r as any).building) || r.buildingName || '';
                                let details = raw ? `${raw}${bName ? '  -  ' + bName : ''}` : (bName || '-');
                                if ((r as any).source === 'treasury') {
                                    details = getTreasuryLabel(r);
                                }
                                const income = r.type === 'INCOME' ? Number(r.amount) : 0;
                                const expense = r.type === 'EXPENSE' ? Number(r.amount) : 0;
                                return `<tr>
                                    <td>${fmtDate(r.date)}</td>
                                    <td><span class="type-badge ${r.type === 'INCOME' ? 'income' : 'expense'}">${r.type}</span></td>
                                    <td>${details}</td>
                                    <td>${fmtPaymentMethod(r)}</td>
                                    <td style="text-align:right">${income ? income.toLocaleString() + ' SAR' : '-'}</td>
                                    <td style="text-align:right">${expense ? expense.toLocaleString() + ' SAR' : '-'}</td>
                                </tr>`;
                            }).join('\n');

                    // ...existing code...
                    // ...existing code...
                    // ...existing code...

                                const html = `
                                        <html>
                                            <head>
                                                <title>${title}</title>
                                                <meta name="viewport" content="width=device-width,initial-scale=1" />
                                                <style>
                                                    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap');
                                                    :root {
                                                      --g900:#064e3b; --g800:#065f46; --g700:#047857; --g600:#059669;
                                                      --g500:#10b981; --g400:#34d399; --g200:#a7f3d0; --g100:#d1fae5; --g50:#ecfdf5;
                                                      --text-dark:#0f1a12; --text-mid:#334844; --text-light:#6b8078;
                                                      --bg:#f8fdf9; --border:#d5e8dd;
                                                      --income:#059669; --expense:#dc2626;
                                                    }
                                                    html,body { margin:0; padding:0; }
                                                    body { font-family:'Inter','Tajawal',sans-serif; color:var(--text-dark); background:#fff; }
                                                    .page { max-width:900px; margin:40px auto; padding:32px 36px; background:#fff; border-radius:18px; box-shadow:0 4px 24px rgba(0,0,0,0.07); }

                                                    .watermark { position:fixed; left:50%; top:45%; transform:translate(-50%,-50%); opacity:0.035; width:380px; pointer-events:none; z-index:0; }

                                                    /* Header */
                                                    .report-header { display:flex; align-items:center; justify-content:space-between; padding:22px 28px; background:linear-gradient(135deg,var(--g900) 0%,var(--g700) 100%); border-radius:12px 12px 0 0; position:relative; }
                                                    .report-header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--g400),var(--g200),var(--g400)); }
                                                    .rh-left { display:flex; align-items:center; gap:14px; }
                                                    .rh-logo { width:48px; height:48px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--g400); }
                                                    .rh-logo img { width:32px; height:32px; object-fit:contain; }
                                                    .rh-title { color:white; font-size:18px; font-weight:800; letter-spacing:.5px; }
                                                    .rh-sub { color:var(--g200); font-size:11px; margin-top:2px; }
                                                    .rh-right { color:white; text-align:right; font-size:11px; opacity:.85; line-height:1.6; }

                                                    .filter-bar { padding:10px 28px; background:var(--g50); border-bottom:1px solid var(--border); font-size:11px; color:var(--text-mid); }

                                                    /* Table */
                                                    table { width:100%; border-collapse:collapse; position:relative; z-index:1; }
                                                    thead th { background:var(--g800); color:white; text-align:left; padding:11px 12px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
                                                    tbody td { padding:9px 12px; font-size:12px; color:var(--text-dark); border-bottom:1px solid #e8f0eb; }
                                                    tbody tr:nth-child(even) td { background:var(--g50); }
                                                    .type-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:9px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; }
                                                    .type-badge.income { background:var(--g100); color:var(--g800); }
                                                    .type-badge.expense { background:#fee2e2; color:#991b1b; }

                                                    /* Summary cards */
                                                    .summary-grid-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:18px; }
                                                    .summary-grid-3 .card { padding:14px; border-radius:10px; border:1px solid var(--border); background:var(--g50); }
                                                    .summary-grid-3 .card .label { font-size:10px; color:var(--text-light); font-weight:700; text-transform:uppercase; letter-spacing:1.1px; margin-bottom:6px; }
                                                    .summary-grid-3 .card .amount { font-size:22px; font-weight:800; }
                                                    .summary-grid-3 .income-card { border-left:4px solid var(--income); }
                                                    .summary-grid-3 .expense-card { border-left:4px solid var(--expense); }
                                                    .summary-grid-3 .net-card { border-left:4px solid #64748b; }

                                                    .summary-grid-6 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:12px; }
                                                    .summary-grid-6 .line-card { padding:12px; border-radius:10px; border:1px solid var(--border); background:#fff; }
                                                    .summary-grid-6 .line-card .label { font-size:10px; color:var(--text-light); font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
                                                    .summary-grid-6 .line-card .value { font-size:16px; font-weight:800; color:var(--text-dark); }

                                                    @media (max-width: 900px) {
                                                      table { font-size: 11px; }
                                                    }

                                                    .meta-footer { margin-top:18px; font-size:9px; color:var(--text-light); display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-top:1px solid var(--border); }
                                                    .amlak-badge { display:inline-flex; align-items:center; gap:5px; background:var(--g800); color:white; padding:3px 10px; border-radius:20px; font-size:7px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
                                                    .amlak-badge img { width:14px; height:14px; object-fit:contain; border-radius:50%; }
                                                    .footer-copy { font-size:8px; color:var(--text-light); letter-spacing:1px; }

                                                    /* Optimize for ultra-narrow screens (395px) */
                                                    @media (max-width: 420px) {
                                                      .page { padding: 16px !important; margin: 20px auto !important; }
                                                      .report-header { padding: 14px 16px !important; }
                                                      table { font-size: 9px !important; }
                                                      thead th { padding: 6px 4px !important; font-size: 7px !important; }
                                                      tbody td { padding: 5px 4px !important; font-size: 8px !important; }
                                                      .summary-grid-3, .summary-grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
                                                      .summary-grid-3 .card, .summary-grid-6 .line-card { padding: 8px !important; }
                                                    }

                                                    @media print {
                                                        body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                                                        .no-print { display:none; }
                                                        .page { page-break-inside:auto; }
                                                        .summary-grid-6 { page-break-inside:avoid; margin-bottom:8px; }
                                                        table { page-break-inside:auto; }
                                                        thead { display:table-header-group; }
                                                        tbody tr { page-break-inside:avoid; }
                                                        @page { size:A4; margin:10mm; }
                                                    }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="page">
                                                    <img src="${window.location.origin}/images/logo.png" class="watermark" />

                                                    <div class="report-header">
                                                        <div class="rh-left">
                                                            <div class="rh-logo"><img src="${window.location.origin}/images/cologo.png" alt="Logo" /></div>
                                                            <div>
                                                                <div class="rh-title">Transactions Report</div>
                                                                <div class="rh-sub">Arar Millennium Company Ltd &bull;  -  -  -  -  -   -  -  -  -  -  -  -  -  - </div>
                                                            </div>
                                                        </div>
                                                        <div class="rh-right">
                                                            <div class="generated">Generated: ${fmtDateTime(new Date())}</div>
                                                            <div class="by">By: ${currentUser?.name || currentUser?.email || ''}</div>
                                                        </div>
                                                    </div>
                                                    <!-- Filter bar removed as per user request -->
                                                    <!-- Opening Balance Row -->
                                                    <div class="summary-grid-6">
                                                      <div class="line-card" style="border-left:3px solid #f59e0b"><div class="label">Opening Cash</div><div class="value" style="color:#b45309">${summary.openingCash.toLocaleString()} SAR</div></div>
                                                      <div class="line-card" style="border-left:3px solid #f59e0b"><div class="label">Opening Bank</div><div class="value" style="color:#b45309">${summary.openingBank.toLocaleString()} SAR</div></div>
                                                      <div class="line-card" style="border-left:3px solid #eab308"><div class="label">Total Opening</div><div class="value" style="color:#a16207">${summary.openingTotal.toLocaleString()} SAR</div></div>
                                                    </div>
                                                    <!-- Income Row -->
                                                    ${!isExpenseReport ? `<div class="summary-grid-6">
                                                      <div class="line-card"><div class="label">${t('history.cashIncome')}</div><div class="value" style="color:var(--income)">${cashIncome.toLocaleString()} SAR</div></div>
                                                      <div class="line-card"><div class="label">${t('history.bankIncome')}</div><div class="value" style="color:var(--income)">${bankIncome.toLocaleString()} SAR</div></div>
                                                      <div class="line-card"><div class="label">${t('dashboard.totalIncome')}</div><div class="value" style="color:var(--income)">${incomeTotal.toLocaleString()} SAR</div></div>
                                                    </div>` : ''}
                                                    <!-- Expense Row -->
                                                    ${!isIncomeReport ? `<div class="summary-grid-6">
                                                      <div class="line-card"><div class="label">${t('history.cashExpense')}</div><div class="value" style="color:var(--expense)">${cashExpense.toLocaleString()} SAR</div></div>
                                                      <div class="line-card"><div class="label">${t('history.bankExpense')}</div><div class="value" style="color:var(--expense)">${bankExpense.toLocaleString()} SAR</div></div>
                                                      <div class="line-card"><div class="label">Total Expense</div><div class="value" style="color:var(--expense)">${expenseTotal.toLocaleString()} SAR</div></div>
                                                    </div>` : ''}
                                                    <!-- Closing Balance Row -->
                                                    ${!(isIncomeReport || isExpenseReport) ? `<div class="summary-grid-6">
                                                      <div class="line-card" style="border-left:3px solid var(--income)"><div class="label">Cash Balance</div><div class="value" style="color:var(--income)">${cashBalance.toLocaleString()} SAR</div></div>
                                                      <div class="line-card" style="border-left:3px solid #06b6d4"><div class="label">Bank Balance</div><div class="value" style="color:#0891b2">${bankBalance.toLocaleString()} SAR</div></div>
                                                      <div class="line-card" style="border-left:3px solid #6366f1"><div class="label">Net Balance</div><div class="value" style="color:#4f46e5">${totalNetBalance.toLocaleString()} SAR</div></div>
                                                    </div>` : ''}

                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th style="width:70px">${t('common.date')}</th>
                                                                <th style="width:60px">${t('history.type')}</th>
                                                                <th style="min-width:140px">${t('common.details')}</th>
                                                                <th style="width:90px">Method</th>
                                                                <th style="width:70px;text-align:right">${t('entry.income')}</th>
                                                                <th style="width:70px;text-align:right">${t('entry.expense')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            ${rowsHtml}
                                                        </tbody>
                                                    </table>

                                                    <div class="meta-footer">
                                                        <div>
                                                            <span>This is a computer-generated report &bull;  -  -  -   -  -  -  -  -  -  -   -  -  -  -   -  -  -  -  -  -  -  -  -  - </span><br/>
                                                            <span class="footer-copy">Arar Millennium Company Ltd &copy; ${new Date().getFullYear()}</span>
                                                        </div>
                                                        <span class="amlak-badge"><img src="${window.location.origin}/images/logo.png" alt="" /> Powered by Amlak</span>
                                                    </div>
                                                </div>
                                                <script>window.onload=function(){setTimeout(function(){var imgs=document.images,c=0,t=imgs.length;if(!t){window.print();return}for(var i=0;i<t;i++){if(imgs[i].complete){if(++c>=t)window.print()}else{imgs[i].onload=imgs[i].onerror=function(){if(++c>=t)window.print()}}}},200);}</script>
                                            </body>
                                        </html>
                                `;

                const win = window.open('', '_blank', 'width=1000,height=800');
                if (!win) return;
                win.document.write(html);
                win.document.close();
                win.focus();
        };

    
    // ─── VAT Period Summary (April 1 of current year onwards) ───
    const vatPeriodStart = useMemo(() => {
        return new Date().getFullYear() + '-04-01';
    }, []);

    const vatPeriodSummary = useMemo(() => {
        const periodStart = vatPeriodStart;
        const vatTxns = transactions.filter(t =>
            !((t as any).deleted) &&
            t.isVATApplicable &&
            t.date &&
            t.date >= periodStart
        );
        const salesTxns   = vatTxns.filter(t => String(t.type).toUpperCase() === 'INCOME'  && !(t as any).isCreditNote);
        const creditNotes  = vatTxns.filter(t => String(t.type).toUpperCase() === 'INCOME'  &&  (t as any).isCreditNote);
        const purchaseTxns = vatTxns.filter(t => String(t.type).toUpperCase() === 'EXPENSE');

        const salesBase  = salesTxns.reduce((s, r)   => s + (Number(r.amountExcludingVAT  || r.amount) || 0), 0);
        const salesVat   = salesTxns.reduce((s, r)   => s + (Number(r.vatAmount)           || 0),             0);
        const cnBase     = creditNotes.reduce((s, r)  => s + (Number(r.amountExcludingVAT  || r.amount) || 0), 0);
        const cnVat      = creditNotes.reduce((s, r)  => s + (Number(r.vatAmount)           || 0),             0);
        const purchBase  = purchaseTxns.reduce((s, r) => s + (Number(r.amountExcludingVAT  || r.amount) || 0), 0);
        const purchVat   = purchaseTxns.reduce((s, r) => s + (Number(r.vatAmount)           || 0),             0);

        const netSalesBase = salesBase - cnBase;
        const netSalesVat  = salesVat  - cnVat;
        const netVat       = netSalesVat - purchVat;

        return {
            periodStart,
            salesCount: salesTxns.length,
            purchaseCount: purchaseTxns.length,
            salesBase: netSalesBase,
            salesVat: netSalesVat,
            purchaseBase: purchBase,
            purchaseVat: purchVat,
            netVat,
        };
    }, [transactions, vatPeriodStart]);

const canDelete = useCallback((tx: Transaction) => {
        if ((tx as any).isOpeningBalance) return false;
        // Admins and Managers can always delete
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) return true;
        // Staff can delete their own transactions within 30 days
        if (t.createdBy === currentUser.id) {
            const diff = Date.now() - (t.createdAt || 0);
            return diff < (30 * 24 * 60 * 60 * 1000);
        }
        return false;
    }, [currentUser.role, currentUser.id]);

    return (
        <div className="mobile-tab-shell tab-history px-1 sm:px-2 pt-2 animate-fade-in">
            <div className="premium-card tab-history-frame flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                {/* Header */}
                <div className="relative p-3 sm:p-4 border-b border-slate-200/70 rounded-t-2xl space-y-3 shrink-0 bg-gradient-to-br from-white via-violet-50/40 to-indigo-50/30">
                    <div className="pointer-events-none absolute -top-12 -right-16 w-56 h-56 rounded-full bg-violet-200/30 blur-3xl" />
                    <div className="relative flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={loadData} title={t('common.refresh') || 'Refresh'} className="w-9 h-9 rounded-xl bg-white border border-violet-200 text-violet-600 flex items-center justify-center shadow-sm hover:bg-violet-50 hover:rotate-180 transition-all">
                                <RefreshCcw size={16} />
                            </button>
                            <div>
                                <h2 className="text-base sm:text-xl font-black text-slate-900 leading-tight tracking-tight">{t('history.transactions')}</h2>
                                <p className="hidden sm:block text-[11px] text-slate-500 font-medium">{listData.length.toLocaleString()} {listData.length === 1 ? 'record' : 'records'} · {summary.incomeTotal.toLocaleString()} in · {summary.expenseTotal.toLocaleString()} out</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center w-full sm:w-auto">
                            <div className="relative form-with-icon group flex-1 min-w-0 sm:min-w-[220px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" size={15} />
                                <input type="text" placeholder={t('history.searchDetails')} value={searchInput} onChange={e => setSearchInput(e.target.value)}
                                    className="pl-9 pr-3 py-2 bg-white/90 backdrop-blur border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-300 outline-none w-full xl:w-72 shadow-sm"
                                />
                            </div>

                            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border shadow-sm ${showFilters ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700' : 'bg-white text-slate-700 border-slate-200 hover:border-violet-200 hover:text-violet-700'}`}>
                                <SlidersHorizontal size={14} /> <span className="hidden xs:inline">{t('common.filter')}</span>
                            </button>

                            <button onClick={handleExportCSV} title="Export CSV" className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm">
                                <Download size={14} />
                            </button>
                            <button onClick={() => handleExportPDF()} title="Export PDF" className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm shadow-violet-200">
                                <Printer size={14} />
                            </button>
                            {currentUser.role === UserRole.ADMIN && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setShowDeleted(!showDeleted)}
                                        className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border shadow-sm ${showDeleted ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700' : 'bg-white text-slate-700 border-slate-200 hover:border-rose-200 hover:text-rose-700'}`}
                                    >
                                        <Trash2 size={14} /> <span className="hidden sm:inline">{showDeleted ? t('history.active') : t('history.trash', { count: transactions.filter(t => (t as any).deleted).length })}</span>
                                    </button>
                                    {showDeleted && (
                                        <>
                                            <button onClick={handleRestoreAll} title={t('history.restoreAll') as string} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm"><RotateCcw size={14} /></button>
                                            <button onClick={handleDeleteAll} title={t('history.deleteAll') as string} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 shadow-sm"><X size={14} /></button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showFilters && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-1.5 sm:gap-2 pt-2 animate-slide-up">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.fromDate')}</label>
                                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.toDate')}</label>
                                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-emerald-600 uppercase">{t('history.allTillDate')}</label>
                                <input type="date" value={filterTillDate} onChange={e => setFilterTillDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.type')}</label>
                                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allTypes')}</option>
                                    <option value={TransactionType.INCOME}>{t('history.income')}</option>
                                    <option value={TransactionType.EXPENSE}>{t('history.expense')}</option>
                                    <option value={TransactionType.INFO}>{t('history.infoFreeStock')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.category')}</label>
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allCategories')}</option>
                                    <option value="Owner Expense">Owner Expense</option>
                                    {(filterCategory === 'ALL' ? categoryOptions : categoryOptions.filter(c => c === filterCategory)).map(c => (
                                        c !== 'Owner Expense' && <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.building')}</label>
                                <button
                                  ref={buildingTriggerRef}
                                  type="button"
                                  onClick={() => setShowBuildingPicker(v => !v)}
                                  className={`group flex w-full items-center gap-2 px-3 py-2 bg-white border rounded-xl text-xs shadow-sm transition-all ${showBuildingPicker ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200 hover:border-violet-300'}`}
                                >
                                  <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center ${filterBuildingIds.length > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                                    <Building2 size={13} />
                                  </span>
                                  <span className="flex-1 min-w-0 text-left">
                                    <span className={`block truncate font-semibold ${filterBuildingIds.length > 0 ? 'text-slate-800' : 'text-slate-500'}`}>
                                      {filterBuildingIds.length === 0
                                        ? t('history.allBuildings')
                                        : filterBuildingIds.length === 1
                                        ? (buildingOptions.find(b => b.id === filterBuildingIds[0])?.name || '1 selected')
                                        : filterBuildingIds.length <= 2
                                        ? buildingOptions.filter(b => filterBuildingIds.includes(b.id)).map(b => b.name).join(', ')
                                        : `${filterBuildingIds.length} selected`}
                                    </span>
                                  </span>
                                  {filterBuildingIds.length > 0 && (
                                    <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-black">{filterBuildingIds.length}</span>
                                  )}
                                  <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${showBuildingPicker ? 'rotate-180 text-violet-500' : ''}`} />
                                </button>
                                {showBuildingPicker && buildingPickerRect && createPortal(
                                  <div
                                    ref={buildingPickerRef}
                                    style={{
                                      position: 'fixed',
                                      top: Math.min(buildingPickerRect.top + 6, window.innerHeight - 380),
                                      left: Math.max(8, Math.min(buildingPickerRect.left, window.innerWidth - Math.max(buildingPickerRect.width, 280) - 8)),
                                      width: Math.max(buildingPickerRect.width, 280),
                                      zIndex: 9999,
                                    }}
                                    className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-slide-up">
                                    <div className="p-2.5 bg-gradient-to-br from-violet-50 to-white border-b border-slate-100 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
                                          <Building2 size={15} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-black text-slate-800 tracking-tight">{t('history.building')}</div>
                                          <div className="text-[10px] font-medium text-slate-500">{filterBuildingIds.length} of {buildingOptions.length} selected</div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setShowBuildingPicker(false)}
                                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center"
                                          title="Close"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                      <div className="relative">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                          type="text"
                                          autoFocus
                                          value={buildingPickerSearch}
                                          onChange={e => setBuildingPickerSearch(e.target.value)}
                                          placeholder="Search buildings..."
                                          className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setFilterBuildingIds(isAdminOrManager ? buildingOptions.map(b => b.id) : userBuildingIds)}
                                          className="flex-1 px-2 py-1 rounded-lg bg-white border border-violet-200 text-violet-700 text-[10px] font-black uppercase tracking-wide hover:bg-violet-50"
                                        >Select all</button>
                                        <button
                                          type="button"
                                          onClick={() => setFilterBuildingIds(isAdminOrManager ? [] : userBuildingIds)}
                                          className="flex-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wide hover:bg-slate-50"
                                        >Clear</button>
                                      </div>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
                                      {buildingOptions
                                        .filter(b => !buildingPickerSearch || (b.name || '').toLowerCase().includes(buildingPickerSearch.toLowerCase()))
                                        .map(b => {
                                          const checked = filterBuildingIds.includes(b.id);
                                          return (
                                            <label key={b.id} className={`group flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-violet-50 border border-violet-200' : 'border border-transparent hover:bg-slate-50'}`}>
                                              <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${checked ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 group-hover:border-violet-400'}`}>
                                                {checked && <Check size={10} strokeWidth={3} />}
                                              </span>
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                  setFilterBuildingIds(prev =>
                                                    prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                                                  );
                                                }}
                                                className="sr-only"
                                              />
                                              <span className={`text-xs truncate ${checked ? 'text-violet-800 font-bold' : 'text-slate-700 font-medium'}`}>{b.name}</span>
                                            </label>
                                          );
                                        })}
                                      {buildingOptions.filter(b => !buildingPickerSearch || (b.name || '').toLowerCase().includes(buildingPickerSearch.toLowerCase())).length === 0 && (
                                        <div className="py-6 text-center text-[11px] font-medium text-slate-400">No buildings match “{buildingPickerSearch}”</div>
                                      )}
                                    </div>
                                    <div className="p-2 border-t border-slate-100 bg-slate-50/60">
                                      <button
                                        type="button"
                                        onClick={() => setShowBuildingPicker(false)}
                                        className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all"
                                      >{t('task.done')}</button>
                                    </div>
                                  </div>,
                                  document.body
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.unitNo')}</label>
                                <input type="text" placeholder={t('history.unitExample')} value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('common.status')}</label>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allStatus')}</option>
                                    <option value="APPROVED">{t('common.approved')}</option>
                                    <option value="PENDING">{t('common.pending')}</option>
                                    <option value="REJECTED">{t('common.rejected')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.vat')}</label>
                                <select value={filterVat} onChange={e => setFilterVat(e.target.value as any)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('common.all')}</option>
                                    <option value="WITH">{t('history.withVat')}</option>
                                    <option value="WITHOUT">{t('history.withoutVat')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.payment')}</label>
                                <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allMethods')}</option>
                                    <option value="CASH">{t('history.cash')}</option>
                                    <option value="BANK">{t('history.bank')}</option>
                                    <option value="CHEQUE">{t('history.cheque')}</option>
                                    <option value="FREE">{t('history.free')}</option>
                                </select>
                            </div>
                            <div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.customer')}</label>
                                <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allCustomers')}</option>
                                    {sortedCustomers.map(c => (
                                        <option key={c.id} value={c.id}>{formatCustomerLabel(c)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.staff')}</label>
                                <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allStaff')}</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} {s.role ? `(${s.role})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.owner')}</label>
                                <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allOwners')}</option>
                                    {owners.map(o => (
                                        <option key={o.id} value={o.id}>{o.name} {o.role ? `(${o.role})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('history.bank')}</label>
                                <select value={filterBankName} onChange={e => setFilterBankName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <option value="ALL">{t('history.allBanks')}</option>
                                    {banks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
                                                        <div className="flex items-end gap-2">
                                                                <button onClick={clearFilters} className="w-full py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
                                                                    <X size={12} /> {t('common.reset')}
                                                                </button>
                                                                <SavedFilters
                                                                    namespace="history"
                                                                    getCurrent={() => ({ filterType, filterMethod, filterStatus, filterCategory, filterBuildingIds, filterUnit, filterDateFrom, filterDateTo, filterVat, searchTerm, filterBankName, filterCustomer })}
                                                                    apply={(s: any) => {
                                                                        setFilterType(s.filterType || 'ALL'); setFilterMethod(s.filterMethod || 'ALL'); setFilterStatus(s.filterStatus || 'ALL'); setFilterCategory(s.filterCategory || 'ALL'); setFilterBuildingIds(Array.isArray(s.filterBuildingIds) ? s.filterBuildingIds : (s.filterBuildingIds && s.filterBuildingIds !== 'ALL' ? [s.filterBuildingIds] : [])); setFilterUnit(s.filterUnit || ''); setFilterDateFrom(s.filterDateFrom || ''); setFilterDateTo(s.filterDateTo || ''); setFilterVat(s.filterVat || 'ALL'); setSearchTerm(s.searchTerm || ''); setSearchInput(s.searchTerm || ''); setFilterBankName(s.filterBankName || 'ALL'); setFilterCustomer(s.filterCustomer || 'ALL');
                                                                    }}
                                                                />
                                                        </div>
                        </div>
                    )}
                </div>


                {/* Mobile Cards (small screens) */}
                <div className="md:hidden flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 animate-stagger">
                    {/* Mobile KPI hero — 2×2 grid with cash/bank chip rows */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-3 shadow-sm">
                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-700 mb-1">{t('history.openingTotal')}</div>
                            <div className="text-base font-black text-amber-900 leading-tight">{summary.openingTotal.toLocaleString()}<span className="text-[9px] font-bold text-amber-500 ml-1">{t('common.sar')}</span></div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold">
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700">{t('history.openingCash')} {summary.openingCash.toLocaleString()}</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700">{t('history.openingBank')} {summary.openingBank.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 mb-1">{t('history.totalIn')}</div>
                            <div className="text-base font-black text-emerald-900 leading-tight">{summary.incomeTotal.toLocaleString()}<span className="text-[9px] font-bold text-emerald-500 ml-1">{t('common.sar')}</span></div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold">
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.cashIn')} {summary.cashIncome.toLocaleString()}</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.bankIn')} {summary.bankIncome.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-3 shadow-sm">
                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-700 mb-1">{t('history.totalOut')}</div>
                            <div className="text-base font-black text-rose-900 leading-tight">{summary.expenseTotal.toLocaleString()}<span className="text-[9px] font-bold text-rose-500 ml-1">{t('common.sar')}</span></div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold">
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('history.cashOut')} {summary.cashExpense.toLocaleString()}</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('history.bankOut')} {summary.bankExpense.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className={`relative overflow-hidden rounded-2xl border p-3 shadow-sm ${summary.totalNet >= 0 ? 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white' : 'border-rose-300/80 bg-gradient-to-br from-rose-50 to-white'}`}>
                            <div className={`text-[9px] font-black uppercase tracking-[0.14em] mb-1 ${summary.totalNet >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{t('history.netBal')}</div>
                            <div className={`text-base font-black leading-tight ${summary.totalNet >= 0 ? 'text-indigo-900' : 'text-rose-900'}`}>{summary.totalNet.toLocaleString()}<span className={`text-[9px] font-bold ml-1 ${summary.totalNet >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>{t('common.sar')}</span></div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold">
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.cashBal')} {summary.cashBalance.toLocaleString()}</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-cyan-200 text-cyan-700">{t('history.bankBal')} {summary.bankBalance.toLocaleString()}</span>
                            </div>
                        </div>
                        {summary.ownerExpenseTotal > 0 && (
                            <div className="col-span-2 rounded-xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-3 py-2 flex items-center justify-between shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">{t('history.ownerExpenses')}</span>
                                <span className="text-sm font-black text-orange-800">{summary.ownerExpenseTotal.toLocaleString()} <span className="text-[9px] font-bold text-orange-500">{t('common.sar')}</span></span>
                            </div>
                        )}
                    </div>
                    {visibleData.map((row) => {
                        const dueAmount = (row.expectedAmount || 0) - row.amount;
                        const isUnderpaid = row.type === TransactionType.INCOME && dueAmount > 0;
                        const isPending = row.status === 'PENDING';
                        const bName = getBuildingName(row.buildingId || (row as any).building) || row.buildingName || '';
                        const category = row.expenseCategory || '';
                        const title = (() => {
                            if ((row as any).source === 'treasury') return getTreasuryLabel(row);
                            const details = String(row.details ?? '');
                            if (details.toLowerCase().includes('stock sale')) {
                                const custId = extractCustomerIdFromDetails(details) || (row as any).customerId || (row as any).customer;
                                const custName = custId ? getCustomerName(custId) : '';
                                return `Sale to ${custName || custId || '-'}${bName ? '  -  ' + bName : ''}`;
                            }
                            if (category) return `${category}${bName ? '  -  ' + bName : ''}`;
                            return bName || '-';
                        })();
                        const accent = row.type === TransactionType.INCOME ? 'before:bg-emerald-400' : row.type === TransactionType.EXPENSE ? 'before:bg-rose-400' : 'before:bg-slate-300';
                        return (
                            <div key={row.id} className={`relative overflow-hidden bg-white rounded-2xl p-3 pl-4 space-y-1.5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent} ${showDeleted ? 'opacity-70' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border ${
                                            row.type === TransactionType.INCOME
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : row.type === TransactionType.EXPENSE
                                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>{row.type}</span>
                                        <span className="text-[9px] font-mono text-slate-500">{fmtDate(row.date)}</span>
                                        {showDeleted && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{t('history.deleted')}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {row.type === TransactionType.INCOME ? (
                                            <div className={`amount-pill amount-income ${showDeleted ? 'line-through' : ''}`}><span className="amt-value">{Number(row.amountIncludingVAT || row.totalWithVat || row.amount).toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div>
                                        ) : row.type === TransactionType.EXPENSE ? (
                                            <div className={`amount-pill amount-expense ${showDeleted ? 'line-through' : ''}`}><span className="amt-value">{Number(row.amountIncludingVAT || row.totalWithVat || row.amount).toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div>
                                        ) : (
                                            <div className="amount-pill amount-neutral"><span className="amt-value">-</span></div>
                                        )}
                                    </div>
                                </div>

                                {isPending && <div className={`text-[9px] font-bold uppercase ${(row as any).isAutoPayment ? 'text-blue-600' : 'text-amber-600'}`}>{(row as any).isAutoPayment ? t('history.pendingBankConfirmation') : 'Pending Approval'}</div>}
                                {row.status === 'REJECTED' && <div className="text-[9px] font-bold text-rose-600 uppercase">{t('common.rejected')}</div>}

                                {row.unitNumber && (
                                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide border border-emerald-200">UNIT {row.unitNumber}</span>
                                )}

                                <div className="font-bold text-slate-800 text-xs break-words leading-tight">{title}</div>
                                {row.details && <div className="text-[10px] text-slate-600 break-words leading-tight">{String(row.details)}</div>}

                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600 pt-0.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 font-bold" title={fmtPaymentMethod(row)}>{fmtPaymentMethod(row)}</span>
                                    {row.isVATApplicable && <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">VAT</span>}
                                    {isUnderpaid && (
                                        <span className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">Left: {dueAmount.toLocaleString()}</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-1 pt-1">
                                    {!(row as any).isOpeningBalance && row.type === TransactionType.INCOME && (
                                        <>
                                            <button onClick={() => handlePrintReceipt(row)} className="p-1.5 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-md hover:bg-slate-200" title={t('common.print')}><Printer size={14}/></button>
                                            <button onClick={() => handleWhatsApp(row)} className="p-1.5 text-emerald-400 hover:text-emerald-600 bg-emerald-50 rounded-md hover:bg-emerald-100" title={t('nav.whatsapp')}><MessageCircle size={14}/></button>
                                        </>
                                    )}
                                    {/* Edit Payment Method Button (mobile) */}
                                    {!(row as any).isOpeningBalance && (
                                        <button onClick={() => { setEditPaymentTx(row); setShowEditPaymentModal(true); }} className="p-1.5 text-blue-400 hover:text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100" title="Edit Payment Method">
                                            <Pencil size={14}/>
                                        </button>
                                    )}
                                    {/* Convert to VAT (mobile) */}
                                    {!(row as any).isOpeningBalance && !row.isVATApplicable && !showDeleted && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (row.status !== TransactionStatus.REJECTED) && (
                                        <button onClick={() => openVatModal(row)} className="p-1.5 text-violet-500 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-md" title={row.type === TransactionType.INCOME ? 'Convert to VAT Sales (ZATCA)' : 'Convert to VAT Purchase'}>
                                            <span className="text-[9px] font-black px-0.5">{t('history.vat')}</span>
                                        </button>
                                    )}
                                    {!(row as any).isOpeningBalance && row.isVATApplicable && row.vatInvoiceNumber && (
                                        <button onClick={() => window.location.hash = `/invoice/${row.vatInvoiceNumber}`} className="p-1.5 text-blue-400 hover:text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100" title={t('history.viewInvoice')}><FileText size={14}/></button>
                                    )}
                                    {!(row as any).isOpeningBalance && (
                                        <button onClick={() => openView(row)} className="p-1.5 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-md hover:bg-slate-200" title={t('history.viewMore')}><Eye size={14}/></button>
                                    )}
                                    {showDeleted ? (
                                        <>
                                            <button onClick={() => handleRestore(row)} className="p-1.5 text-emerald-400 hover:text-emerald-600 bg-emerald-50 rounded-md hover:bg-emerald-100" title={t('history.restore')}><RotateCcw size={14}/></button>
                                            <button onClick={() => handlePermanentDelete(row)} className="p-1.5 text-rose-400 hover:text-rose-600 bg-rose-50 rounded-md hover:bg-rose-100" title={t('history.deletePermanently')}><X size={14}/></button>
                                        </>
                                    ) : (
                                        canDelete(row) ? (
                                            <button onClick={() => handleDeleteStart(row)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title={row.isVATApplicable && row.type === TransactionType.INCOME ? 'Create Credit Note' : 'Move to Trash'}><Trash2 size={14}/></button>
                                        ) : (
                                            <span className="p-1.5 text-slate-300" title={t('history.cannotDelete')}><AlertOctagon size={14} /></span>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {listData.length === 0 && (
                        <div className="px-3 py-10 text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mb-3"><FileText size={26}/></div>
                            <div className="text-sm font-bold text-slate-500">{t('history.noTransactions')}</div>
                            <div className="text-[11px] text-slate-400 mt-1">Try adjusting your filters</div>
                        </div>
                    )}
                    {hasMore && (
                        <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="w-full py-3 text-center text-xs font-bold text-violet-700 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 rounded-2xl border border-violet-200 shadow-sm transition-all mt-2 flex items-center justify-center gap-2">
                            <ChevronDown size={14} /> {t('history.loadMore')} <span className="text-violet-500">· {listData.length - visibleCount}</span>
                        </button>
                    )}
                </div>

                {/* Desktop Summary + Table */}
                <div className="hidden md:block flex-1 overflow-y-auto overscroll-contain">
                <div className="mb-6 px-3 pt-4">
                    {/* Hero KPI strip — 4 primary cards, each with a cash/bank split chip row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {/* Opening Balance */}
                        <div className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-200/40 blur-2xl" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">{t('history.openingTotal')}</span>
                                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Calendar size={14}/></span>
                                </div>
                                <div className="text-2xl font-black text-amber-900 tracking-tight">{summary.openingTotal.toLocaleString()} <span className="text-xs font-bold text-amber-500">{t('common.sar')}</span></div>
                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700">{t('history.openingCash')} · {summary.openingCash.toLocaleString()}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700">{t('history.openingBank')} · {summary.openingBank.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        {/* Money In */}
                        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-200/40 blur-2xl" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{t('dashboard.totalIncome')}</span>
                                    <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><CheckCircle size={14}/></span>
                                </div>
                                <div className="text-2xl font-black text-emerald-900 tracking-tight">{summary.incomeTotal.toLocaleString()} <span className="text-xs font-bold text-emerald-500">{t('common.sar')}</span></div>
                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.cashIncome')} · {summary.cashIncome.toLocaleString()}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.bankIncome')} · {summary.bankIncome.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        {/* Money Out */}
                        <div className="group relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-rose-200/40 blur-2xl" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">{t('history.totalExpense')}</span>
                                    <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center"><AlertTriangle size={14}/></span>
                                </div>
                                <div className="text-2xl font-black text-rose-900 tracking-tight">{summary.expenseTotal.toLocaleString()} <span className="text-xs font-bold text-rose-500">{t('common.sar')}</span></div>
                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('history.cashExpense')} · {summary.cashExpense.toLocaleString()}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('history.bankExpense')} · {summary.bankExpense.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        {/* Net Balance */}
                        <div className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${summary.totalNet >= 0 ? 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white' : 'border-rose-300/80 bg-gradient-to-br from-rose-50 to-white'}`}>
                            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl ${summary.totalNet >= 0 ? 'bg-indigo-200/40' : 'bg-rose-200/40'}`} />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${summary.totalNet >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{t('history.netBalance')}</span>
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${summary.totalNet >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}><FileText size={14}/></span>
                                </div>
                                <div className={`text-2xl font-black tracking-tight ${summary.totalNet >= 0 ? 'text-indigo-900' : 'text-rose-900'}`}>{summary.totalNet.toLocaleString()} <span className={`text-xs font-bold ${summary.totalNet >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>{t('common.sar')}</span></div>
                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('history.cashBalance')} · {summary.cashBalance.toLocaleString()}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-cyan-200 text-cyan-700">{t('history.bankBalance')} · {summary.bankBalance.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Owner Expense — only shown when present */}
                    {summary.ownerExpenseTotal > 0 && (
                        <div className="mt-3 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-4 py-2.5 flex items-center justify-between shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-700">{t('history.ownerExpenses')}</span>
                            <span className="text-base font-black text-orange-800">{summary.ownerExpenseTotal.toLocaleString()} <span className="text-xs font-bold text-orange-500">{t('common.sar')}</span></span>
                        </div>
                    )}
                </div>
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gradient-to-b from-slate-50 to-white backdrop-blur-sm sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] text-center border-b border-slate-200">{t('common.date')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] text-center border-b border-slate-200">{t('history.type')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] text-left border-b border-slate-200">{t('common.details')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] text-center border-b border-slate-200">{t('history.method')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-[0.14em] text-right border-b border-slate-200">{t('history.income')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-rose-600 uppercase tracking-[0.14em] text-right border-b border-slate-200">{t('history.expense')}</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] text-center border-b border-slate-200">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {visibleData.map((row) => {
                                const dueAmount = (row.expectedAmount || 0) - row.amount;
                                const isUnderpaid = row.type === TransactionType.INCOME && dueAmount > 0;
                                const isPending = row.status === 'PENDING';
                                const leftAccent = row.type === TransactionType.INCOME
                                    ? 'border-l-4 border-l-emerald-400'
                                    : row.type === TransactionType.EXPENSE
                                        ? 'border-l-4 border-l-rose-400'
                                        : 'border-l-4 border-l-slate-200';

                                return (
                                    <tr key={row.id} className={`${leftAccent} hover:bg-violet-50/40 transition-colors group ${showDeleted ? 'bg-rose-50/40 text-slate-500' : ''}`} style={{verticalAlign:'middle'}}>
                                        <td className="px-4 py-3 text-sm text-slate-600 font-mono text-center align-middle">{fmtDate(row.date)}</td>
                                        <td className="px-4 py-3 text-center align-middle">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${
                                                row.type === TransactionType.INCOME 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                : row.type === TransactionType.EXPENSE 
                                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                {row.type}
                                            </span>
                                            {isPending && <div className={`mt-1 text-[9px] font-bold uppercase ${(row as any).isAutoPayment ? 'text-blue-500' : 'text-amber-500'}`}>{(row as any).isAutoPayment ? t('history.pendingBankConfirmation') : 'Pending Approval'}</div>}
                                            {row.status === 'REJECTED' && <div className="mt-1 text-[9px] font-bold text-rose-500 uppercase">{t('common.rejected')}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 text-left align-middle">
                                            {row.unitNumber && (
                                                <div className="mb-1">
                                                    <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-black tracking-wide border border-emerald-200 shadow-sm">
                                                        UNIT {row.unitNumber}
                                                    </span>
                                                </div>
                                            )}
                                                <div className="font-bold text-slate-800 mt-1">{
                                                    (() => {
                                                        const details = String(row.details ?? '');
                                                        const bName = getBuildingName(row.buildingId || (row as any).building) || row.buildingName || '';
                                                        if ((row as any).source === 'treasury') return getTreasuryLabel(row);
                                                        if (details.toLowerCase().includes('stock sale')) {
                                                            const custId = extractCustomerIdFromDetails(details) || (row as any).customerId || (row as any).customer;
                                                            const custName = custId ? getCustomerName(custId) : '';
                                                            return `Sale to ${custName || custId || '-'}${bName ? '  -  ' + bName : ''}`;
                                                        }
                                                        const category = row.expenseCategory || '';
                                                        if (category) return `${category}${bName ? '  -  ' + bName : ''}`;
                                                        return bName || '-';
                                                    })()
                                                }</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{(row as any).source === 'treasury' ? ((row as any).purpose || '') : String(row.details ?? '')}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500 text-center align-middle">
                                            {(() => {
                                                const r: any = row;
                                                const raw = String(r.paymentMethod || '').toUpperCase();
                                                const eff = String(r.originalPaymentMethod || raw).toUpperCase();
                                                const label = eff === 'BANK' ? 'Bank' : eff === 'CHEQUE' ? 'Cheque' : eff === 'CASH' ? 'Cash' : eff === 'TREASURY' ? 'Cash' : eff;
                                                const fromB = r.fromBankName || ((raw === 'BANK' || raw === 'CHEQUE' || eff === 'BANK' || eff === 'CHEQUE') ? r.bankName : '') || '';
                                                const toB = r.toBankName || '';
                                                return (
                                                    <>
                                                        <div className="font-bold text-xs" title={fmtPaymentMethod(row)}>{label}</div>
                                                        {fromB && toB ? (
                                                            <div className="text-[10px] text-violet-600 font-medium truncate max-w-[160px]" title={`${fromB} → ${toB}`}>{fromB} → {toB}</div>
                                                        ) : fromB ? (
                                                            <div className="text-[10px] text-violet-600 font-medium truncate max-w-[160px]">{fromB}</div>
                                                        ) : null}
                                                    </>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500 text-right align-middle">
                                            <div className="text-right">
                                                {row.type === TransactionType.INCOME ? (
                                                    <div className={`amount-pill amount-income amount-pill-right ${showDeleted ? 'line-through' : ''}`}><span className="amt-value">{Number(row.amountIncludingVAT || row.totalWithVat || row.amount).toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div>
                                                ) : (
                                                    <div className="amount-pill amount-neutral amount-pill-right"><span className="amt-value">-</span></div>
                                                )}
                                            </div>
                                            {isUnderpaid && (
                                                <div className="text-[10px] text-rose-600 font-bold flex items-center justify-end gap-1 mt-1 bg-rose-50 px-2 py-1 rounded border border-rose-100 inline-block">
                                                    <AlertTriangle size={10} /> Left: {dueAmount.toLocaleString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-slate-500 align-middle">
                                            <div className="text-right">
                                                {row.type === TransactionType.EXPENSE ? (
                                                    <div className={`amount-pill amount-expense amount-pill-right ${showDeleted ? 'line-through' : ''}`}><span className="amt-value">{Number(row.amountIncludingVAT || row.totalWithVat || row.amount).toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div>
                                                ) : (
                                                    <div className="amount-pill amount-neutral amount-pill-right"><span className="amt-value">-</span></div>
                                                )}
                                            </div>
                                         </td>
                                        <td className="px-4 py-3 text-center flex justify-center gap-2 align-middle">
                                             {!(row as any).isOpeningBalance && row.type === TransactionType.INCOME && (
                                                <>
                                                    <button onClick={() => handlePrintReceipt(row)} className="p-2 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-lg hover:bg-slate-200" title={t('common.print')}><Printer size={16}/></button>
                                                    <button onClick={() => handleWhatsApp(row)} className="p-2 text-emerald-400 hover:text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100" title={t('nav.whatsapp')}><MessageCircle size={16}/></button>
                                                </>
                                             )}
                                             {!(row as any).isOpeningBalance && row.isVATApplicable && row.vatInvoiceNumber && (
                                                <button 
                                                    onClick={() => window.location.hash = `/invoice/${row.vatInvoiceNumber}`} 
                                                    className="p-2 text-blue-400 hover:text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100" 
                                                    title={t('history.viewInvoice')}
                                                >
                                                    <FileText size={16}/>
                                                </button>
                                             )}
                                             <div className="flex items-center gap-2">
                                                 {/* Edit Payment Method Button (desktop) */}
                                                 {!(row as any).isOpeningBalance && (
                                                     <button onClick={() => { setEditPaymentTx(row); setShowEditPaymentModal(true); }} className="p-2 text-blue-400 hover:text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100" title="Edit Payment Method">
                                                         <Pencil size={16}/>
                                                     </button>
                                                 )}
                                                 {/* Convert to VAT (desktop) */}
                                                 {!(row as any).isOpeningBalance && !row.isVATApplicable && !showDeleted && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (row.status !== TransactionStatus.REJECTED) && (
                                                     <button onClick={() => openVatModal(row)} className="px-2.5 py-2 text-[10px] font-black text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-all" title={row.type === TransactionType.INCOME ? 'Convert to VAT Sales (ZATCA)' : 'Convert to VAT Purchase'}>{t('history.vat')}</button>
                                                 )}
                                                 {showDeleted ? (
                                                     <>
                                                         <button onClick={() => handleRestore(row)} className="p-2 text-emerald-400 hover:text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100" title={t('history.restore')}><RotateCcw size={16}/></button>
                                                         <button onClick={() => handlePermanentDelete(row)} className="p-2 text-rose-400 hover:text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100" title={t('history.deletePermanently')}><X size={16}/></button>
                                                     </>
                                                 ) : (
                                                     canDelete(row) ? (
                                                         <button onClick={() => handleDeleteStart(row)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title={row.isVATApplicable && row.type === TransactionType.INCOME ? "Create Credit Note" : "Move to Trash"}><Trash2 size={16}/></button>
                                                     ) : (
                                                         <span className="p-2 text-slate-300" title={t('history.cannotDelete')}><AlertOctagon size={16} /></span>
                                                     )
                                                 )}
                                             </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {listData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3"><FileText size={28}/></div>
                                            <div className="text-sm font-bold text-slate-500">{t('history.noTransactions')}</div>
                                            <div className="text-[11px] text-slate-400 mt-1">Try adjusting your filters</div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {hasMore && (
                        <div className="py-4 text-center">
                            <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-violet-700 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 rounded-full border border-violet-200 shadow-sm transition-all">
                                <ChevronDown size={14} /> {t('history.loadMore')} <span className="text-violet-500">· {listData.length - visibleCount} {t('history.remaining') || 'remaining'}</span>
                            </button>
                        </div>
                    )}

                    {/* Totals for filtered results */}
                    <div className="hidden p-3 sm:p-4 bg-slate-50/50 border-t border-slate-100 text-right font-bold text-slate-800">
                        <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.incomeTotal')}</div>
                                <div className="text-2xl font-black"><div className="amount-pill amount-income"><span className="amt-value">{summary.incomeTotal.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                            </div>
                            <div className="p-3 bg-rose-50 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.expenseTotal')}</div>
                                <div className="text-2xl font-black"><div className="amount-pill amount-expense"><span className="amt-value">{summary.expenseTotal.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.netTotal')}</div>
                                <div className="text-2xl font-black"><div className="amount-pill amount-neutral"><span className="amt-value">{summary.totalNet.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.cashIncome')}</div>
                                <div className="text-lg font-bold text-emerald-700">{summary.cashIncome.toLocaleString()} SAR</div>
                            </div>
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.bankIncome')}</div>
                                <div className="text-lg font-bold text-emerald-700">{summary.bankIncome.toLocaleString()} SAR</div>
                            </div>
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.incomeTotal')}</div>
                                <div className="text-lg font-bold text-emerald-700">{summary.incomeTotal.toLocaleString()} SAR</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.cashExpense')}</div>
                                <div className="text-lg font-bold text-rose-700">{summary.cashExpense.toLocaleString()} SAR</div>
                            </div>
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.bankExpense')}</div>
                                <div className="text-lg font-bold text-rose-700">{summary.bankExpense.toLocaleString()} SAR</div>
                            </div>
                            <div className="p-3 bg-white border rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.expenseTotal')}</div>
                                <div className="text-lg font-bold text-rose-700">{summary.expenseTotal.toLocaleString()} SAR</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.cashBalance')}</div>
                                <div className="text-lg font-bold">
                                    {summary.cashBalance.toLocaleString()} SAR
                                </div>
                            </div>
                            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.bankBalance')}</div>
                                <div className="text-lg font-bold">
                                    {summary.bankBalance.toLocaleString()} SAR
                                </div>
                            </div>
                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <div className="text-xs text-slate-500">{t('history.totalNetBalance')}</div>
                                <div className="text-lg font-bold">
                                    {summary.totalNet.toLocaleString()} SAR
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                </div>

                {/* ─── Convert to VAT Modal ─────────────────────────────────────── */}
                {showVatModal && vatModalTx && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-slide-up overflow-hidden">
                            {/* Header */}
                            <div className={`relative p-6 pb-5 ${vatModalTx.type === TransactionType.INCOME ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700' : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600'}`}>
                                <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',backgroundSize:'30px 30px'}}/>
                                <div className="relative flex items-start justify-between">
                                    <div>
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 ${vatModalTx.type === TransactionType.INCOME ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
                                            {vatModalTx.type === TransactionType.INCOME ? '📊 ZATCA Sales Invoice' : '🧾 VAT Purchase Invoice'}
                                        </div>
                                        <h2 className="text-lg font-black text-white">Convert to VAT Transaction</h2>
                                        <p className="text-white/70 text-xs mt-0.5">
                                            {vatModalTx.type === TransactionType.INCOME
                                                ? 'This income will be registered as a VAT sales invoice and reported to ZATCA'
                                                : 'This expense will be tagged as a VAT purchase entry'}
                                        </p>
                                    </div>
                                    <button onClick={() => setShowVatModal(false)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"><X size={18}/></button>
                                </div>
                            </div>

                            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Transaction snapshot */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Transaction Summary</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex flex-col"><span className="text-slate-400 font-bold">{t('common.date')}</span><span className="font-black text-slate-800">{vatModalTx.date}</span></div>
                                        <div className="flex flex-col"><span className="text-slate-400 font-bold">{t('history.type')}</span><span className={`font-black ${vatModalTx.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-rose-700'}`}>{vatModalTx.type}</span></div>
                                        {vatModalTx.buildingName && <div className="flex flex-col"><span className="text-slate-400 font-bold">{t('entry.building')}</span><span className="font-bold text-slate-700">{vatModalTx.buildingName}</span></div>}
                                        {vatModalTx.unitNumber && <div className="flex flex-col"><span className="text-slate-400 font-bold">{t('entry.unit')}</span><span className="font-bold text-slate-700">{vatModalTx.unitNumber}</span></div>}
                                        {vatModalTx.expenseCategory && <div className="flex flex-col"><span className="text-slate-400 font-bold">{t('entry.categoryShort')}</span><span className="font-bold text-slate-700">{vatModalTx.expenseCategory}</span></div>}
                                        {vatModalTx.details && <div className="col-span-2 flex flex-col"><span className="text-slate-400 font-bold">{t('common.details')}</span><span className="font-medium text-slate-600 truncate">{vatModalTx.details}</span></div>}
                                    </div>
                                </div>

                                {/* VAT Inclusion Toggle */}
                                <div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">How is the current amount entered?</div>
                                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                        <button type="button" onClick={() => setVatIsInclusive(true)}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${vatIsInclusive ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                            VAT Inclusive <span className="block text-[9px] font-medium opacity-70">VAT extracted from total</span>
                                        </button>
                                        <button type="button" onClick={() => setVatIsInclusive(false)}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${!vatIsInclusive ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                            VAT Exclusive <span className="block text-[9px] font-medium opacity-70">VAT added on top</span>
                                        </button>
                                    </div>
                                </div>

                                {/* VAT Breakdown */}
                                {vatBreakdown && (
                                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-4 space-y-2">
                                        <div className="text-[10px] font-black text-violet-600 uppercase tracking-wider mb-1">VAT Breakdown (15%)</div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Amount ex-VAT</span>
                                            <span className="font-black text-slate-800">{vatBreakdown.exclusive.toLocaleString()} SAR</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">VAT Amount (15%)</span>
                                            <span className="font-black text-violet-700">{vatBreakdown.vat.toLocaleString()} SAR</span>
                                        </div>
                                        <div className="flex justify-between text-sm pt-2 border-t border-violet-200">
                                            <span className="text-slate-800 font-black">Total inc. VAT</span>
                                            <span className="font-black text-lg text-violet-800">{vatBreakdown.inclusive.toLocaleString()} SAR</span>
                                        </div>
                                    </div>
                                )}

                                {/* Invoice Number */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        Invoice Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={vatInvoiceNumber}
                                        onChange={e => setVatInvoiceNumber(e.target.value)}
                                        placeholder="e.g. INV-2026-001"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1">Will be auto-generated if left blank</p>
                                </div>

                                {/* Customer VAT # for Income */}
                                {vatModalTx.type === TransactionType.INCOME && (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            Customer VAT Number
                                            <span className="text-[9px] font-medium text-amber-600 normal-case ml-1">(Required for B2B sales)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={vatCustomerVATNumber}
                                            onChange={e => setVatCustomerVATNumber(e.target.value)}
                                            placeholder="e.g. 31xxxxxxxxxxxxxx3"
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white font-mono"
                                        />
                                    </div>
                                )}

                                {/* Vendor Name + VAT for Expense */}
                                {vatModalTx.type === TransactionType.EXPENSE && (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">{t('vendor.name')}<span className="text-rose-500">*</span></label>
                                            <input
                                                type="text"
                                                value={vatVendorSearch}
                                                onChange={e => {
                                                    setVatVendorSearch(e.target.value);
                                                    setVatVendorDropdownOpen(true);
                                                    // If cleared, also clear VAT
                                                    if (!e.target.value) {
                                                        setVatVendorId('');
                                                        setVatVendorVATNumber('');
                                                    }
                                                }}
                                                onFocus={() => setVatVendorDropdownOpen(true)}
                                                placeholder="Search vendor name..."
                                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white"
                                            />
                                            {vatVendorDropdownOpen && vatVendorSearch && (() => {
                                                const filtered = vendors.filter(v =>
                                                    (v.nameEn || v.name || '').toLowerCase().includes(vatVendorSearch.toLowerCase()) ||
                                                    (v.name || '').toLowerCase().includes(vatVendorSearch.toLowerCase())
                                                ).slice(0, 8);
                                                if (filtered.length === 0) return null;
                                                return (
                                                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-orange-200 rounded-xl shadow-xl overflow-hidden">
                                                        {filtered.map(v => (
                                                            <button
                                                                key={v.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setVatVendorId(v.id);
                                                                    setVatVendorSearch(v.nameEn || v.name);
                                                                    setVatVendorVATNumber(v.vatNumber || v.vatNo || '');
                                                                    setVatVendorDropdownOpen(false);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                                                            >
                                                                <div>
                                                                    <div className="text-sm font-bold text-slate-800">{v.nameEn || v.name}</div>
                                                                    {v.serviceType && <div className="text-[10px] text-slate-400 font-medium">{v.serviceType}</div>}
                                                                </div>
                                                                {(v.vatNumber || v.vatNo) && (
                                                                    <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md font-mono shrink-0">VAT ✓</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                Vendor VAT Number
                                                {vatVendorVATNumber && <span className="text-[9px] font-medium text-emerald-600 normal-case">✓ auto-filled</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={vatVendorVATNumber}
                                                onChange={e => setVatVendorVATNumber(e.target.value)}
                                                placeholder="Auto-filled when vendor is selected"
                                                className={`w-full px-3 py-2.5 border rounded-xl text-sm font-bold outline-none focus:ring-2 bg-white font-mono transition-all ${vatVendorVATNumber ? 'border-emerald-300 focus:ring-emerald-400 bg-emerald-50/30' : 'border-slate-200 focus:ring-orange-400 focus:border-orange-400'}`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ZATCA Info for Income */}
                                {vatModalTx.type === TransactionType.INCOME && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle size={14} className="text-emerald-600"/>
                                            <span className="text-xs font-black text-emerald-800">ZATCA Compliance</span>
                                        </div>
                                        <p className="text-[10px] text-emerald-700 leading-relaxed">A ZATCA-compliant QR code will be generated and attached to this tax invoice. The transaction will appear in your VAT sales report.</p>
                                    </div>
                                )}

                                {/* Missing fields warnings */}
                                {vatMissingFields.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <AlertTriangle size={13} className="text-amber-600"/>
                                            <span className="text-[10px] font-black text-amber-800 uppercase">Optional fields missing</span>
                                        </div>
                                        {vatMissingFields.map(f => (
                                            <div key={f} className="flex items-center gap-1.5 text-[10px] text-amber-700 font-medium">
                                                <span className="w-1 h-1 rounded-full bg-amber-400 inline-block"/>
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6 pt-2 flex gap-3 bg-white border-t border-slate-100">
                                <button type="button" onClick={() => setShowVatModal(false)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">{t('common.cancel')}</button>
                                <button type="button" onClick={handleVatConvertSubmit} disabled={vatSaving}
                                    className={`flex-1 py-3 rounded-2xl text-white font-black shadow-lg transition-all disabled:opacity-60 ${vatModalTx.type === TransactionType.INCOME ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-200' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-200'}`}>
                                    {vatSaving ? '⏳ Saving...' : vatModalTx.type === TransactionType.INCOME ? '📊 Convert & Report to ZATCA' : '🧾 Convert to VAT Purchase'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Payment Method Modal */}
                {showEditPaymentModal && editPaymentTx && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full animate-slide-up">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{t('entry.paymentMethod')} Edit</h3>
                            <form onSubmit={(e) => { e.preventDefault(); handleEditPaymentSubmit(); }}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">{t('history.date')}</label>
                                        <input type="date" className="w-full border rounded p-2 mt-1" value={editTxDate} onChange={e => setEditTxDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">{t('entry.paymentMethod')}</label>
                                        <select className="w-full border rounded p-2 mt-1" value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value as PaymentMethod)} required>
                                            <option value="">Select</option>
                                            <option value={PaymentMethod.BANK}>{t('entry.bankTransfer')}</option>
                                            <option value={PaymentMethod.CASH}>{t('entry.cashShort')}</option>
                                            <option value={PaymentMethod.CHEQUE}>{t('entry.chequeShort')}</option>
                                        </select>
                                    </div>
                                    {editPaymentMethod === PaymentMethod.BANK && (
                                        <div>
                                            <label className="text-xs font-bold text-slate-500">{t('entry.selectBank')}</label>
                                            <select className="w-full border rounded p-2 mt-1" value={editBankName} onChange={e => setEditBankName(e.target.value)} required>
                                                <option value="">{t('entry.selectBankAccount')}</option>
                                                {banks.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {editPaymentMethod === PaymentMethod.CHEQUE && (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500">{t('entry.chequeNumber')}</label>
                                                <input className="w-full border rounded p-2 mt-1" value={editChequeNo} onChange={e => setEditChequeNo(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500">{t('entry.dueCashDate')}</label>
                                                <input type="date" className="w-full border rounded p-2 mt-1" value={editChequeDueDate} onChange={e => setEditChequeDueDate(e.target.value)} />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={() => setShowEditPaymentModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">{t('common.cancel')}</button>
                                    <button type="submit" className="flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-200">{t('history.saveChanges')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {showDeleteModal && txToDelete && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full animate-slide-up">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">
                                {(txToDelete as any).isCreditNote
                                  ? 'Delete Credit Note'
                                  : (txToDelete.isVATApplicable && txToDelete.type === TransactionType.INCOME)
                                    ? (Boolean((txToDelete as any).zatcaQRCode || (txToDelete as any).zatcaReportedAt)
                                        ? t('history.createCreditNote')
                                        : 'Delete Unreported VAT Invoice')
                                    : t('history.confirmDeletion')}
                            </h3>
                            <div className="mb-4 space-y-2 text-xs text-slate-700">
                                <div><b>Date:</b> {txToDelete.date}</div>
                                <div><b>Type:</b> {txToDelete.type}</div>
                                <div><b>Amount:</b> {txToDelete.amount?.toLocaleString()} SAR</div>
                                <div><b>Payment Method:</b> {fmtPaymentMethod(txToDelete)}</div>
                                {txToDelete.chequeNo && <div><b>Cheque No:</b> {txToDelete.chequeNo}</div>}
                                {txToDelete.chequeDueDate && <div><b>Cheque Due Date:</b> {txToDelete.chequeDueDate}</div>}
                                {txToDelete.details && <div><b>Details:</b> {txToDelete.details}</div>}
                                {txToDelete.buildingName && <div><b>Building:</b> {txToDelete.buildingName}</div>}
                                {txToDelete.unitNumber && <div><b>{t('history.unitShort')}</b> {txToDelete.unitNumber}</div>}
                                {txToDelete.expenseCategory && <div><b>Category:</b> {txToDelete.expenseCategory}</div>}
                                {txToDelete.vatAmount && <div><b>VAT:</b> {txToDelete.vatAmount}</div>}
                                {txToDelete.vatInvoiceNumber && <div><b>VAT Invoice #:</b> {txToDelete.vatInvoiceNumber}</div>}
                                {txToDelete.createdByName && <div><b>{t('history.createdBy')}</b> {txToDelete.createdByName}</div>}
                                {txToDelete.createdAt && <div><b>{t('history.createdAt')}</b> {txToDelete.createdAt}</div>}
                                {txToDelete.status && <div><b>Status:</b> {txToDelete.status}</div>}
                            </div>
                            {(txToDelete as any).isCreditNote ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-xs text-amber-800 font-bold mb-1">⚠ Temporary Delete Option</p>
                                        <p className="text-xs text-amber-700">This will move <b>both this credit note ({txToDelete.vatInvoiceNumber})</b> and the <b>original VAT transaction ({(txToDelete as any).originalInvoiceId})</b> to trash.</p>
                                    </div>
                                </div>
                            ) : (txToDelete.isVATApplicable && txToDelete.type === TransactionType.INCOME) ? (
                                <div className="space-y-3">
                                    {Boolean((txToDelete as any).zatcaQRCode || (txToDelete as any).zatcaReportedAt) ? (
                                        <>
                                            <p className="text-slate-600 text-sm">
                                                {t('history.vatTransactionWithInvoice', { invoice: txToDelete.vatInvoiceNumber })}
                                            </p>
                                            <p className="text-slate-600 text-sm">
                                                {t('history.zatcaCreditNoteInfo')}
                                            </p>
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-xs text-blue-800">
                                                    ? {t('history.originalInvoiceRetained')}<br/>
                                                    ? {t('history.creditNoteReverses')}<br/>
                                                    ? {t('history.bothAppearVatReport')}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                            <p className="text-xs text-emerald-800 font-bold mb-1">Unreported VAT Invoice</p>
                                            <p className="text-xs text-emerald-700">This VAT invoice has not been reported to ZATCA yet. It will be deleted directly (no credit note will be created).</p>
                                        </div>
                                    )}
                                </div>
                            ) : txToDelete.isVATApplicable ? (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-800 font-bold mb-1">⚠ Expense VAT Invoice</p>
                                    <p className="text-xs text-amber-700">This is a purchase/expense VAT entry. It will be moved to trash (no credit note needed for expenses).</p>
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm mb-6">{t('history.confirmPermanentDelete')}</p>
                            )}
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">{t('common.cancel')}</button>
                                <button onClick={handleDeleteConfirm} className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg ${
                                    (txToDelete as any).isCreditNote ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                                    : (txToDelete.isVATApplicable && txToDelete.type === TransactionType.INCOME)
                                      ? (Boolean((txToDelete as any).zatcaQRCode || (txToDelete as any).zatcaReportedAt)
                                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200')
                                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                                }`}>
                                    {(txToDelete as any).isCreditNote
                                      ? 'Delete Credit Note'
                                      : (txToDelete.isVATApplicable && txToDelete.type === TransactionType.INCOME)
                                        ? (Boolean((txToDelete as any).zatcaQRCode || (txToDelete as any).zatcaReportedAt)
                                            ? t('history.createCreditNote')
                                            : t('common.delete'))
                                        : t('common.delete')}
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

                {/* View More Modal */}
                {showViewModal && selectedTx && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slide-up">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
                                <h3 className="text-lg font-bold text-slate-800">{t('history.transactionDetails')}</h3>
                                <button onClick={closeView} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${
                                    selectedTx.type === TransactionType.INCOME
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : selectedTx.type === TransactionType.EXPENSE
                                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>{selectedTx.type}</span>
                                <span className="text-[11px] font-mono text-slate-600">{fmtDate(selectedTx.date)}</span>
                                {selectedTx.status && <span className="text-[10px] font-bold text-amber-600">{selectedTx.status}</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                <div className="p-3 bg-slate-50 rounded-lg border">
                                    <div className="text-[11px] text-slate-500 font-bold">{t('common.details')}</div>
                                    <div className="text-sm font-bold text-slate-800 break-words">{selectedTx.details || '-'}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border">
                                    <div className="text-[11px] text-slate-500 font-bold">{t('history.payment')}</div>
                                    <div className="text-sm text-slate-800 font-bold">{fmtPaymentMethod(selectedTx)}</div>
                                    {(selectedTx as any).fromBankName && (selectedTx as any).toBankName && (
                                        <div className="text-[11px] text-violet-700 mt-0.5">From <b>{(selectedTx as any).fromBankName}</b> → To <b>{(selectedTx as any).toBankName}</b></div>
                                    )}
                                    {selectedTx.chequeNo && <div className="text-[11px] text-indigo-700">Cheque #{selectedTx.chequeNo}</div>}
                                    {selectedTx.chequeDueDate && <div className="text-[11px] text-indigo-700">Due: {fmtDate(selectedTx.chequeDueDate)}</div>}
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <div className="text-[11px] text-emerald-800 font-bold">{t('common.amount')}</div>
                                    <div className="text-xl font-black text-emerald-900">{Number(selectedTx.amountIncludingVAT || selectedTx.totalWithVat || selectedTx.amount || 0).toLocaleString()} SAR</div>
                                    {selectedTx.isVATApplicable && selectedTx.vatAmount && selectedTx.vatAmount > 0 && (
                                        <div className="text-[11px] text-emerald-700 mt-1">incl. VAT {Number(selectedTx.vatAmount).toLocaleString()} SAR</div>
                                    )}
                                    {selectedTx.vatInvoiceNumber && <div className="text-[11px] text-emerald-700">{t('history.invoice')}: {selectedTx.vatInvoiceNumber}</div>}
                                    {selectedTx.type === TransactionType.EXPENSE && <div className="text-[11px] text-emerald-700">{t('history.expense')}</div>}
                                </div>
                                <div className="p-3 bg-white rounded-lg border">
                                    <div className="text-[11px] text-slate-500 font-bold">{t('history.building')}</div>
                                    <div className="text-sm font-bold text-slate-800">{getBuildingName(selectedTx.buildingId || (selectedTx as any).building) || selectedTx.buildingName || '-'}</div>
                                    {selectedTx.unitNumber && <div className="text-[11px] text-slate-700">{t('history.unit')}: {selectedTx.unitNumber}</div>}
                                </div>
                                <div className="p-3 bg-white rounded-lg border">
                                    <div className="text-[11px] text-slate-500 font-bold">{t('history.category')}</div>
                                    <div className="text-sm font-bold text-slate-800">{selectedTx.expenseCategory || '-'}</div>
                                    {selectedTx.employeeName && <div className="text-[11px] text-slate-700">{t('history.employee')}: {selectedTx.employeeName}</div>}
                                    {selectedTx.vendorName && <div className="text-[11px] text-slate-700">{t('history.vendor')}: {selectedTx.vendorName}</div>}
                                </div>
                                {selectedTx.serviceAgreementStartDate && selectedTx.serviceAgreementEndDate && (
                                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                        <div className="text-[11px] text-purple-800 font-bold">Contract Period</div>
                                        <div className="text-sm font-bold text-purple-900">{fmtDate(selectedTx.serviceAgreementStartDate)} - {fmtDate(selectedTx.serviceAgreementEndDate)}</div>
                                        {selectedTx.serviceAgreementName && <div className="text-[11px] text-purple-700">{selectedTx.serviceAgreementName}</div>}
                                    </div>
                                )}
                                {(selectedTx as any).installmentStartDate && (selectedTx as any).installmentEndDate && (
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="text-[11px] text-blue-800 font-bold">Installment #{(selectedTx as any).installmentNumber || ''} Period</div>
                                        <div className="text-sm font-bold text-blue-900">{fmtDate((selectedTx as any).installmentStartDate)} - {fmtDate((selectedTx as any).installmentEndDate)}</div>
                                    </div>
                                )}
                                <div className="p-3 bg-white rounded-lg border">
                                    <div className="text-[11px] text-slate-500 font-bold">{t('history.metadata')}</div>
                                    <div className="text-[11px] text-slate-700">{t('history.createdBy')}: {selectedTx.createdByName}</div>
                                    <div className="text-[11px] text-slate-700">{t('history.createdAt')}: {selectedTx.createdAt ? fmtDateTime(selectedTx.createdAt) : '-'}</div>
                                    <div className="text-[11px] text-slate-700">{t('history.id')}: {selectedTx.id}</div>
                                </div>
                            </div>
                            </div>
                            <div className="flex gap-2 justify-end p-6 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
                                {selectedTx.type === TransactionType.INCOME && (
                                    <>
                                        <button onClick={() => handlePrintReceipt(selectedTx)} className="px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold text-xs flex items-center gap-1"><Printer size={14}/>{t('common.print')}</button>
                                        <button onClick={() => handleWhatsApp(selectedTx)} className="px-3 py-2 text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 font-bold text-xs flex items-center gap-1"><MessageCircle size={14}/>{t('nav.whatsapp')}</button>
                                    </>
                                )}
                                <button onClick={closeView} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">{t('common.close')}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
    );
};

export default TransactionHistory;


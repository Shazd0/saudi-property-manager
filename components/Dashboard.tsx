import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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

import {
  PlusCircle,
  Users,
  FileSignature,
  Activity,
  Home,
  Building2,
  AlertCircle,
  Clock,
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Circle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  DollarSign,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Smartphone,
  CheckCircle,
  Sparkles,
  BookOpen,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Transaction, TransactionType, TransactionStatus, PaymentMethod, Contract, User, Building, UserRole } from '../types';
import { getTransactions, getContracts, getApprovals, getBuildings, getSettings, getCustomers, getTransfers, getDataFromBook } from '../services/firestoreService';
import { fmtDate } from '../utils/dateFormat';
import { formatNameWithRoom, buildCustomerRoomMap } from '../utils/customerDisplay';
import { useToast } from './Toast';
import { normalizePaymentMethod, normalizeTransactionType } from '../utils/transactionUtils';
import { useLanguage } from '../i18n';
import { useBook } from '../contexts/BookContext';

const COLORS = ['#059669', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

/** Returns Tailwind text-size class that fits the amount inside a card */
const amtSize = (n: number): string => {
  const len = Math.abs(n).toLocaleString().length;
  if (len <= 4) return 'text-base';
  if (len <= 6) return 'text-sm';
  if (len <= 9) return 'text-xs';
  return 'text-[10px]';
};

type UnitState = 'occupied' | 'expiring' | 'expired' | 'vacant';

const normalizeRole = (role: any) => String(role || '').toUpperCase();

/* ─── Color map used by AmountCard and StatMini ─── */
const colorMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
  amber:        { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   label: 'text-amber-600' },
  'amber-dark': { bg: 'bg-amber-100',  border: 'border-amber-300',   text: 'text-amber-900',   label: 'text-amber-700' },
  emerald:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', label: 'text-emerald-600' },
  green:        { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-800',   label: 'text-green-700' },
  rose:         { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-800',    label: 'text-rose-600' },
  'rose-dark':  { bg: 'bg-rose-100',   border: 'border-rose-200',    text: 'text-rose-800',    label: 'text-rose-700' },
  cyan:         { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-800',    label: 'text-cyan-600' },
  indigo:       { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800',  label: 'text-indigo-600' },
};

const Dashboard: React.FC<{ currentUser?: User }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { showError } = useToast();
  const { activeBookId, books: allBooks } = useBook();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [openingBalancesByBuilding, setOpeningBalancesByBuilding] = useState<Record<string, { cash: number; bank: number; date?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBuildingIds, setSelectedBuildingIds] = useStickyState<string[]>('dash_selectedBuildingIds', []);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useStickyState('dash_fromDate', '');
  const [toDate, setToDate] = useStickyState('dash_toDate', '');
  const [tillDate, setTillDate] = useStickyState('dash_tillDate', '');

  // Multi-book state (admin only)
  const [crossBookEnabled, setCrossBookEnabled] = useStickyState('dash_crossBook', false);
  const [selectedExtraBookIds, setSelectedExtraBookIds] = useStickyState<string[]>('dash_extraBookIds', []);
  const [extraBookBuildingFilter, setExtraBookBuildingFilter] = useStickyState<Record<string, string[]>>('dash_extraBookBldgFilter', {});
  const [extraBooksRawData, setExtraBooksRawData] = useState<Record<string, { buildings: any[]; transactions: any[]; contracts: any[] }>>({});
  const [extraBooksLoading, setExtraBooksLoading] = useState(false);
  const [showCrossBookPanel, setShowCrossBookPanel] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try { return sessionStorage.getItem('pwa_install_dismissed') === '1'; } catch { return false; }
  });
  const incomeChartRef = useRef<HTMLDivElement | null>(null);
  const paymentChartRef = useRef<HTMLDivElement | null>(null);
  const [incomeChartWidth, setIncomeChartWidth] = useState(0);
  const [paymentChartWidth, setPaymentChartWidth] = useState(0);

  useEffect(() => {
    const observers: ResizeObserver[] = [];

    const bindChartWidth = (
      element: HTMLDivElement | null,
      setWidth: React.Dispatch<React.SetStateAction<number>>
    ) => {
      if (!element) return;

      const updateWidth = () => {
        const nextWidth = Math.max(Math.floor(element.getBoundingClientRect().width), 0);
        setWidth(prev => (prev === nextWidth ? prev : nextWidth));
      };

      updateWidth();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(element);
        observers.push(observer);
      } else {
        window.addEventListener('resize', updateWidth);
        observers.push({ disconnect: () => window.removeEventListener('resize', updateWidth) } as ResizeObserver);
      }
    };

    bindChartWidth(incomeChartRef.current, setIncomeChartWidth);
    bindChartWidth(paymentChartRef.current, setPaymentChartWidth);

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [loading]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);

    const safetyTimeout = setTimeout(() => {
      console.warn('Dashboard load timeout reached');
      setLoading(false);
      setLoadError('Data loading timed out. Please check your connection and try again.');
    }, 15000);

    try {
      const actorId = (currentUser as any)?.id || (currentUser as any)?.uid || '';
      const actorRole = (currentUser as any)?.role || UserRole.ADMIN;
      const actorRoleKey = normalizeRole(actorRole);
      const userBuildingIds =
        (currentUser as any)?.buildingIds && (currentUser as any).buildingIds.length > 0
          ? (currentUser as any).buildingIds
          : currentUser?.buildingId
          ? [currentUser.buildingId]
          : [];

      const [txs, cons, apprs, blds, custs, appSettings, trsf] = await Promise.all([
        getTransactions({
          userId: actorId,
          role: actorRoleKey,
          buildingIds: userBuildingIds,
        } as any),
        getContracts(),
        getApprovals(),
        getBuildings(),
        getCustomers(),
        getSettings().catch(() => null),
        getTransfers({}),
      ]);

      clearTimeout(safetyTimeout);

      let resolvedTxs = txs || [];
      if ((!resolvedTxs || resolvedTxs.length === 0) && currentUser) {
        const allTxs = await getTransactions({ role: UserRole.ADMIN as any });
        if (actorRoleKey === UserRole.ADMIN || actorRoleKey === UserRole.MANAGER || !(currentUser as any)?.role) {
          resolvedTxs = allTxs || [];
        } else {
          resolvedTxs = (allTxs || []).filter((t: any) =>
            t.createdBy === actorId || t.createdById === actorId || t.userId === actorId
          );
        }
      }

      setTransactions((resolvedTxs || []).filter((t: any) => !t.vatReportOnly));
      setContracts(cons || []);
      setApprovals(apprs || []);
      setBuildings(blds || []);
      setCustomers(custs || []);
      setTransfers(trsf || []);
      setOpeningBalancesByBuilding(((appSettings as any)?.openingBalancesByBuilding || {}) as Record<string, { cash: number; bank: number; date?: string }>);

    } catch (error) {
      clearTimeout(safetyTimeout);
      console.error('Dashboard load error:', error);
      setLoadError('Failed to load dashboard data. Please try again.');
      showError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id, (currentUser as any)?.uid, (currentUser as any)?.role, (currentUser as any)?.buildingId, JSON.stringify((currentUser as any)?.buildingIds || [])]);

  useEffect(() => {
    const userBuildingIds = (currentUser as any)?.buildingIds && (currentUser as any).buildingIds.length > 0
      ? (currentUser as any).buildingIds
      : (currentUser?.buildingId ? [currentUser.buildingId] : []);

    if (userBuildingIds.length > 0 && selectedBuildingIds.length === 0) {
      setSelectedBuildingIds(userBuildingIds);
    }
  }, [currentUser?.id]);

  // No auto-refresh - data is loaded on mount and via manual Refresh button only

  /** Load data from extra books for cross-book view */
  const loadExtraBooks = useCallback(async (bookIds: string[]) => {
    const missing = bookIds.filter(id => !extraBooksRawData[id]);
    if (missing.length === 0) return;
    setExtraBooksLoading(true);
    const result: Record<string, any> = {};
    for (const bookId of missing) {
      try {
        const data = await getDataFromBook(bookId);
        result[bookId] = data;
      } catch (e) {
        console.error(`Failed to load extra book ${bookId}`, e);
      }
    }
    if (Object.keys(result).length > 0) {
      setExtraBooksRawData(prev => ({ ...prev, ...result }));
    }
    setExtraBooksLoading(false);
  }, [extraBooksRawData]);

  useEffect(() => {
    if (crossBookEnabled && selectedExtraBookIds.length > 0) {
      loadExtraBooks(selectedExtraBookIds);
    }
  }, [crossBookEnabled, selectedExtraBookIds]);

  // Compute merged data from all extra books
  const extraBooksMerged = useMemo(() => {
    if (!crossBookEnabled || selectedExtraBookIds.length === 0) {
      return { buildings: [] as any[], transactions: [] as any[], contracts: [] as any[] };
    }
    const blds: any[] = [];
    const txns: any[] = [];
    const cons: any[] = [];
    for (const bookId of selectedExtraBookIds) {
      const data = extraBooksRawData[bookId];
      if (!data) continue;
      const bookName = allBooks.find(b => b.id === bookId)?.name || bookId;
      const filter = extraBookBuildingFilter[bookId];
      const filteredBlds = filter && filter.length > 0
        ? data.buildings.filter((b: any) => filter.includes(b.id))
        : data.buildings;
      const allowedBldIds = new Set(filteredBlds.map((b: any) => b.id));
      blds.push(...filteredBlds.map((b: any) => ({ ...b, _fromBook: bookName, _bookId: bookId })));
      txns.push(...data.transactions.filter((t: any) => !t.buildingId || allowedBldIds.has(t.buildingId)));
      cons.push(...data.contracts.filter((c: any) => !c.buildingId || allowedBldIds.has(c.buildingId)));
    }
    return { buildings: blds, transactions: txns, contracts: cons };
  }, [crossBookEnabled, selectedExtraBookIds, extraBooksRawData, extraBookBuildingFilter, allBooks]);

  const allBuildings = useMemo(() => [...buildings, ...extraBooksMerged.buildings] as Building[], [buildings, extraBooksMerged.buildings]);
  const allContracts = useMemo(() => [...contracts, ...extraBooksMerged.contracts] as Contract[], [contracts, extraBooksMerged.contracts]);
  const allTransactions = useMemo(() => [...transactions, ...extraBooksMerged.transactions] as Transaction[], [transactions, extraBooksMerged.transactions]);


  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
    };

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsAppInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (installPrompt && !isMobile) {
      setInstallProgress(10);
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        let p = 20;
        const timer = setInterval(() => {
          p += Math.random() * 25 + 10;
          if (p >= 100) { p = 100; clearInterval(timer); setTimeout(() => setIsAppInstalled(true), 800); }
          setInstallProgress(Math.round(p));
        }, 300);
      } else {
        setInstallProgress(0);
      }
      setInstallPrompt(null);
    } else if (installPrompt && isMobile) {
      setInstallProgress(10);
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        let p = 20;
        const timer = setInterval(() => {
          p += Math.random() * 25 + 10;
          if (p >= 100) { p = 100; clearInterval(timer); setTimeout(() => setIsAppInstalled(true), 800); }
          setInstallProgress(Math.round(p));
        }, 300);
      } else {
        setInstallProgress(0);
      }
      setInstallPrompt(null);
    } else {
      setShowInstallGuide(true);
    }
  };

  const handleDismissInstall = () => {
    setInstallDismissed(true);
    try { sessionStorage.setItem('pwa_install_dismissed', '1'); } catch {}
  };

  // Note: saveTransfer already creates transaction records for HEAD_OFFICE transfers,
  // but we still inject pseudo-transactions for Building↔Owner transfers that lack a transaction record

  const approved = useMemo(
    () => {
      const isAdmin = (currentUser as any)?.role === UserRole.ADMIN;
      const isAdminOrManager = (currentUser as any)?.role === UserRole.ADMIN || (currentUser as any)?.role === UserRole.MANAGER;
      const userBuildingIds = (currentUser as any)?.buildingIds || ((currentUser as any)?.buildingId ? [(currentUser as any).buildingId] : []);

      const existingTreasuryIds = new Set(allTransactions.filter(t => (t as any).transferId).map(tx => (t as any).transferId));
      const buildingOwnerPseudo = (transfers || []).filter((tr: any) =>
        ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') || (tr.fromType === 'OWNER' && tr.toType === 'BUILDING'))
        && !tr.deleted && !existingTreasuryIds.has(tr.id)
      ).map((tr: any) => ({
        id: `pseudo_${tr.id}`,
        date: tr.date || '',
        type: tr.fromType === 'BUILDING' ? 'EXPENSE' : 'INCOME',
        amount: Number(tr.amount) || 0,
        paymentMethod: 'TREASURY',
        fromType: tr.fromType,
        toType: tr.toType,
        source: 'treasury',
        buildingId: tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : undefined),
        status: tr.status || 'APPROVED',
        expenseCategory: '',
        borrowingType: undefined,
      } as any));
      const allTxns = [...allTransactions, ...buildingOwnerPseudo];

      let approvedTxns = allTxns.filter(t => {
        if ((t as any).deleted) return false;
        if (t.paymentMethod === 'TREASURY_REVERSAL') return false;
        if ((t as any).source === 'treasury') {
          const ft = (t as any).fromType, tt = (t as any).toType;
          if ((ft === 'OWNER' && tt === 'HEAD_OFFICE') || (ft === 'HEAD_OFFICE' && tt === 'OWNER')) return false;
        }
        const status = String(t.status || TransactionStatus.APPROVED).toUpperCase();
        return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !t.status;
      });

      // All staff can view owner expenses

      // Filter borrowing opening balances: Admin/Manager see all, Staff see only their building's
      approvedTxns = approvedTxns.filter(t => {
        const isBorrowingOpeningBal = t.borrowingType === 'OPENING_BALANCE' || (t as any).isOwnerOpeningBalance;
        if (!isBorrowingOpeningBal) return true;

        // Owner opening balances pass through — they are excluded from balance calculations
        // by isOpeningBalance checks in prevMonthClosing and dashSummary, but included in ownerExpensesTotal
        if ((t as any).isOwnerOpeningBalance) return true;

        // Admin/Manager can see all borrowing opening balances
        if (isAdminOrManager) return true;

        // Staff can only see borrowing opening balances from their assigned building(s)
        if (userBuildingIds.length === 0) return false;
        return t.buildingId && userBuildingIds.includes(t.buildingId);
      });

      return approvedTxns;
    },
    [allTransactions, currentUser, transfers]
  );

  const filteredBuildings = useMemo(
    () => (selectedBuildingIds.length === 0 ? allBuildings : allBuildings.filter(b => selectedBuildingIds.includes(b.id))),
    [allBuildings, selectedBuildingIds]
  );

  const filteredContracts = useMemo(
    () => (selectedBuildingIds.length === 0 ? allContracts : allContracts.filter(c => selectedBuildingIds.includes(c.buildingId))),
    [allContracts, selectedBuildingIds]
  );

  const filteredApproved = useMemo(
    () => {
      if (selectedBuildingIds.length === 0) {
        return approved;
      }

      const selectedBuildingNames = new Set(
        allBuildings.filter(b => selectedBuildingIds.includes(b.id)).map(b => b.name)
      );

      return approved.filter(t => {
        const ownerCat = (t.expenseCategory || '').trim();
        const isOwnerType = ownerCat === 'Owner Expense' || ownerCat === 'Owner Profit Withdrawal' || ownerCat === 'Owner Opening Balance' || ownerCat === 'OWNER_EXPENSE' || (t as any).isOwnerOpeningBalance;
        if (isOwnerType) {
          const bId = String((t as any).buildingId || '');
          if (!bId) return false;
        }

        if ((t as any).buildingId && selectedBuildingIds.includes(String((t as any).buildingId))) {
          return true;
        }

        if (t.buildingName && selectedBuildingNames.has(t.buildingName)) {
          return true;
        }

        const altBuildingId = (t as any).building || (t as any).building_id;
        if (altBuildingId && selectedBuildingIds.includes(String(altBuildingId))) {
          return true;
        }

        return false;
      });
    },
    [approved, selectedBuildingIds, allBuildings]
  );

  const dateFilteredApproved = useMemo(() => {
    if (!fromDate && !toDate && !tillDate) return filteredApproved;
    return filteredApproved.filter(t => {
      if (!t.date) return false;
      if (tillDate) return t.date <= tillDate;
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      return true;
    });
  }, [filteredApproved, fromDate, toDate, tillDate]);

  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);
  const currentMonthEnd = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, []);

  const effectiveDateFrom = tillDate ? '2000-01-01' : (fromDate || currentMonthStart);
  const effectiveDateTo = tillDate || toDate || currentMonthEnd;

  const prevMonthClosing = useMemo(() => {
    const cutoff = effectiveDateFrom.substring(0, 8) + '01';
    let prevTxns = filteredApproved.filter(t => t.date && t.date < cutoff);

    let cashBal = 0, bankBal = 0, totalBal = 0;
    Object.entries(openingBalancesByBuilding || {}).forEach(([buildingId, row]) => {
      if (selectedBuildingIds.length > 0 && !selectedBuildingIds.includes(buildingId)) return;
      const c = Number((row as any).cash) || 0;
      const b = Number((row as any).bank) || 0;
      cashBal += c;
      bankBal += b;
      totalBal += c + b;
    });
    const isOpeningBalance = (t: Transaction) =>
      t.borrowingType === 'OPENING_BALANCE' ||
      (t as any).isOwnerOpeningBalance === true ||
      t.expenseCategory === 'Owner Opening Balance';
    for (const t of prevTxns) {
      if (isOpeningBalance(t)) continue;
      const amt = Number(t.amount) || 0;
      const isIncome = normalizeTransactionType(t.type) === TransactionType.INCOME;
      const rawMethod = String(t.paymentMethod || '').toUpperCase();
      const isCash = rawMethod === 'CASH' || rawMethod === 'TREASURY';
      const isBank = rawMethod === 'BANK' || rawMethod === 'CHEQUE';
      const netAmt = isIncome ? amt : -amt;
      totalBal += netAmt;
      if (isCash) cashBal += netAmt;
      else if (isBank) bankBal += netAmt;
    }
    return { cash: cashBal, bank: bankBal, total: totalBal };
  }, [filteredApproved, effectiveDateFrom, openingBalancesByBuilding, selectedBuildingIds]);

  const dashSummary = useMemo(() => {
    let txns = dateFilteredApproved;
    if (!fromDate && !toDate && !tillDate) {
      txns = txns.filter(t => t.date && t.date >= currentMonthStart && t.date <= currentMonthEnd);
    }

    const isOpeningBalance = (r: Transaction) =>
      r.borrowingType === 'OPENING_BALANCE' ||
      (r as any).isOwnerOpeningBalance === true ||
      r.expenseCategory === 'Owner Opening Balance';
    const incomeRows = txns.filter(r => normalizeTransactionType(r.type) === TransactionType.INCOME && !isOpeningBalance(r));
    const expenseRows = txns.filter(r => normalizeTransactionType(r.type) === TransactionType.EXPENSE && !isOpeningBalance(r));
    const sumAmt = (rows: Transaction[]) => rows.reduce((s, r) => s + (Number(r.amountIncludingVAT || (r as any).totalWithVat || r.amount) || 0), 0);
    // Use originalPaymentMethod for treasury-linked transactions so BANK/CHEQUE
    // treasury transfers are classified correctly instead of falling into Cash.
    const effM = (r: any) => String((r as any).originalPaymentMethod || r.paymentMethod || '').toUpperCase();
    const ci = sumAmt(incomeRows.filter(r => { const m = effM(r); return m === 'CASH' || m === 'TREASURY'; }));
    const bi = sumAmt(incomeRows.filter(r => { const m = effM(r); return m === 'BANK' || m === 'CHEQUE'; }));
    const ce = Math.abs(sumAmt(expenseRows.filter(r => { const m = effM(r); return m === 'CASH' || m === 'TREASURY'; })));
    const be = Math.abs(sumAmt(expenseRows.filter(r => { const m = effM(r); return m === 'BANK' || m === 'CHEQUE'; })));
    const it = sumAmt(incomeRows);
    const et = sumAmt(expenseRows);
    const cashBal = prevMonthClosing.cash + ci - ce;
    const bankBal = prevMonthClosing.bank + bi - be;
    return {
      cashIncome: ci, bankIncome: bi, incomeTotal: it,
      cashExpense: ce, bankExpense: be, expenseTotal: et,
      cashBalance: cashBal,
      bankBalance: bankBal,
      totalNet: prevMonthClosing.total + it - et,
    };
  }, [dateFilteredApproved, currentMonthStart, currentMonthEnd, prevMonthClosing, fromDate, toDate, tillDate]);

  const treasurySummary = useMemo(() => {
    const activeTransfers = transfers.filter((t: any) => t.status === 'COMPLETED' && !t.deleted);
    const allBuildingsSelected = selectedBuildingIds.length === 0 || selectedBuildingIds.length >= allBuildings.length;

    const buildingFilteredTransfers = allBuildingsSelected
      ? activeTransfers
      : activeTransfers.filter((t: any) => {
          const fromBId = t.fromBuildingId || '';
          const toBId = t.toBuildingId || '';
          return (fromBId && selectedBuildingIds.includes(fromBId)) || (toBId && selectedBuildingIds.includes(toBId));
        });

    const periodStart = effectiveDateFrom;
    const periodEnd = effectiveDateTo;
    const openingCutoff = periodStart.substring(0, 8) + '01';

    const officeOpeningBalance = allBuildingsSelected
      ? activeTransfers
          .filter((t: any) => t.isOfficeOpeningBalance)
          .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      : 0;

    const priorIn = buildingFilteredTransfers
      .filter((t: any) => t.toType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance && (t.date || '') < openingCutoff)
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    const priorOut = buildingFilteredTransfers
      .filter((t: any) => t.fromType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance && (t.date || '') < openingCutoff)
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    const priorHeadExpenses = filteredApproved
      .filter((t: Transaction) => t.expenseCategory === 'Head Office Expense' && (t.date || '') < openingCutoff)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const openingTotal = officeOpeningBalance + priorIn - priorOut - priorHeadExpenses;

    const totalIn = buildingFilteredTransfers
      .filter((t: any) => t.toType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance && (t.date || '') >= periodStart && (t.date || '') <= periodEnd)
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const totalOut = buildingFilteredTransfers
      .filter((t: any) => t.fromType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance && (t.date || '') >= periodStart && (t.date || '') <= periodEnd)
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const headOfficeExpenses = filteredApproved
      .filter((t: Transaction) => t.expenseCategory === 'Head Office Expense' && (t.date || '') >= periodStart && (t.date || '') <= periodEnd)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const netBalance = openingTotal + totalIn - totalOut - headOfficeExpenses;

    return { officeOpeningBalance: openingTotal, totalIn, totalOut, headOfficeExpenses, netBalance };
  }, [transfers, filteredApproved, effectiveDateFrom, effectiveDateTo, selectedBuildingIds, buildings]);

  const ownerExpensesTotal = useMemo(() => {
    const periodStart = effectiveDateFrom;
    const periodEnd = effectiveDateTo;
    const openingCutoff = periodStart.substring(0, 8) + '01';

    const ownerExpenses = filteredApproved.filter(t =>
      t.type === TransactionType.EXPENSE && (
        (t.expenseCategory || '').trim() === 'Owner Expense' ||
        (t.expenseCategory || '').trim() === 'Owner Profit Withdrawal' ||
        (t.expenseCategory || '').trim() === 'OWNER_EXPENSE' ||
        (t.expenseCategory || '').trim() === 'Owner Opening Balance' ||
        (t as any).isOwnerOpeningBalance
      )
    );

    let openingBalance = 0;
    let thisMonth = 0;

    ownerExpenses.forEach(t => {
      const txDate = t.date || '';
      const amt = Number(t.amount) || 0;
      if (txDate >= periodStart && txDate <= periodEnd) {
        thisMonth += amt;
      } else if (txDate < openingCutoff) {
        openingBalance += amt;
      }
    });

    const activeTransfers = transfers.filter((t: any) => t.status === 'COMPLETED' && !t.deleted);
    const allBuildingsSelected = selectedBuildingIds.length === 0 || selectedBuildingIds.length >= allBuildings.length;
    const ownerTransfers = allBuildingsSelected
      ? activeTransfers.filter((tr: any) => tr.fromType === 'HEAD_OFFICE' && tr.toType === 'OWNER')
      : [];

    ownerTransfers.forEach((tr: any) => {
      const txDate = tr.date || '';
      const amt = Number(tr.amount) || 0;
      if (txDate >= periodStart && txDate <= periodEnd) {
        thisMonth += amt;
      } else if (txDate < openingCutoff) {
        openingBalance += amt;
      }
    });

    const ownerReturns = allBuildingsSelected
      ? activeTransfers.filter((tr: any) => tr.fromType === 'OWNER' && tr.toType === 'HEAD_OFFICE')
      : [];

    ownerReturns.forEach((tr: any) => {
      const txDate = tr.date || '';
      const amt = Number(tr.amount) || 0;
      if (txDate >= periodStart && txDate <= periodEnd) {
        thisMonth -= amt;
      } else if (txDate < openingCutoff) {
        openingBalance -= amt;
      }
    });

    return { openingBalance, thisMonth, total: openingBalance + thisMonth };
  }, [filteredApproved, transfers, selectedBuildingIds, allBuildings, effectiveDateFrom, effectiveDateTo]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number; net: number }> = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        income: 0,
        expense: 0,
        net: 0,
      };
    }

    dateFilteredApproved.forEach(t => {
      const dt = new Date(t.date);
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) return;
      const ownerCat = (t.expenseCategory || '').trim();
      const isOwnerExp = ownerCat === 'Owner Expense' || ownerCat === 'Owner Profit Withdrawal';
      if (t.type === TransactionType.INCOME) months[key].income += Number(t.amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0;
      if (t.type === TransactionType.EXPENSE && !isOwnerExp) months[key].expense += Number(t.amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0;
      months[key].net = months[key].income - months[key].expense;
    });

    return Object.values(months);
  }, [dateFilteredApproved]);

  const paymentMethodData = useMemo(() => {
    const methods: Record<string, { income: number; expense: number }> = { BANK: { income: 0, expense: 0 }, CASH: { income: 0, expense: 0 }, CHEQUE: { income: 0, expense: 0 } };
    dateFilteredApproved.forEach(t => {
      const method = normalizePaymentMethod(t.paymentMethod) || 'OTHER';
      if (!methods[method]) methods[method] = { income: 0, expense: 0 };
      const isIncome = normalizeTransactionType(t.type) === TransactionType.INCOME;
      const ownerCat = (t.expenseCategory || '').trim();
      const isOwnerExp = ownerCat === 'Owner Expense' || ownerCat === 'Owner Profit Withdrawal';
      if (isIncome) {
        methods[method].income += Number(t.amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0;
      } else if (!isOwnerExp) {
        methods[method].expense += Number(t.amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0;
      }
    });
    return Object.entries(methods)
      .filter(([, v]) => v.income > 0 || v.expense > 0)
      .map(([name, v]) => ({ name, income: v.income, expense: v.expense }));
  }, [dateFilteredApproved]);

  const customerRoomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);
  const formatContractCustomer = useCallback((c: { customerId?: string; customerName?: string } | null | undefined): string => {
    if (!c) return '';
    const room = c.customerId ? customerRoomMap[c.customerId] : undefined;
    return formatNameWithRoom(c.customerName || '', room);
  }, [customerRoomMap]);

  const unitHeatmap = useMemo(() => {
    const today = new Date();

    // Natural alphanumeric sort: A101 < A102 < B101 < C101 etc.
    const naturalSort = (a: string, b: string) => {
      const re = /([A-Za-z]*)(\d*)(.*)/;
      const pa = a.match(re) || ['', '', '', ''];
      const pb = b.match(re) || ['', '', '', ''];
      if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1]);
      const na = parseInt(pa[2]) || 0;
      const nb = parseInt(pb[2]) || 0;
      if (na !== nb) return na - nb;
      return (pa[3] || '').localeCompare(pb[3] || '');
    };

    return filteredBuildings.map(building => {
      const processedUnits = new Set<string>();
      const unitEntries: { name: string; state: UnitState; contractInfo: { allUnits: string; customerName: string; toDate: string } | null }[] = [];

      const buildingContracts = filteredContracts.filter(c => c.buildingId === building.id);
      const multiUnitContracts = buildingContracts.filter(c => c.unitName && c.unitName.includes(','));

      for (const contract of multiUnitContracts) {
        const contractUnits = contract.unitName.split(',').map(u => u.trim());
        if (contractUnits.some(u => processedUnits.has(u))) continue;

        contractUnits.forEach(u => processedUnits.add(u));

        let state: UnitState = 'vacant';
        if (contract.status === 'Active') {
          const daysLeft = Math.ceil((new Date(contract.toDate).getTime() - today.getTime()) / 86400000);
          state = daysLeft <= 60 ? 'expiring' : 'occupied';
        } else if (new Date(contract.toDate).getTime() < today.getTime()) {
          state = 'expired';
        }

        unitEntries.push({
          name: contractUnits.join(' + '),
          state,
          contractInfo: {
            allUnits: contract.unitName,
            customerName: formatContractCustomer(contract),
            toDate: contract.toDate,
          }
        });
      }

      for (const unit of (building.units || [])) {
        if (processedUnits.has(unit.name)) continue;

        const unitContracts = buildingContracts.filter(
          c => c.unitName === unit.name
        );

        const activeContract = unitContracts
          .filter(c => c.status === 'Active')
          .sort((a, b) => new Date(b.toDate).getTime() - new Date(a.toDate).getTime())[0];

        let state: UnitState = 'vacant';
        let contractInfo: { allUnits: string; customerName: string; toDate: string } | null = null;

        if (activeContract) {
          const daysLeft = Math.ceil((new Date(activeContract.toDate).getTime() - today.getTime()) / 86400000);
          state = daysLeft <= 60 ? 'expiring' : 'occupied';
          contractInfo = {
            allUnits: activeContract.unitName || unit.name,
            customerName: formatContractCustomer(activeContract),
            toDate: activeContract.toDate,
          };
        } else {
          const latest = unitContracts
            .slice()
            .sort((a, b) => new Date(b.toDate).getTime() - new Date(a.toDate).getTime())[0];
          if (latest && new Date(latest.toDate).getTime() < today.getTime()) {
            state = 'expired';
            contractInfo = {
              allUnits: latest.unitName || unit.name,
              customerName: formatContractCustomer(latest),
              toDate: latest.toDate,
            };
          }
        }

        unitEntries.push({ name: unit.name, state, contractInfo });
      }

      const sortedUnits = unitEntries.sort((a, b) => naturalSort(a.name, b.name));

      return {
        id: building.id,
        name: building.name,
        fromBook: (building as any)._fromBook as string | undefined,
        units: sortedUnits,
      };
    });
  }, [filteredBuildings, filteredContracts, formatContractCustomer]);

  useEffect(() => {
    if (!unitHeatmap.length) return;
    setExpandedBuildings(new Set(unitHeatmap.map(b => b.id)));
  }, [unitHeatmap]);

  const pendingApprovals = useMemo(() => {
    const scoped = selectedBuildingIds.length === 0
      ? approvals
      : approvals.filter((a: any) =>
          selectedBuildingIds.includes(a?.buildingId) ||
          selectedBuildingIds.includes(a?.building) ||
          selectedBuildingIds.includes(a?.targetBuildingId)
        );
    return scoped.slice(0, 5);
  }, [approvals, selectedBuildingIds]);

  const occupancyStats = useMemo(() => {
    const totalUnits = unitHeatmap.reduce((sum, b) => sum + b.units.length, 0);
    const occupiedUnits = unitHeatmap.reduce(
      (sum, b) => sum + b.units.filter(u => u.state === 'occupied' || u.state === 'expiring').length,
      0
    );
    const percentage = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    return { totalUnits, occupiedUnits, percentage };
  }, [unitHeatmap]);

  const dropdownBuildings = useMemo(() => {
    const q = buildingSearch.trim().toLowerCase();
    return (allBuildings || [])
      .filter((b: any) => !(b as any).deleted)
      .filter((b: any) => !q || String(b.name || '').toLowerCase().includes(q))
      .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [allBuildings, buildingSearch]);

  const unitStateCounts = useMemo(() => {
    let occupied = 0, expiring = 0, expired = 0, vacant = 0;
    for (const b of unitHeatmap) {
      for (const u of b.units) {
        if (u.state === 'occupied') occupied++;
        else if (u.state === 'expiring') expiring++;
        else if (u.state === 'expired') expired++;
        else vacant++;
      }
    }
    return { occupied, expiring, expired, vacant };
  }, [unitHeatmap]);

  const greeting = new Date().getHours() < 12 ? t('dashboard.greeting.morning') : t('dashboard.greeting.evening');

  return (
    /*
     * ROOT FIX: width:100% + overflow-x:hidden + box-sizing:border-box
     * These three together guarantee NOTHING escapes the screen horizontally.
     */
    <div
      className="mobile-tab-shell tab-dashboard space-y-4 animate-fade-in pb-20 overflow-x-hidden w-full max-w-full"
      style={{ touchAction: 'pan-y' }}
    >
      {/* ── Install App Banner ── */}
      {!isAppInstalled && !installDismissed && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-xl shadow-indigo-200/50 animate-fade-in">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>

          <div className="relative z-10 p-3 sm:p-5">
            {installProgress === 0 ? (
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                  <Smartphone size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <h3 className="text-xs font-black text-white">{t('dashboard.installApp')}</h3>
                    <span className="px-1 py-0.5 text-[8px] font-bold bg-yellow-400 text-yellow-900 rounded-full uppercase">{t('history.free')}</span>
                  </div>
                  <p className="text-[10px] text-blue-100 leading-tight line-clamp-2">{t('dashboard.installDesc')}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <button onClick={handleInstallApp} className="px-2.5 py-2 bg-white text-indigo-700 rounded-xl text-[11px] font-black hover:bg-blue-50 transition-all active:scale-95 shadow-lg">
                    <div className="flex items-center gap-1"><Download size={11} /><span>{t('dashboard.install')}</span></div>
                  </button>
                  <button onClick={handleDismissInstall} className="p-1 text-white/50 hover:text-white/90 transition">
                    <span className="text-base leading-none">&times;</span>
                  </button>
                </div>
              </div>
            ) : installProgress < 100 ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center border border-white/20">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-black text-white">{t('dashboard.installing')}</h3>
                    <span className="text-xs font-bold text-blue-200">{installProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-500" style={{ width: `${installProgress}%` }}></div>
                  </div>
                  <p className="text-[10px] text-blue-200 mt-1">{t('dashboard.settingUp')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 bg-emerald-400/30 rounded-2xl flex items-center justify-center border border-emerald-300/30">
                  <CheckCircle size={18} className="text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-white">{t('dashboard.installed')}</h3>
                    <Sparkles size={13} className="text-yellow-300" />
                  </div>
                  <p className="text-[10px] text-emerald-200">{t('dashboard.installedDesc')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      {/*
       * MOBILE FIX: overflow changed to 'visible' so the building-picker
       * dropdown is NOT clipped. Decorative circles are moved into their own
       * absolute inset-0 overflow-hidden wrapper so they are still clipped to
       * the card boundary while the dropdown can escape downward.
       */}
      <div className="page-header page-header-emerald dashboard-page-header !mb-0" style={{ overflow: 'visible' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 'inherit' }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
        </div>
        <div className="relative z-10">

          {/* Row 1: title + refresh */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm flex-shrink-0">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="ph-title tracking-tight text-base sm:text-xl leading-tight">{t('dashboard.title')}</h1>
                <p className="text-emerald-100 text-[10px] font-medium mt-0.5 flex items-center gap-1 truncate">
                  {new Date().getHours() < 12 ? <Sun size={10} className="flex-shrink-0" /> : <Moon size={10} className="flex-shrink-0" />}
                  <span className="truncate">{greeting}, {currentUser?.name?.split(' ')[0] || 'Admin'} — {language === 'ar' ? new Date().toLocaleDateString('ar-SA', { day: '2-digit', month: 'long', year: 'numeric' }) : fmtDate(new Date())}</span>
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition backdrop-blur-sm"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
            </button>
          </div>

          {/* Row 2: building picker — full width */}
          <div className="relative mb-3">
            <button
              type="button"
              onClick={() => setShowBuildingPicker(v => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/30 bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition backdrop-blur-sm w-full"
              style={{ maxWidth: '100%' }}
            >
              <Building2 size={13} className="flex-shrink-0" />
              <span className="flex-1 truncate text-left min-w-0">
                {selectedBuildingIds.length === 0
                  ? 'All Buildings'
                  : selectedBuildingIds.length <= 2
                  ? allBuildings.filter(b => selectedBuildingIds.includes(b.id)).map(b => b.name).join(', ')
                  : `${selectedBuildingIds.length} Buildings`}
                {crossBookEnabled && selectedExtraBookIds.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-400/40 rounded text-[9px] font-black">
                    +{selectedExtraBookIds.length} book{selectedExtraBookIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${showBuildingPicker ? 'rotate-180' : ''}`} />
            </button>

            {showBuildingPicker && (
              <div
                className="absolute left-0 right-0 mt-2 rounded-2xl border border-emerald-100 bg-white/95 backdrop-blur shadow-2xl z-50 p-3"
                style={{ maxWidth: '100%' }}
              >
                <input
                  type="text"
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  placeholder="Search building..."
                  className="w-full mb-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setSelectedBuildingIds([])}
                  className="w-full mb-2 px-3 py-2 text-left text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >{t('history.allBuildings')}</button>
                <div className="max-h-[40vh] overflow-auto space-y-1 pr-1">
                  {dropdownBuildings.map(b => {
                    const checked = selectedBuildingIds.includes(b.id);
                    const bookLabel = (b as any)._fromBook;
                    return (
                      <label key={b.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedBuildingIds(prev =>
                              prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                            );
                          }}
                          className="accent-emerald-600"
                        />
                        <span className={`text-xs font-semibold flex-1 ${checked ? 'text-emerald-700' : 'text-slate-700'}`}>{b.name}</span>
                        {bookLabel && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded font-bold truncate max-w-[80px]">{bookLabel}</span>}
                      </label>
                    );
                  })}
                  {dropdownBuildings.length === 0 && (
                    <div className="px-2 py-3 text-xs text-slate-500">No buildings found</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowBuildingPicker(false)}
                  className="w-full mt-3 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >{t('task.done')}</button>
              </div>
            )}
          </div>

          {/* Cross-Book Panel — Admin only */}
          {currentUser?.role === UserRole.ADMIN && allBooks.filter(b => b.id !== activeBookId).length > 0 && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowCrossBookPanel(v => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition backdrop-blur-sm w-full ${crossBookEnabled && selectedExtraBookIds.length > 0 ? 'border-indigo-400/60 bg-indigo-500/30 text-white' : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/15'}`}
              >
                <Layers size={13} className="flex-shrink-0" />
                <span className="flex-1 text-left">Multi-Book View</span>
                {crossBookEnabled && selectedExtraBookIds.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-indigo-400 rounded text-[9px] font-black text-white">
                    {selectedExtraBookIds.length} book{selectedExtraBookIds.length > 1 ? 's' : ''} active
                  </span>
                )}
                {extraBooksLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />}
                <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${showCrossBookPanel ? 'rotate-180' : ''}`} />
              </button>

              {showCrossBookPanel && (
                <div className="mt-2 rounded-2xl border border-indigo-100 bg-white/95 backdrop-blur shadow-2xl z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} className="text-indigo-600" />
                      <span className="text-sm font-black text-slate-800">Multi-Book View</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-slate-500 font-medium">Enable</span>
                      <div
                        onClick={() => {
                          const next = !crossBookEnabled;
                          setCrossBookEnabled(next);
                          if (!next) setSelectedExtraBookIds([]);
                        }}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${crossBookEnabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${crossBookEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  </div>

                  {crossBookEnabled && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500">Select books to include their buildings & data in this dashboard view.</p>
                      {allBooks.filter(b => b.id !== activeBookId).map(book => {
                        const isSelected = selectedExtraBookIds.includes(book.id);
                        const bookData = extraBooksRawData[book.id];
                        const bookBuildings = bookData?.buildings || [];
                        const filter = extraBookBuildingFilter[book.id] || [];

                        return (
                          <div key={book.id} className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedExtraBookIds(prev => prev.filter(id => id !== book.id));
                                    setExtraBookBuildingFilter(prev => { const n = { ...prev }; delete n[book.id]; return n; });
                                  } else {
                                    setSelectedExtraBookIds(prev => [...prev, book.id]);
                                    loadExtraBooks([book.id]);
                                  }
                                }}
                                className="accent-indigo-600 w-4 h-4"
                              />
                              <span className="text-sm font-bold text-slate-800 flex-1">{book.name}</span>
                              {bookData && <span className="text-[10px] text-slate-400 font-medium">{bookBuildings.length} buildings</span>}
                              {!bookData && isSelected && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />}
                            </div>

                            {isSelected && bookBuildings.length > 0 && (
                              <div className="ml-6 space-y-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={filter.length === 0}
                                    onChange={() => setExtraBookBuildingFilter(prev => ({ ...prev, [book.id]: [] }))}
                                    className="accent-indigo-500 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs text-indigo-700 font-bold">All buildings from this book</span>
                                </label>
                                <div className="max-h-32 overflow-auto space-y-1">
                                  {bookBuildings.map((b: any) => {
                                    const bChecked = filter.length === 0 || filter.includes(b.id);
                                    return (
                                      <label key={b.id} className="flex items-center gap-2 cursor-pointer pl-1">
                                        <input
                                          type="checkbox"
                                          checked={bChecked}
                                          onChange={() => {
                                            setExtraBookBuildingFilter(prev => {
                                              const current = prev[book.id] && prev[book.id].length > 0
                                                ? prev[book.id]
                                                : bookBuildings.map((x: any) => x.id);
                                              const next = bChecked
                                                ? current.filter((id: string) => id !== b.id)
                                                : [...current, b.id];
                                              return { ...prev, [book.id]: next };
                                            });
                                          }}
                                          className="accent-indigo-500 w-3.5 h-3.5"
                                        />
                                        <span className="text-xs text-slate-700">{b.name}</span>
                                        <span className="text-[10px] text-slate-400">{(b.units || []).length} units</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {selectedExtraBookIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedExtraBookIds([]); setExtraBookBuildingFilter({}); }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
                        >Clear all extra books</button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCrossBookPanel(false)}
                    className="w-full mt-3 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                  >Done</button>
                </div>
              )}
            </div>
          )}

          {/* Row 3: date filters — 2×2 grid on mobile, 4 cols on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 dash-date-bar">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-white/70 mb-1">{t('history.fromDate')}</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl bg-white/90 text-slate-800 text-[11px] font-bold border border-white/30 outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-white/70 mb-1">{t('history.toDate')}</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl bg-white/90 text-slate-800 text-[11px] font-bold border border-white/30 outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-emerald-200 mb-1">{t('dashboard.allTillDate')}</label>
              <input type="date" value={tillDate} onChange={e => setTillDate(e.target.value)}
                className={`w-full px-2 py-1.5 rounded-xl bg-white/90 text-slate-800 text-[11px] font-bold outline-none focus:ring-2 focus:ring-emerald-300 ${tillDate ? 'border-2 border-emerald-400' : 'border border-white/30'}`} />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); setTillDate(''); sessionStorage.removeItem('dash_fromDate'); sessionStorage.removeItem('dash_toDate'); sessionStorage.removeItem('dash_tillDate'); }}
                className="w-full px-2 py-1.5 rounded-xl bg-white/20 text-white text-[11px] font-black hover:bg-white/30 border border-white/20 transition"
              >{t('history.clear')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <p className="text-emerald-700 font-medium">{t('dashboard.loading')}</p>
        </div>
      )}

      {/* ── Error ── */}
      {loadError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-rose-700 font-medium mb-2">{loadError}</p>
          <button onClick={loadData} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition">{t('dashboard.retry')}</button>
        </div>
      )}

      {!loading && (
      <>
      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 dash-qa-grid">
        <ActionButton icon={<PlusCircle size={18} />} label={t('dashboard.newEntry')} onClick={() => navigate('/entry')} />
        <ActionButton icon={<FileSignature size={18} />} label={t('nav.contracts')} onClick={() => navigate('/contracts')} />
        <ActionButton icon={<Users size={18} />} label={t('dashboard.tenants')} onClick={() => navigate('/customers')} />
        <ActionButton icon={<Activity size={18} />} label={t('nav.reports')} onClick={() => navigate('/reports')} />
      </div>

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-800 mb-4">{t('dashboard.installGuide.title')}</h3>
            <div className="space-y-3 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm font-bold text-green-900 mb-2">{t('dashboard.installGuide.android')}</p>
                <ol className="text-xs text-green-700 space-y-1">
                  <li>{t('dashboard.installGuide.androidStep1')}</li>
                  <li>{t('dashboard.installGuide.androidStep2')}</li>
                  <li>{t('dashboard.installGuide.androidStep3')}</li>
                </ol>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm font-bold text-blue-900 mb-2">{t('dashboard.installGuide.ios')}</p>
                <ol className="text-xs text-blue-700 space-y-1">
                  <li>{t('dashboard.installGuide.iosStep1')}</li>
                  <li>{t('dashboard.installGuide.iosStep2')}</li>
                  <li>{t('dashboard.installGuide.iosStep3')}</li>
                </ol>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm font-bold text-emerald-900 mb-2">{t('dashboard.installGuide.desktop')}</p>
                <ol className="text-xs text-emerald-700 space-y-1">
                  <li>{t('dashboard.installGuide.desktopStep1')}</li>
                  <li>{t('dashboard.installGuide.desktopStep2')}</li>
                  <li>{t('dashboard.installGuide.desktopStep3')}</li>
                </ol>
              </div>
            </div>
            <button onClick={() => setShowInstallGuide(false)} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all active:scale-95">{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* ── Financial Summary ── */}
      <div className="premium-card overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <DollarSign className="text-white" size={14} />
            </div>
            {t('dashboard.financialSummary')}
          </h3>
        </div>
        <div className="p-3 sm:p-5 space-y-2">

          {/* Always 3 equal columns — AmountCard handles its own sizing */}
          <div className="grid grid-cols-3 gap-1.5 dash-fin-grid">
            <AmountCard label={t('dashboard.openingCash')} value={prevMonthClosing.cash} colorClass="amber" />
            <AmountCard label={t('dashboard.openingBank')} value={prevMonthClosing.bank} colorClass="amber" />
            <AmountCard label={t('dashboard.totalOpening')} value={prevMonthClosing.total} colorClass="amber-dark" />
          </div>

          <div className="grid grid-cols-3 gap-1.5 dash-fin-grid">
            <AmountCard label={t('history.cashIncome')} value={dashSummary.cashIncome} colorClass="emerald" />
            <AmountCard label={t('history.bankIncome')} value={dashSummary.bankIncome} colorClass="emerald" />
            <AmountCard label={t('dashboard.totalIncome')} value={dashSummary.incomeTotal} colorClass="green" />
          </div>

          <div className="grid grid-cols-3 gap-1.5 dash-fin-grid">
            <AmountCard label={t('history.cashExpense')} value={dashSummary.cashExpense} colorClass="rose" />
            <AmountCard label={t('history.bankExpense')} value={dashSummary.bankExpense} colorClass="rose" />
            <AmountCard label={t('dashboard.totalExpenseLabel')} value={dashSummary.expenseTotal} colorClass="rose-dark" />
          </div>

          <div className="grid grid-cols-3 gap-1.5 dash-fin-grid">
            <AmountCard label={t('dashboard.cashBalance')} value={dashSummary.cashBalance} colorClass="emerald" />
            <AmountCard label={t('dashboard.bankBalance')} value={dashSummary.bankBalance} colorClass="cyan" />
            <AmountCard label={t('dashboard.netBalance')} value={dashSummary.totalNet} colorClass="indigo" />
          </div>

          {currentUser?.role === UserRole.ADMIN && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 bg-gradient-to-br from-violet-50 via-white to-violet-50 border border-violet-300 rounded-xl shadow-sm flex flex-col items-center justify-center">
                  <div className="text-[8px] text-violet-600 font-extrabold uppercase tracking-widest mb-1 text-center leading-tight">{t('dashboard.treasuryNetBalance')}</div>
                  <div className={`${amtSize(treasurySummary.netBalance)} auto-amt text-violet-800 font-black text-center`}>{treasurySummary.netBalance.toLocaleString()} <span className="text-[8px]">SR</span></div>
                  <div className="text-[8px] text-violet-500 mt-1 text-center leading-tight break-all">{t('dashboard.opening')}: {treasurySummary.officeOpeningBalance.toLocaleString()} | {t('dashboard.inLabel')}: {treasurySummary.totalIn.toLocaleString()} | {t('dashboard.outLabel')}: {treasurySummary.totalOut.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-gradient-to-br from-rose-50 via-white to-rose-50 border border-rose-300 rounded-xl shadow-sm flex flex-col items-center justify-center">
                  <div className="text-[8px] text-rose-600 font-extrabold uppercase tracking-widest mb-1 text-center leading-tight">{t('dashboard.totalOwnerExpense')}</div>
                  <div className={`${amtSize(ownerExpensesTotal.total)} auto-amt text-rose-800 font-black text-center`}>{ownerExpensesTotal.total.toLocaleString()} <span className="text-[8px]">SR</span></div>
                  <div className="text-[8px] text-rose-500 mt-1 text-center leading-tight break-all">{t('dashboard.opening')}: {ownerExpensesTotal.openingBalance.toLocaleString()} | {t('dashboard.period')}: {ownerExpensesTotal.thisMonth.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Property Occupancy Heatmap ── */}
      <div className="premium-card overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <Building2 className="text-white" size={14} />
                </div>
                <span className="truncate">{t('dashboard.heatmapTitle')}</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 ml-9">{t('dashboard.heatmapDesc')}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setExpandedBuildings(new Set(unitHeatmap.map(b => b.id)))} className="px-2 py-1.5 text-[10px] font-bold rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap">{t('dashboard.expandAll')}</button>
              <button onClick={() => setExpandedBuildings(new Set())} className="px-2 py-1.5 text-[10px] font-bold rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap">{t('dashboard.collapseAll')}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-600 mt-2 ml-9">
            <LegendChip label={`${t('dashboard.occupiedLabel')} (${unitStateCounts.occupied})`} color="bg-emerald-500" icon={<CheckCircle2 size={10} />} />
            <LegendChip label={`${t('dashboard.expiringLabel')} (${unitStateCounts.expiring})`} color="bg-amber-500" icon={<AlertTriangle size={10} />} />
            <LegendChip label={`${t('dashboard.expiredLabel')} (${unitStateCounts.expired})`} color="bg-rose-500" icon={<AlertCircle size={10} />} />
            <LegendChip label={`${t('dashboard.vacantLabel')} (${unitStateCounts.vacant})`} color="bg-slate-300" icon={<Circle size={10} />} />
          </div>
        </div>
        <div className="p-3 sm:p-5">
          <div className="space-y-3">
            {unitHeatmap.map(building => {
              const bOccupied = building.units.filter(u => u.state === 'occupied').length;
              const bExpiring = building.units.filter(u => u.state === 'expiring').length;
              const bExpired = building.units.filter(u => u.state === 'expired').length;
              const bVacant = building.units.filter(u => u.state === 'vacant').length;
              return (
                <div key={building.id} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 hover:bg-slate-50/60 transition-colors">
                  <button
                    onClick={() => {
                      const next = new Set(expandedBuildings);
                      if (next.has(building.id)) next.delete(building.id);
                      else next.add(building.id);
                      setExpandedBuildings(next);
                    }}
                    className="w-full flex items-center justify-between mb-2"
                  >
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm min-w-0">
                      <Building2 size={13} className="text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{building.name}</span>
                      {building.fromBook && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[9px] font-black truncate max-w-[80px]">{building.fromBook}</span>
                      )}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-semibold text-slate-500">{building.units.length} {t('dashboard.units')}</span>
                      {expandedBuildings.has(building.id) ? <ChevronDown size={14} className="text-emerald-700" /> : <ChevronRight size={14} className="text-emerald-700" />}
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {bOccupied > 0 && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">{t('dashboard.occupiedLabel')}: {bOccupied}</span>}
                    {bExpiring > 0 && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">{t('dashboard.expiringLabel')}: {bExpiring}</span>}
                    {bExpired > 0 && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">{t('dashboard.expiredLabel')}: {bExpired}</span>}
                    {bVacant > 0 && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{t('dashboard.vacantLabel')}: {bVacant}</span>}
                  </div>

                  {expandedBuildings.has(building.id) && (
                    <div className="space-y-2 animate-fade-in">
                      {bVacant > 0 && (
                        <div>
                          <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">{t('dashboard.vacantLabel')} ({bVacant})</div>
                          {/* flex-wrap so unit chips never overflow */}
                          <div className="flex flex-wrap gap-1">
                            {building.units.filter(u => u.state === 'vacant').map(unit => (
                              <span key={unit.name} className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm ${unitClass(unit.state)}`}>{unit.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bExpired > 0 && (
                        <div>
                          <div className="text-[9px] font-bold text-rose-700 uppercase tracking-wider mb-1">{t('dashboard.expiredLabel')} ({bExpired})</div>
                          <div className="flex flex-wrap gap-1">
                            {building.units.filter(u => u.state === 'expired').map(unit => (
                              <span key={unit.name} className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm ${unitClass(unit.state)}`} title={unit.contractInfo?.customerName}>{unit.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bExpiring > 0 && (
                        <div>
                          <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">{t('dashboard.expiringLabel')} ({bExpiring})</div>
                          <div className="flex flex-wrap gap-1">
                            {building.units.filter(u => u.state === 'expiring').map(unit => (
                              <span key={unit.name} className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm ${unitClass(unit.state)}`} title={unit.contractInfo?.customerName}>{unit.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bOccupied > 0 && (
                        <div>
                          <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mb-1">{t('dashboard.occupiedLabel')} ({bOccupied})</div>
                          <div className="flex flex-wrap gap-1">
                            {building.units.filter(u => u.state === 'occupied').map(unit => (
                              <span key={unit.name} className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm ${unitClass(unit.state)}`} title={unit.contractInfo?.customerName}>{unit.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {building.units.length === 0 && <span className="text-xs text-slate-400">{t('dashboard.noUnits')}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {unitHeatmap.length === 0 && <div className="text-sm text-slate-400 text-center py-4">{t('dashboard.noBuildings')}</div>}
          </div>
        </div>
      </div>

      {/* ── Last 5 Transactions ── */}
      <div className="premium-card overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
              <Activity className="text-white" size={14} />
            </div>
            {t('dashboard.recentTransactions')}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5 ml-9">{t('dashboard.last5')}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {approved
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5)
            .map((tx, idx) => {
              const isIncome = normalizeTransactionType(tx.type) === TransactionType.INCOME;
              const method = normalizePaymentMethod(tx.paymentMethod);
              return (
                <div key={tx.id} className="p-3 hover:bg-slate-50/50 transition-colors flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${isIncome ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-rose-400 to-rose-500'}`}>
                    {isIncome ? <ArrowDownRight className="text-white" size={14} /> : <ArrowUpRight className="text-white" size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-800 truncate">{tx.details || (isIncome ? 'Income' : 'Expense')}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0 ${method === PaymentMethod.CASH ? 'bg-amber-100 text-amber-700' : method === PaymentMethod.CHEQUE ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {method === PaymentMethod.CASH ? t('dashboard.paymentCash') : method === PaymentMethod.CHEQUE ? t('dashboard.paymentCheque') : t('dashboard.paymentBank')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-500">{fmtDate(tx.date)}</span>
                      {tx.buildingName && <span className="text-[10px] text-slate-400 truncate max-w-[100px]">• {tx.buildingName}</span>}
                      {tx.unitNumber && <span className="text-[10px] text-slate-400">• Unit {tx.unitNumber}</span>}
                    </div>
                  </div>
                  <div className={`text-right flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <div className="font-black text-xs">{isIncome ? '+' : '-'}{Number(tx.amountIncludingVAT || (tx as any).totalWithVat || tx.amount).toLocaleString()}</div>
                    <div className="text-[9px] font-medium text-slate-400">{t('common.sar')}</div>
                  </div>
                </div>
              );
            })}
          {approved.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">{t('dashboard.noTransactions')}</div>
          )}
        </div>
      </div>

      {/* ── Income vs Expense Trend ──
           KEY FIX: ResponsiveContainer width="100%" automatically matches the
           parent div width. It NEVER produces a fixed pixel width that overflows. ── */}
      <div className="premium-card overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <TrendingUp className="text-white" size={14} />
            </div>
            {t('dashboard.incomeTrend')}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5 ml-9">{t('dashboard.last6months')}</p>
        </div>
        <div className="p-3 sm:p-5" style={{ width: '100%', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={38} />
              <Tooltip formatter={(value) => value != null ? `${Number(value).toLocaleString()} SAR` : ''} />
              <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incGrad)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Lower Row: stacked on mobile, 3 cols on lg ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 dash-lower-row">

        {/* Payment Method Chart */}
        <div className="premium-card overflow-hidden">
          <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                <Wallet className="text-white" size={14} />
              </div>
              {t('dashboard.paymentMethodVolume')}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 ml-9">{t('dashboard.approvedTransactions')}</p>
          </div>
          <div className="p-3 sm:p-5" style={{ width: '100%', minWidth: 0 }}>
            <div className="flex items-center gap-4 mb-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>{t('entry.income')}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block"></span>{t('entry.expense')}</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={paymentMethodData} barGap={4} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={38} />
                <Tooltip formatter={(value, name) => [value != null ? `${Number(value).toLocaleString()} SAR` : '', String(name)]} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occupancy */}
        <div className="premium-card overflow-hidden">
          <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                <Home className="text-white" size={14} />
              </div>
              {t('dashboard.occupancyTitle')}
            </h3>
          </div>
          <div className="p-5 flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="3.5" strokeDasharray={`${occupancyStats.percentage}, 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-emerald-700">{occupancyStats.percentage}%</span>
                <span className="text-[9px] font-bold text-slate-500">{occupancyStats.occupiedUnits}/{occupancyStats.totalUnits}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="premium-card overflow-hidden">
          <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center shadow-sm">
                <AlertCircle className="text-white" size={14} />
              </div>
              {t('dashboard.pendingApprovals')}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 ml-9">{approvals.length} {t('dashboard.itemsWaiting')}</p>
          </div>
          <div className="p-3 sm:p-5">
            <div className="space-y-2">
              {pendingApprovals.length === 0 && <div className="text-sm text-slate-400 text-center py-4">{t('dashboard.noPendingApprovals')}</div>}
              {pendingApprovals.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/60 flex items-start gap-2">
                  <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={11} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title || item.type || t('dashboard.approvalRequest')}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.createdByName || item.requestedBy || 'Unknown user'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
      </>
      )}
    </div>
  );
};

/* ─── AmountCard: tiny responsive card for financial grid ─── */
const AmountCard = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => {
  const c = colorMap[colorClass] || colorMap.emerald;
  return (
    <div className={`p-1.5 ${c.bg} border ${c.border} rounded-xl shadow-sm flex flex-col items-center justify-center min-h-[48px] overflow-hidden`}>
      <div className={`text-[8px] ${c.label} font-extrabold uppercase tracking-wide mb-0.5 text-center leading-tight w-full`}
           style={{ wordBreak: 'break-word' }}>{label}</div>
      <div className={`${amtSize(value)} auto-amt ${c.text} font-bold text-center leading-tight`}
           style={{ wordBreak: 'break-all' }}>
        {value.toLocaleString()} <span style={{ fontSize: '8px' }}>SR</span>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */
const StatMini = ({ label, value, color, bold, highlight }: { label: string; value: number; color: string; bold?: boolean; highlight?: boolean }) => {
  const c = colorMap[color] || colorMap.emerald;
  return (
    <div className={`px-3 py-2.5 ${c.bg} border ${c.border} rounded-xl flex flex-col items-center justify-center ${highlight ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}>
      <div className={`text-[9px] ${c.label} font-extrabold uppercase tracking-widest mb-0.5`}>{label}</div>
      <div className={`${amtSize(value)} auto-amt ${c.text} ${bold ? 'font-black' : 'font-bold'}`}>{value.toLocaleString()} <span className="auto-amt-sar">SR</span></div>
    </div>
  );
};

const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="group premium-card premium-card-interactive p-3 text-left w-full">
    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-lg shadow-emerald-200/50">
      {icon}
    </div>
    <p className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wide leading-tight">{label}</p>
  </button>
);

const LegendChip = ({ label, color, icon }: { label: string; color: string; icon: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <span className={`w-3 h-3 rounded flex-shrink-0 ${color} text-white flex items-center justify-center`}>{icon}</span>
    {label}
  </span>
);

const unitClass = (state: UnitState) => {
  switch (state) {
    case 'occupied': return 'bg-emerald-500 text-white';
    case 'expiring': return 'bg-amber-500 text-white';
    case 'expired':  return 'bg-rose-500 text-white';
    default:         return 'bg-slate-200 text-slate-600';
  }
};

export default Dashboard;
export { Dashboard };
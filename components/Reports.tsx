import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Transaction, TransactionType, TransactionStatus, Contract, Building, Customer, ExpenseCategory, PaymentMethod, UserRole, User, Bank } from '../types';
import { getTransactionInclusiveAmount, normalizePaymentMethod, normalizeTransactionType, transactionCountsAsBankForSplit } from '../utils/transactionUtils';
import { addMoneyFingerprint, matchesAdvancedSearch, moneyFingerprintSuffix } from '../utils/advancedSearch';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import {
  getTransactions, getContracts, getBuildings, getCustomers,
  getOccupancyStats, getIncomeExpenseSummary, getIncomeExpenseByPeriod,
  getSalaryReport, getMaintenanceReport, getVendors, getTransfers, getSettings,
  getBanks,
  getTransactionsAllBooks, getBuildingsAllBooks, getTransfersAllBooks, getUsersAcrossBooks,
  ownerStakeBuildingIdsMatch,
} from '../services/firestoreService';
import { useBook } from '../contexts/BookContext';
import { useLanguage } from '../i18n';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  FileText, TrendingUp, TrendingDown, DollarSign, Building2, Users,
  Calendar, Download, Filter, ChevronDown, ChevronRight, Wallet,
  Home, Percent, CreditCard, PieChart as PieChartIcon, BarChart3,
  ArrowUpRight, ArrowDownRight, FileSpreadsheet, Printer, Eye,
  Landmark, RefreshCw, Clock, AlertTriangle, CheckCircle, XCircle,
  Search, X
} from 'lucide-react';

// ── Types ──
type ReportTab = 'overview' | 'financial' | 'occupancy' | 'tenant' | 'expense' | 'salary' | 'building' | 'collection' | 'bank' | 'ownerExpense';
type DatePreset =
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

interface KPICard {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}

// ── Helpers ──
const fmt = (n: number) => new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtK = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : fmt(n);
const bankKey = (value: unknown): string => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const getDateRange = (preset: DatePreset): { start: string; end: string } => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (preset) {
    case 'thisMonth': return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y;
      return { start: `${ly}-${String(lm + 1).padStart(2, '0')}-01`, end: new Date(ly, lm + 1, 0).toISOString().slice(0, 10) };
    }
    case 'thisYear': return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'lastYear': return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default: return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
};

/** Composite Firestore id `bookId:rawId` → raw segment */
const rawIdSegment = (id?: string): string => {
  const s = String(id ?? '').trim();
  if (!s) return '';
  return s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s;
};

const ownerReportBookId = (row: any, fallbackBookId = 'default'): string => {
  const bid = String(row?._bookId || row?._sourceBookId || row?.bookId || fallbackBookId || 'default').trim();
  return bid || 'default';
};

/** Treasury-linked ledger row for Building ↔ Owner (saved with paymentMethod TREASURY). */
const isTreasuryBuildingOwnerLedgerTx = (t: any): boolean => {
  const pm = String((t as any).paymentMethod ?? '');
  if ((t as any).source !== 'treasury' && pm !== 'TREASURY') return false;
  const ft = String((t as any).fromType || '').toUpperCase();
  const tt = String((t as any).toType || '').toUpperCase();
  return (ft === 'BUILDING' && tt === 'OWNER') || (ft === 'OWNER' && tt === 'BUILDING');
};

const ownerIdFromTreasuryBuildingOwnerTx = (t: any): string => {
  const ft = String((t as any).fromType || '').toUpperCase();
  const tt = String((t as any).toType || '').toUpperCase();
  if (ft === 'OWNER') return String((t as any).fromId || '').trim();
  if (tt === 'OWNER') return String((t as any).toId || '').trim();
  return '';
};

/**
 * Building↔Owner treasury row created by TransferManager "Convert owner expenses".
 * The original form line stays in the ledger with `treasuryConverted` — count that, not this leg.
 */
const isTreasuryBuildingOwnerConvertedLeg = (t: any): boolean => {
  if (!isTreasuryBuildingOwnerLedgerTx(t)) return false;
  const p = String((t as any).purpose || '');
  const d = String((t as any).details || (t as any).notes || '');
  return /owner\s*expense\s*\(converted\)/i.test(p) || /converted\s+from\s+transaction/i.test(d);
};

const ownerStakeIdsForUser = (u: any): string[] =>
  Array.isArray(u?.ownerBuildingIds)
    ? u.ownerBuildingIds.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];

const isOwnerReportUser = (u: any): boolean => {
  if (!u) return false;
  const role = String(u.role || '').toUpperCase();
  return (
    role === 'OWNER' ||
    u.isOwner === true ||
    String(u.isOwner).toLowerCase() === 'true' ||
    ownerStakeIdsForUser(u).length > 0
  );
};

const normalizedOwnerText = (value: any): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const ownerTextKeysForUser = (u: any): string[] =>
  [u?.name, u?.email, u?.ownerName]
    .map(normalizedOwnerText)
    .filter(Boolean);

const findOwnerRecordForOwnerReport = (t: any, attributedOwnerId: string, staff: any[]): any | undefined => {
  const candidates = (staff || []).filter(isOwnerReportUser);
  if (!candidates.length) return undefined;

  const oid = String(attributedOwnerId || '').trim();
  const rawOid = rawIdSegment(oid);
  const idMatches = oid
    ? candidates.filter((e: any) => {
        const eid = String(e.id || '').trim();
        return eid === oid || rawIdSegment(eid) === rawOid;
      })
    : [];
  const stakedIdMatch = idMatches.find((e: any) => ownerStakeIdsForUser(e).length > 0);
  if (stakedIdMatch) return stakedIdMatch;

  const ownerName = normalizedOwnerText((t as any)?.ownerName);
  if (ownerName) {
    const stakedNameMatch = candidates.find(
      (e: any) => ownerStakeIdsForUser(e).length > 0 && ownerTextKeysForUser(e).includes(ownerName),
    );
    if (stakedNameMatch) return stakedNameMatch;
    const nameMatch = candidates.find((e: any) => ownerTextKeysForUser(e).includes(ownerName));
    if (nameMatch) return nameMatch;
  }

  return idMatches[0];
};

/** Resolve owner id for grouping when `ownerId` was left blank but `ownerName` matches a user. */
const resolveOwnerIdForOwnerReport = (t: any, staff: any[]): string => {
  const explicitOwnerId = String((t as any).ownerId || '').trim();
  const treasuryOwnerId = ownerIdFromTreasuryBuildingOwnerTx(t);
  const ownerRecord = findOwnerRecordForOwnerReport(t, explicitOwnerId || treasuryOwnerId, staff);
  if (ownerRecord?.id) return String(ownerRecord.id).trim();
  let oid = explicitOwnerId || treasuryOwnerId;
  if (oid) return oid;
  const tn = String((t as any).ownerName || '').trim();
  if (!tn || !staff?.length) return '';
  const lower = tn.toLowerCase();
  const em = staff.find(
    (e: any) =>
      String(e.name || '').trim().toLowerCase() === lower ||
      String(e.email || '').trim().toLowerCase() === lower,
  );
  return em?.id ? String(em.id).trim() : '';
};

const transactionBuildingIdForStake = (t: any): string => {
  let bid = String(t?.buildingId || '').trim();
  if (bid) return bid;
  if (isTreasuryBuildingOwnerLedgerTx(t)) {
    const ft = String(t.fromType || '').toUpperCase();
    const tt = String(t.toType || '').toUpperCase();
    if (ft === 'BUILDING') return String(t.fromId || '').trim();
    if (tt === 'BUILDING') return String(t.toId || '').trim();
  }
  return '';
};

const buildingIdForOwnerStakeMatch = (t: any, activeBookId: string): string => {
  const bid = transactionBuildingIdForStake(t);
  if (!bid) return '';
  if (bid.includes(':')) return bid;
  const rowBook = ownerReportBookId(t, activeBookId);
  const act = String(activeBookId || '').trim();
  if (rowBook && act && rowBook !== act) return `${rowBook}:${bid}`;
  return bid;
};

/**
 * Owner Expense report: only include rows for an owner who has at least one building checked under
 * "Owner's Buildings (Properties with stake)" on their staff record; when none are selected, exclude
 * that owner entirely. When some are selected, only lines whose building is in that list (including
 * other-book rows matched via `_bookId` + raw id). Synthetic Head Office ↔ Owner `transfer:` rows
 * have no building: they are included only when they are not tagged to a different book than the
 * active book (cross-book HO legs cannot be tied to a checked stake building).
 */
const passesOwnerStakeBuildingFilter = (
  t: Transaction,
  attributedOwnerId: string,
  staff: any[],
  activeBookId: string,
): boolean => {
  const oid = String(attributedOwnerId || '').trim();
  if (!oid) return true;
  const emp =
    findOwnerRecordForOwnerReport(t, oid, staff) ||
    staff.find((e: any) => String(e.id) === oid || String(e.id) === rawIdSegment(oid));
  const stakeIds = ownerStakeIdsForUser(emp);
  if (isOwnerOpeningEntry(t)) return true;
  if (stakeIds.length === 0) return false;

  const act = String(activeBookId || '').trim();
  if (String((t as any).id || '').startsWith('transfer:')) {
    const rowBook = ownerReportBookId(t, activeBookId);
    if (rowBook && act && rowBook !== act) return false;
    return true;
  }

  const bidNorm = buildingIdForOwnerStakeMatch(t as any, activeBookId);
  if (!bidNorm) return false;

  return stakeIds.some(sid => ownerStakeBuildingIdsMatch(String(sid), bidNorm, activeBookId));
};

const isViewerAdminOrManager = (u?: User | null): boolean => {
  if (!u) return false;
  const r = String(u.role || '').toUpperCase();
  return r === 'ADMIN' || r === UserRole.ADMIN || r === 'MANAGER' || r === UserRole.MANAGER;
};

/** Staff "Assign Buildings" list from Employee / user record. */
const viewerAssignedBuildingIds = (u?: User | null): string[] => {
  if (!u) return [];
  const ids = (u as any).buildingIds;
  if (Array.isArray(ids) && ids.length)
    return [...new Set(ids.map((x: any) => String(x || '').trim()).filter(Boolean))];
  const one = (u as any).buildingId;
  return one ? [String(one).trim()] : [];
};

/** Owner role: "Owner's Buildings (Properties with stake)" on the user record. */
const viewerOwnerStakeBuildingIds = (u?: User | null): string[] => {
  if (!u) return [];
  const obl = (u as any).ownerBuildingIds;
  if (Array.isArray(obl) && obl.length)
    return [...new Set(obl.map((x: any) => String(x || '').trim()).filter(Boolean))];
  return [];
};

/**
 * Non–Admin/Manager: no cross-book rows; scope to Assign Buildings (or owner stake if no staff buildings).
 * Head Office ↔ Owner synthetics without a building pass only for same-book treasury staff with some scope.
 */
const passesViewerStaffOwnerScope = (
  t: Transaction,
  currentUser: User | undefined,
  activeBookId: string,
): boolean => {
  if (!currentUser || isViewerAdminOrManager(currentUser)) return true;

  const act = String(activeBookId || '').trim();
  const rowBook = ownerReportBookId(t, activeBookId);
  if (rowBook && act && rowBook !== act) return false;

  const staffBlds = viewerAssignedBuildingIds(currentUser);
  const stakeBlds = viewerOwnerStakeBuildingIds(currentUser);
  const allowed = staffBlds.length > 0 ? staffBlds : stakeBlds;
  if (allowed.length === 0) return false;

  if (isOwnerOpeningEntry(t)) {
    const rowOwnerId = String((t as any).ownerId || '').trim();
    return !!rowOwnerId && (rowOwnerId === String(currentUser.id) || rawIdSegment(rowOwnerId) === rawIdSegment(String(currentUser.id)));
  }

  const bid = transactionBuildingIdForStake(t as any);
  if (!bid) {
    return String((t as any).id || '').startsWith('transfer:');
  }
  return allowed.some(sid => ownerStakeBuildingIdsMatch(sid, bid, activeBookId));
};

const passesViewerStaffOwnerScopeTransfer = (
  tr: any,
  currentUser: User | undefined,
  activeBookId: string,
): boolean => {
  if (!currentUser || isViewerAdminOrManager(currentUser)) return true;

  const act = String(activeBookId || '').trim();
  const rowBook = ownerReportBookId(tr, activeBookId);
  if (rowBook && act && rowBook !== act) return false;

  const staffBlds = viewerAssignedBuildingIds(currentUser);
  const stakeBlds = viewerOwnerStakeBuildingIds(currentUser);
  const allowed = staffBlds.length > 0 ? staffBlds : stakeBlds;
  if (allowed.length === 0) return false;

  if (isHeadOfficeOwnerTransfer(tr)) return true;

  const bFrom = tr.fromType === 'BUILDING' ? String(tr.fromId || '') : '';
  const bTo = tr.toType === 'BUILDING' ? String(tr.toId || '') : '';
  const cand = bFrom || bTo;
  if (!cand) return false;
  return allowed.some(sid => ownerStakeBuildingIdsMatch(sid, cand, activeBookId));
};

/** VAT-inclusive totals — same helper as History / Dashboard. */
const reportMoneyAmount = (t: Transaction): number => getTransactionInclusiveAmount(t);

/** Withdrawal (+) vs contribution (−) for Building↔Owner treasury ledger rows. */
const signedTreasuryBuildingOwnerAmount = (t: Transaction): number => {
  const raw = reportMoneyAmount(t);
  if (normalizeTransactionType(t.type) === TransactionType.INCOME) return -Math.abs(raw);
  return Math.abs(raw);
};

/** Single line amount for owner report rows (forms + treasury legs + HO↔Owner synthesised txs). */
const ownerReportLineAmount = (t: Transaction): number => {
  if (String((t as any).id || '').startsWith('transfer:')) return Number((t as any).amount) || 0;
  if (isTreasuryBuildingOwnerLedgerTx(t)) return signedTreasuryBuildingOwnerAmount(t);
  return reportMoneyAmount(t);
};

const transferCountsForOwnerReport = (tr: any): boolean => {
  if (!tr || tr.deleted) return false;
  const st = String(tr.status ?? 'APPROVED').toUpperCase();
  if (st === 'CANCELLED' || st === 'PENDING') return false;
  return st === 'APPROVED' || st === 'COMPLETED' || !tr.status;
};

const isHeadOfficeOwnerTransfer = (tr: any): boolean =>
  (tr.fromType === 'HEAD_OFFICE' && tr.toType === 'OWNER') ||
  (tr.fromType === 'OWNER' && tr.toType === 'HEAD_OFFICE');

const ownerIdFromHeadOfficeOwnerTransfer = (tr: any): string => {
  if (tr.fromType === 'HEAD_OFFICE' && tr.toType === 'OWNER') return String(tr.toId || '').trim();
  if (tr.fromType === 'OWNER' && tr.toType === 'HEAD_OFFICE') return String(tr.fromId || '').trim();
  return '';
};

/** HO→OWNER (+); OWNER→HO (−). Matches Dashboard owner transfer totals. */
const signedHeadOfficeOwnerTransferAmount = (tr: any): number => {
  const a = Number(tr.amount) || 0;
  if (tr.fromType === 'HEAD_OFFICE' && tr.toType === 'OWNER') return a;
  if (tr.fromType === 'OWNER' && tr.toType === 'HEAD_OFFICE') return -a;
  return 0;
};

const ownerCrossBookSuffix = (tx: any): string => {
  const bid = ownerReportBookId(tx, 'default');
  if (!bid || bid === 'default') return '';
  const name = String(tx?._bookName || '').trim();
  return name ? ` [${name}]` : ` [${bid}]`;
};

const isOwnerOpeningEntry = (t: any): boolean =>
  t?.isOwnerOpeningBalance === true ||
  String(t?.expenseCategory || '').trim() === 'Owner Opening Balance' ||
  (t?.borrowingType === 'OPENING_BALANCE' && !!t?.ownerId);

/** Owner-expense pipeline: on that tab, Admin/Manager uses multi-select ids (incl. other books); other tabs use single `buildingFilter`. */
type OwnerReportBuildingConstraint =
  | { mode: 'all' }
  | { mode: 'single'; id: string }
  | { mode: 'multi'; ids: string[]; includeHoTreasury?: boolean };

const getOwnerReportBuildingConstraint = (
  activeTab: ReportTab,
  currentUser: User | undefined,
  buildingFilter: string,
  ownerPickerBuildings: { id: string }[],
  ownerExpenseExcludedBuildingIds: string[],
  ownerExpenseIncludeTreasury: boolean,
): OwnerReportBuildingConstraint => {
  const ownerTab = activeTab === 'ownerExpense' && isViewerAdminOrManager(currentUser);
  if (ownerTab) {
    const allIds = ownerPickerBuildings.map(b => String(b.id || '')).filter(Boolean);
    if (!allIds.length) return { mode: 'all' };
    const excluded = new Set(ownerExpenseExcludedBuildingIds.map(String));
    const included = allIds.filter(id => !excluded.has(id));
    // Nothing excluded = same as "all buildings checked"
    if (!ownerExpenseExcludedBuildingIds.length) return { mode: 'all' };
    if (!included.length) return { mode: 'multi', ids: [], includeHoTreasury: false };
    return { mode: 'multi', ids: included, includeHoTreasury: ownerExpenseIncludeTreasury };
  }
  if (buildingFilter === 'all') return { mode: 'all' };
  return { mode: 'single', id: String(buildingFilter) };
};

const transactionMatchesOwnerReportBuilding = (
  t: any,
  c: OwnerReportBuildingConstraint,
  activeBookId: string,
): boolean => {
  if (isOwnerOpeningEntry(t)) return true;
  if (c.mode === 'all') return true;
  if (c.mode === 'single') {
    const bid = String(t.buildingId || '');
    const bf = c.id;
    return bid === bf || rawIdSegment(bid) === rawIdSegment(bf) || bid === rawIdSegment(bf);
  }
  // Head Office ↔ Owner synthetics use `transfer:…` ids and carry no building; keep when user opted in.
  if (c.mode === 'multi' && c.includeHoTreasury && String(t.id || '').startsWith('transfer:')) return true;
  if (String(t.id || '').startsWith('transfer:')) return false;
  const bidNorm = buildingIdForOwnerStakeMatch(t, activeBookId);
  if (!bidNorm) return false;
  return c.ids.some(sel => ownerStakeBuildingIdsMatch(String(sel), bidNorm, activeBookId));
};

const transferBuildingSideMatchesOwnerReportBuilding = (
  tr: any,
  c: OwnerReportBuildingConstraint,
  activeBookId: string,
): boolean => {
  if (c.mode === 'all') return true;
  const buildingSide = tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : '');
  if (c.mode === 'single') {
    const bid = String(buildingSide || '');
    const bf = c.id;
    return bid === bf || rawIdSegment(bid) === rawIdSegment(bf) || bid === rawIdSegment(bf);
  }
  if (!String(buildingSide || '').trim()) return false;
  const stub = { buildingId: String(buildingSide), _bookId: ownerReportBookId(tr, activeBookId) };
  const bidNorm = buildingIdForOwnerStakeMatch(stub, activeBookId);
  if (!bidNorm) return false;
  return c.ids.some(sel => ownerStakeBuildingIdsMatch(String(sel), bidNorm, activeBookId));
};

const COLORS = ['#059669', '#0891b2', '#7c3aed', '#e11d48', '#ea580c', '#ca8a04', '#2563eb', '#db2777', '#16a34a', '#6366f1'];
const GRADIENT_PAIRS = [
  ['#059669', '#34d399'], ['#0891b2', '#22d3ee'], ['#7c3aed', '#a78bfa'],
  ['#e11d48', '#fb7185'], ['#ea580c', '#fb923c'], ['#ca8a04', '#fbbf24']
];

// ── Component ──
interface ReportsProps {
  currentUser?: User;
}

const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const { t, isRTL } = useLanguage();
  const { activeBookId } = useBook();

  // ── State ──
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('thisYear');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  /** Owner tab: buildings unchecked here are excluded from the report (default none = all included). */
  const [ownerExpenseExcludedBuildingIds, setOwnerExpenseExcludedBuildingIds] = useState<string[]>([]);
  const [ownerExpenseBuildingPickerOpen, setOwnerExpenseBuildingPickerOpen] = useState(false);
  const [ownerExpenseBuildingSearch, setOwnerExpenseBuildingSearch] = useState('');
  /** When specific buildings are selected, Head Office ↔ Owner treasury synthetics are off unless this is true. */
  const [ownerExpenseIncludeTreasury, setOwnerExpenseIncludeTreasury] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [bankReportFilter, setBankReportFilter] = useState('all');
  const [bankMonthFilter, setBankMonthFilter] = useState('all');
  const [bankMovementFilter, setBankMovementFilter] = useState<'all' | 'in' | 'out'>('all');
  const [bankReportSearch, setBankReportSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [selectedTenantHistory, setSelectedTenantHistory] = useState<{ id: string; name: string; transactions: Transaction[] } | null>(null);

  // ── Data ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState({ totalUnits: 0, occupiedUnits: 0, percentage: 0 });
  const [vendors, setVendors] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  /** Main Book only: owner-related txs from other partitions for Owner Expense report */
  const [ownerSupplementTxs, setOwnerSupplementTxs] = useState<Transaction[]>([]);
  const [ownerSupplementTransfers, setOwnerSupplementTransfers] = useState<any[]>([]);
  const [ownerAllBookBuildings, setOwnerAllBookBuildings] = useState<Building[]>([]);
  const [ownerAllBookLoading, setOwnerAllBookLoading] = useState(false);
  const [reportSettings, setReportSettings] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const collectionSearchRef = useRef<HTMLInputElement>(null);

  // ── Date Range ──
  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd };
    return getDateRange(datePreset);
  }, [datePreset, customStart, customEnd]);

  const ownerPickerBuildings = useMemo(() => {
    const sourceBuildings =
      activeBookId === 'default' && ownerAllBookBuildings.length > 0
        ? ownerAllBookBuildings
        : buildings;
    return (sourceBuildings || []).map(b => ({
      id: b.id,
      name: b.name,
      _bookDisplayName: (b as any)._bookDisplayName as string | undefined,
      _sourceBookId: ((b as any)._sourceBookId || activeBookId) as string,
    }));
  }, [buildings, ownerAllBookBuildings, activeBookId]);

  const filteredOwnerPickerBuildings = useMemo(() => {
    const q = ownerExpenseBuildingSearch.trim().toLowerCase();
    if (!q) return ownerPickerBuildings;
    return ownerPickerBuildings.filter((b: any) => {
      const name = String(b.name || '').toLowerCase();
      const book = String(b._bookDisplayName || '').toLowerCase();
      return name.includes(q) || book.includes(q);
    });
  }, [ownerPickerBuildings, ownerExpenseBuildingSearch]);

  const ownerExpenseIncludedBuildings = useMemo(() => {
    const excluded = new Set(ownerExpenseExcludedBuildingIds.map(String));
    return (ownerPickerBuildings || []).filter((b: any) => !excluded.has(String(b.id || '')));
  }, [ownerPickerBuildings, ownerExpenseExcludedBuildingIds]);

  const ownerReportBuildingConstraint = useMemo(
    () =>
      getOwnerReportBuildingConstraint(
        activeTab,
        currentUser,
        buildingFilter,
        ownerPickerBuildings,
        ownerExpenseExcludedBuildingIds,
        ownerExpenseIncludeTreasury,
      ),
    [
      activeTab,
      currentUser,
      buildingFilter,
      ownerPickerBuildings,
      ownerExpenseExcludedBuildingIds,
      ownerExpenseIncludeTreasury,
    ],
  );

  // ── Fetch ──
  const loadData = async () => {
    setLoading(true);
    try {
      const [txs, cons, blds, custs, usrs, occ, vnds, trsf, sett, bks] = await Promise.all([
        getTransactions(), getContracts(), getBuildings(),
        getCustomers({ acrossBooks: true }), getUsersAcrossBooks(), getOccupancyStats(), getVendors(), getTransfers({}),
        getSettings().catch(() => null),
        getBanks().catch(() => []),
      ]);
      setTransactions(txs as Transaction[]);
      setContracts(cons as Contract[]);
      setBuildings(blds as Building[]);
      setCustomers(custs as Customer[]);
      setEmployees(usrs as any[]);
      setOccupancy(occ);
      setVendors(vnds as any[]);
      setTransfers(trsf as any[]);
      setReportSettings(sett || null);
      setBanks((bks || []) as Bank[]);

      if (!(activeBookId === 'default' && activeTab === 'ownerExpense')) {
        setOwnerSupplementTxs([]);
        setOwnerSupplementTransfers([]);
        setOwnerAllBookBuildings([]);
      }
    } catch (e) { console.error('Reports load error:', e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [
    activeBookId,
    currentUser?.id,
    (currentUser as any)?.role,
    JSON.stringify((currentUser as any)?.buildingIds || []),
    JSON.stringify((currentUser as any)?.ownerBuildingIds || []),
  ]);

  useEffect(() => {
    let cancelled = false;

    const clearOwnerAllBookData = () => {
      setOwnerSupplementTxs([]);
      setOwnerSupplementTransfers([]);
      setOwnerAllBookBuildings([]);
      setOwnerAllBookLoading(false);
    };

    const withBookMeta = (row: any): any => {
      const bookId = ownerReportBookId(row, activeBookId);
      const base = row && typeof row === 'object' ? row : {};
      return {
        ...base,
        _bookId: bookId,
        _sourceBookId: bookId,
        _bookName:
          base._bookName ||
          base._bookDisplayName ||
          (bookId === 'default' ? 'Main Book' : bookId),
      };
    };

    const isOwnerReportTransaction = (row: any): boolean => {
      const cat = String(row?.expenseCategory || '').trim();
      return (
        cat === 'Owner Expense' ||
        cat === ExpenseCategory.OWNER_EXPENSE ||
        cat === 'Owner Profit Withdrawal' ||
        cat === 'Owner Opening Balance' ||
        isOwnerOpeningEntry(row) ||
        isTreasuryBuildingOwnerLedgerTx(row)
      );
    };

    const loadOwnerAllBooks = async () => {
      if (activeTab !== 'ownerExpense' || activeBookId !== 'default' || !isViewerAdminOrManager(currentUser)) {
        clearOwnerAllBookData();
        return;
      }

      setOwnerAllBookLoading(true);
      try {
        const [allTxs, allTransfers, allBuildings] = await Promise.all([
          getTransactionsAllBooks(),
          getTransfersAllBooks(),
          getBuildingsAllBooks(),
        ]);
        if (cancelled) return;

        const normalizedTxs = (allTxs || []).map(withBookMeta);
        const normalizedTransfers = (allTransfers || []).map(withBookMeta);
        const normalizedBuildings = (allBuildings || []).map(withBookMeta) as Building[];

        setOwnerAllBookBuildings(normalizedBuildings);
        setOwnerSupplementTxs(
          normalizedTxs.filter(
            (row: any) =>
              ownerReportBookId(row, activeBookId) !== activeBookId &&
              isOwnerReportTransaction(row),
          ) as Transaction[],
        );
        setOwnerSupplementTransfers(
          normalizedTransfers.filter((tr: any) => {
            if (ownerReportBookId(tr, activeBookId) === activeBookId) return false;
            return (
              isHeadOfficeOwnerTransfer(tr) ||
              (tr.fromType === 'BUILDING' && tr.toType === 'OWNER') ||
              (tr.fromType === 'OWNER' && tr.toType === 'BUILDING')
            );
          }),
        );
      } catch (e) {
        if (!cancelled) {
          console.error('Reports owner all-book load error:', e);
          setOwnerSupplementTxs([]);
          setOwnerSupplementTransfers([]);
          setOwnerAllBookBuildings([]);
        }
      } finally {
        if (!cancelled) setOwnerAllBookLoading(false);
      }
    };

    loadOwnerAllBooks();
    return () => { cancelled = true; };
  }, [activeTab, activeBookId, currentUser?.id, (currentUser as any)?.role]);

  useEffect(() => {
    const valid = new Set(ownerPickerBuildings.map((b: any) => String(b.id || '')));
    setOwnerExpenseExcludedBuildingIds(prev => prev.filter(id => valid.has(id)));
  }, [ownerPickerBuildings]);

  useEffect(() => {
    if (activeTab !== 'ownerExpense') {
      setOwnerExpenseBuildingPickerOpen(false);
      setOwnerExpenseBuildingSearch('');
    }
  }, [activeTab]);

  useEffect(() => {
    if (ownerExpenseExcludedBuildingIds.length === 0) setOwnerExpenseIncludeTreasury(false);
  }, [ownerExpenseExcludedBuildingIds.length]);

  // ── Filtered Transactions ──
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      // Match History default: trashed rows should not affect Reports totals
      if ((t as any).deleted) return false;
      if (t.date < rangeStart || t.date > rangeEnd) return false;
      if (buildingFilter !== 'all') {
        const bid = String((t as any).buildingId || '');
        const bf = String(buildingFilter);
        if (bid !== bf && rawIdSegment(bid) !== rawIdSegment(bf) && bid !== rawIdSegment(bf)) return false;
      }
      // Exclude TREASURY and TREASURY_REVERSAL transactions (internal transfers)
      const pm = String((t as any).paymentMethod ?? '');
      if ((t as any).source === 'treasury' || pm === 'TREASURY' || pm === 'TREASURY_REVERSAL' || (t as any).isReversal) return false;
      return true;
    });
  }, [transactions, rangeStart, rangeEnd, buildingFilter]);

  const approved = useMemo(() => filtered.filter(t => t.status === TransactionStatus.APPROVED || !t.status), [filtered]);

  const transactionsForOwnerReports = useMemo(
    () => [...transactions, ...ownerSupplementTxs],
    [transactions, ownerSupplementTxs],
  );

  const mergedTransfersForOwnerReports = useMemo(() => {
    const map = new Map<string, any>();
    for (const tr of [...(transfers || []), ...(ownerSupplementTransfers || [])]) {
      const id = String(tr?.id || '').trim();
      if (!id) continue;
      const bookId = ownerReportBookId(tr, activeBookId);
      const key = `${bookId}:${id}`;
      if (!map.has(key)) map.set(key, tr);
    }
    return Array.from(map.values());
  }, [transfers, ownerSupplementTransfers, activeBookId]);

  /** Like `approved` but includes other books when Main Book is active (owner report paths only). */
  const approvedForOwnerTab = useMemo(() => {
    return transactionsForOwnerReports.filter(t => {
      if ((t as any).deleted) return false;
      const d = String(t.date || '');
      if (d < rangeStart || d > rangeEnd) return false;
      if (!transactionMatchesOwnerReportBuilding(t, ownerReportBuildingConstraint, activeBookId)) return false;
      const pm = String((t as any).paymentMethod ?? '');
      if ((t as any).source === 'treasury' || pm === 'TREASURY' || pm === 'TREASURY_REVERSAL' || (t as any).isReversal) return false;
      if (!(t.status === TransactionStatus.APPROVED || !t.status)) return false;
      return passesViewerStaffOwnerScope(t, currentUser, activeBookId);
    });
  }, [transactionsForOwnerReports, rangeStart, rangeEnd, ownerReportBuildingConstraint, currentUser, activeBookId]);

  /** Building↔Owner Treasury legs are excluded from `filtered` — surface them only for owner reports. */
  const treasuryBuildingOwnerLegsForReports = useMemo(() => {
    return transactionsForOwnerReports.filter((t: any) => {
      if ((t as any).deleted) return false;
      if (!(t.status === TransactionStatus.APPROVED || !t.status)) return false;
      if (!isTreasuryBuildingOwnerLedgerTx(t)) return false;
      if (isTreasuryBuildingOwnerConvertedLeg(t)) return false;
      const d = String(t.date || '');
      if (d < rangeStart || d > rangeEnd) return false;
      if (!transactionMatchesOwnerReportBuilding(t, ownerReportBuildingConstraint, activeBookId)) return false;
      return passesViewerStaffOwnerScope(t, currentUser, activeBookId);
    });
  }, [transactionsForOwnerReports, rangeStart, rangeEnd, ownerReportBuildingConstraint, currentUser, activeBookId]);

  /**
   * Same as History/Dashboard: Building↔Owner transfers with no linked transaction document
   * (older saves / missing writes) must still appear in owner totals.
   */
  const buildingOwnerPseudoForReports = useMemo((): Transaction[] => {
    // Only treat a transfer as "already represented by a ledger doc" when that doc would
    // actually appear in `treasuryBuildingOwnerLegsForReports`. Otherwise a row that fails
    // the building filter (e.g. id shape mismatch) still had transferId and blocked the
    // pseudo-row from transfers — hiding treasury entirely for that building.
    const existingTreasuryTxIds = new Set<string>();
    for (const t of treasuryBuildingOwnerLegsForReports) {
      const tid = String((t as any).transferId || '').trim();
      if (tid) existingTreasuryTxIds.add(`${ownerReportBookId(t, activeBookId)}:${tid}`);
    }
    for (const t of transactionsForOwnerReports) {
      if ((t as any).deleted) continue;
      if (!isTreasuryBuildingOwnerLedgerTx(t)) continue;
      if (!isTreasuryBuildingOwnerConvertedLeg(t)) continue;
      const tid = String((t as any).transferId || '').trim();
      if (tid) existingTreasuryTxIds.add(`${ownerReportBookId(t, activeBookId)}:${tid}`);
    }
    return (mergedTransfersForOwnerReports || [])
      .filter((tr: any) =>
        ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') || (tr.fromType === 'OWNER' && tr.toType === 'BUILDING')) &&
        !tr.deleted &&
        transferCountsForOwnerReport(tr) &&
        !existingTreasuryTxIds.has(`${ownerReportBookId(tr, activeBookId)}:${tr.id}`),
      )
      .filter((tr: any) => {
        const d = String(tr.date || '');
        if (d < rangeStart || d > rangeEnd) return false;
        if (!transferBuildingSideMatchesOwnerReportBuilding(tr, ownerReportBuildingConstraint, activeBookId)) return false;
        return true;
      })
      .filter((tr: any) => passesViewerStaffOwnerScopeTransfer(tr, currentUser, activeBookId))
      .map((tr: any) => ({
        id: `pseudo_${tr.id}`,
        date: tr.date || '',
        type: tr.fromType === 'BUILDING' ? TransactionType.EXPENSE : TransactionType.INCOME,
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
        status: tr.status || TransactionStatus.APPROVED,
        transferId: tr.id,
        source: 'treasury',
        buildingId: tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : undefined),
        expenseCategory: '',
        _bookId: ownerReportBookId(tr, activeBookId),
        _bookName: (tr as any)._bookName,
      } as unknown as Transaction));
  }, [
    transactionsForOwnerReports,
    treasuryBuildingOwnerLegsForReports,
    mergedTransfersForOwnerReports,
    rangeStart,
    rangeEnd,
    ownerReportBuildingConstraint,
    currentUser,
    activeBookId,
  ]);

  const allBuildingOwnerTreasuryRowsForReports = useMemo(
    () => [...treasuryBuildingOwnerLegsForReports, ...buildingOwnerPseudoForReports],
    [treasuryBuildingOwnerLegsForReports, buildingOwnerPseudoForReports],
  );

  /**
   * Head Office ↔ Owner: treasury ledger rows are stripped from general Reports filters (Dashboard does the same).
   * Amounts are carried on `transfers`, like Dashboard `ownerExpensesTotal`. Only when all buildings selected.
   */
  const headOfficeOwnerSyntheticTransactions = useMemo((): Transaction[] => {
    const allowHoTreasury =
      ownerReportBuildingConstraint.mode === 'all' ||
      (ownerReportBuildingConstraint.mode === 'multi' && ownerExpenseIncludeTreasury);
    if (!allowHoTreasury) return [];
    const seen = new Set<string>();
    const out: Transaction[] = [];
    for (const tr of mergedTransfersForOwnerReports || []) {
      if (!tr || !transferCountsForOwnerReport(tr) || !isHeadOfficeOwnerTransfer(tr)) continue;
      if (!passesViewerStaffOwnerScopeTransfer(tr, currentUser, activeBookId)) continue;
      const tid = String(tr.id || '');
      if (!tid || seen.has(tid)) continue;
      const d = String(tr.date || '');
      if (d < rangeStart || d > rangeEnd) continue;
      seen.add(tid);
      const oid = ownerIdFromHeadOfficeOwnerTransfer(tr);
      out.push({
        id: `transfer:${tr.id}`,
        date: tr.date || '',
        amount: signedHeadOfficeOwnerTransferAmount(tr),
        type: TransactionType.EXPENSE,
        purpose: tr.purpose || tr.notes || 'Treasury (Head Office ↔ Owner)',
        status: TransactionStatus.APPROVED,
        expenseCategory: '',
        ownerId: oid,
        details: '',
        _bookId: ownerReportBookId(tr, activeBookId),
        _bookName: (tr as any)._bookName,
      } as unknown as Transaction);
    }
    return out;
  }, [
    mergedTransfersForOwnerReports,
    ownerReportBuildingConstraint,
    ownerExpenseIncludeTreasury,
    rangeStart,
    rangeEnd,
    currentUser,
    activeBookId,
  ]);

  const income = useMemo(() => approved.filter(t => t.type === TransactionType.INCOME), [approved]);
  // Exclude Borrowing from expense totals (tracked separately in Borrowing Tracker)
  const expenses = useMemo(() => approved.filter(t => t.type === TransactionType.EXPENSE && t.expenseCategory !== 'Borrowing' && t.expenseCategory !== 'BORROWING'), [approved]);
  const totalIncome = useMemo(() => income.reduce((s, x) => s + (Number(x.amount) || 0), 0), [income]);
  const totalExpense = useMemo(() => expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0), [expenses]);
  const netProfit = totalIncome - totalExpense;

  // ── Monthly Breakdown ──
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number; net: number }> = {};
    approved.forEach(t => {
      const m = t.date?.slice(0, 7) || '';
      if (!months[m]) months[m] = { month: m, income: 0, expense: 0, net: 0 };
      if (t.type === TransactionType.INCOME) months[m].income += Number(t.amount) || 0;
      if (t.type === TransactionType.EXPENSE) months[m].expense += Number(t.amount) || 0;
    });
    return Object.keys(months).sort().map(k => ({ ...months[k], net: months[k].income - months[k].expense }));
  }, [approved]);

  // ── Expense by Category ──
  const expenseByCat = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach(t => {
      const c = t.expenseCategory || 'Other';
      cats[c] = (cats[c] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ── Payment Method Breakdown ──
  const incomeBank = useMemo(() => income.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.BANK).reduce((s, t) => s + (Number(t.amount) || 0), 0), [income]);
  const incomeCash = useMemo(() => income.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0), [income]);
  const incomeCheque = useMemo(() => income.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.CHEQUE).reduce((s, t) => s + (Number(t.amount) || 0), 0), [income]);
  const expenseBank = useMemo(() => expenses.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.BANK).reduce((s, t) => s + (Number(t.amount) || 0), 0), [expenses]);
  const expenseCash = useMemo(() => expenses.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.CASH).reduce((s, t) => s + (Number(t.amount) || 0), 0), [expenses]);
  const expenseCheque = useMemo(() => expenses.filter(t => normalizePaymentMethod(t.paymentMethod) === PaymentMethod.CHEQUE).reduce((s, t) => s + (Number(t.amount) || 0), 0), [expenses]);
  const incomePaymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    income.forEach(t => {
      const m = normalizePaymentMethod(t.paymentMethod);
      methods[m] = (methods[m] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [income]);
  const expensePaymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    expenses.forEach(t => {
      const m = normalizePaymentMethod(t.paymentMethod);
      methods[m] = (methods[m] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [expenses]);
  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    approved.forEach(t => {
      const m = normalizePaymentMethod(t.paymentMethod);
      methods[m] = (methods[m] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [approved]);

  // ── Building Revenue ──
  const buildingRevenue = useMemo(() => {
    const bmap: Record<string, { name: string; income: number; expense: number }> = {};
    approved.forEach(t => {
      const bid = t.buildingId || 'unknown';
      const bName = t.buildingName || buildings.find(b => b.id === bid)?.name || 'Unknown';
      if (!bmap[bid]) bmap[bid] = { name: bName, income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) bmap[bid].income += Number(t.amount) || 0;
      if (t.type === TransactionType.EXPENSE) bmap[bid].expense += Number(t.amount) || 0;
    });
    return Object.entries(bmap)
      .filter(([k]) => k !== 'unknown')
      .map(([, v]) => ({ ...v, net: v.income - v.expense }))
      .sort((a, b) => b.income - a.income);
  }, [approved, buildings]);

  // ── Tenant Collection ──
  const customerRoomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);
  const tenantCollection = useMemo(() => {
    const tmap: Record<string, { name: string; contracted: number; paid: number; balance: number }> = {};
    const activeContracts = contracts.filter(c => c.status === 'Active');
    activeContracts.forEach(c => {
      if (!tmap[c.customerId]) tmap[c.customerId] = { name: formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap), contracted: 0, paid: 0, balance: 0 };
      tmap[c.customerId].contracted += Number(c.totalValue) || 0;
    });
    income.forEach(t => {
      if (t.contractId) {
        const con = contracts.find(c => c.id === t.contractId);
        if (con && tmap[con.customerId]) {
          tmap[con.customerId].paid += Number(t.amount) || 0;
        }
      }
    });
    return Object.entries(tmap).map(([id, v]) => ({
      id, ...v, balance: v.contracted - v.paid,
      percentage: v.contracted > 0 ? Math.round((v.paid / v.contracted) * 100) : 0
    })).sort((a, b) => b.balance - a.balance);
  }, [contracts, income, customerRoomMap]);

  // Filtered tenant collection based on search
  const filteredTenantCollection = useMemo(() => {
    if (!collectionSearch.trim()) return tenantCollection;
    return tenantCollection.filter((t) => {
      const collFp = new Set<string>();
      addMoneyFingerprint(collFp, t.contracted);
      addMoneyFingerprint(collFp, t.paid);
      addMoneyFingerprint(collFp, t.balance);
      const h =
        [t.id, t.name, String(t.percentage)].join(' ') + moneyFingerprintSuffix(collFp);
      return matchesAdvancedSearch(collectionSearch, h);
    });
  }, [tenantCollection, collectionSearch]);

  // Get tenant transaction history
  const getTenantHistory = (customerId: string, customerName: string) => {
    const tenantTxs = transactions.filter(t => {
      if ((t as any).deleted) return false;
      const pm = String((t as any).paymentMethod ?? '');
      if ((t as any).source === 'treasury' || pm === 'TREASURY' || pm === 'TREASURY_REVERSAL' || (t as any).isReversal) return false;
      // Find transactions for this customer via contracts
      const con = contracts.find(c => c.customerId === customerId && c.id === t.contractId);
      return con !== undefined;
    }).sort((a, b) => b.date.localeCompare(a.date));
    setSelectedTenantHistory({ id: customerId, name: customerName, transactions: tenantTxs });
  };

  // ── Salary Breakdown ──
  const salaryData = useMemo(() => {
    const smap: Record<string, { name: string; total: number; bonus: number; deductions: number; net: number; count: number }> = {};
    expenses.filter(t => t.expenseCategory === 'Salary' || t.expenseCategory === ExpenseCategory.SALARY).forEach(t => {
      const eid = t.employeeId || 'unknown';
      if (!smap[eid]) smap[eid] = { name: t.employeeName || eid, total: 0, bonus: 0, deductions: 0, net: 0, count: 0 };
      smap[eid].total += Number(t.amount) || 0;
      smap[eid].bonus += Number(t.bonusAmount) || 0;
      smap[eid].deductions += Number(t.deductionAmount) || 0;
      smap[eid].count += 1;
    });
    return Object.entries(smap).map(([id, v]) => ({ id, ...v, net: v.total - v.deductions + v.bonus })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // ── Contract Stats ──
  const contractStats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'Active').length;
    const expired = contracts.filter(c => c.status === 'Expired').length;
    const terminated = contracts.filter(c => c.status === 'Terminated').length;
    const today = new Date().toISOString().slice(0, 10);
    const expiringSoon = contracts.filter(c => c.status === 'Active' && c.toDate && c.toDate >= today && c.toDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)).length;
    return { active, expired, terminated, expiringSoon, total: contracts.length };
  }, [contracts]);

  // ── VAT Summary ──
  const vatSummary = useMemo(() => {
    const vatCollected = income.filter(t => t.vatAmount).reduce((s, t) => s + (Number(t.vatAmount) || 0), 0);
    const vatPaid = expenses.filter(t => t.vatAmount).reduce((s, t) => s + (Number(t.vatAmount) || 0), 0);
    return { collected: vatCollected, paid: vatPaid, net: vatCollected - vatPaid };
  }, [income, expenses]);

  const bankReportData = useMemo(() => {
    type BankMovement = {
      id: string;
      date: string;
      bankName: string;
      type: string;
      direction: 'in' | 'out';
      amount: number;
      signedAmount: number;
      details: string;
      building: string;
      method: string;
      status: string;
    };
    type BankSummary = {
      key: string;
      name: string;
      iban: string;
      opening: number;
      income: number;
      expense: number;
      closing: number;
      transactionCount: number;
      movements: BankMovement[];
    };
    const selectedMonthStart = bankMonthFilter !== 'all' ? `${bankMonthFilter}-01` : '';
    const selectedMonthEnd = selectedMonthStart
      ? new Date(Number(bankMonthFilter.slice(0, 4)), Number(bankMonthFilter.slice(5, 7)), 0).toISOString().slice(0, 10)
      : '';
    const periodStart = selectedMonthStart || '';
    const periodEnd = selectedMonthEnd || '9999-12-31';
    const search = bankReportSearch.trim().toLowerCase();
    const unassignedBankName = 'Unassigned Bank';

    const bankNames = new Map<string, { name: string; iban: string }>();
    const addBankName = (name: any, iban = '') => {
      const clean = String(name || '').trim();
      const key = bankKey(clean);
      if (!key) return;
      if (!bankNames.has(key)) bankNames.set(key, { name: clean, iban });
      else if (iban && !bankNames.get(key)?.iban) bankNames.set(key, { name: bankNames.get(key)!.name, iban });
    };

    banks.forEach(b => addBankName(b.name, b.iban));
    buildings.forEach(b => addBankName((b as any).bankName));
    transactions.forEach((t: any) => {
      addBankName(t.bankName);
      addBankName(t.fromBankName);
      addBankName(t.toBankName);
    });
    transfers.forEach((tr: any) => {
      addBankName(tr.bankName);
      addBankName(tr.fromBankName);
      addBankName(tr.toBankName);
    });

    const summaries = new Map<string, BankSummary>();
    const ensure = (name: string): BankSummary => {
      const key = bankKey(name);
      const configured = bankNames.get(key);
      if (!summaries.has(key)) {
        summaries.set(key, {
          key,
          name: configured?.name || name,
          iban: configured?.iban || '',
          opening: 0,
          income: 0,
          expense: 0,
          closing: 0,
          transactionCount: 0,
          movements: [],
        });
      }
      return summaries.get(key)!;
    };

    bankNames.forEach((_, key) => ensure(bankNames.get(key)!.name));

    const openingBalancesByBuilding = (reportSettings?.openingBalancesByBuilding || {}) as Record<string, { cash?: number; bank?: number }>;
    Object.entries(openingBalancesByBuilding).forEach(([buildingId, row]) => {
      if (buildingFilter !== 'all' && String(buildingId) !== String(buildingFilter)) return;
      const bankAmount = Number(row?.bank) || 0;
      if (!bankAmount) return;
      const building = buildings.find(b => String(b.id) === String(buildingId));
      const bankName = String((building as any)?.bankName || '').trim();
      if (!bankName) return;
      const summary = ensure(bankName);
      summary.opening += bankAmount;
    });

    const isApprovedBankRow = (row: any) => {
      if (!row || row.deleted || row.isReversal || row.paymentMethod === 'TREASURY_REVERSAL') return false;
      const status = String(row.status || TransactionStatus.APPROVED).toUpperCase();
      return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !row.status;
    };
    const passesBuilding = (row: any) => {
      if (buildingFilter === 'all') return true;
      const bid = String(
        row.buildingId ||
        (row.fromType === 'BUILDING' ? row.fromId : '') ||
        (row.toType === 'BUILDING' ? row.toId : ''),
      );
      const bf = String(buildingFilter);
      return bid === bf || rawIdSegment(bid) === rawIdSegment(bf) || bid === rawIdSegment(bf);
    };
    const buildingNameFor = (row: any) =>
      row.buildingName ||
      buildings.find(b => String(b.id) === String(row.buildingId || '') || rawIdSegment(String(b.id)) === rawIdSegment(String(row.buildingId || '')))?.name ||
      '';
    const rawOfBuilding = (value: any): string => rawIdSegment(String(value || ''));
    const isOpeningBalance = (row: any) =>
      row.borrowingType === 'OPENING_BALANCE' ||
      row.isOwnerOpeningBalance === true ||
      row.expenseCategory === 'Owner Opening Balance';

    const existingTreasuryTxIds = new Set(
      transactions
        .filter((t: any) => (t as any).transferId)
        .map((t: any) => String((t as any).transferId)),
    );
    const buildingOwnerPseudo = (transfers || []).filter((tr: any) =>
      ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') || (tr.fromType === 'OWNER' && tr.toType === 'BUILDING')) &&
      !tr.deleted &&
      !existingTreasuryTxIds.has(String(tr.id || '')),
    ).map((tr: any) => ({
      id: `pseudo_${tr.id}`,
      date: tr.date || '',
      type: tr.fromType === 'BUILDING' ? TransactionType.EXPENSE : TransactionType.INCOME,
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
      status: tr.status || TransactionStatus.APPROVED,
      transferId: tr.id,
      createdBy: tr.createdBy,
      createdAt: tr.createdAt,
      source: 'treasury',
      buildingId: tr.fromType === 'BUILDING' ? tr.fromId : (tr.toType === 'BUILDING' ? tr.toId : undefined),
      expenseCategory: '',
    } as any));

    const interBuildingPseudo: any[] = [];
    const bookOf = (value: any): string => {
      const s = String(value || '');
      return s.includes(':') ? s.slice(0, s.indexOf(':')) : '';
    };
    (transfers || []).forEach((tr: any) => {
      if (tr.deleted) return;
      if (!(tr.fromType === 'BUILDING' && tr.toType === 'BUILDING' && tr.fromId && tr.toId && tr.fromId !== tr.toId)) return;
      const isCrossBook = (tr.sourceBookId && tr.destBookId && tr.sourceBookId !== tr.destBookId)
        || (!!bookOf(tr.fromId) && !!bookOf(tr.toId) && bookOf(tr.fromId) !== bookOf(tr.toId));
      if (isCrossBook) return;
      const fromRaw = rawOfBuilding(tr.fromId);
      const toRaw = rawOfBuilding(tr.toId);
      const linked = transactions.filter(tx => String((tx as any).transferId || '') === String(tr.id || '') && (tx as any).buildingId);
      const hasSource = linked.some(tx => rawOfBuilding((tx as any).buildingId) === fromRaw);
      const hasDest = linked.some(tx => rawOfBuilding((tx as any).buildingId) === toRaw);
      const base = {
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
        status: tr.status || TransactionStatus.APPROVED,
        transferId: tr.id,
        createdBy: tr.createdBy,
        createdAt: tr.createdAt,
        source: 'treasury',
        expenseCategory: '',
      };
      if (!hasSource) interBuildingPseudo.push({ ...base, id: `pseudo_${tr.id}_src`, type: TransactionType.EXPENSE, buildingId: fromRaw, interBuildingRole: 'SOURCE' });
      if (!hasDest) interBuildingPseudo.push({ ...base, id: `pseudo_${tr.id}_dst`, type: TransactionType.INCOME, buildingId: toRaw, interBuildingRole: 'DEST' });
    });

    let ledgerRows = [...transactions, ...buildingOwnerPseudo, ...interBuildingPseudo].filter((row: any) => {
      if (!isApprovedBankRow(row)) return false;
      if (!passesBuilding(row)) return false;
      if (isOpeningBalance(row)) return false;
      if (row.source === 'treasury') {
        const ft = row.fromType;
        const tt = row.toType;
        if ((ft === 'OWNER' && tt === 'HEAD_OFFICE') || (ft === 'HEAD_OFFICE' && tt === 'OWNER')) return false;
      }
      return true;
    });
    const byLeg = new Map<string, any[]>();
    ledgerRows.forEach(row => {
      const tid = String(row?.transferId || '').trim();
      if (!tid) return;
      const key = `${tid}::${rawOfBuilding(row.buildingId)}::${String(row?.type || '').toUpperCase()}`;
      const list = byLeg.get(key) || [];
      list.push(row);
      byLeg.set(key, list);
    });
    const dropIds = new Set<string>();
    byLeg.forEach(list => {
      if (list.length <= 1) return;
      list.sort((a, b) => {
        const ap = String(a.id || '').startsWith('pseudo_') ? 1 : 0;
        const bp = String(b.id || '').startsWith('pseudo_') ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
      });
      list.slice(1).forEach(row => dropIds.add(String(row.id)));
    });
    ledgerRows = ledgerRows.filter(row => !dropIds.has(String(row.id)));

    const recordMovement = (row: any, bankName: string, signedAmount: number, movementType?: string) => {
      const clean = String(bankName || '').trim();
      if (!clean || !signedAmount) return;
      const summary = ensure(clean);
      const date = String(row.date || '');
      const movement: BankMovement = {
        id: String(row.id || `${clean}-${date}-${summary.movements.length}`),
        date,
        bankName: summary.name,
        type: movementType || String(row.type || ''),
        direction: signedAmount >= 0 ? 'in' : 'out',
        amount: Math.abs(signedAmount),
        signedAmount,
        details: String(row.details || row.purpose || row.expenseCategory || row.incomeCategory || ''),
        building: buildingNameFor(row),
        method: String(row.originalPaymentMethod || row.paymentMethod || ''),
        status: String(row.status || TransactionStatus.APPROVED),
      };
      if (date && date < periodStart) {
        summary.opening += signedAmount;
        return;
      }
      if (!date || date > periodEnd) return;
      if (bankMovementFilter !== 'all' && movement.direction !== bankMovementFilter) return;
      if (search) {
        const haystack = [
          movement.date,
          movement.bankName,
          movement.type,
          movement.details,
          movement.building,
          movement.method,
          movement.status,
          String(movement.amount),
          String(movement.signedAmount),
        ].join(' ').toLowerCase();
        if (!haystack.includes(search)) return;
      }
      if (signedAmount >= 0) summary.income += signedAmount;
      else summary.expense += Math.abs(signedAmount);
      summary.transactionCount += 1;
      summary.movements.push(movement);
    };

    ledgerRows.forEach((t: any) => {
      if (!transactionCountsAsBankForSplit(t)) return;
      const amount = reportMoneyAmount(t as Transaction);
      if (!amount) return;
      const source = String(t.source || '');
      const pm = String(t.paymentMethod || '');
      if (source === 'treasury' || pm === 'TREASURY') {
        if (t.fromBankName) recordMovement(t, t.fromBankName, -Math.abs(amount), 'Transfer Out');
        if (t.toBankName) recordMovement(t, t.toBankName, Math.abs(amount), 'Transfer In');
        if (!t.fromBankName && !t.toBankName && t.bankName) {
          const sign = normalizeTransactionType(t.type) === TransactionType.INCOME ? 1 : -1;
          recordMovement(t, t.bankName, sign * Math.abs(amount), String(t.type || 'Treasury'));
        }
        return;
      }
      const sign = normalizeTransactionType(t.type) === TransactionType.INCOME ? 1 : -1;
      recordMovement(t, t.bankName || t.fromBankName || t.toBankName || unassignedBankName, sign * Math.abs(amount), String(t.type || 'Transaction'));
    });

    const rows = Array.from(summaries.values()).map(row => ({
      ...row,
      closing: row.opening + row.income - row.expense,
      movements: row.movements.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    })).sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing));
    const visible = bankReportFilter === 'all'
      ? rows
      : rows.filter(row => row.key === bankKey(bankReportFilter));
    const movements = visible.flatMap(row => row.movements.map(m => ({ ...m, bankName: row.name })))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
      rows,
      visible,
      movements,
      totals: {
        opening: visible.reduce((s, row) => s + row.opening, 0),
        income: visible.reduce((s, row) => s + row.income, 0),
        expense: visible.reduce((s, row) => s + row.expense, 0),
        closing: visible.reduce((s, row) => s + row.closing, 0),
        transactionCount: visible.reduce((s, row) => s + row.transactionCount, 0),
      },
    };
  }, [banks, buildings, transactions, transfers, reportSettings, buildingFilter, bankReportFilter, bankMonthFilter, bankMovementFilter, bankReportSearch]);

  // ── Owner Expenses & Opening Balances ──
  const ownerExpensesData = useMemo(() => {
    let filteredTxs: Transaction[] = [
      ...approvedForOwnerTab.filter(t =>
        (t.expenseCategory === 'Owner Expense' || t.expenseCategory === ExpenseCategory.OWNER_EXPENSE || t.expenseCategory === 'Owner Profit Withdrawal')
        && !t.isOwnerOpeningBalance, // Exclude opening balance transactions
      ),
      ...(allBuildingOwnerTreasuryRowsForReports as Transaction[]),
      ...headOfficeOwnerSyntheticTransactions,
    ];
    filteredTxs = filteredTxs.filter(t => {
      const oid =
        resolveOwnerIdForOwnerReport(t, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        '';
      return (
        passesViewerStaffOwnerScope(t, currentUser, activeBookId) &&
        passesOwnerStakeBuildingFilter(t, oid, employees, activeBookId)
      );
    });
    if (ownerFilter !== 'all') {
      const of = String(ownerFilter);
      filteredTxs = filteredTxs.filter(t => {
        const oid =
          resolveOwnerIdForOwnerReport(t, employees) ||
          String((t as any).ownerId || '').trim() ||
          ownerIdFromTreasuryBuildingOwnerTx(t);
        return oid === of || rawIdSegment(oid) === rawIdSegment(of);
      });
    }
    const byOwner: Record<string, { name: string; transactions: Transaction[]; total: number }> = {};
    filteredTxs.forEach(t => {
      const ownerId =
        resolveOwnerIdForOwnerReport(t, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        'unknown';
      const cust = customers.find(c => c.id === ownerId || c.id === rawIdSegment(ownerId));
      const ownerName = (t as any).ownerName
        || employees.find((e: any) => String(e.id) === ownerId || String(e.id) === rawIdSegment(ownerId))?.name
        || (cust && (cust.nameEn || cust.nameAr))?.trim()
        || 'Unknown Owner';
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = { name: ownerName, transactions: [], total: 0 };
      }
      byOwner[ownerId].transactions.push(t);
      byOwner[ownerId].total += ownerReportLineAmount(t);
    });
    return Object.entries(byOwner).map(([id, v]) => ({
      id,
      name: v.name,
      transactions: v.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      total: v.total
    })).sort((a, b) => b.total - a.total);
  }, [approvedForOwnerTab, allBuildingOwnerTreasuryRowsForReports, headOfficeOwnerSyntheticTransactions, customers, employees, ownerFilter, activeBookId, currentUser]);

  // Combined Owner Report Data - Opening Balance (includes previous months) + This Month
  const ownerCombinedData = useMemo(() => {
    // Always use actual current month boundaries (opening = through last month's last day)
    const _now = new Date();
    const currentMonthStart = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`;
    const _lastDay = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
    const currentMonthEnd = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_lastDay).padStart(2, '0')}`;

    const isApprovedLedgerRow = (t: any) =>
      (t.status === TransactionStatus.APPROVED || !t.status);

    const isTreasuryInternalRow = (t: any) => {
      const pm = String((t as any).paymentMethod ?? '');
      return (
        (t as any).source === 'treasury' ||
        pm === 'TREASURY' ||
        pm === 'TREASURY_REVERSAL' ||
        !!(t as any).isReversal
      );
    };

    /** Same non-date rules as Report `filtered`, without applying rangeStart/rangeEnd. */
    const passesReportScopeNoDate = (t: any) => {
      if ((t as any).deleted) return false;
      if (!isApprovedLedgerRow(t)) return false;
      if (isTreasuryInternalRow(t)) return false;
      if (!transactionMatchesOwnerReportBuilding(t, ownerReportBuildingConstraint, activeBookId)) return false;
      return true;
    };

    const isOwnerOpeningEntry = (t: any) =>
      t.isOwnerOpeningBalance === true ||
      String(t.expenseCategory || '').trim() === 'Owner Opening Balance' ||
      (t.borrowingType === 'OPENING_BALANCE' && !!(t as any).ownerId);

    // Owner opening balance rows must show for ALL TIME — do not tie them to the
    // selected Reports period (this month / this year / custom range).
    let openingBalanceTxs = transactionsForOwnerReports.filter((t: any) => {
      if (!passesReportScopeNoDate(t) || !isOwnerOpeningEntry(t)) return false;
      if (!passesViewerStaffOwnerScope(t as Transaction, currentUser, activeBookId)) return false;
      const oidOb =
        resolveOwnerIdForOwnerReport(t as Transaction, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        '';
      return passesOwnerStakeBuildingFilter(t as Transaction, oidOb, employees, activeBookId);
    });

    // Period-scoped owner expenses: entry form categories + Treasury Building↔Owner legs.
    let allOwnerExpenses: Transaction[] = [
      ...approvedForOwnerTab.filter((t: any) => {
        const cat = String(t.expenseCategory || '').trim();
        const isOwnerCat =
          cat === 'Owner Expense' ||
          cat === ExpenseCategory.OWNER_EXPENSE ||
          cat === 'Owner Profit Withdrawal';
        return isOwnerCat && !t.isOwnerOpeningBalance;
      }),
      ...(allBuildingOwnerTreasuryRowsForReports as Transaction[]),
      ...headOfficeOwnerSyntheticTransactions,
    ];
    allOwnerExpenses = allOwnerExpenses.filter(t => {
      const oid =
        resolveOwnerIdForOwnerReport(t, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        '';
      return (
        passesViewerStaffOwnerScope(t, currentUser, activeBookId) &&
        passesOwnerStakeBuildingFilter(t, oid, employees, activeBookId)
      );
    });

    if (ownerFilter !== 'all') {
      const of = String(ownerFilter);
      allOwnerExpenses = allOwnerExpenses.filter(t => {
        const oid =
          resolveOwnerIdForOwnerReport(t, employees) ||
          String((t as any).ownerId || '').trim() ||
          ownerIdFromTreasuryBuildingOwnerTx(t);
        return oid === of || rawIdSegment(oid) === rawIdSegment(of);
      });
      openingBalanceTxs = openingBalanceTxs.filter(t => {
        const oid =
          resolveOwnerIdForOwnerReport(t, employees) ||
          String((t as any).ownerId || '').trim() ||
          ownerIdFromTreasuryBuildingOwnerTx(t);
        return oid === of || rawIdSegment(oid) === rawIdSegment(of);
      });
    }
    if (ownerReportBuildingConstraint.mode !== 'all') {
      allOwnerExpenses = allOwnerExpenses.filter(t =>
        transactionMatchesOwnerReportBuilding(t, ownerReportBuildingConstraint, activeBookId),
      );
      openingBalanceTxs = openingBalanceTxs.filter(t =>
        transactionMatchesOwnerReportBuilding(t, ownerReportBuildingConstraint, activeBookId),
      );
    }
    
    // Build combined data by owner
    const byOwner: Record<string, {
      name: string;
      openingBalance: number;
      openingBalanceTxs: Transaction[]; // Contains both actual opening balance entries AND previous months expenses
      thisMonthExpenses: number;
      thisMonthTxs: Transaction[];
      subtotal: number;
    }> = {};
    
    // Process opening balances
    openingBalanceTxs.forEach(t => {
      const ownerId =
        resolveOwnerIdForOwnerReport(t, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        'unknown';
      const custOb = customers.find(c => c.id === ownerId || c.id === rawIdSegment(ownerId));
      const ownerName = (t as any).ownerName
        || employees.find((e: any) => String(e.id) === ownerId || String(e.id) === rawIdSegment(ownerId))?.name
        || (custOb && (custOb.nameEn || custOb.nameAr))?.trim()
        || 'Unknown Owner';
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = {
          name: ownerName,
          openingBalance: 0,
          openingBalanceTxs: [],
          thisMonthExpenses: 0,
          thisMonthTxs: [],
          subtotal: 0
        };
      }
      byOwner[ownerId].openingBalance += reportMoneyAmount(t);
      byOwner[ownerId].openingBalanceTxs.push(t);
    });
    
    // Process owner expenses - previous months go to opening balance, this month separate
    allOwnerExpenses.forEach(t => {
      const ownerId =
        resolveOwnerIdForOwnerReport(t, employees) ||
        String((t as any).ownerId || '').trim() ||
        ownerIdFromTreasuryBuildingOwnerTx(t) ||
        'unknown';
      const custEx = customers.find(c => c.id === ownerId || c.id === rawIdSegment(ownerId));
      const ownerName = (t as any).ownerName
        || employees.find((e: any) => String(e.id) === ownerId || String(e.id) === rawIdSegment(ownerId))?.name
        || (custEx && (custEx.nameEn || custEx.nameAr))?.trim()
        || 'Unknown Owner';
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = {
          name: ownerName,
          openingBalance: 0,
          openingBalanceTxs: [],
          thisMonthExpenses: 0,
          thisMonthTxs: [],
          subtotal: 0
        };
      }
      
      const txDate = t.date || '';
      const lineAmt = ownerReportLineAmount(t);
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        byOwner[ownerId].thisMonthExpenses += lineAmt;
        byOwner[ownerId].thisMonthTxs.push(t);
      } else if (txDate < currentMonthStart) {
        // Previous months expenses are added to opening balance
        byOwner[ownerId].openingBalance += lineAmt;
        byOwner[ownerId].openingBalanceTxs.push(t);
      } else if (txDate >= rangeStart && txDate <= rangeEnd) {
        // Later in the selected period than current calendar month (totals must not drop these)
        byOwner[ownerId].openingBalance += lineAmt;
        byOwner[ownerId].openingBalanceTxs.push(t);
      }
    });

    // Calculate subtotals
    Object.values(byOwner).forEach(owner => {
      owner.subtotal = owner.openingBalance + owner.thisMonthExpenses;
    });
    
    return Object.entries(byOwner).map(([id, data]) => ({
      id,
      ...data
    })).sort((a, b) => b.subtotal - a.subtotal);
  }, [transactionsForOwnerReports, approvedForOwnerTab, allBuildingOwnerTreasuryRowsForReports, headOfficeOwnerSyntheticTransactions, customers, employees, ownerFilter, ownerReportBuildingConstraint, rangeStart, rangeEnd, activeBookId, currentUser]);

  // ── Top Customers by Revenue ──
  const topCustomers = useMemo(() => {
    const cmap: Record<string, { name: string; total: number }> = {};
    income.forEach(t => {
      const con = contracts.find(c => c.id === t.contractId);
      if (con) {
        if (!cmap[con.customerId]) cmap[con.customerId] = { name: formatCustomerFromMap(con.customerName, con.customerId, customerRoomMap), total: 0 };
        cmap[con.customerId].total += Number(t.amount) || 0;
      }
    });
    return Object.entries(cmap).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [income, contracts, customerRoomMap]);

  // ── Print ──
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px;direction:${isRTL ? 'rtl' : 'ltr'}}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #ddd;padding:8px;text-align:${isRTL ? 'right' : 'left'}}
      th{background:#059669;color:white}
      .kpi{display:inline-block;border:1px solid #ddd;border-radius:8px;padding:12px 20px;margin:6px;min-width:150px}
      h1,h2,h3{color:#064e3b}
      @media print{button{display:none !important}}
      </style></head><body>${content.innerHTML}
      <script>window.print();window.close();</script></body></html>`);
    win.document.close();
  };

  // ── Print Owner Expense Report ──
  const handlePrintOwnerExpense = (ownerId?: string) => {
    const ownersList = ownerId ? ownerCombinedData.filter(o => o.id === ownerId) : ownerCombinedData;
    if (!ownersList.length) return;

    const origin = window.location.origin;
    const reportDate = new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const periodLabel = `${rangeStart} to ${rangeEnd}`;

    const txRow = (tx: any, isNeg = false) => {
      const line = ownerReportLineAmount(tx as Transaction);
      const neg = isNeg || line < 0;
      const detail =
        (tx.details ||
          tx.purpose ||
          (String(tx.id || '').startsWith('transfer:') ? 'Treasury (Head Office ↔ Owner)' : '') ||
          (isNeg ? 'Return to Head Office' : t('history.ownerExpenses'))) + ownerCrossBookSuffix(tx);
      return `
      <tr>
        <td>${new Date(tx.date).toLocaleDateString('en-SA')}</td>
        <td>${detail}</td>
        <td class="amt ${neg ? 'neg' : ''}">SAR ${fmt(Math.abs(line))}</td>
      </tr>`;
    };

    const generateOwnerSection = (owner: typeof ownerCombinedData[0], isFirst: boolean) => `
      <div class="owner-block ${isFirst ? '' : 'page-break'}">
        <!-- Owner header band -->
        <div class="owner-header">
          <div class="owner-avatar">${owner.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="owner-name">${owner.name}</div>
            <div class="owner-sub">${t('reports.ownerAccountStatement')} &bull; ${periodLabel}</div>
          </div>
          <div class="owner-total-pill">TOTAL&nbsp;&nbsp;SAR ${fmt(owner.subtotal)}</div>
        </div>

        <!-- Summary row -->
        <div class="summary-row">
          <div class="summary-cell violet">
            <div class="sc-label">${t('reports.openingBalance')}</div>
            <div class="sc-value">SAR ${fmt(owner.openingBalance)}</div>
            <div class="sc-sub">${owner.openingBalanceTxs.length} ${t('reports.entryies')}</div>
          </div>
          <div class="summary-cell emerald">
            <div class="sc-label">${t('common.thisMonth')}</div>
            <div class="sc-value">SAR ${fmt(owner.thisMonthExpenses)}</div>
            <div class="sc-sub">${owner.thisMonthTxs.length} ${t('reports.transactions')}</div>
          </div>
          <div class="summary-cell gold">
            <div class="sc-label">${t('reports.totalOwedSubtitle')}</div>
            <div class="sc-value">SAR ${fmt(owner.subtotal)}</div>
            <div class="sc-sub">Accumulated</div>
          </div>
        </div>

        ${owner.openingBalanceTxs.length > 0 ? `
        <div class="section-label violet-label">${t('reports.openingBalanceTill')}</div>
        <table class="tx-table">
          <thead><tr><th>${t('common.date')}</th><th>${t('common.details')}</th><th>${t('common.amount')}</th></tr></thead>
          <tbody>${owner.openingBalanceTxs.map(tx => txRow(tx)).join('')}</tbody>
          <tfoot><tr class="foot-row violet-foot"><td colspan="2">${t('invoice.subtotal')} (${t('reports.openingBalance')})</td><td class="amt">SAR ${fmt(owner.openingBalance)}</td></tr></tfoot>
        </table>` : ''}

        ${owner.thisMonthTxs.length > 0 ? `
        <div class="section-label emerald-label">${t('common.thisMonth')}</div>
        <table class="tx-table">
          <thead><tr><th>${t('common.date')}</th><th>${t('common.details')}</th><th>${t('common.amount')}</th></tr></thead>
          <tbody>${owner.thisMonthTxs.map(tx => txRow(tx, ownerReportLineAmount(tx as Transaction) < 0)).join('')}</tbody>
          <tfoot><tr class="foot-row emerald-foot"><td colspan="2">${t('invoice.subtotal')} (${t('common.thisMonth')})</td><td class="amt">SAR ${fmt(owner.thisMonthExpenses)}</td></tr></tfoot>
        </table>` : ''}

            <div class="grand-total-bar">
          <span>${t('reports.grandTotalFor')} ${owner.name}</span>
          <span class="gt-val">SAR ${fmt(owner.subtotal)}</span>
        </div>
      </div>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Owner Expense Report &mdash; ${reportDate}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f0f4f8;
      color: #1e293b;
      font-size: 13px;
    }
    .page-wrapper {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    /* ── LETTERHEAD ── */
    .letterhead {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%);
      border-radius: 20px 20px 0 0;
      padding: 28px 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .letterhead::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 220px; height: 220px;
      background: radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%);
      border-radius: 50%;
    }
    .letterhead::after {
      content: '';
      position: absolute;
      bottom: -40px; left: 80px;
      width: 160px; height: 160px;
      background: radial-gradient(circle, rgba(99,179,237,0.07) 0%, transparent 70%);
      border-radius: 50%;
    }
    .lh-left { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
    .lh-cologo { width: 56px; height: 56px; object-fit: contain; filter: brightness(1); }
    .lh-title { color: #fff; }
    .lh-company { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; }
    .lh-company-ar { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 2px; }
    .lh-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; position: relative; z-index: 1; }
    .lh-badge {
      background: linear-gradient(135deg, #b8860b, #daa520, #b8860b);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 999px;
    }
    .lh-logo { width: 44px; height: 44px; object-fit: contain; }
    .lh-date { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 4px; }

    /* ── SUBHEADER ── */
    .subheader {
      background: linear-gradient(90deg, #b8860b, #daa520, #c9973a);
      padding: 10px 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .subheader-title { color: #fff; font-size: 15px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .subheader-period { color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600; }

    /* ── DOC BODY ── */
    .doc-body {
      background: #ffffff;
      border-radius: 0 0 20px 20px;
      padding: 28px 36px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10);
    }

    /* ── OWNER BLOCK ── */
    .owner-block { margin-bottom: 36px; }
    .owner-header {
      display: flex;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, #1e293b, #334155);
      border-radius: 14px 14px 0 0;
      padding: 18px 22px;
      color: #fff;
    }
    .owner-avatar {
      width: 48px; height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #daa520, #b8860b);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 900; color: #fff;
      flex-shrink: 0;
    }
    .owner-name { font-size: 18px; font-weight: 800; }
    .owner-sub { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 3px; }
    .owner-total-pill {
      margin-left: auto;
      background: linear-gradient(135deg, #b8860b, #daa520);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      padding: 8px 18px;
      border-radius: 999px;
      white-space: nowrap;
      letter-spacing: 0.5px;
    }

    /* ── SUMMARY ROW ── */
    .summary-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid #e2e8f0;
      border-top: none;
    }
    .summary-cell { padding: 16px 18px; border-right: 1px solid #e2e8f0; }
    .summary-cell:last-child { border-right: none; }
    .summary-cell.violet { background: #faf5ff; }
    .summary-cell.emerald { background: #f0fdf4; }
    .summary-cell.gold { background: #fffbeb; }
    .sc-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 6px; }
    .summary-cell.violet .sc-label { color: #7c3aed; }
    .summary-cell.emerald .sc-label { color: #059669; }
    .summary-cell.gold .sc-label { color: #b8860b; }
    .sc-value { font-size: 18px; font-weight: 900; color: #1e293b; }
    .summary-cell.violet .sc-value { color: #5b21b6; }
    .summary-cell.emerald .sc-value { color: #047857; }
    .summary-cell.gold .sc-value { color: #92400e; }
    .sc-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    /* ── SECTION LABEL ── */
    .section-label {
      font-size: 10px; font-weight: 800; letter-spacing: 2px;
      text-transform: uppercase; padding: 10px 18px 8px;
      border-left: 3px solid #cbd5e1;
      margin: 20px 0 6px;
      color: #64748b;
    }
    .violet-label { border-color: #7c3aed; color: #5b21b6; background: #faf5ff; }
    .emerald-label { border-color: #059669; color: #047857; background: #f0fdf4; }

    /* ── TRANSACTION TABLE ── */
    .tx-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .tx-table thead tr { background: #f8fafc; }
    .tx-table th {
      padding: 9px 12px; text-align: left;
      font-size: 9px; font-weight: 800; letter-spacing: 1.5px;
      text-transform: uppercase; color: #64748b;
      border-bottom: 2px solid #e2e8f0;
    }
    .tx-table th:last-child, .tx-table td:last-child { text-align: right; }
    .tx-table tbody tr { border-bottom: 1px solid #f1f5f9; }
    .tx-table tbody tr:nth-child(even) { background: #fafafa; }
    .tx-table tbody tr:hover { background: #f8fafc; }
    .tx-table td { padding: 9px 12px; color: #334155; }
    .amt { font-family: 'Courier New', monospace; font-weight: 700; color: #1e293b; }
    .amt.neg { color: #dc2626; }
    .foot-row td { padding: 10px 12px; font-weight: 800; font-size: 12px; }
    .violet-foot { background: #ede9fe; color: #5b21b6; }
    .emerald-foot { background: #d1fae5; color: #047857; }
    .violet-foot .amt { color: #5b21b6; }
    .emerald-foot .amt { color: #047857; }

    /* ── GRAND TOTAL BAR ── */
    .grand-total-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #0f172a, #1e3a5f);
      color: #fff;
      padding: 14px 22px;
      border-radius: 0 0 14px 14px;
      margin-top: 12px;
      font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
    }
    .gt-val { font-size: 20px; font-weight: 900; color: #fbbf24; }

    /* ── REPORT FOOTER ── */
    .report-footer {
      margin-top: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 16px;
      border-top: 2px solid #e2e8f0;
    }
    .rf-left { display: flex; align-items: center; gap: 10px; }
    .rf-logo { width: 32px; height: 32px; object-fit: contain; }
    .rf-text { font-size: 10px; color: #94a3b8; font-weight: 600; }
    .rf-right { font-size: 10px; color: #94a3b8; text-align: right; }

    /* ── PRINT ── */
    @media print {
      body { background: #fff; }
      .page-wrapper { padding: 0; max-width: 100%; }
      .letterhead { border-radius: 0; }
      .doc-body { border-radius: 0; box-shadow: none; padding: 20px; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      @page { margin: 0.7cm; size: A4 portrait; }
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">

    <!-- PRINT BUTTON -->
    <div class="no-print" style="margin-bottom:16px;text-align:right">
      <button onclick="window.print()" style="background:linear-gradient(135deg,#b8860b,#daa520);color:#fff;border:none;padding:10px 28px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1px;">&#128438; Print / Save PDF</button>
    </div>

    <!-- LETTERHEAD -->
    <div class="letterhead">
      <div class="lh-left">
        <img src="${origin}/images/cologo.png" class="lh-cologo" alt="Company Logo" onerror="this.style.display='none'" />
        <div class="lh-title">
          <div class="lh-company">${reportSettings?.companyName || ''}</div>
          <div class="lh-company-ar">${reportSettings?.companyNameAr || ''}</div>
        </div>
      </div>
      <div class="lh-right">
        <div class="lh-badge">${t('reports.tab.ownerExpense').toUpperCase()}</div>
        <img src="${origin}/images/cologo.png" class="lh-logo" alt="Amlak Logo" onerror="this.style.display='none'" />
        <div class="lh-date">${reportDate}</div>
      </div>
    </div>

    <!-- SUBHEADER -->
    <div class="subheader">
      <span class="subheader-title">${t('reports.ownerAccountStatement')}</span>
      <span class="subheader-period">Period: ${periodLabel}</span>
    </div>

    <!-- DOCUMENT BODY -->
    <div class="doc-body">
      ${ownersList.length > 1 ? `
      <!-- OWNER COMPARISON TABLE -->
      <div style="margin-bottom:36px">
        <div style="background:linear-gradient(135deg,#334155,#1e293b);border-radius:14px 14px 0 0;padding:14px 22px;color:#fff;font-size:14px;font-weight:800;letter-spacing:1px;">${t('reports.ownerComparison').toUpperCase()}</div>
        <table class="tx-table" style="border:1px solid #e2e8f0">
          <thead><tr style="background:#f1f5f9">
            <th style="text-align:left">${t('reports.owner')}</th>
            <th style="text-align:right">${t('reports.openingBalance')}</th>
            <th style="text-align:right">${t('common.thisMonth')}</th>
            <th style="text-align:right">${t('reports.totalOwedHeader')}</th>
            <th style="text-align:right">${t('reports.difference')}</th>
            <th style="text-align:right">${t('reports.sharePct')}</th>
          </tr></thead>
          <tbody>${(() => {
            const gt = ownersList.reduce((s: number, o: any) => s + o.subtotal, 0);
            return ownersList.map((o: any, i: number) => {
              const diff = i === 0 ? 0 : o.subtotal - ownersList[i - 1].subtotal;
              const share = gt !== 0 ? (o.subtotal / gt) * 100 : 0;
              return `<tr>
                <td style="font-weight:700">${o.name}</td>
                <td class="amt" style="text-align:right">SAR ${fmt(o.openingBalance)}</td>
                <td class="amt" style="text-align:right">SAR ${fmt(o.thisMonthExpenses)}</td>
                <td class="amt" style="text-align:right;font-weight:900">SAR ${fmt(o.subtotal)}</td>
                <td style="text-align:right;font-weight:700;color:${i === 0 ? '#64748b' : diff > 0 ? '#dc2626' : '#059669'}">${i === 0 ? 'Highest' : (diff > 0 ? '+' : '') + fmt(diff)}</td>
                <td style="text-align:right;font-weight:700">${share.toFixed(1)}%</td>
              </tr>`;
            }).join('');
          })()}</tbody>
          <tfoot><tr style="background:#1e293b;color:#fff">
            <td style="font-weight:800">${t('reports.grandTotal')}</td>
            <td class="amt" style="text-align:right;color:#fff">SAR ${fmt(ownersList.reduce((s: number, o: any) => s + o.openingBalance, 0))}</td>
            <td class="amt" style="text-align:right;color:#fff">SAR ${fmt(ownersList.reduce((s: number, o: any) => s + o.thisMonthExpenses, 0))}</td>
            <td class="amt" style="text-align:right;color:#fbbf24;font-weight:900">SAR ${fmt(ownersList.reduce((s: number, o: any) => s + o.subtotal, 0))}</td>
            <td></td>
            <td style="text-align:right;color:#94a3b8;font-weight:700">100%</td>
          </tr></tfoot>
        </table>
      </div>
      ` : ''}

      ${ownersList.map((owner, idx) => generateOwnerSection(owner, idx === 0)).join('')}

      <!-- REPORT FOOTER -->
      <div class="report-footer">
        <div class="rf-left">
          <img src="${origin}/images/cologo.png" class="rf-logo" alt="Amlak" onerror="this.style.display='none'" />
          <div class="rf-text">Powered by Amlak &bull; ${reportSettings?.companyName || ''} &copy; ${new Date().getFullYear()}</div>
        </div>
        <div class="rf-right">
          Generated on ${reportDate}<br/>This is a computer-generated document
        </div>
      </div>
    </div>

  </div>
  <script>
    window.onload = function() {
      var imgs = document.images, c = 0, t = imgs.length;
      if (!t) { return; }
      function tryPrint() { /* auto-print removed so user can review first */ }
      for (var i = 0; i < t; i++) {
        if (imgs[i].complete) { if (++c >= t) tryPrint(); }
        else { imgs[i].onload = imgs[i].onerror = function() { if (++c >= t) tryPrint(); }; }
      }
    };
  </script>
</body>
</html>`);
    win.document.close();
    win.focus();
  };

  // ── CSV Export ──
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActiveReportPDF = () => {
    const esc = (value: any) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const sar = (value: number) => `SAR ${fmt(Number(value) || 0)}`;
    const tabLabel = tabs.find(tab => tab.key === activeTab)?.label || 'Report';
    const buildingLabel = activeTab === 'ownerExpense' && canViewOwnerExpenses
      ? (ownerExpenseExcludedBuildingIds.length === 0
        ? t('history.allBuildings')
        : ownerExpenseIncludedBuildings.map((b: any) => b.name).join(', '))
      : (buildingFilter === 'all' ? t('history.allBuildings') : buildings.find(b => b.id === buildingFilter)?.name || buildingFilter);
    const ownerLabel = ownerFilter === 'all'
      ? t('reports.allOwners')
      : employees.find((employee: any) => String(employee.id) === String(ownerFilter))?.name || ownerFilter;
    const bankLabel = bankReportFilter === 'all' ? t('reports.allBanks') : bankReportFilter;

    const buildingOccupancyRows = buildings.map((b) => {
      const totalUnits = b.units?.length || 0;
      const activeContracts = contracts.filter(c => c.buildingId === b.id && c.status === 'Active');
      const occupiedUnits = new Set(activeContracts.map(c => c.unitName)).size;
      const pct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
      return [b.name, String(totalUnits), String(occupiedUnits), `${pct}%`];
    });

    const report = (() => {
      if (activeTab === 'financial') {
        return {
          columns: ['Period', 'Income', 'Expense', 'Net', 'Margin'],
          rows: monthlyData.map(m => [m.month, sar(m.income), sar(m.expense), sar(m.net), m.income > 0 ? `${((m.net / m.income) * 100).toFixed(1)}%` : '-']),
          summary: [
            ['Total income', sar(totalIncome)],
            ['Total expense', sar(totalExpense)],
            ['Net position', sar(netProfit)],
          ],
        };
      }
      if (activeTab === 'occupancy') {
        return {
          columns: ['Building', 'Total Units', 'Occupied', 'Occupancy'],
          rows: buildingOccupancyRows,
          summary: [
            ['Total units', String(occupancy.totalUnits)],
            ['Occupied units', String(occupancy.occupiedUnits)],
            ['Occupancy', `${occupancy.percentage}%`],
          ],
        };
      }
      if (activeTab === 'tenant') {
        return {
          columns: ['Tenant', 'Revenue'],
          rows: topCustomers.map(c => [c.name, sar(c.total)]),
          summary: [
            ['Total tenants', String(customers.length)],
            ['Active contracts', String(contractStats.active)],
            ['Top tenants shown', String(topCustomers.length)],
          ],
        };
      }
      if (activeTab === 'expense') {
        return {
          columns: ['Category', 'Amount', 'Share'],
          rows: expenseByCat.map(c => [c.name, sar(c.value), totalExpense > 0 ? `${((c.value / totalExpense) * 100).toFixed(1)}%` : '0%']),
          summary: [
            ['Total expense', sar(totalExpense)],
            ['Categories', String(expenseByCat.length)],
            ['Transactions', String(expenses.length)],
          ],
        };
      }
      if (activeTab === 'salary') {
        return {
          columns: ['Employee', 'Gross Pay', 'Bonus', 'Deductions', 'Payments'],
          rows: salaryData.map(e => [e.name, sar(e.total), sar(e.bonus), sar(e.deductions), String(e.count)]),
          summary: [
            ['Total salaries', sar(salaryData.reduce((sum, e) => sum + e.total, 0))],
            ['Employees paid', String(salaryData.length)],
            ['Total deductions', sar(salaryData.reduce((sum, e) => sum + e.deductions, 0))],
          ],
        };
      }
      if (activeTab === 'building') {
        return {
          columns: ['Building', 'Income', 'Expense', 'Net', 'ROI'],
          rows: buildingRevenue.map(b => [b.name, sar(b.income), sar(b.expense), sar(b.net), b.income > 0 ? `${((b.net / b.income) * 100).toFixed(1)}%` : '-']),
          summary: [
            ['Buildings', String(buildingRevenue.length)],
            ['Income', sar(buildingRevenue.reduce((sum, b) => sum + b.income, 0))],
            ['Expense', sar(buildingRevenue.reduce((sum, b) => sum + b.expense, 0))],
          ],
        };
      }
      if (activeTab === 'collection') {
        return {
          columns: ['Tenant', 'Contracted', 'Paid', 'Balance', 'Collection'],
          rows: filteredTenantCollection.map(row => [row.name, sar(row.contracted), sar(row.paid), sar(row.balance), `${row.percentage}%`]),
          summary: [
            ['Total contracted', sar(filteredTenantCollection.reduce((sum, row) => sum + row.contracted, 0))],
            ['Total collected', sar(filteredTenantCollection.reduce((sum, row) => sum + row.paid, 0))],
            ['Outstanding', sar(filteredTenantCollection.reduce((sum, row) => sum + row.balance, 0))],
          ],
        };
      }
      if (activeTab === 'bank') {
        return {
          columns: ['Bank', 'Opening', 'Income', 'Expense', 'Closing', 'Transactions'],
          rows: bankReportData.visible.map(row => [row.name, sar(row.opening), sar(row.income), sar(row.expense), sar(row.closing), String(row.transactionCount)]),
          summary: [
            ['Opening balance', sar(bankReportData.totals.opening)],
            ['Bank income', sar(bankReportData.totals.income)],
            ['Bank expense', sar(bankReportData.totals.expense)],
            ['Closing balance', sar(bankReportData.totals.closing)],
          ],
        };
      }
      if (activeTab === 'ownerExpense') {
        const rows = ownerCombinedData.flatMap(owner => [
          ...owner.openingBalanceTxs.map(tx => [
            owner.name,
            t('reports.openingBalance'),
            tx.date,
            ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
            sar(ownerReportLineAmount(tx)),
          ]),
          ...owner.thisMonthTxs.map(tx => [
            owner.name,
            t('common.thisMonth'),
            tx.date,
            ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
            sar(ownerReportLineAmount(tx)),
          ]),
        ]);
        return {
          columns: ['Owner', 'Section', 'Date', 'Details', 'Amount'],
          rows,
          summary: [
            ['Owners', String(ownerCombinedData.length)],
            ['Opening balance', sar(ownerCombinedData.reduce((sum, owner) => sum + owner.openingBalance, 0))],
            ['Total owed', sar(ownerCombinedData.reduce((sum, owner) => sum + owner.subtotal, 0))],
          ],
        };
      }
      return {
        columns: ['Period', 'Income', 'Expense', 'Net'],
        rows: monthlyData.map(m => [m.month, sar(m.income), sar(m.expense), sar(m.net)]),
        summary: overviewKPIs.map(kpi => [String(kpi.label), String(kpi.value)]),
      };
    })();

    const filterItems = [
      ...(activeTab === 'bank'
        ? [['Period', bankMonthFilter === 'all' ? t('reports.allTime') : bankMonthFilter]]
        : [
            ['From', rangeStart],
            ['Till', rangeEnd],
          ]),
      ['Building', buildingLabel],
      ...(activeTab === 'ownerExpense' ? [['Owner', ownerLabel]] : []),
      ...(activeTab === 'bank'
        ? [
            ['Bank', bankLabel],
            ['Movement', bankMovementFilter === 'all' ? t('reports.allMovements') : bankMovementFilter === 'in' ? t('reports.moneyIn') : t('reports.moneyOut')],
            ...(bankReportSearch ? [['Search', bankReportSearch]] : []),
          ]
        : []),
      ...(activeTab === 'collection' && collectionSearch ? [['Search', collectionSearch]] : []),
    ];

    const rowsHtml = report.rows.length
      ? report.rows.map(row => `<tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? 'num' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${report.columns.length}" class="empty">No data for this filter.</td></tr>`;

    const origin = window.location.origin;
    const win = window.open('', '_blank', 'width=1100,height=820');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${esc(tabLabel)} PDF Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .page { max-width: 1040px; margin: 24px auto; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 55px rgba(15,23,42,.12); }
    .toolbar { text-align: right; max-width: 1040px; margin: 18px auto 0; }
    .toolbar button { border: 0; border-radius: 999px; padding: 10px 18px; color: #fff; background: #047857; font-weight: 800; cursor: pointer; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px 28px; background: linear-gradient(135deg,#064e3b,#047857); color: #fff; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { width: 52px; height: 52px; object-fit: contain; border-radius: 14px; background: #fff; padding: 5px; }
    h1 { margin: 0; font-size: 22px; }
    .sub { color: #bbf7d0; font-size: 12px; margin-top: 4px; }
    .generated { text-align: right; font-size: 12px; color: #d1fae5; line-height: 1.6; }
    .filters, .summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; padding: 18px 28px; border-bottom: 1px solid #e2e8f0; }
    .chip, .card { border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 12px; padding: 10px 12px; }
    .label { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin-top: 3px; color: #064e3b; font-weight: 900; font-size: 14px; }
    .body { padding: 24px 28px 30px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #065f46; color: #fff; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 10px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 9px 10px; font-size: 12px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: right; font-weight: 800; white-space: nowrap; }
    .empty { text-align: center; color: #94a3b8; padding: 26px; }
    .footer { display: flex; justify-content: space-between; gap: 14px; padding: 14px 28px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none; }
      .page { margin: 0; max-width: none; border-radius: 0; box-shadow: none; }
      @page { size: A4 portrait; margin: 10mm; }
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
          <h1>${esc(tabLabel)} Report</h1>
          <div class="sub">${esc(reportSettings?.companyName || 'Amlak')}</div>
        </div>
      </div>
      <div class="generated">
        <div>Generated: ${esc(new Date().toLocaleString('en-SA'))}</div>
        <div>By: ${esc(currentUser?.name || currentUser?.email || '')}</div>
      </div>
    </section>
    <section class="filters">
      ${filterItems.map(([label, value]) => `<div class="chip"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join('')}
    </section>
    <section class="summary">
      ${report.summary.map(([label, value]) => `<div class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join('')}
    </section>
    <section class="body">
      <table>
        <thead><tr>${report.columns.map(col => `<th>${esc(col)}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>
    <section class="footer">
      <span>This is a computer-generated report.</span>
      <span>Period: ${esc(activeTab === 'bank' ? (bankMonthFilter === 'all' ? t('reports.allTime') : bankMonthFilter) : `${rangeStart} to ${rangeEnd}`)}</span>
    </section>
  </main>
</body>
</html>`);
    win.document.close();
    win.focus();
  };

  // ── Tabs ──
  const viewerRole = String(currentUser?.role || '').toUpperCase();
  const isAdmin = viewerRole === 'ADMIN';
  const isManager = viewerRole === 'MANAGER';
  const canViewOwnerExpenses = isAdmin || isManager; // Treasury staff (Admin/Manager) can view owner expenses
  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = useMemo(() => [
    { key: 'overview', label: t('reports.tab.overview'), icon: <PieChartIcon size={16} /> },
    { key: 'financial', label: t('reports.tab.financial'), icon: <DollarSign size={16} /> },
    { key: 'occupancy', label: t('reports.tab.occupancy'), icon: <Home size={16} /> },
    { key: 'tenant', label: t('reports.tab.tenant'), icon: <Users size={16} /> },
    { key: 'expense', label: t('reports.tab.expense'), icon: <Wallet size={16} /> },
    { key: 'salary', label: t('reports.tab.salary'), icon: <CreditCard size={16} /> },
    { key: 'building', label: t('reports.tab.building'), icon: <Building2 size={16} /> },
    { key: 'collection', label: t('reports.tab.collection'), icon: <Landmark size={16} /> },
    { key: 'bank', label: t('reports.tab.bank'), icon: <CreditCard size={16} /> },
    // Owner Expenses visible to Admin & Manager (treasury staff)
    ...(canViewOwnerExpenses ? [{ key: 'ownerExpense' as ReportTab, label: t('reports.tab.ownerExpense'), icon: <FileText size={16} /> }] : []),
  ], [canViewOwnerExpenses, t]);

  const datePresets: { key: DatePreset; label: string }[] = [
    { key: 'thisMonth', label: t('reports.preset.thisMonth') },
    { key: 'lastMonth', label: t('reports.preset.lastMonth') },
    { key: 'thisYear', label: t('reports.preset.thisYear') },
    { key: 'lastYear', label: t('reports.preset.lastYear') },
    { key: 'custom', label: t('reports.preset.custom') },
  ];

  const bankMonthOptions = useMemo(() => {
    const months = new Set<string>();
    [...transactions, ...transfers].forEach((row: any) => {
      const date = String(row?.date || '');
      if (/^\d{4}-\d{2}/.test(date)) months.add(date.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [transactions, transfers]);

  // ── KPI Cards ──
  const overviewKPIs: KPICard[] = [
    { label: t('reports.kpi.totalIncome'), value: fmt(totalIncome), icon: <TrendingUp size={20} />, color: 'from-emerald-500 to-emerald-700', sub: t('reports.kpi.transactions').replace('{n}', String(income.length)) },
    { label: t('reports.kpi.totalExpenses'), value: fmt(totalExpense), icon: <TrendingDown size={20} />, color: 'from-red-500 to-red-700', sub: t('reports.kpi.transactions').replace('{n}', String(expenses.length)) },
    { label: t('reports.kpi.netProfit'), value: fmt(netProfit), icon: <DollarSign size={20} />, color: netProfit >= 0 ? 'from-blue-500 to-blue-700' : 'from-orange-500 to-orange-700', sub: totalIncome > 0 ? t('reports.kpi.margin').replace('{n}', ((netProfit / totalIncome) * 100).toFixed(1)) : '' },
    { label: t('reports.kpi.occupancy'), value: `${occupancy.percentage}%`, icon: <Home size={20} />, color: 'from-violet-500 to-violet-700', sub: t('reports.kpi.units').replace('{n}', String(occupancy.occupiedUnits)).replace('{m}', String(occupancy.totalUnits)) },
    { label: t('reports.kpi.activeContracts'), value: String(contractStats.active), icon: <FileText size={20} />, color: 'from-cyan-500 to-cyan-700', sub: contractStats.expiringSoon > 0 ? t('reports.kpi.expiringSoon').replace('{n}', String(contractStats.expiringSoon)) : t('reports.kpi.allGood') },
    { label: t('reports.kpi.vatLiability'), value: fmt(vatSummary.net), icon: <Percent size={20} />, color: 'from-amber-500 to-amber-700', sub: t('reports.kpi.collected').replace('{n}', fmtK(vatSummary.collected)) },
  ];

  // ── Render KPI Card ──
  const renderKPI = (kpi: KPICard, idx: number) => (
    <div key={idx} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.color} p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{kpi.label}</span>
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">{kpi.icon}</div>
        </div>
        <p className="text-xl sm:text-2xl font-black leading-none">{kpi.value}</p>
        {kpi.sub && <p className="text-white/60 text-[11px] mt-1.5 font-medium">{kpi.sub}</p>}
      </div>
    </div>
  );

  // ── Chart Tooltip ──
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-lg border border-emerald-100 rounded-xl shadow-xl p-3 text-xs">
        <p className="font-bold text-emerald-900 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
            <span>{p.name}:</span> <span className="font-bold">{fmt(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  // ── Section Wrapper ──
  const Section: React.FC<{ title: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, actions, children }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden min-w-0">
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 min-w-0 px-4 sm:px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="text-emerald-600 shrink-0">{icon}</span>}
          <h3 className="font-bold text-gray-800 text-sm sm:text-base truncate">{title}</h3>
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2 flex-wrap justify-end">{actions}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-emerald-700 font-semibold animate-pulse">{t('reports.loading')}</p>
      </div>
    </div>
  );

  return (
    <div ref={printRef} className="mobile-tab-shell tab-reports w-full max-w-full min-w-0 space-y-5 overflow-x-hidden pb-4 sm:pb-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ══ Header ══ */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24" />
        </div>
        <div className="relative z-10 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex flex-wrap items-center gap-2">
                <BarChart3 size={28} className="text-emerald-300" />
                {t('reports.title') || 'Reports & Analytics'}
              </h1>
              <p className="text-emerald-200 text-sm mt-1">{t('reports.subtitle')}</p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <button onClick={loadData} className="p-2.5 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm" title={t('reports.refresh')}>
                <RefreshCw size={18} />
              </button>
              <button onClick={handleExportActiveReportPDF} className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm text-sm font-semibold" title="Export current report as PDF">
                <Printer size={16} /> PDF
              </button>
              <button onClick={() => exportCSV(approved.map(tx => ({ Date: tx.date, Type: tx.type, Amount: tx.amount, Building: tx.buildingName, Details: tx.details, Payment: tx.paymentMethod, Status: tx.status })), 'transactions-report')} className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm text-sm font-semibold">
                <Download size={16} />{t('common.export')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Filters ══ */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            <Calendar size={16} className="text-emerald-600 shrink-0" />
            {datePresets.map(p => (
              <button key={p.key} onClick={() => setDatePreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${datePreset === p.key ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">From</span>
            <input
              type="date"
              value={datePreset === 'custom' ? customStart : rangeStart}
              onChange={e => {
                setDatePreset('custom');
                setCustomStart(e.target.value);
                if (!customEnd) setCustomEnd(rangeEnd);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
            <span className="text-gray-400 text-xs">{t('vat.to')}</span>
            <input
              type="date"
              value={datePreset === 'custom' ? customEnd : rangeEnd}
              onChange={e => {
                setDatePreset('custom');
                if (!customStart) setCustomStart(rangeStart);
                setCustomEnd(e.target.value);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
          {/* Building filter: Owner Expenses = all books + multi-select; other tabs = active book + single */}
          <div className={`${isRTL ? 'sm:mr-auto' : 'sm:ml-auto'} flex items-center gap-2 relative`}>
            <Building2 size={16} className="text-emerald-600 shrink-0" />
            {activeTab === 'ownerExpense' && canViewOwnerExpenses ? (
              <div className="relative min-w-[160px] max-w-[min(100vw-2rem,320px)]">
                <button
                  type="button"
                  onClick={() => setOwnerExpenseBuildingPickerOpen(v => !v)}
                  className="w-full flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white text-start"
                >
                  <span className="flex-1 truncate">
                    {ownerExpenseExcludedBuildingIds.length === 0
                      ? t('history.allBuildings')
                      : ownerExpenseIncludedBuildings.length <= 2
                        ? ownerExpenseIncludedBuildings.map((b: any) => b.name).join(', ')
                        : t('reports.ownerExpenseBuildingsCount').replace(
                            '{n}',
                            String(ownerExpenseIncludedBuildings.length),
                          )}
                    {ownerExpenseExcludedBuildingIds.length > 0 && ownerExpenseIncludeTreasury ? (
                      <span className="text-indigo-600 font-semibold">{` · ${t('reports.ownerExpenseTreasuryOnBadge')}`}</span>
                    ) : null}
                  </span>
                  <ChevronDown size={14} className={`shrink-0 text-gray-500 transition-transform ${ownerExpenseBuildingPickerOpen ? 'rotate-180' : ''}`} />
                </button>
                {ownerExpenseBuildingPickerOpen && (
                  <div
                    className={`absolute top-full mt-1 z-50 w-full min-w-[260px] max-h-[min(50vh,320px)] flex flex-col rounded-xl border border-emerald-100 bg-white shadow-xl p-2 ${
                      isRTL ? 'right-0' : 'left-0'
                    }`}
                  >
                    <input
                      type="text"
                      value={ownerExpenseBuildingSearch}
                      onChange={e => setOwnerExpenseBuildingSearch(e.target.value)}
                      placeholder={t('reports.searchBuildings')}
                      className="w-full mb-2 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerExpenseExcludedBuildingIds([]);
                        setOwnerExpenseIncludeTreasury(false);
                      }}
                      className="w-full mb-1 px-2 py-1.5 text-start text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      {t('reports.ownerExpenseCheckAllBuildings')}
                    </button>
                    <label
                      className={`flex items-start gap-2 px-2 py-2 rounded-lg border border-slate-200 bg-slate-50/80 mb-2 ${
                        ownerExpenseExcludedBuildingIds.length === 0 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          ownerExpenseExcludedBuildingIds.length === 0 ? true : ownerExpenseIncludeTreasury
                        }
                        disabled={ownerExpenseExcludedBuildingIds.length === 0}
                        onChange={e => setOwnerExpenseIncludeTreasury(e.target.checked)}
                        className="accent-emerald-600 mt-0.5 shrink-0"
                      />
                      <span className="text-[11px] font-semibold text-slate-700 leading-snug">
                        {t('reports.ownerExpenseIncludeTreasury')}
                        <span className="block font-normal text-slate-500 mt-0.5">{t('reports.ownerExpenseIncludeTreasuryHint')}</span>
                      </span>
                    </label>
                    <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-[220px]">
                      {filteredOwnerPickerBuildings.map((b: any) => {
                        const checked = !ownerExpenseExcludedBuildingIds.includes(String(b.id));
                        const bookLabel =
                          (b._bookDisplayName && String(b._bookDisplayName).trim()) ||
                          (b._sourceBookId && String(b._sourceBookId) !== String(activeBookId) ? String(b._sourceBookId) : '');
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs ${checked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const id = String(b.id);
                                setOwnerExpenseExcludedBuildingIds(prev =>
                                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
                                );
                              }}
                              className="accent-emerald-600 shrink-0"
                            />
                            <span className={`flex-1 font-medium truncate ${checked ? 'text-emerald-800' : 'text-gray-700'}`}>{b.name}</span>
                            {bookLabel ? (
                              <span
                                className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold shrink-0 max-w-[96px] truncate"
                                title={bookLabel}
                              >
                                {bookLabel}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                      {filteredOwnerPickerBuildings.length === 0 && (
                        <p className="px-2 py-3 text-xs text-gray-500">{t('reports.noBuildings')}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerExpenseBuildingPickerOpen(false);
                        setOwnerExpenseBuildingSearch('');
                      }}
                      className="w-full mt-2 px-2 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      {t('task.done')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[140px]">
                <option value="all">{t('history.allBuildings')}</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          {/* Owner Filter - only show for owner-specific reports */}
          {activeTab === 'ownerExpense' && canViewOwnerExpenses && (
            <div className="flex items-center gap-2">
              <Users size={16} className="text-violet-600" />
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[140px]">
                <option value="all">{t('reports.allOwners')}</option>
                {employees
                  .filter(
                    (u: any) =>
                      isOwnerReportUser(u) &&
                      ownerStakeIdsForUser(u).some((stakeId: string) =>
                        ownerPickerBuildings.some((b: any) =>
                          ownerStakeBuildingIdsMatch(stakeId, String(b.id || ''), activeBookId),
                        ),
                      ),
                  )
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard size={16} className="text-cyan-600" />
              <select
                value={bankReportFilter}
                onChange={e => setBankReportFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[160px]"
              >
                <option value="all">{t('reports.allBanks')}</option>
                {bankReportData.rows.map(bank => (
                  <option key={bank.key} value={bank.name}>{bank.name}</option>
                ))}
              </select>
              <select
                value={bankMonthFilter}
                onChange={e => setBankMonthFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[130px]"
              >
                <option value="all">{t('reports.allMonths')}</option>
                {bankMonthOptions.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
              <select
                value={bankMovementFilter}
                onChange={e => setBankMovementFilter(e.target.value as 'all' | 'in' | 'out')}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[130px]"
              >
                <option value="all">{t('reports.allMovements')}</option>
                <option value="in">{t('reports.moneyIn')}</option>
                <option value="out">{t('reports.moneyOut')}</option>
              </select>
              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={bankReportSearch}
                  onChange={e => setBankReportSearch(e.target.value)}
                  placeholder={t('reports.searchBankMovements')}
                  className="border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-xs font-medium bg-white w-[190px]"
                />
              </div>
              {(bankReportFilter !== 'all' || bankMonthFilter !== 'all' || bankMovementFilter !== 'all' || bankReportSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setBankReportFilter('all');
                    setBankMonthFilter('all');
                    setBankMovementFilter('all');
                    setBankReportSearch('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  {t('common.reset')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ Tab Navigation ══ */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-1.5">
        <div className="flex items-center gap-1">
          {/* Left arrow */}
          <button
            onClick={() => {
              const idx = tabs.findIndex(t => t.key === activeTab);
              if (idx > 0) setActiveTab(tabs[idx - 1].key);
            }}
            disabled={tabs.findIndex(t => t.key === activeTab) === 0}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-25 disabled:pointer-events-none"
            title={isRTL ? t('reports.tab.overview') : 'Previous tab'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* Scrollable tabs */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                    : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50'
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => {
              const idx = tabs.findIndex(t => t.key === activeTab);
              if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].key);
            }}
            disabled={tabs.findIndex(t => t.key === activeTab) === tabs.length - 1}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-25 disabled:pointer-events-none"
            title={isRTL ? 'Previous tab' : t('reports.tab.overview')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {overviewKPIs.map((kpi, i) => renderKPI(kpi, i))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Income vs Expense Trend */}
            <Section title={t('reports.section.incomeExpenseTrend')} icon={<TrendingUp size={18} />}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.3} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient>
                    <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} /><stop offset="95%" stopColor="#e11d48" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" name={t('reports.income')} stroke="#059669" fill="url(#incG)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="expense" name={t('reports.expense')} stroke="#e11d48" fill="url(#expG)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>

            {/* Expense Categories Pie */}
            <Section title={t('reports.section.expenseCategories')} icon={<PieChartIcon size={18} />}>
              {expenseByCat.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noExpenseData')}</p>}
            </Section>
          </div>

          {/* Second Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Net Profit Trend */}
            <Section title={t('reports.section.netProfitTrend')} icon={<DollarSign size={18} />}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="net" name={t('reports.netProfit')} radius={[6, 6, 0, 0]}>
                    {monthlyData.map((entry, i) => <Cell key={i} fill={entry.net >= 0 ? '#059669' : '#e11d48'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            {/* Payment Methods */}
            <Section title={t('reports.section.paymentMethods')} icon={<CreditCard size={18} />}>
              {paymentMethodData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noData')}</p>}
            </Section>
          </div>

          {/* Payment Method Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="font-bold text-emerald-700 mb-2">{t('reports.section.incomeByPayment')}</div>
              <div className="flex flex-col gap-1 text-sm">
                <span>Bank: <span className="font-black">{fmt(incomeBank)}</span>{t('common.sar')}</span>
                <span>Cash: <span className="font-black">{fmt(incomeCash)}</span>{t('common.sar')}</span>
                <span>Cheque: <span className="font-black">{fmt(incomeCheque)}</span>{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="font-bold text-red-700 mb-2">{t('reports.section.expenseByPayment')}</div>
              <div className="flex flex-col gap-1 text-sm">
                <span>Bank: <span className="font-black">{fmt(expenseBank)}</span>{t('common.sar')}</span>
                <span>Cash: <span className="font-black">{fmt(expenseCash)}</span>{t('common.sar')}</span>
                <span>Cheque: <span className="font-black">{fmt(expenseCheque)}</span>{t('common.sar')}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Income by Payment Method Pie */}
            <Section title={t('reports.section.incomeByPayment')} icon={<CreditCard size={18} />}>
              {incomePaymentMethodData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={incomePaymentMethodData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {incomePaymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noData')}</p>}
            </Section>
            {/* Expense by Payment Method Pie */}
            <Section title={t('reports.section.expenseByPayment')} icon={<CreditCard size={18} />}>
              {expensePaymentMethodData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={expensePaymentMethodData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {expensePaymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noData')}</p>}
            </Section>
          </div>
        </div>
      )}

      {/* ══ FINANCIAL TAB ══ */}
      {activeTab === 'financial' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: t('reports.totalRevenue'), value: totalIncome, icon: <ArrowUpRight size={20} />, color: 'emerald', desc: t('reports.incomeTransactions').replace('{n}', String(income.length)) },
              { label: t('reports.totalExpense'), value: totalExpense, icon: <ArrowDownRight size={20} />, color: 'red', desc: t('reports.expenseTransactions').replace('{n}', String(expenses.length)) },
              { label: t('reports.netPosition'), value: netProfit, icon: <DollarSign size={20} />, color: netProfit >= 0 ? 'emerald' : 'red', desc: totalIncome > 0 ? t('reports.profitMargin').replace('{n}', ((netProfit / totalIncome) * 100).toFixed(1)) : 'N/A' },
            ].map((c, i) => (
              <div key={i} className={`bg-${c.color}-50 border border-${c.color}-100 rounded-2xl p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-${c.color}-700 text-xs font-bold uppercase tracking-wider`}>{c.label}</span>
                  <div className={`p-2 bg-${c.color}-100 rounded-xl text-${c.color}-600`}>{c.icon}</div>
                </div>
                <p className={`text-2xl font-black text-${c.color}-900`}>SAR {fmt(c.value)}</p>
                <p className={`text-${c.color}-500 text-xs mt-1`}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Monthly Financial Table */}
          <Section title={t('reports.section.monthlyFinancial')} icon={<FileSpreadsheet size={18} />}
            actions={<button onClick={() => exportCSV(monthlyData, 'monthly-financial')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-emerald-100">
                    <th className="text-start py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('contract.period')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.income')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.expense')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.net')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-emerald-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-gray-700">{m.month}</td>
                      <td className="py-2.5 px-3 text-end text-emerald-600 font-semibold">{fmt(m.income)}</td>
                      <td className="py-2.5 px-3 text-end text-red-500 font-semibold">{fmt(m.expense)}</td>
                      <td className={`py-2.5 px-3 text-end font-bold ${m.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(m.net)}</td>
                      <td className="py-2.5 px-3 text-end text-gray-500">{m.income > 0 ? `${((m.net / m.income) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  {monthlyData.length > 0 && (
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50 font-bold">
                      <td className="py-3 px-3 text-emerald-900">{t('common.total')}</td>
                      <td className="py-3 px-3 text-end text-emerald-700">{fmt(totalIncome)}</td>
                      <td className="py-3 px-3 text-end text-red-600">{fmt(totalExpense)}</td>
                      <td className={`py-3 px-3 text-end ${netProfit >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmt(netProfit)}</td>
                      <td className="py-3 px-3 text-end text-gray-600">{totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {monthlyData.length === 0 && <p className="text-center text-gray-400 py-8">{t('reports.noFinancialData')}</p>}
            </div>
          </Section>

          {/* VAT Summary */}
          <Section title={t('reports.section.vatSummary')} icon={<Percent size={18} />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-600 font-bold uppercase mb-1">{t('reports.vatCollected')}</p>
                <p className="text-xl font-black text-emerald-800">{fmt(vatSummary.collected)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-xs text-red-600 font-bold uppercase mb-1">{t('reports.vatPaid')}</p>
                <p className="text-xl font-black text-red-800">{fmt(vatSummary.paid)}</p>
              </div>
              <div className={`${vatSummary.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-xl p-4 text-center`}>
                <p className={`text-xs ${vatSummary.net >= 0 ? 'text-blue-600' : 'text-orange-600'} font-bold uppercase mb-1`}>{t('reports.vatNetLiability')}</p>
                <p className={`text-xl font-black ${vatSummary.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{fmt(vatSummary.net)}</p>
              </div>
            </div>
          </Section>

          {/* Income vs Expense Bar Chart */}
          <Section title={t('reports.section.monthlyComparison')} icon={<BarChart3 size={18} />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name={t('reports.income')} fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={t('reports.expense')} fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ OCCUPANCY TAB ══ */}
      {activeTab === 'occupancy' && (
        <div className="space-y-5">
          {/* Occupancy Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: t('reports.totalUnits'), value: occupancy.totalUnits, color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Building2 size={20} className="text-blue-500" /> },
              { label: t('reports.occupied'), value: occupancy.occupiedUnits, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle size={20} className="text-emerald-500" /> },
              { label: t('reports.vacant'), value: occupancy.totalUnits - occupancy.occupiedUnits, color: 'bg-red-50 text-red-700 border-red-100', icon: <XCircle size={20} className="text-red-500" /> },
              { label: t('reports.occupancyRate'), value: `${occupancy.percentage}%`, color: 'bg-violet-50 text-violet-700 border-violet-100', icon: <Percent size={20} className="text-violet-500" /> },
            ].map((s, i) => (
              <div key={i} className={`${s.color} border rounded-2xl p-5 text-center`}>
                <div className="flex justify-center mb-2">{s.icon}</div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs font-semibold mt-1 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Occupancy Gauge */}
          <Section title={t('dashboard.occupancy')} icon={<Home size={18} />}>
            <div className="flex flex-col items-center py-6">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={occupancy.percentage >= 80 ? '#059669' : occupancy.percentage >= 50 ? '#ca8a04' : '#e11d48'} strokeWidth="10"
                    strokeDasharray={`${occupancy.percentage * 2.64} 264`} strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-gray-900">{occupancy.percentage}%</span>
                  <span className="text-xs text-gray-500 font-medium">{t('reports.occupied')}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Building-wise Occupancy */}
          <Section title={t('reports.section.buildingOccupancy')} icon={<Building2 size={18} />}>
            <div className="space-y-3">
              {buildings.map((b, i) => {
                const totalU = b.units?.length || 0;
                const activeC = contracts.filter(c => c.buildingId === b.id && c.status === 'Active');
                const occupiedU = new Set(activeC.map(c => c.unitName)).size;
                const pct = totalU > 0 ? Math.round((occupiedU / totalU) * 100) : 0;
                return (
                  <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}>
                      {pct}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{b.name}</p>
                      <p className="text-xs text-gray-500">{occupiedU}/{totalU} {t('directory.unitsOccupied')}</p>
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {buildings.length === 0 && <p className="text-center text-gray-400 py-6">{t('reports.noBuildings')}</p>}
            </div>
          </Section>

          {/* Contract Status Breakdown */}
          <Section title={t('reports.section.contractStatus')} icon={<FileText size={18} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('reports.contractStats.active'), value: contractStats.active, color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={16} /> },
                { label: t('reports.contractStats.expired'), value: contractStats.expired, color: 'bg-red-100 text-red-700', icon: <XCircle size={16} /> },
                { label: t('reports.contractStats.terminated'), value: contractStats.terminated, color: 'bg-gray-200 text-gray-700', icon: <AlertTriangle size={16} /> },
                { label: t('reports.contractStats.expiringSoon'), value: contractStats.expiringSoon, color: 'bg-amber-100 text-amber-700', icon: <Clock size={16} /> },
              ].map((s, i) => (
                <div key={i} className={`${s.color} rounded-xl p-4 flex items-center gap-2`}>
                  {s.icon}
                  <div>
                    <p className="text-lg font-black">{s.value}</p>
                    <p className="text-xs font-semibold opacity-70">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ TENANT TAB ══ */}
      {activeTab === 'tenant' && (
        <div className="space-y-5">
          {/* Top Revenue Customers */}
          <Section title={t('reports.section.topTenants')} icon={<Users size={18} />}
            actions={<button onClick={() => exportCSV(topCustomers.map(c => ({ Name: c.name, Revenue: c.total })), 'top-tenants')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            {topCustomers.length > 0 ? (
              <div className="space-y-2">
                {topCustomers.map((c, i) => {
                  const maxVal = topCustomers[0]?.total || 1;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${i < 3 ? 'bg-emerald-600' : 'bg-gray-400'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(c.total / maxVal) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmt(c.total)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-gray-400 text-center py-8">{t('reports.noTenantRevenue')}</p>}
          </Section>

          {/* Top Tenants Chart */}
          {topCustomers.length > 0 && (
            <Section title={t('reports.section.tenantRevenue')} icon={<PieChartIcon size={18} />}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={topCustomers.slice(0, 8)} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2} dataKey="total" nameKey="name"
                    label={({ name, percent }) => `${(name || '').slice(0, 12)} ${(percent * 100).toFixed(0)}%`}>
                    {topCustomers.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Customer Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('reports.totalTenants'), value: customers.length, color: 'text-blue-600 bg-blue-50' },
              { label: t('reports.kpi.activeContracts'), value: contractStats.active, color: 'text-emerald-600 bg-emerald-50' },
              { label: t('reports.blacklisted'), value: customers.filter(c => c.isBlacklisted).length, color: 'text-red-600 bg-red-50' },
              { label: t('reports.nationalities'), value: new Set(customers.map(c => c.nationality).filter(Boolean)).size, color: 'text-violet-600 bg-violet-50' },
            ].map((s, i) => (
              <div key={i} className={`${s.color} rounded-xl p-4 text-center border`}>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ EXPENSE TAB ══ */}
      {activeTab === 'expense' && (
        <div className="space-y-5">
          {/* Expense Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
              <p className="text-xs text-red-600 font-bold uppercase mb-1">{t('dashboard.totalExpense')}</p>
              <p className="text-2xl font-black text-red-900">SAR {fmt(totalExpense)}</p>
              <p className="text-xs text-red-400 mt-1">{expenses.length} transactions</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <p className="text-xs text-amber-600 font-bold uppercase mb-1">{t('reports.avgPerMonth')}</p>
              <p className="text-2xl font-black text-amber-900">SAR {fmt(monthlyData.length > 0 ? totalExpense / monthlyData.length : 0)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <p className="text-xs text-blue-600 font-bold uppercase mb-1">{t('reports.categories')}</p>
              <p className="text-2xl font-black text-blue-900">{expenseByCat.length}</p>
              <p className="text-xs text-blue-400 mt-1">{t('reports.expenseCategories')}</p>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <Section title={t('reports.section.expenseCategoryBreakdown')} icon={<Wallet size={18} />}
            actions={<button onClick={() => exportCSV(expenseByCat.map(c => ({ Category: c.name, Amount: c.value, Percentage: totalExpense > 0 ? ((c.value / totalExpense) * 100).toFixed(1) + '%' : '0%' })), 'expense-categories')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            <div className="space-y-2.5">
              {expenseByCat.map((cat, i) => {
                const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                return (
                  <div key={cat.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-medium">{pct.toFixed(1)}%</span>
                        <span className="text-sm font-bold text-gray-900">{fmt(cat.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {expenseByCat.length === 0 && <p className="text-center text-gray-400 py-6">{t('reports.noExpenseData')}</p>}
            </div>
          </Section>

          {/* Expense Pie + Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title={t('reports.section.categoryDistribution')} icon={<PieChartIcon size={18} />}>
              {expenseByCat.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${(name || '').slice(0, 10)} ${(percent * 100).toFixed(0)}%`}>
                      {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noData')}</p>}
            </Section>

            <Section title={t('reports.section.categoryComparison')} icon={<BarChart3 size={18} />}>
              {expenseByCat.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={expenseByCat.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtK(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" name={t('common.amount')} radius={[0, 6, 6, 0]}>
                      {expenseByCat.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-16">{t('reports.noData')}</p>}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ SALARY TAB ══ */}
      {activeTab === 'salary' && (
        <div className="space-y-5">
          {/* Salary Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('reports.totalSalaries'), value: `SAR ${fmt(salaryData.reduce((s, e) => s + e.total, 0))}`, color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: t('reports.employeesPaid'), value: salaryData.length, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              { label: t('reports.totalBonuses'), value: `SAR ${fmt(salaryData.reduce((s, e) => s + e.bonus, 0))}`, color: 'bg-violet-50 text-violet-700 border-violet-100' },
              { label: t('reports.totalDeductions'), value: `SAR ${fmt(salaryData.reduce((s, e) => s + e.deductions, 0))}`, color: 'bg-red-50 text-red-700 border-red-100' },
            ].map((s, i) => (
              <div key={i} className={`${s.color} border rounded-xl p-4 text-center`}>
                <p className="text-lg font-black">{s.value}</p>
                <p className="text-xs font-semibold mt-1 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Salary Detail Table */}
          <Section title={t('reports.section.employeeSalary')} icon={<CreditCard size={18} />}
            actions={<button onClick={() => exportCSV(salaryData.map(e => ({ Employee: e.name, BasePaid: e.total, Bonus: e.bonus, Deductions: e.deductions, Payments: e.count })), 'salary-report')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-emerald-100">
                    <th className="text-start py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.employee')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.grossPay')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.bonuses')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.deductions')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.payments')}</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.map((e, i) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-emerald-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-gray-700">{e.name}</td>
                      <td className="py-2.5 px-3 text-end font-semibold text-gray-800">{fmt(e.total)}</td>
                      <td className="py-2.5 px-3 text-end text-emerald-600">{fmt(e.bonus)}</td>
                      <td className="py-2.5 px-3 text-end text-red-500">{fmt(e.deductions)}</td>
                      <td className="py-2.5 px-3 text-end text-gray-500">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {salaryData.length === 0 && <p className="text-center text-gray-400 py-8">{t('reports.noSalaryData')}</p>}
            </div>
          </Section>

          {/* Salary Distribution Chart */}
          {salaryData.length > 0 && (
            <Section title={t('reports.section.salaryDistribution')} icon={<BarChart3 size={18} />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={salaryData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" name={t('reports.grossPay')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bonus" name={t('reports.bonuses')} fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deductions" name={t('reports.deductions')} fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ BUILDING TAB ══ */}
      {activeTab === 'building' && (
        <div className="space-y-5">
          {/* Building Revenue Table */}
          <Section title={t('reports.section.buildingPerformance')} icon={<Building2 size={18} />}
            actions={<button onClick={() => exportCSV(buildingRevenue.map(b => ({ Building: b.name, Income: b.income, Expense: b.expense, Net: b.net })), 'building-performance')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-emerald-100">
                    <th className="text-start py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.building')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.income')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('entry.expense')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.net')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.roiPct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingRevenue.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-emerald-50/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Building2 size={14} className="text-emerald-600" />
                          </div>
                          <span className="font-semibold text-gray-700">{b.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-end text-emerald-600 font-semibold">{fmt(b.income)}</td>
                      <td className="py-2.5 px-3 text-end text-red-500 font-semibold">{fmt(b.expense)}</td>
                      <td className={`py-2.5 px-3 text-end font-bold ${b.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(b.net)}</td>
                      <td className="py-2.5 px-3 text-end text-gray-500">{b.income > 0 ? `${((b.net / b.income) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {buildingRevenue.length === 0 && <p className="text-center text-gray-400 py-8">{t('reports.noBuildingData')}</p>}
            </div>
          </Section>

          {/* Building Revenue Chart */}
          {buildingRevenue.length > 0 && (
            <Section title={t('reports.section.buildingRevenue')} icon={<BarChart3 size={18} />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={buildingRevenue.slice(0, 10)} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtK(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name={t('reports.income')} fill="#059669" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="expense" name={t('reports.expense')} fill="#e11d48" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ══ COLLECTION TAB ══ */}
      {activeTab === 'collection' && (
        <div className="space-y-5">
          {/* Collection Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const totalContracted = tenantCollection.reduce((s, t) => s + t.contracted, 0);
              const totalPaid = tenantCollection.reduce((s, t) => s + t.paid, 0);
              const totalBalance = tenantCollection.reduce((s, t) => s + t.balance, 0);
              return [
                { label: t('reports.totalContracted'), value: `SAR ${fmt(totalContracted)}`, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                { label: t('reports.bankIncome'), value: `SAR ${fmt(incomeBank)}`, color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
                { label: t('reports.bankExpense'), value: `SAR ${fmt(expenseBank)}`, color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
                { label: t('reports.cashIncome'), value: `SAR ${fmt(incomeCash)}`, color: 'bg-violet-50 text-violet-700 border-violet-100' },
                { label: t('reports.cashExpense'), value: `SAR ${fmt(expenseCash)}`, color: 'bg-violet-50 text-violet-800 border-violet-200' },
                { label: t('reports.totalCollected'), value: `SAR ${fmt(totalPaid)}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { label: t('reports.outstanding'), value: `SAR ${fmt(totalBalance)}`, color: 'bg-red-50 text-red-700 border-red-100' },
              ];
            })().map((s, i) => (
              <div key={i} className={`${s.color} border rounded-2xl p-5`}>
                <p className="text-xs font-bold uppercase mb-1 opacity-70">{s.label}</p>
                <p className="text-xl font-black">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Collection Detail Table */}
          <Section title={t('reports.section.tenantCollection')} icon={<Landmark size={18} />}
            actions={<button onClick={() => exportCSV(filteredTenantCollection.map(tx => ({ Tenant: tx.name, Contracted: tx.contracted, Paid: tx.paid, Balance: tx.balance, CollectionRate: `${tx.percentage}%` })), 'collection-report')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}>
            
            {/* Search Box */}
            <div className="mb-4">
              <div className="relative">
                <input
                  ref={collectionSearchRef}
                  type="text"
                  placeholder={t('reports.searchTenants')}
                  value={collectionSearch}
                  onChange={e => {
                    const val = e.target.value;
                    setCollectionSearch(val);
                    // Restore focus after React re-render
                    requestAnimationFrame(() => {
                      collectionSearchRef.current?.focus();
                    });
                  }}
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {collectionSearch ? (
                  <button 
                    type="button"
                    onClick={() => { setCollectionSearch(''); collectionSearchRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                )}
              </div>
              {collectionSearch && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('reports.showingOf').replace('{n}', String(filteredTenantCollection.length)).replace('{m}', String(tenantCollection.length))}
                </p>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-emerald-100">
                    <th className="text-start py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('contract.tenant')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.contracted')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('tenant.paidAmount')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('tenant.balance')}</th>
                    <th className="text-end py-3 px-3 text-emerald-800 font-bold text-xs uppercase">{t('reports.collectionPct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenantCollection.map((tx, i) => (
                    <tr 
                      key={tx.id} 
                      className="border-b border-gray-50 hover:bg-emerald-50/50 transition-colors cursor-pointer"
                      onClick={() => getTenantHistory(tx.id, tx.name)}
                    >
                      <td className="py-2.5 px-3 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          {tx.name}
                          <Eye size={14} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-end text-gray-600">{fmt(tx.contracted)}</td>
                      <td className="py-2.5 px-3 text-end text-emerald-600 font-semibold">{fmt(tx.paid)}</td>
                      <td className={`py-2.5 px-3 text-end font-bold ${tx.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(tx.balance)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${tx.percentage >= 80 ? 'bg-emerald-500' : tx.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(tx.percentage, 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-500 w-10 text-end">{tx.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTenantCollection.length === 0 && <p className="text-center text-gray-400 py-8">{collectionSearch ? t('reports.noCollectionMatch') : t('reports.noCollectionData')}</p>}
            </div>
          </Section>
        </div>
      )}

      {/* ══ BANKS TAB ══ */}
      {activeTab === 'bank' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: t('reports.bankOpeningBalance'), value: bankReportData.totals.opening, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: <Wallet size={20} className="text-slate-500" /> },
              { label: t('reports.bankIncome'), value: bankReportData.totals.income, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <ArrowUpRight size={20} className="text-emerald-500" /> },
              { label: t('reports.bankExpense'), value: bankReportData.totals.expense, color: 'bg-red-50 text-red-700 border-red-100', icon: <ArrowDownRight size={20} className="text-red-500" /> },
              { label: t('reports.bankClosingBalance'), value: bankReportData.totals.closing, color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: <Landmark size={20} className="text-cyan-500" /> },
            ].map((item, i) => (
              <div key={i} className={`${item.color} border rounded-2xl p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-75">{item.label}</p>
                  {item.icon}
                </div>
                <p className="text-2xl font-black">SAR {fmt(item.value)}</p>
              </div>
            ))}
          </div>

          <Section
            title={t('reports.section.bankBalances')}
            icon={<Landmark size={18} />}
            actions={<button onClick={() => exportCSV(bankReportData.visible.map(bank => ({ Bank: bank.name, IBAN: bank.iban, Opening: bank.opening, Income: bank.income, Expense: bank.expense, Closing: bank.closing, Transactions: bank.transactionCount })), 'bank-balances-report')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-cyan-100">
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.bank')}</th>
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">IBAN</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.openingBalance')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.income')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.expense')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.closingBalance')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.transactions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bankReportData.visible.map(bank => (
                    <tr key={bank.key} className="border-b border-gray-50 hover:bg-cyan-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-gray-800">{bank.name}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{bank.iban || '-'}</td>
                      <td className="py-2.5 px-3 text-end text-slate-700 font-semibold">{fmt(bank.opening)}</td>
                      <td className="py-2.5 px-3 text-end text-emerald-600 font-semibold">{fmt(bank.income)}</td>
                      <td className="py-2.5 px-3 text-end text-red-500 font-semibold">{fmt(bank.expense)}</td>
                      <td className={`py-2.5 px-3 text-end font-black ${bank.closing >= 0 ? 'text-cyan-700' : 'text-red-600'}`}>{fmt(bank.closing)}</td>
                      <td className="py-2.5 px-3 text-end text-gray-500">{bank.transactionCount}</td>
                    </tr>
                  ))}
                  {bankReportData.visible.length > 0 && (
                    <tr className="border-t-2 border-cyan-200 bg-cyan-50 font-bold">
                      <td colSpan={2} className="py-3 px-3 text-cyan-900">{t('common.total')}</td>
                      <td className="py-3 px-3 text-end text-slate-700">{fmt(bankReportData.totals.opening)}</td>
                      <td className="py-3 px-3 text-end text-emerald-700">{fmt(bankReportData.totals.income)}</td>
                      <td className="py-3 px-3 text-end text-red-600">{fmt(bankReportData.totals.expense)}</td>
                      <td className={`py-3 px-3 text-end ${bankReportData.totals.closing >= 0 ? 'text-cyan-800' : 'text-red-700'}`}>{fmt(bankReportData.totals.closing)}</td>
                      <td className="py-3 px-3 text-end text-gray-600">{bankReportData.totals.transactionCount}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {bankReportData.visible.length === 0 && <p className="text-center text-gray-400 py-8">{t('reports.noBankData')}</p>}
            </div>
          </Section>

          <Section
            title={t('reports.section.bankMovements')}
            icon={<FileSpreadsheet size={18} />}
            actions={<button onClick={() => exportCSV(bankReportData.movements.map(row => ({ Date: row.date, Bank: row.bankName, Type: row.type, In: row.direction === 'in' ? row.amount : '', Out: row.direction === 'out' ? row.amount : '', Net: row.signedAmount, Building: row.building, Details: row.details, Method: row.method, Status: row.status })), 'bank-movements-report')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"><Download size={14} /> CSV</button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-cyan-100">
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('common.date')}</th>
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.bank')}</th>
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.type')}</th>
                    <th className="text-start py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('common.details')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.income')}</th>
                    <th className="text-end py-3 px-3 text-cyan-800 font-bold text-xs uppercase">{t('reports.expense')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bankReportData.movements.slice(0, 250).map((row, idx) => (
                    <tr key={`${row.id}-${idx}-${row.bankName}`} className="border-b border-gray-50 hover:bg-cyan-50/50 transition-colors">
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{row.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800">{row.bankName}</td>
                      <td className="py-2.5 px-3 text-gray-500">{row.type}</td>
                      <td className="py-2.5 px-3 text-gray-600 min-w-[220px]">
                        <div className="font-medium">{row.details || '-'}</div>
                        {row.building && <div className="text-xs text-gray-400 mt-0.5">{row.building}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-end text-emerald-600 font-semibold">{row.direction === 'in' ? fmt(row.amount) : '-'}</td>
                      <td className="py-2.5 px-3 text-end text-red-500 font-semibold">{row.direction === 'out' ? fmt(row.amount) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bankReportData.movements.length === 0 && <p className="text-center text-gray-400 py-8">{t('reports.noBankData')}</p>}
              {bankReportData.movements.length > 250 && (
                <p className="text-center text-xs text-gray-400 pt-3">{t('reports.showingOf').replace('{n}', '250').replace('{m}', String(bankReportData.movements.length))}</p>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ══ OWNER EXPENSE TAB ══ */}
      {activeTab === 'ownerExpense' && canViewOwnerExpenses && (
        <div className="space-y-6">
          {/* Grand Total Summary Card */}
          {ownerCombinedData.length > 0 && (
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                    <Wallet size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm font-semibold uppercase tracking-wide">{t('reports.totalOwed')}</p>
                    <p className="text-4xl font-black text-slate-800 tracking-tight">
                      SAR {fmt(ownerCombinedData.reduce((s, o) => s + o.subtotal, 0))}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-violet-50 rounded-2xl p-5 border-2 border-violet-200">
                    <p className="text-xs text-violet-600 font-bold uppercase tracking-wide mb-2">{t('reports.openingBalance')}</p>
                    <p className="text-2xl font-black text-violet-700">SAR {fmt(ownerCombinedData.reduce((s, o) => s + o.openingBalance, 0))}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('reports.tillLastMonth')}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-5 border-2 border-emerald-200">
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide mb-2">{t('common.thisMonth')}</p>
                    <p className="text-2xl font-black text-emerald-700">SAR {fmt(ownerCombinedData.reduce((s, o) => s + o.thisMonthExpenses, 0))}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner Comparison Summary Table */}
          {ownerCombinedData.length > 1 && (() => {
            const grandTotal = ownerCombinedData.reduce((s, o) => s + o.subtotal, 0);
            return (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-xl">
                      <BarChart3 size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{t('reports.ownerComparison')}</h3>
                      <p className="text-white/60 text-xs">{t('reports.ownerComparisonDesc')}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">{t('reports.owner')}</th>
                        <th className="px-5 py-3 text-xs font-bold text-violet-600 uppercase tracking-wide text-end">{t('reports.openingBalance')}</th>
                        <th className="px-5 py-3 text-xs font-bold text-emerald-600 uppercase tracking-wide text-end">{t('common.thisMonth')}</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wide text-end">{t('reports.totalOwedHeader')}</th>
                        <th className="px-5 py-3 text-xs font-bold text-blue-600 uppercase tracking-wide text-end">{t('reports.difference')}</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-end">{t('reports.sharePct')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ownerCombinedData.map((owner, idx) => {
                        const diff = idx === 0 ? 0 : owner.subtotal - ownerCombinedData[idx - 1].subtotal;
                        const share = grandTotal !== 0 ? (owner.subtotal / grandTotal) * 100 : 0;
                        return (
                          <tr key={owner.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                  {owner.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-800">{owner.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-end font-bold text-violet-700">SAR {fmt(owner.openingBalance)}</td>
                            <td className="px-5 py-3 text-end font-bold text-emerald-700">SAR {fmt(owner.thisMonthExpenses)}</td>
                            <td className="px-5 py-3 text-end font-black text-slate-800">SAR {fmt(owner.subtotal)}</td>
                            <td className="px-5 py-3 text-right">
                              {idx === 0 ? (
                                <span className="text-xs text-slate-400 font-medium">{t('reports.highest')}</span>
                              ) : (
                                <span className={`font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {diff > 0 ? '+' : ''}{fmt(diff)}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" style={{ width: `${Math.min(100, Math.abs(share))}%` }}></div>
                                </div>
                                <span className="text-xs font-bold text-slate-600">{share.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-white">
                        <td className="px-5 py-3 font-bold">{t('reports.grandTotal')}</td>
                        <td className="px-5 py-3 text-right font-bold">
                          SAR {fmt(ownerCombinedData.reduce((s, o) => s + o.openingBalance, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          SAR {fmt(ownerCombinedData.reduce((s, o) => s + o.thisMonthExpenses, 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-amber-300">
                          SAR {fmt(grandTotal)}
                        </td>
                        <td className="px-5 py-3"></td>
                        <td className="px-5 py-3 text-right text-xs font-bold text-slate-300">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Individual Owner Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ownerCombinedData.map((owner, idx) => {
              const colors = [
                { bg: 'from-violet-500 to-purple-600', light: 'violet', accent: 'violet' },
                { bg: 'from-emerald-500 to-teal-600', light: 'emerald', accent: 'emerald' },
                { bg: 'from-blue-500 to-indigo-600', light: 'blue', accent: 'blue' },
                { bg: 'from-orange-500 to-red-500', light: 'orange', accent: 'orange' },
                { bg: 'from-pink-500 to-rose-600', light: 'pink', accent: 'pink' },
                { bg: 'from-cyan-500 to-blue-600', light: 'cyan', accent: 'cyan' },
              ];
              const color = colors[idx % colors.length];
              
              return (
                <div key={owner.id} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                  {/* Owner Header */}
                  <div className={`bg-gradient-to-r ${color.bg} p-6 text-white relative`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-black text-xl backdrop-blur">
                          {owner.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-black">{owner.name}</h3>
                          <p className="text-white/70 text-sm">{t('reports.ownerAccount')}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">{t('reports.totalOwedSubtitle')}</p>
                        <p className="text-3xl font-black">SAR {fmt(owner.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Breakdown Section */}
                  <div className="p-6 space-y-4">
                    {/* Opening Balance */}
                    <div className={`bg-violet-50 rounded-2xl p-4 border border-violet-100`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-100 rounded-xl">
                            <Wallet size={18} className="text-violet-600" />
                          </div>
                          <div>
                            <p className="text-xs text-violet-600 font-bold uppercase tracking-wide">{t('reports.openingBalance')}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{owner.openingBalanceTxs.length} {t('reports.entryies')}</p>
                          </div>
                        </div>
                        <p className="text-xl font-black text-violet-700">SAR {fmt(owner.openingBalance)}</p>
                      </div>
                    </div>
                    
                    {/* This Month Expenses */}
                    <div className={`bg-emerald-50 rounded-2xl p-4 border border-emerald-100`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-xl">
                            <Calendar size={18} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">{t('common.thisMonth')}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{owner.thisMonthTxs.length} {t('reports.transactions')}</p>
                          </div>
                        </div>
                        <p className="text-xl font-black text-emerald-700">SAR {fmt(owner.thisMonthExpenses)}</p>
                      </div>
                    </div>
                    
                    {/* Subtotal Divider */}
                    <div className="pt-4 border-t-2 border-dashed border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={20} className="text-slate-600" />
                          <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{t('invoice.subtotal')}</span>
                        </div>
                        <p className={`text-2xl font-black text-${color.accent}-600`}>SAR {fmt(owner.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {ownerCombinedData.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {ownerAllBookLoading ? (
                  <RefreshCw size={32} className="text-emerald-500 animate-spin" />
                ) : (
                  <Wallet size={32} className="text-slate-400" />
                )}
              </div>
              <p className="text-slate-500 font-medium">
                {ownerAllBookLoading ? t('reports.loading') : t('reports.noOwnerData')}
              </p>
              {!ownerAllBookLoading && (
                <p className="text-slate-400 text-sm mt-1">{t('reports.noOwnerDataHint')}</p>
              )}
            </div>
          )}

          {/* Export/Print Controls */}
          {ownerCombinedData.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-sm font-semibold text-slate-600">{t('reports.exportOptions')}</span>
              <button 
                onClick={() => handlePrintOwnerExpense()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors shadow-md"
              >
                <Printer size={16} /> {t('reports.printAllOwners')}
              </button>
              <button 
                onClick={() => exportCSV(
                  ownerCombinedData.flatMap(o => [
                    ...o.openingBalanceTxs.map(tx => ({
                      Owner: o.name,
                      Type: 'Opening Balance',
                      Date: tx.date,
                      Amount: ownerReportLineAmount(tx),
                      Details: ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
                    })),
                    ...o.thisMonthTxs.map(tx => ({
                      Owner: o.name,
                      Type: 'This Month',
                      Date: tx.date,
                      Amount: ownerReportLineAmount(tx),
                      Details: ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
                    })),
                  ]), 'owner-expenses-all'
                )} 
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-md"
              >
                <Download size={16} /> {t('reports.exportAllCsv')}
              </button>
            </div>
          )}

          {/* Individual Owner Sections - Each Owner Gets Their Own Complete Section */}
          {ownerCombinedData.map((owner, ownerIdx) => {
            const colors = [
              { gradient: 'from-violet-500 to-purple-600', bg: 'violet', border: 'violet' },
              { gradient: 'from-emerald-500 to-teal-600', bg: 'emerald', border: 'emerald' },
              { gradient: 'from-blue-500 to-indigo-600', bg: 'blue', border: 'blue' },
              { gradient: 'from-orange-500 to-amber-500', bg: 'orange', border: 'orange' },
            ];
            const color = colors[ownerIdx % colors.length];
            
            return (
              <div key={owner.id} className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Owner Header with Actions */}
                <div className={`bg-gradient-to-r ${color.gradient} p-6 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-black text-2xl backdrop-blur">
                        {owner.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">{owner.name}</h3>
                        <p className="text-white/80 text-sm">{t('reports.ownerAccountStatement')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handlePrintOwnerExpense(owner.id)}
                        className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                        title={t('reports.printOwner')}
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => exportCSV([
                          ...owner.openingBalanceTxs.map(tx => ({
                            Type: 'Opening Balance',
                            Date: tx.date,
                            Amount: ownerReportLineAmount(tx),
                            Details: ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
                          })),
                          ...owner.thisMonthTxs.map(tx => ({
                            Type: 'This Month',
                            Date: tx.date,
                            Amount: ownerReportLineAmount(tx),
                            Details: ((tx as any).details || (tx as any).purpose || '-') + ownerCrossBookSuffix(tx),
                          })),
                        ], `${owner.name.replace(/\s+/g, '-')}-expenses`)}
                        className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                        title={t('contract.exportCsv')}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200">
                  <div className="bg-violet-100 rounded-2xl p-4 border-2 border-violet-200">
                    <p className="text-xs text-violet-600 font-bold uppercase">{t('reports.openingBalance')}</p>
                    <p className="text-xl font-black text-violet-700 mt-1">SAR {fmt(owner.openingBalance)}</p>
                    <p className="text-xs text-violet-500 mt-1">{owner.openingBalanceTxs.length} {t('reports.entryies')}</p>
                  </div>
                  <div className="bg-emerald-100 rounded-2xl p-4 border-2 border-emerald-200">
                    <p className="text-xs text-emerald-600 font-bold uppercase">{t('common.thisMonth')}</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">SAR {fmt(owner.thisMonthExpenses)}</p>
                    <p className="text-xs text-emerald-500 mt-1">{owner.thisMonthTxs.length} {t('reports.transactions')}</p>
                  </div>
                  <div className="bg-slate-800 rounded-2xl p-4">
                    <p className="text-xs text-slate-400 font-bold uppercase">{t('reports.totalOwedSubtitle')}</p>
                    <p className="text-2xl font-black text-white mt-1">SAR {fmt(owner.subtotal)}</p>
                  </div>
                </div>
                
                {/* Detailed Transactions */}
                <div className="p-6 space-y-6">
                  {/* Opening Balance Entries */}
                  {owner.openingBalanceTxs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-violet-100 rounded-lg">
                          <Wallet size={16} className="text-violet-600" />
                        </div>
                        <h4 className="font-bold text-slate-800">{t('reports.openingBalanceTill')}</h4>
                        <span className="text-xs bg-violet-100 text-violet-600 px-2 py-1 rounded-full font-semibold">
                          {owner.openingBalanceTxs.length}
                        </span>
                      </div>
                      <div className="bg-violet-50 rounded-2xl border border-violet-200 overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-violet-100 text-left">
                              <th className="px-4 py-3 text-xs font-bold text-violet-700 uppercase">{t('common.date')}</th>
                              <th className="px-4 py-3 text-xs font-bold text-violet-700 uppercase">{t('common.details')}</th>
                              <th className="px-4 py-3 text-xs font-bold text-violet-700 uppercase text-right">{t('common.amount')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-100">
                            {owner.openingBalanceTxs.map((tx, idx) => {
                              const line = ownerReportLineAmount(tx);
                              const detail =
                                ((tx as any).details || (tx as any).purpose || t('reports.openingBalance')) + ownerCrossBookSuffix(tx);
                              return (
                              <tr key={`${(tx as any)._bookId || 'default'}-${(tx as any).id}-${idx}`} className="hover:bg-violet-100/50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(tx.date).toLocaleDateString('en-SA')}</td>
                                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{detail}</td>
                                <td className={`px-4 py-3 text-sm font-bold text-end ${line < 0 ? 'text-rose-600' : 'text-violet-700'}`}>{line < 0 ? '− ' : ''}SAR {fmt(Math.abs(line))}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-violet-200">
                              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-violet-800">{t('reports.totalOwnerExpense')} ({owner.name})</td>
                              <td className="px-4 py-3 text-sm font-black text-violet-800 text-end">SAR {fmt(owner.openingBalance)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* This Month's Expenses */}
                  {owner.thisMonthTxs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Calendar size={16} className="text-emerald-600" />
                        </div>
                        <h4 className="font-bold text-slate-800">{t('reports.thisMonthExpenses')}</h4>
                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-semibold">
                          {owner.thisMonthTxs.length}
                        </span>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-emerald-100 text-left">
                              <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase">{t('common.date')}</th>
                              <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase">{t('common.details')}</th>
                              <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase text-right">{t('common.amount')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-100">
                            {owner.thisMonthTxs.map((tx, idx) => {
                              const line = ownerReportLineAmount(tx);
                              const detail =
                                ((tx as any).details || (tx as any).purpose || t('history.ownerExpenses')) + ownerCrossBookSuffix(tx);
                              return (
                              <tr key={`${(tx as any)._bookId || 'default'}-${(tx as any).id}-${idx}`} className="hover:bg-emerald-100/50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(tx.date).toLocaleDateString('en-SA')}</td>
                                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{detail}</td>
                                <td className={`px-4 py-3 text-sm font-bold text-end ${line < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{line < 0 ? '− ' : ''}SAR {fmt(Math.abs(line))}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-emerald-200">
                              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-emerald-800">{t('invoice.subtotal')}</td>
                              <td className="px-4 py-3 text-sm font-black text-emerald-800 text-end">SAR {fmt(owner.thisMonthExpenses)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {owner.openingBalanceTxs.length === 0 && owner.thisMonthTxs.length === 0 && (
                    <p className="text-center text-slate-400 py-8">{t('reports.noTransactionDetails')}</p>
                  )}
                  
                  {/* Grand Total Footer */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl p-6 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">{t('reports.grandTotalFor')} {owner.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('reports.openingPlusMonth')}</p>
                      </div>
                      <p className="text-3xl font-black">SAR {fmt(owner.subtotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Footer ══ */}
      <div className="text-center text-xs text-gray-400 py-2">
        {t('reports.reportFooter')} {new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })} • {t('reports.period')}: {activeTab === 'bank' ? (bankMonthFilter === 'all' ? t('reports.allTime') : bankMonthFilter) : `${rangeStart} ${t('vat.to')} ${rangeEnd}`}
      </div>

      {/* ══ Tenant History Modal ══ */}
      {selectedTenantHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTenantHistory(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-black text-xl backdrop-blur">
                    {selectedTenantHistory.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedTenantHistory.name}</h3>
                    <p className="text-emerald-100 text-sm">{t('tenant.myPayments')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTenantHistory(null)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedTenantHistory.transactions.length > 0 ? (
                <div className="space-y-3">
                  {selectedTenantHistory.transactions.map((tx, idx) => (
                    <div key={tx.id || idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${tx.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === TransactionType.INCOME ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{tx.details || (tx as any).incomeCategory || 'Payment'}</p>
                          <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${tx.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.type === TransactionType.INCOME ? '+' : '-'}SAR {fmt(Number(tx.amount) || 0)}
                        </p>
                        {tx.paymentMethod && (
                          <p className="text-xs text-gray-500">{tx.paymentMethod}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">{t('reports.noPaymentHistory')}</p>
                  <p className="text-gray-400 text-sm mt-1">{t('reports.noPaymentHistoryHint')}</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            {selectedTenantHistory.transactions.length > 0 && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{selectedTenantHistory.transactions.length} {t('reports.transaction')}</p>
                  <p className="text-sm font-bold text-emerald-600">
                    Total: SAR {fmt(selectedTenantHistory.transactions.reduce((s, t) => s + (t.type === TransactionType.INCOME ? Number(t.amount) || 0 : 0), 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

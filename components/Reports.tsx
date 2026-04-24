import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Transaction, TransactionType, TransactionStatus, Contract, Building, Customer, ExpenseCategory, PaymentMethod, UserRole } from '../types';
import { normalizePaymentMethod } from '../utils/transactionUtils';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import {
  getTransactions, getContracts, getBuildings, getCustomers, getUsers,
  getOccupancyStats, getIncomeExpenseSummary, getIncomeExpenseByPeriod,
  getSalaryReport, getMaintenanceReport, getVendors, getTransfers, getSettings
} from '../services/firestoreService';
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

import { User } from '../types';

// ── Types ──
type ReportTab = 'overview' | 'financial' | 'occupancy' | 'tenant' | 'expense' | 'salary' | 'building' | 'collection' | 'ownerExpense';
type DatePreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear' | 'custom';

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

const getDateRange = (preset: DatePreset): { start: string; end: string } => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (preset) {
    case 'thisMonth': return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y;
      return { start: `${ly}-${String(lm + 1).padStart(2, '0')}-01`, end: new Date(ly, lm + 1, 0).toISOString().slice(0, 10) };
    }
    case 'thisQuarter': { const qs = Math.floor(m / 3) * 3; return { start: `${y}-${String(qs + 1).padStart(2, '0')}-01`, end: new Date(y, qs + 3, 0).toISOString().slice(0, 10) }; }
    case 'thisYear': return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'lastYear': return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default: return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
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

  // ── State ──
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('thisYear');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
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
  const [reportSettings, setReportSettings] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const collectionSearchRef = useRef<HTMLInputElement>(null);

  // ── Date Range ──
  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd };
    return getDateRange(datePreset);
  }, [datePreset, customStart, customEnd]);

  // ── Fetch ──
  const loadData = async () => {
    setLoading(true);
    try {
      const [txs, cons, blds, custs, usrs, occ, vnds, trsf, sett] = await Promise.all([
        getTransactions(), getContracts(), getBuildings(),
        getCustomers(), getUsers(), getOccupancyStats(), getVendors(), getTransfers({}),
        getSettings().catch(() => null)
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
    } catch (e) { console.error('Reports load error:', e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── Filtered Transactions ──
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (t.date < rangeStart || t.date > rangeEnd) return false;
      if (buildingFilter !== 'all' && t.buildingId !== buildingFilter) return false;
      // Exclude TREASURY and TREASURY_REVERSAL transactions (internal transfers)
      if ((t as any).source === 'treasury' || t.paymentMethod === 'TREASURY' || t.paymentMethod === 'TREASURY_REVERSAL' || (t as any).isReversal) return false;
      return true;
    });
  }, [transactions, rangeStart, rangeEnd, buildingFilter]);

  const approved = useMemo(() => filtered.filter(t => t.status === TransactionStatus.APPROVED || !t.status), [filtered]);
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
    const search = collectionSearch.toLowerCase();
    return tenantCollection.filter(t => t.name.toLowerCase().includes(search));
  }, [tenantCollection, collectionSearch]);

  // Get tenant transaction history
  const getTenantHistory = (customerId: string, customerName: string) => {
    const tenantTxs = transactions.filter(t => {
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

  // ── Owner Expenses & Opening Balances ──
  const ownerExpensesData = useMemo(() => {
    let filteredTxs = approved.filter(t => 
      (t.expenseCategory === 'Owner Expense' || t.expenseCategory === 'OWNER_EXPENSE' || t.expenseCategory === 'Owner Profit Withdrawal') 
      && !t.isOwnerOpeningBalance  // Exclude opening balance transactions
    );
    if (ownerFilter !== 'all') {
      filteredTxs = filteredTxs.filter(t => (t as any).ownerId === ownerFilter);
    }
    const byOwner: Record<string, { name: string; transactions: Transaction[]; total: number }> = {};
    filteredTxs.forEach(t => {
      const ownerId = (t as any).ownerId || 'unknown';
      const ownerName = (t as any).ownerName || customers.find(c => c.id === ownerId)?.name || 'Unknown Owner';
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = { name: ownerName, transactions: [], total: 0 };
      }
      byOwner[ownerId].transactions.push(t);
      byOwner[ownerId].total += Number(t.amount) || 0;
    });
    return Object.entries(byOwner).map(([id, v]) => ({
      id,
      name: v.name,
      transactions: v.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      total: v.total
    })).sort((a, b) => b.total - a.total);
  }, [approved, customers, ownerFilter]);

  // Combined Owner Report Data - Opening Balance (includes previous months) + This Month
  const ownerCombinedData = useMemo(() => {
    // Always use actual current month boundaries (opening = through last month's last day)
    const _now = new Date();
    const currentMonthStart = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`;
    const _lastDay = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
    const currentMonthEnd = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_lastDay).padStart(2, '0')}`;
    
    // Get all owner expense transactions (excluding opening balance entries)
    let allOwnerExpenses = transactions.filter(t => 
      (t.expenseCategory === 'Owner Expense' || t.expenseCategory === 'OWNER_EXPENSE' || t.expenseCategory === 'Owner Profit Withdrawal') &&
      !t.isOwnerOpeningBalance &&
      (t.status === TransactionStatus.APPROVED || !t.status)
    );
    
    // Get all opening balance entries
    let openingBalanceTxs = transactions.filter(t => 
      (t.isOwnerOpeningBalance === true || t.expenseCategory === 'Owner Opening Balance') &&
      (t.status === TransactionStatus.APPROVED || !t.status)
    );
    
    if (ownerFilter !== 'all') {
      allOwnerExpenses = allOwnerExpenses.filter(t => (t as any).ownerId === ownerFilter);
      openingBalanceTxs = openingBalanceTxs.filter(t => (t as any).ownerId === ownerFilter);
    }
    if (buildingFilter !== 'all') {
      allOwnerExpenses = allOwnerExpenses.filter(t => t.buildingId === buildingFilter);
      openingBalanceTxs = openingBalanceTxs.filter(t => t.buildingId === buildingFilter);
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
      const ownerId = (t as any).ownerId || 'unknown';
      const ownerName = (t as any).ownerName || customers.find(c => c.id === ownerId)?.name || 'Unknown Owner';
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
      byOwner[ownerId].openingBalance += Number(t.amount) || 0;
      byOwner[ownerId].openingBalanceTxs.push(t);
    });
    
    // Process owner expenses - previous months go to opening balance, this month separate
    allOwnerExpenses.forEach(t => {
      const ownerId = (t as any).ownerId || 'unknown';
      const ownerName = (t as any).ownerName || customers.find(c => c.id === ownerId)?.name || 'Unknown Owner';
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
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        byOwner[ownerId].thisMonthExpenses += Number(t.amount) || 0;
        byOwner[ownerId].thisMonthTxs.push(t);
      } else if (txDate < currentMonthStart) {
        // Previous months expenses are added to opening balance
        byOwner[ownerId].openingBalance += Number(t.amount) || 0;
        byOwner[ownerId].openingBalanceTxs.push(t);
      }
    });
    
    // Process HEAD_OFFICE -> OWNER transfers as owner expenses
    // Skip transfers when building filter is active (transfers are not building-specific)
    const ownerTransfers = buildingFilter !== 'all' ? [] : transfers.filter(tr => 
      tr.fromType === 'HEAD_OFFICE' && 
      tr.toType === 'OWNER' && 
      tr.status === 'COMPLETED' &&
      !tr.deleted
    );
    
    ownerTransfers.forEach(tr => {
      const ownerId = tr.toId;
      // Apply owner filter if set
      if (ownerFilter !== 'all' && ownerId !== ownerFilter) return;
      
      // Look up owner from employees (users), not customers
      const owner = employees.find((u: any) => u.id === ownerId);
      const ownerName = owner?.name || owner?.email || ownerId || 'Unknown Owner';
      
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
      
      // Create a pseudo-transaction for display
      const pseudoTx = {
        id: tr.id,
        date: tr.date,
        amount: tr.amount,
        details: `تحويل من المكتب - ${tr.purpose || 'Head Office Transfer'}`,
        type: TransactionType.EXPENSE,
        buildingId: '',
      } as Transaction;
      
      const txDate = tr.date || '';
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        byOwner[ownerId].thisMonthExpenses += Number(tr.amount) || 0;
        byOwner[ownerId].thisMonthTxs.push(pseudoTx);
      } else {
        byOwner[ownerId].openingBalance += Number(tr.amount) || 0;
        byOwner[ownerId].openingBalanceTxs.push(pseudoTx);
      }
    });
    
    // Process OWNER -> HEAD_OFFICE transfers as returns (deduct from owner expenses)
    // Skip transfers when building filter is active (transfers are not building-specific)
    const ownerReturns = buildingFilter !== 'all' ? [] : transfers.filter(tr => 
      tr.fromType === 'OWNER' && 
      tr.toType === 'HEAD_OFFICE' && 
      tr.status === 'COMPLETED' &&
      !tr.deleted
    );
    
    ownerReturns.forEach(tr => {
      const ownerId = tr.fromId;
      // Apply owner filter if set
      if (ownerFilter !== 'all' && ownerId !== ownerFilter) return;
      
      // Look up owner from employees (users)
      const owner = employees.find((u: any) => u.id === ownerId);
      const ownerName = owner?.name || owner?.email || ownerId || 'Unknown Owner';
      
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
      
      // Create a pseudo-transaction for display (negative amount = return)
      const pseudoTx = {
        id: tr.id,
        date: tr.date,
        amount: -Number(tr.amount), // Negative to show as deduction
        details: `إرجاع إلى المكتب - ${tr.purpose || 'Return to Head Office'}`,
        type: TransactionType.EXPENSE,
        buildingId: '',
      } as Transaction;
      
      const txDate = tr.date || '';
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        byOwner[ownerId].thisMonthExpenses -= Number(tr.amount) || 0;
        byOwner[ownerId].thisMonthTxs.push(pseudoTx);
      } else {
        byOwner[ownerId].openingBalance -= Number(tr.amount) || 0;
        byOwner[ownerId].openingBalanceTxs.push(pseudoTx);
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
  }, [transactions, customers, ownerFilter, buildingFilter, transfers, buildings, employees, rangeStart, rangeEnd]);

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

    const txRow = (tx: any, isNeg = false) => `
      <tr>
        <td>${new Date(tx.date).toLocaleDateString('en-SA')}</td>
        <td>${tx.details || (isNeg ? 'Return to Head Office' : t('history.ownerExpenses'))}</td>
        <td class="amt ${isNeg || Number(tx.amount) < 0 ? 'neg' : ''}">SAR ${fmt(Math.abs(Number(tx.amount) || 0))}</td>
      </tr>`;

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
          <tbody>${owner.thisMonthTxs.map(tx => txRow(tx, Number(tx.amount) < 0)).join('')}</tbody>
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
        <img src="${origin}/images/logo.png" class="lh-logo" alt="Amlak Logo" onerror="this.style.display='none'" />
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
          <img src="${origin}/images/logo.png" class="rf-logo" alt="Amlak" onerror="this.style.display='none'" />
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

  // ── Tabs ──
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === UserRole.MANAGER || currentUser?.role === 'MANAGER';
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
    // Owner Expenses visible to Admin & Manager (treasury staff)
    ...(canViewOwnerExpenses ? [{ key: 'ownerExpense' as ReportTab, label: t('reports.tab.ownerExpense'), icon: <FileText size={16} /> }] : []),
  ], [canViewOwnerExpenses, t]);

  const datePresets: { key: DatePreset; label: string }[] = [
    { key: 'thisMonth', label: t('reports.preset.thisMonth') },
    { key: 'lastMonth', label: t('reports.preset.lastMonth') },
    { key: 'thisQuarter', label: t('reports.preset.thisQuarter') },
    { key: 'thisYear', label: t('reports.preset.thisYear') },
    { key: 'lastYear', label: t('reports.preset.lastYear') },
    { key: 'custom', label: t('reports.preset.custom') },
  ];

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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2">
          {icon && <span className="text-emerald-600">{icon}</span>}
          <h3 className="font-bold text-gray-800 text-sm sm:text-base">{title}</h3>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
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
    <div ref={printRef} className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ══ Header ══ */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                <BarChart3 size={28} className="text-emerald-300" />
                {t('reports.title') || 'Reports & Analytics'}
              </h1>
              <p className="text-emerald-200 text-sm mt-1">{t('reports.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadData} className="p-2.5 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm" title={t('reports.refresh')}>
                <RefreshCw size={18} />
              </button>
              <button onClick={handlePrint} className="p-2.5 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm" title={t('common.print')}>
                <Printer size={18} />
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
          {/* Custom dates */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              <span className="text-gray-400 text-xs">{t('vat.to')}</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
            </div>
          )}
          {/* Building Filter */}
          <div className={`${isRTL ? 'sm:mr-auto' : 'sm:ml-auto'} flex items-center gap-2`}>
            <Building2 size={16} className="text-emerald-600" />
            <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[140px]">
              <option value="all">{t('history.allBuildings')}</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Owner Filter - only show for owner-specific reports */}
          {activeTab === 'ownerExpense' && canViewOwnerExpenses && (
            <div className="flex items-center gap-2">
              <Users size={16} className="text-violet-600" />
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium bg-white min-w-[140px]">
                <option value="all">{t('reports.allOwners')}</option>
                {employees.filter((u: any) => u.role === 'OWNER').map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
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
                <Wallet size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">{t('reports.noOwnerData')}</p>
              <p className="text-slate-400 text-sm mt-1">{t('reports.noOwnerDataHint')}</p>
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
                    ...o.openingBalanceTxs.map(tx => ({ Owner: o.name, Type: 'Opening Balance', Date: tx.date, Amount: tx.amount, Details: tx.details || '-' })),
                    ...o.thisMonthTxs.map(tx => ({ Owner: o.name, Type: 'This Month', Date: tx.date, Amount: tx.amount, Details: tx.details || '-' })),
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
                          ...owner.openingBalanceTxs.map(tx => ({ Type: 'Opening Balance', Date: tx.date, Amount: tx.amount, Details: tx.details || '-' })),
                          ...owner.thisMonthTxs.map(tx => ({ Type: 'This Month', Date: tx.date, Amount: tx.amount, Details: tx.details || '-' })),
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
                            {owner.openingBalanceTxs.map((tx, idx) => (
                              <tr key={idx} className="hover:bg-violet-100/50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(tx.date).toLocaleDateString('en-SA')}</td>
                                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{tx.details || t('reports.openingBalance')}</td>
                                <td className="px-4 py-3 text-sm font-bold text-violet-700 text-end">SAR {fmt(Number(tx.amount) || 0)}</td>
                              </tr>
                            ))}
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
                            {owner.thisMonthTxs.map((tx, idx) => (
                              <tr key={idx} className="hover:bg-emerald-100/50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-600">{new Date(tx.date).toLocaleDateString('en-SA')}</td>
                                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{tx.details || t('history.ownerExpenses')}</td>
                                <td className="px-4 py-3 text-sm font-bold text-emerald-700 text-end">SAR {fmt(Number(tx.amount) || 0)}</td>
                              </tr>
                            ))}
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
        {t('reports.reportFooter')} {new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })} • {t('reports.period')}: {rangeStart} {t('vat.to')} {rangeEnd}
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
                          <p className="font-semibold text-gray-800 text-sm">{tx.details || tx.incomeCategory || 'Payment'}</p>
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

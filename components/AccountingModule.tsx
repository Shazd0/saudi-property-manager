import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen, TrendingUp, TrendingDown, Scale, PieChart, FileText, ClipboardList,
  DollarSign, ArrowUpDown, Download, Search, Plus, Minus, RefreshCw, Filter,
  BarChart3, ChevronDown, ChevronUp, ChevronRight, X, Calendar, Building,
  CreditCard, Banknote, Receipt, CheckCircle, AlertTriangle, ArrowRight, Eye,
  Printer, ArrowLeftRight, Hash, Layers, BookMarked, GitMerge, Activity,
  Package, Wallet, Landmark, Calculator, SlidersHorizontal, PenLine, Trash2
} from 'lucide-react';
import { getTransactions, getBuildings, getCustomers, getVendors, getBankStatements } from '../services/firestoreService';
import { Transaction, TransactionType, Building as BuildingType } from '../types';
import { useLanguage } from '../i18n';
import { fmtDate } from '../utils/dateFormat';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface AccountEntry {
  accountCode: string;
  accountName: string;
  accountNameAr: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  debit: number;
  credit: number;
  balance: number;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: { account: string; debit: number; credit: number; }[];
  totalDebit: number;
  totalCredit: number;
  status: 'Posted' | 'Draft';
  source?: string;
}

type AdjustmentType =
  | 'WRITE_OFF'
  | 'DISCOUNT'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'BALANCE_REDUCTION'
  | 'BALANCE_CLEAR'
  | 'OPENING_BALANCE'
  | 'ACCRUAL'
  | 'DEPRECIATION'
  | 'INCOME_REDUCTION'
  | 'CASH_REFUND';

interface AdjustmentEntry {
  id: string;
  date: string;
  type: AdjustmentType;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  reference: string;
}

interface FinancialPeriod {
  label: string;
  from: string;
  to: string;
}

// ─────────────────────────────────────────────
// Chart of Accounts Configuration
// ─────────────────────────────────────────────
const CHART_OF_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash & Cash Equivalents',      nameAr: 'النقد وما في حكمه',          type: 'ASSET',     keywords: ['cash', 'CASH', 'income', 'INCOME'] },
  { code: '1100', name: 'Accounts Receivable',          nameAr: 'الذمم المدينة',               type: 'ASSET',     keywords: ['pending', 'PENDING'] },
  { code: '1200', name: 'Bank Deposits',                nameAr: 'الودائع البنكية',             type: 'ASSET',     keywords: ['BANK', 'bank', 'cheque'] },
  { code: '1300', name: 'Security Deposits (Asset)',    nameAr: 'ضمانات الإيجار (أصول)',       type: 'ASSET',     keywords: ['deposit', 'insurance'] },
  { code: '1400', name: 'Prepaid Expenses',             nameAr: 'المصاريف المدفوعة مقدماً',    type: 'ASSET',     keywords: [] },
  { code: '1500', name: 'Fixed Assets (Properties)',    nameAr: 'الأصول الثابتة (عقارات)',     type: 'ASSET',     keywords: ['property', 'building'] },
  // Liabilities
  { code: '2000', name: 'Accounts Payable',             nameAr: 'الذمم الدائنة',               type: 'LIABILITY', keywords: ['vendor', 'VENDOR_PAYMENT'] },
  { code: '2100', name: 'VAT Payable',                   nameAr: 'ضريبة القيمة المضافة المستحقة', type: 'LIABILITY', keywords: ['vat', 'VAT'] },
  { code: '2200', name: 'Tenant Deposits Payable',      nameAr: 'ودائع المستأجرين',             type: 'LIABILITY', keywords: ['deposit', 'Security Deposit'] },
  { code: '2300', name: 'Borrowings Payable',           nameAr: 'القروض المستحقة',              type: 'LIABILITY', keywords: ['BORROWING', 'Borrowing', 'borrow'] },
  { code: '2400', name: 'Salaries Payable',             nameAr: 'الرواتب المستحقة',             type: 'LIABILITY', keywords: ['SALARY', 'Salary'] },
  // Equity
  { code: '3000', name: 'Owner\'s Capital',             nameAr: 'رأس مال المالك',               type: 'EQUITY',    keywords: [] },
  { code: '3100', name: 'Retained Earnings',            nameAr: 'الأرباح المحتجزة',             type: 'EQUITY',    keywords: [] },
  { code: '3200', name: 'Owner Drawings',               nameAr: 'مسحوبات المالك',              type: 'EQUITY',    keywords: ['Owner Expense', 'OWNER_EXPENSE', 'owner'] },
  // Revenue
  { code: '4000', name: 'Rental Income',                nameAr: 'إيرادات الإيجار',             type: 'REVENUE',   keywords: ['INCOME', 'RENTAL'] },
  { code: '4100', name: 'Service Fee Income',           nameAr: 'إيرادات رسوم الخدمة',        type: 'REVENUE',   keywords: ['service', 'Service Agreement'] },
  { code: '4200', name: 'Other Income',                 nameAr: 'إيرادات أخرى',               type: 'REVENUE',   keywords: ['OTHER', 'other'] },
  // Expenses
  { code: '5000', name: 'Maintenance Expense',          nameAr: 'مصاريف الصيانة',              type: 'EXPENSE',   keywords: ['MAINTENANCE', 'Maintenance'] },
  { code: '5100', name: 'Utilities Expense',            nameAr: 'مصاريف الخدمات',             type: 'EXPENSE',   keywords: ['UTILITIES', 'Utilities', 'utility'] },
  { code: '5200', name: 'Salary Expense',               nameAr: 'مصاريف الرواتب',             type: 'EXPENSE',   keywords: ['SALARY', 'Salary', 'salary'] },
  { code: '5300', name: 'General & Admin Expense',      nameAr: 'المصاريف العمومية والإدارية',  type: 'EXPENSE',   keywords: ['GENERAL', 'General Expense', 'HEAD', 'Head Office'] },
  { code: '5400', name: 'Vendor Payments',              nameAr: 'مدفوعات الموردين',            type: 'EXPENSE',   keywords: ['VENDOR_PAYMENT', 'Vendor Payment', 'vendor'] },
  { code: '5500', name: 'Property Rent Expense',        nameAr: 'مصاريف إيجار العقار',         type: 'EXPENSE',   keywords: ['PROPERTY_RENT', 'Property Rent'] },
  { code: '5600', name: 'VAT Expense',                  nameAr: 'مصروف ضريبة القيمة المضافة',  type: 'EXPENSE',   keywords: ['vat', 'vatAmount'] },
  { code: '5700', name: 'Other Expense',                nameAr: 'مصاريف أخرى',               type: 'EXPENSE',   keywords: ['EXPENSE'] },
];

// Map transaction to account code
function classifyTransaction(tx: Transaction): { debitCode: string; creditCode: string } {
  if (tx.type === TransactionType.INCOME) {
    const payMethod = tx.paymentMethod;
    const debitCode = (payMethod === 'BANK' || payMethod === 'CHEQUE') ? '1200' : '1000';
    return { debitCode, creditCode: '4000' };
  }
  if (tx.type === TransactionType.EXPENSE) {
    const cat = tx.expenseCategory || '';
    let expCode = '5700';
    if (cat.includes('Maintenance') || cat.includes('MAINTENANCE')) expCode = '5000';
    else if (cat.includes('Utilit') || cat.includes('UTILIT')) expCode = '5100';
    else if (cat.includes('Salary') || cat.includes('SALARY')) expCode = '5200';
    else if (cat.includes('General') || cat.includes('HEAD')) expCode = '5300';
    else if (cat.includes('Vendor') || cat.includes('VENDOR')) expCode = '5400';
    else if (cat.includes('Property Rent') || cat.includes('PROPERTY_RENT')) expCode = '5500';
    else if (cat.includes('Owner') || cat.includes('OWNER')) expCode = '5700';
    else if (cat.includes('Borrow') || cat.includes('BORROW')) expCode = '2300';
    const payMethod = tx.paymentMethod;
    const creditCode = (payMethod === 'BANK' || payMethod === 'CHEQUE') ? '1200' : '1000';
    return { debitCode: expCode, creditCode };
  }
  return { debitCode: '1000', creditCode: '4200' };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

// ─────────────────────────────────────────────
// Sub-tabs + Groups
// ─────────────────────────────────────────────
type AccountingTab =
  | 'overview'
  | 'chart_of_accounts'
  | 'journal'
  | 'general_ledger'
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'payables'
  | 'receivables'
  | 'budget'
  | 'aging'
  | 'adjustments';

// Route param → tab mapping
const PARAM_TO_TAB: Record<string, AccountingTab> = {
  'chart':       'chart_of_accounts',
  'journal':     'journal',
  'ledger':      'general_ledger',
  'trial':       'trial_balance',
  'income':      'income_statement',
  'balance':     'balance_sheet',
  'cashflow':    'cash_flow',
  'payables':    'payables',
  'receivables': 'receivables',
  'aging':       'aging',
  'budget':      'budget',
  'adjustments': 'adjustments',
};
const TAB_TO_PARAM: Record<AccountingTab, string> = {
  'overview':          '',
  'chart_of_accounts': 'chart',
  'journal':           'journal',
  'general_ledger':    'ledger',
  'trial_balance':     'trial',
  'income_statement':  'income',
  'balance_sheet':     'balance',
  'cash_flow':         'cashflow',
  'payables':          'payables',
  'receivables':       'receivables',
  'aging':             'aging',
  'budget':            'budget',
};

interface TabDef { id: AccountingTab; label: string; labelAr: string; icon: React.ElementType; color: string; }
interface TabGroup { label: string; labelAr: string; color: string; borderColor: string; bgColor: string; tabs: TabDef[]; }

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Overview',        labelAr: 'نظرة عامة',
    color: 'text-emerald-700', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-50',
    tabs: [
      { id: 'overview',          label: 'Dashboard',          labelAr: 'لوحة المحاسبة',     icon: Activity,      color: 'emerald' },
    ],
  },
  {
    label: 'Books & Ledgers',  labelAr: 'الدفاتر والسجلات',
    color: 'text-blue-700',    borderColor: 'border-blue-400',    bgColor: 'bg-blue-50',
    tabs: [
      { id: 'chart_of_accounts', label: 'Chart of Accounts',   labelAr: 'دليل الحسابات',     icon: BookMarked,    color: 'blue' },
      { id: 'journal',           label: 'Journal Entries',     labelAr: 'قيود اليومية',      icon: BookOpen,      color: 'blue' },
      { id: 'general_ledger',    label: 'General Ledger',      labelAr: 'دفتر الأستاذ',      icon: Layers,        color: 'blue' },
      { id: 'trial_balance',     label: 'Trial Balance',       labelAr: 'ميزان المراجعة',    icon: Scale,         color: 'blue' },
    ],
  },
  {
    label: 'Financial Statements', labelAr: 'القوائم المالية',
    color: 'text-purple-700',  borderColor: 'border-purple-400',  bgColor: 'bg-purple-50',
    tabs: [
      { id: 'income_statement',  label: 'Income Statement',    labelAr: 'قائمة الدخل',       icon: TrendingUp,    color: 'purple' },
      { id: 'balance_sheet',     label: 'Balance Sheet',       labelAr: 'الميزانية العمومية',icon: Landmark,      color: 'purple' },
      { id: 'cash_flow',         label: 'Cash Flow',           labelAr: 'التدفق النقدي',     icon: ArrowLeftRight,color: 'purple' },
    ],
  },
  {
    label: 'Payables & Receivables', labelAr: 'الذمم والتقارير',
    color: 'text-orange-700',  borderColor: 'border-orange-400',  bgColor: 'bg-orange-50',
    tabs: [
      { id: 'payables',          label: 'Accounts Payable',    labelAr: 'الذمم الدائنة',     icon: TrendingDown,  color: 'orange' },
      { id: 'receivables',       label: 'Accounts Receivable', labelAr: 'الذمم المدينة',     icon: TrendingUp,    color: 'orange' },
      { id: 'aging',             label: 'Aging Report',        labelAr: 'تقرير الأعمار',     icon: Calendar,      color: 'orange' },
      { id: 'budget',            label: 'Budget vs Actual',    labelAr: 'الميزانية التقديرية',icon: BarChart3,    color: 'orange' },
    ],
  },
  {
    label: 'Adjustments', labelAr: 'تسويات وتعديلات',
    color: 'text-purple-700', borderColor: 'border-purple-400', bgColor: 'bg-purple-50',
    tabs: [
      { id: 'adjustments', label: 'Adjustments & Controls', labelAr: 'التسويات والتعديلات', icon: SlidersHorizontal, color: 'purple' },
    ],
  },
];

const ALL_TABS: TabDef[] = TAB_GROUPS.flatMap(g => g.tabs);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const AccountingModule: React.FC = () => {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTabState] = useState<AccountingTab>(() => {
    if (tabParam && PARAM_TO_TAB[tabParam]) return PARAM_TO_TAB[tabParam];
    return 'overview';
  });

  // Sync tab from URL param changes
  useEffect(() => {
    if (tabParam && PARAM_TO_TAB[tabParam]) setActiveTabState(PARAM_TO_TAB[tabParam]);
    else if (!tabParam) setActiveTabState('overview');
  }, [tabParam]);

  const setActiveTab = (tab: AccountingTab) => {
    setActiveTabState(tab);
    const param = TAB_TO_PARAM[tab];
    navigate(param ? `/accounting/${param}` : '/accounting', { replace: true });
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buildings, setBuildings] = useState<BuildingType[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const { t, isRTL, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [adjustments, setAdjustments] = useState<AdjustmentEntry[]>(() => {
    try {
      const stored = localStorage.getItem('accounting_adjustments');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [txs, blds, custs, vnds] = await Promise.all([
          getTransactions(),
          getBuildings(),
          getCustomers(),
          getVendors(),
        ]);
        setTransactions((txs || []).filter((t: any) => !t.vatReportOnly));
        setBuildings(blds || []);
        setCustomers(custs || []);
        setVendors(vnds || []);
      } catch (e) { console.error('Accounting load error', e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Filtered transactions by period
  const periodTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (!tx.date) return false;
      return tx.date >= filterFrom && tx.date <= filterTo;
    });
  }, [transactions, filterFrom, filterTo]);

  // Build trial balance entries
  const trialBalance = useMemo((): AccountEntry[] => {
    const map: Record<string, { debit: number; credit: number }> = {};
    CHART_OF_ACCOUNTS.forEach(a => { map[a.code] = { debit: 0, credit: 0 }; });

    periodTxs.forEach(tx => {
      const { debitCode, creditCode } = classifyTransaction(tx);
      if (map[debitCode]) map[debitCode].debit += tx.amount;
      if (map[creditCode]) map[creditCode].credit += tx.amount;
      // Also map VAT separately
      if (tx.vatAmount && tx.vatAmount > 0) {
        if (map['2100']) map['2100'].credit += tx.vatAmount;
        if (map['5600']) map['5600'].debit += tx.vatAmount;
      }
    });

    // Apply manual adjustments to balances
    adjustments.forEach(adj => {
      if (map[adj.accountCode]) {
        map[adj.accountCode].debit += adj.debit;
        map[adj.accountCode].credit += adj.credit;
      }
    });

    return CHART_OF_ACCOUNTS.map(a => {
      const d = map[a.code]?.debit || 0;
      const c = map[a.code]?.credit || 0;
      let balance = 0;
      if (a.type === 'ASSET' || a.type === 'EXPENSE') balance = d - c;
      else balance = c - d;
      return {
        accountCode: a.code,
        accountName: a.name,
        accountNameAr: a.nameAr,
        type: a.type as AccountEntry['type'],
        debit: d,
        credit: c,
        balance,
      };
    });
  }, [periodTxs, adjustments]);

  // Totals
  const totals = useMemo(() => {
    const rawIncome = periodTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + (t.amount || 0), 0);
    // Subtract any income-reduction / cash-refund adjustments that debit revenue account 4000
    const incomeReductions = adjustments
      .filter(a => a.accountCode === '4000' && (a.type === 'INCOME_REDUCTION' || a.type === 'CASH_REFUND') && a.debit > 0)
      .reduce((s, a) => s + a.debit, 0);
    const totalIncome = Math.max(rawIncome - incomeReductions, 0);
    const totalExpense = periodTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + (t.amount || 0), 0);
    const netIncome = totalIncome - totalExpense;
    const totalVAT = periodTxs.reduce((s, t) => s + (t.vatAmount || 0), 0);
    const totalAssets = trialBalance.filter(a => a.type === 'ASSET').reduce((s, a) => s + Math.max(a.balance, 0), 0);
    const totalLiabilities = trialBalance.filter(a => a.type === 'LIABILITY').reduce((s, a) => s + Math.max(a.balance, 0), 0);
    const totalEquity = totalAssets - totalLiabilities;
    const totalDebit = trialBalance.reduce((s, a) => s + a.debit, 0);
    const totalCredit = trialBalance.reduce((s, a) => s + a.credit, 0);
    return { totalIncome, totalExpense, netIncome, totalVAT, totalAssets, totalLiabilities, totalEquity, totalDebit, totalCredit };
  }, [periodTxs, trialBalance, adjustments]);

  // Journal entries derived from transactions
  const journalEntries = useMemo((): JournalEntry[] => {
    return periodTxs.map(tx => {
      const { debitCode, creditCode } = classifyTransaction(tx);
      const da = CHART_OF_ACCOUNTS.find(a => a.code === debitCode);
      const ca = CHART_OF_ACCOUNTS.find(a => a.code === creditCode);
      return {
        id: tx.id,
        date: tx.date,
        reference: tx.id.slice(0, 8).toUpperCase(),
        description: tx.details || `${tx.type} - ${tx.expenseCategory || ''}`,
        lines: [
          { account: `${debitCode} - ${da?.name || ''}`, debit: tx.amount, credit: 0 },
          { account: `${creditCode} - ${ca?.name || ''}`, debit: 0, credit: tx.amount },
        ],
        totalDebit: tx.amount,
        totalCredit: tx.amount,
        status: (tx as any).status === 'PENDING' ? 'Draft' : 'Posted',
        source: tx.type === TransactionType.INCOME ? 'Income' : 'Expense',
      };
    });
  }, [periodTxs]);

  // Cash flow data
  const cashFlow = useMemo(() => {
    const operating = {
      inflow: periodTxs.filter(t => t.type === TransactionType.INCOME && t.paymentMethod === 'CASH').reduce((s, t) => s + t.amount, 0),
      outflow: periodTxs.filter(t => t.type === TransactionType.EXPENSE && t.paymentMethod === 'CASH').reduce((s, t) => s + t.amount, 0),
    };
    const bank = {
      inflow: periodTxs.filter(t => t.type === TransactionType.INCOME && (t.paymentMethod === 'BANK' || t.paymentMethod === 'CHEQUE')).reduce((s, t) => s + t.amount, 0),
      outflow: periodTxs.filter(t => t.type === TransactionType.EXPENSE && (t.paymentMethod === 'BANK' || t.paymentMethod === 'CHEQUE')).reduce((s, t) => s + t.amount, 0),
    };
    return { operating, bank, net: (operating.inflow + bank.inflow) - (operating.outflow + bank.outflow) };
  }, [periodTxs]);

  // Aging analysis (receivables)
  const agingData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const unpaid = transactions.filter(t => t.type === TransactionType.INCOME && (t as any).status === 'PENDING');
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    unpaid.forEach(tx => {
      const diff = Math.floor((new Date(today).getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 0) buckets.current += tx.amount;
      else if (diff <= 30) buckets.days30 += tx.amount;
      else if (diff <= 60) buckets.days60 += tx.amount;
      else if (diff <= 90) buckets.days90 += tx.amount;
      else buckets.over90 += tx.amount;
    });
    return buckets;
  }, [transactions]);

  // Monthly revenue for budget chart
  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(tx => {
      if (!tx.date) return;
      const month = tx.date.slice(0, 7);
      if (!months[month]) months[month] = { income: 0, expense: 0 };
      if (tx.type === TransactionType.INCOME) months[month].income += tx.amount;
      else if (tx.type === TransactionType.EXPENSE) months[month].expense += tx.amount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [transactions]);

  const print = () => window.print();

  // ─── Period filter bar ──────────────────────────────────────────────────
  const PeriodBar = () => (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-white/70 backdrop-blur rounded-xl p-4 border border-emerald-100 shadow-sm">
      <div className="flex items-center gap-2">
        <Calendar size={15} className="text-emerald-600" />
        <span className="text-xs font-semibold text-slate-600">Period:</span>
      </div>
      <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
        className="text-xs border border-emerald-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white" />
      <span className="text-slate-400 text-xs">to</span>
      <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
        className="text-xs border border-emerald-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white" />
      <div className="flex gap-1.5 ml-auto flex-wrap">
        {[
          { label: 'This Month', fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth(), 1); setFilterFrom(f.toISOString().split('T')[0]); setFilterTo(d.toISOString().split('T')[0]); } },
          { label: 'This Year', fn: () => { const d = new Date(); setFilterFrom(`${d.getFullYear()}-01-01`); setFilterTo(d.toISOString().split('T')[0]); } },
          { label: 'Last Year', fn: () => { const y = new Date().getFullYear() - 1; setFilterFrom(`${y}-01-01`); setFilterTo(`${y}-12-31`); } },
          { label: 'Q1', fn: () => { const y = new Date().getFullYear(); setFilterFrom(`${y}-01-01`); setFilterTo(`${y}-03-31`); } },
          { label: 'Q2', fn: () => { const y = new Date().getFullYear(); setFilterFrom(`${y}-04-01`); setFilterTo(`${y}-06-30`); } },
          { label: 'Q3', fn: () => { const y = new Date().getFullYear(); setFilterFrom(`${y}-07-01`); setFilterTo(`${y}-09-30`); } },
          { label: 'Q4', fn: () => { const y = new Date().getFullYear(); setFilterFrom(`${y}-10-01`); setFilterTo(`${y}-12-31`); } },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
            {b.label}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-slate-400 font-medium">{periodTxs.length} transactions</span>
    </div>
  );

  // ─── Overview tab ───────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: fmt(totals.totalIncome), icon: TrendingUp, color: 'emerald', sub: `${periodTxs.filter(t => t.type === TransactionType.INCOME).length} entries` },
          { label: 'Total Expenses', value: fmt(totals.totalExpense), icon: TrendingDown, color: 'rose', sub: `${periodTxs.filter(t => t.type === TransactionType.EXPENSE).length} entries` },
          { label: 'Net Income', value: fmt(totals.netIncome), icon: DollarSign, color: totals.netIncome >= 0 ? 'emerald' : 'rose', sub: totals.netIncome >= 0 ? 'Profit' : 'Loss' },
          { label: 'Total VAT', value: fmt(totals.totalVAT), icon: Receipt, color: 'amber', sub: '15% VAT collected' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-2xl p-5 border border-${c.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`p-2 rounded-xl bg-${c.color}-100`}><c.icon size={18} className={`text-${c.color}-600`} /></span>
              <span className={`text-[10px] font-bold uppercase tracking-wider text-${c.color}-600 bg-${c.color}-50 px-2 py-0.5 rounded-full`}>{c.sub}</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{c.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Balance Sheet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Assets', value: fmt(totals.totalAssets), icon: Package, color: 'blue' },
          { label: 'Total Liabilities', value: fmt(totals.totalLiabilities), icon: CreditCard, color: 'orange' },
          { label: "Owner's Equity", value: fmt(totals.totalEquity), icon: Wallet, color: 'purple' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-2xl p-5 border border-${c.color}-100 shadow-sm flex items-center gap-4`}>
            <span className={`p-3 rounded-xl bg-${c.color}-50`}><c.icon size={22} className={`text-${c.color}-600`} /></span>
            <div>
              <p className="text-xl font-black text-slate-800">{c.value}</p>
              <p className="text-xs font-semibold text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> Monthly Income vs Expense</h3>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-2 min-w-max">
            {monthlyData.map(([month, data]) => {
              const maxVal = Math.max(...monthlyData.map(([, d]) => Math.max(d.income, d.expense)), 1);
              const incH = Math.round((data.income / maxVal) * 120);
              const expH = Math.round((data.expense / maxVal) * 120);
              return (
                <div key={month} className="flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 h-32">
                    <div style={{ height: incH }} className="w-5 bg-emerald-400 rounded-t-sm hover:bg-emerald-500 transition-colors" title={`Income: SAR ${fmt(data.income)}`} />
                    <div style={{ height: expH }} className="w-5 bg-rose-400 rounded-t-sm hover:bg-rose-500 transition-colors" title={`Expense: SAR ${fmt(data.expense)}`} />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">{month.slice(5)}/{month.slice(2, 4)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" />{t('entry.income')}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 bg-rose-400 rounded-sm inline-block" />{t('entry.expense')}</span>
          </div>
        </div>
      </div>

      {/* Quick navigation — grouped cards */}
      <div className="space-y-4">
        {TAB_GROUPS.filter(g => g.label !== 'Overview').map(group => (
          <div key={group.label} className={`rounded-2xl border ${group.borderColor} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${group.bgColor} ${group.color} font-black text-xs uppercase tracking-wider flex items-center gap-2`}>
              <span>{group.label}</span>
              <span className="text-[10px] opacity-60 font-medium normal-case" dir="rtl">{group.labelAr}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-white divide-x divide-slate-50">
              {group.tabs.map((tab, i) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`p-4 text-left hover:bg-slate-50 transition-all group border-b border-slate-50 ${i % 2 === 0 && i === group.tabs.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
                  <tab.icon size={18} className={`text-${tab.color}-500 mb-2 group-hover:text-${tab.color}-700 transition-colors`} />
                  <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900 leading-tight">{tab.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5" dir="rtl">{tab.labelAr}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Chart of Accounts tab ─────────────────────────────────────────────
  const ChartOfAccountsTab = () => {
    const groups: Record<string, typeof CHART_OF_ACCOUNTS> = {};
    CHART_OF_ACCOUNTS.forEach(a => {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    });
    const typeColors: Record<string, string> = {
      ASSET: 'bg-blue-50 text-blue-700 border-blue-100',
      LIABILITY: 'bg-orange-50 text-orange-700 border-orange-100',
      EQUITY: 'bg-purple-50 text-purple-700 border-purple-100',
      REVENUE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      EXPENSE: 'bg-rose-50 text-rose-700 border-rose-100',
    };
    const typeLabels: Record<string, string> = {
      ASSET: 'Assets (حسابات الأصول)',
      LIABILITY: 'Liabilities (حسابات الخصوم)',
      EQUITY: "Equity (حقوق الملكية)",
      REVENUE: 'Revenue (حسابات الإيرادات)',
      EXPENSE: 'Expenses (حسابات المصاريف)',
    };
    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([type, accounts]) => (
          <div key={type} className={`border rounded-2xl overflow-hidden ${typeColors[type]}`}>
            <div className={`px-5 py-3 font-bold text-sm flex items-center justify-between`}>
              <span>{typeLabels[type]}</span>
              <span className="text-xs opacity-70">{accounts.length} accounts</span>
            </div>
            <div className="bg-white divide-y divide-slate-50">
              {accounts.map(a => {
                const tb = trialBalance.find(t => t.accountCode === a.code);
                return (
                  <div key={a.code}
                    onClick={() => { setSelectedAccount(a.code); setActiveTab('general_ledger'); }}
                    className="flex items-center px-5 py-3 hover:bg-emerald-50 cursor-pointer transition-colors group">
                    <span className="text-xs font-mono font-bold text-slate-400 w-14">{a.code}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.nameAr}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 text-right">
                      {tb && (tb.debit > 0 || tb.credit > 0) ? (
                        <span className={tb.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          SAR {fmt(tb.balance)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </span>
                    <ArrowRight size={13} className="text-slate-300 group-hover:text-emerald-400 ml-2 transition-colors" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Journal Entries tab ───────────────────────────────────────────────
  const JournalTab = () => {
    const [search, setSearch] = useState('');
    const filtered = journalEntries.filter(j =>
      !search || j.description.toLowerCase().includes(search.toLowerCase()) || j.reference.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search journal entries..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white" />
          </div>
          <span className="text-xs font-semibold text-slate-500">{filtered.length} entries</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                <th className="px-4 py-3 text-left font-bold">{t('common.date')}</th>
                <th className="px-4 py-3 text-left font-bold">Reference</th>
                <th className="px-4 py-3 text-left font-bold">{t('entry.description')}</th>
                <th className="px-4 py-3 text-left font-bold">Account (Debit)</th>
                <th className="px-4 py-3 text-left font-bold">Account (Credit)</th>
                <th className="px-4 py-3 text-right font-bold">{t('common.amount')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No journal entries found</td></tr>
              )}
              {filtered.map(j => (
                <tr key={j.id} className="hover:bg-emerald-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-600">{j.date}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{j.reference}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{j.description}</td>
                  <td className="px-4 py-3 text-slate-600">{j.lines[0]?.account}</td>
                  <td className="px-4 py-3 text-slate-600">{j.lines[1]?.account}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">SAR {fmt(j.totalDebit)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${j.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                <td colSpan={5} className="px-4 py-3 text-slate-700">{t('common.total')}</td>
                <td className="px-4 py-3 text-right text-emerald-700">SAR {fmt(filtered.reduce((s, j) => s + j.totalDebit, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ─── General Ledger tab ────────────────────────────────────────────────
  const GeneralLedgerTab = () => {
    const account = selectedAccount || CHART_OF_ACCOUNTS[0].code;
    const accountDef = CHART_OF_ACCOUNTS.find(a => a.code === account)!;
    const entries = periodTxs.filter(tx => {
      const { debitCode, creditCode } = classifyTransaction(tx);
      return debitCode === account || creditCode === account;
    });
    let runningBalance = 0;
    return (
      <div>
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={account} onChange={e => setSelectedAccount(e.target.value)}
            className="flex-1 min-w-48 text-sm border border-emerald-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
            {CHART_OF_ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
          </select>
          <input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder={t('entry.search')}
            className="text-sm border border-emerald-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white" />
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 mb-4">
          <div className="flex items-center gap-3">
            <BookMarked size={18} className="text-emerald-600" />
            <div>
              <p className="font-bold text-slate-800">{accountDef?.code} — {accountDef?.name}</p>
              <p className="text-xs text-slate-400">{accountDef?.nameAr} • Type: {accountDef?.type}</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                <th className="px-4 py-3 text-left font-bold">{t('common.date')}</th>
                <th className="px-4 py-3 text-left font-bold">{t('entry.description')}</th>
                <th className="px-4 py-3 text-right font-bold">Debit (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Credit (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Balance (SAR)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {entries.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No entries for this account in selected period</td></tr>
              )}
              {entries.filter(e => !ledgerSearch || (e.details || '').toLowerCase().includes(ledgerSearch.toLowerCase())).map(tx => {
                const { debitCode } = classifyTransaction(tx);
                const isDebit = debitCode === account;
                if (isDebit) runningBalance += tx.amount;
                else runningBalance -= tx.amount;
                return (
                  <tr key={tx.id} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-600">{tx.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{tx.details}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{isDebit ? fmt(tx.amount) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{!isDebit ? fmt(tx.amount) : '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${runningBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                      {fmt(Math.abs(runningBalance))} {runningBalance < 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Trial Balance tab ──────────────────────────────────────────────────
  const TrialBalanceTab = () => {
    const nonZero = trialBalance.filter(a => a.debit > 0 || a.credit > 0);
    const allRows = nonZero.length > 0 ? nonZero : trialBalance;
    const totalDr = allRows.reduce((s, a) => s + a.debit, 0);
    const totalCr = allRows.reduce((s, a) => s + a.credit, 0);
    const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

    const typeColors: Record<string, string> = {
      ASSET: 'text-blue-600',
      LIABILITY: 'text-orange-600',
      EQUITY: 'text-purple-600',
      REVENUE: 'text-emerald-600',
      EXPENSE: 'text-rose-600',
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Scale size={20} className="text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-800">{t('nav.trialBalance')}</h3>
              <p className="text-xs text-slate-500">ميزان المراجعة — As at {filterTo}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {isBalanced ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
            {isBalanced ? 'Balanced ✓' : 'Out of Balance!'}
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                <th className="px-4 py-3 text-left font-bold">Code</th>
                <th className="px-4 py-3 text-left font-bold">Account Name</th>
                <th className="px-4 py-3 text-left font-bold">{t('history.type')}</th>
                <th className="px-4 py-3 text-right font-bold">Debit (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Credit (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">{t('tenant.balance')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {allRows.map(a => (
                <tr key={a.accountCode}
                  onClick={() => { setSelectedAccount(a.accountCode); setActiveTab('general_ledger'); }}
                  className="hover:bg-emerald-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-500">{a.accountCode}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{a.accountName}</p>
                    <p className="text-slate-400 text-[10px]">{a.accountNameAr}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColors[a.type]} bg-opacity-10`} style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{a.debit > 0 ? fmt(a.debit) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{a.credit > 0 ? fmt(a.credit) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-bold ${a.balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {fmt(Math.abs(a.balance))} {a.balance < 0 ? 'Cr' : 'Dr'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                <td colSpan={3} className="px-4 py-3 text-slate-700 font-black">TOTALS</td>
                <td className="px-4 py-3 text-right text-emerald-800 font-black">SAR {fmt(totalDr)}</td>
                <td className="px-4 py-3 text-right text-emerald-800 font-black">SAR {fmt(totalCr)}</td>
                <td className={`px-4 py-3 text-right font-black ${isBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {isBalanced ? '✓ Balanced' : `Diff: ${fmt(Math.abs(totalDr - totalCr))}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 text-center">
          * Trial balance is auto-generated from recorded transactions. Opening balances not included.
        </p>
      </div>
    );
  };

  // ─── Income Statement tab ──────────────────────────────────────────────
  const IncomeStatementTab = () => {
    const revenueAccounts = trialBalance.filter(a => a.type === 'REVENUE');
    const expenseAccounts = trialBalance.filter(a => a.type === 'EXPENSE');
    const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0);
    const grossProfit = totalRevenue;
    const netProfit = grossProfit - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 text-white text-center">
            <p className="text-xs font-semibold opacity-75 mb-1">قائمة الدخل</p>
            <h3 className="text-xl font-black">{t('nav.incomeStatement')}</h3>
            <p className="text-sm opacity-80 mt-1">For period: {filterFrom} to {filterTo}</p>
          </div>
          <div className="p-5">
            {/* Revenue */}
            <div className="mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
                <TrendingUp size={12} /> REVENUES (الإيرادات)
              </h4>
              {revenueAccounts.filter(a => a.balance > 0).map(a => (
                <div key={a.accountCode} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <div>
                    <span className="text-sm text-slate-700">{a.accountName}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{a.accountCode}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">SAR {fmt(a.balance)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t-2 border-emerald-200 mt-1">
                <span className="text-sm font-bold text-emerald-800">Total Revenue</span>
                <span className="text-sm font-black text-emerald-800">SAR {fmt(totalRevenue)}</span>
              </div>
            </div>

            {/* Expenses */}
            <div className="mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1.5">
                <TrendingDown size={12} /> EXPENSES (المصاريف)
              </h4>
              {expenseAccounts.filter(a => a.balance > 0).map(a => (
                <div key={a.accountCode} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <div>
                    <span className="text-sm text-slate-700">{a.accountName}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{a.accountCode}</span>
                  </div>
                  <span className="text-sm font-semibold text-rose-600">SAR {fmt(a.balance)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t-2 border-rose-200 mt-1">
                <span className="text-sm font-bold text-rose-700">{t('dashboard.totalExpense')}</span>
                <span className="text-sm font-black text-rose-700">SAR {fmt(totalExpenses)}</span>
              </div>
            </div>

            {/* Net */}
            <div className={`rounded-xl p-4 border-2 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
                  <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>SAR {fmt(Math.abs(netProfit))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Profit Margin</p>
                  <p className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{margin.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Balance Sheet tab ──────────────────────────────────────────────────
  const BalanceSheetTab = () => {
    const assets = trialBalance.filter(a => a.type === 'ASSET');
    const liabilities = trialBalance.filter(a => a.type === 'LIABILITY');
    const equity = trialBalance.filter(a => a.type === 'EQUITY');
    const totalAssets = assets.reduce((s, a) => s + Math.max(a.balance, 0), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + Math.max(a.balance, 0), 0);
    const retainedEarnings = totals.netIncome;
    const totalEquity = Math.max(totalAssets - totalLiabilities, 0);

    const Section = ({ title, accounts, total, color }: { title: string; accounts: AccountEntry[]; total: number; color: string }) => (
      <div className="mb-4">
        <h4 className={`text-xs font-black uppercase tracking-wider ${color} mb-2`}>{title}</h4>
        {accounts.map(a => (
          <div key={a.accountCode} className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-700">{a.accountName}</span>
              <span className="text-[10px] text-slate-400 ml-2">{a.accountCode}</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">SAR {fmt(a.balance)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 border-t-2 border-slate-200 mt-1">
          <span className="text-sm font-bold text-slate-800">{t('common.total')}</span>
          <span className="text-sm font-black text-slate-800">SAR {fmt(total)}</span>
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white text-center">
            <p className="text-xs opacity-75">الأصول</p>
            <h3 className="text-lg font-black">ASSETS</h3>
          </div>
          <div className="p-5">
            <Section title="Current Assets" accounts={assets.filter(a => ['1000','1100','1200'].includes(a.accountCode))} total={assets.filter(a => ['1000','1100','1200'].includes(a.accountCode)).reduce((s, a) => s + Math.max(a.balance, 0), 0)} color="text-blue-700" />
            <Section title="Non-Current Assets" accounts={assets.filter(a => ['1300','1400','1500'].includes(a.accountCode))} total={assets.filter(a => ['1300','1400','1500'].includes(a.accountCode)).reduce((s, a) => s + Math.max(a.balance, 0), 0)} color="text-blue-600" />
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-center">
              <p className="text-xs text-blue-600">TOTAL ASSETS</p>
              <p className="text-xl font-black text-blue-800">SAR {fmt(totalAssets)}</p>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-4 text-white text-center">
            <p className="text-xs opacity-75">الخصوم وحقوق الملكية</p>
            <h3 className="text-lg font-black">LIABILITIES & EQUITY</h3>
          </div>
          <div className="p-5">
            <Section title="Liabilities (الخصوم)" accounts={liabilities} total={totalLiabilities} color="text-orange-700" />
            <div className="mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 mb-2">EQUITY (حقوق الملكية)</h4>
              {equity.map(a => (
                <div key={a.accountCode} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-sm text-slate-700">{a.accountName}</span>
                  <span className="text-sm font-semibold text-slate-700">SAR {fmt(Math.max(a.balance, 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-700">Retained Earnings (Period)</span>
                <span className={`text-sm font-semibold ${retainedEarnings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>SAR {fmt(retainedEarnings)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t-2 border-slate-200 mt-1">
                <span className="text-sm font-bold text-slate-800">Total Equity</span>
                <span className="text-sm font-black text-slate-800">SAR {fmt(totalEquity)}</span>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200 text-center">
              <p className="text-xs text-orange-600">TOTAL LIABILITIES + EQUITY</p>
              <p className="text-xl font-black text-orange-800">SAR {fmt(totalLiabilities + totalEquity)}</p>
            </div>
            <div className={`mt-2 text-center text-xs font-bold px-3 py-1.5 rounded-full ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1 ? '✓ Balance Sheet Balances' : '⚠ Balance sheet does not balance — opening balances may be missing'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Cash Flow tab ─────────────────────────────────────────────────────
  const CashFlowTab = () => {
    const months = [...new Set(periodTxs.map(tx => tx.date?.slice(0, 7)))].sort();
    const monthlyFlow = months.map(m => {
      const mtxs = periodTxs.filter(t => t.date?.startsWith(m));
      const inflow = mtxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
      const outflow = mtxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
      return { month: m, inflow, outflow, net: inflow - outflow };
    });
    let cumulativeCash = 0;

    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Cash Inflow', value: fmt(cashFlow.operating.inflow + cashFlow.bank.inflow), color: 'emerald', icon: TrendingUp },
            { label: 'Cash Outflow', value: fmt(cashFlow.operating.outflow + cashFlow.bank.outflow), color: 'rose', icon: TrendingDown },
            { label: 'Net Cash Flow', value: fmt(cashFlow.net), color: cashFlow.net >= 0 ? 'emerald' : 'rose', icon: ArrowLeftRight },
          ].map(c => (
            <div key={c.label} className={`bg-white rounded-2xl p-4 border border-${c.color}-100 shadow-sm flex items-center gap-3`}>
              <span className={`p-2.5 rounded-xl bg-${c.color}-100`}><c.icon size={18} className={`text-${c.color}-600`} /></span>
              <div>
                <p className={`text-xl font-black text-${c.color}-700`}>SAR {c.value}</p>
                <p className="text-xs font-semibold text-slate-500">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* By payment method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Wallet size={15} className="text-emerald-600" /> Cash Transactions</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Cash Inflow</span><span className="font-bold text-emerald-700">SAR {fmt(cashFlow.operating.inflow)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Cash Outflow</span><span className="font-bold text-rose-600">SAR {fmt(cashFlow.operating.outflow)}</span></div>
              <div className="flex justify-between text-sm border-t pt-2"><span className="font-bold text-slate-700">Net Cash</span><span className={`font-black ${(cashFlow.operating.inflow - cashFlow.operating.outflow) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>SAR {fmt(cashFlow.operating.inflow - cashFlow.operating.outflow)}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Banknote size={15} className="text-blue-600" /> Bank/Cheque Transactions</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Bank Inflow</span><span className="font-bold text-emerald-700">SAR {fmt(cashFlow.bank.inflow)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Bank Outflow</span><span className="font-bold text-rose-600">SAR {fmt(cashFlow.bank.outflow)}</span></div>
              <div className="flex justify-between text-sm border-t pt-2"><span className="font-bold text-slate-700">Net Bank</span><span className={`font-black ${(cashFlow.bank.inflow - cashFlow.bank.outflow) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>SAR {fmt(cashFlow.bank.inflow - cashFlow.bank.outflow)}</span></div>
            </div>
          </div>
        </div>

        {/* Monthly table */}
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                <th className="px-4 py-3 text-left font-bold">{t('calendar.month')}</th>
                <th className="px-4 py-3 text-right font-bold">Inflow (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Outflow (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Net (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Cumulative (SAR)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {monthlyFlow.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No data for period</td></tr>}
              {monthlyFlow.map(m => {
                cumulativeCash += m.net;
                return (
                  <tr key={m.month} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{m.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmt(m.inflow)}</td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold">{fmt(m.outflow)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmt(m.net)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${cumulativeCash >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(cumulativeCash)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Payables tab ──────────────────────────────────────────────────────
  const PayablesTab = () => {
    type VPayRow = { name: string; total: number; count: number };
    const vendorMap: Record<string, VPayRow> = {};
    periodTxs
      .filter(t => t.type === TransactionType.EXPENSE && (t.expenseCategory?.includes('Vendor') || t.expenseCategory?.includes('VENDOR')))
      .forEach(tx => {
        const key = tx.vendorId || tx.vendorName || 'Unknown';
        const name = tx.vendorName || 'Unknown Vendor';
        if (!vendorMap[key]) vendorMap[key] = { name, total: 0, count: 0 };
        vendorMap[key].total += tx.amount;
        vendorMap[key].count++;
      });

    const rows: [string, VPayRow][] = (Object.entries(vendorMap) as [string, VPayRow][]).sort(([, a], [, b]) => b.total - a.total);
    const totalPayable = rows.reduce((s, [, v]) => s + v.total, 0);

    return (
      <div>
        <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm mb-4 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-orange-700">SAR {fmt(totalPayable)}</p>
            <p className="text-xs text-slate-500">Total Vendor Payments in Period</p>
          </div>
          <TrendingDown size={32} className="text-orange-300" />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-orange-500 to-orange-400 text-white">
                <th className="px-4 py-3 text-left font-bold">{t('entry.vendor')}</th>
                <th className="px-4 py-3 text-right font-bold">{t('nav.transactions')}</th>
                <th className="px-4 py-3 text-right font-bold">Amount Paid (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">No vendor payments in period</td></tr>}
              {rows.map(([key, v]) => (
                <tr key={key} className="hover:bg-orange-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700">{v.name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{v.count}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700">SAR {fmt(v.total)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{totalPayable > 0 ? ((v.total / totalPayable) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                <td className="px-4 py-3">{t('common.total')}</td>
                <td className="px-4 py-3 text-right">{rows.reduce((s, [, v]) => s + v.count, 0)}</td>
                <td className="px-4 py-3 text-right text-orange-700">SAR {fmt(totalPayable)}</td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ─── Receivables tab ───────────────────────────────────────────────────
  const ReceivablesTab = () => {
    type VRecRow = { name: string; total: number; count: number; building: string };
    const custMap: Record<string, VRecRow> = {};
    periodTxs
      .filter(t => t.type === TransactionType.INCOME)
      .forEach(tx => {
        const key = tx.contractId || tx.unitNumber || tx.buildingId || 'general';
        const name = tx.buildingName ? `${tx.buildingName} — ${tx.unitNumber || ''}` : 'General Income';
        if (!custMap[key]) custMap[key] = { name, total: 0, count: 0, building: tx.buildingName || '' };
        custMap[key].total += tx.amount;
        custMap[key].count++;
      });

    const rows: [string, VRecRow][] = (Object.entries(custMap) as [string, VRecRow][]).sort(([, a], [, b]) => b.total - a.total);
    const totalReceivable = rows.reduce((s, [, v]) => s + v.total, 0);

    return (
      <div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm mb-4 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-emerald-700">SAR {fmt(totalReceivable)}</p>
            <p className="text-xs text-slate-500">Total Income in Period</p>
          </div>
          <TrendingUp size={32} className="text-emerald-300" />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                <th className="px-4 py-3 text-left font-bold">Source</th>
                <th className="px-4 py-3 text-right font-bold">{t('nav.transactions')}</th>
                <th className="px-4 py-3 text-right font-bold">{t('entry.amount')}</th>
                <th className="px-4 py-3 text-right font-bold">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">No receivables in period</td></tr>}
              {rows.map(([key, v]) => (
                <tr key={key} className="hover:bg-emerald-50 transition-colors">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-700">{v.name}</p><p className="text-slate-400">{v.building}</p></td>
                  <td className="px-4 py-3 text-right text-slate-600">{v.count}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">SAR {fmt(v.total)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{totalReceivable > 0 ? ((v.total / totalReceivable) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                <td className="px-4 py-3">{t('common.total')}</td>
                <td className="px-4 py-3 text-right">{rows.reduce((s, [, v]) => s + v.count, 0)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">SAR {fmt(totalReceivable)}</td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ─── Aging Report tab ──────────────────────────────────────────────────
  const AgingTab = () => {
    const totalAging = agingData.current + agingData.days30 + agingData.days60 + agingData.days90 + agingData.over90;
    const buckets = [
      { label: 'Current (0 days)', value: agingData.current, color: 'emerald' },
      { label: '1–30 Days', value: agingData.days30, color: 'yellow' },
      { label: '31–60 Days', value: agingData.days60, color: 'amber' },
      { label: '61–90 Days', value: agingData.days90, color: 'orange' },
      { label: 'Over 90 Days', value: agingData.over90, color: 'rose' },
    ];
    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {buckets.map(b => (
            <div key={b.label} className={`bg-white rounded-2xl p-4 border border-${b.color}-100 shadow-sm text-center`}>
              <p className={`text-lg font-black text-${b.color}-700`}>SAR {fmt(b.value)}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{b.label}</p>
              <p className="text-[10px] text-slate-400">{totalAging > 0 ? ((b.value / totalAging) * 100).toFixed(0) : 0}%</p>
            </div>
          ))}
        </div>
        {/* Visual bar */}
        {totalAging > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm mb-6">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Aging Distribution</h4>
            <div className="flex rounded-full overflow-hidden h-6">
              {buckets.map(b => {
                const w = totalAging > 0 ? (b.value / totalAging) * 100 : 0;
                if (w < 1) return null;
                return <div key={b.label} style={{ width: `${w}%` }} className={`bg-${b.color}-400 flex items-center justify-center text-[9px] text-white font-bold`} title={`${b.label}: ${w.toFixed(1)}%`}>{w > 8 ? `${w.toFixed(0)}%` : ''}</div>;
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {buckets.map(b => <span key={b.label} className={`flex items-center gap-1 text-xs text-slate-500`}><span className={`w-2.5 h-2.5 rounded-sm bg-${b.color}-400 inline-block`} />{b.label}</span>)}
            </div>
          </div>
        )}
        {totalAging === 0 && (
          <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100 text-center">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-emerald-700">No outstanding receivables! All transactions are cleared.</p>
          </div>
        )}
      </div>
    );
  };

  // ─── Budget vs Actual tab ──────────────────────────────────────────────
  const BudgetTab = () => {
    // Simple budget targets (could be made configurable)
    const budgetCategories = [
      { label: 'Rental Income', budget: totals.totalIncome * 1.1, actual: totals.totalIncome, type: 'revenue' },
      { label: 'Maintenance', budget: totals.totalExpense * 0.3, actual: periodTxs.filter(t => (t.expenseCategory || '').includes('Maintenance')).reduce((s, t) => s + t.amount, 0), type: 'expense' },
      { label: 'Salaries', budget: totals.totalExpense * 0.35, actual: periodTxs.filter(t => (t.expenseCategory || '').includes('Salary')).reduce((s, t) => s + t.amount, 0), type: 'expense' },
      { label: 'Utilities', budget: totals.totalExpense * 0.1, actual: periodTxs.filter(t => (t.expenseCategory || '').includes('Utilit')).reduce((s, t) => s + t.amount, 0), type: 'expense' },
      { label: 'Admin & General', budget: totals.totalExpense * 0.15, actual: periodTxs.filter(t => (t.expenseCategory || '').includes('General') || (t.expenseCategory || '').includes('HEAD')).reduce((s, t) => s + t.amount, 0), type: 'expense' },
      { label: 'Vendor Payments', budget: totals.totalExpense * 0.1, actual: periodTxs.filter(t => (t.expenseCategory || '').includes('Vendor')).reduce((s, t) => s + t.amount, 0), type: 'expense' },
    ];

    return (
      <div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-700 font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={14} /> Budget is auto-estimated at 10% above income and proportionally for expenses. Configure actual budgets in Settings.
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-purple-500 text-white">
                <th className="px-4 py-3 text-left font-bold">{t('entry.categoryShort')}</th>
                <th className="px-4 py-3 text-right font-bold">Budget (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Actual (SAR)</th>
                <th className="px-4 py-3 text-right font-bold">Variance</th>
                <th className="px-4 py-3 text-right font-bold">Progress</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {budgetCategories.map(b => {
                const variance = b.type === 'revenue' ? b.actual - b.budget : b.budget - b.actual;
                const pct = b.budget > 0 ? Math.min((b.actual / b.budget) * 100, 200) : 0;
                const over = pct > 100;
                return (
                  <tr key={b.label} className="hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{b.label}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(b.budget)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(b.actual)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${over ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`font-bold text-[10px] ${over ? 'text-rose-600' : 'text-emerald-600'}`}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Adjustments tab ───────────────────────────────────────────────────
  const AdjustmentsTab = () => {
    const [formOpen, setFormOpen] = useState(false);
    const [adjType, setAdjType] = useState<AdjustmentType>('BALANCE_REDUCTION');
    const [adjAccount, setAdjAccount] = useState('');
    const [adjDebit, setAdjDebit] = useState('');
    const [adjCredit, setAdjCredit] = useState('');
    const [adjDesc, setAdjDesc] = useState('');
    const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
    const [adjRef, setAdjRef] = useState('');

    const typeColorMap: Record<AdjustmentType, string> = {
      WRITE_OFF:         'bg-rose-100 text-rose-700',
      DISCOUNT:          'bg-amber-100 text-amber-700',
      CREDIT_NOTE:       'bg-blue-100 text-blue-700',
      DEBIT_NOTE:        'bg-orange-100 text-orange-700',
      BALANCE_REDUCTION: 'bg-purple-100 text-purple-700',
      BALANCE_CLEAR:     'bg-slate-100 text-slate-700',
      OPENING_BALANCE:   'bg-emerald-100 text-emerald-700',
      ACCRUAL:           'bg-cyan-100 text-cyan-700',
      DEPRECIATION:      'bg-gray-100 text-gray-700',
      INCOME_REDUCTION:  'bg-rose-100 text-rose-800',
      CASH_REFUND:       'bg-pink-100 text-pink-700',
    };

    const ADJ_TYPES: { value: AdjustmentType; label: string; labelAr: string; desc: string }[] = [
      { value: 'INCOME_REDUCTION',  label: 'Cash Income Reduction', labelAr: 'تخفيض الإيراد النقدي', desc: 'Reduce recorded cash income — debits Revenue (4000) & credits Cash (1000). Use for corrections or partial reversals.' },
      { value: 'CASH_REFUND',       label: 'Cash Refund',          labelAr: 'استرداد نقدي',         desc: 'Record a full or partial cash refund to a tenant/customer. Debits Revenue and reduces Cash.' },
      { value: 'WRITE_OFF',         label: 'Write-Off',            labelAr: 'شطب',              desc: 'Remove an uncollectable balance from the books' },
      { value: 'DISCOUNT',          label: 'Discount',             labelAr: 'خصم',              desc: 'Apply a discount or rebate to an account balance' },
      { value: 'CREDIT_NOTE',       label: 'Credit Note',          labelAr: 'إشعار دائن',        desc: 'Issue a credit to reduce an outstanding balance' },
      { value: 'DEBIT_NOTE',        label: 'Debit Note',           labelAr: 'إشعار مدين',        desc: 'Add a debit charge to increase a balance due' },
      { value: 'BALANCE_REDUCTION', label: 'Balance Reduction',    labelAr: 'تخفيض الرصيد',     desc: 'Manually reduce an account balance by a specific amount' },
      { value: 'BALANCE_CLEAR',     label: 'Balance Clear / Zero', labelAr: 'تصفير الرصيد',      desc: 'Fully zero out an account balance' },
      { value: 'OPENING_BALANCE',   label: 'Opening Balance',      labelAr: 'رصيد افتتاحي',      desc: 'Set or correct an account opening balance' },
      { value: 'ACCRUAL',           label: 'Accrual Entry',        labelAr: 'قيد اعتمادي',       desc: 'Record income/expense before cash is received or paid' },
      { value: 'DEPRECIATION',      label: 'Depreciation',         labelAr: 'استهلاك',           desc: 'Record asset depreciation expense for the period' },
    ];

    // ── Quick Income Reduction state ──
    const [qirAmount, setQirAmount] = useState('');
    const [qirDesc, setQirDesc] = useState('');

    const handleQirSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const amt = parseFloat(qirAmount);
      if (!amt || amt <= 0 || !qirDesc.trim()) return;
      const ref = `QIR-${Date.now().toString(36).toUpperCase()}`;
      const revenueAdj: AdjustmentEntry = {
        id: `QIR-${Date.now()}-R`,
        date: new Date().toISOString().split('T')[0],
        type: 'INCOME_REDUCTION',
        accountCode: '4000',
        description: qirDesc.trim(),
        debit: amt,
        credit: 0,
        reference: ref,
      };
      const cashAdj: AdjustmentEntry = {
        id: `QIR-${Date.now()}-C`,
        date: new Date().toISOString().split('T')[0],
        type: 'INCOME_REDUCTION',
        accountCode: '1000',
        description: qirDesc.trim(),
        debit: 0,
        credit: amt,
        reference: ref,
      };
      const updated = [revenueAdj, cashAdj, ...adjustments];
      setAdjustments(updated);
      localStorage.setItem('accounting_adjustments', JSON.stringify(updated));
      setQirAmount(''); setQirDesc('');
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const debit = parseFloat(adjDebit) || 0;
      const credit = parseFloat(adjCredit) || 0;
      if (!adjAccount || (debit === 0 && credit === 0) || !adjDesc.trim()) return;
      const newAdj: AdjustmentEntry = {
        id: `ADJ-${Date.now()}`,
        date: adjDate,
        type: adjType,
        accountCode: adjAccount,
        description: adjDesc.trim(),
        debit,
        credit,
        reference: adjRef.trim() || `ADJ-${Date.now().toString(36).toUpperCase()}`,
      };
      const updated = [newAdj, ...adjustments];
      setAdjustments(updated);
      localStorage.setItem('accounting_adjustments', JSON.stringify(updated));
      setFormOpen(false);
      setAdjDebit(''); setAdjCredit(''); setAdjDesc(''); setAdjRef(''); setAdjAccount('');
    };

    const deleteAdj = (id: string) => {
      const updated = adjustments.filter(a => a.id !== id);
      setAdjustments(updated);
      localStorage.setItem('accounting_adjustments', JSON.stringify(updated));
    };

    const totalAdjDebit = adjustments.reduce((s, a) => s + a.debit, 0);
    const totalAdjCredit = adjustments.reduce((s, a) => s + a.credit, 0);

    return (
      <div>
        {/* ── Income Reduction (simple inline) ── */}
        <form onSubmit={handleQirSubmit} className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-rose-200 px-4 py-4 mb-6 shadow-sm">
          <div className="flex-1 min-w-36">
            <label className="text-xs font-bold text-slate-600 block mb-1">Reduce Income by (SAR)</label>
            <input type="number" min="0.01" step="0.01" value={qirAmount} onChange={e => setQirAmount(e.target.value)} required
              placeholder="0.00"
              className="w-full text-sm border border-rose-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-400 outline-none font-bold text-rose-700" />
          </div>
          <div className="flex-[2] min-w-48">
            <label className="text-xs font-bold text-slate-600 block mb-1">Reason</label>
            <input value={qirDesc} onChange={e => setQirDesc(e.target.value)} required placeholder="e.g. Refund / correction"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-400 outline-none" />
          </div>
          <button type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors whitespace-nowrap">
            <Minus size={13} /> Apply Reduction
          </button>
        </form>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-100"><SlidersHorizontal size={18} className="text-purple-600" /></span>
            <div>
              <p className="text-xl font-black text-purple-700">{adjustments.length}</p>
              <p className="text-xs font-semibold text-slate-500">Total Adjustments</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-100"><Minus size={18} className="text-rose-600" /></span>
            <div>
              <p className="text-xl font-black text-rose-700">SAR {fmt(totalAdjDebit)}</p>
              <p className="text-xs font-semibold text-slate-500">Total Debit Adjustments</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-100"><Plus size={18} className="text-emerald-600" /></span>
            <div>
              <p className="text-xl font-black text-emerald-700">SAR {fmt(totalAdjCredit)}</p>
              <p className="text-xs font-semibold text-slate-500">Total Credit Adjustments</p>
            </div>
          </div>
        </div>

        {/* Adjustment types legend */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-6">
          <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <SlidersHorizontal size={12} className="text-purple-500" /> Available Adjustment Types
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {ADJ_TYPES.map(at => (
              <div key={at.value} className="flex flex-col px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 gap-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded w-fit ${typeColorMap[at.value]}`}>{at.label}</span>
                <span className="text-[10px] text-slate-400">{at.labelAr}</span>
                <p className="text-[10px] text-slate-500 leading-tight">{at.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Header + New Adjustment button */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <BookOpen size={15} className="text-purple-600" /> Adjustment Journal
          </h4>
          <button
            onClick={() => setFormOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <PenLine size={14} />{formOpen ? 'Cancel' : '+ New Adjustment'}
          </button>
        </div>

        {/* New adjustment form */}
        {formOpen && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-5 mb-5">
            <h5 className="text-sm font-black text-purple-700 mb-4 flex items-center gap-2">
              <SlidersHorizontal size={14} /> New Adjustment Entry
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Date</label>
                <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} required
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Reference No.</label>
                <input value={adjRef} onChange={e => setAdjRef(e.target.value)} placeholder="e.g. ADJ-2026-001"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Adjustment Type</label>
                <select value={adjType} onChange={e => setAdjType(e.target.value as AdjustmentType)} required
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none bg-white">
                  {ADJ_TYPES.map(at => (
                    <option key={at.value} value={at.value}>{at.label} — {at.labelAr}</option>
                  ))}
                </select>
                <p className="text-[10px] text-purple-500 mt-1 font-medium">{ADJ_TYPES.find(at => at.value === adjType)?.desc}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Account to Adjust</label>
                <select value={adjAccount} onChange={e => setAdjAccount(e.target.value)} required
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none bg-white">
                  <option value="">— Select account —</option>
                  {CHART_OF_ACCOUNTS.map(a => (
                    <option key={a.code} value={a.code}>{a.code} — {a.name} ({a.nameAr})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Debit Amount (SAR)
                  <span className="ml-1 font-normal text-slate-400">increases expense / asset</span>
                </label>
                <input type="number" min="0" step="0.01" value={adjDebit} onChange={e => setAdjDebit(e.target.value)} placeholder="0.00"
                  className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-300 outline-none bg-rose-50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Credit Amount (SAR)
                  <span className="ml-1 font-normal text-slate-400">reduces balance / expense</span>
                </label>
                <input type="number" min="0" step="0.01" value={adjCredit} onChange={e => setAdjCredit(e.target.value)} placeholder="0.00"
                  className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-300 outline-none bg-emerald-50" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Description / Reason <span className="text-rose-400">*</span>
                </label>
                <textarea value={adjDesc} onChange={e => setAdjDesc(e.target.value)} rows={2} required
                  placeholder="Explain the reason for this adjustment..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none bg-white resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setFormOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2">
                <PenLine size={13} /> Post Adjustment
              </button>
            </div>
          </form>
        )}

        {/* Adjustments table */}
        {adjustments.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-10 border border-slate-100 text-center">
            <SlidersHorizontal size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-500">No adjustments posted yet.</p>
            <p className="text-xs text-slate-400 mt-1">Create an adjustment to correct balances, write off amounts, apply discounts, or record accruals.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-purple-100 shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-purple-600 to-purple-500 text-white">
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Reference</th>
                  <th className="px-4 py-3 text-left font-bold">Type</th>
                  <th className="px-4 py-3 text-left font-bold">Account</th>
                  <th className="px-4 py-3 text-left font-bold">Description</th>
                  <th className="px-4 py-3 text-right font-bold">Debit (SAR)</th>
                  <th className="px-4 py-3 text-right font-bold">Credit (SAR)</th>
                  <th className="px-4 py-3 text-center font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {adjustments.map(adj => {
                  const acct = CHART_OF_ACCOUNTS.find(c => c.code === adj.accountCode);
                  return (
                    <tr key={adj.id} className="hover:bg-purple-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-600">{adj.date}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{adj.reference}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${typeColorMap[adj.type]}`}>
                          {ADJ_TYPES.find(at => at.value === adj.type)?.label || adj.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700">{adj.accountCode}</p>
                        <p className="text-slate-400 text-[10px]">{acct?.name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{adj.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{adj.debit > 0 ? fmt(adj.debit) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{adj.credit > 0 ? fmt(adj.credit) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => deleteAdj(adj.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Remove adjustment">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-purple-50 font-bold border-t-2 border-purple-200">
                  <td colSpan={5} className="px-4 py-3 text-slate-700 font-black">TOTALS</td>
                  <td className="px-4 py-3 text-right text-rose-700 font-black">SAR {fmt(totalAdjDebit)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-black">SAR {fmt(totalAdjCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-3 text-center">
          ✱ Adjustments are applied to all reports (Trial Balance, Income Statement, Balance Sheet). They persist locally across sessions.
        </p>
      </div>
    );
  };

  // ─── Render tab content ────────────────────────────────────────────────
  const renderTabContent = () => {
    if (loading) return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-500 font-medium">Loading accounting data...</span>
      </div>
    );
    switch (activeTab) {
      case 'overview':          return <OverviewTab />;
      case 'chart_of_accounts': return <ChartOfAccountsTab />;
      case 'journal':           return <JournalTab />;
      case 'general_ledger':    return <GeneralLedgerTab />;
      case 'trial_balance':     return <TrialBalanceTab />;
      case 'income_statement':  return <IncomeStatementTab />;
      case 'balance_sheet':     return <BalanceSheetTab />;
      case 'cash_flow':         return <CashFlowTab />;
      case 'payables':          return <PayablesTab />;
      case 'receivables':       return <ReceivablesTab />;
      case 'aging':             return <AgingTab />;
      case 'budget':            return <BudgetTab />;
      case 'adjustments':       return <AdjustmentsTab />;
      default:                  return null;
    }
  };

  const activeTabDef = ALL_TABS.find(t => t.id === activeTab);
  const activeGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab));

  return (
    <div className="mobile-tab-shell tab-accounting max-w-7xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
          <Calculator size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight">{t('nav.accounting')}</h2>
          <p className="text-xs text-slate-400 font-medium">النظام المحاسبي — Double-entry accounting suite</p>
        </div>
        {activeTabDef && activeTabDef.id !== 'overview' && (
          <div className={`ml-auto hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${activeGroup?.bgColor} ${activeGroup?.color} text-xs font-bold`}>
            <activeTabDef.icon size={13} />
            {language === 'ar' ? activeTabDef.labelAr : activeTabDef.label}
          </div>
        )}
      </div>

      {/* Period filter bar (not on overview) */}
      {activeTab !== 'overview' && <PeriodBar />}

      {/* Breadcrumb + print (not on overview) */}
      {activeTab !== 'overview' && activeTabDef && (
        <div className="flex items-center gap-2 mb-4">
          {activeGroup && <span className={`text-xs ${activeGroup.color} font-semibold`}>{language === 'ar' ? activeGroup.labelAr : activeGroup.label}</span>}
          <ChevronRight size={11} className="text-slate-300" />
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <activeTabDef.icon size={12} className="text-slate-500" />
            {language === 'ar' ? activeTabDef.labelAr : activeTabDef.label}
          </span>
          <button onClick={print} className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors border border-slate-200">
            <Printer size={12} />{t('common.print')}</button>
        </div>
      )}

      {/* Tab content */}
      <div>{renderTabContent()}</div>
    </div>
  );
};

export default AccountingModule;


import React, { useState, useEffect, useMemo } from 'react';
import { User, Building, Transaction, TransactionType, TransactionStatus, PaymentMethod, Contract, ExpenseCategory } from '../types';
import { getUsers, getTransactions, getBuildings, getContracts, setUserScope, saveTransaction, deleteTransaction, getTransfers } from '../services/firestoreService';
import {
  Crown, Building2, TrendingUp, TrendingDown, DollarSign, Percent,
  Users, Wallet, Home, FileSignature, Sparkles, Plus, Trash2, X,
  Clock, Calendar, CreditCard, FileText, Printer, Download, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from './Toast';
import { fmtDate } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

interface OwnerPortalProps {
  currentUser?: User;
}

/* DESIGN TOKENS */
const PRIMARY = '#1e40af';

/* UI ATOMS */
const Card = ({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={`bg-white rounded-2xl overflow-hidden ${className}`}
    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', ...style }}
  >
    {children}
  </div>
);

const KpiCard = ({ label, value, sub, icon: Icon, accent, highlight }: any) => (
  <Card
    className={`p-3.5 sm:p-5 hover:shadow-lg transition-shadow duration-300 ${highlight ? 'ring-1 ring-blue-100' : ''}`}
    style={highlight ? { background: 'linear-gradient(145deg, #eff6ff, #f8fafc)' } : {}}
  >
    <div className="flex items-start justify-between mb-2 sm:mb-3">
      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[1px] sm:tracking-[1.5px] text-slate-400 leading-tight pr-1">{label}</span>
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}12` }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
    </div>
    <p className="text-base sm:text-[22px] font-black tracking-tight leading-tight" style={{ color: highlight ? PRIMARY : '#1e293b' }}>{value}</p>
    {sub && <p className="text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 font-semibold text-slate-300">{sub}</p>}
  </Card>
);

const fmt = (n: number) => {
  if (n === 0) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const OWNER_EXPENSE_CATEGORIES = [ExpenseCategory.OWNER_EXPENSE, 'Owner Profit Withdrawal'];

/* MAIN COMPONENT */
const OwnerPortal: React.FC<OwnerPortalProps> = ({ currentUser }) => {
  const [owners, setOwners] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'all' | 'year' | 'quarter' | 'month'>('year');
  const [activeSection, setActiveSection] = useState<'overview' | 'report'>('overview');
  const [expandedReportSection, setExpandedReportSection] = useState<'opening' | 'thisMonth' | null>(null);

  // Owner Opening Balance modal state
  const [showOBModal, setShowOBModal] = useState(false);
  const [obAmount, setObAmount] = useState('');
  const [obDate, setObDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [obPaymentMethod, setObPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [obDetails, setObDetails] = useState('');
  const [obSaving, setObSaving] = useState(false);
  const [deletingOBTx, setDeletingOBTx] = useState<Transaction | null>(null);

  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setUserScope({ role: 'ADMIN', buildingIds: [] });
        const [usrs, blds, txs, ctrs, trfs] = await Promise.all([
          getUsers(), getBuildings(), getTransactions(), getContracts(), getTransfers(),
        ]);
        const ownerList = (usrs || []).filter((u: User) => u.isOwner || (u as any).role === 'OWNER');
        setOwners(ownerList);
        setBuildings(blds || []);
        setTransactions(txs || []);
        setContracts(ctrs || []);
        setTransfers(trfs || []);
        if (ownerList.length > 0) {
          if (currentUser?.id) {
            const match = ownerList.find((o: User) => o.id === currentUser.id);
            setSelectedOwnerId(match ? match.id : ownerList[0].id);
          } else if (!selectedOwnerId) {
            setSelectedOwnerId(ownerList[0].id);
          }
        }
      } catch (e) { console.error('OwnerPortal load error:', e); }
      setLoading(false);
    };
    load();
  }, []);

  // Owner Opening Balance data (not tied to any building)
  const ownerOpeningBalanceData = useMemo(() => {
    const txs = transactions.filter(t =>
      ((t as any).isOwnerOpeningBalance === true ||
        (t.borrowingType === 'OPENING_BALANCE' && (t as any).ownerId)) &&
      (t as any).ownerId === selectedOwnerId &&
      !(t as any).deleted
    );
    const total = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { total, transactions: txs };
  }, [transactions, selectedOwnerId]);

  const handleAddOpeningBalance = async () => {
    if (!selectedOwnerId || !obAmount || Number(obAmount) <= 0) return;
    setObSaving(true);
    try {
      await saveTransaction({
        id: crypto.randomUUID(),
        date: obDate,
        type: TransactionType.EXPENSE,
        amount: Number(obAmount),
        paymentMethod: obPaymentMethod,
        expenseCategory: 'Owner Opening Balance',
        details: obDetails || 'Owner Opening Balance',
        isOwnerOpeningBalance: true,
        borrowingType: 'OPENING_BALANCE',
        ownerId: selectedOwnerId,
        ownerName: owners.find(o => o.id === selectedOwnerId)?.name || '',
        status: TransactionStatus.APPROVED,
        createdAt: Date.now(),
        createdBy: 'ADMIN',
        createdByName: 'Admin',
      } as any);
      const txs = await getTransactions();
      setTransactions(txs || []);
      setObAmount('');
      setObDetails('');
      setObDate(new Date().toISOString().slice(0, 10));
      setObPaymentMethod(PaymentMethod.CASH);
      setShowOBModal(false);
      showSuccess('Opening balance added successfully.');
    } catch (e) {
      showError('Failed to save opening balance.');
    }
    setObSaving(false);
  };

  const handleDeleteOpeningBalance = async (tx: Transaction) => {
    if (!window.confirm(`Delete opening balance of ${Number(tx.amount).toLocaleString()} SAR on ${fmtDate(tx.date)}?`)) return;
    try {
      await deleteTransaction(tx.id);
      const txs = await getTransactions();
      setTransactions(txs || []);
      showSuccess('Opening balance entry deleted.');
    } catch (e) {
      showError('Failed to delete opening balance.');
    }
    setDeletingOBTx(null);
  };

  const selectedOwner = useMemo(() => owners.find(o => o.id === selectedOwnerId), [owners, selectedOwnerId]);
  const sharePercent = (selectedOwner?.sharePercentage || 0) / 100;
  const isStandalone = !!currentUser;

  const filteredTransactions = useMemo(() => {
    if (!transactions.length) return [];
    const now = new Date();
    let startDate: Date | null = null;
    if (dateRange === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (dateRange === 'quarter') startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    else if (dateRange === 'year') startDate = new Date(now.getFullYear(), 0, 1);
    return transactions.filter(t => {
      if (t.borrowingType === 'OPENING_BALANCE') return false;
      if (startDate && t.date) return new Date(t.date) >= startDate;
      return true;
    });
  }, [transactions, dateRange]);

  const ownerBuildingIds: string[] = useMemo(
    () => selectedOwner?.ownerBuildingIds || (selectedOwner as any)?.buildingIds || [],
    [selectedOwner],
  );
  const ownerBuildings = useMemo(
    () => buildings.filter(b => ownerBuildingIds.includes(b.id)),
    [buildings, ownerBuildingIds],
  );

  const ownerScopedTransactions = useMemo(() => {
    return filteredTransactions.filter(t => {
      const inOwnerBuilding = ownerBuildingIds.includes(t.buildingId || '');
      const isOwnerExpense =
        t.type === TransactionType.EXPENSE &&
        OWNER_EXPENSE_CATEGORIES.includes((t.expenseCategory || '') as any) &&
        !!selectedOwnerId &&
        (t as any).ownerId === selectedOwnerId;
      return inOwnerBuilding || isOwnerExpense;
    });
  }, [filteredTransactions, ownerBuildingIds, selectedOwnerId]);

  const buildingFinancials = useMemo(() => {
    return ownerBuildings.map(building => {
      const bTxs = filteredTransactions.filter(t => t.buildingId === building.id);
      const income = bTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const expense = bTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const profit = income - expense;
      const activeContracts = contracts.filter(c => c.buildingId === building.id && c.status === 'Active');
      const totalUnits = building.units?.length || 0;
      const occupiedUnits = activeContracts.length;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
      return {
        id: building.id, name: building.name, income, expense, profit,
        ownerShare: profit * sharePercent, totalUnits, occupiedUnits, occupancyRate,
        activeContracts: activeContracts.length,
        monthlyRent: activeContracts.reduce((s, c) => s + ((c.rentValue || 0) / 12), 0),
      };
    });
  }, [ownerBuildings, filteredTransactions, contracts, sharePercent]);

  const totals = useMemo(() => {
    const totalIncome = buildingFinancials.reduce((s, b) => s + b.income, 0);
    const totalExpense = buildingFinancials.reduce((s, b) => s + b.expense, 0);
    const totalProfit = totalIncome - totalExpense;
    const ownerProfit = totalProfit * sharePercent;
    const ownerExpenseTotal = ownerScopedTransactions
      .filter(t => t.type === TransactionType.EXPENSE && OWNER_EXPENSE_CATEGORIES.includes((t.expenseCategory || '') as any) && (t as any).ownerId === selectedOwnerId)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const ownerProfitNet = ownerProfit - ownerExpenseTotal;
    const totalUnits = buildingFinancials.reduce((s, b) => s + b.totalUnits, 0);
    const occupiedUnits = buildingFinancials.reduce((s, b) => s + b.occupiedUnits, 0);
    const avgOccupancy = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    const expectedMonthlyRent = buildingFinancials.reduce((s, b) => s + b.monthlyRent, 0);
    return {
      totalIncome, totalExpense, totalProfit, ownerProfit, ownerExpenseTotal,
      ownerProfitNet, totalUnits, occupiedUnits, avgOccupancy, profitMargin, expectedMonthlyRent,
    };
  }, [buildingFinancials, sharePercent, ownerScopedTransactions, selectedOwnerId]);

  /* ── Expense Breakdown by Category ── */
  const expenseBreakdown = useMemo(() => {
    const expTxs = ownerScopedTransactions.filter(t => t.type === TransactionType.EXPENSE);
    const byCategory: Record<string, { category: string; total: number; count: number }> = {};
    expTxs.forEach(t => {
      const cat = t.expenseCategory || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, count: 0 };
      byCategory[cat].total += Number(t.amount) || 0;
      byCategory[cat].count++;
    });
    return Object.values(byCategory).sort((a, b) => b.total - a.total);
  }, [ownerScopedTransactions]);

  /* ── Last 10 Transactions ── */
  const last10Transactions = useMemo(() => {
    return [...ownerScopedTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [ownerScopedTransactions]);

  /* ── Owner Expense Report (Opening Balance + This Month) ── */
  const ownerExpenseReport = useMemo(() => {
    const _now = new Date();
    const currentMonthStart = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`;
    const _lastDay = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
    const currentMonthEnd = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_lastDay).padStart(2, '0')}`;

    // Match by ownerId, with fallback to ownerName for legacy records that lack ownerId
    const selectedOwnerName = (owners.find(o => o.id === selectedOwnerId)?.name || '').trim().toLowerCase();
    const txMatchesOwner = (t: any): boolean => {
      if (t.ownerId) return t.ownerId === selectedOwnerId;
      return !!selectedOwnerName && (t.ownerName || '').trim().toLowerCase() === selectedOwnerName;
    };

    // Owner expense transactions (excl opening balance)
    const allOwnerExpenses = transactions.filter(t =>
      (t.expenseCategory === 'Owner Expense' || t.expenseCategory === 'OWNER_EXPENSE' || t.expenseCategory === 'Owner Profit Withdrawal') &&
      !t.isOwnerOpeningBalance &&
      (t.status === TransactionStatus.APPROVED || !t.status) &&
      txMatchesOwner(t as any)
    );

    // Opening balance entries
    const openingBalanceTxs = transactions.filter(t =>
      (t.isOwnerOpeningBalance === true || t.expenseCategory === 'Owner Opening Balance') &&
      (t.status === TransactionStatus.APPROVED || !t.status) &&
      txMatchesOwner(t as any)
    );

    let openingBalance = openingBalanceTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const openingTxList = [...openingBalanceTxs];
    let thisMonthExpenses = 0;
    const thisMonthTxs: Transaction[] = [];

    allOwnerExpenses.forEach(t => {
      const txDate = t.date || '';
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        thisMonthExpenses += Number(t.amount) || 0;
        thisMonthTxs.push(t);
      } else if (txDate < currentMonthStart) {
        openingBalance += Number(t.amount) || 0;
        openingTxList.push(t);
      }
    });

    // HEAD_OFFICE -> OWNER transfers
    const ownerTransfers = transfers.filter(tr =>
      tr.fromType === 'HEAD_OFFICE' && tr.toType === 'OWNER' &&
      tr.toId === selectedOwnerId && tr.status === 'COMPLETED' && !tr.deleted
    );
    ownerTransfers.forEach(tr => {
      const pseudoTx = { id: tr.id, date: tr.date, amount: tr.amount, details: `تحويل من المكتب - ${tr.purpose || 'Head Office Transfer'}`, type: TransactionType.EXPENSE, buildingId: '' } as Transaction;
      const txDate = tr.date || '';
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        thisMonthExpenses += Number(tr.amount) || 0;
        thisMonthTxs.push(pseudoTx);
      } else {
        openingBalance += Number(tr.amount) || 0;
        openingTxList.push(pseudoTx);
      }
    });

    // OWNER -> HEAD_OFFICE returns
    const ownerReturns = transfers.filter(tr =>
      tr.fromType === 'OWNER' && tr.toType === 'HEAD_OFFICE' &&
      tr.fromId === selectedOwnerId && tr.status === 'COMPLETED' && !tr.deleted
    );
    ownerReturns.forEach(tr => {
      const pseudoTx = { id: tr.id, date: tr.date, amount: -Number(tr.amount), details: `إرجاع إلى المكتب - ${tr.purpose || 'Return to Head Office'}`, type: TransactionType.EXPENSE, buildingId: '' } as Transaction;
      const txDate = tr.date || '';
      if (txDate >= currentMonthStart && txDate <= currentMonthEnd) {
        thisMonthExpenses -= Number(tr.amount) || 0;
        thisMonthTxs.push(pseudoTx);
      } else {
        openingBalance -= Number(tr.amount) || 0;
        openingTxList.push(pseudoTx);
      }
    });

    const subtotal = openingBalance + thisMonthExpenses;
    return { openingBalance, openingTxList, thisMonthExpenses, thisMonthTxs, subtotal };
  }, [transactions, transfers, selectedOwnerId, owners]);

  /* LOADING */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-300 text-xs font-bold tracking-wider uppercase">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  /* EMPTY STATE */
  if (owners.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-8 text-center">
        <Card className="p-10">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-blue-50">
            <Crown size={36} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-black text-slate-700 mb-2">No Owners Found</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Go to <strong className="text-slate-600">Employee Management</strong> and add a staff member with the{' '}
            <strong className="text-slate-600">"Owner"</strong> role.
          </p>
        </Card>
      </div>
    );
  }

  /* MAIN RENDER */
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {/* HERO HEADER */}
      <Card style={{ background: 'linear-gradient(145deg, #eff6ff, #f8fafc)' }}>
        <div className="p-4 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(30,64,175,0.04) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center bg-blue-100/60 border border-blue-200/50 flex-shrink-0">
                  <Crown size={22} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[2px] sm:tracking-[3px] text-blue-500">Investment Portfolio</p>
                  <h1 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight truncate">
                    {isStandalone ? (selectedOwner?.name || 'Dashboard') : 'Owner Dashboard'}
                  </h1>
                </div>
              </div>

            {/* Tab selector */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex rounded-xl overflow-hidden bg-white border border-blue-200 shadow-sm">
                {([{ key: 'overview', label: t('ownerPortal.tab.overview') }, { key: 'report', label: t('ownerPortal.tab.expenseReport') }] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSection(tab.key as any)}
                    className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                      activeSection === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {!isStandalone && owners.length > 1 && (
                  <div className="relative w-full sm:w-auto">
                    <select
                      value={selectedOwnerId}
                      onChange={e => setSelectedOwnerId(e.target.value)}
                      className="appearance-none w-full sm:w-auto pl-3 sm:pl-4 pr-8 sm:pr-10 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold outline-none cursor-pointer bg-white border border-slate-200 text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-100"
                    >
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.sharePercentage || 0}%)</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm w-full sm:w-auto">
                  {(['month', 'quarter', 'year', 'all'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setDateRange(range)}
                      className={`flex-1 sm:flex-none px-2.5 sm:px-3.5 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-all duration-200 ${
                        dateRange === range ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {range === 'all' ? 'All' : range === 'quarter' ? 'Qtr' : range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedOwner && (
              <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-5 flex-wrap">
                {[
                  { icon: Percent, text: `${selectedOwner.sharePercentage || 0}% Share` },
                  { icon: Building2, text: `${ownerBuildings.length} Properties` },
                  { icon: Home, text: `${totals.totalUnits} Units` },
                  ...(selectedOwner.phone ? [{ icon: null as any, text: `${selectedOwner.phone}` }] : []),
                ].map((pill, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-semibold bg-white/80 border border-slate-100 text-slate-500">
                    {pill.icon && <pill.icon size={11} className="text-blue-400" />}
                    {pill.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {activeSection === 'overview' && (
      <>
      {/* PRIMARY KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard label={t('dashboard.totalIncome')}       value={fmt(totals.totalIncome)}    sub="SAR" icon={TrendingUp}   accent="#22c55e" />
        <KpiCard label={t('dashboard.totalExpense')}     value={fmt(totals.totalExpense)}   sub="SAR" icon={TrendingDown} accent="#ef4444" />
        <KpiCard label="Net Profit"         value={fmt(totals.totalProfit)}    sub={`${totals.profitMargin.toFixed(1)}% margin`} icon={DollarSign} accent="#3b82f6" />
        <KpiCard label="Owner Profit (Net)" value={fmt(totals.ownerProfitNet)} sub={`${selectedOwner?.sharePercentage || 0}% share minus withdrawals`} icon={Crown} accent={PRIMARY} highlight />
      </div>

      {/* SECONDARY KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { icon: Users,         label: 'Occupancy',    value: `${totals.occupiedUnits}/${totals.totalUnits}`, sub: `${totals.avgOccupancy.toFixed(0)}%`,  accent: '#a855f7' },
          { icon: Wallet,        label: 'Monthly Rent', value: fmt(totals.expectedMonthlyRent),               sub: 'Expected',                             accent: '#06b6d4' },
          { icon: Building2,     label: 'Properties',   value: String(ownerBuildings.length),                 sub: 'Assigned',                             accent: '#22c55e' },
          { icon: FileSignature, label: 'Withdrawn',    value: fmt(totals.ownerExpenseTotal),                 sub: 'Owner Expenses',                       accent: '#f97316' },
        ].map((item, i) => (
          <div key={i}>
            <Card className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.accent}10` }}>
                <item.icon size={16} style={{ color: item.accent }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-lg font-black text-slate-800 leading-none truncate">{item.value}</p>
                <p className="text-[9px] sm:text-[10px] font-semibold mt-0.5 text-slate-400 truncate">{item.label} ({item.sub})</p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* PROPERTY PERFORMANCE TABLE */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
            <Building2 size={15} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-black text-slate-700 tracking-tight">Property Performance</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                {['Property', 'Income', 'Expense', 'Net Profit', "Owner's Share", 'Occupancy', 'Contracts'].map((h, i) => (
                  <th key={h} className={`${i === 0 ? 'text-left' : i <= 4 ? 'text-right' : 'text-center'} px-5 py-3 text-[10px] font-bold uppercase tracking-wider ${i === 4 ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildingFinancials.length > 0 ? buildingFinancials.map(b => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50">
                        <Building2 size={13} className="text-emerald-500" />
                      </div>
                      <span className="font-bold text-slate-700 text-xs">{b.name}</span>
                    </div>
                  </td>
                  <td className="text-right px-5 py-4 font-mono font-bold text-emerald-600 text-xs tabular-nums">{fmt(b.income)}</td>
                  <td className="text-right px-5 py-4 font-mono font-bold text-red-500 text-xs tabular-nums">{fmt(b.expense)}</td>
                  <td className={`text-right px-5 py-4 font-mono font-bold text-xs tabular-nums ${b.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{b.profit >= 0 ? '+' : ''}{fmt(b.profit)}</td>
                  <td className="text-right px-5 py-4 font-mono font-black text-blue-700 text-xs tabular-nums bg-blue-50/30">{fmt(b.ownerShare)}</td>
                  <td className="text-center px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-14 h-1.5 rounded-full overflow-hidden bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(b.occupancyRate, 100)}%`, background: b.occupancyRate >= 80 ? '#22c55e' : b.occupancyRate >= 50 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{b.occupancyRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="text-center px-5 py-4 font-bold text-slate-500 text-xs">{b.activeContracts}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-slate-300 text-xs">No properties assigned</td></tr>
              )}
              {buildingFinancials.length > 0 && (
                <tr className="border-t-2 border-slate-100 bg-slate-50/30">
                  <td className="px-5 py-3.5 font-black text-slate-600 text-xs uppercase tracking-wider">{t('common.total')}</td>
                  <td className="text-right px-5 py-3.5 font-mono font-black text-emerald-600 text-xs">{fmt(totals.totalIncome)}</td>
                  <td className="text-right px-5 py-3.5 font-mono font-black text-red-500 text-xs">{fmt(totals.totalExpense)}</td>
                  <td className="text-right px-5 py-3.5 font-mono font-black text-blue-600 text-xs">{fmt(totals.totalProfit)}</td>
                  <td className="text-right px-5 py-3.5 font-mono font-black text-blue-700 text-xs bg-blue-50/30">{fmt(totals.ownerProfit)}</td>
                  <td className="text-center px-5 py-3.5 font-bold text-slate-500 text-xs">{totals.avgOccupancy.toFixed(0)}%</td>
                  <td className="text-center px-5 py-3.5 font-bold text-slate-500 text-xs">
                    {contracts.filter(c => ownerBuildingIds.includes(c.buildingId) && c.status === 'Active').length}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-3">
          {buildingFinancials.length > 0 ? buildingFinancials.map(b => (
            <div key={b.id} className="rounded-xl border border-slate-100 bg-slate-50/30 overflow-hidden">
              <div className="flex items-center gap-2.5 p-3 bg-white border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50">
                  <Building2 size={13} className="text-emerald-500" />
                </div>
                <span className="font-bold text-slate-700 text-sm flex-1 truncate">{b.name}</span>
                <span className="text-[9px] font-bold text-slate-400">{b.activeContracts} contracts</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">{t('entry.income')}</p><p className="font-mono font-bold text-emerald-600 text-sm">{fmt(b.income)}</p></div>
                <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">{t('entry.expense')}</p><p className="font-mono font-bold text-red-500 text-sm">{fmt(b.expense)}</p></div>
                <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Net Profit</p><p className={`font-mono font-bold text-sm ${b.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(b.profit)}</p></div>
                <div className="bg-blue-50/50 p-3"><p className="text-[9px] font-bold uppercase text-blue-500 mb-0.5">Owner Share</p><p className="font-mono font-black text-blue-700 text-sm">{fmt(b.ownerShare)}</p></div>
              </div>
              <div className="flex items-center gap-2.5 p-3 bg-white">
                <span className="text-[9px] font-bold uppercase text-slate-400">Occupancy</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.occupancyRate, 100)}%`, background: b.occupancyRate >= 80 ? '#22c55e' : b.occupancyRate >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 tabular-nums">{b.occupancyRate.toFixed(0)}%</span>
              </div>
            </div>
          )) : (
            <p className="text-center py-10 text-slate-300 text-xs">No properties assigned</p>
          )}
          {buildingFinancials.length > 0 && (
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50/30 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-2">Portfolio Total</p>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-[9px] text-slate-400 font-bold">{t('entry.income')}</p><p className="font-mono font-black text-emerald-600 text-sm">{fmt(totals.totalIncome)}</p></div>
                <div><p className="text-[9px] text-slate-400 font-bold">{t('entry.expense')}</p><p className="font-mono font-black text-red-500 text-sm">{fmt(totals.totalExpense)}</p></div>
                <div><p className="text-[9px] text-slate-400 font-bold">Net Profit</p><p className="font-mono font-black text-blue-600 text-sm">{fmt(totals.totalProfit)}</p></div>
                <div><p className="text-[9px] text-blue-500 font-bold">Owner Share</p><p className="font-mono font-black text-blue-700 text-sm">{fmt(totals.ownerProfit)}</p></div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* EXPENSE BREAKDOWN */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
            <TrendingDown size={15} className="text-red-500" />
          </div>
          <h3 className="text-sm font-black text-slate-700 tracking-tight">Expense Breakdown</h3>
        </div>
        {expenseBreakdown.length > 0 ? (
          <div className="p-4 sm:p-6">
            <div className="space-y-2.5">
              {expenseBreakdown.map((cat, i) => {
                const maxVal = expenseBreakdown[0]?.total || 1;
                const pct = (cat.total / maxVal) * 100;
                const colors = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#6366f1'];
                const color = colors[i % colors.length];
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="w-24 sm:w-32 text-[10px] sm:text-xs font-bold text-slate-600 truncate">{cat.category}</div>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="text-right min-w-[70px] sm:min-w-[90px]">
                      <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums">{fmt(cat.total)}</span>
                      <span className="text-[9px] text-slate-400 ml-1">({cat.count})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300 text-xs">No expense transactions</div>
        )}
      </Card>

      {/* LAST 10 TRANSACTIONS */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50">
            <Clock size={15} className="text-violet-500" />
          </div>
          <h3 className="text-sm font-black text-slate-700 tracking-tight">Recent Transactions</h3>
          <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last 10</span>
        </div>
        {last10Transactions.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {last10Transactions.map(tx => {
              const isIncome = tx.type === TransactionType.INCOME;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {isIncome ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                      {tx.details || tx.expenseCategory || tx.incomeCategory || (isIncome ? 'Income' : 'Expense')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">{fmtDate(tx.date)}</span>
                      {tx.buildingId && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-500 truncate max-w-[100px]">
                          {buildings.find(b => b.id === tx.buildingId)?.name || tx.buildingId}
                        </span>
                      )}
                      {tx.paymentMethod && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-400">
                          {tx.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm sm:text-base font-black tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIncome ? '+' : '-'}{fmt(Number(tx.amount) || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300 text-xs">No transactions found</div>
        )}
      </Card>

      {/* PROFIT DISTRIBUTION SUMMARY */}
      <Card style={{ background: 'linear-gradient(145deg, #eff6ff, #f8fafc)', border: '1px solid rgba(30,64,175,0.08)' }}>
        <div className="p-4 sm:p-8">
          <div className="flex items-center gap-3 sm:gap-3.5 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center bg-blue-100/60 border border-blue-200/50 flex-shrink-0">
              <Sparkles size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">Profit Distribution</h3>
              <p className="text-[9px] sm:text-[10px] font-semibold text-blue-500">Based on {selectedOwner?.sharePercentage || 0}% ownership</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            {[
              { label: 'Total Net Profit',            value: fmt(totals.totalProfit),       color: '#1e293b' },
              { label: `Owner Share (${selectedOwner?.sharePercentage || 0}%)`, value: fmt(totals.ownerProfit), color: PRIMARY },
              { label: 'Withdrawals',                  value: fmt(totals.ownerExpenseTotal), color: '#ef4444' },
              { label: 'Owner Net After Withdrawals',  value: fmt(totals.ownerProfitNet),    color: '#22c55e' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100 shadow-sm">
                <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider mb-1 sm:mb-2 text-slate-400 leading-tight">{item.label}</p>
                <p className="text-base sm:text-xl font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[9px] sm:text-[10px] mt-0.5 font-semibold text-slate-300">{t('common.sar')}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* EXPENSE BREAKDOWN */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
            <TrendingDown size={15} className="text-red-500" />
          </div>
          <h3 className="text-sm font-black text-slate-700 tracking-tight">Expense Breakdown</h3>
        </div>
        {expenseBreakdown.length > 0 ? (
          <div className="p-4 sm:p-6">
            <div className="space-y-2.5">
              {expenseBreakdown.map((cat, i) => {
                const maxVal = expenseBreakdown[0]?.total || 1;
                const pct = (cat.total / maxVal) * 100;
                const colors = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#6366f1'];
                const color = colors[i % colors.length];
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="w-24 sm:w-32 text-[10px] sm:text-xs font-bold text-slate-600 truncate">{cat.category}</div>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="text-right min-w-[70px] sm:min-w-[90px]">
                      <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums">{fmt(cat.total)}</span>
                      <span className="text-[9px] text-slate-400 ml-1">({cat.count})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300 text-xs">No expense transactions</div>
        )}
      </Card>

      {/* LAST 10 TRANSACTIONS */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50">
            <Clock size={15} className="text-violet-500" />
          </div>
          <h3 className="text-sm font-black text-slate-700 tracking-tight">Recent Transactions</h3>
          <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last 10</span>
        </div>
        {last10Transactions.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {last10Transactions.map(tx => {
              const isIncome = tx.type === TransactionType.INCOME;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {isIncome ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                      {tx.details || tx.expenseCategory || tx.incomeCategory || (isIncome ? 'Income' : 'Expense')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">{fmtDate(tx.date)}</span>
                      {tx.buildingId && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-500 truncate max-w-[100px]">
                          {buildings.find(b => b.id === tx.buildingId)?.name || tx.buildingId}
                        </span>
                      )}
                      {tx.paymentMethod && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-400">
                          {tx.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm sm:text-base font-black tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIncome ? '+' : '-'}{fmt(Number(tx.amount) || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300 text-xs">No transactions found</div>
        )}
      </Card>

      {/* OWNER OPENING BALANCE SECTION */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100">
              <Wallet size={15} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-700 tracking-tight">Owner Opening Balance</h3>
              <p className="text-[10px] text-slate-400 font-medium">Previous system balance — not tied to any building</p>
            </div>
          </div>
          {(!currentUser || (currentUser as any).role === 'ADMIN') && (
            <button
              onClick={() => setShowOBModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
            >
              <Plus size={13} /> Add Entry
            </button>
          )}
        </div>

        {ownerOpeningBalanceData.total > 0 ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center mb-4 inline-block">
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-1">Total Opening Balance</div>
              <div className="text-2xl font-black text-amber-700">{ownerOpeningBalanceData.total.toLocaleString()} <span className="text-sm font-semibold">{t('common.sar')}</span></div>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {ownerOpeningBalanceData.transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(tx => (
                  <div key={tx.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-bold text-slate-700">{Number(tx.amount).toLocaleString()} SAR</span>
                      <span className="text-xs text-slate-400 ml-2">{fmtDate(tx.date)}</span>
                      {tx.paymentMethod && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{tx.paymentMethod}</span>
                      )}
                      {tx.details && tx.details !== 'Owner Opening Balance' && (
                        <span className="text-xs text-slate-500 ml-2">{tx.details}</span>
                      )}
                    </div>
                    {(!currentUser || (currentUser as any).role === 'ADMIN') && (
                      <button
                        onClick={() => handleDeleteOpeningBalance(tx)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-slate-300 text-xs">
            No opening balance entries yet. Click "Add Entry" to record one.
          </div>
        )}
      </Card>

      {/* ADD OPENING BALANCE MODAL */}
      {showOBModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-800">Add Owner Opening Balance</h3>
              <button onClick={() => setShowOBModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">This balance is standalone — not deducted from any building or source.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">{t('common.date')}</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg p-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  value={obDate}
                  onChange={e => setObDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">{t('entry.amount')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-lg p-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  value={obAmount}
                  onChange={e => setObAmount(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">{t('entry.paymentMethod')}</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([PaymentMethod.CASH, PaymentMethod.BANK, PaymentMethod.CHEQUE] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setObPaymentMethod(m)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        obPaymentMethod === m
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {m === PaymentMethod.CASH ? 'Cash' : m === PaymentMethod.BANK ? 'Bank' : 'Cheque'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Notes (optional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg p-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  value={obDetails}
                  onChange={e => setObDetails(e.target.value)}
                  placeholder="e.g. Migrated from previous system"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowOBModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm"
              >{t('common.cancel')}</button>
              <button
                type="button"
                disabled={obSaving || !obAmount || Number(obAmount) <= 0}
                onClick={handleAddOpeningBalance}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm text-sm disabled:opacity-50"
              >
                {obSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* ══ EXPENSE REPORT TAB ══ */}
      {activeSection === 'report' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-4 sm:p-5" style={{ background: 'linear-gradient(145deg, #f5f3ff, #faf5ff)' }}>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-1">Opening Balance</p>
              <p className="text-xl sm:text-2xl font-black text-violet-700 tabular-nums">{fmt(ownerExpenseReport.openingBalance)} <span className="text-sm font-semibold">{t('common.sar')}</span></p>
              <p className="text-[9px] text-violet-400 font-medium mt-0.5">{ownerExpenseReport.openingTxList.length} entries • Till last month</p>
            </Card>
            <Card className="p-4 sm:p-5" style={{ background: 'linear-gradient(145deg, #f0fdf4, #ecfdf5)' }}>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">{t('common.thisMonth')}</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">{fmt(ownerExpenseReport.thisMonthExpenses)} <span className="text-sm font-semibold">{t('common.sar')}</span></p>
              <p className="text-[9px] text-emerald-400 font-medium mt-0.5">{ownerExpenseReport.thisMonthTxs.length} transactions</p>
            </Card>
            <Card className="p-4 sm:p-5" style={{ background: 'linear-gradient(145deg, #eff6ff, #f0f9ff)' }}>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Total Owed</p>
              <p className="text-xl sm:text-2xl font-black text-blue-700 tabular-nums">{fmt(ownerExpenseReport.subtotal)} <span className="text-sm font-semibold">{t('common.sar')}</span></p>
              <p className="text-[9px] text-blue-400 font-medium mt-0.5">Opening + This Month</p>
            </Card>
          </div>

          {/* Opening Balance Details */}
          {ownerExpenseReport.openingTxList.length > 0 && (
            <Card>
              <button
                onClick={() => setExpandedReportSection(expandedReportSection === 'opening' ? null : 'opening')}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-violet-50/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100">
                    <Wallet size={15} className="text-violet-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-black text-slate-700">Opening Balance (Till Last Month)</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{ownerExpenseReport.openingTxList.length} entries</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-violet-700 tabular-nums">{fmt(ownerExpenseReport.openingBalance)} <span className="text-xs font-semibold">{t('common.sar')}</span></span>
                  {expandedReportSection === 'opening' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>
              {expandedReportSection === 'opening' && (
                <div className="border-t border-violet-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-violet-50">
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-violet-600 uppercase">{t('common.date')}</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-violet-600 uppercase">{t('common.details')}</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-violet-600 uppercase">{t('common.amount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-violet-50">
                        {ownerExpenseReport.openingTxList
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((tx, i) => (
                          <tr key={tx.id || i} className="hover:bg-violet-50/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">{tx.details || 'Opening Balance'}</td>
                            <td className={`px-4 py-2.5 text-xs text-right font-bold tabular-nums ${Number(tx.amount) < 0 ? 'text-red-600' : 'text-violet-700'}`}>{fmt(Math.abs(Number(tx.amount) || 0))} SAR</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-violet-100">
                          <td colSpan={2} className="px-4 py-3 text-xs font-black text-violet-800">Subtotal (Opening Balance)</td>
                          <td className="px-4 py-3 text-xs text-right font-black text-violet-800 tabular-nums">{fmt(ownerExpenseReport.openingBalance)} SAR</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* This Month Details */}
          {ownerExpenseReport.thisMonthTxs.length > 0 && (
            <Card>
              <button
                onClick={() => setExpandedReportSection(expandedReportSection === 'thisMonth' ? null : 'thisMonth')}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-emerald-50/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100">
                    <Calendar size={15} className="text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-black text-slate-700">This Month's Expenses</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{ownerExpenseReport.thisMonthTxs.length} transactions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-emerald-700 tabular-nums">{fmt(ownerExpenseReport.thisMonthExpenses)} <span className="text-xs font-semibold">{t('common.sar')}</span></span>
                  {expandedReportSection === 'thisMonth' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>
              {expandedReportSection === 'thisMonth' && (
                <div className="border-t border-emerald-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-emerald-50">
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-emerald-600 uppercase">{t('common.date')}</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-emerald-600 uppercase">{t('common.details')}</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-600 uppercase">{t('common.amount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {ownerExpenseReport.thisMonthTxs
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((tx, i) => (
                          <tr key={tx.id || i} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-slate-600">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">{tx.details || 'Owner Expense'}</td>
                            <td className={`px-4 py-2.5 text-xs text-right font-bold tabular-nums ${Number(tx.amount) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(Math.abs(Number(tx.amount) || 0))} SAR</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-100">
                          <td colSpan={2} className="px-4 py-3 text-xs font-black text-emerald-800">Subtotal (This Month)</td>
                          <td className="px-4 py-3 text-xs text-right font-black text-emerald-800 tabular-nums">{fmt(ownerExpenseReport.thisMonthExpenses)} SAR</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Grand Total */}
          <Card style={{ background: 'linear-gradient(145deg, #1e293b, #334155)' }}>
            <div className="p-5 sm:p-6 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Grand Total Owed</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Opening Balance + This Month</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{fmt(ownerExpenseReport.subtotal)} <span className="text-sm font-semibold text-slate-400">{t('common.sar')}</span></p>
            </div>
          </Card>

          {ownerExpenseReport.openingTxList.length === 0 && ownerExpenseReport.thisMonthTxs.length === 0 && (
            <Card className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-slate-50">
                <FileText size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm font-bold">No owner expense data found</p>
              <p className="text-slate-300 text-xs mt-1">Add owner expenses or opening balances to see the report</p>
            </Card>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center pb-4">
        <p className="text-[9px] font-bold uppercase tracking-[4px] text-slate-200">AMLAK PREMIUM &bull; OWNER PORTAL</p>
      </div>
    </div>
  );
};

export default OwnerPortal;

import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Transaction, TransactionType, TransactionStatus, ExpenseCategory, Building } from '../types';
import { getUsers, getBuildings, getTransactions } from '../services/firestoreService';
import { Users, Search, ChevronRight, DollarSign, ArrowDownCircle, ArrowUpCircle, Calendar, Briefcase, Building2, Phone, Mail, CreditCard, ChevronLeft, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import SoundService from '../services/soundService';
import { fmtDate } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

interface StaffPortfolioProps {
  currentUser: User;
}

const StaffPortfolio: React.FC<StaffPortfolioProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userBuildingIds = (currentUser as any).buildingIds?.length > 0
        ? (currentUser as any).buildingIds
        : (currentUser.buildingId ? [currentUser.buildingId] : []);

      const [usrs, blds, txs] = await Promise.all([
        getUsers(),
        getBuildings(),
        getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds })
      ]);

      let staffList = (usrs || []).filter((u: any) => u.status !== 'Inactive' && !(u as any).deleted);

      // Non-admin: only show staff assigned to same buildings
      if (!isAdmin && userBuildingIds.length > 0) {
        staffList = staffList.filter((u: any) => {
          const empBuildings = u.buildingIds?.length > 0 ? u.buildingIds : (u.buildingId ? [u.buildingId] : []);
          return empBuildings.some((bid: string) => userBuildingIds.includes(bid));
        });
      }

      setEmployees(staffList);
      setBuildings(blds || []);
      setAllTransactions(txs || []);
    } catch (err) {
      console.error('Failed to load staff data:', err);
    }
    setLoading(false);
  };

  const filteredStaff = useMemo(() => {
    let list = employees;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.name?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.id?.toLowerCase().includes(q));
    }
    if (filterBuilding) {
      list = list.filter(e => {
        const empBuildings = e.buildingIds?.length ? e.buildingIds : (e.buildingId ? [e.buildingId] : []);
        return empBuildings.includes(filterBuilding);
      });
    }
    return list;
  }, [employees, searchQuery, filterBuilding]);

  const getStaffStats = (emp: User) => {
    const salaryTxs = allTransactions.filter(t =>
      t.type === TransactionType.EXPENSE &&
      (t.expenseCategory === ExpenseCategory.SALARY || t.expenseCategory === 'Salary') &&
      t.employeeId === emp.id &&
      t.status !== TransactionStatus.REJECTED
    );

    const borrowTxs = allTransactions.filter(t =>
      (t.type === TransactionType.EXPENSE || (t.type === TransactionType.INCOME && t.borrowingType === 'REPAYMENT')) &&
      (t.expenseCategory === ExpenseCategory.BORROWING || t.expenseCategory === 'Borrowing') &&
      t.employeeId === emp.id &&
      t.status !== TransactionStatus.REJECTED
    );

    const totalBorrowed = borrowTxs.filter(t => t.borrowingType !== 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
    const totalRepaid = borrowTxs.filter(t => t.borrowingType === 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
    const outstanding = totalBorrowed - totalRepaid;

    const totalSalaryPaid = salaryTxs.reduce((s, t) => s + t.amount, 0);
    const lastSalary = salaryTxs.length > 0 ? salaryTxs.sort((a, b) => b.createdAt - a.createdAt)[0] : null;

    return { salaryTxs, borrowTxs, totalBorrowed, totalRepaid, outstanding, totalSalaryPaid, lastSalary };
  };

  const getStaffTransactions = (emp: User) => {
    return allTransactions
      .filter(t => t.employeeId === emp.id && t.status !== TransactionStatus.REJECTED)
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || id;

  const handlePaySalary = (emp: User) => {
    SoundService.play('nav');
    navigate('/entry', {
      state: {
        prefillCategory: 'Salary',
        prefillEmployee: emp.id
      }
    });
  };

  const handleAddBorrowing = (emp: User) => {
    SoundService.play('nav');
    navigate('/entry', {
      state: {
        prefillCategory: 'Borrowing',
        prefillEmployee: emp.id
      }
    });
  };

  const handleRecordRepayment = (emp: User) => {
    SoundService.play('nav');
    navigate('/borrowings', {
      state: { highlightEmployee: emp.id }
    });
  };

  // --- DETAIL VIEW ---
  if (selectedStaff) {
    const stats = getStaffStats(selectedStaff);
    const transactions = getStaffTransactions(selectedStaff);
    const empBuildings = selectedStaff.buildingIds?.length
      ? selectedStaff.buildingIds
      : (selectedStaff.buildingId ? [selectedStaff.buildingId] : []);

    return (
      <div className="max-w-4xl mx-auto animate-fade-in pb-20">
        {/* Back Button */}
        <button
          onClick={() => setSelectedStaff(null)}
          className="flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900 mb-6 group"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Staff List
        </button>

        {/* Profile Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-emerald-50 rounded-2xl p-5 sm:p-6 mb-4 shadow-md border border-slate-100">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-100 rounded-full translate-y-1/3 -translate-x-1/4"></div>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl font-black text-emerald-700 shadow-md border border-emerald-200">
              {selectedStaff.name?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-800 mb-1">{selectedStaff.name}</h2>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 text-sm">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs uppercase tracking-wider border border-emerald-200">
                  {selectedStaff.role}
                </span>
                <span className="flex items-center gap-1"><Calendar size={13} /> Joined: {selectedStaff.joinedDate ? fmtDate(selectedStaff.joinedDate) : 'N/A'}</span>
              </div>
              {empBuildings.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {empBuildings.map((bid: string) => (
                    <span key={bid} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1 border border-emerald-200">
                      <Building2 size={11} /> {getBuildingName(bid)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 font-bold uppercase mb-1">Base Salary</div>
              <div className="text-3xl font-black text-slate-800">{(selectedStaff.baseSalary || 0).toLocaleString()}</div>
              <div className="text-xs text-slate-500">SAR / month</div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-emerald-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign size={16} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Salary Paid</span>
            </div>
            <div className="text-xl font-black text-emerald-700">{stats.totalSalaryPaid.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">{stats.salaryTxs.length} payments</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-rose-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <ArrowDownCircle size={16} className="text-rose-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('entry.totalBorrowed')}</span>
            </div>
            <div className="text-xl font-black text-rose-600">{stats.totalBorrowed.toLocaleString()}</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <ArrowUpCircle size={16} className="text-blue-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('entry.totalRepaid')}</span>
            </div>
            <div className="text-xl font-black text-blue-600">{stats.totalRepaid.toLocaleString()}</div>
          </div>

          <div className={`bg-white rounded-2xl p-5 shadow-lg border hover:shadow-xl transition-shadow ${stats.outstanding > 0 ? 'border-amber-200' : 'border-emerald-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.outstanding > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                <AlertCircle size={16} className={stats.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('borrowing.outstanding')}</span>
            </div>
            <div className={`text-xl font-black ${stats.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.outstanding.toLocaleString()}</div>
            {stats.outstanding > 0 && stats.totalBorrowed > 0 && (
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (stats.totalRepaid / stats.totalBorrowed) * 100)}%` }}></div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => handlePaySalary(selectedStaff)}
            className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2 text-sm"
          >
            <DollarSign size={16} /> Pay Salary
          </button>
          <button
            onClick={() => handleAddBorrowing(selectedStaff)}
            className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-rose-600 hover:to-rose-700 transition-all flex items-center gap-2 text-sm"
          >
            <ArrowDownCircle size={16} /> Record Borrowing
          </button>
          {stats.outstanding > 0 && (
            <button
              onClick={() => handleRecordRepayment(selectedStaff)}
              className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2 text-sm"
            >
              <ArrowUpCircle size={16} /> Record Repayment
            </button>
          )}
        </div>

        {/* Contact & Iqama Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {(selectedStaff.email || selectedStaff.iqamaNo) && (
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Contact & ID Info</h4>
              {selectedStaff.email && (
                <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                  <Mail size={14} className="text-slate-400" />
                  <span>{selectedStaff.email}</span>
                </div>
              )}
              {selectedStaff.iqamaNo && (
                <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                  <CreditCard size={14} className="text-slate-400" />
                  <span>Iqama: {selectedStaff.iqamaNo}</span>
                </div>
              )}
              {selectedStaff.iqamaExpiry && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Clock size={14} className="text-slate-400" />
                  <span>Expiry: {fmtDate(selectedStaff.iqamaExpiry)}</span>
                  {(() => {
                    const days = Math.ceil((new Date(selectedStaff.iqamaExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (days <= 0) return <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">EXPIRED</span>;
                    if (days <= 30) return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{days}d left</span>;
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}

          {stats.lastSalary && (
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Last Salary Payment</h4>
              <div className="text-sm text-slate-700 space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Amount:</span> <span className="font-bold">{stats.lastSalary.amount.toLocaleString()} SAR</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Period:</span> <span className="font-bold">{stats.lastSalary.salaryPeriod || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date:</span> <span className="font-bold">{fmtDate(stats.lastSalary.date)}</span></div>
                {(stats.lastSalary.bonusAmount || 0) > 0 && (
                  <div className="flex justify-between"><span className="text-emerald-600">Bonus:</span> <span className="font-bold text-emerald-600">+{stats.lastSalary.bonusAmount?.toLocaleString()}</span></div>
                )}
                {(stats.lastSalary.deductionAmount || 0) > 0 && (
                  <div className="flex justify-between"><span className="text-rose-600">Deduction:</span> <span className="font-bold text-rose-600">-{stats.lastSalary.deductionAmount?.toLocaleString()}</span></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* All Transactions Table */}
        <div className="premium-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />{t('history.allTransactions')}</h4>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{transactions.length} records</span>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No transactions found for this staff member.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">{t('common.date')}</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">{t('history.type')}</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">{t('common.details')}</th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Amount (Staff View)</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(tx => {
                    let typeLabel = tx.expenseCategory || 'Transaction';
                    let typeColor = 'text-slate-600';
                    let bgColor = '';
                    // Employee POV: salary & borrowing = received (+), repayment = paid back (-)
                    let amtSign = '';
                    let amtColor = 'text-slate-800';

                    if (tx.expenseCategory === 'Salary' || tx.expenseCategory === ExpenseCategory.SALARY) {
                      typeLabel = `Salary ${tx.salaryPeriod ? `(${tx.salaryPeriod})` : ''}`;
                      typeColor = 'text-emerald-700';
                      bgColor = 'bg-emerald-50/30';
                      amtSign = '+';
                      amtColor = 'text-emerald-700';
                    } else if (tx.expenseCategory === 'Borrowing' || tx.expenseCategory === ExpenseCategory.BORROWING) {
                      if (tx.borrowingType === 'REPAYMENT') {
                        typeLabel = 'Repayment (Expense)';
                        typeColor = 'text-rose-600';
                        bgColor = 'bg-rose-50/30';
                        amtSign = '\u2212';
                        amtColor = 'text-rose-600';
                      } else {
                        typeLabel = 'Borrowing (Received)';
                        typeColor = 'text-amber-700';
                        bgColor = 'bg-amber-50/30';
                        amtSign = '+';
                        amtColor = 'text-amber-700';
                      }
                    }

                    return (
                      <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${bgColor}`}>
                        <td className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{fmtDate(tx.date)}</td>
                        <td className={`px-4 py-3 font-bold ${typeColor} whitespace-nowrap`}>{typeLabel}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{tx.details || '-'}</td>
                        <td className={`px-4 py-3 text-right font-black whitespace-nowrap ${amtColor}`}>{amtSign}{tx.amount.toLocaleString()} <span className="text-[10px] text-slate-400">{t('common.sar')}</span></td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            tx.status === TransactionStatus.APPROVED ? 'bg-emerald-50 text-emerald-600' :
                            tx.status === TransactionStatus.PENDING ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-50 text-slate-500'
                          }`}>{tx.status || 'N/A'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Users size={20} className="text-white" />
            </div>{t('nav.staffPortfolio')}</h2>
          <p className="text-sm text-slate-500 mt-1">View and manage all staff members, salaries, and borrowings</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold">{filteredStaff.length} Staff Members</span>
        </div>
      </div>

      {/* Filters */}
      <div className="premium-card p-3 sm:p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search staff by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>
        <select
          value={filterBuilding}
          onChange={e => setFilterBuilding(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">{t('history.allBuildings')}</option>
          {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-400 font-bold">No staff members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map(emp => {
            const stats = getStaffStats(emp);
            const empBuildings = emp.buildingIds?.length ? emp.buildingIds : (emp.buildingId ? [emp.buildingId] : []);

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedStaff(emp)}
                className="premium-card premium-card-interactive p-4 cursor-pointer group relative overflow-hidden"
              >
                {/* Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                    {emp.name?.charAt(0)?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{emp.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 uppercase tracking-wider">
                        {emp.role}
                      </span>
                      {empBuildings.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                          <Building2 size={10} /> {empBuildings.length} bldg{empBuildings.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                </div>

                {/* Mini Stats */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Salary</div>
                    <div className="text-sm font-black text-slate-700">{(emp.baseSalary || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Borrowed</div>
                    <div className={`text-sm font-black ${stats.totalBorrowed > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stats.totalBorrowed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">{t('borrowing.outstanding')}</div>
                    <div className={`text-sm font-black ${stats.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.outstanding.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffPortfolio;

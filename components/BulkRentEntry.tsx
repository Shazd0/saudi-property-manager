import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from './SearchableSelect';
import { Transaction, TransactionType, TransactionStatus, PaymentMethod, Building, Contract, Customer, User, UserRole } from '../types';
import { getBuildings, getContracts, getTransactions, getCustomers, saveTransaction, getBanks } from '../services/firestoreService';
import { useLanguage } from '../i18n';
import { useToast } from './Toast';
import { formatCustomerFromMap, buildCustomerRoomMap } from '../utils/customerDisplay';
import { useNavigate } from 'react-router-dom';
import SoundService from '../services/soundService';
import {
  Building2, CheckCircle, XCircle, DollarSign, Users, Layers,
  ChevronDown, Save, AlertTriangle, AlertCircle, Home, CreditCard, Banknote,
  Calendar, RefreshCw, Eye, EyeOff, CheckSquare, Square, Wallet
} from 'lucide-react';

interface BulkRentEntryProps {
  currentUser: User;
}

interface UnitRow {
  unitName: string;
  contractId: string;
  customerId: string;
  customerName: string;
  installmentAmount: number;   // Expected installment
  enteredAmount: number;       // Editable amount to collect
  totalPaid: number;           // Already paid against this contract
  totalContract: number;       // Total contract value
  balance: number;             // Remaining balance
  selected: boolean;           // Checked for bulk entry
  hasContract: boolean;        // Whether this unit has an active contract
  date: string;                // Per-row date
  paymentMethod: PaymentMethod; // Per-row payment method
  bankName: string;            // Per-row bank name
}

const BulkRentEntry: React.FC<BulkRentEntryProps> = ({ currentUser }) => {
  const { t, isRTL, language } = useLanguage();
  const { showSuccess, showError, showWarning } = useToast();
  const navigate = useNavigate();

  // Data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanksList] = useState<any[]>([]);

  // Selections
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const defaultDate = new Date().toISOString().split('T')[0];

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [results, setResults] = useState<{ unit: string; customer: string; success: boolean; error?: string }[]>([]);

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
  const status = isAdmin ? TransactionStatus.APPROVED : TransactionStatus.PENDING;

  const fmt = (n: number) => new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [blds, cons, txs, custs, bnks] = await Promise.all([
          getBuildings(), getContracts(), getTransactions(), getCustomers(), getBanks()
        ]);
        setBuildings(blds as Building[]);
        setContracts(cons as Contract[]);
        setTransactions(txs as Transaction[]);
        setCustomers(custs as Customer[]);
        setBanksList(bnks as any[]);
      } catch (e) { console.error('BulkRentEntry load error:', e); }
      setLoading(false);
    };
    load();
  }, []);

  // When building is selected, build unit rows  
  useEffect(() => {
    if (!selectedBuilding) { setUnitRows([]); return; }
    const bld = buildings.find(b => b.id === selectedBuilding);
    if (!bld || !bld.units) { setUnitRows([]); return; }

    const activeContracts = contracts.filter(c => c.buildingId === selectedBuilding && c.status === 'Active');
    const customerRoomMap = buildCustomerRoomMap(customers);

    // Only build rows for units with active contracts AND outstanding balance
    const rows: UnitRow[] = [];
    for (const unit of bld.units) {
      const contract = activeContracts.find(c => c.unitName === unit.name || (c.unitName && c.unitName.split(', ').includes(unit.name)));
      if (!contract) continue; // Skip vacant units

      // Calculate paid so far for this contract
      const contractPayments = transactions.filter(
        tx => tx.contractId === contract.id &&
          tx.type === TransactionType.INCOME &&
          (tx.status === TransactionStatus.APPROVED || !tx.status)
      );
      const totalPaid = contractPayments.reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
      const totalContract = Number(contract.totalValue) || 0;
      const balance = totalContract - totalPaid;

      if (balance <= 0) continue; // Skip fully paid units

      // Determine installment amount
      const installmentAmount = Number(contract.otherInstallment) || Number(contract.firstInstallment) || 
        (contract.installmentCount > 0 ? totalContract / contract.installmentCount : 0);

      rows.push({
        unitName: unit.name,
        contractId: contract.id,
        customerId: contract.customerId,
        customerName: formatCustomerFromMap(contract.customerName, contract.customerId, customerRoomMap),
        installmentAmount,
        enteredAmount: Math.min(installmentAmount, Math.max(balance, 0)),
        totalPaid,
        totalContract,
        balance,
        selected: true,
        hasContract: true,
        date: defaultDate,
        paymentMethod: PaymentMethod.BANK,
        bankName: '',
      });
    }

    setUnitRows(rows);
    setSubmitted(false);
    setResults([]);
  }, [selectedBuilding, buildings, contracts, transactions]);

  // Computed
  const selectedRows = useMemo(() => unitRows.filter(r => r.selected), [unitRows]);
  const totalToCollect = useMemo(() => selectedRows.reduce((s, r) => s + r.enteredAmount, 0), [selectedRows]);
  const totalOutstanding = useMemo(() => unitRows.reduce((s, r) => s + r.balance, 0), [unitRows]);

  const toggleRow = (idx: number) => {
    setUnitRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = unitRows.every(r => r.selected);
    setUnitRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const updateAmount = (idx: number, val: string) => {
    const num = parseFloat(val) || 0;
    setUnitRows(prev => prev.map((r, i) => i === idx ? { ...r, enteredAmount: num } : r));
  };

  const updateRowField = (idx: number, field: keyof UnitRow, val: any) => {
    setUnitRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  // Bulk set all rows to same date/payment
  const setAllDates = (d: string) => setUnitRows(prev => prev.map(r => ({ ...r, date: d })));
  const setAllPayment = (pm: PaymentMethod) => setUnitRows(prev => prev.map(r => ({ ...r, paymentMethod: pm, bankName: pm !== PaymentMethod.BANK ? '' : r.bankName })));
  const setAllBank = (bn: string) => setUnitRows(prev => prev.map(r => ({ ...r, bankName: bn })));

  // Submit all selected entries
  const handleSubmit = async () => {
    if (selectedRows.length === 0) {
      showError('No units selected for rent entry');
      return;
    }

    // Validate amounts
    for (const row of selectedRows) {
      if (row.enteredAmount <= 0) {
        showError(`Amount for ${row.unitName} must be greater than 0`);
        return;
      }
    }

    setSubmitting(true);
    const bld = buildings.find(b => b.id === selectedBuilding);
    const newResults: { unit: string; customer: string; success: boolean; error?: string }[] = [];

    for (const row of selectedRows) {
      try {
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          date: row.date,
          type: TransactionType.INCOME,
          amount: row.enteredAmount,
          paymentMethod: row.paymentMethod,
          bankName: row.paymentMethod === PaymentMethod.BANK ? row.bankName : undefined,
          buildingId: selectedBuilding,
          buildingName: bld?.name,
          unitNumber: row.unitName,
          contractId: row.contractId,
          incomeSubType: 'RENTAL',
          expectedAmount: row.installmentAmount > 0 ? Math.min(row.installmentAmount, row.balance) : undefined,
          details: `Rent collection - ${row.customerName} - ${row.unitName}`,
          createdAt: Date.now(),
          createdBy: currentUser.id,
          createdByName: currentUser.name,
          status,
        };

        await saveTransaction(newTx);
        newResults.push({ unit: row.unitName, customer: row.customerName, success: true });
      } catch (e: any) {
        newResults.push({ unit: row.unitName, customer: row.customerName, success: false, error: e.message || 'Failed' });
      }
    }

    const successCount = newResults.filter(r => r.success).length;
    const failCount = newResults.filter(r => !r.success).length;

    setResults(newResults);
    setSubmitted(true);
    setSubmitting(false);
    SoundService.play('success');

    if (failCount === 0) {
      showSuccess(`${successCount} rent entries saved successfully!`);
    } else {
      showWarning(`${successCount} saved, ${failCount} failed`);
    }
  };

  // Loading
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-emerald-700 font-semibold animate-pulse">{t('bulk.loading')}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
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
                <Layers size={28} className="text-emerald-300" />
                {t('bulk.title')}
              </h1>
              <p className="text-emerald-200 text-sm mt-1">{t('bulk.subtitle')}</p>
            </div>
            <button onClick={() => navigate('/entry')} className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl transition-all backdrop-blur-sm text-sm font-semibold">
              <DollarSign size={16} /> {t('bulk.singleEntry')}
            </button>
          </div>
        </div>
      </div>

      {/* ══ Building Select + Bulk Defaults ══ */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Building Select */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
              <Building2 size={13} className="inline mr-1 -mt-0.5" />{t('entry.building')}</label>
            <SearchableSelect
              options={[{ value: '', label: t('entry.selectBuilding') }, ...buildings.map(b => ({ value: b.id, label: b.name }))]}
              value={selectedBuilding}
              onChange={setSelectedBuilding}
              placeholder={t('entry.selectBuilding')}
              className="mb-1"
            />
          </div>

          {/* Set All Date */}
          {unitRows.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                <Calendar size={13} className="inline mr-1 -mt-0.5" /> {t('bulk.setAllDates')}
              </label>
              <input
                type="date"
                defaultValue={defaultDate}
                onChange={e => setAllDates(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                lang={language === 'ar' ? 'ar-SA' : undefined}
              />
            </div>
          )}

          {/* Set All Payment */}
          {unitRows.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                <CreditCard size={13} className="inline mr-1 -mt-0.5" /> {t('bulk.setAllPayment')}
              </label>
              <SearchableSelect
                options={[
                  { value: PaymentMethod.CASH, label: t('entry.cashShort') },
                  { value: PaymentMethod.BANK, label: t('entry.bankTransfer') },
                  { value: PaymentMethod.CHEQUE, label: t('entry.chequeShort') },
                ]}
                value={PaymentMethod.BANK}
                onChange={v => setAllPayment(v as PaymentMethod)}
                placeholder={t('entry.bankTransfer')}
                className="mb-1"
              />
            </div>
          )}

          {/* Set All Bank */}
          {unitRows.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                <Banknote size={13} className="inline mr-1 -mt-0.5" /> {t('bulk.setAllBank')}
              </label>
              <SearchableSelect
                options={[{ value: '', label: t('bulk.selectBank') }, ...banks.map((b: any, i: number) => ({ value: b.name, label: b.name }))]}
                value={''}
                onChange={setAllBank}
                placeholder={t('bulk.selectBank')}
                className="mb-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* ══ Building Summary Strip ══ */}
      {selectedBuilding && unitRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('bulk.rentDue'), value: unitRows.length, icon: <Home size={18} />, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: t('bulk.outstanding'), value: `SAR ${fmt(totalOutstanding)}`, icon: <AlertTriangle size={18} />, color: 'bg-red-50 text-red-700 border-red-100' },
            { label: t('bulk.selected'), value: selectedRows.length, icon: <CheckSquare size={18} />, color: 'bg-violet-50 text-violet-700 border-violet-100' },
            { label: t('bulk.toCollect'), value: `SAR ${fmt(totalToCollect)}`, icon: <Wallet size={18} />, color: 'bg-teal-50 text-teal-700 border-teal-100' },
          ].map((s, i) => (
            <div key={i} className={`${s.color} border rounded-xl p-3 sm:p-4 flex items-center gap-3`}>
              <div className="p-2 rounded-lg bg-white/70">{s.icon}</div>
              <div>
                <p className="text-lg font-black leading-none">{s.value}</p>
                <p className="text-[11px] font-semibold mt-0.5 opacity-70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Units Table ══ */}
      {selectedBuilding && unitRows.length > 0 && !submitted && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-emerald-600" />
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                {buildings.find(b => b.id === selectedBuilding)?.name} — {t('bulk.rentDueCount')} ({unitRows.length})
              </h3>
            </div>
            <button onClick={toggleAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all">
              {unitRows.every(r => r.selected)
                ? <><XCircle size={14} /> {t('bulk.deselectAll')}</>
                : <><CheckSquare size={14} /> {t('bulk.selectAll')}</>
              }
            </button>
          </div>

          {/* Card-based rows (each unit is a card with its own controls) */}
          <div className="divide-y divide-gray-100">
            {unitRows.map((row, idx) => (
              <div key={idx} className={`p-4 sm:p-5 transition-all ${
                row.selected ? 'bg-emerald-50/40' : 'bg-white hover:bg-gray-50/50'
              }`}>
                {/* Top row: checkbox + unit info + balance */}
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button onClick={() => toggleRow(idx)}
                    className={`mt-1 w-5 h-5 rounded shrink-0 flex items-center justify-center transition-all ${
                      row.selected ? 'bg-emerald-600 text-white' : 'border-2 border-gray-300 hover:border-emerald-400'
                    }`}>
                    {row.selected && <CheckCircle size={14} />}
                  </button>

                  {/* Unit + Tenant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Home size={13} />
                      </div>
                      <span className="font-bold text-gray-800 text-sm">{row.unitName}</span>
                      <span className="text-gray-400 text-xs">•</span>
                      <span className="text-gray-600 text-sm truncate">{row.customerName}</span>
                    </div>
                    {/* Financial info strip */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1">
                      <span className="text-gray-500">{t('bulk.installment')} <span className="font-semibold text-gray-700">{fmt(row.installmentAmount)}</span></span>
                      <span className="text-gray-500">{t('bulk.paid')} <span className="font-semibold text-emerald-600">{fmt(row.totalPaid)}</span></span>
                      <span className="text-gray-500">{t('bulk.balance')} <span className="font-bold text-red-600">{fmt(row.balance)}</span></span>
                    </div>
                  </div>
                </div>

                {/* Bottom row: date, payment, bank, amount — per unit */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 ${isRTL ? 'mr-8' : 'ml-8'}">
                  {/* Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">{t('common.date')}</label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={e => updateRowField(idx, 'date', e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                        row.selected ? 'border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                      lang={language === 'ar' ? 'ar-SA' : undefined}
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">{t('history.payment')}</label>
                    <SearchableSelect
                      options={[
                        { value: PaymentMethod.CASH, label: t('entry.cashShort') },
                        { value: PaymentMethod.BANK, label: t('history.bank') },
                        { value: PaymentMethod.CHEQUE, label: t('entry.chequeShort') },
                      ]}
                      value={row.paymentMethod}
                      onChange={v => updateRowField(idx, 'paymentMethod', v as PaymentMethod)}
                      placeholder={t('history.bank')}
                      className={`mb-1 ${row.selected ? 'border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    />
                  </div>

                  {/* Bank (shown only if Bank selected) */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">{t('history.bank')}</label>
                    {row.paymentMethod === PaymentMethod.BANK ? (
                      <SearchableSelect
                        options={[{ value: '', label: t('entry.select') }, ...banks.map((b: any, i: number) => ({ value: b.name, label: b.name }))]}
                        value={row.bankName}
                        onChange={v => updateRowField(idx, 'bankName', v)}
                        placeholder={t('entry.select')}
                        className={`mb-1 ${row.selected ? 'border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-400' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                      />
                    ) : (
                      <div className="border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-gray-300 bg-gray-50">N/A</div>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">{t('common.amount')}</label>
                    <input
                      type="number"
                      value={row.enteredAmount || ''}
                      onChange={e => updateAmount(idx, e.target.value)}
                      min={0}
                      step={0.01}
                      className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-center transition-all ${
                        row.selected
                          ? row.enteredAmount < row.installmentAmount
                            ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-2 focus:ring-amber-400'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-800 focus:ring-2 focus:ring-emerald-500'
                          : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                    />
                    {row.selected && row.enteredAmount > 0 && row.enteredAmount < row.installmentAmount && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                        <AlertCircle size={10} className="shrink-0" />
                        <span>{t('bulk.remaining')} {fmt(row.installmentAmount - row.enteredAmount)}</span>
                      </div>
                    )}
                    {row.selected && row.enteredAmount >= row.installmentAmount && row.enteredAmount > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                        <CheckCircle size={10} className="shrink-0" />
                        <span>{t('bulk.fullInstallment')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer / Submit */}
          <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Summary */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-500 font-medium">{t('bulk.selectedUnits')} </span>
                  <span className="font-bold text-emerald-700">{selectedRows.length} {t('bulk.units')}</span>
                </div>
                <div className="h-4 w-px bg-emerald-200" />
                <div>
                  <span className="text-gray-500 font-medium">{t('history.totalShort')}</span>
                  <span className="font-black text-emerald-800 text-base">SAR {fmt(totalToCollect)}</span>
                </div>
                <div className="h-4 w-px bg-emerald-200" />
                <div>
                  <span className="text-gray-500 font-medium">{t('bulk.oustandingLabel')} </span>
                  <span className="font-bold text-red-600">SAR {fmt(totalOutstanding)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={selectedRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Eye size={16} /> {t('bulk.preview')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selectedRows.length === 0 || submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><RefreshCw size={16} className="animate-spin" /> {t('bulk.processing')}</>
                  ) : (
                    <><Save size={16} /> {t('bulk.collectRents')} {selectedRows.length} {t('bulk.rents')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ No Building Selected ══ */}
      {!selectedBuilding && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-12 text-center">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-600 mb-1">{t('bulk.selectBuildingTitle')}</h3>
          <p className="text-sm text-gray-400">{t('bulk.selectBuildingDesc')}</p>
        </div>
      )}

      {/* ══ No Rent Due ══ */}
      {selectedBuilding && unitRows.length === 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-bold text-emerald-700 mb-1">{t('bulk.allCaughtUp')}</h3>
          <p className="text-sm text-gray-400">{t('bulk.noRentDue')}</p>
        </div>
      )}

      {/* ══ Preview Modal ══ */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Eye size={18} className="text-emerald-600" /> {t('bulk.preview')} — {selectedRows.length} {t('bulk.units')}
              </h3>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              {selectedRows.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800">{r.unitName}</p>
                    <p className="text-xs text-gray-500">{r.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">SAR {fmt(r.enteredAmount)}</p>
                    <p className="text-xs text-gray-400">{r.date} • {r.paymentMethod}{r.bankName ? ` • ${r.bankName}` : ''}</p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 mt-3 flex justify-between font-bold text-base">
                <span>{t('common.total')}</span>
                <span className="text-emerald-700">SAR {fmt(totalToCollect)}</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">{t('common.close')}</button>
                <button onClick={() => { setShowPreview(false); handleSubmit(); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
                {t('bulk.confirmSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Results (after submission) ══ */}
      {submitted && results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" /> {t('bulk.submissionResults')}
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-emerald-700">{results.filter(r => r.success).length}</p>
                <p className="text-xs font-semibold text-emerald-600">Successful</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-700">{results.filter(r => !r.success).length}</p>
                <p className="text-xs font-semibold text-red-600">Failed</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-emerald-700">SAR {fmt(totalToCollect)}</p>
                <p className="text-xs font-semibold text-emerald-600">Total Collected</p>
              </div>
            </div>

            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${r.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {r.success ? <CheckCircle size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-600" />}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{r.unit}</p>
                      <p className="text-xs text-gray-500">{r.customer}</p>
                    </div>
                  </div>
                  {r.success ? (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Saved</span>
                  ) : (
                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{r.error}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Post-submit actions */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => navigate('/history')}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-center">
                View Transactions
              </button>
              <button onClick={() => { setSubmitted(false); setResults([]); setSelectedBuilding(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all text-center">
                New Bulk Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkRentEntry;

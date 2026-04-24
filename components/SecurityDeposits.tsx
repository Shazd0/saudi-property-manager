import React, { useState, useEffect } from 'react';
import { Shield, Plus, Search, Edit2, Trash2, X, DollarSign, ArrowDownCircle, CheckCircle, MinusCircle } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getSecurityDeposits, saveSecurityDeposit, deleteSecurityDeposit, getContracts, getBuildings, getCustomers } from '../services/firestoreService';
import type { SecurityDeposit, SecurityDepositDeduction, Contract } from '../types';
import { buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

/**
 * Security Deposit Management
 * 
 * Track deposits per contract with full move-out deduction & refund workflow.
 * - Record deposit at contract signing
 * - Track deposit status: Held → Partially Refunded → Fully Refunded / Forfeited
 * - Add deductions (damages, unpaid rent, cleaning, etc.) during move-out
 * - Calculate refundable amount after deductions
 * - Refund workflow with payment method tracking
 */

const STATUS_COLORS: Record<string, string> = {
  Held: 'bg-blue-100 text-blue-700',
  'Partially Refunded': 'bg-amber-100 text-amber-700',
  'Fully Refunded': 'bg-emerald-100 text-emerald-700',
  Forfeited: 'bg-rose-100 text-rose-700',
};

const SecurityDeposits: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [deposits, setDeposits] = useState<SecurityDeposit[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customerRoomMap, setCustomerRoomMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ depositAmount: 0, depositDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH', status: 'Held', deductions: [], refundedAmount: 0 });
  const [editId, setEditId] = useState<string | null>(null);
  const [deductionModal, setDeductionModal] = useState<string | null>(null);
  const [deductionForm, setDeductionForm] = useState({ reason: '', amount: 0, description: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c, custs] = await Promise.all([getSecurityDeposits(), getContracts(), getCustomers()]);
      setDeposits((d || []) as SecurityDeposit[]);
      setContracts((c || []) as Contract[]);
      setCustomerRoomMap(buildCustomerRoomMap((custs || []) as any[]));
    } catch (err) { console.error('Failed to load deposit data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.customerName || !formData.depositAmount) { showError('Customer and deposit amount required'); return; }
    const deposit: SecurityDeposit = {
      ...formData,
      id: editId || crypto.randomUUID(),
      depositAmount: Number(formData.depositAmount),
      refundedAmount: Number(formData.refundedAmount || 0),
      deductions: formData.deductions || [],
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveSecurityDeposit(deposit);
      showSuccess(editId ? 'Deposit updated' : 'Security deposit recorded');
      setIsFormOpen(false);
      setEditId(null);
      load();
    } catch (err: any) { showError(err.message || 'Failed to save deposit'); }
  };

  const handleEdit = (d: SecurityDeposit) => { setFormData(d); setEditId(d.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this security deposit record?');
    setConfirmAction(() => async () => { await deleteSecurityDeposit(id); showSuccess('Deposit deleted'); load(); });
    setConfirmOpen(true);
  };

  const linkContract = (contractId: string) => {
    const c = contracts.find(ct => ct.id === contractId);
    if (!c) return;
    setFormData({ ...formData, contractId: c.id, contractNo: c.contractNo, customerId: c.customerId, customerName: c.customerName, buildingId: c.buildingId, buildingName: c.buildingName, unitName: c.unitName });
  };

  const addDeduction = async (depositId: string) => {
    if (!deductionForm.reason || !deductionForm.amount) { showError('Reason and amount required'); return; }
    const dep = deposits.find(d => d.id === depositId);
    if (!dep) return;
    const deduction: SecurityDepositDeduction = {
      id: crypto.randomUUID(),
      reason: deductionForm.reason,
      amount: Number(deductionForm.amount),
      date: new Date().toISOString().slice(0, 10),
      description: deductionForm.description,
    };
    const updatedDeductions = [...(dep.deductions || []), deduction];
    const totalDeductions = updatedDeductions.reduce((s, d) => s + d.amount, 0);
    const newStatus = totalDeductions >= dep.depositAmount ? 'Forfeited' : dep.status;
    await saveSecurityDeposit({ ...dep, deductions: updatedDeductions, status: newStatus });
    showSuccess('Deduction added');
    setDeductionModal(null);
    setDeductionForm({ reason: '', amount: 0, description: '' });
    load();
  };

  const processRefund = async (dep: SecurityDeposit) => {
    const totalDeductions = (dep.deductions || []).reduce((s, d) => s + d.amount, 0);
    const refundable = dep.depositAmount - totalDeductions - dep.refundedAmount;
    if (refundable <= 0) { showError('No refundable amount remaining'); return; }
    const newStatus = (dep.refundedAmount + refundable) >= (dep.depositAmount - totalDeductions) ? 'Fully Refunded' : 'Partially Refunded';
    await saveSecurityDeposit({ ...dep, refundedAmount: dep.refundedAmount + refundable, refundDate: new Date().toISOString().slice(0, 10), status: newStatus });
    showSuccess(`Refunded ${refundable.toLocaleString()} SAR`);
    load();
  };

  const filtered = deposits.filter(d => {
    const matchSearch = !search || d.customerName.toLowerCase().includes(search.toLowerCase()) || (d.buildingName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: deposits.length,
    held: deposits.filter(d => d.status === 'Held').length,
    totalHeldAmount: deposits.filter(d => d.status === 'Held').reduce((s, d) => s + d.depositAmount, 0),
    totalRefunded: deposits.reduce((s, d) => s + d.refundedAmount, 0),
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-emerald-600" /> Security Deposits
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track deposits, deductions, and refund workflows per contract</p>
        </div>
        <button onClick={() => { setFormData({ depositAmount: 0, depositDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH', status: 'Held', deductions: [], refundedAmount: 0 }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={14} /> Record Deposit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">Total Deposits</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.held}</div><div className="text-xs text-slate-500">Currently Held</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.totalHeldAmount.toLocaleString()}</div><div className="text-xs text-slate-500">Held Amount (SAR)</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.totalRefunded.toLocaleString()}</div><div className="text-xs text-slate-500">Total Refunded (SAR)</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allStatus')}</option>
          <option>Held</option><option>Partially Refunded</option><option>Fully Refunded</option><option>Forfeited</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Shield size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No security deposits found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(dep => {
            const totalDeductions = (dep.deductions || []).reduce((s, d) => s + d.amount, 0);
            const refundable = dep.depositAmount - totalDeductions - dep.refundedAmount;
            return (
              <div key={dep.id} className="ios-card p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {dep.contractNo && <span className="text-xs font-mono text-slate-400">Contract #{dep.contractNo}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[dep.status]}`}>{dep.status}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{formatCustomerFromMap(dep.customerName, (dep as any).customerId, customerRoomMap)}</h3>
                    <p className="text-sm text-slate-500">{dep.buildingName} / {dep.unitName}</p>
                    <p className="text-xs text-slate-400 mt-1">Deposited: {dep.depositDate} • {dep.paymentMethod}</p>
                    {(dep.deductions || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-slate-600">Deductions:</p>
                        {dep.deductions.map(d => (
                          <div key={d.id} className="text-xs text-rose-600 flex justify-between">
                            <span>- {d.reason}</span><span>{d.amount.toLocaleString()} SAR</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-600">{dep.depositAmount.toLocaleString()} <span className="text-xs">{t('common.sar')}</span></div>
                    {totalDeductions > 0 && <div className="text-xs text-rose-500">Deductions: -{totalDeductions.toLocaleString()}</div>}
                    {dep.refundedAmount > 0 && <div className="text-xs text-blue-500">Refunded: {dep.refundedAmount.toLocaleString()}</div>}
                    {refundable > 0 && <div className="text-xs font-bold text-emerald-600">Refundable: {refundable.toLocaleString()}</div>}
                    <div className="flex gap-1 mt-2 justify-end flex-wrap">
                      {dep.status === 'Held' && (
                        <>
                          <button onClick={() => setDeductionModal(dep.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg text-xs flex items-center gap-1"><MinusCircle size={14} /> Deduct</button>
                          <button onClick={() => processRefund(dep)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs flex items-center gap-1"><ArrowDownCircle size={14} /> Refund</button>
                        </>
                      )}
                      <button onClick={() => handleEdit(dep)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(dep.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deposit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Security Deposit</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Link to Contract</label>
                <select value={formData.contractId || ''} onChange={e => linkContract(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                  <option value="">Select Contract</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNo} - {formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label><input type="text" value={formData.customerName || ''} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Deposit Amount (SAR) *</label><input type="number" value={formData.depositAmount} onChange={e => setFormData({ ...formData, depositAmount: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Deposit Date</label><input type="date" value={formData.depositDate} onChange={e => setFormData({ ...formData, depositDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.paymentMethod')}</label><select value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm"><option value="CASH">{t('entry.cashShort')}</option><option value="BANK">{t('entry.bankTransfer')}</option><option value="CHEQUE">{t('entry.chequeShort')}</option></select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.building')}</label><input type="text" value={formData.buildingName || ''} readOnly className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.unit')}</label><input type="text" value={formData.unitName || ''} readOnly className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {deductionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setDeductionModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Add Deduction</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Reason *</label><select value={deductionForm.reason} onChange={e => setDeductionForm({ ...deductionForm, reason: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm"><option value="">Select Reason</option><option>Damage Repair</option><option>Unpaid Rent</option><option>Cleaning Fee</option><option>Key Replacement</option><option>Painting</option><option>Other</option></select></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Amount (SAR) *</label><input type="number" value={deductionForm.amount} onChange={e => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.description')}</label><input type="text" value={deductionForm.description} onChange={e => setDeductionForm({ ...deductionForm, description: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setDeductionModal(null)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
              <button onClick={() => addDeduction(deductionModal)} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm">Add Deduction</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default SecurityDeposits;

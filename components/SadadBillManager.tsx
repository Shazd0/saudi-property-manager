import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Edit2, Trash2, X, Send, CheckCircle, AlertTriangle, Clock, Ban } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getSadadBills, saveSadadBill, deleteSadadBill, getContracts, getCustomers, getBuildings } from '../services/firestoreService';
import type { SadadBill, Contract, Customer, Building } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';

/**
 * SADAD Bill Presentment Manager
 * 
 * Full SADAD biller integration for automated rent bill posting.
 * - Auto-generate bills from active contracts
 * - Track bill status: Pending → Paid / Overdue / Cancelled
 * - SADAD reference number tracking
 * - Bulk bill generation for all active contracts
 * - Bill status dashboard with overdue alerts
 */

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-slate-100 text-slate-500',
};

const STATUS_ICONS: Record<string, any> = {
  Pending: Clock,
  Paid: CheckCircle,
  Overdue: AlertTriangle,
  Cancelled: Ban,
};

const emptyBill: Omit<SadadBill, 'id' | 'createdAt' | 'createdBy'> = {
  billNumber: '',
  billerId: '',
  contractId: '',
  customerId: '',
  customerName: '',
  buildingId: '',
  buildingName: '',
  unitName: '',
  amount: 0,
  vatAmount: 0,
  totalAmount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  status: 'Pending',
  description: '',
};

const SadadBillManager: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [bills, setBills] = useState<SadadBill[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ ...emptyBill });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [b, c, cu, bl] = await Promise.all([getSadadBills(), getContracts(), getCustomers(), getBuildings()]);
      setBills((b || []) as SadadBill[]);
      setContracts((c || []) as Contract[]);
      setCustomers((cu || []) as Customer[]);
      setBuildings((bl || []) as Building[]);
    } catch (err) { console.error('Failed to load SADAD data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.customerName || !formData.amount) { showError('Customer and amount are required'); return; }
    const vatAmt = Number(formData.amount) * 0.15;
    const bill: SadadBill = {
      ...formData,
      id: editId || crypto.randomUUID(),
      amount: Number(formData.amount),
      vatAmount: vatAmt,
      totalAmount: Number(formData.amount) + vatAmt,
      billNumber: formData.billNumber || `SADAD-${Date.now().toString(36).toUpperCase()}`,
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveSadadBill(bill);
      showSuccess(editId ? 'Bill updated' : 'SADAD bill created');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyBill });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save bill'); }
  };

  const handleEdit = (b: SadadBill) => {
    setFormData(b);
    setEditId(b.id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this SADAD bill?');
    setConfirmAction(() => async () => {
      await deleteSadadBill(id);
      showSuccess('Bill deleted');
      load();
    });
    setConfirmOpen(true);
  };

  const handleMarkPaid = async (b: SadadBill) => {
    await saveSadadBill({ ...b, status: 'Paid', paymentDate: new Date().toISOString().slice(0, 10), sadadReferenceNo: b.sadadReferenceNo || `REF-${Date.now().toString(36).toUpperCase()}` });
    showSuccess('Bill marked as paid');
    load();
  };

  const generateBulkBills = async () => {
    const activeContracts = contracts.filter(c => c.status === 'Active');
    if (!activeContracts.length) { showError('No active contracts found'); return; }
    let count = 0;
    for (const contract of activeContracts) {
      const existing = bills.find(b => b.contractId === contract.id && b.status === 'Pending');
      if (existing) continue;
      const monthlyRent = contract.rentValue / 12;
      const vatAmt = monthlyRent * 0.15;
      const custForBill = customers.find(cu => cu.id === contract.customerId);
      const bill: SadadBill = {
        id: crypto.randomUUID(),
        billNumber: `SADAD-${Date.now().toString(36).toUpperCase()}-${count}`,
        billerId: formData.billerId || '',
        contractId: contract.id,
        customerId: contract.customerId,
        customerName: formatNameWithRoom(contract.customerName, custForBill?.roomNumber),
        buildingId: contract.buildingId,
        buildingName: contract.buildingName,
        unitName: contract.unitName,
        amount: monthlyRent,
        vatAmount: vatAmt,
        totalAmount: monthlyRent + vatAmt,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        status: 'Pending',
        description: `Monthly rent - ${contract.buildingName} / ${contract.unitName}`,
        createdAt: Date.now(),
        createdBy: 'system',
      };
      await saveSadadBill(bill);
      count++;
    }
    showSuccess(`Generated ${count} SADAD bills`);
    load();
  };

  const selectContract = (contractId: string) => {
    const c = contracts.find(ct => ct.id === contractId);
    if (!c) return;
    const custForSelect = customers.find(cu => cu.id === c.customerId);
    setFormData({ ...formData, contractId: c.id, customerId: c.customerId, customerName: formatNameWithRoom(c.customerName, custForSelect?.roomNumber), buildingId: c.buildingId, buildingName: c.buildingName, unitName: c.unitName, amount: c.rentValue / 12, description: `Monthly rent - ${c.buildingName} / ${c.unitName}` });
  };

  const today = new Date().toISOString().slice(0, 10);
  const filtered = bills.filter(b => {
    const matchSearch = !search || b.customerName.toLowerCase().includes(search.toLowerCase()) || b.billNumber.toLowerCase().includes(search.toLowerCase()) || (b.buildingName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Auto-mark overdue
  useEffect(() => {
    bills.forEach(b => {
      if (b.status === 'Pending' && b.dueDate < today) {
        saveSadadBill({ ...b, status: 'Overdue' });
      }
    });
  }, [bills, today]);

  const stats = {
    total: bills.length,
    pending: bills.filter(b => b.status === 'Pending').length,
    paid: bills.filter(b => b.status === 'Paid').length,
    overdue: bills.filter(b => b.status === 'Overdue').length,
    totalAmount: bills.filter(b => b.status !== 'Cancelled').reduce((s, b) => s + b.totalAmount, 0),
    collectedAmount: bills.filter(b => b.status === 'Paid').reduce((s, b) => s + b.totalAmount, 0),
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-emerald-600" /> SADAD Bill Presentment
          </h1>
          <p className="text-sm text-slate-500 mt-1">Automated rent bill posting via SADAD payment system</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateBulkBills} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-1">
            <Send size={14} /> Generate Bulk Bills
          </button>
          <button onClick={() => { setFormData({ ...emptyBill }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
            <Plus size={14} /> New Bill
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">Total Bills</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.pending}</div><div className="text-xs text-slate-500">{t('common.pending')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.paid}</div><div className="text-xs text-slate-500">{t('tenant.paidAmount')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.overdue}</div><div className="text-xs text-slate-500">Overdue</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.totalAmount.toLocaleString()}</div><div className="text-xs text-slate-500">Total (SAR)</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.collectedAmount.toLocaleString()}</div><div className="text-xs text-slate-500">Collected (SAR)</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allStatus')}</option>
          <option value="Pending">{t('common.pending')}</option>
          <option value="Paid">{t('tenant.paidAmount')}</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Receipt size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No SADAD bills found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bill => {
            const Icon = STATUS_ICONS[bill.status] || Clock;
            return (
              <div key={bill.id} className="ios-card p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-400">{bill.billNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_COLORS[bill.status]}`}>
                        <Icon size={12} /> {bill.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{formatCustomerFromMap(bill.customerName, (bill as any).customerId, buildCustomerRoomMap(customers))}</h3>
                    <p className="text-sm text-slate-500">{bill.buildingName} {bill.unitName ? `/ ${bill.unitName}` : ''}</p>
                    <p className="text-xs text-slate-400 mt-1">Due: {bill.dueDate} {bill.sadadReferenceNo ? `• Ref: ${bill.sadadReferenceNo}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-600">{bill.totalAmount.toLocaleString()} <span className="text-xs">{t('common.sar')}</span></div>
                    <div className="text-xs text-slate-400">VAT: {(bill.vatAmount || 0).toLocaleString()} SAR</div>
                    <div className="flex gap-1 mt-2 justify-end">
                      {bill.status === 'Pending' || bill.status === 'Overdue' ? (
                        <button onClick={() => handleMarkPaid(bill)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Mark Paid"><CheckCircle size={16} /></button>
                      ) : null}
                      <button onClick={() => handleEdit(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(bill.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} SADAD Bill</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Contract</label>
                  <select value={formData.contractId || ''} onChange={e => selectContract(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                    <option value="">Select Contract</option>
                    {contracts.filter(c => c.status === 'Active').map(c => <option key={c.id} value={c.id}>{c.contractNo} - {formatCustomerFromMap(c.customerName, c.customerId, buildCustomerRoomMap(customers))}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Biller ID</label>
                  <input type="text" value={formData.billerId} onChange={e => setFormData({ ...formData, billerId: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="SADAD Biller ID" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
                  <input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (SAR) *</label>
                  <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Due Date *</label>
                  <input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">
                    <option value="Pending">{t('common.pending')}</option>
                    <option value="Paid">{t('tenant.paidAmount')}</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">SADAD Reference No</label>
                  <input type="text" value={formData.sadadReferenceNo || ''} onChange={e => setFormData({ ...formData, sadadReferenceNo: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.building')}</label>
                  <input type="text" value={formData.buildingName || ''} readOnly className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.description')}</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default SadadBillManager;

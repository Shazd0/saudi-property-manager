import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Search, Edit2, Trash2, X, CheckCircle, Clock, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getAbsherRecords, saveAbsherRecord, deleteAbsherRecord, getCustomers, getBuildings, getContracts } from '../services/firestoreService';
import type { AbsherRecord, Customer, Building, Contract } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';

/**
 * Absher Notification Integration
 * 
 * For tenant address registration compliance with Saudi Absher system.
 * - Register tenant address when signing a new contract
 * - Track status: Pending → Submitted → Confirmed / Rejected / Expired
 * - Absher reference number tracking
 * - Registration types: Address Registration, Address Update, Tenant Departure
 * - Compliance monitoring — ensure all active tenants have registered addresses
 * - Auto-detect unregistered tenants from active contracts
 */

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Submitted: 'bg-blue-100 text-blue-700',
  Confirmed: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Expired: 'bg-slate-100 text-slate-500',
};

const REGISTRATION_TYPES = ['Address Registration', 'Address Update', 'Tenant Departure'];

const emptyForm: Omit<AbsherRecord, 'id' | 'createdAt' | 'createdBy'> = {
  customerId: '', customerName: '', nationalId: '', iqamaNo: '',
  buildingId: '', buildingName: '', unitName: '',
  registrationType: 'Address Registration', status: 'Pending', notes: '',
};

const AbsherIntegration: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [records, setRecords] = useState<AbsherRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, cu, b, c] = await Promise.all([getAbsherRecords(), getCustomers(), getBuildings(), getContracts()]);
      setRecords((r || []) as AbsherRecord[]);
      setCustomers((cu || []) as Customer[]);
      setBuildings((b || []) as Building[]);
      setContracts((c || []) as Contract[]);
    } catch (err) { console.error('Failed to load Absher data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.customerName || !formData.nationalId) { showError('Customer name and National/Iqama ID required'); return; }
    const record: AbsherRecord = {
      ...formData,
      id: editId || crypto.randomUUID(),
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveAbsherRecord(record);
      showSuccess(editId ? 'Record updated' : 'Absher registration recorded');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save record'); }
  };

  const handleEdit = (r: AbsherRecord) => { setFormData(r); setEditId(r.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this Absher record?');
    setConfirmAction(() => async () => { await deleteAbsherRecord(id); showSuccess('Record deleted'); load(); });
    setConfirmOpen(true);
  };

  const selectCustomer = (customerId: string) => {
    const c = customers.find(cu => cu.id === customerId);
    if (!c) return;
    // Find active contract for this customer
    const contract = contracts.find(ct => ct.customerId === c.id && ct.status === 'Active');
    setFormData({
      ...formData,
      customerId: c.id,
      customerName: formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber),
      nationalId: c.idNo || '',
      buildingId: contract?.buildingId || '',
      buildingName: contract?.buildingName || '',
      unitName: contract?.unitName || '',
    });
  };

  const markStatus = async (r: AbsherRecord, status: string) => {
    const update: any = { ...r, status };
    if (status === 'Submitted') update.submissionDate = new Date().toISOString().slice(0, 10);
    if (status === 'Confirmed') update.confirmationDate = new Date().toISOString().slice(0, 10);
    await saveAbsherRecord(update);
    showSuccess(`Status updated to ${status}`);
    load();
  };

  // Find active tenants without confirmed Absher registration
  const unregisteredTenants = contracts
    .filter(c => c.status === 'Active')
    .filter(c => !records.some(r => r.customerId === c.customerId && (r.status === 'Confirmed' || r.status === 'Submitted') && r.registrationType === 'Address Registration'));

  const customerRoomMap = buildCustomerRoomMap(customers);

  const filtered = records.filter(r => {
    const matchSearch = !search || r.customerName.toLowerCase().includes(search.toLowerCase()) || r.nationalId.includes(search) || (r.buildingName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    const matchType = !filterType || r.registrationType === filterType;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const stats = {
    total: records.length,
    confirmed: records.filter(r => r.status === 'Confirmed').length,
    pending: records.filter(r => r.status === 'Pending' || r.status === 'Submitted').length,
    unregistered: unregisteredTenants.length,
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-emerald-600" /> Absher Integration <span className="text-sm font-normal text-slate-400">أبشر</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tenant address registration compliance via Absher platform</p>
        </div>
        <button onClick={() => { setFormData({ ...emptyForm }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={14} /> New Registration
        </button>
      </div>

      {/* Unregistered Alert */}
      {unregisteredTenants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-800">{unregisteredTenants.length} active tenant(s) without Absher address registration</p>
              <p className="text-xs text-amber-600 mt-1">Saudi regulations require landlords to register tenant addresses via Absher within 7 days of contract start.</p>
              <div className="mt-2 space-y-1">
                {unregisteredTenants.slice(0, 5).map(c => (
                  <p key={c.id} className="text-sm text-amber-700">• {formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} — {c.buildingName}/{c.unitName}</p>
                ))}
                {unregisteredTenants.length > 5 && <p className="text-sm text-amber-500">... and {unregisteredTenants.length - 5} more</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">{t('history.totalRecords')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.confirmed}</div><div className="text-xs text-slate-500">Confirmed</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.pending}</div><div className="text-xs text-slate-500">Pending/Submitted</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.unregistered}</div><div className="text-xs text-slate-500">Unregistered</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allStatus')}</option><option>{t('common.pending')}</option><option>Submitted</option><option>Confirmed</option><option>{t('common.rejected')}</option><option>{t('contract.statusExpired')}</option></select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allTypes')}</option>{REGISTRATION_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><MapPin size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No Absher records found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="ios-card p-4">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{r.registrationType}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    {r.absherReferenceNo && <span className="text-xs text-slate-400 font-mono">Ref: {r.absherReferenceNo}</span>}
                  </div>
                  <h3 className="font-semibold text-slate-800">{formatCustomerFromMap(r.customerName, r.customerId, customerRoomMap)}</h3>
                  <p className="text-sm text-slate-500">ID: {r.nationalId} {r.iqamaNo ? `• Iqama: ${r.iqamaNo}` : ''}</p>
                  {r.buildingName && <p className="text-sm text-slate-400">{r.buildingName} {r.unitName ? `/ ${r.unitName}` : ''}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    Created: {new Date(r.createdAt).toLocaleDateString()}
                    {r.submissionDate ? ` • Submitted: ${r.submissionDate}` : ''}
                    {r.confirmationDate ? ` • Confirmed: ${r.confirmationDate}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex gap-1 justify-end flex-wrap">
                    {r.status === 'Pending' && (
                      <button onClick={() => markStatus(r, 'Submitted')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs flex items-center gap-1"><ExternalLink size={14} /> Submitted</button>
                    )}
                    {r.status === 'Submitted' && (
                      <>
                        <button onClick={() => markStatus(r, 'Confirmed')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs flex items-center gap-1"><CheckCircle size={14} />{t('common.confirm')}</button>
                        <button onClick={() => markStatus(r, 'Rejected')} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1"><XCircle size={14} />{t('approval.reject')}</button>
                      </>
                    )}
                    <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Absher Registration</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Select Customer</label>
                <select onChange={e => selectCustomer(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                  <option value="">Choose customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber)} ({c.idNo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label><input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">National ID / Iqama *</label><input type="text" value={formData.nationalId} onChange={e => setFormData({ ...formData, nationalId: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Registration Type</label><select value={formData.registrationType} onChange={e => setFormData({ ...formData, registrationType: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">{REGISTRATION_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm"><option>{t('common.pending')}</option><option>Submitted</option><option>Confirmed</option><option>{t('common.rejected')}</option><option>{t('contract.statusExpired')}</option></select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.building')}</label><input type="text" value={formData.buildingName || ''} onChange={e => setFormData({ ...formData, buildingName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('entry.unit')}</label><input type="text" value={formData.unitName || ''} onChange={e => setFormData({ ...formData, unitName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Absher Reference No</label><input type="text" value={formData.absherReferenceNo || ''} onChange={e => setFormData({ ...formData, absherReferenceNo: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default AbsherIntegration;

import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Search, Edit2, Trash2, X, AlertTriangle, CheckCircle, Clock, Bell } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getMunicipalityLicenses, saveMunicipalityLicense, deleteMunicipalityLicense, getBuildings } from '../services/firestoreService';
import type { MunicipalityLicense, Building } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

/**
 * Municipality License Tracking (بلدية)
 * 
 * Track Baladiya license renewals per building with expiry alerts.
 * - Record all municipality licenses per building (Building Permit, Commercial, Safety, Operating)
 * - Expiry tracking with countdown and color-coded alerts
 * - Renewal reminders (configurable days before expiry)
 * - License status: Active / Expired / Renewal Pending / Suspended
 * - Cost tracking for renewals
 * - Issuing authority tracking (e.g. أمانة الرياض)
 */

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Expired: 'bg-rose-100 text-rose-700',
  'Renewal Pending': 'bg-amber-100 text-amber-700',
  Suspended: 'bg-red-100 text-red-700',
};

const LICENSE_TYPES = ['Building Permit', 'Commercial License', 'Safety Certificate', 'Operating License', 'Other'];

const emptyForm: Omit<MunicipalityLicense, 'id' | 'createdAt' | 'createdBy'> = {
  buildingId: '', buildingName: '', licenseNumber: '', licenseType: 'Building Permit',
  issueDate: '', expiryDate: '', issuingAuthority: '', status: 'Active',
  renewalCost: 0, notes: '', reminderDays: 30,
};

const MunicipalityLicenseTracker: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [licenses, setLicenses] = useState<MunicipalityLicense[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
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
      const [l, b] = await Promise.all([getMunicipalityLicenses(), getBuildings()]);
      setLicenses((l || []) as MunicipalityLicense[]);
      setBuildings((b || []) as Building[]);
    } catch (err) { console.error('Failed to load municipality data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getDaysRemaining = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.buildingName || !formData.licenseNumber) { showError('Building and license number required'); return; }
    const license: MunicipalityLicense = {
      ...formData,
      id: editId || crypto.randomUUID(),
      renewalCost: Number(formData.renewalCost) || 0,
      reminderDays: Number(formData.reminderDays) || 30,
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveMunicipalityLicense(license);
      showSuccess(editId ? 'License updated' : 'Municipality license recorded');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save license'); }
  };

  const handleEdit = (l: MunicipalityLicense) => { setFormData(l); setEditId(l.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this license record?');
    setConfirmAction(() => async () => { await deleteMunicipalityLicense(id); showSuccess('License deleted'); load(); });
    setConfirmOpen(true);
  };

  const selectBuilding = (buildingId: string) => {
    const b = buildings.find(bl => bl.id === buildingId);
    if (!b) return;
    setFormData({ ...formData, buildingId: b.id, buildingName: b.name });
  };

  // Auto-update expired licenses
  useEffect(() => {
    licenses.forEach(l => {
      if (l.status === 'Active' && getDaysRemaining(l.expiryDate) < 0) {
        saveMunicipalityLicense({ ...l, status: 'Expired' });
      }
    });
  }, [licenses]);

  const expiringLicenses = licenses.filter(l => {
    const days = getDaysRemaining(l.expiryDate);
    return l.status === 'Active' && days >= 0 && days <= (l.reminderDays || 30);
  });

  const filtered = licenses.filter(l => {
    const matchSearch = !search || l.buildingName.toLowerCase().includes(search.toLowerCase()) || l.licenseNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || l.status === filterStatus;
    const matchType = !filterType || l.licenseType === filterType;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => getDaysRemaining(a.expiryDate) - getDaysRemaining(b.expiryDate));

  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.status === 'Active').length,
    expired: licenses.filter(l => l.status === 'Expired').length,
    expiringSoon: expiringLicenses.length,
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="text-emerald-600" /> Municipality Licenses <span className="text-sm font-normal text-slate-400">رخص البلدية</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track Baladiya license renewals and expiry alerts per building</p>
        </div>
        <button onClick={() => { setFormData({ ...emptyForm }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={14} /> Add License
        </button>
      </div>

      {/* Expiring Alert */}
      {expiringLicenses.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <Bell className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-800">{expiringLicenses.length} license(s) expiring soon!</p>
              {expiringLicenses.map(l => (
                <p key={l.id} className="text-sm text-amber-600">• {l.buildingName} — {l.licenseType} expires in {getDaysRemaining(l.expiryDate)} days ({l.expiryDate})</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">Total Licenses</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.active}</div><div className="text-xs text-slate-500">{t('common.active')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.expired}</div><div className="text-xs text-slate-500">{t('contract.statusExpired')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div><div className="text-xs text-slate-500">{t('owner.contractsExpiring')}</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allStatus')}</option><option>{t('common.active')}</option><option>{t('contract.statusExpired')}</option><option>Renewal Pending</option><option>Suspended</option></select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allTypes')}</option>{LICENSE_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Landmark size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No municipality licenses found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => {
            const days = getDaysRemaining(l.expiryDate);
            return (
              <div key={l.id} className={`ios-card p-4 ${days < 0 ? 'border-l-4 border-rose-400' : days <= 30 ? 'border-l-4 border-amber-400' : 'border-l-4 border-emerald-400'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{l.licenseType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{l.buildingName}</h3>
                    <p className="text-sm text-slate-500 font-mono">License: {l.licenseNumber}</p>
                    <p className="text-xs text-slate-400 mt-1">{l.issueDate} → {l.expiryDate} • {l.issuingAuthority}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${days < 0 ? 'text-rose-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                    </div>
                    {l.renewalCost ? <div className="text-xs text-slate-400">Cost: {l.renewalCost.toLocaleString()} SAR</div> : null}
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => handleEdit(l)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(l.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
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
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Municipality License</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Building *</label><select value={formData.buildingId} onChange={e => selectBuilding(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required><option value="">Select Building</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">License Type</label><select value={formData.licenseType} onChange={e => setFormData({ ...formData, licenseType: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">{LICENSE_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">License Number *</label><input type="text" value={formData.licenseNumber} onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Issuing Authority</label><input type="text" value={formData.issuingAuthority} onChange={e => setFormData({ ...formData, issuingAuthority: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="e.g. أمانة الرياض" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Issue Date</label><input type="date" value={formData.issueDate} onChange={e => setFormData({ ...formData, issueDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date *</label><input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm"><option>{t('common.active')}</option><option>{t('contract.statusExpired')}</option><option>Renewal Pending</option><option>Suspended</option></select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Renewal Cost (SAR)</label><input type="number" value={formData.renewalCost || ''} onChange={e => setFormData({ ...formData, renewalCost: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Reminder (days before)</label><input type="number" value={formData.reminderDays || 30} onChange={e => setFormData({ ...formData, reminderDays: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="1" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save License</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default MunicipalityLicenseTracker;

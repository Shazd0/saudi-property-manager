import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Search, Edit2, Trash2, X, AlertTriangle, CheckCircle, Clock, Bell, Flame } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getCivilDefenseRecords, saveCivilDefenseRecord, deleteCivilDefenseRecord, getBuildings } from '../services/firestoreService';
import type { CivilDefenseRecord, Building } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

/**
 * Civil Defense Compliance
 * 
 * Track fire safety certificates, civil defense inspection dates, and compliance status per building.
 * - Record all civil defense inspections and certificates
 * - Inspection types: Fire Safety, Emergency Exits, Extinguishers, Alarm System, Sprinkler, Full Inspection
 * - Compliance status: Compliant / Non-Compliant / Pending Inspection / Expired
 * - Expiry alerts with configurable reminder days
 * - Corrective actions tracking for non-compliant findings
 * - Inspector name and findings documentation
 */

const STATUS_COLORS: Record<string, string> = {
  Compliant: 'bg-emerald-100 text-emerald-700',
  'Non-Compliant': 'bg-rose-100 text-rose-700',
  'Pending Inspection': 'bg-amber-100 text-amber-700',
  Expired: 'bg-red-100 text-red-700',
};

const INSPECTION_TYPES = ['Fire Safety', 'Emergency Exits', 'Fire Extinguishers', 'Alarm System', 'Sprinkler System', 'Full Inspection', 'Other'];

const emptyForm: Omit<CivilDefenseRecord, 'id' | 'createdAt' | 'createdBy'> = {
  buildingId: '', buildingName: '', certificateNumber: '', inspectionType: 'Fire Safety',
  inspectionDate: new Date().toISOString().slice(0, 10), expiryDate: '',
  status: 'Pending Inspection', inspector: '', findings: '', correctiveActions: '', notes: '', reminderDays: 30,
};

const CivilDefenseCompliance: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [records, setRecords] = useState<CivilDefenseRecord[]>([]);
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
      const [r, b] = await Promise.all([getCivilDefenseRecords(), getBuildings()]);
      setRecords((r || []) as CivilDefenseRecord[]);
      setBuildings((b || []) as Building[]);
    } catch (err) { console.error('Failed to load civil defense data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getDaysRemaining = (expiryDate: string) => {
    if (!expiryDate) return 999;
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.buildingName || !formData.inspectionType) { showError('Building and inspection type required'); return; }
    const record: CivilDefenseRecord = {
      ...formData,
      id: editId || crypto.randomUUID(),
      reminderDays: Number(formData.reminderDays) || 30,
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveCivilDefenseRecord(record);
      showSuccess(editId ? 'Record updated' : 'Civil defense record created');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save record'); }
  };

  const handleEdit = (r: CivilDefenseRecord) => { setFormData(r); setEditId(r.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this civil defense record?');
    setConfirmAction(() => async () => { await deleteCivilDefenseRecord(id); showSuccess('Record deleted'); load(); });
    setConfirmOpen(true);
  };

  const selectBuilding = (buildingId: string) => {
    const b = buildings.find(bl => bl.id === buildingId);
    if (!b) return;
    setFormData({ ...formData, buildingId: b.id, buildingName: b.name });
  };

  // Auto-expire
  useEffect(() => {
    records.forEach(r => {
      if (r.status === 'Compliant' && r.expiryDate && getDaysRemaining(r.expiryDate) < 0) {
        saveCivilDefenseRecord({ ...r, status: 'Expired' });
      }
    });
  }, [records]);

  const expiringRecords = records.filter(r => {
    const days = getDaysRemaining(r.expiryDate);
    return (r.status === 'Compliant') && days >= 0 && days <= (r.reminderDays || 30);
  });

  const nonCompliant = records.filter(r => r.status === 'Non-Compliant');

  const filtered = records.filter(r => {
    const matchSearch = !search || r.buildingName.toLowerCase().includes(search.toLowerCase()) || (r.certificateNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    const matchType = !filterType || r.inspectionType === filterType;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => getDaysRemaining(a.expiryDate) - getDaysRemaining(b.expiryDate));

  const stats = {
    total: records.length,
    compliant: records.filter(r => r.status === 'Compliant').length,
    nonCompliant: nonCompliant.length,
    expired: records.filter(r => r.status === 'Expired').length,
    expiringSoon: expiringRecords.length,
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-rose-600" /> Civil Defense Compliance <span className="text-sm font-normal text-slate-400">الدفاع المدني</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track fire safety, inspections & compliance status per building</p>
        </div>
        <button onClick={() => { setFormData({ ...emptyForm }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={14} /> Add Record
        </button>
      </div>

      {/* Alerts */}
      {(nonCompliant.length > 0 || expiringRecords.length > 0) && (
        <div className="space-y-2 mb-4">
          {nonCompliant.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-2">
              <ShieldAlert className="text-rose-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-rose-800">{nonCompliant.length} building(s) are NON-COMPLIANT!</p>
                {nonCompliant.map(r => <p key={r.id} className="text-sm text-rose-600">• {r.buildingName} — {r.inspectionType}: {r.findings || 'Action required'}</p>)}
              </div>
            </div>
          )}
          {expiringRecords.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <Bell className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-amber-800">{expiringRecords.length} certificate(s) expiring soon</p>
                {expiringRecords.map(r => <p key={r.id} className="text-sm text-amber-600">• {r.buildingName} — {r.inspectionType} expires in {getDaysRemaining(r.expiryDate)} days</p>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">{t('history.totalRecords')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.compliant}</div><div className="text-xs text-slate-500">Compliant</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.nonCompliant}</div><div className="text-xs text-slate-500">Non-Compliant</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-red-600">{stats.expired}</div><div className="text-xs text-slate-500">{t('contract.statusExpired')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div><div className="text-xs text-slate-500">{t('owner.contractsExpiring')}</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allStatus')}</option><option>Compliant</option><option>Non-Compliant</option><option>Pending Inspection</option><option>{t('contract.statusExpired')}</option></select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allTypes')}</option>{INSPECTION_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><ShieldAlert size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No civil defense records found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const days = getDaysRemaining(r.expiryDate);
            return (
              <div key={r.id} className={`ios-card p-4 ${r.status === 'Non-Compliant' ? 'border-l-4 border-rose-500' : days < 0 ? 'border-l-4 border-red-400' : days <= 30 ? 'border-l-4 border-amber-400' : 'border-l-4 border-emerald-400'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame size={14} className="text-orange-500" />
                      <span className="text-xs font-medium bg-orange-50 text-orange-600 px-2 py-0.5 rounded">{r.inspectionType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{r.buildingName}</h3>
                    {r.certificateNumber && <p className="text-sm text-slate-500 font-mono">Cert: {r.certificateNumber}</p>}
                    <p className="text-xs text-slate-400 mt-1">Inspected: {r.inspectionDate} {r.inspector ? `by ${r.inspector}` : ''}</p>
                    {r.findings && <p className="text-xs text-rose-500 mt-1">Findings: {r.findings}</p>}
                    {r.correctiveActions && <p className="text-xs text-blue-500">Actions: {r.correctiveActions}</p>}
                  </div>
                  <div className="text-right">
                    {r.expiryDate && (
                      <div className={`text-lg font-bold ${days < 0 ? 'text-rose-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Expires: {r.expiryDate || 'N/A'}</p>
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
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
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Civil Defense Record</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Building *</label><select value={formData.buildingId} onChange={e => selectBuilding(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required><option value="">Select Building</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Inspection Type *</label><select value={formData.inspectionType} onChange={e => setFormData({ ...formData, inspectionType: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">{INSPECTION_TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Certificate Number</label><input type="text" value={formData.certificateNumber || ''} onChange={e => setFormData({ ...formData, certificateNumber: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Inspector</label><input type="text" value={formData.inspector || ''} onChange={e => setFormData({ ...formData, inspector: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Inspection Date</label><input type="date" value={formData.inspectionDate} onChange={e => setFormData({ ...formData, inspectionDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label><input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Next Inspection Date</label><input type="date" value={formData.nextInspectionDate || ''} onChange={e => setFormData({ ...formData, nextInspectionDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm"><option>Compliant</option><option>Non-Compliant</option><option>Pending Inspection</option><option>{t('contract.statusExpired')}</option></select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Reminder Days</label><input type="number" value={formData.reminderDays || 30} onChange={e => setFormData({ ...formData, reminderDays: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="1" /></div>
              </div>
              {formData.status === 'Non-Compliant' && (
                <>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Findings</label><textarea value={formData.findings || ''} onChange={e => setFormData({ ...formData, findings: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Inspection findings..." /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Corrective Actions</label><textarea value={formData.correctiveActions || ''} onChange={e => setFormData({ ...formData, correctiveActions: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Required corrective actions..." /></div>
                </>
              )}
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default CivilDefenseCompliance;

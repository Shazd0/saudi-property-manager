import React, { useState, useEffect } from 'react';
import { Zap, Plus, Search, Edit2, Trash2, X, Droplets, Flame, Filter } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getUtilityReadings, saveUtilityReading, deleteUtilityReading, getBuildings } from '../services/firestoreService';
import type { UtilityReading, UtilityType, Building } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

/**
 * Utilities Consumption Tracking
 * 
 * Track water, electricity, and gas consumption per unit with sub-meter support.
 * - Record meter readings per unit per utility type
 * - Auto-calculate consumption (current - previous reading)
 * - Cost calculation with configurable rate per unit
 * - History view per building/unit
 * - Billing dispute resolution with reading evidence
 * - Monthly consumption trends
 */

const UTILITY_ICONS: Record<UtilityType, any> = { Electricity: Zap, Water: Droplets, Gas: Flame };
const UTILITY_COLORS: Record<UtilityType, string> = { Electricity: 'text-amber-500', Water: 'text-blue-500', Gas: 'text-orange-500' };
const UTILITY_BG: Record<UtilityType, string> = { Electricity: 'bg-amber-50 border-amber-200', Water: 'bg-blue-50 border-blue-200', Gas: 'bg-orange-50 border-orange-200' };

const DEFAULT_RATES: Record<UtilityType, number> = { Electricity: 0.18, Water: 6.0, Gas: 0.75 }; // SAR per kWh / m3

const emptyForm: Omit<UtilityReading, 'id' | 'createdAt' | 'createdBy'> = {
  buildingId: '', buildingName: '', unitName: '', utilityType: 'Electricity',
  meterNumber: '', previousReading: 0, currentReading: 0, consumption: 0,
  readingDate: new Date().toISOString().slice(0, 10), ratePerUnit: DEFAULT_RATES.Electricity,
  totalCost: 0, isPaid: false, notes: '',
};

const UtilitiesTracker: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterBuilding, setFilterBuilding] = useState('');
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
      const [r, b] = await Promise.all([getUtilityReadings(), getBuildings()]);
      setReadings((r || []) as UtilityReading[]);
      setBuildings((b || []) as Building[]);
    } catch (err) { console.error('Failed to load utility data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const calcConsumption = (prev: number, curr: number) => Math.max(0, curr - prev);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.buildingName || !formData.unitName) { showError('Building and unit are required'); return; }
    if (Number(formData.currentReading) < Number(formData.previousReading)) { showError('Current reading cannot be less than previous reading'); return; }
    const consumption = calcConsumption(Number(formData.previousReading), Number(formData.currentReading));
    const totalCost = consumption * Number(formData.ratePerUnit || 0);
    const reading: UtilityReading = {
      ...formData,
      id: editId || crypto.randomUUID(),
      previousReading: Number(formData.previousReading),
      currentReading: Number(formData.currentReading),
      consumption, totalCost,
      ratePerUnit: Number(formData.ratePerUnit),
      createdAt: formData.createdAt || Date.now(),
      createdBy: formData.createdBy || 'system',
    };
    try {
      await saveUtilityReading(reading);
      showSuccess(editId ? 'Reading updated' : 'Utility reading recorded');
      setIsFormOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save reading'); }
  };

  const handleEdit = (r: UtilityReading) => { setFormData(r); setEditId(r.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this utility reading?');
    setConfirmAction(() => async () => { await deleteUtilityReading(id); showSuccess('Reading deleted'); load(); });
    setConfirmOpen(true);
  };

  const selectBuilding = (buildingId: string) => {
    const b = buildings.find(bl => bl.id === buildingId);
    if (!b) return;
    setFormData({ ...formData, buildingId: b.id, buildingName: b.name, unitName: '' });
  };

  const setUtilityType = (type: UtilityType) => {
    setFormData({ ...formData, utilityType: type, ratePerUnit: DEFAULT_RATES[type] });
  };

  // Get last reading for pre-fill
  const getLastReading = (buildingId: string, unitName: string, utilityType: string) => {
    return readings
      .filter(r => r.buildingId === buildingId && r.unitName === unitName && r.utilityType === utilityType)
      .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime())[0];
  };

  useEffect(() => {
    if (formData.buildingId && formData.unitName && formData.utilityType && !editId) {
      const last = getLastReading(formData.buildingId, formData.unitName, formData.utilityType);
      if (last) {
        setFormData((f: any) => ({ ...f, previousReading: last.currentReading, previousReadingDate: last.readingDate, meterNumber: last.meterNumber || '' }));
      }
    }
  }, [formData.buildingId, formData.unitName, formData.utilityType]);

  const filtered = readings.filter(r => {
    const matchSearch = !search || r.buildingName.toLowerCase().includes(search.toLowerCase()) || r.unitName.toLowerCase().includes(search.toLowerCase()) || (r.meterNumber || '').includes(search);
    const matchType = !filterType || r.utilityType === filterType;
    const matchBld = !filterBuilding || r.buildingId === filterBuilding;
    return matchSearch && matchType && matchBld;
  }).sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());

  const stats = {
    electricity: readings.filter(r => r.utilityType === 'Electricity').reduce((s, r) => s + (r.totalCost || 0), 0),
    water: readings.filter(r => r.utilityType === 'Water').reduce((s, r) => s + (r.totalCost || 0), 0),
    gas: readings.filter(r => r.utilityType === 'Gas').reduce((s, r) => s + (r.totalCost || 0), 0),
    unpaid: readings.filter(r => !r.isPaid).reduce((s, r) => s + (r.totalCost || 0), 0),
  };

  const selectedBuilding = buildings.find(b => b.id === formData.buildingId);

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="text-amber-500" /> Utilities Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track electricity, water & gas consumption per unit with sub-meter readings</p>
        </div>
        <button onClick={() => { setFormData({ ...emptyForm }); setEditId(null); setIsFormOpen(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1">
          <Plus size={14} /> Record Reading
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center border-l-4 border-amber-400"><Zap className="mx-auto text-amber-500 mb-1" size={20} /><div className="text-xl font-bold text-amber-600">{stats.electricity.toLocaleString()}</div><div className="text-xs text-slate-500">Electricity (SAR)</div></div>
        <div className="ios-card p-4 text-center border-l-4 border-blue-400"><Droplets className="mx-auto text-blue-500 mb-1" size={20} /><div className="text-xl font-bold text-blue-600">{stats.water.toLocaleString()}</div><div className="text-xs text-slate-500">Water (SAR)</div></div>
        <div className="ios-card p-4 text-center border-l-4 border-orange-400"><Flame className="mx-auto text-orange-500 mb-1" size={20} /><div className="text-xl font-bold text-orange-600">{stats.gas.toLocaleString()}</div><div className="text-xs text-slate-500">Gas (SAR)</div></div>
        <div className="ios-card p-4 text-center border-l-4 border-rose-400"><div className="text-xl font-bold text-rose-600">{stats.unpaid.toLocaleString()}</div><div className="text-xs text-slate-500">Unpaid (SAR)</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allTypes')}</option>
          <option value="Electricity">Electricity</option>
          <option value="Water">Water</option>
          <option value="Gas">Gas</option>
        </select>
        <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allBuildings')}</option>
          {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Zap size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No utility readings found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const Icon = UTILITY_ICONS[r.utilityType as UtilityType] || Zap;
            return (
              <div key={r.id} className={`ios-card p-4 border ${UTILITY_BG[r.utilityType as UtilityType] || ''}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className={UTILITY_COLORS[r.utilityType as UtilityType]} />
                      <span className="font-semibold text-sm">{r.utilityType}</span>
                      {r.meterNumber && <span className="text-xs text-slate-400">Meter: {r.meterNumber}</span>}
                      {!r.isPaid && <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Unpaid</span>}
                    </div>
                    <h3 className="font-semibold text-slate-800">{r.buildingName} / {r.unitName}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Reading: {r.previousReading} → {r.currentReading} = <span className="font-bold">{r.consumption} units</span>
                    </p>
                    <p className="text-xs text-slate-400">{r.readingDate}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600">{(r.totalCost || 0).toLocaleString()} <span className="text-xs">{t('common.sar')}</span></div>
                    <div className="text-xs text-slate-400">Rate: {r.ratePerUnit} SAR/unit</div>
                    <div className="flex gap-1 mt-2 justify-end">
                      {!r.isPaid && (
                        <button onClick={async () => { await saveUtilityReading({ ...r, isPaid: true }); showSuccess('Marked as paid'); load(); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs">✓ Paid</button>
                      )}
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
              <h2 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Utility Reading</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {/* Utility Type Selector */}
              <div className="flex gap-2">
                {(['Electricity', 'Water', 'Gas'] as UtilityType[]).map(type => {
                  const Icon = UTILITY_ICONS[type];
                  return (
                    <button key={type} type="button" onClick={() => setUtilityType(type)} className={`flex-1 p-3 rounded-xl border-2 text-center text-sm font-medium transition ${formData.utilityType === type ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <Icon size={20} className={`mx-auto mb-1 ${UTILITY_COLORS[type]}`} />
                      {type}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Building *</label>
                  <select value={formData.buildingId} onChange={e => selectBuilding(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required>
                    <option value="">Select Building</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Unit *</label>
                  <select value={formData.unitName} onChange={e => setFormData({ ...formData, unitName: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required>
                    <option value="">Select Unit</option>
                    {selectedBuilding?.units?.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Meter Number</label><input type="text" value={formData.meterNumber} onChange={e => setFormData({ ...formData, meterNumber: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Reading Date *</label><input type="date" value={formData.readingDate} onChange={e => setFormData({ ...formData, readingDate: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Previous Reading</label><input type="number" value={formData.previousReading} onChange={e => setFormData({ ...formData, previousReading: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Current Reading *</label><input type="number" value={formData.currentReading} onChange={e => setFormData({ ...formData, currentReading: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Rate/Unit (SAR)</label><input type="number" value={formData.ratePerUnit} onChange={e => setFormData({ ...formData, ratePerUnit: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" min="0" step="0.01" /></div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Est. Cost</label>
                  <div className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold text-emerald-600">{(calcConsumption(Number(formData.previousReading), Number(formData.currentReading)) * Number(formData.ratePerUnit || 0)).toLocaleString()} SAR</div>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">{t('common.notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">Save Reading</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title={t('common.confirm')} message={confirmMsg} onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} danger />
    </div>
  );
};

export default UtilitiesTracker;

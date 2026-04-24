import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Fingerprint, Plus, Search, Edit2, Trash2, X, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, Settings, Eye, EyeOff, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { getNafathVerifications, saveNafathVerification, deleteNafathVerification, getCustomers } from '../services/firestoreService';
import {
  initiateNafathVerification,
  checkNafathStatus,
  saveNafathCredentials,
  getNafathCredentialsMasked,
  toInternalStatus,
} from '../services/nafathService';
import type { NafathVerification, Customer } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { formatNameWithRoom, formatCustomerFromMap, buildCustomerRoomMap } from '../utils/customerDisplay';

/**
 * Nafath Identity Verification — Real API Integration
 *
 * Uses the ELM / Nafath (نفاذ) API via Firebase Cloud Functions:
 *   1. POST /nafathRequest  → returns transId + random number (1–99)
 *   2. User confirms number in Nafath mobile app
 *   3. Auto-polls /nafathStatus every 5 s until COMPLETED / REJECTED / EXPIRED
 *
 * Credentials (app-id + app-key from ELM portal) are stored in Firestore
 * or as Firebase Function environment variables NAFATH_APP_ID / NAFATH_APP_KEY.
 */

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Verified: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Expired: 'bg-slate-100 text-slate-500',
};

const STATUS_ICONS: Record<string, any> = {
  Pending: Clock,
  Verified: CheckCircle,
  Rejected: XCircle,
  Expired: AlertTriangle,
};

/** Countdown display for WAITING verifications */
const Countdown: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
  const [secs, setSecs] = useState(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const min = Math.floor(secs / 60);
  const sec = secs % 60;
  const isUrgent = secs < 60;
  return (
    <span className={`font-mono font-bold text-xs ${isUrgent ? 'text-rose-600' : 'text-amber-600'}`}>
      {min}:{String(sec).padStart(2, '0')} remaining
    </span>
  );
};

const NafathVerificationPage: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { showSuccess, showError, showInfo } = useToast();
  const [verifications, setVerifications] = useState<NafathVerification[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ customerName: '', nationalId: '', status: 'Pending' });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [nafathAppId, setNafathAppId] = useState('');
  const [nafathAppKey, setNafathAppKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [credStatus, setCredStatus] = useState<{ hasCredentials: boolean; maskedAppId: string } | null>(null);
  const [savingCreds, setSavingCreds] = useState(false);

  // Active polling: map of transId → intervalId
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [v, c, creds] = await Promise.all([
        getNafathVerifications(),
        getCustomers(),
        getNafathCredentialsMasked(),
      ]);
      setVerifications((v || []) as NafathVerification[]);
      setCustomers((c || []) as Customer[]);
      setCredStatus(creds);
    } catch (err) { console.error('Failed to load Nafath data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Resume polling for any in-flight WAITING records
  useEffect(() => {
    verifications.forEach(v => {
      if (v.status === 'Pending' && v.requestId && v.verificationCode && !pollingRefs.current[v.requestId]) {
        startPolling(v);
      }
    });
  }, [verifications]);

  // Cleanup on unmount
  useEffect(() => () => {
    Object.values(pollingRefs.current).forEach(clearInterval);
  }, []);

  const validateNationalId = (id: string): boolean => /^[12]\d{9}$/.test(id);

  /** Begin polling status for a WAITING request */
  const startPolling = useCallback((record: NafathVerification) => {
    const { requestId: transId, verificationCode, nationalId, id } = record;
    if (!transId || !verificationCode) return;
    if (pollingRefs.current[transId]) return; // already polling

    const random = Number(verificationCode);

    const intervalId = setInterval(async () => {
      try {
        const result = await checkNafathStatus(nationalId, transId, random);
        if (result.status === 'WAITING') return; // still waiting

        // Terminal state — stop polling and update record
        clearInterval(pollingRefs.current[transId]);
        delete pollingRefs.current[transId];

        const internalStatus = toInternalStatus(result.status);
        const updated: NafathVerification = {
          ...record,
          status: internalStatus,
          responseData: JSON.stringify(result),
          ...(internalStatus === 'Verified' ? { verifiedAt: Date.now() } : {}),
        };
        await saveNafathVerification(updated);

        if (internalStatus === 'Verified') {
          SoundService.play('success');
          showSuccess(`✅ ${record.customerName} — Identity verified by Nafath!`);
        } else if (internalStatus === 'Rejected') {
          showError(`❌ ${record.customerName} — Nafath verification rejected.`);
        } else {
          showInfo(`⏰ ${record.customerName} — Nafath verification expired.`);
        }
        load();
      } catch (err) {
        // Network hiccup — keep polling
        console.warn('Nafath poll error (will retry):', err);
      }
    }, 5000); // poll every 5 seconds

    pollingRefs.current[transId] = intervalId;

    // Auto-stop polling after expiresAt + 30 s grace
    if (record.expiresAt) {
      const ttl = record.expiresAt - Date.now() + 30_000;
      if (ttl > 0) {
        setTimeout(() => {
          if (pollingRefs.current[transId]) {
            clearInterval(pollingRefs.current[transId]);
            delete pollingRefs.current[transId];
          }
        }, ttl);
      }
    }
  }, []);

  /** Create a new verification via the real Nafath API */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!formData.customerName || !formData.nationalId) {
      showError('Customer name and National ID are required');
      return;
    }
    if (!validateNationalId(formData.nationalId)) {
      showError('Invalid National ID / Iqama number. Must be 10 digits starting with 1 or 2.');
      return;
    }

    if (editId) {
      // Simple edit (status/name only — not a re-initiation)
      const updated = { ...formData, id: editId };
      try {
        await saveNafathVerification(updated);
        showSuccess('Verification record updated');
        setIsFormOpen(false);
        setEditId(null);
        setFormData({ customerName: '', nationalId: '', status: 'Pending' });
        load();
      } catch (err: any) { showError(err.message || 'Failed to update'); }
      return;
    }

    // ── New request: call Nafath API ──────────────────────────────────────
    let nafathResult: Awaited<ReturnType<typeof initiateNafathVerification>>;
    try {
      nafathResult = await initiateNafathVerification(formData.nationalId);
    } catch (err: any) {
      const guide: string = (err as any).guide || '';
      showError(
        guide
          ? `Nafath credentials not configured. ${guide}`
          : (err.message || 'Failed to reach Nafath API')
      );
      if ((err as any).guide) setShowSettings(true);
      return;
    }

    const record: NafathVerification = {
      id: crypto.randomUUID(),
      customerId: formData.customerId || '',
      customerName: formData.customerName,
      nationalId: formData.nationalId,
      requestId: nafathResult.transId,           // real Nafath transId
      verificationCode: String(nafathResult.random), // real random number
      status: 'Pending',
      createdAt: Date.now(),
      createdBy: 'system',
      expiresAt: Date.now() + 3 * 60 * 1000,    // Nafath window ≈ 3 minutes
      responseData: JSON.stringify(nafathResult),
    };

    try {
      await saveNafathVerification(record);
      showSuccess('Nafath verification request sent! Ask the tenant to approve in the Nafath app.');
      setIsFormOpen(false);
      setFormData({ customerName: '', nationalId: '', status: 'Pending' });
      load();
      // Start polling immediately
      startPolling(record);
    } catch (err: any) { showError(err.message || 'Failed to save verification'); }
  };

  const handleEdit = (v: NafathVerification) => { setFormData(v); setEditId(v.id); setIsFormOpen(true); };

  const handleDelete = (id: string) => {
    setConfirmMsg('Delete this verification record?');
    setConfirmAction(() => async () => { await deleteNafathVerification(id); showSuccess('Record deleted'); load(); });
    setConfirmOpen(true);
  };

  /** Manual re-poll for an already WAITING record */
  const handleRePoll = async (v: NafathVerification) => {
    if (!v.requestId || !v.verificationCode) {
      showError('No transaction ID — cannot re-poll');
      return;
    }
    try {
      const result = await checkNafathStatus(v.nationalId, v.requestId, Number(v.verificationCode));
      const internalStatus = toInternalStatus(result.status);
      if (internalStatus !== 'Pending') {
        const updated: NafathVerification = {
          ...v,
          status: internalStatus,
          responseData: JSON.stringify(result),
          ...(internalStatus === 'Verified' ? { verifiedAt: Date.now() } : {}),
        };
        await saveNafathVerification(updated);
        showSuccess(`Status updated: ${internalStatus}`);
        load();
      } else {
        showInfo('Still waiting for tenant to approve in Nafath app…');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to check status');
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nafathAppId.trim() || !nafathAppKey.trim()) {
      showError('Both App ID and App Key are required');
      return;
    }
    setSavingCreds(true);
    try {
      await saveNafathCredentials(nafathAppId.trim(), nafathAppKey.trim());
      showSuccess('Nafath credentials saved');
      setNafathAppId('');
      setNafathAppKey('');
      setShowSettings(false);
      const creds = await getNafathCredentialsMasked();
      setCredStatus(creds);
    } catch (err: any) {
      showError(err.message || 'Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  const selectCustomer = (customerId: string) => {
    const c = customers.find(cu => cu.id === customerId);
    if (!c) return;
    setFormData({ ...formData, customerId: c.id, customerName: formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber), nationalId: c.idNo || '' });
  };

  const filtered = verifications.filter(v => {
    const matchSearch = !search || v.customerName.toLowerCase().includes(search.toLowerCase()) || v.nationalId.includes(search);
    const matchStatus = !filterStatus || v.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const stats = {
    total: verifications.length,
    verified: verifications.filter(v => v.status === 'Verified').length,
    pending: verifications.filter(v => v.status === 'Pending').length,
    rejected: verifications.filter(v => v.status === 'Rejected').length,
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Fingerprint className="text-emerald-600" /> Nafath Verification <span className="text-sm font-normal text-slate-400">نفاذ</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            Saudi national digital identity verification
            {credStatus?.hasCredentials
              ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><Wifi size={12} /> Live API connected</span>
              : <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><WifiOff size={12} /> Credentials not configured</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1"
          >
            <Settings size={14} /> API Settings
          </button>
          <button
            onClick={() => { setFormData({ customerName: '', nationalId: '', status: 'Pending' }); setEditId(null); setIsFormOpen(true); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1"
          >
            <Plus size={14} /> New Verification
          </button>
        </div>
      </div>

      {/* ── Credentials Settings Panel ── */}
      {showSettings && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 animate-fade-in">
          <h3 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2"><ShieldCheck size={16} /> Nafath API Credentials</h3>
          <p className="text-xs text-blue-700 mb-3">
            Obtain your <strong>App ID</strong> and <strong>App Key</strong> from the{' '}
            <a href="https://developer.elm.sa" target="_blank" rel="noopener noreferrer" className="underline">ELM Developer Portal</a>.
            These are stored securely in Firestore and used by the Cloud Function — never exposed in the browser.
            {credStatus?.hasCredentials && (
              <span className="block mt-1 text-emerald-700 font-semibold">
                ✅ Credentials saved (App ID: {credStatus.maskedAppId})
              </span>
            )}
          </p>
          <form onSubmit={handleSaveCredentials} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="App ID"
              value={nafathAppId}
              onChange={e => setNafathAppId(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
            />
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="App Key"
                value={nafathAppKey}
                onChange={e => setNafathAppKey(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm pr-9"
              />
              <button type="button" onClick={() => setShowKey(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={savingCreds}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              {savingCreds ? 'Saving…' : 'Save Credentials'}
            </button>
          </form>
          <p className="text-xs text-blue-500 mt-2">
            Alternatively, set <code className="bg-blue-100 px-1 rounded">NAFATH_APP_ID</code> and{' '}
            <code className="bg-blue-100 px-1 rounded">NAFATH_APP_KEY</code> as Firebase Function environment variables.
          </p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.total}</div><div className="text-xs text-slate-500">Total Requests</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.verified}</div><div className="text-xs text-slate-500">Verified</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.pending}</div><div className="text-xs text-slate-500">{t('common.pending')}</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.rejected}</div><div className="text-xs text-slate-500">{t('common.rejected')}</div></div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
          <option value="">{t('history.allStatus')}</option>
          <option>Pending</option>
          <option>Verified</option>
          <option>Rejected</option>
          <option>Expired</option>
        </select>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Fingerprint size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">No verification records found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => {
            const Icon = STATUS_ICONS[v.status] || Clock;
            const isPolling = v.requestId ? !!pollingRefs.current[v.requestId] : false;
            return (
              <div key={v.id} className="ios-card p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_COLORS[v.status]}`}>
                        <Icon size={12} />
                        {v.status}
                        {isPolling && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block ml-1" />}
                      </span>
                      {v.requestId && (
                        <span className="text-xs text-slate-400 font-mono truncate max-w-[160px]" title={v.requestId}>
                          {v.requestId.slice(0, 12)}…
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800">{formatCustomerFromMap(v.customerName, (v as any).customerId, buildCustomerRoomMap(customers))}</h3>
                    <p className="text-sm text-slate-500">National ID: {v.nationalId}</p>

                    {/* Random number / verification code shown to user */}
                    {v.verificationCode && v.status === 'Pending' && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 inline-block">
                        <p className="text-xs text-blue-600 font-semibold mb-1">Nafath Verification Code</p>
                        <p className="text-4xl font-black text-blue-800 tracking-widest leading-none">{v.verificationCode}</p>
                        <p className="text-xs text-blue-400 mt-1">أدخل هذا الرقم في تطبيق نفاذ</p>
                        {v.expiresAt && v.expiresAt > Date.now() && (
                          <div className="mt-1.5">
                            <Countdown expiresAt={v.expiresAt} />
                          </div>
                        )}
                        {isPolling && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <RefreshCw size={10} className="animate-spin" />
                            Auto-checking every 5 s…
                          </div>
                        )}
                      </div>
                    )}

                    {v.verifiedAt && (
                      <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                        <CheckCircle size={12} /> Verified at: {new Date(v.verifiedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</p>
                    <div className="flex gap-1 mt-2 justify-end flex-wrap">
                      {v.status === 'Pending' && v.requestId && (
                        <button
                          onClick={() => handleRePoll(v)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs flex items-center gap-1"
                          title="Check Nafath status now"
                        >
                          <RefreshCw size={13} /> Check
                        </button>
                      )}
                      <button onClick={() => handleEdit(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New / Edit Form Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Fingerprint size={20} className="text-emerald-600" />
                {editId ? 'Edit Verification' : 'New Nafath Verification'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            {!editId && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                <strong>How it works:</strong> Submitting this form sends a real verification request to the Nafath API.
                The tenant will receive a push notification in their <strong>Nafath (نفاذ) app</strong> and must confirm
                the displayed number. Status updates automatically every 5 seconds.
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {!editId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Select Customer (optional)</label>
                  <select onChange={e => selectCustomer(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                    <option value="">Choose customer…</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{formatNameWithRoom(c.nameAr || c.nameEn, c.roomNumber)} ({c.idNo})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              {!editId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">National ID / Iqama *</label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={e => setFormData({ ...formData, nationalId: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                    maxLength={10}
                    required
                    placeholder="1xxxxxxxxx or 2xxxxxxxxx"
                  />
                  <p className="text-xs text-slate-400 mt-1">10 digits starting with 1 (Saudi ID) or 2 (Iqama)</p>
                </div>
              )}
              {editId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  >
                    <option>Pending</option>
                    <option>Verified</option>
                    <option>Rejected</option>
                    <option>Expired</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">
                  {editId ? 'Update' : 'Send Nafath Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('common.confirm')}
        message={confirmMsg}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
        danger
      />
    </div>
  );
};

export default NafathVerificationPage;

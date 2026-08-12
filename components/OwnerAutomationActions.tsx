import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock3, History, Loader2,
  RefreshCw, RotateCcw, ShieldCheck, XCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n';
import {
  cancelOwnerCommand,
  confirmOwnerCommand,
  getOwnerAction,
  getOwnerActions,
  getOwnerReversalRequests,
  OwnerAutomationError,
  prepareOwnerActionReversal,
} from '../services/ownerAutomationService';
import type {
  OwnerActionDetail,
  OwnerActionFilters,
  OwnerActionSummary,
  OwnerReversalRequest,
  PreparedRollback,
} from '../services/ownerAutomationTypes';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const cardClass = 'rounded-2xl border border-slate-100 bg-white shadow-sm';

function displayDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed' || status === 'rejected' || status === 'reconciliation_needed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'cancelled' || status === 'expired') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass(status)}`}>
    {status.replaceAll('_', ' ')}
  </span>
);

const JsonViewer = ({ value, empty }: { value: unknown; empty: string }) => {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  return (
    <pre dir="ltr" className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
      {text === undefined || text === 'null' ? empty : text}
    </pre>
  );
};

const OwnerAutomationActions: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [filters, setFilters] = useState<OwnerActionFilters>({ limit: 50 });
  const [actions, setActions] = useState<readonly OwnerActionSummary[]>([]);
  const [requests, setRequests] = useState<readonly OwnerReversalRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<OwnerActionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [prepared, setPrepared] = useState<PreparedRollback | null>(null);
  const [mutating, setMutating] = useState(false);
  const [notice, setNotice] = useState('');

  const safeMessage = useCallback((value: unknown) => (
    value instanceof OwnerAutomationError ? value.message : t('ownerAutomation.error.generic')
  ), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [actionPage, reversalRequests] = await Promise.all([
        getOwnerActions(filters),
        getOwnerReversalRequests(),
      ]);
      setActions(actionPage.items);
      setRequests(reversalRequests);
      setSelectedId(current => {
        if (current && !actionPage.items.some(item => item.id === current)) {
          setDetail(null);
          return '';
        }
        return current;
      });
    } catch (loadError) {
      setError(safeMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters, safeMessage]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setDetailLoading(true);
    setError('');
    setPrepared(null);
    setReason('');
    getOwnerAction(selectedId)
      .then(value => { if (active) setDetail(value); })
      .catch(loadError => { if (active) setError(safeMessage(loadError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [safeMessage, selectedId]);

  useEffect(() => {
    if (!prepared) return;
    const remaining = new Date(prepared.confirmationExpiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      setPrepared(null);
      setNotice(t('ownerAutomation.rollback.expired'));
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [prepared, t]);

  useEffect(() => () => setPrepared(null), []);

  const updateFilter = (key: keyof OwnerActionFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value || undefined }));
  };

  const prepareRollback = async () => {
    if (!detail || reason.trim().length < 3) return;
    setMutating(true);
    setError('');
    setNotice('');
    try {
      setPrepared(await prepareOwnerActionReversal(detail.id, reason));
    } catch (prepareError) {
      setError(safeMessage(prepareError));
    } finally {
      setMutating(false);
    }
  };

  const confirmRollback = async () => {
    if (!prepared) return;
    setMutating(true);
    setError('');
    try {
      const result = await confirmOwnerCommand(prepared.commandId, prepared.confirmationToken);
      setPrepared(null);
      setReason('');
      setNotice(result.reconciliationNeeded
        ? t('ownerAutomation.rollback.confirmedReconciliation')
        : t('ownerAutomation.rollback.confirmed'));
      await load();
      if (selectedId) setDetail(await getOwnerAction(selectedId));
    } catch (confirmError) {
      setPrepared(null);
      setError(safeMessage(confirmError));
    } finally {
      setMutating(false);
    }
  };

  const cancelRollback = async () => {
    if (!prepared) return;
    setMutating(true);
    setError('');
    try {
      await cancelOwnerCommand(prepared.commandId);
      setPrepared(null);
      setNotice(t('ownerAutomation.rollback.cancelled'));
      await load();
    } catch (cancelError) {
      setPrepared(null);
      setError(safeMessage(cancelError));
    } finally {
      setMutating(false);
    }
  };

  const filterFields: { key: keyof OwnerActionFilters; label: string; placeholder: string }[] = [
    { key: 'tenantId', label: t('ownerAutomation.filter.tenant'), placeholder: t('ownerAutomation.filter.tenant') },
    { key: 'projectId', label: t('ownerAutomation.filter.projectBuyer'), placeholder: t('ownerAutomation.filter.projectBuyer') },
    { key: 'bookId', label: t('ownerAutomation.filter.book'), placeholder: t('ownerAutomation.filter.book') },
    { key: 'adapter', label: t('ownerAutomation.filter.adapter'), placeholder: t('ownerAutomation.filter.adapter') },
    { key: 'actionId', label: t('ownerAutomation.filter.action'), placeholder: t('ownerAutomation.filter.action') },
  ];

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className={`${cardClass} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-slate-800">
              <History size={18} className="text-blue-600" /> {t('ownerAutomation.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-400">{t('ownerAutomation.subtitle')}</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('ownerAutomation.refresh')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {filterFields.map(field => (
            <label key={field.key} className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {field.label}
              <input
                className={`${inputClass} mt-1 normal-case`}
                value={String(filters[field.key] || '')}
                onChange={event => updateFilter(field.key, event.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          ))}
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('ownerAutomation.filter.status')}
            <select className={`${inputClass} mt-1 normal-case`} value={filters.status || ''} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">{t('common.all')}</option>
              {['completed', 'prepared', 'executing', 'pending', 'failed', 'cancelled', 'reconciliation_needed'].map(status => (
                <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('ownerAutomation.filter.from')}
            <input type="date" className={`${inputClass} mt-1`} value={filters.dateFrom || ''} onChange={event => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('ownerAutomation.filter.to')}
            <input type="date" className={`${inputClass} mt-1`} value={filters.dateTo || ''} onChange={event => updateFilter('dateTo', event.target.value)} />
          </label>
          <button onClick={() => setFilters({ limit: 50 })} className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">
            {t('ownerAutomation.filter.clear')}
          </button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><XCircle size={16} />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700"><CheckCircle2 size={16} />{notice}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <section className={`${cardClass} min-h-[320px] overflow-hidden`}>
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
            {t('ownerAutomation.list')} <span className="text-slate-300">({actions.length})</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-400"><Loader2 size={17} className="animate-spin" />{t('common.loading')}</div>
          ) : actions.length === 0 ? (
            <p className="p-12 text-center text-xs text-slate-400">{t('ownerAutomation.empty')}</p>
          ) : (
            <div className="max-h-[720px] divide-y divide-slate-50 overflow-auto">
              {actions.map(action => (
                <button key={action.id} onClick={() => setSelectedId(action.id)} className={`w-full p-4 text-start transition hover:bg-blue-50/40 ${selectedId === action.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2"><StatusBadge status={action.status} /> <span className="text-[10px] font-semibold text-slate-400">{action.adapter}</span></div>
                      <p className="truncate text-sm font-bold text-slate-700">{action.summary}</p>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{action.actionId}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{displayDate(action.createdAt)} · {action.bookId}</p>
                    </div>
                    <ChevronRight size={15} className={`mt-2 shrink-0 text-slate-300 ${isRTL ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`${cardClass} min-h-[320px] p-4 sm:p-5`}>
          {!selectedId ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-slate-300">
              <ShieldCheck size={34} /><p className="mt-3 text-xs font-bold">{t('ownerAutomation.select')}</p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex min-h-[280px] items-center justify-center gap-2 text-xs text-slate-400"><Loader2 size={17} className="animate-spin" />{t('common.loading')}</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} /><span className="font-mono text-[10px] text-slate-400">{detail.commandId}</span></div>
                <h3 className="mt-2 text-lg font-black text-slate-800">{detail.summary}</h3>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  {[
                    [t('ownerAutomation.target'), detail.exactTarget],
                    [t('ownerAutomation.action'), detail.actionId],
                    [t('ownerAutomation.book'), detail.bookId],
                    [t('ownerAutomation.adapter'), detail.adapter],
                  ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><dt className="text-[9px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-0.5 break-all font-semibold text-slate-700">{value}</dd></div>)}
                </dl>
              </div>

              {detail.reconciliationNeeded && (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  <AlertTriangle size={17} className="shrink-0" /> {t('ownerAutomation.reconciliationWarning')}
                </div>
              )}

              <div>
                <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{t('ownerAutomation.beforeAfter')}</h4>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div><p className="mb-1 text-[10px] font-bold text-slate-400">{t('ownerAutomation.before')}</p><JsonViewer value={detail.before} empty={t('ownerAutomation.none')} /></div>
                  <div><p className="mb-1 text-[10px] font-bold text-slate-400">{t('ownerAutomation.after')}</p><JsonViewer value={detail.after} empty={t('ownerAutomation.none')} /></div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{t('ownerAutomation.audit')}</h4>
                {detail.auditEntries.length === 0 ? <p className="text-xs text-slate-400">{t('ownerAutomation.none')}</p> : (
                  <div className="space-y-2">
                    {detail.auditEntries.map(entry => (
                      <details key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-xs font-bold text-slate-700">{entry.operation} · {entry.collectionName}/{entry.documentId}</summary>
                        <p className="my-2 text-[10px] text-slate-400">{displayDate(entry.createdAt)}</p>
                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2"><JsonViewer value={entry.before} empty={t('ownerAutomation.none')} /><JsonViewer value={entry.after} empty={t('ownerAutomation.none')} /></div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h4 className="flex items-center gap-2 text-sm font-black text-amber-900"><RotateCcw size={16} />{t('ownerAutomation.rollback.title')}</h4>
                {detail.rollbackSupport === 'unsupported' ? (
                  <p className="mt-2 text-xs text-amber-800">{detail.rollbackReason || t('ownerAutomation.rollback.unsupported')}</p>
                ) : !prepared ? (
                  <div className="mt-3">
                    {detail.rollbackReason && <p className="mb-2 text-xs text-amber-800">{detail.rollbackReason}</p>}
                    <label className="text-[10px] font-bold uppercase text-amber-800">{t('ownerAutomation.rollback.reason')}</label>
                    <textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} className={`${inputClass} mt-1 min-h-20`} placeholder={t('ownerAutomation.rollback.reasonPlaceholder')} />
                    <button disabled={mutating || reason.trim().length < 3} onClick={() => void prepareRollback()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                      {mutating && <Loader2 size={14} className="animate-spin" />}{t('ownerAutomation.rollback.prepare')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-amber-300 bg-white p-3 text-xs text-slate-700">
                      <p><strong>{t('ownerAutomation.target')}:</strong> {prepared.preview.exactTarget}</p>
                      <p className="mt-1"><strong>{t('ownerAutomation.preview.summary')}:</strong> {prepared.preview.summary}</p>
                      <p className="mt-2 font-bold">{t('ownerAutomation.preview.sideEffects')}</p>
                      {prepared.preview.sideEffects.length ? <ul className="mt-1 list-inside list-disc space-y-1">{prepared.preview.sideEffects.map(effect => <li key={effect}>{effect}</li>)}</ul> : <p className="mt-1">{t('ownerAutomation.none')}</p>}
                      <p className="mt-2"><strong>{t('ownerAutomation.preview.rollback')}:</strong> {prepared.preview.rollback}</p>
                      <p className="mt-1"><strong>{t('ownerAutomation.preview.checkpoint')}:</strong> {prepared.preview.checkpoint ? t('common.yes') : t('common.no')}</p>
                      <p className="mt-1 flex items-center gap-1 text-red-700"><Clock3 size={13} /><strong>{t('ownerAutomation.preview.expires')}:</strong> {displayDate(prepared.confirmationExpiresAt)}</p>
                    </div>
                    <p className="text-xs font-bold text-red-700">{t('ownerAutomation.rollback.confirmWarning')}</p>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={mutating} onClick={() => void confirmRollback()} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                        {mutating && <Loader2 size={14} className="animate-spin" />}{t('ownerAutomation.rollback.confirm')}
                      </button>
                      <button disabled={mutating} onClick={() => void cancelRollback()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {t('ownerAutomation.rollback.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">{t('ownerAutomation.requests')}</div>
        {requests.length === 0 ? <p className="p-8 text-center text-xs text-slate-400">{t('ownerAutomation.requestsEmpty')}</p> : (
          <div className="divide-y divide-slate-50">
            {requests.map(requestItem => (
              <div key={requestItem.id} className="grid grid-cols-1 gap-2 p-4 text-xs sm:grid-cols-[1fr_auto]">
                <div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={requestItem.status} /><span className="font-mono text-[10px] text-slate-400">{requestItem.actionId}</span></div><p className="mt-2 font-semibold text-slate-700">{requestItem.reason}</p></div>
                <div className="text-slate-400 sm:text-end">{displayDate(requestItem.requestedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default OwnerAutomationActions;

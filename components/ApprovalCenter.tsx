import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, Check, X, Trash2, Edit3, FileSignature, Clock, User, AlertTriangle, RefreshCw, Shield, ChevronDown, ChevronUp, Zap, Sparkles, Building2, CreditCard, CalendarDays, Tag, Hash, FileText, DollarSign, ArrowRightLeft, Eye, KeyRound } from 'lucide-react';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import { formatCustomerFromMap } from '../utils/customerDisplay';

interface Approval {
  id: string;
  type: string;
  targetId: string;
  targetCollection: string;
  requestedBy: string;
  requestedAt: number;
  status: string;
  payload?: any;
  handledBy?: string;
  handledAt?: number;
}

interface ApprovalCenterProps {
  currentUser: any;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  transaction_delete: { label: 'Delete Transaction', icon: Trash2, color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200' },
  transaction_edit: { label: 'Edit Transaction', icon: Edit3, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  contract_finalize: { label: 'Finalize Contract', icon: FileSignature, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  contract_delete: { label: 'Delete Contract', icon: Trash2, color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200' },
  password_reset: { label: 'Password Reset', icon: KeyRound, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
};

const formatTime = (ts: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDate = (s: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
};

const fmtAmount = (v: any) => {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' SAR';
};

// ── Detail Row helper ──
const DRow: React.FC<{ icon?: any; label: string; value: any; highlight?: boolean; color?: string }> = ({ icon: Icon, label, value, highlight, color }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {Icon && <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color || 'text-slate-400'}`} />}
      {!Icon && <div className="w-3.5" />}
      <span className="text-[11px] font-bold text-slate-500 min-w-[85px] sm:min-w-[110px]">{label}</span>
      <span className={`text-[11px] break-all ${highlight ? 'font-black text-emerald-700' : 'font-semibold text-slate-800'}`}>{String(value)}</span>
    </div>
  );
};

// ── Rich Transaction / Contract Detail View ──
const TransactionDetailView: React.FC<{ payload: any; type: string; users: Record<string, string> }> = ({ payload, type, users }) => {
  const { t } = useLanguage();
  const p = payload || {};
  const { language } = useLanguage();
  const fmtDateLocale = (s: string) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
  };

  // Transaction delete or edit
  if (type === 'transaction_delete' || type === 'transaction_edit') {
    const isIncome = p.type === 'INCOME' || p.type === 'Income';
    const isExpense = p.type === 'EXPENSE' || p.type === 'Expense';
    const catLabel = p.expenseCategory || p.incomeSubType || (isIncome ? 'Income' : isExpense ? 'Expense' : p.type || '—');
    const payMap: Record<string, string> = { CASH: 'Cash', BANK: 'Bank Transfer', CHEQUE: 'Cheque' };
    const payLabel = payMap[p.paymentMethod] || p.paymentMethod || '—';
    const creatorName = users[p.createdBy] || p.createdByName || p.createdBy || '—';

    return (
      <div className="space-y-3">
        {/* Amount hero */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${isIncome ? 'bg-emerald-50/80 border-emerald-200/60' : 'bg-rose-50/80 border-rose-200/60'}`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{isIncome ? t('approval.incomeLabel') : isExpense ? t('approval.expenseLabel') : t('approval.transactionLabel')}</div>
            <div className={`text-xl sm:text-2xl font-black mt-0.5 ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
              {fmtAmount(p.amount)}
            </div>
          </div>
          <div className={`p-3 rounded-2xl ${isIncome ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <DollarSign className={`w-6 h-6 ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
        </div>

        {/* Core details */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 space-y-0.5 border border-slate-100">
          <DRow icon={CalendarDays} label={t('common.date')} value={fmtDateLocale(p.date)} />
          <DRow icon={Tag} label={t('entry.categoryShort')} value={catLabel} />
          <DRow icon={Building2} label={t('entry.building')} value={p.buildingName || p.buildingId || undefined} />
          {p.unitNumber && <DRow icon={Hash} label={t('entry.unit')} value={p.unitNumber} />}
          <DRow icon={CreditCard} label={t('history.payment')} value={payLabel} />
          {p.bankName && <DRow icon={CreditCard} label={t('history.bank')} value={p.bankName} />}
          {p.chequeNo && <DRow icon={Hash} label={t('approval.chequeNo')} value={p.chequeNo} />}
          {p.chequeDueDate && <DRow icon={CalendarDays} label={t('approval.chequeDue')} value={fmtDateLocale(p.chequeDueDate)} />}
          {p.customerName && <DRow icon={User} label={t('history.customer')} value={formatCustomerFromMap(p.customerName, (p as any).customerId, customerRoomMap)} />}
          {p.vendorName && <DRow icon={User} label={t('entry.vendor')} value={p.vendorName} />}
          {p.employeeName && <DRow icon={User} label={t('approval.employeeLabel')} value={p.employeeName} />}
          {p.ownerName && <DRow icon={User} label={t('approval.ownerLabel')} value={p.ownerName} />}
          {p.salaryPeriod && <DRow icon={CalendarDays} label={t('approval.salaryPeriodLabel')} value={p.salaryPeriod} />}
        </div>

        {/* Financial extras */}
        {(p.vatAmount || p.discountAmount || p.extraAmount || p.totalWithVat) && (
          <div className="bg-blue-50/60 rounded-xl p-3.5 space-y-0.5 border border-blue-100">
            {p.vatAmount && <DRow icon={Tag} label={t('entry.vat15')} value={fmtAmount(p.vatAmount)} color="text-blue-400" />}
            {p.totalWithVat && <DRow icon={DollarSign} label={t('approval.totalWithVat')} value={fmtAmount(p.totalWithVat)} highlight color="text-blue-500" />}
            {p.discountAmount && Number(p.discountAmount) > 0 && <DRow icon={ArrowRightLeft} label={t('approval.discountLabel')} value={fmtAmount(p.discountAmount)} color="text-amber-500" />}
            {p.extraAmount && Number(p.extraAmount) > 0 && <DRow icon={ArrowRightLeft} label={t('approval.extraAmountLabel')} value={fmtAmount(p.extraAmount)} color="text-emerald-500" />}
          </div>
        )}

        {/* Details / Notes */}
        {p.details && (
          <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-100">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">{t('entry.detailsNotes')}</div>
                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{p.details}</p>
              </div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 pt-1">
          <span>{t('approval.createdBy')} <strong className="text-slate-500">{creatorName}</strong></span>
          {p.createdAt && <span>{t('approval.onDate')} {new Date(p.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
          <span className="font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">ID: {p.id?.slice(0, 12) || '—'}</span>
        </div>

        {/* Edit diff — for transaction_edit, show what changed */}
        {type === 'transaction_edit' && p._changes && (
          <div className="bg-violet-50/60 rounded-xl p-3.5 border border-violet-100 space-y-2">
            <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> {t('approval.proposedChanges')}
            </div>
            {Object.entries(p._changes).map(([k, v]: [string, any]) => (
              <div key={k} className="flex items-start gap-2 text-[11px]">
                <span className="font-bold text-violet-500 min-w-[85px] capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-slate-400 line-through text-[10px]">{String(v?.old ?? '—')}</span>
                <span className="text-violet-700 font-semibold">→ {String(v?.new ?? '—')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Contract finalize or delete
  if (type === 'contract_finalize' || type === 'contract_delete') {
    return (
      <div className="space-y-3">
        {/* Contract header */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/80 border border-blue-200/60">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('approval.contractLabel')}</div>
            <div className="text-lg sm:text-xl font-black text-blue-800 mt-0.5">
              {p.contractNo || p.id?.slice(0, 10) || '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-500 uppercase">{t('contract.totalValue')}</div>
            <div className="text-lg font-black text-emerald-700">{fmtAmount(p.totalValue || p.rentValue)}</div>
          </div>
        </div>

        {/* Contract core details */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 space-y-0.5 border border-slate-100">
          <DRow icon={CalendarDays} label={t('contract.contractDate')} value={fmtDateLocale(p.contractDate)} />
          <DRow icon={Building2} label={t('entry.building')} value={p.buildingName || p.buildingId || undefined} />
          {p.unitName && <DRow icon={Hash} label={t('entry.unit')} value={p.unitName} />}
          <DRow icon={User} label={t('contract.tenant')} value={p.customerName ? formatCustomerFromMap(p.customerName, (p as any).customerId, customerRoomMap) : (p.customerId || undefined)} />
          <DRow icon={CalendarDays} label={t('invoice.from')} value={fmtDateLocale(p.fromDate)} />
          <DRow icon={CalendarDays} label={t('approval.toDate')} value={fmtDateLocale(p.toDate)} />
          {p.periodMonths && <DRow icon={Clock} label={t('contract.period')} value={`${p.periodMonths} months${p.periodDays ? ` ${p.periodDays} days` : ''}`} />}
          {p.status && <DRow icon={Tag} label={t('common.status')} value={p.status} />}
        </div>

        {/* Financial breakdown */}
        <div className="bg-emerald-50/60 rounded-xl p-3.5 space-y-0.5 border border-emerald-100">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">{t('contract.financialBreakdown')}</div>
          <DRow icon={DollarSign} label={t('approval.rentYearly')} value={fmtAmount(p.rentValue)} highlight color="text-emerald-500" />
          {Number(p.waterFee) > 0 && <DRow label={t('approval.waterFee')} value={fmtAmount(p.waterFee)} />}
          {Number(p.internetFee) > 0 && <DRow label={t('approval.internetFee')} value={fmtAmount(p.internetFee)} />}
          {Number(p.insuranceFee) > 0 && <DRow label={t('contract.insuranceFee')} value={fmtAmount(p.insuranceFee)} />}
          {Number(p.serviceFee) > 0 && <DRow label={t('contract.serviceFee')} value={fmtAmount(p.serviceFee)} />}
          {Number(p.officePercent) > 0 && <DRow label={t('contract.officePercent')} value={`${p.officePercent}% (${fmtAmount(p.officeFeeAmount)})`} />}
          {Number(p.otherDeduction) > 0 && <DRow label={t('approval.deductionsLabel')} value={fmtAmount(p.otherDeduction)} />}
          {Number(p.otherAmount) > 0 && <DRow label={t('contract.otherAmount')} value={fmtAmount(p.otherAmount)} />}
          {Number(p.upfrontPaid) > 0 && <DRow label={t('approval.upfrontPaid')} value={fmtAmount(p.upfrontPaid)} />}
          <div className="border-t border-emerald-200/60 mt-2 pt-2">
            <DRow icon={DollarSign} label={t('contract.totalValue')} value={fmtAmount(p.totalValue)} highlight color="text-emerald-600" />
          </div>
        </div>

        {/* Installments */}
        {p.installmentCount && (
          <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-100">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">{t('contract.installments')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/70 rounded-lg p-2.5 text-center border border-blue-100">
                <div className="text-lg font-black text-blue-700">{p.installmentCount}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">{t('approval.countLabel')}</div>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5 text-center border border-blue-100">
                <div className="text-sm font-black text-blue-700">{fmtAmount(p.firstInstallment)}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase">{t('approval.firstInstallment')}</div>
              </div>
            </div>
            {p.otherInstallment && Number(p.otherInstallment) > 0 && (
              <div className="mt-2 text-[11px] text-slate-600 font-medium text-center">
                Other installments: <strong>{fmtAmount(p.otherInstallment)}</strong>{t('entry.each')}</div>
            )}
          </div>
        )}

        {/* Notes */}
        {p.notes && (
          <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-100">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">{t('common.notes')}</div>
                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{p.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 pt-1">
          <span>{t('approval.createdBy')} <strong className="text-slate-500">{users[p.createdBy] || p.createdBy || '—'}</strong></span>
          <span className="font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">ID: {p.id?.slice(0, 12) || '—'}</span>
        </div>
      </div>
    );
  }

  // Password reset request
  if (type === 'password_reset') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-orange-50/80 border border-orange-200/60">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('approval.passwordResetRequest')}</div>
            <div className="text-xl font-black text-orange-700 mt-0.5">{p.userName || p.userId || '—'}</div>
          </div>
          <div className="p-3 rounded-2xl bg-orange-100">
            <KeyRound className="w-6 h-6 text-orange-600" />
          </div>
        </div>
        <div className="bg-slate-50/80 rounded-xl p-3.5 space-y-0.5 border border-slate-100">
          <DRow icon={User} label={t('approval.staffId')} value={p.userId} />
          <DRow icon={User} label={t('approval.staffName')} value={p.userName} />
        </div>
        <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-100">
          <div className="flex items-start gap-2">
            <KeyRound className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">{t('approval.requestedNewPassword')}</div>
              <p className="text-sm text-slate-800 font-mono font-bold bg-white/70 px-3 py-1.5 rounded-lg border border-amber-200 inline-block">{p.newPassword || '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-100">
          <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {t('approval.passwordWarning')}
          </p>
        </div>
      </div>
    );
  }

  // Fallback: generic key/value display
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
      {Object.entries(p).filter(([k]) => !k.startsWith('_')).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-[11px]">
          <span className="font-bold text-slate-500 min-w-[90px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
          <span className="text-slate-800 break-all font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        </div>
      ))}
    </div>
  );
};

const ApprovalCenter: React.FC<ApprovalCenterProps> = ({ currentUser }) => {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { t, isRTL, language } = useLanguage();

  const formatTimeLocale = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('approval.justNow');
    if (diffMin < 60) return `${diffMin}${t('approval.minsAgo')}`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}${t('approval.hoursAgo')}`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}${t('approval.daysAgo')}`;
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getTypeLabel = (type: string): string => {
    const typeLabels: Record<string, string> = {
      transaction_delete: t('approval.deleteTransaction'),
      transaction_edit: t('approval.editTransaction'),
      contract_finalize: t('approval.finalizeContract'),
      contract_delete: t('approval.deleteContract'),
      password_reset: t('approval.passwordReset'),
    };
    return typeLabels[type] || type;
  };

  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const [fetchedPayloads, setFetchedPayloads] = useState<Record<string, any>>({});
  const [customerRoomMap, setCustomerRoomMap] = useState<Record<string, string>>({});

  // Load users for name display
  useEffect(() => {
    (async () => {
      try {
        const svc = await import('../services/firestoreService');
        const allUsers = await svc.getCollection('users');
        const map: Record<string, string> = {};
        (allUsers || []).forEach((u: any) => { map[u.id] = u.name || u.email || u.id; });
        setUsers(map);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Load customers for room-number enriched name display
  useEffect(() => {
    (async () => {
      try {
        const svc = await import('../services/firestoreService');
        const allCustomers = await svc.getCustomers();
        const map: Record<string, string> = {};
        (allCustomers || []).forEach((c: any) => { if (c && c.id && c.roomNumber) map[c.id] = c.roomNumber; });
        setCustomerRoomMap(map);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Real-time listener for approvals
  useEffect(() => {
    let unsub: any = null;
    (async () => {
      try {
        const svc = await import('../services/firestoreService');
        unsub = svc.listenApprovals((arr: any[]) => {
          setApprovals(arr as Approval[]);
          setLoading(false);
        }, filter === 'ALL' ? '' : filter);
      } catch (e) {
        console.error('ApprovalCenter listener error', e);
        setLoading(false);
      }
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [filter]);

  // Fetch missing payload on demand when expanding
  const fetchPayload = useCallback(async (approval: Approval) => {
    if (approval.payload || fetchedPayloads[approval.id]) return;
    try {
      const svc = await import('../services/firestoreService');
      const collName = approval.targetCollection || 'transactions';
      const doc = await svc.getCollection(collName);
      const found = (doc || []).find((d: any) => d.id === approval.targetId);
      if (found) {
        setFetchedPayloads(prev => ({ ...prev, [approval.id]: found }));
      } else {
        setFetchedPayloads(prev => ({ ...prev, [approval.id]: { _notFound: true, targetId: approval.targetId } }));
      }
    } catch (e) {
      setFetchedPayloads(prev => ({ ...prev, [approval.id]: { _error: true } }));
    }
  }, [fetchedPayloads]);

  const handleApproval = useCallback(async (approvalId: string, approve: boolean) => {
    if (processing) return;
    SoundService.play(approve ? 'success' : 'delete');
    setProcessing(approvalId);
    setActionMessage(null);
    try {
      const svc = await import('../services/firestoreService');
      await svc.approveRequest(approvalId, currentUser?.id || currentUser?.uid || 'admin', approve);
      setActionMessage({ id: approvalId, type: 'success', text: approve ? t('approval.approvedSuccessfully') : t('approval.rejectedMsg') });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (e: any) {
      setActionMessage({ id: approvalId, type: 'error', text: e.message || 'Action failed' });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setProcessing(null);
    }
  }, [processing, currentUser]);

  // Keep a ref to the latest handleApproval so event listeners always call the current version
  const handleApprovalRef = useRef(handleApproval);
  useEffect(() => { handleApprovalRef.current = handleApproval; }, [handleApproval]);

  // Handle URL params from notification clicks
  useEffect(() => {
    const processUrlAction = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.split('?')[1] || '');
      const action = params.get('action');
      const id = params.get('id');
      if (action && id && (action === 'approve' || action === 'reject')) {
        await handleApprovalRef.current(id, action === 'approve');
        // Clean URL
        window.location.hash = '#/approvals';
      }
    };
    processUrlAction();

    // Re-check URL on hash changes (for notification-driven navigation)
    const onHashChange = () => processUrlAction();
    window.addEventListener('hashchange', onHashChange);

    // Listen for messages from service worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'APPROVAL_ACTION' && event.data.approvalId) {
        const isApprove = event.data.action === 'approve';
        handleApprovalRef.current(event.data.approvalId, isApprove);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  const pending = approvals.filter(a => a.status === 'PENDING');
  const total = approvals.length;

  return (
    <div className="max-w-2xl mx-auto px-1 sm:px-0 pb-24">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 sm:p-8 mb-6 shadow-2xl shadow-emerald-800/15">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-400/10 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t('approval.title')}</h2>
              <p className="text-emerald-100/80 text-xs font-medium mt-0.5">
                {pending.length === 0 ? t('approval.allClear') : `${pending.length} ${t('approval.awaitingReview')}`}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex gap-3 mt-4">
            {[
              { label: t('approval.pendingCount'), count: pending.length, color: 'bg-amber-400/20 text-amber-100 border-amber-400/30' },
              { label: t('approval.total'), count: total, color: 'bg-white/10 text-white/80 border-white/20' },
            ].map(s => (
              <div key={s.label} className={`px-4 py-2 rounded-2xl border backdrop-blur-sm text-xs font-bold ${s.color}`}>
                <span className="text-lg font-black mr-1.5">{s.count}</span>{s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Pills - Floating glass bar */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 px-1 -mx-1 scrollbar-hide">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(f => {
          const isActive = filter === f;
          const pillStyles: Record<string, string> = {
            PENDING: isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' : 'bg-amber-50 text-amber-700 border border-amber-200/60',
            APPROVED: isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-400/25' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
            REJECTED: isActive ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' : 'bg-rose-50 text-rose-600 border border-rose-200/60',
            ALL: isActive ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/25' : 'bg-white text-slate-600 border border-slate-200/60',
          };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex-shrink-0 active:scale-95 ${pillStyles[f]}`}
            >
              {f === 'ALL' ? t('approval.all') : f === 'PENDING' ? t('approval.pending') : f === 'APPROVED' ? t('approval.approved') : t('approval.rejected')}
              {f === 'PENDING' && pending.length > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-white/25' : 'bg-amber-500 text-white'}`}>{pending.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification Permission Banner */}
      {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl p-4 mb-5 flex items-center gap-3 shadow-sm">
          <div className="p-2 bg-blue-100 rounded-xl flex-shrink-0">
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-900">{t('approval.enablePush')}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">{t('approval.enablePushDesc')}</p>
          </div>
          <button
            onClick={async () => {
              const { registerDeviceForPush } = await import('../services/pushNotificationService');
              await registerDeviceForPush(currentUser?.id || 'admin', currentUser?.name || 'Admin', currentUser?.role || 'ADMIN');
            }}
            className="px-4 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 transition-all active:scale-95 flex-shrink-0 shadow-md shadow-blue-600/20"
          >
            {t('approval.enable')}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin" />
          </div>
          <span className="text-emerald-600 font-semibold text-sm mt-4">{t('approval.loadingApprovals')}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && approvals.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-b from-white to-emerald-50/30 rounded-3xl border border-emerald-100/60 shadow-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-[1.75rem] mb-5 shadow-inner">
            <Sparkles className="w-9 h-9 text-emerald-400" />
          </div>
          <h3 className="text-lg font-black text-emerald-900">{t('approval.allClear')}</h3>
          <p className="text-emerald-600/70 text-sm mt-1.5 max-w-[200px] mx-auto">
            {filter === 'PENDING' ? t('approval.noPendingRequests') : `${t('approval.noRequests')}`}
          </p>
        </div>
      )}

      {/* Approval Cards */}
      <div className="space-y-3 animate-stagger">
        {approvals.map((approval, idx) => {
          const config = TYPE_CONFIG[approval.type] || { label: approval.type, icon: Bell, color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200' };
          const Icon = config.icon;
          const requesterName = users[approval.requestedBy] || approval.requestedBy || 'Unknown';
          const isPending = approval.status === 'PENDING';
          const isExpanded = expandedId === approval.id;
          const msg = actionMessage?.id === approval.id ? actionMessage : null;
          const isProcessing = processing === approval.id;
          const effectivePayload = approval.payload || fetchedPayloads[approval.id] || null;

          // Quick summary from payload
          const p = effectivePayload || {};
          const quickAmount = p.amount ? Number(p.amount).toLocaleString() + ' SAR' : null;
          const quickBuilding = p.buildingName || null;
          const quickCustomer = p.customerName
            ? formatCustomerFromMap(p.customerName, p.customerId, customerRoomMap)
            : (p.vendorName || p.employeeName || null);
          const quickDate = p.date || null;
          const quickCategory = p.expenseCategory || p.incomeSubType || null;
          const quickContractNo = p.contractNo || null;

          return (
            <div
              key={approval.id}
              style={{ animationDelay: `${idx * 60}ms` }}
              className={`bg-white rounded-[1.25rem] overflow-hidden transition-all duration-300 animate-fade-in ${
                isPending
                  ? 'border border-slate-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
                  : 'border border-slate-100 opacity-70'
              }`}
            >
              {/* Accent bar */}
              {isPending && (
                <div className={`h-1 ${
                  approval.type.includes('delete') ? 'bg-gradient-to-r from-rose-400 to-rose-500' :
                  approval.type.includes('edit') ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                  'bg-gradient-to-r from-blue-400 to-indigo-500'
                }`} />
              )}

              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
                  <div className={`p-2.5 rounded-2xl flex-shrink-0 ${config.bgColor} border`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-sm">{getTypeLabel(approval.type)}</h4>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        approval.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        approval.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {approval.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-slate-500">
                        <User className="w-3 h-3" /> {requesterName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTimeLocale(approval.requestedAt)}
                      </span>
                    </div>

                    {/* Quick summary from payload */}
                    {(quickAmount || quickBuilding || quickCustomer || quickContractNo) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {quickAmount && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                            <DollarSign className="w-3 h-3" /> {quickAmount}
                          </span>
                        )}
                        {quickBuilding && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                            <Building2 className="w-3 h-3" /> {quickBuilding}
                          </span>
                        )}
                        {quickCustomer && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-100">
                            <User className="w-3 h-3" /> {quickCustomer}
                          </span>
                        )}
                        {quickContractNo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                            <FileSignature className="w-3 h-3" /> #{quickContractNo}
                          </span>
                        )}
                        {quickDate && (
                          <span className="text-[10px] text-slate-400 font-medium">{fmtDate(quickDate)}</span>
                        )}
                        {quickCategory && (
                          <span className="text-[10px] text-slate-400 font-medium">• {quickCategory}</span>
                        )}
                      </div>
                    )}

                    {/* Expand toggle — always show, fetch on demand if payload missing */}
                    <button
                      onClick={() => {
                        const willExpand = expandedId !== approval.id;
                        setExpandedId(willExpand ? approval.id : null);
                        if (willExpand && !approval.payload && !fetchedPayloads[approval.id]) {
                          fetchPayload(approval);
                        }
                      }}
                      className={`flex items-center gap-1.5 text-[11px] mt-2.5 font-bold transition-colors px-2.5 py-1.5 rounded-lg ${
                        isExpanded
                          ? 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                          : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {isExpanded ? t('approval.hideDetails') : t('approval.viewFullDetails')}
                    </button>
                  </div>

                  {/* Action Buttons — stacked vertically on mobile for thumb-friendly tapping */}
                  {isPending && (
                    <div className="flex flex-col gap-2 flex-shrink-0 min-w-[88px]">
                      <button
                        onClick={() => handleApproval(approval.id, true)}
                        disabled={!!processing}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-white text-xs font-black rounded-xl transition-all active:scale-95 shadow-md ${
                          isProcessing ? 'bg-emerald-300' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
                        } disabled:opacity-50`}
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        {t('approval.approve')}
                      </button>
                      <button
                        onClick={() => handleApproval(approval.id, false)}
                        disabled={!!processing}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-rose-600 text-xs font-bold rounded-xl border border-rose-200 hover:bg-rose-50 disabled:opacity-50 transition-all active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" />{t('approval.reject')}</button>
                    </div>
                  )}

                  {/* Handled badge */}
                  {!isPending && approval.handledBy && (
                    <div className="text-right flex-shrink-0 bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">{t('approval.handledBy')}</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">{users[approval.handledBy] || approval.handledBy}</p>
                      {approval.handledAt && <p className="text-[10px] text-slate-400 mt-0.5">{formatTimeLocale(approval.handledAt)}</p>}
                    </div>
                  )}
                </div>

                {/* Action feedback message */}
                {msg && (
                  <div className={`mt-3 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all animate-fade-in ${
                    msg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                  }`}>
                    {msg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {msg.text}
                  </div>
                )}
              </div>

              {/* Expanded Payload Details — Rich Detail View */}
              {isExpanded && (
                <div className="px-4 sm:px-5 pb-5 border-t border-slate-100 animate-fade-in">
                  <p className="text-[10px] font-black text-slate-400 mt-3 mb-3 uppercase tracking-widest flex items-center gap-1.5">
                    <Eye className="w-3 h-3" /> {t('approval.fullDetails')}
                  </p>
                  {effectivePayload && !effectivePayload._notFound && !effectivePayload._error ? (
                    <TransactionDetailView payload={effectivePayload} type={approval.type} users={users} />
                  ) : effectivePayload?._notFound ? (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                      <p className="text-xs font-bold text-amber-700">{t('approval.txNotFound')}</p>
                      <p className="text-[10px] text-amber-500 mt-1">{t('approval.txNotFoundDesc')}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin mr-2" />
                      <span className="text-xs text-slate-500 font-medium">{t('approval.loadingDetails')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notification Status — Minimal footer */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mt-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 ${
            typeof Notification !== 'undefined' && Notification.permission === 'granted'
              ? 'bg-emerald-500 ring-emerald-500'
              : typeof Notification !== 'undefined' && Notification.permission === 'denied'
              ? 'bg-rose-500 ring-rose-500'
              : 'bg-amber-500 ring-amber-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700">
              {t('approval.pushStatus')} {typeof Notification !== 'undefined'
                  ? Notification.permission === 'granted' ? t('approval.pushActive') :
                    Notification.permission === 'denied' ? t('approval.pushBlocked') : t('approval.pushNotEnabled')
                  : t('approval.pushNotSupported')
              }
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {typeof Notification !== 'undefined' && Notification.permission === 'granted'
                ? t('approval.pushActiveDesc')
                : t('approval.pushEnableDesc')
              }
            </p>
          </div>
          <Zap className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default ApprovalCenter;

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, AlertTriangle, FileSignature, CreditCard, Users, Calendar, DollarSign, Shield, Clock, Check, CheckCheck, Trash2, ChevronDown, Filter } from 'lucide-react';
import { getTransactions, getContracts, getUsers, getBuildings, getSettings, getApprovals, getCustomers } from '../services/firestoreService';
import { Transaction, TransactionType, TransactionStatus, Contract, User as AppUser, UserRole, Building } from '../types';
import { fmtDate } from '../utils/dateFormat';
import { buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

// ─── Types ───────────────────────────────────────────────────

export type NotificationType = 
  | 'overdue_payment'
  | 'contract_expiring'
  | 'contract_expired'
  | 'iqama_expiring'
  | 'pending_approval'
  | 'budget_warning'
  | 'cheque_due'
  | 'lease_expiring'
  | 'pending_transaction';

export type NotificationPriority = 'critical' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  dismissed: boolean;
  route?: string;
  meta?: Record<string, any>;
}

// ─── Notification Generator ─────────────────────────────────

const STORAGE_KEY = 'amlak_notifications_dismissed';

const getDismissedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveDismissedIds = (ids: Set<string>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
};

const STORAGE_KEY_READ = 'amlak_notifications_read';

const getReadIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READ);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveReadIds = (ids: Set<string>) => {
  localStorage.setItem(STORAGE_KEY_READ, JSON.stringify([...ids]));
};

async function generateNotifications(): Promise<AppNotification[]> {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const notifications: AppNotification[] = [];
  const dismissedIds = getDismissedIds();
  const readIds = getReadIds();

  try {
    const [transactions, contracts, users, buildings, settings, approvals, customers] = await Promise.all([
      getTransactions().catch(() => []),
      getContracts().catch(() => []),
      getUsers().catch(() => []),
      getBuildings().catch(() => []),
      getSettings().catch(() => null),
      getApprovals().catch(() => []),
      getCustomers().catch(() => []),
    ]);
    const customerRoomMap = buildCustomerRoomMap(customers as any[]);

    // 1. Overdue Payments — active contracts with no income this month
    const activeContracts = (contracts as Contract[]).filter(c => c.status === 'Active');
    const incomeThisMonth = (transactions as Transaction[]).filter(t =>
      t.type === TransactionType.INCOME &&
      t.status !== TransactionStatus.REJECTED &&
      new Date(t.date).getMonth() === new Date().getMonth() &&
      new Date(t.date).getFullYear() === new Date().getFullYear()
    );

    const paidUnits = new Set(incomeThisMonth.map(tx => `${tx.buildingId}__${tx.unitNumber}`));
    activeContracts.forEach(c => {
      const key = `${c.buildingId}__${c.unitName}`;
      if (!paidUnits.has(key)) {
        const id = `overdue_${c.id}_${new Date().getMonth()}`;
        notifications.push({
          id, type: 'overdue_payment', priority: 'critical',
          title: 'Overdue Payment',
          message: `${formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} — ${c.buildingName} / ${c.unitName} has no payment this month`,
          timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
          route: '/entry', meta: { contractId: c.id, customerId: c.customerId },
        });
      }
    });

    // 2. Contracts expiring within 30 days
    activeContracts.forEach(c => {
      if (!c.toDate) return;
      const daysLeft = Math.ceil((new Date(c.toDate).getTime() - now) / 86400000);
      if (daysLeft > 0 && daysLeft <= 30) {
        const id = `contract_expiring_${c.id}`;
        notifications.push({
          id, type: 'contract_expiring', priority: daysLeft <= 7 ? 'critical' : 'warning',
          title: 'Contract Expiring Soon',
          message: `${formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} — ${c.buildingName} / ${c.unitName} expires in ${daysLeft} day(s) (${fmtDate(c.toDate)})`,
          timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
          route: '/contracts', meta: { contractId: c.id, daysLeft },
        });
      }
    });

    // 3. Expired contracts (still marked Active)
    (contracts as Contract[]).filter(c => c.status === 'Active' && c.toDate && c.toDate < today).forEach(c => {
      const id = `contract_expired_${c.id}`;
      notifications.push({
        id, type: 'contract_expired', priority: 'critical',
        title: 'Contract Expired',
        message: `${formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap)} — ${c.buildingName} / ${c.unitName} expired on ${fmtDate(c.toDate)}`,
        timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
        route: '/contracts', meta: { contractId: c.id },
      });
    });

    // 4. Iqama expiry within 30 days
    (users as AppUser[]).forEach(u => {
      if (!u.iqamaExpiry) return;
      const daysLeft = Math.ceil((new Date(u.iqamaExpiry).getTime() - now) / 86400000);
      if (daysLeft > 0 && daysLeft <= 30) {
        const id = `iqama_${u.id}`;
        notifications.push({
          id, type: 'iqama_expiring', priority: daysLeft <= 7 ? 'critical' : 'warning',
          title: 'Iqama Expiring',
          message: `${u.name}'s Iqama expires in ${daysLeft} day(s) (${fmtDate(u.iqamaExpiry)})`,
          timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
          route: '/admin/employees', meta: { userId: u.id, daysLeft },
        });
      }
    });

    // 5. Pending approvals
    if (approvals && (approvals as any[]).length > 0) {
      const count = (approvals as any[]).length;
      const id = `pending_approvals_${count}`;
      notifications.push({
        id, type: 'pending_approval', priority: 'warning',
        title: 'Pending Approvals',
        message: `${count} approval request(s) waiting for review`,
        timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
        route: '/approvals', meta: { count },
      });
    }

    // 6. Expense budget warning (≥80%)
    if (settings && (settings as any).expenseBudgetLimit > 0) {
      const limit = (settings as any).expenseBudgetLimit;
      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const monthExpenses = (transactions as Transaction[])
        .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.REJECTED && new Date(t.date).getMonth() === thisMonth && new Date(t.date).getFullYear() === thisYear)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const pct = (monthExpenses / limit) * 100;
      if (pct >= 80) {
        const id = `budget_warning_${thisMonth}_${thisYear}`;
        notifications.push({
          id, type: 'budget_warning', priority: pct >= 100 ? 'critical' : 'warning',
          title: pct >= 100 ? 'Budget Exceeded!' : 'Budget Warning',
          message: `Monthly expenses at ${pct.toFixed(0)}% of budget (${monthExpenses.toLocaleString()} / ${limit.toLocaleString()} SAR)`,
          timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
          route: '/monitoring', meta: { pct, monthExpenses, limit },
        });
      }
    }

    // 7. Cheques due within 7 days
    (transactions as Transaction[])
      .filter(t => t.chequeDueDate && t.paymentMethod === 'CHEQUE')
      .forEach(t => {
        const daysLeft = Math.ceil((new Date(t.chequeDueDate!).getTime() - now) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 7) {
          const id = `cheque_${t.id}`;
          notifications.push({
            id, type: 'cheque_due', priority: daysLeft <= 2 ? 'critical' : 'warning',
            title: 'Cheque Due Soon',
            message: `Cheque #${t.chequeNo || '?'} for ${(t.amount || 0).toLocaleString()} SAR — due in ${daysLeft} day(s)`,
            timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
            route: '/history', meta: { transactionId: t.id, daysLeft },
          });
        }
      });

    // 8. Building lease expiring within 60 days
    (buildings as Building[]).forEach(b => {
      if (!b.lease?.isLeased || !b.lease?.leaseEndDate) return;
      const daysLeft = Math.ceil((new Date(b.lease.leaseEndDate).getTime() - now) / 86400000);
      if (daysLeft > 0 && daysLeft <= 60) {
        const id = `lease_${b.id}`;
        notifications.push({
          id, type: 'lease_expiring', priority: daysLeft <= 14 ? 'critical' : 'warning',
          title: 'Building Lease Expiring',
          message: `${b.name} lease expires in ${daysLeft} day(s) (${fmtDate(b.lease.leaseEndDate)})`,
          timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
          route: '/properties', meta: { buildingId: b.id, daysLeft },
        });
      }
    });

    // 9. Pending transactions
    const pendingCount = (transactions as Transaction[]).filter(t => t.status === TransactionStatus.PENDING).length;
    if (pendingCount > 0) {
      const id = `pending_tx_${pendingCount}`;
      notifications.push({
        id, type: 'pending_transaction', priority: 'info',
        title: 'Pending Transactions',
        message: `${pendingCount} transaction(s) awaiting approval`,
        timestamp: now, read: readIds.has(id), dismissed: dismissedIds.has(id),
        route: '/history', meta: { count: pendingCount },
      });
    }

  } catch (err) {
    console.error('Notification generation failed:', err);
  }

  return notifications.filter(n => !n.dismissed);
}

// ─── Icon & Color Helpers ──────────────────────────────────

const typeIcon: Record<NotificationType, React.ElementType> = {
  overdue_payment: DollarSign,
  contract_expiring: FileSignature,
  contract_expired: AlertTriangle,
  iqama_expiring: Shield,
  pending_approval: Clock,
  budget_warning: AlertTriangle,
  cheque_due: CreditCard,
  lease_expiring: Calendar,
  pending_transaction: Clock,
};

const priorityColor: Record<NotificationPriority, { bg: string; ring: string; icon: string; dot: string }> = {
  critical: { bg: 'bg-red-50', ring: 'ring-red-200', icon: 'text-red-600', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50', ring: 'ring-amber-200', icon: 'text-amber-600', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-50', ring: 'ring-blue-200', icon: 'text-blue-600', dot: 'bg-blue-500' },
};

// ─── Bell Button (for header) ──────────────────────────────

interface NotificationBellProps {
  onClick: () => void;
  count: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onClick, count }) => {
  const { t } = useLanguage();
  return (
  <button
    onClick={() => { SoundService.play('open'); onClick(); }}
    className="relative p-2 rounded-xl hover:bg-emerald-100 transition-all duration-200 text-emerald-700 group"
    title={t('customer.notifications')}
  >
    <Bell size={20} className="group-hover:scale-110 transition-transform" />
    {count > 0 && (
      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 shadow-lg animate-pulse">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
  );
};
// ─── Main Notification Panel ───────────────────────────────

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen, onClose, notifications, onMarkRead, onMarkAllRead, onDismiss, onDismissAll
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread': return notifications.filter(n => !n.read);
      case 'critical': return notifications.filter(n => n.priority === 'critical');
      default: return notifications;
    }
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical').length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60]" onClick={() => { SoundService.play('close'); onClose(); }} />

      {/* Panel */}
      <div className="fixed top-0 right-0 w-full sm:w-[420px] h-full bg-white shadow-2xl z-[61] flex flex-col border-l border-emerald-200/50 notification-panel-enter">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Bell size={20} className="text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-black text-emerald-900">{t('notifications.title')}</h2>
                <p className="text-xs text-emerald-600 font-medium">
                  {unreadCount > 0 ? `${unreadCount} ${t('notifications.unread')}` : t('notifications.allCaughtUp')}
                </p>
              </div>
            </div>
            <button onClick={() => { SoundService.play('close'); onClose(); }} className="p-2 hover:bg-emerald-100 rounded-lg transition-colors">
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {([
              { key: 'all', label: t('notifications.all'), count: notifications.length },
              { key: 'unread', label: t('notifications.unreadTab'), count: unreadCount },
              { key: 'critical', label: t('notifications.critical'), count: criticalCount },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); SoundService.play('click'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === tab.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {tab.label} {tab.count > 0 && <span className="ml-1">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Actions bar */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-emerald-50 bg-white/50">
            <button
              onClick={() => { onMarkAllRead(); SoundService.play('submit'); }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
            >
              <CheckCheck size={14} /> {t('notifications.markAllRead')}
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => { onDismissAll(); SoundService.play('submit'); }}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <Trash2 size={14} /> {t('notifications.clearAll')}
            </button>
          </div>
        )}

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="p-4 bg-emerald-50 rounded-2xl mb-4">
                <Bell size={40} className="text-emerald-300" />
              </div>
              <p className="text-emerald-800 font-bold text-lg mb-1">{t('notifications.noNotifications')}</p>
              <p className="text-emerald-600 text-sm">{t('notifications.noNotificationsDesc')}</p>
            </div>
          ) : (
            <div className="divide-y divide-emerald-50">
              {filtered.map(n => {
                const Icon = typeIcon[n.type] || Bell;
                const colors = priorityColor[n.priority];
                return (
                  <div
                    key={n.id}
                    className={`group px-5 py-3.5 flex items-start gap-3 cursor-pointer transition-all duration-200 hover:bg-emerald-50/50 ${
                      !n.read ? 'bg-emerald-50/30' : ''
                    }`}
                    onClick={() => {
                      SoundService.play('nav');
                      onMarkRead(n.id);
                      if (n.route) { navigate(n.route); onClose(); }
                    }}
                  >
                    <div className={`p-2 rounded-xl ${colors.bg} ring-1 ${colors.ring} flex-shrink-0 mt-0.5`}>
                      <Icon size={16} className={colors.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className={`text-sm font-bold ${!n.read ? 'text-emerald-900' : 'text-slate-700'} truncate`}>{n.title}</h4>
                        {!n.read && <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{n.message}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); SoundService.play('click'); onDismiss(n.id); }}
                      className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .notification-panel-enter { animation: slideInRight 0.25s ease-out; }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </>
  );
};

// ─── Hook ──────────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await generateNotifications();
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const readSet = getReadIds();
    readSet.add(id);
    saveReadIds(readSet);
  }, []);

  const markAllRead = useCallback(() => {
    const readSet = getReadIds();
    setNotifications(prev => prev.map(n => { readSet.add(n.id); return { ...n, read: true }; }));
    saveReadIds(readSet);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const dismissedSet = getDismissedIds();
    dismissedSet.add(id);
    saveDismissedIds(dismissedSet);
  }, []);

  const dismissAll = useCallback(() => {
    const dismissedSet = getDismissedIds();
    notifications.forEach(n => dismissedSet.add(n.id));
    saveDismissedIds(dismissedSet);
    setNotifications([]);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead, dismiss, dismissAll };
}

// Default export (legacy compatibility)
const Notifications: React.FC = () => null;
export default Notifications;

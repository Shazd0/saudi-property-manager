import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Search, Users, Clock, X, Wifi, WifiOff, SignalZero,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';
import { getUsers } from '../services/firestoreService';
import { useVoiceCall } from './VoiceCallManager';
import {
  CallHistoryEntry,
  getCallHistory,
  getMissedCallCount,
  markMissedCallsRead,
  markCallRead,
} from '../services/callHistoryService';
import { isMacCallBackend } from '../services/voiceCallService';
import {
  StaffCallStatus,
  checkUserOnlineViaApi,
  fetchCallPresenceMap,
  isCallable,
  resolveStaffCallStatus,
} from '../services/callPresenceService';

interface AmlakCallsProps {
  currentUser: User;
}

type Tab = 'contacts' | 'history' | 'missed';

const AmlakCalls: React.FC<AmlakCallsProps> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { startCall } = useVoiceCall();
  const userId = currentUser.id || (currentUser as any).uid;

  const [tab, setTab] = useState<Tab>('contacts');
  const [staff, setStaff] = useState<any[]>([]);
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [missedCount, setMissedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});
  const [wsOnlineMap, setWsOnlineMap] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const [users, hist, missed, presence] = await Promise.all([
        getUsers(),
        getCallHistory(userId),
        getMissedCallCount(userId),
        isMacCallBackend() ? fetchCallPresenceMap() : Promise.resolve({}),
      ]);

      const eligible = users.filter((u: any) =>
        u.id !== userId
        && u.role !== UserRole.OWNER
        && u.hasSystemAccess !== false
        && !u.deleted
        && u.name,
      );

      setStaff(eligible);
      setHistory(hist);
      setMissedCount(missed);
      setPresenceMap(presence);

      if (isMacCallBackend()) {
        const onlineChecks = await Promise.all(
          eligible.slice(0, 40).map(async (u: any) => {
            const online = await checkUserOnlineViaApi(u.id);
            return [u.id, online] as const;
          }),
        );
        setWsOnlineMap(Object.fromEntries(onlineChecks));
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const iv = window.setInterval(loadData, 12000);
    return () => window.clearInterval(iv);
  }, [loadData]);

  useEffect(() => {
    if (tab === 'missed' && missedCount > 0) {
      markMissedCallsRead(userId).then(() => {
        setMissedCount(0);
        loadData();
      });
    }
  }, [tab, missedCount, userId, loadData]);

  const getStatus = useCallback((u: any): StaffCallStatus =>
    resolveStaffCallStatus(u, presenceMap, wsOnlineMap[u.id]),
  [presenceMap, wsOnlineMap]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = staff.filter((u) => isCallable(getStatus(u)));
    if (!q) return list;
    return list.filter((u) =>
      (u.name || '').toLowerCase().includes(q)
      || (u.role || '').toLowerCase().includes(q),
    );
  }, [staff, search, getStatus]);

  const onlineCount = useMemo(
    () => staff.filter((u) => getStatus(u) === 'online').length,
    [staff, getStatus],
  );

  const filteredHistory = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...history].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    if (tab === 'missed') list = list.filter((h) => h.status === 'missed');
    if (!q) return list;
    return list.filter((h) => (h.peerName || '').toLowerCase().includes(q));
  }, [history, search, tab]);

  const handleCall = (peer: { id: string; name: string }, type: 'audio' | 'video', status: StaffCallStatus) => {
    console.log('[AmlakCall] UI call button', { peer, type, status, callable: isCallable(status) });
    if (!isCallable(status)) return;
    startCall({
      type,
      targetUserIds: [peer.id],
      targetNames: { [peer.id]: peer.name },
    });
  };

  const handleHistoryCall = (entry: CallHistoryEntry, type: 'audio' | 'video') => {
    handleCall({ id: entry.peerId, name: entry.peerName }, type, 'offline');
    if (!entry.read) markCallRead(entry.id, entry);
  };

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return t('call.justNow') || 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  const statusIcon = (entry: CallHistoryEntry) => {
    if (entry.status === 'missed') return <PhoneMissed size={16} className="text-red-500" />;
    if (entry.direction === 'incoming') return <PhoneIncoming size={16} className="text-emerald-500" />;
    return <PhoneOutgoing size={16} className="text-sky-500" />;
  };

  const roleLabel = (role: string) => ({
    ADMIN: t('call.roleAdmin') || 'Admin',
    MANAGER: t('call.roleManager') || 'Manager',
    EMPLOYEE: t('call.roleEmployee') || 'Employee',
    ENGINEER: t('call.roleEngineer') || 'Engineer',
  }[role] || role);

  const historyStatusLabel = (entry: CallHistoryEntry) => {
    if (entry.status === 'missed') return t('call.missed') || 'Missed';
    if (entry.status === 'completed') return t('call.completed') || 'Completed';
    if (entry.status === 'declined') return t('call.declined') || 'Declined';
    if (entry.status === 'busy') return t('call.busy') || 'Busy';
    return t('call.ended') || 'Ended';
  };

  const statusLabel = (status: StaffCallStatus) => ({
    online: t('call.statusOnline') || 'Online',
    offline: t('call.statusOffline') || 'Offline',
    unavailable: t('call.statusUnavailable') || 'No Access',
  }[status]);

  return (
    <div className="min-h-[calc(100dvh-5rem)] flex flex-col max-w-3xl mx-auto w-full call-page bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/40">
      {/* Header */}
      <div className="px-3 sm:px-4 pt-2 pb-3 sm:pb-4">
        <div className="rounded-3xl overflow-hidden shadow-2xl call-header-gradient">
          <div className="px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-md border border-white/20">
                <Phone size={28} className="text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                  {t('call.title') || 'Amlak Calls'}
                </h1>
                <p className="text-emerald-100 text-sm sm:text-base mt-0.5">
                  {t('call.subtitle') || 'Free unlimited voice & video over WiFi'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white font-semibold shadow-sm border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                {onlineCount} {t('call.onlineNow') || 'online now'}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-emerald-50 font-medium border border-white/10">
                {staff.length} {t('call.registered') || 'registered'}
              </span>
            </div>
          </div>

          <div className="flex border-t border-white/15">
            {([
              ['contacts', Users, t('call.contacts') || 'Contacts'],
              ['history', Clock, t('call.history') || 'History'],
              ['missed', PhoneMissed, t('call.missed') || 'Missed', missedCount],
            ] as const).map(([key, Icon, label, badge]) => (
              <button
                key={key}
                onClick={() => setTab(key as Tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3.5 sm:py-4 text-xs sm:text-sm font-bold transition-all ${
                  tab === key ? 'bg-white text-emerald-800' : 'text-emerald-50/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {badge ? (
                  <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 sm:px-4 mb-3 sm:mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'contacts' ? (t('call.searchStaff') || 'Search staff...') : (t('call.searchHistory') || 'Search calls...')}
            className="w-full pl-11 pr-10 py-3.5 sm:py-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-400/50 text-base"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-slate-100">
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-3 sm:px-4 pb-24 sm:pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium">{t('call.loading') || 'Loading...'}</p>
          </div>
        ) : tab === 'contacts' ? (
          <div className="grid gap-2.5 sm:gap-3">
            {filteredStaff.length === 0 ? (
              <EmptyState icon={Users} text={t('call.noContacts') || 'No registered staff online in Amlak'} />
            ) : filteredStaff.map((u) => {
              const status = getStatus(u);
              return (
                <ContactCard
                  key={u.id}
                  name={u.name}
                  role={roleLabel(u.role || '')}
                  initial={u.name.charAt(0)}
                  status={status}
                  statusLabel={statusLabel(status)}
                  onVoice={() => handleCall({ id: u.id, name: u.name }, 'audio', status)}
                  onVideo={() => handleCall({ id: u.id, name: u.name }, 'video', status)}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:gap-3">
            {filteredHistory.length === 0 ? (
              <EmptyState
                icon={tab === 'missed' ? PhoneMissed : Clock}
                text={tab === 'missed' ? (t('call.noMissed') || 'No missed calls') : (t('call.noHistory') || 'No call history yet')}
              />
            ) : filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-white rounded-2xl border shadow-sm active:scale-[0.99] transition-all ${
                  entry.status === 'missed' && !entry.read ? 'border-red-200 bg-red-50/40' : 'border-slate-100'
                }`}
              >
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0 call-avatar">
                  {(entry.peerName || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(entry)}
                    <p className="font-bold text-slate-800 truncate text-base">{entry.peerName || 'Unknown'}</p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                    {entry.direction === 'incoming' ? (t('call.incoming') || 'Incoming') : (t('call.outgoing') || 'Outgoing')}
                    {' • '}{historyStatusLabel(entry)}
                    {' • '}{entry.callType === 'video' ? (t('call.videoCall') || 'Video') : (t('call.voiceCall') || 'Voice')}
                    {entry.duration ? ` • ${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}` : ''}
                    {' • '}{formatWhen(entry.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <CallBtn icon={Phone} color="emerald" onClick={() => handleHistoryCall(entry, 'audio')} />
                  <CallBtn icon={Video} color="sky" onClick={() => handleHistoryCall(entry, 'video')} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .call-header-gradient { background: linear-gradient(135deg, #064e3b 0%, #047857 30%, #059669 65%, #10b981 100%); }
        .call-avatar { background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 16px rgba(5,150,105,0.35); }
        .call-btn-voice { background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 14px rgba(5,150,105,0.35); }
        .call-btn-video { background: linear-gradient(135deg, #0d9488, #0f766e); box-shadow: 0 4px 14px rgba(13,148,136,0.3); }
      `}</style>
    </div>
  );
};

const StatusBadge: React.FC<{ status: StaffCallStatus; label: string }> = ({ status, label }) => {
  const colors = {
    online: 'bg-emerald-100 text-emerald-700',
    offline: 'bg-slate-100 text-slate-500',
    unavailable: 'bg-red-100 text-red-600',
  };
  const icons = {
    online: Wifi,
    offline: WifiOff,
    unavailable: SignalZero,
  };
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${colors[status]}`}>
      <Icon size={11} />
      {label}
    </span>
  );
};

const ContactCard: React.FC<{
  name: string; role: string; initial: string; status: StaffCallStatus;
  statusLabel: string; onVoice: () => void; onVideo: () => void;
}> = ({ name, role, initial, status, statusLabel, onVoice, onVideo }) => (
  <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg active:scale-[0.99] transition-all">
    <div className="relative flex-shrink-0">
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold text-white call-avatar">
        {initial.toUpperCase()}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-[2.5px] border-white ${
        status === 'online' ? 'bg-emerald-400' : status === 'offline' ? 'bg-slate-300' : 'bg-red-400'
      }`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-bold text-slate-800 truncate text-base sm:text-lg">{name}</p>
      <p className="text-xs sm:text-sm text-emerald-600 font-semibold">{role}</p>
      <StatusBadge status={status} label={statusLabel} />
    </div>
    <div className="flex gap-2 sm:gap-2.5 flex-shrink-0">
      <button onClick={onVoice}
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform call-btn-voice"
        aria-label="Voice call">
        <Phone size={22} strokeWidth={2.5} />
      </button>
      <button onClick={onVideo}
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform call-btn-video"
        aria-label="Video call">
        <Video size={22} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

const CallBtn: React.FC<{ icon: React.FC<any>; color: 'emerald' | 'sky'; onClick: () => void }> = ({ icon: Icon, color, onClick }) => (
  <button onClick={onClick}
    className={`p-3 sm:p-3.5 rounded-2xl active:scale-90 transition-all ${
      color === 'emerald' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
    }`}>
    <Icon size={20} />
  </button>
);

const EmptyState: React.FC<{ icon: React.FC<any>; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-slate-400 px-6 text-center">
    <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
      <Icon size={36} className="text-slate-300" />
    </div>
    <p className="font-semibold text-base">{text}</p>
  </div>
);

export default AmlakCalls;

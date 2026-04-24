import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw, Check, Loader2, AlertTriangle } from 'lucide-react';
import { isOnline, onConnectivityChange, getPendingCount, manualSync } from '../services/offlineService';
import { useLanguage } from '../i18n';

const OfflineBanner: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const [online, setOnline] = useState(isOnline());
  const [pendingOps, setPendingOps] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    const refreshPending = async () => {
      const count = await getPendingCount();
      setPendingOps(count);
    };

    refreshPending();

    const unsub = onConnectivityChange((isOn) => {
      setOnline(isOn);
      if (!isOn) {
        wasOffline.current = true;
      }
      if (isOn && wasOffline.current) {
        // Auto-sync immediately when back online
        wasOffline.current = false;
        setShowOnlineToast(true);
        setSyncing(true);
        manualSync().then(result => {
          setSyncedCount(result.synced);
          setConflictCount(result.conflicts);
          setPendingOps(result.failed);
          setSyncing(false);
          setJustSynced(true);
          setTimeout(() => { setJustSynced(false); setShowOnlineToast(false); setSyncedCount(0); setConflictCount(0); }, result.conflicts > 0 ? 8000 : 4000);
        }).catch(() => { setSyncing(false); });
      }
      refreshPending();
    });

    // Periodic check for pending ops + auto-sync
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingOps(count);
      // Auto-sync any pending ops silently
      if (count > 0 && isOnline()) {
        setSyncing(true);
        const result = await manualSync().catch(() => ({ synced: 0, failed: count, conflicts: 0 }));
        setPendingOps(result.failed);
        setSyncing(false);
        if (result.synced > 0 || result.conflicts > 0) {
          setSyncedCount(result.synced);
          setConflictCount(result.conflicts);
          setJustSynced(true);
          setTimeout(() => { setJustSynced(false); setSyncedCount(0); setConflictCount(0); }, result.conflicts > 0 ? 8000 : 3000);
        }
      }
    }, 8000);

    return () => { unsub(); clearInterval(interval); };
  }, []);

  // Nothing to show
  if (online && pendingOps === 0 && !showOnlineToast && !syncing && !justSynced) return null;

  // "Back Online + Synced" toast
  if (online && showOnlineToast && !syncing) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg backdrop-blur-xl ${
          conflictCount > 0 ? 'bg-amber-600 shadow-amber-200/50' : 'bg-emerald-600 shadow-emerald-200/50'
        }`}>
          {conflictCount > 0 ? <AlertTriangle size={14} /> : justSynced ? <Check size={14} /> : <Wifi size={14} />}
          {conflictCount > 0
            ? `Back Online — ${conflictCount} conflict${conflictCount > 1 ? 's' : ''} detected (check Contracts)`
            : syncedCount > 0 ? `Back Online — ${syncedCount} change${syncedCount > 1 ? 's' : ''} synced ✓` : 'Back Online ✓'}
        </div>
      </div>
    );
  }

  // Currently syncing toast
  if (online && syncing) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-200/50 backdrop-blur-xl">
          <Loader2 size={14} className="animate-spin" />
          Syncing {pendingOps} change{pendingOps > 1 ? 's' : ''}...
        </div>
      </div>
    );
  }

  // Just synced notification
  if (online && justSynced && pendingOps === 0) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-200/50">
          <Check size={14} />
          All changes synced ✓
        </div>
      </div>
    );
  }

  // Offline banner
  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999]">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-4 py-2 flex items-center justify-center gap-3 text-white text-xs sm:text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="animate-pulse" />
            <span>You're offline — changes save locally & auto-sync when back online</span>
          </div>
          {pendingOps > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {pendingOps} queued
            </span>
          )}
        </div>
      </div>
    );
  }

  // Online but has pending (shouldn't normally show — auto-sync handles it)
  if (online && pendingOps > 0 && !syncing) {
    return (
      <div className="fixed top-4 right-4 z-[9999] animate-slide-up">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/90 backdrop-blur-xl border border-amber-200 shadow-lg text-xs font-semibold text-amber-800">
          <CloudOff size={14} className="text-amber-500" />
          <span>{pendingOps} pending — syncing automatically...</span>
          <RefreshCw size={12} className="animate-spin text-amber-500" />
        </div>
      </div>
    );
  }

  return null;
};

export default OfflineBanner;

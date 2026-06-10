import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Keyboard,
  Loader2,
  Monitor,
  MousePointer2,
  PhoneOff,
  RefreshCcw,
  ScreenShare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { getUsers } from '../services/firestoreService';
import { listenAllPresence } from '../services/chatService';
import {
  addRemoteSupportCandidate,
  createRemoteSupportPeer,
  createRemoteSupportRequest,
  endRemoteSupportSession,
  listenRemoteSupportCandidates,
  listenRemoteSupportSession,
  RemoteSupportCommand,
  RemoteSupportSession,
  sendRemoteSupportCommand,
  updateRemoteSupportSession,
} from '../services/remoteSupportService';

interface AdminRemoteSupportProps {
  currentUser: User;
}

type StaffRow = User & {
  online?: boolean;
  lastSeen?: any;
};

const statusCopy: Record<string, string> = {
  requested: 'Waiting for staff approval',
  sharing: 'Connecting remote control',
  'control-requested': 'Waiting for remote control',
  'active-control': 'Remote control enabled',
  declined: 'Request declined',
  ended: 'Session ended',
  failed: 'Session failed',
};

const getPresenceMillis = (lastSeen: any) => {
  if (!lastSeen) return 0;
  if (typeof lastSeen?.toMillis === 'function') return lastSeen.toMillis();
  if (typeof lastSeen?.seconds === 'number') return lastSeen.seconds * 1000;
  if (lastSeen instanceof Date) return lastSeen.getTime();
  if (typeof lastSeen === 'number') return lastSeen > 1_000_000_000_000 ? lastSeen : lastSeen * 1000;
  if (typeof lastSeen === 'string') {
    const parsed = Date.parse(lastSeen);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const lastSeenText = (lastSeen: any) => {
  const ms = getPresenceMillis(lastSeen);
  if (!ms) return 'No recent activity';
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return 'just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} hr ago`;
  if (diff < 7 * 24 * 60 * 60_000) return `${Math.floor(diff / (24 * 60 * 60_000))} days ago`;
  return new Date(ms).toLocaleDateString();
};

const AdminRemoteSupport: React.FC<AdminRemoteSupportProps> = ({ currentUser }) => {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [presence, setPresence] = useState<Record<string, { online: boolean; lastSeen: any }>>({});
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<RemoteSupportSession | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewerReady, setViewerReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const handledOfferRef = useRef('');

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER || (currentUser as any).role === 'MANAGER';
  const adminId = currentUser.id || (currentUser as any).uid || 'admin';
  const adminName = currentUser.name || (currentUser as any).displayName || currentUser.email || 'Admin';

  const loadStaff = async () => {
    setLoadingUsers(true);
    try {
      const users = await getUsers();
      setStaff((users || []).filter((u: any) => {
        const role = u.role;
        if (u.id === adminId) return false;
        if (u.status === 'Inactive') return false;
        return role !== UserRole.ADMIN && role !== 'ADMIN' && role !== UserRole.OWNER && role !== 'OWNER';
      }) as StaffRow[]);
    } catch (e: any) {
      setError(e?.message || 'Could not load staff.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadStaff();
    return listenAllPresence(map => setPresence(map));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    return listenRemoteSupportSession(sessionId, next => {
      setSession(next);
      if (!next) return;
      if (next.offer && handledOfferRef.current !== JSON.stringify(next.offer)) {
        handledOfferRef.current = JSON.stringify(next.offer);
        startViewer(next).catch(e => setError(e?.message || 'Could not open viewer.'));
      }
      if (['ended', 'declined', 'failed'].includes(next.status)) {
        closeViewer(false);
      }
    });
  }, [sessionId]);

  const staffWithPresence = useMemo(() => {
    return staff
      .map(u => {
        const p = presence[u.id] || presence[(u as any).uid];
        const lastMs = getPresenceMillis(p?.lastSeen);
        const stale = lastMs && Date.now() - lastMs > 2 * 60_000;
        return { ...u, online: !!p?.online && !stale, lastSeen: p?.lastSeen };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [presence, staff]);

  const closeViewer = async (notify = true) => {
    pcRef.current?.close();
    pcRef.current = null;
    handledOfferRef.current = '';
    setViewerReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (notify && sessionId) await endRemoteSupportSession(sessionId).catch(() => {});
    setSessionId(null);
    setSession(null);
  };

  const startSession = async (target: StaffRow) => {
    setBusy(true);
    setError('');
    setSelectedStaff(target);
    try {
      const id = await createRemoteSupportRequest({
        adminId,
        adminName,
        staffId: target.id,
        staffName: target.name || target.email || 'Staff',
        requestMessage: 'Admin is requesting remote support.',
      });
      setSessionId(id);
    } catch (e: any) {
      setError(e?.message || 'Could not create remote support request.');
    } finally {
      setBusy(false);
    }
  };

  const startViewer = async (next: RemoteSupportSession) => {
    if (!next.offer || pcRef.current) return;
    const pc = createRemoteSupportPeer();
    pcRef.current = pc;

    pc.ontrack = event => {
      const [stream] = event.streams;
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setViewerReady(true);
      }
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        addRemoteSupportCandidate(next.id, 'admin', event.candidate.toJSON()).catch(() => {});
      }
    };

    const unsubscribeCandidates = listenRemoteSupportCandidates(next.id, 'staff', candidate => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    await pc.setRemoteDescription(new RTCSessionDescription(next.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateRemoteSupportSession(next.id, { answer });

    pc.addEventListener('connectionstatechange', () => {
      if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) unsubscribeCandidates();
    });
  };

  const sendCommand = async (command: Omit<RemoteSupportCommand, 'adminId' | 'at'>) => {
    if (!session?.controlEnabled || !sessionId) return;
    await sendRemoteSupportCommand(sessionId, {
      ...command,
      adminId,
      at: Date.now(),
    } as RemoteSupportCommand);
  };

  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!session?.controlEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    sendCommand({
      type: event.detail >= 2 ? 'dblclick' : 'click',
      xRatio: (event.clientX - rect.left) / rect.width,
      yRatio: (event.clientY - rect.top) / rect.height,
    });
    viewerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!session?.controlEnabled) return;
    if (event.key === 'Escape') return;
    event.preventDefault();
    sendCommand({
      type: 'keydown',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
    });
  };

  const handleWheel = (event: React.WheelEvent<HTMLVideoElement>) => {
    if (!session?.controlEnabled) return;
    event.preventDefault();
    sendCommand({
      type: 'scroll',
      deltaX: event.deltaX,
      deltaY: event.deltaY,
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto text-red-600" size={36} />
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only admins and managers can start remote support sessions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 bg-slate-100 dark:bg-slate-950 p-3 md:p-4">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-4 md:p-5 shadow-xl shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-100">Remote Support</p>
            <h1 className="mt-1 text-xl md:text-2xl font-black">Live staff screen viewer</h1>
            <p className="mt-1 max-w-3xl text-sm text-emerald-50">
              Request a staff member's screen. Once they approve, mouse and keyboard control starts automatically. Staff can stop sharing at any time.
            </p>
          </div>
          <button type="button" onClick={loadStaff} className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 px-4 py-3 text-sm font-bold">
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm font-bold text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[340px,minmax(0,1fr)] gap-3 min-h-0 flex-1">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 shadow-xl overflow-hidden min-h-0 flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} />
                Online Staff
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose a staff member to request support.</p>
            </div>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-black">
              {staffWithPresence.filter(u => u.online).length} online
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto min-h-0 flex-1">
            {loadingUsers ? (
              <div className="p-8 text-center text-slate-500">
                <Loader2 className="mx-auto animate-spin" />
                <p className="mt-3 text-sm font-bold">Loading staff...</p>
              </div>
            ) : staffWithPresence.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm font-bold">No staff users found.</div>
            ) : (
              staffWithPresence.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedStaff(member)}
                  className={`w-full p-4 text-left hover:bg-emerald-50 dark:hover:bg-slate-800 transition ${selectedStaff?.id === member.id ? 'bg-emerald-50 dark:bg-slate-800' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white grid place-items-center font-black">
                      {(member.name || member.email || 'S').slice(0, 1).toUpperCase()}
                      <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${member.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-white truncate">{member.name || member.email || 'Staff'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {member.online ? 'Online now' : `Last seen ${lastSeenText(member.lastSeen)}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 shadow-xl overflow-hidden min-h-0 flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ScreenShare size={18} />
                Viewer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {session ? statusCopy[session.status] || session.status : selectedStaff ? `Ready to request ${selectedStaff.name || selectedStaff.email}` : 'Select an online staff member.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!sessionId && selectedStaff && (
                <button
                  type="button"
                  disabled={busy || !selectedStaff.online}
                  onClick={() => startSession(selectedStaff)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Monitor size={16} />}
                  Request Remote Access
                </button>
              )}
              {sessionId && (
                <button type="button" onClick={() => closeViewer(true)} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-3 text-sm font-bold text-white">
                  <PhoneOff size={16} />
                  End
                </button>
              )}
            </div>
          </div>

          <div
            ref={viewerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="outline-none min-h-0 flex-1"
          >
            <div className="relative bg-slate-950 h-full min-h-[420px] grid place-items-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onClick={handleVideoClick}
                onWheel={handleWheel}
                className={`h-full w-full object-contain ${session?.controlEnabled ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {!sessionId && (
                <div className="absolute inset-0 grid place-items-center p-8 text-center text-slate-300">
                  <div>
                    <Monitor className="mx-auto mb-4 text-emerald-400" size={56} />
                    <p className="font-black text-lg">No active remote session</p>
                    <p className="mt-2 text-sm text-slate-400">Select staff and request screen sharing to start.</p>
                  </div>
                </div>
              )}

              {sessionId && !viewerReady && !['declined', 'ended', 'failed'].includes(session?.status || '') && (
                <div className="absolute inset-0 grid place-items-center p-8 text-center text-slate-300 bg-slate-950">
                  <div>
                    <Loader2 className="mx-auto mb-4 animate-spin text-emerald-400" size={48} />
                    <p className="font-black text-lg">{session?.status === 'requested' ? 'Waiting for staff approval' : 'Connecting remote control...'}</p>
                    <p className="mt-2 text-sm text-slate-400">The staff member must approve and select a screen or app window.</p>
                  </div>
                </div>
              )}

              {session?.controlEnabled && (
                <div className="absolute top-4 left-4 rounded-2xl bg-emerald-500 text-white px-4 py-2 text-xs font-black flex items-center gap-2 shadow-lg">
                  <CheckCircle2 size={16} />
                  Control enabled
                </div>
              )}
            </div>
          </div>

          <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/40 shrink-0">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
              <ShieldCheck className="text-emerald-600" size={20} />
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">One approval</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Staff approval allows viewing, mouse, and typing together.</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
              <MousePointer2 className="text-amber-600" size={20} />
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">Click and scroll</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Click the viewer to send mouse actions.</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
              <Keyboard className="text-blue-600" size={20} />
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">Typing support</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Focus the viewer, then type into the staff app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRemoteSupport;

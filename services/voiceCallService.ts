import { db } from '../firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { macGetDocument, macListCollection, macSaveDocument } from './macApiClient';
import { macSignaling } from './macSignalingClient';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connecting' | 'active' | 'ended' | 'missed' | 'declined' | 'busy';

export interface CallParticipant {
  userId: string;
  userName: string;
  status: 'ringing' | 'joined' | 'declined' | 'left';
}

export interface VoiceCallSession {
  id: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  calleeIds: string[];
  roomId?: string;
  roomName?: string;
  participants: Record<string, CallParticipant>;
  status: CallStatus;
  createdAt?: any;
  updatedAt?: any;
  endedAt?: any;
}

export interface CallSignal {
  id?: string;
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  createdAt?: any;
}

const MAC_API_URL = (import.meta as any).env?.VITE_MAC_API_URL || 'http://mac-mini.local:8787';

const isBrowserLocalHost = () => {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
};

const isPrivateOrLocalBackendUrl = (value: unknown): boolean => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) return true;
    if (hostname.endsWith('.local')) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    const private172 = hostname.match(/^172\.(\d+)\./);
    return !!private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31;
  } catch {
    return false;
  }
};

export const isMacCallBackend = () => {
  if ((import.meta as any).env?.VITE_DATA_BACKEND !== 'mac') return false;
  if (!isBrowserLocalHost() && isPrivateOrLocalBackendUrl(MAC_API_URL)) return false;
  return true;
};

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const createCallPeer = () => new RTCPeerConnection({ iceServers: ICE_SERVERS });

const nowIso = () => new Date().toISOString();
const newSessionId = () => `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ── Mac backend state ─────────────────────────────────────
const macSessionListeners = new Map<string, Set<(s: VoiceCallSession | null) => void>>();
const macIncomingListeners = new Set<(sessions: VoiceCallSession[]) => void>();
const macSignalListeners = new Map<string, Set<(signal: CallSignal) => void>>();
let macSessionsCache: VoiceCallSession[] = [];
let macPollTimer: number | null = null;
const seenSignalIds = new Set<string>();

function emitMacIncoming() {
  const active = new Set<CallStatus>(['ringing', 'connecting', 'active']);
  macIncomingListeners.forEach((cb) => {
    cb(macSessionsCache.filter((s) => active.has(s.status)));
  });
}

function emitMacSession(sessionId: string, session: VoiceCallSession | null) {
  macSessionListeners.get(sessionId)?.forEach((cb) => cb(session));
}

async function macRefreshSessions() {
  try {
    const remote = await macListCollection<VoiceCallSession>('voiceCallSessions', {
      orderField: 'updatedAt',
    });
    const byId = new Map<string, VoiceCallSession>();
    // Keep any local in-flight sessions that the list API has not returned yet.
    for (const s of macSessionsCache) byId.set(s.id, s);
    for (const s of remote) byId.set(s.id, s);
    macSessionsCache = Array.from(byId.values()).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    );
    emitMacIncoming();
    macSessionListeners.forEach((_, sessionId) => {
      const session = macSessionsCache.find((s) => s.id === sessionId) || null;
      // Do not emit null for a missing list hit — callers treat null as "call ended".
      if (session) emitMacSession(sessionId, session);
    });
  } catch {
    // ignore transient API errors
  }
}

function ensureMacPolling() {
  if (macPollTimer) return;
  macRefreshSessions();
  macPollTimer = window.setInterval(macRefreshSessions, 2000);
}

function stopMacPollingIfIdle() {
  if (macIncomingListeners.size > 0 || macSessionListeners.size > 0 || macSignalListeners.size > 0) return;
  if (macPollTimer) {
    window.clearInterval(macPollTimer);
    macPollTimer = null;
  }
}

if (typeof window !== 'undefined' && isMacCallBackend()) {
  macSignaling.onMessage((msg) => {
    if (msg.type === 'incoming-call' && msg.session) {
      const exists = macSessionsCache.find((s) => s.id === msg.session.id);
      if (!exists) macSessionsCache = [msg.session, ...macSessionsCache];
      else macSessionsCache = macSessionsCache.map((s) => (s.id === msg.session.id ? msg.session : s));
      emitMacIncoming();
      emitMacSession(msg.session.id, msg.session);
    }
    if (msg.type === 'signal' && msg.sessionId && msg.fromUserId && msg.toUserId) {
      const signal: CallSignal = {
        id: `${msg.sessionId}_${msg.fromUserId}_${Date.now()}`,
        fromUserId: msg.fromUserId,
        toUserId: msg.toUserId,
        type: msg.signalType as CallSignal['type'],
        payload: msg.payload as RTCSessionDescriptionInit,
      };
      const key = signal.id!;
      if (seenSignalIds.has(key)) return;
      seenSignalIds.add(key);
      macSignalListeners.get(msg.sessionId)?.forEach((cb) => cb(signal));
    }
    if (msg.type === 'session-update' && msg.session) {
      const exists = macSessionsCache.some((s) => s.id === msg.session.id);
      macSessionsCache = exists
        ? macSessionsCache.map((s) => (s.id === msg.session.id ? msg.session : s))
        : [msg.session, ...macSessionsCache];
      emitMacIncoming();
      emitMacSession(msg.session.id, msg.session);
    }
  });
}

// ── Public API ───────────────────────────────────────────

export const createVoiceCallSession = async (params: {
  callType: CallType;
  callerId: string;
  callerName: string;
  calleeIds: string[];
  calleeNames: Record<string, string>;
  roomId?: string;
  roomName?: string;
}) => {
  const participants: Record<string, CallParticipant> = {
    [params.callerId]: {
      userId: params.callerId,
      userName: params.callerName,
      status: 'joined',
    },
  };

  params.calleeIds.forEach((id) => {
    participants[id] = {
      userId: id,
      userName: params.calleeNames[id] || id,
      status: 'ringing',
    };
  });

  if (isMacCallBackend()) {
    const id = newSessionId();
    const session: VoiceCallSession = {
      id,
      callType: params.callType,
      callerId: params.callerId,
      callerName: params.callerName,
      calleeIds: params.calleeIds,
      roomId: params.roomId,
      roomName: params.roomName,
      participants,
      status: 'ringing',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await macSaveDocument('voiceCallSessions', session);
    macSessionsCache = [session, ...macSessionsCache.filter((s) => s.id !== id)];
    emitMacIncoming();
    await macSignaling.notifyRing(session);
    macSignaling.send({ type: 'session-update', session });
    try {
      const { notifyIncomingCallPush } = await import('./pushNotificationService');
      await notifyIncomingCallPush(session);
    } catch { /* server push is primary */ }
    return id;
  }

  const created = await addDoc(collection(db, 'voiceCallSessions'), {
    callType: params.callType,
    callerId: params.callerId,
    callerName: params.callerName,
    calleeIds: params.calleeIds,
    roomId: params.roomId || null,
    roomName: params.roomName || null,
    participants,
    status: 'ringing',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    const { notifyIncomingCallPush } = await import('./pushNotificationService');
    await notifyIncomingCallPush({
      id: created.id,
      callerId: params.callerId,
      callerName: params.callerName,
      callType: params.callType,
      calleeIds: params.calleeIds,
    });
  } catch { /* best effort */ }
  return created.id;
};

export const fetchVoiceCallSession = async (sessionId: string): Promise<VoiceCallSession | null> => {
  if (!sessionId) return null;
  if (isMacCallBackend()) {
    const cached = macSessionsCache.find((s) => s.id === sessionId);
    if (cached) return cached;
    return macGetDocument<VoiceCallSession>('voiceCallSessions', sessionId);
  }
  const snap = await getDoc(doc(db, 'voiceCallSessions', sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<VoiceCallSession, 'id'>) };
};

export const listenIncomingVoiceCalls = (
  userId: string,
  callback: (sessions: VoiceCallSession[]) => void,
): Unsubscribe => {
  if (isMacCallBackend()) {
    ensureMacPolling();
    macSignaling.connect(userId);

    const handler = () => {
      const active = new Set<CallStatus>(['ringing', 'connecting', 'active']);
      const sessions = macSessionsCache
        .filter((s) => {
          if (!active.has(s.status)) return false;
          if (s.callerId === userId) return false;
          const participant = s.participants?.[userId];
          return s.calleeIds?.includes(userId) && participant?.status === 'ringing';
        })
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      callback(sessions);
    };

    macIncomingListeners.add(handler);
    handler();

    macSignaling.fetchPendingRings(userId).then((rings) => {
      rings.forEach((r: any) => {
        if (r.session) callback([r.session]);
      });
    });

    const pollPending = window.setInterval(async () => {
      const rings = await macSignaling.fetchPendingRings(userId);
      rings.forEach((r: any) => {
        if (r.session) {
          const exists = macSessionsCache.find((s) => s.id === r.session.id);
          if (!exists) macSessionsCache = [r.session, ...macSessionsCache];
          handler();
        }
      });
    }, 8000);

    return () => {
      macIncomingListeners.delete(handler);
      window.clearInterval(pollPending);
      stopMacPollingIfIdle();
    };
  }

  const activeStatuses = new Set<CallStatus>(['ringing', 'connecting', 'active']);
  return onSnapshot(collection(db, 'voiceCallSessions'), (snap) => {
    const sessions = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<VoiceCallSession, 'id'>) }))
      .filter((s) => {
        if (!activeStatuses.has(s.status)) return false;
        if (s.callerId === userId) return false;
        const participant = s.participants?.[userId];
        return s.calleeIds?.includes(userId) && participant?.status === 'ringing';
      });
    callback(sessions);
  });
};

export const listenVoiceCallSession = (
  sessionId: string,
  callback: (session: VoiceCallSession | null) => void,
): Unsubscribe => {
  if (isMacCallBackend()) {
    ensureMacPolling();
    if (!macSessionListeners.has(sessionId)) macSessionListeners.set(sessionId, new Set());
    macSessionListeners.get(sessionId)!.add(callback);
    const current = macSessionsCache.find((s) => s.id === sessionId) || null;
    // Only push an initial value when we have one; null would hang up the UI.
    if (current) callback(current);
    return () => {
      macSessionListeners.get(sessionId)?.delete(callback);
      if (macSessionListeners.get(sessionId)?.size === 0) macSessionListeners.delete(sessionId);
      stopMacPollingIfIdle();
    };
  }

  return onSnapshot(doc(db, 'voiceCallSessions', sessionId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<VoiceCallSession, 'id'>) }) : null);
  });
};

export const updateVoiceCallSession = async (
  sessionId: string,
  patch: Partial<Omit<VoiceCallSession, 'id'>>,
) => {
  if (isMacCallBackend()) {
    const current = macSessionsCache.find((s) => s.id === sessionId)
      || await macListCollection<VoiceCallSession>('voiceCallSessions', { filters: { id: sessionId } }).then((r) => r[0]);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: nowIso() };
    await macSaveDocument('voiceCallSessions', next, { merge: true });
    macSessionsCache = macSessionsCache.map((s) => (s.id === sessionId ? next : s));
    emitMacIncoming();
    emitMacSession(sessionId, next);
    macSignaling.send({ type: 'session-update', session: next });
    return;
  }

  await updateDoc(doc(db, 'voiceCallSessions', sessionId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const updateCallParticipant = async (
  sessionId: string,
  userId: string,
  status: CallParticipant['status'],
  participants: Record<string, CallParticipant>,
) => {
  const next = {
    ...participants,
    [userId]: { ...participants[userId], status },
  };
  await updateVoiceCallSession(sessionId, { participants: next });
  return next;
};

export const endVoiceCallSession = async (sessionId: string, status: CallStatus = 'ended') => {
  await updateVoiceCallSession(sessionId, {
    status,
    endedAt: isMacCallBackend() ? nowIso() : serverTimestamp(),
  });
};

export const sendCallSignal = async (
  sessionId: string,
  signal: Omit<CallSignal, 'createdAt' | 'id'>,
) => {
  if (isMacCallBackend()) {
    const id = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = { ...signal, id, sessionId, createdAt: nowIso() };
    await macSaveDocument('callSignals', payload);
    macSignaling.send({
      type: 'signal',
      sessionId,
      fromUserId: signal.fromUserId,
      toUserId: signal.toUserId,
      signalType: signal.type,
      payload: signal.payload,
    });
    return;
  }

  await addDoc(collection(db, 'voiceCallSessions', sessionId, 'signals'), {
    ...signal,
    createdAt: serverTimestamp(),
  });
};

export const listenCallSignals = (
  sessionId: string,
  userId: string,
  callback: (signal: CallSignal) => void,
): Unsubscribe => {
  if (isMacCallBackend()) {
    if (!macSignalListeners.has(sessionId)) macSignalListeners.set(sessionId, new Set());
    macSignalListeners.get(sessionId)!.add(callback);

    // First poll must include offers/ICE saved while the callee was still ringing.
    let lastPoll = '';
    const pullSignals = async () => {
      try {
        const signals = await macListCollection<CallSignal & { sessionId?: string }>('callSignals', {
          orderField: 'createdAt',
          filters: { sessionId, toUserId: userId },
        });
        signals.forEach((sig) => {
          const key = sig.id || `${sig.fromUserId}_${sig.type}_${sig.createdAt || ''}`;
          if (seenSignalIds.has(key)) return;
          if (lastPoll && sig.createdAt && sig.createdAt < lastPoll) return;
          seenSignalIds.add(key);
          callback(sig);
        });
        lastPoll = nowIso();
      } catch {
        // ignore
      }
    };
    void pullSignals();
    const poll = window.setInterval(pullSignals, 500);

    return () => {
      macSignalListeners.get(sessionId)?.delete(callback);
      window.clearInterval(poll);
      stopMacPollingIfIdle();
    };
  }

  const q = query(
    collection(db, 'voiceCallSessions', sessionId, 'signals'),
    where('toUserId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback({ id: change.doc.id, ...(change.doc.data() as Omit<CallSignal, 'id'>) });
      }
    });
  });
};

export const getMediaStream = async (callType: CallType): Promise<MediaStream> => {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: callType === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
};

export const connectCallSignaling = (userId: string) => {
  if (isMacCallBackend()) macSignaling.connect(userId);
};

export const disconnectCallSignaling = () => {
  if (isMacCallBackend()) macSignaling.disconnect();
};

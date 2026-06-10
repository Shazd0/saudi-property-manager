import { db } from '../firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

export type RemoteSupportStatus =
  | 'requested'
  | 'sharing'
  | 'control-requested'
  | 'active-control'
  | 'declined'
  | 'ended'
  | 'failed';

export interface RemoteSupportSession {
  id: string;
  adminId: string;
  adminName: string;
  staffId: string;
  staffName: string;
  status: RemoteSupportStatus;
  controlEnabled?: boolean;
  requestMessage?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  staffScreen?: {
    width: number;
    height: number;
  };
  createdAt?: any;
  updatedAt?: any;
  endedAt?: any;
}

export type RemoteSupportCommand =
  | {
      type: 'click' | 'dblclick';
      xRatio: number;
      yRatio: number;
      adminId: string;
      at: number;
    }
  | {
      type: 'keydown';
      key: string;
      code?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      adminId: string;
      at: number;
    }
  | {
      type: 'scroll';
      deltaX: number;
      deltaY: number;
      adminId: string;
      at: number;
    };

const sessionsRef = () => collection(db, 'remoteSupportSessions');

export const createRemoteSupportRequest = async (params: {
  adminId: string;
  adminName: string;
  staffId: string;
  staffName: string;
  requestMessage?: string;
}) => {
  const created = await addDoc(sessionsRef(), {
    ...params,
    status: 'requested',
    controlEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return created.id;
};

export const listenIncomingRemoteSupport = (
  staffId: string,
  callback: (sessions: RemoteSupportSession[]) => void,
): Unsubscribe => {
  const activeStatuses = new Set<RemoteSupportStatus>([
    'requested',
    'sharing',
    'control-requested',
    'active-control',
  ]);
  return onSnapshot(sessionsRef(), snap => {
    const sessions = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<RemoteSupportSession, 'id'>) }))
      .filter(s => s.staffId === staffId && activeStatuses.has(s.status))
      .sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0;
        const bMs = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0;
        return bMs - aMs;
      });
    callback(sessions);
  });
};

export const listenRemoteSupportSession = (
  sessionId: string,
  callback: (session: RemoteSupportSession | null) => void,
): Unsubscribe => {
  return onSnapshot(doc(db, 'remoteSupportSessions', sessionId), snap => {
    callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<RemoteSupportSession, 'id'>) }) : null);
  });
};

export const updateRemoteSupportSession = async (
  sessionId: string,
  patch: Partial<Omit<RemoteSupportSession, 'id'>>,
) => {
  await updateDoc(doc(db, 'remoteSupportSessions', sessionId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const endRemoteSupportSession = async (sessionId: string) => {
  await updateRemoteSupportSession(sessionId, {
    status: 'ended',
    controlEnabled: false,
    endedAt: serverTimestamp(),
  });
};

export const addRemoteSupportCandidate = async (
  sessionId: string,
  side: 'admin' | 'staff',
  candidate: RTCIceCandidateInit,
) => {
  await addDoc(collection(db, 'remoteSupportSessions', sessionId, `${side}Candidates`), {
    candidate,
    createdAt: serverTimestamp(),
  });
};

export const listenRemoteSupportCandidates = (
  sessionId: string,
  side: 'admin' | 'staff',
  callback: (candidate: RTCIceCandidateInit) => void,
): Unsubscribe => {
  return onSnapshot(collection(db, 'remoteSupportSessions', sessionId, `${side}Candidates`), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data() as { candidate?: RTCIceCandidateInit };
        if (data.candidate) callback(data.candidate);
      }
    });
  });
};

export const sendRemoteSupportCommand = async (
  sessionId: string,
  command: RemoteSupportCommand,
) => {
  await addDoc(collection(db, 'remoteSupportSessions', sessionId, 'commands'), {
    ...command,
    createdAt: serverTimestamp(),
  });
};

export const listenRemoteSupportCommands = (
  sessionId: string,
  callback: (command: RemoteSupportCommand) => void,
): Unsubscribe => {
  const q = query(collection(db, 'remoteSupportSessions', sessionId, 'commands'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') callback(change.doc.data() as RemoteSupportCommand);
    });
  });
};

export const createRemoteSupportPeer = () => new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
});

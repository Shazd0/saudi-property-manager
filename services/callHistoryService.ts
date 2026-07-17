import { macListCollection, macSaveDocument } from './macApiClient';
import type { CallStatus, CallType } from './voiceCallService';

export interface CallHistoryEntry {
  id: string;
  userId: string;
  sessionId: string;
  callType: CallType;
  direction: 'incoming' | 'outgoing';
  peerId: string;
  peerName: string;
  status: CallStatus | 'completed';
  duration?: number;
  createdAt: string;
  read?: boolean;
}

const HISTORY_LIMIT = 200;

const usesMacData = () => (import.meta as any).env?.VITE_DATA_BACKEND === 'mac';

const storageKey = (userId: string) => `amlak-call-history:${userId}`;

const readLocal = (userId: string): CallHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocal = (userId: string, items: CallHistoryEntry[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, HISTORY_LIMIT)));
};

const upsertLocal = (entry: CallHistoryEntry) => {
  const items = readLocal(entry.userId);
  const idx = items.findIndex((e) => e.id === entry.id);
  if (idx >= 0) items[idx] = { ...items[idx], ...entry };
  else items.unshift(entry);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  writeLocal(entry.userId, items);
};

const normalizeEntry = (item: Partial<CallHistoryEntry>): CallHistoryEntry | null => {
  if (!item?.id || !item.userId || !item.sessionId) return null;
  return {
    id: String(item.id),
    userId: String(item.userId),
    sessionId: String(item.sessionId),
    callType: (item.callType === 'video' ? 'video' : 'audio') as CallType,
    direction: item.direction === 'outgoing' ? 'outgoing' : 'incoming',
    peerId: String(item.peerId || ''),
    peerName: String(item.peerName || 'Unknown'),
    status: (item.status || 'ended') as CallHistoryEntry['status'],
    duration: typeof item.duration === 'number' ? item.duration : undefined,
    createdAt: item.createdAt || new Date().toISOString(),
    read: item.read ?? item.status !== 'missed',
  };
};

const historyId = (sessionId: string, userId: string) => `ch_${sessionId}_${userId}`;

const mapStatus = (
  raw: string,
  direction: 'incoming' | 'outgoing',
  duration: number,
): CallHistoryEntry['status'] => {
  if (raw === 'ended' && duration > 0) return 'completed';
  if (raw === 'declined') return direction === 'incoming' ? 'declined' : 'missed';
  if (raw === 'busy') return 'busy';
  if (raw === 'missed') return 'missed';
  if (raw === 'completed') return 'completed';
  if (duration > 0) return 'completed';
  return raw as CallHistoryEntry['status'];
};

export async function saveCallHistory(
  entry: Omit<CallHistoryEntry, 'id' | 'createdAt'> & { id?: string },
) {
  const id = entry.id || historyId(entry.sessionId, entry.userId);
  const payload: CallHistoryEntry = {
    ...entry,
    id,
    peerName: entry.peerName || 'Unknown',
    createdAt: new Date().toISOString(),
    read: entry.read ?? entry.status !== 'missed',
  } as CallHistoryEntry;

  if (usesMacData()) {
    try {
      await macSaveDocument<CallHistoryEntry>('callHistory', payload, { merge: true });
      return id;
    } catch {
      // fall through to local cache
    }
  }

  upsertLocal(payload);
  return id;
}

export interface RecordSessionHistoryParams {
  sessionId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  status: string;
  duration: number;
  localUserId: string;
}

/** Save history for both parties (idempotent per session + user). */
export async function recordSessionCallHistory(params: RecordSessionHistoryParams) {
  const {
    sessionId,
    callType,
    callerId,
    callerName,
    calleeId,
    calleeName,
    status,
    duration,
    localUserId,
  } = params;

  if (!sessionId || !callerId || !calleeId) return;

  const callerEntry = {
    userId: callerId,
    sessionId,
    callType,
    direction: 'outgoing' as const,
    peerId: calleeId,
    peerName: calleeName,
    status: mapStatus(status, 'outgoing', duration),
    duration: duration > 0 ? duration : undefined,
    read: mapStatus(status, 'outgoing', duration) !== 'missed',
  };

  const calleeEntry = {
    userId: calleeId,
    sessionId,
    callType,
    direction: 'incoming' as const,
    peerId: callerId,
    peerName: callerName,
    status: mapStatus(status, 'incoming', duration),
    duration: duration > 0 ? duration : undefined,
    read: mapStatus(status, 'incoming', duration) !== 'missed',
  };

  await Promise.all([
    saveCallHistory(callerEntry),
    saveCallHistory(calleeEntry),
  ]);

  return localUserId === callerId ? callerEntry : calleeEntry;
}

export async function getCallHistory(userId: string): Promise<CallHistoryEntry[]> {
  let items: CallHistoryEntry[] = [];

  if (usesMacData()) {
    try {
      const remote = await macListCollection<CallHistoryEntry>('callHistory', {
        orderField: 'createdAt',
        orderDirection: 'desc',
        filters: { userId },
      });
      items = remote.map(normalizeEntry).filter(Boolean) as CallHistoryEntry[];
    } catch {
      items = [];
    }
  }

  const local = readLocal(userId).map(normalizeEntry).filter(Boolean) as CallHistoryEntry[];
  const merged = new Map<string, CallHistoryEntry>();
  [...items, ...local].forEach((entry) => {
    merged.set(entry.id, entry);
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getMissedCallCount(userId: string): Promise<number> {
  const items = await getCallHistory(userId);
  return items.filter((e) => e.status === 'missed' && !e.read).length;
}

export async function markMissedCallsRead(userId: string) {
  const items = await getCallHistory(userId);
  const unread = items.filter((e) => e.status === 'missed' && !e.read);
  await Promise.all(unread.map((e) => markCallRead(e.id, e)));
}

export async function markCallRead(entryId: string, entry: CallHistoryEntry) {
  const updated = { ...entry, id: entryId, read: true };
  if (usesMacData()) {
    try {
      await macSaveDocument('callHistory', updated, { merge: true });
      return;
    } catch {
      // fall through
    }
  }
  upsertLocal(updated);
}

import { macListCollection, macSaveDocument } from './macApiClient';
import { getMacApiConfig } from './macSignalingClient';
import { isMacCallBackend } from './voiceCallService';

export type StaffCallStatus = 'online' | 'offline' | 'unavailable';

export interface CallPresenceEntry {
  id: string;
  userId: string;
  userName: string;
  online: boolean;
  lastSeen: string;
  hasAppAccess?: boolean;
}

const PRESENCE_STALE_MS = 90_000;

export async function setCallPresence(userId: string, userName: string, online = true) {
  if (!isMacCallBackend()) return;
  await macSaveDocument('callPresence', {
    id: userId,
    userId,
    userName,
    online,
    lastSeen: new Date().toISOString(),
    hasAppAccess: true,
  }, { merge: true }).catch(() => {});
}

export async function clearCallPresence(userId: string, userName: string) {
  await setCallPresence(userId, userName, false);
}

export async function fetchCallPresenceMap(): Promise<Record<string, CallPresenceEntry>> {
  if (!isMacCallBackend()) return {};
  try {
    const items = await macListCollection<CallPresenceEntry>('callPresence');
    const map: Record<string, CallPresenceEntry> = {};
    items.forEach((item) => {
      const id = item.userId || item.id;
      if (id) map[id] = { ...item, id };
    });
    return map;
  } catch {
    return {};
  }
}

export async function checkUserOnlineViaApi(userId: string): Promise<boolean> {
  const { apiBase, token } = getMacApiConfig();
  if (!apiBase) return false;
  try {
    const res = await fetch(`${apiBase}/api/calls/online/${encodeURIComponent(userId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.online;
  } catch {
    return false;
  }
}

function isPresenceFresh(entry?: CallPresenceEntry) {
  if (!entry?.lastSeen) return false;
  const ms = new Date(entry.lastSeen).getTime();
  return Date.now() - ms < PRESENCE_STALE_MS;
}

export function resolveStaffCallStatus(
  user: { id: string; hasSystemAccess?: boolean; deleted?: boolean },
  presenceMap: Record<string, CallPresenceEntry>,
  wsOnline?: boolean,
): StaffCallStatus {
  if (user.hasSystemAccess === false || user.deleted) return 'unavailable';
  const entry = presenceMap[user.id];
  if (wsOnline || entry?.online && isPresenceFresh(entry)) return 'online';
  return 'offline';
}

export function isCallable(status: StaffCallStatus) {
  return status !== 'unavailable';
}

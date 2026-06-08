import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../firebase';
import { AmlakSheetKind, User } from '../types';

export interface AmlakSheetPresenceUser {
  userId: string;
  userName: string;
  sheetKind: AmlakSheetKind;
  online: boolean;
  lastSeen: any;
  lastSeenMs: number;
}

const presenceCollection = (buildingId: string) =>
  collection(getDb(), 'amlakSheetPresence', buildingId || 'unknown', 'users');

export async function setAmlakSheetPresence(
  buildingId: string,
  user: User,
  sheetKind: AmlakSheetKind,
  online: boolean,
) {
  if (!buildingId || !user?.id) return;
  await setDoc(doc(presenceCollection(buildingId), user.id), {
    userId: user.id,
    userName: user.name,
    sheetKind,
    online,
    lastSeen: serverTimestamp(),
    lastSeenMs: Date.now(),
  }, { merge: true });
}

export function listenAmlakSheetPresence(
  buildingId: string,
  callback: (presence: Record<string, AmlakSheetPresenceUser>) => void,
) {
  if (!buildingId) return () => {};
  return onSnapshot(presenceCollection(buildingId), snap => {
    const map: Record<string, AmlakSheetPresenceUser> = {};
    snap.docs.forEach(item => {
      const data = item.data() as AmlakSheetPresenceUser;
      map[item.id] = {
        ...data,
        userId: data.userId || item.id,
        lastSeenMs: Number(data.lastSeenMs || 0),
      };
    });
    callback(map);
  });
}

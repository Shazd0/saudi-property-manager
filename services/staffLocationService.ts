import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../firebase';
import { User } from '../types';

export interface StaffLiveLocation {
  userId: string;
  userName: string;
  role?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  online: boolean;
  permission: 'granted' | 'denied' | 'unavailable' | 'unknown';
  updatedAtMs: number;
  updatedAt?: any;
}

const staffLocationsCollection = () => collection(getDb(), 'staffLiveLocations');

export async function reportStaffLocation(user: User, permission: StaffLiveLocation['permission'], position?: GeolocationPosition) {
  if (!user?.id) return;
  await setDoc(doc(staffLocationsCollection(), user.id), {
    userId: user.id,
    userName: user.name || (user as any).displayName || user.id,
    role: String(user.role || ''),
    latitude: position?.coords.latitude,
    longitude: position?.coords.longitude,
    accuracy: position?.coords.accuracy,
    online: true,
    permission,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
}

export function startStaffLocationReporting(user: User): () => void {
  if (!user?.id) return () => {};
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    reportStaffLocation(user, 'unavailable').catch(() => {});
    return () => {};
  }

  let stopped = false;
  const success = (position: GeolocationPosition) => {
    if (!stopped) reportStaffLocation(user, 'granted', position).catch(() => {});
  };
  const failure = (error: GeolocationPositionError) => {
    if (!stopped) reportStaffLocation(user, error.code === error.PERMISSION_DENIED ? 'denied' : 'unknown').catch(() => {});
  };
  const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 };
  navigator.geolocation.getCurrentPosition(success, failure, options);
  const watchId = navigator.geolocation.watchPosition(success, failure, options);
  const heartbeat = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(success, failure, options);
  }, 60000);

  return () => {
    stopped = true;
    navigator.geolocation.clearWatch(watchId);
    window.clearInterval(heartbeat);
    setDoc(doc(staffLocationsCollection(), user.id), {
      online: false,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true }).catch(() => {});
  };
}

export function listenStaffLiveLocations(callback: (locations: Record<string, StaffLiveLocation>) => void): () => void {
  return onSnapshot(staffLocationsCollection(), snap => {
    const map: Record<string, StaffLiveLocation> = {};
    snap.docs.forEach(item => {
      const data = item.data() as StaffLiveLocation;
      map[item.id] = {
        ...data,
        userId: data.userId || item.id,
        updatedAtMs: Number(data.updatedAtMs || 0),
        permission: data.permission || 'unknown',
      };
    });
    callback(map);
  });
}

/** Short-lived in-memory cache to avoid duplicate full Firestore reads on navigation / startup. */

type CacheEntry<T> = { data: T; at: number };

const store = new Map<string, CacheEntry<unknown>>();

export const FIRESTORE_CACHE_TTL_MS = 45_000;

export function getCached<T>(key: string, ttlMs = FIRESTORE_CACHE_TTL_MS): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export function invalidateFirestoreCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

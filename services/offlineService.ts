// ═══════════════════════════════════════════════════════════════
// Amlak Offline Service — IndexedDB cache + offline write queue
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'AmlakOfflineDB';
const DB_VERSION = 1;
const DATA_STORE = 'dataCache';
const QUEUE_STORE = 'offlineQueue';

let dbInstance: IDBDatabase | null = null;

// ─── IndexedDB Initialization ───
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
};

// ─── Generic IDB helpers ───
const idbPut = async (store: string, value: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbGet = async <T = any>(store: string, key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
};

const idbGetAll = async <T = any>(store: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
};

const idbDelete = async (store: string, key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ─── Online/Offline detection ───
let _isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const _listeners: Array<(online: boolean) => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { _isOnline = true; _listeners.forEach(fn => fn(true)); triggerSync(); });
  window.addEventListener('offline', () => { _isOnline = false; _listeners.forEach(fn => fn(false)); });
}

export const isOnline = () => _isOnline;
export const onConnectivityChange = (fn: (online: boolean) => void) => {
  _listeners.push(fn);
  return () => { const idx = _listeners.indexOf(fn); if (idx >= 0) _listeners.splice(idx, 1); };
};

// ─── Data Cache (read-through) ───
export interface CachedData<T = any> {
  key: string;
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 min default TTL

/**
 * Cache a collection snapshot to IndexedDB
 */
export const cacheCollection = async (collectionName: string, data: any[]): Promise<void> => {
  try {
    await idbPut(DATA_STORE, {
      key: `collection:${collectionName}`,
      data,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn('[Offline] Failed to cache collection:', collectionName, e);
  }
};

/**
 * Retrieve a cached collection from IndexedDB
 * Returns null if not cached or expired
 */
export const getCachedCollection = async (collectionName: string, maxAge = CACHE_TTL): Promise<any[] | null> => {
  try {
    const entry = await idbGet<CachedData>(DATA_STORE, `collection:${collectionName}`);
    if (!entry) return null;
    if (maxAge > 0 && Date.now() - entry.timestamp > maxAge) return null;
    return entry.data;
  } catch {
    return null;
  }
};

/**
 * Cache any key-value pair
 */
export const cacheValue = async (key: string, data: any): Promise<void> => {
  try {
    await idbPut(DATA_STORE, { key, data, timestamp: Date.now() });
  } catch (e) {
    console.warn('[Offline] Cache write failed:', key, e);
  }
};

/**
 * Retrieve a cached value
 */
export const getCachedValue = async <T = any>(key: string, maxAge = CACHE_TTL): Promise<T | null> => {
  try {
    const entry = await idbGet<CachedData<T>>(DATA_STORE, key);
    if (!entry) return null;
    if (maxAge > 0 && Date.now() - entry.timestamp > maxAge) return null;
    return entry.data;
  } catch {
    return null;
  }
};

// ─── Offline Write Queue ───
export interface QueuedOperation {
  id: string;
  collection: string;
  docId?: string;
  action: 'set' | 'add' | 'delete';
  data?: any;
  createdAt: number;
  retries: number;
}

/**
 * Queue a write operation for later sync
 */
export const queueWrite = async (op: Omit<QueuedOperation, 'id' | 'createdAt' | 'retries'>): Promise<void> => {
  const queued: QueuedOperation = {
    ...op,
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    retries: 0,
  };
  await idbPut(QUEUE_STORE, queued);
  console.log('[Offline] Queued write:', queued.action, op.collection, op.docId || '(new)');
  
  // Also update the local cache optimistically
  if (op.action === 'set' && op.docId && op.data) {
    const cached = await getCachedCollection(op.collection, Infinity);
    if (cached) {
      const idx = cached.findIndex((d: any) => d.id === op.docId);
      if (idx >= 0) {
        cached[idx] = { ...cached[idx], ...op.data };
      } else {
        cached.push({ ...op.data, id: op.docId });
      }
      await cacheCollection(op.collection, cached);
    }
  } else if (op.action === 'add' && op.data) {
    const cached = await getCachedCollection(op.collection, Infinity);
    if (cached) {
      cached.push(op.data);
      await cacheCollection(op.collection, cached);
    }
  } else if (op.action === 'delete' && op.docId) {
    const cached = await getCachedCollection(op.collection, Infinity);
    if (cached) {
      await cacheCollection(op.collection, cached.filter((d: any) => d.id !== op.docId));
    }
  }

  triggerSync();
};

/**
 * Get pending operations count
 */
export const getPendingCount = async (): Promise<number> => {
  try {
    const all = await idbGetAll<QueuedOperation>(QUEUE_STORE);
    return all.length;
  } catch {
    return 0;
  }
};

/**
 * Get all pending operations
 */
export const getPendingOps = async (): Promise<QueuedOperation[]> => {
  try {
    return await idbGetAll<QueuedOperation>(QUEUE_STORE);
  } catch {
    return [];
  }
};

/**
 * Remove a synced operation from the queue
 */
export const removeSyncedOp = async (id: string): Promise<void> => {
  await idbDelete(QUEUE_STORE, id);
};

// ─── Trigger Background Sync ───
function triggerSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      (reg as any).sync?.register('amlak-offline-sync').catch(() => {
        // Background Sync not supported, will sync on next page load
      });
    });
  }
}

// ─── Manual sync (for browsers without Background Sync) ───
export const manualSync = async (): Promise<{ synced: number; failed: number; conflicts: number }> => {
  const ops = await getPendingOps();
  if (ops.length === 0) return { synced: 0, failed: 0, conflicts: 0 };
  if (!isOnline()) return { synced: 0, failed: ops.length, conflicts: 0 };

  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  // Dynamic import to avoid circular deps
  const { db } = await import('../firebase');
  const { collection, doc, setDoc, addDoc, deleteDoc, getDocs, query, where } = await import('firebase/firestore');

  // ─── Conflict rules per collection ───
  // Each rule defines which fields make a record "duplicate"
  // and optionally a status filter (e.g. only check Active contracts)
  type ConflictRule = {
    fields: string[];           // Fields that together identify a duplicate
    statusField?: string;       // Only match records with this status
    statusValue?: string;       // The status value to match
    clientCheck?: (existing: any, incoming: any) => boolean; // Extra client-side check
    label: (d: any) => string;  // Human-readable description for conflict
  };

  const conflictRules: Record<string, ConflictRule> = {
    contracts: {
      fields: ['buildingId', 'unitName'],
      statusField: 'status',
      statusValue: 'Active',
      label: (d) => `Unit ${d.unitName} already has an active contract`,
    },
    transactions: {
      fields: ['amount', 'date', 'type'],
      clientCheck: (existing, incoming) =>
        (existing.customer === incoming.customer) ||
        (existing.customerId === incoming.customerId) ||
        (existing.employeeId === incoming.employeeId && !!incoming.employeeId),
      label: (d) => `Duplicate ${d.type} of ${d.amount} on ${d.date}`,
    },
    customers: {
      fields: ['mobileNo'],
      label: (d) => `Customer with mobile ${d.mobileNo} already exists`,
    },
    buildings: {
      fields: ['name'],
      label: (d) => `Building "${d.name}" already exists`,
    },
    vendors: {
      fields: ['name'],
      label: (d) => `Vendor "${d.name}" already exists`,
    },
    employees: {
      fields: ['name'],
      clientCheck: (existing, incoming) =>
        (existing.phone === incoming.phone && !!incoming.phone) ||
        (existing.mobileNo === incoming.mobileNo && !!incoming.mobileNo),
      label: (d) => `Employee "${d.name}" already exists`,
    },
    tasks: {
      fields: ['title', 'userId'],
      label: (d) => `Task "${d.title}" already exists for this user`,
    },
    cars: {
      fields: ['plateNumber'],
      label: (d) => `Car with plate ${d.plateNumber} already registered`,
    },
    stocks: {
      fields: ['name', 'buildingId'],
      label: (d) => `Stock "${d.name}" already exists in this building`,
    },
    stockItems: {
      fields: ['name', 'stockId'],
      label: (d) => `Item "${d.name}" already exists in this stock`,
    },
    stockTransfers: {
      fields: ['itemId', 'fromBuildingId', 'toBuildingId', 'date'],
      label: (d) => `Duplicate transfer of item on ${d.date}`,
    },
    borrowings: {
      fields: ['employeeId', 'amount', 'date'],
      label: (d) => `Borrowing of ${d.amount} on ${d.date} already exists`,
    },
  };

  for (const op of ops) {
    try {
      // ─── Conflict detection for ALL 'add' operations ───
      if (op.action === 'add' && op.data) {
        const rule = conflictRules[op.collection];
        if (rule) {
          // Build Firestore query from the rule's fields
          const fieldValues = rule.fields.map(f => ({ field: f, value: op.data[f] }));
          const allFieldsPresent = fieldValues.every(fv => fv.value !== undefined && fv.value !== null && fv.value !== '');

          if (allFieldsPresent) {
            // Build query with up to the Firestore limit of conditions
            let q: any = collection(db, op.collection);
            const conditions: any[] = [];
            for (const fv of fieldValues) {
              conditions.push(where(fv.field, '==', fv.value));
            }
            if (rule.statusField && rule.statusValue) {
              conditions.push(where(rule.statusField, '==', rule.statusValue));
            }
            q = query(q, ...conditions);

            const snap = await getDocs(q);
            let isDuplicate = snap.size > 0;

            // If there's a client-side check, apply it
            if (isDuplicate && rule.clientCheck) {
              isDuplicate = snap.docs.some((d: any) => rule.clientCheck!(d.data(), op.data));
            }

            if (isDuplicate) {
              const reason = rule.label(op.data);

              // For contracts: save as 'Conflict' status so admin can review
              if (op.collection === 'contracts') {
                await addDoc(collection(db, op.collection), {
                  ...op.data,
                  status: 'Conflict',
                  _conflict: true,
                  _conflictReason: reason,
                  _conflictWith: snap.docs[0]?.id || '',
                  _conflictAt: new Date().toISOString(),
                  _originalStatus: op.data.status || 'Active',
                });
              }
              // For other collections: just skip the duplicate (don't create it)

              await removeSyncedOp(op.id);
              conflicts++;
              console.warn(`[Offline] Conflict in ${op.collection}: ${reason}`);
              continue;
            }
          }
        }
      }

      // ─── Normal sync ───
      if (op.action === 'set' && op.docId) {
        await setDoc(doc(db, op.collection, op.docId), op.data, { merge: true });
      } else if (op.action === 'add') {
        await addDoc(collection(db, op.collection), op.data);
      } else if (op.action === 'delete' && op.docId) {
        await deleteDoc(doc(db, op.collection, op.docId));
      }
      await removeSyncedOp(op.id);
      synced++;
    } catch (e) {
      console.warn('[Offline] Sync failed for op:', op.id, e);
      // Increment retries
      op.retries++;
      await idbPut(QUEUE_STORE, op);
      failed++;
    }
  }

  // Notify listeners
  _listeners.forEach(fn => fn(_isOnline));
  return { synced, failed, conflicts };
};

// ─── Auto-sync when coming online ───
let _autoSyncTimer: any = null;
let _syncInProgress = false;

const autoSync = async () => {
  if (_syncInProgress || !_isOnline) return;
  _syncInProgress = true;
  try {
    const result = await manualSync();
    if (result.synced > 0) {
      console.log(`[Offline] Auto-synced ${result.synced} operations`);
    }
  } catch { /* silent */ }
  _syncInProgress = false;
};

if (typeof window !== 'undefined') {
  // Sync immediately when coming online
  window.addEventListener('online', () => {
    // Quick sync after 500ms (let connection stabilize)
    setTimeout(autoSync, 500);
    // Retry again at 3s in case first attempt had issues
    setTimeout(autoSync, 3000);
  });

  // Periodic auto-sync every 30 seconds while online
  _autoSyncTimer = setInterval(() => {
    if (_isOnline) autoSync();
  }, 30_000);

  // Sync when user returns to tab (visibility change)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _isOnline) {
      setTimeout(autoSync, 300);
    }
  });

  // Sync before page unload (best-effort)
  window.addEventListener('beforeunload', () => {
    if (_isOnline) {
      // Use sendBeacon or sync synchronously — best effort
      autoSync();
    }
  });
}

// ─── Listen for SW sync completion messages ───
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'OFFLINE_SYNC_COMPLETE') {
      console.log(`[Offline] SW synced ${event.data.count} operations`);
      _listeners.forEach(fn => fn(_isOnline));
    }
  });
}

// Helper: wrap a promise with a timeout
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((result) => { clearTimeout(timer); resolve(result); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
};

const NETWORK_TIMEOUT = 10000; // 10 seconds timeout for network requests

/**
 * Wrap a Firestore read with offline cache fallback
 * Usage: const data = await offlineRead('transactions', () => firestoreGetTransactions());
 */
export const offlineRead = async <T extends any[]>(
  collectionName: string,
  fetchFn: () => Promise<T>,
  maxAge = CACHE_TTL
): Promise<T> => {
  // Try network first
  if (isOnline()) {
    try {
      const data = await withTimeout(fetchFn(), NETWORK_TIMEOUT, `Network timeout for ${collectionName}`);
      // Cache the result
      await cacheCollection(collectionName, data);
      return data;
    } catch (e) {
      console.warn(`[Offline] Network read failed for ${collectionName}, falling back to cache`);
      const cached = await getCachedCollection(collectionName, Infinity);
      if (cached) return cached as T;
      // If no cache and we got a timeout, return empty array instead of throwing
      if (e instanceof Error && e.message.includes('timeout')) {
        console.warn(`[Offline] No cache for ${collectionName}, returning empty array`);
        return [] as unknown as T;
      }
      throw e;
    }
  }

  // Offline: return from cache  
  const cached = await getCachedCollection(collectionName, Infinity);
  if (cached) return cached as T;

  // No cache available
  console.warn(`[Offline] No cached data for ${collectionName}`);
  return [] as unknown as T;
};

/**
 * Wrap a Firestore write with offline queue fallback
 */
export const offlineWrite = async (
  collectionName: string,
  docId: string | undefined,
  action: 'set' | 'add' | 'delete',
  data: any,
  writeFn: () => Promise<any>
): Promise<any> => {
  if (isOnline()) {
    try {
      const result = await writeFn();
      // Update cache
      if (action === 'delete') {
        const cached = await getCachedCollection(collectionName, Infinity);
        if (cached && docId) {
          await cacheCollection(collectionName, cached.filter((d: any) => d.id !== docId));
        }
      }
      return result;
    } catch (e) {
      console.warn(`[Offline] Write failed, queueing for later:`, e);
      await queueWrite({ collection: collectionName, docId, action, data });
      return { id: docId || `pending_${Date.now()}`, _offline: true };
    }
  }

  // Offline: queue the write
  await queueWrite({ collection: collectionName, docId, action, data });
  return { id: docId || `pending_${Date.now()}`, _offline: true };
};

/**
 * Clear all cached data (useful for logout)
 */
export const clearOfflineData = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction([DATA_STORE, QUEUE_STORE], 'readwrite');
    tx.objectStore(DATA_STORE).clear();
    tx.objectStore(QUEUE_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[Offline] Clear failed:', e);
  }
};

// ═══════════════════════════════════════════════════════════════════
// Amlak Offline Sync — File-based data transfer between devices
// Works WITHOUT internet, WiFi, or any network connection
// Export → Transfer via Bluetooth/USB/AirDrop/NFC → Import
// ═══════════════════════════════════════════════════════════════════

const SYNC_FILE_VERSION = 1;
const SYNC_COLLECTIONS = [
  'transactions', 'customers', 'buildings', 'contracts',
  'vendors', 'tasks', 'employees', 'stocks', 'stockItems',
  'stockTransfers', 'cars', 'borrowings', 'units', 'settings',
  'banks', 'approvals',
];

interface SyncPackage {
  version: number;
  exportedAt: string;
  deviceId: string;
  collections: Record<string, any[]>;
  metadata: {
    totalRecords: number;
    collectionCounts: Record<string, number>;
  };
}

// ─── Read all data from IndexedDB offline cache ───
const getAllCachedData = (): Promise<Record<string, any[]>> => {
  return new Promise((resolve) => {
    const req = indexedDB.open('AmlakOfflineDB', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('dataCache')) {
        db.close();
        resolve({});
        return;
      }
      const tx = db.transaction('dataCache', 'readonly');
      const store = tx.objectStore('dataCache');
      const getAll = store.getAll();

      getAll.onsuccess = () => {
        const result: Record<string, any[]> = {};
        for (const item of getAll.result || []) {
          if (item.key?.startsWith('collection_')) {
            const name = item.key.replace('collection_', '');
            if (SYNC_COLLECTIONS.includes(name) && Array.isArray(item.data)) {
              result[name] = item.data;
            }
          }
        }
        db.close();
        resolve(result);
      };
      getAll.onerror = () => { db.close(); resolve({}); };
    };
    req.onerror = () => resolve({});
  });
};

// ─── Also try to read from Firestore directly if available (best effort) ───
const getFirestoreDataIfOnline = async (): Promise<Record<string, any[]>> => {
  try {
    const { db } = await import('../firebase');
    const { collection, getDocs } = await import('firebase/firestore');
    const result: Record<string, any[]> = {};

    for (const name of SYNC_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, name));
        result[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        // Skip collections that error (permissions, etc.)
      }
    }
    return result;
  } catch {
    return {};
  }
};

// ─── Merge imported data into local IndexedDB ───
const mergeIntoLocalCache = (incoming: Record<string, any[]>): Promise<number> => {
  return new Promise((resolve) => {
    let totalMerged = 0;
    const req = indexedDB.open('AmlakOfflineDB', 1);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('dataCache')) {
        db.createObjectStore('dataCache', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      const collNames = Object.keys(incoming);
      if (collNames.length === 0) { db.close(); resolve(0); return; }

      const tx = db.transaction('dataCache', 'readwrite');
      const store = tx.objectStore('dataCache');
      let processed = 0;

      for (const collName of collNames) {
        const key = `collection_${collName}`;
        const getReq = store.get(key);

        getReq.onsuccess = () => {
          const existing: any[] = getReq.result?.data || [];
          const incomingItems: any[] = incoming[collName] || [];
          const map = new Map<string, any>();

          // Add existing
          for (const item of existing) {
            if (item.id) map.set(item.id, item);
          }

          // Merge incoming — newer timestamp wins
          for (const item of incomingItems) {
            if (!item.id) continue;
            const current = map.get(item.id);
            if (!current) {
              map.set(item.id, item);
              totalMerged++;
            } else {
              // Compare timestamps
              const curTs = getTimestamp(current);
              const incTs = getTimestamp(item);
              if (incTs > curTs) {
                map.set(item.id, item);
                totalMerged++;
              }
            }
          }

          store.put({ key, data: Array.from(map.values()), ts: Date.now() });
          processed++;
          if (processed === collNames.length) { db.close(); resolve(totalMerged); }
        };

        getReq.onerror = () => {
          processed++;
          if (processed === collNames.length) { db.close(); resolve(totalMerged); }
        };
      }
    };

    req.onerror = () => resolve(0);
  });
};

// Extract best available timestamp from a record
const getTimestamp = (item: any): number => {
  if (item.updatedAt?.seconds) return item.updatedAt.seconds * 1000;
  if (item.updatedAt?.toMillis) return item.updatedAt.toMillis();
  if (item.updatedAt) return new Date(item.updatedAt).getTime() || 0;
  if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
  if (item.createdAt) return new Date(item.createdAt).getTime() || 0;
  if (item.date) return new Date(item.date).getTime() || 0;
  if (item.timestamp) return typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime() || 0;
  return 0;
};

const getDeviceId = (): string => {
  let id = localStorage.getItem('amlak_device_id');
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('amlak_device_id', id);
  }
  return id;
};

// ═══ PUBLIC API ═══

/** Export all app data as a downloadable JSON file */
export const exportSyncPackage = async (): Promise<void> => {
  // Try Firestore first (freshest data), fall back to IndexedDB cache
  let collections = await getFirestoreDataIfOnline();
  const firestoreCount = Object.values(collections).reduce((sum, arr) => sum + arr.length, 0);

  if (firestoreCount === 0) {
    collections = await getAllCachedData();
  }

  const totalRecords = Object.values(collections).reduce((sum, arr) => sum + arr.length, 0);
  if (totalRecords === 0) {
    throw new Error('No data to export. Use the app first to create some records.');
  }

  const collectionCounts: Record<string, number> = {};
  for (const [name, arr] of Object.entries(collections)) {
    collectionCounts[name] = arr.length;
  }

  const pkg: SyncPackage = {
    version: SYNC_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    collections,
    metadata: { totalRecords, collectionCounts },
  };

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `amlak-sync-${date}.json`;

  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Share sync package via Web Share API (Bluetooth, AirDrop, etc.) */
export const shareSyncPackage = async (): Promise<void> => {
  let collections = await getFirestoreDataIfOnline();
  const firestoreCount = Object.values(collections).reduce((sum, arr) => sum + arr.length, 0);
  if (firestoreCount === 0) collections = await getAllCachedData();

  const totalRecords = Object.values(collections).reduce((sum, arr) => sum + arr.length, 0);
  if (totalRecords === 0) throw new Error('No data to export.');

  const collectionCounts: Record<string, number> = {};
  for (const [name, arr] of Object.entries(collections)) collectionCounts[name] = arr.length;

  const pkg: SyncPackage = {
    version: SYNC_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    collections,
    metadata: { totalRecords, collectionCounts },
  };

  const json = JSON.stringify(pkg);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([blob], `amlak-sync-${date}.json`, { type: 'application/json' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: 'Amlak Sync Data',
      text: `Amlak data export — ${totalRecords} records`,
      files: [file],
    });
  } else {
    throw new Error('Native sharing not available on this device. Use the Download button instead.');
  }
};

/** Import a sync file and merge data into local cache */
export const importSyncPackage = async (file: File): Promise<number> => {
  const text = await file.text();
  let pkg: SyncPackage;

  try {
    pkg = JSON.parse(text);
  } catch {
    throw new Error('Invalid file — not a valid Amlak sync package.');
  }

  if (!pkg.version || !pkg.collections) {
    throw new Error('Invalid file format — missing required fields.');
  }

  if (pkg.deviceId === getDeviceId()) {
    // Importing own export — still valid, useful for restore
  }

  const merged = await mergeIntoLocalCache(pkg.collections);

  // Also try to push merged data to Firestore if online
  try {
    if (navigator.onLine) {
      const { db } = await import('../firebase');
      const { doc, setDoc, collection } = await import('firebase/firestore');

      for (const [collName, items] of Object.entries(pkg.collections)) {
        for (const item of items) {
          if (!item.id) continue;
          try {
            // Remove any non-serializable fields
            const clean = JSON.parse(JSON.stringify(item));
            delete clean.id;
            await setDoc(doc(collection(db, collName), item.id), clean, { merge: true });
          } catch {
            // Skip individual failures
          }
        }
      }
    }
  } catch {
    // Firestore push is best-effort
  }

  return merged;
};

/** Check if Web Share API supports file sharing */
export const canNativeShare = (): boolean => {
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    const testFile = new File(['test'], 'test.json', { type: 'application/json' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
};

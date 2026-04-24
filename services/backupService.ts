// Backup Service - Auto-backup & Local Storage Management
import { generateBackup, restoreBackup } from './firestoreService';

const DB_NAME = 'AmlakBackupDB';
const STORE_NAME = 'backups';
const DB_VERSION = 1;
const LAST_BACKUP_KEY = 'lastAutoBackupDate';

export interface BackupRecord {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  size: number; // bytes
  data: string; // JSON backup data
}

let backupLock = false;
let backupPromise: Promise<BackupRecord | null> | null = null;

// Generate UUID v4 (compatible with all browsers)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: true });
      }
    };
  });
};

// Save backup to local storage (IndexedDB)
export const saveBackupToLocal = async (backupData: string): Promise<BackupRecord> => {
  try {
    const db = await initDB();
    const now = new Date();
    const backupRecord: BackupRecord = {
      id: `backup_${Date.now()}`,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      size: new Blob([backupData]).size,
      data: backupData
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(backupRecord);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(backupRecord);
    });
  } catch (error) {
    console.error('Failed to save backup:', error);
    throw error;
  }
};

// Get all backups from Firestore
export const getAllBackups = async (): Promise<BackupRecord[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const backups = request.result as BackupRecord[];
        resolve(backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
    });
  } catch (error) {
    console.error('Failed to get backups:', error);
    return [];
  }
};

// Get backups by date
export const getBackupsByDate = async (date: string): Promise<BackupRecord[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('date');
      const request = index.getAll(date);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as BackupRecord[]);
    });
  } catch (error) {
    console.error('Failed to get backups by date:', error);
    return [];
  }
};

// Delete backup by ID
export const deleteBackup = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to delete backup:', error);
    throw error;
  }
};

// Restore from backup record
export const restoreFromBackupRecord = async (backup: BackupRecord): Promise<boolean> => {
  try {
    return await restoreBackup(backup.data);
  } catch (error) {
    console.error('Failed to restore backup:', error);
    return false;
  }
};

// Perform automatic daily backup
export const performAutoBackup = async (force: boolean = false): Promise<BackupRecord | null> => {
  // If backup is already in progress, return the existing promise
  if (backupPromise) {
    console.log('Backup already in progress, waiting for completion...');
    return backupPromise;
  }

  // Create new backup promise with timeout
  backupPromise = (async () => {
    try {
      console.log('Starting backup process...');
      
      // Check if we already backed up today (unless forced)
      const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
      const today = new Date().toISOString().split('T')[0];

      if (!force && lastBackup === today) {
        console.log('Already backed up today, skipping');
        return null;
      }

      console.log('Generating backup data...');
      // Generate and save backup
      const backupData = await generateBackup();
      
      console.log('Saving backup to IndexedDB...');
      const backupRecord = await saveBackupToLocal(backupData);

      // Mark backup date AFTER successful save
      localStorage.setItem(LAST_BACKUP_KEY, today);

      console.log('✅ Auto backup completed:', backupRecord.id);
      return backupRecord;
    } catch (error) {
      console.error('❌ Auto backup failed:', error);
      return null;
    } finally {
      // Always clear the promise, even on error
      console.log('Clearing backup lock...');
      setTimeout(() => {
        backupPromise = null;
      }, 100);
    }
  })();

  return backupPromise;
};

// Check if auto-backup is needed and perform it
export const checkAndPerformAutoBackup = async (): Promise<void> => {
  try {
    await performAutoBackup();
  } catch (error) {
    console.error('Auto backup check failed:', error);
  }
};

// Clear all backups
export const clearAllBackups = async (): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear backups:', error);
    throw error;
  }
};

// Get backup storage stats
export const getBackupStats = async () => {
  try {
    const backups = await getAllBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    return {
      count: backups.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null
    };
  } catch (error) {
    console.error('Failed to get backup stats:', error);
    return { count: 0, totalSizeBytes: 0, totalSizeMB: '0', oldestBackup: null, newestBackup: null };
  }
};

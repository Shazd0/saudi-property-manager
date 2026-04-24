
// Real-time sync - Auto-backup on every change, Auto-restore on load
// Single shared folder for all users

import { 
  collection, 
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

// GOOGLE DRIVE SETTINGS - CONFIGURED
const SHARED_BACKUP_FOLDER_ID = '113d0usitCgkEPNCjiaOXRo1azKzEeLG-'; // Publicly shared Google Drive folder
const GOOGLE_DRIVE_API_KEY = 'AIzaSyA5OWrIIE8NA8L9j1UVdcXXhqSrR0_tz9A';
const BACKUP_FILENAME = 'property-manager-backup-latest.json';
const BACKUP_HISTORY_FILENAME = 'property-manager-backups.json';

export interface CloudBackup {
  id: string;
  timestamp: number;
  date: string;
  size: number;
  userId: string;
  userName: string;
  version: string;
}

// Initialize Google API
export const initializeGoogleDrive = (accessToken: string) => {
  localStorage.setItem('gdrive_access_token', accessToken);
};

// Get access token
const getAccessToken = (): string | null => {
  return localStorage.getItem('gdrive_access_token');
};

// Get all data for backup
export const collectAllData = async () => {
  try {
    const [transactions, customers, buildings, users, contracts, vendors, tasks, banks, settings] = 
      await Promise.all([
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'contracts')),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'banks')),
        getDocs(collection(db, 'meta')),
      ]);

    return {
      timestamp: Date.now(),
      version: '2.0',
      data: {
        transactions: transactions.docs.map(d => ({ id: d.id, ...d.data() })),
        customers: customers.docs.map(d => ({ id: d.id, ...d.data() })),
        buildings: buildings.docs.map(d => ({ id: d.id, ...d.data() })),
        users: users.docs.map(d => ({ id: d.id, ...d.data() })),
        contracts: contracts.docs.map(d => ({ id: d.id, ...d.data() })),
        vendors: vendors.docs.map(d => ({ id: d.id, ...d.data() })),
        tasks: tasks.docs.map(d => ({ id: d.id, ...d.data() })),
        banks: banks.docs.map(d => ({ id: d.id, ...d.data() })),
        settings: settings.docs.length > 0 ? settings.docs[0].data() : {},
      },
    };
  } catch (error) {
    console.error('Error collecting data:', error);
    throw error;
  }
};

// Save backup to Google Drive (overwrites latest)
export const saveToGoogleDrive = async (
  backupData: any,
  userId: string,
  userName: string,
  accessToken?: string
): Promise<boolean> => {
  try {
    const token = accessToken || getAccessToken();
    if (!token) {
      console.error('No Google Drive access token');
      return false;
    }

    const timestamp = new Date(backupData.timestamp);
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      parents: [SHARED_BACKUP_FOLDER_ID],
      description: `Backup - ${timestamp.toLocaleString()} by ${userName}`,
    };

    const fileData = {
      ...backupData,
      backupMeta: {
        userId,
        userName,
        timestamp: backupData.timestamp,
      },
    };

    // Find existing file
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}' and parents='${SHARED_BACKUP_FOLDER_ID}' and trashed=false&spaces=drive&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchResponse.json();
    const fileId = searchData.files?.[0]?.id;

    const uploadUrl = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const method = fileId ? 'PATCH' : 'POST';

    const response = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fileData),
    });

    if (response.ok) {
      console.log(`✅ Backup saved to Google Drive at ${timestamp.toLocaleString()}`);
      // Also save to history
      await appendToBackupHistory(backupData, userId, userName, token);
      return true;
    } else {
      console.error('Upload failed:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error saving to Google Drive:', error);
    return false;
  }
};

// Append to backup history (keep all versions)
const appendToBackupHistory = async (
  backupData: any,
  userId: string,
  userName: string,
  accessToken: string
) => {
  try {
    // Get existing history
    const historyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_HISTORY_FILENAME}' and parents='${SHARED_BACKUP_FOLDER_ID}' and trashed=false&spaces=drive&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const historyData = await historyResponse.json();
    const historyFileId = historyData.files?.[0]?.id;

    let historyContent: any[] = [];

    if (historyFileId) {
      const getResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${historyFileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (getResponse.ok) {
        historyContent = await getResponse.json();
      }
    }

    // Add new backup entry
    historyContent.unshift({
      id: `backup-${backupData.timestamp}`,
      timestamp: backupData.timestamp,
      date: new Date(backupData.timestamp).toISOString(),
      size: JSON.stringify(backupData).length,
      userId,
      userName,
      version: backupData.version,
    });

    // Keep last 100 in history
    historyContent = historyContent.slice(0, 100);

    // Upload updated history
    const uploadUrl = historyFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${historyFileId}?uploadType=media`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const method = historyFileId ? 'PATCH' : 'POST';

    await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(historyContent),
    });
  } catch (error) {
    console.error('Error updating backup history:', error);
  }
};

// Restore from latest Google Drive backup
export const restoreFromCloudBackup = async (accessToken?: string): Promise<boolean> => {
  try {
    const token = accessToken || getAccessToken();
    if (!token) {
      console.error('No Google Drive access token');
      return false;
    }

    // Get latest backup file
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}' and parents='${SHARED_BACKUP_FOLDER_ID}' and trashed=false&spaces=drive&fields=files(id,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const searchData = await searchResponse.json();
    const fileId = searchData.files?.[0]?.id;

    if (!fileId) {
      console.error('No backup found in Google Drive');
      return false;
    }

    // Download backup
    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!getResponse.ok) {
      console.error('Failed to download backup');
      return false;
    }

    const backupData = await getResponse.json();
    return await restoreDataToFirestore(backupData);
  } catch (error) {
    console.error('Error restoring from cloud backup:', error);
    return false;
  }
};

// Restore data to Firestore
const restoreDataToFirestore = async (backupData: any): Promise<boolean> => {
  try {
    const collections = [
      { name: 'transactions', data: backupData.data.transactions },
      { name: 'customers', data: backupData.data.customers },
      { name: 'buildings', data: backupData.data.buildings },
      { name: 'users', data: backupData.data.users },
      { name: 'contracts', data: backupData.data.contracts },
      { name: 'vendors', data: backupData.data.vendors },
      { name: 'tasks', data: backupData.data.tasks },
      { name: 'banks', data: backupData.data.banks },
    ];

    for (const col of collections) {
      for (const item of col.data) {
        const { id, ...data } = item;
        await setDoc(doc(db, col.name, id), data);
      }
    }

    console.log('✅ Data restored from cloud backup');
    return true;
  } catch (error) {
    console.error('Error restoring data:', error);
    return false;
  }
};

// Get backup history from Google Drive
export const getBackupHistory = async (accessToken?: string): Promise<CloudBackup[]> => {
  try {
    const token = accessToken || getAccessToken();
    if (!token) return [];

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_HISTORY_FILENAME}' and parents='${SHARED_BACKUP_FOLDER_ID}' and trashed=false&spaces=drive&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();
    const fileId = data.files?.[0]?.id;

    if (!fileId) return [];

    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (getResponse.ok) {
      return await getResponse.json();
    }
    return [];
  } catch (error) {
    console.error('Error getting backup history:', error);
    return [];
  }
};

// Auto-backup on data change (call this from firestoreService)
let lastBackupTime = Date.now();
const BACKUP_DEBOUNCE = 5000; // Wait 5 seconds between backups

export const triggerAutoBackup = async (userId: string, userName: string, accessToken?: string) => {
  try {
    // Debounce: don't backup too frequently
    const now = Date.now();
    if (now - lastBackupTime < BACKUP_DEBOUNCE) {
      return;
    }
    lastBackupTime = now;

    console.log('⏳ Auto-backup triggered...');
    const backupData = await collectAllData();
    const success = await saveToGoogleDrive(backupData, userId, userName, accessToken);
    
    if (success) {
      console.log('✅ Auto-backup completed');
    }
  } catch (error) {
    console.error('Auto-backup failed:', error);
  }
};

// Setup: Auto-restore on app load if first time
export const setupCloudBackup = async (userId: string, userName: string, accessToken: string) => {
  try {
    // Check if this is first load (no local data indicator)
    const hasLocalData = localStorage.getItem('app_initialized');

    if (!hasLocalData) {
      console.log('🔄 First app load - attempting to restore from cloud...');
      const restored = await restoreFromCloudBackup(accessToken);
      if (restored) {
        console.log('✅ Data restored from cloud on first load');
      }
    }

    // Mark as initialized
    localStorage.setItem('app_initialized', 'true');

    // Return cleanup function (optional)
    return () => {
      console.log('Cloud backup cleanup');
    };
  } catch (error) {
    console.error('Setup failed:', error);
  }
};

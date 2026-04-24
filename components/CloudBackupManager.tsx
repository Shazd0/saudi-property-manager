
import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, Trash2, Clock, CheckCircle, AlertCircle, RefreshCw, Share2 } from 'lucide-react';
import { getBackupHistory, restoreFromCloudBackup, triggerAutoBackup } from '../services/cloudBackupService';
import { User } from '../types';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

interface CloudBackup {
  id: string;
  timestamp: number;
  date: string;
  size: number;
  userId: string;
  userName: string;
  version: string;
}

interface CloudBackupManagerProps {
  currentUser: User;
  accessToken?: string;
}

export const CloudBackupManager: React.FC<CloudBackupManagerProps> = ({ currentUser, accessToken }) => {
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('Confirm');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  const openConfirm = (messageText: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
    setConfirmTitle(opts?.title || 'Confirm');
    setConfirmDanger(!!opts?.danger);
    setConfirmMessage(messageText);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmMessage('');
    setConfirmAction(null);
  };

  useEffect(() => {
    loadBackupHistory();
    const timer = setInterval(loadBackupHistory, 30000); // Refresh every 30s
    return () => clearInterval(timer);
  }, []);

  const loadBackupHistory = async () => {
    try {
      const history = await getBackupHistory(accessToken);
      setBackups(history.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Error loading backup history:', error);
    }
  };

  const handleManualBackup = async () => {
    SoundService.play('submit');
    setLoading(true);
    try {
      await triggerAutoBackup(currentUser.id, currentUser.name, accessToken);
      setMessage({ type: 'success', text: '✅ Backup uploaded to cloud!' });
      setTimeout(() => loadBackupHistory(), 1000);
    } catch (error) {
      setMessage({ type: 'error', text: `❌ Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRestore = async (backupId: string) => {
    openConfirm('This will overwrite ALL current data with the backup. Are you sure?', async () => {
      setLoading(true);
      try {
        const success = await restoreFromCloudBackup(accessToken);
        if (success) {
          setMessage({ type: 'success', text: '✅ Data restored! Page will reload...' });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setMessage({ type: 'error', text: '❌ Restore failed' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` });
      } finally {
        setLoading(false);
        setTimeout(() => setMessage(null), 3000);
      }
      closeConfirm();
    }, { danger: true, title: 'Restore Backup' });
  };

  const formatDate = (timestamp: number) => fmtDateTime(timestamp);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">☁️ Cloud Backup Manager</h2>
        </div>
        <div className="text-sm text-gray-600">
          All users · Shared folder · Real-time sync
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Status */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">📊 Backup Status</h3>
            <p className="text-gray-600">
              {backups.length === 0 ? 'No backups yet' : `Latest: ${formatDate(backups[0].timestamp)}`}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              📁 Location: Shared Google Drive Folder (All users access same backups)
            </p>
          </div>
          <button
            onClick={handleManualBackup}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span> Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Backup Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">⚡ Real-Time Sync</h4>
          <p className="text-sm text-blue-800">Every change is automatically backed up to cloud</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-900 mb-2">👥 Shared Folder</h4>
          <p className="text-sm text-green-800">All users access same backup - no conflicts</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h4 className="font-semibold text-purple-900 mb-2">🔄 Auto-Restore</h4>
          <p className="text-sm text-purple-800">New users auto-restore data on first load</p>
        </div>
      </div>

      {/* Backup History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">📜 Backup History (Last 100)</h3>
          <button
            onClick={loadBackupHistory}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No backups yet. Click "Backup Now" to create first backup.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {backups.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50 transition">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                      ☁️ Cloud
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {backup.userName} • {formatSize(backup.size)}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(backup.timestamp)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{getTimeSince(backup.timestamp)}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(backup.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded transition disabled:opacity-50"
                    title="Restore to this version"
                  >
                    <Download className="w-4 h-4" />{t('history.restore')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">💡 How It Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Every data change triggers auto-backup to cloud</li>
          <li>✓ All backups stored in shared Google Drive folder</li>
          <li>✓ New users automatically restore latest backup</li>
          <li>✓ Keep last 100 versions in history</li>
          <li>✓ Manual "Backup Now" for immediate save</li>
          <li>✓ Restore any previous version instantly</li>
        </ul>
      </div>

      {/* Configuration Needed */}
      {!accessToken && (
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h4 className="font-semibold text-orange-900 mb-2">⚙️ Setup Required</h4>
          <p className="text-sm text-orange-800 mb-2">
            To enable cloud backups, set up Google Drive integration in Settings.
          </p>
          <p className="text-sm text-orange-700">
            You need: Google Drive access token + Shared folder ID
          </p>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        danger={confirmDanger}
        onConfirm={() => confirmAction && confirmAction()}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default CloudBackupManager;

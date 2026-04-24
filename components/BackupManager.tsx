import React, { useState, useEffect } from 'react';
import { Cloud, Download, Upload, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { performAutoBackup, getAllBackups, getBackupStats, restoreFromBackupRecord, deleteBackup, BackupRecord } from '../services/backupService';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

export const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
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
    loadBackups();
    const timer = setInterval(loadBackups, 30000); // Refresh every 30s
    return () => clearInterval(timer);
  }, []);

  const loadBackups = async () => {
    const allBackups = await getAllBackups();
    setBackups(allBackups);
    const stats = await getBackupStats();
    setLastBackup(stats.newestBackup ? new Date(stats.newestBackup).getTime() : null);
  };

  const handleManualBackup = async () => {
    SoundService.play('submit');
    setLoading(true);
    try {
      const result = await performAutoBackup(true);
      if (result) {
        setMessage({ type: 'success', text: `✅ Manual backup created: ${result.id}` });
        loadBackups();
      } else {
        setMessage({ type: 'error', text: '❌ Backup failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRestore = async (backupId: string) => {
    openConfirm('This will overwrite all current data. Are you sure?', async () => {
      setLoading(true);
      try {
        const backup = backups.find(b => b.id === backupId);
        if (backup) {
          const success = await restoreFromBackupRecord(backup);
          if (success) {
            setMessage({ type: 'success', text: '✅ Data restored successfully!' });
            setTimeout(() => window.location.reload(), 2000);
          } else {
            setMessage({ type: 'error', text: '❌ Restore failed' });
          }
        } else {
          setMessage({ type: 'error', text: '❌ Backup not found' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
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
          <h2 className="text-2xl font-bold">Backup & Restore</h2>
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

      {/* Backup Status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Backup Status</h3>
            {lastBackup ? (
              <p className="text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last backup: <strong>{formatDate(lastBackup)}</strong>
              </p>
            ) : (
              <p className="text-gray-600">No backups yet</p>
            )}
          </div>
          <button
            onClick={handleManualBackup}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span> Creating...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Create Backup Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h4 className="font-semibold text-purple-900 mb-2">🔄 Automatic Backups</h4>
          <p className="text-sm text-purple-800">Runs daily in the background. Up to 20 backups kept.</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-900 mb-2">📦 Manual Backups</h4>
          <p className="text-sm text-green-800">Create backups on demand before major changes.</p>
        </div>
      </div>

      {/* Backups List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Backup History</h3>
        {backups.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No backups yet. Create your first backup to get started.</p>
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
                      <p className="font-medium text-gray-800">{backup.id}</p>
                      <p className="text-sm text-gray-500">{formatSize(backup.size)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{formatDate(new Date(backup.timestamp).getTime())}</p>
                    <p className="text-xs text-gray-500">{getTimeSince(new Date(backup.timestamp).getTime())}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(backup.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded transition disabled:opacity-50"
                    title="Restore from this backup"
                  >
                    <Download className="w-4 h-4" />{t('history.restore')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Backups are stored locally and synced to Google Drive (if enabled)</li>
          <li>✓ Automatic backups run daily at a scheduled time</li>
          <li>✓ Keep important backups - they're your safety net</li>
          <li>✓ Restoring will overwrite all current data - make sure this is what you want!</li>
        </ul>
      </div>
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

export default BackupManager;

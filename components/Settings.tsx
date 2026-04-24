
import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, generateBackup, restoreBackup, resetSystem, getAuditLogs, getBanks, saveBank, deleteBank, uploadProfilePhoto } from '../services/firestoreService';
import { getAllBackups, deleteBackup, restoreFromBackupRecord, getBackupStats, performAutoBackup, BackupRecord } from '../services/backupService';
import { getUserStats, getAllUsersStats, getCurrentSessionDuration, formatDuration, UsageStats } from '../services/screenTimeService';
import { SystemSettings, AuditLog, UserRole, User, Bank } from '../types';
import { Settings as SettingsIcon, Database, Shield, Moon, Sun, Smartphone, Download, Upload, Trash2, Layout, Globe, Bell, FileText, AlertTriangle, Lock, CheckCircle, Landmark, Edit2, Plus, Save, X, Clock, HardDrive, User as UserIcon, Camera, Timer, TrendingUp, Share2, FileDown, FileUp, CheckCircle2, RefreshCw, Package } from 'lucide-react';
import { exportSyncPackage, importSyncPackage, shareSyncPackage, canNativeShare } from '../services/offlineSyncService';
import { changeUserPassword } from '../services/firestoreService';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';
import { isAutoRentEnabled, setAutoRentEnabled } from '../services/autoRentService';

// ─── Sync Tab (Offline file-based sync — no internet needed) ───
const SyncTab: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(localStorage.getItem('amlak_last_export'));
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      await exportSyncPackage();
      const now = new Date().toLocaleString();
      localStorage.setItem('amlak_last_export', now);
      setLastExport(now);
      setResult({ type: 'success', msg: 'Sync file downloaded! Send it to the other device via Bluetooth, USB, AirDrop, etc.' });
    } catch (e: any) {
      setResult({ type: 'error', msg: e.message || 'Export failed' });
    }
    setExporting(false);
  };

  const handleShare = async () => {
    setExporting(true);
    setResult(null);
    try {
      await shareSyncPackage();
      const now = new Date().toLocaleString();
      localStorage.setItem('amlak_last_export', now);
      setLastExport(now);
      setResult({ type: 'success', msg: 'Shared successfully!' });
    } catch (e: any) {
      setResult({ type: 'error', msg: e.message || 'Share failed' });
    }
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const merged = await importSyncPackage(file);
      setResult({ type: 'success', msg: `Imported! ${merged} record${merged !== 1 ? 's' : ''} merged from the other device.` });
    } catch (err: any) {
      setResult({ type: 'error', msg: err.message || 'Import failed' });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-base">
          <Package size={18} className="text-violet-600" /> Offline Device Sync
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Transfer data between devices <strong>without any internet or WiFi</strong>.
          Export your data as a file, send it to the other device using <strong>Bluetooth, USB, AirDrop, NFC,
          SD card</strong> — anything — then import it there.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-5">
        <h4 className="text-xs font-bold text-violet-800 mb-3 uppercase tracking-wide">How it works</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-violet-100 flex items-center justify-center">
              <FileDown size={16} className="text-violet-600" />
            </div>
            <div className="text-[11px] font-bold text-slate-700">1. Export</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Download sync file from Device A</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-amber-100 flex items-center justify-center">
              <Share2 size={16} className="text-amber-600" />
            </div>
            <div className="text-[11px] font-bold text-slate-700">2. Transfer</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Send via Bluetooth, USB, AirDrop...</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FileUp size={16} className="text-emerald-600" />
            </div>
            <div className="text-[11px] font-bold text-slate-700">3. Import</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Load sync file on Device B</div>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileDown size={16} className="text-violet-600" /> Export Data
        </h4>
        <p className="text-[11px] text-slate-500">
          Creates a .json file with all your app data. Send this file to the other device.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-violet-200/50 transition-all disabled:opacity-50">
            {exporting ? <><RefreshCw size={14} className="animate-spin" /> Exporting...</> : <><Download size={14} /> Download Sync File</>}
          </button>
          {canNativeShare() && (
            <button onClick={handleShare} disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-blue-200/50 transition-all disabled:opacity-50">
              <Share2 size={14} /> Share via Bluetooth / AirDrop
            </button>
          )}
        </div>
        {lastExport && (
          <div className="text-[10px] text-slate-400">Last export: {lastExport}</div>
        )}
      </div>

      {/* Import Section */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileUp size={16} className="text-emerald-600" /> Import Data
        </h4>
        <p className="text-[11px] text-slate-500">
          Select a sync file received from another device. Data will be merged — newer records win, nothing is lost.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.amlak"
          onChange={handleImport}
          className="hidden"
          id="sync-import-input"
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={importing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-emerald-200/50 transition-all disabled:opacity-50">
          {importing ? <><RefreshCw size={14} className="animate-spin" /> Importing &amp; Merging...</> : <><Upload size={14} /> Select Sync File to Import</>}
        </button>
      </div>

      {/* Result message */}
      {result && (
        <div className={`rounded-xl p-3 text-xs font-semibold flex items-center gap-2 ${
          result.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {result.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {result.msg}
        </div>
      )}
    </div>
  );
};

interface SettingsProps {
    currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const { showSuccess, showError } = useToast();
    const { t } = useLanguage();
    const [autoRentOn, setAutoRentOn] = useState(isAutoRentEnabled());
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const [settings, setSettings] = useState<SystemSettings>({
        companyName: '',
        currency: 'SAR',
        darkMode: false,
        compactMode: false,
        expenseBudgetLimit: 0,
        openingCashBalance: 0,
        openingBankBalance: 0,
        whatsappTemplate: ''
    } as SystemSettings);


    const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab_] = useState<'GENERAL' | 'DATA' | 'AUDIT' | 'BANKS' | 'PROFILE' | 'SCREENTIME' | 'SYNC'>('GENERAL');
  const setActiveTab = (t: typeof activeTab) => { SoundService.play('tab'); setActiveTab_(t); };
    const [pwdCurrent, setPwdCurrent] = useState('');
    const [pwdNew, setPwdNew] = useState('');
    const [pwdConfirm, setPwdConfirm] = useState('');
    const [pwdMsg, setPwdMsg] = useState<string>('');
    const [banks, setBanks] = useState<Bank[]>([]);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [isAddingBank, setIsAddingBank] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [newBankIban, setNewBankIban] = useState('');
    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [backupStats, setBackupStats] = useState<any>(null);
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [userStats, setUserStats] = useState<UsageStats | null>(null);
    const [allUsersStats, setAllUsersStats] = useState<UsageStats[]>([]);
    const [currentSessionTime, setCurrentSessionTime] = useState<number>(0);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirm');
    const [confirmDanger, setConfirmDanger] = useState(false);
    const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

    const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
        setConfirmTitle(opts?.title || 'Confirm');
        setConfirmDanger(!!opts?.danger);
        setConfirmMessage(message);
        setConfirmAction(() => onConfirm);
        setConfirmOpen(true);
    };
    const closeConfirm = () => {
        setConfirmOpen(false);
        setConfirmMessage('');
        setConfirmAction(null);
    };
  
  // Load profile photo from localStorage on mount
  useEffect(() => {
      const loadPhoto = () => {
          // Always try to load from localStorage first using user ID
          const storedPhoto = localStorage.getItem(`profilePhoto_${currentUser.id}`);
          if (storedPhoto) {
              setPhotoPreview(storedPhoto);
          } else if (currentUser.photoURL && !currentUser.photoURL.startsWith('localStorage:')) {
              setPhotoPreview(currentUser.photoURL);
          }
      };
      loadPhoto();
  }, [currentUser.id]);

  useEffect(() => {
      const load = async () => {
          if (activeTab === 'AUDIT') setLogs(await getAuditLogs());
          if (activeTab === 'BANKS') setBanks(await getBanks());
          if (activeTab === 'DATA') {
              setBackups(await getAllBackups());
              setBackupStats(await getBackupStats());
          }
          if (activeTab === 'SCREENTIME') {
              const stats = getUserStats(currentUser.id);
              setUserStats(stats);
              if (isAdmin) {
                  setAllUsersStats(getAllUsersStats());
              }
              setCurrentSessionTime(getCurrentSessionDuration());
          }
      };
      load();
  }, [activeTab, currentUser.id, isAdmin]);

  // Update current session time every 10 seconds when on screen time tab
  useEffect(() => {
      if (activeTab === 'SCREENTIME') {
          const interval = setInterval(() => {
              setCurrentSessionTime(getCurrentSessionDuration());
          }, 10000);
          return () => clearInterval(interval);
      }
  }, [activeTab]);

  // Auto-backup on app load
  useEffect(() => {
      const initAutoBackup = async () => {
          if (autoBackupEnabled) {
              await performAutoBackup();
          }
      };
      initAutoBackup();
  }, []);

  useEffect(() => {
      const loadSettings = async () => {
          const data = await getSettings();
          const merged: SystemSettings = {
              companyName: '',
              currency: 'SAR',
              darkMode: false,
              compactMode: false,
              expenseBudgetLimit: 0,
              openingCashBalance: 0,
              openingBankBalance: 0,
              whatsappTemplate: '',
              ...(data || {}),
          } as SystemSettings;
          setSettings(merged);
      };
      loadSettings();
  }, []);



  const handleChange = async (field: keyof SystemSettings, value: any) => {
      SoundService.play('click');
      const updated = { ...settings, [field]: value };
      setSettings(updated);
      await saveSettings(updated);
  };

  const handlePasswordChange = async () => {
      try {
          if (!pwdCurrent || !pwdNew) { setPwdMsg('Enter current and new password'); return; }
          if (pwdNew !== pwdConfirm) { setPwdMsg('New passwords do not match'); return; }
          await changeUserPassword(currentUser.id, pwdCurrent, pwdNew);
          setPwdMsg('Password updated successfully');
          setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
      } catch (e: any) {
          setPwdMsg(e?.message || 'Failed to change password');
      }
      setTimeout(() => setPwdMsg(''), 5000);
  };



  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  if(restoreBackup(ev.target.result as string)) {
                      showSuccess('System restored successfully. Reloading...');
                      setTimeout(() => window.location.reload(), 800);
                  } else {
                      showError('Invalid backup file');
                  }
              }
          };
          reader.readAsText(file);
      }
  };

  const handleRestoreFromBackup = async (backup: BackupRecord) => {
      openConfirm(`Restore backup from ${fmtDateTime(backup.timestamp)}? All current data will be overwritten.`, async () => {
          const success = await restoreFromBackupRecord(backup);
          if (success) {
              showSuccess('System restored successfully. Reloading...');
              setTimeout(() => window.location.reload(), 800);
          } else {
              showError('Failed to restore backup');
          }
          closeConfirm();
      }, { danger: true, title: 'Restore Backup' });
  };

  const handleDeleteBackup = async (id: string) => {
      openConfirm('Delete this backup?', async () => {
          try {
              await deleteBackup(id);
              setBackups(await getAllBackups());
              setBackupStats(await getBackupStats());
              showSuccess('Backup deleted.');
          } catch (error) {
              showError('Failed to delete backup');
          }
          closeConfirm();
      }, { danger: true, title: 'Delete Backup' });
  };

  const handleManualBackup = async () => {
      try {
          const backupData = await generateBackup();
          const blob = new Blob([backupData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `alamlak_backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          handleChange('lastBackupDate', new Date().toISOString());
      } catch (error) {
          showError('Failed to create backup');
      }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
          showError('Please select an image file');
          return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
          showError('Image size must be less than 5MB');
          return;
      }
      
      setUploadingPhoto(true);
      try {
          const photoURL = await uploadProfilePhoto(currentUser.id, file);
          setPhotoPreview(photoURL);
          
          // Dispatch custom event to update sidebar
          window.dispatchEvent(new CustomEvent('profilePhotoUpdated', { 
              detail: { userId: currentUser.id, photoURL } 
          }));
          
          showSuccess('Profile photo updated successfully!');
      } catch (error) {
          showError(`Failed to upload photo: ${error}`);
      } finally {
          setUploadingPhoto(false);
      }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto px-3 sm:px-6 pt-2">
        <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                <SettingsIcon className="text-violet-600" size={24} />{t('nav.systemSettings')}</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">Configuration, Data Management & Logs</p>
        </div>

        <div className="glass-tab-bar mb-6 sm:mb-8 overflow-x-auto">
                        <button onClick={() => setActiveTab('TEAM')} className={`glass-tab text-sm sm:text-base ${activeTab === 'TEAM' ? 'is-active' : ''}`}>
                            <UserIcon size={16} className="text-emerald-600" />
                            <span>Team</span>
                        </button>
            <button onClick={() => setActiveTab('GENERAL')} className={`glass-tab text-sm sm:text-base ${activeTab === 'GENERAL' ? 'is-active' : ''}`}>
                <SettingsIcon size={16} className="text-violet-600" />
                <span>{t('settings.general')}</span>
            </button>
            <button onClick={() => setActiveTab('PROFILE')} className={`glass-tab text-sm sm:text-base ${activeTab === 'PROFILE' ? 'is-active' : ''}`}>
                <UserIcon size={16} className="text-indigo-600" />
                <span>{t('settings.profile')}</span>
            </button>
            <button onClick={() => setActiveTab('SCREENTIME')} className={`glass-tab text-sm sm:text-base ${activeTab === 'SCREENTIME' ? 'is-active' : ''}`}>
                <Timer size={16} className="text-teal-600" />
                <span>Time</span>
            </button>
            <button onClick={() => setActiveTab('SYNC')} className={`glass-tab text-sm sm:text-base ${activeTab === 'SYNC' ? 'is-active' : ''}`}>
                <Package size={16} className="text-violet-600" />
                <span>Sync</span>
            </button>
            {isAdmin && (
                <button onClick={() => setActiveTab('BANKS')} className={`glass-tab text-sm sm:text-base ${activeTab === 'BANKS' ? 'is-active' : ''}`}>
                    <Landmark size={16} className="text-blue-600" />
                    <span>{t('settings.banks')}</span>
                </button>
            )}
            {isAdmin && (
                <button onClick={() => setActiveTab('DATA')} className={`glass-tab text-sm sm:text-base ${activeTab === 'DATA' ? 'is-active' : ''}`}>
                    <Database size={16} className="text-emerald-600" />
                    <span>{t('settings.data')}</span>
                </button>
            )}
            {isAdmin && (
                <button onClick={() => setActiveTab('AUDIT')} className={`glass-tab text-sm sm:text-base ${activeTab === 'AUDIT' ? 'is-active' : ''}`}>
                    <Shield size={16} className="text-slate-700" />
                    <span>Audit</span>
                </button>
            )}
        </div>

        <div className="premium-card p-4 sm:p-6 min-h-[500px]">
                        {/* TEAM TAB */}
                        {activeTab === 'TEAM' && (
                            <div className="space-y-6">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserIcon className="text-emerald-600" size={20}/> Team Members</h3>
                                <p className="text-sm text-slate-500 mt-1">Manage staff and employee access</p>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                                    {/* List staff/employees */}
                                    {/* TODO: Fetch staff from database and render as list with edit/delete/add options */}
                                    <div className="text-slate-400">Team management coming soon...</div>
                                </div>
                            </div>
                        )}
            
            {/* GENERAL TAB */}
            {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Layout size={16}/> Appearance</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                             <div className="flex items-center gap-2 sm:gap-3">
                                 <div className="p-2 bg-slate-200 rounded-lg"><Moon size={16}/></div>
                                 <span className="font-bold text-slate-700 text-sm">{t('settings.darkMode')}</span>
                             </div>
                             <div className="relative inline-flex items-center cursor-pointer w-fit" onClick={() => handleChange('darkMode', !settings.darkMode)}>
                                 <div className={`w-11 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-violet-600' : 'bg-slate-300'}`}></div>
                                 <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform transform ${settings.darkMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
                             </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                             <div className="flex items-center gap-2 sm:gap-3">
                                 <div className="p-2 bg-slate-200 rounded-lg"><Layout size={16}/></div>
                                 <span className="font-bold text-slate-700 text-sm">{t('settings.compactMode')}</span>
                             </div>
                             <div className="relative inline-flex items-center cursor-pointer w-fit" onClick={() => handleChange('compactMode', !settings.compactMode)}>
                                 <div className={`w-11 h-6 rounded-full transition-colors ${settings.compactMode ? 'bg-violet-600' : 'bg-slate-300'}`}></div>
                                 <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform transform ${settings.compactMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
                             </div>
                        </div>

                        {/* Sound Effects */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                             <div className="flex items-center gap-2 sm:gap-3">
                                 <div className="p-2 bg-slate-200 rounded-lg"><Bell size={16}/></div>
                                 <div>
                                     <span className="font-bold text-slate-700 block text-sm">Sound Effects</span>
                                     <span className="text-[10px] text-slate-500">Click, submit & notification sounds</span>
                                 </div>
                             </div>
                             <div className="flex items-center gap-3">
                                 <div className="relative inline-flex items-center cursor-pointer w-fit" onClick={() => { const next = !SoundService.isEnabled(); SoundService.setEnabled(next); SoundService.play('toggle'); handleChange('soundEnabled' as any, next); }}>
                                     <div className={`w-11 h-6 rounded-full transition-colors ${SoundService.isEnabled() ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                     <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform transform ${SoundService.isEnabled() ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                 </div>
                             </div>
                        </div>
                        {SoundService.isEnabled() && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                             <div className="flex items-center gap-2 sm:gap-3">
                                 <div className="p-2 bg-slate-200 rounded-lg"><Bell size={16}/></div>
                                 <span className="font-bold text-slate-700 text-sm">Sound Volume</span>
                             </div>
                             <input type="range" min="0" max="100" value={Math.round(SoundService.getVolume() * 100)} className="w-24 sm:w-32 accent-emerald-600" onChange={(e) => { SoundService.setVolume(parseInt(e.target.value) / 100); }} onMouseUp={() => SoundService.play('click')} />
                        </div>
                        )}

                                                {/* Biometric Lock */}
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                                                         <div className="flex items-center gap-2 sm:gap-3">
                                                                 <div className="p-2 bg-emerald-100 rounded-lg"><Lock size={16} className="text-emerald-700"/></div>
                                                                 <div>
                                                                     <span className="font-bold text-slate-700 block text-sm">Biometric Lock</span>
                                                                     <span className="text-[10px] text-slate-500">Fingerprint / Face ID</span>
                                                                 </div>
                                                         </div>
                                                         <div className="flex items-center gap-2 flex-wrap">
                                                             <button
                                                                 onClick={async () => {
                                                                     try {
                                                                         const svc = await import('../services/webauthnService');
                                                                         const available = await svc.isBiometricAvailable();
                                                                         if (!available) {
                                                                             showError('Biometrics not available on this device. Requires Face ID, Touch ID, or Windows Hello.');
                                                                             return;
                                                                         }
                                                                         const ok = await svc.registerPasskey(currentUser.id, currentUser.name || currentUser.email || 'User');
                                                                         if (ok) {
                                                                             // Store user data so biometric can bypass login next time
                                                                             svc.storeBiometricUserData(currentUser);
                                                                             showSuccess('Fingerprint / Face ID registered! Next login you can use biometric directly.');
                                                                         } else {
                                                                             showError('Registration cancelled or failed.');
                                                                         }
                                                                     } catch (e: any) {
                                                                         showError(e?.message || 'Registration error');
                                                                     }
                                                                 }}
                                                                 className="px-2 sm:px-3 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 whitespace-nowrap"
                                                             >
                                                                 Enable Biometric
                                                             </button>
                                                             <button
                                                                 onClick={async () => {
                                                                     const svc = await import('../services/webauthnService');
                                                                     svc.setBiometricEnabled(currentUser.id, false);
                                                                     showSuccess('Biometric lock disabled.');
                                                                 }}
                                                                 className="px-2 sm:px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 whitespace-nowrap"
                                                             >
                                                                 Disable
                                                             </button>
                                                         </div>
                                                </div>

                        {/* Auto Rent Payment */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                             <div className="flex items-center gap-2 sm:gap-3">
                                 <div className="p-2 bg-emerald-100 rounded-lg"><Clock size={16} className="text-emerald-700"/></div>
                                 <div>
                                     <span className="font-bold text-slate-700 block text-sm">{t('settings.autoRent')}</span>
                                     <span className="text-[10px] text-slate-500">{t('settings.autoRentDesc')}</span>
                                 </div>
                             </div>
                             <div className="relative inline-flex items-center cursor-pointer w-fit" onClick={() => { const next = !autoRentOn; setAutoRentEnabled(next); setAutoRentOn(next); SoundService.play('toggle'); showSuccess(next ? 'Auto rent payments enabled' : 'Auto rent payments disabled'); }}>
                                 <div className={`w-11 h-6 rounded-full transition-colors ${autoRentOn ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                 <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform transform ${autoRentOn ? 'translate-x-6' : 'translate-x-1'}`}></div>
                             </div>
                        </div>

                        {/* Push Notifications */}
                        {isAdmin && (
                        <div className="space-y-3">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2 pt-4"><Bell size={16} className="text-amber-600"/> Push Notifications</h3>
                            <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${
                                        typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'bg-emerald-500' :
                                        typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'bg-rose-500' : 'bg-amber-500'
                                    }`} />
                                    <span className="text-xs font-bold text-slate-600">
                                        Browser: {
                                            typeof Notification !== 'undefined'
                                                ? Notification.permission === 'granted' ? 'Enabled ✓'
                                                : Notification.permission === 'denied' ? 'Blocked (check browser settings)'
                                                : 'Not enabled'
                                                : 'Not supported'
                                        }
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-snug">Notifications work on all devices (mobile, PC) where you are logged in and have granted permission — even when the app is closed.</p>
                                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const { registerDeviceForPush } = await import('../services/pushNotificationService');
                                                const result = await registerDeviceForPush(currentUser.id, currentUser.name || 'Admin', currentUser.role);
                                                if (result) showSuccess('Push notifications enabled! This device will receive notifications even when the app is closed.');
                                                else showError('Permission denied. Allow notifications in your browser settings.');
                                            } catch (e: any) { showError(e?.message || 'Failed'); }
                                        }}
                                        className="w-full px-3 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 flex items-center justify-center gap-2"
                                    >
                                        <Bell size={14} /> Enable Push Notifications
                                    </button>
                                )}
                                {typeof Notification !== 'undefined' && Notification.permission === 'granted' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const { registerDeviceForPush } = await import('../services/pushNotificationService');
                                                    await registerDeviceForPush(currentUser.id, currentUser.name || 'Admin', currentUser.role);
                                                    showSuccess('Device re-registered for push notifications.');
                                                } catch (e: any) { showError(e?.message || 'Failed'); }
                                            }}
                                            className="flex-1 px-3 py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-200"
                                        >
                                            Re-register Device
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const { showBrowserNotification } = await import('../services/pushNotificationService');
                                                    showBrowserNotification('🔔 Test Notification', 'Push notifications are working! You will receive alerts even when the app is closed.', { type: 'test' });
                                                    showSuccess('Test notification sent! Check your notification tray.');
                                                } catch (e: any) { showError(e?.message || 'Failed'); }
                                            }}
                                            className="flex-1 px-3 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200"
                                        >
                                            Test Notification
                                        </button>
                                    </div>
                                )}
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">FCM VAPID Key (optional – for push when app is closed)</label>
                                    <input
                                        type="text"
                                        defaultValue={localStorage.getItem('fcm_vapid_key') || ''}
                                        onBlur={e => {
                                            const val = e.target.value.trim();
                                            if (val) localStorage.setItem('fcm_vapid_key', val);
                                            else localStorage.removeItem('fcm_vapid_key');
                                        }}
                                        placeholder="Paste VAPID key from Firebase Console"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                                    />
                                    <p className="text-[10px] text-slate-400">Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Key pair</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Push Server URL (optional)</label>
                                    <input
                                        type="text"
                                        defaultValue={localStorage.getItem('fcm_server_url') || ''}
                                        onBlur={e => {
                                            const val = e.target.value.trim();
                                            if (val) localStorage.setItem('fcm_server_url', val);
                                            else localStorage.removeItem('fcm_server_url');
                                        }}
                                        placeholder="https://your-server:3200"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                                    />
                                    <p className="text-[10px] text-slate-400">Only needed if running the FCM push server for background notifications</p>
                                </div>
                            </div>
                        </div>
                        )}

                        <h3 className="text-base sm:text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2 pt-4"><Globe size={16}/> Regional</h3>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Currency Symbol</label>
                            <input type="text" value={settings.currency} onChange={e => handleChange('currency', e.target.value)} className="w-full p-3 rounded-xl border font-bold text-sm" />
                        </div>

                    </div>

                    <div className="space-y-4 sm:space-y-6">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">Communication</h3>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Budget Limit (Monthly)</label>
                            <input type="number" value={settings.expenseBudgetLimit} onChange={e => handleChange('expenseBudgetLimit', parseFloat(e.target.value))} className="w-full p-3 rounded-xl border font-bold text-rose-600 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Smartphone size={12}/>{t('settings.whatsappTemplate')}</label>
                            <textarea value={settings.whatsappTemplate} onChange={e => handleChange('whatsappTemplate', e.target.value)} className="w-full p-3 rounded-xl border h-24 text-xs sm:text-sm resize-none" />
                            <p className="text-[10px] text-slate-400">Use {'{name}'}, {'{amount}'}, {'{unit}'}</p>
                        </div>
                        <div className="space-y-3 mt-4 sm:mt-6 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><Lock size={14} className="text-violet-600"/>{t('settings.changePassword')}</h4>
                            <input type="password" placeholder="Current" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} className="w-full p-3 rounded-xl border text-sm" />
                            <input type="password" placeholder={t('entry.newShort')} value={pwdNew} onChange={e => setPwdNew(e.target.value)} className="w-full p-3 rounded-xl border text-sm" />
                            <input type="password" placeholder={t('common.confirm')} value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} className="w-full p-3 rounded-xl border text-sm" />
                            <button onClick={handlePasswordChange} className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"><CheckCircle size={16}/> Update</button>
                            {pwdMsg && <div className="text-xs font-bold text-center text-slate-600">{pwdMsg}</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'PROFILE' && (
                <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 sm:p-6 rounded-xl border border-indigo-100">
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                            <UserIcon className="text-indigo-600" size={24} />
                            My Profile
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
                            {/* Profile Photo Section */}
                            <div className="flex flex-col items-center">
                                <div className="relative">
                                    <div className="w-32 sm:w-40 h-32 sm:h-40 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-xl border-4 border-white">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon size={48} className="text-white" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-110 border-4 border-white">
                                        <Camera size={18} className="text-white" />
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handlePhotoUpload} 
                                            className="hidden" 
                                            disabled={uploadingPhoto}
                                        />
                                    </label>
                                </div>
                                {uploadingPhoto && (
                                    <div className="mt-3 text-xs sm:text-sm font-bold text-indigo-600 animate-pulse">Uploading...</div>
                                )}
                                <div className="mt-3 text-center">
                                    <p className="text-xs text-slate-500">Click camera to change</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Max 5MB</p>
                                </div>
                            </div>

                            {/* Profile Info Section */}
                            <div className="sm:col-span-1 md:col-span-2 space-y-3 sm:space-y-4">
                                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                    <div className="text-base sm:text-lg font-bold text-slate-800 mt-1">{currentUser.name}</div>
                                </div>

                                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Role</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                                            currentUser.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' :
                                            currentUser.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-700' :
                                            currentUser.role === UserRole.ENGINEER ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {currentUser.role}
                                        </span>
                                    </div>
                                </div>

                                {currentUser.email && (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                                        <label className="text-xs font-bold text-slate-500 uppercase">{t('common.email')}</label>
                                        <div className="text-lg font-bold text-slate-800 mt-1">{currentUser.email}</div>
                                    </div>
                                )}

                                {currentUser.joinedDate && (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Joined Date</label>
                                        <div className="text-lg font-bold text-slate-800 mt-1">
                                            {fmtDate(currentUser.joinedDate)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREEN TIME TAB */}
            {activeTab === 'SCREENTIME' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Timer className="text-teal-600" size={28} />
                        Screen Time Analytics
                    </h3>

                    {/* Current Session */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 sm:p-5 rounded-xl border border-teal-100">
                        <h4 className="font-bold text-teal-900 mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-teal-600" />
                            Current Session
                        </h4>
                        <div className="text-4xl font-black text-teal-700">
                            {formatDuration(currentSessionTime)}
                        </div>
                        <p className="text-sm text-teal-600 mt-2">Active time since login</p>
                    </div>

                    {/* User's Own Stats */}
                    {userStats && (
                        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingUp size={18} className="text-indigo-600" />
                                My Usage Statistics
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <label className="text-xs font-bold text-indigo-600 uppercase">Total Time</label>
                                    <div className="text-2xl font-black text-indigo-700 mt-2">
                                        {formatDuration(userStats.totalTime)}
                                    </div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                    <label className="text-xs font-bold text-purple-600 uppercase">Active Days</label>
                                    <div className="text-2xl font-black text-purple-700 mt-2">
                                        {userStats.totalDays} days
                                    </div>
                                </div>
                                <div className="bg-pink-50 p-4 rounded-xl border border-pink-100">
                                    <label className="text-xs font-bold text-pink-600 uppercase">Average / Day</label>
                                    <div className="text-2xl font-black text-pink-700 mt-2">
                                        {formatDuration(userStats.averagePerDay)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!userStats && (
                        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 text-center">
                            <Timer size={48} className="text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600 font-medium">No usage data yet. Start using the app to track your screen time!</p>
                        </div>
                    )}

                    {/* Admin View: All Users Stats */}
                    {isAdmin && allUsersStats.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Shield size={18} className="text-emerald-600" />
                                All Users Usage (Admin View)
                            </h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {allUsersStats.map((stats) => (
                                    <div key={stats.userId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all">
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800">{stats.userName}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {stats.totalDays} days active • Last: {fmtDate(stats.lastSession)}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-teal-700">
                                                {formatDuration(stats.totalTime)}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Avg: {formatDuration(stats.averagePerDay)}/day
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BANKS TAB */}
            {activeTab === 'BANKS' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Landmark className="text-blue-600" size={20}/> Bank Accounts</h3>
                            <p className="text-sm text-slate-500 mt-1">Manage your bank accounts and IBANs</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setIsAddingBank(true)}
                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <Plus size={16}/> Add Bank
                            </button>
                        )}
                    </div>

                    {isAddingBank && (
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-blue-800">New Bank Account</h4>
                                <button onClick={() => { setIsAddingBank(false); setNewBankName(''); setNewBankIban(''); }} className="text-slate-400 hover:text-slate-600">
                                    <X size={18}/>
                                </button>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 uppercase">{t('entry.bankName')}</label>
                                <input
                                    type="text"
                                    value={newBankName}
                                    onChange={e => setNewBankName(e.target.value)}
                                    placeholder="e.g. Al Rajhi Bank"
                                    className="w-full p-3 rounded-xl border border-blue-200 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 uppercase">{t('entry.iban')}</label>
                                <input
                                    type="text"
                                    value={newBankIban}
                                    onChange={e => setNewBankIban(e.target.value)}
                                    placeholder="SA..."
                                    className="w-full p-3 rounded-xl border border-blue-200 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    if (newBankName && newBankIban) {
                                        await saveBank({ name: newBankName, iban: newBankIban });
                                        setBanks(await getBanks());
                                        setIsAddingBank(false);
                                        setNewBankName('');
                                        setNewBankIban('');
                                    }
                                }}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18}/>{t('entry.saveBank')}</button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {banks.map(bank => (
                            <div key={bank.name} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all">
                                {editingBank?.name === bank.name ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-600 uppercase">{t('entry.bankName')}</label>
                                            <input
                                                type="text"
                                                value={editingBank.name}
                                                onChange={e => setEditingBank({ ...editingBank, name: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-slate-300 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-600 uppercase">{t('entry.iban')}</label>
                                            <input
                                                type="text"
                                                value={editingBank.iban}
                                                onChange={e => setEditingBank({ ...editingBank, iban: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-slate-300 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={async () => {
                                                    await saveBank(editingBank);
                                                    setBanks(await getBanks());
                                                    setEditingBank(null);
                                                }}
                                                className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Save size={16}/>{t('common.save')}</button>
                                            <button
                                                onClick={() => setEditingBank(null)}
                                                className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
                                            >{t('common.cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                <Landmark size={18} className="text-blue-600"/>
                                                {bank.name}
                                            </div>
                                            <div className="text-sm text-slate-500 font-mono mt-1">{bank.iban}</div>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingBank(bank)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                                                    title="Edit Bank"
                                                >
                                                    <Edit2 size={16}/>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        openConfirm(`Delete ${bank.name}? This cannot be undone.`, async () => {
                                                            await deleteBank(bank.name);
                                                            setBanks(await getBanks());
                                                            closeConfirm();
                                                        }, { danger: true, title: 'Delete Bank' });
                                                    }}
                                                    className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                                                    title="Delete Bank"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {banks.length === 0 && !isAddingBank && (
                            <div className="text-center py-12 text-slate-400">
                                <Landmark size={48} className="mx-auto mb-4 opacity-50"/>
                                <p className="font-bold">No bank accounts yet</p>
                                {isAdmin && <p className="text-sm">Click "Add Bank" to create your first account</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DATA TAB */}
            {activeTab === 'DATA' && (
                <div className="space-y-6">
                     {/* Backup Section */}
                     <div className="bg-slate-50/50 p-4 sm:p-5 rounded-xl border border-slate-100">
                         <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Database className="text-violet-600"/> Backup Management</h3>
                         <p className="text-sm text-slate-500 mb-6">Create backups manually on-demand. All backups stored locally in your browser (IndexedDB).</p>
                         
                         <div className="space-y-3 mb-6">
                             <button onClick={handleManualBackup} className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                                 <Download size={18}/> Download Backup Now
                             </button>

                             <button onClick={async () => {
                                 try {
                                     // Clear the date lock to force a new backup
                                     localStorage.removeItem('lastAutoBackupDate');
                                     const backup = await performAutoBackup(true);
                                     if (backup) {
                                         showSuccess('Backup created successfully!');
                                         setBackups(await getAllBackups());
                                         setBackupStats(await getBackupStats());
                                     } else {
                                         showError('Failed to create backup');
                                     }
                                 } catch (error) {
                                     showError(`Backup error: ${error}`);
                                 }
                             }} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                 <HardDrive size={18}/> Create Backup Now
                             </button>

                             <label className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                 <Upload size={18}/> Restore from File
                                 <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
                             </label>
                         </div>

                         {backupStats && (
                             <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
                                 <div className="flex justify-between">
                                     <span className="text-slate-600 flex items-center gap-2"><Clock size={14} /> Total Backups:</span>
                                     <span className="font-bold text-slate-800">{backupStats.count}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span className="text-slate-600 flex items-center gap-2"><HardDrive size={14} /> Storage Used:</span>
                                     <span className="font-bold text-slate-800">{backupStats.totalSizeMB} MB</span>
                                 </div>
                             </div>
                         )}
                     </div>

                     {/* Backup History */}
                     {backups.length > 0 && (
                         <div className="bg-white p-6 rounded-2xl border border-slate-200">
                             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="text-blue-600"/> Backup History</h3>
                             <div className="space-y-2 max-h-96 overflow-y-auto">
                                 {backups.map((backup) => (
                                     <div key={backup.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-all">
                                         <div className="flex-1">
                                             <div className="text-sm font-bold text-slate-800">
                                                 {fmtDateTime(backup.timestamp)}
                                             </div>
                                             <div className="text-xs text-slate-500 mt-1">
                                                 {(backup.size / 1024).toFixed(1)} KB
                                             </div>
                                         </div>
                                         <div className="flex gap-2">
                                             <button
                                                 onClick={() => handleRestoreFromBackup(backup)}
                                                 className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-1"
                                             >
                                                 <Upload size={12} />{t('history.restore')}</button>
                                             <button
                                                 onClick={() => handleDeleteBackup(backup.id)}
                                                 className="px-3 py-1 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-all flex items-center gap-1"
                                             >
                                                 <Trash2 size={12} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     {/* Danger Zone */}
                     <div className="bg-rose-50/50 p-4 sm:p-5 rounded-xl border border-rose-200">
                         <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2"><AlertTriangle className="text-rose-600"/> Danger Zone</h3>
                         <p className="text-sm text-rose-600 mb-6">Irreversible actions. Proceed with caution.</p>
                         
                         <button onClick={() => openConfirm('Wipe ALL data? System will reset.', () => { resetSystem(); closeConfirm(); }, { danger: true, title: 'Factory Reset' })} className="w-full py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl shadow-sm hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2">
                             <Trash2 size={18}/> Factory Reset System
                         </button>
                     </div>
                </div>
            )}

            {/* SYNC TAB */}
            {activeTab === 'SYNC' && (<SyncTab />)}

            {/* AUDIT TAB */}
            {activeTab === 'AUDIT' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Shield size={18}/> Security Log</h3>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Last 100 Actions</span>
                    </div>
                    <div className="border rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
                                <tr>
                                    <th className="p-3">Time</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">{t('common.details')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-400 font-mono text-xs">{fmtDateTime(log.timestamp)}</td>
                                        <td className="p-3 font-bold text-slate-700">{log.userId}</td>
                                        <td className="p-3 text-violet-600 font-bold">{log.action}</td>
                                        <td className="p-3 text-slate-600">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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

export default Settings;

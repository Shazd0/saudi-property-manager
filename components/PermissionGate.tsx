import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Bell, Camera, Mic, MapPin, CheckCircle2, XCircle, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../i18n';

interface PermissionStatus {
  name: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon: React.ReactNode;
  iconBg: string;
  status: 'granted' | 'denied' | 'prompt' | 'unsupported';
  request: () => Promise<'granted' | 'denied' | 'prompt'>;
}

const PermissionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, isRTL, language } = useLanguage();
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [allGranted, setAllGranted] = useState(false);
  const [skipped, setSkipped] = useState(() => localStorage.getItem('permissions_skipped') === 'true');
  const [checking, setChecking] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [pulseBtn, setPulseBtn] = useState(false);

  const tt = useCallback((en: string, ar: string) => language === 'ar' ? ar : en, [language]);

  // Check a browser Permission API permission
  const checkPermissionAPI = async (name: string): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: name as PermissionName });
        return result.state as 'granted' | 'denied' | 'prompt';
      }
    } catch { /* Some permissions can't be queried */ }
    return 'prompt';
  };

  const requestNotification = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!('Notification' in window)) return 'unsupported' as any;
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
  };

  const requestCamera = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported' as any;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'denied';
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') return 'granted';
      return 'denied';
    }
  };

  const requestMicrophone = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported' as any;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'denied';
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') return 'granted';
      return 'denied';
    }
  };

  const requestLocation = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!('geolocation' in navigator)) return 'unsupported' as any;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (err) => { resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'granted'); },
        { timeout: 10000 }
      );
    });
  };

  const buildPermissionList = useCallback(async (): Promise<PermissionStatus[]> => {
    const notifStatus = ('Notification' in window)
      ? (Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt')
      : 'unsupported';
    const cameraStatus = await checkPermissionAPI('camera');
    const micStatus = await checkPermissionAPI('microphone');
    const geoStatus = await checkPermissionAPI('geolocation');

    const perms: PermissionStatus[] = [
      {
        name: 'notifications', label: 'Notifications', labelAr: 'الإشعارات',
        description: 'Real-time alerts & reminders', descriptionAr: 'تنبيهات وتذكيرات فورية',
        icon: <Bell size={20} />, iconBg: 'from-amber-400 to-orange-500',
        status: notifStatus as any, request: requestNotification,
      },
      {
        name: 'camera', label: 'Camera', labelAr: 'الكاميرا',
        description: 'Photo capture & scanning', descriptionAr: 'التقاط الصور والمسح الضوئي',
        icon: <Camera size={20} />, iconBg: 'from-blue-400 to-indigo-500',
        status: cameraStatus, request: requestCamera,
      },
      {
        name: 'microphone', label: 'Microphone', labelAr: 'الميكروفون',
        description: 'Voice commands & assistant', descriptionAr: 'الأوامر الصوتية والمساعد',
        icon: <Mic size={20} />, iconBg: 'from-rose-400 to-pink-500',
        status: micStatus, request: requestMicrophone,
      },
      {
        name: 'location', label: 'Location', labelAr: 'الموقع',
        description: 'Building & property mapping', descriptionAr: 'رسم خرائط المباني والعقارات',
        icon: <MapPin size={20} />, iconBg: 'from-emerald-400 to-teal-500',
        status: geoStatus, request: requestLocation,
      },
    ];
    return perms.filter(p => p.status !== 'unsupported');
  }, []);

  const checkAllPermissions = useCallback(async () => {
    setChecking(true);
    const perms = await buildPermissionList();
    setPermissions(perms);
    const allOk = perms.every(p => p.status === 'granted');
    setAllGranted(allOk);
    if (allOk) localStorage.setItem('permissions_granted', 'true');
    setChecking(false);
    setTimeout(() => setAnimateIn(true), 50);
  }, [buildPermissionList]);

  useEffect(() => { checkAllPermissions(); }, [checkAllPermissions]);

  // Pulse the allow-all button periodically
  useEffect(() => {
    if (allGranted) return;
    const iv = setInterval(() => { setPulseBtn(true); setTimeout(() => setPulseBtn(false), 1000); }, 4000);
    return () => clearInterval(iv);
  }, [allGranted]);

  // Listen for permission changes
  useEffect(() => {
    const setupListeners = async () => {
      for (const name of ['camera', 'microphone', 'geolocation', 'notifications']) {
        try {
          if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: name as PermissionName });
            result.addEventListener('change', () => checkAllPermissions());
          }
        } catch { /* skip */ }
      }
    };
    setupListeners();
  }, [checkAllPermissions]);

  const handleRequestPermission = async (perm: PermissionStatus) => {
    setRequesting(perm.name);
    try { await perm.request(); } catch { /* ignore */ }
    await checkAllPermissions();
    setRequesting(null);
  };

  const handleAllowAll = async () => {
    for (const perm of permissions) {
      if (perm.status !== 'granted') {
        setRequesting(perm.name);
        try { await perm.request(); } catch { /* continue */ }
        setRequesting(null);
      }
    }
    await checkAllPermissions();
  };

  const handleSkip = () => {
    localStorage.setItem('permissions_skipped', 'true');
    setSkipped(true);
  };

  // All granted or skipped → render app
  if ((allGranted || skipped) && !checking) return <>{children}</>;

  // Loading state
  if (checking) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-100 flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-emerald-200">
            <Shield size={32} className="text-white" />
          </div>
          <p className="text-slate-600 font-semibold text-sm">{tt('Checking permissions...', 'جاري التحقق من الأذونات...')}</p>
        </div>
      </div>
    );
  }

  const grantedCount = permissions.filter(p => p.status === 'granted').length;
  const pendingCount = permissions.length - grantedCount;
  const progressPct = permissions.length > 0 ? (grantedCount / permissions.length) * 100 : 0;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[99999] bg-slate-100 flex items-center justify-center p-4 overflow-auto"
    >
      {/* Background decorative blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-[50%] -left-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr from-blue-400/15 to-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-[10%] right-[20%] w-[30%] h-[30%] rounded-full bg-gradient-to-tl from-amber-400/10 to-orange-500/10 blur-3xl" />
      </div>

      <div className={`relative z-10 bg-white/80 backdrop-blur-xl max-w-md w-full rounded-3xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-500 ${animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 py-8 sm:px-8 sm:py-10 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -translate-x-1/2 translate-y-1/2" />

          <div className="relative z-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg border border-white/30">
              <Shield size={36} className="text-white drop-shadow-md" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {tt('Permissions Required', 'الأذونات المطلوبة')}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-2 leading-relaxed max-w-xs mx-auto">
              {tt(
                'Allow permissions for the best experience, or skip to continue',
                'اسمح بالأذونات للحصول على أفضل تجربة، أو تخطَّ للمتابعة'
              )}
            </p>

            {/* Progress Bar */}
            <div className="mt-5 mx-auto max-w-[200px]">
              <div className="flex items-center justify-between text-[10px] text-white/70 font-bold mb-1.5">
                <span>{grantedCount}/{permissions.length}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Permission List */}
        <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-2.5">
          {permissions.map((perm, i) => {
            const isGranted = perm.status === 'granted';
            const isDenied = perm.status === 'denied';
            const isLoading = requesting === perm.name;

            return (
              <button
                key={perm.name}
                onClick={() => !isGranted && handleRequestPermission(perm)}
                disabled={isGranted || isLoading}
                className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl transition-all duration-300 text-left group
                  ${isGranted
                    ? 'bg-emerald-50 border border-emerald-200 cursor-default'
                    : isDenied
                      ? 'bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-[0.98] cursor-pointer'
                      : 'bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 active:scale-[0.98] cursor-pointer'
                  }
                  ${animateIn ? 'opacity-100 translate-x-0' : isRTL ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'}
                `}
                style={{ transitionDelay: `${150 + i * 80}ms` }}
              >
                {/* Icon */}
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${perm.iconBg} flex items-center justify-center text-white shadow-md flex-shrink-0 ${isLoading ? 'animate-pulse' : ''}`}>
                  {perm.icon}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isGranted ? 'text-emerald-800' : isDenied ? 'text-rose-800' : 'text-slate-800'}`}>
                    {isRTL ? perm.labelAr : perm.label}
                  </div>
                  <div className={`text-[11px] mt-0.5 truncate ${isGranted ? 'text-emerald-600' : isDenied ? 'text-rose-500' : 'text-slate-500'}`}>
                    {isGranted
                      ? tt('Allowed ✓', 'مسموح ✓')
                      : isDenied
                        ? tt('Blocked — tap to retry', 'محظور — انقر للإعادة')
                        : (isRTL ? perm.descriptionAr : perm.description)
                    }
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {isGranted ? (
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  ) : isDenied ? (
                    <XCircle size={22} className="text-rose-400" />
                  ) : isLoading ? (
                    <RefreshCw size={18} className="text-emerald-500 animate-spin" />
                  ) : (
                    <ChevronRight size={18} className={`text-slate-400 group-hover:text-emerald-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="px-4 pb-5 sm:px-6 sm:pb-6 space-y-2.5">
          {/* Allow All Button */}
          {pendingCount > 0 && (
            <button
              onClick={handleAllowAll}
              disabled={requesting !== null}
              className={`w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-3.5 sm:py-4 rounded-xl transition-all shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-2.5 text-sm sm:text-base transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-wait ${pulseBtn ? 'animate-pulse' : ''}`}
            >
              <Shield size={18} />
              {tt(`Allow All (${pendingCount} remaining)`, `السماح بالكل (${pendingCount} متبقية)`)}
            </button>
          )}

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="w-full py-3 text-slate-500 hover:text-slate-700 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 hover:bg-slate-50 rounded-xl"
          >
            {tt('Skip for now', 'تخطي الآن')}
          </button>

          {/* Re-check Button */}
          <button
            onClick={checkAllPermissions}
            className="w-full py-2.5 text-emerald-600 hover:text-emerald-800 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 hover:bg-emerald-50 rounded-xl"
          >
            <RefreshCw size={14} />
            {tt('Re-check Permissions', 'إعادة التحقق من الأذونات')}
          </button>
        </div>

        {/* Denied Warning Banner */}
        {permissions.some(p => p.status === 'denied') && (
          <div className="mx-4 mb-4 sm:mx-6 sm:mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 items-start">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700 text-[11px] sm:text-xs leading-relaxed font-medium">
              {tt(
                'Some permissions are blocked. Go to your browser settings → Site Settings → find this site and change blocked permissions to "Allow".',
                'بعض الأذونات محظورة. اذهب إلى إعدادات المتصفح ← إعدادات الموقع ← ابحث عن هذا الموقع وغيّر الأذونات المحظورة إلى "سماح".'
              )}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-5 sm:pb-6">
          <p className="text-slate-400 text-center text-[10px] sm:text-[11px] leading-relaxed">
            {tt(
              'Required for voice commands, photo capture, property mapping & real-time alerts.',
              'مطلوبة للأوامر الصوتية والتقاط الصور وتتبع الموقع والتنبيهات الفورية.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionGate;

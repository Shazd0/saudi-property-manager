import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, X, AlertTriangle } from 'lucide-react';
import { authenticatePasskey, isBiometricAvailable } from '../services/webauthnService';
import { useLanguage } from '../i18n';

interface LockScreenProps {
  userId: string;
  onUnlock: () => void;
  onLogout?: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ userId, onUnlock, onLogout }) => {
  const { t, isRTL } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // Check biometric availability and auto-trigger on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await isBiometricAvailable();
      if (cancelled) return;
      if (!available) {
        setSupported(false);
        return;
      }
      // Auto-trigger Face ID / Touch ID prompt
      setLoading(true);
      try {
        const ok = await authenticatePasskey(userId);
        if (!cancelled && ok) onUnlock();
        else if (!cancelled) setError('Authentication failed. Tap to try again.');
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Authentication error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUnlock = async () => {
    setLoading(true); setError(null);
    try {
      const ok = await authenticatePasskey(userId);
      if (ok) onUnlock();
      else setError('Authentication failed. Try again.');
    } catch (e: any) {
      setError(e?.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full p-8 relative">
        {onLogout && (
          <button onClick={onLogout} className="absolute top-4 right-4 p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title={t('common.logout')}>
            <X size={18} />
          </button>
        )}
        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-full mb-4 ${supported ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {supported ? <Shield size={40} className="text-emerald-600" /> : <AlertTriangle size={40} className="text-amber-600" />}
          </div>
          <h2 className="text-2xl font-black text-emerald-900 mb-2">
            {supported ? 'Biometric Unlock' : 'Biometrics Not Available'}
          </h2>
          <p className="text-emerald-700 text-sm mb-6">
            {supported
              ? 'Use Face ID / Touch ID / Windows Hello to continue'
              : 'Your device does not support biometric authentication.'}
          </p>
          {supported ? (
            <button
              onClick={handleUnlock}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold py-4 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg flex items-center justify-center gap-3 text-base"
            >
              <Fingerprint size={24} /> {loading ? 'Verifying…' : 'Unlock with Face ID'}
            </button>
          ) : (
            <button
              onClick={onLogout || onUnlock}
              className="w-full bg-slate-600 text-white font-bold py-4 rounded-xl hover:bg-slate-700 transition-all shadow-lg text-base"
            >
              {onLogout ? 'Go Back to Login' : 'Continue'}
            </button>
          )}
          {error && <div className="mt-4 text-rose-600 text-sm font-bold">{error}</div>}
          {supported && (
            <div className="mt-4 text-xs text-slate-500">Face ID prompt appears automatically. Tap the button if it didn't show.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LockScreen;

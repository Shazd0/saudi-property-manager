import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mockLogin } from '../services/firestoreService';
import { Building2, ArrowRight, Lock, User as UserIcon, Fingerprint, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle, Sparkles, Tag } from 'lucide-react';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';
import LanguageToggle from './LanguageToggle';
import logo from '../images/logo.png';
import LoadingOverlay from './LoadingOverlay';
import PricingModal from './PricingModal';

interface LoginProps {
  onLogin: (user: User) => void;
  onSwitchToTenant?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToTenant }) => {
  const { t, isRTL } = useLanguage();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricUser, setBiometricUser] = useState<any>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPasswordToggle, setShowPasswordToggle] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotShowPass, setForgotShowPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check on mount if biometric user is available
  useEffect(() => {
    (async () => {
      try {
        const svc = await import('../services/webauthnService');
        const storedUser = svc.getBiometricUserData();
        if (storedUser) {
          const available = await svc.isBiometricAvailable();
          if (available) {
            setBiometricUser(storedUser);
            // Auto-trigger biometric on load
            handleBiometricLogin(storedUser);
          } else {
            setShowPasswordForm(true);
          }
        } else {
          setShowPasswordForm(true);
        }
      } catch {
        setShowPasswordForm(true);
      }
    })();
  }, []);

  const handleBiometricLogin = async (user?: any) => {
    const targetUser = user || biometricUser;
    if (!targetUser) return;
    SoundService.play('submit');
    setBiometricLoading(true);
    setError('');
    try {
      const svc = await import('../services/webauthnService');
      const userId = targetUser.id || targetUser.uid;
      const ok = await svc.authenticatePasskey(userId);
      if (ok) {
        onLogin(targetUser);
      } else {
        setError('Biometric verification failed. Try again or use password.');
        setShowPasswordForm(true);
      }
    } catch (e: any) {
      setError('Biometric error. Use password login instead.');
      setShowPasswordForm(true);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    setLoading(true);
    setError('');

    try {
      const user = await mockLogin(id, password);
      if (user) {
        if(user.status === 'Inactive') {
            setError('Account is inactive. Contact Admin.');
        } else {
            onLogin(user);
        }
      } else {
        setError('Invalid ID or Password');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(`System error occurred: ${msg}`);
      console.error('Login error', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/20 blur-3xl animate-pulse"></div>
         <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr from-blue-400/20 to-indigo-500/20 blur-3xl"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl max-w-md w-full rounded-3xl shadow-2xl border border-white/50 overflow-hidden z-10">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-400 p-10 text-center relative overflow-hidden">
          <div className="absolute top-3 right-3 z-20">
            <LanguageToggle compact className="bg-white/20 text-white hover:bg-white/30" />
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
             <Building2 size={200} className="text-white transform translate-x-10 translate-y-10" />
          </div>
          <div className="mx-auto mb-4 relative z-10">
            <img src={logo} alt="logo" className="w-40 h-40 object-contain mx-auto" />
          </div>
          <h1 className="text-3xl font-black text-white relative z-10 tracking-tight">{t('login.title')}</h1>
          <div className="text-white/90 text-lg font-semibold relative z-10">{t('login.titleAr')}</div>
          <p className="text-white/70 text-xs mt-3 relative z-10 font-bold uppercase tracking-widest">{t('login.subtitle')}</p>
          <p className="text-white/50 text-[10px] mt-1 relative z-10 font-bold tracking-wider">{t('app.poweredBy')}</p>
        </div>

        <div className="p-8">
          {/* Biometric Login Button — shown when biometric is registered */}
          {biometricUser && (
            <div className="mb-6">
              <div className="text-center mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('login.welcomeBack')}, {biometricUser.name || biometricUser.displayName || 'User'}</span>
              </div>
              <button
                onClick={() => handleBiometricLogin()}
                disabled={biometricLoading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
              >
                <Fingerprint size={22} />
                {biometricLoading ? t('login.verifying') : t('login.biometricLogin')}
              </button>
              {!showPasswordForm && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full mt-3 text-emerald-600 text-xs font-bold hover:text-emerald-800 transition-colors py-2"
                >
                  {t('login.usePassword')}
                </button>
              )}
            </div>
          )}

          {/* Divider between biometric and password */}
          {biometricUser && showPasswordForm && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-xs font-bold text-slate-400 uppercase">or</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>
          )}

          {/* Password Form — always shown if no biometric, or toggled if biometric exists */}
          {(showPasswordForm || !biometricUser) && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('login.userId')}</label>
                  <div className="relative form-with-icon group">
                    <UserIcon className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={18} />
                    <input 
                      type="text" 
                      required
                      value={id}
                      onChange={e => setId(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-medium text-slate-800`}
                      placeholder={t('login.enterID')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('login.password')}</label>
                <div className="relative form-with-icon group">
                  <Lock className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={18} />
                  <input 
                    type={showPasswordToggle ? 'text' : 'password'} 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-medium text-slate-800`}
                    placeholder={t('login.enterPassword')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPasswordToggle(p => !p)}
                    className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-3.5 text-slate-400 hover:text-emerald-500 transition-colors z-40`}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {showPasswordToggle ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => { setForgotOpen(true); setForgotMsg(null); setForgotId(id); setForgotNewPass(''); setForgotConfirmPass(''); }}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-bold transition-colors"
                  >
                    🔑 Forgot Password?
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-rose-600 text-sm bg-rose-50 p-4 rounded-xl text-center font-bold border border-rose-100 animate-shake">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
              >
                {loading ? t('login.verifying') : t('login.accessDashboard')}
                {!loading && <ArrowRight size={20} className="text-white" />}
              </button>
            </form>
          )}

          {/* Error shown outside form (for biometric errors) */}
          {error && biometricUser && !showPasswordForm && (
            <div className="text-rose-600 text-sm bg-rose-50 p-4 rounded-xl text-center font-bold border border-rose-100 animate-shake mt-4">
              {error}
            </div>
          )}

          {/* Portal Links & Immersive Tour */}
          <div className="mt-4 pt-4 border-t border-slate-200 text-center space-y-3">
            <button 
              onClick={() => { SoundService.play('click'); window.location.hash = '#/landing'; }}
              className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-slate-200 flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <span className="text-lg">✨</span> {t('login.watchTour') || 'Watch Immersive Tour'}
            </button>
            
            <div className="flex justify-center gap-6">
              <a
                href="/tenant.html"
                onClick={() => SoundService.play('click')}
                className="text-sm text-blue-600 hover:text-blue-800 font-bold transition-colors inline-block"
              >
                🏠 {t('tenant.portal')}
              </a>
              <a
                href="/owner.html"
                onClick={() => SoundService.play('click')}
                className="text-sm text-amber-600 hover:text-amber-800 font-bold transition-colors inline-block"
              >
                👑 Owner Portal
              </a>
            </div>
          </div>
        </div>
      </div>
      <LoadingOverlay visible={loading || biometricLoading} message="جاري التحقق..." />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* ── Forgot Password Modal ── */}
      {forgotOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setForgotOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Forgot Password</h3>
                  <p className="text-white/80 text-xs">Reset your password — admin will be notified</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <form
              className="p-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setForgotMsg(null);
                if (!forgotId.trim()) { setForgotMsg({ type: 'error', text: 'Enter your User ID' }); return; }
                if (forgotNewPass.length < 4) { setForgotMsg({ type: 'error', text: 'New password must be at least 4 characters' }); return; }
                if (forgotNewPass !== forgotConfirmPass) { setForgotMsg({ type: 'error', text: 'Passwords do not match' }); return; }
                setForgotLoading(true);
                try {
                  const svc = await import('../services/firestoreService');
                  await svc.requestPasswordReset(forgotId.trim(), forgotNewPass);
                  setForgotMsg({ type: 'success', text: 'Password changed successfully! You can now login with your new password.' });
                  setForgotNewPass(''); setForgotConfirmPass('');
                } catch (err: any) {
                  setForgotMsg({ type: 'error', text: err?.message || 'Failed to send request' });
                } finally {
                  setForgotLoading(false);
                }
              }}
            >
              {/* User ID */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('login.userId')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={forgotId}
                    onChange={e => setForgotId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-sm font-medium"
                    placeholder="Enter your User ID"
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('settings.newPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type={forgotShowPass ? 'text' : 'password'}
                    required
                    value={forgotNewPass}
                    onChange={e => setForgotNewPass(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-sm font-medium"
                    placeholder="Enter new password"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setForgotShowPass(p => !p)} className="absolute right-3 top-3 text-slate-400 hover:text-amber-500 transition-colors">
                    {forgotShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('settings.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type={forgotShowPass ? 'text' : 'password'}
                    required
                    value={forgotConfirmPass}
                    onChange={e => setForgotConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-sm font-medium"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {/* Messages */}
              {forgotMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold border ${
                  forgotMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {forgotMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {forgotMsg.text}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg disabled:opacity-50"
                >
                  {forgotLoading ? 'Changing...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
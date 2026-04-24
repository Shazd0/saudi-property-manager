import React, { useState, useEffect, useRef } from 'react';
import { Crown, Lock, ArrowRight, Fingerprint, ShieldCheck, Download, Smartphone, Eye, EyeOff, AlertTriangle, CheckCircle, X, KeyRound } from 'lucide-react';
import { isBiometricAvailable, registerPasskey, authenticatePasskey, isBiometricEnabled, storeBiometricUserData, getBiometricUserData } from '../services/webauthnService';
import logo from '../images/logo.png';
import { useLanguage } from '../i18n';

interface OwnerLoginProps {
  onLogin: (owner: any) => void;
  onSwitchToStaff: () => void;
}

/* ── DESIGN TOKENS ── */
const PRIMARY = '#1e40af';
const PRIMARY_LIGHT = '#3b82f6';
const BG = '#f8fafc';

/* ═══ SHARED UI ATOMS (defined outside to preserve React identity across renders) ═══ */
const PrimaryButton = ({ onClick, disabled, children, secondary, type }: any) => (
  <button onClick={onClick} disabled={disabled} type={type || 'button'}
    className={`w-full relative group overflow-hidden rounded-2xl font-bold text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]
      ${secondary ? 'py-3 text-slate-400 hover:text-slate-600 bg-transparent' : 'py-4 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01]'}`}
    style={secondary ? {} : { background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
  >
    {!secondary && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />}
    <span className="relative flex items-center justify-center gap-3">{children}</span>
  </button>
);

const Card = ({ children, className = '' }: any) => (
  <div className={`relative rounded-3xl overflow-hidden bg-white ${className}`}
    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)' }}>
    {children}
  </div>
);

const ErrorBox = ({ error }: { error: string }) => error ? (
  <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
    <span className="text-red-600 text-xs font-semibold">{error}</span>
  </div>
) : null;

const Spinner = () => (
  <div className="w-5 h-5 border-2 rounded-full animate-spin border-white/30 border-t-white" />
);

/* ═══ Install Modal ═══ */
const InstallModal = ({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
    <div className="w-full max-w-[400px] bg-white rounded-3xl overflow-hidden shadow-2xl animate-in"
      style={{ animation: 'slideUp 0.4s ease-out' }}>
      {/* Header */}
      <div className="relative p-8 pb-6 text-center"
        style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}>
        <button onClick={onDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-white/20 text-white/80 hover:bg-white/30 transition-colors">
          <X size={14} />
        </button>
        <div className="w-20 h-20 rounded-[22px] bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30">
          <img src={logo} alt="Amlak" className="w-11 h-11 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <h3 className="text-white text-xl font-black tracking-tight">Install Amlak Owner</h3>
        <p className="text-white/70 text-xs font-medium mt-1">Get the best experience</p>
      </div>
      {/* Benefits */}
      <div className="px-8 py-6 space-y-3">
        {[
          { icon: '⚡', text: 'Instant access from home screen' },
          { icon: '🔔', text: 'Get real-time notifications' },
          { icon: '🔒', text: 'Secure biometric login' },
          { icon: '📱', text: 'Works offline' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-base">{item.icon}</span>
            <span className="text-slate-600 text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
      {/* Actions */}
      <div className="px-8 pb-8 space-y-3">
        <button onClick={onInstall}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}>
          <span className="flex items-center justify-center gap-2"><Download size={16} /> Install Now</span>
        </button>
        <button onClick={onDismiss}
          className="w-full py-3 rounded-2xl text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors">
          Maybe Later
        </button>
      </div>
    </div>
  </div>
);

const OwnerLogin: React.FC<OwnerLoginProps> = ({ onLogin, onSwitchToStaff }) => {
  const { t, isRTL } = useLanguage();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricUser, setBiometricUser] = useState<any>(null);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricSetupDone, setBiometricSetupDone] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const pendingLoginRef = useRef<any>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) {
        const userData = getBiometricUserData();
        if (userData && userData.isOwner) setBiometricUser(userData);
      }
    })();
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Only auto-show modal if user hasn't dismissed it recently
      const dismissed = localStorage.getItem('ownerInstallDismissed');
      const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;
      const hoursSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60);
      if (!dismissed || hoursSinceDismiss > 24) {
        // Show install modal after a short delay
        setTimeout(() => setShowInstallModal(true), 2000);
      }
      setShowInstallBanner(true);
    };
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setShowInstallBanner(false); setShowInstallModal(false); });
    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstall); };
  }, []);

  useEffect(() => {
    if (biometricUser && biometricAvailable && mounted) handleBiometricLogin();
  }, [biometricUser, biometricAvailable, mounted]);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const r = await installPrompt.userChoice;
      if (r.outcome === 'accepted') { setIsInstalled(true); setShowInstallBanner(false); setShowInstallModal(false); }
    } catch {}
  };

  const handleDismissInstall = () => {
    setShowInstallModal(false);
    localStorage.setItem('ownerInstallDismissed', Date.now().toString());
  };

  const handleBiometricLogin = async () => {
    if (!biometricUser) return;
    setBiometricLoading(true); setError('');
    try {
      const success = await authenticatePasskey(biometricUser.id || biometricUser.uid);
      if (success) { onLogin(biometricUser); } else { setError('Biometric verification failed.'); setBiometricUser(null); }
    } catch { setError('Biometric error.'); setBiometricUser(null); }
    setBiometricLoading(false);
  };

  const handleBiometricSetup = async () => {
    if (!pendingLoginRef.current) return;
    setBiometricLoading(true);
    try {
      const user = pendingLoginRef.current;
      const success = await registerPasskey(user.id || user.uid, user.name || 'Owner');
      if (success) { storeBiometricUserData({ ...user, isOwner: true }); setBiometricSetupDone(true); setTimeout(() => onLogin(user), 1500); }
      else { setError('Setup failed.'); setTimeout(() => onLogin(user), 1000); }
    } catch { setError('Setup error.'); setTimeout(() => onLogin(pendingLoginRef.current), 1000); }
    setBiometricLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!loginId.trim() || !password.trim()) { setError('Please enter both Login ID and Password.'); return; }
    setLoading(true);
    try {
      const svc = await import('../services/firestoreService');
      const users = await svc.getAllUsersGlobal();
      const lid = loginId.trim().toLowerCase();
      const owner = (users || []).find((u: any) => {
        if (!(u.isOwner || u.role === 'OWNER')) return false;
        // Match by ID, email, name, or phone
        return u.id === loginId.trim() ||
          (u.email && u.email.toLowerCase() === lid) ||
          (u.name && u.name.toLowerCase() === lid) ||
          (u.phone && u.phone === loginId.trim());
      });
      if (!owner) { setError('Owner account not found. Try your name, email, phone, or ID.'); setLoading(false); return; }
      if (owner.password && owner.password !== password) { setError('Incorrect password.'); setLoading(false); return; }
      if (biometricAvailable && !isBiometricEnabled(owner.id)) {
        pendingLoginRef.current = { ...owner, isOwner: true }; setShowBiometricSetup(true); setLoading(false); return;
      }
      onLogin({ ...owner, isOwner: true });
    } catch { setError('Login failed. Please try again.'); }
    setLoading(false);
  };

  /* ═══ BIOMETRIC SETUP SCREEN ═══ */
  if (showBiometricSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: BG }}>
        <div className={`w-full max-w-[420px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <Card className="p-8 sm:p-10 text-center">
            {biometricSetupDone ? (
              <>
                <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-emerald-50">
                  <CheckCircle size={44} className="text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">All Set!</h2>
                <p className="text-slate-400 text-sm">Next time, just use your biometric to sign in instantly.</p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-blue-50">
                  <Fingerprint size={44} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Secure Your Account</h2>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  Enable Face ID, Fingerprint, or Windows Hello for instant & secure access.
                </p>
                <div className="space-y-3">
                  <PrimaryButton onClick={handleBiometricSetup} disabled={biometricLoading}>
                    {biometricLoading ? <Spinner /> : <Fingerprint size={18} />}
                    {biometricLoading ? 'Setting up...' : 'Enable Biometric'}
                  </PrimaryButton>
                  <PrimaryButton secondary onClick={() => pendingLoginRef.current && onLogin(pendingLoginRef.current)}>
                    Skip for now
                  </PrimaryButton>
                </div>
                <div className="mt-4"><ErrorBox error={error} /></div>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* ═══ BIOMETRIC AUTO-LOGIN SCREEN ═══ */
  if (biometricUser && biometricAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: BG }}>
        <div className={`w-full max-w-[420px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <Card className="p-8 sm:p-10 text-center">
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-blue-50">
              <Fingerprint size={44} className={biometricLoading ? 'animate-pulse text-blue-600' : 'text-blue-600'} />
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[3px] mb-2">{t('app.welcome')}</p>
            <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">{biometricUser.name || 'Owner'}</h2>
            <p className="text-slate-400 text-xs mb-8">Use biometric to authenticate</p>
            <PrimaryButton onClick={handleBiometricLogin} disabled={biometricLoading}>
              {biometricLoading ? <Spinner /> : <Fingerprint size={18} />}
              {biometricLoading ? 'Verifying...' : 'Authenticate'}
            </PrimaryButton>
            <button onClick={() => setBiometricUser(null)} className="mt-4 text-slate-300 hover:text-slate-500 text-xs font-semibold transition-colors">
              Use password instead
            </button>
            <div className="mt-4"><ErrorBox error={error} /></div>
          </Card>
        </div>
      </div>
    );
  }

  /* ═══ MAIN LOGIN SCREEN ═══ */
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: BG }}>
      {/* ── Soft Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-15%] w-[70vw] h-[70vw] rounded-full" style={{ background: 'radial-gradient(circle, rgba(30,64,175,0.03) 0%, transparent 60%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 60%)' }} />
      </div>

      {/* ── PWA Install Banner ── */}
      {showInstallBanner && !isInstalled && (
        <div className="relative z-50 px-4 py-3 flex items-center justify-between gap-3 bg-white shadow-md" style={{ borderBottom: '2px solid #1e40af' }}>
          <div className="flex items-center gap-3">
            <Download size={16} className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-slate-800 text-xs">Install Amlak Owner</p>
              <p className="text-[10px] font-medium text-slate-400">Quick access from home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleInstallApp} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors">Install</button>
            <button onClick={() => setShowInstallBanner(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className={`w-full max-w-[420px] transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          {/* ── Logo & Brand ── */}
          <div className="text-center mb-10">
            <div className="relative inline-block mb-6">
              <div className="w-[88px] h-[88px] rounded-[26px] flex items-center justify-center mx-auto relative bg-white"
                style={{ boxShadow: '0 20px 60px rgba(30,64,175,0.08), 0 4px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <img src={logo} alt="Amlak" className="w-12 h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500" style={{ boxShadow: '0 0 10px rgba(59,130,246,0.4)' }} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[4px] text-blue-600">AMLAK PREMIUM</p>
              <h1 className="text-[28px] font-black text-slate-800 tracking-tight leading-none">{t('nav.ownerPortal')}</h1>
              <p className="text-slate-300 text-xs font-medium" style={{ fontFamily: 'Tajawal, sans-serif' }}>بوابة المالك</p>
            </div>
          </div>

          {/* ── Login Card ── */}
          <Card className="p-7 sm:p-9">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Login ID */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2.5 text-slate-400">Login ID</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-sm font-medium outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 shadow-sm"
                    placeholder="Name, email, phone, or ID" autoComplete="username" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2.5 text-slate-400">{t('login.password')}</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-sm font-medium outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 shadow-sm"
                    placeholder="Enter your password" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <ErrorBox error={error} />

              {/* Submit */}
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? <Spinner /> : <><ShieldCheck size={16} /> Sign In <ArrowRight size={14} /></>}
              </PrimaryButton>
            </form>

            {/* Biometric hint */}
            {biometricAvailable && (
              <div className="mt-5 pt-5 text-center border-t border-slate-50">
                <div className="inline-flex items-center gap-2 text-slate-300 text-[10px] font-semibold">
                  <Fingerprint size={11} className="text-blue-400" />
                  <span>Biometric login available after first sign-in</span>
                </div>
              </div>
            )}
          </Card>

          {/* ── Footer Area ── */}
          <div className="mt-8 text-center space-y-4">
            {/* Install App */}
            {!isInstalled && installPrompt && (
              <button onClick={handleInstallApp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100"
              >
                <Download size={13} />{t('dashboard.installApp')}</button>
            )}

            {!isInstalled && !installPrompt && (
              <div className="rounded-2xl p-4 bg-white border border-slate-100" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold mb-2">
                  <Smartphone size={12} /> Install as App
                </div>
                <p className="text-slate-300 text-[10px] leading-relaxed">
                  <span className="text-slate-400">iOS:</span> Share → Add to Home Screen &nbsp;|&nbsp;
                  <span className="text-slate-400">Android:</span> Menu → Install App
                </p>
              </div>
            )}

            {isInstalled && (
              <div className="inline-flex items-center gap-2 text-emerald-500 text-[10px] font-bold">
                <CheckCircle size={12} /> App installed
              </div>
            )}

            <div>
              <button onClick={onSwitchToStaff} className="text-slate-300 hover:text-slate-500 text-[10px] font-semibold transition-colors tracking-wide">
                ← Staff Portal
              </button>
            </div>
          </div>

          {/* ── Branding ── */}
          <div className="text-center mt-10">
            <p className="text-[9px] font-bold tracking-[3px] uppercase text-slate-200">AMLAK PREMIUM  •  RR GROUP</p>
          </div>

      {/* ── Install Modal Overlay ── */}
      {showInstallModal && !isInstalled && installPrompt && (
        <InstallModal onInstall={handleInstallApp} onDismiss={handleDismissInstall} />
      )}

      {/* slideUp animation */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
        </div>
      </div>
    </div>
  );
};

export default OwnerLogin;

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Lock, Phone, ArrowRight, Mail, ShieldCheck, 
  AlertTriangle, Sparkles, Star, User, UserPlus,
  KeyRound, ArrowLeft, Smartphone, CreditCard, RefreshCw, Fingerprint
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import LanguageToggle from '../LanguageToggle';
import SoundService from '../../services/soundService';
import logo from '../../images/logo.png';
import { initiateNafathVerification, checkNafathStatus } from '../../services/nafathService';
import type { NafathStatusValue } from '../../services/nafathService';

// --- UTILITY FUNCTIONS ---
const isValidMobile = (mobile: string) => /^05\d{8}$/.test(mobile);
const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
const generateCaptcha = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b} = ?`, answer: String(a + b) };
};

// --- COMPONENT: TENANT LOGIN ---
interface TenantLoginProps {
  onLogin: (tenant: any) => void;
  onSwitchToStaff: () => void;
}

const TenantLogin: React.FC<TenantLoginProps> = ({ onLogin }) => {
  // 1. Hooks MUST come first
  const { t, isRTL } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'nafath-verify'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);

  // Login fields
  const [mobileNo, setMobileNo] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regNameEn, setRegNameEn] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regIqama, setRegIqama] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Nafath verification state
  const [nafathRandom, setNafathRandom] = useState<number>(0);
  const [nafathTransId, setNafathTransId] = useState('');
  const [nafathStatus, setNafathStatus] = useState<NafathStatusValue>('WAITING');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nafathIqamaRef = useRef('');

  // Security CAPTCHA
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
  };

  // Stop any running Nafath poll
  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Actually persist the new customer to Firestore and auto-login
  const finishRegistration = async () => {
    try {
      const svc = await import('../../services/firestoreService');
      const newCustomer = {
        nameEn: regNameEn,
        nameAr: regNameEn,
        name: regNameEn,
        email: regEmail,
        mobileNo: regMobile,
        mobile: regMobile,
        phone: regMobile,
        iqamaNo: nafathIqamaRef.current,
        nafathVerified: true,
        nafathVerifiedAt: new Date().toISOString(),
        isTenant: true,
        status: 'Active',
        password: regPassword,
      };
      const id = await (svc as any).addCustomer(newCustomer);
      SoundService.play('success');
      onLogin({
        id,
        customerId: id,
        name: regNameEn,
        nameEn: regNameEn,
        nameAr: regNameEn,
        mobileNo: regMobile,
        email: regEmail,
        isTenant: true,
      });
    } catch (err) {
      console.error('Registration error:', err);
      setError(isRTL ? 'فشل حفظ البيانات. حاول مجدداً.' : 'Failed to save registration. Try again.');
      setMode('register');
    }
  };

  // Start polling Nafath status, resolves when done
  const startNafathPoll = (iqama: string, transId: string, random: number) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const result = await checkNafathStatus(iqama, transId, random);
        setNafathStatus(result.status);
        if (result.status === 'COMPLETED') {
          stopPoll();
          await finishRegistration();
        } else if (result.status === 'REJECTED') {
          stopPoll();
          setError(isRTL ? 'رُفض التحقق من نفاذ. يرجى المحاولة مجدداً.' : 'Nafath verification was rejected. Please try again.');
          setMode('register');
        } else if (result.status === 'EXPIRED') {
          stopPoll();
          setError(isRTL ? 'انتهت مهلة نفاذ (3 دقائق). أعد الطلب.' : 'Nafath session expired (3 min). Please request again.');
          setMode('register');
        }
      } catch (_) { /* keep polling on transient errors */ }
    }, 5000);
  };

  // 2. Handlers defined AFTER hooks
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!mobileNo.trim() || !password.trim()) {
      setError(t('tenant.requiredFields'));
      return;
    }
    if (!isValidMobile(mobileNo)) {
      setError(t('tenant.invalidMobile'));
      return;
    }

    setLoading(true);
    try {
      const svc = await import('../../services/firestoreService');
      const customers = await svc.getCustomers();
      // Find customer by mobile number (check both mobileNo and phone fields)
      const customer = (customers || []).find((c: any) =>
        c.mobileNo === mobileNo || c.mobile === mobileNo || c.phone === mobileNo
      );

      if (!customer) {
        setError(t('tenant.invalidCredentials'));
        setLoading(false);
        return;
      }

      // Password = last 4 digits of their mobile number
      const expectedPassword = mobileNo.slice(-4);

      // Also accept a custom password if one was set on the customer record
      const customPassword = customer.password || customer.tenantPassword;
      const isValidPassword = password === expectedPassword || (customPassword && password === customPassword);

      if (!isValidPassword) {
        setError(t('tenant.invalidCredentials'));
        setLoading(false);
        return;
      }

      SoundService.play('success');
      onLogin({
        id: customer.id,
        customerId: customer.id,
        name: customer.nameEn || customer.nameAr || customer.name || 'Tenant',
        nameEn: customer.nameEn || '',
        nameAr: customer.nameAr || '',
        mobileNo: mobileNo,
        email: customer.email || '',
        isTenant: true,
      });
    } catch (err) {
      console.error('Login error:', err);
      setError(isRTL ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    setError('');

    if (!regNameEn || !regMobile || !regEmail || !regPassword || !regIqama) {
      setError(t('tenant.requiredFields'));
      return;
    }
    if (!/^\d{10}$/.test(regIqama)) {
      setError(isRTL ? 'رقم الإقامة / الهوية يجب أن يكون 10 أرقام' : 'Iqama / National ID must be 10 digits');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError(t('tenant.passwordMismatch'));
      return;
    }
    if (captchaAnswer.trim() !== captcha.answer) {
      setError(t('tenant.captchaFailed'));
      refreshCaptcha();
      return;
    }
    if (!termsAccepted) {
      setError(t('tenant.acceptTerms'));
      return;
    }

    setLoading(true);
    try {
      const result = await initiateNafathVerification(regIqama);
      if (result.error) {
        throw new Error(result.error);
      }
      nafathIqamaRef.current = regIqama;
      setNafathRandom(result.random);
      setNafathTransId(result.transId);
      setNafathStatus('WAITING');
      setMode('nafath-verify');
      startNafathPoll(regIqama, result.transId, result.random);
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'تعذّر الاتصال بنفاذ. حاول لاحقاً.' : 'Could not connect to Nafath. Try again later.'));
    } finally {
      setLoading(false);
    }
  };



  // Luxury input styling helper
  const inputClass = (hasIcon = false) =>
    `w-full ${hasIcon ? (isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4') : 'px-4'} py-3 bg-white/[0.07] border border-amber-200/20 rounded-xl focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/40 focus:bg-white/[0.12] outline-none transition-all duration-300 font-medium text-white placeholder-white/30 backdrop-blur-sm text-sm`;

  const iconPos = isRTL ? 'right-4' : 'left-4';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans" dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(135deg, #0c0a15 0%, #1a1025 25%, #0f172a 50%, #1a1025 75%, #0c0a15 100%)' }}>
      
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -right-[15%] w-[70%] h-[70%] rounded-full blur-[120px] animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.05) 50%, transparent 70%)' }} />
        <div className="absolute top-[50%] -left-[20%] w-[50%] h-[50%] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, rgba(139,92,246,0.03) 50%, transparent 70%)' }} />
      </div>

      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="rounded-[2rem] overflow-hidden shadow-2xl border border-white/[0.08]"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(40px)' }}>
          
          {/* Header Section */}
          <div className="relative pt-8 pb-6 px-8 text-center">
            <div className="absolute top-3 right-4 z-20">
              <LanguageToggle compact className="bg-white/10 text-amber-200/80 hover:bg-white/20 border border-amber-200/10" />
            </div>
            
            <div className="relative inline-block mb-4">
               <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/20">
                  <Building2 className="text-amber-400" size={32} />
               </div>
            </div>

            <div className="flex items-center justify-center gap-2 mb-1">
              <Star size={12} className="text-amber-400/60" fill="currentColor" />
              <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300">
                {t('tenant.portal')}
              </h1>
              <Star size={12} className="text-amber-400/60" fill="currentColor" />
            </div>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.25em]">Premium Access</p>
          </div>

          {/* Tab Switcher */}
          {mode !== 'forgot' && mode !== 'nafath-verify' ? (
            <div className="flex mx-6 mb-6 rounded-xl p-1 bg-black/30 border border-white/5">
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  mode === 'login' ? 'text-amber-200 bg-white/10 shadow-sm' : 'text-white/40'
                }`}
              >
                {t('tenant.login')}
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); setSuccess(''); refreshCaptcha(); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  mode === 'register' ? 'text-amber-200 bg-white/10 shadow-sm' : 'text-white/40'
                }`}
              >
                {t('tenant.register')}
              </button>
            </div>
          ) : (
            <div className="mx-6 mb-6">
              {mode === 'forgot' && (
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="flex items-center gap-2 text-xs text-white/50 hover:text-amber-400 transition-colors group"
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                {isRTL ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </button>
              )}
            </div>
          )}

          {/* Scrollable Form Area */}
          <div className="px-6 pb-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {success && (
              <div className="mb-5 p-3 rounded-xl text-xs font-bold text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-2">
                <ShieldCheck size={14} /> {success}
              </div>
            )}
            
            {error && (
              <div className="mb-5 p-3 rounded-xl text-xs font-bold text-center bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center justify-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-500/60 ml-1">{t('tenant.mobileNo')}</label>
                  <div className="relative group">
                    <Phone className={`absolute ${iconPos} top-3.5 text-white/30 group-focus-within:text-amber-400/70`} size={16} />
                    <input
                      type="tel"
                      value={mobileNo}
                      onChange={e => setMobileNo(e.target.value)}
                      className={inputClass(true)}
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-500/60 ml-1">{t('tenant.password')}</label>
                  <div className="relative group">
                    <Lock className={`absolute ${iconPos} top-3.5 text-white/30 group-focus-within:text-amber-400/70`} size={16} />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={inputClass(true)}
                      placeholder={t('login.enterPassword')}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                   <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors">
                     {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                   </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 mt-2"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                >
                  {loading ? <span className="animate-spin text-xl">◌</span> : (
                    <>
                      {t('tenant.loginBtn')} <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="relative group">
                   <User className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="text" placeholder={t('tenant.fullNameEn')} value={regNameEn} onChange={e => setRegNameEn(e.target.value)} className={inputClass(true)} />
                </div>
                <div className="relative group">
                   <Phone className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="tel" placeholder="Mobile (05xxxxxxxx)" value={regMobile} onChange={e => setRegMobile(e.target.value)} className={inputClass(true)} />
                </div>
                <div className="relative group">
                   <CreditCard className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="text" maxLength={10} placeholder={isRTL ? 'رقم الهوية / الإقامة (10 أرقام)' : 'National ID / Iqama (10 digits)'} value={regIqama} onChange={e => setRegIqama(e.target.value.replace(/\D/g, ''))} className={inputClass(true)} />
                </div>
                <div className="relative group">
                   <Mail className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="email" placeholder={t('tenant.emailAddress')} value={regEmail} onChange={e => setRegEmail(e.target.value)} className={inputClass(true)} />
                </div>
                <div className="relative group">
                   <Lock className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="password" placeholder="Create Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className={inputClass(true)} />
                </div>
                <div className="relative group">
                   <Lock className={`absolute ${iconPos} top-3.5 text-white/30`} size={16} />
                   <input type="password" placeholder={t('settings.confirmPassword')} value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className={inputClass(true)} />
                </div>
                
                {/* Math Captcha */}
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-amber-200/70">Security Check</span>
                      <span className="text-sm font-bold text-white tracking-widest bg-black/40 px-3 py-1 rounded-lg">{captcha.question}</span>
                   </div>
                   <input 
                    type="text" 
                    placeholder="Enter result" 
                    value={captchaAnswer} 
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-center text-white focus:border-amber-500/50 outline-none"
                   />
                </div>

                <label className="flex items-center gap-3 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/40" />
                  <span>I accept the Terms & Privacy Policy</span>
                </label>

                {/* Nafath notice */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/70">
                  <Fingerprint size={14} className="mt-0.5 flex-shrink-0 text-amber-400" />
                  <span>{isRTL ? 'سيُطلب منك التحقق عبر تطبيق نفاذ قبل إتمام التسجيل.' : 'You will be asked to verify via the Nafath app before registration is complete.'}</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                >
                  {loading ? <span className="animate-spin text-xl">◌</span> : (
                    <>{isRTL ? 'التحقق عبر نفاذ' : 'Verify with Nafath'}<Fingerprint size={16} /></>
                  )}
                </button>
              </form>
            )}

            {/* NAFATH VERIFY SCREEN */}
            {mode === 'nafath-verify' && (
              <div className="space-y-6 py-2 text-center">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full animate-spin" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(245,158,11,0.5), transparent)', animationDuration: '2s' }} />
                  <div className="absolute inset-[3px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(145deg, rgba(30,20,50,0.95), rgba(15,23,42,0.95))' }}>
                    <Fingerprint className="text-amber-400" size={30} />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-black text-white mb-1">{isRTL ? 'التحقق عبر نفاذ' : 'Nafath Verification'}</h2>
                  <p className="text-[11px] text-white/40">{isRTL ? 'افتح تطبيق نفاذ وقم بتأكيد الرقم أدناه' : 'Open the Nafath app and confirm the number below'}</p>
                </div>

                {/* The random number */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{isRTL ? 'الرقم للتأكيد' : 'Number to confirm'}</span>
                  <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 py-2" style={{ textShadow: 'none', filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.4))' }}>
                    {nafathRandom}
                  </div>
                  <span className="text-[10px] text-white/25">{isRTL ? 'انتهاء الصلاحية خلال 3 دقائق' : 'Expires in 3 minutes'}</span>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border border-white/10 p-4 bg-white/[0.03] text-right space-y-2">
                  {[
                    isRTL ? '١. افتح تطبيق نفاذ على هاتفك' : '1. Open the Nafath app on your phone',
                    isRTL ? '٢. ستظهر لك طلبات التحقق المعلّقة' : '2. You will see the pending verification request',
                    isRTL ? `٣. تأكد أن الرقم المعروض هو ${nafathRandom} ثم اضغط موافق` : `3. Confirm the number is ${nafathRandom} then tap Approve`,
                  ].map((step, i) => (
                    <p key={i} className="text-xs text-white/50">{step}</p>
                  ))}
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 text-xs font-bold">
                  {nafathStatus === 'WAITING' && (
                    <>
                      <RefreshCw size={13} className="animate-spin text-amber-400" />
                      <span className="text-amber-300/80">{isRTL ? 'في انتظار الموافقة...' : 'Waiting for approval...'}</span>
                    </>
                  )}
                  {nafathStatus === 'COMPLETED' && (
                    <>
                      <ShieldCheck size={13} className="text-emerald-400" />
                      <span className="text-emerald-300">{isRTL ? 'تم التحقق! جارٍ إنشاء الحساب...' : 'Verified! Creating account...'}</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { stopPoll(); setMode('register'); setError(''); }}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  {isRTL ? 'إلغاء والرجوع' : 'Cancel & go back'}
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && (
               <div className="space-y-5 py-2">
                 {/* Luxurious header */}
                 <div className="text-center">
                   <div className="relative w-20 h-20 mx-auto mb-5">
                     <div className="absolute inset-0 rounded-full animate-spin" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(245,158,11,0.4), transparent)', animationDuration: '3s' }} />
                     <div className="absolute inset-[3px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(145deg, rgba(30,20,50,0.95), rgba(15,23,42,0.95))' }}>
                       <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))', boxShadow: '0 0 30px rgba(245,158,11,0.15)' }}>
                         <KeyRound className="text-amber-400 drop-shadow-lg" size={24} />
                       </div>
                     </div>
                   </div>
                   <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-1">
                     {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                   </h2>
                   <p className="text-[11px] text-white/35 font-medium">
                     {isRTL ? 'لا تقلق — إليك التذكير' : "Don't worry — here's your reminder"}
                   </p>
                 </div>

                 {/* Golden hint card */}
                 <div className="relative rounded-2xl overflow-hidden">
                   <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #92400e 50%, #f59e0b 100%)' }} />
                   <div className="absolute inset-[1px] rounded-2xl" style={{ background: 'linear-gradient(160deg, rgba(20,15,35,0.97), rgba(15,23,42,0.97))' }} />
                   <div className="relative px-5 py-6 text-center">
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                       <ShieldCheck size={12} className="text-amber-400" />
                       <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400/90">
                         {isRTL ? 'تلميح آمن' : 'Secure Hint'}
                       </span>
                     </div>
                     <p className="text-[13px] text-white/70 leading-relaxed font-medium">
                       {isRTL ? 'كلمة المرور الخاصة بك هي' : 'Your password is the'}
                       {' '}
                       <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                         {isRTL ? 'آخر ٤ أرقام' : 'last 4 digits'}
                       </span>
                       {' '}
                       {isRTL ? 'من رقم جوالك' : 'of your mobile number'}
                     </p>
                   </div>
                 </div>

                 {/* Visual example */}
                 <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                   <div className="px-4 py-2 border-b border-white/[0.05]">
                     <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
                       {isRTL ? 'مثال توضيحي' : 'Example'}
                     </span>
                   </div>
                   <div className="px-4 py-4 flex items-center justify-center gap-4">
                     <div className="flex items-center gap-2">
                       <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                         <Smartphone size={13} className="text-white/40" />
                       </div>
                       <div className="flex items-baseline gap-0.5 font-mono">
                         <span className="text-xs text-white/25 tracking-wide">0512 34</span>
                         <span className="text-sm font-black text-amber-400 tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', boxShadow: '0 0 12px rgba(245,158,11,0.08)' }}>5678</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-1">
                       <div className="w-5 h-[1px] bg-gradient-to-r from-transparent to-amber-500/40" />
                       <ArrowRight size={12} className="text-amber-500/50" />
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.08)' }}>
                         <Lock size={13} className="text-amber-400" />
                       </div>
                       <span className="text-base font-black text-amber-400 font-mono tracking-[0.15em]" style={{ textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>5678</span>
                     </div>
                   </div>
                 </div>

                 {/* Help note */}
                 <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                   <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-500/20">
                     <AlertTriangle size={11} className="text-blue-400" />
                   </div>
                   <p className="text-[11px] text-white/35 leading-relaxed">
                     {isRTL
                       ? 'إذا كنت لا تزال غير قادر على تسجيل الدخول، يرجى التواصل مع إدارة المبنى للمساعدة.'
                       : 'Still unable to login? Please contact your building management for assistance.'}
                   </p>
                 </div>

                 {/* Back to login button */}
                 <button
                   onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                   className="w-full py-3.5 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all active:scale-[0.97] hover:shadow-xl hover:shadow-amber-500/20 relative overflow-hidden group"
                   style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)' }}
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                   <ArrowLeft size={16} />
                   {isRTL ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                 </button>
               </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-white/5 text-center">
               <div className="flex items-center justify-center gap-2 text-[10px] text-white/20 uppercase tracking-widest">
                  <Sparkles size={10} /> Secure Tenant Portal <Sparkles size={10} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantLogin;
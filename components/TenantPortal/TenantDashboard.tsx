import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../i18n';
import LanguageToggle from '../LanguageToggle';
import { Building2, FileSignature, CreditCard, LogOut, Home, Clock, ExternalLink, ChevronRight, Wallet, TrendingUp, CheckCircle, Receipt, X, Info, Copy, Check, Crown, Sparkles, Shield, RefreshCw, CalendarDays, ArrowUpRight, BadgePercent, CircleDollarSign, LayoutGrid, ScrollText, Banknote, ChevronDown, MapPin, Smartphone, Upload, ImageIcon, Eye } from 'lucide-react';
import SoundService from '../../services/soundService';
import { fmtDate } from '../../utils/dateFormat';
import logo from '../../images/logo.png';

interface TenantDashboardProps {
  tenant: any;
  onLogout: () => void;
}

const TenantDashboard: React.FC<TenantDashboardProps> = ({ tenant, onLogout }) => {
  const { t, language, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'payments'>('overview');
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [showEjarInfo, setShowEjarInfo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSadadInfo, setShowSadadInfo] = useState(false);
  const [showEjarAgreement, setShowEjarAgreement] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [iqamaUploading, setIqamaUploading] = useState(false);
  const [showIqamaFull, setShowIqamaFull] = useState(false);
  const [iqamaUrl, setIqamaUrl] = useState(tenant.iqamaImageUrl || '');

  const saudiBanks = [
    { name: 'Al Rajhi Bank', nameAr: 'بنك الراجحي', app: 'alrajhibank://', url: 'https://www.alrajhibank.com.sa/', color: '#0072bc' },
    { name: 'SNB (Al Ahli)', nameAr: 'البنك الأهلي', app: 'alahlibank://', url: 'https://www.alahli.com/', color: '#006341' },
    { name: 'SABB', nameAr: 'ساب', app: 'sabbmobile://', url: 'https://www.sabb.com/', color: '#e60012' },
    { name: 'Riyad Bank', nameAr: 'بنك الرياض', app: 'riyadbank://', url: 'https://www.riyadbank.com/', color: '#4a2c8c' },
    { name: 'Saudi Fransi', nameAr: 'السعودي الفرنسي', app: 'bsfmobile://', url: 'https://www.alfransi.com.sa/', color: '#008c95' },
    { name: 'ANB', nameAr: 'العربي الوطني', app: 'anbmobile://', url: 'https://www.anb.com.sa/', color: '#005b7f' },
    { name: 'Alinma', nameAr: 'الإنماء', app: 'alinmaapp://', url: 'https://www.alinma.com/', color: '#7c2b7b' },
    { name: 'Bank Aljazira', nameAr: 'بنك الجزيرة', app: 'bajmobile://', url: 'https://www.baj.com.sa/', color: '#0096a0' },
    { name: 'Bank Albilad', nameAr: 'بنك البلاد', app: 'albiladbank://', url: 'https://www.bankalbilad.com/', color: '#eab308' },
    { name: 'GIB', nameAr: 'الخليج الدولي', app: null, url: 'https://www.gib.com/', color: '#005b7f' },
    { name: 'SAIB', nameAr: 'السعودي للاستثمار', app: 'saibmobile://', url: 'https://www.saib.com.sa/', color: '#005b7f' },
    { name: 'Emirates NBD', nameAr: 'الإمارات دبي', app: null, url: 'https://www.emiratesnbd.com.sa/', color: '#003366' },
    { name: 'FAB', nameAr: 'أبوظبي الأول', app: null, url: 'https://www.bankfab.com/en-sa', color: '#005eb8' },
  ];

  const handleSadadPayment = () => { SoundService.play('click'); setShowSadadInfo(true); };

  const openBank = (app: string | null, url: string) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && app) { window.location.href = app; setTimeout(() => { window.open(url, '_blank'); }, 1200); }
    else { window.open(url, '_blank'); }
  };

  useEffect(() => { loadData(); }, [tenant]);

  const loadData = async () => {
    setLoading(true);
    try {
      const svc = await import('../../services/firestoreService');
      const allContracts = await svc.getContracts();
      const allTransactions = await svc.getTransactions({ role: 'ADMIN' });
      const allBuildings = await svc.getBuildings();
      setBuildings(allBuildings || []);
      const myContracts = (allContracts || []).filter((c: any) =>
        c.customerId === tenant.customerId || c.customerId === tenant.id || c.customerName === tenant.name || c.customerName === tenant.nameAr || c.customerName === tenant.nameEn
      );
      setContracts(myContracts);
      const contractIds = myContracts.map((c: any) => c.id);
      const buildingUnits = myContracts.map((c: any) => `${c.buildingId}-${c.unitName}`);
      const myPayments = (allTransactions || []).filter((tx: any) => {
        if (tx.type !== 'INCOME') return false;
        if (contractIds.includes(tx.contractId)) return true;
        if (tx.buildingId && tx.unitNumber && buildingUnits.includes(`${tx.buildingId}-${tx.unitNumber}`)) return true;
        return false;
      });
      setPayments(myPayments.sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
    } catch (e) { console.error('Error loading tenant data:', e); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const getBuildingName = (id: string) => { const b = buildings.find((x: any) => x.id === id); return b ? b.name : id; };

  const totalPaid = payments.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const totalContractValue = contracts.reduce((sum, c) => sum + (c.totalValue || c.rentValue || 0), 0);
  const totalRemaining = Math.max(0, totalContractValue - totalPaid);
  const activeContracts = contracts.filter(c => c.status === 'Active');
  const paymentPercent = totalContractValue > 0 ? Math.min(100, Math.round((totalPaid / totalContractValue) * 100)) : 0;

  // Compute installment details for each active contract
  const getContractInstallmentInfo = (contract: any) => {
    const installmentCount = contract.installmentCount || 1;
    const periodMonths = contract.periodMonths || 12;
    const gapMonths = Math.floor(periodMonths / installmentCount);
    const firstAmt = Number(contract.firstInstallment) || 0;
    const otherAmt = Number(contract.otherInstallment) || 0;
    const rentValue = Number(contract.totalValue || contract.rentValue) || 0;
    const installmentAmt = firstAmt || otherAmt || (installmentCount > 0 ? Math.round(rentValue / installmentCount) : rentValue);
    
    const today = new Date();
    let currentInstallment = 1;
    if (contract.fromDate) {
      const startDate = new Date(contract.fromDate + 'T00:00:00');
      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (i * gapMonths));
        if (dueDate > today) { currentInstallment = i + 1; break; }
        if (i === installmentCount - 1) currentInstallment = installmentCount;
      }
    }
    return { installmentCount, installmentAmt, currentInstallment, gapMonths };
  };

  const getNextDueDate = () => {
    const today = new Date();
    let nearest: Date | null = null;
    for (const contract of activeContracts) {
      if (!contract.fromDate || !contract.installmentCount) continue;
      const startDate = new Date(contract.fromDate + 'T00:00:00');
      const periodMonths = contract.periodMonths || 12;
      const gapMonths = Math.floor(periodMonths / contract.installmentCount);
      for (let i = 0; i < contract.installmentCount; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (i * gapMonths));
        if (dueDate >= today) { if (!nearest || dueDate < nearest) nearest = dueDate; break; }
      }
    }
    return nearest;
  };

  const nextDue = getNextDueDate();
  const daysUntilDue = nextDue ? Math.ceil((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const handleEjarPayment = () => {
    SoundService.play('click');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      const appUrl = 'https://www.ejar.sa';
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const w = window.open(appUrl, '_blank');
      if (!w) window.open(isIOS ? 'https://apps.apple.com/sa/app/ejar/id1598498220' : 'https://play.google.com/store/apps/details?id=sa.ejar.app', '_blank');
    }
    setShowEjarInfo(true);
  };

  const copyEjarLink = () => {
    navigator.clipboard.writeText('https://www.ejar.sa').then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }).catch(() => {});
  };

  const handleIqamaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setIqamaUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file, `iqama-${tenant.id}-${Date.now()}.${file.name.split('.').pop()}`);
      formData.append('upload_preset', 'amlak-chat');
      formData.append('folder', 'amlak-iqama');
      const res = await fetch('https://api.cloudinary.com/v1_1/dygyd2ril/image/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const url = data.secure_url;
      const svc = await import('../../services/firestoreService');
      await svc.saveCustomer({ ...tenant, iqamaImageUrl: url });
      tenant.iqamaImageUrl = url;
      setIqamaUrl(url);
      SoundService.play('success');
    } catch (err) {
      console.error('Iqama upload error:', err);
    }
    setIqamaUploading(false);
  };

  // Tenant initials
  const tenantName = tenant.nameEn || tenant.nameAr || tenant.name || '';
  const initials = tenantName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'T';

  // SVG progress ring
  const ringSize = 88;
  const strokeWidth = 5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (paymentPercent / 100) * circumference;

  // Tab config
  const tabs = [
    { key: 'overview' as const, label: t('tenant.tab.home'), icon: LayoutGrid },
    { key: 'contracts' as const, label: t('tenant.tab.contracts'), icon: ScrollText },
    { key: 'payments' as const, label: t('tenant.tab.payments'), icon: Banknote },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-[3px] border-emerald-100" />
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-500 animate-spin" style={{ animationDuration: '1.2s' }} />
            <div className="absolute inset-[10px] rounded-full flex items-center justify-center bg-emerald-50">
              <img src={logo} alt="" className="h-7 w-7 object-contain" />
            </div>
          </div>
          <p className="text-emerald-600 text-xs font-semibold tracking-wider uppercase">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Gate: Force iqama upload if tenant doesn't have one
  if (!iqamaUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
                <CreditCard size={28} className="text-white" />
              </div>
              <h2 className="text-lg font-extrabold text-white">{isRTL ? 'مطلوب رفع صورة الإقامة' : 'Iqama Upload Required'}</h2>
              <p className="text-white/80 text-xs mt-1">{isRTL ? 'يرجى رفع صورة الإقامة / الهوية لاستخدام البوابة' : 'Please upload your Iqama / ID photo to continue'}</p>
            </div>
            {/* Upload Area */}
            <div className="p-6">
              {iqamaUploading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-12 h-12 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-sm font-bold text-emerald-600">{isRTL ? 'جاري الرفع...' : 'Uploading...'}</p>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                    <Upload size={28} className="text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">{isRTL ? 'ارفع صورة الإقامة / الهوية' : 'Upload Iqama / ID Photo'}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{isRTL ? 'JPG أو PNG — أقل من 5 ميغا' : 'JPG or PNG — Max 5MB'}</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleIqamaUpload} />
                </label>
              )}
            </div>
            {/* Logout */}
            <div className="px-6 pb-6">
              <button onClick={onLogout} className="w-full py-2.5 rounded-xl text-slate-500 text-xs font-bold hover:text-slate-700 bg-slate-100 border border-slate-200 transition-colors">
                {isRTL ? 'تسجيل خروج' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* CSS for animations */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-fadeUp { animation: fadeUp 0.5s ease-out forwards; }
        .shimmer-slide { animation: shimmer 2s ease-in-out infinite; }
        .light-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03); border-radius: 1rem; }
        .light-card-hover { transition: all 0.3s ease; }
        .light-card-hover:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04); transform: translateY(-1px); }
        .section-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent); }
      `}</style>

      {/* ────── HEADER ────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-[14px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200/50">
                  <img src={logo} alt="logo" className="h-6 w-6 object-contain" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
              </div>
              <div>
                <h1 className="text-[13px] font-extrabold text-slate-800 tracking-tight">{isRTL ? 'بوابة المستأجر' : 'Tenant Portal'}</h1>
                <p className="text-[10px] text-slate-400 font-medium">{isRTL ? 'مرحباً بك' : 'Welcome back'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleRefresh} disabled={refreshing}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all active:scale-90">
                <RefreshCw size={14} className={`text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <LanguageToggle compact className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" />
              <button onClick={onLogout}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 text-slate-400 transition-all active:scale-90">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* ────── WELCOME HERO ────── */}
        <div className="animate-fadeUp" style={{ animationDelay: '0.05s' }}>
          <div className="relative rounded-[20px] overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-xl shadow-emerald-200/40">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

            <div className="relative p-5 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/20 border border-white/20 backdrop-blur-sm">
                  <span className="text-lg font-black text-white">{initials}</span>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-emerald-600 flex items-center justify-center">
                  <Crown size={10} className="text-amber-800" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200">{t('tenant.welcome')}</span>
                <h2 className="text-base font-black text-white truncate">{tenantName}</h2>
                <p className="text-[10px] text-emerald-200 mt-0.5 flex items-center gap-1.5">
                  <CalendarDays size={10} />
                  {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ────── PAYMENT PROGRESS + QUICK STATS ────── */}
        <div className="animate-fadeUp" style={{ animationDelay: '0.1s' }}>
          <div className="light-card p-5">
            <div className="flex items-center gap-5">
              {/* Circular Progress Ring */}
              <div className="relative flex-shrink-0 animate-float" style={{ animationDelay: '0.5s' }}>
                <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                  <circle cx={ringSize/2} cy={ringSize/2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                  <circle cx={ringSize/2} cy={ringSize/2} r={radius} fill="none"
                    stroke="url(#progressGradientLight)" strokeWidth={strokeWidth}
                    strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
                  <defs>
                    <linearGradient id="progressGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-800">{paymentPercent}<span className="text-[10px] text-slate-400">%</span></span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{t('tenant.paidAmount')}</span>
                </div>
              </div>

              {/* Quick stats beside ring */}
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">{t('tenant.totalPaid')}</p>
                  <p className="text-lg font-black text-slate-800 leading-none">{totalPaid.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">{t('common.sar')}</span></p>
                </div>
                <div className="section-divider" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">{t('tenant.remaining')}</p>
                  <p className="text-lg font-black text-slate-800 leading-none">{totalRemaining.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">{t('common.sar')}</span></p>
                </div>
              </div>
            </div>

            {/* Linear progress bar */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('tenant.installmentProgress')}</span>
                <span className="text-[10px] font-black text-emerald-600">{totalPaid.toLocaleString()} / {totalContractValue.toLocaleString()} {t('common.sar')}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 transition-all duration-1000 ease-out" 
                  style={{ width: `${paymentPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ────── STAT CARDS ROW ────── */}
        <div className="grid grid-cols-3 gap-2.5 animate-fadeUp" style={{ animationDelay: '0.15s' }}>
          <div className="light-card p-3 text-center">
            <div className="w-9 h-9 mx-auto rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 mb-2">
              <FileSignature size={16} className="text-indigo-500" />
            </div>
            <p className="text-slate-800 font-black text-lg leading-none">{activeContracts.length}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">{t('common.active')}</p>
          </div>

          <div className="light-card p-3 text-center">
            <div className="w-9 h-9 mx-auto rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100 mb-2">
              <Receipt size={16} className="text-cyan-500" />
            </div>
            <p className="text-slate-800 font-black text-lg leading-none">{payments.length}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">{t('entry.payments')}</p>
          </div>

          <div className="light-card p-3 text-center relative overflow-hidden">
            {daysUntilDue !== null && daysUntilDue <= 7 && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            )}
            <div className="w-9 h-9 mx-auto rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100 mb-2">
              <Clock size={16} className="text-rose-500" />
            </div>
            <p className="text-slate-800 font-black text-sm leading-none">{daysUntilDue !== null ? `${daysUntilDue}d` : '—'}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">{isRTL ? 'الاستحقاق' : 'Due in'}</p>
          </div>
        </div>

        {/* ────── PAYMENT BUTTONS ────── */}
        <div className="grid grid-cols-2 gap-3 animate-fadeUp" style={{ animationDelay: '0.2s' }}>
          <button onClick={handleEjarPayment}
            className="relative rounded-2xl overflow-hidden text-center transition-all active:scale-[0.96] group bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 hover:shadow-lg hover:shadow-emerald-100">
            <div className="relative p-4">
              <div className="w-11 h-11 mx-auto rounded-[14px] flex items-center justify-center mb-2.5 bg-emerald-500 shadow-lg shadow-emerald-200/50">
                <ExternalLink size={20} className="text-white" />
              </div>
              <p className="text-emerald-700 font-extrabold text-[13px] mb-0.5">{t('tenant.payViaEjar')}</p>
              <p className="text-[9px] text-emerald-500 font-medium">{isRTL ? 'منصة إيجار الرسمية' : 'Official Ejar Platform'}</p>
            </div>
          </button>

          <button onClick={handleSadadPayment}
            className="relative rounded-2xl overflow-hidden text-center transition-all active:scale-[0.96] group bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200 hover:shadow-lg hover:shadow-indigo-100">
            <div className="relative p-4">
              <div className="w-11 h-11 mx-auto rounded-[14px] flex items-center justify-center mb-2.5 bg-indigo-500 shadow-lg shadow-indigo-200/50">
                <CreditCard size={20} className="text-white" />
              </div>
              <p className="text-indigo-700 font-extrabold text-[13px] mb-0.5">{isRTL ? 'الدفع عبر سداد' : 'Pay via SADAD'}</p>
              <p className="text-[9px] text-indigo-500 font-medium">{isRTL ? 'نظام سداد للمدفوعات' : 'SADAD Payment System'}</p>
            </div>
          </button>
        </div>

        {/* ────── EJAR AGREEMENT GUIDE ────── */}
        <button onClick={() => { SoundService.play('click'); setShowEjarAgreement(true); }}
          className="w-full rounded-2xl overflow-hidden text-left transition-all active:scale-[0.97] bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:shadow-lg hover:shadow-amber-100 animate-fadeUp" style={{ animationDelay: '0.22s' }}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 bg-amber-500 shadow-lg shadow-amber-200/50">
              <ScrollText size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 font-extrabold text-[13px] mb-0.5">{t('tenant.ejarAgreementTitle')}</p>
              <p className="text-[9px] text-amber-500 font-medium">{t('tenant.ejarAgreementSubtitle')}</p>
            </div>
            <ChevronRight size={16} className="text-amber-400 flex-shrink-0" />
          </div>
        </button>

        {/* ────── TABS ────── */}
        <div className="animate-fadeUp" style={{ animationDelay: '0.25s' }}>
          <div className="flex rounded-2xl p-1.5 bg-slate-100 border border-slate-200">
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); SoundService.play('click'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                    isActive ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════════ OVERVIEW TAB ════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fadeUp">
            {/* My Units with Installment Details */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <h3 className="text-slate-800 font-extrabold text-sm">{isRTL ? 'وحداتي' : 'My Units'}</h3>
                </div>
                <span className="text-[9px] text-slate-400 font-bold">{activeContracts.length} {isRTL ? 'نشط' : 'active'}</span>
              </div>
              {activeContracts.length === 0 ? (
                <div className="light-card p-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                    <Home size={20} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-xs font-medium">{t('tenant.noContracts')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeContracts.map((c, i) => {
                    const info = getContractInstallmentInfo(c);
                    const instPercent = info.installmentCount > 0 ? Math.round((info.currentInstallment / info.installmentCount) * 100) : 0;
                    return (
                      <div key={i} className="light-card light-card-hover overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 border border-indigo-100">
                              <Building2 size={18} className="text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-slate-800 font-bold text-[13px] truncate">{getBuildingName(c.buildingId)}</p>
                                <div className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="text-[8px] font-bold text-emerald-600 uppercase">{t('common.active')}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <MapPin size={10} className="text-slate-300" />
                                <p className="text-slate-400 text-[10px] font-medium">{t('entry.unit')} {c.unitName || c.flatNo || '-'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Installment Progress Section */}
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="bg-amber-50 rounded-xl p-2.5 text-center border border-amber-100">
                                <p className="text-[8px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">{t('tenant.installmentAmount')}</p>
                                <p className="text-amber-700 font-black text-sm">{info.installmentAmt.toLocaleString()}</p>
                                <p className="text-[8px] text-amber-500">{t('common.sar')}</p>
                              </div>
                              <div className="bg-indigo-50 rounded-xl p-2.5 text-center border border-indigo-100">
                                <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">{t('tenant.currentInstallment')}</p>
                                <p className="text-indigo-700 font-black text-sm">{info.currentInstallment} <span className="text-[9px] text-indigo-400 font-medium">{t('tenant.installmentOf')} {info.installmentCount}</span></p>
                              </div>
                              <div className="bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
                                <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">{t('tenant.contractValue')}</p>
                                <p className="text-emerald-700 font-black text-sm">{(c.totalValue || c.rentValue || 0).toLocaleString()}</p>
                                <p className="text-[8px] text-emerald-500">{t('common.sar')}</p>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700" 
                                  style={{ width: `${instPercent}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-indigo-600">{instPercent}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Iqama / ID Document */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-blue-500" />
                  <h3 className="text-slate-800 font-extrabold text-sm">{isRTL ? 'الإقامة / الهوية' : 'Iqama / ID Document'}</h3>
                </div>
              </div>
              {iqamaUrl ? (
                <div className="light-card overflow-hidden">
                  <div className="relative">
                    <img src={iqamaUrl} alt="Iqama" className="w-full h-40 object-cover cursor-pointer" onClick={() => setShowIqamaFull(true)} />
                    <button onClick={() => setShowIqamaFull(true)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur text-white text-[10px] font-bold flex items-center gap-1.5 hover:bg-black/70 transition-colors">
                      <Eye size={12} /> {isRTL ? 'عرض' : 'View'}
                    </button>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-blue-500" />
                      <span className="text-xs font-bold text-slate-600">{isRTL ? 'صورة الإقامة مرفقة' : 'Iqama photo uploaded'}</span>
                    </div>
                    <label className="text-[10px] text-blue-600 font-bold cursor-pointer hover:text-blue-700 flex items-center gap-1">
                      <Upload size={11} /> {isRTL ? 'تغيير' : 'Change'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleIqamaUpload} />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="light-card flex flex-col items-center gap-3 p-6 cursor-pointer hover:bg-slate-50 transition-colors border-2 border-dashed border-slate-200 hover:border-emerald-300 rounded-2xl">
                  {iqamaUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                      <p className="text-xs font-bold text-emerald-600">{isRTL ? 'جاري الرفع...' : 'Uploading...'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
                        <Upload size={22} className="text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-700">{isRTL ? 'ارفع صورة الإقامة / الهوية' : 'Upload Iqama / ID Photo'}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{isRTL ? 'JPG أو PNG — أقل من 5 ميغا' : 'JPG or PNG — Max 5MB'}</p>
                      </div>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleIqamaUpload} disabled={iqamaUploading} />
                </label>
              )}
            </div>

            {/* Recent Payments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <h3 className="text-slate-800 font-extrabold text-sm">{isRTL ? 'آخر المدفوعات' : 'Recent Payments'}</h3>
                </div>
                {payments.length > 5 && (
                  <button onClick={() => setActiveTab('payments')} className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 hover:text-emerald-700 transition-colors">
                    {isRTL ? 'عرض الكل' : 'View All'} <ArrowUpRight size={10} />
                  </button>
                )}
              </div>
              {payments.length === 0 ? (
                <div className="light-card p-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                    <Receipt size={20} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-xs font-medium">{t('tenant.noPayments')}</p>
                </div>
              ) : (
                <div className="light-card overflow-hidden">
                  {payments.slice(0, 5).map((tx, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors ${i < Math.min(payments.length, 5) - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                        <CheckCircle size={15} className="text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 font-bold text-[12px] truncate">{tx.description || tx.details || (isRTL ? 'دفعة إيجار' : 'Rent Payment')}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{tx.date ? fmtDate(tx.date) : ''}</p>
                      </div>
                      <p className="text-emerald-600 font-black text-[13px] flex-shrink-0">+{(tx.amount || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ CONTRACTS TAB ════════════ */}
        {activeTab === 'contracts' && (
          <div className="space-y-3 animate-fadeUp">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-indigo-500" />
                <h3 className="text-slate-800 font-extrabold text-sm">{isRTL ? 'جميع العقود' : 'All Contracts'}</h3>
              </div>
              <span className="text-[9px] text-slate-400 font-bold px-2 py-1 rounded-full bg-slate-100">{contracts.length} {isRTL ? 'عقد' : 'total'}</span>
            </div>
            {contracts.length === 0 ? (
              <div className="light-card p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                  <FileSignature size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">{t('tenant.noContracts')}</p>
              </div>
            ) : (
              contracts.map((c, i) => {
                const isActive = c.status === 'Active';
                const statusColor = isActive ? 'emerald' : c.status === 'Expired' ? 'rose' : 'amber';
                const info = getContractInstallmentInfo(c);
                const instPercent = info.installmentCount > 0 ? Math.round((info.currentInstallment / info.installmentCount) * 100) : 0;
                return (
                  <div key={i} className="light-card light-card-hover overflow-hidden">
                    <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 border border-indigo-100">
                        <Building2 size={18} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 font-bold text-[13px] truncate">{getBuildingName(c.buildingId)}</p>
                        <p className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                          <MapPin size={9} /> {t('entry.unit')} {c.unitName || c.flatNo || '-'}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-${statusColor}-50 border border-${statusColor}-200`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-${statusColor}-400 ${isActive ? 'animate-pulse' : ''}`} />
                        <span className={`text-[9px] font-bold text-${statusColor}-600 uppercase`}>{c.status || 'Active'}</span>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl p-3 bg-slate-50 border border-slate-100">
                          <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">{t('tenant.startDate')}</p>
                          <p className="text-slate-700 font-bold text-[12px]">{c.fromDate ? fmtDate(c.fromDate) : '—'}</p>
                        </div>
                        <div className="rounded-xl p-3 bg-slate-50 border border-slate-100">
                          <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">{t('tenant.endDate')}</p>
                          <p className="text-slate-700 font-bold text-[12px]">{c.toDate ? fmtDate(c.toDate) : '—'}</p>
                        </div>
                        <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
                          <p className="text-amber-600 text-[8px] font-bold uppercase tracking-wider mb-1">{t('tenant.contractValue')}</p>
                          <p className="text-amber-700 font-black text-[13px]">{(c.totalValue || c.rentValue || 0).toLocaleString()} <span className="text-[9px] text-amber-500">{t('common.sar')}</span></p>
                        </div>
                        <div className="rounded-xl p-3 bg-indigo-50 border border-indigo-100">
                          <p className="text-indigo-500 text-[8px] font-bold uppercase tracking-wider mb-1">{t('tenant.installmentAmount')}</p>
                          <p className="text-indigo-700 font-black text-[13px]">{info.installmentAmt.toLocaleString()} <span className="text-[9px] text-indigo-400">{t('common.sar')}</span></p>
                        </div>
                      </div>

                      {/* Installment progress */}
                      <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-indigo-600">{t('tenant.currentInstallment')}: {info.currentInstallment} {t('tenant.installmentOf')} {info.installmentCount}</span>
                          <span className="text-[10px] font-black text-indigo-700">{instPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                            style={{ width: `${instPercent}%` }} />
                        </div>
                      </div>

                      {c.contractNo && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 flex items-center gap-2 border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-medium">{t('tenant.contractNo')}:</span>
                          <span className="text-[10px] text-slate-600 font-bold font-mono">{c.contractNo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════ PAYMENTS TAB ════════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-4 animate-fadeUp">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="light-card p-4 text-center bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                <CircleDollarSign size={18} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-700 font-black text-xl leading-none">{totalPaid.toLocaleString()}</p>
                <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider mt-1.5">{t('tenant.totalPaid')}</p>
              </div>
              <div className="light-card p-4 text-center bg-gradient-to-br from-amber-50 to-white border-amber-100">
                <BadgePercent size={18} className="text-amber-500 mx-auto mb-2" />
                <p className="text-amber-700 font-black text-xl leading-none">{totalRemaining.toLocaleString()}</p>
                <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wider mt-1.5">{t('tenant.remaining')}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <h3 className="text-slate-800 font-extrabold text-sm">{t('tenant.myPayments')}</h3>
              </div>
              {payments.length === 0 ? (
                <div className="light-card p-12 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                    <CreditCard size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">{t('tenant.noPayments')}</p>
                </div>
              ) : (
                <div className="light-card overflow-hidden">
                  {payments.map((tx, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors ${i < payments.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                        <CheckCircle size={16} className="text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 font-bold text-[12px] truncate">{tx.description || tx.details || (isRTL ? 'دفعة إيجار' : 'Rent Payment')}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          {tx.date ? fmtDate(tx.date) : ''}
                          {tx.receiptNo && <><span className="text-slate-200">•</span> <span className="font-mono">#{tx.receiptNo}</span></>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-emerald-600 font-black text-[13px]">+{(tx.amount || 0).toLocaleString()}</p>
                        <p className="text-[8px] text-slate-400 font-medium">{t('common.sar')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────── FOOTER ────── */}
        <div className="text-center pt-6 pb-8">
          <div className="section-divider mb-5" />
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-5 w-5 object-contain opacity-40" />
              <span className="text-[10px] font-bold text-slate-400 tracking-wide">
                {isRTL ? 'مدعوم من' : 'Powered by'}{' '}
                <span className="text-emerald-500 font-extrabold">Amlak</span>{' '}
                <span className="text-slate-500 font-bold">{isRTL ? 'إدارة الأملاك' : 'Property Manager'}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] text-slate-300 uppercase tracking-[0.25em] font-medium">
              <Sparkles size={7} className="text-emerald-300" />
              {isRTL ? 'بوابة المستأجر المميزة' : 'Premium Tenant Portal'}
              <Sparkles size={7} className="text-emerald-300" />
            </div>
          </div>
        </div>
      </div>

      {/* ═════════ EJAR MODAL ═════════ */}
      {showEjarInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowEjarInfo(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" style={{ animation: 'fadeUp 0.2s ease-out' }} />
          <div className="relative w-full max-w-md mx-4 rounded-t-[28px] sm:rounded-[28px] overflow-hidden animate-fadeUp bg-white shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}>
            <div className="relative p-6 text-center">
              <button onClick={() => setShowEjarInfo(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all">
                <X size={14} />
              </button>
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-emerald-500 shadow-lg shadow-emerald-200/50">
                <ExternalLink size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">{t('tenant.payViaEjar')}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">{isRTL ? 'منصة الدفع الرسمية للإيجارات' : 'Official Saudi rental payment platform'}</p>
            </div>

            <div className="section-divider mx-6" />

            <div className="p-6 space-y-4">
              <div className="space-y-2.5">
                {[
                  { step: 1, text: isRTL ? 'افتح تطبيق إيجار أو الموقع' : 'Open Ejar app or website' },
                  { step: 2, text: isRTL ? 'سجل الدخول بحسابك الوطني (أبشر)' : 'Login with Absher account' },
                  { step: 3, text: isRTL ? 'اختر العقد وقم بالدفع' : 'Select contract & pay' },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {item.step}
                    </div>
                    <p className="text-slate-600 text-xs font-semibold">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-emerald-600 text-xs font-mono flex-1 truncate">https://www.ejar.sa</span>
                <button onClick={copyEjarLink}
                  className="px-3 py-1.5 rounded-lg text-emerald-700 text-[10px] font-bold flex items-center gap-1.5 transition-all active:scale-95 bg-emerald-100 border border-emerald-200">
                  {copiedLink ? <><Check size={11} /> {isRTL ? 'تم' : 'Copied'}</> : <><Copy size={11} /> {t('common.copy')}</>}
                </button>
              </div>
            </div>

            <div className="p-6 pt-0 space-y-2">
              <a href="https://www.ejar.sa" target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] text-sm bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200/50">
                {isRTL ? 'فتح إيجار' : 'Open Ejar'} <ExternalLink size={15} />
              </a>
              <button onClick={() => setShowEjarInfo(false)} className="w-full py-2.5 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ SADAD MODAL ═════════ */}
      {showSadadInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowSadadInfo(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" style={{ animation: 'fadeUp 0.2s ease-out' }} />
          <div className="relative w-full max-w-md mx-4 rounded-t-[28px] sm:rounded-[28px] overflow-hidden animate-fadeUp bg-white shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="relative p-6 text-center">
              <button onClick={() => setShowSadadInfo(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all">
                <X size={14} />
              </button>
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-indigo-500 shadow-lg shadow-indigo-200/50">
                <CreditCard size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">{isRTL ? 'الدفع عبر سداد' : 'Pay via SADAD'}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">{isRTL ? 'نظام سداد للمدفوعات' : 'SADAD Payment System'}</p>
            </div>

            <div className="section-divider mx-6" />

            {/* SADAD Steps */}
            <div className="p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3 px-1">{t('tenant.sadadSteps')}</p>
              <div className="space-y-2 mb-4">
                {[
                  { step: 1, text: t('tenant.sadadStep1'), icon: Smartphone },
                  { step: 2, text: t('tenant.sadadStep2'), icon: Wallet },
                  { step: 3, text: t('tenant.sadadStep3'), icon: CreditCard },
                  { step: 4, text: t('tenant.sadadStep4'), icon: FileSignature },
                  { step: 5, text: t('tenant.sadadStep5'), icon: CheckCircle },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs bg-indigo-100 text-indigo-700 border border-indigo-200">
                      {item.step}
                    </div>
                    <p className="text-slate-600 text-xs font-semibold flex-1">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* SADAD Biller Code Highlight */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 p-4 text-center mb-4">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-1">{t('tenant.sadadBillerCode')}</p>
                <p className="text-4xl font-black text-indigo-700 tracking-wider">153</p>
                <p className="text-[10px] text-indigo-400 font-medium mt-1">{isRTL ? 'وزارة الإسكان' : 'Ministry of Housing'}</p>
              </div>

              <div className="section-divider mb-4" />

              {/* Banks Grid */}
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3 px-1">{isRTL ? 'البنوك المدعومة' : 'Supported Banks'}</p>
              <div className="grid grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto">
                {saudiBanks.map((bank, i) => (
                  <button key={i} onClick={() => openBank(bank.app, bank.url)}
                    className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all active:scale-[0.97] group bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: bank.color + '15', border: `1px solid ${bank.color}25` }}>
                      <span className="font-black text-[9px]" style={{ color: bank.color }}>{bank.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 text-[10px] font-bold truncate">{isRTL ? bank.nameAr : bank.name}</p>
                      <p className="text-[8px] text-slate-400 font-medium">{bank.app ? (isRTL ? 'تطبيق' : 'App') : (isRTL ? 'ويب' : 'Web')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Close */}
            <div className="p-5 pt-0">
              <button onClick={() => setShowSadadInfo(false)}
                className="w-full py-3 rounded-xl text-slate-500 text-xs font-bold hover:text-slate-700 transition-colors bg-slate-100 border border-slate-200">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ EJAR AGREEMENT STEPS MODAL ═════════ */}
      {showEjarAgreement && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowEjarAgreement(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" style={{ animation: 'fadeUp 0.2s ease-out' }} />
          <div className="relative w-full max-w-md mx-4 rounded-t-[28px] sm:rounded-[28px] overflow-hidden animate-fadeUp bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="relative p-6 text-center">
              <button onClick={() => setShowEjarAgreement(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all">
                <X size={14} />
              </button>
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-amber-500 shadow-lg shadow-amber-200/50">
                <ScrollText size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">{t('tenant.ejarAgreementTitle')}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">{t('tenant.ejarAgreementSubtitle')}</p>
            </div>

            <div className="section-divider mx-6" />

            {/* Steps */}
            <div className="p-5">
              <div className="space-y-2 mb-4">
                {[
                  { step: 1, text: t('tenant.ejarAgreementStep1'), icon: ExternalLink },
                  { step: 2, text: t('tenant.ejarAgreementStep2'), icon: Shield },
                  { step: 3, text: t('tenant.ejarAgreementStep3'), icon: ScrollText },
                  { step: 4, text: t('tenant.ejarAgreementStep4'), icon: FileSignature },
                  { step: 5, text: t('tenant.ejarAgreementStep5'), icon: Info },
                  { step: 6, text: t('tenant.ejarAgreementStep6'), icon: CheckCircle },
                  { step: 7, text: t('tenant.ejarAgreementStep7'), icon: Check },
                  { step: 8, text: t('tenant.ejarAgreementStep8'), icon: Smartphone },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs bg-amber-100 text-amber-700 border border-amber-200">
                      {item.step}
                    </div>
                    <item.icon size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-slate-600 text-xs font-semibold flex-1">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* Important Note */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-4 mb-3">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-700 text-[11px] font-bold">{t('tenant.ejarAgreementImportant')}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <Info size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-500 text-[10px] font-medium">{t('tenant.ejarAgreementNote')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 space-y-2">
              <a href="https://www.ejar.sa" target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] text-sm bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200/50">
                {t('tenant.openEjar')} <ExternalLink size={15} />
              </a>
              <button onClick={() => setShowEjarAgreement(false)}
                className="w-full py-3 rounded-xl text-slate-500 text-xs font-bold hover:text-slate-700 transition-colors bg-slate-100 border border-slate-200">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ IQAMA FULLSCREEN VIEWER ═════════ */}
      {showIqamaFull && iqamaUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowIqamaFull(false)}>
          <button onClick={() => setShowIqamaFull(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all z-10">
            <X size={20} />
          </button>
          <img src={iqamaUrl} alt="Iqama" className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default TenantDashboard;

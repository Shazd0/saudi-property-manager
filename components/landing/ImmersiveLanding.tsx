import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, CreditCard, Globe, Shield, Smartphone, Users,
  BarChart3, MessageCircle, Zap
} from 'lucide-react';
import logo from '../../images/logo.png';
import './landing-styles.css';
import { useLanguage } from '../../i18n';

/* ─────────────────────────────────────────────
   CONFIG — Faster pacing: 150px per frame
   ───────────────────────────────────────────── */
const TOTAL_FRAMES = 30;
const FRAME_STEP = 8;
const SCROLL_PER_FRAME = 150;
const TOTAL_SCROLL = SCROLL_PER_FRAME * TOTAL_FRAMES; // 4500px

/* ─────────────────────────────────────────────
   TRANSLATIONS
   ───────────────────────────────────────────── */
const i18n = {
  en: {
    hero: 'Property Management\nReimagined.',
    subtitle: 'The all-in-one cloud platform built for Saudi Arabia — from ZATCA compliance to tenant portals.',
    badgeCloud: 'Cloud-Native PWA',
    badgeZatca: 'ZATCA Compliant',
    badgeBilingual: 'Arabic + English',
    f1: 'Financial Powerhouse',
    f1d: 'VAT 15%, ZATCA QR codes, bulk rent entry, fund transfers, and real-time ledger tracking.',
    f2: 'Property & Tenants',
    f2d: 'Buildings, units, occupancy, car registry, contracts with auto-renewal and tenant ID validation.',
    f3: 'Bilingual Engine',
    f3d: 'Full Arabic RTL and English LTR with one-click toggle across every screen and report.',
    f4: 'ZATCA & VAT',
    f4d: 'Automated 15% VAT, credit notes, QR generation, and print-ready compliance reports.',
    f5: 'Mobile PWA',
    f5d: 'Install on any device. Offline-first with background sync — never lose a transaction.',
    f6: 'Staff Chat',
    f6d: 'WhatsApp-style messaging with voice notes, file sharing, polls, and building channels.',
    f7: 'Tenant & Owner Portals',
    f7d: 'Self-service dashboards — SADAD payments for tenants, revenue reports for owners.',
    f8: 'Analytics & Reports',
    f8d: 'KPI dashboards, occupancy rates, collection efficiency — filterable and PDF-exportable.',
    f9: 'Enterprise Security',
    f9d: 'Role-based access, biometric lock, Google Drive backup, and approval workflows.',
    ctaTitle: 'Your Entire Portfolio,\nin One Window.',
    ctaLaunch: 'Get Started',
    ctaWatch: 'Watch Workflow',
    stat1: '5', stat1l: 'User Roles',
    stat2: '15%', stat2l: 'VAT Auto-Calc',
    stat3: '70+', stat3l: 'Features',
    stat4: '24/7', stat4l: 'Offline Ready',
  },
  ar: {
    hero: 'إدارة العقارات\nأُعيد تصورها.',
    subtitle: 'المنصة السحابية المتكاملة المصممة للسعودية — من الامتثال لهيئة الزكاة إلى بوابات المستأجرين.',
    badgeCloud: 'تطبيق سحابي',
    badgeZatca: 'متوافق مع ZATCA',
    badgeBilingual: 'عربي + إنجليزي',
    f1: 'القوة المالية',
    f1d: 'ضريبة 15٪، رموز ZATCA، إدخال إيجارات بالجملة، وتتبع الدفتر المالي.',
    f2: 'العقارات والمستأجرون',
    f2d: 'مباني ووحدات وإشغال وسجل سيارات وعقود بتجديد تلقائي.',
    f3: 'محرك ثنائي اللغة',
    f3d: 'عربي RTL وإنجليزي LTR بنقرة واحدة في كل شاشة وتقرير.',
    f4: 'ZATCA والضريبة',
    f4d: 'حساب ضريبة 15٪ تلقائياً، إشعارات دائنة، ورموز QR جاهزة.',
    f5: 'تطبيق PWA',
    f5d: 'ثبّته على أي جهاز. يعمل بدون إنترنت مع مزامنة تلقائية.',
    f6: 'دردشة الموظفين',
    f6d: 'رسائل بأسلوب واتساب مع صوتيات وملفات واستبيانات.',
    f7: 'بوابات المستأجر والمالك',
    f7d: 'لوحات خدمة ذاتية — سداد للمستأجرين، تقارير إيرادات للملاك.',
    f8: 'التحليلات والتقارير',
    f8d: 'لوحات KPI ومعدلات إشغال وكفاءة تحصيل — قابلة للتصدير.',
    f9: 'أمان مؤسسي',
    f9d: 'صلاحيات لـ 5 أنواع، قفل حيوي، نسخ سحابي، وسير عمل موافقات.',
    ctaTitle: 'محفظتك بالكامل،\nفي نافذة واحدة.',
    ctaLaunch: 'ابدأ الآن',
    ctaWatch: 'شاهد سير العمل',
    stat1: '5', stat1l: 'أدوار مستخدم',
    stat2: '15%', stat2l: 'ضريبة تلقائية',
    stat3: '70+', stat3l: 'ميزة',
    stat4: '24/7', stat4l: 'بدون إنترنت',
  },
};

const FEATURES = [
  { icon: CreditCard, key: 'f1', span: true },
  { icon: Building2, key: 'f2' },
  { icon: Globe, key: 'f3' },
  { icon: Shield, key: 'f4' },
  { icon: Smartphone, key: 'f5' },
  { icon: MessageCircle, key: 'f6' },
  { icon: Users, key: 'f7', span: true },
  { icon: BarChart3, key: 'f8' },
  { icon: Zap, key: 'f9' },
];

/* ─────────────────────────────────────────────
   COMPONENT — Zero re-renders during scroll
   ───────────────────────────────────────────── */
const ImmersiveLanding: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [loadProgress, setLoadProgress] = useState(0);
  const [ready, setReady] = useState(false);

  // All DOM refs — we manipulate these directly, no setState
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featureRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const scrollRef = useRef(0);
  const lerpRef = useRef(0);
  const rafRef = useRef(0);

  const t = useMemo(() => i18n[lang], [lang]);

  /* ── 1) Preload frames ── */
  useEffect(() => {
    let loaded = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      const num = String(i * FRAME_STEP + 1).padStart(3, '0');
      img.src = `/images/ezgif-frame-${num}.jpg`;
      img.onload = () => {
        loaded++;
        setLoadProgress(Math.round((loaded / TOTAL_FRAMES) * 100));
        if (loaded === TOTAL_FRAMES) setTimeout(() => setReady(true), 300);
      };
      img.onerror = () => {
        loaded++;
        setLoadProgress(Math.round((loaded / TOTAL_FRAMES) * 100));
        if (loaded === TOTAL_FRAMES) setReady(true);
      };
      imgs[i] = img;
    }
    imagesRef.current = imgs;
  }, []);

  /* ── 2) Passive scroll listener ── */
  useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── 3) Single RAF loop — ALL animation here, zero React re-renders ── */
  useEffect(() => {
    if (!ready) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    // Set canvas size once, update on resize
    const setSize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    setSize();
    window.addEventListener('resize', setSize);

    let lastFrame = -1;

    const tick = () => {
      // Lerp — fast follow for snappy feel
      lerpRef.current += (scrollRef.current - lerpRef.current) * 0.18;

      const progress = Math.min(Math.max(lerpRef.current / TOTAL_SCROLL, 0), 1);
      const frame = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));

      // ── Canvas: only redraw on frame change ──
      if (frame !== lastFrame && canvas && ctx) {
        const img = imagesRef.current[frame];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        }
        lastFrame = frame;
      }

      // ── Scroll progress bar ──
      if (progressRef.current) {
        progressRef.current.style.height = `${progress * 100}%`;
      }

      // ── Header background ──
      if (headerRef.current) {
        headerRef.current.style.background = scrollRef.current > 50
          ? 'rgba(0,0,0,0.7)' : 'transparent';
      }

      // ── HERO (frames 0-5): fade out + scale up ──
      if (heroRef.current) {
        const heroProgress = Math.min(frame / 5, 1);
        heroRef.current.style.opacity = String(Math.max(0, 1 - heroProgress * 1.2));
        heroRef.current.style.transform = `scale(${1 + heroProgress * 0.15})`;
        heroRef.current.style.pointerEvents = frame <= 5 ? 'auto' : 'none';
      }

      // ── FEATURES (frames 8-24): show/hide + stagger cards ──
      if (featureRef.current) {
        const show = frame >= 8 && frame <= 24;
        featureRef.current.style.opacity = show ? '1' : '0';
        featureRef.current.style.pointerEvents = show ? 'auto' : 'none';
      }
      // Stagger each card
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const trigger = 9 + i;
        if (frame >= trigger) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
        } else {
          el.style.opacity = '0';
          el.style.transform = 'translateY(40px) scale(0.95)';
        }
      });

      // ── CTA (frames 25-30): fade in ──
      if (ctaRef.current) {
        const show = frame >= 25;
        ctaRef.current.style.opacity = show ? '1' : '0';
        ctaRef.current.style.pointerEvents = show ? 'auto' : 'none';
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', setSize);
    };
  }, [ready]);

  return (
    <div
      className="amlak-void"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{ height: TOTAL_SCROLL + window.innerHeight }}
    >
      <canvas ref={canvasRef} className="frame-canvas" />

      {/* ── Header ── */}
      <header ref={headerRef} className="landing-header">
        <div className="logo-mark">
          <img src={logo} alt="Amlak" className="logo-img" />
          <span>Amlak</span>
        </div>
        <div className="lang-pill glass" onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')}>
          <span className={lang === 'en' ? 'active-lang' : ''}>EN</span>
          <span className={lang === 'ar' ? 'active-lang' : ''}>AR</span>
        </div>
      </header>

      {/* ── Scroll Progress ── */}
      <div className="scroll-track">
        <div ref={progressRef} className="scroll-thumb" style={{ height: '0%' }} />
      </div>

      {/* ── HERO ── */}
      <div ref={heroRef} className="hero-section" style={{ willChange: 'transform, opacity' }}>
        <h1 className="hero-title" style={{ whiteSpace: 'pre-line' }}>{t.hero}</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
        <div className="hero-badges">
          <div className="hero-badge glass">{t.badgeCloud}</div>
          <div className="hero-badge glass">{t.badgeZatca}</div>
          <div className="hero-badge glass">{t.badgeBilingual}</div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div ref={featureRef} className="feature-layer" style={{ opacity: 0, willChange: 'opacity' }}>
        <div className="feature-grid">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            const title = t[feat.key as keyof typeof t] as string;
            const desc = t[`${feat.key}d` as keyof typeof t] as string;
            return (
              <div
                key={feat.key}
                ref={el => { cardRefs.current[i] = el; }}
                className={`feature-card glass ${feat.span ? 'span-2' : ''}`}
                style={{
                  opacity: 0,
                  transform: 'translateY(40px) scale(0.95)',
                  willChange: 'transform, opacity',
                  transitionDelay: `${i * 0.06}s`,
                }}
              >
                <div className="card-icon-wrap">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CTA ── */}
      <div ref={ctaRef} className="cta-layer" style={{ opacity: 0, willChange: 'opacity' }}>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">{t.stat1}</span>
            <span className="stat-label">{t.stat1l}</span>
          </div>
          <div className="stat-item">
            <span className="stat-val accent">{t.stat2}</span>
            <span className="stat-label">{t.stat2l}</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">{t.stat3}</span>
            <span className="stat-label">{t.stat3l}</span>
          </div>
          <div className="stat-item">
            <span className="stat-val green">{t.stat4}</span>
            <span className="stat-label">{t.stat4l}</span>
          </div>
        </div>

        <h2 className="cta-title" style={{ whiteSpace: 'pre-line' }}>{t.ctaTitle}</h2>

        <div className="cta-buttons">
          <button className="cta-btn primary" onClick={() => navigate('/')}>
            {t.ctaLaunch}
          </button>
          <button className="cta-btn secondary">{t.ctaWatch}</button>
        </div>

        <div className="tech-badges">
          <span>Firebase Cloud</span>
          <span>React + TypeScript</span>
          <span>PWA Ready</span>
          <span>Vite Turbo</span>
        </div>
      </div>

      {/* ── Loading Screen ── */}
      {!ready && (
        <div className="loading-screen">
          <img src={logo} alt="Amlak" className="loading-logo-img" />
          <div className="loading-text">Amlak</div>
          <div className="loading-bar">
            <div className="loading-bar-fill" style={{ width: `${loadProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImmersiveLanding;

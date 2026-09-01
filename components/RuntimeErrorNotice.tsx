import React, { useEffect, useState } from 'react';
import { Sparkles, Wrench, X } from 'lucide-react';
import { useLanguage } from '../i18n';

const EVENT_NAME = 'amlak:runtime-error-reported';

const RuntimeErrorNotice: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    const onReported = () => {
      setVisible(true);
      setPhase('enter');
      requestAnimationFrame(() => setPhase('visible'));
    };
    window.addEventListener(EVENT_NAME, onReported);
    return () => window.removeEventListener(EVENT_NAME, onReported);
  }, []);

  useEffect(() => {
    if (!visible || phase !== 'visible') return;
    const timer = window.setTimeout(() => setPhase('exit'), 9000);
    return () => window.clearTimeout(timer);
  }, [visible, phase]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[10000] w-[min(92vw,420px)] -translate-x-1/2 pointer-events-auto ${isRTL ? 'text-right' : 'text-left'}`}
      style={{
        opacity: phase === 'visible' ? 1 : 0,
        transform: `translate(-50%, ${phase === 'visible' ? '0' : '16px'})`,
        transition: 'opacity 0.32s ease, transform 0.32s ease',
      }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 p-5 shadow-2xl shadow-violet-900/40 ring-1 ring-white/10">
        <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
        <button
          type="button"
          onClick={() => setPhase('exit')}
          className="absolute top-3 right-3 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/30">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200/90">
              <Sparkles size={12} />
              {t('runtimeError.badge')}
            </div>
            <div className="text-base font-black leading-snug text-white">
              {t('runtimeError.title')}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-violet-100/85">
              {t('runtimeError.body')}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {t('runtimeError.eta')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function notifyRuntimeErrorReported(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export default RuntimeErrorNotice;

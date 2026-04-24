import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Sparkles } from 'lucide-react';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, actionLabel?: string, onAction?: () => void) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return fallback that uses console for components outside provider
    return {
      showToast: (msg: string, type?: ToastType) => console.log(`[${type || 'info'}]`, msg),
      showSuccess: (msg: string) => console.log('[success]', msg),
      showError: (msg: string) => console.error('[error]', msg),
      showWarning: (msg: string) => console.warn('[warning]', msg),
      showInfo: (msg: string) => console.log('[info]', msg),
    };
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { t, isRTL } = useLanguage();


  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000, actionLabel?: string, onAction?: () => void) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Play sound based on toast type
    const soundMap: Record<ToastType, 'success' | 'error' | 'warning' | 'info'> = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    SoundService.play(soundMap[type] || 'info');
    setToasts(prev => [...prev, { id, message, type, duration, actionLabel, onAction }]);
  }, []);

  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const showError = useCallback((message: string) => showToast(message, 'error', 6000), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, 'warning', 5000), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-[420px] w-full sm:w-auto">
      {toasts.map((toast, index) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} index={index} />
      ))}
    </div>
  );
};

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
    glow: 'shadow-emerald-500/25',
    accent: '#10b981',
    bg: 'bg-emerald-950/90',
    ring: 'ring-emerald-500/30',
    progressColor: 'bg-emerald-400',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    gradient: 'from-rose-500 via-rose-600 to-pink-600',
    glow: 'shadow-rose-500/25',
    accent: '#f43f5e',
    bg: 'bg-rose-950/90',
    ring: 'ring-rose-500/30',
    progressColor: 'bg-rose-400',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-amber-500 via-amber-600 to-orange-600',
    glow: 'shadow-amber-500/25',
    accent: '#f59e0b',
    bg: 'bg-amber-950/90',
    ring: 'ring-amber-500/30',
    progressColor: 'bg-amber-400',
    label: 'Warning',
  },
  info: {
    icon: Sparkles,
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
    glow: 'shadow-blue-500/25',
    accent: '#3b82f6',
    bg: 'bg-blue-950/90',
    ring: 'ring-blue-500/30',
    progressColor: 'bg-blue-400',
    label: 'Info',
  },
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void; index: number }> = ({ toast, onRemove, index }) => {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const progressRef = useRef(100);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration || 4000);

  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;
  const duration = toast.duration || 4000;

  // Animate entrance
  useEffect(() => {
    const timer = requestAnimationFrame(() => setPhase('visible'));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Progress bar countdown + auto-dismiss
  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const totalRemaining = remainingRef.current;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const fraction = Math.max(0, 1 - elapsed / totalRemaining);
      progressRef.current = fraction * 100;
      setProgress(progressRef.current);

      if (fraction <= 0) {
        setPhase('exit');
        setTimeout(() => onRemove(toast.id), 400);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPaused, toast.id, onRemove]);

  const handlePause = () => {
    setIsPaused(true);
    remainingRef.current = (progressRef.current / 100) * duration;
    cancelAnimationFrame(rafRef.current);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleClose = () => {
    setPhase('exit');
    cancelAnimationFrame(rafRef.current);
    setTimeout(() => onRemove(toast.id), 400);
  };

  const handleAction = () => {
    if (toast.onAction) toast.onAction();
    handleClose();
  };

  const enterTransform = 'translate3d(120%, 0, 0) scale(0.8)';
  const visibleTransform = 'translate3d(0, 0, 0) scale(1)';
  const exitTransform = 'translate3d(120%, 0, 0) scale(0.85)';

  return (
    <div
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      style={{
        transform: phase === 'enter' ? enterTransform : phase === 'exit' ? exitTransform : visibleTransform,
        opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
        transitionProperty: 'transform, opacity',
        transitionDuration: phase === 'enter' ? '0.5s' : '0.4s',
        transitionTimingFunction: phase === 'enter'
          ? 'cubic-bezier(0.16, 1, 0.3, 1)'
          : 'cubic-bezier(0.55, 0, 1, 0.45)',
        transitionDelay: phase === 'enter' ? `${index * 50}ms` : '0ms',
      }}
      className={`
        pointer-events-auto w-full sm:min-w-[360px] sm:max-w-[420px]
        rounded-2xl overflow-hidden
        backdrop-blur-xl ring-1 ${config.ring}
        shadow-2xl ${config.glow}
      `}
    >
      {/* Top gradient accent line */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${config.gradient}`} />

      {/* Main Content */}
      <div className="relative bg-white/[0.97] dark:bg-slate-900/95 backdrop-blur-2xl">
        <div className="px-4 py-3.5 flex items-start gap-3.5">
          {/* Icon with gradient background */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}
            style={{ boxShadow: `0 4px 14px -2px ${config.accent}44` }}
          >
            <Icon size={20} className="text-white" strokeWidth={2.5} />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: config.accent }}>
                {config.label}
              </span>
            </div>
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug pr-2">
              {toast.message}
            </p>
          </div>

          {/* Action & Close */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {toast.actionLabel && (
              <button
                onClick={handleAction}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${config.accent}15, ${config.accent}25)`,
                  color: config.accent,
                  border: `1px solid ${config.accent}30`,
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-110 active:scale-90 group"
            >
              <X size={14} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800/50">
          <div
            className={`h-full ${config.progressColor} transition-none rounded-r-full`}
            style={{
              width: `${progress}%`,
              opacity: isPaused ? 0.4 : 0.8,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ToastProvider;

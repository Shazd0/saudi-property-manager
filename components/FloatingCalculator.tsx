import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Calculator, GripVertical } from 'lucide-react';

const CALC_WIDTH = 280;
const DRAG_THRESHOLD = 6;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const getSavedPos = (): { x: number; y: number } => {
  try {
    const s = localStorage.getItem('calc_pos');
    if (s) { const p = JSON.parse(s); if (typeof p.x === 'number' && typeof p.y === 'number') return p; }
  } catch {}
  return {
    x: Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 400) - CALC_WIDTH - 80),
    y: Math.max(20, (typeof window !== 'undefined' ? window.innerHeight : 800) / 2 - 200),
  };
};

const getTogglePos = (): { x: number; y: number } => {
  try {
    const s = localStorage.getItem('calc_toggle_pos');
    if (s) { const p = JSON.parse(s); if (typeof p.x === 'number' && typeof p.y === 'number') return p; }
  } catch {}
  return { x: 16, y: (typeof window !== 'undefined' ? window.innerHeight : 800) - 140 };
};

const FloatingCalculator: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [prevResult, setPrevResult] = useState<string | null>(null);
  const [pos, setPos] = useState(getSavedPos);
  const [togglePos, setTogglePos] = useState(getTogglePos);
  const calcRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const origin = useRef({ cx: 0, cy: 0, px: 0, py: 0 });

  // Toggle button dragging
  const isToggleDragging = useRef(false);
  const toggleHasMoved = useRef(false);
  const toggleOrigin = useRef({ cx: 0, cy: 0, px: 0, py: 0 });

  const clampPos = useCallback((x: number, y: number) => ({
    x: clamp(x, 4, window.innerWidth - CALC_WIDTH - 4),
    y: clamp(y, 4, window.innerHeight - 60),
  }), []);

  const clampToggle = useCallback((x: number, y: number) => ({
    x: clamp(x, 4, window.innerWidth - 52),
    y: clamp(y, 4, window.innerHeight - 52),
  }), []);

  useEffect(() => { setPos(p => clampPos(p.x, p.y)); }, [clampPos]);
  useEffect(() => { setTogglePos(p => clampToggle(p.x, p.y)); }, [clampToggle]);

  // Keyboard support
  useEffect(() => {
    if (!open || minimized) return;
    const handleKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || (active as HTMLElement).isContentEditable)) return;

      let val = '';
      if (e.key >= '0' && e.key <= '9') val = e.key;
      else if (e.key === '.') val = '.';
      else if (e.key === '+') val = '+';
      else if (e.key === '-') val = '-';
      else if (e.key === '*') val = '×';
      else if (e.key === '/') { val = '÷'; e.preventDefault(); }
      else if (e.key === '%') val = '%';
      else if (e.key === 'Enter' || e.key === '=') { val = '='; e.preventDefault(); }
      else if (e.key === 'Backspace') val = '⌫';
      else if (e.key === 'Escape') val = 'C';
      else if (e.key === 'Delete') val = 'C';

      if (val) handleInput(val);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, minimized, display, expression]);

  // Calculator panel dragging
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    origin.current = { cx: pos.x, cy: pos.y, px: e.clientX, py: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - origin.current.px;
    const dy = e.clientY - origin.current.py;
    if (!hasMoved.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    hasMoved.current = true;
    const next = clampPos(origin.current.cx + dx, origin.current.cy + dy);
    setPos(next);
  }, [clampPos]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (hasMoved.current) {
      try { localStorage.setItem('calc_pos', JSON.stringify(pos)); } catch {}
    }
  }, [pos]);

  // Toggle button dragging
  const onTogglePointerDown = useCallback((e: React.PointerEvent) => {
    isToggleDragging.current = true;
    toggleHasMoved.current = false;
    toggleOrigin.current = { cx: togglePos.x, cy: togglePos.y, px: e.clientX, py: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [togglePos]);

  const onTogglePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isToggleDragging.current) return;
    const dx = e.clientX - toggleOrigin.current.px;
    const dy = e.clientY - toggleOrigin.current.py;
    if (!toggleHasMoved.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    toggleHasMoved.current = true;
    const next = clampToggle(toggleOrigin.current.cx + dx, toggleOrigin.current.cy + dy);
    setTogglePos(next);
  }, [clampToggle]);

  const onTogglePointerUp = useCallback((e: React.PointerEvent) => {
    isToggleDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (toggleHasMoved.current) {
      try { localStorage.setItem('calc_toggle_pos', JSON.stringify(togglePos)); } catch {}
    } else {
      setOpen(true);
    }
  }, [togglePos]);

  const handleInput = (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setExpression('');
      setPrevResult(null);
      return;
    }
    if (val === '⌫') {
      setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0');
      return;
    }
    if (val === '±') {
      setDisplay(d => d.startsWith('-') ? d.slice(1) : d === '0' ? d : '-' + d);
      return;
    }
    if (val === '%') {
      try { setDisplay(String(parseFloat(display) / 100)); } catch {}
      return;
    }
    if (val === '=') {
      try {
        const expr = expression + display;
        const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
        const result = Function('"use strict"; return (' + sanitized + ')')();
        const formatted = Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : 'Error';
        setPrevResult(expr + ' =');
        setDisplay(formatted);
        setExpression('');
      } catch {
        setDisplay('Error');
        setExpression('');
      }
      return;
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      setExpression(e => e + display + ' ' + val + ' ');
      setDisplay('0');
      setPrevResult(null);
      return;
    }
    if (val === '.') {
      if (!display.includes('.')) setDisplay(d => d + '.');
      return;
    }
    setDisplay(d => d === '0' ? val : d + val);
    setPrevResult(null);
  };

  const buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '='],
  ];

  const getButtonStyle = (btn: string) => {
    if (btn === '=') return 'bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black text-xl shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-green-700 active:scale-90';
    if (['+', '-', '×', '÷'].includes(btn)) return 'bg-emerald-50 text-emerald-700 font-bold text-lg border border-emerald-200 hover:bg-emerald-100 active:scale-90';
    if (btn === 'C') return 'bg-rose-50 text-rose-600 font-bold border border-rose-200 hover:bg-rose-100 active:scale-90';
    if (btn === '⌫') return 'bg-slate-50 text-slate-600 font-bold border border-slate-200 hover:bg-slate-100 active:scale-90';
    if (btn === '%' || btn === '±') return 'bg-slate-50 text-slate-600 font-bold border border-slate-200 hover:bg-slate-100 active:scale-90';
    return 'bg-white text-slate-800 font-semibold text-lg border border-slate-200 hover:bg-slate-50 hover:border-emerald-200 active:scale-90 shadow-sm';
  };

  if (!open) {
    return (
      <div
        className="fixed z-[9998] w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-300/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 cursor-grab active:cursor-grabbing"
        style={{ left: togglePos.x, top: togglePos.y, touchAction: 'none' }}
        title="Calculator"
        onPointerDown={onTogglePointerDown}
        onPointerMove={onTogglePointerMove}
        onPointerUp={onTogglePointerUp}
      >
        <Calculator size={22} />
      </div>
    );
  }

  return (
    <div
      ref={calcRef}
      className="fixed z-[9999] select-none"
      style={{ left: pos.x, top: pos.y, width: minimized ? 200 : CALC_WIDTH, touchAction: 'none' }}
    >
      <div className={`rounded-3xl overflow-visible shadow-2xl shadow-emerald-200/40 border border-emerald-200 transition-all duration-300 bg-white ${minimized ? 'h-12' : ''}`}>
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-t-3xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-white/70" />
            <Calculator size={15} className="text-white" />
            <span className="text-xs font-bold text-white tracking-wide">Calculator</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
              className="w-7 h-7 rounded-lg bg-white flex items-center justify-center hover:bg-yellow-100 transition-colors border border-slate-200"
              title="Minimize"
            >
              <span className="text-base font-black text-slate-700 leading-none">−</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="w-7 h-7 rounded-lg bg-white flex items-center justify-center hover:bg-rose-100 transition-colors border border-slate-200"
              title="Close"
            >
              <span className="text-base font-black text-rose-600 leading-none">✕</span>
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="p-3 space-y-3 bg-gradient-to-b from-emerald-50/50 to-white rounded-b-3xl">
            {/* Display */}
            <div className="rounded-2xl bg-white p-4 border border-emerald-100 shadow-inner" style={{ boxShadow: 'inset 0 2px 6px rgba(16,185,129,0.06)' }}>
              {prevResult && (
                <div className="text-[11px] text-slate-400 font-mono truncate mb-1">{prevResult}</div>
              )}
              {expression && (
                <div className="text-xs text-emerald-500 font-mono truncate">{expression}</div>
              )}
              <div className="text-right text-3xl font-black text-emerald-700 font-mono tracking-tight truncate">{display}</div>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-4 gap-2">
              {buttons.flat().map((btn, i) => (
                <button
                  key={i}
                  onClick={() => handleInput(btn)}
                  className={`h-12 rounded-xl transition-all duration-100 ${getButtonStyle(btn)}`}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Keyboard hint */}
            <div className="text-center text-[9px] text-emerald-500/60 font-medium tracking-wide">Use keyboard to type</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingCalculator;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Mic, MessageCircle, AlertCircle, X, Layers, GripVertical } from 'lucide-react';
import VoiceAssistant from './VoiceAssistant';
import AIAssistant from './AIAssistant';
import ChatBubble from './ChatBubble';
import ReportBugModalRedesign from './ReportBugModalRedesign';
import HapticService from '../services/hapticService';
import SoundService from '../services/soundService';

interface FloatingToolsDockProps {
  user: any;
}

type ToolId = 'voice' | 'ai' | 'chat' | 'bug' | null;

const DOCK_SIZE = 56;
const DRAG_THRESHOLD = 6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const getDefaultPos = () => ({
  x: Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 420) - DOCK_SIZE - 20),
  y: Math.max(0, (typeof window !== 'undefined' ? window.innerHeight : 800) - DOCK_SIZE - 84),
});

const getSavedPos = (): { x: number; y: number } => {
  try {
    const s = localStorage.getItem('ftd_pos');
    if (s) {
      const p = JSON.parse(s);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch {}
  return getDefaultPos();
};

const TOOLS = [
  { id: 'voice' as const, icon: Mic,          label: 'Voice',  gradient: 'from-emerald-500 to-teal-600',   glow: 'rgba(16,185,129,0.45)',  ring: '#10b981' },
  { id: 'ai'    as const, icon: Bot,          label: 'AI',     gradient: 'from-indigo-500 to-purple-600',  glow: 'rgba(99,102,241,0.45)',  ring: '#6366f1' },
  { id: 'chat'  as const, icon: MessageCircle,label: 'Chat',   gradient: 'from-green-500 to-emerald-600',  glow: 'rgba(37,211,102,0.45)',  ring: '#25D366' },
  { id: 'bug'   as const, icon: AlertCircle,  label: 'Report', gradient: 'from-rose-500 to-pink-600',      glow: 'rgba(244,63,94,0.45)',   ring: '#f43f5e' },
];

const FloatingToolsDock: React.FC<FloatingToolsDockProps> = ({ user }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<ToolId>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(getSavedPos);

  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const origin = useRef({ cx: 0, cy: 0, px: 0, py: 0 });

  const clampPos = useCallback((x: number, y: number) => ({
    x: clamp(x, 4, window.innerWidth  - DOCK_SIZE - 4),
    y: clamp(y, 4, window.innerHeight - DOCK_SIZE - 4),
  }), []);

  // On mount: clamp saved position to current window size (fixes off-screen drift)
  useEffect(() => {
    setPos(p => clampPos(p.x, p.y));
  }, [clampPos]);

  // Persist position
  useEffect(() => {
    try { localStorage.setItem('ftd_pos', JSON.stringify(pos)); } catch {}
  }, [pos]);

  // Global pointer move/up listeners
  // NOTE: touchmove with { passive: false } is only registered during an active drag
  // so it never blocks natural page scrolling at rest.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - origin.current.cx;
      const dy = e.clientY - origin.current.cy;
      if (!hasMoved.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasMoved.current = true;
        HapticService.light();
      }
      if (hasMoved.current) setPos(clampPos(origin.current.px + dx, origin.current.py + dy));
    };
    const onMouseUp = () => { isDragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [clampPos]);

  const startDrag = (cx: number, cy: number) => {
    isDragging.current = true;
    hasMoved.current = false;
    origin.current = { cx, cy, px: pos.x, py: pos.y };
  };

  // Touch move/end handlers — attached to window only during a drag so they never
  // block natural page scrolling when the user isn't dragging the dock.
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);

    const onTouchMove = (ev: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - origin.current.cx;
      const dy = touch.clientY - origin.current.cy;
      if (!hasMoved.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasMoved.current = true;
        HapticService.light();
      }
      if (hasMoved.current) {
        ev.preventDefault();
        setPos(clampPos(origin.current.px + dx, origin.current.py + dy));
      }
    };
    const onTouchEnd = () => {
      isDragging.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { once: true });
  };

  const handleFabClick = () => {
    if (hasMoved.current) return;
    if (active) {
      HapticService.light();
      setActive(null);
      setMenuOpen(false);
    } else {
      HapticService.medium();
      SoundService.play('open');
      setMenuOpen(o => !o);
    }
  };

  const handleToolClick = (id: ToolId) => {
    HapticService.medium();
    SoundService.play('nav');
    setActive(id);
    setMenuOpen(false);
  };

  const handleClose = () => {
    HapticService.light();
    setActive(null);
  };

  const activeTool = TOOLS.find(t => t.id === active);

  // Fan goes upward when dock is in bottom half, downward when in top half
  const fanGoesUp = pos.y > window.innerHeight * 0.45;
  const toolList = fanGoesUp ? [...TOOLS] : [...TOOLS].reverse();

  return (
    <>
      {active === 'voice' && <VoiceAssistant user={user} defaultShowPanel hideTrigger onClose={handleClose} />}
      {active === 'ai'    && <AIAssistant currentUser={user} defaultOpen hideTrigger onClose={handleClose} />}
      {active === 'chat'  && <ChatBubble  currentUser={user} defaultOpen hideTrigger onClose={handleClose} />}
      {active === 'bug'   && <ReportBugModalRedesign onClose={handleClose} />}

      {/* Draggable dock container */}
      <div
        className="fixed z-[200]"
        style={{
          left: pos.x,
          top: pos.y,
          width: DOCK_SIZE,
          height: DOCK_SIZE,
          touchAction: 'none',
        }}
      >
        {/* Fan menu — floats above or below the FAB */}
        <div
          style={{
            position: 'absolute',
            [fanGoesUp ? 'bottom' : 'top']: DOCK_SIZE + 8,
            right: 0,
            display: 'flex',
            flexDirection: fanGoesUp ? 'column' : 'column-reverse',
            alignItems: 'flex-end',
            gap: '10px',
            opacity: menuOpen ? 1 : 0,
            pointerEvents: menuOpen ? 'auto' : 'none',
            transition: 'opacity 0.16s ease',
          }}
        >
          {toolList.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  transition: `opacity 0.18s ease ${i * 45}ms, transform 0.22s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'translateX(0)' : 'translateX(14px)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#fff',
                    padding: '3px 10px',
                    borderRadius: '99px',
                    background: 'rgba(15,23,42,0.78)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    userSelect: 'none',
                  }}
                >
                  {tool.label}
                </span>
                <button
                  onClick={() => handleToolClick(tool.id)}
                  title={tool.label}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${tool.gradient} active:scale-90 transition-transform`}
                  style={{ boxShadow: `0 6px 20px ${tool.glow}`, flexShrink: 0 }}
                >
                  <Icon size={20} />
                </button>
              </div>
            );
          })}
        </div>

        {/* FAB — drag handle + action trigger */}
        <div
          onMouseDown={e => { startDrag(e.clientX, e.clientY); e.preventDefault(); }}
          onTouchStart={handleTouchStart}
          onClick={handleFabClick}
          role="button"
          tabIndex={0}
          title={active ? 'Close tool' : menuOpen ? 'Close menu' : 'Open tools (drag to move)'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: isDragging.current ? 'grabbing' : 'grab',
            userSelect: 'none',
            position: 'relative',
            background: active
              ? `linear-gradient(135deg, ${activeTool?.ring ?? '#10b981'}, ${activeTool?.ring ?? '#10b981'}99)`
              : 'linear-gradient(135deg, #059669, #047857)',
            boxShadow: active
              ? `0 8px 32px ${activeTool?.glow ?? 'rgba(16,185,129,0.45)'}`
              : '0 8px 28px rgba(5,150,105,0.45)',
            transition: 'background 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {/* Drag grip indicator */}
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: 0.35,
              display: 'flex',
            }}
          >
            <GripVertical size={12} strokeWidth={3} />
          </span>

          {/* Main icon */}
          <span style={{ transition: 'transform 0.3s ease', transform: menuOpen || active ? 'rotate(45deg)' : 'none' }}>
            {active && activeTool
              ? <activeTool.icon size={24} />
              : menuOpen ? <X size={24} /> : <Layers size={24} />
            }
          </span>

          {/* Pulse ring */}
          {!menuOpen && !active && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '16px',
                background: 'radial-gradient(circle, #10b981, transparent)',
                opacity: 0.3,
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
          )}

          {/* Active indicator dot */}
          {active && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '2px solid white',
                background: activeTool?.ring ?? '#10b981',
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default FloatingToolsDock;


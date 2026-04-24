import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, X, Maximize2, Minus, GripHorizontal } from 'lucide-react';
import { listenChatRooms } from '../services/chatService';
import StaffChat from './StaffChat';
import { useLanguage } from '../i18n';

interface ChatBubbleProps {
  currentUser: any;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  onClose?: () => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ currentUser, defaultOpen, hideTrigger, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useLanguage();

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [totalUnread, setTotalUnread] = useState(0);

  // Drag state for mini window
  const [windowPos, setWindowPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const userId = currentUser.id || currentUser.uid || 'unknown';
  const isOnChat = location.pathname === '/chat';

  // Listen for unread count
  useEffect(() => {
    const unsub = listenChatRooms(userId, (roomsList) => {
      const count = roomsList.reduce((sum, room) => {
        return sum + ((room as any).unreadCounts?.[userId] || 0);
      }, 0);
      setTotalUnread(count);
    });
    return () => unsub();
  }, [userId]);

  // Close mini chat when navigating to full chat page
  useEffect(() => {
    if (isOnChat) setOpen(false);
  }, [isOnChat]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: clientX, startY: clientY, origX: rect.left, origY: rect.top };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.origY + dy));
      setWindowPos({ x: newX, y: newY });
    };
    const handleEnd = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, []);

  // Don't render on chat page
  if (isOnChat) return null;

  // Default position
  const defaultPos = { x: 16, y: window.innerHeight - 640 };
  const pos = windowPos || defaultPos;

  // On mobile, open chat in full screen mode
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      {/* Floating mini chat window */}
      {open && (
        <div
          ref={windowRef}
          className={`fixed z-[95] overflow-hidden flex flex-col ${
            isMobile 
              ? 'inset-0 rounded-none' 
              : 'rounded-2xl'
          }`}
          style={isMobile ? {
            animation: 'chatMiniWindowOpen 0.3s cubic-bezier(0.22,1,0.36,1) both',
          } : {
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(580px, calc(100vh - 100px))',
            animation: windowPos ? 'none' : 'chatMiniWindowOpen 0.35s cubic-bezier(0.22,1,0.36,1) both',
            boxShadow: '0 12px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {/* Premium Draggable Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0 select-none relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #075E54, #128C7E, #00A884, #25D366)', cursor: isMobile ? 'default' : 'grab' }}
            onMouseDown={isMobile ? undefined : handleDragStart}
            onTouchStart={isMobile ? undefined : handleDragStart}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)', animation: 'chatHeaderShine 4s ease-in-out infinite' }} />
            <span className="font-bold text-[14px] flex items-center gap-2.5 pointer-events-none relative z-10">
              {!isMobile && <GripHorizontal size={14} className="opacity-60" />}
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                <MessageCircle size={14} />
              </div>{t('nav.staffChat')}</span>
            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={() => { setOpen(false); navigate('/chat'); }}
                className="p-2 hover:bg-white/20 active:bg-white/30 rounded-xl transition-all"
                title="Full Screen"
              >
                <Maximize2 size={15} />
              </button>
              <button
                onClick={() => { setOpen(false); onClose?.(); }}
                className="p-2 hover:bg-white/20 active:bg-white/30 rounded-xl transition-all"
                title={t('common.close')}
              >
                {isMobile ? <X size={18} /> : <Minus size={15} />}
              </button>
            </div>
          </div>
          {/* Embedded StaffChat */}
          <div className="flex-1 overflow-hidden bg-white">
            <StaffChat currentUser={currentUser} embedded />
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      {/* Premium Floating Bubble */}
      {!hideTrigger && (
        <button
          onClick={() => setOpen(!open)}
          className="fixed bottom-20 md:bottom-6 left-4 z-[90] group h-[58px] w-[58px] rounded-2xl text-white flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ 
            background: 'linear-gradient(135deg, #25D366, #00A884, #128C7E)',
            boxShadow: '0 8px 32px rgba(37,211,102,0.35), 0 2px 8px rgba(0,0,0,0.1)',
            animation: 'chatBubblePop 0.5s cubic-bezier(0.22,1,0.36,1) both'
          }}
        >
          {open ? (
            <X size={24} className="transition-transform duration-200" />
          ) : (
            <MessageCircle size={24} className="transition-transform duration-200 group-hover:scale-110" />
          )}
          {!open && totalUnread > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[24px] h-[24px] px-1.5 text-white text-[11px] font-extrabold rounded-full flex items-center justify-center border-[2.5px] border-white"
              style={{ 
                background: 'linear-gradient(135deg, #FF3B30, #FF2D55)',
                boxShadow: '0 4px 12px rgba(255,59,48,0.4)',
                animation: 'chatBadgePop 0.4s cubic-bezier(0.22,1,0.36,1) both 0.3s' 
              }}
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
          {!open && totalUnread > 0 && (
            <span className="absolute inset-0 rounded-2xl bg-emerald-400 animate-ping opacity-15" />
          )}
        </button>
      )}
    </>
  );
};

export default ChatBubble;

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MonitorUp, PhoneOff, X } from 'lucide-react';
import { User, UserRole } from '../types';
import html2canvas from './html2canvasLoader';
import {
  addRemoteSupportCandidate,
  createRemoteSupportPeer,
  endRemoteSupportSession,
  listenIncomingRemoteSupport,
  listenRemoteSupportCandidates,
  listenRemoteSupportCommands,
  listenRemoteSupportSession,
  RemoteSupportCommand,
  RemoteSupportSession,
  updateRemoteSupportSession,
} from '../services/remoteSupportService';

interface RemoteSupportListenerProps {
  currentUser: User;
}

const isTextInput = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement => {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
};

const insertText = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
  const next = start + text.length;
  el.setSelectionRange(next, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const applyKeyboardCommand = (command: Extract<RemoteSupportCommand, { type: 'keydown' }>) => {
  const active = document.activeElement;
  const keyboardEvent = new KeyboardEvent('keydown', {
    key: command.key,
    code: command.code,
    ctrlKey: command.ctrlKey,
    metaKey: command.metaKey,
    altKey: command.altKey,
    shiftKey: command.shiftKey,
    bubbles: true,
    cancelable: true,
  });
  active?.dispatchEvent(keyboardEvent);

  if (!isTextInput(active) || command.ctrlKey || command.metaKey || command.altKey) return;

  if (command.key.length === 1) {
    insertText(active, command.key);
    return;
  }

  if (command.key === 'Backspace') {
    const start = active.selectionStart ?? active.value.length;
    const end = active.selectionEnd ?? active.value.length;
    if (start !== end) {
      active.value = `${active.value.slice(0, start)}${active.value.slice(end)}`;
      active.setSelectionRange(start, start);
    } else if (start > 0) {
      active.value = `${active.value.slice(0, start - 1)}${active.value.slice(end)}`;
      active.setSelectionRange(start - 1, start - 1);
    }
    active.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (command.key === 'Enter') insertText(active, '\n');
};

const applyRemoteCommand = (command: RemoteSupportCommand) => {
  if (command.type === 'click' || command.type === 'dblclick') {
    const x = Math.max(0, Math.min(window.innerWidth - 1, command.xRatio * window.innerWidth));
    const y = Math.max(0, Math.min(window.innerHeight - 1, command.yRatio * window.innerHeight));
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!target || target.closest('[data-remote-support-overlay="true"]')) return;

    target.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
    target.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
    target.focus?.();
    target.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
    target.click?.();
    if (command.type === 'dblclick') {
      target.dispatchEvent(new MouseEvent('dblclick', { clientX: x, clientY: y, bubbles: true }));
    }
    return;
  }

  if (command.type === 'scroll') {
    window.scrollBy({ left: command.deltaX, top: command.deltaY, behavior: 'smooth' });
    return;
  }

  applyKeyboardCommand(command);
};

const RemoteSupportListener: React.FC<RemoteSupportListenerProps> = ({ currentUser }) => {
  const [incoming, setIncoming] = useState<RemoteSupportSession | null>(null);
  const [activeSession, setActiveSession] = useState<RemoteSupportSession | null>(null);
  const [error, setError] = useState('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const appCaptureTimerRef = useRef<number | null>(null);
  const appCaptureStoppedRef = useRef(false);
  const commandStartedAtRef = useRef(0);

  const userId = currentUser.id || (currentUser as any).uid;
  const isAdmin = currentUser.role === UserRole.ADMIN || (currentUser as any).role === 'MANAGER';

  useEffect(() => {
    if (!userId || isAdmin) return;
    return listenIncomingRemoteSupport(userId, sessions => {
      const active = sessions.find(s => ['sharing', 'control-requested', 'active-control'].includes(s.status));
      const request = sessions.find(s => s.status === 'requested');
      setActiveSession(active || null);
      setIncoming(active ? null : request || null);
    });
  }, [isAdmin, userId]);

  useEffect(() => {
    if (!activeSession?.id) return;
    return listenRemoteSupportSession(activeSession.id, session => {
      if (!session || ['ended', 'declined', 'failed'].includes(session.status)) {
        stopLocalSession(false);
        return;
      }
      setActiveSession(session);
      if (pcRef.current && session.answer && !pcRef.current.currentRemoteDescription) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(session.answer)).catch(() => {});
      }
    });
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession?.id || !activeSession.controlEnabled) return;
    commandStartedAtRef.current = Date.now();
    return listenRemoteSupportCommands(activeSession.id, command => {
      if (command.at < commandStartedAtRef.current) return;
      applyRemoteCommand(command);
    });
  }, [activeSession?.id, activeSession?.controlEnabled]);

  const stopLocalSession = async (notify = true) => {
    if (appCaptureTimerRef.current) {
      window.clearTimeout(appCaptureTimerRef.current);
      appCaptureTimerRef.current = null;
    }
    appCaptureStoppedRef.current = true;
    streamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    streamRef.current = null;
    pcRef.current = null;
    const sessionId = activeSession?.id;
    setActiveSession(null);
    setIncoming(null);
    if (notify && sessionId) await endRemoteSupportSession(sessionId).catch(() => {});
  };

  const startAppViewCapture = async (): Promise<MediaStream> => {
    const streamCanvas = document.createElement('canvas');
    const ctx = streamCanvas.getContext('2d');
    if (!ctx || typeof streamCanvas.captureStream !== 'function') {
      throw new Error('This browser does not support mobile app-view sharing.');
    }
    appCaptureStoppedRef.current = false;

    const renderFrame = async () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(320, window.innerWidth);
      const height = Math.max(480, window.innerHeight);
      streamCanvas.width = Math.floor(width * scale);
      streamCanvas.height = Math.floor(height * scale);

      const frame = await html2canvas(document.body, {
        backgroundColor: null,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        scale,
        ignoreElements: element => element.hasAttribute('data-remote-support-overlay'),
      });

      ctx.clearRect(0, 0, streamCanvas.width, streamCanvas.height);
      ctx.drawImage(frame, 0, 0, streamCanvas.width, streamCanvas.height);
    };

    const loop = async () => {
      if (appCaptureStoppedRef.current) return;
      try {
        await renderFrame();
      } catch {
        // Keep the stream alive; the next frame may succeed after the UI settles.
      }
      if (!appCaptureStoppedRef.current) appCaptureTimerRef.current = window.setTimeout(loop, 650);
    };

    await renderFrame();
    const stream = streamCanvas.captureStream(6);
    stream.getVideoTracks().forEach(track => {
      track.addEventListener('ended', () => {
        appCaptureStoppedRef.current = true;
        if (appCaptureTimerRef.current) window.clearTimeout(appCaptureTimerRef.current);
      });
    });
    loop();
    return stream;
  };

  const startShareStream = async (): Promise<MediaStream> => {
    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        return await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 20 },
          audio: false,
        });
      } catch {
        // Phones/tablets often expose getDisplayMedia but still block it.
        return startAppViewCapture();
      }
    }

    return startAppViewCapture();
  };

  const acceptSharing = async (session: RemoteSupportSession) => {
    setError('');
    try {
      const stream = await startShareStream();
      streamRef.current = stream;

      const pc = createRemoteSupportPeer();
      pcRef.current = pc;
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => stopLocalSession(true));
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = event => {
        if (event.candidate) {
          addRemoteSupportCandidate(session.id, 'staff', event.candidate.toJSON()).catch(() => {});
        }
      };

      const unsubscribeCandidates = listenRemoteSupportCandidates(session.id, 'admin', candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateRemoteSupportSession(session.id, {
        status: 'active-control',
        controlEnabled: true,
        offer,
        staffScreen: { width: window.innerWidth, height: window.innerHeight },
      });
      setActiveSession({ ...session, status: 'active-control', controlEnabled: true, offer });
      setIncoming(null);

      pc.addEventListener('connectionstatechange', () => {
        if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) unsubscribeCandidates();
      });
    } catch (e: any) {
      setError(e?.message || 'Could not start screen sharing.');
      await updateRemoteSupportSession(session.id, { status: 'failed' }).catch(() => {});
    }
  };

  const declineSharing = async (session: RemoteSupportSession) => {
    await updateRemoteSupportSession(session.id, { status: 'declined', controlEnabled: false });
    setIncoming(null);
  };

  if (isAdmin) return null;

  return (
    <>
      {incoming && (
        <div data-remote-support-overlay="true" className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-emerald-200 dark:border-emerald-800 p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 grid place-items-center">
                <MonitorUp size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Admin wants remote support access</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {incoming.adminName} is requesting a remote support session. When you approve, the admin can see your shared screen and use mouse/keyboard control.
                </p>
                <div className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 p-3 text-xs font-semibold flex gap-2">
                  <AlertTriangle size={16} />
                  <span>Only approve this if you trust the admin and are ready for them to see and control the shared app.</span>
                </div>
              </div>
              <button type="button" onClick={() => declineSharing(incoming)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => declineSharing(incoming)} className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                Decline
              </button>
              <button type="button" onClick={() => acceptSharing(incoming)} className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-600/20">
                Share & Allow Control
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSession && (
        <button
          data-remote-support-overlay="true"
          type="button"
          onClick={() => stopLocalSession(true)}
          className="fixed bottom-4 right-4 z-[10000] rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/30 p-3"
          title={`Stop remote support with ${activeSession.adminName}`}
          aria-label="Stop remote support"
        >
          <PhoneOff size={20} />
        </button>
      )}
    </>
  );
};

export default RemoteSupportListener;

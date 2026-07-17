import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Users,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../i18n';
import {
  CallType,
  VoiceCallSession,
  connectCallSignaling,
  createCallPeer,
  createVoiceCallSession,
  disconnectCallSignaling,
  endVoiceCallSession,
  fetchVoiceCallSession,
  getMediaStream,
  isMacCallBackend,
  listenCallSignals,
  listenIncomingVoiceCalls,
  listenVoiceCallSession,
  sendCallSignal,
  updateCallParticipant,
  updateVoiceCallSession,
} from '../services/voiceCallService';
import { recordSessionCallHistory } from '../services/callHistoryService';
import { registerMacCallBackgroundWatch, getMacApiConfig } from '../services/macSignalingClient';
import { setCallPresence, clearCallPresence } from '../services/callPresenceService';

const stopSwCallRing = (sessionId?: string) => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'STOP_CALL_RING', sessionId });
  }).catch(() => {});
};

const parseSessionFromPush = (data: any): VoiceCallSession | null => {
  if (!data) return null;
  try {
    if (data.sessionJson) return JSON.parse(data.sessionJson);
  } catch { /* fall through */ }
  if (data.id && data.callerId) return data as VoiceCallSession;
  if (data.sessionId) {
    return {
      id: data.sessionId,
      callType: data.callType === 'video' ? 'video' : 'audio',
      callerId: data.callerId || '',
      callerName: data.callerName || 'Someone',
      calleeIds: [],
      participants: {},
      status: 'ringing',
    } as VoiceCallSession;
  }
  return null;
};

const getCallDeepLinkParams = () => {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return { ringId: null as string | null, action: null as string | null };
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return {
    ringId: params.get('ring'),
    action: params.get('action'),
  };
};

const clearCallDeepLink = () => {
  const hash = window.location.hash || '';
  const base = hash.split('?')[0] || '#/calls';
  if (hash !== base) window.location.hash = base;
};

export interface StartCallParams {
  type: CallType;
  targetUserIds: string[];
  targetNames: Record<string, string>;
  roomId?: string;
  roomName?: string;
}

interface VoiceCallContextValue {
  startCall: (params: StartCallParams) => Promise<void>;
  isInCall: boolean;
}

const VoiceCallContext = createContext<VoiceCallContextValue>({
  startCall: async () => {},
  isInCall: false,
});

export const useVoiceCall = () => useContext(VoiceCallContext);

interface VoiceCallManagerProps {
  currentUser: User;
  children?: React.ReactNode;
}

type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'connecting' | 'ended';
type ConnectionIssue = 'none' | 'no-answer' | 'no-signal' | 'unavailable';

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const CallActionBtn: React.FC<{
  icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  color: 'red' | 'green' | 'glass';
  size?: 'md' | 'lg';
  onClick: () => void;
}> = ({ icon: Icon, label, color, size = 'md', onClick }) => {
  const dim = size === 'lg' ? 'w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20' : 'w-14 h-14 sm:w-16 sm:h-16';
  const iconSize = size === 'lg' ? 30 : 22;
  const bg = {
    red: 'bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-500/40',
    green: 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-600/40',
    glass: 'bg-white/15 backdrop-blur-md hover:bg-white/25 border border-white/10',
  }[color];
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
      <div className={`${dim} rounded-full flex items-center justify-center text-white ${bg}`}>
        <Icon size={iconSize} strokeWidth={2} />
      </div>
      <span className="text-[10px] sm:text-xs font-semibold text-white/70">{label}</span>
    </button>
  );
};

const VoiceCallManager: React.FC<VoiceCallManagerProps> = ({ currentUser, children }) => {
  const { t } = useLanguage();
  const userId = currentUser.id || (currentUser as any).uid;
  const userName = currentUser.name || 'User';

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [session, setSession] = useState<VoiceCallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<VoiceCallSession | null>(null);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [connectionIssue, setConnectionIssue] = useState<ConnectionIssue>('none');
  const [peerStatus, setPeerStatus] = useState<'ringing' | 'connecting' | 'connected' | 'offline'>('ringing');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const sessionRef = useRef<VoiceCallSession | null>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const signalStartedAtRef = useRef(0);
  const isCallerRef = useRef(false);
  const busyRef = useRef(false);
  const offerStartedRef = useRef(false);
  const callStartTimeRef = useRef<number>(0);
  const lastCallStatusRef = useRef<string>('ended');
  const durationRef = useRef(0);
  const historyRecordedRef = useRef(false);

  sessionRef.current = session;

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const recordCallHistory = useCallback(async (
    sess: VoiceCallSession | null,
    status: string,
    dur: number,
  ) => {
    if (!sess?.id || historyRecordedRef.current) return;
    const calleeId = sess.calleeIds[0] || '';
    if (!calleeId || !sess.callerId) return;

    historyRecordedRef.current = true;
    const calleeName = sess.participants[calleeId]?.userName || calleeId;
    await recordSessionCallHistory({
      sessionId: sess.id,
      callType: sess.callType,
      callerId: sess.callerId,
      callerName: sess.callerName,
      calleeId,
      calleeName,
      status,
      duration: dur,
      localUserId: userId,
    }).catch(() => {});
  }, [userId]);

  const playRingtone = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);

      let stopped = false;
      const playPulse = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 440;
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        setTimeout(() => playPulse(), 1200);
      };
      playPulse();

      ringtoneRef.current = {
        stop: () => {
          stopped = true;
          ctx.close().catch(() => {});
        },
      };
    } catch {
      // ignore audio errors
    }
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  const cleanupCall = useCallback(async (notifyEnd = true) => {
    stopRingtone();
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    peerMapRef.current.forEach(pc => {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    });
    peerMapRef.current.clear();

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    Object.values(remoteVideoRefs.current).forEach(el => {
      if (el) el.srcObject = null;
    });
    Object.values(remoteAudioRefs.current).forEach(el => {
      if (el) el.srcObject = null;
    });

    setRemoteStreams({});
    setDuration(0);
    setMuted(false);
    setCameraOff(false);
    setMinimized(false);
    setConnectionIssue('none');
    setPeerStatus('ringing');
    busyRef.current = false;
    isCallerRef.current = false;
    offerStartedRef.current = false;

    const endingSession = sessionRef.current;
    if (endingSession?.id) {
      await recordCallHistory(endingSession, lastCallStatusRef.current, durationRef.current);
      if (notifyEnd) {
        try {
          await endVoiceCallSession(endingSession.id);
        } catch {
          // session may already be ended
        }
      }
    }

    historyRecordedRef.current = false;
    stopSwCallRing(endingSession?.id);
    setSession(null);
    setIncomingCall(null);
    setPhase('idle');
    setError('');
  }, [stopRingtone, recordCallHistory]);

  const pendingPushActionRef = useRef<'answer' | 'decline' | null>(null);

  const queueIncomingCall = useCallback((call: VoiceCallSession) => {
    if (busyRef.current) return;
    stopSwCallRing(call.id);
    setIncomingCall(call);
    setPhase('incoming');
    playRingtone();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(t('call.incoming') || 'Incoming Call', {
        body: `${call.callerName} • ${call.callType === 'video' ? 'Video' : 'Voice'}`,
        icon: '/icon-192.png',
      });
    }
  }, [playRingtone, t]);

  const handleExternalIncomingCall = useCallback(async (raw: any, action?: string | null) => {
    const partial = parseSessionFromPush(raw);
    if (!partial?.id || busyRef.current) return;

    const session = await fetchVoiceCallSession(partial.id) || partial;
    if (['ended', 'missed', 'declined', 'busy'].includes(session.status)) return;

    clearCallDeepLink();

    if (action === 'decline') {
      pendingPushActionRef.current = null;
      queueIncomingCall(session);
      pendingPushActionRef.current = 'decline';
      return;
    }

    if (action === 'answer') {
      queueIncomingCall(session);
      pendingPushActionRef.current = 'answer';
      return;
    }

    queueIncomingCall(session);
  }, [queueIncomingCall]);

  // Push notification / deep-link / service-worker incoming call bridge
  useEffect(() => {
    if (!userId) return;

    const onSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;
      if (msg.type === 'INCOMING_CALL' || msg.type === 'ANSWER_CALL') {
        void handleExternalIncomingCall(
          msg.sessionJson ? { sessionJson: msg.sessionJson, sessionId: msg.sessionId } : msg,
          msg.type === 'ANSWER_CALL' ? 'answer' : null,
        );
      }
      if (msg.type === 'DECLINE_CALL') {
        void handleExternalIncomingCall(
          msg.sessionJson ? { sessionJson: msg.sessionJson, sessionId: msg.sessionId } : msg,
          'decline',
        );
      }
    };

    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    const onPushCall = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      const data = payload?.data || {};
      void handleExternalIncomingCall(data);
    };
    window.addEventListener('amlak-incoming-call-push', onPushCall);

    const desktopWatch = (window as any).desktopCallWatch;
    const unsubDesktop = desktopWatch?.onIncomingCall?.((session: VoiceCallSession) => {
      void handleExternalIncomingCall(session);
    });

    const { ringId, action } = getCallDeepLinkParams();
    if (ringId) {
      void handleExternalIncomingCall({ sessionId: ringId }, action);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      window.removeEventListener('amlak-incoming-call-push', onPushCall);
      unsubDesktop?.();
    };
  }, [userId, handleExternalIncomingCall]);

  // Connect Mac signaling + background ring watcher + presence heartbeat
  useEffect(() => {
    if (!userId) return;
    connectCallSignaling(userId);
    setCallPresence(userId, userName, true);
    const presenceIv = window.setInterval(() => setCallPresence(userId, userName, true), 45000);
    if (isMacCallBackend()) {
      registerMacCallBackgroundWatch(userId);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      const cfg = getMacApiConfig();
      (window as any).desktopCallWatch?.start?.({ userId, ...cfg });
    }
    return () => {
      disconnectCallSignaling();
      clearCallPresence(userId, userName);
      window.clearInterval(presenceIv);
    };
  }, [userId, userName]);

  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;
    setDuration(0);
    durationTimerRef.current = window.setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  }, []);

  const ensureLocalStream = useCallback(async (callType: CallType) => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await getMediaStream(callType);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const createPeerForRemote = useCallback(async (
    sessionId: string,
    remoteUserId: string,
    callType: CallType,
    isInitiator: boolean,
  ) => {
    if (peerMapRef.current.has(remoteUserId)) return peerMapRef.current.get(remoteUserId)!;

    const pc = createCallPeer();
    peerMapRef.current.set(remoteUserId, pc);

    const localStream = await ensureLocalStream(callType);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      setRemoteStreams(prev => ({ ...prev, [remoteUserId]: remoteStream }));
      setPeerStatus('connected');
      const videoEl = remoteVideoRefs.current[remoteUserId];
      const audioEl = remoteAudioRefs.current[remoteUserId];
      if (videoEl) videoEl.srcObject = remoteStream;
      if (audioEl) {
        audioEl.srcObject = remoteStream;
        audioEl.muted = !speakerOn;
        audioEl.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendCallSignal(sessionId, {
        fromUserId: userId,
        toUserId: remoteUserId,
        type: 'ice-candidate',
        payload: event.candidate.toJSON(),
      }).catch(() => {});
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendCallSignal(sessionId, {
        fromUserId: userId,
        toUserId: remoteUserId,
        type: 'offer',
        payload: offer,
      });
    }

    return pc;
  }, [ensureLocalStream, userId, speakerOn]);

  const handleSignal = useCallback(async (signal: {
    fromUserId: string;
    toUserId: string;
    type: 'offer' | 'answer' | 'ice-candidate';
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  }) => {
    const current = sessionRef.current;
    if (!current) return;

    const remoteUserId = signal.fromUserId;
    let pc = peerMapRef.current.get(remoteUserId);

    if (signal.type === 'offer') {
      if (!pc) {
        pc = await createPeerForRemote(current.id, remoteUserId, current.callType, false);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendCallSignal(current.id, {
        fromUserId: userId,
        toUserId: remoteUserId,
        type: 'answer',
        payload: answer,
      });
      return;
    }

    if (!pc) return;

    if (signal.type === 'answer') {
      if (!pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      }
      return;
    }

    if (signal.type === 'ice-candidate') {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
      } catch {
        // candidate may arrive before remote description
      }
    }
  }, [createPeerForRemote, userId]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;
    return listenIncomingVoiceCalls(userId, calls => {
      if (busyRef.current) return;
      const latest = calls[0];
      if (latest) {
        setIncomingCall(latest);
        setPhase('incoming');
        playRingtone();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(t('call.incoming') || 'Incoming Call', {
            body: `${latest.callerName} • ${latest.callType === 'video' ? 'Video' : 'Voice'}`,
            icon: '/icon-192.png',
          });
        }
      }
    });
  }, [userId, playRingtone, t]);

  // Session listener
  useEffect(() => {
    if (!session?.id) return;

    const unsubSession = listenVoiceCallSession(session.id, updated => {
      // Ignore empty poll misses — only hang up on a real ended status.
      if (!updated) return;
      setSession(updated);

      if (['ended', 'missed', 'declined', 'busy'].includes(updated.status)) {
        lastCallStatusRef.current = updated.status;
        void cleanupCall(false);
        return;
      }

      const joinedCount = Object.values(updated.participants || {}).filter(p => p.status === 'joined').length;
      if (updated.status === 'active' || joinedCount >= 2) {
        setPhase('active');
        stopRingtone();
        callStartTimeRef.current = Date.now();
        startDurationTimer();

        // Caller waits until callee joins, then creates the WebRTC offer.
        if (isCallerRef.current && !offerStartedRef.current) {
          offerStartedRef.current = true;
          setPeerStatus('connecting');
          const targets = (updated.calleeIds || []).filter((id) => id !== userId);
          void (async () => {
            try {
              await ensureLocalStream(updated.callType);
              for (const targetId of targets) {
                if (updated.participants?.[targetId]?.status === 'joined') {
                  await createPeerForRemote(updated.id, targetId, updated.callType, true);
                }
              }
            } catch (err: any) {
              setError(err?.message || t('call.failed') || 'Could not connect call');
            }
          })();
        }
      }
    });

    signalStartedAtRef.current = Date.now();
    const unsubSignals = listenCallSignals(session.id, userId, signal => {
      handleSignal(signal);
    });

    return () => {
      unsubSession();
      unsubSignals();
    };
  }, [session?.id, userId, cleanupCall, handleSignal, startDurationTimer, stopRingtone, recordCallHistory, ensureLocalStream, createPeerForRemote, t]);

  // Attach remote streams to media elements
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([remoteId, stream]) => {
      const videoEl = remoteVideoRefs.current[remoteId];
      const audioEl = remoteAudioRefs.current[remoteId];
      if (videoEl && videoEl.srcObject !== stream) videoEl.srcObject = stream;
      if (audioEl && audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        audioEl.muted = !speakerOn;
        audioEl.play().catch(() => {});
      }
    });
  }, [remoteStreams, speakerOn]);

  const startCall = useCallback(async (params: StartCallParams) => {
    if (busyRef.current || phase !== 'idle') {
      setError(t('call.busy') || 'Already in a call');
      return;
    }

    const targets = params.targetUserIds.filter(id => id !== userId);
    if (targets.length === 0) return;

    try {
      busyRef.current = true;
      isCallerRef.current = true;
      offerStartedRef.current = false;
      historyRecordedRef.current = false;
      lastCallStatusRef.current = 'ended';
      setError('');
      setConnectionIssue('none');
      setPeerStatus('ringing');
      setPhase('outgoing');
      playRingtone();

      const sessionId = await createVoiceCallSession({
        callType: params.type,
        callerId: userId,
        callerName: userName,
        calleeIds: targets,
        calleeNames: params.targetNames,
        roomId: params.roomId,
        roomName: params.roomName,
      });

      const initialSession: VoiceCallSession = {
        id: sessionId,
        callType: params.type,
        callerId: userId,
        callerName: userName,
        calleeIds: targets,
        roomId: params.roomId,
        roomName: params.roomName,
        participants: {
          [userId]: { userId, userName, status: 'joined' },
          ...Object.fromEntries(targets.map(id => [id, {
            userId: id,
            userName: params.targetNames[id] || id,
            status: 'ringing' as const,
          }])),
        },
        status: 'ringing',
      };

      setSession(initialSession);
      sessionRef.current = initialSession;
      try {
        await ensureLocalStream(params.type);
      } catch (mediaErr: any) {
        setError(mediaErr?.message || t('call.micDenied') || 'Microphone permission is required');
        await endVoiceCallSession(sessionId, 'ended');
        await cleanupCall(false);
        return;
      }
      // WebRTC offer is created after the callee joins (see session listener).

      window.setTimeout(() => {
        if (sessionRef.current?.id === sessionId && sessionRef.current.status === 'ringing') {
          setPeerStatus('offline');
        }
      }, 10000);

      // Auto-end if nobody answers in 45s
      window.setTimeout(async () => {
        if (sessionRef.current?.id === sessionId && sessionRef.current.status === 'ringing') {
          lastCallStatusRef.current = 'missed';
          setConnectionIssue('no-answer');
          setPeerStatus('offline');
          await new Promise(r => setTimeout(r, 2000));
          await endVoiceCallSession(sessionId, 'missed');
          cleanupCall(false);
        }
      }, 45000);
    } catch (err: any) {
      setError(err?.message || t('call.failed') || 'Could not start call');
      await cleanupCall(false);
    }
  }, [phase, userId, userName, playRingtone, ensureLocalStream, createPeerForRemote, cleanupCall, t]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      stopSwCallRing(incomingCall.id);
      busyRef.current = true;
      isCallerRef.current = false;
      historyRecordedRef.current = false;
      lastCallStatusRef.current = 'ended';
      stopRingtone();
      setPhase('connecting');

      const updatedParticipants = await updateCallParticipant(
        incomingCall.id,
        userId,
        'joined',
        incomingCall.participants,
      );

      await updateVoiceCallSession(incomingCall.id, {
        status: 'active',
        participants: updatedParticipants,
      });

      setSession({ ...incomingCall, participants: updatedParticipants, status: 'active' });
      setIncomingCall(null);

      await ensureLocalStream(incomingCall.callType);
      await createPeerForRemote(incomingCall.id, incomingCall.callerId, incomingCall.callType, false);
      setPhase('active');
      startDurationTimer();
    } catch (err: any) {
      setError(err?.message || t('call.failed') || 'Could not join call');
      await cleanupCall(false);
    }
  }, [incomingCall, userId, stopRingtone, ensureLocalStream, createPeerForRemote, startDurationTimer, cleanupCall, t]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    stopRingtone();
    lastCallStatusRef.current = 'declined';
    await recordCallHistory(incomingCall, 'declined', 0);
    try {
      await updateCallParticipant(incomingCall.id, userId, 'declined', incomingCall.participants);
      const allDeclined = incomingCall.calleeIds.every(id =>
        id === userId || incomingCall.participants[id]?.status === 'declined',
      );
      if (allDeclined) {
        await endVoiceCallSession(incomingCall.id, 'declined');
      }
    } catch {
      // ignore
    }
    setIncomingCall(null);
    setPhase('idle');
    busyRef.current = false;
    historyRecordedRef.current = false;
    stopSwCallRing(incomingCall.id);
  }, [incomingCall, userId, stopRingtone, recordCallHistory]);

  // Auto-answer / auto-decline when opened from notification action buttons
  useEffect(() => {
    if (!incomingCall || !pendingPushActionRef.current) return;
    const action = pendingPushActionRef.current;
    pendingPushActionRef.current = null;
    if (action === 'answer') {
      void acceptCall();
    } else if (action === 'decline') {
      void declineCall();
    }
  }, [incomingCall, acceptCall, declineCall]);

  const endCall = useCallback(async () => {
    lastCallStatusRef.current = phase === 'active' || durationRef.current > 0 ? 'ended' : 'missed';
    if (sessionRef.current?.id) {
      try {
        if (sessionRef.current.participants?.[userId]) {
          await updateCallParticipant(
            sessionRef.current.id,
            userId,
            'left',
            sessionRef.current.participants,
          );
        }
        await endVoiceCallSession(sessionRef.current.id);
      } catch {
        // ignore
      }
    }
    await cleanupCall(false);
  }, [userId, phase, cleanupCall]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOff(!videoTrack.enabled);
    }
  };

  const flipCamera = async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    const settings = videoTrack.getSettings();
    const nextFacing = settings.facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: nextFacing },
      });
      const newTrack = newStream.getVideoTracks()[0];
      peerMapRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(newTrack);
      });
      localStreamRef.current?.removeTrack(videoTrack);
      videoTrack.stop();
      localStreamRef.current?.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    } catch {
      // ignore
    }
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    Object.values(remoteVideoRefs.current).forEach(el => { if (el) el.muted = !next; });
    Object.values(remoteAudioRefs.current).forEach(el => {
      if (el) {
        el.muted = !next;
        if (next) el.play().catch(() => {});
      }
    });
  };

  const getPeerDisplayName = () => {
    const s = session || incomingCall;
    if (!s) return '';
    if (phase === 'incoming' || !isCallerRef.current) return s.callerName || '';
    const calleeId = s.calleeIds?.[0];
    if (calleeId) return s.participants?.[calleeId]?.userName || '';
    return s.roomName || '';
  };

  const getStatusLabel = () => {
    if (connectionIssue === 'no-signal') return t('call.noSignal') || 'No Signal';
    if (connectionIssue === 'no-answer') return t('call.noAnswer') || 'No Answer';
    if (connectionIssue === 'unavailable') return t('call.unavailable') || 'Unavailable';
    if (phase === 'incoming') return t('call.ringing') || 'Ringing...';
    if (phase === 'outgoing') {
      if (peerStatus === 'offline') return t('call.notInApp') || 'Not in app';
      return t('call.calling') || 'Calling...';
    }
    if (phase === 'connecting') return t('call.connecting') || 'Connecting...';
    if (phase === 'active') return formatDuration(duration);
    return '';
  };

  const getSubStatusLabel = () => {
    if (phase === 'outgoing' && peerStatus === 'ringing') return t('call.waitingAnswer') || 'Waiting for answer...';
    if (phase === 'active') return isVideo ? (t('call.videoCall') || 'Video Call') : (t('call.voiceCall') || 'Voice Call');
    if (phase === 'incoming') return isVideo ? (t('call.incomingVideo') || 'Incoming video call') : (t('call.incomingVoice') || 'Incoming voice call');
    return isVideo ? (t('call.videoCall') || 'Video Call') : (t('call.voiceCall') || 'Voice Call');
  };

  const isInCall = phase !== 'idle' && phase !== 'ended';
  const callType = session?.callType || incomingCall?.callType || 'audio';
  const isVideo = callType === 'video';
  const displayName = getPeerDisplayName();
  const remoteIds = Object.keys(remoteStreams);
  const isGroup = (session?.calleeIds?.length || 0) > 1;
  const showActiveControls = phase === 'active' || phase === 'outgoing' || phase === 'connecting';

  const overlay = phase !== 'idle' && phase !== 'ended' ? (
    <div
      className={`fixed z-[200] transition-all duration-300 call-overlay ${
        minimized
          ? 'bottom-20 sm:bottom-24 right-3 sm:right-4 w-[calc(100vw-1.5rem)] max-w-xs h-48 rounded-3xl shadow-2xl overflow-hidden'
          : 'inset-0'
      }`}
    >
      {/* Hidden remote audio for voice calls */}
      {remoteIds.map(id => (
        <audio key={id} ref={el => { remoteAudioRefs.current[id] = el; }} autoPlay playsInline className="hidden" />
      ))}

      <div className={`relative h-full flex flex-col call-bg ${minimized ? 'call-bg-mini' : ''}`}>
        {!minimized && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="call-bg-glow" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="call-ripple-ring" style={{ animationDelay: `${i * 0.35}s`, width: `${100 + i * 70}px`, height: `${100 + i * 70}px` }} />
            ))}
          </div>
        )}

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-8 pb-2 flex-shrink-0 safe-top">
          <div className="flex flex-col min-w-0">
            <span className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${
              connectionIssue !== 'none' ? 'text-red-100' : 'text-white'
            }`}>
              {getStatusLabel()}
            </span>
            {!minimized && (
              <span className="text-white/80 text-[10px] sm:text-xs mt-0.5 truncate">{getSubStatusLabel()}</span>
            )}
          </div>
          <button
            onClick={() => setMinimized(m => !m)}
            className="p-2.5 sm:p-3 rounded-full bg-white/10 text-white/90 hover:bg-white/20 backdrop-blur-sm transition-all active:scale-90"
          >
            {minimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
          </button>
        </div>

        {/* Main area */}
        <div className={`flex-1 relative flex flex-col items-center justify-center px-4 ${minimized ? 'py-2' : 'py-4 sm:py-8'}`}>
          {isVideo && phase === 'active' && remoteIds.length > 0 && !minimized ? (
            <div className="absolute inset-2 sm:inset-4 rounded-3xl overflow-hidden shadow-2xl">
              {remoteIds.map(remoteId => (
                <video
                  key={remoteId}
                  ref={el => { remoteVideoRefs.current[remoteId] = el; }}
                  autoPlay playsInline
                  className="w-full h-full object-cover bg-black/60"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center z-10">
              <div className="relative mb-4 sm:mb-8">
                <div className={`call-avatar-lg ${phase !== 'active' ? 'call-avatar-pulse' : ''} ${minimized ? 'call-avatar-sm' : ''}`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                {(phase === 'outgoing' || phase === 'incoming') && !minimized && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
                    <div className="absolute -inset-3 rounded-full border border-white/10 animate-pulse" />
                  </>
                )}
                {connectionIssue !== 'none' && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center border-2 border-white shadow-lg">
                    <VolumeX size={14} className="text-white" />
                  </div>
                )}
              </div>
              {!minimized && (
                <>
                  <h2 className="text-2xl sm:text-4xl font-black text-white text-center mb-2 tracking-tight px-4">{displayName}</h2>
                  {isGroup && (
                    <p className="text-emerald-300/70 text-sm flex items-center gap-1.5">
                      <Users size={14} /> {session?.calleeIds?.length} {t('call.participants') || 'participants'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Local PiP */}
          {isVideo && localStreamRef.current && phase === 'active' && !minimized && (
            <div className="absolute bottom-4 right-4 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/25 z-20">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
              {cameraOff && (
                <div className="absolute inset-0 bg-slate-900/85 flex items-center justify-center">
                  <VideoOff size={28} className="text-white/50" />
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-red-300 text-center text-sm px-4 mb-2 z-10">{error}</p>}

        {/* Controls */}
        <div className={`relative z-10 flex-shrink-0 px-4 sm:px-8 pb-6 sm:pb-10 pt-2 safe-bottom ${minimized ? 'pb-4' : ''}`}>
          {phase === 'incoming' ? (
            <div className="flex items-center justify-center gap-10 sm:gap-16">
              <CallActionBtn icon={PhoneOff} label={t('call.decline') || 'Decline'} color="red" size="lg" onClick={declineCall} />
              <CallActionBtn icon={isVideo ? Video : Phone} label={t('call.answer') || 'Answer'} color="green" size="lg" onClick={acceptCall} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              {showActiveControls && (
                <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                  <CallActionBtn
                    icon={muted ? MicOff : Mic}
                    label={muted ? (t('call.unmute') || 'Unmute') : (t('call.mute') || 'Mute')}
                    color={muted ? 'red' : 'glass'}
                    onClick={toggleMute}
                  />
                  {isVideo && phase === 'active' && (
                    <>
                      <CallActionBtn
                        icon={cameraOff ? VideoOff : Video}
                        label={cameraOff ? (t('call.cameraOn') || 'Camera') : (t('call.cameraOff') || 'Cam Off')}
                        color={cameraOff ? 'red' : 'glass'}
                        onClick={toggleCamera}
                      />
                      <CallActionBtn icon={FlipHorizontal} label={t('call.flip') || 'Flip'} color="glass" onClick={flipCamera} />
                    </>
                  )}
                  <CallActionBtn
                    icon={speakerOn ? Volume2 : VolumeX}
                    label={speakerOn ? (t('call.speaker') || 'Speaker') : (t('call.earpiece') || 'Earpiece')}
                    color={speakerOn ? 'green' : 'glass'}
                    onClick={toggleSpeaker}
                  />
                </div>
              )}
              <CallActionBtn icon={PhoneOff} label={t('call.endCall') || 'End'} color="red" size="lg" onClick={endCall} />
            </div>
          )}
          {!minimized && (
            <p className="text-center text-white/25 text-[10px] sm:text-xs mt-4 sm:mt-6 tracking-wide">
              {t('call.freeUnlimited') || 'Free • Unlimited • WiFi & International'}
            </p>
          )}
        </div>
      </div>

      <style>{`
        .call-bg { background: linear-gradient(165deg, #064e3b 0%, #065f46 20%, #047857 45%, #059669 70%, #10b981 100%); }
        .call-bg-mini { background: linear-gradient(135deg, #047857, #059669); }
        .call-bg-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.12) 0%, transparent 55%); }
        .call-ripple-ring { position: absolute; left: 50%; top: 42%; transform: translate(-50%,-50%); border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); animation: callRipple 2.5s ease-out infinite; }
        .call-avatar-lg { width: 7rem; height: 7rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.75rem; font-weight: 800; color: white; background: linear-gradient(145deg, #10b981, #059669, #047857); box-shadow: 0 8px 32px rgba(5,150,105,0.45), inset 0 2px 0 rgba(255,255,255,0.2); }
        .call-avatar-sm { width: 3.5rem; height: 3.5rem; font-size: 1.25rem; }
        .call-avatar-pulse { animation: callPulse 2s ease-in-out infinite; }
        @media (min-width: 640px) { .call-avatar-lg { width: 9rem; height: 9rem; font-size: 3.5rem; } }
        @keyframes callPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.35), 0 8px 32px rgba(5,150,105,0.45); } 50% { box-shadow: 0 0 0 18px rgba(255,255,255,0), 0 8px 32px rgba(5,150,105,0.45); } }
        @keyframes callRipple { 0% { transform: translate(-50%,-50%) scale(0.85); opacity: 0.55; } 100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }
        .mirror { transform: scaleX(-1); }
        .safe-top { padding-top: max(1rem, env(safe-area-inset-top)); }
        .safe-bottom { padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }
      `}</style>
    </div>
  ) : null;

  return (
    <VoiceCallContext.Provider value={{ startCall, isInCall }}>
      {children}
      {overlay}
    </VoiceCallContext.Provider>
  );
};

export default VoiceCallManager;

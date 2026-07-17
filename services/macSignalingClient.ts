import type { VoiceCallSession } from './voiceCallService';

type SignalingMessage =
  | { type: 'connected'; userId: string }
  | { type: 'incoming-call'; session: VoiceCallSession; at: number }
  | { type: 'signal'; sessionId: string; fromUserId: string; toUserId: string; signalType: string; payload: unknown }
  | { type: 'session-update'; session: VoiceCallSession }
  | { type: 'pong'; at: number };

type MessageHandler = (msg: SignalingMessage) => void;

const MAC_API_URL = (import.meta as any).env?.VITE_MAC_API_URL || 'http://mac-mini.local:8787';
const MAC_API_TOKEN = (import.meta as any).env?.VITE_MAC_API_TOKEN || '';

function resolveApiBase(): string {
  const raw = String(MAC_API_URL).trim();
  if (!raw || raw === '/' || raw === './' || raw === 'same-origin') {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }
  return raw.replace(/\/+$/, '');
}

function resolveWsBase(): string {
  const wsOverride = String((import.meta as any).env?.VITE_MAC_WS_URL || '').trim();
  if (wsOverride) {
    return wsOverride.replace(/^http/i, 'ws').replace(/\/+$/, '');
  }

  const base = resolveApiBase();
  if (!base) return '';

  // Netlify (and most static hosts) proxy /api for REST but cannot upgrade WebSocket.
  if (typeof window !== 'undefined' && base === window.location.origin) {
    const host = window.location.hostname;
    const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
    if (!isLocal) {
      const direct = String((import.meta as any).env?.VITE_MAC_PROXY_TARGET || 'https://api.amlak-app.com').trim();
      if (direct) return direct.replace(/^http/i, 'ws').replace(/\/+$/, '');
    }
  }

  return base.replace(/^http/i, 'ws');
}

class MacSignalingClient {
  private ws: WebSocket | null = null;
  private userId = '';
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private shouldConnect = false;
  /** When the Mac API does not expose call routes yet (404), stop polling/reconnect spam. */
  private callsApiUnavailable = false;
  private reconnectAttempt = 0;

  connect(userId: string) {
    this.userId = userId;
    this.shouldConnect = true;
    this.openSocket();
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  async notifyRing(session: VoiceCallSession) {
    const base = resolveApiBase();
    if (!base) return;
    await fetch(`${base}/api/calls/ring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MAC_API_TOKEN ? { Authorization: `Bearer ${MAC_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ session }),
    }).catch(() => {});
  }

  async fetchPendingRings(userId: string): Promise<SignalingMessage[]> {
    const base = resolveApiBase();
    if (!base || this.callsApiUnavailable) return [];
    try {
      const res = await fetch(`${base}/api/calls/pending?userId=${encodeURIComponent(userId)}`, {
        headers: MAC_API_TOKEN ? { Authorization: `Bearer ${MAC_API_TOKEN}` } : {},
      });
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        this.callsApiUnavailable = true;
        return [];
      }
      if (!res.ok) return [];
      const data = await res.json();
      return (data.rings || []) as SignalingMessage[];
    } catch {
      return [];
    }
  }

  async clearPendingRing(userId: string, sessionId: string) {
    const base = resolveApiBase();
    if (!base) return;
    await fetch(
      `${base}/api/calls/pending?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: 'DELETE',
        headers: MAC_API_TOKEN ? { Authorization: `Bearer ${MAC_API_TOKEN}` } : {},
      },
    ).catch(() => {});
  }

  private openSocket() {
    if (!this.shouldConnect || !this.userId || this.callsApiUnavailable) return;
    const wsBase = resolveWsBase();
    if (!wsBase) return;

    const params = new URLSearchParams({ userId: this.userId });
    if (MAC_API_TOKEN) params.set('token', MAC_API_TOKEN);
    const url = `${wsBase}/api/signaling/ws?${params.toString()}`;
    console.log('[AmlakCall] opening WebSocket', { url: url.replace(/token=[^&]+/, 'token=***'), userId: this.userId });

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.warn('[AmlakCall] WebSocket construct failed', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[AmlakCall] WebSocket open');
      this.reconnectAttempt = 0;
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping' });
      }, 25000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SignalingMessage;
        console.log('[AmlakCall] WebSocket message', { type: (msg as any).type });
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore
      }
    };

    this.ws.onclose = (ev) => {
      console.warn('[AmlakCall] WebSocket close', { code: ev.code, reason: ev.reason, attempt: this.reconnectAttempt });
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      // 1006 / immediate close while Vite proxy or Cloudflare has no WS upgrade path
      if (this.reconnectAttempt >= 5) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      console.warn('[AmlakCall] WebSocket error');
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (!this.shouldConnect || this.callsApiUnavailable) return;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectAttempt += 1;
    const delay = Math.min(30000, 3000 * this.reconnectAttempt);
    this.reconnectTimer = window.setTimeout(() => this.openSocket(), delay);
  }
}

export const macSignaling = new MacSignalingClient();

export function getMacApiConfig() {
  return {
    apiBase: resolveApiBase(),
    token: MAC_API_TOKEN,
  };
}

export function registerMacCallBackgroundWatch(userId: string) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({
      type: 'AMLAK_CALL_WATCH',
      userId,
      apiBase: resolveApiBase(),
      token: MAC_API_TOKEN,
    });
  }).catch(() => {});
}

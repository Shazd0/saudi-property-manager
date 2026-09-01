/**
 * Mac API URL resolution for REST vs WebSocket.
 * On Netlify/public hosts, REST must use same-origin `/api` (proxied) to avoid CORS.
 * WebSocket cannot use static-host proxies — uses VITE_MAC_PROXY_TARGET direct.
 */

const MAC_API_URL = (import.meta as any).env?.VITE_MAC_API_URL || 'http://mac-mini.local:8787';

export function isBrowserLocalHost(): boolean {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
}

export function isPrivateOrLocalBackendUrl(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) return true;
    if (hostname.endsWith('.local')) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    const private172 = hostname.match(/^172\.(\d+)\./);
    return !!private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31;
  } catch {
    return false;
  }
}

/** REST fetch base — same-origin on public hosted sites (Netlify /api proxy). */
export function resolveMacRestApiBase(): string {
  const raw = String(MAC_API_URL).trim();

  if (typeof window !== 'undefined') {
    const pageOrigin = window.location.origin;
    if (!isBrowserLocalHost()) {
      if (!raw || raw === '/' || raw === './' || raw === 'same-origin') {
        return pageOrigin;
      }
      try {
        const configured = new URL(raw, pageOrigin);
        if (configured.origin !== pageOrigin) {
          return pageOrigin;
        }
      } catch {
        return pageOrigin;
      }
    }
  }

  if (!raw || raw === '/' || raw === './' || raw === 'same-origin') {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }
  return raw.replace(/\/+$/, '');
}

/** WebSocket base — direct Mac API host when REST is proxied same-origin. */
export function resolveMacWsApiBase(): string {
  const wsOverride = String((import.meta as any).env?.VITE_MAC_WS_URL || '').trim();
  if (wsOverride) {
    return wsOverride.replace(/^http/i, 'ws').replace(/\/+$/, '');
  }

  const restBase = resolveMacRestApiBase();
  if (!restBase) return '';

  if (typeof window !== 'undefined' && restBase === window.location.origin && !isBrowserLocalHost()) {
    const direct = String((import.meta as any).env?.VITE_MAC_PROXY_TARGET || 'https://api.amlak-app.com').trim();
    if (direct) return direct.replace(/^http/i, 'ws').replace(/\/+$/, '');
  }

  return restBase.replace(/^http/i, 'ws');
}

export function getMacApiUrlEnv(): string {
  return String(MAC_API_URL).trim();
}

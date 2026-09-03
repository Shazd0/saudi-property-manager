/**
 * ZATCA signing API base URL (no trailing slash).
 * Hosted web: same-origin `/zatca-api` (Netlify proxies to Mac Mini via api.amlak-app.com).
 * Local Vite: http://localhost:3022 unless VITE_ZATCA_SERVICE_URL is set.
 */
function isBrowserLocalHost(): boolean {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
}

export function resolveZatcaServiceBase(): string {
  const raw = String(
    (import.meta as { env?: { VITE_ZATCA_SERVICE_URL?: string } }).env?.VITE_ZATCA_SERVICE_URL || '',
  )
    .trim()
    .replace(/\/+$/, '');

  if (typeof window !== 'undefined' && !isBrowserLocalHost()) {
    if (!raw || raw === '/' || raw.startsWith('/')) {
      return raw || '/zatca-api';
    }
    try {
      const host = new URL(raw, window.location.origin).hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
        return '/zatca-api';
      }
    } catch {
      return '/zatca-api';
    }
  }

  return raw || 'http://localhost:3022';
}

export function zatcaSignAndReportUrl(): string {
  return `${resolveZatcaServiceBase()}/zatca/sign-and-report`;
}

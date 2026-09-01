/**
 * Captures client runtime errors and sends them to /api/report-runtime-error
 * so admins (and optional Cursor Automation webhook) can auto-triage fixes.
 */
import { auth } from '../firebase';

export type RuntimeErrorPayload = {
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  kind: 'error' | 'unhandledrejection' | 'console' | 'react-boundary';
  url: string;
  route: string;
  userAgent: string;
  userId?: string;
  bookId?: string;
  extra?: Record<string, unknown>;
};

const DEDUPE_MS = 60_000;
const recent = new Map<string, number>();

function fingerprint(payload: Pick<RuntimeErrorPayload, 'message' | 'stack' | 'kind' | 'url'>): string {
  return `${payload.kind}|${payload.message}|${payload.stack || ''}|${payload.url}`.slice(0, 500);
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < DEDUPE_MS) return false;
  recent.set(key, now);
  return true;
}

function currentRoute(): string {
  try {
    return `${window.location.pathname}${window.location.hash || ''}`;
  } catch {
    return '';
  }
}

function readSessionContext(): { userId?: string; bookId?: string } {
  try {
    const raw = localStorage.getItem('savedUserSession');
    if (!raw) return {};
    const session = JSON.parse(raw);
    return {
      userId: session?.id ? String(session.id) : undefined,
      bookId: session?.bookId ? String(session.bookId) : undefined,
    };
  } catch {
    return {};
  }
}

export async function reportRuntimeError(partial: Omit<RuntimeErrorPayload, 'url' | 'route' | 'userAgent'>): Promise<{ reported: boolean; duplicate?: boolean }> {
  if (typeof window === 'undefined') return { reported: false };

  const payload: RuntimeErrorPayload = {
    ...partial,
    url: window.location.href,
    route: currentRoute(),
    userAgent: navigator.userAgent,
    ...readSessionContext(),
  };

  if (auth.currentUser?.uid && !payload.userId) {
    payload.userId = auth.currentUser.email?.split('@')[0] || auth.currentUser.uid;
  }

  const key = fingerprint(payload);
  if (!shouldSend(key)) return { reported: false, duplicate: true };

  try {
    const res = await fetch('/api/report-runtime-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok) {
      const { notifyRuntimeErrorReported } = await import('../components/RuntimeErrorNotice');
      notifyRuntimeErrorReported();
      return { reported: true };
    }
  } catch {
    /* never throw from reporter */
  }
  return { reported: false };
}

let installed = false;

export function initRuntimeErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
      return;
    }
    void reportRuntimeError({
      kind: 'error',
      message: String(event.message || 'Unknown error'),
      stack: event.error?.stack ? String(event.error.stack) : undefined,
      source: event.filename ? String(event.filename) : undefined,
      line: typeof event.lineno === 'number' ? event.lineno : undefined,
      column: typeof event.colno === 'number' ? event.colno : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';
    const stack = reason instanceof Error ? reason.stack : undefined;
    void reportRuntimeError({ kind: 'unhandledrejection', message, stack });
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    const text = args.map((arg) => {
      if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`;
      if (typeof arg === 'string') return arg;
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }).join(' ');
    if (!text || text.length < 8) return;
    if (/runtimeErrorReporter|report-runtime-error/i.test(text)) return;
    void reportRuntimeError({
      kind: 'console',
      message: text.slice(0, 4000),
    });
  };
}

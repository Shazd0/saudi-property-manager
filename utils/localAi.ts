/** Local Ollama (OpenAI-compatible) + optional Groq cloud fallback. */

export const GROQ_LS_KEY = 'amlak_ai_gemini_key';

const LOCAL_AI_LS_URL = 'amlak_local_ai_url';
const LOCAL_AI_LS_MODEL = 'amlak_local_ai_model';

export function getGroqApiKey(): string {
  try {
    const fromLs = localStorage.getItem(GROQ_LS_KEY)?.trim();
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  const envKey = (import.meta as any)?.env?.VITE_GROQ_API_KEY as string | undefined;
  return envKey?.trim() || '';
}

export function hasGroqApiKey(): boolean {
  return !!getGroqApiKey();
}

/**
 * Ollama base URL.
 * On Vite `localhost` / `127.0.0.1` we always use same-origin `/ollama` (proxied)
 * so CORS never fails when the page origin is `localhost` but Ollama answers `127.0.0.1`.
 */
export function getLocalAiBaseUrl(): string {
  const env = (import.meta as any)?.env?.VITE_LOCAL_AI_URL as string | undefined;
  if (env?.trim()) return env.trim().replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      (protocol === 'http:' || protocol === 'https:')
    ) {
      return '/ollama';
    }
  }

  try {
    const fromLs = localStorage.getItem(LOCAL_AI_LS_URL)?.trim();
    if (fromLs) return fromLs.replace(/\/+$/, '');
  } catch {
    /* ignore */
  }

  return 'http://127.0.0.1:11434';
}

/** Prefer the user's stable vision model. */
export function getLocalAiVisionModel(): string {
  try {
    const fromLs = localStorage.getItem(LOCAL_AI_LS_MODEL)?.trim();
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  const env = (import.meta as any)?.env?.VITE_LOCAL_AI_MODEL as string | undefined;
  return env || 'stable-qwen:latest';
}

export function getLocalAiTextModel(): string {
  return getLocalAiVisionModel();
}

let localAiAvailableCache: { ok: boolean; at: number } | null = null;
let localAiProbeInFlight: Promise<boolean> | null = null;

/** Quick health check against local Ollama. Cached ~60s; dedupes in-flight probes. */
export async function isLocalAiAvailable(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && localAiAvailableCache && now - localAiAvailableCache.at < 60_000) {
    return localAiAvailableCache.ok;
  }
  if (localAiProbeInFlight) return localAiProbeInFlight;

  localAiProbeInFlight = (async () => {
    try {
      const base = getLocalAiBaseUrl();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      const ok = res.ok;
      localAiAvailableCache = { ok, at: Date.now() };
      return ok;
    } catch {
      localAiAvailableCache = { ok: false, at: Date.now() };
      return false;
    } finally {
      localAiProbeInFlight = null;
    }
  })();

  return localAiProbeInFlight;
}

/** Sync optimistic: true if we recently found Ollama, or Groq key exists. */
export function hasAiBackendCached(): boolean {
  if (localAiAvailableCache?.ok) return true;
  return hasGroqApiKey();
}

export type AiProvider = 'local' | 'groq';

export async function resolveAiProvider(): Promise<AiProvider | null> {
  if (await isLocalAiAvailable()) return 'local';
  if (hasGroqApiKey()) return 'groq';
  return null;
}

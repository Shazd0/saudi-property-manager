/**
 * Tracks Mac API reachability so the UI can show a banner and polling can back off
 * when api.amlak-app.com (or the Netlify /api proxy) returns 502/503.
 */

export type MacApiHealth = 'unknown' | 'healthy' | 'unhealthy';

let health: MacApiHealth = 'unknown';
let consecutiveFailures = 0;
let lastFailureAt = 0;
let lastSuccessAt = 0;
const listeners = new Set<(state: MacApiHealth) => void>();

const UNHEALTHY_RETRY_MS = 60_000;

function emit() {
  listeners.forEach((cb) => cb(health));
}

export function getMacApiHealth(): MacApiHealth {
  return health;
}

export function subscribeMacApiHealth(cb: (state: MacApiHealth) => void): () => void {
  listeners.add(cb);
  cb(health);
  return () => listeners.delete(cb);
}

export function reportMacApiSuccess() {
  consecutiveFailures = 0;
  lastSuccessAt = Date.now();
  if (health !== 'healthy') {
    health = 'healthy';
    emit();
  }
}

export function reportMacApiFailure(status?: number) {
  consecutiveFailures += 1;
  lastFailureAt = Date.now();
  const hardFail = status === 502 || status === 503 || status === 504 || status === 0;
  if (hardFail || consecutiveFailures >= 3) {
    if (health !== 'unhealthy') {
      health = 'unhealthy';
      emit();
    }
  }
}

/** Skip noisy polling while the API is known down (retry periodically). */
export function isMacApiPollingAllowed(): boolean {
  if (health !== 'unhealthy') return true;
  return Date.now() - lastFailureAt >= UNHEALTHY_RETRY_MS;
}

export function getMacApiHealthMeta() {
  return { health, consecutiveFailures, lastFailureAt, lastSuccessAt };
}

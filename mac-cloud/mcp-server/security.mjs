import { createHash, timingSafeEqual } from 'node:crypto';

const SENSITIVE_KEY = /(password|passcode|secret|token|national.?id|identity.?number|iqama|iban|bank.?account|phone|mobile|email|contact)/i;
const INJECTION = [
  /ignore (all|any|the|your) (previous|prior|above) (instructions|rules|prompt)/i,
  /system prompt/i,
  /developer (message|instructions)/i,
  /jailbreak|prompt injection/i,
  /reveal|print|show.{0,20}(secret|token|password|instructions)/i,
  /act as.{0,30}(admin|owner|system)/i,
  /bypass.{0,20}(auth|policy|restriction)/i,
];

export function secureEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  if (a.length !== b.length) {
    timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
    return false;
  }
  return timingSafeEqual(a, b);
}

export function bearerToken(header) {
  const match = /^Bearer ([^\s]+)$/i.exec(String(header || ''));
  return match?.[1] || '';
}

export function redact(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1),
  ]));
}

export function containsPromptInjection(text) {
  return INJECTION.some((pattern) => pattern.test(String(text || '')));
}

export function createRateLimiter({ limit = 60, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();
  return {
    consume(identity) {
      const time = now();
      const current = buckets.get(identity);
      if (!current || time >= current.resetAt) {
        buckets.set(identity, { count: 1, resetAt: time + windowMs });
        return { allowed: true, remaining: limit - 1 };
      }
      current.count += 1;
      return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count) };
    },
    clear() { buckets.clear(); },
  };
}

export function requestMetadata(req) {
  return {
    requestId: req.id,
    ipHash: createHash('sha256').update(String(req.ip || '')).digest('hex').slice(0, 16),
    userAgent: String(req.get?.('user-agent') || '').slice(0, 256),
  };
}

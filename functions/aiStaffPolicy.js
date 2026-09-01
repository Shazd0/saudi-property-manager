/**
 * Amlak AI Staff — policy helpers (caps, paidThrough, public flags).
 * Shared by licenseApi.js and aiStaffAssistant.js. No API keys here.
 */

const AI_STAFF_PRICE_SAR_MONTH = 1500;
const DEFAULT_CAP_TEXT_PER_DAY = 150;
const DEFAULT_CAP_VOICE_PER_DAY = 30;

function riyadhParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const month = `${parts.year}-${parts.month}`;
  return { day, month };
}

function sanitizeIsoDate(raw) {
  const s = String(raw || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const t = Date.parse(`${s}T12:00:00+03:00`);
  if (!Number.isFinite(t)) return "";
  return s;
}

function sanitizeCap(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10_000, Math.floor(n)));
}

function sanitizeAiStaffNote(raw) {
  return String(raw || "").trim().slice(0, 240);
}

function normalizeUsage(raw, now = new Date()) {
  const { day, month } = riyadhParts(now);
  const u = raw && typeof raw === "object" ? raw : {};
  const sameDay = String(u.day || "") === day;
  const sameMonth = String(u.month || "") === month;
  return {
    day,
    text: sameDay ? Math.max(0, Math.floor(Number(u.text) || 0)) : 0,
    voice: sameDay ? Math.max(0, Math.floor(Number(u.voice) || 0)) : 0,
    month,
    textMonth: sameMonth ? Math.max(0, Math.floor(Number(u.textMonth) || 0)) : 0,
    voiceMonth: sameMonth ? Math.max(0, Math.floor(Number(u.voiceMonth) || 0)) : 0,
  };
}

function killSwitchOn() {
  const v = String(process.env.AI_STAFF_KILL_SWITCH || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Public / server truth: is AI Staff usable for this license doc?
 */
function computeAiStaffActive(licenseData, now = new Date()) {
  const d = licenseData || {};
  if (!d.aiStaffEnabled) return false;
  if (d.aiStaffPaused) return false;
  if (killSwitchOn()) return false;
  const paidThrough = sanitizeIsoDate(d.aiStaffPaidThrough);
  if (!paidThrough) return false;
  const { day } = riyadhParts(now);
  return paidThrough >= day;
}

function publicAiStaffFlags(licenseData, now = new Date()) {
  const d = licenseData || {};
  const enabled = !!d.aiStaffEnabled;
  const paused = !!d.aiStaffPaused;
  const paidThrough = sanitizeIsoDate(d.aiStaffPaidThrough);
  const active = computeAiStaffActive(d, now);
  return {
    aiStaffEnabled: enabled,
    aiStaffPaused: paused,
    aiStaffActive: active,
    aiStaffPaidThrough: paidThrough || null,
  };
}

function salesAiStaffFields(licenseData, now = new Date()) {
  const d = licenseData || {};
  const usage = normalizeUsage(d.aiStaffUsage, now);
  const flags = publicAiStaffFlags(d, now);
  return {
    ...flags,
    aiStaffCapTextPerDay: sanitizeCap(d.aiStaffCapTextPerDay, DEFAULT_CAP_TEXT_PER_DAY),
    aiStaffCapVoicePerDay: sanitizeCap(d.aiStaffCapVoicePerDay, DEFAULT_CAP_VOICE_PER_DAY),
    aiStaffNote: sanitizeAiStaffNote(d.aiStaffNote),
    aiStaffUsage: usage,
    aiStaffPriceSarMonth: AI_STAFF_PRICE_SAR_MONTH,
  };
}

function buildAiStaffPolicyPatch(body) {
  const patch = {};
  let hasField = false;
  if (typeof body.aiStaffEnabled === "boolean") {
    patch.aiStaffEnabled = body.aiStaffEnabled;
    hasField = true;
  }
  if (typeof body.aiStaffPaused === "boolean") {
    patch.aiStaffPaused = body.aiStaffPaused;
    hasField = true;
  }
  if (body.aiStaffPaidThrough !== undefined) {
    const d = sanitizeIsoDate(body.aiStaffPaidThrough);
    patch.aiStaffPaidThrough = d || null;
    hasField = true;
  }
  if (body.aiStaffCapTextPerDay !== undefined) {
    patch.aiStaffCapTextPerDay = sanitizeCap(body.aiStaffCapTextPerDay, DEFAULT_CAP_TEXT_PER_DAY);
    hasField = true;
  }
  if (body.aiStaffCapVoicePerDay !== undefined) {
    patch.aiStaffCapVoicePerDay = sanitizeCap(body.aiStaffCapVoicePerDay, DEFAULT_CAP_VOICE_PER_DAY);
    hasField = true;
  }
  if (body.aiStaffNote !== undefined) {
    patch.aiStaffNote = sanitizeAiStaffNote(body.aiStaffNote);
    hasField = true;
  }
  return { patch, hasField };
}

const CAP_MESSAGE_EN =
  "Daily processing limit reached. Please use the web dashboard for further actions today.";
const CAP_MESSAGE_AR =
  "تم بلوغ حد المعالجة اليومي. يرجى استخدام لوحة التحكم لمزيد من الإجراءات اليوم.";
const PAUSED_MESSAGE_EN =
  "AI Staff is paused. Contact Amlak to renew (1,500 SAR/month).";
const PAUSED_MESSAGE_AR =
  "موظف أملاك الذكي متوقف. تواصل مع أملاك للتجديد (١٬٥٠٠ ريال شهرياً).";

function capMessages() {
  return { en: CAP_MESSAGE_EN, ar: CAP_MESSAGE_AR, message: CAP_MESSAGE_EN };
}

function pausedMessages() {
  return { en: PAUSED_MESSAGE_EN, ar: PAUSED_MESSAGE_AR, message: PAUSED_MESSAGE_EN };
}

/**
 * Atomically check + increment usage. Returns { ok, usage, reason, messages? }.
 * kind: 'text' | 'voice'
 */
async function consumeAiStaffUsageTx(db, FieldValue, licenseId, kind, now = new Date()) {
  const ref = db.collection("product_licenses").doc(licenseId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { ok: false, reason: "missing", messages: pausedMessages() };
    }
    const d = snap.data() || {};
    if (!computeAiStaffActive(d, now)) {
      return { ok: false, reason: "inactive", messages: pausedMessages() };
    }
    const usage = normalizeUsage(d.aiStaffUsage, now);
    const capText = sanitizeCap(d.aiStaffCapTextPerDay, DEFAULT_CAP_TEXT_PER_DAY);
    const capVoice = sanitizeCap(d.aiStaffCapVoicePerDay, DEFAULT_CAP_VOICE_PER_DAY);
    if (kind === "voice") {
      if (usage.voice >= capVoice) {
        return { ok: false, reason: "cap_voice", usage, messages: capMessages() };
      }
      usage.voice += 1;
      usage.voiceMonth += 1;
    } else {
      if (usage.text >= capText) {
        return { ok: false, reason: "cap_text", usage, messages: capMessages() };
      }
      usage.text += 1;
      usage.textMonth += 1;
    }
    tx.set(
      ref,
      {
        aiStaffUsage: usage,
        aiStaffUsageUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true, usage, capText, capVoice };
  });
}

module.exports = {
  AI_STAFF_PRICE_SAR_MONTH,
  DEFAULT_CAP_TEXT_PER_DAY,
  DEFAULT_CAP_VOICE_PER_DAY,
  riyadhParts,
  sanitizeIsoDate,
  sanitizeCap,
  sanitizeAiStaffNote,
  normalizeUsage,
  killSwitchOn,
  computeAiStaffActive,
  publicAiStaffFlags,
  salesAiStaffFields,
  buildAiStaffPolicyPatch,
  capMessages,
  pausedMessages,
  consumeAiStaffUsageTx,
};

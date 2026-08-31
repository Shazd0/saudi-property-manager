/**
 * Product license HTTPS handlers (registry Firestore via Admin SDK).
 * Env (set in Firebase Functions config / secrets):
 *   SALES_CONSOLE_PASSWORD — must match what Sales Console sends (same as VITE_SALES_CONSOLE_PASSWORD).
 *   ALLOW_LEGACY_EMAIL_ACTIVATION=1 — ONLY for migrating old buyers. Re-enables the
 *     email+password activation path that seeds an ADMIN without proving control of
 *     the tenant Firebase project. Leave unset in production.
 */

const crypto = require("crypto");
const { getApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  publicAiStaffFlags,
  salesAiStaffFields,
  buildAiStaffPolicyPatch,
  AI_STAFF_PRICE_SAR_MONTH,
  killSwitchOn,
} = require("./aiStaffPolicy");
const { loadAiCloudConfig, AI_CLOUD_DOC, maskKey } = require("./aiCloudConfig");

let aiCloudKillCache = { at: 0, on: false };

async function registryKillSwitchOn() {
  if (killSwitchOn()) return true;
  const now = Date.now();
  if (now - aiCloudKillCache.at < 15_000) return aiCloudKillCache.on;
  try {
    const snap = await getFirestore().doc(AI_CLOUD_DOC).get();
    const on = !!(snap.exists && snap.data()?.killSwitch);
    aiCloudKillCache = { at: now, on };
    return on;
  } catch {
    return aiCloudKillCache.on;
  }
}

function publicAiStaffFlagsWithKill(licenseData, killOn) {
  const base = publicAiStaffFlags(licenseData);
  if (killOn) {
    return { ...base, aiStaffActive: false };
  }
  return base;
}

/** Activation normally requires a tenant-project Firebase idToken. */
const ALLOW_LEGACY_EMAIL_ACTIVATION =
  String(process.env.ALLOW_LEGACY_EMAIL_ACTIVATION || "").trim() === "1";

const COLLECTION = "product_licenses";
const GIFT_COLLECTION = "license_gift_reveals";
const ZATCA_JOB_COLLECTION = "product_zatca_jobs";

/** Unified buyer Firebase project — all licenses use saudi-property-manager after migration. */
const UNIFIED_FIREBASE_WEB_CONFIG = {
  apiKey: process.env.UNIFIED_FIREBASE_API_KEY || "AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs",
  authDomain: process.env.UNIFIED_FIREBASE_AUTH_DOMAIN || "saudi-property-manager.firebaseapp.com",
  projectId: process.env.UNIFIED_FIREBASE_PROJECT_ID || "saudi-property-manager",
  storageBucket: process.env.UNIFIED_FIREBASE_STORAGE_BUCKET || "saudi-property-manager.firebasestorage.app",
  messagingSenderId: process.env.UNIFIED_FIREBASE_MESSAGING_SENDER_ID || "854165833434",
  appId: process.env.UNIFIED_FIREBASE_APP_ID || "1:854165833434:web:bc550b5c79266bd1fb07e3",
};

function resolveLicenseTenantConfig(licenseData) {
  const legacy = tenantConfigShape(licenseData?.tenantFirebaseConfig);
  return legacy || tenantConfigShape(UNIFIED_FIREBASE_WEB_CONFIG);
}

function resolveLicenseBookId(licenseData) {
  const teamCode = String(licenseData?.bookId || licenseData?.teamCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return teamCode || null;
}
const REDEEM_TTL_MS = 15 * 60 * 1000;
const DEFAULT_GIFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LIVE_PRESENCE_MS = 75 * 1000;
const PRESENCE_PRUNE_MS = 24 * 60 * 60 * 1000;

/** Keep in sync with `normalizeProductLicensePlainKey` in utils/normalizeProductLicenseKey.ts */
function normalizePlainProductKey(plainKey) {
  return String(plainKey || "")
    .trim()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
}

function licenseKeyHash(plainKey) {
  const n = normalizePlainProductKey(plainKey);
  return crypto.createHash("sha256").update(n, "utf8").digest("hex");
}

function randomNonce() {
  return crypto.randomBytes(24).toString("hex");
}

/** Same SHA-256 hex as `hashPassword` in `services/firestoreService.ts` (Web Crypto digest). */
function hashPasswordSha256Hex(plain) {
  return crypto.createHash("sha256").update(String(plain || ""), "utf8").digest("hex");
}

/** Firestore project backing this Admin SDK (license registry). */
function getRegistryFirestoreProjectId() {
  try {
    const app = getApp();
    if (app.options.projectId) return String(app.options.projectId);
  } catch {
    /* no default app */
  }
  return String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "").trim();
}

/** Short code for staff / new devices (not the long product key). Stored uppercase. */
function generateTeamCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(14);
  let s = "";
  for (let i = 0; i < 14; i++) {
    s += alphabet[bytes[i] % alphabet.length];
  }
  return s;
}

/** Best-effort durable rate limit (Firestore) with in-memory fallback for multi-instance CF. */
const memoryRateBuckets = new Map();

function clientIp(req) {
  // Only trust X-Forwarded-For when explicitly behind a reverse proxy that overwrites it.
  const trustProxy =
    String(process.env.TRUST_PROXY || "").trim() === "1" ||
    String(process.env.TRUST_PROXY || "").trim().toLowerCase() === "true";
  if (trustProxy) {
    const raw = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    return String(Array.isArray(raw) ? raw[0] : raw)
      .split(",")[0]
      .trim()
      .slice(0, 160);
  }
  return String(req.socket?.remoteAddress || req.ip || "unknown").slice(0, 160);
}

function memoryConsume(bucketKey, max, windowMs) {
  const now = Date.now();
  let e = memoryRateBuckets.get(bucketKey);
  if (!e || e.resetAt < now) {
    e = { count: 0, resetAt: now + windowMs };
    memoryRateBuckets.set(bucketKey, e);
  }
  e.count += 1;
  // Cap map size
  if (memoryRateBuckets.size > 5000) {
    for (const [k, v] of memoryRateBuckets) {
      if (v.resetAt < now) memoryRateBuckets.delete(k);
      if (memoryRateBuckets.size < 4000) break;
    }
  }
  return e.count <= max;
}

/**
 * @returns {Promise<boolean>} true if allowed
 */
async function consumeRateLimit(bucket, key, max, windowMs) {
  const safeKey = String(key || "unknown")
    .replace(/[^a-zA-Z0-9:_@.-]/g, "_")
    .slice(0, 140);
  const docId = `${bucket}__${safeKey}`.slice(0, 700);

  try {
    const ref = getFirestore().collection("_server").doc("rateLimits").collection("buckets").doc(docId);
    const now = Date.now();
    const allowed = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.exists ? snap.data() || {} : {};
      let resetAt = Number(d.resetAt) || 0;
      let count = Number(d.count) || 0;
      if (!resetAt || resetAt < now) {
        resetAt = now + windowMs;
        count = 0;
      }
      count += 1;
      tx.set(ref, { bucket, key: safeKey, count, resetAt, updatedAt: now }, { merge: true });
      return count <= max;
    });
    return allowed;
  } catch (e) {
    console.warn("[rateLimit] Firestore unavailable, using memory only:", e?.message || e);
    return memoryConsume(docId, max, windowMs);
  }
}

/** Keep in sync with `isValidFirebaseWebApiKey` in utils/firebaseWebApiKey.ts */
function isValidFirebaseWebApiKey(apiKey) {
  return typeof apiKey === "string" && /^AIza[\w-]{35}$/.test(apiKey.trim());
}

function tenantConfigShape(c) {
  if (!c || typeof c !== "object") return null;
  const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = c;
  if (
    typeof apiKey !== "string" ||
    !apiKey.trim() ||
    !isValidFirebaseWebApiKey(apiKey) ||
    typeof authDomain !== "string" ||
    !authDomain.trim() ||
    typeof projectId !== "string" ||
    !projectId.trim() ||
    typeof storageBucket !== "string" ||
    !storageBucket.trim() ||
    typeof messagingSenderId !== "string" ||
    !messagingSenderId.trim() ||
    typeof appId !== "string" ||
    !appId.trim()
  ) {
    return null;
  }
  return {
    apiKey: apiKey.trim(),
    authDomain: authDomain.trim(),
    projectId: projectId.trim(),
    storageBucket: storageBucket.trim(),
    messagingSenderId: messagingSenderId.trim(),
    appId: appId.trim(),
  };
}

async function verifyTenantIdToken(tenantApiKey, idToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(tenantApiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const users = data.users || [];
  if (!users.length) return null;
  const u = users[0];
  const providers = Array.isArray(u.providerUserInfo) ? u.providerUserInfo : [];
  const hasStrongProvider = providers.some((p) =>
    ["password", "google.com", "phone"].includes(String(p.providerId || ""))
  );
  return {
    localId: u.localId,
    email: u.email,
    isAnonymous: !hasStrongProvider,
    providers,
  };
}

function firestoreRestFieldString(fields, key) {
  const f = fields && fields[key];
  if (!f) return "";
  if (typeof f.stringValue === "string") return f.stringValue;
  return "";
}

function firestoreRestFieldStrings(fields, key) {
  const f = fields && fields[key];
  if (!f || !f.arrayValue || !Array.isArray(f.arrayValue.values)) return [];
  return f.arrayValue.values.map((v) => (v && typeof v.stringValue === "string" ? v.stringValue : "")).filter(Boolean);
}

/** Read authIndex/{uid} from the tenant project using the caller's idToken (rules: own doc readable). */
async function fetchTenantAuthIndex(projectId, idToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/authIndex/${encodeURIComponent(uid)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!r.ok) return null;
  const doc = await r.json();
  const fields = doc.fields || {};
  return {
    appUserId: firestoreRestFieldString(fields, "appUserId"),
    kind: firestoreRestFieldString(fields, "kind"),
    role: firestoreRestFieldString(fields, "role"),
    buildingIds: firestoreRestFieldStrings(fields, "buildingIds"),
    customerId: firestoreRestFieldString(fields, "customerId"),
  };
}

/**
 * Sanitize client invoice payload — amounts must be finite numbers in a sane range.
 * Server still cannot recompute from tenant DB without Admin access to that project;
 * ADMIN + non-anonymous + suspension checks are the authority gates.
 */
function sanitizeZatcaInvoicePayload(raw) {
  const inv = raw && typeof raw === "object" ? raw : {};
  const amount = Number(inv.amount);
  const vatRate = Number(inv.vatRate);
  if (!Number.isFinite(amount) || Math.abs(amount) > 50_000_000) {
    return { ok: false, error: "Invalid invoice amount" };
  }
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return { ok: false, error: "Invalid VAT rate" };
  }
  const invoiceNumber = String(inv.invoiceNumber || inv.vatInvoiceNumber || "").trim().slice(0, 64);
  if (!invoiceNumber) return { ok: false, error: "invoiceNumber required" };
  const category = String(inv.invoiceCategory || "simplified").trim().toLowerCase();
  if (!["simplified", "standard"].includes(category)) {
    return { ok: false, error: "invoiceCategory must be simplified or standard" };
  }
  const buyerAddress =
    inv.buyerAddress && typeof inv.buyerAddress === "object" ? inv.buyerAddress : {};
  return {
    ok: true,
    invoice: {
      invoiceNumber,
      amount,
      vatRate,
      issueDate: String(inv.issueDate || "").slice(0, 32),
      description: String(inv.description || "").slice(0, 400),
      isCreditNote: !!inv.isCreditNote,
      originalInvoiceId: String(inv.originalInvoiceId || "").slice(0, 64),
      buyerName: String(inv.buyerName || inv.customerName || "").slice(0, 200),
      buyerVAT: String(inv.buyerVAT || inv.customerVAT || "").replace(/\D/g, "").slice(0, 15),
      buyerId: String(inv.buyerId || inv.iqamaNo || "").replace(/\D/g, "").slice(0, 20),
      invoiceCategory: category,
      requireClearance: category === "standard",
      buyerAddress: {
        street: String(buyerAddress.street || buyerAddress.streetName || "").trim().slice(0, 160),
        building: String(buyerAddress.building || buyerAddress.buildingNo || "").trim().slice(0, 20),
        district: String(buyerAddress.district || buyerAddress.citySubdivision || "").trim().slice(0, 120),
        city: String(buyerAddress.city || "").trim().slice(0, 120),
        postalCode: String(buyerAddress.postalCode || buyerAddress.postalZone || "").trim().slice(0, 20),
        additionalNo: String(buyerAddress.additionalNo || buyerAddress.plotIdentification || "").trim().slice(0, 20),
      },
      transactionId: String(inv.transactionId || "").slice(0, 80),
    },
  };
}

function assertSalesPassword(body) {
  const expected = (process.env.SALES_CONSOLE_PASSWORD || "").trim();
  if (!expected) return { ok: false, error: "Server misconfiguration: SALES_CONSOLE_PASSWORD not set" };
  const got = String(body.salesConsolePassword || "").trim();
  try {
    const a = Buffer.from(got, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Unauthorized" };
    }
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

/**
 * Buyer-facing endpoints must not trust licenseId alone or anonymous tokens.
 * @param {{ requireAdmin?: boolean, skipAuthIndex?: boolean }} opts
 */
async function assertBuyerLicenseAccess(body, licenseSnap, opts = {}) {
  const requireAdmin = !!opts.requireAdmin;
  const skipAuthIndex = !!opts.skipAuthIndex;
  const idToken = String(body?.idToken || "").trim();
  if (!idToken) {
    return { ok: false, status: 401, error: "idToken required — sign in to the licensed app Firebase project" };
  }
  if (!licenseSnap || !licenseSnap.exists) {
    return { ok: false, status: 404, error: "License not found" };
  }
  const d = licenseSnap.data() || {};
  if (String(d.status || "") === "revoked") {
    return { ok: false, status: 403, error: "License revoked" };
  }
  if (d.appSuspended) {
    return { ok: false, status: 403, error: "License suspended by provider" };
  }
  const cfg = resolveLicenseTenantConfig(d);
  if (!cfg?.apiKey || !cfg?.projectId) {
    return { ok: false, status: 503, error: "License has no tenant Firebase config" };
  }
  const verified = await verifyTenantIdToken(cfg.apiKey, idToken);
  if (!verified?.localId) {
    return { ok: false, status: 401, error: "Invalid or expired idToken for this license" };
  }
  if (verified.isAnonymous) {
    return { ok: false, status: 401, error: "Anonymous auth is not allowed for this action — sign in with your app account" };
  }

  if (skipAuthIndex && !requireAdmin) {
    return { ok: true, uid: verified.localId, licenseData: d, authIndex: null, tenantConfig: cfg };
  }

  let authIndex = null;
  try {
    authIndex = await fetchTenantAuthIndex(cfg.projectId, idToken, verified.localId);
  } catch {
    authIndex = null;
  }
  if (!authIndex || !authIndex.kind) {
    return {
      ok: false,
      status: 403,
      error: "No authIndex for this user — complete app login so the server can verify your role",
    };
  }
  if (requireAdmin) {
    const role = String(authIndex.role || "");
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { ok: false, status: 403, error: "Admin or manager role required" };
    }
  }
  return {
    ok: true,
    uid: verified.localId,
    licenseData: d,
    authIndex,
    tenantConfig: cfg,
  };
}

/** Keep in sync with utils/licenseRemotePolicy.ts REMOTE_CONTROLLABLE_NAV paths */
const REMOTE_BLOCKABLE_PATHS = new Set([
  "/entry",
  "/bulk-rent",
  "/history",
  "/contracts",
  "/tasks",
  "/calendar",
  "/approvals",
  "/customers",
  "/directory",
  "/registry",
  "/properties",
  "/vendors",
  "/service-agreements",
  "/monitoring",
  "/vat-report",
  "/accounting",
  "/transfers",
  "/borrowings",
  "/owner-portal",
  "/owner-expense",
  "/staff",
  "/stocks",
  "/ejar",
  "/municipality-licenses",
  "/civil-defense",
  "/absher",
  "/sadad",
  "/utilities",
  "/security-deposits",
  "/whatsapp",
  "/bank-reconciliation",
  "/settings",
  "/admin/employees",
  "/admin/settings",
  "/admin/bulk-import",
  "/admin/backup",
  "/help",
  "/about",
]);

function normalizeRemotePath(x) {
  let p = String(x || "").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  const q = p.split("?")[0] || "/";
  if (q.length > 1 && q.endsWith("/")) return q.slice(0, -1) || "/";
  return q || "/";
}

function sanitizeDisabledNavPaths(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const p = normalizeRemotePath(x);
    if (REMOTE_BLOCKABLE_PATHS.has(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

async function handleCreate(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("salesAuth", ip, 30, 60_000))) {
    return res.status(429).json({ error: "Too many sales API attempts" });
  }

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const plainKey = normalizePlainProductKey(body.plainKey);
  if (!plainKey) {
    return res.status(400).json({ error: "plainKey required" });
  }
  if (plainKey.length < 24) {
    return res.status(400).json({ error: "plainKey must be at least 24 characters" });
  }

  const tenantFirebaseConfig = tenantConfigShape(body.tenantFirebaseConfig) || tenantConfigShape(UNIFIED_FIREBASE_WEB_CONFIG);
  if (!tenantFirebaseConfig) {
    return res.status(500).json({
      error: "Server misconfiguration: unified Firebase web config is invalid",
    });
  }

  const label = String(body.label || "").trim() || "Unlabeled";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  const db = getFirestore();
  const licenseId = licenseKeyHash(plainKey);
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (snap.exists) {
    return res.status(409).json({ error: "A license with this key hash already exists (regenerate a new key)" });
  }

  const keyHint = plainKey.slice(-4);
  let giftCipher;
  try {
    giftCipher = encryptPlainKeyForGift(plainKey);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Could not store gift encryption payload" });
  }
  await ref.set({
    tenantFirebaseConfig,
    unifiedProject: true,
    status: "issued",
    label,
    notes,
    keyHint,
    giftCipher,
    appSuspended: false,
    disabledNavPaths: [],
    createdAt: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({ ok: true, licenseId, keyHint });
}

async function handleList(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const db = getFirestore();
  const q = await db.collection(COLLECTION).limit(200).get();
  const items = [];
  q.forEach((doc) => {
    const d = doc.data();
    const cfg = d.tenantFirebaseConfig || {};
    const presence = summarizePresence(d.presenceDevices);
    items.push({
      licenseId: doc.id,
      status: d.status || "unknown",
      label: d.label || "",
      notes: d.notes || "",
      keyHint: d.keyHint || "",
      projectId: cfg.projectId || "",
      createdAt: d.createdAt?.toMillis?.() ?? null,
      activatedAt: d.activatedAt?.toMillis?.() ?? null,
      activatedGoogleUid: d.activatedGoogleUid || null,
      activatedPhone: d.activatedPhone || null,
      activatedEmail: d.activatedEmail || "",
      teamCodeHint: d.teamCode ? String(d.teamCode).slice(-4) : "",
      hasGiftCipher: !!(d.giftCipher && typeof d.giftCipher === "object"),
      appSuspended: !!d.appSuspended,
      disabledNavPaths: sanitizeDisabledNavPaths(d.disabledNavPaths),
      sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
      sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
      ...salesAiStaffFields(d),
      isLive: presence.isLive,
      liveDeviceCount: presence.liveDeviceCount,
      lastSeenMs: presence.lastSeenMs,
      lastSeenPath: presence.lastSeenPath,
    });
  });
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return res.status(200).json({ ok: true, items, aiStaffPriceSarMonth: AI_STAFF_PRICE_SAR_MONTH });
}

async function handlePresence(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!isValidLicenseId(licenseId)) return res.status(400).json({ error: "licenseId required" });

  const deviceId = sanitizePresenceDeviceId(body.deviceId);
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("presence", `${licenseId}:${deviceId}`, 4, 60_000))) {
    return res.status(429).json({ error: "Presence rate limit — max 4 heartbeats/minute per device" });
  }
  if (!(await consumeRateLimit("presence_ip", ip, 120, 60_000))) {
    return res.status(429).json({ error: "Too many presence requests from this network" });
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  // Skip authIndex fetch on heartbeats (Identity Toolkit still verifies non-anonymous token).
  const access = await assertBuyerLicenseAccess(body, snap, { skipAuthIndex: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const state = String(body.state || "active").trim().toLowerCase() === "offline" ? "offline" : "active";
  const now = Date.now();
  const d = access.licenseData || {};

  const existing = d.presenceDevices && typeof d.presenceDevices === "object" ? d.presenceDevices : {};
  const entries = Object.entries(existing)
    .filter(([, entry]) => entry && typeof entry === "object" && Number(entry.lastSeenMs) > now - PRESENCE_PRUNE_MS)
    .sort((a, b) => (Number(b[1]?.lastSeenMs) || 0) - (Number(a[1]?.lastSeenMs) || 0))
    .slice(0, 40);
  const devices = Object.fromEntries(entries);
  devices[deviceId] = {
    lastSeenMs: now,
    lastPath: sanitizePresencePath(body.path || ""),
    online: state !== "offline",
    userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
  };

  await ref.set(
    {
      presenceDevices: devices,
      lastPresenceAt: FieldValue.serverTimestamp(),
      lastPresenceMs: now,
      lastPresencePath: devices[deviceId].lastPath,
      lastPresenceOnline: state !== "offline",
    },
    { merge: true }
  );

  return res.status(200).json({ ok: true, liveWindowMs: LIVE_PRESENCE_MS });
}

async function handleRevoke(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  await ref.set(
    {
      status: "revoked",
      revokedAt: FieldValue.serverTimestamp(),
      redeemNonce: FieldValue.delete(),
      redeemNonceExpiresAt: FieldValue.delete(),
      teamCode: FieldValue.delete(),
    },
    { merge: true }
  );
  return res.status(200).json({ ok: true });
}

async function handleRedeem(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("redeem", ip, 10, 60_000))) {
    return res.status(429).json({ error: "Too many redeem attempts. Try again in a minute." });
  }

  const body = req.body || {};
  const plainKey = normalizePlainProductKey(body.plainKey);
  if (!plainKey) return res.status(400).json({ error: "plainKey required" });

  const licenseId = licenseKeyHash(plainKey);
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(400).json({ error: "Invalid or unknown product key" });
  }
  const d = snap.data();
  if (d.status === "revoked") {
    return res.status(400).json({ error: "This product key has been revoked" });
  }

  const tenantFirebaseConfig = tenantConfigShape(d.tenantFirebaseConfig);
  if (!tenantFirebaseConfig) {
    return res.status(500).json({ error: "License record is corrupted" });
  }

  const redeemNonce = randomNonce();
  const redeemNonceExpiresAt = Date.now() + REDEEM_TTL_MS;
  await ref.set(
    {
      redeemNonce,
      redeemNonceExpiresAt,
      lastRedeemAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return res.status(200).json({
    ok: true,
    licenseId,
    redeemNonce,
    redeemNonceExpiresAt,
    tenantFirebaseConfig,
  });
}

async function handleComplete(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  if (!(await consumeRateLimit("complete", ip, 10, 60_000))) {
    return res.status(429).json({ error: "Too many activation attempts. Try again in a minute." });
  }
  if (!(await consumeRateLimit("completeDay", ip, 40, 24 * 60 * 60 * 1000))) {
    return res.status(429).json({ error: "Daily activation cap reached for this network." });
  }

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  const redeemNonce = String(body.redeemNonce || "").trim();
  const idToken = String(body.idToken || "").trim();
  const contactEmailRaw = String(body.contactEmail || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();

  if (!licenseId || !redeemNonce) {
    return res.status(400).json({
      code: "MISSING_LICENSE_OR_NONCE",
      error: "licenseId and redeemNonce are required",
    });
  }
  if (phone && (phone.length < 8 || phone.length > 40)) {
    return res.status(400).json({ code: "PHONE_INVALID", error: "phone looks invalid" });
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(400).json({ code: "INVALID_LICENSE", error: "Invalid license" });
  }
  const d = snap.data();
  if (d.status === "revoked") {
    return res.status(400).json({ code: "LICENSE_REVOKED", error: "License revoked" });
  }

  const storedNonce = d.redeemNonce != null ? String(d.redeemNonce) : "";
  if (d.status === "active" && !storedNonce && redeemNonce) {
    return res.status(400).json({
      code: "NO_PENDING_REDEEM",
      error:
        "This product key is already activated. Choose “We already set up” and enter your company code, or verify the key again on the first step to start a fresh session.",
    });
  }
  if (!storedNonce) {
    return res.status(400).json({
      code: "REDEEM_REQUIRED",
      error: "Verify your product key first (Continue on the key step), then finish within 15 minutes.",
    });
  }
  if (storedNonce !== redeemNonce) {
    const expProbe = Number(d.redeemNonceExpiresAt) || 0;
    if (expProbe && expProbe < Date.now()) {
      return res.status(400).json({
        code: "REDEEM_EXPIRED",
        error: "Redeem session expired — verify your product key again and complete within 15 minutes.",
      });
    }
    return res.status(400).json({
      code: "REDEEM_NONCE_MISMATCH",
      error: "Invalid redeem session — go back, verify your product key again (Continue), then finish activation.",
    });
  }
  const exp = Number(d.redeemNonceExpiresAt) || 0;
  if (exp < Date.now()) {
    return res.status(400).json({
      code: "REDEEM_EXPIRED",
      error: "Redeem session expired — verify your product key again and complete within 15 minutes.",
    });
  }

  const tenantFirebaseConfig = tenantConfigShape(d.tenantFirebaseConfig);
  if (!tenantFirebaseConfig) {
    return res.status(500).json({ error: "License record is corrupted" });
  }

  let activatedGoogleUid = null;
  let activatedEmail = "";

  // Activation must prove control of the buyer's own Firebase project. The old
  // email-only path let anyone holding a stolen product key seed themselves as ADMIN.
  if (!idToken && !ALLOW_LEGACY_EMAIL_ACTIVATION) {
    return res.status(401).json({
      code: "ID_TOKEN_REQUIRED",
      error:
        "Activation requires a Firebase sign-in on your own project. Update the app to the latest version and try again.",
    });
  }

  if (idToken) {
    const verified = await verifyTenantIdToken(tenantFirebaseConfig.apiKey, idToken);
    if (!verified) {
      return res.status(401).json({ error: "Invalid Firebase sign-in for this buyer's project" });
    }
    if (verified.isAnonymous) {
      return res.status(401).json({
        error:
          "Anonymous sign-in cannot activate a license. Sign in with email/password or Google on your own Firebase project.",
      });
    }
    const uid = verified.localId;
    if (d.status === "active" && d.activatedGoogleUid && d.activatedGoogleUid !== uid) {
      return res.status(403).json({ error: "This key is already bound to another account" });
    }
    activatedGoogleUid = uid;
    activatedEmail = typeof verified.email === "string" ? verified.email.trim() : "";
  } else {
    if (!contactEmailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmailRaw)) {
      return res.status(400).json({
        code: "CONTACT_EMAIL_INVALID",
        error:
          "Send a valid contactEmail and adminPasswordPlain, or send idToken from Firebase Auth on the tenant project.",
      });
    }
    if (d.status === "active" && d.activatedEmail && String(d.activatedEmail).toLowerCase() !== contactEmailRaw) {
      return res.status(403).json({ error: "This license is already activated with a different email" });
    }
    activatedEmail = contactEmailRaw;
    activatedGoogleUid = null;
  }

  let teamCode = typeof d.teamCode === "string" && d.teamCode.length >= 8 ? String(d.teamCode).toUpperCase() : null;
  if (!teamCode) {
    teamCode = generateTeamCode();
  }
  teamCode = String(teamCode).toUpperCase();

  let serverSeededAdmin = false;
  if (ALLOW_LEGACY_EMAIL_ACTIVATION && !idToken && contactEmailRaw) {
    const plainPw = String(body.adminPasswordPlain || "").trim();
    if (plainPw.length < 6) {
      return res.status(400).json({
        code: "ADMIN_PASSWORD_REQUIRED",
        error: "adminPasswordPlain is required (min 6 characters) for activation",
      });
    }
    const displayName =
      String(body.adminDisplayName || body.displayName || "")
        .trim()
        .slice(0, 120) || contactEmailRaw.split("@")[0];
    const registryPid = getRegistryFirestoreProjectId();
    const tenantPid = String(tenantFirebaseConfig.projectId || "").trim();
    if (registryPid && tenantPid && registryPid === tenantPid) {
      const hashedPass = hashPasswordSha256Hex(plainPw);
      const userDoc = {
        id: contactEmailRaw,
        name: displayName,
        role: "ADMIN",
        status: "Active",
        hasSystemAccess: true,
        password: hashedPass,
        createdAt: new Date().toISOString(),
        welcomePending: true,
      };
      const usersCollection = teamCode ? `book_${teamCode}_users` : "users";
      await db.collection(usersCollection).doc(contactEmailRaw).set(userDoc, { merge: true });
      if (teamCode) {
        await db.collection("books").doc(teamCode).set({
          id: teamCode,
          name: String(d.label || teamCode).slice(0, 120),
          teamCode,
          licenseId: ref.id,
          createdAt: Date.now(),
        }, { merge: true });
      }
      serverSeededAdmin = true;
    }
  }

  await ref.set(
    {
      status: "active",
      activatedGoogleUid: activatedGoogleUid || null,
      activatedPhone: phone || "",
      activatedEmail,
      activatedAt: FieldValue.serverTimestamp(),
      redeemNonce: FieldValue.delete(),
      redeemNonceExpiresAt: FieldValue.delete(),
      teamCode,
      bookId: teamCode,
    },
    { merge: true }
  );

  return res.status(200).json({ ok: true, activatedGoogleUid, activatedEmail, teamCode, bookId: teamCode, serverSeededAdmin });
}

async function handleResolveJoin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const raw = String(body.teamCode || body.joinCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const joinPin = String(body.joinPin || body.pin || "").trim();

  // Deliberately identical message for every failure: no oracle telling an attacker
  // whether a code exists, is revoked, or just needs a PIN.
  const GENERIC_FAIL = { code: "JOIN_REJECTED", error: "Company code not accepted. Check with your company admin." };

  const ip = clientIp(req);
  // Per-IP burst + daily ceiling, so codes cannot be enumerated from one host.
  if (!(await consumeRateLimit("resolveJoin", ip, 20, 60_000))) {
    return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
  }
  if (!(await consumeRateLimit("resolveJoinDay", ip, 120, 24 * 60 * 60 * 1000))) {
    return res.status(429).json({ error: "Daily limit reached for this network." });
  }
  if (raw.length < 8) {
    await consumeRateLimit("resolveJoinFail", ip, 25, 60 * 60 * 1000);
    return res.status(400).json(GENERIC_FAIL);
  }
  // Per-code ceiling: one leaked code cannot be farmed at scale.
  if (!(await consumeRateLimit("resolveJoinCode2", raw, 80, 60 * 60 * 1000))) {
    return res.status(429).json({ error: "This company code is temporarily locked. Try again later." });
  }

  const db = getFirestore();
  const qs = await db.collection(COLLECTION).where("teamCode", "==", raw).limit(1).get();

  const failClosed = async () => {
    // Wrong/unknown codes burn a failure budget → brute force gets locked out per IP.
    const stillAllowed = await consumeRateLimit("resolveJoinFail", ip, 25, 60 * 60 * 1000);
    if (!stillAllowed) {
      return res.status(429).json({ error: "Too many invalid codes from this network. Try again later." });
    }
    return res.status(400).json(GENERIC_FAIL);
  };

  if (qs.empty) return failClosed();

  const doc = qs.docs[0];
  const d = doc.data();
  if (d.status !== "active") return failClosed();

  // Optional per-license join PIN (set from Sales Console) for buyers who want
  // the company code alone to be useless.
  const expectedPin = String(d.joinPin || "").trim();
  if (expectedPin && joinPin !== expectedPin) return failClosed();

  const tenantFirebaseConfig = resolveLicenseTenantConfig(d);
  if (!tenantFirebaseConfig) {
    return res.status(500).json({ error: "License record is corrupted" });
  }
  const bookId = resolveLicenseBookId(d);

  await db
    .collection("_server")
    .doc("joinAudit")
    .collection("events")
    .add({
      licenseId: doc.id,
      teamCode: raw,
      ip,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      at: Date.now(),
    })
    .catch(() => {});

  return res.status(200).json({
    ok: true,
    licenseId: doc.id,
    tenantFirebaseConfig,
    teamCode: raw,
    bookId: bookId || raw,
    sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
    sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
  });
}

function sanitizeSadadBillerCode(raw) {
  return String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 20);
}

function sanitizeSadadBillerLabel(raw) {
  return String(raw || "").trim().slice(0, 80);
}

async function handleGetPolicy(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("getPolicy", `${licenseId}:${ip}`, 30, 60_000))) {
    return res.status(429).json({ error: "Too many policy checks. Try again shortly." });
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(200).json({
      ok: true,
      appSuspended: true,
      disabledNavPaths: [],
      licenseStatus: "missing",
      aiStaffEnabled: false,
      aiStaffPaused: false,
      aiStaffActive: false,
    });
  }
  const d = snap.data();
  const status = d.status || "unknown";
  if (status === "revoked") {
    return res.status(200).json({
      ok: true,
      appSuspended: true,
      disabledNavPaths: [],
      licenseStatus: "revoked",
      aiStaffEnabled: false,
      aiStaffPaused: false,
      aiStaffActive: false,
    });
  }
  const appSuspended = !!d.appSuspended;
  const disabledNavPaths = sanitizeDisabledNavPaths(d.disabledNavPaths);
  const killOn = await registryKillSwitchOn();
  const aiStaff = publicAiStaffFlagsWithKill(d, killOn);
  return res.status(200).json({
    ok: true,
    appSuspended,
    disabledNavPaths,
    licenseStatus: status,
    sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
    sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
    aiStaffEnabled: aiStaff.aiStaffEnabled,
    aiStaffPaused: aiStaff.aiStaffPaused,
    aiStaffActive: aiStaff.aiStaffActive,
  });
}

async function handleUpdatePolicy(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  const patch = { policyUpdatedAt: FieldValue.serverTimestamp() };
  let hasField = false;
  if (typeof body.appSuspended === "boolean") {
    patch.appSuspended = body.appSuspended;
    hasField = true;
  }
  if (Array.isArray(body.disabledNavPaths)) {
    patch.disabledNavPaths = sanitizeDisabledNavPaths(body.disabledNavPaths);
    hasField = true;
  }
  if (body.sadadBillerCode !== undefined) {
    patch.sadadBillerCode = sanitizeSadadBillerCode(body.sadadBillerCode);
    hasField = true;
  }
  if (body.sadadBillerLabel !== undefined) {
    patch.sadadBillerLabel = sanitizeSadadBillerLabel(body.sadadBillerLabel);
    hasField = true;
  }
  const aiPatch = buildAiStaffPolicyPatch(body);
  if (aiPatch.hasField) {
    Object.assign(patch, aiPatch.patch);
    hasField = true;
  }
  if (!hasField) {
    return res.status(400).json({
      error: "Provide appSuspended, disabledNavPaths, SADAD biller, and/or AI Staff fields",
    });
  }
  await ref.set(patch, { merge: true });
  const d = (await ref.get()).data();
  const aiStaff = salesAiStaffFields(d);
  return res.status(200).json({
    ok: true,
    appSuspended: !!d.appSuspended,
    disabledNavPaths: sanitizeDisabledNavPaths(d.disabledNavPaths),
    sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
    sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
    ...aiStaff,
  });
}

function isValidLicenseId(licenseId) {
  return /^[a-f0-9]{64}$/i.test(String(licenseId || "").trim());
}

function sanitizePresenceDeviceId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return "";
  return id;
}

function sanitizePresencePath(value) {
  const raw = String(value || "/").trim().slice(0, 160);
  if (!raw) return "/";
  return raw.startsWith("/") || raw.startsWith("#") ? raw : `/${raw}`;
}

function summarizePresence(presenceDevices) {
  const now = Date.now();
  const devices = presenceDevices && typeof presenceDevices === "object" ? presenceDevices : {};
  let liveDeviceCount = 0;
  let lastSeenMs = 0;
  let lastSeenPath = "";
  for (const entry of Object.values(devices)) {
    if (!entry || typeof entry !== "object") continue;
    const seen = Number(entry.lastSeenMs) || 0;
    if (seen > lastSeenMs) {
      lastSeenMs = seen;
      lastSeenPath = String(entry.lastPath || "");
    }
    if (entry.online !== false && seen > now - LIVE_PRESENCE_MS) {
      liveDeviceCount += 1;
    }
  }
  return {
    liveDeviceCount,
    isLive: liveDeviceCount > 0,
    lastSeenMs: lastSeenMs || null,
    lastSeenPath,
  };
}

async function handleGetZatcaConfig(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });
  const snap = await getFirestore().collection(COLLECTION).doc(licenseId).get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });
  return res.status(200).json({ ok: true, zatca: await publicZatcaConfigAsync(snap.data() || {}) });
}

async function handleSaveZatcaConfig(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const ref = getFirestore().collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  if (body.clear === true) {
    await ref.set(
      {
        zatcaConfig: {
          enabled: false,
          credentials: FieldValue.delete(),
          vatNumber: "",
          vatName: "",
          mode: "compliance",
          pih: FieldValue.delete(),
          counter: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    const d = (await ref.get()).data() || {};
    return res.status(200).json({ ok: true, zatca: await publicZatcaConfigAsync(d) });
  }

  const enabled = body.enabled !== false;
  const credentials = normalizeZatcaCredentials(body.credentials || body);
  const validation = validateZatcaCredentials(credentials);
  if (enabled && validation) return res.status(400).json({ error: validation });
  const encrypted = encryptZatcaCredentials(credentials);
  const mode = credentials.productionCert && credentials.productionSecret ? "production" : "compliance";
  const previous = snap.data()?.zatcaConfig || {};
  const expiry = certExpiryMeta(credentials);
  await ref.set(
    {
      zatcaConfig: {
        enabled,
        credentials: encrypted,
        vatNumber: credentials.egsInfo.VAT_number,
        vatName: credentials.egsInfo.VAT_name,
        mode,
        pih: String(previous.pih || INITIAL_ZATCA_PIH),
        counter: Number(previous.counter) || 1,
        certExpiresAt: expiry.certExpiresAt,
        certSource: expiry.certSource,
        updatedAt: FieldValue.serverTimestamp(),
        lastStatus: null,
      },
    },
    { merge: true }
  );
  const d = (await ref.get()).data() || {};
  return res.status(200).json({ ok: true, zatca: await publicZatcaConfigAsync(d) });
}

const INITIAL_ZATCA_PIH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

const ZATCA_SIGN_LOCK_TTL_MS = 90_000;
const ZATCA_STUCK_JOB_MS = 5 * 60_000;
const ZATCA_WORKER_HEALTHY_MS = 3 * 60_000;

function isZatcaHttpAccepted(status) {
  const n = Number(status);
  return Number.isFinite(n) && n >= 200 && n < 300;
}

/** Parse Not After from a PEM (handles ZATCA double-base64 BST bodies when possible). */
function parseCertExpiryIso(pem) {
  const raw = String(pem || "").trim();
  if (!raw) return null;
  try {
    const { X509Certificate } = crypto;
    if (!X509Certificate) return null;
    let tryPem = raw;
    if (!tryPem.includes("BEGIN CERTIFICATE")) {
      tryPem = `-----BEGIN CERTIFICATE-----\n${tryPem}\n-----END CERTIFICATE-----`;
    }
    try {
      const c = new X509Certificate(tryPem);
      return new Date(c.validTo).toISOString();
    } catch {
      // ZATCA BST is often base64(base64(DER)) — unwrap once
      const body = tryPem
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s+/g, "");
      const once = Buffer.from(body, "base64");
      const der = once.toString("utf8").match(/^[A-Za-z0-9+/=]+$/)
        ? Buffer.from(once.toString("utf8"), "base64")
        : once;
      const wrapped = `-----BEGIN CERTIFICATE-----\n${der.toString("base64")}\n-----END CERTIFICATE-----`;
      const c2 = new X509Certificate(wrapped);
      return new Date(c2.validTo).toISOString();
    }
  } catch {
    return null;
  }
}

function certExpiryMeta(credentials) {
  const prod = parseCertExpiryIso(credentials.productionCert);
  const compliance = parseCertExpiryIso(credentials.complianceCert);
  const iso = prod || compliance || null;
  if (!iso) return { certExpiresAt: null, certExpired: false, certExpiresInDays: null, certSource: null };
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return {
    certExpiresAt: iso,
    certExpired: ms < 0,
    certExpiresInDays: days,
    certSource: prod ? "production" : "compliance",
  };
}

function assertCertNotExpired(credentials) {
  const meta = certExpiryMeta(credentials);
  if (meta.certExpired) {
    const err = new Error(
      `ZATCA ${meta.certSource || "CSID"} certificate expired on ${meta.certExpiresAt}. Renew in Fatoora and paste new credentials in Sales Console.`
    );
    err.code = "ZATCA_CERT_EXPIRED";
    throw err;
  }
  return meta;
}

async function touchZatcaWorkerHeartbeat() {
  await getFirestore()
    .collection("_server")
    .doc("zatcaWorker")
    .set({ heartbeatAt: FieldValue.serverTimestamp(), host: String(process.env.HOSTNAME || "").slice(0, 120) }, { merge: true })
    .catch(() => {});
}

async function readZatcaWorkerHealth() {
  try {
    const snap = await getFirestore().collection("_server").doc("zatcaWorker").get();
    const at = snap.exists ? snap.data()?.heartbeatAt?.toMillis?.() : null;
    const age = at ? Date.now() - at : null;
    return {
      workerLastSeenMs: at || null,
      workerHealthy: age != null && age < ZATCA_WORKER_HEALTHY_MS,
      workerAgeMs: age,
    };
  } catch {
    return { workerLastSeenMs: null, workerHealthy: false, workerAgeMs: null };
  }
}

async function acquireZatcaSignLock(licenseId) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const lockId = crypto.randomBytes(12).toString("hex");
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("License not found");
    const z = snap.data()?.zatcaConfig || {};
    const lock = z.signingLock || {};
    const lockedAt = Number(lock.lockedAt) || 0;
    if (lock.lockId && lockedAt && now - lockedAt < ZATCA_SIGN_LOCK_TTL_MS) {
      const err = new Error("Another ZATCA invoice is being signed for this buyer. Wait a moment and retry.");
      err.code = "ZATCA_BUSY";
      throw err;
    }
    tx.set(
      ref,
      {
        zatcaConfig: {
          signingLock: { lockId, lockedAt: now },
        },
      },
      { merge: true }
    );
  });
  return { ref, lockId };
}

async function releaseZatcaSignLock(ref, lockId) {
  try {
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const lock = snap.data()?.zatcaConfig?.signingLock || {};
      if (lock.lockId && lock.lockId !== lockId) return;
      tx.set(ref, { zatcaConfig: { signingLock: FieldValue.delete() } }, { merge: true });
    });
  } catch {
    /* best effort */
  }
}

async function callZatcaSigningService(payload) {
  const base = String(process.env.ZATCA_SIGNING_SERVICE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.ZATCA_SIGNING_SERVICE_KEY || "").trim();
  if (!base) throw new Error("ZATCA_SIGNING_SERVICE_URL is not set");
  if (!key) throw new Error("ZATCA_SIGNING_SERVICE_KEY is not set");
  let r;
  try {
    r = await fetch(`${base}/zatca/tenant/sign-and-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zatca-Api-Key": key,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const err = new Error(`ZATCA signing service unavailable: ${e?.message || e}`);
    err.zatcaUnavailable = true;
    throw err;
  }
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`ZATCA signing service returned non-JSON (${r.status})`);
  }
  if (!r.ok) {
    const err = new Error(data?.error || `ZATCA signing service error ${r.status}`);
    err.zatcaStatus = data?.zatcaStatus;
    err.zatcaResponse = data?.zatcaResponse;
    // 502 from signer = Fatoora rejected — service is up, do not queue as "offline"
    if (r.status === 502 || data?.accepted === false) {
      err.zatcaRejected = true;
    }
    if (r.status >= 500 && r.status !== 502 && /unavailable|ECONNREFUSED|timeout/i.test(String(data?.error || ""))) {
      err.zatcaUnavailable = true;
    }
    throw err;
  }
  return data;
}

function isZatcaSigningUnavailable(error) {
  if (error?.zatcaUnavailable) return true;
  if (error?.zatcaRejected) return false;
  const msg = String(error?.message || error || "");
  return /unavailable|failed to fetch|network|timeout|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(msg);
}

async function queueZatcaJob({ licenseId, invoice, reason }) {
  const db = getFirestore();
  const ref = db.collection(ZATCA_JOB_COLLECTION).doc();
  await ref.set({
    licenseId,
    invoice,
    status: "pending",
    attempts: 0,
    reason: String(reason || "").slice(0, 500),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function loadLicenseZatcaContext(licenseId) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("License not found");
  const d = snap.data() || {};
  if (String(d.status || "") !== "active") throw new Error("License is not active");
  const z = d.zatcaConfig || {};
  if (!z.enabled || !z.credentials) {
    throw new Error("ZATCA is not configured for this buyer. Configure it in Sales Console.");
  }
  return { ref, data: d, zatca: z, credentials: decryptZatcaCredentials(z.credentials) };
}

/**
 * Sign+report with per-license lock. Advances PIH/counter ONLY when Fatoora accepts.
 */
async function signAndStoreZatcaResult(licenseId, invoice) {
  const { ref, lockId } = await acquireZatcaSignLock(licenseId);
  try {
    const { zatca, credentials } = await loadLicenseZatcaContext(licenseId);
    assertCertNotExpired(credentials);

    const data = await callZatcaSigningService({
      credentials,
      invoice,
      state: {
        previousInvoiceHash: String(zatca.pih || INITIAL_ZATCA_PIH),
        counter: Number(zatca.counter) || 1,
      },
    });

    const accepted = data?.accepted === true || (data?.success === true && isZatcaHttpAccepted(data?.zatcaStatus));
    if (!accepted) {
      const err = new Error(
        data?.error || `ZATCA did not accept this invoice (HTTP ${data?.zatcaStatus || "unknown"})`
      );
      err.zatcaRejected = true;
      err.zatcaStatus = data?.zatcaStatus;
      err.zatcaResponse = data?.zatcaResponse;
      await ref.set(
        {
          zatcaConfig: {
            lastStatus: {
              ok: false,
              accepted: false,
              zatcaStatus: Number(data?.zatcaStatus) || 0,
              at: new Date().toISOString(),
              error: String(err.message).slice(0, 400),
            },
            signingLock: FieldValue.delete(),
          },
        },
        { merge: true }
      );
      throw err;
    }

    const nextCounter = Number(data.nextCounter || data.counter + 1) || (Number(zatca.counter) || 1) + 1;
    const newPih = String(data.invoice_hash || data.invoiceHash || "").trim();
    await ref.set(
      {
        zatcaConfig: {
          pih: newPih || String(zatca.pih || INITIAL_ZATCA_PIH),
          counter: nextCounter,
          lastStatus: {
            ok: true,
            accepted: true,
            zatcaStatus: Number(data.zatcaStatus) || 200,
            at: new Date().toISOString(),
          },
          lastReportedAt: FieldValue.serverTimestamp(),
          signingLock: FieldValue.delete(),
        },
      },
      { merge: true }
    );
    return {
      nextCounter,
      data: {
        ...data,
        success: true,
        accepted: true,
        reported: true,
        qrCode: data.qrCode,
      },
    };
  } catch (e) {
    try {
      if (e?.zatcaRejected || e?.code === "ZATCA_CERT_EXPIRED") {
        await ref.set(
          {
            zatcaConfig: {
              lastStatus: {
                ok: false,
                accepted: false,
                zatcaStatus: Number(e.zatcaStatus) || 0,
                at: new Date().toISOString(),
                error: String(e?.message || e).slice(0, 400),
              },
            },
          },
          { merge: true }
        );
      }
    } catch {
      /* ignore */
    }
    await releaseZatcaSignLock(ref, lockId);
    throw e;
  }
}

async function handleBuyerZatcaSignReport(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const licSnap = await getFirestore().collection(COLLECTION).doc(licenseId).get();
  const access = await assertBuyerLicenseAccess(body, licSnap, { requireAdmin: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (String(access.licenseData?.status || "") !== "active") {
    return res.status(403).json({ error: "License is not active" });
  }

  const ip = clientIp(req);
  if (!(await consumeRateLimit("zatcaReport", `${licenseId}:${ip}`, 15, 60_000))) {
    return res.status(429).json({ error: "Too many ZATCA requests. Try again in a minute." });
  }
  if (!(await consumeRateLimit("zatcaReportDay", licenseId, 200, 24 * 60 * 60 * 1000))) {
    return res.status(429).json({ error: "Daily ZATCA signing cap reached for this license (200/day)." });
  }

  const rawInvoice = body.invoice && typeof body.invoice === "object" ? body.invoice : body;
  const sanitized = sanitizeZatcaInvoicePayload(rawInvoice);
  if (!sanitized.ok) return res.status(400).json({ error: sanitized.error });
  const invoice = sanitized.invoice;
  try {
    const { data } = await signAndStoreZatcaResult(licenseId, invoice);
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    if (e?.code === "ZATCA_BUSY") {
      return res.status(409).json({ error: e.message, code: "ZATCA_BUSY" });
    }
    if (e?.code === "ZATCA_CERT_EXPIRED" || e?.zatcaRejected) {
      return res.status(502).json({
        ok: false,
        accepted: false,
        reported: false,
        error: e.message,
        code: e.code || "ZATCA_REJECTED",
        zatcaStatus: e.zatcaStatus || 0,
      });
    }
    if (!isZatcaSigningUnavailable(e)) throw e;
    const jobId = await queueZatcaJob({ licenseId, invoice, reason: e?.message || "Signing service unavailable" });
    const worker = await readZatcaWorkerHealth();
    return res.status(200).json({
      ok: true,
      queued: true,
      jobId,
      accepted: false,
      reported: false,
      message: worker.workerHealthy
        ? "ZATCA signing briefly unavailable. Queued — the worker should pick it up shortly."
        : "ZATCA signing server looks offline (no recent worker heartbeat). Invoice queued; it will send when the Mac mini / signer is back.",
      workerHealthy: worker.workerHealthy,
      workerLastSeenMs: worker.workerLastSeenMs,
    });
  }
}

async function handleBuyerZatcaJobStatus(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!licenseId || !jobId) return res.status(400).json({ error: "licenseId and jobId required" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("zatcaJobStatus", `${licenseId}:${ip}`, 60, 60_000))) {
    return res.status(429).json({ error: "Too many ZATCA status polls" });
  }

  const licSnap = await getFirestore().collection(COLLECTION).doc(licenseId).get();
  const access = await assertBuyerLicenseAccess(body, licSnap, { requireAdmin: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const snap = await getFirestore().collection(ZATCA_JOB_COLLECTION).doc(jobId).get();
  if (!snap.exists) return res.status(404).json({ error: "ZATCA job not found" });
  const d = snap.data() || {};
  if (String(d.licenseId || "") !== licenseId) return res.status(403).json({ error: "Job does not belong to this license" });
  return res.status(200).json({
    ok: true,
    jobId,
    status: d.status || "unknown",
    attempts: Number(d.attempts) || 0,
    error: d.error || "",
    result: d.result || null,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  });
}

function assertZatcaWorkerKey(req) {
  const expected = String(process.env.ZATCA_SIGNING_SERVICE_KEY || "").trim();
  const got = String(req.headers["x-zatca-api-key"] || req.headers["authorization"] || req.body?.workerKey || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  return !!expected && got === expected;
}

async function handleProcessZatcaQueue(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!assertZatcaWorkerKey(req)) return res.status(401).json({ error: "Unauthorized" });
  const ip = clientIp(req);
  if (!(await consumeRateLimit("zatcaQueue", ip, 30, 60_000))) {
    return res.status(429).json({ error: "Queue worker rate limit" });
  }
  await touchZatcaWorkerHeartbeat();

  const limit = Math.max(1, Math.min(10, Number(req.body?.limit) || 5));
  const db = getFirestore();

  // Reclaim jobs stuck in "processing" (crash mid-run) so they can retry.
  const stuckCutoff = Date.now() - ZATCA_STUCK_JOB_MS;
  try {
    const stuck = await db.collection(ZATCA_JOB_COLLECTION).where("status", "==", "processing").limit(20).get();
    for (const doc of stuck.docs) {
      const updatedAt = doc.data()?.updatedAt?.toMillis?.() || 0;
      if (!updatedAt || updatedAt < stuckCutoff) {
        await doc.ref.set(
          {
            status: "pending",
            error: "Reclaimed from stuck processing state",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  } catch (e) {
    console.warn("[zatcaQueue] stuck reclaim skipped:", e?.message || e);
  }

  const qs = await db
    .collection(ZATCA_JOB_COLLECTION)
    .where("status", "==", "pending")
    .limit(limit)
    .get();
  const results = [];
  for (const doc of qs.docs) {
    const job = doc.data() || {};
    const attempts = (Number(job.attempts) || 0) + 1;
    await doc.ref.set({ status: "processing", attempts, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    try {
      if (attempts > 12) {
        throw Object.assign(new Error("Too many ZATCA queue attempts"), { zatcaRejected: true });
      }
      const { data } = await signAndStoreZatcaResult(String(job.licenseId || ""), job.invoice || {});
      await doc.ref.set(
        {
          status: "done",
          result: data,
          error: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      results.push({ jobId: doc.id, status: "done" });
    } catch (e) {
      const unavailable = isZatcaSigningUnavailable(e);
      const busy = e?.code === "ZATCA_BUSY";
      await doc.ref.set(
        {
          status: unavailable || busy ? "pending" : "failed",
          error: String(e?.message || e).slice(0, 1000),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      results.push({
        jobId: doc.id,
        status: unavailable || busy ? "pending" : "failed",
        error: e?.message || String(e),
      });
      if (unavailable) break;
    }
  }
  return res.status(200).json({ ok: true, processed: results.length, results });
}

async function handleRegenerateTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  const teamCode = generateTeamCode();
  await ref.set({ teamCode }, { merge: true });
  return res.status(200).json({ ok: true, teamCode });
}

function normalizeTeamCodeInput(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function isValidTeamCode(code) {
  return /^[A-Z2-9]{8,20}$/.test(code);
}

/** Buyer app (admin): read company code for an active license (requires tenant idToken). */
async function handleBuyerGetTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  const access = await assertBuyerLicenseAccess(body, snap, { requireAdmin: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const d = access.licenseData || {};
  if (String(d.status || "") !== "active") {
    return res.status(403).json({ error: "License is not active" });
  }

  const teamCode =
    typeof d.teamCode === "string" && d.teamCode.trim() ? String(d.teamCode).toUpperCase() : "";
  return res.status(200).json({ ok: true, teamCode });
}

/** Buyer app (admin): set a custom company code on an active license. */
async function handleBuyerSetTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  const teamCode = normalizeTeamCodeInput(body.teamCode);
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });
  if (!isValidTeamCode(teamCode)) {
    return res.status(400).json({
      error: "Invalid company code (use 8–20 letters A–Z or digits 2–9, no spaces)",
    });
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  const access = await assertBuyerLicenseAccess(body, snap, { requireAdmin: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (String(access.licenseData?.status || "") !== "active") {
    return res.status(403).json({ error: "License is not active" });
  }

  const clash = await db.collection(COLLECTION).where("teamCode", "==", teamCode).limit(2).get();
  for (const doc of clash.docs) {
    if (doc.id !== licenseId) {
      return res.status(409).json({ error: "Company code already used by another license" });
    }
  }

  await ref.set({ teamCode }, { merge: true });
  return res.status(200).json({ ok: true, teamCode });
}

/** Buyer app (admin): generate a new random company code (replaces the current one). */
async function handleBuyerRegenerateTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  const access = await assertBuyerLicenseAccess(body, snap, { requireAdmin: true });
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (String(access.licenseData?.status || "") !== "active") {
    return res.status(403).json({ error: "License is not active" });
  }

  let teamCode = generateTeamCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    const clash = await db.collection(COLLECTION).where("teamCode", "==", teamCode).limit(1).get();
    if (clash.empty) break;
    teamCode = generateTeamCode();
  }

  await ref.set({ teamCode }, { merge: true });
  return res.status(200).json({ ok: true, teamCode });
}

/** Reveal the current team code for a license (sales-password gated). */
async function handleGetTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  const d = snap.data() || {};
  const teamCode =
    typeof d.teamCode === "string" && d.teamCode.trim() ? String(d.teamCode).toUpperCase() : "";
  return res.status(200).json({ ok: true, teamCode });
}

function giftEncryptionKeyMaterial() {
  return (process.env.GIFT_REVEAL_SECRET || process.env.SALES_CONSOLE_PASSWORD || "").trim();
}

function giftEncryptionKey() {
  const secret = giftEncryptionKeyMaterial();
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encryptPlainKeyForGift(plainKey) {
  const key = giftEncryptionKey();
  if (!key) throw new Error("Server misconfiguration: GIFT_REVEAL_SECRET or SALES_CONSOLE_PASSWORD not set");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plainKey), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

function decryptPlainKeyFromGift(payload) {
  const key = giftEncryptionKey();
  if (!key || !payload) throw new Error("Cannot decrypt gift payload");
  const iv = Buffer.from(String(payload.iv || ""), "base64");
  const tag = Buffer.from(String(payload.tag || ""), "base64");
  const data = Buffer.from(String(payload.data || ""), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function zatcaCredentialsEncryptionKey() {
  const secret = String(process.env.ZATCA_CREDENTIALS_SECRET || "").trim();
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encryptZatcaCredentials(payload) {
  const key = zatcaCredentialsEncryptionKey();
  if (!key) throw new Error("Server misconfiguration: ZATCA_CREDENTIALS_SECRET is not set");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

function decryptZatcaCredentials(payload) {
  const key = zatcaCredentialsEncryptionKey();
  if (!key || !payload) throw new Error("ZATCA credentials are not available");
  const iv = Buffer.from(String(payload.iv || ""), "base64");
  const tag = Buffer.from(String(payload.tag || ""), "base64");
  const data = Buffer.from(String(payload.data || ""), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const text = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(text);
}

function sanitizeZatcaString(value, max = 12000) {
  return String(value || "").trim().slice(0, max);
}

function normalizeZatcaCredentials(body) {
  const egsInfo = body.egsInfo && typeof body.egsInfo === "object" ? body.egsInfo : {};
  const location = egsInfo.location && typeof egsInfo.location === "object" ? egsInfo.location : {};
  return {
    complianceCert: sanitizeZatcaString(body.complianceCert || body.cert),
    complianceSecret: sanitizeZatcaString(body.complianceSecret || body.secret, 4000),
    privateKey: sanitizeZatcaString(body.privateKey, 12000),
    productionCert: sanitizeZatcaString(body.productionCert, 12000),
    productionSecret: sanitizeZatcaString(body.productionSecret, 4000),
    egsInfo: {
      uuid: sanitizeZatcaString(egsInfo.uuid, 240),
      custom_id: sanitizeZatcaString(egsInfo.custom_id || egsInfo.customId, 120),
      model: sanitizeZatcaString(egsInfo.model, 120),
      CRN_number: sanitizeZatcaString(egsInfo.CRN_number || egsInfo.crnNumber, 80),
      VAT_number: sanitizeZatcaString(egsInfo.VAT_number || egsInfo.vatNumber, 80),
      VAT_name: sanitizeZatcaString(egsInfo.VAT_name || egsInfo.vatName, 240),
      branch_name: sanitizeZatcaString(egsInfo.branch_name || egsInfo.branchName, 160),
      branch_industry: sanitizeZatcaString(egsInfo.branch_industry || egsInfo.branchIndustry, 160),
      location: {
        building: sanitizeZatcaString(location.building, 80),
        street: sanitizeZatcaString(location.street, 160),
        city: sanitizeZatcaString(location.city, 120),
        city_subdivision: sanitizeZatcaString(location.city_subdivision || location.citySubdivision, 120),
        plot_identification: sanitizeZatcaString(location.plot_identification || location.plotIdentification, 80),
        postal_zone: sanitizeZatcaString(location.postal_zone || location.postalZone, 40),
      },
    },
  };
}

function validateZatcaCredentials(c) {
  const missing = [];
  if (!c.complianceCert) missing.push("Compliance certificate");
  if (!c.complianceSecret) missing.push("Compliance secret");
  if (!c.privateKey) missing.push("Private key");
  if (!c.egsInfo.uuid) missing.push("EGS UUID");
  if (!c.egsInfo.VAT_number) missing.push("VAT number");
  if (!c.egsInfo.VAT_name) missing.push("VAT name");
  if (missing.length) return missing.join(", ") + " required";
  return "";
}

function publicZatcaConfig(d, workerHealth = null) {
  const z = d.zatcaConfig || {};
  let certExpiresAt = z.certExpiresAt || null;
  let certExpired = false;
  let certExpiresInDays = null;
  if (certExpiresAt) {
    const ms = new Date(certExpiresAt).getTime() - Date.now();
    certExpired = ms < 0;
    certExpiresInDays = Math.floor(ms / (24 * 60 * 60 * 1000));
  }
  return {
    enabled: !!z.enabled,
    configured: !!z.credentials,
    vatNumber: String(z.vatNumber || ""),
    vatName: String(z.vatName || ""),
    mode: String(z.mode || "compliance"),
    counter: Number(z.counter) || 1,
    updatedAt: z.updatedAt?.toMillis?.() ?? null,
    testedAt: z.testedAt?.toMillis?.() ?? null,
    lastStatus: z.lastStatus || null,
    certExpiresAt,
    certExpired,
    certExpiresInDays,
    certSource: z.certSource || null,
    workerLastSeenMs: workerHealth?.workerLastSeenMs ?? null,
    workerHealthy: workerHealth?.workerHealthy ?? null,
  };
}

async function publicZatcaConfigAsync(d) {
  const worker = await readZatcaWorkerHealth();
  return publicZatcaConfig(d, worker);
}

function generateGiftToken() {
  return crypto.randomBytes(24).toString("base64url");
}

/** Fixed placeholder key for scratch-card demos (does not match any real license hash). */
function buildDemoGiftPlainKey() {
  return "AMLK-DEMO-SCRATCH-TEST-KEY-NOT-REAL";
}

/** Seller: create a one-time scratch-card reveal link for the buyer. */
async function handleCreateGiftLink(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const licenseId = String(body.licenseId || "").trim();
  const plainKey = normalizePlainProductKey(body.plainKey);
  const isDemo = body.demo === true || body.demo === "true";
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const ttlDays = Math.min(
    90,
    Math.max(1, Number(body.expiresInDays) || (isDemo ? 7 : 30))
  );
  const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;

  const db = getFirestore();
  const licRef = db.collection(COLLECTION).doc(licenseId);
  const licSnap = await licRef.get();
  if (!licSnap.exists) return res.status(404).json({ error: "License not found" });
  const lic = licSnap.data() || {};
  if (lic.status === "revoked") return res.status(400).json({ error: "License is revoked" });

  let enc;
  let giftIsDemo = false;
  try {
    if (isDemo) {
      enc = encryptPlainKeyForGift(buildDemoGiftPlainKey());
      giftIsDemo = true;
    } else if (plainKey && plainKey.length >= 24) {
      if (licenseKeyHash(plainKey) !== licenseId) {
        return res.status(400).json({ error: "plainKey does not match this license" });
      }
      enc = encryptPlainKeyForGift(plainKey);
      await licRef.set({ giftCipher: enc }, { merge: true });
    } else if (lic.giftCipher && typeof lic.giftCipher === "object") {
      enc = lic.giftCipher;
    } else {
      return res.status(400).json({
        error:
          "No product key on file for this license. Re-create the license in Sales Console (new keys store automatically), send plainKey once, or use demo mode for a test scratch link.",
        code: "gift_key_missing",
      });
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Encryption failed" });
  }

  const oldGifts = await db.collection(GIFT_COLLECTION).where("licenseId", "==", licenseId).limit(50).get();
  const batch = db.batch();
  oldGifts.forEach((doc) => {
    if (!doc.data()?.claimedAt) batch.delete(doc.ref);
  });
  const token = generateGiftToken();
  const giftRef = db.collection(GIFT_COLLECTION).doc(token);
  batch.set(giftRef, {
    licenseId,
    label: String(lic.label || body.label || "License").trim() || "License",
    keyHint: giftIsDemo ? "DEMO" : String(lic.keyHint || plainKey.slice(-4)),
    cipher: enc,
    isDemo: giftIsDemo,
    expiresAt,
    claimedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return res.status(200).json({
    ok: true,
    token,
    expiresAt,
    label: String(lic.label || ""),
    keyHint: giftIsDemo ? "DEMO" : String(lic.keyHint || ""),
    isDemo: giftIsDemo,
  });
}

/** Public: metadata for scratch card (no key). */
async function handleGiftRevealInfo(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("giftInfo", ip, 30, 60_000))) {
    return res.status(429).json({ error: "Too many attempts. Try again in a minute." });
  }

  const token = String(req.body?.token || "").trim();
  if (!token || token.length < 16) return res.status(400).json({ error: "token required" });

  const db = getFirestore();
  const snap = await db.collection(GIFT_COLLECTION).doc(token).get();
  if (!snap.exists) {
    return res.status(404).json({ ok: false, status: "invalid", error: "Link not found" });
  }
  const d = snap.data() || {};
  const now = Date.now();
  const expiresAt = Number(d.expiresAt) || 0;
  const isDemo = !!d.isDemo;
  if (d.claimedAt) {
    return res.status(200).json({
      ok: true,
      status: "claimed",
      label: d.label || "",
      keyHint: d.keyHint || "",
      expiresAt,
      isDemo,
    });
  }
  if (expiresAt && now > expiresAt) {
    return res.status(200).json({
      ok: true,
      status: "expired",
      label: d.label || "",
      keyHint: d.keyHint || "",
      expiresAt,
      isDemo,
    });
  }

  const licSnap = await db.collection(COLLECTION).doc(String(d.licenseId || "")).get();
  if (!licSnap.exists || licSnap.data()?.status === "revoked") {
    return res.status(200).json({
      ok: true,
      status: "revoked",
      label: d.label || "",
      keyHint: d.keyHint || "",
      expiresAt,
      isDemo,
    });
  }

  return res.status(200).json({
    ok: true,
    status: "ready",
    label: d.label || "",
    keyHint: d.keyHint || "",
    expiresAt,
    isDemo,
  });
}

/** Public: reveal product key once (after scratch on client). */
async function handleGiftRevealClaim(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = clientIp(req);
  if (!(await consumeRateLimit("giftClaim", ip, 15, 60_000))) {
    return res.status(429).json({ error: "Too many attempts. Try again in a minute." });
  }

  const token = String(req.body?.token || "").trim();
  if (!token || token.length < 16) return res.status(400).json({ error: "token required" });

  const db = getFirestore();
  const giftRef = db.collection(GIFT_COLLECTION).doc(token);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(giftRef);
    if (!snap.exists) return { error: "not_found", status: 404 };
    const d = snap.data() || {};
    const now = Date.now();
    const expiresAt = Number(d.expiresAt) || 0;
    if (d.claimedAt) return { error: "already_claimed", status: 410, label: d.label };
    if (expiresAt && now > expiresAt) return { error: "expired", status: 410, label: d.label };

    const licRef = db.collection(COLLECTION).doc(String(d.licenseId || ""));
    const licSnap = await tx.get(licRef);
    if (!licSnap.exists || licSnap.data()?.status === "revoked") {
      return { error: "revoked", status: 400, label: d.label };
    }

    let plainKey;
    try {
      plainKey = decryptPlainKeyFromGift(d.cipher);
    } catch {
      return { error: "corrupt", status: 500 };
    }

    tx.update(giftRef, { claimedAt: FieldValue.serverTimestamp() });
    return {
      ok: true,
      plainKey,
      label: d.label || "",
      keyHint: d.keyHint || "",
      isDemo: !!d.isDemo,
    };
  });

  if (result.error === "not_found") return res.status(404).json({ error: "Link not found" });
  if (result.error === "already_claimed") {
    return res.status(410).json({ error: "This gift was already opened", status: "claimed", label: result.label });
  }
  if (result.error === "expired") {
    return res.status(410).json({ error: "This link has expired", status: "expired", label: result.label });
  }
  if (result.error === "revoked") return res.status(400).json({ error: "This license is no longer valid" });
  if (result.error === "corrupt") return res.status(500).json({ error: "Gift record is corrupted" });

  return res.status(200).json({
    ok: true,
    plainKey: result.plainKey,
    label: result.label,
    keyHint: result.keyHint,
    isDemo: !!result.isDemo,
  });
}

function normalizeSaudiMobileLicense(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("966") && d.length >= 12) d = `0${d.slice(3)}`;
  else if (d.length === 9 && d.startsWith("5")) d = `0${d}`;
  return /^05\d{8}$/.test(d) ? d : "";
}

async function tryCreateBuyerCustomer(projectId, apiKey, customerId, payload) {
  if (!projectId || !apiKey || !customerId) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/customers?documentId=${encodeURIComponent(customerId)}&key=${encodeURIComponent(apiKey)}`;
  const fields = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else if (typeof value === "number") fields[key] = { integerValue: String(Math.trunc(value)) };
    else fields[key] = { stringValue: String(value || "").slice(0, 200) };
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Tenant portal: create an account (PIN on the license). Does not need buyer Firebase Auth. */
async function handleTenantSelfRegister(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const ip = clientIp(req);
  if (!(await consumeRateLimit("tenantSignupIp", ip, 8, 60 * 60_000))) {
    return res.status(429).json({ error: "Too many sign-up attempts. Wait a while and try again." });
  }
  const raw = String(body.teamCode || body.joinCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const mobile = normalizeSaudiMobileLicense(body.mobile);
  const pin = String(body.pin || body.password || "").trim();
  const nameEn = String(body.nameEn || body.name || "").trim().slice(0, 120);
  const nameAr = String(body.nameAr || nameEn).trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const iqamaNo = String(body.iqamaNo || "").replace(/\D/g, "").slice(0, 10);
  if (raw.length < 8 || !mobile || pin.length < 4 || pin.length > 64 || !nameEn) {
    return res.status(400).json({ error: "Name, mobile, and password are required" });
  }
  if (iqamaNo && iqamaNo.length !== 10) {
    return res.status(400).json({ error: "Iqama / National ID must be 10 digits" });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!(await consumeRateLimit("tenantSignupMobile", `${raw}:${mobile}`, 3, 60 * 60_000))) {
    return res.status(429).json({ error: "Too many sign-up attempts. Wait a while and try again." });
  }

  const db = getFirestore();
  const qs = await db.collection(COLLECTION).where("teamCode", "==", raw).limit(1).get();
  if (qs.empty) return res.status(400).json({ error: "Open the tenant link from your property office, then try again." });
  const lic = qs.docs[0];
  const d = lic.data() || {};
  if (d.status !== "active") return res.status(400).json({ error: "This workspace is not active." });

  const pinRef = lic.ref.collection("tenantPins").doc(mobile);
  const pinSnap = await pinRef.get();
  if (pinSnap.exists) {
    return res.status(409).json({ error: "This mobile number is already registered" });
  }

  const cfg = tenantConfigShape(d.tenantFirebaseConfig);
  if (cfg?.projectId && cfg?.apiKey) {
    const existing = await findBuyerCustomerByMobile(cfg.projectId, cfg.apiKey, mobile);
    if (existing?.customerId) {
      return res.status(409).json({ error: "This mobile number is already registered" });
    }
  }

  const customerId = crypto.randomUUID();
  await pinRef.set({
    pinHash: hashPasswordSha256Hex(pin),
    customerId,
    nameEn,
    nameAr,
    name: nameEn,
    email,
    mobileNo: mobile,
    iqamaNo,
    selfRegistered: true,
    status: "Pending",
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (cfg?.projectId && cfg?.apiKey) {
    await tryCreateBuyerCustomer(cfg.projectId, cfg.apiKey, customerId, {
      nameEn,
      nameAr,
      name: nameEn,
      email,
      mobileNo: mobile,
      mobile,
      phone: mobile,
      iqamaNo,
      isTenant: true,
      selfRegistered: true,
      status: "Pending",
      createdAt: Date.now(),
    });
  }

  return res.status(200).json({
    ok: true,
    customerId,
    nameEn,
    nameAr,
    name: nameEn,
    email,
    mobileNo: mobile,
    sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
    sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
  });
}

/** Staff copies tenant PIN onto the license registry (works when buyer Firestore is unreachable). */
async function handleUpsertTenantPin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });
  const db = getFirestore();
  const licenseRef = db.collection(COLLECTION).doc(licenseId);
  const licenseSnap = await licenseRef.get();
  const access = await assertBuyerLicenseAccess(body, licenseSnap, { requireAdmin: false });
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (String(access.authIndex?.kind || "") === "tenant") {
    return res.status(403).json({ error: "Staff only" });
  }
  const mobile = normalizeSaudiMobileLicense(body.mobile);
  const pin = String(body.pin || "").trim();
  const customerId = String(body.customerId || "").trim();
  if (!mobile || pin.length < 4 || !customerId) {
    return res.status(400).json({ error: "mobile, pin, and customerId required" });
  }
  await licenseRef.collection("tenantPins").doc(mobile).set(
    {
      pinHash: hashPasswordSha256Hex(pin),
      customerId,
      nameEn: String(body.nameEn || "").slice(0, 200),
      nameAr: String(body.nameAr || "").slice(0, 200),
      name: String(body.nameEn || body.nameAr || "").slice(0, 200),
      email: String(body.email || "").slice(0, 200),
      mobileNo: mobile,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: access.uid,
    },
    { merge: true }
  );
  return res.status(200).json({ ok: true });
}

/** Tenant portal login without buyer Firebase Auth or buyer Firestore. */
async function handleTenantPinLogin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const GENERIC = { error: "Invalid mobile or password" };
  const ip = clientIp(req);
  if (!(await consumeRateLimit("tenantPin", ip, 20, 60_000))) {
    return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
  }
  const raw = String(body.teamCode || body.teamCode || body.joinCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const mobile = normalizeSaudiMobileLicense(body.mobile);
  const pin = String(body.pin || body.password || "").trim();
  if (raw.length < 8 || !mobile || pin.length < 4) {
    return res.status(400).json(GENERIC);
  }
  const db = getFirestore();
  const qs = await db.collection(COLLECTION).where("teamCode", "==", raw).limit(1).get();
  if (qs.empty) return res.status(400).json(GENERIC);
  const lic = qs.docs[0];
  const d = lic.data() || {};
  if (d.status !== "active") return res.status(400).json(GENERIC);
  const pinSnap = await lic.ref.collection("tenantPins").doc(mobile).get();
  let pd = pinSnap.exists ? pinSnap.data() || {} : null;
  const expected = String((pd && pd.pinHash) || "");
  const pinOk = expected && expected === hashPasswordSha256Hex(pin);

  if (!pinOk) {
    // No last-4-of-mobile fallback. Optional one-time migrate from an explicit
    // customer password field only (never from mobile digits).
    const cfg = tenantConfigShape(d.tenantFirebaseConfig);
    if (cfg?.projectId && cfg?.apiKey) {
      const found = await findBuyerCustomerByMobile(cfg.projectId, cfg.apiKey, mobile);
      if (found) {
        const derived = plainPinFromCustomerFields(found.fields, mobile);
        if (derived && pin === derived && pin !== mobile.slice(-4)) {
          pd = {
            customerId: found.customerId,
            nameEn: firestoreRestPickString(found.fields, ["nameEn", "name", "fullName", "englishName", "customerName"]),
            nameAr: firestoreRestPickString(found.fields, ["nameAr", "arabicName"]),
            email: firestoreRestPickString(found.fields, ["email"]),
            mobileNo: mobile,
            status: firestoreRestPickString(found.fields, ["status"]) || "Active",
          };
          await lic.ref.collection("tenantPins").doc(mobile).set(
            {
              pinHash: hashPasswordSha256Hex(derived),
              customerId: found.customerId,
              nameEn: pd.nameEn || "",
              nameAr: pd.nameAr || "",
              name: pd.nameEn || pd.nameAr || "",
              email: pd.email || "",
              mobileNo: mobile,
              status: pd.status || "Active",
              updatedAt: FieldValue.serverTimestamp(),
              backfilledFromLogin: true,
            },
            { merge: true }
          );
        } else {
          pd = null;
        }
      } else {
        pd = null;
      }
    } else {
      pd = null;
    }
  }

  if (!pd || !pd.customerId) return res.status(400).json(GENERIC);
  const pinStatus = String(pd.status || "").trim();
  if (/^pending$/i.test(pinStatus)) {
    return res.status(403).json({ error: "Your account is pending office approval." });
  }
  const cfg = tenantConfigShape(d.tenantFirebaseConfig);
  const blankName = !String(pd.nameEn || pd.nameAr || pd.name || "").trim() || /^tenant$/i.test(String(pd.name || "").trim());
  if (blankName && cfg?.projectId && cfg?.apiKey) {
    const found = await findBuyerCustomerByMobile(cfg.projectId, cfg.apiKey, mobile);
    if (found && found.fields) {
      pd.nameEn = firestoreRestPickString(found.fields, ["nameEn", "nameEn", "name", "fullName", "englishName", "customerName"]);
      pd.nameAr = firestoreRestPickString(found.fields, ["nameAr", "nameAr", "arabicName"]);
      pd.name = pd.nameEn || pd.nameAr || pd.name || "";
      pd.email = pd.email || firestoreRestPickString(found.fields, ["email"]);
      if (found.customerId) pd.customerId = pd.customerId || found.customerId;
      await lic.ref.collection("tenantPins").doc(mobile).set(
        {
          nameEn: pd.nameEn || "",
          nameAr: pd.nameAr || "",
          name: pd.name || "",
          email: pd.email || "",
        },
        { merge: true }
      );
    }
  }
  return res.status(200).json({
    ok: true,
    customerId: String(pd.customerId || ""),
    nameEn: pd.nameEn || "",
    nameAr: pd.nameAr || "",
    name: pd.name || pd.nameEn || pd.nameAr || "",
    email: pd.email || "",
    mobileNo: pd.mobileNo || mobile,
    iqamaImageUrl: pd.iqamaImageUrl || "",
    sadadBillerCode: sanitizeSadadBillerCode(d.sadadBillerCode),
    sadadBillerLabel: sanitizeSadadBillerLabel(d.sadadBillerLabel),
  });
}

/** Tenant portal: store Iqama image on the license PIN doc (no buyer Storage / Auth). */
async function handleTenantIqamaUpload(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const GENERIC = { error: "Invalid mobile or password" };
  const ip = clientIp(req);
  if (!(await consumeRateLimit("tenantIqama", ip, 10, 60_000))) {
    return res.status(429).json({ error: "Too many uploads. Wait a minute and try again." });
  }
  const raw = String(body.teamCode || body.teamCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const mobile = normalizeSaudiMobileLicense(body.mobile);
  const pin = String(body.pin || body.password || "").trim();
  const dataUrl = String(body.imageDataUrl || "").trim();
  if (raw.length < 8 || !mobile || pin.length < 4) return res.status(400).json(GENERIC);
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
    return res.status(400).json({ error: "Upload a JPG or PNG image" });
  }
  if (dataUrl.length > 900_000) {
    return res.status(400).json({ error: "Image is too large. Use a smaller photo." });
  }
  const db = getFirestore();
  const qs = await db.collection(COLLECTION).where("teamCode", "==", raw).limit(1).get();
  if (qs.empty) return res.status(400).json(GENERIC);
  const lic = qs.docs[0];
  const d = lic.data() || {};
  if (d.status !== "active") return res.status(400).json(GENERIC);
  const pinRef = lic.ref.collection("tenantPins").doc(mobile);
  const pinSnap = await pinRef.get();
  if (!pinSnap.exists) return res.status(400).json(GENERIC);
  const pd = pinSnap.data() || {};
  const expected = String(pd.pinHash || pd.pinHash || "");
  if (!expected || expected !== hashPasswordSha256Hex(pin)) return res.status(400).json(GENERIC);
  await pinRef.set(
    { iqamaImageUrl: dataUrl, iqamaUpdatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return res.status(200).json({ ok: true, iqamaImageUrl: dataUrl });
}

async function findBuyerCustomerByMobile(projectId, apiKey, mobile) {
  const variants = [mobile];
  if (mobile.startsWith("0") && mobile.length === 10) {
    variants.push(mobile.slice(1), `+966${mobile.slice(1)}`, `966${mobile.slice(1)}`);
  }
  const fieldPaths = ["mobileNo", "mobile", "phone", "phoneNo"];
  for (const fieldPath of fieldPaths) {
    for (const value of variants) {
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "customers" }],
              where: {
                fieldFilter: {
                  field: { fieldPath },
                  op: "EQUAL",
                  value: { stringValue: value },
                },
              },
              limit: 1,
            },
          }),
        });
        if (!r.ok) continue;
        const rows = await r.json();
        const hit = Array.isArray(rows) ? rows.find((row) => row && row.document && row.document.name) : null;
        if (!hit) continue;
        const name = String(hit.document.name || "");
        const customerId = name.split("/").pop() || "";
        if (!customerId) continue;
        return { customerId, fields: hit.document.fields || {} };
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

function firestoreRestPickString(fields, keys) {
  for (const k of keys) {
    const s = firestoreRestFieldString(fields, k);
    if (s) return s;
  }
  return "";
}

async function listBuyerDocs(projectId, idToken, collectionId) {
  const docs = [];
  let pageToken = "";
  for (let n = 0; n < 30; n++) {
    const q = new URLSearchParams({ pageSize: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents/${encodeURIComponent(collectionId)}?${q}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`list ${collectionId} failed (${r.status}) ${String(t).slice(0, 180)}`);
    }
    const json = await r.json();
    docs.push(...(json.documents || []));
    pageToken = json.nextPageToken || "";
    if (!pageToken) break;
  }
  return docs;
}

function plainPinFromCustomerFields(fields, mobile) {
  const tenantPassword = firestoreRestPickString(fields, ["tenantPassword"]);
  const password = firestoreRestPickString(fields, ["password"]);
  if (tenantPassword && !/^[0-9a-f]{64}$/i.test(tenantPassword)) {
    if (tenantPassword === String(mobile || "").slice(-4)) return "";
    return tenantPassword;
  }
  if (password && password.length >= 4 && password.length <= 16 && !/^[0-9a-f]{64}$/i.test(password)) {
    if (password === String(mobile || "").slice(-4)) return "";
    return password;
  }
  // Never derive a PIN from the mobile number.
  return "";
}

async function patchBuyerTenantPortalIndex(projectId, idToken, mobile, payload) {
  const fields = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "number") fields[k] = { integerValue: String(Math.trunc(v)) };
    else fields[k] = { stringValue: String(v ?? "") };
  }
  const mask = Object.keys(payload)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/tenantPortalIndex/${encodeURIComponent(mobile)}?${mask}`;
  await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

/** Staff: copy every customer PIN onto this license + buyer tenantPortalIndex (HTTPS, no SDK). */
async function handleBackfillTenantPins(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  const idToken = String(body.idToken || "").trim();
  if (!licenseId || !idToken) return res.status(400).json({ error: "licenseId and idToken required" });
  const db = getFirestore();
  const licenseRef = db.collection(COLLECTION).doc(licenseId);
  const licenseSnap = await licenseRef.get();
  const access = await assertBuyerLicenseAccess(body, licenseSnap, { requireAdmin: false });
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  if (String(access.authIndex?.kind || "") === "tenant") {
    return res.status(403).json({ error: "Staff only" });
  }
  const projectId = String(access.tenantConfig?.projectId || "").trim();
  if (!projectId) return res.status(400).json({ error: "License has no tenant project" });

  let customers;
  try {
    customers = await listBuyerDocs(projectId, idToken, "customers");
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Could not list customers" });
  }

  const rows = [];
  for (const doc of customers) {
    const customerId = String(doc.name || "").split("/").pop() || "";
    const fields = doc.fields || {};
    const mobile = normalizeSaudiMobileLicense(
      firestoreRestPickString(fields, ["mobileNo", "mobile", "phone", "phoneNo"])
    );
    if (!customerId || !mobile) continue;
    const pin = plainPinFromCustomerFields(fields, mobile);
    if (!pin || pin.length < 4) continue;
    const nameEn = firestoreRestPickString(fields, ["nameEn", "name"]);
    const nameAr = firestoreRestPickString(fields, ["nameAr"]);
    const email = firestoreRestPickString(fields, ["email"]);
    rows.push({ customerId, mobile, pin, nameEn, nameAr, email });
  }

  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + 400)) {
      batch.set(
        licenseRef.collection("tenantPins").doc(row.mobile),
        {
          pinHash: hashPasswordSha256Hex(row.pin),
          customerId: row.customerId,
          nameEn: row.nameEn.slice(0, 200),
          nameAr: row.nameAr.slice(0, 200),
          name: (row.nameEn || row.nameAr).slice(0, 200),
          email: row.email.slice(0, 200),
          mobileNo: row.mobile,
          updatedAt: FieldValue.serverTimestamp(),
          updatedByUid: access.uid,
          backfilled: true,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  for (const row of rows) {
    await patchBuyerTenantPortalIndex(projectId, idToken, row.mobile, {
      customerId: row.customerId,
      pinHash: hashPasswordSha256Hex(row.pin),
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      name: row.nameEn || row.nameAr,
      email: row.email,
      mobileNo: row.mobile,
      updatedAt: Date.now(),
    }).catch(() => {});
  }
  return res.status(200).json({ ok: true, count: rows.length });
}

async function handleAiCloudGetStatus(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const cfg = await loadAiCloudConfig();
  const db = getFirestore();
  const q = await db.collection(COLLECTION).limit(200).get();
  let textMonth = 0;
  let voiceMonth = 0;
  let enabledCount = 0;
  let activeCount = 0;
  q.forEach((doc) => {
    const d = doc.data() || {};
    const sales = salesAiStaffFields(d);
    textMonth += sales.aiStaffUsage.textMonth || 0;
    voiceMonth += sales.aiStaffUsage.voiceMonth || 0;
    if (sales.aiStaffEnabled) enabledCount += 1;
    if (sales.aiStaffActive) activeCount += 1;
  });

  let groqOk = null;
  if (cfg.groqApiKey) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${cfg.groqApiKey}` },
      });
      groqOk = r.ok;
    } catch {
      groqOk = false;
    }
  }

  return res.status(200).json({
    ok: true,
    aiStaffPriceSarMonth: AI_STAFF_PRICE_SAR_MONTH,
    killSwitch: cfg.killSwitch,
    envKillSwitch: killSwitchOn(),
    keys: {
      groq: maskKey(cfg.groqApiKey),
      gemini: maskKey(cfg.geminiApiKey),
      fish: maskKey(cfg.fishApiKey),
      fromEnv: cfg.fromEnv,
    },
    health: { groq: groqOk },
    usageMonth: { text: textMonth, voice: voiceMonth },
    licenses: { enabled: enabledCount, active: activeCount },
    updatedAt: cfg.updatedAt,
  });
}

async function handleAiCloudSaveKeys(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const pw = assertSalesPassword(body);
  if (!pw.ok) return res.status(401).json({ error: pw.error });

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  let has = false;
  if (typeof body.groqApiKey === "string" && body.groqApiKey.trim()) {
    patch.groqApiKey = body.groqApiKey.trim().slice(0, 200);
    has = true;
  }
  if (typeof body.geminiApiKey === "string") {
    patch.geminiApiKey = body.geminiApiKey.trim().slice(0, 200);
    has = true;
  }
  if (typeof body.fishApiKey === "string") {
    patch.fishApiKey = body.fishApiKey.trim().slice(0, 200);
    has = true;
  }
  if (typeof body.killSwitch === "boolean") {
    patch.killSwitch = body.killSwitch;
    has = true;
  }
  if (typeof body.clearGroq === "boolean" && body.clearGroq) {
    patch.groqApiKey = FieldValue.delete();
    has = true;
  }
  if (!has) return res.status(400).json({ error: "Provide groqApiKey, geminiApiKey, fishApiKey, and/or killSwitch" });

  await getFirestore().doc(AI_CLOUD_DOC).set(patch, { merge: true });
  return handleAiCloudGetStatus(req, res);
}

module.exports = {
  handleCreate,
  handleList,
  handleRevoke,
  handlePresence,
  handleRedeem,
  handleComplete,
  handleResolveJoin,
  handleRegenerateTeamCode,
  handleGetTeamCode,
  handleBuyerGetTeamCode,
  handleBuyerSetTeamCode,
  handleBuyerRegenerateTeamCode,
  handleGetPolicy,
  handleUpdatePolicy,
  handleGetZatcaConfig,
  handleSaveZatcaConfig,
  handleBuyerZatcaSignReport,
  handleBuyerZatcaJobStatus,
  handleProcessZatcaQueue,
  handleCreateGiftLink,
  handleGiftRevealInfo,
  handleGiftRevealClaim,
  handleUpsertTenantPin,
  handleTenantSelfRegister,
  handleTenantPinLogin,
  handleTenantIqamaUpload,
  handleBackfillTenantPins,
  handleAiCloudGetStatus,
  handleAiCloudSaveKeys,
  loadAiCloudConfig,
  licenseKeyHash,
};

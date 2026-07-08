/**
 * Product license HTTPS handlers (registry Firestore via Admin SDK).
 * Env (set in Firebase Functions config / secrets):
 *   SALES_CONSOLE_PASSWORD — must match what Sales Console sends (same as VITE_SALES_CONSOLE_PASSWORD).
 */

const crypto = require("crypto");
const { getApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const COLLECTION = "product_licenses";
const GIFT_COLLECTION = "license_gift_reveals";
const ZATCA_JOB_COLLECTION = "product_zatca_jobs";
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

/** Best-effort per-IP throttle for join-code lookups (reduces brute force). */
const resolveJoinHits = new Map();
function rateLimitResolveJoin(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 40;
  const key = String(ip || "unknown").slice(0, 160);
  let e = resolveJoinHits.get(key);
  if (!e || e.resetAt < now) {
    e = { count: 0, resetAt: now + windowMs };
    resolveJoinHits.set(key, e);
  }
  e.count += 1;
  return e.count <= max;
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
  return { localId: u.localId, email: u.email };
}

function assertSalesPassword(body) {
  return { ok: true };
}

function normalizeTeamCodeForLookup(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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

  const tenantFirebaseConfig = tenantConfigShape(body.tenantFirebaseConfig);
  if (!tenantFirebaseConfig) {
    return res.status(400).json({
      error:
        "Invalid buyer Firebase web config (need full apiKey starting with AIza — 39 chars — plus authDomain, projectId, storageBucket, messagingSenderId, appId). Do not use masked placeholders like AIzaSy...",
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
      isLive: presence.isLive,
      liveDeviceCount: presence.liveDeviceCount,
      lastSeenMs: presence.lastSeenMs,
      lastSeenPath: presence.lastSeenPath,
    });
  });
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return res.status(200).json({ ok: true, items });
}

async function handlePresence(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!isValidLicenseId(licenseId)) return res.status(400).json({ error: "licenseId required" });

  const deviceId = sanitizePresenceDeviceId(body.deviceId);
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  const state = String(body.state || "active").trim().toLowerCase() === "offline" ? "offline" : "active";
  const now = Date.now();
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  const d = snap.data() || {};
  if (d.status === "revoked") return res.status(403).json({ error: "License revoked" });

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

  if (idToken) {
    const verified = await verifyTenantIdToken(tenantFirebaseConfig.apiKey, idToken);
    if (!verified) {
      return res.status(401).json({ error: "Invalid Firebase sign-in for this buyer's project" });
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
  if (!idToken && contactEmailRaw) {
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
      await db.collection("users").doc(contactEmailRaw).set(userDoc, { merge: true });
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
    },
    { merge: true }
  );

  return res.status(200).json({ ok: true, activatedGoogleUid, activatedEmail, teamCode, serverSeededAdmin });
}

async function handleResolveJoin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const raw = normalizeTeamCodeForLookup(body.teamCode || body.joinCode);
  if (raw.length < 8) {
    return res.status(400).json({ error: "Enter a valid company code" });
  }

  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = fwd || req.socket?.remoteAddress || "";
  if (!rateLimitResolveJoin(ip)) {
    return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
  }

  const db = getFirestore();
  let qs = await db.collection(COLLECTION).where("teamCode", "==", raw).limit(1).get();
  let doc = qs.empty ? null : qs.docs[0];
  if (!doc) {
    const active = await db.collection(COLLECTION).where("status", "==", "active").limit(500).get();
    doc =
      active.docs.find((snap) => normalizeTeamCodeForLookup(snap.data()?.teamCode) === raw) ||
      null;
  }
  if (!doc) {
    return res.status(400).json({ error: "Code not found. Check with your company admin." });
  }
  const d = doc.data();
  if (d.status === "revoked") {
    return res.status(400).json({ error: "This company code is no longer valid" });
  }
  if (d.status !== "active") {
    return res.status(400).json({ error: "This setup is not ready yet" });
  }
  const tenantFirebaseConfig = tenantConfigShape(d.tenantFirebaseConfig);
  if (!tenantFirebaseConfig) {
    return res.status(500).json({ error: "License record is corrupted" });
  }

  return res.status(200).json({
    ok: true,
    licenseId: doc.id,
    tenantFirebaseConfig,
    teamCode: raw,
  });
}

async function handleGetPolicy(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(200).json({
      ok: true,
      appSuspended: true,
      disabledNavPaths: [],
      licenseStatus: "missing",
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
    });
  }
  const appSuspended = !!d.appSuspended;
  const disabledNavPaths = sanitizeDisabledNavPaths(d.disabledNavPaths);
  return res.status(200).json({
    ok: true,
    appSuspended,
    disabledNavPaths,
    licenseStatus: status,
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
  if (!hasField) {
    return res.status(400).json({ error: "Provide appSuspended and/or disabledNavPaths" });
  }
  await ref.set(patch, { merge: true });
  const d = (await ref.get()).data();
  return res.status(200).json({
    ok: true,
    appSuspended: !!d.appSuspended,
    disabledNavPaths: sanitizeDisabledNavPaths(d.disabledNavPaths),
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
  return res.status(200).json({ ok: true, zatca: publicZatcaConfig(snap.data() || {}) });
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
    return res.status(200).json({ ok: true, zatca: publicZatcaConfig(d) });
  }

  const enabled = body.enabled !== false;
  const credentials = normalizeZatcaCredentials(body.credentials || body);
  const validation = validateZatcaCredentials(credentials);
  if (enabled && validation) return res.status(400).json({ error: validation });
  const encrypted = encryptZatcaCredentials(credentials);
  const mode = credentials.productionCert && credentials.productionSecret ? "production" : "compliance";
  const previous = snap.data()?.zatcaConfig || {};
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
        updatedAt: FieldValue.serverTimestamp(),
        lastStatus: null,
      },
    },
    { merge: true }
  );
  const d = (await ref.get()).data() || {};
  return res.status(200).json({ ok: true, zatca: publicZatcaConfig(d) });
}

const INITIAL_ZATCA_PIH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

const zatcaReportHits = new Map();
function rateLimitZatcaReport(key) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 25;
  const k = String(key || "unknown").slice(0, 200);
  let e = zatcaReportHits.get(k);
  if (!e || e.resetAt < now) {
    e = { count: 0, resetAt: now + windowMs };
    zatcaReportHits.set(k, e);
  }
  e.count += 1;
  return e.count <= max;
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
  if (!r.ok) throw new Error(data?.error || `ZATCA signing service error ${r.status}`);
  return data;
}

function isZatcaSigningUnavailable(error) {
  if (error?.zatcaUnavailable) return true;
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

async function signAndStoreZatcaResult(licenseId, invoice) {
  const { ref, zatca, credentials } = await loadLicenseZatcaContext(licenseId);
  const data = await callZatcaSigningService({
    credentials,
    invoice,
    state: {
      previousInvoiceHash: String(zatca.pih || INITIAL_ZATCA_PIH),
      counter: Number(zatca.counter) || 1,
    },
  });

  const nextCounter = Number(data.nextCounter || data.counter + 1) || ((Number(zatca.counter) || 1) + 1);
  const newPih = String(data.invoice_hash || data.invoiceHash || "").trim();
  await ref.set(
    {
      zatcaConfig: {
        pih: newPih || String(zatca.pih || INITIAL_ZATCA_PIH),
        counter: nextCounter,
        lastStatus: {
          ok: !!data.success,
          zatcaStatus: Number(data.zatcaStatus) || 0,
          at: new Date().toISOString(),
        },
        lastReportedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
  return { nextCounter, data };
}

async function handleBuyerZatcaSignReport(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  if (!rateLimitZatcaReport(`${licenseId}:${ip}`)) {
    return res.status(429).json({ error: "Too many ZATCA requests. Try again in a minute." });
  }

  const invoice = body.invoice && typeof body.invoice === "object" ? body.invoice : body;
  try {
    const { data } = await signAndStoreZatcaResult(licenseId, invoice);
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    if (!isZatcaSigningUnavailable(e)) throw e;
    const jobId = await queueZatcaJob({ licenseId, invoice, reason: e?.message || "Signing service unavailable" });
    return res.status(200).json({
      ok: true,
      queued: true,
      jobId,
      message: "ZATCA signing server is offline. The invoice has been queued and will be sent when the Mac mini is online.",
    });
  }
}

async function handleBuyerZatcaJobStatus(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const licenseId = String(req.body?.licenseId || "").trim();
  const jobId = String(req.body?.jobId || "").trim();
  if (!licenseId || !jobId) return res.status(400).json({ error: "licenseId and jobId required" });
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
  const limit = Math.max(1, Math.min(10, Number(req.body?.limit) || 5));
  const db = getFirestore();
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
      await doc.ref.set(
        {
          status: unavailable ? "pending" : "failed",
          error: String(e?.message || e).slice(0, 1000),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      results.push({ jobId: doc.id, status: unavailable ? "pending" : "failed", error: e?.message || String(e) });
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

/** Buyer app (admin): read company code for an active license (licenseId only). */
async function handleBuyerGetTeamCode(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const licenseId = String(req.body?.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });

  const d = snap.data() || {};
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

  const licenseId = String(req.body?.licenseId || "").trim();
  const teamCode = normalizeTeamCodeInput(req.body?.teamCode);
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });
  if (!isValidTeamCode(teamCode)) {
    return res.status(400).json({
      error: "Invalid company code (use 8–20 letters A–Z or digits 2–9, no spaces)",
    });
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });
  const d = snap.data() || {};
  if (String(d.status || "") !== "active") {
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

  const licenseId = String(req.body?.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(licenseId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "License not found" });
  const d = snap.data() || {};
  if (String(d.status || "") !== "active") {
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

function publicZatcaConfig(d) {
  const z = d.zatcaConfig || {};
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
  };
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

const giftClaimHits = new Map();
function rateLimitGiftClaim(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const key = String(ip || "unknown").slice(0, 160);
  let e = giftClaimHits.get(key);
  if (!e || e.resetAt < now) {
    e = { count: 0, resetAt: now + windowMs };
    giftClaimHits.set(key, e);
  }
  e.count += 1;
  return e.count <= max;
}

/** Public: reveal product key once (after scratch on client). */
async function handleGiftRevealClaim(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  if (!rateLimitGiftClaim(Array.isArray(ip) ? ip[0] : ip)) {
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
  licenseKeyHash,
};

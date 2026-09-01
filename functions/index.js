const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

// Initialize Admin SDK once
if (!getApps().length) initializeApp();

// Deploy to Dammam, Saudi Arabia — required to reach ZATCA API
setGlobalOptions({ region: "me-central2" });

function sha256Hex(plain) {
  return crypto.createHash("sha256").update(String(plain || ""), "utf8").digest("hex");
}

function verifyLegacyPassword(plain, stored) {
  const value = String(stored || "");
  if (!value) return false;
  if (/^[a-f0-9]{64}$/i.test(value)) return sha256Hex(plain) === value.toLowerCase();
  return plain === value;
}

function syntheticEmail(userId, bookId) {
  const safeId = String(userId || "user").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
  const book = String(bookId || "default").trim().toUpperCase() || "DEFAULT";
  return `${safeId}@${book}.amlak.internal`.toLowerCase();
}

function normalizeRole(role, isOwner) {
  const value = String(role || "").trim().toUpperCase();
  if (value === "OWNER" || isOwner) return "ADMIN";
  if (value === "ENGINEER") return "EMPLOYEE";
  if (["ADMIN", "MANAGER", "EMPLOYEE"].includes(value)) return value;
  return "EMPLOYEE";
}

async function lookupStaffInCollection(db, collectionName, userId) {
  let snap = await db.collection(collectionName).doc(userId).get();
  if (!snap.exists) {
    const q = await db.collection(collectionName).where("id", "==", userId).limit(1).get();
    if (!q.empty) snap = q.docs[0];
  }
  return snap.exists ? snap : null;
}

/** Find staff user in default or any book_{teamCode}_users collection. */
async function findStaffUserAcrossBooks(db, userId, hintBookId) {
  const hint = String(hintBookId || "default").trim() || "default";
  const tried = new Set();

  async function tryBook(bookId) {
    const key = bookId || "default";
    if (tried.has(key)) return null;
    tried.add(key);
    const col = key === "default" ? "users" : `book_${key}_users`;
    const snap = await lookupStaffInCollection(db, col, userId);
    if (snap) return { snap, bookId: key, usersCol: col };
    return null;
  }

  if (hint !== "default") {
    const hinted = await tryBook(hint);
    if (hinted) return hinted;
  }
  const defaultHit = await tryBook("default");
  if (defaultHit) return defaultHit;

  const cols = await db.listCollections();
  for (const col of cols) {
    const match = /^book_([A-Z0-9]+)_users$/i.exec(col.id);
    if (!match) continue;
    const bookId = match[1].toUpperCase();
    const found = await tryBook(bookId);
    if (found) return found;
  }
  return null;
}

/**
 * Post-cutover password migration:
 * Verify the old SHA-256 / plaintext password from Firestore users/{id},
 * then create/update Firebase Auth + authIndex so the app can sign in.
 *
 * POST { userId, oldPassword, newPassword, bookId? }
 */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/amlakrrgroup\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+--amlakrrgroup\.netlify\.app$/,
  /^https:\/\/(www\.)?amlak-app\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function applyCors(req, res) {
  const origin = String(req.get("Origin") || req.get("origin") || "").trim();
  const allowed = !origin
    || ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  if (allowed && origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  } else if (!origin) {
    res.set("Access-Control-Allow-Origin", "*");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
}

exports.staffMigrateLogin = onRequest(
  { timeoutSeconds: 30, memory: "256MiB", invoker: "public" },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const userId = String(req.body?.userId || "").trim();
    const oldPassword = String(req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const bookId = String(req.body?.bookId || "default").trim() || "default";

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "userId, oldPassword, and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    try {
      const db = getFirestore();
      const auth = getAuth();
      const located = await findStaffUserAcrossBooks(db, userId, bookId);
      if (!located) {
        return res.status(404).json({ error: "User ID not found" });
      }

      const { snap, bookId: resolvedBookId, usersCol } = located;
      const data = snap.data() || {};
      if (data.hasSystemAccess === false) {
        return res.status(403).json({ error: "Account does not have system access" });
      }
      if (!verifyLegacyPassword(oldPassword, data.password)) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const email = String(data.email || "").trim() || syntheticEmail(userId, resolvedBookId);
      const normalizedEmail = email.toLowerCase();
      let record;
      try {
        record = await auth.getUserByEmail(normalizedEmail);
        await auth.updateUser(record.uid, {
          password: newPassword,
          displayName: data.name || userId,
          disabled: String(data.status || "").toLowerCase() === "inactive",
        });
      } catch {
        record = await auth.createUser({
          email: normalizedEmail,
          password: newPassword,
          displayName: data.name || userId,
          emailVerified: Boolean(data.email),
        });
      }

      const role = normalizeRole(data.role, data.isOwner);
      const kind = String(data.role || "").toUpperCase() === "OWNER" || data.isOwner ? "owner" : "staff";
      await db.collection("authIndex").doc(record.uid).set({
        userId,
        bookId: resolvedBookId,
        role,
        kind,
        email: normalizedEmail,
        migratedAt: new Date().toISOString(),
      }, { merge: true });

      await db.collection(usersCol).doc(snap.id).set({
        firebaseUid: record.uid,
        password: sha256Hex(newPassword),
        requiresPasswordReset: false,
        authPasswordSetAt: new Date().toISOString(),
      }, { merge: true });

      return res.status(200).json({
        ok: true,
        userId,
        email: normalizedEmail,
        uid: record.uid,
        bookId: resolvedBookId,
      });
    } catch (err) {
      console.error("staffMigrateLogin failed", err);
      return res.status(500).json({ error: err?.message || "Password migration failed" });
    }
  }
);

// The CSR generated for RR MILLENNIUM / amlak-prod
const CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIIBQTCB5wIBADBUMQswCQYDVQQGEwJTQTEWMBQGA1UECgwNUlIgTUlMTEVOTklV
TTEYMBYGA1UECwwPMzEyNjEwMDg5NDAwMDAzMRMwEQYDVQQDDAphbWxhay1wcm9k
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEMJl53/ug6UP1kwzgJWSGLgk7iw3c3q2y
9RL4A9YcN7v7LY/1O1lByDWOgGgjvw2JX9oGg2xQdoMVB9nICrqFtqA0MDIGCSqG
SIb3DQEJDjElMCMwIQYJKwYBBAGCNxQCBBQTElpBVENBLUNvZGUtU2lnbmluZzAK
BggqhkjOPQQDAgNJADBGAiEAw+TTpOZ/j6slXBFzkHoWSb0DiialN8Z1hQrYtkXU
USgCIQDpVmLE2vsD4jC3+X+uiBI1eNuYSPNLvp68AYG/bViyRA==
-----END CERTIFICATE REQUEST-----`;

const ZATCA_URL =
  "https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal/compliance";

exports.zatcaOnboard = onRequest(
  { timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    // Basic CORS for local testing
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: "Missing otp in request body" });
    }

    const csrBase64 = Buffer.from(CSR_PEM).toString("base64");

    let zatcaRes;
    try {
      zatcaRes = await fetch(ZATCA_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          OTP: otp,
          "Accept-Version": "V2",
        },
        body: JSON.stringify({ csr: csrBase64 }),
      });
    } catch (err) {
      return res.status(502).json({ error: "Network error calling ZATCA", detail: err.message });
    }

    const text = await zatcaRes.text();

    if (!zatcaRes.ok) {
      return res.status(zatcaRes.status).json({
        error: "ZATCA API error",
        status: zatcaRes.status,
        body: text,
      });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// NAFATH API PROXY  (نفاذ)
// Two endpoints:
//   /nafathRequest  — initiate a verification request
//   /nafathStatus   — poll for WAITING → COMPLETED / REJECTED / EXPIRED
//
// Credentials are read from (in priority order):
//   1. process.env.NAFATH_APP_ID / NAFATH_APP_KEY  (Firebase secrets / env vars)
//   2. Firestore "settings" doc  →  nafathAppId / nafathAppKey  (admin-configured)
// ─────────────────────────────────────────────────────────────────────────────
const NAFATH_BASE = "https://nafath.api.elm.sa";

/** Retrieve Nafath credentials from env vars or Firestore settings */
const getNafathCredentials = async () => {
  const appId = process.env.NAFATH_APP_ID;
  const appKey = process.env.NAFATH_APP_KEY;
  if (appId && appKey) return { appId, appKey };

  // Fallback: read from Firestore settings document
  const db = getFirestore();
  const snap = await db.collection("settings").doc("main").get();
  if (snap.exists) {
    const d = snap.data();
    if (d.nafathAppId && d.nafathAppKey) {
      return { appId: d.nafathAppId, appKey: d.nafathAppKey };
    }
  }
  return null;
};

const nafathCors = (res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
};

/** POST /nafathRequest — initiate Nafath identity verification */
exports.nafathRequest = onRequest(
  { timeoutSeconds: 30, memory: "256MiB" },
  async (req, res) => {
    nafathCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { nationalId, service = "PersonalInfo" } = req.body || {};
    if (!nationalId) return res.status(400).json({ error: "nationalId is required" });

    // Validate format: 10 digits starting with 1 or 2
    if (!/^[12]\d{9}$/.test(String(nationalId))) {
      return res.status(400).json({ error: "Invalid National ID / Iqama format" });
    }

    const creds = await getNafathCredentials();
    if (!creds) {
      return res.status(503).json({
        error: "Nafath credentials not configured",
        guide: "Set NAFATH_APP_ID and NAFATH_APP_KEY as Firebase Function environment variables, or enter them in the Nafath Settings panel inside the app.",
      });
    }

    try {
      const apiRes = await fetch(`${NAFATH_BASE}/api/v1/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "app-id": creds.appId,
          "app-key": creds.appKey,
        },
        body: JSON.stringify({ nationalId: String(nationalId), service }),
      });
      const text = await apiRes.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(apiRes.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "Network error reaching Nafath API", detail: err.message });
    }
  }
);

/** POST /nafathStatus — poll verification status */
exports.nafathStatus = onRequest(
  { timeoutSeconds: 30, memory: "256MiB" },
  async (req, res) => {
    nafathCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");

    const body = req.method === "POST" ? (req.body || {}) : req.query;
    const { nationalId, transId, random } = body;

    if (!nationalId || !transId) {
      return res.status(400).json({ error: "nationalId and transId are required" });
    }

    const creds = await getNafathCredentials();
    if (!creds) {
      return res.status(503).json({ error: "Nafath credentials not configured" });
    }

    try {
      const params = new URLSearchParams({ nationalId: String(nationalId), transId: String(transId) });
      if (random !== undefined) params.set("random", String(random));

      const apiRes = await fetch(`${NAFATH_BASE}/api/v1/request/status?${params}`, {
        method: "GET",
        headers: {
          "app-id": creds.appId,
          "app-key": creds.appKey,
        },
      });
      const text = await apiRes.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(apiRes.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "Network error reaching Nafath API", detail: err.message });
    }
  }
);

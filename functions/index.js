const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Admin SDK once
if (!getApps().length) initializeApp();

// Deploy to Dammam, Saudi Arabia — required to reach ZATCA API
setGlobalOptions({ region: "me-central2" });

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

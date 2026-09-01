/**
 * Standalone license HTTP API — same handlers as Firebase `functions/licenseApi.js`.
 *
 * After unified migration, point Admin SDK at **saudi-property-manager**:
 *   FIREBASE_SERVICE_ACCOUNT_JSON = service account for saudi-property-manager
 *   (not amlak-sales-main). Licenses live in product_licenses on the unified project
 *   after `npm run migrate:licenses` in mac-cloud.
 *
 * Optional overrides for resolve/join responses:
 *   UNIFIED_FIREBASE_PROJECT_ID, UNIFIED_FIREBASE_API_KEY, etc.
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
if (!process.env.SALES_CONSOLE_PASSWORD && process.env.VITE_SALES_CONSOLE_PASSWORD) {
  process.env.SALES_CONSOLE_PASSWORD = process.env.VITE_SALES_CONSOLE_PASSWORD;
}

const express = require("express");
const { createCorsMiddleware } = require("./corsAllowlist");

if (process.env.NODE_ENV === "production" && !String(process.env.SALES_CONSOLE_PASSWORD || "").trim()) {
  console.error("[license-api] Set SALES_CONSOLE_PASSWORD in production.");
  process.exit(1);
}

const licensePath = path.join(__dirname, "..", "functions", "licenseApi.js");
const serviceAccountPath = path.join(__dirname, "service-account.json");

// Must use the same firebase-admin copy that functions/licenseApi.js loads
// (functions/node_modules). Root vs functions duplicates leave getFirestore() with no app.
const { initializeApp, cert, getApps } = require(
  require.resolve("firebase-admin/app", { paths: [path.join(__dirname, "..", "functions")] })
);

function initAdmin() {
  if (getApps().length > 0) return;

  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let json;
  try {
    if (fromEnv && String(fromEnv).trim()) {
      json = JSON.parse(fromEnv);
    } else if (fs.existsSync(serviceAccountPath)) {
      json = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    }
  } catch (e) {
    console.error("[license-api] Invalid FIREBASE_SERVICE_ACCOUNT_JSON or service-account.json:", e.message);
    process.exit(1);
  }

  if (json) {
    initializeApp({ credential: cert(json) });
    console.log("[license-api] Firebase Admin initialized from service account.");
  } else {
    try {
      initializeApp();
      console.log("[license-api] Firebase Admin initialized from application default credentials.");
    } catch (e) {
      console.error(
        "[license-api] No Firebase Admin credentials. Add license-api-server/service-account.json or set FIREBASE_SERVICE_ACCOUNT_JSON."
      );
      process.exit(1);
    }
  }
}

initAdmin();

console.log(
  "[license-api] Loaded functions/licenseApi.js — productLicenseComplete accepts email-only activation (contactEmail + adminPasswordPlain, no idToken)."
);

const {
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
} = require(licensePath);

const {
  handleAssistantChat,
  handleAssistantConfirm,
  handleAssistantWhatsApp,
  handleAssistantActionsList,
  handleAssistantBriefing,
  handleAssistantHireMeta,
} = require(path.join(__dirname, "..", "functions", "aiStaffAssistant.js"));

const app = express();
app.use(createCorsMiddleware());
app.use(
  express.json({
    limit: "8mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf ? buf.toString("utf8") : "";
    },
  })
);

function mountPost(url, handler) {
  app.post(url, (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("[license-api]", url, err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error" });
      }
    });
  });
  app.get(url, (_req, res) => {
    res.status(405).json({
      error: "This endpoint accepts POST with a JSON body, not GET.",
      method: "POST",
      path: url,
      hint: "Use Sales Console → Gift link / Demo scratch, then open gift.html?t=… (not this API URL in the browser).",
    });
  });
}

mountPost("/productLicenseCreate", handleCreate);
mountPost("/productLicenseList", handleList);
mountPost("/productLicenseRevoke", handleRevoke);
mountPost("/productLicensePresence", handlePresence);
mountPost("/productLicenseRedeem", handleRedeem);
mountPost("/productLicenseComplete", handleComplete);
mountPost("/productLicenseResolveJoin", handleResolveJoin);
mountPost("/productLicenseRegenerateTeamCode", handleRegenerateTeamCode);
mountPost("/productLicenseGetTeamCode", handleGetTeamCode);
mountPost("/productLicenseBuyerGetTeamCode", handleBuyerGetTeamCode);
mountPost("/productLicenseBuyerSetTeamCode", handleBuyerSetTeamCode);
mountPost("/productLicenseBuyerRegenerateTeamCode", handleBuyerRegenerateTeamCode);
mountPost("/productLicenseGetPolicy", handleGetPolicy);
mountPost("/productLicenseUpdatePolicy", handleUpdatePolicy);
mountPost("/productLicenseGetZatcaConfig", handleGetZatcaConfig);
mountPost("/productLicenseSaveZatcaConfig", handleSaveZatcaConfig);
mountPost("/productLicenseZatcaSignReport", handleBuyerZatcaSignReport);
mountPost("/productLicenseZatcaJobStatus", handleBuyerZatcaJobStatus);
mountPost("/productLicenseZatcaProcessQueue", handleProcessZatcaQueue);
mountPost("/productLicenseCreateGiftLink", handleCreateGiftLink);
mountPost("/productLicenseGiftRevealInfo", handleGiftRevealInfo);
mountPost("/productLicenseGiftRevealClaim", handleGiftRevealClaim);
mountPost("/productLicenseUpsertTenantPin", handleUpsertTenantPin);
mountPost("/productLicenseTenantRegister", handleTenantSelfRegister);
mountPost("/productLicenseTenantLogin", handleTenantPinLogin);
mountPost("/productLicenseTenantIqamaUpload", handleTenantIqamaUpload);
mountPost("/productLicenseBackfillTenantPins", handleBackfillTenantPins);
mountPost("/productLicenseAiCloudStatus", handleAiCloudGetStatus);
mountPost("/productLicenseAiCloudSave", handleAiCloudSaveKeys);

mountPost("/assistant/chat", handleAssistantChat);
mountPost("/assistant/confirm", handleAssistantConfirm);
mountPost("/assistant/whatsapp", handleAssistantWhatsApp);
mountPost("/assistant/hire-meta", handleAssistantHireMeta);
mountPost("/assistant/briefing", handleAssistantBriefing);
app.get("/assistant/actions", (req, res) => {
  Promise.resolve(handleAssistantActionsList(req, res)).catch((err) => {
    console.error("[license-api] /assistant/actions", err);
    if (!res.headersSent) res.status(500).json({ error: err?.message || "Internal error" });
  });
});
mountPost("/assistant/actions", handleAssistantActionsList);

const ROUTE_NAMES = [
  "productLicenseCreate",
  "productLicenseList",
  "productLicenseRevoke",
  "productLicensePresence",
  "productLicenseRedeem",
  "productLicenseComplete",
  "productLicenseResolveJoin",
  "productLicenseRegenerateTeamCode",
  "productLicenseGetTeamCode",
  "productLicenseBuyerGetTeamCode",
  "productLicenseBuyerSetTeamCode",
  "productLicenseBuyerRegenerateTeamCode",
  "productLicenseGetPolicy",
  "productLicenseUpdatePolicy",
  "productLicenseGetZatcaConfig",
  "productLicenseSaveZatcaConfig",
  "productLicenseZatcaSignReport",
  "productLicenseZatcaJobStatus",
  "productLicenseZatcaProcessQueue",
  "productLicenseCreateGiftLink",
  "productLicenseGiftRevealInfo",
  "productLicenseGiftRevealClaim",
  "productLicenseUpsertTenantPin",
  "productLicenseTenantRegister",
  "productLicenseTenantLogin",
  "productLicenseTenantIqamaUpload",
  "productLicenseBackfillTenantPins",
  "productLicenseAiCloudStatus",
  "productLicenseAiCloudSave",
  "assistant/chat",
  "assistant/confirm",
  "assistant/whatsapp",
  "assistant/hire-meta",
  "assistant/briefing",
  "assistant/actions",
];

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "license-api-server",
    giftLinks: true,
    routes: ROUTE_NAMES.length,
  });
});

const port = Number(process.env.PORT) || 8787;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`License API listening on http://0.0.0.0:${port} (gift + demo routes enabled)`);
});
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[license-api] Port ${port} is already in use. Run: npm run predev  (or stop the old node process), then npm run dev again.`
    );
    process.exit(1);
  }
  throw err;
});

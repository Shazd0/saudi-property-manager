const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const {
  handleCreate: licenseHandleCreate,
  handleList: licenseHandleList,
  handleRevoke: licenseHandleRevoke,
  handlePresence: licenseHandlePresence,
  handleRedeem: licenseHandleRedeem,
  handleComplete: licenseHandleComplete,
  handleResolveJoin: licenseHandleResolveJoin,
  handleRegenerateTeamCode: licenseHandleRegenerateTeamCode,
  handleGetTeamCode: licenseHandleGetTeamCode,
  handleBuyerGetTeamCode: licenseHandleBuyerGetTeamCode,
  handleBuyerSetTeamCode: licenseHandleBuyerSetTeamCode,
  handleBuyerRegenerateTeamCode: licenseHandleBuyerRegenerateTeamCode,
  handleGetPolicy: licenseHandleGetPolicy,
  handleUpdatePolicy: licenseHandleUpdatePolicy,
  handleGetZatcaConfig: licenseHandleGetZatcaConfig,
  handleSaveZatcaConfig: licenseHandleSaveZatcaConfig,
  handleBuyerZatcaSignReport: licenseHandleBuyerZatcaSignReport,
  handleBuyerZatcaJobStatus: licenseHandleBuyerZatcaJobStatus,
  handleProcessZatcaQueue: licenseHandleProcessZatcaQueue,
  handleCreateGiftLink: licenseHandleCreateGiftLink,
  handleGiftRevealInfo: licenseHandleGiftRevealInfo,
  handleGiftRevealClaim: licenseHandleGiftRevealClaim,
  handleUpsertTenantPin: licenseHandleUpsertTenantPin,
  handleTenantSelfRegister: licenseHandleTenantSelfRegister,
  handleTenantPinLogin: licenseHandleTenantPinLogin,
  handleTenantIqamaUpload: licenseHandleTenantIqamaUpload,
  handleAiCloudGetStatus: licenseHandleAiCloudGetStatus,
  handleAiCloudSaveKeys: licenseHandleAiCloudSaveKeys,
} = require("./licenseApi");
const {
  handleAssistantChat,
  handleAssistantConfirm,
  handleAssistantWhatsApp,
  handleAssistantActionsList,
  handleAssistantBriefing,
  handleAssistantHireMeta,
} = require("./aiStaffAssistant");
// Initialize Admin SDK once
if (!getApps().length) initializeApp();

// Deploy to Dammam, Saudi Arabia — required to reach ZATCA API
setGlobalOptions({ region: "me-central2" });

/** Gen-2 onRequest defaults cors to false; browsers need cors + public invoker for Sales / tenant apps. */
const httpWithCors = {
  cors: true,
  invoker: "public",
};

// IMPORTANT:
// Do NOT hardcode your CSR in source control.
// Provide it via environment variable on the server: ZATCA_CSR_PEM
const CSR_PEM = process.env.ZATCA_CSR_PEM || '';

const ZATCA_URL =
  "https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal/compliance";

exports.zatcaOnboard = onRequest(
  { ...httpWithCors, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // Do not leave ZATCA onboarding publicly callable — costs OTP/compliance quota.
    const expected = String(process.env.SALES_CONSOLE_PASSWORD || "").trim();
    const got = String(req.body?.salesConsolePassword || "").trim();
    if (!expected || got !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: "Missing otp in request body" });
    }
    if (!CSR_PEM.trim()) {
      return res.status(500).json({ error: "Missing CSR. Set ZATCA_CSR_PEM env var for this function." });
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

/** Product license: create (Sales Console, password-protected). */
exports.productLicenseCreate = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleCreate(req, res)
);

/** Product license: list (Sales Console, password-protected). */
exports.productLicenseList = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleList(req, res)
);

/** Product license: revoke (Sales Console, password-protected). */
exports.productLicenseRevoke = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleRevoke(req, res)
);

/** Product license: buyer app heartbeat for live usage status. */
exports.productLicensePresence = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandlePresence(req, res)
);

/** Product license: redeem key → tenant config + short-lived nonce (public). */
exports.productLicenseRedeem = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleRedeem(req, res)
);

/** Product license: complete activation after Google sign-in on tenant (public). */
exports.productLicenseComplete = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleComplete(req, res)
);

/** Product license: resolve company/team code → tenant config (public, for new devices). */
exports.productLicenseResolveJoin = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleResolveJoin(req, res)
);

/** Product license: regenerate team code (Sales Console, password-protected). */
exports.productLicenseRegenerateTeamCode = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleRegenerateTeamCode(req, res)
);

/** Product license: reveal current team code (Sales Console, password-protected). */
exports.productLicenseGetTeamCode = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleGetTeamCode(req, res)
);

/** Product license: buyer admin reads company code (licenseId, active license). */
exports.productLicenseBuyerGetTeamCode = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleBuyerGetTeamCode(req, res)
);

/** Product license: buyer admin sets custom company code. */
exports.productLicenseBuyerSetTeamCode = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleBuyerSetTeamCode(req, res)
);

/** Product license: buyer admin generates new random company code. */
exports.productLicenseBuyerRegenerateTeamCode = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleBuyerRegenerateTeamCode(req, res)
);

/** Product license: remote policy for tenant app (public read by licenseId). */
exports.productLicenseGetPolicy = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleGetPolicy(req, res)
);

/** Product license: update remote policy (Sales Console, password-protected). */
exports.productLicenseUpdatePolicy = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleUpdatePolicy(req, res)
);

/** Product license: read buyer ZATCA setup status (Sales Console, password-protected). */
exports.productLicenseGetZatcaConfig = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleGetZatcaConfig(req, res)
);

/** Product license: save buyer ZATCA credentials encrypted on the server (Sales Console). */
exports.productLicenseSaveZatcaConfig = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleSaveZatcaConfig(req, res)
);

/** Product license: sign/report one buyer invoice using that buyer's hosted ZATCA setup. */
exports.productLicenseZatcaSignReport = onRequest(
  { ...httpWithCors, timeoutSeconds: 60, memory: "512MiB" },
  (req, res) => licenseHandleBuyerZatcaSignReport(req, res)
);

/** Product license: check queued ZATCA job status for a buyer invoice. */
exports.productLicenseZatcaJobStatus = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleBuyerZatcaJobStatus(req, res)
);

/** Product license: retry queued ZATCA jobs when the signing host comes back online. */
exports.productLicenseZatcaProcessQueue = onRequest(
  { ...httpWithCors, timeoutSeconds: 120, memory: "512MiB" },
  (req, res) => licenseHandleProcessZatcaQueue(req, res)
);

/** Product license: create scratch-card gift link (Sales Console). */
exports.productLicenseCreateGiftLink = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleCreateGiftLink(req, res)
);

/** Product license: gift link metadata (public). */
exports.productLicenseGiftRevealInfo = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleGiftRevealInfo(req, res)
);

/** Product license: claim gift / reveal key once (public). */
exports.productLicenseGiftRevealClaim = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleGiftRevealClaim(req, res)
);

exports.productLicenseUpsertTenantPin = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleUpsertTenantPin(req, res)
);

exports.productLicenseTenantRegister = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleTenantSelfRegister(req, res)
);

exports.productLicenseTenantLogin = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleTenantPinLogin(req, res)
);

exports.productLicenseTenantIqamaUpload = onRequest(
  { ...httpWithCors, timeoutSeconds: 60, memory: "512MiB" },
  (req, res) => licenseHandleTenantIqamaUpload(req, res)
);

exports.productLicenseBackfillTenantPins = onRequest(
  { ...httpWithCors, timeoutSeconds: 120, memory: "256MiB" },
  (req, res) => licenseHandleBackfillTenantPins(req, res)
);

/** AI Cloud (Sales Console): Groq/Gemini/Fish status + kill switch. */
exports.productLicenseAiCloudStatus = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleAiCloudGetStatus(req, res)
);

exports.productLicenseAiCloudSave = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => licenseHandleAiCloudSaveKeys(req, res)
);

/** AI Staff assistant runtime (prefer license-api-server in production; CF mirror for dual deploy). */
exports.assistantChat = onRequest(
  { ...httpWithCors, timeoutSeconds: 120, memory: "512MiB" },
  (req, res) => handleAssistantChat(req, res)
);

exports.assistantConfirm = onRequest(
  { ...httpWithCors, timeoutSeconds: 60, memory: "256MiB" },
  (req, res) => handleAssistantConfirm(req, res)
);

exports.assistantWhatsApp = onRequest(
  { ...httpWithCors, timeoutSeconds: 120, memory: "512MiB" },
  (req, res) => handleAssistantWhatsApp(req, res)
);

exports.assistantHireMeta = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => handleAssistantHireMeta(req, res)
);

exports.assistantBriefing = onRequest(
  { ...httpWithCors, timeoutSeconds: 60, memory: "256MiB" },
  (req, res) => handleAssistantBriefing(req, res)
);

exports.assistantActions = onRequest(
  { ...httpWithCors, timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => handleAssistantActionsList(req, res)
);

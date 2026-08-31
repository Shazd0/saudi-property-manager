/**
 * Amlak AI Staff assistant runtime — hosted next to license API.
 * Auth: Firebase ID token (in-app) OR HMAC (WhatsApp gateway).
 * Never put API keys in responses.
 */

const crypto = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  computeAiStaffActive,
  consumeAiStaffUsageTx,
  pausedMessages,
  capMessages,
  sanitizeIsoDate,
} = require("./aiStaffPolicy");
const {
  TenantDataCache,
  fetchTenantAuthIndex,
  fetchStaffDisplayName,
  toolsForAutonomy,
  runTool,
  executePreparedAction,
  autonomyAutoExecuteMoney,
  buildOfficeSummary,
} = require("./aiStaffTenantTools");

const COLLECTION = "product_licenses";
const ACTIONS = "assistant_actions";
const PENDING = "assistant_pending";

const MODEL_FAST = "openai/gpt-oss-20b";
const MODEL_TOOLS = "openai/gpt-oss-120b";
const STT_MODEL = "whisper-large-v3-turbo";
const TTS_AR = "canopylabs/orpheus-arabic-saudi";
const TTS_EN = "canopylabs/orpheus-v1-english";

function gatewaySecret() {
  return String(process.env.ASSISTANT_GATEWAY_SECRET || "").trim();
}

function verifyHmac({ licenseId, timestamp, bodyRaw, signature }) {
  const secret = gatewaySecret();
  if (!secret || secret.length < 16) return { ok: false, error: "Gateway secret not configured" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 60_000) {
    return { ok: false, error: "Timestamp skew" };
  }
  const bodyHash = crypto.createHash("sha256").update(String(bodyRaw || ""), "utf8").digest("hex");
  const payload = `${licenseId}.${ts}.${bodyHash}`;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const got = String(signature || "").trim().toLowerCase();
  if (!got || got.length !== expected.length) return { ok: false, error: "Bad signature" };
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(got, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Bad signature" };
    }
  } catch {
    return { ok: false, error: "Bad signature" };
  }
  return { ok: true };
}

function loadAiCloudConfigFromLicenseApi() {
  return require("./aiCloudConfig").loadAiCloudConfig();
}

async function getLicenseDoc(licenseId) {
  const snap = await getFirestore().collection(COLLECTION).doc(licenseId).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() || {} };
}

async function assertAiStaffActive(licenseId) {
  const lic = await getLicenseDoc(licenseId);
  if (!lic) return { ok: false, status: 404, body: { error: "License not found", ...pausedMessages() } };
  const cfg = await loadAiCloudConfigFromLicenseApi();
  if (cfg.killSwitch || !computeAiStaffActive(lic.data)) {
    return { ok: false, status: 403, body: { error: "AI Staff inactive", code: "AI_STAFF_INACTIVE", ...pausedMessages() } };
  }
  return { ok: true, license: lic, cloud: cfg };
}

async function verifyFirebaseBearer(req) {
  const auth = String(req.headers.authorization || "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, error: "Missing Authorization" };
  return { ok: true, idToken: m[1].trim() };
}

async function verifyTenantIdToken(tenantApiKey, idToken) {
  const key = String(tenantApiKey || "").trim();
  if (!key || !idToken) return null;
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  const users = data.users || [];
  if (!users.length) return null;
  const u = users[0];
  const providers = Array.isArray(u.providerUserInfo) ? u.providerUserInfo : [];
  const hasStrongProvider = providers.some((p) =>
    ["password", "google.com", "phone"].includes(String(p.providerId || ""))
  );
  return {
    localId: u.localId,
    email: u.email || "",
    isAnonymous: !hasStrongProvider,
  };
}

function extractLicenseIdFromReq(req, body) {
  return String(
    body.licenseId ||
      req.headers["x-amlak-license-id"] ||
      req.headers["x-license-id"] ||
      ""
  ).trim();
}

async function resolveInAppSession(req, body) {
  const bearer = await verifyFirebaseBearer(req);
  if (!bearer.ok) return { ok: false, status: 401, body: { error: bearer.error, code: "UNAUTHORIZED" } };

  const licenseId = extractLicenseIdFromReq(req, body);
  if (!licenseId) return { ok: false, status: 400, body: { error: "licenseId required" } };

  const active = await assertAiStaffActive(licenseId);
  if (!active.ok) return active;

  const cfg = active.license.data.tenantFirebaseConfig || {};
  const apiKey = String(cfg.apiKey || "").trim();
  const projectId = String(cfg.projectId || "").trim();
  if (!apiKey || !projectId) {
    return { ok: false, status: 503, body: { error: "License has no tenant Firebase config", code: "CONFIGURATION" } };
  }

  const projectHeader = String(req.headers["x-amlak-project-id"] || "").trim();
  if (projectHeader && projectHeader !== projectId) {
    return { ok: false, status: 403, body: { error: "Project mismatch", code: "FORBIDDEN" } };
  }

  const verified = await verifyTenantIdToken(apiKey, bearer.idToken);
  if (!verified?.localId) {
    return { ok: false, status: 401, body: { error: "Invalid Firebase token for this license", code: "UNAUTHORIZED" } };
  }
  if (verified.isAnonymous) {
    return { ok: false, status: 401, body: { error: "Anonymous auth is not allowed", code: "UNAUTHORIZED" } };
  }

  let authIndex = null;
  try {
    authIndex = await fetchTenantAuthIndex(projectId, bearer.idToken, verified.localId);
  } catch {
    authIndex = null;
  }
  if (!authIndex?.kind) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "No authIndex for this user — complete app login so AI Staff can access your office data",
        code: "FORBIDDEN",
      },
    };
  }

  const autonomy = ["suggest", "ask_money", "trusted"].includes(active.license.data.aiStaffAutonomy)
    ? active.license.data.aiStaffAutonomy
    : "ask_money";

  return {
    ok: true,
    channel: "app",
    licenseId,
    uid: verified.localId,
    idToken: bearer.idToken,
    projectId,
    apiKey,
    authIndex,
    autonomy,
    license: active.license,
    cloud: active.cloud,
  };
}

async function resolveWhatsAppSession(req, body, bodyRaw) {
  const licenseId = extractLicenseIdFromReq(req, body);
  const timestamp = req.headers["x-amlak-timestamp"] || body.timestamp;
  const signature = req.headers["x-amlak-signature"] || body.signature;
  const check = verifyHmac({
    licenseId,
    timestamp,
    bodyRaw: bodyRaw != null ? bodyRaw : JSON.stringify(body),
    signature,
  });
  if (!check.ok) return { ok: false, status: 401, body: { error: check.error, code: "UNAUTHORIZED" } };
  const active = await assertAiStaffActive(licenseId);
  if (!active.ok) return active;
  const from = String(body.from || body.senderJid || "").trim();
  const groupId = String(body.groupId || "").trim();
  const allow = Array.isArray(active.license.data.aiStaffAllowPhones)
    ? active.license.data.aiStaffAllowPhones.map(String)
    : [];
  const allowGroup = String(active.license.data.aiStaffGroupId || "").trim();
  if (groupId) {
    if (!allowGroup || groupId !== allowGroup) {
      return { ok: false, status: 403, body: { error: "Group not allowlisted", code: "FORBIDDEN" } };
    }
  } else if (from) {
    const digits = from.replace(/\D/g, "");
    // Require a substantial phone suffix (≥9 digits) — never match short tails.
    const okPhone = allow.some((p) => {
      const d = String(p).replace(/\D/g, "");
      if (!d || d.length < 9 || digits.length < 9) return false;
      return digits === d || digits.endsWith(d) || d.endsWith(digits);
    });
    if (!okPhone) {
      return { ok: false, status: 403, body: { error: "Sender not allowlisted", code: "FORBIDDEN" } };
    }
  } else {
    return { ok: false, status: 400, body: { error: "from or groupId required" } };
  }
  return {
    ok: true,
    channel: "whatsapp",
    licenseId,
    from,
    groupId,
    license: active.license,
    cloud: active.cloud,
  };
}

async function groqChat(apiKey, { model, messages, max_tokens = 400, tools, tool_choice }) {
  const body = { model, messages, max_tokens, temperature: 0.3 };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = tool_choice || "auto";
  }
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.message || `Groq chat failed (${r.status})`);
  }
  const msg = data?.choices?.[0]?.message || {};
  return {
    content: String(msg.content || "").trim(),
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
  };
}

async function persistBriefingSnapshot(licenseId, summary) {
  if (!summary) return;
  await getFirestore()
    .collection(COLLECTION)
    .doc(licenseId)
    .set(
      {
        aiStaffBriefingSnapshot: {
          ...summary,
          updatedAtMs: Date.now(),
        },
      },
      { merge: true }
    );
}

async function buildTenantToolContext(session) {
  const cfg = session.license.data.tenantFirebaseConfig || {};
  const projectId = session.projectId || String(cfg.projectId || "").trim();
  const idToken = session.idToken;
  const staffName = await fetchStaffDisplayName(projectId, idToken, session.authIndex?.appUserId);
  const cache = new TenantDataCache(projectId, idToken);
  return {
    projectId,
    idToken,
    authIndex: session.authIndex,
    staffName,
    autonomy: session.autonomy || "ask_money",
    cache,
    lastSummary: null,
  };
}

async function runAssistantToolLoop(apiKey, session, userMessage, history) {
  const ctx = await buildTenantToolContext(session);
  const tools = toolsForAutonomy(session.autonomy || "ask_money");
  const messages = [
    {
      role: "system",
      content: [
        systemPrompt(session.license.data.label),
        "You have tools to search the office database and prepare pending writes.",
        "Use tools when the user asks about tenants, contracts, overdue rent, tasks, or wants to record payments.",
        "Never claim a write succeeded unless a tool result says it was created.",
        session.autonomy === "suggest"
          ? "Autonomy: suggest only — do not prepare money or task writes."
          : session.autonomy === "trusted"
            ? "Autonomy: trusted — small money entries may auto-execute after prepare."
            : "Autonomy: ask before money — prepared transactions need user confirmation.",
      ].join(" "),
    },
    ...history
      .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
      .map((h) => ({ role: h.role, content: String(h.text).slice(0, 2000) })),
    { role: "user", content: userMessage },
  ];

  let pendingAction = null;
  let autoExecuted = null;

  for (let round = 0; round < 3; round++) {
    let result;
    try {
      result = await groqChat(apiKey, {
        model: MODEL_TOOLS,
        messages,
        max_tokens: 600,
        tools,
      });
    } catch (e) {
      throw e;
    }

    if (!result.tool_calls.length) {
      if (ctx.lastSummary) await persistBriefingSnapshot(session.licenseId, ctx.lastSummary);
      return { reply: result.content, pendingAction, autoExecuted };
    }

    messages.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: result.tool_calls,
    });

    for (const call of result.tool_calls) {
      const fn = call.function || {};
      const name = String(fn.name || "");
      let args = {};
      try {
        args = fn.arguments ? JSON.parse(fn.arguments) : {};
      } catch {
        args = {};
      }
      let toolResult;
      try {
        toolResult = await runTool(name, args, ctx);
      } catch (err) {
        toolResult = { error: err?.message || "Tool failed" };
      }

      if (toolResult?.prepared && toolResult.requiresConfirm === false) {
        try {
          const exec = await executePreparedAction(ctx, toolResult);
          autoExecuted = { ...toolResult, exec };
          toolResult = {
            ...toolResult,
            executed: true,
            documentId: exec.created?.id || null,
            status: exec.status || "created",
          };
        } catch (err) {
          toolResult = { ...toolResult, executed: false, error: err?.message || "Execute failed" };
        }
      } else if (toolResult?.prepared) {
        pendingAction = {
          actionId: toolResult.actionId,
          summary: toolResult.summary,
          tool: toolResult.tool,
          payload: toolResult.payload,
        };
        toolResult = { ...toolResult, awaitingUserConfirm: true };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(toolResult).slice(0, 6000),
      });
    }
  }

  const final = await groqChat(apiKey, { model: MODEL_FAST, messages, max_tokens: 500 });
  if (ctx.lastSummary) await persistBriefingSnapshot(session.licenseId, ctx.lastSummary);
  return { reply: final.content || final, pendingAction, autoExecuted };
}

/** Optional Gemini 2.5 Flash fallback when Groq tool/chat path fails. */
async function geminiFlashChat(apiKey, messages, max_tokens = 500) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Gemini key missing");
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "model")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));
  const system = messages.find((m) => m.role === "system");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: String(system.content || "") }] } : undefined,
      contents,
      generationConfig: { maxOutputTokens: max_tokens, temperature: 0.3 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.message || `Gemini failed (${r.status})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return String(text).trim();
}

async function groqTranscribe(apiKey, audioBuffer, filename = "audio.ogg") {
  const boundary = `----amlak${crypto.randomBytes(8).toString("hex")}`;
  const name = String(filename || "audio.ogg");
  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${name}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    "utf8"
  );
  const mid = Buffer.from(
    `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `${STT_MODEL}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
      `text\r\n` +
      `--${boundary}--\r\n`,
    "utf8"
  );
  const body = Buffer.concat([preamble, Buffer.from(audioBuffer), mid]);
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Whisper failed: ${t.slice(0, 200)}`);
  }
  return (await r.text()).trim();
}

async function groqTts(apiKey, text, lang = "ar", fishApiKey = "") {
  const model = lang === "en" ? TTS_EN : TTS_AR;
  const voice = lang === "en" ? "austin" : "fahad";
  const chunks = [];
  let rest = String(text || "").trim().slice(0, 800);
  try {
    while (rest.length) {
      const piece = rest.slice(0, 200);
      rest = rest.slice(200);
      const r = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: piece,
          voice,
          response_format: "wav",
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Orpheus TTS failed: ${t.slice(0, 200)}`);
      }
      chunks.push(Buffer.from(await r.arrayBuffer()));
    }
    return Buffer.concat(chunks);
  } catch (orpheusErr) {
    const fish = String(fishApiKey || "").trim();
    if (!fish) throw orpheusErr;
    // Optional Fish Audio fallback — short utterance only
    const input = String(text || "").trim().slice(0, 400);
    const r = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fish}`,
        "Content-Type": "application/json",
        model: "s1",
      },
      body: JSON.stringify({ text: input, format: "wav" }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Fish TTS failed after Orpheus: ${t.slice(0, 200)}`);
    }
    return Buffer.from(await r.arrayBuffer());
  }
}

function systemPrompt(licenseLabel) {
  return [
    "You are Amlak AI Staff, a full property-office employee for a Saudi real-estate office.",
    `Company/license label: ${licenseLabel || "Amlak buyer"}.`,
    "Reply in the user's language (Arabic or English). Be short and practical.",
    "You can explain next steps. For money writes you prepare a confirmation — do not claim the books are already changed unless a tool result says so.",
    "Never invent license keys, passwords, or other buyers' data.",
  ].join(" ");
}

async function logAction(licenseId, entry) {
  const ref = getFirestore().collection(COLLECTION).doc(licenseId).collection(ACTIONS).doc();
  await ref.set({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function handleAssistantChat(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const session = await resolveInAppSession(req, body);
  if (!session.ok) return res.status(session.status).json(session.body);

  const usage = await consumeAiStaffUsageTx(getFirestore(), FieldValue, session.licenseId, "text");
  if (!usage.ok) {
    return res.status(429).json({
      error: usage.messages?.message || "Cap reached",
      code: usage.reason === "inactive" ? "AI_STAFF_INACTIVE" : "AI_STAFF_CAP",
      ...usage.messages,
    });
  }

  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return res.status(400).json({ error: "message required" });

  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  const apiKey = session.cloud.groqApiKey;
  if (!apiKey) {
    return res.status(503).json({ error: "Groq API key not configured", code: "CONFIGURATION" });
  }

  let reply;
  let pendingAction = null;
  try {
    const loop = await runAssistantToolLoop(apiKey, session, message, history);
    reply = loop.reply;
    pendingAction = loop.pendingAction;
    if (loop.autoExecuted?.documentId) {
      await logAction(session.licenseId, {
        actionId: loop.autoExecuted.actionId || "transaction.create.v1",
        status: "completed",
        channel: "app",
        summary: loop.autoExecuted.summary || "Auto-executed trusted write",
        actorUid: session.uid,
        tool: loop.autoExecuted.tool || null,
        tenantDocId: loop.autoExecuted.exec?.created?.id || null,
      });
    }
  } catch (e) {
    try {
      const messages = [
        { role: "system", content: systemPrompt(session.license.data.label) },
        ...history
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
          .map((h) => ({ role: h.role, content: String(h.text).slice(0, 2000) })),
        { role: "user", content: message },
      ];
      reply = await geminiFlashChat(session.cloud.geminiApiKey, messages, 500);
    } catch {
      return res.status(502).json({ error: e?.message || "Model failed", code: "UNAVAILABLE" });
    }
  }

  let pendingToken = null;
  if (pendingAction) {
    pendingToken = crypto.randomBytes(16).toString("hex");
    await getFirestore()
      .collection(COLLECTION)
      .doc(session.licenseId)
      .collection(PENDING)
      .doc(pendingToken)
      .set({
        ...pendingAction,
        createdByUid: session.uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAtMs: Date.now() + 15 * 60 * 1000,
      });
  }

  await logAction(session.licenseId, {
    actionId: pendingAction ? pendingAction.actionId : "chat.reply.v1",
    status: "completed",
    channel: "app",
    summary: String(reply || "").slice(0, 240),
    actorUid: session.uid,
  });

  return res.status(200).json({
    message: reply,
    navigation: null,
    pendingAction: pendingAction
      ? { ...pendingAction, confirmToken: pendingToken }
      : undefined,
  });
}

function detectPendingAction() {
  return null;
}

async function handleAssistantConfirm(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const session = await resolveInAppSession(req, body);
  if (!session.ok) return res.status(session.status).json(session.body);

  const token = String(body.confirmToken || body.token || "").trim();
  if (!token) return res.status(400).json({ error: "confirmToken required" });

  const ref = getFirestore()
    .collection(COLLECTION)
    .doc(session.licenseId)
    .collection(PENDING)
    .doc(token);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Pending action not found" });
  const pending = snap.data() || {};
  if (pending.expiresAtMs && Date.now() > Number(pending.expiresAtMs)) {
    await ref.delete().catch(() => {});
    return res.status(410).json({ error: "Pending action expired" });
  }
  if (pending.createdByUid && pending.createdByUid !== session.uid) {
    return res.status(403).json({ error: "This confirmation belongs to another user" });
  }

  const autonomy = session.autonomy || "ask_money";
  if (
    pending.tool === "transaction.create.pending" &&
    autonomy === "suggest"
  ) {
    return res.status(403).json({ error: "Money writes are disabled in suggest-only autonomy" });
  }

  let execResult;
  try {
    const ctx = await buildTenantToolContext(session);
    execResult = await executePreparedAction(ctx, pending);
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Could not complete action", code: "WRITE_FAILED" });
  }

  const tenantDocId = execResult?.created?.id || null;
  const txStatus = execResult?.status || "created";
  const actionId = await logAction(session.licenseId, {
    actionId: pending.actionId || "action.confirm.v1",
    status: "completed",
    channel: "app",
    summary: pending.summary || "Confirmed action",
    actorUid: session.uid,
    tool: pending.tool || null,
    tenantDocId,
    tenantWriteStatus: txStatus,
  });
  await ref.delete().catch(() => {});

  const isPendingTx = pending.tool === "transaction.create.pending" && txStatus === "PENDING";
  return res.status(200).json({
    ok: true,
    message: isPendingTx
      ? "Entry filed as PENDING. An admin/manager can approve it in Approvals."
      : pending.tool === "task.create"
        ? "Task created successfully."
        : "Transaction recorded successfully.",
    actionHistoryId: actionId,
    tenantDocId,
    status: txStatus,
  });
}

async function handleAssistantWhatsApp(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(body);
  const session = await resolveWhatsAppSession(req, body, rawBody);
  if (!session.ok) return res.status(session.status).json(session.body);

  const kind = body.audioBase64 ? "voice" : "text";
  const usage = await consumeAiStaffUsageTx(getFirestore(), FieldValue, session.licenseId, kind);
  if (!usage.ok) {
    return res.status(429).json({
      error: usage.messages?.message || "Cap reached",
      code: usage.reason === "inactive" ? "AI_STAFF_INACTIVE" : "AI_STAFF_CAP",
      ack: true,
      text: usage.messages?.message,
      textAr: usage.messages?.ar,
      textEn: usage.messages?.en,
      ...usage.messages,
    });
  }

  const apiKey = session.cloud.groqApiKey;
  if (!apiKey) {
    return res.status(503).json({ error: "Groq API key not configured", code: "CONFIGURATION" });
  }

  let userText = String(body.message || body.text || "").trim().slice(0, 4000);
  if (body.audioBase64) {
    try {
      const buf = Buffer.from(String(body.audioBase64), "base64");
      userText = await groqTranscribe(apiKey, buf, String(body.filename || "note.ogg"));
    } catch (e) {
      return res.status(502).json({ error: e?.message || "STT failed", code: "UNAVAILABLE" });
    }
  }
  if (!userText) return res.status(400).json({ error: "Empty message" });

  const snapshot = session.license.data.aiStaffBriefingSnapshot || null;
  const snapshotNote = snapshot
    ? `Latest office snapshot (as of ${snapshot.asOf || "unknown"}): ${JSON.stringify({
        activeContracts: snapshot.activeContracts,
        overdueApprox: snapshot.overdueApprox?.length || 0,
        expiringSoon: snapshot.expiringSoon?.length || 0,
        openTasks: snapshot.openTasks?.length || 0,
        pendingTransactions: snapshot.pendingTransactions,
      })}`
  : "No live office snapshot yet — open the web app once so AI Staff can refresh data.";

  let reply;
  try {
    const chat = await groqChat(apiKey, {
      model: MODEL_FAST,
      messages: [
        {
          role: "system",
          content: [
            systemPrompt(session.license.data.label),
            "WhatsApp channel: read-only. You cannot write to the books from here.",
            "Use the office snapshot for overdue/expiry/task counts when relevant.",
            snapshotNote,
          ].join(" "),
        },
        { role: "user", content: userText },
      ],
      max_tokens: 350,
    });
    reply = String(chat.content || chat || "").trim();
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Model failed", code: "UNAVAILABLE" });
  }

  let audioBase64 = null;
  if (kind === "voice" || body.wantVoice) {
    try {
      const lang = /[\u0600-\u06FF]/.test(reply) ? "ar" : "en";
      const wav = await groqTts(apiKey, reply, lang, session.cloud.fishApiKey);
      audioBase64 = wav.toString("base64");
    } catch {
      /* text-first still succeeds */
    }
  }

  await logAction(session.licenseId, {
    actionId: "whatsapp.reply.v1",
    status: "completed",
    channel: "whatsapp",
    summary: String(reply || "").slice(0, 240),
    from: session.from || null,
  });

  return res.status(200).json({
    ok: true,
    ack: true,
    text: reply,
    audioBase64,
    audioMime: audioBase64 ? "audio/wav" : null,
  });
}

async function handleAssistantActionsList(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
  const body = req.method === "GET" ? req.query || {} : req.body || {};
  const session = await resolveInAppSession(req, body);
  if (!session.ok) return res.status(session.status).json(session.body);

  const limit = Math.min(50, Math.max(1, Number(body.limit) || 25));
  const snap = await getFirestore()
    .collection(COLLECTION)
    .doc(session.licenseId)
    .collection(ACTIONS)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const items = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    items.push({
      id: doc.id,
      actionId: d.actionId || "",
      status: d.status || "completed",
      summary: d.summary || "",
      channel: d.channel || "",
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
      reversible: false,
    });
  });
  return res.status(200).json({ ok: true, items, nextCursor: null });
}

async function handleAssistantBriefing(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  // Cron / HMAC or sales password
  const licenseId = String(body.licenseId || "").trim();
  if (!licenseId) return res.status(400).json({ error: "licenseId required" });

  const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(body);
  const hmac = verifyHmac({
    licenseId,
    timestamp: body.timestamp || req.headers["x-amlak-timestamp"],
    bodyRaw: rawBody,
    signature: body.signature || req.headers["x-amlak-signature"],
  });
  if (!hmac.ok) {
    const pw = String(body.salesConsolePassword || "");
    const expected = String(process.env.SALES_CONSOLE_PASSWORD || "").trim();
    if (!expected || pw !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const active = await assertAiStaffActive(licenseId);
  if (!active.ok) return res.status(active.status).json(active.body);

  const usage = await consumeAiStaffUsageTx(getFirestore(), FieldValue, licenseId, "text");
  if (!usage.ok) {
    return res.status(429).json({ error: usage.messages?.message, ...usage.messages });
  }

  const apiKey = active.cloud.groqApiKey;
  if (!apiKey) return res.status(503).json({ error: "Groq not configured" });

  const snapshot = active.license.data.aiStaffBriefingSnapshot || null;
  let dataBlock = "No cached office data — ask staff to open the web app to refresh.";
  if (snapshot) {
    dataBlock = JSON.stringify({
      asOf: snapshot.asOf,
      activeContracts: snapshot.activeContracts,
      expiringSoon: snapshot.expiringSoon || [],
      overdueApprox: snapshot.overdueApprox || [],
      openTasks: snapshot.openTasks || [],
      pendingTransactions: snapshot.pendingTransactions,
    }).slice(0, 3500);
  } else if (body.idToken) {
    try {
      const cfg = active.license.data.tenantFirebaseConfig || {};
      const projectId = String(cfg.projectId || "").trim();
      const verified = await verifyTenantIdToken(cfg.apiKey, String(body.idToken).trim());
      if (verified?.localId && !verified.isAnonymous) {
        const cache = new TenantDataCache(projectId, String(body.idToken).trim());
        const summary = buildOfficeSummary({
          contracts: await cache.contracts(),
          transactions: await cache.transactions(),
          tasks: await cache.tasks(),
          buildings: await cache.buildings(),
        });
        await persistBriefingSnapshot(licenseId, summary);
        dataBlock = JSON.stringify(summary).slice(0, 3500);
      }
    } catch {
      /* keep cached note */
    }
  }

  const chat = await groqChat(apiKey, {
    model: MODEL_FAST,
    messages: [
      {
        role: "system",
        content: systemPrompt(active.license.data.label),
      },
      {
        role: "user",
        content: `Write a short morning briefing for the office boss using this real office data:\n${dataBlock}\n\nMention overdue tenants, contracts ending soon, open tasks, and pending approvals when present. Keep under 140 words. Arabic and English both briefly if possible.`,
      },
    ],
    max_tokens: 320,
  });
  const text = chat.content || chat;

  await logAction(licenseId, {
    actionId: "briefing.morning.v1",
    status: "completed",
    channel: "system",
    summary: String(text || "").slice(0, 240),
  });

  return res.status(200).json({
    ok: true,
    text,
    snapshotAsOf: snapshot?.asOf || null,
    groupId: active.license.data.aiStaffGroupId || null,
    allowPhones: active.license.data.aiStaffAllowPhones || [],
  });
}

/** Persist hire metadata from buyer (called with Firebase token + licenseId). */
async function handleAssistantHireMeta(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  const session = await resolveInAppSession(req, body);
  if (!session.ok) return res.status(session.status).json(session.body);

  const phones = Array.isArray(body.allowPhones)
    ? body.allowPhones.map((p) => String(p).replace(/\D/g, "").slice(0, 15)).filter(Boolean).slice(0, 40)
    : null;
  const groupId = body.groupId !== undefined ? String(body.groupId || "").trim().slice(0, 80) : undefined;
  const autonomy = ["suggest", "ask_money", "trusted"].includes(body.autonomy)
    ? body.autonomy
    : undefined;
  const displayName = body.displayName !== undefined ? String(body.displayName || "").trim().slice(0, 80) : undefined;

  const patch = { aiStaffHireUpdatedAt: FieldValue.serverTimestamp() };
  if (phones) patch.aiStaffAllowPhones = phones;
  if (groupId !== undefined) patch.aiStaffGroupId = groupId;
  if (autonomy) patch.aiStaffAutonomy = autonomy;
  if (displayName !== undefined) patch.aiStaffDisplayName = displayName;

  await getFirestore().collection(COLLECTION).doc(session.licenseId).set(patch, { merge: true });
  return res.status(200).json({ ok: true });
}

module.exports = {
  verifyHmac,
  handleAssistantChat,
  handleAssistantConfirm,
  handleAssistantWhatsApp,
  handleAssistantActionsList,
  handleAssistantBriefing,
  handleAssistantHireMeta,
  MODEL_FAST,
  MODEL_TOOLS,
  STT_MODEL,
  detectPendingAction,
};

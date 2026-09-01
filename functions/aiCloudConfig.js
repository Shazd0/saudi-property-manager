/**
 * Shared AI Cloud config loader (Groq/Gemini/Fish + kill switch).
 * Used by licenseApi.js and aiStaffAssistant.js — avoid circular requires.
 */

const { getFirestore } = require("firebase-admin/firestore");
const { killSwitchOn } = require("./aiStaffPolicy");

const AI_CLOUD_DOC = "_server/ai_cloud";

function readAiCloudDocSync(data) {
  const d = data || {};
  return {
    groqKey: String(d.groqApiKey || "").trim(),
    geminiKey: String(d.geminiApiKey || "").trim(),
    fishKey: String(d.fishApiKey || "").trim(),
    killSwitch: !!d.killSwitch,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  };
}

async function loadAiCloudConfig() {
  const envGroq = String(process.env.GROQ_API_KEY || "").trim();
  const envGemini = String(process.env.GEMINI_API_KEY || "").trim();
  const envFish = String(process.env.FISH_API_KEY || "").trim();
  let doc = { groqKey: "", geminiKey: "", fishKey: "", killSwitch: false, updatedAt: null };
  try {
    const snap = await getFirestore().doc(AI_CLOUD_DOC).get();
    if (snap.exists) doc = readAiCloudDocSync(snap.data());
  } catch {
    /* ignore */
  }
  return {
    groqApiKey: doc.groqKey || envGroq,
    geminiApiKey: doc.geminiKey || envGemini,
    fishApiKey: doc.fishKey || envFish,
    killSwitch: doc.killSwitch || killSwitchOn(),
    updatedAt: doc.updatedAt,
    fromEnv: {
      groq: !doc.groqKey && !!envGroq,
      gemini: !doc.geminiKey && !!envGemini,
      fish: !doc.fishKey && !!envFish,
    },
  };
}

module.exports = {
  AI_CLOUD_DOC,
  loadAiCloudConfig,
  readAiCloudDocSync,
  maskKey(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    if (s.length <= 4) return "****";
    return `…${s.slice(-4)}`;
  },
};

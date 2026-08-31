/**
 * CORS allowlist for license-api-server.
 * Set LICENSE_CORS_ORIGINS=https://app.example.com,https://www.example.com (comma-separated).
 * In production (NODE_ENV=production), an empty allowlist exits the process.
 */
function parseOrigins(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createCorsMiddleware() {
  const cors = require("cors");
  const origins = parseOrigins(process.env.LICENSE_CORS_ORIGINS || process.env.CORS_ORIGINS);
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && origins.length === 0) {
    console.error(
      "[license-api] Set LICENSE_CORS_ORIGINS in production (comma-separated HTTPS origins for your hosted app)."
    );
    process.exit(1);
  }

  if (origins.length === 0) {
    return cors({ origin: true });
  }

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origins.includes("*") || origins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });
}

module.exports = { createCorsMiddleware, parseOrigins };

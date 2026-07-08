/**
 * CORS allowlist for license-api-server.
 * Set LICENSE_CORS_ORIGINS=https://app.example.com,https://www.example.com (comma-separated).
 * In production (NODE_ENV=production), an empty allowlist exits the process.
 *
 * Local dev: localhost, 127.0.0.1, and LAN IPs are always allowed (even if the allowlist
 * only lists http://127.0.0.1 — browsers treat that as a different origin than localhost).
 * Allowed origins are always echoed back as the exact request Origin header.
 */
function parseOrigins(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True for typical Vite / phone-on-LAN dev origins (any port). */
function isDevLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") {
      return true;
    }
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, explicitOrigins, isProd) {
  if (!origin) return true;
  if (explicitOrigins.includes("*") || explicitOrigins.includes(origin)) return true;
  if (!isProd && isDevLocalOrigin(origin)) return true;
  return false;
}

function createCorsMiddleware() {
  const cors = require("cors");
  const explicitOrigins = parseOrigins(process.env.LICENSE_CORS_ORIGINS || process.env.CORS_ORIGINS);
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && explicitOrigins.length === 0) {
    console.error(
      "[license-api] Set LICENSE_CORS_ORIGINS in production (comma-separated HTTPS origins for your hosted app)."
    );
    process.exit(1);
  }

  // Dev with no allowlist: reflect request Origin (localhost:5200, 127.0.0.1:5200, LAN IP, etc.)
  if (!isProd && explicitOrigins.length === 0) {
    return cors({ origin: true, credentials: true });
  }

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin, explicitOrigins, isProd)) {
        // Echo the exact request Origin (critical: localhost ≠ 127.0.0.1)
        return callback(null, origin);
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });
}

module.exports = { createCorsMiddleware, parseOrigins, isDevLocalOrigin, isAllowedOrigin };

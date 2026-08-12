import { z } from 'zod';

const optional = (schema) => z.preprocess((value) => value === '' ? undefined : value, schema.optional());

const EnvSchema = z.object({
  MCP_HOST: z.string().default('127.0.0.1'),
  MCP_PORT: z.coerce.number().int().min(1).max(65535).default(8791),
  MCP_OWNER_TOKEN: z.string().min(32).refine((token) =>
    new Set(token).size >= 10 && !/(change|generate|example|password|token)/i.test(token), 'must be a generated high-entropy secret'),
  MCP_OWNER_ID: z.string().min(1).max(128),
  MCP_ALLOWED_HOSTS: z.string().default('127.0.0.1,localhost'),
  MCP_DATABASE_URL: z.string().url(),
  MCP_COMMAND_DATABASE_URL: z.string().url(),
  MCP_MAC_TENANT_ID: z.string().trim().min(1).max(128),
  MCP_CRITICAL_ACTION_SECRET: z.string().min(32).refine((secret) =>
    new Set(secret).size >= 10 && !/(change|generate|example|password|secret)/i.test(secret), 'must be a generated high-entropy secret'),
  MCP_OWNER_ACCESS_TEAM_DOMAIN: z.string().url(),
  MCP_OWNER_ACCESS_ISSUER: z.string().url(),
  MCP_OWNER_ACCESS_AUD: z.string().trim().min(1).max(512),
  MCP_OWNER_ACCESS_EMAILS: z.string().trim().min(3),
  MCP_OWNER_WEB_CORS_ORIGINS: z.string().trim().min(1),
  ASSISTANT_CORS_ORIGINS: z.string().min(1),
  BUYER_FIREBASE_PROJECTS_JSON: optional(z.string()),
  AI_BASE_URL: optional(z.string().url()),
  AI_API_KEY: optional(z.string().min(1)),
  AI_MODEL: optional(z.string().min(1)),
  MCP_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  MCP_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(60),
  MCP_CONFIRMATION_TTL_MS: z.coerce.number().int().min(30_000).max(300_000).default(120_000),
  MCP_CRITICAL_REAUTH_MAX_AGE_MS: z.coerce.number().int().min(30_000).max(600_000).default(300_000),
});

export function loadConfig(env = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`MCP configuration invalid or missing: ${names}`);
  }
  const value = parsed.data;
  if (value.MCP_DATABASE_URL === value.MCP_COMMAND_DATABASE_URL) {
    throw new Error('MCP configuration invalid: read and command database roles must use distinct URLs');
  }
  const exactOrigins = (raw, name) => {
    const origins = raw.split(',').map((v) => v.trim()).filter(Boolean);
    if (origins.includes('*') || origins.some((origin) => {
      try {
        const url = new URL(origin);
        return url.origin !== origin || !['https:', 'http:'].includes(url.protocol);
      } catch {
        return true;
      }
    })) throw new Error(`MCP configuration invalid: ${name} must contain exact HTTP(S) origins`);
    return origins;
  };
  const assistantOrigins = exactOrigins(value.ASSISTANT_CORS_ORIGINS, 'ASSISTANT_CORS_ORIGINS');
  const ownerWebOrigins = exactOrigins(value.MCP_OWNER_WEB_CORS_ORIGINS, 'MCP_OWNER_WEB_CORS_ORIGINS');
  const ownerAccessEmails = value.MCP_OWNER_ACCESS_EMAILS.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!ownerAccessEmails.length || ownerAccessEmails.some((email) => {
    try {
      return !z.string().email().parse(email);
    } catch {
      return true;
    }
  })) throw new Error('MCP configuration invalid: MCP_OWNER_ACCESS_EMAILS must contain valid emails');
  const ownerAccessTeamDomain = value.MCP_OWNER_ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
  if (value.MCP_OWNER_ACCESS_ISSUER !== `${ownerAccessTeamDomain}/`) {
    throw new Error('MCP configuration invalid: MCP_OWNER_ACCESS_ISSUER must exactly match the team issuer');
  }
  return {
    host: value.MCP_HOST,
    port: value.MCP_PORT,
    ownerToken: value.MCP_OWNER_TOKEN,
    ownerId: value.MCP_OWNER_ID,
    allowedHosts: value.MCP_ALLOWED_HOSTS.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean),
    databaseUrl: value.MCP_DATABASE_URL,
    commandDatabaseUrl: value.MCP_COMMAND_DATABASE_URL,
    macTenantId: value.MCP_MAC_TENANT_ID,
    criticalActionSecret: value.MCP_CRITICAL_ACTION_SECRET,
    ownerAccessTeamDomain,
    ownerAccessIssuer: value.MCP_OWNER_ACCESS_ISSUER,
    ownerAccessAudience: value.MCP_OWNER_ACCESS_AUD,
    ownerAccessEmails,
    ownerWebOrigins,
    assistantOrigins,
    buyerProjectsJson: value.BUYER_FIREBASE_PROJECTS_JSON,
    ai: value.AI_BASE_URL && value.AI_MODEL ? {
      baseUrl: value.AI_BASE_URL.replace(/\/$/, ''),
      apiKey: value.AI_API_KEY,
      model: value.AI_MODEL,
    } : null,
    queryTimeoutMs: value.MCP_QUERY_TIMEOUT_MS,
    rateLimit: value.MCP_RATE_LIMIT,
    confirmationTtlMs: value.MCP_CONFIRMATION_TTL_MS,
    criticalReauthMaxAgeMs: value.MCP_CRITICAL_REAUTH_MAX_AGE_MS,
  };
}

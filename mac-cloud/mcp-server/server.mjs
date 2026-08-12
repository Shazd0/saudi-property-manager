import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z, ZodError } from 'zod';
import { answerAssistant } from './assistant.mjs';
import { createAutomationRepository } from '../automation-worker/repository.mjs';
import {
  AUTOMATION_TOOL_NAMES, AUTOMATION_TOOL_SCHEMAS, executeAutomationTool,
} from './automation-tools.mjs';
import { createBuyerIdentityProvider } from './buyer-provider.mjs';
import {
  COMMAND_ANNOTATIONS, COMMAND_TOOL_NAMES, COMMAND_TOOL_SCHEMAS, createCommandCore, executeCommandTool,
} from './command-core.mjs';
import { createCommandRepository } from './command-repository.mjs';
import {
  createCommandTargetRouter, MacCommandTargetAdapter,
} from './command-target-adapters.mjs';
import { loadConfig } from './config.mjs';
import { FirebaseBuyerCommandAdapter, parseBuyerCommandProjects } from './firebase-command-adapter.mjs';
import { createRepository } from './repository.mjs';
import { createCloudflareAccessVerifier, readCloudflareAccessJwt } from './owner-access.mjs';
import {
  normalizeOwnerListFilters,
  presentBuyerActionDetail,
  presentBuyerActionsPage,
  presentBuyerReversalRequest,
  presentOwnerActionDetail,
  presentOwnerActionsPage,
  presentOwnerPreparedRollback,
  presentOwnerReversalRequest,
} from './action-history-presenters.mjs';
import { assistantRequestSchema, ownerSchemas } from './schemas.mjs';
import { bearerToken, createRateLimiter, requestMetadata, secureEqual } from './security.mjs';
import {
  executeBuyerTool, executeOwnerTool, OWNER_TOOL_NAMES, READ_ONLY_ANNOTATIONS,
} from './tools.mjs';

function statusError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function safeError(error) {
  if (error instanceof ZodError) return { status: 400, code: 'INVALID_REQUEST', message: 'Request schema validation failed' };
  if (error?.type === 'entity.parse.failed') return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  if (error?.type === 'entity.too.large') return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  if (error?.status) return { status: error.status, code: error.code, message: error.message };
  const commandCodes = new Set([
    'ACTION_NOT_ALLOWED', 'COMMANDS_DISABLED', 'OWNER_REQUIRED', 'CRITICAL_REAUTH_REQUIRED',
    'COMMAND_NOT_FOUND', 'COMMAND_NOT_PREPARED', 'COMMAND_REPLAYED', 'CONFIRMATION_EXPIRED',
    'INVALID_CONFIRMATION', 'STALE_VERSION', 'NEGATIVE_STOCK', 'ADJUSTMENT_NOT_REVERSIBLE',
    'CREDIT_NOTE_EXISTS', 'APPROVAL_RESOLVED', 'TRANSFER_NOT_REVERSIBLE', 'NEGATIVE_BALANCE',
    'ACTION_NOT_SCHEDULABLE', 'TARGET_DENIED', 'TARGET_DISABLED', 'CAPABILITY_DENIED',
    'SCHEMA_VERSION_DENIED', 'ADAPTER_DISABLED', 'MAC_TENANT_NOT_CONFIGURED',
    'BUYER_ACTION_UNSUPPORTED', 'IDEMPOTENCY_CONFLICT', 'REMOTE_COMMAND_INCOMPLETE',
    'RECONCILIATION_NEEDED', 'DOCUMENT_EXISTS',
    'TRIGGER_UNAVAILABLE', 'DISPATCH_UNCONFIGURED',
    'ROLLBACK_WORKFLOW_REQUIRED', 'ROLLBACK_UNAVAILABLE', 'ROLLBACK_STALE',
    'ROLLBACK_ALREADY_EXISTS', 'REVERSAL_REQUEST_UNAVAILABLE', 'INVALID_CURSOR',
    'ACCESS_REAUTH_REQUIRED',
  ]);
  if (commandCodes.has(error?.code)) return { status: 409, code: error.code, message: error.message };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'The request could not be completed' };
}

async function audit(repository, req, principal, tool, bookId, outcome) {
  await repository.audit({
    actorType: principal.actorType,
    actorId: principal.actorId,
    buyerId: principal.buyerId,
    bookId,
    tool,
    outcome,
    metadata: requestMetadata(req),
  }).catch(() => {});
}

function createOwnerMcp(principal, repository, commandRepository, commandCore, automationRepository, req) {
  const server = new McpServer({ name: 'amlak-owner', version: '2.0.0' });
  for (const name of OWNER_TOOL_NAMES) {
    server.registerTool(name, {
      title: name,
      description: `Read-only owner operation: ${name}`,
      inputSchema: ownerSchemas[name],
      annotations: READ_ONLY_ANNOTATIONS,
    }, async (args) => {
      try {
        const result = await executeOwnerTool(name, args, principal, repository);
        await audit(repository, req, principal, name, args.bookId, 'success');
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        await audit(repository, req, principal, name, args?.bookId || 'unknown', 'denied');
        return { isError: true, content: [{ type: 'text', text: safeError(error).message }] };
      }
    });
  }
  if (commandRepository) {
    const historyTools = {
      'owner.action-history': z.object({
        status: z.enum(['prepared', 'executing', 'completed', 'failed', 'cancelled']).optional(),
        actionId: z.string().trim().min(1).max(128).optional(),
        adapter: z.enum(['mac', 'buyer']).optional(),
        cursor: z.string().max(1024).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }).strict(),
      'owner.action-detail': z.object({ id: z.string().uuid() }).strict(),
      'owner.reversal-requests': z.object({
        status: z.enum(['pending', 'prepared', 'completed', 'rejected', 'cancelled']).optional(),
        originalCommandId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }).strict(),
    };
    for (const [name, inputSchema] of Object.entries(historyTools)) {
      server.registerTool(name, {
        title: name,
        description: `Read-only owner action-history operation: ${name}`,
        inputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      }, async (args) => {
        try {
          const result = name === 'owner.action-history'
            ? await commandRepository.listActions(args)
            : name === 'owner.action-detail'
              ? await commandRepository.actionDetail(args.id)
              : await commandRepository.listReversalRequests(args);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          const safe = safeError(error);
          return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: safe }) }] };
        }
      });
    }
  }
  if (commandCore) {
    for (const name of COMMAND_TOOL_NAMES) {
      server.registerTool(name, {
        title: name,
        description: `Owner command operation: ${name}. Mutations require prepare then confirm.`,
        inputSchema: COMMAND_TOOL_SCHEMAS[name],
        annotations: name === 'command.status' || name === 'command.catalog'
          ? { ...COMMAND_ANNOTATIONS, readOnlyHint: true, destructiveHint: false, idempotentHint: true }
          : COMMAND_ANNOTATIONS,
      }, async (args) => {
        try {
          const result = await executeCommandTool(name, args, principal, commandCore);
          await audit(repository, req, principal, name, args?.input?.target?.bookId || 'command', 'success');
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          await audit(repository, req, principal, name, args?.input?.target?.bookId || 'command', 'denied');
          const safe = safeError(error);
          return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: { code: safe.code, message: safe.message } }) }] };
        }
      });
    }
  }
  if (automationRepository && commandCore) {
    for (const name of AUTOMATION_TOOL_NAMES) {
      const readOnly = name !== 'automation.prepare-trigger';
      server.registerTool(name, {
        title: name,
        description: readOnly ? `Read-only owner automation operation: ${name}` : 'Prepare a trigger; execution still requires command.confirm',
        inputSchema: AUTOMATION_TOOL_SCHEMAS[name],
        annotations: readOnly ? READ_ONLY_ANNOTATIONS : COMMAND_ANNOTATIONS,
      }, async (args) => {
        try {
          const result = await executeAutomationTool(name, args, principal, automationRepository, commandCore);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          const safe = safeError(error);
          return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: { code: safe.code, message: safe.message } }) }] };
        }
      });
    }
  }
  return server;
}

export function createApp({
  config, repository, commandRepository, commandCore, automationRepository,
  buyerProvider, ownerAccessVerifier, now, buyerIdByProject = {},
} = {}) {
  const app = express();
  const ownerLimiter = createRateLimiter({ limit: config.rateLimit, now });
  const buyerLimiter = createRateLimiter({ limit: config.rateLimit, now });
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb', type: ['application/json', 'application/*+json'] }));
  app.use((req, res, next) => {
    req.id = String(req.get('x-request-id') || randomUUID()).slice(0, 128);
    res.set('x-request-id', req.id);
    res.set('cache-control', 'no-store');
    req.setTimeout(config.queryTimeoutMs + 10_000);
    next();
  });
  app.use((req, _res, next) => {
    const allowed = config.allowedHosts || [config.host, 'localhost', '127.0.0.1'];
    if (!allowed.includes(String(req.hostname || '').toLowerCase())) {
      return next(statusError(400, 'HOST_DENIED', 'Host is not allowed'));
    }
    return next();
  });

  function requireOwner(req, _res, next) {
    if (!secureEqual(bearerToken(req.get('authorization')), config.ownerToken)) {
      return next(statusError(401, 'UNAUTHORIZED', 'Owner authentication failed'));
    }
    req.principal = { actorType: 'owner', actorId: config.ownerId, bookId: '*' };
    if (!ownerLimiter.consume(`owner:${config.ownerId}`).allowed) {
      return next(statusError(429, 'RATE_LIMITED', 'Too many requests'));
    }
    return next();
  }

  app.all('/mcp', requireOwner, async (req, res, next) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createOwnerMcp(req.principal, repository, commandRepository, commandCore, automationRepository, req);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    } finally {
      res.once('finish', () => server.close().catch(() => {}));
    }
  });

  function assistantCors(req, res, next) {
    const origin = req.get('origin');
    if (origin && !config.assistantOrigins.includes(origin)) {
      return next(statusError(403, 'ORIGIN_DENIED', 'Origin is not allowed'));
    }
    if (origin) res.set('access-control-allow-origin', origin).set('vary', 'Origin');
    res.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.set('access-control-allow-headers', 'Authorization, Content-Type, X-Amlak-Project-Id, X-Request-Id');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  }

  function ownerCors(req, res, next) {
    const origin = req.get('origin');
    if (origin) {
      if (!config.ownerWebOrigins?.includes(origin)) {
        return next(statusError(403, 'ORIGIN_DENIED', 'Origin is not allowed'));
      }
      res.set('access-control-allow-origin', origin).set('vary', 'Origin');
      res.set('access-control-allow-credentials', 'true');
    }
    res.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.set('access-control-allow-headers', 'Content-Type, Cf-Access-Jwt-Assertion, X-Request-Id');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  }

  async function requireOwnerAccess(req, _res, next) {
    try {
      if (!ownerAccessVerifier?.available) throw statusError(503, 'OWNER_AUTH_UNAVAILABLE', 'Owner web authentication is not configured');
      req.principal = await ownerAccessVerifier.verify(readCloudflareAccessJwt(req));
      if (!ownerLimiter.consume(`owner-web:${req.principal.actorId}`).allowed) {
        throw statusError(429, 'RATE_LIMITED', 'Too many requests');
      }
      next();
    } catch (error) {
      next(error);
    }
  }

  const uuidParam = z.string().uuid();
  const reasonBody = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();
  const ownerListQuery = z.object({
    status: z.enum(['prepared', 'executing', 'completed', 'failed', 'cancelled']).optional(),
    actionId: z.string().trim().min(1).max(128).optional(),
    adapter: z.enum(['mac', 'buyer']).optional(),
    tenantId: z.string().trim().min(1).max(128).optional(),
    bookId: z.string().trim().min(1).max(128).optional(),
    projectId: z.string().trim().min(1).max(128).optional(),
    buyerId: z.string().trim().min(1).max(128).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    cursor: z.string().max(1024).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).strict();
  const reversalListQuery = z.object({
    status: z.enum(['pending', 'prepared', 'completed', 'rejected', 'cancelled']).optional(),
    originalCommandId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).strict();
  const confirmBody = z.object({ confirmationToken: z.string().min(32).max(256) }).strict();
  const ownerRoutes = express.Router();
  ownerRoutes.use(ownerCors, requireOwnerAccess);
  ownerRoutes.get('/actions', async (req, res, next) => {
    try {
      const filters = normalizeOwnerListFilters(ownerListQuery.parse(req.query));
      const page = await commandRepository.listActions(filters);
      res.json(presentOwnerActionsPage(page, buyerIdByProject));
    } catch (error) { next(error); }
  });
  ownerRoutes.get('/actions/:id', async (req, res, next) => {
    try {
      const result = await commandRepository.actionDetail(uuidParam.parse(req.params.id));
      if (!result) throw statusError(404, 'ACTION_NOT_FOUND', 'Action was not found');
      res.json(presentOwnerActionDetail(result, buyerIdByProject));
    } catch (error) { next(error); }
  });
  ownerRoutes.get('/reversal-requests', async (req, res, next) => {
    try {
      const page = await commandRepository.listReversalRequests(reversalListQuery.parse(req.query));
      const items = Array.isArray(page?.items) ? page.items : Array.isArray(page) ? page : [];
      res.json({ items: items.map(presentOwnerReversalRequest) });
    } catch (error) { next(error); }
  });
  ownerRoutes.post('/actions/:id/prepare-reversal', async (req, res, next) => {
    try {
      const { reason } = reasonBody.parse(req.body);
      const prepared = await commandCore.prepareRollback({
        originalCommandId: uuidParam.parse(req.params.id), reason,
      }, req.principal);
      res.status(201).json(presentOwnerPreparedRollback(prepared));
    } catch (error) { next(error); }
  });
  ownerRoutes.post('/commands/:id/confirm', async (req, res, next) => {
    try {
      const { confirmationToken } = confirmBody.parse(req.body);
      const result = await commandCore.confirm({ commandId: uuidParam.parse(req.params.id), confirmationToken }, req.principal);
      res.json({
        commandId: result.commandId || uuidParam.parse(req.params.id),
        status: result.status,
        reconciliationNeeded: Boolean(result.reconciliationNeeded),
      });
    } catch (error) { next(error); }
  });
  ownerRoutes.post('/commands/:id/cancel', async (req, res, next) => {
    try {
      const result = await commandCore.cancel({ commandId: uuidParam.parse(req.params.id) }, req.principal);
      res.json({
        commandId: result.id || result.commandId || uuidParam.parse(req.params.id),
        status: result.status,
        reconciliationNeeded: false,
      });
    } catch (error) { next(error); }
  });
  app.options('/owner/actions', ownerCors);
  app.options('/owner/actions/:id', ownerCors);
  app.options('/owner/actions/:id/prepare-reversal', ownerCors);
  app.options('/owner/reversal-requests', ownerCors);
  app.options('/owner/commands/:id/confirm', ownerCors);
  app.options('/owner/commands/:id/cancel', ownerCors);
  app.use('/owner', ownerRoutes);

  async function requireBuyer(req, _res, next) {
    try {
      if (!buyerProvider.available) throw statusError(503, 'BUYER_AUTH_UNAVAILABLE', 'Buyer authentication is not configured');
      const projectId = String(req.get('x-amlak-project-id') || '');
      if (!projectId) throw statusError(401, 'UNAUTHORIZED', 'Buyer authentication failed');
      try {
        req.principal = await buyerProvider.verify({
          projectId,
          idToken: bearerToken(req.get('authorization')),
        });
      } catch {
        throw statusError(401, 'UNAUTHORIZED', 'Buyer authentication failed');
      }
      if (!['buyer_admin', 'manager'].includes(req.principal.role)) {
        throw statusError(403, 'ROLE_DENIED', 'Buyer role cannot access action history');
      }
      if (!buyerLimiter.consume(`buyer:${req.principal.buyerId}:${req.principal.actorId}`).allowed) {
        throw statusError(429, 'RATE_LIMITED', 'Too many requests');
      }
      next();
    } catch (error) { next(error); }
  }

  const assistantActions = express.Router({ mergeParams: true });
  assistantActions.get('/', async (req, res, next) => {
    try {
      const filters = normalizeOwnerListFilters(
        ownerListQuery.pick({
          status: true, actionId: true, cursor: true, limit: true, from: true, to: true, dateFrom: true, dateTo: true,
        }).parse(req.query),
      );
      const page = await commandRepository.listActions(filters, {
        tenantId: req.principal.tenantId,
        bookId: req.principal.bookId,
        projectId: req.principal.projectId,
      });
      res.json(presentBuyerActionsPage(page));
    } catch (error) { next(error); }
  });
  assistantActions.get('/:id', async (req, res, next) => {
    try {
      const result = await commandRepository.actionDetail(uuidParam.parse(req.params.id), {
        tenantId: req.principal.tenantId,
        bookId: req.principal.bookId,
        projectId: req.principal.projectId,
      });
      if (!result) throw statusError(404, 'ACTION_NOT_FOUND', 'Action was not found');
      res.json(presentBuyerActionDetail(result));
    } catch (error) { next(error); }
  });
  assistantActions.post('/:id/reversal-requests', async (req, res, next) => {
    try {
      const { reason } = reasonBody.parse(req.body);
      const created = await commandRepository.createReversalRequest({
        principal: {
          actorType: req.principal.actorType,
          actorId: req.principal.actorId,
          projectId: req.principal.projectId,
          tenantId: req.principal.tenantId,
          bookId: req.principal.bookId,
        },
        originalCommandId: uuidParam.parse(req.params.id),
        reason,
      });
      res.status(201).json(presentBuyerReversalRequest(created));
    } catch (error) { next(error); }
  });
  app.options('/assistant/actions', assistantCors);
  app.options('/assistant/actions/:id', assistantCors);
  app.options('/assistant/actions/:id/reversal-requests', assistantCors);
  app.use('/assistant/actions', assistantCors, requireBuyer, assistantActions);

  app.options('/assistant/chat', assistantCors);
  app.post('/assistant/chat', assistantCors, async (req, res, next) => {
    let principal;
    let tool = 'assistant.chat';
    try {
      if (!buyerProvider.available) throw statusError(503, 'BUYER_AUTH_UNAVAILABLE', 'Buyer authentication is not configured');
      const projectId = String(req.get('x-amlak-project-id') || '');
      if (!projectId) throw statusError(401, 'UNAUTHORIZED', 'Buyer authentication failed');
      try {
        principal = await buyerProvider.verify({
          projectId,
          idToken: bearerToken(req.get('authorization')),
        });
      } catch {
        throw statusError(401, 'UNAUTHORIZED', 'Buyer authentication failed');
      }
      if (!buyerLimiter.consume(`buyer:${principal.buyerId}:${principal.actorId}`).allowed) {
        throw statusError(429, 'RATE_LIMITED', 'Too many requests');
      }
      const request = assistantRequestSchema.parse(req.body);
      tool = request.tool || 'assistant.chat';
      const buyerRepository = await buyerProvider.repositoryFor(principal);
      const result = await answerAssistant({
        request,
        principal,
        repository: buyerRepository,
        execute: executeBuyerTool,
        ai: config.ai,
      });
      await audit(repository, req, principal, tool, principal.bookId, 'success');
      res.json(result);
    } catch (error) {
      if (principal) await audit(repository, req, principal, tool, principal.bookId, 'denied');
      next(error);
    }
  });

  app.get('/health', (_req, res) => res.json({
    ok: true,
    service: 'amlak-mcp',
    buyerAuthConfigured: buyerProvider.available,
    aiConfigured: Boolean(config.ai),
  }));

  app.use((error, _req, res, _next) => {
    const safe = safeError(error);
    res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  });
  return app;
}

export async function start(env = process.env) {
  const config = loadConfig(env);
  const repository = createRepository({ connectionString: config.databaseUrl, timeoutMs: config.queryTimeoutMs });
  const commandRepository = createCommandRepository({
    connectionString: config.commandDatabaseUrl,
    timeoutMs: config.queryTimeoutMs,
  });
  const automationRepository = createAutomationRepository({
    connectionString: config.commandDatabaseUrl,
    timeoutMs: config.queryTimeoutMs,
  });
  const buyerCommandProjects = parseBuyerCommandProjects(config.buyerProjectsJson);
  const buyerIdByProject = Object.fromEntries(
    Object.entries(buyerCommandProjects).map(([projectId, project]) => [projectId, project.buyerId]),
  );
  const targetRouter = createCommandTargetRouter({
    macAdapter: new MacCommandTargetAdapter({ tenantId: config.macTenantId }),
    buyerAdapter: new FirebaseBuyerCommandAdapter(buyerCommandProjects),
  });
  const commandCore = createCommandCore({
    repository: commandRepository,
    targetRouter,
    confirmationTtlMs: config.confirmationTtlMs,
    criticalSecret: config.criticalActionSecret,
    criticalReauthMaxAgeMs: config.criticalReauthMaxAgeMs,
  });
  const buyerProvider = createBuyerIdentityProvider(config.buyerProjectsJson);
  const ownerAccessVerifier = createCloudflareAccessVerifier({
    teamDomain: config.ownerAccessTeamDomain,
    issuer: config.ownerAccessIssuer,
    audience: config.ownerAccessAudience,
    allowedEmails: config.ownerAccessEmails,
  });
  const app = createApp({
    config, repository, commandRepository, commandCore, automationRepository,
    buyerProvider, ownerAccessVerifier, buyerIdByProject,
  });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Amlak MCP listening on http://${config.host}:${config.port}`);
  });
  const shutdown = () => server.close(async () => {
    await Promise.allSettled([repository.close(), commandRepository.close(), automationRepository.close(), buyerProvider.close()]);
    process.exit(0);
  });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

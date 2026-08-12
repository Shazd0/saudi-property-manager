import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { z } from 'zod';
import { bearerToken, secureEqual } from '../mcp-server/security.mjs';
import { createAutomationRepository } from './repository.mjs';
import { createAutomationWorker } from './worker.mjs';

const secret = z.string().min(43).refine((value) =>
  new Set(value).size >= 16 && !/(change|example|password|token|secret)/i.test(value));
const eventSchema = z.object({
  dedupeKey: z.string().trim().min(1).max(200),
  tenantId: z.string().trim().min(1).max(128),
  bookId: z.string().trim().min(1).max(128),
  eventType: z.string().trim().min(1).max(128).regex(/^[\w.:-]+$/),
  payload: z.record(z.string(), z.unknown()),
}).strict();

const parseMap = (value, name) => {
  if (!value) return {};
  try { return JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON`); }
};

export function createEventApp({ repository, eventToken, enforceSocketLoopback = true }) {
  secret.parse(eventToken);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.post('/internal/events', async (req, res, next) => {
    try {
      if (enforceSocketLoopback && req.socket.remoteAddress && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
        return res.status(403).json({ error: 'loopback only' });
      }
      if (!secureEqual(bearerToken(req.get('authorization')), eventToken)) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const event = eventSchema.parse(req.body);
      const result = await repository.ingestEvent(event);
      return res.status(result.duplicate ? 200 : 202).json({
        duplicate: result.duplicate, eventId: result.eventId,
        awaitingConfirmation: result.triggers.map((item) => item.id),
      });
    } catch (error) { return next(error); }
  });
  app.get('/health', async (_req, res) => res.json({ ok: true, ...(await repository.status()) }));
  app.use((error, _req, res, _next) => res.status(error?.issues ? 400 : 500).json({ error: 'request failed' }));
  return app;
}

export async function start(env = process.env) {
  const connectionString = env.AUTOMATION_DATABASE_URL;
  if (!connectionString) throw new Error('AUTOMATION_DATABASE_URL is required');
  const repository = createAutomationRepository({ connectionString });
  const worker = createAutomationWorker({
    repository,
    outboxEndpoints: parseMap(env.AUTOMATION_OUTBOX_ENDPOINTS_JSON, 'AUTOMATION_OUTBOX_ENDPOINTS_JSON'),
    jobEndpoints: parseMap(env.AUTOMATION_JOB_ENDPOINTS_JSON, 'AUTOMATION_JOB_ENDPOINTS_JSON'),
    serviceTokens: parseMap(env.AUTOMATION_SERVICE_TOKENS_JSON, 'AUTOMATION_SERVICE_TOKENS_JSON'),
    requestTimeoutMs: Number(env.AUTOMATION_REQUEST_TIMEOUT_MS || 10000),
  });
  if (process.argv.includes('--once')) {
    const result = await worker.once();
    console.log(JSON.stringify(result));
    await repository.close();
    return null;
  }
  const containerMode = env.AUTOMATION_CONTAINER_MODE === 'true';
  const app = createEventApp({
    repository, eventToken: env.AUTOMATION_EVENT_TOKEN, enforceSocketLoopback: !containerMode,
  });
  const port = Number(env.AUTOMATION_EVENT_PORT || 8792);
  const host = containerMode ? '0.0.0.0' : '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`Automation worker event endpoint on ${host}:${port}`));
  const controller = new AbortController();
  worker.run({ intervalMs: Number(env.AUTOMATION_POLL_MS || 5000), signal: controller.signal })
    .catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
  const shutdown = () => {
    controller.abort();
    server.close(async () => { await repository.close(); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => { console.error(error.message); process.exit(1); });
}

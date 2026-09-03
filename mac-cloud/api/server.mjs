import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  closePool,
  getDocument,
  healthcheck,
  listDocuments,
  saveDocument,
  softDeleteDocument,
} from '../lib/db.mjs';
import { attachSignaling } from '../lib/signaling.mjs';
import { pushIncomingCall } from '../lib/callPush.mjs';

const app = express();
const port = Number(process.env.PORT || 8787);
const apiToken = process.env.AMLAK_API_TOKEN || '';

const allowedOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-amlak-actor'],
}));
app.use(express.json({ limit: process.env.JSON_LIMIT || '50mb' }));

function requireToken(req, res, next) {
  if (!apiToken || apiToken === 'change-me-local-token') return next();
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (token === apiToken) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function parseFilters(query) {
  const filters = {};
  for (const [key, value] of Object.entries(query || {})) {
    if (!key.startsWith('filter.')) continue;
    filters[key.slice('filter.'.length)] = value;
  }
  return filters;
}

function bookIdFromReq(req) {
  return String(req.query.bookId || req.body?.bookId || 'default');
}

app.get('/api/health', async (_req, res, next) => {
  try {
    const db = await healthcheck();
    res.json({ ok: true, service: 'amlak-api', db });
  } catch (error) {
    next(error);
  }
});

app.get('/api/collections/:collection', requireToken, async (req, res, next) => {
  try {
    const items = await listDocuments({
      bookId: bookIdFromReq(req),
      collectionName: req.params.collection,
      includeDeleted: req.query.includeDeleted === 'true',
      orderField: req.query.orderField ? String(req.query.orderField) : undefined,
      orderDirection: req.query.orderDirection ? String(req.query.orderDirection) : 'desc',
      filters: parseFilters(req.query),
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/collections/:collection/:id', requireToken, async (req, res, next) => {
  try {
    const item = await getDocument({
      bookId: bookIdFromReq(req),
      collectionName: req.params.collection,
      docId: req.params.id,
      includeDeleted: req.query.includeDeleted === 'true',
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json({ item });
  } catch (error) {
    next(error);
  }
});

app.post('/api/collections/:collection', requireToken, async (req, res, next) => {
  try {
    const item = await saveDocument({
      bookId: bookIdFromReq(req),
      collectionName: req.params.collection,
      data: req.body?.data || req.body || {},
      actor: req.get('x-amlak-actor') || undefined,
    });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.put('/api/collections/:collection/:id', requireToken, async (req, res, next) => {
  try {
    const existing = req.query.merge === 'true'
      ? await getDocument({
          bookId: bookIdFromReq(req),
          collectionName: req.params.collection,
          docId: req.params.id,
          includeDeleted: true,
        })
      : null;
    const item = await saveDocument({
      bookId: bookIdFromReq(req),
      collectionName: req.params.collection,
      docId: req.params.id,
      data: {
        ...(existing || {}),
        ...(req.body?.data || req.body || {}),
        id: req.params.id,
      },
      actor: req.get('x-amlak-actor') || undefined,
    });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/collections/:collection/:id', requireToken, async (req, res, next) => {
  try {
    const item = await softDeleteDocument({
      bookId: bookIdFromReq(req),
      collectionName: req.params.collection,
      docId: req.params.id,
      actor: req.get('x-amlak-actor') || undefined,
    });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

app.post('/api/migrations/firebase-to-postgres', requireToken, (_req, res) => {
  res.status(202).json({
    accepted: true,
    message: 'Run the migration container with: docker compose -f docker-compose.mac-mini.yml --profile migration run --rm migration node migrate/firebase-to-postgres.mjs --all',
  });
});

let signalingHub = null;

app.post('/api/calls/ring', requireToken, async (req, res, next) => {
  try {
    const session = req.body?.session || req.body;
    if (!session?.id || !session?.calleeIds?.length) {
      return res.status(400).json({ error: 'session with id and calleeIds required' });
    }
    const payload = {
      type: 'incoming-call',
      session,
      at: Date.now(),
    };
    const results = {};
    for (const calleeId of session.calleeIds) {
      const delivered = signalingHub?.sendToUser(calleeId, payload);
      if (!delivered) signalingHub?.queueRing(calleeId, payload);
      results[calleeId] = !!delivered;
    }

    // FCM push — wakes phone/desktop even when app is fully closed (WhatsApp-style)
    pushIncomingCall(session).catch((err) => {
      console.warn('Call push failed:', err?.message || err);
    });

    res.json({ ok: true, delivered: results });
  } catch (error) {
    next(error);
  }
});

app.get('/api/calls/pending', requireToken, (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const rings = signalingHub?.getPendingRings(userId) || [];
  res.json({ rings });
});

app.delete('/api/calls/pending', requireToken, (req, res) => {
  const userId = String(req.query.userId || '');
  const sessionId = String(req.query.sessionId || '');
  if (!userId || !sessionId) return res.status(400).json({ error: 'userId and sessionId required' });
  signalingHub?.clearPendingRing(userId, sessionId);
  res.json({ ok: true });
});

app.get('/api/calls/online/:userId', requireToken, (req, res) => {
  res.json({ online: !!signalingHub?.isUserOnline(req.params.userId) });
});

/** Proxy ZATCA signer (Mac Mini docker service) — used by Netlify /zatca-api. */
app.all('/zatca/*', async (req, res) => {
  const upstream = String(process.env.ZATCA_UPSTREAM_URL || 'http://zatca:3002').replace(/\/+$/, '');
  const target = `${upstream}${req.originalUrl || req.url}`;
  try {
    const headers = { accept: 'application/json' };
    const ct = req.get('content-type');
    if (ct) headers['content-type'] = ct;
    const init = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(55000),
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
      init.body = JSON.stringify(req.body);
    }
    const r = await fetch(target, init);
    const text = await r.text();
    res.status(r.status);
    const outType = r.headers.get('content-type') || 'application/json';
    res.setHeader('content-type', outType);
    res.send(text);
  } catch (error) {
    const msg = error?.message || String(error);
    res.status(502).json({ error: `ZATCA signer unavailable: ${msg}` });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error?.message || 'Internal server error' });
});

const server = app.listen(port, () => {
  signalingHub = attachSignaling(server, apiToken);
  console.log(`Amlak Mac API listening on ${port} (REST + WebSocket /api/signaling/ws)`);
});

async function shutdown() {
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

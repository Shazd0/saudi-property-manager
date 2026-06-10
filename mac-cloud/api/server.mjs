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

const app = express();
const port = Number(process.env.PORT || 8787);
const apiToken = process.env.AMLAK_API_TOKEN || '';

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error?.message || 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`Amlak Mac API listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

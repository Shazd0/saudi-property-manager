import { getAdminDb } from './lib/firebase-admin-app.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorFingerprint(payload) {
  return `${payload.kind || ''}|${payload.message || ''}|${payload.route || ''}`.slice(0, 500);
}

async function findRecentDuplicate(db, fingerprint) {
  const recentSnap = await db.collection('runtime_errors').orderBy('createdAt', 'desc').limit(40).get();
  return recentSnap.docs.find((d) => d.data()?.fingerprint === fingerprint) || null;
}

function buildCursorPrompt(payload) {
  return [
    'A user hit a runtime error in the Amlak property manager web app (saudi-property-manager repo).',
    'Analyze the error, find the root cause in the codebase, implement a minimal fix, open a pull request to main, and merge it automatically when checks pass.',
    '',
    `Error kind: ${payload.kind || 'unknown'}`,
    `Message: ${payload.message || '(empty)'}`,
    payload.stack ? `Stack:\n${payload.stack}` : '',
    `URL: ${payload.url || ''}`,
    `Route: ${payload.route || ''}`,
    payload.userId ? `User: ${payload.userId}` : '',
    payload.bookId ? `Book: ${payload.bookId}` : '',
    payload.source ? `Source file: ${payload.source}${payload.line ? `:${payload.line}` : ''}` : '',
  ].filter(Boolean).join('\n');
}

async function notifyCursorAutomation(docId, payload) {
  const webhook = String(process.env.CURSOR_AUTOMATION_WEBHOOK_URL || '').trim();
  if (!webhook) return { skipped: true, reason: 'CURSOR_AUTOMATION_WEBHOOK_URL not set' };

  const secret = String(process.env.CURSOR_AUTOMATION_WEBHOOK_SECRET || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;

  const res = await fetch(webhook, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event: 'runtime_error',
      id: docId,
      project: 'saudi-property-manager',
      repo: process.env.GITHUB_REPO || 'shazaaad/saudi-property-manager',
      branch: process.env.GITHUB_BASE_BRANCH || 'main',
      payload,
      cursorPrompt: buildCursorPrompt(payload),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cursor webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: true };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  try {
    const body = await req.json();
    const message = String(body?.message || '').trim();
    if (!message) return json(400, { error: 'message is required' });

    const record = {
      message: message.slice(0, 4000),
      stack: String(body?.stack || '').slice(0, 12000) || null,
      kind: String(body?.kind || 'error'),
      url: String(body?.url || ''),
      route: String(body?.route || ''),
      userAgent: String(body?.userAgent || '').slice(0, 500),
      userId: body?.userId ? String(body.userId) : null,
      bookId: body?.bookId ? String(body.bookId) : null,
      source: body?.source ? String(body.source) : null,
      line: typeof body?.line === 'number' ? body.line : null,
      column: typeof body?.column === 'number' ? body.column : null,
      status: 'open',
      cursorStatus: 'pending',
      fingerprint: '',
      createdAt: new Date().toISOString(),
    };
    record.fingerprint = errorFingerprint(record);

    const db = getAdminDb();
    const duplicate = await findRecentDuplicate(db, record.fingerprint);
    if (duplicate) {
      return json(200, { ok: true, id: duplicate.id, duplicate: true, cursor: { skipped: true, reason: 'duplicate' } });
    }

    const ref = await db.collection('runtime_errors').add(record);

    let cursor = { skipped: true };
    try {
      cursor = await notifyCursorAutomation(ref.id, { ...record, id: ref.id });
      if (cursor.ok) {
        await ref.update({ cursorStatus: 'sent', cursorSentAt: new Date().toISOString() });
      }
    } catch (error) {
      await ref.update({
        cursorStatus: 'failed',
        cursorError: String(error?.message || error).slice(0, 500),
      });
    }

    return json(200, { ok: true, id: ref.id, cursor });
  } catch (error) {
    console.error('report-runtime-error failed', error);
    return json(500, { error: error?.message || 'Failed to report error' });
  }
};

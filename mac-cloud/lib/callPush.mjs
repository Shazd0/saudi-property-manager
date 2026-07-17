import { listDocuments } from './db.mjs';

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function getPushTokensForUsers(userIds = []) {
  const tokens = new Set();
  const cutoff = Date.now() - TOKEN_MAX_AGE_MS;

  for (const userId of userIds) {
    if (!userId) continue;
    const items = await listDocuments({
      collectionName: 'userTokens',
      filters: { userId: String(userId) },
    });
    for (const item of items) {
      const activeAt = item.lastActive || item.updatedAt || item.createdAt || 0;
      if (item.token && activeAt > cutoff) tokens.add(String(item.token));
    }
  }

  return [...tokens];
}

export async function pushIncomingCall(session) {
  const pushUrl = process.env.FCM_PUSH_URL || process.env.PUSH_SERVER_URL || '';
  if (!pushUrl) return { ok: false, skipped: true, reason: 'FCM_PUSH_URL not configured' };

  const calleeIds = session?.calleeIds || [];
  const tokens = await getPushTokensForUsers(calleeIds);
  if (!tokens.length) return { ok: false, skipped: true, reason: 'no tokens for callees' };

  const base = pushUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/send-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokens, session }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: text || res.statusText };
  }

  return res.json();
}

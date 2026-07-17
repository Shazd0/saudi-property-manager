import { WebSocketServer } from 'ws';

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const userSockets = new Map();

/** @type {Map<string, object[]>} */
const pendingRings = new Map();

export function attachSignaling(server, apiToken) {
  const wss = new WebSocketServer({ server, path: '/api/signaling/ws' });

  wss.on('connection', (ws, req) => {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const token = url.searchParams.get('token')
      || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const userId = url.searchParams.get('userId');

    if (apiToken && apiToken !== 'change-me-local-token' && token !== apiToken) {
      ws.close(4401, 'Unauthorized');
      return;
    }
    if (!userId) {
      ws.close(4400, 'userId required');
      return;
    }

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        handleClientMessage(userId, msg);
      } catch {
        // ignore malformed payloads
      }
    });

    ws.on('close', () => {
      userSockets.get(userId)?.delete(ws);
      if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
    });

    ws.send(JSON.stringify({ type: 'connected', userId }));

    const queued = pendingRings.get(userId) || [];
    if (queued.length > 0) {
      queued.forEach((payload) => ws.send(JSON.stringify(payload)));
      pendingRings.delete(userId);
    }
  });

  return {
    sendToUser,
    sendToUsers,
    isUserOnline,
    queueRing,
    getPendingRings,
    clearPendingRing,
  };
}

function handleClientMessage(fromUserId, msg) {
  if (msg.type === 'signal' && msg.toUserId && msg.sessionId) {
    sendToUser(msg.toUserId, { ...msg, fromUserId });
    return;
  }
  if (msg.type === 'ping') {
    sendToUser(fromUserId, { type: 'pong', at: Date.now() });
  }
}

export function sendToUser(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;
  const data = JSON.stringify(payload);
  let sent = false;
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      ws.send(data);
      sent = true;
    }
  }
  return sent;
}

export function sendToUsers(userIds, payload) {
  let any = false;
  for (const id of userIds) {
    if (sendToUser(id, payload)) any = true;
  }
  return any;
}

export function isUserOnline(userId) {
  const sockets = userSockets.get(userId);
  return !!sockets && [...sockets].some((ws) => ws.readyState === 1);
}

export function queueRing(userId, payload) {
  const list = pendingRings.get(userId) || [];
  list.push({ ...payload, queuedAt: Date.now() });
  pendingRings.set(userId, list.slice(-5));
}

export function getPendingRings(userId) {
  return pendingRings.get(userId) || [];
}

export function clearPendingRing(userId, sessionId) {
  const list = pendingRings.get(userId) || [];
  const next = list.filter((r) => r.session?.id !== sessionId && r.sessionId !== sessionId);
  if (next.length === 0) pendingRings.delete(userId);
  else pendingRings.set(userId, next);
}

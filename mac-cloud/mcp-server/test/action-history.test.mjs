import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { actionCatalog, getAction } from '../actions.mjs';
import { createCommandCore, createCriticalReauthProofForTest } from '../command-core.mjs';
import { createCommandTargetRouter, MacCommandTargetAdapter } from '../command-target-adapters.mjs';
import { loadConfig } from '../config.mjs';
import { FirebaseBuyerCommandAdapter } from '../firebase-command-adapter.mjs';
import { createCloudflareAccessVerifier } from '../owner-access.mjs';
import { createApp } from '../server.mjs';

const servers = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))));

const OWNER_ORIGIN = 'https://owner.example';
const BUYER_ORIGIN = 'https://buyer.example';
const TEAM = 'https://example.cloudflareaccess.com';
const AUD = 'owner-aud';
const EMAIL = 'owner@example.com';
const nowMs = 1_700_000_000_000;

function baseEnv(overrides = {}) {
  return {
    MCP_OWNER_TOKEN: 'S3cur3-owner-auth-with-high-entropy-01234567',
    MCP_OWNER_ID: 'owner-1',
    MCP_DATABASE_URL: 'postgres://read:x@127.0.0.1:5432/amlak',
    MCP_COMMAND_DATABASE_URL: 'postgres://command:y@127.0.0.1:5432/amlak',
    MCP_MAC_TENANT_ID: 'tenant-1',
    MCP_CRITICAL_ACTION_SECRET: 'S3cur3-critical-auth-with-high-entropy-98765',
    ASSISTANT_CORS_ORIGINS: BUYER_ORIGIN,
    MCP_OWNER_ACCESS_TEAM_DOMAIN: TEAM,
    MCP_OWNER_ACCESS_ISSUER: `${TEAM}/`,
    MCP_OWNER_ACCESS_AUD: AUD,
    MCP_OWNER_ACCESS_EMAILS: EMAIL,
    MCP_OWNER_WEB_CORS_ORIGINS: OWNER_ORIGIN,
    MCP_CRITICAL_REAUTH_MAX_AGE_MS: '300000',
    ...overrides,
  };
}

function memoryFirestore() {
  const rows = new Map();
  return {
    rows,
    collection(collection) {
      return { doc: (id) => ({ firestore: this, collection, id, path: `${collection}/${id}` }) };
    },
    snapshot(ref) {
      const value = rows.get(ref.path);
      return {
        exists: value !== undefined,
        id: ref.id,
        ref,
        data: () => value && structuredClone(value),
        updateTime: { toDate: () => new Date('2026-08-08T00:00:00.000Z') },
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const tx = {
        get: async (ref) => this.snapshot(ref),
        create: (ref, data) => writes.push(['create', ref, structuredClone(data)]),
        set: (ref, data) => writes.push(['set', ref, structuredClone(data)]),
        delete: (ref) => writes.push(['delete', ref]),
      };
      const result = await callback(tx);
      for (const [operation, ref, data] of writes) {
        if (operation === 'create' && rows.has(ref.path)) throw new Error('already exists');
        if (operation === 'delete') rows.delete(ref.path);
        else rows.set(ref.path, data);
      }
      return result;
    },
  };
}

function fakeCommandRepository() {
  const commands = new Map();
  const reversals = new Map();
  return {
    commands,
    reversals,
    async emergencyDisabled() { return false; },
    async commandAction(id, actorId) {
      const item = commands.get(id);
      return item?.actorId === actorId ? item.actionId : null;
    },
    async prepare(command) {
      for (const existing of commands.values()) {
        if (existing.rollbackOfCommandId && existing.rollbackOfCommandId === command.rollbackOfCommandId
          && ['prepared', 'executing', 'completed'].includes(existing.status)) {
          throw Object.assign(new Error('already'), { code: 'ROLLBACK_ALREADY_EXISTS' });
        }
      }
      const key = `${command.actorId}:${command.actionId}:${command.idempotencyKey}`;
      for (const existing of commands.values()) {
        if (`${existing.actorId}:${existing.actionId}:${existing.idempotencyKey}` === key) {
          return {
            id: existing.id, action_id: existing.actionId, status: existing.status,
            preview: existing.preview, confirmation_expires_at: existing.expiresAt, existing: true,
          };
        }
      }
      commands.set(command.id, { ...command, status: 'prepared' });
      return {
        id: command.id, action_id: command.actionId, status: 'prepared', preview: command.preview,
        confirmation_expires_at: command.expiresAt, existing: false,
      };
    },
    async status(id, actorId) {
      const item = commands.get(id);
      return item?.actorId === actorId ? { id, action_id: item.actionId, status: item.status } : null;
    },
    async cancel(id, actorId) {
      const item = commands.get(id);
      if (!item || item.actorId !== actorId || item.status !== 'prepared') {
        throw Object.assign(new Error('Prepared command not found'), { code: 'COMMAND_NOT_PREPARED' });
      }
      item.status = 'cancelled';
      for (const reversal of reversals.values()) {
        if (reversal.prepared_rollback_command_id === id && reversal.status === 'prepared') {
          reversal.status = 'cancelled';
        }
      }
      return { id, status: 'cancelled' };
    },
    async confirm({ id, actorId, tokenHash, execute, resolveTarget }) {
      const item = commands.get(id);
      if (!item || item.actorId !== actorId) throw Object.assign(new Error('missing'), { code: 'COMMAND_NOT_FOUND' });
      if (item.status !== 'prepared' || item.tokenHash !== tokenHash) {
        throw Object.assign(new Error('replay'), { code: 'COMMAND_REPLAYED' });
      }
      const resolved = resolveTarget({ target: item.target, actionId: item.actionId });
      const result = await execute({
        transaction: {
          async rollbackCommand(input) {
            return { originalCommandId: input.originalCommandId, reversedOperations: [{ collection: 'transactions', documentId: 'tx-1' }] };
          },
        },
        resolved,
        command: { id, actionId: item.actionId, actorId },
        storedInput: item.input,
      });
      item.status = 'completed';
      item.tokenHash = null;
      item.result = result;
      for (const reversal of reversals.values()) {
        if (reversal.prepared_rollback_command_id === id && reversal.status === 'prepared') {
          reversal.status = 'completed';
        }
      }
      return { commandId: id, status: 'completed', result };
    },
    async listActions(filters = {}, scope = {}) {
      const items = [...commands.values()]
        .filter((item) => !scope.tenantId || item.target.tenantId === scope.tenantId)
        .filter((item) => !scope.bookId || item.target.bookId === scope.bookId)
        .filter((item) => !scope.projectId || item.target.projectId === scope.projectId)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.actionId || item.actionId === filters.actionId)
        .map((item) => ({
          id: item.id,
          actionId: item.actionId,
          actorId: item.actorId,
          status: item.status,
          target: item.target,
          preview: item.preview || { summary: `${item.actionId} preview`, sideEffects: [] },
          preparedAt: item.preparedAt || '2026-08-08T00:00:00.000Z',
          completedAt: item.completedAt,
          reconciliationNeeded: Boolean(item.reconciliationNeeded),
          rollbackSupported: item.status === 'completed' && item.actionId !== 'command.rollback.v1' && item.hasAudit,
          rollbackUnavailableReason: item.status === 'completed' ? undefined : 'Only completed commands can be rolled back',
          secretToken: 'should-not-leak',
        }));
      return { items, nextCursor: null };
    },
    async actionDetail(id, scope = {}) {
      const item = commands.get(id);
      if (!item) return null;
      if (scope.tenantId && item.target.tenantId !== scope.tenantId) return null;
      if (scope.bookId && item.target.bookId !== scope.bookId) return null;
      if (scope.projectId && item.target.projectId !== scope.projectId) return null;
      return {
        id: item.id,
        actionId: item.actionId,
        status: item.status,
        target: item.target,
        rollbackSupported: item.status === 'completed' && item.actionId !== 'command.rollback.v1' && item.hasAudit !== false,
        rollbackUnavailableReason: item.hasAudit === false ? 'No immutable data-operation audit is available' : undefined,
        operations: item.operations || [],
        password: 'raw-secret',
      };
    },
    async createReversalRequest({ principal, originalCommandId, reason }) {
      const item = commands.get(originalCommandId);
      if (!item || item.status !== 'completed' || item.target.tenantId !== principal.tenantId
        || item.target.bookId !== principal.bookId) {
        throw Object.assign(new Error('unavailable'), { code: 'ROLLBACK_UNAVAILABLE' });
      }
      for (const existing of reversals.values()) {
        if (existing.original_command_id === originalCommandId && ['pending', 'prepared'].includes(existing.status)) {
          return existing;
        }
      }
      const row = {
        id: `rev-${reversals.size + 1}`,
        original_command_id: originalCommandId,
        status: 'pending',
        reason,
        requester_actor_id: principal.actorId,
        project_id: principal.projectId || null,
        tenant_id: principal.tenantId,
        book_id: principal.bookId,
        created_at: new Date().toISOString(),
      };
      reversals.set(row.id, row);
      return row;
    },
    async listReversalRequests(filters = {}, scope = {}) {
      const items = [...reversals.values()].filter((item) => {
        if (scope.tenantId && item.tenant_id !== scope.tenantId) return false;
        if (scope.bookId && item.book_id !== scope.bookId) return false;
        if (scope.projectId && item.project_id !== scope.projectId) return false;
        if (filters.status && item.status !== filters.status) return false;
        return true;
      });
      return { items };
    },
    async getReversalRequestForAction(originalCommandId) {
      return [...reversals.values()].find((item) => item.original_command_id === originalCommandId
        && ['pending', 'prepared'].includes(item.status)) || null;
    },
    async markReversalPrepared({ requestId, reviewerActorId, rollbackCommandId }) {
      const item = reversals.get(requestId);
      if (!item || !['pending', 'prepared'].includes(item.status)) {
        throw Object.assign(new Error('unavailable'), { code: 'REVERSAL_REQUEST_UNAVAILABLE' });
      }
      item.status = 'prepared';
      item.reviewer_actor_id = reviewerActorId;
      item.prepared_rollback_command_id = rollbackCommandId;
      return item;
    },
  };
}

async function serve(options = {}) {
  const commandRepository = options.commandRepository || fakeCommandRepository();
  const verifier = options.ownerAccessVerifier || createCloudflareAccessVerifier({
    teamDomain: TEAM,
    issuer: `${TEAM}/`,
    audience: AUD,
    allowedEmails: [EMAIL],
    now: () => nowMs,
    jwtVerifyFn: options.jwtVerifyFn || (async (token) => {
      if (token !== 'valid-access') throw new Error('bad token');
      return { payload: { email: EMAIL, iat: Math.floor(nowMs / 1000), aud: AUD, iss: `${TEAM}/` } };
    }),
  });
  const targetRouter = createCommandTargetRouter({
    macAdapter: new MacCommandTargetAdapter({ tenantId: 'tenant-1' }),
  });
  const commandCore = createCommandCore({
    repository: commandRepository,
    targetRouter,
    criticalSecret: 'S3cur3-critical-auth-with-high-entropy-98765',
    criticalReauthMaxAgeMs: 300_000,
    now: () => nowMs,
  });
  const app = createApp({
    config: {
      host: '127.0.0.1',
      ownerToken: 'a'.repeat(48),
      ownerId: 'owner-1',
      assistantOrigins: [BUYER_ORIGIN],
      ownerWebOrigins: [OWNER_ORIGIN],
      rateLimit: 50,
      queryTimeoutMs: 1000,
      criticalReauthMaxAgeMs: 300_000,
      ai: null,
      ...options.config,
    },
    repository: { async documents() { return []; }, async audit() {}, async close() {} },
    commandRepository,
    commandCore,
    buyerProvider: options.buyerProvider || { available: false },
    ownerAccessVerifier: verifier,
  });
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, commandRepository, commandCore };
}

describe('Cloudflare Access owner auth', () => {
  test('validates issuer, audience, email, and recent iat; fails closed when misconfigured', async () => {
    const good = createCloudflareAccessVerifier({
      teamDomain: TEAM, issuer: `${TEAM}/`, audience: AUD, allowedEmails: [EMAIL], now: () => nowMs,
      jwtVerifyFn: async () => ({ payload: { email: EMAIL, iat: Math.floor(nowMs / 1000) } }),
    });
    assert.equal((await good.verify('tok')).actorId, EMAIL);

    await assert.rejects(() => createCloudflareAccessVerifier({
      teamDomain: TEAM, issuer: `${TEAM}/`, audience: AUD, allowedEmails: [EMAIL], now: () => nowMs,
      jwtVerifyFn: async () => { throw new Error('bad aud'); },
    }).verify('tok'));

    await assert.rejects(() => createCloudflareAccessVerifier({
      teamDomain: TEAM, issuer: `${TEAM}/`, audience: AUD, allowedEmails: [EMAIL], now: () => nowMs,
      jwtVerifyFn: async () => ({ payload: { email: 'other@example.com', iat: Math.floor(nowMs / 1000) } }),
    }).verify('tok'));

    assert.equal(createCloudflareAccessVerifier({}).available, false);
    assert.throws(() => loadConfig(baseEnv({ MCP_OWNER_ACCESS_ISSUER: 'https://evil.example/' })), /issuer/i);
    assert.throws(() => loadConfig(baseEnv({ MCP_OWNER_WEB_CORS_ORIGINS: '*' })), /origins/i);
    assert.throws(() => loadConfig(baseEnv({ MCP_OWNER_ACCESS_EMAILS: '' })), /invalid or missing/i);
  });

  test('browser owner API never accepts MCP_OWNER_TOKEN', async () => {
    const { base } = await serve();
    const denied = await fetch(`${base}/owner/actions`, {
      headers: {
        origin: OWNER_ORIGIN,
        authorization: `Bearer ${'a'.repeat(48)}`,
      },
    });
    assert.equal(denied.status, 401);
    const allowed = await fetch(`${base}/owner/actions`, {
      headers: { origin: OWNER_ORIGIN, 'cf-access-jwt-assertion': 'valid-access' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('cache-control'), 'no-store');
  });
});

describe('owner prepare-then-confirm rollback flow', () => {
  test('lists details with filters and requires prepare then explicit confirm', async () => {
    const { base, commandRepository } = await serve();
    const originalId = '11111111-1111-4111-8111-111111111111';
    commandRepository.commands.set(originalId, {
      id: originalId,
      actorId: 'system',
      actionId: 'transaction.create.v1',
      status: 'completed',
      target: { adapter: 'mac', tenantId: 'tenant-1', bookId: 'book-1' },
      hasAudit: true,
      operations: [{ collection: 'transactions', documentId: 'tx-1', operation: 'create' }],
    });
    const listed = await fetch(`${base}/owner/actions?status=completed&actionId=transaction.create.v1`, {
      headers: { origin: OWNER_ORIGIN, 'cf-access-jwt-assertion': 'valid-access' },
    });
    assert.equal(listed.status, 200);
    const listBody = await listed.json();
    assert.equal(listBody.items.length, 1);
    assert.equal(listBody.items[0].actionId, 'transaction.create.v1');
    assert.equal(listBody.items[0].rollbackSupport, 'supported');
    assert.match(listBody.items[0].summary, /transaction\.create\.v1|transaction · create/);
    assert.equal(listBody.items[0].secretToken, undefined);
    assert.equal(listBody.items[0].tenantId, 'tenant-1');

    const prepared = await fetch(`${base}/owner/actions/${originalId}/prepare-reversal`, {
      method: 'POST',
      headers: {
        origin: OWNER_ORIGIN,
        'content-type': 'application/json',
        'cf-access-jwt-assertion': 'valid-access',
      },
      body: JSON.stringify({ reason: 'Correct mistaken transaction entry' }),
    });
    assert.equal(prepared.status, 201);
    const preparedBody = await prepared.json();
    assert.ok(preparedBody.confirmationToken);
    assert.equal(preparedBody.actionId, 'command.rollback.v1');
    assert.equal(typeof preparedBody.preview.exactTarget, 'string');
    assert.equal(typeof preparedBody.preview.checkpoint, 'boolean');
    assert.ok(Array.isArray(preparedBody.preview.sideEffects));

    const confirmed = await fetch(`${base}/owner/commands/${preparedBody.commandId}/confirm`, {
      method: 'POST',
      headers: {
        origin: OWNER_ORIGIN,
        'content-type': 'application/json',
        'cf-access-jwt-assertion': 'valid-access',
      },
      body: JSON.stringify({ confirmationToken: preparedBody.confirmationToken }),
    });
    assert.equal(confirmed.status, 200);
    assert.equal((await confirmed.json()).status, 'completed');
  });

  test('rejects stale Access iat before prepare-reversal and never auto-confirms', async () => {
    const { base, commandRepository } = await serve({
      jwtVerifyFn: async () => ({ payload: { email: EMAIL, iat: Math.floor((nowMs - 301_000) / 1000) } }),
    });
    const originalId = '22222222-2222-4222-8222-222222222222';
    commandRepository.commands.set(originalId, {
      id: originalId, actorId: 'system', actionId: 'transaction.create.v1', status: 'completed',
      target: { adapter: 'mac', tenantId: 'tenant-1', bookId: 'book-1' }, hasAudit: true,
    });
    const response = await fetch(`${base}/owner/actions/${originalId}/prepare-reversal`, {
      method: 'POST',
      headers: {
        origin: OWNER_ORIGIN,
        'content-type': 'application/json',
        'cf-access-jwt-assertion': 'valid-access',
      },
      body: JSON.stringify({ reason: 'Needs fresh Access session' }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'ACCESS_REAUTH_REQUIRED');
    assert.equal([...commandRepository.commands.values()].some((item) => item.actionId === 'command.rollback.v1'), false);
  });
});

describe('buyer action history isolation', () => {
  test('denies non-privileged roles, scopes by server project, sanitizes DTOs, and allows reversal requests only', async () => {
    const commandRepository = fakeCommandRepository();
    const localId = '33333333-3333-4333-8333-333333333333';
    const otherId = '44444444-4444-4444-8444-444444444444';
    commandRepository.commands.set(localId, {
      id: localId, actorId: 'owner', actionId: 'transaction.create.v1', status: 'completed',
      target: { adapter: 'buyer', projectId: 'proj-a', tenantId: 'tenant-a', bookId: 'book-a' }, hasAudit: true,
    });
    commandRepository.commands.set(otherId, {
      id: otherId, actorId: 'owner', actionId: 'transaction.create.v1', status: 'completed',
      target: { adapter: 'buyer', projectId: 'proj-b', tenantId: 'tenant-b', bookId: 'book-b' }, hasAudit: true,
    });
    const buyerProvider = {
      available: true,
      async verify({ projectId }) {
        if (projectId !== 'proj-a') throw new Error('bad project');
        return {
          actorType: 'buyer', actorId: 'uid-1', projectId: 'proj-a', buyerId: 'buyer-a',
          tenantId: 'tenant-a', bookId: 'book-a', role: 'buyer_admin', buildingIds: [], allBuildings: true,
        };
      },
    };
    const { base } = await serve({ commandRepository, buyerProvider });
    const deniedProvider = {
      available: true,
      async verify() {
        return {
          actorType: 'buyer', actorId: 'uid-2', projectId: 'proj-a', buyerId: 'buyer-a',
          tenantId: 'tenant-a', bookId: 'book-a', role: 'buyer', buildingIds: ['b1'], allBuildings: false,
        };
      },
    };
    const deniedServe = await serve({ commandRepository, buyerProvider: deniedProvider });
    const denied = await fetch(`${deniedServe.base}/assistant/actions`, {
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
      },
    });
    assert.equal(denied.status, 403);

    const listed = await fetch(`${base}/assistant/actions`, {
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
      },
    });
    assert.equal(listed.status, 200);
    const body = await listed.json();
    assert.deepEqual(body.items.map((item) => item.id), [localId]);
    assert.equal(body.items[0].title, 'transaction · create');
    assert.equal(body.items[0].rollbackSupported, true);
    assert.equal(body.items[0].secretToken, undefined);
    assert.equal(body.items[0].password, undefined);
    assert.equal(body.items[0].target, undefined);

    const detail = await fetch(`${base}/assistant/actions/${localId}`, {
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
      },
    });
    assert.equal(detail.status, 200);
    const detailBody = await detail.json();
    assert.equal(detailBody.password, undefined);
    assert.ok(Array.isArray(detailBody.details));
    assert.equal(detailBody.details[0].label, 'Action');

    const foreign = await fetch(`${base}/assistant/actions/${otherId}`, {
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
      },
    });
    assert.equal(foreign.status, 404);

    const requested = await fetch(`${base}/assistant/actions/${localId}/reversal-requests`, {
      method: 'POST',
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Buyer asks owner to reverse this entry' }),
    });
    assert.equal(requested.status, 201);
    assert.equal((await requested.json()).status, 'pending');

    const confirmProbe = await fetch(`${base}/assistant/commands/${localId}/confirm`, {
      method: 'POST',
      headers: {
        origin: BUYER_ORIGIN,
        authorization: 'Bearer buyer-token',
        'x-amlak-project-id': 'proj-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirmationToken: 'x'.repeat(32) }),
    });
    assert.equal(confirmProbe.status, 404);
  });
});

describe('rollback catalog and firebase parity', () => {
  test('catalog marks rollback support conservatively and blocks recursive rollback', () => {
    const rollback = getAction('command.rollback.v1');
    assert.equal(rollback.critical, true);
    assert.equal(rollback.rollbackAction, true);
    const catalog = Object.fromEntries(actionCatalog().map((item) => [item.actionId, item]));
    assert.equal(catalog['transaction.create.v1'].rollbackSupported, true);
    assert.equal(catalog['external.send.v1'].rollbackSupported, false);
    assert.equal(catalog['backup.restore.v1'].rollbackSupported, false);
    assert.equal(catalog['command.rollback.v1'].rollbackSupported, false);
    assert.match(catalog['external.send.v1'].rollbackUnsupportedReason, /not generically rollbackable|external/i);
  });

  test('firebase rollback reverses audited operations and isolates buyers', async () => {
    const firestoreA = memoryFirestore();
    const firestoreB = memoryFirestore();
    const adapter = new FirebaseBuyerCommandAdapter({
      'proj-a': {
        buyerId: 'buyer-a', tenantId: 'tenant-a', bookId: 'book-a', schemaVersion: 1, enabled: true,
        capabilities: ['transaction.create.v1', 'command.rollback.v1'],
        serviceAccount: { project_id: 'proj-a', client_email: 'a@x.com', private_key: 'k' },
      },
      'proj-b': {
        buyerId: 'buyer-b', tenantId: 'tenant-b', bookId: 'book-b', schemaVersion: 1, enabled: true,
        capabilities: ['transaction.create.v1', 'command.rollback.v1'],
        serviceAccount: { project_id: 'proj-b', client_email: 'b@x.com', private_key: 'k' },
      },
    }, {
      firestoreForProject: (projectId) => (projectId === 'proj-a' ? firestoreA : firestoreB),
    });
    const action = getAction('transaction.create.v1');
    const target = { adapter: 'buyer', projectId: 'proj-a', tenantId: 'tenant-a', bookId: 'book-a' };
    const input = action.schema.parse({
      target, idempotencyKey: 'create-a', documentId: 'tx-1', data: { amount: 10 },
    });
    const created = await adapter.execute({
      resolved: adapter.validate({ target, actionId: action.id }),
      action, input, command: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', actorId: 'owner', actionId: action.id },
    });
    assert.equal(created.result.id, 'tx-1');
    assert.equal(firestoreA.rows.get('transactions/tx-1').amount, 10);

    const rollback = getAction('command.rollback.v1');
    const rollbackInput = rollback.schema.parse({
      target, idempotencyKey: 'rollback:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      originalCommandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reason: 'Undo create',
    });
    const rolled = await adapter.execute({
      resolved: adapter.validate({ target, actionId: rollback.id }),
      action: rollback, input: rollbackInput,
      command: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', actorId: 'owner', actionId: rollback.id },
    });
    assert.equal(rolled.result.originalCommandId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(firestoreA.rows.has('transactions/tx-1'), false);
    assert.ok(firestoreA.rows.get('__mcpCommandAudits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));

    firestoreB.rows.set('transactions/tx-1', { amount: 99, tenantId: 'tenant-b', buyerId: 'buyer-b', bookId: 'book-b' });
    await assert.rejects(() => adapter.execute({
      resolved: adapter.validate({
        target: { adapter: 'buyer', projectId: 'proj-b', tenantId: 'tenant-b', bookId: 'book-b' },
        actionId: rollback.id,
      }),
      action: rollback,
      input: rollback.schema.parse({
        target: { adapter: 'buyer', projectId: 'proj-b', tenantId: 'tenant-b', bookId: 'book-b' },
        idempotencyKey: 'rollback-b',
        originalCommandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        reason: 'cross buyer denied',
      }),
      command: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', actorId: 'owner', actionId: rollback.id },
    }), (error) => error.code === 'ROLLBACK_UNAVAILABLE');
  });

  test('direct command.rollback prepare outside workflow is denied', async () => {
    const repository = fakeCommandRepository();
    const core = createCommandCore({
      repository,
      targetRouter: createCommandTargetRouter({ macAdapter: new MacCommandTargetAdapter({ tenantId: 'tenant-1' }) }),
      criticalSecret: 'S3cur3-critical-auth-with-high-entropy-98765',
      now: () => nowMs,
    });
    const proof = createCriticalReauthProofForTest({
      ownerId: 'owner-1', actionId: 'command.rollback.v1',
      secret: 'S3cur3-critical-auth-with-high-entropy-98765', timestamp: nowMs,
    });
    await assert.rejects(() => core.prepare({
      actionId: 'command.rollback.v1',
      criticalReauthProof: proof,
      input: {
        target: { adapter: 'mac', tenantId: 'tenant-1', bookId: 'book-1' },
        idempotencyKey: 'direct',
        originalCommandId: '11111111-1111-4111-8111-111111111111',
        reason: 'should fail',
      },
    }, { actorType: 'owner', actorId: 'owner-1' }), (error) => error.code === 'ROLLBACK_WORKFLOW_REQUIRED');
  });
});

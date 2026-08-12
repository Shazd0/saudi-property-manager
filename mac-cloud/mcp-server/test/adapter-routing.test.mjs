import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { getAction } from '../actions.mjs';
import { createCommandCore } from '../command-core.mjs';
import {
  createCommandTargetRouter, DisabledPostgresTenantCommandAdapter, MacCommandTargetAdapter,
} from '../command-target-adapters.mjs';
import { createBuyerIdentityProvider } from '../buyer-provider.mjs';
import { FirebaseBuyerCommandAdapter, parseBuyerCommandProjects } from '../firebase-command-adapter.mjs';

const serviceAccount = (projectId) => ({
  project_id: projectId,
  client_email: `mcp@${projectId}.example.com`,
  private_key: 'not-used-by-injected-test-firestore',
});
const project = (projectId, overrides = {}) => ({
  buyerId: `buyer-${projectId}`,
  tenantId: `tenant-${projectId}`,
  bookId: `book-${projectId}`,
  schemaVersion: 1,
  capabilities: ['transaction.create.v1'],
  enabled: true,
  serviceAccount: serviceAccount(projectId),
  ...overrides,
});

class MemoryFirestore {
  constructor() {
    this.rows = new Map();
    this.transactionCount = 0;
  }

  collection(collection) {
    return {
      doc: (id) => ({ firestore: this, collection, id, path: `${collection}/${id}` }),
    };
  }

  snapshot(ref) {
    const value = this.rows.get(ref.path);
    return {
      exists: value !== undefined,
      id: ref.id,
      ref,
      data: () => value && structuredClone(value),
      updateTime: { toDate: () => new Date('2026-08-08T00:00:00.000Z') },
    };
  }

  async runTransaction(callback) {
    this.transactionCount += 1;
    const writes = [];
    const tx = {
      get: async (ref) => this.snapshot(ref),
      create: (ref, data) => writes.push(['create', ref, structuredClone(data)]),
      set: (ref, data) => writes.push(['set', ref, structuredClone(data)]),
      delete: (ref) => writes.push(['delete', ref]),
    };
    const result = await callback(tx);
    for (const [operation, ref, data] of writes) {
      if (operation === 'create' && this.rows.has(ref.path)) throw new Error('already exists');
      if (operation === 'delete') this.rows.delete(ref.path);
      else this.rows.set(ref.path, data);
    }
    return result;
  }
}

function centralRepository(localTx) {
  const commands = new Map();
  return {
    commands,
    async emergencyDisabled() { return false; },
    async prepare(command) {
      commands.set(command.id, { ...command, status: 'prepared' });
      return {
        id: command.id, action_id: command.actionId, status: 'prepared', preview: command.preview,
        confirmation_expires_at: command.expiresAt, existing: false,
      };
    },
    async confirm({ id, actorId, tokenHash, resolveTarget, execute }) {
      const command = commands.get(id);
      assert.equal(command.actorId, actorId);
      assert.equal(command.tokenHash, tokenHash);
      const resolved = resolveTarget({ target: command.target, actionId: command.actionId });
      const result = await execute({
        transaction: resolved.adapter.remote ? null : localTx,
        resolved,
        command: { id, actionId: command.actionId, actorId },
        storedInput: command.input,
      });
      command.status = 'completed';
      command.result = result.result ?? result;
      return { commandId: id, status: 'completed', result: command.result };
    },
    async cancel() {},
    async status() {},
  };
}

const owner = { actorType: 'owner', actorId: 'owner-1' };
const hash = (value) => createHash('sha256').update(value).digest('hex');

describe('command target routing', () => {
  test('legacy buyer project entries receive secure compatible defaults', () => {
    const json = JSON.stringify({
      legacy: {
        buyerId: 'legacy-buyer', bookId: 'legacy-book', serviceAccount: serviceAccount('legacy'),
      },
    });
    const parsed = parseBuyerCommandProjects(json);
    assert.equal(parsed.legacy.tenantId, 'legacy-buyer');
    assert.equal(parsed.legacy.schemaVersion, 1);
    assert.deepEqual(parsed.legacy.capabilities, []);
    assert.equal(parsed.legacy.enabled, true);
    assert.deepEqual(createBuyerIdentityProvider(json).projects.legacy.capabilities, []);
  });

  test('buyer commands never receive or mutate the Mac transaction', async () => {
    const firebase = new MemoryFirestore();
    const buyerAdapter = new FirebaseBuyerCommandAdapter({ p1: project('p1') }, {
      firestoreForProject: () => firebase,
    });
    let macMutations = 0;
    const repository = centralRepository({
      async createDocument() { macMutations += 1; return {}; },
    });
    const core = createCommandCore({
      repository,
      targetRouter: createCommandTargetRouter({
        macAdapter: new MacCommandTargetAdapter({ tenantId: 'mac-tenant' }),
        buyerAdapter,
      }),
      criticalSecret: 'S3cur3-critical-secret-with-high-entropy-987',
    });
    const prepared = await core.prepare({
      actionId: 'transaction.create.v1',
      input: {
        target: { adapter: 'buyer', projectId: 'p1', tenantId: 'tenant-p1', bookId: 'book-p1' },
        idempotencyKey: 'buyer-create', documentId: 'tx-1', data: { amount: 10 },
      },
    }, owner);
    assert.equal(repository.commands.get(prepared.commandId).tokenHash, hash(prepared.confirmationToken));
    await core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, owner);
    assert.equal(macMutations, 0);
    assert.equal(firebase.rows.get('transactions/tx-1').tenantId, 'tenant-p1');
  });

  test('Mac targets require the configured tenant and buyer targets require the server map', () => {
    const buyer = new FirebaseBuyerCommandAdapter({
      p1: project('p1'),
      disabled: project('disabled', { enabled: false }),
      versioned: project('versioned', { schemaVersion: 2 }),
      limited: project('limited', { capabilities: ['contract.create.v1'] }),
    }, { firestoreForProject: () => new MemoryFirestore() });
    const router = createCommandTargetRouter({
      macAdapter: new MacCommandTargetAdapter({ tenantId: 'mac-tenant' }),
      buyerAdapter: buyer,
    });
    assert.doesNotThrow(() => router.resolve({
      target: { adapter: 'mac', tenantId: 'mac-tenant', bookId: 'book' }, actionId: 'transaction.create.v1',
    }));
    assert.throws(() => router.resolve({
      target: { adapter: 'mac', tenantId: 'wrong', bookId: 'book' }, actionId: 'transaction.create.v1',
    }), (error) => error.code === 'TARGET_DENIED');
    for (const target of [
      { adapter: 'buyer', projectId: 'missing', tenantId: 'tenant-p1', bookId: 'book-p1' },
      { adapter: 'buyer', projectId: 'p1', tenantId: 'wrong', bookId: 'book-p1' },
      { adapter: 'buyer', projectId: 'p1', tenantId: 'tenant-p1', bookId: 'wrong' },
      { adapter: 'buyer', projectId: 'disabled', tenantId: 'tenant-disabled', bookId: 'book-disabled' },
      { adapter: 'buyer', projectId: 'versioned', tenantId: 'tenant-versioned', bookId: 'book-versioned' },
      { adapter: 'buyer', projectId: 'limited', tenantId: 'tenant-limited', bookId: 'book-limited' },
    ]) assert.throws(() => router.resolve({ target, actionId: 'transaction.create.v1' }));
  });

  test('future PostgreSQL tenant adapter is disabled by default', async () => {
    const adapter = new DisabledPostgresTenantCommandAdapter();
    assert.equal(adapter.enabled, false);
    assert.throws(() => adapter.validate({}), (error) => error.code === 'ADAPTER_DISABLED');
    await assert.rejects(() => adapter.execute({}), (error) => error.code === 'ADAPTER_DISABLED');
  });
});

describe('Firebase buyer command idempotency and isolation', () => {
  test('same command ID replays the immutable remote result without duplicate writes', async () => {
    const firestore = new MemoryFirestore();
    const adapter = new FirebaseBuyerCommandAdapter({ p1: project('p1') }, { firestoreForProject: () => firestore });
    const target = { adapter: 'buyer', projectId: 'p1', tenantId: 'tenant-p1', bookId: 'book-p1' };
    const resolved = adapter.validate({ target, actionId: 'transaction.create.v1' });
    const action = getAction('transaction.create.v1');
    const input = action.schema.parse({ target, idempotencyKey: 'same', documentId: 'tx-1', data: { amount: 25 } });
    const command = { id: '123e4567-e89b-12d3-a456-426614174000', actionId: action.id, actorId: 'owner' };
    const first = await adapter.execute({ resolved, action, input, command });
    const second = await adapter.execute({ resolved, action, input, command });
    assert.equal(first.idempotentReplay, false);
    assert.equal(second.idempotentReplay, true);
    assert.deepEqual(second.result, first.result);
    assert.equal([...firestore.rows.keys()].filter((key) => key === 'transactions/tx-1').length, 1);
    assert.equal(firestore.rows.get(`__mcpCommandAudits/${command.id}`).immutable, true);
  });

  test('two configured buyers remain isolated even with identical document IDs', async () => {
    const stores = { p1: new MemoryFirestore(), p2: new MemoryFirestore() };
    const adapter = new FirebaseBuyerCommandAdapter({ p1: project('p1'), p2: project('p2') }, {
      firestoreForProject: (projectId) => stores[projectId],
    });
    const action = getAction('transaction.create.v1');
    for (const projectId of ['p1', 'p2']) {
      const target = {
        adapter: 'buyer', projectId, tenantId: `tenant-${projectId}`, bookId: `book-${projectId}`,
      };
      const resolved = adapter.validate({ target, actionId: action.id });
      const input = action.schema.parse({
        target, idempotencyKey: projectId, documentId: 'same-id', data: { source: projectId },
      });
      await adapter.execute({
        resolved, action, input,
        command: { id: projectId === 'p1' ? '123e4567-e89b-12d3-a456-426614174001' : '123e4567-e89b-12d3-a456-426614174002', actionId: action.id, actorId: 'owner' },
      });
    }
    assert.equal(stores.p1.rows.get('transactions/same-id').source, 'p1');
    assert.equal(stores.p2.rows.get('transactions/same-id').source, 'p2');
    assert.notEqual(stores.p1.rows.get('transactions/same-id').tenantId, stores.p2.rows.get('transactions/same-id').tenantId);
  });

  test('buyer infrastructure routes centrally without Firebase or Mac document writes', async () => {
    const firestore = new MemoryFirestore();
    const config = project('p1', { capabilities: ['report.export.v1'] });
    const adapter = new FirebaseBuyerCommandAdapter({ p1: config }, { firestoreForProject: () => firestore });
    const target = { adapter: 'buyer', projectId: 'p1', tenantId: 'tenant-p1', bookId: 'book-p1' };
    const action = getAction('report.export.v1');
    const input = action.schema.parse({ target, idempotencyKey: 'report', report: 'vat', format: 'pdf' });
    const resolved = adapter.validate({ target, actionId: action.id });
    let jobs = 0;
    const result = await adapter.execute({
      transaction: {
        async createCheckpoint() { return { id: 'checkpoint' }; },
        async enqueueJob() { jobs += 1; return { id: 'job', status: 'queued' }; },
      },
      resolved, action, input,
      command: { id: '123e4567-e89b-12d3-a456-426614174003', actionId: action.id, actorId: 'owner' },
    });
    assert.equal(result.status, 'queued');
    assert.equal(jobs, 1);
    assert.equal(firestore.rows.size, 0);
  });
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { ACTION_REGISTRY, actionCatalog, getAction } from '../actions.mjs';
import { createCommandCore, createCriticalReauthProofForTest } from '../command-core.mjs';
import { createCommandTargetRouter, MacCommandTargetAdapter } from '../command-target-adapters.mjs';

const principal = { actorType: 'owner', actorId: 'owner-1', bookId: '*' };
const target = { adapter: 'mac', tenantId: 'tenant-1', bookId: 'book-1' };
const digest = (value) => createHash('sha256').update(value).digest('hex');

function fakeRepository({ now = () => Date.now(), tx = {} } = {}) {
  const commands = new Map();
  const keys = new Map();
  return {
    commands,
    disabled: false,
    rolledBack: false,
    async emergencyDisabled() { return this.disabled; },
    async commandAction(id, actorId) {
      const item = commands.get(id);
      return item?.actorId === actorId ? item.actionId : null;
    },
    async prepare(command) {
      const key = `${command.actorId}:${command.actionId}:${command.idempotencyKey}`;
      const existingId = keys.get(key);
      if (existingId) {
        const existing = commands.get(existingId);
        return { id: existing.id, action_id: existing.actionId, status: existing.status, preview: existing.preview, confirmation_expires_at: existing.expiresAt, existing: true };
      }
      commands.set(command.id, { ...command, status: 'prepared' });
      keys.set(key, command.id);
      return { id: command.id, action_id: command.actionId, status: 'prepared', preview: command.preview, confirmation_expires_at: command.expiresAt, existing: false };
    },
    async status(id, actorId) {
      const item = commands.get(id);
      return item?.actorId === actorId ? { id, action_id: item.actionId, status: item.status, result: item.result } : null;
    },
    async cancel(id, actorId) {
      const item = commands.get(id);
      if (!item || item.actorId !== actorId || item.status !== 'prepared') throw new Error('Prepared command not found');
      item.status = 'cancelled'; item.tokenHash = null;
      return { id, status: 'cancelled' };
    },
    async confirm({ id, actorId, tokenHash, execute, resolveTarget }) {
      const item = commands.get(id);
      if (!item || item.actorId !== actorId) throw Object.assign(new Error('not found'), { code: 'COMMAND_NOT_FOUND' });
      if (item.status !== 'prepared') throw Object.assign(new Error('replayed'), { code: 'COMMAND_REPLAYED' });
      if (item.expiresAt.getTime() <= now()) throw Object.assign(new Error('expired'), { code: 'CONFIRMATION_EXPIRED' });
      if (item.tokenHash !== tokenHash) throw Object.assign(new Error('invalid'), { code: 'INVALID_CONFIRMATION' });
      try {
        const resolved = resolveTarget({ target: item.target, actionId: item.actionId });
        const result = await execute({
          transaction: tx, resolved, command: { id, actionId: item.actionId, actorId }, storedInput: item.input,
        });
        item.status = 'completed'; item.tokenHash = null; item.result = result;
        return { commandId: id, status: 'completed', result };
      } catch (error) {
        this.rolledBack = true;
        item.status = 'failed';
        item.tokenHash = null;
        throw error;
      }
    },
  };
}

function coreFor(repo, options = {}) {
  const targetRouter = createCommandTargetRouter({
    macAdapter: new MacCommandTargetAdapter({ tenantId: 'tenant-1' }),
  });
  return createCommandCore({ repository: repo, targetRouter, confirmationTtlMs: 60_000, criticalSecret: 'S3cur3-critical-secret-with-high-entropy-987', ...options });
}

describe('command prepare and confirmation', () => {
  test('every write is prepared and only confirm executes it', async () => {
    let creates = 0;
    const repo = fakeRepository({ tx: { async createDocument(_collection, id, data) { creates += 1; return { id, ...data }; } } });
    const core = coreFor(repo);
    const prepared = await core.prepare({
      actionId: 'transaction.create.v1',
      input: { target, idempotencyKey: 'create-1', documentId: 'tx-1', data: { amount: 10 } },
    }, principal);
    assert.equal(creates, 0);
    assert.ok(prepared.confirmationToken);
    const result = await core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal);
    assert.equal(result.status, 'completed');
    assert.equal(creates, 1);
  });

  test('idempotent prepare does not mint another token', async () => {
    const repo = fakeRepository();
    const core = coreFor(repo);
    const request = { actionId: 'transaction.create.v1', input: { target, idempotencyKey: 'same', data: {} } };
    const first = await core.prepare(request, principal);
    const second = await core.prepare(request, principal);
    assert.equal(second.commandId, first.commandId);
    assert.equal(second.confirmationToken, undefined);
    assert.equal(second.idempotentReplay, true);
  });

  test('tokens are hashed, single-use, and expire', async () => {
    let clock = 1000;
    const tx = { async createDocument() { return {}; } };
    const repo = fakeRepository({ now: () => clock, tx });
    const core = coreFor(repo, { now: () => clock });
    const prepared = await core.prepare({ actionId: 'transaction.create.v1', input: { target, idempotencyKey: 'replay', data: {} } }, principal);
    assert.equal(repo.commands.get(prepared.commandId).tokenHash, digest(prepared.confirmationToken));
    await core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal);
    await assert.rejects(() => core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal), (e) => e.code === 'COMMAND_REPLAYED');
    const expiring = await core.prepare({ actionId: 'transaction.create.v1', input: { target, idempotencyKey: 'expiry', data: {} } }, principal);
    clock += 60_001;
    await assert.rejects(() => core.confirm({ commandId: expiring.commandId, confirmationToken: expiring.confirmationToken }, principal), (e) => e.code === 'CONFIRMATION_EXPIRED');
  });

  test('stale writes roll back and consume the single-use confirmation', async () => {
    const repo = fakeRepository({ tx: {
      async updateDocument() { throw Object.assign(new Error('stale'), { code: 'STALE_VERSION' }); },
    } });
    const core = coreFor(repo);
    const prepared = await core.prepare({
      actionId: 'transaction.update.v1',
      input: { target, idempotencyKey: 'stale', documentId: 'tx', expectedUpdatedAt: '2026-08-08T00:00:00.000Z', patch: { amount: 2 } },
    }, principal);
    await assert.rejects(() => core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal), (e) => e.code === 'STALE_VERSION');
    assert.equal(repo.rolledBack, true);
    assert.equal(repo.commands.get(prepared.commandId).status, 'failed');
    await assert.rejects(() => core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal), (e) => e.code === 'COMMAND_REPLAYED');
  });

  test('critical action requires a fresh signed re-auth proof', async () => {
    const secret = 'S3cur3-critical-secret-with-high-entropy-987';
    const now = 1_700_000_000_000;
    const repo = fakeRepository({ now: () => now });
    const core = coreFor(repo, { now: () => now, criticalSecret: secret });
    const request = {
      actionId: 'backup.restore.v1',
      input: {
        target, idempotencyKey: 'restore',
        backupId: '123e4567-e89b-12d3-a456-426614174000', verifyDigest: 'a'.repeat(64),
      },
    };
    await assert.rejects(() => core.prepare(request, principal), (e) => e.code === 'CRITICAL_REAUTH_REQUIRED');
    const proof = createCriticalReauthProofForTest({ ownerId: principal.actorId, actionId: request.actionId, secret, timestamp: now });
    assert.ok((await core.prepare({ ...request, criticalReauthProof: proof }, principal)).confirmationToken);
    const staleProof = createCriticalReauthProofForTest({ ownerId: principal.actorId, actionId: request.actionId, secret, timestamp: now - 300_001 });
    await assert.rejects(() => core.prepare({ ...request, input: { ...request.input, idempotencyKey: 'restore-2' }, criticalReauthProof: staleProof }, principal));
  });

  test('emergency disable fails closed before prepare', async () => {
    const repo = fakeRepository();
    repo.disabled = true;
    const core = coreFor(repo);
    await assert.rejects(() => core.prepare({
      actionId: 'transaction.create.v1',
      input: { target, idempotencyKey: 'disabled', data: {} },
    }, principal), (error) => error.code === 'COMMANDS_DISABLED');
    assert.equal(repo.commands.size, 0);
  });

  test('emergency enable can be prepared and confirmed while disabled', async () => {
    let enabled = false;
    const repo = fakeRepository({ tx: { async enableEmergency() { enabled = true; repo.disabled = false; return { disabled: false }; } } });
    repo.disabled = true;
    const now = Date.now();
    const secret = 'S3cur3-critical-secret-with-high-entropy-987';
    const core = coreFor(repo, { now: () => now, criticalSecret: secret });
    const proof = createCriticalReauthProofForTest({
      ownerId: principal.actorId, actionId: 'automation.emergency-enable.v1', secret, timestamp: now,
    });
    const prepared = await core.prepare({
      actionId: 'automation.emergency-enable.v1',
      criticalReauthProof: proof,
      input: { target, idempotencyKey: 'enable-recovery', reason: 'Owner recovery after emergency stop' },
    }, principal);
    await core.confirm({ commandId: prepared.commandId, confirmationToken: prepared.confirmationToken }, principal);
    assert.equal(enabled, true);
    assert.equal(repo.disabled, false);
  });
});

describe('domain action invariants', () => {
  test('transfer is balanced and linked', async () => {
    const action = getAction('transaction.transfer.v1');
    const input = action.schema.parse({ target, idempotencyKey: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: 125, currency: 'SAR', date: '2026-08-08' });
    const result = await action.execute({ async createTransfer(value) {
      return { transferId: 'tr', entries: [{ amount: -value.amount }, { amount: value.amount }], balanced: true };
    } }, input, { id: 'c' });
    assert.equal(result.entries.reduce((sum, entry) => sum + entry.amount, 0), 0);
    assert.equal(result.balanced, true);
  });

  test('stock reversal and negative-stock failures propagate atomically', async () => {
    const adjust = getAction('inventory.adjust.v1');
    const input = adjust.schema.parse({ target, idempotencyKey: 'stock', itemId: 'i', expectedUpdatedAt: '2026-08-08T00:00:00.000Z', quantityDelta: -2, reason: 'damage' });
    await assert.rejects(() => adjust.execute({ async adjustInventory() { throw Object.assign(new Error('negative'), { code: 'NEGATIVE_STOCK' }); } }, input), (e) => e.code === 'NEGATIVE_STOCK');
    const reverse = getAction('inventory.adjust-reversal.v1');
    const reversed = await reverse.execute({ async reverseInventoryAdjustment(value) { return { reverses: value.originalAdjustmentId, quantity: 4 }; } },
      reverse.schema.parse({ target, idempotencyKey: 'reverse', itemId: 'i', expectedUpdatedAt: '2026-08-08T00:00:00.000Z', originalAdjustmentId: 'adj' }));
    assert.equal(reversed.reverses, 'adj');
  });

  test('stock operations map to signed inventory adjustments', async () => {
    const calls = [];
    const tx = { async adjustInventory(input) { calls.push(input); return input; } };
    const stamp = '2026-08-08T00:00:00.000Z';
    for (const actionId of ['stock.restock.v1', 'stock.consume.v1', 'stock.sell.v1', 'stock.free-issue.v1']) {
      const action = getAction(actionId);
      await action.execute(tx, action.schema.parse({
        target, idempotencyKey: actionId, itemId: 'item', expectedUpdatedAt: stamp,
        quantity: 3, reference: 'operation-reference',
      }));
    }
    assert.deepEqual(calls.map((call) => call.quantityDelta), [3, -3, -3, -3]);
    assert.ok(calls.every((call) => call.quantityDelta !== 0 && !('collection' in call)));
  });

  test('transfer reversal delegates only to balanced reversal handler', async () => {
    const action = getAction('transaction.transfer-reverse.v1');
    let called;
    const result = await action.execute({ async reverseTransfer(input) {
      called = input;
      return { reversesTransferId: input.originalTransferId, entries: [{ amount: -50 }, { amount: 50 }], balanced: true };
    } }, action.schema.parse({
      target, idempotencyKey: 'reverse-transfer', originalTransferId: 'transfer-1', reason: 'Correction',
    }));
    assert.equal(called.originalTransferId, 'transfer-1');
    assert.equal(result.entries.reduce((sum, entry) => sum + entry.amount, 0), 0);
    assert.equal(result.balanced, true);
  });

  test('credit note, contract renewal, and approval use specialized atomic handlers', async () => {
    const calls = [];
    const tx = {
      async createCreditNote(input) { calls.push('credit'); return { amount: -100, originalTransactionId: input.originalTransactionId }; },
      async renewContract(input) { calls.push('renew'); return { originalContractId: input.contractId, newContractId: 'new' }; },
      async resolveApproval(input) { calls.push('approval'); return { resolution: input.resolution, atomic: true }; },
    };
    const stamp = '2026-08-08T00:00:00.000Z';
    const credit = getAction('credit-note.create.v1');
    assert.equal((await credit.execute(tx, credit.schema.parse({ target, idempotencyKey: 'c', originalTransactionId: 'tx', expectedUpdatedAt: stamp, reason: 'refund' }))).amount, -100);
    const renew = getAction('contract.renew.v1');
    assert.equal((await renew.execute(tx, renew.schema.parse({ target, idempotencyKey: 'r', contractId: 'old', expectedUpdatedAt: stamp, terms: {} }))).originalContractId, 'old');
    const approval = getAction('approval.resolve.v1');
    assert.equal((await approval.execute(tx, approval.schema.parse({ target, idempotencyKey: 'a', approvalId: 'ap', expectedUpdatedAt: stamp, targetExpectedUpdatedAt: stamp, resolution: 'approved' }))).atomic, true);
    assert.deepEqual(calls, ['credit', 'renew', 'approval']);
  });

  test('catalog covers all domains with strict versioned allowlisted actions', () => {
    const catalog = actionCatalog();
    const domains = new Set(catalog.map((item) => item.domain));
    for (const domain of ['finance', 'property', 'operations', 'administration', 'reporting/export', 'backup/migration', 'external effects']) assert.ok(domains.has(domain));
    assert.ok(catalog.length >= 40);
    assert.ok(catalog.every((item) => /\.v1$/.test(item.actionId)));
    assert.equal(ACTION_REGISTRY.size, catalog.length);
    assert.throws(() => getAction('documents.execute-sql.v1'));
    assert.throws(() => getAction('transaction.create.v1').schema.parse({ target, idempotencyKey: 'x', data: {}, collectionName: 'secrets' }));
  });

  test('catalog includes representative actions from every requested category', () => {
    const required = [
      'rent.record.v1', 'payment.record.v1', 'expense.create.v1', 'transaction.status.update.v1',
      'accounting-journal.post.v1', 'bank-reconciliation.resolve.v1', 'borrowing.repay.v1',
      'transaction.transfer-reverse.v1', 'bank-account.create.v1',
      'owner.create.v1', 'service-agreement.create.v1', 'utility.create.v1',
      'security-deposit.refund.v1', 'municipality-license.create.v1', 'civil-defense.create.v1',
      'absher.submit.v1', 'ejar.submit.v1', 'sadad.submit.v1', 'vehicle.create.v1',
      'maintenance.create.v1', 'compliance.create.v1', 'contract.finalize.v1',
      'contract.terminate.v1', 'unit.rename-cascade.v1',
      'user.create.v1', 'user.role.assign.v1', 'user.building-scope.assign.v1',
      'staff-assignment.create.v1', 'setting.create.v1', 'book.create.v1', 'category.create.v1',
      'license.suspend.v1', 'license.resume.v1', 'license.config.update.v1',
      'buyer-support.operation.v1', 'data.import.v1', 'data.export.v1', 'report.export.v1',
      'notification.send.v1', 'reminder.create.v1', 'stock.restock.v1', 'stock.consume.v1',
      'stock.sell.v1', 'stock.free-issue.v1', 'book.reset.v1', 'command.rollback.v1',
    ];
    for (const actionId of required) assert.ok(ACTION_REGISTRY.has(actionId), actionId);
  });

  test('critical flags protect identity, licensing, destruction, recovery, and government submissions', () => {
    const critical = [
      'user.role.assign.v1', 'user.building-scope.assign.v1', 'staff-assignment.update.v1',
      'role.update.v1', 'license.suspend.v1', 'license.resume.v1', 'license.config.update.v1',
      'transaction.permanent-delete.v1', 'book.reset.v1', 'backup.restore.v1',
      'migration.execute.v1', 'bank.merge.v1', 'book.cross-transfer.v1',
      'absher.submit.v1', 'ejar.submit.v1', 'sadad.submit.v1', 'invoice.submit-zatca.v1',
      'command.rollback.v1',
    ];
    for (const actionId of critical) assert.equal(getAction(actionId).critical, true, actionId);
    assert.equal(getAction('notification.send.v1').critical || false, false);
  });

  test('schedule creation rejects unknown, recursive, and management actions but permits confirmed critical triggers', () => {
    const schedule = getAction('schedule.create.v1');
    const scheduleBase = {
      target, idempotencyKey: 'schedule', cron: '0 9 * * *', timezone: 'Asia/Riyadh',
    };
    assert.throws(() => schedule.preview(schedule.schema.parse({
      ...scheduleBase, actionId: 'unknown.action.v1', actionInput: {},
    })), /allowlisted/);
    assert.throws(() => schedule.preview(schedule.schema.parse({
      ...scheduleBase, actionId: 'schedule.cancel.v1',
      actionInput: { target, idempotencyKey: 'nested', scheduleId: '123e4567-e89b-12d3-a456-426614174000', expectedUpdatedAt: '2026-08-08T00:00:00.000Z' },
    })), /cannot be scheduled/);
    assert.throws(() => schedule.preview(schedule.schema.parse({
      ...scheduleBase, actionId: 'schedule.create.v1',
      actionInput: { ...scheduleBase, idempotencyKey: 'nested', actionId: 'notification.send.v1', actionInput: {} },
    })), /cannot be scheduled/);
    assert.doesNotThrow(() => schedule.preview(schedule.schema.parse({
      ...scheduleBase, actionId: 'backup.restore.v1',
      actionInput: { target, idempotencyKey: 'nested', backupId: '123e4567-e89b-12d3-a456-426614174000', verifyDigest: 'a'.repeat(64) },
    })));
    assert.doesNotThrow(() => schedule.preview(schedule.schema.parse({
      ...scheduleBase, actionId: 'reminder.create.v1',
      actionInput: {
        target, idempotencyKey: 'nested', data: {
          dueAt: '2026-08-09T09:00:00.000Z', kind: 'rent', targetId: 'contract-1',
          message: 'Rent due', channel: 'in-app',
        },
      },
    })));
  });

  test('strict schemas reject arbitrary collection and action injection', () => {
    assert.throws(() => getAction('backup.restore.v1').schema.parse({
      target, idempotencyKey: 'restore', backupId: '123e4567-e89b-12d3-a456-426614174000',
      verifyDigest: 'a'.repeat(64), collectionName: 'users',
    }));
    assert.throws(() => getAction('report.export.v1').schema.parse({
      target, idempotencyKey: 'export', report: 'audit', format: 'csv', actionId: 'book.reset.v1',
    }));
    assert.throws(() => getAction('stock.consume.v1').schema.parse({
      target, idempotencyKey: 'stock', itemId: 'i', expectedUpdatedAt: '2026-08-08T00:00:00.000Z',
      quantity: 1, reference: 'use', collection: 'secrets',
    }));
  });

  test('schema declares immutable audit and least-privilege roles', async () => {
    const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
    assert.match(schema, /reject_automation_audit_mutation/);
    assert.match(schema, /BEFORE UPDATE OR DELETE ON automation_command_audit/);
    assert.match(schema, /MCP_COMMAND_DATABASE_URL/);
    assert.match(schema, /existing amlak_mcp role remains read-only/);
    assert.match(schema, /automation_reversal_requests/);
    assert.match(schema, /automation_commands_active_rollback_idx/);
    assert.match(schema, /rollback_of_command_id/);
  });
});

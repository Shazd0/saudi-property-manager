import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { executeAutomationTool } from '../automation-tools.mjs';
import { createCommandCore, createCriticalReauthProofForTest } from '../command-core.mjs';
import { createCommandTargetRouter, MacCommandTargetAdapter } from '../command-target-adapters.mjs';
import { createEventApp } from '../../automation-worker/server.mjs';
import { createAutomationWorker } from '../../automation-worker/worker.mjs';

const owner = { actorType: 'owner', actorId: 'owner-1', bookId: '*' };
const target = { adapter: 'mac', tenantId: 'tenant-1', bookId: 'book-1' };

function workerRepository(overrides = {}) {
  return {
    completedSchedules: [],
    finishedOutbox: [],
    retriedOutbox: [],
    finishedJobs: [],
    retriedJobs: [],
    async heartbeat() {},
    async paused() { return false; },
    async claimSchedules() { return []; },
    async completeSchedule(...args) { this.completedSchedules.push(args); },
    async failSchedule() {},
    async claimOutbox() { return []; },
    async finishOutbox(...args) { this.finishedOutbox.push(args); },
    async retryOutbox(...args) { this.retriedOutbox.push(args); },
    async claimJobs() { return []; },
    async finishJob(...args) { this.finishedJobs.push(args); },
    async retryJob(...args) { this.retriedJobs.push(args); },
    async reconcile() { return []; },
    ...overrides,
  };
}

describe('durable automation worker policy', () => {
  test('due schedules create trigger records and never execute actions', async () => {
    let domainWrites = 0;
    const repository = workerRepository({
      async claimSchedules({ workerId }) {
        return [{
          id: 'schedule-1', locked_by: workerId, next_run_at: '2026-08-08T08:00:00Z',
          cron_expression: '0 * * * *', timezone: 'UTC', action_id: 'transaction.create.v1',
          action_input: { target, data: {} },
        }];
      },
      async completeSchedule(...args) { this.completedSchedules.push(args); },
      async createDocument() { domainWrites += 1; },
    });
    const result = await createAutomationWorker({ repository }).once();
    assert.equal(result.schedules, 1);
    assert.equal(repository.completedSchedules.length, 1);
    assert.equal(domainWrites, 0);
  });

  test('outbox uses configured URL, ignores payload URL, and retries unavailable endpoints', async () => {
    const calls = [];
    const repository = workerRepository({
      async claimOutbox({ workerId }) {
        return [{ id: 'o1', command_id: 'c1', effect_type: 'external.send.v1', dedupe_id: 'd1',
          payload: { url: 'https://attacker.invalid' }, attempts: 1, max_attempts: 2, locked_by: workerId }];
      },
    });
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 202, headers: { get: () => '0' }, arrayBuffer: async () => new ArrayBuffer(0) };
    };
    await createAutomationWorker({
      repository, fetchImpl,
      outboxEndpoints: { 'external.send.v1': { url: 'https://allowlisted.example/send', auth: 'effects' } },
      serviceTokens: { effects: 'service-token' },
    }).once();
    assert.equal(calls[0].url, 'https://allowlisted.example/send');
    assert.equal(calls[0].options.headers['idempotency-key'], 'd1');
    assert.equal(repository.finishedOutbox.length, 1);

    repository.claimOutbox = async ({ workerId }) => [{
      id: 'o2', effect_type: 'unknown', payload: {}, attempts: 2, max_attempts: 2, locked_by: workerId,
    }];
    await createAutomationWorker({ repository }).once();
    assert.equal(repository.retriedOutbox.length, 1);
    assert.match(repository.retriedOutbox[0][2], /No server endpoint/);

    repository.claimOutbox = async ({ workerId }) => [{
      id: 'o3', effect_type: 'external.send.v1', payload: {}, attempts: 1, max_attempts: 2, locked_by: workerId,
    }];
    await createAutomationWorker({
      repository, fetchImpl,
      outboxEndpoints: { 'external.send.v1': { url: 'https://allowlisted.example/send', auth: 'missing' } },
    }).once();
    assert.equal(calls.length, 1);
    assert.match(repository.retriedOutbox.at(-1)[2], /No service token/);
  });

  test('jobs fail closed when no explicit handler or endpoint exists', async () => {
    const repository = workerRepository({
      async claimJobs({ workerId }) {
        return [{ id: 'j1', job_type: 'backup.restore.v1', attempts: 5, max_attempts: 5, locked_by: workerId }];
      },
    });
    await createAutomationWorker({ repository }).once();
    assert.equal(repository.finishedJobs.length, 0);
    assert.equal(repository.retriedJobs.length, 1);
  });

  test('once mode performs exactly one bounded pass', async () => {
    let heartbeats = 0;
    const repository = workerRepository({ async heartbeat(_id, once) { heartbeats += 1; assert.equal(once, true); } });
    const result = await createAutomationWorker({ repository }).once();
    assert.deepEqual(result, { paused: false, schedules: 0, jobs: 0, outbox: 0, reconciled: 0 });
    assert.equal(heartbeats, 1);
  });

  test('repository claims use SKIP LOCKED and crash-safe lease expiry', async () => {
    const source = await readFile(new URL('../../automation-worker/repository.mjs', import.meta.url), 'utf8');
    assert.match(source, /for update(?: of q)? skip locked/gi);
    assert.match(source, /lease_expires_at < now\(\)/);
    assert.match(source, /dedupe_key text NOT NULL UNIQUE|on conflict\(dedupe_key\)/i);
  });

  test('event ingestion requires the dedicated bearer token and only creates triggers', async () => {
    const eventToken = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH-event';
    let ingested;
    const app = createEventApp({
      eventToken,
      enforceSocketLoopback: false,
      repository: {
        async ingestEvent(event) {
          ingested = event;
          return { duplicate: false, eventId: 'event-1', triggers: [{ id: 'trigger-1' }] };
        },
        async status() { return { paused: false }; },
      },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/internal/events`;
    const body = {
      dedupeKey: 'event-dedupe-1',
      tenantId: 'tenant-1',
      bookId: 'book-1',
      eventType: 'contract.expiring',
      payload: { contractId: 'contract-1' },
    };
    try {
      const denied = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-token' },
        body: JSON.stringify(body),
      });
      assert.equal(denied.status, 401);
      assert.equal(ingested, undefined);

      const accepted = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${eventToken}` },
        body: JSON.stringify(body),
      });
      assert.equal(accepted.status, 202);
      assert.deepEqual((await accepted.json()).awaitingConfirmation, ['trigger-1']);
      assert.equal(ingested.eventType, body.eventType);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('trigger confirmation and planning', () => {
  test('planner is read-only and returns allowlisted action schemas', async () => {
    let writes = 0;
    const result = await executeAutomationTool('automation.plan', { request: 'create transaction', limit: 5 }, owner, {
      async listTriggers() { writes += 1; },
    });
    assert.equal(result.readOnly, true);
    assert.equal(result.executesNothing, true);
    assert.ok(result.matches.some((item) => item.actionId === 'transaction.create.v1'));
    assert.equal(writes, 0);
  });

  test('critical trigger requires fresh reauth before preparation', async () => {
    const secret = 'S3cur3-critical-secret-with-high-entropy-987';
    const now = 1_700_000_000_000;
    const commands = [];
    const commandCore = createCommandCore({
      repository: {
        async emergencyDisabled() { return false; },
        async prepare(command) {
          commands.push(command);
          return { id: command.id, action_id: command.actionId, status: 'prepared', preview: command.preview,
            confirmation_expires_at: command.expiresAt, existing: false };
        },
      },
      targetRouter: createCommandTargetRouter({ macAdapter: new MacCommandTargetAdapter({ tenantId: 'tenant-1' }) }),
      criticalSecret: secret, now: () => now,
    });
    const automation = {
      async trigger() {
        return { id: '123e4567-e89b-12d3-a456-426614174010', status: 'awaiting-confirmation',
          action_id: 'backup.restore.v1', run_key: 'run-1',
          action_input: { target, idempotencyKey: 'original', backupId: '123e4567-e89b-12d3-a456-426614174000', verifyDigest: 'a'.repeat(64) } };
      },
      async bindTrigger() {},
    };
    const request = { triggerId: '123e4567-e89b-12d3-a456-426614174010' };
    await assert.rejects(() => executeAutomationTool('automation.prepare-trigger', request, owner, automation, commandCore),
      (error) => error.code === 'CRITICAL_REAUTH_REQUIRED');
    const proof = createCriticalReauthProofForTest({ ownerId: owner.actorId, actionId: 'backup.restore.v1', secret, timestamp: now });
    const prepared = await executeAutomationTool('automation.prepare-trigger',
      { ...request, criticalReauthProof: proof }, owner, automation, commandCore);
    assert.equal(prepared.requiresConfirmation, true);
    assert.match(commands[0].idempotencyKey, /trigger:/);
  });
});

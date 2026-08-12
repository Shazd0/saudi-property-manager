import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { createCommandCore } from '../command-core.mjs';
import { createCommandRepository } from '../command-repository.mjs';
import { createCommandTargetRouter, MacCommandTargetAdapter } from '../command-target-adapters.mjs';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL;

test('PostgreSQL prepare/confirm is atomic, idempotent, and immutably audited', {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 2 });
  const repository = createCommandRepository({ pool });
  const tenantId = `tenant-${randomUUID()}`;
  const bookId = `book-${randomUUID()}`;
  const documentId = `tx-${randomUUID()}`;
  const principal = { actorType: 'owner', actorId: 'postgres-integration-owner' };
  const core = createCommandCore({
    repository,
    targetRouter: createCommandTargetRouter({
      macAdapter: new MacCommandTargetAdapter({ tenantId }),
    }),
    criticalSecret: 'integration-critical-secret-0123456789-ABCDEFG',
  });
  const request = {
    actionId: 'transaction.create.v1',
    input: {
      target: { adapter: 'mac', tenantId, bookId },
      idempotencyKey: `integration-${randomUUID()}`,
      documentId,
      data: { type: 'INCOME', amount: 125, description: 'Integration test' },
    },
  };

  try {
    const prepared = await core.prepare(request, principal);
    assert.equal(prepared.status, 'prepared');
    assert.ok(prepared.confirmationToken);

    const confirmed = await core.confirm({
      commandId: prepared.commandId,
      confirmationToken: prepared.confirmationToken,
    }, principal);
    assert.equal(confirmed.status, 'completed');
    assert.equal(confirmed.result.id, documentId);

    const stored = await pool.query(
      `select data from documents
        where book_id=$1 and collection_name='transactions' and doc_id=$2`,
      [bookId, documentId],
    );
    assert.equal(stored.rowCount, 1);
    assert.equal(Number(stored.rows[0].data.amount), 125);

    const audit = await pool.query(
      'select count(*)::int as count from automation_command_audit where command_id=$1',
      [prepared.commandId],
    );
    assert.ok(audit.rows[0].count >= 2);

    await pool.query(
      `update documents set data = data || '{"amount":999}'::jsonb
        where book_id=$1 and collection_name='transactions' and doc_id=$2`,
      [bookId, documentId],
    );
    const owner = {
      ...principal,
      accessIssuedAt: Date.now(),
    };
    const stalePrepare = await core.prepareRollback({
      originalCommandId: prepared.commandId,
      reason: 'Should fail at confirm because current state drifted',
    }, owner);
    await assert.rejects(
      () => core.confirm({
        commandId: stalePrepare.commandId,
        confirmationToken: stalePrepare.confirmationToken,
      }, owner),
      (error) => error.code === 'ROLLBACK_STALE',
    );

    await pool.query(
      `update documents set data = $3::jsonb
        where book_id=$1 and collection_name='transactions' and doc_id=$2`,
      [bookId, documentId, JSON.stringify({ type: 'INCOME', amount: 125, description: 'Integration test' })],
    );

    const rollbackPrepared = await core.prepareRollback({
      originalCommandId: prepared.commandId,
      reason: 'Integration rollback of create',
    }, { ...owner, accessIssuedAt: Date.now() });
    assert.ok(rollbackPrepared.confirmationToken);
    const rolled = await core.confirm({
      commandId: rollbackPrepared.commandId,
      confirmationToken: rollbackPrepared.confirmationToken,
    }, owner);
    assert.equal(rolled.status, 'completed');
    const afterRollback = await pool.query(
      `select 1 from documents where book_id=$1 and collection_name='transactions' and doc_id=$2`,
      [bookId, documentId],
    );
    assert.equal(afterRollback.rowCount, 0);

    await assert.rejects(
      () => core.prepareRollback({
        originalCommandId: prepared.commandId,
        reason: 'Second rollback must be denied',
      }, { ...owner, accessIssuedAt: Date.now() }),
      (error) => ['ROLLBACK_ALREADY_EXISTS', 'ROLLBACK_UNAVAILABLE'].includes(error.code),
    );

    const externalPrepared = await core.prepare({
      actionId: 'external.send.v1',
      input: {
        target: { adapter: 'mac', tenantId, bookId },
        idempotencyKey: `external-${randomUUID()}`,
        channel: 'email',
        recipient: 'nobody@example.invalid',
        payload: { subject: 'x' },
      },
    }, principal);
    await core.confirm({
      commandId: externalPrepared.commandId,
      confirmationToken: externalPrepared.confirmationToken,
    }, principal);
    await assert.rejects(
      () => core.prepareRollback({
        originalCommandId: externalPrepared.commandId,
        reason: 'External effects cannot roll back',
      }, { ...principal, accessIssuedAt: Date.now() }),
      (error) => error.code === 'ROLLBACK_UNAVAILABLE',
    );

    await assert.rejects(
      () => pool.query(
        `update automation_command_audit set operation='tampered' where command_id=$1`,
        [prepared.commandId],
      ),
      /immutable/i,
    );
    await assert.rejects(
      () => core.confirm({
        commandId: prepared.commandId,
        confirmationToken: prepared.confirmationToken,
      }, principal),
      (error) => error.code === 'COMMAND_REPLAYED',
    );

    const replay = await core.prepare(request, principal);
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.commandId, prepared.commandId);
    assert.equal(replay.confirmationToken, undefined);
  } finally {
    await repository.close();
  }
});

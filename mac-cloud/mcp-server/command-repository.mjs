import pg from 'pg';
import { getAction } from './actions.mjs';

const { Pool } = pg;
const json = (value) => JSON.stringify(value ?? {});
const stale = () => Object.assign(new Error('Target changed since prepare'), { code: 'STALE_VERSION' });
const failure = (message, code) => Object.assign(new Error(message), { code });
const limitOf = (value) => Math.min(Math.max(Number(value) || 50, 1), 100);
const actionDto = (row) => {
  let action;
  try { action = getAction(row.action_id); } catch {}
  const immutableAuditAvailable = Boolean(row.operation_count)
    || (row.target?.adapter === 'buyer' && Boolean(row.remote_operation_result));
  const supportedAction = Boolean(action?.mutation && !action?.centralInfrastructure && !action?.rollbackAction);
  const alreadyRolledBack = Boolean(row.has_rollback);
  return ({
  id: row.id,
  actionId: row.action_id,
  actorId: row.actor_id,
  status: row.status,
  target: row.target,
  targetAdapter: row.target_adapter,
  preview: row.preview || null,
  rollbackOfCommandId: row.rollback_of_command_id,
  reconciliationNeeded: Boolean(row.reconciliation_needed),
  preparedAt: row.prepared_at,
  confirmedAt: row.confirmed_at,
  completedAt: row.completed_at,
  cancelledAt: row.cancelled_at,
  hasRollback: alreadyRolledBack,
  rollbackSupported: row.status === 'completed' && !row.reconciliation_needed
    && supportedAction && immutableAuditAvailable && !alreadyRolledBack,
  rollbackUnavailableReason: row.status !== 'completed'
    ? 'Only completed commands can be rolled back'
    : row.reconciliation_needed
      ? 'Command requires reconciliation'
      : alreadyRolledBack
        ? 'Original command already has a rollback'
      : action?.rollbackAction
        ? 'Rollback commands are not recursively reversible'
        : action?.centralInfrastructure
          ? 'Central jobs, controls, or external effects are not rollbackable'
          : !immutableAuditAvailable ? 'No immutable data-operation audit is available' : undefined,
  affectedRecords: Number(row.operation_count || 0),
  reversalRequest: row.reversal_request || null,
  });
};

export function createCommandRepository({ connectionString, timeoutMs = 5000, pool } = {}) {
  const db = pool || new Pool({
    connectionString,
    max: Number(process.env.MCP_COMMAND_PG_POOL_MAX || 3),
    statement_timeout: timeoutMs,
    query_timeout: timeoutMs,
  });

  async function emergencyDisabled() {
    const result = await db.query(
      `select exists (
         select 1 from automation_checkpoints
          where checkpoint_type = 'emergency-disable'
            and released_at is null
       ) as disabled`,
    );
    return Boolean(result.rows[0]?.disabled);
  }

  async function commandAction(id, actorId) {
    const result = await db.query('select action_id from automation_commands where id=$1 and actor_id=$2', [id, actorId]);
    return result.rows[0]?.action_id || null;
  }

  async function prepare(command) {
    try {
      const result = await db.query(
        `insert into automation_commands
         (id, actor_id, action_id, target, input, idempotency_key, status,
          confirmation_token_hash, confirmation_expires_at, preview, critical_reauth_at, rollback_of_command_id)
         values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, 'prepared', $7, $8, $9::jsonb, $10, $11)
         on conflict (actor_id, action_id, idempotency_key) do update
           set status = case
                 when automation_commands.status in ('failed','cancelled') then 'prepared'
                 else automation_commands.status
               end,
               confirmation_token_hash = case
                 when automation_commands.status in ('failed','cancelled') then excluded.confirmation_token_hash
                 else automation_commands.confirmation_token_hash
               end,
               confirmation_expires_at = case
                 when automation_commands.status in ('failed','cancelled') then excluded.confirmation_expires_at
                 else automation_commands.confirmation_expires_at
               end,
               preview = case
                 when automation_commands.status in ('failed','cancelled') then excluded.preview
                 else automation_commands.preview
               end,
               critical_reauth_at = case
                 when automation_commands.status in ('failed','cancelled') then excluded.critical_reauth_at
                 else automation_commands.critical_reauth_at
               end,
               input = case
                 when automation_commands.status in ('failed','cancelled') then excluded.input
                 else automation_commands.input
               end,
               completed_at = case
                 when automation_commands.status in ('failed','cancelled') then null
                 else automation_commands.completed_at
               end,
               confirmed_at = case
                 when automation_commands.status in ('failed','cancelled') then null
                 else automation_commands.confirmed_at
               end,
               cancelled_at = case
                 when automation_commands.status in ('failed','cancelled') then null
                 else automation_commands.cancelled_at
               end,
               error_code = case
                 when automation_commands.status in ('failed','cancelled') then null
                 else automation_commands.error_code
               end,
               idempotency_key = excluded.idempotency_key
         returning id, action_id, target, status, preview, confirmation_expires_at,
                   confirmation_token_hash, (xmax <> 0) as conflicted`,
        [
          command.id, command.actorId, command.actionId, json(command.target), json(command.input),
          command.idempotencyKey, command.tokenHash, command.expiresAt, json(command.preview),
          command.criticalReauthAt || null,
          command.rollbackOfCommandId || null,
        ],
      );
      const row = result.rows[0];
      return {
        id: row.id,
        action_id: row.action_id,
        target: row.target,
        status: row.status,
        preview: row.preview,
        confirmation_expires_at: row.confirmation_expires_at,
        existing: Boolean(row.conflicted) && row.confirmation_token_hash !== command.tokenHash,
      };
    } catch (error) {
      if (error?.code === '23505' && command.rollbackOfCommandId) {
        throw failure('Original command already has a rollback', 'ROLLBACK_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async function status(id, actorId) {
    const result = await db.query(
      `select id, action_id, target, status, preview, result, error_code,
              target_adapter, remote_operation_result, reconciliation_needed,
              prepared_at, confirmation_expires_at, confirmed_at, completed_at, cancelled_at
         from automation_commands where id = $1 and actor_id = $2`,
      [id, actorId],
    );
    return result.rows[0] || null;
  }

  async function cancel(id, actorId) {
    const result = await db.query(
      `update automation_commands
          set status = 'cancelled', cancelled_at = now(), confirmation_token_hash = null
        where id = $1 and actor_id = $2 and status = 'prepared'
        returning id, action_id, status, cancelled_at`,
      [id, actorId],
    );
    if (!result.rowCount) throw Object.assign(new Error('Prepared command not found'), { code: 'COMMAND_NOT_PREPARED' });
    await syncReversalForCommand(id, 'cancelled');
    return result.rows[0];
  }

  function decodeCursor(cursor) {
    if (!cursor) return null;
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!Array.isArray(value) || value.length !== 2 || !Date.parse(value[0]) || typeof value[1] !== 'string') throw new Error();
      return value;
    } catch {
      throw failure('Cursor is invalid', 'INVALID_CURSOR');
    }
  }

  async function listActions(filters = {}, scope = {}) {
    const params = [];
    const where = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (scope.tenantId) add(`c.target->>'tenantId' = ?`, scope.tenantId);
    if (scope.bookId) add(`c.target->>'bookId' = ?`, scope.bookId);
    if (scope.projectId) add(`c.target->>'projectId' = ?`, scope.projectId);
    if (filters.status) add('c.status = ?', filters.status);
    if (filters.actionId) add('c.action_id = ?', filters.actionId);
    if (filters.adapter) add(`c.target->>'adapter' = ?`, filters.adapter);
    if (filters.from) add('c.prepared_at >= ?', filters.from);
    if (filters.to) add('c.prepared_at <= ?', filters.to);
    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      params.push(cursor[0], cursor[1]);
      where.push(`(c.prepared_at,c.id) < ($${params.length - 1}::timestamptz,$${params.length}::uuid)`);
    }
    params.push(limitOf(filters.limit) + 1);
    const result = await db.query(
      `select c.id,c.actor_id,c.action_id,c.status,c.target,c.target_adapter,c.preview,
              c.rollback_of_command_id,c.reconciliation_needed,c.remote_operation_result,
              c.prepared_at,c.confirmed_at,c.completed_at,c.cancelled_at,
              count(a.id) filter(where a.collection_name <> '__command__') as operation_count,
              exists(
                select 1 from automation_commands r
                 where r.rollback_of_command_id=c.id and r.status in ('prepared','executing','completed')
              ) as has_rollback,
              (
                select jsonb_build_object(
                  'id', rr.id, 'status', rr.status, 'reason', rr.reason,
                  'created_at', rr.created_at, 'updated_at', coalesce(rr.completed_at, rr.reviewed_at, rr.created_at)
                )
                  from automation_reversal_requests rr
                 where rr.original_command_id=c.id and rr.status in ('pending','prepared','completed','rejected','cancelled')
                 order by rr.created_at desc limit 1
              ) as reversal_request
         from automation_commands c
         left join automation_command_audit a on a.command_id=c.id
        ${where.length ? `where ${where.join(' and ')}` : ''}
        group by c.id order by c.prepared_at desc,c.id desc limit $${params.length}`,
      params,
    );
    const pageSize = limitOf(filters.limit);
    const rows = result.rows.slice(0, pageSize);
    const last = rows.at(-1);
    return {
      items: rows.map(actionDto),
      nextCursor: result.rows.length > pageSize && last
        ? Buffer.from(JSON.stringify([last.prepared_at, last.id])).toString('base64url') : null,
    };
  }

  async function actionDetail(id, scope = {}) {
    const params = [id];
    const where = ['c.id=$1'];
    for (const [key, expression] of [
      ['tenantId', `c.target->>'tenantId'`], ['bookId', `c.target->>'bookId'`], ['projectId', `c.target->>'projectId'`],
    ]) {
      if (scope[key]) { params.push(scope[key]); where.push(`${expression}=$${params.length}`); }
    }
    const result = await db.query(
      `select c.id,c.actor_id,c.action_id,c.status,c.target,c.target_adapter,c.preview,
              c.rollback_of_command_id,c.reconciliation_needed,c.remote_operation_result,
              c.prepared_at,c.confirmed_at,c.completed_at,c.cancelled_at,
              count(a.id) filter(where a.collection_name <> '__command__') as operation_count,
              exists(
                select 1 from automation_commands r
                 where r.rollback_of_command_id=c.id and r.status in ('prepared','executing','completed')
              ) as has_rollback,
              (
                select jsonb_build_object(
                  'id', rr.id, 'status', rr.status, 'reason', rr.reason,
                  'created_at', rr.created_at, 'updated_at', coalesce(rr.completed_at, rr.reviewed_at, rr.created_at)
                )
                  from automation_reversal_requests rr
                 where rr.original_command_id=c.id and rr.status in ('pending','prepared','completed','rejected','cancelled')
                 order by rr.created_at desc limit 1
              ) as reversal_request,
              coalesce(jsonb_agg(jsonb_build_object(
                'id', a.id, 'collection', a.collection_name, 'documentId', a.doc_id,
                'operation', a.operation, 'before', a.before_data, 'after', a.after_data,
                'createdAt', a.created_at
              ) order by a.id) filter(where a.collection_name <> '__command__'),'[]'::jsonb) as operations
         from automation_commands c left join automation_command_audit a on a.command_id=c.id
        where ${where.join(' and ')} group by c.id`,
      params,
    );
    return result.rows[0] ? { ...actionDto(result.rows[0]), operations: result.rows[0].operations } : null;
  }

  async function createReversalRequest({ principal, originalCommandId, reason }) {
    const result = await db.query(
      `insert into automation_reversal_requests
       (requester_actor_type,requester_actor_id,project_id,tenant_id,book_id,original_command_id,reason)
       select $1,$2,$3,$4,$5,c.id,$6 from automation_commands c
        where c.id=$7 and c.status='completed' and c.reconciliation_needed=false
          and c.action_id<>'command.rollback.v1'
          and c.target->>'tenantId'=$4 and c.target->>'bookId'=$5
          and ($3::text is null or c.target->>'projectId'=$3)
          and (
            exists(select 1 from automation_command_audit a where a.command_id=c.id and a.collection_name<>'__command__')
            or (c.target->>'adapter'='buyer' and c.remote_operation_result is not null)
          )
       on conflict (original_command_id) where status in ('pending','prepared')
       do update set original_command_id=excluded.original_command_id
       returning id,original_command_id,status,reason,created_at,prepared_rollback_command_id`,
      [principal.actorType, principal.actorId, principal.projectId || null, principal.tenantId,
        principal.bookId, reason, originalCommandId],
    );
    if (!result.rowCount) throw failure('Action is not available for reversal', 'ROLLBACK_UNAVAILABLE');
    return result.rows[0];
  }

  async function listReversalRequests(filters = {}, scope = {}) {
    const params = [];
    const where = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (scope.tenantId) add('r.tenant_id=?', scope.tenantId);
    if (scope.bookId) add('r.book_id=?', scope.bookId);
    if (scope.projectId) add('r.project_id=?', scope.projectId);
    if (filters.status) add('r.status=?', filters.status);
    if (filters.originalCommandId) add('r.original_command_id=?', filters.originalCommandId);
    params.push(limitOf(filters.limit));
    const result = await db.query(
      `select id,requester_actor_type,requester_actor_id,project_id,tenant_id,book_id,
              original_command_id,reason,status,reviewer_actor_id,prepared_rollback_command_id,
              created_at,reviewed_at,completed_at,cancelled_at
         from automation_reversal_requests r ${where.length ? `where ${where.join(' and ')}` : ''}
        order by created_at desc,id desc limit $${params.length}`,
      params,
    );
    return { items: result.rows };
  }

  async function getReversalRequestForAction(originalCommandId) {
    const result = await db.query(
      `select * from automation_reversal_requests where original_command_id=$1 and status in ('pending','prepared')
        order by created_at desc limit 1`,
      [originalCommandId],
    );
    return result.rows[0] || null;
  }

  async function markReversalPrepared({ requestId, reviewerActorId, rollbackCommandId }) {
    const result = await db.query(
      `update automation_reversal_requests set status='prepared',reviewer_actor_id=$2,
              prepared_rollback_command_id=$3,reviewed_at=now()
        where id=$1 and (
          status='pending'
          or (status='prepared' and prepared_rollback_command_id=$3)
        ) returning *`,
      [requestId, reviewerActorId, rollbackCommandId],
    );
    if (!result.rowCount) throw failure('Reversal request is no longer pending', 'REVERSAL_REQUEST_UNAVAILABLE');
    return result.rows[0];
  }

  async function syncReversalForCommand(commandId, status) {
    const mapped = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : null;
    if (!mapped) return;
    await db.query(
      `update automation_reversal_requests set status=$2,
          completed_at=case when $2='completed' then now() else completed_at end,
          cancelled_at=case when $2='cancelled' then now() else cancelled_at end
        where prepared_rollback_command_id=$1 and status='prepared'`,
      [commandId, mapped],
    );
  }

  function transaction(client, command) {
    const target = command.target;
    const scope = [target.bookId];
    async function document(collection, id, lock = false) {
      const result = await client.query(
        `select data, deleted, updated_at from documents
          where book_id = $1 and collection_name = $2 and doc_id = $3${lock ? ' for update' : ''}`,
        [target.bookId, collection, id],
      );
      return result.rows[0] || null;
    }
    async function audit(collection, id, operation, before, after) {
      await client.query(
        `insert into automation_command_audit
         (command_id, actor_id, action_id, tenant_id, book_id, collection_name, doc_id, operation,
          before_data, after_data, target_adapter, reconciliation_needed)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'mac',false)`,
        [command.id, command.actor_id, command.action_id, target.tenantId, target.bookId, collection, id, operation,
          before === null ? null : json(before), after === null ? null : json(after)],
      );
    }
    return {
      async createDocument(collection, id, data) {
        const result = await client.query(
          `insert into documents (book_id, collection_name, doc_id, data)
           values ($1,$2,$3,$4::jsonb) returning data, deleted, created_at, updated_at`,
          [...scope, collection, id, json(data)],
        );
        const after = { ...result.rows[0], id };
        await audit(collection, id, 'create', null, after);
        return after;
      },
      async updateDocument(collection, id, expected, patch) {
        const before = await document(collection, id, true);
        if (!before || before.updated_at.toISOString() !== expected) throw stale();
        const result = await client.query(
          `update documents set data = data || $4::jsonb
            where book_id=$1 and collection_name=$2 and doc_id=$3 and updated_at=$5
            returning data, deleted, updated_at`,
          [...scope, collection, id, json(patch), expected],
        );
        if (!result.rowCount) throw stale();
        await audit(collection, id, 'update', before, result.rows[0]);
        return { ...result.rows[0], id };
      },
      async setDocumentDeleted(collection, id, expected, deleted) {
        const before = await document(collection, id, true);
        if (!before || before.updated_at.toISOString() !== expected) throw stale();
        const result = await client.query(
          `update documents set deleted=$4
            where book_id=$1 and collection_name=$2 and doc_id=$3 and updated_at=$5
            returning data, deleted, updated_at`,
          [...scope, collection, id, deleted, expected],
        );
        if (!result.rowCount) throw stale();
        await audit(collection, id, deleted ? 'soft-delete' : 'restore', before, result.rows[0]);
        return { ...result.rows[0], id };
      },
      async permanentDeleteDocument(collection, id, expected) {
        const before = await document(collection, id, true);
        if (!before || before.updated_at.toISOString() !== expected) throw stale();
        const result = await client.query(
          `delete from documents where book_id=$1 and collection_name=$2 and doc_id=$3 and updated_at=$4 returning doc_id`,
          [...scope, collection, id, expected],
        );
        if (!result.rowCount) throw stale();
        await audit(collection, id, 'permanent-delete', before, null);
        return { id, deleted: true, permanent: true };
      },
      async renewContract(input) {
        const old = await document('contracts', input.contractId, true);
        if (!old || old.updated_at.toISOString() !== input.expectedUpdatedAt) throw stale();
        const newId = input.newContractId || `${input.contractId}-renewal-${command.id.slice(0, 8)}`;
        const oldData = { ...old.data, status: 'renewed', renewedByContractId: newId };
        await client.query(
          `update documents set data=$4::jsonb where book_id=$1 and collection_name='contracts' and doc_id=$2 and updated_at=$3`,
          [target.bookId, input.contractId, input.expectedUpdatedAt, json(oldData)],
        );
        const newData = { ...old.data, ...input.terms, previousContractId: input.contractId, renewalOf: input.contractId, status: 'active' };
        await client.query(
          `insert into documents(book_id,collection_name,doc_id,data) values($1,'contracts',$2,$3::jsonb)`,
          [target.bookId, newId, json(newData)],
        );
        await audit('contracts', input.contractId, 'renew-source', old, oldData);
        await audit('contracts', newId, 'renew-successor', null, newData);
        return { originalContractId: input.contractId, newContractId: newId };
      },
      async createTransfer(input) {
        const transferId = input.transferId || command.id;
        const common = { transferId, currency: input.currency.toUpperCase(), date: input.date, memo: input.memo };
        const debit = { ...common, accountId: input.fromAccountId, amount: -input.amount, type: 'TRANSFER' };
        const credit = { ...common, accountId: input.toAccountId, amount: input.amount, type: 'TRANSFER' };
        const debitId = `${transferId}:debit`; const creditId = `${transferId}:credit`;
        await client.query(
          `insert into documents(book_id,collection_name,doc_id,data) values
           ($1,'transactions',$2,$3::jsonb),($1,'transactions',$4,$5::jsonb)`,
          [target.bookId, debitId, json(debit), creditId, json(credit)],
        );
        await audit('transactions', debitId, 'transfer-debit', null, debit);
        await audit('transactions', creditId, 'transfer-credit', null, credit);
        return { transferId, entries: [{ id: debitId, amount: -input.amount }, { id: creditId, amount: input.amount }], balanced: true };
      },
      async reverseTransfer(input) {
        const debitId = `${input.originalTransferId}:debit`;
        const creditId = `${input.originalTransferId}:credit`;
        const debit = await document('transactions', debitId, true);
        const credit = await document('transactions', creditId, true);
        if (!debit || !credit || debit.data.transferId !== input.originalTransferId || credit.data.transferId !== input.originalTransferId) {
          throw Object.assign(new Error('Original transfer pair was not found'), { code: 'TRANSFER_NOT_REVERSIBLE' });
        }
        if (debit.data.reversalTransferId || credit.data.reversalTransferId) {
          throw Object.assign(new Error('Transfer is already reversed'), { code: 'TRANSFER_NOT_REVERSIBLE' });
        }
        const debitAmount = Number(debit.data.amount); const creditAmount = Number(credit.data.amount);
        if (!Number.isFinite(debitAmount) || !Number.isFinite(creditAmount) || Math.abs(debitAmount + creditAmount) > 0.000001) {
          throw Object.assign(new Error('Original transfer is not balanced'), { code: 'TRANSFER_NOT_REVERSIBLE' });
        }
        const reversalTransferId = input.reversalTransferId || `${input.originalTransferId}:reversal:${command.id.slice(0, 8)}`;
        const reverseDebitId = `${reversalTransferId}:debit`; const reverseCreditId = `${reversalTransferId}:credit`;
        const reverseDebit = { ...credit.data, transferId: reversalTransferId, amount: -creditAmount, reversesTransferId: input.originalTransferId, reason: input.reason };
        const reverseCredit = { ...debit.data, transferId: reversalTransferId, amount: -debitAmount, reversesTransferId: input.originalTransferId, reason: input.reason };
        const debitAfter = { ...debit.data, reversalTransferId };
        const creditAfter = { ...credit.data, reversalTransferId };
        await client.query(
          `update documents set data=case doc_id when $2 then $4::jsonb else $5::jsonb end
            where book_id=$1 and collection_name='transactions' and doc_id in ($2,$3)`,
          [target.bookId, debitId, creditId, json(debitAfter), json(creditAfter)],
        );
        await client.query(
          `insert into documents(book_id,collection_name,doc_id,data) values
           ($1,'transactions',$2,$3::jsonb),($1,'transactions',$4,$5::jsonb)`,
          [target.bookId, reverseDebitId, json(reverseDebit), reverseCreditId, json(reverseCredit)],
        );
        await audit('transactions', debitId, 'transfer-reversal-link', debit, debitAfter);
        await audit('transactions', creditId, 'transfer-reversal-link', credit, creditAfter);
        await audit('transactions', reverseDebitId, 'transfer-reversal-debit', null, reverseDebit);
        await audit('transactions', reverseCreditId, 'transfer-reversal-credit', null, reverseCredit);
        return {
          transferId: reversalTransferId,
          reversesTransferId: input.originalTransferId,
          entries: [{ id: reverseDebitId, amount: reverseDebit.amount }, { id: reverseCreditId, amount: reverseCredit.amount }],
          balanced: true,
        };
      },
      async applyAmountOperation(collection, id, expected, operation) {
        const before = await document(collection, id, true);
        if (!before || before.updated_at.toISOString() !== expected) throw stale();
        const current = Number(before.data[operation.field] || 0);
        const delta = operation.operation === 'increase' ? operation.amount : -operation.amount;
        const next = current + delta;
        if (!Number.isFinite(current) || next < 0) {
          throw Object.assign(new Error('Amount operation would create a negative balance'), { code: 'NEGATIVE_BALANCE' });
        }
        const event = {
          id: `${operation.event}:${command.id}`, type: operation.event, amount: operation.amount,
          delta, ...(operation.metadata || {}),
        };
        const after = {
          ...before.data,
          [operation.field]: next,
          amountEvents: [...(before.data.amountEvents || []), event],
        };
        const result = await client.query(
          `update documents set data=$4::jsonb
            where book_id=$1 and collection_name=$2 and doc_id=$3 and updated_at=$5
            returning updated_at`,
          [target.bookId, collection, id, json(after), expected],
        );
        if (!result.rowCount) throw stale();
        await audit(collection, id, operation.event, before, after);
        return { id, field: operation.field, previousAmount: current, amount: next, event };
      },
      async adjustInventory(input) {
        const before = await document('stockItems', input.itemId, true);
        if (!before || before.updated_at.toISOString() !== input.expectedUpdatedAt) throw stale();
        const quantity = Number(before.data.quantity || 0) + input.quantityDelta;
        if (quantity < 0) throw Object.assign(new Error('Inventory cannot become negative'), { code: 'NEGATIVE_STOCK' });
        const adjustmentId = input.adjustmentId || command.id;
        const after = { ...before.data, quantity, inventoryAdjustments: [...(before.data.inventoryAdjustments || []), { id: adjustmentId, delta: input.quantityDelta, reason: input.reason }] };
        await client.query(`update documents set data=$4::jsonb where book_id=$1 and collection_name='stockItems' and doc_id=$2 and updated_at=$3`,
          [target.bookId, input.itemId, input.expectedUpdatedAt, json(after)]);
        await audit('stockItems', input.itemId, 'inventory-adjust', before, after);
        return { itemId: input.itemId, adjustmentId, quantity };
      },
      async reverseInventoryAdjustment(input) {
        const before = await document('stockItems', input.itemId, true);
        if (!before || before.updated_at.toISOString() !== input.expectedUpdatedAt) throw stale();
        const original = (before.data.inventoryAdjustments || []).find((item) => item.id === input.originalAdjustmentId && !item.reversedBy);
        if (!original) throw Object.assign(new Error('Adjustment is missing or already reversed'), { code: 'ADJUSTMENT_NOT_REVERSIBLE' });
        const quantity = Number(before.data.quantity || 0) - Number(original.delta);
        if (quantity < 0) throw Object.assign(new Error('Reversal cannot make stock negative'), { code: 'NEGATIVE_STOCK' });
        const reversalId = input.reversalId || command.id;
        const adjustments = before.data.inventoryAdjustments.map((item) => item.id === original.id ? { ...item, reversedBy: reversalId } : item);
        adjustments.push({ id: reversalId, delta: -Number(original.delta), reverses: original.id });
        const after = { ...before.data, quantity, inventoryAdjustments: adjustments };
        await client.query(`update documents set data=$4::jsonb where book_id=$1 and collection_name='stockItems' and doc_id=$2 and updated_at=$3`,
          [target.bookId, input.itemId, input.expectedUpdatedAt, json(after)]);
        await audit('stockItems', input.itemId, 'inventory-reversal', before, after);
        return { itemId: input.itemId, reversalId, quantity };
      },
      async createCreditNote(input) {
        const original = await document('transactions', input.originalTransactionId, true);
        if (!original || original.updated_at.toISOString() !== input.expectedUpdatedAt) throw stale();
        if (original.data.creditNoteId) throw Object.assign(new Error('Credit note already exists'), { code: 'CREDIT_NOTE_EXISTS' });
        const creditNoteId = input.creditNoteId || `${input.originalTransactionId}:credit:${command.id.slice(0, 8)}`;
        const amount = -Number(original.data.amount || original.data.total || 0);
        if (!Number.isFinite(amount) || amount === 0) throw new Error('Original transaction has no reversible amount');
        const note = { ...original.data, amount, total: amount, type: 'CREDIT_NOTE', originalTransactionId: input.originalTransactionId, reason: input.reason };
        const originalAfter = { ...original.data, creditNoteId };
        await client.query(`update documents set data=$4::jsonb where book_id=$1 and collection_name='transactions' and doc_id=$2 and updated_at=$3`,
          [target.bookId, input.originalTransactionId, input.expectedUpdatedAt, json(originalAfter)]);
        await client.query(`insert into documents(book_id,collection_name,doc_id,data) values($1,'transactions',$2,$3::jsonb)`,
          [target.bookId, creditNoteId, json(note)]);
        await audit('transactions', input.originalTransactionId, 'credit-note-link', original, originalAfter);
        await audit('transactions', creditNoteId, 'credit-note-create', null, note);
        return { originalTransactionId: input.originalTransactionId, creditNoteId, amount };
      },
      async resolveApproval(input) {
        const approval = await document('approvals', input.approvalId, true);
        if (!approval || approval.updated_at.toISOString() !== input.expectedUpdatedAt) throw stale();
        if (approval.data.status !== 'pending') throw Object.assign(new Error('Approval is already resolved'), { code: 'APPROVAL_RESOLVED' });
        const allowed = { transactions: 'transactions', contracts: 'contracts', tasks: 'tasks', vendors: 'vendors' };
        const targetCollection = allowed[approval.data.targetCollection];
        if (!targetCollection) throw new Error('Approval target is not allowlisted');
        const targetDocument = await document(targetCollection, approval.data.targetId, true);
        if (!targetDocument || targetDocument.updated_at.toISOString() !== input.targetExpectedUpdatedAt) throw stale();
        const approvalAfter = { ...approval.data, status: input.resolution, note: input.note };
        const targetAfter = { ...targetDocument.data, approvalStatus: input.resolution };
        await client.query(`update documents set data=$4::jsonb where book_id=$1 and collection_name='approvals' and doc_id=$2 and updated_at=$3`,
          [target.bookId, input.approvalId, input.expectedUpdatedAt, json(approvalAfter)]);
        await client.query(`update documents set data=$5::jsonb where book_id=$1 and collection_name=$2 and doc_id=$3 and updated_at=$4`,
          [target.bookId, targetCollection, approval.data.targetId, input.targetExpectedUpdatedAt, json(targetAfter)]);
        await audit('approvals', input.approvalId, 'approval-resolve', approval, approvalAfter);
        await audit(targetCollection, approval.data.targetId, 'approval-target-update', targetDocument, targetAfter);
        return { approvalId: input.approvalId, targetId: approval.data.targetId, resolution: input.resolution };
      },
      async rollbackCommand(input) {
        const normalizeState = (value) => {
          if (value == null) return null;
          if (Object.hasOwn(value, 'data')) return { data: value.data, deleted: Boolean(value.deleted) };
          return value;
        };
        const originalResult = await client.query(
          `select * from automation_commands where id=$1 for update`,
          [input.originalCommandId],
        );
        const original = originalResult.rows[0];
        if (!original || original.status !== 'completed' || original.reconciliation_needed) {
          throw failure('Original command is not in a rollbackable completed state', 'ROLLBACK_UNAVAILABLE');
        }
        if (original.action_id === 'command.rollback.v1'
          || original.target?.adapter !== input.target.adapter
          || original.target?.tenantId !== input.target.tenantId
          || original.target?.bookId !== input.target.bookId
          || (original.target?.projectId || null) !== (input.target.projectId || null)) {
          throw failure('Rollback target or original action is not supported', 'ROLLBACK_UNAVAILABLE');
        }
        let action;
        try { action = getAction(original.action_id); } catch {
          throw failure('Original action is not allowlisted', 'ROLLBACK_UNAVAILABLE');
        }
        if (!action.mutation || action.centralInfrastructure || action.rollbackAction) {
          throw failure('Original action is not generically rollbackable', 'ROLLBACK_UNAVAILABLE');
        }
        const prior = await client.query(
          `select 1 from automation_commands where rollback_of_command_id=$1
            and id<>$2 and status in ('prepared','executing','completed')`,
          [original.id, command.id],
        );
        if (prior.rowCount) throw failure('Original command already has a rollback', 'ROLLBACK_ALREADY_EXISTS');
        const audits = await client.query(
          `select * from automation_command_audit
            where command_id=$1 and collection_name<>'__command__' order by id desc for share`,
          [original.id],
        );
        if (!audits.rowCount || audits.rows.some((row) => row.reconciliation_needed
          || (row.target_adapter && row.target_adapter !== 'mac'))) {
          throw failure('Exact local operation audit is unavailable', 'ROLLBACK_UNAVAILABLE');
        }
        const locked = [];
        for (const operation of audits.rows) {
          const current = await document(operation.collection_name, operation.doc_id, true);
          if (JSON.stringify(normalizeState(current)) !== JSON.stringify(normalizeState(operation.after_data))) {
            throw failure('Current state no longer matches the immutable after-state', 'ROLLBACK_STALE');
          }
          locked.push({ operation, current });
        }
        const results = [];
        for (const { operation, current } of locked) {
          const before = operation.before_data;
          if (before === null) {
            await client.query(
              `delete from documents where book_id=$1 and collection_name=$2 and doc_id=$3`,
              [target.bookId, operation.collection_name, operation.doc_id],
            );
            await audit(operation.collection_name, operation.doc_id, `rollback:${operation.operation}`, current, null);
            results.push({ collection: operation.collection_name, documentId: operation.doc_id, reversal: 'delete' });
            continue;
          }
          const beforeData = Object.hasOwn(before, 'data') ? before.data : before;
          const beforeDeleted = Object.hasOwn(before, 'deleted') ? Boolean(before.deleted) : false;
          let restored;
          if (current === null) {
            const inserted = await client.query(
              `insert into documents(book_id,collection_name,doc_id,data,deleted)
               values($1,$2,$3,$4::jsonb,$5) returning data,deleted,updated_at`,
              [target.bookId, operation.collection_name, operation.doc_id, json(beforeData), beforeDeleted],
            );
            restored = inserted.rows[0];
          } else {
            const updated = await client.query(
              `update documents set data=$4::jsonb,deleted=$5
                where book_id=$1 and collection_name=$2 and doc_id=$3 returning data,deleted,updated_at`,
              [target.bookId, operation.collection_name, operation.doc_id, json(beforeData), beforeDeleted],
            );
            restored = updated.rows[0];
          }
          await audit(operation.collection_name, operation.doc_id, `rollback:${operation.operation}`, current, restored);
          results.push({ collection: operation.collection_name, documentId: operation.doc_id, reversal: current ? 'restore' : 'recreate' });
        }
        return { originalCommandId: original.id, reversedOperations: results };
      },
      async createCheckpoint(commandId, type, data) {
        const result = await client.query(
          `insert into automation_checkpoints(command_id,checkpoint_type,data) values($1,$2,$3::jsonb) returning id, created_at`,
          [commandId, type, json(data)],
        );
        return result.rows[0];
      },
      async enqueueJob(commandId, type, jobTarget, payload, checkpointId) {
        const result = await client.query(
          `insert into automation_jobs(command_id,job_type,target,payload,checkpoint_id,status)
           values($1,$2,$3::jsonb,$4::jsonb,$5,'queued') returning id,status`,
          [commandId, type, json(jobTarget), json(payload), checkpointId],
        );
        return result.rows[0];
      },
      async createBuyerDeploymentManifest(commandId, input) {
        const result = await client.query(
          `insert into buyer_deployment_manifests
           (command_id,buyer_id,project_id,version,artifact_digest,manifest)
           values($1,$2,$3,$4,$5,$6::jsonb)
           returning id,buyer_id,project_id,version,status,created_at`,
          [commandId, input.buyerId, input.target.projectId, input.version, input.artifactDigest.toLowerCase(), json(input.manifest)],
        );
        return result.rows[0];
      },
      async enqueueOutbox(commandId, effectType, dedupeId, payload) {
        const result = await client.query(
          `insert into automation_outbox(command_id,effect_type,dedupe_id,payload)
           values($1,$2,$3,$4::jsonb) on conflict(dedupe_id) do update set dedupe_id=excluded.dedupe_id
           returning id,status,dedupe_id`,
          [commandId, effectType, dedupeId, json(payload)],
        );
        return result.rows[0];
      },
      async createSchedule(commandId, input) {
        const result = await client.query(
          `insert into automation_schedules(id,command_id,tenant_id,book_id,action_id,action_input,cron_expression,timezone,next_run_at)
           values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6::jsonb,$7,$8,$9) returning id,status,next_run_at,updated_at`,
          [input.scheduleId || null, commandId, input.target.tenantId, input.target.bookId, input.actionId, json(input.actionInput), input.cron, input.timezone, input.nextRunAt],
        );
        return result.rows[0];
      },
      async cancelSchedule(input) {
        const result = await client.query(
          `update automation_schedules set status='cancelled',updated_at=now()
            where id=$1 and tenant_id=$2 and book_id=$3 and updated_at=$4 and status='active'
            returning id,status,updated_at`,
          [input.scheduleId, input.target.tenantId, input.target.bookId, input.expectedUpdatedAt],
        );
        if (!result.rowCount) throw stale();
        return result.rows[0];
      },
      async createEventTrigger(commandId, input) {
        const result = await client.query(
          `insert into automation_event_triggers
           (id,command_id,tenant_id,book_id,event_type,action_id,action_input)
           values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7::jsonb)
           returning id,status,updated_at`,
          [input.triggerId || null, commandId, input.target.tenantId, input.target.bookId,
            input.eventType, input.actionId, json(input.actionInput)],
        );
        return result.rows[0];
      },
      async cancelEventTrigger(input) {
        const result = await client.query(
          `update automation_event_triggers set status='cancelled',updated_at=now()
           where id=$1 and tenant_id=$2 and book_id=$3 and updated_at=$4 and status='active'
           returning id,status,updated_at`,
          [input.triggerId, input.target.tenantId, input.target.bookId, input.expectedUpdatedAt],
        );
        if (!result.rowCount) throw stale();
        return result.rows[0];
      },
      async disableEmergency(commandId, reason) {
        const result = await client.query(
          `insert into automation_checkpoints(command_id,checkpoint_type,data)
           values($1,'emergency-disable',$2::jsonb) returning id,created_at`,
          [commandId, json({ reason })],
        );
        return { disabled: true, checkpointId: result.rows[0].id };
      },
      async enableEmergency(commandId, reason) {
        const result = await client.query(
          `update automation_checkpoints set released_at=now(),
           data=data||$2::jsonb where checkpoint_type='emergency-disable' and released_at is null
           returning id`,
          [commandId, json({ enableCommandId: commandId, enableReason: reason })],
        );
        return { disabled: false, released: result.rowCount };
      },
      async pauseWorker(commandId, reason) {
        await client.query(
          `update automation_worker_state set paused=true,updated_at=now(),worker_id=null where singleton=true`,
        );
        return this.createCheckpoint(commandId, 'worker-pause', { reason });
      },
      async resumeWorker(_commandId, _reason) {
        await client.query(
          `update automation_worker_state set paused=false,updated_at=now() where singleton=true`,
        );
        return { paused: false };
      },
    };
  }

  async function confirm({ id, actorId, tokenHash, resolveTarget, execute }) {
    const client = await db.connect();
    let consumed = false;
    let remoteSucceeded = false;
    let remoteOperation;
    let resolved;
    let command;
    try {
      await client.query('begin');
      const found = await client.query(
        `select * from automation_commands where id=$1 and actor_id=$2 for update`,
        [id, actorId],
      );
      command = found.rows[0];
      if (!command) throw Object.assign(new Error('Command not found'), { code: 'COMMAND_NOT_FOUND' });
      resolved = resolveTarget({ target: command.target, actionId: command.action_id });
      const isRemote = resolved.adapter.remote === true && !resolved.central;
      if (command.status === 'prepared') {
        if (new Date(command.confirmation_expires_at) <= new Date()) throw Object.assign(new Error('Confirmation token expired'), { code: 'CONFIRMATION_EXPIRED' });
        const consumeResult = await client.query(
          `update automation_commands
              set status='executing',confirmed_at=now(),target_adapter=$3,
                  confirmation_token_hash=case when $4 then confirmation_token_hash else null end
            where id=$1 and status='prepared' and confirmation_token_hash=$2 returning id`,
          [id, tokenHash, resolved.adapter.name, isRemote],
        );
        if (!consumeResult.rowCount) throw Object.assign(new Error('Confirmation token is invalid'), { code: 'INVALID_CONFIRMATION' });
        consumed = true;
      } else if (isRemote && command.status === 'executing' && command.confirmation_token_hash === tokenHash) {
        consumed = true;
      } else {
        throw Object.assign(new Error('Confirmation token already used or command unavailable'), { code: 'COMMAND_REPLAYED' });
      }
      const normalizedCommand = {
        id: command.id, actionId: command.action_id, actorId: command.actor_id,
      };

      if (isRemote) {
        await client.query('commit');
        const execution = await execute({
          transaction: null, resolved, command: normalizedCommand, storedInput: command.input,
        });
        remoteSucceeded = true;
        remoteOperation = {
          adapter: resolved.adapter.name,
          projectId: command.target.projectId,
          remoteAuditId: execution.remoteAuditId,
          idempotentReplay: Boolean(execution.idempotentReplay),
          result: execution.result,
        };
        const completion = await db.connect();
        try {
          await completion.query('begin');
          await completion.query(
            `insert into automation_command_audit
             (command_id,actor_id,action_id,tenant_id,book_id,collection_name,doc_id,operation,
              before_data,after_data,target_adapter,remote_operation_result,reconciliation_needed)
             values($1::uuid,$2,$3,$4,$5,'__command__',($1::uuid)::text,'remote-execute',$6::jsonb,$7::jsonb,$8,$9::jsonb,false)`,
            [id, actorId, command.action_id, command.target.tenantId, command.target.bookId,
              json(command.input), json(execution.result), resolved.adapter.name, json(remoteOperation)],
          );
          const completed = await completion.query(
            `update automation_commands
                set status='completed',result=$2::jsonb,remote_operation_result=$3::jsonb,
                    reconciliation_needed=false,confirmation_token_hash=null,completed_at=now()
              where id=$1 and status='executing'`,
            [id, json(execution.result), json(remoteOperation)],
          );
          if (!completed.rowCount) throw Object.assign(new Error('Central command completion state changed'), { code: 'CENTRAL_COMPLETION_FAILED' });
          await completion.query(
            `update automation_triggers set status='completed',reconciled_at=now() where command_id=$1`,
            [id],
          );
          await completion.query(
            `update automation_reversal_requests set status='completed',completed_at=now()
              where prepared_rollback_command_id=$1 and status='prepared'`,
            [id],
          );
          await completion.query('commit');
        } catch (error) {
          await completion.query('rollback');
          throw error;
        } finally {
          completion.release();
        }
        return {
          commandId: id, status: 'completed', targetAdapter: resolved.adapter.name,
          remoteOperationResult: remoteOperation, reconciliationNeeded: false, result: execution.result,
        };
      }

      const result = await execute({
        transaction: transaction(client, command), resolved, command: normalizedCommand, storedInput: command.input,
      });
      await client.query(
        `insert into automation_command_audit
         (command_id,actor_id,action_id,tenant_id,book_id,collection_name,doc_id,operation,before_data,after_data,target_adapter,reconciliation_needed)
         values($1::uuid,$2,$3,$4,$5,'__command__',($1::uuid)::text,'execute',$6::jsonb,$7::jsonb,$8,false)`,
        [id, actorId, command.action_id, command.target.tenantId, command.target.bookId, json(command.input), json(result), resolved.adapter.name],
      );
      await client.query(
        `update automation_commands set status='completed',result=$2::jsonb,completed_at=now() where id=$1`,
        [id, json(result)],
      );
      await client.query(
        `update automation_triggers set status='completed',reconciled_at=now()
         where command_id=$1`,
        [id],
      );
      await client.query(
        `update automation_reversal_requests set status='completed',completed_at=now()
          where prepared_rollback_command_id=$1 and status='prepared'`,
        [id],
      );
      await client.query('commit');
      return { commandId: id, status: 'completed', targetAdapter: resolved.adapter.name, reconciliationNeeded: false, result };
    } catch (error) {
      try { await client.query('rollback'); } catch {}
      if (remoteSucceeded) {
        await db.query(
          `update automation_commands
              set reconciliation_needed=true,remote_operation_result=$2::jsonb,error_code='CENTRAL_COMPLETION_FAILED'
            where id=$1 and status='executing'`,
          [id, json(remoteOperation)],
        ).catch(() => {});
        error.code = 'RECONCILIATION_NEEDED';
        error.reconciliationNeeded = true;
        error.remoteOperationResult = remoteOperation;
      } else if (consumed && resolved?.adapter.remote) {
        await db.query(
          `update automation_commands set error_code=$2 where id=$1 and status='executing'`,
          [id, String(error.code || 'REMOTE_EXECUTION_FAILED').slice(0, 128)],
        ).catch(() => {});
      } else if (consumed) {
        await db.query(
          `update automation_commands
              set status='failed',error_code=$2,target_adapter=$3,completed_at=now(),confirmation_token_hash=null
            where id=$1 and status in ('prepared','executing')`,
          [id, String(error.code || 'EXECUTION_FAILED').slice(0, 128), resolved?.adapter.name || null],
        );
        await db.query(
          `update automation_reversal_requests
              set status='pending', prepared_rollback_command_id=null, reviewer_actor_id=null, reviewed_at=null
            where prepared_rollback_command_id=$1 and status='prepared'`,
          [id],
        ).catch(() => {});
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    emergencyDisabled, commandAction, prepare, status, cancel, confirm,
    listActions, actionDetail, createReversalRequest, listReversalRequests,
    getReversalRequestForAction, markReversalPrepared, syncReversalForCommand,
    close: () => db.end(),
  };
}

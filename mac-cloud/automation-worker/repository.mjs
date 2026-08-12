import pg from 'pg';

const { Pool } = pg;
const json = (value) => JSON.stringify(value ?? {});

export function createAutomationRepository({ connectionString, pool, timeoutMs = 5000 } = {}) {
  const db = pool || new Pool({ connectionString, max: 4, statement_timeout: timeoutMs, query_timeout: timeoutMs });

  async function transaction(fn) {
    const client = await db.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function paused() {
    const result = await db.query('select paused from automation_worker_state where singleton=true');
    return result.rows[0]?.paused !== false;
  }

  async function heartbeat(workerId, once = false) {
    await db.query(
      `update automation_worker_state set heartbeat_at=now(),worker_id=$1,
       last_once_at=case when $2 then now() else last_once_at end where singleton=true`,
      [workerId, once],
    );
  }

  async function claimSchedules({ workerId, limit, leaseSeconds }) {
    return transaction(async (client) => {
      const result = await client.query(
        `with due as (
           select id from automation_schedules
            where status='active' and next_run_at <= now()
              and (lease_expires_at is null or lease_expires_at < now())
            order by next_run_at for update skip locked limit $1
         )
         update automation_schedules s set locked_by=$2,
           lease_expires_at=now()+($3::text||' seconds')::interval
         from due where s.id=due.id returning s.*`,
        [limit, workerId, leaseSeconds],
      );
      return result.rows;
    });
  }

  async function completeSchedule(schedule, runAt, nextRunAt) {
    return transaction(async (client) => {
      const dedupe = `schedule:${schedule.id}:${new Date(runAt).toISOString()}`;
      const input = { ...schedule.action_input, idempotencyKey: `trigger:${dedupe}` };
      const trigger = await client.query(
        `insert into automation_triggers
         (dedupe_key,source_type,source_id,run_key,tenant_id,book_id,action_id,action_input)
         values($1,'schedule',$2,$3,$4,$5,$6,$7::jsonb)
         on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning *`,
        [dedupe, schedule.id, new Date(runAt).toISOString(), schedule.tenant_id, schedule.book_id, schedule.action_id, json(input)],
      );
      await client.query(
        `update automation_schedules set last_run_at=$2,next_run_at=$3,locked_by=null,
         lease_expires_at=null,last_error=null,updated_at=now() where id=$1 and locked_by=$4`,
        [schedule.id, runAt, nextRunAt, schedule.locked_by],
      );
      return trigger.rows[0];
    });
  }

  async function failSchedule(id, workerId, error) {
    await db.query(
      `update automation_schedules set last_error=$3,locked_by=null,lease_expires_at=null
       where id=$1 and locked_by=$2`,
      [id, workerId, String(error).slice(0, 2000)],
    );
  }

  async function claim(kind, { workerId, limit, leaseSeconds }) {
    const table = kind === 'job' ? 'automation_jobs' : 'automation_outbox';
    const statuses = kind === 'job' ? "('queued','failed')" : "('pending','failed')";
    return transaction(async (client) => {
      const result = await client.query(
        `with due as (
           select q.id from ${table} q join automation_commands c on c.id=q.command_id
            where q.status in ${statuses} and q.available_at <= now()
              and c.status='completed'
              and (q.lease_expires_at is null or q.lease_expires_at < now())
            order by q.available_at,q.created_at for update of q skip locked limit $1
         )
         update ${table} q set status='${kind === 'job' ? 'running' : 'processing'}',
           locked_by=$2,locked_at=now(),lease_expires_at=now()+($3::text||' seconds')::interval,
           attempts=q.attempts+1
         from due where q.id=due.id returning q.*`,
        [limit, workerId, leaseSeconds],
      );
      return result.rows;
    });
  }

  const claimJobs = (options) => claim('job', options);
  const claimOutbox = (options) => claim('outbox', options);

  async function finish(kind, id, workerId, result = {}) {
    const table = kind === 'job' ? 'automation_jobs' : 'automation_outbox';
    const status = kind === 'job' ? 'succeeded' : 'delivered';
    const finished = kind === 'job' ? 'finished_at' : 'delivered_at';
    await db.query(
      `update ${table} set status=$3,${finished}=now(),locked_by=null,locked_at=null,
       lease_expires_at=null,last_error=null,${kind === 'job' ? 'checkpoint' : 'response_metadata'}=$4::jsonb
       where id=$1 and locked_by=$2`,
      [id, workerId, status, json(result)],
    );
  }

  async function retry(kind, row, workerId, error, delayMs) {
    const table = kind === 'job' ? 'automation_jobs' : 'automation_outbox';
    const dead = row.attempts >= row.max_attempts;
    await db.query(
      `update ${table} set status=$3,last_error=$4,locked_by=null,locked_at=null,lease_expires_at=null,
       available_at=case when $3='failed' then now()+($5::text||' milliseconds')::interval else available_at end,
       dead_lettered_at=case when $3='dead-letter' then now() else dead_lettered_at end
       ${kind === 'job' ? ",dead_letter_reason=case when $3='dead-letter' then $4 else dead_letter_reason end" : ''}
       where id=$1 and locked_by=$2`,
      [row.id, workerId, dead ? 'dead-letter' : 'failed', String(error).slice(0, 2000), delayMs],
    );
  }

  async function ingestEvent(event) {
    return transaction(async (client) => {
      const inserted = await client.query(
        `insert into automation_events(dedupe_key,tenant_id,book_id,event_type,payload)
         values($1,$2,$3,$4,$5::jsonb) on conflict(dedupe_key) do nothing returning *`,
        [event.dedupeKey, event.tenantId, event.bookId, event.eventType, json(event.payload)],
      );
      if (!inserted.rowCount) return { duplicate: true, triggers: [] };
      const definitions = await client.query(
        `select * from automation_event_triggers where status='active' and event_type=$1
         and tenant_id=$2 and book_id=$3`,
        [event.eventType, event.tenantId, event.bookId],
      );
      const triggers = [];
      for (const definition of definitions.rows) {
        const dedupe = `event:${definition.id}:${event.dedupeKey}`;
        const input = { ...definition.action_input, idempotencyKey: `trigger:${dedupe}` };
        const result = await client.query(
          `insert into automation_triggers
           (dedupe_key,source_type,source_id,run_key,tenant_id,book_id,action_id,action_input)
           values($1,'event',$2,$3,$4,$5,$6,$7::jsonb)
           on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning *`,
          [dedupe, definition.id, event.dedupeKey, event.tenantId, event.bookId, definition.action_id, json(input)],
        );
        triggers.push(result.rows[0]);
      }
      return { duplicate: false, eventId: inserted.rows[0].id, triggers };
    });
  }

  async function listTriggers({ tenantId, bookId, limit = 50 }) {
    const result = await db.query(
      `select id,source_type,run_key,tenant_id,book_id,action_id,status,created_at,command_id
       from automation_triggers where status='awaiting-confirmation'
       and ($1::text is null or tenant_id=$1) and ($2::text is null or book_id=$2)
       order by created_at limit $3`,
      [tenantId || null, bookId || null, limit],
    );
    return result.rows;
  }

  async function trigger(id) {
    const result = await db.query('select * from automation_triggers where id=$1', [id]);
    return result.rows[0] || null;
  }

  async function bindTrigger(id, commandId) {
    const result = await db.query(
      `update automation_triggers set status='prepared',command_id=$2,prepared_at=now()
       where id=$1 and status='awaiting-confirmation' returning *`,
      [id, commandId],
    );
    if (!result.rowCount) throw Object.assign(new Error('Trigger is no longer awaiting confirmation'), { code: 'TRIGGER_UNAVAILABLE' });
    return result.rows[0];
  }

  async function reconcile() {
    const result = await db.query(
      `update automation_triggers t set
       status=case c.status when 'completed' then 'completed' when 'failed' then 'failed'
         when 'cancelled' then 'cancelled' when 'executing' then 'confirmed' else t.status end,
       reconciled_at=case when c.status in ('completed','failed','cancelled') then now() else t.reconciled_at end
       from automation_commands c where t.command_id=c.id and
       ((c.status='completed' and t.status<>'completed') or (c.status='failed' and t.status<>'failed')
        or (c.status='cancelled' and t.status<>'cancelled') or (c.status='executing' and t.status='prepared'))
       returning t.id,t.status`,
    );
    return result.rows;
  }

  async function status() {
    const state = await db.query(
      `select paused,heartbeat_at,worker_id,last_once_at,
       (select count(*) from automation_triggers where status='awaiting-confirmation')::int pending_triggers,
       (select count(*) from automation_jobs where status='dead-letter')::int dead_jobs,
       (select count(*) from automation_outbox where status='dead-letter')::int dead_outbox
       from automation_worker_state where singleton=true`,
    );
    return state.rows[0];
  }

  return {
    paused, heartbeat, claimSchedules, completeSchedule, failSchedule, claimJobs, claimOutbox,
    finishJob: (id, workerId, result) => finish('job', id, workerId, result),
    finishOutbox: (id, workerId, result) => finish('outbox', id, workerId, result),
    retryJob: (row, workerId, error, delay) => retry('job', row, workerId, error, delay),
    retryOutbox: (row, workerId, error, delay) => retry('outbox', row, workerId, error, delay),
    ingestEvent, listTriggers, trigger, bindTrigger, reconcile, status, close: () => db.end(),
  };
}

import { randomUUID } from 'node:crypto';
import { CronExpressionParser } from 'cron-parser';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt, base = 1000, max = 3_600_000) =>
  Math.min(max, base * (2 ** Math.max(0, attempt - 1)));

function endpointFor(map, type) {
  const endpoint = map[type];
  if (!endpoint || typeof endpoint.url !== 'string' || !/^https?:\/\//.test(endpoint.url)) {
    throw Object.assign(new Error(`No server endpoint configured for ${type}`), { code: 'DISPATCH_UNCONFIGURED' });
  }
  return endpoint;
}

export function createAutomationWorker({
  repository,
  workerId = `worker-${randomUUID()}`,
  fetchImpl = globalThis.fetch,
  outboxEndpoints = {},
  jobEndpoints = {},
  localJobHandlers = {},
  serviceTokens = {},
  batchSize = 20,
  leaseSeconds = 60,
  requestTimeoutMs = 10_000,
  responseLimitBytes = 64 * 1024,
  now = () => new Date(),
} = {}) {
  if (!repository) throw new Error('Automation repository is required');

  async function post(endpoint, row, type) {
    if (typeof endpoint.auth !== 'string' || !endpoint.auth
      || typeof serviceTokens[endpoint.auth] !== 'string' || !serviceTokens[endpoint.auth]) {
      throw Object.assign(new Error(`No service token configured for ${type}`), { code: 'DISPATCH_AUTH_UNCONFIGURED' });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(requestTimeoutMs, endpoint.timeoutMs || requestTimeoutMs));
    try {
      const response = await fetchImpl(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': String(row.dedupe_id || row.id),
          authorization: `Bearer ${serviceTokens[endpoint.auth]}`,
        },
        body: JSON.stringify({ type, target: row.target, payload: row.payload, checkpoint: row.checkpoint }),
        signal: controller.signal,
      });
      const declared = Number(response.headers?.get?.('content-length') || 0);
      if (declared > responseLimitBytes) throw new Error('Dispatcher response exceeds limit');
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength > responseLimitBytes) throw new Error('Dispatcher response exceeds limit');
      if (!response.ok) throw new Error(`Endpoint returned ${response.status}`);
      return { status: response.status, bytes: body.byteLength };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function schedules() {
    const rows = await repository.claimSchedules({ workerId, limit: batchSize, leaseSeconds });
    for (const row of rows) {
      try {
        const runAt = new Date(row.next_run_at);
        const expression = CronExpressionParser.parse(row.cron_expression, {
          currentDate: runAt, tz: row.timezone,
        });
        await repository.completeSchedule(row, runAt, expression.next().toDate());
      } catch (error) {
        await repository.failSchedule(row.id, workerId, error.message);
      }
    }
    return rows.length;
  }

  async function outbox() {
    const rows = await repository.claimOutbox({ workerId, limit: batchSize, leaseSeconds });
    for (const row of rows) {
      try {
        const endpoint = endpointFor(outboxEndpoints, row.effect_type);
        await repository.finishOutbox(row.id, workerId, await post(endpoint, row, row.effect_type));
      } catch (error) {
        await repository.retryOutbox(row, workerId, error.message, backoff(row.attempts));
      }
    }
    return rows.length;
  }

  async function jobs() {
    const rows = await repository.claimJobs({ workerId, limit: batchSize, leaseSeconds });
    for (const row of rows) {
      try {
        let result;
        if (localJobHandlers[row.job_type]) {
          result = await localJobHandlers[row.job_type]({
            id: row.id, target: row.target, payload: row.payload, checkpoint: row.checkpoint || {},
          });
        } else {
          result = await post(endpointFor(jobEndpoints, row.job_type), row, row.job_type);
        }
        await repository.finishJob(row.id, workerId, result || {});
      } catch (error) {
        await repository.retryJob(row, workerId, error.message, backoff(row.attempts));
      }
    }
    return rows.length;
  }

  async function once() {
    await repository.heartbeat(workerId, true);
    if (await repository.paused()) return { paused: true, schedules: 0, jobs: 0, outbox: 0, reconciled: 0 };
    const scheduleCount = await schedules();
    const reconciled = await repository.reconcile();
    const jobCount = await jobs();
    const outboxCount = await outbox();
    return { paused: false, schedules: scheduleCount, jobs: jobCount, outbox: outboxCount, reconciled: reconciled.length };
  }

  async function run({ intervalMs = 5000, signal } = {}) {
    while (!signal?.aborted) {
      await once();
      await sleep(intervalMs);
    }
  }

  return { workerId, once, run, backoff };
}

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ACTION_REGISTRY, actionCatalog, getAction } from './actions.mjs';
import { generateCriticalReauthProof } from './critical-reauth.mjs';

const commandId = z.string().uuid();
const prepareSchema = z.object({
  actionId: z.string().trim().min(1).max(128),
  input: z.record(z.string(), z.unknown()),
  criticalReauthProof: z.string().max(512).optional(),
}).strict();
const confirmSchema = z.object({ commandId, confirmationToken: z.string().min(32).max(256) }).strict();
const commandSchema = z.object({ commandId }).strict();
const hash = (value) => createHash('sha256').update(value).digest('hex');

export const COMMAND_TOOL_SCHEMAS = Object.freeze({
  'command.prepare': prepareSchema,
  'command.confirm': confirmSchema,
  'command.cancel': commandSchema,
  'command.status': commandSchema,
  'command.catalog': z.object({}).strict(),
});
export const COMMAND_TOOL_NAMES = Object.freeze(Object.keys(COMMAND_TOOL_SCHEMAS));
export const COMMAND_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
});

function verifyReauth({ proof, ownerId, actionId, secret, now, maxAgeMs }) {
  if (!secret || !proof) return false;
  const split = proof.indexOf(':');
  if (split < 1) return false;
  const timestamp = Number(proof.slice(0, split));
  const signature = proof.slice(split + 1);
  if (!Number.isFinite(timestamp) || Math.abs(now() - timestamp) > maxAgeMs) return false;
  const expected = createHmac('sha256', secret).update(`${ownerId}:${actionId}:${timestamp}`).digest('hex');
  const left = Buffer.from(signature); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createCommandCore({
  repository,
  targetRouter,
  confirmationTtlMs = 120_000,
  criticalSecret,
  criticalReauthMaxAgeMs = 300_000,
  now = () => Date.now(),
} = {}) {
  if (!repository) throw new Error('Command repository is required');
  if (!targetRouter) throw new Error('Command target router is required');

  async function prepare(raw, principal, { rollbackFlow = false } = {}) {
    const request = prepareSchema.parse(raw);
    if (await repository.emergencyDisabled() && request.actionId !== 'automation.emergency-enable.v1') {
      throw Object.assign(new Error('Automation commands are emergency-disabled'), { code: 'COMMANDS_DISABLED' });
    }
    const action = getAction(request.actionId);
    if (action.rollbackAction && !rollbackFlow) {
      throw Object.assign(new Error('Rollback must be prepared through the reversal workflow'), { code: 'ROLLBACK_WORKFLOW_REQUIRED' });
    }
    const input = action.schema.parse(request.input);
    if (principal.actorType !== 'owner') throw Object.assign(new Error('Owner context is required'), { code: 'OWNER_REQUIRED' });
    if (action.critical && !verifyReauth({
      proof: request.criticalReauthProof, ownerId: principal.actorId, actionId: action.id,
      secret: criticalSecret, now, maxAgeMs: criticalReauthMaxAgeMs,
    })) throw Object.assign(new Error('Fresh critical re-authentication proof is required'), { code: 'CRITICAL_REAUTH_REQUIRED' });

    const token = randomBytes(32).toString('base64url');
    const prepared = await repository.prepare({
      id: randomUUID(),
      actorId: principal.actorId,
      actionId: action.id,
      target: input.target,
      input,
      idempotencyKey: input.idempotencyKey,
      tokenHash: hash(token),
      expiresAt: new Date(now() + confirmationTtlMs),
      preview: action.preview(input),
      criticalReauthAt: action.critical ? new Date(now()) : null,
      rollbackOfCommandId: action.rollbackAction ? input.originalCommandId : null,
    });
    return {
      commandId: prepared.id,
      actionId: prepared.action_id || action.id,
      status: prepared.status,
      preview: prepared.preview,
      confirmationExpiresAt: prepared.confirmation_expires_at,
      confirmationToken: prepared.existing ? undefined : token,
      idempotentReplay: Boolean(prepared.existing),
    };
  }

  async function prepareRollback(raw, principal) {
    const request = z.object({
      originalCommandId: commandId,
      reason: z.string().trim().min(1).max(1000),
    }).strict().parse(raw);
    if (principal.actorType !== 'owner') throw Object.assign(new Error('Owner context is required'), { code: 'OWNER_REQUIRED' });
    if (!Number.isFinite(principal.accessIssuedAt)
      || now() - principal.accessIssuedAt < 0
      || now() - principal.accessIssuedAt > criticalReauthMaxAgeMs) {
      throw Object.assign(new Error('Refresh the Cloudflare Access session before preparing rollback'), { code: 'ACCESS_REAUTH_REQUIRED' });
    }
    const original = await repository.actionDetail(request.originalCommandId);
    if (!original?.rollbackSupported) {
      throw Object.assign(new Error(original?.rollbackUnavailableReason || 'Action is not rollbackable'), { code: 'ROLLBACK_UNAVAILABLE' });
    }
    const scopedPrincipal = {
      ...principal,
      projectId: original.target.projectId,
      tenantId: original.target.tenantId,
      bookId: original.target.bookId,
    };
    const reversal = await repository.createReversalRequest({
      principal: scopedPrincipal,
      originalCommandId: original.id,
      reason: request.reason,
    });
    const proof = generateCriticalReauthProof({
      ownerId: principal.actorId,
      actionId: 'command.rollback.v1',
      secret: criticalSecret,
      timestamp: now(),
    }).proof;
    const prepared = await prepare({
      actionId: 'command.rollback.v1',
      criticalReauthProof: proof,
      input: {
        target: original.target,
        idempotencyKey: `rollback:${original.id}`,
        originalCommandId: original.id,
        reason: request.reason,
      },
    }, principal, { rollbackFlow: true });
    await repository.markReversalPrepared({
      requestId: reversal.id,
      reviewerActorId: principal.actorId,
      rollbackCommandId: prepared.commandId,
    });
    return { ...prepared, reversalRequestId: reversal.id };
  }

  async function confirm(raw, principal) {
    const request = confirmSchema.parse(raw);
    if (await repository.emergencyDisabled()) {
      const actionId = await repository.commandAction?.(request.commandId, principal.actorId);
      if (actionId !== 'automation.emergency-enable.v1') {
        throw Object.assign(new Error('Automation commands are emergency-disabled'), { code: 'COMMANDS_DISABLED' });
      }
    }
    return repository.confirm({
      id: request.commandId,
      actorId: principal.actorId,
      tokenHash: hash(request.confirmationToken),
      resolveTarget: ({ target, actionId }) => targetRouter.resolve({ target, actionId }),
      execute: async ({ transaction, resolved, command, storedInput }) => {
        const action = getAction(command.actionId);
        const input = action.schema.parse(storedInput);
        return resolved.adapter.execute({ transaction, resolved, action, input, command });
      },
    });
  }

  return {
    prepare,
    prepareRollback,
    confirm,
    cancel: async (raw, principal) => {
      if (await repository.emergencyDisabled()) {
        throw Object.assign(new Error('Automation commands are emergency-disabled'), { code: 'COMMANDS_DISABLED' });
      }
      const request = commandSchema.parse(raw);
      return repository.cancel(request.commandId, principal.actorId);
    },
    status: async (raw, principal) => {
      if (await repository.emergencyDisabled()) {
        throw Object.assign(new Error('Automation commands are emergency-disabled'), { code: 'COMMANDS_DISABLED' });
      }
      const request = commandSchema.parse(raw);
      return repository.status(request.commandId, principal.actorId);
    },
    catalog: async () => {
      if (await repository.emergencyDisabled()) {
        throw Object.assign(new Error('Automation commands are emergency-disabled'), { code: 'COMMANDS_DISABLED' });
      }
      return { version: 1, actions: actionCatalog() };
    },
  };
}

export async function executeCommandTool(name, raw, principal, core) {
  if (!COMMAND_TOOL_NAMES.includes(name)) throw new Error('Command tool is not allowlisted');
  if (name === 'command.prepare') return core.prepare(raw, principal);
  if (name === 'command.confirm') return core.confirm(raw, principal);
  if (name === 'command.cancel') return core.cancel(raw, principal);
  if (name === 'command.status') return core.status(raw, principal);
  if (name === 'command.catalog') return core.catalog();
  throw new Error('Command tool is not allowlisted');
}

export function createCriticalReauthProofForTest({ ownerId, actionId, secret, timestamp }) {
  if (!ACTION_REGISTRY.has(actionId)) throw new Error('Action is not allowlisted');
  return generateCriticalReauthProof({ ownerId, actionId, secret, timestamp }).proof;
}

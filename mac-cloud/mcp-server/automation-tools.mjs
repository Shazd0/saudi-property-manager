import { z } from 'zod';
import { actionCatalog, getAction } from './actions.mjs';

const uuid = z.string().uuid();
export const AUTOMATION_TOOL_SCHEMAS = Object.freeze({
  'automation.pending-triggers': z.object({
    tenantId: z.string().trim().min(1).max(128).optional(),
    bookId: z.string().trim().min(1).max(128).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }).strict(),
  'automation.prepare-trigger': z.object({
    triggerId: uuid,
    criticalReauthProof: z.string().max(512).optional(),
  }).strict(),
  'automation.plan': z.object({
    request: z.string().trim().min(1).max(2000),
    limit: z.number().int().min(1).max(20).default(8),
  }).strict(),
  'automation.worker-status': z.object({}).strict(),
});
export const AUTOMATION_TOOL_NAMES = Object.freeze(Object.keys(AUTOMATION_TOOL_SCHEMAS));

const words = (text) => new Set(String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2));

export async function executeAutomationTool(name, raw, principal, repository, commandCore) {
  if (principal.actorType !== 'owner') throw Object.assign(new Error('Owner context is required'), { code: 'OWNER_REQUIRED' });
  const args = AUTOMATION_TOOL_SCHEMAS[name].parse(raw ?? {});
  if (name === 'automation.pending-triggers') return repository.listTriggers(args);
  if (name === 'automation.worker-status') return repository.status();
  if (name === 'automation.plan') {
    const query = words(args.request);
    const matches = actionCatalog().map((action) => {
      const haystack = words(`${action.actionId} ${action.domain}`);
      const score = [...query].filter((word) => haystack.has(word)
        || [...haystack].some((candidate) => candidate.includes(word) || word.includes(candidate))).length;
      return { ...action, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.actionId.localeCompare(b.actionId))
      .slice(0, args.limit);
    return {
      readOnly: true,
      executesNothing: true,
      matches: matches.map(({ actionId, domain, critical, input }) => ({
        actionId, domain, critical, requiredInputSchema: input,
        guidance: critical
          ? 'Fresh owner reauthentication, prepare, and explicit confirmation are required.'
          : 'Prepare and explicit owner confirmation are required.',
      })),
    };
  }
  if (name === 'automation.prepare-trigger') {
    const trigger = await repository.trigger(args.triggerId);
    if (!trigger || trigger.status !== 'awaiting-confirmation') {
      throw Object.assign(new Error('Trigger is not awaiting confirmation'), { code: 'TRIGGER_UNAVAILABLE' });
    }
    const action = getAction(trigger.action_id);
    const prepared = await commandCore.prepare({
      actionId: action.id,
      input: { ...trigger.action_input, idempotencyKey: `trigger:${trigger.id}:${trigger.run_key}` },
      criticalReauthProof: args.criticalReauthProof,
    }, principal);
    await repository.bindTrigger(trigger.id, prepared.commandId);
    return { ...prepared, triggerId: trigger.id, requiresConfirmation: true };
  }
  throw new Error('Tool is not allowlisted');
}

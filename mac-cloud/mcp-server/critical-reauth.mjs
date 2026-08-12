import { createHmac } from 'node:crypto';
import { getAction } from './actions.mjs';

export function generateCriticalReauthProof({
  ownerId,
  actionId,
  secret,
  timestamp = Date.now(),
  maxAgeMs = 300_000,
  actionLookup = getAction,
} = {}) {
  if (!ownerId || !secret) throw new Error('Server-side owner ID and critical action secret are required');
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error('Timestamp must be a positive integer');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 30_000 || maxAgeMs > 600_000) {
    throw new Error('Critical reauth max age must be between 30000 and 600000 milliseconds');
  }
  const action = actionLookup(actionId);
  if (!action?.critical) throw new Error('Action is not critical');
  const signature = createHmac('sha256', secret)
    .update(`${ownerId}:${action.id}:${timestamp}`)
    .digest('hex');
  return {
    actionId: action.id,
    proof: `${timestamp}:${signature}`,
    timestamp,
    expiresAt: timestamp + maxAgeMs,
    guidance: 'Use immediately as criticalReauthProof; command confirmation is still required.',
  };
}

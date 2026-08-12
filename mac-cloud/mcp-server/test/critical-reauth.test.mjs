import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateCriticalReauthProof } from '../critical-reauth.mjs';
import { runCriticalReauthCli } from '../critical-reauth-cli.mjs';

const secret = 'high-entropy-server-side-critical-secret-123456789';
const ownerId = 'owner-1';
const timestamp = 1_700_000_000_000;

describe('critical reauth proof utility', () => {
  test('generates a bounded proof for a critical allowlisted action', () => {
    const result = generateCriticalReauthProof({
      ownerId, actionId: 'backup.restore.v1', secret, timestamp, maxAgeMs: 120_000,
    });
    assert.equal(result.actionId, 'backup.restore.v1');
    assert.match(result.proof, new RegExp(`^${timestamp}:[a-f0-9]{64}$`));
    assert.equal(result.timestamp, timestamp);
    assert.equal(result.expiresAt, timestamp + 120_000);
    assert.ok(!JSON.stringify(result).includes(secret));
  });

  test('rejects unknown and non-critical actions', () => {
    assert.throws(() => generateCriticalReauthProof({
      ownerId, actionId: 'not.allowlisted.v1', secret, timestamp,
    }), /allowlisted/);
    assert.throws(() => generateCriticalReauthProof({
      ownerId, actionId: 'transaction.create.v1', secret, timestamp,
    }), /not critical/);
  });

  test('CLI uses injected environment and prints only the result fields', () => {
    let output = '';
    const result = runCriticalReauthCli({
      argv: ['book.reset.v1'],
      env: {
        MCP_OWNER_ID: ownerId,
        MCP_CRITICAL_ACTION_SECRET: secret,
        MCP_CRITICAL_REAUTH_MAX_AGE_MS: '60000',
      },
      now: () => timestamp,
      write: (value) => { output += value; },
    });
    assert.deepEqual(JSON.parse(output), result);
    assert.deepEqual(Object.keys(result), ['actionId', 'proof', 'timestamp', 'expiresAt', 'guidance']);
    assert.ok(!output.includes(ownerId));
    assert.ok(!output.includes(secret));
  });
});

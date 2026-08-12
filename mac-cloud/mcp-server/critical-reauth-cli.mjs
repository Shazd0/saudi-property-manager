#!/usr/bin/env node
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { generateCriticalReauthProof } from './critical-reauth.mjs';

export function runCriticalReauthCli({
  argv = process.argv.slice(2),
  env = process.env,
  now = () => Date.now(),
  write = (value) => process.stdout.write(value),
} = {}) {
  if (argv.length !== 1) throw new Error('Usage: npm run critical-reauth -- <critical-action-id>');
  const result = generateCriticalReauthProof({
    ownerId: env.MCP_OWNER_ID,
    actionId: argv[0],
    secret: env.MCP_CRITICAL_ACTION_SECRET,
    timestamp: now(),
    maxAgeMs: Number(env.MCP_CRITICAL_REAUTH_MAX_AGE_MS || 300_000),
  });
  write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCriticalReauthCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

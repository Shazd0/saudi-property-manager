#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runNode(script, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dirname, script), ...extraArgs], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const suffix = dryRun ? ['--dry-run', '--all'] : ['--all'];

  console.log('=== Firebase migration cutover ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const steps = [
    ['inventory.mjs', ['--output', 'migration-report-pre-cutover.json']],
    ...(dryRun ? [] : [['wipe-known-collections.mjs', suffix]]),
    ['postgres-to-firebase.mjs', [...suffix, '--include-deleted']],
    ['buyer-firebase-to-unified.mjs', suffix],
    ['license-registry-to-unified.mjs', suffix],
    ['storage-to-unified.mjs', suffix],
    ['auth-users-import.mjs', suffix],
    ['auth-index-bootstrap.mjs', suffix],
    ['validate-migration.mjs', dryRun ? ['--dry-run'] : []],
  ];

  for (const [script, args] of steps) {
    console.log(`\n>>> ${script} ${args.join(' ')}`);
    await runNode(script, args);
  }

  console.log('\nCutover sequence completed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

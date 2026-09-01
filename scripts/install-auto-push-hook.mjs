#!/usr/bin/env node
/** Installs a post-commit hook that runs `git push` after every local commit. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookDir = path.join(ROOT, '.git', 'hooks');
const hookPath = path.join(hookDir, 'post-commit');

const hook = `#!/bin/sh
# Auto-push after each commit (installed by scripts/install-auto-push-hook.mjs)
branch=$(git branch --show-current)
if [ -n "$branch" ]; then
  git push -u origin "$branch"
fi
`;

if (!fs.existsSync(hookDir)) {
  console.error('No .git/hooks directory — run from a git repo');
  process.exit(1);
}

fs.writeFileSync(hookPath, hook, { mode: 0o755 });
console.log('Installed post-commit auto-push hook:', hookPath);

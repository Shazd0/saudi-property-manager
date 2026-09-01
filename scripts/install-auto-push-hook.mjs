#!/usr/bin/env node
/** Installs post-commit hook: merge to main and push automatically. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookDir = path.join(ROOT, '.git', 'hooks');
const hookPath = path.join(hookDir, 'post-commit');

const hook = `#!/bin/sh
# Auto-merge to main and push (installed by scripts/install-auto-push-hook.mjs)
TARGET="${process.env.AUTO_PUSH_BRANCH || 'main'}"
COMMIT=$(git rev-parse HEAD)
git fetch origin "$TARGET" 2>/dev/null || true
git checkout "$TARGET" 2>/dev/null || git checkout -b "$TARGET" "origin/$TARGET" 2>/dev/null || git checkout -b "$TARGET"
git pull origin "$TARGET" 2>/dev/null || true
git merge --no-edit "$COMMIT" 2>/dev/null || true
git push origin "$TARGET" 2>/dev/null || true
`;

if (!fs.existsSync(hookDir)) {
  console.error('No .git/hooks directory — run from a git repo');
  process.exit(1);
}

fs.writeFileSync(hookPath, hook, { mode: 0o755 });
console.log('Installed post-commit auto-deploy hook →', hookPath);

#!/usr/bin/env node
/**
 * Watches source files and auto-commits + pushes after a quiet period.
 * Usage: npm run auto-push
 * Excludes secrets (.env) and build output.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEBOUNCE_MS = Number(process.env.AUTO_PUSH_DEBOUNCE_MS || 45000);
const WATCH_DIRS = ['components', 'services', 'contexts', 'hooks', 'netlify', 'i18n', 'utils', 'public', 'scripts'];
const WATCH_FILES = ['App.tsx', 'index.tsx', 'netlify.toml', 'firestore.rules', 'package.json'];
const IGNORE_PARTS = ['node_modules', '.git', 'dist', 'latest-github', '.env', 'coverage', '.cursor'];

let timer = null;
let pushing = false;

function log(...args) {
  console.log('[auto-push]', ...args);
}

function shouldIgnore(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return IGNORE_PARTS.some((part) => norm.includes(`/${part}/`) || norm.endsWith(`/${part}`) || norm.startsWith(`${part}/`));
}

function sh(cmd, opts = {}) {
  const result = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
  return opts.silent ? String(result).trim() : '';
}

function schedulePush(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushChanges(reason);
  }, DEBOUNCE_MS);
  log(`change detected (${reason}) — push in ${Math.round(DEBOUNCE_MS / 1000)}s if no more edits`);
}

async function pushChanges(reason) {
  if (pushing) return;
  pushing = true;
  try {
    const dirty = sh('git status --porcelain', { silent: true });
    if (!dirty) {
      log('no changes to push');
      return;
    }

    const branch = sh('git branch --show-current', { silent: true }) || 'main';
    sh('git add -A');
    for (const secret of ['.env', '.env.local', '.env.production', 'latest-github.zip']) {
      try { sh(`git reset HEAD -- "${secret}"`, { silent: true }); } catch { /* ignore */ }
    }

    const msg = `chore: auto-push ${new Date().toISOString()} (${reason})`;
    try {
      sh(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
    } catch {
      log('nothing to commit after excludes');
      return;
    }

    sh(`git push -u origin ${branch}`);
    log('pushed', branch);
  } catch (error) {
    console.error('[auto-push] failed:', error?.message || error);
  } finally {
    pushing = false;
  }
}

function watchPath(target) {
  const full = path.join(ROOT, target);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    fs.watch(full, () => schedulePush(target));
    return;
  }
  fs.watch(full, { recursive: true }, (_, filename) => {
    if (!filename || shouldIgnore(filename)) return;
    schedulePush(filename);
  });
}

log('watching for local edits… debounce', DEBOUNCE_MS, 'ms');
log('root:', ROOT);
for (const dir of WATCH_DIRS) watchPath(dir);
for (const file of WATCH_FILES) watchPath(file);

process.on('SIGINT', () => {
  log('stopped');
  process.exit(0);
});

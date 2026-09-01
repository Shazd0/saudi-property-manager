#!/usr/bin/env node
/**
 * Watches source files, commits, merges to main, and pushes — no manual merge needed.
 * Usage: npm run auto-push
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEBOUNCE_MS = Number(process.env.AUTO_PUSH_DEBOUNCE_MS || 45000);
const TARGET_BRANCH = process.env.AUTO_PUSH_BRANCH || 'main';
const GIT_IDENTITY = ['-c', 'user.name=Shazd0', '-c', 'user.email=shazd0@users.noreply.github.com'];
const WATCH_DIRS = ['components', 'services', 'contexts', 'hooks', 'netlify', 'i18n', 'utils', 'public', 'scripts', '.github'];
const WATCH_FILES = ['App.tsx', 'index.tsx', 'netlify.toml', 'firestore.rules', 'package.json'];
const IGNORE_PARTS = ['node_modules', '.git', 'dist', 'latest-github', '.env', 'coverage', '.cursor'];
const SECRET_PATHS = ['.env', '.env.local', '.env.production', 'latest-github.zip', 'latest-github'];

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
  const result = execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts,
  });
  return opts.silent ? String(result).trim() : '';
}

function git(args, opts = {}) {
  return sh(`git ${GIT_IDENTITY.join(' ')} ${args}`, opts);
}

function schedulePush(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushChanges(reason);
  }, DEBOUNCE_MS);
  log(`change detected (${reason}) — deploy in ${Math.round(DEBOUNCE_MS / 1000)}s if no more edits`);
}

async function pushChanges(reason) {
  if (pushing) return;
  pushing = true;
  const startedOn = git('branch --show-current', { silent: true }) || TARGET_BRANCH;
  try {
    const dirty = git('status --porcelain', { silent: true });
    if (!dirty) {
      log('no changes to push');
      return;
    }

    git('add -A');
    for (const secret of SECRET_PATHS) {
      try { git(`reset HEAD -- "${secret}"`, { silent: true }); } catch { /* ignore */ }
    }

    const msg = `chore: auto-deploy ${new Date().toISOString()} (${reason})`;
    try {
      git(`commit -m "${msg.replace(/"/g, '\\"')}"`);
    } catch {
      log('nothing to commit after excludes');
      return;
    }

    const commit = git('rev-parse HEAD', { silent: true });
    git(`fetch origin ${TARGET_BRANCH}`, { silent: true });
    git(`checkout ${TARGET_BRANCH}`);
    try {
      git(`pull --rebase origin ${TARGET_BRANCH}`, { silent: true });
    } catch {
      git(`pull origin ${TARGET_BRANCH}`, { silent: true });
    }
    git(`merge --no-edit ${commit}`);
    git(`push origin ${TARGET_BRANCH}`);
    log('merged to', TARGET_BRANCH, 'and pushed — Netlify will deploy automatically');

    if (startedOn !== TARGET_BRANCH) {
      try { git(`checkout ${startedOn}`); } catch { /* ignore */ }
    }
  } catch (error) {
    console.error('[auto-push] failed:', error?.message || error);
    try {
      const cur = git('branch --show-current', { silent: true });
      if (cur !== startedOn) git(`checkout ${startedOn}`, { silent: true });
    } catch { /* ignore */ }
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

log('auto-deploy watcher on →', TARGET_BRANCH);
log('root:', ROOT);
for (const dir of WATCH_DIRS) watchPath(dir);
for (const file of WATCH_FILES) watchPath(file);

process.on('SIGINT', () => {
  log('stopped');
  process.exit(0);
});

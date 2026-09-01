#!/usr/bin/env node
/**
 * Bulk import Firebase Auth passwords for all staff users.
 *
 * Firestore stores SHA-256 hashes — plaintext cannot be recovered from the DB alone.
 * This script supports:
 *   1. --passwords-file  JSON/CSV with id + password (+ optional bookId)
 *   2. --use-plaintext-stored  users whose password field is still plaintext (legacy)
 *
 * Usage:
 *   cd mac-cloud
 *   node migrate/import-all-staff-passwords.mjs --export-template staff-passwords.template.json
 *   # fill passwords in the template, then:
 *   node migrate/import-all-staff-passwords.mjs --passwords-file staff-passwords.json --dry-run
 *   node migrate/import-all-staff-passwords.mjs --passwords-file staff-passwords.json
 *   node migrate/import-all-staff-passwords.mjs --use-plaintext-stored --all
 *   node migrate/import-all-staff-passwords.mjs --passwords-file staff-passwords.json --source postgres
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool, closePool } from '../lib/db.mjs';
import { rawBookCollection } from '../lib/collections.mjs';
import {
  getUnifiedAdmin,
  parseMigrationArgs,
  normalizeTeamCode,
  resolveTargetBookId,
  postgresBookIdsForTarget,
  writeReport,
} from './lib/migration-utils.mjs';
import {
  extractPlaintextPassword,
  staffKey,
  upsertFirebaseAuthStaff,
  verifyLegacyPassword,
  writeStaffAuthLinks,
} from './lib/auth-password.mjs';

function printHelp() {
  console.log(`
Bulk Firebase Auth password import for staff users.

Options:
  --all                     All books (default)
  --book TEAMCODE           One target book / teamCode
  --source firestore|postgres   User list source (default: firestore)
  --passwords-file PATH     JSON array or map of id -> password
  --use-plaintext-stored    Import users whose Firestore password is plaintext (not SHA-256)
  --export-template PATH    Write a JSON template of all staff ids (fill passwords, then import)
  --no-verify               Skip verifying file passwords against stored Firestore hash
  --dry-run                 Preview only

Passwords file formats:
  [
    { "id": "admin", "password": "AdminPass123!", "bookId": "default" },
    { "id": "manager1", "password": "Secret456!", "bookId": "P25Y3RHH5GGAZ8" }
  ]

  or map:
  {
    "default:admin": "AdminPass123!",
    "P25Y3RHH5GGAZ8:manager1": "Secret456!"
  }

CSV (with header id,password,bookId) is also accepted.
`);
}

function parseExtraArgs(argv) {
  const args = parseMigrationArgs(argv, { requireCollection: false });
  args.source = 'firestore';
  args.passwordsFile = '';
  args.exportTemplate = '';
  args.usePlaintextStored = false;
  args.verify = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--passwords-file') args.passwordsFile = argv[++i] || '';
    else if (arg.startsWith('--passwords-file=')) args.passwordsFile = arg.slice('--passwords-file='.length);
    else if (arg === '--export-template') args.exportTemplate = argv[++i] || 'staff-passwords.template.json';
    else if (arg.startsWith('--export-template=')) args.exportTemplate = arg.slice('--export-template='.length);
    else if (arg === '--use-plaintext-stored') args.usePlaintextStored = true;
    else if (arg === '--no-verify') args.verify = false;
    else if (arg === '--source') args.source = String(argv[++i] || 'firestore').toLowerCase();
    else if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length).toLowerCase();
  }

  return args;
}

function parseCsvPasswords(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return new Map();
  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  const idIdx = header.indexOf('id');
  const passIdx = header.indexOf('password');
  const bookIdx = header.indexOf('bookid');
  if (idIdx < 0 || passIdx < 0) {
    throw new Error('CSV must have id,password columns (optional bookId)');
  }
  const map = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const id = cells[idIdx] || '';
    const password = cells[passIdx] || '';
    const bookId = bookIdx >= 0 ? (cells[bookIdx] || 'default') : 'default';
    if (id && password) map.set(staffKey(bookId, id), password);
  }
  return map;
}

function loadPasswordsFile(filePath) {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, 'utf8').trim();
  if (!raw) return new Map();

  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    return parseCsvPasswords(raw);
  }

  const parsed = JSON.parse(raw);
  const map = new Map();
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      const id = String(row?.id || '').trim();
      const password = String(row?.password || '');
      const bookId = String(row?.bookId || 'default').trim() || 'default';
      if (id && password) map.set(staffKey(bookId, id), password);
    }
    return map;
  }

  if (parsed && typeof parsed === 'object') {
    for (const [key, password] of Object.entries(parsed)) {
      const value = String(password || '');
      if (!value) continue;
      if (key.includes(':')) {
        map.set(key, value);
      } else {
        map.set(staffKey('default', key), value);
      }
    }
  }
  return map;
}

async function listStaffFromPostgres(postgresBookId) {
  const result = await pool.query(
    `
      select doc_id, data
      from documents
      where book_id = $1 and collection_name = 'users' and deleted = false
      order by doc_id
    `,
    [postgresBookId || 'default'],
  );
  return result.rows.map((row) => ({
    id: row.doc_id,
    ...(row.data || {}),
  }));
}

async function listPostgresBooksWithUsers() {
  const result = await pool.query(
    `
      select distinct book_id
      from documents
      where collection_name = 'users' and deleted = false
      order by book_id
    `,
  );
  return result.rows.map((row) => row.book_id);
}

async function listStaffFromFirestore(db, targetBookId) {
  const collection = rawBookCollection(targetBookId, 'users');
  const snap = await db.collection(collection).get();
  return snap.docs
    .filter((doc) => !doc.data()?.deleted)
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));
}

async function listTargetBooksFromFirestore(db) {
  const books = new Set(['default']);
  const cols = await db.listCollections();
  for (const col of cols) {
    const match = /^book_([A-Z0-9]+)_users$/i.exec(col.id);
    if (match) books.add(match[1].toUpperCase());
  }
  return [...books];
}

function resolvePasswordForUser(user, bookId, passwordsMap, usePlaintextStored) {
  const key = staffKey(bookId, user.id);
  if (passwordsMap.has(key)) return { password: passwordsMap.get(key), source: 'file' };
  if (usePlaintextStored) {
    const plain = extractPlaintextPassword(user.password);
    if (plain) return { password: plain, source: 'plaintext-stored' };
  }
  return { password: '', source: 'missing' };
}

async function loadUsersForBook(args, db, targetBookId) {
  if (args.source === 'postgres') {
    const postgresBooks = postgresBookIdsForTarget(targetBookId);
    const users = [];
    for (const postgresBookId of postgresBooks) {
      const rows = await listStaffFromPostgres(postgresBookId);
      for (const row of rows) {
        users.push({ ...row, bookId: targetBookId });
      }
    }
    return users;
  }

  const rows = await listStaffFromFirestore(db, targetBookId);
  return rows.map((row) => ({ ...row, bookId: targetBookId }));
}

async function exportTemplate(args, db) {
  const targetBooks = args.book
    ? [normalizeTeamCode(args.book) || 'default']
    : await listTargetBooksFromFirestore(db);

  const template = [];
  for (const targetBookId of targetBooks) {
    const users = await loadUsersForBook(args, db, targetBookId);
    for (const user of users) {
      if (user.hasSystemAccess === false) continue;
      template.push({
        id: user.id,
        bookId: targetBookId,
        name: user.name || '',
        password: '',
        storedPasswordType: extractPlaintextPassword(user.password)
          ? 'plaintext'
          : (String(user.password || '').trim() ? 'sha256-hash' : 'missing'),
      });
    }
  }

  const outPath = resolve(args.exportTemplate);
  writeFileSync(outPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${template.length} users to ${outPath}`);
  console.log('Fill the "password" field for each user, then run:');
  console.log(`  node migrate/import-all-staff-passwords.mjs --passwords-file ${args.exportTemplate}`);
}

async function main() {
  const args = parseExtraArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db, auth } = getUnifiedAdmin();

  if (args.exportTemplate) {
    await exportTemplate(args, db);
    return;
  }

  if (!args.passwordsFile && !args.usePlaintextStored) {
    console.error('Provide --passwords-file PATH and/or --use-plaintext-stored');
    printHelp();
    process.exit(1);
  }

  const passwordsMap = args.passwordsFile ? loadPasswordsFile(args.passwordsFile) : new Map();
  const targetBooks = args.book
    ? [normalizeTeamCode(args.book) || 'default']
    : (args.source === 'postgres'
      ? (await listPostgresBooksWithUsers()).map((postgresBookId) => resolveTargetBookId(postgresBookId))
      : await listTargetBooksFromFirestore(db));

  const uniqueBooks = [...new Set(targetBooks)];
  const results = {
    dryRun: args.dryRun,
    source: args.source,
    verify: args.verify,
    migrated: [],
    skipped: [],
    failed: [],
  };

  for (const targetBookId of uniqueBooks) {
    const users = await loadUsersForBook(args, db, targetBookId);
    for (const user of users) {
      const bookId = user.bookId || targetBookId || 'default';
      if (user.hasSystemAccess === false) {
        results.skipped.push({ id: user.id, bookId, reason: 'no-system-access' });
        continue;
      }

      const { password, source } = resolvePasswordForUser(user, bookId, passwordsMap, args.usePlaintextStored);
      if (!password) {
        results.skipped.push({
          id: user.id,
          bookId,
          reason: 'no-password-source',
          hint: 'Add to passwords file or use --export-template',
        });
        continue;
      }

      if (args.verify && user.password && !verifyLegacyPassword(password, user.password)) {
        results.failed.push({
          id: user.id,
          bookId,
          reason: 'password-does-not-match-stored-hash',
        });
        continue;
      }

      try {
        if (args.dryRun) {
          results.migrated.push({
            id: user.id,
            bookId,
            source,
            dryRun: true,
          });
          continue;
        }

        const { uid, email, created } = await upsertFirebaseAuthStaff(auth, user, password, bookId);
        await writeStaffAuthLinks(db, user, bookId, uid, email, false);
        results.migrated.push({
          id: user.id,
          bookId,
          email,
          uid,
          created,
          source,
        });
      } catch (error) {
        results.failed.push({
          id: user.id,
          bookId,
          reason: error?.message || String(error),
        });
      }
    }
  }

  writeReport('import-all-staff-passwords.json', {
    generatedAt: new Date().toISOString(),
    ...results,
  });

  console.log(JSON.stringify({
    dryRun: args.dryRun,
    migrated: results.migrated.length,
    skipped: results.skipped.length,
    failed: results.failed.length,
    passwordsInFile: passwordsMap.size,
  }, null, 2));

  if (results.skipped.length) {
    console.log('\nSkipped (first 10):');
    console.log(JSON.stringify(results.skipped.slice(0, 10), null, 2));
  }
  if (results.failed.length) {
    console.log('\nFailed (first 10):');
    console.log(JSON.stringify(results.failed.slice(0, 10), null, 2));
  }

  if (results.failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

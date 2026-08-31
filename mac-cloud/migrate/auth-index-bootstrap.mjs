#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import { rawBookCollection } from '../lib/collections.mjs';
import {
  getUnifiedAdmin,
  parseMigrationArgs,
  normalizeTeamCode,
  resolveTargetBookId,
  postgresBookIdsForTarget,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/auth-index-bootstrap.mjs --dry-run --all
  node migrate/auth-index-bootstrap.mjs --book TEAMCODE

Creates authIndex/{firebaseUid} docs required by firestore.rules after auth import.
Run after auth-users-import.mjs and before smoke-testing deployed rules.
`);
}

function normalizeRole(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'ADMIN';
  if (['ADMIN', 'MANAGER', 'EMPLOYEE', 'ENGINEER'].includes(value)) {
    return value === 'ENGINEER' ? 'EMPLOYEE' : value;
  }
  return 'EMPLOYEE';
}

function normalizeKind(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'owner';
  return 'staff';
}

async function listStaffUsers(postgresBookId) {
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

async function resolveFirebaseUid(db, targetBookId, user, dryRun) {
  if (user.firebaseUid) return user.firebaseUid;
  const collection = rawBookCollection(targetBookId, 'users');
  const snap = await db.collection(collection).doc(user.id).get();
  const uid = snap.exists ? snap.data()?.firebaseUid : '';
  if (uid || dryRun) return uid || `dry-run-${user.id}`;
  return '';
}

async function writeAuthIndex(db, uid, payload, dryRun) {
  if (!uid || dryRun) return;
  await db.collection('authIndex').doc(uid).set(payload, { merge: true });
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db } = getUnifiedAdmin();
  const postgresBooks = args.book
    ? postgresBookIdsForTarget(normalizeTeamCode(args.book))
    : await listPostgresBooksWithUsers();
  const summaries = [];
  const errors = [];

  for (const postgresBookId of postgresBooks) {
    const targetBookId = resolveTargetBookId(postgresBookId);
    const users = await listStaffUsers(postgresBookId);
    let written = 0;
    let skipped = 0;

    for (const user of users) {
      if (user.hasSystemAccess === false) {
        skipped += 1;
        continue;
      }
      try {
        const uid = await resolveFirebaseUid(db, targetBookId, user, args.dryRun);
        if (!uid) {
          errors.push({ userId: user.id, targetBookId, error: 'missing firebaseUid — run auth-users-import first' });
          continue;
        }
        const role = normalizeRole(user.role, user.isOwner);
        const kind = normalizeKind(user.role, user.isOwner);
        const payload = {
          userId: user.id,
          bookId: targetBookId,
          role,
          kind,
          email: String(user.email || '').trim() || null,
          buildingIds: Array.isArray(user.buildingIds) ? user.buildingIds : [],
          buildingId: user.buildingId || null,
          migratedAt: new Date().toISOString(),
        };
        await writeAuthIndex(db, uid, payload, args.dryRun);
        written += 1;
      } catch (error) {
        errors.push({ userId: user.id, targetBookId, error: error?.message || String(error) });
      }
    }

    summaries.push({ postgresBookId, targetBookId, users: users.length, written, skipped });
    console.log(`OK ${postgresBookId}→${targetBookId}: authIndex written=${written} skipped=${skipped}`);
  }

  console.log(JSON.stringify({ dryRun: args.dryRun, summaries, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

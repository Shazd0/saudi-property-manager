#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import { rawBookCollection } from '../lib/collections.mjs';
import {
  getUnifiedAdmin,
  parseMigrationArgs,
  syntheticStaffEmail,
  normalizeTeamCode,
  resolveTargetBookId,
  postgresBookIdsForTarget,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/auth-users-import.mjs --dry-run --all
  node migrate/auth-users-import.mjs --book TEAMCODE

Creates Firebase Auth users from Firestore users docs.
Passwords cannot be imported (SHA-256) — users must reset password on first login.
`);
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

async function upsertAuthUser(auth, user, bookId, dryRun) {
  const email = String(user.email || '').trim() || syntheticStaffEmail(user.id, bookId);
  const displayName = user.name || user.id;
  const payload = {
    email,
    displayName,
    disabled: String(user.status || '').toLowerCase() === 'inactive',
    emailVerified: Boolean(user.email),
  };

  if (dryRun) {
    return { email, uid: user.firebaseUid || `dry-run-${user.id}`, created: !user.firebaseUid };
  }

  let record;
  if (user.firebaseUid) {
    try {
      record = await auth.updateUser(user.firebaseUid, payload);
    } catch {
      record = null;
    }
  }
  if (!record) {
    try {
      record = await auth.getUserByEmail(email);
      await auth.updateUser(record.uid, payload);
    } catch {
      record = await auth.createUser({ ...payload, password: `Temp-${crypto.randomUUID().slice(0, 8)}!` });
    }
  }

  return { email, uid: record.uid, created: !user.firebaseUid };
}

async function writeFirebaseUid(db, targetBookId, userId, firebaseUid, dryRun) {
  const collection = rawBookCollection(targetBookId, 'users');
  if (dryRun) return;
  await db.collection(collection).doc(userId).set({
    firebaseUid,
    authMigrationAt: new Date().toISOString(),
    requiresPasswordReset: true,
  }, { merge: true });
}

async function writeAuthIndex(db, uid, user, targetBookId, dryRun) {
  if (!uid || user.hasSystemAccess === false) return;
  const roleRaw = String(user.role || '').trim().toUpperCase();
  const isOwner = Boolean(user.isOwner) || roleRaw === 'OWNER';
  const role = isOwner ? 'ADMIN' : (roleRaw === 'ENGINEER' ? 'EMPLOYEE' : (roleRaw || 'EMPLOYEE'));
  const kind = isOwner ? 'owner' : 'staff';
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
  if (dryRun) return;
  await db.collection('authIndex').doc(uid).set(payload, { merge: true });
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db, auth } = getUnifiedAdmin();
  const postgresBooks = args.book
    ? postgresBookIdsForTarget(normalizeTeamCode(args.book))
    : await listPostgresBooksWithUsers();
  const summaries = [];
  const errors = [];

  for (const postgresBookId of postgresBooks) {
    const targetBookId = resolveTargetBookId(postgresBookId);
    const users = await listStaffUsers(postgresBookId);
    let created = 0;
    let updated = 0;
    for (const user of users) {
      try {
        const result = await upsertAuthUser(auth, user, targetBookId, args.dryRun);
        await writeFirebaseUid(db, targetBookId, user.id, result.uid, args.dryRun);
        await writeAuthIndex(db, result.uid, user, targetBookId, args.dryRun);
        if (result.created) created += 1;
        else updated += 1;
      } catch (error) {
        errors.push({ postgresBookId, targetBookId, userId: user.id, error: error?.message || String(error) });
      }
    }
    summaries.push({ postgresBookId, targetBookId, users: users.length, created, updated });
    console.log(`OK ${postgresBookId}→${targetBookId}: users=${users.length} created=${created} updated=${updated}`);
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

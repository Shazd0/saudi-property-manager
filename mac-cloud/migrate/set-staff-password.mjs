#!/usr/bin/env node
/**
 * Set / create Firebase Auth password for a staff user (Admin SDK).
 * Usage:
 *   cd mac-cloud
 *   node migrate/set-staff-password.mjs --id admin --password 'YourNewPassword123!'
 *   node migrate/set-staff-password.mjs --id admin --password '...' --book default
 */
import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import {
  getUnifiedAdmin,
  normalizeTeamCode,
  syntheticStaffEmail,
  parseMigrationArgs,
} from './lib/migration-utils.mjs';

function parseArgs(argv) {
  const args = parseMigrationArgs(argv, { requireCollection: false });
  args.id = '';
  args.password = '';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--id') args.id = argv[++i] || '';
    else if (argv[i] === '--password') args.password = argv[++i] || '';
  }
  return args;
}

function normalizeRole(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'ADMIN';
  if (value === 'ENGINEER') return 'EMPLOYEE';
  if (['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(value)) return value;
  return 'EMPLOYEE';
}

async function loadStaff(db, userId, bookId) {
  const targetBook = bookId || 'default';
  const col = !targetBook || targetBook === 'default' ? 'users' : `book_${targetBook}_users`;
  const direct = await db.collection(col).doc(userId).get();
  if (direct.exists) return { id: userId, bookId: targetBook === 'default' ? 'default' : targetBook, ...(direct.data() || {}) };

  const byField = await db.collection(col).where('id', '==', userId).limit(1).get();
  if (!byField.empty) {
    const doc = byField.docs[0];
    return { id: doc.id, bookId: targetBook === 'default' ? 'default' : targetBook, ...(doc.data() || {}) };
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.id || !args.password) {
    console.error('Usage: node migrate/set-staff-password.mjs --id admin --password \'NewPass123!\' [--book default]');
    process.exit(1);
  }
  if (String(args.password).length < 6) {
    console.error('Password must be at least 6 characters (Firebase Auth minimum).');
    process.exit(1);
  }

  const rawBook = String(args.book || 'default').trim() || 'default';
  const bookId = rawBook.toLowerCase() === 'default' ? 'default' : (normalizeTeamCode(rawBook) || 'default');
  const { db, app } = getUnifiedAdmin();
  const auth = getAuth(app);
  const staff = await loadStaff(db, args.id, bookId);
  if (!staff) {
    console.error(`Staff user not found: ${args.id} (book ${bookId})`);
    process.exit(1);
  }

  const email = String(staff.email || '').trim() || syntheticStaffEmail(staff.id, staff.bookId || 'default');
  const normalizedEmail = email.toLowerCase();
  let record;
  try {
    record = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(record.uid, {
      password: args.password,
      displayName: staff.name || staff.id,
      disabled: String(staff.status || '').toLowerCase() === 'inactive',
    });
  } catch {
    record = await auth.createUser({
      email: normalizedEmail,
      password: args.password,
      displayName: staff.name || staff.id,
      emailVerified: false,
    });
  }

  const role = normalizeRole(staff.role, staff.isOwner);
  const kind = String(staff.role || '').toUpperCase() === 'OWNER' || staff.isOwner ? 'owner' : 'staff';
  await db.collection('authIndex').doc(record.uid).set({
    userId: staff.id,
    bookId: staff.bookId || 'default',
    role,
    kind,
    email: normalizedEmail,
    migratedAt: new Date().toISOString(),
  }, { merge: true });

  const usersCol = !staff.bookId || staff.bookId === 'default' ? 'users' : `book_${staff.bookId}_users`;
  await db.collection(usersCol).doc(staff.id).set({
    firebaseUid: record.uid,
    email: staff.email || normalizedEmail,
    requiresPasswordReset: false,
    authPasswordSetAt: new Date().toISOString(),
  }, { merge: true });

  console.log(JSON.stringify({
    ok: true,
    userId: staff.id,
    email: normalizedEmail,
    uid: record.uid,
    bookId: staff.bookId || 'default',
    role,
  }, null, 2));
  console.log(`\nLogin at https://amlakrrgroup.netlify.app with User ID "${staff.id}" and the password you just set.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

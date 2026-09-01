#!/usr/bin/env node
import crypto from 'node:crypto';
import { syntheticStaffEmail } from './migration-utils.mjs';

export function sha256Hex(plain) {
  return crypto.createHash('sha256').update(String(plain || ''), 'utf8').digest('hex');
}

export function isSha256Hash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || '').trim());
}

export function verifyLegacyPassword(plain, stored) {
  const value = String(stored || '');
  if (!value) return false;
  if (isSha256Hash(value)) return sha256Hex(plain) === value.toLowerCase();
  return plain === value;
}

export function extractPlaintextPassword(stored) {
  const value = String(stored || '').trim();
  if (!value || isSha256Hash(value)) return '';
  return value;
}

export function normalizeRole(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'ADMIN';
  if (value === 'ENGINEER') return 'EMPLOYEE';
  if (['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(value)) return value;
  return 'EMPLOYEE';
}

export function normalizeKind(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'owner';
  return 'staff';
}

export function staffKey(bookId, userId) {
  const book = String(bookId || 'default').trim() || 'default';
  const id = String(userId || '').trim();
  return `${book}:${id}`;
}

export async function upsertFirebaseAuthStaff(auth, staff, password, bookId) {
  if (!password || String(password).length < 6) {
    throw new Error(`Password for ${staff.id} must be at least 6 characters`);
  }

  const email = String(staff.email || '').trim() || syntheticStaffEmail(staff.id, bookId);
  const normalizedEmail = email.toLowerCase();
  const payload = {
    password,
    displayName: staff.name || staff.id,
    disabled: String(staff.status || '').toLowerCase() === 'inactive',
  };

  let record;
  try {
    record = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(record.uid, payload);
    return { uid: record.uid, email: normalizedEmail, created: false };
  } catch {
    record = await auth.createUser({
      email: normalizedEmail,
      emailVerified: Boolean(staff.email),
      ...payload,
    });
    return { uid: record.uid, email: normalizedEmail, created: true };
  }
}

export async function writeStaffAuthLinks(db, staff, bookId, uid, email, dryRun) {
  const role = normalizeRole(staff.role, staff.isOwner);
  const kind = normalizeKind(staff.role, staff.isOwner);
  const usersCol = !bookId || bookId === 'default' ? 'users' : `book_${bookId}_users`;

  if (dryRun) {
    return { usersCol, role, kind };
  }

  await db.collection('authIndex').doc(uid).set({
    userId: staff.id,
    bookId: bookId || 'default',
    role,
    kind,
    email,
    migratedAt: new Date().toISOString(),
  }, { merge: true });

  await db.collection(usersCol).doc(staff.id).set({
    firebaseUid: uid,
    email: staff.email || email,
    requiresPasswordReset: false,
    authPasswordSetAt: new Date().toISOString(),
  }, { merge: true });

  return { usersCol, role, kind };
}

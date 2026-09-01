import { signInWithEmailAndPassword, sendPasswordResetEmail, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, getDb } from '../firebase';
import { getCurrentBookId, loadUserByFirebaseUid, loadUserByLoginId } from './firestoreService';
import type { User } from '../types';

function normalizeLoginId(value: string): string {
  return String(value || '').trim();
}

function normalizeRole(role: unknown, isOwner?: boolean): string {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'ADMIN';
  if (value === 'ENGINEER') return 'EMPLOYEE';
  if (['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(value)) return value;
  return 'EMPLOYEE';
}

function normalizeKind(role: unknown, isOwner?: boolean): 'staff' | 'owner' {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'owner';
  return 'staff';
}

export function staffEmailForLogin(loginId: string, bookId?: string): string {
  const id = normalizeLoginId(loginId);
  if (id.includes('@')) return id.toLowerCase();
  const book = String(bookId || getCurrentBookId() || 'default').trim().toUpperCase();
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return `${safeId}@${book}.amlak.internal`.toLowerCase();
}

export async function ensureAuthIndexForStaff(
  uid: string,
  staff: { id: string; role?: string; isOwner?: boolean; email?: string; bookId?: string },
): Promise<void> {
  if (!uid || !staff?.id) return;
  const db = getDb();
  const ref = doc(db, 'authIndex', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const bookId = staff.bookId || getCurrentBookId() || 'default';
  await setDoc(ref, {
    userId: staff.id,
    bookId,
    role: normalizeRole(staff.role, staff.isOwner),
    kind: normalizeKind(staff.role, staff.isOwner),
    email: String(staff.email || '').trim() || null,
    bootstrappedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function resolveStaffUserAfterAuth(firebaseUser: FirebaseUser): Promise<User | null> {
  const uid = firebaseUser.uid;
  let staff = await loadUserByFirebaseUid(uid);
  if (!staff) {
    const loginId = String(firebaseUser.email || '').split('@')[0]?.trim();
    if (loginId) staff = await loadUserByLoginId(loginId);
  }
  if (!staff) return null;

  await ensureAuthIndexForStaff(uid, {
    id: staff.id,
    role: staff.role,
    isOwner: (staff as any).isOwner,
    email: staff.email || firebaseUser.email || undefined,
    bookId: staff.bookId,
  });

  return staff;
}

export async function loginWithFirebaseAuth(loginId: string, password: string): Promise<User | null> {
  const id = normalizeLoginId(loginId);
  if (!id || !password) return null;

  const bookId = getCurrentBookId() || 'default';
  let email = staffEmailForLogin(id, bookId);

  try {
    const profile = await loadUserByLoginId(id);
    if (profile?.email) email = String(profile.email).trim();
  } catch {
    // Pre-login profile lookup may be blocked until authIndex exists — synthetic email is fine.
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = await resolveStaffUserAfterAuth(credential.user);
  if (!user) {
    throw new Error('Signed in but no staff profile found. Contact admin to link your Firebase account.');
  }
  return user;
}

export async function requestPasswordReset(loginId: string): Promise<void> {
  const id = normalizeLoginId(loginId);
  const bookId = getCurrentBookId() || 'default';
  let email = staffEmailForLogin(id, bookId);
  try {
    const profile = await loadUserByLoginId(id);
    if (profile?.email) email = String(profile.email).trim();
    else if (profile?.bookId) email = staffEmailForLogin(id, profile.bookId);
  } catch {
    /* use synthetic email */
  }
  await sendPasswordResetEmail(auth, email);
}

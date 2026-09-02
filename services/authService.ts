import { signInWithEmailAndPassword, sendPasswordResetEmail, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, getDb } from '../firebase';
import {
  getCurrentBookId,
  loadUserByFirebaseUid,
  loadUserByLoginId,
  verifyPassword,
} from './firestoreService';
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

/** Resolve staff profile + Firebase Auth email across all books (default + book_{teamCode}_users). */
export async function resolveStaffLoginTarget(loginId: string): Promise<{
  profile: User;
  bookId: string;
  email: string;
} | null> {
  const id = normalizeLoginId(loginId);
  if (!id) return null;

  const profile = await loadUserByLoginId(id);
  if (!profile) return null;

  const bookId = String(profile.bookId || getCurrentBookId() || 'default').trim() || 'default';
  const storedEmail = String(profile.email || '').trim();
  const email = storedEmail.includes('@')
    ? storedEmail.toLowerCase()
    : staffEmailForLogin(id, bookId);

  return { profile, bookId, email };
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

export async function resolveStaffUserAfterAuth(firebaseUser: FirebaseUser, loginIdHint?: string): Promise<User | null> {
  const uid = firebaseUser.uid;
  const loginId = normalizeLoginId(loginIdHint || String(firebaseUser.email || '').split('@')[0]);

  let staff: User | null = null;
  try {
    staff = await loadUserByFirebaseUid(uid);
  } catch (error) {
    console.warn('loadUserByFirebaseUid failed', error);
  }
  if (!staff && loginId) {
    try {
      staff = await loadUserByLoginId(loginId);
    } catch (error) {
      console.warn('loadUserByLoginId failed', error);
    }
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

function isFirebaseCredentialError(error: unknown): boolean {
  const code = String((error as any)?.code || '');
  return code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password';
}

function buildLoginEmailCandidates(loginId: string, target?: { email: string; bookId: string } | null): string[] {
  const id = normalizeLoginId(loginId);
  const activeBook = getCurrentBookId() || 'default';
  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (email: string) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (target) {
    addCandidate(target.email);
    addCandidate(staffEmailForLogin(id, target.bookId));
  }
  if (id.includes('@')) addCandidate(id);
  addCandidate(staffEmailForLogin(id, activeBook));
  if (activeBook !== 'default') addCandidate(staffEmailForLogin(id, 'default'));

  return candidates;
}

async function signInWithEmailCandidates(
  loginId: string,
  password: string,
  emails: string[],
): Promise<User | null> {
  let lastError: unknown = null;
  for (const email of emails) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = await resolveStaffUserAfterAuth(credential.user, loginId);
      if (user) return user;
      throw new Error('Signed in but no staff profile found. Contact admin to link your Firebase account.');
    } catch (error: any) {
      lastError = error;
      if (isFirebaseCredentialError(error)) continue;
      throw error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

/**
 * Provision Firebase Auth for a staff user when Firestore already has this password
 * (admin reset, password change, or legacy login cutover).
 */
export async function provisionStaffFirebaseAuth(
  loginId: string,
  plainPassword: string,
  bookId?: string,
): Promise<{ email: string; bookId: string }> {
  const target = await resolveStaffLoginTarget(loginId);
  const resolvedBookId = bookId || target?.bookId || getCurrentBookId() || 'default';
  return migrateStaffPasswordWithLegacy(loginId, plainPassword, plainPassword, resolvedBookId);
}

export async function loginWithFirebaseAuth(loginId: string, password: string): Promise<User | null> {
  const id = normalizeLoginId(loginId);
  if (!id || !password) return null;

  const target = await resolveStaffLoginTarget(id);
  const candidateEmails = buildLoginEmailCandidates(id, target);

  try {
    const user = await signInWithEmailCandidates(id, password, candidateEmails);
    if (user) return user;
  } catch (error) {
    if (!isFirebaseCredentialError(error)) throw error;
  }

  // Firestore password is valid but Firebase Auth was never synced (common after admin reset).
  if (target?.profile) {
    const storedHash = String((target.profile as any).password || '');
    if (storedHash && await verifyPassword(password, storedHash)) {
      try {
        await provisionStaffFirebaseAuth(id, password, target.bookId);
        const syncedUser = await signInWithEmailCandidates(id, password, candidateEmails);
        if (syncedUser) return syncedUser;
      } catch (syncError) {
        console.warn('Auto-sync Firebase password failed', syncError);
        throw new Error(
          'Your password is correct in the system but Firebase login is not set up yet. '
          + 'Use Forgot Password with your current password, or ask admin to reset again after this update is deployed.',
        );
      }
    }
  }

  throw new Error('Invalid ID or password');
}

export async function requestPasswordReset(loginId: string): Promise<void> {
  const target = await resolveStaffLoginTarget(loginId);
  if (!target) throw new Error('User ID not found');
  await sendPasswordResetEmail(auth, target.email);
}

/**
 * Verify Firestore password and set Firebase Auth password (self-service cutover / reset).
 * Book is resolved automatically by searching all books — no manual --book needed in UI.
 */
export async function migrateStaffPasswordWithLegacy(
  loginId: string,
  oldPassword: string,
  newPassword: string,
  bookId?: string,
): Promise<{ email: string; bookId: string }> {
  const id = normalizeLoginId(loginId);
  if (!id || !oldPassword || !newPassword) {
    throw new Error('User ID, current password, and new password are required');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const target = await resolveStaffLoginTarget(id);
  const resolvedBookId = bookId || target?.bookId || getCurrentBookId() || 'default';

  const endpoints = [
    '/api/staff-migrate-login',
    'https://me-central2-saudi-property-manager.cloudfunctions.net/staffMigrateLogin',
    'https://us-central1-saudi-property-manager.cloudfunctions.net/staffMigrateLogin',
  ];

  let lastError = 'Password migration endpoint unavailable';
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
          oldPassword,
          newPassword,
          bookId: resolvedBookId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = data?.error || `HTTP ${res.status}`;
        if (res.status === 404 && url.includes('me-central2')) continue;
        throw new Error(lastError);
      }
      return {
        email: String(data.email || staffEmailForLogin(id, resolvedBookId)),
        bookId: String(data.bookId || resolvedBookId),
      };
    } catch (error: any) {
      lastError = error?.message || String(error);
      if (String(lastError).includes('Failed to fetch') || String(lastError).includes('NetworkError')) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    `${lastError}. Contact admin — password sync service may need FIREBASE_SERVICE_ACCOUNT_JSON on Netlify.`,
  );
}

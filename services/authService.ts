import { collection, getDocs, query, where } from 'firebase/firestore';
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

async function loadStaffByLoginId(loginId: string): Promise<User | null> {
  const id = normalizeLoginId(loginId);
  if (!id) return null;
  const db = getDb();

  const direct = await getDoc(doc(db, 'users', id));
  if (direct.exists()) {
    return { ...(direct.data() as User), id, bookId: 'default' };
  }

  const q = query(collection(db, 'users'), where('id', '==', id));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const data = snap.docs[0].data() as User;
    return { ...data, id: data.id || id, bookId: 'default' };
  }

  return null;
}

export async function resolveStaffUserAfterAuth(firebaseUser: FirebaseUser, loginIdHint?: string): Promise<User | null> {
  const uid = firebaseUser.uid;
  const loginId = normalizeLoginId(loginIdHint || String(firebaseUser.email || '').split('@')[0]);

  let staff: User | null = null;
  if (loginId) {
    try {
      staff = await loadStaffByLoginId(loginId);
    } catch (error) {
      console.warn('loadStaffByLoginId failed', error);
    }
  }
  if (!staff) {
    try {
      staff = await loadUserByFirebaseUid(uid);
    } catch (error) {
      console.warn('loadUserByFirebaseUid failed', error);
    }
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

export async function loginWithFirebaseAuth(loginId: string, password: string): Promise<User | null> {
  const id = normalizeLoginId(loginId);
  if (!id || !password) return null;

  const bookId = getCurrentBookId() || 'default';
  const email = staffEmailForLogin(id, bookId);

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = await resolveStaffUserAfterAuth(credential.user, id);
  if (!user) {
    throw new Error('Signed in but no staff profile found. Contact admin to link your Firebase account.');
  }
  return user;
}

export async function requestPasswordReset(loginId: string): Promise<void> {
  const id = normalizeLoginId(loginId);
  const bookId = getCurrentBookId() || 'default';
  const email = staffEmailForLogin(id, bookId);
  await sendPasswordResetEmail(auth, email);
}

/**
 * Cutover helper: verify old Mac/Firestore password via Cloud Function Admin SDK,
 * then create/update Firebase Auth password so normal login works.
 */
export async function migrateStaffPasswordWithLegacy(
  loginId: string,
  oldPassword: string,
  newPassword: string,
  bookId = 'default',
): Promise<{ email: string }> {
  const id = normalizeLoginId(loginId);
  if (!id || !oldPassword || !newPassword) {
    throw new Error('User ID, current password, and new password are required');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const endpoints = [
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
          bookId: bookId || 'default',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = data?.error || `HTTP ${res.status}`;
        if (res.status === 404 && url.includes('me-central2')) continue;
        throw new Error(lastError);
      }
      return { email: String(data.email || staffEmailForLogin(id, bookId)) };
    } catch (error: any) {
      lastError = error?.message || String(error);
      if (String(lastError).includes('Failed to fetch') || String(lastError).includes('NetworkError')) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    `${lastError}. Deploy staffMigrateLogin, or on Mac run: cd mac-cloud && npm run migrate:set-password -- --id ${id} --password 'YourNewPassword'`,
  );
}

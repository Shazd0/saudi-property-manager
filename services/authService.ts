import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { getCurrentBookId, loadUserByFirebaseUid, loadUserByLoginId } from './firestoreService';
import type { User } from '../types';

function normalizeLoginId(value: string): string {
  return String(value || '').trim();
}

export function staffEmailForLogin(loginId: string, bookId?: string): string {
  const id = normalizeLoginId(loginId);
  if (id.includes('@')) return id.toLowerCase();
  const book = String(bookId || getCurrentBookId() || 'default').trim().toUpperCase();
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  return `${safeId}@${book}.amlak.internal`.toLowerCase();
}

export async function loginWithFirebaseAuth(loginId: string, password: string): Promise<User | null> {
  const id = normalizeLoginId(loginId);
  if (!id || !password) return null;

  const profile = await loadUserByLoginId(id);
  const bookId = profile?.bookId || getCurrentBookId() || 'default';
  const email = String(profile?.email || '').trim() || staffEmailForLogin(id, bookId);

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = await loadUserByFirebaseUid(credential.user.uid, bookId);
  if (!user) {
    throw new Error('Signed in but no staff profile found. Contact admin to link your Firebase account.');
  }
  return user;
}

export async function requestPasswordReset(loginId: string): Promise<void> {
  const id = normalizeLoginId(loginId);
  const profile = await loadUserByLoginId(id);
  const bookId = profile?.bookId || getCurrentBookId() || 'default';
  const email = String(profile?.email || '').trim() || staffEmailForLogin(id, bookId);
  await sendPasswordResetEmail(auth, email);
}

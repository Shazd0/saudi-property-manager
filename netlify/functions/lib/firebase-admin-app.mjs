import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.AMLAK_ADMIN_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error('Server missing FIREBASE_SERVICE_ACCOUNT_JSON — add it in Netlify env vars');
  }
  const parsed = JSON.parse(raw);
  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return initializeApp({
    credential: cert(parsed),
    projectId: parsed.project_id || 'saudi-property-manager',
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

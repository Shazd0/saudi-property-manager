import crypto from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sha256Hex(plain) {
  return crypto.createHash('sha256').update(String(plain || ''), 'utf8').digest('hex');
}

function verifyLegacyPassword(plain, stored) {
  const value = String(stored || '');
  if (!value) return false;
  if (/^[a-f0-9]{64}$/i.test(value)) return sha256Hex(plain) === value.toLowerCase();
  return plain === value;
}

function syntheticEmail(userId, bookId) {
  const safeId = String(userId || 'user').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  const book = String(bookId || 'default').trim().toUpperCase() || 'DEFAULT';
  return `${safeId}@${book}.amlak.internal`.toLowerCase();
}

function normalizeRole(role, isOwner) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER' || isOwner) return 'ADMIN';
  if (value === 'ENGINEER') return 'EMPLOYEE';
  if (['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(value)) return value;
  return 'EMPLOYEE';
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.AMLAK_ADMIN_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error('Server missing FIREBASE_SERVICE_ACCOUNT_JSON — add it in Netlify env vars');
  }
  const parsed = JSON.parse(raw);
  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return initializeApp({ credential: cert(parsed), projectId: parsed.project_id || 'saudi-property-manager' });
}

async function lookupStaffInCollection(db, collectionName, userId) {
  let snap = await db.collection(collectionName).doc(userId).get();
  if (!snap.exists) {
    const q = await db.collection(collectionName).where('id', '==', userId).limit(1).get();
    if (!q.empty) snap = q.docs[0];
  }
  return snap.exists ? snap : null;
}

async function findStaffUserAcrossBooks(db, userId, hintBookId) {
  const hint = String(hintBookId || 'default').trim() || 'default';
  const tried = new Set();

  async function tryBook(bookId) {
    const key = bookId || 'default';
    if (tried.has(key)) return null;
    tried.add(key);
    const col = key === 'default' ? 'users' : `book_${key}_users`;
    const snap = await lookupStaffInCollection(db, col, userId);
    if (snap) return { snap, bookId: key, usersCol: col };
    return null;
  }

  if (hint !== 'default') {
    const hinted = await tryBook(hint);
    if (hinted) return hinted;
  }
  const defaultHit = await tryBook('default');
  if (defaultHit) return defaultHit;

  const cols = await db.listCollections();
  for (const col of cols) {
    const match = /^book_([A-Z0-9]+)_users$/i.exec(col.id);
    if (!match) continue;
    const found = await tryBook(match[1].toUpperCase());
    if (found) return found;
  }
  return null;
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }

  try {
    const body = await req.json();
    const userId = String(body?.userId || '').trim();
    const oldPassword = String(body?.oldPassword || '');
    const newPassword = String(body?.newPassword || '');
    const bookId = String(body?.bookId || 'default').trim() || 'default';

    if (!userId || !oldPassword || !newPassword) {
      return json(400, { error: 'userId, oldPassword, and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return json(400, { error: 'New password must be at least 6 characters' });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const auth = getAuth(app);

    const located = await findStaffUserAcrossBooks(db, userId, bookId);
    if (!located) return json(404, { error: 'User ID not found' });

    const { snap, bookId: resolvedBookId, usersCol } = located;
    const data = snap.data() || {};
    if (data.hasSystemAccess === false) {
      return json(403, { error: 'Account does not have system access' });
    }
    if (!verifyLegacyPassword(oldPassword, data.password)) {
      return json(401, { error: 'Current password is incorrect' });
    }

    const email = String(data.email || '').trim() || syntheticEmail(userId, resolvedBookId);
    const normalizedEmail = email.toLowerCase();
    let record;
    try {
      record = await auth.getUserByEmail(normalizedEmail);
      await auth.updateUser(record.uid, {
        password: newPassword,
        displayName: data.name || userId,
        disabled: String(data.status || '').toLowerCase() === 'inactive',
      });
    } catch {
      record = await auth.createUser({
        email: normalizedEmail,
        password: newPassword,
        displayName: data.name || userId,
        emailVerified: Boolean(data.email),
      });
    }

    const role = normalizeRole(data.role, data.isOwner);
    const kind = String(data.role || '').toUpperCase() === 'OWNER' || data.isOwner ? 'owner' : 'staff';
    await db.collection('authIndex').doc(record.uid).set({
      userId,
      bookId: resolvedBookId,
      role,
      kind,
      email: normalizedEmail,
      migratedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection(usersCol).doc(snap.id).set({
      firebaseUid: record.uid,
      password: sha256Hex(newPassword),
      requiresPasswordReset: false,
      authPasswordSetAt: new Date().toISOString(),
    }, { merge: true });

    return json(200, {
      ok: true,
      userId,
      email: normalizedEmail,
      uid: record.uid,
      bookId: resolvedBookId,
    });
  } catch (error) {
    console.error('staff-migrate-login failed', error);
    return json(500, { error: error?.message || 'Password migration failed' });
  }
};

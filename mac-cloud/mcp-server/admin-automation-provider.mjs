import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const denied = () => Object.assign(new Error('Admin automation authentication failed'), { code: 'UNAUTHORIZED' });
const AMLAK_ADMIN_PREFIX = 'amlak-admin.';
const USER_ID = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:@-]+$/);

const ServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();

function isAdminRole(role) {
  return String(role || '').trim().toUpperCase() === 'ADMIN';
}

function isActiveAdmin(data = {}) {
  if (!isAdminRole(data.role)) return false;
  if (data.hasSystemAccess === false) return false;
  const status = String(data.status || '').trim().toLowerCase();
  if (status === 'inactive' || status === 'disabled') return false;
  return true;
}

async function findStaffUser(db, userId) {
  const byDoc = await db.collection('users').doc(userId).get();
  if (byDoc.exists) return { id: byDoc.id, ...byDoc.data() };
  const query = await db.collection('users').where('id', '==', userId).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  const index = await db.collection('authIndex').doc(userId).get();
  if (index.exists) return { id: userId, ...index.data() };
  return null;
}

function principalFromUser(user, fallbackId) {
  return {
    actorType: 'owner',
    actorId: String(user.email || user.id || fallbackId),
    email: user.email || undefined,
    bookId: '*',
    accessIssuedAt: Date.now(),
  };
}

export function createAdminAutomationProvider(serviceAccountJson) {
  if (!serviceAccountJson?.trim()) {
    return {
      available: false,
      async verify() { throw denied(); },
    };
  }
  let serviceAccount;
  try {
    serviceAccount = ServiceAccountSchema.parse(JSON.parse(serviceAccountJson));
  } catch {
    return {
      available: false,
      async verify() { throw denied(); },
    };
  }
  const appName = 'mcp-amlak-admin';
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, appName);
  const db = getFirestore(app);

  return {
    available: true,
    async verify(token) {
      if (!token) throw denied();

      if (token.startsWith(AMLAK_ADMIN_PREFIX)) {
        let userId;
        try {
          userId = USER_ID.parse(token.slice(AMLAK_ADMIN_PREFIX.length));
        } catch {
          throw denied();
        }
        const user = await findStaffUser(db, userId);
        if (!user || !isActiveAdmin(user)) throw denied();
        return principalFromUser(user, userId);
      }

      const decoded = await getAuth(app).verifyIdToken(token, true);
      const uid = String(decoded.uid || '').trim();
      if (!uid) throw denied();
      const user = await findStaffUser(db, uid);
      if (!user || !isActiveAdmin(user)) throw denied();
      const issuedAt = Number(decoded.auth_time || decoded.iat || 0) * 1000;
      return {
        ...principalFromUser(user, uid),
        accessIssuedAt: Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt : Date.now(),
      };
    },
  };
}

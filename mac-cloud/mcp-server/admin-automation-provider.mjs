import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const denied = () => Object.assign(new Error('Admin automation authentication failed'), { code: 'UNAUTHORIZED' });

const ServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();

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

  return {
    available: true,
    async verify(idToken) {
      if (!idToken) throw denied();
      const decoded = await getAuth(app).verifyIdToken(idToken, true);
      const snapshot = await getFirestore(app).collection('authIndex').doc(decoded.uid).get();
      if (!snapshot.exists) throw denied();
      const role = String(snapshot.data()?.role || '').trim().toUpperCase();
      if (role !== 'ADMIN') throw denied();
      const issuedAt = Number(decoded.auth_time || decoded.iat || 0) * 1000;
      return {
        actorType: 'owner',
        actorId: String(decoded.email || decoded.uid),
        email: decoded.email || undefined,
        bookId: '*',
        accessIssuedAt: Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt : Date.now(),
      };
    },
  };
}

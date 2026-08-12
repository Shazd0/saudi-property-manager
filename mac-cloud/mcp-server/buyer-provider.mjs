import { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const ServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();

const ProjectSchema = z.object({
  buyerId: z.string().min(1).max(128),
  tenantId: z.string().min(1).max(128).optional(),
  bookId: z.string().min(1).max(128),
  schemaVersion: z.union([z.string().min(1).max(64), z.number().int().nonnegative()]).default(1),
  capabilities: z.array(z.string().min(1).max(128)).max(500).default([]),
  enabled: z.boolean().default(true),
  serviceAccount: ServiceAccountSchema,
  buildingIds: z.array(z.string().min(1).max(128)).max(500).optional(),
}).strict().transform((value) => ({ ...value, tenantId: value.tenantId || value.buyerId }));

const ProjectsSchema = z.record(z.string().min(1), ProjectSchema);
const AuthIndexSchema = z.object({
  buyerId: z.string().min(1).max(128).optional(),
  bookId: z.string().min(1).max(128).optional(),
  role: z.string().min(1).max(64).optional(),
  kind: z.enum(['staff', 'owner', 'tenant']).optional(),
  buildingIds: z.array(z.string().min(1).max(128)).max(500).default([]),
  buildingId: z.string().min(1).max(128).optional(),
  customerId: z.string().min(1).max(128).optional(),
  disabled: z.boolean().optional(),
}).passthrough();

const BUYER_COLLECTIONS = new Set(['buildings', 'contracts', 'transactions', 'tasks', 'customers']);
const PRIVILEGED_ROLES = new Set(['buyer_admin', 'manager']);

export function normalizeAuthIndex(raw, config) {
  const index = AuthIndexSchema.parse(raw);
  if (index.disabled) throw new Error('Buyer authentication failed');
  if (index.buyerId && index.buyerId !== config.buyerId) throw new Error('Buyer authentication failed');
  if (index.bookId && index.bookId !== config.bookId) throw new Error('Buyer authentication failed');

  const role = String(index.role || '').trim().toUpperCase();
  const kind = String(index.kind || '').trim().toLowerCase();
  let normalizedRole;
  if (kind === 'tenant' || role === 'TENANT') normalizedRole = 'tenant';
  else if (role === 'CUSTOMER') normalizedRole = 'customer';
  else if (kind === 'owner' || role === 'ADMIN' || role === 'OWNER' || role === 'BUYER_ADMIN') normalizedRole = 'buyer_admin';
  else if (role === 'MANAGER') normalizedRole = 'manager';
  else if (kind === 'staff' || role === 'BUYER') normalizedRole = 'buyer';
  else throw new Error('Buyer authentication failed');

  const indexBuildingIds = [...new Set([
    ...(index.buildingIds || []),
    ...(index.buildingId ? [index.buildingId] : []),
  ])];
  const configuredBuildingIds = config.buildingIds || [];
  let buildingIds;
  if (configuredBuildingIds.length && indexBuildingIds.length) {
    const configured = new Set(configuredBuildingIds);
    buildingIds = indexBuildingIds.filter((id) => configured.has(id));
  } else {
    buildingIds = configuredBuildingIds.length ? [...configuredBuildingIds] : indexBuildingIds;
  }
  const allBuildings = PRIVILEGED_ROLES.has(normalizedRole)
    && configuredBuildingIds.length === 0
    && indexBuildingIds.length === 0;
  if (['tenant', 'customer'].includes(normalizedRole) && !index.customerId) {
    throw new Error('Buyer policy is incomplete');
  }
  return {
    role: normalizedRole,
    buildingIds,
    allBuildings,
    customerId: index.customerId,
  };
}

class FirebaseBuyerDataRepository {
  constructor(firestore, bookId, timeoutMs = 5000) {
    this.firestore = firestore;
    this.bookId = bookId;
    this.timeoutMs = timeoutMs;
  }

  async documents(bookId, collection, limit = 100) {
    if (bookId !== this.bookId) throw new Error('Book is not authorized');
    if (!BUYER_COLLECTIONS.has(collection)) throw new Error('Collection is not allowlisted');
    const bounded = Math.min(Math.max(Number(limit) || 1, 1), 250);
    let timer;
    try {
      const snapshot = await Promise.race([
        this.firestore.collection(collection).limit(bounded).get(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Buyer data request timed out')), this.timeoutMs);
        }),
      ]);
      return snapshot.docs
        .map((doc) => ({ ...(doc.data() || {}), id: doc.id }))
        .filter((item) => item.deleted !== true);
    } finally {
      clearTimeout(timer);
    }
  }
}

export class BuyerIdentityProvider {
  get available() { return false; }
  async verify() { throw new Error('Buyer identity provider unavailable'); }
  async repositoryFor() { throw new Error('Buyer data provider unavailable'); }
  async close() {}
}

export class FirebaseBuyerIdentityProvider extends BuyerIdentityProvider {
  constructor(projects) {
    super();
    this.projects = ProjectsSchema.parse(projects);
    for (const [projectId, config] of Object.entries(this.projects)) {
      if (config.serviceAccount.project_id !== projectId) {
        throw new Error(`Firebase service account project mismatch for ${projectId}`);
      }
    }
    this.apps = new Map();
  }

  get available() { return Object.keys(this.projects).length > 0; }

  appFor(projectId) {
    const config = this.projects[projectId];
    if (!config) return null;
    if (!this.apps.has(projectId)) {
      const name = `mcp-buyer-${projectId}`;
      const app = getApps().find((candidate) => candidate.name === name)
        || initializeApp({ credential: cert(config.serviceAccount), projectId }, name);
      this.apps.set(projectId, app);
    }
    return this.apps.get(projectId);
  }

  async verify({ projectId, idToken }) {
    const config = this.projects[projectId];
    if (!config?.enabled) throw new Error('Buyer authentication failed');
    const app = this.appFor(projectId);
    if (!app || !idToken) throw new Error('Buyer authentication failed');
    const decoded = await getAuth(app).verifyIdToken(idToken, true);
    const snapshot = await getFirestore(app).collection('authIndex').doc(decoded.uid).get();
    if (!snapshot.exists) throw new Error('Buyer authentication failed');
    const policy = normalizeAuthIndex(snapshot.data(), config);
    return {
      actorType: 'buyer',
      actorId: decoded.uid,
      uid: decoded.uid,
      projectId,
      buyerId: config.buyerId,
      tenantId: config.tenantId,
      bookId: config.bookId,
      ...policy,
    };
  }

  async repositoryFor(principal) {
    const app = this.appFor(principal?.projectId);
    if (!app || this.projects[principal.projectId]?.buyerId !== principal.buyerId) {
      throw new Error('Buyer data provider unavailable');
    }
    return new FirebaseBuyerDataRepository(getFirestore(app), principal.bookId);
  }

  async close() {
    await Promise.all([...this.apps.values()].map((app) => deleteApp(app)));
  }
}

export function createBuyerIdentityProvider(json) {
  if (!json) return new BuyerIdentityProvider();
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('BUYER_FIREBASE_PROJECTS_JSON is invalid JSON');
  }
  return new FirebaseBuyerIdentityProvider(raw);
}

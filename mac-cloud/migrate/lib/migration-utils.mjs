#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs',
  authDomain: 'saudi-property-manager.firebaseapp.com',
  projectId: 'saudi-property-manager',
  storageBucket: 'saudi-property-manager.firebasestorage.app',
  messagingSenderId: '854165833434',
  appId: '1:854165833434:web:bc550b5c79266bd1fb07e3',
};

export const LICENSE_REGISTRY_PROJECT = 'amlak-sales-main';

export const REGISTRY_COLLECTIONS = [
  'product_licenses',
  'license_gift_reveals',
  'product_zatca_jobs',
];

export const SKIP_MIGRATION_COLLECTIONS = new Set([
  'migration_runs',
  'api_audit_log',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

export function parseMigrationArgs(argv, defaults = {}) {
  const args = {
    dryRun: false,
    all: false,
    includeDeleted: false,
    collections: [],
    book: '',
    output: '',
    help: false,
    ...defaults,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--all') args.all = true;
    else if (arg === '--include-deleted') args.includeDeleted = true;
    else if (arg === '--collection') args.collections.push(argv[++i]);
    else if (arg.startsWith('--collection=')) args.collections.push(arg.slice('--collection='.length));
    else if (arg === '--book') args.book = argv[++i] || '';
    else if (arg.startsWith('--book=')) args.book = arg.slice('--book='.length);
    else if (arg === '--output') args.output = argv[++i] || '';
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length);
    else if (arg === '--help' || arg === '-h') args.help = true;
  }

  if (!args.all && args.collections.length === 0 && defaults.requireCollection !== false) {
    args.all = true;
  }
  return args;
}

export function parseServiceAccountJson(raw) {
  if (!raw || !String(raw).trim()) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed.private_key && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getServiceAccountFromEnv(primaryEnv, fallbackEnv) {
  const raw = process.env[primaryEnv] || process.env[fallbackEnv] || '';
  if (raw.trim()) return parseServiceAccountJson(raw);
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      return JSON.parse(readFileSync(credPath, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export function getAdminApp(projectId, serviceAccount, appName = 'migration') {
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;
  if (!serviceAccount) {
    throw new Error(`Missing service account for ${projectId}. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.`);
  }
  return initializeApp(
    { credential: cert(serviceAccount), projectId: serviceAccount.project_id || projectId },
    appName,
  );
}

export function getUnifiedAdmin() {
  const sa = getServiceAccountFromEnv('FIREBASE_SERVICE_ACCOUNT_JSON', 'AMLAK_ADMIN_FIREBASE_SERVICE_ACCOUNT_JSON');
  const app = getAdminApp(DEFAULT_FIREBASE_CONFIG.projectId, sa, 'migration-unified');
  return {
    app,
    db: getFirestore(app),
    storage: getStorage(app),
    auth: getAuth(app),
    projectId: DEFAULT_FIREBASE_CONFIG.projectId,
  };
}

export function getRegistryAdmin() {
  const sa = getServiceAccountFromEnv('LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON', 'AMLAK_SALES_SERVICE_ACCOUNT_JSON');
  const app = getAdminApp(LICENSE_REGISTRY_PROJECT, sa, 'migration-registry');
  return {
    app,
    db: getFirestore(app),
    projectId: LICENSE_REGISTRY_PROJECT,
  };
}

export function loadBuyerProjectsMap() {
  const raw = process.env.BUYER_FIREBASE_PROJECTS_JSON || '{}';
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadPostgresBookIdMap() {
  const raw = process.env.POSTGRES_BOOK_ID_MAP || '';
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Map Postgres book_id (20-char legacy id) → target teamCode bookId. */
export function resolveTargetBookId(postgresBookId) {
  const id = String(postgresBookId || '').trim();
  if (!id || id === 'default') return 'default';
  const mapped = loadPostgresBookIdMap()[id];
  if (mapped) return normalizeTeamCode(mapped) || String(mapped);
  const normalized = normalizeTeamCode(id);
  if (/^[A-Z0-9]{14}$/.test(normalized)) return normalized;
  return id;
}

/** Reverse lookup: all Postgres book_ids that should land under one teamCode. */
export function postgresBookIdsForTarget(targetBookId) {
  const target = normalizeTeamCode(targetBookId);
  if (!target || target === 'DEFAULT') return ['default'];
  const map = loadPostgresBookIdMap();
  const pgIds = Object.entries(map)
    .filter(([, value]) => normalizeTeamCode(value) === target)
    .map(([postgresBookId]) => postgresBookId);
  if (pgIds.length) return pgIds;
  return [targetBookId];
}

function tokenizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function labelsLikelyMatch(bookName, licenseLabel) {
  const left = String(bookName || '').trim().toLowerCase();
  const right = String(licenseLabel || '').trim().toLowerCase();
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = tokenizeLabel(left);
  const rightTokens = tokenizeLabel(right);
  return rightTokens.some((token) => leftTokens.includes(token));
}

export async function suggestPostgresBookIdMap(pool, licenseBuyers = []) {
  const suggestions = {};
  const evidence = [];
  const activeBuyers = (licenseBuyers || []).filter((buyer) => buyer.teamCode && buyer.status === 'active');

  const booksResult = await pool.query(`
    select doc_id, data
    from documents
    where book_id = 'default' and collection_name = 'books' and deleted = false
  `);

  for (const row of booksResult.rows) {
    const postgresBookId = row.doc_id;
    if (!postgresBookId || postgresBookId === 'default') continue;
    const data = row.data || {};
    const bookName = String(data.name || data.label || data.title || '').trim();
    const embeddedTeamCode = normalizeTeamCode(data.teamCode || data.team_code || data.bookId);

    if (embeddedTeamCode) {
      suggestions[postgresBookId] = embeddedTeamCode;
      evidence.push({
        postgresBookId,
        teamCode: embeddedTeamCode,
        source: 'books.teamCode',
        bookName,
      });
      continue;
    }

    for (const buyer of activeBuyers) {
      if (!labelsLikelyMatch(bookName, buyer.label)) continue;
      suggestions[postgresBookId] = buyer.teamCode;
      evidence.push({
        postgresBookId,
        teamCode: buyer.teamCode,
        source: 'books.label-match',
        bookName,
        licenseLabel: buyer.label,
      });
      break;
    }
  }

  const metaResult = await pool.query(`
    select book_id, data
    from documents
    where collection_name = 'meta' and deleted = false and book_id <> 'default'
  `);
  for (const row of metaResult.rows) {
    const postgresBookId = row.book_id;
    if (!postgresBookId || suggestions[postgresBookId]) continue;
    const data = row.data || {};
    const metaName = String(data.companyName || data.bookName || data.name || data.label || '').trim();
    const embeddedTeamCode = normalizeTeamCode(data.teamCode || data.team_code || data.bookId);
    if (embeddedTeamCode) {
      suggestions[postgresBookId] = embeddedTeamCode;
      evidence.push({
        postgresBookId,
        teamCode: embeddedTeamCode,
        source: 'meta.teamCode',
        bookName: metaName,
      });
      continue;
    }
    for (const buyer of activeBuyers) {
      if (!labelsLikelyMatch(metaName, buyer.label)) continue;
      suggestions[postgresBookId] = buyer.teamCode;
      evidence.push({
        postgresBookId,
        teamCode: buyer.teamCode,
        source: 'meta.label-match',
        bookName: metaName,
        licenseLabel: buyer.label,
      });
      break;
    }
  }

  return { suggestions, evidence };
}

export function normalizeTeamCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function denormalizeFirestoreValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(denormalizeFirestoreValue);
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
    return value;
  }
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested !== undefined) out[key] = denormalizeFirestoreValue(nested);
  }
  return out;
}

export function normalizeForHash(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000)).toISOString();
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const nested = value[key];
    if (nested !== undefined) out[key] = normalizeForHash(nested);
  }
  return out;
}

export function stableHash(value) {
  const text = JSON.stringify(normalizeForHash(value));
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function writeReport(filename, data) {
  const outPath = resolve(process.cwd(), filename || 'migration-report.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${outPath}`);
  return outPath;
}

function docRefFromPath(db, collectionPath, docId) {
  const parts = String(collectionPath || '').split('/').filter(Boolean);
  if (parts.length === 1) return db.collection(parts[0]).doc(docId);
  let ref = db.collection(parts[0]).doc(parts[1]);
  for (let i = 2; i < parts.length; i += 2) {
    ref = ref.collection(parts[i]).doc(parts[i + 1] || docId);
  }
  if (parts.length % 2 === 1) return ref.collection(parts[parts.length - 1]).doc(docId);
  return ref;
}

export async function batchWriteDocs(db, writes, { dryRun = false, batchSize = 400 } = {}) {
  if (dryRun) return writes.length;
  let written = 0;
  for (let i = 0; i < writes.length; i += batchSize) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + batchSize);
    for (const item of chunk) {
      const ref = docRefFromPath(db, item.collection, item.id);
      if (item.delete) batch.delete(ref);
      else if (item.merge) batch.set(ref, item.data, { merge: true });
      else batch.set(ref, item.data);
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

export async function listCollectionIds(db, collectionName) {
  const snap = await db.collection(collectionName).select().get();
  return snap.docs.map((doc) => doc.id);
}

export async function countCollection(db, collectionName) {
  try {
    const snap = await db.collection(collectionName).count().get();
    return snap.data().count || 0;
  } catch {
    const snap = await db.collection(collectionName).select().get();
    return snap.size;
  }
}

export async function readAllDocs(db, collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

export function syntheticStaffEmail(userId, bookId) {
  const safeId = String(userId || 'user').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
  const safeBook = normalizeTeamCode(bookId) || 'default';
  return `${safeId}@${safeBook}.amlak.internal`;
}

export { FieldValue, Timestamp };

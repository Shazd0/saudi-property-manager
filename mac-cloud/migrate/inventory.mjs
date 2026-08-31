#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import { KNOWN_COLLECTIONS, rawBookCollection } from '../lib/collections.mjs';
import {
  DEFAULT_FIREBASE_CONFIG,
  LICENSE_REGISTRY_PROJECT,
  REGISTRY_COLLECTIONS,
  getUnifiedAdmin,
  getRegistryAdmin,
  loadBuyerProjectsMap,
  normalizeTeamCode,
  countCollection,
  writeReport,
  parseMigrationArgs,
  loadPostgresBookIdMap,
  suggestPostgresBookIdMap,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/inventory.mjs
  node migrate/inventory.mjs --output migration-report.json

Environment:
  DATABASE_URL                          Postgres on Mac Mini
  FIREBASE_SERVICE_ACCOUNT_JSON         saudi-property-manager admin SA
  LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON amlak-sales-main admin SA
  POSTGRES_BOOK_ID_MAP                  legacy book_id → teamCode (required for buyers)
  BUYER_FIREBASE_PROJECTS_JSON          optional map of buyer Firebase projects
  SKIP_BUYER_FIREBASE_IMPORT            set 1 to skip missing buyer SAs
`);
}

async function postgresInventory() {
  const counts = await pool.query(`
    select book_id, collection_name, count(*)::int as doc_count
    from documents
    where deleted = false
    group by book_id, collection_name
    order by book_id, collection_name
  `);
  const users = await pool.query(`
    select book_id, count(*)::int as user_count
    from documents
    where collection_name = 'users' and deleted = false
    group by book_id
    order by book_id
  `);
  const total = await pool.query(`
    select count(*)::int as total from documents where deleted = false
  `);
  return {
    totalDocuments: total.rows[0]?.total || 0,
    byBookCollection: counts.rows,
    usersByBook: users.rows,
  };
}

async function firestoreProjectInventory(db, projectId, collections) {
  const byCollection = {};
  let total = 0;
  for (const name of collections) {
    try {
      const count = await countCollection(db, name);
      if (count > 0) byCollection[name] = count;
      total += count;
    } catch (error) {
      byCollection[name] = { error: error?.message || String(error) };
    }
  }
  return { projectId, totalDocuments: total, byCollection };
}

async function discoverBookPrefixedCollections(db) {
  const collections = await db.listCollections();
  const bookPrefixes = new Map();
  for (const col of collections) {
    const match = /^book_([^_]+)_(.+)$/.exec(col.id);
    if (!match) continue;
    const [, bookId, collectionName] = match;
    if (!bookPrefixes.has(bookId)) bookPrefixes.set(bookId, {});
    try {
      const count = await countCollection(db, col.id);
      bookPrefixes.get(bookId)[collectionName] = count;
    } catch (error) {
      bookPrefixes.get(bookId)[collectionName] = { error: error?.message || String(error) };
    }
  }
  return Object.fromEntries(bookPrefixes.entries());
}

async function licenseRegistryInventory() {
  const { db } = getRegistryAdmin();
  const snap = await db.collection('product_licenses').get();
  const buyers = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const teamCode = normalizeTeamCode(d.teamCode);
    const projectId = String(d.tenantFirebaseConfig?.projectId || '').trim();
    buyers.push({
      licenseId: doc.id,
      teamCode,
      status: d.status || 'unknown',
      label: d.label || '',
      sourceProjectId: projectId,
      bookId: teamCode || null,
      activatedEmail: d.activatedEmail || null,
    });
  }
  const registryCounts = {};
  for (const name of REGISTRY_COLLECTIONS) {
    registryCounts[name] = await countCollection(db, name);
  }
  return { projectId: LICENSE_REGISTRY_PROJECT, registryCounts, buyers };
}

async function storageInventory(bucket, prefix = '') {
  try {
    const [files] = await bucket.getFiles({ prefix });
    let bytes = 0;
    for (const file of files) {
      const meta = file.metadata || {};
      bytes += Number(meta.size || 0);
    }
    return { objectCount: files.length, totalBytes: bytes, prefix: prefix || '/' };
  } catch (error) {
    return { error: error?.message || String(error), prefix: prefix || '/' };
  }
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2), { requireCollection: false });
  if (args.help) {
    printHelp();
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    targetProject: DEFAULT_FIREBASE_CONFIG.projectId,
    postgres: null,
    unifiedFirebase: null,
    licenseRegistry: null,
    buyerProjects: [],
    storage: {},
    authInventory: [],
    warnings: [],
  };

  try {
    report.postgres = await postgresInventory();
  } catch (error) {
    report.postgres = { error: error?.message || String(error) };
    report.warnings.push('Postgres unavailable — run on Mac Mini or set DATABASE_URL');
  }

  try {
    const { db, storage } = getUnifiedAdmin();
    const base = await firestoreProjectInventory(db, DEFAULT_FIREBASE_CONFIG.projectId, KNOWN_COLLECTIONS);
    const bookScoped = await discoverBookPrefixedCollections(db);
    report.unifiedFirebase = { ...base, bookScopedCollections: bookScoped };
    report.storage.unified = await storageInventory(storage.bucket());
  } catch (error) {
    report.unifiedFirebase = { error: error?.message || String(error) };
    report.warnings.push('Unified Firebase inventory failed — set FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  try {
    report.licenseRegistry = await licenseRegistryInventory();
  } catch (error) {
    report.licenseRegistry = { error: error?.message || String(error) };
    report.warnings.push('License registry inventory failed — set LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON');
  }

  const buyerMap = loadBuyerProjectsMap();
  const buyersFromRegistry = report.licenseRegistry?.buyers || [];
  const buyerProjectIds = new Set();
  for (const buyer of buyersFromRegistry) {
    if (buyer.sourceProjectId) buyerProjectIds.add(buyer.sourceProjectId);
  }
  for (const projectId of Object.keys(buyerMap)) buyerProjectIds.add(projectId);

  for (const projectId of buyerProjectIds) {
    if (!projectId || projectId === DEFAULT_FIREBASE_CONFIG.projectId) continue;
    const entry = {
      projectId,
      firestore: null,
      storage: null,
      linkedTeamCodes: buyersFromRegistry
        .filter((b) => b.sourceProjectId === projectId)
        .map((b) => b.teamCode)
        .filter(Boolean),
    };
    const config = buyerMap[projectId];
    if (config?.serviceAccount) {
      try {
        const { getAdminApp } = await import('./lib/migration-utils.mjs');
        const { getFirestore } = await import('firebase-admin/firestore');
        const { getStorage } = await import('firebase-admin/storage');
        const app = getAdminApp(projectId, config.serviceAccount, `buyer-${projectId}`);
        const db = getFirestore(app);
        entry.firestore = await firestoreProjectInventory(db, projectId, KNOWN_COLLECTIONS);
        entry.storage = await storageInventory(getStorage(app).bucket());
      } catch (error) {
        entry.firestore = { error: error?.message || String(error) };
      }
    } else {
      entry.note = 'No service account in BUYER_FIREBASE_PROJECTS_JSON — use Firestore export or add credentials';
    }
    report.buyerProjects.push(entry);
  }

  if (report.postgres?.byBookCollection) {
    for (const row of report.postgres.byBookCollection) {
      if (row.collection_name === 'users') {
        report.authInventory.push({ bookId: row.book_id, staffUsers: row.doc_count });
      }
    }
  }

  const buyerBookMap = (report.licenseRegistry?.buyers || []).map((b) => ({
    licenseId: b.licenseId,
    teamCode: b.teamCode,
    bookId: b.teamCode,
    sourceProjectId: b.sourceProjectId,
    firestoreTargetPrefix: b.teamCode ? `book_${b.teamCode}_` : null,
    status: b.status,
    label: b.label,
  }));
  report.buyerBookMap = buyerBookMap;

  const postgresBooks = {};
  if (report.postgres?.byBookCollection) {
    for (const row of report.postgres.byBookCollection) {
      if (!postgresBooks[row.book_id]) {
        postgresBooks[row.book_id] = { bookId: row.book_id, totalDocuments: 0, collections: {} };
      }
      postgresBooks[row.book_id].collections[row.collection_name] = row.doc_count;
      postgresBooks[row.book_id].totalDocuments += row.doc_count;
    }
  }
  report.postgresBooks = Object.values(postgresBooks);

  const configuredMap = loadPostgresBookIdMap();
  report.postgresBookIdMap = {
    configured: configuredMap,
    suggested: {},
    evidence: [],
  };
  if (report.postgres?.byBookCollection) {
    try {
      const { suggestions, evidence } = await suggestPostgresBookIdMap(
        pool,
        report.licenseRegistry?.buyers || [],
      );
      report.postgresBookIdMap.suggested = suggestions;
      report.postgresBookIdMap.evidence = evidence;
      if (!Object.keys(configuredMap).length && Object.keys(suggestions).length) {
        report.warnings.push(
          'POSTGRES_BOOK_ID_MAP is empty — copy postgresBookIdMap.suggested from migration-report.json into root .env before cutover',
        );
      }
    } catch (error) {
      report.postgresBookIdMap.error = error?.message || String(error);
    }
  }

  writeReport(args.output || 'migration-report.json', report);
  console.log(JSON.stringify({
    postgresTotal: report.postgres?.totalDocuments,
    unifiedFirebaseTotal: report.unifiedFirebase?.totalDocuments,
    buyerCount: buyerBookMap.length,
    buyerProjectCount: report.buyerProjects.length,
    warnings: report.warnings,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

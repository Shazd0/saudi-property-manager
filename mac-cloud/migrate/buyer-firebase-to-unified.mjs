#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import {
  BOOK_SCOPED_COLLECTIONS,
  KNOWN_COLLECTIONS,
  rawBookCollection,
} from '../lib/collections.mjs';
import {
  denormalizeFirestoreValue,
  getUnifiedAdmin,
  getRegistryAdmin,
  loadBuyerProjectsMap,
  normalizeTeamCode,
  parseMigrationArgs,
  batchWriteDocs,
  getAdminApp,
  parseServiceAccountJson,
  postgresBookIdsForTarget,
} from './lib/migration-utils.mjs';
import { getFirestore } from 'firebase-admin/firestore';

function printHelp() {
  console.log(`
Usage:
  node migrate/buyer-firebase-to-unified.mjs --dry-run --all
  node migrate/buyer-firebase-to-unified.mjs --book TEAMCODE

Imports each buyer Firebase project into book_{teamCode}_* collections.
Skips docs that already exist in Postgres for the same book/collection/doc_id.
`);
}

async function postgresDocExists(teamCode, collectionName, docId) {
  const postgresBookIds = postgresBookIdsForTarget(teamCode);
  for (const postgresBookId of postgresBookIds) {
    const result = await pool.query(
      `
        select 1 from documents
        where book_id = $1 and collection_name = $2 and doc_id = $3 and deleted = false
        limit 1
      `,
      [postgresBookId, collectionName, docId],
    );
    if (result.rows.length > 0) return true;
  }
  return false;
}

async function unifiedDocExists(db, bookId, collectionName, docId) {
  const target = rawBookCollection(bookId, collectionName);
  const snap = await db.collection(target).doc(docId).get();
  return snap.exists;
}

async function getBuyerAdmin(projectId, serviceAccount) {
  const app = getAdminApp(projectId, serviceAccount, `buyer-import-${projectId}`);
  return getFirestore(app);
}

async function loadBuyers() {
  const { db } = getRegistryAdmin();
  const snap = await db.collection('product_licenses').get();
  const buyers = [];
  const buyerMap = loadBuyerProjectsMap();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const teamCode = normalizeTeamCode(d.teamCode);
    const projectId = String(d.tenantFirebaseConfig?.projectId || '').trim();
    if (!teamCode || !projectId) continue;
    const serviceAccount = buyerMap[projectId]?.serviceAccount
      || parseServiceAccountJson(process.env.BUYER_FIREBASE_SERVICE_ACCOUNT_JSON);
    buyers.push({
      licenseId: doc.id,
      teamCode,
      bookId: teamCode,
      projectId,
      serviceAccount,
      label: d.label || teamCode,
    });
  }
  return buyers;
}

async function importCollection({ buyerDb, unifiedDb, bookId, collectionName, args }) {
  const snap = await buyerDb.collection(collectionName).get();
  const targetCollection = rawBookCollection(bookId, collectionName);
  const writes = [];
  let skippedPostgres = 0;
  let skippedUnified = 0;
  let skippedDeleted = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.deleted && !args.includeDeleted) {
      skippedDeleted += 1;
      continue;
    }
    if (!args.includeDeleted) {
      const inPg = await postgresDocExists(bookId, collectionName, doc.id);
      if (inPg) {
        skippedPostgres += 1;
        continue;
      }
      const inUnified = await unifiedDocExists(unifiedDb, bookId, collectionName, doc.id);
      if (inUnified) {
        skippedUnified += 1;
        continue;
      }
    }
    writes.push({
      collection: targetCollection,
      id: doc.id,
      data: denormalizeFirestoreValue({ ...data, id: doc.id }),
    });
  }

  const written = await batchWriteDocs(unifiedDb, writes, { dryRun: args.dryRun });
  return {
    sourceCollection: collectionName,
    targetCollection,
    read: snap.size,
    written,
    skippedPostgres,
    skippedUnified,
    skippedDeleted,
  };
}

async function ensureBookRegistry(unifiedDb, buyer, dryRun) {
  const ref = unifiedDb.collection('books').doc(buyer.bookId);
  const payload = {
    id: buyer.bookId,
    name: buyer.label || buyer.bookId,
    teamCode: buyer.teamCode,
    licenseId: buyer.licenseId,
    sourceProjectId: buyer.projectId,
    createdAt: Date.now(),
  };
  if (dryRun) return payload;
  await ref.set(payload, { merge: true });
  return payload;
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db: unifiedDb } = getUnifiedAdmin();
  const buyers = await loadBuyers();
  const selected = args.book
    ? buyers.filter((b) => b.bookId === normalizeTeamCode(args.book))
    : buyers;

  const collections = args.all
    ? [...BOOK_SCOPED_COLLECTIONS, ...KNOWN_COLLECTIONS.filter((n) => !BOOK_SCOPED_COLLECTIONS.has(n) && n !== 'books' && n !== 'chatMessages')]
    : args.collections;

  const summaries = [];
  const errors = [];
  const skipMissingBuyerSa = ['1', 'true', 'yes'].includes(
    String(process.env.SKIP_BUYER_FIREBASE_IMPORT || '').trim().toLowerCase(),
  );

  console.log(`Buyer Firebase → unified: ${selected.length} buyer(s), dryRun=${args.dryRun}, skipMissingSa=${skipMissingBuyerSa}`);

  for (const buyer of selected) {
    if (!buyer.serviceAccount) {
      const message = `Missing service account for project ${buyer.projectId}`;
      if (skipMissingBuyerSa) {
        console.warn(`SKIP ${buyer.bookId}: ${message}`);
        continue;
      }
      errors.push({ buyer: buyer.bookId, error: message });
      continue;
    }
    try {
      const buyerDb = await getBuyerAdmin(buyer.projectId, buyer.serviceAccount);
      await ensureBookRegistry(unifiedDb, buyer, args.dryRun);
      for (const collectionName of collections) {
        if (collectionName.startsWith('book_')) continue;
        const summary = await importCollection({
          buyerDb,
          unifiedDb,
          bookId: buyer.bookId,
          collectionName,
          args,
        });
        summaries.push({ buyer: buyer.bookId, projectId: buyer.projectId, ...summary });
        console.log(`OK ${buyer.bookId}/${collectionName}: written=${summary.written} skippedPg=${summary.skippedPostgres}`);
      }
    } catch (error) {
      errors.push({ buyer: buyer.bookId, error: error?.message || String(error) });
      console.warn(`WARN ${buyer.bookId}: ${error?.message || error}`);
    }
  }

  console.log(JSON.stringify({ dryRun: args.dryRun, buyers: selected.length, summaries: summaries.length, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

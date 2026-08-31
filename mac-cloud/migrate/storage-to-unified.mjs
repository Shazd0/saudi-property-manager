#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import {
  DEFAULT_FIREBASE_CONFIG,
  getRegistryAdmin,
  getUnifiedAdmin,
  loadBuyerProjectsMap,
  normalizeTeamCode,
  parseMigrationArgs,
  getAdminApp,
  writeReport,
} from './lib/migration-utils.mjs';
import { getStorage } from 'firebase-admin/storage';

function printHelp() {
  console.log(`
Usage:
  node migrate/storage-to-unified.mjs --dry-run --all
  node migrate/storage-to-unified.mjs --book TEAMCODE

Copies buyer Firebase Storage objects into saudi-property-manager bucket:
  books/{teamCode}/<original-path>
`);
}

async function loadBuyers() {
  const { db } = getRegistryAdmin();
  const snap = await db.collection('product_licenses').get();
  const buyerMap = loadBuyerProjectsMap();
  const buyers = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const teamCode = normalizeTeamCode(d.teamCode);
    const projectId = String(d.tenantFirebaseConfig?.projectId || '').trim();
    if (!teamCode) continue;
    buyers.push({
      teamCode,
      bookId: teamCode,
      projectId,
      serviceAccount: buyerMap[projectId]?.serviceAccount,
      storageBucket: d.tenantFirebaseConfig?.storageBucket || `${projectId}.firebasestorage.app`,
    });
  }
  return buyers;
}

async function copyFile({ sourceBucket, targetBucket, sourcePath, targetPath, dryRun }) {
  if (dryRun) return { copied: true, targetPath };
  const sourceFile = sourceBucket.file(sourcePath);
  const [exists] = await sourceFile.exists();
  if (!exists) return { copied: false, reason: 'missing' };
  await sourceFile.copy(targetBucket.file(targetPath));
  return { copied: true, targetPath };
}

async function migrateBuyerStorage(buyer, targetBucket, args) {
  const summary = {
    bookId: buyer.bookId,
    projectId: buyer.projectId,
    copied: 0,
    skipped: 0,
    errors: [],
    urlMap: {},
  };

  let sourceBucket;
  if (buyer.serviceAccount && buyer.projectId) {
    const app = getAdminApp(buyer.projectId, buyer.serviceAccount, `storage-${buyer.projectId}`);
    sourceBucket = getStorage(app).bucket(buyer.storageBucket);
  } else {
    summary.errors.push('Missing buyer service account — skipped source bucket listing');
    return summary;
  }

  const [files] = await sourceBucket.getFiles();
  for (const file of files) {
    const sourcePath = file.name;
    const targetPath = `books/${buyer.bookId}/${sourcePath}`;
    try {
      const result = await copyFile({
        sourceBucket,
        targetBucket,
        sourcePath,
        targetPath,
        dryRun: args.dryRun,
      });
      if (result.copied) {
        summary.copied += 1;
        summary.urlMap[sourcePath] = `gs://${DEFAULT_FIREBASE_CONFIG.storageBucket}/${targetPath}`;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.errors.push({ sourcePath, error: error?.message || String(error) });
    }
  }
  return summary;
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { storage } = getUnifiedAdmin();
  const targetBucket = storage.bucket();
  const buyers = await loadBuyers();
  const selected = args.book
    ? buyers.filter((b) => b.bookId === normalizeTeamCode(args.book))
    : buyers;

  const summaries = [];
  const urlRewriteMap = {};

  for (const buyer of selected) {
    const summary = await migrateBuyerStorage(buyer, targetBucket, args);
    summaries.push(summary);
    Object.assign(urlRewriteMap, summary.urlMap);
    console.log(`OK ${buyer.bookId}: copied=${summary.copied} skipped=${summary.skipped} errors=${summary.errors.length}`);
  }

  const report = { dryRun: args.dryRun, summaries, urlRewriteMap };
  writeReport(args.output || 'storage-migration-report.json', report);
  console.log(JSON.stringify({ buyers: selected.length, totalCopied: summaries.reduce((n, s) => n + s.copied, 0) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

#!/usr/bin/env node
import 'dotenv/config';
import {
  REGISTRY_COLLECTIONS,
  denormalizeFirestoreValue,
  getRegistryAdmin,
  getUnifiedAdmin,
  normalizeTeamCode,
  parseMigrationArgs,
  batchWriteDocs,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/license-registry-to-unified.mjs --dry-run --all
  node migrate/license-registry-to-unified.mjs --all

Copies amlak-sales-main registry collections into saudi-property-manager.
Strips tenantFirebaseConfig and adds bookId = teamCode on product_licenses docs.
`);
}

function transformLicenseDoc(id, data) {
  const teamCode = normalizeTeamCode(data.teamCode);
  const next = { ...data };
  delete next.tenantFirebaseConfig;
  if (teamCode) next.bookId = teamCode;
  next.licenseId = id;
  next.migratedFromRegistry = true;
  return denormalizeFirestoreValue(next);
}

async function copyTopLevelCollection(sourceDb, targetDb, collectionName, transform, args) {
  const snap = await sourceDb.collection(collectionName).get();
  const writes = [];
  for (const doc of snap.docs) {
    writes.push({
      collection: collectionName,
      id: doc.id,
      data: transform ? transform(doc.id, doc.data() || {}) : denormalizeFirestoreValue(doc.data() || {}),
    });
  }
  const written = await batchWriteDocs(targetDb, writes, { dryRun: args.dryRun });
  return { collectionName, read: snap.size, written };
}

async function copyTenantPins(sourceDb, targetDb, args) {
  const licenses = await sourceDb.collection('product_licenses').get();
  let read = 0;
  let written = 0;
  for (const license of licenses.docs) {
    const pins = await sourceDb.collection('product_licenses').doc(license.id).collection('tenantPins').get();
    read += pins.size;
    const writes = pins.docs.map((doc) => ({
      collection: `product_licenses/${license.id}/tenantPins`,
      id: doc.id,
      data: denormalizeFirestoreValue(doc.data() || {}),
    }));
    written += await batchWriteDocs(targetDb, writes, { dryRun: args.dryRun });
  }
  return { collectionName: 'product_licenses/*/tenantPins', read, written };
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db: sourceDb } = getRegistryAdmin();
  const { db: targetDb } = getUnifiedAdmin();
  const summaries = [];

  for (const collectionName of REGISTRY_COLLECTIONS) {
    const transform = collectionName === 'product_licenses' ? transformLicenseDoc : null;
    const summary = await copyTopLevelCollection(sourceDb, targetDb, collectionName, transform, args);
    summaries.push(summary);
    console.log(`OK ${collectionName}: read=${summary.read} written=${summary.written}`);
  }

  const pinSummary = await copyTenantPins(sourceDb, targetDb, args);
  summaries.push(pinSummary);
  console.log(`OK ${pinSummary.collectionName}: read=${pinSummary.read} written=${pinSummary.written}`);

  console.log(JSON.stringify({ dryRun: args.dryRun, summaries }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

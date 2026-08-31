#!/usr/bin/env node
import 'dotenv/config';
import { KNOWN_COLLECTIONS } from '../lib/collections.mjs';
import {
  getUnifiedAdmin,
  parseMigrationArgs,
  batchWriteDocs,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/wipe-known-collections.mjs --dry-run --all
  node migrate/wipe-known-collections.mjs --all

Deletes documents in KNOWN_COLLECTIONS and book_* prefixed collections only.
`);
}

async function discoverCollections(db) {
  const listed = await db.listCollections();
  const names = new Set(KNOWN_COLLECTIONS);
  for (const col of listed) {
    if (/^book_[^_]+_.+$/.test(col.id)) names.add(col.id);
    if (KNOWN_COLLECTIONS.includes(col.id)) names.add(col.id);
  }
  return [...names].sort();
}

async function wipeCollection(db, collectionName, dryRun) {
  const snap = await db.collection(collectionName).select().get();
  const writes = snap.docs.map((doc) => ({ collection: collectionName, id: doc.id, delete: true }));
  const deleted = await batchWriteDocs(db, writes, { dryRun });
  return { collectionName, deleted };
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db } = getUnifiedAdmin();
  const collections = await discoverCollections(db);
  const results = [];
  let totalDeleted = 0;

  console.log(`Wipe known collections: ${collections.length} target(s), dryRun=${args.dryRun}`);

  for (const collectionName of collections) {
    const summary = await wipeCollection(db, collectionName, args.dryRun);
    results.push(summary);
    totalDeleted += summary.deleted;
    console.log(`OK ${collectionName}: deleted=${summary.deleted}`);
  }

  console.log(JSON.stringify({ dryRun: args.dryRun, totalDeleted, collections: results.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import { rawBookCollection } from '../lib/collections.mjs';
import {
  getUnifiedAdmin,
  parseMigrationArgs,
  stableHash,
  writeReport,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/validate-migration.mjs
  node migrate/validate-migration.mjs --dry-run --book TEAMCODE
  node migrate/validate-migration.mjs --spot-check 5

Compares Postgres vs unified Firebase counts and spot-checks document hashes.
Exits with code 1 on mismatch.
`);
}

function parseValidateArgs(argv) {
  const args = parseMigrationArgs(argv, { requireCollection: false });
  args.spotCheck = 3;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--spot-check') args.spotCheck = Number(argv[++i] || 3);
    else if (arg.startsWith('--spot-check=')) args.spotCheck = Number(arg.slice('--spot-check='.length) || 3);
  }
  return args;
}

async function postgresTargets(book) {
  const values = [];
  const where = ['deleted = false'];
  if (book) {
    values.push(book);
    where.push('book_id = $1');
  }
  const result = await pool.query(
    `
      select book_id, collection_name, count(*)::int as doc_count
      from documents
      where ${where.join(' and ')}
      group by book_id, collection_name
      order by book_id, collection_name
    `,
    values,
  );
  return result.rows;
}

async function firebaseCount(db, bookId, collectionName) {
  const target = rawBookCollection(bookId, collectionName);
  const snap = await db.collection(target).count().get();
  return snap.data().count || 0;
}

async function samplePostgresDocs(bookId, collectionName, limit) {
  const result = await pool.query(
    `
      select doc_id, data
      from documents
      where book_id = $1 and collection_name = $2 and deleted = false
      order by random()
      limit $3
    `,
    [bookId, collectionName, limit],
  );
  return result.rows;
}

async function main() {
  const args = parseValidateArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db } = getUnifiedAdmin();
  const targets = await postgresTargets(args.book || '');
  const mismatches = [];
  const hashMismatches = [];
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    checked: 0,
    mismatches: [],
    hashMismatches: [],
  };

  for (const target of targets) {
    const pgCount = target.doc_count;
    const fbCount = await firebaseCount(db, target.book_id, target.collection_name);
    report.checked += 1;
    if (pgCount !== fbCount) {
      const item = {
        bookId: target.book_id,
        collectionName: target.collection_name,
        postgresCount: pgCount,
        firebaseCount: fbCount,
      };
      mismatches.push(item);
      report.mismatches.push(item);
      console.warn(`MISMATCH ${target.book_id}/${target.collection_name}: pg=${pgCount} fb=${fbCount}`);
    } else {
      console.log(`OK ${target.book_id}/${target.collection_name}: count=${pgCount}`);
    }

    if (args.spotCheck > 0 && pgCount > 0) {
      const samples = await samplePostgresDocs(target.book_id, target.collection_name, args.spotCheck);
      const collectionPath = rawBookCollection(target.book_id, target.collection_name);
      for (const sample of samples) {
        const snap = await db.collection(collectionPath).doc(sample.doc_id).get();
        if (!snap.exists) {
          hashMismatches.push({ bookId: target.book_id, collectionName: target.collection_name, docId: sample.doc_id, reason: 'missing-in-firebase' });
          continue;
        }
        const pgHash = stableHash({ ...sample.data, id: sample.doc_id });
        const fbHash = stableHash({ ...snap.data(), id: snap.id });
        if (pgHash !== fbHash) {
          hashMismatches.push({
            bookId: target.book_id,
            collectionName: target.collection_name,
            docId: sample.doc_id,
            reason: 'hash-mismatch',
            pgHash,
            fbHash,
          });
        }
      }
    }
  }

  report.hashMismatches = hashMismatches;
  writeReport(args.output || 'validation-report.json', report);

  console.log(JSON.stringify({
    checked: report.checked,
    mismatches: mismatches.length,
    hashMismatches: hashMismatches.length,
  }, null, 2));

  if (mismatches.length || hashMismatches.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

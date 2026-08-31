#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool, createMigrationRun, finishMigrationRun } from '../lib/db.mjs';
import {
  BOOK_SCOPED_COLLECTIONS,
  KNOWN_COLLECTIONS,
  rawBookCollection,
} from '../lib/collections.mjs';
import {
  denormalizeFirestoreValue,
  getUnifiedAdmin,
  parseMigrationArgs,
  batchWriteDocs,
  resolveTargetBookId,
} from './lib/migration-utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node migrate/postgres-to-firebase.mjs --all
  node migrate/postgres-to-firebase.mjs --dry-run --all
  node migrate/postgres-to-firebase.mjs --book TEAMCODE --collection transactions
`);
}

async function listPostgresTargets(args) {
  const values = [];
  const where = ['deleted = false'];
  if (args.book) {
    values.push(args.book);
    where.push(`book_id = $${values.length}`);
  }
  if (args.collections.length) {
    values.push(args.collections);
    where.push(`collection_name = any($${values.length}::text[])`);
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

async function readPostgresDocs(bookId, collectionName, includeDeleted) {
  const result = await pool.query(
    `
      select doc_id, data, deleted
      from documents
      where book_id = $1 and collection_name = $2
        and ($3::boolean = true or deleted = false)
      order by doc_id
    `,
    [bookId || 'default', collectionName, includeDeleted],
  );
  return result.rows.map((row) => ({
    id: row.doc_id,
    data: row.data || {},
    deleted: Boolean(row.deleted),
  }));
}

async function migrateChatMessagesFromPostgres(args, db) {
  const messages = await readPostgresDocs('default', 'chatMessages', args.includeDeleted);
  let written = 0;
  let skippedDeleted = 0;

  for (const message of messages) {
    if (message.deleted && !args.includeDeleted) {
      skippedDeleted += 1;
      continue;
    }
    const roomId = message.data?.roomId || String(message.id).split('_')[0];
    const messageId = message.data?.id || String(message.id).split('_').slice(1).join('_') || message.id;
    const payload = denormalizeFirestoreValue({ ...message.data, id: messageId, roomId });
    if (!args.dryRun) {
      await db.collection('chatRooms').doc(roomId).collection('messages').doc(messageId).set(payload);
    }
    written += 1;
  }

  return { read: messages.length, written, skippedDeleted };
}

async function migrateTarget({ bookId, collectionName, args, db }) {
  const docs = await readPostgresDocs(bookId, collectionName, args.includeDeleted);
  const targetBookId = resolveTargetBookId(bookId);
  const targetCollection = rawBookCollection(targetBookId, collectionName);
  const writes = [];
  let skippedDeleted = 0;

  for (const doc of docs) {
    if (doc.deleted && !args.includeDeleted) {
      skippedDeleted += 1;
      continue;
    }
    const payload = denormalizeFirestoreValue({ ...doc.data, id: doc.id });
    writes.push({ collection: targetCollection, id: doc.id, data: payload });
  }

  const written = await batchWriteDocs(db, writes, { dryRun: args.dryRun });
  return {
    bookId,
    targetBookId,
    collectionName,
    targetCollection,
    read: docs.length,
    written,
    skippedDeleted,
  };
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { db } = getUnifiedAdmin();
  const collections = args.all
    ? KNOWN_COLLECTIONS.filter((name) => name !== 'chatMessages')
    : [...new Set(args.collections)];

  const targets = await listPostgresTargets({
    ...args,
    collections: collections.filter((name) => !name.startsWith('book_')),
  });

  const runId = args.dryRun ? null : await createMigrationRun({
    mode: 'postgres-to-firebase',
    dryRun: args.dryRun,
    collections,
    book: args.book || null,
    includeDeleted: args.includeDeleted,
  });

  const summaries = [];
  const errors = [];
  let totalRead = 0;
  let totalWritten = 0;

  console.log(`Postgres → Firebase: ${targets.length} target(s), dryRun=${args.dryRun}`);

  for (const target of targets) {
    if (target.collection_name === 'chatMessages') continue;
    try {
      const summary = await migrateTarget({
        bookId: target.book_id,
        collectionName: target.collection_name,
        args,
        db,
      });
      summaries.push(summary);
      totalRead += summary.read;
      totalWritten += summary.written;
      console.log(`OK ${summary.targetCollection}: read=${summary.read} written=${summary.written}`);
    } catch (error) {
      const message = error?.message || String(error);
      errors.push({ target, error: message });
      console.warn(`WARN ${target.book_id}/${target.collection_name}: ${message}`);
    }
  }

  if (collections.includes('chatRooms') || collections.includes('chatMessages')) {
    try {
      const chatSummary = await migrateChatMessagesFromPostgres(args, db);
      summaries.push({ collectionName: 'chatRooms/*/messages', ...chatSummary });
      totalRead += chatSummary.read;
      totalWritten += chatSummary.written;
    } catch (error) {
      errors.push({ collection: 'chatRooms/*/messages', error: error?.message || String(error) });
    }
  }

  const status = errors.length ? 'completed_with_errors' : 'completed';
  if (runId) {
    await finishMigrationRun(runId, { status, collections: summaries, totalRead, totalWritten, errors });
  }

  console.log(JSON.stringify({ status, dryRun: args.dryRun, totalRead, totalWritten, errors }, null, 2));
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

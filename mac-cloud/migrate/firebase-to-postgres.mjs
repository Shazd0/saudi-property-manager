#!/usr/bin/env node
import 'dotenv/config';
import { initializeApp, getApps } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import {
  BOOK_SCOPED_COLLECTIONS,
  KNOWN_COLLECTIONS,
  splitBookCollection,
  rawBookCollection,
} from '../lib/collections.mjs';
import {
  closePool,
  createMigrationRun,
  finishMigrationRun,
  pool,
  upsertDocument,
} from '../lib/db.mjs';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs',
  authDomain: 'saudi-property-manager.firebaseapp.com',
  projectId: 'saudi-property-manager',
  storageBucket: 'saudi-property-manager.firebasestorage.app',
  messagingSenderId: '854165833434',
  appId: '1:854165833434:web:bc550b5c79266bd1fb07e3',
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    all: false,
    includeDeleted: false,
    collections: [],
    book: '',
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
    else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  if (!args.all && args.collections.length === 0) args.all = true;
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node migrate/firebase-to-postgres.mjs --all
  node migrate/firebase-to-postgres.mjs --dry-run --all
  node migrate/firebase-to-postgres.mjs --collection transactions
  node migrate/firebase-to-postgres.mjs --book default --collection transactions

Options:
  --dry-run          Read and count Firebase data without writing to Postgres
  --all              Transfer all configured Amlak collections
  --collection NAME  Transfer one collection; repeatable
  --book BOOK_ID     Restrict book-scoped collections to one book
  --include-deleted  Preserve soft-deleted docs instead of skipping them
`);
}

function firebaseConfigFromEnv() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: process.env.FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  };
}

function normalizeFirestoreValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (typeof value !== 'object') return value;

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000)).toISOString();
  }

  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested !== undefined) out[key] = normalizeFirestoreValue(nested);
  }
  return out;
}

function parseExtraCollections() {
  return String(process.env.FIREBASE_EXTRA_COLLECTIONS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readCollectionSafe(db, collectionName) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return {
      ok: true,
      docs: snapshot.docs.map((doc) => ({
        id: doc.id,
        data: normalizeFirestoreValue(doc.data()),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      docs: [],
      error: error?.message || String(error),
    };
  }
}

async function discoverBookIds(db) {
  const books = await readCollectionSafe(db, 'books');
  const ids = new Set(['default']);

  if (books.ok) {
    for (const doc of books.docs) {
      if (doc.id) ids.add(doc.id);
      if (doc.data?.id) ids.add(String(doc.data.id));
    }
  }

  const configured = String(process.env.AMLAK_BOOK_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  configured.forEach((id) => ids.add(id));

  return [...ids];
}

async function buildCollectionPlan(db, args) {
  const baseCollections = args.all
    ? [...new Set([...KNOWN_COLLECTIONS, ...parseExtraCollections()])]
    : [...new Set(args.collections)];

  const bookIds = await discoverBookIds(db);
  const scopedBookIds = args.book ? bookIds.filter((id) => id === args.book) : bookIds;
  const targets = new Set();

  for (const name of baseCollections) {
    if (!name) continue;
    if (name.startsWith('book_')) {
      targets.add(name);
      continue;
    }
    targets.add(name);

    if (BOOK_SCOPED_COLLECTIONS.has(name)) {
      for (const bookId of scopedBookIds) {
        if (bookId && bookId !== 'default') targets.add(rawBookCollection(bookId, name));
      }
    }
  }

  return [...targets].sort();
}

async function transferCollection(db, sourceCollection, args) {
  const { bookId, collectionName } = splitBookCollection(sourceCollection);
  const result = await readCollectionSafe(db, sourceCollection);
  const summary = {
    sourceCollection,
    bookId,
    collectionName,
    read: 0,
    written: 0,
    skippedDeleted: 0,
    error: null,
  };

  if (!result.ok) {
    summary.error = result.error;
    return summary;
  }

  summary.read = result.docs.length;
  if (args.dryRun) return summary;

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const doc of result.docs) {
      const deleted = Boolean(doc.data?.deleted);
      if (deleted && !args.includeDeleted) {
        summary.skippedDeleted += 1;
        continue;
      }
      await upsertDocument(client, {
        bookId,
        collectionName,
        docId: doc.id,
        data: { ...doc.data, id: doc.id },
        deleted,
        sourceCollection,
        sourcePath: `${sourceCollection}/${doc.id}`,
      });
      summary.written += 1;
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    summary.error = error?.message || String(error);
  } finally {
    client.release();
  }

  return summary;
}

async function transferChatMessages(db, args) {
  const rooms = await readCollectionSafe(db, 'chatRooms');
  const summary = {
    sourceCollection: 'chatRooms/*/messages',
    bookId: 'default',
    collectionName: 'chatMessages',
    read: 0,
    written: 0,
    skippedDeleted: 0,
    error: null,
  };

  if (!rooms.ok) {
    summary.error = rooms.error;
    return summary;
  }
  if (args.dryRun) {
    for (const room of rooms.docs) {
      const messages = await readCollectionSafe(db, `chatRooms/${room.id}/messages`);
      if (messages.ok) summary.read += messages.docs.length;
    }
    return summary;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const room of rooms.docs) {
      const messages = await readCollectionSafe(db, `chatRooms/${room.id}/messages`);
      if (!messages.ok) continue;
      summary.read += messages.docs.length;
      for (const message of messages.docs) {
        const deleted = Boolean(message.data?.deleted);
        if (deleted && !args.includeDeleted) {
          summary.skippedDeleted += 1;
          continue;
        }
        await upsertDocument(client, {
          bookId: 'default',
          collectionName: 'chatMessages',
          docId: `${room.id}_${message.id}`,
          data: { ...message.data, id: message.id, roomId: room.id },
          deleted,
          sourceCollection: 'chatRooms/*/messages',
          sourcePath: `chatRooms/${room.id}/messages/${message.id}`,
        });
        summary.written += 1;
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    summary.error = error?.message || String(error);
  } finally {
    client.release();
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfigFromEnv());
  let db;
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app);
  }

  const collectionPlan = await buildCollectionPlan(db, args);
  const runId = args.dryRun ? null : await createMigrationRun({
    mode: args.all ? 'all' : 'partial',
    dryRun: args.dryRun,
    collections: args.collections,
    book: args.book || null,
    includeDeleted: args.includeDeleted,
  });

  const collections = {};
  const errors = [];
  let totalRead = 0;
  let totalWritten = 0;

  console.log(`Starting Firebase transfer: ${collectionPlan.length} collection target(s), dryRun=${args.dryRun}`);

  for (const sourceCollection of collectionPlan) {
    const summary = await transferCollection(db, sourceCollection, args);
    collections[sourceCollection] = summary;
    totalRead += summary.read;
    totalWritten += summary.written;

    if (summary.error) {
      errors.push({ collection: sourceCollection, error: summary.error });
      console.warn(`WARN ${sourceCollection}: ${summary.error}`);
    } else {
      console.log(`OK ${sourceCollection}: read=${summary.read} written=${summary.written} skippedDeleted=${summary.skippedDeleted}`);
    }
  }

  if (collectionPlan.includes('chatRooms')) {
    const summary = await transferChatMessages(db, args);
    collections[summary.sourceCollection] = summary;
    totalRead += summary.read;
    totalWritten += summary.written;
    if (summary.error) {
      errors.push({ collection: summary.sourceCollection, error: summary.error });
      console.warn(`WARN ${summary.sourceCollection}: ${summary.error}`);
    } else {
      console.log(`OK ${summary.sourceCollection}: read=${summary.read} written=${summary.written} skippedDeleted=${summary.skippedDeleted}`);
    }
  }

  const status = errors.length ? 'completed_with_errors' : 'completed';
  if (runId) {
    await finishMigrationRun(runId, { status, collections, totalRead, totalWritten, errors });
  }

  console.log(JSON.stringify({ status, dryRun: args.dryRun, totalRead, totalWritten, errors }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });

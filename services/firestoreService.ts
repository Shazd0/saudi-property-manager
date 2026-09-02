import { app, storage } from "../firebase";
import { getFirestore, collection as _colRef, getDocs, doc as _docRef, setDoc, addDoc, deleteDoc, query, orderBy, where, getDoc, onSnapshot, writeBatch, type Firestore } from "firebase/firestore";

/** Live Firestore instance (safe across Vite HMR). */
function assertDb(): Firestore {
  return getFirestore(app);
}
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getNextVatInvoiceNumber } from "../utils/vatInvoiceNumber";
import { compactAmlakWorkbook } from "../utils/amlakSheetPosting";
import { syncTransactionIntoAmlakWorkbooks } from "../utils/amlakWorkbookTransactionSync";
import { bankAccountKey, bankReferencePatch, countRecordsByBank, type BankReferenceField } from "../utils/bankAccounts";
import { getCached, setCached, invalidateFirestoreCache, invalidateCollectionCache } from "./firestoreCache";
import { macDeleteDocument, macGetDocument, macListCollection, macSaveDocument } from "./macApiClient";
import { setPendingApprovalKeysFromList } from "./approvalPendingStore";
import { getMacApiUrlEnv, isBrowserLocalHost, isPrivateOrLocalBackendUrl, resolveMacRestApiBase } from "../utils/macApiBase";

/** Hash a password with SHA-256 using the Web Crypto API (browser-compatible). */
export const hashPassword = async (plain: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify a plaintext password against a stored value.
 * Supports both legacy plaintext (migrated on first login) and SHA-256 hashed values.
 */
export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  // If stored value looks like a SHA-256 hex digest (64 hex chars), compare hashes
  if (/^[0-9a-f]{64}$/.test(stored)) {
    return (await hashPassword(plain)) === stored;
  }
  // Legacy plaintext — compare directly (will be upgraded on next save)
  return plain === stored;
};

/** Same rule as Owner login: owner / investor portal accounts must not use staff mockLogin. */
export function isOwnerPortalAccount(user: any): boolean {
  if (!user) return false;
  const r = String(user.role ?? '').toUpperCase();
  return !!(user.isOwner || r === 'OWNER');
}

/** Thrown from mockLogin when the password is correct but the account is owner-portal only. */
export const OWNER_PORTAL_ONLY_LOGIN = 'OWNER_PORTAL_ONLY_LOGIN';

/** Firestore doc id must win: legacy rows sometimes stored a different `id` in the payload, which caused duplicate keys and phantom "twins" in History. */
const toArray = (snap: any) =>
  snap.docs.map((d: any) => {
    const data = (d.data() as any) || {};
    return { ...data, id: d.id };
  });

const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj !== 'object') return obj;
  const out: any = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) {
      out[k] = sanitize(v as any);
    }
  });
  return out;
};

const runInBackground = (task: Promise<any> | (() => Promise<any>), label: string) => {
  const promise = typeof task === 'function' ? task() : task;
  promise.catch((e) => console.warn(`${label} failed`, e));
};

// ---- Book (Partition) Support ----
// Each book is a completely separate dataset (separate Firestore collections).
// Default book uses the original collection names for full backward-compatibility.
let currentBookId = 'default';

const BOOK_SCOPED_COLLECTIONS = new Set([
  'transactions', 'buildings', 'contracts', 'customers', 'vendors',
  'tasks', 'stocks', 'stock', 'stock_entries', 'transfers',
  'service_agreements', 'approvals', 'users',
  'notifications', 'images', 'registry', 'stockItems', 'stockTransfers',
  'sadad_bills', 'ejar_contracts', 'utility_readings', 'security_deposits',
  'whatsapp_messages', 'bank_statements', 'reconciliation_records',
  'nafath_verifications', 'municipality_licenses', 'civil_defense_records', 'absher_records',
  'amlakSheets',
]);

const ALL_AMLAK_MAC_COLLECTIONS = new Set([
  'transactions',
  'buildings',
  'contracts',
  'customers',
  'vendors',
  'users',
  'banks',
  'meta',
  'books',
  'tasks',
  'approvals',
  'transfers',
  'audit',
  'amlakSheets',
  'stocks',
  'stock',
  'stock_entries',
  'stockItems',
  'stockTransfers',
  'registry',
  'service_agreements',
  'borrowings',
  'sadad_bills',
  'ejar_contracts',
  'utility_readings',
  'security_deposits',
  'municipality_licenses',
  'civil_defense_records',
  'absher_records',
  'whatsapp_messages',
  'bank_statements',
  'reconciliation_records',
  'nafath_verifications',
  'notifications',
  'chatRooms',
  'chatMessages',
  'chatPresence',
  'chatStatuses',
  'userTokens',
  'voiceCallSessions',
  'callSignals',
  'callHistory',
  'callPresence',
  'images',
  'backups',
]);

const FIRESTORE_STORAGE_ESTIMATE_COLLECTIONS = Array.from(new Set([
  ...Array.from(BOOK_SCOPED_COLLECTIONS),
  ...Array.from(ALL_AMLAK_MAC_COLLECTIONS),
]));

const useMacBackend = () => false;
const useMacCollection = (_name: string) => false;

if (typeof window !== 'undefined') {
  console.info('[Amlak] Data backend: Firebase Firestore (saudi-property-manager)');
}

const macSave = async (name: string, data: any, bookId = currentBookId, merge = false) => {
  return macSaveDocument(name, sanitize(data), { bookId: bookId || 'default', merge });
};

const macDelete = async (name: string, id: string, bookId = currentBookId) => {
  return macDeleteDocument(name, id, { bookId: bookId || 'default' });
};

const macSaveId = async (name: string, data: any, bookId = currentBookId) => {
  const saved = await macSave(name, data, bookId, !!data?.id);
  return (saved as any)?.id || data?.id;
};

const getCol = (name: string): string => {
  if (currentBookId === 'default' || !BOOK_SCOPED_COLLECTIONS.has(name)) return name;
  return `book_${currentBookId}_${name}`;
};

/** Book-aware collection path — do not shadow Firebase `collection`. */
const fsCollection = (name: string, ...segments: string[]) => {
  const fs = assertDb();
  const path = getCol(name);
  return segments.length > 0
    ? (_colRef as any)(fs, path, ...segments)
    : (_colRef as any)(fs, path);
};
const fsDoc = (name: string, ...segments: string[]) => {
  const fs = assertDb();
  const path = getCol(name);
  return (_docRef as any)(fs, path, ...segments);
};

export const setCurrentBook = (id: string) => {
  const next = id || 'default';
  if (next !== currentBookId) invalidateFirestoreCache('col:');
  currentBookId = next;
};
export const getCurrentBookId = () => currentBookId;

// ---- Cross-book helpers ----
// Build an EXPLICIT path for a specific book without relying on the active book.
// This is essential for inter-book transfers, which must write each leg of a
// linked transaction to the collection that belongs to the SOURCE or DESTINATION
// building's own book, not the active book.
const rawBookPath = (bookId: string, name: string): string => {
  if (!bookId || bookId === 'default' || !BOOK_SCOPED_COLLECTIONS.has(name)) return name;
  return `book_${bookId}_${name}`;
};
const bookCol = (bookId: string, name: string): any => _colRef(assertDb(), rawBookPath(bookId, name));
const bookDoc = (bookId: string, name: string, id?: string): any =>
  id ? _docRef(assertDb(), rawBookPath(bookId, name), id) : _docRef(bookCol(bookId, name) as any);

/** Write a transaction document to a specific book partition (Treasury / cross-book fixes). */
export const saveTransactionInBook = async (bookId: string, t: any) => {
  const data = sanitize(t);
  if (useMacCollection('transactions')) {
    return macSave('transactions', data, bookId || 'default');
  }
  const path = rawBookPath(bookId || 'default', 'transactions');
  if (!t?.id) {
    return addDoc(_colRef(assertDb(), path), data);
  }
  return setDoc(_docRef(assertDb(), path, t.id), data);
};

/**
 * TransferManager composes cross-book building ids as `${bookId}:${rawId}` for
 * buildings that live in a non-active book. For active-book buildings the id is
 * the raw building id. This helper splits either form into { bookId, rawId }.
 */
export const parseCompositeBuildingId = (
  compositeId: string,
  fallbackBookId: string
): { bookId: string; rawId: string } => {
  if (!compositeId) return { bookId: fallbackBookId, rawId: compositeId };
  if (typeof compositeId === 'string' && compositeId.includes(':')) {
    const idx = compositeId.indexOf(':');
    const bk = compositeId.slice(0, idx);
    const raw = compositeId.slice(idx + 1);
    return { bookId: bk || fallbackBookId, rawId: raw || compositeId };
  }
  return { bookId: fallbackBookId, rawId: compositeId };
};

/** True if two building ids refer to the same property (raw vs `bookId:rawId` vs active book). */
export const ownerStakeBuildingIdsMatch = (a: string, b: string, activeBookId: string): boolean => {
  const pa = parseCompositeBuildingId(a, activeBookId);
  const pb = parseCompositeBuildingId(b, activeBookId);
  return pa.bookId === pb.bookId && pa.rawId === pb.rawId;
};

// ---- Scoped access: limit staff to their assigned buildings (supports multiple)
let scopedBuildingIds: string[] = [];
let scopedRole: string | null = null;
const isScopedRole = (role?: string | null) => role && role !== 'ADMIN' && role !== 'MANAGER';
const matchesBuilding = (item: any, bid: string) => {
  if (!item || typeof item !== 'object') return false;
  return item.buildingId === bid || item.building === bid || item.building_id === bid || item.id === bid;
};
const matchesAnyBuilding = (item: any, bids: string[]) => {
  if (!bids || bids.length === 0) return false;
  return bids.some(bid => matchesBuilding(item, bid));
};
const filterByScope = (name: string, data: any[]) => {
  if (!isScopedRole(scopedRole)) return data;
  if (scopedBuildingIds.length === 0) {
    const scopedCollections = ['buildings', 'contracts', 'transactions', 'stocks', 'stockItems', 'stockTransfers', 'units', 'tasks'];
    return scopedCollections.includes(name) ? [] : data;
  }
  // Buildings: only the assigned building ids
  if (name === 'buildings') return data.filter(d => matchesAnyBuilding(d, scopedBuildingIds));
  // Common building-bound collections
  const scopedCollections = ['contracts', 'transactions', 'stocks', 'stockItems', 'stockTransfers', 'units', 'tasks'];
  if (scopedCollections.includes(name)) return data.filter(d => matchesAnyBuilding(d, scopedBuildingIds));
  return data;
};

export const setUserScope = (user: { role?: string; buildingId?: string; buildingIds?: string[] } | null) => {
  // Support both single buildingId and multiple buildingIds
  const ids = user?.buildingIds && user.buildingIds.length > 0 ? user.buildingIds : (user?.buildingId ? [user.buildingId] : []);
  scopedBuildingIds = ids;
  scopedRole = user?.role || null;
};

type GetCollectionOptions = { orderField?: string; includeDeleted?: boolean };

export const getCollection = async (name: string, orderFieldOrOpts?: string | GetCollectionOptions, opts?: GetCollectionOptions) => {
  const orderField = typeof orderFieldOrOpts === 'string' ? orderFieldOrOpts : orderFieldOrOpts?.orderField || opts?.orderField;
  const includeDeleted = typeof orderFieldOrOpts === 'string'
    ? (opts?.includeDeleted ?? false)
    : (orderFieldOrOpts?.includeDeleted ?? false);

  const cacheKey = `col:${currentBookId}:${name}:${orderField || ''}:${includeDeleted}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  if (useMacCollection(name)) {
    const data = await macListCollection(name, {
      bookId: currentBookId,
      orderField,
      includeDeleted,
    });
    const scoped = filterByScope(name, data);
    const out = includeDeleted ? scoped : scoped.filter((d: any) => !(d as any).deleted);
    setCached(cacheKey, out);
    return out;
  }

  const colRef = fsCollection(name);
  const q = orderField ? query(colRef, orderBy(orderField, "desc")) : colRef;
  const snap = await getDocs(q as any);
  const data = toArray(snap);
  const scoped = filterByScope(name, data);
  const out = includeDeleted ? scoped : scoped.filter((d: any) => !(d as any).deleted);
  setCached(cacheKey, out);
  return out;
};

export const getVendors = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection("vendors", { includeDeleted: !!opts?.includeDeleted });
};
export const saveVendor = async (v: any) => {
  const data = sanitize(v);
  if (useMacCollection('vendors')) return macSave('vendors', data);
  if (!v.id) return addDoc(fsCollection( "vendors"), data);
  return setDoc(fsDoc( "vendors", v.id), data);
};
export const deleteVendor = async (id: string) => {
  if (useMacCollection('vendors')) return macDelete('vendors', id);
  return deleteDoc(fsDoc( "vendors", id));
};

export const getTasks = async (uid?: string, opts?: { includeDeleted?: boolean }) => {
  if (useMacCollection('tasks')) {
    const data = await macListCollection('tasks', {
      bookId: currentBookId,
      includeDeleted: !!opts?.includeDeleted,
      filters: uid ? { userId: uid } : undefined,
    });
    if (opts?.includeDeleted) return data;
    return data.filter((t: any) => !(t as any).deleted);
  }
  if (uid) {
    const q = query(fsCollection( "tasks"), where("userId", "==", uid));
    const snap = await getDocs(q as any);
    const data = toArray(snap);
    if (opts?.includeDeleted) return data;
    return data.filter((t: any) => !(t as any).deleted);
  }
  return getCollection("tasks", { includeDeleted: !!opts?.includeDeleted });
};
export const saveTask = async (t: any) => {
  const data = sanitize(t);
  if (useMacCollection('tasks')) return macSave('tasks', data);
  if (!t.id) return addDoc(fsCollection( "tasks"), data);
  return setDoc(fsDoc( "tasks", t.id), data);
};
export const deleteTask = async (id: string) => {
  if (useMacCollection('tasks')) return macDelete('tasks', id);
  return deleteDoc(fsDoc( "tasks", id));
};

export const getSettings = async () => {
  if (useMacCollection('meta')) {
    const arr = await macListCollection('meta', { bookId: currentBookId, includeDeleted: false });
    return arr.find((x: any) => x.id === "settings") || arr[0] || null;
  }
  const snap = await getDocs(fsCollection( "meta"));
  const arr = toArray(snap);
  const found = arr.find((x: any) => x.id === "settings") || arr[0];
  return found || null;
};
export const saveSettings = async (s: any) => {
  if (useMacCollection('meta')) return macSave('meta', { ...s, id: 'settings' });
  return setDoc(fsDoc( "meta", "settings"), s);
};

// Custom Expense Categories (shared across all users)
export const getCustomExpenseCategories = async (): Promise<string[]> => {
  if (useMacCollection('meta')) {
    const arr = await macListCollection('meta', { bookId: currentBookId, includeDeleted: true });
    const data = arr.find((x: any) => x.id === "expenseCategories") as any;
    return Array.isArray(data?.categories) ? data.categories : [];
  }
  try {
    const snap = await getDoc(fsDoc( "meta", "expenseCategories"));
    if (snap.exists()) {
      const data = snap.data() as Record<string, any>;
      return Array.isArray(data.categories) ? data.categories : [];
    }
  } catch (_) {}
  return [];
};
export const saveCustomExpenseCategories = async (categories: string[]) => {
  if (useMacCollection('meta')) {
    await macSave('meta', { id: 'expenseCategories', categories, updatedAt: Date.now() });
    return;
  }
  await setDoc(fsDoc( "meta", "expenseCategories"), { categories, updatedAt: Date.now() });
};

export const getCustomIncomeCategories = async (): Promise<string[]> => {
  if (useMacCollection('meta')) {
    const arr = await macListCollection('meta', { bookId: currentBookId, includeDeleted: true });
    const data = arr.find((x: any) => x.id === "incomeCategories") as any;
    return Array.isArray(data?.categories) ? data.categories : [];
  }
  try {
    const snap = await getDoc(fsDoc( "meta", "incomeCategories"));
    if (snap.exists()) {
      const data = snap.data() as Record<string, any>;
      return Array.isArray(data.categories) ? data.categories : [];
    }
  } catch (_) {}
  return [];
};
export const saveCustomIncomeCategories = async (categories: string[]) => {
  if (useMacCollection('meta')) {
    await macSave('meta', { id: 'incomeCategories', categories, updatedAt: Date.now() });
    return;
  }
  await setDoc(fsDoc( "meta", "incomeCategories"), { categories, updatedAt: Date.now() });
};

export const getTransactions = async (opts?: { userId?: string; role?: string; buildingId?: string; buildingIds?: string[]; includeDeleted?: boolean }) => {
  const all = await getCollection("transactions", { orderField: "date", includeDeleted: !!opts?.includeDeleted });
  const effectiveRole = opts?.role || scopedRole || '';
  // Support multiple buildingIds
  const effectiveBuildings = opts?.buildingIds && opts.buildingIds.length > 0 ? opts.buildingIds : (opts?.buildingId ? [opts.buildingId] : scopedBuildingIds);
  // Admins and Managers see everything
  if (effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER') return all;
  // For other staff, restrict to their assigned buildings only
  if (effectiveBuildings.length > 0) return all.filter((t: any) => matchesAnyBuilding(t, effectiveBuildings));
  return [];
};
export const listenTransactions = (callback: (transactions: any[]) => void) => {
  if (useMacCollection('transactions')) {
    let cancelled = false;
    const load = async () => {
      const rows = await getTransactions().catch(() => []);
      if (!cancelled) callback(rows || []);
    };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }
  try {
    const q = query(fsCollection('transactions'), orderBy('date', 'desc'));
    return onSnapshot(q as any, (snap) => {
      const all = toArray(snap || { docs: [] });
      const scoped = filterByScope('transactions', all);
      callback(scoped.filter((d: any) => !d.deleted));
    }, (err) => {
      console.error('listenTransactions error', err);
    });
  } catch (e) {
    console.error('listenTransactions setup error', e);
    return () => {};
  }
};

type SaveTransactionOptions = {
  skipAmlakSheetSync?: boolean;
};

export const saveTransaction = async (t: any, options?: SaveTransactionOptions) => {
  const data = sanitize(t);
  invalidateCollectionCache('transactions', currentBookId);
  let result: any;
  if (useMacCollection('transactions')) result = await macSave('transactions', data);
  else if (!t.id) result = await addDoc(fsCollection( "transactions"), data);
  else result = await setDoc(fsDoc( "transactions", t.id), data);

  if (!options?.skipAmlakSheetSync) {
    runInBackground(() => syncSavedTransactionToAmlakSheets(data), 'Amlak Sheets transaction sync');
  }
  return result;
};

export const getAmlakWorkbooks = async () => {
  return getCollection("amlakSheets", { orderField: "updatedAt" });
};

export const listenAmlakWorkbooks = (callback: (workbooks: any[]) => void) => {
  if (useMacCollection('amlakSheets')) {
    let cancelled = false;
    const load = async () => {
      const rows = await getAmlakWorkbooks().catch(() => []);
      if (!cancelled) callback(rows || []);
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }
  try {
    const q = query(fsCollection("amlakSheets"), orderBy("updatedAt"));
    return onSnapshot(q as any, (snap) => {
      callback(toArray(snap || { docs: [] }));
    }, (err) => {
      console.error('listenAmlakWorkbooks error', err);
      callback([]);
    });
  } catch (e) {
    console.error('listenAmlakWorkbooks setup error', e);
    return () => {};
  }
};

export const saveAmlakWorkbook = async (workbook: any) => {
  const compacted = compactAmlakWorkbook(workbook);
  const data = sanitize({
    ...compacted,
    updatedAt: Date.now(),
  });
  invalidateCollectionCache('amlakSheets', currentBookId);
  if (!workbook.id) return addDoc(fsCollection("amlakSheets"), data);
  return setDoc(fsDoc("amlakSheets", workbook.id), data);
};

const syncSavedTransactionToAmlakSheets = async (tx: any) => {
  if (!tx?.id) return;
  const [workbooks, buildings] = await Promise.all([
    getAmlakWorkbooks().catch(() => []),
    getBuildingsAllBooks({ includeDeleted: true }).catch(() => getBuildings({ includeDeleted: true })).catch(() => []),
  ]);
  const result = syncTransactionIntoAmlakWorkbooks(workbooks as any, tx, buildings as any);
  if (!result.changed) return;
  const changedIds = new Set(result.syncedWorkbookIds);
  await Promise.all(
    result.workbooks
      .filter((workbook: any) => changedIds.has(workbook.id))
      .map((workbook: any) => saveAmlakWorkbook(workbook))
  );
};

export const deleteAmlakWorkbook = async (id: string) => {
  invalidateCollectionCache('amlakSheets', currentBookId);
  if (useMacCollection('amlakSheets')) return macSave('amlakSheets', { id, deleted: true, updatedAt: Date.now() });
  return setDoc(fsDoc("amlakSheets", id), { deleted: true, updatedAt: Date.now() }, { merge: true } as any);
};
export const updateTransactionStatus = async (id: string, status: string) => {
  if (useMacCollection('transactions')) return macSave('transactions', { id, status }, currentBookId, true);
  return setDoc(fsDoc( "transactions", id), { status }, { merge: true } as any);
};

// Create Credit Note for VAT Transaction
export const createCreditNote = async (originalTransaction: any) => {
  const allTransactions = await getTransactions({ includeDeleted: true }).catch(() => []);
  const nextCreditNoteNo = getNextVatInvoiceNumber(allTransactions as any, originalTransaction?.date, 'CN-');
  const creditNote = {
    ...originalTransaction,
    id: crypto.randomUUID(),
    isCreditNote: true,
    originalInvoiceId: originalTransaction.vatInvoiceNumber,
    vatInvoiceNumber: nextCreditNoteNo,
    amount: -Math.abs(originalTransaction.amount || 0),
    vatAmount: -Math.abs(originalTransaction.vatAmount || 0),
    totalWithVat: -Math.abs(originalTransaction.totalWithVat || 0),
    amountExcludingVAT: -Math.abs(originalTransaction.amountExcludingVAT || 0),
    amountIncludingVAT: -Math.abs(originalTransaction.amountIncludingVAT || 0),
    details: `Credit Note for ${originalTransaction.vatInvoiceNumber || 'Invoice'}${originalTransaction.details ? ' - ' + originalTransaction.details : ''}`,
    createdAt: Date.now(),
  };
  // Credit note must NOT inherit the original's ZATCA QR — strip those fields entirely
  // (Firestore rejects `undefined` values, so delete the keys instead)
  delete (creditNote as any).zatcaQRCode;
  delete (creditNote as any).zatcaReportedAt;
  delete (creditNote as any).zatcaStatus;
  
  if (useMacCollection('transactions')) await macSave('transactions', creditNote);
  else await setDoc(fsDoc( 'transactions', creditNote.id), creditNote);
  return creditNote;
};

export const deleteTransaction = async (id: string, opts?: { skipStockRestore?: boolean }) => {
  if (useMacCollection('transactions')) {
    await macDelete('transactions', id);
    await macSave('audit', { action: 'DELETE_TRANSACTION', details: `Deleted transaction ${id}`, timestamp: Date.now() }).catch(() => {});
    return true;
  }
  try {
    // load transaction for restock metadata
    let txData: any = null;
    let primaryDocId: string | null = null;
    try {
      const direct = await getDoc(fsDoc( 'transactions', id));
      if (direct && direct.exists()) {
        txData = { id, ...(direct.data() as any) };
        primaryDocId = direct.id;
      }
    } catch (_) {}
    if (!txData) {
      const q = query(fsCollection( 'transactions'), where('id', '==', id));
      const snap = await getDocs(q as any).catch(() => null);
      if (snap && snap.docs && snap.docs.length > 0) {
        const d = snap.docs[0];
        txData = { id: d.id, ...(d.data() as any) };
        primaryDocId = d.id;
      }
    }

    // Restock items when deleting stock-related transactions (skip if already restored via soft-delete path)
    if (!opts?.skipStockRestore && txData && Array.isArray(txData.items) && txData.items.length > 0) {
      for (const item of txData.items) {
        if (!item || !item.stockId) continue;
        const qty = Math.abs(item.qty || 0);
        if (!qty) continue;
        try {
          const stockSnap = await getDoc(fsDoc( 'stocks', item.stockId)).catch(() => null as any);
          const currentQty = stockSnap && stockSnap.exists() ? ((stockSnap.data() as any).quantity || 0) : 0;
          await setDoc(fsDoc( 'stocks', item.stockId), { quantity: currentQty + qty }, { merge: true } as any).catch(() => {});
          await addDoc(fsCollection( 'stock_entries'), sanitize({ stockId: item.stockId, qty, unitPrice: item.unitPrice || 0, total: 0, by: txData.createdBy || txData.createdByName || 'system', details: `Reversal of transaction ${id}`, date: new Date().toISOString(), transactionId: id })).catch(() => {});
        } catch (e) {
          console.error('restock on delete failed', e);
        }
      }
    }

    // attempt direct delete by document id
    await deleteDoc(fsDoc( "transactions", primaryDocId || id)).catch(() => {});
    // also delete any documents where the stored `id` field equals the provided id
    const q = query(fsCollection( 'transactions'), where('id', '==', id));
    const snap = await getDocs(q as any).catch(() => null);
    if (snap && snap.docs && snap.docs.length > 0) {
      for (const d of snap.docs) {
        await deleteDoc(fsDoc( 'transactions', d.id)).catch(() => {});
      }
    }
    await addDoc(fsCollection( 'audit'), sanitize({ action: 'DELETE_TRANSACTION', details: `Deleted transaction ${id}${txData && txData.items ? ' (restocked items)' : ''}`, timestamp: Date.now() })).catch(() => {});
    return true;
  } catch (e) {
    console.error('deleteTransaction error', e);
    throw e;
  }
};


export const requestTransactionDeletion = async (requestorId: string, txId: string): Promise<ApprovalSubmitResult> => {
  const req = sanitize({ type: 'transaction_delete', targetCollection: 'transactions', targetId: txId, requestedBy: requestorId, requestedAt: Date.now(), status: 'PENDING' });
  const r = await submitApprovalRequest(req);
  if (r.duplicate) return r;
  if (useMacCollection('approvals')) {
    runInBackground(macSave('audit', { action: 'REQUEST_DELETE', details: `Deletion requested for tx ${txId}`, userId: requestorId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
  } else {
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REQUEST_DELETE', details: `Deletion requested for tx ${txId}`, userId: requestorId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    runInBackground(async () => {
      const { notifyAdminsOfRequest } = await import('./pushNotificationService');
      const userName = await getUserName(requestorId);
      notifyAdminsOfRequest({ approvalId: r.id, type: 'transaction_delete', requestedBy: userName, targetId: txId }).catch(() => {});
    }, 'approval notification');
  }
  return r;
};

export const getBuildings = async (opts?: { includeDeleted?: boolean }) => {
  const data = await getCollection("buildings", { includeDeleted: !!opts?.includeDeleted });
  const extractNumber = (name: string) => {
    const match = (name || '').match(/(\d+)/g);
    if (!match || match.length === 0) return null;
    // Use the last number in the string (e.g., SAAD-101-1 -> 1, SAAD-101 -> 101)
    return parseInt(match[match.length - 1], 10);
  };
  return (data || []).slice().sort((a: any, b: any) => {
    const nameA = a?.name || '';
    const nameB = b?.name || '';
    const numA = extractNumber(nameA);
    const numB = extractNumber(nameB);

    if (numA !== null && numB !== null && numA !== numB) return numA - numB;
    if (numA !== null && numB === null) return -1; // numeric first
    if (numA === null && numB !== null) return 1;
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
};
export const saveBuilding = async (b: any) => {
  const data = sanitize(b);
  invalidateCollectionCache('buildings', currentBookId);
  if (useMacCollection('buildings')) return macSave('buildings', data);
  if (!b.id) return addDoc(fsCollection( "buildings"), data);
  return setDoc(fsDoc( "buildings", b.id), data);
};
export const deleteBuilding = async (id: string) => {
  if (useMacCollection('buildings')) return macDelete('buildings', id);
  return deleteDoc(fsDoc( "buildings", id));
};

/** Read buildings, transactions, and contracts from a specific book without changing global state */
export const getDataFromBook = async (bookId: string): Promise<{
  buildings: any[];
  transactions: any[];
  contracts: any[];
}> => {
  if (useMacBackend()) {
    const [buildings, transactions, contracts] = await Promise.all([
      macListCollection('buildings', { bookId, includeDeleted: false }),
      macListCollection('transactions', { bookId, includeDeleted: false, orderField: 'date' }),
      macListCollection('contracts', { bookId, includeDeleted: false }),
    ]);
    return { buildings, transactions, contracts };
  }
  const colPath = (name: string): string =>
    bookId === 'default' || !BOOK_SCOPED_COLLECTIONS.has(name)
      ? name
      : `book_${bookId}_${name}`;

  const toArr = (snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));

  const [bSnap, tSnap, cSnap] = await Promise.all([
    getDocs(_colRef(assertDb(), colPath('buildings'))),
    getDocs(query(_colRef(assertDb(), colPath('transactions')), orderBy('date', 'desc'))).catch(() => ({ docs: [] } as any)),
    getDocs(_colRef(assertDb(), colPath('contracts'))),
  ]);

  const buildings = toArr(bSnap).filter((d: any) => !d.deleted);
  // NOTE: include `vatReportOnly` rows (VAT purchase/import entries) so dashboard/history
  // totals match the main book behavior.
  const transactions = toArr(tSnap).filter((d: any) => !d.deleted);
  const contracts = toArr(cSnap).filter((d: any) => !d.deleted);

  return { buildings, transactions, contracts };
};

export const transferBuildingToBook = async (
  buildingId: string,
  sourceBookId: string,
  targetBookId: string,
  onProgress?: (msg: string) => void
): Promise<{ transferred: Record<string, number>; errors: string[] }> => {
  const getColPath = (bookId: string, colName: string): string => {
    if (bookId === 'default' || !BOOK_SCOPED_COLLECTIONS.has(colName)) return colName;
    return `book_${bookId}_${colName}`;
  };

  const transferred: Record<string, number> = {};
  const errors: string[] = [];

  // 1. Transfer building document
  onProgress?.('Transferring building record...');
  const srcBuildingRef = _docRef(assertDb(), getColPath(sourceBookId, 'buildings'), buildingId);
  const srcBuildingSnap = await getDoc(srcBuildingRef);
  if (!srcBuildingSnap.exists()) throw new Error('Building not found in source book');
  const buildingData = { id: srcBuildingSnap.id, ...srcBuildingSnap.data() };
  await setDoc(_docRef(assertDb(), getColPath(targetBookId, 'buildings'), buildingId), sanitize(buildingData));
  await deleteDoc(srcBuildingRef);
  transferred.buildings = 1;

  // 2. Transfer building-linked collections
  const linkedCollections = [
    'transactions', 'contracts', 'stock', 'stock_entries',
    'stockItems', 'stockTransfers', 'utility_readings', 'security_deposits',
    'ejar_contracts', 'service_agreements', 'sadad_bills',
  ];

  for (const colName of linkedCollections) {
    onProgress?.(`Transferring ${colName}...`);
    const srcColPath = getColPath(sourceBookId, colName);
    const tgtColPath = getColPath(targetBookId, colName);
    try {
      const snap = await getDocs(query(_colRef(assertDb(), srcColPath), where('buildingId', '==', buildingId)));
      let count = 0;
      for (const d of snap.docs) {
        const data = { id: d.id, ...(d.data() as any) };
        await setDoc(_docRef(assertDb(), tgtColPath, d.id), sanitize(data));
        await deleteDoc(d.ref);
        count++;
      }
      if (count > 0) transferred[colName] = count;
    } catch (e: any) {
      errors.push(`${colName}: ${e?.message || String(e)}`);
    }
  }

  // 3. Transfer users assigned exclusively to this building; update multi-building users
  onProgress?.('Transferring staff...');
  try {
    const srcUsersSnap = await getDocs(_colRef(assertDb(), getColPath(sourceBookId, 'users')));
    let usersTransferred = 0;
    for (const d of srcUsersSnap.docs) {
      const user = { id: d.id, ...(d.data() as any) } as any;
      const singleMatch = user.buildingId === buildingId && (!user.buildingIds || user.buildingIds.length === 0);
      const multiMatch = Array.isArray(user.buildingIds) && user.buildingIds.includes(buildingId);
      if (!singleMatch && !multiMatch) continue;

      const otherBuildings = Array.isArray(user.buildingIds)
        ? user.buildingIds.filter((id: string) => id !== buildingId)
        : [];
      const hasOtherBuildings = singleMatch ? false : otherBuildings.length > 0;

      if (hasOtherBuildings) {
        // Keep user in source book but remove this building from their assignment
        const updatedUser = { ...user, buildingIds: otherBuildings, buildingId: otherBuildings[0] || null };
        await setDoc(d.ref, sanitize(updatedUser));
      } else {
        // Move user entirely to target book
        await setDoc(_docRef(assertDb(), getColPath(targetBookId, 'users'), d.id), sanitize(user));
        await deleteDoc(d.ref);
        usersTransferred++;
      }
    }
    if (usersTransferred > 0) transferred.users = usersTransferred;
  } catch (e: any) {
    errors.push(`users: ${e?.message || String(e)}`);
  }

  // Audit log
  await addDoc(_colRef(assertDb(), 'audit'), sanitize({
    action: 'TRANSFER_BUILDING',
    details: `Building ${buildingId} transferred from book '${sourceBookId}' to book '${targetBookId}'`,
    userId: 'system',
    timestamp: Date.now(),
    transferred,
  })).catch(() => {});

  return { transferred, errors };
};

export const cascadeUnitRename = async (buildingId: string, oldUnitName: string, newUnitName: string): Promise<{ contracts: number; transactions: number; stockEntries: number }> => {
  const counts = { contracts: 0, transactions: 0, stockEntries: 0 };
  const batch = writeBatch(assertDb());

  const contractsSnap = await getDocs(query(fsCollection( "contracts"), where("buildingId", "==", buildingId), where("unitName", "==", oldUnitName)));
  contractsSnap.forEach(d => { batch.update(d.ref, { unitName: newUnitName }); counts.contracts++; });

  const txSnap = await getDocs(query(fsCollection( "transactions"), where("buildingId", "==", buildingId), where("unitName", "==", oldUnitName)));
  txSnap.forEach(d => { batch.update(d.ref, { unitName: newUnitName }); counts.transactions++; });

  const stockSnap = await getDocs(query(fsCollection( "stock"), where("buildingId", "==", buildingId), where("unitName", "==", oldUnitName)));
  stockSnap.forEach(d => { batch.update(d.ref, { unitName: newUnitName }); counts.stockEntries++; });

  await batch.commit();
  return counts;
};

export type GetCustomersOptions = { includeDeleted?: boolean; /** Scan every book partition (slow) */ acrossBooks?: boolean };

export const getCustomers = async (opts?: GetCustomersOptions) => {
  const includeDeleted = !!opts?.includeDeleted;
  const cacheKey = `customers:${includeDeleted}:${opts?.acrossBooks ? 'all' : currentBookId}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const data = opts?.acrossBooks
    ? await getCustomersAcrossBooks({ includeDeleted })
    : await getCollection('customers', { includeDeleted });
  const toName = (c: any) => (c?.nameEn || c?.nameAr || c?.name || '').toString();
  const sorted = (data || []).slice().sort((a: any, b: any) => toName(a).localeCompare(toName(b), undefined, { sensitivity: 'base' }));
  setCached(cacheKey, sorted);
  return sorted;
};
export const saveCustomer = async (c: any) => {
  const data = sanitize(c);
  invalidateFirestoreCache('customers:');
  invalidateCollectionCache('customers', currentBookId);
  const activeBook = getCurrentBookId();
  if (useMacCollection('customers')) {
    const saved = await macSave('customers', data, 'default');
    if (activeBook && activeBook !== 'default') {
      await macSave('customers', { ...data, id: (saved as any).id || c.id }, activeBook).catch(() => {});
    }
    return saved;
  }

  // Always write to GLOBAL customers so all books share the same directory.
  // Also write to the active book's customers collection for backward-compatibility.
  if (!c.id) {
    const ref = await addDoc(_colRef(assertDb(), 'customers'), data);
    const nextId = ref.id;
    try {
      if (activeBook && activeBook !== 'default') {
        await setDoc(_docRef(assertDb(), `book_${activeBook}_customers`, nextId), data as any);
      }
    } catch {
      // non-fatal
    }
    return ref;
  }

  await setDoc(_docRef(assertDb(), 'customers', c.id), data);
  try {
    if (activeBook && activeBook !== 'default') {
      await setDoc(_docRef(assertDb(), `book_${activeBook}_customers`, c.id), data as any);
    }
  } catch {
    // non-fatal
  }
  return true as any;
};
export const deleteCustomer = async (id: string) => {
  invalidateFirestoreCache('customers:');
  invalidateCollectionCache('customers', currentBookId);
  if (useMacCollection('customers')) return macDelete('customers', id);
  return deleteDoc(fsDoc( "customers", id));
};

/**
 * Load customers from global + all book-scoped collections.
 * This makes customers shared/interconnected across books.
 */
export const getCustomersAcrossBooks = async (opts?: { includeDeleted?: boolean }) => {
  const includeDeleted = !!opts?.includeDeleted;
  if (useMacCollection('customers')) {
    const globalCustomers = await macListCollection('customers', { bookId: 'default', includeDeleted });
    const books = await getBooks().catch(() => []);
    const bookCustomers = (
      await Promise.all(
        books
          .filter((book: any) => book.id && book.id !== 'default')
          .map((book: any) => macListCollection('customers', { bookId: book.id, includeDeleted }).catch(() => [])),
      )
    ).flat();
    return [...globalCustomers, ...bookCustomers];
  }
  const toArr = (snap: any) => (snap?.docs || []).map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  const norm = (v: any) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const keyOf = (c: any): string => {
    const vat = norm(c?.vatNumber || c?.vatNo || c?.vat || c?.customerVATNumber);
    if (vat) return `vat:${vat}`;
    const phone = norm(c?.phone || c?.mobile || c?.phoneNumber);
    if (phone) return `phone:${phone}`;
    const email = norm(c?.email);
    if (email) return `email:${email}`;
    const name = norm(c?.nameEn || c?.nameAr || c?.name);
    const room = norm(c?.roomNumber || c?.room);
    return `name:${name}|room:${room}`;
  };

  try {
    const firestore = assertDb();
    const globalSnap = await getDocs(_colRef(firestore, 'customers')).catch(() => ({ docs: [] } as any));
    const globalCustomers = toArr(globalSnap).map((c: any) => ({ ...c, bookId: c.bookId || 'global' }));

    const booksSnap = await getDocs(_colRef(firestore, 'books')).catch(() => ({ docs: [] } as any));
    const bookIds = (booksSnap?.docs || [])
      .map((d: any) => String(d.id))
      .filter((id) => id && id !== 'default');
    const bookCustomers =
      bookIds.length === 0
        ? []
        : (
            await Promise.all(
              bookIds.map(async (bookId) => {
                const snap = await getDocs(_colRef(firestore, `book_${bookId}_customers`) as any).catch(() => ({ docs: [] } as any));
                return toArr(snap).map((c: any) => ({ ...c, bookId }));
              }),
            )
          ).flat();

    const merged = [...globalCustomers, ...bookCustomers];
    const scoped = includeDeleted ? merged : merged.filter((c: any) => !(c as any).deleted);

    // De-dup by stable customer identity (VAT > phone > email > name+room)
    const uniq = Array.from(new Map(scoped.map((c: any) => [keyOf(c), c])).values());
    return uniq;
  } catch (e) {
    console.error('getCustomersAcrossBooks error', e);
    // fallback to current-book customers only
    return await getCollection('customers', { includeDeleted }).catch(() => []);
  }
};

export const getUsers = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection("users", { includeDeleted: !!opts?.includeDeleted });
};

/** Fetch a single user doc — avoids loading the entire users collection for flag sync. */
export const getUserById = async (userId: string, opts?: { includeDeleted?: boolean }): Promise<any | null> => {
  if (!userId) return null;
  if (useMacCollection('users')) {
    return macGetDocument('users', userId, { bookId: currentBookId, includeDeleted: !!opts?.includeDeleted });
  }
  try {
    const snap = await getDoc(fsDoc('users', userId));
    if (!snap.exists()) return null;
    const row = { id: snap.id, ...(snap.data() as any) };
    if (!opts?.includeDeleted && (row as any).deleted) return null;
    return row;
  } catch {
    return null;
  }
};

/**
 * Load users from global + all book-scoped collections.
 * Treasury needs this because owners may exist in a different book than the active one.
 */
export const getUsersAcrossBooks = async (opts?: { includeDeleted?: boolean }) => {
  const includeDeleted = !!opts?.includeDeleted;
  if (useMacCollection('users')) {
    const globalUsers = await macListCollection('users', { bookId: 'default', includeDeleted });
    const books = await getBooks().catch(() => []);
    const bookUsers = (
      await Promise.all(
        books
          .filter((book: any) => book.id && book.id !== 'default')
          .map((book: any) => macListCollection('users', { bookId: book.id, includeDeleted }).catch(() => [])),
      )
    ).flat();
    return Array.from(new Map([...globalUsers, ...bookUsers].map((u: any) => [String(u.id), u])).values());
  }
  const toArr = (snap: any) => (snap?.docs || []).map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  const uniqById = (rows: any[]) => Array.from(new Map(rows.map((u: any) => [String(u.id), u])).values());

  try {
    const globalSnap = await getDocs(_colRef(assertDb(), 'users')).catch(() => ({ docs: [] } as any));
    const globalUsers = toArr(globalSnap).map((u: any) => ({ ...u, bookId: u.bookId || 'default' }));

    const booksSnap = await getDocs(_colRef(assertDb(), 'books')).catch(() => ({ docs: [] } as any));
    const bookIds = (booksSnap?.docs || []).map((d: any) => String(d.id)).filter(Boolean);
    const bookUsers = (
      await Promise.all(
        bookIds.map(async (bookId) => {
          const snap = await getDocs(_colRef(assertDb(), `book_${bookId}_users`) as any).catch(() => ({ docs: [] } as any));
          return toArr(snap).map((u: any) => ({ ...u, bookId }));
        }),
      )
    ).flat();

    const merged = uniqById([...globalUsers, ...bookUsers]);
    const scoped = includeDeleted ? merged : merged.filter((u: any) => !(u as any).deleted);
    return scoped;
  } catch (e) {
    console.error('getUsersAcrossBooks error', e);
    return await getUsers(opts).catch(() => []);
  }
};
export const saveUser = async (u: any) => {
  let payload = { ...u };
  // Hash the password before storing if a plaintext value was provided
  if (payload.password && !/^[0-9a-f]{64}$/.test(payload.password)) {
    payload.password = await hashPassword(payload.password);
  }
  const data = sanitize(payload);
  if (useMacCollection('users')) return macSave('users', data);
  if (!u.id) return addDoc(fsCollection( "users"), data);
  return setDoc(fsDoc( "users", u.id), data);
};

// Upload profile photo to localStorage (saves Firebase Storage quota)
export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Store in localStorage
        localStorage.setItem(`profilePhoto_${userId}`, base64String);
        
        // Update user document with localStorage flag
        await setDoc(fsDoc( "users", userId), { 
          photoURL: `localStorage:${userId}`,
          photoUpdated: Date.now()
        }, { merge: true });
        
        resolve(base64String);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Failed to upload profile photo:', error);
    throw error;
  }
};

// Get profile photo from localStorage
export const getProfilePhoto = (userId: string): string | null => {
  return localStorage.getItem(`profilePhoto_${userId}`);
};

export const deleteUser = async (id: string) => {
  if (useMacCollection('users')) return macDelete('users', id);
  return deleteDoc(fsDoc( "users", id));
};

async function findUserByField(field: 'id' | 'firebaseUid', value: string): Promise<{ user: any; bookId: string; colPath: string } | null> {
  const db = assertDb();

  if (field === 'id') {
    const directDefault = await getDoc(bookDoc('default', 'users', value));
    if (directDefault.exists()) {
      return { user: { id: value, ...directDefault.data() }, bookId: 'default', colPath: 'users' };
    }
  }

  const q = query(bookCol('default', 'users'), where(field, '==', value));
  const snap = await getDocs(q as any);
  const arr = toArray(snap);
  if (arr[0]) return { user: arr[0], bookId: 'default', colPath: 'users' };

  const bookIds = new Set<string>();
  try {
    const booksSnap = await getDocs(bookCol('default', 'books'));
    booksSnap.docs.forEach((bDoc) => {
      if (bDoc.id && bDoc.id !== 'default') bookIds.add(bDoc.id);
    });
  } catch {
    /* books collection may not exist yet */
  }

  for (const bookId of bookIds) {
    if (field === 'id') {
      const direct = await getDoc(bookDoc(bookId, 'users', value));
      if (direct.exists()) {
        return { user: { id: value, ...direct.data() }, bookId, colPath: `book_${bookId}_users` };
      }
    }
    const bq = query(bookCol(bookId, 'users'), where(field, '==', value));
    const bSnap = await getDocs(bq as any);
    const bArr = toArray(bSnap);
    if (bArr[0]) return { user: bArr[0], bookId, colPath: `book_${bookId}_users` };
  }

  return null;
}

export const loadUserByLoginId = async (id: string) => {
  const found = await findUserByField('id', id);
  return found ? { ...found.user, bookId: found.bookId } : null;
};

export const loadUserByFirebaseUid = async (uid: string, preferredBookId?: string) => {
  const found = await findUserByField('firebaseUid', uid);
  if (found) return { ...found.user, bookId: found.bookId };
  if (preferredBookId) {
    const byId = await findUserByField('id', uid);
    if (byId) return { ...byId.user, bookId: byId.bookId };
  }
  return null;
};

export const mockLogin = async (id: string, pass: string) => {
  try {
    // Search global 'users' collection first
    const q = query(_colRef(assertDb(), "users"), where("id", "==", id));
    const snap = await getDocs(q as any);
    const arr = toArray(snap);
    const user = arr[0];
    if (user && await verifyPassword(pass, (user as any).password || '')) {
      if (user.hasSystemAccess !== false) {
        if (isOwnerPortalAccount(user)) throw new Error(OWNER_PORTAL_ONLY_LOGIN);
        return { ...user, bookId: 'default' };
      }
    }

    // If not found in global, search all book-scoped user collections
    try {
      const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
      for (const bDoc of booksSnap.docs) {
        const bookId = bDoc.id;
        const bq = query(_colRef(assertDb(), `book_${bookId}_users`), where("id", "==", id));
        const bSnap = await getDocs(bq as any);
        const bArr = toArray(bSnap);
        const bUser = bArr[0];
        if (bUser && await verifyPassword(pass, (bUser as any).password || '')) {
          if (bUser.hasSystemAccess !== false) {
            if (isOwnerPortalAccount(bUser)) throw new Error(OWNER_PORTAL_ONLY_LOGIN);
            return { ...bUser, bookId };
          }
        }
      }
    } catch (_) { /* books collection may not exist yet */ }

    // First-boot: if no ADMIN user exists at all, create one so the app is usable.
    // This covers fresh databases and cases where the admin was accidentally deleted.
    const allUsersSnap = await getDocs(_colRef(assertDb(), "users"));
    const allUsers = toArray(allUsersSnap);
    const hasAdmin = allUsers.some((u: any) => u.role === 'ADMIN');
    if (!hasAdmin) {
      const hashedPass = await hashPassword(pass);
      const newAdmin = {
        id,
        name: 'Admin',
        role: 'ADMIN',
        status: 'Active',
        hasSystemAccess: true,
        password: hashedPass,
        createdAt: new Date().toISOString(),
      };
      await setDoc(_docRef(assertDb(), "users", id), newAdmin);
      return { ...newAdmin, bookId: 'default' };
    }

    return null;
  } catch (e) {
    console.error('mockLogin error', e);
    throw e;
  }
};

export const changeUserPassword = async (userId: string, oldPass: string, newPass: string) => {
  // Try global 'users' first, then search book-scoped collections
  const q = query(_colRef(assertDb(), "users"), where("id", "==", userId));
  const snap = await getDocs(q as any);
  const arr = toArray(snap);
  let user = arr[0];
  let userColPath = 'users';
  if (!user) {
    try {
      const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
      for (const bDoc of booksSnap.docs) {
        const colPath = `book_${bDoc.id}_users`;
        const bq = query(_colRef(assertDb(), colPath), where("id", "==", userId));
        const bSnap = await getDocs(bq as any);
        const bArr = toArray(bSnap);
        if (bArr[0]) { user = bArr[0]; userColPath = colPath; break; }
      }
    } catch (_) {}
  }
  if (!user) throw new Error('User not found');
  if (!await verifyPassword(oldPass, user.password || '')) throw new Error('Current password is incorrect');
  const hashedNew = await hashPassword(newPass);
  await setDoc(_docRef(assertDb(), userColPath, user.id), { ...user, password: hashedNew }, { merge: true } as any);
  try {
    const { provisionStaffFirebaseAuth } = await import('./authService');
    await provisionStaffFirebaseAuth(userId, newPass, userColPath === 'users' ? 'default' : userColPath.replace(/^book_/, '').replace(/_users$/, ''));
  } catch (syncErr) {
    console.warn('Firebase auth sync after password change failed', syncErr);
  }
  return true;
};

export const requestPasswordReset = async (userId: string, newPassword: string) => {
  // Search global 'users' first, then book-scoped collections
  const q2 = query(_colRef(assertDb(), 'users'), where('id', '==', userId));
  const snap = await getDocs(q2 as any);
  const arr = toArray(snap);
  let user = arr[0];
  let userColPath = 'users';
  if (!user) {
    try {
      const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
      for (const bDoc of booksSnap.docs) {
        const colPath = `book_${bDoc.id}_users`;
        const bq = query(_colRef(assertDb(), colPath), where('id', '==', userId));
        const bSnap = await getDocs(bq as any);
        const bArr = toArray(bSnap);
        if (bArr[0]) { user = bArr[0]; userColPath = colPath; break; }
      }
    } catch (_) {}
  }
  if (!user) throw new Error('User ID not found');

  // Hash and store the new password
  const hashedNewPassword = await hashPassword(newPassword);
  await setDoc(_docRef(assertDb(), userColPath, user.id), { password: hashedNewPassword }, { merge: true } as any);

  try {
    const { provisionStaffFirebaseAuth } = await import('./authService');
    const bookId = userColPath === 'users' ? 'default' : userColPath.replace(/^book_/, '').replace(/_users$/, '');
    await provisionStaffFirebaseAuth(userId, newPassword, bookId);
  } catch (syncErr) {
    console.warn('Firebase auth sync after password reset request failed', syncErr);
  }

  // Audit log
  await addDoc(fsCollection( 'audit'), sanitize({ action: 'PASSWORD_RESET', details: `Password reset by ${user.name || userId} (self-service)`, userId, timestamp: Date.now() })).catch(() => {});

  // Notify admins via push notification (no approval needed)
  try {
    const { notifyAdminsOfRequest } = await import('./pushNotificationService');
    notifyAdminsOfRequest({ approvalId: 'password_reset_' + Date.now(), type: 'password_reset', requestedBy: user.name || userId, targetId: user.id }).catch(() => {});
  } catch (e) { /* push service not available */ }
  return true;
};

export const getBanks = async () => {
  const globalBanks = await getCollection("banks");
  if (useMacCollection('banks')) return globalBanks;
  // Backward-compatibility: older versions stored banks per-book.
  // Migrate legacy `book_<id>_banks` docs into shared `banks` collection.
  if (currentBookId !== 'default') {
    try {
      const legacyPath = `book_${currentBookId}_banks`;
      const legacySnap = await getDocs(_colRef(assertDb(), legacyPath) as any);
      const legacyBanks = toArray(legacySnap).filter((b: any) => !(b as any).deleted);
      if (legacyBanks.length > 0) {
        const existingIds = new Set(globalBanks.map((b: any) => String((b as any).id || '')));
        const existingKeys = new Set(
          globalBanks.map((b: any) => `${String((b as any).name || '').trim().toLowerCase()}|${String((b as any).iban || '').trim().toLowerCase()}`)
        );
        for (const b of legacyBanks) {
          const bankId = String((b as any).id || '');
          const bankKey = `${String((b as any).name || '').trim().toLowerCase()}|${String((b as any).iban || '').trim().toLowerCase()}`;
          if (existingIds.has(bankId) || existingKeys.has(bankKey)) continue;
          const data = sanitize({ ...(b as any) });
          delete (data as any).id;
          if (bankId) await setDoc(_docRef(assertDb(), "banks", bankId), data, { merge: true } as any);
          else await addDoc(_colRef(assertDb(), "banks"), data);
        }
        return getCollection("banks");
      }
    } catch (_) {
      // Ignore legacy migration failures; shared list will still load.
    }
  }
  return globalBanks;
};
export const saveBank = async (b: any) => {
  const data = sanitize(b);
  const id = b.name || (b.id as string);
  if (useMacCollection('banks')) return macSave('banks', { ...data, id: id || data.id });
  if (!id) return addDoc(fsCollection( "banks"), data);
  return setDoc(fsDoc( "banks", id), data);
};
export const deleteBank = async (id: string) => {
  if (useMacCollection('banks')) return macDelete('banks', id);
  return deleteDoc(fsDoc( "banks", id));
};

type ScannedBookDoc = {
  bookId: string;
  id: string;
  data: any;
};

export type BankMergeResult = {
  transactionsUpdated: number;
  transfersUpdated: number;
  buildingsUpdated: number;
  bankStatementsUpdated: number;
  banksRemoved: string[];
  booksScanned: number;
};

const getBookScanList = async (): Promise<{ id: string; name: string }[]> => {
  const books = await getBooks().catch(() => []);
  const bookList = (books || []).map((book: any) => ({
    id: String(book.id || '').trim(),
    name: String(book.name || book.id || '').trim(),
  })).filter(book => book.id);
  if (!bookList.some(book => book.id === 'default')) {
    bookList.unshift({ id: 'default', name: 'Main Book' });
  }
  return bookList;
};

const scanCollectionAcrossBooks = async (
  collectionName: string,
  opts?: { includeDeleted?: boolean },
): Promise<{ booksScanned: number; docs: ScannedBookDoc[] }> => {
  const includeDeleted = opts?.includeDeleted ?? true;
  const books = await getBookScanList();
  const perBook = await Promise.all(books.map(async book => {
    try {
      if (useMacCollection(collectionName)) {
        const rows = await macListCollection<any>(collectionName, {
          bookId: book.id,
          includeDeleted,
        });
        return (rows || [])
          .filter(row => includeDeleted || !row?.deleted)
          .map(row => ({ bookId: book.id, id: String(row?.id || ''), data: row }))
          .filter(row => row.id);
      }
      const path = rawBookPath(book.id, collectionName);
      const snap = await getDocs(_colRef(assertDb(), path) as any);
      return (snap.docs || [])
        .map((d: any) => ({ bookId: book.id, id: d.id, data: { id: d.id, ...(d.data() as any) } }))
        .filter((row: ScannedBookDoc) => includeDeleted || !row.data?.deleted);
    } catch (_) {
      return [];
    }
  }));
  return { booksScanned: books.length, docs: perBook.flat() };
};

export type FirestoreCollectionStorageEstimate = {
  name: string;
  documents: number;
  bytes: number;
  sizeLabel: string;
};

export type FirestoreStorageEstimate = {
  totalBytes: number;
  totalSizeLabel: string;
  totalSizeMB: number;
  totalSizeGB: number;
  documentCount: number;
  collectionCount: number;
  booksScanned: number;
  collections: FirestoreCollectionStorageEstimate[];
  estimatedAt: string;
  note: string;
};

const formatStorageSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const estimateDocumentBytes = (collectionName: string, docId: string, data: any): number => {
  const payload = JSON.stringify({ path: `${collectionName}/${docId}`, data: sanitize(data) });
  return new Blob([payload]).size;
};

export const getFirestoreStorageEstimate = async (): Promise<FirestoreStorageEstimate> => {
  const books = await getBookScanList().catch(() => [{ id: 'default', name: 'Main Book' }]);
  const collectionRows = await Promise.all(FIRESTORE_STORAGE_ESTIMATE_COLLECTIONS.map(async (collectionName) => {
    try {
      const isBookScoped = BOOK_SCOPED_COLLECTIONS.has(collectionName);
      const docs = isBookScoped
        ? (await scanCollectionAcrossBooks(collectionName, { includeDeleted: true })).docs
        : await (async () => {
            if (useMacCollection(collectionName)) {
              const rows = await macListCollection<any>(collectionName, { bookId: 'default', includeDeleted: true });
              return (rows || []).map(row => ({ bookId: 'default', id: String(row?.id || ''), data: row })).filter(row => row.id);
            }
            const snap = await getDocs(_colRef(assertDb(), collectionName) as any);
            return (snap.docs || []).map((d: any) => ({ bookId: 'default', id: d.id, data: { id: d.id, ...(d.data() as any) } }));
          })();

      const bytes = docs.reduce((sum, docRow) => {
        const pathName = isBookScoped ? rawBookPath(docRow.bookId, collectionName) : collectionName;
        return sum + estimateDocumentBytes(pathName, docRow.id, docRow.data);
      }, 0);

      return {
        name: collectionName,
        documents: docs.length,
        bytes,
        sizeLabel: formatStorageSize(bytes),
      };
    } catch (_) {
      return {
        name: collectionName,
        documents: 0,
        bytes: 0,
        sizeLabel: formatStorageSize(0),
      };
    }
  }));

  const nonEmptyCollections = collectionRows
    .filter(row => row.documents > 0 || row.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  const totalBytes = nonEmptyCollections.reduce((sum, row) => sum + row.bytes, 0);

  return {
    totalBytes,
    totalSizeLabel: formatStorageSize(totalBytes),
    totalSizeMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    totalSizeGB: Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3)),
    documentCount: nonEmptyCollections.reduce((sum, row) => sum + row.documents, 0),
    collectionCount: nonEmptyCollections.length,
    booksScanned: books.length,
    collections: nonEmptyCollections,
    estimatedAt: new Date().toISOString(),
    note: 'Estimated from readable app documents. Firebase billed storage can be higher because Firestore adds document, field, path, and index overhead that the browser SDK cannot read exactly.',
  };
};

const applyBankReferenceMergeToCollection = async (
  collectionName: string,
  sourceBankNames: readonly string[],
  targetBankName: string,
  fields: readonly BankReferenceField[],
  opts?: { includeVatReportSnapshot?: boolean },
): Promise<number> => {
  const scanned = await scanCollectionAcrossBooks(collectionName, { includeDeleted: true });
  let updated = 0;

  if (useMacCollection(collectionName)) {
    for (const row of scanned.docs) {
      const patch = bankReferencePatch(row.data, sourceBankNames, targetBankName, {
        fields,
        includeVatReportSnapshot: !!opts?.includeVatReportSnapshot,
      });
      if (!patch) continue;
      await macSave(collectionName, { ...patch, id: row.id }, row.bookId, true);
      updated++;
    }
    return updated;
  }

  let batch = writeBatch(assertDb());
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(assertDb());
    ops = 0;
  };

  for (const row of scanned.docs) {
    const patch = bankReferencePatch(row.data, sourceBankNames, targetBankName, {
      fields,
      includeVatReportSnapshot: !!opts?.includeVatReportSnapshot,
    });
    if (!patch) continue;
    batch.set(bookDoc(row.bookId, collectionName, row.id), sanitize(patch), { merge: true } as any);
    ops++;
    updated++;
    if (ops >= 450) await commit();
  }
  await commit();
  return updated;
};

export const getBankTransactionCounts = async (): Promise<Record<string, number>> => {
  const scanned = await scanCollectionAcrossBooks('transactions', { includeDeleted: false });
  return countRecordsByBank(scanned.docs.map(row => row.data));
};

export const mergeBankAccounts = async (options: {
  sourceBankNames: string[];
  targetBankName: string;
  updatedBy?: string;
  removeMergedBanks?: boolean;
}): Promise<BankMergeResult> => {
  const sourceBankNames = Array.from(new Map(
    (options.sourceBankNames || [])
      .map(name => String(name || '').trim())
      .filter(Boolean)
      .map(name => [bankAccountKey(name), name])
  ).values());
  const targetBankName = String(options.targetBankName || '').trim();
  if (sourceBankNames.length < 2) throw new Error('Select two bank accounts to merge.');
  if (!targetBankName) throw new Error('Select the merged bank account.');
  const sourceKeys = sourceBankNames.map(bankAccountKey);
  if (new Set(sourceKeys).size !== sourceBankNames.length) throw new Error('Select two different source bank accounts.');

  const targetKey = bankAccountKey(targetBankName);
  const bankNamesToRewrite = sourceBankNames.filter(name => bankAccountKey(name) !== targetKey);
  const transactionFields = ['bankName', 'fromBankName', 'toBankName'] as const;
  const bankNameOnly = ['bankName'] as const;

  const [transactionsUpdated, transfersUpdated, buildingsUpdated, bankStatementsUpdated, scannedTransactions] = await Promise.all([
    applyBankReferenceMergeToCollection('transactions', bankNamesToRewrite, targetBankName, transactionFields, { includeVatReportSnapshot: true }),
    applyBankReferenceMergeToCollection('transfers', bankNamesToRewrite, targetBankName, transactionFields),
    applyBankReferenceMergeToCollection('buildings', bankNamesToRewrite, targetBankName, bankNameOnly),
    applyBankReferenceMergeToCollection('bank_statements', bankNamesToRewrite, targetBankName, bankNameOnly),
    scanCollectionAcrossBooks('transactions', { includeDeleted: false }),
  ]);

  const banksRemoved: string[] = [];
  if (options.removeMergedBanks !== false) {
    for (const sourceName of sourceBankNames) {
      if (bankAccountKey(sourceName) === targetKey) continue;
      await deleteBank(sourceName).catch(() => {});
      banksRemoved.push(sourceName);
    }
  }

  invalidateFirestoreCache('col:');
  await (useMacCollection('audit')
    ? macSave('audit', sanitize({
      action: 'MERGE_BANK_ACCOUNTS',
      details: `Merged ${sourceBankNames.join(' + ')} into ${targetBankName}`,
      userId: options.updatedBy || 'system',
      timestamp: Date.now(),
      transactionsUpdated,
      transfersUpdated,
      buildingsUpdated,
      bankStatementsUpdated,
      banksRemoved,
    }), 'default')
    : addDoc(_colRef(assertDb(), 'audit'), sanitize({
      action: 'MERGE_BANK_ACCOUNTS',
      details: `Merged ${sourceBankNames.join(' + ')} into ${targetBankName}`,
      userId: options.updatedBy || 'system',
      timestamp: Date.now(),
      transactionsUpdated,
      transfersUpdated,
      buildingsUpdated,
      bankStatementsUpdated,
      banksRemoved,
    })).catch(() => {})
  );

  return {
    transactionsUpdated,
    transfersUpdated,
    buildingsUpdated,
    bankStatementsUpdated,
    banksRemoved,
    booksScanned: scannedTransactions.booksScanned,
  };
};

export const updateBankAccount = async (
  originalBankName: string,
  bank: { id?: string; name: string; iban?: string },
  updatedBy?: string,
): Promise<BankMergeResult & { renamed: boolean }> => {
  const originalName = String(originalBankName || '').trim();
  const nextName = String(bank?.name || '').trim();
  const originalBankId = String(bank?.id || '').trim();
  const bankDocId = originalBankId || nextName;
  if (!originalName) throw new Error('Original bank name is missing.');
  if (!nextName) throw new Error('Bank name is required.');

  const bankData = sanitize({ ...bank, id: bankDocId, name: nextName, iban: bank?.iban || '' });
  if (useMacCollection('banks')) await macSave('banks', bankData, currentBookId, !!originalBankId);
  else await setDoc(fsDoc("banks", bankDocId), bankData);

  const documentNameChanged = originalName !== nextName;
  const referenceNameChanged = bankAccountKey(originalName) !== bankAccountKey(nextName);
  const shouldDeleteOriginalNameDoc = !originalBankId && documentNameChanged;
  if (!referenceNameChanged) {
    if (shouldDeleteOriginalNameDoc) await deleteBank(originalName).catch(() => {});
    invalidateCollectionCache('banks', currentBookId);
    return {
      renamed: documentNameChanged,
      transactionsUpdated: 0,
      transfersUpdated: 0,
      buildingsUpdated: 0,
      bankStatementsUpdated: 0,
      banksRemoved: shouldDeleteOriginalNameDoc ? [originalName] : [],
      booksScanned: 0,
    };
  }

  const transactionFields = ['bankName', 'fromBankName', 'toBankName'] as const;
  const bankNameOnly = ['bankName'] as const;
  const [transactionsUpdated, transfersUpdated, buildingsUpdated, bankStatementsUpdated, scannedTransactions] = await Promise.all([
    applyBankReferenceMergeToCollection('transactions', [originalName], nextName, transactionFields, { includeVatReportSnapshot: true }),
    applyBankReferenceMergeToCollection('transfers', [originalName], nextName, transactionFields),
    applyBankReferenceMergeToCollection('buildings', [originalName], nextName, bankNameOnly),
    applyBankReferenceMergeToCollection('bank_statements', [originalName], nextName, bankNameOnly),
    scanCollectionAcrossBooks('transactions', { includeDeleted: false }),
  ]);

  if (shouldDeleteOriginalNameDoc) await deleteBank(originalName).catch(() => {});
  invalidateCollectionCache('banks', currentBookId);
  invalidateCollectionCache('transactions', currentBookId);
  await (useMacCollection('audit')
    ? macSave('audit', sanitize({
      action: 'UPDATE_BANK_ACCOUNT',
      details: `Renamed bank ${originalName} to ${nextName}`,
      userId: updatedBy || 'system',
      timestamp: Date.now(),
      transactionsUpdated,
      transfersUpdated,
      buildingsUpdated,
      bankStatementsUpdated,
    }), 'default')
    : addDoc(_colRef(assertDb(), 'audit'), sanitize({
      action: 'UPDATE_BANK_ACCOUNT',
      details: `Renamed bank ${originalName} to ${nextName}`,
      userId: updatedBy || 'system',
      timestamp: Date.now(),
      transactionsUpdated,
      transfersUpdated,
      buildingsUpdated,
      bankStatementsUpdated,
    })).catch(() => {})
  );

  return {
    renamed: true,
    transactionsUpdated,
    transfersUpdated,
    buildingsUpdated,
    bankStatementsUpdated,
    banksRemoved: shouldDeleteOriginalNameDoc ? [originalName] : [],
    booksScanned: scannedTransactions.booksScanned,
  };
};

export const getContracts = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection("contracts", { includeDeleted: !!opts?.includeDeleted });
};
export const saveContract = async (c: any) => {
  const data = sanitize(c);
  invalidateCollectionCache('contracts', currentBookId);
  if (useMacCollection('contracts')) return macSave('contracts', data);
  if (!c.id) return addDoc(fsCollection( "contracts"), data);
  return setDoc(fsDoc( "contracts", c.id), data);
};
export const deleteContract = async (id: string) => {
  if (useMacCollection('contracts')) return macDelete('contracts', id);
  return deleteDoc(fsDoc( "contracts", id));
};

export const isUnitOccupied = async (bid: string, uname: string) => {
  const { contractIncludesUnit } = await import('../utils/contractUnits');
  const contracts = await getContracts({ includeDeleted: true });
  return contracts.some(
    (c: any) =>
      c.buildingId === bid &&
      c.status === 'Active' &&
      !c.deleted &&
      contractIncludesUnit(c.unitName, uname),
  );
};

export const getActiveContract = async (bid: string, uname: string) => {
  const { contractIncludesUnit, pickBestContractForUnit } = await import('../utils/contractUnits');
  const contracts = await getContracts({ includeDeleted: true });
  const matches = contracts.filter(
    (c: any) =>
      c.buildingId === bid &&
      !c.deleted &&
      contractIncludesUnit(c.unitName, uname),
  );
  return pickBestContractForUnit(matches) || null;
};

export const getOccupancyStats = async () => {
  const buildings = await getBuildings();
  const contracts = await getContracts();
  let totalUnits = 0;
  buildings.forEach((b: any) => (totalUnits += (b.units || []).length));
  const occupied = contracts.filter((c: any) => c.status === "Active").length;
  return { totalUnits, occupiedUnits: occupied, percentage: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0 };
};

export const getAuditLogs = async () => {
  const arr = await getCollection('audit');
  return arr.slice(0, 100);
};

export const generateBackup = async () => {
  const [transactions, customers, contracts, buildings, users, vendors, settings, tasks, banks] = await Promise.all([
    getTransactions(),
    getCustomers(),
    getContracts(),
    getBuildings(),
    getUsers(),
    getVendors(),
    getSettings(),
    getTasks(),
    getBanks(),
  ]);
  const backup = { transactions, customers, contracts, buildings, users, vendors, settings, tasks, banks, timestamp: new Date().toISOString() };
  return JSON.stringify(backup);
};

export const restoreBackup = async (jsonString: string) => {
  try {
    const backup = JSON.parse(jsonString);
    const writeCollection = async (name: string, items: any[]) => {
      if (!items || !Array.isArray(items)) return;
      for (const it of items) {
        const id = it.id || undefined;
        if (id) await setDoc(fsDoc( name, id), it).catch(() => {});
        else await addDoc(fsCollection( name), it).catch(() => {});
      }
    };
    await writeCollection('transactions', backup.transactions || []);
    await writeCollection('customers', backup.customers || []);
    await writeCollection('contracts', backup.contracts || []);
    await writeCollection('buildings', backup.buildings || []);
    await writeCollection('users', backup.users || []);
    await writeCollection('vendors', backup.vendors || []);
    if (backup.settings) await setDoc(fsDoc( 'meta', 'settings'), backup.settings).catch(() => {});
    await writeCollection('tasks', backup.tasks || []);
    await writeCollection('banks', backup.banks || []);
    return true;
  } catch (e) {
    console.error('restore failed', e);
    return false;
  }
};

export const resetSystem = async () => {
  // Clear browser cache and then wipe known Firestore collections
  try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}

  const cols = [
    'transactions','customers','contracts','buildings','users','vendors','tasks','banks',
    'audit','approvals','stocks','stockItems','stockTransfers','images','registry','notifications','meta',
    'transfers','service_agreements','stock_entries'
  ];

  for (const c of cols) {
    const snap = await getDocs(fsCollection( c) as any).catch(() => null);
    if (!snap) continue;
    for (const d of snap.docs) {
      await deleteDoc(fsDoc( c, d.id)).catch(() => {});
    }
  }

  // Remove settings doc explicitly (meta/settings)
  await deleteDoc(fsDoc( 'meta', 'settings')).catch(() => {});

  // Final reload
  window.location.reload();
};

// ---- Approval Workflow Helpers ----
export type ApprovalSubmitResult = { id: string; duplicate?: boolean };

export function dedupeApprovalsList(arr: any[]): any[] {
  const map = new Map<string, any>();
  for (const a of arr || []) {
    if (!a?.type || !a?.targetId) continue;
    const key = `${a.type}|${a.targetId}`;
    const existing = map.get(key);
    if (!existing || Number(a.requestedAt || 0) > Number(existing.requestedAt || 0)) {
      map.set(key, a);
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(b.requestedAt || 0) - Number(a.requestedAt || 0));
}

async function findPendingApproval(type: string, targetId: string): Promise<{ id: string } | null> {
  if (useMacCollection('approvals')) {
    const rows = await getApprovals('PENDING').catch(() => []);
    const match = (rows || []).find((a: any) => a.type === type && a.targetId === targetId);
    return match?.id ? { id: match.id } : null;
  }
  const q = query(fsCollection('approvals'), where('status', '==', 'PENDING'));
  const snap = await getDocs(q as any).catch(() => null);
  if (!snap) return null;
  const match = snap.docs.find((d) => {
    const data = d.data() as any;
    return data.type === type && data.targetId === targetId;
  });
  return match ? { id: match.id } : null;
}

async function submitApprovalRequest(req: Record<string, unknown>): Promise<ApprovalSubmitResult> {
  const type = String(req.type || '');
  const targetId = String(req.targetId || '');
  const existing = await findPendingApproval(type, targetId);
  if (existing) return { id: existing.id, duplicate: true };

  if (useMacCollection('approvals')) {
    const r = await macSave('approvals', req);
    return { id: String((r as any).id) };
  }
  const r = await addDoc(fsCollection('approvals'), req);
  return { id: r.id };
}

export const isApprovalPendingForTarget = async (type: string, targetId: string) => {
  const existing = await findPendingApproval(type, targetId);
  return !!existing;
};
export const requestTransactionEdit = async (requestorId: string, txId: string, newData: any): Promise<ApprovalSubmitResult> => {
  const req = sanitize({ type: 'transaction_edit', targetCollection: 'transactions', targetId: txId, payload: newData, requestedBy: requestorId, requestedAt: Date.now(), status: 'PENDING' });
  const r = await submitApprovalRequest(req);
  if (r.duplicate) return r;
  if (useMacCollection('approvals')) {
    runInBackground(macSave('audit', { action: 'REQUEST_EDIT', details: `Edit requested for tx ${txId}`, userId: requestorId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
  } else {
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REQUEST_EDIT', details: `Edit requested for tx ${txId}`, userId: requestorId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    runInBackground(async () => {
      const { notifyAdminsOfRequest } = await import('./pushNotificationService');
      const userName = await getUserName(requestorId);
      notifyAdminsOfRequest({ approvalId: r.id, type: 'transaction_edit', requestedBy: userName, targetId: txId }).catch(() => {});
    }, 'approval notification');
  }
  return r;
};

export const getApprovals = async (status = 'PENDING') => {
  const all = await getCollection('approvals', 'requestedAt');
  if (!status) return all;
  return all.filter((a: any) => (a.status || 'PENDING') === status);
};

export const listenApprovals = (callback: (arr: any[]) => void, status = 'PENDING') => {
  if (useMacCollection('approvals')) {
    let cancelled = false;
    const load = async () => {
      const rows = await getApprovals(status === 'ALL' ? '' : status).catch(() => []);
      const filtered = dedupeApprovalsList(rows || []);
      setPendingApprovalKeysFromList(filtered);
      if (!cancelled) callback(filtered);
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }
  try {
    const colRef = fsCollection( 'approvals');
    const q =
      status && status !== 'ALL'
        ? query(colRef, where('status', '==', status))
        : colRef;
    const unsub = onSnapshot(q as any, (snap) => {
      try {
        const all = toArray(snap || { docs: [] });
        const filtered = dedupeApprovalsList((all || [])
          .filter((a: any) => {
            if (!status || status === 'ALL') return true;
            return (a.status || 'PENDING') === status;
          }));
        setPendingApprovalKeysFromList(filtered);
        callback(filtered);
      } catch (e) {
        console.error('listenApprovals snapshot processing error', e);
        callback([]);
      }
    }, (err) => {
      console.error('listenApprovals error', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('listenApprovals setup error', e);
    return () => {};
  }
};

export const approveRequest = async (approvalId: string, approverId: string, approve: boolean) => {
  if (useMacCollection('approvals')) {
    const ap = await macGetDocument<any>('approvals', approvalId, { bookId: currentBookId, includeDeleted: true });
    if (!ap) throw new Error('Approval request not found');

    if (!approve) {
      await macDelete('approvals', approvalId);
      runInBackground(macSave('audit', { action: 'REJECT_REQUEST', details: `Approval rejected for ${approvalId}`, userId: approverId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
      return true;
    }

    if (ap.type === 'transaction_delete' && ap.targetCollection === 'transactions' && ap.targetId) {
      await deleteTransaction(ap.targetId);
    } else if (ap.payload && ap.targetCollection && ap.targetId && useMacCollection(ap.targetCollection)) {
      await macSave(ap.targetCollection, { ...ap.payload, id: ap.targetId }, currentBookId, true);
    } else if (ap.type === 'password_reset' && ap.payload?.newPassword && ap.targetId) {
      await macSave('users', { id: ap.targetId, password: ap.payload.newPassword }, currentBookId, true);
    }

    await macDelete('approvals', approvalId);
    runInBackground(macSave('audit', { action: 'APPROVE_REQUEST', details: `Approval approved for ${approvalId}`, userId: approverId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
    return true;
  }
  const docRef = fsDoc( 'approvals', approvalId);
  const approvalDoc = await getDoc(docRef).catch(() => null);
  if (!approvalDoc || !approvalDoc.exists()) {
    throw new Error('Approval request not found');
  }
  const ap = { id: approvalDoc.id, ...(approvalDoc.data() as any) } as any;

  // REJECT: just update status and clean up
  if (!approve) {
    await deleteDoc(docRef).catch(() => setDoc(docRef, { handledBy: approverId, handledAt: Date.now(), status: 'REJECTED' }, { merge: true } as any));
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REJECT_REQUEST', details: `Approval rejected for ${approvalId}`, userId: approverId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    return true;
  }

  // APPROVE: Execute the action FIRST, then mark as approved
  // This ensures the status only changes to APPROVED if the action actually succeeds
  try {
    if (ap.type === 'transaction_delete' && ap.targetCollection === 'transactions' && ap.targetId) {
      await deleteTransaction(ap.targetId);
    } else if (ap.type === 'transaction_edit' && ap.payload && ap.targetCollection && ap.targetId) {
      const data = sanitize(ap.payload);
      await setDoc(fsDoc( ap.targetCollection, ap.targetId), data, { merge: true } as any);
    } else if (ap.type === 'contract_finalize' && ap.payload && ap.targetCollection === 'contracts' && ap.targetId) {
      const data = sanitize(ap.payload);
      await setDoc(fsDoc( ap.targetCollection, ap.targetId), data, { merge: true } as any);
    } else if (ap.type === 'contract_reverse' && ap.payload && ap.targetCollection === 'contracts' && ap.targetId) {
      const data = sanitize(ap.payload);
      await setDoc(fsDoc( ap.targetCollection, ap.targetId), data, { merge: true } as any);
    } else if (ap.type === 'contract_delete' && ap.payload && ap.targetCollection === 'contracts' && ap.targetId) {
      const data = sanitize(ap.payload);
      await setDoc(fsDoc( ap.targetCollection, ap.targetId), data, { merge: true } as any);
    } else if (ap.type === 'password_reset' && ap.payload?.newPassword && ap.targetId) {
      // Password reset — find user in global or book-scoped collections
      let foundCol = 'users';
      const pq = query(_colRef(assertDb(), 'users'), where('id', '==', ap.targetId));
      const pSnap = await getDocs(pq as any);
      if (pSnap.empty) {
        try {
          const bSnap = await getDocs(_colRef(assertDb(), 'books'));
          for (const bd of bSnap.docs) {
            const cp = `book_${bd.id}_users`;
            const bq = query(_colRef(assertDb(), cp), where('id', '==', ap.targetId));
            const bs = await getDocs(bq as any);
            if (!bs.empty) { foundCol = cp; break; }
          }
        } catch (_) {}
      }
      const plainPassword = String(ap.payload.newPassword || '');
      const hashedPassword = /^[0-9a-f]{64}$/i.test(plainPassword)
        ? plainPassword
        : await hashPassword(plainPassword);
      await setDoc(_docRef(assertDb(), foundCol, ap.targetId), { password: hashedPassword }, { merge: true } as any);
      if (plainPassword && plainPassword.length >= 6) {
        try {
          const { provisionStaffFirebaseAuth } = await import('./authService');
          const bookId = foundCol === 'users' ? 'default' : foundCol.replace(/^book_/, '').replace(/_users$/, '');
          await provisionStaffFirebaseAuth(ap.targetId, plainPassword, bookId);
        } catch (syncErr) {
          console.warn('Firebase auth sync after approved password reset failed', syncErr);
        }
      }
    } else if (ap.payload && ap.targetCollection && ap.targetId) {
      const data = sanitize(ap.payload);
      await setDoc(fsDoc( ap.targetCollection, ap.targetId), data, { merge: true } as any);
    }
  } catch (e) {
    console.error('apply approval payload error', e);
    // Action failed — do NOT mark as approved so user can retry
    throw new Error(`Approval action failed: ${(e as any)?.message || 'Unknown error'}`);
  }

  // Action succeeded, so remove it from pending immediately. If deletion fails,
  // fall back to marking it approved so pending queries still drop it.
  await deleteDoc(docRef).catch(() => setDoc(docRef, { handledBy: approverId, handledAt: Date.now(), status: 'APPROVED' }, { merge: true } as any));
  runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'APPROVE_REQUEST', details: `Approval approved for ${approvalId}`, userId: approverId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
  return true;
};

export const saveUserToken = async (userId: string, token: string) => {
  try {
    if (useMacCollection('userTokens')) {
      await macSave('userTokens', {
        id: token,
        userId,
        token,
        updatedAt: Date.now(),
        platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      }, 'default', true);
      return true;
    }
    await setDoc(fsDoc( 'userTokens', token), {
      userId,
      token,
      updatedAt: Date.now(),
      platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
    return true;
  } catch (e) {
    console.error('saveUserToken error', e);
    return null;
  }
};

/** Fetch the display name for a user ID from Firestore */
export const getUserName = async (userId: string): Promise<string> => {
  try {
    // Try book-scoped users first
    const docSnap = await getDoc(fsDoc( 'users', userId));
    if (docSnap.exists()) return (docSnap.data() as any).name || userId;
    // Fallback to global users collection (for auth users not in current book)
    if (currentBookId !== 'default') {
      const globalSnap = await getDoc(_docRef(assertDb(), 'users', userId));
      if (globalSnap.exists()) return (globalSnap.data() as any).name || userId;
    }
  } catch (e) { /* ignore */ }
  return userId;
};

/** Get all users from ALL user collections — global + every book (for auth/login) */
export const getAllUsersGlobal = async (): Promise<any[]> => {
  const snap = await getDocs(_colRef(assertDb(), 'users') as any);
  const all = toArray(snap).filter((d: any) => !d.deleted).map((u: any) => ({ ...u, bookId: u.bookId || 'default' }));
  const seenIds = new Set(all.map((u: any) => u.id));
  try {
    const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
    for (const bDoc of booksSnap.docs) {
      const bookId = bDoc.id;
      const bSnap = await getDocs(_colRef(assertDb(), `book_${bookId}_users`) as any);
      for (const u of toArray(bSnap)) {
        if (!u.deleted && !seenIds.has(u.id)) {
          seenIds.add(u.id);
          all.push({ ...u, bookId });
        }
      }
    }
  } catch (_) { /* books collection may not exist yet */ }
  return all;
};

export const requestContractFinalize = async (requestorId: string, contractId: string, payload: any): Promise<ApprovalSubmitResult> => {
  const req = sanitize({ type: 'contract_finalize', targetCollection: 'contracts', targetId: contractId, payload, requestedBy: requestorId, requestedAt: Date.now(), status: 'PENDING' });
  const r = await submitApprovalRequest(req);
  if (r.duplicate) return r;
  if (useMacCollection('approvals')) {
    runInBackground(macSave('audit', { action: 'REQUEST_CONTRACT_FINALIZE', details: `Finalize requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
  } else {
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REQUEST_CONTRACT_FINALIZE', details: `Finalize requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    runInBackground(async () => {
      const { notifyAdminsOfRequest } = await import('./pushNotificationService');
      const userName = await getUserName(requestorId);
      notifyAdminsOfRequest({ approvalId: r.id, type: 'contract_finalize', requestedBy: userName, targetId: contractId }).catch(() => {});
    }, 'approval notification');
  }
  return r;
};

export const requestContractReverse = async (requestorId: string, contractId: string, payload: any): Promise<ApprovalSubmitResult> => {
  const req = sanitize({ type: 'contract_reverse', targetCollection: 'contracts', targetId: contractId, payload, requestedBy: requestorId, requestedAt: Date.now(), status: 'PENDING' });
  const r = await submitApprovalRequest(req);
  if (r.duplicate) return r;
  if (useMacCollection('approvals')) {
    runInBackground(macSave('audit', { action: 'REQUEST_CONTRACT_REVERSE', details: `Reverse finalize requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
  } else {
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REQUEST_CONTRACT_REVERSE', details: `Reverse finalize requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    runInBackground(async () => {
      const { notifyAdminsOfRequest } = await import('./pushNotificationService');
      const userName = await getUserName(requestorId);
      notifyAdminsOfRequest({ approvalId: r.id, type: 'contract_reverse', requestedBy: userName, targetId: contractId }).catch(() => {});
    }, 'approval notification');
  }
  return r;
};

export const requestContractDelete = async (requestorId: string, contractId: string, payload: any): Promise<ApprovalSubmitResult> => {
  const req = sanitize({ type: 'contract_delete', targetCollection: 'contracts', targetId: contractId, payload, requestedBy: requestorId, requestedAt: Date.now(), status: 'PENDING' });
  const r = await submitApprovalRequest(req);
  if (r.duplicate) return r;
  if (useMacCollection('approvals')) {
    runInBackground(macSave('audit', { action: 'REQUEST_CONTRACT_DELETE', details: `Delete requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() }).catch(() => {}), 'approval audit');
  } else {
    runInBackground(addDoc(fsCollection( 'audit'), sanitize({ action: 'REQUEST_CONTRACT_DELETE', details: `Delete requested for contract ${contractId}`, userId: requestorId, timestamp: Date.now() })).catch(() => {}), 'approval audit');
    runInBackground(async () => {
      const { notifyAdminsOfRequest } = await import('./pushNotificationService');
      const userName = await getUserName(requestorId);
      notifyAdminsOfRequest({ approvalId: r.id, type: 'contract_delete', requestedBy: userName, targetId: contractId }).catch(() => {});
    }, 'approval notification');
  }
  return r;
};

// ---- Stock Management ----
export const getStocks = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection('stocks', { includeDeleted: !!opts?.includeDeleted });
};
export const getStockEntries = async () => {
  return getCollection('stock_entries', { orderField: 'date' });
};
export const saveStockItem = async (s: any) => {
  const data = sanitize(s);
  if (useMacCollection('stocks')) return macSave('stocks', data);
  if (!s.id) return addDoc(fsCollection( 'stocks'), data);
  return setDoc(fsDoc( 'stocks', s.id), data);
};

export const deleteStockItem = async (id: string) => {
  if (useMacCollection('stocks')) {
    await macDelete('stocks', id);
    await macSave('audit', { action: 'DELETE_STOCK', details: `Deleted stock item ${id}`, timestamp: Date.now() }).catch(() => {});
    return true;
  }
  try {
    await deleteDoc(fsDoc( 'stocks', id));
    await addDoc(fsCollection( 'audit'), sanitize({ action: 'DELETE_STOCK', details: `Deleted stock item ${id}`, timestamp: Date.now() })).catch(() => {});
    return true;
  } catch (e) {
    console.error('Delete stock error', e);
    return false;
  }
};

/** Restore stock quantities from a transaction’s items array (called when soft-deleting a stock-sale transaction). */
export const restoreStockFromTransaction = async (tx: any, userId: string): Promise<void> => {
  if (!tx || !Array.isArray(tx.items) || tx.items.length === 0) return;
  for (const item of tx.items) {
    if (!item?.stockId) continue;
    const qty = Math.abs(item.qty || 0);
    if (!qty) continue;
    try {
      if (useMacCollection('stocks')) {
        const stock = await macGetDocument<any>('stocks', item.stockId, { bookId: currentBookId, includeDeleted: true });
        const currentQty = Number(stock?.quantity || 0);
        const stockName = stock?.name || item.name || '';
        await macSave('stocks', { ...(stock || {}), id: item.stockId, quantity: currentQty + qty }, currentBookId, true).catch(() => {});
        await macSave('stock_entries', {
          stockId: item.stockId, stockName, qty, unitPrice: item.unitPrice || 0,
          by: userId, details: 'Reversal - transaction deleted', date: new Date().toISOString(),
        }).catch(() => {});
        continue;
      }
      const stockSnap = await getDoc(fsDoc( 'stocks', item.stockId)).catch(() => null as any);
      const currentQty = stockSnap?.exists() ? ((stockSnap.data() as any).quantity || 0) : 0;
      const stockName = stockSnap?.exists() ? ((stockSnap.data() as any).name || item.name || '') : (item.name || '');
      await setDoc(fsDoc( 'stocks', item.stockId), { quantity: currentQty + qty }, { merge: true } as any).catch(() => {});
      await addDoc(fsCollection( 'stock_entries'), sanitize({
        stockId: item.stockId, stockName, qty, unitPrice: item.unitPrice || 0,
        by: userId, details: 'Reversal — transaction deleted', date: new Date().toISOString(),
      })).catch(() => {});
    } catch (e) { console.error('restoreStockFromTransaction error', e); }
  }
};

/** Re-deduct stock quantities (called when a trashed stock-sale transaction is restored from trash). */
export const redeductStockFromTransaction = async (tx: any, userId: string): Promise<void> => {
  if (!tx || !Array.isArray(tx.items) || tx.items.length === 0) return;
  for (const item of tx.items) {
    if (!item?.stockId) continue;
    const qty = Math.abs(item.qty || 0);
    if (!qty) continue;
    try {
      if (useMacCollection('stocks')) {
        const stock = await macGetDocument<any>('stocks', item.stockId, { bookId: currentBookId, includeDeleted: true });
        const currentQty = Number(stock?.quantity || 0);
        const stockName = stock?.name || item.name || '';
        await macSave('stocks', { ...(stock || {}), id: item.stockId, quantity: Math.max(0, currentQty - qty) }, currentBookId, true).catch(() => {});
        await macSave('stock_entries', {
          stockId: item.stockId, stockName, qty: -qty, unitPrice: item.unitPrice || 0,
          by: userId, details: 'Re-deduction - transaction restored from trash', date: new Date().toISOString(),
        }).catch(() => {});
        continue;
      }
      const stockSnap = await getDoc(fsDoc( 'stocks', item.stockId)).catch(() => null as any);
      const currentQty = stockSnap?.exists() ? ((stockSnap.data() as any).quantity || 0) : 0;
      const stockName = stockSnap?.exists() ? ((stockSnap.data() as any).name || item.name || '') : (item.name || '');
      await setDoc(fsDoc( 'stocks', item.stockId), { quantity: Math.max(0, currentQty - qty) }, { merge: true } as any).catch(() => {});
      await addDoc(fsCollection( 'stock_entries'), sanitize({
        stockId: item.stockId, stockName, qty: -qty, unitPrice: item.unitPrice || 0,
        by: userId, details: 'Re-deduction — transaction restored from trash', date: new Date().toISOString(),
      })).catch(() => {});
    } catch (e) { console.error('redeductStockFromTransaction error', e); }
  }
};

export const consumeStockItem = async (stockId: string, qty: number, byUserId: string, details?: string, stockName?: string) => {
  if (useMacCollection('stocks')) {
    const stock = await macGetDocument<any>('stocks', stockId, { bookId: currentBookId, includeDeleted: true });
    const currentQty = Number(stock?.quantity || 0);
    const resolvedName = stockName || stock?.name || '';
    await macSave('stocks', { ...(stock || {}), id: stockId, quantity: Math.max(0, currentQty - Math.abs(qty)) }, currentBookId, true).catch(() => {});
    await macSave('stock_entries', { stockId, stockName: resolvedName, qty: -Math.abs(qty), by: byUserId, details, date: new Date().toISOString() }).catch(() => {});
    await macSave('audit', { action: 'CONSUME_STOCK', details: `Consumed ${qty} from ${resolvedName || stockId}`, userId: byUserId, timestamp: Date.now() }).catch(() => {});
    return true;
  }
  // decrement stock and create stock_entries record
  const stockDoc = fsDoc( 'stocks', stockId);
  // best-effort read
  const snap = await getDocs(query(fsCollection( 'stocks'), where('__name__', '==', stockId)) as any).catch(() => null);
  let currentQty = 0;
  let resolvedName = stockName;
  if (snap && snap.docs && snap.docs.length > 0) {
    const d = snap.docs[0];
    currentQty = (d.data() as any).quantity || 0;
    if (!resolvedName) resolvedName = (d.data() as any).name || undefined;
    const newQty = Math.max(0, currentQty - Math.abs(qty));
    await setDoc(fsDoc( 'stocks', stockId), { quantity: newQty }, { merge: true } as any).catch(() => {});
  }
  // create entry record — always persist the stock name so log stays readable after deletions
  const entry = sanitize({ stockId, stockName: resolvedName || '', qty: -Math.abs(qty), by: byUserId, details, date: new Date().toISOString() });
  await addDoc(fsCollection( 'stock_entries'), entry).catch(() => {});
  await addDoc(fsCollection( 'audit'), sanitize({ action: 'CONSUME_STOCK', details: `Consumed ${qty} from ${resolvedName || stockId}`, userId: byUserId, timestamp: Date.now() })).catch(() => {});
  // note: Firestore atomic decrement would require FieldValue.increment; keep simple by letting background process recount or manual updates by UI.
  return true;
};

export const addStockEntry = async (stockId: string, qty: number, byUserId: string, details?: string) => {
  const entry = sanitize({ stockId, qty: Math.abs(qty), by: byUserId, details, date: new Date().toISOString() });
  if (useMacCollection('stock_entries')) {
    await macSave('stock_entries', entry).catch(() => {});
    return true;
  }
  await addDoc(fsCollection( 'stock_entries'), entry).catch(() => {});
  return true;
};

export const deleteStockEntry = async (entryId: string, reversalUserId: string): Promise<boolean> => {
  if (useMacCollection('stock_entries')) {
    const entry = await macGetDocument<any>('stock_entries', entryId, { bookId: currentBookId, includeDeleted: true });
    if (!entry) return false;
    const qtyChange = Number(entry.qty || 0);
    if (qtyChange !== 0 && entry.stockId) {
      const stock = await macGetDocument<any>('stocks', entry.stockId, { bookId: currentBookId, includeDeleted: true });
      if (stock) {
        const currentQty = Number(stock.quantity || 0);
        await macSave('stocks', { ...stock, id: entry.stockId, quantity: Math.max(0, currentQty - qtyChange) }, currentBookId, true).catch(() => {});
        await macSave('stock_entries', {
          stockId: entry.stockId,
          stockName: entry.stockName || '',
          qty: -qtyChange,
          by: reversalUserId,
          details: `Reversal of ${entry.details || 'entry'}`,
          date: new Date().toISOString(),
        }).catch(() => {});
      }
    }
    await macDelete('stock_entries', entryId).catch(() => {});
    await macSave('audit', { action: 'DELETE_STOCK_ENTRY', details: `Reversed stock entry ${entryId}`, userId: reversalUserId, timestamp: Date.now() }).catch(() => {});
    return true;
  }
  try {
    // Load the entry first so we can reverse the qty
    const entrySnap = await getDoc(fsDoc( 'stock_entries', entryId)).catch(() => null as any);
    if (!entrySnap || !entrySnap.exists()) return false;
    const entry = { id: entryId, ...entrySnap.data() as any };
    const qtyChange = entry.qty || 0; // negative = was consumed/sold, positive = was restocked
    if (qtyChange !== 0 && entry.stockId) {
      // Reverse: if qty was -5 (consumed), we add +5 back
      const stockSnap = await getDoc(fsDoc( 'stocks', entry.stockId)).catch(() => null as any);
      if (stockSnap && stockSnap.exists()) {
        const currentQty = (stockSnap.data() as any).quantity || 0;
        const restoredQty = currentQty - qtyChange; // e.g. currentQty=3, qtyChange=-5 → 3-(-5)=8
        await setDoc(fsDoc( 'stocks', entry.stockId), { quantity: Math.max(0, restoredQty) }, { merge: true } as any).catch(() => {});
        // Create a reversal entry in the log
        const reversalEntry = sanitize({ stockId: entry.stockId, stockName: entry.stockName || '', qty: -qtyChange, by: reversalUserId, details: `Reversal of ${entry.details || 'entry'}`, date: new Date().toISOString() });
        await addDoc(fsCollection( 'stock_entries'), reversalEntry).catch(() => {});
      }
    }
    await deleteDoc(fsDoc( 'stock_entries', entryId)).catch(() => {});
    await addDoc(fsCollection( 'audit'), sanitize({ action: 'DELETE_STOCK_ENTRY', details: `Reversed stock entry ${entryId}`, userId: reversalUserId, timestamp: Date.now() })).catch(() => {});
    return true;
  } catch (e) {
    console.error('deleteStockEntry error', e);
    return false;
  }
};

export const sellStockItems = async (
  sellerId: string,
  items: Array<{ stockId: string; qty: number; unitPrice?: number; name?: string }> ,
  options: {
    buildingId?: string;
    buildingName?: string;
    unitNumber?: string;
    contractId?: string;
    customerId?: string;
    customerName?: string;
    isPaid?: boolean;
    paymentMethod?: string;
    bankName?: string;
    createdByName?: string;
    txStatus?: string;
    isFree?: boolean;
  } = {}
) => {
  const isFree = !!options.isFree;
  let total = 0;
  for (const it of items) {
    const snap = await getDocs(query(fsCollection( 'stocks'), where('__name__', '==', it.stockId)) as any).catch(() => null);
    let currentQty = 0;
    if (snap && snap.docs && snap.docs.length > 0) {
      const d = snap.docs[0];
      currentQty = (d.data() as any).quantity || 0;
      const newQty = Math.max(0, currentQty - Math.abs(it.qty));
      await setDoc(fsDoc( 'stocks', it.stockId), { quantity: newQty }, { merge: true } as any).catch(() => {});
    }
    const unitPrice = isFree ? 0 : (it.unitPrice || 0);
    const lineTotal = unitPrice * it.qty;
    total += lineTotal;
    const entry = sanitize({ stockId: it.stockId, stockName: it.name || '', qty: -Math.abs(it.qty), unitPrice, total: lineTotal, by: sellerId, details: isFree ? 'Free stock issue (quantity deducted)' : (options.customerName ? `Sold to ${options.customerName}` : 'Stock Sale'), date: new Date().toISOString(), buildingId: options.buildingId, unitNumber: options.unitNumber, contractId: options.contractId, customerId: options.customerId });
    await addDoc(fsCollection( 'stock_entries'), entry).catch(() => {});
  }

  // Free issues: log a neutral transaction (amount 0, not income/expense) so history shows it
  if (isFree) {
    const tx = sanitize({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'INFO',
      amount: 0,
      paymentMethod: 'FREE',
      bankName: options.bankName,
      buildingId: options.buildingId,
      buildingName: options.buildingName,
      unitNumber: options.unitNumber,
      contractId: options.contractId,
      customerId: options.customerId,
      customerName: options.customerName,
      details: `Free stock issue${options.buildingName ? ' for ' + options.buildingName : (options.customerName ? ' to ' + options.customerName : '')}`,
      items: items.map(it => ({ stockId: it.stockId, qty: it.qty, unitPrice: 0 })),
      isStockIssue: true,
      createdAt: Date.now(),
      createdBy: sellerId,
      createdByName: options.createdByName || '',
      status: 'LOGGED',
    });

    try {
      await setDoc(fsDoc( 'transactions', tx.id), tx as any);
      await addDoc(fsCollection( 'audit'), sanitize({ action: 'FREE_STOCK', details: 'Free stock issued (qty deducted)', userId: sellerId, timestamp: Date.now() })).catch(() => {});
    } catch (e) {
      console.error('sellStockItems free transaction error', e);
    }
    return { total: 0 };
  }

  // Paid path: create income transaction when total > 0
  if (options.isPaid && total > 0) {
    const txStatus = options.txStatus || 'APPROVED';
    const tx = sanitize({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'INCOME',
      amount: total,
      paymentMethod: options.paymentMethod || 'CASH',
      bankName: options.bankName,
      buildingId: options.buildingId,
      buildingName: options.buildingName,
      unitNumber: options.unitNumber,
      contractId: options.contractId,
      customerId: options.customerId,
      customerName: options.customerName,
      details: `Stock Sale${options.customerName ? ' to ' + options.customerName : (options.customerId ? ' to ' + options.customerId : '')}`,
      items: items.map(it => ({ stockId: it.stockId, qty: it.qty, unitPrice: it.unitPrice || 0 })),
      isStockIssue: true,
      createdAt: Date.now(),
      createdBy: sellerId,
      createdByName: options.createdByName || '',
      status: txStatus,
    });

    // persist transaction using provided id so deletes work by id
    try {
      if (tx.id) {
        await setDoc(fsDoc( 'transactions', tx.id), tx as any);
      } else {
        await addDoc(fsCollection( 'transactions'), tx as any);
      }
      await addDoc(fsCollection( 'audit'), sanitize({ action: 'STOCK_SALE', details: `Sold items total ${total}`, userId: sellerId, timestamp: Date.now() })).catch(() => {});
    } catch (e) {
      console.error('sellStockItems error', e);
    }
  } else if (!options.isPaid || total === 0) {
    // Log non-paid/free stock transactions to audit only
    await addDoc(fsCollection( 'audit'), sanitize({ action: 'STOCK_TRANSFER', details: `Stock transfer (unpaid/free) - items processed but no income recorded`, userId: sellerId, timestamp: Date.now() })).catch(() => {});
  }

  return { total };
};

// Upload invoice PDF blob to Firebase Storage and attach URL to transaction
export const uploadInvoicePdf = async (vatInvoiceNumber: string, blob: Blob) => {
  if (!vatInvoiceNumber) throw new Error('Missing invoice number');
  const path = `invoices/${vatInvoiceNumber}.pdf`;
  const ref = sRef(storage, path);
  await uploadBytes(ref, blob, { contentType: 'application/pdf' });
  const url = await getDownloadURL(ref);
  // persist URL on the transaction document (if exists)
  try {
    const q = query(fsCollection( 'transactions'), where('vatInvoiceNumber', '==', vatInvoiceNumber));
    const snap = await getDocs(q as any);
    if (snap && snap.docs && snap.docs.length > 0) {
      const docId = snap.docs[0].id;
      await setDoc(fsDoc( 'transactions', docId), { invoicePdfUrl: url }, { merge: true } as any);
    }
  } catch (e) {
    console.error('Failed to attach invoicePdfUrl to transaction', e);
  }
  return url;
};

// ---- Reporting Helpers ----
const inDateRange = (d: string, start?: string, end?: string) => {
  if (!start && !end) return true;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

export const getTransactionsFiltered = async (startDate?: string, endDate?: string, buildingId?: string) => {
  const all = await getTransactions();
  return all.filter((t: any) => {
    if (buildingId && t.buildingId && t.buildingId !== buildingId) return false;
    if (!inDateRange(t.date, startDate, endDate)) return false;
    return true;
  });
};

export const getTotalByType = async (type: 'INCOME' | 'EXPENSE', startDate?: string, endDate?: string, buildingId?: string) => {
  const txs = await getTransactionsFiltered(startDate, endDate, buildingId);
  return txs.filter((t: any) => t.type === type).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
};

export const getIncomeExpenseSummary = async (startDate?: string, endDate?: string, buildingId?: string) => {
  const txs = await getTransactionsFiltered(startDate, endDate, buildingId);
  const income = txs.filter((t: any) => t.type === 'INCOME').reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
  const expense = txs.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
  return { income, expense, net: income - expense };
};

export const getIncomeExpenseByPeriod = async (period: 'daily' | 'monthly' | 'yearly', startDate?: string, endDate?: string, buildingId?: string) => {
  const txs = await getTransactionsFiltered(startDate, endDate, buildingId);
  const groups: Record<string, { income: number; expense: number }> = {};
  const keyFor = (d: string) => {
    if (period === 'monthly') return d.slice(0, 7); // YYYY-MM
    if (period === 'yearly') return d.slice(0, 4); // YYYY
    return d; // daily (YYYY-MM-DD)
  };
  for (const t of txs) {
    const key = keyFor(t.date || '');
    if (!groups[key]) groups[key] = { income: 0, expense: 0 };
    if (t.type === 'INCOME') groups[key].income += Number(t.amount) || 0;
    if (t.type === 'EXPENSE') groups[key].expense += Number(t.amount) || 0;
  }
  return Object.keys(groups).sort().map(k => ({ period: k, income: groups[k].income, expense: groups[k].expense, net: groups[k].income - groups[k].expense }));
};

export const getSalaryReport = async (startDate?: string, endDate?: string, employeeId?: string) => {
  const txs = await getTransactionsFiltered(startDate, endDate);
  const salaries = txs.filter((t: any) => t.type === 'EXPENSE' && (t.expenseCategory === 'Salary' || t.expenseCategory === 'SALARY'));
  const byEmployee: Record<string, { name: string; total: number; items: any[] }> = {};
  for (const s of salaries) {
    const id = s.employeeId || 'unknown';
    if (employeeId && id !== employeeId) continue;
    if (!byEmployee[id]) byEmployee[id] = { name: s.employeeName || id, total: 0, items: [] };
    byEmployee[id].total += Number(s.amount) || 0;
    byEmployee[id].items.push(s);
  }
  return Object.keys(byEmployee).map(k => ({ employeeId: k, employeeName: byEmployee[k].name, total: byEmployee[k].total, items: byEmployee[k].items }));
};

export const getMaintenanceReport = async (startDate?: string, endDate?: string, buildingId?: string) => {
  const txs = await getTransactionsFiltered(startDate, endDate, buildingId);
  const maint = txs.filter((t: any) => t.type === 'EXPENSE' && (t.expenseCategory === 'Maintenance' || t.expenseCategory === 'MAINTENANCE'));
  const total = maint.reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
  return { total, items: maint };
};

export const getAllReports = async (opts: { startDate?: string; endDate?: string; buildingId?: string } = {}) => {
  const { startDate, endDate, buildingId } = opts;
  const summary = await getIncomeExpenseSummary(startDate, endDate, buildingId);
  const monthly = await getIncomeExpenseByPeriod('monthly', startDate, endDate, buildingId);
  const salary = await getSalaryReport(startDate, endDate);
  const maintenance = await getMaintenanceReport(startDate, endDate, buildingId);
  return { summary, monthly, salary, maintenance };
};

// Transfers Management
export const getTransfers = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection("transfers", { orderField: "createdAt", includeDeleted: !!opts?.includeDeleted });
};

/** Transfers collection for a specific book (Reports owner totals when Main Book is active). */
export const getTransfersFromBook = async (bookId: string, opts?: { includeDeleted?: boolean }) => {
  const path = rawBookPath(bookId, 'transfers');
  const includeDeleted = !!opts?.includeDeleted;
  try {
    const col = _colRef(assertDb(), path);
    let snap: any;
    try {
      snap = await getDocs(query(col, orderBy('createdAt', 'desc')) as any);
    } catch {
      snap = await getDocs(col as any);
    }
    const data = toArray(snap);
    if (includeDeleted) return data;
    return data.filter((d: any) => !d.deleted);
  } catch {
    return [];
  }
};

export const saveTransfer = async (t: any) => {
  const data = sanitize(t);
  if (useMacCollection('transfers')) {
    const saved = await macSave('transfers', data);
    invalidateCollectionCache('transfers', currentBookId);
    invalidateCollectionCache('transactions', currentBookId);
    return saved;
  }
  try {
    const batch = writeBatch(assertDb());
    const activeBookId = getCurrentBookId();

    const involvesHead = (t.toType === 'HEAD_OFFICE' || t.fromType === 'HEAD_OFFICE');
    const involvesBuildingOwner = (t.fromType === 'BUILDING' && t.toType === 'OWNER') || (t.fromType === 'OWNER' && t.toType === 'BUILDING');
    const isInterBuilding = t.fromType === 'BUILDING' && t.toType === 'BUILDING' && t.fromId && t.toId && t.fromId !== t.toId;
    const willCreateSingleTx = involvesHead || involvesBuildingOwner;

    // Resolve the book each side belongs to. For HEAD/OWNER we keep the active book.
    const fromParsed = (t.fromType === 'BUILDING')
      ? parseCompositeBuildingId(t.fromId, activeBookId)
      : { bookId: activeBookId, rawId: t.fromId };
    const toParsed = (t.toType === 'BUILDING')
      ? parseCompositeBuildingId(t.toId, activeBookId)
      : { bookId: activeBookId, rawId: t.toId };

    // The transfer document lives in the ACTIVE book (originating book). If this is
    // a cross-book transfer we mirror it into the other book too so both Treasury
    // tabs surface the row.
    const transferBookIds = new Set<string>([activeBookId]);
    if (isInterBuilding) {
      transferBookIds.add(fromParsed.bookId);
      transferBookIds.add(toParsed.bookId);
    }

    const primaryTransferRef = t.id ? bookDoc(activeBookId, 'transfers', t.id) : bookDoc(activeBookId, 'transfers');

    let txRef: any = null;
    let txObj: any = null;
    let txRefDest: any = null;
    let txObjDest: any = null;

    if (willCreateSingleTx) {
      // Building ↔ Head / Building ↔ Owner => one linked tx in the BUILDING's book.
      const buildingBookId = t.fromType === 'BUILDING' ? fromParsed.bookId : (t.toType === 'BUILDING' ? toParsed.bookId : activeBookId);
      const buildingRawId = t.fromType === 'BUILDING' ? fromParsed.rawId : (t.toType === 'BUILDING' ? toParsed.rawId : undefined);
      txRef = t.transactionId ? bookDoc(buildingBookId, 'transactions', t.transactionId) : bookDoc(buildingBookId, 'transactions');
      // Transaction type from the BUILDING's perspective:
      // Building → Head Office / Building → Owner: money LEAVES the building = EXPENSE
      // Head Office → Building / Owner → Building: money ARRIVES at the building = INCOME
      let txType = 'OTHER';
      if (t.fromType === 'BUILDING' && (t.toType === 'HEAD_OFFICE' || t.toType === 'OWNER')) txType = 'EXPENSE';
      else if ((t.fromType === 'HEAD_OFFICE' || t.fromType === 'OWNER') && t.toType === 'BUILDING') txType = 'INCOME';
      txObj = sanitize({
        id: txRef.id,
        date: t.date || new Date().toISOString().split('T')[0],
        type: txType,
        amount: Number(t.amount) || 0,
        paymentMethod: 'TREASURY',
        // Preserve the user-chosen payment method and bank flow for display
        originalPaymentMethod: t.paymentMethod || undefined,
        fromBankName: t.fromBankName || (t.paymentMethod === 'BANK' || t.paymentMethod === 'CHEQUE' ? t.bankName : undefined) || undefined,
        toBankName: t.toBankName || undefined,
        bankName: t.fromBankName || t.bankName || undefined,
        fromType: t.fromType,
        toType: t.toType,
        fromId: t.fromId,
        toId: t.toId,
        purpose: t.purpose || t.notes || 'Treasury Transfer',
        details: t.notes || '',
        status: t.status || 'APPROVED',
        transferId: primaryTransferRef.id,
        createdBy: t.createdBy,
        createdAt: t.createdAt || Date.now(),
        source: 'treasury',
        // Store the RAW building id so it matches buildings inside the owning book.
        buildingId: buildingRawId,
        buildingBookId: buildingBookId,
        buildingName: undefined
      });
    }

    // ── Inter-Building Transfer: creates TWO linked transactions (separate books) ──
    //   - EXPENSE recorded against the SOURCE building (in its own book)
    //   - INCOME  recorded against the DESTINATION building (in its own book)
    if (isInterBuilding) {
      const transferPurpose = t.purpose || t.notes || 'Inter-Building Transfer';
      const transferDetails = t.notes || transferPurpose;
      txRef = t.transactionId
        ? bookDoc(fromParsed.bookId, 'transactions', t.transactionId)
        : bookDoc(fromParsed.bookId, 'transactions');
      txRefDest = t.transactionIdDest
        ? bookDoc(toParsed.bookId, 'transactions', t.transactionIdDest)
        : bookDoc(toParsed.bookId, 'transactions');
      const commonBase = {
        date: t.date || new Date().toISOString().split('T')[0],
        amount: Number(t.amount) || 0,
        paymentMethod: 'TREASURY',
        originalPaymentMethod: t.paymentMethod || undefined,
        fromBankName: t.fromBankName || (t.paymentMethod === 'BANK' || t.paymentMethod === 'CHEQUE' ? t.bankName : undefined) || undefined,
        toBankName: t.toBankName || undefined,
        bankName: t.fromBankName || t.bankName || undefined,
        fromType: t.fromType,
        toType: t.toType,
        fromId: t.fromId,
        toId: t.toId,
        fromName: t.fromName || undefined,
        toName: t.toName || undefined,
        purpose: transferPurpose,
        details: transferDetails,
        status: t.status || 'APPROVED',
        transferId: primaryTransferRef.id,
        createdBy: t.createdBy,
        createdByName: t.createdByName,
        createdAt: t.createdAt || Date.now(),
        source: 'treasury',
      };
      txObj = sanitize({
        ...commonBase,
        id: txRef.id,
        type: 'EXPENSE',
        expenseCategory: 'Inter-Building Transfer',
        expenseSubCategory: t.toName || t.toId || undefined,
        // RAW building id belonging to the source book
        buildingId: fromParsed.rawId,
        buildingBookId: fromParsed.bookId,
        interBuildingRole: 'SOURCE',
        interBuildingPeerTxId: txRefDest.id,
        interBuildingPeerBookId: toParsed.bookId,
      });
      txObjDest = sanitize({
        ...commonBase,
        id: txRefDest.id,
        type: 'INCOME',
        incomeSubType: 'OTHER',
        expenseCategory: 'Inter-Building Transfer',
        expenseSubCategory: t.fromName || t.fromId || undefined,
        // RAW building id belonging to the destination book
        buildingId: toParsed.rawId,
        buildingBookId: toParsed.bookId,
        interBuildingRole: 'DEST',
        interBuildingPeerTxId: txRef.id,
        interBuildingPeerBookId: fromParsed.bookId,
      });
    }

    const transferDoc = sanitize({
      ...data,
      id: primaryTransferRef.id,
      transactionId: txRef ? txRef.id : (t.transactionId || undefined),
      transactionIdDest: txRefDest ? txRefDest.id : (isInterBuilding ? (t.transactionIdDest || undefined) : undefined),
      // Remember routing so deletes/updates know which books to touch
      sourceBookId: isInterBuilding ? fromParsed.bookId : (willCreateSingleTx ? (t.fromType === 'BUILDING' ? fromParsed.bookId : (t.toType === 'BUILDING' ? toParsed.bookId : activeBookId)) : activeBookId),
      destBookId: isInterBuilding ? toParsed.bookId : undefined,
      originBookId: activeBookId,
    });
    // Mirror the transfer document into every involved book (source, dest, active)
    transferBookIds.forEach(bk => {
      const ref = bookDoc(bk, 'transfers', primaryTransferRef.id);
      batch.set(ref, transferDoc as any);
    });
    if (txObj && txRef) batch.set(txRef, txObj as any);
    if (txObjDest && txRefDest) batch.set(txRefDest, txObjDest as any);
    await batch.commit();
    [txObj, txObjDest].filter(Boolean).forEach((linkedTx: any) => {
      runInBackground(() => syncSavedTransactionToAmlakSheets(linkedTx), 'Amlak Sheets treasury sync');
    });
    return {
      id: primaryTransferRef.id,
      transactionId: txRef ? txRef.id : undefined,
      transactionIdDest: txRefDest ? txRefDest.id : undefined,
    };
  } catch (e) {
    console.error('saveTransfer error', e);
    // fallback to original behaviour
    if (!t.id) return addDoc(fsCollection( "transfers"), data);
    return setDoc(fsDoc( "transfers", t.id), data);
  }
};

/**
 * Self-healing backfill: for every inter-building transfer, ensure BOTH the
 * source-EXPENSE and destination-INCOME transaction records exist in Firestore,
 * in the BOOK that each building belongs to. Older transfers that only wrote a
 * single transaction (or wrote both legs into a single book) get their missing
 * leg(s) created and/or relocated so each building's book is fully connected.
 *
 * Cross-book inter-building transfers are fully supported: composite building
 * ids of the form `${bookId}:${rawId}` are parsed, each leg is written to the
 * correct book, and the parent transfer document is mirrored into every
 * involved book so each book's Treasury tab surfaces the row.
 *
 * Returns the number of transaction documents created or relocated.
 */
export const backfillInterBuildingTransactions = async (): Promise<number> => {
  // Property books live on Mac Mini when VITE_DATA_BACKEND=mac — do not touch Firestore
  // (Listen/getDocs hang or 404 and would block History forever).
  if (useMacBackend()) return 0;
  try {
    const activeBookId = getCurrentBookId();

    // Collect every book we know about (admin-only can see all of them).
    let bookIds: string[] = [activeBookId];
    try {
      const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
      booksSnap.docs.forEach((d: any) => {
        if (!bookIds.includes(d.id)) bookIds.push(d.id);
      });
    } catch { /* ignore */ }
    if (!bookIds.includes('default')) bookIds.push('default');

    // Load transfers + transactions from every book in parallel
    const perBook = await Promise.all(bookIds.map(async (bk) => {
      try {
        const [trSnap, txSnap] = await Promise.all([
          getDocs(bookCol(bk, 'transfers')),
          getDocs(bookCol(bk, 'transactions')),
        ]);
        return {
          bookId: bk,
          transfers: trSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any), _bookId: bk })),
          transactions: txSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any), _bookId: bk })),
        };
      } catch {
        return { bookId: bk, transfers: [] as any[], transactions: [] as any[] };
      }
    }));

    // De-duplicate transfers by id (a cross-book transfer is mirrored into each
    // involved book, so it shows up multiple times). Pick the copy with the
    // richest routing metadata.
    const transferMap = new Map<string, any>();
    perBook.forEach(({ transfers }) => {
      (transfers || []).forEach((tr: any) => {
        if (!tr || tr.deleted) return;
        if (!(tr.fromType === 'BUILDING' && tr.toType === 'BUILDING' && tr.fromId && tr.toId && tr.fromId !== tr.toId)) return;
        const existing = transferMap.get(tr.id);
        if (!existing) transferMap.set(tr.id, tr);
        else {
          // Keep the copy that has more routing info
          const score = (x: any) => (x.sourceBookId ? 1 : 0) + (x.destBookId ? 1 : 0) + (x.transactionId ? 1 : 0) + (x.transactionIdDest ? 1 : 0);
          if (score(tr) > score(existing)) transferMap.set(tr.id, tr);
        }
      });
    });
    const interBuilding = Array.from(transferMap.values());
    if (interBuilding.length === 0) return 0;

    // All transactions keyed by transferId, with the book each one lives in.
    const allTxByTransferId = new Map<string, any[]>();
    perBook.forEach(({ transactions }) => {
      (transactions || []).forEach((tx: any) => {
        if (!tx || !tx.transferId) return;
        const list = allTxByTransferId.get(tx.transferId) || [];
        list.push(tx);
        allTxByTransferId.set(tx.transferId, list);
      });
    });

    const batch = writeBatch(assertDb());
    let created = 0;
    const norm = (v: any) => String(v || '').trim().toLowerCase();

    for (const tr of interBuilding) {
      // Figure out which books each side of the transfer belongs to.
      const fromParsed = parseCompositeBuildingId(tr.fromId, tr.sourceBookId || tr.originBookId || activeBookId);
      const toParsed = parseCompositeBuildingId(tr.toId, tr.destBookId || tr.sourceBookId || activeBookId);

      const linked = allTxByTransferId.get(tr.id) || [];

      // A leg is valid if the tx sits in the correct book AND has the raw
      // building id. Anything else we will repair.
      const validSource = linked.find((tx: any) =>
        tx._bookId === fromParsed.bookId && norm(tx.buildingId) === norm(fromParsed.rawId)
      );
      const validDest = linked.find((tx: any) =>
        tx._bookId === toParsed.bookId && norm(tx.buildingId) === norm(toParsed.rawId)
      );

      let hasSource = !!validSource;
      let hasDest = !!validDest;

      // Clean up mis-routed or legacy linked transactions. For each linked tx
      // that's not a valid leg, either re-use it as the missing leg (if it's
      // in the right book) or delete it so we can recreate it correctly.
      for (const tx of linked) {
        if (tx === validSource || tx === validDest) continue;

        // Case A: tx is in the SOURCE book but wrong buildingId → fix it to be the SOURCE leg
        if (!hasSource && tx._bookId === fromParsed.bookId) {
          batch.set(bookDoc(fromParsed.bookId, 'transactions', tx.id), sanitize({
            buildingId: fromParsed.rawId,
            buildingBookId: fromParsed.bookId,
            type: 'EXPENSE',
            expenseCategory: 'Inter-Building Transfer',
            expenseSubCategory: tr.toName || tr.toId || undefined,
            interBuildingRole: 'SOURCE',
            source: 'treasury',
            transferId: tr.id,
          }), { merge: true } as any);
          hasSource = true;
          created++;
          continue;
        }

        // Case B: tx is in the DEST book but wrong buildingId → fix it to be the DEST leg
        if (!hasDest && tx._bookId === toParsed.bookId) {
          batch.set(bookDoc(toParsed.bookId, 'transactions', tx.id), sanitize({
            buildingId: toParsed.rawId,
            buildingBookId: toParsed.bookId,
            type: 'INCOME',
            incomeSubType: 'OTHER',
            expenseCategory: 'Inter-Building Transfer',
            expenseSubCategory: tr.fromName || tr.fromId || undefined,
            interBuildingRole: 'DEST',
            source: 'treasury',
            transferId: tr.id,
          }), { merge: true } as any);
          hasDest = true;
          created++;
          continue;
        }

        // Case C: tx is in a completely wrong book (typical of legacy behaviour
        // that wrote BOTH legs into the active book). Remove it — we'll
        // recreate it below in the correct book.
        batch.delete(bookDoc(tx._bookId, 'transactions', tx.id));
        created++;
      }

      // Mirror the transfer doc into every involved book so each book's
      // Treasury tab surfaces it.
      const mirrorBooks = new Set<string>([activeBookId, fromParsed.bookId, toParsed.bookId]);
      if (tr.originBookId) mirrorBooks.add(tr.originBookId);

      const commonBase: any = {
        date: tr.date || new Date().toISOString().split('T')[0],
        amount: Number(tr.amount) || 0,
        paymentMethod: 'TREASURY',
        originalPaymentMethod: tr.paymentMethod || undefined,
        fromBankName: tr.fromBankName || (tr.paymentMethod === 'BANK' || tr.paymentMethod === 'CHEQUE' ? tr.bankName : undefined) || undefined,
        toBankName: tr.toBankName || undefined,
        bankName: tr.fromBankName || tr.bankName || undefined,
        fromType: tr.fromType,
        toType: tr.toType,
        fromId: tr.fromId,
        toId: tr.toId,
        fromName: tr.fromName || undefined,
        toName: tr.toName || undefined,
        purpose: tr.purpose || tr.notes || 'Inter-Building Transfer',
        details: tr.notes || tr.purpose || 'Inter-Building Transfer',
        status: tr.status || 'APPROVED',
        transferId: tr.id,
        createdBy: tr.createdBy,
        createdByName: tr.createdByName,
        createdAt: tr.createdAt || Date.now(),
        source: 'treasury',
      };

      let newTxId: string | undefined = validSource?.id;
      let newDestTxId: string | undefined = validDest?.id;

      if (!hasSource) {
        const txRef = tr.transactionId
          ? bookDoc(fromParsed.bookId, 'transactions', tr.transactionId)
          : bookDoc(fromParsed.bookId, 'transactions');
        newTxId = txRef.id;
        batch.set(txRef, sanitize({
          ...commonBase,
          id: newTxId,
          type: 'EXPENSE',
          expenseCategory: 'Inter-Building Transfer',
          expenseSubCategory: tr.toName || tr.toId || undefined,
          buildingId: fromParsed.rawId,
          buildingBookId: fromParsed.bookId,
          interBuildingRole: 'SOURCE',
          interBuildingPeerTxId: newDestTxId,
          interBuildingPeerBookId: toParsed.bookId,
        }));
        created++;
      }
      if (!hasDest) {
        const txRefDest = tr.transactionIdDest
          ? bookDoc(toParsed.bookId, 'transactions', tr.transactionIdDest)
          : bookDoc(toParsed.bookId, 'transactions');
        newDestTxId = txRefDest.id;
        batch.set(txRefDest, sanitize({
          ...commonBase,
          id: newDestTxId,
          type: 'INCOME',
          incomeSubType: 'OTHER',
          expenseCategory: 'Inter-Building Transfer',
          expenseSubCategory: tr.fromName || tr.fromId || undefined,
          buildingId: toParsed.rawId,
          buildingBookId: toParsed.bookId,
          interBuildingRole: 'DEST',
          interBuildingPeerTxId: newTxId,
          interBuildingPeerBookId: fromParsed.bookId,
        }));
        created++;
      }

      // Stamp routing metadata onto every mirror copy of the transfer.
      const transferPatch: any = {
        sourceBookId: fromParsed.bookId,
        destBookId: toParsed.bookId,
        originBookId: tr.originBookId || activeBookId,
      };
      if (newTxId) transferPatch.transactionId = newTxId;
      if (newDestTxId) transferPatch.transactionIdDest = newDestTxId;
      mirrorBooks.forEach(bk => {
        batch.set(bookDoc(bk, 'transfers', tr.id), transferPatch, { merge: true } as any);
      });
    }

    if (created > 0) await batch.commit();
    return created;
  } catch (e) {
    console.error('backfillInterBuildingTransactions error', e);
    return 0;
  }
};

/**
 * Collect every book that might hold a copy of this transfer or its linked txs.
 * Reads the active copy first, then probes mirror copies in source/dest books.
 */
const resolveTransferBooks = async (transferId: string): Promise<{
  transfer: any | null;
  transferBooks: string[];
  sourceTx: { id: string; bookId: string } | null;
  destTx: { id: string; bookId: string } | null;
}> => {
  const activeBookId = getCurrentBookId();
  // Primary lookup in the active book
  let tSnap = await getDoc(bookDoc(activeBookId, 'transfers', transferId)).catch(() => null);
  let t: any = tSnap && tSnap.exists() ? { id: tSnap.id, ...(tSnap.data() as any) } : null;

  // If we couldn't find it in the active book, probe every known book.
  let booksList: string[] = [];
  if (!t) {
    try {
      const booksSnap = await getDocs(_colRef(assertDb(), 'books'));
      booksList = booksSnap.docs.map((d: any) => d.id);
    } catch { /* ignore */ }
    for (const bk of booksList) {
      if (bk === activeBookId) continue;
      const snap = await getDoc(bookDoc(bk, 'transfers', transferId)).catch(() => null);
      if (snap && snap.exists()) {
        t = { id: snap.id, ...(snap.data() as any) };
        break;
      }
    }
  }

  const transferBooks = new Set<string>([activeBookId]);
  if (t) {
    if (t.originBookId) transferBooks.add(t.originBookId);
    if (t.sourceBookId) transferBooks.add(t.sourceBookId);
    if (t.destBookId) transferBooks.add(t.destBookId);
  }
  // Belt-and-braces: also add the other books we discovered while probing.
  booksList.forEach(b => transferBooks.add(b));

  const sourceTx = t && t.transactionId
    ? { id: t.transactionId, bookId: t.sourceBookId || t.originBookId || activeBookId }
    : null;
  const destTx = t && t.transactionIdDest
    ? { id: t.transactionIdDest, bookId: t.destBookId || t.sourceBookId || activeBookId }
    : null;

  return { transfer: t, transferBooks: Array.from(transferBooks), sourceTx, destTx };
};

export const deleteTransfer = async (id: string) => {
  if (useMacCollection('transfers')) {
    await macDelete('transfers', id);
    return true;
  }
  try {
    const { transfer, transferBooks, sourceTx, destTx } = await resolveTransferBooks(id);
    const batch = writeBatch(assertDb());
    // Delete every mirrored copy of the transfer
    transferBooks.forEach(bk => batch.delete(bookDoc(bk, 'transfers', id)));
    if (transfer) {
      if (sourceTx) batch.delete(bookDoc(sourceTx.bookId, 'transactions', sourceTx.id));
      if (destTx) batch.delete(bookDoc(destTx.bookId, 'transactions', destTx.id));
    }
    await batch.commit();
    return true;
  } catch (e) {
    console.error('deleteTransfer error', e);
    return deleteDoc(fsDoc( 'transfers', id));
  }
};

// Soft-delete a transfer document (and its linked transactions) across every
// book that holds a mirror copy, so the deletion propagates to both sides.
export const softDeleteTransfer = async (transferId: string, deletedBy?: string) => {
  if (useMacCollection('transfers')) {
    await macSave('transfers', { id: transferId, deleted: true, deletedAt: Date.now(), deletedBy: deletedBy || 'SYSTEM' }, currentBookId, true);
    return;
  }
  try {
    const { transferBooks, sourceTx, destTx } = await resolveTransferBooks(transferId);
    const patch = { deleted: true, deletedAt: Date.now(), deletedBy: deletedBy || 'SYSTEM' };
    const batch = writeBatch(assertDb());
    transferBooks.forEach(bk => batch.set(bookDoc(bk, 'transfers', transferId), patch, { merge: true } as any));
    if (sourceTx) batch.set(bookDoc(sourceTx.bookId, 'transactions', sourceTx.id), patch, { merge: true } as any);
    if (destTx) batch.set(bookDoc(destTx.bookId, 'transactions', destTx.id), patch, { merge: true } as any);
    await batch.commit();
  } catch (e) {
    console.error('softDeleteTransfer error', e);
    await setDoc(fsDoc( 'transfers', transferId), { deleted: true, deletedAt: Date.now(), deletedBy: deletedBy || 'SYSTEM' }, { merge: true } as any);
  }
};
export const restoreTransfer = async (transferId: string) => {
  if (useMacCollection('transfers')) {
    await macSave('transfers', { id: transferId, deleted: false, deletedAt: null, deletedBy: null }, currentBookId, true);
    return;
  }
  try {
    const { transferBooks, sourceTx, destTx } = await resolveTransferBooks(transferId);
    const patch = { deleted: false, deletedAt: null, deletedBy: null };
    const batch = writeBatch(assertDb());
    transferBooks.forEach(bk => batch.set(bookDoc(bk, 'transfers', transferId), patch, { merge: true } as any));
    if (sourceTx) batch.set(bookDoc(sourceTx.bookId, 'transactions', sourceTx.id), patch, { merge: true } as any);
    if (destTx) batch.set(bookDoc(destTx.bookId, 'transactions', destTx.id), patch, { merge: true } as any);
    await batch.commit();
  } catch (e) {
    console.error('restoreTransfer error', e);
    await setDoc(fsDoc( 'transfers', transferId), { deleted: false, deletedAt: null, deletedBy: null }, { merge: true } as any);
  }
};

// ---- Service Agreements ----
export const getServiceAgreements = async (opts?: { includeDeleted?: boolean }) => {
  return getCollection("service_agreements", { includeDeleted: !!opts?.includeDeleted });
};
export const saveServiceAgreement = async (a: any) => {
  const data = sanitize(a);
  if (useMacCollection('service_agreements')) return macSave('service_agreements', data);
  if (!a.id) return addDoc(fsCollection( "service_agreements"), data);
  return setDoc(fsDoc( "service_agreements", a.id), data);
};
export const deleteServiceAgreement = async (id: string) => {
  if (useMacCollection('service_agreements')) return macDelete('service_agreements', id);
  return deleteDoc(fsDoc( "service_agreements", id));
};

// ---- Backup Management (Firestore) ----
export interface BackupRecord { id: string; timestamp: string; date: string; size: number; data: string; createdAt: number; }
export const saveBackupToFirestore = async (backupData: string) => {
  try {
    const now = new Date();
    const backupRecord = {
      id: `backup_${Date.now()}`,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      size: new Blob([backupData]).size,
      data: backupData,
      createdAt: Date.now()
    };

    if (useMacCollection('backups')) {
      await macSave('backups', backupRecord, currentBookId, true);
      return backupRecord;
    }
    await setDoc(fsDoc( 'backups', backupRecord.id), backupRecord);
    return backupRecord;
  } catch (e) {
    console.error('Failed to save backup to Firestore:', e);
    throw e;
  }
};

export const getBackupsFromFirestore = async (): Promise<BackupRecord[]> => {
  if (useMacCollection('backups')) {
    const backups = await macListCollection<BackupRecord>('backups', { bookId: currentBookId, includeDeleted: false });
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  try {
    const snap = await getDocs(fsCollection( 'backups'));
    const backups = snap.docs.map(d => d.data() as BackupRecord).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return backups;
  } catch (e) {
    console.error('Failed to get backups from Firestore:', e);
    return [];
  }
};

export const deleteBackupFromFirestore = async (id: string) => {
  try {
    if (useMacCollection('backups')) {
      await macDelete('backups', id);
      return;
    }
    await deleteDoc(fsDoc( 'backups', id));
  } catch (e) {
    console.error('Failed to delete backup:', e);
    throw e;
  }
};

export const restoreFromFirestoreBackup = async (backupId: string) => {
  try {
    if (useMacCollection('backups')) {
      const backup = await macGetDocument<BackupRecord>('backups', backupId, { bookId: currentBookId, includeDeleted: true });
      if (!backup) throw new Error('Backup not found');
      return await restoreBackup(backup.data);
    }
    const snap = await getDoc(fsDoc( 'backups', backupId));
    if (!snap.exists()) throw new Error('Backup not found');
    
    const backup = snap.data() as BackupRecord;
    return await restoreBackup(backup.data);
  } catch (e) {
    console.error('Failed to restore backup:', e);
    return false;
  }
};

// ---- Book (Partition) Management ----
// Books are stored in the top-level 'books' collection (never scoped).
export interface BookRecord { id: string; name: string; nameAr?: string; createdAt?: number; updatedAt?: number; }

export const getBooks = async (): Promise<BookRecord[]> => {
  if (useMacCollection('books')) {
    return macListCollection<BookRecord>('books', { bookId: 'default', includeDeleted: false });
  }
  try {
    const snap = await getDocs(_colRef(assertDb(), 'books'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as BookRecord);
  } catch (e: any) {
    const code = String(e?.code || '');
    if (code !== 'permission-denied') {
      console.error('getBooks error', e);
    }
    return [];
  }
};

/**
 * All buildings from every book for pickers (e.g. owner stake on staff).
 * Same id rules as Treasury: active book uses raw `id`; other books use `${bookId}:${rawId}`.
 */

export const getTransactionsAllBooks = async (opts?: { includeDeleted?: boolean }): Promise<any[]> => {
  const activeBookId = getCurrentBookId();
  const includeDeleted = !!opts?.includeDeleted;
  const firestoreBooks = await getBooks();
  let bookList: { id: string; name: string }[] = firestoreBooks.map(b => ({ id: b.id, name: b.name || b.id }));
  if (!bookList.some(b => b.id === 'default')) bookList.unshift({ id: 'default', name: 'Main Book' });

  if (useMacBackend()) {
    const perBook = await Promise.all(
      bookList.map(async (bk) => {
        try {
          const rows = await macListCollection('transactions', {
            bookId: bk.id,
            includeDeleted,
            orderField: 'date',
          });
          return rows
            .filter((t: any) => includeDeleted || !t.deleted)
            .map((t: any) => {
              const rawBuildingId = t.buildingId;
              const compositeBuildingId = rawBuildingId && bk.id !== activeBookId ? `${bk.id}:${rawBuildingId}` : rawBuildingId;
              return {
                ...t,
                _sourceBookId: bk.id,
                _bookId: bk.id,
                _bookName: bk.name || bk.id,
                buildingId: compositeBuildingId,
              };
            });
        } catch {
          return [];
        }
      }),
    );
    return perBook.flat();
  }
  
  const perBook = await Promise.all(
    bookList.map(async bk => {
      try {
        const path = rawBookPath(bk.id, 'transactions');
        const snap = await getDocs(_colRef(assertDb(), path) as any);
        return toArray(snap)
          .filter((t: any) => includeDeleted || !t.deleted)
          .map((t: any) => {
            const rawBuildingId = t.buildingId;
            const compositeBuildingId = rawBuildingId && bk.id !== activeBookId ? `${bk.id}:${rawBuildingId}` : rawBuildingId;
            return {
              ...t,
              _sourceBookId: bk.id,
              _bookId: bk.id,
              _bookName: bk.name || bk.id,
              buildingId: compositeBuildingId,
            };
          });
      } catch (e) { return []; }
    })
  );
  return perBook.flat();
};

export const getContractsAllBooks = async (opts?: { includeDeleted?: boolean }): Promise<any[]> => {
  const activeBookId = getCurrentBookId();
  const includeDeleted = !!opts?.includeDeleted;
  const firestoreBooks = await getBooks();
  let bookList: { id: string; name: string }[] = firestoreBooks.map(b => ({ id: b.id, name: b.name || b.id }));
  if (!bookList.some(b => b.id === 'default')) bookList.unshift({ id: 'default', name: 'Main Book' });

  if (useMacBackend()) {
    const perBook = await Promise.all(
      bookList.map(async (bk) => {
        try {
          const rows = await macListCollection('contracts', { bookId: bk.id, includeDeleted });
          return rows
            .filter((c: any) => includeDeleted || !c.deleted)
            .map((c: any) => {
              const rawBuildingId = c.buildingId;
              const compositeBuildingId = rawBuildingId && bk.id !== activeBookId ? `${bk.id}:${rawBuildingId}` : rawBuildingId;
              return { ...c, _sourceBookId: bk.id, buildingId: compositeBuildingId };
            });
        } catch {
          return [];
        }
      }),
    );
    return perBook.flat();
  }
  
  const perBook = await Promise.all(
    bookList.map(async bk => {
      try {
        const path = rawBookPath(bk.id, 'contracts');
        const snap = await getDocs(_colRef(assertDb(), path) as any);
        return toArray(snap)
          .filter((c: any) => includeDeleted || !c.deleted)
          .map((c: any) => {
            const rawBuildingId = c.buildingId;
            const compositeBuildingId = rawBuildingId && bk.id !== activeBookId ? `${bk.id}:${rawBuildingId}` : rawBuildingId;
            return { ...c, _sourceBookId: bk.id, buildingId: compositeBuildingId };
          });
      } catch (e) { return []; }
    })
  );
  return perBook.flat();
};

export const getTransfersAllBooks = async (opts?: { includeDeleted?: boolean }): Promise<any[]> => {
  const activeBookId = getCurrentBookId();
  const includeDeleted = !!opts?.includeDeleted;
  const firestoreBooks = await getBooks();
  let bookList: { id: string; name: string }[] = firestoreBooks.map(b => ({ id: b.id, name: b.name || b.id }));
  if (!bookList.some(b => b.id === 'default')) bookList.unshift({ id: 'default', name: 'Main Book' });

  if (useMacBackend()) {
    const perBook = await Promise.all(
      bookList.map(async (bk) => {
        try {
          const rows = await macListCollection('transfers', { bookId: bk.id, includeDeleted });
          return rows
            .filter((tr: any) => includeDeleted || !tr.deleted)
            .map((tr: any) => {
              const trData = {
                ...tr,
                _sourceBookId: bk.id,
                _bookId: bk.id,
                _bookName: bk.name || bk.id,
              };
              if (trData.fromType === 'BUILDING' && trData.fromId && bk.id !== activeBookId) {
                trData.fromId = `${bk.id}:${trData.fromId}`;
              }
              if (trData.toType === 'BUILDING' && trData.toId && bk.id !== activeBookId) {
                trData.toId = `${bk.id}:${trData.toId}`;
              }
              return trData;
            });
        } catch {
          return [];
        }
      }),
    );
    return perBook.flat();
  }
  
  const perBook = await Promise.all(
    bookList.map(async bk => {
      try {
        const path = rawBookPath(bk.id, 'transfers');
        const snap = await getDocs(_colRef(assertDb(), path) as any);
        return toArray(snap)
          .filter((tr: any) => includeDeleted || !tr.deleted)
          .map((tr: any) => {
            const trData = {
              ...tr,
              _sourceBookId: bk.id,
              _bookId: bk.id,
              _bookName: bk.name || bk.id,
            };
            if (trData.fromType === 'BUILDING' && trData.fromId && bk.id !== activeBookId) {
              trData.fromId = `${bk.id}:${trData.fromId}`;
            }
            if (trData.toType === 'BUILDING' && trData.toId && bk.id !== activeBookId) {
              trData.toId = `${bk.id}:${trData.toId}`;
            }
            return trData;
          });
      } catch (e) { return []; }
    })
  );
  return perBook.flat();
};

export const getBuildingsAllBooks = async (opts?: { includeDeleted?: boolean }): Promise<any[]> => {
  const activeBookId = getCurrentBookId();
  const includeDeleted = !!opts?.includeDeleted;
  const firestoreBooks = await getBooks();
  let bookList: { id: string; name: string }[] = firestoreBooks.map(b => ({ id: b.id, name: b.name || b.id }));
  if (!bookList.some(b => b.id === 'default')) {
    bookList.unshift({ id: 'default', name: 'Main Book' });
  }
  const seenBook = new Set<string>();
  bookList = bookList.filter(b => {
    if (seenBook.has(b.id)) return false;
    seenBook.add(b.id);
    return true;
  });

  const extractNumber = (name: string) => {
    const match = (name || '').match(/(\d+)/g);
    if (!match || match.length === 0) return null;
    return parseInt(match[match.length - 1], 10);
  };

  const perBook = await Promise.all(
    bookList.map(async bk => {
      try {
        const path = rawBookPath(bk.id, 'buildings');
        const snap = await getDocs(_colRef(assertDb(), path));
        return snap.docs
          .map((d: any) => {
            const raw = { id: d.id, ...(d.data() as any) };
            if (!includeDeleted && raw.deleted) return null;
            const rawId = d.id;
            const id = bk.id === activeBookId ? rawId : `${bk.id}:${rawId}`;
            return {
              ...raw,
              id,
              _sourceBookId: bk.id,
              _rawBuildingId: rawId,
              _bookDisplayName: bk.name,
            };
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    }),
  );

  const flat = perBook.flat() as any[];
  flat.sort((a: any, b: any) => {
    const bookCmp = String(a._sourceBookId || '').localeCompare(String(b._sourceBookId || ''));
    if (bookCmp !== 0) return bookCmp;
    const nameA = a?.name || '';
    const nameB = b?.name || '';
    const numA = extractNumber(nameA);
    const numB = extractNumber(nameB);
    if (numA !== null && numB !== null && numA !== numB) return numA - numB;
    if (numA !== null && numB === null) return -1;
    if (numA === null && numB !== null) return 1;
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
  return flat;
};

export const saveBook = async (book: Partial<BookRecord> & { name: string }): Promise<BookRecord> => {
  const data = sanitize({ ...book, updatedAt: Date.now() });
  if (useMacCollection('books')) {
    return macSave('books', data, 'default', !!book.id) as Promise<BookRecord>;
  }
  if (book.id) {
    await setDoc(_docRef(assertDb(), 'books', book.id), data, { merge: true } as any);
    return { id: book.id, ...data } as BookRecord;
  }
  const ref = await addDoc(_colRef(assertDb(), 'books'), data);
  return { id: ref.id, ...data } as BookRecord;
};

export const deleteBook = async (id: string): Promise<void> => {
  if (useMacCollection('books')) {
    await macDelete('books', id, 'default');
    return;
  }
  await deleteDoc(_docRef(assertDb(), 'books', id));
};

// ---- SADAD Bills ----
export const getSadadBills = async () => {  return getCollection('sadad_bills', 'dueDate'); };
export const saveSadadBill = async (b: any) => {
  const data = sanitize(b);
  if (useMacCollection('sadad_bills')) return macSaveId('sadad_bills', data);
  if (!b.id) { const ref = await addDoc(fsCollection( 'sadad_bills'), data); return ref.id; }
  await setDoc(fsDoc( 'sadad_bills', b.id), data);
  return b.id;
};
export const deleteSadadBill = async (id: string) => {
  if (useMacCollection('sadad_bills')) return macDelete('sadad_bills', id);
  return deleteDoc(fsDoc( 'sadad_bills', id));
};

// ---- Ejar Contracts ----
export const getEjarContracts = async () => {  return getCollection('ejar_contracts', 'registrationDate'); };
export const saveEjarContract = async (c: any) => {
  const data = sanitize(c);
  if (useMacCollection('ejar_contracts')) return macSaveId('ejar_contracts', data);
  if (!c.id) { const ref = await addDoc(fsCollection( 'ejar_contracts'), data); return ref.id; }
  await setDoc(fsDoc( 'ejar_contracts', c.id), data);
  return c.id;
};
export const deleteEjarContract = async (id: string) => {
  if (useMacCollection('ejar_contracts')) return macDelete('ejar_contracts', id);
  return deleteDoc(fsDoc( 'ejar_contracts', id));
};

// ---- Utility Readings ----
export const getUtilityReadings = async () => {  return getCollection('utility_readings', 'readingDate'); };
export const saveUtilityReading = async (r: any) => {
  const data = sanitize(r);
  if (useMacCollection('utility_readings')) return macSaveId('utility_readings', data);
  if (!r.id) { const ref = await addDoc(fsCollection( 'utility_readings'), data); return ref.id; }
  await setDoc(fsDoc( 'utility_readings', r.id), data);
  return r.id;
};
export const deleteUtilityReading = async (id: string) => {
  if (useMacCollection('utility_readings')) return macDelete('utility_readings', id);
  return deleteDoc(fsDoc( 'utility_readings', id));
};

// ---- Security Deposits ----
export const getSecurityDeposits = async () => {  return getCollection('security_deposits', 'depositDate'); };
export const saveSecurityDeposit = async (d: any) => {
  const data = sanitize(d);
  if (useMacCollection('security_deposits')) return macSaveId('security_deposits', data);
  if (!d.id) { const ref = await addDoc(fsCollection( 'security_deposits'), data); return ref.id; }
  await setDoc(fsDoc( 'security_deposits', d.id), data);
  return d.id;
};
export const deleteSecurityDeposit = async (id: string) => {
  if (useMacCollection('security_deposits')) return macDelete('security_deposits', id);
  return deleteDoc(fsDoc( 'security_deposits', id));
};

// ---- WhatsApp Messages ----
export const getWhatsAppMessages = async () => {  return getCollection('whatsapp_messages', 'createdAt'); };
export const saveWhatsAppMessage = async (m: any) => {
  const data = sanitize(m);
  if (useMacCollection('whatsapp_messages')) return macSaveId('whatsapp_messages', data);
  if (!m.id) { const ref = await addDoc(fsCollection( 'whatsapp_messages'), data); return ref.id; }
  await setDoc(fsDoc( 'whatsapp_messages', m.id), data);
  return m.id;
};
export const deleteWhatsAppMessage = async (id: string) => {
  if (useMacCollection('whatsapp_messages')) return macDelete('whatsapp_messages', id);
  return deleteDoc(fsDoc( 'whatsapp_messages', id));
};

// WhatsApp Config (singleton)
export const getWhatsAppConfig = async (): Promise<any> => {
  if (useMacCollection('meta')) {
    return macGetDocument('meta', 'whatsapp_config', { bookId: currentBookId, includeDeleted: true });
  }
  try {
    const snap = await getDoc(fsDoc( 'meta', 'whatsapp_config'));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
};
export const saveWhatsAppConfig = async (c: any) => {
  if (useMacCollection('meta')) return macSave('meta', { ...sanitize(c), id: 'whatsapp_config' }, currentBookId, true);
  return setDoc(fsDoc( 'meta', 'whatsapp_config'), sanitize(c));
};

// ---- Bank Statements / Reconciliation ----
export const getBankStatements = async () => {  return getCollection('bank_statements', 'transactionDate'); };
export const saveBankStatement = async (s: any) => {
  const data = sanitize(s);
  if (useMacCollection('bank_statements')) return macSaveId('bank_statements', data);
  if (!s.id) { const ref = await addDoc(fsCollection( 'bank_statements'), data); return ref.id; }
  await setDoc(fsDoc( 'bank_statements', s.id), data);
  return s.id;
};
export const deleteBankStatement = async (id: string) => {
  if (useMacCollection('bank_statements')) return macDelete('bank_statements', id);
  return deleteDoc(fsDoc( 'bank_statements', id));
};
export const getReconciliationRecords = async () => {  return getCollection('reconciliation_records', 'createdAt'); };
export const saveReconciliationRecord = async (r: any) => {
  const data = sanitize(r);
  if (useMacCollection('reconciliation_records')) return macSaveId('reconciliation_records', data);
  if (!r.id) { const ref = await addDoc(fsCollection( 'reconciliation_records'), data); return ref.id; }
  await setDoc(fsDoc( 'reconciliation_records', r.id), data);
  return r.id;
};

// ---- Nafath Verification ----
export const getNafathVerifications = async () => {  return getCollection('nafath_verifications', 'createdAt'); };
export const saveNafathVerification = async (v: any) => {
  const data = sanitize(v);
  if (useMacCollection('nafath_verifications')) return macSaveId('nafath_verifications', data);
  if (!v.id) { const ref = await addDoc(fsCollection( 'nafath_verifications'), data); return ref.id; }
  await setDoc(fsDoc( 'nafath_verifications', v.id), data);
  return v.id;
};
export const deleteNafathVerification = async (id: string) => {
  if (useMacCollection('nafath_verifications')) return macDelete('nafath_verifications', id);
  return deleteDoc(fsDoc( 'nafath_verifications', id));
};

// ---- Municipality Licenses ----
export const getMunicipalityLicenses = async () => {  return getCollection('municipality_licenses', 'expiryDate'); };
export const saveMunicipalityLicense = async (l: any) => {
  const data = sanitize(l);
  if (useMacCollection('municipality_licenses')) return macSaveId('municipality_licenses', data);
  if (!l.id) { const ref = await addDoc(fsCollection( 'municipality_licenses'), data); return ref.id; }
  await setDoc(fsDoc( 'municipality_licenses', l.id), data);
  return l.id;
};
export const deleteMunicipalityLicense = async (id: string) => {
  if (useMacCollection('municipality_licenses')) return macDelete('municipality_licenses', id);
  return deleteDoc(fsDoc( 'municipality_licenses', id));
};

// ---- Civil Defense Records ----
export const getCivilDefenseRecords = async () => {  return getCollection('civil_defense_records', 'expiryDate'); };
export const saveCivilDefenseRecord = async (r: any) => {
  const data = sanitize(r);
  if (useMacCollection('civil_defense_records')) return macSaveId('civil_defense_records', data);
  if (!r.id) { const ref = await addDoc(fsCollection( 'civil_defense_records'), data); return ref.id; }
  await setDoc(fsDoc( 'civil_defense_records', r.id), data);
  return r.id;
};
export const deleteCivilDefenseRecord = async (id: string) => {
  if (useMacCollection('civil_defense_records')) return macDelete('civil_defense_records', id);
  return deleteDoc(fsDoc( 'civil_defense_records', id));
};

// ---- Absher Records ----
export const getAbsherRecords = async () => {  return getCollection('absher_records', 'createdAt'); };
export const saveAbsherRecord = async (r: any) => {
  const data = sanitize(r);
  if (useMacCollection('absher_records')) return macSaveId('absher_records', data);
  if (!r.id) { const ref = await addDoc(fsCollection( 'absher_records'), data); return ref.id; }
  await setDoc(fsDoc( 'absher_records', r.id), data);
  return r.id;
};
export const deleteAbsherRecord = async (id: string) => {
  if (useMacCollection('absher_records')) return macDelete('absher_records', id);
  return deleteDoc(fsDoc( 'absher_records', id));
};

import { Building, Contract, Customer, Transaction, User, UserRole, Vendor, Task, Bank, TransactionType, PaymentMethod, TransactionStatus, TaskStatus, SystemSettings, AuditLog } from "../types";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";

// Keep the same storage keys so existing components continue to work synchronously
const KEYS = {
    TRANSACTIONS: 'prop_mgr_transactions',
    CUSTOMERS: 'prop_mgr_customers',
    BUILDINGS: 'prop_mgr_buildings',
    USERS: 'prop_mgr_users',
    CONTRACTS: 'prop_mgr_contracts',
    VENDORS: 'prop_mgr_vendors',
    TASKS: 'prop_mgr_tasks',
    BANKS: 'prop_mgr_banks',
    SETTINGS: 'prop_mgr_settings',
    AUDIT: 'prop_mgr_audit'
};

const safeParse = (key: string, fallback: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.error(`Error parsing ${key} from localStorage`, e);
        return fallback;
    }
};

// Background sync helpers: fetch collection and write to localStorage
const syncCollection = async (colName: string, storageKey: string, orderField?: string) => {
    try {
        const colRef = collection(db, colName);
        const q = orderField ? query(colRef, orderBy(orderField, 'desc')) : colRef;
        const snap = await getDocs(q as any);
        const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        localStorage.setItem(storageKey, JSON.stringify(arr));
    } catch (e) {
        console.warn(`Failed to sync ${colName}:`, e);
    }
};

export const setupMockData = async () => {
    // one-time: attempt to sync main collections into localStorage
    await Promise.all([
        syncCollection('transactions', KEYS.TRANSACTIONS, 'date'),
        syncCollection('customers', KEYS.CUSTOMERS),
        syncCollection('buildings', KEYS.BUILDINGS),
        syncCollection('users', KEYS.USERS),
        syncCollection('contracts', KEYS.CONTRACTS),
        syncCollection('vendors', KEYS.VENDORS),
        syncCollection('tasks', KEYS.TASKS),
        syncCollection('banks', KEYS.BANKS),
    ]).catch(() => {});
    // settings and audit left as localStorage-managed until needed
};

export const logAction = (userId: string, action: string, details: string) => {
    const logs = getAuditLogs();
    logs.unshift({ id: crypto.randomUUID(), userId, action, details, timestamp: Date.now() });
    if (logs.length > 100) logs.pop();
    localStorage.setItem(KEYS.AUDIT, JSON.stringify(logs));
    // also write to Firestore (best-effort)
    const docRef = doc(collection(db, 'audit'));
    setDoc(docRef, { id: docRef.id, userId, action, details, timestamp: Date.now() }).catch(() => {});
};

export const getAuditLogs = (): AuditLog[] => safeParse(KEYS.AUDIT, []);

export const getSettings = (): SystemSettings => safeParse(KEYS.SETTINGS, {
    companyName: 'Amlak Management - powered by RR GROUP',
    currency: 'SAR',
    darkMode: false,
    compactMode: false,
    expenseBudgetLimit: 50000,
    openingCashBalance: 0,
    openingBankBalance: 0,
    openingBalancesByBuilding: {},
    whatsappTemplate: 'Dear {name}, rent of {amount} is due for {unit}.'
});

export const saveSettings = (s: SystemSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s));
    const docRef = doc(db, 'meta', 'settings');
    setDoc(docRef, s).catch(() => {});
};

export const generateBackup = () => {
    const backup = {
        transactions: localStorage.getItem(KEYS.TRANSACTIONS),
        customers: localStorage.getItem(KEYS.CUSTOMERS),
        contracts: localStorage.getItem(KEYS.CONTRACTS),
        buildings: localStorage.getItem(KEYS.BUILDINGS),
        users: localStorage.getItem(KEYS.USERS),
        vendors: localStorage.getItem(KEYS.VENDORS),
        settings: localStorage.getItem(KEYS.SETTINGS),
        timestamp: new Date().toISOString()
    };
    const settings = getSettings();
    (settings as any).lastBackupDate = new Date().toISOString();
    saveSettings(settings);
    return JSON.stringify(backup);
};

export const restoreBackup = (jsonString: string) => {
    try {
        const backup = JSON.parse(jsonString);
        if (backup.transactions) localStorage.setItem(KEYS.TRANSACTIONS, backup.transactions);
        if (backup.customers) localStorage.setItem(KEYS.CUSTOMERS, backup.customers);
        if (backup.contracts) localStorage.setItem(KEYS.CONTRACTS, backup.contracts);
        if (backup.buildings) localStorage.setItem(KEYS.BUILDINGS, backup.buildings);
        if (backup.users) localStorage.setItem(KEYS.USERS, backup.users);
        if (backup.vendors) localStorage.setItem(KEYS.VENDORS, backup.vendors);
        if (backup.settings) localStorage.setItem(KEYS.SETTINGS, backup.settings);
        return true;
    } catch (e) {
        console.error('Restore failed', e);
        return false;
    }
};

export const resetSystem = () => {
    localStorage.clear();
    window.location.reload();
};

export const getOccupancyStats = () => {
    const buildings = getBuildings();
    const contracts = getContracts().filter((c: Contract) => c.status === 'Active');
    let totalUnits = 0;
    buildings.forEach((b: Building) => (totalUnits += b.units.length));
    const occupiedUnits = contracts.length;
    const percentage = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    return { totalUnits, occupiedUnits, percentage };
};

// ===== Transactions =====
export const getTransactions = (): Transaction[] => safeParse(KEYS.TRANSACTIONS, []);
export const saveTransaction = (t: Transaction) => {
    const list = getTransactions();
    const idx = list.findIndex((x: Transaction) => x.id === t.id);
    if (idx >= 0) list[idx] = t;
    else list.push(t);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
    // persist to Firestore (best-effort)
    const id = t.id || crypto.randomUUID();
    setDoc(doc(db, 'transactions', id), { ...t, id }).catch(() => {});
    // business logic preserved locally
    if (t.type === TransactionType.INCOME && t.expenseCategory === 'Rent Payment') {
        const tasks = getTasks();
        const relatedTask = tasks.find(tsk => t.details?.includes(tsk.title || ''));
        if (relatedTask) deleteTask(relatedTask.id);
    }
};

export const updateTransactionStatus = (id: string, status: TransactionStatus) => {
    const txs = getTransactions();
    const tx = txs.find(t => t.id === id);
    if (tx) {
        if (status === 'APPROVED' && tx.status === 'PENDING') {
            const net = tx.amount + (tx.extraAmount || 0) - (tx.discountAmount || 0);
            tx.amount = net;
        }
        tx.status = status;
        if (status === 'REJECTED') {
            const idx = txs.indexOf(tx);
            txs.splice(idx, 1);
        }
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
        // persist status
        setDoc(doc(db, 'transactions', id), tx as any).catch(() => {});
    }
};

export const deleteTransaction = (id: string) => {
    const list = getTransactions().filter(t => t.id !== id);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(list));
    deleteDoc(doc(db, 'transactions', id)).catch(() => {});
};

// ===== Buildings =====
export const getBuildings = (): Building[] => safeParse(KEYS.BUILDINGS, []);
export const saveBuilding = (b: Building) => {
    const list = getBuildings();
    const idx = list.findIndex((x: Building) => x.id === b.id);
    if (idx >= 0) list[idx] = b;
    else list.push(b);
    localStorage.setItem(KEYS.BUILDINGS, JSON.stringify(list));
    const id = b.id || crypto.randomUUID();
    setDoc(doc(db, 'buildings', id), { ...b, id }).catch(() => {});
};
export const deleteBuilding = (id: string) => {
    const list = getBuildings().filter((b: Building) => b.id !== id);
    localStorage.setItem(KEYS.BUILDINGS, JSON.stringify(list));
    deleteDoc(doc(db, 'buildings', id)).catch(() => {});
};

// ===== Customers =====
export const getCustomers = (): Customer[] => safeParse(KEYS.CUSTOMERS, []);
export const saveCustomer = (c: Customer) => {
    const list = getCustomers();
    const idx = list.findIndex((x: Customer) => x.id === c.id);
    if (idx >= 0) list[idx] = c;
    else list.push(c);
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(list));
    const id = c.id || crypto.randomUUID();
    setDoc(doc(db, 'customers', id), { ...c, id }).catch(() => {});
};
export const deleteCustomer = (id: string) => {
    const list = getCustomers().filter((c: Customer) => c.id !== id);
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(list));
    deleteDoc(doc(db, 'customers', id)).catch(() => {});
};

// ===== Users =====
export const getUsers = (): User[] => safeParse(KEYS.USERS, []);
export const saveUser = (u: User) => {
    const list = getUsers();
    const idx = list.findIndex((x: User) => x.id === u.id);
    if (idx >= 0) list[idx] = u;
    else list.push(u);
    localStorage.setItem(KEYS.USERS, JSON.stringify(list));
    const id = u.id || crypto.randomUUID();
    setDoc(doc(db, 'users', id), { ...u, id }).catch(() => {});
};
export const deleteUser = (id: string) => {
    const list = getUsers().filter((u: User) => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(list));
    deleteDoc(doc(db, 'users', id)).catch(() => {});
};

export const mockLogin = async (id: string, pass: string) => {
    // keep behaviour: check localStorage users
    await Promise.resolve();
    const users = getUsers();
    return users.find((u: User) => u.id === id && (u as any).password === pass && u.hasSystemAccess !== false);
};

// ===== Banks =====
export const getBanks = () => safeParse(KEYS.BANKS, [] as Bank[]);
export const saveBank = (b: Bank) => {
    const list = getBanks();
    const idx = list.findIndex((x: Bank) => x.name === b.name);
    if (idx >= 0) list[idx] = b;
    else list.push(b);
    localStorage.setItem(KEYS.BANKS, JSON.stringify(list));
    const id = b.name;
    setDoc(doc(db, 'banks', id), { ...b, id }).catch(() => {});
};

// ===== Vendors =====
export const getVendors = (): Vendor[] => safeParse(KEYS.VENDORS, []);
export const saveVendor = (v: Vendor) => {
    const list = getVendors();
    const idx = list.findIndex((x: Vendor) => x.id === v.id);
    if (idx >= 0) list[idx] = v;
    else list.push(v);
    localStorage.setItem(KEYS.VENDORS, JSON.stringify(list));
    const id = v.id || crypto.randomUUID();
    setDoc(doc(db, 'vendors', id), { ...v, id }).catch(() => {});
};
export const deleteVendor = (id: string) => {
    const list = getVendors().filter((v: Vendor) => v.id !== id);
    localStorage.setItem(KEYS.VENDORS, JSON.stringify(list));
    deleteDoc(doc(db, 'vendors', id)).catch(() => {});
};

// ===== Tasks =====
export const getTasks = (uid?: string): Task[] => {
    const all = safeParse(KEYS.TASKS, [] as Task[]);
    return uid ? all.filter((t: Task) => t.userId === uid) : all;
};
export const saveTask = (t: Task) => {
    const list = getTasks();
    const idx = list.findIndex((x: Task) => x.id === t.id);
    if (idx >= 0) list[idx] = t;
    else list.push(t);
    localStorage.setItem(KEYS.TASKS, JSON.stringify(list));
    const id = t.id || crypto.randomUUID();
    setDoc(doc(db, 'tasks', id), { ...t, id }).catch(() => {});
};
export const deleteTask = (id: string) => {
    const list = getTasks();
    localStorage.setItem(KEYS.TASKS, JSON.stringify(list.filter((t: Task) => t.id !== id)));
    deleteDoc(doc(db, 'tasks', id)).catch(() => {});
};

export const isUnitOccupied = (bid: string, uname: string) => {
    const contracts = getContracts();
    return contracts.some(c => c.buildingId === bid && c.unitName === uname && c.status === 'Active');
};

export const getActiveContract = (bid: string, uname: string) => {
    return getContracts().find(c => c.buildingId === bid && c.unitName === uname && c.status === 'Active');
};

export const getContracts = (): Contract[] => safeParse(KEYS.CONTRACTS, []);
export const saveContract = (c: Contract) => {
    const list = getContracts();
    const idx = list.findIndex(x => x.id === c.id);
    if (idx >= 0) list[idx] = c;
    else list.push(c);
    localStorage.setItem(KEYS.CONTRACTS, JSON.stringify(list));
    const id = c.id || crypto.randomUUID();
    setDoc(doc(db, 'contracts', id), { ...c, id }).catch(() => {});
};

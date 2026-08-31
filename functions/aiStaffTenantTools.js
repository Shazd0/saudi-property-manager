/**
 * AI Staff tenant Firestore tools — read/search and write via caller idToken (rules-enforced).
 */

const crypto = require("crypto");

const TRUSTED_MONEY_CAP_SAR = 5000;

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd, days) {
  const t = new Date(`${ymd}T12:00:00`);
  t.setDate(t.getDate() + days);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function decodeFirestoreValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return !!v.booleanValue;
  if ("nullValue" in v) return null;
  if (v.timestampValue) return v.timestampValue;
  if (v.mapValue?.fields) return decodeFirestoreFields(v.mapValue.fields);
  if (v.arrayValue?.values) return (v.arrayValue.values || []).map(decodeFirestoreValue);
  return null;
}

function decodeFirestoreFields(fields) {
  const out = {};
  if (!fields || typeof fields !== "object") return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

function decodeFirestoreDoc(doc) {
  if (!doc?.name) return null;
  const id = doc.name.split("/").pop();
  return { id, ...decodeFirestoreFields(doc.fields || {}) };
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = encodeFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function encodeFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined) continue;
    fields[k] = encodeFirestoreValue(v);
  }
  return fields;
}

function firestoreRestFieldString(fields, key) {
  const f = fields && fields[key];
  if (!f) return "";
  if (typeof f.stringValue === "string") return f.stringValue;
  if (f.integerValue != null) return String(f.integerValue);
  if (f.doubleValue != null) return String(f.doubleValue);
  return "";
}

async function listBuyerCollection(projectId, idToken, collectionId, opts = {}) {
  const pageSize = opts.pageSize || 200;
  const maxPages = opts.maxPages || 30;
  const docs = [];
  let pageToken = "";
  for (let n = 0; n < maxPages; n++) {
    const q = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) q.set("pageToken", pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents/${encodeURIComponent(collectionId)}?${q}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`list ${collectionId} failed (${r.status}) ${String(t).slice(0, 180)}`);
    }
    const json = await r.json();
    docs.push(...(json.documents || []));
    pageToken = json.nextPageToken || "";
    if (!pageToken) break;
  }
  return docs.map(decodeFirestoreDoc).filter(Boolean);
}

async function createBuyerDocument(projectId, idToken, collectionId, data) {
  const docId = String(data.id || "").trim() || crypto.randomBytes(12).toString("hex");
  const { id: _drop, ...rest } = data;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/${encodeURIComponent(collectionId)}?documentId=${encodeURIComponent(docId)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFirestoreFields({ ...rest, id: docId }) }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`create ${collectionId} failed (${r.status}) ${String(t).slice(0, 220)}`);
  }
  const doc = await r.json();
  return decodeFirestoreDoc(doc);
}

async function fetchTenantAuthIndex(projectId, idToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/authIndex/${encodeURIComponent(uid)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!r.ok) return null;
  const doc = await r.json();
  const fields = doc.fields || {};
  return {
    appUserId: firestoreRestFieldString(fields, "appUserId"),
    kind: firestoreRestFieldString(fields, "kind"),
    role: firestoreRestFieldString(fields, "role"),
    buildingIds: (fields.buildingIds?.arrayValue?.values || [])
      .map((v) => (v?.stringValue ? v.stringValue : ""))
      .filter(Boolean),
    customerId: firestoreRestFieldString(fields, "customerId"),
  };
}

async function fetchStaffDisplayName(projectId, idToken, appUserId) {
  if (!appUserId) return "AI Staff";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(appUserId)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!r.ok) return "AI Staff";
  const doc = await r.json();
  const fields = doc.fields || {};
  return firestoreRestFieldString(fields, "name") || firestoreRestFieldString(fields, "displayName") || "AI Staff";
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function searchRecords(items, query, keys) {
  const q = norm(query);
  if (!q) return items.slice(0, 20);
  return items
    .filter((item) => keys.some((k) => norm(item[k]).includes(q)))
    .slice(0, 20);
}

function sumContractPayments(contract, transactions) {
  let paid = 0;
  for (const t of transactions) {
    if (t.deleted) continue;
    if (t.status === "REJECTED") continue;
    if (t.type !== "INCOME") continue;
    if (t.contractId === contract.id) paid += Number(t.amount) || 0;
    else if (t.buildingId === contract.buildingId && t.unitNumber === contract.unitName) {
      paid += Number(t.amount) || 0;
    }
  }
  return paid;
}

function buildOfficeSummary({ contracts, transactions, tasks, buildings }) {
  const today = todayYmd();
  const in30 = addDaysYmd(today, 30);
  const active = (contracts || []).filter((c) => !c.deleted && c.status === "Active");

  const expiringSoon = active
    .filter((c) => c.toDate && c.toDate >= today && c.toDate <= in30)
    .map((c) => ({
      contractNo: c.contractNo || c.id,
      customerName: c.customerName || "—",
      buildingName: c.buildingName || "—",
      unitName: c.unitName || "—",
      toDate: c.toDate,
    }))
    .slice(0, 15);

  const overdue = [];
  for (const c of active) {
    const total = Number(c.totalValue) || 0;
    const paid = sumContractPayments(c, transactions || []);
    const remaining = Math.round((total - paid) * 100) / 100;
    if (remaining < 1) continue;
    if (c.toDate && c.toDate < today) {
      overdue.push({
        contractNo: c.contractNo || c.id,
        customerName: c.customerName || "—",
        buildingName: c.buildingName || "—",
        unitName: c.unitName || "—",
        remaining,
        toDate: c.toDate,
      });
    }
  }
  overdue.sort((a, b) => b.remaining - a.remaining);

  const openTasks = (tasks || [])
    .filter((t) => !t.deleted && t.status && t.status !== "DONE")
    .map((t) => ({
      id: t.id,
      title: t.title || "—",
      status: t.status,
      dueDate: t.dueDate || null,
      priority: t.priority || "MEDIUM",
    }))
    .slice(0, 20);

  const pendingTxCount = (transactions || []).filter(
    (t) => !t.deleted && t.status === "PENDING"
  ).length;

  return {
    asOf: today,
    buildingCount: (buildings || []).filter((b) => !b.deleted).length,
    activeContracts: active.length,
    expiringSoon,
    overdueApprox: overdue.slice(0, 15),
    openTasks,
    pendingTransactions: pendingTxCount,
  };
}

function resolveContract(contracts, { contractId, contractNo, customerName, unitName }) {
  const list = (contracts || []).filter((c) => !c.deleted);
  if (contractId) {
    const hit = list.find((c) => c.id === contractId);
    if (hit) return hit;
  }
  const qNo = norm(contractNo);
  if (qNo) {
    const hit = list.find((c) => norm(c.contractNo) === qNo || norm(c.id) === qNo);
    if (hit) return hit;
  }
  const qCust = norm(customerName);
  const qUnit = norm(unitName);
  if (qCust || qUnit) {
    return list.find((c) => {
      const custOk = !qCust || norm(c.customerName).includes(qCust);
      const unitOk = !qUnit || norm(c.unitName).includes(qUnit);
      return custOk && unitOk;
    });
  }
  return null;
}

function draftTenantReminder(contract, lang = "ar") {
  const name = contract.customerName || "Tenant";
  const unit = contract.unitName || "";
  const building = contract.buildingName || "";
  if (lang === "en") {
    return `Dear ${name}, this is a reminder regarding unit ${unit} at ${building}. Please contact the office to settle any outstanding balance. Thank you.`;
  }
  return `عزيزي ${name}، تذكير بخصوص الوحدة ${unit} في ${building}. نرجو التواصل مع المكتب لتسوية أي مستحقات. شكراً لكم.`;
}

function autonomyAllowsMoneyWrite(autonomy) {
  return autonomy === "ask_money" || autonomy === "trusted";
}

function autonomyAutoExecuteMoney(autonomy, amount) {
  if (autonomy !== "trusted") return false;
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 && n <= TRUSTED_MONEY_CAP_SAR;
}

function transactionStatusForRole(role, autonomy, amount) {
  if (autonomyAutoExecuteMoney(autonomy, amount) && (role === "ADMIN" || role === "MANAGER")) {
    return "APPROVED";
  }
  if (role === "ADMIN" || role === "MANAGER") return "APPROVED";
  return "PENDING";
}

function validatePendingTransactionPayload(raw, authIndex) {
  const p = raw && typeof raw === "object" ? raw : {};
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) {
    return { ok: false, error: "Invalid amount" };
  }
  const type = String(p.type || "INCOME").toUpperCase();
  if (!["INCOME", "EXPENSE"].includes(type)) return { ok: false, error: "type must be INCOME or EXPENSE" };
  const details = String(p.details || p.description || "").trim().slice(0, 400);
  if (!details) return { ok: false, error: "details required" };
  const paymentMethod = String(p.paymentMethod || "CASH").toUpperCase();
  return {
    ok: true,
    payload: {
      type,
      amount,
      details,
      paymentMethod,
      buildingId: String(p.buildingId || "").trim() || undefined,
      buildingName: String(p.buildingName || "").trim().slice(0, 120) || undefined,
      unitNumber: String(p.unitNumber || p.unitName || "").trim().slice(0, 40) || undefined,
      customerId: String(p.customerId || "").trim() || undefined,
      customerName: String(p.customerName || "").trim().slice(0, 120) || undefined,
      contractId: String(p.contractId || "").trim() || undefined,
      incomeSubType: type === "INCOME" ? String(p.incomeSubType || "RENTAL") : undefined,
      expenseCategory: type === "EXPENSE" ? String(p.expenseCategory || "Other").slice(0, 80) : undefined,
      createdByRole: String(authIndex?.role || ""),
    },
  };
}

function validatePendingTaskPayload(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const title = String(p.title || "").trim().slice(0, 160);
  if (!title) return { ok: false, error: "title required" };
  return {
    ok: true,
    payload: {
      title,
      description: String(p.description || "").trim().slice(0, 500) || undefined,
      dueDate: String(p.dueDate || "").slice(0, 12) || undefined,
      priority: ["HIGH", "MEDIUM", "LOW"].includes(String(p.priority || "").toUpperCase())
        ? String(p.priority).toUpperCase()
        : "MEDIUM",
    },
  };
}

async function executePendingTransaction(ctx, payload) {
  const { projectId, idToken, authIndex, staffName, autonomy } = ctx;
  const appUserId = String(authIndex?.appUserId || "").trim();
  if (!appUserId) throw new Error("Missing app user id");

  const status = transactionStatusForRole(authIndex.role, autonomy, payload.amount);
  const doc = {
    date: todayYmd(),
    type: payload.type,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    details: payload.details,
    status,
    createdAt: Date.now(),
    createdBy: appUserId,
    createdByName: staffName || "AI Staff",
    createdVia: "ai_staff",
  };
  if (payload.buildingId) doc.buildingId = payload.buildingId;
  if (payload.buildingName) doc.buildingName = payload.buildingName;
  if (payload.unitNumber) doc.unitNumber = payload.unitNumber;
  if (payload.customerId) doc.customerId = payload.customerId;
  if (payload.customerName) doc.customerName = payload.customerName;
  if (payload.contractId) doc.contractId = payload.contractId;
  if (payload.incomeSubType) doc.incomeSubType = payload.incomeSubType;
  if (payload.expenseCategory) doc.expenseCategory = payload.expenseCategory;

  const created = await createBuyerDocument(projectId, idToken, "transactions", doc);
  return { created, status };
}

async function executePendingTask(ctx, payload) {
  const { projectId, idToken, authIndex } = ctx;
  const appUserId = String(authIndex?.appUserId || "").trim();
  if (!appUserId) throw new Error("Missing app user id");

  const doc = {
    userId: appUserId,
    title: payload.title,
    description: payload.description || "",
    status: "TODO",
    priority: payload.priority || "MEDIUM",
    createdAt: Date.now(),
    createdVia: "ai_staff",
  };
  if (payload.dueDate) doc.dueDate = payload.dueDate;

  const created = await createBuyerDocument(projectId, idToken, "tasks", doc);
  return { created };
}

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Search tenant/customer records by name, mobile, or id number.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search text" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contracts",
      description: "Search active contracts by contract number, tenant name, unit, or building.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search text" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "office_summary",
      description: "Summarize overdue balances, contracts expiring soon, open tasks, and pending approvals.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_pending_transaction",
      description:
        "Prepare a rent/payment/expense entry. Money writes always need user confirmation unless autonomy is trusted and amount is small.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["INCOME", "EXPENSE"] },
          amount: { type: "number" },
          details: { type: "string" },
          paymentMethod: { type: "string" },
          buildingName: { type: "string" },
          unitNumber: { type: "string" },
          customerName: { type: "string" },
          contractId: { type: "string" },
        },
        required: ["type", "amount", "details"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_task",
      description: "Prepare an office task for follow-up.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          dueDate: { type: "string" },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_tenant_reminder",
      description: "Draft a polite rent reminder message for a tenant contract.",
      parameters: {
        type: "object",
        properties: {
          contractId: { type: "string" },
          contractNo: { type: "string" },
          customerName: { type: "string" },
          unitName: { type: "string" },
          lang: { type: "string", enum: ["ar", "en"] },
        },
      },
    },
  },
];

function toolsForAutonomy(autonomy) {
  if (autonomy === "suggest") {
    return TOOL_DEFINITIONS.filter(
      (t) => !["prepare_pending_transaction", "prepare_task"].includes(t.function.name)
    );
  }
  return TOOL_DEFINITIONS;
}

class TenantDataCache {
  constructor(projectId, idToken) {
    this.projectId = projectId;
    this.idToken = idToken;
    this._customers = null;
    this._contracts = null;
    this._transactions = null;
    this._tasks = null;
    this._buildings = null;
  }

  async customers() {
    if (!this._customers) this._customers = await listBuyerCollection(this.projectId, this.idToken, "customers");
    return this._customers;
  }

  async contracts() {
    if (!this._contracts) this._contracts = await listBuyerCollection(this.projectId, this.idToken, "contracts");
    return this._contracts;
  }

  async transactions() {
    if (!this._transactions) {
      this._transactions = await listBuyerCollection(this.projectId, this.idToken, "transactions");
    }
    return this._transactions;
  }

  async tasks() {
    if (!this._tasks) this._tasks = await listBuyerCollection(this.projectId, this.idToken, "tasks");
    return this._tasks;
  }

  async buildings() {
    if (!this._buildings) this._buildings = await listBuyerCollection(this.projectId, this.idToken, "buildings");
    return this._buildings;
  }
}

async function runTool(name, args, ctx) {
  const cache = ctx.cache;
  const autonomy = ctx.autonomy || "ask_money";

  if (name === "search_customers") {
    const items = await cache.customers();
    const hits = searchRecords(items, args.query, ["nameEn", "nameAr", "mobileNo", "idNo", "code"]);
    return {
      count: hits.length,
      items: hits.map((c) => ({
        id: c.id,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        mobileNo: c.mobileNo,
        idNo: c.idNo,
      })),
    };
  }

  if (name === "search_contracts") {
    const items = await cache.contracts();
    const hits = searchRecords(items, args.query, [
      "contractNo",
      "customerName",
      "unitName",
      "buildingName",
      "id",
    ]);
    return {
      count: hits.length,
      items: hits.map((c) => ({
        id: c.id,
        contractNo: c.contractNo,
        customerName: c.customerName,
        unitName: c.unitName,
        buildingName: c.buildingName,
        status: c.status,
        toDate: c.toDate,
        totalValue: c.totalValue,
      })),
    };
  }

  if (name === "office_summary") {
    const summary = buildOfficeSummary({
      contracts: await cache.contracts(),
      transactions: await cache.transactions(),
      tasks: await cache.tasks(),
      buildings: await cache.buildings(),
    });
    ctx.lastSummary = summary;
    return summary;
  }

  if (name === "prepare_pending_transaction") {
    if (!autonomyAllowsMoneyWrite(autonomy)) {
      return { error: "Autonomy is suggest-only — describe the entry but do not prepare writes." };
    }
    const validated = validatePendingTransactionPayload(args, ctx.authIndex);
    if (!validated.ok) return { error: validated.error };
    const contracts = await cache.contracts();
    const contract = resolveContract(contracts, validated.payload);
    if (contract) {
      validated.payload.contractId = contract.id;
      validated.payload.customerId = contract.customerId;
      validated.payload.customerName = contract.customerName;
      validated.payload.buildingId = contract.buildingId;
      validated.payload.buildingName = contract.buildingName;
      validated.payload.unitNumber = contract.unitName;
    }
    return {
      prepared: true,
      actionId: "transaction.create.v1",
      tool: "transaction.create.pending",
      summary: `Record ${validated.payload.type} ${validated.payload.amount} SAR — ${validated.payload.details}`,
      payload: validated.payload,
      requiresConfirm: !autonomyAutoExecuteMoney(autonomy, validated.payload.amount),
    };
  }

  if (name === "prepare_task") {
    if (autonomy === "suggest") {
      return { error: "Autonomy is suggest-only — describe the task but do not prepare writes." };
    }
    const validated = validatePendingTaskPayload(args);
    if (!validated.ok) return { error: validated.error };
    return {
      prepared: true,
      actionId: "task.create.v1",
      tool: "task.create",
      summary: `Create task: ${validated.payload.title}`,
      payload: validated.payload,
      requiresConfirm: true,
    };
  }

  if (name === "draft_tenant_reminder") {
    const contracts = await cache.contracts();
    const contract = resolveContract(contracts, args || {});
    if (!contract) return { error: "Contract not found" };
    const lang = args.lang === "en" ? "en" : "ar";
    return { text: draftTenantReminder(contract, lang), contractNo: contract.contractNo || contract.id };
  }

  return { error: `Unknown tool ${name}` };
}

async function executePreparedAction(ctx, pending) {
  const tool = String(pending.tool || "");
  if (tool === "transaction.create.pending") {
    return executePendingTransaction(ctx, pending.payload || {});
  }
  if (tool === "task.create") {
    return executePendingTask(ctx, pending.payload || {});
  }
  throw new Error("Unsupported pending action");
}

module.exports = {
  TRUSTED_MONEY_CAP_SAR,
  todayYmd,
  addDaysYmd,
  buildOfficeSummary,
  draftTenantReminder,
  autonomyAllowsMoneyWrite,
  autonomyAutoExecuteMoney,
  validatePendingTransactionPayload,
  validatePendingTaskPayload,
  executePreparedAction,
  executePendingTransaction,
  executePendingTask,
  fetchTenantAuthIndex,
  fetchStaffDisplayName,
  listBuyerCollection,
  createBuyerDocument,
  decodeFirestoreDoc,
  TenantDataCache,
  TOOL_DEFINITIONS,
  toolsForAutonomy,
  runTool,
};

import { redact } from './security.mjs';
import { buyerSchemas, ownerSchemas, parseSchema } from './schemas.mjs';

export const OWNER_TOOL_NAMES = Object.freeze(Object.keys(ownerSchemas));
export const BUYER_TOOL_NAMES = Object.freeze(Object.keys(buyerSchemas));
export const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const value = (item, ...keys) => keys.map((key) => item?.[key]).find((v) => v !== undefined && v !== null);
const buildingId = (item) => String(value(item, 'buildingId', 'propertyId', 'building_id') || '');
const customerId = (item) => String(value(item, 'customerId', 'tenantId', 'userId') || '');
const dateValue = (item) => String(value(item, 'date', 'dueDate', 'endDate', 'contractEndDate', 'expiryDate') || '');
const expiryValue = (item) => String(value(item, 'endDate', 'contractEndDate', 'expiryDate', 'date') || '');
const amount = (item, ...keys) => Number(value(item, ...keys) || 0) || 0;

function withinDate(item, from, to) {
  const date = dateValue(item).slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function buyerCanSee(item, principal, collection) {
  const allowedBuildings = new Set(principal.buildingIds || []);
  const itemBuildingId = collection === 'buildings' ? String(item.id || buildingId(item)) : buildingId(item);
  if (!principal.allBuildings && !allowedBuildings.has(itemBuildingId)) return false;
  if (collection !== 'buildings' && ['tenant', 'customer'].includes(principal.role)) {
    return customerId(item) === principal.customerId;
  }
  return ['buyer', 'buyer_admin', 'manager', 'tenant', 'customer'].includes(principal.role);
}

async function get(repository, principal, collection, limit = 200) {
  const rows = await repository.documents(principal.bookId, collection, Math.min(limit, 250));
  return principal.actorType === 'buyer' ? rows.filter((row) => buyerCanSee(row, principal, collection)) : rows;
}

export async function executeOwnerTool(name, raw, principal, repository) {
  const args = parseSchema(ownerSchemas[name], raw);
  if (args.bookId !== principal.bookId && principal.bookId !== '*') throw new Error('Book is not authorized');
  const scoped = { ...principal, bookId: args.bookId };

  if (name === 'owner.list_buildings') {
    return redact((await get(repository, scoped, 'buildings')).slice(0, args.limit));
  }
  if (name === 'owner.expiring_contracts') {
    const today = new Date();
    const end = new Date(today.getTime() + args.days * 86_400_000).toISOString().slice(0, 10);
    return redact((await get(repository, scoped, 'contracts')).filter((row) => {
      const date = expiryValue(row).slice(0, 10);
      return date >= today.toISOString().slice(0, 10) && date <= end;
    }).slice(0, args.limit));
  }
  if (name === 'owner.search_transactions') {
    const query = args.query?.toLowerCase();
    return redact((await get(repository, scoped, 'transactions')).filter((row) => {
      if (args.buildingId && buildingId(row) !== args.buildingId) return false;
      if (!withinDate(row, args.from, args.to)) return false;
      if (!query) return true;
      return [row.description, row.details, row.category, row.referenceNumber]
        .some((field) => String(field || '').toLowerCase().includes(query));
    }).slice(0, args.limit));
  }
  if (name === 'owner.portfolio_summary') {
    const [buildings, contracts, transactions] = await Promise.all([
      get(repository, scoped, 'buildings'), get(repository, scoped, 'contracts'), get(repository, scoped, 'transactions'),
    ]);
    return {
      buildingCount: buildings.length,
      activeContractCount: contracts.filter((c) => !['expired', 'cancelled'].includes(String(c.status).toLowerCase())).length,
      income: transactions.filter((t) => String(t.type).toUpperCase() === 'INCOME').reduce((sum, t) => sum + amount(t, 'amount', 'total'), 0),
      expenses: transactions.filter((t) => String(t.type).toUpperCase() === 'EXPENSE').reduce((sum, t) => sum + amount(t, 'amount', 'total'), 0),
    };
  }
  throw new Error('Tool is not allowlisted');
}

export async function executeBuyerTool(name, raw, principal, repository) {
  const args = parseSchema(buyerSchemas[name], raw);
  if (name === 'buyer.list_properties') return redact((await get(repository, principal, 'buildings')).slice(0, args.limit));
  if (name === 'buyer.property_lookup') {
    const result = (await get(repository, principal, 'buildings')).find((row) => String(row.id) === args.propertyId);
    if (!result) throw new Error('Property not found or not authorized');
    return redact(result);
  }
  if (name === 'buyer.contract_expiry') {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + args.days * 86_400_000).toISOString().slice(0, 10);
    return redact((await get(repository, principal, 'contracts')).filter((row) => {
      const date = expiryValue(row).slice(0, 10);
      return date >= today && date <= end;
    }).slice(0, args.limit));
  }
  if (name === 'buyer.rent_transaction_status') {
    return redact((await get(repository, principal, 'transactions')).filter((row) =>
      /rent|rental|إيجار/i.test(String(value(row, 'category', 'type', 'description') || ''))).slice(0, args.limit));
  }
  if (name === 'buyer.maintenance_status') {
    return redact((await get(repository, principal, 'tasks')).filter((row) =>
      /maintenance|repair|صيانة/i.test(String(value(row, 'type', 'category', 'title') || ''))).slice(0, args.limit));
  }
  if (name === 'buyer.vat_summary') {
    const txs = (await get(repository, principal, 'transactions')).filter((row) => withinDate(row, args.from, args.to));
    return {
      outputVat: txs.filter((t) => String(t.type).toUpperCase() === 'INCOME').reduce((sum, t) => sum + amount(t, 'vatAmount', 'vat'), 0),
      inputVat: txs.filter((t) => String(t.type).toUpperCase() === 'EXPENSE').reduce((sum, t) => sum + amount(t, 'vatAmount', 'vat'), 0),
      transactionCount: txs.length,
    };
  }
  throw new Error('Tool is not allowlisted');
}

import { Transaction, TransactionStatus, TransactionType } from '../types';
import {
  getTransactionInclusiveAmount,
  transactionCountsAsBankForSplit,
  transactionCountsAsCashForSplit,
} from './transactionUtils';

const normalize = (v?: string) => String(v || '').trim().toLowerCase();

export const rawBuildingId = (compositeId: string | undefined): string => {
  if (!compositeId) return '';
  const s = String(compositeId);
  return s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
};

export const bookIdOf = (compositeId: string | undefined): string => {
  if (!compositeId) return '';
  const s = String(compositeId);
  return s.includes(':') ? s.slice(0, s.indexOf(':')) : '';
};

export const isLedgerOpeningBalanceRow = (r: Transaction): boolean =>
  r.borrowingType === 'OPENING_BALANCE' ||
  (r as any).isOwnerOpeningBalance === true ||
  r.expenseCategory === 'Owner Opening Balance';

export const NO_SOURCE_BUILDING_FILTER = '__NO_SOURCE_BUILDING__';

type BuildingLike = { id: string; name?: string; _id?: string } & Record<string, any>;

const buildingNameFor = (buildings: BuildingLike[], id?: string): string => {
  if (!id) return '';
  if (id.includes(',')) return '';
  const b = buildings.find((x) => x.id === id || (x as any)._id === id);
  return b ? (b as any).name || '' : '';
};

const transactionHasNoSourceBuilding = (tx: Transaction): boolean => {
  const explicitBuilding = [
    tx.buildingId,
    (tx as any).building,
    (tx as any).building_id,
    (tx as any).targetBuildingId,
  ].some((v) => String(v || '').trim());
  if (explicitBuilding) return false;
  if ((tx as any).source === 'treasury') return false;
  const fromType = String((tx as any).fromType || '').toUpperCase();
  const toType = String((tx as any).toType || '').toUpperCase();
  return fromType !== 'BUILDING' && toType !== 'BUILDING';
};

/**
 * Building matcher shared by Dashboard and History so both scope ledger rows identically.
 * Mirrors History's matchTransactionBuilding (treasury rows match strictly by own buildingId,
 * with raw/composite id tolerance).
 */
export const makeBuildingMatcher = (buildings: BuildingLike[]) => {
  return (tx: Transaction, buildingId: string): boolean => {
    if (buildingId === NO_SOURCE_BUILDING_FILTER) return transactionHasNoSourceBuilding(tx);
    const targetId = normalize(buildingId);
    const targetRaw = normalize(rawBuildingId(buildingId));
    const targetName = normalize(buildingNameFor(buildings, buildingId));
    if (!targetId) return false;

    if ((tx as any).source === 'treasury') {
      if (!tx.buildingId) return false;
      const txB = normalize(String(tx.buildingId));
      const txRaw = normalize(rawBuildingId(String(tx.buildingId)));
      return txB === targetId || txRaw === targetId || txRaw === targetRaw;
    }

    const rawIds = [
      tx.buildingId,
      (tx as any).building,
      (tx as any).building_id,
      (tx as any).targetBuildingId,
      (tx as any).fromId,
      (tx as any).toId,
    ]
      .flatMap((v) => String(v || '').split(','))
      .map((v) => normalize(v))
      .filter(Boolean);
    if (rawIds.includes(targetId)) return true;
    if (targetRaw && rawIds.map((v) => normalize(rawBuildingId(v))).includes(targetRaw)) return true;

    const rawNames = [
      tx.buildingName,
      typeof (tx as any).building === 'string' ? (tx as any).building : '',
      (tx as any).building_name,
    ]
      .flatMap((v) => String(v || '').split(','))
      .map((v) => normalize(v))
      .filter(Boolean);
    if (targetName && rawNames.includes(targetName)) return true;
    return false;
  };
};

/**
 * Building-scope ledger rows the same way on Dashboard and History.
 * Owner expenses are matched strictly by their own source buildingId.
 */
export const filterLedgerByBuildings = (
  rows: Transaction[],
  buildingIds: string[],
  buildings: BuildingLike[],
): Transaction[] => {
  if (!buildingIds || buildingIds.length === 0) return rows;
  const match = makeBuildingMatcher(buildings);
  return rows.filter((t) => {
    const ownerCat = (t.expenseCategory || '').trim();
    if (ownerCat === 'Owner Expense' || ownerCat === 'Owner Profit Withdrawal') {
      const bId = String((t as any).buildingId || '');
      if (!bId) return buildingIds.includes(NO_SOURCE_BUILDING_FILTER);
      return buildingIds.includes(bId) || buildingIds.includes(rawBuildingId(bId));
    }
    return buildingIds.some((id) => match(t, id));
  });
};

/**
 * Inject Building↔Owner and missing same-book inter-building legs, then dedupe
 * duplicate (transferId, building, type) rows. Used by Dashboard and History.
 */
export const enrichLedgerTransactions = (
  transactions: Transaction[],
  transfers: any[] | null | undefined,
): Transaction[] => {
  const txs = Array.isArray(transactions) ? transactions : [];
  const trs = Array.isArray(transfers) ? transfers : [];

  const existingTreasuryIds = new Set(
    txs.filter((t: any) => (t as any).transferId).map((t: any) => String((t as any).transferId)),
  );

  const buildingOwnerPseudo = trs
    .filter(
      (tr: any) =>
        ((tr.fromType === 'BUILDING' && tr.toType === 'OWNER') ||
          (tr.fromType === 'OWNER' && tr.toType === 'BUILDING')) &&
        !tr.deleted &&
        !existingTreasuryIds.has(String(tr.id)),
    )
    .map(
      (tr: any) =>
        ({
          id: `pseudo_${tr.id}`,
          date: tr.date || '',
          type: tr.fromType === 'BUILDING' ? 'EXPENSE' : 'INCOME',
          amount: Number(tr.amount) || 0,
          paymentMethod: 'TREASURY',
          originalPaymentMethod: tr.paymentMethod,
          fromType: tr.fromType,
          toType: tr.toType,
          fromId: tr.fromId,
          toId: tr.toId,
          source: 'treasury',
          buildingId: tr.fromType === 'BUILDING' ? tr.fromId : tr.toType === 'BUILDING' ? tr.toId : undefined,
          status: tr.status || 'APPROVED',
          expenseCategory: '',
          borrowingType: undefined,
          transferId: tr.id,
        }) as any,
    );

  const interBuildingPseudo: any[] = [];
  trs.forEach((tr: any) => {
    if (tr.deleted) return;
    if (!(tr.fromType === 'BUILDING' && tr.toType === 'BUILDING' && tr.fromId && tr.toId && tr.fromId !== tr.toId))
      return;
    const isCrossBook =
      (tr.sourceBookId && tr.destBookId && tr.sourceBookId !== tr.destBookId) ||
      (!!bookIdOf(tr.fromId) && !!bookIdOf(tr.toId) && bookIdOf(tr.fromId) !== bookIdOf(tr.toId));
    if (isCrossBook) return;
    const fromRaw = rawBuildingId(tr.fromId);
    const toRaw = rawBuildingId(tr.toId);
    const trId = String(tr.id || '');
    const linked = txs.filter((tx) => String((tx as any).transferId || '') === trId && (tx as any).buildingId);
    const hasSource = linked.some((tx) => normalize(rawBuildingId((tx as any).buildingId)) === normalize(fromRaw));
    const hasDest = linked.some((tx) => normalize(rawBuildingId((tx as any).buildingId)) === normalize(toRaw));
    const base = {
      date: tr.date || '',
      amount: Number(tr.amount) || 0,
      paymentMethod: 'TREASURY',
      originalPaymentMethod: tr.paymentMethod,
      fromType: tr.fromType,
      toType: tr.toType,
      fromId: tr.fromId,
      toId: tr.toId,
      source: 'treasury',
      status: tr.status || 'APPROVED',
      expenseCategory: '',
      borrowingType: undefined,
      transferId: tr.id,
    };
    if (!hasSource)
      interBuildingPseudo.push({
        ...base,
        id: `pseudo_${tr.id}_src`,
        type: 'EXPENSE',
        buildingId: fromRaw,
        interBuildingRole: 'SOURCE',
      });
    if (!hasDest)
      interBuildingPseudo.push({
        ...base,
        id: `pseudo_${tr.id}_dst`,
        type: 'INCOME',
        buildingId: toRaw,
        interBuildingRole: 'DEST',
      });
  });

  let allTxns: Transaction[] = [...txs, ...buildingOwnerPseudo, ...interBuildingPseudo];

  const legDedupeKey = (r: any): string => {
    const tid = String(r?.transferId || '').trim();
    if (!tid) return '';
    return `${tid}::${normalize(rawBuildingId(String(r.buildingId || '')))}::${String(r?.type || '').toUpperCase()}`;
  };
  const byLeg = new Map<string, any[]>();
  for (const r of allTxns) {
    const k = legDedupeKey(r);
    if (!k) continue;
    const arr = byLeg.get(k);
    if (arr) arr.push(r);
    else byLeg.set(k, [r]);
  }
  const dropRowIds = new Set<string>();
  for (const [, arr] of byLeg) {
    if (arr.length <= 1) continue;
    arr.sort((a: any, b: any) => {
      const ap = String(a.id || '').startsWith('pseudo_') ? 1 : 0;
      const bp = String(b.id || '').startsWith('pseudo_') ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
    for (let i = 1; i < arr.length; i++) dropRowIds.add(String(arr[i].id));
  }
  if (dropRowIds.size > 0) {
    allTxns = allTxns.filter((r) => !dropRowIds.has(String(r.id)));
  }

  return allTxns;
};

/** Approved / completed ledger rows used for Dashboard + History net balance. */
export const filterApprovedLedgerTransactions = (transactions: Transaction[]): Transaction[] =>
  (transactions || []).filter((t) => {
    if ((t as any).deleted) return false;
    if (t.paymentMethod === 'TREASURY_REVERSAL') return false;
    if ((t as any).source === 'treasury') {
      const ft = (t as any).fromType;
      const tt = (t as any).toType;
      if ((ft === 'OWNER' && tt === 'HEAD_OFFICE') || (ft === 'HEAD_OFFICE' && tt === 'OWNER')) return false;
    }
    const status = String(t.status || TransactionStatus.APPROVED).toUpperCase();
    return status === TransactionStatus.APPROVED || status === 'COMPLETED' || !t.status;
  });

export type LedgerSummary = {
  openingCash: number;
  openingBank: number;
  openingTotal: number;
  cashIncome: number;
  bankIncome: number;
  incomeTotal: number;
  cashExpense: number;
  bankExpense: number;
  expenseTotal: number;
  cashBalance: number;
  bankBalance: number;
  totalNet: number;
};

export type ComputeLedgerSummaryInput = {
  /** Already building-filtered approved ledger rows (no further transfer enrichment). */
  ledgerRows: Transaction[];
  openingBalancesByBuilding?: Record<string, { cash?: number; bank?: number; date?: string } | null> | null;
  /** When set, only these building keys contribute settings openings. Empty = all. */
  buildingIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  tillDate?: string;
  /** Optional month start override (YYYY-MM-01). Defaults to local current month. */
  currentMonthStart?: string;
};

/**
 * Single source of truth for Dashboard / History opening + period + net balance.
 * totalNet = opening (prior + settings) + period income − period expense.
 */
export const computeLedgerSummary = (input: ComputeLedgerSummaryInput): LedgerSummary => {
  const {
    ledgerRows,
    openingBalancesByBuilding,
    buildingIds = [],
    dateFrom = '',
    dateTo = '',
    tillDate = '',
  } = input;

  const normalizeType = (type: any) => String(type || '').toUpperCase();
  const sumAmt = (rows: Transaction[]) => rows.reduce((s, r) => s + getTransactionInclusiveAmount(r), 0);

  const now = new Date();
  const currentMonthStart =
    input.currentMonthStart ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let settingsOpeningCash = 0;
  let settingsOpeningBank = 0;
  Object.entries(openingBalancesByBuilding || {}).forEach(([buildingId, row]) => {
    if (buildingIds.length > 0 && !buildingIds.includes(buildingId)) return;
    settingsOpeningCash += Number((row as any)?.cash) || 0;
    settingsOpeningBank += Number((row as any)?.bank) || 0;
  });
  const settingsOpeningAll = settingsOpeningCash + settingsOpeningBank;

  const hasDateFilter = !!(dateFrom || dateTo || tillDate);
  const effectiveDateFrom = dateFrom || '';
  const effectiveDateTo = tillDate || dateTo || '9999-12-31';
  const openingCutoff = hasDateFilter ? dateFrom || currentMonthStart : currentMonthStart;

  const periodTxns = hasDateFilter
    ? ledgerRows.filter((t) => t.date && t.date >= effectiveDateFrom && t.date <= effectiveDateTo)
    : ledgerRows.filter((t) => t.date && t.date >= currentMonthStart);

  const incomeRows = periodTxns.filter(
    (r) => normalizeType(r.type) === TransactionType.INCOME && !isLedgerOpeningBalanceRow(r),
  );
  const expenseRows = periodTxns.filter(
    (r) => normalizeType(r.type) === TransactionType.EXPENSE && !isLedgerOpeningBalanceRow(r),
  );

  const cashIncome = sumAmt(incomeRows.filter((r) => transactionCountsAsCashForSplit(r)));
  const bankIncome = sumAmt(incomeRows.filter((r) => transactionCountsAsBankForSplit(r)));
  const incomeTotal = sumAmt(incomeRows);

  const cashExpense = sumAmt(expenseRows.filter((r) => transactionCountsAsCashForSplit(r)));
  const bankExpense = sumAmt(expenseRows.filter((r) => transactionCountsAsBankForSplit(r)));
  const expenseTotal = sumAmt(expenseRows);

  let openingCash = 0;
  let openingBank = 0;
  let openingAll = 0;
  const priorTxns = ledgerRows.filter((t) => t.date && t.date < openingCutoff);
  for (const t of priorTxns) {
    if (isLedgerOpeningBalanceRow(t)) continue;
    const amt = getTransactionInclusiveAmount(t);
    const isIncome = normalizeType(t.type) === TransactionType.INCOME;
    const netAmt = isIncome ? amt : -amt;
    openingAll += netAmt;
    if (transactionCountsAsCashForSplit(t)) openingCash += netAmt;
    else if (transactionCountsAsBankForSplit(t)) openingBank += netAmt;
  }

  const cashBalance = openingCash + settingsOpeningCash + cashIncome - cashExpense;
  const bankBalance = openingBank + settingsOpeningBank + bankIncome - bankExpense;
  const totalNet = openingAll + settingsOpeningAll + incomeTotal - expenseTotal;

  return {
    openingCash: openingCash + settingsOpeningCash,
    openingBank: openingBank + settingsOpeningBank,
    openingTotal: openingAll + settingsOpeningAll,
    cashIncome,
    bankIncome,
    incomeTotal,
    cashExpense,
    bankExpense,
    expenseTotal,
    cashBalance,
    bankBalance,
    totalNet,
  };
};

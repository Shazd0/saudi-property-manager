import type { Building, Contract, Customer, Transaction } from '../types';
import { computeContractBalance } from './contractBalance';
import { computeInstallmentProgress } from './installmentPaymentProgress';
import { getInstallmentStartDates } from './installmentSchedule';
import { dateToLocalStr } from './dateFormat';
import { isNonResidentialBuildingForContract } from './contractTransactionFilter';

export type OverdueTenantRow = {
  contractId: string;
  contractNo?: string;
  customerId?: string;
  customerName: string;
  buildingId: string;
  buildingName: string;
  unitName: string;
  remaining: number;
  daysLate: number;
  mobileNo?: string;
  nextDueDate?: string;
};

export type BuildingOutstandingSummary = {
  buildingId: string;
  buildingName: string;
  contractCount: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
};

function todayYmd(): string {
  return dateToLocalStr(new Date());
}

function daysBetweenYmd(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

export function getDaysLateForContract(
  contract: Contract,
  buildings: Building[],
  transactions: Transaction[],
  catalog: Contract[],
): number {
  const today = todayYmd();
  const nonRes = isNonResidentialBuildingForContract(buildings, contract);
  const incomeTxs = transactions.filter(
    (t) =>
      t.type === 'INCOME' &&
      t.status !== 'REJECTED' &&
      (t.contractId === contract.id ||
        (t.buildingId === contract.buildingId && t.unitNumber === contract.unitName)),
  );
  const { firstInstAmt, otherInstAmt, totalInst, schedulePaid } = computeInstallmentProgress({
    contract,
    payments: incomeTxs,
    excludeFeesEntry: nonRes,
    useInclusivePayments: nonRes,
  });

  const dueDates = getInstallmentStartDates({
    fromDate: contract.fromDate,
    toDate: contract.toDate,
    periodMonths: Number(contract.periodMonths) || 0,
    periodDays: Number(contract.periodDays) || 0,
    installmentCount: totalInst,
  });

  let cumulative = 0;
  for (let i = 1; i <= totalInst; i++) {
    const amt = i === 1 ? firstInstAmt : otherInstAmt;
    cumulative += amt;
    const due = dueDates[i - 1];
    if (!due) continue;
    const dueStr = dateToLocalStr(due);
    if (schedulePaid < cumulative - 0.01 && dueStr < today) {
      return daysBetweenYmd(dueStr, today);
    }
  }
  return 0;
}

export function buildOverdueRows(params: {
  contracts: Contract[];
  buildings: Building[];
  transactions: Transaction[];
  customers: Customer[];
  buildingId?: string;
  minRemaining?: number;
  minDaysLate?: number;
  limit?: number;
}): OverdueTenantRow[] {
  const {
    contracts,
    buildings,
    transactions,
    customers,
    buildingId,
    minRemaining = 1,
    minDaysLate = 0,
    limit = 50,
  } = params;

  const catalog = contracts.filter((c) => !(c as any).deleted);
  const active = catalog.filter((c) => c.status === 'Active');
  const filtered = buildingId ? active.filter((c) => c.buildingId === buildingId) : active;

  const rows: OverdueTenantRow[] = [];

  for (const c of filtered) {
    const bal = computeContractBalance(c, { buildings, catalog, transactions });
    const remaining = bal.remainingIncludingPrior ?? bal.remaining;
    if (remaining < minRemaining) continue;

    const daysLate = getDaysLateForContract(c, buildings, transactions, catalog);
    if (minDaysLate > 0 && daysLate < minDaysLate) continue;

    const customer = customers.find((cu) => cu.id === c.customerId);
    const building =
      buildings.find((b) => b.id === c.buildingId) ||
      buildings.find((b) => (b.name || '').trim() === String(c.buildingName || '').trim());

    const dueDates = getInstallmentStartDates({
      fromDate: c.fromDate,
      toDate: c.toDate,
      periodMonths: Number(c.periodMonths) || 0,
      periodDays: Number(c.periodDays) || 0,
      installmentCount: Math.max(1, Number(c.installmentCount) || 1),
    });
    const nextDue = dueDates.find((d) => dateToLocalStr(d) >= todayYmd());

    rows.push({
      contractId: c.id,
      contractNo: (c as any).contractNo,
      customerId: c.customerId,
      customerName: c.customerName || customer?.nameEn || customer?.nameAr || '—',
      buildingId: c.buildingId || '',
      buildingName: building?.name || c.buildingName || '—',
      unitName: c.unitName || '—',
      remaining: Math.round(remaining * 100) / 100,
      daysLate,
      mobileNo: customer?.mobileNo || (customer as any)?.mobile,
      nextDueDate: nextDue ? dateToLocalStr(nextDue) : undefined,
    });
  }

  rows.sort((a, b) => b.daysLate - a.daysLate || b.remaining - a.remaining);
  return rows.slice(0, limit);
}

export function resolveBuilding(nameOrId: string, buildings: Building[]): Building | undefined {
  const q = nameOrId.trim().toLowerCase();
  if (!q) return undefined;
  return (
    buildings.find((b) => b.id === nameOrId) ||
    buildings.find((b) => (b.name || '').toLowerCase() === q) ||
    buildings.find((b) => (b.name || '').toLowerCase().includes(q))
  );
}

export function summarizeBuildingOutstanding(
  building: Building,
  contracts: Contract[],
  buildings: Building[],
  transactions: Transaction[],
): BuildingOutstandingSummary {
  const catalog = contracts.filter((c) => !(c as any).deleted);
  const active = catalog.filter((c) => c.status === 'Active' && c.buildingId === building.id);
  let totalOutstanding = 0;

  for (const c of active) {
    const bal = computeContractBalance(c, { buildings, catalog, transactions });
    totalOutstanding += bal.remainingIncludingPrior ?? bal.remaining;
  }

  const overdueRows = buildOverdueRows({
    contracts: active,
    buildings,
    transactions,
    customers: [],
    buildingId: building.id,
    minDaysLate: 1,
    limit: 500,
  });

  return {
    buildingId: building.id,
    buildingName: building.name || '—',
    contractCount: active.length,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdueCount: overdueRows.length,
    overdueAmount: Math.round(overdueRows.reduce((s, r) => s + r.remaining, 0) * 100) / 100,
  };
}

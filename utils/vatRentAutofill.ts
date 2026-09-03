import type { Building, Contract, Transaction } from '../types';
import { computeInstallmentProgress } from './installmentPaymentProgress';
import { isNonResidentialBuildingForContract } from './contractTransactionFilter';

export type VatRentAutofillResult = {
  installmentNo: number;
  /** Remaining due on the current rent installment (0 if fully paid). */
  rentAutoFill: number;
  currentInstAmt: number;
  paidTowardCurrent: number;
  paid: number;
  remaining: number;
};

function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function scheduleRemaining(opts: {
  count: number;
  firstInst: number;
  otherInst: number;
  schedulePaid: number;
}): Pick<VatRentAutofillResult, 'installmentNo' | 'rentAutoFill' | 'currentInstAmt' | 'paidTowardCurrent'> {
  const { count, firstInst, otherInst, schedulePaid } = opts;
  let cumulative = 0;
  for (let i = 1; i <= count; i++) {
    const instAmt = i === 1 ? firstInst : otherInst;
    const prevCum = cumulative;
    cumulative += instAmt;
    if (schedulePaid < cumulative - 0.01) {
      const paidTowardCurrent = Math.max(0, schedulePaid - prevCum);
      return {
        installmentNo: i,
        currentInstAmt: instAmt,
        paidTowardCurrent,
        rentAutoFill: Math.max(0, Math.round((instAmt - paidTowardCurrent) * 100) / 100),
      };
    }
  }
  const lastInst = count <= 1 ? firstInst : otherInst;
  return {
    installmentNo: count,
    currentInstAmt: lastInst,
    paidTowardCurrent: lastInst,
    rentAutoFill: 0,
  };
}

/**
 * Auto-fill amount for VAT Sales / rent entry.
 * Prefer rent-only schedule (rentValue / rentOnlyInstallment). If those are missing
 * (common on older shop contracts), fall back to EntryForm's first/other installment
 * schedule so shops like SHOP 904,905&906 still populate.
 */
export function computeVatRentAutofill(opts: {
  contract: Contract;
  payments: Transaction[];
  buildings: Building[];
}): VatRentAutofillResult {
  const { contract, payments, buildings } = opts;
  const nonRes = isNonResidentialBuildingForContract(buildings, contract as any);
  const upfront = money((contract as any).upfrontPaid);
  const count = Math.max(1, money(contract.installmentCount) || 1);

  const rentPayments = nonRes ? payments.filter((t) => !(t as any).feesEntry) : payments;
  const totalPaidIncl = rentPayments.reduce(
    (sum, t) =>
      sum +
      money((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) +
      money((t as any).discountAmount),
    0,
  );
  const paid = totalPaidIncl + upfront;

  if (nonRes) {
    const rentTotal = money((contract as any).rentValue);
    const rentOnlyOther = money((contract as any).rentOnlyInstallment);
    const rentPerInst = rentTotal > 0 ? rentTotal / count : rentOnlyOther > 0 ? rentOnlyOther : 0;

    if (rentPerInst > 0) {
      const firstInst = rentPerInst + upfront;
      const otherInst = rentPerInst;
      const schedulePaid = totalPaidIncl + upfront;
      const slot = scheduleRemaining({ count, firstInst, otherInst, schedulePaid });
      const remaining = Math.max(0, rentTotal + upfront - paid);
      return { ...slot, paid, remaining };
    }

    // Fall back to stored lease schedule (same as Entry form) when rent-only fields are empty.
    const progress = computeInstallmentProgress({
      contract,
      payments,
      excludeFeesEntry: true,
      useInclusivePayments: true,
    });
    const prevCumulative =
      progress.installmentNo <= 1
        ? 0
        : progress.firstInstAmt + (progress.installmentNo - 2) * progress.otherInstAmt;
    const currentInstAmt =
      progress.installmentNo <= 1
        ? progress.firstInstAmt
        : progress.otherInstAmt > 0
          ? progress.otherInstAmt
          : progress.firstInstAmt;
    const paidTowardCurrent = Math.max(0, progress.schedulePaid - prevCumulative);
    const rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);
    const effectiveTotal = money(contract.totalValue) + upfront;
    return {
      installmentNo: progress.installmentNo,
      rentAutoFill,
      currentInstAmt,
      paidTowardCurrent,
      paid,
      remaining: Math.max(0, effectiveTotal - paid),
    };
  }

  const progress = computeInstallmentProgress({
    contract,
    payments,
    excludeFeesEntry: false,
    useInclusivePayments: false,
  });
  const prevCumulative =
    progress.installmentNo <= 1
      ? 0
      : progress.firstInstAmt + (progress.installmentNo - 2) * progress.otherInstAmt;
  const currentInstAmt =
    progress.installmentNo <= 1
      ? progress.firstInstAmt
      : progress.otherInstAmt > 0
        ? progress.otherInstAmt
        : progress.firstInstAmt;
  const paidTowardCurrent = Math.max(0, progress.schedulePaid - prevCumulative);
  const rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);
  const rentValue = money((contract as any).rentValue);
  return {
    installmentNo: progress.installmentNo,
    rentAutoFill,
    currentInstAmt,
    paidTowardCurrent,
    paid,
    remaining: Math.max(0, rentValue - paid),
  };
}

/** Last-resort amount when no contract is linked: unit default rent on the building. */
export function unitDefaultRentAmount(building: Building | undefined, unitName: string): number {
  if (!building || !unitName) return 0;
  const unit = (building.units || []).find((u: any) => {
    const name = typeof u === 'string' ? u : u?.name;
    return String(name || '').trim() === String(unitName).trim();
  });
  if (!unit || typeof unit === 'string') return 0;
  return Math.max(0, money((unit as any).defaultRent));
}

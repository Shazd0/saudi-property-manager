import type { Contract, Transaction } from '../types';

/**
 * Contract installment progress for quick-entry / reporting.
 * Mirrors the lease Entry form: uses stored firstInstallment / otherInstallment
 * (with totalValue reconciliation), not rentValue ÷ count — so upfront + real
 * schedule amounts do not incorrectly skip to installment 2 before rent is paid.
 */
export function computeInstallmentProgress(params: {
  contract: Contract;
  /** Approved income transactions for this contract (caller filters). */
  payments: Transaction[];
  /** Non-residential: exclude feesEntry rows from rent schedule (same as Entry). */
  excludeFeesEntry?: boolean;
  /**
   * When true (VAT / non-residential leases), compare cash/inclusive payments to
   * installment amounts — those contracts store final prices, not exclusive rent.
   */
  useInclusivePayments?: boolean;
}): {
  installmentNo: number;
  firstInstAmt: number;
  otherInstAmt: number;
  totalInst: number;
  /** Paid toward schedule (tx amounts + discount + upfront), same basis as Entry loop. */
  schedulePaid: number;
} {
  const { contract, payments, excludeFeesEntry, useInclusivePayments } = params;
  const rentPayments = excludeFeesEntry
    ? payments.filter((t) => !(t as any).feesEntry)
    : payments;

  const upfrontPaid = Number((contract as any).upfrontPaid || 0);
  const totalInst = Math.max(1, Number(contract.installmentCount) || 1);
  const totalValueStored = Number(contract.totalValue || 0);
  const effectiveTotal = totalValueStored + upfrontPaid;

  let firstInstAmt = Number(contract.firstInstallment || 0) + upfrontPaid;
  const otherInstAmt = Number(contract.otherInstallment || 0);
  const sumInstallments = firstInstAmt + otherInstAmt * Math.max(0, totalInst - 1);
  if (effectiveTotal > 0 && Math.abs(sumInstallments - effectiveTotal) > Math.max(5, totalInst)) {
    firstInstAmt = Math.max(0, effectiveTotal - otherInstAmt * Math.max(0, totalInst - 1));
  }

  const totalPaid = rentPayments.reduce((sum, t) => {
    const base = useInclusivePayments
      ? Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount || 0)
      : Number(t.amount || 0);
    return sum + base + (Number((t as any).discountAmount) || 0);
  }, 0);
  const schedulePaid = totalPaid + upfrontPaid;

  let cumulative = 0;
  let installmentNo = totalInst;
  for (let i = 1; i <= totalInst; i++) {
    const instAmount = i === 1 ? firstInstAmt : otherInstAmt;
    cumulative += instAmount;
    if (schedulePaid < cumulative - 1e-6) {
      installmentNo = i;
      break;
    }
  }

  return { installmentNo, firstInstAmt, otherInstAmt, totalInst, schedulePaid };
}

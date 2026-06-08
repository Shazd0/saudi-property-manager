import type { Building } from '../types';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from './contractTransactionFilter';

/** Prior-lease balance snapshot when starting a renewal (confirm + new contract form). */
export type RenewalPriorBalanceSnap = {
  paid: number;
  effectiveTotal: number;
  remaining: number;
  percent: number;
  priorContractNo: string;
  priorContractId: string;
};

/** Paid / due totals for a contract — same rules as Contract list “progress”. */
export function computeContractBalance(
  c: any,
  opts: {
    buildings: Building[];
    catalog: ReadonlyArray<any>;
    transactions: ReadonlyArray<any>;
  },
): { paid: number; effectiveTotal: number; remaining: number; percent: number } {
  const bld =
    opts.buildings.find((b) => b.id === c.buildingId) ||
    opts.buildings.find((b) => (b.name || '').trim() === String((c as any).buildingName || '').trim());
  const isVAT = bld?.propertyType === 'NON_RESIDENTIAL' || bld?.vatApplicable === true;
  const nonResContract = isNonResidentialBuildingForContract(opts.buildings, c as any);
  const paidRaw = opts.transactions
    .filter((t) => {
      // Split "feesEntry" payments are only used on non-residential; on residential they would double-count
      // against the same obligation already covered by normal rent installments.
      if ((t as any).feesEntry && !nonResContract) return false;
      return transactionAppliesToContract(t, c, opts.catalog);
    })
    .reduce(
      (sum, t) =>
        sum +
        (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) +
        (Number((t as any).discountAmount) || 0),
      0,
    );
  const upfrontPaid = Number((c as any).upfrontPaid || 0);
  const paid = paidRaw + upfrontPaid;
  const rentValue = Number((c as any).rentValue || 0);
  const vatOnRent = isVAT ? rentValue * 0.15 : 0;
  const otherAmtExcl = Number(c.otherInstallment || 0);
  const firstAmtExcl = Number(c.firstInstallment || 0) + upfrontPaid;
  const vatOnOneTime = isVAT ? Math.max(0, firstAmtExcl - otherAmtExcl) * 0.15 : 0;
  const effectiveTotal = (c.totalValue || 0) + upfrontPaid + vatOnRent + vatOnOneTime;
  const priorOutstanding = Math.max(0, Number((c as any).priorLeaseOutstandingAtRenewal) || 0);
  const totalDueIncludingPrior = effectiveTotal + priorOutstanding;
  const remaining = Math.max(0, effectiveTotal - paid);
  const remainingIncludingPrior = Math.max(0, totalDueIncludingPrior - paid);
  const percent = effectiveTotal > 0 ? Math.min(100, Math.round((paid / effectiveTotal) * 100)) : 0;
  const percentIncludingPrior =
    totalDueIncludingPrior > 0 ? Math.min(100, Math.round((paid / totalDueIncludingPrior) * 100)) : percent;
  return {
    paid,
    effectiveTotal,
    remaining,
    percent,
    priorOutstanding,
    totalDueIncludingPrior,
    remainingIncludingPrior,
    percentIncludingPrior,
  };
}

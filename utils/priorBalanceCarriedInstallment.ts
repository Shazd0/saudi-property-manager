import type { Building } from '../types';
import { getInstallmentRange, getInstallmentStartDates } from './installmentSchedule';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from './contractTransactionFilter';
import { nonResFeeDueForInstallment } from './nonResidentialFeeSchedule';

function coerceYmd(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : ymdFromDate(d);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return ymdFromDate(v);
  if (typeof v === 'object' && v !== null) {
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') {
      try {
        const d = o.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return ymdFromDate(d);
      } catch {
        /* ignore */
      }
    }
    const sec = typeof o.seconds === 'number' ? o.seconds : typeof o._seconds === 'number' ? o._seconds : NaN;
    if (!Number.isNaN(sec)) {
      const d = new Date(sec * 1000);
      return isNaN(d.getTime()) ? '' : ymdFromDate(d);
    }
  }
  return '';
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type CarriedPriorInstallmentWindow = {
  installmentNo: number;
  totalInstallments: number;
  startDate: Date;
  endDate: Date;
  /** That installment's due date on the prior (ended) contract — same basis as Monitoring rent rows. */
  dueDateYmd: string;
};

/**
 * On the ended (prior) contract, find the first installment that was still unpaid at renewal
 * (payments through renewal date, same FIFO as Monitoring). Used to show that installment's
 * date window instead of the whole lease from→to.
 */
export function getCarriedPriorInstallmentWindow(opts: {
  priorContract: any;
  renewalYmd: string;
  buildings: Building[];
  catalog: any[];
  transactions: any[];
}): CarriedPriorInstallmentWindow | null {
  const { priorContract: p, renewalYmd, buildings, catalog, transactions } = opts;
  if (!p || !renewalYmd) return null;

  const nonResContract = isNonResidentialBuildingForContract(buildings, p);
  const totalInstallments = Number(p.installmentCount) > 0 ? Number(p.installmentCount) : 1;
  const upfrontPaid = Number((p as any).upfrontPaid || 0);

  const rentTxs = transactions.filter((tx: any) => {
    if (!tx) return false;
    if ((tx as any).feesEntry) return false;
    if (!transactionAppliesToContract(tx, p, catalog)) return false;
    if (!tx.date) return true;
    const tYmd = coerceYmd(tx.date);
    if (!tYmd) return false;
    return tYmd <= renewalYmd;
  });

  const paidRawIncl = rentTxs.reduce((s: number, tx: any) => {
    return (
      s +
      (Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount) || 0) +
      (Number((tx as any).discountAmount) || 0) +
      (Number((tx as any).extraAmount) || 0) +
      (Number((tx as any).bonusAmount) || 0) -
      (Number((tx as any).deductionAmount) || 0)
    );
  }, 0);
  const paid = paidRawIncl + upfrontPaid;
  const priorOnPrior = Math.max(0, Number((p as any).priorLeaseOutstandingAtRenewal) || 0);
  const paidForInstallments = Math.max(0, paid - priorOnPrior);

  const bld = buildings.find((b) => b.id === p.buildingId) || {};
  const rentValue = Number((p as any).rentValue || 0);
  const rentPerInstIncl = totalInstallments > 0 ? rentValue / totalInstallments : 0;
  const first = Math.round(rentPerInstIncl);
  const other = Math.round(rentPerInstIncl);

  const totalValueStored = Number((p as any).totalValue || 0);
  const effectiveContractTotal = totalValueStored + upfrontPaid;
  let resScheduleFirst = Number((p as any).firstInstallment || 0) + upfrontPaid;
  const resScheduleOther = Number((p as any).otherInstallment || 0);
  const sumSchedule = resScheduleFirst + resScheduleOther * Math.max(0, totalInstallments - 1);
  if (
    effectiveContractTotal > 0 &&
    Math.abs(sumSchedule - effectiveContractTotal) > Math.max(5, totalInstallments)
  ) {
    resScheduleFirst = Math.max(
      0,
      effectiveContractTotal - resScheduleOther * Math.max(0, totalInstallments - 1),
    );
  }
  const resScheduleFirstRounded = Math.round(resScheduleFirst);
  const resScheduleOtherRounded = Math.round(resScheduleOther);
  const useResidentialStoredSchedule =
    !nonResContract &&
    (totalValueStored > 0 ||
      Number((p as any).firstInstallment) > 0 ||
      Number((p as any).otherInstallment) > 0);

  const resFeeDueForInstallment = (contract: any, instNo: number): number => {
    const count = Number(contract.installmentCount) > 0 ? Number(contract.installmentCount) : 1;
    const water = Number(contract.waterFee || 0);
    const internet = Number(contract.internetFee || 0);
    const parking = Number(contract.parkingFee || 0);
    const periodicTotal = water + internet + parking;
    const periodicPerInst = count > 0 ? periodicTotal / count : 0;
    const management = Number(contract.managementFee || 0);
    const office = Number(contract.officeFeeAmount || 0);
    const service = Number(contract.serviceFee || 0);
    const insurance = Number(contract.insuranceFee || 0);
    const other = Number(contract.otherAmount || 0);
    const deduction = Number(contract.otherDeduction || 0);
    const oneTime = management + office + service + insurance + other - deduction;
    const fees = periodicPerInst + (instNo === 1 ? oneTime : 0);
    return Math.max(0, Math.round(fees));
  };

  const feePaidRaw = nonResContract
    ? transactions
        .filter((tx: any) => {
          if (!tx || !(tx as any).feesEntry) return false;
          if (!transactionAppliesToContract(tx, p, catalog)) return false;
          if (!tx.date) return true;
          const tYmd = coerceYmd(tx.date);
          if (!tYmd) return false;
          return tYmd <= renewalYmd;
        })
        .reduce((s: number, tx: any) => s + (Number(tx.amount) || 0), 0)
    : 0;

  const dueDates = getInstallmentStartDates({
    fromDate: p.fromDate,
    toDate: p.toDate,
    periodMonths: Number(p.periodMonths) || 0,
    periodDays: Number(p.periodDays) || 0,
    installmentCount: totalInstallments,
  });

  const installments: { instNo: number; rentAmt: number; feesAmt: number }[] = [];
  for (let i = 0; i < totalInstallments; i++) {
    const d = dueDates[i];
    if (!d || isNaN(d.getTime())) continue;
    const instNo = i + 1;
    let rentAmt: number;
    let feesAmt: number;
    if (nonResContract) {
      rentAmt = i === 0 ? first : other;
      feesAmt = nonResFeeDueForInstallment(p, instNo);
    } else if (useResidentialStoredSchedule) {
      rentAmt = i === 0 ? resScheduleFirstRounded : resScheduleOtherRounded;
      feesAmt = 0;
    } else {
      rentAmt = i === 0 ? first : other;
      feesAmt = resFeeDueForInstallment(p, instNo);
    }
    installments.push({ instNo, rentAmt, feesAmt });
  }

  if (installments.length === 0) return null;

  let rentCumulatedBefore = 0;
  let feesCumulatedBefore = 0;
  let totalCumulatedBefore = 0;
  let hitInstNo: number | null = null;

  for (let i = 0; i < installments.length; i++) {
    const inst = installments[i];
    const rentAmt = inst.rentAmt;
    const feesAmt = inst.feesAmt;
    let rentRemaining = rentAmt;
    let feesRemaining = feesAmt;

    if (nonResContract) {
      const rentPaidTowardInst = Math.max(0, Math.min(rentAmt, paidForInstallments - rentCumulatedBefore));
      rentRemaining = Math.max(0, rentAmt - rentPaidTowardInst);
      rentCumulatedBefore += rentAmt;
      const feesPaidTowardInst = Math.max(0, Math.min(feesAmt, feePaidRaw - feesCumulatedBefore));
      feesRemaining = Math.max(0, feesAmt - feesPaidTowardInst);
      feesCumulatedBefore += feesAmt;
    } else if (useResidentialStoredSchedule) {
      const instTotal = rentAmt;
      const paidTowardInst = Math.max(0, Math.min(instTotal, paidForInstallments - totalCumulatedBefore));
      const remainingTotal = Math.max(0, instTotal - paidTowardInst);
      totalCumulatedBefore += instTotal;
      rentRemaining = remainingTotal;
      feesRemaining = 0;
    } else {
      const instTotal = rentAmt + feesAmt;
      const paidTowardInst = Math.max(0, Math.min(instTotal, paidForInstallments - totalCumulatedBefore));
      const remainingTotal = Math.max(0, instTotal - paidTowardInst);
      totalCumulatedBefore += instTotal;
      if (instTotal > 0) {
        const rentShare = rentAmt / instTotal;
        rentRemaining = Math.round(remainingTotal * rentShare);
        feesRemaining = Math.max(0, Math.round(remainingTotal - rentRemaining));
      } else {
        rentRemaining = 0;
        feesRemaining = 0;
      }
    }

    if (rentRemaining > 0 || feesRemaining > 0) {
      hitInstNo = inst.instNo;
      break;
    }
  }

  if (hitInstNo == null) return null;

  const { startDate, endDate } = getInstallmentRange(
    {
      fromDate: p.fromDate,
      toDate: p.toDate,
      periodMonths: Number(p.periodMonths) || 0,
      periodDays: Number(p.periodDays) || 0,
      installmentCount: totalInstallments,
    },
    hitInstNo,
  );

  const dueForHit = dueDates[hitInstNo - 1];
  const dueDateYmd =
    dueForHit && !isNaN(dueForHit.getTime()) ? ymdFromDate(dueForHit) : ymdFromDate(startDate);

  return {
    installmentNo: hitInstNo,
    totalInstallments,
    startDate,
    endDate,
    dueDateYmd,
  };
}

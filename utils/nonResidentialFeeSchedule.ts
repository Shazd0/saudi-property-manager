import { getInstallmentRange } from './installmentSchedule';
import { dateToLocalStr } from './dateFormat';

/**
 * Non-residential contract: non-VAT fee amounts that can be collected via feesEntry,
 * aligned with “utilities-style” spreading — insurance / service / office / other (+) /
 * deduction (-) are prorated across every installment like water, not lumped on #1 only.
 * Management (Ejar) stays on installment 1 only (matches ContractForm non-VAT first payment).
 */
/** One line in the non-VAT fee breakdown (matches {@link nonResSpreadableFeePool} + management). */
export type NonResFeeBreakdownLine = {
  key: string;
  /** i18n dictionary key for the label */
  labelKey: string;
  /** Contract-level total for the line. Deductions are negative (same sign as in the pool). */
  val: number;
  firstInstallmentOnly: boolean;
};

/**
 * Line items for UI / invoices: all fees that roll into {@link nonResFeeDueForInstallment},
 * in a stable order. Omits zero lines; includes other deduction as one negative row.
 */
export function getNonResFeeBreakdownLines(contract: any): NonResFeeBreakdownLine[] {
  const renewal = !!(contract as any).renewedFromId;
  const insuranceVal = renewal ? 0 : Number((contract as any).insuranceFee) || 0;
  const ded = Number((contract as any).otherDeduction) || 0;

  const lines: NonResFeeBreakdownLine[] = [
    { key: 'water', labelKey: 'contract.waterFeeShort', val: Number((contract as any).waterFee) || 0, firstInstallmentOnly: false },
    { key: 'internet', labelKey: 'contract.internetFeeShort', val: Number((contract as any).internetFee) || 0, firstInstallmentOnly: false },
    { key: 'parking', labelKey: 'contract.parkingFee', val: Number((contract as any).parkingFee) || 0, firstInstallmentOnly: false },
  ];
  if (insuranceVal > 0.0001) {
    lines.push({ key: 'insurance', labelKey: 'contract.insuranceFee', val: insuranceVal, firstInstallmentOnly: true });
  }
  lines.push(
    { key: 'service', labelKey: 'contract.serviceFee', val: Number((contract as any).serviceFee) || 0, firstInstallmentOnly: true },
    { key: 'office', labelKey: 'contract.officeFeeAmount', val: Number((contract as any).officeFeeAmount) || 0, firstInstallmentOnly: true },
    { key: 'other', labelKey: 'contract.otherAmount', val: Number((contract as any).otherAmount) || 0, firstInstallmentOnly: true },
  );
  if (ded > 0.0001) {
    lines.push({ key: 'otherDeduction', labelKey: 'contract.otherDeduction', val: -ded, firstInstallmentOnly: true });
  }
  lines.push({
    key: 'management',
    labelKey: 'contract.managementFee',
    val: Number((contract as any).managementFee) || 0,
    firstInstallmentOnly: true,
  });
  return lines.filter((l) => Math.abs(l.val) > 0.0001);
}

export function nonResSpreadableFeePool(contract: any): number {
  return (
    (Number((contract as any).waterFee) || 0) +
    (Number((contract as any).internetFee) || 0) +
    (Number((contract as any).parkingFee) || 0)
  );
}

/** 1-based installment index. */
export function nonResFeeDueForInstallment(contract: any, installmentNo1Based: number): number {
  const count = Math.max(1, Number((contract as any).installmentCount) || 1);
  const pool = nonResSpreadableFeePool(contract);
  const per = count > 0 ? pool / count : 0;
  const mgmt = Number((contract as any).managementFee) || 0;
  const renewal = !!(contract as any).renewedFromId;
  const insurance = renewal ? 0 : Number((contract as any).insuranceFee) || 0;
  const service = Number((contract as any).serviceFee) || 0;
  const office = Number((contract as any).officeFeeAmount) || 0;
  const other = Number((contract as any).otherAmount) || 0;
  const deduction = Number((contract as any).otherDeduction) || 0;
  const inst = Math.min(Math.max(1, installmentNo1Based || 1), count);
  const oneTime =
    insurance +
    service +
    office +
    other -
    deduction;
  return Math.round(per + (inst === 1 ? (mgmt + oneTime) : 0));
}

export type NonResFeePeriodContext = {
  /** Installment whose fee window still has a balance; null when every period is satisfied. */
  activeInstallment: number | null;
  nonVatPerInst: number;
  feesPaidThisInst: number;
  feesRemaining: number;
  allPeriodsPaid: boolean;
  hasConfiguredFees: boolean;
  feeStartStr: string;
  feeEndStr: string;
};

function sumFeesEntryInPeriod(
  prevPayments: ReadonlyArray<any>,
  feeStartStr: string,
  feeEndStr: string,
): number {
  const parse = (value: string): number | null => {
    const s = String(value || '').trim();
    // Accept YYYY-M-D or YYYY-MM-DD
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const dmy = !m ? s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/) : null;
    const y = Number(m ? m[1] : dmy ? dmy[3] : NaN);
    const mo = Number(m ? m[2] : dmy ? dmy[2] : NaN);
    const d = Number(m ? m[3] : dmy ? dmy[1] : NaN);
    if (!y || !mo || !d) return null;
    const dt = new Date(y, mo - 1, d);
    const t = dt.getTime();
    return Number.isNaN(t) ? null : t;
  };
  const startT = parse(feeStartStr);
  const endT = parse(feeEndStr);
  if (startT == null || endT == null) return 0;

  return prevPayments
    .filter(
      (t) =>
        (t as any).feesEntry === true &&
        (() => {
          const tt = parse(String((t as any).date || ''));
          return tt != null && tt >= startT && tt <= endT;
        })(),
    )
    .reduce((sum, t) => sum + (Number(t.amount) || 0) + (Number((t as any).discountAmount) || 0), 0);
}

function allocateFeesPaymentsFIFO(
  contract: any,
  prevPayments: ReadonlyArray<any>,
): { totalInst: number; dueByInst: number[]; paidByInst: number[] } {
  const totalInst = Math.max(1, Number((contract as any).installmentCount) || 1);
  const dueByInst = Array.from({ length: totalInst }, (_, i) =>
    Math.max(0, Number(nonResFeeDueForInstallment(contract, i + 1)) || 0),
  );

  // Allocate all feesEntry payments sequentially across fee installments (FIFO),
  // so the "next period" logic does not break if a user entered a payment date outside the period.
  // We still keep the period date ranges for display using getInstallmentRange.
  const feeTxs = prevPayments
    .filter((t) => (t as any).feesEntry === true)
    .map((t) => ({
      amount: (Number((t as any).amount) || 0) + (Number((t as any).discountAmount) || 0),
      dateStr: String((t as any).date || ''),
    }))
    .filter((x) => x.amount > 0.0001);

  const parse = (value: string): number => {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const dmy = !m ? s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/) : null;
    const y = Number(m ? m[1] : dmy ? dmy[3] : NaN);
    const mo = Number(m ? m[2] : dmy ? dmy[2] : NaN);
    const d = Number(m ? m[3] : dmy ? dmy[1] : NaN);
    if (!y || !mo || !d) return Number.POSITIVE_INFINITY;
    const dt = new Date(y, mo - 1, d);
    const t = dt.getTime();
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };

  feeTxs.sort((a, b) => parse(a.dateStr) - parse(b.dateStr));

  const paidByInst = Array.from({ length: totalInst }, () => 0);
  let instIdx = 0;
  let instRemaining = dueByInst[0] || 0;
  for (const tx of feeTxs) {
    let remaining = tx.amount;
    while (remaining > 0.0001 && instIdx < totalInst) {
      if (instRemaining <= 0.0001) {
        instIdx += 1;
        instRemaining = dueByInst[instIdx] || 0;
        continue;
      }
      const applied = Math.min(instRemaining, remaining);
      paidByInst[instIdx] += applied;
      instRemaining -= applied;
      remaining -= applied;
    }
    if (instIdx >= totalInst) break;
  }

  return { totalInst, dueByInst, paidByInst };
}

/**
 * First fee period that still has a balance (skips periods already paid in full).
 * When all periods are paid, {@link allPeriodsPaid} is true and dates refer to the last lease period.
 */
export function getNonResFeePeriodContext(
  contract: any,
  prevPayments: ReadonlyArray<any>,
): NonResFeePeriodContext {
  const totalInst = Math.max(1, Number((contract as any).installmentCount) || 1);
  const empty: NonResFeePeriodContext = {
    activeInstallment: null,
    nonVatPerInst: 0,
    feesPaidThisInst: 0,
    feesRemaining: 0,
    allPeriodsPaid: false,
    hasConfiguredFees: false,
    feeStartStr: '',
    feeEndStr: '',
  };

  let hasConfiguredFees = false;
  for (let k = 1; k <= totalInst; k++) {
    if (nonResFeeDueForInstallment(contract, k) > 0.01) {
      hasConfiguredFees = true;
      break;
    }
  }
  if (!hasConfiguredFees) {
    return { ...empty, hasConfiguredFees: false };
  }

  const { totalInst: _ti, dueByInst, paidByInst } = allocateFeesPaymentsFIFO(contract, prevPayments);

  let active: number | null = null;
  for (let k = 1; k <= totalInst; k++) {
    const due = nonResFeeDueForInstallment(contract, k);
    if (due <= 0.01) continue;
    const paid = paidByInst[k - 1] || 0;
    if (paid < due - 0.02) {
      active = k;
      break;
    }
  }

  const { startDate: lastStart, endDate: lastEnd } = getInstallmentRange(contract, totalInst);
  const lastStartStr = dateToLocalStr(lastStart);
  const lastEndStr = dateToLocalStr(lastEnd);

  if (active != null) {
    const due = nonResFeeDueForInstallment(contract, active);
    const paid = paidByInst[active - 1] || 0;
    const { startDate, endDate } = getInstallmentRange(contract, active);
    return {
      activeInstallment: active,
      nonVatPerInst: due,
      feesPaidThisInst: paid,
      feesRemaining: Math.max(0, due - paid),
      allPeriodsPaid: false,
      hasConfiguredFees: true,
      feeStartStr: dateToLocalStr(startDate),
      feeEndStr: dateToLocalStr(endDate),
    };
  }

  return {
    activeInstallment: null,
    nonVatPerInst: 0,
    feesPaidThisInst: 0,
    feesRemaining: 0,
    allPeriodsPaid: true,
    hasConfiguredFees: true,
    feeStartStr: lastStartStr,
    feeEndStr: lastEndStr,
  };
}

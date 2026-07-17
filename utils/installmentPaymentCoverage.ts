import type { Contract, Transaction } from '../types';

export type PaymentCoverageItem =
  | { kind: 'upfront'; amount: number }
  | { kind: 'transaction'; amount: number; transaction: Transaction };

type Source = {
  kind: 'upfront' | 'transaction';
  inclRemaining: number;
  exclRemaining: number;
  transaction?: Transaction;
};

type Bucket = {
  kind: 'prior' | 'installment';
  installmentNo?: number;
  capacity: number;
  basis: 'incl' | 'excl';
  allocations: PaymentCoverageItem[];
};

const txInclusive = (t: Transaction): number =>
  Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount || 0) +
  Number((t as any).discountAmount || 0);

const txExclusive = (t: Transaction): number =>
  Number(t.amount || 0) + Number((t as any).discountAmount || 0);

function buildSources(contract: Contract, payments: Transaction[]): Source[] {
  const sources: Source[] = [];
  const upfront = Number((contract as any).upfrontPaid || 0);
  if (upfront > 0) {
    sources.push({ kind: 'upfront', inclRemaining: upfront, exclRemaining: upfront });
  }
  const sorted = [...payments].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );
  for (const tx of sorted) {
    sources.push({
      kind: 'transaction',
      inclRemaining: txInclusive(tx),
      exclRemaining: txExclusive(tx),
      transaction: tx,
    });
  }
  return sources;
}

function consumeInclusive(src: Source, takeIncl: number): void {
  if (takeIncl <= 0 || src.inclRemaining <= 0) return;
  const ratio = takeIncl / src.inclRemaining;
  src.inclRemaining = Math.max(0, src.inclRemaining - takeIncl);
  src.exclRemaining = Math.max(0, src.exclRemaining - src.exclRemaining * ratio);
}

function consumeExclusive(src: Source, takeExcl: number): number {
  if (takeExcl <= 0 || src.exclRemaining <= 0) return 0;
  const take = Math.min(takeExcl, src.exclRemaining);
  const ratio = take / src.exclRemaining;
  const displayTake =
    src.kind === 'upfront'
      ? take
      : src.inclRemaining > 0
        ? src.inclRemaining * ratio
        : take;
  src.exclRemaining = Math.max(0, src.exclRemaining - take);
  src.inclRemaining = Math.max(0, src.inclRemaining - src.inclRemaining * ratio);
  return displayTake;
}

function pushAllocation(
  bucket: Bucket,
  src: Source,
  amount: number,
): void {
  if (amount <= 0) return;
  if (src.kind === 'upfront') {
    bucket.allocations.push({ kind: 'upfront', amount });
  } else if (src.transaction) {
    bucket.allocations.push({ kind: 'transaction', amount, transaction: src.transaction });
  }
}

function fillBucket(bucket: Bucket, sources: Source[]): void {
  let need = bucket.capacity;
  for (const src of sources) {
    if (need <= 0) break;
    if (bucket.basis === 'incl') {
      const available = src.inclRemaining;
      if (available <= 0) continue;
      const take = Math.min(need, available);
      pushAllocation(bucket, src, take);
      consumeInclusive(src, take);
      need -= take;
    } else {
      const available = src.exclRemaining;
      if (available <= 0) continue;
      const takeExcl = Math.min(need, available);
      const display = consumeExclusive(src, takeExcl);
      pushAllocation(bucket, src, display);
      need -= takeExcl;
    }
  }
}

/** FIFO payment coverage per prior-lease bucket and each schedule installment. */
export function computeInstallmentPaymentCoverage(params: {
  contract: Contract;
  payments: Transaction[];
  priorOutstanding: number;
  firstInstAmt: number;
  otherInstAmt: number;
  totalInst: number;
}): {
  prior: { paid: number; allocations: PaymentCoverageItem[] };
  installments: Array<{ no: number; paid: number; allocations: PaymentCoverageItem[] }>;
} {
  const { contract, payments, priorOutstanding, firstInstAmt, otherInstAmt, totalInst } = params;
  const sources = buildSources(contract, payments);

  const priorBucket: Bucket = {
    kind: 'prior',
    capacity: Math.max(0, priorOutstanding),
    basis: 'incl',
    allocations: [],
  };
  fillBucket(priorBucket, sources);

  const installmentBuckets: Bucket[] = [];
  for (let i = 1; i <= totalInst; i++) {
    installmentBuckets.push({
      kind: 'installment',
      installmentNo: i,
      capacity: i === 1 ? firstInstAmt : otherInstAmt,
      basis: 'excl',
      allocations: [],
    });
  }
  for (const bucket of installmentBuckets) {
    fillBucket(bucket, sources);
  }

  const mergeAllocations = (items: PaymentCoverageItem[]): PaymentCoverageItem[] => {
    const merged: PaymentCoverageItem[] = [];
    for (const item of items) {
      if (item.kind === 'upfront') {
        const existing = merged.find((m) => m.kind === 'upfront');
        if (existing && existing.kind === 'upfront') existing.amount += item.amount;
        else merged.push({ ...item });
      } else {
        const existing = merged.find(
          (m) => m.kind === 'transaction' && m.transaction.id === item.transaction.id,
        );
        if (existing && existing.kind === 'transaction') existing.amount += item.amount;
        else merged.push({ ...item });
      }
    }
    return merged.filter((m) => m.amount > 0.005);
  };

  const priorAllocations = mergeAllocations(priorBucket.allocations);

  return {
    prior: {
      paid: priorAllocations.reduce((s, a) => s + a.amount, 0),
      allocations: priorAllocations,
    },
    installments: installmentBuckets.map((b) => ({
      no: b.installmentNo!,
      paid: b.allocations.reduce((s, a) => s + a.amount, 0),
      allocations: mergeAllocations(b.allocations),
    })),
  };
}

/** Opens the linked transaction in History (detail modal) in a new browser tab. */
export function openTransactionInHistoryNewTab(tx: Transaction): void {
  if (!tx.id) return;
  const base = `${window.location.origin}${window.location.pathname}`;
  window.open(`${base}#/history?txId=${encodeURIComponent(tx.id)}`, '_blank', 'noopener,noreferrer');
}

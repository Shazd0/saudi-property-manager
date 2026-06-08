import type { BankStatement, ReconciliationRecord, Transaction } from '../types';
import { fuzzyContains } from './fuzzyMatch';

export type ReconciliationHint = {
  id: string;
  descriptionPattern: string;
  bankName?: string;
  mapsTo: { type: 'customer' | 'employee' | 'vendor' | 'generic'; id?: string; name?: string };
  createdAt: number;
};

export type MatchCandidate = {
  transactionId: string;
  score: number;
  reasons: string[];
};

export type UnmatchedSuggestion = {
  label: string;
  detail: string;
  confidence: number;
};

export type ReconContext = {
  hints: ReconciliationHint[];
  recurringPatterns: RecurringPattern[];
  matchedTxIds: Set<string>;
};

export type RecurringPattern = {
  amount: number;
  dayOfMonth: number;
  kind: 'rent' | 'salary' | 'expense';
  sampleTxId?: string;
  label: string;
};

const HINTS_LS_KEY = 'amlak_recon_hints';

export function loadReconciliationHints(): ReconciliationHint[] {
  try {
    const raw = localStorage.getItem(HINTS_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveReconciliationHints(hints: ReconciliationHint[]): void {
  try {
    localStorage.setItem(HINTS_LS_KEY, JSON.stringify(hints.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function recordLearnedHint(stmt: BankStatement, tx: Transaction): void {
  const desc = (stmt.description || '').trim();
  if (!desc || desc.length < 4) return;
  const words = desc.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
  const pattern = words.join(' ').toLowerCase();
  if (!pattern) return;

  const hints = loadReconciliationHints();
  const existing = hints.find(
    (h) => h.descriptionPattern === pattern && h.bankName === stmt.bankName,
  );
  const mapsTo: ReconciliationHint['mapsTo'] = tx.customerName
    ? { type: 'customer', name: tx.customerName }
    : tx.employeeName
      ? { type: 'employee', id: tx.employeeId, name: tx.employeeName }
      : tx.vendorName
        ? { type: 'vendor', id: tx.vendorId, name: tx.vendorName }
        : { type: 'generic', name: tx.details };

  if (existing) {
    existing.mapsTo = mapsTo;
    existing.createdAt = Date.now();
  } else {
    hints.unshift({
      id: crypto.randomUUID(),
      descriptionPattern: pattern,
      bankName: stmt.bankName,
      mapsTo,
      createdAt: Date.now(),
    });
  }
  saveReconciliationHints(hints.slice(0, 100));
}

export function detectRecurringPatterns(transactions: Transaction[]): RecurringPattern[] {
  const bankTxs = transactions.filter(
    (t) => t.paymentMethod === 'BANK' && t.status !== 'REJECTED',
  );
  const groups = new Map<string, Transaction[]>();

  for (const t of bankTxs) {
    const amt = Math.round(Number(t.amount) || 0);
    if (amt < 100) continue;
    const d = new Date(t.date);
    const dom = d.getDate();
    const key = `${amt}|${dom}`;
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  }

  const patterns: RecurringPattern[] = [];
  for (const [key, arr] of groups) {
    if (arr.length < 3) continue;
    const [amtStr, domStr] = key.split('|');
    const amt = Number(amtStr);
    const sample = arr[0];
    const kind =
      sample.type === 'INCOME'
        ? 'rent'
        : sample.expenseCategory === 'Salary'
          ? 'salary'
          : 'expense';
    patterns.push({
      amount: amt,
      dayOfMonth: Number(domStr),
      kind,
      sampleTxId: sample.id,
      label: `${kind === 'rent' ? 'Rent' : kind === 'salary' ? 'Salary' : 'Expense'} ~${amt.toLocaleString()} SAR around day ${domStr}`,
    });
  }
  return patterns.slice(0, 20);
}

export function scoreStatementToTransaction(
  stmt: BankStatement,
  tx: Transaction,
  ctx: ReconContext,
): MatchCandidate {
  const stmtAmount = stmt.credit || stmt.debit;
  const stmtDate = new Date(stmt.transactionDate).getTime();
  const txDate = new Date(tx.date).getTime();
  const dateDiff = Math.abs(stmtDate - txDate) / 86400000;

  const reasons: string[] = [];
  let score = 0;

  if (Math.abs(tx.amount - stmtAmount) < 1) {
    score += 40;
    reasons.push('amount');
  }
  if (dateDiff <= 3) {
    score += 25;
    reasons.push('date');
  }
  if (dateDiff < 1) {
    score += 10;
    reasons.push('exact_date');
  }
  if (stmt.referenceNo && tx.id && stmt.description?.includes(tx.id.slice(-6))) {
    score += 15;
    reasons.push('reference');
  }

  const desc = (stmt.description || '').toLowerCase();
  const custName = (tx.customerName || tx.details || '').toLowerCase();
  if (custName && fuzzyContains(custName.split(' ')[0], desc)) {
    score += 20;
    reasons.push('customer_name');
  }

  for (const h of ctx.hints) {
    if (h.bankName && h.bankName !== stmt.bankName) continue;
    if (!desc.includes(h.descriptionPattern)) continue;
    if (h.mapsTo.name && fuzzyContains(h.mapsTo.name, custName || tx.details || '')) {
      score += 25;
      reasons.push('learned_hint');
      break;
    }
    if (h.mapsTo.type !== 'generic') {
      score += 15;
      reasons.push('learned_hint');
      break;
    }
  }

  for (const p of ctx.recurringPatterns) {
    if (Math.abs(p.amount - stmtAmount) < 1 && Math.abs(p.dayOfMonth - new Date(stmt.transactionDate).getDate()) <= 3) {
      score += 15;
      reasons.push('recurring');
      break;
    }
  }

  return { transactionId: tx.id, score, reasons };
}

export function findBestMatch(
  stmt: BankStatement,
  transactions: Transaction[],
  ctx: ReconContext,
): MatchCandidate | null {
  let best: MatchCandidate | null = null;
  for (const tx of transactions) {
    if (ctx.matchedTxIds.has(tx.id)) continue;
    if (tx.paymentMethod !== 'BANK') continue;
    const cand = scoreStatementToTransaction(stmt, tx, ctx);
    if (cand.score >= 50 && (!best || cand.score > best.score)) {
      best = cand;
    }
  }
  return best;
}

export function suggestUnmatched(
  stmt: BankStatement,
  transactions: Transaction[],
  ctx: ReconContext,
): UnmatchedSuggestion | null {
  const amt = stmt.credit || stmt.debit;
  const dom = new Date(stmt.transactionDate).getDate();

  for (const p of ctx.recurringPatterns) {
    if (Math.abs(p.amount - amt) < 1 && Math.abs(p.dayOfMonth - dom) <= 3) {
      return {
        label: p.label,
        detail: `Recurring pattern (${p.kind})`,
        confidence: 75,
      };
    }
  }

  const salaryTxs = transactions.filter(
    (t) => t.expenseCategory === 'Salary' && Math.abs((t.amount || 0) - amt) < 1,
  );
  if (stmt.debit > 0 && salaryTxs.length > 0) {
    const tx = salaryTxs[0];
    return {
      label: 'Likely salary',
      detail: tx.employeeName ? `Matches ${tx.employeeName}` : tx.details || '',
      confidence: 65,
    };
  }

  const rentTxs = transactions.filter(
    (t) => t.type === 'INCOME' && Math.abs((t.amount || 0) - amt) < 1,
  );
  if (stmt.credit > 0 && rentTxs.length > 0) {
    const tx = rentTxs[0];
    return {
      label: 'Likely rent',
      detail: [tx.buildingName, tx.unitNumber, tx.customerName].filter(Boolean).join(' / '),
      confidence: 60,
    };
  }

  for (const h of ctx.hints) {
    if ((stmt.description || '').toLowerCase().includes(h.descriptionPattern)) {
      return {
        label: `Learned: ${h.mapsTo.type}`,
        detail: h.mapsTo.name || h.descriptionPattern,
        confidence: 70,
      };
    }
  }

  return null;
}

export function findSplitMatchCandidates(
  stmt: BankStatement,
  transactions: Transaction[],
  ctx: ReconContext,
  maxParts = 3,
): string[] | null {
  const target = stmt.credit || stmt.debit;
  if (target < 2) return null;

  const pool = transactions.filter(
    (t) =>
      !ctx.matchedTxIds.has(t.id) &&
      t.paymentMethod === 'BANK' &&
      t.type === 'INCOME',
  );

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length && maxParts >= 2; j++) {
      const sum = pool[i].amount + pool[j].amount;
      if (Math.abs(sum - target) < 1) {
        return [pool[i].id, pool[j].id];
      }
      if (maxParts >= 3) {
        for (let k = j + 1; k < pool.length; k++) {
          const sum3 = sum + pool[k].amount;
          if (Math.abs(sum3 - target) < 1) {
            return [pool[i].id, pool[j].id, pool[k].id];
          }
        }
      }
    }
  }
  return null;
}

export function getMatchedTransactionIds(reconciliations: ReconciliationRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const r of reconciliations) {
    if (r.transactionId) ids.add(r.transactionId);
    for (const tid of r.transactionIds || []) ids.add(tid);
  }
  return ids;
}

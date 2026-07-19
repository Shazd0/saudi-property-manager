import { describe, it, expect } from 'vitest';
import { TransactionType } from '../types';
import {
  computeLedgerSummary,
  enrichLedgerTransactions,
  filterApprovedLedgerTransactions,
} from '../utils/ledgerSummary';

describe('enrichLedgerTransactions', () => {
  it('does not double-inject Building↔Owner when a real transferId row exists', () => {
    const transactions = [
      {
        id: 'tx1',
        date: '2026-07-01',
        type: TransactionType.EXPENSE,
        amount: 726.82,
        transferId: 'tr1',
        buildingId: 'b1',
        source: 'treasury',
        fromType: 'BUILDING',
        toType: 'OWNER',
        status: 'APPROVED',
        paymentMethod: 'TREASURY',
        originalPaymentMethod: 'CASH',
      },
    ] as any;
    const transfers = [
      {
        id: 'tr1',
        date: '2026-07-01',
        amount: 726.82,
        fromType: 'BUILDING',
        toType: 'OWNER',
        fromId: 'b1',
        toId: 'owner1',
        paymentMethod: 'CASH',
        status: 'APPROVED',
      },
    ];
    const enriched = enrichLedgerTransactions(transactions, transfers);
    expect(enriched.filter((t) => String(t.id).startsWith('pseudo_'))).toHaveLength(0);
    expect(enriched).toHaveLength(1);
  });

  it('injects Building↔Owner pseudo when ledger row is missing', () => {
    const transfers = [
      {
        id: 'tr2',
        date: '2026-07-02',
        amount: 100,
        fromType: 'BUILDING',
        toType: 'OWNER',
        fromId: 'b1',
        toId: 'owner1',
        paymentMethod: 'BANK',
        status: 'APPROVED',
      },
    ];
    const enriched = enrichLedgerTransactions([], transfers);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].id).toBe('pseudo_tr2');
    expect(enriched[0].type).toBe('EXPENSE');
    expect(Number(enriched[0].amount)).toBe(100);
  });
});

describe('computeLedgerSummary', () => {
  it('matches opening + period income - expense for net balance', () => {
    const rows = [
      { id: '1', date: '2026-06-15', type: TransactionType.INCOME, amount: 1000, paymentMethod: 'CASH' },
      { id: '2', date: '2026-06-20', type: TransactionType.EXPENSE, amount: 200, paymentMethod: 'CASH' },
      { id: '3', date: '2026-07-05', type: TransactionType.INCOME, amount: 500, paymentMethod: 'BANK' },
      {
        id: '4',
        date: '2026-07-10',
        type: TransactionType.EXPENSE,
        amount: 115,
        amountExcludingVAT: 100,
        amountIncludingVAT: 115,
        vatAmount: 15,
        paymentMethod: 'CASH',
      },
    ] as any;

    const summary = computeLedgerSummary({
      ledgerRows: filterApprovedLedgerTransactions(rows),
      openingBalancesByBuilding: { b1: { cash: 50, bank: 0 } },
      buildingIds: [],
      currentMonthStart: '2026-07-01',
    });

    // Opening from June: +1000 - 200 = 800, plus settings 50 => 850
    expect(summary.openingTotal).toBe(850);
    // July: income 500, expense 115 (no VAT double-count)
    expect(summary.incomeTotal).toBe(500);
    expect(summary.expenseTotal).toBe(115);
    expect(summary.totalNet).toBe(850 + 500 - 115);
  });

  it('produces identical net for the same inputs (Dashboard === History)', () => {
    const rows = filterApprovedLedgerTransactions(
      enrichLedgerTransactions(
        [
          {
            id: 'tx',
            date: '2026-07-01',
            type: TransactionType.EXPENSE,
            amount: 726.82,
            transferId: 'tr1',
            buildingId: 'b1',
            source: 'treasury',
            fromType: 'BUILDING',
            toType: 'OWNER',
            status: 'APPROVED',
            paymentMethod: 'TREASURY',
            originalPaymentMethod: 'CASH',
          },
          {
            id: 'inc',
            date: '2026-07-03',
            type: TransactionType.INCOME,
            amount: 1000,
            paymentMethod: 'CASH',
            status: 'APPROVED',
          },
        ] as any,
        [
          {
            id: 'tr1',
            date: '2026-07-01',
            amount: 726.82,
            fromType: 'BUILDING',
            toType: 'OWNER',
            fromId: 'b1',
            toId: 'o1',
            paymentMethod: 'CASH',
            status: 'APPROVED',
          },
        ],
      ),
    );

    const a = computeLedgerSummary({ ledgerRows: rows, currentMonthStart: '2026-07-01' });
    const b = computeLedgerSummary({ ledgerRows: rows, currentMonthStart: '2026-07-01' });
    expect(a.totalNet).toBe(b.totalNet);
    expect(a.totalNet).toBe(1000 - 726.82);
  });
});

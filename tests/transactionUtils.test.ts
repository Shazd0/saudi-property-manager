import { describe, it, expect } from 'vitest';
import { getTransactionInclusiveAmount } from '../utils/transactionUtils';
import { TransactionType } from '../types';

describe('getTransactionInclusiveAmount', () => {
  it('keeps EntryForm-style inclusive amount as-is (no VAT double-count)', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.EXPENSE,
      amount: 115,
      amountExcludingVAT: 100,
      amountIncludingVAT: 115,
      totalWithVat: 115,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('recomputes when inclusive field was corrupted to exclusive', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.EXPENSE,
      amount: 100,
      amountExcludingVAT: 100,
      amountIncludingVAT: 100,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('adds VAT when inclusive fields missing and amount looks exclusive', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.EXPENSE,
      amount: 100,
      amountExcludingVAT: 100,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('keeps amount when inclusive fields missing but amount already looks inclusive', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.EXPENSE,
      amount: 115,
      amountExcludingVAT: 100,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('returns amountIncludingVAT for income', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.INCOME,
      amount: 1000,
      amountIncludingVAT: 1150,
      vatAmount: 150,
    } as any)).toBe(1150);
  });

  it('returns plain amount when no VAT fields', () => {
    expect(getTransactionInclusiveAmount({
      type: TransactionType.EXPENSE,
      amount: 250,
    } as any)).toBe(250);
  });
});

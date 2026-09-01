import { describe, it, expect } from 'vitest';
import { getTransactionInclusiveAmount, getTransactionExclusiveAmount } from '../utils/transactionUtils';

describe('getTransactionInclusiveAmount', () => {
  it('returns inclusive fields when present', () => {
    expect(getTransactionInclusiveAmount({
      amount: 100,
      amountExcludingVAT: 100,
      amountIncludingVAT: 115,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('recomputes when inclusive field was corrupted to exclusive', () => {
    expect(getTransactionInclusiveAmount({
      amount: 100,
      amountExcludingVAT: 100,
      amountIncludingVAT: 100,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('detects legacy exclusive amount storage for VAT expenses', () => {
    expect(getTransactionInclusiveAmount({
      amount: 100,
      amountExcludingVAT: 100,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });

  it('keeps EntryForm-style inclusive amount as-is', () => {
    expect(getTransactionInclusiveAmount({
      amount: 115,
      amountExcludingVAT: 100,
      amountIncludingVAT: 115,
      totalWithVat: 115,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(115);
  });
});

describe('getTransactionExclusiveAmount', () => {
  it('prefers amountExcludingVAT', () => {
    expect(getTransactionExclusiveAmount({
      amount: 115,
      amountExcludingVAT: 100,
      amountIncludingVAT: 115,
      isVATApplicable: true,
    } as any)).toBe(100);
  });

  it('derives exclusive from inclusive when exclusive field missing', () => {
    expect(getTransactionExclusiveAmount({
      amount: 115,
      amountIncludingVAT: 115,
      vatAmount: 15,
      isVATApplicable: true,
    } as any)).toBe(100);
  });
});

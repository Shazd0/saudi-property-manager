import { describe, expect, it } from 'vitest';
import { bankAccountKey, bankReferencePatch, countRecordsByBank, recordTouchesBank, rewriteBankReferences } from '../utils/bankAccounts';

describe('bank account merge helpers', () => {
  it('normalizes bank names for matching', () => {
    expect(bankAccountKey('  Al   Rajhi Bank  ')).toBe('al rajhi bank');
  });

  it('counts one transaction once per bank across all bank reference fields', () => {
    const counts = countRecordsByBank([
      { id: 't1', bankName: 'Al Rajhi', fromBankName: 'Al Rajhi' },
      { id: 't2', fromBankName: 'Al Rajhi', toBankName: 'SNB' },
      { id: 't3', bankName: 'SNB' },
      { id: 't4', bankName: '  al   rajhi ' },
    ]);

    expect(counts[bankAccountKey('Al Rajhi')]).toBe(3);
    expect(counts[bankAccountKey('SNB')]).toBe(2);
  });

  it('patches legacy, treasury, and VAT snapshot bank fields during merge', () => {
    const tx = {
      bankName: 'Bank A',
      fromBankName: 'Bank B',
      toBankName: 'Bank C',
      vatReportSnapshot: { bankName: 'Bank A', amount: 100 },
    };

    expect(bankReferencePatch(tx, ['Bank A', 'Bank B'], 'Merged Bank', { includeVatReportSnapshot: true })).toEqual({
      bankName: 'Merged Bank',
      fromBankName: 'Merged Bank',
      vatReportSnapshot: { bankName: 'Merged Bank', amount: 100 },
    });
  });

  it('rewrites only matching bank references', () => {
    const tx = rewriteBankReferences(
      { bankName: 'Bank A', toBankName: 'Bank C' },
      ['Bank A', 'Bank B'],
      'Merged Bank',
    );

    expect(tx).toEqual({ bankName: 'Merged Bank', toBankName: 'Bank C' });
    expect(recordTouchesBank(tx, 'Merged Bank')).toBe(true);
  });
});

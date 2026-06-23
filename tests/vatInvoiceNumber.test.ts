import { describe, expect, it } from 'vitest';
import { getNextVatInvoiceNumber, getNextVatSalesInvoiceNumber } from '../utils/vatInvoiceNumber';

describe('VAT invoice numbering', () => {
  it('numbers sales invoices with SV prefix within each calendar year', () => {
    const txs = [
      { date: '2025-12-31', vatInvoiceNumber: 'SV-8' },
      { date: '2026-01-01', vatInvoiceNumber: 'SV-1' },
      { date: '2026-01-15', vatInvoiceNumber: 'SV-2' },
    ];

    expect(getNextVatSalesInvoiceNumber(txs, '2026-02-01')).toBe('SV-3');
    expect(getNextVatSalesInvoiceNumber(txs, '2027-01-01')).toBe('SV-1');
  });

  it('continues from legacy yearly sales numbers during migration', () => {
    const txs = [
      { date: '2026-01-01', vatInvoiceNumber: '2026-01' },
      { date: '2026-01-02', vatInvoiceNumber: '2026-02' },
    ];

    expect(getNextVatSalesInvoiceNumber(txs, '2026-01-03')).toBe('SV-3');
  });

  it('keeps prefixed credit-note numbering unchanged', () => {
    const txs = [
      { vatInvoiceNumber: 'CN-2026-01' },
      { vatInvoiceNumber: 'CN-2026-02' },
    ];

    expect(getNextVatInvoiceNumber(txs, '2026-01-03', 'CN-')).toBe('CN-2026-03');
  });
});

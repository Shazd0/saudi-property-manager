import { Transaction } from '../types';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveInvoiceYear = (invoiceDate?: string): number => {
  if (!invoiceDate) return new Date().getFullYear();
  const parsed = new Date(invoiceDate);
  if (Number.isNaN(parsed.getTime())) return new Date().getFullYear();
  return parsed.getFullYear();
};

export const getNextVatInvoiceNumber = (
  transactions: Array<Pick<Transaction, 'vatInvoiceNumber'>> | undefined,
  invoiceDate?: string,
  prefix = '',
): string => {
  const year = resolveInvoiceYear(invoiceDate);
  const expression = new RegExp(`^${escapeRegExp(prefix)}${year}-(\\d+)$`);
  let maxSequence = 0;

  (transactions || []).forEach((tx) => {
    const raw = String(tx?.vatInvoiceNumber || '').trim();
    if (!raw) return;
    const match = raw.match(expression);
    if (!match) return;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq > maxSequence) {
      maxSequence = seq;
    }
  });

  const nextSequence = String(maxSequence + 1).padStart(2, '0');
  return `${prefix}${year}-${nextSequence}`;
};

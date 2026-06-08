import { Transaction } from '../types';

export type VatReportSnapshot = {
  date?: string;
  type?: Transaction['type'];
  vatInvoiceNumber?: string;
  customerName?: string;
  customerVATNumber?: string;
  vendorName?: string;
  vendorVATNumber?: string;
  paymentMethod?: Transaction['paymentMethod'];
  bankName?: string;
  buildingId?: string;
  buildingName?: string;
  unitNumber?: string;
  details?: string;
  amount?: number;
  amountExcludingVAT?: number;
  amountIncludingVAT?: number;
  totalWithVat?: number;
  vatAmount?: number;
  vatRate?: number;
  isCreditNote?: boolean;
  originalInvoiceId?: string;
  lockedAt?: string;
};

export const createVatReportSnapshot = (
  tx: Transaction,
  options?: { customerName?: string }
): VatReportSnapshot => ({
  date: tx.date,
  type: tx.type,
  vatInvoiceNumber: tx.vatInvoiceNumber,
  customerName: options?.customerName ?? tx.customerName,
  customerVATNumber: tx.customerVATNumber,
  vendorName: tx.vendorName,
  vendorVATNumber: tx.vendorVATNumber,
  paymentMethod: tx.paymentMethod,
  bankName: tx.bankName,
  buildingId: tx.buildingId,
  buildingName: tx.buildingName,
  unitNumber: tx.unitNumber,
  details: tx.details,
  amount: tx.amount,
  amountExcludingVAT: tx.amountExcludingVAT,
  amountIncludingVAT: tx.amountIncludingVAT,
  totalWithVat: tx.totalWithVat,
  vatAmount: tx.vatAmount,
  vatRate: tx.vatRate,
  isCreditNote: tx.isCreditNote,
  originalInvoiceId: tx.originalInvoiceId,
  lockedAt: new Date().toISOString(),
});

export const applyVatReportSnapshot = (tx: Transaction): Transaction => {
  const snapshot = (tx as any).vatReportSnapshot as VatReportSnapshot | undefined;
  if (!snapshot) return tx;
  return {
    ...tx,
    ...snapshot,
    id: tx.id,
    createdAt: tx.createdAt,
    createdBy: tx.createdBy,
    createdByName: tx.createdByName,
  };
};

import { AmlakSheetKind, Building, Transaction, TransactionType } from '../types';

export const INTER_BUILDING_TRANSFER_CATEGORY = 'Inter-Building Transfer';

export function isTreasuryLinkedTransaction(tx: Transaction): boolean {
  return (tx as any).source === 'treasury' || tx.paymentMethod === 'TREASURY' || tx.paymentMethod === 'TREASURY_REVERSAL';
}

export function isInterBuildingTreasuryTransaction(tx: Transaction): boolean {
  return isTreasuryLinkedTransaction(tx) &&
    String((tx as any).fromType || '').toUpperCase() === 'BUILDING' &&
    String((tx as any).toType || '').toUpperCase() === 'BUILDING' &&
    !!(tx as any).fromId &&
    !!(tx as any).toId &&
    String((tx as any).fromId) !== String((tx as any).toId);
}

export function transactionSheetPaymentMethod(tx: Transaction): string {
  const method = String((tx as any).originalPaymentMethod || tx.paymentMethod || '').toUpperCase();
  return ['CASH', 'BANK', 'CHEQUE'].includes(method) ? method : 'BANK';
}

export function transactionSheetKindsForAmlak(tx: Transaction, building: Building): AmlakSheetKind[] {
  if (isInterBuildingTreasuryTransaction(tx)) {
    const role = String((tx as any).interBuildingRole || '').toUpperCase();
    const txType = String(tx.type || '').toUpperCase();
    if (role === 'DEST' || txType === TransactionType.INCOME) return ['otherIncome'];
    if (role === 'SOURCE' || txType === TransactionType.EXPENSE) return ['expense'];
  }
  if (isTreasuryLinkedTransaction(tx)) return ['treasury'];

  if (tx.type === 'INCOME') {
    const buildingChargesVat = building.propertyType === 'NON_RESIDENTIAL' || (building as any).vatApplicable === true;
    if ((tx as any).feesEntry) return ['fees'];
    if (buildingChargesVat && (tx.isVATApplicable || tx.incomeSubType !== 'OTHER')) return ['rentalIncome', 'vatIncome'];
    if (tx.incomeSubType === 'OTHER') return ['otherIncome'];
    return ['rentalIncome'];
  }
  if (tx.type === 'EXPENSE') {
    if (tx.isVATApplicable) return ['vatExpense'];
    if (tx.expenseCategory === 'Owner Expense' || tx.expenseCategory === 'Owner Profit Withdrawal') return ['ownerExpense'];
    return ['expense'];
  }
  return [];
}

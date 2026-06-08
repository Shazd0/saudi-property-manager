import { PaymentMethod, Transaction, TransactionType } from '../types';

/** Uppercase effective method for ledger splits (treasury rows use originalPaymentMethod when set). */
export const effectivePaymentMethodUpper = (tx: any): string =>
  String((tx?.originalPaymentMethod ?? tx?.paymentMethod) || '').trim().toUpperCase();

/**
 * Bank column for opening/period cash-vs-bank summaries (Dashboard, History).
 * Treats CHEQUE as bank; uses bankName / fromBankName / toBankName when method is missing or non-standard.
 */
export const transactionCountsAsBankForSplit = (tx: any): boolean => {
  const m = effectivePaymentMethodUpper(tx);
  if (m === 'BANK' || m === 'CHEQUE') return true;
  if (m === 'CASH' || m === 'TREASURY') return false;
  const bankMeta = !!(tx?.bankName || tx?.fromBankName || tx?.toBankName);
  if (bankMeta) return true;
  const hints = ['TRANSFER', 'IBAN', 'WIRE', 'MADA', 'VISA', 'MASTER', 'SADAD', 'ONLINE', 'POS'];
  return hints.some(h => m.includes(h));
};

/** Cash column complement for {@link transactionCountsAsBankForSplit}. */
export const transactionCountsAsCashForSplit = (tx: any): boolean => !transactionCountsAsBankForSplit(tx);

/**
 * Normalizes payment method string to standard PaymentMethod enum.
 * CHEQUE maps to BANK. Card/transfer-like strings map to BANK; unknown maps to CASH.
 */
export const normalizePaymentMethod = (method: any): PaymentMethod => {
    const m = String(method || '').toUpperCase();
    if (!m) return PaymentMethod.CASH;

    // Exact enum match first (most common case)
    if (m === 'BANK') return PaymentMethod.BANK;
    if (m === 'CASH') return PaymentMethod.CASH;
    if (m === 'CHEQUE') return PaymentMethod.BANK; // Cheques treated as Bank (consistent with Dashboard and standard accounting)

    // Bank methods
    if (m.includes('BANK') || m.includes('TRANSFER') || m.includes('IBAN')) return PaymentMethod.BANK;
    if (m.includes('MADA') || m.includes('VISA') || m.includes('MASTER')) return PaymentMethod.BANK;

    // Everything else (including cheques, POS, card, unknown) → Cash
    return PaymentMethod.CASH;
};

/**
 * Normalizes Transaction Type
 */
export const normalizeTransactionType = (type: any): TransactionType => {
    return String(type || '').toUpperCase() === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
};

/**
 * Calculates summary totals from a list of transactions
 */
export const calculateTransactionTotals = (transactions: Transaction[]) => {
    const sumAmount = (rows: Transaction[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    
    const incomeRows = transactions.filter(r => normalizeTransactionType(r.type) === TransactionType.INCOME);
    const expenseRows = transactions.filter(r => normalizeTransactionType(r.type) === TransactionType.EXPENSE);

    const cashIncome = sumAmount(incomeRows.filter(r => normalizePaymentMethod(r.paymentMethod) === PaymentMethod.CASH));
    const bankIncome = sumAmount(incomeRows.filter(r => normalizePaymentMethod(r.paymentMethod) === PaymentMethod.BANK));
    // Cheques are normalised to BANK, so bankIncome includes cheque amounts.
    
    const cashExpense = sumAmount(expenseRows.filter(r => normalizePaymentMethod(r.paymentMethod) === PaymentMethod.CASH));
    const bankExpense = sumAmount(expenseRows.filter(r => normalizePaymentMethod(r.paymentMethod) === PaymentMethod.BANK));

    return {
        income: {
            cash: cashIncome,
            bank: bankIncome,
            total: sumAmount(incomeRows)
        },
        expense: {
            cash: cashExpense,
            bank: bankExpense,
            total: sumAmount(expenseRows)
        }
    };
};

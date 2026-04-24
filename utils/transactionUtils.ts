import { PaymentMethod, Transaction, TransactionType } from '../types';

/**
 * Normalizes payment method string to standard PaymentMethod enum.
 * CHEQUE is treated as CASH for summary purposes (matches local accounting practice).
 * Only explicit Bank/Transfer methods are counted as BANK.
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

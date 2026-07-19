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

const nearlyEqual = (a: number, b: number, eps = 0.02) => Math.abs(a - b) < eps;

/**
 * VAT-inclusive (gross) amount for history display and cash totals.
 * Handles mixed legacy data where some writers stored `amount` as exclusive.
 */
export const getTransactionInclusiveAmount = (tx: Partial<Transaction> | null | undefined): number => {
    if (!tx) return 0;
    const amount = Number(tx.amount) || 0;
    const excl = tx.amountExcludingVAT != null ? Number(tx.amountExcludingVAT) : NaN;
    const incl = tx.amountIncludingVAT != null ? Number(tx.amountIncludingVAT) : NaN;
    const total = (tx as any).totalWithVat != null ? Number((tx as any).totalWithVat) : NaN;
    const vat = tx.vatAmount != null ? Number(tx.vatAmount) : NaN;
    const hasExcl = !Number.isNaN(excl);
    const hasVat = !Number.isNaN(vat);

    // Corrupted inclusive field that equals exclusive — recompute from excl + VAT
    if (!Number.isNaN(incl) && hasExcl && hasVat && nearlyEqual(Math.abs(incl), Math.abs(excl))) {
        return Number((excl + vat).toFixed(2));
    }
    if (!Number.isNaN(incl) && (!hasExcl || Math.abs(incl) >= Math.abs(excl))) {
        return incl;
    }
    if (!Number.isNaN(total) && total !== 0) {
        if (hasExcl && hasVat && nearlyEqual(Math.abs(total), Math.abs(excl))) {
            return Number((excl + vat).toFixed(2));
        }
        if (!hasExcl || Math.abs(total) >= Math.abs(excl)) {
            return total;
        }
    }
    if (hasExcl && hasVat) {
        return Number((excl + vat).toFixed(2));
    }

    // Legacy writers stored exclusive in `amount` (VAT ≈ 15% of amount)
    if (tx.isVATApplicable && hasVat && amount !== 0) {
        const expectedVatOnExclusive = Math.abs(amount) * 0.15;
        if (nearlyEqual(Math.abs(vat), expectedVatOnExclusive, 0.05)) {
            return Number((amount + (amount < 0 ? -Math.abs(vat) : Math.abs(vat))).toFixed(2));
        }
        if (hasExcl && nearlyEqual(Math.abs(amount), Math.abs(excl))) {
            return Number((excl + vat).toFixed(2));
        }
    }

    return amount;
};

/**
 * VAT-exclusive (net) amount for invoices and VAT report base columns.
 */
export const getTransactionExclusiveAmount = (tx: Partial<Transaction> | null | undefined): number => {
    if (!tx) return 0;
    if (tx.amountExcludingVAT != null && !Number.isNaN(Number(tx.amountExcludingVAT))) {
        return Number(tx.amountExcludingVAT);
    }
    const inclusive = getTransactionInclusiveAmount(tx);
    if (tx.isVATApplicable && inclusive) {
        return Number((inclusive / 1.15).toFixed(2));
    }
    return Number(tx.amount) || 0;
};

/**
 * Calculates summary totals from a list of transactions
 */
export const calculateTransactionTotals = (transactions: Transaction[]) => {
    const sumAmount = (rows: Transaction[]) => rows.reduce((s, r) => s + getTransactionInclusiveAmount(r), 0);
    
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

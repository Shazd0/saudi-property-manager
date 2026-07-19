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
 * VAT-inclusive (gross) amount for History rows and Dashboard/Reports ledger totals.
 * Matches History displayAmount so KPI cards stay in sync with transaction history.
 *
 * Handles mixed legacy data:
 * - Newer EntryForm rows store `amount` as inclusive (same as amountIncludingVAT).
 * - Some older rows stored amountIncludingVAT equal to the exclusive base.
 * - Some VAT purchases stored vatAmount without amountIncludingVAT.
 */
export const getTransactionInclusiveAmount = (tx: Partial<Transaction> | null | undefined): number => {
    if (!tx) return 0;
    const isExpense = normalizeTransactionType(tx.type) === TransactionType.EXPENSE;
    const inclRaw = (tx as any).amountIncludingVAT ?? (tx as any).totalWithVat;
    if (inclRaw != null && inclRaw !== '') {
        const n = Number(inclRaw);
        if (!Number.isNaN(n)) {
            const base = Number(tx.amount || 0);
            const vat = Number(tx.vatAmount || 0);
            // Old data guard: some expense rows stored amountIncludingVAT equal to the exclusive
            // base. Newer rows store `amount` as inclusive (same as amountIncludingVAT) — do NOT
            // add VAT again (that wrongly turns 517.5 into 585 = 517.5 + 67.5).
            if (isExpense && vat > 0 && base > 0 && n > 0 && Math.abs(n - base) <= 0.01) {
                const excl = Number((tx as any).amountExcludingVAT);
                const amountLooksInclusive =
                    Number.isFinite(excl) && excl > 0 && Math.abs(excl - base) > 0.5;
                if (!amountLooksInclusive) return base + vat;
            }
            return n;
        }
    }
    const base = Number(tx.amount || 0);
    // Back-compat: some old VAT purchases stored `vatAmount` but not `amountIncludingVAT`,
    // and some rows may be missing `isVATApplicable` even though VAT was entered.
    if (isExpense && Number(tx.vatAmount || 0) > 0) {
        const excl = Number((tx as any).amountExcludingVAT);
        const vat = Number(tx.vatAmount || 0);
        // If amount already matches excl+vat (or differs from excl), treat amount as inclusive.
        if (Number.isFinite(excl) && excl > 0 && Math.abs(base - excl) > 0.5) return base;
        if (Number.isFinite(excl) && excl > 0 && Math.abs(base - (excl + vat)) <= 0.05) return base;
        return base + vat;
    }
    return base;
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

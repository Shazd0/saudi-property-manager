import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ExpenseCategory, PaymentMethod, TransactionType } from '../types';
import { parseWorkbook, ParsedRow } from '../utils/sheetLedgerParser';
import { matchSheetRowsToAmlak, rowStableKey, SheetMatchContext } from '../utils/sheetsImportMatching';

const building = {
  id: 'b1',
  name: 'JEDHAH SHOP-104',
  units: [{ name: 'SHOP-05' }],
} as any;

const ctx: SheetMatchContext = {
  buildings: [building],
  unitMapping: {},
  resolveBuilding: (label) => (label.includes('JEDHAH') ? building : null),
  resolveOwner: () => null,
  resolveEmployee: (name) => (
    name.toLowerCase().includes('shihab') ? { id: 'e1', name: 'SHIHAB' } :
    name.toLowerCase().includes('afrah') ? { id: 'e2', name: 'AFRAH' } :
    null
  ),
};

function row(overrides: Partial<ParsedRow>): ParsedRow {
  return {
    sheetName: 'MAR-26',
    monthLabel: 'MAR-26',
    parsedDate: '2026-03-25',
    buildingLabel: 'JEDHAH SHOP-104',
    section: 'SHOP_RENT',
    sectionLabel: 'Shop Rent',
    amount: 0,
    paymentMethod: 'BANK',
    rawRow: 1,
    ...overrides,
  };
}

describe('sheets import matching', () => {
  it('parses side-by-side RIYAS1 and RIYAS2 owner blocks even when details say Owner Salary', () => {
    const grid = [
      ['MAR-26'],
      ['JEDHAH-104'],
      [null, null, null, null, null, 'RIYAS1', null, null, null, 'RIYAS2'],
      [null, null, null, null, null, 'DATE', 'DETAILS', 'BANK', 'CASH', 'DATE', 'DETAILS', 'BANK', 'CASH'],
      [null, null, null, null, null, '03-03-2026', 'Owner Salary', 4000, null, '03-03-2026', 'Owner Salary', 1200, null],
      [null, null, null, null, null, 'TOTAL', null, 4000, null, 'TOTAL', null, 1200, null],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), 'MAR-26');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const result = parseWorkbook(buffer);
    const ownerRows = result.rows.filter(r => r.section === 'OWNER_EXPENSE');

    expect(ownerRows.map(r => r.sectionLabel).sort()).toEqual(['RIYAS1', 'RIYAS2']);
    expect(ownerRows.map(r => r.amount).sort((a, b) => a - b)).toEqual([1200, 4000]);
  });

  it('does not match salary rows across parsed month boundaries', () => {
    const shihabRow = row({
      parsedDate: '2026-03-03',
      buildingLabel: 'JEDHAH-104',
      section: 'SALARY',
      sectionLabel: 'Salary',
      details: 'SHIHAB',
      amount: 1200,
    });
    const afrahRow = row({
      rawRow: 2,
      parsedDate: '2026-03-03',
      buildingLabel: 'JEDHAH-104',
      section: 'SALARY',
      sectionLabel: 'Salary',
      details: 'AFRAH',
      amount: 4000,
    });

    const result = matchSheetRowsToAmlak(
      [shihabRow, afrahRow],
      [{
        id: 'tx-apr-salary',
        date: '03-04-2026',
        type: TransactionType.EXPENSE,
        amount: 1200,
        paymentMethod: PaymentMethod.BANK,
        buildingId: 'b1',
        buildingName: 'JEDHAH-104',
        expenseCategory: ExpenseCategory.SALARY,
        employeeId: 'e1',
        employeeName: 'SHIHAB',
      } as any, {
        id: 'tx-jun-salary',
        date: '03-06-2026',
        type: TransactionType.EXPENSE,
        amount: 4000,
        paymentMethod: PaymentMethod.BANK,
        buildingId: 'b1',
        buildingName: 'JEDHAH-104',
        expenseCategory: ExpenseCategory.SALARY,
        employeeId: 'e2',
        employeeName: 'AFRAH',
      } as any],
      { ...ctx, resolveBuilding: () => ({ ...building, name: 'JEDHAH-104' } as any) },
    );

    expect(result.get(rowStableKey(shihabRow))?.status).toBe('importable');
    expect(result.get(rowStableKey(afrahRow))?.status).toBe('importable');
  });

  it('still exact-matches the same calendar date when Amlak uses DD-MM-YYYY', () => {
    const sheetRow = row({
      parsedDate: '2026-03-03',
      buildingLabel: 'JEDHAH-104',
      section: 'SALARY',
      sectionLabel: 'Salary',
      details: 'SHIHAB',
      amount: 1200,
    });

    const result = matchSheetRowsToAmlak(
      [sheetRow],
      [{
        id: 'tx-mar-salary',
        date: '03-03-2026',
        type: TransactionType.EXPENSE,
        amount: 1200,
        paymentMethod: PaymentMethod.BANK,
        buildingId: 'b1',
        buildingName: 'JEDHAH-104',
        expenseCategory: ExpenseCategory.SALARY,
        employeeId: 'e1',
        employeeName: 'SHIHAB',
      } as any],
      { ...ctx, resolveBuilding: () => ({ ...building, name: 'JEDHAH-104' } as any) },
    ).get(rowStableKey(sheetRow));

    expect(result?.status).toBe('in_amlak');
    expect(result?.confidence).toBe('exact');
  });

  it('matches grouped sheet rent to one Amlak payment and leaves only the extra amount importable', () => {
    const rows = [
      row({ rawRow: 1, amount: 15000, unitNumber: 'SHOP-05', details: 'Mr. Qais Trading Store' }),
      row({ rawRow: 2, amount: 21251, unitNumber: 'SHOP-05', details: 'Mr. Qais Trading Store' }),
    ];

    const results = matchSheetRowsToAmlak(
      rows,
      [{
        id: 'tx-rent',
        date: '25-03-2026',
        type: TransactionType.INCOME,
        amount: 36250,
        paymentMethod: PaymentMethod.BANK,
        buildingId: 'b1',
        buildingName: 'JEDHAH SHOP-104',
        unitNumber: 'SHOP-05',
        incomeSubType: 'RENTAL',
        details: 'UNIT SHOP-05 JEDHAH SHOP-104 Balance Payment - Installment 1 - SHOP-5 - Mr. Qais Trading Store',
      } as any],
      ctx,
    );

    const statuses = rows.map(r => results.get(rowStableKey(r)));
    expect(statuses.filter(s => s?.status === 'in_amlak')).toHaveLength(1);

    const adjustment = statuses.find(s => s?.status === 'importable');
    expect(adjustment?.adjustmentAmount).toBe(1);
    expect(adjustment?.matchedTxId).toBe('tx-rent');
  });

  it('does not require staff or owner mapping for Owner Salary owner-expense rows', () => {
    const sheetRow = row({
      section: 'OWNER_EXPENSE',
      sectionLabel: 'Owner Salary',
      details: 'SHIHAB',
      amount: 1200,
    });

    const result = matchSheetRowsToAmlak([sheetRow], [], ctx).get(rowStableKey(sheetRow));

    expect(result?.status).toBe('importable');
  });

  it('does not require owner mapping for generic Owner Expense rows', () => {
    const sheetRow = row({
      section: 'OWNER_EXPENSE',
      sectionLabel: 'Owner Expse',
      details: 'Personal withdrawal',
      amount: 2500,
    });

    const result = matchSheetRowsToAmlak([sheetRow], [], ctx).get(rowStableKey(sheetRow));

    expect(result?.status).toBe('importable');
    expect(result?.mappingReason).toBeUndefined();
  });
});

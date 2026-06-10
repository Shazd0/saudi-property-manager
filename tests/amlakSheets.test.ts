import { describe, expect, it } from 'vitest';
import { AmlakWorksheet, PaymentMethod, TransactionType, UserRole } from '../types';
import { cellAddress, colLabelToIndex, expandCellRange, indexToColLabel } from '../utils/spreadsheetAddress';
import { recalcWorksheet, setWorksheetCell } from '../utils/spreadsheetRecalc';
import {
  createAmlakPostingTemplateSheet,
  createBlankAmlakWorkbook,
  createBuildingAmlakSheetsWorkbook,
  ensureBuildingWorkbookSheets,
  setWorksheetRowMeta,
  validateWorksheetPostingRows,
} from '../utils/amlakSheetPosting';
import { ExpenseCategory } from '../types';
import { buildMonitoringDueRoomRows } from '../utils/monitoringDueRooms';

function blankSheet(): AmlakWorksheet {
  return {
    id: 's1',
    name: 'Sheet 1',
    rowCount: 20,
    colCount: 10,
    cells: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('Amlak Sheets spreadsheet engine', () => {
  it('converts A1 addresses and expands ranges', () => {
    expect(colLabelToIndex('A')).toBe(1);
    expect(colLabelToIndex('AA')).toBe(27);
    expect(indexToColLabel(28)).toBe('AB');
    expect(cellAddress(8, 12)).toBe('H12');
    expect(expandCellRange('A1:B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('evaluates formulas, ranges, arithmetic, and IF', () => {
    let sheet = blankSheet();
    sheet = setWorksheetCell(sheet, 'A1', '10');
    sheet = setWorksheetCell(sheet, 'A2', '20');
    sheet = setWorksheetCell(sheet, 'B1', '=SUM(A1:A2)');
    sheet = setWorksheetCell(sheet, 'B2', '=IF(B1>=30,"ok","bad")');
    sheet = setWorksheetCell(sheet, 'B3', '=ROUND((B1 / 3), 2)');

    expect(sheet.cells.B1.value).toBe(30);
    expect(sheet.cells.B2.value).toBe('ok');
    expect(sheet.cells.B3.value).toBe(10);
  });

  it('marks circular formulas as errors', () => {
    let sheet = blankSheet();
    sheet = setWorksheetCell(sheet, 'A1', '=B1');
    sheet = setWorksheetCell(sheet, 'B1', '=A1');
    const recalculated = recalcWorksheet(sheet);

    expect(recalculated.cells.A1.type).toBe('error');
    expect(recalculated.cells.A1.value).toBe('#CYCLE!');
  });
});

describe('Amlak Sheets posting validation', () => {
  it('creates building-specific pages for income, expenses, VAT, and fees', () => {
    const building = { id: 'b1', name: 'Amlak Tower', units: [{ name: '101', defaultRent: 2500 }] } as any;
    const workbook = createBuildingAmlakSheetsWorkbook({ id: 'u1', name: 'Admin', role: UserRole.ADMIN }, building);

    expect(workbook.sheets.map(sheet => sheet.name)).toEqual(['Rental Income', 'Other Income', 'Expenses', 'Owner Expenses', 'VAT Sales', 'VAT Purchase', 'Fees']);
    expect(workbook.buildingId).toBe('b1');
    expect(workbook.sheets.every(sheet => sheet.buildingId === 'b1')).toBe(true);
    expect(workbook.sheets[0].postingConfig?.defaultPostType).toBe('RENT');
    expect(workbook.sheets[1].postingConfig?.defaultPostType).toBe('OTHER_INCOME');
    expect(workbook.sheets[2].postingConfig?.defaultPostType).toBe('EXPENSE');
    expect(workbook.sheets[3].postingConfig?.defaultPostType).toBe('OWNER_EXPENSE');
    expect(workbook.sheets[4].postingConfig?.defaultPostType).toBe('RENT');
    expect(workbook.sheets[5].postingConfig?.defaultPostType).toBe('EXPENSE');
    expect(workbook.sheets[6].postingConfig?.defaultPostType).toBe('OTHER_INCOME');
  });

  it('normalizes older workbooks to the fixed building tabs', () => {
    const user = { id: 'u1', name: 'Admin', role: UserRole.ADMIN };
    const old = createBlankAmlakWorkbook(user);
    const building = { id: 'b9', name: 'Building 9', units: [] } as any;
    const normalized = ensureBuildingWorkbookSheets({ ...old, sheets: [old.sheets[0]] }, building);

    expect(normalized.sheets.map(sheet => sheet.sheetKind)).toEqual(['rentalIncome', 'otherIncome', 'expense', 'ownerExpense', 'vatIncome', 'vatExpense', 'fees']);
    expect(normalized.sheets.map(sheet => sheet.buildingName)).toEqual(['Building 9', 'Building 9', 'Building 9', 'Building 9', 'Building 9', 'Building 9', 'Building 9']);
  });

  it('turns a mapped rent row into an Amlak transaction', () => {
    const building = { id: 'b1', name: 'Amlak Tower', bankName: 'Main Bank', units: [{ name: '101', defaultRent: 2500 }] } as any;
    let sheet = createAmlakPostingTemplateSheet(1, 'rentalIncome', building);
    sheet = setWorksheetCell(sheet, 'A2', '2026-06-08');
    sheet = setWorksheetCell(sheet, 'B2', '101');
    sheet = setWorksheetCell(sheet, 'C2', 'June rent');
    sheet = setWorksheetCell(sheet, 'D2', '2500');
    sheet = setWorksheetCell(sheet, 'E2', '2500');
    sheet = setWorksheetCell(sheet, 'F2', 'BANK');
    sheet = setWorksheetCell(sheet, 'G2', '2026-06-10');
    sheet = setWorksheetRowMeta(sheet, 2, { id: 'staff1', name: 'Staff User', role: UserRole.EMPLOYEE });

    const result = validateWorksheetPostingRows(sheet, {
      currentUser: { id: 'u1', name: 'Admin', role: UserRole.ADMIN },
      buildings: [building],
      contracts: [{
        id: 'c1',
        contractNo: 'C-1',
        contractDate: '2026-01-01',
        status: 'Active',
        buildingId: 'b1',
        buildingName: 'Amlak Tower',
        unitName: '101',
        customerId: 'cust1',
        customerName: 'Tenant One',
        rentValue: 30000,
        waterFee: 0,
        internetFee: 0,
        insuranceFee: 0,
        serviceFee: 0,
        officePercent: 0,
        officeFeeAmount: 0,
        otherDeduction: 0,
        otherAmount: 0,
        totalValue: 30000,
        installmentCount: 12,
        firstInstallment: 2500,
        otherInstallment: 2500,
        periodMonths: 12,
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        createdBy: 'u1',
        parkingFee: 0,
        managementFee: 0,
      }],
      users: [],
      existingTransactions: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].ok).toBe(true);
    expect(result[0].transaction?.type).toBe(TransactionType.INCOME);
    expect(result[0].transaction?.date).toBe('2026-06-10');
    expect(result[0].transaction?.paymentMethod).toBe(PaymentMethod.BANK);
    expect(result[0].transaction?.contractId).toBe('c1');
    expect(result[0].transaction?.customerName).toBe('Tenant One');
    expect(result[0].transaction?.createdByName).toBe('Staff User');
    expect(result[0].transaction?.expectedAmount).toBe(2500);
    expect(result[0].transaction?.dueDate).toBe('2026-06-08');
    expect(result[0].transaction?.installmentStartDate).toBe('2026-06-08');
  });

  it('turns an owner expenses sheet row into an owner expense transaction', () => {
    let sheet = createAmlakPostingTemplateSheet(1, 'ownerExpense');
    sheet = setWorksheetCell(sheet, 'A2', '2026-06-08');
    sheet = setWorksheetCell(sheet, 'B2', 'Owner One');
    sheet = setWorksheetCell(sheet, 'C2', 'Owner withdrawal');
    sheet = setWorksheetCell(sheet, 'D2', 'CASH');
    sheet = setWorksheetCell(sheet, 'E2', '900');

    const result = validateWorksheetPostingRows(sheet, {
      currentUser: { id: 'u1', name: 'Admin', role: UserRole.ADMIN },
      buildings: [],
      contracts: [],
      users: [{ id: 'owner1', name: 'Owner One', role: UserRole.OWNER, isOwner: true }],
      existingTransactions: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].ok).toBe(true);
    expect(result[0].transaction?.type).toBe(TransactionType.EXPENSE);
    expect(result[0].transaction?.expenseCategory).toBe(ExpenseCategory.OWNER_EXPENSE);
    expect(result[0].transaction?.ownerId).toBe('owner1');
  });
});

describe('Amlak Sheets monitoring due rows', () => {
  it('keeps earlier unpaid installments due when a later installment is paid explicitly', () => {
    const building = {
      id: 'b1',
      name: 'Amlak Tower',
      propertyType: 'RESIDENTIAL',
      units: [{ name: '7-03 3Bhk' }],
    } as any;
    const contract = {
      id: 'c1',
      contractNo: 'C-1',
      status: 'Active',
      buildingId: 'b1',
      buildingName: 'Amlak Tower',
      unitName: '7-03 3Bhk',
      customerId: 'cust1',
      customerName: 'Tenant One',
      rentValue: 180000,
      totalValue: 180000,
      installmentCount: 12,
      firstInstallment: 15000,
      otherInstallment: 15000,
      periodMonths: 12,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    } as any;
    const rows = buildMonitoringDueRoomRows({
      building,
      contracts: [contract],
      transactions: [{
        id: 'tx-july',
        type: TransactionType.INCOME,
        status: 'APPROVED',
        buildingId: 'b1',
        unitNumber: '7-03 3Bhk',
        contractId: 'c1',
        customerId: 'cust1',
        date: '2026-06-10',
        dueDate: '2026-07-01',
        installmentStartDate: '2026-07-01',
        amount: 15000,
        amountIncludingVAT: 15000,
      } as any],
      reportUpTo: '2026-08-31',
      payThrough: '2026-06-10',
    });

    expect(rows.some(row => row.nextDueDate === '2026-01-01' && row.totalDue === 15000)).toBe(true);
    expect(rows.some(row => row.nextDueDate === '2026-07-01')).toBe(false);
  });
});

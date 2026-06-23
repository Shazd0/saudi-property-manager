import {
  AmlakSheetKind,
  AmlakWorkbook,
  AmlakWorksheet,
  Building,
  Transaction,
  UserRole,
} from '../types';
import {
  createBuildingAmlakSheetsWorkbook,
  ensureBuildingWorkbookSheets,
  normalizeAmlakTextValue,
} from './amlakSheetPosting';
import {
  INTER_BUILDING_TRANSFER_CATEGORY,
  isInterBuildingTreasuryTransaction,
  transactionSheetKindsForAmlak,
  transactionSheetPaymentMethod,
} from './amlakSheetRouting';
import { cellAddress, colLabelToIndex } from './spreadsheetAddress';
import { setWorksheetCell } from './spreadsheetRecalc';

const AUTO_EMPTY_ROW_BUFFER = 5;

const canonicalKind = (kind?: AmlakSheetKind): Exclude<AmlakSheetKind, 'income'> =>
  kind === 'income' ? 'rentalIncome' : ((kind || 'rentalIncome') as Exclude<AmlakSheetKind, 'income'>);

const normRowKey = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const amountRowKey = (value: number): string =>
  String(Math.round((Number(value) || 0) * 100));

const buildingIdCandidates = (id: unknown): string[] => {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const parts = raw.split(':').map(part => part.trim()).filter(Boolean);
  return Array.from(new Set([raw, parts[parts.length - 1] || raw]));
};

const cellRaw = (sheet: AmlakWorksheet, col: string, row: number): string => {
  const address = cellAddress(colLabelToIndex(col), row);
  const cell = sheet.cells?.[address];
  return String(cell?.raw ?? cell?.value ?? '').trim();
};

const rowHasData = (sheet: AmlakWorksheet, row: number): boolean => {
  for (let col = 1; col <= sheet.colCount; col++) {
    const value = sheet.cells?.[cellAddress(col, row)]?.raw;
    if (String(value ?? '').trim()) return true;
  }
  return false;
};

const rowDataSignature = (sheet: AmlakWorksheet, row: number): string =>
  Array.from({ length: sheet.colCount }, (_, index) => sheet.cells?.[cellAddress(index + 1, row)]?.raw || '').join('\u001f');

const maxUsedSheetRow = (sheet: AmlakWorksheet): number => Math.max(
  1,
  ...Object.keys(sheet.rowsMeta || {}).map(Number).filter(row => Number.isFinite(row) && row > 1),
  ...Object.values(sheet.cells || {}).map(cell => Number(cell.address.match(/\d+$/)?.[0] || 0)).filter(row => row > 1),
);

const firstEmptyRow = (sheet: AmlakWorksheet): number => {
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (!rowHasData(sheet, row)) return row;
  }
  return sheet.rowCount + 1;
};

const ensureRowCapacity = (sheet: AmlakWorksheet, row: number): AmlakWorksheet => {
  const targetRowCount = Math.max(row, maxUsedSheetRow(sheet) + AUTO_EMPTY_ROW_BUFFER);
  return targetRowCount <= sheet.rowCount ? sheet : { ...sheet, rowCount: targetRowCount, updatedAt: Date.now() };
};

const ensureTrailingEmptyRows = (sheet: AmlakWorksheet): AmlakWorksheet => {
  const targetRowCount = Math.max(sheet.rowCount || 1, maxUsedSheetRow(sheet) + AUTO_EMPTY_ROW_BUFFER);
  return targetRowCount === sheet.rowCount ? sheet : { ...sheet, rowCount: targetRowCount, updatedAt: Date.now() };
};

const transactionDisplayAmount = (tx: Transaction): number =>
  Number((tx as any).amountIncludingVAT ?? (tx as any).totalWithVat ?? tx.amount) || 0;

function rowEnteredAmount(sheet: AmlakWorksheet, kind: AmlakSheetKind, row: number): number {
  const currentKind = canonicalKind(kind);
  const amountCol = currentKind === 'rentalIncome' ? 'E' :
    currentKind === 'otherIncome' ? 'E' :
    currentKind === 'expense' ? 'G' :
    currentKind === 'ownerExpense' ? 'E' :
    currentKind === 'vatIncome' ? 'F' :
    currentKind === 'vatExpense' ? 'I' :
    currentKind === 'fees' ? 'E' :
    'I';
  const extraCol = currentKind === 'expense' ? 'H' : '';
  const amount = Number(String(cellRaw(sheet, amountCol, row) || '').replace(/,/g, '')) || 0;
  const extra = extraCol ? (Number(String(cellRaw(sheet, extraCol, row) || '').replace(/,/g, '')) || 0) : 0;
  return Math.max(0, amount + extra);
}

function transactionMatchesExistingRow(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind, row: number): boolean {
  const currentKind = canonicalKind(kind);
  if (currentKind === 'rentalIncome' || currentKind === 'vatIncome' || currentKind === 'fees') {
    const paidDate = cellRaw(sheet, 'G', row);
    const dueDate = cellRaw(sheet, 'A', row);
    const txDueDate = String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || '');
    if (paidDate ? paidDate !== tx.date : (dueDate !== txDueDate && dueDate !== tx.date)) return false;
  } else if (cellRaw(sheet, 'A', row) !== tx.date) {
    return false;
  }

  const amount = currentKind === 'expense'
    ? (Number(tx.amount) || 0) + (Number((tx as any).extraAmount) || 0)
    : transactionDisplayAmount(tx);
  const rowAmount = currentKind === 'rentalIncome'
    ? (Number(String(cellRaw(sheet, 'E', row) || cellRaw(sheet, 'D', row) || '').replace(/,/g, '')) || 0)
    : rowEnteredAmount(sheet, kind, row);
  if (rowAmount > 0 && amount > 0 && amountRowKey(rowAmount) !== amountRowKey(amount)) return false;

  if (currentKind === 'rentalIncome' || currentKind === 'vatIncome' || currentKind === 'fees') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.unitNumber);
  }
  if (currentKind === 'otherIncome') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.expenseCategory || 'Other Income');
  }
  if (currentKind === 'ownerExpense') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.ownerName);
  }
  if (currentKind === 'vatExpense') {
    return normRowKey(cellRaw(sheet, 'D', row) || cellRaw(sheet, 'F', row)) === normRowKey(tx.vendorName || (tx as any).vendorRefNo || tx.vatInvoiceNumber);
  }
  if (currentKind === 'treasury') {
    return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey((tx as any).fromType) &&
      normRowKey(cellRaw(sheet, 'C', row)) === normRowKey((tx as any).fromId) &&
      normRowKey(cellRaw(sheet, 'D', row)) === normRowKey((tx as any).toType) &&
      normRowKey(cellRaw(sheet, 'E', row)) === normRowKey((tx as any).toId);
  }
  return normRowKey(cellRaw(sheet, 'B', row)) === normRowKey(tx.expenseCategory || 'General Expense');
}

function findExistingTransactionRow(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind): number {
  for (let row = 2; row <= sheet.rowCount; row++) {
    const meta = sheet.rowsMeta?.[String(row)];
    if (meta?.postedTransactionId === tx.id) return row;
    if (meta?.status === 'posted') continue;
    if (rowHasData(sheet, row) && transactionMatchesExistingRow(sheet, tx, kind, row)) return row;
  }
  return 0;
}

function importedTransactionRow(sheet: AmlakWorksheet, tx: Transaction): number {
  if (!tx.id) return 0;
  const entry = Object.entries(sheet.rowsMeta || {}).find(([, meta]) => meta?.postedTransactionId === tx.id);
  return Number(entry?.[0] || 0);
}

function setImportedRowMeta(sheet: AmlakWorksheet, row: number, tx: Transaction): AmlakWorksheet {
  return {
    ...sheet,
    rowsMeta: {
      ...(sheet.rowsMeta || {}),
      [String(row)]: {
        row,
        status: 'posted',
        enteredBy: tx.createdBy || 'system',
        enteredByName: tx.createdByName || 'Amlak',
        enteredAt: tx.createdAt || Date.now(),
        updatedAt: Date.now(),
        postedTransactionId: tx.id,
        postedAt: tx.createdAt || Date.now(),
        postedBy: tx.createdBy || 'system',
        postedByName: tx.createdByName || 'Amlak',
      },
    },
    updatedAt: Date.now(),
  };
}

function itemMatchesBuilding(item: any, building: Building): boolean {
  if (!item || !building) return false;
  const ids = new Set(buildingIdCandidates(building.id));
  const itemIds = [item.buildingId, item.building, item.building_id, item.id].flatMap(buildingIdCandidates);
  if (itemIds.some(id => ids.has(id))) return true;
  const buildingName = normRowKey((building as any).name || (building as any).buildingName || '');
  const itemName = normRowKey(item.buildingName || item.building_name || '');
  return !!buildingName && !!itemName && buildingName === itemName;
}

function treasuryBuildingOptionLabel(building: Building): string {
  const anyBuilding = building as any;
  const name = String(building.name || anyBuilding._rawBuildingId || building.id || '').trim();
  const bookName = String(anyBuilding._bookDisplayName || anyBuilding.bookName || '').trim();
  return bookName ? `${name} - ${bookName}` : name;
}

function buildingDisplayNameFromId(buildingId: unknown, buildings: Building[]): string {
  const ids = new Set(buildingIdCandidates(buildingId));
  if (!ids.size) return '';
  const match = buildings.find((building: any) => {
    const candidates = [
      building.id,
      building._rawBuildingId,
      building.rawId,
      building.buildingId,
    ].flatMap(buildingIdCandidates);
    return candidates.some(id => ids.has(id));
  });
  return match ? treasuryBuildingOptionLabel(match) : '';
}

function transactionBuildingAccountLabel(tx: Transaction, side: 'from' | 'to', buildings: Building[]): string {
  const anyTx = tx as any;
  const id = side === 'from' ? anyTx.fromId : anyTx.toId;
  const storedName = side === 'from' ? anyTx.fromName : anyTx.toName;
  return buildingDisplayNameFromId(id, buildings) || String(storedName || id || '').trim();
}

function importTransactionIntoSheet(sheet: AmlakWorksheet, tx: Transaction, kind: AmlakSheetKind, accountBuildings: Building[]): AmlakWorksheet {
  const alreadyImportedRow = importedTransactionRow(sheet, tx);
  const row = alreadyImportedRow || findExistingTransactionRow(sheet, tx, kind) || firstEmptyRow(sheet);
  let next = ensureRowCapacity(sheet, row);
  const amount = String((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount || '');
  const text = (value: string | undefined) => normalizeAmlakTextValue(value || '');
  const method = transactionSheetPaymentMethod(tx);
  const detailsText = text(tx.details || (tx as any).purpose || '');
  const txBuildingName = buildingDisplayNameFromId(tx.buildingId, accountBuildings) || tx.buildingName || '';
  const currentKind = canonicalKind(kind);

  if (currentKind === 'rentalIncome') {
    next = setWorksheetCell(next, `A${row}`, String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || cellRaw(sheet, 'A', row) || ''));
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, text(tx.details));
    next = setWorksheetCell(next, `D${row}`, String(tx.expectedAmount || cellRaw(sheet, 'D', row) || (tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount || ''));
    next = setWorksheetCell(next, `E${row}`, amount);
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
  } else if (currentKind === 'otherIncome') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || (isInterBuildingTreasuryTransaction(tx) ? INTER_BUILDING_TRANSFER_CATEGORY : 'Other Income')));
    next = setWorksheetCell(next, `C${row}`, detailsText || (isInterBuildingTreasuryTransaction(tx) ? text(INTER_BUILDING_TRANSFER_CATEGORY) : ''));
    next = setWorksheetCell(next, `D${row}`, method);
    next = setWorksheetCell(next, `E${row}`, amount);
  } else if (currentKind === 'expense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || (isInterBuildingTreasuryTransaction(tx) ? INTER_BUILDING_TRANSFER_CATEGORY : 'General Expense')));
    next = setWorksheetCell(next, `C${row}`, text(tx.employeeName || tx.vendorName || txBuildingName || tx.expenseSubCategory || ''));
    next = setWorksheetCell(next, `D${row}`, text(tx.salaryPeriod || ''));
    next = setWorksheetCell(next, `E${row}`, detailsText);
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `H${row}`, String((tx as any).extraAmount || ''));
  } else if (currentKind === 'ownerExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.ownerName));
    next = setWorksheetCell(next, `C${row}`, detailsText);
    next = setWorksheetCell(next, `D${row}`, method);
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
  } else if (currentKind === 'vatIncome') {
    next = setWorksheetCell(next, `A${row}`, String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || ''));
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, tx.customerVATNumber || '');
    next = setWorksheetCell(next, `D${row}`, detailsText);
    next = setWorksheetCell(next, `E${row}`, String(tx.expectedAmount || (tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount || ''));
    next = setWorksheetCell(next, `F${row}`, amount);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
    next = setWorksheetCell(next, `H${row}`, method);
  } else if (currentKind === 'vatExpense') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text(tx.expenseCategory || 'Vendor Payment'));
    next = setWorksheetCell(next, `C${row}`, text(tx.expenseSubCategory));
    next = setWorksheetCell(next, `D${row}`, text(tx.vendorName));
    next = setWorksheetCell(next, `E${row}`, tx.vendorVATNumber || '');
    next = setWorksheetCell(next, `F${row}`, (tx as any).vendorRefNo || tx.vatInvoiceNumber || '');
    next = setWorksheetCell(next, `G${row}`, detailsText);
    next = setWorksheetCell(next, `H${row}`, method);
    next = setWorksheetCell(next, `I${row}`, amount);
  } else if (currentKind === 'fees') {
    next = setWorksheetCell(next, `A${row}`, String((tx as any).dueDate || (tx as any).installmentStartDate || tx.date || ''));
    next = setWorksheetCell(next, `B${row}`, tx.unitNumber || '');
    next = setWorksheetCell(next, `C${row}`, detailsText);
    next = setWorksheetCell(next, `D${row}`, String((tx as any).expectedAmount || tx.amount || ''));
    next = setWorksheetCell(next, `E${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `F${row}`, method);
    next = setWorksheetCell(next, `G${row}`, tx.date || '');
    next = setWorksheetCell(next, `H${row}`, String((tx as any).discountAmount || ''));
  } else if (currentKind === 'treasury') {
    next = setWorksheetCell(next, `A${row}`, tx.date || '');
    next = setWorksheetCell(next, `B${row}`, text((tx as any).fromType));
    next = setWorksheetCell(next, `C${row}`, text(transactionBuildingAccountLabel(tx, 'from', accountBuildings)));
    next = setWorksheetCell(next, `D${row}`, text((tx as any).toType));
    next = setWorksheetCell(next, `E${row}`, text(transactionBuildingAccountLabel(tx, 'to', accountBuildings)));
    next = setWorksheetCell(next, `F${row}`, text((tx as any).originalPaymentMethod || tx.paymentMethod || 'CASH'));
    next = setWorksheetCell(next, `G${row}`, text((tx as any).fromBankName || tx.bankName));
    next = setWorksheetCell(next, `H${row}`, text((tx as any).toBankName));
    next = setWorksheetCell(next, `I${row}`, String(tx.amount || ''));
    next = setWorksheetCell(next, `J${row}`, text((tx as any).purpose || 'Treasury Transfer'));
    next = setWorksheetCell(next, `K${row}`, text(tx.details));
  }

  const existingMeta = sheet.rowsMeta?.[String(row)];
  if (
    rowDataSignature(next, row) === rowDataSignature(sheet, row) &&
    existingMeta?.status === 'posted' &&
    existingMeta?.postedTransactionId === tx.id
  ) {
    return sheet;
  }
  return setImportedRowMeta(next, row, tx);
}

function resolveTransactionBuilding(tx: Transaction, buildings: Building[]): Building | null {
  return buildings.find(building => itemMatchesBuilding(tx, building)) || null;
}

export function syncTransactionIntoAmlakWorkbooks(
  workbooks: AmlakWorkbook[],
  tx: Transaction,
  buildings: Building[],
): { workbooks: AmlakWorkbook[]; changed: boolean; syncedWorkbookIds: string[] } {
  if (!tx?.id || (tx as any).deleted || tx.status === 'REJECTED' || (tx as any).vatReportOnly) {
    return { workbooks, changed: false, syncedWorkbookIds: [] };
  }
  const building = resolveTransactionBuilding(tx, buildings);
  if (!building) return { workbooks, changed: false, syncedWorkbookIds: [] };

  const kinds = transactionSheetKindsForAmlak(tx, building);
  if (!kinds.length) return { workbooks, changed: false, syncedWorkbookIds: [] };

  const currentUser = {
    id: tx.createdBy || 'system',
    name: tx.createdByName || 'Amlak',
    role: UserRole.ADMIN,
  };
  const existingIndex = workbooks.findIndex((workbook: any) => !workbook.deleted && itemMatchesBuilding(workbook, building));
  const baseWorkbook = existingIndex >= 0
    ? workbooks[existingIndex]
    : createBuildingAmlakSheetsWorkbook(currentUser, building);
  let nextWorkbook = ensureBuildingWorkbookSheets(baseWorkbook, building);
  let changed = existingIndex < 0 || nextWorkbook !== baseWorkbook;
  const sheets = nextWorkbook.sheets.map(sheet => ensureTrailingEmptyRows({ ...sheet }));

  kinds.forEach(kind => {
    const index = sheets.findIndex(sheet => canonicalKind(sheet.sheetKind) === canonicalKind(kind));
    if (index < 0) return;
    const before = sheets[index];
    const after = importTransactionIntoSheet(before, tx, kind, buildings);
    if (after !== before) {
      sheets[index] = after;
      changed = true;
    }
  });

  if (!changed) return { workbooks, changed: false, syncedWorkbookIds: [] };
  nextWorkbook = { ...nextWorkbook, sheets: sheets.map(ensureTrailingEmptyRows), updatedAt: Date.now() };
  const nextWorkbooks = existingIndex >= 0
    ? workbooks.map((workbook, index) => index === existingIndex ? nextWorkbook : workbook)
    : [...workbooks, nextWorkbook];
  return { workbooks: nextWorkbooks, changed: true, syncedWorkbookIds: [nextWorkbook.id] };
}

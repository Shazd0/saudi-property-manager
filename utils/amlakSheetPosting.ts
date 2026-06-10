import {
  AmlakSheetPostType,
  AmlakSheetPostingConfig,
  AmlakWorkbook,
  AmlakSheetKind,
  AmlakSheetRowMeta,
  AmlakWorksheet,
  Building,
  Contract,
  ExpenseCategory,
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
} from '../types';
import { cellAddress, colLabelToIndex, indexToColLabel } from './spreadsheetAddress';

export interface AmlakSheetPostingContext {
  currentUser: User;
  buildings: Building[];
  contracts: Contract[];
  users: User[];
  existingTransactions: Transaction[];
}

export interface AmlakSheetPostingRowResult {
  row: number;
  ok: boolean;
  skipped?: boolean;
  errors: string[];
  transaction?: Transaction;
  alreadyPostedTransactionId?: string;
}

export type AmlakSheetTemplateKind = AmlakSheetKind;

const norm = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '');

function canonicalKind(kind?: AmlakSheetKind): Exclude<AmlakSheetKind, 'income'> {
  return kind === 'income' ? 'rentalIncome' : ((kind || 'rentalIncome') as Exclude<AmlakSheetKind, 'income'>);
}

function cellText(sheet: AmlakWorksheet, col: string | undefined, row: number): string {
  if (!col) return '';
  const address = cellAddress(colLabelToIndex(col), row);
  const cell = sheet.cells[address];
  const value = cell?.value ?? cell?.raw ?? '';
  return String(value ?? '').trim();
}

function cellNumber(sheet: AmlakWorksheet, col: string | undefined, row: number): number {
  const text = cellText(sheet, col, row).replace(/,/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvePostType(value: string, fallback: AmlakSheetPostType): AmlakSheetPostType {
  const n = norm(value);
  if (!n) return fallback;
  if (n.includes('rent') || n.includes('ايجار') || n.includes('إيجار')) return 'RENT';
  if (n.includes('salary') || n.includes('راتب')) return 'SALARY';
  if (n.includes('borrow')) return 'BORROWING';
  if (n.includes('owner')) return 'OWNER_EXPENSE';
  if (n.includes('income')) return 'OTHER_INCOME';
  if (n.includes('expense') || n.includes('مصروف')) return 'EXPENSE';
  return fallback;
}

function resolvePaymentMethod(value: string): PaymentMethod {
  const n = norm(value);
  if (n.includes('cash') || n.includes('نقد')) return PaymentMethod.CASH;
  if (n.includes('cheque') || n.includes('check')) return PaymentMethod.CHEQUE;
  return PaymentMethod.BANK;
}

function resolveBuilding(buildings: Building[], value: string): Building | null {
  const n = norm(value);
  if (!n) return null;
  return buildings.find(b => b.id === value || norm(b.name) === n || norm(b.name).includes(n) || n.includes(norm(b.name))) || null;
}

function resolveUser(users: User[], value: string): User | null {
  const n = norm(value);
  if (!n) return null;
  return users.find(u => u.id === value || norm(u.name) === n || norm(u.name).includes(n) || n.includes(norm(u.name))) || null;
}

function resolveExpenseTargetBuilding(buildings: Building[], value: string): Building | null {
  const n = norm(value);
  if (!n) return null;
  return buildings.find((b: any) => {
    if (!b?.lease?.isLeased) return false;
    const names = [b.id, b.name, b.lease?.landlordName].filter(Boolean).map(norm);
    return names.some(name => name === n || name.includes(n) || n.includes(name));
  }) || null;
}

function resolveContract(contracts: Contract[], buildingId: string, unit: string): Contract | null {
  const n = norm(unit);
  if (!buildingId || !n) return null;
  const matches = contracts.filter(c => c.buildingId === buildingId && norm(c.unitName) === n);
  return matches.find(c => c.status === 'Active') || matches[0] || null;
}

function isDuplicate(tx: Transaction, existing: Transaction[]): boolean {
  const txDate = String(tx.date || '');
  const txAmount = Math.round((Number(tx.amount) || 0) * 100);
  return existing.some(existingTx => {
    if ((existingTx as any).deleted || existingTx.status === TransactionStatus.REJECTED) return false;
    const amount = Math.round((Number(existingTx.amount) || 0) * 100);
    return amount === txAmount &&
      String(existingTx.date || '') === txDate &&
      existingTx.type === tx.type &&
      (existingTx.buildingId || '') === (tx.buildingId || '') &&
      (existingTx.unitNumber || '') === (tx.unitNumber || '') &&
      norm(existingTx.details || '') === norm(tx.details || '');
  });
}

function defaultConfig(template: AmlakSheetTemplateKind = 'rentalIncome'): AmlakSheetPostingConfig {
  const kind = canonicalKind(template);
  const defaultPostType: AmlakSheetPostType =
    kind === 'expense' || kind === 'vatExpense' ? 'EXPENSE' :
    kind === 'ownerExpense' ? 'OWNER_EXPENSE' :
    kind === 'otherIncome' || kind === 'fees' ? 'OTHER_INCOME' :
    'RENT';

  return {
    headerRow: 1,
    startRow: 2,
    defaultPostType,
    mapping: {
      date: 'A',
      unit: kind === 'rentalIncome' || kind === 'vatIncome' || kind === 'fees' ? 'B' : undefined,
      dueAmount: kind === 'rentalIncome' ? 'D' : undefined,
      category: kind === 'expense' || kind === 'otherIncome' || kind === 'vatExpense' ? 'B' : undefined,
      subCategory: kind === 'expense' || kind === 'vatExpense' ? 'C' : undefined,
      related: kind === 'expense' ? 'D' : undefined,
      owner: kind === 'ownerExpense' ? 'B' : undefined,
      customerVAT: kind === 'vatIncome' ? 'C' : undefined,
      vendor: kind === 'vatExpense' ? 'D' : undefined,
      vendorVAT: kind === 'vatExpense' ? 'E' : undefined,
      vendorRefNo: kind === 'vatExpense' ? 'F' : undefined,
      details:
        kind === 'rentalIncome' ? 'C' :
        kind === 'otherIncome' ? 'C' :
        kind === 'expense' ? 'E' :
        kind === 'ownerExpense' ? 'C' :
        kind === 'vatIncome' ? 'D' :
        kind === 'vatExpense' ? 'G' :
        'C',
      paymentMethod:
        kind === 'rentalIncome' ? 'F' :
        kind === 'otherIncome' ? 'D' :
        kind === 'expense' ? 'F' :
        kind === 'ownerExpense' ? 'D' :
        kind === 'vatIncome' ? 'E' :
        kind === 'vatExpense' ? 'H' :
        'D',
      amount:
        kind === 'rentalIncome' ? 'E' :
        kind === 'otherIncome' ? 'E' :
        kind === 'expense' ? 'G' :
        kind === 'ownerExpense' ? 'E' :
        kind === 'vatIncome' ? 'F' :
        kind === 'vatExpense' ? 'I' :
        'E',
      extra: kind === 'expense' ? 'H' : undefined,
      discount: kind === 'fees' ? 'F' : undefined,
      ...(kind === 'rentalIncome' ? { date: 'G' } : {}),
    },
  };
}

function templateName(template: AmlakSheetTemplateKind): string {
  const kind = canonicalKind(template);
  if (kind === 'rentalIncome') return 'Rental Income';
  if (kind === 'otherIncome') return 'Other Income';
  if (kind === 'expense') return 'Expenses';
  if (kind === 'ownerExpense') return 'Owner Expenses';
  if (kind === 'vatIncome') return 'VAT Sales';
  if (kind === 'vatExpense') return 'VAT Purchase';
  return 'Fees';
}

function templateHeaders(template: AmlakSheetTemplateKind): string[] {
  const kind = canonicalKind(template);
  if (kind === 'expense') {
    return ['Date', 'Category', 'Target', 'Month', 'Details', 'Payment Method', 'Amount', 'Extra', 'Entered By', 'Status'];
  }
  if (kind === 'ownerExpense') {
    return ['Date', 'Owner', 'Details', 'Payment Method', 'Amount', 'Entered By', 'Status'];
  }
  if (kind === 'otherIncome') {
    return ['Date', 'Category', 'Details', 'Payment Method', 'Amount', 'Entered By', 'Status'];
  }
  if (kind === 'vatIncome') {
    return ['Date', 'Unit', 'Customer VAT', 'Details', 'Payment Method', 'Amount Incl. VAT', 'Entered By', 'Status'];
  }
  if (kind === 'vatExpense') {
    return ['Date', 'Category', 'Sub Category', 'Vendor', 'Vendor VAT', 'Vendor Ref No', 'Details', 'Payment Method', 'Amount Incl. VAT', 'Entered By', 'Status'];
  }
  if (kind === 'fees') {
    return ['Date', 'Unit', 'Details', 'Payment Method', 'Amount', 'Discount', 'Entered By', 'Status'];
  }
  return ['Due Date', 'Unit', 'Details', 'Due Amount', 'Given Amount', 'Payment Method', 'Paid Date', 'Entered By', 'Status'];
}

function templateMapping(template: AmlakSheetTemplateKind): AmlakSheetPostingConfig['mapping'] {
  const kind = canonicalKind(template);
  if (kind === 'ownerExpense') {
    return {
      date: 'A',
      owner: 'B',
      details: 'C',
      paymentMethod: 'D',
      amount: 'E',
    };
  }
  return defaultConfig(kind).mapping;
}

export function createAmlakPostingTemplateSheet(
  now = Date.now(),
  template: AmlakSheetTemplateKind = 'rentalIncome',
  building?: Pick<Building, 'id' | 'name'> | null,
): AmlakWorksheet {
  const kind = canonicalKind(template);
  const headers = templateHeaders(kind);
  const cells = headers.reduce<AmlakWorksheet['cells']>((acc, header, index) => {
    const address = cellAddress(index + 1, 1);
    acc[address] = {
      address,
      raw: header,
      value: header,
      type: 'text',
      style: { bold: true, backgroundColor: '#f8fafc' },
    };
    return acc;
  }, {});
  const config = defaultConfig(kind);
  return {
    id: crypto.randomUUID(),
    name: templateName(kind),
    sheetKind: kind,
    buildingId: building?.id,
    buildingName: building?.name,
    rowCount: 15,
    colCount: headers.length,
    cells,
    rowsMeta: {},
    postingConfig: {
      ...config,
      mapping: templateMapping(kind),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultAmlakWorkbookSheets(now = Date.now()): AmlakWorksheet[] {
  return [
    createAmlakPostingTemplateSheet(now, 'rentalIncome'),
    createAmlakPostingTemplateSheet(now, 'otherIncome'),
    createAmlakPostingTemplateSheet(now, 'expense'),
    createAmlakPostingTemplateSheet(now, 'ownerExpense'),
    createAmlakPostingTemplateSheet(now, 'vatIncome'),
    createAmlakPostingTemplateSheet(now, 'vatExpense'),
    createAmlakPostingTemplateSheet(now, 'fees'),
  ];
}

export function createBuildingAmlakSheetsWorkbook(currentUser: User, building: Building, name?: string): AmlakWorkbook {
  const now = Date.now();
  const sheets = [
    createAmlakPostingTemplateSheet(now, 'rentalIncome', building),
    createAmlakPostingTemplateSheet(now, 'otherIncome', building),
    createAmlakPostingTemplateSheet(now, 'expense', building),
    createAmlakPostingTemplateSheet(now, 'ownerExpense', building),
    createAmlakPostingTemplateSheet(now, 'vatIncome', building),
    createAmlakPostingTemplateSheet(now, 'vatExpense', building),
    createAmlakPostingTemplateSheet(now, 'fees', building),
  ];
  const firstSheet = sheets[0];
  return {
    id: crypto.randomUUID(),
    name: name || `${building.name} Sheets`,
    buildingId: building.id,
    buildingName: building.name,
    sheets,
    activeSheetId: firstSheet.id,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.id,
    createdByName: currentUser.name,
  };
}

export function createBlankAmlakWorkbook(currentUser: User, name = 'Amlak Workbook'): AmlakWorkbook {
  const now = Date.now();
  const fallbackBuilding = { id: '', name };
  const workbook = createBuildingAmlakSheetsWorkbook(currentUser, fallbackBuilding as Building, name);
  return {
    ...workbook,
    buildingId: undefined,
    buildingName: undefined,
    sheets: createDefaultAmlakWorkbookSheets(now),
  };
}

export function ensureBuildingWorkbookSheets(workbook: AmlakWorkbook, building: Building): AmlakWorkbook {
  const now = Date.now();
  const byKind = new Map((workbook.sheets || []).map(sheet => [canonicalKind(sheet.sheetKind || (
    sheet.name.toLowerCase().includes('owner') ? 'ownerExpense' :
    sheet.name.toLowerCase().includes('other') ? 'otherIncome' :
    sheet.name.toLowerCase().includes('sales') ? 'vatIncome' :
    sheet.name.toLowerCase().includes('purchase') ? 'vatExpense' :
    sheet.name.toLowerCase().includes('fee') ? 'fees' :
    sheet.name.toLowerCase().includes('expense') ? 'expense' :
    'income'
  )), sheet] as const));
  const sheets: AmlakWorksheet[] = (['rentalIncome', 'otherIncome', 'expense', 'ownerExpense', 'vatIncome', 'vatExpense', 'fees'] as Array<Exclude<AmlakSheetKind, 'income'>>).map(kind => {
    const existing = byKind.get(kind);
    if (!existing) return createAmlakPostingTemplateSheet(now, kind, building);
    return {
      ...existing,
      name: templateName(kind),
      sheetKind: canonicalKind(kind),
      buildingId: building.id,
      buildingName: building.name,
      colCount: templateHeaders(kind).length,
      postingConfig: {
        ...defaultConfig(kind),
        ...(existing.postingConfig || {}),
        defaultPostType: defaultConfig(kind).defaultPostType,
        mapping: templateMapping(kind),
      },
      updatedAt: now,
    };
  });
  return {
    ...workbook,
    name: `${building.name} Sheets`,
    buildingId: building.id,
    buildingName: building.name,
    sheets,
    activeSheetId: workbook.activeSheetId && sheets.some(sheet => sheet.id === workbook.activeSheetId)
      ? workbook.activeSheetId
      : sheets[0].id,
    updatedAt: now,
  };
}

function cellHasStoredValue(cell: AmlakWorksheet['cells'][string] | undefined): boolean {
  if (!cell) return false;
  if (String(cell.raw ?? '').trim()) return true;
  if (cell.formula) return true;
  if (cell.value !== undefined && cell.value !== null && String(cell.value).trim()) return true;
  if (cell.error) return true;
  if (cell.style && Object.keys(cell.style).length > 0) return true;
  return false;
}

function cellColLabel(address: string): string {
  return String(address || '').replace(/\d+$/, '').toUpperCase();
}

function normalizeWordCase(value: string): string {
  return String(value || '').replace(/[A-Za-z][A-Za-z']*/g, word => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
}

function shouldNormalizeTextCell(sheet: AmlakWorksheet, address: string): boolean {
  const row = Number(address.match(/\d+$/)?.[0] || 0);
  if (row <= 1) return false;
  const kind = canonicalKind(sheet.sheetKind);
  const col = cellColLabel(address);
  const textColumns: Record<Exclude<AmlakSheetKind, 'income'>, string[]> = {
    rentalIncome: ['B', 'C'],
    otherIncome: ['B', 'C'],
    expense: ['B', 'C', 'D', 'E'],
    ownerExpense: ['B', 'C'],
    vatIncome: ['B', 'D'],
    vatExpense: ['B', 'C', 'D', 'G'],
    fees: ['B', 'C'],
  };
  return textColumns[kind].includes(col);
}

export function normalizeAmlakTextValue(value: string): string {
  return normalizeWordCase(value);
}

function compactWorksheet(sheet: AmlakWorksheet): AmlakWorksheet {
  const rowsMeta = { ...(sheet.rowsMeta || {}) };
  const cells = Object.values(sheet.cells || {}).reduce<AmlakWorksheet['cells']>((acc, cell) => {
    const legacyPostedId = cell.posting?.postedTransactionId;
    if (legacyPostedId) {
      const row = Number(cell.address.match(/\d+$/)?.[0] || 0);
      if (row > 1 && !rowsMeta[String(row)]?.postedTransactionId) {
        const previous = rowsMeta[String(row)];
        rowsMeta[String(row)] = {
          row,
          status: 'posted',
          enteredBy: previous?.enteredBy || cell.posting?.postedBy || '',
          enteredByName: previous?.enteredByName || '',
          enteredAt: previous?.enteredAt || cell.posting?.postedAt || Date.now(),
          updatedAt: previous?.updatedAt || Date.now(),
          ...previous,
          postedTransactionId: legacyPostedId,
          postedAt: previous?.postedAt || cell.posting?.postedAt || Date.now(),
          postedBy: previous?.postedBy || cell.posting?.postedBy,
        };
      }
    }
    if (!cellHasStoredValue(cell)) return acc;
    const { posting: _posting, ...rest } = cell;
    const raw = shouldNormalizeTextCell(sheet, cell.address) && !String(rest.raw || '').trim().startsWith('=')
      ? normalizeWordCase(rest.raw)
      : rest.raw;
    acc[cell.address] = raw !== rest.raw
      ? { ...rest, raw, value: raw, type: 'text', formula: undefined, error: undefined }
      : rest;
    return acc;
  }, {});

  return {
    ...sheet,
    cells,
    rowsMeta: Object.entries(rowsMeta).reduce<AmlakWorksheet['rowsMeta']>((acc, [key, meta]) => {
      if (!meta) return acc;
      acc![key] = meta;
      return acc;
    }, {}),
  };
}

export function compactAmlakWorkbook(workbook: AmlakWorkbook): AmlakWorkbook {
  return {
    ...workbook,
    sheets: (workbook.sheets || []).map(compactWorksheet),
  };
}

export function setWorksheetRowMeta(
  sheet: AmlakWorksheet,
  row: number,
  user: User,
  patch: Partial<AmlakSheetRowMeta> = {},
): AmlakWorksheet {
  if (row <= 1) return sheet;
  const previous = sheet.rowsMeta?.[String(row)];
  const now = Date.now();
  return {
    ...sheet,
    rowsMeta: {
      ...(sheet.rowsMeta || {}),
      [String(row)]: {
        row,
        status: previous?.status || 'draft',
        enteredBy: previous?.enteredBy || user.id,
        enteredByName: previous?.enteredByName || user.name,
        enteredAt: previous?.enteredAt || now,
        updatedAt: now,
        ...previous,
        ...patch,
      },
    },
    updatedAt: now,
  };
}

export function validateWorksheetPostingRows(
  sheet: AmlakWorksheet,
  context: AmlakSheetPostingContext,
): AmlakSheetPostingRowResult[] {
  const config = sheet.postingConfig || defaultConfig();
  const endRow = Math.min(config.endRow || sheet.rowCount, sheet.rowCount);
  const results: AmlakSheetPostingRowResult[] = [];

  for (let row = config.startRow; row <= endRow; row++) {
    const date = cellText(sheet, config.mapping.date, row);
    const amount = cellNumber(sheet, config.mapping.amount, row);
    const dueAmount = cellNumber(sheet, config.mapping.dueAmount, row);
    const details = cellText(sheet, config.mapping.details, row);
    const buildingText = cellText(sheet, config.mapping.building, row);
    const unit = cellText(sheet, config.mapping.unit, row);
    const category = cellText(sheet, config.mapping.category, row);
    const subCategory = cellText(sheet, config.mapping.subCategory, row);
    const related = cellText(sheet, config.mapping.related, row);
    const target = subCategory || related;
    const customerVAT = cellText(sheet, config.mapping.customerVAT, row);
    const vendorName = cellText(sheet, config.mapping.vendor, row);
    const vendorVAT = cellText(sheet, config.mapping.vendorVAT, row);
    const vendorRefNo = cellText(sheet, config.mapping.vendorRefNo, row);
    const employeeOrOwner = cellText(sheet, config.mapping.employee || config.mapping.owner, row);
    const rawPostType = resolvePostType(cellText(sheet, config.mapping.postType, row), config.defaultPostType);
    const postType: AmlakSheetPostType =
      category === ExpenseCategory.SALARY || category === 'Salary' ? 'SALARY' :
      category === ExpenseCategory.BORROWING || category === 'Borrowing' ? 'BORROWING' :
      rawPostType;
    const kind = canonicalKind(sheet.sheetKind);
    const installmentDueDate = kind === 'rentalIncome' ? cellText(sheet, 'A', row) : date;
    const hasAnyValue = [date, amount ? String(amount) : '', details, buildingText, unit, category, subCategory, employeeOrOwner, vendorName].some(Boolean);
    if (!hasAnyValue) continue;

    const alreadyPosted = sheet.rowsMeta?.[String(row)]?.postedTransactionId ||
      (sheet.rowsMeta?.[String(row)]?.status === 'posted' ? `row-${row}` : '');
    if (alreadyPosted) {
      results.push({ row, ok: false, skipped: true, errors: ['Row already posted'], alreadyPostedTransactionId: alreadyPosted });
      continue;
    }

    const errors: string[] = [];
    if (!date) errors.push('Date is required');
    if (!amount || amount <= 0) errors.push('Amount must be positive');
    if ((kind === 'otherIncome' || kind === 'expense' || kind === 'vatExpense') && !category) errors.push('Category is required');
    const needsTarget = kind === 'expense' && [
      ExpenseCategory.SALARY,
      ExpenseCategory.BORROWING,
      ExpenseCategory.PROPERTY_RENT,
      ExpenseCategory.MAINTENANCE,
      ExpenseCategory.VENDOR_PAYMENT,
    ].map(String).includes(category);
    if (needsTarget && !target) errors.push('Target is required');
    if (kind === 'vatIncome' && !customerVAT) errors.push('Customer VAT is required');
    if (kind === 'vatExpense' && !vendorName) errors.push('Vendor is required');
    if (kind === 'vatExpense' && !vendorVAT) errors.push('Vendor VAT is required');
    if (kind === 'vatExpense' && !vendorRefNo) errors.push('Vendor reference is required');

    const building = resolveBuilding(context.buildings, buildingText || sheet.buildingId || sheet.buildingName || '');
    if (['RENT', 'EXPENSE', 'OTHER_INCOME'].includes(postType) && !building) errors.push('Building could not be matched');

    const paymentMethod = resolvePaymentMethod(cellText(sheet, config.mapping.paymentMethod, row));
    const bankName = cellText(sheet, config.mapping.bank, row);
    if (paymentMethod === PaymentMethod.BANK && postType !== 'OWNER_EXPENSE' && !bankName && !building?.bankName) errors.push('Bank is required for bank rows');

    const contract = (postType === 'RENT' || kind === 'vatIncome' || kind === 'fees') && building ? resolveContract(context.contracts, building.id, unit) : null;
    if ((postType === 'RENT' || kind === 'vatIncome' || kind === 'fees') && !unit) errors.push('Unit is required');

    const person = resolveUser(context.users, target || employeeOrOwner || details);
    if ((postType === 'SALARY' || postType === 'BORROWING') && !person) errors.push('Employee could not be matched');
    if (postType === 'OWNER_EXPENSE' && !person) errors.push('Owner could not be matched');
    const targetBuilding = category === ExpenseCategory.PROPERTY_RENT || category === 'Property Rent'
      ? resolveExpenseTargetBuilding(context.buildings, target)
      : null;
    if ((category === ExpenseCategory.PROPERTY_RENT || category === 'Property Rent') && !targetBuilding) errors.push('Leased property could not be matched');

    const isVat = kind === 'vatIncome' || kind === 'vatExpense';
    const netAmount = amount + (postType === 'EXPENSE' ? Math.max(0, cellNumber(sheet, config.mapping.extra, row)) : 0);
    const amountExcl = isVat ? Math.round((amount / 1.15) * 100) / 100 : undefined;
    const vatAmount = isVat ? Math.round((amount - (amountExcl || 0)) * 100) / 100 : undefined;
    const type = postType === 'RENT' || postType === 'OTHER_INCOME' || kind === 'vatIncome' || kind === 'fees' ? TransactionType.INCOME : TransactionType.EXPENSE;
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      type,
      amount: isVat ? amount : netAmount,
      vatAmount,
      amountExcludingVAT: amountExcl,
      amountIncludingVAT: isVat ? amount : undefined,
      totalWithVat: isVat ? amount : undefined,
      vatRate: isVat ? 15 : undefined,
      isVATApplicable: isVat,
      vatInvoiceNumber: kind === 'vatExpense' ? vendorRefNo : undefined,
      paymentMethod,
      bankName: paymentMethod === PaymentMethod.BANK ? (bankName || building?.bankName) : undefined,
      buildingId: targetBuilding?.id || building?.id,
      buildingName: targetBuilding?.name || building?.name,
      unitNumber: unit || undefined,
      contractId: contract?.id,
      customerId: contract?.customerId,
      customerName: contract?.customerName,
      expectedAmount: postType === 'RENT' && dueAmount > 0 ? dueAmount : undefined,
      dueDate: postType === 'RENT' && installmentDueDate ? installmentDueDate : undefined,
      installmentStartDate: postType === 'RENT' && installmentDueDate ? installmentDueDate : undefined,
      incomeSubType: (postType === 'RENT' || kind === 'vatIncome') && kind !== 'fees' ? 'RENTAL' : (postType === 'OTHER_INCOME' || kind === 'fees') ? 'OTHER' : undefined,
      expenseCategory:
        postType === 'SALARY' ? ExpenseCategory.SALARY :
        postType === 'BORROWING' ? ExpenseCategory.BORROWING :
        postType === 'OWNER_EXPENSE' ? ExpenseCategory.OWNER_EXPENSE :
        postType === 'EXPENSE' || kind === 'vatExpense' ? (category || ExpenseCategory.GENERAL) :
        type === TransactionType.INCOME && (postType === 'OTHER_INCOME' || kind === 'fees') ? (category || (kind === 'fees' ? 'Non-VAT Fees' : 'Other Income')) :
        undefined,
      expenseSubCategory:
        category === ExpenseCategory.SALARY || category === 'Salary' ||
        category === ExpenseCategory.BORROWING || category === 'Borrowing' ||
        category === ExpenseCategory.PROPERTY_RENT || category === 'Property Rent'
          ? undefined
          : subCategory || undefined,
      employeeId: (postType === 'SALARY' || postType === 'BORROWING') ? person?.id : undefined,
      employeeName: (postType === 'SALARY' || postType === 'BORROWING') ? person?.name || target || employeeOrOwner || related : undefined,
      ownerId: postType === 'OWNER_EXPENSE' ? person?.id : undefined,
      ownerName: postType === 'OWNER_EXPENSE' ? person?.name || employeeOrOwner : undefined,
      borrowingType: postType === 'BORROWING' ? 'BORROW' : undefined,
      salaryPeriod: postType === 'SALARY' ? (related || (date ? date.slice(0, 7) : undefined)) : undefined,
      vendorName: kind === 'vatExpense' ? vendorName : (category === ExpenseCategory.MAINTENANCE || category === ExpenseCategory.VENDOR_PAYMENT ? target || undefined : undefined),
      vendorVATNumber: kind === 'vatExpense' ? vendorVAT : undefined,
      vendorRefNo: kind === 'vatExpense' ? vendorRefNo : undefined,
      customerVATNumber: kind === 'vatIncome' ? customerVAT : undefined,
      feesEntry: kind === 'fees' ? true : undefined,
      discountAmount: kind === 'fees' ? Math.max(0, cellNumber(sheet, config.mapping.discount, row)) || undefined : undefined,
      details: details || (
        category === ExpenseCategory.SALARY || category === 'Salary'
          ? `Salary ${related || (date ? date.slice(0, 7) : '')} - ${person?.name || target}`.trim()
          : category === ExpenseCategory.PROPERTY_RENT || category === 'Property Rent'
            ? `Property Rent - ${targetBuilding?.name || target}`
            : `${templateName(kind)}${unit ? ` - Unit ${unit}` : ''}`
      ),
      status: TransactionStatus.APPROVED,
      createdAt: Date.now(),
      createdBy: sheet.rowsMeta?.[String(row)]?.enteredBy || context.currentUser.id,
      createdByName: sheet.rowsMeta?.[String(row)]?.enteredByName || context.currentUser.name,
    };

    if (isDuplicate(transaction, context.existingTransactions)) errors.push('Possible duplicate transaction already exists');
    results.push({ row, ok: errors.length === 0, errors, transaction: errors.length ? undefined : transaction });
  }

  return results;
}

export function markWorksheetRowsPosted(
  sheet: AmlakWorksheet,
  posted: Array<{ row: number; transactionId: string; postedBy: string }>,
): AmlakWorksheet {
  const nextCells = Object.values(sheet.cells || {}).reduce<AmlakWorksheet['cells']>((acc, cell) => {
    if (!cellHasStoredValue(cell)) return acc;
    const { posting: _posting, ...rest } = cell;
    acc[cell.address] = rest;
    return acc;
  }, {});
  const rowsMeta = { ...(sheet.rowsMeta || {}) };
  posted.forEach(item => {
    const previous = rowsMeta[String(item.row)];
    rowsMeta[String(item.row)] = {
      row: item.row,
      status: 'posted',
      enteredBy: previous?.enteredBy || item.postedBy,
      enteredByName: previous?.enteredByName || '',
      enteredAt: previous?.enteredAt || Date.now(),
      updatedAt: Date.now(),
      ...previous,
      postedTransactionId: item.transactionId,
      postedAt: Date.now(),
      postedBy: item.postedBy,
    };
  });
  return { ...sheet, cells: nextCells, rowsMeta, updatedAt: Date.now() };
}

export function mappingColumns(config?: AmlakSheetPostingConfig): string[] {
  const mapping = (config || defaultConfig()).mapping;
  return Object.values(mapping).filter(Boolean).map(value => indexToColLabel(colLabelToIndex(value as string)));
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCcw, Link2, CheckCircle, AlertTriangle, Download, FileSpreadsheet,
  Loader2, Search, SlidersHorizontal, FileText,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { User, UserRole, TransactionType, PaymentMethod, ExpenseCategory, Transaction, Building, Contract, Bank } from '../types';
import { getBuildings, getContracts, getCustomers, getUsers, saveTransaction, getActiveContract, getTransactions, getBanks } from '../services/firestoreService';
import { extractSheetId, fetchWorkbook, getSavedSheetUrl, saveSheetUrl } from '../utils/sheetsConnector';
import { parseWorkbook, ParsedRow, ParseResult, SectionKind } from '../utils/sheetLedgerParser';
import { isAmlakEasyWorkbook, parseAmlakEasyWorkbook } from '../utils/normalizedSheetParser';
import { buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import { getInstallmentRange } from '../utils/installmentSchedule';
import { fmtDate } from '../utils/dateFormat';
import { getNextVatInvoiceNumber } from '../utils/vatInvoiceNumber';
import {
  fuzzyNorm, fuzzyMatch, rowStableKey, matchUnitName, contractMatchesUnit,
  matchSheetRowsToAmlak, isIncomeSection, SheetRowMatchResult, SheetMatchContext,
  debugSheetRowMatch, SheetMatchDebugInfo, sheetImportMonthKey,
} from '../utils/sheetsImportMatching';
import { useToast } from './Toast';

interface Props {
  currentUser: User;
}

const SECTION_LABELS: Record<SectionKind, string> = {
  FLATS_RENT: 'Flat Rent',
  SHOP_RENT: 'Shop Rent',
  INTERNET: 'Internet',
  OTHER_INCOME: 'Other Income',
  OTHER_EXPENSES: 'Other Expenses',
  OWNER_EXPENSE: 'Owner Expenses',
  SALARY: 'Salary',
  BORROWING: 'Employee Borrowing',
};

const SECTION_COLORS: Record<SectionKind, string> = {
  FLATS_RENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SHOP_RENT: 'bg-green-50 text-green-700 border-green-200',
  INTERNET: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  OTHER_INCOME: 'bg-teal-50 text-teal-700 border-teal-200',
  OTHER_EXPENSES: 'bg-rose-50 text-rose-700 border-rose-200',
  OWNER_EXPENSE: 'bg-orange-50 text-orange-700 border-orange-200',
  SALARY: 'bg-purple-50 text-purple-700 border-purple-200',
  BORROWING: 'bg-amber-50 text-amber-700 border-amber-200',
};

type ImportTab = 'importable' | 'in_amlak' | 'needs_mapping' | 'amlak_transactions' | 'unmatched_amlak';
type SheetFormat = 'legacy' | 'easy';
const PAGE_SIZE = 100;

function rowMatchesSearch(row: ParsedRow, term: string, buildingName?: string): boolean {
  const qq = term.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!qq) return true;
  const compact = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const qC = compact(qq);
  const fields = [
    row.buildingLabel,
    buildingName || '',
    row.unitNumber || '',
    row.details || '',
    row.category || '',
    row.sectionLabel || '',
    SECTION_LABELS[row.section],
    row.parsedDate,
    row.paymentMethod,
  ];
  if (fields.some(f => f.toLowerCase().startsWith(qq) || (qC && compact(f).startsWith(qC)))) return true;
  const qNum = Number(qq);
  if (!Number.isNaN(qNum) && Number.isFinite(qNum)) {
    const amt = Math.round(row.amount * 100) / 100;
    if (amt === Math.round(qNum * 100) / 100) return true;
  }
  return false;
}

function txPaymentGroup(tx: Transaction): 'CASH' | 'BANK' | '' {
  const pm = String((tx as any).originalPaymentMethod || tx.paymentMethod || '').toUpperCase();
  if (pm.includes('CASH')) return 'CASH';
  if (pm.includes('BANK') || pm.includes('CHEQUE') || pm.includes('CHECK')) return 'BANK';
  return '';
}

function txMatchesSearch(tx: Transaction, term: string, buildingName?: string): boolean {
  const qq = term.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!qq) return true;
  const compact = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const qC = compact(qq);
  const fields = [
    buildingName || tx.buildingName || '',
    tx.unitNumber || '',
    tx.customerName || '',
    tx.ownerName || '',
    tx.employeeName || '',
    tx.vendorName || '',
    tx.details || '',
    String(tx.expenseCategory || ''),
    tx.incomeSubType || '',
    tx.date || '',
    String(tx.paymentMethod || ''),
  ];
  if (fields.some(f => f.toLowerCase().includes(qq) || (qC && compact(f).includes(qC)))) return true;
  const qNum = Number(qq);
  if (!Number.isNaN(qNum) && Number.isFinite(qNum)) {
    const amt = Math.round((tx.amount || 0) * 100) / 100;
    if (amt === Math.round(qNum * 100) / 100) return true;
  }
  return false;
}

function isDisplayAmlakTx(tx: Transaction): boolean {
  if ((tx as any).deleted) return false;
  if (String((tx as any).status || '').toUpperCase() === 'REJECTED') return false;
  if ((tx as any).vatReportOnly) return false;
  const pm = String(tx.paymentMethod || '');
  if ((tx as any).source === 'treasury' || pm === 'TREASURY' || pm === 'TREASURY_REVERSAL' || (tx as any).isReversal) return false;
  return true;
}

function isOwnerSalaryRow(row: ParsedRow): boolean {
  const text = `${row.sectionLabel || ''} ${row.category || ''} ${row.details || ''}`.toLowerCase();
  return (row.section === 'SALARY' || row.section === 'OWNER_EXPENSE') &&
    text.includes('owner') &&
    /\b(?:salar(?:y|ies)|slary|salry)\b/.test(text);
}

const SheetsImport: React.FC<Props> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { showSuccess, showError, showInfo } = useToast();

  const [sheetUrl, setSheetUrl] = useState(getSavedSheetUrl);
  const [sheetId, setSheetId] = useState(() => extractSheetId(getSavedSheetUrl()) || '');

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [sheetFormat, setSheetFormat] = useState<SheetFormat>('legacy');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [existingTxs, setExistingTxs] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [selectedSections, setSelectedSections] = useState<Set<SectionKind>>(new Set());

  const [buildingMapping, setBuildingMapping] = useState<Record<string, string>>({});
  const [unitMapping, setUnitMapping] = useState<Record<string, string>>({});
  const [ownerMapping, setOwnerMapping] = useState<Record<string, string>>({});
  const [bankMapping, setBankMapping] = useState<Record<string, string>>({});
  const [employeeMapping, setEmployeeMapping] = useState<Record<string, string>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTillDate, setFilterTillDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [activeTab, setActiveTab] = useState<ImportTab>('importable');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [debugMode, setDebugMode] = useState(false);
  const [debugRowKey, setDebugRowKey] = useState('');

  useEffect(() => {
    (async () => {
      const [b, c, cust, u, txs, bks] = await Promise.all([
        getBuildings(), getContracts(), getCustomers(), getUsers(), getTransactions(), getBanks(),
      ]);
      setBuildings(b || []);
      setContracts((c || []).filter((x: any) => !x.deleted));
      setCustomers(cust || []);
      setUsers(u || []);
      setExistingTxs(txs || []);
      setBanks(bks || []);
    })();
  }, []);

  const matchBuilding = useCallback((label: string): Building | null => {
    const mappedId = buildingMapping[label];
    if (mappedId) {
      const found = buildings.find(b => b.id === mappedId);
      if (found) return found;
    }
    const n = fuzzyNorm(label);
    for (const b of buildings) {
      const bn = fuzzyNorm(b.name);
      if (bn === n) return b;
      if (bn.includes(n) || n.includes(bn)) return b;
      const sheetWords = n.replace(/building/g, '').replace(/\d+/g, '').trim();
      const amlakWords = bn.replace(/building/g, '').replace(/\d+/g, '').trim();
      if (sheetWords.length >= 3 && amlakWords.length >= 3) {
        if (amlakWords.includes(sheetWords) || sheetWords.includes(amlakWords)) return b;
      }
    }
    return null;
  }, [buildings, buildingMapping]);

  const getImportBankName = useCallback((building: Building | null): string => {
    if (!building) return '';
    return (building as any).bankName || bankMapping[building.id] || '';
  }, [bankMapping]);

  const ownersList = useMemo(
    () =>
      users.filter((u: any) => {
        const role = String(u.role || '').toUpperCase();
        return (
          u.isOwner === true ||
          String(u.isOwner).toLowerCase() === 'true' ||
          role === 'OWNER' ||
          (Array.isArray(u.ownerBuildingIds) && u.ownerBuildingIds.some((x: any) => String(x || '').trim()))
        );
      }),
    [users],
  );
  const employeesList = useMemo(() => users.filter(u => u.role === UserRole.EMPLOYEE || u.role === UserRole.MANAGER), [users]);
  const roomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);

  const matchOwner = useCallback((label: string): User | null => {
    const mappedId = ownerMapping[fuzzyNorm(label || '')];
    if (mappedId) {
      const found = ownersList.find(o => o.id === mappedId);
      if (found) return found;
    }
    const names = ownersList.map(o => o.name);
    const matched = fuzzyMatch(label, names);
    return matched ? ownersList.find(o => o.name === matched) || null : null;
  }, [ownersList, ownerMapping]);

  const matchEmployee = useCallback((name: string): User | null => {
    const mappedId = employeeMapping[fuzzyNorm(name || '')];
    if (mappedId) {
      const found = employeesList.find(e => e.id === mappedId);
      if (found) return found;
    }
    const names = employeesList.map(e => e.name);
    const matched = fuzzyMatch(name, names);
    return matched ? employeesList.find(e => e.name === matched) || null : null;
  }, [employeesList, employeeMapping]);

  const matchContext: SheetMatchContext = useMemo(() => ({
    buildings,
    unitMapping,
    resolveBuilding: matchBuilding,
    resolveOwner: (label) => {
      const o = matchOwner(label);
      return o ? { id: o.id, name: o.name } : null;
    },
    resolveEmployee: (name) => {
      const e = matchEmployee(name);
      return e ? { id: e.id, name: e.name } : null;
    },
  }), [buildings, unitMapping, matchBuilding, matchOwner, matchEmployee]);

  const handleSaveUrl = () => {
    const id = extractSheetId(sheetUrl);
    if (!id) { showError('Invalid Google Sheet URL'); return; }
    setSheetId(id);
    saveSheetUrl(sheetUrl);
    showSuccess('Sheet URL saved!');
  };

  const parseIncomingWorkbook = (buffer: ArrayBuffer): { result: ParseResult; format: SheetFormat } => {
    if (isAmlakEasyWorkbook(buffer)) {
      return { result: parseAmlakEasyWorkbook(buffer), format: 'easy' };
    }
    return { result: parseWorkbook(buffer), format: 'legacy' };
  };

  const applyParseResult = (result: ParseResult, format: SheetFormat) => {
    setParseResult(result);
    setSheetFormat(format);
    setLastSynced(new Date());
    setSelectedMonths(new Set(result.months));
    setSelectedBuildings(new Set(result.buildings));
    setSelectedSections(new Set(result.sections));
    setVisibleCount(PAGE_SIZE);
    setActiveTab('importable');
  };

  const handleSync = async () => {
    if (!sheetId) { showError('No sheet URL configured'); return; }
    setLoading(true);
    try {
      const buffer = await fetchWorkbook(sheetId);
      const { result, format } = parseIncomingWorkbook(buffer);
      applyParseResult(result, format);
      if (result.errors.length > 0) {
        showInfo(`Parsed with ${result.errors.length} warning(s)`);
      } else {
        showSuccess(`Found ${result.rows.length} transactions from ${result.buildings.length} building(s)`);
      }
    } catch (e: any) {
      showError(`Sync failed: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const { result, format } = parseIncomingWorkbook(buffer);
        applyParseResult(result, format);
        showSuccess(`Found ${result.rows.length} transactions from ${result.buildings.length} building(s)`);
      } catch (err: any) {
        showError(`Parse failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const filteredRows = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.filter(r =>
      selectedMonths.has(r.monthLabel) &&
      selectedBuildings.has(r.buildingLabel) &&
      selectedSections.has(r.section),
    );
  }, [parseResult, selectedMonths, selectedBuildings, selectedSections]);

  const displayRows = useMemo(() => {
    const effectiveTo = filterTillDate || filterDateTo || '9999-12-31';
    return filteredRows.filter(row => {
      const d = row.parsedDate || '';
      if (filterDateFrom && d < filterDateFrom) return false;
      if ((filterDateTo || filterTillDate) && d > effectiveTo) return false;

      if (filterType === 'INCOME' && !isIncomeSection(row.section)) return false;
      if (filterType === 'EXPENSE' && isIncomeSection(row.section)) return false;

      if (filterMethod === 'CASH' && row.paymentMethod !== 'CASH') return false;
      if (filterMethod === 'BANK' && row.paymentMethod !== 'BANK') return false;

      const building = matchBuilding(row.buildingLabel);
      if (!rowMatchesSearch(row, searchTerm, building?.name)) return false;

      return true;
    });
  }, [filteredRows, filterDateFrom, filterDateTo, filterTillDate, filterType, filterMethod, searchTerm, matchBuilding]);

  const bankMissingBuildings = useMemo(() => {
    const byId = new Map<string, Building>();
    for (const row of filteredRows) {
      if (row.paymentMethod !== 'BANK') continue;
      const building = matchBuilding(row.buildingLabel);
      if (!building?.id) continue;
      if (!getImportBankName(building)) byId.set(building.id, building);
    }
    return [...byId.values()];
  }, [filteredRows, matchBuilding, getImportBankName]);

  const selectedMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!parseResult) return keys;
    for (const row of parseResult.rows) {
      if (selectedMonths.has(row.monthLabel) && row.parsedDate) {
        keys.add(sheetImportMonthKey(row.parsedDate));
      }
    }
    return keys;
  }, [parseResult, selectedMonths]);

  const selectedBuildingIds = useMemo(() => {
    const ids = new Set<string>();
    selectedBuildings.forEach(label => {
      const building = matchBuilding(label);
      if (building?.id) ids.add(building.id);
    });
    return ids;
  }, [selectedBuildings, matchBuilding]);

  const amlakTransactions = useMemo(() => {
    const effectiveTo = filterTillDate || filterDateTo || '9999-12-31';
    return existingTxs
      .filter(tx => {
        if (!isDisplayAmlakTx(tx)) return false;

        const d = tx.date || '';
        if (selectedMonthKeys.size > 0 && !selectedMonthKeys.has(sheetImportMonthKey(d))) return false;
        if (filterDateFrom && d < filterDateFrom) return false;
        if ((filterDateTo || filterTillDate) && d > effectiveTo) return false;

        if (selectedBuildingIds.size > 0 && !selectedBuildingIds.has(tx.buildingId || '')) return false;

        const txIsIncome = String(tx.type).toUpperCase() === 'INCOME';
        if (filterType === 'INCOME' && !txIsIncome) return false;
        if (filterType === 'EXPENSE' && txIsIncome) return false;

        const method = txPaymentGroup(tx);
        if (filterMethod === 'CASH' && method !== 'CASH') return false;
        if (filterMethod === 'BANK' && method !== 'BANK') return false;

        const building = buildings.find(b => b.id === tx.buildingId);
        if (!txMatchesSearch(tx, searchTerm, building?.name)) return false;

        return true;
      })
      .sort((a, b) => `${b.date || ''}:${b.createdAt || 0}`.localeCompare(`${a.date || ''}:${a.createdAt || 0}`));
  }, [
    existingTxs,
    selectedMonthKeys,
    selectedBuildingIds,
    filterDateFrom,
    filterDateTo,
    filterTillDate,
    filterType,
    filterMethod,
    searchTerm,
    buildings,
  ]);

  const matchMap = useMemo(
    () => matchSheetRowsToAmlak(displayRows, existingTxs, matchContext),
    [displayRows, existingTxs, matchContext],
  );

  const getMatch = useCallback(
    (row: ParsedRow): SheetRowMatchResult =>
      matchMap.get(rowStableKey(row)) || { status: 'importable' },
    [matchMap],
  );

  const matchedAmlakTxIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of displayRows) {
      const matchedId = getMatch(row).matchedTxId || '';
      matchedId.split(',').map(id => id.trim()).filter(Boolean).forEach(id => ids.add(id));
    }
    return ids;
  }, [displayRows, getMatch]);

  const unmatchedAmlakTransactions = useMemo(
    () => amlakTransactions.filter(tx => tx.id && !matchedAmlakTxIds.has(tx.id)),
    [amlakTransactions, matchedAmlakTxIds],
  );

  const tabCounts = useMemo(() => {
    let importable = 0, inAmlak = 0, needsMapping = 0;
    for (const row of displayRows) {
      const m = getMatch(row);
      if (m.status === 'importable') importable++;
      else if (m.status === 'in_amlak') inAmlak++;
      else needsMapping++;
    }
    return {
      importable,
      inAmlak,
      needsMapping,
      amlakTransactions: amlakTransactions.length,
      unmatchedAmlak: unmatchedAmlakTransactions.length,
    };
  }, [displayRows, getMatch, amlakTransactions.length, unmatchedAmlakTransactions.length]);

  const tabRows = useMemo(() => {
    return displayRows.filter(row => {
      const m = getMatch(row);
      if (activeTab === 'importable') return m.status === 'importable';
      if (activeTab === 'in_amlak') return m.status === 'in_amlak';
      if (activeTab === 'amlak_transactions' || activeTab === 'unmatched_amlak') return false;
      return m.status === 'needs_mapping';
    });
  }, [displayRows, activeTab, getMatch]);

  const visibleTabRows = useMemo(() => tabRows.slice(0, visibleCount), [tabRows, visibleCount]);
  const visibleAmlakSourceRows = activeTab === 'unmatched_amlak' ? unmatchedAmlakTransactions : amlakTransactions;
  const visibleAmlakRows = useMemo(() => visibleAmlakSourceRows.slice(0, visibleCount), [visibleAmlakSourceRows, visibleCount]);
  const activeTabTotal =
    activeTab === 'amlak_transactions' ? amlakTransactions.length :
    activeTab === 'unmatched_amlak' ? unmatchedAmlakTransactions.length :
    tabRows.length;

  const debugRow = useMemo(
    () => displayRows.find(row => rowStableKey(row) === debugRowKey) || null,
    [displayRows, debugRowKey],
  );

  const debugInfo: SheetMatchDebugInfo | null = useMemo(
    () => (debugRow ? debugSheetRowMatch(debugRow, existingTxs, matchContext) : null),
    [debugRow, existingTxs, matchContext],
  );

  useEffect(() => {
    (window as any).__sheetsImportDebug = {
      enabled: !!debugInfo,
      row: debugRow,
      debug: debugInfo,
      displayedSheetRows: displayRows,
      amlakTransactions,
      unmatchedAmlakTransactions,
      existingTransactions: existingTxs,
      matchMap,
    };
    if (debugInfo) {
      console.group('[Sheets Import Debug]');
      console.log(debugInfo);
      console.groupEnd();
    }
  }, [debugRow, debugInfo, displayRows, amlakTransactions, unmatchedAmlakTransactions, existingTxs, matchMap]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchTerm, filterDateFrom, filterDateTo, filterTillDate, filterType, filterMethod, selectedMonths, selectedBuildings, selectedSections]);

  const kpi = useMemo(() => {
    const init = () => ({
      incomeTotal: 0, incomeCash: 0, incomeBank: 0,
      expenseTotal: 0, expenseCash: 0, expenseBank: 0,
      inAmlakCount: 0, inAmlakTotal: 0,
      importableCount: 0, importableTotal: 0,
      needsMappingCount: 0,
    });
    const s = init();
    for (const row of displayRows) {
      const amt = row.amount || 0;
      const isIncome = isIncomeSection(row.section);
      const isCash = row.paymentMethod === 'CASH';
      const m = getMatch(row);

      if (m.status === 'in_amlak') {
        s.inAmlakCount++;
        s.inAmlakTotal += amt;
      } else if (m.status === 'needs_mapping') {
        s.needsMappingCount++;
      } else {
        s.importableCount++;
        s.importableTotal += m.adjustmentAmount || amt;
      }

      if (isIncome) {
        s.incomeTotal += amt;
        if (isCash) s.incomeCash += amt; else s.incomeBank += amt;
      } else {
        s.expenseTotal += amt;
        if (isCash) s.expenseCash += amt; else s.expenseBank += amt;
      }
    }
    return s;
  }, [displayRows, getMatch]);

  useEffect(() => {
    const keys = new Set<string>();
    displayRows.forEach(row => {
      const key = rowStableKey(row);
      if (getMatch(row).status === 'importable') keys.add(key);
    });
    setSelectedRowKeys(keys);
  }, [displayRows, getMatch]);

  const buildTransaction = useCallback(async (row: ParsedRow, match?: SheetRowMatchResult): Promise<Transaction | null> => {
    const building = matchBuilding(row.buildingLabel);
    if (!building) return null;

    const isIncome = isIncomeSection(row.section);
    const type = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;
    const importAmount = match?.adjustmentAmount && match.adjustmentAmount > 0 ? match.adjustmentAmount : row.amount;

    const base: Partial<Transaction> = {
      id: crypto.randomUUID(),
      date: row.parsedDate,
      type,
      amount: importAmount,
      paymentMethod: row.paymentMethod === 'BANK' ? PaymentMethod.BANK : PaymentMethod.CASH,
      bankName: row.paymentMethod === 'BANK' ? getImportBankName(building) || undefined : undefined,
      buildingId: building.id,
      buildingName: building.name,
      status: 'APPROVED' as any,
      createdAt: Date.now(),
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      details: '',
    };

    if (row.section === 'FLATS_RENT' || row.section === 'SHOP_RENT' || row.section === 'INTERNET') {
      const rawUnit = row.unitNumber || '';
      const { unitName: resolvedUnit } = matchUnitName(rawUnit, building.units || [], unitMapping, building.id);
      base.unitNumber = resolvedUnit;
      base.incomeSubType = 'RENTAL';
      const nonResidentialIncome = building.propertyType === 'NON_RESIDENTIAL' || (building as any).vatApplicable === true;

      let contract: any = null;
      try { contract = await getActiveContract(building.id, resolvedUnit); } catch {}

      if (!contract) {
        const unitContracts = contracts.filter(c =>
          c.buildingId === building.id && contractMatchesUnit(c.unitName, resolvedUnit),
        );
        unitContracts.sort((a, b) => (a.status === 'Active' ? -1 : b.status === 'Active' ? 1 : 0));
        contract = unitContracts[0] || null;
      }

      if (contract) {
        base.contractId = contract.id;
        base.customerId = contract.customerId;
        base.customerName = formatCustomerFromMap(contract.customerName, contract.customerId, roomMap);
        base.electricityMeter = contract.electricityMeter;

        const custLabel = base.customerName || contract.customerName || '';
        const totalInst = contract.installmentCount || 1;
        let detailsStr = '';

        if (totalInst > 1 && contract.fromDate && contract.toDate) {
          const schedInput = {
            fromDate: contract.fromDate,
            toDate: contract.toDate,
            periodMonths: Number(contract.periodMonths) || 0,
            periodDays: Number(contract.periodDays) || 0,
            installmentCount: totalInst,
          };
          let instNo = 1;
          for (let n = totalInst; n >= 1; n--) {
            const { startDate } = getInstallmentRange(schedInput, n);
            if (new Date(row.parsedDate) >= startDate) { instNo = n; break; }
          }
          const { startDate, endDate } = getInstallmentRange(schedInput, instNo);
          const period = `${fmtDate(startDate)} to ${fmtDate(endDate)}`;
          detailsStr = instNo === 1
            ? `1st payment (rent + fees) — ${custLabel} — period ${period}`
            : `Installment ${instNo} of ${totalInst} — ${custLabel} — period ${period}`;
        } else {
          detailsStr = `Rent — ${custLabel} — Unit ${resolvedUnit}`;
        }
      base.details = match?.adjustmentDetails
        ? `${match.adjustmentDetails} - ${detailsStr}`
        : detailsStr;
      } else {
        base.details = match?.adjustmentDetails
          ? `${match.adjustmentDetails} - Rent - Unit ${resolvedUnit}`
          : `Rent — Unit ${resolvedUnit}`;
      }
      if (nonResidentialIncome) {
        const amountInclVAT = Number(importAmount.toFixed(2));
        const amountExclVAT = Number((amountInclVAT / 1.15).toFixed(2));
        const vatAmount = Number((amountInclVAT - amountExclVAT).toFixed(2));
        const customer = contract
          ? customers.find((c: any) => c.id === contract.customerId) ||
            customers.find((c: any) => c.nameEn === contract.customerName || c.nameAr === contract.customerName || c.name === contract.customerName)
          : null;
        base.isVATApplicable = true;
        base.amount = amountInclVAT;
        base.totalWithVat = amountInclVAT;
        base.amountIncludingVAT = amountInclVAT;
        base.amountExcludingVAT = amountExclVAT;
        base.vatAmount = vatAmount;
        base.vatRate = 15;
        base.vatInvoiceNumber = getNextVatInvoiceNumber(
          existingTxs.filter(tx => tx.type === TransactionType.INCOME && !(tx as any).isCreditNote),
          row.parsedDate,
        );
        base.customerVATNumber = (customer as any)?.vatNumber || (customer as any)?.vatNo || undefined;
      }
    } else if (row.section === 'OTHER_INCOME') {
      base.incomeSubType = 'OTHER';
      base.details = match?.adjustmentDetails
        ? `${match.adjustmentDetails} - ${row.details || 'Other Income'}`
        : row.details || 'Other Income';
    } else if (row.section === 'OTHER_EXPENSES') {
      base.expenseCategory = row.category || ExpenseCategory.GENERAL;
      base.details = match?.adjustmentDetails
        ? `${match.adjustmentDetails} - ${row.details || row.category || 'Expense'}`
        : row.details || row.category || 'Expense';
    } else if (row.section === 'OWNER_EXPENSE' || isOwnerSalaryRow(row)) {
      base.expenseCategory = ExpenseCategory.OWNER_EXPENSE;
      const owner = matchOwner(row.sectionLabel) || matchOwner(row.details || '');
      if (owner) {
        base.ownerId = owner.id;
        base.ownerName = owner.name;
      }
      base.details = row.details
        ? `Owner expense - ${owner?.name || row.sectionLabel || 'Owner'} - ${row.details}`
        : `Owner expense - ${owner?.name || row.sectionLabel || 'Owner'}`;
    } else if (row.section === 'SALARY') {
      base.expenseCategory = ExpenseCategory.SALARY;
      const emp = matchEmployee(row.details || '');
      if (emp) {
        base.employeeId = emp.id;
        base.employeeName = emp.name;
      } else {
        base.employeeName = row.details || '';
      }
      const [y, m] = row.parsedDate.split('-');
      base.salaryPeriod = `${y}-${m}`;
      base.details = `Salary ${row.monthLabel} - ${base.employeeName || row.details}`;
    } else if (row.section === 'BORROWING') {
      base.expenseCategory = ExpenseCategory.BORROWING;
      base.borrowingType = 'BORROW';
      const emp = matchEmployee(row.details || '');
      if (emp) {
        base.employeeId = emp.id;
        base.employeeName = emp.name;
      } else {
        base.employeeName = row.details || '';
      }
      base.details = `Borrowing by ${base.employeeName || row.details}`;
    }

    return base as Transaction;
  }, [matchBuilding, matchOwner, matchEmployee, contracts, roomMap, currentUser, unitMapping, getImportBankName, customers, existingTxs]);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);

    const toImport = filteredRows.filter(row => {
      const key = rowStableKey(row);
      return selectedRowKeys.has(key) && getMatch(row).status === 'importable';
    });

    const missingBankRow = toImport.find(row => {
      if (row.paymentMethod !== 'BANK') return false;
      const building = matchBuilding(row.buildingLabel);
      return !getImportBankName(building);
    });
    if (missingBankRow) {
      showError(`Choose a bank for ${matchBuilding(missingBankRow.buildingLabel)?.name || missingBankRow.buildingLabel} before importing bank rows.`);
      setImporting(false);
      return;
    }

    setImportProgress({ done: 0, total: toImport.length });
    let success = 0, failed = 0;

    for (let i = 0; i < toImport.length; i++) {
      try {
        const tx = await buildTransaction(toImport[i], getMatch(toImport[i]));
        if (tx) {
          await saveTransaction(tx);
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setImportProgress({ done: i + 1, total: toImport.length });
    }

    setImporting(false);
    const txs = await getTransactions();
    setExistingTxs(txs || []);

    if (failed === 0) {
      showSuccess(`Imported ${success} transactions successfully!`);
    } else {
      showInfo(`Imported ${success}, failed ${failed}`);
    }
  };

  const setThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setFilterDateFrom(`${y}-${m}-01`);
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    setFilterDateTo(`${y}-${m}-${String(last).padStart(2, '0')}`);
    setFilterTillDate('');
  };

  const toggleMonth = (m: string) => setSelectedMonths(prev => {
    const next = new Set(prev);
    next.has(m) ? next.delete(m) : next.add(m);
    return next;
  });

  const toggleBuilding = (b: string) => setSelectedBuildings(prev => {
    const next = new Set(prev);
    next.has(b) ? next.delete(b) : next.add(b);
    return next;
  });

  const toggleSection = (s: SectionKind) => setSelectedSections(prev => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const renderMatchBadge = (m: SheetRowMatchResult) => {
    if (m.status === 'importable' && m.adjustmentAmount && m.adjustmentAmount > 0) {
      return (
        <span
          title={m.adjustmentDetails || 'Small adjustment'}
          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 max-w-[140px] truncate block"
        >
          Extra adjustment
          <span className="block text-[9px] font-semibold text-indigo-600 truncate">
            {m.adjustmentAmount.toLocaleString()} SAR
          </span>
        </span>
      );
    }
    if (m.status === 'in_amlak') {
      const label =
        m.confidence === 'exact' ? t('sheetsImport.matchExact') :
        m.confidence === 'soft_rent' ? t('sheetsImport.matchSoftRent') :
        t('sheetsImport.matchHigh');
      const tip = m.matchedTxDate
        ? `${t('sheetsImport.matchedAmlak')}: ${fmtDate(m.matchedTxDate)} · ${(m.matchedTxAmount || 0).toLocaleString()} SAR${m.matchedTxDetails ? ` — ${m.matchedTxDetails}` : ''}`
        : label;
      return (
        <span title={tip} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 max-w-[140px] truncate block">
          {label}
          {m.matchedTxDate && (
            <span className="block text-[9px] font-semibold text-amber-600 truncate">
              {fmtDate(m.matchedTxDate)} · {(m.matchedTxAmount || 0).toLocaleString()}
            </span>
          )}
        </span>
      );
    }
    if (m.status === 'needs_mapping') {
      const label =
        m.mappingReason === 'no_building' ? t('sheetsImport.needsBuilding') :
        m.mappingReason === 'no_unit' ? t('sheetsImport.needsUnit') :
        m.mappingReason === 'no_owner' ? t('sheetsImport.needsOwner') :
        m.mappingReason === 'no_employee' ? t('sheetsImport.needsEmployee') :
        t('sheetsImport.tabNeedsMapping');
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
          {label}
        </span>
      );
    }
    return <CheckCircle size={12} className="text-emerald-500 mx-auto" />;
  };

  const importableSelectedCount = useMemo(() => {
    let n = 0;
    displayRows.forEach(row => {
      const key = rowStableKey(row);
      if (selectedRowKeys.has(key) && getMatch(row).status === 'importable') n++;
    });
    return n;
  }, [displayRows, selectedRowKeys, getMatch]);

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="premium-card rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-white via-emerald-50/30 to-white border border-emerald-200/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-md">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{t('sheetsImport.title')}</h2>
            <p className="text-xs text-slate-500">
              {lastSynced
                ? `${t('sheetsImport.lastSynced')}: ${lastSynced.toLocaleTimeString()}`
                : t('sheetsImport.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-300 outline-none"
            />
          </div>
          <button onClick={handleSaveUrl} className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
            Save
          </button>
          <button
            onClick={handleSync}
            disabled={loading || !sheetId}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Sync Now
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Or upload directly:</span>
          <label className="cursor-pointer text-emerald-600 font-bold hover:underline">
            Choose .xlsx file
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>
          {parseResult && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${
              sheetFormat === 'easy'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {sheetFormat === 'easy' ? 'Amlak Easy Sheet' : 'Legacy Ledger'}
            </span>
          )}
        </div>
      </div>

      {parseResult && parseResult.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          {parseResult.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {e}
            </div>
          ))}
        </div>
      )}

      {parseResult && parseResult.rows.length > 0 && (
        <>
          <div className="premium-card rounded-2xl p-4 border border-emerald-200/70 bg-emerald-50/40">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-emerald-800 mb-1">Auto-selected import scope</h3>
                <p className="text-xs font-semibold text-emerald-700">
                  {selectedMonths.size} of {parseResult.months.length} month(s), {selectedBuildings.size} of {parseResult.buildings.length} building(s), and detected sections are included.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonths(new Set(parseResult.months));
                    setSelectedBuildings(new Set(parseResult.buildings));
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonths(new Set());
                    setSelectedBuildings(new Set());
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Months</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMonths(new Set(parseResult.months))}
                    className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-emerald-200 text-emerald-700"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMonths(new Set())}
                    className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-slate-200 text-slate-500"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {parseResult.months.map(monthLabel => {
                  const checked = selectedMonths.has(monthLabel);
                  const count = parseResult.rows.filter(r => r.monthLabel === monthLabel).length;
                  return (
                    <label
                      key={monthLabel}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                        checked
                          ? 'border-emerald-200 bg-white text-emerald-900'
                          : 'border-slate-200 bg-white/60 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMonth(monthLabel)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 shrink-0"
                      />
                      <span className="text-[11px] font-black">{monthLabel}</span>
                      <span className="text-[10px] font-bold opacity-70">{count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Buildings</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedBuildings(new Set(parseResult.buildings))}
                    className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-emerald-200 text-emerald-700"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBuildings(new Set())}
                    className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-slate-200 text-slate-500"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {parseResult.buildings.map(buildingLabel => {
                  const checked = selectedBuildings.has(buildingLabel);
                  const count = parseResult.rows.filter(r => r.buildingLabel === buildingLabel).length;
                  const matched = matchBuilding(buildingLabel);
                  return (
                    <label
                      key={buildingLabel}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-emerald-200 bg-white text-emerald-900'
                          : 'border-slate-200 bg-white/60 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBuilding(buildingLabel)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-black truncate">{matched?.name || buildingLabel}</span>
                        <span className="block text-[10px] font-bold opacity-70 truncate">
                          {count} row(s){matched && matched.name !== buildingLabel ? ` · ${buildingLabel}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="premium-card rounded-2xl p-4 border border-slate-200/70">
            <h3 className="text-sm font-black text-slate-700 mb-3">{t('sheetsImport.mapBuildings')}</h3>
            <div className="space-y-2">
              {parseResult.buildings.map(b => {
                const matched = matchBuilding(b);
                return (
                  <div key={b} className="flex items-center gap-3 p-2.5 rounded-xl border transition-all border-emerald-200 bg-emerald-50/50">
                    <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-700 truncate">{b}</div>
                    </div>
                    <span className="text-slate-400 text-xs">→</span>
                    <select
                      value={buildingMapping[b] || matched?.id || ''}
                      onChange={(e) => setBuildingMapping(prev => ({ ...prev, [b]: e.target.value }))}
                      className={`flex-1 max-w-[200px] px-2 py-1.5 text-xs font-bold rounded-lg border focus:ring-2 focus:ring-emerald-400 outline-none ${
                        matched || buildingMapping[b] ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      <option value="">-- Select Building --</option>
                      {buildings.map(bld => (
                        <option key={bld.id} value={bld.id}>{bld.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {bankMissingBuildings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Bank mapping required</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bankMissingBuildings.map(building => (
                    <div key={building.id} className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                      <div className="text-[11px] font-black text-blue-800 mb-1">{building.name}</div>
                      <select
                        value={bankMapping[building.id] || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setBankMapping(prev => {
                            const next = { ...prev };
                            if (val) next[building.id] = val;
                            else delete next[building.id];
                            return next;
                          });
                        }}
                        className="w-full text-[11px] border rounded px-2 py-1 font-bold bg-white border-blue-300 text-blue-800"
                      >
                        <option value="">Select bank...</option>
                        {banks.map(bank => (
                          <option key={(bank as any).id || bank.name} value={bank.name}>{bank.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="premium-card rounded-2xl p-4 border border-slate-200/70">
            <h3 className="text-sm font-black text-slate-700 mb-3">{t('sheetsImport.whatToImport')}</h3>
            <div className="flex flex-wrap gap-2">
              {parseResult.sections.map(s => {
                const count = filteredRows.filter(r => r.section === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => toggleSection(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      selectedSections.has(s) ? SECTION_COLORS[s] : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {SECTION_LABELS[s]}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedSections.has(s) ? 'bg-white/50' : 'bg-slate-100'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {parseResult.ownerLabels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">{t('sheetsImport.ownerMapping')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {parseResult.ownerLabels.map(label => {
                    const owner = matchOwner(label);
                    const mapKey = fuzzyNorm(label || '');
                    const mappedOwnerId = ownerMapping[mapKey] || owner?.id || '';
                    return (
                      <div key={label} className="rounded-lg border border-orange-200 bg-orange-50 p-2">
                        <div className="text-[11px] font-black text-orange-800 mb-1">{label}</div>
                        <select
                          value={mappedOwnerId}
                          onChange={e => {
                            const val = e.target.value;
                            setOwnerMapping(prev => {
                              const next = { ...prev };
                              if (val) next[mapKey] = val;
                              else delete next[mapKey];
                              return next;
                            });
                          }}
                          className={`w-full text-[11px] border rounded px-2 py-1 font-bold bg-white ${
                            mappedOwnerId ? 'border-emerald-300 text-emerald-800' : 'border-orange-300 text-orange-800'
                          }`}
                        >
                          <option value="">Select owner...</option>
                          {ownersList.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Toolbar + filters */}
          <div className="premium-card rounded-2xl p-4 border border-slate-200/70 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={15} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t('sheetsImport.search')}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border shadow-sm ${
                  showFilters ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <SlidersHorizontal size={14} /> {t('sheetsImport.filters')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (debugRowKey) {
                    setDebugMode(false);
                    setDebugRowKey('');
                  } else {
                    setDebugMode(true);
                    const first = tabRows[0] || displayRows[0];
                    if (first) setDebugRowKey(rowStableKey(first));
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border shadow-sm ${
                  debugRowKey ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <AlertTriangle size={14} /> Matching audit
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-slide-up">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('sheetsImport.fromDate')}</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('sheetsImport.toDate')}</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">{t('sheetsImport.tillDate')}</label>
                  <input type="date" value={filterTillDate} onChange={e => setFilterTillDate(e.target.value)} className="w-full px-2 py-2 border border-emerald-200 rounded-lg text-xs" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={setThisMonth} className="flex-1 px-2 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white">{t('sheetsImport.thisMonth')}</button>
                  <button type="button" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterTillDate(''); }} className="px-2 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white">{t('sheetsImport.clearDates')}</button>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs">
                    <option value="ALL">{t('sheetsImport.typeAll')}</option>
                    <option value="INCOME">{t('sheetsImport.typeIncome')}</option>
                    <option value="EXPENSE">{t('sheetsImport.typeExpense')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Method</label>
                  <select value={filterMethod} onChange={e => setFilterMethod(e.target.value as any)} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs">
                    <option value="ALL">{t('sheetsImport.methodAll')}</option>
                    <option value="CASH">{t('sheetsImport.methodCash')}</option>
                    <option value="BANK">{t('sheetsImport.methodBank')}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{t('sheetsImport.kpiIncome')}</span>
                <CheckCircle size={14} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-900">{kpi.incomeTotal.toLocaleString()} <span className="text-xs text-emerald-500">{t('common.sar')}</span></div>
              <div className="mt-2 flex gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('sheetsImport.cash')} · {kpi.incomeCash.toLocaleString()}</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">{t('sheetsImport.bank')} · {kpi.incomeBank.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">{t('sheetsImport.kpiExpense')}</span>
                <AlertTriangle size={14} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-900">{kpi.expenseTotal.toLocaleString()} <span className="text-xs text-rose-500">{t('common.sar')}</span></div>
              <div className="mt-2 flex gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('sheetsImport.cash')} · {kpi.expenseCash.toLocaleString()}</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">{t('sheetsImport.bank')} · {kpi.expenseBank.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">{t('sheetsImport.kpiInAmlak')}</span>
                <FileText size={14} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-900">{kpi.inAmlakTotal.toLocaleString()} <span className="text-xs text-amber-500">{t('common.sar')}</span></div>
              <p className="text-[10px] font-bold text-amber-600 mt-1">{kpi.inAmlakCount} rows</p>
            </div>
            <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">{t('sheetsImport.kpiReady')}</span>
                <Download size={14} className="text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-900">{kpi.importableTotal.toLocaleString()} <span className="text-xs text-indigo-500">{t('common.sar')}</span></div>
              <p className="text-[10px] font-bold text-indigo-600 mt-1">{kpi.importableCount} rows</p>
            </div>
          </div>

          {kpi.needsMappingCount > 0 && (
            <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-4 py-2.5 flex items-center justify-between shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-700">{t('sheetsImport.kpiNeedsMapping')}</span>
              <span className="text-base font-black text-orange-800">{kpi.needsMappingCount}</span>
            </div>
          )}

          {/* Tabs + import */}
          <div className="premium-card rounded-2xl border border-slate-200/70 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-b border-slate-100 bg-slate-50/80">
              <div className="flex flex-wrap gap-1">
                {(['importable', 'in_amlak', 'needs_mapping', 'amlak_transactions', 'unmatched_amlak'] as ImportTab[]).map(tab => {
                  const count =
                    tab === 'importable' ? tabCounts.importable :
                    tab === 'in_amlak' ? tabCounts.inAmlak :
                    tab === 'needs_mapping' ? tabCounts.needsMapping :
                    tab === 'amlak_transactions' ? tabCounts.amlakTransactions :
                    tabCounts.unmatchedAmlak;
                  const label =
                    tab === 'importable' ? t('sheetsImport.tabImportable') :
                    tab === 'in_amlak' ? t('sheetsImport.tabInAmlak') :
                    tab === 'needs_mapping' ? t('sheetsImport.tabNeedsMapping') :
                    tab === 'amlak_transactions' ? 'Amlak transactions' :
                    'Unmatched Amlak';
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        activeTab === tab
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
              {activeTab === 'importable' && (
                <button
                  onClick={handleImport}
                  disabled={importing || importableSelectedCount === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {importProgress.done}/{importProgress.total}
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      {t('sheetsImport.importCount').replace('{count}', String(importableSelectedCount))}
                    </>
                  )}
                </button>
              )}
            </div>

            {importing && (
              <div className="px-3 pb-2">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              {(activeTab === 'amlak_transactions' || activeTab === 'unmatched_amlak') ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Date</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Building</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Type</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Unit</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Name / Details</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-right">Amount</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-center">Method</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleAmlakRows.map(tx => {
                      const txIsIncome = String(tx.type).toUpperCase() === 'INCOME';
                      const building = buildings.find(b => b.id === tx.buildingId);
                      const primaryName = tx.customerName || tx.ownerName || tx.employeeName || tx.vendorName || '';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-mono text-slate-600">{tx.date}</td>
                          <td className="px-3 py-2 text-slate-700 font-semibold">{building?.name || tx.buildingName || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              txIsIncome ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {txIsIncome ? (tx.incomeSubType === 'RENTAL' ? 'Rental Income' : 'Other Income') : (tx.expenseCategory || 'Expense')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-semibold">{tx.unitNumber || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[260px]">
                            <div className="font-semibold truncate">{primaryName || tx.details || '-'}</div>
                            {primaryName && tx.details && (
                              <div className="text-[10px] text-slate-400 truncate">{tx.details}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">
                            <span className={txIsIncome ? 'text-emerald-700' : 'text-rose-700'}>{(tx.amount || 0).toLocaleString()}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${txPaymentGroup(tx) === 'BANK' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {txPaymentGroup(tx) || tx.paymentMethod || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {tx.status || 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {activeTab === 'importable' && (
                        <th className="px-2 py-2.5 text-center w-8">
                          <input
                            type="checkbox"
                            checked={importableSelectedCount > 0 && importableSelectedCount === tabCounts.importable}
                            onChange={e => {
                              if (e.target.checked) {
                                const keys = new Set<string>();
                                displayRows.forEach(row => {
                                  const key = rowStableKey(row);
                                  if (getMatch(row).status === 'importable') keys.add(key);
                                });
                                setSelectedRowKeys(keys);
                              } else {
                                setSelectedRowKeys(new Set());
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600"
                            title={t('sheetsImport.selectAllImportable')}
                          />
                        </th>
                      )}
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Date</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Building</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Section</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Unit</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase">Details</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-right">Amount</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-center">Method</th>
                      <th className="px-3 py-2.5 font-black text-[10px] text-slate-500 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleTabRows.map(row => {
                    const key = rowStableKey(row);
                    const building = matchBuilding(row.buildingLabel);
                    const m = getMatch(row);
                    const isRental = ['FLATS_RENT', 'SHOP_RENT', 'INTERNET'].includes(row.section);
                    const unitMatch = isRental && building
                      ? matchUnitName(row.unitNumber || '', building.units || [], unitMapping, building.id)
                      : null;
                    const previewContract = (isRental && building && unitMatch?.matched)
                      ? contracts.find(c => c.buildingId === building.id && contractMatchesUnit(c.unitName, unitMatch.unitName) && c.status === 'Active')
                        || contracts.find(c => c.buildingId === building.id && contractMatchesUnit(c.unitName, unitMatch.unitName))
                      : null;
                    const mapKey = building ? `${building.id}:${row.unitNumber || ''}` : '';
                    const isEmployeeMappedSection = (row.section === 'SALARY' && !isOwnerSalaryRow(row)) || row.section === 'BORROWING';
                    const employeeMapKey = fuzzyNorm(row.details || '');
                    const mappedEmployeeId = employeeMapping[employeeMapKey] || '';
                    const displaySection = isOwnerSalaryRow(row) ? 'OWNER_EXPENSE' : row.section;
                    const mappedOwner = displaySection === 'OWNER_EXPENSE'
                      ? (matchOwner(row.sectionLabel) || matchOwner(row.details || ''))
                      : null;
                    const selected = selectedRowKeys.has(key);

                    return (
                      <tr
                        key={key}
                        className={`${selected && activeTab === 'importable' ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'hover:bg-slate-50/60'} ${debugRowKey === key ? 'outline outline-2 outline-slate-400 outline-offset-[-2px]' : ''}`}
                      >
                        {activeTab === 'importable' && (
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={e => {
                                setSelectedRowKeys(prev => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(key) : next.delete(key);
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 font-mono text-slate-600">{row.parsedDate}</td>
                        <td className="px-3 py-2 text-slate-700 font-semibold">
                          {building?.name || <span className="text-rose-500">{row.buildingLabel}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${SECTION_COLORS[displaySection]}`}>
                            {displaySection === 'OWNER_EXPENSE'
                              ? `${SECTION_LABELS[displaySection]} · ${row.sectionLabel}`
                              : SECTION_LABELS[displaySection]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {isRental && row.unitNumber ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-[10px] font-bold ${unitMatch?.matched ? 'text-slate-400' : 'text-amber-600'}`}>
                                #{row.unitNumber}
                              </span>
                              {building && (building.units?.length || 0) > 0 && activeTab === 'needs_mapping' && (
                                <select
                                  value={unitMatch?.matched ? unitMatch.unitName : (unitMapping[mapKey] || '')}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val) setUnitMapping(prev => ({ ...prev, [mapKey]: val }));
                                    else setUnitMapping(prev => { const next = { ...prev }; delete next[mapKey]; return next; });
                                  }}
                                  className="text-[10px] border rounded px-1 py-0.5 font-bold max-w-[110px] border-amber-300 bg-amber-50"
                                >
                                  <option value="">Select unit…</option>
                                  {(building.units || []).map(u => (
                                    <option key={u.name} value={u.name}>{u.name}</option>
                                  ))}
                                </select>
                              )}
                              {building && unitMatch?.matched && activeTab !== 'needs_mapping' && (
                                <span className="text-[10px] font-bold text-emerald-700">{unitMatch.unitName}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[220px]">
                          {isRental ? (
                            previewContract ? (
                              <span className="text-emerald-700 font-semibold">{previewContract.customerName}</span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">{row.details || '-'}</span>
                            )
                          ) : isEmployeeMappedSection && activeTab === 'needs_mapping' ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-slate-500 truncate">{row.details || '-'}</span>
                              <select
                                value={mappedEmployeeId}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEmployeeMapping(prev => {
                                    const next = { ...prev };
                                    if (val) next[employeeMapKey] = val;
                                    else delete next[employeeMapKey];
                                    return next;
                                  });
                                }}
                                className="text-[10px] border rounded px-1 py-0.5 font-bold max-w-[160px] border-purple-300 bg-purple-50 text-purple-800"
                              >
                                <option value="">Select staff...</option>
                                {employeesList.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                              </select>
                            </div>
                          ) : displaySection === 'OWNER_EXPENSE' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate block">{row.details || row.category || '-'}</span>
                              <span className={`text-[10px] font-bold ${mappedOwner ? 'text-emerald-700' : 'text-orange-600'}`}>
                                {row.sectionLabel}{mappedOwner ? ` → ${mappedOwner.name}` : ' → select owner above'}
                              </span>
                            </div>
                          ) : (
                            <span className="truncate block">{row.details || row.category || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          <span className={isIncomeSection(row.section) ? 'text-emerald-700' : 'text-rose-700'}>
                            {(m.adjustmentAmount || row.amount).toLocaleString()}
                          </span>
                          {m.adjustmentAmount && m.adjustmentAmount > 0 && (
                            <span className="block text-[9px] font-semibold text-slate-400 line-through">
                              {row.amount.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.paymentMethod === 'BANK' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!building && m.status !== 'needs_mapping' ? (
                              <span className="text-[10px] font-bold text-rose-500">{t('sheetsImport.noBuilding')}</span>
                            ) : (
                              renderMatchBadge(m)
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDebugMode(true);
                                setDebugRowKey(key);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                debugRowKey === key
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              Audit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              )}
              {activeTabTotal === 0 && (
                <div className="py-12 text-center text-sm font-bold text-slate-400">No rows in this tab</div>
              )}
            </div>
            {debugInfo && activeTab !== 'amlak_transactions' && activeTab !== 'unmatched_amlak' && (
              <div className="border-t border-slate-200 bg-slate-50/80 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-slate-800">Matching audit: {debugInfo.result.status}</div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {debugInfo.sheet.date} · {debugInfo.sheet.section} · {debugInfo.sheet.buildingLabel} · {debugInfo.sheet.unitNumber || '-'} · {debugInfo.sheet.amount.toLocaleString()} {debugInfo.sheet.paymentMethod}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(debugInfo, null, 2));
                      showInfo('Match debug copied');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                  >
                    Copy debug JSON
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="font-black text-slate-500 uppercase text-[9px]">Resolved</div>
                    <div className="font-bold text-slate-800 truncate">{debugInfo.resolved.buildingName || 'No building'}</div>
                    <div className={debugInfo.resolved.unitMatched ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      Unit: {debugInfo.resolved.unitName || '-'} {debugInfo.resolved.unitMatched ? '' : '(not mapped)'}
                    </div>
                    {debugInfo.resolved.mappingReason && (
                      <div className="text-rose-600 font-semibold">Mapping: {debugInfo.resolved.mappingReason}</div>
                    )}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="font-black text-slate-500 uppercase text-[9px]">Transactions loaded</div>
                    <div className="font-bold text-slate-800">{debugInfo.counts.eligibleTransactions} usable / {debugInfo.counts.existingTransactions} total</div>
                    <div className="text-slate-500">Exact fingerprints: {debugInfo.fingerprints.exactMatchCount}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="font-black text-slate-500 uppercase text-[9px]">Aggregate</div>
                    <div className="font-bold text-slate-800">
                      {debugInfo.aggregate.enabled ? `${debugInfo.aggregate.candidateCount} candidates` : 'Not rental row'}
                    </div>
                    <div className="text-slate-500">
                      Sum: {debugInfo.aggregate.candidateTotal.toLocaleString()} / {debugInfo.aggregate.targetAmount.toLocaleString()}
                    </div>
                    {debugInfo.aggregate.matchedIds.length > 0 && (
                      <div className="text-emerald-700 font-semibold truncate">Matched: {debugInfo.aggregate.matchedIds.join(', ')}</div>
                    )}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2">
                    <div className="font-black text-slate-500 uppercase text-[9px]">Unmatched Amlak</div>
                    <div className="font-bold text-slate-800">{unmatchedAmlakTransactions.length} not used</div>
                    <div className="text-slate-500">Open the Unmatched Amlak tab for the full list</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Amlak candidates and why they did or did not match</div>
                  {debugInfo.topCandidates.slice(0, 8).map(candidate => (
                    <div key={candidate.txId || `${candidate.date}-${candidate.amount}-${candidate.details}`} className="bg-white border border-slate-200 rounded-lg p-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-800 truncate">
                            {candidate.date || '-'} · {candidate.type || '-'} · {candidate.unitNumber || '-'} · {candidate.amount.toLocaleString()} · score {candidate.score}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500 truncate">{candidate.details || candidate.category || candidate.incomeSubType || candidate.txId}</div>
                        </div>
                        <div className="text-[10px] font-black text-slate-500">relevance {candidate.relevance}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {candidate.checks.map(check => (
                          <span
                            key={`${candidate.txId}-${check.label}`}
                            title={check.detail}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              check.ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {check.label}: {check.ok ? 'ok' : 'fail'}
                          </span>
                        ))}
                      </div>
                      {candidate.checks.some(check => !check.ok) && (
                        <div className="mt-1 space-y-0.5">
                          {candidate.checks.filter(check => !check.ok).slice(0, 4).map(check => (
                            <div key={`${candidate.txId}-${check.label}-detail`} className="text-[10px] font-semibold text-rose-600">
                              {check.label}: {check.detail}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTabTotal > visibleCount && (
              <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">
                  {t('sheetsImport.showingRows')
                    .replace('{shown}', String(visibleCount))
                    .replace('{total}', String(activeTabTotal))}
                </span>
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                >
                  {t('sheetsImport.loadMore')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {!parseResult && !loading && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400 mb-4">
            <FileSpreadsheet size={28} />
          </div>
          <div className="text-sm font-bold text-slate-500">Paste your Google Sheet URL above and click Sync</div>
          <div className="text-xs text-slate-400 mt-1">Or upload an .xlsx file directly</div>
        </div>
      )}
    </div>
  );
};

export default SheetsImport;



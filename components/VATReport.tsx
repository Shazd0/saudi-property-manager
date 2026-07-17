import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, ExpenseCategory, PaymentMethod, Building, Customer, Vendor, Bank } from '../types';
import { getTransactions, saveTransaction, getBuildings, getCustomers, getActiveContract, getVendors, createCreditNote, deleteTransaction, getContracts, saveContract, getBanks, getCustomExpenseCategories, saveCustomExpenseCategories } from '../services/firestoreService';
import { isValidSaudiVAT } from '../utils/validators';
import SearchableSelect from './SearchableSelect';
import AddVendorDialog from './AddVendorDialog';
import ConfirmDialog from './ConfirmDialog';
import { FileText, Download, Calendar, Receipt, TrendingUp, TrendingDown, X, QrCode, FileDown, Search, Send, CheckCircle, AlertCircle, Loader, Eye, Plus, User, Sparkles, RotateCcw, FileUp, Trash2, ArrowLeftRight } from 'lucide-react';
import PdfPurchaseImport from './PdfPurchaseImport';
import { fmtDate, dateToLocalStr } from '../utils/dateFormat';
import { buildTransactionSearchHaystack, matchesAdvancedSearch } from '../utils/advancedSearch';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import { getInstallmentRange } from '../utils/installmentSchedule';
import { getNextVatInvoiceNumber, getNextVatSalesInvoiceNumber } from '../utils/vatInvoiceNumber';
import { applyVatReportSnapshot, createVatReportSnapshot } from '../utils/vatSnapshot';
import { auth } from '../firebase';
import { useLanguage } from '../i18n';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from '../utils/contractTransactionFilter';
import { computeInstallmentProgress } from '../utils/installmentPaymentProgress';
import { getNonResFeePeriodContext, getNonResFeeBreakdownLines } from '../utils/nonResidentialFeeSchedule';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ZATCA_SERVICE_URL = (import.meta as any).env?.VITE_ZATCA_SERVICE_URL || 'http://localhost:3022';

const companyName = 'شركة ارار ميلينيوم المحدودة';
const companyNameEn = 'RR MILLENNIUM CO. LTD';
const companyVAT = '312610089400003';
const companyAddress = 'Dammam, Saudi Arabia';
const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const formatAmount = (value: number): string =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hasZatcaReport = (tx: Transaction): boolean => Boolean(tx.zatcaQRCode || (tx as any).zatcaReportedAt);

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const compareVatSequence = (a: Transaction, b: Transaction): number =>
  (a.date || '').localeCompare(b.date || '') ||
  ((a.createdAt || 0) - (b.createdAt || 0)) ||
  (a.vatInvoiceNumber || '').localeCompare(b.vatInvoiceNumber || '', undefined, { numeric: true });

/** Calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec). */
const getQuarterDateRange = (year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } => {
  const bounds: Record<1 | 2 | 3 | 4, { sm: number; sd: number; em: number; ed: number }> = {
    1: { sm: 1, sd: 1, em: 3, ed: 31 },
    2: { sm: 4, sd: 1, em: 6, ed: 30 },
    3: { sm: 7, sd: 1, em: 9, ed: 30 },
    4: { sm: 10, sd: 1, em: 12, ed: 31 },
  };
  const b = bounds[quarter];
  return {
    from: `${year}-${pad2(b.sm)}-${pad2(b.sd)}`,
    to: `${year}-${pad2(b.em)}-${pad2(b.ed)}`,
  };
};

const VATReport: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { t, isRTL } = useLanguage();

  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  /** Empty string = custom/manual date range; '1'–'4' = calendar quarter for `vatQuarterYear`. */
  const [vatQuarterFilter, setVatQuarterFilter] = useState('');
  const [vatQuarterYear, setVatQuarterYear] = useState(() => String(new Date().getFullYear()));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuildingId, setFilterBuildingId] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filteredVATTransactions, setFilteredVATTransactions] = useState<Transaction[]>([]);
  const [reportView, setReportView] = useState<'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'COMBINED' | 'COMPARE'>('SALES');
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [zatcaSending, setZatcaSending] = useState<Record<string, boolean>>({});
  const [zatcaStatus, setZatcaStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [invoiceModal, setInvoiceModal] = useState<Transaction | null>(null);

  // Quick Entry state
  const [showQE, setShowQE] = useState(false);
  const [qeType, setQeType] = useState<'SALES' | 'EXPENSE' | 'FEES'>('SALES');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [qeDate, setQeDate] = useState(new Date().toISOString().split('T')[0]);
  const [qeAmount, setQeAmount] = useState('');
  const [qeDetails, setQeDetails] = useState('');
  const [qePaymentMethod, setQePaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK);
  const [qeBankName, setQeBankName] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [qeBuildingId, setQeBuildingId] = useState('');
  const [qeUnitNumber, setQeUnitNumber] = useState('');
  const [qeCustomerVAT, setQeCustomerVAT] = useState('');
  const [qeVendorName, setQeVendorName] = useState('');
  const [qeVendorVAT, setQeVendorVAT] = useState('');
  const [qeCategory, setQeCategory] = useState<string>(ExpenseCategory.VENDOR_PAYMENT);
  const [qeSubCategory, setQeSubCategory] = useState('');
  const [qeExpenseCustomCategories, setQeExpenseCustomCategories] = useState<string[]>([]);
  const [qeNewExpenseCategoryInput, setQeNewExpenseCategoryInput] = useState('');
  const [qeSaving, setQeSaving] = useState(false);
  const [qeErrors, setQeErrors] = useState<{ customerVAT?: string; vendorVAT?: string; vendorName?: string; amount?: string; feesComplete?: string; bankName?: string; property?: string; unit?: string }>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [qeContractCustomer, setQeContractCustomer] = useState<Customer | null>(null);
  const [qeVatAutoFilled, setQeVatAutoFilled] = useState(false);
  const [qeContractLookupLoading, setQeContractLookupLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [qeVendorId, setQeVendorId] = useState('');
  const [qeActiveContract, setQeActiveContract] = useState<any>(undefined);
  const [qeContractStats, setQeContractStats] = useState({ paid: 0, remaining: 0, installmentNo: 1 });
  const [qeNonVatFeesPerInst, setQeNonVatFeesPerInst] = useState(0);
  const [qeFeesPaidThisInst, setQeFeesPaidThisInst] = useState(0);
  const [qeFeePeriodInstallment, setQeFeePeriodInstallment] = useState<number | null>(null);
  const [qeFeesAllPeriodsPaid, setQeFeesAllPeriodsPaid] = useState(false);
  const [qeFeesGenerateInvoice, setQeFeesGenerateInvoice] = useState(false);
  const [qeVendorAutoFilled, setQeVendorAutoFilled] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [qeVendorRefNo, setQeVendorRefNo] = useState('');
  const [qePurchaseBuildingId, setQePurchaseBuildingId] = useState('');
  const [reversalTarget, setReversalTarget] = useState<Transaction | null>(null);
  const [zatcaConfirmTarget, setZatcaConfirmTarget] = useState<Transaction | null>(null);
  const [reversalSaving, setReversalSaving] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Compare Tab state
  const [compareDateFrom, setCompareDateFrom] = useState('');
  const [compareDateTo, setCompareDateTo] = useState('');
  const [compareSearchTerm, setCompareSearchTerm] = useState('');
  const [comparePreview, setComparePreview] = useState<Transaction | null>(null);
  const [showDuplicateInspector, setShowDuplicateInspector] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Always load rows first — migrate/snapshots must never block the tab.
      try {
        await loadData();
      } catch (e) {
        console.error('VATReport loadData failed', e);
      }
      if (cancelled) return;
      try {
        await migrateVatInvoiceNumbers();
        if (!cancelled) await loadData();
      } catch (e) {
        console.error('VATReport migrateVatInvoiceNumbers failed', e);
      }
    })();
    Promise.all([getBuildings(), getCustomers(), getVendors(), getBanks(), getContracts()]).then(([b, c, v, bks, ctr]) => {
      if (cancelled) return;
      setBuildings(b || []);
      setCustomers(c || []);
      setVendors((v || []).filter((vn: Vendor) => vn.status !== 'Inactive'));
      setBanks(bks || []);
      setContracts(ctr || []);
    }).catch((e) => console.error('VATReport secondary load failed', e));
    return () => { cancelled = true; };
  }, []);

  const customerRoomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);
  const contractCustomerMap = useMemo(() => {
    const map = new Map<string, string>();
    contracts.forEach((c: any) => {
      if (!c?.id) return;
      const label = formatCustomerFromMap(c.customerName, c.customerId, customerRoomMap).trim();
      if (label) map.set(c.id, label);
    });
    return map;
  }, [contracts, customerRoomMap]);

  const resolveSalesCustomerName = useCallback((tx: Transaction): string => {
    const explicitName = String((tx as any).customerName || '').trim();
    if (explicitName) return explicitName;
    if (tx.contractId && contractCustomerMap.has(tx.contractId)) return contractCustomerMap.get(tx.contractId)!;
    if (tx.customerVATNumber) {
      const byVat = customers.find(c => (c.vatNumber || '').trim() === tx.customerVATNumber?.trim());
      if (byVat) return formatNameWithRoom(byVat.nameEn || byVat.nameAr, byVat.roomNumber);
    }
    return 'Customer';
  }, [contractCustomerMap, customers]);

  const vatQuarterYearOptions = useMemo(() => {
    const nowY = new Date().getFullYear();
    const start = Math.min(2018, nowY - 10);
    const years: number[] = [];
    for (let yy = start; yy <= nowY + 1; yy++) years.push(yy);
    return years;
  }, []);

  useEffect(() => {
    if (!vatQuarterFilter) return;
    const y = parseInt(vatQuarterYear, 10);
    if (!Number.isFinite(y) || y < 1000 || y > 9999) return;
    const q = parseInt(vatQuarterFilter, 10) as 1 | 2 | 3 | 4;
    if (q < 1 || q > 4) return;
    const { from, to } = getQuarterDateRange(y, q);
    setFilterFromDate(from);
    setFilterToDate(to);
  }, [vatQuarterFilter, vatQuarterYear]);

  const loadData = async () => {
    const [txs, cloudCats] = await Promise.all([
      getTransactions(),
      getCustomExpenseCategories().catch(() => [] as string[]),
    ]);
    setTransactions(txs || []);
    setQeExpenseCustomCategories(Array.isArray(cloudCats) ? cloudCats : []);
  };

  const qeExpenseCategoryOptions = useMemo(() => {
    const defaults = Object.values(ExpenseCategory) as string[];
    return Array.from(new Set([...defaults, ...qeExpenseCustomCategories])).sort((a, b) => a.localeCompare(b));
  }, [qeExpenseCustomCategories]);

  const persistQeCustomExpenseCategories = useCallback((customOnlyFromMerged: string[]) => {
    const defaults = Object.values(ExpenseCategory);
    const customOnly = customOnlyFromMerged.filter((x) => !defaults.includes(x as ExpenseCategory));
    saveCustomExpenseCategories(customOnly).catch(() => {});
  }, []);

  const addQeExpenseCategory = () => {
    const name = qeNewExpenseCategoryInput.trim();
    if (!name) return;
    const defaults = Object.values(ExpenseCategory) as string[];
    if (defaults.includes(name) || qeExpenseCustomCategories.includes(name)) {
      setQeCategory(name);
      setQeNewExpenseCategoryInput('');
      return;
    }
    const nextCustom = [name, ...qeExpenseCustomCategories.filter((x) => x !== name)];
    setQeExpenseCustomCategories(nextCustom);
    setQeCategory(name);
    setQeSubCategory('');
    setQeNewExpenseCategoryInput('');
    persistQeCustomExpenseCategories(nextCustom);
  };

  const migrateVatInvoiceNumbers = useCallback(async () => {
    const txs = (await getTransactions()) || [];
    const vatRows = txs.filter(t => t.isVATApplicable === true);
    if (vatRows.length === 0) return;

    // One-time sequential renumber can rewrite hundreds of docs and freeze the tab.
    // Only fill *missing* invoice numbers; never reshuffle existing SV-/CN- numbers on every visit.
    const invoiceRows = vatRows
      .filter(t => t.type === TransactionType.INCOME && !t.isCreditNote && hasZatcaReport(t))
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || ((a.createdAt || 0) - (b.createdAt || 0)));
    const creditRows = vatRows
      .filter(t => !!t.isCreditNote)
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || ((a.createdAt || 0) - (b.createdAt || 0)));
    const purchaseRows = vatRows.filter(t => t.type === TransactionType.EXPENSE && !t.isCreditNote);

    const yearlyInvoiceCounters: Record<string, number> = {};
    const yearlyCreditCounters: Record<string, number> = {};
    // Seed counters from numbers already assigned so new blanks continue the sequence.
    for (const tx of invoiceRows) {
      const m = String(tx.vatInvoiceNumber || '').match(/^SV-(\d+)$/i);
      if (!m) continue;
      const year = String(new Date(tx.date || Date.now()).getFullYear());
      yearlyInvoiceCounters[year] = Math.max(yearlyInvoiceCounters[year] || 0, parseInt(m[1], 10) || 0);
    }
    for (const tx of creditRows) {
      const m = String(tx.vatInvoiceNumber || '').match(/^CN-(\d{4})-(\d+)$/i);
      if (!m) continue;
      const year = m[1];
      yearlyCreditCounters[year] = Math.max(yearlyCreditCounters[year] || 0, parseInt(m[2], 10) || 0);
    }

    const updates: Transaction[] = [];

    for (const tx of invoiceRows) {
      if (String(tx.vatInvoiceNumber || '').trim()) continue;
      const year = String(new Date(tx.date || Date.now()).getFullYear());
      yearlyInvoiceCounters[year] = (yearlyInvoiceCounters[year] || 0) + 1;
      const nextNo = `SV-${yearlyInvoiceCounters[year]}`;
      updates.push({
        ...tx,
        vatInvoiceNumber: nextNo,
        vatReportSnapshot: (tx as any).vatReportSnapshot
          ? { ...(tx as any).vatReportSnapshot, vatInvoiceNumber: nextNo }
          : (tx as any).vatReportSnapshot,
      } as Transaction);
    }

    for (const tx of creditRows) {
      if (String(tx.vatInvoiceNumber || '').trim()) continue;
      const year = String(new Date(tx.date || Date.now()).getFullYear());
      yearlyCreditCounters[year] = (yearlyCreditCounters[year] || 0) + 1;
      const nextNo = `CN-${year}-${String(yearlyCreditCounters[year]).padStart(2, '0')}`;
      updates.push({
        ...tx,
        vatInvoiceNumber: nextNo,
        vatReportSnapshot: (tx as any).vatReportSnapshot
          ? { ...(tx as any).vatReportSnapshot, vatInvoiceNumber: nextNo }
          : (tx as any).vatReportSnapshot,
      } as Transaction);
    }

    for (const tx of purchaseRows) {
      const billNo = String((tx as any).vendorRefNo || '').trim();
      if (!billNo) continue;
      if (String(tx.vatInvoiceNumber || '') === billNo) continue;
      updates.push({
        ...tx,
        vatInvoiceNumber: billNo,
        vatReportSnapshot: (tx as any).vatReportSnapshot
          ? { ...(tx as any).vatReportSnapshot, vatInvoiceNumber: billNo }
          : (tx as any).vatReportSnapshot,
      } as Transaction);
    }

    if (updates.length === 0) return;
    // Sequential saves — avoid slamming Mac API with hundreds of parallel PUTs.
    for (const tx of updates) {
      await saveTransaction(tx, { skipAmlakSheetSync: true }).catch(() => {});
    }
  }, []);

  const nonResidentialBuildings = buildings.filter(b => b.propertyType === 'NON_RESIDENTIAL' || b.vatApplicable);
  const feesEligibleBuildings = useMemo(
    () => buildings.filter((b) => b.propertyType === 'NON_RESIDENTIAL'),
    [buildings],
  );

  useEffect(() => {
    if (qeType !== 'FEES' || !qeBuildingId) return;
    if (!feesEligibleBuildings.some((b) => b.id === qeBuildingId)) {
      setQeBuildingId('');
      setQeUnitNumber('');
      setQeActiveContract(undefined);
      setQeNonVatFeesPerInst(0);
      setQeFeesPaidThisInst(0);
      setQeFeePeriodInstallment(null);
      setQeFeesAllPeriodsPaid(false);
      setQeContractCustomer(null);
    }
  }, [qeType, qeBuildingId, feesEligibleBuildings]);

  const selectedQEBuilding = buildings.find(b => b.id === qeBuildingId);
  const qeBuildingUnits = useMemo(() => {
    if (!selectedQEBuilding) return [];
    return selectedQEBuilding.units.map((u: any) => typeof u === 'string' ? u : u.name);
  }, [selectedQEBuilding]);

  /** Banks for the selected property: book banks filtered by per-bank buildingId (if set), else building default bank first + all book banks. */
  const getBanksForBuildingId = useCallback(
    (buildingId: string | undefined) => {
      const list = (banks || []).filter(b => b?.name);
      if (!buildingId) return list;
      const b = buildings.find(x => x.id === buildingId);
      const byDoc = list.filter(bk => {
        const bid = (bk as any).buildingId ?? (bk as any).building;
        const bids = (bk as any).buildingIds;
        if (bid) return bid === buildingId;
        if (Array.isArray(bids)) return bids.includes(buildingId);
        return false;
      });
      if (byDoc.length > 0) return byDoc;
      const ordered: Bank[] = [];
      const seen = new Set<string>();
      if (b?.bankName) {
        const m = list.find(bk => bk.name === b.bankName);
        if (m) {
          ordered.push(m);
          seen.add(m.name);
        }
      }
      list.forEach(bk => {
        if (!seen.has(bk.name)) {
          ordered.push(bk);
          seen.add(bk.name);
        }
      });
      return ordered.length > 0 ? ordered : list;
    },
    [banks, buildings]
  );

  const qeContextBuildingId = useMemo(() => {
    if (qeType === 'EXPENSE') return qePurchaseBuildingId || undefined;
    return qeBuildingId || undefined;
  }, [qeType, qeBuildingId, qePurchaseBuildingId]);

  const qeBankOptions = useMemo(
    () => getBanksForBuildingId(qeContextBuildingId),
    [getBanksForBuildingId, qeContextBuildingId]
  );

  const isCurrentVatEntry = qeType === 'FEES' ? false : (qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT));

  const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
    'General Expense':    ['Office Supplies', 'Travel & Transport', 'Printing & Stationery', 'Bank Charges', 'Cleaning', 'Advertisement', 'Miscellaneous'],
    'Head Office':        ['Rent', 'Admin Costs', 'IT Equipment', 'Communications', 'Furniture & Fixtures'],
    'Salary':             ['Basic Salary', 'Housing Allowance', 'Transport Allowance', 'Overtime', 'GOSI Contribution', 'End of Service', 'Bonus'],
    'Borrowing':          ['Personal Loan', 'Business Loan', 'Repayment', 'Opening Balance'],
    'Owner Expense':      ['Personal Drawings', 'Owner Investment', 'Owner Settlement'],
    'Maintenance':        ['Plumbing', 'Electrical', 'AC / HVAC', 'Painting', 'Civil Works', 'Pest Control', 'Elevator', 'General Repairs'],
    'Utilities':          ['Electricity', 'Water', 'Internet / Fiber', 'Gas', 'Telephone / Mobile'],
    'Vendor Payment':     ['Materials Supply', 'Labor', 'Equipment Rental', 'Subcontractor', 'Services'],
    'Property Rent':      ['Monthly Rent', 'Annual Rent', 'Security Deposit', 'Advance Rent'],
    'Service Agreement':  ['Annual Contract', 'Quarterly Installment', 'Monthly Installment', 'AMC'],
  };
  const currentSubCategories: string[] = EXPENSE_SUBCATEGORIES[qeCategory as string] || [];

  useEffect(() => {
    const subs = EXPENSE_SUBCATEGORIES[qeCategory] || [];
    setQeSubCategory((prev) => (subs.length > 0 && prev && !subs.includes(prev) ? '' : prev));
  }, [qeCategory]);

  const handleQEBuildingChange = (id: string) => {
    setQeBuildingId(id);
    setQeUnitNumber('');
    setQeCustomerVAT('');
    setQeContractCustomer(null);
    setQeVatAutoFilled(false);
    setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0);
    setQeFeesPaidThisInst(0);
    setQeFeePeriodInstallment(null);
    setQeFeesAllPeriodsPaid(false);
    const nb = buildings.find(x => x.id === id);
    setQeBankName(nb?.bankName || '');
  };

  const handleQePurchaseBuildingChange = (id: string) => {
    setQePurchaseBuildingId(id);
    const nb = buildings.find(x => x.id === id);
    setQeBankName(nb?.bankName || '');
  };

  const handleQEUnitChange = useCallback(async (unit: string) => {
    setQeUnitNumber(unit);
    setQeContractCustomer(null);
    setQeCustomerVAT('');
    setQeVatAutoFilled(false);
    if (!unit || !qeBuildingId) return;
    setQeContractLookupLoading(true);
    try {
      let catalog = (contracts || []).filter((x: any) => !x.deleted);
      if (!catalog.length) {
        catalog = ((await getContracts()) || []).filter((x: any) => !x.deleted);
      }
      // Try active contract first; if not found, fall back to any contract for this unit
      let contract = await getActiveContract(qeBuildingId, unit);
      if (!contract) {
        const unitContracts = catalog.filter((c: any) => c.buildingId === qeBuildingId && c.unitName === unit);
        // Prefer Active status, then most-recently-started
        unitContracts.sort((a: any, b: any) => (a.status === 'Active' ? -1 : b.status === 'Active' ? 1 : 0));
        contract = unitContracts[0] || null;
      }
      if (contract) {
        setQeActiveContract(contract);
        const prevPayments = transactions.filter(t => {
          if (t.status !== 'APPROVED' && t.status) return false;
          if (t.type === TransactionType.EXPENSE) return false;
          return transactionAppliesToContract(t, contract as any, catalog);
        });
        const upfrontPaidAmount = Number((contract as any).upfrontPaid || 0);
        const totalInst = contract.installmentCount || 1;
        const rentValue = Number((contract as any).rentValue || 0);

        const nonResQe = isNonResidentialBuildingForContract(buildings, contract as any);
        const rentPayments = nonResQe ? prevPayments.filter(t => !(t as any).feesEntry) : prevPayments;
        const totalPaidIncl = rentPayments.reduce((sum, t) => sum + (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) + ((t as any).discountAmount || 0), 0);
        const totalPaidEffective = totalPaidIncl + upfrontPaidAmount;

        // IMPORTANT: For non-residential units, VAT Sales/Rent should NOT include non‑VAT fees.
        // So we compute installment progress from rent-only value (VAT), excluding any fees schedule.
        let currentInstallment = 1;
        let currentInstAmt = 0;
        let paidTowardCurrent = 0;
        let rentAutoFill = 0;

        if (nonResQe) {
          const count = Math.max(1, Number(contract.installmentCount) || 1);
          // ContractForm treats VAT-building rentValue as FINAL price (inclusive of VAT),
          // and VAT transactions store amountIncludingVAT / totalWithVat as the money collected.
          const rentTotalIncl = Number((contract as any).rentValue || 0);
          const rentPerInstIncl = count > 0 ? rentTotalIncl / count : 0;
          const firstInstIncl = rentPerInstIncl + upfrontPaidAmount;
          const otherInstIncl = rentPerInstIncl;

          const schedulePaidIncl =
            rentPayments.reduce(
              (sum, t) =>
                sum +
                (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) +
                (Number((t as any).discountAmount) || 0),
              0,
            ) + upfrontPaidAmount;

          let cumulative = 0;
          let found = false;
          for (let i = 1; i <= count; i++) {
            const instIncl = i === 1 ? firstInstIncl : otherInstIncl;
            const prevCum = cumulative;
            cumulative += instIncl;
            if (schedulePaidIncl < cumulative - 0.01) {
              currentInstallment = i;
              currentInstAmt = instIncl;
              paidTowardCurrent = Math.max(0, schedulePaidIncl - prevCum);
              rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);
              found = true;
              break;
            }
          }
          if (!found) {
            currentInstallment = count;
            currentInstAmt = otherInstIncl;
            paidTowardCurrent = currentInstAmt;
            rentAutoFill = 0;
          }

          const effectiveTotalIncl = rentTotalIncl + upfrontPaidAmount;
          const remainingDisplay = Math.max(0, effectiveTotalIncl - totalPaidEffective);
          setQeContractStats({ paid: totalPaidEffective, remaining: remainingDisplay, installmentNo: currentInstallment });
        } else {
          const progress = computeInstallmentProgress({
            contract,
            payments: prevPayments,
            excludeFeesEntry: nonResQe,
          });
          currentInstallment = progress.installmentNo;

          const effectiveTotalIncl = rentValue;
          const remainingDisplay = Math.max(0, effectiveTotalIncl - totalPaidEffective);
          setQeContractStats({ paid: totalPaidEffective, remaining: remainingDisplay, installmentNo: currentInstallment });

          currentInstAmt =
            currentInstallment === 1
              ? progress.firstInstAmt
              : progress.otherInstAmt > 0
                ? progress.otherInstAmt
                : progress.firstInstAmt;
          const prevCumulative =
            currentInstallment === 1 ? 0 : progress.firstInstAmt + (currentInstallment - 2) * progress.otherInstAmt;
          paidTowardCurrent = Math.max(0, progress.schedulePaid - prevCumulative);
          rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);
        }

        let feeCtx: ReturnType<typeof getNonResFeePeriodContext> | null = null;
        if (nonResQe) {
          feeCtx = getNonResFeePeriodContext(contract, prevPayments);
          setQeNonVatFeesPerInst(feeCtx.nonVatPerInst);
          setQeFeesPaidThisInst(feeCtx.feesPaidThisInst);
          setQeFeePeriodInstallment(feeCtx.activeInstallment);
          setQeFeesAllPeriodsPaid(feeCtx.allPeriodsPaid);
        } else {
          setQeNonVatFeesPerInst(0);
          setQeFeesPaidThisInst(0);
          setQeFeePeriodInstallment(null);
          setQeFeesAllPeriodsPaid(false);
        }

        // Auto-fill amount based on current tab type
        if (qeType === 'FEES' && feeCtx) {
          if (feeCtx.feesRemaining > 0.02) setQeAmount(String(Math.round(feeCtx.feesRemaining * 100) / 100));
          else if (feeCtx.allPeriodsPaid) setQeAmount('');
          else if (feeCtx.nonVatPerInst > 0) setQeAmount(String(feeCtx.nonVatPerInst));
          else setQeAmount('');
        } else if (rentAutoFill > 0) {
          setQeAmount(rentAutoFill.toString());
        }

        // Period computation (rent uses rent installment; FEES uses active fee period in details below)
        const { startDate, endDate } = getInstallmentRange(contract, currentInstallment);
        const periodText = `[${fmtDate(dateToLocalStr(startDate))} to ${fmtDate(dateToLocalStr(endDate))}]`;
        const instText = (currentInstallment === 1
          ? (qeType === 'FEES' ? `1st Fees Payment` : `1st Rent Payment`)
          : (qeType === 'FEES' ? `Fees Installment ${currentInstallment} of ${totalInst}` : `Rent Installment ${currentInstallment} of ${totalInst}`));
        const isPartial = paidTowardCurrent > 0.01 && paidTowardCurrent < currentInstAmt - 0.01;
        const contractCust = customers.find(c => c.id === contract.customerId) || customers.find(c => (c.nameEn || c.nameAr) === contract.customerName);
        const contractCustLabel = formatNameWithRoom(contract.customerName, contractCust?.roomNumber);
        if (qeType === 'FEES' && feeCtx) {
          if (feeCtx.allPeriodsPaid) {
            setQeDetails(t('vat.feesAllPeriodsPaidDetail', { customer: contractCustLabel }));
          } else if (feeCtx.activeInstallment != null) {
            const fi = feeCtx.activeInstallment;
            // Use the exact fee window computed by feeCtx to avoid any drift / mismatch.
            const feePeriodText = feeCtx.feeStartStr && feeCtx.feeEndStr
              ? `[${fmtDate(feeCtx.feeStartStr)} to ${fmtDate(feeCtx.feeEndStr)}]`
              : '';
            const feeInstText = fi === 1 ? `1st Fees Payment` : `Fees Installment ${fi} of ${totalInst}`;
            const isFeesPartial = feeCtx.feesPaidThisInst > 0.02 && feeCtx.feesRemaining > 0.02;
            setQeDetails(
              isFeesPartial
                ? `Balance Fees Payment - Installment ${fi}${feePeriodText ? ` - ${feePeriodText}` : ''} - ${contractCustLabel}`
                : `${feeInstText}${feePeriodText ? ` - ${feePeriodText}` : ''} - ${contractCustLabel}`,
            );
          } else {
            setQeDetails(`Non-VAT Fees - ${contractCustLabel}`);
          }
        } else {
          setQeDetails(isPartial
            ? `Balance Payment - Installment ${currentInstallment} - ${periodText} - ${contractCustLabel}`
            : `${instText} - ${periodText} - ${contractCustLabel}`);
        }

        const cust = contractCust;
        if (cust) {
          setQeContractCustomer(cust);
          if (cust.vatNumber) {
            setQeCustomerVAT(cust.vatNumber);
            setQeVatAutoFilled(true);
          }
        }
      }
    } finally {
      setQeContractLookupLoading(false);
    }
  }, [qeBuildingId, customers, transactions, qeType, buildings, contracts, t]);

  const handleQuickEntrySave = async () => {
    const amt = parseFloat(qeAmount);
    const errors: any = {};
    if (qeType === 'SALES') {
      if (!qeCustomerVAT) errors.customerVAT = 'Customer VAT number is required';
      else if (!isValidSaudiVAT(qeCustomerVAT)) errors.customerVAT = 'Invalid Saudi VAT number';
    }
    if (qeType === 'EXPENSE') {
      if (!qeVendorName) errors.vendorName = 'Required';
      if (qeVendorVAT && !isValidSaudiVAT(qeVendorVAT)) errors.vendorVAT = 'Invalid VAT';
    }
    // FEES: no VAT number required, just needs non-residential building/unit and amount
    if (qeType === 'FEES' && qeFeesAllPeriodsPaid) {
      errors.feesComplete = t('vat.feesNoNextPeriodBanner');
    } else if (!amt || amt <= 0) {
      errors.amount = 'Required';
    }
    if (qeType === 'FEES') {
      if (!qeBuildingId || !feesEligibleBuildings.some((b) => b.id === qeBuildingId)) {
        errors.property = 'Select a non-residential property';
      }
      if (!String(qeUnitNumber || '').trim()) errors.unit = 'Select a unit';
    }
    if (qePaymentMethod === PaymentMethod.BANK && !qeBankName?.trim()) errors.bankName = 'Select a bank account';
    if (Object.keys(errors).length > 0) { setQeErrors(errors); return; }

    setQeSaving(true);
    try {
      const uid = auth.currentUser?.uid || 'direct-entry';
      const isVat = qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT);
      let tx: any;

      if (qeType === 'FEES') {
        // Non-VAT fees: save as regular income without any VAT fields
        const feeInvNo = qeFeesGenerateInvoice ? `FEE-${Date.now().toString(36).toUpperCase()}` : undefined;
        tx = {
          id: crypto.randomUUID(),
          type: TransactionType.INCOME,
          date: qeDate,
          amount: Math.round(amt * 100) / 100,
          isVATApplicable: false,
          paymentMethod: qePaymentMethod,
          bankName: qePaymentMethod === PaymentMethod.BANK ? qeBankName : undefined,
          details: qeDetails || `Non-VAT Fees${qeActiveContract ? ` - ${formatNameWithRoom(qeActiveContract.customerName, qeContractCustomer?.roomNumber)} - #${qeActiveContract.contractNo}` : ''}`,
          userId: uid,
          buildingId: qeBuildingId,
          buildingName: buildings.find(b => b.id === qeBuildingId)?.name || '',
          unitNumber: qeUnitNumber || undefined,
          contractId: qeActiveContract?.id || undefined,
          feesEntry: true,
          feeInvoiceNo: feeInvNo,
          status: 'APPROVED',
        };
      } else if (isVat) {
        const amountExcl = amt / 1.15;
        const vatAmt = amt - amountExcl;
        const amountIncl = amt;
        tx = {
          id: crypto.randomUUID(),
          type: qeType === 'SALES' ? TransactionType.INCOME : TransactionType.EXPENSE,
          date: qeDate,
          amount: Math.round(amountExcl * 100) / 100,
          vatAmount: Math.round(vatAmt * 100) / 100,
          amountExcludingVAT: Math.round(amountExcl * 100) / 100,
          amountIncludingVAT: Math.round(amountIncl * 100) / 100,
          totalWithVat: Math.round(amountIncl * 100) / 100,
          vatRate: 15,
          vatInvoiceNumber: qeType === 'SALES'
            ? getNextVatSalesInvoiceNumber(
                transactions.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote && hasZatcaReport(t)),
                qeDate,
              )
            : qeVendorRefNo.trim(),
          isVATApplicable: true,
          paymentMethod: qePaymentMethod,
          bankName: qePaymentMethod === PaymentMethod.BANK ? qeBankName : undefined,
          details: qeDetails,
          userId: uid,
          buildingId: qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId,
          buildingName: buildings.find(b => b.id === (qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId))?.name || '',
          unitNumber: qeType === 'SALES' ? qeUnitNumber : undefined,
          customerName: qeType === 'SALES'
            ? formatNameWithRoom(qeContractCustomer?.nameEn || qeActiveContract?.customerName || '', qeContractCustomer?.roomNumber)
            : undefined,
          customerVATNumber: qeType === 'SALES' ? qeCustomerVAT : undefined,
          vendorName: qeType === 'EXPENSE' ? qeVendorName : undefined,
          vendorVATNumber: qeType === 'EXPENSE' ? qeVendorVAT : undefined,
          vendorId: qeVendorId || undefined,
          vendorRefNo: qeVendorRefNo || undefined,
          expenseCategory: qeType === 'EXPENSE' ? qeCategory : undefined,
          expenseSubCategory: qeSubCategory || undefined,
          contractId: qeType === 'SALES' ? qeActiveContract?.id : undefined,
          vatReportOnly: qeType === 'EXPENSE',
          status: 'APPROVED'
        };
      } else {
        tx = {
          id: crypto.randomUUID(),
          type: TransactionType.INCOME,
          date: qeDate,
          amount: amt,
          isVATApplicable: false,
          paymentMethod: qePaymentMethod,
          bankName: qePaymentMethod === PaymentMethod.BANK ? qeBankName : undefined,
          details: qeDetails,
          userId: uid,
          buildingId: qeBuildingId,
          buildingName: buildings.find(b => b.id === qeBuildingId)?.name || '',
          unitNumber: qeUnitNumber,
          contractId: qeActiveContract?.id || undefined,
          status: 'APPROVED'
        };
      }
      await saveTransaction(tx);
      await loadData();

      // Open fees invoice print window if requested
      if (qeType === 'FEES' && qeFeesGenerateInvoice && (tx as any).feeInvoiceNo) {
        const bldName = buildings.find(b => b.id === qeBuildingId)?.name || '';
        const invNo = (tx as any).feeInvoiceNo;
        const feeLogoSrc = new URL('./images/cologo.png', window.location.href).href;
        const w = window.open('', '_blank');
        if (w) {
          const feeRows = getNonResFeeBreakdownLines(qeActiveContract as any).map(line => ({
            label: t(line.labelKey),
            val: line.val,
            firstInstallmentOnly: line.firstInstallmentOnly,
          }));
          const instCount = qeActiveContract?.installmentCount || 1;
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Fee Invoice ${invNo}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:600px;margin:auto}
            .logo{max-height:60px;margin-bottom:8px}
            h1{font-size:22px;font-weight:900;margin:0}
            .subtitle{font-size:12px;color:#64748b;margin-bottom:24px}
            table{width:100%;border-collapse:collapse;margin-top:16px}
            th{background:#0ea5e9;color:white;padding:10px 12px;text-align:left;font-size:12px}
            td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
            .total-row td{font-weight:900;background:#f0f9ff;border-top:2px solid #0ea5e9}
            .badge{display:inline-block;background:#dcfce7;color:#166534;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
            .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:13px}
            .info-item label{color:#94a3b8;font-size:11px;font-weight:700;display:block;text-transform:uppercase}
            .toolbar{margin-bottom:24px;display:flex;gap:12px}
            .btn{padding:8px 20px;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px}
            .btn-print{background:#0ea5e9;color:white}
            .btn-close{background:#e2e8f0;color:#475569}
            @media print{.toolbar{display:none}}
          </style></head><body>
          <div class="toolbar">
            <button class="btn btn-print" onclick="window.print()">🖨 Print / Save PDF</button>
            <button class="btn btn-close" onclick="window.close()">Close</button>
          </div>
          <img src="${feeLogoSrc}" class="logo" alt=""/>
          <h1>Fee Invoice</h1>
          <div class="subtitle">Non-VAT Service Fees — No VAT Charged</div>
          <div class="info">
            <div class="info-item"><label>Invoice No.</label>${invNo}</div>
            <div class="info-item"><label>Date</label>${qeDate}</div>
            <div class="info-item"><label>Property</label>${bldName}</div>
            <div class="info-item"><label>Unit</label>${qeUnitNumber || '—'}</div>
            <div class="info-item"><label>Tenant</label>${formatNameWithRoom(qeActiveContract?.customerName || '', qeContractCustomer?.roomNumber) || '—'}</div>
            <div class="info-item"><label>Contract</label>#${qeActiveContract?.contractNo || '—'}</div>
            <div class="info-item"><label>Payment Method</label>${qePaymentMethod}</div>
            <div class="info-item"><label>Status</label><span class="badge">Paid</span></div>
          </div>
          <table>
            <thead><tr><th>Description</th><th>Annual Total</th><th>Per Installment</th></tr></thead>
            <tbody>
              ${feeRows.map(f => {
                const perInst = (f as any).firstInstallmentOnly
                  ? (qeFeePeriodInstallment === 1 ? f.val : 0)
                  : Math.round(f.val / instCount);
                return `<tr><td>${f.label}</td><td>${formatAmount(f.val)} SAR</td><td>${formatAmount(perInst)} SAR</td></tr>`;
              }).join('')}
              <tr class="total-row"><td>Total</td><td></td><td>${formatAmount(tx.amount)} SAR</td></tr>
            </tbody>
          </table>
          <p style="margin-top:32px;font-size:11px;color:#94a3b8;text-align:center">This invoice does not include VAT. Fees are charged as-is per lease agreement.</p>
          </body></html>`);
          w.document.close();
          w.focus();
        }
      }

      setShowQE(false);
      resetQE();
    } finally {
      setQeSaving(false);
    }
  };

  const resetQE = () => {
    setQeAmount(''); setQeDetails(''); setQeCustomerVAT(''); qeVatAutoFilled && setQeCustomerVAT('');
    setQeVendorName(''); setQeVendorVAT(''); setQeVendorId(''); setQeVendorAutoFilled(false); setQeVendorRefNo('');
    setQePurchaseBuildingId(''); setQeCategory(ExpenseCategory.VENDOR_PAYMENT); setQeSubCategory(''); setQeNewExpenseCategoryInput(''); setQeUnitNumber(''); setQeBuildingId('');
    setQeContractCustomer(null); setQeVatAutoFilled(false); setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0); setQeFeesPaidThisInst(0); setQeFeePeriodInstallment(null); setQeFeesAllPeriodsPaid(false); setQeFeesGenerateInvoice(false);
    setQeBankName('');
  };

  const handleSendToZatca = async (t: Transaction) => {
    if (t.type === TransactionType.EXPENSE && !t.isCreditNote) return;
    setZatcaSending(prev => ({ ...prev, [t.id]: true }));
    try {
      const payload = {
        invoiceNumber: t.vatInvoiceNumber,
        issueDate: t.date,
        buyerName: t.type === TransactionType.INCOME ? resolveSalesCustomerName(t) : companyNameEn,
        buyerVAT: t.type === TransactionType.INCOME ? (t.customerVATNumber || '') : companyVAT,
        amount: t.amountExcludingVAT ?? t.amount ?? 0,
        vatRate: t.vatRate ?? 15,
        description: t.details || 'Services',
        isCreditNote: !!t.isCreditNote,
        originalInvoiceId: t.originalInvoiceId,
      };
      const res = await fetch(`${ZATCA_SERVICE_URL}/zatca/sign-and-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ZATCA service error');
      const updated: Transaction = {
        ...t,
        customerName: t.type === TransactionType.INCOME ? resolveSalesCustomerName(t) : t.customerName,
        zatcaQRCode: data.qrCode,
        zatcaReportedAt: new Date().toISOString(),
        vatReportSnapshot: (t as any).vatReportSnapshot || createVatReportSnapshot(t, {
          customerName: t.type === TransactionType.INCOME ? resolveSalesCustomerName(t) : undefined,
        }),
      };
      await saveTransaction(updated);
      setTransactions(prev => prev.map(tx => tx.id === t.id ? updated : tx));
      const ok = data.zatcaStatus >= 200 && data.zatcaStatus < 300;
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok, msg: ok ? 'Reported Phase 2' : 'HTTP ' + data.zatcaStatus } }));
      setInvoiceModal(updated);
    } catch (err: any) {
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok: false, msg: err.message } }));
    } finally {
      setZatcaSending(prev => ({ ...prev, [t.id]: false }));
    }
  };

  const isReportedToZatca = hasZatcaReport;

  const vatReportTransactions = useMemo(() => {
    return transactions.map(tx => (isReportedToZatca(tx) ? applyVatReportSnapshot(tx) : tx));
  }, [transactions]);

  // Backfill snapshot for already-reported rows so future edits won't alter VAT report values.
  useEffect(() => {
    const missingSnapshot = transactions.filter(tx => isReportedToZatca(tx) && !(tx as any).vatReportSnapshot);
    if (missingSnapshot.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Transaction[] = [];
      // Cap + sequential: avoid freezing the tab / flooding Mac API on first open.
      for (const tx of missingSnapshot.slice(0, 40)) {
        if (cancelled) return;
        const customerName = tx.type === TransactionType.INCOME ? resolveSalesCustomerName(tx) : undefined;
        const next = {
          ...tx,
          customerName: tx.type === TransactionType.INCOME ? (customerName || tx.customerName) : tx.customerName,
          vatReportSnapshot: createVatReportSnapshot(tx, { customerName }),
        } as Transaction;
        try {
          await saveTransaction(next, { skipAmlakSheetSync: true });
          updates.push(next);
        } catch {
          // non-fatal
        }
      }
      if (cancelled || updates.length === 0) return;
      setTransactions(prev => prev.map(tx => updates.find(u => u.id === tx.id) || tx));
    })();
    return () => { cancelled = true; };
  }, [transactions, resolveSalesCustomerName]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const txMap = Object.fromEntries(transactions.map(t => [t.id, t]));
    await Promise.all([...selectedIds].map(async (id) => {
      const tx = txMap[id];
      // Only create Credit Note if it was actually reported to ZATCA
      if (tx && isReportedToZatca(tx) && !(tx as any).isCreditNote && tx.type === TransactionType.INCOME) {
        const cnPayload = await createCreditNote(tx);
        // Attempt to report CN logic here if needed
      } else {
        await deleteTransaction(id);
      }
    }));
    setSelectedIds(new Set());
    await loadData();
    setBulkDeleting(false);
  };

  const handleCompareDelete = async (tx: Transaction) => {
    // Only CN if reported
    const isReported = isReportedToZatca(tx) && !(tx as any).isCreditNote && tx.type === TransactionType.INCOME;
    if (!window.confirm(
      isReported
        ? 'This invoice was reported to ZATCA. Delete will create and report a Credit Note. Proceed?'
        : 'This invoice is not reported to ZATCA yet. It will be deleted directly (no Credit Note). Proceed?'
    )) return;
    
    if (isReported) {
      await createCreditNote(tx);
    } else {
      await deleteTransaction(tx.id);
    }
    await loadData();
  };

  const handleUpdatePaymentMethod = async (id: string, method: PaymentMethod) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const next: Transaction = {
      ...t,
      paymentMethod: method,
      bankName: method === PaymentMethod.BANK ? t.bankName : undefined,
    } as Transaction;
    await saveTransaction(next);
    setTransactions(prev => prev.map(x => (x.id === id ? next : x)));
  };

  const handleUpdateBankName = async (id: string, bankName: string) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const next: Transaction = { ...t, bankName: bankName || undefined } as Transaction;
    await saveTransaction(next);
    setTransactions(prev => prev.map(x => (x.id === id ? next : x)));
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredVATTransactions.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredVATTransactions.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    let filtered = vatReportTransactions.filter(t => t.isVATApplicable === true);
    if (reportView === 'SALES') {
      // Sales VAT report should list only actual VAT sales invoices (ZATCA-tagged / reported),
      // not every income record that happens to have VAT toggled.
      filtered = filtered.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote && isReportedToZatca(t));
    }
    else if (reportView === 'PURCHASE') filtered = filtered.filter(t => t.type === TransactionType.EXPENSE && !t.isCreditNote);
    else if (reportView === 'CREDIT_NOTE') filtered = filtered.filter(t => !!t.isCreditNote);
    if (filterFromDate) filtered = filtered.filter(t => t.date >= filterFromDate);
    if (filterToDate) filtered = filtered.filter(t => t.date <= filterToDate);
    
    // New Search & Building Filters
    if (filterBuildingId) filtered = filtered.filter(t => t.buildingId === filterBuildingId);
    if (filterUnit) filtered = filtered.filter(t => t.unitNumber === filterUnit);
    if (searchTerm.trim()) {
      filtered = filtered.filter((t) => {
        const h = `${buildTransactionSearchHaystack(t)} ${resolveSalesCustomerName(t) || ''}`;
        return matchesAdvancedSearch(searchTerm, h);
      });
    }
    
    setFilteredVATTransactions([...filtered].sort(compareVatSequence));
  }, [vatReportTransactions, filterFromDate, filterToDate, reportView, searchTerm, filterBuildingId, filterUnit, resolveSalesCustomerName]);

  const allFilteredSelected = filteredVATTransactions.length > 0 && filteredVATTransactions.every(t => selectedIds.has(t.id));

  const salesTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote);
  const purchaseTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.EXPENSE && !t.isCreditNote);
  const creditNoteTransactions = filteredVATTransactions.filter(t => !!t.isCreditNote);
  const salesVAT = salesTransactions.reduce((sum, t) => sum + Math.abs(t.vatAmount || 0), 0);
  const purchaseVAT = purchaseTransactions.reduce((sum, t) => sum + Math.abs(t.vatAmount || 0), 0);
  const creditNoteVAT = creditNoteTransactions.reduce((sum, t) => sum + Math.abs(t.vatAmount || 0), 0);
  const netVATPayable = filteredVATTransactions.reduce((sum, tx) => {
    const vat = Math.abs(tx.vatAmount || 0);
    if (tx.type === TransactionType.INCOME) {
      return sum + (tx.isCreditNote ? -vat : vat);
    }
    return sum + (tx.isCreditNote ? vat : -vat);
  }, 0);

  const totalVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const totalExcludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountExcludingVAT || t.amount || 0), 0);
  const totalIncludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountIncludingVAT || t.totalWithVat || t.amount || 0), 0);
  const totalDebit = filteredVATTransactions.reduce((sum, tx) => {
    const amount = Math.abs(tx.vatAmount || 0);
    if (tx.type === TransactionType.INCOME) return sum + (tx.isCreditNote ? amount : 0);
    return sum + (tx.isCreditNote ? 0 : amount);
  }, 0);
  const totalCredit = filteredVATTransactions.reduce((sum, tx) => {
    const amount = Math.abs(tx.vatAmount || 0);
    if (tx.type === TransactionType.INCOME) return sum + (tx.isCreditNote ? 0 : amount);
    return sum + (tx.isCreditNote ? amount : 0);
  }, 0);
  const reportLabel =
    reportView === 'SALES'
      ? t('vat.salesReport')
      : reportView === 'PURCHASE'
        ? t('vat.purchaseReport')
        : reportView === 'CREDIT_NOTE'
          ? 'Credit Note Report'
          : t('vat.combinedReport');

  const matchesCompareSearch = useCallback((tx: Transaction, term: string) => {
    if (!term.trim()) return true;
    const h = `${buildTransactionSearchHaystack(tx)} ${resolveSalesCustomerName(tx) || ''}`;
    return matchesAdvancedSearch(term, h);
  }, [resolveSalesCustomerName]);

  const importedExpenses = transactions.filter(t =>
    (t as any).vatReportOnly &&
    t.type === TransactionType.EXPENSE &&
    matchesCompareSearch(t, compareSearchTerm)
  );
  const historyExpenses = transactions.filter(t =>
    !(t as any).vatReportOnly &&
    t.type === TransactionType.EXPENSE &&
    (!compareDateFrom || t.date >= compareDateFrom) &&
    (!compareDateTo || t.date <= compareDateTo) &&
    matchesCompareSearch(t, compareSearchTerm)
  );
  
  const inclAmt = (t: Transaction) => Math.round((t.totalWithVat || t.amountIncludingVAT || t.amount || 0) * 100) / 100;
  const historyInclSet = new Set(historyExpenses.map(inclAmt));
  const matchedCount = importedExpenses.filter(t => historyInclSet.has(inclAmt(t))).length;
  const duplicateImportedGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    importedExpenses.forEach((tx) => {
      const billNo = String((tx as any).vendorRefNo || tx.vatInvoiceNumber || '').trim();
      const key = billNo
        ? `bill:${billNo}`
        : `shape:${(tx.vendorName || '').trim().toLowerCase()}|${inclAmt(tx)}|${tx.date || ''}`;
      const list = groups.get(key) || [];
      list.push(tx);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({
        key,
        label: key.startsWith('bill:') ? key.replace('bill:', '') : `${list[0].vendorName || 'Unknown'} · ${formatAmount(inclAmt(list[0]))} · ${fmtDate(list[0].date)}`,
        items: list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || ((a.createdAt || 0) - (b.createdAt || 0))),
      }));
  }, [importedExpenses]);

  const handleCreateReversal = async () => {
    if (!reversalTarget) return;
    setReversalSaving(true);
    try { 
      await createCreditNote(reversalTarget);
      await loadData();
      setReversalTarget(null);
    } finally { setReversalSaving(false); }
  };

  const handleExportExcel = () => {
    if (filteredVATTransactions.length === 0) {
      window.alert(t('vat.noTransactions'));
      return;
    }

    const rows = filteredVATTransactions.map((tx, index) => ({
      ...(function () {
        const amount = tx.vatAmount || 0;
        if (tx.type === TransactionType.INCOME) {
          return {
            Debit: Number((tx.isCreditNote ? amount : 0).toFixed(2)),
            Credit: Number((tx.isCreditNote ? 0 : amount).toFixed(2)),
          };
        }
        return {
          Debit: Number((tx.isCreditNote ? 0 : amount).toFixed(2)),
          Credit: Number((tx.isCreditNote ? amount : 0).toFixed(2)),
        };
      })(),
      '#': index + 1,
      Date: tx.date,
      Type: tx.isCreditNote ? 'Credit Note' : tx.type === TransactionType.INCOME ? 'Sale' : 'Purchase',
      'Invoice #': tx.vatInvoiceNumber || '',
      Party: tx.type === TransactionType.INCOME ? resolveSalesCustomerName(tx) : (tx.vendorName || ''),
      'VAT #': tx.type === TransactionType.INCOME ? (tx.customerVATNumber || '') : (tx.vendorVATNumber || ''),
      'Payment Method': tx.paymentMethod || '',
      Building: tx.buildingName || '',
      Details: tx.details || '',
      'ZATCA Status': tx.zatcaQRCode ? 'Reported' : 'Pending',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
      { wch: 30 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VAT Report');
    const dateStamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `vat_report_${dateStamp}.xlsx`);
  };

  const handlePreviewPdf = () => {
    if (filteredVATTransactions.length === 0) {
      window.alert(t('vat.noTransactions'));
      return;
    }

    const w = window.open('', 'VAT_REPORT_PREVIEW', 'height=900,width=1200');
    if (!w) return;
    const pdfLogoSrc = new URL('./images/cologo.png', window.location.href).href;

    const fromLabel = filterFromDate || '-';
    const toLabel = filterToDate || '-';
    const generatedAt = fmtDate(new Date());
    const isSales = reportView === 'SALES';
    const isPurchase = reportView === 'PURCHASE';
    const isCreditNote = reportView === 'CREDIT_NOTE';
    const sectionTitle = isSales
      ? 'تقرير المبيعات / Sales VAT Report'
      : isPurchase
        ? 'تقرير المشتريات / Purchase VAT Report'
        : isCreditNote
          ? 'تقرير الإشعارات الدائنة / Credit Note Report'
          : 'VAT Report';
    const partyTitle = isPurchase ? 'اسم المورد / Vendor Name' : 'اسم العميل / Customer Name';
    const totalTaxable = filteredVATTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amountExcludingVAT ?? tx.amount ?? 0)), 0);
    const totalVat = filteredVATTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.vatAmount || 0)), 0);
    const totalValue = filteredVATTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amountIncludingVAT ?? tx.totalWithVat ?? tx.amount ?? 0)), 0);

    if (reportView === 'COMBINED') {
      const combinedRowsHtml = filteredVATTransactions.map((tx, idx) => {
        const amount = Math.abs(Number(tx.vatAmount || 0));
        const debit = tx.type === TransactionType.INCOME ? (tx.isCreditNote ? amount : 0) : (tx.isCreditNote ? 0 : amount);
        const credit = tx.type === TransactionType.INCOME ? (tx.isCreditNote ? 0 : amount) : (tx.isCreditNote ? amount : 0);
        const statement = tx.type === TransactionType.INCOME
          ? resolveSalesCustomerName(tx)
          : (tx.vendorName || tx.details || '-');
        const voucherType = tx.isCreditNote
          ? 'VAT Credit Note'
          : tx.type === TransactionType.EXPENSE
            ? 'VAT Expenses'
            : 'VAT Sales';
        return `
          <tr>
            <td class="tc">${escapeHtml(tx.vatInvoiceNumber || String(idx + 1))}</td>
            <td class="tc">${escapeHtml(voucherType)}</td>
            <td class="tc date-cell">${escapeHtml(fmtDate(tx.date))}</td>
            <td>${escapeHtml(statement)}</td>
            <td class="tr">${formatAmount(debit)}</td>
            <td class="tr">${formatAmount(credit)}</td>
          </tr>
        `;
      }).join('');

      const debitTotal = totalDebit;
      const creditTotal = totalCredit;
      const netBalance = creditTotal - debitTotal;
      const hijriFrom = '-';
      const hijriTo = '-';

      const combinedHtml = `<!doctype html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>Combined VAT Report</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Tajawal', Arial, sans-serif; color: #0f172a; background: #f1f5f9; direction: rtl; }
              .page { max-width: 920px; margin: 0 auto; padding: 12px; }
              .toolbar { display: flex; justify-content: flex-start; gap: 8px; margin-bottom: 8px; direction: ltr; }
              .btn { border: 1px solid #cbd5e1; border-radius: 9px; padding: 6px 11px; font-size: 11px; font-weight: 700; cursor: pointer; background: #fff; color: #334155; }
              .btn.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
              .sheet { background: #fff; border: 1px solid #64748b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08); }
              .header { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #94a3b8; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
              .logo { width: 68px; height: 68px; object-fit: contain; }
              .co { text-align: center; line-height: 1.35; }
              .co .ar { font-size: 20px; font-weight: 800; }
              .co .en { font-size: 16px; font-weight: 800; letter-spacing: 0.2px; }
              .co .meta { font-size: 11px; font-weight: 700; color: #334155; margin-top: 2px; }
              .titleRow { display: grid; grid-template-columns: auto auto auto auto auto; gap: 6px; padding: 7px 10px; border-bottom: 1px solid #94a3b8; font-size: 13px; font-weight: 800; align-items: center; justify-content: center; background: #f8fafc; }
              .titleRow .box { border: 1px solid #94a3b8; min-width: 90px; padding: 1px 6px; text-align: center; font-size: 13px; border-radius: 5px; background: #fff; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
              th, td { border: 1px solid #94a3b8; padding: 4px 6px; }
              thead th { background: #e2e8f0; font-weight: 800; text-align: center; color: #0f172a; }
              .tr { text-align: right; }
              .tc { text-align: center; }
              .date-cell { white-space: nowrap; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
              .range-date { min-width: 120px !important; white-space: nowrap; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
              thead th:nth-child(1) { width: 18%; }
              thead th:nth-child(2) { width: 17%; }
              thead th:nth-child(3) { width: 14%; }
              thead th:nth-child(4) { width: 31%; }
              thead th:nth-child(5) { width: 10%; }
              thead th:nth-child(6) { width: 10%; }
              .totals-row td { font-weight: 800; background: #f8fafc; }
              .balance td { background: #eef2ff; font-weight: 800; }
              .footerNote { padding: 7px 10px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; }
              @media print {
                body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .page { padding: 0; }
                .toolbar { display: none; }
                @page { margin: 8mm; size: A4 portrait; }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="toolbar">
                <button class="btn primary" onclick="window.print()">Print / Save PDF</button>
                <button class="btn" onclick="window.close()">Close</button>
              </div>
              <div class="sheet">
                <div class="header">
                  <div class="co">
                    <div class="ar">${escapeHtml(companyName)}</div>
                    <div class="en">${escapeHtml(companyNameEn)}</div>
                    <div class="meta">${escapeHtml(companyVAT)} - ${escapeHtml('rrmillenniumrealestate@gmail.com')}</div>
                  </div>
                  <img class="logo" src="${pdfLogoSrc}" alt="Logo" />
                </div>
                <div class="titleRow">
                  <span>حساب ضريبة القيمة المضافة للفترة من :</span>
                  <span class="box range-date">${escapeHtml(fromLabel)}</span>
                  <span>إلى :</span>
                  <span class="box range-date">${escapeHtml(toLabel)}</span>
                  <span style="font-size:10px;font-weight:700;">ميلادي</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>رقم السند</th>
                      <th>نوع السند</th>
                      <th>التاريخ</th>
                      <th>البيان</th>
                      <th>مدين</th>
                      <th>دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${combinedRowsHtml}
                    <tr class="totals-row">
                      <td colspan="4" class="tc">الإجمالي</td>
                      <td class="tr">${formatAmount(debitTotal)}</td>
                      <td class="tr">${formatAmount(creditTotal)}</td>
                    </tr>
                    <tr class="balance">
                      <td colspan="4" class="tc">صافي الرصيد</td>
                      <td colspan="2" class="tc">${formatAmount(netBalance)}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="footerNote">
                  <span>Combined VAT Report</span>
                  <span>Generated: ${escapeHtml(generatedAt)}</span>
                </div>
              </div>
            </div>
          </body>
        </html>`;

      w.document.open();
      w.document.write(combinedHtml);
      w.document.close();
      w.focus();
      return;
    }

    const rowsHtml = filteredVATTransactions.map((tx, idx) => {
      const party = tx.type === TransactionType.INCOME ? resolveSalesCustomerName(tx) : (tx.vendorName || '-');
      const taxable = Math.abs(Number(tx.amountExcludingVAT ?? tx.amount ?? 0));
      const vat = Math.abs(Number(tx.vatAmount || 0));
      const total = Math.abs(Number(tx.amountIncludingVAT ?? tx.totalWithVat ?? tx.amount ?? 0));
      if (isCreditNote) {
        return `
      <tr>
        <td class="tc">${idx + 1}</td>
        <td>${escapeHtml(tx.vatInvoiceNumber || '-')}</td>
        <td>${escapeHtml((tx as any).originalInvoiceId || '-')}</td>
        <td>${escapeHtml(party)}</td>
        <td class="tc">${escapeHtml(fmtDate(tx.date))}</td>
        <td class="tr">${formatAmount(taxable)}</td>
        <td class="tr">${formatAmount(vat)}</td>
        <td class="tr">${formatAmount(total)}</td>
      </tr>
        `;
      }
      return `
      <tr>
        <td class="tc">${idx + 1}</td>
        <td>${escapeHtml(tx.vatInvoiceNumber || '-')}</td>
        <td>${escapeHtml(party)}</td>
        <td class="tc">${escapeHtml(fmtDate(tx.date))}</td>
        <td class="tc">${escapeHtml(tx.paymentMethod || 'Cash')}</td>
        <td class="tr">${formatAmount(taxable)}</td>
        <td class="tr">${formatAmount(vat)}</td>
        <td class="tr">${formatAmount(total)}</td>
      </tr>
      `;
    }).join('');

    const tableHeader = isCreditNote
      ? `
        <th class="tc">#</th>
        <th>رقم الإشعار الدائن</th>
        <th>رقم الفاتورة الأصلية</th>
        <th>${partyTitle}</th>
        <th class="tc">التاريخ</th>
        <th class="tr">التعديل قبل الضريبة</th>
        <th class="tr">تعديل الضريبة</th>
        <th class="tr">صافي التعديل</th>
      `
      : `
        <th class="tc">#</th>
        <th>رقم الفاتورة</th>
        <th>${partyTitle}</th>
        <th class="tc">تاريخ الفاتورة</th>
        <th class="tc">طريقة الدفع</th>
        <th class="tr">المبلغ قبل الضريبة</th>
        <th class="tr">قيمة الضريبة</th>
        <th class="tr">الإجمالي</th>
      `;

    const html = `<!doctype html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(sectionTitle)}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Tajawal', Arial, sans-serif; color: #0f172a; background: #f1f5f9; direction: rtl; }
            .page { max-width: 900px; margin: 0 auto; padding: 12px; }
            .toolbar { display: flex; justify-content: flex-start; gap: 8px; margin-bottom: 8px; direction: ltr; }
            .btn { border: 1px solid #cbd5e1; border-radius: 9px; padding: 7px 12px; font-size: 11px; font-weight: 700; cursor: pointer; background: white; color: #334155; }
            .btn.primary { background: #0f766e; border-color: #0f766e; color: white; }
            .card { border: 1px solid #94a3b8; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08); }
            .head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid #94a3b8; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
            .head img { width: 58px; height: 58px; object-fit: contain; }
            .company { text-align: center; line-height: 1.35; }
            .company .ar { font-size: 16px; font-weight: 800; }
            .company .en { font-size: 13px; font-weight: 800; }
            .meta { text-align: left; font-size: 10px; line-height: 1.5; color: #475569; }
            .meta strong { color: #334155; }
            .report-title { text-align: center; font-size: 14px; font-weight: 800; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; background: #f8fafc; }
            .report-info { display: flex; justify-content: space-between; gap: 10px; font-size: 10px; padding: 7px 10px; border-bottom: 1px solid #cbd5e1; color: #475569; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #94a3b8; padding: 4px 6px; }
            thead th { background: #e2e8f0; font-size: 10px; font-weight: 800; }
            .tc { text-align: center; }
            .tr { text-align: right; }
            tfoot td { background: #f1f5f9; font-weight: 800; }
            .totals { padding: 7px 10px; border-top: 1px solid #cbd5e1; font-size: 10px; display: flex; justify-content: space-between; gap: 10px; color: #334155; }
            .totals div { font-weight: 700; }
            @media print {
              body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { padding: 0; }
              .toolbar { display: none; }
              @page { margin: 8mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="toolbar">
              <button class="btn primary" onclick="window.print()">Print / Save PDF</button>
              <button class="btn" onclick="window.close()">Close</button>
            </div>
            <div class="card">
              <div class="head">
                <img src="${pdfLogoSrc}" alt="Logo" />
                <div class="company">
                  <div class="ar">${escapeHtml(companyName)}</div>
                  <div class="en">${escapeHtml(companyNameEn)}</div>
                  <div>Email: rrmillenniumrealestate@gmail.com &nbsp;&nbsp; VAT: ${escapeHtml(companyVAT)}</div>
                </div>
                <div class="meta">
                  <div><strong>أُنشئ في:</strong> ${escapeHtml(generatedAt)}</div>
                  <div><strong>الفترة:</strong> ${escapeHtml(fromLabel)} إلى ${escapeHtml(toLabel)}</div>
                  <div><strong>العدد:</strong> ${filteredVATTransactions.length}</div>
                </div>
              </div>
              <div class="report-title">${escapeHtml(sectionTitle)}</div>
              <div class="report-info">
                <div><strong>التقرير:</strong> ${escapeHtml(reportLabel)}</div>
                <div><strong>العملة:</strong> SAR</div>
              </div>
              <table>
                <thead>
                  <tr>${tableHeader}</tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" class="tr">الإجمالي</td>
                    <td class="tr">${formatAmount(totalTaxable)}</td>
                    <td class="tr">${formatAmount(totalVat)}</td>
                    <td class="tr">${formatAmount(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
              <div class="totals">
                <div>قبل الضريبة: ${formatAmount(totalTaxable)} SAR</div>
                <div>الضريبة: ${formatAmount(totalVat)} SAR</div>
                <div>الإجمالي: ${formatAmount(totalValue)} SAR</div>
              </div>
            </div>
          </div>
        </body>
      </html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleBulkInvoicePrint = (scope: 'SALES' | 'PURCHASE' | 'ALL') => {
    let rows = vatReportTransactions.filter(t => t.isVATApplicable === true);
    if (filterFromDate) rows = rows.filter(t => t.date >= filterFromDate);
    if (filterToDate) rows = rows.filter(t => t.date <= filterToDate);
    if (filterBuildingId) rows = rows.filter(t => t.buildingId === filterBuildingId);
    if (filterUnit) rows = rows.filter(t => t.unitNumber === filterUnit);
    if (searchTerm.trim()) {
      rows = rows.filter((t) => {
        const h = `${buildTransactionSearchHaystack(t)} ${resolveSalesCustomerName(t) || ''}`;
        return matchesAdvancedSearch(searchTerm, h);
      });
    }

    if (scope === 'SALES') rows = rows.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote);
    else if (scope === 'PURCHASE') rows = rows.filter(t => t.type === TransactionType.EXPENSE && !t.isCreditNote);
    else rows = rows.filter(t => !t.isCreditNote);

    rows = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.vatInvoiceNumber || '').localeCompare(b.vatInvoiceNumber || ''));

    if (rows.length === 0) {
      window.alert('No invoices found for bulk print with current filters.');
      return;
    }

    const w = window.open('', 'VAT_BULK_INVOICE_PRINT', 'height=900,width=1200');
    if (!w) return;
    const logoSrc = new URL('./images/cologo.png', window.location.href).href;
    const amlakLogoSrc = new URL('./images/logo-192.png', window.location.href).href;
    const scopeLabel = scope === 'SALES' ? 'Sales Invoices' : scope === 'PURCHASE' ? 'Purchase Invoices' : 'All Invoices';

    const pagesHtml = rows.map((tx, idx) => {
      const isExpense = tx.type === TransactionType.EXPENSE;
      const isCredit = !!tx.isCreditNote;
      const taxable = Math.abs(Number(tx.amountExcludingVAT ?? tx.amount ?? 0));
      const vat = Math.abs(Number(tx.vatAmount || 0));
      const total = Math.abs(Number(tx.amountIncludingVAT ?? tx.totalWithVat ?? tx.amount ?? 0));
      const invNo = tx.vatInvoiceNumber || `INV-${idx + 1}`;
      const sellerName = isExpense ? ((tx as any).vendorName || 'Supplier') : companyNameEn;
      const sellerNameAr = isExpense ? '' : companyName;
      const sellerVAT = isExpense ? ((tx as any).vendorVATNumber || '-') : companyVAT;
      const sellerAddr = isExpense ? '-' : companyAddress;
      const buyerName = isExpense ? companyNameEn : (resolveSalesCustomerName(tx) || tx.unitNumber || 'Tenant');
      const buyerVAT = isExpense ? companyVAT : (tx.customerVATNumber || '-');
      const buyerAddr = isExpense ? companyAddress : '-';
      const qrPayload = tx.zatcaQRCode || `INV:${invNo}|DATE:${tx.date || ''}|TOTAL:${total}|VAT:${vat}|VATNO:${companyVAT}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&data=${encodeURIComponent(qrPayload)}`;

      return `
        <section class="invoice-page">
          <div class="cb cb-tl"></div><div class="cb cb-tr"></div><div class="cb cb-bl"></div><div class="cb cb-br"></div>
          <div class="hdr">
            <div class="hdr-co">
              <div class="hdr-logo"><img src="${logoSrc}" alt="Logo"/></div>
              <div>
                <div class="co-ar">${escapeHtml(sellerNameAr || companyName)}</div>
                <div class="co-en">${escapeHtml(companyNameEn)}</div>
                <div class="co-tag">${escapeHtml(companyAddress)}${companyVAT ? ` &nbsp;|&nbsp; VAT ${escapeHtml(companyVAT)}` : ''}</div>
              </div>
            </div>
            <div class="badge-wrap">
              <div class="am-badge">
                <img src="${amlakLogoSrc}" alt="AMLAK Property Manager"/>
                <div class="am-meta">
                  <div class="am-title">AMLAK Property Manager</div>
                  <div class="am-powered">Powered by AMLAK</div>
                </div>
              </div>
              <div class="badge">
              <div class="badge-type">${isCredit ? 'Credit Note' : isExpense ? 'Purchase Invoice' : 'Tax Invoice'}</div>
              <div class="badge-cn">ZATCA Compliant</div>
            </div>
            </div>
          </div>

          <div class="pills">
            <div class="pill green"><div class="pill-lbl">Invoice No.</div><div class="pill-val">${escapeHtml(invNo)}</div></div>
            <div class="pill"><div class="pill-lbl">Issue Date</div><div class="pill-val">${escapeHtml(fmtDate(tx.date))}</div></div>
            <div class="pill"><div class="pill-lbl">Payment</div><div class="pill-val">${escapeHtml(tx.paymentMethod || '-')}</div></div>
          </div>

          <div class="party-grid">
            <div class="party-card">
              <div class="party-title">Supplier / Seller</div>
              ${sellerNameAr ? `<div class="party-ar">${escapeHtml(sellerNameAr)}</div>` : ''}
              <div class="party-name">${escapeHtml(sellerName)}</div>
              <div class="party-sub">VAT: ${escapeHtml(sellerVAT)}</div>
              <div class="party-sub">${escapeHtml(sellerAddr)}</div>
            </div>
            <div class="party-card">
              <div class="party-title">Customer / Buyer</div>
              <div class="party-name">${escapeHtml(buyerName)}</div>
              <div class="party-sub">VAT: ${escapeHtml(buyerVAT)}</div>
              <div class="party-sub">${escapeHtml(buyerAddr)}</div>
            </div>
          </div>

          <table class="tbl">
            <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="tbl-num">01</span></td>
                <td>
                  <div style="font-weight:600">${escapeHtml(tx.details || (isExpense ? 'Purchase / Expense' : 'Property Rental Services'))}</div>
                  <div class="tbl-sub">${isExpense ? 'Expense' : 'Rental Income'}</div>
                </td>
                <td>${formatAmount(taxable)} SAR</td>
              </tr>
            </tbody>
          </table>

          <div class="tots">
            <div class="tot-card">
              <div class="tot-row"><span>Subtotal (Excl. VAT)</span><span>${formatAmount(taxable)}</span></div>
              <div class="tot-row"><span>VAT (${tx.vatRate || 15}%)</span><span>${formatAmount(vat)}</span></div>
              <div class="tot-total"><span>Total (Incl. VAT)</span><span>${formatAmount(total)} <span class="tot-sar">SAR</span></span></div>
            </div>
          </div>

          <div class="ftr">
            <div class="ftr-notes">
              <div><b>Payment:</b> ${escapeHtml(tx.paymentMethod || 'Cash')}</div>
              <div style="margin-top:6px">Computer-generated document. No signature required.</div>
            </div>
            <div class="qr-box">
              <img src="${qrSrc}" class="qr-img" alt="ZATCA QR Code"/>
              <div class="qr-lbl">ZATCA QR Code</div>
            </div>
          </div>
          <div class="brand-strip">
            <div>
              <div class="brand-mark">Powered by AMLAK Property Manager</div>
              <div class="brand-sub">Professional property management software</div>
            </div>
            <div class="brand-copy">© ${new Date().getFullYear()} AMLAK Software. All rights reserved.</div>
          </div>
        </section>
      `;
    }).join('');

    const html = `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Bulk Invoice Print - ${scopeLabel}</title>
          <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Inter',Arial,sans-serif;background:#f8fafc;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .wrap{max-width:210mm;margin:0 auto;padding:6mm}
            .toolbar{display:flex;gap:8px;margin-bottom:8px}
            .btn{border:1px solid #0f766e;border-radius:10px;padding:6px 11px;font-size:11px;font-weight:800;cursor:pointer;background:#ffffff;color:#0f766e;box-shadow:0 4px 10px rgba(15,118,110,.10)}
            .btn.primary{background:linear-gradient(135deg,#0f766e 0%,#059669 100%);color:#fff;border-color:#0f766e}
            .summary{background:#ffffff;border:1px solid #0f766e;border-radius:14px;padding:8px 10px;margin-bottom:8px;font-size:12px;font-weight:800;color:#0f766e;box-shadow:0 8px 18px rgba(15,118,110,.10)}
            .invoice-page{max-width:210mm;margin:0 auto;padding:14mm 16mm;position:relative;min-height:297mm;border:1px solid #99f6e4;background:#ffffff;page-break-after:always;box-shadow:0 16px 36px rgba(15,118,110,.14);border-radius:16px}
            .invoice-page:last-child{page-break-after:auto}
            .cb{position:absolute;width:56px;height:56px;border-style:solid;border-color:#5eead4}
            .cb-tl{top:6mm;left:6mm;border-width:2px 0 0 2px;border-radius:8px 0 0 0}
            .cb-tr{top:6mm;right:6mm;border-width:2px 2px 0 0;border-radius:0 8px 0 0}
            .cb-bl{bottom:6mm;left:6mm;border-width:0 0 2px 2px;border-radius:0 0 0 8px}
            .cb-br{bottom:6mm;right:6mm;border-width:0 2px 2px 0;border-radius:0 0 8px 0}
            .hdr{display:flex;justify-content:space-between;align-items:start;margin-bottom:22px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#0f766e 0%,#059669 58%,#0d9488 100%);box-shadow:0 12px 26px rgba(15,118,110,.24)}
            .hdr-co{display:flex;align-items:center;gap:18px}
            .hdr-logo{width:70px;height:70px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(3px)}
            .hdr-logo img{max-width:100%;max-height:100%;object-fit:contain}
            .co-ar{font-size:18px;font-weight:900;color:#ffffff;direction:rtl;text-shadow:0 1px 3px rgba(0,0,0,.18)}
            .co-en{font-size:11px;font-weight:700;color:#ccfbf1;letter-spacing:.5px;margin-top:2px}
            .co-tag{font-size:10px;color:#f8fafc;margin-top:3px;opacity:.92}
            .badge-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
            .am-badge{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:6px 8px;backdrop-filter:blur(3px)}
            .am-badge img{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.4)}
            .am-meta{text-align:right;line-height:1.1}
            .am-title{font-size:10px;font-weight:800;color:#f8fafc;letter-spacing:.2px}
            .am-powered{font-size:9px;color:#ccfbf1;font-weight:700}
            .badge{text-align:right}
            .badge-type{font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1.5px;text-transform:uppercase;text-shadow:0 1px 3px rgba(0,0,0,.16)}
            .badge-cn{font-size:9px;color:#ccfbf1;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase}
            .pills{display:flex;gap:10px;margin-bottom:20px}
            .pill{flex:1;background:#ffffff;border:1px solid #d8dee8;border-radius:12px;padding:10px 12px;text-align:center;box-shadow:0 6px 12px rgba(15,23,42,.05)}
            .pill.green{background:#ffffff;border-color:#0f766e;border-width:1.5px}
            .pill-lbl{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
            .pill-val{font-size:13px;font-weight:900;color:#0f766e}
            .party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
            .party-card{border-radius:12px;padding:14px;background:#ffffff;border:1px solid #d8dee8;border-top:3px solid #0f766e;box-shadow:0 8px 16px rgba(15,23,42,.05)}
            .party-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#0f766e;margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}
            .party-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px}
            .party-ar{font-size:13px;font-weight:700;color:#0f766e;margin-bottom:4px;direction:rtl}
            .party-sub{font-size:11px;color:#64748b;margin-top:2px}
            .tbl{width:100%;border-collapse:collapse;margin-bottom:18px;border-radius:12px;overflow:hidden}
            .tbl thead tr{background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)}
            .tbl th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#ffffff;text-align:left;border-bottom:2px solid #0f766e}
            .tbl th:last-child{text-align:right}
            .tbl td{padding:16px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top}
            .tbl td:last-child{text-align:right;font-weight:700;color:#0f172a}
            .tbl-num{font-weight:700;color:#0f766e;font-size:14px}
            .tbl-sub{font-size:10px;color:#94a3b8;margin-top:3px}
            .tots{display:flex;justify-content:flex-end;margin-top:6px}
            .tot-card{width:260px;background:#ffffff;border:2px solid #0f766e;border-radius:14px;padding:16px;box-shadow:0 10px 20px rgba(15,118,110,.12)}
            .tot-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#64748b}
            .tot-row span:last-child{font-weight:700;color:#0f172a}
            .tot-total{display:flex;justify-content:space-between;border-top:1.5px solid #99f6e4;padding-top:10px;margin-top:10px;font-size:16px;font-weight:900;color:#0f766e}
            .tot-sar{font-size:10px;font-weight:600;opacity:.6;margin-left:2px}
            .ftr{display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:18px;border-top:1px dashed #e2e8f0}
            .ftr-notes{font-size:10px;color:#94a3b8;line-height:1.7;max-width:55%}
            .ftr-notes b{color:#64748b}
            .brand-strip{margin-top:16px;border:1px solid #d8dee8;border-radius:12px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#ffffff}
            .brand-mark{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#0f766e;text-transform:uppercase}
            .brand-sub{font-size:8px;color:#64748b;margin-top:2px}
            .brand-copy{font-size:8px;font-weight:700;color:#94a3b8;text-align:right}
            .qr-box{text-align:center}
            .qr-img{width:180px;height:180px;border:1.5px solid #0f766e;padding:5px;border-radius:14px;background:#fff;box-shadow:0 10px 22px rgba(15,118,110,.14)}
            .qr-lbl{font-size:8px;color:#0f766e;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
            @media print {
              .wrap{max-width:none;margin:0;padding:0}
              .toolbar{display:none}
              .summary{display:none}
              .invoice-page{border:none;margin:0;box-shadow:none}
              @page{margin:0;size:A4}
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="toolbar">
              <button class="btn primary" onclick="window.print()">Print / Save PDF</button>
              <button class="btn" onclick="window.close()">Close</button>
            </div>
            <div class="summary">${escapeHtml(scopeLabel)} · ${rows.length} invoice(s)</div>
            ${pagesHtml}
          </div>
        </body>
      </html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleBulkInvoiceDownloadSeparate = async (mode: 'prompt' | 'all' = 'prompt') => {
    // Use the same filtered dataset shown in the table (view mode + date + building + unit + search).
    // This ensures Bulk Download matches Sales/Purchase/Credit Note tabs and current filters.
    let rows = [...filteredVATTransactions];

    rows = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.vatInvoiceNumber || '').localeCompare(b.vatInvoiceNumber || ''));
    if (rows.length === 0) {
      window.alert('No invoices found for bulk download with current filters.');
      return;
    }

    let maxCount = rows.length;
    if (mode === 'prompt') {
      const countInput = window.prompt(`Found ${rows.length} invoices in the current filter. How many do you want to download?`, String(rows.length));
      if (countInput === null) return;
      const requested = Number.parseInt(countInput, 10);
      if (!Number.isFinite(requested) || requested <= 0) {
        window.alert('Please enter a valid number.');
        return;
      }
      maxCount = Math.min(rows.length, requested);
    }
    const selectedRows = rows.slice(0, maxCount);

    const desktopFS = (window as any).desktopFS;
    const canDesktopSave = !!desktopFS?.selectDirectory && !!desktopFS?.writeBase64File;
    let dirPath: string | null = null;
    if (canDesktopSave) {
      dirPath = await desktopFS.selectDirectory();
      if (!dirPath) return;
    } else {
      // Web fallback: trigger browser downloads (one PDF per invoice).
      // Note: some browsers may block multiple automatic downloads; user may need to allow them.
      const ok = window.confirm(
        `You are not in the desktop app, so invoices will be downloaded by the browser.\n\nThis will download ${selectedRows.length} PDF file(s) from the current filter. Continue?`
      );
      if (!ok) return;
    }

    const logoSrc = new URL('./images/cologo.png', window.location.href).href;
    const amlakLogoSrc = new URL('./images/logo-192.png', window.location.href).href;
    const sanitizeFileName = (name: string) =>
      String(name || 'invoice').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_').slice(0, 120);

    const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || null));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const [logoDataUrl, amlakDataUrl] = await Promise.all([
      loadImageAsDataUrl(logoSrc),
      loadImageAsDataUrl(amlakLogoSrc),
    ]);

    const usedNames = new Set<string>();
    let savedCount = 0;
    const downloadBlob = (blob: Blob, fileName: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    };

    const invoiceDownloadStyles = `
      *{box-sizing:border-box;margin:0;padding:0}
      .invoice-page{width:210mm;min-height:297mm;padding:14mm 16mm;position:relative;background:#ffffff;border:1px solid #99f6e4;color:#1e293b;font-family:Inter,Arial,sans-serif}
      .cb{position:absolute;width:56px;height:56px;border-style:solid;border-color:#5eead4}
      .cb-tl{top:6mm;left:6mm;border-width:2px 0 0 2px;border-radius:8px 0 0 0}
      .cb-tr{top:6mm;right:6mm;border-width:2px 2px 0 0;border-radius:0 8px 0 0}
      .cb-bl{bottom:6mm;left:6mm;border-width:0 0 2px 2px;border-radius:0 0 0 8px}
      .cb-br{bottom:6mm;right:6mm;border-width:0 2px 2px 0;border-radius:0 0 8px 0}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#0f766e 0%,#059669 58%,#0d9488 100%);box-shadow:0 12px 26px rgba(15,118,110,.24)}
      .hdr-co{display:flex;align-items:center;gap:18px}
      .hdr-logo{width:70px;height:70px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:14px;display:flex;align-items:center;justify-content:center;padding:10px}
      .hdr-logo img{max-width:100%;max-height:100%;object-fit:contain}
      .co-ar{font-size:18px;font-weight:900;color:#ffffff;direction:rtl;text-shadow:0 1px 3px rgba(0,0,0,.18)}
      .co-en{font-size:11px;font-weight:700;color:#ccfbf1;letter-spacing:.5px;margin-top:2px}
      .co-tag{font-size:10px;color:#f8fafc;margin-top:3px;opacity:.92}
      .badge-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
      .am-badge{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:6px 8px}
      .am-badge img{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.4)}
      .am-meta{text-align:right;line-height:1.1}
      .am-title{font-size:10px;font-weight:800;color:#f8fafc;letter-spacing:.2px}
      .am-powered{font-size:9px;color:#ccfbf1;font-weight:700}
      .badge{text-align:right}
      .badge-type{font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1.5px;text-transform:uppercase;text-shadow:0 1px 3px rgba(0,0,0,.16)}
      .badge-cn{font-size:9px;color:#ccfbf1;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase}
      .pills{display:flex;gap:10px;margin-bottom:20px}
      .pill{flex:1;background:#ffffff;border:1px solid #d8dee8;border-radius:12px;padding:10px 12px;text-align:center;box-shadow:0 6px 12px rgba(15,23,42,.05)}
      .pill.green{background:#ffffff;border-color:#0f766e;border-width:1.5px}
      .pill-lbl{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
      .pill-val{font-size:13px;font-weight:900;color:#0f766e}
      .party-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
      .party-card{border-radius:12px;padding:14px;background:#ffffff;border:1px solid #d8dee8;border-top:3px solid #0f766e;box-shadow:0 8px 16px rgba(15,23,42,.05)}
      .party-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#0f766e;margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}
      .party-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px}
      .party-ar{font-size:13px;font-weight:700;color:#0f766e;margin-bottom:4px;direction:rtl}
      .party-sub{font-size:11px;color:#64748b;margin-top:2px}
      .tbl{width:100%;border-collapse:collapse;margin-bottom:18px;border-radius:12px;overflow:hidden}
      .tbl thead tr{background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)}
      .tbl th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#ffffff;text-align:left;border-bottom:2px solid #0f766e}
      .tbl th:last-child{text-align:right}
      .tbl td{padding:16px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top}
      .tbl td:last-child{text-align:right;font-weight:700;color:#0f172a}
      .tbl-num{font-weight:700;color:#0f766e;font-size:14px}
      .tbl-sub{font-size:10px;color:#94a3b8;margin-top:3px}
      .tots{display:flex;justify-content:flex-end;margin-top:6px}
      .tot-card{width:260px;background:#ffffff;border:2px solid #0f766e;border-radius:14px;padding:16px;box-shadow:0 10px 20px rgba(15,118,110,.12)}
      .tot-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#64748b}
      .tot-row span:last-child{font-weight:700;color:#0f172a}
      .tot-total{display:flex;justify-content:space-between;border-top:1.5px solid #99f6e4;padding-top:10px;margin-top:10px;font-size:16px;font-weight:900;color:#0f766e}
      .tot-sar{font-size:10px;font-weight:600;opacity:.6;margin-left:2px}
      .ftr{display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:18px;border-top:1px dashed #e2e8f0}
      .ftr-notes{font-size:10px;color:#94a3b8;line-height:1.7;max-width:55%}
      .ftr-notes b{color:#64748b}
      .brand-strip{margin-top:16px;border:1px solid #d8dee8;border-radius:12px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#ffffff}
      .brand-mark{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#0f766e;text-transform:uppercase}
      .brand-sub{font-size:8px;color:#64748b;margin-top:2px}
      .brand-copy{font-size:8px;font-weight:700;color:#94a3b8;text-align:right}
      .qr-box{text-align:center}
      .qr-img{width:180px;height:180px;border:1.5px solid #0f766e;padding:5px;border-radius:14px;background:#fff;box-shadow:0 10px 22px rgba(15,118,110,.14)}
      .qr-lbl{font-size:8px;color:#0f766e;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
    `;

    const buildDownloadInvoiceHtml = (tx: Transaction, idx: number, qrSrc: string) => {
      const isExpense = tx.type === TransactionType.EXPENSE;
      const isCredit = !!tx.isCreditNote;
      const taxable = Math.abs(Number(tx.amountExcludingVAT ?? tx.amount ?? 0));
      const vat = Math.abs(Number(tx.vatAmount || 0));
      const total = Math.abs(Number(tx.amountIncludingVAT ?? tx.totalWithVat ?? tx.amount ?? 0));
      const invNo = tx.vatInvoiceNumber || `INV-${idx + 1}`;
      const sellerName = isExpense ? ((tx as any).vendorName || 'Supplier') : companyNameEn;
      const sellerNameAr = isExpense ? '' : companyName;
      const sellerVAT = isExpense ? ((tx as any).vendorVATNumber || '-') : companyVAT;
      const sellerAddr = isExpense ? '-' : companyAddress;
      const buyerName = isExpense ? companyNameEn : (resolveSalesCustomerName(tx) || tx.unitNumber || 'Tenant');
      const buyerVAT = isExpense ? companyVAT : (tx.customerVATNumber || '-');
      const buyerAddr = isExpense ? companyAddress : '-';

      return `
        <section class="invoice-page">
          <div class="cb cb-tl"></div><div class="cb cb-tr"></div><div class="cb cb-bl"></div><div class="cb cb-br"></div>
          <div class="hdr">
            <div class="hdr-co">
              <div class="hdr-logo"><img src="${logoDataUrl || logoSrc}" alt="Logo"/></div>
              <div>
                <div class="co-ar">${escapeHtml(sellerNameAr || companyName)}</div>
                <div class="co-en">${escapeHtml(companyNameEn)}</div>
                <div class="co-tag">${escapeHtml(companyAddress)}${companyVAT ? ` &nbsp;|&nbsp; VAT ${escapeHtml(companyVAT)}` : ''}</div>
              </div>
            </div>
            <div class="badge-wrap">
              <div class="am-badge">
                <img src="${amlakDataUrl || amlakLogoSrc}" alt="AMLAK Property Manager"/>
                <div class="am-meta">
                  <div class="am-title">AMLAK Property Manager</div>
                  <div class="am-powered">Powered by AMLAK</div>
                </div>
              </div>
              <div class="badge">
                <div class="badge-type">${isCredit ? 'Credit Note' : isExpense ? 'Purchase Invoice' : 'Tax Invoice'}</div>
                <div class="badge-cn">ZATCA Compliant</div>
              </div>
            </div>
          </div>
          <div class="pills">
            <div class="pill green"><div class="pill-lbl">Invoice No.</div><div class="pill-val">${escapeHtml(invNo)}</div></div>
            <div class="pill"><div class="pill-lbl">Issue Date</div><div class="pill-val">${escapeHtml(fmtDate(tx.date))}</div></div>
            <div class="pill"><div class="pill-lbl">Payment</div><div class="pill-val">${escapeHtml(tx.paymentMethod || '-')}</div></div>
          </div>
          <div class="party-grid">
            <div class="party-card">
              <div class="party-title">Supplier / Seller</div>
              ${sellerNameAr ? `<div class="party-ar">${escapeHtml(sellerNameAr)}</div>` : ''}
              <div class="party-name">${escapeHtml(sellerName)}</div>
              <div class="party-sub">VAT: ${escapeHtml(sellerVAT)}</div>
              <div class="party-sub">${escapeHtml(sellerAddr)}</div>
            </div>
            <div class="party-card">
              <div class="party-title">Customer / Buyer</div>
              <div class="party-name">${escapeHtml(buyerName)}</div>
              <div class="party-sub">VAT: ${escapeHtml(buyerVAT)}</div>
              <div class="party-sub">${escapeHtml(buyerAddr)}</div>
            </div>
          </div>
          <table class="tbl">
            <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="tbl-num">01</span></td>
                <td>
                  <div style="font-weight:600">${escapeHtml(tx.details || (isExpense ? 'Purchase / Expense' : 'Property Rental Services'))}</div>
                  <div class="tbl-sub">${isExpense ? 'Expense' : 'Rental Income'}</div>
                </td>
                <td>${formatAmount(taxable)} SAR</td>
              </tr>
            </tbody>
          </table>
          <div class="tots">
            <div class="tot-card">
              <div class="tot-row"><span>Subtotal (Excl. VAT)</span><span>${formatAmount(taxable)}</span></div>
              <div class="tot-row"><span>VAT (${tx.vatRate || 15}%)</span><span>${formatAmount(vat)}</span></div>
              <div class="tot-total"><span>Total (Incl. VAT)</span><span>${formatAmount(total)} <span class="tot-sar">SAR</span></span></div>
            </div>
          </div>
          <div class="ftr">
            <div class="ftr-notes">
              <div><b>Payment:</b> ${escapeHtml(tx.paymentMethod || 'Cash')}</div>
              <div style="margin-top:6px">Computer-generated document. No signature required.</div>
            </div>
            <div class="qr-box">
              <img src="${qrSrc}" class="qr-img" alt="ZATCA QR Code"/>
              <div class="qr-lbl">ZATCA QR Code</div>
            </div>
          </div>
          <div class="brand-strip">
            <div>
              <div class="brand-mark">Powered by AMLAK Property Manager</div>
              <div class="brand-sub">Professional property management software</div>
            </div>
            <div class="brand-copy">© ${new Date().getFullYear()} AMLAK Software. All rights reserved.</div>
          </div>
        </section>
      `;
    };

    const renderInvoicePdfBlob = async (html: string): Promise<Blob> => {
      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.width = '210mm';
      host.style.background = '#ffffff';
      host.innerHTML = `<style>${invoiceDownloadStyles}</style>${html}`;
      document.body.appendChild(host);
      const page = host.querySelector('.invoice-page') as HTMLElement | null;
      if (!page) {
        host.remove();
        throw new Error('Invoice render failed.');
      }
      await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => {
        if ((img as HTMLImageElement).complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }));
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      host.remove();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
      return doc.output('blob');
    };

    for (let idx = 0; idx < selectedRows.length; idx++) {
      const tx = selectedRows[idx];
      const isExpense = tx.type === TransactionType.EXPENSE;
      const vat = Math.abs(Number(tx.vatAmount || 0));
      const total = Math.abs(Number(tx.amountIncludingVAT ?? tx.totalWithVat ?? tx.amount ?? 0));
      const invNo = tx.vatInvoiceNumber || `INV-${idx + 1}`;
      const qrPayload = tx.zatcaQRCode || `INV:${invNo}|DATE:${tx.date || ''}|TOTAL:${total}|VAT:${vat}|VATNO:${companyVAT}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&data=${encodeURIComponent(qrPayload)}`;
      const qrDataUrl = await loadImageAsDataUrl(qrSrc);
      const invoiceHtml = buildDownloadInvoiceHtml(tx, idx, qrDataUrl || qrSrc);
      const pdfBlob = await renderInvoicePdfBlob(invoiceHtml);

      const partyForName = isExpense ? ((tx as any).vendorName || 'Supplier') : (resolveSalesCustomerName(tx) || tx.customerName || 'Customer');
      let fileName = `${sanitizeFileName(partyForName)}_${sanitizeFileName(invNo)}.pdf`;
      if (usedNames.has(fileName)) {
        fileName = `${sanitizeFileName(partyForName)}_${sanitizeFileName(invNo)}_${idx + 1}.pdf`;
      }
      usedNames.add(fileName);

      if (canDesktopSave && dirPath) {
        const buffer = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        const base64 = btoa(binary);
        const writeRes = await desktopFS.writeBase64File({ dirPath, fileName, base64 });
        if (writeRes?.ok) savedCount += 1;
      } else {
        downloadBlob(pdfBlob, fileName);
        savedCount += 1;
        // Small delay reduces the chance of browsers dropping clicks.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    window.alert(`Saved ${savedCount} of ${selectedRows.length} invoices.`);
  };

  return (
    <>
    <div className="max-w-7xl mx-auto animate-fade-in px-4 pb-20">
      <div className="premium-card p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
                <FileText className="text-white" size={24} />
              </div>
              {t('vat.title')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t('vat.subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowQE(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all"><Plus size={18} /> {t('vat.newEntry')}</button>
            <button onClick={() => setShowPdfImport(true)} className="px-5 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 flex items-center gap-2 shadow-sm transition-all"><FileUp size={18} /> Import PDF</button>
            <button onClick={handleExportExcel} className="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 flex items-center gap-2 shadow-sm transition-all"><Download size={18} /> {t('vat.exportExcel')}</button>
            <button onClick={handlePreviewPdf} className="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 flex items-center gap-2 shadow-sm transition-all"><Eye size={18} /> {t('vat.previewPdf')}</button>
            <button onClick={() => handleBulkInvoicePrint('SALES')} className="px-4 py-2.5 bg-white border border-blue-300 text-blue-700 rounded-xl font-bold hover:bg-blue-50 flex items-center gap-2 shadow-sm transition-all"><FileDown size={16} /> Print Sales Invoices</button>
            <button onClick={() => handleBulkInvoicePrint('PURCHASE')} className="px-4 py-2.5 bg-white border border-rose-300 text-rose-700 rounded-xl font-bold hover:bg-rose-50 flex items-center gap-2 shadow-sm transition-all"><FileDown size={16} /> Print Purchase Invoices</button>
            <button onClick={() => handleBulkInvoicePrint('ALL')} className="px-4 py-2.5 bg-white border border-violet-300 text-violet-700 rounded-xl font-bold hover:bg-violet-50 flex items-center gap-2 shadow-sm transition-all"><FileDown size={16} /> Print All Invoices</button>
            <button onClick={() => handleBulkInvoiceDownloadSeparate('prompt')} className="px-4 py-2.5 bg-white border border-emerald-300 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 flex items-center gap-2 shadow-sm transition-all"><Download size={16} /> Download Some PDFs</button>
            <button onClick={() => handleBulkInvoiceDownloadSeparate('all')} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all"><Download size={16} /> Download Current Filter</button>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          <button 
            onClick={() => setReportView('COMBINED')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${reportView === 'COMBINED' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t('vat.combinedReport')}
          </button>
          <button 
            onClick={() => setReportView('SALES')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${reportView === 'SALES' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingUp size={16} /> {t('vat.salesReport')}
          </button>
          <button 
            onClick={() => setReportView('PURCHASE')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${reportView === 'PURCHASE' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingDown size={16} /> {t('vat.purchaseReport')}
          </button>
          <button
            onClick={() => setReportView('CREDIT_NOTE')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${reportView === 'CREDIT_NOTE' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <RotateCcw size={16} /> Credit Notes
          </button>
          <div className="w-px bg-slate-200 mx-1 self-stretch" />
          <button
            onClick={() => setReportView('COMPARE')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${reportView === 'COMPARE' ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ArrowLeftRight size={16} /> Compare
          </button>
        </div>

        {reportView === 'COMBINED' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Sales VAT</div>
              <div className="text-2xl font-black text-emerald-700">{formatAmount(salesVAT)} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
              <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Credit Note VAT</div>
              <div className="text-2xl font-black text-amber-700">{formatAmount(creditNoteVAT)} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-rose-50 p-5 rounded-xl border border-rose-200">
              <div className="text-[10px] font-bold text-rose-600 uppercase mb-1">Purchase VAT</div>
              <div className="text-2xl font-black text-rose-700">{formatAmount(purchaseVAT)} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
              <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Net Payable</div>
              <div className="text-2xl font-black text-blue-700">{formatAmount(Math.abs(netVATPayable))} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Count</div>
              <div className="text-2xl font-black text-slate-800">{filteredVATTransactions.length}</div>
            </div>
          </div>
        )}

        {reportView !== 'COMPARE' && (
          <div className="flex flex-wrap gap-4 items-center mt-6 pt-6 border-t border-slate-100">
            <div className="flex-1 min-w-[240px] relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by anything: invoice, bill ref, party, VAT, amount, date, details..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase shrink-0">{t('vat.quarterFilter')}</span>
                <select
                  value={vatQuarterFilter}
                  onChange={(e) => setVatQuarterFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[140px]"
                >
                  <option value="">{t('vat.quarterCustom')}</option>
                  <option value="1">{t('vat.quarter1')}</option>
                  <option value="2">{t('vat.quarter2')}</option>
                  <option value="3">{t('vat.quarter3')}</option>
                  <option value="4">{t('vat.quarter4')}</option>
                </select>
                {vatQuarterFilter ? (
                  <select
                    value={vatQuarterYear}
                    onChange={(e) => setVatQuarterYear(e.target.value)}
                    aria-label={t('vat.year')}
                    className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {vatQuarterYearOptions.map((yy) => (
                      <option key={yy} value={String(yy)}>
                        {yy}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-slate-400" />
                <input 
                  type="date" 
                  value={filterFromDate} 
                  onChange={(e) => {
                    setVatQuarterFilter('');
                    setFilterFromDate(e.target.value);
                  }} 
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-slate-400">{t('vat.to')}</span>
                <input 
                  type="date" 
                  value={filterToDate} 
                  onChange={(e) => {
                    setVatQuarterFilter('');
                    setFilterToDate(e.target.value);
                  }} 
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <select 
                value={filterBuildingId} 
                onChange={e => { setFilterBuildingId(e.target.value); setFilterUnit(''); }}
                className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">All Buildings</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {filterBuildingId && (
                <select 
                  value={filterUnit} 
                  onChange={e => setFilterUnit(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">All Units</option>
                  {(buildings.find(b => b.id === filterBuildingId)?.units || []).map((u: any) => {
                    const uName = typeof u === 'string' ? u : u.name;
                    return <option key={uName} value={uName}>{uName}</option>;
                  })}
                </select>
              )}

              <button 
                onClick={() => {
                  setFilterFromDate('');
                  setFilterToDate('');
                  setVatQuarterFilter('');
                  setVatQuarterYear(String(new Date().getFullYear()));
                  setSearchTerm('');
                  setFilterBuildingId('');
                  setFilterUnit('');
                }} 
                className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200"
              >{t('common.reset')}</button>
            </div>
          </div>
        )}
      </div>

      {reportView !== 'COMPARE' && (
      <div className="premium-card p-4 sm:p-5 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
          <img src="/images/logo.png" alt="" className="w-80 h-80 object-contain" />
        </div>
        
        <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Receipt size={18} className="text-slate-400" /> 
            {t('vat.allTransactions')} ({filteredVATTransactions.length})
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <button
                onClick={() => {
                  const selectedTx = filteredVATTransactions.filter(t => selectedIds.has(t.id));
                  const reportedCount = selectedTx.filter(
                    tx => tx.type === TransactionType.INCOME && !(tx as any).isCreditNote && isReportedToZatca(tx)
                  ).length;
                  const directDeleteCount = selectedTx.length - reportedCount;
                  const msg =
                    reportedCount > 0
                      ? `Delete ${selectedTx.length} items?\n\n${reportedCount} reported invoice(s) will create Credit Note(s).\n${directDeleteCount} item(s) will be deleted directly (no Credit Note).`
                      : `Delete ${selectedTx.length} items?\n\nAll selected items will be deleted directly (no Credit Note).`;
                  if (window.confirm(msg)) handleBulkDelete();
                }}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm disabled:opacity-60 shadow-sm"
              >
                {bulkDeleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete {selectedIds.size}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="rounded w-4 h-4 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">#</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{t('common.date')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{t('history.type')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{t('entry.invoiceNum')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{t('vat.party')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{t('vat.vatHash')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-right">{t('vat.exclVat')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-right">{t('entry.vat15')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-right">{t('vat.inclVat')}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase min-w-[140px]">Bank</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">QR</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">ZATCA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVATTransactions.map((tx, i) => (
                <tr key={tx.id} className={`hover:bg-slate-50/80 transition-colors ${selectedIds.has(tx.id) ? 'bg-blue-50/40' : tx.isCreditNote ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="rounded w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </td>
                  <td className="px-2 py-4 text-[10px] font-bold text-slate-400 font-mono text-center">{i + 1}</td>
                  <td className="px-4 py-4 text-xs font-mono whitespace-nowrap">{fmtDate(tx.date)}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tx.isCreditNote ? 'bg-rose-100 text-rose-700' : tx.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {tx.isCreditNote ? 'CN' : tx.type === TransactionType.INCOME ? 'SALE' : 'PURCH'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => window.location.hash = `/invoice/${tx.vatInvoiceNumber}`}>
                    {tx.vatInvoiceNumber}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <div className="font-bold text-slate-800 truncate max-w-[180px]" title={tx.type === TransactionType.INCOME ? resolveSalesCustomerName(tx) : tx.vendorName}>
                      {tx.type === TransactionType.INCOME ? resolveSalesCustomerName(tx) : (tx.vendorName || '-')}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                    {tx.type === TransactionType.INCOME ? (tx.customerVATNumber || '-') : (tx.vendorVATNumber || '-')}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">
                    {formatAmount(Math.abs(tx.amountExcludingVAT || tx.amount || 0))}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-blue-600 text-right">
                    {formatAmount(Math.abs(tx.vatAmount || 0))}
                  </td>
                  <td className="px-4 py-4 text-xs font-black text-slate-900 text-right">
                    {formatAmount(Math.abs(tx.totalWithVat || tx.amountIncludingVAT || tx.amount || 0))}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <select
                      value={tx.paymentMethod || ''}
                      onChange={e => handleUpdatePaymentMethod(tx.id, e.target.value as PaymentMethod)}
                      className="text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-400 w-full min-w-[100px]"
                    >
                      {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 align-top text-xs">
                    {tx.paymentMethod === PaymentMethod.BANK ? (
                      <select
                        value={tx.bankName || ''}
                        onChange={e => handleUpdateBankName(tx.id, e.target.value)}
                        className="w-full min-w-[120px] text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">{!tx.buildingId ? '—' : 'Select bank'}</option>
                        {getBanksForBuildingId(tx.buildingId).map(b => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {tx.zatcaQRCode ? (
                      <button onClick={() => setSelectedQRCode(tx.zatcaQRCode!)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100"><QrCode size={14}/></button>
                    ) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {tx.type === TransactionType.INCOME ? (
                        tx.zatcaQRCode ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={10}/> Reported</span>
                            <button onClick={() => setInvoiceModal(tx)} className="text-[9px] font-bold text-slate-400 hover:text-blue-600">View Inv</button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setZatcaConfirmTarget(tx)} 
                            disabled={zatcaSending[tx.id]}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all"
                          >
                            {zatcaSending[tx.id] ? <Loader size={10} className="animate-spin"/> : 'Send'}
                          </button>
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Input VAT</span>
                          {!(tx as any).isCreditNote && (
                            <button onClick={() => setReversalTarget(tx)} className="p-1 px-2 border border-rose-200 text-rose-600 rounded bg-rose-50 hover:bg-rose-100 transition-colors" title="Reverse Entry"><RotateCcw size={10}/></button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVATTransactions.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-16 text-center text-slate-400 font-bold italic">No VAT records found for chosen filters.</td></tr>
              )}
            </tbody>
            {filteredVATTransactions.length > 0 && (
              <tfoot className="bg-slate-50/50">
                <tr className="font-black text-slate-900">
                  <td colSpan={7} className="px-4 py-4 text-right text-xs">TOTALS (SAR)</td>
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200">{formatAmount(Math.abs(totalExcludingVAT))}</td>
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200 text-blue-600">{formatAmount(Math.abs(totalVAT))}</td>
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200 text-emerald-700 underline underline-offset-4">{formatAmount(Math.abs(totalIncludingVAT))}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
      </div>
      )}

      {/* Compare Tab Contents */}
      {reportView === 'COMPARE' && (
        <div className="premium-card p-5 sm:p-6 animate-slide-up">
           <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><ArrowLeftRight size={20} className="text-violet-600"/> Audit: Imported PDF vs History</h3>
                <p className="text-sm text-slate-500 mt-1">Cross-referencing imported purchase records with manual entries by Inclusive Amount.</p>
              </div>
              <div className="flex gap-3">
                <div className="px-4 py-3 bg-violet-50 rounded-2xl border border-violet-100 text-center shadow-sm">
                  <div className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1">Imported PDF</div>
                  <div className="text-2xl font-black text-violet-800">{importedExpenses.length}</div>
                </div>
                <div className="px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center shadow-sm">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Matched</div>
                  <div className="text-2xl font-black text-emerald-800">{matchedCount}</div>
                </div>
                <button
                  onClick={() => setShowDuplicateInspector(v => !v)}
                  className={`px-4 py-3 rounded-2xl border text-center shadow-sm transition-all ${
                    duplicateImportedGroups.length > 0
                      ? (showDuplicateInspector ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100')
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1">Duplicates</div>
                  <div className="text-2xl font-black">{duplicateImportedGroups.length}</div>
                </button>
              </div>
           </div>

           <div className="mb-6 flex flex-wrap gap-3 items-center">
             <div className="flex-1 min-w-[260px] relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
               <input
                 type="text"
                 value={compareSearchTerm}
                 onChange={(e) => setCompareSearchTerm(e.target.value)}
                 placeholder="Search by anything: invoice, bill ref, vendor, details, amount, date..."
                 className="w-full pl-9 pr-4 py-2.5 bg-white border border-violet-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-violet-200"
               />
             </div>
             <button
               onClick={() => { setCompareSearchTerm(''); setCompareDateFrom(''); setCompareDateTo(''); }}
               className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold"
             >
               Clear
             </button>
           </div>

           {showDuplicateInspector && (
             <div className="mb-6 rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white shadow-sm overflow-hidden">
               <div className="px-5 py-3 border-b border-rose-100 flex items-center justify-between">
                 <h4 className="text-sm font-black text-rose-700">Duplicate Finder</h4>
                 <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                   {duplicateImportedGroups.length} duplicate group(s)
                 </span>
               </div>
               <div className="p-4 space-y-3">
                 {duplicateImportedGroups.length === 0 ? (
                   <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
                     No duplicates found in imported records.
                   </div>
                 ) : (
                   duplicateImportedGroups.map((group) => (
                     <div key={group.key} className="rounded-2xl border border-rose-100 bg-white overflow-hidden">
                       <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                         <span className="text-xs font-black text-rose-700">Ref: {group.label || 'N/A'}</span>
                         <span className="text-[10px] font-bold text-rose-500">{group.items.length} items</span>
                       </div>
                       <div className="divide-y divide-slate-100">
                         {group.items.map((tx) => (
                           <div key={tx.id} className="px-3 py-2 flex items-center justify-between gap-3">
                             <div>
                               <div className="text-xs font-bold text-slate-800">{tx.vendorName || tx.details || '-'}</div>
                               <div className="text-[10px] text-slate-500">
                                 {fmtDate(tx.date)} · Inv: {tx.vatInvoiceNumber || '-'} · {formatAmount(inclAmt(tx))} SAR
                               </div>
                             </div>
                             <div className="flex items-center gap-2 shrink-0">
                               <button onClick={() => setComparePreview(tx)} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-[10px] font-bold hover:bg-violet-100">View</button>
                               <button onClick={() => handleCompareDelete(tx)} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold hover:bg-rose-100">Delete</button>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
           )}
           
           <div className="space-y-4">
              {importedExpenses.map(tx => {
                const amt = inclAmt(tx);
                const isMatched = historyInclSet.has(amt);
                const matchingHistory = historyExpenses.filter(h => inclAmt(h) === amt);
                return (
                  <div key={tx.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${isMatched ? 'border-emerald-200 bg-white' : 'border-rose-100 bg-rose-50/10'}`}>
                    <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center ${isMatched ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      <span>{isMatched ? `Matched (${matchingHistory.length})` : 'Unmatched Record'}</span>
                      <span>{formatAmount(amt)} SAR</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      <div className="p-4 space-y-2">
                        <div className="text-[9px] font-bold text-violet-600 uppercase tracking-widest flex items-center gap-1"><Sparkles size={10}/> From Imported PDF</div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-slate-800 text-sm">{tx.vendorName || tx.details}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{fmtDate(tx.date)} · Inv: {tx.vatInvoiceNumber || 'N/A'}</div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setComparePreview(tx)} className="p-1 px-2.5 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-bold hover:bg-violet-100">Audit</button>
                            <button onClick={() => handleCompareDelete(tx)} className="p-1 px-2.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100">Del</button>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-2 bg-slate-50/30">
                        <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><Receipt size={10}/> Matching in History</div>
                        {isMatched ? (
                          <div className="space-y-3">
                            {matchingHistory.map(h => (
                               <div key={h.id} className="flex justify-between items-center bg-white border border-emerald-100 rounded-xl p-2.5 shadow-sm">
                                  <div>
                                    <div className="text-xs font-bold text-slate-800">{h.details}</div>
                                    <div className="text-[10px] text-slate-500">{fmtDate(h.date)} · {h.paymentMethod}</div>
                                  </div>
                                  <button onClick={() => setComparePreview(h)} className="p-1 px-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"><Eye size={14}/></button>
                               </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center">
                            <div className="text-[10px] font-bold text-rose-400 italic">No expense entry found with total = {formatAmount(amt)} SAR</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {importedExpenses.length === 0 && <div className="py-16 text-center text-slate-400 font-black italic">Import purchase invoices to begin audit.</div>}
           </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQRCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] z-[60] p-4" onClick={() => setSelectedQRCode(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative animate-scale-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedQRCode(null)} className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400"/></button>
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-900">{t('vat.zatcaQr')}</h3>
                <p className="text-xs text-slate-500 mt-1">Official Reported Invoice QR</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-3xl border-4 border-emerald-100 shadow-inner">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${encodeURIComponent(selectedQRCode)}`} alt="QR" className="w-56 h-56 rounded-xl shadow-sm"/>
              </div>
              <div className="w-full space-y-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase text-center tracking-widest">Digital Payload</div>
                <div className="p-3 bg-slate-50 rounded-xl font-mono text-[9px] text-slate-400 break-all border border-slate-100 leading-relaxed">{selectedQRCode}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plain Invoice View Modal */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-start justify-center pt-[4vh] z-[60] overflow-y-auto px-4" onClick={() => setInvoiceModal(null)}>
          <div className="bg-white rounded-[2rem] shadow-3xl max-w-2xl w-full mb-12 overflow-hidden border border-emerald-100 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className={`relative px-8 py-10 overflow-hidden ${invoiceModal.type === 'EXPENSE' ? 'bg-gradient-to-br from-amber-800 via-amber-700 to-orange-500' : 'bg-gradient-to-br from-teal-700 via-emerald-600 to-teal-500'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="absolute -bottom-20 -left-16 w-72 h-72 bg-cyan-300/10 rounded-full blur-3xl"></div>
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-5">
                   <div className="w-20 h-20 bg-white/15 rounded-3xl flex items-center justify-center p-3 border border-white/30 backdrop-blur-sm shadow-2xl shadow-emerald-950/20"><img src="/images/cologo.png" className="w-full object-contain filter brightness-0 invert" alt="Logic" /></div>
                   <div>
                     {invoiceModal.type === 'INCOME' ? (
                       <>
                         <div className="text-white font-black text-2xl tracking-tight" dir="rtl" lang="ar" style={{fontFamily:"'Tajawal',sans-serif"}}>{companyName}</div>
                         <div className="text-emerald-200 font-bold text-sm mt-0.5 tracking-wide">{companyNameEn}</div>
                         <div className="text-emerald-300/50 text-[10px] mt-2 flex items-center gap-2"><Sparkles size={10}/> VAT: {companyVAT}</div>
                       </>
                     ) : (
                       <>
                         <div className="text-white font-black text-2xl tracking-tight">{(invoiceModal as any).vendorName || 'Vat Registered Supplier'}</div>
                         <div className="text-amber-200 font-bold text-sm mt-0.5">Supplier / Vendor</div>
                         <div className="text-amber-300/50 text-[10px] mt-2 flex items-center gap-2"><Sparkles size={10}/> VAT: {(invoiceModal as any).vendorVATNumber || 'N/A'}</div>
                       </>
                     )}
                   </div>
                </div>
                <div className="text-right flex flex-col items-end">
                   <div className="text-white/40 font-black text-[10px] uppercase tracking-[0.3em] mb-2">{invoiceModal.type === 'INCOME' ? 'Official Tax Invoice' : 'Purchase Record'}</div>
                   <div className="text-5xl font-black text-white/10 absolute -right-2 top-20 pointer-events-none select-none">INV</div>
                   <div className="text-3xl font-black text-white leading-none">{invoiceModal.isCreditNote ? 'Credit Note' : 'Invoice'}</div>
                   <div className="mt-4 px-3 py-1 bg-white/15 rounded-full border border-white/25 text-[9px] font-bold text-white uppercase tracking-widest backdrop-blur-sm shadow-lg">ZATCA Compliant</div>
                </div>
              </div>
            </div>

            <div className="bg-white px-8 py-4 border-b border-slate-100 flex justify-between items-center text-xs">
               <div className="flex gap-8">
                 <div className="space-y-0.5"><div className="text-emerald-600 font-bold uppercase text-[9px]">Invoice No.</div><div className="font-black text-emerald-900 text-lg leading-none">{invoiceModal.vatInvoiceNumber}</div></div>
                 <div className="space-y-0.5"><div className="text-slate-400 font-bold uppercase text-[9px]">Issue Date</div><div className="font-black text-slate-800">{fmtDate(invoiceModal.date)}</div></div>
                 <div className="space-y-0.5"><div className="text-slate-400 font-bold uppercase text-[9px]">Status</div><div className="font-black text-emerald-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Final</div></div>
               </div>
               <div className="text-right"><div className="text-slate-400 font-bold uppercase text-[9px]">Payment Method</div><div className="font-black text-slate-800">{invoiceModal.paymentMethod || 'BANK'}</div></div>
            </div>

            <div className="p-8 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Billing To / Customer</h4>
                   <div className="space-y-1">
                      <div className="text-xl font-black text-slate-800">{invoiceModal.type === 'INCOME' ? resolveSalesCustomerName(invoiceModal) : companyNameEn}</div>
                      <div className="text-xs font-bold text-slate-500">{invoiceModal.type === 'INCOME' ? (invoiceModal.buildingName) : companyAddress}</div>
                      <div className="pt-2"><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">VAT: {invoiceModal.type === 'INCOME' ? (invoiceModal.customerVATNumber || '-') : companyVAT}</span></div>
                   </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Issued By / Seller</h4>
                   <div className="space-y-1">
                      <div className="text-xl font-black text-slate-800">{invoiceModal.type === 'INCOME' ? companyNameEn : ((invoiceModal as any).vendorName || 'Supplier')}</div>
                      <div className="text-xs font-bold text-slate-500">{invoiceModal.type === 'INCOME' ? companyAddress : '-'}</div>
                      <div className="pt-2"><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">VAT: {invoiceModal.type === 'INCOME' ? companyVAT : ((invoiceModal as any).vendorVATNumber || '-')}</span></div>
                   </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-teal-700 to-emerald-600 px-6 py-3 font-black text-white text-[10px] uppercase tracking-widest flex justify-between">
                   <span>Service Description</span>
                   <span className="text-right">Line Total</span>
                </div>
                <div className="p-6 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                   <div>
                     <div className="text-lg font-black text-slate-800">{invoiceModal.details || 'Property Services & Management'}</div>
                     <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{invoiceModal.buildingName} · {invoiceModal.type === 'INCOME' ? 'Income Transaction' : 'Business Expense'}</p>
                   </div>
                   <div className="text-xl font-black text-slate-800">{formatAmount(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0)} <span className="text-[10px] font-bold text-slate-400">SAR</span></div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-80 space-y-4">
                  <div className="space-y-2 px-6">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>Subtotal</span><span className="text-slate-700">{formatAmount(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0)}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>VAT (15%)</span><span className="text-blue-600">{formatAmount(invoiceModal.vatAmount || 0)}</span></div>
                  </div>
                  <div className="bg-gradient-to-br from-teal-700 to-emerald-600 rounded-[1.5rem] px-8 py-6 flex justify-between items-center text-white shadow-xl shadow-teal-900/20 hover:scale-[1.02] transition-all cursor-default">
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Total</span>
                    <span className="text-3xl font-black tracking-tight">{formatAmount(invoiceModal.amountIncludingVAT || invoiceModal.totalWithVat || 0)} <span className="text-xs font-normal opacity-70">SAR</span></span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  COMPUTER GENERATED OFFICIAL DOCUMENT<br/>NO PHYSICAL SIGNATURE REQUIRED AS PER ZATCA GUIDELINES
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Powered by AMLAK</span>
                    <span className="text-[8px] text-slate-400">© {new Date().getFullYear()} AMLAK Software</span>
                  </div>
                </div>
                {invoiceModal.zatcaQRCode && (
                   <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-3xl p-3 pr-6 group cursor-pointer hover:bg-emerald-50 hover:border-emerald-100 transition-all" onClick={() => setSelectedQRCode(invoiceModal.zatcaQRCode!)}>
                      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 group-hover:border-emerald-200"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(invoiceModal.zatcaQRCode)}`} className="w-14 h-14" /></div>
                      <div>
                        <div className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Digital QR</div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Click to Enlarge</p>
                      </div>
                   </div>
                )}
              </div>
            </div>
            
            <div className="px-8 pb-10 flex gap-4">
              <button 
                onClick={() => { window.location.hash = `/invoice/${invoiceModal.id}`; setInvoiceModal(null); }}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:translate-y-[-2px] transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2"
              >
                <Eye size={18}/> View Full Invoice Page
              </button>
              <button onClick={() => setInvoiceModal(null)} className="px-10 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Entry Modal */}
      {showQE && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 overflow-y-auto" onClick={() => setShowQE(false)}>
          <div className="bg-white rounded-3xl shadow-3xl max-w-xl w-full my-6 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Smart VAT Entry</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Commercial Property Management</p>
                </div>
                <button onClick={() => setShowQE(false)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><X size={18}/></button>
              </div>
              {/* Type Toggle Cards */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setQeType('SALES'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${qeType === 'SALES' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${qeType === 'SALES' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                    <TrendingUp size={18}/>
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'SALES' ? 'text-emerald-700' : 'text-slate-600'}`}>Sales</div>
                    <div className={`text-[9px] font-bold ${qeType === 'SALES' ? 'text-emerald-500' : 'text-slate-400'}`}>Output VAT</div>
                  </div>
                  {qeType === 'SALES' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full"/>}
                </button>
                <button onClick={() => { setQeType('EXPENSE'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${qeType === 'EXPENSE' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${qeType === 'EXPENSE' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                    <TrendingDown size={18}/>
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'EXPENSE' ? 'text-amber-700' : 'text-slate-600'}`}>Purchase</div>
                    <div className={`text-[9px] font-bold ${qeType === 'EXPENSE' ? 'text-amber-500' : 'text-slate-400'}`}>Input VAT</div>
                  </div>
                  {qeType === 'EXPENSE' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full"/>}
                </button>
                <button onClick={() => { setQeType('FEES'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${qeType === 'FEES' ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${qeType === 'FEES' ? 'bg-sky-500 text-white shadow-md shadow-sky-200' : 'bg-slate-100 text-slate-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'FEES' ? 'text-sky-700' : 'text-slate-600'}`}>Fees</div>
                    <div className={`text-[9px] font-bold ${qeType === 'FEES' ? 'text-sky-500' : 'text-slate-400'}`}>No VAT</div>
                  </div>
                  {qeType === 'FEES' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-sky-500 rounded-full"/>}
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="px-7 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

              {/* Date + Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={10}/> Date</label>
                  <input type="date" value={qeDate} onChange={e => setQeDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Receipt size={10}/> Payment Method</label>
                  <SearchableSelect
                    options={Object.values(PaymentMethod).map(m => ({ value: m, label: m }))}
                    value={qePaymentMethod}
                    onChange={v => {
                      const m = v as PaymentMethod;
                      setQePaymentMethod(m);
                      if (m !== PaymentMethod.BANK) {
                        setQeBankName('');
                        setQeErrors(e => ({ ...e, bankName: undefined }));
                      }
                    }}
                    className="font-bold"
                  />
                </div>
              </div>
              {qePaymentMethod === PaymentMethod.BANK && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank account</label>
                  <select
                    value={qeBankName}
                    onChange={e => {
                      setQeBankName(e.target.value);
                      setQeErrors(prev => ({ ...prev, bankName: undefined }));
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all"
                  >
                    <option value="">{qeBankOptions.length === 0 ? 'No bank accounts in this book' : 'Select bank...'}</option>
                    {qeBankOptions.map((b, idx) => (
                      <option key={`${b.name}-${idx}`} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {qeErrors.bankName && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.bankName}</p>}
                  {qeBankName && (() => {
                    const row = qeBankOptions.find(b => b.name === qeBankName);
                    const bld = qeContextBuildingId ? buildings.find(x => x.id === qeContextBuildingId) : undefined;
                    const iban = row?.iban || (bld?.bankName === qeBankName ? bld?.iban : undefined);
                    return iban ? <p className="text-[10px] text-slate-500 font-mono">IBAN: {iban}</p> : null;
                  })()}
                </div>
              )}

              {/* ── SALES: Property & Tenant ── */}
              {qeType === 'SALES' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-emerald-100"/>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Property & Tenant</span>
                    <div className="h-px flex-1 bg-emerald-100"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</label>
                      <SearchableSelect options={nonResidentialBuildings.map(b => ({ value: b.id, label: b.name }))} value={qeBuildingId} onChange={handleQEBuildingChange} className="font-bold"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        Unit {qeContractLookupLoading && <Loader size={10} className="animate-spin text-emerald-500"/>}
                      </label>
                      <SearchableSelect options={qeBuildingUnits.map(u => ({ value: u, label: u }))} value={qeUnitNumber} onChange={handleQEUnitChange} className="font-bold" placeholder="Select unit..."/>
                    </div>
                  </div>

                  {qeActiveContract && (() => {
                    const effTotal = Number(qeActiveContract.totalValue || 0) + Number((qeActiveContract as any).upfrontPaid || 0);
                    const pct = effTotal > 0 ? Math.min(100, (qeContractStats.paid / effTotal) * 100) : 0;
                    return (
                      <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Tenant</div>
                            <div className="text-white font-black text-sm mt-0.5">{formatNameWithRoom(qeContractCustomer?.nameEn || qeActiveContract.customerName, qeContractCustomer?.roomNumber)}</div>
                          </div>
                          <div className="px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-[10px] font-black text-slate-300">
                            Inst. #{qeContractStats.installmentNo}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>Contract Progress</span>
                            <span className="text-white font-black">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full transition-all duration-700" style={{width:`${pct}%`}}/>
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-500">
                            <span>Paid: {formatAmount(qeContractStats.paid)} SAR</span>
                            <span className="text-emerald-400">Remaining: {formatAmount(qeContractStats.remaining)} SAR</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Customer VAT Number <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" value={qeCustomerVAT} onChange={e => { setQeCustomerVAT(e.target.value); setQeVatAutoFilled(false); setQeErrors(p => ({ ...p, customerVAT: undefined })); }}
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-mono font-bold outline-none transition-all ${
                        qeErrors.customerVAT ? 'border-rose-400 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-200'
                        : qeVatAutoFilled ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400'
                      }`}
                      placeholder="3xxxxxxxxxxxxxxxxx3"/>
                    {qeVatAutoFilled && !qeErrors.customerVAT && <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={10}/> Auto-filled from tenant profile</p>}
                    {qeErrors.customerVAT && <p className="text-[10px] text-rose-500 font-bold mt-0.5">{qeErrors.customerVAT}</p>}
                  </div>
                </div>
              )}

              {/* ── PURCHASE: Vendor ── */}
              {qeType === 'EXPENSE' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-amber-100"/>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Vendor / Supplier</span>
                    <div className="h-px flex-1 bg-amber-100"/>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select from Directory</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect options={vendors.map(v => ({ value: v.id, label: v.name }))} value={qeVendorId} onChange={vid => { setQeVendorId(vid); const v = vendors.find(x => x.id === vid); if(v) { setQeVendorName(v.name || v.nameEn); setQeVendorVAT(v.vatNumber || v.vatNo); setQeVendorAutoFilled(true); } }} className="font-bold"/>
                      </div>
                      <button onClick={() => setShowAddVendor(true)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0" title="Add new vendor"><Plus size={18} className="text-slate-600"/></button>
                    </div>
                  </div>

                  {qeVendorAutoFilled ? (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                      <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0">{qeVendorName[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-800 truncate">{qeVendorName}</div>
                        <div className="text-[10px] text-amber-600 font-bold font-mono mt-0.5">VAT: {qeVendorVAT || '—'}</div>
                      </div>
                      <button onClick={() => { setQeVendorId(''); setQeVendorName(''); setQeVendorVAT(''); setQeVendorAutoFilled(false); }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                        <input type="text" value={qeVendorName} onChange={e => setQeVendorName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"/>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VAT Number</label>
                        <input type="text" value={qeVendorVAT} onChange={e => setQeVendorVAT(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"/>
                      </div>
                    </div>
                  )}
                  {qeErrors.vendorName && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.vendorName}</p>}
                  {qeErrors.vendorVAT && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.vendorVAT}</p>}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense category</label>
                    <SearchableSelect
                      options={qeExpenseCategoryOptions.map(c => ({ value: c, label: c }))}
                      value={qeCategory}
                      onChange={(id) => { setQeCategory(id); setQeSubCategory(''); }}
                      className="font-bold"
                    />
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={qeNewExpenseCategoryInput}
                        onChange={e => setQeNewExpenseCategoryInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="New category name…"
                      />
                      <button
                        type="button"
                        onClick={addQeExpenseCategory}
                        className="px-3 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-amber-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {currentSubCategories.length > 0 ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-category</label>
                      <SearchableSelect
                        options={currentSubCategories.map(s => ({ value: s, label: s }))}
                        value={qeSubCategory}
                        onChange={v => setQeSubCategory(v)}
                        className="font-bold"
                        placeholder="Select…"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-category (optional)</label>
                      <input
                        type="text"
                        value={qeSubCategory}
                        onChange={e => setQeSubCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                        placeholder="e.g. Office supplies"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice / Ref No.</label>
                      <input type="text" value={qeVendorRefNo} onChange={e => setQeVendorRefNo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-200 transition-all" placeholder="INV-2026-..."/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Related Property</label>
                      <SearchableSelect
                        options={[{ value: '', label: 'General Expense' }, ...buildings.map(b => ({ value: b.id, label: b.name || b.id || '(unnamed)' }))]}
                        value={qePurchaseBuildingId}
                        onChange={handleQePurchaseBuildingChange}
                        className="font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── FEES: Property & Unit ── */}
              {qeType === 'FEES' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-sky-100"/>
                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Property & Unit</span>
                    <div className="h-px flex-1 bg-sky-100"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</label>
                      {feesEligibleBuildings.length === 0 ? (
                        <p className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          No non-residential buildings configured. Set property type to Non-Residential in Buildings.
                        </p>
                      ) : (
                        <SearchableSelect
                          options={feesEligibleBuildings.map((b) => ({ value: b.id, label: b.name || b.id || '(unnamed)' }))}
                          value={qeBuildingId}
                          onChange={(id) => {
                            handleQEBuildingChange(id);
                            setQeErrors((p) => ({ ...p, property: undefined, unit: undefined, feesComplete: undefined }));
                          }}
                          className="font-bold"
                        />
                      )}
                      {qeErrors.property && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.property}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
                      <SearchableSelect
                        options={(feesEligibleBuildings.find((b) => b.id === qeBuildingId)?.units || []).map((u: any) => {
                          const v = typeof u === 'string' ? u : (u.unitNumber || u.name || '');
                          return { value: v, label: v || '(unnamed)' };
                        }).filter((o) => o.value)}
                        value={qeUnitNumber}
                        onChange={(u) => {
                          handleQEUnitChange(u);
                          setQeErrors((p) => ({ ...p, unit: undefined, feesComplete: undefined }));
                        }}
                        className="font-bold"
                      />
                      {qeErrors.unit && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.unit}</p>}
                      {qeContractLookupLoading && <div className="text-[10px] text-slate-400 font-bold animate-pulse mt-1">Looking up contract…</div>}
                    </div>
                  </div>

                  {/* Tenant / contract auto-fill card */}
                  {qeActiveContract && (
                    <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-2xl">
                      <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center font-black text-white text-base flex-shrink-0">
                        {(qeActiveContract.customerName || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-800 text-sm truncate">{formatNameWithRoom(qeActiveContract.customerName, qeContractCustomer?.roomNumber)}</div>
                        <div className="text-[10px] text-sky-600 font-bold mt-0.5">Contract #{qeActiveContract.contractNo}</div>
                        {qeFeePeriodInstallment != null && !qeFeesAllPeriodsPaid && (
                          <div className="text-[9px] font-black text-sky-700 mt-1 uppercase tracking-wide">
                            {t('vat.feePeriodBadge', {
                              current: String(qeFeePeriodInstallment),
                              total: String(qeActiveContract.installmentCount || 1),
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Non-VAT fees breakdown */}
                  {qeActiveContract && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-1.5">
                      <div className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-2">Fee Breakdown (No VAT)</div>
                      {qeFeesAllPeriodsPaid ? (
                        <p className="text-xs font-bold text-emerald-800 leading-snug">{t('vat.feesNoNextPeriodBanner')}</p>
                      ) : (
                        <>
                          {getNonResFeeBreakdownLines(qeActiveContract as any).map(f => {
                            const inst = qeActiveContract.installmentCount || 1;
                            const per = f.firstInstallmentOnly
                              ? (qeFeePeriodInstallment === 1 ? f.val : 0)
                              : f.val / inst;
                            return (
                              <div key={f.key} className="flex justify-between text-xs">
                                <span className={`font-bold ${f.val < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{t(f.labelKey)}</span>
                                <span className={`font-black ${f.val < 0 ? 'text-rose-700' : 'text-sky-800'}`}>
                                  {formatAmount(per)} SAR
                                  <span className="text-slate-400 font-normal">{f.firstInstallmentOnly ? ' (1st inst only)' : ' /inst'}</span>
                                </span>
                              </div>
                            );
                          })}
                          {qeNonVatFeesPerInst > 0 && (
                            <div className="border-t border-sky-200 pt-1.5 mt-1 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-sky-700 font-black uppercase text-[9px] tracking-wide">Total this fee period</span>
                                <span className="font-black text-sky-700">{formatAmount(qeNonVatFeesPerInst)} SAR</span>
                              </div>
                              {qeFeesPaidThisInst > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-emerald-600 font-bold text-[9px]">Already Paid This Period</span>
                                  <span className="font-black text-emerald-600">−{formatAmount(qeFeesPaidThisInst)} SAR</span>
                                </div>
                              )}
                              {qeFeesPaidThisInst > 0 && (
                                <div className="flex justify-between text-xs bg-sky-100 rounded-lg px-2 py-1">
                                  <span className="text-sky-800 font-black uppercase text-[9px] tracking-wide">Remaining Due</span>
                                  <span className="font-black text-sky-800">{formatAmount(Math.max(0, qeNonVatFeesPerInst - qeFeesPaidThisInst))} SAR</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Generate Invoice toggle */}
                  {qeActiveContract && qeNonVatFeesPerInst > 0 && (
                    <button
                      type="button"
                      onClick={() => setQeFeesGenerateInvoice(v => !v)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${qeFeesGenerateInvoice ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${qeFeesGenerateInvoice ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}`}>
                        {qeFeesGenerateInvoice && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div>
                        <div className={`font-black text-xs ${qeFeesGenerateInvoice ? 'text-sky-700' : 'text-slate-600'}`}>Print Fee Invoice after saving</div>
                        <div className="text-[9px] text-slate-400 font-bold">Opens a printable non-VAT invoice PDF</div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* ── Amount ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100"/>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (SAR)</span>
                  <div className="h-px flex-1 bg-slate-100"/>
                </div>

                <div className={`rounded-2xl border-2 p-5 space-y-4 transition-colors ${qeType === 'FEES' ? 'border-sky-200 bg-sky-50/40' : qeType === 'SALES' ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                  {isCurrentVatEntry && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount entered is:</span>
                      <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Inclusive of VAT</span>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <input type="number" value={qeAmount} onChange={e => setQeAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-sm"
                      placeholder="0.00"/>
                  </div>
                  {qeErrors.amount && <p className="text-[10px] text-rose-500 font-bold -mt-2">{qeErrors.amount}</p>}
                  {qeErrors.feesComplete && <p className="text-[10px] text-emerald-700 font-bold -mt-2">{qeErrors.feesComplete}</p>}

                  {qeType === 'FEES' && qeAmount && parseFloat(qeAmount) > 0 && (
                    <div className="flex items-center justify-center gap-2 py-2 bg-sky-50 rounded-xl border border-sky-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="text-[10px] font-black text-sky-700 uppercase tracking-widest">No VAT — Full amount saved as-is</span>
                    </div>
                  )}

                  {isCurrentVatEntry && qeAmount && parseFloat(qeAmount) > 0 && (() => {
                    const amt = parseFloat(qeAmount);
                    const excl = amt / 1.15;
                    const vat  = amt - excl;
                    const total = amt;
                    return (
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                        <div className="flex-1 px-4 py-3 border-r border-slate-100 text-center">
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Excl. VAT</div>
                          <div className="font-black text-slate-700">{excl.toFixed(2)}</div>
                        </div>
                        <div className="flex-1 px-4 py-3 border-r border-slate-100 text-center">
                          <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">VAT 15%</div>
                          <div className="font-black text-blue-600">+{vat.toFixed(2)}</div>
                        </div>
                        <div className={`flex-1 px-4 py-3 text-center ${qeType === 'SALES' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                          <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${qeType === 'SALES' ? 'text-emerald-500' : 'text-amber-500'}`}>Total</div>
                          <div className={`font-black ${qeType === 'SALES' ? 'text-emerald-700' : 'text-amber-700'}`}>{total.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><FileText size={10}/> Description / Notes</label>
                <input type="text" value={qeDetails} onChange={e => setQeDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                  placeholder="Service description, installment details..."/>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-7 py-5 border-t border-slate-100 flex items-center gap-3">
              <button onClick={() => setShowQE(false)} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">Cancel</button>
              <button
                onClick={handleQuickEntrySave}
                disabled={qeSaving || !qeAmount}
                className={`flex-1 py-3 rounded-xl font-black text-sm text-white transition-all hover:translate-y-[-1px] hover:shadow-lg active:translate-y-0 disabled:opacity-50 disabled:grayscale disabled:translate-y-0 flex items-center justify-center gap-2 shadow-md ${
                  qeType === 'FEES' ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                  : qeType === 'SALES' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                }`}
              >
                {qeSaving ? <Loader size={18} className="animate-spin"/> : <CheckCircle size={18}/>}
                {qeSaving ? 'Saving...' : qeType === 'FEES' ? 'Save Non-VAT Fees' : isCurrentVatEntry ? (qeType === 'SALES' ? 'Register Sales Invoice' : 'Register Purchase Invoice') : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reversalTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-3xl animate-bounce-in">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6"><RotateCcw size={40} className="text-rose-600"/></div>
              <h3 className="text-2xl font-black text-center text-slate-900 leading-tight mb-2">Wrong Entry?</h3>
              <p className="text-sm text-slate-500 text-center font-bold px-4 leading-relaxed mb-8">This will create a dedicated Reversal Credit Note for <span className="text-rose-600">{(reversalTarget as any).vatInvoiceNumber}</span>. This action is logged for audit.</p>
              <div className="flex gap-3">
                 <button onClick={handleCreateReversal} disabled={reversalSaving} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-sm hover:translate-y-[-2px] active:translate-y-[0px] transition-all shadow-xl shadow-rose-900/20">{reversalSaving ? 'Reversing...' : 'Yes, Confirm'}</button>
                 <button onClick={() => setReversalTarget(null)} className="px-6 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200">Close</button>
              </div>
           </div>
        </div>
      )}

      {zatcaConfirmTarget && (() => {
        const tx = zatcaConfirmTarget;
        const excl = Number(tx.amountExcludingVAT ?? tx.amount ?? 0);
        const vatAmt = Number((tx as any).vatAmount ?? (excl * ((tx.vatRate ?? 15) / 100)));
        const total = Number((tx as any).amountIncludingVAT ?? (tx as any).totalWithVat ?? (excl + vatAmt));
        const buyer = tx.type === TransactionType.INCOME
          ? resolveSalesCustomerName(tx)
          : companyNameEn;
        const buyerVAT = tx.type === TransactionType.INCOME ? ((tx as any).customerVATNumber || '-') : companyVAT;
        const isSending = zatcaSending[tx.id];
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => !isSending && setZatcaConfirmTarget(null)}>
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-3xl animate-bounce-in" onClick={e => e.stopPropagation()}>
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <Send size={36} className="text-blue-600" />
              </div>
              <h3 className="text-2xl font-black text-center text-slate-900 leading-tight mb-1">Send to ZATCA?</h3>
              <p className="text-xs text-slate-500 text-center font-semibold px-4 mb-5">
                This will sign and report the invoice to ZATCA Phase 2. This action cannot be undone — any correction will require issuing a Credit Note.
              </p>
              <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 space-y-2.5">
                <div className="flex justify-between items-start gap-3 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Invoice</span>
                  <span className="font-black text-slate-800 text-right break-all">{tx.vatInvoiceNumber || '-'}</span>
                </div>
                <div className="flex justify-between items-start gap-3 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Date</span>
                  <span className="font-black text-slate-800">{tx.date ? fmtDate(tx.date) : '-'}</span>
                </div>
                <div className="flex justify-between items-start gap-3 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">{tx.type === TransactionType.INCOME ? 'Buyer' : 'Seller'}</span>
                  <span className="font-black text-slate-800 text-right">{buyer}</span>
                </div>
                <div className="flex justify-between items-start gap-3 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">VAT No.</span>
                  <span className="font-black text-slate-800 text-right break-all">{buyerVAT}</span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 mt-2.5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Excl. VAT</span>
                    <span className="font-black text-slate-800">{formatAmount(excl)} SAR</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">VAT ({tx.vatRate ?? 15}%)</span>
                    <span className="font-black text-emerald-600">+{formatAmount(vatAmt)} SAR</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-1.5 border-t border-slate-200">
                    <span className="font-black text-slate-700 uppercase tracking-wide">Total</span>
                    <span className="font-black text-blue-700">{formatAmount(total)} SAR</span>
                  </div>
                </div>
                {tx.isCreditNote && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 uppercase tracking-wider">
                    <RotateCcw size={10} /> Credit Note
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const target = zatcaConfirmTarget;
                    setZatcaConfirmTarget(null);
                    if (target) await handleSendToZatca(target);
                  }}
                  disabled={isSending}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:translate-y-[-2px] active:translate-y-[0px] transition-all shadow-xl shadow-blue-900/20 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {isSending ? <><Loader size={16} className="animate-spin" /> Sending...</> : <><Send size={14} /> Yes, Send</>}
                </button>
                <button
                  onClick={() => setZatcaConfirmTarget(null)}
                  disabled={isSending}
                  className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showPdfImport && <PdfPurchaseImport vendors={vendors} buildings={buildings} onClose={() => setShowPdfImport(false)} onImported={() => { setShowPdfImport(false); loadData(); }} />}
      <AddVendorDialog open={showAddVendor} onClose={() => setShowAddVendor(false)} onAdd={(v) => { setVendors(prev => [...prev, v as Vendor]); setQeVendorId(v.id!); setQeVendorName(v.name); setQeVendorVAT(v.vatNumber); setQeVendorAutoFilled(true); }} />
    </div>
    
    </>
  );
};

export default VATReport;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, ExpenseCategory, PaymentMethod, Building, Customer, Vendor, Bank } from '../types';
import { getTransactions, saveTransaction, getBuildings, getCustomers, getActiveContract, getVendors, createCreditNote, deleteTransaction, getContracts, saveContract, getBanks } from '../services/firestoreService';
import { isValidSaudiVAT } from '../utils/validators';
import SearchableSelect from './SearchableSelect';
import AddVendorDialog from './AddVendorDialog';
import ConfirmDialog from './ConfirmDialog';
import { FileText, Download, Calendar, Receipt, TrendingUp, TrendingDown, X, QrCode, FileDown, Search, Send, CheckCircle, AlertCircle, Loader, Eye, Plus, User, Sparkles, RotateCcw, FileUp, Trash2, ArrowLeftRight } from 'lucide-react';
import PdfPurchaseImport from './PdfPurchaseImport';
import { fmtDate, dateToLocalStr } from '../utils/dateFormat';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import { getInstallmentRange } from '../utils/installmentSchedule';
import { auth } from '../firebase';
import { useLanguage } from '../i18n';
import * as XLSX from 'xlsx';
import { ZATCA_SERVICE_BASE_URL, zatcaSignAndReportPath } from '../config/zatcaServiceUrl';

function zatcaUnreachableMessage(): string {
  return `ZATCA signing service is not reachable at ${ZATCA_SERVICE_BASE_URL}. Start the ZATCA server on this PC (port 3002), or set VITE_ZATCA_SERVICE_URL to your public HTTPS API URL in .env.local before building, then reinstall.`;
}

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

const VATReport: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { t, isRTL } = useLanguage();

  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuildingId, setFilterBuildingId] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filteredVATTransactions, setFilteredVATTransactions] = useState<Transaction[]>([]);
  const [reportView, setReportView] = useState<'SALES' | 'PURCHASE' | 'COMBINED' | 'COMPARE'>('SALES');
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
  const [qeCategory, setQeCategory] = useState<ExpenseCategory>(ExpenseCategory.VENDOR_PAYMENT);
  const [qeSubCategory, setQeSubCategory] = useState('');
  const [qeSaving, setQeSaving] = useState(false);
  const [qeErrors, setQeErrors] = useState<{ customerVAT?: string; vendorVAT?: string; vendorName?: string; amount?: string; bankName?: string }>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [qeContractCustomer, setQeContractCustomer] = useState<Customer | null>(null);
  const [qeVatAutoFilled, setQeVatAutoFilled] = useState(false);
  const [qeContractLookupLoading, setQeContractLookupLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [qeVendorId, setQeVendorId] = useState('');
  const [qeActiveContract, setQeActiveContract] = useState<any>(undefined);
  const [qeContractStats, setQeContractStats] = useState({ paid: 0, remaining: 0, installmentNo: 1 });
  const [qeNonVatFeesPerInst, setQeNonVatFeesPerInst] = useState(0);
  const [qeFeesPaidThisInst, setQeFeesPaidThisInst] = useState(0);
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
  const [comparePreview, setComparePreview] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
    Promise.all([getBuildings(), getCustomers(), getVendors(), getBanks()]).then(([b, c, v, bks]) => {
      setBuildings(b || []);
      setCustomers(c || []);
      setVendors((v || []).filter((vn: Vendor) => vn.status !== 'Inactive'));
      setBanks(bks || []);
    });
  }, []);

  const loadData = async () => {
    const txs = await getTransactions();
    setTransactions(txs || []);
  };

  const nonResidentialBuildings = buildings.filter(b => b.propertyType === 'NON_RESIDENTIAL' || (b.vatApplicable && b.propertyType !== 'RESIDENTIAL'));
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

  const handleQEBuildingChange = (id: string) => {
    setQeBuildingId(id);
    setQeUnitNumber('');
    setQeCustomerVAT('');
    setQeContractCustomer(null);
    setQeVatAutoFilled(false);
    setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0);
    setQeFeesPaidThisInst(0);
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
      // Try active contract first; if not found, fall back to any contract for this unit
      let contract = await getActiveContract(qeBuildingId, unit);
      if (!contract) {
        const allContracts = await getContracts();
        const unitContracts = (allContracts || []).filter((c: any) => c.buildingId === qeBuildingId && c.unitName === unit && !c.deleted);
        // Prefer Active status, then most-recently-started
        unitContracts.sort((a: any, b: any) => (a.status === 'Active' ? -1 : b.status === 'Active' ? 1 : 0));
        contract = unitContracts[0] || null;
      }
      if (contract) {
        setQeActiveContract(contract);
        const contractId = (contract as any).id;
        // Also match transactions that have no contractId but belong to this building+unit (income only)
        const prevPayments = transactions.filter(t => {
          if (t.status !== 'APPROVED' && t.status) return false;
          if (contractId && t.contractId === contractId) return true;
          if (!t.contractId && t.buildingId === qeBuildingId && t.unitNumber === unit && t.type !== TransactionType.EXPENSE) return true;
          return false;
        });
        const upfrontPaidAmount = Number((contract as any).upfrontPaid || 0);
        const totalInst = contract.installmentCount || 1;
        const rentValue = Number((contract as any).rentValue || 0);

        // --- SALES TAB = RENT ONLY. rentValue is treated as INCLUSIVE of VAT (what you actually collect) ---
        // Per-installment inclusive = rentValue / count. VAT breakdown = amount/1.15 split.
        const rentPerInstIncl = totalInst > 0 ? rentValue / totalInst : 0;
        const firstInstAmt = Math.round(rentPerInstIncl);
        const otherInstAmt = Math.round(rentPerInstIncl);
        const effectiveTotalIncl = rentValue;

        // --- INSTALLMENT DETECTION: use INCLUSIVE amounts (consistent with rentValue treated as inclusive) ---
        // Exclude Non-VAT fees entries — they are collected separately via FEES tab
        const rentPayments = prevPayments.filter(t => !(t as any).feesEntry);
        const totalPaidIncl = rentPayments.reduce((sum, t) => sum + (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) + ((t as any).discountAmount || 0), 0);
        const totalPaidEffective = totalPaidIncl + upfrontPaidAmount;

        let currentInstallment = 1;
        let cumulated = firstInstAmt;
        while (totalPaidEffective >= (Math.round(cumulated * 100) / 100) && currentInstallment < totalInst) {
            currentInstallment++;
            cumulated += otherInstAmt > 0 ? otherInstAmt : firstInstAmt;
        }

        // --- DISPLAY STATS ---
        const remainingDisplay = Math.max(0, effectiveTotalIncl - totalPaidEffective);
        setQeContractStats({ paid: totalPaidEffective, remaining: remainingDisplay, installmentNo: currentInstallment });

        // Auto-fill with BALANCE for the current installment (INCLUSIVE — field is already inclusive)
        const currentInstAmt = currentInstallment === 1 ? firstInstAmt : (otherInstAmt > 0 ? otherInstAmt : firstInstAmt);
        const thresholdBefore = Math.max(0, cumulated - currentInstAmt);
        const paidTowardCurrent = Math.max(0, totalPaidEffective - thresholdBefore);
        const rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);

        // Non-VAT + one-time FEES per installment — everything except rent (water + internet + parking + management + insurance + service + office + other)
        const periodicFees = (Number((contract as any).waterFee) || 0)
          + (Number((contract as any).internetFee) || 0)
          + (Number((contract as any).parkingFee) || 0)
          + (Number((contract as any).managementFee) || 0);
        const oneTimeFees = (Number((contract as any).insuranceFee) || 0)
          + (Number((contract as any).serviceFee) || 0)
          + (Number((contract as any).officeFeeAmount) || 0)
          + (Number((contract as any).otherAmount) || 0)
          - (Number((contract as any).otherDeduction) || 0);
        const periodicPerInst = totalInst > 0 ? periodicFees / totalInst : 0;
        const feesForThisInst = currentInstallment === 1 ? (periodicPerInst + oneTimeFees) : periodicPerInst;
        const nonVatPerInst = Math.round(feesForThisInst);
        setQeNonVatFeesPerInst(nonVatPerInst);

        // Calculate fees already paid for the current installment period
        const { startDate: feeStart, endDate: feeEnd } = getInstallmentRange(contract, currentInstallment);
        const feeStartStr = dateToLocalStr(feeStart);
        const feeEndStr = dateToLocalStr(feeEnd);
        const feesPaidThisInst = prevPayments
          .filter(t => (t as any).feesEntry === true && t.date >= feeStartStr && t.date <= feeEndStr)
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        setQeFeesPaidThisInst(feesPaidThisInst);
        const feesRemaining = Math.max(0, nonVatPerInst - feesPaidThisInst);

        // Auto-fill amount based on current tab type
        if (qeType === 'FEES') {
          if (feesRemaining > 0) setQeAmount(feesRemaining.toString());
          else if (nonVatPerInst > 0) setQeAmount(nonVatPerInst.toString());
        } else if (rentAutoFill > 0) {
          setQeAmount(rentAutoFill.toString());
        }

        // Period computation
        const { startDate, endDate } = getInstallmentRange(contract, currentInstallment);
        const periodText = `[${fmtDate(dateToLocalStr(startDate))} to ${fmtDate(dateToLocalStr(endDate))}]`;
        const instText = (currentInstallment === 1
          ? (qeType === 'FEES' ? `1st Fees Payment` : `1st Rent Payment`)
          : (qeType === 'FEES' ? `Fees Installment ${currentInstallment} of ${totalInst}` : `Rent Installment ${currentInstallment} of ${totalInst}`));
        const isPartial = totalPaidEffective > (Math.round((cumulated - (currentInstallment === 1 ? firstInstAmt : otherInstAmt)) * 100) / 100) && totalPaidEffective < (Math.round(cumulated * 100) / 100);
        // For FEES tab, use fees-specific partial state (not rent state)
        const isFeesPartial = qeType === 'FEES' && feesPaidThisInst > 0 && feesPaidThisInst < nonVatPerInst;
        const contractCust = customers.find(c => c.id === contract.customerId) || customers.find(c => (c.nameEn || c.nameAr) === contract.customerName);
        const contractCustLabel = formatNameWithRoom(contract.customerName, contractCust?.roomNumber);
        if (qeType === 'FEES') {
          setQeDetails(isFeesPartial
            ? `Balance Fees Payment - Installment ${currentInstallment} - ${periodText} - ${contractCustLabel}`
            : `${instText} - ${periodText} - ${contractCustLabel}`);
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
  }, [qeBuildingId, customers, transactions, qeType]);

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
    // FEES: no VAT number required, just needs building/unit and amount
    if (!amt || amt <= 0) errors.amount = 'Required';
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
          vatInvoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
          isVATApplicable: true,
          paymentMethod: qePaymentMethod,
          bankName: qePaymentMethod === PaymentMethod.BANK ? qeBankName : undefined,
          details: qeDetails,
          userId: uid,
          buildingId: qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId,
          buildingName: buildings.find(b => b.id === (qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId))?.name || '',
          unitNumber: qeType === 'SALES' ? qeUnitNumber : undefined,
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
        const w = window.open('', '_blank');
        if (w) {
          const feeRows = [
            { label: 'Water Fee', val: Number((qeActiveContract as any)?.waterFee) || 0 },
            { label: 'Internet Fee', val: Number((qeActiveContract as any)?.internetFee) || 0 },
            { label: 'Parking Fee', val: Number((qeActiveContract as any)?.parkingFee) || 0 },
            { label: 'Management Fee', val: Number((qeActiveContract as any)?.managementFee) || 0 },
          ].filter(f => f.val > 0);
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
          <img src="${window.location.origin}/images/cologo.png" class="logo" alt=""/>
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
              ${feeRows.map(f => `<tr><td>${f.label}</td><td>${f.val.toLocaleString()} SAR</td><td>${Math.round(f.val / instCount).toLocaleString()} SAR</td></tr>`).join('')}
              <tr class="total-row"><td>Total</td><td></td><td>${tx.amount.toLocaleString()} SAR</td></tr>
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
    setQePurchaseBuildingId(''); setQeSubCategory(''); setQeUnitNumber(''); setQeBuildingId('');
    setQeContractCustomer(null); setQeVatAutoFilled(false); setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0); setQeFeesPaidThisInst(0); setQeFeesGenerateInvoice(false);
    setQeBankName('');
  };

  const handleSendToZatca = async (t: Transaction) => {
    if (t.type === TransactionType.EXPENSE && !t.isCreditNote) return;
    setZatcaSending(prev => ({ ...prev, [t.id]: true }));
    try {
      const payload = {
        invoiceNumber: t.vatInvoiceNumber,
        issueDate: t.date,
        buyerName: t.type === TransactionType.INCOME ? (t.unitNumber || t.buildingName || '') : companyNameEn,
        buyerVAT: t.type === TransactionType.INCOME ? (t.customerVATNumber || '') : companyVAT,
        amount: t.amountExcludingVAT ?? t.amount ?? 0,
        vatRate: t.vatRate ?? 15,
        description: t.details || 'Services',
        isCreditNote: !!t.isCreditNote,
        originalInvoiceId: t.originalInvoiceId,
      };
      const res = await fetch(zatcaSignAndReportPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ZATCA service error');
      const updated: Transaction = { ...t, zatcaQRCode: data.qrCode, zatcaReportedAt: new Date().toISOString() };
      await saveTransaction(updated);
      setTransactions(prev => prev.map(tx => tx.id === t.id ? updated : tx));
      const ok = data.zatcaStatus >= 200 && data.zatcaStatus < 300;
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok, msg: ok ? 'Reported Phase 2' : 'HTTP ' + data.zatcaStatus } }));
      setInvoiceModal(updated);
    } catch (err: any) {
      const raw = err?.message || String(err);
      const netFail =
        err?.name === 'TypeError' ||
        /failed to fetch|networkerror|load failed|aborted|refused|econnrefused|not allowed|cross-origin/i.test(raw);
      const msg = netFail ? zatcaUnreachableMessage() : raw || 'ZATCA request failed';
      console.warn('[ZATCA]', raw || err);
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok: false, msg } }));
    } finally {
      setZatcaSending(prev => ({ ...prev, [t.id]: false }));
    }
  };

  const isReportedToZatca = (tx: Transaction) => Boolean(tx.zatcaQRCode || (tx as any).zatcaReportedAt);

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
    let filtered = transactions.filter(t => t.isVATApplicable === true);
    if (reportView === 'SALES') filtered = filtered.filter(t => t.type === TransactionType.INCOME);
    else if (reportView === 'PURCHASE') filtered = filtered.filter(t => t.type === TransactionType.EXPENSE);
    if (filterFromDate) filtered = filtered.filter(t => t.date >= filterFromDate);
    if (filterToDate) filtered = filtered.filter(t => t.date <= filterToDate);
    
    // New Search & Building Filters
    if (filterBuildingId) filtered = filtered.filter(t => t.buildingId === filterBuildingId);
    if (filterUnit) filtered = filtered.filter(t => t.unitNumber === filterUnit);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        (t.vatInvoiceNumber || '').toLowerCase().includes(s) ||
        (t.unitNumber || '').toLowerCase().includes(s) ||
        (t.buildingName || '').toLowerCase().includes(s) ||
        (t.vendorName || '').toLowerCase().includes(s) ||
        (t.customerVATNumber || '').includes(s) ||
        (t.vendorVATNumber || '').includes(s) ||
        (t.details || '').toLowerCase().includes(s)
      );
    }
    
    setFilteredVATTransactions(filtered);
  }, [transactions, filterFromDate, filterToDate, reportView, searchTerm, filterBuildingId, filterUnit]);

  const allFilteredSelected = filteredVATTransactions.length > 0 && filteredVATTransactions.every(t => selectedIds.has(t.id));

  const salesTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.INCOME);
  const purchaseTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.EXPENSE);
  const salesVAT = salesTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const purchaseVAT = purchaseTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const netVATPayable = salesVAT - purchaseVAT;

  const totalVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const totalExcludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountExcludingVAT || t.amount || 0), 0);
  const totalIncludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountIncludingVAT || t.totalWithVat || t.amount || 0), 0);
  const totalDebit = filteredVATTransactions.reduce((sum, tx) => {
    const amount = tx.vatAmount || 0;
    if (tx.type === TransactionType.INCOME) return sum + (tx.isCreditNote ? amount : 0);
    return sum + (tx.isCreditNote ? 0 : amount);
  }, 0);
  const totalCredit = filteredVATTransactions.reduce((sum, tx) => {
    const amount = tx.vatAmount || 0;
    if (tx.type === TransactionType.INCOME) return sum + (tx.isCreditNote ? 0 : amount);
    return sum + (tx.isCreditNote ? amount : 0);
  }, 0);
  const reportLabel =
    reportView === 'SALES'
      ? t('vat.salesReport')
      : reportView === 'PURCHASE'
        ? t('vat.purchaseReport')
        : t('vat.combinedReport');

  const importedExpenses = transactions.filter(t => (t as any).vatReportOnly && t.type === TransactionType.EXPENSE);
  const historyExpenses = transactions.filter(t => 
    !(t as any).vatReportOnly && t.type === TransactionType.EXPENSE && 
    (!compareDateFrom || t.date >= compareDateFrom) && (!compareDateTo || t.date <= compareDateTo)
  );
  
  const inclAmt = (t: Transaction) => Math.round((t.totalWithVat || t.amountIncludingVAT || t.amount || 0) * 100) / 100;
  const historyInclSet = new Set(historyExpenses.map(inclAmt));
  const matchedCount = importedExpenses.filter(t => historyInclSet.has(inclAmt(t))).length;

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
      Party: tx.type === TransactionType.INCOME ? (tx.unitNumber || tx.buildingName || '') : (tx.vendorName || ''),
      'VAT #': tx.type === TransactionType.INCOME ? (tx.customerVATNumber || '') : (tx.vendorVATNumber || ''),
      'Payment Method': tx.paymentMethod || '',
      Building: tx.buildingName || '',
      Unit: tx.unitNumber || '',
      Details: tx.details || '',
      'ZATCA Status': tx.zatcaQRCode ? 'Reported' : 'Pending',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 30 }, { wch: 14 },
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

    const fromLabel = filterFromDate || '-';
    const toLabel = filterToDate || '-';
    const generatedAt = fmtDate(new Date());
    const rowsHtml = filteredVATTransactions.map((tx, idx) => `
      ${(() => {
        const amount = tx.vatAmount || 0;
        const debit = tx.type === TransactionType.INCOME ? (tx.isCreditNote ? amount : 0) : (tx.isCreditNote ? 0 : amount);
        const credit = tx.type === TransactionType.INCOME ? (tx.isCreditNote ? 0 : amount) : (tx.isCreditNote ? amount : 0);
        return `
      <tr>
        <td class="tc">${idx + 1}</td>
        <td>${escapeHtml(fmtDate(tx.date))}</td>
        <td>${escapeHtml(tx.isCreditNote ? 'Credit Note' : tx.type === TransactionType.INCOME ? 'Sale' : 'Purchase')}</td>
        <td>${escapeHtml(tx.vatInvoiceNumber || '-')}</td>
        <td>${escapeHtml(tx.type === TransactionType.INCOME ? (tx.unitNumber || tx.buildingName || '-') : (tx.vendorName || '-'))}</td>
        <td>${escapeHtml(tx.type === TransactionType.INCOME ? (tx.customerVATNumber || '-') : (tx.vendorVATNumber || '-'))}</td>
        <td class="tr debit">${debit.toLocaleString()}</td>
        <td class="tr credit">${credit.toLocaleString()}</td>
      </tr>
        `;
      })()}
    `).join('');

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>VAT Report Preview</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Inter, Arial, sans-serif; color: #0f172a; background: #f8fafc; }
            .page { max-width: 1200px; margin: 0 auto; padding: 16px; }
            .toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 12px; }
            .btn { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; background: white; color: #334155; }
            .btn.primary { background: #047857; border-color: #047857; color: white; }
            .card { border-radius: 14px; border: 1px solid #dbe7df; background: white; overflow: hidden; }
            .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: white; }
            .co { display: flex; align-items: center; gap: 14px; }
            .logo-wrap { width: 54px; height: 54px; border-radius: 12px; background: #ffffff24; border: 1px solid #ffffff40; display: flex; align-items: center; justify-content: center; }
            .logo-wrap img { width: 42px; height: 42px; object-fit: contain; }
            .title { font-size: 20px; font-weight: 800; letter-spacing: 0.3px; }
            .sub { font-size: 11px; color: #d1fae5; margin-top: 3px; }
            .meta { text-align: right; font-size: 11px; color: #dcfce7; line-height: 1.5; }
            .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fffb; }
            .sum-box { border: 1px solid #dcfce7; border-radius: 10px; background: white; padding: 10px 12px; }
            .sum-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; }
            .sum-value { margin-top: 3px; font-size: 17px; font-weight: 800; color: #0f172a; }
            .table-wrap { padding: 14px 18px 18px; overflow: auto; }
            table { width: 100%; border-collapse: collapse; }
            thead th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 800; padding: 10px 12px; border-bottom: 1px solid #cbd5e1; text-align: left; }
            thead th.tc, tbody td.tc { text-align: center; }
            thead th.tr, tbody td.tr { text-align: right; }
            tbody td { padding: 9px 12px; font-size: 12px; border-bottom: 1px solid #eef2f7; }
            tbody tr:nth-child(even) td { background: #fbfdff; }
            .debit { color: #b45309; font-weight: 700; }
            .credit { color: #047857; font-weight: 800; }
            tfoot td { padding: 11px 12px; font-size: 12px; font-weight: 800; border-top: 2px solid #cbd5e1; background: #f8fafc; }
            .footer { border-top: 1px solid #e2e8f0; padding: 12px 18px 14px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
            @media print {
              body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { padding: 0; }
              .toolbar { display: none; }
              @page { margin: 10mm; size: A4 landscape; }
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
              <div class="header">
                <div class="co">
                  <div class="logo-wrap"><img src="${window.location.origin}/images/cologo.png" alt="RRG Logo" /></div>
                  <div>
                    <div class="title">VAT Report</div>
                    <div class="sub">${escapeHtml(companyNameEn)} &bull; ${escapeHtml(companyVAT)}</div>
                  </div>
                </div>
                <div class="meta">
                  <div>Generated: ${escapeHtml(generatedAt)}</div>
                  <div>View: ${escapeHtml(reportLabel)}</div>
                  <div>Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)}</div>
                </div>
              </div>
              <div class="summary">
                <div class="sum-box"><div class="sum-label">Transactions</div><div class="sum-value">${filteredVATTransactions.length}</div></div>
                <div class="sum-box"><div class="sum-label">Total Debit</div><div class="sum-value">${totalDebit.toLocaleString()} SAR</div></div>
                <div class="sum-box"><div class="sum-label">Total Credit</div><div class="sum-value">${totalCredit.toLocaleString()} SAR</div></div>
                <div class="sum-box"><div class="sum-label">Balance</div><div class="sum-value">${(totalCredit - totalDebit).toLocaleString()} SAR</div></div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th class="tc">#</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Invoice</th>
                      <th>Party</th>
                      <th>VAT #</th>
                      <th class="tr">Debit</th>
                      <th class="tr">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="6" class="tr">TOTAL (SAR)</td>
                      <td class="tr">${totalDebit.toLocaleString()}</td>
                      <td class="tr">${totalCredit.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div class="footer">
                <span>Computer-generated report preview.</span>
                <span>Powered by Amlak</span>
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
          <div className="w-px bg-slate-200 mx-1 self-stretch" />
          <button
            onClick={() => setReportView('COMPARE')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${reportView === 'COMPARE' ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ArrowLeftRight size={16} /> Compare
          </button>
        </div>

        {reportView === 'COMBINED' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Sales VAT</div>
              <div className="text-2xl font-black text-emerald-700">{salesVAT.toLocaleString()} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-rose-50 p-5 rounded-xl border border-rose-200">
              <div className="text-[10px] font-bold text-rose-600 uppercase mb-1">Purchase VAT</div>
              <div className="text-2xl font-black text-rose-700">{purchaseVAT.toLocaleString()} <span className="text-xs">SAR</span></div>
            </div>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
              <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Net Payable</div>
              <div className="text-2xl font-black text-blue-700">{netVATPayable.toLocaleString()} <span className="text-xs">SAR</span></div>
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
                placeholder="Search Invoice, Party, VAT..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-slate-400" />
                <input 
                  type="date" 
                  value={filterFromDate} 
                  onChange={e => setFilterFromDate(e.target.value)} 
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-slate-400">to</span>
                <input 
                  type="date" 
                  value={filterToDate} 
                  onChange={e => setFilterToDate(e.target.value)} 
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
                onClick={() => { setFilterFromDate(''); setFilterToDate(''); setSearchTerm(''); setFilterBuildingId(''); setFilterUnit(''); }} 
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
                    <div className="font-bold text-slate-800 truncate max-w-[120px]" title={tx.type === TransactionType.INCOME ? (tx.unitNumber || tx.buildingName) : tx.vendorName}>
                      {tx.type === TransactionType.INCOME ? (tx.unitNumber ? `Unit ${tx.unitNumber}` : tx.buildingName) : (tx.vendorName)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                    {tx.type === TransactionType.INCOME ? (tx.customerVATNumber || '-') : (tx.vendorVATNumber || '-')}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">
                    {(tx.amountExcludingVAT || tx.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-xs font-bold text-blue-600 text-right">
                    {(tx.vatAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-xs font-black text-slate-900 text-right">
                    {(tx.totalWithVat || tx.amountIncludingVAT || tx.amount || 0).toLocaleString()}
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
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200">{totalExcludingVAT.toLocaleString()}</td>
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200 text-blue-600">{totalVAT.toLocaleString()}</td>
                  <td className="px-4 py-4 text-xs text-right border-t border-slate-200 text-emerald-700 underline underline-offset-4">{totalIncludingVAT.toLocaleString()}</td>
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
              </div>
           </div>
           
           <div className="space-y-4">
              {importedExpenses.map(tx => {
                const amt = inclAmt(tx);
                const isMatched = historyInclSet.has(amt);
                const matchingHistory = historyExpenses.filter(h => inclAmt(h) === amt);
                return (
                  <div key={tx.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${isMatched ? 'border-emerald-200 bg-white' : 'border-rose-100 bg-rose-50/10'}`}>
                    <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center ${isMatched ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      <span>{isMatched ? `Matched (${matchingHistory.length})` : 'Unmatched Record'}</span>
                      <span>{amt.toLocaleString()} SAR</span>
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
                        <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><History size={10}/> Matching in History</div>
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
                            <div className="text-[10px] font-bold text-rose-400 italic">No expense entry found with total = {amt.toLocaleString()} SAR</div>
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
          <div className="bg-white rounded-[2rem] shadow-3xl max-w-2xl w-full mb-12 overflow-hidden border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className={`relative px-8 py-10 overflow-hidden ${invoiceModal.type === 'EXPENSE' ? 'bg-gradient-to-br from-amber-900 to-amber-700' : 'bg-gradient-to-br from-emerald-900 to-emerald-700'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-5">
                   <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center p-3 border border-white/20 backdrop-blur-sm"><img src="/images/cologo.png" className="w-full object-contain filter brightness-0 invert" alt="Logic" /></div>
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
                   <div className="mt-4 px-3 py-1 bg-white/10 rounded-full border border-white/20 text-[9px] font-bold text-white uppercase tracking-widest backdrop-blur-sm">ZATCA Compliant</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex justify-between items-center text-xs">
               <div className="flex gap-8">
                 <div className="space-y-0.5"><div className="text-slate-400 font-bold uppercase text-[9px]">Reference</div><div className="font-black text-slate-800">{invoiceModal.vatInvoiceNumber}</div></div>
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
                      <div className="text-xl font-black text-slate-800">{invoiceModal.type === 'INCOME' ? (invoiceModal.unitNumber ? `Unit ${invoiceModal.unitNumber}` : invoiceModal.buildingName) : companyNameEn}</div>
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
                <div className="bg-slate-50 px-6 py-3 font-black text-slate-400 text-[10px] uppercase tracking-widest flex justify-between">
                   <span>Service Description</span>
                   <span className="text-right">Line Total</span>
                </div>
                <div className="p-6 flex justify-between items-center group hover:bg-slate-50/50 transition-colors">
                   <div>
                     <div className="text-lg font-black text-slate-800">{invoiceModal.details || 'Property Services & Management'}</div>
                     <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{invoiceModal.buildingName} · {invoiceModal.type === 'INCOME' ? 'Income Transaction' : 'Business Expense'}</p>
                   </div>
                   <div className="text-xl font-black text-slate-800">{(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">SAR</span></div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-80 space-y-4">
                  <div className="space-y-2 px-6">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>Subtotal</span><span className="text-slate-700">{(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>VAT (15%)</span><span className="text-blue-600">{(invoiceModal.vatAmount || 0).toLocaleString()}</span></div>
                  </div>
                  <div className="bg-emerald-600 rounded-[1.5rem] px-8 py-6 flex justify-between items-center text-white shadow-xl shadow-emerald-900/10 hover:scale-[1.02] transition-all cursor-default">
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Total</span>
                    <span className="text-3xl font-black tracking-tight">{(invoiceModal.amountIncludingVAT || invoiceModal.totalWithVat || 0).toLocaleString()} <span className="text-xs font-normal opacity-70">SAR</span></span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  COMPUTER GENERATED OFFICIAL DOCUMENT<br/>NO PHYSICAL SIGNATURE REQUIRED AS PER ZATCA GUIDELINES
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
                onClick={() => { window.location.hash = `/invoice/${invoiceModal.vatInvoiceNumber}`; setInvoiceModal(null); }}
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 overflow-y-auto" onClick={() => setShowQE(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-6 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="px-7 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">New VAT Entry</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">ZATCA-compliant tax invoice</p>
                </div>
                <button onClick={() => setShowQE(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
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
                  <SearchableSelect
                    options={qeBankOptions.map(b => ({ value: b.name, label: b.name }))}
                    value={qeBankName}
                    onChange={name => {
                      setQeBankName(name);
                      setQeErrors(e => ({ ...e, bankName: undefined }));
                    }}
                    className="font-bold"
                    placeholder={qeBankOptions.length === 0 ? 'No bank accounts in this book' : 'Select bank...'}
                  />
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
                            <span>Paid: {qeContractStats.paid.toLocaleString()} SAR</span>
                            <span className="text-emerald-400">Remaining: {qeContractStats.remaining.toLocaleString()} SAR</span>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice / Ref No.</label>
                      <input type="text" value={qeVendorRefNo} onChange={e => setQeVendorRefNo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-200 transition-all" placeholder="INV-2026-..."/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Related Property</label>
                      <SearchableSelect options={[{value:'', label:'General Expense'}, ...nonResidentialBuildings.map(b => ({ value: b.id, label: b.name }))]} value={qePurchaseBuildingId} onChange={handleQePurchaseBuildingChange} className="font-bold"/>
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
                      <SearchableSelect options={buildings.map(b => ({ value: b.id, label: b.name || b.id || '(unnamed)' }))} value={qeBuildingId} onChange={handleQEBuildingChange} className="font-bold"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
                      <SearchableSelect
                        options={(buildings.find(b => b.id === qeBuildingId)?.units || []).map((u: any) => { const v = typeof u === 'string' ? u : (u.unitNumber || u.name || ''); return { value: v, label: v || '(unnamed)' }; }).filter(o => o.value)}
                        value={qeUnitNumber} onChange={handleQEUnitChange} className="font-bold"
                      />
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
                      </div>
                    </div>
                  )}

                  {/* Non-VAT fees breakdown */}
                  {qeActiveContract && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-1.5">
                      <div className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-2">Fee Breakdown (No VAT)</div>
                      {[
                        { label: 'Water Fee', val: Number((qeActiveContract as any).waterFee) || 0 },
                        { label: 'Internet Fee', val: Number((qeActiveContract as any).internetFee) || 0 },
                        { label: 'Parking Fee', val: Number((qeActiveContract as any).parkingFee) || 0 },
                        { label: 'Management Fee', val: Number((qeActiveContract as any).managementFee) || 0 },
                      ].filter(f => f.val > 0).map(f => (
                        <div key={f.label} className="flex justify-between text-xs">
                          <span className="text-slate-500 font-bold">{f.label}</span>
                          <span className="font-black text-sky-800">{(f.val / (qeActiveContract.installmentCount || 1)).toLocaleString()} SAR<span className="text-slate-400 font-normal"> /inst</span></span>
                        </div>
                      ))}
                      {qeNonVatFeesPerInst > 0 && (
                        <div className="border-t border-sky-200 pt-1.5 mt-1 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-sky-700 font-black uppercase text-[9px] tracking-wide">Total per Installment</span>
                            <span className="font-black text-sky-700">{qeNonVatFeesPerInst.toLocaleString()} SAR</span>
                          </div>
                          {qeFeesPaidThisInst > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-emerald-600 font-bold text-[9px]">Already Paid This Period</span>
                              <span className="font-black text-emerald-600">−{qeFeesPaidThisInst.toLocaleString()} SAR</span>
                            </div>
                          )}
                          {qeFeesPaidThisInst > 0 && (
                            <div className="flex justify-between text-xs bg-sky-100 rounded-lg px-2 py-1">
                              <span className="text-sky-800 font-black uppercase text-[9px] tracking-wide">Remaining Due</span>
                              <span className="font-black text-sky-800">{Math.max(0, qeNonVatFeesPerInst - qeFeesPaidThisInst).toLocaleString()} SAR</span>
                            </div>
                          )}
                        </div>
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
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                      placeholder="0.00"/>
                  </div>
                  {qeErrors.amount && <p className="text-[10px] text-rose-500 font-bold -mt-2">{qeErrors.amount}</p>}

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
           <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-3xl animate-bounce-in">
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
          ? ((tx as any).customerName || tx.unitNumber || tx.buildingName || '-')
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
                    <span className="font-black text-slate-800">{excl.toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">VAT ({tx.vatRate ?? 15}%)</span>
                    <span className="font-black text-emerald-600">+{vatAmt.toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-1.5 border-t border-slate-200">
                    <span className="font-black text-slate-700 uppercase tracking-wide">Total</span>
                    <span className="font-black text-blue-700">{total.toLocaleString()} SAR</span>
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

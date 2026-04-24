import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, TransactionType, TransactionStatus, ExpenseCategory, PaymentMethod, Building, Customer, Vendor } from '../types';
import { getTransactions, saveTransaction, getBuildings, getCustomers, getActiveContract, getVendors, createCreditNote, deleteTransaction, getContracts, saveContract } from '../services/firestoreService';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { isValidSaudiVAT } from '../utils/validators';
import SearchableSelect from './SearchableSelect';
import AddVendorDialog from './AddVendorDialog';
import { FileText, Download, Calendar, Receipt, TrendingUp, TrendingDown, X, QrCode, FileDown, Send, CheckCircle, AlertCircle, Loader, Eye, Plus, User, Sparkles, RotateCcw, FileUp, Trash2, ArrowLeftRight } from 'lucide-react';
import PdfPurchaseImport from './PdfPurchaseImport';
import { fmtDate } from '../utils/dateFormat';
import { auth } from '../firebase';
import { useLanguage } from '../i18n';

const ZATCA_SERVICE_URL = (import.meta as any).env?.VITE_ZATCA_SERVICE_URL || 'http://localhost:3002';

const companyName = '��´��±�"���© ��§��±��§��± �"⬦�"Š�"�~�"Š�"⬠�"Š�"� �"⬦ ��§�"�~�"⬦��­��¯�"� ��¯��©';
const companyNameEn = 'RR MILLENNIUM CO. LTD';
const companyVAT = '312610089400003';
const companyAddress = 'Dammam, Saudi Arabia';

const VATReport: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { t, isRTL } = useLanguage();

  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filteredVATTransactions, setFilteredVATTransactions] = useState<Transaction[]>([]);
  const [reportView, setReportView] = useState<'SALES' | 'PURCHASE' | 'COMBINED' | 'COMPARE'>('COMBINED');
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [zatcaSending, setZatcaSending] = useState<Record<string, boolean>>({});
  const [zatcaStatus, setZatcaStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [invoiceModal, setInvoiceModal] = useState<Transaction | null>(null);

  // Quick Entry state
  const [showQE, setShowQE] = useState(false);
  const [qeType, setQeType] = useState<'SALES' | 'EXPENSE'>('SALES');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [qeDate, setQeDate] = useState(new Date().toISOString().split('T')[0]);
  const [qeAmount, setQeAmount] = useState('');
  const [qeAmountIsIncl, setQeAmountIsIncl] = useState(false);
  const [qeDetails, setQeDetails] = useState('');
  const [qePaymentMethod, setQePaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [qeBuildingId, setQeBuildingId] = useState('');
  const [qeUnitNumber, setQeUnitNumber] = useState('');
  const [qeCustomerVAT, setQeCustomerVAT] = useState('');
  const [qeVendorName, setQeVendorName] = useState('');
  const [qeVendorVAT, setQeVendorVAT] = useState('');
  
  const [qeCategory, setQeCategory] = useState<ExpenseCategory>(ExpenseCategory.VENDOR_PAYMENT);
  const [qeSubCategory, setQeSubCategory] = useState('');
  const [qeSaving, setQeSaving] = useState(false);
  const [qeErrors, setQeErrors] = useState<{ customerVAT?: string; vendorVAT?: string; vendorName?: string; amount?: string }>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [qeContractCustomer, setQeContractCustomer] = useState<Customer | null>(null);
  const [qeVatAutoFilled, setQeVatAutoFilled] = useState(false);
  const [qeContractLookupLoading, setQeContractLookupLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [qeVendorId, setQeVendorId] = useState('');
  
  const [qeActiveContract, setQeActiveContract] = useState<any>(undefined);
  const [qeContractStats, setQeContractStats] = useState({ paid: 0, remaining: 0, installmentNo: 1 });
  const [qeCurrentInstallmentRemaining, setQeCurrentInstallmentRemaining] = useState<number>(0);
  const [qeContractPayments, setQeContractPayments] = useState<any[]>([]);
  const [qeCalculatedAmt, setQeCalculatedAmt] = useState('');

const [qeVendorAutoFilled, setQeVendorAutoFilled] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [qeVendorRefNo, setQeVendorRefNo] = useState('');
  const [qePurchaseBuildingId, setQePurchaseBuildingId] = useState('');
  // Wrong-entry reversal â��⬝ temporary correction feature
  const [reversalTarget, setReversalTarget] = useState<Transaction | null>(null);
  const [reversalSaving, setReversalSaving] = useState(false);
  // PDF purchase import
  const [showPdfImport, setShowPdfImport] = useState(false);
  // Bulk select / delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Compare view
  const [compareDateFrom, setCompareDateFrom] = useState('');
  const [compareDateTo, setCompareDateTo] = useState('');
  const [comparePreview, setComparePreview] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
    Promise.all([getBuildings(), getCustomers(), getVendors()]).then(([b, c, v]) => {
      setBuildings(b || []);
      setCustomers(c || []);
      setVendors((v || []).filter((vn: Vendor) => vn.status !== 'Inactive'));
    });
  }, []);

  const loadData = async () => {
    const txs = await getTransactions();
    setTransactions(txs || []);
  };

  const nonResidentialBuildings = buildings.filter(b => b.propertyType === 'NON_RESIDENTIAL');

  // True when the current Quick Entry modal will produce a VAT-eligible transaction
  const isCurrentVatEntry = qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT);

  // Sub-category options per expense category
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

  // Derive units list from selected building for Quick Entry dropdown
  const selectedQEBuilding = buildings.find(b => b.id === qeBuildingId);
  const qeBuildingUnits: string[] = selectedQEBuilding
    ? (selectedQEBuilding.units || []).map((u: any) =>
        typeof u === 'string' ? u : (u?.name || String(u))
      ).filter(Boolean)
    : [];

  // Reset unit + VAT when building changes
  const handleQEBuildingChange = (id: string) => {
    setQeBuildingId(id);
    setQeUnitNumber('');
    setQeCustomerVAT('');
    setQeContractCustomer(null);
    setQeVatAutoFilled(false);
  };

  // When unit is selected, look up active contract â⬠�" customer â⬠�" auto-fill VAT
  const handleQEUnitChange = useCallback(async (unit: string) => {
    setQeUnitNumber(unit);
    setQeContractCustomer(null);
    setQeVatAutoFilled(false);
    if (!unit || !qeBuildingId) return;
    setQeContractLookupLoading(true);
    try {
      
        const contract = await getActiveContract(qeBuildingId, unit);
        if (contract) {
          setQeActiveContract(contract);
          
          // Compute payments for contract
          const prevPayments = transactions.filter(t => t.contractId === (contract as any).id && (t.status === 'APPROVED' || !t.status));
          const totalPaid = prevPayments.reduce((sum, t) => sum + t.amount + ((t as any).discountAmount || 0), 0);
          const upfrontPaid = Number((contract as any).upfrontPaid || 0);
          const totalPaidEffective = totalPaid + upfrontPaid;
          const totalValueStored = Number(contract.totalValue || 0);
          const remaining = Math.max(0, totalValueStored - totalPaidEffective);
          setQeContractPayments(prevPayments);
          
          const totalInst = contract.installmentCount || 1;
          const otherInstAmt = Number(contract.otherInstallment || 0);
          let firstInstAmt = Number(contract.firstInstallment || 0) + upfrontPaid;
          if (firstInstAmt === 0 && totalInst > 0) {
              firstInstAmt = totalValueStored > 0 ? totalValueStored / totalInst : 0;
          }
          
          let currentInstallment = 1;
          let cumulated = firstInstAmt;
          while (totalPaidEffective >= cumulated && currentInstallment < totalInst) {
              currentInstallment++;
              cumulated += otherInstAmt > 0 ? otherInstAmt : firstInstAmt;
          }
          
          setQeContractStats({ paid: totalPaidEffective, remaining, installmentNo: currentInstallment });
          
          const isPartial = totalPaidEffective > (cumulated - (currentInstallment === 1 ? firstInstAmt : otherInstAmt)) && totalPaidEffective < cumulated;
          const currentInstallmentRemainingValue = Math.max(0, cumulated - totalPaidEffective);
          setQeCurrentInstallmentRemaining(currentInstallmentRemainingValue);
          
          if (currentInstallmentRemainingValue > 0) {
              setQeAmount(currentInstallmentRemainingValue.toString());
              setQeCalculatedAmt(currentInstallmentRemainingValue.toString());
          }
          const instText = (currentInstallment === 1 ? `1st Payment (Rent+Fees)` : `Installment ${currentInstallment} of ${totalInst}`);
          setQeDetails(isPartial ? `Balance Payment - Installment ${currentInstallment} - ${contract.customerName}` : `${instText} - ${contract.customerName}`);
          

        const cust = customers.find(c => c.id === contract.customerId) ||
          customers.find(c => (c.nameEn || c.nameAr) === contract.customerName);
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
  }, [qeBuildingId, customers]);

  const handleQuickEntrySave = async () => {
    const amt = parseFloat(qeAmount);
    const errors: { customerVAT?: string; vendorVAT?: string; vendorName?: string; amount?: string } = {};
    // Strict validation for VAT/customer/vendor fields
    if (isCurrentVatEntry) {
      if (qeType === 'SALES') {
        if (qeCustomerVAT && !isValidSaudiVAT(qeCustomerVAT)) {
          errors.customerVAT = 'Invalid Saudi VAT number (must be 15 digits, start with 3)';
        }
      } else if (qeType === 'EXPENSE') {
        if (!qeVendorName) {
          errors.vendorName = 'Vendor name is required';
        }
        if (qeVendorVAT && !isValidSaudiVAT(qeVendorVAT)) {
          errors.vendorVAT = 'Invalid Saudi VAT number (must be 15 digits, start with 3)';
        }
      }
    }
    if (!amt || amt <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    setQeErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setQeSaving(true);
    try {
      const selectedBuilding = buildings.find(b => b.id === qeBuildingId);
      const uid = auth.currentUser?.uid || 'direct-entry';

      // Sales with no customer VAT â⬠�" plain normal transaction, not VAT / ZATCA
      const isVatEntry = qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT);

      let tx: Omit<Transaction, 'id'>;

      if (isVatEntry) {
        const vatRate = 15;
        const amountExcludingVAT = qeAmountIsIncl ? amt / 1.15 : amt;
        const vatAmount = amountExcludingVAT * vatRate / 100;
        const amountIncludingVAT = amountExcludingVAT + vatAmount;
        const invNum = `INV-${Date.now().toString(36).toUpperCase()}`;

        tx = {
          type: qeType === 'SALES' ? TransactionType.INCOME : TransactionType.EXPENSE,
          date: qeDate,
          amount: amountExcludingVAT,
          paymentMethod: qePaymentMethod,
          details: qeDetails || (qeType === 'SALES' ? 'Rental Income (VAT)' : 'Purchase Expense (VAT)'),
          status: TransactionStatus.APPROVED,
          userId: uid,
          isVATApplicable: true,
          vatRate,
          vatAmount: Math.round(vatAmount * 100) / 100,
          amountExcludingVAT: Math.round(amountExcludingVAT * 100) / 100,
          amountIncludingVAT: Math.round(amountIncludingVAT * 100) / 100,
          totalWithVat: Math.round(amountIncludingVAT * 100) / 100,
          vatInvoiceNumber: invNum,
          ...(qeType === 'SALES'
            ? {
                buildingId: qeBuildingId,
                buildingName: selectedBuilding?.name || '',
                unitNumber: qeUnitNumber,
                customerVATNumber: qeCustomerVAT,
              }
            : {
                expenseCategory: qeCategory,
                expenseSubCategory: qeSubCategory || undefined,
                vendorName: qeVendorName,
                vendorVATNumber: qeVendorVAT,
                vendorId: qeVendorId || undefined,
                vendorRefNo: qeVendorRefNo || undefined,
                buildingId: qePurchaseBuildingId || undefined,
                buildingName: qePurchaseBuildingId ? (buildings.find(b => b.id === qePurchaseBuildingId)?.name || '') : undefined,
                vatReportOnly: true, // Purchase entries stay in VAT Report only, not in History/Accounting
              }),
        } as any;
      } else {
        // No customer VAT â��⬝ save as a plain income transaction, skip ZATCA entirely
        tx = {
          type: TransactionType.INCOME,
          date: qeDate,
          amount: amt,
          paymentMethod: qePaymentMethod,
          details: qeDetails || 'Rental Income',
          status: TransactionStatus.APPROVED,
          userId: uid,
          isVATApplicable: false,
          buildingId: qeBuildingId,
          buildingName: selectedBuilding?.name || '',
          unitNumber: qeUnitNumber,
        } as any;
      }

      await saveTransaction(tx as Transaction);
      await loadData();
      setShowQE(false);
      setQeAmount('');
      setQeDetails('');
      setQeCustomerVAT('');
      setQeVendorName('');
      setQeVendorVAT('');
      setQeVendorId('');
      setQeVendorAutoFilled(false);
      setQeVendorRefNo('');
      setQePurchaseBuildingId('');
      setQeSubCategory('');
      setQeUnitNumber('');
      setQeBuildingId('');
      setQeContractCustomer(null);
      setQeVatAutoFilled(false);
    } finally {
      setQeSaving(false);
    }
  };

  // -- Shared helper: create credit note + auto-report to ZATCA --
  const createAndReportCreditNote = async (original: Transaction) => {
    const cn = await createCreditNote(original);
    try {
      const zatcaUrl = ((import.meta as any).env?.VITE_ZATCA_SERVICE_URL || 'http://localhost:3002') + '/zatca/sign-and-report';
      const cnPayload = {
        invoiceNumber: cn.vatInvoiceNumber,
        issueDate: cn.date,
        buyerName: cn.unitNumber || cn.buildingName || '',
        buyerVAT: (cn as any).customerVATNumber || '',
        amount: -(Math.abs((cn as any).amountExcludingVAT ?? cn.amount ?? 0)),
        vatRate: (cn as any).vatRate ?? 15,
        description: cn.details || 'Credit Note',
        isCreditNote: true,
        originalInvoiceId: original.vatInvoiceNumber,
      };
      let qrCode = '';
      try {
        const res = await fetch(zatcaUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cnPayload), signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (res.ok && data.qrCode) qrCode = data.qrCode;
      } catch {
        const getHex = (str: string) => Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2,'0')).join('');
        const toHex  = (n: number) => n.toString(16).padStart(2,'0');
        const bLen   = (s: string) => new TextEncoder().encode(s).length;
        const tags   = ['Company','300000000000003', new Date(cn.date).toISOString().replace('T',' ').substring(0,19)+'Z', cnPayload.amount.toFixed(2),(-(Math.abs((cn as any).vatAmount||0))).toFixed(2)];
        let hex=''; tags.forEach((v,i)=>{ hex+=toHex(i+1)+toHex(bLen(v))+getHex(v); });
        const bytes=new Uint8Array(hex.length/2);
        for(let i=0;i<bytes.length;i++) bytes[i]=parseInt(hex.substring(i*2,i*2+2),16);
        qrCode=btoa(String.fromCharCode(...bytes));
      }
      if (qrCode) await saveTransaction({ ...cn, zatcaQRCode: qrCode, zatcaReportedAt: new Date().toISOString() });
    } catch { /* non-fatal */ }

    //    Undo rent: reduce upfrontPaid on the linked contract   
    const contractId = original.contractId;
    if (contractId) {
      try {
        const allContracts = await getContracts();
        const contract = allContracts.find((c: any) => c.id === contractId);
        if (contract) {
          const paidSoFar = Number((contract as any).upfrontPaid || 0);
          const invoiceAmt = Math.abs(Number(original.amountIncludingVAT || original.totalWithVat || original.amount || 0));
          const newPaid = Math.max(0, paidSoFar - invoiceAmt);
          await saveContract({ ...contract, upfrontPaid: newPaid });
        }
      } catch { /* non-fatal */ }
    }

    return cn;
  };

  // Wrong-entry reversal handler (creates CN + reports to ZATCA + generates QR)
  const handleCreateReversal = async () => {
    if (!reversalTarget) return;
    setReversalSaving(true);
    try {
      await createAndReportCreditNote(reversalTarget);
      await loadData();
      setReversalTarget(null);
    } finally {
      setReversalSaving(false);
    }
  };

  // Bulk delete: sales invoices get a credit note; others are hard-deleted
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const txMap = Object.fromEntries(transactions.map(t => [t.id, t]));
      await Promise.all([...selectedIds].map(async (id) => {
        const tx = txMap[id];
        if (tx && tx.isVATApplicable && tx.vatInvoiceNumber && !(tx as any).isCreditNote && tx.type === TransactionType.INCOME) {
          await createAndReportCreditNote(tx);
        } else {
          await deleteTransaction(id);
        }
      }));
      setSelectedIds(new Set());
      await loadData();
    } finally {
      setBulkDeleting(false);
    }
  };

  // -- Compare tab: imported PDF invoices vs regular history expenses --
  const importedExpenses = transactions.filter(t => (t as any).vatReportOnly && t.type === TransactionType.EXPENSE);
  const historyExpenses = transactions.filter(t =>
    !(t as any).vatReportOnly &&
    t.type === TransactionType.EXPENSE &&
    (!compareDateFrom || t.date >= compareDateFrom) &&
    (!compareDateTo   || t.date <= compareDateTo)
  );
  const inclAmt = (t: Transaction) =>
    Math.round((t.amountIncludingVAT || t.totalWithVat || t.amount || 0) * 100) / 100;
  const importedInclSet = new Set(importedExpenses.map(inclAmt));
  const historyInclSet  = new Set(historyExpenses.map(inclAmt));
  const matchedCount = importedExpenses.filter(t => historyInclSet.has(inclAmt(t))).length;

  // Compare/list delete: sales invoices get a CN + ZATCA report; others are hard-deleted
  const handleCompareDelete = async (tx: Transaction) => {
    const isSalesInv = tx.isVATApplicable && tx.vatInvoiceNumber && !(tx as any).isCreditNote && tx.type === TransactionType.INCOME;
    const confirmMsg = isSalesInv
      ? 'This is a reported VAT sales invoice. A Credit Note will be created and sent to ZATCA. Continue?'
      : `Delete "${tx.vatInvoiceNumber || tx.details || 'entry'}"? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    if (isSalesInv) {
      await createAndReportCreditNote(tx);
    } else {
      await deleteTransaction(tx.id);
    }
    await loadData();
  };


  const handleUpdatePaymentMethod = async (id: string, method: PaymentMethod) => {
    await setDoc(doc(db, 'transactions', id), { paymentMethod: method }, { merge: true } as any);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, paymentMethod: method } : t));
  };

  const allFilteredSelected =
    filteredVATTransactions.length > 0 &&
    filteredVATTransactions.every(t => selectedIds.has(t.id));

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

  const handleSendToZatca = async (t: Transaction) => {
    if (t.type === TransactionType.EXPENSE) return;
    setZatcaSending(prev => ({ ...prev, [t.id]: true }));
    try {
      const payload = {
        invoiceNumber: t.vatInvoiceNumber,
        issueDate: t.date,
        buyerName: t.unitNumber || t.buildingName || '',
        buyerVAT: t.customerVATNumber || '',
        amount: t.amountExcludingVAT ?? t.amount ?? 0,
        vatRate: t.vatRate ?? 15,
        description: t.details || (t.buildingName ? `Rental - ${t.buildingName}` : 'Property Services'),
        isCreditNote: t.isCreditNote ?? false,
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
      const updated: Transaction = { ...t, zatcaQRCode: data.qrCode };
      await saveTransaction(updated);
      setTransactions(prev => prev.map(tx => tx.id === t.id ? updated : tx));
      const ok = data.zatcaStatus >= 200 && data.zatcaStatus < 300;
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok, msg: ok ? `Reported Phase 2 (HTTP ${data.zatcaStatus})` : `HTTP ${data.zatcaStatus}` } }));
      setInvoiceModal(updated);
    } catch (err: any) {
      // Service not reachable - fallback to Phase 1 offline QR
      const isNetworkErr = err instanceof TypeError || err.name === 'TimeoutError' || err.name === 'AbortError';
      if (isNetworkErr) {
        try {
          const getHex = (str: string) => Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('');
          const toHex = (n: number) => n.toString(16).padStart(2, '0');
          const byteLen = (s: string) => new TextEncoder().encode(s).length;
          const seller    = companyName || 'Company';
          const sellerVat = companyVAT  || '300000000000003';
          const ts        = new Date(t.date).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
          const total     = (t.amountIncludingVAT || t.totalWithVat || t.amount || 0).toFixed(2);
          const vat       = (t.vatAmount || 0).toFixed(2);
          const tags      = [seller, sellerVat, ts, total, vat];
          let hex = '';
          tags.forEach((v, i) => { hex += toHex(i + 1) + toHex(byteLen(v)) + getHex(v); });
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
          const qrCode = btoa(String.fromCharCode(...bytes));
          const updated: Transaction = { ...t, zatcaQRCode: qrCode };
          await saveTransaction(updated);
          setTransactions(prev => prev.map(tx => tx.id === t.id ? updated : tx));
          setZatcaStatus(prev => ({ ...prev, [t.id]: { ok: false, msg: 'ZATCA service offline - Phase 1 QR saved. Start signing service to report Phase 2.' } }));
          setInvoiceModal(updated);
          return;
        } catch { /* ignore fallback error */ }
      }
      setZatcaStatus(prev => ({ ...prev, [t.id]: { ok: false, msg: err.message } }));
    } finally {
      setZatcaSending(prev => ({ ...prev, [t.id]: false }));
    }
  };

  useEffect(() => {
    let filtered = transactions.filter(t => t.isVATApplicable === true);
    
    if (reportView === 'SALES') {
      filtered = filtered.filter(t => t.type === TransactionType.INCOME);
    } else if (reportView === 'PURCHASE') {
      filtered = filtered.filter(t => t.type === TransactionType.EXPENSE);
    }
    
    if (filterFromDate) {
      filtered = filtered.filter(t => t.date >= filterFromDate);
    }
    if (filterToDate) {
      filtered = filtered.filter(t => t.date <= filterToDate);
    }
    
    setFilteredVATTransactions(filtered);
  }, [transactions, filterFromDate, filterToDate, reportView]);

  const salesTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.INCOME);
  const purchaseTransactions = filteredVATTransactions.filter(t => t.type === TransactionType.EXPENSE);
  
  const salesVAT = salesTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const purchaseVAT = purchaseTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const netVATPayable = salesVAT - purchaseVAT;

  const totalVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  const totalExcludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountExcludingVAT || t.amount), 0);
  const totalIncludingVAT = filteredVATTransactions.reduce((sum, t) => sum + (t.amountIncludingVAT || t.totalWithVat || t.amount), 0);

  const handleExportPDF = () => {
    const reportName = reportView === 'SALES' ? 'Sales_VAT_Report' : reportView === 'PURCHASE' ? 'Purchase_VAT_Report' : 'Combined_VAT_Report';
    const dateRange = filterFromDate && filterToDate ? `_${filterFromDate}_to_${filterToDate}` : '';
    const title = `${reportName}${dateRange}_${new Date().toISOString().split('T')[0]}`;

    const printWindow = window.open('', 'VAT_PRINT', 'height=900,width=1300');
    if (!printWindow) return;

    const isCombined = reportView === 'COMBINED';

    // Amount helpers
    const amtExcl = (tx: Transaction) => tx.amountExcludingVAT || tx.amount || 0;
    const amtVat  = (tx: Transaction) => tx.vatAmount || 0;
    const amtIncl = (tx: Transaction) => tx.amountIncludingVAT || tx.totalWithVat || tx.amount || 0;
    const isCredit = (tx: Transaction) => tx.type === TransactionType.INCOME && !tx.isCreditNote;

    // â⬝��â⬝�� Combined: debit / credit split â��⬝ VAT 15% only â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��
    const rowsHtml = isCombined
      ? filteredVATTransactions.map(tx => {
          const dr = !isCredit(tx);
          const vat = amtVat(tx).toLocaleString();
          const blank = '<td style="padding:8px;text-align:right;color:#ccc;">â��⬝</td>';
          const val = (v: string, color: string) =>
            `<td style="padding:8px;text-align:right;font-weight:700;color:${color}">${v}</td>`;
          return `
            <tr style="background:${dr ? '#fff8f8' : '#f8fffb'}">
              <td style="padding:8px;">${fmtDate(tx.date)}</td>
              <td style="padding:8px;font-weight:700;color:${dr ? '#be123c' : '#065f46'}">
                ${tx.isCreditNote ? 'CREDIT NOTE' : (dr ? 'PURCHASE' : 'SALE')}
              </td>
              <td style="padding:8px;">${tx.vatInvoiceNumber || 'N/A'}</td>
              <td style="padding:8px;">${dr ? (tx.vendorName || 'N/A') : (tx.unitNumber || 'N/A')}</td>
              <td style="padding:8px;">${dr ? (tx.vendorVATNumber || 'N/A') : (tx.customerVATNumber || 'N/A')}</td>
              ${dr ? val(vat, '#be123c') : blank}
              ${!dr ? val(vat, '#065f46') : blank}
              <td style="padding:8px;">${tx.paymentMethod || 'â��⬝'}</td>
            </tr>`;
        }).join('')
      // â⬝��â⬝�� Sales / Purchase only: original layout â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��
      : filteredVATTransactions.map(tx => `
          <tr>
            <td style="padding:8px;">${fmtDate(tx.date)}</td>
            <td style="padding:8px;">${tx.isCreditNote ? 'CREDIT NOTE' : (tx.type === 'INCOME' ? 'SALE' : 'PURCHASE')}</td>
            <td style="padding:8px;">${tx.vatInvoiceNumber || 'N/A'}</td>
            <td style="padding:8px;">${tx.type === 'INCOME' ? (tx.unitNumber || 'N/A') : (tx.vendorName || 'N/A')}</td>
            <td style="padding:8px;">${tx.type === 'INCOME' ? (tx.customerVATNumber || 'N/A') : (tx.vendorVATNumber || 'N/A')}</td>
            <td style="padding:8px;text-align:right">${amtExcl(tx).toLocaleString()}</td>
            <td style="padding:8px;text-align:right">${amtVat(tx).toLocaleString()}</td>
            <td style="padding:8px;text-align:right">${amtIncl(tx).toLocaleString()}</td>
            <td style="padding:8px;">${tx.paymentMethod || 'â��⬝'}</td>
          </tr>`).join('');

    // Totals
    const purchases = filteredVATTransactions.filter(t => t.type === TransactionType.EXPENSE || t.isCreditNote);
    const sales     = filteredVATTransactions.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote);
    const sum = (arr: Transaction[], fn: (t: Transaction) => number) =>
      arr.reduce((s, t) => s + fn(t), 0).toLocaleString();

    const totalExcl = sum(filteredVATTransactions, amtExcl);
    const totalVat  = sum(filteredVATTransactions, amtVat);
    const totalIncl = sum(filteredVATTransactions, amtIncl);

    const drVat = sum(purchases, amtVat);
    const crVat = sum(sales, amtVat);
    const netVat = (sales.reduce((s,t)=>s+amtVat(t),0) - purchases.reduce((s,t)=>s+amtVat(t),0)).toLocaleString();

    const combinedTfoot = `
      <tr style="background:#eff6ff">
        <td colspan="5" style="padding:10px;text-align:right;font-weight:800">Total Input VAT (Purchases):</td>
        <td style="padding:10px;text-align:right;font-weight:800;color:#be123c">${drVat} SAR</td>
        <td></td><td></td>
      </tr>
      <tr style="background:#f0fdf4">
        <td colspan="5" style="padding:10px;text-align:right;font-weight:800">Total Output VAT (Sales):</td>
        <td></td>
        <td style="padding:10px;text-align:right;font-weight:800;color:#065f46">${crVat} SAR</td>
        <td></td>
      </tr>
      <tr style="background:#fefce8;border-top:3px solid #ca8a04">
        <td colspan="5" style="padding:12px;text-align:right;font-weight:900;font-size:13px">Net VAT Payable (Output â� �" Input):</td>
        <td colspan="2" style="padding:12px;text-align:right;font-weight:900;font-size:14px;color:#92400e">${netVat} SAR</td>
        <td></td>
      </tr>`;

    const simpleTfoot = `
      <tr>
        <td colspan="5" style="padding:12px;text-align:right;font-weight:800">Totals:</td>
        <td style="padding:12px;text-align:right;font-weight:800">${totalExcl} SAR</td>
        <td style="padding:12px;text-align:right;font-weight:800">${totalVat} SAR</td>
        <td style="padding:12px;text-align:right;font-weight:800">${totalIncl} SAR</td>
        <td></td>
      </tr>`;

    // Headers
    const combinedHeaders = `
      <tr>
        <th style="width:90px">Date</th>
        <th style="width:90px">Type</th>
        <th>Invoice #</th>
        <th>Party</th>
        <th>VAT #</th>
        <th style="text-align:right;background:#fff1f2;color:#be123c">&#9660; VAT (Purchase)</th>
        <th style="text-align:right;background:#f0fdf4;color:#065f46">&#9650; VAT (Sale)</th>
        <th>Payment</th>
      </tr>`;

    const simpleHeaders = `
      <tr>
        <th style="width:100px">Date</th>
        <th style="width:120px">Type</th>
        <th>Invoice #</th>
        <th>Party</th>
        <th>VAT #</th>
        <th style="text-align:right">Excl. VAT</th>
        <th style="text-align:right">VAT 15%</th>
        <th style="text-align:right">Incl. VAT</th>
        <th>Payment</th>
      </tr>`;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background: #fff; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { width: 140px; height: auto; margin: 0 auto 8px; }
            .title { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
            .subtitle { color: #334155; margin-bottom: 12px; }
            .watermark { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            thead th { background: #f1f5f9; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
            tbody td { border-bottom: 1px solid #e6eef8; }
            tfoot td { font-weight: 800; border-top: 2px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="watermark"><img src="${window.location.origin}/images/logo.png" style="width:360px;opacity:0.04;"/></div>
          <div class="header">
            <img src="${window.location.origin}/images/cologo.png" class="logo" />
            <div class="title">VAT Report - KSA (ZATCA)</div>
            <div class="subtitle">${reportView} ${filterFromDate && filterToDate ? `| ${filterFromDate} - ${filterToDate}` : ''}</div>
          </div>

          <table>
            <thead>
              ${isCombined ? combinedHeaders : simpleHeaders}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              ${isCombined ? combinedTfoot : simpleTfoot}
            </tfoot>
          </table>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const reportName = reportView === 'SALES' ? 'Sales' : reportView === 'PURCHASE' ? 'Purchase' : 'Combined';
    const headers = [
      'Date', 'Type', 'Invoice Number', reportView === 'SALES' ? 'Customer' : 'Vendor', 
      reportView === 'SALES' ? 'Customer VAT#' : 'Vendor VAT#',
      'Amount Excluding VAT', 'VAT Amount (15%)', 'Amount Including VAT', 
      'Building', 'Category', 'Details', 'ZATCA QR Code'
    ];
    
    const rows = filteredVATTransactions.map(tx => [
      tx.date,
      tx.type,
      tx.vatInvoiceNumber || 'N/A',
      tx.type === TransactionType.INCOME ? (tx.unitNumber || 'N/A') : (tx.vendorName || 'N/A'),
      tx.type === TransactionType.INCOME ? (tx.customerVATNumber || 'N/A') : (tx.vendorVATNumber || 'N/A'),
      (tx.amountExcludingVAT || tx.amount).toFixed(2),
      (tx.vatAmount || 0).toFixed(2),
      (tx.amountIncludingVAT || tx.totalWithVat || tx.amount).toFixed(2),
      tx.buildingName || 'General',
      tx.expenseCategory || 'N/A',
      tx.details || '',
      tx.zatcaQRCode || 'N/A'
    ]);
    
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VAT_${reportName}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="premium-card p-5 sm:p-6 mb-4">
        <div className="flex justify-between items-center pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
                <FileText className="text-white" size={24} />
              </div>
              {t('vat.title')}
            </h2>
            <p className="text-sm text-slate-500 mt-2">{t('vat.subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowQE(true)}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> {t('vat.newEntry')}
            </button>
            <button 
              onClick={handleExportCSV} 
              className="px-5 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2"
            >
              <Download size={18} /> CSV
            </button>
            <button 
              onClick={handleExportPDF} 
              className="px-5 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700 transition-all flex items-center gap-2"
            >
              <FileDown size={18} /> PDF
            </button>
            <button
              onClick={() => setShowPdfImport(true)}
              className="px-5 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg hover:bg-amber-700 transition-all flex items-center gap-2"
              title="Import purchase invoices from a PDF table"
            >
              <FileUp size={18} /> Import PDF
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="mt-6 flex gap-2">
          <button 
            onClick={() => setReportView('COMBINED')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${reportView === 'COMBINED' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t('vat.combinedReport')}
          </button>
          <button 
            onClick={() => setReportView('SALES')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${reportView === 'SALES' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingUp size={16} /> {t('vat.salesReport')}
          </button>
          <button 
            onClick={() => setReportView('PURCHASE')} 
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${reportView === 'PURCHASE' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingDown size={16} /> {t('vat.purchaseReport')}
          </button>
          <div className="w-px bg-slate-200 mx-1 self-stretch" />
          <button
            onClick={() => setReportView('COMPARE')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${reportView === 'COMPARE' ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ArrowLeftRight size={16} /> Compare
          </button>
        </div>

        {reportView === 'COMBINED' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-600 uppercase mb-2">{t('vat.salesVat')}</div>
              <div className="text-3xl font-black text-emerald-700">
                {salesVAT.toLocaleString()} <span className="text-sm text-emerald-400">{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-rose-50 p-6 rounded-xl border border-rose-200">
              <div className="text-xs font-bold text-rose-600 uppercase mb-2">{t('vat.purchaseVat')}</div>
              <div className="text-3xl font-black text-rose-700">
                {purchaseVAT.toLocaleString()} <span className="text-sm text-rose-400">{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-blue-600 uppercase mb-2">{t('vat.netVatPayable')}</div>
              <div className="text-3xl font-black text-blue-700">
                {netVATPayable.toLocaleString()} <span className="text-sm text-blue-400">{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">{t('vat.totalTransactions')}</div>
              <div className="text-3xl font-black text-slate-800">
                {filteredVATTransactions.length}
              </div>
            </div>
          </div>
        )}

        {reportView !== 'COMBINED' && reportView !== 'COMPARE' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">{t('vat.totalExclVat')}</div>
              <div className="text-3xl font-black text-slate-800">
                {totalExcludingVAT.toLocaleString()} <span className="text-sm text-slate-400">{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-blue-600 uppercase mb-2">{t('vat.totalVat')}</div>
              <div className="text-3xl font-black text-blue-700">
                {totalVAT.toLocaleString()} <span className="text-sm text-blue-400">{t('common.sar')}</span>
              </div>
            </div>
            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-600 uppercase mb-2">{t('vat.totalInclVat')}</div>
              <div className="text-3xl font-black text-emerald-700">
                {totalIncludingVAT.toLocaleString()} <span className="text-sm text-emerald-400">{t('common.sar')}</span>
              </div>
            </div>
          </div>
        )}

        {reportView !== 'COMPARE' && (
          <div className="flex gap-4 items-center mt-6 pt-6 border-t border-slate-100">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              value={filterFromDate} 
              onChange={e => setFilterFromDate(e.target.value)} 
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
              placeholder={t('history.fromDate')}
            />
            <span className="text-slate-400">{t('vat.to')}</span>
            <input 
              type="date" 
              value={filterToDate} 
              onChange={e => setFilterToDate(e.target.value)} 
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
              placeholder={t('history.toDate')}
            />
            <button 
              onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} 
              className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200"
            >{t('common.reset')}</button>
          </div>
        )}
        {reportView === 'COMPARE' && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
                <div className="text-xs font-bold text-violet-600 uppercase mb-1">Imported PDF</div>
                <div className="text-2xl font-black text-violet-800">{importedExpenses.length}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Matched â��S</div>
                <div className="text-2xl font-black text-emerald-800">{matchedCount}</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                <div className="text-xs font-bold text-rose-600 uppercase mb-1">Unmatched</div>
                <div className="text-2xl font-black text-rose-800">{importedExpenses.length - matchedCount}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center bg-slate-50 rounded-xl p-3 border border-slate-200">
              <Calendar size={15} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-600">History Date Filter:</span>
              <input type="date" value={compareDateFrom} onChange={e => setCompareDateFrom(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={compareDateTo} onChange={e => setCompareDateTo(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium" />
              <button onClick={() => { setCompareDateFrom(''); setCompareDateTo(''); }} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100">Reset</button>
              <span className="text-xs text-slate-400 ml-1">{historyExpenses.length} history expense{historyExpenses.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {reportView !== 'COMPARE' && (
      <div className="premium-card p-4 sm:p-5 relative">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ opacity: 0.03 }}>
          <img src="/images/logo.png" alt="Watermark" className="w-96 h-96 object-contain" />
        </div>
        
        <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Receipt size={18} className="text-slate-400" /> 
            {reportView === 'SALES' ? t('vat.salesSection') : reportView === 'PURCHASE' ? t('vat.purchasesSection') : t('vat.allTransactions')} ({filteredVATTransactions.length})
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Select All toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="rounded w-4 h-4 cursor-pointer accent-rose-600"
              />
              {allFilteredSelected ? 'Deselect All' : 'Select All'}
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={() => {
                  if (!window.confirm(`Delete ${selectedIds.size} VAT entr${selectedIds.size === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
                  handleBulkDelete();
                }}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm disabled:opacity-60 shadow"
              >
                {bulkDeleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {bulkDeleting ? 'Deletingâ��¦' : `Delete ${selectedIds.size} Selected`}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredVATTransactions.map(tx => (
            <div key={tx.id} className={`border rounded-xl p-3 bg-white shadow-sm space-y-2 ${selectedIds.has(tx.id) ? 'border-rose-400 ring-1 ring-rose-300 bg-rose-50/30' : tx.isCreditNote ? 'border-slate-200 bg-rose-50/50' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(tx.id)}
                    onChange={() => toggleOne(tx.id)}
                    className="mt-0.5 rounded w-4 h-4 cursor-pointer accent-rose-600 flex-shrink-0"
                  />
                  <div>
                    <div className="text-[11px] font-mono text-slate-500">{fmtDate(tx.date)}</div>
                    <div className="font-bold text-slate-800 text-sm">{tx.vatInvoiceNumber || 'N/A'}</div>
                    <div className="text-[11px] text-slate-500">{tx.type === TransactionType.INCOME ? (tx.unitNumber ? `Unit ${tx.unitNumber}` : 'Sale') : (tx.vendorName || 'Purchase')}</div>
                    <div className="text-[11px] text-slate-500">{tx.buildingName || 'General'}</div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block ${tx.isCreditNote ? 'bg-rose-100 text-rose-700' : tx.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {tx.isCreditNote ? 'CREDIT NOTE' : tx.type === TransactionType.INCOME ? 'SALE' : 'PURCHASE'}
                  </span>
                  <div className="text-sm font-black text-slate-800">{(tx.amountExcludingVAT || tx.amount).toLocaleString()} <span className="text-[10px] text-slate-500">{t('common.sar')}</span></div>
                  <div className="text-[11px] font-bold text-blue-600">VAT: {(tx.vatAmount || 0).toLocaleString()} SAR</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <div className="font-mono">{tx.type === TransactionType.INCOME ? (tx.customerVATNumber || 'N/A') : (tx.vendorVATNumber || 'N/A')}</div>
                <div className="font-bold text-emerald-700">Incl: {(((tx.amountExcludingVAT || tx.amount || 0) + (tx.vatAmount || 0))).toLocaleString()} SAR</div>
              </div>
              <div className="flex gap-2 justify-end flex-wrap">
                <button onClick={() => window.location.hash = `/invoice/${tx.vatInvoiceNumber}`} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold flex items-center gap-1"><Eye size={12}/>{t('common.view')}</button>
                {/* ZATCA Phase 2 KSA: only SALES invoices are reported by the seller. Purchases = input VAT only. */}
                {tx.type === TransactionType.EXPENSE && !(tx as any).isCreditNote ? (
                  <>
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[11px] font-bold">
                      ðŸ�S¥ Input VAT
                    </span>
                    <button
                      onClick={() => setReversalTarget(tx)}
                      className="flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-100"
                      title="Entered by mistake? Create a reversal credit note"
                    >
                      <RotateCcw size={11}/> Wrong Entry?
                    </button>
                  </>
                ) : tx.isCreditNote ? (
                  <button
                    onClick={() => handleSendToZatca(tx)}
                    disabled={zatcaSending[tx.id]}
                    className={`p-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-60 ${tx.zatcaQRCode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-600 text-white'}`}
                  >
                    {zatcaSending[tx.id] ? <Loader size={12} className="animate-spin"/> : <Send size={12}/>}
                    {zatcaSending[tx.id] ? 'Sendingâ��¦' : tx.zatcaQRCode ? 'Re-send CN' : 'Send CN to ZATCA'}
                  </button>
                ) : tx.zatcaQRCode ? (
                  <button onClick={() => setInvoiceModal(tx)} className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold flex items-center gap-1"><CheckCircle size={12}/> ZATCA â��S</button>
                ) : (
                  <button
                    onClick={() => handleSendToZatca(tx)}
                    disabled={zatcaSending[tx.id]}
                    className="p-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
                  >
                    {zatcaSending[tx.id] ? <Loader size={12} className="animate-spin"/> : <Send size={12}/>}
                    {zatcaSending[tx.id] ? 'Sendingâ��¦' : 'Send to ZATCA'}
                  </button>
                )}
                {zatcaStatus[tx.id] && !zatcaSending[tx.id] && (
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${zatcaStatus[tx.id].ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{zatcaStatus[tx.id].msg}</span>
                )}
                {tx.isCreditNote && tx.originalInvoiceId && (
                  <span className="text-[10px] text-rose-600 px-2 py-1 bg-rose-50 rounded-lg">Ref: {tx.originalInvoiceId}</span>
                )}
              </div>
            </div>
          ))}
          {filteredVATTransactions.length === 0 && (
            <div className="px-3 py-6 text-center text-slate-400 text-sm">No VAT entries found.</div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="rounded w-4 h-4 cursor-pointer accent-rose-600"
                  />
                </th>
                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-10 text-center">#</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('common.date')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('history.type')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('entry.invoiceNum')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{reportView === 'SALES' ? t('vat.customer') : reportView === 'PURCHASE' ? t('vat.vendor') : t('vat.party')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('vat.vatHash')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('vat.exclVat')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('entry.vat15')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('vat.inclVat')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('vat.qr')}</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('vat.zatcaStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVATTransactions.map((tx, i) => (
                <tr key={tx.id} className={`hover:bg-slate-50 ${selectedIds.has(tx.id) ? 'bg-rose-50/40 ring-1 ring-inset ring-rose-200' : tx.isCreditNote ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="rounded w-4 h-4 cursor-pointer accent-rose-600"
                    />
                  </td>
                  <td className="px-3 py-4 text-xs font-bold text-slate-400 font-mono text-center">{i + 1}</td>
                  <td className="px-4 py-4 text-sm font-mono">{fmtDate(tx.date)}</td>
                  <td className="px-4 py-4 text-sm">
                    {tx.isCreditNote ? (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        CREDIT NOTE
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${tx.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tx.type === TransactionType.INCOME ? 'SALE' : 'PURCHASE'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <button 
                      onClick={() => window.location.hash = `/invoice/${tx.vatInvoiceNumber}`}
                      className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {tx.vatInvoiceNumber || 'N/A'}
                    </button>
                    {tx.isCreditNote && tx.originalInvoiceId && (
                      <div className="text-[10px] text-red-600 mt-1">Ref: {tx.originalInvoiceId}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="font-bold text-slate-800">
                      {tx.type === TransactionType.INCOME ? (tx.unitNumber ? `Unit ${tx.unitNumber}` : 'N/A') : (tx.vendorName || 'N/A')}
                    </div>
                    <div className="text-xs text-slate-500">{tx.buildingName || 'General'}</div>
                  </td>
                  <td className="px-4 py-4 text-sm font-mono text-slate-600">
                    {tx.type === TransactionType.INCOME ? (tx.customerVATNumber || 'N/A') : (tx.vendorVATNumber || 'N/A')}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-800">
                    {(tx.amountExcludingVAT || tx.amount).toLocaleString()} SAR
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-blue-600">
                    {(tx.vatAmount || 0).toLocaleString()} SAR
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-emerald-600">
                    {(tx.amountIncludingVAT || tx.totalWithVat || tx.amount).toLocaleString()} SAR
                  </td>
                  <td className="px-2 py-4">
                    <select
                      value={tx.paymentMethod || ''}
                      onChange={e => handleUpdatePaymentMethod(tx.id, e.target.value as PaymentMethod)}
                      className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-1.5 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value={PaymentMethod.BANK}>Bank</option>
                      <option value={PaymentMethod.CASH}>Cash</option>
                      {Object.values(PaymentMethod).filter(m => m !== PaymentMethod.BANK && m !== PaymentMethod.CASH).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {tx.type === TransactionType.EXPENSE ? (
                      <span className="text-slate-300"></span>
                    ) : tx.zatcaQRCode && !tx.isCreditNote ? (
                      <button 
                        onClick={() => setSelectedQRCode(tx.zatcaQRCode!)}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold hover:bg-emerald-100"
                      >
                        <QrCode size={14} />{t('common.view')}</button>
                    ) : tx.isCreditNote && tx.zatcaQRCode ? (
                      <button
                        onClick={() => setSelectedQRCode(tx.zatcaQRCode!)}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-semibold hover:bg-amber-100 border border-amber-200"
                      >
                        <QrCode size={14} />CN QR</button>
                    ) : tx.isCreditNote && !tx.zatcaQRCode ? (
                      <button
                        onClick={() => handleSendToZatca(tx)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold hover:bg-blue-100 border border-blue-200"
                      >
                        <Send size={11} />Send CN</button>
                    ) : <span className="text-slate-300"></span>}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {/* ZATCA Phase 2 KSA: only the SELLER reports invoices. Purchases = input VAT records only. */}
                    {tx.type === TransactionType.EXPENSE && !(tx as any).isCreditNote ? (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[10px] font-bold">ðŸ�S¥ {t('vat.inputVat')}</span>
                        <span className="text-[9px] text-slate-400">{t('vat.supplierReports')}</span>
                        <button
                          onClick={() => setReversalTarget(tx)}
                          className="flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-bold hover:bg-rose-100"
                        >
                          <RotateCcw size={10}/> {t('vat.wrongEntry')}
                        </button>
                      </div>
                    ) : tx.type === TransactionType.EXPENSE && (tx as any).isCreditNote ? (
                      // Purchase reversal â��⬝ internal correction only, never sent to ZATCA
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold">ðŸ⬝�~ {t('vat.purchaseReversal')}</span>
                        <span className="text-[9px] text-slate-400">{t('vat.internalCorrection')}</span>
                      </div>
                    ) : tx.isCreditNote ? (
                      <div className="flex flex-col gap-1">
                        {tx.zatcaQRCode && <span className="flex items-center gap-1 text-amber-600 font-bold text-[10px]">âš  Has stale QR</span>}
                        <button
                          onClick={() => handleSendToZatca(tx)}
                          disabled={zatcaSending[tx.id]}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-all ${tx.zatcaQRCode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                          {zatcaSending[tx.id] ? <Loader size={11} className="animate-spin"/> : <Send size={11}/>}
                          {zatcaSending[tx.id] ? t('vat.sending') : tx.zatcaQRCode ? t('vat.resendCnToZatca') : t('vat.sendCnToZatca')}
                        </button>
                        {zatcaStatus[tx.id] && !zatcaSending[tx.id] && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${zatcaStatus[tx.id].ok ? 'text-emerald-700' : 'text-rose-600'}`}>{zatcaStatus[tx.id].msg}</span>
                        )}
                      </div>
                    ) : tx.zatcaQRCode ? (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-emerald-700 font-bold text-[10px]"><CheckCircle size={12}/> {t('vat.reported')}</span>
                        <button onClick={() => setInvoiceModal(tx)} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold hover:bg-emerald-100"><Eye size={12}/>{t('entry.invoice')}</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleSendToZatca(tx)}
                          disabled={zatcaSending[tx.id]}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                          {zatcaSending[tx.id] ? <Loader size={11} className="animate-spin"/> : <Send size={11}/>}
                          {zatcaSending[tx.id] ? t('vat.sending') : t('vat.sendToZatca')}
                        </button>
                        {zatcaStatus[tx.id] && !zatcaSending[tx.id] && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${zatcaStatus[tx.id].ok ? 'text-emerald-700' : 'text-rose-600'}`}>{zatcaStatus[tx.id].msg}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVATTransactions.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-400">
                    {t('vat.noTransactions')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-500 text-white font-bold">
                <td colSpan={8} className="px-4 py-4 text-right text-lg">{t('history.totalShort')}</td>
                <td className="px-4 py-4 text-sm">
                  {filteredVATTransactions.reduce((sum, t) => sum + (t.amountExcludingVAT || t.amount || 0), 0).toLocaleString()} SAR
                </td>
                <td className="px-4 py-4 text-sm">
                  {filteredVATTransactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0).toLocaleString()} SAR
                </td>
                <td className="px-4 py-4 text-sm">
                  {filteredVATTransactions.reduce((sum, t) => sum + (t.amountIncludingVAT || t.totalWithVat || t.amount || 0), 0).toLocaleString()} SAR
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
      )}

      {/* â⬝��â⬝�� Compare Panel â⬝��â⬝�� */}
      {reportView === 'COMPARE' && (
        <div className="premium-card p-4 sm:p-5">
          {/* Paired comparison table: each imported invoice + its matching history rows side by side */}
          <div className="mb-4 flex items-center gap-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-violet-500" />
              VAT Report vs Transaction History
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{matchedCount} matched</span>
            <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">{importedExpenses.length - matchedCount} unmatched</span>
          </div>

          {importedExpenses.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No imported PDF invoices yet. Use "Import PDF" to add them.</div>
          )}

          <div className="space-y-3">
            {importedExpenses.map((tx, i) => {
              const rowAmt = inclAmt(tx);
              const matches = historyExpenses.filter(h => inclAmt(h) === rowAmt);
              const isMatched = matches.length > 0;
              return (
                <div key={tx.id} className={`rounded-xl border-2 overflow-hidden ${isMatched ? 'border-emerald-300' : 'border-rose-200'}`}>
                  {/* Header bar */}
                  <div className={`px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold ${isMatched ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    <span className="opacity-70">#{i + 1}</span>
                    <span>{isMatched ? `â��S Matched â��⬝ ${matches.length} transaction${matches.length > 1 ? 's' : ''} found` : 'â�� No match in Transaction History'}</span>
                    <span className="ml-auto font-black">{rowAmt.toLocaleString()} SAR</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    {/* LEFT: Imported PDF Invoice */}
                    <div className={`p-3 text-xs ${isMatched ? 'bg-emerald-50/40' : 'bg-rose-50/40'}`}>
                      <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <span>ðŸ�S¥ VAT Report (Imported PDF)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span className="text-slate-500">Date</span><span className="font-bold text-slate-700">{fmtDate(tx.date)}</span>
                        <span className="text-slate-500">Invoice #</span><span className="font-bold text-slate-700 font-mono truncate" title={tx.vatInvoiceNumber || ''}>{tx.vatInvoiceNumber || 'â��⬝'}</span>
                        <span className="text-slate-500">Vendor</span><span className="font-bold text-slate-700 truncate" title={tx.vendorName || ''}>{tx.vendorName || 'â��⬝'}</span>
                        <span className="text-slate-500">VAT #</span><span className="font-mono text-slate-600 truncate">{tx.vendorVATNumber || 'â��⬝'}</span>
                        <span className="text-slate-500">Excl. VAT</span><span className="font-bold text-slate-700">{(tx.amountExcludingVAT || tx.amount || 0).toLocaleString()}</span>
                        <span className="text-slate-500">VAT Amt</span><span className="font-bold text-blue-700">{(tx.vatAmount || 0).toLocaleString()}</span>
                        <span className="text-slate-500">Incl. VAT</span><span className={`font-black ${isMatched ? 'text-emerald-700' : 'text-rose-600'}`}>{rowAmt.toLocaleString()} SAR</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => setComparePreview(tx)} className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded text-[10px] font-bold flex items-center gap-1"><Eye size={10}/> Preview</button>
                        <button onClick={() => handleCompareDelete(tx)} className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold flex items-center gap-1"><Trash2 size={10}/> Delete</button>
                      </div>
                    </div>

                    {/* RIGHT: Matching history transactions */}
                    <div className="p-3 text-xs bg-white">
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-2">
                        ðŸ�S⬹ Transaction History {isMatched ? `â��⬝ ${matches.length} match${matches.length > 1 ? 'es' : ''}` : 'â��⬝ No match'}
                      </div>
                      {!isMatched && (
                        <div className="text-slate-400 italic py-2">No expense transaction with Incl. VAT = {rowAmt.toLocaleString()} SAR found.</div>
                      )}
                      <div className="space-y-2">
                        {matches.map((h, j) => (
                          <div key={h.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                              {matches.length > 1 && <><span className="text-slate-400 col-span-2 font-bold text-[10px] mb-0.5">Match #{j + 1}</span></>}
                              <span className="text-slate-500">Date</span><span className="font-bold text-slate-700">{fmtDate(h.date)}</span>
                              <span className="text-slate-500">Details</span><span className="font-bold text-slate-700 truncate" title={h.vendorName || h.details || ''}>{h.vendorName || h.details || 'â��⬝'}</span>
                              <span className="text-slate-500">Invoice #</span><span className="font-mono text-slate-600 truncate">{h.vatInvoiceNumber || 'â��⬝'}</span>
                              <span className="text-slate-500">Category</span><span className="text-slate-600 truncate">{(h as any).expenseCategory || 'â��⬝'}</span>
                              <span className="text-slate-500">Incl. VAT</span><span className="font-black text-emerald-700">{inclAmt(h).toLocaleString()} SAR â��S</span>
                            </div>
                            <div className="flex gap-1 mt-1.5">
                              <button onClick={() => setComparePreview(h)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-bold flex items-center gap-1"><Eye size={10}/> Preview</button>
                              <button onClick={() => handleCompareDelete(h)} className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold flex items-center gap-1"><Trash2 size={10}/> Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQRCode && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[12vh] z-50" onClick={() => setSelectedQRCode(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <QrCode size={20} />
                {t('vat.zatcaQr')}
              </h3>
              <button onClick={() => setSelectedQRCode(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedQRCode)}`}
                alt="ZATCA QR Code"
                className="w-64 h-64 border-2 border-slate-200 rounded-lg"
              />
              <p className="text-xs text-slate-500 text-center">{t('vat.zatcaQrScan')}</p>
              <div className="w-full p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-600 font-mono break-all">{selectedQRCode}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal â��⬝ shown after Send to ZATCA */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[4vh] z-50 overflow-y-auto px-4" onClick={() => setInvoiceModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mb-8 overflow-hidden border border-emerald-100" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 p-6 flex justify-between items-start relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 bg-white/10 rounded-2xl border-2 border-white/20 flex items-center justify-center p-1">
                  <img src="/images/cologo.png" alt="Logo" className="w-full h-full object-contain" onError={e => (e.currentTarget.style.display='none')} />
                </div>
                <div>
                  <div className="text-white font-black text-lg" dir="rtl" lang="ar" style={{fontFamily:"'Tajawal',sans-serif"}}>{companyName}</div>
                  <div className="text-emerald-200 font-bold text-sm">{companyNameEn}</div>
                  <div className="text-emerald-300/70 text-xs mt-1">{companyAddress} | VAT: {companyVAT}</div>
                </div>
              </div>
              <div className="relative z-10 text-right">
                <div className={`text-2xl font-black ${invoiceModal.isCreditNote ? 'text-red-300' : 'text-white'}`}>
                  {invoiceModal.isCreditNote ? t('vat.creditNote') : t('vat.taxInvoice')}
                </div>
                <div className="text-xs text-emerald-200 tracking-widest mt-1">â�¦ {t('vat.zatcaCompliant')} â�¦</div>
                <button onClick={() => setInvoiceModal(null)} className="mt-3 p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-all">
                  <X size={18} className="text-white" />
                </button>
              </div>
            </div>

            {/* Watermark behind body */}
            <div className="relative bg-white">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{opacity:0.04}}>
                <img src="/images/logo.png" alt="" className="w-72 h-72 object-contain" />
              </div>

              <div className="relative z-10 p-6 space-y-5">
                {/* Meta pills */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { lbl: 'Invoice No.', val: invoiceModal.vatInvoiceNumber || 'â��⬝' },
                    { lbl: 'Date', val: fmtDate(invoiceModal.date) },
                    { lbl: 'Payment', val: invoiceModal.paymentMethod || 'Cash' },
                  ].map(({ lbl, val }) => (
                    <div key={lbl} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">{lbl}</div>
                      <div className="text-sm font-black text-emerald-900 mt-1">{val}</div>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                    <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mb-3 pb-2 border-b border-emerald-100">{t('vat.invoiceDetails')}</div>
                    {invoiceModal.buildingName && <div className="flex justify-between text-sm"><span className="text-slate-500">Property</span><span className="font-bold text-slate-700">{invoiceModal.buildingName}{invoiceModal.unitNumber ? ` (${invoiceModal.unitNumber})` : ''}</span></div>}
                    <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">{t('history.type')}</span><span className="font-bold text-slate-700">{invoiceModal.type === 'INCOME' ? 'Rental Income' : 'Expense'}</span></div>
                    {(invoiceModal as any).expenseCategory && <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">{t('entry.categoryShort')}</span><span className="font-bold text-slate-700">{(invoiceModal as any).expenseCategory}</span></div>}
                    {(invoiceModal as any).vendorRefNo && <div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Ref. No.</span><span className="font-bold text-slate-700 font-mono">{(invoiceModal as any).vendorRefNo}</span></div>}
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                    {invoiceModal.type === 'INCOME' ? (
                      <>
                        <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mb-3 pb-2 border-b border-emerald-100">{t('vat.billTo')}</div>
                        <div className="font-bold text-slate-800">{invoiceModal.unitNumber ? `Unit ${invoiceModal.unitNumber}` : invoiceModal.buildingName || 'N/A'}</div>
                        {invoiceModal.customerVATNumber && <div className="text-xs text-slate-500 mt-1">VAT: {invoiceModal.customerVATNumber}</div>}
                      </>
                    ) : (
                      <>
                        <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-3 pb-2 border-b border-amber-100">{t('vat.supplier')}</div>
                        <div className="font-bold text-slate-800">{(invoiceModal as any).vendorName || 'N/A'}</div>
                        {(invoiceModal as any).vendorVATNumber && <div className="text-xs text-slate-500 mt-1">VAT: {(invoiceModal as any).vendorVATNumber}</div>}
                      </>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div className="rounded-xl overflow-hidden border border-emerald-100">
                  <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 grid grid-cols-3 py-3 px-4">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">#</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{t('entry.description')}</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider text-right">{t('entry.amount')}</span>
                  </div>
                  <div className="grid grid-cols-3 py-4 px-4 border-b border-emerald-50">
                    <span className="text-emerald-600 font-bold">01</span>
                    <div>
                      <div className="font-bold text-slate-700 text-sm">{invoiceModal.details || 'Property Services'}</div>
                      <div className="text-xs text-slate-400 mt-1">{invoiceModal.type === 'INCOME' ? 'Rental Income' : 'Expense'}</div>
                    </div>
                    <span className="text-right font-bold text-slate-700">{(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-slate-500 text-sm"><span>{t('vat.subtotalExclVat')}</span><span className="font-semibold">{(invoiceModal.amountExcludingVAT || invoiceModal.amount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between text-slate-500 text-sm"><span>VAT ({invoiceModal.vatRate || 15}%)</span><span className="font-semibold">{(invoiceModal.vatAmount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between text-emerald-800 font-black text-lg pt-2 border-t-2 border-emerald-200">
                      <span>{t('common.total')}</span>
                      <span>{(invoiceModal.amountIncludingVAT || invoiceModal.totalWithVat || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">{t('common.sar')}</span></span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {invoiceModal.zatcaQRCode && (
                  <div className="flex items-center gap-5 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceModal.zatcaQRCode)}`} className="w-24 h-24 border-2 border-emerald-200 rounded-lg" alt="ZATCA QR" />
                    <div>
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">{t('vat.zatcaQr')}</div>
                      <div className="text-xs text-slate-500">{t('vat.scanToVerify')}</div>
                      <div className="mt-2 flex items-center gap-1 text-emerald-700 font-bold text-xs"><CheckCircle size={14}/> {t('vat.reportedZatca')}</div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center pt-3 border-t border-emerald-100">
                  <div>
                    <div className="text-xs text-slate-400">{t('vat.computerGenerated')}</div>
                    <div className="text-xs text-slate-400 mt-1">{t('vat.noSignatureRequired')}</div>
                  </div>
                  <div className="flex items-center gap-2 opacity-40">
                    <img src="/images/logo.png" className="h-4" alt="Amlak" onError={e => (e.currentTarget.style.display='none')} />
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider">Powered by Amlak</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { window.location.hash = `/invoice/${invoiceModal.vatInvoiceNumber}`; setInvoiceModal(null); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-emerald-500 transition-all"
                  >
                    <Eye size={16}/> {t('vat.viewFullInvoice')}
                  </button>
                  <button onClick={() => setInvoiceModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">{t('common.close')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="premium-card p-4 sm:p-5 mt-4 bg-blue-50 border border-blue-200">
        <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          <FileText size={16} /> {t('vat.notesTitle')}
        </h4>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold text-emerald-700">â�²</span>
            <span>{t('vat.note1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-amber-600">â�¼</span>
            <span>{t('vat.note2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">â��¢</span>
            <span>{t('vat.note3')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">â��¢</span>
            <span>{t('vat.note4')}</span>
          </li>
        </ul>
      </div>
    </div>

      {/* â⬝��â⬝�� Compare Preview Modal â⬝��â⬝�� */}
      {comparePreview && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[8vh] z-50 overflow-y-auto px-4" onClick={() => setComparePreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mb-8 border border-violet-200" onClick={e => e.stopPropagation()}>
            <div className={`rounded-t-2xl p-4 flex justify-between items-center ${(comparePreview as any).vatReportOnly ? 'bg-gradient-to-r from-violet-700 to-violet-600' : 'bg-gradient-to-r from-blue-700 to-blue-600'}`}>
              <div>
                <h3 className="text-white font-black text-base">Transaction Preview</h3>
                <p className="text-white/70 text-xs mt-0.5">{(comparePreview as any).vatReportOnly ? 'ðŸ�S¥ Imported PDF Invoice' : 'ðŸ�S⬹ Transaction History'}</p>
              </div>
              <button onClick={() => setComparePreview(null)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30"><X size={16} className="text-white"/></button>
            </div>
            <div className="p-5 space-y-2">
              {[
                { label: 'Date',           value: fmtDate(comparePreview.date) },
                { label: 'Invoice #',      value: comparePreview.vatInvoiceNumber || 'â��⬝' },
                { label: 'Vendor',         value: comparePreview.vendorName || 'â��⬝' },
                { label: 'Vendor VAT #',   value: comparePreview.vendorVATNumber || 'â��⬝' },
                { label: 'Details',        value: comparePreview.details || 'â��⬝' },
                { label: 'Category',       value: (comparePreview as any).expenseCategory || 'â��⬝' },
                { label: 'Payment Method', value: comparePreview.paymentMethod || 'â��⬝' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex-shrink-0">{label}</span>
                  <span className="text-sm font-bold text-slate-800 text-right">{value}</span>
                </div>
              ))}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3 mt-3">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Excl. VAT</div>
                  <div className="text-sm font-black text-slate-800">{(comparePreview.amountExcludingVAT || comparePreview.amount || 0).toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-blue-500 uppercase mb-1">VAT</div>
                  <div className="text-sm font-black text-blue-700">{(comparePreview.vatAmount || 0).toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Incl. VAT</div>
                  <div className="text-sm font-black text-emerald-700">{(comparePreview.amountIncludingVAT || comparePreview.totalWithVat || comparePreview.amount || 0).toLocaleString()} SAR</div>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setComparePreview(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200">Close</button>
              <button
                onClick={() => { handleCompareDelete(comparePreview); setComparePreview(null); }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 flex items-center gap-1"
              ><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* â⬝��â⬝�� Quick Entry Modal â⬝��â⬝�� */}
      {showQE && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[6vh] z-50 overflow-y-auto px-4" onClick={() => setShowQE(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mb-8 border border-slate-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`rounded-t-2xl p-5 flex justify-between items-center ${qeType === 'SALES' ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-gradient-to-r from-amber-600 to-orange-500'}`}>
              <div>
                <h3 className="text-white font-black text-lg">
                  {isCurrentVatEntry ? t('vat.newVatEntry') : t('vat.newIncomeEntry')}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {isCurrentVatEntry ? 'Add directly to VAT report & ZATCA' : 'Saved to transaction history (no VAT)'}
                </p>
              </div>
              <button onClick={() => setShowQE(false)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30"><X size={18} className="text-white"/></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                <button
                  onClick={() => setQeType('SALES')}
                  className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${qeType === 'SALES' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-emerald-50'}`}
                >
                  <TrendingUp size={15}/> {t('vat.salesOutputVat')}
                </button>
                <button
                  onClick={() => setQeType('EXPENSE')}
                  className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${qeType === 'EXPENSE' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-amber-50'}`}
                >
                  <TrendingDown size={15}/> {t('vat.purchaseInputVat')}
                </button>
              </div>

              {/* Date + Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('common.date')}</label>
                  <input type="date" value={qeDate} onChange={e => setQeDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('entry.paymentMethod')}</label>
                  <SearchableSelect
                    options={Object.values(PaymentMethod).map(m => ({ value: m, label: m }))}
                    value={qePaymentMethod}
                    onChange={v => setQePaymentMethod(v as PaymentMethod)}
                    placeholder="â��⬝ Select Payment Method â��⬝"
                    className="mb-1"
                  />
                </div>
              </div>

              {/* SALES fields */}
              {qeType === 'SALES' && (
                <>
                  {/* Building */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('entry.building')}</label>
                    <SearchableSelect
                      options={nonResidentialBuildings.map(b => ({ value: b.id, label: b.name }))}
                      value={qeBuildingId}
                      onChange={handleQEBuildingChange}
                      placeholder="â��⬝ Select Building â��⬝"
                      className="mb-1"
                    />
                  </div>

                  {/* Building info banner (IBAN / Bank) */}
                  {selectedQEBuilding && (selectedQEBuilding.iban || selectedQEBuilding.bankName) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                      <CheckCircle size={13} className="flex-shrink-0 text-emerald-500" />
                      <span>
                        {selectedQEBuilding.bankName && <span className="font-semibold">{selectedQEBuilding.bankName}</span>}
                        {selectedQEBuilding.bankName && selectedQEBuilding.iban && <span className="mx-1">·</span>}
                        {selectedQEBuilding.iban && <span className="font-mono">{selectedQEBuilding.iban}</span>}
                      </span>
                    </div>
                  )}

                  {/* Unit Number â��⬝ dropdown when units exist, text input otherwise */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      {t('vat.unitNumber')}
                      {qeBuildingUnits.length > 0 && (
                        <span className="font-normal text-slate-400">({qeBuildingUnits.length} units)</span>
                      )}
                      {qeContractLookupLoading && <Loader size={11} className="animate-spin text-emerald-500 ml-1" />}
                    </label>
                    {qeBuildingUnits.length > 0 ? (
                      <SearchableSelect
                        options={qeBuildingUnits.map(u => ({ value: u, label: u }))}
                        value={qeUnitNumber}
                        onChange={handleQEUnitChange}
                        placeholder="â��⬝ Select Unit â��⬝"
                        className="mb-1"
                      />
                    ) : (
                      <input
                        type="text"
                        value={qeUnitNumber}
                        onChange={e => handleQEUnitChange(e.target.value)}
                        placeholder={qeBuildingId ? 'Type unit number' : 'Select a building first'}
                        disabled={!qeBuildingId}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    )}
                  </div>

                  {/* Contract customer info â��⬝ shown when a match is found */}
                  {qeContractCustomer && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <User size={14} className="flex-shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-blue-800 truncate">
                          {qeContractCustomer.nameEn || qeContractCustomer.nameAr}
                        </div>
                        {qeContractCustomer.idNo && (
                          <div className="text-[10px] text-blue-500">ID: {qeContractCustomer.idNo}</div>
                        )}
                      </div>
                      {qeVatAutoFilled && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          <Sparkles size={9} /> {t('vat.vatAutoFilled')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contract Progress Bar */}
                  {qeActiveContract && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 mt-1 shadow-sm">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <TrendingUp size={12} /> Contract Progress
                          </div>
                          <div className="text-sm font-black text-indigo-900">{Number(qeActiveContract.totalValue || 0).toLocaleString()} <span className="text-[10px] font-bold text-indigo-400">SAR TOTAL</span></div>
                          {((qeActiveContract as any).fromDate || (qeActiveContract as any).startDate) && (
                            <div className="flex items-center gap-1 text-[10px] text-indigo-500 mt-0.5 font-semibold">
                              <Calendar size={10} />
                              <span>{(qeActiveContract as any).fromDate || (qeActiveContract as any).startDate}</span>
                              <span className="text-indigo-300 mx-0.5">to</span>
                              <span>{(qeActiveContract as any).toDate || (qeActiveContract as any).endDate || ''}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-indigo-700 font-black bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full inline-block mb-1 shadow-sm">
                            Inst. {qeContractStats.installmentNo} of {qeActiveContract.installmentCount || 1}
                          </div>
                          <div className="text-xs font-bold text-indigo-800 flex items-center gap-1 justify-end">
                            <CheckCircle size={12} className="text-emerald-500" />
                            {qeContractStats.paid.toLocaleString()} SAR Paid
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar line */}
                      <div className="w-full bg-indigo-200/40 rounded-full h-2 mb-1 overflow-hidden shadow-inner flex">
                        <div 
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(100, Math.max(0, (qeContractStats.paid / Math.max(1, Number(qeActiveContract.totalValue || 1))) * 100))}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-[10px] font-bold mt-1">
                        <span className="text-indigo-600">{Math.round((qeContractStats.paid / Math.max(1, Number(qeActiveContract.totalValue || 1))) * 100)}% Complete</span>
                        <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">{qeContractStats.remaining.toLocaleString()} SAR Remaining</span>
                      </div>
                    </div>
                  )}

                  {/* Customer VAT Number â��⬝
                      IMPORTANT only when the tenant actually has a VAT number.
                      If no VAT on record, show as a plain optional field. */}
                  {qeVatAutoFilled ? (
                    /* â⬝��â⬝�� Tenant HAS a VAT number: show it prominently â⬝��â⬝�� */
                    <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 uppercase tracking-wide">
                          <Receipt size={13} /> {t('vat.customerVatNo')}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Sparkles size={9} /> {t('vat.autoFilled')}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={qeCustomerVAT}
                          onChange={e => { setQeCustomerVAT(e.target.value); setQeVatAutoFilled(false); }}
                          className="w-full px-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-base font-mono font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 tracking-widest"
                        />
                        <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle size={10} /> Required for ZATCA â��⬝ taken from tenant record. Edit if needed.
                      </p>
                      {qeErrors.customerVAT && <div className="text-xs text-rose-600 font-bold mt-1">{qeErrors.customerVAT}</div>}
                    </div>
                  ) : (
                    /* â⬝��â⬝�� Tenant has NO VAT number: plain optional field â⬝��â⬝�� */
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        {t('vat.customerVatNo')}
                        <span className="ml-1 font-normal text-slate-400">(optional â��⬝ tenant not VAT registered)</span>
                      </label>
                      <input
                        type="text"
                        value={qeCustomerVAT}
                        onChange={e => setQeCustomerVAT(e.target.value)}
                        placeholder="3xxxxxxxxx3"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-slate-50"
                      />
                      {qeErrors.customerVAT && <div className="text-xs text-rose-600 font-bold mt-1">{qeErrors.customerVAT}</div>}
                    </div>
                  )}
                </>
              )}

              {/* EXPENSE (Purchase) fields */}
              {qeType === 'EXPENSE' && (
                <>
                  {/* â⬝��â⬝�� Vendor Dropdown â⬝��â⬝�� */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('vat.vendorSupplier')}</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          options={vendors.map(v => ({ value: v.id, label: v.nameEn || v.name, sublabel: v.serviceType }))}
                          value={qeVendorId}
                          onChange={vid => {
                            setQeVendorId(vid);
                            if (vid) {
                              const v = vendors.find(x => x.id === vid);
                              if (v) {
                                setQeVendorName(v.nameEn || v.name || '');
                                setQeVendorVAT(v.vatNumber || v.vatNo || '');
                                setQeVendorAutoFilled(true);
                              }
                            } else {
                              setQeVendorName('');
                              setQeVendorVAT('');
                              setQeVendorAutoFilled(false);
                            }
                          }}
                          placeholder="â��⬝ Select Vendor (or type below) â��⬝"
                          className="mb-1"
                        />
                      </div>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700 font-bold text-xs border border-amber-300 hover:bg-amber-200"
                        onClick={() => setShowAddVendor(true)}
                      >+ {t('vat.addVendor') || 'Add Vendor'}</button>
                    </div>
                    <AddVendorDialog
                      open={showAddVendor}
                      onClose={() => setShowAddVendor(false)}
                      onAdd={vendor => {
                        setVendors(prev => [...prev, vendor as Vendor]);
                        setQeVendorId(vendor.id);
                        setQeVendorName(vendor.name);
                        setQeVendorVAT(vendor.vatNumber);
                        setQeVendorAutoFilled(false);
                      }}
                    />
                  </div>

                  {/* Auto-filled vendor card */}
                  {qeVendorAutoFilled && qeVendorId && (() => {
                    const v = vendors.find(x => x.id === qeVendorId);
                    return v ? (
                      <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 font-black text-sm">
                          {(v.nameEn || v.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-amber-900">{v.nameEn || v.name}</div>
                          <div className="text-[10px] text-amber-600 flex flex-wrap gap-x-3 mt-0.5">
                            {v.serviceType && <span>{v.serviceType}</span>}
                            {(v.vatNumber || v.vatNo) && <span className="font-mono">VAT: {v.vatNumber || v.vatNo}</span>}
                            {(v.phone || v.mobileNo) && <span>ðŸ�Sž {v.phone || v.mobileNo}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          <Sparkles size={9}/> {t('vat.autoFilled')}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Manual override â��⬝ shown always so user can correct / enter if not in vendor list */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                          {t('vat.vendorName')}
                          {!qeVendorId && <span className="ms-1 font-normal text-slate-400">(if not in list)</span>}
                        </label>
                        <input
                          type="text"
                          value={qeVendorName}
                          onChange={e => { setQeVendorName(e.target.value); setQeVendorAutoFilled(false); }}
                          placeholder="e.g. Al-Jazeera Trading Co."
                          className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${qeVendorAutoFilled ? 'border-amber-300 bg-amber-50 font-semibold text-amber-900' : 'border-slate-300'}`}
                        />
                        {qeErrors.vendorName && <div className="text-xs text-rose-600 font-bold mt-1">{qeErrors.vendorName}</div>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                          {t('vat.vendorVatNo')}
                          {qeVendorAutoFilled && (v => v?.vatNumber || v?.vatNo)(vendors.find(x => x.id === qeVendorId)) && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600"><Sparkles size={8}/> auto</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={qeVendorVAT}
                          onChange={e => { setQeVendorVAT(e.target.value); setQeVendorAutoFilled(false); }}
                          placeholder="3xxxxxxxxx3"
                          className={`w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 ${qeVendorAutoFilled && qeVendorVAT ? 'border-amber-300 bg-amber-50 font-bold text-amber-900' : 'border-slate-300'}`}
                        />
                        {qeErrors.vendorVAT && <div className="text-xs text-rose-600 font-bold mt-1">{qeErrors.vendorVAT}</div>}
                      </div>
                    </div>

                  {/* Vendor Invoice Reference No. */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {t('vat.vendorInvoiceRef')}
                      <span className="ml-1 font-normal text-slate-400">(from supplier's invoice)</span>
                    </label>
                    <input
                      type="text"
                      value={qeVendorRefNo}
                      onChange={e => setQeVendorRefNo(e.target.value)}
                      placeholder="e.g. INV-2026-00123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Related Building (optional for purchases) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {t('vat.relatedProperty')}
                      <span className="ml-1 font-normal text-slate-400">(optional)</span>
                    </label>
                    <SearchableSelect
                      options={[{ value: '', label: 'â��⬝ General / Not Property-Specific â��⬝' }, ...buildings.map(b => ({ value: b.id, label: b.name }))]}
                      value={qePurchaseBuildingId}
                      onChange={setQePurchaseBuildingId}
                      placeholder="â��⬝ Select Property (optional) â��⬝"
                      className="mb-1"
                    />
                  </div>

                  {/* Expense Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('vat.expenseCategory')}</label>
                    <SearchableSelect
                      options={Object.entries(ExpenseCategory).map(([k, v]) => ({ value: v, label: v }))}
                      value={qeCategory}
                      onChange={v => { setQeCategory(v as ExpenseCategory); setQeSubCategory(''); }}
                      placeholder="â��⬝ Select Category â��⬝"
                      className="mb-1"
                    />
                  </div>
                  {currentSubCategories.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        {t('vat.subCategory')}
                        <span className="ml-1 font-normal text-slate-400">(optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {currentSubCategories.map(sub => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setQeSubCategory(prev => prev === sub ? '' : sub)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              qeSubCategory === sub
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400 hover:text-amber-600'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                      {qeSubCategory && (
                        <p className="mt-1 text-[11px] text-amber-600 font-semibold">
                          â��S {qeCategory} â⬠�" {qeSubCategory}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500">{t('entry.amount')}</label>
                  {isCurrentVatEntry && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500">
                      <input type="checkbox" checked={qeAmountIsIncl} onChange={e => setQeAmountIsIncl(e.target.checked)} className="rounded"/>
                      {t('vat.amountInclVat')}
                    </label>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={qeAmount}
                  onChange={e => setQeAmount(e.target.value)}
                  placeholder={isCurrentVatEntry ? (qeAmountIsIncl ? 'e.g. 1150 (incl. 15% VAT)' : 'e.g. 1000 (excl. VAT)') : 'e.g. 1000'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                {isCurrentVatEntry && qeAmount && parseFloat(qeAmount) > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                    {[
                      { lbl: t('vat.exclVat'), val: (qeAmountIsIncl ? parseFloat(qeAmount) / 1.15 : parseFloat(qeAmount)).toFixed(2) },
                      { lbl: t('vat.totalVat').replace('Total ', ''), val: (qeAmountIsIncl ? parseFloat(qeAmount) / 1.15 * 0.15 : parseFloat(qeAmount) * 0.15).toFixed(2) },
                      { lbl: t('vat.inclVat'), val: (qeAmountIsIncl ? parseFloat(qeAmount) : parseFloat(qeAmount) * 1.15).toFixed(2) },
                    ].map(c => (
                      <div key={c.lbl} className="bg-slate-50 border border-slate-200 rounded-lg py-1.5">
                        <div className="text-slate-400 font-bold">{c.lbl}</div>
                        <div className="font-black text-slate-700">{c.val}</div>
                      </div>
                    ))}
                  </div>
                )}
                {!isCurrentVatEntry && qeType === 'SALES' && (
                  <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"/>
                    {t('vat.plainIncome')}
                  </p>
                )}
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('entry.detailsNotes')}</label>
                <input type="text" value={qeDetails} onChange={e => setQeDetails(e.target.value)} placeholder={t('vat.optionalDesc')} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleQuickEntrySave}
                  disabled={qeSaving || !qeAmount || parseFloat(qeAmount) <= 0}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${qeType === 'SALES' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {qeSaving ? <Loader size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                  {qeSaving ? t('vat.saving') : isCurrentVatEntry ? t('vat.saveVatEntry') : t('vat.saveAsIncome')}
                </button>
                <button onClick={() => setShowQE(false)} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â⬝��â⬝�� Wrong Entry? Reversal Confirmation Modal â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝��â⬝�� */}
      {reversalTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-rose-50 border-b border-rose-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                <RotateCcw size={20} className="text-rose-600"/>
              </div>
              <div>
                <h3 className="font-bold text-rose-800 text-lg">{t('vat.reverseTitle')}</h3>
                <p className="text-rose-600 text-sm">{t('vat.reverseSubtitle')}</p>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice #:</span>
                  <span className="font-semibold text-slate-800">{(reversalTarget as any).vatInvoiceNumber || 'â��⬝'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('history.vendorShort')}</span>
                  <span className="font-semibold text-slate-800">{(reversalTarget as any).vendorName || reversalTarget.details || 'â��⬝'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('vat.amountInclVatLabel')}</span>
                  <span className="font-semibold text-slate-800">{reversalTarget.amount?.toFixed(2)} SAR</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><AlertCircle size={14}/> {t('vat.whatThisDoes')}</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700 text-[13px]">
                  <li>{t('vat.reverseBullet1')}</li>
                  <li>{t('vat.reverseBullet2')}</li>
                  <li>{t('vat.reverseBullet3')}</li>
                  <li>{t('vat.reverseBullet4')}</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleCreateReversal}
                disabled={reversalSaving}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {reversalSaving ? <Loader size={16} className="animate-spin"/> : <RotateCcw size={16}/>}
                {reversalSaving ? 'Creating Reversalâ��¦' : 'Yes, Reverse This Entry'}
              </button>
              <button
                onClick={() => setReversalTarget(null)}
                disabled={reversalSaving}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
              >{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Purchase Import modal */}
      {showPdfImport && (
        <PdfPurchaseImport
          vendors={vendors}
          buildings={buildings}
          onClose={() => setShowPdfImport(false)}
          onImported={() => { setShowPdfImport(false); loadData(); }}
        />
      )}
    </>
  );
};

export default VATReport;

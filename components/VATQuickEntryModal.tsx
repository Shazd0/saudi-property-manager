import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType, PaymentMethod, ExpenseCategory, Building, Customer, Vendor } from '../types';
import {
  saveTransaction,
  getBuildings,
  getCustomers,
  getActiveContract,
  getContracts,
  getVendors,
  getTransactions,
} from '../services/firestoreService';
import { isValidSaudiVAT } from '../utils/validators';
import { auth } from '../firebase';
import SearchableSelect from './SearchableSelect';
import AddVendorDialog from './AddVendorDialog';
import {
  FileText,
  Calendar,
  Receipt,
  TrendingUp,
  TrendingDown,
  X,
  CheckCircle,
  Loader,
  Plus,
  Sparkles,
} from 'lucide-react';
import { fmtDate, dateToLocalStr } from '../utils/dateFormat';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { getInstallmentRange } from '../utils/installmentSchedule';

export type VATQuickEntryType = 'SALES' | 'EXPENSE' | 'FEES';

interface VATQuickEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (tx: Transaction) => void;
  defaultType?: VATQuickEntryType;
  /** Limit which tabs are shown. Defaults to all three. */
  allowedTypes?: VATQuickEntryType[];
}

const TYPE_META: Record<VATQuickEntryType, { title: string; subtitle: string; accent: string }> = {
  SALES:   { title: 'Sales',    subtitle: 'Output VAT',       accent: 'emerald' },
  EXPENSE: { title: 'Purchase', subtitle: 'Input VAT',        accent: 'amber' },
  FEES:    { title: 'Fees',     subtitle: 'No VAT',           accent: 'sky' },
};

const VATQuickEntryModal: React.FC<VATQuickEntryModalProps> = ({
  open,
  onClose,
  onSaved,
  defaultType = 'SALES',
  allowedTypes = ['SALES', 'EXPENSE', 'FEES'],
}) => {
  const [qeType, setQeType] = useState<VATQuickEntryType>(defaultType);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [qeDate, setQeDate] = useState(new Date().toISOString().split('T')[0]);
  const [qeAmount, setQeAmount] = useState('');
  const [qeDetails, setQeDetails] = useState('');
  const [qePaymentMethod, setQePaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK);
  const [qeBuildingId, setQeBuildingId] = useState('');
  const [qeUnitNumber, setQeUnitNumber] = useState('');
  const [qeCustomerVAT, setQeCustomerVAT] = useState('');
  const [qeVendorName, setQeVendorName] = useState('');
  const [qeVendorVAT, setQeVendorVAT] = useState('');
  const [qeCategory, setQeCategory] = useState<ExpenseCategory>(ExpenseCategory.VENDOR_PAYMENT);
  const [qeSubCategory, setQeSubCategory] = useState('');
  const [qeSaving, setQeSaving] = useState(false);
  const [qeErrors, setQeErrors] = useState<{ customerVAT?: string; vendorVAT?: string; vendorName?: string; amount?: string }>({});
  const [qeContractCustomer, setQeContractCustomer] = useState<Customer | null>(null);
  const [qeVatAutoFilled, setQeVatAutoFilled] = useState(false);
  const [qeContractLookupLoading, setQeContractLookupLoading] = useState(false);
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

  // Load data when modal opens
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([getBuildings(), getCustomers(), getVendors(), getTransactions()]).then(
      ([b, c, v, txs]) => {
        if (!active) return;
        setBuildings(b || []);
        setCustomers(c || []);
        setVendors((v || []).filter((vn: Vendor) => (vn as any).status !== 'Inactive'));
        setTransactions(txs || []);
      },
    );
    return () => {
      active = false;
    };
  }, [open]);

  // Sync defaultType when opening
  useEffect(() => {
    if (open) setQeType(defaultType);
  }, [open, defaultType]);

  const nonResidentialBuildings = useMemo(
    () =>
      buildings.filter(
        (b) => b.propertyType === 'NON_RESIDENTIAL' || ((b as any).vatApplicable && b.propertyType !== 'RESIDENTIAL'),
      ),
    [buildings],
  );
  const selectedQEBuilding = buildings.find((b) => b.id === qeBuildingId);
  const qeBuildingUnits = useMemo(() => {
    if (!selectedQEBuilding) return [];
    return (selectedQEBuilding.units || []).map((u: any) => (typeof u === 'string' ? u : u.name));
  }, [selectedQEBuilding]);

  const isCurrentVatEntry = qeType === 'FEES' ? false : qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT);

  const resetQE = () => {
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
    setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0);
    setQeFeesPaidThisInst(0);
    setQeFeesGenerateInvoice(false);
    setQeErrors({});
  };

  const handleClose = () => {
    if (qeSaving) return;
    onClose();
  };

  const handleQEBuildingChange = (id: string) => {
    setQeBuildingId(id);
    setQeUnitNumber('');
    setQeCustomerVAT('');
    setQeContractCustomer(null);
    setQeVatAutoFilled(false);
    setQeActiveContract(undefined);
    setQeNonVatFeesPerInst(0);
    setQeFeesPaidThisInst(0);
  };

  const handleQEUnitChange = useCallback(
    async (unit: string) => {
      setQeUnitNumber(unit);
      setQeContractCustomer(null);
      setQeCustomerVAT('');
      setQeVatAutoFilled(false);
      if (!unit || !qeBuildingId) return;
      setQeContractLookupLoading(true);
      try {
        let contract = await getActiveContract(qeBuildingId, unit);
        if (!contract) {
          const allContracts = await getContracts();
          const unitContracts = (allContracts || []).filter(
            (c: any) => c.buildingId === qeBuildingId && c.unitName === unit && !c.deleted,
          );
          unitContracts.sort((a: any, b: any) => (a.status === 'Active' ? -1 : b.status === 'Active' ? 1 : 0));
          contract = unitContracts[0] || null;
        }
        if (contract) {
          setQeActiveContract(contract);
          const contractId = (contract as any).id;
          const prevPayments = transactions.filter((t) => {
            if (t.status !== 'APPROVED' && t.status) return false;
            if (contractId && t.contractId === contractId) return true;
            if (!t.contractId && t.buildingId === qeBuildingId && t.unitNumber === unit && t.type !== TransactionType.EXPENSE) return true;
            return false;
          });
          const upfrontPaidAmount = Number((contract as any).upfrontPaid || 0);
          const totalInst = contract.installmentCount || 1;
          const rentValue = Number((contract as any).rentValue || 0);
          const rentPerInstIncl = totalInst > 0 ? rentValue / totalInst : 0;
          const firstInstAmt = Math.round(rentPerInstIncl);
          const otherInstAmt = Math.round(rentPerInstIncl);
          const effectiveTotalIncl = rentValue;

          const rentPayments = prevPayments.filter((t) => !(t as any).feesEntry);
          const totalPaidIncl = rentPayments.reduce(
            (sum, t) =>
              sum +
              (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) +
              ((t as any).discountAmount || 0),
            0,
          );
          const totalPaidEffective = totalPaidIncl + upfrontPaidAmount;

          let currentInstallment = 1;
          let cumulated = firstInstAmt;
          while (totalPaidEffective >= Math.round(cumulated * 100) / 100 && currentInstallment < totalInst) {
            currentInstallment++;
            cumulated += otherInstAmt > 0 ? otherInstAmt : firstInstAmt;
          }

          const remainingDisplay = Math.max(0, effectiveTotalIncl - totalPaidEffective);
          setQeContractStats({ paid: totalPaidEffective, remaining: remainingDisplay, installmentNo: currentInstallment });

          const currentInstAmt = currentInstallment === 1 ? firstInstAmt : otherInstAmt > 0 ? otherInstAmt : firstInstAmt;
          const thresholdBefore = Math.max(0, cumulated - currentInstAmt);
          const paidTowardCurrent = Math.max(0, totalPaidEffective - thresholdBefore);
          const rentAutoFill = Math.max(0, Math.round((currentInstAmt - paidTowardCurrent) * 100) / 100);

          const periodicFees =
            (Number((contract as any).waterFee) || 0) +
            (Number((contract as any).internetFee) || 0) +
            (Number((contract as any).parkingFee) || 0) +
            (Number((contract as any).managementFee) || 0);
          const oneTimeFees =
            (Number((contract as any).insuranceFee) || 0) +
            (Number((contract as any).serviceFee) || 0) +
            (Number((contract as any).officeFeeAmount) || 0) +
            (Number((contract as any).otherAmount) || 0) -
            (Number((contract as any).otherDeduction) || 0);
          const periodicPerInst = totalInst > 0 ? periodicFees / totalInst : 0;
          const feesForThisInst = currentInstallment === 1 ? periodicPerInst + oneTimeFees : periodicPerInst;
          const nonVatPerInst = Math.round(feesForThisInst);
          setQeNonVatFeesPerInst(nonVatPerInst);

          const { startDate: feeStart, endDate: feeEnd } = getInstallmentRange(contract, currentInstallment);
          const feeStartStr = dateToLocalStr(feeStart);
          const feeEndStr = dateToLocalStr(feeEnd);
          const feesPaidThisInstLocal = prevPayments
            .filter((t) => (t as any).feesEntry === true && t.date >= feeStartStr && t.date <= feeEndStr)
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
          setQeFeesPaidThisInst(feesPaidThisInstLocal);
          const feesRemaining = Math.max(0, nonVatPerInst - feesPaidThisInstLocal);

          if (qeType === 'FEES') {
            if (feesRemaining > 0) setQeAmount(feesRemaining.toString());
            else if (nonVatPerInst > 0) setQeAmount(nonVatPerInst.toString());
          } else if (rentAutoFill > 0) {
            setQeAmount(rentAutoFill.toString());
          }

          const { startDate, endDate } = getInstallmentRange(contract, currentInstallment);
          const periodText = `[${fmtDate(dateToLocalStr(startDate))} to ${fmtDate(dateToLocalStr(endDate))}]`;
          const instText =
            currentInstallment === 1
              ? qeType === 'FEES'
                ? `1st Fees Payment`
                : `1st Rent Payment`
              : qeType === 'FEES'
              ? `Fees Installment ${currentInstallment} of ${totalInst}`
              : `Rent Installment ${currentInstallment} of ${totalInst}`;
          const isPartial =
            totalPaidEffective > Math.round((cumulated - (currentInstallment === 1 ? firstInstAmt : otherInstAmt)) * 100) / 100 &&
            totalPaidEffective < Math.round(cumulated * 100) / 100;
          const isFeesPartial = qeType === 'FEES' && feesPaidThisInstLocal > 0 && feesPaidThisInstLocal < nonVatPerInst;
          const contractCust =
            customers.find((c) => c.id === contract.customerId) ||
            customers.find((c) => (c.nameEn || c.nameAr) === contract.customerName);
          const contractCustLabel = formatNameWithRoom(contract.customerName, contractCust?.roomNumber);
          if (qeType === 'FEES') {
            setQeDetails(
              isFeesPartial
                ? `Balance Fees Payment - Installment ${currentInstallment} - ${periodText} - ${contractCustLabel}`
                : `${instText} - ${periodText} - ${contractCustLabel}`,
            );
          } else {
            setQeDetails(
              isPartial
                ? `Balance Payment - Installment ${currentInstallment} - ${periodText} - ${contractCustLabel}`
                : `${instText} - ${periodText} - ${contractCustLabel}`,
            );
          }

          const cust = contractCust;
          if (cust) {
            setQeContractCustomer(cust);
            if ((cust as any).vatNumber) {
              setQeCustomerVAT((cust as any).vatNumber);
              setQeVatAutoFilled(true);
            }
          }
        }
      } finally {
        setQeContractLookupLoading(false);
      }
    },
    [qeBuildingId, customers, transactions, qeType],
  );

  const handleSave = async () => {
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
    if (!amt || amt <= 0) errors.amount = 'Required';
    if (Object.keys(errors).length > 0) {
      setQeErrors(errors);
      return;
    }

    setQeSaving(true);
    try {
      const uid = auth.currentUser?.uid || 'direct-entry';
      const isVat = qeType === 'EXPENSE' || (qeType === 'SALES' && !!qeCustomerVAT);
      let tx: any;

      if (qeType === 'FEES') {
        const feeInvNo = qeFeesGenerateInvoice ? `FEE-${Date.now().toString(36).toUpperCase()}` : undefined;
        tx = {
          id: crypto.randomUUID(),
          type: TransactionType.INCOME,
          date: qeDate,
          amount: Math.round(amt * 100) / 100,
          isVATApplicable: false,
          paymentMethod: qePaymentMethod,
          details:
            qeDetails ||
            `Non-VAT Fees${
              qeActiveContract
                ? ` - ${formatNameWithRoom(qeActiveContract.customerName, qeContractCustomer?.roomNumber)} - #${qeActiveContract.contractNo}`
                : ''
            }`,
          userId: uid,
          buildingId: qeBuildingId,
          buildingName: buildings.find((b) => b.id === qeBuildingId)?.name || '',
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
          details: qeDetails,
          userId: uid,
          buildingId: qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId,
          buildingName:
            buildings.find((b) => b.id === (qeType === 'SALES' ? qeBuildingId : qePurchaseBuildingId))?.name || '',
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
          status: 'APPROVED',
        };
      } else {
        tx = {
          id: crypto.randomUUID(),
          type: TransactionType.INCOME,
          date: qeDate,
          amount: amt,
          isVATApplicable: false,
          paymentMethod: qePaymentMethod,
          details: qeDetails,
          userId: uid,
          buildingId: qeBuildingId,
          buildingName: buildings.find((b) => b.id === qeBuildingId)?.name || '',
          unitNumber: qeUnitNumber,
          contractId: qeActiveContract?.id || undefined,
          status: 'APPROVED',
        };
      }
      await saveTransaction(tx);

      if (qeType === 'FEES' && qeFeesGenerateInvoice && tx.feeInvoiceNo) {
        const bldName = buildings.find((b) => b.id === qeBuildingId)?.name || '';
        const invNo = tx.feeInvoiceNo;
        const w = window.open('', '_blank');
        if (w) {
          const feeRows = [
            { label: 'Water Fee', val: Number((qeActiveContract as any)?.waterFee) || 0 },
            { label: 'Internet Fee', val: Number((qeActiveContract as any)?.internetFee) || 0 },
            { label: 'Parking Fee', val: Number((qeActiveContract as any)?.parkingFee) || 0 },
            { label: 'Management Fee', val: Number((qeActiveContract as any)?.managementFee) || 0 },
          ].filter((f) => f.val > 0);
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
            <button class="btn btn-print" onclick="window.print()">Print / Save PDF</button>
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
              ${feeRows.map((f) => `<tr><td>${f.label}</td><td>${f.val.toLocaleString()} SAR</td><td>${Math.round(f.val / instCount).toLocaleString()} SAR</td></tr>`).join('')}
              <tr class="total-row"><td>Total</td><td></td><td>${tx.amount.toLocaleString()} SAR</td></tr>
            </tbody>
          </table>
          <p style="margin-top:32px;font-size:11px;color:#94a3b8;text-align:center">This invoice does not include VAT. Fees are charged as-is per lease agreement.</p>
          </body></html>`);
          w.document.close();
          w.focus();
        }
      }

      onSaved?.(tx as Transaction);
      resetQE();
      onClose();
    } catch (err) {
      console.error('VATQuickEntry save failed:', err);
    } finally {
      setQeSaving(false);
    }
  };

  if (!open) return null;

  const typeColor = TYPE_META[qeType].accent;
  const saveLabel = qeSaving
    ? 'Saving...'
    : qeType === 'FEES'
    ? 'Save Non-VAT Fees'
    : isCurrentVatEntry
    ? qeType === 'SALES'
      ? 'Register Sales Invoice'
      : 'Register Purchase Invoice'
    : 'Save Record';

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 overflow-y-auto"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-6 overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="px-7 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-blue-500" />
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Quick VAT Entry</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">New VAT Entry</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">ZATCA-compliant tax invoice</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Type Toggle Cards */}
            <div className={`grid gap-2 ${allowedTypes.length === 1 ? 'grid-cols-1' : allowedTypes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {allowedTypes.includes('SALES') && (
                <button
                  onClick={() => { setQeType('SALES'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${
                    qeType === 'SALES' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    qeType === 'SALES' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'SALES' ? 'text-emerald-700' : 'text-slate-600'}`}>Sales</div>
                    <div className={`text-[9px] font-bold ${qeType === 'SALES' ? 'text-emerald-500' : 'text-slate-400'}`}>Output VAT</div>
                  </div>
                  {qeType === 'SALES' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                </button>
              )}
              {allowedTypes.includes('EXPENSE') && (
                <button
                  onClick={() => { setQeType('EXPENSE'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${
                    qeType === 'EXPENSE' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    qeType === 'EXPENSE' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'EXPENSE' ? 'text-amber-700' : 'text-slate-600'}`}>Purchase</div>
                    <div className={`text-[9px] font-bold ${qeType === 'EXPENSE' ? 'text-amber-500' : 'text-slate-400'}`}>Input VAT</div>
                  </div>
                  {qeType === 'EXPENSE' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                </button>
              )}
              {allowedTypes.includes('FEES') && (
                <button
                  onClick={() => { setQeType('FEES'); resetQE(); }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-center transition-all ${
                    qeType === 'FEES' ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    qeType === 'FEES' ? 'bg-sky-500 text-white shadow-md shadow-sky-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </div>
                  <div>
                    <div className={`font-black text-xs ${qeType === 'FEES' ? 'text-sky-700' : 'text-slate-600'}`}>Fees</div>
                    <div className={`text-[9px] font-bold ${qeType === 'FEES' ? 'text-sky-500' : 'text-slate-400'}`}>No VAT</div>
                  </div>
                  {qeType === 'FEES' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-sky-500 rounded-full" />}
                </button>
              )}
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="px-7 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Date + Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={10} /> Date</label>
                <input type="date" value={qeDate} onChange={(e) => setQeDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Receipt size={10} /> Payment Method</label>
                <SearchableSelect options={Object.values(PaymentMethod).map((m) => ({ value: m, label: m }))} value={qePaymentMethod} onChange={(v) => setQePaymentMethod(v as PaymentMethod)} className="font-bold" />
              </div>
            </div>

            {/* ── SALES: Property & Tenant ── */}
            {qeType === 'SALES' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-emerald-100" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Property & Tenant</span>
                  <div className="h-px flex-1 bg-emerald-100" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</label>
                    <SearchableSelect options={nonResidentialBuildings.map((b) => ({ value: b.id, label: b.name }))} value={qeBuildingId} onChange={handleQEBuildingChange} className="font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Unit {qeContractLookupLoading && <Loader size={10} className="animate-spin text-emerald-500" />}
                    </label>
                    <SearchableSelect options={qeBuildingUnits.map((u) => ({ value: u, label: u }))} value={qeUnitNumber} onChange={handleQEUnitChange} className="font-bold" placeholder="Select unit..." />
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
                          <div className="bg-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
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
                  <input
                    type="text"
                    value={qeCustomerVAT}
                    onChange={(e) => { setQeCustomerVAT(e.target.value); setQeVatAutoFilled(false); setQeErrors((p) => ({ ...p, customerVAT: undefined })); }}
                    className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-mono font-bold outline-none transition-all ${
                      qeErrors.customerVAT
                        ? 'border-rose-400 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-200'
                        : qeVatAutoFilled
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400'
                    }`}
                    placeholder="3xxxxxxxxxxxxxxxxx3"
                  />
                  {qeVatAutoFilled && !qeErrors.customerVAT && (
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={10} /> Auto-filled from tenant profile</p>
                  )}
                  {qeErrors.customerVAT && <p className="text-[10px] text-rose-500 font-bold mt-0.5">{qeErrors.customerVAT}</p>}
                </div>
              </div>
            )}

            {/* ── PURCHASE: Vendor ── */}
            {qeType === 'EXPENSE' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-amber-100" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Vendor / Supplier</span>
                  <div className="h-px flex-1 bg-amber-100" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select from Directory</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        options={vendors.map((v) => ({ value: v.id!, label: v.name }))}
                        value={qeVendorId}
                        onChange={(vid) => {
                          setQeVendorId(vid);
                          const v = vendors.find((x) => x.id === vid);
                          if (v) {
                            setQeVendorName(v.name || (v as any).nameEn);
                            setQeVendorVAT((v as any).vatNumber || (v as any).vatNo);
                            setQeVendorAutoFilled(true);
                          }
                        }}
                        className="font-bold"
                      />
                    </div>
                    <button
                      onClick={() => setShowAddVendor(true)}
                      className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0"
                      title="Add new vendor"
                    >
                      <Plus size={18} className="text-slate-600" />
                    </button>
                  </div>
                </div>

                {qeVendorAutoFilled ? (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0">
                      {qeVendorName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-800 truncate">{qeVendorName}</div>
                      <div className="text-[10px] text-amber-600 font-bold font-mono mt-0.5">VAT: {qeVendorVAT || '—'}</div>
                    </div>
                    <button
                      onClick={() => { setQeVendorId(''); setQeVendorName(''); setQeVendorVAT(''); setQeVendorAutoFilled(false); }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                      <input type="text" value={qeVendorName} onChange={(e) => setQeVendorName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VAT Number</label>
                      <input type="text" value={qeVendorVAT} onChange={(e) => setQeVendorVAT(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all" />
                    </div>
                  </div>
                )}
                {qeErrors.vendorName && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.vendorName}</p>}
                {qeErrors.vendorVAT && <p className="text-[10px] text-rose-500 font-bold">{qeErrors.vendorVAT}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice / Ref No.</label>
                    <input
                      type="text"
                      value={qeVendorRefNo}
                      onChange={(e) => setQeVendorRefNo(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                      placeholder="INV-2026-..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Related Property</label>
                    <SearchableSelect
                      options={[{ value: '', label: 'General Expense' }, ...nonResidentialBuildings.map((b) => ({ value: b.id, label: b.name }))]}
                      value={qePurchaseBuildingId}
                      onChange={setQePurchaseBuildingId}
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
                  <div className="h-px flex-1 bg-sky-100" />
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Property & Unit</span>
                  <div className="h-px flex-1 bg-sky-100" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</label>
                    <SearchableSelect
                      options={buildings.map((b) => ({ value: b.id, label: b.name || b.id || '(unnamed)' }))}
                      value={qeBuildingId}
                      onChange={handleQEBuildingChange}
                      className="font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
                    <SearchableSelect
                      options={(buildings.find((b) => b.id === qeBuildingId)?.units || [])
                        .map((u: any) => {
                          const v = typeof u === 'string' ? u : u.unitNumber || u.name || '';
                          return { value: v, label: v || '(unnamed)' };
                        })
                        .filter((o) => o.value)}
                      value={qeUnitNumber}
                      onChange={handleQEUnitChange}
                      className="font-bold"
                    />
                    {qeContractLookupLoading && <div className="text-[10px] text-slate-400 font-bold animate-pulse mt-1">Looking up contract…</div>}
                  </div>
                </div>

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

                {qeActiveContract && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-1.5">
                    <div className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-2">Fee Breakdown (No VAT)</div>
                    {[
                      { label: 'Water Fee', val: Number((qeActiveContract as any).waterFee) || 0 },
                      { label: 'Internet Fee', val: Number((qeActiveContract as any).internetFee) || 0 },
                      { label: 'Parking Fee', val: Number((qeActiveContract as any).parkingFee) || 0 },
                      { label: 'Management Fee', val: Number((qeActiveContract as any).managementFee) || 0 },
                    ]
                      .filter((f) => f.val > 0)
                      .map((f) => (
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

                {qeActiveContract && qeNonVatFeesPerInst > 0 && (
                  <button
                    type="button"
                    onClick={() => setQeFeesGenerateInvoice((v) => !v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      qeFeesGenerateInvoice ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      qeFeesGenerateInvoice ? 'bg-sky-500 border-sky-500' : 'border-slate-300'
                    }`}>
                      {qeFeesGenerateInvoice && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
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
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (SAR)</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div
                className={`rounded-2xl border-2 p-5 space-y-4 transition-colors ${
                  qeType === 'FEES' ? 'border-sky-200 bg-sky-50/40' : qeType === 'SALES' ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                {isCurrentVatEntry && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount entered is:</span>
                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Inclusive of VAT</span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="number"
                    value={qeAmount}
                    onChange={(e) => setQeAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
                    placeholder="0.00"
                  />
                </div>
                {qeErrors.amount && <p className="text-[10px] text-rose-500 font-bold -mt-2">{qeErrors.amount}</p>}

                {qeType === 'FEES' && qeAmount && parseFloat(qeAmount) > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2 bg-sky-50 rounded-xl border border-sky-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-[10px] font-black text-sky-700 uppercase tracking-widest">No VAT — Full amount saved as-is</span>
                  </div>
                )}

                {isCurrentVatEntry && qeAmount && parseFloat(qeAmount) > 0 && (() => {
                  const amt = parseFloat(qeAmount);
                  const excl = amt / 1.15;
                  const vat = amt - excl;
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><FileText size={10} /> Description / Notes</label>
              <input
                type="text"
                value={qeDetails}
                onChange={(e) => setQeDetails(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                placeholder="Service description, installment details..."
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-7 py-5 border-t border-slate-100 flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={qeSaving || !qeAmount}
              className={`flex-1 py-3 rounded-xl font-black text-sm text-white transition-all hover:translate-y-[-1px] hover:shadow-lg active:translate-y-0 disabled:opacity-50 disabled:grayscale disabled:translate-y-0 flex items-center justify-center gap-2 shadow-md ${
                qeType === 'FEES'
                  ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                  : qeType === 'SALES'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
              }`}
            >
              {qeSaving ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              {saveLabel}
            </button>
          </div>
        </div>
      </div>

      <AddVendorDialog
        open={showAddVendor}
        onClose={() => setShowAddVendor(false)}
        onAdd={(v: any) => {
          setVendors((prev) => [...prev, v as Vendor]);
          setQeVendorId(v.id!);
          setQeVendorName(v.name);
          setQeVendorVAT(v.vatNumber);
          setQeVendorAutoFilled(true);
        }}
      />
    </>
  );
};

export default VATQuickEntryModal;

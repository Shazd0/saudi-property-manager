import React, { useState, useEffect, useMemo } from 'react';
import { User, Building, Customer, Contract, Task, TaskStatus, Transaction, TransactionType, PaymentMethod, TransactionStatus } from '../types';
import { getBuildings, getCustomers, saveContract, getContracts, isUnitOccupied, saveTask, getTransactions, requestContractFinalize, requestContractDelete, getActiveContract, deleteContract, saveEjarContract } from '../services/firestoreService';
import { Save, RefreshCw, Calculator, CalendarClock, Building2, User as UserIcon, List, PlusCircle, Search, AlertTriangle, Archive, Repeat, CheckCircle, Copy, Clock, Calendar, Wifi, ArrowLeft, ArrowRight, Receipt, Printer, Trash2, RotateCcw, X, Pencil, AlertCircle, FileText } from 'lucide-react';
import SavedFilters from './SavedFilters';
import SearchableSelect from './SearchableSelect';
import { useToast } from './Toast';
import SoundService from '../services/soundService';
import { fmtDate, fmtDateTime, localDateStr, dateToLocalStr } from '../utils/dateFormat';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import { getInstallmentStartDates } from '../utils/installmentSchedule';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmDialog from './ConfirmDialog';
import LoadingOverlay from './LoadingOverlay';
import { useLanguage } from '../i18n';

interface ContractFormProps {
  currentUser: User;
}

// --- FIX APPLIED: Component moved outside to prevent re-rendering/focus loss ---
const InputField = ({ label, value, setter, type = "number", readonly = false, prefix = "", lang = "" }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{label}</label>
    <div className={`relative group ${prefix ? 'form-with-icon has-prefix' : ''}`}>
       {prefix && <span className="absolute start-2 sm:start-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] sm:text-xs z-30 bg-white px-1 sm:px-2 rounded" style={{pointerEvents:'none'}}>{prefix}</span>}
       <input 
        type={type === 'date' ? 'date' : 'text'}
        inputMode={type === 'number' ? 'decimal' : undefined}
        lang={lang || undefined}
        value={value}
        readOnly={readonly}
        onBlur={(e) => {
          if (!setter || type !== 'number') return;
          const val = e.target.value;
          if (val === '' || val === '-' || val === '.') {
            setter(0);
          } else {
            const num = parseFloat(val);
            setter(isNaN(num) ? 0 : num);
          }
        }}
        onChange={(e) => {
          if (!setter) return;
          if (type === 'number') {
            const val = e.target.value;
            // Allow empty, negative sign, decimal point, or valid number format while typing
            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
              setter(val);
            }
          } else {
            setter(e.target.value);
          }
        }}
        className={`w-full ${prefix ? '' : 'ps-3 sm:ps-4'} pe-2 sm:pe-4 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl outline-none text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm ${readonly ? 'bg-slate-100/50 text-slate-500' : ''}`}
      />
    </div>
  </div>
);

const ContractForm: React.FC<ContractFormProps> = ({ currentUser }) => {
    const isAdmin = currentUser.role === 'ADMIN';
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const { showSuccess, showError, showWarning, showToast } = useToast();
  const [view, setView_] = useState<'FORM' | 'LIST' | 'DETAILS'>('FORM');
  const setView = (v: 'FORM' | 'LIST' | 'DETAILS') => { SoundService.play('tab'); setView_(v); };
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dateOnlyMode, setDateOnlyMode] = useState(false);
  
  // Data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const formatCustomerLabel = (c: any) => {
    const code = c?.code ? String(c.code).padStart(2, '0') : '';
    const baseName = c?.nameEn || c?.nameAr || c?.name || c?.id;
    const name = formatNameWithRoom(baseName, c?.roomNumber);
    return code ? `${code} - ${name}` : name;
  };
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => {
    const nameA = (a?.nameEn || a?.nameAr || a?.name || '').toLowerCase();
    const nameB = (b?.nameEn || b?.nameAr || b?.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  }), [customers]);
  const customerRoomMap = useMemo(() => buildCustomerRoomMap(customers), [customers]);
  const displayContractCustomerName = (c: { customerId?: string; customerName?: string } | null | undefined): string => {
    if (!c) return '';
    return formatCustomerFromMap(c.customerName || '', c.customerId || '', customerRoomMap);
  };
  const [existingContracts, setExistingContracts] = useState<Contract[]>([]);
  const [nextContractNo, setNextContractNo] = useState('');
  const [contractsWithProgress, setContractsWithProgress] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [linkedTransactions, setLinkedTransactions] = useState<Transaction[]>([]);
  const [renewalHistory, setRenewalHistory] = useState<Contract[]>([]);
  
  // UI: confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'renew' | 'delete' | 'restore' | 'permanentDelete' | null>(null);
  const [confirmContract, setConfirmContract] = useState<Contract | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkConfirmMessage, setBulkConfirmMessage] = useState('');
  const [bulkConfirmTitle, setBulkConfirmTitle] = useState('Confirm');
  const [bulkConfirmDanger, setBulkConfirmDanger] = useState(false);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<null | (() => void)>(null);

  const openBulkConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
    setBulkConfirmTitle(opts?.title || t('common.confirm'));
    setBulkConfirmDanger(!!opts?.danger);
    setBulkConfirmMessage(message);
    setBulkConfirmAction(() => onConfirm);
    setBulkConfirmOpen(true);
  };
  const closeBulkConfirm = () => {
    setBulkConfirmOpen(false);
    setBulkConfirmMessage('');
    setBulkConfirmAction(null);
  };

  // Expiring threshold
  const EXPIRING_THRESHOLD_DAYS = 90;

  // Filters for LIST
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['Active', 'Expired', 'Old']);
  const [filterBuildingIds, setFilterBuildingIds] = useState<string[]>([]);
  const [filterTenants, setFilterTenants] = useState<string[]>([]);
  const [filterUnits, setFilterUnits] = useState<string[]>([]);
  // Fee-based filter (show only contracts that include the selected fees > 0).
  // Values: 'internet', 'parking', 'office'.
  const [filterFeeTypes, setFilterFeeTypes] = useState<string[]>([]);
  const [showFeeFilter, setShowFeeFilter] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuildingFilter, setShowBuildingFilter] = useState(false);
  const [showTenantFilter, setShowTenantFilter] = useState(false);
  const [showUnitFilter, setShowUnitFilter] = useState(false);
  const [buildingFilterSearch, setBuildingFilterSearch] = useState('');
  const [tenantFilterSearch, setTenantFilterSearch] = useState('');
  const [unitFilterSearch, setUnitFilterSearch] = useState('');

  // Close filter dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-filter-dropdown]')) {
        setShowBuildingFilter(false);
        setShowTenantFilter(false);
        setShowUnitFilter(false);
        setShowFeeFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  // Form State
  const [contractDate, setContractDate] = useState(localDateStr());
  const [buildingId, setBuildingId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]); // For multiple unit selection
  const [unitSearch, setUnitSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  
  // Financials
  const [rentValue, setRentValue] = useState<number | string>(0); 
  const [waterFee, setWaterFee] = useState<number | string>(0);
  const [internetFee, setInternetFee] = useState<number | string>(0); 
  const [officePercent, setOfficePercent] = useState<number | string>(2.5);
  // Base rates for duration-based auto-calculation
  const [baseAnnualRent, setBaseAnnualRent] = useState<number>(0);
  const [monthlyWaterRate, setMonthlyWaterRate] = useState<number | string>(0);
  const [officeFeeAmountInput, setOfficeFeeAmountInput] = useState<string>('');
  const [officeFeeTouched, setOfficeFeeTouched] = useState(false);
  const [insuranceFee, setInsuranceFee] = useState<number | string>(0);
  const [serviceFee, setServiceFee] = useState<number | string>(0);
  const [otherDeduction, setOtherDeduction] = useState<number | string>(0); 
  const [otherAmount, setOtherAmount] = useState<number | string>(0);
  const [upfrontPaid, setUpfrontPaid] = useState<number | string>(0);
  
  // NEW FIELDS
  const [parkingFee, setParkingFee] = useState<number | string>(0);
  const [managementFee, setManagementFee] = useState<number | string>(0);
  const [electricityMeter, setElectricityMeter] = useState('');
  
  // Installments
  const [installmentCount, setInstallmentCount] = useState<number | string>(2); 
  
  // Period
  const [periodMonths, setPeriodMonths] = useState<number | string>(12);
  const [periodDays, setPeriodDays] = useState<number | string>(0);
  const [fromDate, setFromDate] = useState(localDateStr());
  const [toDate, setToDate] = useState('');
  const [notes, setNotes] = useState('');
  const [autoPayment, setAutoPayment] = useState(false);
  
  const [renewalSourceId, setRenewalSourceId] = useState<string | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [isWeekendStart, setIsWeekendStart] = useState(false);

  // --- PRECISE MATH LOGIC ---
  const toNum = (val: number | string) => typeof val === 'string' ? (parseFloat(val) || 0) : (val || 0);
  
  const calculations = useMemo(() => {
    const b = buildings.find(b => b.id === buildingId);
    const isVAT = b?.propertyType === 'NON_RESIDENTIAL' || b?.vatApplicable;

    const upfront = Math.max(0, toNum(upfrontPaid));
    const officeFeeAmount = Math.max(0, toNum(officeFeeAmountInput));
    // For renewals: insurance is recorded but NOT added to total (already paid in original contract)
    const insuranceForTotal = renewalSourceId ? 0 : toNum(insuranceFee);
    const subtotal = (toNum(rentValue) + toNum(waterFee) + toNum(internetFee) + toNum(parkingFee) + toNum(managementFee) + insuranceForTotal + toNum(serviceFee) + officeFeeAmount + toNum(otherAmount)) - toNum(otherDeduction);
    
    // Contract stores EXCLUSIVE amounts — VAT is tracked separately in the VAT Report tab
    const totalValue = Math.max(0, subtotal - upfront);

    const count = toNum(installmentCount) || 1;
    const rentPerInstallment = toNum(rentValue) / count;
    const waterPerInstallment = toNum(waterFee) / count;
    const internetPerInstallment = toNum(internetFee) / count;
    const parkingPerInstallment = toNum(parkingFee) / count;
    const managementPerInstallment = toNum(managementFee) / count;
    
    // --- VAT-applicable portion: rent only ---
    const rentOnlyPerInstallment = rentPerInstallment;
    const rentOnlyTotal = toNum(rentValue);
    // One-time fees added to first rent installment (insurance, service, office, extra minus deduction)
    const oneTimeFees = (insuranceForTotal + toNum(serviceFee) + officeFeeAmount + toNum(otherAmount) - toNum(otherDeduction));
    const rentFirstInstallment = Math.max(0, Math.round(rentOnlyPerInstallment + oneTimeFees) - upfront);
    const rentOtherInstallment = Math.round(rentOnlyPerInstallment);

    // --- Non-VAT fees: water + internet + parking + management ---
    const nonVatFeesPerInstallment = waterPerInstallment + internetPerInstallment + parkingPerInstallment + managementPerInstallment;
    const nonVatFeesTotal = toNum(waterFee) + toNum(internetFee) + toNum(parkingFee) + toNum(managementFee);
    const nonVatFirstInstallment = Math.round(nonVatFeesPerInstallment);
    const nonVatOtherInstallment = Math.round(nonVatFeesPerInstallment);

    // --- Combined installments (for contract total tracking) ---
    const periodicTotal = rentPerInstallment + waterPerInstallment + internetPerInstallment + parkingPerInstallment + managementPerInstallment;
    const otherInstallment = Math.round(periodicTotal);
    const baseFirstInstallment = Math.round(periodicTotal + oneTimeFees);
    const firstInstallment = Math.max(0, baseFirstInstallment - upfront);

    // Calculate upfront coverage: which installments are covered sequentially
    let upfrontRemaining = upfront;
    let coveredCount = 0;
    let partialAmount = 0;
    if (upfrontRemaining > 0) {
      const fromFirst = Math.min(upfrontRemaining, baseFirstInstallment);
      upfrontRemaining -= fromFirst;
      if (fromFirst >= baseFirstInstallment) coveredCount++;
      else partialAmount = baseFirstInstallment - fromFirst;
      for (let i = 2; i <= count && upfrontRemaining > 0; i++) {
        const fromThis = Math.min(upfrontRemaining, otherInstallment);
        upfrontRemaining -= fromThis;
        if (fromThis >= otherInstallment) coveredCount++;
        else partialAmount = otherInstallment - fromThis;
      }
    }

    return { 
      officeFeeAmount, 
      totalValue: Math.round(totalValue), 
      firstInstallment: Math.round(firstInstallment), 
      otherInstallment: Math.round(otherInstallment), 
      baseFirstInstallment: Math.round(baseFirstInstallment), 
      isVAT,
      upfrontCoverage: upfront > 0 ? { coveredCount, partialAmount, total: upfront } : null,
      // Split: VAT-applicable (rent) vs Non-VAT (utility fees)
      rentOnlyTotal: Math.round(rentOnlyTotal),
      rentFirstInstallment,
      rentOtherInstallment,
      nonVatFeesTotal: Math.round(nonVatFeesTotal),
      nonVatFirstInstallment,
      nonVatOtherInstallment,
    };
  }, [rentValue, waterFee, internetFee, parkingFee, managementFee, insuranceFee, serviceFee, officeFeeAmountInput, otherAmount, otherDeduction, installmentCount, upfrontPaid, renewalSourceId, buildings, buildingId]);

  const { officeFeeAmount, totalValue, firstInstallment, otherInstallment, baseFirstInstallment: _baseFirst, upfrontCoverage, isVAT: calcIsVAT, rentOnlyTotal, rentFirstInstallment, rentOtherInstallment, nonVatFeesTotal, nonVatFirstInstallment, nonVatOtherInstallment } = calculations;

  useEffect(() => {
    if (officeFeeTouched) return;
    const rent = toNum(rentValue);
    const defaultAmount = rent * 0.025;
    setOfficeFeeAmountInput(defaultAmount ? defaultAmount.toFixed(2) : '0');
  }, [rentValue, officeFeeTouched]);

  useEffect(() => {
    const rent = toNum(rentValue);
    const amount = toNum(officeFeeAmountInput);
    const nextPercent = rent > 0 ? (amount / rent) * 100 : 0;
    setOfficePercent(Number(nextPercent.toFixed(2)));
  }, [rentValue, officeFeeAmountInput]);

  useEffect(() => { (async () => {
    const blds = await getBuildings() || [];
    const custs = await getCustomers() || [];
    // Restrict buildings for non-admins/managers to their assigned buildings (supports multiple)
    const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER' && userBuildingIds.length > 0) {
      setBuildings(blds.filter((b: any) => userBuildingIds.includes(b.id)));
    } else {
      setBuildings(blds);
    }
    setCustomers(custs);
    await refreshContracts();

    // Auto-filter by customer when navigating from CustomerManager
    const filterCustomerName = (location.state as any)?.filterCustomerName;
    if (filterCustomerName) {
      setSearchQuery(filterCustomerName);
      setView('LIST');
      window.history.replaceState({}, document.title);
    }
  })(); }, []);

  const refreshContracts = async () => {
    const all = await getContracts({ includeDeleted: true }) || [];
    const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
    const txs = await getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds }) || [];
    setExistingContracts([...all]);
    
    const withProgress = all.map(c => {
        const contractFrom = (c as any).fromDate || '';
        // For Active contracts: only count payments from the current period start date
        // (handles legacy in-place renewals where old payments share the same contractId).
        // For historical contracts (Old N, Expired, Terminated): count all linked payments.
        const isActiveContract = c.status === 'Active';
        const bld = buildings.find(b => b.id === c.buildingId);
        const isVAT = bld?.propertyType === 'NON_RESIDENTIAL' || bld?.vatApplicable === true;
        const paidRaw = txs.filter(t => {
          if (t.status === 'REJECTED') return false;
          // Exclude non-VAT fees — they are tracked separately, not part of rent progress
          if ((t as any).feesEntry) return false;
          if (t.contractId === c.id) {
            if (isActiveContract && contractFrom) {
              return t.date >= contractFrom;
            }
            return true;
          }
          const txDate = t.date || '';
          const cFrom = c.fromDate || '';
          const cTo = c.toDate || '';
          if (t.buildingId === c.buildingId && t.unitNumber === c.unitName && txDate >= cFrom && txDate <= cTo) return true;
          return false;
        }).reduce((sum, t) => sum + (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) + (Number((t as any).discountAmount) || 0), 0);
        const upfrontPaid = Number((c as any).upfrontPaid || 0);
        const paid = paidRaw + upfrontPaid;
        // For VAT buildings: effective total = exclusive total + VAT on rent + VAT on one-time fees
        const rentValue = Number((c as any).rentValue || 0);
        const vatOnRent = isVAT ? rentValue * 0.15 : 0;
        const totalInst = c.installmentCount || 1;
        const otherAmtExcl = Number(c.otherInstallment || 0);
        const firstAmtExcl = Number(c.firstInstallment || 0) + upfrontPaid;
        const vatOnOneTime = isVAT ? Math.max(0, firstAmtExcl - otherAmtExcl) * 0.15 : 0;
        const effectiveTotal = (c.totalValue || 0) + upfrontPaid + vatOnRent + vatOnOneTime;
        const percent = effectiveTotal > 0 ? Math.min(100, Math.round((paid / effectiveTotal) * 100)) : 0;
        
        const endStr = c.toDate || c.endDate || '';
        const end = endStr ? new Date(endStr + 'T00:00:00') : new Date();
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return { ...c, paidPercent: percent, daysRemaining: diffDays };
    });
    setContractsWithProgress(withProgress);

    const max = all.reduce((m, c) => Math.max(m, parseInt(c.contractNo) || 0), 1000);
    setNextContractNo((max + 1).toString());
  }

  useEffect(() => {
    if (buildingId && unitName && !renewalSourceId && !editingContractId) {
      const b = buildings.find(b => b.id === buildingId);
      const u = b?.units.find(u => u.name === unitName);
      if (u) {
        setBaseAnnualRent(u.defaultRent);
        // Auto-scale rent based on current duration
        const months = toNum(periodMonths);
        const days = toNum(periodDays);
        const durationFraction = (months + days / 30) / 12;
        setRentValue(Math.round(u.defaultRent * durationFraction));
      }
    }
  }, [buildingId, unitName, buildings, renewalSourceId, editingContractId]);

  // Auto-calculate rent from selected units (only for new contracts, not renewals/edits)
  useEffect(() => {
    if (buildingId && selectedUnits.length > 0 && !renewalSourceId && !editingContractId) {
      const building = buildings.find(b => b.id === buildingId);
      if (building) {
        const totalAnnualRent = selectedUnits.reduce((sum, unitName) => {
          const unit = building.units.find(u => u.name === unitName);
          return sum + (unit?.defaultRent || 0);
        }, 0);
        setBaseAnnualRent(totalAnnualRent);
        // Auto-scale rent based on current duration
        const months = toNum(periodMonths);
        const days = toNum(periodDays);
        const durationFraction = (months + days / 30) / 12;
        setRentValue(Math.round(totalAnnualRent * durationFraction));
      }
    }
  }, [selectedUnits, buildingId, buildings, renewalSourceId, editingContractId]);

  // Auto-calculate rent value and water fee when duration changes
  useEffect(() => {
    const months = toNum(periodMonths);
    const days = toNum(periodDays);
    const totalMonths = months + days / 30;
    if (totalMonths > 0 && baseAnnualRent > 0) {
      const durationFraction = totalMonths / 12;
      setRentValue(Math.round(baseAnnualRent * durationFraction));
    }
    if (totalMonths > 0 && toNum(monthlyWaterRate) > 0) {
      setWaterFee(Math.round(toNum(monthlyWaterRate) * (totalMonths / 12)));
    }
  }, [periodMonths, periodDays, baseAnnualRent, monthlyWaterRate]);

  useEffect(() => {
    if (fromDate && (periodMonths || periodDays)) {
      const months = toNum(periodMonths);
      const days = toNum(periodDays);
      const d = new Date(fromDate + 'T00:00:00');
      d.setMonth(d.getMonth() + months);
      d.setDate(d.getDate() + days - 1);
      setToDate(dateToLocalStr(d));
      
      const day = new Date(fromDate + 'T00:00:00').getDay();
      setIsWeekendStart(day === 5 || day === 6);
    }
  }, [fromDate, periodMonths, periodDays]);

  const isRestrictedEdit = !isAdmin && !!editingContractId;
  const isRenewal = !!renewalSourceId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    setErrorMsg('');
    
    if (!buildingId || (!unitName && selectedUnits.length === 0) || !customerId) {
      showWarning(t('contract.fillRequired'));
      return;
    }
    
    // Validate: Check if using multiple units or single unit
    const unitsToCheck = selectedUnits.length > 0 ? selectedUnits : [unitName];
    
    // Validate all selected units
    for (const unit of unitsToCheck) {
      if (!unit) continue;
      const occupied = await isUnitOccupied(buildingId, unit);
      if (occupied) {
        const active = await getActiveContract(buildingId, unit).catch(() => null);
        if (active && active.id !== renewalSourceId && active.id !== editingContractId) {
          setErrorMsg(t('contract.unitOccupied', { unit, contractNo: active.contractNo }));
          return;
        }
      }
    }
    
    // Use comma-separated units if multiple selected
    const finalUnitName = selectedUnits.length > 0 ? selectedUnits.join(', ') : unitName;

    setLoading(true);
    const building = buildings.find(b => b.id === buildingId);
    const customer = customers.find(c => c.id === customerId);

    // If renewing an existing contract: mark old contract as Renewed, create a new contract
    let savedContract: Contract;
    if (renewalSourceId) {
      // 1. Mark the old contract as "Old N" — count how many Old contracts already exist for this unit
      const sourceExisting = (await getContracts({ includeDeleted: true }))?.find((c: any) => c.id === renewalSourceId);
      const allContracts = await getContracts({ includeDeleted: true }) || [];
      const oldCount = allContracts.filter((c: any) =>
        c.buildingId === buildingId &&
        c.unitName === finalUnitName &&
        typeof c.status === 'string' && c.status.startsWith('Old ')
      ).length;
      const oldStatus = `Old ${oldCount + 1}`;
      if (sourceExisting) {
        await saveContract({ ...sourceExisting, status: oldStatus } as any);
      }

      // 2. Create a brand-new contract for the renewal period
      const newContract: Contract = {
        id: crypto.randomUUID(),
        contractNo: nextContractNo,
        contractDate,
        status: 'Active',
        buildingId,
        buildingName: building?.name || '',
        unitName: finalUnitName,
        customerId,
        customerName: customer?.nameEn || '',
        rentValue: toNum(rentValue),
        waterFee: toNum(waterFee),
        internetFee: toNum(internetFee),
        insuranceFee: toNum(insuranceFee),
        serviceFee: toNum(serviceFee),
        officePercent: toNum(officePercent),
        officeFeeAmount,
        otherDeduction: toNum(otherDeduction),
        otherAmount: toNum(otherAmount),
        upfrontPaid: toNum(upfrontPaid),
        totalValue,
        installmentCount: toNum(installmentCount),
        firstInstallment,
        otherInstallment,
        periodMonths: toNum(periodMonths),
        periodDays: toNum(periodDays),
        fromDate,
        toDate,
        notes,
        autoPayment,
        createdBy: currentUser.id,
        renewedFromId: renewalSourceId,
        parkingFee: toNum(parkingFee),
        managementFee: toNum(managementFee),
        electricityMeter,
        rentOnlyInstallment: rentOtherInstallment,
        nonVatFeesInstallment: nonVatOtherInstallment,
      };
      await saveContract(newContract);
      savedContract = newContract;
    } else if (editingContractId) {
      // preserve contract number and id
      const sourceId = editingContractId;
      const existing = (await getContracts({ includeDeleted: true }))?.find((c: any) => c.id === sourceId);
      const contractNoToUse = existing ? existing.contractNo : nextContractNo;

      // Track staff edits
      const currentEditCount = (existing ? (existing.staffEditCount || 0) : 0);
      const nextEditCount = !isAdmin ? currentEditCount + 1 : currentEditCount;

      const updated: Contract = {
        id: sourceId,
        contractNo: contractNoToUse,
        contractDate,
        status: 'Active',
        buildingId,
        buildingName: building?.name || '',
        unitName: finalUnitName,
        customerId,
        customerName: customer?.nameEn || '',
        rentValue: toNum(rentValue),
        waterFee: toNum(waterFee),
        internetFee: toNum(internetFee),
        insuranceFee: toNum(insuranceFee),
        serviceFee: toNum(serviceFee),
        officePercent: toNum(officePercent),
        officeFeeAmount,
        otherDeduction: toNum(otherDeduction),
        otherAmount: toNum(otherAmount),
        upfrontPaid: toNum(upfrontPaid),
        totalValue,
        installmentCount: toNum(installmentCount),
        firstInstallment,
        otherInstallment,
        periodMonths: toNum(periodMonths),
        periodDays: toNum(periodDays),
        fromDate,
        toDate,
        notes: notes || (existing ? existing.notes : ''),
        autoPayment,
        createdBy: existing ? existing.createdBy : currentUser.id,
        staffEditCount: nextEditCount,
        parkingFee: toNum(parkingFee),
        managementFee: toNum(managementFee),
        electricityMeter,
        rentOnlyInstallment: rentOtherInstallment,
        nonVatFeesInstallment: nonVatOtherInstallment,
      };
      await saveContract(updated);
      savedContract = updated;
    } else {
      const newContract: Contract = {
        id: crypto.randomUUID(),
        contractNo: nextContractNo,
        contractDate,
        status: 'Active',
        buildingId,
        buildingName: building?.name || '',
        unitName: finalUnitName,
        customerId,
        customerName: customer?.nameEn || '',
        rentValue: toNum(rentValue),
        waterFee: toNum(waterFee),
        internetFee: toNum(internetFee),
        insuranceFee: toNum(insuranceFee),
        serviceFee: toNum(serviceFee),
        officePercent: toNum(officePercent),
        officeFeeAmount,
        otherDeduction: toNum(otherDeduction),
        otherAmount: toNum(otherAmount),
        upfrontPaid: toNum(upfrontPaid),
        totalValue,
        installmentCount: toNum(installmentCount),
        firstInstallment,
        otherInstallment,
        periodMonths: toNum(periodMonths),
        periodDays: toNum(periodDays),
        fromDate,
        toDate,
        notes,
        autoPayment,
        createdBy: currentUser.id,
        parkingFee: toNum(parkingFee),
        managementFee: toNum(managementFee),
        electricityMeter,
        rentOnlyInstallment: rentOtherInstallment,
        nonVatFeesInstallment: nonVatOtherInstallment,
      };

      await saveContract(newContract);
      savedContract = newContract;
    }
    // Auto-Task
    const schedule = getInstallmentStartDates({
      fromDate,
      toDate,
      periodMonths: toNum(periodMonths),
      periodDays: toNum(periodDays),
      installmentCount: toNum(installmentCount),
    });
    const nextMonth = schedule[1] || schedule[0] || new Date(fromDate + 'T00:00:00');
    await saveTask({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title: `Collect Rent Installment 2 - ${formatNameWithRoom(customer?.nameEn || '', customer?.roomNumber)}`,
        status: TaskStatus.TODO,
        priority: 'HIGH',
        dueDate: dateToLocalStr(nextMonth),
        createdAt: Date.now()
    });

    // Auto-create Ejar Draft record for new contracts and renewals
    if (!editingContractId) {
      try {
        await saveEjarContract({
          id: crypto.randomUUID(),
          contractId: savedContract.id,
          ejarNumber: '',
          registrationDate: new Date().toISOString().slice(0, 10),
          status: 'Draft',
          tenantIdNo: customer?.idNo || '',
          tenantName: customer?.nameEn || customer?.nameAr || '',
          landlordIdNo: '',
          landlordName: '',
          buildingId: savedContract.buildingId,
          buildingName: savedContract.buildingName,
          unitName: savedContract.unitName,
          rentAmount: savedContract.rentValue,
          startDate: savedContract.fromDate,
          endDate: savedContract.toDate,
          paymentFrequency: 'Yearly',
          notes: 'Auto-created from contract — register on Ejar portal and update Ejar number',
          lastSyncDate: new Date().toISOString(),
          createdAt: Date.now(),
        });
      } catch (_) { /* Ejar draft creation is non-blocking */ }
    }

    setLoading(false);
    setSuccess(t('contract.saved'));
    setTimeout(() => setSuccess(''), 2000);
    resetForm();
    await refreshContracts();
  };

  const resetForm = () => {
    setContractDate(localDateStr());
    setBuildingId(''); setUnitName(''); setSelectedUnits([]); setUnitSearch('');
    setCustomerId(''); setRentValue(0); setWaterFee(0); setInternetFee(0); setInsuranceFee(0); setServiceFee(0);
    setOtherDeduction(0); setOtherAmount(0); setUpfrontPaid(0); setInstallmentCount(2);
    setPeriodMonths(12); setPeriodDays(0); setFromDate(localDateStr()); setToDate(''); setNotes('');
    setAutoPayment(false);
    setBaseAnnualRent(0); setMonthlyWaterRate(0);
    setRenewalSourceId(null); setEditingContractId(null); setIsWeekendStart(false); setErrorMsg('');
    setOfficeFeeTouched(false); setOfficeFeeAmountInput(''); setOfficePercent(2.5);
    setDateOnlyMode(false);
    setParkingFee(0); setManagementFee(0); setElectricityMeter('');
  };

  const handleEditContract = (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    
    // Check editing limit for staff (only once)
    // EXCEPTION: Allow editing if it's just a date correction (handled in UI, but block full save here if needed?)
    // Actually, user requirement "you should be able to edit the starting date" implies maybe they couldn't?
    // Let's check if there are other blockers. The InputField for "Start Date" is not readonly.
    
    const edits = c.staffEditCount || 0;
    if (!isAdmin && edits >= 1) {
      showWarning(t('contract.restrictedEdit'));
      setDateOnlyMode(true);
      // Removed return to allow editing dates
    } else {
      setDateOnlyMode(false);
    }

    // Load contract into form for editing
    setEditingContractId(c.id);
    setRenewalSourceId(null);
    setBuildingId(c.buildingId); setUnitName(c.unitName); setCustomerId(c.customerId);
    
    // Auto-select units (handle comma-separated list if multiple)
    if (c.unitName) {
      if (c.unitName.includes(',')) {
        const units = c.unitName.split(',').map(u => u.trim()).filter(Boolean);
        setSelectedUnits(units);
      } else {
        setSelectedUnits([c.unitName]);
      }
    }
    
    setContractDate(c.contractDate || localDateStr());
    setRentValue(c.rentValue); setWaterFee(c.waterFee); setInternetFee(c.internetFee || 0);
    setInsuranceFee(c.insuranceFee); setServiceFee(c.serviceFee);
    setOtherDeduction(c.otherDeduction); setOtherAmount(c.otherAmount || 0);
    setUpfrontPaid((c as any).upfrontPaid || 0);
    setInstallmentCount(c.installmentCount || 2);
    setPeriodMonths(c.periodMonths || 12); setPeriodDays((c as any).periodDays || 0);
    setFromDate(c.fromDate); setNotes(c.notes || '');
    setAutoPayment(!!(c as any).autoPayment);
    setOfficeFeeAmountInput((c.officeFeeAmount ?? 0).toFixed(2));
    setOfficeFeeTouched(true);
    // Derive base rates
    const editMonths = c.periodMonths || 12;
    const editDays = (c as any).periodDays || 0;
    const editTotalMonths = editMonths + editDays / 30;
    setBaseAnnualRent(editTotalMonths > 0 ? Math.round(c.rentValue / editTotalMonths * 12) : c.rentValue);
    setMonthlyWaterRate(editTotalMonths > 0 ? Math.round(c.waterFee / (editTotalMonths / 12)) : 0);
    setParkingFee(c.parkingFee || 0);
    setManagementFee(c.managementFee || 0);
    setElectricityMeter(c.electricityMeter || '');
    setView('FORM');
  };

  const handleFinalize = async (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    openConfirm('finalize', c);
  };

  const handleRenew = (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    openConfirm('renew', c);
  };

  const handleDelete = (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    openConfirm('delete', c);
  };

  const handleRestore = (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    openConfirm('restore', c);
  };

  const handlePermanentDelete = (e: React.MouseEvent, c: Contract) => {
    e.stopPropagation();
    openConfirm('permanentDelete', c);
  };

  const openConfirm = async (action: 'finalize' | 'renew' | 'delete' | 'restore' | 'permanentDelete', c: Contract) => {
    // Check if contract has payment transactions
    const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
    const allTx = await getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds }) || [];
    const contractTransactions = allTx.filter(t => t.contractId === c.id && !(t as any).deleted);
    
    if (action === 'finalize' && contractTransactions.length > 0) {
      setConfirmAction(action);
      setConfirmContract(c);
      setConfirmMessage(
        t('contract.linkedTransactionsWarning', { 'c.contractNo': c.contractNo, count: String(contractTransactions.length) })
      );
      setConfirmOpen(true);
      return;
    }

    if ((action === 'delete' || action === 'permanentDelete') && contractTransactions.length > 0) {
      showError(t('contract.cannotDeleteLinked', { 'c.contractNo': c.contractNo, count: String(contractTransactions.length) }));
      return;
    }
    
    setConfirmAction(action);
    setConfirmContract(c);
    if (action === 'finalize') setConfirmMessage(t('contract.finalizeConfirm', { 'c.contractNo': c.contractNo }));
    if (action === 'renew') setConfirmMessage(t('contract.renewConfirm', { 'c.contractNo': c.contractNo }));
    if (action === 'delete') setConfirmMessage(t('contract.moveToTrash', { 'c.contractNo': c.contractNo }));
    if (action === 'restore') setConfirmMessage(t('contract.restore', { 'c.contractNo': c.contractNo }));
    if (action === 'permanentDelete') setConfirmMessage(t('contract.permanentDelete', { 'c.contractNo': c.contractNo }));
    setConfirmOpen(true);
  };

  const closeConfirm = () => { setConfirmOpen(false); setConfirmAction(null); setConfirmContract(null); setConfirmMessage(''); };

  const handleConfirm = async () => {
    if (!confirmAction || !confirmContract) { closeConfirm(); return; }
    const c = confirmContract;
    if (confirmAction === 'finalize') {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') {
        const updated: Contract = { ...c, status: 'Terminated' };
        await saveContract(updated);
        setSuccess(t('contract.finalized'));
      } else {
        const updated: Contract = { ...c, status: 'Terminated' };
        await requestContractFinalize(currentUser.id, c.id, updated);
        setSuccess(t('contract.finalizeSubmitted'));
      }
      await refreshContracts();
    }

    if (confirmAction === 'delete') {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') {
        const updated = { ...c, deleted: true, deletedAt: Date.now(), deletedBy: currentUser.id } as any;
        await saveContract(updated);
        showToast(t('contract.movedToTrash', { 'c.contractNo': c.contractNo }), 'info', 6000, 'Undo', async () => {
          const restored = { ...updated, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
          await saveContract(restored);
          showSuccess(t('contract.restored', { 'c.contractNo': c.contractNo }));
          await refreshContracts();
        });
      } else {
        const payload = { ...c, deleted: true, deletedAt: Date.now(), deletedBy: currentUser.id };
        await requestContractDelete(currentUser.id, c.id, payload);
        setSuccess(t('contract.deleteSubmitted'));
      }
      await refreshContracts();
    }

    if (confirmAction === 'restore') {
      if (currentUser.role === 'ADMIN') {
        const updated = { ...c, deleted: false, deletedAt: undefined, deletedBy: undefined } as any;
        await saveContract(updated);
        showSuccess(t('contract.restoredSuccess', { 'c.contractNo': c.contractNo }));
      } else {
        showError(t('contract.onlyAdminRestore'));
      }
      await refreshContracts();
    }

    if (confirmAction === 'permanentDelete') {
      if (currentUser.role === 'ADMIN') {
        await deleteContract(c.id);
        showSuccess(t('contract.permanentlyDeleted', { 'c.contractNo': c.contractNo }));
      } else {
        showError(t('contract.onlyAdminDelete'));
      }
      await refreshContracts();
    }

    if (confirmAction === 'renew') {
      setRenewalSourceId(c.id);
      setBuildingId(c.buildingId); setUnitName(c.unitName); setCustomerId(c.customerId);
      
      // Auto-select units for renewal
      if (c.unitName) {
         if (c.unitName.includes(',')) {
           const units = c.unitName.split(',').map(u => u.trim()).filter(Boolean);
           setSelectedUnits(units);
         } else {
           setSelectedUnits([c.unitName]);
         }
      }

      setRentValue(c.rentValue); setWaterFee(c.waterFee); setInternetFee(c.internetFee || 0);
      // Derive base rates for renewal auto-calc
      const renewMonths = c.periodMonths || 12;
      const renewDays = (c as any).periodDays || 0;
      const renewTotalMonths = renewMonths + renewDays / 30;
      setBaseAnnualRent(renewTotalMonths > 0 ? Math.round(c.rentValue / renewTotalMonths * 12) : c.rentValue);
      setMonthlyWaterRate(renewTotalMonths > 0 ? Math.round(c.waterFee / (renewTotalMonths / 12)) : 0);
      // For renewal: office charges and upfront should NOT be charged again, but show previous insurance for reference
      setOfficeFeeAmountInput('0');
      setOfficeFeeTouched(true);
      // Show previous insurance value (for contract record), it won't be included in installment calculation
      setInsuranceFee(c.insuranceFee || 0); 
      setServiceFee(c.serviceFee || 0); 
      setOtherDeduction(c.otherDeduction || 0);
      setOtherAmount(c.otherAmount || 0); 
      setUpfrontPaid(0); 
      setInstallmentCount(c.installmentCount || 2);
      setPeriodMonths(c.periodMonths || 12);
      setPeriodDays((c as any).periodDays || 0);
      setParkingFee(c.parkingFee || 0); setManagementFee(c.managementFee || 0); setElectricityMeter(c.electricityMeter || '');
      setAutoPayment(!!(c as any).autoPayment);
      const oldEndDate = new Date(c.toDate + 'T00:00:00');
      oldEndDate.setDate(oldEndDate.getDate() + 1);
      setFromDate(dateToLocalStr(oldEndDate));
      setView('FORM');
    }

    setTimeout(() => setSuccess(''), 2500);
    closeConfirm();
  };

  const renderConfirmModal = () => {
    if (!confirmOpen || !confirmContract) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
        <div className="absolute inset-0 bg-black/40" onClick={closeConfirm}></div>
        <div className="bg-white p-6 rounded-2xl shadow-xl z-10 w-full max-w-md">
          <h4 className="font-bold text-slate-800 mb-3">{t('common.confirm')}</h4>
          <div className="text-slate-600 text-sm mb-6">{confirmMessage}</div>
          <div className="flex justify-end gap-3">
            <button onClick={closeConfirm} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">{t('common.cancel')}</button>
            <button onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold">{t('common.confirm')}</button>
          </div>
        </div>
      </div>
    );
  };

  const handleRestoreAll = () => {
    const deleted = contractsWithProgress.filter((c: any) => (c as any).deleted);
    if (deleted.length === 0) return;
    openBulkConfirm(t('contract.restoreAll', { count: String(deleted.length) }), async () => {
      try {
        await Promise.all(deleted.map((c: any) => saveContract({ ...c, deleted: false, deletedAt: undefined, deletedBy: undefined } as any)));
        showSuccess(t('contract.allRestored'));
        await refreshContracts();
      } catch (error) {
        console.error('Restore all contracts error:', error);
        showError(t('contract.failedRestoreAll'));
      }
      closeBulkConfirm();
    });
  };

  const handleDeleteAll = () => {
    const deleted = contractsWithProgress.filter((c: any) => (c as any).deleted);
    if (deleted.length === 0) return;
    openBulkConfirm(t('contract.permanentDeleteAll', { count: String(deleted.length) }), async () => {
      try {
        await Promise.all(deleted.map((c: any) => deleteContract(c.id)));
        showSuccess(t('contract.allDeleted'));
        await refreshContracts();
      } catch (error) {
        console.error('Delete all contracts error:', error);
        showError(t('contract.failedDeleteAll'));
      }
      closeBulkConfirm();
    }, { danger: true, title: t('contract.deleteAllTitle') });
  };

    const openDetails = async (c: Contract) => {
      setSelectedContract(c);
      const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
      const allTx = await getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds }) || [];
      const contractFrom = (c as any).fromDate || '';
      const isActiveContract = c.status === 'Active';
      const txs = allTx.filter(t => {
        if (t.contractId === c.id) return true;
        // Fallback for non-residential or manually entered transactions: match by building, unit and date range
        const txDate = t.date || '';
        const cFrom = c.fromDate || '';
        const cTo = c.toDate || '';
        if (t.buildingId === c.buildingId && t.unitNumber === c.unitName && txDate >= cFrom && txDate <= cTo) return true;
        return false;
      });
      setLinkedTransactions(txs);

      // Build renewal history chain by walking renewedFromId backwards
      const allContracts = existingContracts.length > 0 ? existingContracts : await getContracts({ includeDeleted: true }) || [];
      const history: Contract[] = [];
      let current = c;
      while ((current as any).renewedFromId) {
        const prev = allContracts.find((x: any) => x.id === (current as any).renewedFromId);
        if (!prev) break;
        history.push(prev as Contract);
        current = prev as Contract;
      }
      setRenewalHistory(history);

      setView('DETAILS');
    };

    const computeNextInstallment = (c: Contract, txs: Transaction[]) => {
      const validTxs = txs.filter(t => t.status !== TransactionStatus.REJECTED && !(t as any).deleted && !(t as any).feesEntry);
      const upfrontPaid = Number((c as any).upfrontPaid || 0);
      const totalInst = c.installmentCount || 1;
      const totalValueStored = Number(c.totalValue || 0);

      // Use EXCLUSIVE amounts for installment detection (consistent with contract stored values)
      // Non-VAT fees entries are excluded above (they don't count toward rent installments)
      const totalPaidRaw = validTxs.reduce((sum, t) => sum + (Number(t.amount) || 0) + (Number((t as any).discountAmount) || 0), 0);
      const totalPaid = totalPaidRaw + upfrontPaid;

      const otherAmt = Number(c.otherInstallment || 0);
      let firstAmt = Number(c.firstInstallment || 0) + upfrontPaid;
      const effectiveTotal = totalValueStored + upfrontPaid;

      const sumInst = firstAmt + (otherAmt * Math.max(0, totalInst - 1));
      if (effectiveTotal > 0 && Math.abs(sumInst - effectiveTotal) > Math.max(5, totalInst)) {
        firstAmt = Math.max(0, effectiveTotal - (otherAmt * Math.max(0, totalInst - 1)));
      }

      let cumulative = 0;
      for (let i = 1; i <= totalInst; i++) {
        const instAmount = i === 1 ? firstAmt : otherAmt;
        cumulative += instAmount;
        if (totalPaid < cumulative) {
          const prevCumulative = cumulative - instAmount;
          const paidTowards = Math.max(0, totalPaid - prevCumulative);
          const due = Math.max(0, instAmount - paidTowards);
          return { installmentNo: i, amount: due, isPartial: paidTowards > 0 };
        }
      }

      return { installmentNo: totalInst, amount: 0, isPartial: false };
    };

    const handleQuickPayment = (c: Contract) => {
      const { installmentNo, amount, isPartial } = computeNextInstallment(c, linkedTransactions);
      if (amount <= 0) {
        showWarning(t('contract.fullyPaid', { num: c.contractNo }));
        return;
      }
      const b = buildings.find(x => x.id === c.buildingId);
      const paymentMethod = b?.bankName ? PaymentMethod.BANK : PaymentMethod.CASH;
      const custLabel = displayContractCustomerName(c);
      const details = isPartial
        ? `Balance Payment - Installment ${installmentNo} - ${custLabel}`
        : `Installment ${installmentNo} of ${c.installmentCount || 1} - ${custLabel}`;

      navigate('/entry', {
        state: {
          prefill: {
            type: TransactionType.INCOME,
            date: localDateStr(),
            buildingId: c.buildingId,
            unitNumber: c.unitName,
            amount,
            paymentMethod,
            bankName: b?.bankName || '',
            details
          }
        }
      });
    };

    const handleExportPdf = (c: Contract) => {
      const w = window.open('', 'PRINT', 'height=900,width=1000');
      if (!w) return;

      const installments: string[] = [];
      const count = c.installmentCount || 1;
      const pdfUpfront = Number((c as any).upfrontPaid || 0);
      const pdfEffectiveTotal = (c.totalValue || 0) + pdfUpfront;
      const pdfOther = c.otherInstallment || 0;
      let pdfFirst = (c.firstInstallment || 0) + pdfUpfront;
      const pdfSum = pdfFirst + (pdfOther * Math.max(0, count - 1));
      if (pdfEffectiveTotal > 0 && Math.abs(pdfSum - pdfEffectiveTotal) > Math.max(5, count)) {
        pdfFirst = Math.max(0, pdfEffectiveTotal - (pdfOther * Math.max(0, count - 1)));
      }
      // Walk upfront coverage for PDF labels
      let pdfUpRemaining = pdfUpfront;
      for (let i = 1; i <= count; i++) {
        const baseAmt = i === 1 ? pdfFirst : pdfOther;
        const covered = Math.min(pdfUpRemaining, baseAmt);
        pdfUpRemaining -= covered;
        const owes = baseAmt - covered;
        const label = covered >= baseAmt ? '(Paid - Upfront)' : covered > 0 ? `(${covered.toLocaleString()} covered by upfront)` : '';
        installments.push(`<tr><td class="td-idx">${i}</td><td class="td-desc">Installment ${i}${i === 1 ? ' (First)' : ''} ${label}</td><td class="td-amt">${Number(owes).toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</td></tr>`);
      }

      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Contract #${c.contractNo}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap');
              :root {
                --g900:#064e3b; --g800:#065f46; --g700:#047857; --g600:#059669;
                --g500:#10b981; --g400:#34d399; --g200:#a7f3d0; --g100:#d1fae5; --g50:#ecfdf5;
                --text-dark:#0f1a12; --text-mid:#334844; --text-light:#6b8078;
                --bg:#f8fdf9; --border:#d5e8dd;
              }
              * { margin:0; padding:0; box-sizing:border-box; }
              body { font-family:'Inter','Tajawal',sans-serif; background:#fff; color:var(--text-dark); }
              .page { max-width:780px; margin:0 auto; }
              .outer-frame { border:2px solid var(--g800); padding:3px; margin:20px; }
              .inner-frame { border:1px solid var(--g400); position:relative; overflow:hidden; }
              .watermark-bg { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.035; width:360px; height:360px; object-fit:contain; z-index:0; pointer-events:none; }
              .content { position:relative; z-index:1; }
              .orn { position:absolute; width:26px; height:26px; border-color:var(--g400); border-style:solid; z-index:2; }
              .orn-tl { top:6px; left:6px; border-width:2px 0 0 2px; }
              .orn-tr { top:6px; right:6px; border-width:2px 2px 0 0; }
              .orn-bl { bottom:6px; left:6px; border-width:0 0 2px 2px; }
              .orn-br { bottom:6px; right:6px; border-width:0 2px 2px 0; }
              
              /* Header */
              .header { display:flex; align-items:center; justify-content:space-between; padding:24px 32px 20px; background:linear-gradient(135deg,var(--g900) 0%,var(--g700) 100%); position:relative; }
              .header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--g400),var(--g200),var(--g400)); }
              .header-left,.header-right { flex:1; color:white; }
              .header-left { text-align:right; direction:rtl; }
              .header-right { text-align:left; direction:ltr; }
              .header-center { flex:0 0 auto; padding:0 20px; }
              .logo-wrap { width:76px; height:76px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 18px rgba(0,0,0,.25); border:3px solid var(--g400); }
              .logo-wrap img { width:54px; height:54px; object-fit:contain; }
              .co-name-ar { font-family:'Tajawal',sans-serif; font-size:16px; font-weight:700; }
              .co-name-en { font-size:11px; opacity:.85; margin-top:1px; }
              .co-vat { font-size:9.5px; opacity:.65; margin-top:5px; letter-spacing:.5px; }
              
              /* Title */
              .title-ribbon { text-align:center; padding:13px 20px; background:var(--g50); border-bottom:1px solid var(--border); }
              .title-ribbon h1 { font-size:20px; font-weight:800; color:var(--g800); letter-spacing:2px; text-transform:uppercase; font-family:'Tajawal',sans-serif; }
              .title-ribbon h1 span { color:var(--g500); margin:0 8px; }
              
              /* Contract badge */
              .contract-badge { display:flex; justify-content:center; gap:40px; padding:12px 32px; background:white; border-bottom:1px solid var(--border); }
              .badge-item { text-align:center; }
              .badge-label { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); font-weight:600; margin-bottom:2px; }
              .badge-value { font-size:15px; font-weight:700; color:var(--g800); }
              
              .body { padding:22px 32px 16px; }
              
              /* Info cards */
              .info-grid { display:flex; gap:14px; margin-bottom:22px; }
              .info-card { flex:1; border:1px solid var(--border); border-radius:10px; padding:16px 18px; background:var(--g50); }
              .info-card.amount-card { background:linear-gradient(135deg,var(--g900) 0%,var(--g700) 100%); color:white; border:none; position:relative; overflow:hidden; }
              .info-card.amount-card::before { content:''; position:absolute; top:-25px; right:-25px; width:100px; height:100px; background:rgba(52,211,153,.12); border-radius:50%; }
              .ic-label { font-size:9px; text-transform:uppercase; letter-spacing:1.2px; color:var(--text-light); font-weight:600; margin-bottom:8px; }
              .ic-label-white { font-size:9px; text-transform:uppercase; letter-spacing:1.2px; color:var(--g200); font-weight:600; margin-bottom:8px; }
              .ic-value { font-size:14px; font-weight:700; color:var(--text-dark); }
              .ic-sub { font-size:11px; color:var(--text-light); margin-top:5px; }
              .ic-amount { font-size:24px; font-weight:800; position:relative; z-index:1; }
              .ic-amount-sub { font-size:11px; color:var(--g200); margin-top:3px; position:relative; z-index:1; }
              
              /* Payment schedule */
              .schedule-section { margin-top:10px; }
              .schedule-title { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); font-weight:700; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border); }
              .schedule-table { width:100%; border-collapse:collapse; }
              .schedule-table thead th { background:var(--g800); color:white; padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
              .schedule-table thead th:first-child { border-radius:6px 0 0 0; width:50px; text-align:center; }
              .schedule-table thead th:last-child { border-radius:0 6px 0 0; text-align:right; }
              .schedule-table .td-idx { text-align:center; padding:10px; color:var(--text-light); font-size:12px; border-bottom:1px solid #e8f0eb; }
              .schedule-table .td-desc { padding:10px 14px; font-size:13px; font-weight:500; color:var(--text-dark); border-bottom:1px solid #e8f0eb; }
              .schedule-table .td-amt { text-align:right; padding:10px 14px; font-size:13px; font-weight:700; color:var(--text-dark); border-bottom:1px solid #e8f0eb; direction:ltr; }
              .schedule-table tr:nth-child(even) { background:var(--g50); }
              .schedule-table tfoot td { padding:12px 14px; font-weight:800; border-top:2px solid var(--g700); color:var(--g800); font-size:14px; }
              
              /* Notes */
              .notes-section { margin-top:18px; padding:14px 18px; background:var(--g50); border:1px solid var(--border); border-radius:8px; }
              .notes-label { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-light); font-weight:700; margin-bottom:6px; }
              .notes-text { font-size:12px; color:var(--text-mid); line-height:1.7; }
              
              /* Signatures */
              .signatures { display:flex; justify-content:space-between; padding:32px 32px 10px; gap:30px; }
              .sig-block { flex:1; text-align:center; }
              .sig-line { border-bottom:2px solid var(--g800); margin-bottom:10px; height:48px; }
              .sig-title { font-size:11px; font-weight:700; color:var(--text-mid); text-transform:uppercase; letter-spacing:1px; }
              .sig-title-ar { font-family:'Tajawal',sans-serif; font-size:12px; color:var(--text-light); margin-top:2px; }
              
              /* Footer */
              .footer-bar { text-align:center; padding:14px 32px; background:var(--g50); border-top:1px solid var(--border); position:relative; }
              .footer-bar::before { content:''; position:absolute; top:0; left:32px; right:32px; height:1px; background:linear-gradient(90deg,transparent,var(--g400),transparent); }
              .footer-text { font-size:9px; color:var(--text-light); letter-spacing:.5px; line-height:1.8; }
              .footer-bottom { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:6px; }
              .amlak-badge { display:inline-flex; align-items:center; gap:5px; background:var(--g800); color:white; padding:3px 10px; border-radius:20px; font-size:7px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
              .amlak-badge img { width:14px; height:14px; object-fit:contain; border-radius:50%; }
              .footer-copy { font-size:8px; color:var(--text-light); letter-spacing:1px; }
              
              /* Print toolbar */
              .toolbar { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; }
              .btn-print { background:var(--g700); color:white; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
              .btn-close { background:white; color:var(--text-mid); border:1px solid var(--border); padding:8px 18px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
              
              @media print { 
                body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                .toolbar { display:none; }
                .outer-frame { margin:0; }
                @page { margin:0.8cm; size:A4 portrait; }
              }
            </style>
          </head>
          <body>
            <div class="toolbar">
              <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
              <button class="btn-close" onclick="window.close()">${t('common.close')}</button>
            </div>
            <div class="page">
              <div class="outer-frame">
                <div class="inner-frame">
                  <div class="orn orn-tl"></div><div class="orn orn-tr"></div>
                  <div class="orn orn-bl"></div><div class="orn orn-br"></div>
                  <img src="${window.location.origin}/images/logo.png" alt="" class="watermark-bg" />
                  
                  <div class="content">
                    <div class="header">
                      <div class="header-right">
                        <div class="co-name-en" style="font-size:13px;font-weight:600">Arar Millennium</div>
                        <div class="co-name-en">Company Ltd</div>
                        <div class="co-vat">VAT: 312610089400003</div>
                      </div>
                      <div class="header-center">
                        <div class="logo-wrap"><img src="${window.location.origin}/images/cologo.png" alt="Logo" /></div>
                      </div>
                      <div class="header-left">
                        <div class="co-name-ar"> شركة ارار ميلينيوم المحدودة</div>
                        <div class="co-name-en" style="opacity:.7;font-size:10px">الدمام ، المملكة العربية السعودية</div>
                        <div class="co-vat">الرقم الضريبي: 312610089400003</div>
                      </div>
                    </div>
                    
                    <div class="title-ribbon"><h1>عقد إيجار <span>|</span> LEASE AGREEMENT</h1></div>
                    
                    <div class="contract-badge">
                      <div class="badge-item"><div class="badge-label">Contract No. / رقم العقد</div><div class="badge-value">#${c.contractNo}</div></div>
                      <div class="badge-item"><div class="badge-label">Date / التاريخ</div><div class="badge-value">${fmtDate(c.contractDate || new Date())}</div></div>
                      <div class="badge-item"><div class="badge-label">Status / الحالة</div><div class="badge-value" style="color:var(--g600)">${c.status || 'ACTIVE'}</div></div>
                    </div>
                    
                    <div class="body">
                      <div class="info-grid">
                        <div class="info-card">
                          <div class="ic-label">Tenant / المستأجر</div>
                          <div class="ic-value">${displayContractCustomerName(c) || '-'}</div>
                          <div class="ic-sub">${c.unitName || ''}</div>
                        </div>
                        <div class="info-card">
                          <div class="ic-label">Property / العقار</div>
                          <div class="ic-value">${c.buildingName || '-'} — Unit ${c.unitName || '-'}</div>
                          <div class="ic-sub">${fmtDate(c.fromDate)} → ${fmtDate(c.toDate)}</div>
                        </div>
                        <div class="info-card amount-card">
                          <div class="ic-label-white">Total Value / القيمة</div>
                          <div class="ic-amount">${Number(c.totalValue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</div>
                          <div class="ic-amount-sub">${count} Installment${count > 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      
                      <div class="schedule-section">
                        <div class="schedule-title">Payment Schedule / جدول السداد</div>
                        <table class="schedule-table">
                          <thead><tr><th>#</th><th>${t('entry.description')}</th><th>${t('entry.amount')}</th></tr></thead>
                          <tbody>${installments.join('')}</tbody>
                          <tfoot><tr><td></td><td>Total / الإجمالي</td><td style="text-align:right">${Number(c.totalValue || 0).toLocaleString('en-US', {minimumFractionDigits: 2})} SAR</td></tr></tfoot>
                        </table>
                      </div>
                      
                      ${c.notes ? `<div class="notes-section"><div class="notes-label">Notes / ملاحظات</div><div class="notes-text">${c.notes}</div></div>` : ''}
                      ${(c as any).autoPayment ? `<div class="notes-section" style="background:#eff6ff;border-color:#bfdbfe"><div class="notes-label" style="color:#1e40af">Auto Payment / الدفع التلقائي</div><div class="notes-text" style="color:#1e40af">✓ Enabled — Installments are automatically recorded as transactions on due dates</div></div>` : ''}
                    </div>
                    
                    <div class="signatures">
                      <div class="sig-block"><div class="sig-line"></div><div class="sig-title">${t('entry.landlord')}</div><div class="sig-title-ar">المؤجر</div></div>
                      <div class="sig-block"><div class="sig-line"></div><div class="sig-title">${t('contract.tenant')}</div><div class="sig-title-ar">المستأجر</div></div>
                      <div class="sig-block"><div class="sig-line"></div><div class="sig-title">Witness</div><div class="sig-title-ar">الشاهد</div></div>
                    </div>
                    
                    <div class="footer-bar">
                      <div class="footer-text">This is a computer-generated contract and is valid without signature &bull; هذا المستند صادر إلكترونيًا وصالح بدون توقيع</div>
                      <div class="footer-bottom">
                        <span class="footer-copy">Arar Millennium Company Ltd &copy; ${new Date().getFullYear()}</span>
                        <span class="amlak-badge"><img src="${window.location.origin}/images/logo.png" alt="" /> Powered by Amlak</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>`;

      w.document.write(html);
      w.document.close();
      w.focus();
    };

    // Metadata for all supported fee types used in the filter + PDF export.
    const FEE_META: Record<string, { label: string; field: string; color: string }> = {
      water: { label: 'Water Fee', field: 'waterFee', color: 'cyan' },
      internet: { label: 'Internet Fee (Total)', field: 'internetFee', color: 'sky' },
      parking: { label: 'Parking Fee', field: 'parkingFee', color: 'slate' },
      office: { label: 'Office Fee Amount', field: 'officeFeeAmount', color: 'purple' },
      insurance: { label: 'Insurance', field: 'insuranceFee', color: 'orange' },
      service: { label: 'Service Fee', field: 'serviceFee', color: 'teal' },
      upfront: { label: 'Upfront Paid (1st Only)', field: 'upfrontPaid', color: 'emerald' },
    };

    /**
     * Shared PDF template. When `feeKey` is provided, the PDF is scoped to a
     * single fee type: only contracts with that fee > 0 are included, and a
     * dedicated column + summary card is rendered for it.  When `feeKey` is
     * null, a basic contract-list PDF is rendered without any fee columns.
     */
    const renderContractsPdf = (sourceContracts: any[], feeKey: string | null) => {
      const meta = feeKey ? FEE_META[feeKey] : null;
      const contractsForPdf = meta
        ? sourceContracts.filter(c => Number(c[meta.field]) > 0)
        : sourceContracts;

      const title = meta ? `${meta.label} Report` : 'Contracts Export Report';
      const winName = meta ? `PRINT_${feeKey}` : 'PRINT';
      const w = window.open('', winName, 'height=900,width=1000');
      if (!w) return;

      const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const feeCell = (v: number) => v > 0
        ? `<span class="fee-pill">${fmtMoney(v)}</span>`
        : '<span class="fee-none">—</span>';

      // Paid amount per selected fee:
      //  - For "upfront", the paid value equals the upfrontPaid field itself
      //    (it's tracked directly on the contract and considered fully paid).
      //  - For every other fee, we approximate using the contract's overall
      //    paidPercent: feePaid = feeAmount * (paidPercent / 100).
      const paidForFee = (c: any): number => {
        if (!meta) return 0;
        const feeAmt = Number(c[meta.field]) || 0;
        if (feeAmt <= 0) return 0;
        if (feeKey === 'upfront') return Number(c.upfrontPaid) || 0;
        const pct = Math.max(0, Math.min(100, Number(c.paidPercent) || 0));
        return feeAmt * (pct / 100);
      };

      const rows = contractsForPdf.map((c, idx) => {
        const isExp = c.status === 'Active' && c.daysRemaining >= 0 && c.daysRemaining <= EXPIRING_THRESHOLD_DAYS;
        const isOldStatus = typeof c.status === 'string' && c.status.startsWith('Old ');
        const badge = isExp ? 'expiring' : (isOldStatus ? 'old' : (c.status || '').toLowerCase());
        const label = isExp ? `Expiring (${c.daysRemaining}d)` : c.status;
        const feeAmount = meta ? (Number(c[meta.field]) || 0) : 0;
        const paidAmount = paidForFee(c);
        const balanceAmount = Math.max(0, feeAmount - paidAmount);
        const feeCellHtml = meta ? `<td class="tr">${feeCell(feeAmount)}</td>` : '';
        const paidCellHtml = meta
          ? `<td class="tr">${paidAmount > 0 ? `<span class="paid-pill">${fmtMoney(paidAmount)}</span>` : '<span class="fee-none">—</span>'}</td>`
          : '';
        const balanceCellHtml = meta
          ? `<td class="tr">${balanceAmount > 0 ? `<span class="balance-pill">${fmtMoney(balanceAmount)}</span>` : '<span class="fee-none">—</span>'}</td>`
          : '';
        return `
        <tr${idx % 2 === 0 ? '' : ' class="alt"'}>
          <td class="tc">${idx + 1}</td>
          <td><strong>${c.contractNo}</strong></td>
          <td>${displayContractCustomerName(c)}</td>
          <td>${c.buildingName} — ${c.unitName}</td>
          <td class="tr">${fmtMoney(c.totalValue)}</td>
          ${feeCellHtml}
          ${paidCellHtml}
          ${balanceCellHtml}
          <td class="tc"><span class="status-badge ${badge}">${label}</span></td>
          <td class="tc">${fmtDate(c.fromDate)} → ${fmtDate(c.toDate)}</td>
          <td class="tc">${c.daysRemaining >= 0 ? c.daysRemaining + 'd' : '—'}</td>
        </tr>`;
      }).join('');

      const feeFilterLabel = filterFeeTypes.length === 0
        ? 'ALL'
        : filterFeeTypes.map(f => FEE_META[f]?.label || f).join(', ');
      const summary = `Filters: Status=${filterStatuses.length === 0 ? 'ALL' : filterStatuses.join(', ')}, Building=${filterBuildingIds.length === 0 ? 'ALL' : filterBuildingIds.map(id => buildings.find(b => b.id === id)?.name || id).join(', ')}, Fees=${feeFilterLabel}, From=${filterFromDate || '-'}, To=${filterToDate || '-'}${meta ? `  |  Scope: ${meta.label}` : ''}`;

      const totalValue = contractsForPdf.reduce((s, x) => s + (Number(x.totalValue) || 0), 0);
      const totalFee = meta ? contractsForPdf.reduce((s, x) => s + (Number(x[meta.field]) || 0), 0) : 0;
      const totalPaidFee = meta ? contractsForPdf.reduce((s, x) => s + paidForFee(x), 0) : 0;
      const totalBalance = Math.max(0, totalFee - totalPaidFee);

      const feeHeaderHtml = meta
        ? `<th class="tr">${meta.label}</th><th class="tr">Paid</th><th class="tr">Balance</th>`
        : '';
      const feeSummaryCard = meta ? `
                <div class="sum-item">
                  <div class="sum-label">${meta.label}</div>
                  <div class="sum-value">${fmtMoney(totalFee)} SAR</div>
                </div>
                <div class="sum-item">
                  <div class="sum-label">Paid (${meta.label})</div>
                  <div class="sum-value paid">${fmtMoney(totalPaidFee)} SAR</div>
                </div>
                <div class="sum-item">
                  <div class="sum-label">Balance (${meta.label})</div>
                  <div class="sum-value balance">${fmtMoney(totalBalance)} SAR</div>
                </div>` : '';
      const feeFooterCell = meta
        ? `<td class="tr">${fmtMoney(totalFee)}</td><td class="tr">${fmtMoney(totalPaidFee)}</td><td class="tr">${fmtMoney(totalBalance)}</td>`
        : '';

      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap');
              :root {
                --g900:#064e3b; --g800:#065f46; --g700:#047857; --g600:#059669;
                --g500:#10b981; --g400:#34d399; --g200:#a7f3d0; --g100:#d1fae5; --g50:#ecfdf5;
                --text-dark:#0f1a12; --text-mid:#334844; --text-light:#6b8078;
                --bg:#f8fdf9; --border:#d5e8dd;
              }
              * { margin:0; padding:0; box-sizing:border-box; }
              body { font-family:'Inter','Tajawal',sans-serif; background:#fff; color:var(--text-dark); }
              .page { max-width:1050px; margin:0 auto; padding:20px; }
              .toolbar { display:flex; justify-content:flex-end; gap:8px; padding:0 0 12px; }
              .btn-print { background:var(--g700); color:white; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
              .btn-close { background:white; color:var(--text-mid); border:1px solid var(--border); padding:8px 18px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; }
              .report-header { display:flex; align-items:center; justify-content:space-between; padding:22px 28px; background:linear-gradient(135deg,var(--g900) 0%,var(--g700) 100%); border-radius:12px 12px 0 0; position:relative; }
              .report-header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--g400),var(--g200),var(--g400)); }
              .rh-left { display:flex; align-items:center; gap:14px; }
              .rh-logo { width:48px; height:48px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--g400); }
              .rh-logo img { width:32px; height:32px; object-fit:contain; }
              .rh-title { color:white; font-size:18px; font-weight:800; letter-spacing:.5px; }
              .rh-sub { color:var(--g200); font-size:11px; margin-top:2px; }
              .rh-right { color:white; text-align:right; font-size:11px; opacity:.85; }
              .filter-bar { padding:12px 28px; background:var(--g50); border-bottom:1px solid var(--border); font-size:11px; color:var(--text-mid); }
              .summary-bar { display:flex; gap:20px; padding:14px 28px; background:white; border-bottom:1px solid var(--border); flex-wrap:wrap; }
              .sum-item { display:flex; flex-direction:column; gap:2px; }
              .sum-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--text-light); font-weight:600; }
              .sum-value { font-size:16px; font-weight:800; color:var(--g800); }
              table { width:100%; border-collapse:collapse; }
              thead th { background:var(--g800); color:white; padding:11px 14px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
              thead th.tr { text-align:right; }
              thead th.tc { text-align:center; }
              tbody td { padding:10px 14px; font-size:12px; border-bottom:1px solid #e8f0eb; }
              tbody .alt td { background:var(--g50); }
              .tc { text-align:center; }
              .tr { text-align:right; }
              .status-badge { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
              .status-badge.active { background:var(--g100); color:var(--g800); }
              .status-badge.expiring { background:#fff7ed; color:#c2410c; }
              .status-badge.expired { background:#fef2f2; color:#991b1b; }
              .status-badge.terminated { background:#fef9c3; color:#854d0e; }
              .status-badge.old { background:#eff6ff; color:#1d4ed8; }
              tfoot td { padding:12px 14px; font-weight:800; border-top:2px solid var(--g700); font-size:13px; color:var(--g800); }
              .fee-pill { display:inline-block; padding:2px 8px; background:var(--g100); color:var(--g800); border-radius:10px; font-size:11px; font-weight:700; }
              .paid-pill { display:inline-block; padding:2px 8px; background:#dcfce7; color:#166534; border-radius:10px; font-size:11px; font-weight:700; }
              .balance-pill { display:inline-block; padding:2px 8px; background:#fee2e2; color:#991b1b; border-radius:10px; font-size:11px; font-weight:700; }
              .fee-none { color:var(--text-light); font-weight:500; }
              .sum-value.paid { color:#16a34a; }
              .sum-value.balance { color:#dc2626; }
              .footer-bar { text-align:center; padding:14px; background:var(--g50); border-top:1px solid var(--border); border-radius:0 0 12px 12px; }
              .footer-bottom { display:flex; justify-content:center; align-items:center; gap:12px; }
              .amlak-badge { display:inline-flex; align-items:center; gap:5px; background:var(--g800); color:white; padding:3px 10px; border-radius:20px; font-size:7px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
              .amlak-badge img { width:14px; height:14px; object-fit:contain; border-radius:50%; }
              .footer-copy { font-size:8px; color:var(--text-light); letter-spacing:1px; }
              .empty-state { padding:60px 20px; text-align:center; color:var(--text-light); font-size:14px; }
              @media print { 
                body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                .toolbar { display:none; }
                @page { margin:1cm; size:A4 landscape; }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="toolbar">
                <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
                <button class="btn-close" onclick="window.close()">${t('common.close')}</button>
              </div>
              <div class="report-header">
                <div class="rh-left">
                  <div class="rh-logo"><img src="${window.location.origin}/images/cologo.png" alt="Logo" /></div>
                  <div>
                    <div class="rh-title">${title}</div>
                    <div class="rh-sub">Arar Millennium Company Ltd &bull; تقرير العقود</div>
                  </div>
                </div>
                <div class="rh-right">
                  Exported: ${fmtDateTime(new Date())}<br/>
                  ${meta ? meta.label : 'تقرير العقود'}
                </div>
              </div>
              <div class="filter-bar"><strong>Applied Filters:</strong> ${summary}</div>
              <div class="summary-bar">
                <div class="sum-item">
                  <div class="sum-label">Total Contracts</div>
                  <div class="sum-value">${contractsForPdf.length}</div>
                </div>
                <div class="sum-item">
                  <div class="sum-label">${t('contract.totalValue')}</div>
                  <div class="sum-value">${fmtMoney(totalValue)} SAR</div>
                </div>${feeSummaryCard}
              </div>
              ${contractsForPdf.length === 0 ? `<div class="empty-state">No contracts match this filter.</div>` : `
              <table>
                <thead>
                  <tr>
                    <th class="tc">#</th>
                    <th>Contract</th>
                    <th>${t('contract.tenant')}</th>
                    <th>Property</th>
                    <th class="tr">Total (SAR)</th>
                    ${feeHeaderHtml}
                    <th class="tc">${t('common.status')}</th>
                    <th class="tc">${t('contract.period')}</th>
                    <th class="tc">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="4">Total Contracts: ${contractsForPdf.length}</td>
                    <td class="tr">${fmtMoney(totalValue)} SAR</td>
                    ${feeFooterCell}
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>`}
              <div class="footer-bar">
                <div class="footer-bottom">
                  <span class="footer-copy">Arar Millennium Company Ltd &copy; ${new Date().getFullYear()}</span>
                  <span class="amlak-badge"><img src="${window.location.origin}/images/logo.png" alt="" /> Powered by Amlak</span>
                </div>
              </div>
            </div>
          </body>
        </html>`;

      w.document.write(html);
      w.document.close();
      w.focus();
    };

    /**
     * If one or more fee types are selected, emit a SEPARATE PDF per selected
     * fee (so each report is scoped to a single fee type).
     * Otherwise emit the regular summary PDF with no fee columns.
     */
    const handleExportContractsPdf = (contractsToExport: any[]) => {
      if (filterFeeTypes.length === 0) {
        renderContractsPdf(contractsToExport, null);
        return;
      }
      // Stagger popup creation slightly so browsers don't block subsequent popups.
      filterFeeTypes.forEach((feeKey, i) => {
        if (i === 0) {
          renderContractsPdf(contractsToExport, feeKey);
        } else {
          setTimeout(() => renderContractsPdf(contractsToExport, feeKey), i * 200);
        }
      });
    };

    const handlePrintCards = (contractsToExport: any[]) => {
      const w = window.open('', 'PRINT_CARDS', 'height=900,width=1000');
      if (!w) return;

      // Always sort print-cards by unit/room number (natural alphanumeric),
      // then building name, then contract number as tie-breakers.
      const unitKey = (c: any) => String(c?.unitName ?? c?.unitNumber ?? '').trim();
      const buildingKey = (c: any) => String(c?.buildingName ?? '').trim();
      const sortedContracts = [...contractsToExport].sort((a, b) => {
        const ua = unitKey(a);
        const ub = unitKey(b);
        const uCmp = ua.localeCompare(ub, undefined, { numeric: true, sensitivity: 'base' });
        if (uCmp !== 0) return uCmp;
        const bCmp = buildingKey(a).localeCompare(buildingKey(b), undefined, { numeric: true, sensitivity: 'base' });
        if (bCmp !== 0) return bCmp;
        return String(a?.contractNo ?? '').localeCompare(String(b?.contractNo ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      });

      const cards = sortedContracts.map(c => {
        const effTotal = (Number(c.totalValue) || 0) + (Number(c.upfrontPaid) || 0);
        const pct = effTotal > 0 ? Math.min(100, Math.round(((c.paidPercent !== undefined ? (c.paidPercent / 100) * effTotal : 0) / effTotal) * 100)) : (c.paidPercent || 0);
        const isExp = c.status === 'Active' && c.daysRemaining >= 0 && c.daysRemaining <= EXPIRING_THRESHOLD_DAYS;
        const isOld = typeof c.status === 'string' && c.status.startsWith('Old ');
        const statusClass = isExp ? 'expiring' : isOld ? 'old' : (c.status || '').toLowerCase();
        const statusLabel = isExp ? `Expiring in ${c.daysRemaining}d` : c.status;
        const count = Number(c.installmentCount) || 1;
        const months = Number(c.periodMonths) || 0;
        const mpi = count > 0 && months > 0 ? Math.round(months / count) : 0;
        const freq = mpi === 1 ? 'Monthly' : mpi === 2 ? 'Every 2M' : mpi === 3 ? 'Quarterly' : mpi === 4 ? 'Every 4M' : mpi === 6 ? 'Semi-Annual' : mpi === 12 ? 'Annual' : mpi > 0 ? `Every ${mpi}M` : '';
        const fees = [
          { lbl: 'Water', val: Number(c.waterFee) || 0, cls: 'cyan' },
          { lbl: 'Internet', val: Number(c.internetFee) || 0, cls: 'sky' },
          { lbl: 'Parking', val: Number(c.parkingFee) || 0, cls: 'slate' },
          { lbl: 'Management', val: Number(c.managementFee) || 0, cls: 'indigo' },
          { lbl: 'Insurance', val: Number(c.insuranceFee) || 0, cls: 'orange' },
          { lbl: 'Service', val: Number(c.serviceFee) || 0, cls: 'teal' },
          { lbl: 'Office Fee', val: Number(c.officeFeeAmount) || 0, cls: 'purple' },
          { lbl: 'Extra', val: Number(c.otherAmount) || 0, cls: 'lime' },
          { lbl: 'Deduction', val: Number(c.otherDeduction) || 0, cls: 'rose' },
        ].filter(f => f.value > 0);

        return `
        <div class="card">
          <div class="card-bar ${statusClass}"></div>
          <div class="card-body">
            <div class="card-top">
              <div class="card-meta">
                <span class="contract-no">#${c.contractNo}</span>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
              </div>
              <div class="customer">${displayContractCustomerName(c)}</div>
              <div class="property">${c.buildingName} &bull; Unit ${c.unitName}</div>
              ${c.fromDate || c.toDate ? `<div class="dates">${fmtDate(c.fromDate || '')} &rarr; ${fmtDate(c.toDate || '')}</div>` : ''}
            </div>

            <div class="progress-wrap">
              <div class="progress-labels">
                <span>${c.paidPercent || 0}% Paid</span>
                <span>${effTotal.toLocaleString()} SAR</span>
              </div>
              <div class="progress-track"><div class="progress-fill ${statusClass}" style="width:${c.paidPercent || 0}%"></div></div>
            </div>

            ${(Number(c.firstInstallment) > 0 || Number(c.otherInstallment) > 0) ? `
            <div class="chips">
              <span class="chip green">1st: ${Number(c.firstInstallment || 0).toLocaleString()} SAR</span>
              ${count > 1 && Number(c.otherInstallment) > 0 ? `<span class="chip blue">2nd+: ${Number(c.otherInstallment || 0).toLocaleString()} SAR</span>` : ''}
              ${freq ? `<span class="chip violet">${freq}</span>` : ''}
              <span class="chip-plain">${count} Inst.</span>
            </div>` : ''}

            ${fees.length ? `<div class="fees">${fees.map(f => `<span class="fee ${f.cls}">${f.lbl}: ${f.lbl === 'Deduction' ? '-' : ''}${f.val.toLocaleString()}</span>`).join('')}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Contract Cards</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:'Inter',sans-serif;background:#f1f5f9;color:#0f172a}
            .toolbar{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;background:white;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}
            .btn-print{background:#059669;color:white;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px}
            .btn-close{background:white;color:#64748b;border:1px solid #e2e8f0;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px}
            .report-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,#064e3b,#047857);color:white;margin:16px;border-radius:14px}
            .rh-left{display:flex;align-items:center;gap:12px}
            .rh-logo{width:44px;height:44px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center}
            .rh-logo img{width:28px;height:28px;object-fit:contain}
            .rh-title{font-size:16px;font-weight:800}
            .rh-sub{font-size:10px;opacity:.7;margin-top:2px}
            .rh-right{font-size:10px;opacity:.8;text-align:right}
            .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:0 16px 24px}
            .card{background:white;border-radius:14px;overflow:hidden;display:flex;box-shadow:0 1px 4px rgba(0,0,0,.08);border:1px solid #e2e8f0;break-inside:avoid}
            .card-bar{width:5px;flex-shrink:0}
            .card-bar.active{background:#10b981}
            .card-bar.expiring{background:#f97316}
            .card-bar.expired{background:#ef4444}
            .card-bar.terminated{background:#eab308}
            .card-bar.old{background:#3b82f6}
            .card-bar.old-1,.card-bar.old-2,.card-bar.old-3{background:#94a3b8}
            .card-body{padding:14px;flex:1;space-y:8px}
            .card-top{margin-bottom:10px}
            .card-meta{display:flex;align-items:center;gap:6px;margin-bottom:5px}
            .contract-no{font-size:10px;font-family:monospace;color:#94a3b8;font-weight:700}
            .status-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:20px}
            .status-badge.active{background:#d1fae5;color:#065f46}
            .status-badge.expiring{background:#ffedd5;color:#c2410c}
            .status-badge.expired{background:#fee2e2;color:#991b1b}
            .status-badge.terminated{background:#fef9c3;color:#854d0e}
            .status-badge.old,.status-badge.old-1,.status-badge.old-2,.status-badge.old-3{background:#dbeafe;color:#1e40af}
            .customer{font-size:15px;font-weight:800;color:#0f172a;line-height:1.2}
            .property{font-size:11px;color:#64748b;font-weight:500;margin-top:2px}
            .dates{font-size:10px;color:#94a3b8;font-family:monospace;margin-top:4px}
            .progress-wrap{margin:10px 0}
            .progress-labels{display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
            .progress-track{height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden}
            .progress-fill{height:100%;border-radius:99px;background:#10b981;transition:width .3s}
            .progress-fill.expiring{background:#f97316}
            .progress-fill.expired{background:#ef4444}
            .progress-fill.terminated{background:#eab308}
            .progress-fill.old,.progress-fill.old-1,.progress-fill.old-2{background:#3b82f6}
            .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
            .chip{font-size:9px;font-weight:800;padding:3px 7px;border-radius:6px;border:1px solid}
            .chip.green{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
            .chip.blue{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}
            .chip.violet{background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6}
            .chip-plain{font-size:9px;color:#94a3b8;font-weight:700;align-self:center}
            .fees{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px}
            .fee{font-size:8px;font-weight:800;padding:2px 6px;border-radius:5px;border:1px solid}
            .fee.cyan{background:#ecfeff;border-color:#a5f3fc;color:#0e7490}
            .fee.sky{background:#f0f9ff;border-color:#bae6fd;color:#0369a1}
            .fee.slate{background:#f8fafc;border-color:#cbd5e1;color:#475569}
            .fee.indigo{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
            .fee.orange{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
            .fee.teal{background:#f0fdfa;border-color:#99f6e4;color:#0f766e}
            .fee.purple{background:#faf5ff;border-color:#e9d5ff;color:#6b21a8}
            .fee.lime{background:#f7fee7;border-color:#d9f99d;color:#3f6212}
            .fee.rose{background:#fff1f2;border-color:#fecdd3;color:#be123c}
            .footer{text-align:center;padding:14px;background:white;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:uppercase}
            @media print{
              body{background:white}
              .toolbar{display:none}
              .report-header{margin:0 0 12px;border-radius:0}
              .grid{padding:0;gap:10px}
              @page{margin:.8cm;size:A4 portrait}
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button class="btn-print" onclick="window.print()">&#128438; Print / Save as PDF</button>
            <button class="btn-close" onclick="window.close()">Close</button>
          </div>
          <div class="report-header">
            <div class="rh-left">
              <div class="rh-logo"><img src="${window.location.origin}/images/cologo.png" alt=""/></div>
              <div>
                <div class="rh-title">Contract Cards — ${contractsToExport.length} Contract${contractsToExport.length !== 1 ? 's' : ''}</div>
                <div class="rh-sub">Arar Millennium Company Ltd &bull; Printed ${fmtDate(new Date().toISOString().split('T')[0])}</div>
              </div>
            </div>
            <div class="rh-right">Generated: ${fmtDateTime(new Date())}</div>
          </div>
          <div class="grid">${cards}</div>
          <div class="footer">Arar Millennium Co. Ltd &bull; Powered by Amlak</div>
        </body>
      </html>`;

      w.document.write(html);
      w.document.close();
      w.focus();
    };

    const handleExportContractsCsv = (contractsToExport: any[]) => {
      const headers = ['contractNo','customerName','buildingName','unitName','totalValue','internetFee','parkingFee','officeFeeAmount','status','fromDate','toDate'];
      const csvRows = [headers.join(',')];
      for (const c of contractsToExport) {
        const row = [
          c.contractNo,
          `"${(c.customerName||'').replace(/"/g,'""')}"`,
          `"${(c.buildingName||'').replace(/"/g,'""')}"`,
          c.unitName,
          c.totalValue || 0,
          Number(c.internetFee) || 0,
          Number(c.parkingFee) || 0,
          Number(c.officeFeeAmount) || 0,
          c.status,
          c.fromDate || '',
          c.toDate || '',
        ];
        csvRows.push(row.join(','));
      }
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contracts_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

  if (view === 'DETAILS' && selectedContract) {
      return (
        <div className="mobile-tab-shell tab-contracts max-w-4xl mx-auto animate-fade-in pb-20">
          {renderConfirmModal()}
          <div className="mb-6 flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-50 text-slate-500">{isRTL ? <ArrowRight /> : <ArrowLeft />}</button>
            <h2 className="text-2xl font-black text-slate-800">{t('contract.details')}</h2>
            <div className="ms-auto flex items-center gap-3 flex-wrap">
              <button onClick={() => handleQuickPayment(selectedContract)} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg">{t('contract.recordPayment')}</button>
              {/* Collect non-VAT fees (water, internet, parking, management) separately */}
              {(() => {
                const nonVatFees = (Number(selectedContract.waterFee) || 0)
                  + (Number(selectedContract.internetFee) || 0)
                  + (Number((selectedContract as any).parkingFee) || 0)
                  + (Number((selectedContract as any).managementFee) || 0);
                const instCount = Number(selectedContract.installmentCount) || 1;
                const feesPerInst = Math.round(nonVatFees / instCount);
                if (feesPerInst <= 0) return null;
                return (
                  <button
                    onClick={() => navigate('/entry', {
                      state: {
                        prefill: {
                          type: 'INCOME',
                          buildingId: selectedContract.buildingId,
                          unitNumber: selectedContract.unitName,
                          amount: feesPerInst,
                          details: `Non-VAT Fees (Water/Internet/Parking) - ${displayContractCustomerName(selectedContract)} - ${selectedContract.contractNo}`,
                          date: new Date().toISOString().split('T')[0],
                          contractId: (selectedContract as any).id,
                          keepAmount: true,
                        }
                      }
                    })}
                    className="px-3 py-2 bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg flex items-center gap-1.5"
                    title={`Collect non-VAT fees (${feesPerInst.toLocaleString()} SAR per installment)`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Collect Fees
                    <span className="bg-sky-400/50 rounded-lg px-1.5 py-0.5 text-xs font-black">{feesPerInst.toLocaleString()}</span>
                  </button>
                );
              })()}
              <button onClick={() => handleExportPdf(selectedContract)} className="px-3 py-2 bg-white border border-emerald-600 rounded-xl text-slate-900 font-bold flex items-center gap-2"><Printer size={14}/>{t('history.exportPdf')}</button>
              <div className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">#{selectedContract.contractNo}</div>
            </div>
          </div>

          <div className="ios-card p-6 mb-8">
            <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('contract.allFields')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div><span className="text-slate-500">{t('contract.contractNo')}</span>: <span className="font-bold text-slate-800">{selectedContract.contractNo}</span></div>
              <div><span className="text-slate-500">{t('contract.contractDate')}</span>: <span className="font-bold text-slate-800">{fmtDate(selectedContract.contractDate)}</span></div>
              <div><span className="text-slate-500">{t('common.status')}</span>: <span className="font-bold text-slate-800">{selectedContract.status}</span></div>
              <div><span className="text-slate-500">{t('entry.building')}</span>: <span className="font-bold text-slate-800">{selectedContract.buildingName}</span></div>
              <div><span className="text-slate-500">{t('entry.unit')}</span>: <span className="font-bold text-slate-800">{selectedContract.unitName}</span></div>
              <div><span className="text-slate-500">{t('history.customer')}</span>: <span className="font-bold text-slate-800">{displayContractCustomerName(selectedContract)}</span></div>
                {(() => {
                  const b = buildings.find(x => x.id === selectedContract.buildingId);
                  const isVAT = b?.propertyType === 'NON_RESIDENTIAL' || b?.vatApplicable;
                  const vatSuffix = isVAT ? ' (Excl. VAT)' : '';
                  return (
                    <>
                      <div><span className="text-slate-500">{t('contract.rentValueShort')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.rentValue?.toLocaleString()} {t('common.sar')}</span></div>
                      <div><span className="text-slate-500">{t('contract.waterFeeShort')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.waterFee?.toLocaleString()} {t('common.sar')}</span></div>
                      <div><span className="text-slate-500">{t('contract.internetFeeShort')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.internetFee?.toLocaleString()} {t('common.sar')}</span></div>
                      <div><span className="text-slate-500">{t('contract.insuranceFee')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.insuranceFee?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.serviceFee')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.serviceFee?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.officePercent')}</span>: <span className="font-bold text-slate-800">{selectedContract.officePercent}</span></div>
                      <div><span className="text-slate-500">{t('contract.officeFeeAmount')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.officeFeeAmount?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.otherDeduction')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.otherDeduction?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.otherAmount')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.otherAmount?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.upfrontPaidShort')}</span>: <span className="font-bold text-slate-800">{selectedContract.upfrontPaid?.toLocaleString()} {t('common.sar')}</span></div>
                      <div><span className="text-slate-500">{t('contract.totalValue')}{isVAT ? ' (Excl. VAT)' : ''}</span>: <span className="font-bold text-emerald-600">{selectedContract.totalValue?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.installmentCount')}</span>: <span className="font-bold text-slate-800">{selectedContract.installmentCount}</span></div>
                      <div><span className="text-slate-500">{t('contract.firstInstallment')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.firstInstallment?.toLocaleString()} SAR</span></div>
                      <div><span className="text-slate-500">{t('contract.otherInstallmentAmt')}{vatSuffix}</span>: <span className="font-bold text-slate-800">{selectedContract.otherInstallment?.toLocaleString()} {t('common.sar')}</span></div>
                    </>
                  );
                })()}
              <div><span className="text-slate-500">{t('contract.periodMonths')}</span>: <span className="font-bold text-slate-800">{selectedContract.periodMonths}</span></div>
              <div><span className="text-slate-500">{t('contract.periodDays')}</span>: <span className="font-bold text-slate-800">{selectedContract.periodDays}</span></div>
              <div><span className="text-slate-500">{t('history.fromDate')}</span>: <span className="font-bold text-slate-800">{fmtDate(selectedContract.fromDate)}</span></div>
              <div><span className="text-slate-500">{t('history.toDate')}</span>: <span className="font-bold text-slate-800">{fmtDate(selectedContract.toDate)}</span></div>
              <div><span className="text-slate-500">{t('common.notes')}</span>: <span className="font-bold text-slate-800">{selectedContract.notes || '-'}</span></div>
              <div><span className="text-slate-500">{t('history.autoPayment')}</span>: <span className="font-bold text-xs px-2.5 py-1 rounded-lg {selectedContract.autoPayment ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}">{selectedContract.autoPayment ? '✓ Enabled' : 'Disabled'}</span></div>
              <div><span className="text-slate-500">{t('contract.createdBy')}</span>: <span className="font-bold text-slate-800">{selectedContract.createdBy || '-'}</span></div>
            </div>
          </div>
          {/* ...existing code... */}
               <div className="ios-card p-6 mt-6">
                 <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('contract.fullDetails')}</h3>
                 <div className="space-y-3 text-sm text-slate-700">
                   <div className="flex justify-between"><span className="text-slate-500">{t('common.status')}</span><span className="font-bold text-slate-800">{selectedContract.status}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">{t('contract.tenantContact')}</span><span className="font-bold text-slate-800">{displayContractCustomerName(selectedContract)} {selectedContract.customerPhone || ''}</span></div>
                   {(selectedContract as any).upfrontPaid ? (
                     <div className="flex justify-between"><span className="text-slate-500">{t('contract.upfrontPaidShort')}</span><span className="font-bold text-slate-800">{Number((selectedContract as any).upfrontPaid || 0).toLocaleString()} {t('common.sar')}</span></div>
                   ) : null}
                   <div className="flex justify-between"><span className="text-slate-500">{t('common.notes')}</span><span className="font-bold text-slate-800">{selectedContract.notes || '-'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">{t('history.autoPayment')}</span><span className={`font-bold text-xs px-2.5 py-1 rounded-lg ${(selectedContract as any).autoPayment ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>{(selectedContract as any).autoPayment ? '✓ Enabled' : 'Disabled'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">{t('contract.createdBy')}</span><span className="font-bold text-slate-800">{selectedContract.createdBy || '-'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">{t('contract.period')}</span><span className="font-bold text-slate-800">{fmtDate(selectedContract.fromDate)} → {fmtDate(selectedContract.toDate)}</span></div>
                 </div>
               </div>

               <div className="ios-card p-6 mt-6">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold uppercase text-slate-400">{t('contract.linkedTransactionsTitle', { count: String(linkedTransactions.length) })}</h3>
                   {linkedTransactions.length > 0 && (
                     <button
                       onClick={() => {
                         // Calculate installment dates
                         const installmentDates = getInstallmentStartDates({
                           fromDate: selectedContract.fromDate,
                           toDate: selectedContract.toDate,
                           periodMonths: selectedContract.periodMonths,
                           periodDays: selectedContract.periodDays,
                           installmentCount: selectedContract.installmentCount
                         });
                         const contractEndDate = new Date(selectedContract.toDate + 'T00:00:00');
                         
                         // Prepare rows with period calculations
                         const rows = linkedTransactions.map(tx => {
                           const installmentMatch = tx.details?.match(/Installment\s+(\d+)/i) || tx.details?.match(/(\d+)(?:st|nd|rd|th)\s+Payment/i);
                           let installmentNo = installmentMatch ? parseInt(installmentMatch[1]) : null;
                           if (!installmentNo && tx.details?.toLowerCase().includes('1st payment')) installmentNo = 1;
                           
                           let periodDisplay = '-';
                           if (installmentNo && installmentDates[installmentNo - 1]) {
                             const startDate = installmentDates[installmentNo - 1];
                             let endDate: Date;
                             if (installmentNo < installmentDates.length) {
                               endDate = new Date(installmentDates[installmentNo]);
                               endDate.setDate(endDate.getDate() - 1);
                             } else {
                               endDate = contractEndDate;
                             }
                             periodDisplay = `${fmtDate(dateToLocalStr(startDate))} → ${fmtDate(dateToLocalStr(endDate))}`;
                           }
                           return { ...tx, periodDisplay };
                         });
                         
                         const bldForPrint = buildings.find(b => b.id === selectedContract.buildingId);
                         const isVATForPrint = bldForPrint?.propertyType === 'NON_RESIDENTIAL' || bldForPrint?.vatApplicable === true;
                         const totalPaid = linkedTransactions.reduce((sum, tx) => sum + Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount || 0), 0);
                         const vatForPrint = isVATForPrint ? (Number((selectedContract as any).rentValue || 0)) * 0.15 + Math.max(0, (Number(selectedContract.firstInstallment || 0) + Number((selectedContract as any).upfrontPaid || 0)) - Number(selectedContract.otherInstallment || 0)) * 0.15 : 0;
                         const remaining = (selectedContract.totalValue + vatForPrint) - totalPaid;
                         
                         const printWindow = window.open('', '_blank');
                         if (!printWindow) return;
                         printWindow.document.write(`
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Payment Statement - ${selectedContract.contractNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1e293b; line-height: 1.5; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
  .logo-section h1 { font-size: 24px; font-weight: 800; color: #10b981; }
  .logo-section p { color: #64748b; font-size: 12px; margin-top: 4px; }
  .doc-info { text-align: right; }
  .doc-info h2 { font-size: 18px; color: #334155; font-weight: 700; }
  .doc-info .date { color: #64748b; font-size: 12px; margin-top: 4px; }
  .contract-box { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .contract-box .item { }
  .contract-box .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
  .contract-box .value { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px; }
  .contract-box .value.highlight { color: #10b981; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead { background: #f8fafc; }
  th { padding: 12px 16px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:hover { background: #f8fafc; }
  .amount { font-weight: 700; color: #1e293b; }
  .status-approved { color: #059669; font-weight: 700; font-size: 11px; background: #d1fae5; padding: 4px 10px; border-radius: 20px; }
  .status-pending { color: #d97706; font-weight: 700; font-size: 11px; background: #fef3c7; padding: 4px 10px; border-radius: 20px; }
  .period { font-size: 11px; color: #64748b; font-weight: 500; }
  .summary-row { display: flex; justify-content: flex-end; gap: 24px; padding: 20px; background: #f8fafc; border-radius: 12px; }
  .summary-item { text-align: right; }
  .summary-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
  .summary-item .value { font-size: 20px; font-weight: 800; }
  .summary-item .value.paid { color: #10b981; }
  .summary-item .value.remaining { color: #ef4444; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print { body { padding: 0; } .header { page-break-after: avoid; } }
</style>
</head><body>
<div class="header">
  <div class="logo-section">
    <h1>AMLAK</h1>
    <p>Property Management System</p>
  </div>
  <div class="doc-info">
    <h2>Payment Statement</h2>
    <div class="date">Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
  </div>
</div>
<div class="contract-box">
  <div class="item"><div class="label">Contract No</div><div class="value">${selectedContract.contractNo}</div></div>
  <div class="item"><div class="label">${t('history.customer')}</div><div class="value">${displayContractCustomerName(selectedContract)}</div></div>
  <div class="item"><div class="label">${t('entry.unit')}</div><div class="value">${selectedContract.unitName}</div></div>
  <div class="item"><div class="label">${t('entry.building')}</div><div class="value">${selectedContract.buildingName}</div></div>
  <div class="item"><div class="label">Contract Period</div><div class="value">${fmtDate(selectedContract.fromDate)} → ${fmtDate(selectedContract.toDate)}</div></div>
  <div class="item"><div class="label">Contract Value</div><div class="value highlight">${selectedContract.totalValue.toLocaleString()} SAR</div></div>
</div>
<table>
  <thead><tr><th>${t('tenant.paymentDate')}</th><th>${t('common.amount')}</th><th>${t('history.method')}</th><th>${t('common.status')}</th><th>Period (Start → End)</th><th>${t('common.details')}</th></tr></thead>
  <tbody>
    ${rows.map(tx => `
      <tr>
        <td>${fmtDate(tx.date)}</td>
        <td class="amount">${Number(tx.amount).toLocaleString()} SAR</td>
        <td>${tx.paymentMethod || '-'}</td>
        <td><span class="${tx.status === 'APPROVED' ? 'status-approved' : 'status-pending'}">${tx.status}</span></td>
        <td class="period">${tx.periodDisplay}</td>
        <td>${tx.details || '-'}</td>
      </tr>
    `).join('')}
  </tbody>
</table>
<div class="summary-row">
  <div class="summary-item"><div class="label">${t('tenant.totalPaid')}</div><div class="value paid">${totalPaid.toLocaleString()} SAR</div></div>
  <div class="summary-item"><div class="label">Remaining Balance</div><div class="value remaining">${remaining.toLocaleString()} SAR</div></div>
</div>
<div class="footer">This is a computer-generated statement. For queries, please contact the property management office.</div>
</body></html>`);
                         printWindow.document.close();
                         printWindow.focus();
                         setTimeout(() => printWindow.print(), 300);
                       }}
                       className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                     >
                       <Printer size={14} />{t('common.print')}</button>
                   )}
                 </div>
                 {linkedTransactions.length === 0 && <div className="text-slate-500">{t('contract.noTransactions')}</div>}
                 {linkedTransactions.length > 0 && (
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm">
                       <thead>
                         <tr className="text-start text-slate-500 text-xs uppercase"><th className="py-2">{t('tenant.paymentDate')}</th><th>{t('common.amount')}</th><th>{t('history.method')}</th><th>{t('common.status')}</th><th>{t('contract.periodRange')}</th><th>{t('common.details')}</th></tr>
                       </thead>
                       <tbody>
                         {(() => {
                           // Calculate installment dates for this contract
                           const installmentDates = getInstallmentStartDates({
                             fromDate: selectedContract.fromDate,
                             toDate: selectedContract.toDate,
                             periodMonths: selectedContract.periodMonths,
                             periodDays: selectedContract.periodDays,
                             installmentCount: selectedContract.installmentCount
                           });
                           const contractEndDate = new Date(selectedContract.toDate + 'T00:00:00');
                           return linkedTransactions.map(tx => {
                             // Extract installment number from details (e.g. "Installment 2" or "1st Payment")
                             const installmentMatch = tx.details?.match(/Installment\s+(\d+)/i) || tx.details?.match(/(\d+)(?:st|nd|rd|th)\s+Payment/i);
                             let installmentNo = installmentMatch ? parseInt(installmentMatch[1]) : null;
                             if (!installmentNo && tx.details?.toLowerCase().includes('1st payment')) installmentNo = 1;
                             
                             // Calculate start and end date for this installment
                             let periodDisplay = '-';
                             if (installmentNo && installmentDates[installmentNo - 1]) {
                               const startDate = installmentDates[installmentNo - 1];
                               // End date is day before next installment, or contract end date for last installment
                               let endDate: Date;
                               if (installmentNo < installmentDates.length) {
                                 endDate = new Date(installmentDates[installmentNo]);
                                 endDate.setDate(endDate.getDate() - 1);
                               } else {
                                 endDate = contractEndDate;
                               }
                               periodDisplay = `${fmtDate(dateToLocalStr(startDate))} → ${fmtDate(dateToLocalStr(endDate))}`;
                             }
                             return (
                               <tr key={tx.id} className="border-t border-slate-100">
                                 <td className="py-3 text-slate-600">{fmtDate(tx.date)}</td>
                                 <td className="font-bold text-slate-800"><div className="amount-pill amount-neutral"><span className="amt-value">{Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount).toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></td>
                                 <td className="text-slate-600">{tx.paymentMethod || '-'}</td>
                                 <td className={`text-xs font-bold ${tx.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-600'}`}>{tx.status}</td>
                                 <td className="text-slate-600 font-medium text-xs">{periodDisplay}</td>
                                 <td className="text-slate-600">{tx.details || '-'}</td>
                               </tr>
                             );
                           });
                         })()}
                       </tbody>
                     </table>
                   </div>
                 )}
               </div>

               {/* Renewal History — previous contracts in the chain */}
               {renewalHistory.length > 0 && (
                 <div className="ios-card p-6 mt-6">
                   <h3 className="text-sm font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                     <RefreshCw size={14} className="text-blue-500" />
                     {t('contract.renewalHistory') || 'Renewal History'}
                     <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{renewalHistory.length}</span>
                   </h3>
                   <div className="space-y-3">
                     {renewalHistory.map((old, idx) => {
                       const progress = contractsWithProgress.find((p: any) => p.id === old.id);
                       const oldPaid = progress?.paid ?? null;
                       return (
                         <div
                           key={old.id}
                           onClick={() => openDetails(old)}
                           className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group"
                         >
                           <div className="flex items-center gap-3">
                             <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[11px] font-black flex-shrink-0">
                               {idx + 1}
                             </div>
                             <div>
                               <div className="text-sm font-bold text-slate-800">#{old.contractNo} — {old.unitName}</div>
                               <div className="text-xs text-slate-500">{fmtDate(old.fromDate)} → {fmtDate(old.toDate)}</div>
                             </div>
                           </div>
                           <div className="text-end">
                             <div className="text-sm font-black text-slate-700">{old.totalValue?.toLocaleString()} {t('common.sar')}</div>
                             {oldPaid !== null && (
                               <div className="text-[10px] text-slate-500">{t('tenant.totalPaid')}: {oldPaid.toLocaleString()}</div>
                             )}
                             <div className="text-[10px] font-bold text-blue-600">{old.status}</div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {/* Customer's Other Contracts */}
               {(() => {
                 const customerContracts = existingContracts.filter(
                   c => c.customerId === selectedContract.customerId && c.id !== selectedContract.id && !(c as any).deleted
                 );
                 if (customerContracts.length === 0) return null;
                 return (
                   <div className="ios-card p-6 mt-6">
                     <h3 className="text-sm font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                       <UserIcon size={14} className="text-emerald-500" />
                       {t('contract.otherContracts', { name: displayContractCustomerName(selectedContract), count: String(customerContracts.length) })}
                     </h3>
                     <div className="space-y-3">
                       {customerContracts.map(cc => {
                         const progress = contractsWithProgress.find((p: any) => p.id === cc.id);
                         return (
                           <div
                             key={cc.id}
                             onClick={() => openDetails(cc)}
                             className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all group"
                           >
                             <div className="flex items-center gap-3">
                               <div className={`w-2 h-2 rounded-full ${cc.status === 'Active' ? 'bg-emerald-500' : cc.status === 'Terminated' ? 'bg-rose-500' : (typeof cc.status === 'string' && cc.status.startsWith('Old ')) ? 'bg-blue-400' : 'bg-amber-500'}`}></div>
                               <div>
                                 <div className="text-sm font-bold text-slate-800">#{cc.contractNo} — {cc.unitName}</div>
                                 <div className="text-xs text-slate-500">{cc.buildingName} · {fmtDate(cc.fromDate)} → {fmtDate(cc.toDate)}</div>
                               </div>
                             </div>
                             <div className="text-end">
                               <div className="text-sm font-black text-slate-700">{cc.totalValue.toLocaleString()} SAR</div>
                               <div className={`text-[10px] font-bold ${cc.status === 'Active' ? 'text-emerald-600' : (typeof cc.status === 'string' && cc.status.startsWith('Old ')) ? 'text-blue-500' : 'text-slate-400'}`}>{cc.status}</div>
                               {progress?.paidPercent !== undefined && (
                                 <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 ml-auto">
                                   <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${progress.paidPercent}%` }}></div>
                                 </div>
                               )}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })()}
        </div>
      );
  }

  const filteredContracts = contractsWithProgress.filter((c: any) => {
    // Filter by deleted status first
    if (showDeleted ? !(c as any).deleted : (c as any).deleted) return false;
    if (filterStatuses.length > 0) {
      const isExpiring = c.status === 'Active' && c.daysRemaining >= 0 && c.daysRemaining <= EXPIRING_THRESHOLD_DAYS;
      const isOld = typeof c.status === 'string' && c.status.startsWith('Old ');
      const matchesAny = filterStatuses.includes(c.status) ||
        (filterStatuses.includes('Expiring') && isExpiring) ||
        (filterStatuses.includes('Old') && isOld);
      if (!matchesAny) return false;
      // If only Expiring selected (not Active), exclude non-expiring Active
      if (filterStatuses.includes('Expiring') && !filterStatuses.includes('Active') && c.status === 'Active' && !isExpiring) return false;
    }
    if (filterBuildingIds.length > 0 && !filterBuildingIds.includes(c.buildingId)) return false;
    if (filterTenants.length > 0 && !filterTenants.includes(c.customerId)) return false;
    if (filterUnits.length > 0 && !filterUnits.includes(c.unitName)) return false;
    if (filterFeeTypes.length > 0) {
      const hasFee: Record<string, boolean> = {
        water: Number(c.waterFee) > 0,
        internet: Number(c.internetFee) > 0,
        parking: Number(c.parkingFee) > 0,
        office: Number(c.officeFeeAmount) > 0,
        insurance: Number(c.insuranceFee) > 0,
        service: Number(c.serviceFee) > 0,
        upfront: Number((c as any).upfrontPaid) > 0,
      };
      const feeMatches = filterFeeTypes.every(f => hasFee[f]);
      if (!feeMatches) return false;
    }
    // When Expiring is selected, date filters apply to end date (expiry); otherwise contract date
    const useExpiryDate = filterStatuses.includes('Expiring');
    const dateField = useExpiryDate ? (c.toDate || c.endDate || '') : (c.contractDate || '');
    if (filterFromDate && dateField) {
      if (new Date(dateField + 'T00:00:00') < new Date(filterFromDate + 'T00:00:00')) return false;
    }
    if (filterToDate && dateField) {
      if (new Date(dateField + 'T00:00:00') > new Date(filterToDate + 'T00:00:00')) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = (c.customerName || '').toLowerCase().includes(q) || (c.unitName || '').toLowerCase().includes(q) || (String(c.contractNo) || '').toLowerCase().includes(q) || (c.buildingName || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }).sort((a: any, b: any) => {
    // Alphanumeric sort helper: extract text prefix and number for natural ordering
    // e.g. A101 < A102 < B101 < B103
    const alphaNumCmp = (s1: string, s2: string) => {
      const m1 = s1.match(/^([A-Za-z\s-]*)[-.]?(\d+)(.*)$/);
      const m2 = s2.match(/^([A-Za-z\s-]*)[-.]?(\d+)(.*)$/);
      if (m1 && m2) {
        const p1 = m1[1].replace(/[-\s]+$/, '').toLowerCase();
        const p2 = m2[1].replace(/[-\s]+$/, '').toLowerCase();
        if (p1 !== p2) return p1.localeCompare(p2);
        const n1 = parseInt(m1[2]); const n2 = parseInt(m2[2]);
        if (n1 !== n2) return n1 - n2;
        return (m1[3] || '').localeCompare(m2[3] || '');
      }
      return s1.localeCompare(s2, undefined, { sensitivity: 'base' });
    };
    // Primary sort: days remaining ascending (soonest expiring first)
    const daysA = a.daysRemaining ?? 99999;
    const daysB = b.daysRemaining ?? 99999;
    if (daysA !== daysB) return daysA - daysB;
    // Secondary sort: building name ascending
    const bldgCmp = alphaNumCmp(a.buildingName || '', b.buildingName || '');
    if (bldgCmp !== 0) return bldgCmp;
    // Tertiary sort: unit name ascending (A101 < A102 < B101)
    const unitCmp = alphaNumCmp(a.unitName || '', b.unitName || '');
    if (unitCmp !== 0) return unitCmp;
    // Quaternary sort: contract number ascending
    return (parseInt(a.contractNo) || 0) - (parseInt(b.contractNo) || 0);
  });

  return (
    <div className="mobile-tab-shell tab-contracts max-w-6xl mx-auto animate-fade-in pb-20">
      {renderConfirmModal()}
      <div className="glass-tab-bar mb-6 max-w-sm mx-auto">
         <button onClick={() => { setView('FORM'); resetForm(); }} className={`glass-tab ${view === 'FORM' ? 'is-active' : ''}`}><PlusCircle size={16} />{t('contract.new')}</button>
         <button onClick={() => setView('LIST')} className={`glass-tab ${view === 'LIST' ? 'is-active' : ''}`}><List size={16} />{t('contract.list')}</button>
      </div>

      {view === 'FORM' ? (
        <form onSubmit={handleSubmit} className="ios-card p-8 space-y-8 relative">
           {errorMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl flex items-center gap-3 animate-shake shadow-sm font-semibold"><AlertTriangle /> {errorMsg}</div>}

           <div className="flex justify-between items-center pb-4 border-b border-slate-100">
               <div>
                  <h2 className="text-xl font-bold text-slate-900">{editingContractId ? t('contract.editContract') : renewalSourceId ? t('contract.renewContract') : t('contract.newLease')}</h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">{editingContractId ? t('contract.editFormDesc') : renewalSourceId ? t('contract.renewFormDesc') : t('contract.fillDetails')}</p>
               </div>
               <div className="bg-ios-bg text-slate-500 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-slate-200">#{nextContractNo}</div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
               <InputField label={t('common.date')} value={contractDate} setter={setContractDate} type="date" readonly={dateOnlyMode} lang={isRTL ? 'ar' : 'en'} />
               <div className="lg:col-span-3 space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.tenant')}</label>
                  <SearchableSelect
                    options={sortedCustomers
                      .filter(c => !c.isBlacklisted && !(c as any).deleted)
                      .map(c => ({
                        value: c.id,
                        label: formatCustomerLabel(c),
                        sublabel: c.mobileNo
                      }))}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder={t('contract.selectTenant')}
                    disabled={isRestrictedEdit || dateOnlyMode}
                  />
               </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Building2 size={16}/> {t('contract.propertyDetails')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.building')} {isRenewal && <span className="text-orange-600 font-black text-xs">({t('contract.lockedOnRenewal')})</span>}</label>
                          {(renewalSourceId || editingContractId) ? (
                            <div className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-800">
                              {buildings.find(b => b.id === buildingId)?.name || 'Unknown Building'}
                            </div>
                          ) : (
                          <select 
                            value={buildingId} 
                            disabled={isRestrictedEdit}
                            onChange={(e) => {setBuildingId(e.target.value); setUnitName(''); setSelectedUnits([]); setUnitSearch(''); setRentValue(0);}} 
                            className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm ${isRestrictedEdit ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                          >
                              <option value="">{t('contract.selectBuilding')}</option>
                              {[...buildings].sort((a, b) => {
                                // Extract numbers from building names for sorting
                                const aMatch = a.name.match(/\d+/);
                                const bMatch = b.name.match(/\d+/);
                                if (aMatch && bMatch) {
                                  return parseInt(aMatch[0]) - parseInt(bMatch[0]);
                                }
                                return a.name.localeCompare(b.name);
                              }).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          )}
                      </div>
                      {(renewalSourceId || editingContractId) ? (
                        <div className="col-span-2 space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.roomUnit')} {isRenewal && <span className="text-orange-600 font-black text-xs">({t('contract.lockedOnRenewal')})</span>}</label>
                          <div className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-800">
                            {selectedUnits.length > 0 ? selectedUnits.join(', ') : (unitName || t('contract.noUnit'))}
                          </div>
                        </div>
                      ) : (
                      <div className="col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.units')}</label>
                        <input
                          type="text"
                          readOnly={isRestrictedEdit}
                          disabled={isRestrictedEdit}
                          value={unitSearch}
                          onChange={(e) => setUnitSearch(e.target.value)}
                          placeholder={isRestrictedEdit ? t('contract.unitLocked') : t('contract.searchUnit')}
                          className={`w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm ${isRestrictedEdit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                        />
                        <div className={`max-h-48 overflow-y-auto border border-slate-300 rounded-xl p-3 bg-white ${isRestrictedEdit ? 'opacity-60 pointer-events-none bg-slate-50' : ''}`}>
                            {!buildingId ? (
                                <div className="text-slate-400 text-sm">{t('contract.selectBuildingFirst')}</div>
                              ) : (
                                <div className="space-y-2">
                                  {(
                                    buildings.find(b => b.id === buildingId)?.units || []
                                  )
                                    .filter(u => {
                                      if (renewalSourceId || editingContractId) return true;
                                      return !existingContracts.some(c => c.buildingId === buildingId && (c.unitName === u.name || (c.unitName && c.unitName.split(', ').includes(u.name))) && c.status === 'Active');
                                    })
                                    .filter(u => {
                                      if (!unitSearch.trim()) return true;
                                      return (u.name || '').toLowerCase().includes(unitSearch.toLowerCase());
                                    })
                                    .map(u => (
                                      <label key={u.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedUnits.includes(u.name)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedUnits([...selectedUnits, u.name]);
                                            } else {
                                              setSelectedUnits(selectedUnits.filter(name => name !== u.name));
                                            }
                                            setUnitName(''); // Clear single unit selection
                                          }}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                                        <span className="text-xs text-slate-500 ms-auto">{u.defaultRent?.toLocaleString()} SAR/yr</span>
                                      </label>
                                    ))}
                                  {selectedUnits.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                      <div className="text-xs font-bold text-slate-600">{t('contract.selectedUnits', { units: selectedUnits.join(', ') })}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                    <div className="text-xs font-bold text-blue-600 uppercase">{t('contract.baseAnnualRent')}</div>
                    <div className="text-2xl font-black text-blue-900 mt-1">{Number(baseAnnualRent).toLocaleString()} <span className="text-sm">{t('contract.sarPerYear')}</span></div>
                    {toNum(periodMonths) !== 12 || toNum(periodDays) !== 0 ? (
                      <div className="text-xs text-blue-600 mt-1 font-semibold">
                        {t('contract.scaledToText', { months: String(toNum(periodMonths)), extra: toNum(periodDays) > 0 ? ` ${toNum(periodDays)}${t('contract.days')[0]}` : '', amount: Number(rentValue).toLocaleString() })}
                      </div>
                    ) : null}
                  </div>

                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pt-4 border-t border-slate-100"><CalendarClock size={16}/>{t('contract.schedule')}</h3>
                  {isWeekendStart && <div className="text-[10px] text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold"><Calendar size={12}/>{t('contract.warningWeekend')}</div>}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <InputField label={t('contract.months')} value={periodMonths} setter={setPeriodMonths} readonly={dateOnlyMode} />
                      <InputField label={t('contract.days')} value={periodDays} setter={setPeriodDays} readonly={dateOnlyMode} />
                      <InputField label={t('contract.installments')} value={installmentCount} setter={setInstallmentCount} readonly={dateOnlyMode} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                      {/* Explicitly ensure start date is editable for staff even if other fields are restricted */}
                      <InputField label={t('contract.startDate')} value={fromDate} setter={setFromDate} type="date" readonly={false} lang={isRTL ? 'ar' : 'en'} />
                      <InputField label={t('contract.endDate')} value={toDate} readonly={true} type="date" lang={isRTL ? 'ar' : 'en'} />
                  </div>

                  {/* Auto Payment Toggle */}
                  <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Repeat size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 text-sm block">{t('history.autoPayment')}</span>
                          <span className="text-[10px] text-slate-500">{t('contract.autoPaymentDesc')}</span>
                        </div>
                      </div>
                      <div className={`relative inline-flex items-center ${dateOnlyMode ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} onClick={() => !dateOnlyMode && setAutoPayment(!autoPayment)}>
                        <div className={`w-11 h-6 rounded-full transition-colors ${autoPayment ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform transform ${autoPayment ? 'translate-x-6' : 'translate-x-1'}`}></div>
                      </div>
                    </div>
                    {autoPayment && (
                      <div className="mt-3 pt-3 border-t border-blue-100 text-[10px] text-blue-600 font-semibold flex items-center gap-1.5">
                        <CheckCircle size={11} /> {t('contract.autoPaymentNote')}
                      </div>
                    )}
                  </div>
              </div>

              <div className="bg-slate-50/50 rounded-3xl p-3 sm:p-6 border border-slate-200">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-6"><Calculator size={16}/>{t('contract.financialBreakdown')}</h3>
                  
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4">
                      <InputField label={t('contract.rentValueTotal')} value={rentValue} setter={setRentValue} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label={t('contract.upfrontPaid')} value={upfrontPaid} setter={setUpfrontPaid} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label={t('contract.waterRate')} value={monthlyWaterRate} setter={(v: any) => {
                        setMonthlyWaterRate(v);
                        const rate = typeof v === 'string' ? (parseFloat(v) || 0) : (v || 0);
                        const totalMonths = toNum(periodMonths) + toNum(periodDays) / 30;
                        setWaterFee(Math.round(rate * (totalMonths / 12)));
                      }} prefix="SAR" readonly={isRestrictedEdit} />
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.waterFee')}</label>
                        <div className="w-full ps-3 sm:ps-4 pe-2 sm:pe-4 py-2.5 sm:py-3 bg-slate-100/50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-500">
                          {Number(waterFee).toLocaleString()} SAR
                        </div>
                      </div>
                      <InputField label={t('contract.internetFee')} value={internetFee} setter={setInternetFee} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label="Parking Fee" value={parkingFee} setter={setParkingFee} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label="Management Fee" value={managementFee} setter={setManagementFee} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label="Electricity Meter" value={electricityMeter} setter={setElectricityMeter} type="text" readonly={isRestrictedEdit} />
                      <InputField label={t('contract.officeCharge')} value={officePercent} setter={setOfficePercent} readonly={isRestrictedEdit || !!renewalSourceId} />
                      
                      <div className="space-y-2 col-span-2">
                          <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">{t('contract.officeFeeAmount')} {renewalSourceId && <span className="text-rose-500 text-[9px]">({t('contract.notChargedOnRenewal')})</span>}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={officeFeeAmountInput}
                            onChange={!isRestrictedEdit && !renewalSourceId ? (e => {
                              const val = e.target.value;
                              if (!/^\d*\.?\d*$/.test(val)) return;
                              setOfficeFeeTouched(true);
                              setOfficeFeeAmountInput(val);
                            }) : undefined}
                            onBlur={!isRestrictedEdit && !renewalSourceId ? (e => {
                              const num = parseFloat(e.target.value);
                              setOfficeFeeAmountInput(isNaN(num) ? '0' : num.toFixed(2));
                            }) : undefined}
                            className="w-full ps-3 sm:ps-4 pe-2 sm:pe-4 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl outline-none text-xs sm:text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            readOnly={isRestrictedEdit || !!renewalSourceId}
                          />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ms-1">
                          {t('contract.insurance')} {renewalSourceId && <span className="text-purple-500 text-[9px] normal-case">({t('contract.insuranceReference')})</span>}
                        </label>
                        <div className="relative group form-with-icon has-prefix">
                          <span className="absolute start-2 sm:start-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] sm:text-xs z-30 bg-white px-1 sm:px-2 rounded" style={{pointerEvents:'none'}}>{t('common.sar')}</span>
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={insuranceFee}
                            readOnly={isRestrictedEdit}
                            onChange={(e) => setInsuranceFee(e.target.value)}
                            className={`w-full ps-10 sm:ps-14 pe-2 sm:pe-4 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl outline-none text-xs sm:text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-blue-500 ${isRestrictedEdit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>
                      <InputField label={t('contract.serviceFee')} value={serviceFee} setter={setServiceFee} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label={t('contract.otherFees')} value={otherAmount} setter={setOtherAmount} prefix="SAR" readonly={isRestrictedEdit} />
                      <InputField label={t('entry.deduction')} value={otherDeduction} setter={setOtherDeduction} prefix="SAR" readonly={isRestrictedEdit} />

                      <div className="col-span-2 mt-4 bg-white border-2 border-slate-200 p-6 rounded-2xl shadow-lg relative overflow-hidden">
                          <div className="flex justify-between items-end mb-4 relative z-10">
                             <span className="text-xs font-bold uppercase tracking-widest text-slate-900">{t('contract.totalValue')}</span>
                             <div className="text-3xl font-black tracking-tight text-slate-900"><div className="amount-pill amount-neutral"><span className="amt-value">{totalValue.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                          </div>
                          {upfrontCoverage && (
                            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm relative z-10">
                              <div className="font-bold text-emerald-800 mb-1">{t('contract.upfrontCoverage', { amount: upfrontCoverage.total.toLocaleString() })}</div>
                              <div className="text-emerald-700">
                                {upfrontCoverage.coveredCount > 0 && (upfrontCoverage.coveredCount > 1 ? t('contract.coversInstallmentsMany', { count: String(upfrontCoverage.coveredCount) }) : t('contract.coversInstallmentsOne'))}
                                {upfrontCoverage.coveredCount > 0 && upfrontCoverage.partialAmount > 0 && <> + </>}
                                {upfrontCoverage.partialAmount > 0 && t('contract.sarTowardsInstallment', { amount: String((upfrontCoverage.coveredCount > 0 ? (otherInstallment - upfrontCoverage.partialAmount) : ((_baseFirst || 0) - firstInstallment)).toLocaleString()), num: String(upfrontCoverage.coveredCount + 1) })}
                              </div>
                            </div>
                          )}
                          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 relative z-10">
                                <div>
                                  <div className="text-[10px] text-slate-900 uppercase font-black mb-1">{upfrontCoverage && firstInstallment === 0 ? t('contract.firstPaymentPaid') : t('contract.firstPayment')}</div>
                                  <div className="text-xl font-bold text-slate-900"><div className="amount-pill amount-neutral"><span className="amt-value">{firstInstallment.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-900 uppercase font-black mb-1">{t('contract.others', { count: String(Number(installmentCount)-1) })}</div>
                                  <div className="text-xl font-bold text-slate-900"><div className="amount-pill amount-neutral"><span className="amt-value">{otherInstallment.toLocaleString()}</span><span className="amt-curr">{t('common.sar')}</span></div></div>
                                </div>
                          </div>
                          {/* VAT / Non-VAT split — only shown for non-residential buildings */}
                          {calcIsVAT && (nonVatFeesTotal > 0) && (
                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Per-Installment Breakdown</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                  <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Rent (VAT Invoice)</div>
                                  <div className="font-black text-emerald-800 text-base">{rentOtherInstallment.toLocaleString()} <span className="text-[10px] font-bold">SAR</span></div>
                                  <div className="text-[9px] text-emerald-500 mt-0.5">Total: {rentOnlyTotal.toLocaleString()} SAR</div>
                                </div>
                                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                                  <div className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-1">Fees (No VAT)</div>
                                  <div className="font-black text-sky-800 text-base">{nonVatOtherInstallment.toLocaleString()} <span className="text-[10px] font-bold">SAR</span></div>
                                  <div className="text-[9px] text-sky-500 mt-0.5">Total: {nonVatFeesTotal.toLocaleString()} SAR</div>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                  </div>
              </div>
           </div>

           <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50">{t('common.reset')}</button>
              <button type="submit" disabled={loading} className="bg-ios-blue text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2">
                  {loading ? <RefreshCw className="animate-spin" /> : <Save size={18} />} {editingContractId ? t('contract.update') : t('contract.save')}
              </button>
           </div>
           <LoadingOverlay visible={loading} message="جاري حفظ العقد..." />
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center mb-2">
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('contract.search')} className="px-3 py-2 rounded-xl border bg-white text-sm w-full md:w-64" />
            <div className="flex items-center gap-1 flex-wrap">
              {([
                { status: 'Active', selectedCls: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200', labelKey: 'contract.statusActive' },
                { status: 'Expiring', selectedCls: 'bg-orange-50 text-orange-700 border-orange-300 ring-1 ring-orange-200', labelKey: 'contract.statusExpiring' },
                { status: 'Expired', selectedCls: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200', labelKey: 'contract.statusExpired' },
                { status: 'Terminated', selectedCls: 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-200', labelKey: 'contract.statusTerminated' },
                { status: 'Old', selectedCls: 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200', labelKey: 'contract.statusOld' },
              ] as { status: string; selectedCls: string; labelKey: string }[]).map(({ status, selectedCls, labelKey }) => {
                const isSelected = filterStatuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      SoundService.play('click');
                      setFilterStatuses(prev =>
                        prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      isSelected ? selectedCls : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { SoundService.play('click'); setFilterStatuses([]); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  filterStatuses.length === 0
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >{t('common.all')}</button>
            </div>
            {/* Building multi-select */}
            <div className="relative" data-filter-dropdown>
              <button type="button" onClick={() => { setShowBuildingFilter(!showBuildingFilter); setShowTenantFilter(false); setShowUnitFilter(false); SoundService.play('click'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${filterBuildingIds.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <Building2 size={13} />
                {filterBuildingIds.length === 0 ? t('contract.buildingsAll') : t('contract.buildingsCount', { count: String(filterBuildingIds.length) })}
              </button>
              {showBuildingFilter && (
                <div className="absolute top-full start-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[220px] max-h-64 overflow-y-auto">
                  <input value={buildingFilterSearch} onChange={e => setBuildingFilterSearch(e.target.value)} placeholder={t('contract.searchBuildings')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg mb-1.5 outline-none focus:ring-1 focus:ring-blue-300" />
                  <button type="button" onClick={() => { setFilterBuildingIds([]); SoundService.play('click'); }} className="w-full text-start px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg mb-1">{t('common.clearAll')}</button>
                  {[...buildings].sort((a, b) => {
                    const aM = a.name.match(/^([A-Za-z\s-]*)[-.]?(\d+)(.*)$/);
                    const bM = b.name.match(/^([A-Za-z\s-]*)[-.]?(\d+)(.*)$/);
                    if (aM && bM) { const aP = aM[1].replace(/[-\s]+$/, '').toLowerCase(); const bP = bM[1].replace(/[-\s]+$/, '').toLowerCase(); if (aP !== bP) return aP.localeCompare(bP); return parseInt(aM[2]) - parseInt(bM[2]); }
                    return a.name.localeCompare(b.name);
                  }).filter(b => !buildingFilterSearch || b.name.toLowerCase().includes(buildingFilterSearch.toLowerCase())).map(b => (
                    <label key={b.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={filterBuildingIds.includes(b.id)} onChange={() => { setFilterBuildingIds(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id]); SoundService.play('click'); }} className="w-3.5 h-3.5 text-blue-600 rounded" />
                      <span className="text-xs font-medium text-slate-700">{b.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tenant multi-select */}
            <div className="relative" data-filter-dropdown>
              <button type="button" onClick={() => { setShowTenantFilter(!showTenantFilter); setShowBuildingFilter(false); setShowUnitFilter(false); SoundService.play('click'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${filterTenants.length > 0 ? 'bg-violet-50 text-violet-700 border-violet-300 ring-1 ring-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <UserIcon size={13} />
                {filterTenants.length === 0 ? t('contract.tenantsAll') : t('contract.tenantsCount', { count: String(filterTenants.length) })}
              </button>
              {showTenantFilter && (
                <div className="absolute top-full start-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[250px] max-h-64 overflow-y-auto">
                  <input value={tenantFilterSearch} onChange={e => setTenantFilterSearch(e.target.value)} placeholder={t('contract.searchTenants')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg mb-1.5 outline-none focus:ring-1 focus:ring-violet-300" />
                  <button type="button" onClick={() => { setFilterTenants([]); SoundService.play('click'); }} className="w-full text-start px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg mb-1">{t('common.clearAll')}</button>
                  {(() => {
                    const tenantMap = new Map<string, string>();
                    contractsWithProgress.forEach((c: any) => { if (c.customerId && c.customerName && !(c as any).deleted) tenantMap.set(c.customerId, c.customerName); });
                    return [...tenantMap.entries()].sort((a, b) => a[1].localeCompare(b[1])).filter(([, name]) => !tenantFilterSearch || name.toLowerCase().includes(tenantFilterSearch.toLowerCase())).map(([id, name]) => (
                      <label key={id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-violet-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={filterTenants.includes(id)} onChange={() => { setFilterTenants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); SoundService.play('click'); }} className="w-3.5 h-3.5 text-violet-600 rounded" />
                        <span className="text-xs font-medium text-slate-700 truncate">{name}</span>
                      </label>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Unit multi-select */}
            <div className="relative" data-filter-dropdown>
              <button type="button" onClick={() => { setShowUnitFilter(!showUnitFilter); setShowBuildingFilter(false); setShowTenantFilter(false); SoundService.play('click'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${filterUnits.length > 0 ? 'bg-teal-50 text-teal-700 border-teal-300 ring-1 ring-teal-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <List size={13} />
                {filterUnits.length === 0 ? t('contract.unitsAll') : t('contract.unitsCount', { count: String(filterUnits.length) })}
              </button>
              {showUnitFilter && (
                <div className="absolute top-full start-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[180px] max-h-64 overflow-y-auto">
                  <input value={unitFilterSearch} onChange={e => setUnitFilterSearch(e.target.value)} placeholder={t('contract.searchUnits')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg mb-1.5 outline-none focus:ring-1 focus:ring-teal-300" />
                  <button type="button" onClick={() => { setFilterUnits([]); SoundService.play('click'); }} className="w-full text-start px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg mb-1">{t('common.clearAll')}</button>
                  {(() => {
                    const unitSet = new Set<string>();
                    contractsWithProgress.forEach((c: any) => { if (c.unitName && !(c as any).deleted) unitSet.add(c.unitName); });
                    const alphaNumSort = (a: string, b: string) => { const ma = a.match(/^([A-Za-z]*)(\d+)$/); const mb = b.match(/^([A-Za-z]*)(\d+)$/); if (ma && mb) { if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]); return parseInt(ma[2]) - parseInt(mb[2]); } return a.localeCompare(b); };
                    return [...unitSet].sort(alphaNumSort).filter(u => !unitFilterSearch || u.toLowerCase().includes(unitFilterSearch.toLowerCase())).map(unit => (
                      <label key={unit} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-teal-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={filterUnits.includes(unit)} onChange={() => { setFilterUnits(prev => prev.includes(unit) ? prev.filter(x => x !== unit) : [...prev, unit]); SoundService.play('click'); }} className="w-3.5 h-3.5 text-teal-600 rounded" />
                        <span className="text-xs font-medium text-slate-700">{unit}</span>
                      </label>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Fee-type multi-select */}
            <div className="relative" data-filter-dropdown>
              <button type="button" onClick={() => { setShowFeeFilter(!showFeeFilter); setShowBuildingFilter(false); setShowTenantFilter(false); setShowUnitFilter(false); SoundService.play('click'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${filterFeeTypes.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <Wifi size={13} />
                {(() => {
                  const feeLabels: Record<string, string> = {
                    water: 'Water', internet: 'Internet', parking: 'Parking',
                    office: 'Office', insurance: 'Insurance', service: 'Service',
                    upfront: 'Upfront',
                  };
                  if (filterFeeTypes.length === 0) return 'All Fees';
                  if (filterFeeTypes.length === 1) return `Has ${feeLabels[filterFeeTypes[0]]}`;
                  return `${filterFeeTypes.length} Fees`;
                })()}
              </button>
              {showFeeFilter && (
                <div className="absolute top-full start-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[220px]">
                  <button type="button" onClick={() => { setFilterFeeTypes([]); SoundService.play('click'); }} className="w-full text-start px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg mb-1">{t('common.clearAll')}</button>
                  {[
                    { id: 'water', label: 'Water Fee' },
                    { id: 'internet', label: 'Internet Fee (Total)' },
                    { id: 'parking', label: 'Parking Fee' },
                    { id: 'office', label: 'Office Fee Amount' },
                    { id: 'insurance', label: 'Insurance' },
                    { id: 'service', label: 'Service Fee' },
                    { id: 'upfront', label: 'Upfront Paid (1st Only)' },
                  ].map(f => (
                    <label key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterFeeTypes.includes(f.id)}
                        onChange={() => {
                          setFilterFeeTypes(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]);
                          SoundService.play('click');
                        }}
                        className="w-3.5 h-3.5 text-amber-600 rounded"
                      />
                      <span className="text-xs font-medium text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <input type="date" lang={isRTL ? 'ar' : 'en'} value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-white text-xs font-medium" />
            <input type="date" lang={isRTL ? 'ar' : 'en'} value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="px-3 py-1.5 rounded-lg border bg-white text-xs font-medium" />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SavedFilters
                namespace="contracts"
                getCurrent={() => ({ filterStatuses, filterBuildingIds, filterTenants, filterUnits, filterFeeTypes, filterFromDate, filterToDate, searchQuery })}
                apply={(s: any) => { setFilterStatuses(s.filterStatuses || (s.filterStatus ? [s.filterStatus] : ['Active', 'Expired', 'Old'])); setFilterBuildingIds(s.filterBuildingIds || (s.filterBuildingId ? [s.filterBuildingId] : [])); setFilterTenants(s.filterTenants || []); setFilterUnits(s.filterUnits || []); setFilterFeeTypes(s.filterFeeTypes || []); setFilterFromDate(s.filterFromDate || ''); setFilterToDate(s.filterToDate || ''); setSearchQuery(s.searchQuery || ''); }}
              />
              <button onClick={() => { setFilterStatuses(['Active', 'Expired', 'Old']); setFilterBuildingIds([]); setFilterTenants([]); setFilterUnits([]); setFilterFeeTypes([]); setFilterFromDate(''); setFilterToDate(''); setSearchQuery(''); }} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-50 border text-sm">{t('common.reset')}</button>
              {currentUser.role === 'ADMIN' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowDeleted(!showDeleted)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${showDeleted ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-slate-200 text-slate-600'}`}
                  >
                    <Trash2 size={16} /> {showDeleted ? t('contract.active') : t('contract.trash', { count: String(contractsWithProgress.filter((c: any) => (c as any).deleted).length) })}
                  </button>
                  {showDeleted && (
                    <>
                      <button onClick={handleRestoreAll} className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">{t('history.restoreAll')}</button>
                      <button onClick={handleDeleteAll} className="px-3 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">{t('history.deleteAll')}</button>
                    </>
                  )}
                </div>
              )}
              <button onClick={(e) => { e.preventDefault(); handleExportContractsPdf(filteredContracts); }} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white border border-emerald-600 text-slate-900 font-bold text-sm flex items-center gap-1.5"><FileText size={14}/>{t('history.exportPdf')}</button>
              <button onClick={(e) => { e.preventDefault(); handleExportContractsCsv(filteredContracts); }} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white border border-emerald-600 text-slate-900 font-bold text-sm">{t('contract.exportCsv')}</button>
              <button onClick={(e) => { e.preventDefault(); handlePrintCards(filteredContracts); }} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center gap-1.5"><Printer size={14}/> Print Cards</button>
              <button onClick={(e) => { e.preventDefault(); handleExportContractsPdf(filteredContracts); }} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-1.5"><Printer size={14}/>{t('common.print')}</button>
            </div>
          </div>
            {filteredContracts.map(c => (
              <div key={c.id} onClick={() => openDetails(c)} className={`ios-card p-5 hover:bg-white transition-all group relative overflow-hidden cursor-pointer active:scale-[0.99] ${showDeleted ? 'bg-rose-50/40 border-rose-100 opacity-75' : ''}`}>
                      <div className={`absolute start-0 top-0 bottom-0 w-1.5 ${c.status === 'Active' && c.daysRemaining >= 0 && c.daysRemaining <= EXPIRING_THRESHOLD_DAYS ? 'bg-orange-500' : c.status === 'Active' ? 'bg-emerald-500' : c.status === 'Expired' ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                      <div className="flex flex-col md:flex-row gap-6 items-center ps-4">
                          <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono font-bold text-slate-400">#{c.contractNo}</span>
                        {(c as any).autoPayment && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Repeat size={9}/> {t('history.autoPayment')}</span>}
                        {showDeleted && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">{t('history.deleted')}</span>}
                                  {c.daysRemaining >= 0 && c.daysRemaining <= EXPIRING_THRESHOLD_DAYS && c.status === 'Active' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><AlertCircle size={8}/> {t('contract.expiringDays', { days: String(c.daysRemaining) })}</span>}
                              </div>
                              <h3 className="font-bold text-slate-800 text-lg">{displayContractCustomerName(c)}</h3>
                              <p className="text-sm text-slate-500 font-medium">{c.buildingName} • {t('contract.unit')} {c.unitName}</p>
                              {(c.fromDate || c.toDate) && (
                                <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"/>
                                  {c.fromDate ? fmtDate(c.fromDate) : '—'} → {c.toDate ? fmtDate(c.toDate) : '—'}
                                </p>
                              )}
                              {(Number(c.firstInstallment) > 0 || Number(c.otherInstallment) > 0) && (() => {
                                const count = Number(c.installmentCount) || 1;
                                const months = Number((c as any).periodMonths) || 0;
                                const mpi = count > 0 && months > 0 ? Math.round(months / count) : 0;
                                const freqLabel = mpi === 1 ? 'Monthly' : mpi === 2 ? 'Every 2 Months' : mpi === 3 ? 'Quarterly' : mpi === 4 ? 'Every 4 Months' : mpi === 6 ? 'Semi-Annual' : mpi === 12 ? 'Annual' : mpi > 0 ? `Every ${mpi} Months` : '';
                                return (
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-black text-emerald-700">
                                      1st: {Number(c.firstInstallment || 0).toLocaleString()} {t('common.sar')}
                                    </span>
                                    {count > 1 && Number(c.otherInstallment) > 0 && (
                                      <span className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-black text-blue-700">
                                        2nd+: {Number(c.otherInstallment || 0).toLocaleString()} {t('common.sar')}
                                      </span>
                                    )}
                                    {freqLabel && (
                                      <span className="px-2 py-1 bg-violet-50 border border-violet-100 rounded-lg text-[10px] font-black text-violet-600">
                                        {freqLabel}
                                      </span>
                                    )}
                                    <span className="text-[9px] text-slate-400 font-bold">{count} {t('contract.installments')}</span>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const fees: { label: string; value: number; color: string }[] = [
                                  { label: 'Water', value: Number(c.waterFee) || 0, color: 'bg-cyan-50 border-cyan-100 text-cyan-700' },
                                  { label: 'Internet', value: Number(c.internetFee) || 0, color: 'bg-sky-50 border-sky-100 text-sky-700' },
                                  { label: 'Parking', value: Number(c.parkingFee) || 0, color: 'bg-slate-50 border-slate-200 text-slate-600' },
                                  { label: 'Management', value: Number(c.managementFee) || 0, color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
                                  { label: 'Insurance', value: Number(c.insuranceFee) || 0, color: 'bg-orange-50 border-orange-100 text-orange-700' },
                                  { label: 'Service', value: Number(c.serviceFee) || 0, color: 'bg-teal-50 border-teal-100 text-teal-700' },
                                  { label: 'Office Fee', value: Number(c.officeFeeAmount) || 0, color: 'bg-purple-50 border-purple-100 text-purple-700' },
                                  { label: 'Extra', value: Number(c.otherAmount) || 0, color: 'bg-lime-50 border-lime-100 text-lime-700' },
                                  { label: 'Deduction', value: Number(c.otherDeduction) || 0, color: 'bg-rose-50 border-rose-100 text-rose-700' },
                                ];
                                const active = fees.filter(f => f.value > 0);
                                if (!active.length) return null;
                                return (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {active.map(f => (
                                      <span key={f.label} className={`px-2 py-0.5 border rounded-md text-[9px] font-black ${f.color}`}>
                                        {f.label}: {f.label === 'Deduction' ? '-' : ''}{f.value.toLocaleString()}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                          </div>
                          <div className="w-full md:w-64">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                              <span>{t('contract.paidPercent', { percent: String(c.paidPercent) })}</span>
                              <span>{((c.totalValue || 0) + Number((c as any).upfrontPaid || 0)).toLocaleString()} {t('common.sar')}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.paidPercent === 100 ? 'bg-emerald-500' : 'bg-ios-blue'}`} style={{width: `${c.paidPercent}%`}}></div>
                          </div>
                          </div>
                          <div className="flex gap-2">
                              {showDeleted ? (
                                <>
                                  <button onClick={(e) => {e.stopPropagation(); handleRestore(e, c)}} className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors" title={t('contract.restoreShort')}><RotateCcw size={18}/></button>
                                  <button onClick={(e) => {e.stopPropagation(); handlePermanentDelete(e, c)}} className="p-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors" title={t('history.deletePermanently')}><X size={18}/></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={(e) => {e.stopPropagation(); handleEditContract(e, c)}} className="p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors" title={t('contract.editContract')}><Pencil size={18}/></button>
                                  <button onClick={(e) => {e.stopPropagation(); handleRenew(e, c)}} className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors" title={t('common.renew')}><RefreshCw size={18}/></button>
                                  <button onClick={(e) => {e.stopPropagation(); handleFinalize(e, c)}} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title={t('common.finalize')}><Archive size={18}/></button>
                                  <button onClick={(e) => {e.stopPropagation(); handleDelete(e, c)}} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('history.moveToTrash')}><Trash2 size={18}/></button>
                                </>
                              )}
                          </div>
                      </div>
                </div>
            ))}
        </div>
      )}
      <ConfirmDialog
        open={bulkConfirmOpen}
        title={bulkConfirmTitle}
        message={bulkConfirmMessage}
        danger={bulkConfirmDanger}
        onConfirm={() => bulkConfirmAction && bulkConfirmAction()}
        onCancel={closeBulkConfirm}
      />
    </div>
  );
};

export default ContractForm;

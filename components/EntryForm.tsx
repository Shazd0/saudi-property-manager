import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { Transaction, TransactionType, PaymentMethod, ExpenseCategory, User, Building, UserRole, Contract, Vendor, Bank, TransactionStatus, Customer, ServiceAgreement } from '../types';
import { getBuildings, getUsersAcrossBooks, saveTransaction, getActiveContract, getContracts, getVendors, getBanks, saveBank, getTransactions, requestTransactionEdit, getCustomers, getCustomExpenseCategories, saveCustomExpenseCategories, getCustomIncomeCategories, saveCustomIncomeCategories, getTransfers, getServiceAgreements, saveServiceAgreement } from '../services/firestoreService';
import { Save, RefreshCw, CheckCircle, ArrowRight, Banknote, Calendar, Plus, TrendingUp, TrendingDown, Info, CreditCard, UserPlus, FileSignature, Calculator, Receipt, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import { useToast } from './Toast';
import SoundService from '../services/soundService';
import { fmtDate, isDateInCurrentMonth, contractDateToYmd } from '../utils/dateFormat';
import { getInstallmentRange } from '../utils/installmentSchedule';
import { formatNameWithRoom, buildCustomerRoomMap, formatCustomerFromMap } from '../utils/customerDisplay';
import { getNextVatInvoiceNumber } from '../utils/vatInvoiceNumber';
import LoadingOverlay from './LoadingOverlay';
import ConfirmDialog from './ConfirmDialog';
import VATQuickEntryModal, { VATQuickEntryType } from './VATQuickEntryModal';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from '../utils/contractTransactionFilter';
import { getCarriedPriorInstallmentWindow } from '../utils/priorBalanceCarriedInstallment';
import { getNonResFeePeriodContext } from '../utils/nonResidentialFeeSchedule';

// ZATCA QR Code Generation (TLV Format) - Browser Compatible
const generateZATCAQR = (tx: Partial<Transaction>, contract?: Contract, customers?: Customer[]) => {
  const sellerName = 'شركة ارار ميلينيوم المحدودة';
  const sellerVAT = '312610089400003'; // Company VAT number
  const timestamp = new Date(tx.date || Date.now()).toISOString();
  const totalWithVAT = tx.amountIncludingVAT || tx.totalWithVat || tx.amount || 0;
  const vatAmount = tx.vatAmount || 0;
  
  // Convert string to UTF-8 bytes then to hex
  const stringToHex = (str: string) => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  
  // Convert hex string to bytes then to base64
  const hexToBase64 = (hex: string) => {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    const binary = String.fromCharCode.apply(null, bytes as any);
    return btoa(binary);
  };
  
  // TLV Encoding (Tag-Length-Value) for ZATCA
  const encode = (tag: number, value: string) => {
    const hex = stringToHex(value);
    const length = (hex.length / 2).toString(16).padStart(2, '0');
    return tag.toString(16).padStart(2, '0') + length + hex;
  };
  
  const tlv = [
    encode(1, sellerName),
    encode(2, sellerVAT),
    encode(3, timestamp),
    encode(4, totalWithVAT.toString()),
    encode(5, vatAmount.toString())
  ].join('');
  
  return hexToBase64(tlv);
};

const getVatInclusiveEditAmount = (transaction: Transaction): number => {
  const explicitInclusive = transaction.amountIncludingVAT ?? transaction.totalWithVat;
  const base = Number(transaction.amount || 0);
  const vat = Number(transaction.vatAmount || 0);

  if (explicitInclusive != null) {
    const inclusive = Number(explicitInclusive);
    if (Number.isFinite(inclusive)) {
      // Some older VAT expense rows stored the exclusive/base amount in
      // amountIncludingVAT. In edit mode, show the same inclusive total as History.
      if (
        transaction.type === TransactionType.EXPENSE &&
        vat > 0 &&
        base > 0 &&
        inclusive > 0 &&
        inclusive <= base + 0.01
      ) {
        return base + vat;
      }
      return inclusive;
    }
  }

  if (transaction.type === TransactionType.EXPENSE && vat > 0) {
    return base + vat;
  }

  return base;
};

interface EntryFormProps {
  currentUser: User;
  prefillCategory?: string;
}

export default function EntryForm({ currentUser, prefillCategory: propPrefillCategory }: EntryFormProps) {
  const INCOME_DELETE_OPTION = '__DELETE_SELECTED_INCOME__';
  const EXPENSE_DELETE_OPTION = '__DELETE_SELECTED_EXPENSE__';
    const { showSuccess, showError, showWarning } = useToast();
    const { t, language, isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  
  // Data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [headOfficeBalance, setHeadOfficeBalance] = useState<number | null>(null);
  
  // Form State
  const [id, setId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>(TransactionType.INCOME);
  const [showVATModal, setShowVATModal] = useState(false);
  const [vatModalType, setVatModalType] = useState<VATQuickEntryType>('SALES');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [buildingId, setBuildingId] = useState('');
    const [unitNumber, setUnitNumber] = useState('');
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const canAdminFullEdit = currentUser.role === UserRole.ADMIN;
    /** Set when staff opens an edit from History for a transaction dated in the current month. */
    const [staffOpenedCurrentMonthFullEdit, setStaffOpenedCurrentMonthFullEdit] = useState(false);
    const canFullEditEntry = canAdminFullEdit || (!!id && staffOpenedCurrentMonthFullEdit);
    /** Admin editing an existing transaction from History — unlock create-only controls (type, amount, etc.). */
    const adminEditingExisting = canAdminFullEdit && !!id;
  const [amount, setAmount] = useState<string>('');
  // Non-residential only: allow entering non-VAT fees from the same (rent) entry screen.
  const [nonVatFeesNow, setNonVatFeesNow] = useState<string>('');
  
  // Adjustments & Features
  const [extraAmount, setExtraAmount] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [vatInvoiceNumber, setVatInvoiceNumber] = useState('');
  const [isVATApplicable, setIsVATApplicable] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK);
  const [bankName, setBankName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDueDate, setChequeDueDate] = useState('');
  
  const [newBankName, setNewBankName] = useState('');
  const [newBankIban, setNewBankIban] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);
  /** Prevents double-submit (e.g. double tap) from writing two identical rent rows. */
  const saveInFlightRef = useRef(false);
  
  // Contract Intelligence
  const [activeContract, setActiveContract] = useState<Contract | undefined>(undefined);
  const [contractStats, setContractStats] = useState({
    paid: 0,
    remaining: 0,
    installmentNo: 1,
    priorOutstanding: 0,
    /** Exclusive rent applied to the schedule after FIFO prior-lease balance (renewals). */
    paidExclSchedule: 0,
  });
  const [overpaymentWarning, setOverpaymentWarning] = useState('');
  const [installmentDateRange, setInstallmentDateRange] = useState(''); 
  const [smartInstallmentMsg, setSmartInstallmentMsg] = useState(''); 
    const [contractPayments, setContractPayments] = useState<Transaction[]>([]);
    const [currentInstallmentRemaining, setCurrentInstallmentRemaining] = useState<number>(0);
    const [enteredRemaining, setEnteredRemaining] = useState<number | null>(null);
  const [autoCustomerName, setAutoCustomerName] = useState<string>('');
  const [carryForwardMsg, setCarryForwardMsg] = useState<string>('');
  // Track original creation details to detect edits
  const [originalCreatedAt, setOriginalCreatedAt] = useState<number | undefined>(undefined);
  const [originalCreatedBy, setOriginalCreatedBy] = useState<string | undefined>(undefined);
  const [lastModifiedAt, setLastModifiedAt] = useState<number | undefined>(undefined);

    // Property Rent (Leased Building) Installment Tracking
    const [leaseInstallmentInfo, setLeaseInstallmentInfo] = useState<{
        installmentNo: number;
        installmentAmt: number;
        paidThisInstallment: number;
        remainingThisInstallment: number;
        totalPaid: number;
        totalRemaining: number;
        totalRent: number;
        installmentCount: number;
        isPartial: boolean;
        prevPayments: Transaction[];
    } | null>(null);
    const [leaseEnteredDiff, setLeaseEnteredDiff] = useState<number | null>(null);
  // Expense
  // Expense category should not default to "General Expense" — user must choose (especially for purchases).
  const [expenseCategory, setExpenseCategory] = useState<string>('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [isExternalBorrower, setIsExternalBorrower] = useState(false);
  const [externalBorrowerName, setExternalBorrowerName] = useState('');
  const [targetOwnerId, setTargetOwnerId] = useState('');
  const [targetVendorId, setTargetVendorId] = useState('');
  const [serviceAgreements, setServiceAgreements] = useState<ServiceAgreement[]>([]);
  const [selectedServiceAgreementId, setSelectedServiceAgreementId] = useState('');
  const [details, setDetails] = useState('');
  const [bonus, setBonus] = useState<string>('0');
  const [deduction, setDeduction] = useState<string>('0');
  const [borrowDeduction, setBorrowDeduction] = useState<string>('0');
    const categoryStorageKey = 'customExpenseCategories';
    const [localCategories, setLocalCategories] = useState<string[]>(() => {
        const defaults = Object.values(ExpenseCategory);
        try {
            const raw = localStorage.getItem(categoryStorageKey);
            const stored = raw ? JSON.parse(raw) : [];
            if (Array.isArray(stored)) {
                return Array.from(new Set([...stored, ...defaults])).sort((a, b) => a.localeCompare(b));
            }
        } catch (_) {
            // ignore storage errors
        }
        return defaults.sort((a, b) => a.localeCompare(b));
    });
    const [newCategoryName, setNewCategoryName] = useState('');
    const [vendorVatInfo, setVendorVatInfo] = useState<{inclusive:number, vat:number, exclusive:number} | null>(null);
    const [incomeVatInfo, setIncomeVatInfo] = useState<{inclusive:number, vat:number, exclusive:number} | null>(null);
    const [borrowingType, setBorrowingType] = useState<'BORROW' | 'REPAYMENT'>('BORROW');
    const [incomeSubType, setIncomeSubType] = useState<'RENTAL' | 'OTHER'>('RENTAL');
    const [otherIncomeCategory, setOtherIncomeCategory] = useState('');
    const defaultIncomeCategories = ['Service Fee', 'Penalty', 'Commission', 'Deposit', 'Insurance Claim', 'Parking', 'Late Fee', 'Utility Recharge', 'Miscellaneous'].sort((a, b) => a.localeCompare(b));
    const [localIncomeCategories, setLocalIncomeCategories] = useState<string[]>(defaultIncomeCategories);
    const [newIncomeCategoryName, setNewIncomeCategoryName] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirm');
    const [confirmDanger, setConfirmDanger] = useState(false);
    const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

    const prevTypeRef = useRef(type);
    const prevPathRef = useRef(location.pathname);
    // When a prefill with keepAmount=true is used (e.g. "Collect Fees" from contract detail),
    // the smart contract amount auto-fill should not overwrite the prefilled amount.
    const keepPrefillAmountRef = useRef(false);
    /** Resolved when a renewal contract has prior lease balance — used for details / date line outside checkContract. */
    const priorOldContractMetaRef = useRef<{ period: string; contractNo: string }>({ period: '', contractNo: '' });

    const resetForm = useCallback(() => {
        setId(null);
        setDate(new Date().toISOString().split('T')[0]);
        setBuildingId('');
        setUnitNumber('');
        setAmount('');
        setDetails('');
        setExtraAmount('0');
        setDiscountAmount('0');
        setVatInvoiceNumber('');
        setIsVATApplicable(false);
        setPaymentMethod(PaymentMethod.BANK);
        setBankName('');
        setChequeNo('');
        setChequeDueDate('');
        setActiveContract(undefined);
        setSmartInstallmentMsg('');
        setTargetEmployeeId('');
        setTargetOwnerId('');
        setTargetVendorId('');
        setSelectedServiceAgreementId('');
        setExpenseCategory('');
        setBonus('0');
        setDeduction('0');
        setBorrowDeduction('0');
        setBorrowingType('BORROW');
        setIncomeSubType('RENTAL');
        setOtherIncomeCategory('');
        setCarryForwardMsg('');
        setLeaseInstallmentInfo(null);
        setLeaseEnteredDiff(null);
        setSuccessMsg('');
        setOverpaymentWarning('');
        setOriginalCreatedAt(undefined);
        setOriginalCreatedBy(undefined);
        setLastModifiedAt(undefined);
    }, []);

    // Auto-clear form when switching between Income / Expense
    useEffect(() => {
        if (prevTypeRef.current !== type && !id) {
            resetForm();
            // Restore the newly selected type (resetForm doesn't touch type)
        }
        prevTypeRef.current = type;
    }, [type, id, resetForm]);

    // Auto-clear form when navigating away and back (route change)
    useEffect(() => {
        if (prevPathRef.current !== location.pathname && !id) {
            resetForm();
            setType(TransactionType.INCOME);
        }
        prevPathRef.current = location.pathname;
    }, [location.pathname, id, resetForm]);

    const getPeriodFromDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getPrevMonthPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getNextMonthPeriod = (period: string) => {
        if (!period) return '';
        const [y, m] = period.split('-').map(n => parseInt(n, 10));
        if (!y || !m) return '';
        const d = new Date(y, m - 1, 1);
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const formatSalaryPeriod = (period: string) => {
        if (!period) return '';
        const [y, m] = period.split('-').map(n => parseInt(n, 10));
        if (!y || !m) return '';
        const d = new Date(y, m - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const salaryCoveredAmount = (tx: Transaction): number => {
        const paidNet = Number(tx.amount || 0);
        const deductions = Number((tx as any).deductionAmount || 0) + Number((tx as any).borrowDeductionAmount || 0);
        const bonusPaid = Number((tx as any).bonusAmount || 0);
        return Math.max(0, paidNet + deductions - bonusPaid);
    };

    const getContractInstallmentRange = (contract: Contract, installmentNo: number) =>
        getInstallmentRange({
            fromDate: (contract as any).fromDate,
            toDate: (contract as any).toDate,
            periodMonths: Number((contract as any).periodMonths) || 0,
            periodDays: Number((contract as any).periodDays) || 0,
            installmentCount: Number((contract as any).installmentCount) || 1,
        }, installmentNo);

    const currentPeriod = useMemo(() => getPeriodFromDate(date), [date]);
    const prevPeriod = useMemo(() => getPrevMonthPeriod(date), [date]);
    const lastPaidSalaryPeriod = useMemo(() => {
        if (!targetEmployeeId) return '';
        const salaryTxs = allTransactions.filter(t => t.type === TransactionType.EXPENSE && (t.expenseCategory === ExpenseCategory.SALARY || t.expenseCategory === 'Salary') && (t as any).employeeId === targetEmployeeId && t.status !== TransactionStatus.REJECTED);
        const periods = salaryTxs.map(tx => (tx as any).salaryPeriod || getPeriodFromDate(tx.date || '')).filter(Boolean) as string[];
        if (periods.length === 0) return '';
        return periods.sort().slice(-1)[0];
    }, [allTransactions, targetEmployeeId]);

    // Check if the last paid period was fully paid (total paid >= base salary)
    const isLastPeriodFullyPaid = useMemo(() => {
        if (!targetEmployeeId || !lastPaidSalaryPeriod) return true;
        const emp = employees.find(e => e.id === targetEmployeeId);
        const fullSalary = emp?.baseSalary || 0;
        if (!fullSalary) return true;
        const paidForLastPeriod = allTransactions
            .filter(t => {
                if (t.type !== TransactionType.EXPENSE) return false;
                if (t.expenseCategory !== ExpenseCategory.SALARY && t.expenseCategory !== 'Salary') return false;
                if ((t as any).employeeId !== targetEmployeeId) return false;
                if (t.status === TransactionStatus.REJECTED) return false;
                const txPeriod = (t as any).salaryPeriod || getPeriodFromDate(t.date || '');
                return txPeriod === lastPaidSalaryPeriod;
            })
            .reduce((sum, t) => sum + salaryCoveredAmount(t), 0);
        return paidForLastPeriod >= fullSalary;
    }, [allTransactions, targetEmployeeId, lastPaidSalaryPeriod, employees]);

    const autoSalaryPeriod = useMemo(() => {
        if (!targetEmployeeId) return prevPeriod;
        if (!lastPaidSalaryPeriod) return prevPeriod;
        // If last period still has a remaining balance, stay on it
        if (!isLastPeriodFullyPaid) return lastPaidSalaryPeriod;
        if (lastPaidSalaryPeriod === currentPeriod) {
            const day = new Date(date).getDate();
            return day >= 25 ? getNextMonthPeriod(lastPaidSalaryPeriod) : lastPaidSalaryPeriod;
        }
        return getNextMonthPeriod(lastPaidSalaryPeriod);
    }, [targetEmployeeId, lastPaidSalaryPeriod, isLastPeriodFullyPaid, currentPeriod, prevPeriod, date]);

    const [salaryPeriodInput, setSalaryPeriodInput] = useState('');
    const [salaryPeriodManual, setSalaryPeriodManual] = useState(false);

    useEffect(() => {
        if (!salaryPeriodManual) {
            setSalaryPeriodInput(autoSalaryPeriod);
        }
    }, [autoSalaryPeriod, salaryPeriodManual]);

    useEffect(() => {
        setSalaryPeriodManual(false);
    }, [targetEmployeeId]);

    const selectedSalaryPeriod = salaryPeriodManual && salaryPeriodInput ? salaryPeriodInput : autoSalaryPeriod;
    const salaryPeriodLabel = useMemo(() => formatSalaryPeriod(selectedSalaryPeriod), [selectedSalaryPeriod]);

    // ── Salary balance tracking: calculate already-paid amount for this employee + period ──
    const salaryPaidForPeriod = useMemo(() => {
        if (!targetEmployeeId || !selectedSalaryPeriod) return 0;
        return allTransactions
            .filter(t => {
                if (id && t.id === id) return false; // exclude current tx when editing
                if (t.type !== TransactionType.EXPENSE) return false;
                if (t.expenseCategory !== ExpenseCategory.SALARY && t.expenseCategory !== 'Salary') return false;
                if ((t as any).employeeId !== targetEmployeeId) return false;
                if (t.status === TransactionStatus.REJECTED) return false;
                const txPeriod = (t as any).salaryPeriod || getPeriodFromDate(t.date || '');
                return txPeriod === selectedSalaryPeriod;
            })
            .reduce((sum, t) => sum + salaryCoveredAmount(t), 0);
    }, [allTransactions, targetEmployeeId, selectedSalaryPeriod, id]);

    const salaryFullAmount = useMemo(() => {
        const emp = employees.find(e => e.id === targetEmployeeId);
        return emp?.baseSalary || 0;
    }, [employees, targetEmployeeId]);

    const salaryBalance = useMemo(() => {
        if (!salaryFullAmount) return 0;
        return Math.max(0, salaryFullAmount - salaryPaidForPeriod);
    }, [salaryFullAmount, salaryPaidForPeriod]);

    const isSalaryFullyPaid = salaryPaidForPeriod > 0 && salaryBalance <= 0;

    const nonResFeePeriodCtx = useMemo(() => {
        if (!activeContract || !isNonResidentialBuildingForContract(buildings, activeContract as any)) return null;
        return getNonResFeePeriodContext(activeContract as any, contractPayments);
    }, [activeContract, buildings, contractPayments]);

    // Auto-adjust amount when salary period or employee changes (if salary category)
    useEffect(() => {
        if (type !== TransactionType.EXPENSE || expenseCategory !== ExpenseCategory.SALARY) return;
        if (!targetEmployeeId || !selectedSalaryPeriod) return;
        if (id) return; // don't override when editing
        if (isSalaryFullyPaid) {
            setAmount('0');
        } else if (salaryPaidForPeriod > 0) {
            setAmount(salaryBalance.toFixed(0));
        } else {
            setAmount(salaryFullAmount.toString());
        }
    }, [targetEmployeeId, selectedSalaryPeriod, salaryPaidForPeriod, salaryBalance, salaryFullAmount, isSalaryFullyPaid]);

    const persistCategories = (list: string[]) => {
        try {
            localStorage.setItem(categoryStorageKey, JSON.stringify(list));
        } catch (_) {
            // ignore storage errors
        }
        // Also persist to cloud for all users
        const defaults = Object.values(ExpenseCategory);
        const customOnly = list.filter(c => !defaults.includes(c as ExpenseCategory));
        saveCustomExpenseCategories(customOnly).catch(() => {});
    };

    const persistIncomeCategories = (list: string[]) => {
        try {
            localStorage.setItem('customIncomeCategories', JSON.stringify(list));
        } catch (_) {}
        const customOnly = list.filter(c => !defaultIncomeCategories.includes(c));
        saveCustomIncomeCategories(customOnly).catch(() => {});
    };

    const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
        setConfirmTitle(opts?.title || 'Confirm');
        setConfirmDanger(!!opts?.danger);
        setConfirmMessage(message);
        setConfirmAction(() => onConfirm);
        setConfirmOpen(true);
    };
    const closeConfirm = () => {
        setConfirmOpen(false);
        setConfirmMessage('');
        setConfirmAction(null);
    };

    const canManageCategories =
        currentUser.role === UserRole.ADMIN ||
        String(currentUser.role) === 'ADMIN';
    const canDeleteExpenseCategory = !!expenseCategory;
    const canDeleteIncomeCategory = !!otherIncomeCategory;
    const isOwnerExpenseCategory = expenseCategory === ExpenseCategory.OWNER_EXPENSE || expenseCategory === 'Owner Profit Withdrawal';

    const deleteSelectedExpenseCategory = () => {
        if (!canDeleteExpenseCategory) return;
        const toDelete = expenseCategory;
        const next = localCategories.filter(x => x !== toDelete);
        if (next.length === 0) {
            showWarning('At least one expense category is required.');
            return;
        }
        setLocalCategories(next);
        persistCategories(next);
        setExpenseCategory(next[0] || Object.values(ExpenseCategory)[0] || '');
    };

    const deleteSelectedIncomeCategory = () => {
        if (!canDeleteIncomeCategory) return;
        const toDelete = otherIncomeCategory;
        const next = localIncomeCategories.filter(x => x !== toDelete);
        if (next.length === 0) {
            showWarning('At least one income category is required.');
            return;
        }
        setLocalIncomeCategories(next);
        persistIncomeCategories(next);
        setOtherIncomeCategory(next[0] || '');
    };

    useEffect(() => {
        const load = async () => {
            const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
            const [blds, usrs, vnds, bks, txs, custs, cloudCats, cloudIncomeCats, svcAgreements] = await Promise.all([getBuildings(), getUsersAcrossBooks(), getVendors(), getBanks(), getTransactions({ userId: currentUser.id, role: currentUser.role, buildingIds: userBuildingIds }), getCustomers(), getCustomExpenseCategories(), getCustomIncomeCategories(), getServiceAgreements()]);
            // Restrict buildings for non-admins/managers to assigned buildings (supports multiple)
            if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER' && userBuildingIds.length > 0) {
                setBuildings((blds || []).filter((b: any) => userBuildingIds.includes(b.id)));
            } else {
                setBuildings(blds);
            }
            // NOTE: staff/users can live in other books; load across books for salary + owner pickers.
            // Staff roles vary in old data (EMPLOYEE/ENGINEER/STAFF) and sometimes only baseSalary is set.
            const roleKey = (r: any) => String(r || '').trim().toUpperCase();
            const staffRoles = new Set(['EMPLOYEE', 'ENGINEER', 'STAFF']);
            setEmployees(
                (usrs || [])
                    .filter((u: any) => {
                        const rk = roleKey(u.role);
                        if (rk === 'ADMIN' || rk === 'OWNER') return false;
                        if (staffRoles.has(rk)) return true;
                        const sal = Number((u as any).baseSalary);
                        return Number.isFinite(sal) && sal > 0;
                    })
                    .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
            );
            setOwners((usrs || []).filter((u: any) => roleKey(u.role) === roleKey(UserRole.OWNER) || u.isOwner));
            setVendors(vnds || []);
            setBanks(bks || []);
            setCustomers(custs || []);
            setAllTransactions(txs || []);
            setServiceAgreements(svcAgreements || []);
            // Merge cloud categories with local ones
            if (cloudCats && cloudCats.length > 0) {
                setLocalCategories(prev => {
                    const merged = Array.from(new Set([...cloudCats, ...prev]));
                    try { localStorage.setItem(categoryStorageKey, JSON.stringify(merged)); } catch(_){}
                    return merged;
                });
            }
            // Merge cloud income categories
            if (cloudIncomeCats && cloudIncomeCats.length > 0) {
                setLocalIncomeCategories(prev => {
                    const merged = Array.from(new Set([...prev, ...cloudIncomeCats]));
                    try { localStorage.setItem('customIncomeCategories', JSON.stringify(merged)); } catch(_){}
                    return merged;
                });
            }
            // Compute Head Office balance for insufficient funds warning
            try {
                const transfers = await getTransfers({});
                const activeTransfers = (transfers || []).filter((t: any) => !t.deleted && t.status !== 'CANCELLED');
                // Opening balance transfers have both fromType and toType as HEAD_OFFICE — treat as positive credit
                const officeOpeningBalance = activeTransfers.filter((t: any) => t.isOfficeOpeningBalance).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
                const hoIn = activeTransfers.filter((t: any) => t.toType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
                const hoOut = activeTransfers.filter((t: any) => t.fromType === 'HEAD_OFFICE' && !t.isOfficeOpeningBalance).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
                const hoExpenses = (txs || []).filter((t: Transaction) => t.type === TransactionType.EXPENSE && t.buildingId === 'HEAD_OFFICE' && !(t as any).deleted).reduce((s: number, t: Transaction) => s + (Number(t.amount) || 0), 0);
                setHeadOfficeBalance(officeOpeningBalance + hoIn - hoOut - hoExpenses);
            } catch(_) { setHeadOfficeBalance(null); }
        };
        load();
    }, []);

    useEffect(() => {
        if (location.state && location.state.transaction) {
            const transaction = location.state.transaction as Transaction;
            const staffEligible =
                currentUser.role === UserRole.EMPLOYEE &&
                !!transaction.id &&
                !!transaction.date &&
                isDateInCurrentMonth(transaction.date);
            setStaffOpenedCurrentMonthFullEdit(!!staffEligible);
            setId(transaction.id); setType(transaction.type); setDate(transaction.date);
            // --- VAT amount fix: show inclusive total matching History display ---
            if (transaction.isVATApplicable && transaction.type === TransactionType.INCOME) {
                // Show the inclusive total so the form amount matches what the user sees in History.
                const incl = getVatInclusiveEditAmount(transaction);
                setAmount((incl || 0).toFixed(2));
            } else if (transaction.isVATApplicable && transaction.type === TransactionType.EXPENSE) {
                // Expense VAT: edit amount must match the inclusive total shown in History.
                // Strip out extras/discounts to recover the original entered inclusive base.
                const extras = transaction.extraAmount || 0;
                const discounts = transaction.discountAmount || 0;
                const origInclusive = Math.max(0, getVatInclusiveEditAmount(transaction) - extras + discounts);
                setAmount(origInclusive.toFixed(2));
            } else {
                setAmount((transaction.amount || 0).toString());
            }
            setDetails(transaction.details); setPaymentMethod(transaction.paymentMethod);
            setExtraAmount(transaction.extraAmount?.toString() || '0');
            setDiscountAmount(transaction.discountAmount?.toString() || '0');
            setIsVATApplicable(transaction.isVATApplicable || false);
            setVatInvoiceNumber(transaction.vatInvoiceNumber || '');
            if (transaction.bankName) setBankName(transaction.bankName);
            if (transaction.chequeNo) setChequeNo(transaction.chequeNo);
            if (transaction.chequeDueDate) setChequeDueDate(transaction.chequeDueDate);
            // Preserve original author info on edit
            if (transaction.createdAt) setOriginalCreatedAt(transaction.createdAt);
            if (transaction.createdBy) setOriginalCreatedBy(transaction.createdBy);
            // Restore borrowing-specific fields
            if (transaction.borrowingType) setBorrowingType(transaction.borrowingType as 'BORROW' | 'REPAYMENT');
            if ((transaction as any).isExternalBorrower) {
                setIsExternalBorrower(true);
                setExternalBorrowerName(transaction.employeeName || '');
            } else if (transaction.employeeId) {
                setTargetEmployeeId(transaction.employeeId);
            }
            if (transaction.type === TransactionType.INCOME) {
                // Repayment borrowing transactions are stored as INCOME
                if (transaction.borrowingType) {
                    setType(TransactionType.EXPENSE);
                    setExpenseCategory(ExpenseCategory.BORROWING);
                    setBorrowingType(transaction.borrowingType as 'BORROW' | 'REPAYMENT');
                } else {
                    if (transaction.incomeSubType) setIncomeSubType(transaction.incomeSubType);
                    if (transaction.expenseCategory && transaction.incomeSubType === 'OTHER') setOtherIncomeCategory(transaction.expenseCategory);
                }
                if (transaction.buildingId) setBuildingId(transaction.buildingId);
                if (transaction.unitNumber) setUnitNumber(transaction.unitNumber);
            } else {
                if (transaction.buildingId) setBuildingId(transaction.buildingId);
                if (transaction.expenseCategory) setExpenseCategory(transaction.expenseCategory);
                if (transaction.expenseCategory === ExpenseCategory.SALARY || transaction.expenseCategory === 'Salary') {
                    setBonus(String((transaction as any).bonusAmount || 0));
                    setDeduction(String((transaction as any).deductionAmount || 0));
                    setBorrowDeduction(String((transaction as any).borrowDeductionAmount || 0));
                    const txPeriod = (transaction as any).salaryPeriod || getPeriodFromDate(transaction.date || '');
                    if (txPeriod) {
                        setSalaryPeriodInput(txPeriod);
                        setSalaryPeriodManual(true);
                    }
                }
            }
            window.history.replaceState({}, document.title);
        } else {
            setStaffOpenedCurrentMonthFullEdit(false);
        }
    }, [location, currentUser.role]);

    useEffect(() => {
            const prefill = (location.state as any)?.prefill;
            if (prefill && !id) {
                    setType(prefill.type || TransactionType.INCOME);
                    setDate(prefill.date || new Date().toISOString().split('T')[0]);
                    setBuildingId(prefill.buildingId || '');
                    setUnitNumber(prefill.unitNumber || '');
                    setAmount(prefill.amount ? String(prefill.amount) : '');
                    setPaymentMethod(prefill.paymentMethod || PaymentMethod.BANK);
                    setBankName(prefill.bankName || '');
                    setDetails(prefill.details || '');
                    setExpenseCategory(prefill.expenseCategory || '');
                    setIsVATApplicable(false);
                    setVatInvoiceNumber('');
                    // Prevent the smart contract amount from overwriting the prefilled amount
                    if (prefill.keepAmount) keepPrefillAmountRef.current = true;
                    window.history.replaceState({}, document.title);
            }
    }, [location, id]);

  // Handle prefill from BorrowingTracker navigation or props
  useEffect(() => {
      const prefillCategory = propPrefillCategory || (location.state as any)?.prefillCategory;
      const prefillEmployee = (location.state as any)?.prefillEmployee;
      if (prefillCategory && !id) {
          setType(TransactionType.EXPENSE);
          setExpenseCategory(prefillCategory);
          if (prefillCategory === 'Borrowing' || prefillCategory === ExpenseCategory.BORROWING) {
              setBorrowingType('BORROW');
          }
          if (prefillEmployee) setTargetEmployeeId(prefillEmployee);
          if (!propPrefillCategory) window.history.replaceState({}, document.title);
      }
  }, [location, id, propPrefillCategory]);

  useEffect(() => {
      const vendorId = (location.state as any)?.vendorId;
      if (vendorId && !id) {
          setType(TransactionType.EXPENSE);
          setExpenseCategory(ExpenseCategory.VENDOR_PAYMENT);
          setTargetVendorId(vendorId);
          window.history.replaceState({}, document.title);
      }
  }, [location, id]);

  // Handle prefill from Voice Assistant
  useEffect(() => {
      const voice = (location.state as any)?.voiceExpense;
      if (voice && !id) {
          setType(TransactionType.EXPENSE);
          if (voice.amount) setAmount(String(voice.amount));
          if (voice.category) setExpenseCategory(voice.category);
          if (voice.description) setDetails(voice.description);
          setPaymentMethod(PaymentMethod.CASH);
          setDate(voice.date || new Date().toISOString().split('T')[0]);
          window.history.replaceState({}, document.title);
      }
  }, [location, id]);

  useEffect(() => {
      if (expenseCategory && !localCategories.includes(expenseCategory)) {
          const merged = Array.from(new Set([expenseCategory, ...localCategories]));
          setLocalCategories(merged);
          persistCategories(merged);
      }
  }, [expenseCategory, localCategories]);

    // When building selection changes, default to the building's bank details if present.
    // Do not override a bank the user already picked.
    useEffect(() => {
        if (buildingId && !id) {
            const b = buildings.find(bb => bb.id === buildingId);
            if (b && b.bankName && !bankName) {
                setBankName(b.bankName);
                setPaymentMethod(PaymentMethod.BANK);
            } else if (!b?.bankName && !bankName) {
                setBankName('');
            }
            // VAT is handled separately in the VAT Report tab — never auto-enable it here
            if (b) {
                setIsVATApplicable(false);
            }
        }
    }, [buildingId, buildings, bankName, id]);

  // --- AUTOMATION: SMART CONTRACT LINKING & PARTIAL PAYMENTS ---
    useEffect(() => {
        const checkContract = async () => {
            if (!id && type === TransactionType.INCOME && buildingId && unitNumber) {
                const catalogAll = (await getContracts({ includeDeleted: true })) || [];
                const catalog = catalogAll.filter((c: any) => !c.deleted);
                // Try active contract first; fall back to any contract for this unit
                let contract = await getActiveContract(buildingId, unitNumber);
                if (!contract) {
                    const unitContracts = catalog.filter((c: any) => c.buildingId === buildingId && c.unitName === unitNumber);
                    unitContracts.sort((a: any, b: any) => (a.status === 'Active' ? -1 : b.status === 'Active' ? 1 : 0));
                    contract = unitContracts[0] || null;
                }
                setActiveContract(contract as any);
        setOverpaymentWarning('');
        setSmartInstallmentMsg('');
        setAutoCustomerName(contract ? formatCustomerFromMap(contract.customerName, contract.customerId, buildCustomerRoomMap(customers)) : '');
        
                                 if (contract) {
                                 const prevPayments = allTransactions.filter(t => {
                                     if (t.status !== TransactionStatus.APPROVED && t.status) return false;
                                     if (t.type === TransactionType.EXPENSE) return false;
                                     return transactionAppliesToContract(t, contract as any, catalog);
                                 });
                                 const upfrontPaid = Number((contract as any).upfrontPaid || 0);
                                 const totalValueStored = Number(contract.totalValue || 0);
                                 const totalInst = contract.installmentCount || 1;
                                 const priorO = Math.max(0, Number((contract as any).priorLeaseOutstandingAtRenewal) || 0);
                                 priorOldContractMetaRef.current = { period: '', contractNo: '' };
                                 if (priorO > 0) {
                                     const rid = (contract as any).renewedFromId;
                                     let priorContractRow: any = rid ? catalogAll.find((x: any) => x.id === rid) : undefined;
                                     const priorNoStored = String((contract as any).priorLeaseContractNoAtRenewal || '').trim();
                                     if (!priorContractRow && priorNoStored) {
                                         priorContractRow = catalogAll.find(
                                             (x: any) =>
                                                 String(x.contractNo || '').trim() === priorNoStored &&
                                                 x.buildingId === contract.buildingId,
                                         );
                                     }
                                     const contractNo =
                                         priorNoStored ||
                                         (priorContractRow?.contractNo != null ? String(priorContractRow.contractNo).trim() : '') ||
                                         '';
                                     let period = '';
                                     const renewalYmd = contractDateToYmd((contract as any).fromDate);
                                     if (priorContractRow && renewalYmd) {
                                         const catalogForPriorPaid = catalogAll.map((x: any) =>
                                             priorContractRow && x.id === priorContractRow.id ? { ...x, deleted: false } : x,
                                         );
                                         const carriedWin = getCarriedPriorInstallmentWindow({
                                             priorContract: priorContractRow,
                                             renewalYmd,
                                             buildings,
                                             catalog: catalogForPriorPaid,
                                             transactions: allTransactions,
                                         });
                                         if (carriedWin) {
                                             period = `Inst. ${carriedWin.installmentNo}/${carriedWin.totalInstallments} · ${fmtDate(
                                                 carriedWin.startDate,
                                             )} ${t('entry.dateRangeMid')} ${fmtDate(carriedWin.endDate)}`;
                                         } else if (priorContractRow?.fromDate && priorContractRow?.toDate) {
                                             period = `${fmtDate(priorContractRow.fromDate)} ${t('entry.dateRangeMid')} ${fmtDate(
                                                 priorContractRow.toDate,
                                             )}`;
                                         }
                                     } else if (priorContractRow?.fromDate && priorContractRow?.toDate) {
                                         period = `${fmtDate(priorContractRow.fromDate)} ${t('entry.dateRangeMid')} ${fmtDate(
                                             priorContractRow.toDate,
                                         )}`;
                                     }
                                     priorOldContractMetaRef.current = { period, contractNo };
                                 }

                                 // --- INSTALLMENT DETECTION: use EXCLUSIVE amounts (consistent with contract values) ---
                                 // Non-residential: fees may be logged as separate feesEntry rows — exclude from rent installment schedule only then.
                                 const nonResContract = isNonResidentialBuildingForContract(buildings, contract as any);
                                 const rentPayments = nonResContract
                                   ? prevPayments.filter(t => !(t as any).feesEntry)
                                   : prevPayments;
                                 const totalPaidExcl = rentPayments.reduce((sum, t) => sum + (Number(t.amount) || 0) + ((t as any).discountAmount || 0), 0);
                                 const totalPaidEffective = totalPaidExcl + upfrontPaid;
                                 const otherInstAmtExcl = Number(contract.otherInstallment || 0);
                                 let firstInstAmtExcl = Number(contract.firstInstallment || 0) + upfrontPaid;
                                 const effectiveTotalExcl = totalValueStored + upfrontPaid;

                                 // --- DISPLAY: use inclusive so user sees actual money collected ---
                                 const isVATBuilding = (() => {
                                     const b = buildings.find(bb => bb.id === buildingId);
                                     return b?.propertyType === 'NON_RESIDENTIAL' || b?.vatApplicable === true;
                                 })();
                                 const rentValue = Number((contract as any).rentValue || 0);
                                 const vatOnRent = isVATBuilding ? rentValue * 0.15 : 0;
                                 const vatOnOneTime = isVATBuilding ? Math.max(0, firstInstAmtExcl - otherInstAmtExcl) * 0.15 : 0;
                                 const totalPaidIncl = rentPayments.reduce((sum, t) => sum + (Number((t as any).amountIncludingVAT || (t as any).totalWithVat || t.amount) || 0) + ((t as any).discountAmount || 0), 0);
                                 const totalPaidDisplayEffective = totalPaidIncl + upfrontPaid;
                                 const effectiveTotalIncl = totalValueStored + upfrontPaid + vatOnRent + vatOnOneTime;
                                 const totalDueAllIncl = effectiveTotalIncl + priorO;
                                 const remaining = Math.max(0, totalDueAllIncl - totalPaidDisplayEffective);

                                 setContractPayments(prevPayments);

                                 // Use exclusive installment amounts for loop
                                 let firstInstAmt = firstInstAmtExcl;
                                 const otherInstAmt = otherInstAmtExcl;
                                 const effectiveTotal = effectiveTotalExcl;

                         // --- SMART INSTALLMENT CALCULATION ---
                         const sumInstallments = firstInstAmt + (otherInstAmt * Math.max(0, totalInst - 1));
                         if (effectiveTotal > 0 && Math.abs(sumInstallments - effectiveTotal) > Math.max(5, totalInst)) {
                             firstInstAmt = Math.max(0, effectiveTotal - (otherInstAmt * Math.max(0, totalInst - 1)));
                         }

                         if (totalPaidDisplayEffective >= totalDueAllIncl) {
               setOverpaymentWarning('Contract Fully Paid! Cannot add more Income.');
               setAmount('0');
               return;
             }

             let schedulePaidExcl = totalPaidEffective;
             let currentInstallment = 1;
             let recommendedAmount = 0;
             let isPartial = false;

             // FIFO: payments apply to prior-lease balance (renewal) before new lease installments
             if (priorO > 0 && totalPaidDisplayEffective < priorO) {
               currentInstallment = 0;
               schedulePaidExcl = 0;
               recommendedAmount = Math.round((priorO - totalPaidDisplayEffective) * 100) / 100;
               isPartial = totalPaidDisplayEffective > 0;
               setCurrentInstallmentRemaining(Math.max(0, recommendedAmount));
               setContractStats({
                 paid: totalPaidDisplayEffective,
                 remaining,
                 installmentNo: 0,
                 priorOutstanding: priorO,
                 paidExclSchedule: 0,
               });
               if (keepPrefillAmountRef.current) {
                 keepPrefillAmountRef.current = false;
               } else {
                 setAmount(recommendedAmount > 0 ? recommendedAmount.toFixed(0) : '0');
                 setSmartInstallmentMsg(
                   isPartial ? t('entry.priorLeaseBalancePartial') : t('entry.priorLeaseBalanceDue'),
                 );
                 setInstallmentDateRange(
                   priorOldContractMetaRef.current.period
                     ? `${t('entry.priorLeasePeriod')}: ${priorOldContractMetaRef.current.period}`
                     : t('entry.priorLeasePeriod'),
                 );
                 if (!details) {
                   const contractCustLabel = formatCustomerFromMap(contract.customerName, contract.customerId, buildCustomerRoomMap(customers));
                   const { period: pPer, contractNo: pNo } = priorOldContractMetaRef.current;
                   if (pPer) {
                     setDetails(
                       t('entry.priorOldContractDetailsWithPeriod', {
                         contractNo: pNo || '—',
                         period: pPer,
                         customer: contractCustLabel,
                       }),
                     );
                   } else {
                     setDetails(
                       t('entry.priorOldContractDetailsNoPeriod', {
                         contractNo: pNo || '—',
                         customer: contractCustLabel,
                       }),
                     );
                   }
                 }
               }
             } else {
               // After prior is cleared, only the remainder applies to the new lease schedule.
               // priorO is stored in the same inclusive basis as contract list balance; map to exclusive for the schedule loop when VAT applies.
               const paidAfterPriorIncl = Math.max(0, totalPaidDisplayEffective - priorO);
               if (priorO > 0) {
                 schedulePaidExcl =
                   isVATBuilding && effectiveTotalIncl > 0
                     ? (paidAfterPriorIncl * effectiveTotalExcl) / effectiveTotalIncl
                     : paidAfterPriorIncl;
               }

             // Build cumulative amounts for each installment (schedule only, after prior cleared)
             let cumulative = 0;
             for (let i = 1; i <= totalInst; i++) {
               const instAmount = i === 1 ? firstInstAmt : otherInstAmt;
               cumulative += instAmount;
               
                             if (schedulePaidExcl < cumulative) {
                 // This is the first unpaid installment
                 currentInstallment = i;
                 const prevCumulative = i === 1 ? 0 : (firstInstAmt + (i - 2) * otherInstAmt);
                 const amountDueForThisInst = instAmount;
                                 const amountPaidTowardsThis = Math.max(0, schedulePaidExcl - prevCumulative);
                 recommendedAmount = amountDueForThisInst - amountPaidTowardsThis;
                 
                 if (amountPaidTowardsThis > 0) {
                   isPartial = true;
                   setCurrentInstallmentRemaining(recommendedAmount);
                 } else {
                   setCurrentInstallmentRemaining(instAmount);
                 }
                 break;
               }
             }
             
             // Check if fully paid on schedule (exclusive) — whole obligation already handled above
                         if (schedulePaidExcl >= Math.min(cumulative, effectiveTotal)) {
               setOverpaymentWarning('Contract Fully Paid! Cannot add more Income.');
               setAmount('0');
               return;
             }

                         setContractStats({
               paid: totalPaidDisplayEffective,
               remaining,
               installmentNo: currentInstallment,
               priorOutstanding: priorO,
               paidExclSchedule: schedulePaidExcl,
             });

             if (keepPrefillAmountRef.current) {
               // Prefill amount is locked (e.g. "Collect Fees" from contract detail) — don't overwrite it
               keepPrefillAmountRef.current = false;
             } else {
               setAmount(recommendedAmount.toFixed(0));
               if (isPartial) setSmartInstallmentMsg(`Due: Remaining Balance of Installment ${currentInstallment}`);
               const { startDate, endDate } = getContractInstallmentRange(contract, Math.max(1, currentInstallment));
               const schedPeriod = `${fmtDate(startDate)} ${t('entry.dateRangeMid')} ${fmtDate(endDate)}`;
               setInstallmentDateRange(schedPeriod);
               if (!details) {
                 const contractCustLabel = formatCustomerFromMap(contract.customerName, contract.customerId, buildCustomerRoomMap(customers));
                 if (isPartial) {
                   setDetails(
                     t('entry.rentInstallmentDetailsPartial', {
                       installment: String(currentInstallment),
                       customer: contractCustLabel,
                       period: schedPeriod,
                     }),
                   );
                 } else if (currentInstallment === 1) {
                   setDetails(
                     t('entry.rentFirstPaymentDetails', { customer: contractCustLabel, period: schedPeriod }),
                   );
                 } else {
                   setDetails(
                     t('entry.rentInstallmentDetails', {
                       installment: String(currentInstallment),
                       total: String(contract.installmentCount),
                       customer: contractCustLabel,
                       period: schedPeriod,
                     }),
                   );
                 }
               }
             }
             }
        }
            }
        };
        checkContract();
    }, [buildingId, unitNumber, type, allTransactions, buildings]); 

    // Update enteredRemaining when amount changes + carry-forward detection
    useEffect(() => {
        const a = parseFloat(amount) || 0;
        if (currentInstallmentRemaining > 0 && activeContract) {
            const diff = Number((currentInstallmentRemaining - a).toFixed(2));
            setEnteredRemaining(Math.max(0, diff));

            // Carry-forward: if customer pays MORE than current installment
            if (a > currentInstallmentRemaining && a <= contractStats.remaining) {
                const extra = Number((a - currentInstallmentRemaining).toFixed(0));
                                const upfrontPaid = Number((activeContract as any).upfrontPaid || 0);
                                const totalValueStored = Number(activeContract.totalValue || 0);
                                const otherInstAmt = Number(activeContract.otherInstallment || 0);
                                // Reconstruct original first installment
                                let firstInstAmt = Number(activeContract.firstInstallment || 0) + upfrontPaid;
                                const totalInst = activeContract.installmentCount || 1;
                                const effectiveTotal = totalValueStored + upfrontPaid;
                                const sumInstallments = firstInstAmt + (otherInstAmt * Math.max(0, totalInst - 1));
                                if (effectiveTotal > 0 && Math.abs(sumInstallments - effectiveTotal) > Math.max(5, totalInst)) {
                                    firstInstAmt = Math.max(0, effectiveTotal - (otherInstAmt * Math.max(0, totalInst - 1)));
                                }
                const currentInst = contractStats.installmentNo;
                const startFutureInst = currentInst === 0 ? 1 : currentInst + 1;

                // Figure out how the extra covers future installments
                let extraLeft = extra;
                let coveredParts: string[] = [];
                let coveredInstNums: number[] = currentInst === 0 ? [] : [currentInst];
                for (let i = startFutureInst; i <= totalInst && extraLeft > 0; i++) {
                    const instAmt = i === 1 ? firstInstAmt : otherInstAmt;
                    if (extraLeft >= instAmt) {
                        coveredParts.push(`Installment ${i} fully covered`);
                        coveredInstNums.push(i);
                        extraLeft -= instAmt;
                    } else {
                        coveredParts.push(`${extraLeft.toLocaleString()} SAR towards Installment ${i}`);
                        extraLeft = 0;
                    }
                }
                setCarryForwardMsg(`Extra ${extra.toLocaleString()} SAR will carry forward: ${coveredParts.join(', ')}`);

                // Auto-update details to reflect multi-installment payment
                const instLabel =
                    coveredInstNums.length > 1
                        ? `Installments ${coveredInstNums.join(' + ')} of ${totalInst}`
                        : coveredInstNums.length === 1
                          ? `Installment ${coveredInstNums[0]} of ${totalInst}`
                          : currentInst === 0
                            ? `${t('entry.priorLeasePaymentLabel')} + schedule`
                            : `Installment ${currentInst} of ${totalInst}`;
                const custLabel = formatCustomerFromMap(activeContract.customerName, activeContract.customerId, buildCustomerRoomMap(customers));
                let periodNote = '';
                if (coveredInstNums.length >= 1) {
                    const { startDate, endDate } = getContractInstallmentRange(activeContract, coveredInstNums[0]);
                    periodNote = ` — ${t('entry.paymentPeriodLabel')} ${fmtDate(startDate)} ${t('entry.dateRangeMid')} ${fmtDate(endDate)}`;
                } else if (currentInst === 0) {
                    const pPer = priorOldContractMetaRef.current.period;
                    if (pPer) periodNote = ` — ${t('entry.paymentPeriodLabel')} ${pPer}`;
                }
                setDetails(`${instLabel} - ${custLabel}${periodNote}`);
            } else {
                setCarryForwardMsg('');
                // Reset details to single installment when amount goes back to normal
                if (a > 0 && a <= currentInstallmentRemaining && activeContract) {
                    const currentInst = contractStats.installmentNo;
                    const totalInst = activeContract.installmentCount || 1;
                    const isPartialNow = a < currentInstallmentRemaining;
                    const acLabel = formatCustomerFromMap(activeContract.customerName, activeContract.customerId, buildCustomerRoomMap(customers));
                    if (currentInst === 0) {
                        const { period: pPer, contractNo: pNo } = priorOldContractMetaRef.current;
                        if (pPer) {
                            setDetails(
                                t('entry.priorOldContractDetailsWithPeriod', {
                                    contractNo: pNo || '—',
                                    period: pPer,
                                    customer: acLabel,
                                }),
                            );
                        } else {
                            setDetails(
                                t('entry.priorOldContractDetailsNoPeriod', {
                                    contractNo: pNo || '—',
                                    customer: acLabel,
                                }),
                            );
                        }
                    } else if (isPartialNow) {
                        const { startDate, endDate } = getContractInstallmentRange(activeContract, Math.max(1, currentInst));
                        const schedPeriod = `${fmtDate(startDate)} ${t('entry.dateRangeMid')} ${fmtDate(endDate)}`;
                        setDetails(
                            t('entry.rentInstallmentDetailsPartial', {
                                installment: String(currentInst),
                                customer: acLabel,
                                period: schedPeriod,
                            }),
                        );
                    } else if (currentInst === 1) {
                        const { startDate, endDate } = getContractInstallmentRange(activeContract, 1);
                        const schedPeriod = `${fmtDate(startDate)} ${t('entry.dateRangeMid')} ${fmtDate(endDate)}`;
                        setDetails(t('entry.rentFirstPaymentDetails', { customer: acLabel, period: schedPeriod }));
                    } else {
                        const { startDate, endDate } = getContractInstallmentRange(activeContract, Math.max(1, currentInst));
                        const schedPeriod = `${fmtDate(startDate)} ${t('entry.dateRangeMid')} ${fmtDate(endDate)}`;
                        setDetails(
                            t('entry.rentInstallmentDetails', {
                                installment: String(currentInst),
                                total: String(totalInst),
                                customer: acLabel,
                                period: schedPeriod,
                            }),
                        );
                    }
                }
            }
        } else {
            setEnteredRemaining(null);
            setCarryForwardMsg('');
        }
    }, [amount, currentInstallmentRemaining, activeContract, contractStats]);

    // Property Rent: Track amount changes to show installment balance
    useEffect(() => {
        const a = parseFloat(amount) || 0;
        if (leaseInstallmentInfo && type === TransactionType.EXPENSE && (expenseCategory === ExpenseCategory.PROPERTY_RENT || expenseCategory === 'Property Rent')) {
            const diff = Number((leaseInstallmentInfo.remainingThisInstallment - a).toFixed(2));
            setLeaseEnteredDiff(diff);
            
            // Update details based on amount
            const bld = buildings.find(b => b.id === buildingId);
            const bldName = bld?.name || '';
            const landlord = bld?.lease?.landlordName ? ` (${bld.lease.landlordName})` : '';
            const instNo = leaseInstallmentInfo.installmentNo;
            const instCount = leaseInstallmentInfo.installmentCount;
            
            if (a < leaseInstallmentInfo.remainingThisInstallment && a > 0) {
                setDetails(`Partial Payment - Installment ${instNo} of ${instCount} - ${bldName}${landlord}`);
            } else if (a === leaseInstallmentInfo.remainingThisInstallment) {
                if (leaseInstallmentInfo.isPartial) {
                    setDetails(`Balance Payment - Installment ${instNo} of ${instCount} - ${bldName}${landlord}`);
                } else {
                    setDetails(`Installment ${instNo} of ${instCount} - ${bldName}${landlord}`);
                }
            } else if (a > leaseInstallmentInfo.remainingThisInstallment) {
                setDetails(`Installment ${instNo}+ of ${instCount} - ${bldName}${landlord}`);
            }
        } else {
            setLeaseEnteredDiff(null);
        }
    }, [amount, leaseInstallmentInfo, type, expenseCategory]);

    /** Output VAT on rent/income in this form only applies to non-residential or buildings flagged vatApplicable. */
    const entryBuilding = useMemo(
        () => (buildingId ? buildings.find((b) => b.id === buildingId) : undefined),
        [buildings, buildingId],
    );
    const buildingChargesOutputVatOnRent = !!(
        entryBuilding &&
        (entryBuilding.propertyType === 'NON_RESIDENTIAL' || entryBuilding.vatApplicable === true)
    );
    const vatApplicableEffective = useMemo(() => {
        if (!isVATApplicable) return false;
        if (
            type === TransactionType.INCOME &&
            buildingId &&
            entryBuilding &&
            !buildingChargesOutputVatOnRent
        ) {
            return false;
        }
        return true;
    }, [isVATApplicable, type, buildingId, entryBuilding, buildingChargesOutputVatOnRent]);

    // Clear a mistaken VAT flag on income for residential buildings (legacy rows) so the form state matches save rules.
    useEffect(() => {
        if (isVATApplicable && !vatApplicableEffective) {
            setIsVATApplicable(false);
        }
    }, [isVATApplicable, vatApplicableEffective]);

    // VAT breakdown when VAT is toggled for expenses (amount entered is VAT-inclusive)
    useEffect(() => {
        const a = parseFloat(amount) || 0;
        if (type === TransactionType.EXPENSE && isVATApplicable && a > 0) {
            const inclusive = a;
            const exclusive = Number((inclusive / 1.15).toFixed(2));
            const vat = Number((inclusive - exclusive).toFixed(2));
            setVendorVatInfo({ inclusive, vat, exclusive });
        } else {
            setVendorVatInfo(null);
        }
    }, [amount, isVATApplicable, type]);

    // VAT breakdown when VAT is toggled for income (amount entered is VAT-exclusive, VAT added on top)
    useEffect(() => {
        const a = parseFloat(amount) || 0;
        if (type === TransactionType.INCOME && vatApplicableEffective && a > 0) {
            let exclusive: number;
            let vat: number;
            let inclusive: number;
            if (id) {
                // Edit mode: amount field shows inclusive total
                inclusive = a;
                exclusive = Number((inclusive / 1.15).toFixed(2));
                vat = Number((inclusive - exclusive).toFixed(2));
            } else {
                // New entry: amount field is exclusive, VAT added on top
                exclusive = a;
                vat = Number((exclusive * 0.15).toFixed(2));
                inclusive = Number((exclusive + vat).toFixed(2));
            }
            setIncomeVatInfo({ inclusive, vat, exclusive });
        } else {
            setIncomeVatInfo(null);
        }
    }, [amount, vatApplicableEffective, type, id]);

  const handleAddBank = async () => {
      if(newBankName && newBankIban) {
          await saveBank({ name: newBankName, iban: newBankIban });
          setBanks(await getBanks()); setBankName(newBankName); setNewBankName(''); setNewBankIban(''); setShowAddBank(false);
      }
  };

  const handleEmployeeSelect = (empId: string) => {
      setTargetEmployeeId(empId);
      const emp = employees.find(e => e.id === empId);
      if (emp) {
          // Amount will be auto-set by the salary balance useEffect
          if(emp.buildingId) {
              setBuildingId(emp.buildingId); // Feature: Building-level expense separation
          }
      }
  };

  // Borrowing flow: only set the employee, do not auto-fill amount or building
  const handleBorrowingEmployeeSelect = (empId: string) => {
      setTargetEmployeeId(empId);
      setIsExternalBorrower(false);
      setExternalBorrowerName('');
  };
  const handleOwnerSelect = (ownerId: string) => {
      setTargetOwnerId(ownerId);
  };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        SoundService.play('submit');
        setLoading(true);

    // Required: Amount must be entered
    if (!amount || parseFloat(amount) === 0) {
        showError('Please enter an amount.'); setLoading(false); return;
    }

    // Required: Bank must be selected when payment method is Bank
    if (paymentMethod === PaymentMethod.BANK && !bankName) {
        showError('Please select a bank.'); setLoading(false); return;
    }
    
    // Strict Overpayment Check - only block if exceeds entire contract remaining
    if (activeContract && type === TransactionType.INCOME && incomeSubType === 'RENTAL') {
        const netPayment = parseFloat(amount) + (parseFloat(extraAmount) || 0) - (parseFloat(discountAmount) || 0);
        if (netPayment > contractStats.remaining + 100) { // +100 tolerance
             showWarning(`Net amount (${netPayment.toLocaleString()}) exceeds total contract remaining (${contractStats.remaining.toLocaleString()})`); setLoading(false); return;
        }
    }

    if (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY) {
        if (!targetEmployeeId) {
            showError('Select staff for salary entry.');
            setLoading(false);
            return;
        }
        const day = new Date(date).getDate();
        if (!id && lastPaidSalaryPeriod && lastPaidSalaryPeriod === currentPeriod && day < 25) {
            showError('Salary already paid for this month. You can add the next month after the 25th.');
            setLoading(false);
            return;
        }
        if (!id && selectedSalaryPeriod && isSalaryFullyPaid) {
            showError(`Salary for ${salaryPeriodLabel} is fully paid for this staff.`);
            setLoading(false);
            return;
        }
        if (!id && selectedSalaryPeriod && salaryBalance > 0 && (parseFloat(amount) || 0) > salaryBalance) {
            showError(`Only ${salaryBalance.toLocaleString()} SAR remaining for ${salaryPeriodLabel}. Cannot exceed balance.`);
            setLoading(false);
            return;
        }
    }
    if (type === TransactionType.EXPENSE && isOwnerExpenseCategory && !targetOwnerId) {
        showError('Select owner for owner expense.');
        setLoading(false);
        return;
    }
    if ((expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing') && !isExternalBorrower && !targetEmployeeId) {
        showError('Select a staff member or switch to External Person.');
        setLoading(false);
        return;
    }
    if ((expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing') && isExternalBorrower && !externalBorrowerName.trim()) {
        showError('Enter the external person name.');
        setLoading(false);
        return;
    }
    
    const baseAmount = parseFloat(amount) || 0;
    const ext = parseFloat(extraAmount) || 0;
    const disc = parseFloat(discountAmount) || 0;
    let finalBase = baseAmount;
    let empName = '';
    let ownerName = '';

    // If VAT is applied for expense, amount entered is VAT-inclusive -> convert to exclusive for storage
    // If VAT is applied for income (new entry), amount entered is VAT-exclusive -> VAT is added on top
    // If VAT is applied for income (edit mode), amount entered is VAT-inclusive (matches History display) -> convert to exclusive
    let inclusiveAmount: number | null = null;
    if (id && type === TransactionType.INCOME && isVATApplicable) {
        inclusiveAmount = baseAmount;
        const exclusive = Number((inclusiveAmount / 1.15).toFixed(2));
        finalBase = exclusive;
    } else if (type === TransactionType.EXPENSE && isVATApplicable) {
        inclusiveAmount = baseAmount;
        const exclusive = Number((inclusiveAmount / 1.15).toFixed(2));
        finalBase = exclusive;
    }

    if (type === TransactionType.EXPENSE) {
        if (expenseCategory === ExpenseCategory.SALARY) {
            finalBase = baseAmount + (parseFloat(bonus)||0) - (parseFloat(deduction)||0) - (parseFloat(borrowDeduction)||0);
            empName = employees.find(e => e.id === targetEmployeeId)?.name || '';
        } else if (expenseCategory === ExpenseCategory.BORROWING) {
            empName = isExternalBorrower ? externalBorrowerName : (employees.find(e => e.id === targetEmployeeId)?.name || '');
        } else if (isOwnerExpenseCategory) {
            ownerName = owners.find(o => o.id === targetOwnerId)?.name || '';
        }
    }
    
    // Feature: Approval Workflow
    // All entries are auto-approved unless business rules require otherwise.
    // Approval is not required for standard entries.
    const hasAdjustments = ext > 0 || disc > 0;
    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
    const isStaff = currentUser.role === UserRole.EMPLOYEE;
    const isExpense = type === TransactionType.EXPENSE;
    const status = TransactionStatus.APPROVED;
    
    // Feature: VAT
    // - Expense VAT & income VAT edits: amount field is VAT-inclusive
    // - New income VAT: amount field is VAT-exclusive; VAT added on top
    const netAmount = finalBase + ext - disc;

    let vatVal = 0;
    let amountExclVAT: number | undefined = undefined;
    let amountInclVAT: number | undefined = undefined;

    if (vatApplicableEffective) {
        if (inclusiveAmount !== null) {
            // Expense or income edit: entered amount is VAT-inclusive. VAT is whatever remains after removing exclusive.
            amountExclVAT = Number(netAmount.toFixed(2));
            amountInclVAT = Number((inclusiveAmount + ext - disc).toFixed(2));
            vatVal = Number((amountInclVAT - amountExclVAT).toFixed(2));
        } else {
            // New income entry: VAT is added on top of the (exclusive) net amount.
            amountExclVAT = Number(netAmount.toFixed(2));
            vatVal = Number((amountExclVAT * 0.15).toFixed(2));
            amountInclVAT = Number((amountExclVAT + vatVal).toFixed(2));
        }
    }

    const computedTotalWithVat = vatApplicableEffective
        ? Number((amountInclVAT || 0).toFixed(2))
        : Number(netAmount.toFixed(2));

    const savedAmount = Number(netAmount.toFixed(2));
    // For VAT expenses: save the inclusive total as the main amount so dashboards/history match receipts.
    // For VAT income: also save the inclusive total as the main amount.
    const txAmount =
        vatApplicableEffective
            ? computedTotalWithVat
            : savedAmount;
    
    // Auto-generate invoice number if VAT applicable and not provided
    const autoInvoiceNumber =
      vatApplicableEffective && !vatInvoiceNumber
        ? (type === TransactionType.INCOME
            ? getNextVatInvoiceNumber(
                allTransactions.filter(t => t.type === TransactionType.INCOME && !t.isCreditNote),
                date,
              )
            : getNextVatInvoiceNumber(allTransactions, date))
        : vatInvoiceNumber;

    const newTx: Transaction = {
      id: id || crypto.randomUUID(),
      date,
      // Repayments are income (money coming back), not expense
      type: (type === TransactionType.EXPENSE && (expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing') && borrowingType === 'REPAYMENT') ? TransactionType.INCOME : type,
    amount: txAmount,
    vatAmount: vatVal,
    totalWithVat: vatApplicableEffective ? computedTotalWithVat : undefined,
      paymentMethod,
      bankName: paymentMethod === PaymentMethod.BANK ? bankName : undefined,
      chequeNo: paymentMethod === PaymentMethod.CHEQUE ? chequeNo : undefined,
      chequeDueDate: paymentMethod === PaymentMethod.CHEQUE ? chequeDueDate : undefined,
      buildingId: buildingId || undefined,
      buildingName: buildings.find(b => b.id === buildingId)?.name,
      unitNumber: type === TransactionType.INCOME && incomeSubType === 'RENTAL' ? unitNumber : undefined,
      incomeSubType: type === TransactionType.INCOME ? incomeSubType : undefined,
      expenseCategory: type === TransactionType.EXPENSE ? expenseCategory : (type === TransactionType.INCOME && incomeSubType === 'OTHER' ? otherIncomeCategory || 'Other Income' : (borrowingType === 'REPAYMENT' ? ExpenseCategory.BORROWING : undefined)),
      extraAmount: ext,
      discountAmount: disc,
      employeeId: isExternalBorrower ? ('external_' + externalBorrowerName.trim()) : targetEmployeeId,
      employeeName: empName,
      isExternalBorrower: isExternalBorrower || undefined,
      ownerId: type === TransactionType.EXPENSE && isOwnerExpenseCategory ? targetOwnerId || undefined : undefined,
      ownerName: type === TransactionType.EXPENSE && isOwnerExpenseCategory ? ownerName || undefined : undefined,
      bonusAmount: parseFloat(bonus)||0,
      deductionAmount: parseFloat(deduction)||0,
      borrowDeductionAmount: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY) ? (parseFloat(borrowDeduction)||0) || undefined : undefined,
    salaryPeriod: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY) ? selectedSalaryPeriod : undefined,
      borrowingType: ((type === TransactionType.EXPENSE || type === TransactionType.INCOME) && (expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing')) ? borrowingType : undefined,
      vendorId: targetVendorId || undefined,
      vendorName: vendors.find(v => v.id === targetVendorId)?.nameEn || vendors.find(v => v.id === targetVendorId)?.name || undefined,
      isVATApplicable: vatApplicableEffective,
      vatInvoiceNumber: vatApplicableEffective ? autoInvoiceNumber : undefined,
      amountExcludingVAT: vatApplicableEffective ? amountExclVAT : undefined,
      amountIncludingVAT: vatApplicableEffective ? amountInclVAT : undefined,
      vatRate: vatApplicableEffective ? 15 : undefined,
      vendorVATNumber: (vatApplicableEffective && type === TransactionType.EXPENSE && targetVendorId) ? vendors.find(v => v.id === targetVendorId)?.vatNumber || vendors.find(v => v.id === targetVendorId)?.vatNo : undefined,
      customerVATNumber: (vatApplicableEffective && type === TransactionType.INCOME && activeContract) ? customers.find(c => c.id === activeContract.customerId)?.vatNumber : undefined,
      customerName: type === TransactionType.INCOME && activeContract
        ? formatCustomerFromMap(activeContract.customerName, activeContract.customerId, buildCustomerRoomMap(customers))
        : undefined,
      customerId:
        type === TransactionType.INCOME && incomeSubType === 'RENTAL' && activeContract?.customerId
          ? activeContract.customerId
          : undefined,
            details: details || (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY
                ? `Salary ${salaryPeriodLabel || ''} - ${empName}`.trim()
                : (type === TransactionType.EXPENSE && (expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing') && empName
                    ? `${borrowingType === 'REPAYMENT' ? 'Repayment' : 'Borrowing'} by ${empName}`
                    : (type === TransactionType.EXPENSE && isOwnerExpenseCategory && ownerName
                        ? `Owner expense - ${ownerName}`
                    : (type === TransactionType.EXPENSE && (expenseCategory === ExpenseCategory.PROPERTY_RENT || expenseCategory === 'Property Rent') && buildingId
                        ? `Property Rent - ${buildings.find(b => b.id === buildingId)?.name || ''}`
                        : (type === TransactionType.INCOME && incomeSubType === 'OTHER' && otherIncomeCategory
                            ? `${otherIncomeCategory}${details ? ' - ' + details : ''}`
                            : ''))))),
      createdAt: id && originalCreatedAt ? originalCreatedAt : Date.now(),
      createdBy: id && originalCreatedBy ? originalCreatedBy : currentUser.id,
      createdByName: id && originalCreatedBy ? (allTransactions.find(t=>t.id===id)?.createdByName || currentUser.name) : currentUser.name,
      lastModifiedAt: id ? Date.now() : undefined,
      contractId: incomeSubType === 'RENTAL' ? activeContract?.id : undefined,
      expectedAmount: (incomeSubType === 'RENTAL' && activeContract && currentInstallmentRemaining > 0) ? currentInstallmentRemaining : undefined,
      electricityMeter: incomeSubType === 'RENTAL' ? activeContract?.electricityMeter : undefined,
      status,
      serviceAgreementId: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) ? selectedServiceAgreementId : undefined,
      serviceAgreementStartDate: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) ? serviceAgreements.find(a => a.id === selectedServiceAgreementId)?.startDate : undefined,
      serviceAgreementEndDate: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) ? serviceAgreements.find(a => a.id === selectedServiceAgreementId)?.endDate : undefined,
      serviceAgreementName: (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) ? (() => { const agr = serviceAgreements.find(a => a.id === selectedServiceAgreementId); return agr ? `${agr.name} - ${agr.vendorName}` : undefined; })() : undefined,
      ...(() => {
        if (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) {
          const agr = serviceAgreements.find(a => a.id === selectedServiceAgreementId);
          if (agr) {
            const getInstallmentCount = (freq: string) => {
              switch(freq) { case 'Monthly': return 12; case 'Quarterly': return 4; case 'Half-Yearly': return 2; case 'Yearly': return 1; case 'One-Time': return 1; default: return 1; }
            };
            const getInstallmentMonths = (freq: string) => {
              switch(freq) { case 'Monthly': return 1; case 'Quarterly': return 3; case 'Half-Yearly': return 6; case 'Yearly': return 12; case 'One-Time': return 12; default: return 12; }
            };
            const installmentCount = getInstallmentCount(agr.paymentFrequency);
            const installmentMonths = getInstallmentMonths(agr.paymentFrequency);
            const installmentAmount = Math.round(agr.amount / installmentCount);
            const totalPaid = (agr.payments || []).reduce((sum, p) => sum + p.amount, 0);
            const paidInstallments = Math.floor(totalPaid / installmentAmount);
            const currentInstallmentNo = paidInstallments + 1;
            const contractStart = new Date(agr.startDate);
            const installmentStartDate = new Date(contractStart);
            installmentStartDate.setMonth(contractStart.getMonth() + (currentInstallmentNo - 1) * installmentMonths);
            const installmentEndDate = new Date(installmentStartDate);
            installmentEndDate.setMonth(installmentStartDate.getMonth() + installmentMonths);
            installmentEndDate.setDate(installmentEndDate.getDate() - 1);
            return {
              installmentStartDate: installmentStartDate.toISOString().split('T')[0],
              installmentEndDate: installmentEndDate.toISOString().split('T')[0],
              installmentNumber: currentInstallmentNo
            };
          }
        }
        if (type === TransactionType.INCOME && incomeSubType === 'RENTAL' && activeContract && contractStats.installmentNo > 0) {
          const instNo = contractStats.installmentNo;
          const { startDate, endDate } = getContractInstallmentRange(activeContract, Math.max(1, instNo));
          return {
            installmentNumber: instNo,
            installmentStartDate: contractDateToYmd(startDate),
            installmentEndDate: contractDateToYmd(endDate),
          };
        }
        return {};
      })()
    };

    // Generate ZATCA QR code after transaction object is created
    if (vatApplicableEffective) {
      newTx.zatcaQRCode = generateZATCAQR(newTx, activeContract, customers);
    }

        try {
            // Staff restrictions: staff may only create entries for their assigned buildings
            // (skip for Other Income without building selected)
            const userBuildingIds = (currentUser as any).buildingIds && (currentUser as any).buildingIds.length > 0 ? (currentUser as any).buildingIds : (currentUser.buildingId ? [currentUser.buildingId] : []);
            if (!isAdmin && isStaff && !(type === TransactionType.INCOME && incomeSubType === 'OTHER' && !buildingId)) {
                if (userBuildingIds.length === 0) {
                    showError('Your account is not assigned to a building. Contact admin.'); setLoading(false); return;
                }
                if (!buildingId || !userBuildingIds.includes(buildingId)) {
                    showError('As staff you can only add entries for your assigned buildings.'); setLoading(false); return;
                }
            }

            if (!isAdmin && isStaff && staffOpenedCurrentMonthFullEdit && id && !isDateInCurrentMonth(date)) {
                showError('As staff you can only save edits when the transaction date stays in the current calendar month.');
                setLoading(false);
                return;
            }

            if (saveInFlightRef.current) {
                setLoading(false);
                return;
            }
            saveInFlightRef.current = true;
            try {
            // Editing: save directly for all users
            if (id) {
                await saveTransaction(newTx);
                setSuccessMsg(t('entry.updatedSuccessfully'));
                setTimeout(() => navigate(buildingId === 'HEAD_OFFICE' ? '/transfers' : '/history'), 500);
                setLoading(false);
                return;
            }

            await saveTransaction(newTx);

            // Non-residential: optionally create a separate non-VAT fees entry from the same form.
            // This keeps accounting/reporting consistent while letting users enter fees here.
            if (
              type === TransactionType.INCOME &&
              incomeSubType === 'RENTAL' &&
              activeContract &&
              isNonResidentialBuildingForContract(buildings, activeContract as any)
            ) {
              const feeAmt = parseFloat(nonVatFeesNow || '0') || 0;
              if (feeAmt > 0) {
                const feeTx: any = {
                  id: crypto.randomUUID(),
                  date,
                  type: TransactionType.INCOME,
                  amount: Math.round(feeAmt * 100) / 100,
                  paymentMethod,
                  bankName: paymentMethod === PaymentMethod.BANK ? bankName : undefined,
                  chequeNo: paymentMethod === PaymentMethod.CHEQUE ? chequeNo : undefined,
                  chequeDueDate: paymentMethod === PaymentMethod.CHEQUE ? chequeDueDate : undefined,
                  buildingId: buildingId || undefined,
                  buildingName: buildings.find(b => b.id === buildingId)?.name,
                  unitNumber: unitNumber || undefined,
                  customerName: newTx.customerName,
                  customerId: newTx.customerId,
                  contractId: activeContract?.id,
                  details: `Non-VAT Fees - ${newTx.customerName || ''}${unitNumber ? ` - Unit ${unitNumber}` : ''}${activeContract?.contractNo ? ` - #${activeContract.contractNo}` : ''}`.trim(),
                  createdAt: Date.now(),
                  createdBy: currentUser.id,
                  createdByName: currentUser.name,
                  status,
                  isVATApplicable: false,
                  feesEntry: true,
                };
                await saveTransaction(feeTx);
              }
            }
            
            // Update service agreement payments when category is Service Agreement
            if (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && selectedServiceAgreementId) {
                const agr = serviceAgreements.find(a => a.id === selectedServiceAgreementId);
                if (agr) {
                    const newPayment = { date, amount: savedAmount, notes: details };
                    const updatedPayments = [...(agr.payments || []), newPayment];
                    await saveServiceAgreement({
                        ...agr,
                        payments: updatedPayments,
                        updatedAt: Date.now()
                    });
                }
            }
            
            // Auto-create borrowing repayment when borrowDeduction > 0 from salary
            if (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY && (parseFloat(borrowDeduction) || 0) > 0) {
                const repaymentTx: Transaction = {
                    id: crypto.randomUUID(),
                    date,
                    type: TransactionType.INCOME,
                    amount: parseFloat(borrowDeduction),
                    paymentMethod,
                    bankName: paymentMethod === PaymentMethod.BANK ? bankName : undefined,
                    expenseCategory: ExpenseCategory.BORROWING,
                    borrowingType: 'REPAYMENT',
                    employeeId: targetEmployeeId,
                    employeeName: empName,
                    details: `Auto-repayment from salary ${selectedSalaryPeriod || ''} - ${empName}`.trim(),
                    createdAt: Date.now(),
                    createdBy: currentUser.id,
                    createdByName: currentUser.name,
                    status: TransactionStatus.APPROVED, // Auto-repayments from salary are always approved
                    buildingId: buildingId || undefined,
                    buildingName: buildings.find(b => b.id === buildingId)?.name,
                };
                await saveTransaction(repaymentTx);
            }
            
            // Send email receipt notification for income transactions
            if (type === TransactionType.INCOME && activeContract && status === TransactionStatus.APPROVED) {
              try {
                const customer = customers.find(c => c.id === activeContract.customerId);
                if (customer?.email && customer.emailNotifications) {
                  const { sendPaymentReceipt } = await import('../services/emailService');
                  await sendPaymentReceipt(
                    customer.email,
                    formatNameWithRoom(customer.nameEn || customer.nameAr, customer.roomNumber),
                    savedAmount,
                    date,
                    newTx.vatInvoiceNumber || newTx.id.slice(0, 8).toUpperCase(),
                    newTx.buildingName || '',
                    unitNumber,
                    paymentMethod
                  );
                  console.log('Payment receipt email sent to', customer.email);
                }
              } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Don't block transaction saving if email fails
              }
            }
            
            setSuccessMsg(t('entry.savedSuccessfully'));
            if (id) {
                setTimeout(() => navigate(buildingId === 'HEAD_OFFICE' ? '/transfers' : '/history'), 500);
            } else if (buildingId === 'HEAD_OFFICE') {
                setTimeout(() => navigate('/transfers'), 800);
            } else {
                // Reset Form
                setTimeout(() => {
                    resetForm();
                }, 800);
            }
            } finally {
                saveInFlightRef.current = false;
            }
        } finally {
            setLoading(false);
        }
  };

  const selectedBuilding = buildings.find(b => b.id === buildingId);
  
  // Sort buildings by number after hyphen (e.g., SAAD-101, HUMAID-102, PANDA-103)
  const sortedBuildings = [...buildings].sort((a, b) => {
    const extractNumber = (name: string) => {
      const match = name.match(/-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const numA = extractNumber(a.name || '');
    const numB = extractNumber(b.name || '');
    
    // If both have numbers, sort by number
    if (numA !== 0 || numB !== 0) {
      return numA - numB;
    }
    
    // Otherwise, sort alphabetically
    const nameA = (a.name || '').toUpperCase();
    const nameB = (b.name || '').toUpperCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  // Show all buildings in Entry Form (residential + non-residential).
  const residentialBuildings = sortedBuildings;
  
  // Sort units by block (A, B, C) and then numerically
  const sortedUnits = selectedBuilding?.units ? [...selectedBuilding.units].sort((a, b) => {
    const extractBlock = (name: string) => {
      const match = name.match(/^([A-Z])/);
      return match ? match[1] : '';
    };
    const extractNumber = (name: string) => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const blockA = extractBlock(a.name);
    const blockB = extractBlock(b.name);
    const numA = extractNumber(a.name);
    const numB = extractNumber(b.name);
    
    // First sort by block (A, B, C)
    if (blockA !== blockB) {
      return blockA.localeCompare(blockB);
    }
    // Then sort by number
    return numA - numB;
  }) : [];
    let previewNet = (parseFloat(amount)||0) + (parseFloat(extraAmount)||0) - (parseFloat(discountAmount)||0) + (parseFloat(bonus)||0) - (parseFloat(deduction)||0);
    const previewBorrowDeduction = (type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY) ? (parseFloat(borrowDeduction)||0) : 0;
    previewNet -= previewBorrowDeduction;
    let previewVat = 0;
    let previewTotal = 0;

    if (vatApplicableEffective) {
        const a = parseFloat(amount)||0;
        if ((type === TransactionType.INCOME && id) || type === TransactionType.EXPENSE) {
            // Inclusive mode: amount field shows inclusive total (income edit or expense)
            const inclusive = a;
            const exclusive = Number((inclusive / 1.15).toFixed(2));
            previewNet = exclusive + (parseFloat(extraAmount)||0) - (parseFloat(discountAmount)||0) + (parseFloat(bonus)||0) - (parseFloat(deduction)||0) - previewBorrowDeduction;
            previewVat = Number((inclusive - exclusive).toFixed(2));
        } else {
            // Exclusive mode: income new entry, VAT added on top
            previewNet = a + (parseFloat(extraAmount)||0) - (parseFloat(discountAmount)||0) + (parseFloat(bonus)||0) - (parseFloat(deduction)||0) - previewBorrowDeduction;
            previewVat = Number((previewNet * 0.15).toFixed(2));
        }
        previewTotal = Number((previewNet + previewVat).toFixed(2));
    } else {
        previewTotal = previewNet;
    }

  const getSelectedBankIBAN = () => {
      return banks.find(b => b.name === bankName)?.iban || (selectedBuilding?.iban || '');
  }

  const inputStyle = "w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-300 shadow-sm transition-all";
  const whiteInputStyle = "w-full p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all";

    return (
        <div className="mobile-tab-shell tab-entry w-full min-w-0 max-w-4xl mx-auto animate-fade-in overflow-x-hidden pb-4 sm:pb-6 px-3 sm:px-0">

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 space-y-5 sm:space-y-8 relative">
        {/* Income/Expense Toggle */}
        <div className="flex justify-center">
            {!id || adminEditingExisting ? (
                <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
                    <button type="button" onClick={() => setType(TransactionType.INCOME)} className={`px-5 sm:px-8 py-2.5 rounded-lg text-xs font-bold transition-all ${type === TransactionType.INCOME ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>{t('entry.income')}</button>
                    <button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`px-5 sm:px-8 py-2.5 rounded-lg text-xs font-bold transition-all ${type === TransactionType.EXPENSE ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>{t('entry.expense')}</button>
                </div>
            ) : (
                <div className={`px-6 py-2 rounded-xl text-sm font-black text-white shadow-md ${type === TransactionType.INCOME ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    {type === TransactionType.INCOME ? t('entry.incomeTxLabel') : t('entry.expenseTxLabel')}
                </div>
            )}
        </div>

        {/* ── Quick VAT Entry Launchers (ZATCA tax invoice shortcut) ── */}
        {!id && (
          <div className="relative rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 p-4 sm:p-5 overflow-hidden shadow-sm">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-200/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-6 w-28 h-28 bg-emerald-200/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-300/40">
                  <Sparkles size={15} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Quick VAT Entry</div>
                  <div className="text-xs font-black text-slate-700 leading-tight">ZATCA-compliant tax invoice</div>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">
                <Receipt size={10} /> Phase 2
              </span>
            </div>
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => { setVatModalType('SALES'); setShowVATModal(true); }}
                className="group flex items-center gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100 hover:-translate-y-0.5 active:translate-y-0 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <TrendingUp size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Income</div>
                  <div className="font-black text-slate-800 text-sm leading-tight">Sales · Output VAT</div>
                </div>
                <ArrowRight size={14} className="text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => { setVatModalType('EXPENSE'); setShowVATModal(true); }}
                className="group flex items-center gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100 hover:-translate-y-0.5 active:translate-y-0 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-105 transition-transform">
                  <TrendingDown size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Expense</div>
                  <div className="font-black text-slate-800 text-sm leading-tight">Purchase · Input VAT</div>
                </div>
                <ArrowRight size={14} className="text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => { setVatModalType('FEES'); setShowVATModal(true); }}
                className="group flex items-center gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-white border-2 border-sky-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-100 hover:-translate-y-0.5 active:translate-y-0 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-200 group-hover:scale-105 transition-transform">
                  <Receipt size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-sky-500 uppercase tracking-wider">Fees</div>
                  <div className="font-black text-slate-800 text-sm leading-tight">Non-VAT Fees</div>
                </div>
                <ArrowRight size={14} className="text-sky-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        )}
        {loading && <LoadingOverlay visible={loading} inline message={t('entry.saving')} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <div className="space-y-3 sm:space-y-6">
                <div className="space-y-1 sm:space-y-2">
                   <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('common.date')}</label>
                   <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyle} lang={language === 'ar' ? 'ar-SA' : undefined} />
                </div>

                {type === TransactionType.INCOME ? (
                    <>
                        {/* Income Sub-Type Toggle — staff see a label when editing; admin can switch anytime */}
                        {(!id || adminEditingExisting) && (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setIncomeSubType('RENTAL'); setOtherIncomeCategory(''); }} className={`flex-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${incomeSubType === 'RENTAL' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>
                                {t('entry.rentalIncomeLabel')}
                            </button>
                            <button type="button" onClick={() => { setIncomeSubType('OTHER'); setBuildingId(''); setUnitNumber(''); setActiveContract(undefined); setAutoCustomerName(''); setOverpaymentWarning(''); }} className={`flex-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${incomeSubType === 'OTHER' ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>
                                {t('entry.otherIncomeLabel')}
                            </button>
                        </div>
                        )}
                        
                        {id && !adminEditingExisting && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-4 py-2 rounded-xl text-center text-sm shadow-sm">
                                {incomeSubType === 'RENTAL' ? t('entry.rentalIncomeLabel') : t('entry.otherIncomeLabel')}
                            </div>
                        )}

                        {incomeSubType === 'RENTAL' ? (
                        <>
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                            <div className="space-y-1 sm:space-y-2">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.building')}</label>
                                <SearchableSelect
                                    options={residentialBuildings.map(b => ({ value: b.id, label: b.name }))}
                                    value={buildingId}
                                    onChange={val => { setBuildingId(val); setUnitNumber(''); }}
                                    placeholder={t('entry.select')}
                                    disabled={!canFullEditEntry && !!id}
                                    className={inputStyle}
                                />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.unit')}</label>
                                <SearchableSelect
                                    options={sortedUnits.map(u => ({
                                        value: u.name,
                                        label: u.name
                                    }))}
                                    value={unitNumber}
                                    onChange={val => { if (!canFullEditEntry && !!id) return; setUnitNumber(val); }}
                                    placeholder={buildingId ? 'Select...' : 'Select building first...'}
                                    disabled={!buildingId || (!canFullEditEntry && !!id)}
                                />
                                {!canFullEditEntry && !!id && <div className="text-xs text-slate-400 mt-1">{t('entry.adminOnlyUnit')}</div>}
                            </div>
                        </div>
                        
                        {autoCustomerName && !overpaymentWarning && (
                            <div className="bg-emerald-50 border border-emerald-200 p-2 sm:p-3 rounded-lg sm:rounded-xl flex items-center gap-2">
                                <Info size={14} className="text-emerald-600 flex-shrink-0" />
                                <div className="text-xs sm:text-sm font-bold text-emerald-800">{t('entry.customer')}<span className="text-emerald-900">{autoCustomerName}</span>
                                </div>
                            </div>
                        )}
                        
                        {activeContract && !overpaymentWarning && (() => {
                            // Build installment data for timeline (schedule uses paidExclSchedule so prior-lease FIFO does not look like "last installment again")
                            const totalInst = activeContract.installmentCount || 1;
                            const upfrontPaid = Number((activeContract as any).upfrontPaid || 0);
                            const totalValueStored = Number(activeContract.totalValue || 0);
                            const effectiveTotalExcl = totalValueStored + upfrontPaid;
                            const otherInstAmt = Number(activeContract.otherInstallment || 0);
                            let firstInstAmt = Number(activeContract.firstInstallment || 0) + upfrontPaid;
                            const sumInst = firstInstAmt + (otherInstAmt * Math.max(0, totalInst - 1));
                            if (effectiveTotalExcl > 0 && Math.abs(sumInst - effectiveTotalExcl) > Math.max(5, totalInst)) {
                                firstInstAmt = Math.max(0, effectiveTotalExcl - (otherInstAmt * Math.max(0, totalInst - 1)));
                            }

                            const priorO = Math.max(0, Number((activeContract as any).priorLeaseOutstandingAtRenewal) || 0);
                            const isVATBuilding = (() => {
                                const b = buildings.find(bb => bb.id === buildingId);
                                return b?.propertyType === 'NON_RESIDENTIAL' || b?.vatApplicable === true;
                            })();
                            const rentValue = Number((activeContract as any).rentValue || 0);
                            const vatOnRent = isVATBuilding ? rentValue * 0.15 : 0;
                            const vatOnOneTime = isVATBuilding ? Math.max(0, firstInstAmt - otherInstAmt) * 0.15 : 0;
                            const effectiveTotalIncl = totalValueStored + upfrontPaid + vatOnRent + vatOnOneTime;
                            const grandTotalDue = effectiveTotalIncl + priorO;
                            const schedulePaidTowardInst = contractStats.paidExclSchedule;

                            const installments: { no: number; status: 'paid' | 'partial' | 'current' | 'upcoming'; paid: number; total: number }[] = [];
                            for (let i = 1; i <= totalInst; i++) {
                                const instAmt = i === 1 ? firstInstAmt : otherInstAmt;
                                const prevCum = i === 1 ? 0 : (firstInstAmt + (i - 2) * otherInstAmt);
                                const paidForThis = Math.max(0, Math.min(instAmt, schedulePaidTowardInst - prevCum));
                                const isCurrent = contractStats.installmentNo === i;
                                let status: 'paid' | 'partial' | 'current' | 'upcoming' = 'upcoming';
                                if (paidForThis >= instAmt) status = 'paid';
                                else if (paidForThis > 0) status = 'partial';
                                else if (isCurrent) status = 'current';
                                installments.push({ no: i, status, paid: paidForThis, total: instAmt });
                            }

                            const paidTowardPrior = Math.min(contractStats.paid, priorO);
                            let priorStatus: 'paid' | 'partial' | 'current' | 'upcoming' = 'upcoming';
                            if (priorO > 0) {
                                if (paidTowardPrior >= priorO) priorStatus = 'paid';
                                else if (paidTowardPrior > 0) priorStatus = 'partial';
                                else if (contractStats.installmentNo === 0) priorStatus = 'current';
                                else priorStatus = 'upcoming';
                            }

                            const progressPct =
                                grandTotalDue > 0 ? Math.min(100, (contractStats.paid / grandTotalDue) * 100) : 0;
                            const currentInst =
                                contractStats.installmentNo > 0
                                    ? installments.find(i => i.no === contractStats.installmentNo)
                                    : undefined;
                            const isPartialInst = currentInst && currentInst.paid > 0 && currentInst.paid < currentInst.total;
                            const isPriorBucket = contractStats.installmentNo === 0 && priorO > 0;
                            const isPartialPrior =
                                isPriorBucket && paidTowardPrior > 0 && paidTowardPrior < priorO;

                            return (
                                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 border border-emerald-200/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg shadow-emerald-100/40">
                                                                                                {/* Contract Date Period */}
                                                                                                {activeContract.fromDate && activeContract.toDate && (
                                                                                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                                                                                        <Calendar size={13} className="inline-block mr-1" />
                                                                                                        <span>Period:</span>
                                                                                                        <span className="font-mono text-emerald-900">{fmtDate(activeContract.fromDate)} — {fmtDate(activeContract.toDate)}</span>
                                                                                                    </div>
                                                                                                )}
                                {/* Decorative background */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-200/20 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 blur-xl"></div>

                                {/* Header */}
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                            <FileSignature size={16} className="text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-800">Contract #{activeContract.contractNo}</h4>
                                            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium">{autoCustomerName}</p>
                                        </div>
                                    </div>
                                    <div className="px-2.5 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                        {activeContract.status}
                                    </div>
                                </div>

                                {/* Financial Summary Cards — totals match contract list (incl. VAT when applicable + prior lease at renewal) */}
                                <div className="relative grid grid-cols-3 gap-2">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2.5 border border-white/50 shadow-sm">
                                        <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            {priorO > 0 ? t('entry.totalDueGrand') : t('common.total')}
                                        </div>
                                        <div className="text-sm sm:text-base font-black text-slate-800 mt-0.5">
                                            {(priorO > 0 ? grandTotalDue : isVATBuilding ? effectiveTotalIncl : effectiveTotalExcl).toLocaleString()}
                                        </div>
                                        <div className="text-[8px] text-slate-400">{priorO > 0 ? t('entry.inclPriorNote') : t('common.sar')}</div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2.5 border border-emerald-100 shadow-sm">
                                        <div className="text-[8px] sm:text-[9px] font-bold text-emerald-500 uppercase tracking-wider">{t('tenant.paidAmount')}</div>
                                        <div className="text-sm sm:text-base font-black text-emerald-700 mt-0.5">{contractStats.paid.toLocaleString()}</div>
                                        <div className="text-[8px] text-emerald-400">{t('common.sar')}</div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2.5 border border-rose-100 shadow-sm">
                                        <div className="text-[8px] sm:text-[9px] font-bold text-rose-500 uppercase tracking-wider">{t('entry.remaining')}</div>
                                        <div className={`text-sm sm:text-base font-black mt-0.5 ${contractStats.remaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{contractStats.remaining.toLocaleString()}</div>
                                        <div className="text-[8px] text-rose-400">{t('common.sar')}</div>
                                    </div>
                                </div>

                                {/* Overall Progress Bar */}
                                <div className="relative">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">{t('entry.overallProgress')}</span>
                                        <span className="text-[9px] sm:text-[10px] font-black text-emerald-700">{progressPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-white/70 rounded-full h-2.5 shadow-inner">
                                        <div className="bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 h-2.5 rounded-full transition-all duration-700 ease-out relative overflow-hidden" style={{ width: `${progressPct}%` }}>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Prior lease balance (renewal) — shown before schedule installments */}
                                {isPriorBucket && currentInstallmentRemaining > 0 && (
                                    <div
                                        className={`relative p-3 rounded-xl border-2 shadow-sm ${
                                            isPartialPrior
                                                ? 'bg-gradient-to-r from-sky-100/90 to-indigo-100/80 border-sky-400'
                                                : 'bg-gradient-to-r from-sky-50/90 to-blue-50/80 border-sky-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white ${
                                                        isPartialPrior ? 'bg-sky-600' : 'bg-sky-500'
                                                    }`}
                                                >
                                                    {t('entry.priorLeaseChip')}
                                                </div>
                                                <span className="text-xs font-black text-slate-700">{t('entry.priorLeasePaymentLabel')}</span>
                                            </div>
                                            <span className={`text-sm sm:text-base font-black ${isPartialPrior ? 'text-sky-800' : 'text-sky-700'}`}>
                                                {currentInstallmentRemaining.toLocaleString()} SAR
                                            </span>
                                        </div>
                                        {isPartialPrior && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-slate-500">{t('entry.installmentTotal')}</span>
                                                    <span className="text-slate-700">{priorO.toLocaleString()} SAR</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-emerald-600">{t('entry.alreadyPaid')}</span>
                                                    <span className="text-emerald-700">{paidTowardPrior.toLocaleString()} SAR</span>
                                                </div>
                                                <div className="w-full bg-white/70 rounded-full h-1.5 mt-1">
                                                    <div
                                                        className="bg-gradient-to-r from-sky-400 to-sky-600 h-1.5 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, (paidTowardPrior / priorO) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {smartInstallmentMsg && (
                                            <div className="text-[9px] font-bold text-sky-900 bg-white/80 px-2 py-1 rounded border border-sky-200 inline-block mt-1">
                                                {smartInstallmentMsg}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Current schedule installment */}
                                {!isPriorBucket && currentInst && currentInst.paid < currentInst.total && (
                                    <div className={`relative p-3 rounded-xl border-2 ${isPartialInst ? 'bg-gradient-to-r from-teal-100/80 to-cyan-100/80 border-teal-300' : 'bg-gradient-to-r from-emerald-100/80 to-teal-100/80 border-emerald-300'} shadow-sm`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${isPartialInst ? 'bg-teal-500' : 'bg-emerald-500'}`}>
                                                    {contractStats.installmentNo}
                                                </div>
                                                <span className="text-xs font-black text-slate-700">
                                                    {isPartialInst ? t('entry.balanceDueInstallment') : t('entry.currentInstallmentLabel')}
                                                </span>
                                            </div>
                                            <span className={`text-sm sm:text-base font-black ${isPartialInst ? 'text-teal-700' : 'text-emerald-700'}`}>
                                                {currentInstallmentRemaining.toLocaleString()} SAR
                                            </span>
                                        </div>
                                        {isPartialInst && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-slate-500">{t('entry.installmentTotal')}</span>
                                                    <span className="text-slate-700">{currentInst.total.toLocaleString()} SAR</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-emerald-600">{t('entry.alreadyPaid')}</span>
                                                    <span className="text-emerald-700">{currentInst.paid.toLocaleString()} SAR</span>
                                                </div>
                                                <div className="w-full bg-white/70 rounded-full h-1.5 mt-1">
                                                    <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (currentInst.paid / currentInst.total) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                        {smartInstallmentMsg && !isPartialInst && (
                                            <div className="text-[9px] font-black text-white bg-emerald-500 px-2 py-1 rounded inline-block mt-1">
                                                {smartInstallmentMsg}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Installment Timeline */}
                                {installments.length > 0 && installments.length <= 24 && (
                                    <div className="relative">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('entry.installmentTimeline')}</div>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {priorO > 0 && (
                                                <div
                                                    title={`${t('entry.priorLeaseTimelineHint')}: ${paidTowardPrior.toLocaleString()} / ${priorO.toLocaleString()} SAR`}
                                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[8px] sm:text-[9px] font-black border transition-all cursor-default ${
                                                        priorStatus === 'paid'
                                                            ? 'bg-sky-500 text-white border-sky-600 shadow-sm shadow-sky-200'
                                                            : priorStatus === 'partial'
                                                              ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white border-sky-500 shadow-sm ring-2 ring-sky-300 ring-offset-1'
                                                              : priorStatus === 'current'
                                                                ? 'bg-sky-600 text-white border-sky-700 shadow-sm ring-2 ring-sky-300 ring-offset-1 animate-pulse'
                                                                : 'bg-white/60 text-slate-400 border-slate-200'
                                                    }`}
                                                >
                                                    {priorStatus === 'paid' ? 'OK' : t('entry.priorLeaseChip')}
                                                </div>
                                            )}
                                            {installments.map(inst => (
                                                <div
                                                    key={inst.no}
                                                    title={`#${inst.no}: ${inst.paid.toLocaleString()} / ${inst.total.toLocaleString()} SAR`}
                                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black border transition-all cursor-default ${
                                                        inst.status === 'paid' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-200' :
                                                        inst.status === 'partial' ? 'bg-gradient-to-br from-teal-400 to-cyan-500 text-white border-teal-500 shadow-sm shadow-teal-200 ring-2 ring-teal-300 ring-offset-1' :
                                                        inst.status === 'current' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-200 ring-2 ring-emerald-300 ring-offset-1 animate-pulse' :
                                                        'bg-white/60 text-slate-400 border-slate-200'
                                                    }`}
                                                >
                                                    {inst.status === 'paid' ? 'OK' : inst.no}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[8px] sm:text-[9px] text-slate-500">
                                            {priorO > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2.5 h-2.5 rounded bg-sky-500 inline-block" />
                                                    {t('entry.priorLeasePaymentLabel')}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>{t('tenant.paidAmount')}</span>
                                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-teal-400 to-cyan-500 inline-block"></span> {t('entry.legendPartial')}</span>
                                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> {t('entry.legendCurrent')}</span>
                                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white border border-slate-200 inline-block"></span> {t('entry.legendUpcoming')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Date Range */}
                                {installmentDateRange && (
                                    <div className="flex items-center gap-2 text-[9px] text-slate-500 font-medium bg-white/50 rounded-lg px-2.5 py-1.5">
                                        <Calendar size={10} className="text-emerald-500"/> {installmentDateRange}
                                    </div>
                                )}

                                {/* Payments history */}
                                {contractPayments.length > 0 && (
                                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/50">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('tenant.myPayments')}</div>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                            {[...contractPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                                                <div key={p.id} className="flex items-center justify-between text-[10px] py-1.5 border-b border-slate-100 last:border-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 font-medium">{fmtDate(p.date)}</span>
                                                        {(p as any).discountAmount > 0 && (
                                                            <span className="text-[8px] bg-teal-100 text-teal-600 px-1 rounded font-bold">-{(p as any).discountAmount.toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-emerald-700">{Number((p as any).amountIncludingVAT || (p as any).totalWithVat || p.amount).toLocaleString()} SAR</span>
                                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === TransactionStatus.APPROVED ? 'bg-emerald-500' : 'bg-teal-500'}`}></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                                );
                        })()}
                        {overpaymentWarning && (
                             <div className="bg-rose-50 border border-rose-200 text-rose-600 p-2 sm:p-3 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold text-center">
                                 {overpaymentWarning}
                             </div>
                        )}
                        

                        </>
                        ) : (
                        /* Other Income - Simple form without building/unit */
                        <>
                            <div className="space-y-1 sm:space-y-2">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.category')}</label>
                                <div className="flex flex-col w-full">
                                    <div className="flex gap-2 items-center mb-2">
                                        <div className="relative w-2/3">
                                            <SearchableSelect
                                                options={localIncomeCategories.sort((a,b)=>a.localeCompare(b)).map(c => ({ value: c, label: c })).concat(
                                                    canManageCategories && !!otherIncomeCategory ? [{ value: INCOME_DELETE_OPTION, label: t('entry.deleteSelectedCategory') }] : []
                                                )}
                                                value={otherIncomeCategory}
                                                onChange={val => {
                                                    if (val === INCOME_DELETE_OPTION) {
                                                        if (canDeleteIncomeCategory) {
                                                            openConfirm(
                                                                `Delete "${otherIncomeCategory}" category? This cannot be undone.`,
                                                                () => {
                                                                    deleteSelectedIncomeCategory();
                                                                    closeConfirm();
                                                                },
                                                                { title: t('entry.deleteIncomeCategory'), danger: true }
                                                            );
                                                        }
                                                        return;
                                                    }
                                                    setOtherIncomeCategory(val);
                                                }}
                                                placeholder={t('entry.selectCategory')}
                                                disabled={!canFullEditEntry && !!id}
                                                className={inputStyle + " !w-full !rounded-xl !shadow-md !border-emerald-300"}
                                            />
                                        </div>
                                        {canManageCategories && (
                                            <>
                                                <input value={newIncomeCategoryName} onChange={e => setNewIncomeCategoryName(e.target.value)} placeholder="Add new..." className="w-1/3 px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold shadow-sm focus:ring-emerald-500 focus:border-emerald-400" />
                                                <button type="button" onClick={() => {
                                                    const name = newIncomeCategoryName.trim();
                                                    if (!name) return;
                                                    const next = localIncomeCategories.includes(name) ? localIncomeCategories : [name, ...localIncomeCategories];
                                                    setLocalIncomeCategories(next);
                                                    persistIncomeCategories(next);
                                                    setOtherIncomeCategory(name);
                                                    setNewIncomeCategoryName("");
                                                }} className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-black shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1">
                                                    <span>+</span>{t('common.add')}</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 sm:space-y-2">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.description')}</label>
                                <textarea
                                    value={details}
                                    onChange={e => setDetails(e.target.value)}
                                    placeholder={t('entry.incomeDetails')}
                                    rows={2}
                                    className={inputStyle + " resize-none"}
                                    readOnly={!canFullEditEntry && !!id}
                                />
                            </div>

                            {/* Optional: Link to a building (not required) — shows all buildings (residential + non-residential) */}
                            <div className="space-y-1 sm:space-y-2">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.building')}<span className="text-rose-500 font-bold">*</span></label>
                                <SearchableSelect
                                    options={sortedBuildings.map(b => ({
                                        value: b.id,
                                        label: b.name,
                                        sublabel: b.propertyType === 'NON_RESIDENTIAL' || (b as any).vatApplicable ? 'Non-Residential' : 'Residential',
                                    }))}
                                    value={buildingId}
                                    onChange={val => { setBuildingId(val); setUnitNumber(''); }}
                                    placeholder={t('entry.selectBuilding')}
                                    disabled={!canFullEditEntry && !!id}
                                    className={inputStyle}
                                />
                            </div>


                        </>
                        )}
                    </>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        <div className="space-y-2">
                            <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.categoryShort')}</label>
                            <div className="flex gap-1 sm:gap-2">
                                <div className="flex flex-col w-full">
                                    <div className="flex gap-2 items-center mb-2">
                                        <div className="relative w-2/3">
                                            <SearchableSelect
                                                options={localCategories.sort((a,b)=>a.localeCompare(b)).map(c => ({ value: c, label: c })).concat(
                                                    canManageCategories && !!expenseCategory ? [{ value: EXPENSE_DELETE_OPTION, label: t('entry.deleteSelectedCategory') }] : []
                                                )}
                                                value={expenseCategory}
                                                onChange={val => {
                                                    if (val === EXPENSE_DELETE_OPTION) {
                                                        if (canDeleteExpenseCategory) {
                                                            openConfirm(
                                                                `Delete "${expenseCategory}" category? This cannot be undone.`,
                                                                () => {
                                                                    deleteSelectedExpenseCategory();
                                                                    closeConfirm();
                                                                },
                                                                { title: t('entry.deleteExpenseCategory'), danger: true }
                                                            );
                                                        }
                                                        return;
                                                    }
                                                    // Head Office entries are managed through the Treasury tab
                                                    if (val === ExpenseCategory.HEAD) {
                                                        navigate('/transfers');
                                                        return;
                                                    }
                                                    // Owner Expense should be enterable directly (no forced redirect to Treasury)
                                                    setExpenseCategory(val);
                                                }}
                                                placeholder={t('entry.selectCategory')}
                                                disabled={!canFullEditEntry && !!id}
                                                className={inputStyle + " !w-full !rounded-xl !shadow-md !border-emerald-300"}
                                            />
                                        </div>
                                        {canManageCategories && (
                                            <>
                                                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Add new..." className="w-1/3 px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold shadow-sm focus:ring-emerald-500 focus:border-emerald-400" />
                                                <button type="button" onClick={() => {
                                                    const name = newCategoryName.trim();
                                                    if (!name) return;
                                                    const next = localCategories.includes(name) ? localCategories : [name, ...localCategories];
                                                    setLocalCategories(next);
                                                    persistCategories(next);
                                                    setExpenseCategory(name);
                                                    setNewCategoryName("");
                                                }} className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-black shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1">
                                                    <span>+</span>{t('common.add')}</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {expenseCategory === ExpenseCategory.SALARY && (
                            <div className="space-y-3 animate-fadeIn">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('nav.staff')}</label>
                                <SearchableSelect
                                    options={employees.map(e => ({ value: e.id, label: e.name }))}
                                    value={targetEmployeeId}
                                    onChange={handleEmployeeSelect}
                                    placeholder={t('entry.select')}
                                    disabled={!canFullEditEntry && !!id}
                                    className={inputStyle}
                                />
                                <div className="space-y-1">
                                    <label className="text-[9px] sm:text-[10px] text-slate-500 font-bold">{t('entry.salaryMonth')}</label>
                                    <input
                                        disabled={!canFullEditEntry && !!id}
                                        type="month"
                                        value={salaryPeriodInput}
                                        onChange={e => { setSalaryPeriodInput(e.target.value); setSalaryPeriodManual(true); }}
                                        className={inputStyle}
                                    />
                                    {salaryPeriodLabel && (
                                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold">Auto: {salaryPeriodLabel}</div>
                                    )}
                                    {targetEmployeeId && selectedSalaryPeriod && isSalaryFullyPaid && (
                                        <div className="mt-1.5 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 flex items-center gap-2">
                                            <span className="text-emerald-600 text-sm">✅</span>
                                            <span className="text-[10px] sm:text-xs font-bold text-emerald-700">Salary for {salaryPeriodLabel} is fully paid ({salaryPaidForPeriod.toLocaleString()} SAR)</span>
                                        </div>
                                    )}
                                    {targetEmployeeId && selectedSalaryPeriod && salaryPaidForPeriod > 0 && !isSalaryFullyPaid && (
                                        <div className="mt-1.5 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-500 text-sm">⚠️</span>
                                                <span className="text-[10px] sm:text-xs font-bold text-amber-700">Partial payment detected for {salaryPeriodLabel}</span>
                                            </div>
                                            <div className="mt-1 ml-6 text-[9px] sm:text-[10px] text-slate-600 space-y-0.5">
                                                <div>{t('entry.fullSalaryLabel')}: <b>{salaryFullAmount.toLocaleString()} SAR</b></div>
                                                <div>{t('entry.alreadyPaid')}: <b className="text-emerald-600">{salaryPaidForPeriod.toLocaleString()} SAR</b></div>
                                                <div>{t('entry.balanceDueLabel')}: <b className="text-rose-600">{salaryBalance.toLocaleString()} SAR</b></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Borrowing Summary for Salary Payment */}
                                {targetEmployeeId && (() => {
                                    const empBorrowTxs = allTransactions.filter(t => (t.type === TransactionType.EXPENSE || (t.type === TransactionType.INCOME && t.borrowingType === 'REPAYMENT')) && (t.expenseCategory === ExpenseCategory.BORROWING || t.expenseCategory === 'Borrowing') && t.employeeId === targetEmployeeId && t.status !== 'REJECTED');
                                    const bTotal = empBorrowTxs.filter(t => t.borrowingType !== 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                    const rTotal = empBorrowTxs.filter(t => t.borrowingType === 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                    const outstanding = bTotal - rTotal;
                                    if (bTotal === 0) return null;
                                    return (
                                        <div className={`p-3 sm:p-4 rounded-xl border text-xs sm:text-sm ${outstanding > 0 ? 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base">{outstanding > 0 ? '!' : 'OK'}</span>
                                                <span className="font-black text-slate-800 text-xs uppercase tracking-wider">{t('entry.borrowingSummary')}</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between font-bold"><span className="text-slate-600">{t('entry.totalBorrowed')}</span><span className="text-rose-600">{bTotal.toLocaleString()} SAR</span></div>
                                                <div className="flex justify-between font-bold"><span className="text-slate-600">{t('entry.totalRepaid')}</span><span className="text-emerald-600">{rTotal.toLocaleString()} SAR</span></div>
                                                <div className="flex justify-between font-black pt-1.5 border-t border-current/10"><span className={outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}>{t('entry.outstandingBalance')}</span><span className={outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}>{outstanding.toLocaleString()} SAR</span></div>
                                            </div>
                                            {outstanding > 0 && (
                                                <div className="mt-2 w-full bg-white/70 rounded-full h-2">
                                                    <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (rTotal / bTotal) * 100)}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {(expenseCategory === ExpenseCategory.BORROWING || expenseCategory === 'Borrowing') && (
                            <div className="space-y-3 animate-fadeIn">
                                {/* Borrow / Repayment Toggle */}
                                {(!id || adminEditingExisting) && (
                                <div>
                                    <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">{t('history.type')}</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button type="button" onClick={() => setBorrowingType('BORROW')}
                                            className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${borrowingType === 'BORROW' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>
                                            <span className="text-base">v</span>{t('entry.newBorrowing')}</button>
                                        <button type="button" onClick={() => setBorrowingType('REPAYMENT')}
                                            className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${borrowingType === 'REPAYMENT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                                            <span className="text-base">^</span>{t('entry.repayment')}</button>
                                    </div>
                                </div>
                                )}
                                {id && !adminEditingExisting && (
                                    <div className={`text-center py-2 font-bold rounded-lg mb-2 text-sm ${borrowingType === 'BORROW' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                        {borrowingType === 'BORROW' ? 'New Borrowing' : 'Repayment'}
                                    </div>
                                )}
                                {/* Staff / External Person Toggle */}
                                {(!id || adminEditingExisting) && (
                                <div>
                                    <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">{t('entry.borrowerType')}</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button type="button" onClick={() => { setIsExternalBorrower(false); setExternalBorrowerName(''); }}
                                            className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${!isExternalBorrower ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t('nav.staff')}</button>
                                        <button type="button" onClick={() => { setIsExternalBorrower(true); setTargetEmployeeId(''); }}
                                            className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${isExternalBorrower ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>
                                            {t('entry.externalPersonNote')}
                                        </button>
                                    </div>
                                </div>
                                )}
                                <div>
                                    <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{borrowingType === 'REPAYMENT' ? 'Who is Repaying' : 'Borrower'}</label>
                                    {isExternalBorrower ? (
                                        <>
                                            <input
                                                type="text"
                                                value={externalBorrowerName}
                                                onChange={e => setExternalBorrowerName(e.target.value)}
                                                placeholder={t('entry.personNamePlaceholder')}
                                                className={inputStyle}
                                                disabled={!canFullEditEntry && !!id}
                                            />
                                            <p className="text-[8px] sm:text-[9px] text-orange-500 ml-1 font-medium">{t('entry.externalPersonNote')}</p>
                                        </>
                                    ) : (
                                        <>
                                            <SearchableSelect
                                                options={employees.map(e => ({ value: e.id, label: e.name }))}
                                                value={targetEmployeeId}
                                                onChange={handleBorrowingEmployeeSelect}
                                                placeholder={t('entry.select')}
                                                disabled={!canFullEditEntry && !!id}
                                                className={inputStyle}
                                            />
                                            <p className="text-[8px] sm:text-[9px] text-slate-400 ml-1">{borrowingType === 'REPAYMENT' ? 'Staff returning money' : 'Who borrowed this'}</p>
                                        </>
                                    )}
                                </div>
                                {/* Show outstanding balance for selected employee/external */}
                                {(targetEmployeeId || (isExternalBorrower && externalBorrowerName.trim())) && (() => {
                                    const matchId = isExternalBorrower ? ('external_' + externalBorrowerName.trim()) : targetEmployeeId;
                                    const empBorrowTxs = allTransactions.filter(t => (t.type === TransactionType.EXPENSE || (t.type === TransactionType.INCOME && t.borrowingType === 'REPAYMENT')) && (t.expenseCategory === ExpenseCategory.BORROWING || t.expenseCategory === 'Borrowing') && t.employeeId === matchId && t.status !== 'REJECTED');
                                    const bTotal = empBorrowTxs.filter(t => t.borrowingType !== 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                    const rTotal = empBorrowTxs.filter(t => t.borrowingType === 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                    const outstanding = bTotal - rTotal;
                                    if (bTotal === 0 && borrowingType === 'BORROW') return null;
                                    return (
                                        <div className={`p-3 rounded-xl border text-xs font-bold ${outstanding > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                            <div className="flex justify-between"><span>{t('entry.totalBorrowed')}</span><span>{bTotal.toLocaleString()} SAR</span></div>
                                            <div className="flex justify-between mt-1"><span>{t('entry.totalRepaid')}</span><span>{rTotal.toLocaleString()} SAR</span></div>
                                            <div className="flex justify-between mt-1 pt-1 border-t border-current/20"><span className="font-black">{t('borrowing.outstanding')}</span><span className="font-black">{outstanding.toLocaleString()} SAR</span></div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {isOwnerExpenseCategory && (
                            <div className="space-y-3 animate-fadeIn">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.ownerLabel')}</label>
                                <SearchableSelect
                                    options={owners.map(o => ({ value: o.id, label: o.name }))}
                                    value={targetOwnerId}
                                    onChange={handleOwnerSelect}
                                    placeholder={t('entry.selectOwner')}
                                    disabled={!canFullEditEntry && !!id}
                                    className={inputStyle}
                                />
                                <p className="text-[8px] sm:text-[9px] text-slate-400 ml-1">
                                    Owner expense is linked to the selected owner and shown in Owner Portal.
                                </p>
                            </div>
                        )}

                        {(expenseCategory === ExpenseCategory.MAINTENANCE || expenseCategory === ExpenseCategory.VENDOR_PAYMENT) && (
                            <div className="space-y-2 animate-fadeIn">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.vendor')}</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <SearchableSelect
                                            options={vendors.map(v => ({
                                                value: v.id,
                                                label: v.nameEn || v.name || v.id,
                                                sublabel: v.serviceType
                                            }))}
                                            value={targetVendorId}
                                            onChange={setTargetVendorId}
                                            placeholder={t('entry.search')}
                                            className=""
                                            disabled={!canFullEditEntry && !!id}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canFullEditEntry && !!id}
                                        onClick={() => navigate('/vendors', { state: { returnTo: '/entry', fromEntry: true } })}
                                        className={`px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 whitespace-nowrap flex items-center gap-1 shadow-sm ${!!id && !canFullEditEntry ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <UserPlus size={14} />{t('common.add')}</button>
                                </div>
                            </div>
                        )}

                        {expenseCategory === ExpenseCategory.SERVICE_AGREEMENT && (
                            <div className="space-y-3 animate-fadeIn">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.serviceAgreementLabel')}</label>
                                <select
                                    disabled={!canFullEditEntry && !!id}
                                    value={selectedServiceAgreementId}
                                    onChange={e => {
                                        const agr = serviceAgreements.find(a => a.id === e.target.value);
                                        setSelectedServiceAgreementId(e.target.value);
                                        if (agr) {
                                            // Calculate installment amount based on frequency
                                            const getInstallmentCount = (freq: string) => {
                                                switch(freq) {
                                                    case 'Monthly': return 12;
                                                    case 'Quarterly': return 4;
                                                    case 'Half-Yearly': return 2;
                                                    case 'Yearly': return 1;
                                                    case 'One-Time': return 1;
                                                    default: return 1;
                                                }
                                            };
                                            const installmentCount = getInstallmentCount(agr.paymentFrequency);
                                            const installmentAmount = Math.round(agr.amount / installmentCount);
                                            const totalPaid = (agr.payments || []).reduce((sum, p) => sum + p.amount, 0);
                                            
                                            // Calculate current installment and balance
                                            const paidInstallments = Math.floor(totalPaid / installmentAmount);
                                            const paidInCurrentInstallment = totalPaid - (paidInstallments * installmentAmount);
                                            const currentInstallmentBalance = installmentAmount - paidInCurrentInstallment;
                                            
                                            // Default to current installment balance (or full installment if starting fresh)
                                            const defaultAmount = currentInstallmentBalance > 0 ? currentInstallmentBalance : installmentAmount;
                                            setAmount(defaultAmount.toString());
                                            setDetails(`${agr.name} - ${agr.vendorName}`);
                                            if (agr.buildingId) {
                                                setBuildingId(agr.buildingId);
                                            }
                                        }
                                    }}
                                    className={inputStyle}
                                >
                                    <option value="">{t('entry.selectAgreement')}</option>
                                    {serviceAgreements.filter(a => a.status === 'Active').map(a => {
                                        const totalPaid = (a.payments || []).reduce((sum, p) => sum + p.amount, 0);
                                        const remaining = a.amount - totalPaid;
                                        return (
                                            <option key={a.id} value={a.id}>
                                                {a.name} - {a.vendorName} ({remaining > 0 ? `${remaining.toLocaleString()} SAR due` : 'Paid'})
                                            </option>
                                        );
                                    })}
                                </select>
                                {selectedServiceAgreementId && (() => {
                                    const agr = serviceAgreements.find(a => a.id === selectedServiceAgreementId);
                                    if (!agr) return null;
                                    const getInstallmentCount = (freq: string) => ({ Monthly:12, Quarterly:4, 'Half-Yearly':2, Yearly:1, 'One-Time':1 }[freq] ?? 1);
                                    const installmentCount = getInstallmentCount(agr.paymentFrequency);
                                    const installmentAmount = Math.round(agr.amount / installmentCount);
                                    const totalPaid = (agr.payments || []).reduce((s, p) => s + p.amount, 0);
                                    const totalRemaining = agr.amount - totalPaid;
                                    const paidInstallments = installmentAmount > 0 ? Math.floor(totalPaid / installmentAmount) : 0;
                                    const currentInstallmentNo = Math.min(paidInstallments + 1, installmentCount);
                                    const paidInCurrentInstallment = totalPaid - (paidInstallments * installmentAmount);
                                    const currentInstallmentBalance = Math.max(0, installmentAmount - paidInCurrentInstallment);
                                    const paidPercent = agr.amount > 0 ? Math.round((totalPaid / agr.amount) * 100) : 0;
                                    return (
                                        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden">
                                            {/* Header */}
                                            <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between">
                                                <div>
                                                    <p className="text-white font-black text-sm">{agr.name}</p>
                                                    <p className="text-violet-200 text-[11px]">{agr.vendorName} · {agr.paymentFrequency}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${totalRemaining <= 0 ? 'bg-emerald-400 text-white' : 'bg-white/20 text-white'}`}>
                                                    {totalRemaining <= 0 ? 'PAID' : agr.status?.toUpperCase()}
                                                </span>
                                            </div>
                                            {/* Stat Cards Grid */}
                                            <div className="grid grid-cols-3 gap-px bg-violet-200">
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('entry.contractAmountLabel')}</p>
                                                    <p className="text-base font-black text-slate-800 mt-0.5">{agr.amount.toLocaleString()}</p>
                                                    <p className="text-[9px] text-slate-400">{t('common.sar')}</p>
                                                </div>
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">{t('tenant.totalPaid')}</p>
                                                    <p className="text-base font-black text-emerald-600 mt-0.5">{totalPaid.toLocaleString()}</p>
                                                    <p className="text-[9px] text-slate-400">{t('common.sar')}</p>
                                                </div>
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">{t('entry.remaining')}</p>
                                                    <p className={`text-base font-black mt-0.5 ${totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{Math.max(0, totalRemaining).toLocaleString()}</p>
                                                    <p className="text-[9px] text-slate-400">{t('common.sar')}</p>
                                                </div>
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('contract.installments')}</p>
                                                    <p className="text-base font-black text-indigo-600 mt-0.5">{currentInstallmentNo}<span className="text-xs font-bold text-slate-400"> / {installmentCount}</span></p>
                                                    <p className="text-[9px] text-slate-400">{t('entry.currentOverTotal')}</p>
                                                </div>
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('entry.installmentAmtLabel')}</p>
                                                    <p className="text-base font-black text-slate-800 mt-0.5">{installmentAmount.toLocaleString()}</p>
                                                    <p className="text-[9px] text-slate-400">{t('entry.sarEach')}</p>
                                                </div>
                                                <div className="bg-white px-3 py-2.5 text-center">
                                                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide">{t('entry.balanceDueLabel')}</p>
                                                    <p className={`text-base font-black mt-0.5 ${currentInstallmentBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{currentInstallmentBalance.toLocaleString()}</p>
                                                    <p className="text-[9px] text-slate-400">{t('entry.thisInstallment')}</p>
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="px-4 py-3 bg-white border-t border-violet-100">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                    <span>Payment Progress</span>
                                                    <span>{paidPercent}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                                    <span>Period: {agr.startDate} → {agr.endDate}</span>
                                                    <span>{(agr.payments || []).length} payment{(agr.payments || []).length !== 1 ? 's' : ''} recorded</span>
                                                </div>
                                            </div>
                                            {/* Recent Payments */}
                                            {(agr.payments || []).length > 0 && (
                                                <div className="px-4 pb-3 bg-white border-t border-violet-100">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{t('entry.recentPaymentsLabel')}</p>
                                                    <div className="space-y-1">
                                                        {(agr.payments || []).slice(-3).reverse().map((p, i) => (
                                                            <div key={i} className="flex justify-between items-center text-xs bg-slate-50 rounded-lg px-2 py-1">
                                                                <span className="text-slate-500">{new Date(p.date).toLocaleDateString()}</span>
                                                                <span className="font-bold text-emerald-600">+{p.amount.toLocaleString()} SAR</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                <p className="text-[8px] sm:text-[9px] text-slate-400 ml-1">
                                    Payment will be recorded against this service agreement.
                                </p>
                            </div>
                        )}

                        {(expenseCategory === ExpenseCategory.PROPERTY_RENT || expenseCategory === 'Property Rent') && (
                            <div className="space-y-3 animate-fadeIn">
                                <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.buildingLeased')}</label>
                                <select 
                                    disabled={!canFullEditEntry && !!id}
                                    value={buildingId} 
                                    onChange={e => {
                                        const bid = e.target.value;
                                        setBuildingId(bid);
                                        setLeaseInstallmentInfo(null);
                                        setLeaseEnteredDiff(null);
                                        const bld = buildings.find(b => b.id === bid);
                                        if (bld?.lease?.isLeased) {
                                            const totalRent = bld.lease.totalRent || 0;
                                            const installCount = bld.lease.installmentCount || 12;
                                            const installAmt = totalRent > 0 ? Math.round(totalRent / installCount) : (bld.lease.monthlyRent || 0);
                                            // Get previous payments for this building
                                            const prevPayments = allTransactions.filter(t => 
                                                t.type === TransactionType.EXPENSE && 
                                                (t.expenseCategory === ExpenseCategory.PROPERTY_RENT || t.expenseCategory === 'Property Rent') &&
                                                t.buildingId === bid &&
                                                t.status !== 'REJECTED'
                                            );
                                            const givenSoFar = prevPayments.reduce((sum, t) => sum + t.amount, 0);
                                            const totalRemaining = totalRent - givenSoFar;
                                            
                                            // Smart installment detection: find which installment is current
                                            let currentInstNo = 1;
                                            let paidThisInst = 0;
                                            let remainingThisInst = installAmt;
                                            let isPartial = false;
                                            
                                            if (totalRent > 0 && installAmt > 0) {
                                                let cumulative = 0;
                                                for (let i = 1; i <= installCount; i++) {
                                                    cumulative += installAmt;
                                                    if (givenSoFar < cumulative) {
                                                        currentInstNo = i;
                                                        const prevCumulative = (i - 1) * installAmt;
                                                        paidThisInst = Math.max(0, givenSoFar - prevCumulative);
                                                        remainingThisInst = installAmt - paidThisInst;
                                                        isPartial = paidThisInst > 0;
                                                        break;
                                                    }
                                                }
                                                // If fully paid
                                                if (givenSoFar >= totalRent) {
                                                    currentInstNo = installCount;
                                                    remainingThisInst = 0;
                                                    paidThisInst = installAmt;
                                                }
                                            }
                                            
                                            // Auto-fill: if partial, fill remaining balance; otherwise fill full installment
                                            const autoAmount = isPartial ? remainingThisInst : installAmt;
                                            if (autoAmount > 0) {
                                                setAmount(autoAmount.toString());
                                            }
                                            
                                            // Auto-fill details with installment info
                                            if (isPartial) {
                                                setDetails(`Balance Payment - Installment ${currentInstNo} of ${installCount} - ${bld.name}${bld.lease.landlordName ? ` (${bld.lease.landlordName})` : ''}`);
                                            } else {
                                                setDetails(`Installment ${currentInstNo} of ${installCount} - ${bld.name}${bld.lease.landlordName ? ` (${bld.lease.landlordName})` : ''}`);
                                            }
                                            
                                            setLeaseInstallmentInfo({
                                                installmentNo: currentInstNo,
                                                installmentAmt: installAmt,
                                                paidThisInstallment: paidThisInst,
                                                remainingThisInstallment: remainingThisInst,
                                                totalPaid: givenSoFar,
                                                totalRemaining: totalRemaining,
                                                totalRent,
                                                installmentCount: installCount,
                                                isPartial,
                                                prevPayments
                                            });
                                        }
                                    }} 
                                    className={inputStyle}
                                >
                                    <option value="">{t('entry.selectLeasedBuilding')}</option>
                                    {buildings.filter(b => b.lease?.isLeased).map(b => (
                                        <option key={b.id} value={b.id}>{b.name} {b.lease?.landlordName ? `- ${b.lease.landlordName}` : ''}</option>
                                    ))}
                                </select>
                                {buildingId && (() => {
                                    const bld = buildings.find(b => b.id === buildingId);
                                    if (!bld?.lease?.isLeased) return null;
                                    const lease = bld.lease;
                                    const totalRent = lease.totalRent || 0;
                                    const monthlyRent = lease.monthlyRent || 0;
                                    const prevPayments = allTransactions.filter(t => 
                                        t.type === TransactionType.EXPENSE && 
                                        (t.expenseCategory === ExpenseCategory.PROPERTY_RENT || t.expenseCategory === 'Property Rent') &&
                                        t.buildingId === buildingId &&
                                        t.status !== 'REJECTED'
                                    );
                                    const givenSoFar = prevPayments.reduce((sum, t) => sum + t.amount, 0);
                                    const remaining = totalRent - givenSoFar;
                                    const installCount = lease.installmentCount || 12;
                                    const installAmt = totalRent > 0 ? Math.round(totalRent / installCount) : monthlyRent;
                                    
                                    // Duration
                                    let durationStr = '';
                                    let daysLeft = 0;
                                    if (lease.leaseStartDate && lease.leaseEndDate) {
                                        const start = new Date(lease.leaseStartDate);
                                        const end = new Date(lease.leaseEndDate);
                                        let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                                        const tempDate = new Date(start);
                                        tempDate.setMonth(tempDate.getMonth() + months);
                                        if (tempDate > end) { months--; }
                                        daysLeft = Math.ceil((new Date(lease.leaseEndDate).getTime() - Date.now()) / 86400000);
                                        durationStr = `${months}m (${daysLeft > 0 ? daysLeft + 'd left' : 'expired'})`;
                                    }

                                    // Build installment timeline
                                    const installments: { no: number; status: 'paid' | 'partial' | 'current' | 'upcoming'; paid: number; total: number }[] = [];
                                    if (totalRent > 0 && installAmt > 0) {
                                        let cumPaid = 0;
                                        for (let i = 1; i <= installCount; i++) {
                                            const prevCum = (i - 1) * installAmt;
                                            const instEnd = i * installAmt;
                                            const paidForThis = Math.max(0, Math.min(installAmt, givenSoFar - prevCum));
                                            const isCurrent = leaseInstallmentInfo?.installmentNo === i;
                                            let status: 'paid' | 'partial' | 'current' | 'upcoming' = 'upcoming';
                                            if (paidForThis >= installAmt) status = 'paid';
                                            else if (paidForThis > 0) status = 'partial';
                                            else if (isCurrent) status = 'current';
                                            installments.push({ no: i, status, paid: paidForThis, total: installAmt });
                                        }
                                    }

                                    const progressPct = totalRent > 0 ? Math.min(100, (givenSoFar / totalRent) * 100) : 0;

                                    return (
                                        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg shadow-emerald-100/40">
                                            {/* Decorative background */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-200/20 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 blur-xl"></div>
                                            
                                            {/* Header */}
                                            <div className="relative flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-xs sm:text-sm font-black text-emerald-800">
                                                        Property Rent • {bld.name}
                                                    </div>
                                                    {lease.landlordName && (
                                                        <div className="text-[10px] sm:text-xs text-slate-600 font-bold mt-0.5">
                                                            Landlord: {lease.landlordName}
                                                        </div>
                                                    )}
                                                    {durationStr && (
                                                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-1 font-medium">
                                                            Duration: {durationStr}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">{t('entry.remaining')}</div>
                                                    <div className="text-sm sm:text-base font-black text-rose-700">
                                                        {Math.max(0, remaining).toLocaleString()} SAR
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium">
                                                        of {totalRent.toLocaleString()} SAR
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Overall Progress Bar */}
                                            <div className="relative">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">{t('entry.overallProgress')}</span>
                                                    <span className="text-[9px] sm:text-[10px] font-black text-emerald-700">{progressPct.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-white/70 rounded-full h-2.5 shadow-inner">
                                                    <div className="bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 h-2.5 rounded-full transition-all duration-700 ease-out relative overflow-hidden" style={{ width: `${progressPct}%` }}>
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Current Installment Highlight */}
                                            {leaseInstallmentInfo && leaseInstallmentInfo.remainingThisInstallment > 0 && (
                                                <div className={`relative p-3 rounded-xl border-2 ${leaseInstallmentInfo.isPartial ? 'bg-gradient-to-r from-teal-100/80 to-cyan-100/80 border-teal-300' : 'bg-gradient-to-r from-emerald-100/80 to-teal-100/80 border-emerald-300'} shadow-sm`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${leaseInstallmentInfo.isPartial ? 'bg-teal-500' : 'bg-emerald-500'}`}>
                                                                {leaseInstallmentInfo.installmentNo}
                                                            </div>
                                                            <span className="text-xs font-black text-slate-700">
                                                                {leaseInstallmentInfo.isPartial ? t('entry.balanceDueInstallment') : t('entry.currentInstallmentLabel')}
                                                            </span>
                                                        </div>
                                                        <span className={`text-sm sm:text-base font-black ${leaseInstallmentInfo.isPartial ? 'text-teal-700' : 'text-emerald-700'}`}>
                                                            {leaseInstallmentInfo.remainingThisInstallment.toLocaleString()} SAR
                                                        </span>
                                                    </div>
                                                    {leaseInstallmentInfo.isPartial && (
                                                        <div className="space-y-1.5">
                                                            <div className="flex justify-between text-[10px] font-bold">
                                                                <span className="text-slate-500">{t('entry.installmentTotal')}</span>
                                                                <span className="text-slate-700">{leaseInstallmentInfo.installmentAmt.toLocaleString()} SAR</span>
                                                            </div>
                                                            <div className="flex justify-between text-[10px] font-bold">
                                                                <span className="text-emerald-600">{t('entry.alreadyPaid')}</span>
                                                                <span className="text-emerald-700">{leaseInstallmentInfo.paidThisInstallment.toLocaleString()} SAR</span>
                                                            </div>
                                                            <div className="w-full bg-white/70 rounded-full h-1.5 mt-1">
                                                                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (leaseInstallmentInfo.paidThisInstallment / leaseInstallmentInfo.installmentAmt) * 100)}%` }}></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Installment Timeline (compact) */}
                                            {installments.length > 0 && installments.length <= 24 && (
                                                <div className="relative">
                                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('entry.installmentTimeline')}</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {installments.map(inst => (
                                                            <div
                                                                key={inst.no}
                                                                title={`#${inst.no}: ${inst.paid.toLocaleString()} / ${inst.total.toLocaleString()} SAR`}
                                                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black border transition-all cursor-default ${
                                                                    inst.status === 'paid' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-200' :
                                                                    inst.status === 'partial' ? 'bg-gradient-to-br from-teal-400 to-cyan-500 text-white border-teal-500 shadow-sm shadow-teal-200 ring-2 ring-teal-300 ring-offset-1' :
                                                                    inst.status === 'current' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-200 ring-2 ring-emerald-300 ring-offset-1 animate-pulse' :
                                                                    'bg-white/60 text-slate-400 border-slate-200'
                                                                }`}
                                                            >
                                                                {inst.status === 'paid' ? 'OK' : inst.no}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-2 text-[8px] sm:text-[9px] text-slate-500">
                                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>{t('tenant.paidAmount')}</span>
                                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-teal-400 to-cyan-500 inline-block"></span> {t('entry.legendPartial')}</span>
                                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> {t('entry.legendCurrent')}</span>
                                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white border border-slate-200 inline-block"></span> {t('entry.legendUpcoming')}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recent Payments */}
                                            {prevPayments.length > 0 && (
                                                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/50">
                                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('entry.recentPaymentsLabel')}</div>
                                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                                        {[...prevPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(p => (
                                                            <div key={p.id} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-100 last:border-0">
                                                                <span className="text-slate-500 font-medium">{fmtDate(p.date)}</span>
                                                                <span className="font-black text-emerald-700">{Number(p.amount).toLocaleString()} SAR</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Lease info row */}
                                            <div className="flex items-center gap-2 text-[9px] text-slate-500 font-medium bg-white/50 rounded-lg px-2.5 py-1.5">
                                                <Calendar size={10} className="text-emerald-500"/>
                                                {lease.leaseStartDate} {'->'} {lease.leaseEndDate}
                                                {monthlyRent > 0 && <span className="ml-auto font-bold text-emerald-600">{monthlyRent.toLocaleString()} SAR/mo</span>}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="space-y-2">
                             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.expenseSource')}</label>
                             <select disabled={!canFullEditEntry && !!id} value={buildingId} onChange={e => { if (e.target.value === 'HEAD_OFFICE') { navigate('/transfers'); return; } setBuildingId(e.target.value); }} className={inputStyle}>
                                <option value="">{t('entry.selectSource')}</option>
                                <option value="HEAD_OFFICE">{t('entry.headOfficeLabel')}</option>
                                {sortedBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <p className="text-[9px] text-slate-400 ml-1">{t('entry.headOfficeDeducts')}</p>
                            {buildingId === 'HEAD_OFFICE' && headOfficeBalance !== null && headOfficeBalance <= 0 && (
                                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl mt-1">
                                    <span className="text-base flex-shrink-0">!</span>
                                    <div>
                                        <p className="text-xs font-black text-rose-700">{t('entry.insufficientHeadOffice')}</p>
                                        <p className="text-[10px] text-rose-600 mt-0.5">{t('entry.currentBalance')}<span className="font-bold">{headOfficeBalance.toLocaleString()} SAR</span>. There is no money available in Head Office treasury.</p>
                                    </div>
                                </div>
                            )}
                            {buildingId === 'HEAD_OFFICE' && headOfficeBalance !== null && headOfficeBalance > 0 && (parseFloat(amount) || 0) > headOfficeBalance && (
                                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl mt-1">
                                    <span className="text-base flex-shrink-0">!</span>
                                    <div>
                                        <p className="text-xs font-black text-rose-700">{t('entry.amountExceedsHeadOffice')}</p>
                                        <p className="text-[10px] text-rose-600 mt-0.5">{t('entry.available')}<span className="font-bold">{headOfficeBalance.toLocaleString()} SAR</span> - This expense of <span className="font-bold">{(parseFloat(amount) || 0).toLocaleString()} SAR</span> exceeds the treasury balance.</p>
                                    </div>
                                </div>
                            )}
                            {buildingId === 'HEAD_OFFICE' && headOfficeBalance !== null && headOfficeBalance > 0 && (parseFloat(amount) || 0) <= headOfficeBalance && (
                                <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl mt-1">
                                    <span className="text-sm">OK</span>
                                    <p className="text-[10px] text-emerald-700 font-bold">{t('entry.headOfficeBalanceLabel')} {headOfficeBalance.toLocaleString()} SAR</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{t('entry.amount')}</label>
                    <div className="form-with-icon has-prefix">
                        <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] sm:text-xs z-30 bg-white px-1 sm:px-2 rounded" style={{pointerEvents:'none'}}>{t('common.sar')}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={amount}
                                                    onChange={e => setAmount(e.target.value)}
                                                    className={`${inputStyle} text-lg sm:text-xl font-black`}
                                                    placeholder={t('entry.zero')}
                                                    disabled={!!id && !canAdminFullEdit}
                                                />
                    </div>
                </div>
                                                {enteredRemaining !== null && (
                                                        <div className={`text-xs sm:text-sm mt-2 ${enteredRemaining > 0 ? 'text-teal-600' : 'text-emerald-600 font-bold'}`}>
                                                                You entered {Number(amount||0).toLocaleString()} SAR. Remaining for this installment: {enteredRemaining.toLocaleString()} SAR
                                                        </div>
                                                )}

                        {/* Non-residential: allow fee amount entry here (creates a separate feesEntry transaction) */}
                        {!id && type === TransactionType.INCOME && incomeSubType === 'RENTAL' && activeContract && isNonResidentialBuildingForContract(buildings, activeContract as any) && (
                          <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider">Fees collected now (Non‑VAT)</span>
                              {(() => {
                                const ctx = nonResFeePeriodCtx;
                                if (!ctx?.hasConfiguredFees) return null;
                                if (ctx.allPeriodsPaid) {
                                  return (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200 rounded-full px-2 py-1 leading-snug max-w-[min(100%,220px)] text-right">
                                      {t('vat.feesNoNextPeriodBanner')}
                                    </span>
                                  );
                                }
                                const suggested =
                                  ctx.feesRemaining > 0.02 ? ctx.feesRemaining : ctx.nonVatPerInst;
                                if (!(suggested > 0)) return null;
                                return (
                                  <span className="text-[10px] font-black text-sky-700 bg-white border border-sky-200 rounded-full px-2 py-1">
                                    Suggested: {suggested.toLocaleString()} {t('common.sar')}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="form-with-icon has-prefix">
                              <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] sm:text-xs z-30 bg-white px-1 sm:px-2 rounded" style={{pointerEvents:'none'}}>{t('common.sar')}</span>
                              <input
                                type="number"
                                step="0.01"
                                value={nonVatFeesNow}
                                onChange={(e) => setNonVatFeesNow(e.target.value)}
                                className={`${inputStyle} font-black`}
                                placeholder="0"
                              />
                            </div>
                            <p className="text-[10px] text-sky-700 font-semibold">
                              This will save a separate Fees record linked to the contract.
                            </p>
                          </div>
                        )}

                        {/* Property Rent Balance Display */}
                        {leaseEnteredDiff !== null && type === TransactionType.EXPENSE && (expenseCategory === ExpenseCategory.PROPERTY_RENT || expenseCategory === 'Property Rent') && leaseInstallmentInfo && (
                            <div className={`mt-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                                leaseEnteredDiff > 0 
                                    ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-300 shadow-sm shadow-teal-100' 
                                    : leaseEnteredDiff === 0 
                                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 shadow-sm shadow-emerald-100'
                                        : 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300 shadow-sm shadow-violet-100'
                            }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">{leaseEnteredDiff > 0 ? '!' : leaseEnteredDiff === 0 ? 'OK' : 'i'}</span>
                                    <span className="text-xs font-black text-slate-700">
                                        Installment {leaseInstallmentInfo.installmentNo} of {leaseInstallmentInfo.installmentCount}
                                    </span>
                                </div>
                                <div className="space-y-1 text-[10px] sm:text-xs font-bold">
                                    <div className="flex justify-between"><span className="text-slate-500">{t('entry.installmentAmount')}</span><span>{leaseInstallmentInfo.installmentAmt.toLocaleString()} SAR</span></div>
                                    {leaseInstallmentInfo.paidThisInstallment > 0 && <div className="flex justify-between"><span className="text-emerald-600">{t('entry.previouslyPaid')}</span><span className="text-emerald-700">{leaseInstallmentInfo.paidThisInstallment.toLocaleString()} SAR</span></div>}
                                    <div className="flex justify-between"><span className="text-emerald-600">{t('entry.payingNow')}</span><span className="text-emerald-700">{Number(amount || 0).toLocaleString()} SAR</span></div>
                                    <div className="pt-1 border-t border-current/10 flex justify-between font-black">
                                        {leaseEnteredDiff > 0 ? (
                                            <><span className="text-teal-700">{t('entry.balanceAfterThis')}</span><span className="text-teal-700">{leaseEnteredDiff.toLocaleString()} SAR</span></>
                                        ) : leaseEnteredDiff === 0 ? (
                                            <><span className="text-emerald-700">{t('entry.installmentComplete')}</span><span className="text-emerald-700">OK 0 SAR</span></>
                                        ) : (
                                            <><span className="text-violet-700">{t('entry.extraToNext')}</span><span className="text-violet-700">{Math.abs(leaseEnteredDiff).toLocaleString()} SAR</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {carryForwardMsg && (
                            <div className="mt-2 p-2 sm:p-3 bg-violet-50 border border-violet-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold text-violet-800 animate-fadeIn">
                                {carryForwardMsg}
                            </div>
                        )}
                    {vendorVatInfo && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm space-y-1.5">
                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-2">VAT Breakdown (15%)</div>
                            <div className="flex justify-between text-slate-600"><span className="font-medium">{t('entry.exclusive')}</span><span className="font-bold">{vendorVatInfo.exclusive.toLocaleString()} SAR</span></div>
                            <div className="flex justify-between text-amber-700"><span className="font-medium">{t('entry.vat15')}</span><span className="font-bold">{vendorVatInfo.vat.toLocaleString()} SAR</span></div>
                            <div className="flex justify-between text-slate-800 pt-1.5 border-t border-amber-200"><span className="font-black">{t('entry.inclusive')}</span><span className="font-black text-base">{vendorVatInfo.inclusive.toLocaleString()} SAR</span></div>
                        </div>
                    )}
                    {incomeVatInfo && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm space-y-1.5">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-2">VAT Breakdown (15%)</div>
                            <div className="flex justify-between text-slate-600"><span className="font-medium">{t('entry.exclusive')}</span><span className="font-bold">{incomeVatInfo.exclusive.toLocaleString()} SAR</span></div>
                            <div className="flex justify-between text-emerald-700"><span className="font-medium">{t('entry.vat15')}</span><span className="font-bold">{incomeVatInfo.vat.toLocaleString()} SAR</span></div>
                            <div className="flex justify-between text-slate-800 pt-1.5 border-t border-emerald-200"><span className="font-black">{t('entry.inclusive')}</span><span className="font-black text-base">{incomeVatInfo.inclusive.toLocaleString()} SAR</span></div>
                        </div>
                    )}

                 {/* Adjustments & VAT */}
                 <div className="bg-slate-50/50 rounded-3xl p-3 sm:p-6 border border-slate-200">
                     <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-6"><Calculator size={16}/>{t('contract.financialBreakdown')}</h3>

                     {type === TransactionType.INCOME && incomeSubType === 'RENTAL' && activeContract && isNonResidentialBuildingForContract(buildings, activeContract) && (() => {
                       const ac = activeContract;
                       const num = (v: unknown) => Number(v) || 0;
                       const fmtSar = (v: number) => `${v.toLocaleString()} ${t('entry.sar')}`;
                       const feeRows: { label: string; value: number }[] = [
                         { label: t('contract.waterFee'), value: num(ac.waterFee) },
                         { label: t('contract.internetFee'), value: num(ac.internetFee) },
                         { label: t('contract.parkingFee'), value: num(ac.parkingFee) },
                         { label: t('contract.managementFee'), value: num(ac.managementFee) },
                         { label: t('contract.insurance'), value: num(ac.insuranceFee) },
                         { label: t('contract.serviceFee'), value: num(ac.serviceFee) },
                         { label: t('contract.otherFees'), value: num(ac.otherAmount) },
                       ];
                       const officeAmt = num((ac as any).officeFeeAmount);
                       if (officeAmt > 0) feeRows.push({ label: t('contract.officeFeeAmount'), value: officeAmt });
                       const dedAmt = num((ac as any).otherDeduction);
                       if (dedAmt > 0) feeRows.push({ label: t('contract.otherDeduction'), value: dedAmt });
                       return (
                         <div className="mb-5 rounded-xl border border-slate-200/90 bg-white/80 p-3 sm:p-4 space-y-2 shadow-sm">
                           <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                             {t('entry.leaseFeeTotalsFromContract')}
                           </div>
                           <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] sm:text-xs font-semibold text-slate-800">
                             {feeRows.map((row) => (
                               <React.Fragment key={row.label}>
                                 <span className="text-slate-500 font-bold truncate" title={row.label}>{row.label}</span>
                                 <span className="text-end tabular-nums">{fmtSar(row.value)}</span>
                               </React.Fragment>
                             ))}
                           </div>
                           <p className="text-[9px] text-slate-500 font-medium leading-snug pt-1 border-t border-slate-100">
                             {t('entry.leaseFeeTotalsNote')}
                           </p>
                         </div>
                       );
                     })()}
                     
                     {type === TransactionType.EXPENSE && expenseCategory === ExpenseCategory.SALARY ? (
                         <div className="space-y-3">
                             <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 uppercase">{t('entry.bonus')}</label>
                                     <input type="number" min="0" value={bonus} onChange={e => setBonus(e.target.value)} className={whiteInputStyle} readOnly={!canFullEditEntry && !!id} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 uppercase">{t('entry.deduction')}</label>
                                     <input type="number" min="0" value={deduction} onChange={e => setDeduction(e.target.value)} className={whiteInputStyle} readOnly={!canFullEditEntry && !!id} />
                                 </div>
                             </div>
                             {/* Borrowing Deduction from Salary */}
                             {targetEmployeeId && (() => {
                                 const empBorrowTxs = allTransactions.filter(t => (t.type === TransactionType.EXPENSE || (t.type === TransactionType.INCOME && t.borrowingType === 'REPAYMENT')) && (t.expenseCategory === ExpenseCategory.BORROWING || t.expenseCategory === 'Borrowing') && t.employeeId === targetEmployeeId && t.status !== 'REJECTED');
                                 const bTotal = empBorrowTxs.filter(t => t.borrowingType !== 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                 const rTotal = empBorrowTxs.filter(t => t.borrowingType === 'REPAYMENT').reduce((s, t) => s + t.amount, 0);
                                 const outstanding = bTotal - rTotal;
                                 if (outstanding <= 0) return null;
                                 return (
                                     <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                                         <label className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                                             {t('entry.deductFromBorrowingLabel')}
                                             <span className="text-[9px] normal-case text-emerald-500 font-medium ml-1">({t('entry.outstandingBalance')}: {outstanding.toLocaleString()} SAR)</span>
                                         </label>
                                         <input type="number" min="0" max={outstanding} value={borrowDeduction} onChange={e => setBorrowDeduction(e.target.value)} className={whiteInputStyle} placeholder="0" readOnly={!canFullEditEntry && !!id} />
                                         <p className="text-[9px] text-emerald-600 font-medium">{t('entry.deductFromSalaryNote')}</p>
                                     </div>
                                 );
                             })()}
                         </div>
                     ) : (
                         <>
                             <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                 <div>
                                     <label className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">{t('entry.extraCharges')}</label>
                                     <input type="number" min="0" value={extraAmount} onChange={e => setExtraAmount(e.target.value)} className={whiteInputStyle} readOnly={!canFullEditEntry && !!id} />
                                 </div>
                                 <div>
                                     <label className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">{t('entry.discountShort')}</label>
                                     <input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className={whiteInputStyle} readOnly={!canFullEditEntry && !!id} />
                                 </div>
                             </div>
                         </>
                     )}

                     {/* ── VAT Toggle & Invoice Number (editable by admin / staff current-month) ── */}
                     {(canFullEditEntry || !id) && (
                         <div className="mt-4 space-y-3 p-3 rounded-xl bg-slate-100/80 border border-slate-200/70">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                 <input
                                     type="checkbox"
                                     checked={isVATApplicable}
                                     onChange={(e) => setIsVATApplicable(e.target.checked)}
                                     className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                 />
                                 <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                     VAT Applicable (15%)
                                 </span>
                             </label>
                             {isVATApplicable && (
                                 <div className="space-y-1">
                                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                         VAT Invoice Number
                                     </label>
                                     <input
                                         type="text"
                                         value={vatInvoiceNumber}
                                         onChange={(e) => setVatInvoiceNumber(e.target.value)}
                                         className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none"
                                         placeholder="INV-001"
                                     />
                                     <p className="text-[8px] text-slate-400 mt-0.5">Leave blank to auto-generate</p>
                                 </div>
                             )}
                         </div>
                     )}
                     
                     <div className="pt-3 border-t border-slate-200/80 flex justify-between items-end">
                         <span className="text-[9px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">{t('entry.netTotalLabel')} {vatApplicableEffective && '(inc. VAT)'}</span>
                        <span className={`text-lg sm:text-xl font-black ${type === TransactionType.INCOME ? 'text-emerald-700' : 'text-rose-700'}`}>{previewTotal.toLocaleString()} <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold">{t('entry.sar')}</span></span>
                     </div>
                     {previewBorrowDeduction > 0 && (
                         <div className="pt-2 space-y-1 border-t border-dashed border-emerald-200 mt-2">
                             <div className="flex justify-between text-[10px] sm:text-xs text-emerald-700 font-bold">
                                 <span>{t('entry.borrowRepayment')} (auto-created)</span>
                                 <span className="text-emerald-600">{previewBorrowDeduction.toLocaleString()} {t('entry.sar')}</span>
                             </div>
                             <div className="flex justify-between text-[10px] sm:text-xs text-slate-500 font-medium">
                                 <span>{t('entry.salaryPaidToEmployee')}</span>
                                 <span>{previewTotal.toLocaleString()} {t('entry.sar')}</span>
                             </div>
                         </div>
                     )}
                 </div>

                <div className="space-y-2 sm:space-y-3">
                    <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.paymentMethod')}</label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button type="button" onClick={() => setPaymentMethod(PaymentMethod.BANK)} className={`py-3 sm:py-4 rounded-xl font-bold text-[9px] sm:text-xs border flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === PaymentMethod.BANK ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                            <Banknote size={16}/> {t('entry.bankTransfer')}
                        </button>
                        <button type="button" onClick={() => setPaymentMethod(PaymentMethod.CASH)} className={`py-3 sm:py-4 rounded-xl font-bold text-[9px] sm:text-xs border flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === PaymentMethod.CASH ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                            <Banknote size={16}/> {t('entry.cashShort')}
                        </button>
                        <button type="button" onClick={() => setPaymentMethod(PaymentMethod.CHEQUE)} className={`py-3 sm:py-4 rounded-xl font-bold text-[9px] sm:text-xs border flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === PaymentMethod.CHEQUE ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                            <CreditCard size={16}/> {t('entry.chequeShort')}
                        </button>
                    </div>
                </div>

                {paymentMethod === PaymentMethod.BANK && (
                    <div className="space-y-2 sm:space-y-3 animate-fadeIn">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.selectBank')}</label>
                            {currentUser.role === UserRole.ADMIN && (
                                <button type="button" disabled={!!id} onClick={() => setShowAddBank(!showAddBank)} className={`text-[8px] sm:text-[10px] font-bold text-emerald-600 flex items-center gap-1 ${!!id ? 'opacity-50 cursor-not-allowed' : ''}`}><Plus size={10}/> {t('entry.newBank')}</button>
                            )}
                        </div>
                        {showAddBank ? (
                            <div className="p-2 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-200 space-y-2 sm:space-y-3">
                                <input type="text" readOnly={!!id} placeholder={t('entry.bankName')} value={newBankName} onChange={e => setNewBankName(e.target.value)} className={whiteInputStyle} />
                                <input type="text" readOnly={!!id} placeholder={t('entry.iban')} value={newBankIban} onChange={e => setNewBankIban(e.target.value)} className={whiteInputStyle} />
                                <button type="button" disabled={!!id} onClick={handleAddBank} className={`w-full py-2 sm:py-2.5 bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-emerald-600 ${!!id ? 'opacity-50 cursor-not-allowed' : ''}`}>{t('entry.saveBank')}</button>
                            </div>
                        ) : (
                            <div>
                                <select value={bankName} onChange={e => setBankName(e.target.value)} className={inputStyle}>
                                    <option value="">{t('entry.selectBankAccount')}</option>
                                    {banks.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                                </select>
                                {bankName && <div className="text-[8px] sm:text-[10px] text-slate-500 font-mono mt-1 ml-2">{t('entry.ibanShort')} {getSelectedBankIBAN()}</div>}
                            </div>
                        )}
                    </div>
                )}
                
                {paymentMethod === PaymentMethod.CHEQUE && (
                    <div className="space-y-2 sm:space-y-3 animate-fadeIn p-3 sm:p-4 bg-emerald-50/30 rounded-xl border border-emerald-100">
                         <div className="space-y-1 sm:space-y-2">
                             <label className="text-[8px] sm:text-[10px] font-bold text-slate-700 uppercase">{t('entry.chequeNumber')}</label>
                             <input type="text" value={chequeNo} onChange={e => setChequeNo(e.target.value)} className={whiteInputStyle} placeholder={t('entry.chequeExample')} />
                         </div>
                         <div className="space-y-1 sm:space-y-2">
                             <label className="text-[8px] sm:text-[10px] font-bold text-slate-700 uppercase">{t('entry.dueCashDate')}</label>
                             <input type="date" value={chequeDueDate} onChange={e => setChequeDueDate(e.target.value)} className={whiteInputStyle} lang={language === 'ar' ? 'ar-SA' : undefined} />
                         </div>
                    </div>
                )}

                <div className="space-y-2 sm:space-y-3">
                     <label className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('entry.detailsNotes')}</label>
                     <textarea value={details} onChange={e => setDetails(e.target.value)} className={`${inputStyle} h-20 sm:h-24`} placeholder={t('entry.enterDetails')} />
                </div>
            </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                <div className="w-full sm:w-auto bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('entry.previewTotalLabel')}</div>
                    <div className={`text-lg sm:text-xl font-black ${type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {previewTotal.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">{t('entry.sar')}</span>
                    </div>
                </div>
                <div className="w-full sm:w-auto flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/history')}
                        className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
                    >{t('common.cancel')}</button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 rounded-xl text-white font-black text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {id ? 'Update Transaction' : 'Save Transaction'}
                    </button>
                </div>
            </div>
        </div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        danger={confirmDanger}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          closeConfirm();
        }}
        onCancel={closeConfirm}
      />
      <VATQuickEntryModal
        open={showVATModal}
        defaultType={vatModalType}
        onClose={() => setShowVATModal(false)}
        onSaved={() => {
          try { showSuccess('VAT entry saved successfully'); } catch {}
          try { SoundService.play('submit'); } catch {}
        }}
      />
    </div>
  );
}

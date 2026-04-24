
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, TransactionStatus, ExpenseCategory, PaymentMethod, User, Bank, Building } from '../types';
import { getTransactions, getUsers, saveTransaction, deleteTransaction, getSettings, getBuildings } from '../services/firestoreService';
import { useToast } from './Toast';
import SoundService from '../services/soundService';
import { Wallet, ArrowDownCircle, ArrowUpCircle, UserCircle, Search, ChevronDown, ChevronUp, Plus, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Printer, X, Banknote, CreditCard, Calendar, FileText, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fmtDate } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

interface BorrowingTrackerProps {
  currentUser: User;
}

interface EmployeeBorrowing {
  employeeId: string;
  employeeName: string;
  totalBorrowed: number;
  totalRepaid: number;
  outstanding: number;
  transactions: Transaction[];
  lastBorrowDate: string;
}

const BorrowingTracker: React.FC<BorrowingTrackerProps> = ({ currentUser }) => {
    // State needed for borrowingData
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
  // Helper: fuzzy match name against employees list (handles typos)
  const findEmployeeByFuzzyName = (name: string): User | undefined => {
    if (!name) return undefined;
    const lowerName = name.toLowerCase().trim();
    // Exact match first
    let emp = employees.find(e => e.name?.toLowerCase() === lowerName);
    if (emp) return emp;
    // Try contains match (SIHAB matches SHIHAB)
    emp = employees.find(e => {
      const empLower = e.name?.toLowerCase() || '';
      return empLower.includes(lowerName) || lowerName.includes(empLower);
    });
    if (emp) return emp;
    // Try similarity - if most characters match (handles typos like SIHAB vs SHIHAB)
    emp = employees.find(e => {
      const empLower = e.name?.toLowerCase() || '';
      if (Math.abs(empLower.length - lowerName.length) > 2) return false;
      let matches = 0;
      const shorter = lowerName.length <= empLower.length ? lowerName : empLower;
      const longer = lowerName.length > empLower.length ? lowerName : empLower;
      for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
      }
      return matches >= shorter.length - 1; // Allow 1 char difference
    });
    return emp;
  };

  // Compute borrowing data per employee
  const { t, isRTL } = useLanguage();

  const borrowingData: EmployeeBorrowing[] = useMemo(() => {
    // Include both EXPENSE (new borrowings) and INCOME (repayments) with Borrowing category
    // Filter by current user's building (staff only see their building's borrowings)
    const isAdminOrManager = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
    const userBuildingIds = currentUser.buildingIds || (currentUser.buildingId ? [currentUser.buildingId] : []);
    
    // Build a set of employee IDs that belong to user's building(s)
    const buildingEmployeeIds = new Set<string>();
    const buildingEmployeeNames = new Set<string>();
    if (!isAdminOrManager && userBuildingIds.length > 0) {
      employees.forEach(emp => {
        const empBuildingIds = emp.buildingIds || (emp.buildingId ? [emp.buildingId] : []);
        if (empBuildingIds.some(bid => userBuildingIds.includes(bid))) {
          buildingEmployeeIds.add(emp.id);
          if ((emp as any).uid) buildingEmployeeIds.add((emp as any).uid);
          if (emp.name) buildingEmployeeNames.add(emp.name.toLowerCase());
        }
      });
    }
    
    // Also add current user's own ID and name so they always see their own borrowings
    buildingEmployeeIds.add(currentUser.id);
    if ((currentUser as any).uid) buildingEmployeeIds.add((currentUser as any).uid);
    if (currentUser.name) buildingEmployeeNames.add(currentUser.name.toLowerCase());
    
    // Also find current user's employee record to get their proper employee name
    // Try multiple ways to find the employee: by ID, uid, name, or email match
    let currentUserEmp = employees.find(e => 
      e.id === currentUser.id || 
      (e as any).uid === currentUser.id ||
      (e.name && currentUser.name && e.name.toLowerCase() === currentUser.name.toLowerCase()) ||
      (e.email && currentUser.email && e.email.toLowerCase() === currentUser.email.toLowerCase())
    );
    if (currentUserEmp && currentUserEmp.name) {
      buildingEmployeeNames.add(currentUserEmp.name.toLowerCase());
      buildingEmployeeIds.add(currentUserEmp.id);
      if ((currentUserEmp as any).uid) buildingEmployeeIds.add((currentUserEmp as any).uid);
    }
    
    const borrowTxs = allTransactions.filter(t => {
      const hasValidCategory = (t.expenseCategory === ExpenseCategory.BORROWING || t.expenseCategory === 'Borrowing') &&
                               t.status !== TransactionStatus.REJECTED;
      
      // Admin/Manager see all borrowings
      if (isAdminOrManager) {
        return hasValidCategory;
      }
      
      // For staff: first check if this is their OWN borrowing (should always see own borrowings)
      const txEmpNameLower = t.employeeName?.toLowerCase().trim() || '';
      const userNameLower = currentUser.name?.toLowerCase().trim() || '';
      const empNameLower = currentUserEmp?.name?.toLowerCase().trim() || '';
      const txDetailsLower = t.details?.toLowerCase().trim() || '';
      
      // Normalized names (remove spaces for better matching: "RIYAS 1" == "RIYAS1")
      const txEmpNameNorm = t.employeeName?.toLowerCase().replace(/\s+/g, '') || '';
      const userNameNorm = currentUser.name?.toLowerCase().replace(/\s+/g, '') || '';
      const empNameNorm = currentUserEmp?.name?.toLowerCase().replace(/\s+/g, '') || '';
      
      // Check ID matches
      const idMatch = (t.employeeId === currentUser.id) || 
                      (t.employeeId === (currentUser as any).uid) ||
                      (currentUserEmp && t.employeeId === currentUserEmp.id) ||
                      (currentUserEmp && (currentUserEmp as any).uid && t.employeeId === (currentUserEmp as any).uid);
      
      // Check exact name match (including normalized)
      const exactNameMatch = (txEmpNameLower && userNameLower && txEmpNameLower === userNameLower) ||
                             (txEmpNameLower && empNameLower && txEmpNameLower === empNameLower) ||
                             (txEmpNameNorm && userNameNorm && txEmpNameNorm === userNameNorm) ||
                             (txEmpNameNorm && empNameNorm && txEmpNameNorm === empNameNorm);
      
      // Check partial/contains name match (handles "LATHEEF" matching "ABDUL LATHEEF" etc)
      const partialNameMatch = (txEmpNameLower && userNameLower && (txEmpNameLower.includes(userNameLower) || userNameLower.includes(txEmpNameLower))) ||
                               (txEmpNameLower && empNameLower && (txEmpNameLower.includes(empNameLower) || empNameLower.includes(txEmpNameLower))) ||
                               (txEmpNameNorm && userNameNorm && (txEmpNameNorm.includes(userNameNorm) || userNameNorm.includes(txEmpNameNorm))) ||
                               (txEmpNameNorm && empNameNorm && (txEmpNameNorm.includes(empNameNorm) || empNameNorm.includes(txEmpNameNorm)));
      
      // Check if employeeId contains the name (some systems store name as ID)
      const idContainsName = (t.employeeId && userNameLower && t.employeeId.toLowerCase().includes(userNameLower)) ||
                             (t.employeeId && empNameLower && t.employeeId.toLowerCase().includes(empNameLower));
      
      // Check if details field contains the user's name (e.g. "LATHEEF - Opening balance")
      const detailsContainsName = (txDetailsLower && userNameLower && txDetailsLower.includes(userNameLower)) ||
                                  (txDetailsLower && empNameLower && txDetailsLower.includes(empNameLower));
      
      const isOwnBorrowing = idMatch || exactNameMatch || partialNameMatch || idContainsName || detailsContainsName;
      
      // Staff should ALWAYS see their own borrowings (including own opening balances)
      if (isOwnBorrowing) {
        return hasValidCategory;
      }
      
      // Hide owner opening balances from non-admin users (only if NOT their own)
      const isOwnerOpeningBal = (t as any).isOwnerOpeningBalance === true || ((t as any).ownerId && t.borrowingType === 'OPENING_BALANCE');
      if (isOwnerOpeningBal) {
        return false;
      }
      
      // Staff: only see borrowings from their assigned building(s)
      if (userBuildingIds.length === 0) {
        return false; // Staff with no building assignment sees nothing
      }
      
      // Check if transaction is in user's building
      const isInUserBuilding = t.buildingId && userBuildingIds.includes(t.buildingId);
      if (isInUserBuilding) {
        return hasValidCategory;
      }
      
      // For transactions without buildingId (like opening balances), check if employee belongs to user's building
      const isEmployeeInBuilding = (t.employeeId && buildingEmployeeIds.has(t.employeeId)) ||
                                   (t.employeeName && buildingEmployeeNames.has(t.employeeName.toLowerCase()));
      
      return hasValidCategory && isEmployeeInBuilding;
    });
    
    // Group transactions by employee - merge same employee even with different IDs/name variations
    const byEmployee = new Map<string, Transaction[]>();
    const nameToKey = new Map<string, string>(); // Map normalized name to primary key
    const idToKey = new Map<string, string>(); // Map employeeId to primary key
    
    // Helper to normalize names for grouping (removes spaces, lowercase)
    const normalizeName = (name: string): string => {
      return name.toLowerCase().replace(/\s+/g, '').trim();
    };
    
    // First pass: determine the canonical key for each transaction
    borrowTxs.forEach(tx => {
      const empNameNorm = normalizeName(tx.employeeName || '');
      const eid = tx.employeeId || '';
      
      // Check if we already have a key for this employeeId or name
      let existingKey = (eid && idToKey.get(eid)) || (empNameNorm && nameToKey.get(empNameNorm));
      
      if (existingKey) {
        // Use existing key and update mappings
        if (eid && !idToKey.has(eid)) idToKey.set(eid, existingKey);
        if (empNameNorm && !nameToKey.has(empNameNorm)) nameToKey.set(empNameNorm, existingKey);
      } else {
        // Create new key - prefer employeeId, fallback to name-based key
        const newKey = eid || empNameNorm || 'unknown-' + Math.random().toString(36).substr(2, 9);
        if (eid) idToKey.set(eid, newKey);
        if (empNameNorm) nameToKey.set(empNameNorm, newKey);
        existingKey = newKey;
      }
      
      // Also try to find the employee in the employees list and link all their IDs
      if (empNameNorm) {
        const matchedEmp = employees.find(e => normalizeName(e.name || '') === empNameNorm);
        if (matchedEmp) {
          if (!idToKey.has(matchedEmp.id)) idToKey.set(matchedEmp.id, existingKey);
          if ((matchedEmp as any).uid && !idToKey.has((matchedEmp as any).uid)) {
            idToKey.set((matchedEmp as any).uid, existingKey);
          }
        }
      }
    });
    
    // Second pass: group transactions using the determined keys
    borrowTxs.forEach(tx => {
      const empNameNorm = normalizeName(tx.employeeName || '');
      const eid = tx.employeeId || '';
      
      // Find the key for this transaction
      const key = (eid && idToKey.get(eid)) || (empNameNorm && nameToKey.get(empNameNorm)) || 'unknown';
      
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key)!.push(tx);
    });
    const result: EmployeeBorrowing[] = [];
    byEmployee.forEach((txs, eid) => {
      // Transaction-level building filter already applied above, no need for additional employee check
      
      // Try multiple ways to find employee name
      let empName = '';
      let extractedName = '';
      
      // First check all transactions for stored employeeName
      for (const tx of txs) {
        if (tx.employeeName && tx.employeeName !== 'Unknown') {
          empName = tx.employeeName;
          break;
        }
      }
      // If not found, try to find by id or uid in employees list
      if (!empName) {
        const emp = employees.find(e => 
          e.id === eid || 
          (e as any).uid === eid || 
          e.name === eid
        );
        empName = emp?.name || '';
      }
      // If still not found, try to extract from details field
      if (!empName) {
        for (const tx of txs) {
          if (tx.details) {
            // Details might be something like "SIHAB BORROWED" or "Opening balance - SIHAB"
            // Also handle typos like "BRROWED"
            const match = tx.details.match(/^([A-Za-z\s]+)\s+(B[O]?RR?OW|REPAY|Opening)/i);
            if (match && match[1]) {
              extractedName = match[1].trim();
              break;
            }
            // Try extracting name after dash: "Opening balance - SIHAB"
            const dashMatch = tx.details.match(/[-–]\s*([A-Za-z\s]+)$/i);
            if (dashMatch && dashMatch[1]) {
              extractedName = dashMatch[1].trim();
              break;
            }
          }
        }
        // Try to match extracted name against actual employees (handles typos)
        if (extractedName) {
          const matchedEmp = findEmployeeByFuzzyName(extractedName);
          empName = matchedEmp?.name || extractedName;
        }
      }
      // Last resort - show employeeId if it's not 'unknown'
      if (!empName) {
        empName = eid !== 'unknown' ? eid : 'Unknown';
      }
      let totalBorrowed = 0;
      let totalRepaid = 0;
      let lastBorrowDate = '';
      txs.forEach(tx => {
        if (tx.borrowingType === 'REPAYMENT') {
          totalRepaid += tx.amount;
        } else {
          totalBorrowed += tx.amount;
          if (!lastBorrowDate || new Date(tx.date) > new Date(lastBorrowDate)) {
            lastBorrowDate = tx.date;
          }
        }
      });
      result.push({
        employeeId: eid,
        employeeName: empName,
        totalBorrowed,
        totalRepaid,
        outstanding: totalBorrowed - totalRepaid,
        transactions: txs,
        lastBorrowDate
      });
    });
    return result;
  }, [allTransactions, employees, currentUser.role, currentUser.buildingId, currentUser.buildingIds, currentUser.id, currentUser.name]);

  // Compute borrowing data per employee

  // Summary totals for UI
  const totals = useMemo(() => {
    const totalBorrowed = borrowingData.reduce((s, d) => s + d.totalBorrowed, 0);
    const totalRepaid = borrowingData.reduce((s, d) => s + d.totalRepaid, 0);
    const totalOutstanding = borrowingData.reduce((s, d) => s + d.outstanding, 0);
    const peopleWithDebt = borrowingData.filter(d => d.outstanding > 0).length;
    return { totalBorrowed, totalRepaid, totalOutstanding, peopleWithDebt };
  }, [borrowingData]);

  // Repayment modal state
      const [showRepayModal, setShowRepayModal] = useState(false);
      const [repayEmployee, setRepayEmployee] = useState<EmployeeBorrowing | null>(null);
      const [repayAmount, setRepayAmount] = useState('');
      const [repayDate, setRepayDate] = useState(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
      });
      const [repayMethod, setRepayMethod] = useState(PaymentMethod.CASH);
      const [repayBank, setRepayBank] = useState('');
      const [repayDetails, setRepayDetails] = useState('');

      // Dummy handleRecordRepayment for now (should be replaced with actual logic)
      const handleRecordRepayment = () => {};
    // State for opening balance modal and fields
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [obEmployeeId, setObEmployeeId] = useState('');
    const [obIsExternal, setObIsExternal] = useState(false);
    const [obExternalName, setObExternalName] = useState('');
    const [obAmount, setObAmount] = useState('');
    const [obDetails, setObDetails] = useState('');
    const [obDate, setObDate] = useState(() => {
      const today = new Date();
      return today.toISOString().slice(0, 10);
    });
    const [obBuildingId, setObBuildingId] = useState('');
    const [saving, setSaving] = useState(false);
  // ...existing code...
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDeleteOpeningBalance = (tx: Transaction) => {
    setDeletingTx(tx);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteOpeningBalance = async () => {
    if (!deletingTx) return;
    try {
      await deleteTransaction(deletingTx.id);
      showSuccess('Borrowing entry deleted');
      setShowDeleteConfirm(false);
      setDeletingTx(null);
      await loadData();
    } catch (err) {
      showError('Failed to delete entry');
    }
  };
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Role-based flags
  const isAdminOrManager = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
  const userBuildingIds = currentUser.buildingIds || (currentUser.buildingId ? [currentUser.buildingId] : []);
  const [search, setSearch] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'outstanding' | 'settled'>('all');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empData, txData, bankData, bldgData] = await Promise.all([
          getUsers(),
          getTransactions(),
          getSettings().then(s => s?.banks || []).catch(() => []),
          getBuildings()
        ]);
        setEmployees(empData || []);
        setAllTransactions(txData || []);
        setBanks(bankData || []);
        setBuildings(bldgData || []);
      } catch (err) {
        console.error('Failed to load borrowing data:', err);
        showError('Failed to load borrowing records');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadData = async () => {
    try {
      const [empData, txData, bankData, bldgData] = await Promise.all([
        getUsers(),
        getTransactions(),
        getSettings().then(s => s?.banks || []).catch(() => []),
        getBuildings()
      ]);
      setEmployees(empData || []);
      setAllTransactions(txData || []);
      setBanks(bankData || []);
      setBuildings(bldgData || []);
    } catch (err) {
      console.error('Failed to reload borrowing data:', err);
    }
  };


  // Filtered data for display
  const filteredData = useMemo(() => {
    let data = borrowingData;
    if (filterStatus === 'outstanding') data = data.filter(d => d.outstanding > 0);
    if (filterStatus === 'settled') data = data.filter(d => d.outstanding <= 0);
    if (filterEmployeeId) {
      data = data.filter(d => d.employeeId === filterEmployeeId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => d.employeeName.toLowerCase().includes(q));
    }
    return data;
  }, [borrowingData, filterStatus, filterEmployeeId, search]);
  // Print borrowing summary report (original)
  const handlePrintReport = () => {
    const printWindow = window.open('', 'BORROWING_REPORT', 'height=1200,width=1000');
    if (!printWindow) return;

    const rows = borrowingData.filter(d => d.outstanding > 0).map((d, i) => `
      <tr>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-weight:600">${i + 1}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-weight:700">${d.employeeName}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:right">${d.totalBorrowed.toLocaleString()}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:right; color:#059669">${d.totalRepaid.toLocaleString()}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:800; color:#dc2626">${d.outstanding.toLocaleString()}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; text-align:center; font-size:12px">${fmtDate(d.lastBorrowDate)}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Borrowing Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Tajawal:wght@700;800&display=swap" rel="stylesheet">
      <style>
        :root{--g900:#064e3b;--g700:#047857;--g600:#059669;--g200:#a7f3d0;--g100:#d1fae5;--g50:#ecfdf5;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .page{max-width:210mm;margin:0 auto;padding:15mm;}
        .corner{position:absolute;width:60px;height:60px;border-style:solid;border-color:var(--g200);}
        .corner-tl{top:8mm;left:8mm;border-width:3px 0 0 3px;border-radius:10px 0 0 0;}
        .corner-tr{top:8mm;right:8mm;border-width:3px 3px 0 0;border-radius:0 10px 0 0;}
        .corner-bl{bottom:8mm;left:8mm;border-width:0 0 3px 3px;border-radius:0 0 0 10px;}
        .corner-br{bottom:8mm;right:8mm;border-width:0 3px 3px 0;border-radius:0 0 10px 0;}
        .hdr{background:linear-gradient(135deg,var(--g900),var(--g700),var(--g600));border-radius:14px;padding:24px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
        .hdr-left{display:flex;align-items:center;gap:16px;}
        .logo-circle{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.2);}
        .logo-circle img{width:44px;height:44px;object-fit:contain;}
        .co-ar{font-family:'Tajawal',sans-serif;font-weight:800;font-size:18px;direction:rtl;}
        .co-en{font-size:12px;color:var(--g200);font-weight:600;margin-top:2px;}
        .badge{font-size:22px;font-weight:900;letter-spacing:1px;}
        .summary{display:flex;gap:12px;margin-bottom:24px;}
        .sum-card{flex:1;background:var(--g50);border:1px solid var(--g200);border-radius:10px;padding:14px;text-align:center;}
        .sum-lbl{font-size:9px;font-weight:700;color:var(--g700);text-transform:uppercase;letter-spacing:1px;}
        .sum-val{font-size:18px;font-weight:900;color:var(--g900);margin-top:4px;}
        table{width:100%;border-collapse:collapse;}
        thead{background:linear-gradient(135deg,var(--g900),var(--g700));}
        th{padding:12px 14px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:left;}
        th:nth-child(n+3){text-align:right;}
        th:last-child{text-align:center;}
        .amlak{text-align:center;margin-top:24px;padding-top:14px;border-top:1px solid var(--g100);}
        .amlak img{height:20px;opacity:0.4;}
        .amlak span{display:block;font-size:8px;color:#94a3b8;margin-top:3px;letter-spacing:1px;}
        @page{margin:0;size:A4;}
      </style></head><body>
      <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div><div class="corner corner-br"></div>
      <div class="hdr">
        <div class="hdr-left">
          <div class="logo-circle"><img src="${window.location.origin}/images/logo.png" onerror="this.src='/images/logo.png'"/></div>
          <div><div class="co-ar">شركة أملاك العقارية</div><div class="co-en">Borrowing Summary Report</div></div>
        </div>
        <div class="badge">BORROWING</div>
      </div>
      <div class="summary">
        <div class="sum-card"><div class="sum-lbl">${t('entry.totalBorrowed')}</div><div class="sum-val" style="color:var(--g900)">${totals.totalBorrowed.toLocaleString()} SR</div></div>
        <div class="sum-card"><div class="sum-lbl">${t('entry.totalRepaid')}</div><div class="sum-val" style="color:var(--g600)">${totals.totalRepaid.toLocaleString()} SR</div></div>
        <div class="sum-card"><div class="sum-lbl">${t('borrowing.outstanding')}</div><div class="sum-val" style="color:#dc2626">${totals.totalOutstanding.toLocaleString()} SR</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Employee</th><th style="text-align:right">Borrowed</th><th style="text-align:right">Repaid</th><th style="text-align:right">${t('borrowing.outstanding')}</th><th style="text-align:center">Last Borrow</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
        <div class="amlak"><img src="${window.location.origin}/images/logo.png" onerror="this.style.display='none'"/><span>Powered by Amlak</span></div>
      </div>
      <script>window.onload=function(){setTimeout(function(){var imgs=document.images,c=0,t=imgs.length;if(!t){window.print();return}for(var i=0;i<t;i++){if(imgs[i].complete){if(++c>=t)window.print()}else{imgs[i].onload=imgs[i].onerror=function(){if(++c>=t)window.print()}}}},200);}</script>
    </body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
	printWindow.document.close();
	setSaving(false);
	}

  // Handle opening balance from previous system
  const handleRecordOpeningBalance = async () => {
    if (!obBuildingId || !obAmount || parseFloat(obAmount) <= 0) {
      showError('Select a building and enter a valid amount');
      return;
    }
    if (!obIsExternal && !obEmployeeId) {
      showError('Select an employee or switch to External Person');
      return;
    }
    if (obIsExternal && !obExternalName.trim()) {
      showError('Enter the external person name');
      return;
    }
    SoundService.play('submit');
    const amt = parseFloat(obAmount);
    const empName = obIsExternal ? obExternalName.trim() : (employees.find(e => e.id === obEmployeeId)?.name || 'Unknown');
    const empId = obIsExternal ? ('external_' + obExternalName.trim()) : obEmployeeId;
    const bldg = buildings.find(b => b.id === obBuildingId);
    const buildingName = bldg?.name || '';
    setSaving(true);
    try {
      const tx: Transaction = {
        id: crypto.randomUUID(),
        date: obDate,
        type: TransactionType.EXPENSE,
        amount: amt,
        paymentMethod: PaymentMethod.CASH,
        expenseCategory: ExpenseCategory.BORROWING,
        employeeId: empId,
        employeeName: empName,
        isExternalBorrower: obIsExternal || undefined,
        borrowingType: 'OPENING_BALANCE',
        details: obDetails || `Opening balance from previous system - ${empName} (${buildingName})`,
        buildingId: obBuildingId,
        buildingName: buildingName,
        status: TransactionStatus.APPROVED, // Admin only creates these
        createdAt: Date.now(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      };
      await saveTransaction(tx);
      showSuccess(`Opening balance of ${amt.toLocaleString()} SAR recorded for ${empName}`);
      setShowOpeningModal(false);
      setObAmount('');
      setObDetails('');
      setObEmployeeId('');
      setObBuildingId('');
      setObIsExternal(false);
      setObExternalName('');
      await loadData();
    } catch (err) {
      showError('Failed to save opening balance');
    } finally {
      setSaving(false);
    }
  };


  // Print borrowing debit/credit report
  const handlePrintDebitCreditReport = (employee, showPdfInstructions = false) => {
    const printWindow = window.open('', 'BORROWING_DEBIT_CREDIT', 'height=1200,width=1000');
    if (!printWindow) return;

    // Find all transactions for this employee
    const txs = employee.transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let debitTotal = 0;
    let creditTotal = 0;
    const rows = txs.map((tx, i) => {
      const isCredit = tx.borrowingType === 'REPAYMENT';
      if (isCredit) creditTotal += tx.amount;
      else debitTotal += tx.amount;
      return `<tr>
        <td style="text-align:center;">${fmtDate(tx.date)}</td>
        <td style="font-weight:700; color:#0f172a; text-align:center;">${i + 1}</td>
        <td style="white-space:pre-line; word-break:break-word; max-width:400px; color:#475569;">${tx.details || ''}</td>
        <td style="text-align:center;">${tx.paymentMethod}</td>
        <td class="debit" style="text-align:right;">${isCredit ? '' : tx.amount.toLocaleString()}</td>
        <td class="credit" style="text-align:right;">${isCredit ? tx.amount.toLocaleString() : ''}</td>
      </tr>`;
    }).join('');
    const balance = debitTotal - creditTotal;

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Borrowing Statement</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Tajawal:wght@700;800&display=swap" rel="stylesheet">
      <style>
        :root{--g900:#064e3b;--g700:#047857;--g600:#059669;--g200:#a7f3d0;--g100:#d1fae5;--g50:#ecfdf5;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .page{max-width:210mm;margin:0 auto;padding:15mm;}
        .hdr{background:linear-gradient(135deg,var(--g900),var(--g700));border-radius:14px;padding:24px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;}
        .hdr-left{display:flex;align-items:center;gap:16px;}
        .logo-circle{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.15);}
        .logo-circle img{width:40px;height:40px;object-fit:contain;}
        .co-ar{font-family:'Tajawal',sans-serif;font-weight:700;font-size:20px;direction:rtl;}
        .co-en{font-size:12px;color:var(--g200);font-weight:600;margin-top:2px;letter-spacing:0.5px;}
        .badge{font-size:18px;font-weight:800;letter-spacing:2px;background:rgba(255,255,255,0.1);padding:6px 14px;border-radius:8px;}
        table{width:100%;border-collapse:collapse;}
        thead{background:var(--g900);}
        th{padding:12px 14px;color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;text-align:center;}
        tbody td{background:#fff;padding:12px 14px;font-size:13px;font-weight:500;vertical-align:middle;color:#334155;border-bottom:1px solid #f1f5f9;}
        td.text-right{text-align:right;}
        td.text-center{text-align:center;}
        td.text-bold{font-weight:700;}
        td.debit, td.credit {font-size:13px !important; font-weight:800;}
        tfoot td {font-size:14px !important;}
        td.debit{color:#ef4444;}
        td.credit{color:#10b981;}
        tfoot td{font-weight:800; background:#f8fafc; border-top:2px solid #e2e8f0; padding:12px 14px; text-align:right;}
        tfoot tr:first-child td{border-top:2px solid #cbd5e1; color:#475569;}
        tfoot tr:last-child td{font-size:15px !important; background:#fff;}
        tfoot td.balance-label{font-weight:900; color:#0f172a; text-transform:uppercase; font-size:14px !important; letter-spacing:0.5px;}
        tfoot td.balance-value{font-size:24px !important; font-weight:900; letter-spacing:0.5px;}
        tfoot td.negative{color:#ef4444 !important;}
        tfoot td.positive{color:#10b981 !important;}
        .amlak{text-align:center;margin-top:40px;padding-top:20px;border-top:1px dashed var(--g200);}
        .amlak img{height:24px;opacity:0.4;}
        .amlak span{display:block;font-size:11px;color:#94a3b8;margin-top:3px;letter-spacing:1px;}
        @page{margin:0;size:A4;}
      </style></head><body>
      <div class="page">
        ${showPdfInstructions ? '<div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:10px 18px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:18px;text-align:center;">To save as PDF, select <b>Save as PDF</b> in the print dialog.</div>' : ''}
        <div class="hdr">
          <div class="hdr-left">
            <div class="logo-circle"><img src="${window.location.origin}/images/cologo.png" onerror="this.src='/images/logo.png'"/></div>
            <div>
              <div class="co-ar">شركة أملاك العقارية</div>
              <div class="co-en">Borrowing Statement</div>
              <div style="font-size:14px; font-weight:700; margin-top:8px; color:#f8fafc;">${t('history.employeeShort')}<span style="color:#fff;">${employee.employeeName || employee.name || ''}</span></div>
            </div>
          </div>
          <div class="badge">STATEMENT</div>
        </div>
        <table>
          <thead><tr><th>${t('common.date')}</th><th>#</th><th>${t('entry.description')}</th><th>${t('history.method')}</th><th>Debit</th><th>Credit</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-right text-bold" style="text-transform:uppercase; letter-spacing:1px; color:#64748b;">${t('common.total')}</td>
              <td class="debit">${debitTotal.toLocaleString()}</td>
              <td class="credit">${creditTotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="4" class="text-right balance-label">${t('tenant.balance')}</td>
              <td colspan="2" class="balance-value ${balance > 0 ? 'negative' : 'positive'}">${Math.abs(balance).toLocaleString()} <span style="font-size:12px;font-weight:700;letter-spacing:0px;">${t('common.sar')}</span></td>
            </tr>
          </tfoot>
        </table>
        <div class="amlak"><img src="${window.location.origin}/images/logo.png" onerror="this.style.display='none'"/><span>Powered by Amlak</span></div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},200);}</script>
    </body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet className="text-emerald-600" size={24} />{t('borrowing.title')}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Track employee borrowings, repayments & outstanding balances</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handlePrintReport} className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-all">
            <Printer size={14} /> Report
          </button>
          {currentUser.role === 'ADMIN' && (
            <button onClick={() => {
              // Auto-set building for staff users
              if (!isAdminOrManager && userBuildingIds.length > 0) {
                setObBuildingId(userBuildingIds[0]);
              }
              setShowOpeningModal(true);
            }} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 flex items-center gap-1.5 shadow-lg shadow-amber-200 transition-all">
              <FileText size={14} /> Opening Balance
            </button>
          )}
          <button onClick={() => navigate('/entry', { state: { prefillCategory: 'Borrowing' } })} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 flex items-center gap-1.5 shadow-lg shadow-emerald-200 transition-all">
            <Plus size={14} />{t('entry.newBorrowing')}</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={14} className="text-rose-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('entry.totalBorrowed')}</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">{totals.totalBorrowed.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle size={14} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('entry.totalRepaid')}</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700">{totals.totalRepaid.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-rose-50 to-white">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-rose-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('borrowing.outstanding')}</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-600">{totals.totalOutstanding.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">{t('common.sar')}</span></div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-center gap-2 mb-1">
            <UserCircle size={14} className="text-amber-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">People w/ Debt</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700">{totals.peopleWithDebt}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-3 sm:p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Staff Dropdown Filter */}
        <div className="relative">
          <UserCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={filterEmployeeId}
            onChange={e => setFilterEmployeeId(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="">All Staff</option>
            {borrowingData.map(emp => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.employeeName} {emp.outstanding > 0 ? `(${emp.outstanding.toLocaleString()})` : '✓'}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by employee name..."
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
          {(['all', 'outstanding', 'settled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all capitalize ${
                filterStatus === f 
                  ? 'bg-white text-emerald-700 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f === 'all' ? 'All' : f === 'outstanding' ? 'Outstanding' : 'Settled'}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List */}
      {filteredData.length === 0 ? (
        <div className="card p-12 text-center">
          <Wallet className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-slate-500 font-bold">No borrowing records found</p>
          <p className="text-xs text-slate-400 mt-1">Create a borrowing entry from the Entry Form to start tracking</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map(emp => {
            const isExpanded = expandedEmployee === emp.employeeId;
            const pct = emp.totalBorrowed > 0 ? Math.min((emp.totalRepaid / emp.totalBorrowed) * 100, 100) : 0;
            
            return (
              <div key={emp.employeeId} className="card overflow-hidden">
                {/* Employee Row */}
                <button
                  onClick={() => setExpandedEmployee(isExpanded ? null : emp.employeeId)}
                  className="w-full p-4 sm:p-5 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-all"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base flex-shrink-0 ${
                    emp.outstanding > 0 ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  }`}>
                    {emp.employeeName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-slate-900 truncate">{emp.employeeName}</span>
                      {emp.employeeId.startsWith('external_') && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded-full">External</span>
                      )}
                      {emp.outstanding <= 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full flex items-center gap-1">
                          <CheckCircle size={10} /> Settled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded-full">
                          {emp.outstanding.toLocaleString()} SAR due
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${emp.outstanding <= 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{pct.toFixed(0)}% repaid</span>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="hidden sm:flex gap-6 text-right">
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Borrowed</div>
                      <div className="text-sm font-bold text-slate-700">{emp.totalBorrowed.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Repaid</div>
                      <div className="text-sm font-bold text-emerald-600">{emp.totalRepaid.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{t('tenant.balance')}</div>
                      <div className={`text-sm font-black ${emp.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {emp.outstanding.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <div className="flex-shrink-0">
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </button>

                {/* Mobile amounts */}
                <div className="sm:hidden px-4 pb-3 flex gap-4 text-center border-t border-slate-50 pt-3">
                  <div className="flex-1"><div className="text-[9px] font-bold text-slate-400">BORROWED</div><div className="text-xs font-bold text-slate-700">{emp.totalBorrowed.toLocaleString()}</div></div>
                  <div className="flex-1"><div className="text-[9px] font-bold text-slate-400">REPAID</div><div className="text-xs font-bold text-emerald-600">{emp.totalRepaid.toLocaleString()}</div></div>
                  <div className="flex-1"><div className="text-[9px] font-bold text-slate-400">BALANCE</div><div className={`text-xs font-black ${emp.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{emp.outstanding.toLocaleString()}</div></div>
                </div>

                {/* Expanded: Transaction History & Actions */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {/* Action buttons */}
                    {emp.outstanding > 0 && (
                      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setRepayEmployee(emp); setRepayAmount(emp.outstanding.toString()); setShowRepayModal(true); }}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-all"
                        >
                          <ArrowUpCircle size={14} /> Record Repayment
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/entry', { state: { prefillCategory: 'Borrowing', prefillEmployee: emp.employeeId } }); }}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-all"
                        >
                          <ArrowDownCircle size={14} /> Add New Borrowing
                        </button>
                      </div>
                    )}

                    {/* Transaction list */}
                    <div className="p-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Transaction History ({emp.transactions.length})</h4>
                      <div className="space-y-2">
                        <div className="flex justify-end mb-2">
                          <button
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-all"
                            onClick={() => handlePrintDebitCreditReport(emp)}
                          >
                            <Printer size={14} /> Print Statement
                          </button>
                        </div>
                        {emp.transactions.map(tx => {
                          const isAdmin = currentUser.role === 'ADMIN';
                          return (
                            <div key={tx.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-100">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                tx.borrowingType === 'REPAYMENT'
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : tx.borrowingType === 'OPENING_BALANCE'
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-rose-100 text-rose-600'
                              }`}>
                                {tx.borrowingType === 'REPAYMENT' ? <TrendingUp size={14} /> : tx.borrowingType === 'OPENING_BALANCE' ? <FileText size={14} /> : <TrendingDown size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${tx.borrowingType === 'REPAYMENT' ? 'text-emerald-700' : tx.borrowingType === 'OPENING_BALANCE' ? 'text-amber-700' : 'text-rose-700'}`}>
                                    {tx.borrowingType === 'REPAYMENT' ? 'Repayment' : tx.borrowingType === 'OPENING_BALANCE' ? 'Opening Balance' : 'Borrowed'}
                                  </span>
                                  {isAdminOrManager && tx.buildingName && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{tx.buildingName}</span>}
                                  <span className="text-[9px] text-slate-400 font-medium">{tx.paymentMethod}</span>
                                </div>
                                {tx.details && <div className="text-[10px] text-slate-400 truncate mt-0.5">{tx.details}</div>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-sm font-black ${tx.borrowingType === 'REPAYMENT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {tx.borrowingType === 'REPAYMENT' ? '+' : '-'}{tx.amount.toLocaleString()}
                                </div>
                                <div className="text-[9px] text-slate-400">{fmtDate(tx.date)}</div>
                              </div>
                              {/* Only admin can edit borrowing transactions */}
                              {isAdmin && (
                                <button
                                  onClick={() => navigate('/entry', { state: { transaction: tx } })}
                                  className="ml-2 p-2 text-amber-500 hover:text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100"
                                  title={t('entry.title')}
                                >
                                  <Pencil size={16}/>
                                </button>
                              )}
                              {/* Only admin can delete borrowing entries */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteOpeningBalance(tx)}
                                  className="ml-1 p-2 text-rose-500 hover:text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100"
                                  title="Delete Entry"
                                >
                                  <Trash2 size={16}/>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Repayment Modal */}
      {showRepayModal && repayEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[12vh] p-4" onClick={() => setShowRepayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Record Repayment</h3>
                <p className="text-emerald-200 text-xs mt-0.5">{repayEmployee.employeeName}</p>
              </div>
              <button onClick={() => setShowRepayModal(false)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Outstanding info */}
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
              <span className="text-xs font-bold text-rose-700">{t('entry.outstandingBalance')}</span>
              <span className="text-lg font-black text-rose-600">{repayEmployee.outstanding.toLocaleString()} <span className="text-[10px] font-medium text-rose-400">{t('common.sar')}</span></span>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repayment Amount (SAR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={repayEmployee.outstanding}
                  value={repayAmount}
                  onChange={e => setRepayAmount(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('entry.zero')}
                  autoFocus
                />
                {repayAmount && parseFloat(repayAmount) === repayEmployee.outstanding && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Full settlement</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.date')}</label>
                <input
                  type="date"
                  value={repayDate}
                  onChange={e => setRepayDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('entry.paymentMethod')}</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button type="button" onClick={() => setRepayMethod(PaymentMethod.CASH)}
                    className={`py-2.5 rounded-lg font-bold text-xs border flex flex-col items-center gap-1 ${repayMethod === PaymentMethod.CASH ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <Banknote size={14} />{t('entry.cashShort')}</button>
                  <button type="button" onClick={() => setRepayMethod(PaymentMethod.BANK)}
                    className={`py-2.5 rounded-lg font-bold text-xs border flex flex-col items-center gap-1 ${repayMethod === PaymentMethod.BANK ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <CreditCard size={14} />{t('history.bank')}</button>
                  <button type="button" onClick={() => setRepayMethod(PaymentMethod.CHEQUE)}
                    className={`py-2.5 rounded-lg font-bold text-xs border flex flex-col items-center gap-1 ${repayMethod === PaymentMethod.CHEQUE ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <FileText size={14} />{t('entry.chequeShort')}</button>
                </div>
              </div>

              {repayMethod === PaymentMethod.BANK && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('history.bank')}</label>
                  <select value={repayBank} onChange={e => setRepayBank(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Select Bank...</option>
                    {banks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes (Optional)</label>
                <input
                  value={repayDetails}
                  onChange={e => setRepayDetails(e.target.value)}
                  placeholder="e.g. Deducted from salary, cash returned..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowRepayModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">{t('common.cancel')}</button>
              <button
                onClick={handleRecordRepayment}
                disabled={saving || !repayAmount || parseFloat(repayAmount) <= 0}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <CheckCircle size={16} />}
                Confirm Repayment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh] p-4" onClick={() => setShowOpeningModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white p-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-bold text-base">Borrowing Opening Balance</h3>
                <p className="text-amber-200 text-xs mt-0.5">Import from previous system</p>
              </div>
              <button onClick={() => setShowOpeningModal(false)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border-b border-amber-100 flex-shrink-0">
              <p className="text-[11px] text-amber-800 font-medium">This records an outstanding borrowing balance from the previous system. It will appear in the staff's account but will <strong>not</strong> count as a company expense.</p>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Building dropdown - only for Admin/Manager */}
              {isAdminOrManager ? (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('entry.building')}</label>
                <select value={obBuildingId} onChange={e => setObBuildingId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" autoFocus>
                  <option value="">{t('contract.selectBuilding')}</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('entry.building')}</label>
                <div className="w-full mt-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700">
                  {buildings.find(b => b.id === obBuildingId)?.name || 'Your Building'}
                </div>
              </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Borrower Type</label>
                <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                  <button type="button" onClick={() => { setObIsExternal(false); setObExternalName(''); }}
                    className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all ${!obIsExternal ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t('nav.staff')}</button>
                  <button type="button" onClick={() => { setObIsExternal(true); setObEmployeeId(''); }}
                    className={`flex-1 py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all ${obIsExternal ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>
                    External Person
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{obIsExternal ? 'Person Name' : 'Employee'}</label>
                {obIsExternal ? (
                  <input
                    type="text"
                    value={obExternalName}
                    onChange={e => setObExternalName(e.target.value)}
                    placeholder="Enter person name..."
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                <select value={obEmployeeId} onChange={e => setObEmployeeId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Select Employee...</option>
                  {employees
                    .filter(emp => {
                      // Filter employees by selected building
                      if (!obBuildingId) return true;
                      const empBuildingIds = emp.buildingIds || (emp.buildingId ? [emp.buildingId] : []);
                      return empBuildingIds.includes(obBuildingId);
                    })
                    .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                )}
                {obIsExternal && <p className="text-[8px] text-orange-500 ml-1 mt-1 font-medium">External person (not a company staff)</p>}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Amount (SAR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={obAmount}
                  onChange={e => setObAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder={t('entry.zero')}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.date')}</label>
                <input
                  type="date"
                  value={obDate}
                  onChange={e => setObDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes (Optional)</label>
                <input
                  value={obDetails}
                  onChange={e => setObDetails(e.target.value)}
                  placeholder="e.g. Balance carried from old system..."
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowOpeningModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">{t('common.cancel')}</button>
              <button
                onClick={handleRecordOpeningBalance}
                disabled={saving || !obBuildingId || (!obIsExternal && !obEmployeeId) || (obIsExternal && !obExternalName.trim()) || !obAmount || parseFloat(obAmount) <= 0}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <CheckCircle size={16} />}
                Save Opening Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Borrowing Entry Confirmation Modal */}
      {showDeleteConfirm && deletingTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-rose-600 to-rose-500 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">Delete {deletingTx.borrowingType === 'REPAYMENT' ? 'Repayment' : deletingTx.borrowingType === 'OPENING_BALANCE' ? 'Opening Balance' : 'Borrowing'}</h3>
                  <p className="text-rose-200 text-xs mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm mb-2">
                  <AlertTriangle size={16} />
                  <span>Are you sure?</span>
                </div>
                <p className="text-xs text-rose-600">
                  Delete {deletingTx.borrowingType === 'REPAYMENT' ? 'repayment' : deletingTx.borrowingType === 'OPENING_BALANCE' ? 'opening balance' : 'borrowing'} of <span className="font-bold">{deletingTx.amount.toLocaleString()} SAR</span> for {deletingTx.employeeName}?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                >{t('common.cancel')}</button>
                <button
                  onClick={confirmDeleteOpeningBalance}
                  className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowingTracker;

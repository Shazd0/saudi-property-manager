import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContracts, getTransactions, getCustomers, getBuildings } from '../services/firestoreService';
import {
  CalendarClock,
  AlertTriangle,
  Printer,
  Search,
  Building2,
  ArrowUpDown,
  Activity,
  RefreshCw,
  Phone,
  Hash,
  Flame,
  TrendingUp,
  Timer,
  BadgeCheck,
  XCircle,
} from 'lucide-react';
import { fmtDate, fmtDateTime, dateToLocalStr } from '../utils/dateFormat';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { getInstallmentStartDates } from '../utils/installmentSchedule';
import { useLanguage } from '../i18n';

type SortField = 'DATE' | 'BUILDING' | 'UNIT' | 'CUSTOMER' | 'AMOUNT' | 'DAYS';
type SortDir = 'ASC' | 'DESC';
type StatusFilter = 'ALL' | 'OVERDUE' | 'UPCOMING';

const alphaNum = (a: string, b: string) =>
  String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });

const Monitoring: React.FC = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);

  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const defaultReportEndDate = (() => {
    const d = new Date(2026, 3, 24);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const { t, isRTL } = useLanguage();

  const [reportUpTo, setReportUpTo] = useState(() => defaultReportEndDate);
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('DAYS');
  const [sortDir, setSortDir] = useState<SortDir>('DESC');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const buildingPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const [cs, txs, custs, blds] = await Promise.all([
        getContracts(),
        getTransactions(),
        getCustomers(),
        getBuildings(),
      ]);
      setContracts(cs || []);
      setTransactions(txs || []);
      setCustomers(custs || []);
      setBuildings(blds || []);
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!showBuildingPicker) return;
      if (buildingPickerRef.current && !buildingPickerRef.current.contains(e.target as Node)) {
        setShowBuildingPicker(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [showBuildingPicker]);

  const activeContracts = contracts.filter((c) => {
    if (c.status !== 'Active') return false;
    if (selectedBuildingIds.length === 0) return true;
    return selectedBuildingIds.includes(c.buildingId);
  });

  const getInstallmentDueDates = (contract: any): Date[] => {
    return getInstallmentStartDates({
      fromDate: contract.fromDate,
      toDate: contract.toDate,
      periodMonths: Number(contract.periodMonths) || 0,
      periodDays: Number(contract.periodDays) || 0,
      installmentCount: Number(contract.installmentCount) || 1,
    });
  };

  const dueRoomsRaw = activeContracts
    .flatMap((c: any) => {
      try {
        const customer = customers.find((x: any) => x.id === c.customerId) || {};
        const building = buildings.find((b: any) => b.id === c.buildingId) || {};
        const buildingName = building.name
          ? String(building.name).trim()
          : c.buildingName
          ? String(c.buildingName).trim()
          : '-';

        const cutoff = reportUpTo && reportUpTo.trim() ? new Date(reportUpTo) : new Date();
        const today = new Date();

        const totalInstallments = Number(c.installmentCount) > 0 ? Number(c.installmentCount) : 1;
        const upfrontPaid = Number((c as any).upfrontPaid || 0);

        // Filter rent-only payments (exclude FEES entries — those are tracked separately)
        const rentTxs = transactions.filter((tx: any) => {
          if (!tx || tx.contractId !== c.id || tx.status === 'REJECTED') return false;
          if ((tx as any).feesEntry) return false;
          if (!tx.date) return true;
          try {
            const tDate = new Date(tx.date);
            return !isNaN(tDate.getTime()) && tDate <= cutoff;
          } catch {
            return false;
          }
        });
        // INCLUSIVE paid (what the customer actually handed over)
        const paidRawIncl = rentTxs.reduce((s: number, tx: any) => {
          return (
            s +
            (Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount) || 0) +
            (Number((tx as any).discountAmount) || 0) +
            (Number((tx as any).extraAmount) || 0) +
            (Number((tx as any).bonusAmount) || 0) -
            (Number((tx as any).deductionAmount) || 0)
          );
        }, 0);
        // EXCLUSIVE paid (for VAT accounting)
        const paidRawExcl = rentTxs.reduce((s: number, tx: any) => {
          return (
            s +
            (Number(tx.amount) || 0) +
            (Number((tx as any).discountAmount) || 0) +
            (Number((tx as any).extraAmount) || 0) +
            (Number((tx as any).bonusAmount) || 0) -
            (Number((tx as any).deductionAmount) || 0)
          );
        }, 0);
        const paid = paidRawIncl + upfrontPaid;
        const paidExcl = paidRawExcl + upfrontPaid;

        // RENT-ONLY installment amounts (treat rentValue as inclusive of VAT, matching VAT Report)
        const rentValue = Number((c as any).rentValue || 0);
        const isVAT = building?.propertyType === 'NON_RESIDENTIAL' || building?.vatApplicable === true;
        const rentPerInstIncl = totalInstallments > 0 ? rentValue / totalInstallments : 0;
        const first = Math.round(rentPerInstIncl);
        const other = Math.round(rentPerInstIncl);
        const effectiveTotal = rentValue; // inclusive rent total

        // FEES installment amounts (water + internet + parking + management periodic, plus one-time on first)
        const periodicFees = (Number((c as any).waterFee) || 0)
          + (Number((c as any).internetFee) || 0)
          + (Number((c as any).parkingFee) || 0)
          + (Number((c as any).managementFee) || 0);
        const oneTimeFees = (Number((c as any).insuranceFee) || 0)
          + (Number((c as any).serviceFee) || 0)
          + (Number((c as any).officeFeeAmount) || 0)
          + (Number((c as any).otherAmount) || 0)
          - (Number((c as any).otherDeduction) || 0);
        const feesPerInst = totalInstallments > 0 ? periodicFees / totalInstallments : 0;
        const firstFees = Math.round(feesPerInst + oneTimeFees);
        const otherFees = Math.round(feesPerInst);
        const effectiveFeesTotal = periodicFees + oneTimeFees;

        // Paid fees (from feesEntry transactions within cutoff)
        const feePaidRaw = transactions
          .filter((tx: any) => {
            if (!tx || tx.contractId !== c.id || tx.status === 'REJECTED') return false;
            if (!(tx as any).feesEntry) return false;
            if (!tx.date) return true;
            try {
              const tDate = new Date(tx.date);
              return !isNaN(tDate.getTime()) && tDate <= cutoff;
            } catch {
              return false;
            }
          })
          .reduce((s: number, tx: any) => s + (Number(tx.amount) || 0), 0);

        const dueDates = getInstallmentDueDates(c);
        const installments: any[] = [];
        const filterToCutoff = reportUpTo && reportUpTo.trim() ? reportUpTo : null;
        for (let i = 0; i < totalInstallments; i++) {
          const d = dueDates[i];
          if (!d || isNaN(d.getTime())) continue;
          const dStr = dateToLocalStr(d);
          if (filterToCutoff && dStr > filterToCutoff) continue;
          installments.push({
            index: i + 1,
            date: dStr,
            dateObj: d,
            amount: i === 0 ? first : other,
            feesAmount: i === 0 ? firstFees : otherFees,
          });
        }

        // Helper: VAT breakdown (rent is VAT-applicable when building is NON_RESIDENTIAL or vatApplicable)
        const splitVAT = (incl: number) => {
          if (!isVAT) return { incl, excl: incl, vat: 0 };
          const excl = incl / 1.15;
          return { incl, excl, vat: incl - excl };
        };

        const frequencyMonths =
          totalInstallments > 1
            ? Math.max(1, Math.round((Number(c.periodMonths) || 12) / totalInstallments))
            : Math.max(1, Number(c.periodMonths) || 12);
        const mobile = customer.mobileNo || customer.mobile || c.customerMobile || '';

        // --- Build one row per UNPAID installment (rent or fees) ---
        // Track cumulative paid to split payments across installments
        let rentCumulatedBefore = 0;
        let feesCumulatedBefore = 0;

        const contractRows: any[] = [];

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          const rentAmt = inst.amount;
          const feesAmt = inst.feesAmount;

          // Allocate paid rent to this installment (FIFO)
          const rentPaidTowardInst = Math.max(0, Math.min(rentAmt, paid - rentCumulatedBefore));
          const rentRemaining = Math.max(0, rentAmt - rentPaidTowardInst);
          rentCumulatedBefore += rentAmt;

          // Allocate paid fees to this installment (FIFO)
          const feesPaidTowardInst = Math.max(0, Math.min(feesAmt, feePaidRaw - feesCumulatedBefore));
          const feesRemaining = Math.max(0, feesAmt - feesPaidTowardInst);
          feesCumulatedBefore += feesAmt;

          // Skip if nothing remaining for this installment (fully paid)
          if (rentRemaining === 0 && feesRemaining === 0) continue;

          const isPast = inst.dateObj < today;
          const daysPast = isPast
            ? Math.ceil((today.getTime() - inst.dateObj.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          const overdueRent = isPast ? rentRemaining : 0;
          const overdueFees = isPast ? feesRemaining : 0;

          // Due amount = remaining balance for this installment (past or upcoming within the filter window)
          const dueRent = rentRemaining;
          const dueFees = feesRemaining;
          const totalDue = dueRent + dueFees;

          const rentBreakdown = splitVAT(rentAmt);
          const rentPaidBreakdown = splitVAT(rentPaidTowardInst);
          const overdueRentBreakdown = splitVAT(overdueRent);
          const dueRentBreakdown = splitVAT(dueRent);

          // Next upcoming installment date after this one
          let upcomingDueDate = '';
          if (i + 1 < installments.length) {
            upcomingDueDate = installments[i + 1].date;
          } else {
            const fullIdx = dueDates.findIndex(d => d && !isNaN(d.getTime()) && dateToLocalStr(d) === inst.date);
            if (fullIdx >= 0 && fullIdx + 1 < dueDates.length) {
              const up = dueDates[fullIdx + 1];
              if (up && !isNaN(up.getTime())) upcomingDueDate = dateToLocalStr(up);
            }
          }

          contractRows.push({
            contract: c,
            // Installment-specific fields
            installmentNo: inst.index,
            totalInstallments,
            // Rent
            expected: rentAmt,
            expectedExcl: rentBreakdown.excl,
            expectedVat: rentBreakdown.vat,
            paid: rentPaidTowardInst,
            paidExcl: rentPaidBreakdown.excl,
            paidVat: rentPaidBreakdown.vat,
            overdueAmount: overdueRent,
            overdueExcl: overdueRentBreakdown.excl,
            overdueVat: overdueRentBreakdown.vat,
            // Due (remaining balance regardless of past/future)
            dueRent,
            dueRentExcl: dueRentBreakdown.excl,
            dueRentVat: dueRentBreakdown.vat,
            // Fees
            expectedFees: feesAmt,
            paidFees: feesPaidTowardInst,
            feesOverdue: overdueFees,
            dueFees,
            hasFees: feesAmt > 0,
            // Total
            totalOverdue: overdueRent + overdueFees,
            totalDue,
            isVAT,
            customer,
            building,
            buildingName,
            daysOverdue: daysPast,
            mobile,
            nextDueDate: inst.date,
            upcomingDueDate,
            frequencyMonths,
            rowKey: `${c.id}-${inst.index}`,
          });
        }

        return contractRows;
      } catch (err) {
        console.error('Error processing contract in Monitoring:', err, c);
        return [];
      }
    })
    .filter((r: any) => {
      if (!r) return false;
      const nextDueDateStr = r.nextDueDate && r.nextDueDate !== '-' ? r.nextDueDate : null;
      if (!nextDueDateStr) return false;
      return nextDueDateStr <= reportUpTo;
    });

  const soonExpiringRaw = activeContracts
    .map((c: any) => {
      try {
        let diff = 0;
        let toDateStr = '';
        if (c.toDate) {
          try {
            const end = new Date(c.toDate);
            const now = new Date();
            if (!isNaN(end.getTime())) {
              diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              toDateStr = dateToLocalStr(end);
            }
          } catch {
            diff = 0;
            toDateStr = '';
          }
        }
        const customer = customers.find((x: any) => x.id === c.customerId) || {};
        const building = buildings.find((b: any) => b.id === c.buildingId) || {};
        return { contract: c, daysRemaining: diff, customer, building, toDateStr };
      } catch (err) {
        console.error('Error processing expiring contract in Monitoring:', err, c);
        return null;
      }
    })
    .filter((r: any) => {
      if (!r || !r.toDateStr) return false;
      return r.toDateStr <= reportUpTo;
    })
    .filter((r: any) => selectedBuildingIds.length === 0 || selectedBuildingIds.includes(r.contract.buildingId));

  const matchesSearch = (hay: (string | undefined | null)[]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return hay.some((h) => String(h || '').toLowerCase().includes(q));
  };

  const sortDueRows = useCallback((list: any[]) => {
    return [...list].sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case 'DATE':
          cmp = new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
          if (cmp === 0) cmp = b.overdueAmount - a.overdueAmount;
          break;
        case 'BUILDING':
          cmp = alphaNum(a.buildingName, b.buildingName);
          if (cmp === 0) cmp = alphaNum(a.contract?.unitName, b.contract?.unitName);
          break;
        case 'UNIT':
          cmp = alphaNum(a.contract?.unitName, b.contract?.unitName);
          break;
        case 'CUSTOMER': {
          const an = a.customer?.nameEn || a.customer?.name || a.contract?.customerName || '';
          const bn = b.customer?.nameEn || b.customer?.name || b.contract?.customerName || '';
          cmp = alphaNum(an, bn);
          break;
        }
        case 'AMOUNT':
          cmp = (a.overdueAmount || 0) - (b.overdueAmount || 0);
          break;
        case 'DAYS': {
          const aOver = (a.daysOverdue || 0) > 0 ? 1 : 0;
          const bOver = (b.daysOverdue || 0) > 0 ? 1 : 0;
          if (aOver !== bOver) return bOver - aOver;
          cmp = (a.daysOverdue || 0) - (b.daysOverdue || 0);
          if (cmp === 0) cmp = (a.overdueAmount || 0) - (b.overdueAmount || 0);
          break;
        }
      }
      return sortDir === 'ASC' ? cmp : -cmp;
    });
  }, [sortField, sortDir]);

  const dueRoomsAll = useMemo(() => sortDueRows(dueRoomsRaw), [dueRoomsRaw, sortDueRows]);

  const dueRooms = useMemo(() => {
    const filtered = dueRoomsRaw.filter((r: any) => {
      if (!r) return false;
      const name = r.customer?.nameEn || r.customer?.name || r.contract?.customerName;
      if (!matchesSearch([name, r.contract?.unitName, r.buildingName, r.mobile, r.contract?.id])) return false;
      if (statusFilter === 'OVERDUE' && !((r.overdueAmount || 0) + (r.feesOverdue || 0) > 0)) return false;
      if (statusFilter === 'UPCOMING' && ((r.overdueAmount || 0) + (r.feesOverdue || 0)) > 0) return false;
      return true;
    });
    return sortDueRows(filtered);
  }, [dueRoomsRaw, searchQuery, sortField, sortDir, statusFilter, sortDueRows]);

  const sortSoonExpiring = useCallback((list: any[]) => {
    return [...list].sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case 'DATE':
          cmp = (a.daysRemaining || 0) - (b.daysRemaining || 0);
          break;
        case 'BUILDING': {
          const ab = a.building?.name || a.contract?.buildingName || '';
          const bb = b.building?.name || b.contract?.buildingName || '';
          cmp = alphaNum(ab, bb);
          if (cmp === 0) cmp = alphaNum(a.contract?.unitName, b.contract?.unitName);
          break;
        }
        case 'UNIT':
          cmp = alphaNum(a.contract?.unitName, b.contract?.unitName);
          break;
        case 'CUSTOMER': {
          const an = a.customer?.nameEn || a.customer?.name || a.contract?.customerName || '';
          const bn = b.customer?.nameEn || b.customer?.name || b.contract?.customerName || '';
          cmp = alphaNum(an, bn);
          break;
        }
        case 'AMOUNT':
        case 'DAYS':
          cmp = (b.daysRemaining || 0) - (a.daysRemaining || 0);
          break;
      }
      return sortDir === 'ASC' ? cmp : -cmp;
    });
  }, [sortField, sortDir]);

  const soonExpiringAll = useMemo(() => sortSoonExpiring(soonExpiringRaw), [soonExpiringRaw, sortSoonExpiring]);

  const soonExpiring = useMemo(() => {
    const filtered = soonExpiringRaw.filter((r: any) => {
      if (!r) return false;
      const name = r.customer?.nameEn || r.customer?.name || r.contract?.customerName;
      const buildingName = r.building?.name || r.contract?.buildingName;
      return matchesSearch([name, r.contract?.unitName, buildingName, r.customer?.mobileNo, r.customer?.mobile]);
    });
    return sortSoonExpiring(filtered);
  }, [soonExpiringRaw, searchQuery, sortField, sortDir, sortSoonExpiring]);

  const overdueCount = dueRooms.filter((r: any) => (r.overdueAmount || 0) > 0 || (r.feesOverdue || 0) > 0).length;
  const upcomingCount = dueRooms.length - overdueCount;
  const totalOverdueAmount = dueRooms.reduce((s, r: any) => s + (r.totalDue || r.totalOverdue || r.overdueAmount || 0), 0);

  const handleReset = () => {
    setReportUpTo(defaultReportEndDate);
    setSelectedBuildingIds([]);
    setSearchQuery('');
    setSortField('DAYS');
    setSortDir('DESC');
    setStatusFilter('ALL');
  };

  const sortModeLabel = (() => {
    const field =
      sortField === 'DATE'
        ? 'Date'
        : sortField === 'BUILDING'
        ? 'Building'
        : sortField === 'UNIT'
        ? 'Unit'
        : sortField === 'CUSTOMER'
        ? 'Customer'
        : sortField === 'AMOUNT'
        ? 'Amount'
        : 'Days Overdue';
    return `${field} • ${sortDir === 'ASC' ? 'Ascending' : 'Descending'}`;
  })();

  const activeBuildingsLabel =
    selectedBuildingIds.length === 0
      ? 'All Buildings'
      : selectedBuildingIds.length === 1
      ? buildings.find((b) => b.id === selectedBuildingIds[0])?.name || '1 building'
      : `${selectedBuildingIds.length} buildings`;

  return (
    <div className="px-3 sm:px-6 pt-4 pb-10 animate-fade-in max-w-7xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-8 mb-5 shadow-xl shadow-emerald-900/20">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-300/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-[11px] font-black text-white uppercase tracking-widest border border-white/20">
              <Activity className="w-3.5 h-3.5" /> Live
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white flex items-center gap-3 drop-shadow-sm">
              {t('monitoring.insights')}
            </h2>
            <p className="text-emerald-50/90 mt-1 text-sm font-semibold">
              {t('monitoring.fullReportUpTo')} <span className="font-black">{fmtDate(reportUpTo)}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center">
              <div className="text-[10px] font-black text-white/80 uppercase tracking-widest">Overdue</div>
              <div className="text-xl sm:text-2xl font-black text-white">{overdueCount}</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center">
              <div className="text-[10px] font-black text-white/80 uppercase tracking-widest">Upcoming</div>
              <div className="text-xl sm:text-2xl font-black text-white">{upcomingCount}</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 border border-white/20 text-center">
              <div className="text-[10px] font-black text-white/80 uppercase tracking-widest">Expiring</div>
              <div className="text-xl sm:text-2xl font-black text-white">{soonExpiring.length}</div>
            </div>
          </div>
        </div>
        {totalOverdueAmount > 0 && (
          <div className="relative mt-4 bg-white/10 backdrop-blur rounded-2xl border border-white/20 px-4 py-2.5 inline-flex items-center gap-2 text-white">
            <Flame className="w-4 h-4 text-amber-200" />
            <span className="text-xs font-bold">Total Overdue:</span>
            <span className="font-black">{totalOverdueAmount.toLocaleString()} SAR</span>
          </div>
        )}
      </div>

      <div className="premium-card p-4 sm:p-5 mb-5 relative z-30" style={{ isolation: 'isolate' }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Search
            </label>
            <div className="relative">
              <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Customer, unit, building, mobile..."
                className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Report Up To
            </label>
            <input
              type="date"
              value={reportUpTo}
              onChange={(e) => setReportUpTo(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none"
            />
          </div>

          <div className="md:col-span-3 relative" ref={buildingPickerRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Buildings
            </label>
            <button
              type="button"
              onClick={() => setShowBuildingPicker((v) => !v)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white flex items-center justify-between gap-2 hover:border-emerald-400 transition"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{activeBuildingsLabel}</span>
              </span>
              <span
                className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                  selectedBuildingIds.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {selectedBuildingIds.length === 0 ? 'ALL' : selectedBuildingIds.length}
              </span>
            </button>
            {showBuildingPicker && (
              <div className="absolute z-[70] mt-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-full max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Select Buildings
                  </span>
                  <button
                    onClick={() => setSelectedBuildingIds([])}
                    className="text-[10px] font-black text-emerald-600 hover:underline"
                  >
                    CLEAR
                  </button>
                </div>
                {buildings.length === 0 && (
                  <div className="text-xs text-slate-400 px-2 py-3">No buildings found.</div>
                )}
                {buildings.map((b) => {
                  const checked = selectedBuildingIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition ${
                        checked ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedBuildingIds((prev) =>
                            prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id],
                          )
                        }
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-700 truncate">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Sort By
            </label>
            <div className="relative">
              <ArrowUpDown className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none appearance-none`}
              >
                <option value="DATE">Date Wise</option>
                <option value="BUILDING">Building Wise</option>
                <option value="UNIT">Unit Wise</option>
                <option value="CUSTOMER">Customer Name</option>
                <option value="AMOUNT">Amount</option>
                <option value="DAYS">Days Overdue</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Order
            </label>
            <button
              onClick={() => setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-black bg-white hover:bg-slate-50 transition text-emerald-700"
              title="Toggle ascending/descending"
            >
              {sortDir === 'ASC' ? '▲ ASC' : '▼ DESC'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">Status:</span>
          {(
            [
              { id: 'ALL', label: 'All', icon: Hash, cls: 'from-slate-500 to-slate-600' },
              { id: 'OVERDUE', label: 'Overdue', icon: Flame, cls: 'from-rose-500 to-orange-500' },
              { id: 'UPCOMING', label: 'Upcoming', icon: Timer, cls: 'from-sky-500 to-indigo-500' },
            ] as const
          ).map((opt) => {
            const active = statusFilter === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition inline-flex items-center gap-1.5 border ${
                  active
                    ? `bg-gradient-to-r ${opt.cls} text-white border-transparent shadow-md`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}

          <div className="flex-1" />

          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-black inline-flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="premium-card overflow-hidden">
          <div className="relative bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-5 text-white overflow-hidden">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur rounded-2xl p-2.5 border border-white/25">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Installments</div>
                  <div className="text-lg font-black leading-tight">
                    {t('monitoring.installmentsDue').replace('{date}', fmtDate(reportUpTo))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black border border-white/20">
                  {dueRooms.length}
                </span>
                {dueRoomsAll.length > 0 && (
                  <button
                    onClick={() => handleExportPDF(dueRoomsAll, reportUpTo, sortModeLabel, activeBuildingsLabel)}
                    className="px-3 py-1.5 bg-white text-rose-700 rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-rose-50 transition shadow-sm"
                    title="Export all dues (ignores search / status filters)"
                  >
                    <Printer size={14} /> {t('history.exportPdf')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {dueRooms.length === 0 && (
              <div className="text-center py-10">
                <BadgeCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <div className="text-slate-500 font-semibold">
                  {t('monitoring.noInstallments').replace('{date}', fmtDate(reportUpTo))}
                </div>
              </div>
            )}
            {dueRooms.map((r: any) => {
              const isOverdue = (r.overdueAmount > 0) || (r.feesOverdue > 0);
              const initials = ((r.customer.nameEn || r.customer.name || r.contract.customerName || '?') + '')
                .trim()
                .split(/\s+/)
                .map((s: string) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return (
                <div
                  key={r.rowKey || r.contract.id}
                  className={`relative p-3.5 rounded-2xl border-2 transition hover:-translate-y-0.5 hover:shadow-lg ${
                    isOverdue
                      ? 'border-rose-200 bg-gradient-to-br from-rose-50/70 to-white'
                      : 'border-sky-200 bg-gradient-to-br from-sky-50/70 to-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md ${
                        isOverdue
                          ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                          : 'bg-gradient-to-br from-sky-500 to-indigo-500'
                      }`}
                    >
                      {initials || '•'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="font-black text-slate-800 truncate">
                          {formatNameWithRoom(r.customer.nameEn || r.customer.name || r.contract.customerName, r.customer?.roomNumber)}
                        </div>
                        {r.mobile && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <Phone className="w-3 h-3" /> {r.mobile}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <Building2 className="w-3 h-3" /> {r.buildingName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          <Hash className="w-3 h-3" /> {t('monitoring.unit')} {r.contract.unitName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <Timer className="w-3 h-3" /> Every {r.frequencyMonths}mo
                        </span>
                        {r.installmentNo && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            <Hash className="w-3 h-3" /> Inst. {r.installmentNo}/{r.totalInstallments}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-white/80 rounded-lg px-2 py-1 border border-slate-100">
                          <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Next Due</div>
                          <div className="font-bold text-slate-700">{r.nextDueDate ? fmtDate(r.nextDueDate) : '-'}</div>
                          {r.upcomingDueDate && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">
                              Upcoming: <span className="font-bold text-slate-600">{fmtDate(r.upcomingDueDate)}</span>
                            </div>
                          )}
                        </div>
                        <div className="bg-white/80 rounded-lg px-2 py-1 border border-slate-100">
                          <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Rent Expected {r.isVAT ? <span className="text-[8px] text-emerald-600">(incl. VAT)</span> : ''}</div>
                          <div className="font-bold text-slate-700">{Number(r.expected).toLocaleString()}</div>
                          {r.isVAT && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight">
                              {Math.round(r.expectedExcl).toLocaleString()} + VAT {Math.round(r.expectedVat).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="bg-white/80 rounded-lg px-2 py-1 border border-slate-100">
                          <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Rent Paid {r.isVAT ? <span className="text-[8px] text-emerald-600">(incl. VAT)</span> : ''}</div>
                          <div className="font-bold text-emerald-600">{Number(r.paid).toLocaleString()}</div>
                          {r.isVAT && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight">
                              {Math.round(r.paidExcl).toLocaleString()} + VAT {Math.round(r.paidVat).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {r.hasFees && (
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                          <div className={`rounded-lg px-2 py-1 border ${r.feesOverdue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-slate-100'}`}>
                            <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Fees Expected <span className="text-[8px] text-slate-500">(No VAT)</span></div>
                            <div className="font-bold text-slate-700">{Number(r.expectedFees).toLocaleString()}</div>
                          </div>
                          <div className={`rounded-lg px-2 py-1 border ${r.feesOverdue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-slate-100'}`}>
                            <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Fees Paid</div>
                            <div className="font-bold text-emerald-600">{Number(r.paidFees).toLocaleString()}</div>
                          </div>
                          <div className={`rounded-lg px-2 py-1 border ${r.feesOverdue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white/80 border-slate-100'}`}>
                            <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Fees Due</div>
                            <div className={`font-bold ${r.feesOverdue > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{Number(r.feesOverdue).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-end shrink-0">
                      <div
                        className={`font-black text-lg leading-tight ${
                          isOverdue ? 'text-rose-600' : 'text-sky-600'
                        }`}
                      >
                        {Number(r.totalDue || r.totalOverdue || 0).toLocaleString()}
                      </div>
                      {((r.dueRent || 0) > 0 || (r.dueFees || 0) > 0) && (
                        <div className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">
                          {(r.dueRent || 0) > 0 && (
                            <>Rent: {Math.round(r.dueRent).toLocaleString()}{r.isVAT ? ` (Excl ${Math.round(r.dueRentExcl).toLocaleString()} + VAT ${Math.round(r.dueRentVat).toLocaleString()})` : ''}<br/></>
                          )}
                          {(r.dueFees || 0) > 0 && (
                            <>Fees: {Math.round(r.dueFees).toLocaleString()}</>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        SAR {isOverdue ? '· OVERDUE' : '· DUE'}
                      </div>
                      {isOverdue && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          <Flame className="w-3 h-3" /> {r.daysOverdue}d
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="relative bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-5 text-white overflow-hidden">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur rounded-2xl p-2.5 border border-white/25">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Contracts</div>
                  <div className="text-lg font-black leading-tight">
                    {t('monitoring.contractsExpiring').replace('{date}', fmtDate(reportUpTo))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black border border-white/20">
                  {soonExpiring.length}
                </span>
                {soonExpiringAll.length > 0 && (
                  <button
                    onClick={() =>
                      handleExportExpiringPDF(soonExpiringAll, reportUpTo, sortModeLabel, activeBuildingsLabel)
                    }
                    className="px-3 py-1.5 bg-white text-indigo-700 rounded-xl text-xs font-black inline-flex items-center gap-1.5 hover:bg-indigo-50 transition shadow-sm"
                    title="Export all expiring contracts (ignores search filter)"
                  >
                    <Printer size={14} /> {t('history.exportPdf')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {soonExpiring.length === 0 && (
              <div className="text-center py-10">
                <BadgeCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <div className="text-slate-500 font-semibold">
                  {t('monitoring.noContractsExpiring').replace('{date}', fmtDate(reportUpTo))}
                </div>
              </div>
            )}
            {soonExpiring.map((r: any, idx: number) => {
              if (!r || !r.contract) return null;
              const contract = r.contract;
              const customerBaseName = r.customer?.nameEn || r.customer?.name || contract.customerName || '-';
              const customerName = formatNameWithRoom(customerBaseName, r.customer?.roomNumber);
              const buildingName = r.building?.name || contract.buildingName || '-';
              const unitName = contract.unitName || '-';
              const daysRemaining = typeof r.daysRemaining === 'number' ? r.daysRemaining : 0;
              const toDate = contract.toDate ? fmtDate(contract.toDate) : '-';
              const initials = customerName
                .trim()
                .split(/\s+/)
                .map((s: string) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              const urgent = daysRemaining <= 7;
              const soon = daysRemaining <= 30;
              return (
                <div
                  key={contract.id || idx}
                  className={`relative p-3.5 rounded-2xl border-2 transition hover:-translate-y-0.5 hover:shadow-lg ${
                    urgent
                      ? 'border-rose-200 bg-gradient-to-br from-rose-50/70 to-white'
                      : soon
                      ? 'border-amber-200 bg-gradient-to-br from-amber-50/70 to-white'
                      : 'border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md ${
                        urgent
                          ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                          : soon
                          ? 'bg-gradient-to-br from-amber-500 to-yellow-500'
                          : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                      }`}
                    >
                      {initials || '•'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-800 truncate">{customerName}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <Building2 className="w-3 h-3" /> {buildingName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          <Hash className="w-3 h-3" /> {t('monitoring.unit')} {unitName}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {t('monitoring.ends')}: <span className="text-slate-700">{toDate}</span>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div
                        className={`font-black text-2xl leading-none ${
                          urgent ? 'text-rose-600' : soon ? 'text-amber-600' : 'text-indigo-600'
                        }`}
                      >
                        {daysRemaining}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {t('monitoring.days')}
                      </div>
                      {urgent && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          <Flame className="w-3 h-3" /> URGENT
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handleExportPDF(rows: any[], upToDate?: string, sortModeLabel?: string, buildingsLabel?: string) {
  const date = upToDate || new Date().toISOString().split('T')[0];
  const title = `Installments Due (Up To ${fmtDate(date)})`;
  const rowsHtml = rows
    .map(
      (r, idx) => `<tr>
      <td class="tc">${idx + 1}</td>
      <td>${escapeHtml(r.building?.name || r.contract?.buildingName || '-')}</td>
      <td class="tc">${escapeHtml(r.contract?.unitName || '-')}</td>
      <td>${escapeHtml(formatNameWithRoom(r.customer?.nameEn || r.customer?.name || r.contract?.customerName || '-', r.customer?.roomNumber))}</td>
      <td>${escapeHtml(r.mobile || '-')}</td>
      <td class="tr ${(r.overdueAmount > 0 || r.feesOverdue > 0) ? 'overdue' : 'dueUpcoming'}">${Number(r.totalDue || r.totalOverdue || 0).toLocaleString()}${((r.dueRent || 0) > 0 || (r.dueFees || 0) > 0) ? `<div class="sub">${(r.dueRent || 0) > 0 ? `Rent ${Math.round(r.dueRent).toLocaleString()}${r.isVAT ? ` (Excl ${Math.round(r.dueRentExcl).toLocaleString()} · VAT ${Math.round(r.dueRentVat).toLocaleString()})` : ''}` : ''}${(r.dueRent || 0) > 0 && (r.dueFees || 0) > 0 ? ' · ' : ''}${(r.dueFees || 0) > 0 ? `Fees ${Math.round(r.dueFees).toLocaleString()}` : ''}${(r.overdueAmount > 0 || r.feesOverdue > 0) ? ` · <span class="tag-overdue">OVERDUE ${r.daysOverdue}d</span>` : ''}</div>` : ''}</td>
      <td class="tr">${Number(r.expected).toLocaleString()}${r.isVAT ? `<div class="sub">Excl ${Math.round(r.expectedExcl).toLocaleString()} · VAT ${Math.round(r.expectedVat).toLocaleString()}</div>` : ''}${r.hasFees ? `<div class="sub">Fees ${Math.round(r.expectedFees).toLocaleString()}</div>` : ''}</td>
      <td class="tr paid">${Number(r.paid).toLocaleString()}${r.isVAT ? `<div class="sub">Excl ${Math.round(r.paidExcl).toLocaleString()} · VAT ${Math.round(r.paidVat).toLocaleString()}</div>` : ''}${r.hasFees ? `<div class="sub">Fees ${Math.round(r.paidFees).toLocaleString()}</div>` : ''}</td>
      <td class="tc">Every ${r.frequencyMonths}mo</td>
      <td class="tc">${escapeHtml(r.nextDueDate || '-')}${r.installmentNo ? `<div class="sub">Inst. ${r.installmentNo}/${r.totalInstallments}</div>` : ''}${r.upcomingDueDate ? `<div class="sub">Upcoming: ${escapeHtml(fmtDate(r.upcomingDueDate))}</div>` : ''}</td>
      <td class="tc">${r.daysOverdue}</td>
    </tr>`,
    )
    .join('');

  const total = rows.reduce((s: number, r: any) => s + (r.totalDue || r.totalOverdue || r.overdueAmount || 0), 0);

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;padding:24px;background:#f8fafc;margin:0}
      .head{background:linear-gradient(135deg,#059669,#0d9488,#0891b2);color:#fff;padding:22px 24px;border-radius:18px;margin-bottom:18px;box-shadow:0 10px 24px rgba(5,150,105,.25)}
      .head h1{margin:0;font-size:22px;letter-spacing:.3px}
      .head .meta{opacity:.9;font-size:12px;margin-top:6px}
      .pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .pill{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
      .card{background:#fff;border-radius:16px;padding:14px;box-shadow:0 6px 20px rgba(15,23,42,.06);border:1px solid #e2e8f0}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
      th{background:#ecfdf5;color:#065f46;padding:10px 8px;border-bottom:2px solid #10b981;text-align:left;font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.6px}
      td{padding:9px 8px;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even) td{background:#f8fafc}
      .tc{text-align:center}
      .tr{text-align:right;font-weight:700}
      .overdue{color:#e11d48}
      .dueUpcoming{color:#0284c7}
      .paid{color:#059669}
      .sub{font-size:9px;font-weight:600;color:#64748b;margin-top:2px}
      .tag-overdue{background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:999px;font-weight:800}
      tfoot td{background:#064e3b;color:#fff;font-weight:800;padding:12px 8px}
      @media print{body{background:#fff}.card{box-shadow:none}}
    </style>
  </head><body>
    <div class="head">
      <h1>${title}</h1>
      <div class="meta">Generated: ${escapeHtml(fmtDateTime(new Date()))}</div>
      <div class="pills">
        <span class="pill">Sort: ${escapeHtml(sortModeLabel || 'Default')}</span>
        <span class="pill">Buildings: ${escapeHtml(buildingsLabel || 'All')}</span>
        <span class="pill">Total Items: ${rows.length}</span>
      </div>
    </div>
    <div class="card">
    <table>
      <thead><tr>
        <th>#</th><th>Building</th><th>Unit</th><th>Customer</th><th>Mobile</th>
        <th style="text-align:right">Due</th>
        <th style="text-align:right">Expected</th>
        <th style="text-align:right">Paid</th>
        <th>Frequency</th><th>Next Due</th><th>Days Overdue</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td colspan="5" style="text-align:right">TOTAL DUE</td>
        <td class="tr">${total.toLocaleString()} SAR</td>
        <td colspan="5"></td>
      </tr></tfoot>
    </table>
    </div>
    <script>window.onload = () => setTimeout(()=>window.print(),300);</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=1024,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

function handleExportExpiringPDF(rows: any[], upToDate?: string, sortModeLabel?: string, buildingsLabel?: string) {
  const date = upToDate || new Date().toISOString().split('T')[0];
  const title = `Contracts Expiring (Up To ${fmtDate(date)})`;
  const rowsHtml = rows
    .map((r, idx) => {
      const contract = r.contract;
      const buildingName = r.building?.name || contract.buildingName || '-';
      const customerBaseName = r.customer?.nameEn || r.customer?.name || contract.customerName || '-';
      const customerName = formatNameWithRoom(customerBaseName, r.customer?.roomNumber);
      const unitName = contract.unitName || '-';
      const toDate = contract.toDate ? fmtDate(contract.toDate) : '-';
      return `<tr>
      <td class="tc">${idx + 1}</td>
      <td>${escapeHtml(buildingName)}</td>
      <td class="tc">${escapeHtml(unitName)}</td>
      <td>${escapeHtml(customerName)}</td>
      <td>${escapeHtml(r.customer?.mobileNo || r.customer?.mobile || '-')}</td>
      <td class="tc">${escapeHtml(toDate)}</td>
      <td class="tc">${typeof r.daysRemaining === 'number' ? r.daysRemaining : '-'}</td>
    </tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;padding:24px;background:#f8fafc;margin:0}
      .head{background:linear-gradient(135deg,#2563eb,#6366f1,#8b5cf6);color:#fff;padding:22px 24px;border-radius:18px;margin-bottom:18px;box-shadow:0 10px 24px rgba(37,99,235,.25)}
      .head h1{margin:0;font-size:22px;letter-spacing:.3px}
      .head .meta{opacity:.9;font-size:12px;margin-top:6px}
      .pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .pill{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
      .card{background:#fff;border-radius:16px;padding:14px;box-shadow:0 6px 20px rgba(15,23,42,.06);border:1px solid #e2e8f0}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
      th{background:#eef2ff;color:#3730a3;padding:10px 8px;border-bottom:2px solid #6366f1;text-align:left;font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.6px}
      td{padding:9px 8px;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even) td{background:#f8fafc}
      .tc{text-align:center}
      @media print{body{background:#fff}.card{box-shadow:none}}
    </style>
  </head><body>
    <div class="head">
      <h1>${title}</h1>
      <div class="meta">Generated: ${escapeHtml(fmtDateTime(new Date()))}</div>
      <div class="pills">
        <span class="pill">Sort: ${escapeHtml(sortModeLabel || 'Default')}</span>
        <span class="pill">Buildings: ${escapeHtml(buildingsLabel || 'All')}</span>
        <span class="pill">Total Items: ${rows.length}</span>
      </div>
    </div>
    <div class="card">
    <table>
      <thead><tr>
        <th>#</th><th>Building</th><th>Unit</th><th>Customer</th><th>Mobile</th>
        <th>End Date</th><th>Days Remaining</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
    <script>window.onload = () => setTimeout(()=>window.print(),300);</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=1024,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

export default Monitoring;

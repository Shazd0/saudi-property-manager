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
import { fmtDate, fmtDateTime, dateToLocalStr, localDateStr } from '../utils/dateFormat';
import { formatNameWithRoom } from '../utils/customerDisplay';
import { getInstallmentStartDates } from '../utils/installmentSchedule';
import { useLanguage } from '../i18n';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from '../utils/contractTransactionFilter';
import { nonResFeeDueForInstallment } from '../utils/nonResidentialFeeSchedule';
import { getCarriedPriorInstallmentWindow } from '../utils/priorBalanceCarriedInstallment';
import type { Building } from '../types';

type SortField = 'DATE' | 'BUILDING' | 'UNIT' | 'CUSTOMER' | 'AMOUNT' | 'DAYS';
type SortDir = 'ASC' | 'DESC';
type StatusFilter = 'ALL' | 'OVERDUE' | 'UPCOMING';

const alphaNum = (a: string, b: string) =>
  String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });

/** Contract dates may be YYYY-MM-DD strings or Firestore Timestamp-like objects. */
function contractDateToYmd(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : dateToLocalStr(d);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return dateToLocalStr(v);
  if (typeof v === 'object' && v !== null) {
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') {
      try {
        const d = o.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return dateToLocalStr(d);
      } catch {
        /* ignore */
      }
    }
    const sec = typeof o.seconds === 'number' ? o.seconds : typeof o._seconds === 'number' ? o._seconds : NaN;
    if (!Number.isNaN(sec)) {
      const d = new Date(sec * 1000);
      return isNaN(d.getTime()) ? '' : dateToLocalStr(d);
    }
  }
  return '';
}

/** Whole calendar days from startYmd to endYmd (end inclusive as "today"); uses noon local to avoid DST edge cases. */
function wholeCalendarDaysFromYmd(startYmd: string, endYmd: string): number {
  if (!startYmd || !endYmd) return 0;
  const a = new Date(startYmd + 'T12:00:00');
  const b = new Date(endYmd + 'T12:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

const Monitoring: React.FC = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);

  const defaultReportEndDate = localDateStr();

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
        getContracts({ includeDeleted: true }),
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
        const todayYmd = localDateStr();
        const customer = customers.find((x: any) => x.id === c.customerId) || {};
        const building = buildings.find((b: any) => b.id === c.buildingId) || {};
        const buildingName = building.name
          ? String(building.name).trim()
          : c.buildingName
          ? String(c.buildingName).trim()
          : '-';

        const today = new Date();
        /** Payments always counted through today — "Report up to" only limits installment due dates, not paid amounts. */
        const payThroughYmd = todayYmd;

        const totalInstallments = Number(c.installmentCount) > 0 ? Number(c.installmentCount) : 1;
        const upfrontPaid = Number((c as any).upfrontPaid || 0);

        // Rent payments linked to this contract only (same rules as Contracts / Entry / VAT quick entry)
        const catalog = (contracts || []).filter((x: any) => !x.deleted);
        const catalogIncludingDeleted = contracts || [];
        const nonResContract = isNonResidentialBuildingForContract((buildings || []) as Building[], c);

        let priorContractResolved: any;
        const rid = String((c as any).renewedFromId || '').trim();
        if (rid) priorContractResolved = catalogIncludingDeleted.find((x: any) => x.id === rid);
        const priorNoStored = String((c as any).priorLeaseContractNoAtRenewal || '').trim();
        if (!priorContractResolved && priorNoStored) {
          priorContractResolved = catalogIncludingDeleted.find(
            (x: any) =>
              String(x.contractNo || '').trim() === priorNoStored && x.buildingId === c.buildingId,
          );
        }

        const rentTxs = transactions.filter((tx: any) => {
          if (!tx) return false;
          // Residential: no separate feesEntry stream (fees are in installments). Non-res: feesEntry handled in feePaidRaw.
          if ((tx as any).feesEntry) return false;
          if (!transactionAppliesToContract(tx, c, catalog)) return false;
          if (!tx.date) return true;
          const tYmd = contractDateToYmd(tx.date);
          if (!tYmd) return false;
          return tYmd <= payThroughYmd;
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
        let priorO = Math.max(0, Number((c as any).priorLeaseOutstandingAtRenewal) || 0);
        if (
          priorO === 0 &&
          (Number((c as any).priorLeaseEffectiveTotalAtRenewal) > 0 ||
            String((c as any).renewedFromId || '').trim() ||
            String((c as any).priorLeaseContractNoAtRenewal || '').trim())
        ) {
          const eff = Number((c as any).priorLeaseEffectiveTotalAtRenewal) || 0;
          const snapPaid = Number((c as any).priorLeasePaidAtRenewal) || 0;
          if (eff > snapPaid + 0.0001) {
            priorO = Math.round((eff - snapPaid) * 100) / 100;
          }
        }
        // Still no prior row? Match ended lease same unit/customer (often deleted / missing renewedFromId).
        if (!priorContractResolved && priorO > 0) {
          const newFromYmd = contractDateToYmd(c.fromDate);
          const uid = String(c.customerId || '').trim();
          const unit = String(c.unitName || '').trim();
          const bid = c.buildingId;
          const candidates = catalogIncludingDeleted.filter(
            (x: any) =>
              x.id !== c.id &&
              x.buildingId === bid &&
              String(x.unitName || '').trim() === unit &&
              (!uid || String(x.customerId || '').trim() === uid),
          );
          const scored = candidates
            .map((x: any) => ({
              x,
              toY: contractDateToYmd(x.toDate),
              fromY: contractDateToYmd(x.fromDate),
            }))
            .filter((o) => o.toY || o.fromY)
            .filter((o) => !newFromYmd || !o.toY || o.toY <= newFromYmd)
            .sort((a, b) => String(b.toY || b.fromY || '').localeCompare(String(a.toY || a.fromY || '')));
          priorContractResolved = scored[0]?.x;
        }
        /** Payments applied to the new lease schedule after renewal prior balance (same FIFO as Entry). */
        const paidForInstallments = Math.max(0, paid - priorO);

        // RENT-ONLY installment amounts (treat rentValue as inclusive of VAT, matching VAT Report)
        const rentValue = Number((c as any).rentValue || 0);
        const isVAT = building?.propertyType === 'NON_RESIDENTIAL' || building?.vatApplicable === true;
        const rentPerInstIncl = totalInstallments > 0 ? rentValue / totalInstallments : 0;
        const first = Math.round(rentPerInstIncl);
        const other = Math.round(rentPerInstIncl);
        const effectiveTotal = rentValue; // inclusive rent total

        // Residential: use saved installment schedule (same as Entry / computeInstallmentProgress).
        // firstInstallment/otherInstallment already include fees split — do NOT add resFee on top.
        const totalValueStored = Number((c as any).totalValue || 0);
        const effectiveContractTotal = totalValueStored + upfrontPaid;
        let resScheduleFirst = Number((c as any).firstInstallment || 0) + upfrontPaid;
        const resScheduleOther = Number((c as any).otherInstallment || 0);
        const sumSchedule =
          resScheduleFirst + resScheduleOther * Math.max(0, totalInstallments - 1);
        if (
          effectiveContractTotal > 0 &&
          Math.abs(sumSchedule - effectiveContractTotal) > Math.max(5, totalInstallments)
        ) {
          resScheduleFirst = Math.max(
            0,
            effectiveContractTotal - resScheduleOther * Math.max(0, totalInstallments - 1),
          );
        }
        const resScheduleFirstRounded = Math.round(resScheduleFirst);
        const resScheduleOtherRounded = Math.round(resScheduleOther);
        const useResidentialStoredSchedule =
          !nonResContract &&
          (totalValueStored > 0 ||
            Number((c as any).firstInstallment) > 0 ||
            Number((c as any).otherInstallment) > 0);
        // Residential: include contract fees into monitoring schedule so cards/PDF show full amounts.
        // Split fees into:
        // - periodic fees: water/internet/parking (spread across installments)
        // - one-time fees: management (Ejar), office/service/insurance/other - deduction (1st installment only)
        const resFeeDueForInstallment = (contract: any, instNo: number): number => {
          const count = Number(contract.installmentCount) > 0 ? Number(contract.installmentCount) : 1;
          const water = Number(contract.waterFee || 0);
          const internet = Number(contract.internetFee || 0);
          const parking = Number(contract.parkingFee || 0);
          const periodicTotal = water + internet + parking;
          const periodicPerInst = count > 0 ? periodicTotal / count : 0;
          const management = Number(contract.managementFee || 0);
          const office = Number(contract.officeFeeAmount || 0);
          const service = Number(contract.serviceFee || 0);
          const insurance = Number(contract.insuranceFee || 0);
          const other = Number(contract.otherAmount || 0);
          const deduction = Number(contract.otherDeduction || 0);
          const oneTime = management + office + service + insurance + other - deduction;
          const fees = periodicPerInst + (instNo === 1 ? oneTime : 0);
          return Math.max(0, Math.round(fees));
        };

        // Paid fees (feesEntry only; same contract attribution as rent)
        const feePaidRaw = nonResContract
          ? transactions
              .filter((tx: any) => {
                if (!tx) return false;
                if (!(tx as any).feesEntry) return false;
                if (!transactionAppliesToContract(tx, c, catalog)) return false;
                if (!tx.date) return true;
                const tYmd = contractDateToYmd(tx.date);
                if (!tYmd) return false;
                return tYmd <= payThroughYmd;
              })
              .reduce((s: number, tx: any) => s + (Number(tx.amount) || 0), 0)
          : 0;

        const dueDates = getInstallmentDueDates(c);
        const installments: any[] = [];
        const filterToCutoff = reportUpTo && reportUpTo.trim() ? reportUpTo : null;
        for (let i = 0; i < totalInstallments; i++) {
          const d = dueDates[i];
          if (!d || isNaN(d.getTime())) continue;
          const dStr = dateToLocalStr(d);
          const instNo = i + 1;
          let rentAmt: number;
          let feesAmt: number;
          if (nonResContract) {
            rentAmt = i === 0 ? first : other;
            feesAmt = nonResFeeDueForInstallment(c, instNo);
          } else if (useResidentialStoredSchedule) {
            rentAmt = i === 0 ? resScheduleFirstRounded : resScheduleOtherRounded;
            feesAmt = 0;
          } else {
            rentAmt = i === 0 ? first : other;
            feesAmt = resFeeDueForInstallment(c, instNo);
          }
          installments.push({
            index: instNo,
            date: dStr,
            dateObj: d,
            amount: rentAmt,
            feesAmount: feesAmt,
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
        // Track cumulative expected to split payments across installments
        let rentCumulatedBefore = 0;
        let feesCumulatedBefore = 0;
        let totalCumulatedBefore = 0;

        const contractRows: any[] = [];

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          const rentAmt = inst.amount;
          const feesAmt = inst.feesAmount;

          let rentPaidTowardInst = 0;
          let feesPaidTowardInst = 0;
          let rentRemaining = rentAmt;
          let feesRemaining = feesAmt;

          if (nonResContract) {
            // Allocate paid rent to this installment (FIFO)
            rentPaidTowardInst = Math.max(0, Math.min(rentAmt, paidForInstallments - rentCumulatedBefore));
            rentRemaining = Math.max(0, rentAmt - rentPaidTowardInst);
            rentCumulatedBefore += rentAmt;

            // Allocate paid fees to this installment (FIFO) using feesEntry payments
            feesPaidTowardInst = Math.max(0, Math.min(feesAmt, feePaidRaw - feesCumulatedBefore));
            feesRemaining = Math.max(0, feesAmt - feesPaidTowardInst);
            feesCumulatedBefore += feesAmt;
          } else if (useResidentialStoredSchedule) {
            // Installment amounts already include fees (firstInstallment / otherInstallment).
            const instTotal = rentAmt;
            const paidTowardInst = Math.max(0, Math.min(instTotal, paidForInstallments - totalCumulatedBefore));
            const remainingTotal = Math.max(0, instTotal - paidTowardInst);
            totalCumulatedBefore += instTotal;
            rentRemaining = remainingTotal;
            feesRemaining = 0;
            rentPaidTowardInst = Math.max(0, instTotal - remainingTotal);
            feesPaidTowardInst = 0;
          } else {
            // Legacy residential (no stored schedule): rent split + separate fees; one payment stream.
            const instTotal = rentAmt + feesAmt;
            const paidTowardInst = Math.max(0, Math.min(instTotal, paidForInstallments - totalCumulatedBefore));
            const remainingTotal = Math.max(0, instTotal - paidTowardInst);
            totalCumulatedBefore += instTotal;

            if (instTotal > 0) {
              const rentShare = rentAmt / instTotal;
              rentRemaining = Math.round(remainingTotal * rentShare);
              feesRemaining = Math.max(0, Math.round(remainingTotal - rentRemaining));
              rentPaidTowardInst = Math.max(0, Math.round(rentAmt - rentRemaining));
              feesPaidTowardInst = Math.max(0, Math.round(feesAmt - feesRemaining));
            } else {
              rentRemaining = 0;
              feesRemaining = 0;
              rentPaidTowardInst = 0;
              feesPaidTowardInst = 0;
            }
          }

          // Skip if nothing remaining for this installment (fully paid)
          if (rentRemaining === 0 && feesRemaining === 0) continue;

          const isPast = inst.dateObj < today;
          // Report "up to" hides future dues past the horizon — but always keep **overdue** rows so old debt still appears.
          if (filterToCutoff && inst.date > filterToCutoff && !isPast) {
            continue;
          }

          const daysPast = isPast ? Math.max(0, wholeCalendarDaysFromYmd(inst.date, todayYmd)) : 0;

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

          // Fee component for labels/PDF: for bundled residential schedule, show fee breakdown only (not added to due).
          const expectedFeesForRow = nonResContract
            ? feesAmt
            : useResidentialStoredSchedule
              ? resFeeDueForInstallment(c, inst.index)
              : feesAmt;

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
            expectedFees: expectedFeesForRow,
            paidFees: feesPaidTowardInst,
            feesOverdue: overdueFees,
            dueFees,
            // Only show fee amounts in UI/PDF when this installment has a fee component and something is still due on fees.
            hasFees: feesAmt > 0 && Math.round(dueFees || 0) > 0,
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

        const priorRemaining = Math.max(0, priorO - paid);
        const oldLeaseToYmd = priorContractResolved ? contractDateToYmd(priorContractResolved.toDate) : '';
        const oldLeaseFromYmd = priorContractResolved ? contractDateToYmd(priorContractResolved.fromDate) : '';
        const renewalYmd = contractDateToYmd(c.fromDate);
        // Unscoped income resolves only non-deleted contracts — treat the ended lease as active for this lookup only.
        const catalogForPriorPaid = catalogIncludingDeleted.map((x: any) =>
          priorContractResolved && x.id === priorContractResolved.id ? { ...x, deleted: false } : x,
        );
        const carriedWin =
          priorContractResolved && renewalYmd
            ? getCarriedPriorInstallmentWindow({
                priorContract: priorContractResolved,
                renewalYmd,
                buildings: (buildings || []) as Building[],
                catalog: catalogForPriorPaid,
                transactions,
              })
            : null;

        // Primary line: that installment’s period start; else old lease bounds / renewal fallback.
        let priorDueStr = carriedWin
          ? dateToLocalStr(carriedWin.startDate)
          : oldLeaseFromYmd || oldLeaseToYmd || '';
        let priorDateIsRenewalFallback = false;
        if (!priorDueStr && priorO > 0) {
          priorDueStr = contractDateToYmd(c.fromDate);
          priorDateIsRenewalFallback = !!priorDueStr;
        }
        if (!priorDueStr && priorO > 0) {
          priorDueStr = todayYmd;
        }

        let priorOldPeriodLabel = '';
        if (carriedWin) {
          priorOldPeriodLabel = `Inst. ${carriedWin.installmentNo}/${carriedWin.totalInstallments} · ${fmtDate(
            carriedWin.startDate,
          )} ${t('entry.dateRangeMid')} ${fmtDate(carriedWin.endDate)}`;
        } else if (priorContractResolved?.toDate) {
          priorOldPeriodLabel = fmtDate(priorContractResolved.toDate);
        }

        const rowsOut: any[] = [...contractRows];
        if (priorO > 0 && priorRemaining > 0) {
          const instEndYmd = carriedWin ? dateToLocalStr(carriedWin.endDate) : oldLeaseToYmd;
          // Overdue days for prior balance = **ended lease** schedule (installment due / period end / lease end) — not new-contract renewal.
          const oldContractDueYmd =
            carriedWin?.dueDateYmd ||
            (!priorDateIsRenewalFallback && !carriedWin && priorContractResolved
              ? oldLeaseToYmd || oldLeaseFromYmd
              : '');
          const isPastPrior =
            (!!oldContractDueYmd && oldContractDueYmd < todayYmd) ||
            (!!instEndYmd && instEndYmd < todayYmd) ||
            (!!oldLeaseToYmd && oldLeaseToYmd < todayYmd && !carriedWin);
          const daysPastPrior = (() => {
            if (!isPastPrior) return 0;
            if (oldContractDueYmd && oldContractDueYmd < todayYmd) {
              return wholeCalendarDaysFromYmd(oldContractDueYmd, todayYmd);
            }
            if (instEndYmd && instEndYmd < todayYmd) {
              return wholeCalendarDaysFromYmd(instEndYmd, todayYmd);
            }
            if (oldLeaseToYmd && oldLeaseToYmd < todayYmd) {
              return wholeCalendarDaysFromYmd(oldLeaseToYmd, todayYmd);
            }
            return 0;
          })();
          const paidTowardPrior = Math.min(paid, priorO);
          const prBr = splitVAT(priorRemaining);
          const paidPriorBr = splitVAT(paidTowardPrior);
          const expPriorBr = splitVAT(priorO);
          const firstInstDate = installments[0]?.date || '';
          rowsOut.unshift({
            contract: c,
            isPriorLeaseRow: true,
            installmentNo: carriedWin?.installmentNo ?? 0,
            totalInstallments: carriedWin?.totalInstallments ?? totalInstallments,
            expected: priorO,
            expectedExcl: expPriorBr.excl,
            expectedVat: expPriorBr.vat,
            paid: paidTowardPrior,
            paidExcl: paidPriorBr.excl,
            paidVat: paidPriorBr.vat,
            overdueAmount: isPastPrior ? priorRemaining : 0,
            overdueExcl: isPastPrior ? prBr.excl : 0,
            overdueVat: isPastPrior ? prBr.vat : 0,
            dueRent: priorRemaining,
            dueRentExcl: prBr.excl,
            dueRentVat: prBr.vat,
            expectedFees: 0,
            paidFees: 0,
            feesOverdue: 0,
            dueFees: 0,
            hasFees: false,
            totalOverdue: isPastPrior ? priorRemaining : 0,
            totalDue: priorRemaining,
            isVAT,
            customer,
            building,
            buildingName,
            daysOverdue: daysPastPrior,
            mobile,
            nextDueDate: priorDueStr,
            upcomingDueDate: firstInstDate,
            frequencyMonths,
            rowKey: `${c.id}-prior-lease`,
            priorOldPeriodLabel,
            priorDateIsRenewalFallback,
          });
        }

        return rowsOut;
      } catch (err) {
        console.error('Error processing contract in Monitoring:', err, c);
        return [];
      }
    })
    .filter((r: any) => {
      if (!r) return false;
      const nextDueDateStr = r.nextDueDate && r.nextDueDate !== '-' ? r.nextDueDate : null;
      if (!nextDueDateStr) return false;
      // Unpaid prior lease from renewal: always include so it is not dropped by "report up to" vs contract start quirks.
      if (r.isPriorLeaseRow && (Number(r.totalDue) || 0) > 0) return true;
      if ((Number(r.overdueAmount) || 0) + (Number(r.feesOverdue) || 0) > 0) return true;
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
          cmp = String(a.nextDueDate || '').localeCompare(String(b.nextDueDate || ''));
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
                        {r.isPriorLeaseRow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                            <TrendingUp className="w-3 h-3" /> {t('entry.priorLeasePaymentLabel')}
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <Timer className="w-3 h-3" /> Every {r.frequencyMonths}mo
                            </span>
                            {r.installmentNo ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                <Hash className="w-3 h-3" /> Inst. {r.installmentNo}/{r.totalInstallments}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white/80 rounded-lg px-2 py-1 border border-slate-100">
                          <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">
                            {r.isPriorLeaseRow ? t('entry.priorLeasePeriod') : t('monitoring.nextDue')}
                          </div>
                          <div className="font-bold text-slate-700">{r.nextDueDate ? fmtDate(r.nextDueDate) : '-'}</div>
                          {r.isPriorLeaseRow && r.priorDateIsRenewalFallback && (
                            <div className="text-[8px] font-bold text-amber-800 leading-tight mt-0.5">
                              {t('entry.priorLeaseBalanceDue')}
                            </div>
                          )}
                          {r.isPriorLeaseRow && r.priorOldPeriodLabel && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">
                              {r.priorOldPeriodLabel}
                            </div>
                          )}
                          {r.upcomingDueDate && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight mt-0.5">
                              {t('monitoring.upcoming')}: <span className="font-bold text-slate-600">{fmtDate(r.upcomingDueDate)}</span>
                            </div>
                          )}
                        </div>
                        <div
                          className={`rounded-lg px-2 py-1 border ${
                            isOverdue && (r.dueRent || 0) > 0
                              ? 'bg-amber-50/90 border-amber-200'
                              : 'bg-white/80 border-slate-100'
                          }`}
                        >
                          <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">
                            {r.isPriorLeaseRow ? t('entry.priorLeasePaymentLabel') : t('monitoring.rentOutstanding')}
                            {r.isVAT ? <span className="text-[8px] text-sky-600"> ({t('monitoring.inclVat')})</span> : ''}
                          </div>
                          <div className={`font-bold ${(r.dueRent || 0) > 0 ? 'text-sky-700' : 'text-slate-400'}`}>
                            {Math.round(r.dueRent || 0).toLocaleString()}
                          </div>
                          {r.isVAT && (r.dueRent || 0) > 0 && (
                            <div className="text-[9px] font-semibold text-slate-500 leading-tight">
                              {Math.round(r.dueRentExcl).toLocaleString()} + {t('monitoring.vat')} {Math.round(r.dueRentVat).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {r.hasFees && (
                        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
                          <div
                            className={`rounded-lg px-2 py-1 border ${
                              isOverdue && (r.dueFees || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-slate-100'
                            }`}
                          >
                            <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">
                              {t('monitoring.feesExpected')} <span className="text-[8px] text-slate-500">({t('monitoring.noVat')})</span>
                            </div>
                            <div className="font-bold text-slate-700">{Number(r.expectedFees).toLocaleString()}</div>
                          </div>
                          <div
                            className={`rounded-lg px-2 py-1 border ${
                              isOverdue && (r.dueFees || 0) > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white/80 border-slate-100'
                            }`}
                          >
                            <div className="font-black text-slate-400 uppercase tracking-wider text-[9px]">{t('monitoring.feesOutstanding')}</div>
                            <div className={`font-bold ${(r.dueFees || 0) > 0 ? (isOverdue ? 'text-rose-600' : 'text-sky-600') : 'text-slate-400'}`}>
                              {Math.round(r.dueFees || 0).toLocaleString()}
                            </div>
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
                          <Flame className="w-3 h-3" />
                          {r.daysOverdue}d
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
  const rowsSorted = [...rows].sort((a: any, b: any) => {
    const byDate = String(a.nextDueDate || '').localeCompare(String(b.nextDueDate || ''));
    if (byDate !== 0) return byDate;
    return alphaNum(
      String(a.buildingName || a.building?.name || a.contract?.buildingName || ''),
      String(b.buildingName || b.building?.name || b.contract?.buildingName || ''),
    );
  });
  const rowsHtml = rowsSorted
    .map((r, idx) => {
      const isOverdue = (Number(r.overdueAmount) || 0) + (Number(r.feesOverdue) || 0) > 0;
      const rowCls = `data-row ${isOverdue ? 'is-overdue' : 'is-scheduled'}${r.isPriorLeaseRow ? ' is-prior' : ''}`;
      const dueCls = isOverdue ? 'amt-overdue' : 'amt-scheduled';
      const statusSym = r.isPriorLeaseRow ? (isOverdue ? 'P!' : 'P') : isOverdue ? '!' : '\u00B7';
      const statusTitle = r.isPriorLeaseRow
        ? isOverdue
          ? 'Prior lease, overdue'
          : 'Prior lease'
        : isOverdue
          ? 'Overdue'
          : 'Scheduled / upcoming';
      return `<tr class="${rowCls}">
      <td class="tc num">${idx + 1}</td>
      <td class="tc sym-cell" title="${escapeHtml(statusTitle)}">${statusSym}</td>
      <td class="td-strong">${escapeHtml(r.building?.name || r.buildingName || r.contract?.buildingName || '-')}</td>
      <td class="tc td-strong">${escapeHtml(r.contract?.unitName || '-')}</td>
      <td>${escapeHtml(formatNameWithRoom(r.customer?.nameEn || r.customer?.name || r.contract?.customerName || '-', r.customer?.roomNumber))}</td>
      <td class="td-mono">${escapeHtml(r.mobile || '-')}</td>
      <td class="tr ${dueCls}">${Number(r.totalDue || r.totalOverdue || 0).toLocaleString()}<span class="sar"> SAR</span>${(Number(r.dueRent) || 0) > 0 || (Number(r.dueFees) || 0) > 0 ? `<div class="sub">${(Number(r.dueRent) || 0) > 0 ? `Rent ${Math.round(Number(r.dueRent)).toLocaleString()}${r.isVAT ? ` (Excl ${Math.round(Number(r.dueRentExcl)).toLocaleString()} · VAT ${Math.round(Number(r.dueRentVat)).toLocaleString()})` : ''}` : ''}${(Number(r.dueRent) || 0) > 0 && (Number(r.dueFees) || 0) > 0 ? ' · ' : ''}${(Number(r.dueFees) || 0) > 0 ? `Fees ${Math.round(Number(r.dueFees)).toLocaleString()}` : ''}${isOverdue ? ` · <span class="tag-overdue">Overdue ${Number(r.daysOverdue) || 0}d</span>` : ''}</div>` : ''}</td>
      <td class="tr td-muted">${Number(r.expected).toLocaleString()}${r.isVAT ? `<div class="sub">Excl ${Math.round(Number(r.expectedExcl)).toLocaleString()} · VAT ${Math.round(Number(r.expectedVat)).toLocaleString()}</div>` : ''}${r.hasFees ? `<div class="sub">Fees ${Math.round(Number(r.expectedFees)).toLocaleString()}</div>` : ''}</td>
      <td class="tc">${r.isPriorLeaseRow ? '—' : `Every ${r.frequencyMonths}mo`}</td>
      <td class="tc">${escapeHtml(fmtDate(r.nextDueDate || ''))}${r.isPriorLeaseRow ? `<div class="sub">${r.priorOldPeriodLabel ? escapeHtml(r.priorOldPeriodLabel) : 'Old lease (renewal)'}</div>` : r.installmentNo ? `<div class="sub">Inst. ${r.installmentNo}/${r.totalInstallments}</div>` : ''}${r.upcomingDueDate ? `<div class="sub">Upcoming: ${escapeHtml(fmtDate(r.upcomingDueDate))}</div>` : ''}</td>
      <td class="tc"><span class="days-pill ${isOverdue ? 'days-hot' : 'days-cool'}">${r.daysOverdue}</span></td>
    </tr>`;
    })
    .join('');

  const total = rowsSorted.reduce((s: number, r: any) => s + (r.totalDue || r.totalOverdue || r.overdueAmount || 0), 0);
  const overdueCount = rowsSorted.filter(
    (r: any) => (Number(r.overdueAmount) || 0) + (Number(r.feesOverdue) || 0) > 0,
  ).length;
  const priorCount = rowsSorted.filter((r: any) => r.isPriorLeaseRow).length;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&display=swap" rel="stylesheet" />
    <style>
      :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--surface:#ffffff;--accent:#0d9488;--accent2:#059669;--danger:#be123c;--danger-bg:#fff1f2;--cool:#0369a1;--cool-bg:#f0f9ff;--radius:20px}
      *{box-sizing:border-box}
      body{margin:0;padding:28px 20px 40px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,sans-serif;background:linear-gradient(165deg,#ecfdf5 0%,#f8fafc 38%,#f1f5f9 100%);color:var(--ink);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
      .sheet{max-width:1120px;margin:0 auto;background:var(--surface);border-radius:var(--radius);box-shadow:0 25px 50px -12px rgba(15,23,42,.12),0 0 0 1px rgba(15,23,42,.04);overflow:hidden}
      .hero{position:relative;padding:32px 36px 28px;background:linear-gradient(145deg,#042f2e 0%,#0f766e 42%,#115e59 100%);color:#ecfdf5}
      .hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#fbbf24,#34d399,#2dd4bf)}
      .brand-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand img{height:40px;width:auto;object-fit:contain;filter:brightness(0) invert(1) opacity(.92)}
      .eyebrow{font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;opacity:.72}
      .hero h1{margin:6px 0 0;font-size:clamp(20px,2.4vw,26px);font-weight:800;letter-spacing:-.02em;line-height:1.2}
      .hero-sub{margin-top:10px;font-size:13px;font-weight:500;opacity:.88}
      .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
      .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(6px)}
      .chip b{font-weight:800;opacity:1}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 36px;background:linear-gradient(180deg,#f8fafc,#fff);border-bottom:1px solid var(--line)}
      @media(max-width:720px){.summary{grid-template-columns:1fr}}
      .kpi{padding:16px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .kpi-label{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
      .kpi-value{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
      .kpi-value .unit{font-size:12px;font-weight:700;color:var(--muted);margin-left:4px}
      .kpi-note{font-size:11px;color:var(--muted);margin-top:6px;font-weight:500}
      .legend{display:flex;flex-wrap:wrap;gap:16px;padding:14px 36px 0;font-size:11px;font-weight:600;color:var(--muted)}
      .legend span{display:inline-flex;align-items:center;gap:8px}
      .sym-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px}
      .dot{width:10px;height:10px;border-radius:50%}
      .dot-overdue{background:var(--danger)}
      .dot-scheduled{background:var(--cool)}
      .dot-prior{background:#7c3aed}
      .table-wrap{padding:18px 36px 28px;overflow-x:auto}
      .section-h{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
      .table-print{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;border:2px solid #64748b}
      .table-print th,.table-print td{border:1px solid #cbd5e1;padding:8px 6px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word}
      .table-print thead th{text-align:left;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1e293b;background:#e2e8f0;border-bottom:2px solid #64748b;white-space:normal;line-height:1.2}
      .table-print thead th.tc{text-align:center}
      .table-print thead th.tr{text-align:right}
      .table-print tbody td{background:#fff}
      .table-print .sym-cell{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;font-size:13px;line-height:1;padding:8px 4px;white-space:nowrap;width:1%}
      .data-row.is-overdue:not(.is-prior) .sym-cell{color:var(--danger)}
      .data-row.is-scheduled:not(.is-prior) .sym-cell{color:var(--cool)}
      .data-row.is-prior .sym-cell{color:#6d28d9}
      .data-row:hover td{background:#fafafa}
      .data-row td:first-child::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 2px 2px 0}
      .data-row.is-overdue:not(.is-prior) td:first-child::before{background:var(--danger)}
      .data-row.is-prior.is-overdue td:first-child::before{background:linear-gradient(180deg,#6d28d9 0%,#be123c 100%)}
      .data-row.is-prior:not(.is-overdue) td:first-child::before{background:#7c3aed}
      .data-row.is-scheduled:not(.is-prior) td:first-child::before{background:#38bdf8}
      .data-row td{position:relative}
      .data-row td:first-child{padding-left:14px}
      .data-row.is-overdue:not(.is-prior) td{background:linear-gradient(90deg,var(--danger-bg) 0%,transparent 52%)}
      .data-row.is-scheduled:not(.is-prior) td{background:linear-gradient(90deg,var(--cool-bg) 0%,transparent 48%)}
      .data-row.is-prior:not(.is-overdue) td{background:linear-gradient(90deg,#f5f3ff 0%,transparent 48%)}
      .data-row.is-prior.is-overdue td{background:linear-gradient(90deg,#fff1f2 0%,#f5f3ff 42%,transparent 58%)}
      .tc{text-align:center}
      .tr{text-align:right}
      .num{font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted)}
      .td-strong{font-weight:600;color:#1e293b}
      .td-mono{font-variant-numeric:tabular-nums;font-size:11.5px;color:#475569}
      .amt-overdue{color:var(--danger);font-weight:800;font-variant-numeric:tabular-nums}
      .amt-scheduled{color:var(--cool);font-weight:800;font-variant-numeric:tabular-nums}
      .sar{font-size:10px;font-weight:700;opacity:.75;margin-left:2px}
      .td-muted{color:#475569;font-weight:600;font-variant-numeric:tabular-nums}
      .sub{font-size:10px;font-weight:600;color:var(--muted);margin-top:4px;line-height:1.35;max-width:280px;margin-left:auto}
      tr .sub{margin-left:0;margin-right:0}
      .tr .sub{max-width:220px;margin-left:auto;text-align:right}
      .tag-overdue{display:inline-block;margin-top:2px;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;background:#fecdd3;color:#9f1239}
      .days-pill{display:inline-flex;min-width:2rem;justify-content:center;padding:4px 8px;border-radius:8px;font-weight:800;font-size:12px;font-variant-numeric:tabular-nums}
      .days-hot{background:#ffe4e6;color:#9f1239}
      .days-cool{background:#e0f2fe;color:#075985}
      tfoot td{padding:12px 8px;font-weight:800;font-size:12px;background:#0f766e!important;color:#fff!important;border:1px solid #0f766e!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      tfoot .grand{font-size:14px;letter-spacing:-.02em}
      .doc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:16px 36px 22px;font-size:10px;font-weight:600;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
      @media print{
        @page{size:A4 landscape;margin:8mm 10mm}
        body{padding:0!important;background:#fff!important;font-size:10pt}
        .sheet{box-shadow:none!important;border-radius:0!important;max-width:none!important}
        .hero{border-radius:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:14px 18px!important}
        .hero h1{font-size:16pt!important}
        .chips,.hero-sub{display:none!important}
        .summary{grid-template-columns:repeat(3,1fr)!important;padding:10px 14px!important;gap:8px!important}
        .kpi{padding:10px 12px!important}
        .kpi-value{font-size:14pt!important}
        .legend{padding:8px 14px 0!important;font-size:9pt}
        .table-wrap{padding:10px 14px 14px!important}
        .table-print{font-size:8pt!important;border-color:#334155!important}
        .table-print th,.table-print td{border-color:#64748b!important;padding:4px 4px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .table-print thead th{font-size:7pt!important;line-height:1.15!important}
        .table-print .sym-cell{font-size:11pt!important;padding:4px 2px!important}
        .sub{font-size:7pt!important;max-width:none!important}
        .days-pill{padding:2px 5px!important;font-size:8pt!important}
        .data-row td:first-child::before{display:none!important}
        .data-row td:first-child{padding-left:6px!important}
        .data-row td{background:#fff!important}
        .data-row:hover td{background:#fff!important}
        .summary,.kpi,.doc-foot{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        thead{display:table-header-group}
        tfoot{display:table-footer-group}
        tbody tr{page-break-inside:auto;break-inside:auto}
        thead tr,tfoot tr{page-break-inside:avoid;break-inside:avoid}
      }
    </style>
  </head><body>
    <div class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand">
            <img src="/images/cologo.png" alt="" onerror="this.style.display='none'" />
            <div>
              <div class="eyebrow">Monitoring · Collections</div>
              <h1>${escapeHtml(title)}</h1>
              <p class="hero-sub">Outstanding installments and prior lease balances — print or save as PDF.</p>
            </div>
          </div>
        </div>
        <div class="chips">
          <span class="chip">Sort <b>${escapeHtml(sortModeLabel || 'Default')}</b></span>
          <span class="chip">Buildings <b>${escapeHtml(buildingsLabel || 'All')}</b></span>
          <span class="chip">Report date <b>${escapeHtml(fmtDate(date))}</b></span>
          <span class="chip">Generated <b>${escapeHtml(fmtDateTime(new Date()))}</b></span>
        </div>
      </header>
      <section class="summary">
        <div class="kpi">
          <span class="kpi-label">Total due (this view)</span>
          <span class="kpi-value grand">${total.toLocaleString()}<span class="unit">SAR</span></span>
          <p class="kpi-note">Sum of “Due” column for all listed rows.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">Lines on report</span>
          <span class="kpi-value">${rowsSorted.length}</span>
          <p class="kpi-note">${rowsSorted.length - overdueCount} not yet overdue${priorCount ? ` · ${priorCount} prior-lease row${priorCount === 1 ? '' : 's'}` : ''}</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">Overdue lines</span>
          <span class="kpi-value">${overdueCount}</span>
          <p class="kpi-note">Use “Days” + color cues to prioritize follow-up.</p>
        </div>
      </section>
      <div class="legend">
        <span><span class="sym-key">!</span> Overdue</span>
        <span><span class="sym-key">&#183;</span> Scheduled / upcoming</span>
        <span><span class="sym-key">P</span> Prior lease</span>
        <span><span class="sym-key">P!</span> Prior + overdue</span>
        <span style="margin-left:8px;opacity:.85">(Symbol column prints clearly in B/W PDF.)</span>
      </div>
      <div class="table-wrap">
        <p class="section-h">Detail</p>
        <table class="table-print" role="table">
          <colgroup>
            <col style="width:3%" /><col style="width:3.5%" /><col style="width:12%" /><col style="width:7%" /><col style="width:14%" /><col style="width:9%" />
            <col style="width:10%" /><col style="width:10%" /><col style="width:6%" /><col style="width:14%" /><col style="width:5.5%" />
          </colgroup>
          <thead><tr>
            <th class="tc">#</th><th class="tc" title="Status">St</th><th>Building</th><th class="tc">Unit</th><th>Customer</th><th class="tc">Mobile</th>
            <th class="tr">Due</th>
            <th class="tr">Expected</th>
            <th class="tc">Freq</th><th class="tc">Next due</th><th class="tc">Days</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr>
            <td colspan="6" class="tr" style="font-weight:800">Grand total due</td>
            <td class="tr grand">${total.toLocaleString()} SAR</td>
            <td colspan="4" style="opacity:.92;font-weight:600;font-size:11px">All buildings in this export</td>
          </tr></tfoot>
        </table>
      </div>
      <footer class="doc-foot"><span>Amlak · Property management</span><span>Confidential — for internal use</span></footer>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},320)};</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=1120,height=900');
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
      const d = typeof r.daysRemaining === 'number' ? r.daysRemaining : NaN;
      const rowCls = !Number.isFinite(d)
        ? 'data-row is-unknown'
        : d <= 30
          ? 'data-row is-urgent'
          : d <= 90
            ? 'data-row is-soon'
            : 'data-row is-normal';
      const daysCell = Number.isFinite(d)
        ? `<span class="days-pill ${d <= 30 ? 'pill-critical' : d <= 90 ? 'pill-warn' : 'pill-ok'}">${d}</span>`
        : `<span class="days-pill pill-na">—</span>`;
      const tierSym = !Number.isFinite(d) ? '?' : d <= 30 ? 'H' : d <= 90 ? 'M' : 'L';
      const tierTitle = !Number.isFinite(d)
        ? 'No end date'
        : d <= 30
          ? 'Critical: 30 days or less'
          : d <= 90
            ? 'Soon: 31–90 days'
            : 'Later: 91+ days';
      return `<tr class="${rowCls}">
      <td class="tc num">${idx + 1}</td>
      <td class="tc sym-cell" title="${escapeHtml(tierTitle)}">${tierSym}</td>
      <td class="td-strong">${escapeHtml(buildingName)}</td>
      <td class="tc td-strong">${escapeHtml(unitName)}</td>
      <td>${escapeHtml(customerName)}</td>
      <td class="td-mono">${escapeHtml(r.customer?.mobileNo || r.customer?.mobile || '-')}</td>
      <td class="tc td-strong">${escapeHtml(toDate)}</td>
      <td class="tc">${daysCell}</td>
    </tr>`;
    })
    .join('');

  const urgentCount = rows.filter((r: any) => typeof r.daysRemaining === 'number' && r.daysRemaining <= 30).length;
  const soonCount = rows.filter(
    (r: any) => typeof r.daysRemaining === 'number' && r.daysRemaining > 30 && r.daysRemaining <= 90,
  ).length;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&display=swap" rel="stylesheet" />
    <style>
      :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--surface:#fff;--indigo:#4338ca;--violet:#6d28d9;--amber:#d97706;--rose:#be123c;--radius:20px}
      *{box-sizing:border-box}
      body{margin:0;padding:28px 20px 40px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,sans-serif;background:linear-gradient(165deg,#eef2ff 0%,#f8fafc 45%,#faf5ff 100%);color:var(--ink);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}
      .sheet{max-width:960px;margin:0 auto;background:var(--surface);border-radius:var(--radius);box-shadow:0 25px 50px -12px rgba(30,27,75,.14),0 0 0 1px rgba(15,23,42,.04);overflow:hidden}
      .hero{position:relative;padding:32px 36px 28px;background:linear-gradient(135deg,#1e1b4b 0%,#4338ca 38%,#5b21b6 100%);color:#eef2ff}
      .hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#fbbf24,#f472b6,#a78bfa)}
      .brand-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .brand{display:flex;align-items:center;gap:12px}
      .brand img{height:40px;width:auto;object-fit:contain;filter:brightness(0) invert(1) opacity(.9)}
      .eyebrow{font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;opacity:.72}
      .hero h1{margin:6px 0 0;font-size:clamp(20px,2.4vw,26px);font-weight:800;letter-spacing:-.02em;line-height:1.2}
      .hero-sub{margin-top:10px;font-size:13px;font-weight:500;opacity:.88;max-width:52ch}
      .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
      .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22)}
      .chip b{font-weight:800}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 36px;background:linear-gradient(180deg,#f8fafc,#fff);border-bottom:1px solid var(--line)}
      @media(max-width:700px){.summary{grid-template-columns:1fr}}
      .kpi{padding:16px 18px;border-radius:14px;border:1px solid var(--line);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .kpi-label{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
      .kpi-value{font-size:22px;font-weight:800;letter-spacing:-.02em}
      .kpi-note{font-size:11px;color:var(--muted);margin-top:6px;font-weight:500}
      .legend{display:flex;flex-wrap:wrap;gap:16px;padding:14px 36px 0;font-size:11px;font-weight:600;color:var(--muted)}
      .legend span{display:inline-flex;align-items:center;gap:8px}
      .sym-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:1px 6px}
      .dot{width:10px;height:10px;border-radius:50%}
      .dot-c{background:var(--rose)}
      .dot-w{background:var(--amber)}
      .dot-n{background:#22c55e}
      .table-wrap{padding:18px 36px 28px;overflow-x:auto}
      .section-h{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
      .table-print{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px;border:2px solid #64748b}
      .table-print th,.table-print td{border:1px solid #cbd5e1;padding:9px 7px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word}
      .table-print thead th{text-align:left;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1e293b;background:#e0e7ff;border-bottom:2px solid #6366f1;line-height:1.2;white-space:normal}
      .table-print thead th.tc{text-align:center}
      .table-print tbody td{background:#fff;position:relative}
      .table-print .sym-cell{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;font-size:14px;line-height:1;padding:9px 4px;white-space:nowrap;width:1%}
      .data-row.is-urgent .sym-cell{color:var(--rose)}
      .data-row.is-soon .sym-cell{color:var(--amber)}
      .data-row.is-normal .sym-cell{color:#047857}
      .data-row td:first-child::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 2px 2px 0}
      .data-row.is-urgent td:first-child::before{background:var(--rose)}
      .data-row.is-soon td:first-child::before{background:var(--amber)}
      .data-row.is-normal td:first-child::before{background:#34d399}
      .data-row td:first-child{padding-left:14px}
      .data-row.is-urgent td{background:linear-gradient(90deg,#fff1f2 0%,transparent 50%)}
      .data-row.is-soon td{background:linear-gradient(90deg,#fffbeb 0%,transparent 48%)}
      .data-row.is-normal td{background:linear-gradient(90deg,#ecfdf5 0%,transparent 42%)}
      .data-row.is-unknown .sym-cell{color:#64748b}
      .data-row.is-unknown td:first-child::before{background:#94a3b8}
      .data-row.is-unknown td{background:linear-gradient(90deg,#f1f5f9 0%,transparent 40%)}
      .tc{text-align:center}
      .num{font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted)}
      .td-strong{font-weight:600;color:#1e293b}
      .td-mono{font-variant-numeric:tabular-nums;font-size:11.5px;color:#475569}
      .days-pill{display:inline-flex;min-width:2.25rem;justify-content:center;padding:5px 10px;border-radius:10px;font-weight:800;font-size:12px;font-variant-numeric:tabular-nums}
      .pill-critical{background:#ffe4e6;color:#9f1239}
      .pill-warn{background:#fef3c7;color:#92400e}
      .pill-ok{background:#d1fae5;color:#065f46}
      .pill-na{background:#f1f5f9;color:#94a3b8}
      .doc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:16px 36px 22px;font-size:10px;font-weight:600;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
      @media print{
        @page{size:A4 landscape;margin:8mm 10mm}
        body{padding:0!important;background:#fff!important;font-size:10pt}
        .sheet{box-shadow:none!important;border-radius:0!important;max-width:none!important}
        .hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:14px 18px!important}
        .hero h1{font-size:16pt!important}
        .chips,.hero-sub{display:none!important}
        .summary{grid-template-columns:repeat(3,1fr)!important;padding:10px 14px!important;gap:8px!important}
        .kpi{padding:10px 12px!important}
        .kpi-value{font-size:14pt!important}
        .legend{padding:8px 14px 0!important;font-size:9pt}
        .table-wrap{padding:10px 14px 14px!important}
        .table-print{font-size:9pt!important;border-color:#334155!important}
        .table-print th,.table-print td{border-color:#64748b!important;padding:5px 6px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .table-print thead th{font-size:8pt!important}
        .table-print .sym-cell{font-size:12pt!important}
        .data-row td:first-child::before{display:none!important}
        .data-row td:first-child{padding-left:6px!important}
        .data-row td{background:#fff!important}
        .summary,.kpi,.doc-foot{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        thead{display:table-header-group}
        tbody tr{page-break-inside:auto;break-inside:auto}
        thead tr{page-break-inside:avoid;break-inside:avoid}
      }
    </style>
  </head><body>
    <div class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand">
            <img src="/images/cologo.png" alt="" onerror="this.style.display='none'" />
            <div>
              <div class="eyebrow">Monitoring · Renewals</div>
              <h1>${escapeHtml(title)}</h1>
              <p class="hero-sub">Active contracts approaching end date — plan renewals, notices, and unit turnover.</p>
            </div>
          </div>
        </div>
        <div class="chips">
          <span class="chip">Sort <b>${escapeHtml(sortModeLabel || 'Default')}</b></span>
          <span class="chip">Buildings <b>${escapeHtml(buildingsLabel || 'All')}</b></span>
          <span class="chip">Report date <b>${escapeHtml(fmtDate(date))}</b></span>
          <span class="chip">Generated <b>${escapeHtml(fmtDateTime(new Date()))}</b></span>
        </div>
      </header>
      <section class="summary">
        <div class="kpi">
          <span class="kpi-label">Contracts listed</span>
          <span class="kpi-value">${rows.length}</span>
          <p class="kpi-note">Every row is one active contract in the expiring window.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">≤ 30 days left</span>
          <span class="kpi-value" style="color:var(--rose)">${urgentCount}</span>
          <p class="kpi-note">Highest priority for renewal outreach.</p>
        </div>
        <div class="kpi">
          <span class="kpi-label">31–90 days left</span>
          <span class="kpi-value" style="color:var(--amber)">${soonCount}</span>
          <p class="kpi-note">${Math.max(0, rows.length - urgentCount - soonCount)} contracts beyond 90 days.</p>
        </div>
      </section>
      <div class="legend">
        <span><span class="sym-key">H</span> High — ≤30 days</span>
        <span><span class="sym-key">M</span> Medium — 31–90 days</span>
        <span><span class="sym-key">L</span> Low — 91+ days</span>
        <span><span class="sym-key">?</span> No end date</span>
      </div>
      <div class="table-wrap">
        <p class="section-h">Expiring contracts</p>
        <table class="table-print" role="table">
          <colgroup>
            <col style="width:4%" /><col style="width:4%" /><col style="width:18%" /><col style="width:10%" /><col style="width:22%" /><col style="width:12%" /><col style="width:14%" /><col style="width:10%" />
          </colgroup>
          <thead><tr>
            <th class="tc">#</th><th class="tc" title="Urgency tier">St</th><th>Building</th><th class="tc">Unit</th><th>Customer</th><th class="tc">Mobile</th>
            <th class="tc">Contract end</th><th class="tc">Days left</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <footer class="doc-foot"><span>Amlak · Property management</span><span>Confidential — for internal use</span></footer>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},320)};</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=1020,height=880');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

export default Monitoring;

import type { Building, Contract, Transaction } from '../types';
import { dateToLocalStr, localDateStr } from './dateFormat';
import { getInstallmentStartDates } from './installmentSchedule';
import { isNonResidentialBuildingForContract, transactionAppliesToContract } from './contractTransactionFilter';
import { nonResFeeDueForInstallment } from './nonResidentialFeeSchedule';
import { getCarriedPriorInstallmentWindow } from './priorBalanceCarriedInstallment';

export interface MonitoringDueRoomRow {
  contract: Contract;
  isPriorLeaseRow?: boolean;
  installmentNo: number;
  totalInstallments: number;
  nextDueDate: string;
  upcomingDueDate?: string;
  dueRent: number;
  dueFees: number;
  totalDue: number;
  rowKey?: string;
}

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

function normBuildingKey(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function buildingIdCandidates(id: unknown): string[] {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const parts = raw.split(':').map(part => part.trim()).filter(Boolean);
  return Array.from(new Set([raw, parts[parts.length - 1] || raw]));
}

function itemMatchesBuilding(item: any, building: Building): boolean {
  const ids = new Set(buildingIdCandidates((building as any).id));
  const itemIds = [item?.buildingId, item?.building, item?.building_id, item?.id]
    .flatMap(buildingIdCandidates);
  if (itemIds.some(id => ids.has(id))) return true;
  const buildingName = normBuildingKey((building as any).name || (building as any).buildingName || '');
  const itemName = normBuildingKey(item?.buildingName || item?.building_name || '');
  return !!buildingName && !!itemName && buildingName === itemName;
}

function transactionRentCredit(tx: Transaction): number {
  return (
    (Number((tx as any).amountIncludingVAT || (tx as any).totalWithVat || tx.amount) || 0) +
    (Number(tx.discountAmount) || 0) +
    (Number(tx.extraAmount) || 0) +
    (Number(tx.bonusAmount) || 0) -
    (Number(tx.deductionAmount) || 0)
  );
}

function transactionInstallmentYmd(tx: Transaction): string {
  return contractDateToYmd((tx as any).dueDate || (tx as any).installmentStartDate || '');
}

function residentialFeeDueForInstallment(contract: any, instNo: number): number {
  const count = Number(contract.installmentCount) > 0 ? Number(contract.installmentCount) : 1;
  const periodicTotal = Number(contract.waterFee || 0) + Number(contract.internetFee || 0) + Number(contract.parkingFee || 0);
  const periodicPerInst = count > 0 ? periodicTotal / count : 0;
  const oneTime =
    Number(contract.managementFee || 0) +
    Number(contract.officeFeeAmount || 0) +
    Number(contract.serviceFee || 0) +
    Number(contract.insuranceFee || 0) +
    Number(contract.otherAmount || 0) -
    Number(contract.otherDeduction || 0);
  return Math.max(0, Math.round(periodicPerInst + (instNo === 1 ? oneTime : 0)));
}

export function buildMonitoringDueRoomRows(input: {
  building: Building;
  contracts: Contract[];
  transactions: Transaction[];
  reportUpTo?: string;
  payThrough?: string;
}): MonitoringDueRoomRow[] {
  const reportUpTo = input.reportUpTo || localDateStr();
  const payThrough = input.payThrough || localDateStr();
  const catalog = input.contracts.filter((contract: any) => !contract.deleted);
  const catalogIncludingDeleted = input.contracts || [];
  const dueContracts = catalog.filter((contract: any) => {
    if (!itemMatchesBuilding(contract, input.building)) return false;
    return String(contract.status || '').toLowerCase() === 'active';
  });

  return dueContracts.flatMap(contract => {
    const totalInstallments = Math.max(1, Number((contract as any).installmentCount) || 1);
    const upfrontPaid = Number((contract as any).upfrontPaid || 0);
    const nonResContract = isNonResidentialBuildingForContract([input.building], contract as any);
    let priorContractResolved: any;
    const renewedFromId = String((contract as any).renewedFromId || '').trim();
    if (renewedFromId) priorContractResolved = catalogIncludingDeleted.find((x: any) => x.id === renewedFromId);
    const priorNoStored = String((contract as any).priorLeaseContractNoAtRenewal || '').trim();
    if (!priorContractResolved && priorNoStored) {
      priorContractResolved = catalogIncludingDeleted.find(
        (x: any) => String(x.contractNo || '').trim() === priorNoStored && x.buildingId === contract.buildingId,
      );
    }

    const dueDates = getInstallmentStartDates({
      fromDate: (contract as any).fromDate,
      toDate: (contract as any).toDate,
      periodMonths: Number((contract as any).periodMonths) || 0,
      periodDays: Number((contract as any).periodDays) || 0,
      installmentCount: totalInstallments,
    });
    if (!dueDates.length) return [];
    const dueDateKeys = new Set(
      dueDates
        .filter(dueDate => dueDate && !isNaN(dueDate.getTime()))
        .map(dateToLocalStr),
    );

    const rentTxs = input.transactions.filter((tx: any) => {
      if (!tx || tx.type === 'EXPENSE' || tx.feesEntry) return false;
      if (!transactionAppliesToContract(tx, contract as any, catalog as any)) return false;
      const tYmd = contractDateToYmd(tx.date);
      return !tYmd || tYmd <= payThrough;
    });
    const rentPaidByDueDate = new Map<string, number>();
    let fifoPaidRaw = upfrontPaid;
    rentTxs.forEach(tx => {
      const credit = transactionRentCredit(tx);
      const installmentYmd = transactionInstallmentYmd(tx);
      if (installmentYmd && dueDateKeys.has(installmentYmd)) {
        rentPaidByDueDate.set(installmentYmd, (rentPaidByDueDate.get(installmentYmd) || 0) + credit);
        return;
      }
      fifoPaidRaw += credit;
    });
    const paid = Math.max(0, fifoPaidRaw);
    let priorOutstanding = Math.max(0, Number((contract as any).priorLeaseOutstandingAtRenewal) || 0);
    if (
      priorOutstanding === 0 &&
      (Number((contract as any).priorLeaseEffectiveTotalAtRenewal) > 0 ||
        String((contract as any).renewedFromId || '').trim() ||
        String((contract as any).priorLeaseContractNoAtRenewal || '').trim())
    ) {
      const effectivePriorTotal = Number((contract as any).priorLeaseEffectiveTotalAtRenewal) || 0;
      const paidAtRenewal = Number((contract as any).priorLeasePaidAtRenewal) || 0;
      if (effectivePriorTotal > paidAtRenewal + 0.0001) {
        priorOutstanding = Math.round((effectivePriorTotal - paidAtRenewal) * 100) / 100;
      }
    }
    if (!priorContractResolved && priorOutstanding > 0) {
      const newFromYmd = contractDateToYmd((contract as any).fromDate);
      const customerId = String((contract as any).customerId || '').trim();
      const unit = String((contract as any).unitName || '').trim();
      const candidates = catalogIncludingDeleted.filter(
        (x: any) =>
          x.id !== contract.id &&
          x.buildingId === contract.buildingId &&
          String(x.unitName || '').trim() === unit &&
          (!customerId || String(x.customerId || '').trim() === customerId),
      );
      priorContractResolved = candidates
        .map((x: any) => ({
          x,
          toYmd: contractDateToYmd(x.toDate),
          fromYmd: contractDateToYmd(x.fromDate),
        }))
        .filter(item => item.toYmd || item.fromYmd)
        .filter(item => !newFromYmd || !item.toYmd || item.toYmd <= newFromYmd)
        .sort((a, b) => String(b.toYmd || b.fromYmd || '').localeCompare(String(a.toYmd || a.fromYmd || '')))[0]?.x;
    }
    const paidForInstallments = Math.max(0, paid - priorOutstanding);

    const feePaidByDueDate = new Map<string, number>();
    let feePaidRaw = 0;
    if (nonResContract) {
      input.transactions
        .filter((tx: any) => {
          if (!tx || !tx.feesEntry) return false;
          if (!transactionAppliesToContract(tx, contract as any, catalog as any)) return false;
          const tYmd = contractDateToYmd(tx.date);
          return !tYmd || tYmd <= payThrough;
        })
        .forEach((tx: any) => {
          const amount = Number(tx.amount) || 0;
          const installmentYmd = transactionInstallmentYmd(tx);
          if (installmentYmd && dueDateKeys.has(installmentYmd)) {
            feePaidByDueDate.set(installmentYmd, (feePaidByDueDate.get(installmentYmd) || 0) + amount);
            return;
          }
          feePaidRaw += amount;
        });
    }

    const rentValue = Number((contract as any).rentValue || 0);
    const rentPerInst = totalInstallments > 0 ? Math.round(rentValue / totalInstallments) : 0;
    const totalValueStored = Number((contract as any).totalValue || 0);
    let residentialFirst = Number((contract as any).firstInstallment || 0) + upfrontPaid;
    const residentialOther = Number((contract as any).otherInstallment || 0);
    const effectiveContractTotal = totalValueStored + upfrontPaid;
    const residentialScheduleSum = residentialFirst + residentialOther * Math.max(0, totalInstallments - 1);
    if (effectiveContractTotal > 0 && Math.abs(residentialScheduleSum - effectiveContractTotal) > Math.max(5, totalInstallments)) {
      residentialFirst = Math.max(0, effectiveContractTotal - residentialOther * Math.max(0, totalInstallments - 1));
    }
    const useResidentialStoredSchedule =
      !nonResContract &&
      (totalValueStored > 0 || Number((contract as any).firstInstallment) > 0 || Number((contract as any).otherInstallment) > 0);

    let rentCumulatedBefore = 0;
    let feesCumulatedBefore = 0;
    let totalCumulatedBefore = 0;

    const scheduleRows = dueDates.flatMap((dueDate, index) => {
      if (!dueDate || isNaN(dueDate.getTime())) return [];
      const dueDateYmd = dateToLocalStr(dueDate);
      if (reportUpTo && dueDateYmd > reportUpTo && dueDateYmd >= localDateStr()) return [];

      const instNo = index + 1;
      let rentAmount = 0;
      let feesAmount = 0;
      if (nonResContract) {
        rentAmount = rentPerInst;
        feesAmount = nonResFeeDueForInstallment(contract as any, instNo);
      } else if (useResidentialStoredSchedule) {
        rentAmount = Math.round(index === 0 ? residentialFirst : residentialOther);
        feesAmount = 0;
      } else {
        rentAmount = rentPerInst;
        feesAmount = residentialFeeDueForInstallment(contract as any, instNo);
      }

      let rentRemaining = rentAmount;
      let feesRemaining = feesAmount;
      if (nonResContract) {
        const exactRentPaid = Math.max(0, rentPaidByDueDate.get(dueDateYmd) || 0);
        const paidTowardRent = Math.max(0, Math.min(rentAmount, exactRentPaid + Math.max(0, paidForInstallments - rentCumulatedBefore)));
        rentRemaining = Math.max(0, rentAmount - paidTowardRent);
        rentCumulatedBefore += rentAmount;
        const exactFeesPaid = Math.max(0, feePaidByDueDate.get(dueDateYmd) || 0);
        const paidTowardFees = Math.max(0, Math.min(feesAmount, exactFeesPaid + Math.max(0, feePaidRaw - feesCumulatedBefore)));
        feesRemaining = Math.max(0, feesAmount - paidTowardFees);
        feesCumulatedBefore += feesAmount;
      } else {
        const instTotal = useResidentialStoredSchedule ? rentAmount : rentAmount + feesAmount;
        const exactInstPaid = Math.max(0, rentPaidByDueDate.get(dueDateYmd) || 0);
        const paidTowardInst = Math.max(0, Math.min(instTotal, exactInstPaid + Math.max(0, paidForInstallments - totalCumulatedBefore)));
        const remainingTotal = Math.max(0, instTotal - paidTowardInst);
        totalCumulatedBefore += instTotal;
        if (useResidentialStoredSchedule || instTotal <= 0) {
          rentRemaining = remainingTotal;
          feesRemaining = 0;
        } else {
          const rentShare = rentAmount / instTotal;
          rentRemaining = Math.round(remainingTotal * rentShare);
          feesRemaining = Math.max(0, Math.round(remainingTotal - rentRemaining));
        }
      }

      const totalDue = rentRemaining + feesRemaining;
      if (totalDue <= 0) return [];
      return [{
        contract,
        installmentNo: instNo,
        totalInstallments,
        nextDueDate: dueDateYmd,
        upcomingDueDate: dueDates[index + 1] && !isNaN(dueDates[index + 1].getTime()) ? dateToLocalStr(dueDates[index + 1]) : '',
        dueRent: rentRemaining,
        dueFees: feesRemaining,
        totalDue,
        rowKey: `${contract.id}-${instNo}`,
      }];
    });

    const priorRemaining = Math.max(0, priorOutstanding - paid);
    if (priorOutstanding <= 0 || priorRemaining <= 0) return scheduleRows;

    const renewalYmd = contractDateToYmd((contract as any).fromDate);
    const catalogForPriorPaid = catalogIncludingDeleted.map((x: any) =>
      priorContractResolved && x.id === priorContractResolved.id ? { ...x, deleted: false } : x,
    );
    const carriedWindow =
      priorContractResolved && renewalYmd
        ? getCarriedPriorInstallmentWindow({
            priorContract: priorContractResolved,
            renewalYmd,
            buildings: [input.building],
            catalog: catalogForPriorPaid,
            transactions: input.transactions,
          })
        : null;
    const oldLeaseFromYmd = priorContractResolved ? contractDateToYmd(priorContractResolved.fromDate) : '';
    const oldLeaseToYmd = priorContractResolved ? contractDateToYmd(priorContractResolved.toDate) : '';
    const priorDueDate =
      (carriedWindow ? dateToLocalStr(carriedWindow.startDate) : '') ||
      oldLeaseFromYmd ||
      oldLeaseToYmd ||
      renewalYmd ||
      localDateStr();

    return [{
      contract,
      isPriorLeaseRow: true,
      installmentNo: carriedWindow?.installmentNo ?? 0,
      totalInstallments: carriedWindow?.totalInstallments ?? totalInstallments,
      nextDueDate: priorDueDate,
      upcomingDueDate: dueDates[0] && !isNaN(dueDates[0].getTime()) ? dateToLocalStr(dueDates[0]) : '',
      dueRent: priorRemaining,
      dueFees: 0,
      totalDue: priorRemaining,
      rowKey: `${contract.id}-prior-lease`,
    }, ...scheduleRows];
  });
}

import { Building, Contract } from '../types';
import { getInstallmentRange } from './installmentSchedule';
import { fmtDate } from './dateFormat';
import { contractIncludesUnit, pickBestContractForUnit } from './contractUnits';

export function findActiveContractForUnit(contracts: Contract[], buildingId: string, unitName: string): Contract | null {
  const matches = contracts.filter(
    (contract) => contract.buildingId === buildingId && contractIncludesUnit(contract.unitName, unitName),
  );
  return pickBestContractForUnit(matches);
}

export function buildIncomeSheetDetails(input: {
  building: Building;
  contracts: Contract[];
  unitName: string;
  date?: string;
}): string {
  const unitName = input.unitName?.trim();
  if (!unitName) return '';
  const contract = findActiveContractForUnit(input.contracts, input.building.id, unitName);
  if (!contract) return `Rent - Unit ${unitName}`;
  const customer = contract.customerName || 'Tenant';
  const totalInst = contract.installmentCount || 1;
  if (totalInst > 1 && contract.fromDate && contract.toDate) {
    const schedule = {
      fromDate: contract.fromDate,
      toDate: contract.toDate,
      periodMonths: Number(contract.periodMonths) || 0,
      periodDays: Number(contract.periodDays) || 0,
      installmentCount: totalInst,
    };
    const txDate = input.date ? new Date(input.date) : new Date();
    let installmentNo = 1;
    for (let n = totalInst; n >= 1; n--) {
      const { startDate } = getInstallmentRange(schedule, n);
      if (txDate >= startDate) {
        installmentNo = n;
        break;
      }
    }
    const { startDate, endDate } = getInstallmentRange(schedule, installmentNo);
    const period = `${fmtDate(startDate)} to ${fmtDate(endDate)}`;
    return installmentNo === 1
      ? `1st payment (rent + fees) — ${customer} — period ${period}`
      : `Installment ${installmentNo} of ${totalInst} — ${customer} — period ${period}`;
  }
  return `Rent — ${customer} — Unit ${unitName}`;
}

import type { Contract, Customer, EjarContract } from '../types';
import { saveContract, saveEjarContract } from './firestoreService';

export type EjarFieldDiff = {
  field: string;
  ejarValue: string | number;
  amlakValue: string | number;
  severity: 'info' | 'warning' | 'critical';
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function dateDiffDays(a: string, b: string): number {
  if (!a || !b) return 0;
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.abs(Math.floor((da - db) / 86400000));
}

export function compareEjarToContract(
  ejar: EjarContract,
  contract: Contract,
  customer?: Customer,
): EjarFieldDiff[] {
  const diffs: EjarFieldDiff[] = [];

  const push = (
    field: string,
    ejarValue: string | number,
    amlakValue: string | number,
    severity: EjarFieldDiff['severity'],
  ) => {
    if (String(ejarValue).trim() === String(amlakValue).trim()) return;
    diffs.push({ field, ejarValue, amlakValue, severity });
  };

  const startDiff = dateDiffDays(ejar.startDate, contract.fromDate || '');
  if (startDiff > 7) {
    push('startDate', ejar.startDate, contract.fromDate || '', startDiff > 30 ? 'critical' : 'warning');
  }

  const endDiff = dateDiffDays(ejar.endDate, contract.toDate || '');
  if (endDiff > 7) {
    push('endDate', ejar.endDate, contract.toDate || '', endDiff > 30 ? 'critical' : 'warning');
  }

  const ejarRent = Number(ejar.rentAmount) || 0;
  const amlakRent = Number(contract.rentValue) || 0;
  if (amlakRent > 0 && ejarRent > 0) {
    const pct = Math.abs(ejarRent - amlakRent) / amlakRent;
    if (pct > 0.05 || Math.abs(ejarRent - amlakRent) > 500) {
      push(
        'rentAmount',
        ejarRent,
        amlakRent,
        pct > 0.15 ? 'critical' : 'warning',
      );
    }
  }

  if (ejar.tenantIdNo && customer?.idNo && norm(ejar.tenantIdNo) !== norm(customer.idNo)) {
    push('tenantIdNo', ejar.tenantIdNo, customer.idNo, 'warning');
  }

  if (ejar.unitName && contract.unitName && norm(ejar.unitName) !== norm(contract.unitName)) {
    push('unitName', ejar.unitName, contract.unitName, 'warning');
  }

  if (ejar.buildingName && contract.buildingName && norm(ejar.buildingName) !== norm(contract.buildingName)) {
    push('buildingName', ejar.buildingName, contract.buildingName, 'info');
  }

  return diffs;
}

export function hasMismatch(diffs: EjarFieldDiff[]): boolean {
  return diffs.some((d) => d.severity === 'critical' || d.severity === 'warning');
}

export async function syncEjarFromLocal(
  ejar: EjarContract,
  contract: Contract,
  customer?: Customer,
): Promise<EjarContract> {
  const next: EjarContract = {
    ...ejar,
    tenantName: contract.customerName || ejar.tenantName,
    tenantIdNo: customer?.idNo || ejar.tenantIdNo,
    buildingName: contract.buildingName || ejar.buildingName,
    buildingId: contract.buildingId || ejar.buildingId,
    unitName: contract.unitName || ejar.unitName,
    rentAmount: Number(contract.rentValue) || ejar.rentAmount,
    startDate: contract.fromDate || ejar.startDate,
    endDate: contract.toDate || ejar.endDate,
    lastSyncDate: new Date().toISOString(),
  };
  await saveEjarContract(next);
  return next;
}

export type SyncToLocalField = 'dates' | 'rent' | 'tenant' | 'unit';

export async function syncLocalFromEjar(
  ejar: EjarContract,
  contract: Contract,
  opts: { fields: SyncToLocalField[] },
): Promise<{ contract: Contract; diffsApplied: string[] }> {
  const updated = { ...contract } as Contract & Record<string, unknown>;
  const applied: string[] = [];

  if (opts.fields.includes('dates')) {
    if (ejar.startDate) {
      updated.fromDate = ejar.startDate;
      applied.push('fromDate');
    }
    if (ejar.endDate) {
      updated.toDate = ejar.endDate;
      applied.push('toDate');
    }
  }
  if (opts.fields.includes('rent') && ejar.rentAmount) {
    updated.rentValue = ejar.rentAmount;
    applied.push('rentValue');
  }
  if (opts.fields.includes('tenant') && ejar.tenantName) {
    updated.customerName = ejar.tenantName;
    applied.push('customerName');
  }
  if (opts.fields.includes('unit') && ejar.unitName) {
    updated.unitName = ejar.unitName;
    applied.push('unitName');
  }

  await saveContract(updated as Contract);
  return { contract: updated as Contract, diffsApplied: applied };
}

/** Ejar API placeholder — CSV/manual mode until credentials configured. */
export const ejarApiMode = (): 'manual' | 'api' => 'manual';

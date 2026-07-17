import type { Building } from '../types';
import { contractIncludesUnit } from './contractUnits';

/** True when the building is commercial/non-residential (split VAT rent vs non-VAT fees collection in UI). */
function isNonResidentialBuildingForContract(
  buildings: Building[],
  c: { buildingId?: string; buildingName?: string }
): boolean {
  const byId = c.buildingId ? buildings.find(b => b.id === c.buildingId) : undefined;
  if (byId) return byId.propertyType === 'NON_RESIDENTIAL';
  const nm = (c.buildingName || '').trim();
  if (nm) {
    const byName = buildings.find(b => (b.name || '').trim() === nm);
    if (byName) return byName.propertyType === 'NON_RESIDENTIAL';
  }
  return false;
}

type TxLike = {
  status?: string;
  contractId?: string;
  date?: string;
  buildingId?: string;
  unitNumber?: string;
  customerId?: string;
  deleted?: boolean;
  type?: string;
};

export type ContractScope = {
  id: string;
  fromDate?: string;
  toDate?: string;
  buildingId?: string;
  unitName?: string;
  customerId?: string;
  status?: string;
  deleted?: boolean;
};

function txDateWithinContractPeriod(
  txDate: string,
  c: { fromDate?: string; toDate?: string }
): boolean {
  const d = String(txDate || '').trim();
  const f = String(c.fromDate || '').trim();
  const t = String(c.toDate || '').trim();
  if (!d) return false;
  if (f && d < f) return false;
  if (t && d > t) return false;
  return true;
}

/**
 * For income without contractId: pick the contract that should own this row
 * (same building/unit — including multi-unit contracts — payment date inside contract period).
 * Used so a new lease does not absorb legacy payments from a previous lease on the same unit.
 */
export function resolveContractIdForUnscopedIncomeTx(
  t: TxLike,
  allContracts: ReadonlyArray<ContractScope>
): string | null {
  if (String(t.type || '').toUpperCase() === 'EXPENSE') return null;

  const txCid = String(t.contractId || '').trim();
  if (txCid) return txCid;

  const bid = t.buildingId;
  const u = String(t.unitNumber || '').trim();
  const d = String(t.date || '').trim();
  if (!bid || !u || !d) return null;

  let candidates = allContracts.filter(c => {
    if ((c as { deleted?: boolean }).deleted) return false;
    if (c.buildingId !== bid) return false;
    if (!contractIncludesUnit(c.unitName, u)) return false;
    return txDateWithinContractPeriod(d, c);
  });

  if (candidates.length === 0) return null;

  const tcust = String(t.customerId || '').trim();
  if (tcust) {
    const byCust = candidates.filter(c => String(c.customerId || '').trim() === tcust);
    if (byCust.length > 0) candidates = byCust;
  }

  if (candidates.length === 1) return candidates[0].id;

  const active = candidates.find(c => c.status === 'Active');
  if (active) return active.id;

  const sorted = [...candidates].sort((a, b) => {
    const af = String(a.fromDate || '');
    const bf = String(b.fromDate || '');
    return bf.localeCompare(af);
  });
  return sorted[0]?.id || null;
}

function legacyMatchWithoutCatalog(t: TxLike, c: ContractScope): boolean {
  const txDate = String(t.date || '').trim();
  const cFrom = String(c.fromDate || '').trim();
  const cTo = String(c.toDate || '').trim();
  if (t.buildingId !== c.buildingId) return false;
  const u = String(t.unitNumber || '').trim();
  if (!contractIncludesUnit(c.unitName, u)) return false;
  if (cFrom && txDate && txDate < cFrom) return false;
  if (cTo && txDate && txDate > cTo) return false;

  const cc = String(c.customerId || '').trim();
  const tc = String(t.customerId || '').trim();
  if (cc && tc && tc !== cc) return false;

  return true;
}

/**
 * Whether a transaction should count toward a given contract.
 * - Tx with another contractId never matches.
 * - Tx with this contractId always matches.
 * - Legacy (no contractId): if `allContracts` is passed, only match when this contract
 *   wins `resolveContractIdForUnscopedIncomeTx`; otherwise fall back to date/unit/customer rules.
 */
function transactionAppliesToContract(
  t: TxLike,
  c: ContractScope,
  allContracts?: ReadonlyArray<ContractScope>
): boolean {
  if ((t as { deleted?: boolean }).deleted) return false;
  if (t.status === 'REJECTED') return false;

  const txCid = String(t.contractId || '').trim();
  if (txCid && txCid !== c.id) return false;

  if (txCid === c.id) {
    return true;
  }

  if (!txCid) {
    if (allContracts && allContracts.length > 0) {
      if (String(t.type || '').toUpperCase() === 'EXPENSE') return false;
      const owner = resolveContractIdForUnscopedIncomeTx(t, allContracts);
      return owner === c.id;
    }
    return legacyMatchWithoutCatalog(t, c);
  }

  return false;
}

export { isNonResidentialBuildingForContract, transactionAppliesToContract };

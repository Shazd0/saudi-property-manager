/**
 * Multi-unit contracts store units as a comma-separated `unitName`
 * (e.g. "101, 102, 103"). Helpers to parse and match safely.
 */

/** Split contract unitName into individual unit names. */
export function parseContractUnits(unitName?: string | null): string[] {
  return String(unitName || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * True when `unit` is this contract's only unit, or one of its listed units.
 * Uses exact unit-token match (not substring) so "A1" does not match "A10".
 */
export function contractIncludesUnit(
  contractUnitName?: string | null,
  unit?: string | null,
): boolean {
  const u = String(unit || '').trim();
  if (!u) return false;
  const full = String(contractUnitName || '').trim();
  if (!full) return false;
  if (full === u) return true;
  return parseContractUnits(full).some((part) => part === u);
}

/** Prefer Active, then most recent by fromDate. */
export function pickBestContractForUnit<
  T extends { status?: string; fromDate?: string; deleted?: boolean },
>(candidates: T[]): T | null {
  const live = candidates.filter((c) => !(c as { deleted?: boolean }).deleted);
  if (live.length === 0) return null;
  const active = live.find((c) => c.status === 'Active');
  if (active) return active;
  const sorted = [...live].sort((a, b) =>
    String(b.fromDate || '').localeCompare(String(a.fromDate || '')),
  );
  return sorted[0] || null;
}

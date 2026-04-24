// globalSearchService.ts
// Searches customers, contracts, and buildings for a query string
import { getCustomers, getContracts, getBuildings } from '../services/firestoreService';

export interface GlobalSearchResult {
  type: 'customer' | 'contract' | 'building';
  id: string;
  label: string;
  details?: string;
}

export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const q = query.toLowerCase();
  const [customers, contracts, buildings] = await Promise.all([
    getCustomers({ includeDeleted: false }),
    getContracts({ includeDeleted: false }),
    getBuildings({ includeDeleted: false })
  ]);
  const results: GlobalSearchResult[] = [];
  customers.forEach(c => {
    if (
      (c.nameEn && c.nameEn.toLowerCase().includes(q)) ||
      (c.nameAr && c.nameAr.toLowerCase().includes(q)) ||
      (c.mobileNo && c.mobileNo.includes(q)) ||
      (c.idNo && c.idNo.includes(q)) ||
      (c.code && c.code.toString().includes(q))
    ) {
      results.push({ type: 'customer', id: c.id, label: c.nameEn || c.nameAr, details: c.mobileNo });
    }
  });
  contracts.forEach(c => {
    if (
      (c.contractNo && c.contractNo.toLowerCase().includes(q)) ||
      (c.customerName && c.customerName.toLowerCase().includes(q)) ||
      (c.buildingName && c.buildingName.toLowerCase().includes(q))
    ) {
      results.push({ type: 'contract', id: c.id, label: c.contractNo, details: c.customerName });
    }
  });
  buildings.forEach(b => {
    if (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.id && b.id.toLowerCase().includes(q))
    ) {
      results.push({ type: 'building', id: b.id, label: b.name });
    }
  });
  return results;
}
